import { REDUCED_MOTION_QUERY } from '../lib/dom-env.ts'
import { parseGradient } from '../lib/gradient.ts'
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
/** The most frames a second drawn to keep the hero's sky with a scroll or its entrance. */
const FOLLOW_FPS = 60
/** A part of the page that keeps the dark appearance in either scheme (site-tokens.css). */
const NIGHT = "[data-scope='dark']"
/**
 * The shader draws at this share of CSS pixels, so device pixels never count: the aurora is soft,
 * and upscaling hides nothing.
 */
const RENDER_SCALE = 0.5
const MAX_RENDER_WIDTH = 1100
/** How fast the flow field moves, and how far its warp and bands reach, against their base values. */
const FLOW_PACE = 8
const FLOW_REACH = 2
/** Seconds into the flow field at which the page opens: a calm arrangement of the bands. */
const FLOW_ORIGIN = 21 / FLOW_PACE
/** With reduced motion the aurora still drifts, at this share of its pace. */
export const REDUCED_FLOW = 1 / 3
/**
 * The first frames that decide whether the GPU keeps up, and the median interval it must keep: at
 * rest, and while the page scrolls or has just scrolled. A frame the page scrolls in says how
 * heavy the page is to scroll (clips starting, sections revealing) as much as how the GPU does
 * with the shader, so those frames are held to a looser mark. They are still held to one: a
 * software GL draws on at a few frames a second through a whole scroll and takes the page with it.
 */
export const FRAME_CHECK = { frames: 60, medianMs: 20, scrollingMs: 50 } as const
/** Milliseconds after a scroll for which frames still count as scrolling ones. */
export const SCROLL_REST = 500

/**
 * The hero's sky as hero.css lays the CSS one out: it reaches past the hero's lower edge by
 * `overhang` of the hero's height, thins out into the sky behind the page over the last `fade`
 * of it, and trails the page by the pixels hero.ts writes to the hero as `trail`.
 */
export const HERO_SKY = { overhang: 0.12, fade: 0.16, trail: '--hero-sky' } as const
/**
 * The dome hero.css raises from the hero's lower edge, in the page colour: it reaches `reach` of
 * the hero's width past either side and `height` of its height up, whole out to `solid` of its
 * radius, at the opacity hero.ts writes to the hero as `shown`. It thins out with the sky under
 * the hero's fade, as one layer, so the shader draws it with the sky.
 */
export const HERO_DOME = { reach: 0.3, height: 0.46, solid: 0.58, shown: '--hero-dome' } as const
/** How far the film grain over the hero's sky swings around mid grey, to read as grain.svg does. */
const GRAIN_SPREAD = 0.38

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|lavapipe|basic render driver/i

/** The canvas size for a canvas `width` by `height` CSS pixels. */
export function renderSize(width: number, height: number): { width: number; height: number } {
  const drawn = Math.min(MAX_RENDER_WIDTH, Math.round(width * RENDER_SCALE))
  return {
    width: Math.max(1, drawn),
    height: Math.max(1, Math.round((drawn * height) / Math.max(1, width))),
  }
}

/** Where the hero lies in the window, in CSS pixels. */
export interface HeroView {
  /** Its top edge, from the top of the window. */
  top: number
  height: number
  /** How far its sky trails the page (`--hero-sky`). */
  trail: number
  /** The scale its sky stands at while it enters; 1 afterwards. */
  zoom: number
  /** The opacity of the dome over its sky (`--hero-dome`). */
  dome: number
}

/** One draw of the shader over some rows of the canvas. Lengths in canvas pixels, y downwards. */
export interface SkyPass {
  /** The rows drawn, from the first up to but not including the second. */
  rows: readonly [number, number]
  /** The box the sky is laid out in, and the row of it that lies at the canvas's top edge. */
  field: readonly [number, number]
  rise: number
  zoom: number
  /** 1 for the sky behind the page: soft bands under the veil. 0 for the hero's. */
  soft: 0 | 1
  /** The hero's top row and its height in rows, and the opacity of the dome over its sky. */
  hero: readonly [number, number]
  dome: number
  /** The rows over which the pass thins out to nothing, top to bottom; null for a whole one. */
  fade: readonly [number, number] | null
}

