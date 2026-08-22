import { frontmatter, gmSection, closingSection, GM_STORY_DEFAULTS } from './spine'

export { closingSection } from './spine'

/**
 * Starter story templates — one per corpus family. Each yields the document
 * pair a CE draft stores: `bodyMarkdown` (frontmatter + anchored headings)
 * and `configJson` (defaults + spine sections in regions form), ready for
 * the editor and per-section compose to fill in.
 */
export interface GmStoryTemplate {
  id: string
  label: string
  description: string
  build: (input: { title: string }) => { bodyMarkdown: string; configJson: string }
}

const PLACEHOLDER = {
  standfirst:
    'One italic-serif sentence that frames the issue: what happened, and why a practitioner should care.',
  prose: 'Replace with the section argument (2–4 short paragraphs in the markdown body).',
  quote: 'A single load-bearing quotation — every issue carries exactly one.',
  chips: ['ESG & Sustainability Leads', 'CFOs & Risk Officers', 'Operations & Supply Chain', 'Founders & CXOs'],
  takeaways: [
    { lead: 'First takeaway.', body: 'One-sentence elaboration.' },
    { lead: 'Second takeaway.', body: 'One-sentence elaboration.' },
    { lead: 'Third takeaway.', body: 'One-sentence elaboration.' },
  ],
}

function buildDoc(input: {
  title: string
  headings: string[]
  sections: ReturnType<typeof gmSection>[]
}): { bodyMarkdown: string; configJson: string } {
  const bodyMarkdown = [
    frontmatter({ title: input.title, subtitle: PLACEHOLDER.standfirst }),
    '',
    ...input.headings.flatMap((h) => [`## ${h}`, '']),
  ].join('\n')
  const configJson = JSON.stringify(
    { defaults: GM_STORY_DEFAULTS, sections: input.sections },
    null,
    2
  )
  return { bodyMarkdown, configJson }
}

/** Analytical Briefing — the default family (~32 of 34 corpus issues). */
export const analyticalBriefing: GmStoryTemplate = {
  id: 'analytical-briefing',
  label: 'Analytical Briefing',
  description:
    'The default issue: hero → standfirst → argument sections with a stat grid and explainer → pullquote → takeaways → audience → footer.',
  build: ({ title }) =>
    buildDoc({
      title,
      headings: [
        'Opening',
        'Standfirst',
        'The Setup',
        'By the Numbers',
        'The Argument',
        'The Framework',
        'Pull Quote',
        'Practitioner Summary',
        'Audience',
        'Closing',
      ],
      sections: [
        gmSection('opening', 'Opening', 'dark', [
          { type: 'gm:hero', variant: 'split', title, tags: [] },
        ]),
        gmSection('standfirst', 'Standfirst', 'off', [
          { type: 'gm:standfirst', text: PLACEHOLDER.standfirst },
        ]),
        gmSection('setup', 'The Setup', 'light', [
          { type: 'gm:prose', eyebrow: 'The Setup', title: 'What happened' },
        ]),
        gmSection('numbers', 'By the Numbers', 'tint', [
          {
            type: 'gm:statGrid',
            eyebrow: 'By the Numbers',
            items: [
              { value: '0', label: 'Headline figure', note: PLACEHOLDER.prose },
              { value: '0', label: 'Second figure', note: PLACEHOLDER.prose },
            ],
          },
        ]),
        gmSection('argument', 'The Argument', 'light', [
          { type: 'gm:prose', eyebrow: 'Why It Matters', title: 'The argument' },
        ]),
        gmSection('framework', 'The Framework', 'tint', [
          {
            type: 'gm:explainerGrid',
            eyebrow: 'The Framework',
            cards: [
              { label: 'First', description: PLACEHOLDER.prose },
              { label: 'Second', description: PLACEHOLDER.prose },
              { label: 'Third', description: PLACEHOLDER.prose },
            ],
            activeIndex: 0,
          },
        ]),
        gmSection('pull-quote', 'Pull Quote', 'green', [
          { type: 'gm:pullquote', text: PLACEHOLDER.quote },
        ]),
        gmSection('takeaways', 'Practitioner Summary', 'dark', [
          { type: 'gm:takeaways', title: 'Takeaways', items: PLACEHOLDER.takeaways },
        ]),
        gmSection('audience', 'Audience', 'pale', [
          { type: 'gm:audienceStrip', chips: PLACEHOLDER.chips },
        ]),
        closingSection(),
      ],
    }),
}

