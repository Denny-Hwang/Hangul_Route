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
emits `culture[].{id, kind, textEn}` into `lessons-index.ts` with an episode overlay path
`culture.<noteId>.text` that U-10 covers, and points the copy lints (`lesson-copies-source`,
`lesson-national-treasure-number`) at the text it shows; no ready cell carries a culture claim
before that row lands.

## Pipeline

1. `node scripts/validate-content.mjs` runs the `lesson-*` rules (`packages/content-schema/src/lesson-lint.ts`).
2. `node scripts/build-lessons.mjs` drops draft cells, fails a `ready` cell without both
   sign-offs, and writes
   `apps/mobile/src/content/__generated__/lessons-index.ts` (episodes, quests, their glosses;
   imported at start) and `lessons-stage<n>.ts` (the game scopes and their glosses; loaded the
   first time a quest of that stage opens). `--check` fails on drift, `--report` on the budget
   (11 KB raw per quest on average, 150 KB raw / 32 KB gzip per stage module, 600 KB raw /
   128 KB gzip in total).
3. `apps/mobile/src/content/__tests__/upper-stage-curriculum.test.ts` checks U-1 .. U-10 and
   that a ready cell plays only games the app has a screen for (`PLAYABLE_KINDS`, so a game row
   lands before the cells that use its game), and `e2e/web/journey-upper-cell.spec.ts` needs an
   entry for every shipped cell.
4. A shipped cell also updates `packages/content-schema/src/catalog/data.ts` (the cell, its
   lessons, `CATALOG_VERSION` + 1 and the version's quest ids in `CATALOG_QUEST_ADDITIONS`),
   the route-days test pins, and the presenter font (`node scripts/build-presenter-font.mjs`).
5. Release order for the first `CATALOG_VERSION` bump: the Worker that keeps a stored placement
   result's `catalogVersion` when an older build re-uploads it without one
   (`packages/backend/src/lib/additive-fields.ts`, row C-2) is deployed before any app build
   that bumps the version, as for every additive snapshot field.
