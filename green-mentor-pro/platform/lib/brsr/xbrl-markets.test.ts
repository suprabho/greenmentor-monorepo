import { describe, expect, it } from "vitest";
import { extractMarketsServed } from "./xbrl";

/**
 * Fixtures cover the three shapes the national/international split takes in the
 * wild: qualified tag names (NumberOfNationalPlant), a location dimension on a
 * bare count (NumberOfPlants in a National/International member context), and —
 * the form NSE filers actually use — a fully generic NumberOfLocations carrying
 * both the scope and the plant/office axis as members, alongside a LocationMember
 * row holding the Q20 all-locations total.
 */

const wrap = (body: string) => `<?xml version="1.0"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="http://sebi.gov.in/xbrl/in-capmkt">
  <xbrli:context id="DCYMain">
    <xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
  </xbrli:context>
  <xbrli:context id="DPYMain">
    <xbrli:period><xbrli:startDate>2024-04-01</xbrli:startDate><xbrli:endDate>2025-03-31</xbrli:endDate></xbrli:period>
  </xbrli:context>
  <xbrli:context id="D_National">
    <xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
    <xbrli:scenario><xbrldi:explicitMember xmlns:xbrldi="http://xbrl.org/2006/xbrldi" dimension="in-capmkt:LocationAxis">in-capmkt:NationalMember</xbrldi:explicitMember></xbrli:scenario>
  </xbrli:context>
  <xbrli:context id="D_International">
    <xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
    <xbrli:scenario><xbrldi:explicitMember xmlns:xbrldi="http://xbrl.org/2006/xbrldi" dimension="in-capmkt:LocationAxis">in-capmkt:InternationalMember</xbrldi:explicitMember></xbrli:scenario>
  </xbrli:context>
  ${dualMemberContexts}
  ${body}
</xbrli:xbrl>`;

/**
 * Contexts dimensioned on BOTH the location scope and the plant/office axis, as
 * NSE filings emit them. D_Nat_Total carries only LocationMember — the Q20 total,
 * which must not be counted as either a plant or an office.
 */
const dualMemberContexts = ["Nat_Plant", "Nat_Office", "Int_Plant", "Int_Office", "Nat_Total", "Int_Total"]
  .map((id) => {
    const scope = id.startsWith("Nat") ? "NationalMember" : "InternationalMember";
    const kind = id.endsWith("Plant") ? "PlantMember" : id.endsWith("Office") ? "OfficeMember" : "LocationMember";
    return `<xbrli:context id="D_${id}">
    <xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
    <xbrli:scenario>
      <xbrldi:explicitMember xmlns:xbrldi="http://xbrl.org/2006/xbrldi" dimension="in-capmkt:LocationAxis">in-capmkt:${scope}</xbrldi:explicitMember>
      <xbrldi:explicitMember xmlns:xbrldi="http://xbrl.org/2006/xbrldi" dimension="in-capmkt:TypeOfLocationAxis">in-capmkt:${kind}</xbrldi:explicitMember>
    </xbrli:scenario>
  </xbrli:context>`;
  })
  .join("\n  ");

