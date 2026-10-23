# devot-site

The landing page for [Devot](https://github.com/jma49/devot), local-first Markdown notes for macOS, served at https://devot.online.

A static [Astro](https://astro.build) site: plain CSS on Devot's design tokens, no client-side JavaScript yet, deployed by Cloudflare Pages.

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

Components use Devot's semantic tokens (`--color-text-*`, `--color-surface-*`, `--color-accent-*` and so on) or the site variables built on them in `src/styles/site-tokens.css`. A policy test refuses colour literals anywhere else in `src/`.

## Security headers

`public/_headers` sets the Content-Security-Policy and the other response headers on Cloudflare. The policy allows no inline script or style, so `astro.config.ts` turns off Astro's stylesheet and asset inlining; `pnpm test:dist` fails if the build ever emits inline code, and the Playwright tests serve every page with the same policy, so a violation fails them.

The policy already allows Cloudflare Web Analytics (`static.cloudflareinsights.com` for the beacon, `cloudflareinsights.com` and `/cdn-cgi/rum` for reports). Turning analytics on needs no code change.

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

After the first preview deployment, check the headers with `curl -I`: the page should carry the Content-Security-Policy, and files under `/_astro/` should have `Cache-Control: public, max-age=31536000, immutable`.

Zone settings that matter to this site:

- **Web Analytics:** enable it on the Pages project (Metrics); Cloudflare injects the beacon, and the policy allows it.
- **HSTS:** set by `public/_headers`. Leave the zone's own HSTS setting off so the header has one source.
- **Always Use HTTPS:** on.
- **Bot Fight Mode, JavaScript Detections, Rocket Loader and Zaraz:** off. They inject inline scripts, which the policy blocks.
- **www:** redirect `www.devot.online` to `https://devot.online` with a redirect rule and a proxied `www` DNS record; `_redirects` cannot redirect a host.
