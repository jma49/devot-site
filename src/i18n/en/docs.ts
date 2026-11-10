import { numberWord } from '../../lib/words.ts'
import { DOWNLOAD_URL, PLATFORM, REPO_URL, TRIAL_DAYS } from '../../site.ts'

/** Text, `code` in the monospaced face, or a link to an absolute or site-relative address. */
export type DocRun = string | { code: string } | { text: string; href: string }

export type DocBlock =
  | { kind: 'text'; runs: DocRun[] }
  | { kind: 'list'; ordered?: boolean; items: DocRun[][] }
  /** `label` names the block for assistive technology: what the reader would run or paste it into. */
  | { kind: 'code'; label: string; lines: string[] }

export interface DocSection {
  /** The section's anchor, unique on its page. */
  id: string
  title: string
  blocks: DocBlock[]
}

export interface DocPage {
  /** The page's address under `/docs/`. */
  slug: string
  title: string
  description: string
  heading: string
  intro: string
  /** One line on the docs index. */
  summary: string
  sections: DocSection[]
}

const text = (...runs: DocRun[]): DocBlock => ({ kind: 'text', runs })
const list = (...items: DocRun[][]): DocBlock => ({ kind: 'list', items })
const steps = (...items: DocRun[][]): DocBlock => ({ kind: 'list', ordered: true, items })
const blob = (path: string) => `${REPO_URL}/blob/main/${path}`

const APP = '/Applications/Devot.app/Contents/MacOS/devot'

const install: DocPage = {
  slug: 'install',
  title: 'Devot: install and update',
  description: `Download Devot for ${PLATFORM.os} on ${PLATFORM.processor}, open it the first time, and how updates arrive in the app.`,
  heading: 'Install and update',
  intro: 'Devot comes as a signed, notarised disk image from its GitHub releases.',
  summary: 'Download Devot, open it the first time, and keep it up to date.',
  sections: [
    {
      id: 'requirements',
      title: 'What you need',
      blocks: [
        text(
          `A Mac with ${PLATFORM.processor} running ${PLATFORM.os}. No account, no sign-in and no connection are needed to write.`,
        ),
      ],
    },
    {
      id: 'download',
      title: 'Download and open',
      blocks: [
        steps(
          [
            'Download the latest ',
            { code: 'Devot_<version>_aarch64.dmg' },
            ' from the ',
            { text: 'latest release', href: DOWNLOAD_URL },
            '.',
          ],
          ['Open the disk image and drag Devot to Applications.'],
          [
            "Open Devot from Applications. Releases are signed with Devot's Developer ID and notarised by Apple, so they open without a warning.",
          ],
        ),
        text(
          'If macOS only offers Move to Trash, open System Settings > Privacy & Security and choose Open Anyway.',
        ),
      ],
    },
    {
      id: 'trial',
      title: 'The trial',
      blocks: [
        text(
          `The ${numberWord(TRIAL_DAYS)}-day free trial starts the first time you open Devot, with everything included. After it, Devot is read-only until you add a licence: every note can still be read, searched, copied and exported.`,
        ),
      ],
    },
    {
      id: 'updates',
      title: 'Updates',
      blocks: [
        text(
          'Devot checks for updates shortly after launch and then daily, or when you choose Devot > Check for Updates. It downloads an update in the background and offers Restart to Update.',
        ),
      ],
    },
  ],
}

