import { tags } from './html.ts'

export const VIDEO_REQUIRED = ['muted', 'loop', 'playsinline', 'poster', 'width', 'height']

/** What is wrong with the `<video>` elements in some markup: missing attributes, `autoplay`. */
export function videoProblems(markup: string): string[] {
  return tags(markup, 'video').flatMap(({ attrs }, index) => [
    ...VIDEO_REQUIRED.filter((name) => !attrs.has(name)).map(
      (name) => `video ${index + 1} lacks ${name}`,
    ),
    ...(attrs.has('autoplay') ? [`video ${index + 1} has autoplay`] : []),
  ])
}
