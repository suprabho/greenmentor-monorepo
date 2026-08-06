"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip } from "@/components/ui";
import { Input } from "@/components/onboarding/Input";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { ChoiceCard } from "@/components/onboarding/ChoiceCard";
import { MultiSelectChips } from "@/components/onboarding/MultiSelectChips";
import { EditableSection } from "@/components/profile/EditableSection";
import { audiences, goals as goalOptions } from "@/lib/onboarding-data";
import { MAX_GOALS } from "@/lib/onboarding/goals";
import { saveProfile } from "@/lib/onboarding/save";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import { isValidName, isValidPhone, phoneLengthHint, toE164, fromE164 } from "@/lib/utils/validation";
import type { AudienceSegment } from "@/lib/store/onboarding";

// The membership/billing section is omitted while the subscription step is
// deferred — onboarding no longer sets plan_id, so an editor here would offer
// a plan the user was never asked about. The columns still exist.
export interface ProfileFormValues {
  displayName: string;
  phone: string | null;
  phoneCountry: string | null;
  segment: AudienceSegment | null;
  goals: string[];
}

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

  // Audience / goals
  const [segment, setSegment] = useState(saved.segment);
  const [chosenGoals, setChosenGoals] = useState(saved.goals);

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
        saveDisabled={chosenGoals.length === 0 || chosenGoals.length > MAX_GOALS}
        onCancel={() => setChosenGoals(saved.goals)}
        onSave={async () => {
          // The upper bound bites only for profiles saved before the cap
          // existed — the picker can't get you there from a valid selection.
          if (chosenGoals.length === 0 || chosenGoals.length > MAX_GOALS) return false;
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
              setChosenGoals((s) => {
                if (s.includes(id)) return s.filter((g) => g !== id);
                return s.length >= MAX_GOALS ? s : [...s, id];
              })
            }
            max={MAX_GOALS}
          />
          <p className="mt-3 text-[12.5px] text-gray-500">
            {chosenGoals.length === 0
              ? "Pick at least one goal."
              : chosenGoals.length > MAX_GOALS
                ? `Up to ${MAX_GOALS} goals for the next three months — deselect ${chosenGoals.length - MAX_GOALS} to save.`
                : `${chosenGoals.length} of ${MAX_GOALS} chosen — what you could realistically move in the next three months.`}
          </p>
        </div>
      </EditableSection>
    </div>
  );
}
