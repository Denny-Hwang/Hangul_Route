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

**FN-4.** The presenter root mounts on the manifest: `withLessonContent(Root, { content: 'manifest' })` (`apps/mobile/src/screens/lesson-content.tsx`, used by `app-roots.tsx` for `/present`; All lessons keeps `content: 'all'`) waits for the presenter's own chunk, the device locale's lesson titles (with their 2.5 s grace) and that one locale's text chunk, and asks for no lesson cell, story body or other locale. The home's chooser lists from the manifests: `presenterChooserGroups` takes a `listed` predicate, and the presenter passes `presenterListsEpisode` (`logic/lecture/manifest-listing.ts`, a module of its own so it stays out of the start bundle): a Volume 1 episode always, a later volume (row CM-5B) when its cell and book 2 tales are on the device or the network can give them now, as before; its titles follow the title chunk as it arrives. A deck, chosen on the home or opened from a link, loads only its own content (`logic/lecture/deck-content.ts`, `screens/presenter/use-deck-content.ts`): its quests' cells (a quest, an episode's quests, a word review's quests), the slide locale's titles and text, then its tales (story blocks, a story episode's tales, and the tales its quests' steps play once their cells are in); the start screen keeps its existing loading state (`presenter-loading`) until they are in, and the deck builder's bundle is built again with what arrived. A core chunk that fails shows the crash screen with Try again (a newer build reloads); a later volume that fails is left out and its block skipped, as before. A Word review card's lessons load on the home and hold the preset Starts (`presetsReady`) until they are in, as Recent's read already did. Tests: `screens/__tests__/lesson-content.test.tsx` (the root mounts before any lesson chunk and asks for none; a failed locale still mounts; failed root code is the crash screen), `screens/presenter/__tests__/presenter-home-manifest.test.tsx` (the whole presenter draws its home, chooser and presets without asking for a cell or story body), `presenter-deck-content.test.tsx` (a linked deck asks for its own cell and story alone, shows the loading state until they are in, is never rejected as empty meanwhile; a failed cell is the crash screen and Try again asks again), `logic/lecture/__tests__/deck-content.test.ts`, `quick-source.test.ts` (from cold stores, modules loaded afresh, the chooser offers the same groups, rows, titles and minutes as with everything loaded, Volume 2 included, and loads nothing), `presets-home.test.tsx` (Starts held while Word review's lessons load). Measured with the speed review's method (section 1: release build, measurement server with gzip and ETags, Playwright Chromium, median of 3), cold open of `/present` to its home: mobile profile (4x CPU, Fast 3G) **21,752 ms before, 11,436 ms after (-10.3 s, -47 %)**, JavaScript over the network until the home 2,587,076 B before and 1,423,483 B after, requests until the home 92 and 5 (105 and 18 by 3 s after it); desktop 879 ms and 788 ms. Blocking time on the mobile profile stays within its spread (1,602 ms and 1,808 ms; runs 1,355 to 1,900 ms). The presenter chunk is 281,662 B raw (277,689 B before). The presenter e2e (`e2e/web/presenter*.spec.ts`, 163 tests) passes against the local release build.

**FN-5.** Home redrew under the quest because it stays mounted in the bottom tabs beneath the root stack's screens and subscribes to the learner's progress snapshot (`useProgressStore((s) => s.byProfile[id])`, and the plan, story and catch-up slices), which every quest step writes. The native stack's `freezeOnBlur` does not help: its web view ignores it, and a tab whose stack screen is covered is still its navigator's focused tab, so the tab navigator's freeze never starts. Each learner tab is now wrapped in `frozenWhenBlurred` (`apps/mobile/src/navigation/freeze-when-blurred.tsx`, `tabs.tsx`): while `useIsFocused()` is false the screen is inside a Suspense boundary whose child throws a thenable that never settles (react-freeze's technique, written in place, no new dependency), so React renders none of it whatever its stores do, keeps its state and subscriptions, and renders it once, with the stores as they are, when it is focused again. The freeze is set from a layout effect, so it renders in React's sync lane: set in the render that saw the blur (a default-lane update), a boundary hiding content it already shows has its commit held back by React's "just noticeable difference" delay (up to a second), and the covering screen's first updates with it (the e2e caught a quest Close pressed at once finding no back guard yet). The screen's element is memoised, so the blur itself redraws nothing of it. Web only: the web stack already hides a covered screen with `display: none` and has no back swipe; on iOS and Android a screen under a sheet modal or a back swipe can be seen, so it keeps drawing as before. A Home first mounted while not focused (the first quest opens over it) draws nothing until it is first shown. Tests: `screens/home/__tests__/home-frozen-under-quest.test.tsx` (a Home stand-in subscribed to the progress store as `HomeScreen` is: the blur redraws nothing, no render for six progress writes while the quest and Results cover it, one render with all six when focused again, then it follows writes; first mounted unfocused it renders nothing until focused; iOS keeps drawing; every learner tab in `tabs.tsx` is wrapped; `Freeze` itself). Measured with the speed review's tap method (mobile profile, 4x CPU, the first quest played to its Results; the before and after release builds run back to back, 3 runs each, median): See results -> Results **243 ms before, 192 ms after**, and the Home under it re-rendered twice during that tap before and not at all after (Home is no longer rendered under the first quest); Start my journey -> quest intro 546 ms and 149 ms (Home's first render no longer happens beneath it); Results: Back home -> Home 170 ms and 215 ms, because Home now renders for the first time there, still under the 520 ms the review holds every tap to. The start bundle measures 4,969,280 B raw / 1,338,807 B gzip (4,968,234 B before the two rows: +1,046 B, the freeze wrapper and the manifest root option), 220 B under its 4,969,500 B line, which does not move (FN-7 lowers it). Verified locally: typecheck, the touched unit suites, the presenter e2e (163 passed) and the learner e2e specs on Home, Results, quests, the tabs, Journey, Library, locale, layout and offline (331 passed) against the local release build; the full mobile unit suite and CI were not run.
