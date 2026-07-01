"use client";

import { useRef, useState } from "react";
import { Paperclip, PaperPlaneRight, X, SpinnerGap } from "@phosphor-icons/react";
import { clsx } from "clsx";

export interface ComposerSkill {
  id: string;
  label: string;
  hint?: string;
  /** Text inserted into the composer when the skill is picked. */
  template: string;
}

export interface ComposerAttachment {
  type: "file";
  url: string;
  mediaType: string;
  filename?: string;
}

interface ChatComposerProps {
  onSend: (text: string, files: ComposerAttachment[]) => void;
  busy?: boolean;
  placeholder?: string;
  /** When set, an attach button uploads files here (POST FormData → { url, mediaType, filename }). */
  uploadUrl?: string;
  /** When set, typing "/" opens a skill menu of prompt starters. */
  skills?: ComposerSkill[];
  autoFocus?: boolean;
  /** Larger, centered treatment for the welcome / empty state. */
  size?: "default" | "hero";
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf";

/**
 * Shared composer for the standalone Chat and the Cowork copilot. Text-only by
 * default; pass `uploadUrl` to enable attachments and `skills` to enable the "/"
 * starter menu. Enter sends, Shift+Enter inserts a newline.
 */
export function ChatComposer({
  onSend,
  busy = false,
  placeholder = "Message…",
  uploadUrl,
  skills,
  autoFocus,
  size = "default",
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ComposerAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // "/" menu: open when the text is a bare slash-token (e.g. "/mat").
  const slash = skills ? /^\/(\S*)$/.exec(text) : null;
  const menuQuery = slash?.[1]?.toLowerCase() ?? "";
  const menuSkills = slash ? (skills ?? []).filter((s) => (s.id + s.label).toLowerCase().includes(menuQuery)) : [];
  const showMenu = !!slash && menuSkills.length > 0;

  const canSend = !busy && !uploading && (text.trim().length > 0 || files.length > 0);

  function send() {
    if (!canSend) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
    setUploadError(null);
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length || !uploadUrl) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(uploadUrl, { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`);
        setFiles((prev) => [...prev, { type: "file", url: json.url, mediaType: json.mediaType, filename: json.filename }]);
      }
    } catch (e) {
      setUploadError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      {showMenu && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lift">
          <div className="border-b border-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Skills
          </div>
          {menuSkills.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setText(s.template.endsWith(" ") ? s.template : s.template + " ")}
              className="block w-full px-3 py-2 text-left hover:bg-gray-50"
            >
              <div className="text-[13px] font-semibold text-ink">/{s.id}</div>
              {s.hint && <div className="text-[12px] text-gray-500">{s.hint}</div>}
            </button>
          ))}
        </div>
      )}

      <div
        className={clsx(
          "rounded-2xl border border-gray-200 bg-white shadow-soft transition-colors focus-within:border-teal-700",
          size === "hero" ? "p-3" : "p-2"
        )}
      >
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={f.url + i}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[12px] text-gray-700"
              >
                {f.filename ?? "file"}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label="Remove attachment"
                >
                  <X size={13} weight="bold" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {uploadUrl && (
            <>
              <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => handleFiles(e.target.files)} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Attach file"
              >
                {uploading ? <SpinnerGap size={18} className="animate-spin" /> : <Paperclip size={18} />}
              </button>
            </>
          )}

          <textarea
            value={text}
            autoFocus={autoFocus}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={size === "hero" ? 2 : 1}
            placeholder={placeholder}
            className="max-h-40 flex-1 resize-none bg-transparent px-1.5 py-2 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-gray-400"
          />

          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-green-700 text-white transition-opacity hover:bg-green-700/90 disabled:opacity-40"
            aria-label="Send"
          >
            {busy ? <SpinnerGap size={18} className="animate-spin" /> : <PaperPlaneRight size={18} weight="fill" />}
          </button>
        </div>
      </div>

      {uploadError && <p className="mt-1.5 px-1 text-[12px] text-danger">{uploadError}</p>}
    </div>
  );
}
