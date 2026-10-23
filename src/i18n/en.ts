import { cardsCopy } from './en/cards.ts'
import { chromeCopy } from './en/chrome.ts'
import { demoCopy } from './en/demo.ts'
import { featuresCopy } from './en/features.ts'
import { heroCopy } from './en/hero.ts'
import { mediaCopy } from './en/media.ts'
import { privacyCopy } from './en/privacy.ts'

/** Copy shared by several sections lives here; each package's own copy lives in `en/<package>.ts`. */
export const en = {
  siteName: 'Devot',
  download: {
    label: 'Download for macOS',
    requirements: 'macOS 26+ · Apple Silicon',
  },
  ...chromeCopy,
  ...heroCopy,
  ...featuresCopy,
  ...cardsCopy,
  ...privacyCopy,
  ...mediaCopy,
  ...demoCopy,
}

export type Messages = typeof en
