'use strict'
// The package puts Viz.js's browser build (`Viz`, from @viz-js/viz) before this script (src/lib/plugin-packages.ts).
;(() => {
  const FONT = 'Helvetica,Arial,sans-serif'
  let ready

  const escape = (text) =>
    text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  /** Graphviz's own message for a graph it cannot read, drawn where the graph would be. */
  function problem(message, color) {
    const line = escape(message.replace(/\s+/g, ' ').trim().slice(0, 160))
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="40" viewBox="0 0 640 40">` +
      `<text x="0" y="24" font-family="${FONT}" font-size="13" fill="${color}">${line}</text></svg>`
    )
  }

  async function draw(source, theme) {
    if (source.trim() === '') return null
    const colors = theme?.colors ?? {}
    const text = colors.text ?? '#1d1d1f'
    const edge = colors.edge ?? text
    ready ??= globalThis.Viz.instance()
    const viz = await ready
    const result = viz.render(source, {
      format: 'svg',
      graphAttributes: { bgcolor: 'transparent', color: edge, fontcolor: text, fontname: FONT },
      nodeAttributes: { color: edge, fontcolor: text, fontname: FONT },
      edgeAttributes: { color: edge, fontcolor: text, fontname: FONT },
    })
    if (result.status !== 'success') {
      const error = result.errors.find((e) => e.level === 'error') ?? result.errors[0]
      return problem(error ? error.message : 'Graphviz could not read this graph.', text)
    }
    return result.output.slice(result.output.indexOf('<svg'))
  }

  devot.preview.handle('dot', draw)
})()
