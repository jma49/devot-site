import { REDUCED_MOTION_QUERY } from '../lib/dom-env.ts'

export type Rgb = readonly [number, number, number]
export type Lab = readonly [number, number, number]
export type Scheme = 'light' | 'dark'

export interface Backdrop {
  /** Degrees, as in CSS: 0 points up, 90 to the right. */
  angle: number
  stops: Rgb[]
}

export interface Look {
  /** Chroma multiplier on the token stops; the page stays close to the app's own gradient. */
  gain: number
  /** Added to OKLab lightness. */
  lift: number
  /** How far the flow's bright and deep pockets swing in OKLab lightness. */
  glow: number
}

export const BACKDROP_LOOK: Record<Scheme, Look> = {
  light: { gain: 1.15, lift: -0.03, glow: 0.05 },
  dark: { gain: 1.1, lift: 0.035, glow: 0.06 },
}

const FPS = 30
/** The shader draws at this share of CSS pixels; the gradient is soft, so upscaling hides nothing. */
const RENDER_SCALE = 0.5
const MAX_RENDER_WIDTH = 1100
/** Seconds into the flow field at which the page opens: a calm arrangement of the warps. */
const FLOW_ORIGIN = 14

const GRADIENT = /^\s*linear-gradient\(\s*(-?[\d.]+)deg\s*,/
// A stop in functional notation with spaces or commas, or in hex, which minified stylesheets carry.
const COLOUR = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)|#([\da-f]{3,8})\b/gi

function hexChannels(hex: string): Rgb | null {
  const digits = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex
  if (digits.length !== 6 && digits.length !== 8) return null
  const [r, g, b] = [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16))
  return [r ?? 0, g ?? 0, b ?? 0]
}

/** The angle and the opaque stop colours of a token gradient such as `--backdrop`. */
export function parseBackdrop(value: string): Backdrop | null {
  const gradient = GRADIENT.exec(value)
  if (!gradient) return null
  const stops = [...value.matchAll(COLOUR)].map((match) =>
    match[4]
      ? hexChannels(match[4])
      : ([Number(match[1]), Number(match[2]), Number(match[3])] as const),
  )
  if (stops.length !== 3 || stops.some((stop) => stop === null)) return null
  return { angle: Number(gradient[1]), stops: stops as Rgb[] }
}

const linear = (channel: number) => {
  const v = channel / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function srgbToOklab(rgb: Rgb): Lab {
  const [r, g, b] = rgb.map(linear) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function tuneStop(rgb: Rgb, { gain, lift }: Pick<Look, 'gain' | 'lift'>): Lab {
  const [l, a, b] = srgbToOklab(rgb)
  return [l + lift, a * gain, b * gain]
}

/** Whether a frame is due at `now` when the last was drawn at `last` (milliseconds). */
export function frameDue(now: number, last: number, fps: number = FPS): boolean {
  return last < 0 || now - last >= 1000 / fps - 2
}

const VERTEX = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

// The token's gradient line, warped by a slow flow field; stops mix in OKLab and the result is
// dithered so the soft ramp does not band.
const FRAGMENT = `precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uStops[3];
uniform float uGlow;
uniform vec2 uDir;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = turn * p;
    a *= 0.5;
  }
  return v;
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(uStops[0], uStops[1], smoothstep(0.0, 0.5, t)) : mix(uStops[1], uStops[2], smoothstep(0.5, 1.0, t));
}

vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = px / uRes.y * 1.15;
  float t = uTime;
  vec2 q = vec2(fbm(p + vec2(0.0, 0.031 * t)), fbm(p + vec2(5.2, 1.3) - vec2(0.027 * t, 0.0)));
  vec2 r = vec2(fbm(p + 2.4 * q + vec2(1.7, 9.2) + 0.019 * t), fbm(p + 2.4 * q + vec2(8.3, 2.8) - 0.023 * t));
  float len = abs(uRes.x * uDir.x) + abs(uRes.y * uDir.y);
  float g = dot(px - 0.5 * uRes, uDir) / len + 0.5;
  g += (r.x - 0.5) * 2.6 + (q.y - 0.5) * 0.8;
  vec3 lab = ramp(g);
  lab.x += (r.y - 0.5) * 2.0 * uGlow + (q.x - 0.5) * uGlow;
  vec3 colour = toSrgb(oklabToLinear(lab));
  colour += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(colour, 1.0);
}`

interface Renderer {
  setPalette(backdrop: Backdrop, look: Look): void
  draw(seconds: number): void
  lost(): boolean
}

/**
 * Resolves once the driver has finished building `program`. Where it can build in the background
 * (KHR_parallel_shader_compile), this waits a frame at a time instead of blocking the main thread.
 */
function built(gl: WebGLRenderingContext, program: WebGLProgram): Promise<void> {
  const parallel = gl.getExtension('KHR_parallel_shader_compile')
  if (!parallel) return Promise.resolve()
  return new Promise((resolve) => {
    const poll = () => {
      if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) === true) resolve()
      else requestAnimationFrame(poll)
    }
    poll()
  })
}