const aiTools: DocPage = {
  slug: 'ai-tools',
  title: 'Devot: connect Claude Code, Codex and other MCP clients',
  description:
    'Let Claude Code, Codex, Claude Desktop and other MCP clients search, read and edit your Devot notes, only in the notebooks you allow.',
  heading: 'AI tools and MCP',
  intro:
    'Claude Code, Codex, Claude Desktop and other MCP clients can work with your notes through Devot, on this Mac only, and only in notebooks you allow.',
  summary: 'Connect Claude Code, Codex or Claude Desktop to your notes over MCP.',
  sections: [
    {
      id: 'access',
      title: 'Choose what they can see',
      blocks: [
        text(
          'Only notebooks with Allow AI Access on are visible. Right-click a notebook in the sidebar and choose Allow AI Access; a sparkle marks the notebooks that have it. A sub-notebook needs its own switch.',
        ),
        text(
          'Notes in the Trash and notes in no notebook are never visible. Settings > Integrations > AI Tools turns AI tools off altogether, or limits them to Read Only.',
        ),
      ],
    },
    {
      id: 'connect',
      title: 'Connect a client',
      blocks: [
        steps(
          ['Install Devot in Applications. Connect waits while it runs from the disk image.'],
          [
            'Open Settings > Integrations and choose Connect for Claude Code, Codex or Claude Desktop.',
          ],
          [
            'Check the file and the text Devot shows, then confirm. Devot keeps everything else in the file and a backup beside it; the token stays in your keychain.',
          ],
          ['Restart the client.'],
        ),
        text(
          "Nothing else needs to be installed: the client runs a small bridge inside Devot's own app, which talks to the running Devot on this Mac only.",
        ),
      ],
    },
    {
      id: 'by-hand',
      title: 'Set it up by hand',
      blocks: [
        text(
          'Set Up by Hand, at the end of the Clients card in Settings, has the configuration for these clients and any other. On a default install, for Claude Code:',
        ),
        {
          kind: 'code',
          label: 'Terminal command for Claude Code',
          lines: [`claude mcp add --scope user devot -- ${APP} --cli mcp`],
        },
        text('And for Codex, in ', { code: '~/.codex/config.toml' }, ':'),
        {
          kind: 'code',
          label: 'Codex configuration',
          lines: ['[mcp_servers.devot]', `command = "${APP}"`, 'args = ["--cli", "mcp"]'],
        },
      ],
    },
    {
      id: 'tools',
      title: 'What a client can do',
      blocks: [
        list(
          [{ code: 'list_notebooks' }, ': the notebooks it can see'],
          [{ code: 'search_notes' }, ': full-text search, with snippets'],
          [{ code: 'read_note' }, ": a note's Markdown and metadata"],
          [{ code: 'list_tags' }, ': the tags'],
          [{ code: 'create_note' }, ': a note in an allowed notebook'],
          [
            { code: 'update_note' },
            ': the title, the whole body or exact passages, the notebook, tags and status',
          ],
          [{ code: 'append_to_note' }, ': text at the end or start of a section or of the note'],
          [{ code: 'trash_note' }, ': moves a note to the Trash'],
          [{ code: 'create_notebook' }, ': a notebook with Allow AI Access on'],
        ),
        text(
          'Edits apply directly. Before each one, Devot keeps the note as it was in its Revision History, so you can restore it. Changes appear in a moment, merged into a note you are editing without moving the caret.',
        ),
      ],
    },
    {
      id: 'background',
      title: 'When Devot is closed',
      blocks: [
        text(
          'When a client asks and Devot is closed, Devot starts in the background with no window and an icon in the menu bar, and quits by itself after 10 minutes without a request. Turn Start in the Background off in Settings > Integrations > AI Tools and clients get a clear error until you open Devot.',
        ),
        text(
          'What reaches a client, and what does not, is set out in ',
          { text: 'AI tools privacy', href: '/mcp-privacy' },
          '.',
        ),
      ],
    },
  ],
}

const mirror: DocPage = {
  slug: 'markdown-mirror',
  title: 'Devot: keep every note as a Markdown file',
  description:
    'The Markdown mirror keeps a folder up to date with every Devot note as a Markdown file, for Git, grep, Spotlight and other editors to read.',
  heading: 'Markdown mirror',
  intro:
    'Devot can keep a folder you choose up to date with every note as a Markdown file, laid out like an export.',
  summary: 'Keep a folder of Markdown files in step with every note.',
  sections: [
    {
      id: 'turn-on',
      title: 'Turn it on',
      blocks: [
        text(
          'Open Settings > Mirror, or choose Choose Markdown Mirror Folder in the command palette, and pick a folder. Devot writes a folder per notebook, a file per note and images in an ',
          { code: 'attachments' },
          ' folder. Include Attachments, on by default, decides whether images are copied.',
        ),
        text(
          'Templates and the Trash are left out. Importing the folder gives the same notes back.',
        ),
      ],
    },
    {
      id: 'one-way',
      title: 'It only writes',
      blocks: [
        text(
          'The folder is written by Devot and never read back: edit notes in Devot. Git, grep, Spotlight, other editors and agents can read your notes there without an export.',
        ),
        list(
          [
            'A mirrored file you change elsewhere is never overwritten: Devot renames it to ',
            { code: '<name> (edited outside Devot).md' },
            ', tells you, and writes its own version.',
          ],
          ['Files Devot did not write are never changed.'],
          [
            'If the folder goes missing, such as an unplugged drive, the mirror pauses and resumes once it can write again.',
          ],
        ),
      ],
    },
  ],
}

