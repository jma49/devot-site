// Fills a real Devot database with the clips' library, through Devot's own core services and its
// SQLite store: `pnpm media:device` copies this file into the Devot checkout's tests/ and runs it
// there with Vitest (the store needs Vite's import.meta.glob). MEDIA_DB names the database, MEDIA_LIBRARY the
// library module (scripts/media/library.ts) and MEDIA_IDS the JSON file for the note IDs.
import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { TEMPLATES_BOOK_ID, createBookService } from '../src/core/books'
import { createClock, newNodeId } from '../src/core/hlc'
import { createIdGenerator } from '../src/core/ids'
import { createNoteService } from '../src/core/notes'
import { createTagService } from '../src/core/tags'
import { openSqliteAdapter } from '../src/mcp/sqlite'

interface DemoNote {
  key: string
  title: string
  book: string | null
  body: string
  status: string
  pinned?: boolean
  tags: string[]
  created: number
  updated: number
  history?: { body: string; at: number }[]
}

it('seeds the media library', async () => {
  const env = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`E_MEDIA_SEED_ENV ${name}`)
    return value
  }
  const library = (await import(/* @vite-ignore */ env('MEDIA_LIBRARY'))) as {
    BOOKS: { key: string; name: string; parent?: string; icon: string; color: string }[]
    TAGS: { name: string; color: string }[]
    NOTES: DemoNote[]
  }
  const storage = openSqliteAdapter(env('MEDIA_DB'))
  try {
    const clock = createClock(newNodeId())
    const newId = createIdGenerator()
    const books = createBookService({ storage, clock, newId })
    const tags = createTagService({ storage, clock, newId })
    const notes = createNoteService({ storage, clock, newId, compact: false })
    const now = Date.now()
    const minute = 60_000

    const bookIds: Record<string, string> = { templates: TEMPLATES_BOOK_ID }
    for (const book of library.BOOKS) {
      const id = await books.create(book.name, book.parent ? bookIds[book.parent]! : null)
      await books.setIcon(id, book.icon as never, book.color as never)
      bookIds[book.key] = id
    }
    const tagIds: Record<string, string> = {}
    for (const tag of library.TAGS) {
      const id = await tags.ensure(tag.name)
      await tags.setColor(id, tag.color as never)
      tagIds[tag.name] = id
    }
    const noteIds: Record<string, string> = {}
    for (const note of [...library.NOTES].reverse()) {
      noteIds[note.key] = await notes.create(note.title, note.book ? bookIds[note.book]! : null)
    }
    const linked = (body: string) =>
      body.replace(/\{\{note:(\w+)\}\}/g, (_, key: string) => {
        if (!noteIds[key]) throw new Error(`E_DEMO_LINK ${key}`)
        return `devot://note/${noteIds[key]}`
      })
    for (const note of library.NOTES) {
      const id = noteIds[note.key]!
      for (const earlier of note.history ?? []) {
        await notes.setBody(id, linked(earlier.body))
        await notes.release(id)
      }
      await notes.setBody(id, linked(note.body))
      if (note.status !== 'none') await notes.setStatus(id, note.status as never)
      if (note.pinned) await notes.setPinned(id, true)
      for (const tag of note.tags) await tags.putOnNote(id, tagIds[tag]!)
      await notes.setDates(id, {
        createdAt: now - note.created * minute,
        updatedAt: now - note.updated * minute,
      })
      await notes.release(id)
    }
    // Versions are dated when they were seeded; spread them as if written over days.
    const db = storage.db
    for (const note of library.NOTES) {
      if (!note.history) continue
      const id = noteIds[note.key]!
      const versions = db
        .prepare(`SELECT id FROM revisions WHERE note_id = ? AND kind = 'body' ORDER BY at, id`)
        .all(id) as { id: number }[]
      versions.forEach((row, i) => {
        const version = note.history![i]
        if (version) {
          db.prepare('UPDATE revisions SET at = ? WHERE id = ?').run(
            now - version.at * minute,
            row.id,
          )
        }
      })
      db.prepare(`UPDATE revisions SET at = ? WHERE note_id = ? AND kind != 'body'`).run(
        now - note.created * minute,
        id,
      )
    }
    expect(Object.keys(noteIds)).toHaveLength(library.NOTES.length)
    writeFileSync(env('MEDIA_IDS'), JSON.stringify(noteIds))
  } finally {
    storage.close()
  }
})
