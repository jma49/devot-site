import type { Locator, Page } from '@playwright/test'
import type { SlotName } from '../../src/media.ts'
import type { Rect } from './frames.ts'
import { CursorScript, type Actions, type Point, type Timeline } from './timeline.ts'

/** Where the page shows a clip: the hero window, a feature's media, a wide or a narrow card. */
export type Shape = 'hero' | 'feature' | 'wide' | 'narrow'

export interface Size {
  width: number
  height: number
}

export interface PhoneCut {
  /** The part of the window phones show, in points, inside the scene's `clip`. */
  rect: Rect
  /** Pixels of the phone clip and its poster. */
  output: Size
  /**
   * Keeps the whole frame and fills the window outside `rect` with one colour, for a slot the page
   * lays out alike at every width and lets run off the screen on phones (the hero).
   */
  fill?: boolean
}

export interface Scene {
  slot: SlotName
  shape: Shape
  /** The window's size in points. */
  viewport: Size
  /** The part of the window the clip shows, in points. */
  clip: Rect
  /** Pixels of the encoded clip and poster. */
  output: Size
  /** A closer cut for phones, from the same frames, so the app stays legible on a small screen. */
  phone?: PhoneCut
  /** The app's own transitions, stepped frame by frame; off, every change lands at once. */
  motion: boolean
  /** Seconds at the end that cross-fade into the first frame. */
  fade: number
  settings?: Record<string, unknown>
  view?: Record<string, string>
  /** Brings the window to the clip's first frame. */
  prepare(page: Page): Promise<void>
  script(page: Page, actions: Actions): Promise<Timeline>
  /** Fails the capture when the window did not end up as the clip should show it. */
  check?(page: Page): Promise<void>
}

/**
 * Each shape's cut of the window in points, sized so the smallest text the app draws (10 pt) shows
 * at 9 px or more where the page is 1440 px wide and 8 px or more on a 390 px phone; clips are
 * encoded at twice these sizes. The ratios are the ones the page lays the media out at.
 */
export const CUTS = {
  feature: { clip: { width: 672, height: 448 }, phone: { width: 552, height: 368 } },
  wide: { clip: { width: 704, height: 440 }, phone: { width: 400, height: 250 } },
  narrow: { clip: { width: 400, height: 500 } },
} as const

const twice = ({ width, height }: Size): Size => ({ width: width * 2, height: height * 2 })
const cut = (x: number, y: number, size: Size): Rect => ({ x, y, ...size })

// Selectors are the ones devot's UI tests use: roles and accessible names.
const noteRows = (page: Page) => page.getByRole('listbox', { name: 'Notes' }).getByRole('option')
const noteRow = (page: Page, title: string) =>
  noteRows(page)
    .filter({ has: page.locator('.row-title', { hasText: title }) })
    .first()
const viewMode = (page: Page, name: 'Edit' | 'Split' | 'Preview') =>
  page.getByRole('group', { name: 'View mode' }).getByRole('button', { name, exact: true })
const body = (page: Page) => page.getByRole('textbox', { name: 'Note body' })
const searchField = (page: Page) => page.getByRole('searchbox', { name: 'Search notes' })
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Sidebar' })
const focusButton = (page: Page) => page.getByRole('button', { name: 'Focus Mode' })
const preview = (page: Page) => page.getByRole('article', { name: 'Preview' })
const statusButton = (page: Page) => page.getByRole('button', { name: 'Status', exact: true })
const statusOption = (page: Page, name: string) =>
  page.getByRole('listbox', { name: 'Status' }).getByRole('option', { name, exact: true })

async function box(locator: Locator): Promise<Rect> {
  await locator.waitFor({ state: 'visible' })
  const found = await locator.boundingBox()
  if (!found) throw new Error('E_MEDIA_NO_BOX')
  return found
}

/** A point inside an element: `x` and `y` are fractions of its box. */
const at =
  (locator: Locator, x = 0.5, y = 0.5) =>
  async (): Promise<Point> => {
    const b = await box(locator)
    return { x: b.x + b.width * x, y: b.y + b.height * y }
  }

/** Just past the last character of an editor line, where a click leaves the caret. */
const lineEnd = (locator: Locator) => async (): Promise<Point> => {
  await locator.waitFor({ state: 'visible' })
  return locator.evaluate((line) => {
    const range = document.createRange()
    range.selectNodeContents(line)
    const rects = [...range.getClientRects()]
    const last = rects.at(-1) ?? line.getBoundingClientRect()
    return { x: last.right + 4, y: last.top + last.height / 2 }
  })
}

