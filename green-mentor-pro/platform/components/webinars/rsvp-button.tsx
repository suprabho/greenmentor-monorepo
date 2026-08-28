"use client";

/**
 * RSVP control for a webinar card. Signed-out users get a link to /login — the
 * "webinar_rsvps own" RLS policy needs a session.
 *
 * RSVPing opens a short form for name, email and phone: the team runs these
 * sessions as a lead funnel and needs to be able to reach the people who signed
 * up. Everything is prefilled from the account and the profile — onboarding
 * already collects a phone — so for most learners this is one glance and a
 * confirm. Details are snapshotted per RSVP, so the number given for *this*
 * webinar is what the team calls about it. Withdrawing stays a single click.
 *
 * The phone field is the shared PhoneInput, so numbers land as E.164 with the
 * country recorded, matching what onboarding and /profile store.
 *
 * Signing in shouldn't cost anyone their place: the signed-out link carries
 * `?rsvp=1` on the webinar's own URL, and the effect below picks that up on the
 * way back and finishes the RSVP they already asked for. The decision of what
 * to do with the param lives in lib/webinars/rsvp-resume.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, X } from "@phosphor-icons/react";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import { phoneLengthHint, toE164 } from "@/lib/utils/validation";
import {
  validateRsvpContact,
  type RsvpContactDefaults,
  type RsvpContactField,
} from "@/lib/webinars/contact";
import { RESUME_PARAM, decideRsvpResume, rsvpLoginHref } from "@/lib/webinars/rsvp-resume";

type FieldErrors = Partial<Record<RsvpContactField, string>>;

/** How long the post-resume confirmation stays up, in ms. */
const CONFIRM_MS = 4000;

