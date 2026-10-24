export type DemoStatus = 'active' | 'on_hold' | 'completed' | 'dropped' | 'none'

export interface DemoNote {
  title: string
  book: string
  status: DemoStatus
}

const playClip = 'Play clip'

export const demoCopy = {
  demo: {
    label: 'Try it',
    title: 'Filter by status',
    hint: 'Pick a status, as in the sidebar, and the list keeps only its notes. Pick it again to see them all.',
    filtersLabel: 'Filter the sample notes by status',
    listLabel: 'Sample notes',
    all: 'All Notes',
    statuses: {
      active: 'Active',
      on_hold: 'On Hold',
      completed: 'Completed',
      dropped: 'Dropped',
      none: 'No Status',
    } satisfies Record<DemoStatus, string>,
    searchLabel: 'Same as searching',
    summary: (name: string, shown: number, total: number) =>
      shown === total ? `${name}: ${total} notes` : `${name}: ${shown} of ${total} notes`,
    notes: [
      { title: 'Spring launch plan', book: 'Spring launch', status: 'active' },
      { title: 'Landing page copy', book: 'Spring launch', status: 'on_hold' },
      { title: 'Retry with backoff', book: 'Projects', status: 'active' },
      { title: 'Design sync, 21 October', book: 'Meetings', status: 'completed' },
      { title: 'Studio acoustics', book: 'Home studio', status: 'on_hold' },
      { title: 'Morning pages', book: 'Journal', status: 'none' },
      { title: 'Pricing experiments', book: 'Spring launch', status: 'dropped' },
      { title: 'Rosemary focaccia', book: 'Kitchen', status: 'completed' },
      { title: 'Reading list', book: 'Reading', status: 'active' },
    ] satisfies DemoNote[],
  },
  clipControl: {
    label: playClip,
    named: (clip: string) => `${playClip}: ${clip}`,
  },
}
