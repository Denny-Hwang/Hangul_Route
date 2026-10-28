// F-CURR-002 §10 (row CM-5): the lesson chunks in the PWA build, and the precache report.
//
// scripts/build-lessons.mjs writes a start-loaded manifest and one content-hashed chunk per
// lesson cell (plus one title chunk per locale), each reached only through a literal `import()`.
// Metro web emits each chunk as its own bundle, `_expo/static/js/web/<name>-<md5>.js`, and the
// learner precache keeps every JS file. This module checks the result, the way the letter-clip
// gaps check (audio/lib.mjs `precacheGaps`) guards the clips:
//   - every manifest entry has exactly one bundle, named after it, that carries the manifest's
//     hash (`CHUNK_HASH`), whose file name is the md5 of its content, and that is precached;
//   - the start bundle names every hash (it was built from the same manifest) and carries no
//     chunk (a static import would pull one back in: Metro then leaves an empty bundle behind);
// and reports the start bundle, the chunks and the learner precache against their budget lines.
// Row CM-8 puts the story chunks of scripts/build-stories.mjs (one per story, the same hashing) through
// the same checks: pwa-postbuild.mjs passes both manifests, and the report counts each apart. Row CM-10
// adds the review-item chunk of scripts/build-review-items.mjs the same way, with its own budget line.
// Pure, apart from `md5`/`gzipSize` helpers; pwa-postbuild.mjs feeds it the built files.

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { headersFor, parseHeaders } from '../app-host/headers.mjs';

/** The web bundle folder of an Expo export, relative to dist. */
export const WEB_JS_DIR = '_expo/static/js/web';
const ENTRY = /^_expo\/static\/js\/web\/index-[0-9a-f]+\.js$/;
const NAMED = /^_expo\/static\/js\/web\/(.+)-([0-9a-f]{32})\.js$/;

/**
 * Budget lines of the learner build (F-CURR-002 §10 ceilings table and OD-5). Each is a reviewed
 * one-line change with the measured numbers in its PR.
 */
