import type { ChannelAdapter, ChannelKey } from "./types";
import { portalAdapter } from "./portal/adapter";
import { uploadAdapter } from "./upload/adapter";
import { whatsappAdapter } from "./whatsapp/adapter"; // stub
import { emailAdapter } from "./email/adapter"; // stub

/**
 * v1 enables portal + upload only. WhatsApp/email are present so routing/UI can
 * enumerate them, but `enabled:false` and their ingest() throws.
 */
export const CHANNELS: Record<ChannelKey, ChannelAdapter> = {
  portal: portalAdapter,
  upload: uploadAdapter,
  whatsapp: whatsappAdapter,
  email: emailAdapter,
};

export function getChannel(key: ChannelKey): ChannelAdapter {
  const c = CHANNELS[key];
  if (!c.enabled) throw new Error(`Channel "${key}" is not enabled in v1`);
  return c;
}

export function enabledChannels(): ChannelKey[] {
  return (Object.keys(CHANNELS) as ChannelKey[]).filter((k) => CHANNELS[k].enabled);
}
