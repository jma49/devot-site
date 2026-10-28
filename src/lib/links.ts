import { ISSUES_URL, REPO_URL, RESEND_URL } from '../site.ts'

const blob = (path: string) => `${REPO_URL}/blob/main/${path}`

export const RELEASES_URL = `${REPO_URL}/releases`
export const INSTALL_URL = `${REPO_URL}#download`
export const STORAGE_DOC_URL = `${blob('docs/architecture.md')}#app-data-folder`
export const PRICING_PATH = '/#pricing'
export const TERMS_PATH = '/terms'
export const REFUNDS_PATH = '/refunds'

/** Where the links inside the terms and the refund policy go, by the id the copy names. */
export const LEGAL_LINKS = {
  terms: TERMS_PATH,
  refunds: REFUNDS_PATH,
  resend: RESEND_URL,
  issues: ISSUES_URL,
} as const

export type LegalLinkId = keyof typeof LEGAL_LINKS

export type FooterGroupId = 'product' | 'resources' | 'community' | 'legal'

export interface FooterLink {
  id: string
  href: string
}

export interface FooterGroup {
  id: FooterGroupId
  links: FooterLink[]
}

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    id: 'product',
    links: [
      { id: 'features', href: '/#write' },
      { id: 'cards', href: '/#cards' },
      { id: 'localFirst', href: '/#local-first' },
      { id: 'pricing', href: PRICING_PATH },
      { id: 'download', href: '/#download' },
    ],
  },
  {
    id: 'resources',
    links: [
      { id: 'releases', href: RELEASES_URL },
      { id: 'install', href: INSTALL_URL },
      { id: 'architecture', href: blob('docs/architecture.md') },
      { id: 'development', href: blob('docs/development.md') },
      { id: 'mcp', href: `${REPO_URL}#claude-and-other-mcp-clients-devot-mcp` },
    ],
  },
  {
    id: 'community',
    links: [
      { id: 'github', href: REPO_URL },
      { id: 'issues', href: ISSUES_URL },
      { id: 'pulls', href: `${REPO_URL}/pulls` },
      { id: 'contributing', href: `${REPO_URL}#contributing` },
      { id: 'milestones', href: `${REPO_URL}/milestones` },
    ],
  },
  {
    id: 'legal',
    links: [
      { id: 'licence', href: blob('LICENSE') },
      { id: 'terms', href: TERMS_PATH },
      { id: 'refunds', href: REFUNDS_PATH },
      { id: 'security', href: `${REPO_URL}/security/policy` },
      { id: 'report', href: `${REPO_URL}/security/advisories/new` },
    ],
  },
]

export function footerLinks(): FooterLink[] {
  return FOOTER_GROUPS.flatMap((group) => group.links)
}
