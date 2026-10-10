# REVIEW-2 — independent review of seven Hangul Route specs (2026-10-10)

Reviewed against `main` at `c939348` (PRs #91-#102 merged; **#103** = F-QUEST-002 Q-1 with `ko-text.ts` and **#104** = the 24 research files are open; working tree `/Users/ggoboogi/workspace/Hangul_Route`, read-only). All edits were made in place in `specs-out/`; this file is the log. Companions: `TELEMETRY-NAMES-2.md` (consolidated names), `AMENDMENTS-LANDED-SPECS.md` (+ `AMENDMENTS-F-QUEST-002.diff`, and the amended copy `F-QUEST-002-discover-check-stage1-complete.md`), `review2/` (throwaway scripts: `validate_episodes.py`, `simulate_import.py`, `cites.py`, `zodcheck.cjs`, the patch scripts and `bak-*` copies of every file before editing).

## 1. Result

| Spec | Status | Why |
|---|---|---|
| F-STORY-001 story schema and pipeline | **ready** | PR 1.0 and 1.5 start now; PR 1.1a/1.1b wait for F-QUEST-002 Q-1 (PR #103, open) because `ko-text.ts` is its file; the schema was checked against all 24 real episodes (§3.14) |
| F-STORY-002 story reader, Sources, SceneArt | **ready** | PR 2.2 (pure scene-art core) needs nothing; 2.1/2.5 need 001 PR 1.1a/b; 2.6a/b need F-STORY-003 PR 3.2a and F-I18N-001 PR 4 |
| F-STORY-003 story checks, Story Order v2 | **ready** (was draft) | its blocker (001/002 not specs) is gone; every borrowed name was read in 001/002; PR 3.3 `ChoiceCard`, 3.5a, 3.6, 3.8 start now |
| F-STORY-004 shelf, Home card, Library, Culture notes | **ready** (was draft) | same; PR 4.2 starts now, 4.1 needs the `Episode.placement` field (001 PR 1.1b) |
| F-STORY-005 episode catalogue and grid | **ready** | PR 5.7 starts now; 5.2 follows 004 PR 4.1; placement table verified against the data (24 ids once each) |
| F-STORY-006 card award model | **ready** | 6.1-6.3 start now (no dependency); the story cards need 001's bundle and 002's `StoryScene` |
| F-AUDIO-004 Korean voice quality | **ready** | A-1 and A-3 start now; A-9 (30 clips) is blocked on the owner's recordings (T-017) and is content only |

No spec was left `draft`: every blocker found was either a contradiction (fixed in the text) or a dependency on a PR that is already open and named.

## 2. Counts

- **71 logged changes** (§6; one row can cover several edits): 28 cross-spec, 11 feasibility / PR size, 11 quality, 10 code truth, 9 real data, 2 charter. Plus 3 new files (`TELEMETRY-NAMES-2.md`, `AMENDMENTS-LANDED-SPECS.md`, this log) and an amended copy of F-QUEST-002 (5 edits).
- **Citations checked: 282 `file:line` citations** parsed mechanically from the seven specs (AUDIO 69, STORY-001 16, -002 37, -003 41, -004 44, -005 17, -006 58), each resolved to a file in the current tree and the cited line printed and compared with the claim; about 150 were also read in context. **21 were stale, wrong or ambiguous (7 %)** and were fixed: the telemetry list/test ranges (11 places, the arrays grew from 23 to 32 names), `index.ts:1-14`, `quest-run-store.ts:38-39`, blueprint 06 `:613`, `ProgressSnapshotSchema` at `sync.ts:42`, `StorySequenceGame.tsx:34`, two `vitest.config.ts` cites that resolve to the wrong package, the `Speech.js` path, and the `telemetry.ts:13` that resolved to the mobile file. The rest were verified as written (the first review had already moved them to `332e199`; only PRs #98-#102 touched code since: `packages/content-schema`, `CreateProfileScreen`, `sync-api`).
- **Real data**: 24 episodes / 182 scenes / 211 facts / 576 sources validated against the schema (§3); 7 mismatch classes found and fixed; 24 story-card rows of F-STORY-006 re-computed; the 24-row placement table of F-STORY-005 matched (slug, title, theme, stage, minutes, cluster) with 1 title fix.
- **Open owner questions: 14** (§9), all product / commercial / legal.

## 3. The real heritage data (24 episodes, four `*.final.json`, identical to `content/stories/research/` in PR #104)

Scripts: `review2/validate_episodes.py` (field lists, caps, enums, ranges for every field of the research shape) and `review2/simulate_import.py` (the F-STORY-001 §3.10 mapping, keywords, tokens, coverage and number-echo rules).

- **Holds 1:1.** Every research field has a destination in `StoryObjectSchema`; no file has a key the schema does not know; all caps hold with headroom (tightest: `summaryEn` 314/320, `claimEn` 525/600, `authorNotes` 2654/3000); 7-8 scenes, <= 45 words, every `fact_ids`/`fact_id` resolves, 3 checks per episode, 211/211 facts have an authoritative host, all numeric facts have >= 2 sources, 2 framing scenes (exactly 25 % of one story), no skewed answer position, 2 folk tales.
- **Mismatches found (all fixed in F-STORY-001/003):** (1) 34 scenes whose gloss or capitalisation differs from the same word in `vocab` (rule relaxed); (2) 62 scene-only Korean strings missing from `keywords[]`, 66 Hangul spans in narration including quoted phrases and a five-jamo list (phrase keywords, longest-span-first tokens); (3) one 79-character check option vs a 70 cap (cap 80 + warning); (4) 24 titles without romanization vs a strict KoText (draft-relaxed helper); (5) `explainEn` absent from all 72 checks vs required field (optional until ready); (6) stale counts; (7) "seasons-tales has no final file".
- **Expected lint output on the raw import** (the authoring to-do): 4 `narration-number-unsupported`, 3 `narration-approximation-unmarked`, 1 `source-url-not-https`, 2 `gloss-contains-hangul`, 7 undefined terms, 1 hyphenated romanization, 1 `check-option-long` warning, plus the draft relaxations (182 captions, 72 explanations, 182 art descriptions, 24 title romanizations).
- **F-STORY-005 placement table**: all 24 real ids, each exactly once (script); slug, theme, recommended stage, minutes, cluster file match the data; only the pansori title lacked "(Traditional Tales)". Derived matrix re-derived from `episodes.ts` (lessons in stage1 x5, stage2 life + nature, stage4 rites): 15 of 35 cells show stories, 12 + 12 split, 112 minutes, 6 sampler, 6 story-time / 18 culture.
- **F-STORY-006 card rows**: all 24 headwords are vocab or scene Korean with exactly the stated romanization, every `factId` is the first fact with `claimEn` <= 180 and >= 2 sources, none of the 24 headwords or 4 set headwords duplicates one of the 42 existing Korean card words.
- **Cluster verification**: all four files record `passes: 3`, so `MIN_VERIFICATION_PASSES = 3` holds back none of the 24; `.signoff.md`/`.changes.md` exist for each; checker issue counts re-counted: A 50 + B 68 = 118.

## 4. One owner, one name: decisions applied across the seven specs and the four landed ones

| Thing | Single owner | Name / shape everywhere | What was inconsistent |
|---|---|---|---|
| `StorySchema` and its slots | F-STORY-001 PR 1.1b (`StoryObjectSchema` strict + `StorySchema` + `StoryReadySchema` + `parseStory`; no discriminated union) | slots `shelf`, `pillarTags`, `companionId`, `card`, `rewardCardIds`, `errata` | 005 and 006 each "amended the strict schema"; the union was impossible in zod 3 |
| `MIN_VERIFICATION_PASSES` | F-STORY-001 §3.6 | **3** | 2 in 001, "recommend 3" in 005 |
| `KoTextSchema` (+ `KoTextShape`, `refineKoText`) | **F-QUEST-002 Q-1**, `schemas/ko-text.ts`, PR #103 | `{ ko, romanization, en, spokenKo?, audioRef?, syllables? }` | 001 and 003 each offered to create it; `.extend` impossible on a `ZodEffects` |
| `StoryCheckSchema`, `CheckOptionSchema`, `CHECK_LIMITS` | text: F-STORY-003 §3.1; file: F-STORY-001 PR 1.1a | option cap 80, `explainEn` optional/ready-required | a second narrower `CheckOptionSchema` in 001 |
| `StoryShelfSchema`, `CultureNoteSchema`, `StoryCardSchema` | F-STORY-001 §3.2 (shape); rules: 004 / 004 / 006 | strict | shelf defined twice; card block "amended in" |
| `CatalogueFieldsSchema`, `PillarTagSchema`, `CompanionIdSchema` | text F-STORY-005 §3.2; file created by 001 PR 1.1a | `pillars.ts` | created nowhere in particular |
| `EpisodeObjectSchema` / `EpisodeSchema` | F-STORY-001 §3.9 | object + `superRefine` | `.merge` on a refined schema |
| `StoryIndexEntry` | F-STORY-004 §3.1 | one interface; 005 adds `entriesForCell` | possible re-derivation |
| `isGridEpisode` / `gridEpisodes` / `shelfEpisodes` | F-STORY-004 PR 4.1 | — | "whichever lands first" |
| `ChoiceCard` | F-STORY-003 PR 3.3 | verified: only creator | — (no change needed) |
| `isFreeContent(kind, id)` | F-STORY-004 PR 4.2 | verified: 005, 006, QUEST only call it | — |
| `story-ref.ts` (ref grammar) | F-STORY-003 PR 3.2a | `minigame:story-<read|check|seq>-<listen|along|read>-<slug>` | "whichever lands first" in 002 |
| `playPrompt`, `PlaySpec`, `spokenFor`, capability | F-AUDIO-004 | 002, 003 call it; interim port until A-4a | 003 used `speak()` directly |
| Initial ㅇ spoken form | F-AUDIO-004 AD2 (**이응**, `spokenKind: 'name'`) | F-QUEST-002 amended (was 아 = the audio of ㅏ) | contradiction |
| `books.ts` | F-STORY-005 PR 5.2 creates (empty), 5.6 fills | — | created by 5.6, used by 5.2 |
| Card rarity of story cards | derived from `recommendedStage` (F-STORY-006) | not a field | duplicated in the `card` block |
| Telemetry names | `TELEMETRY-NAMES-2.md` | 59 names after all specs; `story.sources.link_opened` renamed | see that file |
| Research files | `content/stories/research/` (PR #104); skipped by `validate-content` and by F-CNT-002's class A scan | importer reads only `*.final.json` | scan would have failed on them |

## 5. Global PR order (new rows only; review 1's order in `REVIEW-1.md` §4 stands)

1. Docs: 001 PR 1.0, 005 PR 5.7, 004 PR 4.2, 003 PR 3.3/3.6/3.8, 006 PR 6.1-6.3, AUDIO A-1/A-3, 002 PR 2.2 can all start in parallel (no unmerged dependency).
2. **PR #103 (Q-1) merges** (add `KoTextShape` / `refineKoText` there if still open) -> 001 PR 1.1a -> 1.1b -> 1.2, 1.3, 1.4, 1.6 -> 1.7a-d (imports) -> 1.8 (authoring) -> 1.9 (reviews, `shelf`, `card`).
3. 002 PR 2.1/2.3a/2.5, 003 PR 3.1/3.2a/3.2b, 004 PR 4.1/4.3a/4.3b, 005 PR 5.1/5.2/5.3, 006 PR 6.4a/6.4b follow their stated dependencies; 002 PR 2.6a/2.6b, 003 PR 3.4a/3.5b, 004 PR 4.4a/4.4b, 4.5-4.7, 005 PR 5.5a/b, 006 PR 6.5a-c/6.6-6.9 are the screens.
4. F-AUDIO-004: A-2 (spoken forms, after F-QUEST-002 Q-1) -> A-4a -> A-5a/A-5b -> A-6; F-QUEST-002 Q-3a consumes A-4a (or ships its shim with the amended ㅇ value).
5. Apply `AMENDMENTS-LANDED-SPECS.md` (10 rows) in the PR it names.

Files several of these PRs edit (expect mechanical rebases): `packages/content-schema/src/schemas/telemetry.ts` + `__tests__/telemetry.test.ts` + `src/index.ts` (all seven); `content/episodes.ts` (001 1.4, 004 4.1, 005 5.2); `logic/homework/mission-builder.ts` (004 4.1, 4.4a); `screens/results/ResultsScreen.tsx` (003 3.7, 004 4.4b, 006 6.4b/6.5a); `screens/library/LibraryScreen.tsx` + `CardDetailScreen.tsx` (006 6.1/6.5b/6.6, 004 4.5); `screens/journey/JourneyScreen.tsx` (004 4.1, 005 5.5a); `platform/audio*.ts` (AUDIO A-4a, QUEST Q-3a shim); `content/jamo.ts` (AUDIO A-2, QUEST Q-1/Q-2); `scripts/validate-content.mjs` (PR #104, 001 1.3, 003 3.8).

## 6. Change log (issue, fix)

Kinds: cross-spec = two places disagreed; code truth = a citation or claim checked against the tree and corrected; real data = checked against the 24 research episodes; feasibility / PR size = not implementable or not reviewable as written; quality = status, acceptance criteria, missing pieces; charter = CLAUDE.md rule.


### F-STORY-001-story-schema-pipeline.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | cross-spec | `StorySchema` is `.strict()` here while F-STORY-005 added `pillarTags`/`companionId` and F-STORY-006 an optional `card` block, each "amending" it | All three slots (`pillarTags`, `companionId`, `card`) plus `shelf`, `rewardCardIds` are in `StoryObjectSchema` from day one; 005 and 006 consume them and add rules, never amend (§3.2.1) |
| 2 | feasibility / PR size | `StorySchema = z.discriminatedUnion('state', [refined, refined])` cannot be built in zod 3 (verified: throws on the installed 3.25.76) | One strict object, `StorySchema` (cross-field refinement), `StoryReadySchema` (ready-only refinement) and one entry point `parseStory`; `buildStorySchema` factory removed |
| 3 | feasibility / PR size | `KeywordSchema = KoTextSchema.extend(...)`: `KoTextSchema` (Q-1, #103) is a `ZodEffects`, which has no `.extend` (verified) | `KoTextShape` + `refineKoText` additive exports and one helper `koTextExtend` (§3.2 table) |
| 4 | cross-spec | KoText owner unclear ("reuse if present, else create that file") | `schemas/ko-text.ts` is F-QUEST-002 Q-1's (PR #103, open); this spec never creates it; PR 1.1a waits for #103; start-order note |
| 5 | cross-spec | A narrower `CheckSchema`/`CheckOptionSchema` twin here next to F-STORY-003's `StoryCheckSchema`/`CheckOptionSchema`: two exports of the same name from one index | One definition (F-STORY-003 §3.1), file created by PR 1.1a, `explainEn` optional in the schema and required by the ready rule; twin deleted |
| 6 | cross-spec | `StoryShelfSchema` defined twice ("the two texts must stay identical") | Defined here only; F-STORY-004 §3.1 keeps the product rules |
| 7 | cross-spec | `pillars.ts` / `CatalogueFieldsSchema` creator unspecified between 001 and 005 | PR 1.1a creates the file with the three schemas (text owned by F-STORY-005 §3.2); 005 PR 5.1 adds the registry |
| 8 | cross-spec | `MIN_VERIFICATION_PASSES = 2` here while F-STORY-005 recommended 3 | Constant = 3 (real process: author, two checkers, reviser, third pass); gate text, decision 7 and the "seasons stays hidden" claim rewritten; all 24 pass |
| 9 | real data | Stale research counts: 573 sources / 189 URLs / 85 two-source facts / 92 accesses on 10-10 / "36 with 3 options" | 576 / 191 / 82 / 95 / 37 with 3 and 35 with 4 options; 88 three-source and 33 four-to-seven-source facts added |
| 10 | code truth | `seasons-tales.final.json` "did not exist"; importer fell back to `.revised.json` (header, §3.6, §3.10, assumption 1, verification note lengths 1073/1311/688) | All four finals exist with `passes: 3` (notes 1311, 1073, 688, 925 chars); importer reads only finals and refuses `.revised`/`.draft` without `--allow-unfinal` |
| 11 | real data | Rule "embedded scene keyword equals the keyword entry (ko, romanization, en)" fails on 34 real scenes (29 different glosses, 5 capitalisations) | Item 3: `ko` exact, romanization case-insensitive, gloss may be scene-specific |
| 12 | real data | 62 scene Korean strings are not in `vocab`, so a scene `keyword.id` would not resolve; 66 Hangul spans (quoted phrases, a five-jamo list) had no token rule | Importer appends scene-only Korean to `keywords[]` (max 13 per story); `kind: 'phrase'`; longest-span-first token resolution (§3.4, §3.10) |
| 13 | real data | One real check option is 79 characters; the option cap was 70 | `CHECK_LIMITS.option` = 80 (F-STORY-003 amended in step) plus warning `check-option-long` > 70 |
| 14 | real data | All 24 titles have no romanization yet a draft must parse; `KoTextSchema` demands `min(1)` | `koTextExtend` lets `romanization`/`en` be `''` in a draft; ready rule requires them |
| 15 | real data | `explainEn` absent from all 72 real checks while `StoryCheckSchema` required it | Optional in the schema, required for `ready` |
| 16 | quality | No evidence that the schema holds the real data | New §3.14: every episode of the four final files checked by script (field maxima vs caps, mapping, tokens, coverage, number echo); mismatch table, expected lint classes, and `import-real.test.ts` as a regression test |
| 17 | code truth | `index.ts:1-14` / "`:14`" (now 23 lines), HEAD `332e199`, PR #104 (research files, `SKIPPED_DIRS`) not mentioned | Cites and states updated; research directory rules added (§3.1) |
| 18 | feasibility / PR size | `EpisodeSchema` with an object-level `questIds` refine becomes a `ZodEffects` that F-STORY-005 cannot `.merge` | `EpisodeObjectSchema` + `EpisodeSchema = Object.superRefine(episodeRules)` |
| 19 | feasibility / PR size | PR 1.1 bundled five schema files, Episode changes, fixtures and tests; 1.5 listed a needless dependency; "startable now" claims were wrong | Split 1.1a (leaf schemas) / 1.1b (story.ts + Episode); 1.5 has no dependency; dependency columns and start-order note rewritten |
| 20 | quality | No Given/When/Then block | §3.15: 13 behaviours |
| 21 | cross-spec | F-CNT-002 class A scan would read `content/stories/research/` (R2 fails on `Jang Yeong-sil`) and had no draft downgrade | Two one-line amendments recorded (`AMENDMENTS-LANDED-SPECS.md` rows 6-7), applied in PR 1.3 |
| 22 | cross-spec | Contract table (§3.11) lacked the shared slots and owners | Rows added for `StoryCheckSchema` provenance, `StoryShelfSchema`, catalogue/card slots, `parseStory`, `MIN_VERIFICATION_PASSES` |

### F-STORY-002-story-reader.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | cross-spec | `story-ref.ts` "whichever of the two specs lands first creates that file" | Created by F-STORY-003 PR 3.2a (owner of the ref grammar); 2.6b depends on it |
| 2 | cross-spec | Telemetry `story.source.link_opened` next to `story.sources.opened` (two namespaces) | Renamed `story.sources.link_opened` (3 places) |
| 3 | code truth | Telemetry list/test line ranges stale (`9-33`, `5-34`); HEAD `332e199`; research counted over `seasons-tales.revised.json` | `9-43` / `5-43` at `c939348`; four finals, repo path `content/stories/research/` |
| 4 | feasibility / PR size | PR 2.3 (data port + two renderers + subpaths + first library batch) and PR 2.6 (view, game, screen, routes, telemetry, audio port, flag, e2e) too large | 2.3a/2.3b and 2.6a/2.6b; all dependent rows re-pointed (2.4, 2.5, 2.7-2.11), start-order note |
| 5 | cross-spec | Audio PR names `A-4` from F-AUDIO-004 | `A-4a` (the engines PR) in the interim-port text and dependencies |
| 6 | cross-spec | Upstream list: `KoText` attributed to F-STORY-001; `ProfileSettings` "or an interim local default" | KoText = F-QUEST-002 Q-1; `readToMe` rides the schema merged as #100 |
| 7 | quality | Sources, audio and art behaviours had no Given/When/Then | §3.14: 10 behaviours |
| 8 | charter | Focus outline "a 2 px" literal | `borderWidth.base` |
| 9 | cross-spec | "none collides with the 26 listed" (telemetry) | Updated to the consolidated list `TELEMETRY-NAMES-2.md` |

### F-STORY-003-story-checks-sequence-v2.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | quality | Status `draft` with a blocker that no longer exists (F-STORY-001/002 are specs) | `ready`; blocker replaced by a start-order note; assumption 1 closed |
| 2 | cross-spec | `StoryCheckSchema` created here, a narrower twin created by F-STORY-001; `explainEn` required (blocks 72 drafts); option cap 70 | Implemented by F-STORY-001 PR 1.1a from this section; `explainEn` optional (ready-required); `CHECK_LIMITS.option` 80; PR 3.1 shrinks to kind + telemetry + tests |
| 3 | cross-spec | "create `ko-text.ts` if absent" | Owned by F-QUEST-002 Q-1 (#103); never created here |
| 4 | real data | Research statistics stale or wrong: answer at index 0 "29 of 72" (17 of 72 in the finals), "36 with 3, 36 with 4" (37/35), "134 of 208 facts > 140 chars" (143 of 211), 174 vocab (171), 1 bare-jamo option (3 options in 1 check), no mention of the 79-character option | All restated from the four final files; test (a) uses the committed finals, test (b) a synthetic all-first fixture (the draft files are not in the repo) |
| 5 | code truth | `StorySequenceGame.tsx:34` is `correctOrder`; the shuffle is `:35`; blueprint 06 drag text is `:611` not `:613`; telemetry ranges; HEAD | Corrected |
| 6 | cross-spec | Audio through `speak()`/`isMuted()` and "Say it yourself" defined ad hoc | Through F-AUDIO-004 `playPrompt` (interim F-STORY-002 port), `canPlayKorean`, shared fallback state; `audio.fallback_shown` source `story-check` |
| 7 | feasibility / PR size | PR 3.2 bundled refs, scopes, seeded order, two players, views, recap, copy, results extras and tests | 3.2a (refs, scopes, round key) / 3.2b (players and views); 3.4a, 3.5a, 3.5b, 3.8 dependencies re-pointed to the real PR ids of 001/002 |
| 8 | quality | Story-check test row ignored the new limits | Row extended (80/81 characters, `explainEn` absent) |

### F-STORY-004-story-shelf-home-library.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | quality | Status `draft` with a vanished blocker | `ready`; start-order note; assumptions about 001/002 names closed (read in their specs) |
| 2 | cross-spec | `StoryShelfSchema` redefined here | Owned by F-STORY-001; this spec keeps the product rules and the authoring guidance; test row moved to 001's `story.test.ts` |
| 3 | cross-spec | `StoryIndexEntry` could be re-derived by 005/006 | Stated as sole owner here; 005 adds `entriesForCell` to the same module, 006 reads `episodeId` |
| 4 | code truth | `quest-run-store.ts:38-39` is `blankRun`; `beginQuest` is declared at `:26` and implemented at `:53`; telemetry ranges; HEAD; research count source | Corrected |
| 5 | feasibility / PR size | PR 4.4 (Home card, QuestPlayer resume, reader wiring, Results clear, F-HW-001 amendment) too large; 4.3a bundled the schema field | 4.4a (Home card) / 4.4b (resume); 4.3a trimmed to names + bookmarks + store; 4.1, 4.5, 4.8 dependencies re-pointed |
| 6 | quality | Only five Given/When/Then lines, none for Home day one, resume, gating flag, review gate | §3.14: 9 behaviours |
| 7 | cross-spec | Dependency list lacked F-STORY-005's `entriesForCell` / `StoryFit` ordering and `MIN_VERIFICATION_PASSES` | Added |

### F-STORY-005-episode-catalogue-grid.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | cross-spec | PR 5.1 "amends F-STORY-001's strict `StorySchema`" with `pillarTags`/`companionId` | Slots are in F-STORY-001 PR 1.1a/1.1b; 5.1 now adds the registry, Episode merge, lint and generator copy |
| 2 | cross-spec | `MIN_VERIFICATION_PASSES` "today 2, recommend 3" (rule 4, decision 7, PR 5.7 owner decision) | Fixed at 3 in F-STORY-001; text and PR 5.7 updated |
| 3 | cross-spec | `gridEpisodes` "whichever PR lands first adds them"; PR 5.2 claimed startable now | Owner F-STORY-004 PR 4.1; 5.2 depends on it (and on 001 PR 1.4 for `storyEpisodes`); start-order note rewritten |
| 4 | feasibility / PR size | `EpisodeSchema.merge(CatalogueFieldsSchema)` impossible once `EpisodeSchema` has an object-level refine | Merge into `EpisodeObjectSchema`; rules join `episodeRules` |
| 5 | charter | Rule 6 said books "follow stage gating" (reads as new enforcement; D5) | Rewritten: no gate and no pill added; any future gate goes through `isFreeContent` |
| 6 | real data | Placement table checked against the data: all 24 ids exactly once, slug/theme/stage/minutes/cluster correct; one title missing "(Traditional Tales)"; research counts and seasons-final claims; `telemetry.ts` range | Title fixed; table declared machine-checked; 576 sources; paths to `content/stories/research/`; names list reference |
| 7 | feasibility / PR size | PR 5.5 bundled `journey-cells`, `GridCell`, count mark, caption, `CellStories` route/screen, lesson row, telemetry; `content/books.ts` created by 5.6 but used by 5.2; 5.3 missing a dependency on 4.3b | 5.5a/5.5b; `books.ts` created empty by 5.2 and filled by 5.6; dependencies added |
| 8 | quality | No Given/When/Then block | §3.14: 9 behaviours |
| 9 | cross-spec | `entriesForCell` implied a new index type | Stated: added to F-STORY-004's module, no new type |

### F-STORY-006-card-award-model.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | cross-spec | `card` block "amends F-STORY-001's strict schema" and carried a `rarity` that duplicates `recommendedStage` | Block already in 001; `rarity` removed (derived); PR 6.7 adds lint and builder only |
| 2 | code truth | `ProgressSnapshotSchema` cited at `sync.ts:42` (that line is `baseRev`) | `progress.ts:75-86`, used by `SnapshotPutSchema` at `sync.ts:41-46` |
| 3 | code truth | `telemetry.ts:13` resolved to the mobile file; HEAD; telemetry list text | Full path; names listed in `TELEMETRY-NAMES-2.md`; `card_set.complete` convention stated |
| 4 | real data | 24 story-card rows (headword, romanization, `factId`, rarity, title length, duplicates of the 42 existing Korean words, set headwords) were claimed "computed" | Re-checked by script against the four finals: all 24 match; statement added |
| 5 | feasibility / PR size | PR 6.4 (store, reconcile, live path, telemetry, Results) and PR 6.5 (Results banner, Library, Episode, CardDetail, Home) too large | 6.4a/6.4b and 6.5a/6.5b/6.5c; 6.6-6.9 dependencies re-pointed |
| 6 | quality | No Given/When/Then block | §3.11: 10 behaviours |
| 7 | cross-spec | Keyword source text said "from the research `vocab[]`" | "and the scenes' Korean" (001 §3.10) |

### F-AUDIO-004-korean-voice-quality.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | quality | First line was the title; `Status` on line 3 | `Status: ready` on line 1; start-order note |
| 2 | cross-spec | ㅇ spoken as 아 in F-QUEST-002's interim map vs 이응 here; carrier question left open there; Discover Hear it / fallback line used tile romanization | Amended in the landed spec: 5 changes, plus the F-CNT-002/F-I18N-001/Q-1 items, in `AMENDMENTS-LANDED-SPECS.md` and an amended copy of F-QUEST-002 |
| 3 | code truth | `romanize(spokenKo)`: the merged converter's `romanize()` returns `{ text, unknown }`; the word function is `romanizeWord`; "F-CNT-002 PR 1 not merged" | `romanizeWord` (`rr.ts:167`), PR #102 merged |
| 4 | code truth | Interim `levelOrder` map from `ageGroup` | `levelOrder()` exists (#101, `learner-level.ts`) |
| 5 | code truth | HEAD/PR range; telemetry ranges (`9-33`, `5-34`, 23 names); `vitest.config.ts:34-39/21-28` resolve to the wrong package; `Speech.js` path | `c939348`, `9-43`/`5-43`, 32 names; `apps/mobile/vitest.config.ts:34-39` and `:21-27`; `expo-speech/build/Speech.js:80-85` |
| 6 | feasibility / PR size | A-4 (engines, store, unlock, mute, Profile card, help sheet) and A-5 (nine call sites + fallback + amendments) too large | A-4a/A-4b and A-5a/A-5b; references in 002/003 re-pointed |
| 7 | cross-spec | Other `audioRef` fields (KoText, narration, cards) used a free string | Tightening to `AudioRefSchema` planned (A-10) with the fall-through rule |
| 8 | cross-spec | Telemetry text: "does not collide with the 23 existing or the 26 names"; `source` values undefined for other specs | Updated; `source` values listed |
| 9 | quality | Only one "when"; no Given/When/Then block | §3.15: 10 behaviours |

## 7. Citation ledger (sample of what was read, with the result)

Verified as written (line printed and compared): `ui-store.ts:4`, `audio.ts:8, 20, 26-40, 34-38, 50-54`, `audio.web.ts:7, 10, 36-42, 44-62, 50, 54-55, 73-77`, `ProfileScreen.tsx:25, 45-46, 153-157`, `MatchSoundGame.tsx:19, 52, 90-92, 110`, `TraceStrokeGame.tsx:32, 72, 125`, `BuildLetterGame.tsx:112`, `CardMatchGame.tsx:109`, `VoiceEchoGame.tsx:55`, `TapRespondGame.tsx:40`, `CardDetailScreen.tsx:32, 150, 205, 220, 279-295, 351, 365`, `jamo.ts:27, 71, 93-100` and `schemas/jamo.ts:19`, `pwa-postbuild.mjs:35, 46-48, 94`, `app.json:77`, `expo-speech` `SpeechModule.kt:95-103` and `SpeechModule.swift:36-41` · `MinigameScreen.tsx:30-39, 42-52, 54-78`, `navigation/types.ts:7, 19-20, 32-36, 45-49`, `QuestPlayerScreen.tsx:41-47, 81-93`, `quest-run-store.ts:53, 55-68`, `PaywallScreen.tsx:30-39`, `round-keys.ts:15-17`, `results-award.ts:37-82`, `score.ts:6-13`, `reward.ts:6-10, 26-35`, `progress-store.ts:81, 121-135, 151-184, 206-217, 275-278`, `merge.ts:34-41, 60-62, 80-98`, `ResultsScreen.tsx:47-86, 91-96, 117-129, 283, 302-306`, `HomeScreen.tsx:42-47, 97-103, 138-148`, `JourneyScreen.tsx:63-71, 98-102, 148-181`, `mission-builder.ts:86-124, 138-172`, `gating.ts:35, 43, 50`, `first-quest.ts:21-23, 32`, `entitlement.ts:16, 31-33`, `flags.ts:24-51`, `episodes.ts:10-141, 186-214`, `quests.ts:22, 78, 95, 127, 184`, `heritage-cards.ts:28-68, 92` (rarity 15/13/10/4 and the `unlockedBy` counts re-counted), `LibraryScreen.tsx:45, 47, 79-80, 120, 131-135, 142`, `EpisodeDetailScreen.tsx:135-188`, `StorySequenceGame.tsx:33-153` and the `:140`, `:56-60` claims, `validate-content.mjs:25, 49, 63-75, 84-115`, `learner-level.ts` (`levelOrder`), `rr.ts:167-180` (`romanizeWord`, `romanize`), `schemas/progress.ts:75-86`, `schemas/episode.ts:10-22`, `schemas/quest.ts:8, 21-32`, `schemas/heritage-card.ts:24-38`.

Corrected (old -> current): `telemetry.ts:9-33` -> `9-43` and `telemetry.test.ts:5-34` -> `5-43` (11 places; 23 -> 32 names, 38 with PR #103) · `src/index.ts:1-14`/`:14` -> `1-23` · `quest-run-store.ts:38-39` -> `:26, :53` · blueprint 06 `:613` -> `:611` · `schemas/sync.ts:42` -> `schemas/progress.ts:75-86` (+ `sync.ts:41-46`) · `StorySequenceGame.tsx:34` -> `:35` · `vitest.config.ts:34-39, 21-28` (wrong package) -> `apps/mobile/vitest.config.ts:34-39, 21-27` · `Speech.js:80-85` -> `expo-speech/build/Speech.js:80-85` · `telemetry.ts:13` (resolved to the mobile file) -> `schemas/telemetry.ts:13`.

Wrong claims (not just line drift): `seasons-tales.final.json` "does not exist"; 573 sources / 189 URLs / 85 two-source facts / 92 accesses; answer at index 0 in 29 of 72 checks (17 of 72); 36/36 option split (37/35); 134 of 208 facts over 140 characters (143 of 211); 174 vocab (171); "F-CNT-002 PR 1 not merged" (#102 merged); "`romanize(x)` returns a string" (it returns `{ text, unknown }`); an interim `ageGroup` -> level map (`levelOrder` exists); a discriminated union of refined schemas (does not exist in zod 3); `.extend` on `KoTextSchema` and `.merge` on a refined `EpisodeSchema` (do not exist).

## 8. What could not be verified

- Anything that needs a device or a browser: iOS/Android/Safari/Chrome speech behaviour, first-gesture unlock, silent switch, `expo-av` vs `expo-audio` at SDK 52, the `expo-av` microphone usage string, Hermes `Intl`, react-native-svg nested `Svg` rendering, 100-160 SVG nodes per scene on a low-end phone, a 0.8 MB generated TypeScript literal in `tsc` and at Hermes cold start (all stated in the specs with fallbacks).
- PR #103 and #104 were read from `gh pr diff`/branches, not merged code: if #103 changes `ko-text.ts` before merging, F-STORY-001 §3.2 (`KoTextShape`, `refineKoText`) must follow.
- `import-real.test.ts` (importing a `.mjs` mapper from vitest, typed by a `.d.mts`) is specified, not run; the equivalent checks were run by the two Python scripts.
- Whether the Korean strings, headwords and romanizations are good Korean (native review is the owner's, as in review 1); romanizations were compared with the research data, not re-derived.
- The 24 art briefs and the 182 scenes' drawability with the SceneArt kit (F-STORY-002 estimates 1-2 days per cluster, unmeasured).
- Specs not in this review: F-VOC-001..005, F-PLC-001, F-PLAN-002, F-TCH-004, F-LAYOUT-001.

## 9. Open questions that need the OWNER (product / commercial / legal only)

1. **Product: new pillar tag `D5` "Traditional tales" (옛이야기)** (F-STORY-005 §3.8). Blueprint 04 has no home for the two folk tales (`sun-and-moon`, `pansori-tales`). Confirm the added tag, or name another tag for them.
2. **Product: the editorial layout of the 24 stories** (F-STORY-005 §3.3): Story Time (6) vs Culture (18), the order inside each, the six-story sampler, and Stage 5 "Festival Tales first, a book opens at 2 reviewed `read` quests". All are data and can change later; confirm before the first learner build.
3. **Product: catch-up for existing learners** (F-STORY-006 §3.5). A learner who finished the 8 shipped Stage 1 quests receives up to 22 cards on the first launch of the card-award release (18 episode cards, 3 legendary stage cards, the tiger), announced once on Home. Confirm the experience, and the Library change: the `N/M` pill is removed and the caption becomes a plain count.
4. **Product: the tiger welcome card** stays `legendary` and arrives at profile creation (F-STORY-006 decision 5), or becomes `rare`.
5. **Product/editorial: card names** for the 24 story cards (English titles, e.g. "Royal Historian"), the 4 collection cards (기록 / 활자 / 보물 / 아리랑) and the rarity rule (Stage 1 stories common, Stage 2 uncommon, Stages 3-6 rare).
6. **Legal/product: outbound links from Sources** (F-STORY-002 §3.8). A grown-up can open a source URL; behind the PIN gate where a PIN exists, directly on a self-only device without a PIN. Acceptable for the Education-category listing (App Review 5.1.4), or text-only copyable links?
7. **Legal: source excerpts on screen and external images.** The Sources screen shows each source's `quoteOrLocator` (up to ~400 characters, 576 entries) from UNESCO and Korean agency pages. Is short quotation acceptable, or should the screen show title, publisher, date and locator only? And, as before: counsel before the first external image (KOGL Type 1 definition quoted from general knowledge, F-STORY-005 §3.10).
8. **Product: factual corrections on native builds.** The PWA gets an S1 correction within a day; iOS/Android only with the next store release (no over-the-air content channel, F-STORY-001 §3.7). Accept, or commission a content-advisory channel before native launch?
9. **Product/commercial: who is the culture reviewer** who signs `review.culture` (the owner is the Korean-language reviewer; the heritage/sensitivity reviewer is unnamed), and who closes the "remaining uncertainty" items of the four sign-off files (for example Haeinsa visitor rules, the current location of the Hunminjeongeum Haerye) before the first story is shown.
10. **Commercial/legal: the voice recordings (T-017).** Who is the speaker, a signed voice-use release, and confirm the claim "native Seoul-accent speaker, not TTS" stays withdrawn from the maker comment and landing copy until the files ship (F-AUDIO-004 §3.12).
11. **Product: silent switch.** Should lessons play with the iOS ring switch on silent (`playsInSilentModeIOS: true`, F-AUDIO-004 §8.3)? The default in the spec is yes.
12. **Product/pedagogy: sound first, name second** (F-AUDIO-004 AD1). Stage 1 prompts play the sound (가), the letter name (기역) is one optional tap away, and the silent initial ㅇ is spoken by its name 이응. Confirm; also the ear check of 악 안 알 암 압 앙 (owner task before delivery).
13. **Product/art: people are faceless in every story picture and Hoya is a beside-the-event observer** (F-STORY-002 decisions 5, §3.9.10). Confirm the art direction (no invented likeness of historical persons, no skin tone tokens).
14. **Commercial: free story sampler and gating** stay as recorded in review 1 (six stories, gating flagged off until Stripe Live and PNNL approval). New in this round: the free set also governs the Stage 5 books only through the existing, unenforced stage header pill (F-STORY-005 rule 6). Confirm no new pill or gate may appear before payments are live.

Recorded, no action needed unless the owner objects: `MIN_VERIFICATION_PASSES = 3` (binding for this review); the research files live under `content/stories/research/` (PR #104) and are never bundled; `rarity` of story cards is derived, not authored; the `D5` registry tag and the card names are proposals, not decisions.


---

# Appendix A — amendments to the four landed specs

# Amendments to the four landed specs (review 2, 2026-10-10)

The four specs below are in `docs/specs/` (read-only for the reviewer). The seven specs under review change or depend on them in the places listed. Apply with a small `docs(specs)` PR (or inside the PR named in the last column). Nothing here changes a decision of the landed specs; each item removes a contradiction.

| # | Landed spec | Where | Change | Caused by | Apply in |
|---|---|---|---|---|---|
| 1 | F-QUEST-002 | §3.12 (interim spoken forms) | initial ㅇ is spoken by its name 이응, not 아 (same audio as the vowel ㅏ) | F-AUDIO-004 AD2 | F-QUEST-002 Q-3a (or a docs PR before it) |
| 2 | F-QUEST-002 | §3.12 | "F-AUDIO-004 replaces the values, not the shape" -> it replaces the interim file by `JamoSchema` data read through `spokenFor()`; only ㅇ differs | F-AUDIO-004 PR A-2 | same |
| 3 | F-QUEST-002 | §3.2 item 1 (Discover, Hear it) | Hear it plays the sound (for ㅇ the name); the letter name is a separate optional button | F-AUDIO-004 §3.1 | same |
| 4 | F-QUEST-002 | §3.2 (fallback line) | "Say it out loud" shows the spoken romanization (`ga`), not the tile value (`g/k`) | F-AUDIO-004 §3.1 rule 5 | same |
| 5 | F-QUEST-002 | §9 assumption 2 | carrier question closed: ㅏ | F-AUDIO-004 AD2 | same |
| 6 | F-CNT-002 | §3.4 class A scope | the scan skips `content/stories/research/` (provenance data, `rr` keys, hyphenated romanization in one value) | PR #104 + F-STORY-001 §3.1 | F-STORY-001 PR 1.3 |
| 7 | F-CNT-002 | §3.4 class A (R-rules) | an empty `romanization` in a `state: 'draft'` story is a warning, an error in `ready` | F-STORY-001 §3.2.4 | F-STORY-001 PR 1.3 |
| 8 | F-I18N-001 | §3.6 `OVERLAY_FIELDS` | row for id prefix `story:` (field paths in F-STORY-001 §3.12) and the `overlay-token-mismatch` rule | F-STORY-001 | F-STORY-001 PR 1.3 (already stated there) |
| 9 | F-I18N-001 | §3.2 `ProfileSettingsSchema` | additive optional `readToMe?: boolean` | F-STORY-002 §3.4 | F-STORY-002 PR 2.5 (already stated there) |
| 10 | F-QUEST-002 | §3.1 `ko-text.ts` | add two additive exports, `KoTextShape` (un-refined object) and `refineKoText`, because `KoTextSchema` is a `ZodEffects` and cannot be `.extend()`ed | F-STORY-001 §3.2 | F-QUEST-002 Q-1 (PR #103, still open: add to it) or F-STORY-001 PR 1.1a |

Item 1-5 as a diff against the landed file (the amended copy is `F-QUEST-002-discover-check-stage1-complete.md` in this folder):

```diff
--- /Users/ggoboogi/workspace/Hangul_Route/docs/specs/F-QUEST-002-discover-check-stage1-complete.md	2026-10-10 14:17:01
+++ F-QUEST-002-discover-check-stage1-complete.md	2026-10-10 16:13:04
@@ -104,7 +104,7 @@
 
 **Pages.** One page shows one or two items (§3.1). Per `jamo` item (rendered with `KoreanText`, F-I18N-001 §3.5):
 
-1. the glyph large (`touchTarget.hero`-scale type), its romanization (`g/k`, `eu`, ...; for ㅇ `silent/ng`, never `∅`, audit F08) and a **Hear it** button (speaker icon, label, >= `touchTarget.child`);
+1. the glyph large (`touchTarget.hero`-scale type), its romanization (`g/k`, `eu`, ...; for ㅇ `silent/ng`, never `∅`, audit F08) and a **Hear it** button (speaker icon, label, >= `touchTarget.child`; it plays the symbol's **sound** — for the silent initial ㅇ its name 이응 — never the letter name of the other consonants, F-AUDIO-004 §3.1; the letter name is a second, optional **Letter name** button, same spec);
 2. `soundHint` under it ("soft, light g ..."; full draft table in Appendix A);
 3. for a **batchim** item a `SyllableBlock` diagram (new, `packages/design-system/src/components/SyllableBlock/`, tokens only, three boxes initial / vowel / final with the final highlighted) and the line "sits at the bottom of the block";
 4. the example word (`KoreanText` with romanization and gloss) with the syllable block that contains the symbol emphasised (the block is found by Hangul decomposition, `logic/stage1/hangul.ts`), and its picture when `picture` resolves; its own **Hear it** button speaks `example.spokenKo ?? example.ko`.
@@ -112,7 +112,7 @@
 `word` items render the word, romanization (`syllables` joined with a thin separator **in the teaching UI only**, D13), gloss, picture, **Hear it**, and `noteEn` if any.
 
 - **Given** a page opens, **then** nothing autoplays (browsers and iOS block audio outside a gesture, audit AUD-06); the first Hear it button pulses once (static under reduced motion). **When** a Hear it button is tapped, **then** the audio plays through the prompt-audio contract (§3.12) and a tiny "heard" mark appears on that item (a fill-only marker; it never gates Continue).
-- **Given** audio is unavailable or muted (`PlayResult` is `unavailable` or `muted`), **then** the item shows its sound as text — romanization is already visible, and the line "Say it out loud: <romanization>" appears — and nothing else changes (F-001 §3.3 spirit; D6 text fallback).
+- **Given** audio is unavailable or muted (`PlayResult` is `unavailable` or `muted`), **then** the item shows its sound as text — romanization is already visible, and the line "Say it out loud: <spoken romanization>" appears (the romanization of the syllable the voice would have said — `ga` for ㄱ, `ak` for the final ㄱ, `ieung` for ㅇ — F-AUDIO-004's `spokenRomanization`, not the tile value `g/k`) — and nothing else changes (F-001 §3.3 spirit; D6 text fallback).
 - **Given** `romanizationMode === 'tap'` (F-I18N-001 `ProfileSettings.romanizationMode`, read through `useLocaleStore`; **until F-I18N-001 PR 3 exists the mode is the constant `'always'`** and this branch is dead code behind the same `romanizationShown(mode, revealed)` signature, D2 opt-in), **then** romanization on the example word is hidden behind a "Show how to say it" tap; the symbol's own romanization stays visible (it is the thing being taught) and the gloss is never hidden.
 - **Given** the last page and Continue, **then** `advance()` runs and `quest.discover_completed` fires `{ questId, pages, heard }` (`heard` = number of distinct Hear it taps). Back / Leave behaves like any step (run discarded after confirm).
 - **Given** reduced motion, **then** the pulse and the page slide are replaced by an instant change (`platform/motion.ts` `useReducedMotion`, as `ResultsScreen.tsx:54`).
@@ -351,7 +351,7 @@
 export type PlayResult = 'played' | 'muted' | 'unavailable';
 export function playPrompt(spec: { text: string; audioRef?: string; language?: 'ko-KR' | 'en-US' }): Promise<PlayResult>;
 ```
-`text` is `item.spokenKo ?? item.ko`; for a symbol it is `jamo.spokenKo` (consonant spoken as a sound with a carrier vowel, batchim as a short closed syllable such as 악 안 알 암 압 앙; D6, audit F01 / AUD-08), **not** the letter name. If F-AUDIO-004's data is not in yet, Q-3a adds `logic/stage1/spoken.ts` with the interim map (consonant + ㅏ carrier: 가 나 다 라 마 바 사 아 자 차 카 타 파 하; vowels as their ㅇ-syllables 아 야 어 여 오 요 우 유 으 이; batchim as above) used only when `spokenKo` is absent; F-AUDIO-004 replaces the values, not the shape. If F-AUDIO-004 has not added `playPrompt`, Q-3a adds a thin one: `muted` when `isMuted()` (`platform/audio.ts:15-17`), `unavailable` when the speech engine reports an error or no voice exists, else `played` on `onDone`. **Code fact**: `speak()` currently wires `onDone`, `onStopped` **and** `onError` to the same `opts.onDone` (`platform/audio.ts:36-38`), so a failure is indistinguishable from a normal end; the shim therefore adds an optional `onError?: () => void` to `SpeakOptions` (`audio.ts:19-24`, existing callers unchanged) and routes `Speech.speak`'s `onError` to it. `SpeakOptions.language` is `'ko-KR' | 'en-US'` today; widening it to the UI-locale tags (`es-US`) is F-AUDIO-004's change. `audioRef` wins over TTS when a recording exists (D6, owner task T-017).
+`text` is `item.spokenKo ?? item.ko`; for a symbol it is `jamo.spokenKo` (consonant spoken as a sound with a carrier vowel, batchim as a short closed syllable such as 악 안 알 암 압 앙; D6, audit F01 / AUD-08), **not** the letter name. If F-AUDIO-004's data is not in yet, Q-3a adds `logic/stage1/spoken.ts` with the interim map (consonant + ㅏ carrier: 가 나 다 라 마 바 사 자 차 카 타 파 하; **initial ㅇ by its name 이응**, because 아 is the same audio as the vowel ㅏ and the two could not be told apart by ear — F-AUDIO-004 AD2, `spokenKind: 'name'`; vowels as their ㅇ-syllables 아 야 어 여 오 요 우 유 으 이; batchim as above) used only when `spokenKo` is absent; F-AUDIO-004 PR A-2 replaces the interim file by data on `JamoSchema` (`spokenKo`, `spokenRomanization`, `spokenKind`, `nameKo`; read through its `spokenFor()`): the values are the same, the shape is not, and the one value that differs is ㅇ (이응). If F-AUDIO-004 has not added `playPrompt`, Q-3a adds a thin one: `muted` when `isMuted()` (`platform/audio.ts:15-17`), `unavailable` when the speech engine reports an error or no voice exists, else `played` on `onDone`. **Code fact**: `speak()` currently wires `onDone`, `onStopped` **and** `onError` to the same `opts.onDone` (`platform/audio.ts:36-38`), so a failure is indistinguishable from a normal end; the shim therefore adds an optional `onError?: () => void` to `SpeakOptions` (`audio.ts:19-24`, existing callers unchanged) and routes `Speech.speak`'s `onError` to it. `SpeakOptions.language` is `'ko-KR' | 'en-US'` today; widening it to the UI-locale tags (`es-US`) is F-AUDIO-004's change. `audioRef` wins over TTS when a recording exists (D6, owner task T-017).
 
 ### 3.13 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9-33`, so the API whitelist and `track()` stay one list)
 
@@ -519,7 +519,7 @@
 ## 9. Unverified assumptions and open items
 
 1. **Pedagogy and wording are drafts.** Appendix A sound hints, the choice of 60 reading words, the 4-5 minute estimate (blueprint says 3-4) and the "twin sounds" framing for ㅋ ㅌ ㅍ are authored here without a native review or a playtest. Romanization values follow D13 / F-CNT-002 by hand and were **not** run through the `rr.py` converter.
-2. **Interim spoken forms** (`logic/stage1/spoken.ts`) assume a consonant + ㅏ carrier is acceptable for isolated sounds; F-AUDIO-004 may choose another carrier (e.g. ㅡ). Until recordings exist TTS quality varies (audit F09).
+2. **Interim spoken forms** (`logic/stage1/spoken.ts`) assume a consonant + ㅏ carrier is acceptable for isolated sounds; **Closed by F-AUDIO-004 (review 2):** the carrier is ㅏ (AD2) and initial ㅇ is spoken by its name. Until recordings exist TTS quality varies (audit F09).
 3. **Cross-spec contracts not yet implemented in code:** F-STORY-003 `ChoiceCard`, F-STORY-006's award engine, F-AUDIO-004 `playPrompt` / `spokenKo`, F-I18N-001 `KoreanText` / `romanizationShown`, a shared `MinigameHost`. This spec names the member shapes it needs; if a sibling spec lands different names the Q-PRs adapt, not the behaviour.
 4. **`HeritageCardArt` as a vocabulary picture** (stylised card art for 산, 달, 연, 팽이 ...) has not been tested for recognisability at 96 dp on a 320 px screen; the gloss label under each option is the safety net.
 5. **expo-speech error reporting** on web / iOS is the basis of `unavailable`; if it does not fire reliably the text prompt would show only when muted. F-AUDIO-004's capability check is the better signal.
```


---

# Appendix B — telemetry names added by this wave

# Telemetry event names — consolidated list after review 2 (2026-10-10)

Supersedes `TELEMETRY-NAMES.md` (review 1, 26 names for six specs). This file lists **every** name in `TELEMETRY_EVENT_NAMES` on `main`, the names waiting in an open PR, and every name the specs of both review rounds add, with the owner and the PR that adds and emits it. It was cross-checked by script against the text of F-AUDIO-004 and F-STORY-001..006 (every name below appears in the spec that owns it; no spec mentions a name that is not in this file).

Source of truth in code: the `TELEMETRY_EVENT_NAMES` array in `packages/content-schema/src/schemas/telemetry.ts` (lines 9-43 at `c939348`: **32 names**). The learner app's `track()` type and the Worker whitelist (`packages/backend/src/routes/telemetry.ts` -> `isTelemetryEventName`) both read it; an unknown name is rejected with 422 and silently dropped by the client (`apps/mobile/src/platform/telemetry.ts:40-58`).

Rules that apply to every row:

1. **Worker first, app second**: the PR that adds a name to the shared list is deployed to the Worker before the app release that sends it.
2. Every PR that adds a name also updates the exact-list assertion in `packages/content-schema/src/__tests__/telemetry.test.ts` (lines 5-43; the list is `.sort()`ed, so placement is free). `packages/backend/src/__tests__/telemetry.test.ts` iterates the shared list. Several PRs append to the same array: rebase conflicts are mechanical.
3. Payloads carry ids, codes and counts only: no names, no free text, no email, no voice names. `profileId` rides in the envelope. `learnerType` is never sent (owner answer, review 1 question 2).
4. **Convention**: a unit's lifecycle is `<unit>.start` / `<unit>.complete` (`quest.start`, `episode.complete`, `stage.complete`, `review.start`, `card_set.complete`); a step that ends inside a game or a screen is `<thing>.finished` (`minigame.finished`, `story.check.finished`, `story.read.finished`); a discrete user action or observation is past tense (`locale.changed`, `audio.fallback_shown`, `story.sources.opened`). Names are namespaced by the owning feature, never bare. Two namespaces are new in review 2: `audio.` (F-AUDIO-004) and `journey.` (map/grid events, F-STORY-005).

## A. On `main` today (32)

`session.start` · `session.end` · `episode.start` · `episode.complete` · `quest.start` · `quest.complete` · `round.correct` · `round.wrong` · `card.unlocked` · `card.first_earned` · `profile.switch` · `parent.gate.opened` · `onboarding.started` · `minigame.finished` · `space.join.attempted` · `space.join.succeeded` · `space.join.failed` · `space.left` · `space.relink.requested` · `space.relink.approved` · `space.relink.denied` · `paywall.viewed` · `paywall.console_opened` (23 original) · `locale.changed` · `romanization.mode_changed` (F-I18N-001, #100) · `onboarding.who_selected` · `onboarding.level_selected` · `onboarding.consent_given` · `profile.updated` · `pin.created` · `pin.reset_requested` · `pin.reset_completed` (F-LEARN-001, #101).

## B. In an open PR (6): F-QUEST-002 Q-1, PR #103

`quest.discover_completed` `{ questId, pages, heard }` · `quest.check_completed` `{ questId, firstTryCorrect, retries }` · `quest.teaser_tapped` `{ fromQuestId, toQuestId }` · `stage.complete` `{ stageKey, cardsAwarded }` · `review.start` `{ kind, stageKey, hideRomanization }` · `review.complete` `{ kind, stageKey, symbolsCorrect, wordsCorrect, retries, stars }` (internal).

## C. New names of the F-STORY chain (21)

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `story.check.answered` | F-STORY-003 §3.9 | `{ storyId, level, checkId, kind, firstTry, taps }` | 3.1 | 3.4a |
| 2 | `story.check.finished` | F-STORY-003 §3.9 | `{ storyId, level, items, firstTryCorrect, retries }` | 3.1 | 3.4a |
| 3 | `story.sequence.finished` | F-STORY-003 §3.9 | `{ storyId \| null, sequenceId, slots, firstTryCorrect, retries, replayed, skipped }` | 3.1 | 3.5a |
| 4 | `story.recap.word_played` | F-STORY-003 §3.9 | `{ storyId, wordId }` | 3.1 | 3.4b |
| 5 | `story.results.action` | F-STORY-003 §3.9 | `{ questId, storyId, action: 'next-story' \| 'read-again' \| 'episode' \| 'home' \| 'culture-note' }` | 3.1 | 3.7 |
| 6 | `story.shelf.viewed` | F-STORY-004 §3.11 | `{ section: 'story-time' \| 'culture', stories, started, finished }` | 4.3a | 4.5 |
| 7 | `story.opened` | F-STORY-004 §3.11 | `{ storyId, source: 'home' \| 'library' \| 'episode' \| 'results', mode: 'start' \| 'continue' \| 'restart' \| 'play-again' \| 'read-again' }` | 4.3a | 4.4a, 4.5, 4.6 |
| 8 | `home.story_card.shown` | F-STORY-004 §3.11 | `{ storyId, reason: 'continue' \| 'next' \| 'again' }` | 4.3a | 4.4a |
| 9 | `story.bookmark.resumed` | F-STORY-004 §3.11 | `{ storyId, sceneIndex }` | 4.3a | 4.4b |
| 10 | `culture.note.viewed` | F-STORY-004 §3.11 | `{ noteId, storyId }` | 4.3a | 4.7 |
| 11 | `story.locked.tapped` | F-STORY-004 §3.11 | `{ storyId }` (only when gating is switched on) | 4.3a | 4.5 |
| 12 | `story.read.finished` | F-STORY-002 §3.12 | `{ storyId, level, mode: 'quest' \| 'replay', scenes, scenesSeen, linesPlayed, termsOpened }` | 2.1 | 2.6a |
| 13 | `story.sources.opened` | F-STORY-002 §3.12 | `{ storyId, from: 'reader' \| 'end' \| 'episode' \| 'notes' \| 'scene', factId? }` | 2.1 | 2.7 |
| 14 | `story.sources.link_opened` | F-STORY-002 §3.12 | `{ storyId, factId }` (after the grown-up gate, on a successful hand-off) | 2.1 | 2.7 |
| 15 | `journey.cell_stories_opened` | F-STORY-005 §3.11 | `{ stageKey, themeKey, stories, source: 'cell' \| 'lesson-row' \| 'story-pill' }` | 5.5b | 5.5b |
| 16 | `card.catchup_granted` | F-STORY-006 §3.9 | `{ count, episode, stage, welcome, quest, set }` (one per reconcile that adds more than the welcome card) | 6.2 | 6.4b |
| 17 | `card_set.complete` | F-STORY-006 §3.9 | `{ setId, cardsAwarded }` | 6.2 | 6.4b |
| 18 | `audio.capability_checked` | F-AUDIO-004 §3.14 | `{ platform, engine: 'clips+tts' \| 'tts' \| 'clips' \| 'none', koVoice: 'none' \| 'network' \| 'local' \| 'enhanced' \| 'premium', reason? }` (once per session) | A-1 | A-4a |
| 19 | `audio.fallback_shown` | F-AUDIO-004 §3.14 | `{ source, reason: 'muted' \| 'no_voice' \| 'error' \| 'blocked' }` (once per session, source, reason) | A-1 | A-5a, A-5b, 002 2.6a, 003 3.4a |
| 20 | `audio.mute_changed` | F-AUDIO-004 §3.14 | `{ muted, source: 'profile' \| 'fallback_panel' }` | A-1 | A-4a |
| 21 | `audio.playback_failed` | F-AUDIO-004 §3.14 | `{ kind: 'clip' \| 'tts', reason: 'missing' \| 'fetch' \| 'decode' \| 'blocked' \| 'timeout' \| 'engine' }` (at most 3 per session) | A-1 | A-3, A-4a |

`source` values for the two audio events that other specs rely on: `match-sound`, `discover`, `listen-pick`, `trace`, `story-reader`, `story-check`, `story-order`.

**Total after every spec above lands: 32 + 6 + 21 = 59 names.** (Review 1 listed 26 new names; 11 of them are rows 1-11 here, 9 landed in #100/#101, 6 are in #103. Review 2 adds rows 12-21: 10 names.) F-STORY-001 defines no event.

## D. Changed payloads of existing names (no list change; the Worker accepts any payload)

| Name | Change | Owner |
|---|---|---|
| `onboarding.started` | `{ ageGroup, firstRun, hasParentEmail }` -> `{ level, firstRun, hasEmail }` (strict schema in `packages/content-schema/src/schemas/onboarding-telemetry.ts`, PR #101; `learnerType` is never sent, owner answer 2026-10-10) | F-LEARN-001 |
| `card.unlocked` | gains `source: 'quest' \| 'episode' \| 'stage' \| 'welcome' \| 'set'` and optional `episodeId`; retro awards (reconcile) emit none | F-STORY-006 §3.9 |
| `episode.complete` | whitelisted since the start, **finally emitted**: `{ episodeId, cardsAwarded }` | F-STORY-006 §3.3 |

## E. Renames made by review 2

| Old (as drafted) | New | Why |
|---|---|---|
| `story.source.link_opened` | `story.sources.link_opened` | the sibling event is `story.sources.opened`; one namespace segment, not `story.source` next to `story.sources` |

(Review 1 renames stay: `locale.change` -> `locale.changed`, `romanization.mode_change` -> `romanization.mode_changed`, `discover.completed` -> `quest.discover_completed`, `check.completed` -> `quest.check_completed`, `teaser.tapped` -> `quest.teaser_tapped`, `stage.completed` -> `stage.complete`, `review.started/completed` -> `review.start/complete`.)

## F. Checks run

- No duplicate within section C and none collides with sections A or B (script, 59 distinct names).
- Every name in C appears in the spec that owns it and in no other spec under a different spelling (script over F-AUDIO-004 and F-STORY-001..006 and the wireframes; the only other mentions are cross-references, e.g. F-STORY-002 citing F-STORY-004's `story.opened`).
- `stage_anchor_accuracy` (F-RVW-001 §3.4) is superseded by `review.complete` (F-QUEST-002 Q-11 amends F-RVW-001).
- Specs outside both reviews (F-VOC-001..005, F-PLC-001, F-PLAN-002, F-TCH-004, F-LAYOUT-001) must add their names here and follow the convention; they must not reuse any `story.*`, `audio.*`, `journey.*`, `card.*` or `culture.*` name above.
- The web console has no telemetry client (F-I18N-001 §3.12), so no console event is defined.


---

# Owner answers recorded 2026-10-10

| Topic | Decision |
|---|---|
| iOS silent switch | Respected (`PLAY_IN_SILENT_MODE = false`); the visible text prompt keeps every round playable. |
| Class timer and student picker (F-TCH-004) | Teacher tools, outside the learner "no per-question timer" rule; the timer only fills and has no alarm. |
| Student names in the lecture deck URL | Never put names in the URL fragment. Deck carries numbers or initials; first names, if wanted, are passed from the console tab by `postMessage` and not stored. |
