/**
 * Fixture story: newsletter-issue-38.html ("A Wake-Up Call for Indian
 * Business") hand-ported to the vismay story format. Used by the CE preview
 * page and the platform demo route as the M1 fidelity benchmark against the
 * original HTML issue.
 */

export const ISSUE38_SLUG = 'fixture-issue-38'

export const issue38Markdown = `---
title: A Wake-Up Call for Indian Business
subtitle: India's 2026 EPI ranking has reopened the methodology debate — but for businesses, the real story is how fast environmental risk is becoming business risk.
byline: Sustainability Brief
date: 2026-08-07
format: deck
vertical: greenmentor
status: published
---

## Opening

## Standfirst

## Where India Stands

The 2026 Environmental Performance Index scores countries on environmental health, ecosystem vitality and climate resilience. India's result reflects persistent structural challenges — but the underlying issues, not the rank itself, are what should shape corporate planning.

## The Headline Numbers

## Environmental Risk Is Now Business Risk

Six pressures are converging on Indian organisations at once — regulatory, physical and reputational. Three of the sharpest are already reshaping how boards price environmental exposure.

## Three Converging Pressures

## Setting Sustainability Goals

Sustainability doesn't start with a net-zero commitment. It starts with understanding your business.

## The Six-Step Path

## Vague vs SMART

## Pull Quote

## Practitioner Summary

## Audience

## Closing
`

