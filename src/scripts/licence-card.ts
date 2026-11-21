import { browserEnv, REDUCED_MOTION_QUERY, type DomEnv } from '../lib/dom-env.ts'
import { setVar } from '../lib/motion.ts'

/** How far the card leans toward the pointer at its edge, in degrees: the quiet end of a holographic card. */
export const MAX_TILT = 6

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
const FORCED_COLORS_QUERY = '(forced-colors: active)'

/** The lean and the light for a pointer at (x, y) within a box, each from 0 to 1. */
export function tiltAt(
  x: number,
  y: number,
): { axisX: number; axisY: number; angle: number; lightX: number; lightY: number } {
  const dx = Math.min(1, Math.max(0, x)) * 2 - 1
  const dy = Math.min(1, Math.max(0, y)) * 2 - 1
  const reach = Math.min(1, Math.hypot(dx, dy))
  // The card turns about the axis across the pointer's offset, so the near edge dips toward it.
  const length = Math.hypot(dx, dy) || 1
  return {
    axisX: -dy / length,
    axisY: dx / length,
    angle: reach * MAX_TILT,
    lightX: (dx + 1) * 50,
    lightY: (dy + 1) * 50,
  }
}

/**
 * Leans the licence card toward a fine pointer and moves a sheen of light across it. A card at rest
 * is flat and plain; reduced motion, forced colours and touch screens never lean it.
 */
export function tiltLicenceCard(
  root: ParentNode = document,
  env: DomEnv = browserEnv(),
): () => void {
  const card = root.querySelector<HTMLElement>('[data-holo]')
  if (!card) return () => {}
  const allowed = () =>
    env.matchMedia(FINE_POINTER_QUERY).matches &&
    !env.matchMedia(REDUCED_MOTION_QUERY).matches &&
    !env.matchMedia(FORCED_COLORS_QUERY).matches
  let frame = 0
  let pointer: { x: number; y: number } | undefined

  const draw = () => {
    frame = 0
    if (!pointer) return
    const box = card.getBoundingClientRect()
    const tilt = tiltAt((pointer.x - box.left) / box.width, (pointer.y - box.top) / box.height)
    setVar(card, '--holo-axis-x', tilt.axisX.toFixed(3))
    setVar(card, '--holo-axis-y', tilt.axisY.toFixed(3))
    setVar(card, '--holo-angle', `${tilt.angle.toFixed(2)}deg`)
    setVar(card, '--holo-light-x', `${tilt.lightX.toFixed(1)}%`)
    setVar(card, '--holo-light-y', `${tilt.lightY.toFixed(1)}%`)
  }
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || !allowed()) return
    pointer = { x: event.clientX, y: event.clientY }
    card.dataset['holo'] = 'lit'
    if (!frame) frame = requestAnimationFrame(draw)
  }
  const rest = () => {
    pointer = undefined
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    card.dataset['holo'] = ''
    setVar(card, '--holo-angle', '0deg')
  }
  card.addEventListener('pointermove', move)
  card.addEventListener('pointerleave', rest)
  return () => {
    card.removeEventListener('pointermove', move)
    card.removeEventListener('pointerleave', rest)
    rest()
  }
}
