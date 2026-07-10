/**
 * Curated BRSR Core indicator map — which XBRL facts the scraper extracts.
 *
 * Keys are stable snake_case identifiers stored in brsr_indicators.indicator_key;
 * downstream consumers (benchmarking, viz) depend on them, so rename with care.
 * `tags` lists the in-capmkt local names that carry the value — an array so
 * SEBI taxonomy revisions between fiscal years can be absorbed by appending
 * aliases (first alias wins). Curated empirically from FY2024-25 and FY2025-26
 * filings (RELIANCE, PRIVISCL, BIRLANU) via `scrape-brsr.ts --dump-tags`.
 *
 * Company-level figures live in non-dimensional contexts (DCYMain/DPYMain) and
 * need no `members`. Safety and attrition figures ONLY exist in dimensional
 * contexts (per employee class / gender axis), so those defs opt into an exact
 * member set — e.g. LTIFR is reported separately for EmployeesMember and
 * WorkersMember, which become the _employees / _workers key variants.
 */

export type BrsrCategory =
  | "emissions"
  | "energy"
  | "water"
  | "waste"
  | "safety"
  | "workforce"
  | "social"
  | "financial";

export type BrsrIndicatorDef = {
  /** Stable key, e.g. "scope1_emissions_total". */
  key: string;
  /** in-capmkt local element names carrying the value; aliases for taxonomy drift. */
  tags: string[];
  category: BrsrCategory;
  /** Exact XBRL member set (local names) the fact's context must carry.
   * Omitted → only non-dimensional (whole-entity) contexts match. */
  members?: string[];
};

