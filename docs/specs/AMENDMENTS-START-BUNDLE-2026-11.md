# AMENDMENTS-START-BUNDLE-2026-11 — the start bundle sheds two kinds of dead weight

Status: ready (owner decision 2026-11-24, in session: make the two behaviour-neutral cuts of the start bundle analysis; the games chunk waits for a later decision)

**Amends**: `AMENDMENTS-FINISH-2026-11.md` FN-7 (the learner web English twin keeps all of `console`; the start bundle line `PRECACHE_BUDGET.startBundleRaw`) · F-STORY-002 §5 (how a fixture build switches on its e2e entry) · tag **[SB]**
**Not amended**: any screen, string value, translation or review ledger entry. No learner or grown-up sees a change.
**Scope**: `packages/i18n/src/messages/en/index.web.ts` and a new `packages/i18n/src/messages/en/console-app.ts`; `apps/mobile/src/navigation/root.tsx`, the e2e hook and screen modules in `apps/mobile/src/navigation/*-e2e*.tsx`, `apps/mobile/src/screens/minigames/cloze-pick-entry.tsx`; `scripts/build-stories.mjs` (one more generated module); `apps/mobile/scripts/pwa/lesson-chunks.mjs` (the start bundle line); the tests of each row
**Owner**: solo dev
**Rollout**: next release

---

## 1. Context

Since FN-7 (4,570,041 B raw) the start bundle has grown by about 64 KB to 4,634,508 B raw (main `f31c6b313`, release `build:web`, CI=1), and the line `PRECACHE_BUDGET.startBundleRaw` has followed it to 4,638,500 B. A source-map analysis of that build (2026-11-24) found the growth is mostly first-screen and shared-kit code that cannot move cheaply, but two large pieces in the entry are never used by the release web app:

