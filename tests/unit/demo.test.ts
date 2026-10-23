import { describe, expect, it } from 'vitest'
import { BOOKS, NOTES } from '../../scripts/media/library.ts'
import { demoCopy } from '../../src/i18n/en/demo.ts'
import { nextFilter, searchQuery, shows, STATUSES, statusCounts } from '../../src/scripts/demo.ts'

const { demo, clipControl } = demoCopy

describe('nextFilter', () => {
  it('narrows the list to the status chosen', () => {
    expect(nextFilter('all', 'on_hold')).toBe('on_hold')
    expect(nextFilter('active', 'dropped')).toBe('dropped')
  })

  it('shows every note again when the chosen status is chosen again', () => {
    expect(nextFilter('completed', 'completed')).toBe('all')
  })

  it('stays on every note when All Notes is chosen', () => {
    expect(nextFilter('all', 'all')).toBe('all')
    expect(nextFilter('none', 'all')).toBe('all')
  })
})

describe('shows', () => {
  it('keeps every note for All Notes and only matching notes otherwise', () => {
    for (const status of STATUSES) {
      expect(shows('all', status)).toBe(true)
      for (const filter of STATUSES) expect(shows(filter, status)).toBe(filter === status)
    }
  })
})

describe('statusCounts', () => {
  it('counts each status and the total, with zero for statuses no note has', () => {
    expect(statusCounts(['active', 'none', 'active', 'dropped'])).toEqual({
      all: 4,
      active: 2,
      on_hold: 0,
      completed: 0,
      dropped: 1,
      none: 1,
    })
  })
})

describe('searchQuery', () => {
  it('spells the filter as the status: search Devot understands', () => {
    expect(searchQuery('on_hold')).toBe('status:on_hold')
    expect(searchQuery('none')).toBe('status:none')
    expect(searchQuery('all')).toBe('')
  })
})

describe('status demo copy', () => {
  it('lists the statuses in the order and with the names of Devot’s sidebar', () => {
    expect(STATUSES).toEqual(['active', 'on_hold', 'completed', 'dropped', 'none'])
    expect(Object.keys(demo.statuses)).toEqual([...STATUSES])
    expect(Object.values(demo.statuses)).toEqual([
      'Active',
      'On Hold',
      'Completed',
      'Dropped',
      'No Status',
    ])
    expect(demo.all).toBe('All Notes')
  })

  it('shows six to ten notes and at least one in every status', () => {
    expect(demo.notes.length).toBeGreaterThanOrEqual(6)
    expect(demo.notes.length).toBeLessThanOrEqual(10)
    const counts = statusCounts(demo.notes.map(({ status }) => status))
    for (const status of STATUSES) expect(counts[status], status).toBeGreaterThan(0)
  })

  it('takes its notes from the library the clips show, with the same notebook and status', () => {
    const bookName = new Map(BOOKS.map(({ key, name }) => [key, name]))
    for (const note of demo.notes) {
      const source = NOTES.find(({ title }) => title === note.title)
      expect(source, note.title).toBeDefined()
      expect(note.status, note.title).toBe(source?.status)
      expect(note.book, note.title).toBe(bookName.get(source?.book ?? ''))
    }
    expect(new Set(demo.notes.map(({ title }) => title)).size).toBe(demo.notes.length)
  })

  it('announces how many notes the filter keeps', () => {
    expect(demo.summary('On Hold', 1, 8)).toBe('On Hold: 1 of 8 notes')
    expect(demo.summary(demo.all, 8, 8)).toBe('All Notes: 8 notes')
  })

  it('names the play control for what it does', () => {
    expect(clipControl.label).toMatch(/^Play\b/)
  })
})