export const BRSR_TAG_MAP: BrsrIndicatorDef[] = [
  // — Emissions (Principle 6, tCO2e — taxonomy unit name "MtCO2e") —
  { key: "scope1_emissions_total", tags: ["TotalScope1Emissions"], category: "emissions" },
  { key: "scope2_emissions_total", tags: ["TotalScope2Emissions"], category: "emissions" },
  { key: "scope3_emissions_total", tags: ["TotalScope3Emissions"], category: "emissions" },
  { key: "scope1_2_intensity_turnover", tags: ["TotalScope1AndScope2EmissionsIntensityPerRupeeOfTurnover"], category: "emissions" },
  { key: "scope1_2_intensity_ppp", tags: ["TotalScope1AndScope2EmissionsIntensityPerRupeeOfTurnoverAdjustedForPurchasingPowerParity"], category: "emissions" },
  { key: "scope1_2_intensity_physical", tags: ["TotalScope1AndScope2EmissionsIntensityInTermOfPhysicalOutput"], category: "emissions" },

  // — Energy (Gigajoule) —
  { key: "energy_consumed_total", tags: ["TotalEnergyConsumedFromRenewableAndNonRenewableSources"], category: "energy" },
  { key: "energy_consumed_renewable", tags: ["TotalEnergyConsumedFromRenewableSources"], category: "energy" },
  { key: "energy_consumed_nonrenewable", tags: ["TotalEnergyConsumedFromNonRenewableSources"], category: "energy" },
  { key: "energy_intensity_turnover", tags: ["EnergyIntensityPerRupeeOfTurnover"], category: "energy" },
  { key: "energy_intensity_ppp", tags: ["EnergyIntensityPerRupeeOfTurnoverAdjustingForPurchasingPowerParity"], category: "energy" },
  { key: "energy_intensity_physical", tags: ["EnergyIntensityInTermOfPhysicalOutput"], category: "energy" },

  // — Water (Kiloliters) —
  { key: "water_withdrawal_total", tags: ["TotalVolumeOfWaterWithdrawal"], category: "water" },
  { key: "water_withdrawal_surface", tags: ["WaterWithdrawalBySurfaceWater"], category: "water" },
  { key: "water_withdrawal_groundwater", tags: ["WaterWithdrawalByGroundwater"], category: "water" },
  { key: "water_withdrawal_third_party", tags: ["WaterWithdrawalByThirdPartyWater"], category: "water" },
  { key: "water_withdrawal_seawater", tags: ["WaterWithdrawalBySeawaterOrDesalinatedWater"], category: "water" },
  { key: "water_withdrawal_others", tags: ["WaterWithdrawalByOthers"], category: "water" },
  { key: "water_consumption_total", tags: ["TotalVolumeOfWaterConsumption"], category: "water" },
  { key: "water_discharged_total", tags: ["TotalWaterDischargedInKilolitres"], category: "water" },
  { key: "water_intensity_turnover", tags: ["WaterIntensityPerRupeeOfTurnover"], category: "water" },
  { key: "water_intensity_ppp", tags: ["WaterIntensityPerRupeeOfTurnoverAdjustingForPurchasingPowerParity"], category: "water" },
  { key: "water_intensity_physical", tags: ["WaterIntensityInTermOfPhysicalOutput"], category: "water" },

  // — Waste (Tonne) —
  { key: "waste_generated_total", tags: ["TotalWasteGenerated"], category: "waste" },
  { key: "waste_plastic", tags: ["PlasticWaste"], category: "waste" },
  { key: "waste_ewaste", tags: ["EWaste"], category: "waste" },
  { key: "waste_biomedical", tags: ["BioMedicalWaste"], category: "waste" },
  { key: "waste_battery", tags: ["BatteryWaste"], category: "waste" },
  { key: "waste_radioactive", tags: ["RadioactiveWaste"], category: "waste" },
  { key: "waste_hazardous_other", tags: ["OtherHazardousWaste"], category: "waste" },
  { key: "waste_nonhazardous_other", tags: ["OtherNonHazardousWasteGenerated"], category: "waste" },
  { key: "waste_recovered_total", tags: ["TotalWasteRecovered"], category: "waste" },
  { key: "waste_recovered_recycled", tags: ["WasteRecoveredThroughRecycled"], category: "waste" },
  { key: "waste_recovered_reused", tags: ["WasteRecoveredThroughReUsed"], category: "waste" },
  { key: "waste_disposed_total", tags: ["TotalWasteDisposed"], category: "waste" },
  { key: "waste_disposed_incineration", tags: ["WasteDisposedByIncineration"], category: "waste" },
  { key: "waste_disposed_landfill", tags: ["WasteDisposedByLandfilling"], category: "waste" },
  { key: "waste_intensity_turnover", tags: ["WasteIntensityPerRupeeOfTurnover"], category: "waste" },

  // — Safety (Principle 3; reported per employee class, hence member filters) —
  { key: "ltifr_employees", tags: ["LostTimeInjuryFrequencyRatePerOneMillionPersonHoursWorked"], category: "safety", members: ["EmployeesMember"] },
  { key: "ltifr_workers", tags: ["LostTimeInjuryFrequencyRatePerOneMillionPersonHoursWorked"], category: "safety", members: ["WorkersMember"] },
  { key: "fatalities_employees", tags: ["NumberOfFatalities"], category: "safety", members: ["EmployeesMember"] },
  { key: "fatalities_workers", tags: ["NumberOfFatalities"], category: "safety", members: ["WorkersMember"] },
  { key: "recordable_injuries_employees", tags: ["TotalRecordableWorkRelatedInjuries"], category: "safety", members: ["EmployeesMember"] },
  { key: "recordable_injuries_workers", tags: ["TotalRecordableWorkRelatedInjuries"], category: "safety", members: ["WorkersMember"] },
  { key: "high_consequence_injuries_employees", tags: ["HighConsequenceWorkRelatedInjuryOrIllHealthExcludingFatalities"], category: "safety", members: ["EmployeesMember"] },
  { key: "high_consequence_injuries_workers", tags: ["HighConsequenceWorkRelatedInjuryOrIllHealthExcludingFatalities"], category: "safety", members: ["WorkersMember"] },

  // — Workforce (GenderMember = the axis "total" line in the attrition table) —
  { key: "turnover_rate_permanent_employees", tags: ["TurnoverRate"], category: "workforce", members: ["GenderMember", "PermanentEmployeesMember"] },
  { key: "turnover_rate_permanent_workers", tags: ["TurnoverRate"], category: "workforce", members: ["GenderMember", "PermanentWorkersMember"] },
  { key: "posh_complaints", tags: ["TotalComplaintsReportedUnderSexualHarassmentOfWomenAtWorkplace"], category: "workforce" },
  { key: "posh_complaints_upheld", tags: ["ComplaintsOnPOSHUpHeld"], category: "workforce" },
  { key: "wages_total", tags: ["TotalWagesPaid"], category: "workforce" },
  { key: "wages_female_pct", tags: ["PercentageOfGrossWagesPaidToFemaleToTotalWagesPaid"], category: "workforce" },

  // — Social —
  { key: "csr_spend", tags: ["AmountSpentForCSRProjectsUndertaken"], category: "social" },
  { key: "csr_beneficiaries", tags: ["NumberOfPersonsBenefittedFromCSRProjects"], category: "social" },
  { key: "recycled_input_pct", tags: ["RecycledOrReUsedInPutMaterialToTotalMaterial"], category: "social" },

  // — Financial —
  { key: "turnover", tags: ["Turnover"], category: "financial" },
];