export const PRECACHE_BUDGET = Object.freeze({
  // The start bundle must not grow. The line is the latest measurement plus a rounding margin (the last entry below,
  // 4,750,000 B); the entries before it are its history. It began as the size after CM-8 moved the stories out
  // (6,345,469 B raw / 1,573,399 B gzip, the release build of CM-8's final code on CM-5's head, no recorded clips;
  // 7,337,815 B after CM-5, 8,321,783 B before CM-5) plus a 4,531 B rounding margin. A row that adds to it raises
  // this line with its measurement; the es / ko story overlays still in the start bundle leave it with row CM-8b,
  // before CM-46a adds narration. The phase-0 integration
  // (#802: CM-1 to CM-8, CM-70a, CM-70b on one branch) measures 6,371,165 B raw / 1,582,440 B gzip, so the line is that
  // measurement plus an 8,835 B rounding margin. [OA] The one-account integration (#801: OA-0b to OA-9 on main
  // 34e8f85d5) adds the chooser, PIN v2, people-on-this-device and the face or fingerprint shortcut to the shell:
  // 6,487,010 B raw / 1,616,887 B gzip, so the line was that measurement plus a 7,990 B rounding margin. SN-2 (#804) adds
  // the site page titles and descriptions, the share-card caption, the 404 lines and the longer privacy text to the
  // bundled `landing` messages: 6,495,681 B raw / 1,618,867 B gzip (release) and 6,495,837 B raw / 1,618,965 B gzip
  // (app-host) on 8eba8de96, against 6,491,702 B raw on main 52403c87b, so the line was 6,495,837 B plus an 8,163 B margin.
  // The final integration (integrate/final-oa-site: OA-7b #798, SN-1 #813 and SN-2 #804 on main 7eb5bad61) adds Who is
  // joining? to the shell and the site-entry strings to the bundled `landing` messages: 6,518,688 B raw / 1,624,797 B
  // gzip (release `build:web`), so the line was that measurement plus a 6,312 B rounding margin (6,525,000 B).
  // The start bundle shrink (F-CURR-002 §10 decision record) makes the es / ko messages and content overlays a precached
  // chunk per locale and the presenter and All lessons chunks of their own: 4,712,987 B raw / 1,237,660 B gzip on main
  // 7eb5bad61 (6,491,546 B before; 4,713,416 B raw after its review fixes); merged onto the final integration (main fc580beed, release `build:web`) it measures
  // 4,732,797 B raw / 1,243,089 B gzip, so the line was that measurement plus a 7,203 B rounding margin (4,740,000 B).
  // [GU] Row GU-2 adds the always-on guest rules (the gates, the marker, the anonymous telemetry, the boot sweep):
  // 4,744,234 B raw / 1,246,930 B gzip (release `build:web`; 4,734,519 B raw on GU-1), so the line was that plus 5,766 B;
  // 4,747,423 B raw / 1,247,894 B gzip with its review fixes (2,577 B left under the line; later GU rows load lazily).
  // [GU] Row GU-3 adds what must run before the first screen (the try intent, the launch's guest step, Welcome's waiting
  // card, the 16.1 strings); the guest's screens are a chunk of their own (SCREEN_CHUNKS, 7,673 B raw): 4,757,493 B raw /
  // 1,250,848 B gzip (release `build:web`), so the line was that plus 7,507 B; 4,759,347 B raw with its review fixes.
  // [GU] Row GU-4 adds the save's parts of the shared start screens (CreateProfile's guest steps and folded email, the
  // SaveGuest verify path of PinEntry, the first Home's bubble, Welcome's Add my name, the promotion for GU-D11) and the
  // 16.2 English strings; the save card and the Not now card stay in the guest's chunk (11,950 B raw): 4,767,105 B raw /
  // 1,253,769 B gzip (release `build:web`, cache cleared), so the line was that plus 7,895 B.
  // [GU] Row GU-5 adds the try trigger, the chooser's guest tiles, the owner's keep and the 16.3 English strings; the
  // grown-up side of an unsaved quest (People on this device's row, the guest-only gate) is a screen chunk of its own
  // (guest-keep-chunk, 5,381 B raw): 4,771,805 B raw / 1,255,131 B gzip (release `build:web`), and 4,774,256 B raw /
  // 1,255,798 B gzip merged onto the GU-4 review head (cache cleared), under GU-4's 4,775,000 B line, unchanged.
  // The Daily Review (F-CURR-002 row CM-14, on CM-13's head: rows CM-10 to CM-14) keeps its screen, rounds, session
  // logic and the review engine in chunks; what stays is the route, Home's hook and card, the boot module's
  // memoryChunk() and the English strings: 4,744,598 B raw / 1,247,230 B gzip (release `build:web` with the review
  // fixes; 4,743,992 B before them), so the line was that measurement plus a 5,402 B rounding margin (4,750,000 B).
  // CM-15 (the quest warm-up and Try these again) measured 4,744,698 B raw on CM-13's head (sessions and round view in
  // a chunk of their own, planning in the memory chunk), CM-16 (the summary memory block) 4,742,801 B on CM-12's head
  // and CM-17 (goals, in a learner chunk of their own) 4,739,306 B on main. The F-CURR-002 phase-1 integration
  // (integrate/curr-phase1: CM-10 to CM-17 on main 82237b684) measures 4,760,960 B raw / 1,253,023 B gzip (release
  // `build:web`), so the line was that measurement plus a 9,040 B rounding margin (4,770,000 B).
  // [GU] The guest first quest integration (integrate/guest-gu1-6: GU-0b to GU-6, switch and site claim off, on main
  // ece5eee02 with the phase-1 integration) measures 4,804,191 B raw / 1,265,853 B gzip (release `build:web`, Metro cache
  // cleared): main's 4,760,960 B plus the guest rows' 41,459 B (4,774,256 B on GU-5 against 4,732,797 B on its main),
  // 1,772 B over that sum. The line is that measurement plus a 5,809 B rounding margin.
  // CM-21 (the Cell Check: the cell page's slot, the route, the Tested out pill, routeNext's skip and 19 English strings;
  // block, screen and logic in chunks) measures 4,809,323 B raw / 1,268,690 B gzip (release `build:web`), 189 B under
  // main with CM-20 (4,809,512 B): its cost is paid by importing React's hooks by name in the start-bundle modules it
  // touches (no `import React, {...}` wildcard helper), so the line stays.
  // CM-22 (Stages 2-7: the prize table, the Results prize, the gate, three routes and two slots, 16 English strings;
  // every stage's prize ceremony, Stage 1's included, the check, the summary and its trigger in the stage-check chunk)
  // measures 4,806,089 B raw / 1,268,793 B gzip (release `build:web`), 3,234 B under CM-21's 4,809,323 B: the line stays.
  // CM-23 part 1 (the eight upper-cell cards of Stages 2-3: their fronts, the `upperCards` gate on the award world, the
  // first-finish dating, the reconcile wiring and the album strings; the card backs, the ten drawings and the Library's
  // albums are the upper-cards chunk) measures 4,809,851 B raw / 1,270,481 B gzip on CM-22's 4,806,089 B, with the
  // touched start-bundle modules importing React's hooks by name: the line stays.
  // The F-CURR-002 phase-2 integration (integrate/curr-phase2: CM-20 #837, CM-21 #840, CM-22 #842, CM-23a #843,
  // CM-23b #844, CM-25 #841 and CM-24 #838 on main 836bfcd6f) measures 4,812,581 B raw / 1,272,017 B gzip (release
  // `build:web`, Metro cache cleared), 2,581 B over the 4,810,000 B line, so the line is that measurement plus a
  // 419 B rounding margin (4,813,000 B); the app-host build (grown-up home on, API base set) measures 4,812,737 B.
  // Named React imports (perf(mobile,design-system), the helper the CM-21 decision record left open): the app's and
  // the design system's modules import React's hooks and types by name, react-native-svg's root as the named `Svg`
  // and expo-crypto by name, so 142 of the 153 first-party start-bundle modules that inlined Babel's wildcard interop
  // helper (about 464 B each) no longer do; of the 11 left, 10 import react-native-reanimated's default `Animated`
  // beside its hooks and one (content/stories.ts) reads the generated story index as a namespace
  // (scripts/__tests__/named-react-imports.test.mjs keeps the rest out). On main 150c07383 the release
  // `build:web` (Metro cache cleared) measures 4,742,691 B raw / 1,263,763 B gzip, 69,890 B raw under 4,812,581 B;
  // the app-host build 4,742,847 B. The line is the release measurement plus a 7,309 B rounding margin.
  // CM-23c (Stages 6-7 upper-cell cards, the five legendary cards and their album sets, #845) on main e31bc3b33
  // (#859 to #862 on the named React imports, 4,749,283 B, +6,592 B) measures 4,751,444 B raw / 1,266,428 B gzip
  // (release `build:web`, Metro cache cleared), +2,161 B over that main, the same +2,161 B it measured on main
  // 2851bac3b; the app-host build 4,751,600 B. The line is the release measurement plus an 8,556 B rounding margin.
  // CM-30 (Cloze Pick: the `cloze-pick` round and scope schema with its cross-checks, the lecture mapping, Listen &
  // Pick's text prompt mode, the door, the Listen & Pick fallback with its card and round helpers (in the start bundle
  // so the switch never depends on the chunk it guards) and 10 English strings; the game, its flow and its view are
  // the cloze-pick-chunk) measures 4,762,235 B raw / 1,269,443 B gzip (release `build:web`, Metro cache cleared)
  // on main 524961dae, whose own release build measures 4,751,444 B raw: +10,791 B. The line is that measurement plus a
  // 2,765 B rounding margin.
  startBundleRaw: 4_765_000,
  // Each locale chunk (the es or ko UI messages and content overlays; src/content/locale-chunks): a Spanish or Korean
  // learner waits for theirs before the first screen, and every es / ko string and story overlay grows it. Measured at
  // the start bundle shrink: ko 901,191 B, es 527,438 B raw (ko 905,927 B, es 530,463 B with the final integration's
  // strings, main fc580beed; ko 925,171 B, es 542,657 B on main 8dfb8a43c). The line left about 99 KB for the stories
  // and strings ahead (CM-46a, CM-46) at the shrink, about 94 KB on the final integration and about 75 KB on main
  // 8dfb8a43c; a PR that crosses it raises it as a reviewed one-line change with its measurement, or moves text out
  // (CM-8b's story overlay split).
  localeChunkRaw: 1_000_000,
  // Each grown-up root chunk (the presenter, All lessons): measured at the start bundle shrink: PresenterApp 245,964 B,
  // BrowseApp 111,404 B raw, so the line was the presenter plus about 54 KB; with named React imports (main 8dfb8a43c)
  // PresenterApp 232,574 B, BrowseApp 104,116 B, about 67 KB under the line.
  rootChunkRaw: 300_000,
  // [GU] Each learner screen chunk (row GU-3: the guest's first quest stack, `src/navigation/guest-chunk.tsx`), loaded
  // the first time its screens open. Measured when GU-3 landed (see SCREEN_CHUNKS); the line leaves room for GU-4's
  // save screens, which join the same chunk.
  screenChunkRaw: 60_000,
  // The learner precache measured after CM-5 (8,787,329 B, 35 files, the release build, no recorded clips) + 2.5 MB;
  // crossing it triggers CM-5B (Save for offline). On main 8dfb8a43c it measures 9,361,858 B (77 files, no recorded
  // clips), 1,925,471 B under the line. The jamo recordings re-measure it when they land (F-CURR-002 §10).
  learnerPrecacheRaw: 11_287_329,
  // The story lines of scripts/build-stories.mjs `BUDGET` (perStoryRaw, totalRaw, totalGzip), held on the built story
  // bundles too, which are what the service worker caches: a built bundle is about 13% larger than its generated
  // module (CM-8: 983,601 B built against 869,644 B of modules). The test keeps the two sets of lines equal.
  storyChunkRaw: 70_000,
  storiesRaw: 2_000_000,
  storiesGzip: 510_000,
  // The review-item index (F-CURR-002 §4.2, §10 ceilings table, row CM-10): one content-hashed chunk of
  // scripts/build-review-items.mjs, lazy and precached, held here on its built bundle and there on its module
  // (`BUDGET`, the same lines; the test keeps them equal). Measured at CM-10's first cut: 728 items, 94,162 B raw /
  // 19,597 B gzip as generated, 101,969 B raw / 19,256 B gzip as built (release `build:web`); with CM-10's review
  // fixes (the Stage 1 Discover words) 733 items, 97,670 B raw / 20,024 B gzip as generated, 105,189 B raw /
  // 19,475 B gzip as built; on main 8dfb8a43c 733 items, 105,189 B raw / 19,478 B gzip as built.
  reviewItemsRaw: 150_000,
  reviewItemsGzip: 30_000,
});

