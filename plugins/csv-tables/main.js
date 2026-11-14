'use strict'
;(() => {
  const PREVIEW_ROWS = 500

  /** RFC 4180 fields: quotes around a field, doubled quotes inside it, CRLF or LF between rows. */
  function parseRows(text, delimiter) {
    const rows = []
    let row = []
    let field = ''
    let quoted = false
    for (let at = 0; at < text.length; at++) {
      const c = text[at]
      if (quoted) {
        if (c === '"' && text[at + 1] === '"') {
          field += '"'
          at++
        } else if (c === '"') {
          quoted = false
        } else {
          field += c
        }
      } else if (c === '"' && field === '') {
        quoted = true
      } else if (c === delimiter) {
        row.push(field)
        field = ''
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[at + 1] === '\n') at++
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else {
        field += c
      }
    }
    if (field !== '' || row.length > 0) {
      row.push(field)
      rows.push(row)
    }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
  }

  /** A semicolon file (as spreadsheets write where the comma is the decimal mark) has more of them in its first line. */
  function guessDelimiter(text) {
    const first = text.split(/\r?\n/, 1)[0]
    const count = (c) => first.split(c).length - 1
    if (count('\t') > 0 && count('\t') >= count(',')) return '\t'
    return count(';') > count(',') ? ';' : ','
  }

  const cell = (value) =>
    value
      .replace(/\r\n?|\n/g, ' ')
      .trim()
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')

  function table(rows, limit) {
    if (rows.length === 0) return ''
    const width = Math.max(...rows.map((r) => r.length))
    const line = (r) =>
      `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? '')).join(' | ')} |`
    const [head, ...body] = rows
    const shown = limit === undefined ? body : body.slice(0, limit)
    const lines = [line(head), `|${' --- |'.repeat(width)}`, ...shown.map(line)]
    const more = body.length - shown.length
    if (more > 0) lines.push('', `${more} more rows are not shown.`)
    return lines.join('\n')
  }

  function csvToMarkdown(text, delimiter = guessDelimiter(text), limit) {
    return table(parseRows(text.replace(/^﻿/, ''), delimiter), limit)
  }

  const title = (name) => name.replace(/\.(csv|tsv)$/i, '').trim() || 'Table'

  devot.importer.handle('csv', ({ name, text }) => ({
    title: title(name),
    markdown: `${csvToMarkdown(text, /\.tsv$/i.test(name) ? '\t' : undefined)}\n`,
  }))

  devot.preview.handle('csv', (source) => csvToMarkdown(source, undefined, PREVIEW_ROWS) || null)
})()
