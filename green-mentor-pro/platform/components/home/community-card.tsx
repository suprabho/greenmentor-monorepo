import { ArrowSquareOut, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";
import { WHATSAPP_COMMUNITY_URL } from "@/lib/data/community";

/**
 * Join-the-community prompt for the Home rail. The sidebar carries the same
 * link on desktop, but the rail is the first thing on mobile — where the
 * sidebar doesn't exist at all — so this is the one that reaches most people.
 *
 * Server component: it's a plain outbound link with no analytics call, so
 * there's nothing here worth shipping client JS for.
 */
export function CommunityCard() {
  return (
    <Card className="mt-6 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
          <WhatsappLogo size={22} weight="fill" />
        </span>
        <h2 className="text-[14.5px] font-semibold text-ink">Join the community</h2>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
        40,000+ ESG practitioners on WhatsApp — framework questions answered, peer review on
        disclosures, and job leads before they're posted.
      </p>
      <a
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-[#25D366] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1fb958]"
      >
        Join on WhatsApp <ArrowSquareOut size={13} weight="bold" />
      </a>
    </Card>
  );
}
