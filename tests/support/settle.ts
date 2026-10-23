import type { Page } from '@playwright/test'

// Waits for a settled state instead of a fixed time: a sleep that is long enough on a quiet
// machine is too short on a busy one, and every extra millisecond is paid on every run.

/**
 * Resolves after `count` animation frames of the page, so scroll handlers, observers and frame
 * callbacks have run.
 */
export async function frames(page: Page, count = 2): Promise<void> {
  await page.evaluate(
    (left) =>
      new Promise<void>((resolve) => {
        const step = (remaining: number) =>
          remaining <= 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1))
        step(left)
      }),
    count,
  )
}

export interface SteadyOptions {
  /** Consecutive frames that must agree. */
  frames?: number
  timeout?: number
}

/**
 * Resolves with the value of `probe` once it returns the same value on several consecutive
 * animation frames: a scrubbed or eased value has caught up and stopped.
 */
export async function steady<T>(
  page: Page,
  probe: () => Promise<T>,
  { frames: needed = 3, timeout = 10_000 }: SteadyOptions = {},
): Promise<T> {
  const deadline = Date.now() + timeout
  let last = JSON.stringify(await probe())
  for (let same = 1; same < needed;) {
    if (Date.now() > deadline) throw new Error(`E_NOT_STEADY after ${timeout} ms, last ${last}`)
    await frames(page, 1)
    const next = JSON.stringify(await probe())
    same = next === last ? same + 1 : 1
    last = next
  }
  return JSON.parse(last) as T
}

/**
 * Waits until no finite animation or transition on the document clock is running, in the whole
 * page or under `scope`: entrances and reveals have finished, while endless loops and
 * scroll-linked effects are left alone.
 */
export async function animationsDone(page: Page, scope?: string): Promise<void> {
  await page.waitForFunction((selector) => {
    const root = selector === null ? document : document.querySelector(selector)
    if (root === null) return true
    const list =
      root instanceof Document ? root.getAnimations() : root.getAnimations({ subtree: true })
    return list.every(
      (animation) =>
        animation.timeline !== document.timeline ||
        animation.playState !== 'running' ||
        animation.effect?.getComputedTiming().endTime === Infinity,
    )
  }, scope ?? null)
}

/** Scrolls the page to `y` and resolves once the scroll has landed and two frames have drawn. */
export async function scrollToY(page: Page, y: number): Promise<number> {
  const landed = await page.evaluate(async (top) => {
    const target = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight))
    window.scrollTo(0, target)
    await new Promise<void>((resolve) => {
      const wait = () =>
        Math.abs(window.scrollY - target) < 1 ? resolve() : requestAnimationFrame(wait)
      wait()
    })
    return window.scrollY
  }, y)
  await frames(page)
  return landed
}

/**
 * Scrolls so that the `edge` of `selector` (its `top` or `bottom`) sits at `at` of the viewport
 * height, then waits as `scrollToY` does. Resolves with the page's scroll position.
 */
export async function placeEdge(
  page: Page,
  selector: string,
  edge: 'top' | 'bottom',
  at: number,
  index = 0,
): Promise<number> {
  const y = await page.evaluate(
    ([sel, side, share, nth]) => {
      const element = document.querySelectorAll(sel as string)[nth as number]
      if (!element) throw new Error(`E_NO_ELEMENT ${sel}[${nth}]`)
      const box = element.getBoundingClientRect()
      return window.scrollY + box[side as 'top' | 'bottom'] - innerHeight * (share as number)
    },
    [selector, edge, at, index] as const,
  )
  return scrollToY(page, y)
}
