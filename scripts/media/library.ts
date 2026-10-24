// The demo library every clip shows: notebooks, coloured tags and notes in all five statuses.
// Everything here is invented. `{{note:key}}` in a body becomes a link to that note.

export type TagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray'
export type Status = 'none' | 'active' | 'on_hold' | 'completed' | 'dropped'

export interface DemoBook {
  key: string
  name: string
  parent?: string
  icon: string
  color: TagColor
}

export interface DemoTag {
  name: string
  color: TagColor
}

export interface DemoNote {
  key: string
  title: string
  book?: string
  status: Status
  pinned?: boolean
  tags: string[]
  /** Minutes before the capture. */
  updated: number
  created: number
  body: string
  /** Earlier bodies, oldest first, each with its minutes before the capture: the note's versions. */
  history?: { body: string; at: number }[]
}

export const BOOKS: DemoBook[] = [
  { key: 'projects', name: 'Projects', icon: 'briefcase', color: 'blue' },
  { key: 'launch', name: 'Spring launch', parent: 'projects', icon: 'megaphone', color: 'orange' },
  { key: 'studio', name: 'Home studio', parent: 'projects', icon: 'headphones', color: 'purple' },
  { key: 'reading', name: 'Reading', icon: 'books.vertical', color: 'green' },
  { key: 'journal', name: 'Journal', icon: 'pencil.line', color: 'yellow' },
  { key: 'kitchen', name: 'Kitchen', icon: 'fork.knife', color: 'red' },
  { key: 'meetings', name: 'Meetings', icon: 'person.2', color: 'pink' },
]

export const TAGS: DemoTag[] = [
  { name: 'planning', color: 'blue' },
  { name: 'design', color: 'pink' },
  { name: 'research', color: 'purple' },
  { name: 'follow-up', color: 'orange' },
  { name: 'personal', color: 'green' },
  { name: 'engineering', color: 'gray' },
]

const H = 60
const D = 24 * H

/** The notebook templates are filed in (core/templates.ts). */
export const TEMPLATES = 'templates'

export const BACKOFF_BODY = `When a sync request fails, the client waits, then tries again. Each wait doubles, with a little jitter so clients never retry in step.

## The delay

$$
d_n = \\min\\left(d_{\\max},\\; d_0 \\cdot 2^{n}\\right) + \\text{jitter}
$$

## In code

\`\`\`ts title="backoff.ts"
export function nextDelay(attempt: number): number {
  const wait = Math.min(MAX_DELAY, BASE_DELAY * 2 ** attempt)
  return wait + Math.random() * BASE_DELAY
}
\`\`\`

## States

\`\`\`mermaid
flowchart LR
  Send -->|ok| Done
  Send -->|fails| Wait
  Wait -->|retry| Send
\`\`\`
`

