import { describe, it, expect, vi, beforeEach } from "vitest";

// resolveFactor's only I/O is the EFDB seam from @gm/orchestrator — mock it so we
// exercise the resolution + ranking logic deterministically (no network, no EFDB).
vi.mock("@gm/orchestrator", () => ({
  efdbBase: vi.fn(),
  efdbGet: vi.fn(),
}));

import { efdbBase, efdbGet } from "@gm/orchestrator";
import { resolveFactor } from "./factors";

const base = vi.mocked(efdbBase);
const get = vi.mocked(efdbGet);

beforeEach(() => {
  vi.clearAllMocks();
  base.mockReturnValue("http://efdb.test"); // configured by default
});

describe("resolveFactor", () => {
  it("lets a finite manual override win without querying EFDB", async () => {
    const r = await resolveFactor({ query: "diesel", scope: 1, manualEf: 2.68 });
    expect(r).toMatchObject({ ef: 2.68, source: "manual" });
    expect(get).not.toHaveBeenCalled();
  });

  it("returns 'none' when EFDB is not configured", async () => {
    base.mockReturnValue("");
    const r = await resolveFactor({ query: "diesel", scope: 1 });
    expect(r.source).toBe("none");
    expect(r.ef).toBeNull();
    expect(r.note).toMatch(/not configured/i);
    expect(get).not.toHaveBeenCalled();
  });

  it("prefers a country match over a higher data-quality score", async () => {
    get.mockResolvedValue({
      status: 200,
      body: {
        results: [
          { ef_id: "us", activity_name: "Diesel", ef_value: 2.5, country_iso: "US", dq_score_overall: 0.9 },
          { ef_id: "in", activity_name: "Diesel", ef_value: 3.1, country_iso: "IN", dq_score_overall: 0.5 },
        ],
      },
    } as never);
    const r = await resolveFactor({ query: "diesel", scope: 1 }); // default country IN
    expect(r.source).toBe("efdb");
    expect(r.ef).toBe(3.1);
    expect(r.provenance?.country).toBe("IN");
  });

  it("breaks ties by data-quality when country matches are equal", async () => {
    get.mockResolvedValue({
      status: 200,
      body: {
        results: [
          { ef_id: "lo", ef_value: 2.0, country_iso: "IN", dq_score_overall: 0.4 },
          { ef_id: "hi", ef_value: 9.9, country_iso: "IN", dq_score_overall: 0.8 },
        ],
      },
    } as never);
    const r = await resolveFactor({ query: "diesel", scope: 1 });
    expect(r.ef).toBe(9.9);
  });

  it("surfaces an EFDB auth failure", async () => {
    get.mockResolvedValue({ status: 401, body: {} } as never);
    const r = await resolveFactor({ query: "diesel", scope: 1 });
    expect(r.source).toBe("none");
    expect(r.note).toMatch(/auth failed/i);
  });

  it("returns 'none' when EFDB has no matching rows", async () => {
    get.mockResolvedValue({ status: 200, body: { results: [] } } as never);
    const r = await resolveFactor({ query: "diesel", scope: 1 });
    expect(r.source).toBe("none");
    expect(r.note).toMatch(/no matching factor/i);
  });

  it("ignores candidates with a non-positive ef value", async () => {
    get.mockResolvedValue({
      status: 200,
      body: { results: [{ ef_id: "z", ef_value: 0, country_iso: "IN", dq_score_overall: 0.9 }] },
    } as never);
    const r = await resolveFactor({ query: "diesel", scope: 1 });
    expect(r.source).toBe("none");
    expect(r.note).toMatch(/no usable factor/i);
  });
});
