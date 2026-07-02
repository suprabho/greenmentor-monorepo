import { NextResponse } from "next/server";
import { runPhase, type PhaseKey } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";
import { ensureOrchestratorInit } from "@/lib/orchestrator-server";

export const runtime = "nodejs";
// Agent phases run a multi-turn Anthropic loop (each turn a full round-trip), so
// give them ample headroom. Streaming keeps the connection warm within this cap;
// it does NOT extend it, so 300 is the real wall-clock ceiling for one phase.
export const maxDuration = 300;

// POST /api/ai-hub/engagements/[id]/run-phase — run the next/given phase's agent.
//
// Streams newline-delimited JSON (NDJSON) frames so the browser gets a committed
// 200 on the first byte (never a raw 504), a live progress signal per agent turn,
// and a terminal `done` | `error` frame:
//   {"type":"status","phaseKey":"kickoff","state":"agent_running"}
//   {"type":"progress","note":"thinking…","turn":1}
//   {"type":"ping"}                              ← heartbeat between slow turns
//   {"type":"done","result":{...}} | {"type":"error","error":"…"}
export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { engagementId } = await params;
  const { phaseKey } = (await req.json()) as { phaseKey?: PhaseKey };
  if (!phaseKey) return NextResponse.json({ error: "phaseKey is required" }, { status: 400 });

  ensureOrchestratorInit(); // point the engine at @gm/orchestrator's agents/

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* client went away — swallow; the finally block cleans up */
        }
      };

      // First frame commits a 200 status immediately; the heartbeat keeps proxies
      // from idle-timing-out during the gaps between (slow) agent turns.
      send({ type: "status", phaseKey, state: "agent_running" });
      heartbeat = setInterval(() => send({ type: "ping" }), 10_000);

      try {
        const result = await runPhase(ctx.orgId, engagementId, phaseKey, ctx.userId, (ev) =>
          send({ type: "progress", note: ev.note, turn: ev.turn }),
        );
        send({ type: "done", result });
      } catch (e) {
        send({ type: "error", error: String(e instanceof Error ? e.message : e) });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        closed = true;
        controller.close();
      }
    },
    cancel() {
      // Client disconnected — stop the heartbeat. The phase keeps running server-side
      // and lands its status in the DB (the board polls it via reload()).
      if (heartbeat) clearInterval(heartbeat);
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
