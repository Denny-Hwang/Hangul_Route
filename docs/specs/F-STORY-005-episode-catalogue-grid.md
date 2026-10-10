Status: ready

# F-STORY-005 — Episode catalogue: everyday lessons, heritage stories and Stage 5 books in the 7 x 5 grid

> **Start order (review 2, 2026-10-10)**: PR 5.7 (licensing and QA-process additions) can start now; PR 5.2 (grid generator and invariants) follows F-STORY-004 PR 4.1, which owns `isGridEpisode` / `gridEpisodes` / `shelfEpisodes` (and needs the `Episode.placement` field of F-STORY-001 PR 1.1b). PR 5.1 (pillar registry, `Episode` merge, generator copy) follows F-STORY-001 PR 1.1a/1.1b, which **already carry the `pillarTags` / `companionId` slots and the three catalogue schemas** (this spec no longer amends the strict `Story` schema). PR 5.3-5.5 need F-STORY-001's generated `storyEpisodes` and F-STORY-004's `story-index.ts` (PR 4.3b); PR 5.6 (Stage 5 books) additionally needs a reviewed `read` tier (F-STORY-001/002) and ships cell by cell.

**Scope**: `packages/content-schema` (`pillars.ts`, additive `pillarTags`/`companionId` on `Story` and `Episode`, licensing lint rules) · `apps/mobile` (`content/episodes.ts`, `content/books.ts`, `content/story-skeleton.ts`, `logic/journey.ts`, `logic/journey-cells.ts`, `logic/story/{home-cell,story-fit}.ts`, `screens/journey/`, `screens/episode/`, `screens/story/CellStoriesScreen.tsx`, `navigation/`) · `apps/web` (`data/` catalogue mirror, parity test) · `content/stories/README.md` (QA-process section) · `docs/workflows/story-content-qa.md`
**Owner**: solo dev
**Rollout**: Story mode phase 2, after F-STORY-001 and in parallel with F-STORY-004; Stage 5 books last (§6)
**Wireframes**: `design/wireframes/journey/grid-with-stories.md` · `story/cell-stories.md` · `episode/detail-cell-stories-row.md` — drafted in one file with the F-STORY-006 surfaces, `wireframes/story-catalogue.md`, promoted by PR 5.0

Parent / siblings: CLAUDE.md §1 (grid, 7 x 5) · blueprint 04 §2 (pillars A-E, sub-themes A1..E5, companions §2.4) · blueprint 05 (stage goals) · F-STORY-001 (story schema, generated shelf episodes, verification, errata) · F-STORY-002 (reader) · F-STORY-003 (checks) · F-STORY-004 (shelf, `isGridEpisode`, `isFreeContent`) · F-STORY-006 (cards for these episodes) · F-QUEST-002 (Stage 1 = 15 quests, `isStageComplete`) · F-PLAN-002 (shared catalogue for plans) · F-CNT-002 (romanization) · design input `design-inputs/story-mode.md` §2.2 · research set `scratchpad/heritage/*.final.json` (D14)

---

## 1. Context

The grid is the product's spine: 7 stages x 5 themes = 35 cells (CLAUDE.md §1, `apps/mobile/src/content/stages.ts:7-97`). Today **8 cells hold a real episode** and 27 hold a generated "Coming soon" placeholder. A second body of content is now written: **24 researched heritage stories** (four clusters, 112 minutes in total, 211 sourced facts and 576 source entries; saved in the repo by PR #104 as `content/stories/research/*.final.json`). The owner decision D9 says the code grid is the authority, blueprint 04's pillar sub-themes A1..E5 become **tags**, Stage 5 launches with **one episode per cell**, and finishing an episode awards its cards. This spec decides where every episode lives, when a learner is offered it, and what has to change in code so that a cell can hold more than a placeholder without breaking the lessons that already ship.

