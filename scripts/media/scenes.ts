import type { Locator, Page } from '@playwright/test'
import type { SlotName } from '../../src/media.ts'
import type { Rect } from './frames.ts'
import { CursorScript, type Actions, type Point, type Timeline } from './timeline.ts'

export interface Scene {
  slot: SlotName
  /** The window's size in points. */
  viewport: { width: number; height: number }
  /** The part of the window the clip shows, in points. */
  clip: Rect
  /** Pixels of the encoded clip and poster. */
  output: { width: number; height: number }
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

/** Every diagram drawn and every font loaded. */
async function settle(page: Page) {
  const islands = page.getByRole('article', { name: 'Preview' }).locator('.island')
  for (let i = 0; i < (await islands.count()); i++) {
    await islands.nth(i).locator('svg').first().waitFor({ timeout: 15_000 })
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(500)
}

const WINDOW = { width: 1280, height: 800 }
const HERO_REST = { x: 1010, y: 560 }

const hero: Scene = {
  slot: 'hero',
  viewport: WINDOW,
  clip: { x: 0, y: 0, ...WINDOW },
  output: { width: 2048, height: 1280 },
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
    const status = page.getByRole('button', { name: 'Status', exact: true })
    const completed = page
      .getByRole('listbox', { name: 'Status' })
      .getByRole('option', { name: 'Completed', exact: true })
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
      .move(at(status), 0.7)
      .wait(0.1)
      .click()
      .wait(0.3)
      .move(at(completed, 0.35), 0.45)
      .wait(0.1)
      .click()
      .wait(0.35)
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

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Sidebar' })
const focusButton = (page: Page) => page.getByRole('button', { name: 'Focus Mode' })
const preview = (page: Page) => page.getByRole('article', { name: 'Preview' })

async function focusMode(page: Page) {
  await focusButton(page).click()
  await sidebar(page).waitFor({ state: 'hidden' })
}

/** Features: 1800 by 1200 pixels, from the window's top-left corner. */
const FEATURE = { width: 1800, height: 1200 }

const write: Scene = {
  slot: 'write',
  viewport: { width: 960, height: 620 },
  clip: { x: 0, y: 0, width: 900, height: 600 },
  output: FEATURE,
  motion: true,
  fade: 0.5,
  async prepare(page) {
    await openNote(page, 'Retry with backoff')
    await setMode(page, 'Split')
    await focusMode(page)
    await settle(page)
  },
  async script(page, actions) {
    const closingMath = body(page)
      .locator('.cm-line')
      .filter({ hasText: /^\$\$$/ })
      .nth(1)
    const rest = { x: 760, y: 540 }
    return new CursorScript(rest, actions)
      .wait(0.4)
      .move(lineEnd(closingMath), 0.75)
      .wait(0.1)
      .click()
      .wait(0.2)
      .type('\n\nFour retries wait $\\sum_{n=0}^{3} 2^n d_0$ in all.', { cps: 16, showAfter: 0.4 })
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
  viewport: WINDOW,
  clip: { x: 0, y: 0, width: 960, height: 640 },
  output: FEATURE,
  motion: true,
  fade: 0,
  async prepare(page) {
    await openNote(page, 'Landing page copy')
    await setMode(page, 'Preview')
    await settle(page)
  },
  async script(page, actions) {
    const rest = { x: 760, y: 560 }
    const row = (name: RegExp | string) => sidebar(page).getByRole('button', { name })
    const book = sidebar(page)
      .getByRole('treeitem', { name: /^Spring launch/ })
      .locator('> .book-row')
    // The sidebar lists only the statuses and tags of the notes shown, so each step narrows the last.
    const steps = [
      at(book, 0.4),
      // A coloured tag's name starts with its colour: "Pink design 3".
      at(row(/ design \d+$/), 0.3),
      at(row(/^On Hold/), 0.3),
      at(row(/^All Notes/), 0.3),
    ]
    const script = new CursorScript(rest, actions).wait(0.5)
    for (const target of steps) script.move(target, 0.6).wait(0.08).click().wait(0.75)
    return script.move(rest, 0.8).wait(0.4).build()
  },
}

const find: Scene = {
  slot: 'find',
  viewport: WINDOW,
  clip: { x: 0, y: 0, width: 960, height: 640 },
  output: FEATURE,
  motion: true,
  fade: 0,
  view: { 'devot.list.width': '344' },
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    await settle(page)
  },
  async script(page, actions) {
    const rest = { x: 800, y: 560 }
    return new CursorScript(rest, actions)
      .wait(0.3)
      .move(at(searchField(page), 0.25), 0.65)
      .wait(0.08)
      .click()
      .wait(0.15)
      .type('launch tag:planning status:active', { cps: 18, showAfter: 0.5 })
      .move(at(page.getByRole('button', { name: 'Search Syntax' })), 0.6)
      .wait(0.08)
      .click()
      .wait(1.0)
      .press('Escape')
      .wait(0.2)
      .move(at(page.getByRole('button', { name: 'Clear Search' })), 0.5)
      .wait(0.08)
      .click()
      .wait(0.25)
      .move(rest, 0.7)
      .wait(0.3)
      .build()
  },
}

/** Wide cards: a 900 by 565 point part of the window; narrow cards: 540 by 678. */
const WIDE = { width: 1720, height: 1080 }
const NARROW = { width: 860, height: 1080 }

const SETTINGS_AT = { x: 100, y: 64 }
const TITLE_BAR = 28

/**
 * The Settings window over the main window, as on a Mac: its page in a frame with the title bar
 * the system draws for it (settings.rs: a titled 820 by 640 window, only the close button active).
 */
async function openSettingsWindow(page: Page) {
  await page.evaluate(
    ({ x, y, bar }) => {
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
        background: '#f6f6f6',
        boxShadow:
          '0 0 0 0.5px rgba(0, 0, 0, 0.22), 0 24px 70px rgba(0, 0, 0, 0.26), 0 6px 18px rgba(0, 0, 0, 0.12)',
      })
      const title = document.createElement('div')
      Object.assign(title.style, {
        position: 'relative',
        height: `${bar}px`,
        lineHeight: `${bar}px`,
        textAlign: 'center',
        font: '600 13px -apple-system, system-ui',
        color: 'rgba(0, 0, 0, 0.85)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.09)',
        boxSizing: 'border-box',
      })
      title.textContent = 'Settings'
      ;['#ff5f57', '#d9d9d9', '#d9d9d9'].forEach((fill, i) => {
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
          border: `0.5px solid ${i === 0 ? '#e0443e' : '#c4c4c4'}`,
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
  viewport: WINDOW,
  clip: { x: 0, y: 0, width: 900, height: 565 },
  output: WIDE,
  motion: true,
  fade: 0,
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    await openSettingsWindow(page)
    await settle(page)
  },
  async script(page, actions) {
    const cards = page
      .frameLocator('#media-settings iframe')
      .getByRole('radiogroup', { name: 'Theme' })
    const card = (name: string) => cards.locator('.theme-card', { hasText: name })
    const rest = { x: 700, y: 530 }
    const script = new CursorScript(rest, actions).wait(0.5)
    for (const name of ['Dawn', 'Sage', 'Ember', 'Tide']) {
      script
        .move(at(card(name), 0.5, 0.35), 0.6)
        .wait(0.08)
        .click()
        .wait(0.8)
    }
    return script.move(rest, 0.7).wait(0.3).build()
  },
}

const focus: Scene = {
  slot: 'card-2',
  viewport: { width: 760, height: 700 },
  clip: { x: 0, y: 0, width: 540, height: 678 },
  output: NARROW,
  motion: true,
  fade: 0.3,
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Edit')
    await settle(page)
  },
  async script(page, actions) {
    const rest = { x: 430, y: 600 }
    return new CursorScript(rest, actions)
      .wait(0.5)
      .move(at(focusButton(page)), 0.8)
      .wait(0.1)
      .click()
      .wait(0.4)
      .move({ x: 300, y: 420 }, 0.9)
      .wait(1.0)
      .move(at(focusButton(page)), 0.8)
      .wait(0.1)
      .click()
      .wait(0.1)
      .move(rest, 0.8)
      .wait(0.8)
      .build()
  },
}

const tables: Scene = {
  slot: 'card-3',
  viewport: { width: 830, height: 700 },
  clip: { x: 290, y: 0, width: 540, height: 678 },
  output: NARROW,
  motion: true,
  fade: 0.6,
  // The table bar would cover the rows the clip is about: here the keyboard does the work.
  settings: { toolbar: false },
  async prepare(page) {
    await openNote(page, 'Rosemary focaccia')
    await setMode(page, 'Edit')
    await settle(page)
  },
  async script(page, actions) {
    const lastRow = body(page).locator('.cm-line', { hasText: 'Rosemary |' })
    const rest = { x: 690, y: 600 }
    return new CursorScript(rest, actions)
      .wait(0.5)
      .move(lineEnd(lastRow), 0.8)
      .wait(0.1)
      .click()
      .wait(0.4)
      .type('\tFlaky salt\ta pinch', { cps: 11, showAfter: 0.6 })
      .move(rest, 0.8)
      .wait(0.8)
      .build()
  },
  async check(page) {
    const lines = await body(page).locator('.cm-line').allTextContents()
    if (!lines.some((line) => /^\| Flaky salt +\| +a pinch +\|$/.test(line))) {
      throw new Error('E_MEDIA_TABLE the new row is not in the table')
    }
  },
}

const palette: Scene = {
  slot: 'card-4',
  viewport: WINDOW,
  clip: { x: 200, y: 0, width: 900, height: 565 },
  output: WIDE,
  motion: true,
  fade: 0.5,
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Edit')
    await settle(page)
  },
  async script(page, actions) {
    const results = page
      .getByRole('dialog', { name: 'Command Palette' })
      .getByRole('listbox', { name: 'Results' })
      .getByRole('option')
    const rest = { x: 960, y: 500 }
    return new CursorScript(rest, actions)
      .wait(0.6)
      .press('Meta+KeyK')
      .wait(0.6)
      .type('status', { cps: 9, showAfter: 0.4 })
      .move(at(results.filter({ hasText: 'Set Status to Completed' }), 0.3), 0.8)
      .wait(0.1)
      .click()
      .wait(0.9)
      .move(rest, 0.8)
      .wait(0.6)
      .build()
  },
  async check(page) {
    const status = page.getByRole('button', { name: 'Status', exact: true })
    if ((await status.getAttribute('data-value')) !== 'completed') {
      throw new Error('E_MEDIA_PALETTE the command did not run')
    }
  },
}

const history: Scene = {
  slot: 'card-5',
  viewport: { width: 1280, height: 620 },
  clip: { x: 210, y: 0, width: 900, height: 565 },
  output: WIDE,
  motion: true,
  fade: 0.3,
  async prepare(page) {
    await openNote(page, 'Landing page copy')
    await setMode(page, 'Edit')
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
    const earliest = sheet.getByRole('listbox', { name: 'Versions' }).getByRole('option', {
      name: /Earliest version/,
    })
    const restored = body(page).locator('.cm-line', { hasText: 'First draft' })
    const rest = { x: 880, y: 520 }
    return new CursorScript(rest, actions)
      .wait(0.5)
      .press('Meta+Alt+KeyY')
      .wait(0.6)
      .move(at(earliest, 0.4), 0.7)
      .wait(0.1)
      .click()
      .wait(1.1)
      .move(at(sheet.getByRole('button', { name: 'Restore' })), 0.7)
      .wait(0.1)
      .click()
      .wait(1.2)
      .move(lineEnd(restored), 0.6)
      .wait(0.1)
      .click()
      .wait(0.2)
      .press('Meta+KeyZ')
      .wait(0.7)
      .move(rest, 0.7)
      .wait(0.3)
      .build()
  },
}

const templates: Scene = {
  slot: 'card-6',
  viewport: { width: 760, height: 700 },
  clip: { x: 0, y: 0, width: 540, height: 678 },
  output: NARROW,
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
    const rest = { x: 420, y: 610 }
    return new CursorScript(rest, actions)
      .wait(0.5)
      .press('Meta+KeyT')
      .wait(0.6)
      .move(at(option, 0.35), 0.75)
      .wait(0.1)
      .click()
      .wait(1.3)
      .press('Enter')
      .wait(0.3)
      .move(rest, 0.8)
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
