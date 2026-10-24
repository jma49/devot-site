import type { Page } from '@playwright/test'
import type { CursorFrame } from './timeline.ts'

// What the window has on a Mac but the browser build does not draw, in the top layer so nothing in
// the page covers it: the traffic lights, which sit in the 52 pt top bar on its centre line
// (tauri.conf.json trafficLightPosition), and a pointer. The pointer is a soft dark arrow with a
// light rim and a ripple for clicks (light on a dark window), moved frame by frame from frames.ts
// so it follows the clip's clock. Neither takes pointer events.

const ARROW =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="28" viewBox="-2 -2 22 28">' +
  '<path d="M1.2 1.2 L1.2 19.6 Q1.2 21 2.3 20.1 L6.6 16.4 L9.6 23.1 Q10.1 24.1 11.1 23.7 L13.1 22.8 ' +
  'Q14.1 22.3 13.6 21.3 L10.7 14.8 L16.4 14.6 Q17.8 14.5 16.8 13.5 L2.6 0.3 Q1.2 -0.6 1.2 1.2 Z" ' +
  'fill="#1c1c1e" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>'

const LIGHTS = [
  { fill: '#ff5f57', rim: '#e0443e' },
  { fill: '#febc2e', rim: '#dea123' },
  { fill: '#28c840', rim: '#1aab29' },
]

export async function installOverlay(page: Page): Promise<void> {
  await page.evaluate(
    ({ arrow, dots }) => {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches
      document.getElementById('media-overlay')?.remove()
      const layer = document.createElement('div')
      layer.id = 'media-overlay'
      layer.popover = 'manual'
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        margin: '0',
        padding: '0',
        border: '0',
        background: 'transparent',
        pointerEvents: 'none',
        zIndex: '2147483647',
        overflow: 'hidden',
      })
      dots.forEach((light, i) => {
        const dot = document.createElement('div')
        Object.assign(dot.style, {
          position: 'absolute',
          left: `${20 + i * 20}px`,
          top: '20px',
          width: '12px',
          height: '12px',
          boxSizing: 'border-box',
          borderRadius: '50%',
          background: light.fill,
          border: `0.5px solid ${light.rim}`,
        })
        layer.append(dot)
      })
      const ripple = document.createElement('div')
      ripple.id = 'media-ripple'
      Object.assign(ripple.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '34px',
        height: '34px',
        marginLeft: '-17px',
        marginTop: '-17px',
        borderRadius: '50%',
        background: dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(28, 28, 30, 0.14)',
        boxShadow: dark
          ? '0 0 0 1.5px rgba(255, 255, 255, 0.3)'
          : '0 0 0 1.5px rgba(28, 28, 30, 0.22)',
        opacity: '0',
      })
      const pointer = document.createElement('div')
      pointer.id = 'media-pointer'
      pointer.innerHTML = arrow
      Object.assign(pointer.style, {
        position: 'absolute',
        left: '-3px',
        top: '-3px',
        width: '22px',
        height: '28px',
        transformOrigin: '3px 3px',
        filter:
          'drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.28)) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.12))',
        opacity: '0',
      })
      layer.append(ripple, pointer)
      document.body.append(layer)
      layer.showPopover()
    },
    { arrow: ARROW, dots: LIGHTS },
  )
}

export async function drawCursor(page: Page, frame: CursorFrame): Promise<void> {
  await page.evaluate((f) => {
    const layer = document.getElementById('media-overlay')
    const pointer = document.getElementById('media-pointer')
    const ripple = document.getElementById('media-ripple')
    if (!layer || !pointer || !ripple) return
    // A modal dialog (Revision History, the template picker) joins the top layer above the
    // overlay; showing the overlay again puts it back on top, as the system pointer is.
    if (document.querySelector('dialog:modal')) {
      layer.hidePopover()
      layer.showPopover()
    }
    pointer.style.transform = `translate(${f.x}px, ${f.y}px) scale(${f.press})`
    pointer.style.opacity = String(f.opacity)
    if (f.ripple) {
      const eased = 1 - (1 - f.ripple.progress) ** 3
      ripple.style.transform = `translate(${f.ripple.x}px, ${f.ripple.y}px) scale(${0.35 + 0.85 * eased})`
      ripple.style.opacity = String(0.9 * (1 - f.ripple.progress))
    } else {
      ripple.style.opacity = '0'
    }
  }, frame)
}
