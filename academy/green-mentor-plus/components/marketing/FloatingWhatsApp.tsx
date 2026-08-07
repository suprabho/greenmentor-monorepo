"use client";

import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { track } from "@/lib/utils/analytics";
import { WHATSAPP_COMMUNITY_URL } from "@/lib/data/community";

/**
 * Persistent floating WhatsApp button, fixed to the bottom-right and visible
 * across the whole marketing page. Mounted once in the marketing layout. Sits
 * below the bottom edge, clear of the sticky top nav, so it never overlaps the
 * header or the mobile menu.
 *
 * Opens the community group, not a 1:1 chat: the 40,000-member room is the
 * thing worth joining, and the sales number is still on the contact block for
 * anyone who wants to talk to a person.
 */
export function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join the GreenMentor WhatsApp community"
      title="Join the GreenMentor WhatsApp community"
      onClick={() => track("whatsapp_community_clicked")}
      className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/15 ring-1 ring-black/5 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <WhatsappLogo size={30} weight="fill" aria-hidden />
    </a>
  );
}
