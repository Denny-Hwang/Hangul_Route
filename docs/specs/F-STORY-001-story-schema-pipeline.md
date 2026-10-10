Status: ready

# F-STORY-001 — Story content: schema, sourced facts, JSON pipeline, validator, heritage import, corrections

**Scope**: `packages/content-schema` (story, fact, source, scene-art data shape, episode fields, lint, importer helpers) · `content/stories/` (new directory, approved by D4) · `scripts/` (`validate-content.mjs`, new `build-stories.mjs`, `import-heritage.mjs`, `check-story-versions.mjs`, `check-source-links.mjs`) · `apps/mobile/src/content/` (generated bundle, episode/quest wiring) · `.github/workflows/` (content validation, scheduled link check)
**Owner**: solo dev
**Rollout**: Story mode phase 0 — first spec of the F-STORY chain. Order in §6; nothing here is visible to a learner until F-STORY-002 (reader) and F-STORY-004 (shelf) ship.
**Wireframes**: none — this is a data and tooling spec. Learner-visible consequences (Sources screen, "Traditional tale" label, corrections list) are drawn in `wireframes/story-reader.md` (F-STORY-002).

> **Start order (review 2, 2026-10-10)**: PR 1.0 (docs) and PR 1.5 (`check-story-versions.mjs`, plain Node over JSON files, no schema import) can start now. PR 1.1a/1.1b import `KoTextSchema`, which is **F-QUEST-002 Q-1's `schemas/ko-text.ts` (PR #103, open)**: they start when #103 is merged (or are stacked on its branch); 1.2, 1.3, 1.4 and 1.6 follow 1.1b. The 24 research files are in the repo as `content/stories/research/*.final.json` once PR #104 (open) merges; the importer reads them from there.

Parent / siblings: F-STORY-002 (reader, Sources screen, SceneArt) · F-STORY-003 (checks, Story Order v2) · F-STORY-004 (shelf, Culture notes, `shelf` field) · F-STORY-005 (grid volumes) · F-STORY-006 (episode-completion cards) · F-CNT-001 (language validator) · F-CNT-002 (romanization policy, class A scan of `content/stories/*.json`) · F-I18N-001 (content overlays, `KoreanText`) · F-AUDIO-004 (`audioRef`) · D4 (JSON-first content), D14 (every story statement maps to a sourced fact)

---

## 1. Context

Story mode needs a place for tales to live, a shape that forces every factual sentence to point at a citation, and a pipeline that turns reviewed JSON into the app. Today none of that exists, and the research team has already produced 24 episodes of heritage content (four clusters, three independent verification passes for three of them) that must land in the app **without being re-typed**.

