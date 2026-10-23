import { revealOnScroll } from '../lib/motion.ts'
import { initClips } from './clips.ts'

export function startSite(): void {
  revealOnScroll()
  initClips()
}