export const md5 = (text) => createHash('md5').update(text, 'utf8').digest('hex');
export const gzipSize = (text) => gzipSync(text).length;

export const isStartBundle = (url) => ENTRY.test(url);

const carries = (text, hash) => new RegExp(`CHUNK_HASH\\s*=\\s*["']${hash}["']`).test(text);

/**
 * Problems with the lesson chunks of one web build (empty = sound).
 * @param {{ manifest: { name: string, hash: string }[], bundles: { url: string, text: string }[], precached: string[] }} input
 *   `manifest`: build-lessons.mjs `chunkManifest`; `bundles`: every JS file of WEB_JS_DIR; `precached`: the precache URLs.
 */
export function lessonChunkProblems({ manifest, bundles, precached }) {
  const problems = [];
  const listed = new Set(precached.map((u) => u.replace(/^\/+/, '')));
  const starts = bundles.filter((b) => isStartBundle(b.url));
  if (starts.length !== 1) problems.push(`expected one start bundle (${WEB_JS_DIR}/index-<hash>.js), found ${starts.length}`);
  for (const { name, hash } of manifest) {
    for (const start of starts) {
      if (carries(start.text, hash)) problems.push(`${name} is in the start bundle ${start.url}: a static import pulled the chunk in`);
      if (!start.text.includes(`"${hash}"`)) problems.push(`the start bundle ${start.url} does not name ${name}'s hash ${hash}: the shell and the chunk come from other content`);
    }
    const own = bundles.filter((b) => !isStartBundle(b.url) && NAMED.exec(b.url)?.[1] === name);
    if (own.length === 0) {
      problems.push(`${name} has no web bundle: the chunk is missing from the build`);
      continue;
    }
    if (own.length > 1) problems.push(`${name} has ${own.length} web bundles: ${own.map((b) => b.url).join(', ')}`);
    for (const bundle of own) {
      if (!carries(bundle.text, hash)) problems.push(`${bundle.url} does not carry ${hash}, the hash the manifest names for ${name}`);
      if (NAMED.exec(bundle.url)?.[2] !== md5(bundle.text)) problems.push(`${bundle.url}: its file name is not the md5 of its content`);
      if (!listed.has(bundle.url)) problems.push(`${bundle.url} is missing from the precache`);
    }
  }
  return problems;
}

