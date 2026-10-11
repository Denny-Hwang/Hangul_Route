# content/vocab/

Vocabulary for the topic picker, flashcards and Speed Round (F-VOC-001). One JSON file per topic; the apps read a generated TypeScript module, never these files directly. Spec: `docs/specs/F-VOC-001-vocab-schema-pipeline.md` (schemas §3.1, senses §3.2, pipeline §3.7, validator §3.8). Romanization policy: `docs/specs/F-CNT-002-romanization-policy.md`.

## Files

```
content/vocab/
  README.md          this file
  _senses.json       the sense registry (homonym groups, launch and reserved ids)
  <topic>.json       one VocabTopicFile per topic: food animals colors numbers family school
                     body nature travel sports k-culture science (12 items each at launch)
content/i18n/es/vocab-<topic>.json   Spanish overlay (gloss, senseNote, topic title/blurb/hoyaIntro)
content/i18n/ko/vocab-<topic>.json   Korean description overlay (gloss)
```

The file name is `<topic.key>.json`. A topic file is `{ schemaVersion: 1, topic, items }`; `topic.id` is `vocab-topic:<key>` and `topic.coverItemId` is an item of the same file. The schema is `VocabTopicFileSchema` in `packages/content-schema/src/schemas/vocab.ts`.

## Authoring rules

- **One id per sense**: `vocab:<romanization without spaces>[-<sense>]` (`vocab:sagwa-apple`, `vocab:nun-eye`). Ids are permanent: they are audio file names (`audio/vocab/<slug>.mp3`), progress keys and overlay keys.
- **Romanization** is Revised Romanization of the pronunciation, unhyphenated (`yunnori`, not `yutnori` or `yun-no-ri`). `checkRomanization` fails the suite on a mismatch; an exception needs a documented converter limit as its reason.
- **Homonyms** (same `ko`, different meaning) share a `senseGroup`, carry a sense suffix in the id, and are listed as `launch` members of that group in `_senses.json`. A sense that is not shipped yet is listed as `reserved`: its id is taken and no item may use it. `_senses.json` stores no Korean (the validator would demand a romanization and gloss next to it).
- **English only in the item** (`en`, `senseNote`, `titleEn`, `blurbEn`, `hoyaIntroEn`): no Hangul (`korean-in-ui-field` in `scripts/validate-content.mjs`), no banned learner word (`missed`, `incomplete`, `failed`, `overdue`), no age words (`kids`, `children`, `ages`, `baby talk`). Spanish glosses and the Korean description live in the overlay files, never in the topic file.
- **Pictures** are `card:<id>` (heritage card art) or `word:<key>` (WordArt). No `swatch:`, no emoji, no raster images. Every item needs one; at least 8 of 12 in a topic are hand-drawn or card pictures (Colors, Numbers and Body are generated and exempt).
- **No real people, brands or artists.** Draft topics use `status: "draft"`; the picker shows only `ready` topics until the native review is applied (V12).
- **`spokenKo` must stay absent for now.** It is Hangul in a field `validate-content.mjs` does not know (`korean-in-ui-field`); a word whose voice differs from its spelling needs the validator allow-list extended first. Launch words do not need it.
- **Korean overlays** (`content/i18n/ko/`) hold Hangul, which `scripts/validate-content.mjs` rejects until F-I18N-001 PR 12 makes it overlay-aware. Do not commit one before that PR lands.

## Workflow

```bash
node scripts/build-vocab.mjs          # regenerate (or: pnpm run vocab:build)
node scripts/build-vocab.mjs --check  # CI drift detector (or: pnpm run vocab:check)
pnpm --filter @hangul-route/content-schema test    # vocab-content.test.ts and the schema tests
node scripts/validate-content.mjs     # language policy over content/**
```

After editing a topic file or an overlay, run the generator and commit the two generated modules with it:

- `apps/mobile/src/content/__generated__/vocab.ts` (`VOCAB_TOPICS`, `VOCAB_ITEMS` with assembled `glosses`, `VOCAB_SENSES`)
- `apps/web/src/data/vocab-catalog.ts` (roster mirror for the console)

Draft topics are bundled on purpose (the picker hides them).

## What the suite checks

`packages/content-schema/src/__tests__/vocab-content.test.ts` runs these rules over `content/vocab/*.json` and `content/i18n/*/vocab-*.json`: `vocab-schema`, `vocab-file-topic`, `vocab-count` (12 per launch topic), `vocab-id-format`, `vocab-duplicate-ko`, `vocab-sense-registry` (b)-(e), `vocab-romanization`, `vocab-romanization-consistent` (vocabulary files against each other until F-CNT-002 PR 2b/3), `vocab-topic-title-romanization`, `vocab-visual-grammar`, `vocab-visual-count`, `vocab-text-no-hangul`, `vocab-banned-word`, `vocab-audio-ref`, `vocab-overlay` and `vocab-generated-drift`. Each rule has a deliberately broken fixture in `packages/content-schema/src/__fixtures__/vocab/broken/`.

Two rules wait for data: the sense-registry rule (d) ("every launch member exists as an item") switches on by itself once all twelve topic files exist, and `vocab-overlay` strictness follows `HANGUL_ROUTE_STRICT_LOCALES`.
