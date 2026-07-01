import { redirect } from "next/navigation";

// The AI Hub landing is the Cowork surface. Chat / Cowork / Artifacts are the
// three workspace tabs (see ai-hub/layout.tsx). The old JSON agent harness now
// lives at /ai-hub/dev.
export default function AiHubIndex() {
  redirect("/ai-hub/cowork");
}
