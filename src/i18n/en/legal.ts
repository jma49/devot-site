import type { LegalLinkId } from '../../lib/links.ts'
import { LICENCE_PRICE, REFUND_DAYS } from '../../site.ts'

/** Text, or a link to one of `LEGAL_LINKS`. */
export type LegalRun = string | { text: string; link: LegalLinkId }

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
    'What a Devot licence unlocks, what it costs, how refunds work and where to get help.',
  heading: 'Terms of sale',
  intro: 'Devot is free. These terms cover the licence that unlocks sync and AI in it.',
  sections: [
    {
      title: 'What you get',
      paragraphs: [
        [
          'A licence unlocks sync and AI in Devot, in every future version, on all your devices. Sync is end-to-end encrypted and runs through a relay you deploy; AI uses keys from your own provider. Everything else in Devot stays free, with or without a licence.',
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
          `Within ${REFUND_DAYS} days of purchase you can have a full refund, no questions asked. A refund, or a chargeback decided in your favour, revokes the licence. The `,
          { text: 'refund policy', link: 'refunds' },
          ' has the details.',
        ],
      ],
    },
    {
      title: 'Source code',
      paragraphs: [
        [
          "Devot's source code is public under FSL-1.1-MIT. That licence covers the code; the licence you buy is separate, and unlocks sync and AI in the app.",
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
          'A refund revokes the licence: Devot stops unlocking sync and AI with it. A chargeback decided in your favour does the same.',
        ],
        ['Your notes stay where they are, and everything else in Devot stays free.'],
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

export const legalCopy = {
  legal: {
    updated: 'Updated 24 October 2026',
    backToPricing: 'See pricing',
  },
  terms,
  refunds,
}
