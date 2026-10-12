Status: ready

# F-VOC-001 — Vocabulary: schema, 144 launch words in 12 topics, the `content/vocab/` pipeline and its validator

**Scope**: `packages/content-schema` (`schemas/vocab.ts`; `schemas/ko-text.ts` already exists since F-QUEST-002 Q-1, PR #103, and is only imported; telemetry names are F-VOC-003/004/005's) · `content/vocab/` (new, owner-approved, D4) · `content/i18n/{es,ko}/vocab-*.json` (overlays, F-I18N-001 mechanism) · `scripts/build-vocab.mjs` (+ `--check`) · `apps/mobile/src/logic/vocab/catalog.ts`, `apps/mobile/src/content/vocab.ts` and `__generated__/vocab.ts` · `apps/mobile/src/screens/minigames/host.ts` (`MinigameHost`, only if F-QUEST-002 Q-3a has not landed it) · `apps/web/src/data/vocab-catalog.ts` (generated mirror for the console) · CI (`content-validation.yml` paths)
**Owner**: solo dev
**Rollout**: first of five specs (F-VOC-001..005). PR order in §6. Nothing reaches a learner until F-VOC-003 flips `flags.vocabTopicsEnabled`.
**Wireframes**: this spec has no screen. The five screens of the feature are in `wireframes/vocab-topics.md`, `vocab-flashcards.md`, `vocab-speed-round.md` (F-VOC-003/004).

Parent / siblings: F-CNT-002 (Revised Romanization policy, converter, checker; **this spec's validator is a consumer, not a copy**) · F-CNT-001 (content language policy, `scripts/validate-content.mjs`) · F-I18N-001 (content overlays, `KoreanText`, `romanizationShown`) · F-QUEST-002 §3.1 (`KoTextSchema`, `PictureRefSchema`), §3.10-§3.12 (Listen & Pick, Pic-Word Match, `MinigameHost`, `playPrompt`) · F-AUDIO-004 (`audioRef` grammar `audio/vocab/<slug>.mp3`, `canPlayKorean`) · F-STORY-004 §3.9 (`content-access.ts`, `FREE_VOCAB_TOPIC_IDS`) · F-STORY-001 (same JSON-first pipeline for stories) · F-LEARN-001 (`levelOrder`) · F-VOC-002 (WordArt), F-VOC-003 (picker, flashcards), F-VOC-004 (Speed Round), F-VOC-005 (progress, spaced repetition, sync) · design input `design-inputs/topic-speed-quiz.md` · blueprint 02 §3 (Theme Packs: food, colors, family, school, animals, K-pop), 04 (Stage 2 goal about 200 words)

---

## Decisions

Binding owner decisions this spec implements: **D1** (anyone, any age: no age labels; the learner *level* only changes how a topic is played, never which words are allowed) · **D2** (Korean taught with romanization and a gloss in the UI language; glosses in English, Spanish and a Korean description) · **D4** (JSON first under `content/vocab/`, generated into the apps, validated on the shipped content) · **D5** (the intended free set is data, flagged off) · **D6** (`audioRef` optional, TTS first) · **D7** (pictures are SVG: card art reuse, WordArt, generated; no emoji, no raster) · **D8** (spec ids) · **D13** (Revised Romanization, unhyphenated).

Decisions taken in this spec (V = vocabulary decision):

| # | Decision | Why |
|---|---|---|
| V1 | **A `VocabItem` is a flat object** `{ id, ko, romanization, en, ... }`. The brief's `rr` is stored under the key `romanization`. | `scripts/validate-content.mjs:88-108` requires `romanization` and `gloss_en` or `en` on the **same object** as a `ko` field (so **every** object in `content/vocab/**` that carries a `ko` string must also carry both, including `titleKo`, `example` and any registry file); F-CNT-002 §3.4 accepts `rr` only as a story/vocab alias, and `KoTextSchema` (F-QUEST-002 §3.1) already names it `romanization`, so a vocabulary item *is* a `KoText` plus metadata and can be handed to `KoreanText`, `playPrompt` and Listen & Pick unchanged. |
| V2 | **One id per sense**: `vocab:<romanization without spaces>[-<sense>]`. A sense suffix is **mandatory** for every word that has a second meaning in `content/vocab/_senses.json` (§3.3) and is added pre-emptively for the launch words most likely to collide (`nun-eye`, `nun-snow`, `bae-belly`, `bae-boat`, `i-tooth`, `pal-arm`, `dari-leg`, `hae-sun`, `dal-moon`, `bi-rain`, `gong-ball`, `pyo-ticket`, `yeong-zero`, and since the 2026-10-11 production review `sagwa-apple`, `sae-bird`, `yeol-ten`). Ids are permanent: they are file names (`audio/vocab/<slug>.mp3`), progress keys (F-VOC-005) and overlay keys. | The four required homonyms (눈, 배, 이, 팔) and their next senses must never share progress or audio. |
| V3 | **Glosses: English lives in the item, Spanish and the Korean description live in overlays** (`content/i18n/<locale>/vocab-<topic>.json`, F-I18N-001 §3.6). The runtime `VocabItem.glosses = { en, es?, ko? }` is **assembled** by the generator; there is no second source of truth. | A Korean description is Hangul in a non-target field, which `validate-content.mjs:109-121` rejects in base files (`korean-in-ui-field`) and F-I18N-001 §3.7 allows in `ko` overlays only; and unreviewed Spanish must stay behind `LOCALE_STATUS` (F-I18N-001 PR 15/16), which an in-file `es` would bypass. |
| V4 | **Twelve topics x twelve words = 144 launch items, all unique** (no word sits in two topics at launch). `topics[]` exists in the schema (first = primary) so a later word can serve two topics without a copy. | 3 flashcard chunks of 4 (§F-VOC-003); enough distractors for 4 options inside a topic; about 72 % of the Stage 2 goal of about 200 words (blueprint 04 / 05). Growing to 24 per topic is v1.1. |
| V5 | **Numbers teach native Korean first** (하나 ... 열, 스물) because counting objects, ages and "how many" come first for a beginner; **Sino-Korean** (일 이 삼 ...) is a separate v1.1 topic `numbers-sino` whose ids (`vocab:i-two`, `vocab:pal-eight`) are **reserved now** in `_senses.json` so the Body words 이 (tooth) and 팔 (arm) can never collide with them. Zero (영) is in the launch deck, flagged as the Sino-Korean zero. | See §3.5. |
| V6 | **Family terms are all taught, with who says them.** 언니 / 누나 (older sister) and 오빠 / 형 (older brother) are four items whose English gloss names the speaker ("said by a woman or girl"), whose `senseGroup` keeps each pair out of the same question, and whose pictures show the speaker beside the older sibling (F-VOC-002). No gender is asked of the learner and none is stored. | Heritage families (P4) need all four; the profile has no gender field and gets none. |
| V7 | **The JSON in `content/vocab/` is the source of truth; the apps read a generated TypeScript module** produced by `scripts/build-vocab.mjs` and checked in, with `--check` in CI (the same drift-detector idea as `design-token-sync.yml` and F-I18N-001's `build-overlays.mjs`). Validation is by vitest suites that read the JSON with `node:fs` and parse it with the zod schemas (F-CNT-002 C2: no loader, no `tsx`). | One definition of every word; the generator has no logic beyond shaping, so it needs no schema import. |
| V8 | **Pictures use F-QUEST-002's `PictureRef` grammar** (`card:<id>` = HeritageCardArt, `word:<key>` = WordArt). `swatch:*` is **not** used by vocabulary (colours are `word:color-*`, generated, with an object cue; F-VOC-002). A launch item **must** have a picture (`visual` required). | One resolver (`PictureArt`) for Listen & Pick, Pic-Word Match and the speed round; the design input's `emoji` variant is dropped outright (D7). |
| V9 | **Learner level never gates content.** `VocabItem.level` (1-3) orders flashcard chunks and selects distractor difficulty; the learner level (`levelOrder`, F-LEARN-001) only changes question formats, option count and defaults (F-VOC-004). | D1: no age gating, no "too hard for you". |
| V10 | **The free set is data**: `FREE_VOCAB_TOPIC_IDS = ['food','animals','colors','numbers']` lives in F-STORY-004's `content-access.ts`; this spec only guarantees the four topic keys exist. No lock, no "Premium" pill (D5). | D5; one function (`isFreeContent('vocab-topic', key)`). |
| V11 | **No real people, brands or artists** in the lists (K-Culture uses things, foods, places, festivals, instruments). | Impersonation / trademark risk and child safety. |
| V12 | **Every list needs native-speaker review before reaching learners**: Korean by the owner, Spanish by the external reviewer of F-I18N-001 PR 15. Until then topics are `status: 'draft'` and the picker shows only `ready` topics. **2026-10-11 owner decision**: a multi-reviewer production review (Korean, romanization and gloss lenses) replaces the human native review; Food, Animals, Colors and Numbers passed it and are `ready` (the §3.4 tables below carry its fixes). | The word choices, glosses and Korean descriptions in §3.4 were drafts until that review. |

---

## 1. Context

**What exists** (verified at `main` HEAD `ecf6365`, after PRs #102-#105; re-verified by the independent review of 2026-10-10, `reviews/REVIEW-VOC.md`):

- **No vocabulary type, no vocabulary data and no `content/vocab/` directory.** `content/` holds `episodes/stage-1/{jamo,cards}.json`, `fixtures/` and a README (`content/README.md`). `packages/content-schema/src/index.ts:1-25` exports no `vocab` schema (it does export `schemas/ko-text`, added by F-QUEST-002 Q-1). CLAUDE.md §2 already lists `content/vocab/` (owner approval recorded by F-I18N-001 PR 0, merged as #99).
- **About 70 real Korean words already live in code** with romanization and a gloss: the 30 Stage 1 cards (`apps/mobile/src/content/heritage-cards.ts:28-68`), the Stage 2 taste cards 사과, 우유, 빵, 도시락, 하늘, 꽃, 나무, 별 (`:70-83`), and `minigame-config.ts` pairs. Vocabulary words that coincide with these (사과, 우유, 빵, 밥, 김치, 김밥, 하늘, 꽃, 나무, 별, 책, 산, 바다, 달, 호랑이, 한복, 설날, 추석, 윷놀이, 가야금) **must keep the same romanization everywhere**: F-CNT-002's R5 (`checkConsistency`, `romanization/compare.ts:166`, hyphens included) fails the suite when two sources disagree. Beyond that list, the hyphenated example-word romanizations in `content/episodes/stage-1/jamo.json` and `cards.json` and in `apps/web/src/data/stage1-cards.ts` also cover launch words (verified by script: 강아지 `gang-a-ji`, 나비, 라면, 사과, 호랑이, 야구, 여우, 오리, 토끼, 아빠, 우유, 윷놀이 `yut-no-ri`), so the cross-source rule `vocab-romanization-consistent` is switched on only once F-CNT-002 PR 2b has removed those hyphens (it is a PR 3 behaviour, §3.8); until then `vocab-romanization` (R1-R3 on the vocabulary file itself) is the gate, and every vocabulary word already equals `romanizeWord(ko)`.
- **The content validator** (`scripts/validate-content.mjs`) walks `content/**/*.json` (`:68-81`, skipping `content/stories/research/`, `:28`) and enforces, per object: Korean only in `ko`/`korean`/`target`/`answer_ko`/`lang_ko` (`:31-37`), a sibling `romanization` and `gloss_en` or `en` on **any** object that has such a Hangul field (`:88-108`), no Hangul in any other string field (`:109-121`), and a banned-word list (`missed`, `incomplete`, `failed`, `overdue`, `:47-52`) on learner English fields (`:54-66`, `:122-133`). It accepts any JSON shape, so vocabulary needs no change to it **if every Hangul-bearing object is flat and complete** (V1; this is why `_senses.json` stores no Hangul, §3.2).
- **The Revised Romanization converter and checker shipped** (#102): `romanizeWord` (`packages/content-schema/src/romanization/rr.ts:167`), `syllableSplit` (`:198`), `checkRomanization` (`compare.ts:90`), `checkConsistency` (`:166`), `ROMANIZATION_EXCEPTIONS` (`exceptions.ts:18`, ships empty). F-CNT-002 §3.4 will scan `content/**/*.json` for `ko` + `romanization` pairs through `romanization-content.test.ts` and `romanization-coverage.test.ts`, but **those two suites are F-CNT-002 PR 3 and are not on `main`** (PR 1 shipped only the converter, checker and extractor), so this spec's own `vocab-content.test.ts` (§3.8) runs `checkRomanization` over the vocabulary files from V-2 on; when PR 3 lands it also scans them and the ignore-list registration of §3.7 applies.
- **Level ids and settings**: `LEARNER_LEVELS` / `levelOrder()` (`packages/content-schema/src/schemas/learner-level.ts:32-58`); `ProfileSettingsSchema` (`schemas/locale.ts:20-24`). Telemetry list `TELEMETRY_EVENT_NAMES` (`schemas/telemetry.ts:9-50`, 38 names) with its exact-list test (`packages/content-schema/src/__tests__/telemetry.test.ts:5-49`).
- **Pictures**: `supportedCardIds` lists 30 card art ids (`packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx:21-56`), of which 13 are vocabulary words (§3.4). The component draws a generic fallback for any other id (`:1205-1213`), so a vocabulary picture must be checked, never assumed.
- **Audio**: `speak()` / `playJamoSound` today (`apps/mobile/src/platform/audio.ts:26-54`); F-AUDIO-004 replaces them with `playPrompt` and fixes `audioRef = audio/vocab/<slug>.mp3` (its §3.2 `AUDIO_REF_PATTERN`, §3.10 layout).
- **What the design input got right and this spec changes**: it proposed `VisualRef` as a union including `emoji` and a `swatch` kind with an anchor, a flat `gloss_en` plus an optional `glosses` map, and `VocabItemState` in the snapshot. This spec keeps the item/topic split and the sizes, drops `emoji`, makes `visual` a `PictureRef`, moves non-English glosses to overlays (V3), and leaves progress to F-VOC-005.

**What this spec does.** (1) Defines the zod schemas for items, topics, the sense registry and the generated module. (2) Fixes the 12 launch topics and writes out **all 48 words of Food, Animals, Colors and Numbers** with Korean, Revised Romanization, English, Spanish, a draft Korean description, picture, level and notes, and gives the other eight topics a selection rule plus a **seed list** (also checked, §3.4). (3) Fixes the numbers, family and homonym policies. (4) Specifies the `content/vocab/` file layout, the generator, the validator rules (including the romanization check) and the runtime accessors the other four specs read.

Terms. **Item**: one sense of one word. **Topic**: a named group of items shown as one tile. **Sense group**: items that must never appear together as answer options (same `ko`, or near-synonyms that a picture cannot tell apart). **Launch**: the 12 x 12 set of this spec. **Picture ref**: `card:<id>` or `word:<key>` (F-QUEST-002 §3.1).

## 2. User story

> As someone learning Hangul from zero — a child with a parent, a teenager, an adult on a phone — I want to pick a topic like Food or Animals, see each word with a picture, hear it, and read how it is said, so that I can build real vocabulary in small, friendly steps.

Companion stories:

- As a **content author**, I want one JSON file per topic, checked by CI for correct romanization, duplicate words, missing pictures and shaming text, so that adding the next 12 words is data plus a review, not code.
- As a **Spanish- or Korean-speaking learner**, I want the gloss in my language (a Korean *description*, not an echo) next to the Korean word, with the picture as the main clue.
- As a **teacher**, I want the word ids stable and readable (`vocab:sagwa-apple`) so progress and plans can name them.
- As a **developer of the quiz and review engines**, I want a pure, typed list of items with sense groups and picture refs, so distractor logic never has to guess.

## 3. Acceptance criteria

### 3.1 Schemas (`packages/content-schema/src/schemas/vocab.ts`, exported from `src/index.ts`, 100 % covered)

`ko-text.ts` (`KoTextSchema`, `PictureRefSchema`) **exists** (F-QUEST-002 Q-1, PR #103, `packages/content-schema/src/schemas/ko-text.ts`: `{ ko, romanization, en, spokenKo?, audioRef?, syllables? }`; `PictureRefSchema = /^(card|word|swatch):[a-z0-9-]+$/`) and is only imported here — one file, never a second copy. `KoTextSchema` is a `ZodEffects` (it has a `superRefine`), so it has no `.pick` / `.extend`; this spec uses it whole where it needs a `KoText`, and never derives a narrower schema from it.

```ts
export const VOCAB_TOPIC_KEYS = [
  'food','animals','family','school','body','colors','numbers','nature','travel','sports','k-culture','science',
] as const;                                   // v1.1 appends: 'numbers-sino', 'home', 'weather', 'clothes', 'feelings', 'actions' (additive)
export const VocabTopicKeySchema = z.enum(VOCAB_TOPIC_KEYS);
export const VocabIdSchema = z.string().regex(/^vocab:[a-z0-9]+(-[a-z0-9]+)*$/);
export const VocabPosSchema = z.enum(['noun','pronoun','verb','adjective','number','expression']);   // launch: noun | number, plus `pronoun` for 나 only

export const VocabItemSchema = z.object({
  id: VocabIdSchema,
  ko: z.string().min(1).max(12),                       // Hangul syllables and spaces only (refined below)
  romanization: z.string().min(1).max(40),             // Revised Romanization, unhyphenated; checked by F-CNT-002
  en: z.string().min(1).max(40),                       // base English gloss; no Hangul; banned-word scanned
  pos: VocabPosSchema.default('noun'),
  topics: z.array(VocabTopicKeySchema).min(1).max(3),  // topics[0] = primary = the file the item lives in
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  visual: PictureRefSchema,                            // 'card:*' or 'word:*' (never 'swatch:*', V8)
  senseNote: z.string().max(90).optional(),            // plain English, no Hangul; say who/when (§3.6)
  senseGroup: z.string().regex(/^[a-z0-9-]+$/).optional(),  // §3.3
  spokenKo: z.string().min(1).optional(),              // F-AUDIO-004: what the voice says when it differs from `ko`
  audioRef: AudioRefSchema.optional(),                 // audio/vocab/<slug>.mp3 where <slug> = id without 'vocab:'
  example: z.object({ ko: z.string(), romanization: z.string(), en: z.string() }).optional(), // level 2+; v1.1 for most words
}).superRefine(/* §3.2 rules 1-6 */);

export const VocabTopicSchema = z.object({
  id: z.string().regex(/^vocab-topic:[a-z0-9]+(-[a-z0-9]+)*$/),     // = `vocab-topic:${key}` (a refinement); the entity id that overlays and the F-I18N-001 `overlay-unknown-id` rule look up
  key: VocabTopicKeySchema,
  order: z.number().int().min(1).max(99),
  titleEn: z.string().min(1).max(24),
  titleKo: KoTextSchema,                               // e.g. 음식 / eumsik / food: shown with KoreanText on the tile (the optional KoText fields stay unused)
  blurbEn: z.string().max(70),                         // one plain line; no age words
  hoyaIntroEn: z.string().max(90),
  tint: z.enum(['theme.letters','theme.life','theme.rites','theme.nature','theme.crafts','stage.stage2']),
  coverItemId: VocabIdSchema,                          // the tile picture = that item's visual
  status: EpisodeStatusSchema,                         // reuse: draft | ready | shipped | preview (`schemas/episode.ts:7`)
  fixedOrder: z.boolean().default(false),              // true: flashcard chunks keep file order (colors, numbers)
});

export const VocabTopicFileSchema = z.object({
  schemaVersion: z.literal(1),
  topic: VocabTopicSchema,
  items: z.array(VocabItemSchema).min(8).max(60),      // launch: exactly 12 (a test, not the schema, so v1.1 can grow)
}).superRefine(/* topic.coverItemId is an item of this file; topic.id === `vocab-topic:${topic.key}`; item ids unique inside the file */);

export const VocabSensesFileSchema = z.object({        // content/vocab/_senses.json
  schemaVersion: z.literal(1),
  groups: z.array(z.object({
    group: z.string().regex(/^[a-z0-9-]+$/),          // NO Korean string here: `validate-content.mjs` would demand a romanization and a gloss next to it (`:88-108`); the homonym's Hangul is read from the items
    members: z.array(z.object({ id: VocabIdSchema, en: z.string(), state: z.enum(['launch','reserved']) })).min(1),
  })),
});

export type VocabItem = z.infer<typeof VocabItemSchema>;
export type VocabTopic = z.infer<typeof VocabTopicSchema>;
/** Runtime view assembled by the generator (§3.7): the item plus its glosses in every shipped locale. */
export interface RuntimeVocabItem extends VocabItem { glosses: { en: string; es?: string; ko?: string } }
```

**Item rules (`superRefine`, each with a path in the failure):**
1. `ko` matches `^[가-힣]+( [가-힣]+)*$` (completed syllables only; no jamo, no Latin, no digits).
2. `id` ends with the suffix pattern of V2: if `senseGroup` is set the id's last segment must be a sense word (checked in the file-level test against `_senses.json`).
3. `visual` is `card:` or `word:` (not `swatch:`, no `emoji`).
4. `audioRef`, when present, equals `audio/vocab/<id without 'vocab:'>.mp3`.
5. `en`, `senseNote` contain no Hangul (F-CNT-001 `korean-in-ui-field`, also enforced by `validate-content.mjs`) and no banned learner word.
6. `topics[0]` equals the topic of the file the item sits in (file-level test).

**The generated module's shape** (`apps/mobile/src/content/__generated__/vocab.ts`, §3.7): `export const VOCAB_TOPICS: readonly VocabTopic[]` (ordered by `order`) and `export const VOCAB_ITEMS: readonly RuntimeVocabItem[]` (ordered by topic `order`, then file order) plus `export const VOCAB_SENSES`.

### 3.2 Item identity and the sense registry

- `id` = `vocab:` + the item's `romanization` with spaces removed and lower-cased + `-<sense>` when needed. Examples: `vocab:sagwa-apple`, `vocab:nun-eye`, `vocab:nun-snow`, `vocab:bae-belly`, `vocab:bae-boat`, `vocab:i-tooth`, `vocab:pal-arm`, `vocab:eonni`, `vocab:yunnori` (the pronunciation form, F-CNT-002 D13).
- The audio file for an item is `audio/vocab/<slug>.mp3` with `<slug>` = the id without `vocab:` (F-AUDIO-004 §3.10); the generated recording script (F-AUDIO-004 §3.11) lists items in topic order.
- **`content/vocab/_senses.json`** holds every group that has more than one member, **launch and reserved**. A reserved member is a sense that is **not shipped yet** but whose id is taken so a later PR cannot reuse it:

| Group | Homonym (this column is documentation only: **the file stores no Hangul**) | Launch members | Reserved members |
|---|---|---|---|
| `nun` | 눈 | `vocab:nun-eye` (Body), `vocab:nun-snow` (Nature) | |
| `bae` | 배 | `vocab:bae-belly` (Body), `vocab:bae-boat` (Travel) | `vocab:bae-pear` (a Food item in v1.1) |
| `i` | 이 | `vocab:i-tooth` (Body) | `vocab:i-two` (`numbers-sino`) |
| `pal` | 팔 | `vocab:pal-arm` (Body) | `vocab:pal-eight` (`numbers-sino`) |
| `dari` | 다리 | `vocab:dari-leg` (Body) | `vocab:dari-bridge` |
| `hae` | 해 | `vocab:hae-sun` (Nature) | `vocab:hae-year` |
| `dal` | 달 | `vocab:dal-moon` (Nature) | `vocab:dal-month` |
| `bi` | 비 | `vocab:bi-rain` (Nature) | `vocab:bi-broom` |
| `gong` | 공 | `vocab:gong-ball` (Sports) | `vocab:gong-zero` (phone-number zero) |
| `pyo` | 표 | `vocab:pyo-ticket` (Travel) | |
| `yeong` | 영 | `vocab:yeong-zero` (Numbers) | |
| `sagwa` | 사과 | `vocab:sagwa-apple` (Food) | `vocab:sagwa-apology` |
| `sae` | 새 | `vocab:sae-bird` (Animals) | `vocab:sae-new` |
| `yeol` | 열 | `vocab:yeol-ten` (Numbers) | `vocab:yeol-fever` (fever, heat) |
| `older-sister` | | `vocab:eonni`, `vocab:nuna` | |
| `older-brother` | | `vocab:oppa`, `vocab:hyeong` | |

(A group with one launch member and no reserved member, such as `pyo` and `yeong`, is allowed (`members.min(1)`): it records that the id suffix is deliberate and keeps the id from being reused.)

- **Rules the validator enforces on senses** (all in the file-level suite, §3.8): (a) two launch items with the same `ko` must share a `senseGroup` (the homonym is detected from the items' own `ko`; the registry file holds no Hangul); (b) a `senseGroup` named on an item exists in `_senses.json` and lists that id as `launch`; (c) no reserved id is used by an item; (d) every `launch` member exists as an item; (e) every item that is a `launch` member names that group as its `senseGroup` (otherwise `sameSense` and the quiz would not see the homonym).
- **What the quiz does with groups** (F-VOC-004 §3.3): items in one `senseGroup` are never both options in the same question; a homonym prompt in a mixed-topic session carries a topic chip.

### 3.3 The twelve launch topics

| # | key | Title | `titleKo` (taught) | Tint | Cover item | Free set (D5, flagged off) |
|---|---|---|---|---|---|---|
| 1 | `food` | Food | 음식 eumsik | `theme.life` | `vocab:sagwa-apple` | yes |
| 2 | `animals` | Animals | 동물 dongmul | `theme.nature` | `vocab:horangi` | yes |
| 3 | `colors` | Colors | 색 saek | `stage.stage2` | `vocab:ppalgansaek` | yes |
| 4 | `numbers` | Numbers | 숫자 sutja | `stage.stage2` | `vocab:daseot` | yes |
| 5 | `family` | Family | 가족 gajok | `theme.rites` | `vocab:gajok` | no |
| 6 | `school` | School | 학교 hakgyo | `theme.letters` | `vocab:yeonpil` | no |
| 7 | `body` | Body | 몸 mom | `stage.stage2` | `vocab:meori` | no |
| 8 | `nature` | Nature | 자연 jayeon | `theme.nature` | `vocab:san` | no |
| 9 | `travel` | Travel | 여행 yeohaeng | `theme.crafts` | `vocab:bihaenggi` | no |
| 10 | `sports` | Sports | 운동 undong | `theme.crafts` | `vocab:chukgu` | no |
| 11 | `k-culture` | K-Culture | 한국 문화 hanguk munhwa | `theme.rites` | `vocab:hanbok` | no |
| 12 | `science` | Science | 과학 gwahak | `theme.nature` | `vocab:jigu` | no |

(Every `titleKo.romanization` in this table was machine-checked with `romanizeWord`; `한국 문화` is two words and `hanguk munhwa` two words, F-CNT-002 C4. The cover of `numbers` is the picture for five; the cover of `body` is the head.)

Order is the table order. A topic's tint is a **fill/border accent only**, text beside it is `text.primary` (tokens.ts comment `:61-63`). Every topic file holds **exactly 12 items at launch** (a test), at least **8** whose `visual` is a hand-drawn or card picture, not a generated one (the Colors, Numbers and Body decks are exempt: all 12 pictures are generated), and covers all of §3.4's selection rules.

### 3.4 The launch word lists

Conventions for every table: **ko** the taught word; **romanization** Revised Romanization, pronunciation-based, unhyphenated (D13), every value machine-checked against `romanizeWord` (§3.8) — 144 of 144 matched the converter when this spec was written; **en / es** the base and Spanish gloss (Spanish is a draft for the external reviewer); **ko description** the draft Korean *definition* for the Korean UI (never an echo of the word, F-I18N-001 §3.5.4); **visual** the picture ref; **L** the level: by rule 1 = one or two syllables, 2 = three syllables, 3 = four syllables or more; an author may raise a word by one (never lower it) when it is hard to read or culturally new (김밥, 라면, 달걀, 딸기, 스물 are raised), and the lint warns on any other difference. `id` is `vocab:` + romanization (+ the sense suffix shown in the id column when it differs).

#### Food (`food`, 12) — selection rule: everyday foods and drinks a learner meets in a lunch box or a Korean restaurant; at most four culturally Korean items (김치, 김밥, 떡, 라면); no brands.

| id | ko | romanization | en | es | ko description (draft) | visual | L | note |
|---|---|---|---|---|---|---|---|---|
| `vocab:sagwa-apple` | 사과 | sagwa | apple | manzana | 빨갛고 동그란 과일 | `word:food-apple` | 1 | 사과 also means "apology": sense group `sagwa`, `vocab:sagwa-apology` reserved |
| `vocab:banana` | 바나나 | banana | banana | banana | 길고 노란 과일 | `word:food-banana` | 2 | loanword; written 바나나 |
| `vocab:uyu` | 우유 | uyu | milk | leche | 소에서 얻는 하얀 마실 것 | `word:food-milk` | 1 | |
| `vocab:ppang` | 빵 | ppang | bread | pan | 밀가루 반죽을 구워 만든 음식 | `word:food-bread` | 1 | |
| `vocab:bap` | 밥 | bap | cooked rice | arroz cocido | 쌀을 익혀 만든 음식 | `card:rice` | 1 | senseNote: also "a meal", uncooked rice is ssal; the card art is reused |
| `vocab:gimchi` | 김치 | gimchi | kimchi | kimchi | 배추에 양념을 버무려 만든 매운 반찬 | `card:kimchi` | 1 | card art reused; senseNote: a side dish of fermented vegetables |
| `vocab:gimbap` | 김밥 | gimbap | gimbap (seaweed rice roll) | gimbap (rollo de arroz con alga) | 김으로 밥과 채소를 돌돌 만 음식 | `card:kimbap` | 2 | card art reused |
| `vocab:ramyeon` | 라면 | ramyeon | instant noodles | fideos instantáneos | 끓는 물에 익혀 먹는 꼬불꼬불한 면 | `word:food-ramyeon` | 2 | |
| `vocab:mul` | 물 | mul | water | agua | 마시는 맑은 액체 | `word:food-water` | 1 | |
| `vocab:dalgyal` | 달걀 | dalgyal | egg | huevo | 닭이 낳는 타원형의 알 | `word:food-egg` | 2 | senseNote: also called gyeran; 계란 is also common; 달걀 is the native word |
| `vocab:ttalgi` | 딸기 | ttalgi | strawberry | fresa | 작고 빨갛고 달콤한 과일 | `word:food-strawberry` | 2 | |
| `vocab:tteok` | 떡 | tteok | rice cake | pastel de arroz | 쌀가루를 쪄서 만든 쫀득한 음식 | `word:food-tteok` | 1 | senseNote: soft, chewy, made from rice ("rice cake" alone suggests a puffed cracker) |

#### Animals (`animals`, 12) — selection rule: animals anyone can draw and recognise in one glance, from pets to zoo animals, plus the national tiger; no insects except the butterfly; no scary animals.

| id | ko | romanization | en | es | ko description (draft) | visual | L | note |
|---|---|---|---|---|---|---|---|---|
| `vocab:horangi` | 호랑이 | horangi | tiger | tigre | 줄무늬가 있는 큰 고양잇과 동물 | `card:tiger` | 2 | Hoya is a young tiger; card art reused |
| `vocab:goyangi` | 고양이 | goyangi | cat | gato | 야옹 하고 우는 작은 동물 | `word:animal-cat` | 2 | |
| `vocab:gangaji` | 강아지 | gangaji | puppy | perrito | 멍멍 짖는 어린 개 | `word:animal-puppy` | 2 | `content/episodes/stage-1/cards.json:6` writes `gang-a-ji` until F-CNT-002 PR 2b; 강아지 is also the everyday word for a pet dog (the plain word 개 is v1.1), so "puppy" stays the launch gloss and a senseNote names the pet-dog use and gae |
| `vocab:tokki` | 토끼 | tokki | rabbit | conejo | 귀가 길고 깡충깡충 뛰는 동물 | `word:animal-rabbit` | 1 | |
| `vocab:gom` | 곰 | gom | bear | oso | 몸집이 크고 털이 많은 동물 | `word:animal-bear` | 1 | |
| `vocab:sae-bird` | 새 | sae | bird | pájaro | 날개로 하늘을 나는 동물 | `word:animal-bird` | 1 | 새 also means "new": sense group `sae`, `vocab:sae-new` reserved |
| `vocab:mulgogi` | 물고기 | mulgogi | fish | pez | 물속에서 헤엄치는 동물 | `word:animal-fish` | 2 | |
| `vocab:ori` | 오리 | ori | duck | pato | 꽥꽥 울고 물에 뜨는 새 | `word:animal-duck` | 1 | |
| `vocab:yeou` | 여우 | yeou | fox | zorro | 꼬리가 풍성하고 영리한 동물 | `word:animal-fox` | 1 | |
| `vocab:wonsungi` | 원숭이 | wonsungi | monkey | mono | 나무를 잘 타고 사람과 닮은 동물 | `word:animal-monkey` | 2 | |
| `vocab:kokkiri` | 코끼리 | kokkiri | elephant | elefante | 코가 길고 몸집이 아주 큰 동물 | `word:animal-elephant` | 2 | |
| `vocab:nabi` | 나비 | nabi | butterfly | mariposa | 꽃 사이를 날아다니는 예쁜 곤충 | `word:animal-butterfly` | 1 | |

#### Colors (`colors`, 12) — selection rule: the twelve basic colour words (11 hues plus sky blue); each colour is shown as a swatch **with an object**, never colour alone (F-VOC-002 §3.5); the `-색` forms are the standard "X-coloured" words.

| id | ko | romanization | en | es | ko description (draft) | visual | L | note |
|---|---|---|---|---|---|---|---|---|
| `vocab:ppalgansaek` | 빨간색 | ppalgansaek | red | rojo | 사과와 딸기 같은 색 | `word:color-red` | 2 | casual short form is 빨강 (v1.1 note) |
| `vocab:juhwangsaek` | 주황색 | juhwangsaek | orange | naranja | 귤 같은 색 | `word:color-orange` | 2 | |
| `vocab:noransaek` | 노란색 | noransaek | yellow | amarillo | 바나나 같은 색 | `word:color-yellow` | 2 | |
| `vocab:choroksaek` | 초록색 | choroksaek | green | verde | 풀잎 같은 색 | `word:color-green` | 2 | |
| `vocab:paransaek` | 파란색 | paransaek | blue | azul | 맑은 바다 같은 색 | `word:color-blue` | 2 | |
| `vocab:borasaek` | 보라색 | borasaek | purple | morado | 포도 같은 색 | `word:color-purple` | 2 | |
| `vocab:bunhongsaek` | 분홍색 | bunhongsaek | pink | rosa | 복숭아꽃 같은 색 | `word:color-pink` | 2 | |
| `vocab:haneulsaek` | 하늘색 | haneulsaek | sky blue | celeste | 맑은 날의 하늘 같은 색 | `word:color-skyblue` | 2 | |
| `vocab:galsaek` | 갈색 | galsaek | brown | marrón | 흙과 나무 같은 색 | `word:color-brown` | 1 | |
| `vocab:hoesaek` | 회색 | hoesaek | gray | gris | 구름 낀 날의 하늘 같은 색 | `word:color-gray` | 1 | |
| `vocab:hayansaek` | 하얀색 | hayansaek | white | blanco | 눈과 우유 같은 색 | `word:color-white` | 2 | |
| `vocab:geomeunsaek` | 검은색 | geomeunsaek | black | negro | 밤하늘 같은 색 | `word:color-black` | 2 | |

(Colors and Numbers set `fixedOrder: true` below, so their flashcard chunks follow the table order whatever the levels say.)

#### Numbers (`numbers`, 12) — selection rule: **native Korean counting numbers 1-10** (the numbers used for counting objects and saying age), **스물 (20)** as the next counting step, and **영 (zero)**. Sino-Korean numbers are the separate v1.1 topic (§3.5). Pictures are generated dot/ten-frame patterns (F-VOC-002 §3.6); `fixedOrder: true`.

| id | ko | romanization | en | es | ko description (draft) | visual | L | note |
|---|---|---|---|---|---|---|---|---|
| `vocab:hana` | 하나 | hana | one | uno | 수 1을 우리말로 센 것 | `word:count-1` | 1 | before a counter word (han gae, one thing) it becomes han |
| `vocab:dul` | 둘 | dul | two | dos | 수 2를 우리말로 센 것 | `word:count-2` | 1 | before a counter word: du |
| `vocab:set` | 셋 | set | three | tres | 수 3을 우리말로 센 것 | `word:count-3` | 1 | before a counter word: se |
| `vocab:net` | 넷 | net | four | cuatro | 수 4를 우리말로 센 것 | `word:count-4` | 1 | before a counter word: ne |
| `vocab:daseot` | 다섯 | daseot | five | cinco | 수 5를 우리말로 센 것 | `word:count-5` | 1 | |
| `vocab:yeoseot` | 여섯 | yeoseot | six | seis | 수 6을 우리말로 센 것 | `word:count-6` | 1 | |
| `vocab:ilgop` | 일곱 | ilgop | seven | siete | 수 7을 우리말로 센 것 | `word:count-7` | 1 | |
| `vocab:yeodeol` | 여덟 | yeodeol | eight | ocho | 수 8을 우리말로 센 것 | `word:count-8` | 1 | |
| `vocab:ahop` | 아홉 | ahop | nine | nueve | 수 9를 우리말로 센 것 | `word:count-9` | 1 | |
| `vocab:yeol-ten` | 열 | yeol | ten | diez | 수 10을 우리말로 센 것 | `word:count-10` | 1 | 열 also means "fever, heat": sense group `yeol`, `vocab:yeol-fever` reserved |
| `vocab:seumul` | 스물 | seumul | twenty | veinte | 수 20을 우리말로 센 것 | `word:count-20` | 2 | before a counter word: seumu |
| `vocab:yeong-zero` | 영 | yeong | zero | cero | 아무것도 없음을 나타내는 수 | `word:count-0` | 1 | Sino-Korean (native Korean has no zero; the senseNote says so in plain words); also said 공 in phone numbers (reserved `vocab:gong-zero`) |

(The notes use romanized forms of the counting variants inside English prose, which F-CNT-002 §3.1 item 8 allows, because a note may not contain Hangul. The counting-word forms 한 두 세 네 are taught in Stage 3 counters, not here.)

#### The other eight topics: selection rule and seed list

Each topic's file holds **12 items chosen by its rule**; the seed list below is the intended content (all 96 romanizations were machine-checked) and may change by up to three words per topic during native review without a spec change; a change keeps the rules (12 items, 8+ drawn pictures, no duplicates, no real people or brands).

| Topic | Selection rule | Seed list (ko romanization en) |
|---|---|---|
| `family` (5) | The people of a household and the words a learner needs first; **all four older-sibling words** (V6); no titles of address beyond family. | 엄마 eomma mom · 아빠 appa dad · 할머니 halmeoni grandmother · 할아버지 harabeoji grandfather · 언니 eonni older sister (said by a woman or girl) · 누나 nuna older sister (said by a man or boy) · 오빠 oppa older brother (said by a woman or girl) · 형 hyeong older brother (said by a man or boy) · 동생 dongsaeng younger brother or sister · 아기 agi baby · 가족 gajok family · 나 na I, me |
| `school` (6) | Things in a school bag and a classroom; nouns only; no subject names. | 학교 hakgyo school · 선생님 seonsaengnim teacher · 친구 chingu friend · 책 chaek book (`card:book`) · 연필 yeonpil pencil · 가방 gabang bag · 공책 gongchaek notebook · 지우개 jiugae eraser · 책상 chaeksang desk · 의자 uija chair · 가위 gawi scissors · 칠판 chilpan blackboard |
| `body` (7) | Parts of the body a learner can point at; pictures are generated (a friendly figure plus a ring, F-VOC-002 §3.6); no private body parts. | 눈 nun eye · 코 ko nose · 입 ip mouth · 귀 gwi ear · 머리 meori head · 얼굴 eolgul face · 손 son hand · 팔 pal arm · 다리 dari leg · 발 bal foot · 배 bae belly · 이 i tooth |
| `nature` (8) | Things outdoors that anyone sees in a day; **three reuse card art** (산, 바다, 달). | 산 san mountain · 바다 bada sea · 하늘 haneul sky · 해 hae sun · 달 dal moon · 별 byeol star · 나무 namu tree · 꽃 kkot flower · 비 bi rain · 눈 nun snow · 강 gang river · 구름 gureum cloud |
| `travel` (9) | Vehicles and things a traveller needs; no brand or airline names. | 비행기 bihaenggi airplane · 기차 gicha train · 버스 beoseu bus · 택시 taeksi taxi · 지하철 jihacheol subway · 자동차 jadongcha car · 배 bae boat · 지도 jido map · 여권 yeogwon passport · 표 pyo ticket · 공항 gonghang airport · 호텔 hotel hotel |
| `sports` (10) | Sports and play a learner sees at school or on TV; the Korean martial art taekwondo is in. | 축구 chukgu soccer (football) · 야구 yagu baseball · 농구 nonggu basketball · 배구 baegu volleyball · 탁구 takgu table tennis · 수영 suyeong swimming · 태권도 taegwondo taekwondo · 달리기 dalligi running · 줄넘기 julleomgi jump rope · 자전거 jajeongeo bicycle · 스키 seuki skiing · 공 gong ball |
| `k-culture` (11) | Things, foods, places, festivals and instruments; **five reuse card art** (한복, 설날, 추석, 윷놀이, 가야금); **no people, groups, brands or artists** (V11). | 한복 hanbok hanbok (traditional clothes) · 한글 hangeul Hangul (the Korean alphabet) · 한옥 hanok hanok (traditional house) · 비빔밥 bibimbap bibimbap (mixed rice bowl) · 떡볶이 tteokbokki tteokbokki (spicy rice cakes) · 설날 seollal Lunar New Year · 추석 chuseok Chuseok (harvest festival) · 윷놀이 yunnori yut game (board game with sticks) (not `yutnori`, F-CNT-002 D13) · 가야금 gayageum gayageum (Korean zither) · 노래 norae song · 춤 chum dance · 드라마 deurama TV drama |
| `science` (12) | Concrete things from a first science lesson; levels follow the syllable rule of §3.4 (one-syllable words such as 불, 돌, 빛 stay level 1 or are raised once); no `물` (it is Food's). | 불 bul fire · 얼음 eoreum ice · 돌 dol stone · 자석 jaseok magnet · 지구 jigu Earth · 우주 uju outer space · 로봇 robot robot · 씨앗 ssiat seed · 무지개 mujigae rainbow · 그림자 geurimja shadow · 바람 baram wind · 빛 bit light |

**Counts** (verified against the lists above): 144 items, 144 unique ids, 13 reuse `card:*` art, 131 `word:*` keys of which **95 are hand-authored glyphs and 36 are generated** (12 colours, 12 counts, 12 body) — F-VOC-002 §3.8 plans exactly these.

**Topic flag `fixedOrder`** (§3.1; true for `colors` and `numbers`): the flashcard chunks keep file order instead of sorting by `level`, then file order.

### 3.5 Numbers policy (native first, Sino-Korean next)

- **Why native first**: the first things a beginner counts are objects and ages ("two apples"), which use native numbers up to 99 (하나, 둘 ...); they are also the numbers the Stage 2-3 content uses. Sino-Korean numbers (일, 이, 삼 ...) are for dates, money, minutes, floors and phone numbers: v1.1 topic `numbers-sino` with 일 이 삼 사 오 육 칠 팔 구 십 and 백 천 만 (ids `vocab:il`, `vocab:i-two`, `vocab:sam`, `vocab:sa-four`, `vocab:o-five`, `vocab:yuk`, `vocab:chil`, `vocab:pal-eight`, `vocab:gu-nine`, `vocab:sip`, ...).
- The launch deck teaches 하나-열, 스물 and 영. The two Sino-Korean zeros 영 and 공 differ by context; only 영 is taught.
- **Neither deck teaches counter forms**: 한, 두, 세, 네 before a counter word appear only as a plain-English `senseNote` (romanized, no Hangul), because counters belong to Stage 3 (F-CNT-002 §3.1 item 8 allows romanized words in prose).
- Quiz rule for the Numbers topic (F-VOC-004 §3.3): distractors for a count picture differ by at least 2 for the "Pictures first" level and at least 1 otherwise; 0 and 20 are options only when they are the answer.

### 3.6 Family terms and speaker-dependent words

- Each of 언니 / 누나 / 오빠 / 형 has an English gloss that **names the speaker** ("older sister (said by a woman or girl)"), so the gloss is a complete fact on its own, and `senseNote` repeats it for the card back (`"A woman or girl calls her older sister this. A man or boy says nuna."` — plain English, romanized words, no Hangul).
- Their `senseGroup` is `older-sister` (언니, 누나) and `older-brother` (오빠, 형): the quiz **never** shows two members of a group in one question, because the two pictures are the same older sibling and only the speaker differs (F-VOC-002 §3.6).
- The pictures show the **speaker** (small, with a marker) beside the older sibling (larger): no skin tone, no real-person look, neutral geometric figures (F-VOC-002).
- **No gender question anywhere.** The profile schema has no gender field and this feature adds none (`packages/content-schema/src/schemas/profile.ts:26-38`); the app teaches all four words and the learner uses the ones that fit their own family.
- 할머니 / 할아버지 are paternal-or-maternal-neutral here; 외할머니 / 친할머니 are v1.1.

### 3.7 The pipeline: `content/vocab/` to the apps

**Files**

```
content/vocab/
  README.md              authoring rules (links to §3.1, §3.4 and F-CNT-002 §3.1)
  _senses.json           the sense registry (§3.2)
  food.json animals.json colors.json numbers.json family.json school.json body.json
  nature.json travel.json sports.json k-culture.json science.json     (one VocabTopicFile each)
content/i18n/es/vocab-<topic>.json    overlays: gloss, senseNote, topic title/blurb  (F-I18N-001 §3.6)
content/i18n/ko/vocab-<topic>.json    overlays: Korean description in `gloss`
```

Overlay entry ids and fields (F-I18N-001 §3.6 table, new rows added by this spec's PR V-2a to `OVERLAY_FIELDS`; an overlay file has the shape `{ locale, domain: 'vocab-<topic>', entries }`; the F-I18N-001 `overlay-unknown-id` rule resolves entity ids from `id` fields, which is why the topic object carries `id: 'vocab-topic:<key>'`):

| id prefix | overlay fields | English source |
|---|---|---|
| `vocab:` | `gloss`, `senseNote` | item `en`, `senseNote` |
| `vocab-topic:` | `title`, `blurb`, `hoyaIntro` | topic `titleEn`, `blurbEn`, `hoyaIntroEn` |

`ko` (the taught word), `romanization`, `visual`, `audioRef` and ids are **never overridable** (F-I18N-001 §3.6).

**Generator** `scripts/build-vocab.mjs` (plain Node ESM, no dependencies; `--check` mode exits 1 when the committed outputs differ from what the JSON would produce, like `build-overlays.mjs`):
1. Reads `content/vocab/*.json` (not `_senses.json`) and the overlays for `vocab:` / `vocab-topic:` ids.
2. Writes `apps/mobile/src/content/__generated__/vocab.ts` (`VOCAB_TOPICS`, `VOCAB_ITEMS` with `glosses`, `VOCAB_SENSES`; deterministic order and formatting; a header comment saying "generated by scripts/build-vocab.mjs; do not edit").
3. Writes `apps/web/src/data/vocab-catalog.ts` (id, ko, romanization, en, topic, visual only — for the console's roster summary, F-VOC-005 §3.8, and the `/design-preview/word-art` contact sheet, F-VOC-002 §3.10).
4. Exits non-zero on malformed JSON or a missing field it needs to emit; **semantic validation is the vitest suites' job** (§3.8), so the generator stays a shaper.
Scripts: `pnpm run vocab:build` and `pnpm run vocab:check` (root `package.json`); CI runs `vocab:check` in `content-validation.yml` (its `paths:` already has `content/**` and `packages/content-schema/**`, `.github/workflows/content-validation.yml:5-8`; it gains `scripts/build-vocab.mjs`, `apps/mobile/src/content/__generated__/vocab.ts` and `apps/web/src/data/vocab-catalog.ts`, and a `vocab:check` step after the language-policy step).

**Coverage and registration**: `__generated__/vocab.ts` and `apps/web/src/data/vocab-catalog.ts` contain Hangul. They are added to F-CNT-002's `ROMANIZATION_SCAN_IGNORE` with the reason "generated from `content/vocab` (validated there; a drift test keeps them equal)" (F-CNT-002 §3.4 coverage check demands registration in the same PR). **Whichever of F-CNT-002 PR 3 and V-3 lands second does the registration** (PR 3's walk finds the two files and would fail without it); V-3 adds it only if `ROMANIZATION_SCAN_IGNORE` already exists. `**/__generated__/**` is excluded from the mobile coverage config (F-AUDIO-004 adds the same glob) — the validation coverage is the JSON suite.

**Runtime accessors** (pure functions in `apps/mobile/src/logic/vocab/catalog.ts`, which take the generated arrays as arguments and count towards the business-logic lane, `apps/mobile/vitest.config.ts:33`; `apps/mobile/src/content/vocab.ts` is a three-line binding of the generated arrays to them, and `src/content/**` is tested (`vitest.config.ts:21-27`) but not in the coverage `include`; 100 % covered by `logic/vocab/__tests__/catalog.test.ts`):

```ts
export const vocabTopics: readonly VocabTopic[]                       // status 'ready' | 'shipped' | 'preview' only when the flag allows (below)
export function vocabTopic(key: string): VocabTopic | undefined
export function topicItems(key: string): readonly RuntimeVocabItem[]  // file order, or level-then-file order unless fixedOrder
export function vocabItem(id: string): RuntimeVocabItem | undefined
export const visibleItems: readonly RuntimeVocabItem[]                  // items whose primary topic is in vocabTopics (file order); every catalogue-wide pool or universe (F-VOC-004 mixed review, F-VOC-005, F-RVW-001) uses it, never VOCAB_ITEMS
export function localizedGloss(item: RuntimeVocabItem, locale: UiLocale): string   // glosses[locale] ?? glosses.en
export function sameSense(a: RuntimeVocabItem, b: RuntimeVocabItem): boolean       // same ko or same senseGroup
export function pictureKind(ref: string): 'card' | 'word'
```

`vocabTopics` returns only topics with `status !== 'draft'` unless the binding passes `showDrafts: true` (the `showDrafts` argument of `logic/vocab/catalog.ts`; `content/vocab.ts` reads it from `flags.vocabShowDrafts`, a dev-build flag, default `false`, **registered by F-VOC-003 PR C-3** together with `vocabTopicsEnabled`, so V-3 does not depend on the flags module) — so draft topics ship in the bundle but never reach the picker (V12).

### 3.8 The validator (vitest suites; `romanization-content.test.ts` already scans the JSON)

New suite `packages/content-schema/src/__tests__/vocab-content.test.ts` (reads `content/vocab/*.json` and `content/i18n/*/vocab-*.json` with `node:fs`; the repo `content/` tree is data, not a code import, as F-CNT-002 §3.4 class A does). It fails with the rule id, the item id and the file path. Rules:

| Rule id | Fires when |
|---|---|
| `vocab-schema` | a file fails `VocabTopicFileSchema`, or `_senses.json` fails `VocabSensesFileSchema` |
| `vocab-file-topic` | the file name is not `<topic.key>.json`, or an item's `topics[0]` is not the file's topic |
| `vocab-count` | a launch topic (`VOCAB_TOPIC_KEYS`) does not hold exactly 12 items |
| `vocab-id-format` | an id differs from `vocab:` + `slug(romanization)` + an optional sense suffix, or is duplicated across files |
| `vocab-duplicate-ko` | two items share `ko` and are not in one sense group with a `ko` |
| `vocab-sense-registry` | the five sense-group rules (a)-(e) of §3.2 |
| `vocab-romanization` | `checkRomanization(item.ko, item.romanization)` (F-CNT-002, rules R1-R3) returns an issue, after the shared `ROMANIZATION_EXCEPTIONS`; **a vocabulary word may not use an exception unless the exception carries a reason naming the limit** (F-CNT-002 C7) |
| `vocab-romanization-consistent` | `checkConsistency` over the vocabulary entries **plus every other scanned source** (R5) finds a different romanization for the same Korean string — **switched on by F-CNT-002 PR 3 / after PR 2b** (§1: until the old hyphenated entries are fixed it would fail on 12 launch words); before that the rule compares the vocabulary files with each other only |
| `vocab-topic-title-romanization` | the same check for `topic.titleKo` |
| `vocab-visual-grammar` | `visual` does not match `^(card|word):[a-z0-9-]+$` |
| `vocab-visual-count` | fewer than 8 items per topic have a hand-drawn or card visual (generated keys `word:color-*`, `word:count-*`, `word:body-*` are exempt for their topic) |
| `vocab-text-no-hangul` | `en`, `senseNote`, `titleEn`, `blurbEn`, `hoyaIntroEn` contain Hangul |
| `vocab-banned-word` | a learner English field contains a banned word (`packages/i18n` banned list once F-I18N-001 PR 2 lands; today the list at `scripts/validate-content.mjs:47-52`) or an age word (`kids`, `children`, `ages`, `baby talk`) |
| `vocab-audio-ref` | an `audioRef` is not `audio/vocab/<slug>.mp3` for the item's own slug |
| `vocab-overlay` | an overlay entry names an unknown id, a forbidden field, an `es` value containing Hangul, a `ko` value equal to the item's `ko`, or (for locales in `HANGUL_ROUTE_STRICT_LOCALES`) lacks a gloss — **all as defined by F-I18N-001 §3.7**, reused here, not redefined |
| `vocab-generated-drift` | `__generated__/vocab.ts` or `vocab-catalog.ts` differs from what `build-vocab.mjs` produces from the JSON (the suite spawns the generator in `--check`) |

Cross-package checks that need other packages' data (a `card:*` ref is in `supportedCardIds`; a `word:*` key is in the WordArt key list; every WordArt key is used or marked `reserved`) live in `packages/design-system/src/word-art/__tests__/vocab-keys.test.ts` (F-VOC-002 §3.9), which reads the same JSON; `content-schema` never depends on `design-system`.

**Lint over the shipped feature copy** (F-VOC-003/004 own the copy modules): every learner string is scanned by `scanLearnerCopy` (`apps/mobile/src/logic/homework/banned-text.ts:30-37`) and by a regex test for `\d+\s*%` and `\d+\s*/\s*\d+` (F-RVW-001 §3.1).

### 3.9 Cross-spec contracts this spec sets

- **`MinigameHost`**: if F-QUEST-002 Q-3a has not landed `apps/mobile/src/screens/minigames/host.ts`, PR V-4 adds it with **exactly** `HostMode = 'quest' | 'check' | 'review' | 'vocab' | 'preview'` and `{ mode, answer(roundKey, correct, meta?), complete() }` (F-QUEST-002 §3.12); otherwise reuse it. This spec adds the `vocab` host (`store/vocab-run-store.ts`) in F-VOC-003.
- **Gating**: `ContentKind` already contains `'vocab-topic'` (F-STORY-004 §3.9); vocabulary calls `isFreeContent('vocab-topic', key)` and `isContentLocked(...)`; this spec registers nothing else. With `contentGatingEnabled = false` nothing is locked and no lock, no "Premium" pill is drawn (D5).
- **F-RVW-001**: item ids are `vocab:*` and the topic scope is `vocab-topic:<key>` (`ReviewEntry.scope` is a free string and `itemIds` a `string[]`, `packages/content-schema/src/schemas/progress.ts:65-73`), so no schema change is needed (F-VOC-005 §3.6).
- **Audio**: `playPrompt({ text: item.spokenKo ?? item.ko, audioRef: item.audioRef, kind: 'word' })` (F-AUDIO-004 §3.5). `spokenKo` is **absent** for every launch word (the TTS pronounces whole words correctly; only isolated jamo need carriers).

### 3.10 Behaviours (Given / When / Then)

1. **Given** the 12 topic files, **when** `vocab-content.test.ts` runs, **then** it passes with 144 items, 144 unique ids and every romanization equal to `romanizeWord(ko)`.
2. **Given** a new item `{ ko: '윷놀이', romanization: 'yutnori' }`, **when** the suite runs, **then** it fails with `vocab-romanization` (`윷놀이: given "yutnori", Revised Romanization is "yunnori"`).
3. **Given** an item with `ko: '눈'` and no `senseGroup`, **when** a second `눈` exists, **then** the suite fails with `vocab-duplicate-ko` naming both ids.
4. **Given** an item using the reserved id `vocab:i-two` in `food.json`, **then** `vocab-sense-registry` fails.
5. **Given** a `ko` overlay whose `vocab:sagwa.gloss` is `사과`, **then** `vocab-overlay` fails with F-I18N-001's `overlay-circular-gloss`.
6. **Given** a change to `content/vocab/food.json` without running `pnpm run vocab:build`, **when** CI runs `vocab:check`, **then** the build fails with the first differing line.
7. **Given** `sameSense(vocabItem('vocab:nun-eye'), vocabItem('vocab:nun-snow'))`, **then** it is `true`; **given** `vocabItem('vocab:eonni')` and `vocabItem('vocab:nuna')`, **then** it is `true`; **given** `vocabItem('vocab:eonni')` and `vocabItem('vocab:appa')`, **then** `false`.
8. **Given** a topic with `status: 'draft'` and `flags.vocabShowDrafts` false, **when** `vocabTopics` is read, **then** the topic is absent.
9. **Given** the Spanish UI and an item with no Spanish overlay, **when** `localizedGloss(item, 'es')` is read, **then** the English gloss is returned (F-I18N-001 §3.5.5 fallback).
10. **Given** the ko UI and the overlay description for `vocab:sagwa`, **when** the gloss is read, **then** it is `빨갛고 동그란 과일`, shown on the `KoreanText` chip's gloss line with the romanization `sagwa` unchanged.

## 4. Out of scope

- The WordArt system and the pictures (F-VOC-002); the picker and flashcards (F-VOC-003); the speed round (F-VOC-004); progress, spaced repetition and sync (F-VOC-005).
- Recordings (`audioRef` files): F-AUDIO-004 PR A-10 and owner task T-017; the field and the validator exist here.
- Example sentences for all words (`example` is optional and left empty at launch; level 2+ in v1.1).
- The 12 further topics (`numbers-sino`, `home`, `weather`, `clothes`, `feelings`, `actions`) and growing to 24 words per topic (v1.1).
- Grammar, verbs, adjectives (`pos` accepts them but launch is nouns and numbers only), counters (Stage 3).
- Per-item Spanish and Korean **translation review** (a content process, F-I18N-001 PR 15/16).
- Any gating or "Premium" copy (D5).
- A vocabulary API route: the data is bundled; the console reads the generated mirror (§3.7).

## 5. Tests

| File | Level | Coverage focus |
|---|---|---|
| `content-schema/src/__tests__/vocab.test.ts` | unit, 100 % of `schemas/vocab.ts` | `VocabItemSchema` accepts a good item and rejects: Hangul in `en`, hyphenated romanization (path), `swatch:` visual, bad id, wrong `audioRef`, jamo-only `ko`; `VocabTopicFileSchema` bounds; `VocabSensesFileSchema`; `VOCAB_TOPIC_KEYS` has 12 entries and each topic title pair passes `checkRomanization` |
| `content-schema/src/__tests__/vocab-content.test.ts` | integration over `content/` | every rule of §3.8 with one deliberately broken fixture each (`content/fixtures/vocab-*.json`, never scanned as shipped content) plus the real 12 files passing |
| `scripts/__tests__/build-vocab.test.mjs` | unit (Node test runner, like `validate-content.test.mjs`) | the generator on a trimmed two-topic fixture: order, `glosses` assembly with and without overlays, `--check` exit codes, deterministic output (run twice, equal) |
| `mobile/src/logic/vocab/__tests__/catalog.test.ts` | unit, 100 % of `logic/vocab/catalog.ts` | the accessors of §3.7: draft hiding (`showDrafts` argument), `topicItems` order with and without `fixedOrder`, `sameSense`, `localizedGloss` fallback, `pictureKind` |
| `mobile/src/content/__tests__/vocab-integrity.test.ts` | integration | the generated module has 12 topics x 12 items; ids unique; the numbers of §3.4 (13 card, 95 + 36 word) hold; every `visual` is `card:` or `word:` |
| `design-system/src/word-art/__tests__/vocab-keys.test.ts` | integration | F-VOC-002 §3.9 (cards in `supportedCardIds`, keys resolvable) |
| `packages/content-schema/src/__tests__/romanization-coverage.test.ts` (existing, F-CNT-002) | integration | stays green: the two generated files are registered in `ROMANIZATION_SCAN_IGNORE` |

Coverage targets (CLAUDE.md §6): `packages/content-schema` 100 % (new file included); mobile business logic (`src/content/**` is tested but **not** in the coverage `include`, `apps/mobile/vitest.config.ts:33`, so the accessors live in `src/logic/vocab/catalog.ts` — a pure module taking the generated arrays as arguments — to count towards the 90 % lane; `content/vocab.ts` is a three-line binding of the arrays to those functions).

## 6. Rollout and PR breakdown (dependency order)

Sizes: S <= ~150 changed lines, M <= ~400, L <= ~800 (data PRs count by files). The global order is `docs/roadmap/spec-wave-2026-10.md` §4; **vocabulary joins at step 6 (content)**, its schema and pipeline PRs can start at step 2 because they touch only new files.

| # | PR | Size | Depends on |
|---|---|---|---|
| V-1 | `feat(content-schema)`: `schemas/vocab.ts` (imports the existing `ko-text.ts`), exports, 100 % tests; `AudioRefSchema` use only if F-AUDIO-004's schema landed (else `z.string().regex(AUDIO_REF_PATTERN)` copied from F-AUDIO-004 §3.2 and replaced by the import when that PR lands) | M | F-CNT-002 PR 1 (merged #102), F-QUEST-002 Q-1 (merged #103) |
| V-2a | `feat(content)`: the pipeline without data volume — `content/vocab/README.md`, `_senses.json`, `scripts/build-vocab.mjs` + `build-vocab.test.mjs`, `vocab-content.test.ts` with its broken fixtures, CI wiring, `OVERLAY_FIELDS` rows (waits for F-I18N-001 PR 12, else omitted) | M | V-1 |
| V-2b | `content(vocab)`: **Food** `food.json` (12 items) + its es/ko overlays (English-only first when F-I18N-001 PR 12 has not landed: **a `ko` overlay with Hangul fails `scripts/validate-content.mjs` today** with `korean-in-ui-field` — run in the review on a sample file — so `content/i18n/ko/vocab-*.json` is committed only after PR 12 makes the validator overlay-aware), generated module and web catalog | M | V-2a; F-CNT-002 PR 2b for 사과, 우유, 라면 only if `vocab-romanization-consistent` is already on |
| V-3 | `feat(mobile)`: `logic/vocab/catalog.ts`, `content/vocab.ts`, accessor tests, `ROMANIZATION_SCAN_IGNORE` registration (if F-CNT-002 PR 3 has landed, §3.7) | M | V-2b |
| V-4 | `refactor(mobile)`: `MinigameHost` (only if F-QUEST-002 Q-3a has not landed it) | S | — |
| V-5 | `content(vocab)`: **Colors**, **Numbers**, **Animals** (Animals waits for F-CNT-002 PR 2b so `gangaji`, `horangi`, `nabi`, `ori`, `yeou`, `tokki` are consistent) | M | V-2b, F-CNT-002 PR 2b |
| V-6a | `content(vocab)`: Family, School, Body, Nature as `status: 'draft'` (아빠 waits for F-CNT-002 PR 2b) | M (data) | V-5 |
| V-6b | `content(vocab)`: Travel, Sports, K-Culture, Science as `status: 'draft'` (야구 and 윷놀이 wait for PR 2b) | M (data) | V-6a |
| V-7 | `content(vocab)`: native review applied (owner, Korean) and Spanish review (external); topics flip to `ready` | M | V-6b, review |

Feature flag: none here (`flags.vocabTopicsEnabled` and `flags.vocabShowDrafts` are added by F-VOC-003 PR C-3). Rollback: the data is inert until the picker exists; deleting a topic file and regenerating removes it.

Estimated effort: about 3-4 working days for V-1..V-5 (V-2 is split in two so that the pipeline and the first data are reviewed separately) plus review time for V-7; authoring the 96 seed words' final pictures is F-VOC-002's cost.

## 7. Dependencies

- **Upstream**: F-CNT-002 (converter, checker, coverage registration; PR 2b for the twelve hyphenated or doubly spelled launch words of §1); F-I18N-001 (overlay generator and `OVERLAY_FIELDS`, `LOCALE_STATUS`, banned-word JSON); F-QUEST-002 Q-1 (`ko-text.ts`, merged #103) — hard, already on `main`; Q-3a (`MinigameHost`) — soft, reused if present; F-AUDIO-004 (`AUDIO_REF_PATTERN`) — soft; F-STORY-004 PR 4.2 (`content-access.ts`) — only for the free-set row.
- **Downstream**: F-VOC-002 (visual keys), F-VOC-003, F-VOC-004, F-VOC-005 (ids, topics), F-RVW-001 (item ids), F-PLAN-002 (a `vocab-topic` plan item kind, later), F-TCH-004 (lecture word lists), F-AUDIO-004 PR A-10 (recording list from `content/vocab/**`).

## 8. Unverified assumptions and open items

1. **Linguistic review**: the lists, English glosses, Spanish glosses and Korean descriptions in §3.4 are drafts by the spec author. The romanizations are machine-verified, not the word choices (e.g. 달걀 vs 계란; 빨간색 vs 빨강; "banana" vs "plátano" in Spanish; 한옥 and 드라마 as K-Culture words). The owner reviews the Korean, an external native speaker the Spanish (V12).
2. The `ko` overlay descriptions are written to be *definitions that do not contain the word*; a native editor may prefer different phrasing. They need the overlay machinery of F-I18N-001 PR 12; until then the Korean UI shows the English gloss (F-I18N-001 §3.5.5).
3. **Overlay `OVERLAY_FIELDS` rows for `vocab:` and `vocab-topic:`** are added by this spec's PR V-2a to F-I18N-001's table; if PR 12 has not landed, V-2a omits them, V-2b ships English-only and the overlays follow.
4. **`apps/mobile/vitest.config.ts` coverage `include` is `src/logic/**` and `src/platform/**` only (`:33`)**: the accessors therefore sit in `logic/vocab/catalog.ts` (§5). I did not run coverage to confirm the gate's exact reading of that lane.
5. **Generated file size**: 144 items x about 260 B of TS source is about 40 KB raw before gzip (the design input's estimate was 36 KB for the JSON data); with three glosses it is closer to 55 KB. Unmeasured; the budget test of F-VOC-002 §3.8 includes it.
6. **Cover ids** are validated by `vocab-schema` (the `VocabTopicFileSchema` refinement: `coverItemId` must be an item of the same file), so a wrong id cannot ship.
7. A reserved sense group member (e.g. `vocab:bae-pear`) is a promise about ids only; no Food item named 배 exists at launch, so no learner sees a clash.
8. **`romanization` stored under that key, not `rr`**: the story research files use `rr` (F-STORY-001 imports and renames); vocabulary was authored fresh, so no alias is needed. F-CNT-002 still accepts `rr` in `content/vocab/**` if an importer ever produces it.
9. **Added by the review of 2026-10-10 (for the native reviewers)**: Spanish `café` vs `marrón` (brown), `banana` vs `plátano`, `celeste` (sky blue), `cachorro` (puppy) and `pastel de arroz` (tteok) are regional choices; 강아지 is glossed "puppy" although it is also the everyday word for a dog; 나 is the casual "I" (the polite 저 is not taught) and is the one `pronoun`; the Korean descriptions of the number words (`수 1을 우리말로 센 것`) are awkward and need a native rewrite; "said by a woman or girl" / "said by a man or boy" replaces the draft's "a girl says this" so that the glosses fit adult learners (D1).
10. **Gates before V-7 flips Sports, Science and K-Culture to `ready`** (post-merge review of V-6b, #316): (a) 공 ball and the four ball sports, and 불 fire and 빛 light, are kept apart in quizzes by `VOCAB_EXCLUDED_PAIRS` (F-VOC-004 §3.3 rule 1); if W-6 redraws the ball sports as action scenes the four ball pairs may be dropped. (b) K-Culture's 가야금 uses `card:gayageum`, a legendary card that unlocks on `stage1-complete` (the other four K-Culture cards are rare episode cards): showing its art in flashcards before it is collected spoils the reveal. The owner decides before V-7 between accepting it and a separate `word:culture-gayageum` glyph. (c) The Spanish glosses `correr` (달리기) and `saltar la cuerda` (줄넘기) are infinitives where the other sports are nouns; the external Spanish review decides.
