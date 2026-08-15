import { describe, it, expect } from "vitest";
import { decideRsvpResume, rsvpLoginHref, rsvpResumeHref } from "./rsvp-resume";
import type { RsvpContactDefaults } from "./contact";

const SLUG = "scope-3-3f8a1c2e9d";
const PAGE = `/webinars/${SLUG}`;

/** What fetchRsvpContactDefaults returns for someone who finished onboarding. */
const COMPLETE: RsvpContactDefaults = {
  fullName: "Priya Sharma",
  email: "priya@acme.com",
  phone: "9876543210",
  phoneCountry: "IN",
};

const base = {
  pathname: PAGE,
  search: "?rsvp=1",
  shareSlug: SLUG,
  signedIn: true,
  attending: false,
  contactDefaults: COMPLETE,
};

describe("rsvpResumeHref / rsvpLoginHref", () => {
  it("points at the webinar's own page, carrying the intent", () => {
    expect(rsvpResumeHref(SLUG)).toBe(`${PAGE}?rsvp=1`);
  });

  it("encodes the destination into ?next=", () => {
    expect(rsvpLoginHref(SLUG)).toBe(`/login?next=${encodeURIComponent(`${PAGE}?rsvp=1`)}`);
  });
});

describe("decideRsvpResume", () => {
  it("saves the seat when the profile has everything the API needs", () => {
    expect(decideRsvpResume(base)).toBe("submit");
  });

  it("asks for the missing bit instead of failing silently", () => {
    // A profile predating the phone column (migration 0025).
    expect(decideRsvpResume({ ...base, contactDefaults: { ...COMPLETE, phone: "" } })).toBe("collect");
    expect(decideRsvpResume({ ...base, contactDefaults: { ...COMPLETE, fullName: "" } })).toBe("collect");
    expect(decideRsvpResume({ ...base, contactDefaults: { ...COMPLETE, email: "not-an-email" } })).toBe(
      "collect",
    );
  });

  it("does nothing without the param — the ordinary render", () => {
    expect(decideRsvpResume({ ...base, search: "" })).toBe("ignore");
    expect(decideRsvpResume({ ...base, search: "?rsvp=0" })).toBe("ignore");
    expect(decideRsvpResume({ ...base, search: "?tab=notes" })).toBe("ignore");
  });

  it("does nothing when signed out or already going", () => {
    expect(decideRsvpResume({ ...base, signedIn: false })).toBe("ignore");
    expect(decideRsvpResume({ ...base, attending: true })).toBe("ignore");
  });

  // The guard that keeps a grid of cards from mass-RSVPing: /home and /webinars
  // both render every upcoming webinar, and the param names none of them.
  it("only acts on the webinar whose own page this is", () => {
    expect(decideRsvpResume({ ...base, pathname: "/home" })).toBe("ignore");
    expect(decideRsvpResume({ ...base, pathname: "/webinars" })).toBe("ignore");
    expect(decideRsvpResume({ ...base, pathname: "/webinars/some-other-a1b2c3d4e5" })).toBe("ignore");
  });

  it("survives extra query params riding alongside the intent", () => {
    expect(decideRsvpResume({ ...base, search: "?utm_source=li&rsvp=1" })).toBe("submit");
  });
});
