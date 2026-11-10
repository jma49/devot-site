import type { Page } from '@playwright/test'
import type { Scheme } from '../../src/media.ts'
import {
  at,
  body,
  hideSidebar,
  lineEnd,
  openNote,
  openSettingsWindow,
  preview,
  SCENES,
  searchField,
  setMode,
  settle,
  sidebar,
  viewMode,
  WINDOW,
  type Scene,
} from './scenes.ts'
import { CursorScript } from './timeline.ts'

// Scenes recorded only as whole-window masters for the film (`MEDIA_FULL_WINDOW=1 pnpm
// media:device`): features the page's slots do not show. They never reach `src/media.json` or
// `public/media/`.

export type FilmScene = Omit<Scene, 'slot'> & { slot: string }

const twice = ({ width, height }: { width: number; height: number }) => ({
  width: width * 2,
  height: height * 2,
})

type Parts = Pick<FilmScene, 'slot' | 'prepare' | 'script'> &
  Partial<Pick<FilmScene, 'viewport' | 'settings' | 'view' | 'check'>>

/** A film scene shows the whole window; the page's cuts and fades do not apply. */
const film = ({ viewport = WINDOW, ...parts }: Parts): FilmScene => ({
  shape: 'hero',
  viewport,
  clip: { x: 0, y: 0, ...viewport },
  output: twice(viewport),
  motion: true,
  fade: 0,
  ...parts,
})

const REST = { x: 690, y: 520 }

const toolbar = (page: Page) => page.locator('.editor-toolbar')
const writeButton = (page: Page) =>
  toolbar(page).getByRole('button', { name: 'Write Mode', exact: true })
const layout = (page: Page, name: 'List' | 'Board' | 'Gallery') =>
  page.getByRole('group', { name: 'Layout' }).getByRole('button', { name, exact: true })
const board = (page: Page) => page.locator('.board')
const column = (page: Page, name: string) =>
  board(page).getByRole('listbox', { name: new RegExp(`^${name}\\b`) })
const card = (page: Page, title: string) =>
  board(page).getByRole('option').filter({ hasText: title })
const palette = (page: Page) => page.getByRole('dialog', { name: 'Command Palette' })
const paletteResult = (page: Page, text: string) =>
  palette(page).getByRole('listbox', { name: 'Results' }).getByRole('option').filter({
    hasText: text,
  })
const noteInfoSummary = (page: Page) => page.getByRole('button', { name: /^Note info: / })
const noteInfo = (page: Page) => page.getByRole('dialog', { name: 'Note info' })
const outline = (page: Page) => page.getByRole('navigation', { name: 'Outline' })
const savedRow = (page: Page, name: string) =>
  sidebar(page).getByRole('button', { name: new RegExp(`^${name}( \\d+)?$`) })

const writeMode = film({
  slot: 'n1-write-mode',
  async prepare(page) {
    await openNote(page, 'Weekly review, week 43')
    await setMode(page, 'Edit')
    await page.mouse.move(REST.x, REST.y)
    await settle(page)
  },
  async script(page, actions) {
    const lastTask = body(page).locator('.cm-line', { hasText: 'Bake the' })
    return new CursorScript(REST, actions)
      .wait(0.7)
      .move(at(writeButton(page)), 0.7)
      .wait(0.1)
      .beat('enter Write Mode')
      .click()
      .wait(1.0)
      .move(lineEnd(lastTask), 0.7)
      .wait(0.1)
      .click()
      .wait(0.3)
      .type('\nBook the train to the coast\nCall the studio about Friday', {
        cps: 15,
        showAfter: 0.5,
      })
      .poster()
      .wait(0.6)
      .move(at(viewMode(page, 'Edit')), 0.8)
      .wait(0.1)
      .beat('leave Write Mode')
      .click()
      .wait(0.5)
      .move(REST, 0.7)
      .wait(0.6)
      .build()
  },
  async check(page) {
    const lines = await body(page).locator('.cm-line').allTextContents()
    if (!lines.some((line) => line.includes('Call the studio about Friday'))) {
      throw new Error('E_MEDIA_WRITE_MODE the typed lines are not in the note')
    }
    if ((await writeButton(page).getAttribute('aria-pressed')) === 'true') {
      throw new Error('E_MEDIA_WRITE_MODE the note is still in Write Mode')
    }
  },
})

