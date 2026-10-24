import sprite from './card-keys.svg?raw'

export interface KeySymbol {
  id: string
  /**
   * For the `svg` that shows the symbol: at the origin, as a `use` lays the symbol's own viewBox
   * out from there, and of the symbol's size, so each glyph is as wide as it draws.
   */
  viewBox: string
}

const SYMBOL =
  /<symbol id="([\w-]+)" data-glyph="([^"]+)" viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/g

const symbols = new Map(
  [...sprite.matchAll(SYMBOL)].map(([, id = '', glyph = '', width = '', height = '']) => [
    glyph,
    { id, viewBox: `0 0 ${width} ${height}` },
  ]),
)

/** The sprite's symbols without its own `svg`, for the one hidden `svg` the cards point into. */
export const keySymbolsMarkup = sprite.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, '').trim()

/**
 * The symbol for each glyph of a shortcut. Drawn shapes, because shaping ⌘, ⌥, ⇧ and ⇥ sends
 * a phone's browser looking through its fallback fonts, a long task on the first layout.
 */
export function keyGlyphs(glyphs: string): KeySymbol[] {
  return [...glyphs].map((glyph) => {
    const symbol = symbols.get(glyph)
    if (!symbol) throw new Error(`E_CARD_KEY_GLYPH no symbol for ${glyph} in card-keys.svg`)
    return symbol
  })
}
