# Speed review of every page (AMENDMENTS-FOLLOWUPS-2026-11 FU-4)

- Date: 2026-11-17. Base: `work/s4-fu4` at 23b255f1a (main 7411e4880 with FU-1).
- Scope: the learner PWA (`apps/mobile`, release `build:web`) and the site and console (`apps/web`, `next build` export).
- Row: `docs/specs/AMENDMENTS-FOLLOWUPS-2026-11.md` FU-4. Earlier note: `docs/launch/product-review-2026-11-15.md` ARCH-2 and
  the Performance & Reliability score (13.5 s blank screen on a slow link, 4.9 MB start bundle).

## 1. Method

**Builds.** `CI=1 pnpm --filter @hangul-route/mobile build:web` (start bundle 4,965,475 B raw / 1,337,505 B gzip, learner
precache 147 files, 11,049,954 B) and `pnpm --filter @hangul-route/web build`. A second learner export with
`--source-maps` (same start bundle hash) maps profiles and bytes to source files.

**Server.** A measurement-only static server with the rules of `scripts/serve-dist.mjs` / `e2e/serve-out.mjs` (single-page
fallback for the app, nearest `404.html` for the site, the export's `_headers`), plus gzip and ETags, as the Cloudflare edge
compresses and revalidates. Not committed.

**Browser.** Playwright Chromium (the installed one), driven over CDP. Two profiles:

| Profile | Viewport | CPU | Network |
|---|---|---|---|
| desktop | 1280 x 800 | not throttled | not throttled (localhost) |
| mobile | Pixel 5 (393 x 851, touch) | `Emulation.setCPUThrottlingRate` 4x | `Network.emulateNetworkConditions` fast-3G-like: 562.5 ms RTT, 1.44 Mbit/s down, 675 kbit/s up (Chrome DevTools "Fast 3G") for page loads; not throttled for the tap timings |

**Page loads** (cold: a new browser context, no cache, no service worker; warm: the same context reloaded once the
service worker controls the page, or with the HTTP cache for the site): navigation timing (TTFB, DOMContentLoaded,
load), FCP, LCP and CLS from `PerformanceObserver`, long tasks (`longtask`), blocking time (the sum of each long task's
time over 50 ms, from navigation to 3 s after the page's key element showed), JavaScript bytes transferred and requests
(CDP `Network.loadingFinished`), and **ready**: the first animation frame in which the page's key element is visible
(Welcome: "Let's start"; guest try: "Hi from Hoya"; presenter: its home; site pages: the `h1`).

**Taps** (a Playwright spec that drives the real flows with the e2e helpers, run against the export, not committed):
from the tap's `pointerdown` timestamp to the first frame in which the next screen's key element is visible; the longest
task in that window; React commits (counted through the DevTools global hook, which React calls on every commit in
production builds); IndexedDB reads (`IDBObjectStore.get`, `getAll`, `getAllKeys`, `openCursor`); and commits and reads
in the 3 s after the screen settled (re-renders on a tick would show there). Game rounds: long tasks while a round is
played. The service worker controls the page before the first timed tap, as on a second visit.

**Runs.** Every number is the **median of 3 runs**. CPU profiles (CDP `Profiler`, 100 us sampling, mapped through the
source maps) were taken separately and are not part of the medians.

**Caveats.**
- A container CPU (4 vCPU, Intel Xeon 2.1 GHz), not a phone. The 4x slowdown is a common stand-in for a mid-range Android
  phone; a low-end phone can be slower again. Absolute numbers are for comparison before and after, on the same machine.
- The local server speaks HTTP/1.1, so Chromium opens at most 6 connections to it; the edge speaks HTTP/2 or 3, where
  many requests share one connection and the bandwidth. Queueing behind many requests (finding F1) shows either way.
- The network throttle applies to the page, not to the service worker's own fetches (its precache download).
- gzip, not Brotli: the edge may send a little less.
- Lighthouse is not installed and was not fetched; the CDP measurements above cover its load metrics.
- Game families: Match the Sound, Build a Letter, Listen and Pick (the Check), Trace and the story reader were played;
  Read Pick, Culture Quiz and the vocabulary question were not reached by the measured flows (they use the same pick-one
  board, `TapBoard`, as Listen and Pick and Match the Sound).

## 2. Measurements before the fixes

### 2.1 Page loads (median of 3)

Ready, LCP and load in ms; blocking in ms; JS in bytes over the network (the first screen and 3 s after it; warm loads
come from the service worker or the HTTP cache).

| Page | Profile | Cold ready | Cold LCP | Cold blocking | Longest task | Cold JS | Requests | Warm ready | Warm blocking | CLS |
|---|---|---|---|---|---|---|---|---|---|---|
| App: first open (Welcome) | desktop | 491 | 496 | 190 | 210 | 2,193,272 | 56 | 302 | 70 | 0.010 |
| App: first open (Welcome) | mobile | 10,693 | 10,704 | 1,411 | 1,079 | 1,541,718 | 28 | 1,026 | 576 | 0.026 |
| App: guest first quest (`/?try=1`) | desktop | 638 | 648 | 203 | 218 | 2,210,169 | 60 | 332 | 73 | 0.006 |
| App: guest first quest (`/?try=1`) | mobile | **16,765** | 16,776 | 1,316 | 909 | 2,095,619 | 60 | 1,491 | 628 | 0.011 |
| App: presenter home (`/present`) | desktop | 710 | 812 | 216 | 241 | 2,699,346 | 105 | 485 | 81 | 0.006 |
| App: presenter home (`/present`) | mobile | **22,215** | 22,228 | 1,560 | 1,004 | 2,591,010 | 105 | 1,601 | 774 | 0.011 |
| Site: landing `/` | desktop | 81 | 72 | 0 | 0 | 110,497 | 17 | 33 | 0 | 0 |
| Site: landing `/` | mobile | 1,396 | 1,396 | 114 | 113 | 110,497 | 17 | 706 | 0 | 0 |
| Site: `/learners` | mobile | 1,392 | 1,388 | 110 | 112 | 109,041 | 15 | 740 | 0 | 0 |
| Site: `/privacy` | mobile | 1,379 | 1,380 | 93 | 102 | 109,041 | 12 | 736 | 0 | 0 |
| Console: `/signin` | desktop | 244 | 256 | 38 | 88 | 537,527 | 23 | 107 | 0 | 0 |
| Console: `/signin` | mobile | 4,754 | 4,764 | 399 | 400 | 537,527 | 23 | 1,005 | 105 | 0 |
| Console: `/teach` | mobile | 5,998 | 6,008 | 408 | 410 | 538,560 | 25 | 1,561 | 110 | 0 |
| Console: `/parent` | mobile | 6,557 | 6,568 | 408 | 407 | 631,999 | 29 | 1,605 | 106 | 0 |

Desktop site and console pages: ready at 33 to 244 ms, no long task over 88 ms. `/teach` and `/parent` were measured on
their signed-out shell (the e2e mocks were not needed for the load: the bundle is the same).

### 2.2 Taps (median of 3)

Tap to the next screen's key element, in ms, with the longest task in that window in brackets. Renders and storage
reads are React commits and IndexedDB reads from the tap to the screen (desktop run).

| Step | desktop | mobile (4x CPU) | Renders / reads | Renders in the next 3 s |
|---|---|---|---|---|
| Welcome: Let's start -> Who is learning | 36 (0) | 149 (142) | 6 / 0 | 0 |
| Privacy: Continue -> level-check fork | 33 (0) | 138 (126) | 7 / 2 | 0 |
| Start my journey -> quest intro | 132 (69) | **480 (301)** | 27 / 7 | 0 |
| Quest intro: Continue -> Discover | 45 (0) | 136 (130) | 6 / 0 | 0 |
| Match the Sound: Play -> board | 28 (0) | 84 (79) | 7 / 0 | 0 |
| Build a Letter: Play -> board | 30 (0) | 76 (73) | 6 / 0 | 0 |
| Check: Go -> first round | 16 (0) | 67 (62) | 7 / 0 | 0 |
| See results -> Results | 61 (60) | **278 (274)** | 24 / 3 | 0 |
| Results: Back home -> Home | 35 (0) | 140 (147) | 27 / 5 | 0 |
| Tab: Journey | 55 (53) | 178 (174) | 3 / 0 | 0 |
| Journey cell -> lesson page | 21 (0) | 111 (104) | 5 / 0 | 0 |
| Lesson: Start quest 2 -> intro | 74 (0) | 257 (153) | 11 / 2 | 0 |
| Trace: Play -> canvas | 31 (0) | 79 (0) | 9 / 0 | 0 |
| Tab: Library | 49 (0) | 141 (137) | 17 / 0 | 0 |
| Library: a card -> card detail | 27 (0) | 163 (158) | 6 / 1 | 0 |
| Library: Words tab | 39 (0) | 162 (154) | 8 / 0 | 0 |
| Words: Food topic | 20 (0) | 121 (116) | 9 / 0 | 0 |
| Topic: Learn -> flashcards | 18 (0) | 92 (77) | 8 / 0 | 0 |
| Library: Story Time tab | 37 (0) | 159 (155) | 8 / 0 | 0 |
| Story tile -> story page | 25 (0) | 119 (113) | 8 / 0 | 0 |
| Story page: Start -> story intro | 55 (0) | 94 (123) | 9 / 2 | 0 |
| Story: Play -> reader | 23 (0) | 94 (88) | 8 / 0 | 0 |
| Reader: next page | 31 (0) | 153 (150) | 18 / 0 | 0 |
| Tab: Learning Route | 25 (0) | 117 (115) | 5 / 1 | 0 |
| Home: Profile and settings | 21 (0) | 100 (95) | 12 / 0 | 0 |
| Profile: Account & backup -> grown-up dashboard | 45 (0) | 195 (189) | 34 / 0 | 0 |

### 2.3 Long tasks while playing (median of 3)

| Round | desktop: long tasks | mobile: long tasks, longest, blocking |
|---|---|---|
| Match the Sound, every round (about 40 taps) | none | 10, 98 ms, 172 ms |
| Build a Letter, 4 blocks | none | 4, 61 ms, 16 ms |
| Listen and Pick (Check), 2 rounds | none | 6, 99 ms, 141 ms |
| Trace, 3 strokes | none | none |
| Flashcards, flip and next x4 | none | 1, 120 ms, 70 ms |
| Story reader, 4 pages | none | 4, 149 ms, 336 ms |

## 3. Findings, ranked

Each finding names the evidence, then **fix now** (local and safe, done in this row) or **later** (with the reason and a
rough size: S under a day, M a few days, L a week or more).

### F1. The background chunk load holds back what the screen needs — fix now

Once the first screen is up, App asks for every lesson, story and locale chunk at once (54 requests on a first visit,
about 850 KB gzip, the es and ko text included). On the fast-3G-like link the guest's first quest
chunk (`guest-chunk`, 5 KB) was asked for 77 ms after them and arrived **6.1 s** later; the guest's hello showed at
16.8 s against 10.7 s for Welcome, which needs no extra chunk. The same queue sits in front of any lesson or card the
learner opens in the first seconds.
Fix: the background load runs at most 4 chunks at a time, in the same order, the locale chunks last
(`src/logic/lessons/prefetch-pool.ts`). Every chunk still loads; a failed one is still left for the screen that needs it.

### F2. The first screen waits for two chunks it could fetch beside the start bundle — fix now

Waterfall of a cold first open on the mobile profile: `index.html` 0 to 587 ms, the start bundle 616 to 8,269 ms
(1,337,963 B), evaluated until about 9.4 s, then the story shelf (9,463 to 10,081 ms) and the English lesson headers
(9,544 to 10,152 ms), then the first render at 10.7 s. Both chunks are needed in every locale and their names are known
at build time. Fix: the post-build adds to `index.html` a small head script that adds a `<link rel="preload"
as="script">` for both when no service worker controls the page (`scripts/pwa/start-preload.mjs`; a worker answers them
from the precache), and fails the build if either is not there exactly once.

### F3. The route model is rebuilt from scratch on Home, the Learning Route and the grown-up dashboard — fix now

CPU profile, mobile profile, tap on Account & backup (the grown-up dashboard): 1,638 ms of main-thread work, of which
`buildMyRoute` is 300 ms (the Learning Route tab, still mounted, and the dashboard's route row each build it). Inside it,
`skillRows` called `questSkills` three times per quest per build (115 ms; `questSkills` alone 79 ms self time) and
`completionState` walked every episode against every quest once per stage, twice per build (61 ms). The first Home draw
under the first quest (Start my journey: 480 ms, longest task 301 ms) spends 73 ms in the same model; Results 22 ms.
Fix: each quest's skills are worked out once per steps list (`questSkillsOnce`), and the completed episodes once per
episode list and quest list (`completedEpisodesOnce`); both are keyed by arrays the stores replace, never change.

### F4. The start bundle: 4,965,475 B raw / 1,337,505 B gzip — later

It is 7.6 s of the 10.7 s cold first open on the fast-3G-like link, and its first run is the longest task of every page
(1,079 ms at 4x; about 175 ms of it is compiling module code, `loadModuleImplementation`). By source (source map):

| Part | Bytes raw | Note |
|---|---|---|
| `apps/mobile/src` | 1,971,731 | every learner screen that is not a chunk yet: WriteFrame (20 KB), TypeHangul, TraceWord, SentenceBuilder, VocabSpeedRound, the story reader, Placement, Route proposal, Join a class (10 to 15 KB each) |
| `react-native-reanimated` | 486,046 | its whole `index`, layout animations included (Zoom, Bounce, Flip, Rotate: about 55 KB) |
| `packages/design-system` | 450,212 | scene art props (people 33 KB, seasons 26 KB, books 20 KB, writing 17 KB, objects 16 KB, architecture 14 KB), card art 31 KB |
| `packages/content-schema` | 364,678 | the barrel brings `story-lint` (17 KB) and `curriculum/generate` (14 KB) along with the schemas |
| `packages/i18n` | 243,941 | English: `console` 75,554, `learner` 67,821, `landing` 35,685, `caregiver` 32,400 |
| `react-native-web` | 249,126 | |
| `react-native-gesture-handler` + hammerjs | 216,861 | |
| `placement.generated.ts` | 151,545 | the level-check bank; only the fork's readiness and the bank version are read before the check opens |
| `react-dom` | 128,651 | |
| `zod` | 67,985 | |
| `__generated__/vocab.ts` | 51,636 | |

The line has been raised row by row since CM-8 (its history is the comment above `PRECACHE_BUDGET.startBundleRaw`). Candidates, each its own change with a
bundle-content test: the placement bank behind the check's own chunk (about 150 KB raw, M: seven readers, the generator,
a screen chunk); the console and site strings out of the learner dictionary (about 110 KB raw, M: `packages/i18n`
namespaces loaded per surface); the content-schema linters out of the barrel (about 30 KB, S to M: imports across
packages); more game screens as screen chunks (10 to 20 KB each, S each, the SCREEN_CHUNKS pattern); reanimated's layout
animations (about 55 KB, M: a Babel or resolver alias, needs native checks). Metro `inlineRequires` would defer most
module evaluation (about 175 ms of compile at desktop speed), but changes module side-effect order app-wide: L, with a
full e2e pass.

### F5. Console pages ship every UI language — later

Every console page and `/signin`, `/start`, `/account/*` loads one shared chunk of 1,020,814 B raw / 308,242 B gzip;
756,944 B raw of it is the `packages/i18n` dictionary with all three locales (es and ko are about 60 % of it, about
120 KB gzip). Mobile profile: `/signin` ready at 4.8 s, `/teach` 6.0 s, `/parent` 6.6 s, against 1.4 s for the site
pages (110 KB of JS). Another 160 KB raw is `packages/content-schema` (schemas and their messages). Later: the console
would load only the visitor's locale (the learner app already does, with locale chunks); M, a change to how
`packages/i18n` is read on the web console.

### F6. The presenter waits for the whole catalogue — later

`/present` shows its home once every lesson cell and story is in (`withLessonContent`): 105 requests, 2.59 MB of JS
on a cold first open; ready at 0.7 s on desktop but 22.2 s on the mobile profile. Teachers mostly open it on a laptop on
school Wi-Fi, so the desktop number is the usual one. Later: the home lists from the manifest and a deck loads its cells
when chosen; M, the deck builder reads cells synchronously.

### F7. Nothing on screen until the start bundle has run — later

The HTML has the canvas colour and no content: the first paint on the mobile profile is at 9.9 s (FCP). A static splash
(brand mark, "Loading") in `index.html` would paint within about 0.6 s. Later: needs a design pass (wireframe, then mock)
before it is built; S once designed.

### F8. First visit downloads the whole offline set, and every learner runs the es and ko text — later

After the first screen the service worker precaches 147 files (11.05 MB raw), and App loads and runs both locale chunks
(328 KB gzip, `locale-es` and `locale-ko`) for every learner, so a language switch and the level check's test language
work offline. On a slow or metered link this is minutes of background download. Both are deliberate offline promises;
changing them (for example the other locales only on Save for offline) is an owner decision. F1's pool already keeps them
behind the screen's own requests.

### F9. App chunks revalidate on every open without a service worker — later

`/_expo/static/js/*` has no `Cache-Control: immutable` (the hashed site assets `/_next/static/*` have it): on purpose,
because the Worker answers a missing chunk with `index.html` under the chunk's URL (`apps/mobile/public/_headers`).
Pages without a worker in control (a first visit's later loads, the iOS 14 home-screen app) revalidate each chunk, one
round trip each. Later: a Worker that answers a missing `/_expo/static/js/` file with 404 would allow the year-long rule;
S to M, but the app host is assets-only by decision (F-APP-001 AD-1).

### F10. Home stays mounted under the quest and redraws on each progress write — later

Results (278 ms at 4x) redraws Home beneath it (47 ms in the profile, the route strip and the story scene). After F3 the
route part is smaller. Deferring the redraw of a screen that is not focused touches navigation for every tab: M.

### What is already fine (no action)

- Every tap shows its next screen in under 500 ms on the mobile profile and under 140 ms on desktop.
- No screen re-renders while idle: 0 React commits in the 3 s after every measured screen settled; no timer drives a
  render on Home, the games or the reader.
- Storage reads per tap are few (at most 7, on the first quest's start); none repeat while idle.
- Game rounds: no long task on desktop; on the mobile profile the longest is 99 ms in the pick-one games and 149 ms in
  the story reader.
- Layout shift is at most 0.026 on every page. The site's landing and policy pages ship 110 KB of JS and are ready at
  about 1.4 s on the mobile profile.
- Hashed site assets (`/_next/static/*`, `/site/captures/*`) and recorded clips are `immutable`; `sw.js`, the manifest
  and `index.html` are `no-cache`.

## 4. Measurements after the fixes

The same harness, machine and profiles on the release build of the four fix commits. A fifth commit then keeps the
preload links off pages a service worker controls (under a worker Chromium asked the worker for both chunks twice, once
for the preload and once for the script tag); the cold first open is unchanged by it (guest first quest re-checked once:
hello at 11.5 s, the two chunks at 617 to 1,323 ms beside the start bundle), and warm opens no longer make the two extra
worker requests. Build: start bundle 4,966,296 B raw /
1,337,799 B gzip, 821 B more than before and under the 4,969,500 B line, which stays; learner precache 147 files,
11,051,490 B. Median of 3. Rebased on `main` with FU-3 (#1042): start bundle 4,968,234 B raw / 1,338,442 B gzip, still
under the line; learner precache 147 files, 11,055,682 B.

### 4.1 Page loads

| Page | Profile | Ready before | Ready after | Change | Cold blocking before / after | Network JS in the window before / after |
|---|---|---|---|---|---|---|
| App: first open (Welcome) | mobile cold | 10,693 | 10,228 | **-465 ms (-4 %)** | 1,411 / 1,406 | 1,541,718 / 1,385,595 |
| App: guest first quest | mobile cold | 16,765 | 11,266 | **-5,499 ms (-33 %)** | 1,316 / 1,332 | 2,095,619 / 1,390,812 |
| App: presenter home | mobile cold | 22,215 | 21,502 | -713 ms (noise; F6 not changed) | 1,560 / 1,477 | 2,591,010 / 2,589,446 |
| App: first open (Welcome) | desktop cold | 491 | 496 | none | 190 / 186 | 2,193,272 / 2,193,574 |
| App: guest first quest | desktop cold | 638 | 537 | -101 ms | 203 / 191 | 2,210,169 / 2,210,468 |
| App: presenter home | desktop cold | 710 | 692 | none | 216 / 202 | 2,699,346 / 2,699,665 |
| App: first open (Welcome) | mobile warm | 1,026 | 1,085 | none (noise) | 576 / 610 | 0 / 0 |
| App: guest first quest | mobile warm | 1,491 | 1,182 | -309 ms | 628 / 615 | 0 / 0 |
| App: presenter home | mobile warm | 1,601 | 1,618 | none | 774 / 717 | 0 / 0 |
| Site and console pages | both | see 2.1 | within 4 % of 2.1 | no change (not touched) | | |

Waterfall of the guest's first open after the fixes (mobile profile): the story shelf and the English headers download
at 597 to 1,298 ms beside the start bundle (599 to 8,356 ms); the guest chunk is asked for at 10,259 ms and arrives at
10,970 ms (was 10,616 to 16,692 ms); hello at 11.5 s (was 17.4 s in the same single run). The background load now has at
most 4 chunks in flight (8 requests finished over the network in the 3 s after Welcome showed, was 28).

### 4.2 Taps and play

Tap times are the same within the run-to-run spread (about +/-30 ms on the mobile profile): every tap is still under
520 ms on the mobile profile and under 115 ms on desktop, no screen re-renders while idle, and storage reads per tap are
unchanged. The table of section 2.2 holds for the build after the fixes; the rows the fixes aim at:

| Step | desktop before / after | mobile before / after |
|---|---|---|
| Start my journey -> quest intro | 132 / 111 | 480 / 503 |
| See results -> Results | 61 / 64 | 278 / 301 |
| Profile: Account & backup -> grown-up dashboard | 45 / 38 | 195 / 200 |
| Tab: Learning Route | 25 / 22 | 117 / 113 |

The route model work moved off the critical frame rather than out of the tap's first frame, so the tap timer does not
show it; the CPU profile does (mobile profile, two runs each, before / after):

| Window | `buildMyRoute` | `skillRows` | `completionState` |
|---|---|---|---|
| Account & backup -> grown-up dashboard | 307 / 196 ms, 306 / 204 ms | 117 / 40 ms | 65 / 24 ms, 59 / 31 ms |
| Start my journey -> quest intro | 51 / 49 ms, 55 / 40 ms | 8 / under 1 ms | 11 / 6 ms, 7 / 7 ms |
| See results -> Results | 20 / 16 ms, 20 / 16 ms | 5 / 3 ms | 4 / under 1 ms |

### 4.3 What is left

F4 to F10 stand as written in section 3, with their sizes. In order of what they would give a learner on a slow phone:
F4 (the start bundle, 7.6 s of the cold first open), F7 (a static splash, first paint from about 9.9 s to about 0.6 s),
F5 (console pages, about 120 KB gzip each), F6 (the presenter on a phone), F8 (first-visit background download), F10 and
F9.