const galleryBoard = film({
  slot: 'n2-gallery-board',
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    await page.mouse.move(REST.x, REST.y)
    await settle(page)
  },
  async script(page, actions) {
    // The card moves with the board: found again when its move begins.
    const moved = card(page, 'Landing page copy')
    return new CursorScript(REST, actions)
      .wait(1.0)
      .move(at(layout(page, 'Gallery')), 0.8)
      .wait(0.1)
      .beat('Gallery')
      .click()
      .wait(2.0)
      .move(at(layout(page, 'Board')), 0.5)
      .wait(0.1)
      .beat('Board')
      .click()
      .wait(1.6)
      .move(at(moved, 0.5, 0.4), 0.8)
      .wait(0.2)
      .beat('drag a card from On Hold to Active')
      .down()
      .wait(0.25)
      .move(at(column(page, 'Active'), 0.5, 0.75), 1.1)
      .wait(0.3)
      .poster()
      .up()
      .wait(1.0)
      .move(REST, 0.8)
      .wait(1.0)
      .build()
  },
  async check(page) {
    if (
      (await column(page, 'Active')
        .getByRole('option')
        .filter({ hasText: 'Landing page copy' })
        .count()) !== 1
    ) {
      throw new Error('E_MEDIA_BOARD the card did not move to Active')
    }
  },
})

const info = film({
  slot: 'n3-note-info',
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    await page.mouse.move(REST.x, REST.y)
    await settle(page)
  },
  async script(page, actions) {
    const row = (name: string) => noteInfo(page).getByRole('button', { name })
    return new CursorScript(REST, actions)
      .wait(1.0)
      .move(at(noteInfoSummary(page)), 0.8)
      .wait(0.1)
      .beat('open Note Info')
      .click()
      .wait(1.2)
      .move(at(row('Design sync, 21 October'), 0.4), 0.7)
      .wait(0.6)
      .poster()
      .move(at(row('Weekly review, week 42'), 0.4), 0.6)
      .wait(1.6)
      .build()
  },
  async check(page) {
    if (!(await noteInfo(page).isVisible())) throw new Error('E_MEDIA_NOTE_INFO the card is closed')
  },
})

const headingTop = (page: Page, text: string) =>
  preview(page)
    .locator('h2', { hasText: text })
    .evaluate((h: Element) => Math.round(h.getBoundingClientRect().top))
let outlineStart = 0

const outlineJump = film({
  slot: 'n4-outline',
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    // Side by side the note is taller than the window, so the jump shows.
    await setMode(page, 'Split')
    await page.mouse.move(REST.x, REST.y)
    await settle(page)
    outlineStart = await headingTop(page, 'Before the freeze')
  },
  async script(page, actions) {
    const heading = outline(page).getByRole('treeitem').filter({ hasText: 'Before the freeze' })
    return new CursorScript(REST, actions)
      .wait(1.0)
      .beat('open the command palette')
      .press('Meta+KeyK')
      .wait(0.6)
      .type('outline', { cps: 9, showAfter: 0.3 })
      .move(at(paletteResult(page, 'Show Outline'), 0.25), 0.6)
      .wait(0.2)
      .beat('Show Outline')
      .click()
      .wait(1.2)
      .move(at(heading, 0.4), 0.8)
      .wait(0.2)
      .beat('jump to a heading')
      .click()
      .wait(0.6)
      .poster()
      .wait(1.6)
      .build()
  },
  async check(page) {
    const top = await headingTop(page, 'Before the freeze')
    if (top > outlineStart - 100) {
      throw new Error(`E_MEDIA_OUTLINE the heading moved from ${outlineStart} to ${top}`)
    }
  },
})

