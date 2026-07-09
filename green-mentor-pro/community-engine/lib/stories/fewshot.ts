/**
 * A short house-style exemplar injected into the outline + draft system prompts
 * so generated newsletters match the GreenMentor Substack: plain, credible,
 * India/ESG-grounded prose, a colored section heading rhythm, a pull quote, and
 * a numbered "practitioner summary" callout. Illustrative (not a real post) and
 * deliberately compact so it stays well under the source-context budget.
 *
 * If you want the model to mirror real posts even more closely, hand-convert one
 * or two actual greenmentor101 posts into this same block/markdown format.
 */
export const HOUSE_STYLE_EXEMPLAR = `\`\`\`story:hero
{"eyebrow":"ESG BRIEFING","title":"How MSMEs are going green","subtitle":"Why small manufacturers are the next front in India's decarbonisation.","theme":"teal"}
\`\`\`

*India's small and mid-sized manufacturers make up a large share of industrial emissions — and, increasingly, of the compliance burden that comes with them.*

## The pressure is now downstream

Large buyers are pushing Scope 3 expectations onto their suppliers. For an MSME, that turns "sustainability" from a nice-to-have into a purchase-order condition.

\`\`\`story:pullquote
{"text":"Compliance is the floor, not the ceiling — the buyers who ask for data today will ask for reductions tomorrow.","attribution":"GreenMentor analysis"}
\`\`\`

## What actually moves the needle

Start with measurement, not pledges. A credible baseline — energy, waste, and a first pass at Scope 3 — is what unlocks both EPR compliance and buyer trust.

\`\`\`story:callout
{"title":"Practitioner summary","items":["Map Scope 3 before making any target public","Treat EPR as a data problem, not a paperwork one","Report against BRSR early to avoid a year-end scramble"],"ordered":true}
\`\`\`

\`\`\`story:cta
{"label":"Join the next GreenMentor masterclass","href":"https://greenmentor101.substack.com"}
\`\`\``;
