"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  DownloadSimple,
  FrameCorners,
  Image as ImageIcon,
  Spinner,
  Stack,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import type { VizLayer } from "@vismay/viz-engine";
import {
  ConfigPanel,
  LayerListPanel,
  PreviewPane,
  addLayer,
  normalizeGroupContiguity,
  patchLayerBox,
  patchLayerTransform,
  setLayerConfig,
  type ComposerSelection,
  type ComposerState,
  type LayerBox,
  type TransformLike,
} from "@vismay/viz-admin";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { getShareCard } from "@/lib/db/shareCards";
import { AURA_PRESETS } from "@/lib/header/types";
import { registerGmCardModules } from "@/lib/share-cards/modules";
import { ImagePicker, registerGmPickers } from "@/lib/share-cards/pickers";
import { gmCardHost, GM_LAYER_TYPES, type GmComposerCtx } from "@/lib/share-cards/host";
import { useShareCardData } from "@/lib/share-cards/useShareCardData";
import {
  ASPECT_RATIOS,
  DEFAULT_RATIO,
  GM_CARD_THEMES,
  THEME_IDS,
  defaultFrame,
  normalizeSnapshot,
  type CardFrame,
  type GmAspectRatio,
  type ShareCardSnapshotV1,
} from "@/lib/share-cards/types";
import { SaveBar } from "./save-bar";

// Register the gmcard:* modules + their picker editors into the registries on
// first import (idempotent), so the composer can resolve types + edit fields.
registerGmCardModules();
registerGmPickers();

// ── dark studio-island styling (matches the footshorts composer look) ────────
const labelCls = "block text-[11px] font-medium text-neutral-400";
const inputCls =
  "mt-1 w-full rounded-md border border-white/10 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-white/30";
const toolbarBtn =
  "flex items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

type EditorTab = "layers" | "setup" | "background";
const TABS: Array<{ id: EditorTab; label: string; Icon: PhosphorIcon }> = [
  { id: "layers", label: "Layers", Icon: Stack },
  { id: "setup", label: "Card setup", Icon: FrameCorners },
  { id: "background", label: "Background", Icon: ImageIcon },
];