/** Case Study — analytical spine plus steps + callout proof sections. */
export const caseStudy: GmStoryTemplate = {
  id: 'case-study',
  label: 'Case Study',
  description:
    'Company/deployment story: context → numbers → how-it-was-done steps → worked example callout → pullquote → takeaways.',
  build: ({ title }) =>
    buildDoc({
      title,
      headings: [
        'Opening',
        'Standfirst',
        'The Context',
        'The Results',
        'How It Was Done',
        'Worked Example',
        'Pull Quote',
        'Practitioner Summary',
        'Audience',
        'Closing',
      ],
      sections: [
        gmSection('opening', 'Opening', 'dark', [
          { type: 'gm:hero', variant: 'editorial', title, tags: [] },
        ]),
        gmSection('standfirst', 'Standfirst', 'off', [
          { type: 'gm:standfirst', text: PLACEHOLDER.standfirst },
        ]),
        gmSection('context', 'The Context', 'light', [
          { type: 'gm:prose', eyebrow: 'The Context', title: 'Where they started' },
        ]),
        gmSection('results', 'The Results', 'tint', [
          {
            type: 'gm:statGrid',
            eyebrow: 'The Results',
            items: [
              { value: '0', label: 'Outcome metric', note: PLACEHOLDER.prose },
              { value: '0', label: 'Second metric', note: PLACEHOLDER.prose },
            ],
          },
        ]),
        gmSection('how', 'How It Was Done', 'light', [
          {
            type: 'gm:steps',
            eyebrow: 'The Playbook',
            steps: [
              { title: 'First step', body: PLACEHOLDER.prose },
              { title: 'Second step', body: PLACEHOLDER.prose },
              { title: 'Third step', body: PLACEHOLDER.prose },
            ],
          },
        ]),
        gmSection('example', 'Worked Example', 'tint', [
          { type: 'gm:callout', title: 'Worked Example', badge: 'Example', items: [PLACEHOLDER.prose] },
        ]),
        gmSection('pull-quote', 'Pull Quote', 'green', [
          { type: 'gm:pullquote', text: PLACEHOLDER.quote },
        ]),
        gmSection('takeaways', 'Practitioner Summary', 'dark', [
          { type: 'gm:takeaways', title: 'Takeaways', items: PLACEHOLDER.takeaways },
        ]),
        gmSection('audience', 'Audience', 'pale', [
          { type: 'gm:audienceStrip', chips: PLACEHOLDER.chips },
        ]),
        closingSection(),
      ],
    }),
}

/** Photo Essay — event-recap register: prose + photo sections. */
export const photoEssay: GmStoryTemplate = {
  id: 'photo-essay',
  label: 'Photo Essay',
  description:
    'Event recap: bold hero → standfirst → alternating prose and photo sections → pullquote → closing note in the footer.',
  build: ({ title }) =>
    buildDoc({
      title,
      headings: [
        'Opening',
        'Standfirst',
        'The Scene',
        'In Pictures',
        'What We Heard',
        'Pull Quote',
        'Audience',
        'Closing',
      ],
      sections: [
        gmSection('opening', 'Opening', 'green', [
          { type: 'gm:hero', variant: 'bold', title, tags: [] },
        ]),
        gmSection('standfirst', 'Standfirst', 'off', [
          { type: 'gm:standfirst', text: PLACEHOLDER.standfirst },
        ]),
        gmSection('scene', 'The Scene', 'light', [
          { type: 'gm:prose', eyebrow: 'The Scene', title: 'How it felt' },
        ]),
        gmSection('pictures', 'In Pictures', 'tint', [
          { type: 'image', src: 'assets://replace-me.jpg', caption: 'Replace with an event photo.' },
        ]),
        gmSection('heard', 'What We Heard', 'light', [
          { type: 'gm:prose', eyebrow: 'What We Heard', title: 'Voices from the room' },
        ]),
        gmSection('pull-quote', 'Pull Quote', 'green', [
          { type: 'gm:pullquote', text: PLACEHOLDER.quote },
        ]),
        gmSection('audience', 'Audience', 'pale', [
          { type: 'gm:audienceStrip', chips: PLACEHOLDER.chips },
        ]),
        closingSection({
          closingNote: { emoji: '🌱', text: 'See you at the next one.', signature: 'The GreenMentor team' },
        }),
      ],
    }),
}

/** Social Teaser — short 5-slide cut for link-out teasers. */
export const socialTeaser: GmStoryTemplate = {
  id: 'social-teaser',
  label: 'Social Teaser',
  description: 'Five-slide cut: hero → one number → one argument → pullquote → footer CTA.',
  build: ({ title }) =>
    buildDoc({
      title,
      headings: ['Opening', 'The Number', 'The Argument', 'Pull Quote', 'Closing'],
      sections: [
        gmSection('opening', 'Opening', 'dark', [
          { type: 'gm:hero', variant: 'stacked', title, tags: [] },
        ]),
        gmSection('number', 'The Number', 'tint', [
          {
            type: 'gm:statGrid',
            items: [{ value: '0', label: 'The one number that carries the story' }],
          },
        ]),
        gmSection('argument', 'The Argument', 'light', [
          { type: 'gm:prose', eyebrow: 'Why It Matters', title: 'The argument' },
        ]),
        gmSection('pull-quote', 'Pull Quote', 'green', [
          { type: 'gm:pullquote', text: PLACEHOLDER.quote },
        ]),
        closingSection(),
      ],
    }),
}

export const GM_STORY_TEMPLATES: GmStoryTemplate[] = [
  analyticalBriefing,
  caseStudy,
  photoEssay,
  socialTeaser,
]
