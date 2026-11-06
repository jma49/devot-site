import { numberWord } from '../../lib/words.ts'
import { PRIVACY_EMAIL, REFUND_DAYS, TRIAL_DAYS } from '../../site.ts'
import type { LegalPage } from './legal.ts'

const support: LegalPage = {
  title: 'Devot: support',
  description:
    'Get help with Devot on Mac and iPhone: restoring purchases, licence keys on both, refunds and common questions.',
  heading: 'Support',
  updated: 'Updated 6 November 2026',
  intro: 'How to get help with Devot, and answers to the questions people ask most.',
  sections: [
    {
      title: 'Getting help',
      paragraphs: [
        [
          'For a bug or a question anyone could answer, ',
          { text: 'open an issue on GitHub', link: 'issues' },
          '. Never post your licence key or the text of your notes in an issue.',
        ],
        [
          'For anything private, such as a purchase, email ',
          { text: PRIVACY_EMAIL, link: 'privacyEmail' },
          '. If you bought a licence on the Mac, you can also reply to your licence email.',
        ],
      ],
    },
    {
      title: 'Restoring purchases on iPhone',
      paragraphs: [
        [
          'Devot Pro belongs to the Apple Account that bought it. On a new iPhone, or after reinstalling, sign in with that Apple Account, open Settings in Devot and tap Restore Purchases below License. Restore Purchases is also in the purchase sheet.',
        ],
        [
          'Purchases shared through Family Sharing do not unlock Devot Pro; each Apple Account needs its own.',
        ],
      ],
    },
    {
      title: 'Using a Mac licence key on iPhone',
      paragraphs: [
        [
          "A licence bought on the Mac also unlocks Devot on iPhone. In the purchase sheet, tap Enter License Key, or open Settings > License and add it there. The iPhone takes one of the licence's three device seats.",
        ],
      ],
    },
    {
      title: 'Getting a Mac key from an iPhone purchase',
      paragraphs: [
        [
          'Devot Pro comes with a Mac licence key at no extra cost. On the iPhone, open Settings and tap Get a Mac License Key, then Copy Key or Share. On the Mac, open the shared link, or paste the key in Settings > License > Add License. Asking again shows the same key.',
        ],
      ],
    },
    {
      title: 'Device seats',
      paragraphs: [
        [
          'A licence key works on up to three devices at a time. To move it to a new device, remove one you no longer use at ',
          { text: 'Manage Devices', link: 'devices' },
          ', also in Settings > License.',
        ],
      ],
    },
    {
      title: 'Refunds',
      paragraphs: [
        [
          'Apple handles refunds for purchases made on iPhone. In Devot, open Settings and tap Request a Refund, or ask at ',
          { text: "Apple's Report a Problem page", link: 'appleRefund' },
          '. Apple decides on the request. A refund ends Devot Pro and revokes the Mac key that came with it.',
        ],
        [
          `A licence bought on the Mac can be refunded within ${REFUND_DAYS} days; see the `,
          { text: 'refund policy', link: 'refunds' },
          '.',
        ],
      ],
    },
    {
      title: 'Questions',
      paragraphs: [
        ['Is Devot Pro a subscription? No. You buy it once, and it unlocks every future version.'],
        [
          `How long is the trial? It lasts ${numberWord(TRIAL_DAYS)} days, with everything included. On iPhone it runs once per Apple Account, so reinstalling does not start it again.`,
        ],
        [
          'What happens when the trial ends? Nothing is deleted. Every note stays readable, searchable and exportable; editing, sync and AI need Devot Pro or a licence.',
        ],
        [
          'Do I need an account? No. Devot has no accounts. Sync runs through your own iCloud account or a relay you deploy, end-to-end encrypted.',
        ],
        [
          'I lost my Mac licence key. ',
          { text: 'Have it sent again', link: 'resend' },
          ' to the address you bought it with. If it came from an iPhone purchase, tap Get a Mac License Key again.',
        ],
        [
          'Where are my notes? On your devices. The ',
          { text: 'privacy policy', link: 'privacy' },
          ' says what Devot sends and where.',
        ],
      ],
    },
  ],
}

export const supportCopy = { support }
