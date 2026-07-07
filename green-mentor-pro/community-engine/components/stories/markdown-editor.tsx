"use client";

/**
 * Monaco-backed markdown editor for the story Body tab. A trimmed-down
 * cousin of vismay admin's CodeEditor — no AI selection overlay, no
 * find/replace toolbar, no schema wiring — just markdown editing on GM's
 * light theme.
 */

import dynamic from "next/dynamic";
import type { Monaco } from "@monaco-editor/react";

const Editor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-white text-[13px] text-gray-400">
      Loading editor…
    </div>
  ),
});

let themeConfigured = false;

function configureTheme(monaco: Monaco) {
  if (themeConfigured) return;
  themeConfigured = true;
  monaco.editor.defineTheme("gm-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editorLineNumber.foreground": "#d1d5db",
      "editorLineNumber.activeForeground": "#6b7280",
      "editor.lineHighlightBackground": "#f9fafb",
      "editorIndentGuide.background1": "#f3f4f6",
      "editor.selectionBackground": "#d1fae5",
      "editorCursor.foreground": "#0f172a",
    },
  });
}

export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <Editor
        height="420px"
        value={value}
        onChange={(next) => onChange(next ?? "")}
        language="markdown"
        theme="gm-light"
        beforeMount={configureTheme}
        options={{
          tabSize: 2,
          insertSpaces: true,
          wordWrap: "on",
          minimap: { enabled: false },
          lineNumbers: "on",
          renderLineHighlight: "line",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 13,
          lineHeight: 1.6,
          padding: { top: 12, bottom: 12 },
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        }}
      />
    </div>
  );
}
