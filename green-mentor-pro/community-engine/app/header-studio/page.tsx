"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, DownloadSimple, Plus, X, Spinner } from "@phosphor-icons/react";
import { Card, PageHeader, Chip } from "@/components/ui";
import { headerDocumentHTML } from "@/lib/header/render";
import {
  AURA_PRESETS,
  BRAND_GREEN,
  DEFAULT_CONFIG,
  LOGO_COLOR_PRESETS,
  LOGO_SIZE_PRESETS,
  SIZE_PRESETS,
  sizeFor,
  type HeaderConfig,
} from "@/lib/header/types";
import { listBrands, getBrand } from "@/lib/header/brands";
import { createClient } from "@/lib/supabase/client";
import { getHeader } from "@/lib/db/headers";
import { SaveBar } from "./save-bar";

const BUNDLED_AVATARS = [
  "/avatars/aditya.jpg",
  "/avatars/ananya.jpg",
  "/avatars/rohan.jpg",
  "/avatars/meera.jpg",
  "/avatars/divya.jpg",
  "/avatars/karan.jpg",
  "/avatars/vikram.jpg",
  "/avatars/rao.jpg",
  "/avatars/speaker-csrd.jpg",
];

/** Debounce a value so the aura iframe doesn't reload on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const inputCls =
  "w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20";

export default function HeaderStudioPage() {
  const [config, setConfig] = useState<HeaderConfig>(DEFAULT_CONFIG);
  const [customSlug, setCustomSlug] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [origin, setOrigin] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loadedOwned, setLoadedOwned] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  // Load a saved header when opened from the library (/header-studio?load=<id>).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("load");
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const row = await getHeader(supabase, id);
        if (!cancelled && row) {
          setConfig({ ...DEFAULT_CONFIG, ...row.config });
          setLoadedId(row.id);
          setLoadedOwned(!!user && user.id === row.user_id);
        }
      } catch {
        // Ignore — fall back to the default config.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const debounced = useDebounced(config, 300);
  const srcDoc = useMemo(
    () => headerDocumentHTML(debounced, { origin }),
    [debounced, origin]
  );

  const size = sizeFor(config.sizeId);
  const set = <K extends keyof HeaderConfig>(k: K, v: HeaderConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  // Undefined `enabled` is treated as on, matching the renderer.
  const speakerOn = !!config.speaker && config.speaker.enabled !== false;

  // Logo color/size, with the same defaults the renderer's logoFor() applies.
  const logo = config.logo ?? { color: BRAND_GREEN, scale: 1, fill: false };

  // Preview is scaled to fit the panel width.
  const PREVIEW_W = 560;
  const scale = PREVIEW_W / size.width;

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch("/api/header/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Export failed: ${msg}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `header-${config.sizeId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${(e as Error).message}`);
    } finally {
      setDownloading(false);
    }
  }

  const activePresetId =
    AURA_PRESETS.find((p) => p.slug === config.auraSlug)?.id ?? "custom";

  return (
    <div>
      <PageHeader
        title="Aura Header Studio"
        sub="Compose a webinar / newsletter header over a live aura background, then export a pixel-perfect PNG."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-700"
            >
              <ArrowLeft size={14} /> Tools
            </Link>
            <button
              onClick={download}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {downloading ? (
                <Spinner size={14} className="animate-spin" />
              ) : (
                <DownloadSimple size={14} weight="bold" />
              )}
              {downloading ? "Rendering…" : "Download PNG"}
            </button>
          </div>
        }
      />

      <SaveBar config={config} loadedId={loadedId} loadedOwned={loadedOwned} />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,600px)]">
        {/* ---- Form ---- */}
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Size">
                <select
                  className={inputCls}
                  value={config.sizeId}
                  onChange={(e) => set("sizeId", e.target.value)}
                >
                  {SIZE_PRESETS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Aura background">
                <select
                  className={inputCls}
                  value={activePresetId}
                  onChange={(e) => {
                    const p = AURA_PRESETS.find((x) => x.id === e.target.value);
                    if (p) set("auraSlug", p.slug);
                  }}
                >
                  {AURA_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  {activePresetId === "custom" && <option value="custom">Custom slug</option>}
                </select>
              </Field>
            </div>

            <Field label="Custom aura slug or URL (paste any from aura.promad.design)">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="e.g. blue-fluid-tech-header  or  https://aura.promad.design/embed/…"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                />
                <button
                  onClick={() => customSlug.trim() && set("auraSlug", customSlug.trim())}
                  className="shrink-0 rounded-[10px] bg-gray-100 px-3 text-[12.5px] font-semibold text-gray-800"
                >
                  Apply
                </button>
              </div>
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <Field label="Badge (small uppercase tag)">
              <input
                className={inputCls}
                value={config.badge}
                onChange={(e) => set("badge", e.target.value)}
              />
            </Field>
            <Field label="Title">
              <textarea
                rows={2}
                className={inputCls}
                value={config.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field label="Subtitle (optional)">
              <input
                className={inputCls}
                value={config.subtitle ?? ""}
                onChange={(e) => set("subtitle", e.target.value)}
              />
            </Field>

            {/* Chips */}
            <div>
              <span className="mb-1 block text-[12px] font-semibold text-gray-700">
                Meta chips (icon + label)
              </span>
              <div className="space-y-2">
                {config.chips.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={`${inputCls} w-16 text-center`}
                      value={c.icon ?? ""}
                      onChange={(e) => {
                        const chips = [...config.chips];
                        chips[i] = { ...chips[i], icon: e.target.value };
                        set("chips", chips);
                      }}
                    />
                    <input
                      className={inputCls}
                      value={c.label}
                      onChange={(e) => {
                        const chips = [...config.chips];
                        chips[i] = { ...chips[i], label: e.target.value };
                        set("chips", chips);
                      }}
                    />
                    <button
                      onClick={() => set("chips", config.chips.filter((_, j) => j !== i))}
                      className="shrink-0 rounded-[10px] bg-gray-100 px-2.5 text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => set("chips", [...config.chips, { icon: "•", label: "New chip" }])}
                  className="flex items-center gap-1.5 rounded-[10px] border border-dashed border-gray-300 px-3 py-1.5 text-[12.5px] font-semibold text-gray-600"
                >
                  <Plus size={13} /> Add chip
                </button>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                Speaker
              </span>
              <Toggle
                label="Show speaker"
                checked={speakerOn}
                onChange={(on) =>
                  set("speaker", {
                    ...(config.speaker ?? { name: "" }),
                    enabled: on,
                  })
                }
              />
            </div>
            <div
              className={`grid grid-cols-2 gap-3 ${
                speakerOn ? "" : "pointer-events-none opacity-50"
              }`}
            >
              <Field label="Name">
                <input
                  className={inputCls}
                  value={config.speaker?.name ?? ""}
                  onChange={(e) =>
                    set("speaker", { ...config.speaker, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <input
                  className={inputCls}
                  value={config.speaker?.role ?? ""}
                  onChange={(e) =>
                    set("speaker", { ...config.speaker, name: config.speaker?.name ?? "", role: e.target.value })
                  }
                />
              </Field>
              <Field label="Organisation">
                <input
                  className={inputCls}
                  value={config.speaker?.org ?? ""}
                  onChange={(e) =>
                    set("speaker", { ...config.speaker, name: config.speaker?.name ?? "", org: e.target.value })
                  }
                />
              </Field>
              <Field label="Photo (path or URL)">
                <input
                  list="avatars"
                  className={inputCls}
                  value={config.speaker?.photo ?? ""}
                  onChange={(e) =>
                    set("speaker", { ...config.speaker, name: config.speaker?.name ?? "", photo: e.target.value })
                  }
                />
                <datalist id="avatars">
                  {BUNDLED_AVATARS.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand lockup">
                <select
                  className={inputCls}
                  value={config.brandId ?? ""}
                  onChange={(e) => {
                    const brand = getBrand(e.target.value);
                    // Switching brand also resets the subline to its default.
                    setConfig((c) => ({
                      ...c,
                      brandId: brand.id,
                      brandSub: brand.sub ?? "",
                    }));
                  }}
                >
                  {listBrands().map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brand subline">
                <input
                  className={inputCls}
                  value={config.brandSub ?? ""}
                  onChange={(e) => set("brandSub", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Logo color">
                <div className="flex items-center gap-2">
                  {LOGO_COLOR_PRESETS.map((p) => {
                    const active =
                      logo.color.toLowerCase() === p.value.toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={p.label}
                        aria-label={p.label}
                        aria-pressed={active}
                        onClick={() => set("logo", { ...logo, color: p.value })}
                        className={`h-8 w-8 rounded-full border-2 transition ${
                          active
                            ? "border-ink ring-2 ring-green-500/30"
                            : "border-gray-200"
                        }`}
                        style={{ background: p.value }}
                      />
                    );
                  })}
                  <label
                    className="ml-1 flex h-8 cursor-pointer items-center gap-1.5 rounded-pill border border-gray-200 px-2.5 text-[11.5px] font-semibold text-gray-600"
                    title="Custom color"
                  >
                    <input
                      type="color"
                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                      value={logo.color}
                      onChange={(e) =>
                        set("logo", { ...logo, color: e.target.value })
                      }
                    />
                    Custom
                  </label>
                </div>
              </Field>
              <Field label="Logo size">
                <div className="flex gap-2">
                  {LOGO_SIZE_PRESETS.map((p) => {
                    const active = Math.abs(logo.scale - p.scale) < 0.001;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => set("logo", { ...logo, scale: p.scale })}
                        className={`flex-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold transition ${
                          active
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-700"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Logo style">
                <div className="flex gap-2">
                  {[
                    { fill: false, label: "Outline" },
                    { fill: true, label: "Filled" },
                  ].map((p) => {
                    const active = logo.fill === p.fill;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => set("logo", { ...logo, fill: p.fill })}
                        className={`flex-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold transition ${
                          active
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-700"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label={`Scrim (${config.theme.scrim.toFixed(2)})`}>
                <input
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  className="w-full accent-green-500"
                  value={config.theme.scrim}
                  onChange={(e) =>
                    set("theme", { ...config.theme, scrim: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Accent">
                <input
                  type="color"
                  className="h-9 w-full rounded-[10px] border border-gray-200"
                  value={config.theme.accent}
                  onChange={(e) =>
                    set("theme", { ...config.theme, accent: e.target.value })
                  }
                />
              </Field>
              <Field label="Text">
                <input
                  type="color"
                  className="h-9 w-full rounded-[10px] border border-gray-200"
                  value={config.theme.text}
                  onChange={(e) =>
                    set("theme", { ...config.theme, text: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <div>
                <span className="block text-[12px] font-semibold text-gray-700">
                  Card behind text
                </span>
                <span className="text-[11px] text-gray-500">
                  Frosted panel behind the headline for extra legibility
                </span>
              </div>
              <Toggle
                label="Card behind text"
                checked={!!config.theme.card}
                onChange={(on) => set("theme", { ...config.theme, card: on })}
              />
            </div>
          </Card>
        </div>

        {/* ---- Preview ---- */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden p-4">
            <div className="mb-3 flex items-center justify-between">
              <Chip tone="green">Live preview</Chip>
              <span className="text-[11.5px] text-gray-500">
                {size.width}×{size.height}px
              </span>
            </div>
            <div
              className="overflow-hidden rounded-[14px] border border-gray-200 bg-teal-900"
              style={{ width: PREVIEW_W, height: size.height * scale }}
            >
              <iframe
                title="Header preview"
                srcDoc={srcDoc}
                style={{
                  width: size.width,
                  height: size.height,
                  border: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
                // The aura embed is cross-origin; allow it to run.
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
              The preview embeds the real animated aura. The downloaded PNG is a
              server-side screenshot of this exact markup, so what you see is what
              you get.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