/**
 * The locale chunks of the learner PWA (F-CURR-002 §10): one web bundle per UI locale but English, holding that
 * locale's UI messages and content overlays (`src/content/locale-chunks/locale-<locale>.ts`), reached only through
 * the literal `import()`s of `src/platform/locale-packs.web.ts`. Each exports its marker (`LOCALE_PACK`), which
 * the start bundle must never carry.
 */
export const LOCALE_CHUNKS = Object.freeze([
  Object.freeze({ name: 'locale-es', marker: 'locale-pack:es' }),
  Object.freeze({ name: 'locale-ko', marker: 'locale-pack:ko' }),
]);

/**
 * The grown-up roots of the learner web build (F-CURR-002 §10): the presenter (`/present`) and All lessons
 * (`/browse`) are bundles of their own, reached only through the literal `import()`s of `index.ts`, so a
 * learner's start bundle carries neither. Each root module exports its marker (`ROOT_CHUNK`).
 */
export const ROOT_CHUNKS = Object.freeze([
  Object.freeze({ name: 'PresenterApp', marker: 'root-chunk:presenter' }),
  Object.freeze({ name: 'BrowseApp', marker: 'root-chunk:browse' }),
]);

/**
 * The memory store of the learner PWA (F-CURR-002 row CM-12): its runtime (the scheduler, the seeding, the sync and
 * `memory.daily`) is a bundle of its own, reached only through the literal `import()` of `src/logic/memory/boot.ts`,
 * so the start bundle carries none of it. The chunk module exports its marker (`MEMORY_CHUNK`).
 */