export function ShareCardStudio({ initialId }: { initialId: string | null }) {
  const router = useRouter();
  const { data, loading: dataLoading, error: dataError } = useShareCardData();

  const [composer, setComposer] = useState<ComposerState>({ layers: [], background: null });
  const [selection, setSelection] = useState<ComposerSelection>(null);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>("layers");

  const [frame, setFrame] = useState<CardFrame>(defaultFrame);
  const [ratio, setRatio] = useState<GmAspectRatio>(DEFAULT_RATIO);

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loadedOwned, setLoadedOwned] = useState(false);
  const [loadingCard, setLoadingCard] = useState(!!initialId);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState<"png" | "webp" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const patchFrame = useCallback(
    (p: Partial<CardFrame>) => setFrame((f) => ({ ...f, ...p })),
    []
  );

  // Load a saved card when opened via /share-cards?id=…
  useEffect(() => {
    if (!initialId) return;
    let alive = true;
    void (async () => {
      try {
        const supabase = createClient();
        const [{ data: auth }, row] = await Promise.all([
          supabase.auth.getUser(),
          getShareCard(supabase, initialId),
        ]);
        if (!alive) return;
        if (!row) {
          setLoadError("Card not found (or not shared with you).");
        } else {
          const snap = normalizeSnapshot(row.config);
          setFrame(snap.frame);
          setRatio(snap.ratio);
          setComposer(
            normalizeGroupContiguity({
              layers: snap.foreground,
              background: null,
              groups: snap.groups,
            })
          );
          setLoadedId(row.id);
          setLoadedOwned(row.user_id === auth.user?.id);
        }
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Could not load the card.");
      } finally {
        if (alive) setLoadingCard(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialId]);

  const ctx: GmComposerCtx = useMemo(() => ({ frame, ratio, data }), [frame, ratio, data]);

  const snapshot: ShareCardSnapshotV1 = useMemo(
    () => ({ version: 1, ratio, frame, foreground: composer.layers, groups: composer.groups }),
    [ratio, frame, composer]
  );

  // ── composer wiring (mirrors ShareCardCreator) ──────────────────────────────
  const handleSelect = useCallback((sel: ComposerSelection) => setSelection(sel), []);
  const handleComposerChange = useCallback((next: ComposerState) => setComposer(next), []);
  const handleToggleMulti = useCallback(
    (id: string) =>
      setMultiSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    []
  );
  const handleAddLayer = useCallback(
    (type: string) => {
      const layer = gmCardHost.makeLayer(type, ctx);
      setComposer((c) => addLayer(c, layer));
      setSelection({ kind: "layer", id: layer.id });
    },
    [ctx]
  );
  const handleLayerConfig = useCallback(
    (id: string, layer: VizLayer) => setComposer((c) => setLayerConfig(c, id, layer)),
    []
  );
  const handleLayerTransform = useCallback(
    (id: string, patch: Partial<TransformLike>) =>
      setComposer((c) => patchLayerTransform(c, id, patch)),
    []
  );
  const handleLayerBox = useCallback(
    (id: string, patch: Partial<LayerBox>) => setComposer((c) => patchLayerBox(c, id, patch)),
    []
  );

  const handleNew = useCallback(() => {
    setComposer({ layers: [], background: null });
    setSelection(null);
    setMultiSel([]);
    setFrame(defaultFrame());
    setRatio(DEFAULT_RATIO);
    setLoadedId(null);
    setLoadedOwned(false);
    setLoadError(null);
    setExportError(null);
    router.replace("/share-cards");
  }, [router]);

  const hasLayers = composer.layers.length > 0;

  const handleDownload = useCallback(
    async (format: "png" | "webp") => {
      if (!hasLayers || downloading) return;
      setDownloading(format);
      setExportError(null);
      try {
        const res = await fetch("/api/share-cards/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot, format }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gm-share-card-${ratio.replace(":", "x")}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setExportError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setDownloading(null);
      }
    },
    [hasLayers, downloading, snapshot, ratio]
  );

  // Name suggestion for the save bar: the picked article's title, else the
  // first headline layer's text.
  const defaultTitle = useMemo(() => {
    for (const l of composer.layers) {
      const cfg = l.layer as Record<string, unknown>;
      if (cfg.type === "gmcard:article" && typeof cfg.articleId === "string") {
        const a = data.articles.find((x) => x.id === cfg.articleId);
        if (a) return a.title;
      }
      if (cfg.type === "gmcard:headline" && typeof cfg.text === "string" && cfg.text.trim()) {
        return cfg.text.trim();
      }
    }
    return "Untitled card";
  }, [composer.layers, data.articles]);

  const handleSaved = useCallback(
    (id: string) => {
      setLoadedId(id);
      setLoadedOwned(true);
      // Keep the URL addressable without a reload so Update targets this card.
      window.history.replaceState(null, "", `/share-cards?id=${id}`);
    },
    []
  );

  if (dataLoading || loadingCard) {
    return (
      <Card className="mb-6 grid place-items-center p-16 text-[13px] text-gray-500">
        <span className="flex items-center gap-2">
          <Spinner size={16} className="animate-spin" /> Loading the studio…
        </span>
      </Card>
    );
  }

  return (
    <>
      {(dataError || loadError) && (
        <Card className="mb-4 border-danger/30 p-4 text-[13px] text-danger">
          {dataError ?? loadError}
        </Card>
      )}

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-neutral-950 shadow-[var(--shadow-soft)]">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
          <button type="button" onClick={handleNew} className={toolbarBtn}>
            <ArrowCounterClockwise size={14} /> New
          </button>
          <span className="flex-1" />
          {exportError && (
            <span className="max-w-[360px] truncate text-[11px] text-red-400" title={exportError}>
              {exportError}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleDownload("png")}
            disabled={!hasLayers || downloading !== null}
            className={toolbarBtn}
          >
            {downloading === "png" ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <DownloadSimple size={14} />
            )}
            PNG
          </button>
          <button
            type="button"
            onClick={() => void handleDownload("webp")}
            disabled={!hasLayers || downloading !== null}
            className={toolbarBtn}
          >
            {downloading === "webp" ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <DownloadSimple size={14} />
            )}
            WebP
          </button>
        </div>

        {/* three panes */}
        <div className="grid gap-4 p-4 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
          {/* left rail: tabs + active panel */}
          <aside className="min-w-0">
            <div className="mb-3 flex gap-1">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  title={label}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                    activeTab === id
                      ? "border-sky-400/60 bg-white/10 text-white"
                      : "border-transparent text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <div className="max-h-[560px] overflow-y-auto pr-1">
              {activeTab === "layers" && (
                <LayerListPanel
                  state={composer}
                  selection={selection}
                  multiSel={multiSel}
                  addTypes={GM_LAYER_TYPES.map((t) => t.type)}
                  hasBackground={false}
                  onChange={handleComposerChange}
                  onSelect={handleSelect}
                  onToggleMulti={handleToggleMulti}
                  onClearMulti={() => setMultiSel([])}
                  onAdd={handleAddLayer}
                />
              )}
              {activeTab === "setup" && (
                <SetupPanel frame={frame} ratio={ratio} onFrame={patchFrame} onRatio={setRatio} />
              )}
              {activeTab === "background" && (
                <BackgroundPanel frame={frame} onFrame={patchFrame} ctx={ctx} />
              )}
            </div>
          </aside>

          {/* center: live preview (the PreviewPane node IS the export layout) */}
          <section className="min-w-0">
            <div className="h-[420px] rounded-xl border border-white/5 bg-neutral-900/60 lg:h-[560px]">
              <PreviewPane
                host={gmCardHost}
                state={composer}
                ctx={ctx}
                selection={selection}
                multiSel={multiSel}
                onSelect={handleSelect}
                onToggleMulti={handleToggleMulti}
                onChange={handleComposerChange}
              />
            </div>
          </section>

          {/* right: selected-layer properties */}
          <aside className="min-w-0">
            <div className="max-h-[560px] overflow-y-auto pr-1">
              <ConfigPanel
                host={gmCardHost}
                state={composer}
                selection={selection}
                ctx={ctx}
                onLayerConfigChange={handleLayerConfig}
                onLayerTransformChange={handleLayerTransform}
                onLayerBoxChange={handleLayerBox}
                onBackgroundChange={() => {}}
              />
            </div>
          </aside>
        </div>
      </div>

      <SaveBar
        snapshot={snapshot}
        defaultTitle={defaultTitle}
        loadedId={loadedId}
        loadedOwned={loadedOwned}
        onSaved={handleSaved}
      />
    </>
  );
}

// ── Card setup panel ──────────────────────────────────────────────────────────

function SetupPanel({
  frame,
  ratio,
  onFrame,
  onRatio,
}: {
  frame: CardFrame;
  ratio: GmAspectRatio;
  onFrame: (p: Partial<CardFrame>) => void;
  onRatio: (r: GmAspectRatio) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label>
        <span className={labelCls}>Format</span>
        <select
          value={ratio}
          onChange={(e) => onRatio(e.target.value as GmAspectRatio)}
          className={inputCls}
        >
          {ASPECT_RATIOS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className={labelCls}>Theme</span>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {THEME_IDS.map((id) => {
            const t = GM_CARD_THEMES[id];
            const active = frame.theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onFrame({ theme: id })}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
                  active
                    ? "border-sky-400/60 bg-white/10 text-white"
                    : "border-white/10 text-neutral-300 hover:bg-white/5"
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                  style={{ background: t.bg }}
                />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <label>
        <span className={labelCls}>Accent</span>
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(frame.accent) ? frame.accent : "#07D862"}
            onChange={(e) => onFrame({ accent: e.target.value })}
            className="h-7 w-9 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <input
            type="text"
            value={frame.accent}
            onChange={(e) => onFrame({ accent: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-white/30"
          />
        </div>
      </label>

      <label>
        <span className={labelCls}>Eyebrow</span>
        <input
          type="text"
          value={frame.eyebrow}
          placeholder="ESG BRIEF"
          onChange={(e) => onFrame({ eyebrow: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input
          type="checkbox"
          checked={frame.showEyebrow}
          onChange={(e) => onFrame({ showEyebrow: e.target.checked })}
          className="accent-sky-400"
        />
        Show eyebrow
      </label>

      <label>
        <span className={labelCls}>Handle</span>
        <input
          type="text"
          value={frame.handle}
          placeholder="greenmentor.io"
          onChange={(e) => onFrame({ handle: e.target.value })}
          className={inputCls}
        />
      </label>

      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input
          type="checkbox"
          checked={frame.showLogo}
          onChange={(e) => onFrame({ showLogo: e.target.checked })}
          className="accent-sky-400"
        />
        Show wordmark
      </label>
      {frame.showLogo && (
        <>
          <label>
            <span className={labelCls}>Wordmark color</span>
            <input
              type="text"
              value={frame.logo.color}
              onChange={(e) => onFrame({ logo: { ...frame.logo, color: e.target.value } })}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Wordmark size</span>
            <select
              value={String(frame.logo.scale)}
              onChange={(e) => onFrame({ logo: { ...frame.logo, scale: Number(e.target.value) } })}
              className={inputCls}
            >
              <option value="0.75">S</option>
              <option value="1">M</option>
              <option value="1.4">L</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-neutral-300">
            <input
              type="checkbox"
              checked={frame.logo.fill}
              onChange={(e) => onFrame({ logo: { ...frame.logo, fill: e.target.checked } })}
              className="accent-sky-400"
            />
            Solid fill
          </label>
        </>
      )}
    </div>
  );
}

// ── Background panel ──────────────────────────────────────────────────────────

function BackgroundPanel({
  frame,
  onFrame,
  ctx,
}: {
  frame: CardFrame;
  onFrame: (p: Partial<CardFrame>) => void;
  ctx: GmComposerCtx;
}) {
  const bg = frame.background;
  const kindBtn = (active: boolean) =>
    `rounded-md border px-2.5 py-1.5 text-[11px] ${
      active
        ? "border-sky-400/60 bg-white/10 text-white"
        : "border-white/10 text-neutral-300 hover:bg-white/5"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className={labelCls}>Backdrop</span>
        <div className="mt-1 flex gap-1.5">
          <button
            type="button"
            className={kindBtn(bg.type === "none")}
            onClick={() => onFrame({ background: { type: "none" } })}
          >
            None
          </button>
          <button
            type="button"
            className={kindBtn(bg.type === "aura")}
            onClick={() =>
              onFrame({ background: { type: "aura", slug: AURA_PRESETS[0].slug } })
            }
          >
            Aura
          </button>
          <button
            type="button"
            className={kindBtn(bg.type === "image")}
            onClick={() => onFrame({ background: { type: "image", src: "" } })}
          >
            Image
          </button>
        </div>
      </div>

      {bg.type === "aura" && (
        <>
          <label>
            <span className={labelCls}>Aura preset</span>
            <select
              value={AURA_PRESETS.some((p) => p.slug === bg.slug) ? bg.slug : ""}
              onChange={(e) =>
                e.target.value && onFrame({ background: { type: "aura", slug: e.target.value } })
              }
              className={inputCls}
            >
              <option value="">(custom)</option>
              {AURA_PRESETS.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Custom slug / URL</span>
            <input
              type="text"
              value={bg.slug}
              placeholder="paste an aura.promad.design slug or URL"
              onChange={(e) => onFrame({ background: { type: "aura", slug: e.target.value } })}
              className={inputCls}
            />
          </label>
          <p className="text-[10.5px] leading-relaxed text-neutral-500">
            The live animation previews here and is captured as-is in the export (the renderer
            waits for it to settle).
          </p>
        </>
      )}

      {bg.type === "image" && (
        <div>
          <span className={labelCls}>Image</span>
          <div className="mt-1">
            <ImagePicker
              value={bg.src}
              onChange={(v) =>
                onFrame({ background: { type: "image", src: typeof v === "string" ? v : "" } })
              }
              siblings={{}}
              ctx={ctx}
            />
          </div>
        </div>
      )}

      {bg.type !== "none" && (
        <label>
          <span className={labelCls}>
            Scrim · {Math.round(frame.backgroundScrim * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={frame.backgroundScrim}
            onChange={(e) => onFrame({ backgroundScrim: Number(e.target.value) })}
            className="mt-1 w-full accent-sky-400"
          />
        </label>
      )}
    </div>
  );
}