async function openNote(page: Page, title: string) {
  await noteRow(page, title).click()
  await page.getByRole('textbox', { name: 'Title' }).waitFor()
}

async function setMode(page: Page, name: 'Edit' | 'Split' | 'Preview') {
  await viewMode(page, name).click()
}

async function hideSidebar(page: Page) {
  if (await sidebar(page).isVisible()) {
    await page.keyboard.press('Meta+Slash')
    await sidebar(page).waitFor({ state: 'hidden' })
  }
}

async function focusMode(page: Page) {
  await focusButton(page).click()
  await page.getByRole('listbox', { name: 'Notes' }).waitFor({ state: 'hidden' })
}

/** Every diagram drawn and every font loaded. */
async function settle(page: Page) {
  const islands = preview(page).locator('.island')
  for (let i = 0; i < (await islands.count()); i++) {
    await islands.nth(i).locator('svg').first().waitFor({ timeout: 15_000 })
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(500)
}

const WINDOW = { width: 1280, height: 800 }
/** Narrow cards show 400 points of a window more than twice as wide; Devot hides the sidebar here. */
const NARROW_WINDOW = { width: 900, height: 700 }
const HERO_REST = { x: 690, y: 520 }

const hero: Scene = {
  slot: 'hero',
  shape: 'hero',
  viewport: WINDOW,
  clip: cut(0, 0, WINDOW),
  output: { width: 2048, height: 1280 },
  // Phones show the window's left 57 % and top 84 % at most (the hero's layout, 320 to 639 px).
  phone: {
    rect: cut(0, 0, { width: 776, height: 688 }),
    output: { width: 1600, height: 1000 },
    fill: true,
  },
  motion: true,
  fade: 0.6,
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    await page.mouse.move(HERO_REST.x, HERO_REST.y)
    await settle(page)
  },
  async script(page, actions) {
    const lastTask = body(page).locator('.cm-line', { hasText: 'Bake the' })
    return new CursorScript(HERO_REST, actions)
      .wait(0.7)
      .move(at(noteRow(page, 'Weekly review, week 43'), 0.42, 0.3), 0.8)
      .wait(0.1)
      .click()
      .wait(0.35)
      .move(at(viewMode(page, 'Split')), 0.7)
      .wait(0.1)
      .click()
      .wait(0.35)
      .move(lineEnd(lastTask), 0.7)
      .wait(0.1)
      .click()
      .wait(0.15)
      .type('\nBook the train to the coast', { cps: 13 })
      .move(at(statusButton(page)), 0.7)
      .wait(0.1)
      .click()
      .wait(0.3)
      .move(at(statusOption(page, 'Completed'), 0.35), 0.45)
      .wait(0.1)
      .click()
      .wait(0.3)
      .poster()
      .wait(0.05)
      .move(at(searchField(page), 0.3), 0.75)
      .wait(0.1)
      .click()
      .wait(0.1)
      .type('launch', { cps: 9, showAfter: 0.4 })
      .move(at(noteRow(page, 'Spring launch plan'), 0.42, 0.3), 0.7)
      .wait(0.1)
      .click()
      .wait(0.3)
      .move(at(viewMode(page, 'Preview')), 0.7)
      .wait(0.1)
      .click()
      .wait(0.3)
      .move(at(page.getByRole('button', { name: 'Clear Search' })), 0.75)
      .wait(0.1)
      .click()
      .wait(0.2)
      .move(HERO_REST, 0.9)
      .wait(0.7)
      .build()
  },
  async check(page) {
    if (
      (await page.getByRole('textbox', { name: 'Title' }).inputValue()) !== 'Spring launch plan'
    ) {
      throw new Error('E_MEDIA_HERO_END the clip must end on the note it starts on')
    }
    if ((await searchField(page).inputValue()) !== '') throw new Error('E_MEDIA_HERO_END search')
  },
}

