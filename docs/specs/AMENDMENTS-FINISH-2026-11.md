Status: ready; rows FN-0 to FN-7 open

# Amendment: owner decisions of 2026-11-18 and the remaining code work

> **Owner decisions of 2026-11-18 (in chat, translated):**
> - "Longer join codes and owner approval for a caregiver join: no, it is already enough."
> - "Adult proof for the PIN reset: add it."
> - "Online backup, a consent record on the server, the level ids: keep the defaults."
> - "The first visit's offline download: the full download."
> - "The iOS App Store listing: later."
> - "Finish the remaining code work to the end. CI runs when development is done: I make the repository public for a moment and run it; tell me when it is ready."
>
> Follows `AMENDMENTS-AUDIT-2026-11.md` ("Not in this amendment") and `AMENDMENTS-FOLLOWUPS-2026-11.md` (FU-4, and its "Not in this amendment"). The findings F4 to F10 are in `docs/launch/performance-review-2026-11.md`. Every change is marked **[FN]** where it lands.

**Standing rules that apply here**

- CLAUDE.md as written: spec before code, wireframe before mock before component, tokens only, UI strings through `packages/i18n` in en, es and ko (es and ko are shipped, so every new key needs all three), one commit per intent with its test, anti-shame rules.
- A budget line moves only to a measured number, recorded where the line lives. The start bundle line goes down when the start bundle does.
- CI does not run while the repository is private and out of Actions minutes. Each row is verified locally (typecheck, lint, the unit suites it touches, the full mobile suite once at the end, the e2e specs it touches against a local release build) and the results are recorded in As built. The full CI run happens once, when the owner opens the repository for it.

## Decisions recorded (no code)

**FN-0 Decisions that keep what is built.**
(a) Join codes and caregiver joins stay as they are (audit SEC-1 closed by the owner). (b) Online backup stays as built, no consent record goes to the server, and the level ids stay opaque (audit PRIV-1, PRIV-2; F-LEARN-001 decisions L1 and L2 unchanged). (c) The first visit keeps downloading the whole offline set: the precache and both other UI locales (finding F8 closed by the owner; the extra packs behind Save for offline stay opt-in). (d) The iOS App Store submission (T-040 to T-044) waits. (e) The counsel packet (`docs/legal/counsel-packet-2026-10.md`) has no decision yet; nothing changes.

## Rows

**FN-1 A grown-up check before a PIN is reset (audit SEC-7).**
Today a PIN can be reset offline on the device with a Rescue Code the device already holds or by waiting 24 hours, and online by signing in to the account. The two offline ways add a grown-up check: before the new PIN can be chosen, the person answers a question a young child cannot answer by trying (the parent-gate pattern of Apple's App Review 1.3 and Google's Families policy: for example a number written out in words to be typed as digits, in the UI language). A wrong answer gives a new question, without a count, a lock or a red state. Sign-in stays the strong way and needs no extra check. The check is a design pass first (the PIN reset wireframe, then a mock), then the component, with its strings in en, es and ko.
*Done when:* unit tests show the check is asked on both offline ways and not after sign-in, that the new PIN cannot be set without passing it, and that a miss changes nothing but the question; the e2e for the PIN reset passes the check.

**FN-2 A static splash in the HTML shell (finding F7).**
`index.html` paints the brand mark and a short "Loading" line in the canvas colour before the start bundle runs, and the app replaces it on its first frame. It has no script dependency, follows reduced motion, reads the UI language the device chose before (or English), and is the same on the learner app, the presenter and the grown-up area of the app host. Design pass first (wireframe, mock).
*Done when:* a build test checks the shell holds the splash and that the app removes it; first paint on the mobile profile of the speed review is measured before and after.

**FN-3 App chunks cached for a year (finding F9).**
A request for a `/_expo/static/js/` file that does not exist is answered with 404, not with `index.html`, so the hashed chunks can carry `Cache-Control: public, max-age=31536000, immutable`. If the app host stays assets-only (F-APP-001 AD-1), the 404 comes from the assets configuration (`not_found_handling` scoped so the SPA fallback does not cover `/_expo/`); a Worker script is added only if the configuration cannot do it, and that is recorded.
*Done when:* tests show the rule in `_headers` and the 404 for a missing chunk; the offline e2e still passes.

