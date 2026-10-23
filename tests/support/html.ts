// A small reader for the HTML that `astro build` writes; enough for checks on known output.

export type Tag = { name: string; attrs: Map<string, string> }

const TAG = /<([a-zA-Z][\w-]*)\b([^>]*)>/g
const ATTR = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

export function tags(html: string, name?: string): Tag[] {
  return [...html.matchAll(TAG)]
    .map(([, tag, rest]) => ({
      name: (tag as string).toLowerCase(),
      attrs: new Map(
        [...(rest as string).matchAll(ATTR)].map((m) => [
          (m[1] as string).toLowerCase(),
          m[2] ?? m[3] ?? m[4] ?? '',
        ]),
      ),
    }))
    .filter((tag) => name === undefined || tag.name === name)
}

/** `<script>` elements with their attributes and body. */
export function scripts(html: string): { attrs: string; body: string }[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(([, attrs, body]) => ({
    attrs: attrs as string,
    body: body as string,
  }))
}