What exists (verified on `main` at `c939348`, after PRs #91-#102, read at review 2):

- **Episodes are one flat array.** Five Stage 1 lessons, two Stage 2 and one Stage 4 "taste" lesson are hand-written (`content/episodes.ts:10-125`); the rest come from a generator: `makePreviewEpisode` (`:127-141`) per cell, titles in `upperStageTitles` (`:143-186`, Stage 5 = "Short Stories / Family Stories / Festival Tales / Tiger Folktales / Craft Stories", `:165-171`), minus a **hard-coded** exclusion set `shippedBeyondStage1` (`:188-192`) — add a hand-written episode in a new cell and forget the set, and the cell gets two episodes with the same id. `episodesAll` concatenates the four arrays (`:201-206`).
- **A cell can show one episode.** `episodeFor(stage, theme)` returns the first match (`:212-214`); `GridCell` calls it (`screens/journey/JourneyScreen.tsx:148-150`), is disabled for previews (`:157-158`), draws a lock for them (`:173-174`) and labels itself "`<theme> episode for stage1`" (`:160`).
- **Stage availability counts episodes, not cells** (`logic/journey.ts:11-16`); completion is per episode, all quests (`:29-38`).
- **The schema forbids the placeholders**: `questIds: z.array(z.string()).min(1)` (`packages/content-schema/src/schemas/episode.ts:18`) rejects the 27 previews (F-STORY-001 relaxes it for `status: 'preview'`); the episode has no format, placement, volume, recommended stage or tags (`:10-22`).
- **Stage 5 is paid and empty**: `FREE_STAGES = {stage1}` (`logic/entitlement.ts:16`); every Stage 5 cell is a placeholder (`episodes.ts:165-171`).
- **Companions**: blueprint 04 §2.4 (`docs/blueprints/04-main-content-outline.md:214-226`) defines five pillar companions (훈이, 풍이, 예이, 돌이, 장이) next to Hoya; the code has Hoya only (`packages/design-system/src/components/Hoya/types.ts:1`).

F-STORY-001 (written in the same review round) already decides the story side: `recommendedStage` is a number 1-7 on the story and "advisory only" (`F-STORY-001 §3.2.1`), shelf episodes and quests are **generated** from the story files into `stories.generated.ts` as `storyEpisodes`/`storyQuests` and appended to `episodesAll`/`questsAll` (`§3.9`), `Episode` gains `format`, `placement`, `volume`, `storyIds` and a relaxed `questIds` (`§3.9`), book episodes stay hand-written, and verification, versions, errata and link checks live in `§3.6-3.7`. This spec builds on those names and adds only what they leave open: where each episode sits in the grid, when it is offered, tags, companions, the QA/licensing rules and the code for cell capacity.

What the research set contains (re-counted at review 2 from `records-joseon.final.json`, `hangul-printing.final.json`, `science-art-life.final.json` and `seasons-tales.final.json`, all four with `verification.passes = 3`; the placement table of §3.3 was machine-checked against them: all 24 ids appear exactly once, and slug, title, theme, recommended stage, minutes and cluster file match the data):

| recommended stage | letters | life | rites | nature | crafts | total |
|---|---|---|---|---|---|---|
| 1 | 5 | 1 | 2 | 1 | 1 | 10 |
| 2 | 2 | 1 | 1 | 1 | 3 | 8 |
| 3 | 2 | 1 | – | – | – | 3 |
| 4 | 1 | – | – | – | – | 1 |
| 5 | – | – | 1 | – | – | 1 |
| 6 | 1 | – | – | – | – | 1 |
| 7 | – | – | – | – | – | 0 |
| **total** | **11** | **3** | **4** | **2** | **4** | **24** |

Two facts follow. (1) Eleven stories are "Letters" and ten of the 24 are Stage 1: forcing them into a one-episode-per-cell grid would make Stage 1 Letters (which already holds the lesson "Meet the Letters") hold six episodes. (2) A story's `recommended_stage` is the **language demand** of its Korean words, not a skill the learner must prove first: the narration is simple English with a few Korean words per scene (`heritage/_BRIEF.md`).

## 2. User story

> As a learner at any level I want to see the heritage stories on the same map as my lessons — the story about Hangul Day sitting near the Letters, the Seollal story near Holidays — and open any of them whenever I like, without finishing a lesson first.

Companion stories:

- As a **teacher or caregiver** I want each story tagged by stage and theme so I can pick one for this week's plan, and I want to know it was fact-checked.
- As a **content owner** I want one written rule for where an episode goes, so adding the 25th story or the second Stage 5 volume is a data change, not a code change.
- As a **maintainer** I want the grid to refuse (in CI) a cell with two episodes at launch.

## 3. Acceptance criteria

### 3.1 The model: one grid, three kinds of episode

Terms. **Lesson**: today's episode (`format: 'lesson'`, 1-3 quests that teach letters or words). **Story episode**: `format: 'story'` (F-STORY-001), one or more story quests. **Shelf story**: a story episode with `placement: 'shelf'` — exactly one story, outside the grid's capacity (F-STORY-004 §3.1). **Book**: a story episode with `placement: 'grid'` — it occupies a grid cell and holds up to three stories at the `read` level. **Home cell** of a shelf story: the pair (`stage<story.recommendedStage>`, `story.theme`) — metadata, not capacity.

Rules (each is asserted by a test in §5):

1. **Capacity (D9).** At launch every cell (stage, theme) holds **at most one grid episode** (`MAX_EPISODES_PER_CELL = 1`, exported from `content/episodes.ts`). Shelf episodes do not count. Raising the constant to 2 is the "volumes later" switch (§3.5, PR 5.8).
2. **Lessons keep their cells.** The eight shipped lessons keep their ids, quest ids, order and status; nothing is appended to a shipped episode (appending would un-complete it for existing learners, `logic/journey.ts:29-38`).
3. **All 24 heritage stories are shelf stories at launch.** Each is a one-quest shelf episode `episode:shelf-<slug>` **generated by F-STORY-001's `build-stories.mjs`** (conventions of F-STORY-004 §3.1: `format: 'story'`, `placement: 'shelf'`, `stage: 'stage1'`, `order: 100 + shelf.order`, one quest); the story's own `recommendedStage` (a number, F-STORY-001 §3.2.1) gives its home cell. The Library is where they are browsed (F-STORY-004).
4. **Home cell.** A shelf story is *shown on the map* at its home cell (§3.6): a small stories marker on cells that have a lesson, and a tappable "stories-only" cell where there is no lesson. Showing a story on the map never gates it and never changes the cell's own episode.
5. **Stage 5 books (D9).** When Stage 5 launches, each of its five cells holds exactly one book (`episode:stage5-<theme>`, the id the placeholder already has, so no plan or deep link breaks). A book's quests play stories at the `read` level; a cell stays a placeholder until its book has at least **2** reviewed quests, so Stage 5 opens cell by cell. Overflow stories wait for volume 2 (§3.5).
6. **Story vs book quest.** One story may have a Listen shelf quest *and* a Read book quest. They are different quests with different ids (`quest:story-<slug>-listen`, `quest:story-<slug>-read`); the story card is the same card (F-STORY-006), so playing both never awards twice.
7. **Tags, not axes (D9).** Blueprint 04's sub-themes A1..E5 are stored as `pillarTags` on episodes (§3.8); they never add rows, columns or cells.
8. **No order dependency.** A learner never needs a lesson, a star or a stage to open a shelf story (§3.4). The Journey cursor (Today card ②, `logic/homework/mission-builder.ts:100-119`) walks **grid** episodes only (F-STORY-004 §3.10).

### 3.2 Data

**Fields owned by F-STORY-001** (used here unchanged): on `Episode` — `format: 'lesson' | 'story'` (default `'lesson'`), `placement: 'grid' | 'shelf'` (default `'grid'`), `volume` (default 1), `storyIds?`, and `questIds` allowed empty only for `status: 'preview'` (`F-STORY-001 §3.9`); on `Story` — `recommendedStage` (integer 1-7, advisory), `theme`, `minutes`, `kind`, `origin`, `shelf`, `verification`, `review`, `rewardCardIds` (`§3.2.1`).

**Fields defined by this spec** — the text of three small schemas. **F-STORY-001 PR 1.1a creates `packages/content-schema/src/pillars.ts` with exactly this text and PR 1.1b embeds the fields in the strict `StoryObjectSchema`** (F-STORY-001 §3.2.1: `pillarTags`, `companionId`), so the strict schema is complete from day one and this spec never amends it. This spec's PR 5.1 adds the registry `PILLAR_TAGS`, the `EpisodeSchema` merge below and the lint. Additive change to the episode schema (`packages/content-schema/src/schemas/episode.ts:10-22`, split into `EpisodeObjectSchema` + `EpisodeSchema` by F-STORY-001 PR 1.1b):

```ts
// packages/content-schema/src/pillars.ts  (shared by lint, mobile and web)
export const PillarTagSchema = z.string().regex(/^[A-E][1-9]$/);               // 'A1' .. 'E9'; must exist in PILLAR_TAGS (lint)
export const CompanionIdSchema = z.enum(['hoya']);                               // 'hoya' only until section 3.7 unlocks more
export const CatalogueFieldsSchema = z.object({
  pillarTags: z.array(PillarTagSchema).max(3).default([]),                        // first = primary; no duplicates
  companionId: CompanionIdSchema.default('hoya'),
});
// EpisodeObjectSchema.merge(CatalogueFieldsSchema)   (EpisodeSchema = EpisodeObjectSchema.superRefine(...) is a ZodEffects and cannot be merged; F-STORY-001 §3.9)
// Story embeds the two fields directly, F-STORY-001 §3.2.1
```

The generator copies `pillarTags` and `companionId` from a story to its shelf episode, so the plan catalogue (F-PLAN-002) can group episodes without loading stories. Lesson episodes carry them in `episodes.ts`; tagging the eight shipped lessons is an authoring task in PR 5.2 (default `[]`; a proposed first-pass mapping for Stage 1 is Letters A1, Life B5, Rites B5, Nature D2, Crafts E1, to be confirmed by the owner).

Rules, each with a test (lint in `story-lint.ts` for stories, `superRefine` for episodes): every tag exists in `PILLAR_TAGS`; a grid episode has `order === themes[theme].order` and `placement` absent or `'grid'`; a story episode with `placement: 'grid'` has `stage === 'stage5'` at launch and 2-3 `questIds` unless `status === 'preview'`; `volume >= 2` ⇒ `id` ends `-v<volume>`. Shelf-episode conventions (one quest, `stage1`, `order >= 100`) stay F-STORY-004's integrity tests.

**Pillar registry** — `packages/content-schema/src/pillars.ts` (so the importer, lint, app and console read one list; no mirror to drift). One entry per blueprint 04 §2.3 sub-theme (23 entries, `docs/blueprints/04-main-content-outline.md:175-211`) plus one proposed sub-theme (§3.8):

```ts
export interface PillarTag { id: string; pillar: 'A'|'B'|'C'|'D'|'E'; ko: string; en: string }   // romanization is generated (F-CNT-002), never typed
export const PILLAR_HOME_THEME = { A: 'letters', B: 'life', C: 'rites', D: 'nature', E: 'crafts' } as const;
```

`PILLAR_HOME_THEME` is only a suggestion for authors: an episode's grid theme is its own field (a Dano story is tag B5 but theme `rites`).

**Home cell** — `apps/mobile/src/logic/story/home-cell.ts` (pure): `homeCellOf(story): { stage: StageKey; theme: ThemeKey }` = `{ stage: 'stage' + story.recommendedStage, theme: story.theme }` (typed as `StageKey`); `entriesForCell(index, stage, theme)` (added to F-STORY-004's `story-index.ts`) filters index entries by it. Nothing is stored.

**Books** — Stage 5 book episodes are hand-written in `apps/mobile/src/content/books.ts` (F-STORY-001 §3.9: "grid book episodes remain hand-written"); each lists `storyIds`. Their quests (`quest:story-<slug>-read`, the five-step skeleton of F-STORY-003 §3.1 with `story-read` ref level `read`) are produced by `storyQuestSkeleton(story, 'read')` in `apps/mobile/src/content/story-skeleton.ts`, the TypeScript twin of the quest constants in `build-stories.mjs`; a parity test asserts that for the same story and level `listen` the twin equals the generated quest, so the two cannot drift. Nothing in `books.ts` exists until a story has a reviewed `read` tier.

### 3.3 Placement table (the 24 stories)

Columns: shelf id = `episode:shelf-<slug>`; **home cell** = `<recommendedStage>-<theme>`; **cell holds** = what else occupies that cell on the map (L = a shipped lesson, – = no lesson, the cell becomes a stories-only cell); **cat/order** = Library category and position (F-STORY-004; folk tales and festival-day stories are `story-time`, the rest `culture`); **S** = intended free sampler (D5, F-STORY-004 §3.9); pillar tags per §3.8; minutes from the research files. Quest id = `quest:story-<slug>-listen`; story id = `story:<slug>`.

| # | slug | title (en) | home cell | theme | rec. stage | min | cell holds | cat/order | S | tags | cluster file |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | sejong-new-letters | King Sejong's New Letters | stage1-letters | letters | 1 | 4 | L | culture 1 | S | A1 | hangul-printing |
| 2 | shapes-of-hangeul | The Secret in the Shapes | stage1-letters | letters | 1 | 5 | L | culture 2 |  | A1 | hangul-printing |
| 3 | hangeul-day | Happy Hangeul Day! | stage1-letters | letters | 1 | 4 | L | culture 3 | S | A1 | hangul-printing |
| 4 | tripitaka-koreana | Eighty Thousand Woodblocks | stage1-letters | letters | 1 | 5 | L | culture 4 |  | A2 | hangul-printing |
| 5 | sillok-royal-historians | Hoya Meets the Royal Historians | stage1-letters | letters | 1 | 4 | L | culture 5 |  | A3 | records-joseon |
| 6 | kim-hongdo-genre-paintings | Kim Hong-do's Pictures of Everyday Life | stage1-life | life | 1 | 5 | L | culture 7 |  | B1 | science-art-life |
| 7 | seollal-new-year | Hoya's Seollal Morning | stage1-rites | rites | 1 | 4 | L | story-time 1 | S | B5 | seasons-tales |
| 8 | chuseok-ganggangsullae | Chuseok: Songpyeon Under the Full Moon | stage1-rites | rites | 1 | 5 | L | story-time 2 | S | B5, C4 | seasons-tales |
| 9 | sun-and-moon | The Sun and the Moon (A Traditional Tale) | stage1-nature | nature | 1 | 5 | L | story-time 3 | S | D5*, D2 | seasons-tales |
| 10 | cheugugi-rain-gauge | The Bowl That Measured the Rain | stage1-crafts | crafts | 1 | 4 | L | culture 6 | S | E3 | science-art-life |
| 11 | sillok-mountain-archives | The Annals Hide in the Mountains | stage2-letters | letters | 2 | 5 | – | culture 8 |  | A3 | records-joseon |
| 12 | jikji-metal-type | Jikji: Letters Made of Metal | stage2-letters | letters | 2 | 5 | – | culture 9 |  | A5 | hangul-printing |
| 13 | gimjang-arirang | Gimjang Day: Sharing Kimchi, Singing Arirang | stage2-life | life | 2 | 5 | L | story-time 5 |  | B5, C4 | seasons-tales |
| 14 | dano-ssireum | Dano Day: Swings, Masks and Ssireum | stage2-rites | rites | 2 | 5 | – | story-time 4 |  | B5, C4 | seasons-tales |
| 15 | angbuilgu-sundial | The Sky-Facing Pot That Told the Time | stage2-nature | nature | 2 | 4 | L | culture 11 |  | E3, E5 | science-art-life |
| 16 | janggyeong-panjeon | Guarded by the Wind | stage2-crafts | crafts | 2 | 5 | – | culture 10 |  | A2, D3 | hangul-printing |
| 17 | jagyeongnu-water-clock | Jang Yeong-sil and the Clock That Rang by Itself | stage2-crafts | crafts | 2 | 5 | – | culture 12 |  | E3 | science-art-life |
| 18 | pansori-tales | Pansori Tales: Heungbu's Swallow and the Clever Rabbit (Traditional Tales) | stage2-crafts | crafts | 2 | 6 | – | story-time 6 |  | C3, D5* | seasons-tales |
| 19 | seungjeongwon-ilgi-every-day | The Royal Secretaries' Everyday Diary | stage3-letters | letters | 3 | 5 | – | culture 13 |  | A4 | records-joseon |
| 20 | nanjung-ilgi | Admiral Yi's Diary | stage3-letters | letters | 3 | 4 | – | culture 14 |  | A4 | science-art-life |
| 21 | donguibogam | Heo Jun's Treasured Mirror of Medicine | stage3-life | life | 3 | 5 | – | culture 15 |  | E4 | science-art-life |
| 22 | ilseongnok-daily-reflection | King Jeongjo's Diary of Daily Reflection | stage4-letters | letters | 4 | 4 | – | culture 16 |  | A4 | records-joseon |
| 23 | uigwe-royal-birthday | A Picture Record of a Royal Birthday | stage5-rites | rites | 5 | 5 | – (book later) | culture 17 |  | C2, A3 | records-joseon |
| 24 | joseon-records-today | Old Records, New Discoveries | stage6-letters | letters | 6 | 4 | – | culture 18 |  | A3 | records-joseon |

Totals: 112 minutes; 12 stories in cells that already hold a lesson (rows 1-10, 13, 15), 12 in cells that would otherwise be placeholders; story-time 6, culture 18; sampler 6 (the F-STORY-004 §3.9 list, re-verified: all six are `recommended_stage` 1 and 4-5 minutes). Orders are data on the story (`shelf.order`); changing them is a content change.

**Derived matrix** (L = lesson, number = stories whose home cell this is; "S-only" = a stories-only cell):

| | letters | life | rites | nature | crafts |
|---|---|---|---|---|---|
| Stage 1 | L + 5 | L + 1 | L + 2 | L + 1 | L + 1 |
| Stage 2 | S-only 2 | L + 1 | S-only 1 | L + 1 | S-only 3 |
| Stage 3 | S-only 2 | S-only 1 | placeholder | placeholder | placeholder |
| Stage 4 | S-only 1 | placeholder | L + 0 | placeholder | placeholder |
| Stage 5 | book later | book later | S-only 1 → book later | book later | book later |
| Stage 6 | S-only 1 | placeholder | placeholder | placeholder | placeholder |
| Stage 7 | placeholder | placeholder | placeholder | placeholder | placeholder |

15 of 35 cells show stories; the other 20 stay "Coming soon". The generator test asserts these counts from the data, so the table cannot drift.

**Stage 5 book plan** (a plan, not data that exists yet; membership is an editorial decision recorded in `content/books.ts` when each book ships). A book plays its stories at the `read` level and needs a reviewed `read` tier per story (new Korean sentences = new native review). Candidates, chosen by theme and so that the first books are the best-loved festival and Hangul stories:

| Cell (id kept) | Book title (replaces the placeholder title) | Planned quests (stories) | Volume 2 candidates (shelf-only until then) |
|---|---|---|---|
| `episode:stage5-rites` | Festival Tales (ships first) | seollal-new-year, dano-ssireum, chuseok-ganggangsullae | uigwe-royal-birthday |
| `episode:stage5-letters` | Stories of Letters | sejong-new-letters, shapes-of-hangeul, hangeul-day | tripitaka-koreana, sillok-royal-historians, sillok-mountain-archives, jikji-metal-type, janggyeong-panjeon, seungjeongwon-ilgi-every-day, nanjung-ilgi, ilseongnok-daily-reflection, joseon-records-today |
| `episode:stage5-life` | Family Stories | gimjang-arirang, kim-hongdo-genre-paintings, donguibogam | – |
| `episode:stage5-crafts` | Craft Stories | cheugugi-rain-gauge, jagyeongnu-water-clock, pansori-tales | – |
| `episode:stage5-nature` | Tiger Folktales | sun-and-moon, angbuilgu-sundial (2 at launch; a third nature story is not in the researched set — the design input's "호랑이와 곶감" would need the same pipeline) | – |

Reward cards of book quests are the Stage 5 scene cards of F-CARD-S5-001, not the shelf story cards (F-STORY-006 §3.9); that spec is a draft and out of scope here.

### 3.4 When a story is offered

New pure module `logic/story/story-fit.ts` (100 % covered):

```ts
export function stageNumber(stage: StageKey): number;                       // 'stage3' -> 3
export function reachedStage(snapshot: ProgressSnapshot, grid: readonly Episode[], placement?: number): number;
   // 1..7: highest stage with >= 1 completed quest in a GRID episode; at least 1; `placement` (F-PLC-001 seed) raises it, never lowers it
export type StoryFit = 'ready' | 'stretch';
export function storyFit(recommendedStage: number, reached: number): StoryFit; // 'ready' iff recommendedStage <= reached + 1
```

Rules:

1. **Not gated by progress.** From the first launch (after Welcome) every reviewed story is offered. No quest, episode, stage, star or placement result is a prerequisite. `StoryFit` never hides or locks a story and is never shown to a learner as a label ("hard", "too advanced", "stretch" do not exist in copy).
2. **Fit only orders.** `pickedForYou` / `next` (F-STORY-004 §3.7) choose, among unfinished shelf entries, first those with `fit === 'ready'` in shelf order, then the rest in shelf order. A new learner (`reachedStage` = stage1) therefore sees the ten Stage 1 stories and the eight Stage 2 stories before the six that recommend Stage 3+ — but can still open any of them from the Library or the map.
3. **Reading level (D1).** The learner levels (Pictures first / Some reading / Reads easily, stored as the opaque `ageGroup` ids) never filter the shelf. They set reader defaults (read-aloud on for *Pictures first*) in F-STORY-002/F-LEARN-001, not catalogue membership.
4. **Review gate (D14).** A story is offered in a production build only when it has a `shelf` block (which F-STORY-001's lint `story-unverified` allows only with `verification.passes >= MIN_VERIFICATION_PASSES`, **= 3**, the real author / two-checker / reviser / third-pass process), `review.language === 'native-reviewed'` and `review.culture === 'culture-reviewed'` — both signed with `reviewedBy` and `reviewedAt` (`review-unsigned`) — and `state: 'ready'`. All four research clusters carry `passes: 3`, so none of the 24 is held back by the gate. Dev and design-preview builds may widen the gate with `showUnreviewedStories` (F-STORY-004 §3.1).
5. **Sampler (D5).** The intended free set is Stage 1 lessons, the four vocab topics and the six stories flagged `shelf.sampler`, read only through `isFreeContent` (F-STORY-004 §3.9). It is **flagged off**: with `contentGatingEnabled = false` every story is offered to everyone. Switching it on never depends on a story's home stage: `isContentLocked('story', id)` decides; `isStageEntitled(<recommended stage>)` is never consulted for shelf stories.
6. **Books add no gate (D5).** Book quests live in a grid cell and behave like every grid cell today: `JourneyScreen` shows the stage-header pill from `isStageEntitled` (`JourneyScreen.tsx:65, 98-102`: "Premium" for stages other than Stage 1) but a cell opens regardless; this spec adds **no enforcement and no new pill** for books or shelf stories, and any future gate goes through `isFreeContent` (F-STORY-004 §3.9). Because a book's stories are also on the shelf, the free sampler is always reachable.
7. **Sampler fallback.** All six sampler stories sit in clusters with three recorded passes (three of them in `seasons-tales`, now final). If any of them is held (F-STORY-001 §3.7) or its native/culture sign-off is late, the sampler is topped up from the same pool without a code change: `shapes-of-hangeul`, `tripitaka-koreana`, `sillok-royal-historians` (all `recommendedStage` 1, 4-5 minutes). The sampler is `shelf.sampler` data, so this is a content change.

### 3.5 Grid capacity: the exact code changes

`apps/mobile/src/content/episodes.ts`:

1. Delete the hard-coded `shippedBeyondStage1` set (`:188-192`). Previews are generated for every cell **not claimed** by a hand-written grid episode:
   ```ts
   export const MAX_EPISODES_PER_CELL = 1;
   const cellKey = (e: Pick<Episode, 'stage' | 'theme'>): string => `${e.stage}:${e.theme}`;
   const handWritten = [...stage1Episodes, ...stage2Episodes, ...stage4Episodes, ...bookEpisodes];   // grid episodes only
   const claimed = new Set(handWritten.map(cellKey));
   const previewEpisodes = stages.filter((s) => s.key !== 'stage1').flatMap((s) =>
     themes.map((t, i) => makePreviewEpisode(s.key, t.key, i + 1, upperStageTitles[s.key]?.[t.key] ?? 'Coming soon'))
   ).filter((e) => !claimed.has(cellKey(e)));
   export const episodesAll: Episode[] = [...handWritten, ...storyEpisodes, ...previewEpisodes];   // storyEpisodes: generated shelf episodes (F-STORY-001 §3.9)
   ```
   `makePreviewEpisode` keeps its signature and ids (`episode:<stage>-<theme>`).
2. Add `gridEpisodes(list)` / `shelfEpisodes(list)` / `isGridEpisode(e)` exactly as F-STORY-004 §3.10 specifies (**owner: F-STORY-004 PR 4.1**; this spec's PR 5.2 depends on it and adds only `episodesFor`) and
   ```ts
   export function episodesFor(stage: string, theme: string): Episode[]   // grid episodes of the cell, sorted by (volume ?? 1, order)
   export function episodeFor(stage: string, theme: string): Episode | undefined { return episodesFor(stage, theme)[0]; }
   ```
   `episodeFor`'s behaviour is unchanged for every cell that has one episode (all 35 today).
3. `bookEpisodes` come from `content/books.ts` (§3.2); the list is empty in PR 5.2, so the generated file is byte-identical to today's grid until a book ships.

`apps/mobile/src/logic/journey.ts`:

- `stageAvailability(stage, episodes)` counts **cells**, not episodes: `cells = new Set(grid.filter(stage).map(cellKey))`, a cell is shipped when any of its episodes is shipped (`:11-16`). With one episode per cell the result is identical (the existing test "matches the real bundle" at `logic/__tests__/journey.test.ts` must still pass unchanged).
- New `isCellComplete(episodes, quests)` = every episode of the cell is complete (`isEpisodeComplete`, `:29-38`). Used by the cell look; equals today's value while a cell has one episode.

`apps/mobile/src/logic/journey-cells.ts` (new, pure, 100 %):

```ts
export type CellKind = 'lesson' | 'book' | 'stories-only' | 'placeholder';
export interface CellModel {
  stage: StageKey; theme: ThemeKey; kind: CellKind;
  episodeId?: string;            // the lesson or book to open; absent for stories-only / placeholder
  completed: boolean;            // grid episode complete (never for stories-only)
  storyCount: number;            // playable shelf stories whose home cell is this cell (review gate applied)
  storiesFinished: number;       // for the a11y label only; never shown as a fraction
}
export function cellModel(i: { stage; theme; episodes: readonly Episode[]; storyEntries: readonly StoryIndexEntry[]; quests: readonly QuestProgress[] }): CellModel;
export function cellLabel(m: CellModel, stageTitle: string, themeTitle: string): string;   // "Stage 2 Words, Food and Daily Life: lesson, 1 story" etc.
```

`kind`: `lesson` = a shipped/ready grid episode with `format !== 'story'`; `book` = shipped story book; `stories-only` = no shipped grid episode and `storyCount >= 1`; else `placeholder`.

`apps/mobile/src/screens/journey/JourneyScreen.tsx`:

- Line 63: `stageAvailability(stage.key, gridEpisodes(episodesAll))`.
- `GridCell` (`:148-181`) renders from `cellModel` (props: `model`, `stageTitle`, `themeTitle`, `onOpenEpisode(id)`, `onOpenStories(stage, theme)`):
  - `lesson`/`book`: as today (stage-tinted border, theme initial, success tint when complete) **plus** a small count mark when `storyCount > 0` (§3.6).
  - `stories-only`: border `colors.border.subtle`, background `colors.surface.paper`, `Icon name="library"` (replaces the lock) and the count mark; `onPress` → `onOpenStories`. **Not disabled**, never routed through `PinEntry`.
  - `placeholder`: unchanged (lock, disabled).
  - `accessibilityLabel` = `cellLabel(...)` (fixes "`letters episode for stage1`", `:160`: it names the stage title and the state, including "coming soon" and "N stories").
- Stage header: unchanged. Add one muted caption under a row that has any stories-only cell (next to the existing `taste` caption, `:117-121`): "Heritage stories are open in the cells with books." (final copy in `JOURNEY_COPY`; the `library` glyph is three books, `packages/design-system/src/components/Icon/glyphs.ts:70-74`).
- Explainer (`:130`): "Each cell is one episode. Cells with books also have heritage stories." (still no fractions).

### 3.6 Map surfaces for stories

**Count mark.** A 20 dp circle at the cell's top-right corner, `colors.surface.sunken` fill, `colors.border.subtle` ring, the number in `typography` caption size (`text.primary`). Not a separate button (the cell is ~54 dp wide at 320 dp, audit UX-25), so it is `importantForAccessibility="no"` and its content is in the cell's label. A cell with 6+ stories shows "5+".

**Cell page** — new route `CellStories: { stage: StageKey; theme: ThemeKey }` in `navigation/types.ts` (`RootStackParamList`, after `EpisodeDetail`, `:6`) and `navigation/root.tsx` (next to `:49`); component `screens/story/CellStoriesScreen.tsx`:

- Header: back, "`<Stage title>` · `<Theme title>`", then one line "Heritage stories for this cell".
- If the cell has a lesson or book: a first row "`<episode title>` — the lesson for this cell" (secondary button → `EpisodeDetail`). Stories are listed **below** it so the lesson is never hidden.
- Then `StoryTile`s of F-STORY-004 §3.4 (same component, same states New / Keep reading / Finished, same ≥ 64 dp, and the "Traditional tale" pill for tale kinds, F-STORY-001 §3.5 rule T4), in `shelf` order, for `entriesForCell(index, stage, theme)`.
- Empty (no playable story): cannot be reached from the map (placeholders are disabled); if reached by a stale deep link, one card "Nothing here yet" and a Back button. Error (a story fails to resolve): the tile degrades like F-STORY-004 §3.4; the rest render.
- No timers, no ranking, no counts of unfinished stories.

**Lesson page row.** `EpisodeDetailScreen` (after the quest list and before "Cards in this episode", `screens/episode/EpisodeDetailScreen.tsx:~150`) gains, when `storyCount >= 1` for the episode's cell: a row "Heritage stories for this cell" with the count and a chevron → `CellStories`. Hidden when 0. The preview card (`:96-101`) is unchanged.

**Library link-back.** A story's `StoryEpisodeDetail` header (F-STORY-004 §3.6) shows its home cell as a plain pill ("Stage 2 · Letters") that opens `CellStories` — informational, never a lock.

### 3.7 Companions

Decision: **Hoya is the only companion at launch.** Every episode has `companionId: 'hoya'`; the field exists so the later characters need no schema migration. `CompanionIdSchema` is `z.enum(['hoya'])` and CI fails any other value until a companion's art, name checks and accessibility label ship.

Future companions (blueprint 04 §2.4, `:214-226`), each appearing only inside its own pillar; first intended use in the researched set:

| Pillar (grid theme) | Companion | Blueprint motif | Romanization (RR, pronunciation-based, D13; confirm with F-CNT-002's checker) | First intended stories |
|---|---|---|---|---|
| A (letters) | 훈이 | Sejong's cat, ink-black, carries a brush | huni | sejong-new-letters, shapes-of-hangeul, sillok-royal-historians |
| B (life) | 풍이 | Joseon market child, lively | pungi | kim-hongdo-genre-paintings, gimjang-arirang |
| C (rites) | 예이 | young dancer in hanbok, calm | yei | uigwe-royal-birthday, pansori-tales |
| D (nature) | 돌이 | the mountain spirit's grandchild | dori | sun-and-moon, angbuilgu-sundial |
| E (crafts) | 장이 | artisan's apprentice, tool in hand | jangi | cheugugi-rain-gauge, jagyeongnu-water-clock |

Unlock conditions (all required): hand-authored SVG character in `packages/design-system` using tokens only (D7, same pipeline as `Hoya`), a name card with Korean + romanization + gloss, a screen-reader label, a visual-regression entry (F-VR-001), and an owner decision that the character may carry story text. Until then the research stories keep Hoya as narrator as written.

### 3.8 Pillar tags (blueprint 04 A1..E5)

`PILLAR_TAGS` holds blueprint 04's 23 sub-themes (ids and Korean titles from `docs/blueprints/04-main-content-outline.md:175-211`): A1 훈민정음, A2 팔만대장경, A3 조선왕조실록, A4 승정원일기, A5 직지심체요절 · B1 김홍도의 시장, B2 신윤복의 도시, B3 농촌의 사계절, B4 한복과 옷차림, B5 명절과 세시풍속 · C1 종묘제례, C2 궁궐의 하루, C3 판소리 마당, C4 무형문화재 · D1 한옥마을, D2 산과 강, D3 사찰과 서원, D4 정원과 정자 · E1 한지와 붓, E2 도자기 만들기, E3 측우기와 자격루, E4 동의보감, E5 천문과 우주 — each with `en` and a generated romanization. **Proposed addition (owner to confirm): `D5 옛이야기 / Traditional tales`**: the blueprint has no home for folk tales and the blueprint marks its lists as expandable ("확장"); the two folk-tale stories otherwise need a wrong tag. Tags are metadata: shown in the console catalogue and in analytics, **not** to learners.

Uses: (1) the plan builder / catalogue groups by tag (F-PLAN-002); (2) the Library Culture section may filter by pillar later (not in this spec); (3) coverage reporting — a CI report prints stories per tag and fails when a pillar has none (balance, blueprint 04 §2.2); (4) every episode of a pillar can be traced to its blueprint line.

### 3.9 Authoring and QA process for facts (what was actually done, and how it maps onto F-STORY-001)

F-STORY-001 enforces the structure (every non-framing scene cites facts, sources are https and authoritative, numbers echo or are marked as approximations, versions and errata, link checks: `§3.3`, `§3.7`, `§3.8`). What follows is the **human process** that produced the research set and that every future story must go through before it can hold a `shelf` block. It is written here because it is a property of the catalogue (what is allowed on the shelf), and so that the owner can see what "verified" means.

| Pass | Who | Output (per cluster, in `scratchpad/heritage/`) | What happened in this set |
|---|---|---|---|
| 0 Author | research agent | `<cluster>.draft.json` | 6 episodes per cluster; every narration sentence mapped to a fact id; each fact has >= 1 authoritative source (>= 2 for dates and numbers); sources limited to 국가유산청 / 국가유산포털, 국사편찬위원회 (Sillok DB, 승정원일기 DB, 우리역사넷), 한국고전번역원, UNESCO registers, 한국민족문화대백과사전, 국립중앙박물관, 국립한글박물관, 국립국어원, 국립민속박물관 / 한국민속대백과사전, 규장각, 청주고인쇄박물관; access date 2026-10-09; no folk-etymology; folk tales labelled as traditional tales; violence and modern tragedy omitted |
| 1 Check A and Check B | two independent checkers who do not see each other's output | `<cluster>.checkA.json`, `<cluster>.checkB.json` — each `{ issues[{episode, where, problem, correction, evidence, severity}], verified_count, unverifiable[] }` | together **118 issues** across the four clusters (A 50, B 68) and 4-6 "unverifiable" items per file |
| 2 Reviser | author-side | `<cluster>.revised.json` + `<cluster>.changes.md` (every issue marked FIXED / SOFTENED / REMOVED / REJECTED with reason / EXTENDED) | e.g. a claim narrowed to what the source says; "one special job" rewritten to what the sources say; a tiger "demands food at every pass" restated as the source describes it |
| 3 Final check (third pass) | a third independent verifier | `<cluster>.final.json` with top-level `verification {passes: 3, checked_at, notes}` + `<cluster>.signoff.md` (corrections, remaining uncertainty, per-episode YES) | every cited URL re-opened (UNESCO pages via archive copies when the site refuses connections), quotes machine-matched, a source chosen independently per episode; examples of what it caught: a poswae interval mistranslated (every third year, not every other), "Gregorian" removed because no cited source says it, a birth year dropped because sources conflict (1539 vs 1546), a vocab word that appeared in no scene removed |
| 4 Import | tool | `scripts/import-heritage.mjs` → `content/stories/<slug>.json`, `state: 'draft'`, cluster `verification` copied with `scope: 'cluster'` (F-STORY-001 §3.10) | nothing is retyped; gaps become lint findings |
| 5 Native language review | a native Korean speaker with editorial authority (owner task; **not done yet**) | `review.language: 'native-reviewed'` + `reviewedBy` initials + `reviewedAt` | Korean strings read for 맞춤법 and naturalness; Revised Romanization is machine-checked by F-CNT-002 |
| 6 Culture review | a reviewer for heritage accuracy and sensitivity (owner task; **not done yet**) | `review.culture: 'culture-reviewed'` + initials + date; `review.advisory` confirmed | folk-tale framing, tone, omissions; advisories for grown-ups |
| 7 Publish | CI + owner | `state: 'ready'`, `shelf` block, green lint | the gate of §3.4 rule 4 |

Evidence of what passes 1-3 achieved, so nobody assumes a drafted file is already correct: the two checkers together logged **118 issue entries** across the four clusters (checker A 50, checker B 68, partly overlapping; 4-6 "unverifiable" items per file), and the third pass still corrected problems that passes 1-2 had left (the poswae interval, the word "Gregorian", a "dried herbs" detail, a birth year that sources contradict). The seasons cluster's final record (61 facts, 161 source entries re-fetched, 70 unique URLs; 164 entries after its three added sources) corrected four items, including both UNESCO steps for pansori and a citation for "greedy" in the Heungbu tale.

**Rules this spec adds on top of F-STORY-001 §3.8** (three new lint rules in `packages/content-schema/src/story-lint.ts`, PR 5.7; each with passing and failing fixtures):

1. `narration-copies-source` (error): no run of 8 or more consecutive English words in `narrationEn` or `claimEn` also appears in any `quoteOrLocator` of the story — facts are restated, not pasted (copyright and plain-language reasons).
2. `narration-national-treasure-number` (error): narration never contains a designation number ("National Treasure No. 70"); it says "National Treasure". (Korea dropped numbers from official names in 2021; research rule from `heritage/_BRIEF.md`.) Numbers in source titles stay in the reference zone.
3. `story-shelf-needs-reviewers` (error): a `shelf` block requires both `review.*` sign-offs; mirrors `review-unsigned` for the production path.

**Errata policy** is F-STORY-001 §3.7 (severity S1-S3, one content PR, `contentVer`/`fact.rev` bumps, append-only `errata[]`, S1 ships out of band by setting `state: 'draft'`, web PWA within a day, native with the next release). This spec adds three consequences for the catalogue: (1) a held story's shelf episode disappears from the bundle at the next build — its **map marker count drops** and an empty `CellStories` is unreachable; (2) **nothing a learner earned is removed** (D3): cards, stars and found notes stay, and the story's card (F-STORY-006) stays owned and visible; (3) a corrected fact regenerates the card's back-face text from the same `facts[]`, so card and story cannot disagree.

### 3.10 Content licensing and attribution

1. **We draw our own art (D7).** Every illustration, scene, prop and card is hand-authored SVG in `packages/design-system` using tokens; no raster, no photographs, no traced photographs (a drawing traced from a museum photograph can be a derivative of the photographer's work). Objects are drawn from their described shape and from primary descriptions, not copied from a particular image. F-STORY-001's `ArtLayer.ref` only accepts `hoya|prop|card` (`§3.2.3`) — the schema has no field in which an external image could be smuggled in. Heritage artefacts additionally carry a `sourceRef` and `accuracyNote` in the prop registry (F-STORY-002 §3.9.10).
2. **External images only with proof.** If a future spec adds an image field, that amendment must carry a `credits[]` entry per image `{ assetId, institution, sourceUrl, license: 'kogl-1' | 'public-domain' | 'cc0', licenseProof, accessed, attribution }`, where `kogl-1` is **Korea Open Government License Type 1 (공공누리 제1유형: attribution only; commercial use and modification allowed)** and `licenseProof` is the page or file showing that license on that exact item, or the reasoning for public domain (author's death year / age of the work, and that the *photograph or scan* itself is also free). Types 2-4 (non-commercial or no-derivatives), "free to view" and "no copyright notice" are **not** acceptable. Until then a PR-template checkbox reads "Image rights: SVG drawn in-house, or `credits[]` attached". Owner to confirm with counsel before the first external image (unverified).
3. **Text.** Narration is original writing; facts are restated and sourced (lint `narration-copies-source`). Excerpts in `quoteOrLocator` are audit evidence kept in the repository; they are not shown to learners. UNESCO register text is never reproduced beyond a short quoted locator.
4. **Attribution on screen.** The story's Sources screen lists `referenceDisplay` and each fact's sources (F-STORY-002 §3.8, F-STORY-004 §3.5); cards show their citation (F-STORY-006 §3.8). UNESCO and agency **logos and emblems are never used**; inscription names are used factually.
5. **Third-party names.** National Treasure names, place names and people's names are used factually; no endorsement is implied (the store listing and Sources lines never say "approved by").

### 3.11 Telemetry

One new name, added to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts`, lines 9-43 at `c939348`) and the exact-list assertion in `packages/content-schema/src/__tests__/telemetry.test.ts` (Worker first, app second, per `specs-out/TELEMETRY-NAMES-2.md`; `journey.` is the namespace of map/grid events, a discrete action in the past tense): `journey.cell_stories_opened` `{ stageKey, themeKey, stories, source: 'cell' | 'lesson-row' | 'story-pill' }`, fired when `CellStories` opens. Payload ids and counts only. Existing `episode.start`/`episode.complete` are unchanged here (F-STORY-006 §3.6 emits `episode.complete`).

### 3.12 Accessibility, locale, offline, privacy

- Cells keep a >= 44 dp visual; the **target** problem of ~54 dp cells at 320 dp is audit UX-25's (out of scope); this spec adds no smaller target, and the count mark is not a target. `cellLabel` is a whole-sentence message function (no suffix concatenation, audit I18N-08) and moves to `messages/en/learner.ts` with F-I18N-001.
- Stage and theme titles come from `stages.ts` / `themes`; story titles are Korean + romanization + English (`KoreanText`); tags and companions' Korean names are never learner-facing.
- Everything is bundled: the catalogue, covers, the map markers and `CellStories` work offline. The map is computed from bundled content and the learner's local snapshot only.
- Privacy: no new data collected; `storiesFinished` is derived from quest progress.
- Layout at 320x568, 375x667, 768x1024 and 844x390; 200 % text scale; reduced motion removes any press animation.

### 3.13 Backend, sync, storage, teacher catalogue

- **No D1 migration, no API route, no `ProgressSnapshot` field.** Shelf and book quests use the existing quest/episode progress; plans reference quest or episode ids (`plan.ts`), so a teacher can already plan a story quest. The Worker only sees the telemetry name.
- **Teacher catalogue.** `apps/web/src/data/stage1-catalog.ts` (a hand-kept mirror, `:1-7`) stays Stage 1; F-PLAN-002 adds the shared catalogue. This spec adds the **parity test** (`apps/web/src/data/__tests__/catalogue-parity.test.ts`): the mobile `episodesAll` ids, titles, stage, theme, quest ids and minutes equal the web mirror for every `shipped` episode, (pillar tags need no mirror: the web console imports `PILLAR_TAGS` from `@hangul-route/content-schema`). Until F-PLAN-002 lands the test covers Stage 1 only.
- `gating.ts` needs no change: it finds an episode by `questIds.includes(questId)` (`:35`), treats a shelf quest as Stage 1 (`:50`), and refuses `preview`/`draft` (`:43`).

### 3.14 Behaviours (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| 1 | the 24 reviewed heritage stories are bundled | the Journey renders | Stage 1 Letters is a lesson cell with count 5; Stage 2 Letters is a **stories-only** cell (library icon, count 2, enabled); Stage 3 Rites is a placeholder (lock, disabled); 15 of 35 cells show stories |
| 2 | a stories-only cell | it is tapped | `CellStories { stage, theme }` opens with that cell's tiles in `shelf.order`, no PIN, and `journey.cell_stories_opened` fires with `source: 'cell'` |
| 3 | a learner who has played nothing | `pickedForYou` runs | stories with `recommendedStage <= 2` come before stage 3+ stories, and the Library still lists all 24 |
| 4 | a story whose `state` is set to `draft` by a correction | the next build runs | its marker count drops, an empty `CellStories` is unreachable, and every card, star and note the learner earned remains |
| 5 | a test adds a second grid episode to one cell | the invariant test runs | it fails (`MAX_EPISODES_PER_CELL = 1`) |
| 6 | a hand-written Stage 3 episode added to `episodes.ts` | the bundle builds | its preview placeholder disappears with no edit to any hard-coded exclusion set |
| 7 | narration containing "National Treasure No. 70" | lint runs | `narration-national-treasure-number`; "National Treasure" passes |
| 8 | a lesson page whose cell has 2 stories | it renders | the row "Heritage stories for this cell" with the count shows; with 0 stories the page is today's page |
| 9 | the placement table of §3.3 and the four final research files | `catalogue-placement.test.ts` runs | all 24 ids appear exactly once with the same stage, theme, minutes and cluster as the data, 112 minutes in total, 6 sampler stories, 6 story-time and 18 culture |

## 4. Out of scope

- The reader, checks, shelf, Home card and bookmarks (F-STORY-002/003/004); card awards and the new story cards (F-STORY-006); Stage 5 scene-card art (F-CARD-S5-001).
- Writing the `read` tiers and volume-2 books; more than one episode per cell in the UI (the selector and the constant are ready, the volume dots are PR 5.8).
- The Library pillar filter, seasonal "this week's picks" (Hangul Day, Seollal, Chuseok dates), search.
- Companion characters other than Hoya; an in-app error-report form; legal review of KOGL assets.
- Changing the stage header "Premium" pill (audit UX-12 is F-STORY-004 §3.9's).

## 5. Tests

TDD (CLAUDE.md §5). Mobile vitest includes only `src/{logic,store,content,config,platform}/**/*.test.ts` (`apps/mobile/vitest.config.ts`); screens are covered by Playwright.

| File | Level | Coverage focus | Target |
|---|---|---|---|
| `content-schema/src/__tests__/catalogue-fields.test.ts` | unit | `PillarTagSchema` regex, `CompanionIdSchema` only `'hoya'`, `pillarTags` duplicate/unknown/over-3 rejected on `Story` (lint) and `Episode`, `Story` still rejects other unknown keys, grid order equals theme order, book only at stage5 with 2-3 quests, volume suffix, `PILLAR_TAGS` has 23 blueprint ids + proposed D5 | 100 % |
| `mobile/content/__tests__/episodes.test.ts` | unit | **exactly one grid episode per cell** (`MAX_EPISODES_PER_CELL`), 35 cells, ids unique, `episodeFor` unchanged for every cell, previews only for unclaimed cells (adding a hand-written Stage 3 episode in a test removes its preview), shelf episodes never in `episodesFor`, the 8 shipped ids/quest ids/status frozen (golden) | n/a |
| `mobile/logic/story/__tests__/home-cell.test.ts` | unit | `homeCellOf` for every recommended stage 1-7, `entriesForCell` with the review gate on/off | 100 % |
| `mobile/content/__tests__/catalogue-placement.test.ts` | integration | with the 24 imported stories bundled (`HANGUL_ROUTE_INCLUDE_DRAFTS` fixture bundle): the placement table of §3.3 reproduced from the story files (24 rows, 112 minutes, 12/12 split, 15 cells with stories, 6 sampler, 6 story-time / 18 culture, every home cell exists in the 7 x 5 grid) · every episode tag exists · pillar balance (>= 1 story per pillar) | n/a |
| `mobile/content/__tests__/books.test.ts` | unit | `books.ts` entries: ids equal the placeholder ids, 2-3 quests, every `storyIds` entry has a `read` tier and a `shelf` twin, `storyQuestSkeleton(story, 'listen')` equals the generator's quest for the same story (parity) | 100 % of `story-skeleton.ts` |
| `mobile/logic/__tests__/journey.test.ts` (extend) | unit | `stageAvailability` counts cells (two episodes in one cell = one cell), `isCellComplete`, real-bundle expectations unchanged | 100 % of the file |
| `mobile/logic/__tests__/journey-cells.test.ts` | unit | `cellModel` for lesson / book / stories-only / placeholder, count with the review gate on and off, completed look, `cellLabel` sentences (plural, zero, "coming soon"), no banned word (`scanLearnerCopy`, `logic/homework/banned-text.ts`) | 100 % |
| `mobile/logic/story/__tests__/story-fit.test.ts` | unit | `stageNumber`, `reachedStage` (grid only, floor stage1, placement raises, shelf quests ignored), `storyFit` boundary (reached 1 → recommended 2 ready, 3 stretch), ordering used by `pickedForYou` never removes a story | 100 % |
| `content-schema/src/__tests__/story-lint.test.ts` (extend F-STORY-001's) | unit | `narration-copies-source` (7 words pass, 8 fail, case/punctuation-insensitive), `narration-national-treasure-number` ("National Treasure No. 70" fails, "National Treasure" passes), `story-shelf-needs-reviewers` | 100 % |
| `apps/web/src/data/__tests__/catalogue-parity.test.ts` | unit | mobile vs web mirror (Stage 1 now, all shipped later), pillar table equal | n/a |
| `mobile/e2e/web/journey-stories.spec.ts` | e2e (Playwright) | Journey: Stage 1 cells show counts; tap a Stage 2 Letters cell (stories-only) → `CellStories` → open a story; lesson cell still opens its episode; a placeholder cell is disabled; a lesson page shows the stories row; labels read correctly; 320 dp no horizontal scroll | — |

Coverage lanes: `apps/mobile/src/logic` >= 90 % (this feature at 100 %), `packages/content-schema` 100 %. Manual QA: VoiceOver/TalkBack across a row of cells and `CellStories`; 200 % text; offline.

## 6. Rollout

Ships dark: with no reviewed story in the bundle `cellModel` returns the same `lesson`/`placeholder` kinds as today, no marker is drawn, `CellStories` is unreachable, and the Journey is byte-for-byte today's (the golden test in `episodes.test.ts`). The first reviewed story lights its home cell without a code change. Branches `feat/story-catalogue-*`.

| # | PR | Depends on |
|---|---|---|
| 5.0 | `design(wireframe)`: promote `wireframes/story-catalogue.md` to `journey/grid-with-stories`, `story/cell-stories`, `episode/detail-cell-stories-row`; briefs; update `design/wireframes/README.md`, `docs/blueprints/10-app-map.md`, `docs/specs/README.md` | — |
| 5.1 | `feat(content-schema)`: `PILLAR_TAGS` registry + `PILLAR_HOME_THEME` in `pillars.ts`, `CatalogueFieldsSchema` merged into `EpisodeObjectSchema`, its rules added to `episodeRules`, lint `pillar-tag-unknown`, generator copy of the two fields to the shelf episode (`build-stories.mjs`), tests | F-STORY-001 PR 1.1a (creates `pillars.ts`), 1.1b (embeds the fields in `Story`) and 1.4 (generator) |
| 5.2 | `refactor(mobile)`: generator derives previews from claimed cells, `MAX_EPISODES_PER_CELL`, `episodesFor`, cell-based `stageAvailability`, one-per-cell invariant test, and **creates `content/books.ts` exporting an empty `bookEpisodes: Episode[]`**; no visible change (golden) | 5.1 (types only), F-STORY-004 PR 4.1 (`gridEpisodes`), F-STORY-001 PR 1.4 (the `storyEpisodes` import; empty until stories are bundled) |
| 5.3 | `feat(mobile)`: `home-cell.ts`, `entriesForCell` (added to F-STORY-004's `story-index.ts`; no new type), placement test over the bundled stories (shelf episodes themselves come from F-STORY-001's generator) | 5.2, F-STORY-004 PR 4.3b, F-STORY-001 PR 1.4 and the first imported cluster (PR 1.7) |
| 5.4 | `feat(mobile)`: `story-fit.ts`; hook `pickedForYou` ordering (F-STORY-004 PR 4.3b) | 5.3, F-STORY-004 4.3b |
| 5.5a | `feat(mobile)`: `journey-cells.ts` (`cellModel`, `cellLabel`), `GridCell` states (stories-only, count mark), stage caption, explainer copy; unit tests + the label fix (`episode for stage1`) | 5.3, design 5.0 |
| 5.5b | `feat(mobile)`: `CellStories` route and screen (`StoryTile` reuse), lesson-page row, "home cell" pill on `StoryEpisodeDetail`, `journey.cell_stories_opened` + e2e | 5.5a, F-STORY-004 PR 4.5 (`StoryTile`) and 4.6 |
| 5.6 | `content`: `content/story-skeleton.ts` and the entries of `content/books.ts` (the file exists since 5.2); Stage 5 rites book first, then the other cells as their `read` tiers pass review | F-STORY-002/003, reviewed `read` tiers |
| 5.7 | `ci`: the three lint rules of §3.9, PR-template "Image rights" line, QA-process section in `content/stories/README.md` and `docs/workflows/story-content-qa.md`, web parity test (`MIN_VERIFICATION_PASSES = 3` is already fixed in F-STORY-001 §3.6) | F-STORY-001 PR 1.2 (lint) and 1.0 (README) |
| 5.8 | `feat(mobile)`: `MAX_EPISODES_PER_CELL = 2` path — volume dots in `GridCell`, "first incomplete volume" open rule, `isCellComplete` in the look | first volume-2 book |

## 7. Dependencies

Upstream:

- **F-STORY-001**: `Story` (`recommendedStage`, `theme`, `shelf`, `pillarTags`, `companionId`, `verification`, `review`, `facts[]`, `tiers`; the strict schema already holds this spec's two fields), `Episode.format/placement/volume/storyIds`, `questIds` relaxation, `storiesAll`/`storyById`, generated `storyEpisodes`/`storyQuests`, `MIN_VERIFICATION_PASSES`. **F-STORY-003**: story quest skeleton and `story-read` ref grammar. **F-STORY-004**: `gridEpisodes`/`isGridEpisode`, `story-index.ts` (`entriesForCell` is added here), `StoryTile`, `isFreeContent`.
- **Research set** (`content/stories/research/`, PR #104; working copies in `scratchpad/heritage/`): `records-joseon.final.json`, `hangul-printing.final.json`, `science-art-life.final.json`, `seasons-tales.final.json` (each `verification.passes = 3`, 24 episodes, 182 scenes, 211 facts, 576 sources). F-STORY-001's importer reads only `.final.json` files; all 24 stories import with `passes: 3` and none is hidden by the verification gate (F-STORY-001 §3.14 validated the schema against all 24).
- Existing: `content/{episodes,stages,quests}.ts`, `logic/journey.ts`, `screens/journey/JourneyScreen.tsx`, `screens/episode/EpisodeDetailScreen.tsx`, `logic/homework/gating.ts`, `logic/entitlement.ts`, design-system `Card`, `Pill`, `Icon`, `Caption`.

Downstream: F-STORY-006 (cards for these episodes), F-PLAN-002 (catalogue and tag grouping), F-PLC-001 (`placement` seed for `reachedStage`), F-RVW-001, a later volume-2 spec.

Assumptions I could not verify (each with a fallback): that F-STORY-004's `StoryIndexEntry` keeps `story: Story` (so `entry.story.recommendedStage` is readable; `entriesForCell` is the only addition; it does, in F-STORY-004 §3.1); that the owner accepts the proposed `D5` tag and the story-time/culture split of §3.3 (both are data); that a native Korean reviewer and a culture reviewer exist (owner tasks); the KOGL Type 1 definition quoted from general knowledge, not re-read from the KOGL site in this session.

## 8. Decisions

Binding owner decisions and how this spec applies them:

| Id | Applied here |
|---|---|
| D1 | No age framing; learner levels never filter stories (§3.4 rule 3) |
| D2 | Titles and terms are Korean + romanization + gloss; labels are whole-sentence functions for the locale layer |
| D3 | No fractions or "behind" labels; `StoryFit` is never shown; nothing earned is removed on a content hold (§3.9) |
| D4 | Stories and the catalogue are JSON-first, generated into the app, validated on shipped content; every fact cited |
| D5 | No gating now; one `isFreeContent`; sampler defined and flagged off; no "Premium" on shelf stories or stories-only cells |
| D7 | Own SVG only; external image needs KOGL Type 1 or public-domain proof (§3.10) |
| D8 | Spec id F-STORY-005 |
| D9 | Code grid is authority; A1..E5 are tags; Stage 5 = one episode per cell, volumes later; episode finish awards cards (F-STORY-006) |
| D13 | Romanization pronunciation-based, unhyphenated, generated by the F-CNT-002 checker for tags and companions |
| D14 | Stories come from the research files; sourced facts only; unreviewed stories hidden in production |

Decisions made in this spec:

1. **Shelf for all 24; the map shows them through a home cell.** One-episode-per-cell cannot hold 24 stories (eleven are Letters; ten are Stage 1) without hiding the lessons that already exist, and gating a story by its stage would contradict D5.
2. **`recommendedStage` is a hint, not a prerequisite.** It orders "next" and places the map marker; it never locks.
3. **Stories-only cells are tappable, placeholders stay disabled.** A cell that has a story is no longer "Coming soon".
4. **Stage 5 books reuse the placeholder ids** and open cell by cell with at least two reviewed `read` quests; rites first.
5. **Listen (shelf) and Read (book) are different quests of the same story**, one card.
6. **Companions: Hoya only**, `companionId` reserved; the five blueprint companions wait for art.
7. **Verification mechanics stay F-STORY-001's** (`contentVer`, `fact.rev`, append-only `errata`, `MIN_VERIFICATION_PASSES = 3`); this spec adds three lint rules.
8. **Folk tales and festival-day stories form the Story Time category; everything documentary is Culture** (F-STORY-004 sections); data, changeable.
9. **Proposed pillar tag D5 (traditional tales)**; tags are never shown to learners.
10. **Errata hides a falsehood first, fixes second, and never takes an earned item away.**