const write: Scene = {
  slot: 'write',
  shape: 'feature',
  // Devot's narrowest window, so the editor and the preview both fit the cut.
  viewport: { width: 760, height: 620 },
  clip: cut(0, 0, CUTS.feature.clip),
  output: twice(CUTS.feature.clip),
  phone: { rect: cut(0, 0, CUTS.feature.phone), output: twice(CUTS.feature.phone) },
  motion: true,
  fade: 0.5,
  async prepare(page) {
    await openNote(page, 'Retry with backoff')
    await setMode(page, 'Split')
    await focusMode(page)
    // Scrolled to the formula, as a writer would be, so the typing happens near the top.
    await body(page)
      .locator('.cm-line', { hasText: /^\$\$$/ })
      .first()
      .evaluate((line) => line.scrollIntoView({ block: 'start' }))
    await settle(page)
  },
  async script(page, actions) {
    const closingMath = body(page)
      .locator('.cm-line')
      .filter({ hasText: /^\$\$$/ })
      .nth(1)
    const rest = { x: 300, y: 330 }
    return new CursorScript(rest, actions)
      .wait(0.4)
      .move(lineEnd(closingMath), 0.75)
      .wait(0.1)
      .click()
      .wait(0.2)
      .type('\n\nFour retries wait $\\sum_{n=0}^{3} 2^n d_0$ in all.', { cps: 16, showAfter: 0.4 })
      .poster()
      .move(rest, 0.8)
      .wait(0.6)
      .build()
  },
  async check(page) {
    const math = preview(page).locator('p', { hasText: 'Four retries wait' }).locator('math')
    if ((await math.count()) !== 1)
      throw new Error('E_MEDIA_WRITE the preview did not render the math')
  },
}

const organise: Scene = {
  slot: 'organise',
  shape: 'feature',
  viewport: WINDOW,
  clip: cut(0, 0, CUTS.feature.clip),
  output: twice(CUTS.feature.clip),
  // Phones see the note's header, where the filing happens, and the list's right half.
  phone: { rect: cut(120, 0, CUTS.feature.phone), output: twice(CUTS.feature.phone) },
  motion: true,
  fade: 0.5,
  async prepare(page) {
    await openNote(page, 'Newsletter ideas')
    await setMode(page, 'Edit')
    await hideSidebar(page)
    await page.getByRole('listbox', { name: 'Notes' }).evaluate((list) => list.scrollTo(0, 0))
    await settle(page)
  },
  async script(page, actions) {
    const notebook = page.getByRole('button', { name: 'Notebook', exact: true })
    const launch = page.getByRole('option', { name: 'Spring launch', exact: true })
    const tags = page.getByRole('combobox', { name: 'Add Tag' })
    const planning = page
      .getByRole('listbox', { name: /tag/i })
      .getByRole('option', { name: /planning$/ })
    const rest = { x: 470, y: 300 }
    return new CursorScript(rest, actions)
      .wait(0.4)
      .move(at(notebook), 0.6)
      .wait(0.08)
      .click()
      .wait(0.45)
      .move(at(launch, 0.3), 0.55)
      .wait(0.15)
      .click()
      .wait(0.5)
      .move(at(statusButton(page)), 0.55)
      .wait(0.08)
      .click()
      .wait(0.4)
      .move(at(statusOption(page, 'Active'), 0.3), 0.45)
      .wait(0.12)
      .poster()
      .click()
      .wait(0.5)
      .move(at(tags, 0.3), 0.55)
      .wait(0.08)
      .click()
      .wait(0.15)
      .type('pla', { cps: 8, showAfter: 0.25 })
      .move(at(planning, 0.3), 0.45)
      .wait(0.1)
      .click()
      .wait(0.3)
      .move(at(page.getByRole('group', { name: 'Tags' }).getByText('planning'), 0.5), 0.5)
      .wait(1.0)
      .build()
  },
}

