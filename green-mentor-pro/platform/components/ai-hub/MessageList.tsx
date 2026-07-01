"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { clsx } from "clsx";
import { FileText } from "@phosphor-icons/react";
import { Renderer, BuiltinActionType, type ActionEvent } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { ThemeProvider, createTheme } from "@openuidev/react-ui";
import DataRequestCard, { type DataRequestData } from "@/app/(app)/buddy/DataRequestCard";

// GreenMentor green (green-700/800/900) mapped onto OpenUI's accent tokens so the
// generated components match the brand instead of OpenUI's default blue.
const gmTheme = createTheme({
  interactiveAccentDefault: "#15803d",
  interactiveAccentHover: "#166534",
  interactiveAccentPressed: "#14532d",
  textBrand: "#15803d",
});

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
  onSendMessage,
}: {
  messages: UIMessage[];
  status: string;
  thinkingLabel?: string;
  /** Sends a new turn — wires OpenUI "continue conversation" follow-up chips to the chat. */
  onSendMessage?: (text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // OpenUI actions: a "continue conversation" chip sends its text as the next user turn.
  function handleAction(event: ActionEvent) {
    if (event.type === BuiltinActionType.ContinueConversation && event.humanFriendlyMessage) {
      onSendMessage?.(event.humanFriendlyMessage);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m, mi) => {
        const isUser = m.role === "user";
        const isLastMessage = mi === messages.length - 1;
        return (
          <div key={m.id} className={clsx("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
            {(m.parts as Part[]).map((part, i) => {
              if (part.type === "text") {
                if (!part.text) return null;
                // User text stays a plain bubble. Assistant text is OpenUI Lang — render it
                // into real components (headings, tables, cards, callouts, follow-up chips)
                // via <Renderer> instead of dumping raw markdown.
                if (isUser) {
                  return (
                    <div
                      key={i}
                      className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-green-700 px-3.5 py-2.5 text-[14px] leading-relaxed text-white"
                    >
                      {part.text}
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className="max-w-[85%] rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-ink"
                  >
                    <ThemeProvider mode="light" lightTheme={gmTheme}>
                      <Renderer
                        response={part.text}
                        library={openuiChatLibrary}
                        isStreaming={status === "streaming" && isLastMessage}
                        onAction={handleAction}
                      />
                    </ThemeProvider>
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
