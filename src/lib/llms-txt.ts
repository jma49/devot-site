import type { Messages } from '../i18n/en.ts'
import { DOWNLOAD_URL, LICENCE_PRICE, REPO_URL, SITE_URL } from '../site.ts'
import { FOOTER_GROUPS } from './links.ts'

type Run = string | { code: string }

const prose = (runs: readonly Run[]) =>
  runs.map((run) => (typeof run === 'string' ? run : `\`${run.code}\``)).join('')
const item = (label: string, text: string) => `- **${label}:** ${text}`
const link = (label: string, href: string) => `- [${label}](${new URL(href, SITE_URL).href})`

// Footer links that lead to a document; the rest point back into the home page or at forms.
const DOC_LINKS = new Set([
  'install',
  'releases',
  'architecture',
  'development',
  'mcp',
  'support',
  'licence',
  'terms',
  'refunds',
  'privacy',
  'mcpPrivacy',
])

/** `/llms.txt`: the site's facts as Markdown for language models, from the page's own copy. */
export function llmsTxt(t: Messages): string {
  const docs = FOOTER_GROUPS.flatMap((group) =>
    group.links
      .filter(({ id }) => DOC_LINKS.has(id))
      .map(({ id, href }) => {
        const labels: Record<string, string> = t.footer.groups[group.id].links
        return link(labels[id] ?? id, href)
      }),
  )
  const { trial, licence, after, selfBuild } = t.pricing
  return [
    `# ${t.siteName}`,
    '',
    `> ${t.meta.description}`,
    '',
    t.hero.lead,
    '',
    t.privacy.body,
    '',
    `## ${t.llms.facts.title}`,
    '',
    item(t.llms.facts.platform, t.download.requirements),
    item(t.llms.facts.download, `[${t.download.label}](${DOWNLOAD_URL})`),
    item(t.llms.facts.source, `[${t.footer.licence}](${REPO_URL})`),
    '',
    `## ${t.llms.features}`,
    '',
    ...t.features.items.map((feature) => item(feature.name, prose(feature.body))),
    ...Object.values(t.cards.items).map((card) => item(card.label, prose(card.body))),
    '',
    `## ${t.llms.ai.title}`,
    '',
    t.llms.ai.body,
    '',
    `## ${t.pricing.label}`,
    '',
    item(trial.name, trial.terms),
    item(licence.name, `${LICENCE_PRICE}. ${licence.terms}`),
    ...licence.items.map((line) => `    - ${line}`),
    item(after.title, after.body),
    item(selfBuild.title.replace(/\?$/, ''), selfBuild.body),
    '',
    `## ${t.llms.docs}`,
    '',
    ...docs,
    '',
  ].join('\n')
}