describe("extractMarketsServed", () => {
  it("extracts qualified-tag-name filings (NumberOfNationalPlant style)", () => {
    const m = extractMarketsServed(
      wrap(`
        <in-capmkt:NumberOfNationalPlant contextRef="DCYMain">12</in-capmkt:NumberOfNationalPlant>
        <in-capmkt:NumberOfNationalOffice contextRef="DCYMain">34</in-capmkt:NumberOfNationalOffice>
        <in-capmkt:NumberOfInternationalPlant contextRef="DCYMain">2</in-capmkt:NumberOfInternationalPlant>
        <in-capmkt:NumberOfInternationalOffice contextRef="DCYMain">5</in-capmkt:NumberOfInternationalOffice>
        <in-capmkt:NumberOfStates contextRef="DCYMain">21</in-capmkt:NumberOfStates>
        <in-capmkt:NumberOfCountries contextRef="DCYMain">17</in-capmkt:NumberOfCountries>
        <in-capmkt:ContributionOfExportsAsAPercentageOfTheTotalTurnoverOfTheEntity contextRef="DCYMain">38.5</in-capmkt:ContributionOfExportsAsAPercentageOfTheTotalTurnoverOfTheEntity>
      `),
    );
    expect(m.plantsNational).toBe(12);
    expect(m.officesNational).toBe(34);
    expect(m.plantsInternational).toBe(2);
    expect(m.officesInternational).toBe(5);
    expect(m.statesServed).toBe(21);
    expect(m.countriesServed).toBe(17);
    expect(m.exportsPctTurnover).toBe(38.5);
    expect(m.matchedTags.plantsNational).toBe("NumberOfNationalPlant");
  });

  it("extracts dimensional filings (bare count + National/International member)", () => {
    const m = extractMarketsServed(
      wrap(`
        <in-capmkt:NumberOfPlants contextRef="D_National">8</in-capmkt:NumberOfPlants>
        <in-capmkt:NumberOfPlants contextRef="D_International">1</in-capmkt:NumberOfPlants>
        <in-capmkt:NumberOfOffices contextRef="D_National">15</in-capmkt:NumberOfOffices>
      `),
    );
    expect(m.plantsNational).toBe(8);
    expect(m.plantsInternational).toBe(1);
    expect(m.officesNational).toBe(15);
    expect(m.officesInternational).toBeNull();
  });

  // Regression: the plant/office kind lives only in the context members here, so
  // a tag-name-only match leaves all four counts null on every real NSE filing.
  it("extracts generic NumberOfLocations dimensioned on both scope and kind", () => {
    const m = extractMarketsServed(
      wrap(`
        <in-capmkt:NumberOfLocations contextRef="D_Nat_Plant">6</in-capmkt:NumberOfLocations>
        <in-capmkt:NumberOfLocations contextRef="D_Nat_Office">31</in-capmkt:NumberOfLocations>
        <in-capmkt:NumberOfLocations contextRef="D_Int_Plant">2</in-capmkt:NumberOfLocations>
        <in-capmkt:NumberOfLocations contextRef="D_Int_Office">4</in-capmkt:NumberOfLocations>
        <in-capmkt:NumberOfLocations contextRef="D_Nat_Total">37</in-capmkt:NumberOfLocations>
        <in-capmkt:NumberOfLocations contextRef="D_Int_Total">6</in-capmkt:NumberOfLocations>
      `),
    );
    expect(m.plantsNational).toBe(6);
    expect(m.officesNational).toBe(31);
    expect(m.plantsInternational).toBe(2);
    expect(m.officesInternational).toBe(4);
    expect(m.matchedTags.plantsNational).toBe("NumberOfLocations");
    // the LocationMember totals stay out of both fields — plants + offices == total
    expect(m.plantsNational! + m.officesNational!).toBe(37);
    expect(m.plantsInternational! + m.officesInternational!).toBe(6);
  });

  it("prefers the current-year context over the prior year", () => {
    const m = extractMarketsServed(
      wrap(`
        <in-capmkt:NumberOfNationalPlant contextRef="DPYMain">9</in-capmkt:NumberOfNationalPlant>
        <in-capmkt:NumberOfNationalPlant contextRef="DCYMain">11</in-capmkt:NumberOfNationalPlant>
      `),
    );
    expect(m.plantsNational).toBe(11);
  });

  it("drops out-of-range export percentages and null sentinels", () => {
    const m = extractMarketsServed(
      wrap(`
        <in-capmkt:ContributionOfExportsAsAPercentageOfTheTotalTurnoverOfTheEntity contextRef="DCYMain">4500</in-capmkt:ContributionOfExportsAsAPercentageOfTheTotalTurnoverOfTheEntity>
        <in-capmkt:NumberOfStates contextRef="DCYMain">-</in-capmkt:NumberOfStates>
      `),
    );
    expect(m.exportsPctTurnover).toBeNull();
    expect(m.statesServed).toBeNull();
  });

  it("pulls the customer-types brief out of a TextBlock, stripping markup", () => {
    const m = extractMarketsServed(
      wrap(`
        <in-capmkt:ABriefOnTypesOfCustomersTextBlock contextRef="DCYMain">&lt;p&gt;B2B cement buyers &amp;amp; institutional dealers&lt;/p&gt;</in-capmkt:ABriefOnTypesOfCustomersTextBlock>
      `),
    );
    expect(m.customerTypes).toContain("B2B cement buyers");
    expect(m.customerTypes).not.toContain("<p>");
  });

  it("returns all-null for filings without Section A markets facts", () => {
    const m = extractMarketsServed(wrap(""));
    expect(Object.keys(m.matchedTags)).toHaveLength(0);
    expect(m.plantsNational).toBeNull();
    expect(m.customerTypes).toBeNull();
  });
});