const find: Scene = {
  slot: 'find',
  shape: 'feature',
  viewport: WINDOW,
  clip: cut(0, 0, CUTS.feature.clip),
  output: twice(CUTS.feature.clip),
  phone: { rect: cut(0, 0, CUTS.feature.phone), output: twice(CUTS.feature.phone) },
  motion: true,
  fade: 0.5,
  async prepare(page) {
    await openNote(page, 'Release checklist')
    await setMode(page, 'Edit')
    await hideSidebar(page)
    await settle(page)
  },
  async script(page, actions) {
    const firstLine = body(page).locator('.cm-line').first()
    const suggestion = page
      .locator('.cm-tooltip-autocomplete')
      .getByRole('option', { name: /Spring launch plan/ })
    const backlink = preview(page).getByRole('button', { name: 'Release checklist' })
    const rest = { x: 470, y: 330 }
    return new CursorScript(rest, actions)
      .wait(0.3)
      .move(lineEnd(firstLine), 0.6)
      .wait(0.08)
      .click()
      .wait(0.15)
      .type('\nSee [[spring', { cps: 11, showAfter: 0.3 })
      .move(at(suggestion, 0.3), 0.5)
      .wait(0.1)
      .click()
      .wait(0.5)
      .move(at(searchField(page), 0.25), 0.6)
      .wait(0.08)
      .click()
      .wait(0.15)
      .type('launch tag:planning', { cps: 16, showAfter: 0.3 })
      .move(at(noteRow(page, 'Spring launch plan'), 0.4, 0.3), 0.55)
      .wait(0.08)
      .click()
      .wait(0.25)
      .press('Meta+KeyE')
      .wait(0.5)
      .move(at(backlink, 0.3), 0.6)
      .wait(0.2)
      .poster()
      .wait(1.0)
      .build()
  },
  async check(page) {
    const links = preview(page).getByRole('button', { name: 'Release checklist' })
    if ((await links.count()) !== 1)
      throw new Error('E_MEDIA_FIND the new link is not among the notes linked to this one')
  },
}

const SETTINGS_AT = { x: 40, y: 40 }
const TITLE_BAR = 28

/**
 * The Settings window over the main window, as on a Mac: its page in a frame with the title bar
 * the system draws for it (settings.rs: a titled 820 by 640 window, only the close button active),
 * dark when the system is.
 */
async function openSettingsWindow(page: Page) {
  await page.evaluate(
    ({ x, y, bar }) => {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches
      const win = document.createElement('div')
      win.id = 'media-settings'
      Object.assign(win.style, {
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: '820px',
        height: `${640 + bar}px`,
        borderRadius: '12px',
        overflow: 'hidden',
        zIndex: '2147483646',
        background: dark ? '#2c2c2e' : '#f6f6f6',
        boxShadow: dark
          ? '0 0 0 0.5px rgba(255, 255, 255, 0.16), 0 24px 70px rgba(0, 0, 0, 0.55), 0 6px 18px rgba(0, 0, 0, 0.35)'
          : '0 0 0 0.5px rgba(0, 0, 0, 0.22), 0 24px 70px rgba(0, 0, 0, 0.26), 0 6px 18px rgba(0, 0, 0, 0.12)',
      })
      const title = document.createElement('div')
      Object.assign(title.style, {
        position: 'relative',
        height: `${bar}px`,
        lineHeight: `${bar}px`,
        textAlign: 'center',
        font: '600 13px -apple-system, system-ui',
        color: dark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)',
        borderBottom: `1px solid ${dark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.09)'}`,
        boxSizing: 'border-box',
      })
      title.textContent = 'Settings'
      const off = dark ? ['#4a4a4c', '#3a3a3c'] : ['#d9d9d9', '#c4c4c4']
      ;['#ff5f57', off[0], off[0]].forEach((fill, i) => {
        const dot = document.createElement('div')
        Object.assign(dot.style, {
          position: 'absolute',
          left: `${9 + i * 20}px`,
          top: `${(bar - 12) / 2}px`,
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          boxSizing: 'border-box',
          background: fill,
          border: `0.5px solid ${i === 0 ? '#e0443e' : off[1]}`,
        })
        title.append(dot)
      })
      const frame = document.createElement('iframe')
      frame.src = '/settings.html'
      Object.assign(frame.style, { display: 'block', width: '820px', height: '640px', border: '0' })
      win.append(title, frame)
      document.body.append(win)
    },
    { ...SETTINGS_AT, bar: TITLE_BAR },
  )
  const settings = page.frameLocator('#media-settings iframe')
  await settings.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await settings.getByRole('radiogroup', { name: 'Theme' }).waitFor()
  return settings
}