export const MEMORY_CHUNKS = Object.freeze([Object.freeze({ name: 'memory-chunk', marker: 'memory-chunk:runtime' })]);

/**
 * The Daily Review of the learner PWA (F-CURR-002 row CM-14): its screen and rounds are a bundle of their own, reached
 * only through the literal `import()` of `src/screens/reviews/DailyReviewRoute.tsx`, so the start bundle carries none
 * of it. Its session logic and the review engine live in the memory chunk (`MEMORY_CHUNKS`, through
 * `logic/memory/memory-chunk.ts`), so no scheduler module is shared by two chunks. The chunk module exports its marker
 * (`DAILY_REVIEW_CHUNK`).
 */
export const REVIEW_CHUNKS = Object.freeze([Object.freeze({ name: 'daily-review-chunk', marker: 'review-chunk:daily' })]);

/**
 * The quest warm-up and Try these again (F-CURR-002 row CM-15): the sessions and the round view are a bundle of
 * their own (the review engine and the planning ride in the memory chunk), reached only through the literal `import()` of `src/screens/quest/quest-reviews.ts`
 * while `questWarmup` or `missedPractice` is on, so the start bundle carries none of it. The chunk module exports its
 * marker (`QUEST_REVIEW_CHUNK`).
 */
export const QUEST_REVIEW_CHUNKS = Object.freeze([Object.freeze({ name: 'quest-review-chunk', marker: 'quest-review-chunk:session' })]);

/**
 * The learner chunks a switch loads (F-CURR-002 §10): the daily and weekly goals (row CM-17,
 * `src/screens/goals/goals-chunk.ts`) are a bundle of their own, reached only through the literal `import()` of
 * `src/store/goals-entry.ts`, so a learner with `goals` off never loads them and the start bundle does not grow.
 */
export const LEARNER_CHUNKS = Object.freeze([
  Object.freeze({ name: 'goals-chunk', marker: 'goals-chunk:goals' }),
  // Row CM-20: the mastery ring and the Results banners (`src/screens/mastery/mastery-chunk.ts`), reached only through
  // the literal `import()` of `src/store/mastery-entry.ts` while `mastery` is on; the level derivation is the memory chunk's.
  Object.freeze({ name: 'mastery-chunk', marker: 'mastery-chunk:ui' }),
  // Adaptive pacing in quests (row CM-24, `src/screens/quest/quest-pacing-chunk.tsx`): the rules, the shorter Apply and
  // the scaffold round, reached only through the literal `import()` of `src/screens/quest/quest-pacing.ts` while
  // `questAdapt` is on.
  Object.freeze({ name: 'quest-pacing-chunk', marker: 'quest-pacing-chunk:adapt' }),
]);

/**
 * [GU] The learner screens that are chunks of their own (F-CURR-002 §10, row GU-3): the guest's first quest stack
 * (`src/navigation/guest-chunk.tsx`), reached only through the literal `import()` of `src/navigation/guest.tsx`, so
 * the start bundle carries none of its screens. Its module exports its marker (`SCREEN_CHUNK`).
 */
