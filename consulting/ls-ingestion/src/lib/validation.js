// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RULES
// ─────────────────────────────────────────────────────────────────────────────
const MASTER_FUEL_TYPES = ["diesel","petrol","cng","lpg","hsd","furnace_oil","coal","biomass","natural_gas","kerosene","other"];
const UNIT_FOR_FUEL     = { litres:["diesel","petrol","lpg","hsd","furnace_oil","kerosene"], kg:["cng","coal","biomass","lpg"], SCM:["cng","natural_gas"], MT:["coal"], kL:["diesel","petrol","hsd"] };
const GSTIN_RE          = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function runValidation(billType, extracted) {
  const flags = [];
  if (!extracted) return { status:"failed", rules_run:0, flags:[{ rule:"E00", sev:"HARD_REJECT", label:"No extracted data" }] };

  if (billType === "electricity") {
    if (!extracted.period_from || !extracted.period_to)
      flags.push({ rule:"E02", sev:"HARD_REJECT", label:"Billing period dates missing" });
    else {
      const days = (new Date(extracted.period_to)-new Date(extracted.period_from))/86400000;
      if (days < 0)  flags.push({ rule:"E02a", sev:"HARD_REJECT", label:`period_to before period_from` });
      if (days > 95) flags.push({ rule:"E02b", sev:"FLAG",        label:`Period ${Math.round(days)} days — exceeds 95-day limit` });
    }
    if (!extracted.units_kwh || parseFloat(extracted.units_kwh) <= 0)
      flags.push({ rule:"E03", sev:"HARD_REJECT", label:"Units consumed missing or zero" });
    if (extracted.account_number && !/^\d{7,15}$/.test(String(extracted.account_number).replace(/\s/g,"")))
      flags.push({ rule:"E04", sev:"FLAG", label:`Account number format unrecognised` });
    if (extracted.amount_inr && extracted.units_kwh) {
      const rate = parseFloat(extracted.amount_inr)/parseFloat(extracted.units_kwh);
      if (rate < 2 || rate > 30) flags.push({ rule:"E09", sev:"FLAG", label:`Rate ₹${rate.toFixed(2)}/kWh outside expected tariff band` });
    }
    return { status: flags.some(f=>f.sev==="HARD_REJECT")?"failed":flags.length>0?"flagged":"passed", rules_run:13, flags };
  }

  if (billType === "fuel") {
    if (extracted.vendor_gstin) {
      if (!GSTIN_RE.test(extracted.vendor_gstin))
        flags.push({ rule:"F02", sev:"HARD_REJECT", label:`GSTIN "${extracted.vendor_gstin}" fails format check` });
    } else {
      flags.push({ rule:"F02a", sev:"FLAG", label:"Vendor GSTIN missing" });
    }
    if (!extracted.fuel_type || !MASTER_FUEL_TYPES.includes(extracted.fuel_type))
      flags.push({ rule:"F03", sev:"HARD_REJECT", label:`Fuel type "${extracted.fuel_type}" not in master list` });
    if (!extracted.quantity || parseFloat(extracted.quantity)<=0)
      flags.push({ rule:"F04", sev:"HARD_REJECT", label:"Quantity missing or zero" });
    if (!extracted.invoice_number)
      flags.push({ rule:"F05", sev:"FLAG", label:"Invoice number missing — duplicate detection unavailable" });
    if (extracted.fuel_type && extracted.quantity_unit) {
      const allowed = UNIT_FOR_FUEL[extracted.quantity_unit]||[];
      if (allowed.length>0 && !allowed.includes(extracted.fuel_type))
        flags.push({ rule:"F06", sev:"FLAG", label:`Unit "${extracted.quantity_unit}" unusual for "${extracted.fuel_type}"` });
    }
    return { status: flags.some(f=>f.sev==="HARD_REJECT")?"failed":flags.length>0?"flagged":"passed", rules_run:9, flags };
  }

  return { status:"passed", rules_run:0, flags:[] };
}