/**
 * What one frame draws on a canvas fixed to the window, `cssWidth` CSS pixels wide: the soft sky
 * wherever the page lies over it, always laid out in the window, so it never moves with the
 * scroll; and over that the hero's sky, laid out in the hero and moving with it, thinning out
 * across the hero's lower edge. Either is left out where none of it would show.
 */
export function skyPasses(
  canvas: { width: number; height: number },
  cssWidth: number,
  hero: HeroView | null,
): SkyPass[] {
  const { width, height } = canvas
  const page: SkyPass = {
    rows: [0, height],
    field: [width, height],
    rise: 0,
    zoom: 1,
    soft: 1,
    hero: [0, height],
    dome: 0,
    fade: null,
  }
  const scale = cssWidth > 0 ? width / cssWidth : 0
  const edge = hero ? scale * (hero.top + hero.height) : 0
  if (!hero || hero.height <= 0 || edge <= 0) return [page]
  const start = edge - scale * hero.height * HERO_SKY.fade
  const fades = start < height
  const full: SkyPass = {
    rows: [0, Math.min(height, Math.ceil(edge))],
    field: [width, scale * hero.height * (1 + HERO_SKY.overhang)],
    rise: -scale * (hero.top + hero.trail),
    zoom: hero.zoom,
    soft: 0,
    hero: [scale * hero.top, scale * hero.height],
    dome: hero.dome,
    fade: fades ? [start, edge] : null,
  }
  return fades ? [{ ...page, rows: [Math.max(0, Math.floor(start)), height] }, full] : [full]
}

/** Whether a WebGL renderer name is a CPU rasteriser, which `failIfMajorPerformanceCaveat` misses. */
export function softwareRenderer(name: string): boolean {
  return SOFTWARE_RENDERER.test(name)
}

/**
 * Whether the frame intervals (milliseconds) seen while drawing say the GPU cannot keep up; null
 * until there are enough of them.
 */
export function framesTooSlow(
  intervals: readonly number[],
  medianMs: number = FRAME_CHECK.medianMs,
): boolean | null {
  if (intervals.length < FRAME_CHECK.frames) return null
  const sorted = intervals.slice(0, FRAME_CHECK.frames).toSorted((a, b) => a - b)
  const middle = sorted.length / 2
  const median = ((sorted[Math.floor(middle - 0.5)] ?? 0) + (sorted[Math.floor(middle)] ?? 0)) / 2
  return median > medianMs
}

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
  const gradient = parseGradient(value)
  if (gradient?.stops.length !== 3) return null
  const stops = gradient.stops.map(({ colours, share }): Rgb | null => {
    const first = parseColour(colours[0])
    const second = colours[1] === undefined ? first : parseColour(colours[1])
    if (!first || !second) return null
    const mix = (at: 0 | 1 | 2) => Math.round(first[at] * share + second[at] * (1 - share))
    return [mix(0), mix(1), mix(2)]
  })
  if (stops.some((stop) => stop === null)) return null
  return { angle: gradient.angle, stops: stops as Rgb[] }
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
//
// One canvas fixed to the window draws the whole page's sky, in one pass or two (skyPasses). The
// sky is laid out in the box uField, whose row uRise lies at the top of the canvas, scaled by
// uZoom about its centre: the window for the sky behind the page, the hero's own box for the
// hero's. uSoft 1 is the sky behind the page: no tight lower edge or bright core to a band, a
// fifth of the shimmer, and the veil of the page colour (uVeil) that keeps text readable on it.
// uSoft 0 is the hero's, under its film grain (uGrain) and the dome that rises from the hero's
// lower edge (uDome: the hero's top row, its height in rows, the dome's opacity), and uFade the
// rows over which all of that thins out as one to let the page's sky through.
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
uniform float uSoft;
uniform vec2 uDir;
uniform vec2 uField;
uniform float uRise;
uniform float uZoom;
uniform vec4 uVeil;
uniform float uGrain;
uniform vec3 uDome;
uniform vec2 uFade;

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
  float w = d > 0.0 ? width * mix(0.4, 1.5, uSoft) : width * 1.7;
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

