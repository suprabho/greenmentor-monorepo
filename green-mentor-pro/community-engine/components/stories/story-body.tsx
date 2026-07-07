"use client";

import { Component, Suspense, lazy, useMemo, type CSSProperties, type ReactNode } from "react";
import { getVizModule, formatInlineMarkdown } from "@vismay/viz-engine";
import { parseStoryBody } from "@/lib/stories/parseBody";
import { registerStoryModules } from "@/components/stories/modules";

registerStoryModules();

/** Renders a story's body_markdown: headings/paragraphs as plain JSX, and
 *  `story:<type>` fenced directives via the same getVizModule -> parseConfig ->
 *  lazy(load) dispatch loop the gmcard:* share-card modules already use. */
export function StoryBody({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseStoryBody(markdown), [markdown]);

  if (blocks.length === 0) {
    return <p className="text-[13px] text-gray-500">Nothing drafted yet.</p>;
  }

  // formatInlineMarkdown's bold styling reads --color-accent/--font-mono,
  // both scoped elsewhere in this app (the share-cards composer island) —
  // override them here to GM's brand teal instead of the undefined fallback.
  const brandVars = {
    "--color-accent": "var(--color-teal-900)",
    "--font-mono": "var(--font-sans)",
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-4" style={brandVars}>
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          return b.level === 2 ? (
            <h2 key={i} className="text-[19px] font-semibold text-ink">
              {formatInlineMarkdown(b.text)}
            </h2>
          ) : (
            <h3 key={i} className="text-[16px] font-semibold text-ink">
              {formatInlineMarkdown(b.text)}
            </h3>
          );
        }
        if (b.kind === "paragraph") {
          return (
            <p key={i} className="text-[14px] leading-relaxed text-gray-700">
              {formatInlineMarkdown(b.text)}
            </p>
          );
        }
        return <DirectiveBlock key={i} type={b.type} config={b.config} />;
      })}
    </div>
  );
}

function DirectiveBlock({ type, config }: { type: string; config: Record<string, unknown> }) {
  const vizModule = getVizModule(type);
  if (!vizModule) return null;

  let parsed: unknown;
  try {
    parsed = vizModule.parseConfig(config, { slug: "story", label: type });
  } catch {
    return null; // bad LLM output degrades silently rather than crashing the page
  }

  const Lazy = lazy(vizModule.load);
  return (
    <StoryVizErrorBoundary>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-gray-100" />}>
        <Lazy
          slug="story"
          unitKey={type}
          config={parsed}
          activeStep={0}
          mode="print"
          noteReady={() => {}}
          isActive
        />
      </Suspense>
    </StoryVizErrorBoundary>
  );
}

class StoryVizErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