export const NOTES: DemoNote[] = [
  {
    key: 'launchPlan',
    title: 'Spring launch plan',
    book: 'launch',
    status: 'active',
    pinned: true,
    tags: ['planning', 'design'],
    updated: 6,
    created: 12 * D,
    body: `A calm, focused release: one clear story, three features, and no surprises on launch day.

## Goals

- Ship **version 2.0** to everyone on the waitlist by *14 April*
- Reach 5,000 downloads in the first two weeks
- Keep support replies under one working day

## Timeline

| Week | Focus | Team |
| :--- | :--- | :--- |
| 1 | Freeze features, write the release notes | Product |
| 2 | Private beta with 200 testers | Engineering |
| 3 | Landing page and press kit | Design |
| 4 | Launch, then listen | Everyone |

## Before the freeze

- [x] Final pass on the onboarding copy
- [x] Record the feature videos
- [ ] Review crash reports from the beta
- [ ] Prepare the press kit
- [ ] Schedule the newsletter

> [!TIP]
> Keep the announcement short: one sentence for what it is, one for why it matters.
`,
  },
  {
    key: 'backoff',
    title: 'Retry with backoff',
    book: 'projects',
    status: 'active',
    tags: ['engineering', 'research'],
    updated: 52,
    created: 3 * D,
    body: BACKOFF_BODY,
  },
  {
    key: 'designSync',
    title: 'Design sync, 21 October',
    book: 'meetings',
    status: 'completed',
    tags: ['design', 'follow-up'],
    updated: 2 * H + 10,
    created: 2 * D,
    body: `**Present:** design, product, engineering

## Decisions

- The onboarding drops from five screens to three
- Status colours stay as they are; the contrast check passed
- Dark mode screenshots go on the landing page too

## Open questions

- Do we show keyboard shortcuts in the first-run tour?
- How much of the [launch plan]({{note:launchPlan}}) goes in the press kit?

## Follow-ups

- [ ] Export the new icons at every size
- [x] Share the colour audit
- [ ] Draft the release notes intro
`,
  },
  {
    key: 'week43',
    title: 'Weekly review, week 43',
    book: 'journal',
    status: 'active',
    tags: ['personal', 'follow-up'],
    updated: 18,
    created: 1 * D,
    body: `## What went well

- Beta build went out on Tuesday, no blocking bugs so far
- Two long walks, one early night

## What got in the way

- Too many small meetings on Wednesday
- The pricing page is still waiting on numbers

## Next week

- [ ] Finish the release checklist
- [ ] Read two chapters from the reading list
- [ ] Bake the focaccia for Saturday
`,
  },
  {
    key: 'releaseChecklist',
    title: 'Release checklist',
    book: 'launch',
    status: 'active',
    tags: ['planning', 'engineering'],
    updated: 1 * D + 3 * H,
    created: 9 * D,
    body: `Everything that has to be true before we press the button for the launch.

- [x] Version number bumped everywhere
- [x] Release notes reviewed
- [x] Crash reporting checked on a clean install
- [ ] Download page points at the new build
- [ ] Rollback plan written down
- [ ] Support macros updated
`,
  },
  {
    key: 'landingCopy',
    title: 'Landing page copy',
    book: 'launch',
    status: 'on_hold',
    tags: ['design'],
    updated: 22 * H,
    created: 10 * D,
    history: [
      {
        at: 5 * D + 20 * H,
        body: `## Headline options

1. Write it down. Find it again.
2. Your notes, on your machine.

*First draft.*
`,
      },
      {
        at: 2 * D + 22 * H,
        body: `## Headline options

1. Write it down. Find it again.
2. Notes that stay yours.

## Supporting line

Plain Markdown and fast search.
`,
      },
    ],
    body: `## Headline options

1. Write it down. Find it again.
2. Notes that stay yours.
3. A quiet place for your thinking.

## Supporting line

Plain Markdown, fast search and a library that lives on your own machine.

*On hold until the screenshots are final.*
`,
  },
  {
    key: 'planningKickoff',
    title: 'Q4 planning kickoff',
    book: 'meetings',
    status: 'active',
    tags: ['planning', 'follow-up'],
    updated: 2 * D,
    created: 4 * D,
    body: `## Themes for the quarter

1. **Launch** the spring release on time
2. **Quality**: halve the open bug count
3. **Listening**: ten customer calls a month

## Next steps

- [ ] Each team drafts three goals by Friday
- [ ] Review the drafts together next Tuesday
`,
  },
  {
    key: 'readingCalm',
    title: 'Notes on calm software',
    book: 'reading',
    status: 'completed',
    tags: ['research'],
    updated: 3 * D,
    created: 20 * D,
    body: `An essay collection about tools that respect attention.

> The best tool disappears while you use it and is still there when you come back.

## Ideas worth keeping

- Notifications should be earned, not assumed
- A good default beats a settings page
- Local first means the tool works on a train with no signal

## To try

- [x] Turn off badges for a week
- [ ] Write the morning notes before opening email
`,
  },
  {
    key: 'readingList',
    title: 'Reading list',
    book: 'reading',
    status: 'active',
    tags: ['personal'],
    updated: 4 * D,
    created: 40 * D,
    body: `## Now

- [ ] A field guide to garden birds
- [ ] Essays on slow travel

## Next

- [ ] An illustrated history of typography
- [ ] Cooking with fire, chapter by chapter

## Finished

- [x] Notes on calm software
- [x] A short book about long walks
`,
  },
  {
    key: 'focaccia',
    title: 'Rosemary focaccia',
    book: 'kitchen',
    status: 'completed',
    tags: ['personal'],
    updated: 5 * D,
    created: 30 * D,
    body: `| Ingredient | Amount |
| :--- | ---: |
| Bread flour | 500 g |
| Water | 400 g |
| Olive oil | 60 ml |

Serves 6. Start the evening before. Salt, yeast and rosemary to taste.

1. Mix everything except the oil and rest for 30 minutes.
2. Fold four times, 20 minutes apart, then chill overnight.
3. Oil the tray, stretch the dough, dimple it and add rosemary.
4. Bake at 230 C for 22 minutes, until deep golden.
`,
  },
  {
    key: 'week42',
    title: 'Weekly review, week 42',
    book: 'journal',
    status: 'completed',
    tags: ['personal'],
    updated: 6 * D,
    created: 8 * D,
    body: `## What went well

- Wrote the first draft of the [launch plan]({{note:launchPlan}})
- Fixed the sync retry bug

## Next week

- [x] Send the beta invites
- [x] Book the design sync
`,
  },
  {
    key: 'studioAcoustics',
    title: 'Studio acoustics',
    book: 'studio',
    status: 'on_hold',
    tags: ['research', 'personal'],
    updated: 8 * D,
    created: 25 * D,
    body: `The small room rings at around 180 Hz. Two panels behind the desk and a rug should take care of most of it.

- [ ] Measure the room again with the panels up
- [ ] Try the bookshelf as a diffuser
`,
  },
  {
    key: 'micShortlist',
    title: 'Microphone shortlist',
    book: 'studio',
    status: 'completed',
    tags: ['personal'],
    updated: 9 * D,
    created: 26 * D,
    body: `| Type | Good for | Price |
| :--- | :--- | ---: |
| Dynamic | Voice in an untreated room | 120 |
| Condenser | Acoustic guitar | 240 |
| Ribbon | Warm vocals | 380 |

Picked the dynamic one: it forgives the room.
`,
  },
  {
    key: 'misoRamen',
    title: 'Weeknight miso ramen',
    book: 'kitchen',
    status: 'none',
    tags: [],
    updated: 11 * D,
    created: 11 * D,
    body: `Ready in 25 minutes.

- 2 tbsp white miso
- 1 tbsp sesame paste
- 750 ml stock
- Noodles, greens, a soft egg
`,
  },
  {
    key: 'morningPages',
    title: 'Morning pages',
    book: 'journal',
    status: 'none',
    tags: ['personal'],
    updated: 13 * D,
    created: 60 * D,
    body: `Three pages, longhand, before anything else. Not for reading back.
`,
  },
  {
    key: 'pricing',
    title: 'Pricing experiments',
    book: 'launch',
    status: 'dropped',
    tags: ['research'],
    updated: 15 * D,
    created: 35 * D,
    body: `Dropped: one price for everyone is simpler to explain.

- Tested three tiers with 40 beta users
- Most picked the middle tier without reading the table
`,
  },
  {
    key: 'newsletter',
    title: 'Newsletter ideas',
    status: 'dropped',
    tags: [],
    updated: 20 * D,
    created: 50 * D,
    body: `- A monthly note about how the product is made
- Behind the scenes of the icon redesign
`,
  },
  {
    key: 'standupTemplate',
    title: 'Daily standup',
    book: TEMPLATES,
    status: 'none',
    tags: [],
    updated: 7 * D,
    created: 45 * D,
    body: `---
title: Standup, {{date:dddd D MMMM}}
notebook: Meetings
tags: [follow-up]
status: active
---
Started at {{time}}

## Yesterday

-

## Today

-

## Blockers

- None
`,
  },
  {
    key: 'meetingTemplate',
    title: 'Meeting notes',
    book: TEMPLATES,
    status: 'none',
    tags: [],
    updated: 12 * D,
    created: 45 * D,
    body: `---
title: Meeting, {{date:D MMMM}}
notebook: Meetings
---
**Present:**

## Decisions

-

## Follow-ups

- [ ]
`,
  },
  {
    key: 'readingTemplate',
    title: 'Book notes',
    book: TEMPLATES,
    status: 'none',
    tags: [],
    updated: 30 * D,
    created: 45 * D,
    body: `---
notebook: Reading
tags: [research]
status: active
---
Started on {{date}}

## Ideas worth keeping

-
`,
  },
]
