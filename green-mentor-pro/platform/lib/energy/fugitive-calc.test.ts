import { describe, it, expect } from "vitest";
import { calcFugitive, METHOD_LABELS } from "./fugitive-calc";

// A representative refrigerant GWP-100 for the tCO2e leg (released_kg × gwp ÷ 1000).
const GWP = 1430;

describe("calcFugitive", () => {
  describe("method 1 — screening", () => {
    it("released = charge × leak-rate; tCO2e = released × gwp ÷ 1000", () => {
      const r = calcFugitive(1, { amount_refrigerant_charged: 10 }, GWP, 0.05);
      expect(r.released_kg).toBe(0.5); // 10 × 0.05
      expect(r.tco2e).toBe(0.715); // 0.5 × 1430 ÷ 1000
    });

    it("falls back to refrigerant_capacity when charge is null", () => {
      const r = calcFugitive(1, { amount_refrigerant_charged: null, refrigerant_capacity: 20 }, null, 0.1);
      expect(r.released_kg).toBe(2); // 20 × 0.1
    });

    it("a null leak-rate yields zero release", () => {
      const r = calcFugitive(1, { amount_refrigerant_charged: 10 }, GWP, null);
      expect(r.released_kg).toBe(0);
      expect(r.tco2e).toBe(0);
    });
  });

  describe("method 2 — purchased gases", () => {
    it("all purchased gas is treated as emitted", () => {
      const r = calcFugitive(2, { quantity_purchased: 25 }, GWP);
      expect(r.released_kg).toBe(25);
      expect(r.tco2e).toBe(35.75); // 25 × 1430 ÷ 1000
    });

    it("clamps negative purchases to 0", () => {
      const r = calcFugitive(2, { quantity_purchased: -5 }, GWP);
      expect(r.released_kg).toBe(0);
    });
  });

  describe("method 3 — material balance", () => {
    it("released = (start − end) + purchased − disposed", () => {
      const r = calcFugitive(
        3,
        { inventory_start: 100, inventory_end: 80, purchased: 10, disposed: 5 },
        GWP,
      );
      expect(r.released_kg).toBe(25); // (100 − 80) + 10 − 5
    });
  });

  describe("method 4 — simplified material balance", () => {
    it("released = service + (retiring − recovered) − (new cap − new purchases)", () => {
      const r = calcFugitive(
        4,
        {
          service_refrigerant_purchases: 5,
          retiring_equipment_capacity: 20,
          recovered_refrigerant: 10,
          new_equipment_capacity: 30,
          new_equipment_refrigerant_purchases: 25,
        },
        GWP,
      );
      expect(r.released_kg).toBe(10); // 5 + (20 − 10) − (30 − 25)
    });
  });

  describe("method 5 — fire suppression", () => {
    it("released = capacity × units × emission factor", () => {
      const r = calcFugitive(5, { suppressant_capacity: 50, number_of_units: 2, emission_factor: 0.02 }, GWP);
      expect(r.released_kg).toBe(2); // 50 × 2 × 0.02
    });

    it("defaults units to 1 when number_of_units is absent", () => {
      const r = calcFugitive(5, { suppressant_capacity: 50, emission_factor: 0.02 }, GWP);
      expect(r.released_kg).toBe(1); // 50 × 1 × 0.02
    });
  });

  describe("tCO2e leg", () => {
    it("leaves tCO2e null when no GWP is supplied", () => {
      const r = calcFugitive(2, { quantity_purchased: 25 }, null);
      expect(r.released_kg).toBe(25);
      expect(r.tco2e).toBeNull();
    });
  });

  describe("unknown method", () => {
    it("returns zero release, null tCO2e, and an explanatory formula", () => {
      const r = calcFugitive(9, { quantity_purchased: 25 }, GWP);
      expect(r.released_kg).toBe(0);
      expect(r.tco2e).toBeNull();
      expect(r.formula).toBe("unknown method");
    });
  });

  it("labels all five methods", () => {
    expect(METHOD_LABELS[1]).toMatch(/screening/i);
    expect(Object.keys(METHOD_LABELS)).toHaveLength(5);
  });
});