async function createRenderer(canvas: HTMLCanvasElement): Promise<Renderer | null> {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    // Software GL costs a frame's worth of main thread per draw; the CSS layers look the same.
    failIfMajorPerformanceCaveat: true,
  })
  if (!gl) return null
  const shader = (type: number, source: string) => {
    const created = gl.createShader(type)
    if (!created) throw new Error('E_HERO_SHADER_CREATE')
    gl.shaderSource(created, source)
    gl.compileShader(created)
    return created
  }
  const vertex = shader(gl.VERTEX_SHADER, VERTEX)
  const fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  await built(gl, program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const compiled = [vertex, fragment].every((part) =>
      gl.getShaderParameter(part, gl.COMPILE_STATUS),
    )
    throw new Error(compiled ? 'E_HERO_PROGRAM_LINK' : 'E_HERO_SHADER_COMPILE')
  }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const u = {
    res: uniform('uRes'),
    time: uniform('uTime'),
    stops: uniform('uStops'),
    glow: uniform('uGlow'),
    dir: uniform('uDir'),
  }

  const resize = () => {
    const width = Math.min(MAX_RENDER_WIDTH, Math.round(canvas.clientWidth * RENDER_SCALE))
    const height = Math.round((width * canvas.clientHeight) / Math.max(1, canvas.clientWidth))
    if (canvas.width === width && canvas.height === height) return
    canvas.width = Math.max(1, width)
    canvas.height = Math.max(1, height)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  return {
    setPalette({ angle, stops }, look) {
      const radians = (angle * Math.PI) / 180
      gl.uniform2f(u.dir, Math.sin(radians), -Math.cos(radians))
      gl.uniform3fv(
        u.stops,
        stops.flatMap((stop) => tuneStop(stop, look)),
      )
      gl.uniform1f(u.glow, look.glow)
    },
    draw(seconds) {
      resize()
      gl.uniform2f(u.res, canvas.width, canvas.height)
      gl.uniform1f(u.time, seconds)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    lost: () => gl.isContextLost(),
  }
}

export interface BackdropParts {
  hero: HTMLElement
  canvas: HTMLCanvasElement
  /** Elements whose computed `--backdrop` is the Tide gradient in each appearance. */
  sources: Record<Scheme, HTMLElement>
  /** False keeps the CSS layers and only tracks whether they should move. */
  webgl?: boolean
}

/**
 * Draws the hero's gradient with WebGL at up to 30 frames a second while the hero is on screen
 * and the tab is shown, once its shaders are built; with reduced motion it draws one still frame.
 * Until then, and without WebGL, the CSS layers underneath show. `data-backdrop` on the hero says
 * which one shows (`webgl` or `css`) and `data-backdrop-state` whether it moves (`running`,
 * `idle` or `still`).
 */
export function startBackdrop({ hero, canvas, sources, webgl = true }: BackdropParts): () => void {
  const reduced = matchMedia(REDUCED_MOTION_QUERY)
  const dark = matchMedia('(prefers-color-scheme: dark)')
  let renderer: Renderer | null = null
  let stopped = false
  let visible = true
  let frame = 0
  let lastDraw = -1
  let lastTick = 0
  let flow = FLOW_ORIGIN

  const palette = () => {
    const scheme: Scheme = dark.matches ? 'dark' : 'light'
    const backdrop = parseBackdrop(getComputedStyle(sources[scheme]).getPropertyValue('--backdrop'))
    if (!backdrop || !renderer) return false
    renderer.setPalette(backdrop, BACKDROP_LOOK[scheme])
    return true
  }

  const fallBack = () => {
    renderer = null
    hero.dataset['backdrop'] = 'css'
  }

  const draw = () => {
    if (!renderer) return
    if (renderer.lost()) return fallBack()
    renderer.draw(flow)
  }

  const loop = (now: number) => {
    frame = 0
    if (lastTick) flow += (now - lastTick) / 1000
    lastTick = now
    if (frameDue(now, lastDraw)) {
      lastDraw = now
      draw()
    }
    frame = requestAnimationFrame(loop)
  }

  const sync = () => {
    const state = reduced.matches ? 'still' : visible && !document.hidden ? 'running' : 'idle'
    hero.dataset['backdropState'] = state
    const animate = state === 'running' && renderer !== null
    if (animate && !frame) {
      lastTick = 0
      frame = requestAnimationFrame(loop)
    } else if (!animate && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (state === 'still') {
      flow = FLOW_ORIGIN
      draw()
    }
  }

  const repaint = () => {
    palette()
    if (!frame) draw()
  }

  const begin = (created: Renderer | null) => {
    if (stopped) return
    renderer = created
    if (renderer && palette()) {
      draw()
      hero.dataset['backdrop'] = 'webgl'
    } else {
      fallBack()
    }
    sync()
  }
  if (webgl) {
    createRenderer(canvas).then(begin, (error: unknown) => {
      console.warn('W_HERO_WEBGL', error instanceof Error ? error.message : 'unknown')
      begin(null)
    })
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    sync()
  })
  observer.observe(hero)
  const resize = new ResizeObserver(() => {
    if (!frame) draw()
  })
  resize.observe(canvas)
  const onLost = (event: Event) => {
    event.preventDefault()
    fallBack()
    sync()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  document.addEventListener('visibilitychange', sync)
  reduced.addEventListener('change', sync)
  dark.addEventListener('change', repaint)
  sync()

  return () => {
    stopped = true
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    observer.disconnect()
    resize.disconnect()
    canvas.removeEventListener('webglcontextlost', onLost)
    document.removeEventListener('visibilitychange', sync)
    reduced.removeEventListener('change', sync)
    dark.removeEventListener('change', repaint)
  }
}
