import { describe, it, expect } from "vitest";
import { safeNextHref, splitHref } from "./next-href";

describe("safeNextHref", () => {
  it("passes through same-origin paths", () => {
    expect(safeNextHref("/webinars/scope-3-3f8a1c2e9d")).toBe("/webinars/scope-3-3f8a1c2e9d");
    expect(safeNextHref("/feed?entity=csrd")).toBe("/feed?entity=csrd");
  });

  it("rejects protocol-relative URLs, which a bare startsWith('/') lets through", () => {
    expect(safeNextHref("//evil.com")).toBe("/home");
    expect(safeNextHref("//evil.com/webinars")).toBe("/home");
    expect(safeNextHref("/\\evil.com")).toBe("/home");
  });

  it("rejects absolute URLs and non-paths", () => {
    expect(safeNextHref("https://evil.com")).toBe("/home");
    expect(safeNextHref("javascript:alert(1)")).toBe("/home");
    expect(safeNextHref("webinars")).toBe("/home");
  });

  it("falls back for empty input", () => {
    expect(safeNextHref(null)).toBe("/home");
    expect(safeNextHref(undefined)).toBe("/home");
    expect(safeNextHref("")).toBe("/home");
  });

  it("honours a custom fallback", () => {
    expect(safeNextHref(null, "/")).toBe("/");
    expect(safeNextHref("https://evil.com", "")).toBe("");
  });
});

describe("splitHref", () => {
  it("splits path and query", () => {
    expect(splitHref("/feed?entity=csrd")).toEqual({ pathname: "/feed", search: "?entity=csrd" });
  });

  it("handles a bare path", () => {
    expect(splitHref("/jobs/analyst-8b21f0ac4e")).toEqual({
      pathname: "/jobs/analyst-8b21f0ac4e",
      search: "",
    });
  });

  it("drops the fragment, which never reaches the server anyway", () => {
    expect(splitHref("/feed?entity=csrd#comments")).toEqual({
      pathname: "/feed",
      search: "?entity=csrd",
    });
  });
});