1. **The `console` namespace of the web English twin.** `packages/i18n/src/messages/en/index.web.ts` (FN-7 step 4) blanks `landing` but keeps all of `en/console.ts`, 75,845 B of the entry, the largest first-party module. The web build of the learner app (every non-`.native` source of `apps/mobile`) reads only six console paths: `transfer.consent` (consent sheet, Approve transfer, Move class), `parentHome.lastActive.notStarted`, `parentHome.minutes7d` and `space.learner.lastActive` (the grown-up home rows, `logic/account/homes.ts`), `placement.startingSpot` (`logic/reports/report-view.ts`) and `confirm.remove` (People on this device). Every other console read is in a `.native` screen, which the web build never bundles; the native app, Next and Node read `index.ts`, which is unchanged.
2. **The e2e hooks and screens.** `navigation/root.tsx` statically imports twelve `*-e2e.tsx` modules (and the Cloze Pick door's two e2e exports) and renders them behind `STORY_FIXTURES_BUILD`, a value read at run time (`storyFixtureIds.length > 0`), so Metro cannot drop them. In a release build they are dead: about 20 KB of hooks, screens and fixture rounds, plus `logic/trace-word/block-strokes.ts` (5.3 KB), which they fold into the entry because the Trace a Word chunk shares it. A build with those imports removed measured 27,563 B smaller.

FN-7 kept `console` because moving its keys "means new translated keys and a re-signed review ledger". This amendment moves no key: the paths stay where they are, `en/console.ts` is not edited (so its ledger `enSha` stays current), and only the web twin holds fewer of them.

## 2. User story

> As a learner opening the app on a slow phone, I wait for less code before the first screen, and nothing on any screen changes.

## 3. Rows

**SB-0 This amendment.** Docs only.
*Done when:* merged, status ready.

**SB-1 The web twin carries only the console strings the web app reads.**
A new `packages/i18n/src/messages/en/console-app.ts` holds exactly the six web-read subtrees, at the same paths and with the same values as `en/console.ts` (strings equal, functions with the same source), and nothing else. `index.web.ts` uses it for `console` instead of `consoleMsgs`; the cast to `typeof English` stays, as for `landing`. `en/console.ts`, `index.ts`, es, ko and the ledger are not touched. A merged es or ko locale walks the English keys (`getMessages`), so on the web it carries the same six subtrees.
*Tests:* (a) a reader test in `apps/mobile` (next to the `landing` test of `start-bundle-content.test.ts`) collects every `.console.<path>` read in the web build's sources (every `.ts`/`.tsx` under `apps/mobile/src` and the app entries, tests and `.native` files excluded, comments stripped) and fails if a read path is missing from the twin, or if a source reads the namespace whole (`.console` not followed by a key); (b) a test in `packages/i18n` that `console-app.ts` is exactly the picked subtrees of `consoleMsgs` (same keys, equal strings, functions with equal source and equal output on sample arguments) and holds no other key, and that the read set of (a) and the twin's top-level paths match, so a path that stops being read is removed too; (c) the start graph no longer reaches `en/console.ts`.
*Done when:* the tests pass, the web e2e that show console strings in the learner app (`people-remove.spec.ts`, `transfer-moves.spec.ts`) still pass, and the release `build:web` before and after is recorded (estimate: about -65 to -70 KB).

**SB-2 A release build has no e2e code.**
The e2e hooks and screens reach `root.tsx` only through a generated registry, `apps/mobile/src/content/__generated__/e2e-registry.tsx`, written by `scripts/build-stories.mjs` beside `STORY_FIXTURE_IDS` and gitignored like the other generated modules: a plain run (every `pnpm generate`, `build:web`, CI and deploy) writes an empty registry (no hooks, no screens, no import); `--include-fixtures` (only `build:web:fixtures`, which always restores the plain modules afterwards) writes one that imports the twelve e2e modules and the Cloze Pick e2e hook and screen. The two Cloze Pick e2e exports move out of the door (`cloze-pick-entry.tsx`) to the e2e side, so the door no longer carries them. `root.tsx` mounts the registry's hooks and registers its screens (with the same route names); `STORY_FIXTURES_BUILD` is no longer read by `root.tsx`. The specs keep finding `window.__hr*E2E` on a fixture build: they already wait for it.
*Tests:* (a) the start graph test: no module whose name ends in `-e2e`, `-e2e-screen`, `-e2e-fixture(s)` or `e2e-rounds` is in the release start graph, and `logic/trace-word/block-strokes.ts` is not either; (b) `build-stories.test.mjs`: the plain modules include an empty registry with no import, the fixture modules a registry that imports every e2e hook and screen module root used to import, and `--check` covers the registry; (c) a `root.tsx` test or the existing navigation tests show the routes register from the registry; (d) on a fixture build (`build:web:fixtures`), the e2e specs that use the hooks pass: at least story-reader, placement-screens, vocab-question, sentence-builder, sentence-builder-cloze-pick, sentence-builder-role-play, realia-read, realia-read-hidden-heritage, type-hangul, type-hangul-tap-board, trace-word, write-frame and story-order.
*Done when:* the tests pass and the release `build:web` before and after is recorded (estimate: about -25 to -27.6 KB).

**SB-3 The start bundle line follows the measurement.**
After SB-1 and SB-2, `PRECACHE_BUDGET.startBundleRaw` goes down to the measured release `build:web` (CI=1) plus about 4 KB, with the measurement written above the line (the FN-7 rule: a line moves only to a measured number). The test in `lesson-chunks.test.mjs` pins the new value, adds the new measurements to the list that must fit, and restores the gap to the measurements before FN-7 as far as the new line allows (it was 150 KB at FN-7 and has been lowered row by row to 110 KB). Finishing: the index line in `docs/specs/README.md`, an "Amended by" line in `AMENDMENTS-FINISH-2026-11.md` FN-7, and the As built section below.
*Done when:* the budget test passes and the release build's post-build budget check passes on the new line.

Each row is its own pull request with its own measurement; SB-3 may ride in SB-2's pull request.

## 4. Verification (every code row)

`apps/mobile`: `TZ=UTC pnpm test`; `packages/i18n` tests; root `pnpm exec turbo run lint typecheck build`; `node scripts/check-i18n.mjs` and `node scripts/i18n-status.mjs` (no new warning: `en/console.ts`'s `enSha` stays current); release `CI=1 pnpm --filter @hangul-route/mobile build:web` before and after, numbers in the pull request and in the comment above `startBundleRaw` in `apps/mobile/scripts/pwa/lesson-chunks.mjs`; SB-2 also the hook e2e above against `build:web:fixtures`. CI does not run while the repository is private; results are recorded in each pull request and in As built.

## 5. Not in this amendment

- **The games chunk** (analysis candidate 3: Minigame, Stage review and Word cards behind route shims as one chunk, about -90 to -120 KB by model). Later owner decision.
- Trimming the es and ko locale chunks' `console` and `landing` (outside the start bundle line; `localeChunkRaw`).
- A read-set audit of `learner` and `caregiver`.
- `save-retry` out of the shared set, the `srOnly` duplicates, reanimated and gesture-handler.
- Any change to `en/console.ts`, `index.ts`, the es or ko dictionaries or the review ledger.

## As built

(filled by SB-3)
