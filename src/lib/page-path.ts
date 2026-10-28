/** The path Cloudflare Pages serves a page at, given the path Astro builds it to (`build.format: 'file'`). */
export function pagePath(pathname: string): string {
  return pathname.replace(/(index)?\.html$/, '')
}
