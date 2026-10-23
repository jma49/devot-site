# devot-site

The landing page for [Devot](https://github.com/jma49/devot), local-first Markdown notes for macOS, served at https://devot.online.

A static [Astro](https://astro.build) site: plain CSS on Devot's design tokens, a few small scripts for scroll motion and clip playback, deployed by Cloudflare Pages.

## Requirements

- Node 24: the exact version is in `.node-version`, which CI and Cloudflare Pages both read.
- pnpm 12.10.1 (`packageManager` in `package.json`).

`pnpm install` also installs the git hooks (lefthook): formatting and lint on commit; on push, a block on pushes to `main`, then format check, type check and unit tests.

## Commands

| Command              | What it does                                                               |
| -------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`           | Development server                                                         |
| `pnpm build`         | Static build into `dist/`                                                  |
| `pnpm preview`       | Serves `dist/` (without the headers in `public/_headers`)                  |
| `pnpm format`        | Formats with oxfmt (`pnpm format:check` only checks)                       |
| `pnpm lint`          | oxlint                                                                     |
| `pnpm typecheck`     | `astro check`: `.astro` and `.ts` files                                    |
| `pnpm test`          | Vitest unit and policy tests                                               |
| `pnpm test:dist`     | Vitest checks of the built site; run `pnpm build` first                    |
| `pnpm test:e2e`      | Playwright smoke tests in Chromium and WebKit against `dist/`; build first |
| `pnpm tokens`        | Regenerates the files copied from Devot at the pinned commit               |
| `pnpm tokens:check`  | Fails with `E_TOKENS_STALE` when the committed copies differ from the pin  |
| `pnpm tokens:update` | Moves the pin to Devot's current `main` and regenerates                    |
| `pnpm media:capture` | Records the product clips from Devot's UI-test build and encodes them      |
| `pnpm media:encode`  | Encodes the clips again from the frames already recorded                   |
| `pnpm check`         | Everything CI runs, in order                                               |

Playwright needs its browsers once: `pnpm exec playwright install chromium webkit`.

Local runs are capped so they leave the machine usable: Vitest uses 3 workers (`SITE_TEST_WORKERS`), Playwright 2 (`SITE_UI_WORKERS`). The Playwright server listens on port 4322 (`SITE_UI_PORT`); a server already on that port fails the run unless `SITE_REUSE_SERVER=1`.

## Design tokens from Devot

The site uses Devot's design tokens and logo mark. `devot.pin.json` holds the Devot commit they come from; `scripts/tokens/` downloads these files from `raw.githubusercontent.com` at that commit:

| Devot file                          | Generated copy         |
| ----------------------------------- | ---------------------- |
| `src/renderer/src/theme/tokens.css` | `src/theme/tokens.css` |
| `design/app-icon/dove.svg`          | `src/assets/dove.svg`  |

Each copy starts with a `Generated from jma49/devot@<sha>. Do not edit.` header. To take newer tokens, run `pnpm tokens:update` and commit the pin with the regenerated files. Errors carry a code: `E_TOKENS_STALE`, `E_TOKENS_FETCH` (download failed), `E_TOKENS_PIN` (malformed pin file) or `E_TOKENS_ARGS` (unknown flag).

The build derives the square icons from the dove, at stable unhashed paths: `/favicon.svg`, `/favicon-192.png` and `/apple-touch-icon.png` (`src/pages/*.ts`).

Components use Devot's semantic tokens (`--color-text-*`, `--color-surface-*`, `--color-accent-*` and so on) or the site variables built on them in `src/styles/site-tokens.css`. A policy test refuses colour literals anywhere else in `src/`.

## The page

`src/pages/index.astro` composes five sections from `src/components/home/`, each a `section` with an id and an accessible name: `Hero` (`#hero`), `Features` (`#write`), `CardGrid` (`#cards`), `Privacy` (`#local-first`) and `ClosingCta` (`#download`). Copy lives in one namespace file per area, `src/i18n/en/chrome.ts`, `hero.ts`, `features.ts`, `cards.ts`, `privacy.ts` and `media.ts`, which `src/i18n/en.ts` spreads into the catalog; a unit test fails when two files define the same top-level key.

## Motion

`src/styles/motion.css` holds the vocabulary: three easings (`--site-ease-out`, `--site-ease-text`, `--site-ease-media`, built on Devot's motion tokens), a duration scale (`--site-dur-quick`, `-reveal`, `-media`, `-hero`) and a stagger step. `src/lib/motion.ts` mirrors the numbers for scripts, and a unit test keeps the two in step.

- `data-reveal` (optionally `scale` or `fade`, and `data-reveal-index` to fix the stagger order): `revealOnScroll` sets `data-revealed` once the element scrolls in, and the stylesheet turns that into a transition. Nothing is hidden without scripting or with reduced motion; with reduced motion every element is revealed at once.
- `data-scroll="rise"` or `"drift"`: a scroll-linked effect in browsers with scroll-driven animations (`@supports (animation-timeline: view())`); elsewhere the element simply stays in its end state.
- `src/lib/scroll.ts` wraps GSAP and ScrollTrigger for pinning and scrubbed effects that CSS cannot express. `scrollEffects(setup, { when })` runs `setup` only while reduced motion is off and the extra media query matches, and reverts everything it created when that stops being true.
- Scripts set values through the CSS object model (`element.style.setProperty`, `setVar` in `motion.ts`), which the CSP allows; `style=` attributes it does not. A policy test refuses them in `src/`.

`src/scripts/site.ts`, loaded by `Base.astro`, starts `revealOnScroll` and `initClips` for the whole page.

### GSAP

GSAP 3.15.0 is a dependency (exact version) and Astro bundles it from `node_modules`; nothing loads from a CDN. It is not MIT: it ships under GreenSock's standard "no charge" licence (https://gsap.com/standard-license), which GSAP's own site calls free for everyone, thanks to Webflow's support. Read the terms before using GSAP in another project. Import it through `src/lib/scroll.ts` so every script shares one registration.

## Product media

`src/media.ts` lists every slot: `hero`, `write`, `organise`, `find` and `card-1` to `card-6`, each with width and height in pixels (about twice the size it is shown at), loop length in seconds, the window edges the clip shows (`edges`: round and outline those, fade out the other sides), alt text (from `src/i18n/en/media.ts`), poster path and whether it is a clip or a still. The measured values come from `src/media.json`, which the capture writes. `public/media/<slot>/` holds `<slot>.mp4` (H.264), `<slot>.webm` (AV1) and `<slot>-poster.webp` (the first frame); `tests/unit/media.test.ts` checks the files against the manifest (WebP poster at the stated size under 80 KB, clip files under 700 KB each, the hero under 2 MB for both) and `tests/unit/media-files.test.ts` each MP4's size and length.

`src/components/Clip.astro` renders a slot, `<Clip name="card-1" class="…" />`: a `video` with `width`, `height`, `data-poster`, `muted loop playsinline`, `preload="none"` and `data-clip`, and its files in `source data-src`. There is no `autoplay` attribute and no `src`, so the browser requests nothing up front. Browsers fetch every `poster` as soon as it is set, so `src/scripts/posters.ts` turns `data-poster` into `poster` when the clip comes within 600 px of the viewport (with reduced motion too); `<Clip … priority />`, for the hero, sets `poster` in the markup so it is the first screen's largest paint. Without scripts a `noscript` image shows the poster. `src/scripts/clips.ts` gives the sources their `src` when a clip comes within 600 px of the viewport, plays it while any part of it is visible and the tab is shown, and pauses it otherwise; with reduced motion nothing loads or plays and the poster stays. A slot with `clip: false` renders its poster as an image instead.

### Recording the clips

The clips are the real app, recorded from Devot's UI-test build: its renderer in Playwright's WebKit with the notes kept in the page and Tauri mocked as in Devot's own UI tests. `pnpm media:capture [slot ...]` (every slot by default) does all of it:

1. Clones Devot at the commit in `devot.pin.json` into `.cache/media/devot/<sha>` (untracked; `DEVOT_GIT` names another source, such as a local checkout) and installs its dependencies, once per commit.
2. Starts the UI-test build's Vite server on port 5391 (`MEDIA_PORT`; a server already there fails the run unless `MEDIA_REUSE_SERVER=1`) and waits while the machine's one-minute load is 24 or more, for at most 15 minutes.
3. For each slot, opens a 2x WebKit page in the Tide theme (light), fills it with the demo library in `scripts/media/library.ts` through the app's own services, and plays the slot's scene from `scripts/media/scenes.ts`: a soft pointer glides, clicks and hides while typing, and the app's own transitions run on the clip's clock. Each frame is a 2x screenshot of the part of the window the slot shows, with the traffic lights the system would draw (`scripts/media/overlay.ts`); SF Symbols are drawn on this Mac (`scripts/media/symbols/render-symbol.swift`, so recording needs macOS with Xcode's command line tools).
4. Encodes the frames (`.cache/media/frames/<slot>/`) with ffmpeg: H.264 MP4 and AV1 WebM, raising the CRF until each file fits its budget, the last half second cross-fading into the first frame when a clip does not end where it starts; then writes the first frame as the WebP poster and the measured size, length and edges to `src/media.json`.

`pnpm media:encode [slot ...]` repeats step 4 from the frames already recorded. It needs ffmpeg with libx264 and libsvtav1 (`FFMPEG` names another binary). Other settings: `MEDIA_CACHE` (the cache folder), `MEDIA_FPS` (30) and `MEDIA_TZ` (the page's time zone; by default one where it is late morning, so the times in the notes look like a working day). Logs go to `.cache/media/logs/media.log`. After the app's UI changes, move the pin (`pnpm tokens:update`), record again and look at the clips before committing them.

## Security headers

`public/_headers` sets the Content-Security-Policy and the other response headers. The policy allows no inline script or style, so `astro.config.ts` turns off Astro's inlining. `pnpm test:dist` fails if the build emits inline code, and the Playwright tests serve every page under the same policy.

The policy allows media from this site only (`media-src 'self'`), for the clips. It already allows Cloudflare Web Analytics (`static.cloudflareinsights.com` for the beacon, `cloudflareinsights.com` and `/cdn-cgi/rum` for reports). Turning analytics on needs no code change.

## Deploying on Cloudflare Pages

Connect the GitHub repository; every pull request gets a preview deployment, and a merge to `main` deploys production.

| Setting                | Value        |
| ---------------------- | ------------ |
| Framework preset       | Astro        |
| Build command          | `pnpm build` |
| Build output directory | `dist`       |
| Root directory         | (empty)      |
| Production branch      | `main`       |
| Build image            | v3           |

Environment variables, in both Production and Preview:

| Variable                   | Value     | Why                                                                                                            |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `PNPM_VERSION`             | `12.10.1` | Required: the default pnpm 10.11.1 cannot switch to pnpm 12 and fails with "Failed to switch pnpm to v12.10.1" |
| `ASTRO_TELEMETRY_DISABLED` | `1`       | Optional                                                                                                       |

If the first build log does not show pnpm 12.10.1 being installed (or shows a corepack `Cannot find module ... pnpm.cjs` error), set `SKIP_DEPENDENCY_INSTALL=1` in both environments and change the build command to `npx -y pnpm@12.10.1 install --frozen-lockfile && npx -y pnpm@12.10.1 build`.

The build image reads the Node version from `.node-version`; no `NODE_VERSION` variable is needed.

The build writes a top-level `404.html`, so Pages answers unknown paths with status 404 instead of serving the home page as a single-page app.

After the first preview deployment, check the headers with `curl -I`: the page should carry the Content-Security-Policy, and files under `/_astro/` should have `Cache-Control: public, max-age=31536000, immutable`.

Zone settings that matter to this site:

- **Web Analytics:** enable it on the Pages project (Metrics); Cloudflare injects the beacon, and the policy allows it.
- **HSTS:** set by `public/_headers`. Leave the zone's own HSTS setting off so the header has one source.
- **Always Use HTTPS:** on.
- **Bot Fight Mode, JavaScript Detections, Rocket Loader and Zaraz:** off. They inject inline scripts, which the policy blocks.
- **www:** redirect `www.devot.online` to `https://devot.online` with a redirect rule and a proxied `www` DNS record; `_redirects` cannot redirect a host.
