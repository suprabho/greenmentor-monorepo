// ─────────────────────────────────────────────────────────────────────────────
// EMISSION CALCULATION — GHG Protocol
// ─────────────────────────────────────────────────────────────────────────────
export function calcEmission(billType, extracted, factor) {
  if (!factor?.ef_total_co2e || !extracted) return null;
  const fv = factor.ef_total_co2e;
  if (billType === "electricity") {
    const kwh = parseFloat(extracted.units_kwh)||0;
    const net = extracted.solar_export_kwh ? kwh - parseFloat(extracted.solar_export_kwh) : kwh;
    const tco2e = (net * fv) / 1000;
    return { tco2e:+tco2e.toFixed(6), activity:net, actUnit:"kWh", scope:2, formula:`${net} kWh × ${fv} ${factor.unit} ÷ 1000` };
  }
  const qty = parseFloat(extracted.quantity)||0;
  const unit = extracted.quantity_unit||"litres";
  return { tco2e:+((qty*fv)/1000).toFixed(6), activity:qty, actUnit:unit, scope:1, formula:`${qty} ${unit} × ${fv} ${factor.unit} ÷ 1000` };
}