const themes: Scene = {
  slot: 'card-1',
  shape: 'wide',
  viewport: WINDOW,
  clip: cut(0, 0, CUTS.wide.clip),
  output: twice(CUTS.wide.clip),
  phone: { rect: cut(0, 0, CUTS.wide.phone), output: twice(CUTS.wide.phone) },
  motion: true,
  fade: 0,
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    const settings = await openSettingsWindow(page)
    // Scrolled as a person would, so the gradient themes sit at the top of the window.
    const dawn = settings
      .getByRole('radiogroup', { name: 'Theme' })
      .locator('.theme-card', { hasText: 'Dawn' })
    await dawn.evaluate((card) => {
      let pane = card.parentElement
      while (pane && pane.scrollHeight <= pane.clientHeight) pane = pane.parentElement
      if (pane)
        pane.scrollTop += card.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24
    })
    await settle(page)
  },
  async script(page, actions) {
    const cards = page
      .frameLocator('#media-settings iframe')
      .getByRole('radiogroup', { name: 'Theme' })
    const card = (name: string) => at(cards.locator('.theme-card', { hasText: name }), 0.5, 0.4)
    const tide = await card('Tide')()
    const script = new CursorScript(tide, actions).wait(0.6)
    // Ember sits in the fade at the cut's right edge; the other three show the change best.
    for (const name of ['Dawn', 'Sage', 'Tide']) {
      script
        .move(card(name), 0.7)
        .wait(0.1)
        .click()
        .wait(name === 'Sage' ? 0.4 : 1.2)
      if (name === 'Sage') script.poster().wait(0.8)
    }
    return script.wait(0.6).build()
  },
}

const focus: Scene = {
  slot: 'card-2',
  shape: 'narrow',
  viewport: NARROW_WINDOW,
  clip: cut(0, 0, CUTS.narrow.clip),
  output: twice(CUTS.narrow.clip),
  motion: true,
  // The pointer ends where it starts; the fade takes out the button's tooltip.
  fade: 0.3,
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Edit')
    await hideSidebar(page)
    await settle(page)
  },
  async script(page, actions) {
    // The button moves with the note: found again before each move.
    const button = at(focusButton(page))
    const start = await button()
    return new CursorScript(start, actions)
      .wait(0.6)
      .click()
      .wait(0.9)
      .move(button, 0.9)
      .poster()
      .wait(0.9)
      .click()
      .wait(0.6)
      .move(button, 0.8)
      .wait(0.8)
      .build()
  },
}

const tables: Scene = {
  slot: 'card-3',
  shape: 'narrow',
  viewport: NARROW_WINDOW,
  clip: cut(0, 0, CUTS.narrow.clip),
  output: twice(CUTS.narrow.clip),
  motion: true,
  fade: 0.6,
  // The table bar would cover the rows the clip is about: here the keyboard does the work.
  settings: { toolbar: false },
  async prepare(page) {
    await openNote(page, 'Rosemary focaccia')
    await setMode(page, 'Edit')
    await focusMode(page)
    await settle(page)
  },
  async script(page, actions) {
    const lastRow = body(page).locator('.cm-line', { hasText: 'Olive oil |' })
    const newRow = body(page).locator('.cm-line', { hasText: /^\| Rosemary/ })
    const rest = { x: 250, y: 380 }
    return new CursorScript(rest, actions)
      .wait(0.5)
      .move(lineEnd(lastRow), 0.8)
      .wait(0.1)
      .click()
      .wait(0.4)
      .type('\tRosemary\t3 sprigs', { cps: 11, showAfter: 0.4 })
      .move(lineEnd(newRow), 0.6)
      .poster()
      .wait(1.0)
      .build()
  },
  async check(page) {
    const lines = await body(page).locator('.cm-line').allTextContents()
    if (!lines.some((line) => /^\| Rosemary +\| +3 sprigs +\|$/.test(line))) {
      throw new Error('E_MEDIA_TABLE the new row is not in the table')
    }
  },
}

// The palette (667 points wide, centred) starts past the fade at the cut's left side.
const PALETTE_CUT = 255

const palette: Scene = {
  slot: 'card-4',
  shape: 'wide',
  viewport: WINDOW,
  // The palette sits at the middle of the window's top.
  clip: cut(PALETTE_CUT, 0, CUTS.wide.clip),
  output: twice(CUTS.wide.clip),
  phone: { rect: cut(PALETTE_CUT, 0, CUTS.wide.phone), output: twice(CUTS.wide.phone) },
  motion: true,
  fade: 0.5,
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Edit')
    await hideSidebar(page)
    await settle(page)
  },
  async script(page, actions) {
    const results = page
      .getByRole('dialog', { name: 'Command Palette' })
      .getByRole('listbox', { name: 'Results' })
      .getByRole('option')
    const rest = { x: PALETTE_CUT + 330, y: 300 }
    return new CursorScript(rest, actions)
      .wait(0.6)
      .press('Meta+KeyK')
      .wait(0.6)
      .type('status', { cps: 9, showAfter: -1 })
      .wait(0.6)
      .poster()
      .wait(0.4)
      .type(' com', { cps: 7, showAfter: 0.3 })
      .move(at(results.filter({ hasText: 'Set Status to Completed' }), 0.25), 0.6)
      .wait(0.3)
      .click()
      .wait(0.7)
      .move(at(statusButton(page), 0.4), 0.7)
      .wait(1.0)
      .build()
  },
  async check(page) {
    if ((await statusButton(page).getAttribute('data-value')) !== 'completed') {
      throw new Error('E_MEDIA_PALETTE the command did not run')
    }
  },
}

