import type { Plugin } from 'vite'

// A Vite plugin for the Devot dev server `pnpm media:device` records from: every page Devot opens
// gets a small client over Vite's HMR socket, and POST /__media runs a function in the page whose
// path matches, answering its JSON result. Only the recording's dev server loads it; it never
// reaches a build of Devot.

const CLIENT = `
const hot = import.meta.hot
const visible = (el) => {
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return false
  for (let e = el; e; e = e.parentElement || e.getRootNode().host) {
    const s = getComputedStyle(e)
    if (s.display === 'none' || s.visibility === 'hidden' || e.getAttribute('aria-hidden') === 'true' || e.inert) return false
  }
  return true
}
const all = (root) => {
  const out = []
  const walk = (node) => {
    for (const el of node.querySelectorAll('*')) {
      out.push(el)
      if (el.shadowRoot) walk(el.shadowRoot)
    }
  }
  walk(root)
  return out
}
const IMPLICIT = { BUTTON: 'button', NAV: 'navigation', ARTICLE: 'article', DIALOG: 'dialog', OPTION: 'option', SELECT: 'combobox', TEXTAREA: 'textbox', FIELDSET: 'group', A: 'link' }
const roleOf = (el) => {
  const explicit = el.getAttribute('role')
  if (explicit) return explicit.split(' ')[0]
  if (el.tagName === 'INPUT') {
    const t = (el.getAttribute('type') || 'text').toLowerCase()
    if (t === 'search') return el.getAttribute('list') ? 'combobox' : 'searchbox'
    if (t === 'checkbox') return 'checkbox'
    if (t === 'radio') return 'radio'
    if (t === 'button' || t === 'submit') return 'button'
    return el.getAttribute('list') ? 'combobox' : 'textbox'
  }
  if (el.tagName === 'A' && !el.hasAttribute('href')) return null
  return IMPLICIT[el.tagName] || null
}
const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim()
const textOf = (el) => {
  if (el.nodeType === 3) return el.textContent
  if (el.nodeType !== 1) return ''
  if (el.getAttribute('aria-hidden') === 'true') return ''
  const label = el.getAttribute('aria-label')
  if (label && el !== el.ownerDocument.body) return label
  if (el.tagName === 'INPUT') return el.value || ''
  let out = ''
  for (const c of (el.shadowRoot || el).childNodes) out += textOf(c) + (c.nodeType === 1 && getComputedStyle(c).display !== 'inline' ? ' ' : '')
  return out
}
const nameOf = (el) => {
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const root = el.getRootNode()
    return norm(by.split(' ').map((id) => { const t = root.getElementById ? root.getElementById(id) : document.getElementById(id); return t ? textOf(t) : '' }).join(' '))
  }
  const label = el.getAttribute('aria-label')
  if (label) return norm(label)
  if (el.labels && el.labels.length) return norm([...el.labels].map(textOf).join(' '))
  if (['button', 'option', 'tab', 'link', 'radio', 'checkbox', 'menuitem'].includes(roleOf(el))) return norm(textOf(el))
  return norm(el.getAttribute('title') || el.getAttribute('placeholder') || '')
}
const matches = (value, want, exact) => {
  if (want === undefined) return true
  if (want && want.regex) return new RegExp(want.regex, want.flags).test(value)
  return exact ? value === want : value.toLowerCase().includes(String(want).toLowerCase())
}
const run = (steps, roots) => {
  let found = roots
  for (const step of steps) {
    if (step.kind === 'nth') { const i = step.n < 0 ? found.length + step.n : step.n; found = found[i] ? [found[i]] : []; continue }
    if (step.kind === 'filter') {
      found = found.filter((el) => (step.hasText === undefined || matches(norm(textOf(el)), step.hasText, false)) && (!step.has || run(step.has, [el]).length > 0))
      continue
    }
    if (step.kind === 'and') { const other = new Set(run(step.steps, [document])); found = found.filter((el) => other.has(el)); continue }
    const next = []
    for (const root of found) {
      for (const el of all(root)) {
        if (step.kind === 'css' && !(el.matches(step.css) && (step.hasText === undefined || matches(norm(textOf(el)), step.hasText, false)))) continue
        if (step.kind === 'role' && !(roleOf(el) === step.role && visible(el) && matches(nameOf(el), step.name, step.exact))) continue
        if (step.kind === 'text') {
          const own = norm(textOf(el))
          if (!matches(own, step.text, step.exact) || [...el.children].some((c) => matches(norm(textOf(c)), step.text, step.exact))) continue
        }
        if (!next.includes(el)) next.push(el)
      }
    }
    found = next
  }
  return found
}
const engine = {
  query: (steps) => run(steps, [document]),
  visible,
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } },
}
globalThis.__media = engine
hot.on('media:req', async ({ id, path, code, args }) => {
  if (path !== location.pathname) return
  try {
    const fn = (0, eval)('(' + code + ')')
    const value = await fn(engine, ...args)
    hot.send('media:res', { id, value: value === undefined ? null : value })
  } catch (e) {
    hot.send('media:res', { id, error: String(e && e.stack || e) })
  }
})
`

export function mediaBridge(): Plugin {
  const pending = new Map<number, (reply: { value?: unknown; error?: string }) => void>()
  let next = 0
  return {
    name: 'devot-media-bridge',
    apply: 'serve',
    resolveId: (id) => (id === '/@media-bridge' ? '\0media-bridge' : undefined),
    load: (id) => (id === '\0media-bridge' ? CLIENT : undefined),
    transformIndexHtml: () => [
      { tag: 'script', attrs: { type: 'module', src: '/@media-bridge' }, injectTo: 'head' },
    ],
    configureServer(server) {
      server.ws.on('media:res', (data: { id: number; value?: unknown; error?: string }) => {
        pending.get(data.id)?.(data)
        pending.delete(data.id)
      })
      server.middlewares.use('/__media', (req, res) => {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          const { path, code, args } = JSON.parse(body) as {
            path: string
            code: string
            args: unknown[]
          }
          const id = next++
          const timer = setTimeout(() => {
            pending.delete(id)
            res.statusCode = 504
            res.end(JSON.stringify({ error: `E_MEDIA_BRIDGE_TIMEOUT ${path}` }))
          }, 15_000)
          pending.set(id, (reply) => {
            clearTimeout(timer)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(reply))
          })
          server.ws.send('media:req', { id, path, code, args })
        })
      })
    },
  }
}
