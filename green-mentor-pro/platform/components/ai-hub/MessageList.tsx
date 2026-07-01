"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { clsx } from "clsx";
import { FileText } from "@phosphor-icons/react";
import DataRequestCard, { type DataRequestData } from "@/app/(app)/buddy/DataRequestCard";

type Part = {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
};

// Compact render for the non-card engagement copilot tools (captureRequirements,
// approvePhase, requestChanges, showArtifact, runPhase). No-op for anything else.
function ToolLine({ name, output }: { name: string; output: Record<string, unknown> }) {
  let text: string | null = null;
  if (name === "tool-captureRequirements") text = "✓ Requirements saved";
  else if (name === "tool-approvePhase") text = output.ok ? `✓ Approved ${output.approved}` : `⚠ ${output.error}`;
  else if (name === "tool-requestChanges") text = output.ok ? `↩ Sent back ${output.sent_back}` : `⚠ ${output.error}`;
  else if (name === "tool-showArtifact")
    text = output.found ? `${output.phase}: ${String(output.summary).slice(0, 240)}` : `No artifact yet for ${output.phase}`;
  else if (name === "tool-runPhase")
    text = output.runnable
      ? `▶ Ready to run ${output.label} — use the Run button in the progress panel.`
      : `${output.label} isn't runnable yet (${output.reason}).`;
  if (!text) return null;
  return (
    <div className="rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12.5px] text-gray-600">{text}</div>
  );
}

function Attachment({ url, mediaType, filename }: { url?: string; mediaType?: string; filename?: string }) {
  if (!url) return null;
  if (mediaType?.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={filename ?? "attachment"} className="max-h-56 rounded-xl border border-gray-200 object-cover" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[12.5px] font-medium text-gray-700 hover:border-gray-300"
    >
      <FileText size={16} className="text-teal-700" />
      {filename ?? "Attachment"}
    </a>
  );
}

/**
 * Shared transcript renderer for both the standalone Chat and the Cowork copilot.
 * Renders message parts: text bubbles, file attachments, the draftDataRequest
 * generative card, and compact tool notes. Owns auto-scroll to the latest turn.
 */
export function MessageList({
  messages,
  status,
  thinkingLabel = "Thinking…",
}: {
  messages: UIMessage[];
  status: string;
  thinkingLabel?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => {
        const isUser = m.role === "user";
        return (
          <div key={m.id} className={clsx("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
            {(m.parts as Part[]).map((part, i) => {
              if (part.type === "text") {
                if (!part.text) return null;
                return (
                  <div
                    key={i}
                    className={clsx(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
                      isUser
                        ? "rounded-br-sm bg-green-700 text-white"
                        : "rounded-bl-sm border border-gray-200 bg-white text-ink"
                    )}
                  >
                    {part.text}
                  </div>
                );
              }
              if (part.type === "file") {
                return (
                  <div key={i} className="max-w-[85%]">
                    <Attachment url={part.url} mediaType={part.mediaType} filename={part.filename} />
                  </div>
                );
              }
              if (part.type === "tool-draftDataRequest") {
                switch (part.state) {
                  case "input-streaming":
                  case "input-available":
                    return <DataRequestCard key={i} data={(part.input as DataRequestData) ?? {}} loading />;
                  case "output-available":
                    return <DataRequestCard key={i} data={part.output as DataRequestData} />;
                  case "output-error":
                    return (
                      <div key={i} className="text-[13px] text-danger">
                        Couldn&apos;t draft the request: {part.errorText}
                      </div>
                    );
                  default:
                    return null;
                }
              }
              if (part.type?.startsWith("tool-") && part.state === "output-available") {
                return <ToolLine key={i} name={part.type} output={(part.output ?? {}) as Record<string, unknown>} />;
              }
              return null;
            })}
          </div>
        );
      })}
      {status === "submitted" && <div className="text-[12.5px] text-gray-400">{thinkingLabel}</div>}
      <div ref={bottomRef} />
    </div>
  );
}
