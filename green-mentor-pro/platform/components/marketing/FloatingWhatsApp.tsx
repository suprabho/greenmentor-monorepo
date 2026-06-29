"use client";

import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { track } from "@/lib/utils/analytics";

/** Quick-contact number, shared with About/Team. wa.me wants the bare E.164
 *  digits (no `+`, spaces, or dashes). Displayed elsewhere as +91 8744943433. */
const WHATSAPP_NUMBER = "918744943433";
const PREFILL = "Hi, I have a question about GreenMentor Plus";

const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILL)}`;

/**
 * Persistent floating WhatsApp button, fixed to the bottom-right and visible
 * across the whole marketing page. Mounted once in the marketing layout. Sits
 * below the bottom edge, clear of the sticky top nav, so it never overlaps the
 * header or the mobile menu.
 */
export function FloatingWhatsApp() {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      onClick={() => track("whatsapp_clicked")}
      className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/15 ring-1 ring-black/5 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <WhatsappLogo size={30} weight="fill" aria-hidden />
    </a>
  );
}
