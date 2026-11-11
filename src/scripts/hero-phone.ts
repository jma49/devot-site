export interface Mirror {
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

  const sync = () => {
    if (lead.paused) {
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
    stop() {
      lead.removeEventListener('playing', sync)
      lead.removeEventListener('pause', sync)
      follower.pause()
    },
  }
}
