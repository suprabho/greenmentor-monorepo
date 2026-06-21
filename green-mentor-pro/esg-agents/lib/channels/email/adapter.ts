import type { ChannelAdapter } from "../types";

/**
 * FUTURE STUB. Future: inbound email (SendGrid inbound parse) -> IncomingPayload
 * -> same data_submissions insert. Flip `enabled` once implemented.
 */
export const emailAdapter: ChannelAdapter = {
  key: "email",
  enabled: false,
  async ingest() {
    throw new Error("email channel is a v1 stub — not implemented");
  },
};