// The soft-light blend of a grey over a colour, as CSS compositing defines it.
vec3 softLight(vec3 under, float grey) {
  vec3 lifted = mix(((16.0 * under - 12.0) * under + 4.0) * under, sqrt(under), step(0.25, under));
  return grey <= 0.5
    ? under - (1.0 - 2.0 * grey) * under * (1.0 - under)
    : under + (2.0 * grey - 1.0) * (lifted - under);
}

void main() {
  vec2 view = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 at = vec2(view.x, view.y + uRise);
  vec2 px = (at - 0.5 * uField) / uZoom + 0.5 * uField;
  vec2 p = px / uField.y;
  float aspect = uField.x / uField.y;
  float t = uTime * ${FLOW_PACE.toFixed(2)};
  float reach = ${FLOW_REACH.toFixed(2)};

  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, 0.02 * t)), fbm(p * 1.2 + vec2(5.2, 1.3) - vec2(0.017 * t, 0.0)));
  float len = abs(uField.x * uDir.x) + abs(uField.y * uDir.y);
  float g = dot(px - 0.5 * uField, uDir) / len + 0.5 + (q.x - 0.5) * 1.4 * reach;
  vec3 lab = ramp(g);
  lab.x += (q.y - 0.5) * 2.0 * uGlow;

  float x = p.x - 0.5 * aspect;
  float flow = fbm(vec2(p.x * 0.8 - t * 0.012, t * 0.02)) - 0.5;
  float lineA = 0.14 - 0.14 * x + reach * (0.05 * sin(p.x * 2.6 + t * 0.05) + 0.025 * sin(p.x * 5.3 - t * 0.07 + 1.0) + flow * 0.26);
  float lineB = 0.34 - 0.07 * x + reach * (0.07 * sin(p.x * 1.9 + 2.0 - t * 0.04) - flow * 0.16);
  float lineC = 0.05 - 0.06 * x + reach * (0.035 * sin(p.x * 3.1 + 1.0 + t * 0.03) + flow * 0.1);
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

  vec2 left = (p - vec2(-0.08, 0.42 + reach * flow * 0.1)) / vec2(0.34, 0.26);
  vec2 right = (p - vec2(aspect + 0.06, 0.1 - reach * flow * 0.1)) / vec2(0.3, 0.24);
  float warmth = (exp(-dot(left, left)) + exp(-dot(right, right)) * 0.85) * (0.6 + 0.4 * q.x);
  lab = mix(lab, uWarm, min(warmth, 1.0) * uStrength.z);

  float coreA = exp(-pow((dA - 0.01) / 0.012, 2.0)) * presA;
  float coreB = exp(-pow((dB - 0.014) / 0.016, 2.0)) * presB;
  coreA += exp(-pow((dC - 0.006) / 0.008, 2.0)) * 0.4;
  float shimmer = caustic(p * vec2(5.0, 7.0), t) * (a * a + b * b * 0.8) * 0.3;
  lab.x += (shimmer * (1.0 - 0.8 * uSoft) + (coreA * 0.8 + coreB * 0.5) * rays * (1.0 - uSoft)) * uStrength.y;

  vec3 colour = toSrgb(oklabToLinear(lab));
  float grain = 0.5 + (hash(floor(at)) - 0.5) * ${GRAIN_SPREAD.toFixed(2)};
  colour = mix(colour, softLight(colour, grain), uGrain * (1.0 - uSoft));
  vec2 fromFoot = vec2(view.x / uRes.x - 0.5, (view.y - uDome.x) / uDome.y - 1.0);
  float dome = (1.0 - length(fromFoot / vec2(${(0.5 + HERO_DOME.reach).toFixed(2)}, ${HERO_DOME.height.toFixed(2)}))) / ${(1 - HERO_DOME.solid).toFixed(2)};
  colour = mix(colour, uVeil.rgb, clamp(dome, 0.0, 1.0) * uDome.z * (1.0 - uSoft));
  colour = mix(colour, uVeil.rgb, uVeil.a * uSoft);
  colour += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(colour, 1.0 - clamp((view.y - uFade.x) / (uFade.y - uFade.x), 0.0, 1.0));
}`

/** What lies over the sky: the page colour and how much of it veils the sky behind the page. */
interface Ground {
  page: Rgb
  /** 0 to 1. */
  veil: number
  /** The opacity of the film grain over the hero's sky. */
  grain: number
}

interface Renderer {
  setPalette(palette: AuroraPalette, ground: Ground): void
  draw(seconds: number, size: { width: number; height: number }, passes: readonly SkyPass[]): void
  lost(): boolean
  release(): void
}

/** The renderer's name: browsers that mask `RENDERER` give it through the debug extension. */
function rendererName(gl: WebGLRenderingContext): string {
  const plain: unknown = gl.getParameter(gl.RENDERER)
  if (typeof plain === 'string' && !/webkit webgl/i.test(plain)) return plain
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  const unmasked: unknown = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : ''
  return typeof unmasked === 'string' ? unmasked : ''
}

/**
 * Resolves once the driver has finished building `program`. Where it can build in the background
 * (KHR_parallel_shader_compile), this waits a frame at a time instead of blocking the main thread.
 */
function built(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  parallel: KHR_parallel_shader_compile | null,
): Promise<void> {
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
  if (softwareRenderer(rendererName(gl))) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }
  const shader = (type: number, source: string) => {
    const created = gl.createShader(type)
    if (!created) throw new Error('E_HERO_SHADER_CREATE')
    gl.shaderSource(created, source)
    gl.compileShader(created)
    return created
  }
  const parallel = gl.getExtension('KHR_parallel_shader_compile')
  const vertex = shader(gl.VERTEX_SHADER, VERTEX)
  const fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  await built(gl, program, parallel)
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
  // The hero's sky is drawn over the page's where the two meet, as thin as its fade leaves it.
  gl.enable(gl.SCISSOR_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
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
    veil: uniform('uVeil'),
    grain: uniform('uGrain'),
    dome: uniform('uDome'),
    field: uniform('uField'),
    rise: uniform('uRise'),
    zoom: uniform('uZoom'),
    soft: uniform('uSoft'),
    fade: uniform('uFade'),
  }

  return {
    setPalette(palette, { page, veil, grain }) {
      const radians = (palette.angle * Math.PI) / 180
      gl.uniform2f(u.dir, Math.sin(radians), -Math.cos(radians))
      gl.uniform3fv(u.sky, palette.sky.flat())
      gl.uniform3fv(u.sage, palette.sage)
      gl.uniform3fv(u.tide, palette.tide)
      gl.uniform3fv(u.fringe, palette.fringe)
      gl.uniform3fv(u.warm, palette.warm)
      gl.uniform3fv(u.strength, palette.strength)
      gl.uniform1f(u.glow, palette.glow)
      gl.uniform4f(u.veil, page[0] / 255, page[1] / 255, page[2] / 255, veil)
      gl.uniform1f(u.grain, grain)
    },
    draw(seconds, { width, height }, passes) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
      gl.uniform2f(u.res, width, height)
      gl.uniform1f(u.time, seconds)
      for (const { rows, field, rise, zoom, soft, hero, dome, fade } of passes) {
        // A whole pass fades over rows the canvas does not have.
        const [from, to] = fade ?? [height, height + 1]
        gl.scissor(0, height - rows[1], width, rows[1] - rows[0])
        gl.uniform2f(u.field, field[0], field[1])
        gl.uniform1f(u.rise, rise)
        gl.uniform1f(u.zoom, zoom)
        gl.uniform1f(u.soft, soft)
        gl.uniform3f(u.dome, hero[0], hero[1], dome)
        gl.uniform2f(u.fade, from, to)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    },
    lost: () => gl.isContextLost(),
    release: () => {
      if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

const read = (element: Element | null, name: string) =>
  element ? getComputedStyle(element).getPropertyValue(name) : ''

function readAurora(root: HTMLElement): AuroraInputs | null {
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

/** The veil sky.css lays over its CSS sky and the grain hero.css lays over the hero's. */
function readGround(stage: HTMLElement, hero: HTMLElement): Ground | null {
  const page = parseColour(read(stage, '--site-color-page'))
  const veil = Number.parseFloat(read(stage, '--sky-veil')) / 100
  const grain = Number.parseFloat(read(hero, '--hero-grain-opacity'))
  return page && Number.isFinite(veil) && Number.isFinite(grain) ? { page, veil, grain } : null
}

export interface BackdropParts {
  /**
   * The sky fixed behind the page, which holds the canvas. It carries `data-backdrop` and
   * `data-backdrop-state`.
   */
  stage: HTMLElement
  canvas: HTMLCanvasElement
  /**
   * Per appearance, the element whose computed `--backdrop` is the Tide gradient; inside it,
   * `[data-aurora-source]` elements carry Sage's and Ember's.
   */
  sources: Record<Scheme, HTMLElement>
  /**
   * The hero, which shows the same sky at full strength, and its CSS sky, whose place the
   * shader's takes. The hero carries the two attributes as well; its state is `idle` while it is
   * off screen too, which rests its CSS sky.
   */
  hero: HTMLElement
  heroSky: HTMLElement
  /** False keeps the CSS layers and only tracks whether they should move. */
  webgl?: boolean
  /** The reader's pause: while it holds, the flow stops where it is. */
  pause?: Pause
}

export interface BackdropHandle {
  /** Reads the palette again and draws a frame with it. */
  repaint(): void
  stop(): void
}

/**
 * Draws the whole page's aurora with WebGL on one canvas fixed to the window: the hero's sky
 * where the hero is, moving with it, and its soft form under the veil behind everything after
 * (`skyPasses`). It draws at up to 30 frames a second while the tab is shown, and on every frame
 * that moves the hero; with reduced motion it drifts at a third of the pace. The CSS layers show
 * until the shaders are built, without WebGL, on a software renderer and when the first frames
 * run slow. `data-backdrop` on the sky and the hero says which one shows (`webgl` or `css`) and
 * `data-backdrop-state` whether it moves (`running`, or `idle` in a hidden tab or paused, and
 * for the hero while it is off screen).
 */
export function startBackdrop({
  stage,
  canvas,
  sources,
  hero,
  heroSky,
  webgl = true,
  pause = browserPause(),
}: BackdropParts): BackdropHandle {
  const reduced = matchMedia(REDUCED_MOTION_QUERY)
  const dark = matchMedia('(prefers-color-scheme: dark)')
  let renderer: Renderer | null = null
  let stopped = false
  let heroShown = true
  let frame = 0
  let lastDraw = -1
  let lastTick = 0
  let lastScroll = window.scrollY
  let scrolledAt = Number.NEGATIVE_INFINITY
  let flow = FLOW_ORIGIN
  /** Frame intervals seen at rest so far, until the GPU has shown it keeps up. */
  let rested: number[] | null = []
  /** The same while the page scrolls, until those have shown it is not far behind. */
  let scrolling: number[] | null = []
  /** The hero's place in the page, in CSS pixels: measured when it changes, not on every frame. */
  let place = { top: 0, height: 0 }
  /** The hero's entrance, which its sky takes part in until it has run. */
  let entrance = heroSky.getAnimations()
  /** What the last draw laid out. */
  let drawn = ''
  /**
   * Whether the sky is keeping up with a scroll or the hero's entrance: while it is, a frame that
   * lays out differently is drawn at once, not at its turn among the 30 a second. Such frames go
   * on until one finds the layout unchanged, even while the flow itself is stopped, since the sky
   * must not keep the hero's strength under a section scrolled over it.
   */
  let following = true

  const show = (kind: 'webgl' | 'css') => {
    stage.dataset['backdrop'] = kind
    hero.dataset['backdrop'] = kind
  }

  const palette = () => {
    // A page that wears the night draws the dark palette whatever the reader's scheme.
    const scheme: Scheme = dark.matches || stage.closest(NIGHT) !== null ? 'dark' : 'light'
    const inputs = readAurora(sources[scheme])
    const ground = readGround(stage, hero)
    if (!inputs || !ground || !renderer) return false
    renderer.setPalette(auroraPalette(inputs, scheme), ground)
    return true
  }

  const fallBack = () => {
    const released = renderer
    renderer = null
    released?.release()
    show('css')
  }

  const measure = () => {
    const box = hero.getBoundingClientRect()
    place = { top: box.top + window.scrollY, height: box.height }
  }

  /** Where the hero stands now, and its sky and dome as hero.css would show them. */
  const heroView = (): HeroView => {
    const written = (name: string) => Number.parseFloat(hero.style.getPropertyValue(name)) || 0
    let zoom = 1
    if (entrance.some((animation) => animation.playState === 'running')) {
      zoom = Number.parseFloat(getComputedStyle(heroSky).scale) || 1
    } else {
      entrance = []
    }
    return {
      top: place.top - window.scrollY,
      height: place.height,
      trail: written(HERO_SKY.trail),
      zoom,
      dome: written(HERO_DOME.shown),
    }
  }

  const layOut = () => {
    const size = renderSize(canvas.clientWidth, canvas.clientHeight)
    const passes = skyPasses(size, canvas.clientWidth, heroView())
    return { size, passes, key: JSON.stringify([size, passes]) }
  }

  const draw = ({ size, passes, key } = layOut()) => {
    if (!renderer) return
    if (renderer.lost()) return fallBack()
    drawn = key
    renderer.draw(flow, size, passes)
  }

  const flows = () => !document.hidden && !pause.paused

  const run = () => {
    const animate = renderer !== null && (flows() || following)
    if (animate && !frame) {
      lastTick = 0
      frame = requestAnimationFrame(loop)
    } else if (!animate && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  const sync = () => {
    const moving = flows()
    stage.dataset['backdropState'] = moving ? 'running' : 'idle'
    hero.dataset['backdropState'] = moving && heroShown ? 'running' : 'idle'
    run()
  }

  const keepsUp = (interval: number, atRest: boolean) => {
    if (!rested) return true
    if (atRest) {
      rested.push(interval)
      const slow = framesTooSlow(rested)
      if (slow === null) return true
      rested = null
      return !slow
    }
    if (!scrolling) return true
    scrolling.push(interval)
    const slow = framesTooSlow(scrolling, FRAME_CHECK.scrollingMs)
    if (slow === null) return true
    scrolling = null
    return !slow
  }

  function loop(now: number) {
    frame = 0
    const moving = flows()
    if (window.scrollY !== lastScroll) scrolledAt = now
    lastScroll = window.scrollY
    if (moving && lastTick) {
      const interval = now - lastTick
      flow += (interval / 1000) * (reduced.matches ? REDUCED_FLOW : 1)
      if (!keepsUp(interval, now - scrolledAt >= SCROLL_REST)) {
        fallBack()
        return sync()
      }
    }
    lastTick = moving ? now : 0
    const next = layOut()
    const changed = next.key !== drawn
    following &&= changed || entrance.length > 0
    const due =
      following && changed ? frameDue(now, lastDraw, FOLLOW_FPS) : moving && frameDue(now, lastDraw)
    if (due) {
      lastDraw = now
      draw(next)
    }
    if (renderer && (moving || following)) frame = requestAnimationFrame(loop)
  }

  const follow = () => {
    following = true
    run()
  }

  const repaint = () => {
    palette()
    drawn = ''
    follow()
  }

  const begin = (created: Renderer | null) => {
    if (stopped) return created?.release()
    // Without a GPU the drifting CSS bands cost a core of compositing; they stay where they are.
    if (created === null) document.documentElement.dataset['auroraStill'] = ''
    renderer = created
    if (renderer && palette()) {
      measure()
      draw()
      show('webgl')
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

  // Several changes can arrive at once; the last is where the hero stands now.
  const onScreen = new IntersectionObserver((entries) => {
    heroShown = entries.at(-1)?.isIntersecting ?? true
    sync()
  })
  onScreen.observe(hero)
  // A new size is drawn at the next frame's turn, or at once while no frames are due.
  const sizes = new ResizeObserver(() => {
    measure()
    if (!flows()) follow()
  })
  sizes.observe(canvas)
  sizes.observe(hero)
  const onLost = (event: Event) => {
    event.preventDefault()
    fallBack()
    sync()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  window.addEventListener('scroll', follow, { passive: true })
  document.addEventListener('visibilitychange', sync)
  dark.addEventListener('change', repaint)
  const stopPause = pause.subscribe(sync)
  sync()

  return {
    repaint,
    stop() {
      stopped = true
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      onScreen.disconnect()
      sizes.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      window.removeEventListener('scroll', follow)
      document.removeEventListener('visibilitychange', sync)
      dark.removeEventListener('change', repaint)
      stopPause()
    },
  }
}
