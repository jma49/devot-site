/**
 * Runs `task` once the page has loaded and painted a frame, when the main thread has a moment to
 * spare.
 */
export function afterFirstPaint(task: () => void): void {
  const idle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: 1000 })
    } else {
      setTimeout(task, 0)
    }
  }
  const painted = () => requestAnimationFrame(() => requestAnimationFrame(idle))
  if (document.readyState === 'complete') painted()
  else window.addEventListener('load', painted, { once: true })
}
