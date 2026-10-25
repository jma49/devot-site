import { LICENCE_PRICE, REFUND_DAYS } from '../../site.ts'

export const pricingCopy = {
  pricing: {
    label: 'Pricing',
    title: ['Free to write.', 'Pay once for sync and AI.'],
    lead: 'Devot is free. A licence, bought once, unlocks sync and AI. Everything else stays free.',
    free: {
      name: 'Free',
      price: 'US$0',
      terms: 'No account, no licence needed.',
      items: [
        'Writing, notebooks, tags and search',
        'Version history and daily backups',
        'Markdown export and a mirror folder',
        'Works offline',
      ],
    },
    licence: {
      name: 'Licence',
      price: LICENCE_PRICE,
      terms: 'One payment, tax included. No subscription, no renewal.',
      includes: 'Everything in Free, plus',
      items: [
        'End-to-end encrypted sync, through a relay you deploy',
        'AI with keys from your own provider',
        'Every future version of Devot',
        'All your devices',
      ],
      buy: 'Buy a licence',
      refund: `${REFUND_DAYS}-day refund, no questions asked.`,
    },
    delivery:
      'After paying, your key shows on the page and arrives by email, with a link that opens it in Devot. Payments are processed by Stripe.',
    links: {
      label: 'About buying',
      terms: 'Terms of sale',
      refunds: 'Refund policy',
      lostKey: 'Lost your licence key?',
    },
  },
}
