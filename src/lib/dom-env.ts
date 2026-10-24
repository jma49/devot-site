export type ObserverLike = Pick<IntersectionObserver, 'observe' | 'unobserve' | 'disconnect'>
export type MediaQueryLike = Pick<
  MediaQueryList,
  'matches' | 'addEventListener' | 'removeEventListener'
>

/** The browser services the motion helpers use, so tests can stand in for them. */
export interface DomEnv {
  createObserver(
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit,
  ): ObserverLike
  matchMedia(query: string): MediaQueryLike
  pageHidden(): boolean
  /** Calls `handler` when the tab is shown or hidden; returns a function that stops it. */
  onPageVisibility(handler: () => void): () => void
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function browserEnv(): DomEnv {
  return {
    createObserver: (callback, options) => new IntersectionObserver(callback, options),
    matchMedia: (query) => window.matchMedia(query),
    pageHidden: () => document.hidden,
    onPageVisibility: (handler) => {
      document.addEventListener('visibilitychange', handler)
      return () => document.removeEventListener('visibilitychange', handler)
    },
  }
}
