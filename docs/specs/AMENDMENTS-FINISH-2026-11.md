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

**FN-1.** **[FN]** The two offline ways of Forgot PIN? now ask a check before the new PIN. A Rescue Code that matches, or **Set a new PIN** after the finished 24-hour wait, replaces the reset cards with one card: **One more step**, "Type this number in digits.", a number from 100 to 999 written out in words in the UI language (en "three hundred forty-seven", es "trescientos cuarenta y siete", ko "삼백사십칠"), a number field and Continue. Only the right answer opens `PinEntry` setup, with that way's `via`. A miss shows a different number, clears the field and adds one calm line ("Not quite. Here is a new number.", polite live region). There is no count, pause, lock or red, and the PIN and Rescue Code attempt counters are not changed. **Sign in to the account** asks no check: its ticket still opens setup directly. The card does not say "grown-up", so a self-only device's reset screen still shows that word nowhere. The old math gate (`design/wireframes/parent/gate.md`) was retired in 2026-09 and its component deleted, so there was nothing to reuse.
Design: wireframe `design/wireframes/onboarding/all-ages-onboarding.md` box G2 (`profiles/pin-entry.md` and `pin-entry-v2.md` Panel C point to it); mock `design/screens/profiles/pin-reset-check.md` with `mock/pin-reset-check.html` and `.css`, boards 1 to 7, and shots at 320, 1280 and 320 at 200 % text (no horizontal scroll; words wrap whole).
Code: `packages/i18n/src/number-words.ts` (`numberInWords`, 0 to 999, en, es and ko, written by hand because the platform has no spell-out format); `caregiver.pin.reset.check.*` in en, es and ko (`words(n)` calls `numberInWords` for its own locale); review ledger `caregiver` re-signed for es and ko; `apps/mobile/src/logic/profiles/grown-up-check.ts` (which ways ask the check, the number draw that never repeats the last one, digit cleaning that also takes full-width digits, exact match, open and answer); `apps/mobile/src/screens/parent/PinResetCheckCard.tsx`; `PinResetScreen.tsx`, where the check's right answer is the only path to `goToSetup`; the e2e helper `passResetCheck` in `apps/mobile/e2e/web/helpers.ts`, used by `pin-reset`, `onboarding-guardian`, `edit-profile` and `story-reader-sources`. The start bundle line rises to 4,977,500 B: the measurement plus 4,011 B (`scripts/pwa/lesson-chunks.mjs`).
Verified locally on 2026-11-18: `turbo run typecheck lint` for mobile and i18n, 14 of 14 tasks passed. i18n `vitest run`: 107 files, 11,738 tests passed; `number-words.ts` has 100 % coverage. Mobile unit tests in `src/logic/profiles` and `text-field-border-source`: 22 files, 428 tests passed; `grown-up-check.ts` has 100 % coverage. Screen tests in `src/screens/parent`, including the new `PinResetCheck.test.tsx`: 16 files, 198 tests passed. The source-scan suites (copy guard, type scale, raw pressables, bundle guards, header registry and others): 110 files, 2,269 tests passed. `lesson-chunks.test.mjs`: 49 tests passed. Release `build:web` (CI=1): start bundle 4,973,489 B raw. Playwright against that release build: `pin-reset`, `onboarding-guardian` and `edit-profile` passed, 33 of 33. Not run: `story-reader-sources.spec` (it needs the fixture build `dist-e2e`) and the full mobile suite. The es and ko strings were reviewed in this session by one agent, under the ledger's `MAR` mark. A multi-agent review of those strings is still to do.

**FN-8.** The selected learner tab draws a mark as well as its tint: a short bar with round ends (`spacing.xxl` wide, `spacing.xs` tall, `radii.pill`) in `brand.primary`, centred over the selected item in the bar's top padding (`tabBarMetrics().paddingTop`), right under the top rule. It sits outside the item's content, so no text size, label or width moves it or draws over it, and the bar is no taller. It is a `borderWidth.base` border filled with the same colour, so forced colours (which drop fills) still draw it. `GuardedTabButton` adds it when `accessibilityState.selected` is true, on the web link and the native Pressable alike (`TAB_SELECTED_MARK`); it takes no taps and is hidden from screen readers, and roles and `aria-selected` are unchanged (AU-17c). The app has one colour scheme (no dark theme), so "every theme" is that scheme plus forced colours on the web. Wireframe `design/wireframes/shell/tab-bar.md`; mock `design/screens/app-shell/tab-bar-selected.md` with shots at 320, 320 with 200 % text, forced colours and 1280; release-build shots before and after in `design/screens/app-shell/shots/tab-bar-selected-app-{before,after}-*.png` (320, 320 at Largest, 320 in forced colours, 1280; device scale 1). Verified locally: `tab-button.test.ts` (10 tests; the mark on the selected tab only, on web and native; its place and size; its contrast on `surface.paper` from the tokens, 5.9:1 against the 3:1 floor), the `navigation`, `logic/touch`, `logic/my-route` and source-guard suites (43 files, 903 tests), mobile typecheck, the token-drift check, and the web e2e specs that use the tab bar (`first-run-toast`, `home-catch-up`, `learner-report`, `culture-tip`, `target-size`: 35 passed, 3 WebKit-only skipped). Not verified: iOS and Android on a device (the mark relies on the default `overflow: visible` of a native view to draw in the bar's padding), and the full mobile suite.
