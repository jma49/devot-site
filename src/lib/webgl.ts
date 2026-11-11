/**
 * Phones keep the CSS aurora: building the shader holds a phone's main thread for longer than a
 * frame, and at that size the CSS layers look the same.
 */
export const WEBGL_QUERY = '(min-width: 640px)'
