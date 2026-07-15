/**
 * Sustainalytics subindustry → NIC-2008 crosswalk.
 *
 * Sustainalytics classifies companies into ~138 subindustries (a GICS-like
 * taxonomy); BRSR filings are coded against NIC-2008 (lib/brsr/nic-sector.ts).
 * This curated map lets the Sustainalytics materiality taxonomy join our BRSR
 * data by sector — e.g. "which Material ESG Issues apply to the NIC Section a
 * company files under".
 *
 * Each subindustry maps to a NIC Division (2-digit "industry"), which fixes the
 * Section ("sector") via resolveNic. The `section` field below is the *intended*
 * Section, cross-checked against resolveNic(division) by scripts/seed-sustainalytics-nic.ts
 * so a mistyped division can't silently land in the wrong sector.
 *
 * These are well-known industry↔NIC correspondences, so the map is curated (not
 * LLM-derived) and committed as reviewable data. `confidence` flags the judgment
 * calls: "high" = unambiguous; "medium" = a defensible best-fit among a few NIC
 * divisions; "low" = genuinely cross-sector (holding companies, "home improvement")
 * where the single-division choice is a pragmatic anchor for human review.
 */

export type CrosswalkConfidence = "high" | "medium" | "low";

export interface NicCrosswalkEntry {
  /** Subindustry slug (matches sustainalytics_subindustries.slug). */
  slug: string;
  /** Intended NIC Section letter (A–U) — cross-checked against the division. */
  section: string;
  /** NIC Division (2-digit) — the join granularity. */
  division: string;
  confidence: CrosswalkConfidence;
}