**FN-4 The presenter home lists from the manifest (finding F6).**
`/present` shows its home from the lesson and story manifest without waiting for every cell and story; a deck loads its cells when chosen, with the existing loading state.
*Done when:* tests show the home renders before the content chunks arrive and a chosen deck waits only for its own; the presenter e2e passes; the cold open on the mobile profile is measured before and after.

**FN-5 A screen under the quest does not redraw (finding F10).**
A tab screen that is not focused (Home under a quest or Results) does not re-render on progress writes; it brings itself up to date when it is focused again.
*Done when:* a render-count test shows no re-render of Home while a quest writes progress, and a correct Home after returning; the measured redraw under Results is recorded.

**FN-6 Console pages load only the visitor's UI language (finding F5).**
The console, `/signin`, `/start` and `/account/*` load the English dictionary and the visitor's locale, not all three. Switching the language loads the other one.
*Done when:* a bundle test shows the shared console chunk without the es and ko messages; the web tests and the console e2e pass in all three locales; the chunk size is recorded before and after.

**FN-7 The start bundle gets smaller (finding F4).**
In order, each its own commit with a bundle-content test: the placement bank behind the level check's own chunk; the content-schema linters out of the learner barrel; more game screens as screen chunks (the `SCREEN_CHUNKS` pattern); the console and site strings out of the learner dictionary where that is local. Reanimated aliases and Metro `inlineRequires` are not in this row. The start bundle line goes down to the measured number plus about 4 KB.
*Done when:* each step's bundle test passes, the offline e2e passes against a local release build, and the start bundle before and after is recorded.

**FN-8 The active tab has a mark that is not only colour.**
The selected tab in the learner tab bar shows a shape mark (for example a bar or a filled pill behind the icon) as well as its colour, in every theme and at every text size. Design pass first (wireframe, mock).
*Done when:* a component test shows the mark on the selected tab only; contrast is checked; screenshots before and after.

## Not in this amendment

- The iOS App Store submission (FN-0 d).
- Reanimated aliases, Metro `inlineRequires` (FN-7).
- Anything that waits for counsel (FN-0 e).

## As built

_Filled in as the rows land._

