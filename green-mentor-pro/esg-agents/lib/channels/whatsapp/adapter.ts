import type { ChannelAdapter } from "../types";

/**
 * FUTURE STUB. A future implementer fills `ingest` (WhatsApp Business / Twilio
 * inbound webhook -> IncomingPayload -> same data_submissions insert) and flips
 * `enabled`. Nothing in the orchestrator, the Phase-4 agent, or the DB layer
 * changes — the comms-outreach stub agent already owns the outbound side.
 */
export const whatsappAdapter: ChannelAdapter = {
  key: "whatsapp",
  enabled: false,
  async ingest() {
    throw new Error("whatsapp channel is a v1 stub — not implemented");
  },
  // no formSchemaFor: messaging channels collect conversationally, not via forms
};