// [slug, section, division, confidence]
const RAW: readonly [string, string, string, CrosswalkConfidence][] = [
  ["Advertising", "M", "73", "high"],
  ["AerospaceandDefence", "C", "30", "high"],
  ["AgriculturalChemicals", "C", "20", "high"],
  ["AgriculturalMachinery", "C", "28", "high"],
  ["Agriculture", "A", "01", "high"],
  ["AirFreightandLogistics", "H", "52", "medium"],
  ["Airlines", "H", "51", "high"],
  ["Airports", "H", "52", "high"],
  ["Aluminum", "C", "24", "high"],
  ["AssetManagementandCustodyServices", "K", "66", "high"],
  ["AutoParts", "C", "29", "high"],
  ["Automobiles", "C", "29", "high"],
  ["AutomotiveRetail", "G", "45", "high"],
  ["BeerWineandSpirits", "C", "11", "high"],
  ["Biotechnology", "M", "72", "medium"],
  ["Broadcasting", "J", "60", "high"],
  ["BuildingProducts", "C", "23", "medium"],
  ["BusinessSupportServices", "N", "82", "high"],
  ["CableandSatellite", "J", "61", "high"],
  ["CasinosandGaming", "R", "92", "high"],
  ["Coal", "B", "05", "high"],
  ["CommercialPrinting", "C", "18", "high"],
  ["CommodityChemicals", "C", "20", "high"],
  ["CommunicationsEquipment", "C", "26", "high"],
  ["Conglomerates", "K", "64", "low"],
  ["ConstructionMaterials", "C", "23", "high"],
  ["ConsumerElectronics", "C", "26", "high"],
  ["ConsumerFinance", "K", "64", "high"],
  ["ConsumerServices", "S", "96", "medium"],
  ["DataProcessing", "J", "63", "high"],
  ["DepartmentStores", "G", "47", "high"],
  ["DevelopmentBanks", "K", "64", "high"],
  ["Distribution", "G", "46", "high"],
  ["DiversifiedBanks", "K", "64", "high"],
  ["DiversifiedChemicals", "C", "20", "high"],
  ["DiversifiedFinancialInstitutions", "K", "64", "medium"],
  ["DiversifiedInsuranceServices", "K", "65", "high"],
  ["DiversifiedMetalsMining", "B", "07", "high"],
  ["DiversifiedRealEstate", "L", "68", "high"],
  ["DrugRetail", "G", "47", "high"],
  ["ElectricUtilities", "D", "35", "high"],
  ["ElectricalEquipment", "C", "27", "high"],
  ["ElectronicComponents", "C", "26", "high"],
  ["ElectronicsEquipment", "C", "26", "high"],
  ["ElectronicsManufacturing", "C", "26", "high"],
  ["ElectronicsRetail", "G", "47", "high"],
  ["EnterpriseandInfrastructureSoftware", "J", "62", "medium"],
  ["EntertainmentSoftware", "J", "58", "high"],
  ["FacilitiesMaintenance", "N", "81", "high"],
  ["FinancialExchangesandDataServices", "K", "66", "high"],
  ["FoodDistribution", "G", "46", "high"],
  ["FoodRetail", "G", "47", "high"],
  ["Footwear", "C", "15", "high"],
  ["Forestry", "A", "02", "high"],
  ["GasUtilities", "D", "35", "high"],
  ["Gold", "B", "07", "high"],
  ["HealthCareITServices", "J", "62", "medium"],
  ["HeavyMachineryandTrucks", "C", "28", "medium"],
  ["HighwaysandRailroads", "H", "49", "high"],
  ["HomeAppliances", "C", "27", "high"],
  ["HomeImprovement", "G", "47", "low"],
  ["HomeImprovementRetail", "G", "47", "high"],
  ["Homebuilding", "F", "41", "high"],
  ["HouseholdProducts", "C", "20", "medium"],
  ["HRServices", "N", "78", "high"],
  ["IndependentPowerProductionandTraders", "D", "35", "high"],
  ["IndustrialGases", "C", "20", "high"],
  ["IndustrialMachinery", "C", "28", "high"],
  ["InsuranceBrokers", "K", "66", "high"],
  ["IntegratedOilGas", "B", "06", "medium"],
  ["InternetSoftwareandServices", "J", "63", "medium"],
  ["InvestmentBankingandBrokerage", "K", "66", "high"],
  ["ITConsulting", "J", "62", "high"],
  ["LaboratoryEquipmentandServices", "C", "26", "medium"],
  ["LifeandHealthInsurance", "K", "65", "high"],
  ["LuxuryApparel", "C", "14", "high"],
  ["ManagedHealthCare", "K", "65", "medium"],
  ["MarinePorts", "H", "52", "high"],
  ["MedicalDevices", "C", "32", "high"],
  ["MedicalDistribution", "G", "46", "high"],
  ["MedicalFacilities", "Q", "86", "high"],
  ["MedicalServices", "Q", "86", "high"],
  ["MedicalSupplies", "C", "32", "high"],
  ["MetalandGlassPackaging", "C", "25", "medium"],
  ["MortgageREITs", "K", "64", "medium"],
  ["Motorcycles", "C", "30", "high"],
  ["MoviesandEntertainment", "J", "59", "high"],
  ["Multi-SectorHoldings", "K", "64", "low"],
  ["Multi-Utilities", "D", "35", "medium"],
  ["Non-ResidentialConstruction", "F", "41", "medium"],
  ["OfficeServices", "N", "82", "high"],
  ["OilGasDrilling", "B", "09", "high"],
  ["OilGasEquipment", "C", "28", "medium"],
  ["OilGasExplorationandProduction", "B", "06", "high"],
  ["OilGasRefiningandMarketing", "C", "19", "high"],
  ["OilGasStorageandTransportation", "H", "49", "medium"],
  ["OnlineandDirectMarketingRetail", "G", "47", "high"],
  ["OtherFinancialServices", "K", "66", "medium"],
  ["PackagedFoods", "C", "10", "high"],
  ["PaperandPulp", "C", "17", "high"],
  ["PaperPackaging", "C", "17", "high"],
  ["PersonalProducts", "C", "20", "medium"],
  ["Pharmaceuticals", "C", "21", "high"],
  ["PreciousMetalsMining", "B", "07", "high"],
  ["PropertyandCasualtyInsurance", "K", "65", "high"],
  ["Publishing", "J", "58", "high"],
  ["RailTransport", "H", "49", "high"],
  ["RealEstateDevelopment", "L", "68", "high"],
  ["RealEstateManagement", "L", "68", "high"],
  ["RealEstateServices", "L", "68", "high"],
  ["RegionalBanks", "K", "64", "high"],
  ["Reinsurance", "K", "65", "high"],
  ["REITs", "L", "68", "high"],
  ["RenewablePowerProduction", "D", "35", "high"],
  ["ResearchandConsulting", "M", "70", "medium"],
  ["Restaurants", "I", "56", "high"],
  ["RetailApparel", "G", "47", "high"],
  ["SecurityServicesandCorrectionalFacilities", "N", "80", "high"],
  ["SemiconductorDesignandManufacturing", "C", "26", "high"],
  ["SemiconductorEquipment", "C", "28", "high"],
  ["Shipping", "H", "50", "high"],
  ["SoftDrinks", "C", "11", "high"],
  ["SpecializedFinance", "K", "64", "medium"],
  ["SpecialtyChemicals", "C", "20", "high"],
  ["SpecialtyRetail", "G", "47", "high"],
  ["Steel", "C", "24", "high"],
  ["TechnologyDistribution", "G", "46", "high"],
  ["TechnologyHardware", "C", "26", "high"],
  ["TelecommunicationServices", "J", "61", "high"],
  ["Textiles", "C", "13", "high"],
  ["ThriftsandMortgages", "K", "64", "high"],
  ["Tires", "C", "22", "high"],
  ["Tobacco", "C", "12", "high"],
  ["ToysandSportingGoods", "C", "32", "high"],
  ["TradingandDistribution", "G", "46", "high"],
  ["TravelLodgingandAmusement", "I", "55", "medium"],
  ["Trucking", "H", "49", "high"],
  ["WaterUtilities", "E", "36", "high"],
];

export const SUBINDUSTRY_NIC_CROSSWALK: NicCrosswalkEntry[] = RAW.map(
  ([slug, section, division, confidence]) => ({ slug, section, division, confidence }),
);

export const CROSSWALK_BY_SLUG: Map<string, NicCrosswalkEntry> = new Map(
  SUBINDUSTRY_NIC_CROSSWALK.map((e) => [e.slug, e]),
);
