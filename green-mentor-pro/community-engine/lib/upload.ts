/**
 * Client helper for POST /api/uploads/image — uploads an image to the shared
 * public bucket and returns its hosted URL. `folder` groups uploads by feature
 * (e.g. "speakers", "instructors"). Admin gated server-side; throws with the
 * route's error message (including the "not configured" hint) on failure.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/uploads/image", { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.url as string;
}