const importExport: DocPage = {
  slug: 'import-export',
  title: 'Devot: import and export Markdown',
  description:
    'Bring Markdown files, a Markdown folder with its images or HTML into Devot, and export notes as Markdown, HTML or PDF.',
  heading: 'Import and export',
  intro: 'Your notes go in and out of Devot as Markdown, with their images.',
  summary: 'Bring Markdown folders in, and take notes out as Markdown, HTML or PDF.',
  sections: [
    {
      id: 'import',
      title: 'Import',
      blocks: [
        list(
          ['Markdown files, into a notebook you choose.'],
          [
            'A Markdown folder with its images: every folder inside it that holds notes becomes a notebook, nested as on disk, and local images become attachments.',
          ],
          ['HTML files, cleaned and converted to Markdown.'],
        ),
        text(
          "Choose File > Import, or Import in a notebook's menu to import straight into it. A note takes its title from its first heading, else its file name; front matter that a Devot export wrote also brings back the title, tags and status. Devot lists every file or image it could not import, with the reason.",
        ),
      ],
    },
    {
      id: 'export',
      title: 'Export',
      blocks: [
        list(
          ['A note, a selection, a notebook or all notes, as Markdown or HTML.'],
          ['A note as PDF, or printed.'],
        ),
        text(
          'Export keeps working when the trial has ended without a licence. To keep a folder of Markdown up to date all the time, use the ',
          { text: 'Markdown mirror', href: '/docs/markdown-mirror' },
          '.',
        ),
      ],
    },
  ],
}

const sync: DocPage = {
  slug: 'sync',
  title: 'Devot: end-to-end encrypted sync without an account',
  description:
    'Sync Devot between your devices through a relay you deploy yourself, end-to-end encrypted, with no Devot account.',
  heading: 'Sync',
  intro:
    'Devot syncs through a relay you deploy, on your own Cloudflare account with no paid plan, or on a server of your own. There is no Devot account.',
  summary: 'Sync your devices end-to-end encrypted, through a relay you run.',
  sections: [
    {
      id: 'how',
      title: 'How it works',
      blocks: [
        text(
          'The relay stores the latest encrypted state of each note, notebook, tag and image, and tells your devices when something changed. It never decrypts and never merges: notes are sealed on your devices under a vault key the relay never sees.',
        ),
      ],
    },
    {
      id: 'relay',
      title: 'Deploy a relay',
      blocks: [
        text(
          "The relay's code is in Devot's repository. Deploy it to your own Cloudflare account, where it needs no paid plan, or run it with Node behind a TLS proxy. ",
          { text: 'The relay guide', href: blob('docs/sync-relay.md') },
          ' has the steps.',
        ),
      ],
    },
    {
      id: 'devices',
      title: 'Add your devices',
      blocks: [
        text(
          'The first device creates the vault and shows a recovery key. A new device joins with a one-time pairing code that a syncing device shows as text and as a QR code for 10 minutes, or with the recovery key when no other device is at hand.',
        ),
        text(
          "Keep the recovery key somewhere safe: with the relay's address, it is the only way to reach the vault without another device.",
        ),
      ],
    },
  ],
}

