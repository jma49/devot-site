/** Seconds the day's recording may stand apart from the hero clip before it is moved onto it. */
export const STEP_DRIFT = 0.12
/** The most a seek aims ahead of the lead, in seconds, to land where the lead will be by then. */
export const STEP_LEAD = 1.5

export interface InStep {
  /** Whether the follower has shown the lead's moment, so the two can share the window. */
  ready(): boolean
  stop(): void
}

/**
 * Keeps `follower`, the light recording that comes over the hero clip as the night goes, on the
 * moment of `lead`, the hero clip, so the window shows one moment whichever recording a part of it
 * is drawn from. src/scripts/clips.ts starts and stops both as it does every clip; this only
 * moves the follower's clock: when it starts, when the lead loops, and when the two have drifted
 * apart. The lead plays on while the follower seeks, so a seek that landed behind is followed by
 * one that aims that much ahead, and none starts while another is under way. `onReady` is called
 * once, when the follower first has a frame of the lead's moment.
 */
export function keepInStep(
  lead: HTMLVideoElement,
  follower: HTMLVideoElement,
  onReady: () => void,
): InStep {
  let ready = false
  /** How far the lead moved on during the follower's last seek. */
  let lag = 0
  /** The lead's moment when the seek under way began. */
  let from: number | null = null

  const apart = () => Math.abs(follower.currentTime - lead.currentTime)
  const align = (within: number) => {
    if (follower.seeking || apart() <= within) return
    from = lead.currentTime
    follower.currentTime = lead.currentTime + lag
  }
  const check = () => {
    if (ready || follower.readyState < 2 || follower.seeking || apart() > STEP_DRIFT) return
    ready = true
    onReady()
  }
  const follow = () => {
    align(STEP_DRIFT)
    check()
  }
  const landed = () => {
    if (from !== null) lag = Math.min(STEP_LEAD, Math.max(0, lead.currentTime - from))
    from = null
    follow()
  }
  const jump = () => align(0)

  lead.addEventListener('timeupdate', follow)
  lead.addEventListener('seeked', jump)
  follower.addEventListener('loadeddata', follow)
  follower.addEventListener('playing', follow)
  follower.addEventListener('seeked', landed)
  follow()

  return {
    ready: () => ready,
    stop() {
      lead.removeEventListener('timeupdate', follow)
      lead.removeEventListener('seeked', jump)
      follower.removeEventListener('loadeddata', follow)
      follower.removeEventListener('playing', follow)
      follower.removeEventListener('seeked', landed)
    },
  }
}

export interface Mirror {
  /** Holds the follower still while it is not shown, and lets it follow again after. */
  rest(resting: boolean): void
  stop(): void
}

/**
 * Makes `follower` play while `lead` plays and rest while it rests, so a recording beside the hero
 * clip (the iPhone's) starts, pauses and stops with it: src/scripts/clips.ts and the reader's
 * pause go on deciding for the lead alone. The follower's files are asked for when the lead first
 * plays. `onRefused` hears, once, of a browser that will not play the follower.
 */
export function mirrorPlayback(
  lead: HTMLVideoElement,
  follower: HTMLVideoElement,
  onRefused: () => void = () => {},
): Mirror {
  let loaded = false
  let refused = false
  let resting = false

  const sync = () => {
    if (lead.paused || resting) {
      if (loaded) follower.pause()
      return
    }
    if (refused) return
    if (!loaded) {
      loaded = true
      for (const source of follower.querySelectorAll<HTMLSourceElement>('source[data-src]')) {
        source.src = source.dataset['src'] ?? ''
        source.removeAttribute('data-src')
      }
      follower.load()
    }
    if (!follower.paused) return
    Promise.resolve(follower.play()).catch(() => {
      if (refused) return
      refused = true
      onRefused()
    })
  }

  lead.addEventListener('playing', sync)
  lead.addEventListener('pause', sync)
  sync()

  return {
    rest(next) {
      if (next === resting) return
      resting = next
      sync()
    },
    stop() {
      lead.removeEventListener('playing', sync)
      lead.removeEventListener('pause', sync)
      follower.pause()
    },
  }
}
