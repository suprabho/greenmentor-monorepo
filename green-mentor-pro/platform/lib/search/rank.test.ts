import { describe, expect, it } from "vitest";
import {
  MAX_QUERY_LENGTH,
  anyColumnMatches,
  rankAndCap,
  sanitizeQuery,
  scoreHit,
  type SearchHit,
} from "./rank";

describe("sanitizeQuery", () => {
  it("passes ordinary queries through untouched", () => {
    expect(sanitizeQuery("scope 3")).toBe("scope 3");
    expect(sanitizeQuery("  BRSR  ")).toBe("BRSR");
  });

  it("rejects queries too short to be worth a round trip", () => {
    expect(sanitizeQuery("")).toBeNull();
    expect(sanitizeQuery("a")).toBeNull();
    expect(sanitizeQuery("   ")).toBeNull();
    expect(sanitizeQuery("ab")).toBe("ab");
  });

  it("strips PostgREST filter delimiters that would corrupt the or= expression", () => {
    // Unescaped, `,` splits the filter into extra conditions and `(` breaks
    // the parse — both silently, which is why this is tested.
    expect(sanitizeQuery("a,b(c)")).toBe("a b c");
    expect(sanitizeQuery("net.zero")).toBe("net zero");
    expect(sanitizeQuery('say "hi"')).toBe("say hi");
  });

  it("escapes ilike wildcards so they match literally", () => {
    // Without this, "100%" matches everything starting with "100".
    expect(sanitizeQuery("100%")).toBe("100\\%");
    expect(sanitizeQuery("a_b")).toBe("a\\_b");
  });

  it("strips user backslashes before adding its own", () => {
    // A user backslash must not survive to pre-escape our escape character —
    // otherwise `\%` would reach Postgres as an unescaped wildcard.
    expect(sanitizeQuery("a\\b")).toBe("a b");
    expect(sanitizeQuery("a\\%b")).toBe("a \\%b");
  });

  it("caps runaway input length", () => {
    const long = "x".repeat(500);
    expect(sanitizeQuery(long)!.length).toBe(MAX_QUERY_LENGTH);
  });

  it("collapses internal whitespace left behind by stripping", () => {
    expect(sanitizeQuery("scope,,,3")).toBe("scope 3");
  });
});

describe("anyColumnMatches", () => {
  it("builds one ilike clause per column", () => {
    expect(anyColumnMatches(["title", "company"], "esg")).toBe(
      "title.ilike.%esg%,company.ilike.%esg%"
    );
  });
});

describe("scoreHit", () => {
  it("ranks title matches above body matches", () => {
    const exact = scoreHit("scope 3", "scope 3", []);
    const prefix = scoreHit("scope 3 analyst", "scope 3", []);
    const contains = scoreHit("senior scope 3 analyst", "scope 3", []);
    const body = scoreHit("Sustainability Lead", "scope 3", ["owns scope 3 reporting"]);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(body);
  });

  it("is case insensitive", () => {
    expect(scoreHit("Scope 3", "scope 3", [])).toBe(100);
    expect(scoreHit("SCOPE 3 Analyst", "scope 3", [])).toBe(80);
  });

  it("tolerates null body fields", () => {
    expect(scoreHit("Unrelated", "scope 3", [null, null])).toBe(10);
  });
});

describe("rankAndCap", () => {
  const hit = (kind: SearchHit["kind"], title: string, score: number): SearchHit => ({
    kind,
    id: `${kind}-${title}`,
    title,
    subtitle: null,
    href: "/x",
    score,
  });

  it("orders by score descending", () => {
    const out = rankAndCap([hit("job", "low", 30), hit("job", "high", 100)], 5);
    expect(out.map((h) => h.title)).toEqual(["high", "low"]);
  });

  it("caps each kind so one noisy group cannot crowd out the others", () => {
    const noisy = Array.from({ length: 10 }, (_, i) => hit("article", `a${i}`, 60));
    const out = rankAndCap([...noisy, hit("course", "c", 60)], 2);
    expect(out.filter((h) => h.kind === "article")).toHaveLength(2);
    expect(out.filter((h) => h.kind === "course")).toHaveLength(1);
  });

  it("breaks score ties by kind weight, learning content first", () => {
    const out = rankAndCap(
      [hit("article", "news", 60), hit("course", "course", 60), hit("job", "job", 60)],
      5
    );
    expect(out.map((h) => h.kind)).toEqual(["course", "job", "article"]);
  });

  it("does not mutate its input", () => {
    const input = [hit("job", "a", 10), hit("job", "b", 90)];
    rankAndCap(input, 5);
    expect(input.map((h) => h.title)).toEqual(["a", "b"]);
  });
});
