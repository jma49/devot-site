import { tags } from './html.ts'

export const VIDEO_REQUIRED = ['muted', 'loop', 'playsinline', 'width', 'height']

/**
 * What is wrong with the `<video>` elements in some markup: missing attributes, `autoplay`. A
 * `data-poster`, which the page turns into a poster near the viewport, counts as a poster.
 */
export function videoProblems(markup: string): string[] {
  return tags(markup, 'video').flatMap(({ attrs }, index) => [
    ...VIDEO_REQUIRED.filter((name) => !attrs.has(name)).map(
      (name) => `video ${index + 1} lacks ${name}`,
    ),
    ...(attrs.has('poster') || attrs.has('data-poster') ? [] : [`video ${index + 1} lacks poster`]),
    ...(attrs.has('autoplay') ? [`video ${index + 1} has autoplay`] : []),
  ])
}
