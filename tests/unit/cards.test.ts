import { describe, expect, it } from 'vitest'
import { cardsCopy, type CardText } from '../../src/i18n/en/cards.ts'
import { keyGlyphs, keySymbolsMarkup } from '../../src/components/home/card-keys.ts'
import { media, SLOTS } from '../../src/media.ts'

const { items } = cardsCopy.cards
const plain = (body: readonly CardText[]) =>
  body.map((run) => (typeof run === 'string' ? run : run.code)).join('')
const words = (text: string) => text.split(/\s+/).filter((word) => /\p{L}|\d|\{/u.test(word))

describe('feature card copy', () => {
  it('covers every card slot of the media manifest, in order', () => {
    expect(Object.keys(items)).toEqual(SLOTS.filter((slot) => slot.startsWith('card-')))
  })

  it('labels each card with the topic its clip shows', () => {
    for (const [slot, { label }] of Object.entries(items)) {
      const topic = label.toLowerCase().replace(/s$/, '')
      expect(media[slot as keyof typeof items].alt.toLowerCase(), slot).toContain(topic)
    }
  })

  it('gives each card a short label and one benefit sentence of 15 to 25 words', () => {
    for (const [slot, { label, body }] of Object.entries(items)) {
      const sentence = plain(body)
      expect(words(label).length, slot).toBeLessThanOrEqual(3)
      expect(words(sentence).length, `${slot}: ${sentence}`).toBeGreaterThanOrEqual(15)
      expect(words(sentence).length, `${slot}: ${sentence}`).toBeLessThanOrEqual(25)
      expect(sentence, slot).toMatch(/^[A-Z{].*\.$/)
      expect(sentence.match(/\. /g), `${slot} is one sentence`).toBeNull()
    }
  })

  it('names every shortcut in words for screen readers', () => {
    const withKeys = Object.values(items).flatMap((item) => ('keys' in item ? [item.keys] : []))
    expect(withKeys.length).toBeGreaterThan(0)
    for (const { glyphs, spoken } of withKeys) {
      expect(glyphs.trim()).not.toBe('')
      expect(spoken).toMatch(/^[A-Z][\w ]+: [A-Z]/)
    }
  })

  it('sets placeholders apart as code, so they read as what you type', () => {
    const codes = Object.values(items).flatMap(({ body }) =>
      body.flatMap((run) => (typeof run === 'string' ? [] : [run.code])),
    )
    expect(codes).toEqual(['{{date}}', '{{title}}'])
    const prose = Object.values(items).flatMap(({ body }) =>
      body.flatMap((run) => (typeof run === 'string' ? [run] : [])),
    )
    expect(prose.filter((run) => run.includes('{{'))).toEqual([])
  })

  it('gives each card a short heading of its own, apart from its label', () => {
    for (const [slot, { label, title: heading }] of Object.entries(items)) {
      expect(words(heading).length, slot).toBeGreaterThanOrEqual(3)
      expect(words(heading).length, slot).toBeLessThanOrEqual(6)
      expect(heading, slot).toMatch(/^[A-Z][^.]*[a-z]\.$/)
      expect(heading.toLowerCase(), slot).not.toBe(label.toLowerCase())
    }
    expect(new Set(Object.values(items).map(({ title }) => title)).size).toBe(
      Object.keys(items).length,
    )
  })
})

describe('shortcut glyphs', () => {
  const shown = Object.values(items).flatMap((item) => ('keys' in item ? [item.keys.glyphs] : []))

  it('draws every glyph a card shows from the sprite, so no font has to supply it', () => {
    for (const glyphs of shown) {
      const symbols = keyGlyphs(glyphs)
      expect(symbols.length, glyphs).toBe([...glyphs].length)
      for (const { id, viewBox } of symbols) {
        expect(keySymbolsMarkup, glyphs).toContain(`id="${id}"`)
        expect(viewBox, id).toMatch(/^0 0 \d+(\.\d+)? 16$/)
      }
    }
  })

  it('refuses a glyph the sprite has no symbol for', () => {
    expect(() => keyGlyphs('\u2303')).toThrow(/^E_CARD_KEY_GLYPH/)
  })

  it('keeps the sprite to shapes, coloured and stroked by the stylesheet', () => {
    expect(keySymbolsMarkup).toMatch(/<symbol\b/)
    expect(keySymbolsMarkup).not.toMatch(/<svg|<text|<style|\sstyle=|\s(fill|stroke)=/)
  })
})
