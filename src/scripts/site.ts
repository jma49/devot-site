import { browserEnv } from '../lib/dom-env.ts'
import { revealOnScroll } from '../lib/motion.ts'
import { initClipControls } from './clip-controls.ts'
import { initClips } from './clips.ts'
import { browserPause, pausedQuery } from './pause.ts'
import { initPosters } from './posters.ts'

export function startSite(): void {
  const env = browserEnv()
  const still = pausedQuery(browserPause())
  revealOnScroll()
  initPosters()
  const controls = initClipControls(document, still, env)
  initClips(document, { still, onRefused: controls.offer }, env)
}