const savedSearch = film({
  slot: 'n5-saved-search',
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    await page.mouse.move(REST.x, REST.y)
    await settle(page)
  },
  async script(page, actions) {
    const dialog = page.getByRole('dialog', { name: 'Save Search' })
    return (
      new CursorScript(REST, actions)
        .wait(0.7)
        .move(at(searchField(page), 0.3), 0.7)
        .wait(0.1)
        .click()
        .wait(0.2)
        .type('tag:planning', { cps: 13, showAfter: 0.5 })
        .beat('open the command palette')
        .press('Meta+KeyK')
        .wait(0.6)
        .type('save s', { cps: 11, showAfter: 0.3 })
        .move(at(paletteResult(page, 'Save Search'), 0.25), 0.6)
        .wait(0.2)
        .beat('Save Search')
        .click()
        .wait(0.8)
        // The name starts as the query: selected whole, the typing replaces it.
        .do(() => dialog.getByRole('textbox', { name: 'Name' }).focus())
        .press('Meta+KeyA')
        .wait(0.3)
        .type('Planning', { cps: 12, showAfter: 0.3 })
        .move(at(dialog.getByRole('button', { name: 'Save', exact: true })), 0.6)
        .wait(0.1)
        .click()
        .wait(1.0)
        .poster()
        .move(at(page.getByRole('button', { name: 'Clear Search' })), 0.7)
        .wait(0.1)
        .click()
        .wait(0.8)
        .move(at(savedRow(page, 'Planning'), 0.4), 0.8)
        .wait(0.1)
        .beat('open the saved search from the sidebar')
        .click()
        .wait(1.4)
        .build()
    )
  },
  async check(page) {
    if ((await searchField(page).inputValue()) !== 'tag:planning') {
      throw new Error('E_MEDIA_SAVED_SEARCH the saved search did not run')
    }
  },
})

const dailyNote = film({
  slot: 'n6-daily-note',
  settings: { dailyTitleFormat: 'weekdayDayMonthYear' },
  async prepare(page) {
    await openNote(page, 'Weekly review, week 43')
    await setMode(page, 'Edit')
    await page.mouse.move(REST.x, REST.y)
    await settle(page)
  },
  async script(page, actions) {
    return new CursorScript(REST, actions)
      .wait(0.7)
      .beat('open the command palette')
      .press('Meta+KeyK')
      .wait(0.6)
      .type('today', { cps: 9, showAfter: 0.3 })
      .move(at(paletteResult(page, 'Open Today'), 0.25), 0.6)
      .wait(0.2)
      .beat("Open Today's Note")
      .click()
      .wait(1.2)
      .move(at(body(page), 0.3, 0.1), 0.7)
      .wait(0.1)
      .click()
      .wait(0.3)
      .type('Walked before work. Draft the release notes.', { cps: 15, showAfter: 0.4 })
      .poster()
      .move(REST, 0.7)
      .wait(0.8)
      .build()
  },
  async check(page) {
    const title = await page.getByRole('textbox', { name: 'Title' }).inputValue()
    if (!/\d{4}$/.test(title)) throw new Error(`E_MEDIA_DAILY title ${title}`)
    const lines = await body(page).locator('.cm-line').allTextContents()
    if (!lines.some((line) => line.includes('Draft the release notes'))) {
      throw new Error('E_MEDIA_DAILY the line is not in the note')
    }
  },
})

