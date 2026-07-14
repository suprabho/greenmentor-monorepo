// Deterministic GHG-Protocol emission math — ported from
// consulting/ls-ingestion/src/lib/emission.js (calcEmission). The legacy FE had
// no client calc; greenmentor-in-be owned it. We move it server-side here so the
// platform owns the number, grounded by an EFDB-looked-up (or user-overridden)
// emission factor. The factor is "kg CO2e per unit of activity"; tCO2e = qty × ef ÷ 1000.
//
// Kept a pure function (no I/O) so it is trivially unit-testable and matches the
// verification step in the plan (qty×ef÷1000, net-of-solar for Scope 2).

export interface CalcResult {
  tco2e: number;
  activity: number;
  activityUnit: string;
  scope: 1 | 2;
  formula: string;
}

/** Fuel (Scope 1): tCO2e = quantity × ef ÷ 1000. */
export function calcFuelEmission(
  quantity: number,
  ef: number,
  unit: string,
): CalcResult {
  const qty = Number(quantity) || 0;
  const tco2e = +((qty * ef) / 1000).toFixed(6);
  return {
    tco2e,
    activity: qty,
    activityUnit: unit || "litres",
    scope: 1,
    formula: `${qty} ${unit || "litres"} × ${ef} kg CO2e/unit ÷ 1000`,
  };
}

/**
 * Electricity (Scope 2): net of any on-site solar export, then × ef ÷ 1000.
 * net = kWh − solarExportKwh (clamped ≥ 0).
 */
export function calcElectricityEmission(
  kwh: number,
  ef: number,
  solarExportKwh?: number | null,
): CalcResult {
  const used = Number(kwh) || 0;
  const solar = Number(solarExportKwh) || 0;
  const net = Math.max(0, used - solar);
  const tco2e = +((net * ef) / 1000).toFixed(6);
  const netLabel = solar ? `(${used} − ${solar})` : `${net}`;
  return {
    tco2e,
    activity: net,
    activityUnit: "kWh",
    scope: 2,
    formula: `${netLabel} kWh × ${ef} kg CO2e/kWh ÷ 1000`,
  };
}
