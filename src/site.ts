export const SITE_URL = 'https://devot.online/'
export const REPO_URL = 'https://github.com/jma49/devot'
/** The Claude plugin that launches the MCP server built into the Devot app. */
export const PLUGIN_REPO_URL = 'https://github.com/jma49/devot-plugin'
export const SITE_REPO_URL = 'https://github.com/jma49/devot-site'
export const DOWNLOAD_URL = `${REPO_URL}/releases/latest`
/**
 * The iPhone download page: the TestFlight beta while the App Store listing is not live, or the
 * App Store page once it is. Until then the page shows no link: a guessed address is a dead end
 * for the reader.
 */
export const APP_STORE_URL: string | undefined = 'https://testflight.apple.com/join/3QkA8dZh'
export const ISSUES_URL = `${REPO_URL}/issues`
export const BUILD_URL = `${REPO_URL}/blob/main/docs/development.md`
/** The link-preview image `src/pages/og.png.ts` renders at build time. */
export const OG_IMAGE = { path: '/og.png', width: 1200, height: 630 } as const

const LICENCE_SERVICE_URL = 'https://licence.devot.online'
/** Opens Stripe Checkout for one licence. */
export const BUY_URL = `${LICENCE_SERVICE_URL}/buy`
/** The form that mails every licence bought with an address back to it. */
export const RESEND_URL = `${LICENCE_SERVICE_URL}/resend`
/** Lists the devices a licence key is activated on, and removes one. */
export const DEVICES_URL = `${LICENCE_SERVICE_URL}/devices`
/** What the download needs; the copy words it, structured data states it as is. */
export const PLATFORM = { os: 'macOS 15+', processor: 'Apple Silicon or Intel' } as const
/** What Devot for iPhone needs. */
export const IPHONE_OS = 'iOS 26+'
export const LICENCE_AMOUNT = '29.90'
/** ISO 4217, for structured data; `LICENCE_PRICE` is how the page writes it. */
export const LICENCE_CURRENCY = 'USD'
export const LICENCE_PRICE = `US$${LICENCE_AMOUNT}`
/** Devot Pro, the one purchase in Devot for iPhone, as the App Store prices it in US dollars. */
export const IPHONE_AMOUNT = '29.99'
export const IPHONE_PRICE = `US$${IPHONE_AMOUNT}`
export const REFUND_DAYS = 30
/** Starts the first time Devot opens; Devot is read-only once it ends without a licence. */
export const TRIAL_DAYS = 30
/** Where privacy questions, and support questions too private for an issue, go. */
export const PRIVACY_EMAIL = 'privacy@devot.online'
