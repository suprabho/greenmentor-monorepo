// Fugitive-emission math (Scope 1), GHG-Protocol refrigerant/gas approach. Every
// method estimates a released mass of gas (kg); CO2e = released_kg × GWP-100, and
// tCO2e = that ÷ 1000. The five methods differ only in how released_kg is derived.
//
// References: GHG Protocol "Direct HFC/PFC emissions from refrigeration & AC"
// guidance; US EPA / IPCC 2006 GL Vol.3 Ch.7 sales-based, mass-balance and
// screening approaches. These are the standard formulas the legacy -be applied
// server-side (never exposed to the FE). All inputs are masses in the same unit.

export const METHOD_LABELS: Record<number, string> = {
  1: "Screening method",
  2: "Purchased gases",
  3: "Material balance",
  4: "Simplified material balance",
  5: "Fire suppression",
};

export interface FugitiveInputs {
  // M1 — screening
  amount_refrigerant_charged?: number | null;
  refrigerant_capacity?: number | null;
  // M2 — purchased gases
  quantity_purchased?: number | null;
  // M3 — material balance
  inventory_start?: number | null;
  inventory_end?: number | null;
  purchased?: number | null;
  disposed?: number | null;
  // M4 — simplified material balance
  service_refrigerant_purchases?: number | null;
  retiring_equipment_capacity?: number | null;
  recovered_refrigerant?: number | null;
  new_equipment_capacity?: number | null;
  new_equipment_refrigerant_purchases?: number | null;
  // M5 — fire suppression
  suppressant_capacity?: number | null;
  number_of_units?: number | null;
  emission_factor?: number | null; // annual leak fraction (0–1)
}

export interface FugitiveCalc {
  released_kg: number;
  tco2e: number | null;
  formula: string;
}

const n = (v: number | null | undefined) => (v == null ? 0 : Number(v) || 0);
const clamp0 = (v: number) => Math.max(0, v);

/**
 * Compute released mass + tCO2e for a fugitive entry.
 * @param leakRate default annual leak fraction for the equipment (screening only).
 */
export function calcFugitive(
  method: number,
  inputs: FugitiveInputs,
  gwp: number | null,
  leakRate?: number | null,
): FugitiveCalc {
  let released = 0;
  let formula = "";

  switch (method) {
    case 1: {
      // Screening: annual operating leakage = charge × equipment leak rate.
      const charge = inputs.amount_refrigerant_charged != null
        ? n(inputs.amount_refrigerant_charged)
        : n(inputs.refrigerant_capacity);
      const lr = leakRate == null ? 0 : Number(leakRate) || 0;
      released = clamp0(charge * lr);
      formula = `${charge} kg charge × ${lr} leak-rate`;
      break;
    }
    case 2: {
      // Purchased/acquired gases: purchases replace leaks → all purchased emitted.
      released = clamp0(n(inputs.quantity_purchased));
      formula = `${released} kg purchased`;
      break;
    }
    case 3: {
      // Material balance: (inventory decrease) + purchases − disposals.
      const dec = n(inputs.inventory_start) - n(inputs.inventory_end);
      released = clamp0(dec + n(inputs.purchased) - n(inputs.disposed));
      formula = `(${n(inputs.inventory_start)} − ${n(inputs.inventory_end)}) + ${n(inputs.purchased)} − ${n(inputs.disposed)}`;
      break;
    }
    case 4: {
      // Simplified material balance (EPA): service purchases + (retiring capacity −
      // recovered) − (new equipment capacity − charge into new equipment).
      released = clamp0(
        n(inputs.service_refrigerant_purchases) +
          (n(inputs.retiring_equipment_capacity) - n(inputs.recovered_refrigerant)) -
          (n(inputs.new_equipment_capacity) - n(inputs.new_equipment_refrigerant_purchases)),
      );
      formula =
        `${n(inputs.service_refrigerant_purchases)} + ` +
        `(${n(inputs.retiring_equipment_capacity)} − ${n(inputs.recovered_refrigerant)}) − ` +
        `(${n(inputs.new_equipment_capacity)} − ${n(inputs.new_equipment_refrigerant_purchases)})`;
      break;
    }
    case 5: {
      // Fire suppression: installed suppressant × units × annual emission factor.
      const cap = n(inputs.suppressant_capacity);
      const units = n(inputs.number_of_units) || 1;
      const ef = n(inputs.emission_factor);
      released = clamp0(cap * units * ef);
      formula = `${cap} kg × ${units} units × ${ef} EF`;
      break;
    }
    default:
      return { released_kg: 0, tco2e: null, formula: "unknown method" };
  }

  const released_kg = +released.toFixed(6);
  const tco2e = gwp != null ? +((released_kg * gwp) / 1000).toFixed(6) : null;
  return {
    released_kg,
    tco2e,
    formula: `${formula} = ${released_kg} kg${gwp != null ? ` × GWP ${gwp} ÷ 1000` : ""}`,
  };
}
