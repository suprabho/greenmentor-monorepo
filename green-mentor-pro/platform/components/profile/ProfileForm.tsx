"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip } from "@/components/ui";
import { Input } from "@/components/onboarding/Input";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { ChoiceCard } from "@/components/onboarding/ChoiceCard";
import { MultiSelectChips } from "@/components/onboarding/MultiSelectChips";
import { EditableSection } from "@/components/profile/EditableSection";
import { audiences, goals as goalOptions, plan, annualSavingsPercent } from "@/lib/onboarding-data";
import { saveProfile } from "@/lib/onboarding/save";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import { isValidName, isValidPhone, phoneLengthHint, toE164, fromE164 } from "@/lib/utils/validation";
import type { AudienceSegment, BillingCycle } from "@/lib/store/onboarding";
import { cn } from "@/lib/utils/cn";

export interface ProfileFormValues {
  displayName: string;
  phone: string | null;
  phoneCountry: string | null;
  segment: AudienceSegment | null;
  goals: string[];
  planId: string | null;
  billingCycle: BillingCycle;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const Empty = () => <span className="text-gray-400">Not set</span>;

/**
 * Inline editors for the answers captured during onboarding. Deliberately
 * reuses the same field components and validators as the wizard so the two
 * can't drift — the only difference is `tone="light"` for the white Card.
 */
export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);

  // Identity
  const startIso = saved.phoneCountry ?? DEFAULT_COUNTRY_ISO;
  const [name, setName] = useState(saved.displayName);
  const [phone, setPhone] = useState(fromE164(saved.phone, startIso));
  const [iso, setIso] = useState(startIso);
  const [touched, setTouched] = useState(false);

  // Audience / goals / plan
  const [segment, setSegment] = useState(saved.segment);
  const [chosenGoals, setChosenGoals] = useState(saved.goals);
  const [cycle, setCycle] = useState<BillingCycle>(saved.billingCycle);

  const nameValid = isValidName(name);
  const phoneValid = isValidPhone(phone, iso);

  /** Persist, update the local baseline, and refresh the server components
   *  above us (the sidebar reads display_name/avatar from the same row). */
  async function commit(patch: Parameters<typeof saveProfile>[0], next: Partial<ProfileFormValues>) {
    await saveProfile(patch);
    setSaved((s) => ({ ...s, ...next }));
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      <EditableSection
        title="Your details"
        saveDisabled={!nameValid || !phoneValid}
        onCancel={() => {
          setName(saved.displayName);
          setPhone(fromE164(saved.phone, saved.phoneCountry ?? DEFAULT_COUNTRY_ISO));
          setIso(saved.phoneCountry ?? DEFAULT_COUNTRY_ISO);
          setTouched(false);
        }}
        onSave={async () => {
          setTouched(true);
          if (!nameValid || !phoneValid) return false;
          return commit(
            { displayName: name.trim(), phone: toE164(phone, iso), phoneCountry: iso },
            { displayName: name.trim(), phone: toE164(phone, iso), phoneCountry: iso },
          );
        }}
        summary={
          <dl className="grid gap-3 text-[13.5px] sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="mt-0.5 text-ink">{saved.displayName || <Empty />}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Mobile</dt>
              <dd className="mt-0.5 text-ink">
                {saved.phone ? (
                  <span className="tabular-nums">{saved.phone}</span>
                ) : (
                  <Empty />
                )}
              </dd>
            </div>
          </dl>
        }
      >
        <div className="space-y-4">
          <Input
            tone="light"
            label="Full name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={touched && !nameValid ? "Please enter at least 2 characters." : undefined}
          />
          <PhoneInput
            tone="light"
            label="Mobile number"
            value={phone}
            onChange={setPhone}
            countryIso={iso}
            onCountryChange={setIso}
            error={touched && !phoneValid ? phoneLengthHint(iso) : undefined}
          />
        </div>
      </EditableSection>

      <EditableSection
        title="Where you are"
        saveDisabled={!segment}
        onCancel={() => setSegment(saved.segment)}
        onSave={async () => {
          if (!segment) return false;
          return commit({ segment }, { segment });
        }}
        summary={
          <div className="text-[13.5px] text-ink">
            {audiences.find((a) => a.id === saved.segment)?.label ?? <Empty />}
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          {audiences.map((a) => (
            <ChoiceCard
              key={a.id}
              tone="light"
              selected={segment === a.id}
              onSelect={() => setSegment(a.id)}
              title={a.label}
              tagline={a.tagline}
              description={a.description}
              icon={a.icon}
            />
          ))}
        </div>
      </EditableSection>

      <EditableSection
        title="Your goals"
        saveDisabled={chosenGoals.length === 0}
        onCancel={() => setChosenGoals(saved.goals)}
        onSave={async () => {
          if (chosenGoals.length === 0) return false;
          return commit({ goals: chosenGoals }, { goals: chosenGoals });
        }}
        summary={
          saved.goals.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {saved.goals.map((id) => (
                <Chip key={id} tone="green">
                  {goalOptions.find((g) => g.id === id)?.label ?? id}
                </Chip>
              ))}
            </div>
          )
        }
      >
        <div>
          <MultiSelectChips
            options={goalOptions}
            selected={chosenGoals}
            onToggle={(id) =>
              setChosenGoals((s) =>
                s.includes(id) ? s.filter((g) => g !== id) : [...s, id],
              )
            }
          />
          <p className="mt-3 text-[12.5px] text-gray-500">
            {chosenGoals.length === 0
              ? "Pick at least one goal."
              : `${chosenGoals.length} selected.`}
          </p>
        </div>
      </EditableSection>

      <EditableSection
        title="Membership"
        onCancel={() => setCycle(saved.billingCycle)}
        onSave={async () =>
          commit(
            { planId: saved.planId ?? plan.id, billingCycle: cycle },
            { planId: saved.planId ?? plan.id, billingCycle: cycle },
          )
        }
        summary={
          <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
            <span className="text-ink">{plan.name}</span>
            <span className="text-gray-600">
              {saved.billingCycle === "annual"
                ? `${inr(plan.priceAnnualTotal)} / year`
                : `${inr(plan.priceMonthly)} / month`}
            </span>
          </div>
        }
      >
        <div
          className="inline-flex rounded-pill border border-gray-200 bg-gray-50 p-1 text-[12.5px] font-semibold"
          role="group"
          aria-label="Billing cycle"
        >
          {(["annual", "monthly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cn(
                "rounded-pill px-3.5 py-1.5 capitalize transition-colors",
                cycle === c ? "bg-teal-900 text-white" : "text-gray-600 hover:text-ink",
              )}
            >
              {c}
              {c === "annual" && (
                <span className={cn("ml-1", cycle === c ? "text-green-500" : "text-green-700")}>
                  · save {annualSavingsPercent}%
                </span>
              )}
            </button>
          ))}
        </div>
      </EditableSection>
    </div>
  );
}
