export const en = {
  siteName: 'Devot',
  meta: {
    title: 'Devot: local-first Markdown notes for macOS',
    description:
      'Local-first Markdown notes for macOS. Your notes stay on your Mac, in your hands.',
    ogLocale: 'en_US',
  },
  hero: {
    title: 'Local-first Markdown notes for macOS.',
    lead: 'Your notes stay on your Mac, in your hands.',
  },
  download: {
    label: 'Download for macOS',
    requirements: 'macOS 26+ · Apple Silicon',
  },
  footer: {
    source: 'Source on GitHub',
    copyright: (year: number) => `© ${year} Devot`,
  },
}

export type Messages = typeof en
