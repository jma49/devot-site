import type { Edge, Measured } from '../../src/media.ts'
import type { Rect } from './frames.ts'

// src/media.json: what a capture measured for each slot, read by src/media.ts.

export type Manifest = Partial<Record<string, Measured>>

export function edgesOf(clip: Rect, viewport: { width: number; height: number }): Edge[] {
  const edges: Edge[] = []
  if (clip.y === 0) edges.push('top')
  if (clip.x + clip.width === viewport.width) edges.push('right')
  if (clip.y + clip.height === viewport.height) edges.push('bottom')
  if (clip.x === 0) edges.push('left')
  return edges
}

export function withEntry(
  manifest: Manifest,
  slot: string,
  entry: Measured,
  order: readonly string[],
): Manifest {
  const next: Manifest = { ...manifest, [slot]: entry }
  return Object.fromEntries(order.filter((name) => next[name]).map((name) => [name, next[name]]))
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

function write(value: Json, indent: string): string {
  if (Array.isArray(value)) return `[${value.map((item) => write(item, indent)).join(', ')}]`
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  const inner = `${indent}  `
  const fields = Object.entries(value).map(
    ([key, item]) => `${inner}${JSON.stringify(key)}: ${write(item, inner)}`,
  )
  return fields.length === 0 ? '{}' : `{\n${fields.join(',\n')}\n${indent}}`
}

/** Two-space JSON with every object's fields on their own lines and arrays on one, as the formatter writes it. */
export function serializeManifest(manifest: Manifest): string {
  return `${write(manifest as unknown as Json, '')}\n`
}
