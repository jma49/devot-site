import { REPO_URL } from '../../site.ts'
import type { DocBlock, DocRun, DocSection } from './docs.ts'

export interface BlogPost {
  slug: string
  title: string
  description: string
  heading: string
  /** The first paragraph, also the post's summary on the blog index. */
  intro: string
  /** ISO date the post went up. */
  published: string
  /** The same date as the page shows it. */
  publishedLabel: string
  sections: DocSection[]
}

const text = (...runs: DocRun[]): DocBlock => ({ kind: 'text', runs })
const list = (...items: DocRun[][]): DocBlock => ({ kind: 'list', items })
const blob = (path: string) => `${REPO_URL}/blob/main/${path}`
const APP = '/Applications/Devot.app/Contents/MacOS/devot'

const mcp: BlogPost = {
  slug: 'claude-code-markdown-notes-mcp',
  title: 'Give Claude Code your Markdown notes, one notebook at a time · Devot',
  description:
    'How to let Claude Code, Codex or Claude Desktop search, read and edit your Markdown notes over MCP, while keeping every other notebook out of reach.',
  heading: 'Give Claude Code your Markdown notes, one notebook at a time',
  intro:
    'An AI coding agent is far more useful when it can read your notes: the design notes, the meeting log, the list of things you tried. Devot lets it, over MCP, without handing it everything you have written.',
  published: '2026-11-10',
  publishedLabel: 'Published 10 November 2026',
  sections: [
    {
      id: 'why',
      title: 'Why scope matters',
      blocks: [
        text(
          'Most notes are not meant for an agent. A journal, a health log or a draft letter has no place in a coding session, and an agent that can search everything will find them.',
        ),
        text(
          'So Devot starts from nothing. An MCP client sees no notebook until you switch Allow AI Access on for it, and a sub-notebook needs its own switch. Notes in the Trash, and notes in no notebook, are never visible.',
        ),
      ],
    },
    {
      id: 'connect',
      title: 'Connect it in a minute',
      blocks: [
        text(
          'In Devot, open Settings > Integrations and choose Connect for Claude Code, Codex or Claude Desktop. Devot shows the file it will change and the exact text first, keeps a backup beside it, and keeps the token in your keychain rather than in the file. Restart the client and it is done.',
        ),
        text(
          'If you prefer to do it by hand, this is the Claude Code command on a default install:',
        ),
        {
          kind: 'code',
          label: 'Terminal command for Claude Code',
          lines: [`claude mcp add --scope user devot -- ${APP} --cli mcp`],
        },
        text(
          'Nothing else is installed. The client runs a small bridge inside Devot itself, which talks only to the Devot running on the same Mac.',
        ),
      ],
    },
    {
      id: 'use',
      title: 'What to ask it',
      blocks: [
        list(
          ['Find my notes on the sync protocol and summarise what we decided.'],
          ['Add what we just changed to the Decisions section of the release note.'],
          ['Create a note in Research with the three options we compared, and tag it review.'],
          ['List the notes in Projects that are still Active.'],
        ),
        text(
          'The agent can search, read, create, edit, append to a section and move a note to the Trash, in the notebooks you allowed. Settings > Integrations > AI Tools can limit it to Read Only.',
        ),
      ],
    },
    {
      id: 'undo',
      title: 'Every edit can be undone',
      blocks: [
        text(
          'Edits apply straight away, so Devot keeps the note as it was in its Revision History before each one. If an agent rewrites a paragraph you liked, open the note menu and restore the earlier version.',
        ),
        text(
          'An edit to a note you have open is merged in as you type, without moving the caret or touching your undo history.',
        ),
      ],
    },
    {
      id: 'next',
      title: 'Try it',
      blocks: [
        text(
          'The setup guide lists every tool a client can call and what happens when Devot is closed: ',
          { text: 'AI tools and MCP', href: '/docs/ai-tools' },
          '.',
        ),
      ],
    },
  ],
}

const sync: BlogPost = {
  slug: 'sync-notes-without-an-account',
  title: 'Sync notes between your devices without an account · Devot',
  description:
    'Devot syncs through a relay you deploy yourself, end-to-end encrypted, with no Devot account. What the relay sees, what it costs and how devices join.',
  heading: 'Sync notes between your devices without an account',
  intro:
    'Devot has no accounts, so it has no server of ours to sync through. Instead it syncs through a relay you deploy, and the relay never sees a word you wrote.',
  published: '2026-11-10',
  publishedLabel: 'Published 10 November 2026',
  sections: [
    {
      id: 'relay',
      title: 'What the relay does',
      blocks: [
        text(
          'The relay keeps the latest encrypted state of each note, notebook, tag and image, and tells your other devices when something changed. It does not decrypt and does not merge. Merging happens on your devices, which hold the vault key.',
        ),
        text(
          'The relay even files records under names derived from a key it does not have, so it cannot tell which record is which note, or when one was made.',
        ),
      ],
    },
    {
      id: 'cost',
      title: 'What it costs to run',
      blocks: [
        text(
          'The relay runs on your own Cloudflare account with no paid plan, or with Node on a server of your own. On Cloudflare it keeps each vault under 80% of the account limits it can count, and pauses sync until the daily reset rather than run up a bill.',
        ),
        text(
          'Deploying it takes a few commands from the repository: ',
          { text: 'the relay guide', href: blob('docs/sync-relay.md') },
          ' has them.',
        ),
      ],
    },
    {
      id: 'join',
      title: 'How a device joins',
      blocks: [
        text(
          'The first device creates the vault and shows a recovery key once. To add another, a syncing device shows a one-time pairing code, as text and as a QR code, for 10 minutes. The secret in that code never reaches the relay.',
        ),
        text(
          'With no other device at hand, the recovery key and the relay address are enough to join.',
        ),
      ],
    },
    {
      id: 'next',
      title: 'Set it up',
      blocks: [
        text('The short version is in the docs: ', { text: 'Sync', href: '/docs/sync' }, '.'),
      ],
    },
  ],
}

