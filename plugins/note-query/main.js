'use strict'
;(() => {
  const MAX_NOTES = 500
  const MAX_READ = 200
  const MAX_ROWS = 200
  const BUILTIN = ['title', 'notebook', 'created', 'updated', 'tags', 'status', 'pinned']
  const KEYWORDS = ['TABLE', 'LIST', 'FROM', 'WHERE', 'SORT', 'LIMIT']

  const fail = (message) => {
    throw Object.assign(new Error(message), { query: true })
  }

  /** Words, quoted strings, `#tags`, numbers, operators and commas. */
  function tokens(source) {
    const out = []
    const pattern =
      /\s+|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(#[\p{L}\p{N}_/-]+)|(<=|>=|!=|=|<|>|,)|([\p{L}\p{N}_.:-]+)/uy
    let at = 0
    while (at < source.length) {
      pattern.lastIndex = at
      const m = pattern.exec(source)
      if (!m) fail(`cannot read "${source.slice(at, at + 12)}"`)
      at = pattern.lastIndex
      if (m[1] !== undefined || m[2] !== undefined) {
        out.push({ kind: 'string', value: (m[1] ?? m[2]).replace(/\\(.)/g, '$1') })
      } else if (m[3]) out.push({ kind: 'tag', value: m[3].slice(1) })
      else if (m[4]) out.push({ kind: 'op', value: m[4] })
      else if (m[5]) out.push({ kind: 'word', value: m[5] })
    }
    return out
  }

  /** The query a block holds; throws a short message for one it cannot read. */
  function parse(source) {
    const list = tokens(source.replace(/^\s*(?:\/\/|--).*$/gm, ''))
    let at = 0
    const peek = () => list[at]
    const isWord = (word) =>
      peek()?.kind === 'word' && peek().value.toUpperCase() === word.toUpperCase()
    const take = () => list[at++]
    const takeWord = (word) => (isWord(word) ? take() : null)
    const field = () => {
      const t = take()
      if (!t || t.kind !== 'word' || KEYWORDS.includes(t.value.toUpperCase()))
        fail('a field name is missing')
      return t.value
    }
    const value = () => {
      const t = take()
      if (!t) fail('a value is missing')
      if (t.kind === 'string') return t.value
      if (t.kind === 'tag') return t.value
      if (t.kind !== 'word') fail(`"${t.value}" is no value`)
      if (/^(true|false)$/i.test(t.value)) return t.value.toLowerCase() === 'true'
      if (/^-?\d+(\.\d+)?$/.test(t.value)) return Number(t.value)
      return t.value
    }

    const query = { kind: 'table', fields: [], from: [], where: null, sort: [], limit: null }
    if (takeWord('LIST')) query.kind = 'list'
    else if (takeWord('TABLE')) {
      while (peek() && !KEYWORDS.includes(String(peek().value).toUpperCase())) {
        const name = field()
        const label = takeWord('AS') ? value() : name
        query.fields.push({ name, label: String(label) })
        if (peek()?.value === ',') take()
      }
    } else fail('a query starts with TABLE or LIST')

    if (takeWord('FROM')) {
      do {
        const t = take()
        if (t?.kind === 'tag') query.from.push({ tag: t.value.toLowerCase() })
        else if (t?.kind === 'string') query.from.push({ notebook: t.value })
        else fail('FROM takes a #tag or a "notebook"')
      } while (takeWord('OR'))
    }

    if (takeWord('WHERE')) {
      const condition = () => {
        const negate = Boolean(takeWord('NOT'))
        const name = field()
        let op = null
        let operand
        if (takeWord('contains')) op = 'contains'
        else if (peek()?.kind === 'op' && peek().value !== ',') op = take().value
        if (op) operand = value()
        return { negate, name, op, operand }
      }
      const any = [[condition()]]
      for (;;) {
        if (takeWord('AND')) any.at(-1).push(condition())
        else if (takeWord('OR')) any.push([condition()])
        else break
      }
      query.where = any
    }

    if (takeWord('SORT')) {
      do {
        const name = field()
        const desc = Boolean(takeWord('DESC'))
        if (!desc) takeWord('ASC')
        query.sort.push({ name, desc })
      } while (peek()?.value === ',' && take())
    }

    if (takeWord('LIMIT')) {
      const n = value()
      if (!Number.isInteger(n) || n < 1) fail('LIMIT takes a whole number')
      query.limit = n
    }
    if (peek()) fail(`"${peek().value}" is not understood here`)
    return query
  }

  const day = (ms) => new Date(ms).toISOString().slice(0, 10)

  function valueOf(note, name) {
    const key = name.toLowerCase()
    if (key === 'title') return note.title
    if (key === 'notebook') return note.notebookName
    if (key === 'created') return day(note.createdAt)
    if (key === 'updated') return day(note.updatedAt)
    if (key === 'tags') return note.tags
    if (key === 'status') return note.status
    if (key === 'pinned') return note.pinned
    const properties = note.properties ?? {}
    const found = Object.keys(properties).find((k) => k.toLowerCase() === key)
    return found === undefined ? null : properties[found]
  }

  const empty = (v) =>
    v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

  function compare(a, b) {
    if (empty(a) && empty(b)) return 0
    if (empty(a)) return 1
    if (empty(b)) return -1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b)
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  }

  function holds(note, { negate, name, op, operand }) {
    const v = valueOf(note, name)
    let result
    if (op === null) result = !empty(v) && v !== false
    else if (op === 'contains') {
      const want = String(operand).toLowerCase()
      result = Array.isArray(v)
        ? v.some((item) => String(item).toLowerCase() === want)
        : String(v ?? '')
            .toLowerCase()
            .includes(want)
    } else if (Array.isArray(v)) {
      result =
        op === '='
          ? v.some((item) => compare(item, operand) === 0)
          : op === '!='
            ? !v.some((item) => compare(item, operand) === 0)
            : false
    } else {
      const c = empty(v)
        ? Number.NaN
        : compare(
            typeof operand === 'number' &&
              typeof v === 'string' &&
              v.trim() !== '' &&
              !Number.isNaN(Number(v))
              ? Number(v)
              : v,
            operand,
          )
      result =
        op === '='
          ? c === 0
          : op === '!='
            ? c !== 0
            : op === '<'
              ? c < 0
              : op === '>'
                ? c > 0
                : op === '<='
                  ? c <= 0
                  : c >= 0
    }
    return negate ? !result : result
  }

  const cell = (v) => {
    if (empty(v)) return ''
    const text = Array.isArray(v)
      ? v.map(String).join(', ')
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v)
    return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  }
  // A link to the note by its ID: the preview draws one whose text is the note's title as the note's chip.
  const link = (note) => {
    const title = note.title.replace(/\s+/g, ' ').trim() || 'Untitled'
    return `[${title.replace(/[\\[\]|*_`<>~]/g, (c) => `\\${c}`)}](devot://note/${note.id})`
  }

  async function run(source) {
    let query
    try {
      query = parse(source)
    } catch (error) {
      if (error && error.query) return `**Query:** ${cell(error.message)}.`
      throw error
    }
    const [notes, notebooks] = await Promise.all([
      devot.notes.list({ limit: MAX_NOTES }),
      devot.notebooks.list(),
    ])
    const books = new Map(notebooks.map((b) => [b.id, b.name]))
    let found = notes.map((n) => ({
      ...n,
      notebookName: n.notebook ? (books.get(n.notebook) ?? '') : '',
    }))
    if (query.from.length > 0) {
      found = found.filter((n) =>
        query.from.some((f) =>
          f.tag !== undefined
            ? n.tags.some((t) => {
                const tag = t.toLowerCase()
                return tag === f.tag || tag.startsWith(`${f.tag}/`)
              })
            : n.notebookName.toLowerCase() === f.notebook.toLowerCase(),
        ),
      )
    }
    const named = [
      ...query.fields.map((f) => f.name),
      ...(query.where ?? []).flat().map((c) => c.name),
      ...query.sort.map((s) => s.name),
    ]
    const candidates = found
    let unread = 0
    if (named.some((name) => !BUILTIN.includes(name.toLowerCase()))) {
      unread = Math.max(0, candidates.length - MAX_READ)
      found = await Promise.all(
        candidates
          .slice(0, MAX_READ)
          .map(async (n) => ({ ...n, properties: (await devot.notes.get(n.id)).properties })),
      )
    }
    if (query.where)
      found = found.filter((n) => query.where.some((all) => all.every((c) => holds(n, c))))
    if (query.sort.length > 0) {
      found.sort((a, b) => {
        for (const { name, desc } of query.sort) {
          const c = compare(valueOf(a, name), valueOf(b, name))
          if (c !== 0) return desc ? -c : c
        }
        return 0
      })
    }
    const total = found.length
    found = found.slice(0, Math.min(query.limit ?? MAX_ROWS, MAX_ROWS))
    const remarks = []
    if (unread > 0) remarks.push(`Only the first ${MAX_READ} notes were read for their properties.`)
    if (total > found.length && query.limit === null)
      remarks.push(`${total - found.length} more notes match.`)
    if (found.length === 0) return ['No notes match.', ...remarks].join('\n\n')
    let out
    if (query.kind === 'list') out = found.map((n) => `- ${link(n)}`).join('\n')
    else {
      const head = ['Note', ...query.fields.map((f) => cell(f.label))]
      out = [
        `| ${head.join(' | ')} |`,
        `| ${head.map(() => '---').join(' | ')} |`,
        ...found.map(
          (n) =>
            `| ${[link(n), ...query.fields.map((f) => cell(valueOf(n, f.name)))].join(' | ')} |`,
        ),
      ].join('\n')
    }
    return [out, ...remarks].join('\n\n')
  }

  devot.preview.handle('query', run)
  devot.preview.handle('dataview', run)
})()
