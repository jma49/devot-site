'use strict'
;(() => {
  const MAX_ENTRIES = 500
  const ACCENTS = {
    '"': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', A: 'Ä', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü', y: 'ÿ' },
    "'": {
      a: 'á',
      e: 'é',
      i: 'í',
      o: 'ó',
      u: 'ú',
      A: 'Á',
      E: 'É',
      I: 'Í',
      O: 'Ó',
      U: 'Ú',
      c: 'ć',
      n: 'ń',
      s: 'ś',
      z: 'ź',
      y: 'ý',
    },
    '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù', A: 'À', E: 'È', I: 'Ì', O: 'Ò', U: 'Ù' },
    '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û', A: 'Â', E: 'Ê', I: 'Î', O: 'Ô', U: 'Û' },
    '~': { a: 'ã', n: 'ñ', o: 'õ', A: 'Ã', N: 'Ñ', O: 'Õ' },
    c: { c: 'ç', C: 'Ç', s: 'ş', S: 'Ş' },
    v: { c: 'č', s: 'š', z: 'ž', r: 'ř', e: 'ě', C: 'Č', S: 'Š', Z: 'Ž', R: 'Ř' },
  }
  const SYMBOLS = {
    ss: 'ß',
    o: 'ø',
    O: 'Ø',
    ae: 'æ',
    AE: 'Æ',
    aa: 'å',
    AA: 'Å',
    l: 'ł',
    L: 'Ł',
    i: 'ı',
    '&': '&',
    '%': '%',
    _: '_',
    $: '$',
    '#': '#',
  }

  /** LaTeX text as plain text: accents and a few symbols spelled out, grouping braces and other commands dropped. */
  function plain(text) {
    return text
      .replace(
        /\\([cv"'`^~])\s*\{?\\?([A-Za-z])\}?/g,
        (_m, accent, letter) => ACCENTS[accent][letter] ?? letter,
      )
      .replace(/\\(ss|ae|AE|aa|AA|[oOlLi&%_$#])(?![A-Za-z])\s*/g, (_m, name) => SYMBOLS[name])
      .replace(/\\[A-Za-z]+\s*/g, '')
      .replace(/[{}]/g, '')
      .replace(/--/g, '–')
      .replace(/~/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /** `@type{key, field = {value} | "value" | number | macro # ..., ...}` entries; comments, preambles and broken entries are skipped. */
  function parse(source) {
    const strings = {
      jan: 'January',
      feb: 'February',
      mar: 'March',
      apr: 'April',
      may: 'May',
      jun: 'June',
      jul: 'July',
      aug: 'August',
      sep: 'September',
      oct: 'October',
      nov: 'November',
      dec: 'December',
    }
    const entries = []
    let at = 0
    const space = () => {
      while (at < source.length && /\s/.test(source[at])) at++
    }
    const braced = () => {
      let depth = 0
      const start = at
      for (; at < source.length; at++) {
        if (source[at] === '\\') at++
        else if (source[at] === '{') depth++
        else if (source[at] === '}' && --depth === 0) return source.slice(start + 1, at++)
      }
      return null
    }
    const quoted = () => {
      let depth = 0
      const start = ++at
      for (; at < source.length; at++) {
        if (source[at] === '\\') at++
        else if (source[at] === '{') depth++
        else if (source[at] === '}') depth--
        else if (source[at] === '"' && depth === 0) return source.slice(start, at++)
      }
      return null
    }
    const value = () => {
      const pieces = []
      for (;;) {
        space()
        let piece
        if (source[at] === '{') piece = braced()
        else if (source[at] === '"') piece = quoted()
        else {
          const word = /^[A-Za-z0-9_:.+-]+/.exec(source.slice(at))
          if (!word) return null
          at += word[0].length
          piece = /^\d+$/.test(word[0]) ? word[0] : (strings[word[0].toLowerCase()] ?? word[0])
        }
        if (piece === null) return null
        pieces.push(piece)
        space()
        if (source[at] !== '#') return pieces.join('')
        at++
      }
    }
    while (entries.length < MAX_ENTRIES) {
      const next = source.indexOf('@', at)
      if (next < 0) break
      at = next + 1
      const type = /^[A-Za-z]+/.exec(source.slice(at))
      if (!type) continue
      at += type[0].length
      space()
      const open = source[at]
      if (open !== '{' && open !== '(') continue
      const kind = type[0].toLowerCase()
      if (kind === 'comment' || kind === 'preamble') {
        if (open === '{') braced()
        continue
      }
      at++
      if (kind === 'string') {
        space()
        const name = /^[A-Za-z][A-Za-z0-9_:-]*/.exec(source.slice(at))
        if (!name) continue
        at += name[0].length
        space()
        if (source[at] !== '=') continue
        at++
        const text = value()
        if (text !== null) strings[name[0].toLowerCase()] = text
        continue
      }
      const key = /^[^,\s}]+/.exec(source.slice(at))
      if (!key) continue
      at += key[0].length
      const fields = {}
      let ok = true
      for (;;) {
        space()
        if (source[at] === ',') at++
        space()
        if (source[at] === '}' || source[at] === ')') {
          at++
          break
        }
        const name = /^[A-Za-z][A-Za-z0-9_:-]*/.exec(source.slice(at))
        if (!name) {
          ok = false
          break
        }
        at += name[0].length
        space()
        if (source[at] !== '=') {
          ok = false
          break
        }
        at++
        const text = value()
        if (text === null) {
          ok = false
          break
        }
        fields[name[0].toLowerCase()] = plain(text)
      }
      if (ok) entries.push({ type: kind, key: key[0], fields })
    }
    return entries
  }

  /** "Last, First" or "First Last", joined by "and"; "and others" is et al. */
  function authors(list) {
    if (!list) return ''
    const names = list
      .split(/\s+and\s+/)
      .map((n) => n.trim())
      .filter(Boolean)
    const others = names.length > 0 && names[names.length - 1].toLowerCase() === 'others'
    const people = (others ? names.slice(0, -1) : names).map((n) => {
      const comma = n.indexOf(',')
      return comma < 0 ? n : `${n.slice(comma + 1).trim()} ${n.slice(0, comma).trim()}`.trim()
    })
    if (others || people.length > 3) return `${people[0]} et al.`
    if (people.length <= 2) return people.join(' and ')
    return `${people.slice(0, -1).join(', ')}, and ${people[people.length - 1]}`
  }

  const md = (text) => text.replace(/([\\`*_[\]<>#|])/g, '\\$1')

  /** One reference: authors (year). *Title*. Where it appeared, pages. DOI or URL. */
  function reference({ type, key, fields: f }) {
    const who = authors(f.author || f.editor)
    const year = f.year ? ` (${md(f.year)})` : ''
    const container = f.journal || f.booktitle
    const book =
      type === 'book' || type === 'phdthesis' || type === 'mastersthesis' || type === 'techreport'
    const title = f.title ? (book ? `*${md(f.title)}*` : md(f.title)) : md(key)
    const parts = [`${who ? `${md(who)}${year}. ` : year ? `${year.trim()}. ` : ''}${title}.`]
    const where = []
    if (container) where.push(`*${md(container)}*`)
    if (f.volume) where.push(f.number ? `${md(f.volume)}(${md(f.number)})` : md(f.volume))
    if (f.pages) where.push(`pp. ${md(f.pages)}`)
    if (book && (f.publisher || f.school || f.institution))
      where.push(md(f.publisher || f.school || f.institution))
    if (where.length > 0) parts.push(`${where.join(', ')}.`)
    if (f.doi) parts.push(`doi:${md(f.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, ''))}`)
    else if (f.url) parts.push(md(f.url))
    return parts.join(' ')
  }

  const list = (entries) => entries.map((e) => `- ${reference(e)}`).join('\n')

  devot.preview.handle('bibtex', (source) => {
    const entries = parse(source)
    return entries.length > 0 ? list(entries) : null
  })

  // The note keeps the library as written in one block, which the preview shows as the reference list.
  devot.importer.handle('bibtex', ({ name, text }) => {
    const fence = '`'.repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map((t) => t.length + 1)))
    return {
      title: name.replace(/\.bib$/i, '').trim() || 'References',
      markdown: `${fence}bibtex\n${text.replace(/\s+$/, '')}\n${fence}\n`,
    }
  })
})()
