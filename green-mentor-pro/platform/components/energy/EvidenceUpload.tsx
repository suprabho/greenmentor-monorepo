// Evidence/bill uploader — pushes files to the private energy-uploads bucket via
// /api/energy/evidence and tracks the returned storage paths (submitted with the
// entry). Preview links use the returned signed URL.
"use client";

import { useState } from "react";
import { Paperclip, X } from "@phosphor-icons/react";
import { Field } from "@/components/esg/ui";

export interface EvidenceFile {
  path: string;
  url: string | null;
  filename: string;
}

export function EvidenceUpload({
  files,
  onChange,
}: {
  files: EvidenceFile[];
  onChange: (files: EvidenceFile[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const uploaded: EvidenceFile[] = [];
      for (const file of Array.from(list)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/energy/evidence", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        uploaded.push({ path: data.path, url: data.url, filename: data.filename });
      }
      onChange([...files, ...uploaded]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label="Evidence" hint="Bill / invoice — PDF, image or zip" error={err ?? undefined}>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-[13px] text-gray-600 hover:border-teal-700 hover:text-ink">
        <Paperclip size={15} />
        {busy ? "Uploading…" : "Attach files"}
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.zip"
          className="hidden"
          disabled={busy}
          onChange={(e) => upload(e.target.files)}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={f.path} className="flex items-center gap-2 text-[12px] text-gray-700">
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-teal-700 hover:underline">
                  {f.filename}
                </a>
              ) : (
                <span className="truncate">{f.filename}</span>
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-danger"
                aria-label="Remove"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
