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
          'Open source, MIT licensed',
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
      ],
      footnote:
        'Your note text goes nowhere unless you export it, mirror it or let an MCP client read it.',
    },
    link: 'Read how Devot stores your notes',
  },
  closing: {
    label: 'Download Devot',
    title: ['Write on your Mac.', 'Keep what you write.'],
    lead: 'Open source under the MIT licence. Get the latest release from GitHub.',
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
    copyright: (year: number) => `© ${year} jma49`,
    licence: 'Released under the MIT licence.',
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
          licence: 'MIT licence',
          terms: 'Terms of sale',
          refunds: 'Refund policy',
          security: 'Security policy',
          report: 'Report a vulnerability',
        },
      },
    },
  },
}