export const SCREEN_CHUNKS = Object.freeze([
  Object.freeze({ name: 'guest-chunk', marker: 'screen-chunk:guest' }),
  // [GU] Row GU-5: the grown-up side of an unsaved first quest (`src/screens/parent/guest-keep-chunk.tsx`, reached only
  // through the literal `import()` of `src/screens/parent/guest-keep.tsx`): People on this device's first-quest row and
  // the guest-only gate on PIN setup.
  Object.freeze({ name: 'guest-keep-chunk', marker: 'screen-chunk:guest-keep' }),
  // F-CURR-002 row CM-21: the Cell Check's block, Test out line and screen (`src/screens/cell-check/cell-check-chunk.tsx`,
  // reached only through the literal `import()` of `src/screens/cell-check/cell-check-entry.tsx`); the session logic is
  // the memory chunk's and the rounds the Daily Review chunk's, each reached at run time.
  Object.freeze({ name: 'cell-check-chunk', marker: 'screen-chunk:cell-check' }),
  // F-CURR-002 row CM-22: every stage's prize ceremony (Stage 1's included), the Stage Check, the one retroactive
  // summary and Home's trigger for it, and the Journey header's extras (`src/screens/stage-check/stage-check-chunk.tsx`, reached only through the literal `import()` of
  // `src/screens/stage-check/stage-check-entry.tsx`); the session logic is the memory chunk's.
  Object.freeze({ name: 'stage-check-chunk', marker: 'screen-chunk:stage-check' }),
  // F-CURR-002 row CM-23: the upper-cell card drawings, their backs and the Library's category albums
  // (`src/screens/library/upper-cards-chunk.tsx`, reached only through the literal `import()` of
  // `src/screens/library/upper-cards-entry.tsx`).
  Object.freeze({ name: 'upper-cards-chunk', marker: 'screen-chunk:upper-cards' }),
  // F-CURR-002 row CM-30: the Cloze Pick game, its flow and its prompt view (`src/screens/minigames/cloze-pick-chunk.tsx`,
  // reached only through the literal `import()` of `src/screens/minigames/cloze-pick-entry.tsx` while `game.cloze-pick`
  // is on); its Listen & Pick fallback (`cloze-pick-fallback.tsx`, with the card and the round helpers) stays in the
  // start bundle, so a step plays it with the switch off or the chunk unable to load.
  Object.freeze({ name: 'cloze-pick-chunk', marker: 'screen-chunk:cloze-pick' }),
  // F-CURR-002 row CM-34: the Story Order game (`src/screens/minigames/story-order/story-order-chunk.tsx`, reached only
  // through the literal `import()` of `src/screens/minigames/story-order/StoryOrderStep.tsx`), loaded while
  // `game.story-order` is on; off, its rounds play as Story Sequence, in the start bundle already.
  Object.freeze({ name: 'story-order-chunk', marker: 'screen-chunk:story-order' }),
  // F-CURR-002 row CM-35: the Role Play game, its branch reducer and views (`src/screens/minigames/role-play/role-play-chunk.tsx`,
  // reached only through the literal `import()` of `src/screens/minigames/role-play/role-play-entry.tsx` while
  // `game.role-play` is on); its fallback (Tap to Respond on the same turns) stays in the start bundle.
  Object.freeze({ name: 'role-play-chunk', marker: 'screen-chunk:role-play' }),
]);

/**
 * Problems with the marked chunks of one web build (the locale chunks and the grown-up roots; empty = sound): each
 * has exactly one bundle, named after it, whose file name is the md5 of its content, that carries its marker and is
 * precached, and no start bundle carries a marker (a static import would pull the chunk back in: Metro then leaves
 * an empty bundle behind).
 * @param {{ chunks?: readonly { name: string, marker: string }[], bundles: { url: string, text: string }[], precached: string[] }} input
 */
export function markedChunkProblems({ chunks = [...LOCALE_CHUNKS, ...ROOT_CHUNKS, ...SCREEN_CHUNKS], bundles, precached }) {
  const problems = [];
  const listed = new Set(precached.map((u) => u.replace(/^\/+/, '')));
  const starts = bundles.filter((b) => isStartBundle(b.url));
  for (const { name, marker } of chunks) {
    const quoted = [`"${marker}"`, `'${marker}'`];
    for (const start of starts) {
      if (quoted.some((q) => start.text.includes(q))) problems.push(`${name} is in the start bundle ${start.url}: a static import pulled it in`);
    }
    const own = bundles.filter((b) => !isStartBundle(b.url) && NAMED.exec(b.url)?.[1] === name);
    if (own.length === 0) {
      problems.push(`${name} has no web bundle: the chunk is missing from the build`);
      continue;
    }
    if (own.length > 1) problems.push(`${name} has ${own.length} web bundles: ${own.map((b) => b.url).join(', ')}`);
    for (const bundle of own) {
      if (!quoted.some((q) => bundle.text.includes(q))) problems.push(`${bundle.url} does not carry ${marker}: it is not ${name}'s chunk (or it is empty)`);
      if (NAMED.exec(bundle.url)?.[2] !== md5(bundle.text)) problems.push(`${bundle.url}: its file name is not the md5 of its content`);
      if (!listed.has(bundle.url)) problems.push(`${bundle.url} is missing from the precache`);
    }
  }
  return problems;
}

/**
 * Lesson chunk bundles that the host's `_headers` rules would serve with `X-Content-Type-Options: nosniff`
 * (empty = none). A page of an older build that asks for a chunk the host no longer has gets the app's HTML
 * page (the single-page fallback, 200); without nosniff the browser runs it, Metro finds no module in it and
 * the page reloads onto the new build. With nosniff the browser refuses it as a script error, which the app
 * then has to tell from a network failure by asking the URL again (`platform/new-build-reload.web.ts`). The
 * check keeps the plain path the one in use: a `/*` or `/_expo/*` nosniff rule fails the build.
 * @param {string} headersText the content of `dist/_headers` ('' when there is none)
 * @param {string[]} chunkUrls the lesson chunk bundles, relative to dist (`_expo/static/js/web/<name>-<md5>.js`)
 */
