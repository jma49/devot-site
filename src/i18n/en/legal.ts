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
  /** Replaces the date the legal pages share. */
  updated?: string
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
  updated: 'Effective 3 November 2026',
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

const privacyPolicy: LegalPage = {
  title: 'Devot: privacy policy',
  description:
    'What Devot on Mac and iPhone keeps, what it sends and to whom: your notes, sync, AI, purchases, licences and crash reports.',
  heading: 'Privacy policy',
  updated: 'Effective 6 November 2026',
  intro: 'This policy covers the Devot app on Mac and iPhone and the licence service it talks to.',
  sections: [
    {
      title: 'Summary',
      paragraphs: [
        [
          'Your notes stay on your devices unless you turn on sync, and sync is end-to-end encrypted. Devot has no accounts, no ads and no tracking, and it does not sell or share your data. Devot itself runs one service, for licences and purchases, and it never sees your notes.',
        ],
      ],
    },
    {
      title: 'Your notes',
      paragraphs: [
        [
          "Notes, notebooks, tags, images and settings are stored on your device. Devot sends none of it to Devot's servers. Your device's own backups, such as iCloud Backup or a backup to a computer, can include Devot's data as they do for other apps.",
        ],
        [
          'If a note shows an image by its web address, Devot loads that image from its address, and that server sees the request as it would from a browser.',
        ],
      ],
    },
    {
      title: 'Sync',
      paragraphs: [
        [
          'Sync is off until you turn it on. It runs through your own iCloud account or through a relay you deploy, never through a Devot server.',
        ],
        [
          'Everything Devot syncs is encrypted on your device (AES-256-GCM) before it leaves, under a vault key that only your devices hold. iCloud and the relay store encrypted records only. They can see how many records there are, their sizes, whether each is a note or a file, and when they were written, but never a title, a note, a name or the key. With iCloud, the vault key reaches your other devices through iCloud Keychain, which Apple encrypts end to end.',
        ],
      ],
    },
    {
      title: 'AI',
      paragraphs: [
        [
          'AI features are off until you add a key for an AI provider in Settings > AI. Devot then sends text to that provider directly from your device, only when you use an AI feature, and only from notebooks where you switched Allow AI Access on. Nothing goes through Devot. The provider handles it under its own terms and privacy policy. Your key is kept in the keychain on your device.',
        ],
        [
          'The connector that lets Claude and other AI tools reach Devot on a Mac has ',
          { text: 'its own privacy policy', link: 'mcpPrivacy' },
          '.',
        ],
      ],
    },
    {
      title: 'Purchases and licences',
      paragraphs: [
        [
          "On iPhone, Apple handles the trial and the purchase of Devot Pro. Devot learns from Apple whether this Apple Account holds them, never your name, email address or payment details. If you ask for a Mac licence key in Settings, the iPhone sends that purchase's signed transaction to Devot's licence service, which asks Apple about it and answers with the key.",
        ],
        [
          'On the Mac, Stripe handles the payment and keeps your email address and payment details. The licence service receives your address from Stripe to put in the licence key and to email it to you, through the email service Resend. It does not store the address itself; it keeps a keyed hash of it, so that a lost key can be sent again.',
        ],
        [
          "When a device uses a licence key, it sends the key, a random device ID made on that device, and whether it is a Mac or an iPhone, to hold one of the licence's device seats. Once a day it also downloads the public list of revoked licences.",
        ],
        [
          'The licence service keeps the licence, its purchase (Stripe or App Store IDs and times, never a card or an Apple Account), and its device seats with when each was last used. These records are kept for as long as the licence exists, so it can be checked, sent again and revoked; a seat is removed when you remove the device. Your IP address is used only to limit requests, stored as a keyed hash for that hour. Logs hold codes and IDs only.',
        ],
      ],
    },
    {
      title: 'Crash reports',
      paragraphs: [
        [
          "Crash reports are off until you turn on Send Crash Reports in Settings. Devot then sends a report to Sentry, a crash reporting service, after an error. A report holds error codes, where in the code it happened, the Devot version and the system details (system version and device model), never note text, the names of your files or folders, your name or your device's name. Sentry handles reports under its own privacy policy. Turn it off and nothing more is sent, and reports not yet sent are deleted.",
        ],
      ],
    },
    {
      title: 'Other connections',
      paragraphs: [
        [
          'The Mac app checks GitHub for updates. Devot on the Mac counts a few kinds of events, such as how many notes you create, to show you in Settings > Usage Data; they stay on that Mac and are never sent. The iPhone counts none.',
        ],
      ],
    },
    {
      title: 'What Devot does not do',
      paragraphs: [
        [
          'Devot has no accounts and no sign-in. It shows no ads, contains no analytics or advertising code, does not track you across apps or websites, and does not sell or share your data with anyone.',
        ],
      ],
    },
    {
      title: 'Your choices',
      paragraphs: [
        [
          "Deleting Devot from an iPhone deletes its data from that iPhone. Turning off sync stops sending; to remove the encrypted copy, delete Devot's data in iCloud settings or on your relay. To have the licence service's records about a licence deleted, write to the address below; a deleted licence no longer works.",
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
  privacyPolicy,
}
