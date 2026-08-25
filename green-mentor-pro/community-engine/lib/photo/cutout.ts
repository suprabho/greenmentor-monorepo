// Server-side speaker-photo background removal.
//
// Runs U²-Net-small (u2netp, Apache-2.0, vendored at models/u2netp.onnx — no
// external ML service, no runtime model download) through onnxruntime-node and
// composites the predicted matte into the source image's alpha channel. Used
// by POST /api/photo/cutout; the studio then uploads the returned PNG like any
// other speaker photo, so the cutout is baked into the stored URL and the
// renderer stays a dumb <img>.
//
// Quality: u2netp is the 4.5MB distilled model — clean on headshots, slightly
// soft on wispy hair. Point CUTOUT_MODEL_PATH at a bigger U²-Net-family model
// (e.g. silueta / u2net_human_seg from the rembg releases) to upgrade without
// a code change; every model in that family shares this 320×320 I/O contract.

import path from "node:path";

// U²-Net models take a 320×320 normalized RGB tensor and return a 320×320
// saliency matte in the first output.
const MODEL_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

function modelPath(): string {
  return (
    process.env.CUTOUT_MODEL_PATH ||
    path.join(process.cwd(), "models", "u2netp.onnx")
  );
}

// The ORT session is expensive (~model parse + graph init); cache it across
// invocations. `any` because onnxruntime-node is lazily imported to keep its
// native binary out of every other lambda's bundle graph.
let sessionPromise: Promise<any> | null = null;

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-node");
      return ort.InferenceSession.create(modelPath());
    })();
  }
  return sessionPromise;
}

/**
 * Remove the background from a photo. Returns a PNG with the subject opaque
 * and the background transparent, at the source resolution.
 */
export async function cutoutImage(input: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const ort = await import("onnxruntime-node");
  const session = await getSession();

  const src = sharp(input).rotate(); // honor EXIF orientation once, up front
  const meta = await src.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("Could not read image dimensions");

  // Preprocess: 320×320, ImageNet-normalized, CHW.
  const { data: rgb } = await src
    .clone()
    .resize(MODEL_SIZE, MODEL_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const plane = MODEL_SIZE * MODEL_SIZE;
  const inputTensor = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      inputTensor[c * plane + i] = (rgb[i * 3 + c] / 255 - MEAN[c]) / STD[c];
    }
  }

  const feeds = {
    [session.inputNames[0]]: new ort.Tensor("float32", inputTensor, [
      1,
      3,
      MODEL_SIZE,
      MODEL_SIZE,
    ]),
  };
  const results = await session.run(feeds);
  const matte = results[session.outputNames[0]].data as Float32Array;

  // Min-max normalize the matte to 0–255 (standard U²-Net postprocessing).
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < plane; i++) {
    const v = matte[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const range = mx - mn || 1;
  const mask = Buffer.alloc(plane);
  for (let i = 0; i < plane; i++) {
    mask[i] = Math.round(((matte[i] - mn) / range) * 255);
  }

  // Upscale the matte to the source size with a light feather, then write it
  // into the alpha channel. Track the resized buffer's channel stride — sharp
  // may hand back more than one channel.
  const maskOut = await sharp(mask, {
    raw: { width: MODEL_SIZE, height: MODEL_SIZE, channels: 1 },
  })
    .resize(width, height, { fit: "fill" })
    .blur(0.6)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stride = maskOut.info.channels;

  const rgba = await sharp(input)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < width * height; i++) {
    // Multiply into any existing alpha so re-running on a cutout stays stable.
    rgba.data[i * 4 + 3] = Math.round(
      (rgba.data[i * 4 + 3] * maskOut.data[i * stride]) / 255
    );
  }

  return sharp(rgba.data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}
