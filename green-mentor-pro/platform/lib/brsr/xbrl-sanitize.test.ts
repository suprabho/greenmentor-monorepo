import { describe, expect, it } from "vitest";
import { decodeXmlEntities, extractMarketsServed } from "./xbrl";

/**
 * Guards the scrub of characters Postgres cannot store. LICI 2021-22 carried a
 * raw NUL in its customer-types brief, which made PostgREST reject the entire
 * filing with "unsupported Unicode escape sequence" -- so one bad glyph in a
 * single narrative field cost the whole row.
 */
const NUL = "\u0000";

describe("decodeXmlEntities -- Postgres-unsafe characters", () => {
  it("drops a raw NUL", () => {
    expect(decodeXmlEntities(`family${NUL}s future`)).toBe("familys future");
  });

  it("drops a NUL that entity decoding itself produces", () => {
    // &#0; survives the entity pass, so the scrub has to run after it.
    expect(decodeXmlEntities("a&#0;b")).toBe("ab");
    expect(decodeXmlEntities("a&#x0;b")).toBe("ab");
  });

  it("drops unpaired surrogates but keeps valid pairs", () => {
    expect(decodeXmlEntities("a\uD800b")).toBe("ab"); // lone high surrogate
    expect(decodeXmlEntities("a\uDC00b")).toBe("ab"); // lone low surrogate
    expect(decodeXmlEntities("a\u{1F600}b")).toBe("a\u{1F600}b"); // valid pair survives
  });

  it("keeps tab, newline and carriage return", () => {
    expect(decodeXmlEntities("a\tb\nc\rd")).toBe("a\tb\nc\rd");
  });

  it("keeps ordinary text and still decodes entities", () => {
    expect(decodeXmlEntities("R&amp;D &lt;5%&gt; &quot;x&quot;")).toBe('R&D <5%> "x"');
    expect(decodeXmlEntities("&#8217;")).toBe("\u2019");
  });
});

describe("extractMarketsServed -- narrative field is storable", () => {
  it("strips a NUL out of the customer-types brief", () => {
    const xml = `<?xml version="1.0"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="http://sebi.gov.in/xbrl/in-capmkt">
  <xbrli:context id="DCYMain">
    <xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
  </xbrli:context>
  <in-capmkt:ABriefOnTypesOfCustomersExplanatoryTextBlock contextRef="DCYMain">Serving a family${NUL}s needs</in-capmkt:ABriefOnTypesOfCustomersExplanatoryTextBlock>
</xbrli:xbrl>`;
    const m = extractMarketsServed(xml);
    expect(m.customerTypes).toBe("Serving a familys needs");
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(m.customerTypes!)).toBe(false);
  });
});