export const issue38Config = {
  defaults: {
    scroll: { mode: 'snap' },
  },
  sections: [
    {
      id: 'opening',
      text: 'Opening',
      background: [{ type: 'gm:surface', tone: 'dark' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:hero',
          variant: 'split',
          brandLine: 'Sustainability Brief · ESG & Strategy',
          title: 'A Wake-Up Call *for Indian Business*',
          subtitle:
            "India's 2026 Environmental Performance Index ranking has reopened the debate on methodology — but for businesses, the real story is how fast environmental risk is becoming business risk.",
          tags: ['EPI 2026', 'ESG Strategy', 'BRSR', 'Climate Risk'],
          issueLabel: 'Issue',
          issueNumber: '38',
          issueDate: 'August 7, 2026',
        },
      ] } },
    },
    {
      id: 'standfirst',
      text: 'Standfirst',
      background: [{ type: 'gm:surface', tone: 'off' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:standfirst',
          text: "India ranked 176th of 177 countries in the 2026 Environmental Performance Index. The government disputes the methodology. Businesses don't have that luxury — the risks the report names are already showing up on their balance sheets.",
        },
      ] } },
    },
    {
      id: 'where-india-stands',
      text: 'Where India Stands',
      background: [{ type: 'gm:surface', tone: 'light' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:prose',
          eyebrow: 'The Headline Numbers',
          title: 'Where India Stands',
        },
      ] } },
    },
    {
      id: 'headline-numbers',
      text: 'The Headline Numbers',
      background: [{ type: 'gm:surface', tone: 'tint' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:statGrid',
          eyebrow: 'By the Numbers',
          items: [
            {
              value: '176',
              unit: '/177',
              label: 'Global EPI Rank',
              note: 'Second-lowest ranking globally, driven by air quality, biodiversity loss and resource degradation.',
              sourceTag: 'EPI 2026',
            },
            {
              value: '22.46',
              unit: '/100',
              label: 'EPI Score',
              note: 'Reflects gaps in environmental health, ecosystem protection and climate resilience metrics.',
              sourceTag: 'EPI 2026',
            },
          ],
        },
      ] } },
    },
    {
      id: 'risk-is-business-risk',
      text: 'Environmental Risk Is Now Business Risk',
      background: [{ type: 'gm:surface', tone: 'light' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:prose',
          eyebrow: 'Why This Matters for Business',
          title: 'Environmental Risk Is Now *Business Risk*',
        },
      ] } },
    },
    {
      id: 'three-pressures',
      text: 'Three Converging Pressures',
      background: [{ type: 'gm:surface', tone: 'tint' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:explainerGrid',
          eyebrow: 'Pressure Map',
          columns: 3,
          activeIndex: 0,
          cards: [
            {
              label: 'Regulatory',
              description:
                'BRSR reporting requirements and rising investor scrutiny around ESG performance are no longer optional line items.',
            },
            {
              label: 'Operational',
              description:
                'Supply chain disruption from climate events, plus higher energy and resource costs, hit margins directly.',
            },
            {
              label: 'Reputational',
              description:
                'Customer preference for responsible businesses and difficulty attracting sustainability-minded talent are now competitive factors.',
            },
          ],
        },
      ] } },
    },
    {
      id: 'setting-goals',
      text: 'Setting Sustainability Goals',
      background: [{ type: 'gm:surface', tone: 'light' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:prose',
          eyebrow: 'Getting Started',
          title: 'Setting Sustainability Goals: *Where to Begin*',
        },
      ] } },
    },
    {
      id: 'six-steps',
      text: 'The Six-Step Path',
      background: [{ type: 'gm:surface', tone: 'tint' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:steps',
          eyebrow: 'The Playbook',
          variant: 'list',
          steps: [
            {
              title: 'Understand your environmental footprint',
              body: 'Establish a baseline across energy, Scope 1/2/3 emissions, water, waste, air emissions and resource use. What gets measured gets managed.',
            },
            {
              title: 'Identify your material issues',
              body: 'Run a materiality assessment against business risk, stakeholder expectations, regulation and sector-specific impact — priorities differ by industry.',
            },
            {
              title: 'Align goals with business strategy',
              body: 'Sustainability should drive efficiency, cost savings, brand value and innovation — not sit as a separate initiative.',
            },
            {
              title: 'Set SMART sustainability goals',
              body: 'Specific, measurable, achievable, relevant, time-bound — see the example for what this looks like in practice.',
            },
            {
              title: 'Build an implementation roadmap',
              body: 'Assign ownership across departments, not just the ESG team — with clear timelines, investment and KPIs.',
            },
            {
              title: 'Track, report and improve',
              body: 'Align reporting with BRSR, GRI, IFRS Sustainability Disclosure Standards or the GHG Protocol, and treat it as continuous improvement.',
            },
          ],
        },
      ] } },
    },
    {
      id: 'vague-vs-smart',
      text: 'Vague vs SMART',
      background: [{ type: 'gm:surface', tone: 'light' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:callout',
          title: 'Vague vs. SMART',
          badge: 'Example',
          items: [
            '✕ Vague: "Reduce emissions."',
            '✓ SMART: "Reduce Scope 1 and Scope 2 emissions by 30% by 2030 from a 2025 baseline."',
          ],
        },
      ] } },
    },
    {
      id: 'pull-quote',
      text: 'Pull Quote',
      background: [{ type: 'gm:surface', tone: 'green' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:pullquote',
          text: "India's environmental challenges cannot be addressed by government action alone. Businesses have a critical role to play in accelerating the country's transition to a more sustainable economy.",
          attribution: 'Sustainability Brief, Issue 38',
        },
      ] } },
    },
    {
      id: 'takeaways',
      text: 'Practitioner Summary',
      background: [{ type: 'gm:surface', tone: 'dark' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:takeaways',
          eyebrow: 'Practitioner Summary',
          title: 'Five Things to Take Back *to Your Desk*',
          items: [
            {
              lead: "The rank is a distraction; the risks aren't.",
              body: 'Debate the methodology if you like — air pollution, water stress and biodiversity loss are still showing up in your supply chain.',
            },
            {
              lead: 'Start with a baseline, not a pledge.',
              body: 'Net-zero targets mean little without measured energy, emissions, water and waste data underneath them.',
            },
            {
              lead: 'Materiality differs by sector.',
              body: "A manufacturer's priorities (emissions, waste) aren't a tech company's priorities (renewable electricity, supply chain).",
            },
            {
              lead: 'Make targets SMART.',
              body: '"Reduce emissions" is a wish. "30% cut in Scope 1 & 2 by 2030 from a 2025 baseline" is a plan.',
            },
            {
              lead: 'Spread ownership beyond the ESG team.',
              body: 'Goals without cross-department accountability stay aspirational.',
            },
          ],
        },
      ] } },
    },
    {
      id: 'audience',
      text: 'Audience',
      background: [{ type: 'gm:surface', tone: 'pale' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:audienceStrip',
          label: 'Resonates with',
          chips: [
            'ESG & Sustainability Leads',
            'CFOs & Risk Officers',
            'Operations & Supply Chain',
            'Founders & CXOs',
          ],
        },
      ] } },
    },
    {
      id: 'closing',
      text: 'Closing',
      background: [{ type: 'gm:surface', tone: 'dark' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:footer',
          logo: 'Sustainability Brief',
          tagline: 'Business & Climate · Weekly Edition',
          columns: [
            {
              label: 'Publication',
              body: 'A weekly briefing connecting environmental data and policy shifts to what Indian organisations should actually do about them.',
            },
            {
              label: 'Next Issue',
              body: 'Inside BRSR Core: what the assurance requirements mean for mid-cap companies in FY27.',
            },
            {
              label: 'Standards Referenced',
              body: 'BRSR · GRI · IFRS S1/S2 · GHG Protocol',
            },
          ],
          copyright: '© 2026 Sustainability Brief · All rights reserved',
        },
      ] } },
    },
  ],
}

export const issue38ConfigJson = JSON.stringify(issue38Config, null, 2)
