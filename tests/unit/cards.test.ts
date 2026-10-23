import { describe, expect, it } from 'vitest'
import { cardsCopy, type CardText } from '../../src/i18n/en/cards.ts'
import { SLOTS } from '../../src/media.ts'

const { items } = cardsCopy.cards
const plain = (body: readonly CardText[]) =>
  body.map((run) => (typeof run === 'string' ? run : run.code)).join('')
const words = (text: string) => text.split(/\s+/).filter((word) => /\p{L}|\d|\{/u.test(word))

describe('feature card copy', () => {
  it('covers every card slot of the media manifest, in order', () => {
    expect(Object.keys(items)).toEqual(SLOTS.filter((slot) => slot.startsWith('card-')))
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
})
