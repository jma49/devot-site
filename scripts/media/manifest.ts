import type { Edge } from '../../src/media.ts'
import type { Rect } from './frames.ts'

// src/media.json: what a capture measured for each slot, read by src/media.ts.

export interface Measured {
  width: number
  height: number
  duration: number
  edges: Edge[]
}

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

/** Two-space JSON with each slot's fields on their own lines and the edges on one. */
export function serializeManifest(manifest: Manifest): string {
  const slots = Object.entries(manifest).map(([name, entry]) => {
    const { width, height, duration, edges } = entry!
    return [
      `  ${JSON.stringify(name)}: {`,
      `    "width": ${width},`,
      `    "height": ${height},`,
      `    "duration": ${duration},`,
      `    "edges": [${edges.map((edge) => JSON.stringify(edge)).join(', ')}]`,
      '  }',
    ].join('\n')
  })
  return `{\n${slots.join(',\n')}\n}\n`
}
