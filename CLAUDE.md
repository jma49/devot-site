# devot-site

The landing page for Devot at https://devot.online: static Astro, plain CSS, deployed by Cloudflare Pages. Commands, token sync and deploy settings: `README.md`.

## Rules for every change

- Never push to `main`. Work on a branch and open a pull request; merge only after CI (`check`, `e2e`) passes.
- Pull request titles follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`); pull requests are squash-merged under that title.
- Work test-first. Every PR includes tests for the logic it changes.
- Node 24 (exact version in `.node-version`) and pnpm 12.10.1 (`packageManager`). Dependencies are pinned to exact versions.
- Colours come from Devot's semantic tokens (`src/theme/tokens.css`, generated: never edit it, run `pnpm tokens`) or from site variables defined once in `src/styles/site-tokens.css`. No colour literals (hex, `rgb()`, `hsl()`, named colours) anywhere else in `src/`; a policy test enforces it.
- User-facing text is English and lives in `src/i18n/en.ts`; templates take it from there, never inline it. A policy test enforces it.
- The Content-Security-Policy in `public/_headers` allows no inline script or style. Keep scripts and styles external: no `is:inline`, `define:vars`, `style=` attributes or inline event handlers. Change the policy only in `public/_headers`, in its one `/*` rule.
- Respect `prefers-reduced-motion` for any motion, and keep the visible focus ring (`--site-focus-ring`).
- Comment sparingly: only for what the code cannot say (a non-obvious reason, a constraint, a workaround with its cause). Never restate code, narrate a change or leave commented-out code.
- Repository text (docs, issues, commits, comments, code) describes Devot on its own terms. Never name other apps or websites as a source or model for Devot or this site.
- Local test runs are capped: Vitest 3 workers (`SITE_TEST_WORKERS`), Playwright 2 (`SITE_UI_WORKERS`). Raise them with those variables if you like; CI sets its own.
- Error messages carry codes (`E_TOKENS_STALE` and the like) and paths or IDs.
