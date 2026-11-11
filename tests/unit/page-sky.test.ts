import { describe, expect, it } from 'vitest'
import { anyOnScreen } from '../../src/scripts/page-sky.ts'
import { readRepoFile } from '../support/source-files.ts'

/** An observer that reports what the test tells it to. */
function fakeObserver() {
  const watched: Element[] = []
  let callback: IntersectionObserverCallback = () => {}
  let disconnected = false
  const observe = (given: IntersectionObserverCallback) => {
    callback = given
    return {
      observe: (element: Element) => void watched.push(element),
      disconnect: () => {
        disconnected = true
      },
    }
  }
  const report = (...entries: [Element, boolean][]) =>
    callback(
      entries.map(
        ([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry,
      ),
      {} as IntersectionObserver,
    )
  return { observe, report, watched, disconnected: () => disconnected }
}

const part = (name: string) => ({ name }) as unknown as Element

describe('anyOnScreen', () => {
  it('watches every part and says when the first comes on screen and the last leaves', () => {
    const [features, pricing, footer] = [part('features'), part('pricing'), part('footer')]
    const observer = fakeObserver()
    const seen: boolean[] = []
    anyOnScreen([features!, pricing!, footer!], (shown) => seen.push(shown), observer.observe)
    expect(observer.watched).toEqual([features, pricing, footer])
    expect(seen).toEqual([])

    observer.report([features!, false], [pricing!, false], [footer!, false])
    expect(seen).toEqual([false])
    observer.report([features!, true])
    observer.report([pricing!, true])
    expect(seen).toEqual([false, true])
    observer.report([features!, false])
    expect(seen).toEqual([false, true])
    observer.report([pricing!, false])
    expect(seen).toEqual([false, true, false])
  })

  it('stops watching when asked', () => {
    const observer = fakeObserver()
    const stop = anyOnScreen([part('features')], () => {}, observer.observe)
    expect(observer.disconnected()).toBe(false)
    stop()
    expect(observer.disconnected()).toBe(true)
  })
})

describe('the sky behind the page', () => {
  const template = readRepoFile('src/components/home/PageSky.astro')
  const script = readRepoFile('src/scripts/page-sky.ts')

  it('carries a canvas for the shader over its CSS aurora, out of the accessibility tree', () => {
    expect(template).toMatch(
      /<div class="page-sky" aria-hidden="true" data-page-sky data-backdrop="css">/,
    )
    expect(template.indexOf('<Aurora ')).toBeLessThan(template.indexOf('<canvas '))
    expect(template).toContain('data-sky-canvas')
  })

  it('draws the soft sky, and only once a part under it is on screen', () => {
    expect(script).toMatch(/soft: true/)
    expect(script).toMatch(/thrifty: true/)
    expect(script).toContain("'main > section:not([data-hero]), body > footer'")
    expect(script).toMatch(/import\('\.\/hero-backdrop\.ts'\)/)
    expect(script).not.toMatch(/^import .*hero-backdrop/m)
  })
})
