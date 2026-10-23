import { revealOnScroll } from '../lib/motion.ts'
import { initClips } from './clips.ts'
import { initPosters } from './posters.ts'

export function startSite(): void {
  revealOnScroll()
  initPosters()
  initClips()
}
