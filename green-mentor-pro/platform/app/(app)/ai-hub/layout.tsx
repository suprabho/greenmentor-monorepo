import { WorkspaceFrame } from "@/components/ai-hub/WorkspaceFrame";
import { WorkspaceTopToggle } from "@/components/ai-hub/WorkspaceTopToggle";

/**
 * Claude-style AI Hub workspace shell. Nested under the app Shell, it takes over
 * the viewport (WorkspaceFrame) and keeps the Chat · Cowork · Artifacts toggle
 * mounted across all three surfaces.
 */
export default function AiHubLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceFrame toolbar={<WorkspaceTopToggle />}>{children}</WorkspaceFrame>;
}
