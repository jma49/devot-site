import { en, type Messages } from './en.ts'
import { cardsCopy } from './zh-Hans/cards.ts'
import { chromeCopy } from './zh-Hans/chrome.ts'
import { demoCopy } from './zh-Hans/demo.ts'
import { featuresCopy } from './zh-Hans/features.ts'
import { heroCopy } from './zh-Hans/hero.ts'
import { iphoneCopy } from './zh-Hans/iphone.ts'
import { mediaCopy } from './zh-Hans/media.ts'
import { pricingCopy } from './zh-Hans/pricing.ts'
import { privacyCopy } from './zh-Hans/privacy.ts'
import { supportCopy } from './zh-Hans/support.ts'
import { IPHONE_OS, PLATFORM } from '../site.ts'

/** The home and support pages in Simplified Chinese; the docs, blog and legal pages stay English. */
export const zhHans: Messages = {
  ...en,
  download: {
    label: '下载 macOS 版',
    iphone: '获取 iPhone 版',
    appStore: '在 App Store 获取',
    requirements: `${PLATFORM.os}，${PLATFORM.processor} · ${IPHONE_OS}`,
    iphoneRequirements: `iPhone，${IPHONE_OS}`,
  },
  ...chromeCopy,
  ...heroCopy,
  ...iphoneCopy,
  ...featuresCopy,
  ...cardsCopy,
  ...privacyCopy,
  ...pricingCopy,
  ...supportCopy,
  legal: { updated: '更新于 2026 年 10 月 25 日', backToPricing: '查看价格' },
  ...mediaCopy,
  ...demoCopy,
}