export function nosniffLessonChunks(headersText, chunkUrls) {
  const rules = parseHeaders(headersText);
  return chunkUrls.filter((url) => /\bnosniff\b/i.test(headersFor(rules, `/${url.replace(/^\/+/, '')}`)['x-content-type-options'] ?? ''));
}

/** The lesson chunk bundles of a build: every bundle named after a manifest entry. */
export function lessonChunkUrls(manifest, bundles) {
  const names = new Set(manifest.map((m) => m.name));
  return bundles.filter((b) => !isStartBundle(b.url) && names.has(NAMED.exec(b.url)?.[1] ?? '')).map((b) => b.url);
}

const bytes = (text) => Buffer.byteLength(text, 'utf8');

/** Count, raw and gzip bytes of the bundles of these manifest entries, and the largest of them (null when none). */
function chunkTotals(manifest, bundles) {
  const names = new Set(manifest.map((m) => m.name));
  const chunks = bundles.filter((b) => !isStartBundle(b.url) && names.has(NAMED.exec(b.url)?.[1] ?? ''));
  let largest = null;
  for (const b of chunks) {
    const raw = bytes(b.text);
    if (largest === null || raw > largest.raw) largest = { url: b.url, raw };
  }
  return { count: chunks.length, raw: chunks.reduce((s, b) => s + bytes(b.text), 0), gzip: chunks.reduce((s, b) => s + gzipSize(b.text), 0), largest };
}

/**
 * The precache report: the start bundle, the lesson chunks, the story chunks (row CM-8), the locale chunks, the grown-up
 * root chunks, the review-item chunk (row CM-10), the learner screen chunks (row GU-3) and the whole learner precache.
 * @param {{ manifest: { name: string }[], stories?: { name: string }[], locales?: readonly { name: string }[], roots?: readonly { name: string }[], reviewItems?: { name: string }[], screens?: readonly { name: string }[], bundles: { url: string, text: string }[], precache: { count: number, size: number } }} input
 */
export function precacheReport({ manifest, stories = [], locales = [], roots = [], reviewItems = [], screens = [], bundles, precache }) {
  const start = bundles.find((b) => isStartBundle(b.url));
  return {
    start: start === undefined ? null : { url: start.url, raw: bytes(start.text), gzip: gzipSize(start.text) },
    lessonChunks: chunkTotals(manifest, bundles),
    storyChunks: chunkTotals(stories, bundles),
    localeChunks: chunkTotals(locales, bundles),
    rootChunks: chunkTotals(roots, bundles),
    reviewItemChunks: chunkTotals(reviewItems, bundles),
    screenChunks: chunkTotals(screens, bundles),
    precache: { count: precache.count, raw: precache.size },
  };
}

/** The report as printed lines. */
export function reportLines(report, budget = PRECACHE_BUDGET) {
  const lines = ['pwa-postbuild: precache report (F-CURR-002 §10)'];
  if (report.start !== null) {
    lines.push(`  start bundle  ${report.start.url}  ${report.start.raw} B raw  ${report.start.gzip} B gzip  (ceiling ${budget.startBundleRaw} B raw)`);
  }
  lines.push(`  lesson chunks  ${report.lessonChunks.count} bundles  ${report.lessonChunks.raw} B raw  ${report.lessonChunks.gzip} B gzip`);
  if (report.storyChunks !== undefined) {
    lines.push(`  story chunks  ${report.storyChunks.count} bundles  ${report.storyChunks.raw} B raw  ${report.storyChunks.gzip} B gzip`);
  }
  if (report.localeChunks !== undefined && report.localeChunks.count > 0) {
    lines.push(
      `  locale chunks  ${report.localeChunks.count} bundles  ${report.localeChunks.raw} B raw  ${report.localeChunks.gzip} B gzip  (largest ${report.localeChunks.largest?.raw ?? 0} B raw, ceiling ${budget.localeChunkRaw} B each)`,
    );
  }
  if (report.rootChunks !== undefined && report.rootChunks.count > 0) {
    lines.push(
      `  grown-up root chunks  ${report.rootChunks.count} bundles  ${report.rootChunks.raw} B raw  ${report.rootChunks.gzip} B gzip  (largest ${report.rootChunks.largest?.raw ?? 0} B raw, ceiling ${budget.rootChunkRaw} B each)`,
    );
  }
  if (report.reviewItemChunks !== undefined && report.reviewItemChunks.count > 0) {
    lines.push(
      `  review-item chunk  ${report.reviewItemChunks.count} bundles  ${report.reviewItemChunks.raw} B raw  ${report.reviewItemChunks.gzip} B gzip  (ceiling ${budget.reviewItemsRaw} B raw, ${budget.reviewItemsGzip} B gzip)`,
    );
  }
  if (report.screenChunks !== undefined && report.screenChunks.count > 0) {
    lines.push(
      `  learner screen chunks  ${report.screenChunks.count} bundles  ${report.screenChunks.raw} B raw  ${report.screenChunks.gzip} B gzip  (largest ${report.screenChunks.largest?.raw ?? 0} B raw, ceiling ${budget.screenChunkRaw} B each)`,
    );
  }
  lines.push(`  learner precache  ${report.precache.count} files  ${report.precache.raw} B  (ceiling ${budget.learnerPrecacheRaw} B)`);
  return lines;
}

