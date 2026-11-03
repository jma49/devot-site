import type { LegalLinkId } from '../../lib/links.ts'
import { numberWord } from '../../lib/words.ts'
import { LICENCE_PRICE, PRIVACY_EMAIL, REFUND_DAYS, TRIAL_DAYS } from '../../site.ts'

/** Text, or a link to one of `LEGAL_LINKS`. */
export type LegalRun = string | { text: string; link: LegalLinkId }

const READ_ONLY =
  'you can read, search, copy and export your notes, but not create or edit them, and sync and AI stop'

export interface LegalPage {
  title: string
  description: string
  heading: string
  intro: string
  sections: { title: string; paragraphs: LegalRun[][] }[]
}

const terms: LegalPage = {
  title: 'Devot: terms of sale',
  description:
    'The Devot trial, what a licence unlocks, what it costs, how refunds work and where to get help.',
  heading: 'Terms of sale',
  intro: 'These terms cover the Devot trial and the licence that unlocks Devot after it.',
  sections: [
    {
      title: 'The trial',
      paragraphs: [
        [
          `Devot starts a ${numberWord(TRIAL_DAYS)}-day free trial the first time you open it, with everything included: editing, sync and AI.`,
        ],
        [
          `When the trial ends without a licence, Devot is read-only: ${READ_ONLY}. Nothing is deleted.`,
        ],
      ],
    },
    {
      title: 'What a licence unlocks',
      paragraphs: [
        [
          'A licence unlocks everything in Devot, in every future version, on up to three devices at a time. Sync is end-to-end encrypted and runs through a relay you deploy; AI uses keys from your own provider.',
        ],
      ],
    },
    {
      title: 'Price and payment',
      paragraphs: [
        [`${LICENCE_PRICE}, one payment, tax included. There is no subscription and no renewal.`],
        [
          'Payments are processed by Stripe through Stripe Managed Payments, a merchant of record service. At checkout and on your receipt you see Link as the merchant of record, and the purchase as “Sold through Link”. Your statement shows LINK.COM* followed by a descriptor. Receipts and refund notices come from Link.',
        ],
      ],
    },
    {
      title: 'Your licence key',
      paragraphs: [
        [
          'After paying, you see your licence key on the page, and it arrives by email with a link that opens it in Devot, in Settings > Licence. The licence carries the email address given at checkout.',
        ],
        [
          'Lost it? ',
          { text: 'Have it sent again', link: 'resend' },
          ' to the address you bought it with.',
        ],
      ],
    },
    {
      title: 'Refunds',
      paragraphs: [
        [
          `Within ${REFUND_DAYS} days of purchase you can have a full refund, no questions asked. A refund, or a chargeback decided in your favour, revokes the licence, and Devot goes back to read-only. The `,
          { text: 'refund policy', link: 'refunds' },
          ' has the details.',
        ],
      ],
    },
    {
      title: 'Source code',
      paragraphs: [
        [
          "Devot's source code is public under FSL-1.1-MIT. That licence covers the code; the licence you buy is separate, and unlocks the app.",
        ],
      ],
    },
    {
      title: 'Support',
      paragraphs: [
        [
          'Reply to your licence email, or ',
          { text: 'open an issue on GitHub', link: 'issues' },
          '. Never post your licence key in an issue.',
        ],
      ],
    },
    {
      title: 'Warranty',
      paragraphs: [
        [
          'Devot is provided as is, without any warranty beyond what the law requires. Nothing in these terms takes away rights that the law where you live gives you.',
        ],
      ],
    },
  ],
}

const refunds: LegalPage = {
  title: 'Devot: refund policy',
  description: `A Devot licence can be refunded within ${REFUND_DAYS} days of purchase, no questions asked. How to ask, and what a refund does.`,
  heading: 'Refund policy',
  intro: `Changed your mind? Within ${REFUND_DAYS} days of purchase, you get your money back.`,
  sections: [
    {
      title: 'No questions asked',
      paragraphs: [
        [
          `Within ${REFUND_DAYS} days of purchase you can have a full refund, tax included, for any reason.`,
        ],
      ],
    },
    {
      title: 'How to ask',
      paragraphs: [
        [
          'Reply to your licence email and ask for a refund. No longer have it? ',
          { text: 'Have your key sent again', link: 'resend' },
          ' and reply to that email.',
        ],
      ],
    },
    {
      title: 'What a refund does',
      paragraphs: [
        [
          `A refund revokes the licence, and Devot goes back to read-only: ${READ_ONLY}. A chargeback decided in your favour does the same.`,
        ],
        [
          'Nothing is deleted: your notes stay where they are, and a new licence unlocks everything again.',
        ],
      ],
    },
    {
      title: 'Your rights',
      paragraphs: [
        [
          'This policy adds to the rights that the law where you live gives you; it takes none away. The ',
          { text: 'terms of sale', link: 'terms' },
          ' cover the rest of the purchase.',
        ],
      ],
    },
  ],
}

