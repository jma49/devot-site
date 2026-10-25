export const SITE_URL = 'https://devot.online/'
export const REPO_URL = 'https://github.com/jma49/devot'
export const DOWNLOAD_URL = `${REPO_URL}/releases/latest`
export const ISSUES_URL = `${REPO_URL}/issues`
/** The link-preview image `src/pages/og.png.ts` renders at build time. */
export const OG_IMAGE = { path: '/og.png', width: 1200, height: 630 } as const

const LICENCE_SERVICE_URL = 'https://licence.devot.online'
/** Opens Stripe Checkout for one licence. */
export const BUY_URL = `${LICENCE_SERVICE_URL}/buy`
/** The form that mails every licence bought with an address back to it. */
export const RESEND_URL = `${LICENCE_SERVICE_URL}/resend`
export const LICENCE_PRICE = 'US$29.90'
export const REFUND_DAYS = 30
