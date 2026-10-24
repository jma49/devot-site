import { browserEnv, REDUCED_MOTION_QUERY } from '../lib/dom-env.ts'
import { revealOnScroll } from '../lib/motion.ts'
import { initClipControls } from './clip-controls.ts'
import { initClips } from './clips.ts'
import { browserPause, stillQuery } from './pause.ts'
import { initPosters } from './posters.ts'

export function startSite(): void {
  const env = browserEnv()
  const still = stillQuery(env.matchMedia(REDUCED_MOTION_QUERY), browserPause())
  revealOnScroll()
  initPosters()
  initClips(document, { still }, env)
  initClipControls(document, env, still)
}