/**
 * True on the deploy's own build (Cloudflare Workers Builds sets `WORKERS_CI`, Pages `CF_PAGES`):
 * there `--budget` only warns. A budget line is a review gate on the pull request (web-app.yml runs
 * the same `build:web` before a merge); it must never stop a deploy, a hotfix least of all. The chunk
 * checks above always fail the build, deploy or not: a broken chunk would break the app.
 */
export const budgetIsAdvisory = (env) => Boolean(env.WORKERS_CI || env.CF_PAGES);

/** Budget problems of the report (empty = within budget). */
export function precacheBudgetProblems(report, budget = PRECACHE_BUDGET) {
  const problems = [];
  if (report.start === null) problems.push('no start bundle to measure');
  else if (report.start.raw > budget.startBundleRaw) {
    problems.push(
      `the start bundle is ${report.start.raw} B raw, over its ceiling of ${budget.startBundleRaw} B: it must not grow ` +
        '(move the code out of the start bundle, or raise PRECACHE_BUDGET.startBundleRaw in apps/mobile/scripts/pwa/lesson-chunks.mjs as a reviewed one-line change with the measured numbers in the PR)',
    );
  }
  const stories = report.storyChunks;
  if (stories !== undefined) {
    const raise = '(raise it in scripts/build-stories.mjs BUDGET and PRECACHE_BUDGET together, as a reviewed one-line change with the measured numbers in the PR)';
    if (stories.largest !== null && stories.largest !== undefined && stories.largest.raw > budget.storyChunkRaw) {
      problems.push(`the story bundle ${stories.largest.url} is ${stories.largest.raw} B raw, over the per-story ceiling of ${budget.storyChunkRaw} B ${raise}`);
    }
    if (stories.raw > budget.storiesRaw) {
      problems.push(`the story bundles are ${stories.raw} B raw, over the stories ceiling of ${budget.storiesRaw} B ${raise}`);
    }
    if (stories.gzip > budget.storiesGzip) {
      problems.push(`the story bundles are ${stories.gzip} B gzip, over the stories ceiling of ${budget.storiesGzip} B gzip ${raise}`);
    }
  }
  const ceilings = [
    [report.localeChunks, budget.localeChunkRaw, 'locale', 'localeChunkRaw'],
    [report.rootChunks, budget.rootChunkRaw, 'grown-up root', 'rootChunkRaw'],
    [report.screenChunks, budget.screenChunkRaw, 'learner screen', 'screenChunkRaw'],
  ];
  for (const [chunks, ceiling, kind, line] of ceilings) {
    const largest = chunks?.largest;
    if (largest !== null && largest !== undefined && largest.raw > ceiling) {
      problems.push(
        `the ${kind} bundle ${largest.url} is ${largest.raw} B raw, over the per-${kind} ceiling of ${ceiling} B ` +
          `(raise PRECACHE_BUDGET.${line} in apps/mobile/scripts/pwa/lesson-chunks.mjs as a reviewed one-line change with the measured numbers in the PR)`,
      );
    }
  }
  const reviewItems = report.reviewItemChunks;
  if (reviewItems !== undefined) {
    const raise = '(raise it in scripts/build-review-items.mjs BUDGET and PRECACHE_BUDGET together, as a reviewed one-line change with the measured numbers in the PR)';
    if (reviewItems.raw > budget.reviewItemsRaw) problems.push(`the review-item bundle is ${reviewItems.raw} B raw, over its ceiling of ${budget.reviewItemsRaw} B ${raise}`);
    if (reviewItems.gzip > budget.reviewItemsGzip) problems.push(`the review-item bundle is ${reviewItems.gzip} B gzip, over its ceiling of ${budget.reviewItemsGzip} B gzip ${raise}`);
  }
  if (report.precache.raw > budget.learnerPrecacheRaw) {
    problems.push(
      `the learner precache is ${report.precache.raw} B, over its ceiling of ${budget.learnerPrecacheRaw} B: row CM-5B (Save for offline) is triggered`,
    );
  }
  return problems;
}
