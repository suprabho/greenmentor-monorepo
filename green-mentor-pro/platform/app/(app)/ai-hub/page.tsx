import { redirect } from "next/navigation";

// The AI Hub landing is the Chat surface. Chat / Artifacts are the visible
// workspace tabs (see ai-hub/layout.tsx); Cowork is hidden for launch but its
// routes still resolve. The old JSON agent harness lives at /ai-hub/dev.
export default function AiHubIndex() {
  redirect("/ai-hub/chat");
}
