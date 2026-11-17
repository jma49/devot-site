// The Excalidraw plugin's module: draws a block's scene as SVG and edits it in the plugin's panel.
// The site's build bundles it with Excalidraw and React into excalidraw/ in the package (src/lib/plugin-builds.ts).
import { Excalidraw, exportToSvg, restore, serializeAsJSON } from '@excalidraw/excalidraw'
import { createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'

const PANEL_HEIGHT = 560

// Chinese words are written as code points: CJK characters stay in the site's translation catalogs.
const chinese = /^zh/i.test(navigator.language)
const WORDS = chinese
  ? {
      cancel: String.fromCharCode(0x53d6, 0x6d88),
      done: String.fromCharCode(0x5b8c, 0x6210),
      empty: String.fromCharCode(
        0x7a7a,
        0x767d,
        0x753b,
        0x677f,
        0xff0c,
        0x70b9,
        0x7f16,
        0x8f91,
        0x5f00,
        0x59cb,
        0x753b,
      ),
    }
  : { cancel: 'Cancel', done: 'Done', empty: 'An empty drawing: choose Edit to draw' }
const LANGUAGE = chinese
  ? /TW|HK|Hant/i.test(navigator.language)
    ? 'zh-TW'
    : 'zh-CN'
  : navigator.language

/** The scene a block holds, or null for an empty block; throws on a block that is not a scene. */
export function scene(source) {
  if (source.trim() === '') return null
  const data = JSON.parse(source)
  if (data === null || typeof data !== 'object' || !Array.isArray(data.elements)) {
    throw new Error('E_EXCALIDRAW_SCENE')
  }
  return restore(data, null, null)
}

const shown = (s) => s.elements.filter((e) => !e.isDeleted)

function emptyDrawing() {
  const escaped = WORDS.empty.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 72" width="360" height="72"><rect x="1" y="1" width="358" height="70" rx="8" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-dasharray="6 4"/><text x="180" y="41" text-anchor="middle" font-size="14" fill="currentColor" fill-opacity="0.7">${escaped}</text></svg>`
}

// The page shows the drawing without Excalidraw's fonts, so each text falls back to a system font of its kind, not the default serif.
const SYSTEM_FONTS = {
  hand: "'Chalkboard SE', 'Bradley Hand', 'Comic Sans MS', cursive",
  code: 'ui-monospace, Menlo, Consolas, monospace',
  sans: 'system-ui, -apple-system, Helvetica, Arial, sans-serif',
}
const KIND = {
  Virgil: 'hand',
  Excalifont: 'hand',
  Cascadia: 'code',
  'Comic Shanns': 'code',
}

function withSystemFonts(svg) {
  for (const text of svg.querySelectorAll('text')) {
    const families = text.getAttribute('font-family')
    if (!families) continue
    const kind = families
      .split(',')
      .map((name) => KIND[name.trim()])
      .find(Boolean)
    text.setAttribute('font-family', `${families}, ${SYSTEM_FONTS[kind ?? 'sans']}`)
  }
  return svg
}

export async function draw(source, theme) {
  const s = scene(source)
  if (!s || shown(s).length === 0) return emptyDrawing()
  const svg = await exportToSvg({
    elements: shown(s),
    appState: {
      ...s.appState,
      exportBackground: false,
      exportWithDarkMode: theme?.appearance === 'dark',
    },
    files: s.files,
    skipInliningFonts: true,
  })
  return new XMLSerializer().serializeToString(withSystemFonts(svg))
}

function Editor({ initial, finish }) {
  const [api, setApi] = useState(null)
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  const save = () =>
    finish(serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local'))
  return h(
    'div',
    { className: 'devot-excalidraw' },
    h(
      'div',
      { className: 'devot-excalidraw-bar' },
      h('button', { type: 'button', onClick: () => finish(null) }, WORDS.cancel),
      h('button', { type: 'button', className: 'done', disabled: !api, onClick: save }, WORDS.done),
    ),
    h(
      'div',
      { className: 'devot-excalidraw-canvas' },
      h(Excalidraw, {
        initialData: initial ?? undefined,
        excalidrawAPI: setApi,
        langCode: LANGUAGE,
        theme: dark ? 'dark' : 'light',
      }),
    ),
  )
}

let editing = null

/** Opens the editor in the panel; resolves with the edited scene, or with the block as it was when cancelled. */
export function edit(source, ui) {
  editing?.(null)
  const initial = scene(source)
  return new Promise((resolve) => {
    const host = document.createElement('div')
    host.className = 'devot-excalidraw-host'
    document.body.append(host)
    const root = createRoot(host)
    const finish = (edited) => {
      if (editing !== finish) return
      editing = null
      root.unmount()
      host.remove()
      void ui.hide()
      resolve(edited ?? source)
    }
    editing = finish
    ui.onHidden(() => editing === finish && finish(null))
    root.render(h(Editor, { initial, finish }))
    void ui.show({ height: PANEL_HEIGHT })
  })
}
