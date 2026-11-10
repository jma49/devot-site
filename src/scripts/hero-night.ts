/** Seconds the night's recording may stand apart from the hero clip before it is moved onto it. */
export const NIGHT_DRIFT = 0.12

export interface NightClip {
  /** Holds the night's recording still while none of it shows, and lets it follow again after. */
  rest(resting: boolean): void
  stop(): void
}

/**
 * Makes `night`, the dark recording that lies over the hero clip until the sky turns, follow
 * `clip`: it loads when the clip first plays, then plays and pauses with it on the same moment, so
 * the window shows one moment whichever recording a part of it is drawn from. The hero clip stays
 * the one that src/scripts/clips.ts and the reader's pause start and stop. `onRefused` hears of a
 * browser that will not play the night's recording, which would otherwise stand still over a
 * playing clip.
 */
export function followClip(
  clip: HTMLVideoElement,
  night: HTMLVideoElement,
  onRefused: () => void,
): NightClip {
  let loaded = false
  let resting = false
  let refused = false

  const load = () => {
    if (loaded) return
    loaded = true
    for (const source of night.querySelectorAll<HTMLSourceElement>('source[data-src]')) {
      source.src = source.dataset['src'] ?? ''
      source.removeAttribute('data-src')
    }
    night.load()
  }
  const align = (within = 0) => {
    if (Math.abs(night.currentTime - clip.currentTime) > within)
      night.currentTime = clip.currentTime
  }
  const sync = () => {
    if (refused) return
    if (resting || clip.paused) {
      if (loaded) {
        night.pause()
        if (!resting) align()
      }
      return
    }
    load()
    align()
    if (!night.paused) return
    Promise.resolve(night.play()).catch(() => {
      if (refused) return
      refused = true
      onRefused()
    })
  }
  const follow = () => {
    if (!refused && !resting && loaded) align(NIGHT_DRIFT)
  }
  const seeked = () => {
    if (!refused && !resting && loaded) align()
  }

  clip.addEventListener('playing', sync)
  clip.addEventListener('pause', sync)
  clip.addEventListener('seeked', seeked)
  clip.addEventListener('timeupdate', follow)
  sync()

  return {
    rest(next) {
      if (next === resting) return
      resting = next
      sync()
    },
    stop() {
      clip.removeEventListener('playing', sync)
      clip.removeEventListener('pause', sync)
      clip.removeEventListener('seeked', seeked)
      clip.removeEventListener('timeupdate', follow)
      night.pause()
    },
  }
}