// The sheet (835 points wide, centred) starts past the fade at the cut's left side.
const HISTORY_CUT = 147

const history: Scene = {
  slot: 'card-5',
  shape: 'wide',
  // Short enough that the sheet, centred in the window, starts near its top.
  viewport: { width: 1280, height: 620 },
  // The Revision History sheet, from its left edge: its versions and the changes they made.
  clip: cut(HISTORY_CUT, 0, CUTS.wide.clip),
  output: twice(CUTS.wide.clip),
  phone: { rect: cut(HISTORY_CUT, 0, CUTS.wide.phone), output: twice(CUTS.wide.phone) },
  motion: true,
  fade: 0.4,
  async prepare(page) {
    await openNote(page, 'Landing page copy')
    await setMode(page, 'Edit')
    await hideSidebar(page)
    // Touched once, so the note already sits first among the notes, where the restore leaves it.
    await body(page).locator('.cm-line', { hasText: 'On hold until' }).click()
    await page.keyboard.press('End')
    await page.keyboard.type(' ')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(1500)
    await settle(page)
  },
  async script(page, actions) {
    const sheet = page.getByRole('dialog', { name: 'Revision History' })
    const versions = sheet.getByRole('listbox', { name: 'Versions' })
    const earliest = versions.getByRole('option', { name: /Earliest version/ })
    const restored = body(page).locator('.cm-line', { hasText: 'First draft' })
    const rest = { x: HISTORY_CUT + 300, y: 330 }
    return (
      new CursorScript(rest, actions)
        .wait(0.5)
        .press('Meta+Alt+KeyY')
        .wait(0.7)
        .move(at(earliest, 0.4), 0.7)
        .wait(0.1)
        .click()
        .wait(0.7)
        .poster()
        .wait(1.2)
        // Restore sits below the cut; the keyboard reaches it as Tab would.
        .do(() => sheet.getByRole('button', { name: 'Restore' }).focus())
        .press('Space')
        .wait(1.1)
        .move(lineEnd(restored), 0.6)
        .wait(0.1)
        .click()
        .wait(0.3)
        .press('Meta+KeyZ')
        .wait(1.0)
        .build()
    )
  },
}

const templates: Scene = {
  slot: 'card-6',
  shape: 'narrow',
  viewport: NARROW_WINDOW,
  clip: cut(0, 0, CUTS.narrow.clip),
  output: twice(CUTS.narrow.clip),
  motion: true,
  fade: 0.5,
  async prepare(page) {
    await openNote(page, 'Weekly review, week 43')
    await setMode(page, 'Edit')
    await focusMode(page)
    await settle(page)
  },
  async script(page, actions) {
    const picker = page.getByRole('dialog', { name: 'New Note from Template' })
    const option = picker.getByRole('option', { name: /Daily standup/ })
    const rest = { x: 230, y: 380 }
    return new CursorScript(rest, actions)
      .wait(0.5)
      .press('Meta+KeyT')
      .wait(0.6)
      .move(at(option, 0.35), 0.75)
      .wait(0.1)
      .click()
      .wait(1.1)
      .press('Enter')
      .wait(0.5)
      .move(at(page.getByRole('textbox', { name: 'Title' }), 0.25), 0.8)
      .poster()
      .wait(1.2)
      .build()
  },
  async check(page) {
    const title = await page.getByRole('textbox', { name: 'Title' }).inputValue()
    if (!title.startsWith('Standup, ')) throw new Error(`E_MEDIA_TEMPLATE title ${title}`)
  },
}

export const SCENES: Partial<Record<SlotName, Scene>> = {
  hero,
  write,
  organise,
  find,
  'card-1': themes,
  'card-2': focus,
  'card-3': tables,
  'card-4': palette,
  'card-5': history,
  'card-6': templates,
}
