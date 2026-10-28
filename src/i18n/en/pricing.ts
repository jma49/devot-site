import { capitalised, numberWord } from '../../lib/words.ts'
import { LICENCE_PRICE, REFUND_DAYS, TRIAL_DAYS } from '../../site.ts'

const days = `${numberWord(TRIAL_DAYS)} days`

export const pricingCopy = {
  pricing: {
    label: 'Pricing',
    title: [`${capitalised(days)} with everything.`, 'Then pay once.'],
    lead: 'Open Devot and the trial starts, with editing, sync and AI included. After it, one licence unlocks everything for good.',
    trial: {
      name: 'Trial',
      price: capitalised(days),
      terms: 'A free trial with everything included. It starts the first time you open Devot.',
      items: [
        'Writing, notebooks, tags and search',
        'End-to-end encrypted sync, through a relay you deploy',
        'AI with keys from your own provider',
        'Version history, backups and Markdown export',
      ],
    },
    licence: {
      name: 'Licence',
      price: LICENCE_PRICE,
      terms: 'One payment, tax included. No subscription, no renewal.',
      items: [
        'Everything in the trial, for good',
        'Every future version of Devot',
        'All your devices',
      ],
      buy: 'Buy a licence',
      refund: `${REFUND_DAYS}-day refund, no questions asked.`,
    },
    after: {
      title: 'When the trial ends',
      body: 'Without a licence, Devot turns read-only: you can still read, search, copy and export every note, but not create or edit one, and sync and AI stop. Nothing is deleted, and export always works. Add a licence and everything unlocks again.',
    },
    delivery:
      'After paying, your key shows on the page and arrives by email, with a link that opens it in Devot. Payments are processed by Stripe through Stripe Managed Payments, a merchant of record service.',
    links: {
      label: 'About buying',
      terms: 'Terms of sale',
      refunds: 'Refund policy',
      lostKey: 'Lost your licence key?',
    },
  },
}
