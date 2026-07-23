import { describe, it, expect } from "vitest";
import {
  fuelEntrySchema,
  electricityEntrySchema,
  fugitiveEntrySchema,
  siteSchema,
  rejectSchema,
} from "./schema";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("fuelEntrySchema", () => {
  it("accepts a minimal valid payload and defaults evidence_paths", () => {
    const r = fuelEntrySchema.safeParse({ bill_date: "2026-01-15", fuel_type_id: UUID, quantity: 100 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.evidence_paths).toEqual([]);
      expect(r.data.quantity).toBe(100);
    }
  });

  it("coerces a numeric-string quantity", () => {
    const r = fuelEntrySchema.safeParse({ bill_date: "2026-01-15", fuel_type_id: UUID, quantity: "250" });
    expect(r.success && r.data.quantity).toBe(250);
  });

  it("rejects a non-positive quantity", () => {
    expect(fuelEntrySchema.safeParse({ bill_date: "2026-01-15", fuel_type_id: UUID, quantity: 0 }).success).toBe(false);
  });

  it("treats an empty-string site_id as absent (optUuid)", () => {
    const r = fuelEntrySchema.safeParse({ bill_date: "2026-01-15", fuel_type_id: UUID, quantity: 5, site_id: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.site_id).toBeUndefined();
  });

  it("rejects a malformed bill_date", () => {
    expect(fuelEntrySchema.safeParse({ bill_date: "15-01-2026", fuel_type_id: UUID, quantity: 5 }).success).toBe(false);
  });

  it("rejects a non-uuid fuel_type_id", () => {
    expect(fuelEntrySchema.safeParse({ bill_date: "2026-01-15", fuel_type_id: "not-a-uuid", quantity: 5 }).success).toBe(false);
  });
});

describe("electricityEntrySchema", () => {
  const base = { bill_date: "2026-02-01", electricity_source_id: UUID, unit_used: 1000 };

  it("accepts a valid payload", () => {
    expect(electricityEntrySchema.safeParse(base).success).toBe(true);
  });

  it("rejects unit_used <= 0", () => {
    expect(electricityEntrySchema.safeParse({ ...base, unit_used: 0 }).success).toBe(false);
  });

  it("enforces bill_end on or after bill_start", () => {
    expect(electricityEntrySchema.safeParse({ ...base, bill_start: "2026-02-10", bill_end: "2026-02-01" }).success).toBe(false);
    expect(electricityEntrySchema.safeParse({ ...base, bill_start: "2026-02-01", bill_end: "2026-02-10" }).success).toBe(true);
  });

  it("accepts an optional solar_export_kwh", () => {
    const r = electricityEntrySchema.safeParse({ ...base, solar_export_kwh: 200 });
    expect(r.success && r.data.solar_export_kwh).toBe(200);
  });
});

describe("fugitiveEntrySchema", () => {
  it("coerces a method string to an int", () => {
    const r = fugitiveEntrySchema.safeParse({ method: "3", gas: "R410A" });
    expect(r.success && r.data.method).toBe(3);
  });

  it("rejects a method outside 1..5", () => {
    expect(fugitiveEntrySchema.safeParse({ method: 6 }).success).toBe(false);
    expect(fugitiveEntrySchema.safeParse({ method: 0 }).success).toBe(false);
  });

  it("passes method-specific numeric inputs through", () => {
    const r = fugitiveEntrySchema.safeParse({ method: 2, quantity_purchased: "25" });
    expect(r.success && r.data.quantity_purchased).toBe(25);
  });
});

describe("siteSchema", () => {
  it("requires a non-empty business_unit and location", () => {
    expect(siteSchema.safeParse({ business_unit: "Plant A", location: "Pune" }).success).toBe(true);
    expect(siteSchema.safeParse({ business_unit: "", location: "Pune" }).success).toBe(false);
  });
});

describe("rejectSchema", () => {
  it("requires non-empty feedback", () => {
    expect(rejectSchema.safeParse({ feedback: "insufficient evidence" }).success).toBe(true);
    expect(rejectSchema.safeParse({ feedback: "" }).success).toBe(false);
  });
});
