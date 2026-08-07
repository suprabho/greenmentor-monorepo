"use client";

/**
 * The admin panel's image field: paste a hosted URL, or upload a file and get
 * one back. Uploads go through /api/uploads/image into the shared public
 * bucket, grouped by `folder`.
 *
 * Extracted from the instructors panel so the news panel could reuse it rather
 * than grow a second copy.
 */

import { useRef, useState } from "react";
import { Spinner, Upload } from "@phosphor-icons/react/dist/ssr";
import { uploadImage } from "@/lib/upload";

export const fieldInputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";
export const fieldLabelCls =
  "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";

export function PhotoField({
  value,
  onChange,
  /** Groups uploads in the bucket, e.g. "instructors", "news". */
  folder,
  label = "Photo",
  placeholder = "Upload, or paste https://…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  folder: string;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      onChange(await uploadImage(file, folder));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className={`${fieldLabelCls} ${className ?? ""}`}>
      {label}
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${fieldInputCls} min-w-0 flex-1`}
        />
        <button
          type="button"
          title="Upload an image"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2.5 text-[12px] font-semibold normal-case tracking-normal text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          {uploading ? <Spinner size={12} className="animate-spin" /> : <Upload size={12} />}
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {err ? <span className="text-[11px] font-normal normal-case tracking-normal text-danger">{err}</span> : null}
    </label>
  );
}