const mcpPrivacy: LegalPage = {
  title: 'Devot: privacy policy for the Claude connector',
  description:
    'What the Devot connector for Claude can reach, what it sends, what it records and where your data goes when an AI tool uses it.',
  heading: 'Devot for Claude: privacy policy',
  intro:
    'This policy covers the Devot connector for Claude: the plugin and the bridge built into the Devot app.',
  sections: [
    {
      title: 'Scope',
      paragraphs: [
        [
          'This policy covers the Devot connector for Claude ("the connector"): the Devot plugin and the MCP bridge built into the Devot app (devot --cli mcp), which together let an MCP client such as Claude Code, Claude Desktop or Codex read and change notes in Devot on your Mac. It does not cover the rest of the Devot app, and it does not replace the terms of the client or AI provider you use.',
        ],
      ],
    },
    {
      title: 'Summary',
      paragraphs: [
        [
          'The connector runs on your Mac and sends nothing to Devot. It reaches only notebooks you have opened to AI. What it returns goes to the MCP client that asked for it, and that client decides what happens next, which normally includes sending it to an AI model.',
        ],
      ],
    },
    {
      title: 'How it works',
      paragraphs: [
        [
          'The plugin holds only a small launcher that starts the bridge of the Devot app installed on your Mac. The bridge holds no database connection and keeps no notes. It passes each tool call to the running Devot app over a private local channel (a Unix socket in a folder only your macOS user can open) and passes the answer back. It makes no network requests. It has no Devot account and asks for no API key.',
        ],
        [
          'The bridge proves itself to the app with a random token kept in your macOS keychain. The token is never written to a configuration file, a command line, an environment variable or a log.',
        ],
        [
          "The connector works only after you switch on Allow AI Tools in Devot's Settings > Integrations (connecting a client from there turns it on and says so first). It can read and change notes unless you set it to Read Only there, and you can turn it off at any time.",
        ],
        [
          'If Devot is not running when a client calls a tool, the bridge opens Devot in the background. Start in the Background in Settings > Integrations is on by default; turn it off and the connector starts nothing. A Devot started this way shows a dove icon in the menu bar with Quit Devot, and runs as it always does, including sync and licence checks if you use them. If you never open its window, it quits by itself after 10 minutes without a tool call, waiting up to 10 minutes more for notes still syncing, and staying if a note could not be saved.',
        ],
      ],
    },
    {
      title: 'Data collection',
      paragraphs: [
        [
          'The connector does not collect data for Devot. It has no analytics and sends no usage events.',
        ],
        ['When a client calls one of its tools, the connector can handle:'],
        ['Notebook names and IDs, and how many notes each holds.'],
        ['Tag names, and how many notes carry each.'],
        [
          'Note titles, IDs, bodies in Markdown (including any links and image references in the text, but never image files), short search snippets, notebook, status, pinned state, tags, and creation and update times.',
        ],
        ['Search queries, and new or changed note content that the client sends.'],
        [
          'It reaches only live notes filed directly in a notebook where you switched Allow AI Access on. That switch is off by default and applies to one notebook at a time: a sub-notebook needs its own. It is kept on each device and does not sync, so allowing a notebook on one device does not allow it on another. Notes in other notebooks, in no notebook, in Templates or in the Trash are not available to it, and asking for one answers as if it did not exist.',
        ],
        [
          'A client can create a new notebook through the connector. Such a notebook is created with Allow AI Access on, on that device only, and only at the top level or inside a notebook that already allows AI access.',
        ],
      ],
    },
    {
      title: 'Usage and storage',
      paragraphs: [
        ['The connector uses this data only to carry out the tool call the client made.'],
        ['Reads return the requested data to the client.'],
        [
          "Writes change your notes through the Devot app, the same way an edit in the app does: creating notes and notebooks; editing or replacing a note's text, title, status and tags (a new tag name becomes a tag); moving a note between notebooks that allow AI access; and moving notes to the Trash, from where you can restore them. Before each change to a note's text, Devot keeps the text as it was in the note's History. The connector cannot permanently delete a note.",
        ],
        [
          'Authorship: with each write, Devot records in the note who wrote (the name the client gave for itself, such as "Claude Code", and that it came through the connector), a random ID for that run of the connector, an ID for the Devot process that applied it, when, which fields changed, which text in the note was inserted, and the text that was deleted (up to about 1 MB per note; past that the oldest deleted text is dropped), so you can review or undo the change. This record is part of the note. If you use Devot sync, it syncs with the note, encrypted on your device like the rest of the note. Clear Authorship in Devot removes these records from a note.',
        ],
        [
          "Logs: the bridge writes short log lines to the client's error stream, such as a code and a note ID after a write. They hold codes and IDs, never note content. The client may store them.",
        ],
        ['The connector keeps no copy of your notes of its own.'],
      ],
    },
    {
      title: 'Third-party sharing',
      paragraphs: [
        [
          'Devot does not sell your data or share it with anyone, and receives none of it through the connector.',
        ],
        [
          "The connector returns data to the MCP client you connected. That client, and any AI provider it uses, handles the data under its own terms and privacy policy, which are outside Devot's control. With Claude, see ",
          { text: "Anthropic's privacy policy", link: 'anthropicPrivacy' },
          ". Open a notebook to AI only if you accept that its contents may be sent to your client's AI provider.",
        ],
      ],
    },
    {
      title: 'Data retention',
      paragraphs: [
        [
          "The connector sends nothing to Devot's servers. Notes and authorship records stay on your devices and, if you use Devot sync, as encrypted records on the sync service you chose, until you delete them. That service never holds the key. Removing the plugin leaves your notes unchanged. To stop access, switch Allow AI Access off for the notebook, turn off Allow AI Tools in Settings > Integrations, or disconnect the client.",
        ],
        [
          "Data already returned to a client stays under that client's retention rules, and Devot cannot delete it.",
        ],
      ],
    },
    {
      title: 'Changes',
      paragraphs: [
        [
          'If this policy changes, the new version is published at this address with a new effective date.',
        ],
      ],
    },
    {
      title: 'Contact',
      paragraphs: [
        ['Questions about this policy: ', { text: PRIVACY_EMAIL, link: 'privacyEmail' }, '.'],
      ],
    },
  ],
}

export const legalCopy = {
  legal: {
    updated: 'Updated 25 October 2026',
    backToPricing: 'See pricing',
  },
  terms,
  refunds,
  mcpPrivacy,
}
