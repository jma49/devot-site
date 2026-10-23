import { REDUCED_MOTION_QUERY } from '../lib/dom-env.ts'
import { browserPause, type Pause } from './pause.ts'

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
  light: { gain: 1.15, lift: 0.04, glow: 0.03 },
  dark: { gain: 1.1, lift: -0.06, glow: 0.035 },
}

/** The token colours the aurora is mixed from, read from the page in one appearance. */
export interface AuroraInputs {
  tide: Backdrop
  sage: Backdrop
  ember: Backdrop
  /** Devot's teal (`--color-activity-level-4`). */
  teal: Rgb
  /** Devot's accent blue (`--color-accent-fill`). */
  blue: Rgb
  /** Devot's orange tag colour (`--color-tag-icon-orange`), which warms Ember's peach. */
  amber: Rgb
}

/**
 * How a band is mixed: a backdrop stop pulled `toward` a pigment token, then set to `lightness`
 * in OKLab with its chroma scaled by `gain` (at most the backdrop's own boost).
 */
interface BandRecipe {
  toward: number
  lightness: number
}

export interface AuroraRecipe {
  /** Scales the chroma of Tide's stops in the sky, so the bands stand out against it. */
  sky: number
  sage: BandRecipe
  tide: BandRecipe
  /** Lightness of the Ember violet that fringes the bands and the Ember peach at the edges. */
  fringe: number
  warm: BandRecipe
  /** Band opacity, caustic shimmer (OKLab lightness), and the Ember edge glow's opacity. */
  bands: number
  shimmer: number
  edges: number
}

/** Light bands stay pale so dark text keeps AA on them; dark bands stay deep under light text. */
export const AURORA_RECIPE: Record<Scheme, AuroraRecipe> = {
  light: {
    sky: 0.75,
    sage: { toward: 0.6, lightness: 0.82 },
    tide: { toward: 0.55, lightness: 0.81 },
    fringe: 0.87,
    warm: { toward: 0.22, lightness: 0.88 },
    bands: 1,
    shimmer: 0.08,
    edges: 0.75,
  },
  dark: {
    sky: 1,
    sage: { toward: 0.6, lightness: 0.47 },
    tide: { toward: 0.55, lightness: 0.4 },
    fringe: 0.32,
    warm: { toward: 0.5, lightness: 0.4 },
    bands: 1,
    shimmer: 0.08,
    edges: 0.42,
  },
}

export interface AuroraPalette {
  angle: number
  sky: Lab[]
  sage: Lab
  tide: Lab
  fringe: Lab
  warm: Lab
  strength: readonly [number, number, number]
  glow: number
}