const search: DocPage = {
  slug: 'search',
  title: 'Devot: search syntax for your notes',
  description:
    'Search every Devot note by word or phrase, and narrow it by notebook, tag, status, title, body or pinned, or rule things out with a minus.',
  heading: 'Search',
  intro:
    "Words and quoted phrases must all appear in a note's title or body, in any case. Qualifiers narrow the search further.",
  summary: 'Find any note with words, phrases and qualifiers.',
  sections: [
    {
      id: 'where',
      title: 'Where to search',
      blocks: [
        list(
          [
            { code: 'Shift Command F' },
            ' searches the current view: the selected notebook or filter stays.',
          ],
          [{ code: 'Shift Option Command F' }, ' searches every note.'],
          ['The ? button in the search field lists the syntax.'],
        ),
      ],
    },
    {
      id: 'qualifiers',
      title: 'Qualifiers',
      blocks: [
        list(
          [{ code: 'title:' }, ' and ', { code: 'body:' }, ': text in that part of the note only'],
          [
            { code: 'book:' },
            ' or ',
            { code: 'in:' },
            ': a notebook and its sub-notebooks, such as ',
            { code: 'book:"Weekly notes"' },
          ],
          [{ code: 'tag:' }, ' or ', { code: '#name' }, ': notes with that tag'],
          [
            { code: 'status:' },
            ' or ',
            { code: 'is:' },
            ': a status, such as ',
            { code: 'status:active' },
            ' or ',
            { code: 'is:"On Hold"' },
          ],
          [{ code: 'pinned:true' }, ' or ', { code: 'pinned:false' }],
        ),
        text(
          'Clauses combine, so repeating a qualifier narrows further. A leading minus excludes what a clause matches: ',
          { code: '-draft' },
          ', ',
          { code: '-tag:done' },
          '. Names match in any case; quote a name with spaces.',
        ),
        {
          kind: 'code',
          label: 'Example search',
          lines: ['book:Work tag:meeting "next steps" -is:dropped'],
        },
      ],
    },
    {
      id: 'saved',
      title: 'Saved searches',
      blocks: [
        text(
          'Save a search under a name and the sidebar lists it with a live count. It runs again each time, so it always shows what matches now, and renaming a tag updates the saved searches that name it.',
        ),
      ],
    },
  ],
}

const templates: DocPage = {
  slug: 'templates',
  title: 'Devot: note templates with front matter and date placeholders',
  description:
    'Start Devot notes from templates that set the notebook, tags and status, and fill in placeholders such as {{date}}, {{time}} and {{title}}.',
  heading: 'Templates',
  intro:
    'A template is a note that new notes start from. Its front matter sets where the note goes, and placeholders fill themselves in.',
  summary: 'Start notes from templates with front matter and placeholders.',
  sections: [
    {
      id: 'make',
      title: 'Make a template',
      blocks: [
        text(
          'Templates are listed in the sidebar under Templates. Choose New Note there to make one, and write it like any note.',
        ),
        text(
          'To start a note from one, press ',
          { code: 'Command T' },
          ' or choose New Note from Template in the command palette. The picker shows the templates you used last first, with a preview of the note it would make.',
        ),
      ],
    },
    {
      id: 'front-matter',
      title: 'Front matter',
      blocks: [
        text(
          "Four keys set the new note's defaults and are then removed from it: ",
          { code: 'title' },
          ', ',
          { code: 'notebook' },
          ' (a name or a path such as ',
          { code: 'Work/Meetings' },
          '), ',
          { code: 'tags' },
          ' and ',
          { code: 'status' },
          '. Every other key stays in the note.',
        ),
        {
          kind: 'code',
          label: 'Template with front matter',
          lines: [
            '---',
            'title: Standup {{date}}',
            'notebook: Work/Meetings',
            'tags: [standup]',
            'status: active',
            '---',
            '',
            '## {{date:dddd, D MMMM}}',
            '',
            '- Yesterday:',
            '- Today:',
            '- Blocked by:',
          ],
        },
      ],
    },
    {
      id: 'placeholders',
      title: 'Placeholders',
      blocks: [
        list(
          [{ code: '{{date}}' }, ': the date, as YYYY-MM-DD'],
          [{ code: '{{time}}' }, ': the time, as HH:mm'],
          [{ code: '{{datetime}}' }, ': both, as YYYY-MM-DD HH:mm'],
          [{ code: '{{title}}' }, ": the new note's title"],
          [{ code: '{{uuid}}' }, ': a random ID, the same everywhere in one note'],
        ),
        text(
          'Dates and times take a format after a colon, such as ',
          { code: '{{date:dddd, D MMMM}}' },
          '. Text in square brackets is kept as written.',
        ),
      ],
    },
  ],
}

export const docsCopy = {
  docs: {
    index: {
      title: 'Devot: docs',
      description:
        'How to install Devot, connect AI tools over MCP, sync without an account, keep a Markdown mirror and move notes in and out.',
      heading: 'Docs',
      intro: 'How to set Devot up and get the most from it.',
      listLabel: 'Guides',
    },
    onThisPage: 'On this page',
    allDocs: 'All docs',
    pages: [install, aiTools, sync, search, templates, mirror, importExport] satisfies DocPage[],
  },
}