const gradient = film({
  slot: 'n7-gradient',
  async prepare(page) {
    await openNote(page, 'Spring launch plan')
    await setMode(page, 'Preview')
    const settings = await openSettingsWindow(page)
    const slider = settings.getByRole('slider', { name: 'Gradient' })
    await slider.evaluate((el: Element) => el.scrollIntoView({ block: 'center' }))
    await settle(page)
  },
  async script(page, actions) {
    const settings = page.frameLocator('#media-settings iframe')
    const slider = settings.getByRole('slider', { name: 'Gradient' })
    // The thumb starts at the left end (the solid colour) and stops a little inside each end.
    const thumb = (x: number) => at(slider, x, 0.5)
    const start = await thumb(0.5)()
    return new CursorScript({ x: start.x, y: start.y + 90 }, actions)
      .wait(1.0)
      .move(thumb(0.02), 0.8)
      .wait(0.2)
      .beat('drag Gradient from solid to full')
      .down()
      .wait(0.2)
      .move(thumb(0.98), 2.4, { bend: 0 })
      .wait(0.4)
      .poster()
      .up()
      .wait(1.2)
      .beat('drag Gradient back to the middle')
      .down()
      .wait(0.2)
      .move(thumb(0.5), 1.6, { bend: 0 })
      .wait(0.3)
      .up()
      .wait(1.6)
      .build()
  },
  async check(page) {
    const settings = page.frameLocator('#media-settings iframe')
    const value = Number(await settings.getByRole('slider', { name: 'Gradient' }).inputValue())
    if (!(value > 20 && value < 80)) throw new Error(`E_MEDIA_GRADIENT the slider is at ${value}`)
  },
})

const DIAGRAM = '\n\n```markmap\n# Launch\n## Build\n## Test\n- Private beta\n## Ship'

const diagram = film({
  slot: 'n8-diagram',
  async prepare(page) {
    await openNote(page, 'Reading list')
    await setMode(page, 'Split')
    await hideSidebar(page)
    await page.mouse.move(REST.x, REST.y)
    await settle(page)
  },
  async script(page, actions) {
    const last = body(page).locator('.cm-line').last()
    return new CursorScript(REST, actions)
      .wait(0.7)
      .move(lineEnd(last), 0.7)
      .wait(0.1)
      .click()
      .wait(0.3)
      .beat('type a Markmap code block')
      .type(DIAGRAM, { cps: 16, showAfter: 0.5 })
      .poster()
      .move(at(preview(page).locator('.island-markmap'), 0.5, 0.5), 0.9)
      .wait(1.8)
      .build()
  },
  async check(page) {
    const svg = preview(page).locator('.island-markmap svg')
    await svg.first().waitFor({ timeout: 30_000 })
    const text = (await svg.allTextContents()).join(' ')
    if (!text.includes('Ship')) throw new Error('E_MEDIA_DIAGRAM the mind map did not draw')
  },
})

export const FILM_SCENES: Record<string, FilmScene> = {
  ...(SCENES as Record<string, FilmScene>),
  [writeMode.slot]: writeMode,
  [galleryBoard.slot]: galleryBoard,
  [info.slot]: info,
  [outlineJump.slot]: outlineJump,
  [savedSearch.slot]: savedSearch,
  [dailyNote.slot]: dailyNote,
  [gradient.slot]: gradient,
  [diagram.slot]: diagram,
}

const BOTH: readonly Scheme[] = ['light', 'dark']
const LIGHT: readonly Scheme[] = ['light']

/** The film's shot list: every master to record, and in which colour schemes. */
export const FILM_SHOTS: readonly { id: string; schemes: readonly Scheme[] }[] = [
  { id: 'hero', schemes: BOTH },
  { id: 'write', schemes: LIGHT },
  { id: 'organise', schemes: LIGHT },
  { id: 'find', schemes: LIGHT },
  { id: 'card-1', schemes: BOTH },
  { id: 'card-2', schemes: LIGHT },
  { id: 'card-3', schemes: LIGHT },
  { id: 'card-4', schemes: LIGHT },
  { id: 'card-5', schemes: LIGHT },
  { id: 'card-6', schemes: LIGHT },
  { id: 'n1-write-mode', schemes: BOTH },
  { id: 'n2-gallery-board', schemes: LIGHT },
  { id: 'n3-note-info', schemes: LIGHT },
  { id: 'n4-outline', schemes: LIGHT },
  { id: 'n5-saved-search', schemes: LIGHT },
  { id: 'n6-daily-note', schemes: LIGHT },
  { id: 'n7-gradient', schemes: BOTH },
  { id: 'n8-diagram', schemes: LIGHT },
]
