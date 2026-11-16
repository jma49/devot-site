'use strict'
;(() => {
  const MAX_ROWS = 200
  const WIDTH = 640
  const HEIGHT = 320
  const PAD = { top: 36, right: 16, bottom: 48, left: 56 }
  // Light and dark tones of each series; the image follows the system appearance itself.
  const COLOURS = [
    ['#2f6fdf', '#7aa7ff'],
    ['#d9622b', '#ff9a66'],
    ['#2e9e6b', '#5fd39b'],
    ['#9a4fd1', '#c99bff'],
    ['#c4a400', '#f2d43d'],
    ['#d23f6e', '#ff7fa6'],
  ]

  const number = (text) => {
    const t = text.trim().replace(/,(?=\d{3}(?:\D|$))/g, '')
    return t !== '' && Number.isFinite(Number(t)) ? Number(t) : null
  }

  const split = (line) => line.split(line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',')

  /** `type:` and `title:` lines first, then rows of a label and one or more numbers; a first row without numbers names the series. */
  function parse(source) {
    const options = { type: 'bar', title: '' }
    const rows = []
    for (const raw of source.split(/\r?\n/)) {
      const line = raw.trim()
      if (line === '' || line.startsWith('#')) continue
      const option = /^(type|title)\s*:\s*(.*)$/i.exec(line)
      if (option && rows.length === 0) {
        const key = option[1].toLowerCase()
        const value = option[2].trim()
        if (key === 'type' && (value === 'bar' || value === 'line')) options.type = value
        else if (key === 'title') options.title = value
        else return null
        continue
      }
      rows.push(split(line).map((c) => c.trim()))
    }
    if (rows.length === 0) return null
    let series = null
    if (rows[0].slice(1).every((c) => number(c) === null)) series = rows.shift().slice(1)
    const data = rows
      .slice(0, MAX_ROWS)
      .map((r) => ({ label: r[0], values: r.slice(1).map(number) }))
    const width = Math.max(...data.map((d) => d.values.length), series ? series.length : 0)
    if (width === 0 || data.some((d) => d.values.length === 0 || d.values.some((v) => v === null)))
      return null
    return {
      ...options,
      series: Array.from({ length: width }, (_, i) => (series && series[i]) || `Series ${i + 1}`),
      data,
      dropped: rows.length - data.length,
    }
  }

  const escape = (text) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  /** Round steps (1, 2 or 5 times a power of ten) from below the smallest value to above the largest. */
  function scale(values) {
    let low = Math.min(0, ...values)
    let high = Math.max(0, ...values)
    if (low === high) high = low + 1
    const rough = (high - low) / 5
    const power = 10 ** Math.floor(Math.log10(rough))
    const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough)
    low = Math.floor(low / step) * step
    high = Math.ceil(high / step) * step
    const ticks = []
    for (let v = low; v <= high + step / 2; v += step) ticks.push(Number(v.toPrecision(12)))
    return { low, high, ticks }
  }

  const short = (v) => {
    const a = Math.abs(v)
    if (a >= 1e9) return `${Number((v / 1e9).toPrecision(3))}B`
    if (a >= 1e6) return `${Number((v / 1e6).toPrecision(3))}M`
    if (a >= 1e4) return `${Number((v / 1e3).toPrecision(3))}k`
    return String(Number(v.toPrecision(6)))
  }

  function svg(chart) {
    const values = chart.data.flatMap((d) => d.values.filter((v) => v !== undefined))
    const { low, high, ticks } = scale(values)
    const plotW = WIDTH - PAD.left - PAD.right
    const plotH = HEIGHT - PAD.top - PAD.bottom
    const y = (v) => PAD.top + plotH - ((v - low) / (high - low)) * plotH
    const band = plotW / chart.data.length
    const x = (i) => PAD.left + band * (i + 0.5)
    const parts = []
    const styles = [
      'text{font:12px -apple-system,system-ui,sans-serif;fill:#3c3c43}',
      '.title{font-weight:600;font-size:14px;fill:#1c1c1e}',
      '.grid{stroke:#d1d1d6;stroke-width:1}',
      '.axis{stroke:#8e8e93;stroke-width:1}',
      ...COLOURS.map(([light], i) => `.s${i}{fill:${light};stroke:${light}}`),
      '@media (prefers-color-scheme:dark){text{fill:#d1d1d6}.title{fill:#f2f2f7}.grid{stroke:#3a3a3c}.axis{stroke:#636366}',
      ...COLOURS.map(([, dark], i) => `.s${i}{fill:${dark};stroke:${dark}}`),
      '}',
    ]
    parts.push(`<style>${styles.join('')}</style>`)
    if (chart.title)
      parts.push(`<text class="title" x="${PAD.left}" y="20">${escape(chart.title)}</text>`)
    for (const t of ticks) {
      const ty = y(t).toFixed(1)
      parts.push(
        `<line class="${t === 0 ? 'axis' : 'grid'}" x1="${PAD.left}" x2="${WIDTH - PAD.right}" y1="${ty}" y2="${ty}"/>`,
      )
      parts.push(
        `<text x="${PAD.left - 8}" y="${ty}" text-anchor="end" dominant-baseline="middle">${short(t)}</text>`,
      )
    }
    const every = Math.ceil(chart.data.length / 12)
    chart.data.forEach((d, i) => {
      if (i % every === 0) {
        parts.push(
          `<text x="${x(i).toFixed(1)}" y="${HEIGHT - PAD.bottom + 18}" text-anchor="middle">${escape(d.label.slice(0, 14))}</text>`,
        )
      }
    })
    const count = chart.series.length
    chart.series.forEach((_, s) => {
      const tone = `s${s % COLOURS.length}`
      if (chart.type === 'line') {
        const points = chart.data
          .map((d, i) =>
            d.values[s] === undefined ? null : `${x(i).toFixed(1)},${y(d.values[s]).toFixed(1)}`,
          )
          .filter(Boolean)
        parts.push(
          `<polyline class="${tone}" fill="none" stroke-width="2" points="${points.join(' ')}" style="fill:none"/>`,
        )
        for (const p of points) {
          const [cx, cy] = p.split(',')
          parts.push(`<circle class="${tone}" cx="${cx}" cy="${cy}" r="3"/>`)
        }
      } else {
        const inner = band * 0.8
        const w = inner / count
        chart.data.forEach((d, i) => {
          const v = d.values[s]
          if (v === undefined) return
          const top = y(Math.max(v, 0))
          const h = Math.abs(y(v) - y(0))
          const left = x(i) - inner / 2 + w * s
          parts.push(
            `<rect class="${tone}" x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(w - 1, 1).toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" stroke-width="0"/>`,
          )
        })
      }
    })
    if (count > 1) {
      let lx = PAD.left
      chart.series.forEach((name, s) => {
        const label = escape(name.slice(0, 20))
        parts.push(
          `<rect class="s${s % COLOURS.length}" x="${lx}" y="${HEIGHT - 16}" width="10" height="10" stroke-width="0"/>`,
        )
        parts.push(`<text x="${lx + 14}" y="${HEIGHT - 7}">${label}</text>`)
        lx += 24 + label.length * 7
      })
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('')}</svg>`
  }

  /** The image's text alternative reads the data out, so the chart says what it shows without being seen. */
  function described(chart) {
    const kind = chart.type === 'line' ? 'Line chart' : 'Bar chart'
    const head = chart.title ? `${kind}: ${chart.title}` : kind
    const rows = chart.data
      .slice(0, 20)
      .map((d) =>
        chart.series.length === 1
          ? `${d.label} ${d.values[0]}`
          : `${d.label} ${chart.series.map((n, i) => `${n} ${d.values[i] ?? '-'}`).join(', ')}`,
      )
    const more = chart.data.length > 20 ? `; ${chart.data.length - 20} more` : ''
    return `${head}. ${rows.join('; ')}${more}`.replace(/[[\]\\]/g, ' ')
  }

  const dataUri = (text) =>
    `data:image/svg+xml,${encodeURIComponent(text).replace(/[()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`

  function render(source) {
    const chart = parse(source)
    if (!chart) return null
    const image = `![${described(chart)}](${dataUri(svg(chart))})`
    return chart.dropped > 0 ? `${image}\n\n${chart.dropped} more rows are not drawn.` : image
  }

  devot.preview.handle('chart', render)
})()
