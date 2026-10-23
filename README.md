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
| `pnpm facts`         | Checks the page's claims about Devot against Devot's own files             |
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

The build derives the square icons from the dove, at stable unhashed paths: `/favicon.svg`, `/favicon-192.png` and `/apple-touch-icon.png` (`src/pages/*.ts`). It also renders the link-preview image, `/og.png` (1200x630, `src/lib/og-image.ts`): the hero poster's app window on the Tide gradient with the dove above it, every colour from the tokens. `Base.astro` announces it with its size and description to Open Graph and as a large Twitter card; `pnpm test:dist` fails when a tag or the file is missing.

Components use Devot's semantic tokens (`--color-text-*`, `--color-surface-*`, `--color-accent-*` and so on) or the site variables built on them in `src/styles/site-tokens.css`. A policy test refuses colour literals anywhere else in `src/`.

## Facts check

Every claim the page makes about Devot that Devot's own files can settle is checked by `pnpm facts` (`scripts/facts/`):

- each shortcut a card shows is its command's default in `src/renderer/src/commands/registry.ts`, drawn and spoken the same way;
- each search operator the Find feature names is a qualifier in `src/core/search.ts`, and a minus still excludes;
- the statuses, the gradient themes (names, count, light and dark), the app names on the cards and the "Linked to this note" label match Devot's catalog and tokens;
- the template placeholders, the update timing (`src-tauri/src/updates.rs`), the MIT licence and its holder, macOS 26+ (`tauri.conf.json`) and Apple Silicon only (the release workflow's `Devot_<version>_aarch64.dmg`);
- the Revision History card's pause and retention (every version for a day, then hourly for a week, then daily) are those of `src/core/revisions.ts`, which keeps versions on this Mac;
- the README still says builds are ad hoc signed and not notarised, so macOS asks once, and to right-click Devot and choose Open the first time (the note under both download buttons); the mirror folder is never read back; devot-mcp runs from a checkout;
- every link to a section of Devot's README (the install steps, devot-mcp, contributing) names a heading the README has.

It reads the checkout `DEVOT_CHECKOUT` names; without it, the pinned commit in `devot.pin.json`, from the clone `pnpm media:capture` keeps in `.cache/media` (or `MEDIA_CACHE`) when there is one, else from `raw.githubusercontent.com`. Each problem is one line starting with its code (`E_FACT_SHORTCUT`, `E_FACT_OPERATOR`, `E_FACT_STATUS`, `E_FACT_THEME`, `E_FACT_LABEL`, `E_FACT_LINKS`, `E_FACT_PLACEHOLDER`, `E_FACT_UPDATES`, `E_FACT_LICENCE`, `E_FACT_PLATFORM`, `E_FACT_RELEASE`, `E_FACT_SIGNING`, `E_FACT_MIRROR`, `E_FACT_MCP`, `E_FACT_REVISIONS`, `E_FACT_ANCHOR`); `E_FACT_STALE` means the page no longer says what a check expects, so the check needs updating with the copy; `E_FACT_SOURCE`, `E_FACT_PIN` and `E_FACT_FETCH` mean Devot's files could not be read. A download that fails in a way that may pass (no connection, a 15-second timeout, HTTP 408, 429 or 5xx) is tried four times, 1, 2 and 4 seconds apart. A file still missing after that does not fail the run: the checks that read it are skipped and named in one `W_FACT_UNREACHABLE` warning (an annotation on the run in GitHub Actions), while every check whose files arrived still runs and fails on a mismatch. Any other failure, such as a file the pinned commit lacks (HTTP 404), is `E_FACT_FETCH`. `tests/unit/facts.test.ts` runs the same checks on a cut-down Devot. `pnpm check` and CI's `check` job run `pnpm facts` against the pin; run it yourself after changing copy and after moving the pin.

## The page

`src/pages/index.astro` composes five sections from `src/components/home/`, each a `section` with an id and an accessible name: `Hero` (`#hero`), `Features` (`#write`), `CardGrid` (`#cards`), `Privacy` (`#local-first`) and `ClosingCta` (`#download`). Copy lives in one namespace file per area, `src/i18n/en/chrome.ts`, `hero.ts`, `features.ts`, `cards.ts`, `demo.ts`, `privacy.ts` and `media.ts`, which `src/i18n/en.ts` spreads into the catalog; a unit test fails when a file is left out or two files define the same top-level key.

## Motion

`src/styles/motion.css` holds the vocabulary: three easings (`--site-ease-out`, `--site-ease-text`, `--site-ease-media`, built on Devot's motion tokens), a duration scale (`--site-dur-quick`, `-reveal`, `-media`, `-hero`) and a stagger step. `src/lib/motion.ts` mirrors the numbers for scripts, and a unit test keeps the two in step.

- `data-reveal` (optionally `scale` or `fade`, and `data-reveal-index` to fix the stagger order): `revealOnScroll` sets `data-revealed` once the element scrolls in, and the stylesheet turns that into a transition. Nothing is hidden without scripting or with reduced motion; with reduced motion every element is revealed at once.
- `data-scroll="rise"` or `"drift"`: a scroll-linked effect in browsers with scroll-driven animations (`@supports (animation-timeline: view())`); elsewhere the element simply stays in its end state.
- `src/lib/scroll.ts` holds the scripted scroll effects CSS cannot express. `scrubScroll(apply, { lag })` calls `apply` with the scroll position, eased so it trails the scroll by `lag` seconds and lands on it exactly, once a frame and only while it moves. `scrollEffects(setup, { when })` runs `setup` only while reduced motion is off and the extra media query matches, and calls the function `setup` returns when that stops being true.
- Scripts set values through the CSS object model (`element.style.setProperty`, `setVar` in `motion.ts`), which the CSP allows; `style=` attributes it does not. A policy test refuses them in `src/`.

`src/scripts/site.ts`, loaded by `Base.astro`, starts `revealOnScroll`, `initPosters`, `initClips` and `initClipControls` (a play button on each clip while the clips hold still) for the whole page. `startSite` builds one "still" query, which matches while reduced motion is on or the reader has paused animations, and passes it to `initClips` and `initClipControls`.

The header's "Pause animations" toggle (`aria-pressed`; one button per layout, kept in step) stops every clip on its frame and the hero backdrop, WebGL or CSS. `src/scripts/pause.ts` keeps the choice in `localStorage` (`devot-site:pause-animations`) and sets `data-animations-paused` on the root element while it holds; each script's copy of the state hears the others' changes through a document event. With reduced motion the toggle is hidden, since nothing moves on its own. The download pill (`src/scripts/header.ts`) shows between the hero's download button and the closing section; at 800 px and wider it rests in the bottom-right corner and steps aside while it would cover 5 % or more of the visible part of any clip, and phones keep it as a bar along the bottom.

Playwright specs wait for a settled state, never for a fixed time: `tests/support/settle.ts` has `frames` (a number of animation frames), `steady` (a value unchanged over several frames, for eased and scrubbed effects), `animationsDone` (no finite animation or transition running), `scrollToY` and `placeEdge` (scroll, then wait for the scroll to land).

### Script weight

The page ships about 12 KB of script, gzipped. The hero's own script is 2 KB; its WebGL backdrop (`src/scripts/hero-backdrop.ts`, 3 KB) is a chunk of its own that loads once the page has loaded and painted, so the CSS gradient under it is the first thing drawn and the canvas fades in over it. Phones (under 640 px) keep the CSS gradient. `src/scripts/pause.ts`, the pause state that the site, header and backdrop scripts share, is a chunk of its own, under 1 KB. `tests/built/script-weight.test.ts` holds the hero's first load to 25 KB and all scripts to 35 KB, gzipped.

## Product media

`src/media.ts` lists every slot: `hero`, `write`, `organise`, `find` and `card-1` to `card-6`. The measured values come from `src/media.json`, which the capture writes: width and height in pixels (twice the window points the clip shows), `points` (the window points across the clip, so a clip shown `w` px wide draws the app at `w / points` px per point), `minText` (the smallest text in the clip, in points; captions set in capitals are left out), loop length, `posterTime` (the frame the poster shows), the window edges the clip shows (`edges`: round and outline those, fade out the other sides), the closer `phone` cut where a slot has one, and the bytes of every file. Each slot has variants, most specific first: phone dark, phone light, dark, light. `public/media/<slot>/` holds each variant's `<slot>[-phone][-dark].webm` (AV1), `.mp4` (H.264) and `-poster.webp`; the light desktop files keep the plain names. `tests/unit/media.test.ts` checks the files against the manifest (posters at their sizes under 80 KB, 50 KB on phones; clip files under 700 KB each; the hero under 2 MB per scheme and its phone files at most 400 KB), `tests/unit/media-files.test.ts` each MP4's size and length, and `tests/unit/media-scenes.test.ts` the cuts (wide cards about half the window width, at most 52 %, narrow cards at most 45 %; a wide card's phone cut has the narrow cards' 4:5 shape, and a feature's phone cut is small enough to show whole).

`src/components/Clip.astro` renders a slot, `<Clip name="card-1" class="…" />`: a `video` with `width`, `height`, `muted loop playsinline`, `preload="none"` and `data-clip`, its files in `source data-src` with a `media` query per variant, AV1 before H.264. There is no `autoplay`, `src` or `poster` in the markup, so the browser requests nothing up front, and when it does it takes only the files for the reader's colour scheme and width. `src/scripts/posters.ts` sets the poster from `data-poster` and `data-poster-media` when the clip comes within 600 px of the viewport (with reduced motion too), and follows a change of scheme. `<Clip … priority />`, for the hero, takes its poster from `Clip.astro`'s stylesheet with a preload per variant, so the first screen's largest paint is the right file. Without scripts a `noscript` picture shows the poster. `src/scripts/clips.ts` gives the sources their `src` when a clip comes within 600 px of the viewport, plays it while any part of it is visible and the tab is shown, pauses it otherwise, and loads it again when the scheme or width changes; with reduced motion, or while animations are paused, nothing loads or plays: a playing clip stops on its frame and the others keep their posters. A slot with `clip: false` renders its poster as an image instead.

### Recording the clips

The clips are the real app, recorded from Devot's UI-test build: its renderer in Playwright's WebKit with the notes kept in the page and Tauri mocked as in Devot's own UI tests. `pnpm media:capture [slot ...]` (every slot by default) does all of it:

1. Clones Devot at the commit in `devot.pin.json` into `.cache/media/devot/<sha>` (untracked; `DEVOT_GIT` names another source, such as a local checkout) and installs its dependencies, once per commit.
2. Starts the UI-test build's Vite server on port 5391 (`MEDIA_PORT`; a server already there fails the run unless `MEDIA_REUSE_SERVER=1`) and waits while the machine's one-minute load is 24 or more, for at most 15 minutes.
3. For each slot and each colour scheme, opens a 2x WebKit page in the Tide theme, fills it with the demo library in `scripts/media/library.ts` through the app's own services, and plays the slot's scene from `scripts/media/scenes.ts`: a soft pointer glides, clicks and hides while typing, and the app's own transitions run on the clip's clock. Each frame is a 2x screenshot of the part of the window the slot shows, together with its phone cut where that reaches past it, with the traffic lights the system would draw (`scripts/media/overlay.ts`); SF Symbols are drawn on this Mac (`scripts/media/symbols/render-symbol.swift`, so recording needs macOS with Xcode's command line tools). The run also measures the smallest text in each cut.
4. Encodes the frames (`.cache/media/frames/<slot>/<scheme>/`) with ffmpeg: AV1 WebM and H.264 MP4 for the clip and for its phone cut, raising the CRF until each file fits its budget, the last half second cross-fading into the first frame when a clip does not end where it starts; then writes the frame at the scene's poster time as each WebP poster, and the measurements and file sizes to `src/media.json`.

From an empty cache (2026-10-23, Devot at 8923fee): cloning and installing Devot took under a minute here, recording all ten slots in both schemes about 13 minutes and encoding about 6, and `.cache/media` grew to about 3.5 GB, 2.8 GB of it frames. The run reproduced the committed media: the same measurements in `src/media.json`, posters within half a level of 255 on average, and clips with the same frames apart from an app transition a frame earlier or later.

`pnpm media:encode [slot ...]` repeats step 4 from the frames already recorded. It needs ffmpeg with libx264 and libsvtav1 (`FFMPEG` names another binary). Other settings: `MEDIA_SCHEMES` (`light`, `dark` or both, the default), `MEDIA_SAMPLE` (write every n-th frame to a folder of its own and encode nothing, to look at a scene while working on it), `MEDIA_CACHE` (the cache folder), `MEDIA_FPS` (30) and `MEDIA_TZ` (the page's time zone; by default one where it is late morning, so the times in the notes look like a working day). Logs go to `.cache/media/logs/media.log`. After the app's UI changes, move the pin (`pnpm tokens:update`), record again and look at the clips before committing them.

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
