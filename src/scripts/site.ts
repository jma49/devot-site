import { revealOnScroll } from '../lib/motion.ts'
import { initClipControls } from './clip-controls.ts'
import { initClips } from './clips.ts'
import { initPosters } from './posters.ts'

export function startSite(): void {
  revealOnScroll()
  initPosters()
  initClips()
  initClipControls()
}
