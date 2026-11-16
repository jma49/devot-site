// Excalidraw is a module with chunks, fonts and a stylesheet in excalidraw/ beside this script, loaded on first use.
const here = globalThis.document?.currentScript?.src
let editor

function load() {
  if (!editor) {
    const base = new URL('excalidraw/', here)
    globalThis.EXCALIDRAW_ASSET_PATH = base.href
    for (const href of [new URL('index.css', base), new URL('plugin.css', here)]) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href.href
      document.head.append(link)
    }
    editor = import(new URL('editor.js', base).href)
  }
  return editor
}

devot.preview.handle('excalidraw', async (source, theme) => (await load()).draw(source, theme))
devot.preview.edit('excalidraw', async (source) => (await load()).edit(source, devot.ui))
