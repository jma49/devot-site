/** Devot's note statuses, in the order its sidebar lists them. */
export const STATUSES = ['active', 'on_hold', 'completed', 'dropped', 'none'] as const

export type NoteStatus = (typeof STATUSES)[number]
export type StatusFilter = NoteStatus | 'all'

/** Choosing the status already chosen shows every note again, as a second click does in Devot. */
export function nextFilter(current: StatusFilter, chosen: StatusFilter): StatusFilter {
  return chosen === current ? 'all' : chosen
}

export function shows(filter: StatusFilter, status: NoteStatus): boolean {
  return filter === 'all' || filter === status
}

export function statusCounts(statuses: readonly NoteStatus[]): Record<StatusFilter, number> {
  const counts = { all: statuses.length, active: 0, on_hold: 0, completed: 0, dropped: 0, none: 0 }
  for (const status of statuses) counts[status] += 1
  return counts
}

/** The search that finds the same notes in Devot. */
export function searchQuery(filter: StatusFilter): string {
  return filter === 'all' ? '' : `status:${filter}`
}

/**
 * Wires each `[data-status-demo]`: its `[data-filter]` buttons narrow the `[data-status]` notes,
 * and the list head, the search line and the live region follow. Text comes from the markup.
 */
export function initStatusDemo(root: ParentNode = document): () => void {
  const stops = [...root.querySelectorAll<HTMLElement>('[data-status-demo]')].map((demo) => {
    const buttons = [...demo.querySelectorAll<HTMLButtonElement>('button[data-filter]')]
    const notes = [...demo.querySelectorAll<HTMLElement>('[data-status]')]
    const part = (name: string) => demo.querySelector<HTMLElement>(`[data-demo-${name}]`)
    const [title, query, search, live] = ['title', 'query', 'search', 'live'].map(part)
    let filter: StatusFilter = 'all'

    const apply = (next: StatusFilter) => {
      filter = next
      const chosen = buttons.find((button) => button.dataset['filter'] === filter)
      for (const button of buttons) button.setAttribute('aria-pressed', String(button === chosen))
      for (const note of notes) note.hidden = !shows(filter, note.dataset['status'] as NoteStatus)
      if (title) title.textContent = chosen?.dataset['name'] ?? ''
      if (query) query.textContent = searchQuery(filter)
      if (search) search.hidden = filter === 'all'
      if (live) live.textContent = chosen?.dataset['summary'] ?? ''
    }
    const onClick = (event: Event) => {
      const button = (event.target as Element).closest<HTMLElement>('button[data-filter]')
      if (button) apply(nextFilter(filter, button.dataset['filter'] as StatusFilter))
    }

    demo.addEventListener('click', onClick)
    demo.setAttribute('data-status-demo-ready', '')
    return () => {
      demo.removeEventListener('click', onClick)
      demo.removeAttribute('data-status-demo-ready')
    }
  })
  return () => stops.forEach((stop) => stop())
}
