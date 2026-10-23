import { realpathSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { BOOKS, NOTES, TAGS, type DemoBook, type DemoNote, type DemoTag } from './library.ts'

interface Seed {
  books: DemoBook[]
  tags: DemoTag[]
  notes: DemoNote[]
  now: number
  core: string
  view: Record<string, string>
}

/** Window view preferences the app keeps in the web view's storage (paneWidth.ts, preview/infoCard.ts). */
export const VIEW: Record<string, string> = {
  'devot.sidebar.width': '224',
  'devot.preview.backlinksOpen': '1',
}

/**
 * Fills the UI-test build's storage (localStorage `devot.test.*`) through the app's own core
 * services, loaded from the Vite server (its root is src/renderer; the core is served under /@fs/),
 * so every record is shaped exactly as the app writes it, then reloads. Returns note IDs by key.
 */
export async function seedLibrary(
  page: Page,
  devotDir: string,
  preferences: Record<string, string> = VIEW,
): Promise<Record<string, string>> {
  const ids = await page.evaluate(
    async ({ books, tags, notes, now, core, view }: Seed) => {
      localStorage.clear()
      for (const [key, value] of Object.entries(view)) localStorage.setItem(key, value)
      const load = (path: string) => import(/* @vite-ignore */ path)
      const { memoryStorage: storage } = await load('/src/storage/memory.ts')
      const { createClock, newNodeId } = await load(`${core}/hlc.ts`)
      const { createIdGenerator } = await load(`${core}/ids.ts`)
      const { createNoteService } = await load(`${core}/notes.ts`)
      const { createBookService } = await load(`${core}/books.ts`)
      const { createTagService } = await load(`${core}/tags.ts`)
      const clock = createClock(newNodeId())
      const newId = createIdGenerator()
      const bookService = createBookService({ storage, clock, newId })
      const tagService = createTagService({ storage, clock, newId })
      const noteService = createNoteService({ storage, clock, newId, compact: false })

      const { TEMPLATES_BOOK_ID } = await load(`${core}/books.ts`)
      const bookIds: Record<string, string> = { templates: TEMPLATES_BOOK_ID }
      for (const book of books) {
        const id = await bookService.create(book.name, book.parent ? bookIds[book.parent] : null)
        await bookService.setIcon(id, book.icon, book.color)
        bookIds[book.key] = id
      }
      const tagIds: Record<string, string> = {}
      for (const tag of tags) {
        const id = await tagService.ensure(tag.name)
        await tagService.setColor(id, tag.color)
        tagIds[tag.name] = id
      }
      const noteIds: Record<string, string> = {}
      for (const note of [...notes].reverse()) {
        noteIds[note.key] = await noteService.create(
          note.title,
          note.book ? bookIds[note.book] : null,
        )
      }
      const minute = 60_000
      const linked = (body: string) =>
        body.replace(/\{\{note:(\w+)\}\}/g, (_: string, key: string) => {
          if (!noteIds[key]) throw new Error(`E_DEMO_LINK ${key}`)
          return `devot://note/${noteIds[key]}`
        })
      for (const note of notes) {
        const id = noteIds[note.key]
        // Each body in its own session: the next session's first change keeps it as a version.
        for (const earlier of note.history ?? []) {
          await noteService.setBody(id, linked(earlier.body))
          await noteService.release(id)
        }
        await noteService.setBody(id, linked(note.body))
        if (note.status !== 'none') await noteService.setStatus(id, note.status)
        if (note.pinned) await noteService.setPinned(id, true)
        for (const tag of note.tags) await tagService.putOnNote(id, tagIds[tag])
        await noteService.setDates(id, {
          createdAt: now - note.created * minute,
          updatedAt: now - note.updated * minute,
        })
        await noteService.release(id)
      }
      // Versions are dated when they were seeded, a moment ago; spread them as if written over days.
      const revisions = JSON.parse(localStorage.getItem('devot.test.revisions') ?? '[]') as {
        noteId: string
        kind: string
        at: number
      }[]
      for (const note of notes) {
        if (!note.history) continue
        const own = revisions
          .filter((r) => r.noteId === noteIds[note.key] && r.kind === 'body')
          .sort((a, b) => a.at - b.at)
        own.forEach((revision, i) => {
          const version = note.history![i]
          if (version) revision.at = now - version.at * minute
        })
        for (const event of revisions.filter(
          (r) => r.noteId === noteIds[note.key] && r.kind !== 'body',
        )) {
          event.at = now - note.created * minute
        }
      }
      localStorage.setItem('devot.test.revisions', JSON.stringify(revisions))
      return noteIds
    },
    {
      books: BOOKS,
      tags: TAGS,
      notes: NOTES,
      now: Date.now(),
      core: `/@fs${realpathSync(devotDir)}/src/core`,
      view: preferences,
    },
  )
  await page.reload()
  await page.locator('.window[data-ready]').waitFor()
  return ids
}