What exists on `main` (HEAD `c939348`, PRs #94-#102 merged; #103 = F-QUEST-002 Q-1 with `ko-text.ts` and #104 = the research files are open; every line below was re-read at review 2):

- **No story schema.** `packages/content-schema/src/index.ts:1-23` exports 17 schema modules and 6 romanization modules (after PRs #100-#102); none is about stories. `EpisodeSchema` has no format/placement/volume and `questIds: z.array(z.string()).min(1)` (`schemas/episode.ts:18`), so all placeholder episodes already fail it (`apps/mobile/src/content/episodes.ts:127-141`, `questIds: []` at `:137`, status `preview`). `QuestStepKindSchema` is `intro | present | practice | apply | reward` (`schemas/quest.ts:8`) and `MinigameKindSchema` ends at `culture-quiz` (`schemas/minigame.ts:16-30`).
- **`content/` holds two JSON files the app never loads** (`content/episodes/stage-1/{jamo,cards}.json`); `content/README.md` is two lines. The app's real content is TypeScript (`apps/mobile/src/content/{episodes,quests,heritage-cards,jamo}.ts`; `episodesAll` at `episodes.ts:201-206`, `questsAll` at `quests.ts:184`) that no validator reads. D4 reverses this for stories: JSON is the source, the app gets a generated module.
- **The language validator is a dependency-free Node script** (`scripts/validate-content.mjs`): Hangul is allowed only in `ko | korean | target | answer_ko | lang_ko` (`:25-32`), such an object must also carry `romanization` and `en`/`gloss_en` (`:84-102`), Hangul anywhere else is `korean-in-ui-field` (`:103-115`), and a banned-word scan runs over `LEARNER_TEXT_FIELDS` (`:49-61`). It walks every `*.json` under `content/` recursively (`:63-75`), which is why test fixtures must **not** live under `content/` (§3.8). PR #104 (open) adds `SKIPPED_DIRS = [content/stories/research]` to that walk (`validate-content.mjs`, with a test), so the verified research files (Korean in `claim_ko`, in source titles) are not scanned as UI text, while shipped story JSON directly under `content/stories/` is. CI runs it from `.github/workflows/content-validation.yml` (zod fixtures via `pnpm --filter @hangul-route/content-schema test`, then `node scripts/validate-content.mjs`).
- **Telemetry, storage and bundle are unaffected** by this spec (no new event, no key). The PWA precaches every exported file (`apps/mobile/scripts/pwa-postbuild.mjs:94`, `globPatterns` includes `js`, `json`, `svg`, `mp3`), so bundled stories work offline with no extra code.

What the heritage research files give us (D14; **all four clusters now have a `*.final.json` with `verification.passes = 3`** — `records-joseon`, `hangul-printing`, `science-art-life`, `seasons-tales`; they are identical to the copies PR #104 saves under `content/stories/research/`; every number below was re-run at review 2 with throwaway scripts that parse exactly those four files, and the schema of §3.2 was checked against all 24 episodes, §3.14):

| Fact | Count | Consequence for this spec |
|---|---|---|
| Episodes / scenes / facts / sources | 24 / 182 / 211 / 576 (191 distinct URLs, 31 hosts) | Not "~150 scenes": the art budget (F-STORY-002) is sized for 182. Facts are 67 % of the bytes (365 KB of 544 KB raw; 80 KB of 138 KB gzip) |
| Shape | `scenes[] {n, narration_en, korean, romanization, gloss_en, illustration, fact_ids}`, `facts[] {id, claim_en, claim_ko, sources[] {title, publisher, url, accessed, quote_or_locator}}`, `vocab[] {ko, rr, en}`, `checks[] {q_en, options[], answer_index, fact_id}`, `reference_display`, `notes`; **verification is per cluster file**, `{passes: 3, checked_at: "2026-10-10", notes}` | One-to-one mapping in §3.10; the cluster record is copied into each episode |
| Scenes per episode / narration | 7-8 / max 45 words, 245 chars | Fits `Tier.scenes` 4..8 and the 45-word rule exactly (the cap is already reached) |
| Scenes with no `fact_ids` | 2 (`story-joseon-records-today` scenes 1 and 8, both pure framing: "Hoya has one more question…") | Needs the explicit `framing` flag of §3.3; any other scene without a fact is an error |
| Digits in narration | 82 numerals, **4 not found in any cited fact**: "almost 600 years ago" (`sejong-new-letters` s1, derived from 1443), "1590s" (`sillok-mountain-archives` s4, fact says 1592), "nearly 300 years" (`joseon-records-today` s5, fact says 288 years), "almost 800 years later" (`tripitaka-koreana` s8, fact says 1237-1248) | These are derived, time-relative statements. They are the reason for the `approximations` mechanism and the number-echo rule (§3.3) |
| Hangul inside English fields | 53 scenes / 81 tokens inside `narration_en` ("These officials were the 사관…"); 43 learning goals; 23 `claim_en`; 8 check prompts; 3 check options; 2 `gloss_en` | Violates F-CNT-001 `korean-in-ui-field` as written. Resolved by inline term tokens `{kw:id}` in learner text and a reference zone for grown-up/reviewer text (§3.4, §3.8) |
| Inline Hangul terms that resolve | 57 of 81 tokens match the episode's `vocab` or a scene's `korean`; 17 are isolated jamo (ㄱ ㄴ ㅏ …, resolvable from `jamo.json`); **7 are undefined** (사초 in a story whose vocab lacks it, 승정원일기, 원행을묘정리의궤, 수원화성문화제, 허준, 이순신, 김홍도) | The importer reports them; romanization and gloss are authored before `ready` |
| Scene Korean | 155 single terms, 27 phrases/sentences (ending `.?!` or 3+ words); 62 of 182 `korean` strings are not in `vocab`; 51 of 171 vocab words are never a scene's focus | `keyword` vs `line` split; vocab entries not used as a focus stay in the glossary |
| Scene Korean vs `vocab` for the same word | 120 of 182 scene `korean` strings are also a `vocab.ko`; for **29** of them the scene's `gloss_en` differs from the vocab gloss (contextual or longer: "Hangul Day (October 9)" vs "Hangul Day"), for **5** the romanization differs only in capitalisation (`seollal` / `Seollal`) | A rule "the embedded scene copy equals the keyword entry" would fail 34 scenes. §3.2.2 item 3: `ko` equal, romanization equal ignoring case, the gloss may be scene-specific |
| Hangul spans in narration | 81 single-word runs form **66 spans** (a quoted phrase such as 비가 와요 or a jamo list is one span); 18 spans match no vocab/scene Korean: 11 are isolated-jamo spans (one is the list ㄱ ㄴ ㅁ ㅅ ㅇ) and the 7 undefined terms; the other 48 equal a vocab entry or a scene's `korean` (word or quoted phrase) | The importer matches the longest span first, then word by word (§3.4); a phrase needs a keyword of `kind: 'phrase'` to carry its token |
| Checks | exactly 3 per episode (72), 37 with 3 options and 35 with 4, correct option at index 0 in **17 of 72** (25 at 2, 21 at 1, 9 at 3); the longest option string is **79 characters** (`hangeul-day` check 2; the next longest is 63) | Matches F-STORY-003; the answer-position rule is a corpus lint; F-STORY-003's option cap is raised from 70 to **80** (`CHECK_LIMITS.option`) so this option imports unchanged, and a warning `check-option-long` (> 70) keeps it on the author's list |
| Sources | every fact has >= 1 source on `.go.kr`, `unesco.org` or `encykorea.aks.ac.kr` (0 exceptions in 211); **1 `http://` URL** (`treestory.forest.or.kr`, `hangul-printing` f6); 8 facts with 1 source, 82 with 2, 88 with 3, 33 with 4-7; `accessed` is 2026-10-09 (481) or 2026-10-10 (95) | The "authoritative source" and https rules start clean except the one URL |
| Folk tales | 2 (`sun-and-moon`, `pansori-tales`); notes say "Traditional tale: narration describes what happens in the tale, not history" | The `origin` / "Traditional tale" label rule (§3.5) formalises what the researchers did by hand |
| Romanization | 1 hyphenated value in 182 scenes (`Jang Yeong-sil`, `jagyeongnu` s2) and none in 171 vocab entries; titles have **no** romanization | F-CNT-002 R2 fails the one hyphen; 24 title romanizations are authored |
| Style | English prose spells the script "Hangeul" 6 times and "Hangul" once; the app and CLAUDE.md say "Hangul" | Style lint (warning) |

## 2. User story

> As a content owner I want every story to carry its citations in the file itself, every claim in the narration to point at a cited fact, and CI to refuse anything else — so I can show a parent or a reviewer exactly where each statement comes from, and fix it in one place if it is ever wrong.

Companion stories:

- As a **content author** I want to import the 24 researched episodes mechanically, see a precise list of what is still missing (captions, art, explanations, 7 term glosses, 24 title romanizations), and never retype a source.
- As a **reviewer** I want a story to say how many independent verification passes it had and when, and I want corrections to be a visible, dated list rather than a silent edit.
- As a **learner or grown-up** I want a traditional tale to say it is a tale, and I want the app to show updated facts after an update without losing my progress.

## 3. Acceptance criteria

### 3.1 Files and directories

- **`content/stories/<slug>.json`**, one file per tale, flat (no theme sub-folders; `theme` is a field). `<slug>` is the story id without `story:` (`story:sillok-royal-historians` → `sillok-royal-historians.json`). A test asserts file name = slug. New directory approved by D4; CLAUDE.md §2 lists it (F-I18N-001 PR 0 makes that single charter edit). `content/stories/README.md` documents authoring (the validator only reads `.json`).
- **Story state**: `state: 'draft' | 'ready'`. `draft` = imported or in authoring: validated by `StorySchema` (authored-later fields may be empty, §3.2.4) plus every **fact and source rule**; **not bundled** into the app (the generator skips it unless `--include-drafts`, used only by `/design-preview`). `ready` = `StoryReadySchema` passes in full (`parseStory` picks the right one) and the story is bundled. `ready` does not mean visible: F-STORY-004 hides stories whose `review.language` is not `native-reviewed` or `review.culture` is not `culture-reviewed`, and a shelf needs `verification` (§3.6).
- **Test fixtures** (valid and invalid stories) live in `packages/content-schema/src/__fixtures__/story/*.json`, **outside `content/`**, because `scripts/validate-content.mjs:63-75` walks all of `content/` and would fail on deliberately invalid fixtures.
- **Generated output**: `apps/mobile/src/content/stories.generated.ts` (checked in, §3.9). Hand-written wiring stays in `apps/mobile/src/content/stories.ts`.
- **Research source (provenance, never bundled)**: `content/stories/research/<cluster>.final.json` + `.signoff.md` + `.changes.md` (PR #104). The importer (§3.10) reads them from there. The sub-directory is skipped by `validate-content.mjs` (PR #104) and by `story-content.test.ts` (which reads only `content/stories/*.json`, non-recursively), so the research files are never mistaken for a story and never shipped. They stay in the repo after the import as the audit trail of the three verification passes.

### 3.2 Schema — `packages/content-schema/src/schemas/story.ts` (new, exported from `src/index.ts`)

Shared pieces (one owner and one name per concept across the F-STORY specs):

| Piece | File | Owner of the definition | Created by |
|---|---|---|---|
| `KoTextSchema`, `PictureRefSchema` | `schemas/ko-text.ts` | **F-QUEST-002 Q-1** (PR #103, open; `{ ko, romanization, en, spokenKo?, audioRef?, syllables? }`) | Q-1. This spec never creates it. `KoTextSchema` is a `ZodEffects` (it has a `superRefine`: `syllables.join('') === romanization`), so `.extend()` does not exist on it; PR 1.1a adds two **additive exports** to that file (into Q-1 itself if it is still open): **`KoTextShape`** (the un-refined `z.object`) and **`refineKoText`** (the syllable rule). Every Korean-text shape of a story that a draft may leave unfinished (`title`, `keywords[]`, a scene's `keyword` / `line`) is built with one helper in `schemas/story.ts`: `koTextExtend(extra) = KoTextShape.extend({ romanization: z.string().trim().max(120), en: z.string().trim().max(200), ...extra }).strict().superRefine(refineKoText)` — the same shape as `KoTextSchema` except that `romanization` / `en` may be `''` in a draft (the ready rule, §3.2.2 item 6, makes them required). Shapes that must be complete from the first commit (`check.target`, `culture note term`, `connective`, `line.words[]`) use the strict `KoTextSchema` directly |
| `SceneArtSchema`, `ART_CANVAS` | `schemas/scene-art.ts` | this spec (§3.2.3 data shape); meaning and renderer: F-STORY-002 §3.9 | PR 1.1a |
| `StoryCheckSchema`, `CheckOptionSchema`, `CheckKindSchema`, `CHECK_LIMITS` | `schemas/story-check.ts` | **F-STORY-003 §3.1** (the text of the schema) | **PR 1.1a, verbatim from F-STORY-003 §3.1**, with one difference: `explainEn` is **optional** in the schema and made required by the `ready` rule (§3.2.2 item 6), so the 72 imported drafts parse. F-STORY-003 PR 3.1 adds only the `story-check` minigame kind, the telemetry names and further tests. `Tier.checks` / `Tier.checkpoints` use `StoryCheckSchema`; the narrower twin (`CheckSchema` with its own `CheckOptionSchema`) that an earlier draft of this spec defined is deleted, so the package index never exports two `CheckOptionSchema` |
| `StoryShelfSchema` | `schemas/story.ts` | **this spec** (shape, below); the product rules (categories, order, sampler) are F-STORY-004 §3.1, which consumes it | PR 1.1b |
| `PillarTagSchema`, `CompanionIdSchema`, `CatalogueFieldsSchema` | `pillars.ts` | **F-STORY-005 §3.2** (text of the three schemas; the registry `PILLAR_TAGS` and its lint are 005 PR 5.1) | PR 1.1a creates the file with the three schemas only (`pillarTags` max 3, `companionId` = `'hoya'`) |
| `StoryCardSchema` | `schemas/story.ts` | **F-STORY-006 §3.8** (rules, lint, back face) | PR 1.1b (shape below); 006 PR 6.7 adds the lint rules and the builder, not the schema |

All objects are `.strict()`: an unknown key is an error, never silently dropped (a typo such as `narationEn` must not pass). **zod 3 limitation that shapes the design** (`packages/content-schema/package.json`: `zod ^3.23.8`): `z.discriminatedUnion` accepts only plain `ZodObject` options, and `.superRefine()` returns a `ZodEffects`, so "a union of a draft schema and a ready schema, both refined" cannot be written (verified at review 2 against the installed zod 3.25.76: `z.discriminatedUnion('k', [refinedObject, plainObject])` throws; a `ZodEffects` has `innerType()` but no `.extend()`). There is therefore **no union**: one strict object, one cross-field refinement that runs for both states, and a second refinement that adds the `ready`-only requirements.

#### 3.2.1 Top level

```ts
export const STORY_SCHEMA_VERSION = 1;
export const StoryIdSchema = z.string().regex(/^story:[a-z0-9]+(-[a-z0-9]+)*$/);
export const StoryLevelSchema = z.enum(['listen', 'read-along', 'read']);       // F-STORY-003 StoryLevel
export const StoryKindSchema = z.enum([
  'folk-tale', 'myth', 'fable',                                                 // "tale" kinds (traditional-tale rule, §3.5)
  'documentary', 'site', 'intangible', 'object', 'science', 'art', 'daily-life', // the research files' heritage_type, plus daily-life
]);
export const TALE_KINDS = ['folk-tale', 'myth', 'fable'] as const;

export const StoryObjectSchema = z.object({
  v: z.literal(1),
  id: StoryIdSchema,
  state: z.enum(['draft', 'ready']),
  contentVer: z.number().int().min(1),                 // §3.7
  title: koTextExtend({}),                              // Korean title + romanization + English title; draft: romanization/en may be ''
  summaryEn: z.string().trim().min(1).max(320),         // measured max in the research set: 314
  hoyaIntroEn: z.string().trim().min(1).max(160).optional(),   // quest intro line (generator, §3.9); required when ready + shelf
  hoyaOutroEn: z.string().trim().min(1).max(160).optional(),   // quest reward line
  theme: ThemeKeySchema,                                // letters | life | rites | nature | crafts (D9: the five theme keys)
  kind: StoryKindSchema,
  recommendedStage: z.number().int().min(1).max(7),     // advisory only: the research files' recommended_stage; placement is F-STORY-004/005
  minutes: z.number().int().min(2).max(10),
  learningGoalsEn: z.array(z.string().trim().min(1).max(200)).min(2).max(6), // grown-up/teacher text; reference zone (3.8): Hangul allowed, each as "한글 (romanization)"; measured: 3-4 goals, longest 191
  origin: z.object({
    type: z.enum(['traditional', 'adapted', 'original', 'documented']),
    noteEn: z.string().trim().min(1).max(240),
    retellingNoteEn: z.string().trim().min(1).max(240).optional(),   // "retold gently; versions differ"
  }).strict(),
  review: z.object({
    language: z.enum(['draft', 'native-reviewed']),     // names read by F-STORY-004
    culture: z.enum(['draft', 'culture-reviewed']),
    advisory: z.array(z.enum(['mild-peril', 'loss', 'trickery', 'war', 'historical-hardship'])).default([]),
    advisoryNoteEn: z.string().trim().min(1).max(140).optional(),   // required when advisory is non-empty
    reviewedBy: z.string().trim().min(1).max(8).optional(),         // initials
    reviewedAt: IsoDateSchema.optional(),
  }).strict(),
  keywords: z.array(KeywordSchema).min(1).max(24),       // measured on the research set after adding scene Korean to the vocab: mean 9.7, max 13
  cultureNotes: z.array(CultureNoteSchema).max(3),      // 0..3; the lint warns on 0 (F-STORY-004 handles "no notes")
  tiers: z.array(TierSchema).min(1).max(3),             // unique levels; heritage launch = one 'listen' tier
  coverSceneId: SceneIdSchema,                          // must exist in at least one tier (the first tier that has it is the cover source)
  rewardCardIds: z.object({ listen: CardIdSchema.optional(), read: CardIdSchema.optional() }).strict().optional(), // award rules are F-STORY-006
  shelf: StoryShelfSchema.optional(),                   // present iff the story has a shelf episode (F-STORY-004)
  pillarTags: z.array(PillarTagSchema).max(3).default([]),   // F-STORY-005 §3.2 (blueprint 04 A1..E5); first = primary
  companionId: CompanionIdSchema.default('hoya'),            // F-STORY-005 §3.7
  card: StoryCardSchema.optional(),                          // F-STORY-006 §3.8; present iff the story has its own heritage card
  facts: z.array(FactSchema).min(1).max(16),            // measured max 12
  referenceDisplay: z.string().trim().min(1).max(300),  // one headline line, e.g. "Sources: 국가유산청 …"; reference zone; measured max 274
  verification: VerificationSchema,                     // §3.6
  authorNotes: z.string().trim().max(3000).optional(),  // the research file's `notes` (what was omitted and why); reference zone, never shown to learners; measured max 2654
  errata: z.array(ErratumSchema).default([]),           // §3.7
}).strict();

export const StoryCardSchema = z.object({               // F-STORY-006 §3.8
  titleEn: z.string().trim().min(1).max(28),
  keywordId: z.string(),                                // resolves into keywords[]; the headword (Korean + romanization) of the card
  factId: FactIdSchema,                                 // resolves into facts[]; the back-face fact (rules in F-STORY-006: <= 180 chars, >= 2 sources)
}).strict();                                            // rarity is derived from recommendedStage (F-STORY-006), not stored

export const StorySchema = StoryObjectSchema.superRefine(storyCrossFieldRules);   // §3.2.2 items 1-5 and the structural parts of §3.3, for BOTH states
export const StoryReadySchema = StorySchema.superRefine(storyReadyRules);         // §3.2.2 item 6; applied to files with state 'ready'
export type Story = z.infer<typeof StoryObjectSchema>;
export function parseStory(json: unknown): Story {      // the one entry point used by the content test, the generator and the importer's self-check
  const s = StorySchema.parse(json);
  return s.state === 'ready' ? StoryReadySchema.parse(s) : s;
}
```

```ts
export const StoryShelfSchema = z.object({               // product rules: F-STORY-004 §3.1
  category: z.enum(['story-time', 'culture']),           // Library section the story appears in
  order: z.number().int().min(1).max(999),               // position inside the category; also the order "next story" walks
  sampler: z.boolean().default(false),                   // member of the intended free set (D5); read only through isFreeContent
  minutes: z.number().int().min(2).max(10),              // shown on the tile; lint `shelf-minutes-mismatch` when !== story.minutes
}).strict();
```

**Why `.strict()` plus every cross-spec field now**: stripping an unknown key silently is how a reviewed field disappears; so every field another spec adds to a story has its slot from day one: `shelf` (F-STORY-004), `pillarTags` and `companionId` (F-STORY-005), `card` and `rewardCardIds` (F-STORY-006), `errata`. Those specs consume the slot and add rules; none of them amends this schema (the review of 2026-10-10 settled the open point where F-STORY-005 and F-STORY-006 each said they would amend a strict schema).

#### 3.2.2 Keywords, lines, scenes, tiers

```ts
export const KeywordSchema = koTextExtend({                // koTextExtend: §3.2 table, row ko-text
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),     // from the romanization, lower-cased, non-alphanumerics to '-' (`jamo-g` for isolated jamo); unique in the story, `-2` suffix on collision
  kind: z.enum(['word', 'term', 'jamo', 'phrase']).default('word'),   // 'phrase' = a quoted line that narration cites with a {kw:} token (§3.4); 'term' = a proper name or concept
  art: z.string().regex(/^(prop|card):[a-z0-9-]+$/).optional(),  // picture for pic-word matching (F-VOC)
});
export const StoryLineSchema = koTextExtend({
  speaker: z.enum(['narrator', 'hoya', 'character']).default('narrator'),
  words: z.array(KoTextSchema).min(2).max(8).optional(),         // optional word-by-word glosses for tap-for-gloss (F-STORY-002 §3.5)
});

export const SceneSchema = z.object({
  id: SceneIdSchema,                                    // /^s[0-9]{1,2}$/, stable across edits: art, checks and sequences refer to ids, bookmarks to the index
  narrationEn: NarrationSchema,                         // <= 320 chars, <= 45 words, may contain {kw:<keywordId>} tokens (3.4)
  captionEn: z.string().trim().min(1).max(48).optional(),     // F-STORY-003 sequence caption; required when ready
  keyword: KeywordSchema.optional(),                    // the scene's one Korean word: `id` of a keywords[] entry plus this scene's own `ko`, `romanization`, `en` (§3.2.2 item 3: the gloss may be scene-specific)
  line: StoryLineSchema.optional(),                     // the scene's Korean phrase or sentence
  factIds: z.array(FactIdSchema).max(4).default([]),    // §3.3
  framing: z.boolean().default(false),                  // true = no factual claim at all (greeting, question, thanks)
  approximations: z.array(ApproximationSchema).max(3).default([]),   // §3.3
  art: SceneArtSchema.optional(),                       // §3.2.3
  artPending: z.boolean().optional(),                   // explicit "text-only tile for now" (F-STORY-003 §3.8)
  artBrief: z.string().trim().min(1).max(300).optional(),  // the research file's `illustration` text; provenance for the illustrator, never rendered
  cultureNoteId: z.string().optional(),                 // F-STORY-002 "Did you know?" chip
  checkpointId: z.string().optional(),                  // inline question after this scene (F-STORY-002 §3.7)
  narrationAudioRef: z.string().optional(),             // MP3 path for the narration (F-AUDIO-004); TTS when absent
});

export const TierSchema = z.object({
  level: StoryLevelSchema,
  scenes: z.array(SceneSchema).min(4).max(8),
  checks: z.array(StoryCheckSchema).min(3).max(5),      // F-STORY-003 §3.1 (schema file: this spec PR 1.1a); measured: exactly 3 per research episode
  checkpoints: z.array(StoryCheckSchema).max(2).default([]),
  sequenceSceneIds: z.array(SceneIdSchema).length(4),   // the four Story Order cards, in the correct (story) order
  newKeywordIds: z.array(z.string()).max(4),            // the words the recap highlights
  grammarFocusEn: z.string().trim().min(1).max(100).optional(),
  connective: KoTextSchema.optional(),
});
```

Small shared schemas used above:

```ts
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const SceneIdSchema = z.string().regex(/^s[0-9]{1,2}$/);
export const FactIdSchema = z.string().regex(/^f[0-9]{1,3}$/);
export const CardIdSchema = z.string().regex(/^card:[a-z0-9-]+$/);          // HeritageCardSchema.id grammar
export const NarrationSchema = z.string().trim().min(1).max(320);            // word cap and token rules are lint rules (3.8), so drafts report them with a path
export const CultureNoteSchema = z.object({                                   // F-STORY-004 §3.1
  id: z.string().regex(/^cn-[a-z0-9-]+$/),
  titleEn: z.string().trim().min(1).max(60),
  bodyEn: z.string().trim().min(1).max(220),
  term: KoTextSchema,                                                         // strict: a note's Korean needs romanization + gloss from the first commit
  cardId: CardIdSchema.optional(),
  factIds: z.array(FactIdSchema).min(1).max(3),                               // a note without a sourced fact fails CI (D14)
}).strict();
// StoryCheckSchema / CheckOptionSchema: imported from './story-check' (F-STORY-003 §3.1), not redefined here.
```

Cross-field refinements (item 1-5 are `storyCrossFieldRules`, run for `draft` and `ready`; item 6 is `storyReadyRules`, `ready` only; §3.2.4):

1. Every scene has **exactly one** of `keyword` | `line` at level `listen`; `line` at `read-along` / `read`; `keyword` is optional there. The accessor **`sceneKorean(scene): KoText | undefined`** (`line ?? keyword`) is exported from the package and is the **only** way other specs read "the scene's Korean" (F-STORY-003 `sequence-cards.ts` and `recap.ts` use it).
2. Scene ids unique within a tier; `coverSceneId`, `sequenceSceneIds` (strictly increasing in scene order), `checkpointId`, `cultureNoteId` resolve; `newKeywordIds` ⊆ `keywords[].id` and each is used in the tier.
3. A scene's `keyword` (and a scene `line` whose `ko` equals a `kind: 'phrase'` keyword's `ko`) must name a `keywords[]` entry by `id` and agree with it on `ko` exactly and on `romanization` **ignoring case** (lint `keyword-inconsistent`, error). The `en` gloss **may differ**: the research files give a word a context-specific gloss in the scene ('Hangul Day (October 9)') and a shorter one in the vocabulary list ('Hangul Day'), 29 of 182 scenes today. The scene copy is what F-STORY-003/004 read through `sceneKorean()`; the `keywords[]` gloss is what the reader's tap-for-gloss chip and the recap show. A scene gloss that is empty falls back to the keyword's.
4. Check ids unique across `checks` + `checkpoints` in a tier; every `factIds` entry of a check or culture note resolves into `facts[]`.
5. `review.advisory` non-empty ⇒ `advisoryNoteEn`. `origin.type` rules: §3.5.
6. `state: 'ready'` additionally requires (`storyReadyRules`): `title.romanization` and `title.en` non-empty; every scene has `captionEn` and either `art` or `artPending: true`; every check **and checkpoint** has `explainEn` (optional in `StoryCheckSchema`, so drafts parse); every keyword has `romanization` and `en`; `hoyaIntroEn` / `hoyaOutroEn` when `shelf` is present; `sequenceSceneIds` captions exist; `card.keywordId` / `card.factId` resolve when `card` is present (F-STORY-006 lint adds the length and source rules).

#### 3.2.3 `SceneArt` (data shape; F-STORY-002 §3.9 owns meaning)

```ts
export const ART_CANVAS = { width: 400, height: 300 } as const;          // 4:3, shared by renderer and schema
export const ArtLayerSchema = z.object({
  ref: z.string().regex(/^(hoya|prop|card):[a-z0-9-]+$/),                 // same grammar as F-STORY-003 ArtRef minus `scene:`
  x: z.number().min(0).max(400), y: z.number().min(0).max(300),           // anchor point (bottom-centre of the item)
  s: z.number().min(0.2).max(3).default(1),
  flip: z.boolean().optional(),
  z: z.enum(['back', 'mid', 'front']).optional(),                         // default from the registry
  tint: z.string().regex(/^[a-z]+\.[A-Za-z0-9]+$/).optional(),            // a colour-token path, e.g. "theme.rites"; validated against the token table by F-STORY-002
});
export const SceneArtSchema = z.object({
  setting: z.string().regex(/^scene:[a-z0-9-]+$/),                        // the background set (registry in F-STORY-002)
  layers: z.array(ArtLayerSchema).max(8),
  altEn: z.string().trim().min(1).max(140),                               // required: this is the screen-reader description
}).strict();
```

#### 3.2.4 Draft vs ready

There is **one** object schema (`StoryObjectSchema`), so draft and ready cannot diverge. A `draft` file may carry the fields below **empty** (the string `''`, or absent where the field is optional) and still parse: `title.romanization`, `title.en`, `keywords[].romanization` / `en`, `scene.captionEn`, `scene.art` / `artPending`, `check.explainEn`, `hoyaIntroEn`. `storyReadyRules` (§3.2.2 item 6) turns every one of them into an error when `state === 'ready'`. **Everything in §3.3 (facts, sources, coverage), every Hangul-zone rule and every length cap applies to drafts too** — a draft may be incomplete, never wrong. (An empty string is allowed by writing those fields as `z.string().trim().max(n)` in the object schema and `.min(1)` in the ready rule; the cap itself is always enforced.)

> Cross-spec note for F-CNT-002 (class A scan): an empty `romanization` is a **warning in a `state: 'draft'` story** and an error in `ready`; the converter's suggestion is printed either way. Without this, the 24 imported drafts could not be committed before their titles are romanized.

### 3.3 Facts, sources and the coverage rule (D14)

```ts
export const SourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  publisher: z.string().trim().min(1).max(120),
  url: z.string().url(),                                  // https only (lint source-url-not-https); no spaces, no fragment-only
  accessed: IsoDateSchema,                                // YYYY-MM-DD
  quoteOrLocator: z.string().trim().min(1).max(500),      // short supporting excerpt, section or page — the research key `quote_or_locator`
}).strict();

export const FactSchema = z.object({
  id: z.string().regex(/^f[0-9]{1,3}$/),
  rev: z.number().int().min(1).default(1),               // bumps when claim or sources change (3.7)
  scope: z.enum(['documented', 'in-the-tale']).default('documented'),
  claimEn: z.string().trim().min(1).max(600),             // the exact claim the narration relies on — the research key `claim_en`
  claimKo: z.string().trim().min(1).max(300),             // reference zone (Hangul allowed)
  sources: z.array(SourceSchema).min(1).max(8),
}).strict();

export const ApproximationSchema = z.object({
  text: z.string().min(1).max(40),                        // exact substring of the scene's narrationEn, e.g. "almost 600 years"
  factIds: z.array(z.string()).min(1).max(3),             // the facts it is derived from
  rationaleEn: z.string().trim().min(1).max(160),         // "1443 to 2026 is 583 years; narration rounds it"
  timeRelative: z.boolean().default(false),               // true = depends on today's date ("years ago"); re-checked yearly
}).strict();
```

**The coverage rules** (all in `lintStory`, §3.8; `error` unless noted):

- **C1 Every non-framing scene cites.** `scene.factIds.length >= 1` unless `scene.framing === true`. At most 2 framing scenes per tier and at most 25 % of its scenes (`framing-scene-limit`). A framing scene must contain **no digit and no number word** (two..twelve, twenty..million) and no `{kw:}` token whose keyword is a `documented` term (a greeting is fine; a date is not) — `framing-scene-with-claim`.
- **C2 Every reference resolves.** Each `scene.factIds`, `check.factIds`, `cultureNote.factIds`, `approximation.factIds` exists in `facts[]` (`fact-unknown`). A fact referenced from nowhere is `fact-unused` (warning: dead data is a review burden).
- **C3 Every fact is sourced.** `sources.length >= 1`; at least one source whose host is *authoritative* (`AUTHORITATIVE_HOST_SUFFIXES = ['.go.kr', 'unesco.org', 'encykorea.aks.ac.kr', 'itkc.or.kr', 'snu.ac.kr']`, from the research brief's preferred list) — `fact-no-authoritative-source`. A fact whose `claimEn` contains a digit (a date or a number) needs `>= 2` sources — `fact-numeric-single-source` (the brief: "at least two sources for dates and numbers"). Today: 0 violations of the first, 0 of the second (all 8 single-source facts are digit-free).
- **C4 Sources are well-formed.** `url` parses, scheme `https:` (`source-url-not-https`; the one `http://treestory.forest.or.kr/…` URL in `hangul-printing` f6 must be replaced by an https page or the source dropped, the fact keeps its other sources); no whitespace; host not `localhost`. `accessed` is a real date, not in the future, not before 2026-01-01 (`source-accessed-invalid`); older than 365 days relative to the lint date is a **warning** `source-stale` (the lint date is `HANGUL_ROUTE_TODAY` or the current UTC date, so tests are deterministic). A source host that is not in `SOURCE_HOST_ALLOWLIST` (`packages/content-schema/src/story-sources.ts`, seeded with the 31 hosts of the research set) is a warning `source-host-unlisted`: adding a host is a one-line, reviewed PR.
- **C5 Numbers echo.** Every numeral in `narrationEn` (`\d[\d,.]*`, after `{kw:…}` tokens are removed) must appear (comma-insensitive) in the `claimEn` of one of the scene's cited facts, **or** be covered by an `approximations` entry whose `text` contains it and whose `factIds` are cited by the scene (`narration-number-unsupported`). Number words two..twelve, twenty..million that are not echoed give a warning `narration-number-word-unmatched`. A phrase of the shape `(almost|nearly|about|around|over|more than) <number> years` without an `approximations` entry gives `narration-approximation-unmarked`. An `approximations[].text` that is not a substring of the narration is `approximation-text-missing`. A `timeRelative` approximation is a **warning** every run (`approximation-time-relative`) so the yearly review sees it. On the research set this rule finds exactly the four sentences in §1.
- **C6 No statement beyond the facts.** Mechanically unprovable, so it is a process rule: the verification record (§3.6) states that a reviewer compared every sentence to its facts; the contact sheet (F-STORY-002 §3.9.6) shows narration beside the cited claims and sources; and a PR that touches `narrationEn` or `facts` carries the "claims audit" checkbox of the PR template (§6, PR 1.0).
- **C7 Checks cite too.** `check.factIds >= 1`; `explainEn` (<= 140 chars, F-STORY-003) is authored from the cited fact.

`scope`: `documented` = a statement about the real world (a date, an object, a person, a custom); `in-the-tale` = what a traditional tale says happens. Lint: `in-the-tale` facts must not contain a four-digit year (`tale-fact-with-date`); a story whose `kind` is a tale kind and whose facts are all `documented` is a warning (it probably states legend as history). The importer sets `in-the-tale` for facts of `folk-tale` episodes unless the claim contains a year, "UNESCO", "designated" or "National" (reported, for a human to confirm).

### 3.4 Korean in learner text: inline term tokens

Learner-facing English fields never contain Hangul (F-CNT-001; F-I18N-001 rule 5). Where narration, a culture note or a check prompt names a Korean term, the field carries a token **`{kw:<keywordId>}`** (pattern `\{kw:[a-z0-9-]+\}`). The reader renders it as a `KoreanText` chip (Korean + romanization, gloss on tap — F-STORY-002 §3.5); a check prompt uses F-STORY-003's single `{target}` token instead.

- Rules: every token resolves to `keywords[].id` (`narration-token-unknown`); no `{`/`}` outside a token (`narration-brace`); a token counts as one word for the 45-word cap; a locale overlay of the field must contain **exactly the same token multiset** (`overlay-token-mismatch`, added to F-I18N-001's overlay rules by PR 1.3).
- Isolated jamo (`ㄱ`, `ㅏ`) are keywords with `kind: 'jamo'`, `romanization` the sound and `en` like "the consonant letter giyeok" (the importer reads sound and name from `content/episodes/stage-1/jamo.json`, whose `romanization` is `"g (giyeok)"`).
- **What one token stands for.** A token replaces a maximal *Hangul span* of the research narration (Hangul runs joined by single spaces). Resolution order, per span: (1) the whole span equals a keyword's `ko` (a word, or a `kind: 'phrase'` keyword for a quoted line such as 비가 와요 — 66 spans in the research set, 48 of them resolve this way); (2) else the span is split at the spaces and each word resolves on its own (the jamo list ㄱ ㄴ ㅁ ㅅ ㅇ becomes five adjacent tokens); (3) a word that matches nothing is reported (the 7 undefined terms and the 11 isolated-jamo spans resolve through `jamo.json` or the author). A phrase keyword is created from the scene's own `korean` string when it is quoted in the narration, so `keywords[]` stays the one list a token can name; measured maximum after this: 13 keywords per story (cap 24).
- Authoring helper: `parseNarration(text, keywords): Array<{ text: string } | { kw: Keyword }>` (pure, in `packages/content-schema/src/narration.ts`, shared by the reader, the lint and the overlay check; unknown token → throws in the lint, renders the bare id text in the app so a bad bundle never shows `{kw:…}`).
- Hangul-bearing **reference text** (facts, sources, `referenceDisplay`, `learningGoalsEn`, `authorNotes`, `verification.notes`, `errata[].detailEn`) is exempt from the Hangul-placement rules in files under `content/stories/` only (§3.8). It is never rendered on a learner screen except the Sources screen (grown-up text, F-STORY-002 §3.8), where the Korean institution names are bibliographic data.

### 3.5 Traditional tales are labelled (rule T)

`origin.type` is `traditional` for a story told as a folk tale, myth or fable with no single documented author, `adapted` for a retelling that changes the plot materially (never used for the launch set), `original` for a story we wrote, `documented` for heritage that is history (the other 22 launch stories).

- **T1** `kind ∈ TALE_KINDS` ⇔ `origin.type ∈ {traditional, adapted}` (`tale-kind-origin-mismatch`).
- **T2** The first scene's `narrationEn` contains a tale word (`tale|story|legend|myth|fable|folk|song`, whole-word, case-insensitive) — `tale-first-scene-unframed`. The researchers already wrote "This is an old Korean folk tale, told in many versions." Narration of a traditional story may describe *what happens in the tale*; it may not say a tale event "really happened".
- **T3** A traditional story has `origin.noteEn` (which sources the basic version follows) and `retellingNoteEn` (in learner-safe words: "shortened and made gentler; versions differ"). Both launch tales were softened on purpose and say so in their research notes (`sun-and-moon`: the tiger eating the mother, the demands for limbs, the axe and the tiger's death are left out; `pansori-tales`: beatings, the broken leg and the turtle's fate are left out), which the importer keeps verbatim in `authorNotes`. `review.advisory` then lists `mild-peril` / `trickery` with a one-line note (`tale-without-retelling-note` is an error when `retellingNoteEn` is missing).
- **T4** **The label**: every surface that shows a traditional or adapted story shows the **"Traditional tale"** pill (`origin.type`), never colour alone: the reader header and start card, the shelf tile (F-STORY-004), the episode page, and the top of the Sources screen. Copy lives in the message catalogue (`story.originLabel.traditional` etc., F-I18N-001) — English "Traditional tale", Spanish "Cuento tradicional", Korean "전래 이야기" are **proposals for the native reviewers**.
- **T5** `in-the-tale` facts per §3.3. The Sources screen titles them "What the tale says" and the `documented` ones "What we know".

### 3.6 Verification and review

```ts
export const VerificationSchema = z.object({
  passes: z.number().int().min(0).max(9),       // independent verification passes completed
  checkedAt: IsoDateSchema,                     // the research file's checked_at
  scope: z.enum(['story', 'cluster']).default('story'),  // 'cluster' = the record was written for the whole research file
  notes: z.string().trim().min(1).max(3000),    // what was re-fetched, what corrected (reference zone)
}).strict();
export const MIN_VERIFICATION_PASSES = 3;       // owner decision, review 2: the real process is author -> checkers A and B -> reviser -> third independent final pass, and every launch cluster has all three
```

- The four `*.final.json` files carry **one `verification` record per cluster** (`{"passes": 3, "checked_at": "2026-10-10", "notes": …}`, `notes` 1311, 1073, 688 and 925 characters, all under the 3000 cap). The importer copies it into each of that cluster's episodes with `scope: 'cluster'` (honest about what was checked). A cluster file **without** a `verification` record (none today; a future wave) imports as `{ passes: 0, checkedAt: <file mtime date>, scope: 'cluster', notes: 'Imported from a file with no recorded verification pass.' }` and so cannot get a `shelf` block until a verified file replaces it.
- **Gate (`story-unverified`)**: a story with a `shelf` block needs `verification.passes >= MIN_VERIFICATION_PASSES`. A `ready` story below the gate is allowed in the bundle but cannot carry `shelf` (lint error), so it never reaches the shelf or the Home card. With `MIN_VERIFICATION_PASSES = 3` **all 24 launch stories pass the gate** (every cluster file records `passes: 3`); the gate protects the next waves.
- A later edit to `facts` or `narrationEn` does **not** erase `passes`; it requires a `contentVer` bump (§3.7), and a *correction* additionally appends an erratum. A full re-verification replaces `passes` / `checkedAt` / `notes` (PR note says why).
- `review.language` / `review.culture` are separate human sign-offs (a native Korean reader; a culture reviewer) recorded with `reviewedBy` initials and `reviewedAt`. Setting either to its reviewed value without `reviewedBy` + `reviewedAt` is `review-unsigned`.
- `review.advisory` (never an age field, D1): `mild-peril` (a chase, a fall), `loss`, `trickery`, `war` (a keyword scan of the research set finds 9 scenes in 5 stories: the Imjin War in `sillok-mountain-archives` s4 and s6, `donguibogam` s3 and `nanjung-ilgi` s2 and s3 and s6; the Mongol invasion in `tripitaka-koreana` s3; a temple "lost in a fire" in `jikji-metal-type` s8; "a king died" in `sillok-mountain-archives` s1), `historical-hardship`. The importer proposes advisories from a keyword scan (9 scenes in those 5 stories) for a human to accept or clear. F-STORY-002 shows "A gentle note for grown-ups: …" once on the start card (never blocking) and always on the Sources screen; the shelf (F-STORY-004) may show a small neutral pill. No advisory ever hides a story.

### 3.7 Versioning of facts and the correction process

**Versions.**

- `story.contentVer` (int >= 1) is bumped by **any** change to a story's learner-visible or source content (narration, keywords, checks, facts, sources, art, culture notes, titles). `fact.rev` is bumped when that fact's `claimEn`, `claimKo` or any `sources[]` entry changes. Neither is a build counter; both are content history.
- **CI rule (`scripts/check-story-versions.mjs`, plain Node, run in `content-validation.yml` on `pull_request`, needs `fetch-depth: 0`)**: for each added/modified `content/stories/*.json`, compare with `origin/main` (`git show origin/main:<path>`). The rules below apply only when the base file on `main` has `state: 'ready'` (a draft has shipped nothing, so authoring edits need no bump); a draft turning `ready` sets `contentVer` to its current value and is bumped from then on:
  - any change outside `{contentVer, errata, verification, review, shelf}` with `contentVer` not strictly greater ⇒ error `content-ver-not-bumped`;
  - any change to a fact's `claimEn`/`claimKo`/`sources` with `rev` not strictly greater ⇒ `fact-rev-not-bumped`;
  - a fact id present on `main` and missing now, without an `errata` entry of `kind: 'removal'` naming it ⇒ `fact-removed-silently`;
  - `rev` or `contentVer` decreasing ⇒ `version-decreased`;
  - a new file (not on `main`) must have `contentVer: 1`.
- `contentVer` rides in the generated bundle; the Sources screen shows "Story version N · last checked <date>" (F-STORY-002 §3.8).

**Erratum.**

```ts
export const ErratumSchema = z.object({
  id: z.string().regex(/^e[0-9]{1,3}$/),
  date: IsoDateSchema,                         // when the correction was merged
  kind: z.enum(['correction', 'clarification', 'removal']),
  factIds: z.array(z.string()).min(1).max(4),
  summaryEn: z.string().trim().min(1).max(200),   // plain words, no blame: "We corrected the year the Annals were …"
  detailEn: z.string().trim().min(1).max(600).optional(),   // maintainer detail; reference zone
  fixedInVer: z.number().int().min(1),         // the contentVer that contains the fix (== story.contentVer when added)
  show: z.boolean().default(true),             // false for cosmetic clarifications
}).strict();
```

**Process when a fact is later found wrong** (documented in `content/stories/README.md`, enforced where mechanical):

1. **Report**: anyone (owner, reviewer, parent via support) names the story, scene and why. Triage within one working day. Severity: **S1** wrong or misleading statement of fact, or a safety/sensitivity problem; **S2** imprecise but not wrong (rounding, ambiguous wording); **S3** typo/style.
2. **Verify** against >= 2 authoritative sources (not the same page twice); decide *correct*, *soften* (state only the consensus; the research files already do this where sources disagree, e.g. dropping a birth year because encykorea contradicts itself), or *remove* the statement.
3. **Fix in one content PR**: edit narration + fact(s); bump `fact.rev` and `contentVer`; add an erratum (`kind`, `factIds`, `summaryEn`, `fixedInVer`); update `verification.checkedAt` / `notes` if sources were re-read; the PR description lists the old and new sentence. CI enforces the version rules above. For S1, also set `state: 'draft'` **in the same PR if the fix cannot be made now** — a draft is not bundled, so the next build drops the story; the shelf degrades cleanly (F-STORY-004 hides it).
4. **Release**: S1 ships out of band. Web PWA: a deploy; the existing service-worker flow shows the update banner and applies it on tap (`apps/mobile/scripts/pwa-postbuild.mjs`, `apps/mobile/src/platform/pwa.web.ts` `hr:update-ready` / `applyUpdate`, banners in `components/PwaBanners.tsx`). Native builds: the next store release (no over-the-air content channel exists; adding one is out of scope, §4). S2/S3 ride the next normal release.
5. **How learners see it**: nothing changes in their progress — quests, stars, cards and bookmarks are keyed by ids, and `clampScene` (F-STORY-004 §3.2) absorbs a changed scene count. After updating, the story's **Sources screen** lists every erratum with `show: true` under "Corrections" with its date and `summaryEn` (and a one-line "Updated" tag next to the corrected fact). There is no push notification, no modal and no "you were taught something wrong" screen. A learner who completed the story is not asked to redo it.
6. **Audit trail**: `git log content/stories/<slug>.json` + the erratum list. Errata are append-only (CI: an existing erratum id cannot disappear or change `date`/`kind`/`factIds`).

**Link rot.** Sources age. A scheduled workflow (`.github/workflows/source-links.yml`, monthly + manual) runs `node scripts/check-source-links.mjs`: for every unique URL it sends `HEAD` then `GET` (10 s timeout, 2 requests per host per second, a polite `User-Agent` naming the project), and opens one GitHub issue per run listing 4xx/5xx, redirects to a different host and TLS failures. It **never fails a PR** (several authoritative hosts, notably UNESCO, reset connections from some networks — the verification notes record this), and `scripts/source-link-ignore.json` lists hosts known to block bots. A dead link does not make a fact wrong; the owner decides: re-verify, replace the source (fact `rev` bump), or leave it.

### 3.8 Validators

Three layers, so each runs where it can:

| Layer | Where | Runs | Covers |
|---|---|---|---|
| Schema (zod) | `packages/content-schema/src/schemas/story.ts`, `scene-art.ts` | `packages/content-schema/src/__tests__/story-content.test.ts` reads every `content/stories/*.json` (top level only; `research/` is skipped) with `node:fs` (data, not an import) and parses with `parseStory`; fixtures in `src/__fixtures__/story/` | shape, caps, strictness, cross-references, ready-only requirements |
| Lint (pure TS) | `packages/content-schema/src/story-lint.ts` exports `lintStory(story, ctx): Finding[]`, `Finding = { rule, level: 'error' \| 'warning', path, message }` | same test file + `story-lint.test.ts` (100 %) | the table below; romanization correctness is **not** here: F-CNT-002's class A scan reads the same files (`rr` accepted as alias of `romanization` for un-imported research JSON) |
| Language policy (plain Node) | `scripts/validate-content.mjs` (F-CNT-001) | `content-validation.yml`, unchanged trigger | Hangul placement, banned words, invalid JSON |

Findings print one per line as `::error file=<path>,line=<n>::<rule>: <message>` (F-CNT-002 §3.9 format) and fail the vitest run. `pnpm --filter @hangul-route/content-schema test -t story-content` reproduces CI locally.

**`validate-content.mjs` changes** (additive, with tests in `scripts/__tests__/validate-content.test.mjs`):

- `LEARNER_TEXT_FIELDS` gains `narrationEn`, `summaryEn`, `captionEn`, `explainEn`, `hintEn`, `altEn`, `claimEn`, `advisoryNoteEn`, `summaryEn` (F-STORY-003 §3.8 adds the middle four; the set union is idempotent).
- **Reference zone**: for files whose path starts `content/stories/`, a `korean-in-ui-field` finding is **not** raised for any string under the keys `facts`, `referenceDisplay`, `authorNotes`, `learningGoalsEn`, `verification`, `errata`. The banned-word scan still runs on `claimEn` and `errata[].summaryEn` (listed in `LEARNER_TEXT_FIELDS`). The zone does **not** apply to `content/stories/` fields that learners read (`narrationEn`, `captionEn`, `explainEn`, `title.en`, …), and does not apply to any other directory.
- `KOREAN_TARGET_FIELDS` is unchanged (`ko`, `korean`, `target`, …): story Korean is always inside a `KoText` object (`title`, `keyword`, `line`, `words[]`, `target`), which carries `romanization` and `en`.

**Lint rules** (`error` unless marked; "S" = also applies to `draft`):

| Rule | Level | Meaning |
|---|---|---|
| `narration-too-long` S | error | more than 45 words (a `{kw:}` token = 1 word) or 320 characters |
| `narration-token-unknown`, `narration-brace` S | error | §3.4 |
| `scene-without-fact` S | error | non-framing scene with no `factIds` (C1) |
| `framing-scene-limit`, `framing-scene-with-claim` S | error | C1 |
| `fact-unknown` S, `fact-unused` S (warning) | | C2 |
| `fact-no-authoritative-source` S, `fact-numeric-single-source` S | error | C3 |
| `source-url-not-https` S, `source-accessed-invalid` S | error | C4 |
| `source-stale`, `source-host-unlisted` (S) | warning | C4 |
| `narration-number-unsupported` S | error | C5 |
| `narration-number-word-unmatched` S, `narration-approximation-unmarked` S | warning / error | C5 (the unmarked-approximation phrase is an error) |
| `approximation-text-missing` S (error), `approximation-time-relative` S (warning) | | C5 |
| `tale-kind-origin-mismatch` S, `tale-first-scene-unframed` S, `tale-fact-with-date` S, `tale-without-retelling-note` S | error | rule T |
| `check-answer-position-skew` S | error | in one story, the correct option is at index 0 in **every** check, or at the same index in every check, of a tier with >= 3 checks. (Options are shuffled at runtime by F-STORY-003, so this protects authors, not learners) |
| `corpus-answer-index-0-share` | error | across all `ready` stories the share of checks with the correct option at index 0 is > 50 % (today 17/72 = 24 %) |
| `check-explain-missing` | error (ready) | F-STORY-003 |
| `check-option-long` S | warning | an option `en` longer than 70 characters (the schema cap is 80; one option today) |
| `keyword-inconsistent` (error), `keyword-unused` (warning) | | §3.2.2 item 3 (`ko` exact, romanization case-insensitive, gloss free) |
| `keyword-id-collision` S | error | two keywords with one id |
| `caption-missing`, `art-missing` | error (ready) | §3.2.2 item 6 |
| `shelf-minutes-mismatch` | error | §3.2.1 |
| `style-script-name` S | warning | English prose contains "Hangeul" (the product spells the script "Hangul"; proper names such as 한글날 keep their romanization `hangeullal`) |
| `review-unsigned`, `story-unverified` | error | §3.6 |
| `culture-note-missing` | warning | `cultureNotes` empty (F-STORY-004 surfaces notes; the launch set starts empty and gains notes in authoring PRs) |
| `gloss-contains-hangul` S | error | e.g. `gloss_en` "horse (말 can also mean 'words')" (2 in the set); rewrite or use a token |

### 3.9 The generator — `scripts/build-stories.mjs` and the app bundle

Dependency-free Node (same family as `validate-content.mjs`). `node scripts/build-stories.mjs` reads `content/stories/*.json`, drops `state: 'draft'` files, sorts by `id`, and writes **`apps/mobile/src/content/stories.generated.ts`**:

```ts
// GENERATED by scripts/build-stories.mjs — do not edit. Source: content/stories/*.json
import type { Episode, Quest, Story } from '@hangul-route/content-schema';
export const storiesAll: Story[] = [ /* one object literal per ready story */ ];
export const storyEpisodes: Episode[] = [ /* shelf episodes, below */ ];
export const storyQuests: Quest[] = [ /* their quests */ ];
```

- The object literals are typed by contextual typing against `Story[]`, so **`tsc --noEmit` (the `typecheck` task) proves the generated data matches the schema** at zero runtime cost; there is no runtime zod parse of 0.5 MB at app start. The schema test (§3.8) is the content gate; TypeScript is the second.
- `node scripts/build-stories.mjs --check` rebuilds in memory and fails if the checked-in file differs (CI step in `content-validation.yml`, same drift-detector idea as `check-token-drift.mjs` and F-I18N-001's `build-overlays.mjs --check`). `--include-drafts --out <path>` writes a preview bundle for `/design-preview` (never into `apps/`).
- `apps/mobile/src/content/stories.ts` (hand-written, tiny): `export { storiesAll }`, `storyById(id)`, and the `storySlug(id)` helper. `episodes.ts:201-206` appends `...storyEpisodes` to `episodesAll`; `quests.ts:184` appends `...storyQuests` to `questsAll`. Nothing else in the app reads the generated file.
- **Shelf episodes and quests are derived, not hand-written**, for each story with `shelf` (conventions of F-STORY-004 §3.1, enforced by integrity tests there): episode `id: episode:shelf-<slug>`, `format: 'story'`, `placement: 'shelf'`, `stage: 'stage1'`, `theme` = story theme, `order: 100 + shelf.order`, `titleEn: title.en`, `hoyaIntroEn: story.hoyaIntroEn`, `questIds: [quest:story-<slug>-<level>]`, `rewardCardIds` from `rewardCardIds.listen`, `pillarTags` and `companionId` copied from the story (F-STORY-005 §3.2), `estimatedMinutes: max(3, minutes)`, `status: 'ready'` (`ready` and `shipped` are both playable, `logic/homework/mission-builder.ts:102`, `logic/homework/gating.ts:43`; whether a story is *shown* is decided by the review and verification gates in F-STORY-004's story index, not by this status). The quest has the five steps of F-STORY-003 §3.1 with refs `minigame:story-read-<level-code>-<slug>` / `story-check` / `story-seq`, titles from constants in the generator ("Read the story", "A few questions", "Put the story in order"), `estimatedMinutes = max(3, minutes)`, `rewardCardId = rewardCardIds.listen`. Grid book episodes (Stage 5 volumes, F-STORY-005) remain hand-written in `episodes.ts`; they reference `storyIds`.
- **Episode schema additive fields** (`schemas/episode.ts`, owned here, plus `pillarTags` / `companionId` merged by F-STORY-005 PR 5.1 from `CatalogueFieldsSchema`; defaults keep every existing episode valid): `format: z.enum(['lesson', 'story']).default('lesson')`, `placement: z.enum(['grid', 'shelf']).default('grid')`, `volume: z.number().int().min(1).default(1)`, `storyIds: z.array(z.string()).optional()`; and `questIds` becomes `z.array(z.string())` with **an object-level** `.superRefine` (a field cannot see `status`): `questIds.length >= 1` unless `status === 'preview'`. Because that refinement turns the schema into a `ZodEffects` (no `.merge` / `.extend`), the file exports **`EpisodeObjectSchema`** (the plain `z.object`, the only thing later specs extend) and **`EpisodeSchema = EpisodeObjectSchema.superRefine(episodeRules)`**; F-STORY-005's rules join `episodeRules`. This also makes the 27 current placeholder episodes parse (the integrity test in F-STORY-003 §3.8 then runs `EpisodeSchema.parse` over `episodesAll`).
- **Bundle budget** (checked by `node scripts/build-stories.mjs --report`, which prints per-story and total bytes raw and gzip, and exits 1 over budget): **launch set (24 stories) <= 1.0 MB raw and <= 260 KB gzip for `stories.generated.ts`**; any single story <= 60 KB raw. Measured input today: 544 KB raw / 138 KB gzip for the 24 research files; the authored additions (captions, art descriptions, explanations, notes) are estimated at 150-250 KB raw, so the launch set should land near 780-880 KB raw (about 200-230 KB gzip): **15-25 % headroom, deliberately tight**. Stage 5 waves (30 more tales) will need a reviewed ceiling raise or the per-story lazy `require` fallback below. Scene art (F-STORY-002 §3.9.7) is inside this number (descriptions) or in the design-system budget (library), not counted twice. Raising a budget is a reviewed one-line change.
- **Performance**: the module is evaluated when `content/index.ts` first imports it (Metro runs a module's factory once). Measure cold-start impact on one mid-range Android device in PR 1.4 and record it; if the module exceeds 50 ms of evaluation, switch `storiesAll` to per-story lazy `require` behind the same API (non-breaking). This is not a launch blocker (unverified, §7).

### 3.10 Importing the heritage research — `scripts/import-heritage.mjs`

A **one-time**, dependency-free Node script. `node scripts/import-heritage.mjs --src <dir> [--dry-run] [--write]` reads `records-joseon.final.json`, `hangul-printing.final.json`, `science-art-life.final.json` and `seasons-tales.final.json` from `--src` (the committed copies are in `content/stories/research/`; for a future cluster the importer accepts `<cluster>.final.json` only — a `.revised.json` or `.draft.json` is refused with a message, because an unfinished verification must not be imported by accident; `--allow-unfinal` overrides and sets `verification.passes: 0`), prints which files it used, and writes `content/stories/<slug>.json` with `state: 'draft'`. It **refuses to overwrite an existing file** (authors will have edited it) unless `--force-draft` and the existing file is still `draft` with `contentVer: 1`. It prints a report (`import-report`) and exits 0 even with gaps, because gaps are the author's to-do list. Logic is a pure function `mapEpisode(raw, cluster, jamo)` exported for unit tests; the script is a thin wrapper (`scripts/__tests__/import-heritage.test.mjs`, `node --test`).

**Mapping (one research field → one story field, nothing dropped):**

| Research field | Story field | Rule |
|---|---|---|
| `id` `story-x` | `id` `story:x`, file `x.json` | prefix swap |
| `title_ko` + `title_en` | `title: { ko, romanization: '', en }` | romanization is authored (24 values, converter suggests) |
| `theme` | `theme` | unchanged (the five D9 keys) |
| `heritage_type` | `kind` | `documentary|site|intangible|object|science|art` → same; `folk-tale` → `folk-tale`; `origin.type` = `traditional` for `folk-tale`, else `documented` |
| `recommended_stage` | `recommendedStage` | advisory |
| `minutes` | `minutes` | 4-6 in the set |
| `summary_en` | `summaryEn` | |
| `learning_goals[]` | `learningGoalsEn[]` | reference zone; Hangul stays as `한글 (romanization)` |
| `scenes[].n` | `tiers[0].scenes[].id` `s<n>` | `tiers[0].level = 'listen'` |
| `scenes[].narration_en` | `narrationEn` | each Hangul run replaced by `{kw:<id>}` (§3.4); runs that match no vocab/scene Korean are listed |
| `scenes[].korean` + `romanization` + `gloss_en` | `keyword` (155 single terms) **or** `line` (27 phrases: ends `.?!` or 3+ words) | `{ ko, romanization, en }` **as the scene wrote it** (its own romanization capitalisation and gloss, §3.2.2 item 3); a matching `vocab` entry gives the keyword its `id`, else the id comes from the romanization. A scene Korean string that is not in `vocab` is added to `keywords[]` (120 of 182 are already in it; 62 are added) so every `keyword.id` resolves; a quoted phrase gets `kind: 'phrase'` |
| `scenes[].illustration` | `artBrief` | verbatim, provenance for the illustrator |
| `scenes[].fact_ids` | `factIds`; empty ⇒ `framing: true` | 2 scenes |
| `facts[].id` | `facts[].id` | |
| `facts[].claim_en` / `claim_ko` | `claimEn` / `claimKo` | |
| `facts[].sources[]` `title, publisher, url, accessed, quote_or_locator` | same, `quote_or_locator` → `quoteOrLocator` | no field is rewritten; the `http://` URL is reported, not edited |
| (none) | `facts[].rev = 1`, `scope` | per §3.3 |
| `vocab[]` `{ko, rr, en}` | `keywords[]` `{id, ko, romanization, en, kind}` | key rename `rr` → `romanization`; id from romanization (`-2` suffix on collision); then the scene Korean not in `vocab` is appended (row above): 171 vocab entries + 62 scene-only = 233 keywords over 24 stories (mean 9.7, max 13) |
| `checks[]` `{q_en, options[], answer_index, fact_id}` | `tiers[0].checks[]` | `q_en` Hangul lifted to `target` + `{target}` (F-STORY-003 §3.1 table); options become `{id: a..d, en, isCorrect}` (3 or 4); a Hangul-only option becomes a `ko` option (3 in `shapes-of-hangeul` check 2: ㅣ ㅡ ㅏ, resolved from `jamo.json`); `fact_id` → `factIds: [fact_id]`; `explainEn` absent in a draft |
| `reference_display` | `referenceDisplay` | |
| `notes` | `authorNotes` | |
| cluster `verification {passes, checked_at, notes}` | `verification {passes, checkedAt, scope: 'cluster', notes}` | §3.6 |
| (derived) | `tiers[0].sequenceSceneIds` | scenes at index `round(i*(n-1)/3)`, i = 0..3 (first, ~1/3, ~2/3, last), marked in the report as a default |
| (derived) | `tiers[0].newKeywordIds` | the first <= 4 vocab keywords that are a scene focus, in scene order (default) |
| (derived) | `coverSceneId` | `s1` |
| (derived) | `review` | `{ language: 'draft', culture: 'draft', advisory: <proposed from the keyword scan> }` |
| (derived) | `contentVer: 1`, `v: 1`, `state: 'draft'`, `errata: []` | |

**What the importer cannot create (the authoring to-do, counted on the real files; the lint prints each as a finding on the draft):** 182 `captionEn` (<= 48 chars) · 72 `explainEn` (<= 140) · 182 `art` descriptions (F-STORY-002 §3.9.8) · 24 title romanizations · 7 undefined inline terms (romanization + gloss) · 2 `gloss_en` containing Hangul (`sillok-royal-historians` s5, `nanjung-ilgi` s2: rewrite; the 3 Hangul-only check options are not an error, they become `ko` options) · **1 check option of 79 characters (`hangeul-day` check 2): within the 80 cap, flagged by the warning `check-option-long` (> 70), shorten if it wraps badly** · 4 numeric statements needing an `approximations` entry or a rewrite · the 1 `http://` URL · 1 hyphenated romanization (`Jang Yeong-sil` → `Jang Yeongsil`, F-CNT-002 R2) · 7 "Hangeul" spellings (style) · `hoyaIntroEn` / `hoyaOutroEn` for shelf stories · advisories confirmed · native-language and culture sign-offs · reward cards. Each appears as a lint finding on the draft, so the list cannot be forgotten.

Worked fragment (scene 2 of `sillok-royal-historians`, after import):

```json
{
  "id": "s2",
  "narrationEn": "These officials were the {kw:sagwan}, the royal historians. Wherever the king met his officials, a historian was there, writing down what they saw and heard.",
  "keyword": { "id": "sagwan", "ko": "사관", "romanization": "sagwan", "en": "royal historian", "kind": "word" },
  "factIds": ["f2"],
  "framing": false,
  "approximations": [],
  "artBrief": "A Joseon palace hall: the king on a raised seat, officials kneeling in rows, and at the side a historian in official dress and a black hat writing with a brush on paper."
}
```

### 3.11 Names other specs consume (the contract)

| Name | Defined | Consumed by |
|---|---|---|
| `Story`, `StoryReader`-facing fields: `title`, `tiers[].scenes[]`, `sceneKorean()`, `keywords`, `facts`, `verification`, `errata`, `origin`, `review`, `contentVer` | here | F-STORY-002 (reader, Sources), -003, -004 |
| `Tier.checks`, `checkpoints`, `sequenceSceneIds`, `newKeywordIds`, `scene.captionEn`, `scene.art` / `artPending` | here; `StoryCheckSchema` text is F-STORY-003 §3.1, file created by PR 1.1a | F-STORY-003 |
| `StoryShelfSchema` / `story.shelf`, `cultureNotes[]` (`{ id, titleEn, bodyEn <= 220, term: KoText, cardId?, factIds }`) | here (product rules: F-STORY-004 §3.1) | F-STORY-004 |
| `story.pillarTags`, `story.companionId` (`CatalogueFieldsSchema`, `pillars.ts`), `story.card` (`StoryCardSchema`), `rewardCardIds` | slots here; meaning F-STORY-005 §3.2 / F-STORY-006 §3.8 | F-STORY-005, -006 |
| `parseStory`, `StorySchema`, `StoryReadySchema`, `StoryObjectSchema` | here (no discriminated union, §3.2) | every consumer parses through `parseStory` |
| `MIN_VERIFICATION_PASSES` (= 3), `AUTHORITATIVE_HOST_SUFFIXES`, `TALE_KINDS` | here | F-STORY-004/005 (the review gate reads them) |
| `storiesAll`, `storyById`, `storySlug`, shelf episodes/quests | `apps/mobile/src/content/stories.ts` (generated data) | F-STORY-004 story index |
| `Episode.format`, `placement`, `volume`, `storyIds` | here | F-STORY-004, -005 |
| `parseNarration`, `{kw:id}` token | here | F-STORY-002 renderer, overlay check |
| `SceneArt`, `ART_CANVAS` (data shape) | here; semantics F-STORY-002 | F-STORY-002, -003 (`SequenceCard.art`) |
| `review.advisory` (never `ageAdvisory`) | here | F-STORY-002, -004 |
| `StoryLevel`, ref grammar `minigame:story-<read|check|seq>-<listen|along|read>-<slug>` | F-STORY-003 §3.1 | generator |

### 3.12 Overlays (F-I18N-001 §3.6)

Story text is translated beside the content, never in it. PR 1.3 adds one row to F-I18N-001's `OVERLAY_FIELDS` allow-list: id prefix **`story:`** with dotted field paths `title`, `summary`, `hoyaIntro`, `hoyaOutro`, `scenes.<sceneId>.narration`, `.caption`, `.alt`, `keywords.<id>.gloss`, `checks.<checkId>.prompt|explain|hint|options.<optionId>`, `cultureNotes.<id>.title|body`, `facts.<id>.claim`, `errata.<id>.summary`. Never overridable (unchanged): `ko`, `romanization`, `target`, `audioRef`, ids. `claimKo`, source titles, publishers and quotes stay in their source language (they are citations). `overlay-token-mismatch` (§3.4) applies to `narration`. Where an overlay field is missing the English text shows (F-I18N-001 rule 5). Translating the 24 launch stories is a later content effort.

### 3.13 Telemetry, backend, storage

None. No event, no D1 migration, no route, no storage key, no `ProgressSnapshot` field. The package gains zod schemas and pure helpers; the Worker is untouched.

### 3.14 Checked against the real research data (review 2, 2026-10-10)

The schema of §3.2 was checked against **every episode of the four `*.final.json` files** (24 episodes, 182 scenes, 211 facts, 576 sources, 171 vocabulary entries, 72 checks) with two throwaway scripts that implement the §3.10 mapping and the §3.2-§3.4 rules (`review2/validate_episodes.py` for field lists, caps and enums; `review2/simulate_import.py` for the mapping, keywords, tokens, coverage and number-echo rules). Result: **the schema holds all 24 episodes one-to-one with no data loss and no rewritten source; every field of the research shape has a destination, and no research file has a key the schema does not know.** The mismatches the check found, and where each is fixed:

| # | Mismatch found | Count | Fix (in this spec) |
|---|---|---|---|
| 1 | The scene's own gloss/romanization differs from the same word in `vocab` (rule "embedded copy equals the keyword") | 29 glosses + 5 capitalisations (34 scenes) | §3.2.2 item 3: `ko` exact, romanization case-insensitive, gloss free |
| 2 | 62 scene Korean strings are not in `vocab`, so a scene `keyword.id` would not resolve | 62 | importer appends them to `keywords[]` (§3.10); max 13 keywords per story, cap 24 |
| 3 | Quoted Korean phrases and jamo lists in narration have no keyword to carry a token | 66 Hangul spans (18 unresolved: 11 jamo spans, 7 undefined terms) | `kind: 'phrase'`, longest-span-first token resolution (§3.4) |
| 4 | One check option is 79 characters; the option cap was 70 | 1 (`hangeul-day` check 2) | cap 80 + warning > 70 (F-STORY-003 §3.1 amended in the same review) |
| 5 | Counts in this spec were stale (573 sources, 189 URLs, 85 two-source facts, 92 accesses on 10-10; seasons-tales had no final file) | — | corrected in §1: 576 / 191 / 82 / 95; all four finals exist, all `passes: 3` |
| 6 | `title` has no romanization in any file and a draft must still parse | 24 | `koTextExtend` allows `''` in a draft (§3.2.4) |
| 7 | `explainEn` absent from all 72 checks while `StoryCheckSchema` (F-STORY-003) made it required | 72 | optional in the schema, required by the ready rule (§3.2) |

Findings the **lint** is expected to report on the 24 raw imports (the authoring to-do; nothing else at `error` level): `narration-number-unsupported` 4 (`sejong-new-letters` s1 "600", `tripitaka-koreana` s8 "800", `sillok-mountain-archives` s4 "1590", `joseon-records-today` s5 "300") · `narration-approximation-unmarked` 3 (the three "almost/nearly N years" phrases) · `source-url-not-https` 1 (`tripitaka-koreana` f6) · `gloss-contains-hangul` 2 (`sillok-royal-historians` s5, `nanjung-ilgi` s2) · `narration-token-unknown` 0 after the importer's tokenisation but 7 terms reported as "no keyword (author: romanization + gloss)" · `style-script-name` warnings · `check-option-long` warning 1 · and the `state: 'draft'` relaxations listed in §3.2.4 (182 captions, 72 explanations, 182 art descriptions, 24 title romanizations). Rules that were checked and found **clean** on the real data: scene count 7-8 (14 stories have 8, 10 have 7), narration <= 45 words and <= 250 characters, every `fact_ids` resolves, every check `fact_id` resolves, 3 checks per episode, no fact without an authoritative host (211 of 211), every numeric fact has >= 2 sources (the 8 one-source facts contain no digit), framing scenes (2 scenes in `joseon-records-today`, exactly 25 % of its 8, no digit, no Hangul), no scene Korean longer than 20 characters or 6 words, all check ids/answers in range, no skewed answer position in any story, tale scope (2 folk tales). Field maxima against caps (headroom): `summaryEn` 314/320 (**tightest**), `claimEn` 525/600, `claimKo` 232/300, `quoteOrLocator` 398/500, source title 141/200, publisher 63/120, `learningGoalsEn` 191/200, `referenceDisplay` 274/300, `authorNotes` 2654/3000, `artBrief` 224/300, narration 250/320 chars, check prompt 69/90, keyword gloss 78/200.

`import-real.test.ts` (§5) turns this table into a regression test, so a schema change that stops holding a research episode fails CI, and so does a research-file edit that reintroduces one of the fixed classes.

### 3.15 Behaviours (Given / When / Then)

Each row is a test in §5 (schema, lint, importer or CI script); paths in findings are JSON paths into the story file.

| # | Given | When | Then |
|---|---|---|---|
| 1 | the four committed `*.final.json` files | the importer runs with `--dry-run` | it reports 24 stories, 182 scenes, 211 facts, 576 sources, writes nothing, and every mapped story passes `parseStory` as a `draft` |
| 2 | a research scene whose narration contains 사관 and whose vocab has `{ ko: '사관', rr: 'sagwan' }` | it is imported | `narrationEn` holds `{kw:sagwan}`, `keywords[]` has `sagwan` with the vocab romanization and gloss, and the scene's own `keyword` keeps the scene gloss |
| 3 | a `ready` story with a non-framing scene whose `factIds` is empty | `lintStory` runs | one `scene-without-fact` error at `tiers[0].scenes[<i>].factIds` |
| 4 | narration "almost 600 years ago" cited to a fact stating 1443 and no `approximations` entry | lint runs | `narration-approximation-unmarked` and `narration-number-unsupported`; with an entry (`text`, `factIds`, `rationaleEn`, `timeRelative: true`) both clear and a `approximation-time-relative` warning remains |
| 5 | a fact whose `claimEn` contains a digit and has one source | lint runs | `fact-numeric-single-source` |
| 6 | a source URL starting `http://` | lint runs | `source-url-not-https` |
| 7 | a story with a `shelf` block and `verification.passes = 2` | lint runs | `story-unverified`; with `passes = 3` it clears |
| 8 | a `draft` story with `title.romanization = ''` | `parseStory` runs | it parses; the same file with `state: 'ready'` fails at `title.romanization` |
| 9 | a scene `keyword` with the same `ko` as `keywords[i]` but a different gloss | `parseStory` runs | it parses; with a different `ko` it fails `keyword-inconsistent` |
| 10 | a `ready` story on `main` and a PR that edits `narrationEn` without raising `contentVer` | `check-story-versions.mjs` runs | exit 1 with `content-ver-not-bumped`; raising it clears it, and a fact whose sources changed also needs `rev` raised |
| 11 | a story JSON edited without regenerating the bundle | `build-stories.mjs --check` runs in CI | exit 1 (drift) |
| 12 | a traditional tale whose first scene contains no tale word | lint runs | `tale-first-scene-unframed` |
| 13 | a `ready` story with a `card` block whose `factId` resolves and a shelf block | `parseStory` runs | it parses; an unknown `keywordId` fails with the path `card.keywordId` |

## 4. Out of scope

- The reader, Sources screen and SceneArt renderer (F-STORY-002); checks UI and Story Order v2 (F-STORY-003); shelf, Home card, bookmarks, Culture notes screen (F-STORY-004); Stage 5 volumes (F-STORY-005); episode-completion card awards (F-STORY-006).
- Authoring the 182 captions, 72 explanations, art, translations and the Stage 5 story waves (content PRs, §6).
- Recorded audio (`audioRef` fields exist; F-AUDIO-004).
- A remote content channel for out-of-band fixes on native builds (a `GET /api/content/advisories` or an over-the-air bundle). Recorded as a follow-up: without it an S1 fix on iOS/Android waits for a store release, and the mitigation is the PWA being the primary channel (CLAUDE.md §1).
- Automatic fact-checking, plagiarism checks, or a CMS UI. A web editor for stories.
- Side characters (훈이/풍이/…), branching stories, pronunciation-scored retelling (F-STORY "My Story").
- Changing the shipped Stage 1 TypeScript content or its validator coverage (F-CNT-002).

## 5. Tests

TDD; each PR ships its tests. `packages/content-schema` stays at 100 % lines and branches.

| File | Level | Coverage focus | Target |
|---|---|---|---|
| `content-schema/src/__tests__/story.test.ts` | unit | `parseStory` accepts the valid fixtures (draft and ready), rejects each invalid fixture for the named reason: unknown key (incl. a misspelt `narationEn`), bad id, 46-word narration, unresolved fact/keyword/scene id, two correct options, `advisory` without note, ready without captions, ready with an empty `title.romanization` (the same file as a `draft` parses), framing without flag, `sequenceSceneIds` not increasing, `coverSceneId` missing; scene keyword with a different gloss accepted, with a different `ko` rejected, with romanization differing only in case accepted; `sceneKorean`; the `shelf`, `pillarTags`, `companionId`, `card` slots parse and defaults apply; `koTextExtend` keeps the `syllables` rule | 100 % |
| `…/story-lint.test.ts` | unit | every rule in §3.8 with a passing and failing minimal story: C1-C7, numbers incl. the four real sentences (as fixtures), approximations, https, accessed in the future, stale, unlisted host, authoritative-host suffixes, tale rules T1-T3, answer-position skew, corpus share, token rules, keyword consistency, `story-unverified`, `review-unsigned`, `shelf-minutes-mismatch`, style warning; deterministic date via `HANGUL_ROUTE_TODAY` | 100 % |
| `…/narration.test.ts` | unit | `parseNarration`: no tokens, adjacent tokens, unknown token, unbalanced brace, token at start/end | 100 % |
| `…/story-content.test.ts` | integration | reads every `content/stories/*.json`: parses, lints (errors fail, warnings print), file name = slug, ids unique, every state-`ready` story passes the strict schema, overlay files (when present) reference existing ids | n/a |
| `…/episode.test.ts` (extend `schemas.test.ts`) | unit | new fields default (existing episode parses unchanged); `questIds` empty allowed only for `preview`; placement/format enums | 100 % |
| `scripts/__tests__/validate-content.test.mjs` (extend) | unit (`node --test`) | reference zone exempts `facts.*.claimKo/claimEn`, `facts[].sources[].publisher`, `referenceDisplay`, `learningGoalsEn` under `content/stories/` and **not** `narrationEn`, `title.en`, or the same keys in another directory; banned word in `claimEn` still caught; existing cases unchanged | n/a |
| `scripts/__tests__/import-heritage.test.mjs` | unit | `mapEpisode` on a trimmed fixture of each shape: longest-span-first token replacement (phrase span, jamo list split into five tokens) and the resolution order vocab → scene Korean → jamo → reported; keyword vs line split (`.?!`, 3+ words); scene-only Korean appended to `keywords[]`; scene gloss kept when it differs from the vocab gloss; framing detection; cluster verification copied; a file without verification → `passes: 0`; `.revised.json` refused without `--allow-unfinal`; `rr`→`romanization`; refuses to overwrite; report counts; `http://` flagged | n/a |
| `packages/content-schema/src/__tests__/import-real.test.ts` | integration (skipped when `content/stories/research/` is absent) | **the real-data contract of §3.14**: imports `mapEpisode` from `scripts/import-heritage.mjs` (typed by a sibling `import-heritage.d.mts`, the pattern AUDIO-004 uses for `scripts/audio/lib.mjs`; vitest imports `.mjs` directly), maps the 24 episodes of the four committed `*.final.json` files, and asserts: 24 stories / 182 scenes / 211 facts / 576 sources; **every imported draft passes `parseStory`**; `lintStory` reports no `error` outside the finding classes listed in §3.14 and the counts match that table | n/a |
| `scripts/__tests__/check-story-versions.test.mjs` | unit | every rule of §3.7 against git-less fixtures (base text vs head text passed in) | n/a |
| `scripts/__tests__/build-stories.test.mjs` | unit | drops drafts, stable ordering, `--check` drift detection, shelf episode/quest derivation (ids, order `100 + shelf.order`, 5 steps, refs parse with the F-STORY-003 grammar), `--report` budget exit code | n/a |
| `apps/mobile/src/content/__tests__/content-integrity.test.ts` (extend) | integration | `storiesAll` non-empty or empty-safe; every shelf episode/quest resolves; `EpisodeSchema.parse(episodesAll)` and `QuestSchema.parse(questsAll)` pass; each story with a `shelf` block meets `story-unverified` | n/a |

Fixtures (`src/__fixtures__/story/`): `valid.ready.json` (a 5-scene story with every optional field), `valid.draft.json`, `valid.tale.json`, and one `invalid.<reason>.json` per row of §3.8 (small, hand-written, Hangul only in `ko`/zone fields). A golden file `research-numbers.json` holds the four real narration/fact pairs of §1.

Coverage lanes (CLAUDE.md §6): `packages/content-schema` 100 %; `apps/mobile/src/logic` unaffected (no logic file added here; the generated and wiring files sit under `src/content`, outside the coverage `include`, `apps/mobile/vitest.config.ts:33`); `scripts/` is excluded from coverage by `docs/tests/coverage-targets.md`.

## 6. Rollout

No flag: nothing is learner-visible until F-STORY-002/-004. Work lands as small PRs (branches `feat/story-schema-*`, `content/stories-*`):

| # | PR | Depends on |
|---|---|---|
| 1.0 | `docs`: `content/stories/README.md` (authoring + correction process), `content/README.md` link, PR template line "Claims audit: every sentence I changed maps to a fact I re-read", `docs/specs/README.md` index, `.claude/skills/content-skill/SKILL.md` §story pointer. (CLAUDE.md §2 directories come from F-I18N-001 PR 0, merged as #99.) | — |
| 1.1a | `feat(content-schema)`: leaf schemas — `scene-art.ts`, `story-check.ts` (verbatim F-STORY-003 §3.1, `explainEn` optional, option cap 80), `pillars.ts` (the three catalogue schemas), the `KoTextShape` / `refineKoText` exports in `ko-text.ts`, tests (100 %) | **F-QUEST-002 Q-1 (PR #103) merged** |
| 1.1b | `feat(content-schema)`: `story.ts` (`StoryObjectSchema`, `StorySchema`, `StoryReadySchema`, `parseStory`, `StoryShelfSchema`, `StoryCardSchema`, `CultureNoteSchema`), `Episode` fields + `questIds` refine, `sceneKorean`, `narration.ts`, fixtures, tests (100 %) | 1.1a |
| 1.2 | `feat(content-schema)`: `story-lint.ts`, `story-sources.ts`, `story-content.test.ts`, lint tests | 1.1b |
| 1.3 | `ci(content)`: `validate-content.mjs` reference zone + fields + tests; F-I18N-001 `story:` overlay row and `overlay-token-mismatch`; F-CNT-002 class A scan: skip `content/stories/research/` (the same directory list as `SKIPPED_DIRS`; its R2 would otherwise fail on the research file's one hyphenated romanization) and the draft-romanization downgrade (two coordinated one-line changes in its scan, `AMENDMENTS-LANDED-SPECS.md`) | 1.1b, PR #104 (the `SKIPPED_DIRS` edit of the same file) |
| 1.4 | `feat(content)`: `scripts/build-stories.mjs`, `stories.generated.ts` (empty arrays), `stories.ts`, episode/quest wiring, `--check` + `--report` in CI, cold-start measurement note | 1.1b |
| 1.5 | `ci(content)`: `check-story-versions.mjs` + workflow step (`fetch-depth: 0`) + `source-links.yml` + `check-source-links.mjs` | none (plain Node over JSON; its fixtures are story-shaped JSON, not parsed by zod) |
| 1.6 | `feat(content)`: `scripts/import-heritage.mjs` (+ `import-heritage.d.mts`) + tests including `import-real.test.ts` (§3.14) | 1.1b, 1.2, PR #104 |
| 1.7a-d | `content(stories)`: run the importer, one PR per cluster (`records-joseon`, `hangul-printing`, `science-art-life`, `seasons-tales`), **drafts only** (6 files each, about 140-170 KB per cluster, data not review-by-eye; the lint report is the review). Fix the `http://` URL and the hyphen here | 1.6 |
| 1.8a-d | `content(stories)`: authoring per cluster — titles' romanization, 7 terms, captions, explanations, approximations, advisories, then `state: 'ready'`; art arrives from F-STORY-002 art PRs (a story is `ready` with `artPending: true` scenes only if the owner accepts text-only tiles) | 1.7, F-CNT-002 PR 1 (merged, #102: suggestions) |
| 1.9 | `content(stories)`: native-language and culture review sign-offs (`review.*`; the owner is the Korean reviewer), `shelf` blocks (F-STORY-004) and `card` blocks (F-STORY-006) | 1.8, F-STORY-004 4.3a |

Cross-spec order: F-STORY-001 (1.1a-1.6) → F-STORY-002 ∥ F-STORY-003 PR 3.0-3.3 → F-STORY-004 → 1.7-1.9 content. PRs 1.0 and 1.5 can start immediately; 1.1a onward waits only for PR #103 (`ko-text.ts`). F-STORY-005 PR 5.1 no longer amends this schema (the slots are in 1.1a/1.1b).

## 7. Dependencies

Upstream:

- **D4** (JSON-first, `content/stories/` approved), **D14** (research files, sourced facts), **D13** / **F-CNT-002** (Revised Romanization; class A scan of `content/stories/*.json`; the draft-romanization downgrade), **F-CNT-001** (validator), **F-I18N-001** (overlay mechanism; PR 0 charter edit; `KoreanText` is consumed by the reader, not here).
- Existing code: `packages/content-schema` (zod `^3.23.8`, `schemas/episode.ts`, `heritage-card.ts` `ThemeKeySchema`), `scripts/validate-content.mjs`, `.github/workflows/content-validation.yml`, `apps/mobile/src/content/{episodes,quests}.ts`, `apps/mobile/scripts/pwa-postbuild.mjs` (precache), Node 22 (`.nvmrc`).
- **F-STORY-003** owns the text of `StoryCheckSchema` and the ref grammar (this spec's PR 1.1a implements the schema file); **F-STORY-004** owns the shelf product rules (`StoryShelfSchema` is defined here); **F-STORY-005** the text of `CatalogueFieldsSchema`; **F-STORY-006** the rules of `StoryCardSchema`; **F-QUEST-002 Q-1** `ko-text.ts`.

Downstream: F-STORY-002/-003/-004/-005/-006, F-VOC (keywords/art), F-PLAN-002 (catalog entries for story quests), F-TCH-004.

**Assumptions I could not verify** (each with its fallback):

1. (Closed at review 2.) `seasons-tales.final.json` now exists and records `passes: 3`; all four files were validated (§3.14). The importer still refuses `.revised.json` / `.draft.json` without `--allow-unfinal`.
2. Whether the research files' cluster-level `verification.passes: 3` means three passes for **every** episode in the cluster (the notes say "Third independent pass. Every cited URL … was re-opened" for `hangul-printing`, and list episode-specific corrections, which suggests yes). The record is stored with `scope: 'cluster'` so the claim stays honest.
3. That 31 hosts' worth of `quote_or_locator` strings are accurate quotations. This spec does not re-verify content; it only guarantees structure, coverage and traceability. The verification notes record that UNESCO pages could not always be fetched directly and were confirmed through the Internet Archive or search excerpts — a reviewer may want to spot-check those 38 + 23 + 11 + 10 UNESCO-host sources.
4. The TypeScript and Hermes cost of a 0.5-1 MB generated literal in `tsc --noEmit` and Hermes cold start (budget and measurement are specified; not measured).
5. That a contextually typed array literal of this size type-checks in acceptable time; fallback is `export const storiesAll = [...] as unknown as Story[]` with the schema test as the only gate.
6. The `Co-Authored`/PR-template wording and the exact `docs/specs/README.md` index format were not read; PR 1.0 adapts.
7. Whether `fetch-depth: 0` is acceptable in the existing `content-validation.yml` job time (10 min timeout, `.github/workflows/content-validation.yml:18`): a shallow fetch of `origin/main` for the base file is the fallback.

## 8. Decisions

Binding owner decisions and how this spec applies them:

| Id | Applied here |
|---|---|
| D1 | `review.advisory` replaces any age-flavoured field; `recommendedStage` is a stage, not an age; copy for the advisory says "a gentle note for grown-ups", never "for kids" |
| D2 | Learner Korean is always `KoText` (Korean + romanization + gloss); inline terms are tokens that render as `KoreanText`; overlays never touch `ko`/`romanization`; "traditional tale" label strings are catalogue keys |
| D3 | A framing scene may not carry a claim; no shaming vocabulary (banned-word scan covers every new learner field); nothing in the schema stores a miss |
| D4 | `content/stories/*.json` is the source; generated module; validator scans shipped content; facts carry `sources[]` |
| D5 | `shelf.sampler` is data; no gating logic here |
| D6 | `audioRef`, `spokenKo`, `narrationAudioRef` are in the schema; TTS needs no field |
| D7 | `SceneArt` is a token-only data description; no raster or emoji field exists in the schema |
| D8 | Spec id F-STORY-001 |
| D9 | `theme` is one of the five keys; `placement: 'shelf'` keeps shelf stories out of the 7x5 grid |
| D13 | The importer renames `rr` → `romanization`; correctness is F-CNT-002's scan, not a second checker |
| D14 | Every factual narration statement maps to a sourced fact (C1-C5, process C6); heritage research files are imported field-for-field |

Decisions made in this spec:

1. **Camel-case JSON, `*En` suffix** for English fields, to match the existing schemas and F-STORY-003/-004 field names; the research snake_case is converted by the importer only. `quote_or_locator` becomes `quoteOrLocator`.
2. **One file per story, flat directory**; `state: draft | ready` instead of a second directory, so history of an import is `git log` of one file.
3. **Drafts are validated for correctness, not completeness**: facts, sources and coverage rules apply from the first commit; captions/art/explanations/romanization of titles can wait.
4. **Reference zone by key and by directory**, not a global relaxation of F-CNT-001: Hangul in citations and reviewer text is bibliographic data; learner fields stay strict.
5. **Inline `{kw:id}` tokens instead of Hangul in prose** (53 of 182 research scenes needed this) so romanization and a gloss are guaranteed by construction (D2), translations cannot drop them (token multiset check), and the reader can render a tap-for-gloss chip.
6. **Derived claims are explicit** (`approximations`, `timeRelative`) rather than forbidden: "almost 600 years ago" is useful to a learner and true, but it is a computation, not a source quote, and it goes stale; recording the rationale and flagging time-relative ones for a yearly review is the honest option.
7. **Verification is stored per story, written per cluster**: the research process verified clusters; copying the record with `scope: 'cluster'` keeps the gate (`passes >= MIN_VERIFICATION_PASSES`, which is **3**, the real process: author, two independent checkers, a reviser, a third final pass) enforceable per story without claiming more precision than we have.
8. **Facts are re-verifiable, not frozen**: `rev` and `contentVer` make every change visible in review; corrections are an append-only visible list; there is no silent edit path in CI.
9. **No runtime zod parse of the bundle**; typed literals + the schema test are the two gates.
9a. **One strict object, two refinements, no union** (zod 3 cannot discriminate refined schemas) and **every cross-spec field has a slot now** (`shelf`, `pillarTags`, `companionId`, `card`, `rewardCardIds`), so F-STORY-004/005/006 add rules, never amend the schema.
10. **No over-the-air content channel in this spec**: the PWA is the primary channel and updates through the existing service-worker flow; a native advisory channel is a recorded follow-up, not a hidden promise.
11. **Authoritative-source rule is host-based** (`.go.kr`, UNESCO, encykorea, itkc, snu) because it is cheap, explainable and holds for all 211 current facts; news and festival sites remain allowed as *additional* sources.
12. **Importer is one-time and non-destructive** (refuses to overwrite) and reports gaps instead of guessing romanization or glosses.
