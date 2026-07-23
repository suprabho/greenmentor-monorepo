import { describe, it, expect } from "vitest";
import { calcFuelEmission, calcElectricityEmission } from "./calc";

describe("calcFuelEmission (Scope 1)", () => {
  it("computes tCO2e = qty × ef ÷ 1000", () => {
    const r = calcFuelEmission(100, 2.68, "litres");
    expect(r.tco2e).toBe(0.268); // 100 × 2.68 ÷ 1000
    expect(r.scope).toBe(1);
    expect(r.activity).toBe(100);
    expect(r.activityUnit).toBe("litres");
  });

  it("rounds tCO2e to 6 decimals", () => {
    // 1 × 2.6666665 ÷ 1000 = 0.0026666665 → 0.002667
    const r = calcFuelEmission(1, 2.6666665, "litres");
    expect(r.tco2e).toBe(0.002667);
  });

  it("defaults a blank unit to litres", () => {
    const r = calcFuelEmission(10, 1, "");
    expect(r.activityUnit).toBe("litres");
    expect(r.formula).toContain("litres");
  });

  it("coerces a non-finite quantity to 0", () => {
    const r = calcFuelEmission(Number.NaN as unknown as number, 2.68, "kg");
    expect(r.activity).toBe(0);
    expect(r.tco2e).toBe(0);
  });

  it("embeds a human-readable formula", () => {
    const r = calcFuelEmission(50, 3, "kg");
    expect(r.formula).toMatch(/^50 kg .+ 3 .+ 1000$/);
  });
});

describe("calcElectricityEmission (Scope 2)", () => {
  it("computes tCO2e = kWh × ef ÷ 1000 with no solar", () => {
    const r = calcElectricityEmission(1000, 0.716);
    expect(r.tco2e).toBe(0.716);
    expect(r.scope).toBe(2);
    expect(r.activity).toBe(1000);
    expect(r.activityUnit).toBe("kWh");
  });

  it("nets on-site solar export before applying ef", () => {
    // net = 1000 − 300 = 700 → 700 × 0.716 ÷ 1000 = 0.5012
    const r = calcElectricityEmission(1000, 0.716, 300);
    expect(r.activity).toBe(700);
    expect(r.tco2e).toBe(0.5012);
    expect(r.formula).toMatch(/\(1000 .+ 300\)/);
  });

  it("clamps net usage to 0 when solar export exceeds consumption", () => {
    const r = calcElectricityEmission(200, 0.716, 500);
    expect(r.activity).toBe(0);
    expect(r.tco2e).toBe(0);
  });

  it("treats null/absent solar export as 0", () => {
    const r = calcElectricityEmission(500, 0.5, null);
    expect(r.activity).toBe(500);
    expect(r.tco2e).toBe(0.25);
  });
});
