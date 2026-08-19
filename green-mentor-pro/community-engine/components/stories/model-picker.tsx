"use client";

/**
 * The compose flow's text-model choice: one selection for the whole document,
 * shared by the angles, outline and per-band stages.
 *
 * The option list comes from the server (`/api/stories/models`) rather than a
 * constant, because which aliases actually resolve depends on server env — on the
 * direct-Anthropic path only Claude models are reachable, and offering the rest
 * would let an author pick "GPT-5.6" and silently get Sonnet.
 *
 * Only the pipeline (`body_format: 'vismay'`) stages honour it. The legacy blocks
 * draft calls the Anthropic SDK with a pinned model, so the picker is not rendered
 * there.
 */

import { useEffect, useState } from "react";

export interface TextModelOption {
  alias: string;
  label: string;
  note?: string;
}

export function useTextModel(enabled: boolean) {
  const [models, setModels] = useState<TextModelOption[]>([]);
  const [model, setModel] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/stories/models");
        if (!res.ok) return;
        const body = (await res.json()) as { models?: TextModelOption[]; default?: string };
        if (!live) return;
        setModels(body.models ?? []);
        // Leaving `model` undefined until this lands is deliberate: the routes
        // resolve their own default, so a compose call fired before the list
        // arrives still uses the right model.
        if (body.default) setModel(body.default);
      } catch {
        // The routes fall back to the deployment default; the picker just stays empty.
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled]);

  return { model, setModel, models };
}

export function ModelPicker({
  model,
  setModel,
  models,
}: {
  model: string | undefined;
  setModel: (next: string) => void;
  models: TextModelOption[];
}) {
  if (models.length === 0) return null;
  const note = models.find((m) => m.alias === model)?.note;
  return (
    <label className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
      <span className="font-semibold uppercase tracking-[0.1em]">Model</span>
      <select
        value={model ?? ""}
        onChange={(e) => setModel(e.target.value)}
        title={note ?? undefined}
        className="max-w-[15rem] truncate rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11.5px] text-ink"
      >
        {models.map((m) => (
          <option key={m.alias} value={m.alias}>
            {m.label}
            {m.note ? " ⚠" : ""}
          </option>
        ))}
      </select>
      {note ? <span className="text-[11px] text-danger">{note}</span> : null}
    </label>
  );
}
