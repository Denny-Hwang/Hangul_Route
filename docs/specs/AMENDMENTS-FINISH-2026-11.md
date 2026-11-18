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

**FN-6.** Next's client build reads `@hangul-route/i18n`'s `bundled-messages` as its `.web` twin (no es or ko overlay), as Metro already does for the learner PWA: `apps/web/next.config.js` adds a `NormalModuleReplacementPlugin` for the browser compilation only, scoped to `packages/i18n/src`, so the server build (the static HTML, always English, and the site's `/es` and `/ko` pages) keeps both. The grown-up pages load the language they show as a chunk of its own (`apps/web/src/lib/i18n/message-overlays.ts`: a literal `import()` of `@hangul-route/i18n/messages-es` or `-ko`, one fetch at a time per language, handed to `registerMessageOverlay`; a chunk that cannot load settles false and the language reads English, as `getMessages` falls back). `LocaleProvider` shows a language once its messages are in: the first-paint guess starts loading on mount, beside the record read, and `ready` (the grown-up gate's empty canvas) waits for the resolved language's chunk as it already waited for the record, so no frame paints English first; a later switch, another tab's choice or the account merge keeps the current language on screen until the new one has arrived, and a later choice wins over a slower chunk. The Display sheet's confirm step (written in the language tapped) and the transfer consent's language select wait for that language's words the same way (`withMessages`). `packages/i18n` itself is unchanged but for the comments of `bundled-messages.ts` / `.web.ts`; its suite stays at 100 % (105 files, 11,715 tests). **Bundle test:** `apps/web/scripts/console-locale-check.mjs` runs after `next build` in `build` and `build:console`; it reads the start chunks of every exported grown-up page (R-1 `isGrownUpPath`, 36 pages) and fails when one holds any of 60 translated es or ko strings spread over the dictionary, or when no chunk of the export holds them (so the probes cannot go stale); its tests (`scripts/__tests__/console-locale-check.test.mjs`) include the real export when one is built, and the check fails on the build before this row. **Sizes** (`pnpm --filter @hangul-route/web build`): the shared chunk every grown-up page loads, 1,020,814 B raw / 308,242 B gzip before, 518,544 B / 160,435 B after; Spanish is its own chunk of 254,348 B / 75,054 B and Korean 252,486 B / 73,715 B, loaded only by a page that shows them. **Ready** on the speed review's mobile profile (its method, §1: Pixel 5, 4x CPU, Fast 3G, gzip server, median of 3 cold loads; ready = the first frame the final page's `h1` is visible; on the production export without a session `/teach` and `/parent` go to `/signin`, so the `h1` is the sign-in heading), before / after, JS over the network after: English `/signin` 4.56 / 3.66 s (532 / 384 KB), `/teach` 5.76 / 4.72 s, `/parent` 6.49 / 5.45 s (625 / 477 KB); Spanish `/signin` 4.55 / 4.74 s, `/teach` 5.86 / 4.80 s, `/parent` 6.61 / 5.57 s (459 / 552 KB); Korean `/signin` 4.85 / 4.78 s, `/teach` 5.96 / 4.92 s, `/parent` 6.54 / 5.53 s. A Spanish `/signin` is about 0.2 s slower: its language chunk is requested only once the page's code has run (a round trip on this link); every other page and language is faster. Not in this row: the Clerk widget's own words (`@clerk/localizations`, `esMX` and `koKR` beside `enUS`, a 159,515 B chunk on every grown-up page) and the content-schema overlays (F5's other 160 KB) still ship in every language. **Verified locally:** `turbo run typecheck lint` for web and i18n; the web suite (253 files, 5,329 tests); the e2e specs of `apps/web` on the production export (296 passed; the two `site-budgets` home-height cases fail the same way on the build before this row, a font difference of this machine) and on seven mocked-API exports built as each spec's header says (report, lecture, PIN reset, moves, GX, notes, blend), which cover the console in ko, en and es (`grownup-readouts`, `button-size`, `class-moves`, `class-page-order`, `learning-route` and others): all pass but `learning-route` (12) and `lesson-picker` (2), which fail identically on the build before this row, and two timing cases (`reports` RP-8 stepper, `space-rename` at 320) that failed once under load and pass on three repeats. Not run: the console on F-APP-001's merged app-host build (`build:console`, `E2E_OUT=../mobile/dist`; the billing lane), and CI.