/** POST an attending RSVP. Throws with the server's message on failure. */
async function postRsvp(webinarId: string, contact: RsvpContactDefaults): Promise<void> {
  const res = await fetch("/api/webinars/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webinar_id: webinarId,
      attending: true,
      full_name: contact.fullName.trim(),
      email: contact.email.trim(),
      // E.164, so the admin hub and /profile agree on one format.
      phone: toE164(contact.phone, contact.phoneCountry),
      phone_country: contact.phoneCountry,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Could not save your RSVP (HTTP ${res.status})`);
}

// Inputs are 16px below the sm breakpoint: mobile browsers auto-zoom the page
// when a focused input's font is any smaller, leaving the dialog cropped and
// horizontally scrollable.
const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[16px] text-ink placeholder:text-gray-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15 sm:text-[13.5px]";
const labelCls = "flex flex-col gap-1.5 text-[12px] font-semibold text-ink";
const errorCls = "text-[11.5px] font-normal text-danger";

export function RsvpButton({
  webinarId,
  webinarTitle,
  shareSlug,
  initialAttending,
  signedIn,
  contactDefaults,
}: {
  webinarId: string;
  webinarTitle: string;
  /** The webinar's canonical URL segment — what a signed-out visitor comes back to. */
  shareSlug: string;
  initialAttending: boolean;
  signedIn: boolean;
  contactDefaults: RsvpContactDefaults;
}) {
  const [attending, setAttending] = useState(initialAttending);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RsvpContactDefaults>(contactDefaults);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // One-shot latch: StrictMode double-invokes effects in dev, and the effect
  // re-runs when `attending` flips underneath it.
  const resumed = useRef(false);

  /**
   * Finish an RSVP that sign-in interrupted.
   *
   * Read from window.location rather than useSearchParams so this needs no
   * Suspense boundary — same reasoning as OnboardingHydrator.
   */
  useEffect(() => {
    if (resumed.current) return;
    const url = new URL(window.location.href);
    const action = decideRsvpResume({
      pathname: url.pathname,
      search: url.search,
      shareSlug,
      signedIn,
      attending,
      contactDefaults,
    });
    if (action === "ignore") return;
    resumed.current = true;

    // Consume the param before anything else, so a reload — or a Back after
    // dismissing the form below — doesn't fire this a second time.
    url.searchParams.delete(RESUME_PARAM);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

    if (action === "collect") {
      setForm(contactDefaults);
      setErrors({});
      setSubmitError(null);
      setOpen(true);
      return;
    }

    setBusy(true);
    postRsvp(webinarId, contactDefaults)
      .then(() => {
        setAttending(true);
        setJustSaved(true);
      })
      .catch((e: unknown) => {
        // Hand the failure to the form rather than leaving a dead button.
        setForm(contactDefaults);
        setSubmitError(e instanceof Error ? e.message : "Could not save your RSVP");
        setOpen(true);
      })
      .finally(() => setBusy(false));
  }, [signedIn, attending, contactDefaults, webinarId, shareSlug]);

  // The confirmation is a nicety, not state — retire it like share-button's
  // "Copied" rather than leaving it pinned to the card.
  useEffect(() => {
    if (!justSaved) return;
    const id = setTimeout(() => setJustSaved(false), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [justSaved]);

  // Close the form on Escape, like any other dismissible overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  if (!signedIn) {
    // Points at *this* webinar, not usePathname() — on the /webinars grid that
    // was the whole list, so whoever clicked a card came back to a page of
    // cards with their intent lost.
    return (
      <Link
        href={rsvpLoginHref(shareSlug)}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        <CalendarPlus size={14} /> Sign in to RSVP
      </Link>
    );
  }

  /** Withdraw an RSVP — no details needed, so no form. */
  const cancel = async () => {
    setAttending(false); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/webinars/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webinar_id: webinarId, attending: false }),
      });
      if (!res.ok) setAttending(true);
    } catch {
      setAttending(true);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const found = validateRsvpContact(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSubmitError(null);
    try {
      await postRsvp(webinarId, form);
      setAttending(true);
      setOpen(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not save your RSVP");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (attending) {
            void cancel();
          } else {
            setForm(contactDefaults);
            setErrors({});
            setSubmitError(null);
            setOpen(true);
          }
        }}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
          attending
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-teal-900 text-white hover:bg-teal-800"
        }`}
      >
        {attending ? (
          <>
            <CalendarCheck size={14} weight="bold" /> Going
          </>
        ) : (
          <>
            <CalendarPlus size={14} /> RSVP
          </>
        )}
      </button>

      {justSaved && (
        // Arriving mid-redirect, "Going" alone is easy to miss — say plainly
        // that the RSVP went through. aria-live so it isn't a visual-only cue.
        <span role="status" aria-live="polite" className="text-[12px] font-semibold text-green-800">
          Seat saved
        </span>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`RSVP to ${webinarTitle}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Save your seat</h2>
                <p className="mt-0.5 text-[12.5px] text-gray-500">{webinarTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-1 -mt-1 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-ink"
                aria-label="Close"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
              <label className={labelCls}>
                Full name
                <input
                  ref={firstFieldRef}
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Your name"
                  className={inputCls}
                />
                {errors.fullName && <span className={errorCls}>{errors.fullName}</span>}
              </label>
              <label className={labelCls}>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  className={inputCls}
                />
                {errors.email && <span className={errorCls}>{errors.email}</span>}
              </label>
              <PhoneInput
                label="Mobile"
                tone="light"
                value={form.phone}
                onChange={(phone) => setForm((f) => ({ ...f, phone }))}
                countryIso={form.phoneCountry || DEFAULT_COUNTRY_ISO}
                onCountryChange={(phoneCountry) => setForm((f) => ({ ...f, phoneCountry }))}
                error={errors.phone ? phoneLengthHint(form.phoneCountry || DEFAULT_COUNTRY_ISO) : undefined}
              />
            </div>

            {submitError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{submitError}</p>
            )}

            <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
              We&apos;ll use these to send you the joining link and session reminders.
            </p>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
              >
                <CalendarCheck size={14} weight="bold" /> {busy ? "Saving…" : "Confirm RSVP"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[12.5px] font-semibold text-gray-500 transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