const mirror: BlogPost = {
  slug: 'markdown-notes-in-git',
  title: 'Keep your notes in Git and grep with a Markdown mirror · Devot',
  description:
    'Devot can keep a folder of Markdown files in step with every note, so Git, grep, Spotlight and agents can read your notes without an export.',
  heading: 'Keep your notes in Git, grep and Spotlight with a Markdown mirror',
  intro:
    'Devot stores notes in a SQLite database, which is what makes search, history and sync fast. But a folder of plain Markdown files is what every other tool understands. The mirror gives you both.',
  published: '2026-11-10',
  publishedLabel: 'Published 10 November 2026',
  sections: [
    {
      id: 'what',
      title: 'A folder that keeps itself up to date',
      blocks: [
        text(
          'Choose a folder in Settings > Mirror and Devot writes every note there as a Markdown file: a folder per notebook, a file per note, images in an ',
          { code: 'attachments' },
          ' folder. From then on, every change you make is written there too.',
        ),
      ],
    },
    {
      id: 'git',
      title: 'Put it under Git',
      blocks: [
        text('Make the mirror folder a repository and commit when you like:'),
        {
          kind: 'code',
          label: 'Terminal commands to commit the mirror',
          lines: ['cd ~/Notes', 'git init', 'git add -A && git commit -m "Notes"'],
        },
        text(
          'Now grep, Spotlight, your editor and any agent with file access can read your notes, and Git keeps a history alongside the Revision History Devot keeps itself.',
        ),
      ],
    },
    {
      id: 'safe',
      title: 'It never fights you',
      blocks: [
        text(
          'The mirror only writes. If you edit a mirrored file by mistake, Devot does not overwrite it: it renames your copy with "(edited outside Devot)" and writes its own beside it. Files Devot did not write are never touched.',
        ),
        text('More in the docs: ', { text: 'Markdown mirror', href: '/docs/markdown-mirror' }, '.'),
      ],
    },
  ],
}

const tauri: BlogPost = {
  slug: 'why-devot-runs-on-tauri',
  title: 'A 9.5 MB notes app: why Devot runs on Tauri · Devot',
  description:
    'Devot moved from Electron to Tauri. The measurements behind it: bundle size, launch time and memory, and what the switch cost.',
  heading: 'A 9.5 MB notes app: why Devot runs on Tauri',
  intro:
    'A notes app is opened dozens of times a day, so how fast it opens and how much it weighs matter more than in most apps. That is why Devot moved its shell from Electron to Tauri.',
  published: '2026-11-10',
  publishedLabel: 'Published 10 November 2026',
  sections: [
    {
      id: 'numbers',
      title: 'What we measured',
      blocks: [
        text(
          'The same CodeMirror page with a 10,000-character note, on an M1 Pro with a 120 Hz display:',
        ),
        list(
          ['App bundle: 288 MB for the Electron runtime alone, 9.5 MB for Tauri.'],
          ['Launch to the first editor paint: 891 to 1147 ms on Electron, 583 to 638 ms on Tauri.'],
          ['Memory with the note open: 262 to 279 MB on Electron, about 160 to 230 MB on Tauri.'],
          ['Typing to paint and idle CPU: the same on both, once the 60 fps cap is lifted.'],
        ),
      ],
    },
    {
      id: 'costs',
      title: 'What it cost',
      blocks: [
        text(
          'Tauri uses the system WebKit, which paces rendering at 60 fps unless a private preference is turned off, and the translucent window needs a private API too. Both rule out the Mac App Store, so Devot ships as a signed, notarised download with its own updater.',
        ),
        text(
          'Every private call is guarded and falls back instead of crashing when macOS changes underneath it.',
        ),
      ],
    },
    {
      id: 'more',
      title: 'Read more',
      blocks: [
        text(
          'The whole design, from storage to sync, is in ',
          { text: 'How Devot works', href: blob('docs/architecture.md') },
          '.',
        ),
      ],
    },
  ],
}

export const blogCopy = {
  blog: {
    index: {
      title: 'Devot: blog',
      description:
        'Notes from building Devot: AI tools over MCP, sync without an account, Markdown files and the choices behind a local-first notes app.',
      heading: 'Blog',
      intro: 'Notes from building Devot.',
      listLabel: 'Posts',
    },
    allPosts: 'All posts',
    posts: [mcp, sync, mirror, tauri] satisfies BlogPost[],
  },
}
