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
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarPlus, X } from "@phosphor-icons/react";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import { phoneLengthHint, toE164 } from "@/lib/utils/validation";
import {
  validateRsvpContact,
  type RsvpContactDefaults,
  type RsvpContactField,
} from "@/lib/webinars/contact";

type FieldErrors = Partial<Record<RsvpContactField, string>>;

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13.5px] text-ink placeholder:text-gray-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15";
const labelCls = "flex flex-col gap-1.5 text-[12px] font-semibold text-ink";
const errorCls = "text-[11.5px] font-normal text-danger";

export function RsvpButton({
  webinarId,
  webinarTitle,
  initialAttending,
  signedIn,
  contactDefaults,
}: {
  webinarId: string;
  webinarTitle: string;
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
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Someone who followed a shared /webinars/:slug link should land back on that
  // webinar after signing in, not on /home.
  const pathname = usePathname();

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
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname || "/webinars")}`}
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
      const res = await fetch("/api/webinars/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webinar_id: webinarId,
          attending: true,
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          // E.164, so the admin hub and /profile agree on one format.
          phone: toE164(form.phone, form.phoneCountry),
          phone_country: form.phoneCountry,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Could not save your RSVP (HTTP ${res.status})`);
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
