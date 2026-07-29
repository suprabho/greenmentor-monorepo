import { describe, it, expect } from "vitest";
import { ID_PREFIX_LEN, idPrefix, parseShareParam, shareSlug, slugify } from "./slug";

const ID = "3f8a1c2e-9d44-4b1e-a7c2-118de4f0b933";
const PREFIX = "3f8a1c2e9d";

describe("slugify", () => {
  it("lowercases and dashes non-alphanumerics", () => {
    expect(slugify("GHG Lead Verifier #2")).toBe("ghg-lead-verifier-2");
    expect(slugify("Sustainability & CSR Manager")).toBe("sustainability-csr-manager");
  });

  it("collapses runs and trims edge dashes", () => {
    expect(slugify("  ---Scope 3 ///  emissions--- ")).toBe("scope-3-emissions");
  });

  it("caps at 60 chars without leaving a trailing dash", () => {
    // The 60-char cut lands mid-separator; the result must not end in "-".
    const long = slugify("a".repeat(59) + " tail");
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("-")).toBe(false);
  });

  it("drops non-ASCII, matching the SQL gm_slugify rule", () => {
    // Deliberately no unaccent: public.gm_slugify() must stay IMMUTABLE.
    expect(slugify("Café ESG")).toBe("caf-esg");
  });

  it("returns an empty string for input with nothing to slug", () => {
    expect(slugify("—— ///")).toBe("");
    expect(slugify(null)).toBe("");
    expect(slugify(undefined)).toBe("");
  });
});

describe("idPrefix", () => {
  it("takes the first 10 hex chars with dashes stripped", () => {
    expect(idPrefix(ID)).toBe(PREFIX);
    expect(idPrefix(ID)).toHaveLength(ID_PREFIX_LEN);
  });

  it("matches left(replace(id::text,'-',''), 10) — it must cross the first dash", () => {
    // A naive id.slice(0, 10) would yield "3f8a1c2e-9"; the SQL side strips
    // dashes first, so char 9 comes from the second uuid group.
    expect(idPrefix(ID)).not.toContain("-");
    expect(idPrefix(ID)).toBe("3f8a1c2e" + "9d");
  });
});

describe("shareSlug", () => {
  it("joins the slug and the id prefix", () => {
    expect(shareSlug("ghg-lead-verifier-2", ID)).toBe(`ghg-lead-verifier-2-${PREFIX}`);
  });

  it("falls back to 'item' when the row has no usable slug", () => {
    expect(shareSlug(null, ID)).toBe(`item-${PREFIX}`);
    expect(shareSlug("", ID)).toBe(`item-${PREFIX}`);
    expect(shareSlug("///", ID)).toBe(`item-${PREFIX}`);
  });

  it("re-slugifies a stored slug that isn't already URL-safe", () => {
    expect(shareSlug("Scope 3 Emissions", ID)).toBe(`scope-3-emissions-${PREFIX}`);
  });
});

describe("parseShareParam", () => {
  it("splits a canonical share slug", () => {
    expect(parseShareParam(`ghg-lead-verifier-2-${PREFIX}`)).toEqual({
      kind: "slug",
      slug: "ghg-lead-verifier-2",
      idPrefix: PREFIX,
    });
  });

  it("round-trips whatever shareSlug produces", () => {
    const parsed = parseShareParam(shareSlug("Scope 3 Reporting Masterclass", ID));
    expect(parsed).toEqual({
      kind: "slug",
      slug: "scope-3-reporting-masterclass",
      idPrefix: PREFIX,
    });
  });

  it("accepts a bare uuid so pre-slug links keep resolving", () => {
    expect(parseShareParam(ID)).toEqual({ kind: "uuid", id: ID });
    expect(parseShareParam(ID.toUpperCase())).toEqual({ kind: "uuid", id: ID });
  });

  it("splits at the LAST hex segment when the slug itself looks hex-ish", () => {
    expect(parseShareParam(`abc-cafedecafe-${PREFIX}`)).toEqual({
      kind: "slug",
      slug: "abc-cafedecafe",
      idPrefix: PREFIX,
    });
  });

  it("lowercases so shared links are case-insensitive", () => {
    expect(parseShareParam(`GHG-Lead-Verifier-${PREFIX.toUpperCase()}`)).toEqual({
      kind: "slug",
      slug: "ghg-lead-verifier",
      idPrefix: PREFIX,
    });
  });

  it("decodes percent-encoded params", () => {
    expect(parseShareParam(`scope%203-${PREFIX}`)?.kind).toBe("slug");
  });

  it("rejects anything without a 10-hex tail", () => {
    expect(parseShareParam("just-a-slug")).toBeNull();
    expect(parseShareParam("")).toBeNull();
    expect(parseShareParam("library")).toBeNull();
    // 9 and 11 hex chars are both wrong widths.
    expect(parseShareParam("x-3f8a1c2e9")).toBeNull();
    expect(parseShareParam("x-3f8a1c2e9dd")).toBeNull();
    // 'g' isn't hex.
    expect(parseShareParam("x-3f8a1c2e9g")).toBeNull();
  });
});
