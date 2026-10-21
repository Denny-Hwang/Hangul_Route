# content/episodes

Grid lesson content.

- `stage-1/` holds the Stage 1 jamo and card records (the Stage 1 quests themselves are
  TypeScript in `apps/mobile/src/content/quests.ts`; see `stage-1/README.md`).
- `stage-2/`, `stage-3/`, `stage-4/`, `stage-6/` and `stage-7/` hold the upper-stage
  **lesson cells** of F-CURR-001: one file per grid cell, named after its theme
  (`letters.json`, `life.json`, `rites.json`, `nature.json`, `crafts.json`). Stage 5 has no
  folder here: its cells are the story books (F-STORY-005).

## A lesson cell file

One `LessonCellSchema` object (`packages/content-schema/src/schemas/lesson.ts`): the episode
fields, three quests (Word Builder: six), each with its six steps
(`intro -> discover -> practice -> apply -> check -> reward`) and the scopes of its games
inline, the culture and language notes with their sources and verification record, and the
review record. Ids keep the placeholder ids: `episode:stage<n>-<theme>`,
`quest:stage<n>-<theme>-q<k>`, scope refs `minigame:s<n>-<theme>-q<k>-<step>`.

- Taught Korean is a `{ ko, romanization, en }` object; a note's Korean is a `{ko:...}` token.
- The `en` gloss and every `*En` field live in the file; the Spanish and Korean values live in
  `content/i18n/es/lessons-stage<n>-<theme>.json` and `content/i18n/ko/lessons-stage<n>-<theme>.json`
  (domain = the file name), keyed by the episode, quest and scope ids. Scope paths address the
  app's game shape (`cardPairs.<pair>.gloss`, `listenPick.rounds.<id>.prompt`,
  `orderIt.rounds.<id>.sentence.gloss`, ...; the allow-list is `OVERLAY_FIELDS`).
- Culture and language notes need two sources, one from a Korean public institution, in the
  story `SourceSchema` shape, or a `factRef` to a reviewed story's fact; three verification
  passes (`scope: "lesson"`) before the cell is `ready`.
- `status: "draft"` until both multi-agent review sign-offs are in (`review.language:
  "native-reviewed"`, `review.culture: "culture-reviewed"`, `reviewedBy: "MAR"`, `reviewedAt`).
  No copy says the content was reviewed by a native speaker or a human expert.

## Culture notes in the app

`culture[]` is the sourcing record of every claim a learner reads. As of row C-2 the bundle
carries no note text (no screen shows a lesson note yet), so the claims a learner sees are the
Hoya lines, Discover `noteEn` and realia captions, and the MAR culture review (pass 5) checks
each of them against a note of the cell. The row that first draws a lesson note on screen
emits `culture[].{id, kind, textEn}` into the lesson modules with an episode overlay path
`culture.<noteId>.text` that U-10 covers, and points the copy lints (`lesson-copies-source`,
`lesson-national-treasure-number`) at the text it shows; no ready cell carries a culture claim
before that row lands.

## Pipeline

1. `node scripts/validate-content.mjs` runs the `lesson-*` rules (`packages/content-schema/src/lesson-lint.ts`).
2. `node scripts/build-lessons.mjs` drops draft cells, fails a `ready` cell without both
   sign-offs, and writes
   `apps/mobile/src/content/__generated__/lessons-index.ts` (the start-loaded manifest: episodes,
   quest headers in English and the jamo each quest's Discover step teaches) and, under
   `__generated__/lesson-chunks/`, one content-hashed
   chunk per cell (its steps, game scopes and their glosses; loaded when one of its quests opens)
   and one title chunk per locale (loaded for the active locale only; F-CURR-002 section 10).
   It also writes the catalogue rows of the cells, their quests, the stories and the topics
   (`packages/content-schema/src/catalog/catalog.generated.ts`). None of these modules is committed
   (F-CURR-002 row CM-6): `pnpm generate` writes them, and the turbo `generate` task and the root
   `postinstall` run it. `--check` (CI) is a determinism check: a fresh run must give the bytes an
   earlier run wrote; `--report` fails on the budget (9 KB raw per
   quest on average, 60,000 B raw for the manifest, 30,000 B raw per title chunk, 90,000 B raw /
   16,000 B gzip per cell chunk, 220 KB raw /
   40 KB gzip of game content per stage, 1,400,000 B raw / 210,000 B gzip in total).
3. `apps/mobile/src/content/__tests__/upper-stage-curriculum.test.ts` checks U-1 .. U-10 and
   that a ready cell plays only games the app has a screen for (`PLAYABLE_KINDS`, so a game row
   lands before the cells that use its game), and `e2e/web/journey-upper-cell.spec.ts` tests every
   cell of the generated manifest (a hand-written deep play is optional).
4. A new quest carries `"addedIn": <YYYYMMDD>` in its own cell file, the date it is added; that is
   the only shared fact a cell PR writes. `CATALOG_VERSION` is generated as the largest stamp (the
   history up to 32 keeps its integers), and `node scripts/check-added-in.mjs --base origin/main`
   (run by `build-lessons.mjs --check` in content-validation) fails a stamp lower than main's
   version: the fix is a one-field edit in the PR's own file. The catalogue rows, the route days
   (derived from the manifest, `route-days-manifest.test.ts`) and the e2e cell list follow by
   themselves. The presenter font is rebuilt (`node scripts/build-presenter-font.mjs --source …`)
   only when `--check` says the cell's Korean has a code point the font lacks.
5. Release order for the first `CATALOG_VERSION` bump: the Worker that keeps a stored placement
   result's `catalogVersion` when an older build re-uploads it without one
   (`packages/backend/src/lib/additive-fields.ts`, row C-2) is deployed before any app build
   that bumps the version, as for every additive snapshot field.
