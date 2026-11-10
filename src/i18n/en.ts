import { cardsCopy } from './en/cards.ts'
import { chromeCopy } from './en/chrome.ts'
import { blogCopy } from './en/blog.ts'
import { demoCopy } from './en/demo.ts'
import { docsCopy } from './en/docs.ts'
import { featuresCopy } from './en/features.ts'
import { heroCopy } from './en/hero.ts'
import { iphoneCopy } from './en/iphone.ts'
import { legalCopy } from './en/legal.ts'
import { llmsCopy } from './en/llms.ts'
import { mediaCopy } from './en/media.ts'
import { pricingCopy } from './en/pricing.ts'
import { privacyCopy } from './en/privacy.ts'
import { supportCopy } from './en/support.ts'
import { IPHONE_OS, PLATFORM } from '../site.ts'

/** Copy shared by several sections lives here; each package's own copy lives in `en/<package>.ts`. */
export const en = {
  siteName: 'Devot',
  download: {
    label: 'Download for macOS',
    iphone: 'Get it for iPhone',
    appStore: 'Get it on the App Store',
    requirements: `${PLATFORM.os} on ${PLATFORM.processor} · ${IPHONE_OS}`,
    iphoneRequirements: `iPhone, ${IPHONE_OS}`,
  },
  ...chromeCopy,
  ...heroCopy,
  ...iphoneCopy,
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
  ...blogCopy,
}

export type Messages = typeof en
