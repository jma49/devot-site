export interface GradientStop {
  /** The stop's colour as written, or the two colours a `color-mix()` blends. */
  colours: [string] | [string, string]
  /** The share of the first colour, from 0 to 1; 1 for a stop of one colour. */
  share: number
  /** Where the stop sits along the gradient line, from 0 to 1; null where the value gives none. */
  offset: number | null
}

export interface Gradient {
  /** CSS gradient angle in degrees. */
  angle: number
  stops: GradientStop[]
}

const GRADIENT = /^\s*linear-gradient\(\s*(-?[\d.]+)deg\s*,(.*)\)\s*$/s
const MIX = /^color-mix\(\s*in\s+srgb\s*,(.*)\)$/s
const SHARE = /\s*(?:calc\(\s*([\d.]+)\s*\*\s*1%\s*\)|([\d.]+)%)$/
const OFFSET = /\s+([\d.]+)%$/
// A variable the value still names, as in the token file, stands for its fallback.
const FALLBACK = /var\(\s*--[\w-]+\s*,\s*([\d.]+)\s*\)/g

/** The parts of a comma-separated list, leaving the commas inside brackets alone. */
function parts(list: string): string[] | null {
  const found: string[] = []
  let depth = 0
  let from = 0
  for (let at = 0; at < list.length; at++) {
    const char = list[at]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      found.push(list.slice(from, at).trim())
      from = at + 1
    }
    if (depth < 0) return null
  }
  if (depth !== 0) return null
  found.push(list.slice(from).trim())
  return found
}

function stop(text: string): GradientStop | null {
  const written = OFFSET.exec(text)
  const offset = written ? Number(written[1]) / 100 : null
  const colour = written ? text.slice(0, written.index) : text
  if (colour === '') return null
  const mix = MIX.exec(colour)
  if (!mix) return { colours: [colour], share: 1, offset }
  const [first, second, ...rest] = parts(mix[1] ?? '') ?? []
  const share = SHARE.exec(first ?? '')
  if (!first || !second || rest.length > 0 || !share) return null
  return {
    colours: [first.slice(0, share.index), second],
    share: Number(share[1] ?? share[2]) / 100,
    offset,
  }
}

/**
 * A token gradient such as Devot's `--backdrop`: `linear-gradient(<angle>deg, <stop> [<offset>%], …)`,
 * where a stop is one colour or `color-mix(in srgb, <colour> <share>, <colour>)`, the form the
 * app's Gradient setting gives the outer stops. Null for anything else.
 */
export function parseGradient(value: string): Gradient | null {
  const gradient = GRADIENT.exec(value.replace(FALLBACK, '$1'))
  if (!gradient) return null
  const stops = parts(gradient[2] ?? '')?.map(stop)
  if (!stops || stops.length === 0 || stops.some((found) => found === null)) return null
  return { angle: Number(gradient[1]), stops: stops as GradientStop[] }
}
