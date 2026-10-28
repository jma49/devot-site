import { numberWord } from '../../lib/words.ts'
import { TRIAL_DAYS } from '../../site.ts'

export const privacyCopy = {
  privacy: {
    label: 'Local-first',
    title: 'Your notes live on your Mac.',
    lede: 'Plain Markdown files, once the mirror is on.',
    facts: {
      label: 'Where your notes live and what they need',
      rows: [
        [
          'Stored on your Mac',
          'No account needed',
          'Works offline',
          'Plain Markdown export',
          'Source available, FSL-1.1-MIT',
        ],
        [
          'A Markdown mirror folder',
          'Daily local backups',
          'Version history on your Mac',
          'Imports Markdown and HTML',
        ],
        [
          'Usage data stays on your Mac',
          'Logs carry codes, never notes',
          'AI clients see only notebooks you allow',
        ],
      ],
    },
    body: 'Devot keeps your notes in a SQLite database in your Library folder, and needs no account or connection to write, search, back up or export. Choose a mirror folder and Devot also writes every note there as a Markdown file for Git, Spotlight and other editors to read, and never reads them back.',
    network: {
      summary: 'What does Devot send over the network?',
      items: [
        {
          term: 'Update checks',
          text: 'Release builds ask GitHub for the update feed 30 seconds after launch, then daily (hourly for betas).',
        },
        {
          term: 'Link titles',
          text: 'A page title or GitHub snippet is fetched only when you highlight or pick a paste format that needs one.',
        },
        {
          term: 'Embeds and web images',
          text: 'YouTube and Vimeo embeds load only when you ask. Images you link by https load as written.',
        },
        {
          term: 'Crash reports',
          text: 'Sent only by builds made with a crash-reporting key. They carry error codes and IDs, never note text.',
        },
        {
          term: 'Sync',
          text: 'Notes travel end-to-end encrypted, through a relay you deploy.',
        },
        {
          term: 'AI',
          text: 'Note text goes to the provider whose key you added, and only when you use AI.',
        },
      ],
      footnote:
        'Your note text goes nowhere unless you export it, mirror it, sync it through your relay, send it to your AI provider or let an MCP client read it.',
    },
    link: 'Read how Devot stores your notes',
  },
  closing: {
    label: 'Download Devot',
    title: ['Write on your Mac.', 'Keep what you write.'],
    lead: `A ${numberWord(TRIAL_DAYS)}-day free trial, everything included. Source available under FSL-1.1-MIT.`,
    installNote: 'Signed ad hoc, not notarised, so macOS asks once.',
    links: {
      label: 'More ways in',
      source: 'Source on GitHub',
      releases: 'All releases',
    },
  },
  footer: {
    label: 'Footer',
    tagline: 'Local-first Markdown notes for macOS.',
    copyright: (year: number) => `© ${year} devot.online`,
    licence: 'Source available under FSL-1.1-MIT.',
    backToTop: 'Back to top',
    groups: {
      product: {
        title: 'Product',
        links: {
          features: 'Features',
          cards: 'More features',
          localFirst: 'Local-first',
          pricing: 'Pricing',
          download: 'Download',
        },
      },
      resources: {
        title: 'Resources',
        links: {
          releases: 'Releases',
          install: 'Install steps',
          architecture: 'How Devot works',
          development: 'Development guide',
          mcp: 'devot-mcp (from source)',
        },
      },
      community: {
        title: 'Community',
        links: {
          github: 'Source on GitHub',
          issues: 'Issues',
          pulls: 'Pull requests',
          contributing: 'Contributing',
          milestones: 'Milestones',
        },
      },
      legal: {
        title: 'Legal',
        links: {
          licence: 'FSL-1.1-MIT licence',
          terms: 'Terms of sale',
          refunds: 'Refund policy',
          security: 'Security policy',
          report: 'Report a vulnerability',
        },
      },
    },
  },
}