const mixLab = (from: Lab, to: Lab, amount: number): Lab =>
  [0, 1, 2].map((i) => (from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * amount) as unknown as Lab

const withLightness = ([, a, b]: Lab, lightness: number, gain: number): Lab => [
  lightness,
  a * gain,
  b * gain,
]

/** The shader's colours: Tide's gradient for the sky, Sage and Tide bands, Ember at the edges. */
export function auroraPalette(inputs: AuroraInputs, scheme: Scheme): AuroraPalette {
  const look = BACKDROP_LOOK[scheme]
  const recipe = AURORA_RECIPE[scheme]
  const band = (stop: Rgb, pigment: Rgb, { toward, lightness }: BandRecipe) =>
    withLightness(mixLab(srgbToOklab(stop), srgbToOklab(pigment), toward), lightness, look.gain)
  const [sageStop] = inputs.sage.stops
  const [tideStop] = inputs.tide.stops
  const [violet, , peach] = inputs.ember.stops
  return {
    angle: inputs.tide.angle,
    sky: inputs.tide.stops.map((stop) =>
      tuneStop(stop, { gain: look.gain * recipe.sky, lift: look.lift }),
    ),
    sage: band(sageStop ?? inputs.teal, inputs.teal, recipe.sage),
    tide: band(tideStop ?? inputs.blue, inputs.blue, recipe.tide),
    fringe: withLightness(srgbToOklab(violet ?? inputs.blue), recipe.fringe, look.gain),
    warm: band(peach ?? inputs.amber, inputs.amber, recipe.warm),
    strength: [recipe.bands, recipe.shimmer, recipe.edges],
    glow: look.glow,
  }
}

const FPS = 30
/** The shader draws at this share of CSS pixels; the gradient is soft, so upscaling hides nothing. */
const RENDER_SCALE = 0.5
const MAX_RENDER_WIDTH = 1100
/** Seconds into the flow field at which the page opens: a calm arrangement of the bands. */
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

const channels = (match: RegExpMatchArray): Rgb | null =>
  match[4]
    ? hexChannels(match[4])
    : ([Number(match[1]), Number(match[2]), Number(match[3])] as const)

/** The angle and the opaque stop colours of a token gradient such as `--backdrop`. */
export function parseBackdrop(value: string): Backdrop | null {
  const gradient = GRADIENT.exec(value)
  if (!gradient) return null
  const stops = [...value.matchAll(COLOUR)].map(channels)
  if (stops.length !== 3 || stops.some((stop) => stop === null)) return null
  return { angle: Number(gradient[1]), stops: stops as Rgb[] }
}

/** The opaque channels of a single token colour, in hex or functional notation. */
export function parseColour(value: string): Rgb | null {
  const matches = [...value.matchAll(COLOUR)]
  return matches.length === 1 && matches[0] ? channels(matches[0]) : null
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

// Tide's gradient line under a slow warp is the sky. Two aurora bands, Sage and Tide, hang across
// it: a bright lower edge, a long glow above fringed with Ember violet, faint curtain rays, and
// a caustic shimmer where they are brightest. Ember peach warms the side edges. Colours mix in
// OKLab and the result is dithered so the soft ramps do not band.
const FRAGMENT = `precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uSky[3];
uniform vec3 uSage;
uniform vec3 uTide;
uniform vec3 uFringe;
uniform vec3 uWarm;
uniform vec3 uStrength;
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
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = turn * p;
    a *= 0.5;
  }
  return v / 0.875;
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(uSky[0], uSky[1], smoothstep(0.0, 0.5, t)) : mix(uSky[1], uSky[2], smoothstep(0.5, 1.0, t));
}

// A band's profile across its centre line: tight below, a long glow above (screen y grows down).
float band(float d, float width) {
  float w = d > 0.0 ? width * 0.4 : width * 1.7;
  return exp(-d * d / (w * w));
}

// Thin bright filaments where two warped ridged noises cross, drifting slowly.
float caustic(vec2 p, float t) {
  vec2 w = vec2(noise(p * 1.1 + vec2(0.0, t * 0.05)), noise(p * 1.1 + vec2(7.1, -t * 0.04)));
  float a = noise(p * 2.6 + w * 2.2 + vec2(t * 0.035, 0.0));
  float b = noise(p * 3.1 - w * 1.8 + vec2(3.7, t * 0.03));
  a = 1.0 - abs(a * 2.0 - 1.0);
  b = 1.0 - abs(b * 2.0 - 1.0);
  return pow(a, 6.0) + pow(b, 6.0) * 0.7;
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
  vec2 uv = px / uRes;
  vec2 p = px / uRes.y;
  float aspect = uRes.x / uRes.y;
  float t = uTime * 1.5;

  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, 0.02 * t)), fbm(p * 1.2 + vec2(5.2, 1.3) - vec2(0.017 * t, 0.0)));
  float len = abs(uRes.x * uDir.x) + abs(uRes.y * uDir.y);
  float g = dot(px - 0.5 * uRes, uDir) / len + 0.5 + (q.x - 0.5) * 1.4;
  vec3 lab = ramp(g);
  lab.x += (q.y - 0.5) * 2.0 * uGlow;

  float x = p.x - 0.5 * aspect;
  float flow = fbm(vec2(p.x * 0.8 - t * 0.012, t * 0.02)) - 0.5;
  float lineA = 0.14 - 0.14 * x + 0.05 * sin(p.x * 2.6 + t * 0.05) + 0.025 * sin(p.x * 5.3 - t * 0.07 + 1.0) + flow * 0.26;
  float lineB = 0.34 - 0.07 * x + 0.07 * sin(p.x * 1.9 + 2.0 - t * 0.04) - flow * 0.16;
  float lineC = 0.05 - 0.06 * x + 0.035 * sin(p.x * 3.1 + 1.0 + t * 0.03) + flow * 0.1;
  float presA = 0.7 + 0.3 * smoothstep(0.25, 0.65, fbm(vec2(p.x * 1.4 + t * 0.016, 3.0)));
  float presB = 0.75 + 0.25 * smoothstep(0.2, 0.6, fbm(vec2(p.x * 1.1 - t * 0.013, 7.0)));
  float rays = noise(vec2(p.x * 22.0 + q.y * 6.0 + t * 0.04, t * 0.03));
  rays = 0.55 + 0.45 * rays * rays;
  float dA = p.y - lineA;
  float dB = p.y - lineB;
  float dC = p.y - lineC;
  float a = band(dA, 0.09) * presA * mix(1.0, rays, smoothstep(0.02, -0.14, dA));
  float b = band(dB, 0.1) * presB * mix(1.0, rays, 0.6 * smoothstep(0.02, -0.14, dB));
  float c = band(dC, 0.05) * (1.0 - presA * 0.5) * mix(1.0, rays, 0.7);
  float fringe = band(dA + 0.17, 0.11) * presA * 0.4 + band(dB + 0.2, 0.13) * presB * 0.3;
  vec3 sageTide = mix(uSage, uTide, 0.35 * smoothstep(0.3, 0.7, fbm(vec2(p.x * 0.9 - t * 0.01, 11.0))));

  lab = mix(lab, uFringe, fringe * uStrength.x);
  lab = mix(lab, mix(uTide, uFringe, 0.35), c * 0.6 * uStrength.x);
  lab = mix(lab, uTide, b * uStrength.x);
  lab = mix(lab, sageTide, a * uStrength.x);

  vec2 left = (p - vec2(-0.08, 0.42 + flow * 0.1)) / vec2(0.34, 0.26);
  vec2 right = (p - vec2(aspect + 0.06, 0.1 - flow * 0.1)) / vec2(0.3, 0.24);
  float warmth = (exp(-dot(left, left)) + exp(-dot(right, right)) * 0.85) * (0.6 + 0.4 * q.x);
  lab = mix(lab, uWarm, min(warmth, 1.0) * uStrength.z);

  float coreA = exp(-pow((dA - 0.01) / 0.012, 2.0)) * presA;
  float coreB = exp(-pow((dB - 0.014) / 0.016, 2.0)) * presB;
  coreA += exp(-pow((dC - 0.006) / 0.008, 2.0)) * 0.4;
  float shimmer = caustic(p * vec2(5.0, 7.0), t) * (a * a + b * b * 0.8) * 0.3;
  lab.x += (shimmer + (coreA * 0.8 + coreB * 0.5) * rays) * uStrength.y;

  vec3 colour = toSrgb(oklabToLinear(lab));
  colour += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(colour, 1.0);
}`

interface Renderer {
  setPalette(palette: AuroraPalette): void
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
    sky: uniform('uSky'),
    sage: uniform('uSage'),
    tide: uniform('uTide'),
    fringe: uniform('uFringe'),
    warm: uniform('uWarm'),
    strength: uniform('uStrength'),
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
    setPalette(palette) {
      const radians = (palette.angle * Math.PI) / 180
      gl.uniform2f(u.dir, Math.sin(radians), -Math.cos(radians))
      gl.uniform3fv(u.sky, palette.sky.flat())
      gl.uniform3fv(u.sage, palette.sage)
      gl.uniform3fv(u.tide, palette.tide)
      gl.uniform3fv(u.fringe, palette.fringe)
      gl.uniform3fv(u.warm, palette.warm)
      gl.uniform3fv(u.strength, palette.strength)
      gl.uniform1f(u.glow, palette.glow)
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

function readAurora(root: HTMLElement): AuroraInputs | null {
  const read = (element: Element | null, name: string) =>
    element ? getComputedStyle(element).getPropertyValue(name) : ''
  const theme = (name: string) =>
    parseBackdrop(read(root.querySelector(`[data-aurora-source="${name}"]`), '--backdrop'))
  const tide = parseBackdrop(read(root, '--backdrop'))
  const sage = theme('sage')
  const ember = theme('ember')
  const teal = parseColour(read(root, '--color-activity-level-4'))
  const blue = parseColour(read(root, '--color-accent-fill'))
  const amber = parseColour(read(root, '--color-tag-icon-orange'))
  return tide && sage && ember && teal && blue && amber
    ? { tide, sage, ember, teal, blue, amber }
    : null
}

export interface BackdropParts {
  hero: HTMLElement
  canvas: HTMLCanvasElement
  /**
   * Per appearance, the element whose computed `--backdrop` is the Tide gradient; inside it,
   * `[data-aurora-source]` elements carry Sage's and Ember's.
   */
  sources: Record<Scheme, HTMLElement>
  /** False keeps the CSS layers and only tracks whether they should move. */
  webgl?: boolean
  /** The reader's pause: while it holds, the flow stops where it is. */
  pause?: Pause
}

/**
 * Draws the hero's gradient with WebGL at up to 30 frames a second while the hero is on screen
 * and the tab is shown, once its shaders are built; with reduced motion it draws one still frame.
 * Until then, and without WebGL, the CSS layers underneath show. `data-backdrop` on the hero says
 * which one shows (`webgl` or `css`) and `data-backdrop-state` whether it moves (`running`;
 * `idle` while off screen, in a hidden tab or paused; `still` with reduced motion).
 */
export function startBackdrop({
  hero,
  canvas,
  sources,
  webgl = true,
  pause = browserPause(),
}: BackdropParts): () => void {
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
    const inputs = readAurora(sources[scheme])
    if (!inputs || !renderer) return false
    renderer.setPalette(auroraPalette(inputs, scheme))
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
    const moving = visible && !document.hidden && !pause.paused
    const state = reduced.matches ? 'still' : moving ? 'running' : 'idle'
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
  const stopPause = pause.subscribe(sync)
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
    stopPause()
  }
}