**FN-2.** Design pass: wireframe `design/wireframes/pwa/static-splash.md`, mock `design/screens/static-splash/` (the site header's "HR" circle at `spacing.jumbo`, the app name, one Loading line on `surface.canvas`; boards for en, es, ko with reduced motion, and 320 x 568 at 200 % text). `apps/mobile/scripts/pwa/static-splash.mjs` writes the splash into `dist/index.html` (style at the end of `<head>`, markup and a tiny inline script right before `<div id="root">`): every colour, size and duration comes from the tokens module at build time (a test pins each colour of the style to a token and the breathing floor 0.8 to 4.7:1 for `text.secondary` on the canvas), the line breathes only under `prefers-reduced-motion: no-preference`, and the string is the new `common.splash.loading` (en Loading, es Cargando, ko 불러오는 중; review ledger re-signed for `common`). The inline script picks the device record's language from a synchronous mirror, else the browser's first shipped language, else English, and sets `<html lang>`; painting needs no script. The mirror is the grown-up pages' `hr:console:uiLocale`, now named `UI_LOCALE_MIRROR_KEY` in content-schema: the learner app, All lessons and the presenter copy into it the language of every device record they read or write (`platform/storage-mirror(.web).ts`, a new part of the storage wrapper, fenced; `BROWSE_WRITABLE_KEYS` gains the key), never read it, and leave it alone for a record with no language ([FN] in AMENDMENTS-DISPLAY-NAV section 3.3). `index.ts` wraps every root it registers in `withStaticSplashRemoved` (`platform/static-splash.web.ts`), which removes `#hr-splash` in the layout effect of the first commit, so the learner app, the presenter and All lessons (all this index.html) swap splash and first frame in one paint; the console's own pages are prerendered Next HTML and get no splash. Tests: `scripts/__tests__/static-splash.test.mjs` (markup, tokens, motion, the language script in a VM), `pwa-postbuild-shell.test.mjs` (the real post-build output holds it), `static-splash.web.test.ts`, `screens/__tests__/static-splash-removal.test.tsx` (removed on the first commit, once), `locale-store.test.ts` and `storage-mirror.web.test.ts` (the mirror), `e2e/web/static-splash.spec.ts` (start bundle held: the HTML alone paints it; ko from the mirror, es from an es-MX browser; reduced motion; a chosen language mirrored; gone on the learner app and the presenter). Release build (CI=1): start bundle 4,969,229 B raw / 1,338,790 B gzip (was 4,968,234 / 1,338,442 B; +995 B for the remover, the mirror and the English line), under the 4,969,500 B line, which stays; learner precache 147 files. First paint on the speed review's mobile profile (its section 1 method: Playwright Chromium over CDP, Pixel 5, 4x CPU, Fast 3G, cold, gzip and ETag server, median of 3, same machine before and after): Welcome FCP 11,196 -> 812 ms, guest first quest (`/?try=1`) 11,840 -> 720 ms, presenter home 11,392 -> 696 ms. Ready (the key element's first frame) is unchanged within the run-to-run spread: Welcome 11,308 -> 11,669 ms, guest 12,123 -> 12,123 ms, presenter 22,977 -> 22,697 ms; LCP is now the app's own content (it was the first paint). The splash was gone in every run.

**FN-3.** Workers static assets cannot scope the single-page fallback by path (checked in the asset worker wrangler 4.135 ships: `not_found_handling` is one value for every miss), and `_redirects` runs before the asset match and answers only 200 rewrites and 3xx, so configuration alone cannot give a missing chunk a 404. The app host therefore gains a minimal Worker, recorded in F-APP-001 AD-1 ([FN]): `wrangler.toml` `main = "scripts/app-host/worker.mjs"`, assets bound as `ASSETS`, no `run_worker_first`. The assets layer still answers every file and, with `assets_navigation_prefers_asset_serving` (on by default from compatibility date 2025-04-01; the host has 2025-09-01), every navigation, so the script runs only for a non-navigation miss: a path under `/_expo/static/js/` gets 404 (`text/plain`, `no-store`, the `/*` baseline headers; `chunk-not-found.mjs`), anything else goes back to `env.ASSETS.fetch` and its fallback as before. `public/_headers` gives `/_expo/static/js/*` `Cache-Control: public, max-age=31536000, immutable` and keeps `! X-Content-Type-Options` (the build's nosniff check passes). `scripts/serve-dist.mjs` answers the same way for the e2e. Console chunks (`/_next/`) are unchanged. Tests: `scripts/__tests__/app-host-worker.test.mjs` (404 for a chunk, every other miss handed to the assets, the 404's headers equal to the `/*` rule, the wrangler config, exactly one year-long Cache-Control per chunk, nosniff off), `serve-dist.test.mjs` (404 for a missing chunk, the shell for a navigation to one), `merge-console.test.mjs` (the chunk headers), `e2e/web/app-host.spec.ts` (the start bundle immutable, a missing chunk 404 and not HTML). Checked locally with `wrangler dev` (workerd) on the release `dist`: the start bundle 200 with the year-long rule, a missing chunk 404 `no-store`, `/journey` and a missing `.json` 200 index.html, a navigation to a missing chunk 200 index.html; `wrangler deploy --dry-run` reads 2,535 asset files and the `ASSETS` binding. Not verified: the deployed edge (Workers Builds) and the free plan's invocation count, which only misses now reach.

Local verification for both rows: typecheck of `apps/mobile` and `apps/web`, the unit tests named above plus the 93 test files that mock `platform/storage` (all pass), the i18n review-ledger, translation and structure tests; e2e against the release build: `static-splash`, `app-host`, `offline` (31 passed), and `locale`, `language-picker`, `one-language`, `first-run-toast`, `grown-up-shell`, `browse`, `story-shelf`, `presenter-home`, `oops-screen`, `install-guide`, `guest-first-quest` (112 passed; `one-language` Largest-text fit timed out once under load and passes alone; `browse.spec.ts` "keep switch ... also offline" fails its offline reload intermittently on this build and on the build before these rows alike, a race with the service worker's install). The full mobile suite and CI were not run.
