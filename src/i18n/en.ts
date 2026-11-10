import { cardsCopy } from './en/cards.ts'
import { chromeCopy } from './en/chrome.ts'
import { demoCopy } from './en/demo.ts'
import { docsCopy } from './en/docs.ts'
import { featuresCopy } from './en/features.ts'
import { heroCopy } from './en/hero.ts'
import { legalCopy } from './en/legal.ts'
import { llmsCopy } from './en/llms.ts'
import { mediaCopy } from './en/media.ts'
import { pricingCopy } from './en/pricing.ts'
import { privacyCopy } from './en/privacy.ts'
import { supportCopy } from './en/support.ts'
import { PLATFORM } from '../site.ts'

/** Copy shared by several sections lives here; each package's own copy lives in `en/<package>.ts`. */
export const en = {
  siteName: 'Devot',
  download: {
    label: 'Download for macOS',
    requirements: `${PLATFORM.os} · ${PLATFORM.processor}`,
  },
  ...chromeCopy,
  ...heroCopy,
  ...featuresCopy,
  ...cardsCopy,
  ...privacyCopy,
  ...pricingCopy,
  ...legalCopy,
  ...supportCopy,
  ...mediaCopy,
  ...demoCopy,
  ...llmsCopy,
  ...docsCopy,
}

export type Messages = typeof en
