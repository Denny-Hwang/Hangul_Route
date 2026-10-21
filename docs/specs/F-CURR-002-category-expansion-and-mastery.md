Status: ready (spec only; no row has started). Revised 2026-10-21 after review round 1 (section 20), then with the owner decisions of 2026-10-21 (section 21): every decision in section 16 is decided, and OD-2 changed to horizontally swiped topic pages on the Journey view.

# F-CURR-002 — Category expansion and mastery: one memory model, review sessions, mastery and stage checks, Volume 2 of the five themes, and Topic Packs

> **Owner request 2026-10-21 (B, binding):** plan further development of the lesson categories. Today there are five themes (Letters 글자, Food 음식, Holidays 명절, Nature 자연, Play 놀이). Plan both directions: richer content inside each category, and new categories. The service must be more fun and varied, and above all give a sense of achievement and efficient learning. Production level: every row ships finished content reviewed by the multi-agent review (MAR, owner decision 2026-10-12). Rows do not wait on the owner. Every decision in section 16 was decided by the owner on 2026-10-21 (section 21).

**Scope**: `packages/content-schema` (review items, memory state, topic packs, mastery, new round schemas, lint rules) · `scripts/` (`build-lessons.mjs` and `build-stories.mjs` item extraction, manifest and story split, generated catalogue, `new-pack.mjs`) · `content/episodes/` (Volume 2 cells), `content/packs/` (new), `content/stories/` (new tales and read tiers), `content/i18n/{es,ko}/` · `apps/mobile` (memory store, review engine, Daily Review, mastery ring, Cell and Stage Checks, goals, new game renderers, Journey topic pages) · `packages/backend` and `apps/api/migrations` (memory shard routes, remote config, telemetry rollups, guardrail evaluator, class goal; additive, Worker first) · `apps/web` console (reports, class goal, metrics page) · lecture mode (presets and slide kinds) · `packages/i18n` (en, es, ko) · `design/wireframes/` and `design/screens/` (design rows CM-D1 to CM-D3)
**Owner**: solo dev (content written by agents and reviewed by MAR)
**Rollout**: phases 0 to 6 in section 12. Every new surface has a build-time kill switch and a remote off switch with a defined fallback (section 12.2). The memory model runs in shadow mode for two weeks, with its data landing in a persistent rollup table, before any learner sees a review screen.
**Wireframes**: design rows CM-D1 (review and achievement surfaces), CM-D2 (new games), CM-D3 (Hidden Heritage, Journey topic pages, pack page, Passport) produce them before any UI code. Existing `design/wireframes/journey/grid.md`, `quest/{player,discover,check}.md`, `reviews/hangul-check.md` and `minigame/*` stay valid. CM-D3 amends one line of `grid.md`, "no horizontal scroll", for the topic pages only (section 6.1): the five theme columns still always fit one screen width.

Parent and siblings: CLAUDE.md section 1 (audience, languages, anti-shame, grid) · blueprint 04 (grid, themes, pillars, companions) · blueprint 05 (stage goals, cumulative word targets) · blueprint 06 (game catalogue: Role Play, Hidden Heritage, My Story) · F-CURR-001 (upper-stage content, rules U-1 to U-10, the lesson pipeline; section 4, U-8 and OD-6 referenced or amended here) · F-QUEST-002 (six-step quest; L13 amended) · F-RVW-001 (review tests; amended by row CM-0b) · F-VOC-005 (Leitner boxes, local day, monotonic merge; P3 amended) · F-STORY-005 (volumes, `MAX_EPISODES_PER_CELL`, PR 5.8) · F-STORY-006 (card awards) · F-CARD-S2-001 .. S7-001 (card art, unblocked here) · F-PLC-001 (level check ceiling) · F-PLAN-002 (catalogue, `CATALOG_VERSION`) · F-ENT-003 (free plan = all of Stage 1) · F-TCH-004 and `AMENDMENTS-LECTURE-V2.md` (lecture mode) · F-REPORT-001 (reports; OD-19 amended) · F-SYNC-001 / F-SYNC-002 (snapshot sync, backup) · F-RESTORE-001 (Rescue Code) · the device principal of audit SEC-3 / SEC-4 (`packages/backend/src/lib/device-auth.ts`; F-AUTH-003 is superseded) · F-AUDIO-004 (device voice, visible sound notice) · F-I18N-001 (overlays, ratchets) · `docs/roadmap/TELEMETRY-NAMES-2.md` (new section R) · the multi-learner account plan of owner request A (2026-10-21, its own spec; section 4.9 states what this spec needs from it)

---

## 0. Decisions on one page

1. **Make what we teach stick before we add more of it.** About 780 Korean strings taught in lessons never come back. Every taught item gets a stable id and enters one memory model, built on the shipped F-VOC-005 Leitner boxes with one added rule: a box rises at most once per local day, and only on an answer given when the item is due (section 4).
2. **Review is short, interleaved and sized to the load it creates.** A 2-3 minute Daily Review with an optional "Keep going", a 30-second warm-up before a quest, and "Try these again" after a quest. Due items answered anywhere count (section 4.5).
3. **Achievement continues past Stage 1.** Every cell gets a visible mastery ring that never goes down. Each cell gets a Cell Check, which doubles as a test-out. Stages 2-7 get a Stage Check, a ceremony and a stage card. The 25 upper cells get cards, grouped into five category albums (sections 4.4, 7).
4. **Variety comes from formats, not only content.** Eight new formats, all reading, listening or writing, each with a shipped fallback. A lint caps any one game at 40% of a stage's Checks, down from 100% today (section 7.1).
5. **Depth inside a category is Volume 2.** The volume system F-STORY-005 already specifies gives 25 upper cells a second volume and five Stage 5 books a second book of tales that do not ship yet. Nature and Play go first, because they are the thinnest (section 5).
6. **New categories are Topic Packs on topic pages that the learner reaches by swiping the Journey view sideways, not a sixth grid column** (owner decision OD-2, 2026-10-21). The first page is the five themes exactly as today. Swiping sideways shows further pages of pack columns, at most five a page, so no cell is ever under the 48 dp touch target at 320 px. Page dots and an edge arrow show there is more to the side, and buttons do the same as the swipe for keyboard and screen-reader users. A sixth column would put the cell under 48 dp, and the theme key is in 54 files and the Worker. There are eight packs in three waves; the first wave is Numbers & Time, People & Family and Feelings & Me (OD-4; section 6).
7. **Remove authoring bottlenecks before content scales.** Generated modules stop being committed, and the catalogue version becomes a date stamp authored in content, so parallel content PRs have no shared file (section 9).
8. **Lessons and stories load outside the start bundle.** A manifest of 60 KB or less is loaded at start. Lesson and story bodies are precached, content-hashed static chunks, so offline still works and start-up gets lighter while content triples (section 10).
9. **Every phase is measured without PII, and the data has somewhere to land first.** A persistent rollup table ships in Phase 0, before the shadow period it measures. A public, read-only remote config with off-only overrides replaces build-only kill switches, and a daily guardrail evaluator lowers a ramp on a breach. Each learner profile is placed in an experiment bucket. Metrics are counts by content id, and any group with fewer than 20 profiles is suppressed (sections 3, 11, 12).

## 1. Context

Read on `main` at `a384759ca` (2026-10-21). The full inventory is in the research brief of this request. The numbers that drive this plan:

| Signal | Now | Why it matters |
|---|---|---|
| Grid | 7 stages x 5 themes = 35 cells, all shipped, one volume each (`MAX_EPISODES_PER_CELL = 1`) | Each category is one volume deep |
| Content | 107 quests, 494 minutes (about 8.2 h) | About 2 weeks of daily use |
| Taught Korean | about 784 distinct strings in Stages 2-7, plus 144 topic words | Blueprint 05 targets 3,180 words cumulative; we are at about 25-30% |
| Items in spaced review | 144 topic words only (F-VOC-005) | About 780 lesson items are never retrieved again |
| Checks | Listen & Pick is the Check in 96 of 107 quests; Stage 4 plays the same three games in all 15 quests | Recognition only; monotonous |
| Achievement after Stage 1 | No ceremony, no stage card, no check (`PRIZE_STAGE = 'stage1'`); the upper cells give no card (F-CURR-001 OD-7) | Achievement stops after the first stage |
| Daily Test | F-RVW-001 still `draft`; mission slot 3 falls back to a word set, a story, or a replay of a whole scored quest | Nothing brings items back on a schedule |
| Streak | Quest sessions only, counted on the UTC day (`logic/streak.ts`), and recomputed from sessions on every merge (`logic/sync/merge.ts`) | Wrong day near midnight for most of the world; any one-time fix is overwritten at the next sync |
| Stories | 24 in `content/stories/`. By theme: Letters 11, Holidays 4, Play 4, Food 3, Nature 2. 10 have no `read` tier (8 of them Letters). Stage 5 promises "folk stories" and ships one folk tale (`sun-and-moon`) | Thin columns; a copy promise not kept |
| Story bundle | `stories.generated.ts` is 1,255,855 B raw and is imported at start through `content/stories.ts` | The largest start-up cost, larger than the lesson index |
| Culture notes | 70 authored, none reach the screen; S2 Nature, S4 Letters, S4 Nature and S7 Food have none | Authored value is invisible |
| Lesson budget | 914,729 B raw / 133,276 B gzip of a 950,000 / 140,000 ceiling; `lessons-index.ts` (372 KB raw) loads at start | About 2 cells of headroom; start-up cost grows with every cell |
| Generated modules | `lessons-index.ts`, `lessons-stage<n>.ts`, `stories.generated.ts`, the web catalogue and title mirrors are committed and checked with `--check`; `CATALOG_VERSION` (32) is a hand-bumped integer | Every content PR rewrites the same files; parallel content PRs conflict |
| Telemetry | `POST /api/telemetry` keeps an in-memory log per isolate, capped at `MAX_EVENTS = 10,000`, with no read route (SEC-3) | Nothing persists; no baseline or guardrail can be computed today |
| Kill switches | Build-time `EXPO_PUBLIC_*` only (`config/flags.ts`) | Turning a feature off means a redeploy |
| Copy against the standing rules | Stage 4 "real-life mini conversations", Stage 6 "menus, signs, calls", Stage 7 `anchorSkillEn` "Record a 1-minute personal introduction", Stage 5 "folk stories"; F-RVW-001 has age wording | Fixed in row CM-1 and CM-0b |

## 2. User stories

> As **a learner of any age**, I want the words and sentences I learned last week to come back at the right moment, in short, varied rounds, so they stay with me, and I want to see on my map which places I have truly mastered.

> As **a learner who already knows some Korean**, I want to show what I know and skip ahead, so I spend my time on what is new.

> As **a learner who wants more**, I want each theme to keep going after its first volume, and new topics I can choose myself, such as numbers and time, people and family, or music and art.

> As **a parent or teacher**, I want to see what each learner has mastered and what is ready to refresh, set a shared weekly goal for my family or class without ranking anyone, and run a class review or a class game from the same content.

## 3. Goals and metrics

### 3.1 North star

**Weekly durable items.** Per active learner profile: the number of distinct items with a first-try right answer that was **given when the item was due, after an interval of 7 or more days since its previous spaced answer**, in the last 7 local days. It goes up only when learners both learn and remember.

- The device computes the value once a local day and sends it as a bucket in `memory.daily` (`durableWeekBucket`), so the rollup can report p25, p50 and p75 over profiles without storing any profile id (section 11.2).
- It is always reported next to the due volume of the same profiles (`dueVolumeBucket`), because more reviews can raise the count without better memory.

### 3.2 Goals

Baselines come from the two-week shadow period of row CM-12, which writes into the persistent rollup table of row CM-70a, and from existing events counted the same way. Targets are measured 8 weeks after a phase reaches 100%.

| ID | Goal | Metric (no PII; source) | Target |
|---|---|---|---|
| G1 | Remember what was taught | First-try recall on spaced answers whose previous spaced answer was 6-8 days earlier (`memory.daily` lag histogram) | 80% or more |
| G2 | Spacing reaches learners | Share of items introduced in a 30-day window that receive 3 or more spaced answers within 30 days of introduction, for profiles active 3 or more days a week (`memory.daily`) | 70% or more |
| G3 | Efficient study | Items newly reaching best box 3 per study minute (`memory.daily` and session minutes) | +25% against the before cohort, or against holdback E1 |
| G4 | Right difficulty | Share of quest and review sessions with first-try accuracy of 70-92% (`quest.complete`, `review.complete`) | 80% of sessions or more |
| G5 | Achievement past Stage 1 | Share of Stage 2-7 finishers who open the stage card or the Passport page of that stage within 7 days (`stage.card_opened`); cells at mastery 2 or higher by day 30 among cells done | 60% or more; 50% of done cells at mastery 2 or higher |
| G6 | Habit | Days with a Daily Review done divided by days with any session; D7 and D30 return of new profiles by creation-week cohort | 55% or more; D7 +5 pp, D30 +3 pp |
| G7 | Variety | Largest share of one game kind among a stage's Checks; distinct kinds per stage (build-time report) | 40% or less (100% today in Stages 1-4 and 6); 5 or more kinds per stage |
| G8 | Depth | Total guided minutes; distinct taught items (build report) | About 494 to about 1,400 minutes; about 930 to about 2,300 items |
| G9 | Decoding fluency | Median correct decodes per minute on a **held-out probe** of syllables the learner has not drilled in any sprint, first sprint against the fourth, Stage 1 finishers (`decode.sprint.finished`); always reported with the number of learners who took part | +30% |

### 3.3 Guardrails

The guardrail evaluator (row CM-70b) checks these once a day from the rollup table. On a breach it lowers the ramping flag to its previous step through the remote config (section 12.3).

- Mid-quest quit rate per game kind (`session.end` with `questLeft: 1`, by `leftAtKind`) must not rise by more than 2 pp.
- Quits after a wrong streak (`session.end` with `afterWrongStreak: 2` and `questLeft: 1`) must not rise.
- Median session length must not fall by more than 10%, and p90 must stay under 20 minutes.
- Sync 4xx and 5xx rates must not double, the p95 memory delta size must stay under 32 KB, and D1 rows written per day must stay under 50% of the free-tier daily quota.
- The start bundle must not grow (section 10).
- The crash and error rate stays flat.

### 3.4 How we measure honestly

- If weekly actives are about 400 or more per arm, experiments run as A/B tests (section 11.3).
- With fewer, a feature ramps 10%, then 50%, then 100%. It is compared with the cohort before it, and the result is labelled directional.
- No metric is shown to learners as a number. Learners see stars, rings and counts of items that got stronger. Grown-ups see accuracy in reports, as F-RVW-001 section 3.1 already requires.

## 4. The learning model

### 4.1 Learning-science grounding

| Principle | Mechanic here |
|---|---|
| Retrieval practice, the testing effect (Roediger and Karpicke 2006) | Daily Review, warm-up, Cell and Stage Checks retrieve; they do not re-show |
| Spacing (Cepeda et al. 2006) | Leitner boxes at 1, 3, 7, 14, 30, 60 and 120 days on the local day, over every taught item; a box rises only on a spaced answer, so massed practice inside a quest cannot fake memory |
| Interleaving (Rohrer and Taylor 2007) | Review mixes themes, kinds and formats when the pool allows; content lint `lesson-recycle` |
| Desirable difficulty, the "85% rule" (Bjork; Wilson et al. 2019) | Adaptive pacing keeps first-try accuracy in about 70-92%; the modality ladder moves a known item up from recognition to production |
| Forward testing effect (Pastötter and Bäuml 2014) | Up to three due items before new material in a quest |
| Mastery learning (Bloom 1968) | Mastery levels depend on spaced success, not on replays |
| Pretesting and test-out (Richland et al. 2009) | The Cell Check works as a test-out from any unstarted cell; items it did not ask are checked by the first review |
| Comprehensible input (Krashen; Nation's 95-98% coverage) | A story coverage report and a "Fits you" label |
| Self-determination theory (Deci and Ryan) | Autonomy: goal size and pack choice. Competence: rings, checks, ceremonies. Relatedness: family and class totals, with no ranking |
| Goal-gradient effect (Kivetz et al. 2006) | Goal ring, weekly dots, album progress |

### 4.2 Review items

Every taught unit becomes a **review item** with a stable id. The build creates the id; nobody types it.

| Kind | What it is | Example id | Taught in |
|---|---|---|---|
| `sym` | a symbol (jamo) | `sym:ㅂ` | Stage 1, Word Builder |
| `syl` | a syllable block or a final-sound rule | `syl:batchim-k` | Stage 1-2 |
| `lex` | a word or a set phrase | `lex:sagwa`, `lex:bae~pear` | Discover items, every stage |
| `pat` | a sentence pattern or a writing frame | `pat:n-juseyo` | Stages 3, 7 |
| `exc` | a dialogue exchange (a line and its reply) | `exc:jal-meokgetseumnida` | Stage 4 |
| `rea` | a real-world reading skill | `rea:price-won`, `rea:clock-time` | Stage 6, packs |

- **Ids.** The slug is the F-CNT-002 romanization of the item. A sense suffix from `content/vocab/_senses.json` keeps homographs apart (배 as pear, boat and belly).
- **Topic words keep their ids.** A word that is already a topic word keeps its `VocabIdSchema` id (91 of the 142 distinct topic words also appear in lessons), so it is one item, not two.
- **Ids are frozen.** After the first build, ids sit in a snapshot test (`items-stable-id`). If an edited string would change an id, the build fails unless the author adds an alias entry.
- **Retired items.** When a re-authoring row removes an item from every round, the author adds its id to a `retired` list in the same snapshot. A retired id is never selected for review, keeps its state for reports, and stays out of every mastery denominator.
- **Extraction has three sources** (row CM-10), merged into one lazy `review-items` chunk:
  1. **Stages 2-4, 6, 7 and packs:** `build-lessons.mjs` reads every Discover item and every scored round's answer.
  2. **Stage 1:** Stage 1 is hand-written TypeScript. A small extractor reads its symbol, syllable and word tables into a frozen `sym` / `syl` / `lex` table, with a parity test against the Stage 1 data. The Stage 1 additions of section 5.2 are authored as TypeScript rows in the same tables. They bypass the lesson lint and the U-rules, so CM-33 adds their own unit tests (sources present, every new symbol shown before it is asked) and they go through the same three-checker MAR as a content PR.
  3. **Stories:** `build-stories.mjs` emits the taught words of each story's check rounds. Topic-word ids are reused.
- **Each entry carries:** id, kind, Korean text, romanization, gloss key, theme or pack, stage, volume, the cells that teach it, the formats it allows, and `soundChange` and `homophoneOf` flags (section 4.5).
- **Size.** About 1,100 items today and about 2,300 at the end state. At about 60 B each that is about 140 KB raw, loaded lazily (section 10).

### 4.3 The scheduler

**Box rules: F-VOC-005 P3 with a spacing rule** (P3 is amended in CM-0b; the rule applies to topic words too).

- **Box 0** means not met. The first time a learner meets an item (its Discover page, or its first scored round), it enters **box 1, due tomorrow**, with first day `f` = today.
- **Spaced answer.** An answer counts as spaced only if it is the item's **first answer of the local day** and the item is **due** on that day (due day `d` ≤ today, overdue included). Only a spaced answer can raise the box.
- **Up.** A spaced, first-try, unhinted right answer moves the item up one box. So a box rises **at most one step per local day**.
- **Down.** A wrong first try moves the item down one box, never below 1, and makes it due tomorrow. This applies to any answer, spaced or not, but **at most once per local day**, so one hard quest cannot knock a box from 5 to 1.
- **Every other answer** (not due, or not the first of the day, including every in-quest answer on the day an item is introduced) updates the rep count `n` and the rungs, and never the box.
- **Intervals.** Boxes 1-5 are 1, 3, 7, 14 and 30 days, as F-VOC-005. Items in the memory store also have **box 6 (60 days) and box 7 (120 days)**, so the maintenance load stays bounded: 2,300 items at box 7 come to about 19 reviews a day. Topic words in the `vocab` slice keep boxes 0-5 (F-VOC-005), because their load is small (144 items, about 5 a day at box 5) and their schema stays unchanged.
- **Response time is not used**, so a learner who needs more time is not scheduled worse. The F-VOC-004 idle-hint exception still applies: a right answer with the hint showing is not promoted and not demoted.
- **Credit inside sentences.** A first-try right answer on a `pat` or `exc` item at the read or produce rung also counts as a read-rung answer for each taught `lex` item inside it that is due today. This follows the same spacing rule, so it can raise each word at most once a day.
- **Typing tolerance at the produce rung.** Typed answers are compared after NFC normalization, with spaces ignored. An answer one jamo away from the target (a missing 받침, a wrong vowel stroke) counts as **hinted**: no promotion, no demotion, and Hoya shows the correct form with the amber nudge. Two or more jamo away is a miss.

With these rules an item first met on day 0 reaches box 2 on day 1 at the earliest, and box 3 on day 4 at the earliest.

**Modality ladder.** Each item has up to three rungs:
1. **recognize**: hear it and pick it
2. **read**: see the Korean and pick the meaning or picture
3. **produce**: type it, build it, take it as dictation, or fill a gap

- **With no device voice**, recognize and read merge into one rung (read), so the ladder has two rungs.
- **Two fields hold the ladder.** `r` is a bitmask of rungs **ever passed**. It merges by OR and only grows. `c` is the **rung to ask next**, part of the last-writer-wins schedule with `b` and `d`.
- **At box 3 or higher** (box 1-2 ask at recognize or read), review asks the item at rung `c`. A first-try right answer at rung `c` sets its bit in `r` and moves `c` up one rung. A right answer at a higher rung also sets the lower bits.
- **A miss at the produce rung** sets `c` back to read and follows the box rule above. The produce bit in `r` stays, because it records a past pass.
- Production enters review without any speaking.

**Rungs by kind:**

| Kind | recognize | read | produce |
|---|---|---|---|
| `sym` | hear the sound, pick the symbol | see the symbol, pick its sound in romanization | Syllable Build with the symbol in place, or Match Shape |
| `syl` | hear it, pick the block | see the block, pick its romanization | Syllable Build |
| `lex` | hear it, pick the word | see the word, pick the picture or gloss | Type Hangul `see` or `picture`, Dictation (only when the item passes `dictation-unambiguous`), Syllable Build |
| `pat` | hear it, pick the sentence | see it, pick the meaning | Cloze Pick, Sentence Builder |
| `exc` | hear the line, pick the reply | read the line, pick the reply (text only) | order the reply's words (Sentence Builder) |
| `rea` | — (two rungs only) | read a realia card, answer one question; values come from generated variants, so the answer cannot be memorized | Cloze Pick on a sentence that states the value (___ 원이에요) |

**Load and selection.**
- **The due pool** is every item with `d` ≤ today. Real due items are never pushed to other days. Selection takes the **lowest box first**, then the oldest due day, then a jitter seeded by the item id, so it is deterministic and fragile items come first.
- **Due items answered anywhere count.** A warm-up, a quest round (including its recycle rounds), a story check round, and a Cell, Stage or Pack Check all record answers, and the spacing rule decides which of them are spaced.
- **Seeding is capped** at 15 seeded items due on any one day (section 4.8).
- **Review before new, as a suggestion.** When the due pool is larger than 3 times the Daily Review size, the Today mission puts the Daily Review first and shows "N items are ready to refresh". It never blocks new content.
- **Simulation gate (row CM-13).** A 60-day simulation of the engine runs in CI with these scenarios. The tuning knobs (Keep going rounds, warm-up size, credit inside sentences) are adjusted until all assertions pass:

| Scenario | Learner behaviour | Assertions |
|---|---|---|
| S-a | 1 quest a day, Daily Review every day, one Keep going on days the pool is over 20 | the pool is at most 3 x the Daily Review size on 90% of days 30-60; G2 is reachable (70% or more of items introduced in days 1-30 get 3 spaced answers within 30 days) |
| S-b | 2 quests a day; on days the review-first suggestion shows, Daily Review and Keep going replace the second quest | the pool on day 60 is no more than the pool on day 30 plus 30 |
| S-c | an existing learner with all 107 quests done (about 930 seeded items), then S-a | every seeded item has a due day; no day has more than 15 seeded due; the spread ends by day 62 |
| S-d | any number of right answers to one item in one day (property test) | the box rises by 1 or less; it falls by 1 or less |
| S-e | one quest-day introduces 8 items, then S-a | no item reaches box 3 before day 4 |

**Later: an FSRS-lite shadow (row CM-72).** It predicts recall for the same items without scheduling anything, and reports calibration bins in `memory.daily`. A switch from Leitner to FSRS is a later decision, made on measured calibration after 8 weeks. It is not part of this spec's rollout.

### 4.4 Mastery

Each grid cell and each pack level shows a level from 0 to 3. It is drawn as a three-segment ring in theme tokens around the 54 dp cell, so it needs no extra width.

**Every learner-facing number reads only monotonic fields:** best box `s`, the rungs-ever-passed bitmask `r`, the rep count `n`, and the latches below. The current box `b` and the next rung `c` drive scheduling only and never appear on a learner screen.

**Denominator.** A cell's items are the items of the volumes of that cell the learner has **started** (at least one quest done or tested out), minus retired items. A volume that ships later, or one the learner has not opened, never holds a level back. Instead the ring shows a small "New volume" marker.

| Level | Name on screen | Rule |
|---|---|---|
| 0 | none | not started |
| 1 | Done | every quest of the cell's first volume done, or the Cell Check passed as a test-out |
| 2 | Practiced | 80% or more of the denominator at best box 3 or higher |
| 3 | Mastered | Practiced, plus the Cell Check passed (80% or more first-try), plus 60% or more of the denominator at best box 4 or higher |

- **The level never drops.** A snapshot field `cellBest: Record<cellOrPackLevelId, 0-3>` merges by max. Boxes can fall, but the visible level cannot. This follows F-VOC-005 P2: learner screens read only monotonic fields. Because a box rises only on spaced answers (4.3), level 2 needs at least four local days and level 3 at least eleven.
- **Due items glow.** When a mastered cell has items due, the ring shows a soft glow labelled "Ready to refresh". The glow is never drawn as wilting, cracking or loss.
- **Words known.** A counter on Home and the Learning Route: `lex` items (lesson words and topic words) with best box 2 or higher **and at least one real answer** (`n` ≥ 1, or a recorded answer in the `vocab` slice). A seeded box alone never counts. Letters keep their own Stage 1 meter. Milestones at 100, 250, 500, 1,000 and 2,000 bring a short Hoya celebration. The counter only grows, because `s` and `n` only grow.

### 4.5 Review sessions

All sessions share one engine (`logic/review/engine.ts`, row CM-13). The engine is pure, deterministic for a seed, and works offline.

| Session | Length | Where it lives | Selection | Learner sees |
|---|---|---|---|---|
| **Daily Review** (the F-RVW-001 Daily Test, rebuilt on this model) | 10 items, about 2-3 min (experiment E2: 6 against 10) | Today mission slot 3, when 3 or more items are due; also on Home | the due pool in selection order (4.3); stretch items (the next rung of a best box 3+ item that is not due) only fill slots the pool cannot. Ends early with "All refreshed today" when there is nothing to ask | Stars by F-RVW-001 section 3.1, and "N got stronger" |
| **Keep going** | 10 more items, optional | Offered at the end of a Daily Review while due items remain, up to 3 times a day | the due pool, same order | stars; never required; never shown as owed |
| **Warm-up** | up to 3 items, 30 s or less, before the six steps of a Stage 2+ quest | Quest player, outside the six steps (so F-CURR-001 U-5 timing is unchanged) | due items from earlier cells; skipped when none are due | nothing scored; a soft "Warmed up" |
| **Try these again** | the quest's missed items, 30-60 s | Quest reward step, as the default suggestion when there were misses (a full replay stays available) | the misses of the session just played (kind `feedback`). This amends F-QUEST-002 L13: the reward step may offer it, while the Check still replaces the one-question Feedback Review inside the quest | stars |
| **Cell Check** | 8-10 items, about 3 min | Cell sheet, after the first volume is done; on any unstarted cell as **Test out** | the cell's items, at least 30% at the produce rung, interleaved | stars; 80% or more first-try counts toward Mastered, or marks Done when used as a test-out |
| **Stage Check** | about 20 items, 6-8 min, untimed, retake freely, best result latches | Journey stage header, after the stage latch | items from all five themes of the stage, at least 30% produce | stars, then the ceremony and the stage card |
| **Pack Check** | 10 items | Pack page, after level 5 | the pack's items | stars, then the pack badge |

**Interleaving rules, when the pool allows.** No more than 2 consecutive items from one theme, and no more than 3 consecutive items in one format. When every due item comes from one theme, the theme cap is skipped and the format cap still applies.

**Format by rung and kind** is the table in 4.3. Recognize falls back to read with no device voice, and the visible F-AUDIO-004 sound notice shows.

**Listening rounds never depend on telling homophones apart.**
- **`dictation-unambiguous` lint and engine rule.** An item may be asked in Dictation (Type Hangul `hear`), or in any heard round whose options are spellings, only if its standard pronunciation has exactly one spelling among the taught items (낫 / 낮 / 낯 all sound [낟]; 같이 sounds [가치]), or the prompt shows a picture or gloss that settles it. Items with a `soundChange` flag stay out of hear mode until recordings A-9 and A-10 exist. The review engine applies the same rule when it picks a produce-rung format.
- **The spelling round of Letters S2** (section 5.2) is a read-plus-meaning round: picture or gloss with audio, then "Which spelling matches this word?". Its two options may sound the same (책이 and 채기 are both [채기]), and the picture or gloss is what settles it. CM-0b amends F-CURR-001 U-8 for this one round kind, and the lint requires the picture or gloss on it.

**Never on a review screen:** a percentage, an "n of m" score, or a per-question timer. A lint enforces this (section 9.3).

**Test-out details:**
- The quests of a cell passed by test-out show "Tested out" and 2 stars, and stay replayable.
- **Items the Check asked** are set by their result: right goes to box 2 (due in 3 days), a miss to box 1 (due tomorrow).
- **Items it did not ask** go to box 1, due spread over the next 3 days within the caps, so the first reviews check them.
- So "Words known" grows only with items the learner actually answered.
- `routeNext` skips tested-out cells.
- A test-out needs access to the cell under F-ENT-003, the same as playing it.

**Later (row CM-25): Stage Jump Ahead.** It applies the Cell Check rule to a whole stage. It also amends F-PLC-001, because a learner could then be placed above `stage3`.

### 4.6 Adaptive pacing inside a quest

- **Strong round:** first-try accuracy of 90% or more in Practice makes the second Discover page of later quests in the same cell **compact**: both items on one card, each with Hear it, and Continue at once. It also shortens Apply by one round. **No teaching content is ever skipped**: every new item of a quest still appears on a Discover surface before its first scored round.
- **Hard round:** two wrong first tries in Practice insert one scaffold round: the same items in an easier format, with the hint showing.
- Nothing is ever taken away and nothing is said about speed. The event is `quest.adapt { questId, dir: 'compact' | 'scaffold' }`.
- The F-CURR-001 timing bands describe the standard path. U-5 checks the standard path only. A new rule **U-11** checks every adapted path: each new item appears on a Discover surface before it is first asked.

### 4.7 Comprehensible input for stories

- **Report `story-coverage` (report only).** For each story and tier, it gives the share of tokens taught by the story's recommended stage. The authoring target is 95% or more.
- **"Fits you" label.** On the shelf, a story is marked "Fits you" when 95% or more of its items have best box 2 or higher for the active profile. It is computed on the device and never sent. **Once shown for a story, it latches** for that profile on that device, so it never flickers off after a miss.

### 4.8 Storage, sync and migration of existing users

**Where state lives**
- **Topic words stay in the `vocab` slice of the snapshot**, unchanged (F-VOC-005).
- **Lesson, story and pack items live in a separate memory store.**
  - A full snapshot is pushed on every sync (`PUT /api/sync/learners/:id/snapshot`). An object per item like the vocab slice is about 150 B, so 2,300 items in the snapshot would add about 340 KB per learner per sync. Accounts with several learners make this worse (section 4.9).
  - On the device, the store is a local table keyed by profile and item, in IndexedDB on web and in the app's storage on native, through the safe storage wrappers.
  - The server copy is a new D1 table of **shards**: one row per learner per shard, holding a compact map of that shard's item states. A shard is a stage (`stage1` .. `stage7`), a pack (`pack:<key>`) or `week` (This week in Korea). That is about 16 rows per learner at the end state, so a sync writes 1-3 rows instead of hundreds.

    ```sql
    -- next free migration number at merge time (0013 on main today); additive
    CREATE TABLE memory_shards (
      learner_id TEXT NOT NULL,
      shard      TEXT NOT NULL,     -- 'stage2', 'pack:numbers-time', 'week'
      seq        INTEGER NOT NULL,  -- server-assigned; per learner; rises on every write
      states     TEXT NOT NULL,     -- compact JSON map: item_id -> {b, d, c, r, n, f, s, at}
      updated_at TEXT NOT NULL,
      PRIMARY KEY (learner_id, shard)
    );
    CREATE INDEX memory_shards_seq ON memory_shards (learner_id, seq);
    ```

- **State fields and merge rules** (per item, inside a shard):

| Field | Meaning | Merge |
|---|---|---|
| `b` | box 0-7 | last writer wins on `at` |
| `d` | due local day | last writer wins on `at` |
| `c` | next rung to ask | last writer wins on `at` |
| `r` | rungs ever passed, as a bitmask | OR |
| `n` | reps | max |
| `f` | first day | min |
| `s` | best box | max |

  - **Tie-break for equal `at`:** higher `b`, then later `d`, then higher `c`. So the merge is commutative and idempotent.
  - This is the F-VOC-005 contract applied to a new store: learner-visible fields only grow, and the schedule merges last-writer-wins. No lapse count is stored, which keeps F-VOC-005 P3; lapses are counted per day inside `memory.daily` only.
  - A merge test covers a produce miss on device A (`c` falls, `r` keeps the produce bit) combined with an older state on device B.

**Routes (Worker first)**
- `POST /api/sync/learners/:id/memory` takes up to 500 changed item states per call, in a body of 64 KB or less. Anything larger is rejected with 413. The Worker reads the shards the call touches, merges per item, and writes them in one D1 batch, giving each written shard `seq` = the learner's highest `seq` + 1.
- `GET /api/sync/learners/:id/memory?since=<seq>` returns the whole shards with a `seq` above the cursor, and the new cursor. Paging uses the server's `seq`, never the client's `at`, so a late offline upload with an old `at` still reaches every other device.
- **Auth.** Both routes use the device principal `authorizeDevice` with **full scope only**, the same as `PUT` / `GET` snapshot. A class-scoped device gets `403 scope_limited` (SEC-4) and keeps its memory on the device, like the rest of its progress today. Class goals reach the Worker through a separate counts-only route (section 7.6). The path carries only the opaque learner id, as the snapshot route already does. No name or email appears.
- **Seeded states are never uploaded.** A seeded state with `n` = 0 is re-derived on each device from `questDoneAt` and `memSeededAt` by the same deterministic stagger. Only states with `n` ≥ 1 sync. This removes the release-day upload of about 1,100 states per learner.
- **Cost.** The D1 free tier allows about 100,000 rows written a day. At 1-3 rows a sync, that covers about 30,000 syncs a day. Rows written per day is a guardrail (3.3), and CM-11 has a test that a 500-item call writes no more rows than the shards it touches and stays within the Worker CPU budget in a benchmark.
- Writes queue in the existing offline queue and flush when online.
- **Backup and Rescue Code.** The F-SYNC-002 backup file and the F-RESTORE-001 restore gain an optional, lenient `memory` key (`.optional().catch(undefined)`), as the `vocab` slice already is in `BackupFileSchema`. `BACKUP_VERSION` stays 1. An older app ignores the key; an unreadable key never fails the whole file.

**New snapshot fields** (optional, additive, lenient on read, preserved by the Worker before any app writes them; row CM-3b):

| Field | Contents | Merge |
|---|---|---|
| `cellBest` | `Record<id, 0-3>` | max |
| `cellCheckAt` | `Record<id, ISO>` | earliest |
| `stageCheckAt` | `Record<stage, ISO>` | earliest |
| `testedOut` | `Record<cellId, ISO>` | earliest |
| `goals` | `{ daily: 3 \| 6 \| 10, weeklyDays: 3 \| 5 \| 7, setAt }` | last writer wins on `setAt` |
| `dayLog` | `Record<localDay, Record<installKey, points>>`, last 70 days. `installKey` is a random id made on the device; it never leaves the snapshot | max per day and install key; read as the sum over install keys |
| `streakLocal` | `{ run, lastDay }`, the current run on the local day | later `lastDay` wins; equal days take the higher `run` |
| `streakBest` | the best run ever | max |
| `stamps` | `Record<stampId, ISO>` | earliest |
| `memSeededAt` | ISO | earliest |

- `SessionLog` gains an optional `localDay`, written when the session is logged, so a later local-day count never depends on today's time zone.
- `reviews[]` starts to receive `daily`, `feedback` and `stage-certificate` entries; the schema already exists. `ReviewKindSchema` gains `cell-check` and `warmup`. Because `ReviewKindSchema` is a strict enum inside `SnapshotPutSchema` and `BackupFileSchema`, row CM-3b first makes the `reviews` array lenient per entry on every read path (unknown kinds are dropped per entry, as `lenientArray` does in `sync.ts`) and deploys that to the Worker. Every row that writes a new kind is marked W→A.
- `ProgressSummarySchema` gains an optional, lenient `memory` block, computed on the device and carried by the existing snapshot PUT: `{ wordsKnown, readyToRefresh, cellBestCounts: [l1, l2, l3], stageChecks, weekPoints, topDue: up to 8 item ids }`. It feeds reports, the console, the family lantern and `class-review` (sections 7.6, 8).

**One-time seeding on first launch of the new build.** It runs per profile, is idempotent, and is guarded by `memSeededAt`.
1. Every quest done in `questDoneAt` seeds its cell's items: box 2 when the quest scored 3 stars, box 1 otherwise. `n` stays 0, so no seeded item counts in Words known or in mastery above level 1 until it is answered.
2. **Stagger.** Seeded items are spread over `ceil(count / 15)` days from `memSeededAt`, at most 15 a day, ordered by the most recent quest first (the freshest memories are checked while they can still be recovered), then by stage. A learner with all 107 quests done holds about 930 seeded items, spread over 62 days. The spread length is reported in `items.seeded` as a bucket.
3. On any day, the Daily Review draws at most 20 due items, seeded items included, before it offers Keep going.
4. Topic words already in `vocab` are not copied; the engine reads them where they are.
5. Placement `priorityTokens` symbols are seeded at box 1, due on day 1.
6. `cellBest` starts at 1 for every cell done.
7. **Upper-cell cards and stage ceremonies are awarded retroactively.** Each card row (CM-23) awards its own cards from `questDoneAt` when it ships. The Stage Check row (CM-22) shows one summary screen, "You finished Stages 2-3 earlier", which lists whatever cards exist at that time. The summary is shown once, not one modal per stage.
8. **Streak switch-over.** `streakLocal.run` starts at `max(old streakDays, the run recomputed on local days)`, and `streakBest` at the larger of that and any earlier best. The old `streakDays` is still written for older builds, but the new build displays only `streakLocal` and `streakBest`, so a sync from an older device can never make the number drop.

Fixture tests run against snapshots from five historical schema points: before `vocab`, before `questDoneAt`, before `placements`, a current snapshot, and an empty one. Backup-file restore is tested too. A fixture with all 107 quests done asserts that every item has a due day, no day has more than 15 seeded items due, and the spread length is reported.

### 4.9 Accounts shared by several people (owner request A)

Owner request A (same day, its own spec) lets one account hold several learners plus grown-up personas, switched on one device, with a PIN for grown-up personas. This spec depends on only three things from it:

- **All learning state is per learner profile.** That covers memory items, `cellBest`, goals, `dayLog`, streaks, stamps and experiment arms, so switching profile switches all of it. A parent who also learns has a learner profile and counts like any learner.
- **Grown-up personas read and never write learning state.** Reports, the console and lecture mode show mastery, words known, items ready to refresh and Stage Check results for every learner, because parents and teachers see all learner info. Grown-up personas never record review answers.
- **Shared goals are set by a grown-up.** The family weekly goal and the class goal are set in a grown-up persona, so behind the PIN on a shared device. Learner screens show totals only (section 7.6).

On a shared device the memory store is partitioned by profile id. A profile switch flushes the outgoing profile's pending deltas first. Rows CM-12 and CM-61 depend on the request A rows that ship profile partitioning and the grown-up PIN.

## 5. Richer content inside the five categories (Volume 2)

### 5.1 Common rules

- **Volume 2 is a second episode in the same cell.** It uses `volume: 2`, the id `episode:stage<n>-<theme>-v2`, and `episodesFor()` sorted by volume (F-STORY-005). It is switched on by F-STORY-005 PR 5.8 (`MAX_EPISODES_PER_CELL = 2`), row CM-40, which closes that open row.
- **Volume 2 follows F-CURR-001 section 3.1 unchanged**, with these changes:
  - Each cell has three quests.
  - It recycles about 40% of Volume 1's items in new contexts, checked by `lesson-recycle` at 30% or more.
  - Its Practice, Apply and Check triples differ from Volume 1's, and it uses the new formats of section 7.1.
  - It carries at least 2 sourced culture notes per cell.
- **Order.** Nature and Play first, because they are the thinnest columns. Then Food, then Letters, then Holidays. S2-S4 come before S6-S7 in every theme, because those stages have the highest word yield.
- **Sourcing.** Every fact cites a public institution in `sources[]`, from the allowlist in section 6.6. MAR is the final language and culture review. No copy claims native-speaker or expert review.
- **Fact conventions.**
  - UNESCO intangible heritage years are written as "proclaimed X, inscribed Y" where both exist (elements proclaimed as Masterpieces in 2001-2005 were inscribed on the Representative List in 2008), and as "inscribed Y" otherwise.
  - A UNESCO status is claimed only for the exact inscribed element, under its UNESCO name.
  - Institution names are given as of the source's access date. The `culture-source` lint description tells MAR to check this.
  - Shared East Asian heritage is never framed as Korean in origin.
- **Stage 5 book 2 is checked against `content/stories/`.** A new tale must not repeat the topic or the sources of a shipped story. The lint `story-topic-unique` rejects a book 2 story whose topic tags or source URLs match an existing story id. Shipped listen-only stories join book 2 through their new read tiers (row CM-46a) rather than being re-authored.
- **Folk-tale adaptation rule.** A retelling is faithful to the source version but non-graphic: no eating, death or injury on screen ("the tiger chased them"). A tale with a tiger character is narrated by Hoya from outside the tale, and Hoya says this tiger is a character in an old story. The note cites the source version (National Folk Museum of Korea, Encyclopedia of Korean Folk Literature). This rule is on the MAR culture checklist.

### 5.2 Letters & Books (`letters`)

| Stage | Volume 2 content | New formats |
|---|---|---|
| S1 (additions, free) | Letter-shape origins: ㄱ ㄴ ㅁ ㅅ ㅇ drawn from the speech organs, and the three vowel bases ㆍ ㅡ ㅣ (National Hangeul Museum). A Decoding Sprint review. A batchim quest for the 7 representative final sounds. Authored as Stage 1 TypeScript rows (4.2) | Match Shape, Syllable Build, Decoding Sprint |
| S2 | Final-consonant words grouped by the 7 representative sounds; word families (학교, 학생, 학년); sound-change spotting for liaison (책이 [채기]) and nasalization | Syllable Build; the read-plus-meaning spelling round (4.5) |
| S3 | Library and classroom sentences (책을 읽어요, 이름을 써요); why Hangul was made (National Hangeul Museum) | Cloze Pick, Sentence Builder |
| S4 | At the library desk and the bookshop: borrow a book, ask where a shelf is. Adds the missing culture notes (Hunminjeongeum, Hangeul Day on 9 October) | Role Play (read and tap) |
| S5 (book 2) | Read tiers for the 8 listen-only Letters stories (Jikji, the two Annals stories, Tripitaka Koreana and others; row CM-46a). Two new tales: Hangul letters written by Joseon families (언간, National Hangeul Museum), and how the name 한글 came into use (National Hangeul Museum; National Institute of Korean Language). The Jikji note stays neutral about where the book is held today (Bibliothèque nationale de France) | Story Order |
| S6 | Library card, book cover, a Hangeul Day poster, subway station name boards (drawn, generic) | Realia Read, new kind `poster` |
| S7 | Write a postcard (편지 frame) or a one-line diary (일기) from a word bank; trace a word in brush-style letters | My Story, Trace a Word |

### 5.3 Food & Daily Life (`life`)

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Five tastes (달다, 짜다, 맵다, 시다, 쓰다); spoon and chopsticks (숟가락, 젓가락); the table set (밥, 국, 반찬); a market scene | Hidden Heritage (market scene), Card Match |
| S3 | Taste and preference patterns (맛있어요, 좋아해요, ___ 주세요); recipe steps in order | Cloze Pick, Sentence Builder as sequence |
| S4 | Snack bar (분식집) ordering; mealtime set phrases (잘 먹겠습니다 / 잘 먹었습니다) | Role Play |
| S5 (book 2) | Two new tales: making jang, the fermented sauces and pastes (UNESCO, inscribed 2024 as "Knowledge, beliefs and practices related to jang-making in the Republic of Korea"; Korea Heritage Service), and rice cakes through the seasons (National Folk Museum of Korea). Kimjang and Kim Hongdo's market paintings already ship (`gimjang-arirang`, `kim-hongdo-genre-paintings`) | Story Order |
| S6 | Recipe card, a receipt, a packaged-food label, a snack-bar menu (all drawn, no brands) | Realia Read, new kinds `recipe`, `receipt`, `label` |
| S7 | Write my favourite food or the steps of a simple recipe. Adds the missing S7 culture notes on table manners and banchan | My Story |

### 5.4 Holidays & Traditions (`rites`)

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Holiday foods (떡국, 송편, 오곡밥); Dano, Daeboreum and Dongji words; the first-birthday table (돌잔치); 차례 as a reading word with a neutral, sourced note (OD-9) | Pic-Word Match, Syllable Build |
| S3 | Greeting-card sentences (새해 복 많이 받으세요 and its variants); seasonal sentences that use the 24 solar terms (dates from the Korea Astronomy and Space Science Institute). The note says the solar terms are a calendar shared across East Asia (UNESCO inscribed "The Twenty-Four Solar Terms" for China in 2016) | Cloze Pick |
| S4 | Seollal visit exchange: the New Year bow (세배), replies to elders. Kinship and honorific forms follow the National Institute of Korean Language guide 「표준 언어 예절」 | Role Play, greeting pick by occasion |
| S5 (book 2) | Two new tales that keep the "folk stories" promise: Gyeonu and Jiknyeo (견우와 직녀, the Chilseok tale; traditional and public domain), and the Daeboreum full-moon customs (부럼, 달집태우기; National Folk Museum of Korea, Encyclopedia of Korean Seasonal Customs). The Sun and the Moon already ships as a gentle retelling (`sun-and-moon`, Nature), and Dano already ships (`dano-ssireum`) | Story Order |
| S6 | Event poster, festival timetable, a holiday train ticket, a lunar and solar calendar page | Realia Read, new kinds `calendar`, `timetable` |
| S7 | Write a New Year card or a holiday message, choosing the receiver from a word bank (Hoya's grandmother, a friend, a teacher) | My Story |

### 5.5 Nature & Animals (`nature`). It absorbs Weather & Seasons and Animals, so these are not separate packs

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Seasons and weather (봄, 여름, 가을, 겨울; 비, 눈, 바람); native animals (까치, 반달가슴곰; National Institute of Biological Resources). Adds the missing culture notes: the magpie and the tiger in folk painting (minhwa, National Folk Museum of Korea) | Hidden Heritage (four-season scene), Pic-Word Match |
| S3 | 비가 와요, 눈이 와요; comparisons (더 커요, 더 추워요) | Cloze Pick |
| S4 | Weather small talk; planning a hike with national park names (Korea National Park Service). Adds the missing S4 culture notes | Role Play |
| S5 (book 2) | Three new readers: Jeju Volcanic Island and Lava Tubes (UNESCO World Heritage, inscribed 2007), a national park (Korea National Park Service), and a migratory-bird wetland (a Ramsar site; National Wetlands Center of the National Institute of Ecology, with the parent ministry named as of the access date). The rain gauge already ships (`cheugugi-rain-gauge`, Play) and stays there, so no learner's map changes | Story Order |
| S6 | A simplified weather forecast card (Korea Meteorological Administration style, generic), park trail sign, park map | Realia Read, new kinds `forecast`, `map` |
| S7 | Describe my favourite season | My Story |

### 5.6 Play & Crafts (`crafts`). It absorbs Hobbies & Sports and Colours & Shapes

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Traditional games (윷놀이, 제기차기, 공기, 연날리기, 딱지); the five colours (오방색) and shapes | Yut Review (review skin), Hidden Heritage (play scene) |
| S3 | Rule sentences (내 차례예요, 던져요, 이겼어요). 네 차례 stays out of heard rounds (F-CURR-001 section 3.5) | Sentence Builder, Cloze Pick |
| S4 | Inviting a friend to play; rock-paper-scissors (가위바위보) and who goes first | Role Play |
| S5 (book 2) | Two new tales: the Hahoe mask dance, under the UNESCO element "Talchum, mask dance drama in the Republic of Korea" (inscribed 2022), with the Hahoe masks described as a National Treasure (Korea Heritage Service); and hanji, Korean paper (Korea Heritage Service; no UNESCO status is claimed). Ganggangsullae and ssireum already ship (`chuseok-ganggangsullae`, `dano-ssireum`) | Story Order |
| S6 | Game rules card, a craft instruction card, a workshop sign-up sheet (drawn, generic) | Realia Read |
| S7 | Write the rules of my own game ("how to play ~") from a word bank | My Story |

### 5.7 Across all themes

- **Culture notes on screen (row CM-3C).** A "Did you know?" tip at the reward step and on the card back. The four cells with no note get theirs first.
- **Stage 6 realia** grow from 15 scopes to about 30. Every scope gets a `kind`; the 3 scopes without one are fixed.
- **"This week in Korea" (row CM-48).** One micro-lesson a week of about 2 minutes and 5 items, keyed to the calendar. Topics are the 24 solar terms (KASI dates, framed as a shared East Asian calendar) and holidays: Seollal, Daeboreum, Dano, Chilseok, Chuseok, Hangeul Day, Dongji. Sources are the National Folk Museum of Korea and its Encyclopedia of Korean Seasonal Customs. The lessons are bundled and date-gated on the device, so they work offline, and their items enter review. Drops ship in quarterly content PRs of 13.

## 6. New categories: Topic Packs

### 6.1 Why packs on topic pages and not a sixth column

- **Touch target.** A sixth column takes the 320 px cell from 54 dp to about 45 dp, under the 48 dp target.
- **Reach of the theme key.** `ThemeKey` appears in 54 non-test files, in the Worker's hard-coded `/themes` list, in the colour tokens and in `catalog/data.ts`.
- **Cost before it is worth showing.** A coherent column needs 7 cells, about 21 quests.

So the 5 x 7 grid stays the core route, and new categories ship as **Topic Packs** on **topic pages** of the Journey view, which the learner reaches by swiping sideways (owner decision OD-2, 2026-10-21). Pack details:
- **Colour.** A pack borrows a `homeTheme` for its colour tokens and its column glyph, so it needs no new tokens. The first page shows no pack marker, so it stays exactly as today.
- **Progress.** A pack has its own ring, album, cards and badge.
- **Routing.** Packs never move the Journey cursor, and the Next marker stays on the first page. Packs appear on the topic pages, in the Today mission's "Explore" slot, in the planner and in lecture mode. Home has no pack shelf; the Explore slot opens the pack page.
- **Promotion.** A pack that later earns a grid column already has 5 of the 7 stages. That promotion needs its own spec.

**Journey topic pages (row CM-50b; wireframe and mock in CM-D3)**

The Journey view becomes a row of pages that the learner moves between by swiping sideways. Code: `screens/journey/JourneyScreen.tsx`, `components/JourneyGrid.tsx`, and the pure layout in `logic/journey-grid.ts`.

| Part | Rule |
|---|---|
| Page 1 | The five themes and seven stage rows, **exactly as today** (`design/wireframes/journey/grid.md`): the same cells, sizes, glyphs, words, states and rings. Page 1 never scrolls sideways inside itself, so a theme column is never cut off |
| Pages 2 and later | Pack columns, **at most five a page**, in the pack order of section 6.5. With all eight packs: page 2 holds packs 1-5 and page 3 holds packs 6-8. A page with fewer than five packs keeps the same column width and leaves the rest of the row empty; columns never stretch or shrink to fill it |
| Cell size | A pack column uses the theme-column width of the same window (`journeyCellSize`), so a pack cell is 54 dp wide at 320 px, as on page 1, and **never under the 48 dp target**. At 768 px and in the two-pane wide window, pages keep the cell sizes of `grid.md` |
| Rows | Every page has the same seven stage rows at the same heights, so paging keeps the vertical scroll position. A pack level sits in the row of its stage (`levels[].stage`: Stages 2, 3, 4, 6 and 7). Rows 1 and 5 of a pack page hold an empty, unlabelled space, not a "coming later" cell |
| Column header | The pack's name and its `homeTheme` glyph. Tapping it opens the pack page; the target is 48 dp or more |
| Pack cell | Opens the level's cell sheet, like a theme cell. It shows the mastery ring of its pack level (4.4), and its entitlement follows section 6.3 |
| Which packs show | Packs with `status: 'ready'` whose `topicPacks` and `pack.<key>` switches are on. A page with no pack to show is not drawn. With no pack to show, the Journey view is page 1 alone, with no dots and no arrows: exactly today's screen |
| Swipe | A horizontal swipe moves one whole page and snaps to it. The gesture locks direction, so a swipe that starts mostly vertical stays a vertical scroll |
| Visible affordance | A row of page dots under the title, the current dot filled, and an arrow button at the right edge of the column-header row while a later page exists (a matching arrow at the left edge on later pages). The dots and arrows only appear when there are two or more pages |
| Buttons (no swipe needed) | The arrow buttons are 48 dp targets, in the tab order, and do exactly what a swipe does. On web, Left and Right arrow keys change the page while focus is in the column-header row. After a page change, focus moves to the first column header of the new page |
| Screen readers | The arrows are labelled with where they go ("More topics, page 2 of 3", "Back to the five themes"). A page change is announced with the page name and number. Each page is a labelled region ("Five themes", "Topics, page 2 of 3"). Pack cells use the same label pattern as theme cells |
| Reduced motion | With reduced motion on (`useReducedMotion`, `platform/motion.ts`), a page change jumps with no slide; a swipe still works and settles without animation |
| Where it opens | Journey always opens on page 1. The Explore slot and the planner open the pack page, and Back from the pack page returns to the topic page that holds the pack. The current page is kept for the session only; it is never stored or sent |

- **Copy.** Page names, arrow labels and announcements are new strings of CM-50b, in en, es and ko. They name topics and pages and never say "locked", "lost" or anything about age.
- **Wireframe change.** `grid.md` says the 5 columns always fit one screen width with no horizontal scroll. CM-D3 keeps that for page 1 and adds the topic pages beside it, with the 320 px and 768 px layouts, the dots, the arrows, the focus order and the reduced-motion behaviour.

### 6.2 Schema and files

New file `packages/content-schema/src/schemas/topic-pack.ts`:

```ts
TopicPackSchema = z.object({
  id: z.string().regex(/^pack:[a-z0-9-]+$/),
  key: z.string(),                         // 'numbers-time'
  titleEn: z.string(), hoyaIntroEn: z.string(),
  homeTheme: ThemeKeySchema,               // colour and map marker; reuses theme.* tokens
  vocabTopicKey: z.string().optional(),    // content/vocab/<key>.json (art and senses)
  pillarTags: z.array(PillarTagSchema).max(3).default([]),
  levels: z.array(z.object({ stage: StageKeySchema, episodeId: z.string() })).min(1).max(5),
  status: z.enum(['draft', 'ready']),
  sources: z.array(SourceSchema).default([]),
})
```

The schema is the same for the topic pages (OD-2): a page is drawn from `levels[].stage` and the pack order below, and needs no layout field.

**Files**
- Each pack lives in `content/packs/<key>/`, with a `pack.json` and five stage files, `stage-<n>.json`.
- **Pack order.** `content/packs/order.json` lists all eight keys in the order of section 6.5. CM-50a writes it once with every key, so level PRs never touch it. The generated catalogue gives `CatalogPack` an `order` from it, and the topic pages fill five columns a page in that order, skipping any pack that is not shown. A pack directory missing from the list fails the build.
- A stage file uses the lesson cell **body** schema: the 9 `lesson-*` rules, U-1 to U-11, the overlays and MAR all apply.

**Ids**
- Volume 2 episodes are `episode:stage<n>-<theme>-v2`.
- Pack episodes are `episode:pack-<key>-s<n>`; quests are `quest:pack-<key>-s<n>-q<m>`.

**Touchpoints that today reject these ids** (listed so rows CM-40 and CM-50a are sized honestly):

| Touchpoint | Today | Change |
|---|---|---|
| `LESSON_CELL_ID_RE` (`schemas/lesson.ts`) | `^episode:stage[2-467]-(letters\|life\|rites\|nature\|crafts)$` | accept an optional `-v2` suffix (CM-40); a separate `PACK_LEVEL_ID_RE` (CM-50a) |
| `build-lessons.mjs` input layout | one file per cell, `content/episodes/stage-<n>/<theme>.json` | also `stage-<n>/<theme>.v2.json` (CM-40) and `content/packs/<key>/stage-<n>.json` (CM-50a) |
| Lecture `CHOOSER_KEY_RE` (`logic/lecture/home-state.ts`) | `episode:stage[1-7]-[a-z]+` | accept v2 and pack ids; the lecture deck schema accepts them too (CM-40, CM-50c) |
| `CatalogCell` (`catalog/data.ts`) | one `episodeId` built as `episode:${stage}-${theme}` | `episodeIds[]` ordered by volume (CM-40); a separate `CatalogPack` type (CM-50a) |
| Placement (`questsPlacedOutAtLevel`, catalogue quest additions) and route days | hang off the single cell episode | Volume 2 quests of a stage below the placed level are placed out like Volume 1; pack quests are **never** placed out, because packs sit off the route; neither adds route days (CM-40, CM-50a) |
| Journey layout (`logic/journey-grid.ts`, `components/JourneyGrid.tsx`, `screens/journey/JourneyScreen.tsx`) | one page, five columns, no horizontal scroll | a pager: page 1 unchanged, then topic pages of at most five pack columns built from `CatalogPack.order` and `levels[].stage`, with `journeyCellSize` reused for the column width (CM-50b) |

**Integration**
- Packs do not count toward cell capacity, so `cellsOverCapacity` is unchanged.
- Packs are bundled with the app, and the static console reads the generated catalogue, so no Worker route serves packs. `/themes` is unchanged.
- Older clients do not read the new fields, so they ignore packs safely.

### 6.3 Entitlement

- Pack levels sit at Stages 2, 3, 4, 6 and 7, and each follows the entitlement of its stage through `isFreeContent`. The free plan stays all of Stage 1.
- A free learner sees the pack page, its five level titles and one Discover preview page, and a level shows "Not open yet" (F-ENT-003 section 3.11).
- Whether the first quest of each pack is free is open decision OD-3.
- Today the gating switch is off until Stripe Live, so every learner can open every pack.
- No pack changes any price.

### 6.4 The pack template

Every pack follows one skeleton, enforced by the lint rule `pack-skeleton`.

| Level | Stage band | Quests | New items per quest | Formats (rotation) | Realia | Reward |
|---|---|---|---|---|---|---|
| L1 Words | S2 | 3 | 8 or fewer (about 24 core words in total) | Pic-Word Match, Card Match, Syllable Build; Check from the rotation | — | — |
| L2 Patterns | S3 | 3 | 1 pattern and 4 or fewer words | Sentence Builder, Cloze Pick | — | — |
| L3 Exchanges | S4 | 3 | 1 exchange and 4 or fewer words | Role Play, Tap to Respond, Story Order | — | Pack card 1 |
| L4 Real use | S6 | 3 | 6 or fewer words | Realia Read, Type Hangul, Dictation | 3 new realia | — |
| L5 Expression | S7 | 3, plus the Pack Check (10 items, review engine) | 1 frame and 3 or fewer words | Write Frame, My Story | — | Pack card 2, and the pack badge after the Pack Check |

- Each level carries 1 sourced culture note or more.
- Each level recycles 30% or more of its practice and check items (`lesson-recycle`).
- A pack totals 15 quests and about 70 minutes, with about 48 core words and about 16 patterns or exchanges.
- A pack ships as 5 level PRs; the Pack Check ships in the L5 PR.

### 6.5 The eight packs, in order

The table scores each candidate from 1 to 5 on these criteria:

| Column | What it scores |
|---|---|
| Freq | Frequency value: the share of NIKL 「한국어 학습용 어휘 목록」 (2003) grade-A words |
| Reach | Stage reach |
| Unlock | Value it unlocks for other content |
| Motiv. | Motivation |
| Assets | Existing assets |
| Risk | Accuracy and licensing risk; 5 means low risk |

| # | Pack (key, home theme) | Freq | Reach | Unlock | Motiv. | Assets | Risk | Wave | Why |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Numbers & Time** 숫자와 시간 (`numbers-time`, life) | 5 | 5 | 5 | 3 | 4 | 5 | 1 | Korean has two number systems, a known pain point. It unlocks prices, times and dates in every realia scene. Some items can be generated, so the JSON is small. It reuses the `numbers` topic |
| 2 | **People & Family** 사람과 가족 (`people-family`, life) | 5 | 5 | 4 | 4 | 5 | 4 | 1 | Very high frequency. Introductions and polite forms. Heritage learners use it with relatives. It reuses the `family` topic |
| 3 | **Feelings & Me** 마음과 나 (`feelings-me`, crafts) | 4 | 4 | 4 | 5 | 4 | 5 | 1 | Feeds Stage 7 self-expression. Hoya poses already exist |
| 4 | **Town & Travel** 동네와 여행 (`town-travel`, nature) | 4 | 5 | 4 | 4 | 4 | 4 | 2 | Places, transit signs, directions, shops and money (absorbs Shopping & Money), palace and hanok village visits (pillars C2, D1). The most realia-dense pack. It reuses the `travel` topic |
| 5 | **Day & Study** 하루와 배움 (`day-study`, letters) | 5 | 5 | 3 | 3 | 5 | 5 | 2 | Daily routine, school and work words (both 학교 and 회사, for any age). It reuses the `school` topic |
| 6 | **Arts & Music** 예술과 소리 (`arts-music`, rites) | 2 | 3 | 2 | 5 | 2 | 2 | 3 | Gugak instruments, pansori (UNESCO, proclaimed 2003, inscribed 2008; pillar C3), minhwa, hanbok (B4), talchum (UNESCO element name as in 5.6). Traditional material only: no lyrics, artist names or trademarks. It carries an extra MAR checklist and reuses the `k-culture` and `colors` topics |
| 7 | **Science & Inventions** 과학과 발명 (`science-inventions`, letters) | 2 | 4 | 2 | 4 | 4 | 4 | 3 | The rain gauge and the water clock (pillar E3), astronomy (E5), Hangul as a designed script (A1), Donguibogam (UNESCO Memory of the World, inscribed 2009, E4). It reuses the `science` topic and 3 science stories |
| 8 | **Body & Sports** 몸과 운동 (`body-sports`, nature) | 3 | 4 | 2 | 3 | 5 | 3 | 3 | Body words, "아파요" and clinic signs (no medical advice), taekwondo commands (Kukkiwon), ssireum. It reuses the `body` and `sports` topics |

The following ideas are **not** packs:

| Idea | Where it goes instead |
|---|---|
| Weather & Seasons, Animals | Merged into Nature Volume 2 |
| Hobbies & Sports, Colours & Shapes | Merged into Play Volume 2 and Body & Sports |
| Shopping & Money | Merged into Town & Travel L4, after Numbers & Time |
| Korean History & Palaces | **Heritage Trails**: a Library view that groups the 24 stories and later books by the existing pillar tags (row CM-59). It needs no new facts |

### 6.6 Content per pack, and sources

| Pack | L1 Words (S2) | L2 Patterns (S3) | L3 Exchanges (S4) | L4 Real use (S6) | L5 Expression (S7) | Fact sources (public institutions) |
|---|---|---|---|---|---|---|
| Numbers & Time | Sino-Korean 일 이 삼 and native 하나 둘 셋; counters 개, 명, 살. The 살 note says that since June 2023 Korean law uses international age (만 나이) for official purposes | 몇 시예요?, 얼마예요?, dates | Asking the time and a price | Clock, calendar, receipt (round practice amounts in won), a timetable | Hoya's week with times, from a word bank | National Institute of Korean Language (counters, number reading); Ministry of Government Legislation (age); Bank of Korea (banknotes and coins, and their figures: Yi Hwang, Yi I, King Sejong, Shin Saimdang) |
| People & Family | Kinship terms, both sides of the family | 이 사람은 ___예요, possessives | Introducing someone, honorific replies | A name card, a family tree card (Hoya's family) | Introduce someone from Hoya's family or a friend, from a word bank | NIKL 「표준 언어 예절」 (kinship and address terms) |
| Feelings & Me | Feelings and describing words | 기뻐요, 왜냐하면 ~ | Asking how someone feels | A feelings chart, a message card | "Hoya feels ___ today, because ___": the learner picks who (Hoya, a friend, or me) and the feeling from a word bank; every slot has a neutral answer | NIKL Standard Korean Dictionary (word senses) |
| Town & Travel | Places, transit words, directions | ___에 가요, ___이/가 어디예요? | Asking the way, buying a ticket | Subway map (generic), bus sign, palace ticket, price tag | A trip plan from a word bank | Korea Tourism Organization; Korea Heritage Service (palaces and villages); Bank of Korea (money) |
| Day & Study | Routine verbs, school and work words | Time order: 아침에, 그리고, 그 다음에 | Planning the day | A class timetable, a notice board | A daily routine from a word bank | NIKL |
| Arts & Music | Instruments (가야금, 장구), arts words | Describing sound and colour | At a performance | A performance programme, a museum sign | A favourite art form from a word bank | National Gugak Center; UNESCO Intangible Cultural Heritage lists; National Museum of Korea |
| Science & Inventions | Tools and inventions | ___으로 ___을/를 재요 | At a science museum | Museum exhibit labels | An invention, from a word bank | National Museum of Korea; National Hangeul Museum; Korea Astronomy and Space Science Institute; UNESCO Memory of the World |
| Body & Sports | Body parts and sports words | ___이/가 아파요, ___을/를 해요 | At the clinic desk (signs only) and at practice | A clinic sign, a sports schedule | A favourite sport from a word bank | Kukkiwon (taekwondo terms); Korea Heritage Service and UNESCO (ssireum, inscribed 2018 as a joint inscription of both Koreas) |

**Source allowlist** for the `culture-source` lint. A note fails without one of these. Names are checked as of the source's access date:
- National Hangeul Museum
- National Institute of Korean Language
- National Museum of Korea
- National Folk Museum of Korea
- Korea Heritage Service, called the Cultural Heritage Administration before May 2024
- National Gugak Center
- Cheongju Early Printing Museum
- Korea Astronomy and Space Science Institute
- Korea Meteorological Administration
- Korea National Park Service
- National Institute of Biological Resources
- National Institute of Ecology and its National Wetlands Center
- Ramsar Convention Secretariat (Ramsar site status only)
- Korea Tourism Organization
- Bank of Korea
- Ministry of Government Legislation
- Kukkiwon
- UNESCO

**Risk notes**
- **Family and personal sensitivity.** Content never requires the learner's own family, feelings or details. Every write-frame offers a neutral option (Hoya, Hoya's family, a friend), and the cast is Hoya's family.
- **K-culture.** Excludes lyrics, artists and brands.

## 7. Achievement and variety mechanics

### 7.1 New formats

Every format is reading, listening or writing. None records or measures speech. **Every new round kind carries, or the build derives, a fallback round of a shipped kind**, used when its `game.<kind>` switch is off (section 12.2).

| # | Format | Kind | Stages | Build | Fallback when switched off | Notes |
|---|---|---|---|---|---|---|
| F1 | **Cloze Pick** | `cloze-pick` (new) | S2-S7, also as a Check | S-M | Listen & Pick with a text prompt | A sentence with a gap and 3-4 tiles. It reuses the Listen & Pick shell with a text prompt |
| F2 | **Dictation** | Type Hangul `hear` mode | S2-S7, review | M | Type Hangul `see` | The G-3 follow-up: `mode` and `audioRef` are added to `TypeHangulRoundSchema` additively. With no voice it falls back to a `see` round and the sound notice. Only items that pass `dictation-unambiguous` (4.5) |
| F3 | **Syllable Build** | `syllable-build` (schema present) | S1-S2 | M | Listen & Pick on the built block | Initial + vowel + final; trains 받침 |
| F4 | **Match Shape** | `match-shape` (schema present) | S1 | S | Read Pick | Letter-shape origins and confusable pairs (ㅂ / ㅍ, ㅓ / ㅗ) |
| F5 | **Story Order** | `story-order` (new) | S4-S5, packs | S | Story Sequence | Reorder 4 illustrated panels with Korean captions. At least 1 round in 2 is captions only, or has captions that settle the order on their own (lint `story-order-text`), so the order cannot come from the pictures alone |
| F6 | **Role Play** (read and tap) | `role-play` (new) | S4, S6, packs | L | Tap to Respond on the same turns | Blueprint 06 game 9. A branching chat of 4-6 turns: the learner picks a reply bubble and the partner answers. A less natural reply gets Hoya's amber nudge and a retry. Every branch ends well; there is no bad ending. Text and listening only |
| F7 | **Hidden Heritage** | `hidden-heritage` (new) | S2-S5 | L | Pic-Word Match on the same targets | Blueprint 06 game 10, its "signature". Find the named things in a large scene. Each target is given as the Korean word, heard and written with romanization, never as an English label. Scenes are **original** art in theme tokens about subjects that genre paintings show; they are not copies or tracings (OD-10). One scene is 25 KB or less, lazy. Also a projector slide |
| F8 | **My Story** | `my-story` (new) | S7, packs | M | Write Frame on the first frame | Blueprint 06 game 12. 3-5 chained write-frames make a short text. **Slots are word-bank only, with no free text**, as in Write Frame. The finished text is shown at the end as "My page" and is **not kept** after the quest (F-CURR-001 OD-6); a kept keepsake is open decision OD-13. Never sent in telemetry |
| F9 | **Decoding Sprint** | uses `syllable-build` and Listen & Pick | S1 review | M | hidden | An optional 60-second bonus, like the vocab Speed Round. It plays only real syllables from the Stage 1 table and an allowlist the device voice is tested on. Each sprint ends with a short held-out probe of syllables not drilled in any sprint, which G9 measures. The rate is a private personal best, never compared with anyone (OD-8) |
| F10 | **Yut Review** | review skin | any | M | the plain review screen | Right answers throw the yut sticks on a board. The randomness is play only; it never decides a reward |

**Check rotation (`lesson-check-variety`).**
- No game kind may be used for more than 40% of a stage's Checks.
- From Stage 2 on, every Check has at least 1 read-meaning or produce round.
- No two adjacent quests share the same Practice, Apply and Check triple.
- The rule is an **error from day one** for files with `volume` ≥ 2 and for `content/packs/`. For Volume 1 it warns until the re-authoring rows (CM-3A) and becomes an error in CM-3B.

Default Checks by stage:

| Stage | Default Check |
|---|---|
| S2 | Read Pick Meaning and Dictation |
| S3 | Cloze Pick and Sentence Builder |
| S4 | Dialogue reply pick |
| S6 | A realia question |
| S7 | Write Frame |

**Stage 4 gets a different Practice and Apply pair for each theme:**

| Theme | Practice and Apply |
|---|---|
| Letters | Tap to Respond + Role Play |
| Food | Role Play + Sentence Builder |
| Holidays | Story Sequence + Cloze Pick |
| Nature | Tap to Respond + Realia Read (weather card) |
| Play | Role Play + Story Order |

### 7.2 Cards and albums

- **Upper-cell cards.** Each upper cell gives one card in its first volume, 25 in all. This settles F-CURR-001 OD-7 and unblocks the F-CARD-S2..S7 art specs, which were waiting on content that now exists.
- **Category albums.** The cards are grouped into five albums: Letters, Food, Holidays, Nature, Play. A finished album unlocks that category's legendary card. Albums give a goal that runs across stages and pull learners into the thin columns.
- **Packs.** Each pack gives 2 cards and a badge.
- **Retroactive cards.** Each card row (CM-23) awards its cards from `questDoneAt` when it ships (section 4.8).
- **Fairness.** Cards are never random and never purchasable.

### 7.3 Stage ceremonies for Stages 2-7

- **One prize table.** `PRIZE_STAGE = 'stage1'` becomes a per-stage table, `PRIZE_STAGES`.
- **What triggers it.** The stage latch (finishing the stage) triggers the F-MOTION-003 ceremony, a stage card and a "Stage N complete" page. The page appears in reports and in the Passport (7.5). Opening the stage card or that Passport page sends `stage.card_opened` (G5).
- **The Stage Check.** It is offered, never required, and it never blocks Stage N+1. Its best result latches and shows in reports.
- **Names.** The UI says "Stage Check", never "exam". No certificate is issued, which keeps F-CURR-001 section 4 in spirit. Amending section 4 for the checks is OD-1.

### 7.4 Goals, streak and rest days

**Daily goal.** Chosen once and changeable at any time, in plain time words:

| Goal | Plain time | Points |
|---|---|---|
| Light | about 5 minutes | 3 |
| Steady | about 10 minutes | 6 |
| Strong | about 15 minutes | 10 |

- Light is the default if the learner skips the choice. Experiment E4 tests Light against no default.
- Points come from finished activities, not accuracy. Review earns as much as a quest, because it is the most efficient use of a learner's minutes:

| Activity | Points |
|---|---|
| Quest or pack quest | 3 |
| Daily Review | 3 |
| Keep going | 2 |
| Try these again | 2 |
| Story | 2 |
| Word set | 1 |

- Accuracy never removes points.
- Points are kept per local day and per install key in `dayLog` and summed when read, so points earned on a phone and a tablet on the same day add up after sync.

**Weekly goal.** 3, 5 or 7 learning days a week; the default is 3. Home shows 7 dots for the local week, and the count of "steady weeks" is the headline number.

**Streak.**
- The streak stays, counted on the local day (`streakLocal`, section 4.8).
- Any learning activity keeps it: a quest, a Daily Review, a story or a word set. This amends F-REPORT-001 OD-19, where only quest sessions moved the streak (open decision OD-14).
- Up to 2 rest days a local week are granted automatically.
- When a run ends, Home shows "Start a new run" and keeps the best run (`streakBest`). It never says "lost". The displayed number never drops because of a sync.

**Copy.** Copy may nudge positively ("2 minutes to today's goal", "4 items are ready to refresh"). It never uses loss framing, and nothing sends a nagging notification.

### 7.5 Weekly quests and the Passport

- **Weekly quests.** Three quests a local week, picked deterministically from a 20-entry table by ISO week and a hash of the profile id. They need no storage until one is done. Examples: "Finish 2 stories", "Refresh 20 items", "Try a game you have not played", "Visit Nature twice".
- **Passport stamps.** A stamp marks each weekly quest done and each category milestone: first cell, album, mastered column, pack badge.
- **Fairness.** Stamps are deterministic and shown in advance. There are no chests with random contents. Rewards are cosmetic only: stamp art and card-back variants.

### 7.6 Shared goals for a family or a class

- **Family lantern.** A grown-up sets a weekly points target behind the PIN (section 4.9). Every learner profile in the family space fills one lantern.
  - **Where the total comes from.** The Worker sums `memory.weekPoints` from the synced summaries of the family space's learners, so siblings on different devices add up. A full-scope device reads `{ target, total }` from `GET /api/sync/learners/:id/space-goal`. Offline, the lantern shows the last known total plus this device's points not yet synced.
  - Learner screens show only the total ("Your family: 42 of 60 this week"), never who added what. Grown-ups still see each learner in reports, as today.
- **Class goal.** The teacher sets a weekly target: stories read, items refreshed or quests done. The presenter and the learner app show a class-total bar only.
  - It extends the console's `classGoalLine` with a count.
  - Targets live in a new additive D1 table `space_goals(space_id, week, metric, target, created_at)`.
  - **Totals.** Full-scope learners count through their synced summaries. Class-scoped devices (class tablets, SEC-4) send a **counts-only** `POST /api/sync/learners/:id/class-progress`, allowed with `allowClassScope`: `{ week, quests, stories, refreshed, topDue: up to 8 item ids }`. It carries no item states and no per-item history.
- **No rankings.** No individual leaderboard or ranking appears on any learner or presenter screen. This is the F-RVW-001 rule: no public ranking, ever.

### 7.7 The anti-shame checklist

MAR checks every new string and screen against this list:

- no red for a miss
- no visible decay
- no lost streak copy
- no percentage on learner screens
- no per-question timer outside an optional bonus round
- no random rewards
- no purchasable rewards
- no comparison between learners
- no bad ending in a story or a Role Play branch
- no age wording
- no speaking UI
- no emoji

## 8. Lecture-mode reuse

- **Ready lessons follow from the content.** Every Volume 2 episode and every pack level becomes a ready lesson once the id and schema touchpoints of section 6.2 accept it (rows CM-40 and CM-50c), because lecture blocks build from quests.
- **Most new formats need no new slide kind.** Cloze Pick and Story Order map onto the existing question and sentence slides.
- **New slide kinds:**
  - Hidden Heritage (a whole-class scene hunt)
  - Role Play (a read-together chat; the class picks the reply)
  - Yut board
- **New presets:**

| Preset | What it does |
|---|---|
| `by-topic` | Pick a pack or a Volume 2 episode |
| `class-check` | A Cell or Stage Check projected as a class quiz, with no names and no scores per learner on the projector |
| `class-review` | Up to 8 items the class has most often ready to refresh. The data comes from a teacher read route (below). The projector shows the items only |

- **New `game` block** with four presets, none measuring speech:

| Game | How it works |
|---|---|
| `team-relay` | 2-4 teams; the projector shows team totals only |
| `yut-race` | Each right class answer throws the sticks |
| `hidden-heritage-big` | The class finds things in a projected scene |
| `bingo` | A 4 x 4 grid of taught words to copy; extends `copy-on-paper` |

- **Teacher read route (row CM-16).** `GET /api/spaces/:spaceId/learning-summary` is Clerk-authed and space-scoped. It requires the existing `snapshot.read` permission on the space, and returns each learner's `memory` summary block (teachers see all learner info) plus a class aggregate: the top due item ids with how many learners have each one due. Class-tablet learners count through their `class-progress` posts. It returns no item states.
- **Old presenters.** An unknown preset or block decodes to a new `LECTURE_DECODE_FAILURES` code, and the presenter shows the existing update notice. The deck `v` is bumped only if the deck shape itself changes.
- **Not in this spec.** An exit ticket answered on learners' devices needs a live class session, which does not exist.

## 9. Content pipeline and MAR throughput

### 9.1 Remove the bottlenecks (rows CM-5, CM-6, CM-8, CM-50a)

Today every new cell hand-edits or regenerates several shared files: the committed generated modules (`lessons-index.ts`, `lessons-stage<n>.ts`, `stories.generated.ts`, `catalogue-titles.generated.ts`, `lecture-catalogue.generated.ts`, all one-line JSON literals checked with `--check`), `catalog/data.ts`, `CATALOG_VERSION`, the route-day test pins, the presenter font subset and the e2e cell list. Two content PRs that both regenerate the same line conflict, and the merge watcher's update-branch then fails `--check`.

**Generated modules stop being committed (row CM-6).**
- Every module generated from `content/` is gitignored and written by a turbo `generate` task that `dev`, `build`, `typecheck` and `test` depend on, locally and in CI.
- CI replaces `--check` with a determinism test: two runs of the generators give identical bytes.
- With CM-5 and CM-8, lesson and story bodies become one content-hashed JSON chunk per cell, pack level or story, so the generated output is sharded too.

**After CM-6, each shared touchpoint is generated or authored in the content file itself:**

| Item today | After CM-6 |
|---|---|
| Catalogue (`catalog/data.ts` rows) | Generated from `content/` by `build-lessons.mjs` |
| `CATALOG_VERSION` and the quest additions history | Each new quest carries `addedIn`, an integer date stamp `YYYYMMDD`, in its content file. `CATALOG_VERSION` is generated as the largest stamp. The history up to 32 keeps its integers, which are all smaller than any date stamp, so the order holds. A CI check on the up-to-date branch fails if a new quest's stamp is lower than `main`'s current version; the fix is a one-field edit in the PR's own file |
| Route-day pins | Derived from the manifest, with a snapshot test |
| Presenter font subset | Derived from all taught Korean |
| e2e spec | `journey-upper-cell.spec.ts` lists cells and packs from the manifest |

- **Pack scaffolding (row CM-50a).** `scripts/new-pack.mjs <key> --home <theme>` scaffolds `pack.json` and five `stage-<n>.json` skeletons with `status: 'draft'`. Their TODO strings fail lint for `ready`.
- **Target.** A level PR (3 quests plus es and ko overlays) touches only its own files under `content/` and `content/i18n/`. Level PRs can run in parallel worktrees with no shared conflict point.

### 9.2 MAR pipeline per content PR

1. **Author.** A content-skill agent writes the cell or the level.
2. **Three parallel checkers:**
   - **Language:** Korean naturalness, particles, polite register, and romanization through the F-CNT-002 converter.
   - **Culture and facts:** every claim is matched to a `sources[]` URL from the allowlist, using the fact conventions of section 5.1 and the folk-tale adaptation rule.
   - **Learning design:** the lint rules of 9.3, item load, Check variety, sound-change and homophone flags for the device voice (십육 is read [심뉵], 같이 [가치]).
3. **Reviser.**
4. **Third pass.** This keeps the existing `passes >= 3` rule and `reviewedBy: "MAR"`.

- es and ko overlays ship in the same PR, per the coverage ratchet.
- **Throughput target:** 4 content PRs a week (about 12 reviewed quests), with 90% or more passing MAR on the first try. The calendar in section 12.1 is derived from this number. It speeds up only after 4 weeks in a row show that MAR holds the pass rate at a higher rate.
- **Audit:** each week a second MAR re-reviews a random 10% of merged levels. Findings go to the follow-ups list.
- **Status:** content ships `draft` until all passes are recorded.

### 9.3 New lint rules

New rules live in `packages/content-schema/src/lesson-lint.ts` and run in `validate-content.mjs`. They are **errors from day one** for files with `volume` ≥ 2, for `content/packs/` and for new stories. For Volume 1 they warn until CM-3A re-authors it, and become errors in CM-3B.

| Rule | What it enforces |
|---|---|
| `lesson-new-load` | At most 8 new items per quest |
| `lesson-recycle` | At least 30% of a Volume 2 or pack quest's practice and check items come from earlier quests in the same route or pack |
| `lesson-check-variety` | Section 7.1 |
| `lesson-culture-coverage` | At least 2 notes per Volume 2 cell and at least 1 per pack level |
| `culture-source` | Every note has a `sources[]` entry from the allowlist (6.6); its description tells MAR to check institution names as of the access date |
| `items-stable-id` | Section 4.2, including the alias and retired lists |
| `pack-skeleton` | Section 6.4 |
| `dictation-unambiguous` | Section 4.5 |
| `story-order-text` | Section 7.1, F5 |
| `story-topic-unique` | Section 5.1 |
| `review-copy` | No `%` and no "n of m" or "n/m" patterns in learner review strings; no age words, speaking-UI words or emoji in new copy |
| `freq-coverage` (report only) | Share of taught words on the NIKL grade-A list. The list is used at build time only and never bundled; its licence is checked before it is committed (assumption 4) |
| `story-coverage` (report only) | Section 4.7 |

## 10. Bundle and offline budget

**The constraint.** Under Metro web, a lazy `require` defers evaluation, not download. F-CURR-001 assumption 2 found the per-stage modules land in the one web bundle. Growing content therefore needs real separate assets.

**Row CM-5 (lessons) and row CM-8 (stories):**
1. **Split the manifest from the bodies.**
   - `lessons-index` (the start-loaded manifest) keeps only what a screen draws before any chunk loads: ids, English titles, minutes, stage, theme, pack and volume, each episode's quest list and the letters each quest teaches, at 60,000 B raw or less (372 KB before CM-5). Until row CM-40 it also carries the display lines the grid, Home and the lesson page draw (an episode's subtitle, Hoya intro and reward cards, a quest's blurb); CM-40 moves them out, as the decision record below sets out.
   - es and ko titles move to one small title chunk per locale (30,000 B or less), loaded for the active locale only.
   - Story shelf metadata and ids join the manifest. Story tiers, scenes and art move out.
2. **Move bodies out of the JS bundle.** Quest bodies, story bodies, the review-item index, Volume 2 and packs move to static JSON chunks.
   - The PWA build emits them, Workbox precaches them, and they are fetched on demand.
   - Native builds bundle them as assets.
   - Every chunk name is content-hashed, and `pwa-postbuild.mjs` checks each manifest entry against its chunk's hash, so an old service-worker shell never reads newer-shaped JSON.
   - A spike first checks whether Metro async bundles work in the PWA build. If they do, they are used instead of JSON; if not, JSON. The decision is recorded in this section.
3. **Build checks.**
   - The build fails if a content chunk is pulled into the start bundle.
   - The build fails if a chunk is missing from the precache, using the same mechanism as the letter-clip gaps check in `pwa-postbuild.mjs`.
   - A new precache-size report shows the totals.
4. **Fallback.** If the learner precache passes its ceiling, packs switch to runtime caching with a "Save for offline" control (row CM-5B, conditional). The precache is measured first.

**Decision record (row CM-5, 2026-10-21): Metro async bundles, not JSON assets.**
- **Spike.** One stage module behind a literal `import()` in `expo export --platform web` (Expo SDK 52, Metro 0.81). Metro emits it as its own bundle, `_expo/static/js/web/<module>-<md5>.js`, named by the md5 of its content, and leaves it out of the start bundle. If the same module is also reached by a static import or `require`, Metro keeps it in the start bundle and emits an empty bundle (0 B). At runtime the start bundle needs Metro's bundle loader (`__loadBundleAsync`). Expo Router installs it with the whole of `@expo/metro-runtime`; this app does not use Expo Router, so the first spike build failed with "Requiring unknown module". `apps/mobile/src/async-bundles.ts` installs only the loader (`@expo/metro-runtime/src/async-require`), and `index.ts` imports it first. The loader adds 1,948 B to the start bundle. With it, a chunk loads by a script tag, from the precache when offline (PWA offline e2e).
- **Decision.** The async bundles work in the PWA build, so they are used, as item 2 says. JSON assets stay the fallback if a later Expo upgrade breaks them.
- **The PWA on WebKit (the open iOS 14 offline issue).** That issue is the iOS 14.8.1 home-screen PWA, which is WebKit with a service worker that does not always take control, so the web path is the one that matters:
  - With a worker in control, every chunk is in the precache and loads from it offline. Evidence: the offline e2e passes in Chromium, and the same Stage 2 lesson plays in WebKit (Playwright's iPhone 13 project, `E2E_WEBKIT=1`) with the server stopped after one online visit, all 25 cell chunks loading from the precache. (Playwright's WebKit cannot reload a page after `context.setOffline(true)`, "WebKit encountered an internal error", which fails every spec of `offline.spec.ts` that does so, including the ones this row did not touch; the stopped-server run is the WebKit evidence.)
  - Once the first screen is up, the web app loads every cell chunk in the background (`platform/lesson-prefetch.web.ts`; `requestIdleCallback`, or a short timer where Safari has none). The bytes were in the start bundle before, so this adds nothing to memory; it means a session that started online keeps every lesson when the network goes, even with no worker in control, which is the iOS 14 case. A session that starts offline with no worker in control could not open the app before this row either.
  - The window this leaves: with no worker in control, Safari starts the background load 1.5 s after the first screen (`PREFETCH_FALLBACK_MS`; it has no `requestIdleCallback`) and then asks for 27 chunks. A session that loses the network inside that window, before they are in, loses the lessons not yet loaded, which it would have kept before this row, when they were in the start bundle. On a working network the window is a few seconds after the first screen; with a worker in control there is none.
  - A chunk that answers with the app's HTML page, or with another build's chunk, means the page runs an older build than the server (another tab applied an update and its worker dropped this build's chunks, or a deploy landed while no worker was in control). The page reloads once, online only and at most once a minute (`platform/new-build-reload.web.ts`), onto the new build.
  - The host's single-page fallback answers a missing chunk with `index.html` (200). Without `X-Content-Type-Options: nosniff` the browser runs it, Metro finds no module in it, and that is the newer-build case above. If a host rule ever sends nosniff there, the browser refuses the page as a script and fires the same `error` as a network failure. So a script error, when online, asks the chunk URL once more (`cache: 'no-store'`): a 404 or an HTML answer is a newer build and reloads the same way, anything else (the script, a server error, no answer) is a network failure. `pwa-postbuild.mjs` also fails a build whose `_headers` would send nosniff on a lesson chunk, so the plain path stays the one in use.
  - A chunk that cannot load at all (offline with no worker, a request that hangs past 15 s) shows the crash screen, never a reload. Its Try again returns to Home, and opening the lesson loads the chunk again. A load that hangs past 15 s also gives up its pending script (`platform/lesson-chunk-abandon.web.ts`), because Metro's loader keeps a pending load by its path and would hand the same hung request to every later try. The newer-build paths (HTML that runs, HTML refused under nosniff) and the network failure are in the offline e2e, with the worker blocked.
  - The crash screen is the app's own Oops screen, whose copy is calm and blames no one, reused here so this row adds no strings. An in-place retry on the waiting screen (a line that the lesson needs the internet once, and a retry button) needs new strings, so it is row CM-5C in section 17.
  - The iOS 14 issue is therefore not made worse: a lesson that opened offline before this row still opens, apart from the background-load window above.
- **Native builds.** Metro splits bundles only on the web. `npx expo export --platform ios` gives one Hermes bundle (`index-<md5>.hbc`, 10.8 MB) and no `lessons-cell-*` file; the step text of the Stage 2 Letters & Books chunk and the Spanish title chunk are inside it. With no split, Metro's `import()` resolves from the bundle with no request, so the native `buildUrlForBundle` (which throws in production without `location`) is never reached. The loader stays installed on native too, because the dev server's lazy bundles need it.
  - Run evidence: the same production export as plain JS (`--no-bytecode`, 8.99 MB) was evaluated in a JavaScript VM without its entry calls, with a bundle loader that throws if called. The manifest module's own `loadLessonCell` and `loadLessonTitles` loaded all 25 cell chunks and both title chunks, each with the hash the manifest names; the Stage 2 Letters & Books first quest came back with its six steps (intro, discover, practice, apply, check, reward), and the loader was never called. The compiled call is `asyncRequire(id, d.paths)`, and a native dependency map carries no `paths`, so `import()` goes straight to `require.importAll`.
  - Not run: a Release build in the iOS simulator. No simulator UI driver is installed in this environment (no Maestro, idb or Detox) and the app has no deep link into a lesson, so a simulator run cannot open one unattended. The VM run executes the same production module code; Hermes only compiles it to bytecode. A device or simulator check of a Stage 2 lesson stays on the release checklist of the next native build.
- **Layout.** `scripts/build-lessons.mjs` writes `__generated__/lessons-index.ts` (the start-loaded manifest) and `__generated__/lesson-chunks/`:
  - one chunk per ready cell, `lessons-cell-stage<n>-<theme>.ts`, with the steps of its quests, its game scopes and the es / ko glosses of both;
  - one title chunk per locale, `lessons-titles-<locale>.ts`.
- **Manifest fields, and how they stay under their lines.** The manifest built here holds what item 1 lists, the quest list of each episode, `LESSON_TEACHES` (the jamo each quest's Discover step teaches) and, until CM-40, the display lines: each episode's subtitle, Hoya intro and reward cards, and each quest's blurb. The title chunks hold the es / ko text of the same fields. These are what the grid, the Home cards, the lesson page, a closed quest's letters, the results teaser and the placement catalogue draw before any chunk loads, so moving them into the cell chunks would make those screens wait on a fetch.
  - Projected sizes, from the per-entity averages of the measured Volume 1 manifest (an episode 422 B, a quest 174 B, 144 B of loader and hash per cell; without the display lines an episode is 253 B and a quest 81 B) and of the title chunks (es 165 B, ko 176 B per entity; titles only 55 B and 57 B):

    | Content | Manifest (60,000 B line) as built now | Manifest without the display lines | es / ko title chunk (30,000 B line) as built now | es / ko titles only |
    |---|---|---|---|---|
    | Volume 1 (25 cells, 78 quests; measured) | 30,364 B | about 18,900 B | 17,517 / 18,659 B | about 6,100 / 6,300 B |
    | Volume 1 + 2 (50 episodes, 153 quests) | about 58,100 B | about 35,400 B | about 34,000 / 36,300 B | about 11,600 / 12,000 B |
    | Volume 1 + 2 + the 8 packs in the same manifest (90, 273) | about 102,500 B | about 61,900 B | about 60,500 / 64,500 B | about 20,300 / 21,000 B |

  - As built now, the title chunks would pass 80% of their line with the second Volume 2 content row and the manifest with the fourth. So **row CM-40** (before any Volume 2 content row) moves the display lines out of the manifest and the title chunks into one precached "lesson headers" chunk per locale, English included, loaded before the first screen the way the title chunk is (the same 2.5 s wait at most), and gives each Volume 2 episode a body chunk of its own. The manifest then holds what item 1 lists, the quest lists and `LESSON_TEACHES`.
  - Even without the display lines, the packs in the same manifest would pass its line. So **row CM-50a** keeps the pack levels out of the start-loaded manifest: their headers go in a pack manifest chunk, and their titles in a pack title chunk per locale, loaded when the topic pages open (packs sit off the route, OD-2). The 60,000 B line then covers Volume 1, Volume 2 and the story shelf (CM-8), at about 35 KB before the shelf.
- **Content hashes.** Each chunk exports `CHUNK_HASH`, the first 16 hex characters of the sha256 of its data, and the manifest names the same hash. The app refuses a chunk whose hash differs. `apps/mobile/scripts/pwa/lesson-chunks.mjs`, run by `pwa-postbuild.mjs`, fails the build in each of these cases:
  - a manifest entry has no bundle, or more than one;
  - a bundle does not carry the manifest's hash;
  - a bundle's file name is not the md5 of its content;
  - a bundle is missing from the precache;
  - the start bundle does not name every hash;
  - the start bundle carries a chunk.
- **On demand.**
  - The learner app loads the active locale's title chunk before its first screen, and a newly chosen locale applies once its titles are in. Either waits 2.5 s at most (`TITLES_GRACE_MS`): past that, the screens show in the chosen locale with the lesson titles in English, and draw them again when the chunk arrives (the localized memos key on `useLessonTitlesVersion`). A title chunk that failed offline is asked for again when the network is back.
  - The quest player and the game screen load their cell's chunk. They draw only the screen header (the way back) for the frame or two this takes, and a calm "Loading lesson" line if it takes longer than 500 ms. A chunk that cannot load goes to the crash screen, whose Try again returns to Home; opening the lesson again loads the chunk.
  - My Route and the grown-up reports count skills over every quest, so they load every chunk and recompute as each one arrives. Counts only fill.
  - All lessons and the presenter read the whole catalogue, so they mount once every chunk is in. If a chunk fails, they show the crash screen with Try again, never a catalogue with empty lessons.
- **Budget lines on the deploy.** `build:web` passes `--budget`, and `build:web` is also the Cloudflare Workers Builds deploy command. On the deploy's own build (`WORKERS_CI` or `CF_PAGES` set) a budget line only warns, so it never stops a deploy, a hotfix least of all. The pull request's `build:web` in CI fails on it. The chunk checks above fail every build, deploy or not.
- **Measured (release build `pnpm build:web` on 619f4ae2b, the main this row merges onto, no recorded clips).** The start bundle before CM-5 was measured on a384759ca; main has changed only docs since.

  | Measure | Size |
  |---|---|
  | Start bundle | 8,321,783 B raw / 1,921,695 B gzip before CM-5; 7,337,815 B raw / 1,793,420 B gzip after (-983,968 B raw) |
  | Lesson chunks (27 bundles) | 1,014,012 B raw / 151,300 B gzip |
  | Generated lesson modules (`build-lessons.mjs --report`) | 940,591 B raw / 142,270 B gzip |
  | Manifest (`lessons-index.ts`) | 30,364 B raw |
  | Title chunks | es 17,517 B, ko 18,659 B |
  | Largest cell chunk module | Stage 2 Letters & Books, 61,381 B raw / 11,070 B gzip (six quests) |
  | Stage game content | largest is Stage 6, 129,982 B raw / 16,806 B gzip |
  | Learner precache | 35 files, 8,787,329 B |

  - The start bundle line is its size after CM-5 plus a 2,185 B rounding margin: 7,340,000 B. The bundle cannot grow back by more than that margin, and lesson content that slips back into it is also caught by the chunk check above. A row that adds to the start bundle raises the line as a reviewed one-line change with its measurement. CM-8 lowers it with its own measurement.
  - The learner precache line is 11,287,329 B (measured + 2.5 MB), so CM-5B stays untriggered.
  - Lines are absolute, so a row that merged after this measurement and grew the start bundle can turn the next build red with no change of its own. The fix is to re-measure in the row that grew the bundle, not in the row that happens to build next; this row re-measures on its merge-time main before it merges.
  - Audio: the measurement holds no recorded clips (none are bundled yet). The clips are precached, so they count toward the same line. The row that lands the jamo recordings re-measures the precache and moves the line by the clips' measured bytes, as a reviewed one-line change, so recordings never trigger CM-5B on their own.

**Decision record (row CM-8, 2026-10-21): stories on the CM-5 mechanism.**
- **Layout.** `scripts/build-stories.mjs` writes `__generated__/stories-index.ts` (the story shelf, loaded at start) and `__generated__/story-chunks/story-<slug>.ts`, one Metro async bundle per story, with the same hashing (`chunkHash` of `build-lessons.mjs`) and the same `pwa-postbuild.mjs` checks (one bundle per chunk, carrying the shelf's hash, named by the md5 of its content, precached, never in the start bundle). `stories.generated.ts` is gone.
- **What the shelf holds.** Each story without its body: id, state, titles, theme, kind, stage, minutes, Hoya lines, the review gate (`language`, `culture`, the advisory), the shelf, card and reward blocks, the levels of its tiers with their scene counts, and its card's keyword. Schema defaults are left out. The body is `tiers` (scenes and art), `facts`, `keywords`, `summaryEn`, `learningGoalsEn`, `origin`, `verification`, `referenceDisplay`, `errata`, `authorNotes` and the whole `review` block. The shelf episodes and quests are derived from the shelf in the app.
- **On demand.** The reader, its games, Sources and Culture notes wait for their stories' chunks with the lessons' waiting state (`LessonWaiting`: the header for a frame or two, then the calm "Loading lesson" line). Results loads its story's chunk. The same recovery as CM-5 applies: a load times out after 15 s, a chunk of a newer build reloads the page once (online only, at most once a minute), and any other failed chunk goes to the crash screen, whose Try again loads it again. The shelf, Home and the episode page load the chunks of the stories they show, and draw each cover as it arrives (the theme tint stands in). A card face and a card page subscribe to their own story only, and a card page shows its front only (no flip, no Share) until its story's chunk is in, so a blank back is never drawn or shared. All lessons, the presenter and the e2e hook mount once every chunk is in; a failed story chunk shows the crash screen there, never a catalogue without that story. The story index of All lessons and the presenter reads the shelf's levels, so it never depends on a chunk. On the web, once the first screen is up, every story chunk loads in the background with the lesson chunks (`prefetchWhenIdle`, again on back-online), so a session that started online keeps every story when the network goes, as it did while the stories were in the start bundle.
- **Story overlays: a known start-bundle cost.** The es and ko story overlays stay in the start bundle (`OVERLAYS` of `i18n-overlays.generated.ts`: 374,426 B of its 636,321 B of overlay JSON are `story:*` entries, mostly scene narration) and apply to the body once it is in. They grow with each story or tier that CM-46a and CM-46 add. The start bundle line now sits less than 8 KB over its measurement, so that growth fails `build:web --budget` and cannot pass unseen. The row that first needs the room (at the latest CM-46a, before it adds narration) moves the `story:<slug>` narration and caption overlays into the story's chunk (or a per-locale story overlay chunk) and keeps only titles and card text at start, instead of raising the line.
- **Measured (release build, no recorded clips).**

  | Measure | Size |
  |---|---|
  | Start bundle | 7,335,066 B raw / 1,792,320 B gzip before CM-8 (after CM-5); 6,342,002 B raw / 1,572,188 B gzip after (-993,064 B raw; -1,979,781 B raw since before CM-5) |
  | Story chunks (24 bundles) | 983,601 B raw / 241,019 B gzip |
  | Generated story modules (`build-stories.mjs --report`) | 869,644 B raw / 220,524 B gzip; largest chunk `pansori-tales` 46,511 B raw |
  | Manifest (`lessons-index.ts` 30,364 B + `stories-index.ts` 27,116 B) | 57,480 B raw, under the 60,000 B line (2,520 B headroom) |
  | Learner precache | 59 files, 8,775,117 B |

  - The start bundle line (`PRECACHE_BUDGET.startBundleRaw`) is lowered to the CM-8 measurement plus a 7,998 B rounding margin: 6,350,000 B (it was 7,340,000 B after CM-5). The bundle cannot grow back by more than that margin, so neither the stories nor anything else can return to it unseen; a row that adds to the start bundle raises the line as a reviewed one-line change with its measurement.
  - The stories gzip line is 510,000 B: the measured gzip share of the story modules (220,524 / 869,644) applied to the 2,000,000 B raw line (507,155 B), rounded up. The two lines describe the same planned capacity (Sizing basis). Story content that compresses like today's reaches the raw line first; content that compresses worse (inline art, long unrepeated text) reaches the gzip line first, so the gzip line still binds.
  - Manifest headroom is 2,520 B, and each story's shelf entry averages about 1,130 B. The next row that adds stories or grows `lessons-index.ts` (CM-46a, CM-46, Volume 2, the packs) first moves these shelf fields into the story chunk, in this order, instead of raising the 60,000 B line: `hoyaIntroEn` and `hoyaOutroEn` (4,415 B together; only the shelf quest's intro and reward steps read them, so the derived quest reads them from the body), then `review.advisoryNoteEn` (899 B), then `cardKeyword` (2,719 B; the card face then waits for its story's chunk, so it goes last).

**Ceilings.** Each ceiling is a reviewed one-line change with measured numbers in its PR. These are lazy and precached, so they put no weight on start-up (OD-5).

| Budget line | Today | New ceiling |
|---|---|---|
| Start bundle | 8,321,783 B raw before CM-5; 7,337,815 B raw after CM-5; 6,342,002 B raw after CM-8 | must not grow at any row: 6,350,000 B raw, the CM-8 measurement plus a 7,998 B rounding margin (`PRECACHE_BUDGET.startBundleRaw`; 7,340,000 B after CM-5); after CM-5 and CM-8 it shrank by 1,979,781 B raw (the lesson index and the story module left it) |
| `manifestRaw` (English, lessons and story shelf) | 372 KB (whole lesson index) | 60,000 B |
| Title chunk per locale | — | 30,000 B |
| Per cell chunk (one cell's emitted body chunk module: steps, scopes and their glosses), raw / gzip | — (largest at CM-5: 61,381 / 11,070, Stage 2 Letters & Books) | 90,000 / 16,000 (`cellChunkRaw`, `cellChunkGzip`); Volume 2 gets a chunk of its own per cell and volume (CM-40), because both volumes in one chunk would pass the line (about 120 KB for Letters & Books), and CM-40 re-measures the line |
| Core lessons total (Volume 1 + 2), raw / gzip | 950,000 / 140,000 | 1,400,000 / 210,000 |
| Per stage chunk (a stage's game scopes and their glosses, as F-CURR-001 measured its stage module), raw / gzip | 150,000 / 32,000 | 220,000 / 40,000 |
| Per pack chunk, raw / gzip | — | 90,000 / 14,000 |
| All packs, raw / gzip | — | 750,000 / 120,000 (8 packs) |
| Review-item index, raw / gzip | — | 150,000 / 30,000 |
| Per story chunk, raw | — | 70,000 |
| Stories total, raw | 1,255,855 (1,300,000 ceiling), in the start bundle | 2,000,000, precached; gzip 510,000 (set from the CM-8 measurement) |
| Hidden Heritage scene | — | 25,000 B each |
| Learner precache total | 8,787,329 B (CM-5, 35 files, no recorded clips) | measured + 2.5 MB = 11,287,329 B (`PRECACHE_BUDGET.learnerPrecacheRaw`); re-measured when the jamo recordings land |
| Per-quest average, raw | 9,000 | 9,000 (unchanged) |

**Sizing basis.**
- A quest is about 5 KB raw on the compact literal. Volume 2 is 75 quests, about 400 KB raw. The packs are 120 quests, about 650 KB raw.
- Stories: 11 new tales (after the de-duplication of section 5) at about 52 KB each is about 570 KB raw, and read tiers for 10 listen-only stories at about 12 KB each is about 120 KB raw. 1,256 KB + 690 KB is about 1.95 MB, under the 2,000,000 B ceiling.
- About 1.9 MB raw is added over the whole plan, all of it outside the start bundle.
- The 60,000 B manifest line covers Volume 1, Volume 2 and the story shelf once CM-40 has moved the lesson display lines out; the packs keep a manifest chunk of their own (CM-50a), because at the plan's scale they alone would pass it (decision record above).
- CM-46a and CM-46 depend on CM-8, so no story row can grow the start bundle.

**Offline.** The memory store, review engine, goals and "This week in Korea" all work offline. Remote config fails safe (12.2). Nothing in Phases 1-2 adds a network dependency, so the open iOS 14 offline issue is not made worse.

## 11. Telemetry

### 11.1 Rules

- **Payloads.** They carry ids, codes, counts and buckets only: no names, no free text, no learner input. Write Frame and My Story text is never sent. `profileId` rides in the envelope, as rule 3 of TELEMETRY-NAMES-2 says, and is never stored by the rollup.
- **Worker first.** Every name is added to `TELEMETRY_EVENT_NAMES` and deployed to the Worker before the app sends it. The exact-list test is updated.
- **Per-item data stays on the device.** It is aggregated into one daily event.
- **Small groups are hidden.** Dashboards suppress any group with fewer than 20 profiles.

### 11.2 Where the data lands (row CM-70a, Phase 0)

The existing in-memory log stays as transient diagnostics. Metrics land in a new persistent table, written at ingest:

```sql
-- additive; Worker first
CREATE TABLE learning_rollups (
  day     TEXT NOT NULL,     -- UTC day of ingest
  metric  TEXT NOT NULL,     -- 'memory.daily.recallLag', 'session.end.questLeft', ...
  dim     TEXT NOT NULL,     -- content id, game kind, experiment arm, or ''
  bucket  TEXT NOT NULL,
  events  INTEGER NOT NULL,
  PRIMARY KEY (day, metric, dim, bucket)
);
```

- **Aggregate at ingest.** `POST /api/telemetry` keeps its validation. For names on a rollup allowlist, it also adds 1 to the matching rows. No profile id, install key or device id is stored.
- **Profile-days, not profiles.** Each per-profile metric is a once-per-local-day device event (`memory.daily`, `goal.met`), so its `events` on one day equal the profiles that sent it that day. Suppression applies per day (fewer than 20 events hides the group), and a distribution such as the north star's p25, p50 and p75 comes from the counts per bucket.
- **The device emits guardrail inputs itself**, so no per-profile join is needed: `questLeft` and `leftAtKind` on `session.end` give the quit rate, and `durableWeekBucket` in `memory.daily` gives the north star.
- **Experiment arms** are a `dim`, so A/B arms can be compared without an id.
- **Cost.** One upsert per rollup row touched; a daily event touches about 10 rows. Rows written count toward the D1 guardrail of 3.3.

### 11.3 New names: section R of `TELEMETRY-NAMES-2.md`, added by row CM-3

| Name | Payload | Emitted by |
|---|---|---|
| `memory.daily` | `{ hist: [kind x rung x lagBucket x {right, wrong}] counts, lapses, calib: 10 bins (CM-72 only), items, newHeld, minutes, durableWeekBucket, dueVolumeBucket, arms }`. Lag buckets are 0-1, 2-3, 4-7, 8-14, 15-30 and 31+ days. Sent once a local day | CM-12 |
| `items.seeded` | `{ countBucket, spreadDaysBucket }` | CM-12 |
| `review.start` / `review.complete` | existing; kinds `daily`, `feedback`, `stage-certificate`, plus new `cell-check` and `warmup` | CM-14, CM-15, CM-21, CM-22 |
| `mastery.level_up` | `{ cellId, level }` | CM-20 |
| `stage.card_opened` | `{ stage }` | CM-22 |
| `testout.finished` | `{ cellId, passed, items, firstTryCorrect }` | CM-21 |
| `quest.adapt` | `{ questId, dir: 'compact' \| 'scaffold' }` | CM-24 |
| `goal.set` / `goal.met` / `week.goal_met` | `{ daily, weeklyDays }` / `{ points, target }` / `{ days, target }` | CM-17 |
| `decode.sprint.finished` | `{ rateBucket, probeRateBucket, sprintIndexBucket }` | CM-32 |
| `stamp.earned` / `weekly_quest.complete` | `{ stampId }` / `{ questKind }` | CM-60 |
| `pack.opened` / `pack.level_complete` | `{ packId }` / `{ packId, stage }` | CM-50b |
| `family.goal_met` | `{ weekTarget }`, account level, no profile breakdown | CM-61 |
| `space.goal.set` / `space.goal.met` | Worker side | CM-62 |
| `lecture.game.finished` | `{ preset, rounds, teams }` | CM-63 |
| `exp.exposure` | `{ experimentId, arm }` | CM-71 |

`session.end` gains three optional fields, additively, in row CM-3: `questLeft: 0 | 1` (the session ended inside a quest, before its reward step), `leftAtKind` (the game kind code of the round on screen), and `afterWrongStreak: 0 | 1 | 2` (2 meaning two or more wrong first tries in a row just before the end).

**Owner metrics page (row CM-70).** An owner-only console page reads `learning_rollups` and shows counts only, with suppression applied.

### 11.4 Experiments

- **Arm.** `hash(profileId + experimentId) mod 100`, computed on the device, **per profile everywhere**, so learners who share a device get their own arms. It adds no new identifier. It is stable across a learner's devices when the profile is synced; an unsynced profile has a device-local id and may change arm after a restore.
- **Exposure.** `exp.exposure` logs it.

| Id | Test | Primary metric |
|---|---|---|
| E1 | Daily Review in mission slot 3 against at the top of Home | G6 |
| E2 | Daily Review length: 6 against 10 items | G1, G6 |
| E3 | Test out offered against hidden | G3, G4 |
| E4 | Daily goal default Light against no default | G6 |

- **Holdbacks.** A holdback (a group that does not get a feature) is used only for E1 to E4 and lasts at most 4 weeks (OD-11).

## 12. Rollout

### 12.1 Phases

The calendar is derived from the content capacity of 4 PRs a week (9.2). Code rows run in parallel lanes beside it.

| Phase | Content | Calendar |
|---|---|---|
| 0 Foundations | Copy fixes, spec amendments, remote config, telemetry names and the rollup sink, the guardrail evaluator, additive schema, local-day streak, manifest and story split, generated modules, lint, design rows | weeks 1-4 |
| 1 Memory and review | Items, memory store and routes, seeding (shadow 2 weeks), review engine and simulations, Daily Review, warm-up, Try these again, goals, reports | weeks 3-9 |
| 2 Achievement | Mastery ring, Cell Check and test-out, Stage Checks and ceremonies, cards and albums, adaptive pacing | weeks 6-12 |
| 3 Variety | New formats F1-F10 (code, from week 3); Check rotation re-authoring, Hidden Heritage scenes, culture notes, card content (13 content PRs) | code weeks 3-10; content weeks 8-11 |
| 4 Depth | PR 5.8 volumes; Volume 2 in 25 cells, read tiers, Stage 5 book 2, This week in Korea (32 content PRs) | weeks 11-19 |
| 5 Breadth | Pack framework (code, weeks 12-16); Wave 1 (15 PRs), Wave 2 (10), Wave 3 (15); Heritage Trails | content weeks 19-29 |
| 6 Social and measurement | Weekly quests and Passport, family lantern, class goal, lecture games, metrics page, experiments, FSRS shadow | weeks 9-22 |

About 85 content PRs at 4 a week come to about 21 weeks of content, so the plan ends around week 29. Wave 3 packs move earlier only if MAR has held a higher rate for 4 weeks.

**Critical path:** CM-70a and CM-3b, then CM-5 and CM-10, CM-11, CM-12 (and 2 weeks of shadow), CM-13, CM-14.

### 12.2 Kill switches and remote config

**How remote config works (row CM-2)**
- `GET /api/config` is public and read-only. It carries no identifier.
- Flags are stored in a small additive D1 table, `remote_config(flag, on, pct, updated_at, reason)`, which the owner edits and the guardrail evaluator lowers.
- It is cached at the edge with `max-age=300`. The device refetches on app foreground when its copy is older than 15 minutes, honouring `max-age`. So an off reaches active devices within about 20 minutes. For an urgent off, the runbook adds an edge-cache purge step.
- Each flag has two parts:
  - a build-time floor, the existing `parseKillSwitch` on `EXPO_PUBLIC_*`
  - a remote `{ on: false }` override or a `pct` of 0-100, bucketed per profile
- **Remote can only reduce.** It can turn a feature off or lower its percentage. It can never turn on a feature that a build has off.
- **When the config cannot be read:**

| Situation | Value used |
|---|---|
| Offline | The last known value |
| Never fetched | The flag's built-in `pct`: 0 during a ramp, 100 after it |

**Switches** (each flag has a build-time and a remote form):

| Group | Flags |
|---|---|
| Memory and review | `memoryRecord`, `dailyReview`, `questWarmup`, `missedPractice`, `questAdapt` |
| Achievement | `mastery`, `cellCheck` (and test-out), `stageChecks`, `upperCards` |
| Habit | `goals` |
| Content | `volumes`, `topicPacks`, `pack.<key>`, `game.<kind>` (one per new format), `decodingSprint`, `weeklyDrop` |
| Social and lecture | `weeklyQuests`, `familyGoal`, `classGoal`, `lectureGames` |
| Measurement | `fsrsShadow` |

**What "off" does, so no switch bricks shipped content:**

| Switch off | Behaviour |
|---|---|
| `game.<kind>` | Every round of that kind renders its fallback round (7.1). A test turns each `game.<kind>` off and renders every quest |
| `volumes` | Volume 2 entry points hide. Progress, cards and memory states stay. The review engine skips items whose only source is Volume 2 |
| `topicPacks` or `pack.<key>` | The topic pages, or that pack's column, hide; a page left with no pack is not drawn, and with `topicPacks` off the Journey view is page 1 alone with no dots or arrows. Progress, cards and badges stay. The review engine skips items whose only source is a hidden pack |
| `dailyReview`, `questWarmup`, `missedPractice` | The surface hides; mission slot 3 falls back to today's behaviour |
| `memoryRecord` | Answers are not recorded; existing states stay and nothing is deleted |
| `mastery`, `cellCheck`, `stageChecks` | The ring or check hides; latched levels and results stay and show again when it is back on |

### 12.3 Ramp

1. Development, then the owner's own profiles, for 2 days.
2. 10% of profiles for 7 days.
3. 50% for 7 days.
4. 100%.

- **The owner advances each step** by editing `remote_config`.
- **Guardrail evaluator (row CM-70b).** A scheduled Worker (Cron Trigger) runs once a day. For each ramping flag it compares the last 7 days of guardrail metrics (3.3) for the flag's arm with the cohort before the ramp step. On a breach it lowers the flag's `pct` to the previous step, writes the reason to `remote_config.reason`, and the owner metrics page shows it. Lowering is the only automatic action, which matches "remote can only reduce".
- **Shadow first.** `memoryRecord` ships 2 weeks before `dailyReview`. During that time it only records and computes, and its `memory.daily` events land in `learning_rollups`. That sets the baselines for G1 to G3 and checks the seeding's due spread.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Massed practice fakes memory | A box rises at most once per local day and only on a spaced answer (4.3); property and simulation tests S-d and S-e |
| Review load outgrows review time | Due items answered anywhere count; Keep going; credit inside sentences; boxes 6-7 bound maintenance; review-first suggestion; the 60-day simulation gate of CM-13 |
| Review flood after seeding | Spread over `ceil(n / 15)` days, 20 due at most in a Daily Review before Keep going, `memoryRecord` and `dailyReview` switches |
| Counters that drop | Learner screens read only `s`, `r`, `n` and latches (4.4) |
| Memory sync size or cost | Shard rows (1-3 written per sync); server `seq` cursor; seeded states never uploaded; 500-item and 64 KB caps; p95 delta and D1 rows-written guardrails |
| Strict schemas break older clients | Lenient-on-read arrays and keys, Worker first (CM-3b); `BACKUP_VERSION` stays 1 |
| Item ids shift when copy is edited | `items-stable-id` snapshot plus alias and retired lists |
| Device voice only (no recordings; the iOS 14 offline issue is open) | Sound-change and homophone flags; `dictation-unambiguous`; the read-plus-meaning spelling round; Dictation and Decoding Sprint fall back to reading with the existing sound notice; recordings A-9 and A-10 are an owner task and block nothing here |
| Goals or streak become pressure | Light default, automatic rest days, no loss copy, no nagging, MAR anti-shame list |
| Shared goals expose a weaker learner | Totals only on learner and presenter screens |
| Personal disclosure in writing | Word-bank slots only, neutral options in every frame, nothing kept (OD-6, OD-13) |
| Heritage accuracy at volume | Source allowlist lint, fact conventions, folk-tale adaptation rule, MAR culture pass, weekly 10% audit, `draft` until passes |
| Duplicate stories | `story-topic-unique` lint against `content/stories/` |
| Hidden Heritage art cost and size | Original token scenes, 25 KB each, 1 scene before scaling to 5 |
| Confusion between packs and the route | Packs never move the Journey cursor, which stays on page 1; topic pages are named "Topics" and the first page "Five themes" |
| Learners miss the topic pages, or cannot swipe | Page dots and an edge arrow whenever a later page exists; 48 dp arrow buttons, arrow keys on web and screen-reader labels do what the swipe does (6.1) |
| Pressure to widen `ThemeKey` | Recorded decision: packs use `homeTheme`; promoting a pack to the grid needs its own spec |
| A kill switch bricks content | Fallback rounds and defined off behaviour (12.2), with a test per switch |
| Author and MAR throughput (25 Volume 2 cells, 8 packs, about 195 quests) | Generated modules not committed (9.1), parallel level PRs, a calendar derived from 4 PRs a week |
| Overlay debt (about 150 strings per level in es and ko) | Same-PR overlays under the ratchet |
| Small user base makes A/B tests weak | Directional staged rollouts (3.4) |

## 14. Tests

**Scheduler and engine** (unit and property tests with fast-check):
- box moves follow F-VOC-005 P3 with the spacing rule; any number of right answers in one day raises the box by 1 or less
- rung promotion, the `r` and `c` split, the miss-at-produce rule, and the no-voice two-rung ladder
- typing tolerance (NFC, spaces, a one-jamo slip counts as hinted)
- credit inside sentences
- selection order (lowest box first), interleaving caps when the pool allows
- determinism under a seed
- end-early
- the 60-day simulation scenarios S-a to S-e (4.3)

**Merge** (Worker and client):
- commutative and idempotent for memory item fields (with the tie-break), `cellBest`, `dayLog` (summed per install key), `streakLocal`, `streakBest`, `stamps`, `testedOut`, `cellCheckAt` and `stageCheckAt`
- a produce miss on device A merged with an older state on device B
- the Worker preserve rule when keys are absent
- older-client snapshots round-trip; a snapshot or backup with an unknown review kind drops that entry and keeps the rest
- a sync from an older build never lowers the displayed streak

**Worker**:
- memory routes: full-scope device only (`403 scope_limited` on a class device), a 501-item call returns 413, last-writer-wins conflict, `seq` paging including a late upload with an old `at`, rows written per call
- the migration SQL is additive
- `/api/config` is public, carries no identifier, has cache headers, and can only reduce
- `learning_rollups` ingest stores no id; suppression under 20
- the guardrail evaluator lowers a breached flag and only lowers
- `space_goals` totals, `class-progress` (counts only, class scope allowed), `space-goal` read, `learning-summary` (permission checks)

**Seeding fixtures**:
- five historical snapshot points plus backup restore
- all 107 quests done: every item dated, no day over 15 seeded, spread reported
- seeded states are never uploaded and derive the same on two devices
- streak switch-over
- the retroactive summary screen shown once; each card row awards its own cards

**Time zones**:
- the suite runs under `TZ=UTC`
- fixed-clock tests at UTC+14, UTC-12, `Asia/Seoul` and `America/Los_Angeles` across DST, for streak, rest days, due days, the spacing rule, goals and weekly quests

**Content**:
- the lint rules of 9.3
- U-1 to U-11 extended to Volume 2 and packs
- `pack-skeleton`
- generated catalogue parity and generator determinism
- the `addedIn` stamp check
- route-day snapshot
- presenter-font coverage
- every quest renders with each `game.<kind>` off

**e2e** (Playwright web):
- Daily Review from slot 3, including offline, and Keep going
- warm-up
- Try these again
- Cell Check and test-out
- Stage 2 Check and ceremony
- the retroactive summary
- goal ring and weekly dots
- each new format
- the topic pages: reached by swipe and by the arrow buttons, page 1 unchanged, a pack level opened from page 2, Back returns to the same page, and `topicPacks` off shows page 1 alone
- family lantern across 2 learner profiles with PIN-gated target setting
- lecture `team-relay`, `class-check` and `class-review`

**Visual and accessibility**:
- grid with mastery rings at 320 px, cells still 54 dp
- 48 dp targets on the topic pages (pack cells, column headers and arrow buttons at 320 px) and in the new games
- reduced-motion ceremonies and page changes with no slide
- keyboard paging on web and focus moving to the new page's first column header
- contrast of theme tokens
- screen-reader labels for rings ("Mastered", "Ready to refresh", "New volume"), and for the page arrows and page-change announcements

**Budgets**: the ceilings of section 10, the start bundle and manifest enforced in CI, and the chunk hash check.

**i18n**: the en, es and ko ratchet in every PR; the `review-copy` lint.

## 15. Out of scope

- A sixth grid column or widening `ThemeKey`.
- Any change to page 1 of the Journey view to make room for packs: no narrower cells and no pack marker on the theme columns.
- Speaking measurement or speaking UI of any kind; `voice-echo` stays banned.
- Certificates.
- Individual leaderboards.
- Random reward chests.
- Purchasable rewards.
- Live classroom sessions on learners' devices, including the exit ticket.
- Switching the scheduler to FSRS. Only the shadow is in scope.
- Recorded audio. A-9 and A-10 are an owner task and block nothing here.
- Stripe Live and any price change.
- Promoting a pack to the grid.
- Volumes beyond 2.
- A kept My Story keepsake (OD-13; it needs a privacy review and its own spec).
- Companions other than Hoya; blueprint 04 section 2.4's five companions are a later spec.

## 16. Owner decisions (all decided 2026-10-21)

The owner decided every row on 2026-10-21 (section 21). OD-2 changed from the proposed default; OD-4 and OD-6 were confirmed explicitly; every other row is decided as proposed.

| OD | Question | Decision (2026-10-21) | Alternative not taken | Affects |
|---|---|---|---|---|
| OD-1 | Stage Checks for Stages 2-7 against F-CURR-001 section 4, which excluded stage exams and certificates | **Yes**: an optional, never-blocking "Stage Check" with a ceremony and a stage card; no certificate; amend section 4 in CM-0b | No checks; ceremony and card only | CM-22 |
| OD-2 | Where new categories live | **Changed by the owner: Topic Packs on topic pages reached by a horizontal swipe of the Journey view.** Page 1 keeps the five themes exactly as today; later pages hold up to five pack columns each, never under 48 dp at 320 px, with page dots, an edge arrow, arrow buttons for keyboard and screen-reader users, and no slide under reduced motion (6.1). The pack data model is unchanged | An Explore shelf under the Journey grid and on Home (the proposed default); a sixth grid column (cells under 48 dp at 320 px; 54-file refactor) | CM-D3, CM-50a, CM-50b |
| OD-3 | Pack entitlement | **Levels follow their stage** (S2+ paid once gating is on); free learners see the pack page and one Discover preview | The first quest of each pack is free (widens the free plan beyond Stage 1) | CM-50a, CM-50b |
| OD-4 | First wave of packs | **Confirmed: Numbers & Time, People & Family, Feelings & Me** | Any other order of section 6.5 | CM-51 to CM-53 |
| OD-5 | Lesson and story budget ceilings | **Raise as in section 10**; all lazy and precached; the start bundle must not grow | Keep today's ceilings (no Volume 2, book 2 or packs fit) | CM-5, CM-8, CM-40, CM-46, CM-50a |
| OD-6 | Home headline number | **Confirmed: weekly dots and steady weeks**, with the local-day streak kept below them and 2 automatic rest days a local week | Keep the streak as the headline | CM-17 |
| OD-7 | Family lantern and class goal | **On**, totals only, target set by a grown-up behind the PIN | Off until asked | CM-61, CM-62 |
| OD-8 | Decoding Sprint, a 60-second optional bonus | **Yes**, optional, private personal best, like the vocab Speed Round | No timed activity outside the Speed Round | CM-32 |
| OD-9 | 차례 (ancestral memorial rite) in Holidays Volume 2 | **Teach as a reading word with a neutral, sourced note** (National Folk Museum of Korea) | Keep it out, as in Volume 1 (F-CURR-001 OD-9) | CM-45 |
| OD-10 | Hidden Heritage art | **Original token-coloured scenes** about genre-painting subjects, with source facts on the card back | Use public-domain museum images under KOGL Type 1 (larger files, licence tracking) | CM-36, CM-37 |
| OD-11 | Holdbacks | **Only for experiments E1-E4, at most 4 weeks**; otherwise staged rollouts with before and after cohorts | No holdbacks at all | CM-71 |
| OD-12 | Stage one-liner wording | **S4** "Read and answer short everyday exchanges." · **S5** "Read heritage stories and tales with Hoya." (folk stories return once the book 2 tales ship) · **S6** "Take Korean out into the world: menus, signs and short messages." · **S7** `anchorSkillEn` "Write a short personal introduction" | Other wording | CM-1 |
| OD-13 | My Story keepsake | **Not kept**: "My page" is shown at the end and cleared, as F-CURR-001 OD-6 | A kept, device-only keepsake page (needs a privacy review row and its own spec) | CM-38 |
| OD-14 | What keeps the streak | **Any learning activity** (quest, Daily Review, story, word set); amend F-REPORT-001 OD-19 in CM-0b | Quest sessions only, as F-REPORT-001 OD-19 today | CM-4, CM-17 |

## 17. PR breakdown

Sizes: S under about 300 changed lines, M about 300-1,000, L above 1,000 (split if it grows past about 2,000). "W→A" means the Worker deploys first, then the app. Strings are new English UI strings, each with es and ko in the same PR. "×n" rows count as n PRs.

### Phase 0: foundations

| PR | Title (conventional commit) | Size | Depends on | Strings (en + es + ko) | Tests |
|---|---|---|---|---|---|
| CM-0 | `docs(specs): F-CURR-002 category expansion and mastery` (this spec, README index line) | S | — | 0 | — |
| CM-0b | `docs(specs): amend F-RVW-001 (age wording, engine on F-CURR-002), F-CURR-001 section 4 (Stage Checks) and U-8 (spelling round), F-QUEST-002 L13, F-VOC-005 P3 (spacing rule), F-REPORT-001 OD-19 (OD-14), TELEMETRY-NAMES-2 section R` | S | CM-0 | 0 | — |
| CM-1 | `fix(mobile,i18n): stage one-liners and Stage 7 anchor skill follow the standing rules (F-CURR-002 OD-12)` | S | — | 4 changed | stages copy test; `review-copy` patterns |
| CM-2 | `feat(backend,mobile): public remote config in D1 with off-only overrides, per-profile percentage ramps and a foreground refetch (F-CURR-002)` (W→A) | M | — | 0 | Worker route, cache headers, only-reduce, client fallback order, pct bucketing per profile, refetch age |
| CM-3 | `feat(content-schema,backend): telemetry names section R and session.end fields (F-CURR-002)` (Worker first) | S | CM-0b | 0 | exact-list test |
| CM-3b | `feat(content-schema,backend): additive snapshot fields, review kinds cell-check and warmup, SessionLog localDay, summary memory block, all lenient on read (F-CURR-002)` (Worker first) | M | CM-0b | 0 | unknown kind dropped per entry in snapshot, backup and Rescue Code paths; Worker preserve rule; older-client round-trip |
| CM-4 | `fix(mobile): streak on the local day, streakLocal and streakBest, no-drop switch-over (F-CURR-002 OD-14)` (W→A) | M | CM-3b | 0 | TZ fixed-clock tests, switch-over, an older-build sync never lowers the display |
| CM-5 | `perf(content): lesson manifest split, per-locale title chunks, content-hashed precached bodies, budget lines, precache report (F-CURR-002)` | L | — | 0 | start-bundle and manifest budgets, precache gaps, chunk hash check, lazy-load test, offline e2e |
| CM-5B | `feat(mobile): Save for offline for packs` (only if the precache ceiling is crossed) | M | CM-5 report | 4 | offline e2e |
| CM-5C | `feat(mobile): in-place retry on the lesson waiting screen when a chunk needs the internet (F-CURR-002 §10)` | S | CM-5 | about 2 | render test from a cold store, offline e2e with the worker blocked |
| CM-6 | `build(content): generated modules no longer committed, turbo generate task, generated catalogue, addedIn date stamps for CATALOG_VERSION, derived route-day pins, presenter font and e2e cell list (F-CURR-002)` | L | CM-5 | 0 | generator determinism, catalogue parity, stamp check, route-day snapshot, font coverage |
| CM-7 | `feat(content-schema): lint rules (errors for Volume 2, packs and new stories; warnings for Volume 1) and coverage reports (F-CURR-002)` | M | — | 0 | rule unit tests with fixtures |
| CM-8 | `perf(content): stories out of the start bundle, shelf metadata in the manifest, per-story precached chunks (F-CURR-002)` | L | CM-5 | 0 | start bundle shrinks, per-story budget, offline story e2e |
| CM-70a | `feat(backend): learning_rollups table and aggregation at ingest (F-CURR-002)` (Worker first) | M | CM-3 | 0 | no id stored, profile-day counting, suppression, additive SQL |
| CM-70b | `feat(backend): daily guardrail evaluator on a Cron Trigger that lowers a breached ramp (F-CURR-002)` | M | CM-2, CM-70a | 0 | breach lowers one step, only lowers, reason recorded |
| CM-D1 | `design(reviews): Daily Review and Keep going, mastery ring, Cell and Stage Check, ceremony, goal ring and weekly dots (F-CURR-002)` | M | CM-0 | 0 | MAR design review |
| CM-D2 | `design(minigame): Cloze Pick, Dictation, Syllable Build, Match Shape, Story Order, Role Play, My Story, Yut Review (F-CURR-002)` | M | CM-0 | 0 | MAR design review |
| CM-D3 | `design(journey): Hidden Heritage scene style, Journey topic pages by horizontal swipe with page dots and arrow buttons, pack page, Passport; grid.md amended for the topic pages (F-CURR-002 OD-2)` | M | CM-0 | 0 | MAR design review |

### Phase 1: memory and review

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-10 | `feat(content-schema,content): review items from lessons, Stage 1 tables and stories, frozen ids, alias and retired lists (F-CURR-002)` | L | CM-5, CM-8 | 0 | `items-stable-id` snapshot, Stage 1 parity, extraction coverage over all three sources |
| CM-11 | `feat(backend): memory_shards table, delta routes with a seq cursor, backup and Rescue Code memory key (F-CURR-002)` (W first) | M | CM-10, CM-3b | 0 | full scope only, 413 cap, LWW with tie-break, OR and max merge, `seq` paging, rows written, CPU benchmark, additive SQL |
| CM-12 | `feat(mobile): memory store, spacing rule, recording from every surface, seeding, shadow mode (F-CURR-002)` | L | CM-2, CM-3, CM-3b, CM-11, CM-70a, owner request A profile rows | 0 | seeding fixtures (5 points and the all-done fixture), derived seeding, profile partition and flush on switch, `memory.daily` payload |
| CM-13 | `feat(mobile): review engine: selection, interleaving, rungs by kind, credit inside sentences, 60-day simulation gate (F-CURR-002)` | L | CM-12 | 0 | property tests, determinism, simulations S-a to S-e |
| CM-14 | `feat(mobile): Daily Review, Keep going and mission slot 3 (F-CURR-002)` | M | CM-13, CM-D1 | about 16 | e2e incl. offline, stars-only result, end-early, review-first suggestion |
| CM-15 | `feat(mobile): quest warm-up and Try these again (F-CURR-002)` (W→A for `warmup`) | M | CM-13, CM-3b | about 6 | U-5 unchanged, e2e |
| CM-16 | `feat(content-schema,backend,web,mobile): summary memory block, teacher learning-summary route, reports show words known, ready to refresh and mastery (F-CURR-002)` (W→A) | L | CM-3b, CM-12, CM-20 | about 10 | report builder tests, route permission tests, console e2e |
| CM-17 | `feat(mobile,backend): daily and weekly goals, rest days, points per install key (F-CURR-002)` (W→A for new fields) | L | CM-4, CM-3, CM-3b, CM-D1 | about 16 | points accrual and sum, rest days, TZ tests, merge |

### Phase 2: achievement

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-20 | `feat(mobile): mastery levels on best box, started-volume denominator, cellBest latch, grid ring, words known milestones (F-CURR-002)` | M | CM-12, CM-D1 | about 8 | derivation reads only monotonic fields, latch never drops, New volume marker, 320 px visual, a11y labels |
| CM-21 | `feat(mobile): Cell Check and test-out (F-CURR-002)` (W→A for `cell-check`) | L | CM-13, CM-20, CM-3b | about 10 | seeding by result, untested at box 1, entitlement, `routeNext` skip, e2e |
| CM-22 | `feat(mobile): Stage Checks for Stages 2-7, PRIZE_STAGES, ceremony, retroactive summary listing existing cards (F-CURR-002)` | L | CM-21, OD-1 | about 12 | prize table, summary once, never blocks, `stage.card_opened`, e2e |
| CM-23 ×3 | `feat(cards): upper-cell cards, category albums and their retroactive award, Stages 2-3 / 4 / 6-7 (F-CARD-S2..S7, F-CURR-002)` | L each | CM-22 | about 60 each (card names and backs) | card-award tests including retroactive, album legendary, art budget |
| CM-24 | `feat(mobile): adaptive pacing in quests, compact Discover and scaffold (F-CURR-002)` | M | CM-12 | about 2 | compact and scaffold rules, standard-path U-5, adapted-path U-11 |
| CM-25 | `feat(mobile): Stage Jump Ahead; amend F-PLC-001 ceiling (F-CURR-002)` | M | CM-21 | about 6 | placement fixtures |

### Phase 3: variety

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-30 | `feat(mobile): Cloze Pick game, fallback and lecture mapping (F-CURR-002)` | M | CM-D2, CM-2 | about 4 | renderer, reducer, fallback, Playwright |
| CM-31 | `feat(mobile,content-schema): Type Hangul hear mode (Dictation) and the dictation-unambiguous rule (F-CURR-002)` | M | CM-D2, CM-2 | about 3 | additive schema, fallback to `see`, homophone lint, Playwright |
| CM-32 | `feat(mobile): Syllable Build game and Decoding Sprint with a held-out probe (F-CURR-002 OD-8)` | M | CM-D2, CM-3 | about 6 | allowlist test, probe drawn from undrilled syllables, private best, Playwright |
| CM-33 | `feat(mobile,content): Match Shape game and Stage 1 letter-shape origins (F-CURR-002)` | M | CM-D2 | about 4 | sources, Stage 1 additions unit tests, Playwright |
| CM-34 | `feat(mobile): Story Order game (F-CURR-002)` | S | CM-D2 | about 3 | `story-order-text`, fallback, Playwright |
| CM-35 | `feat(mobile): Role Play read-and-tap game (F-CURR-002)` | L | CM-D2 | about 5 | branch reducer, every branch ends well, no speaking UI, fallback, Playwright |
| CM-36 | `feat(mobile): Hidden Heritage engine, first scene (Food) and slide kind (F-CURR-002 OD-10)` | L | CM-D3 | about 5 | hit areas a11y, Korean-word targets, 25 KB budget, fallback, Playwright |
| CM-37 ×4 | `feat(content): Hidden Heritage scenes for Letters, Holidays, Nature, Play (F-CURR-002)` | M each | CM-36 | about 10 each | scene budget, MAR culture pass |
| CM-38 | `feat(mobile): My Story game, word-bank slots, not kept (F-CURR-002 OD-13)` | M | CM-D2 | about 5 | no free text, nothing stored (P-1 extended), fallback, Playwright |
| CM-39 | `feat(mobile): Yut Review skin (F-CURR-002)` | M | CM-14, CM-D2 | about 4 | randomness never decides reward, Playwright |
| CM-3A ×5 | `content(stage<n>): Check rotation re-authoring for S2, S3, S4 (with de-duplication), S6, S7 (F-CURR-002)` | M each | CM-30, CM-31, CM-34, CM-35, CM-10 | overlays only | U-1..U-11, `lesson-check-variety`, retired ids listed |
| CM-3B | `chore(content-schema): Volume 1 lint rules from warn to error (F-CURR-002)` | S | CM-3A | 0 | rule tests |
| CM-3C | `feat(mobile,content): culture notes on screen, notes for the four empty cells (F-CURR-002)` | M | CM-7 | about 3 + notes overlays | `culture-source`, e2e |

### Phase 4: depth (Volume 2)

CM-40 also carries two items of section 10 (decision record, "Manifest fields"): it moves the lesson display lines (an episode's subtitle, Hoya intro and reward cards, a quest's blurb) out of the start-loaded manifest and the title chunks into one precached lesson headers chunk per locale, English included, loaded before the first screen like the title chunk; and it gives each Volume 2 episode a body chunk of its own. Both land before the first Volume 2 content row, with the measured numbers in its PR.

Formats used decide extra dependencies: S2 rows need CM-36/37 (Hidden Heritage) and CM-32 (Syllable Build) where their table uses them; S4 rows need CM-35 (Role Play); S6 rows need CM-47 (realia kinds); S7 rows need CM-38 (My Story); Play S2 needs CM-39 (Yut Review). CM-3B is not a dependency, because the lint is an error for Volume 2 files from day one.

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-40 | `feat(mobile,content-schema,web): two volumes per cell: id regexes, build-lessons v2 input, CatalogCell.episodeIds, placement and route days, lecture chooser, Vol 1 and Vol 2 on the cell sheet (F-STORY-005 PR 5.8, F-CURR-002)` | L | CM-5, CM-6 | about 3 | capacity, `episodesFor` order, placement of v2 quests, chooser accepts v2, e2e; the lesson headers chunk and a body chunk per volume (below) with their manifest, title chunk and cell chunk lines |
| CM-41 ×5 | `content(stage<n>): Nature Volume 2, S2 / S3 / S4 / S6 / S7 (F-CURR-002)` | M each | CM-40, CM-30, CM-31, plus the format rows above | overlays | U-rules, recycle, sources, MAR |
| CM-42 ×5 | `content(stage<n>): Play Volume 2 (F-CURR-002)` | M each | same | overlays | same |
| CM-43 ×5 | `content(stage<n>): Food Volume 2 (F-CURR-002)` | M each | same | overlays | same |
| CM-44 ×5 | `content(stage<n>): Letters Volume 2 (F-CURR-002)` | M each | same | overlays | same |
| CM-45 ×5 | `content(stage<n>): Holidays Volume 2 (F-CURR-002 OD-9)` | M each | same | overlays | same |
| CM-46a | `content(stories): read tiers for the 10 listen-only stories (F-CURR-002)` | M | CM-8 | overlays | story checks, per-story budget |
| CM-46 ×5 | `content(stage5): book 2 tales for Nature, Food, Holidays (folk tales), Play, Letters (F-CURR-002)` | M each | CM-8, CM-34, CM-46a | overlays | story pipeline, `story-topic-unique`, adaptation rule, coverage report, MAR |
| CM-47 | `feat(mobile,content-schema): realia kinds recipe, receipt, label, forecast, calendar, timetable, map, poster (F-CURR-002)` | M | — | about 8 | renderer per kind, art budget |
| CM-48 | `feat(mobile,content): This week in Korea, engine and first 13 drops (F-CURR-002)` | M | CM-12 | about 4 + overlays | date gating offline, TZ tests |

### Phase 5: breadth (Topic Packs)

Each pack is 5 level PRs; the Pack Check ships in the L5 PR. Level dependencies by format: L1 needs CM-32 (Syllable Build); L2 needs CM-30 (Cloze Pick); L3 needs CM-34 and CM-35 (Story Order, Role Play); L4 needs CM-31 and CM-47 (Dictation, realia kinds); L5 needs CM-38 (My Story) and CM-13 (Pack Check).

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-50a | `feat(content-schema,scripts): Topic Pack schema, PACK_LEVEL_ID_RE, CatalogPack, build-lessons pack input, pack order list, placement and route-day rules, new-pack scaffold (F-CURR-002 OD-2, OD-3)` | L | CM-6 | 0 | schema, `pack-skeleton`, packs never placed out, every pack directory in `order.json`, scaffold, pack levels outside the start-loaded manifest (section 10: a pack manifest chunk and a pack title chunk per locale, loaded with the topic pages) |
| CM-50b | `feat(mobile): Journey topic pages by horizontal swipe, with page dots, arrow buttons and keyboard paging, and the pack page (F-CURR-002 OD-2)` | M | CM-50a, CM-20, CM-D3 | about 18 | page layout (page 1 unchanged, five columns a page, 54 dp at 320 px), swipe direction lock, buttons and arrow keys, screen-reader labels, reduced motion, entitlement, `topicPacks` and `pack.<key>` off behaviour, e2e |
| CM-50c | `feat(mobile,web): lecture and console chooser accept pack levels (F-CURR-002)` | S-M | CM-50a | about 2 | chooser regex, deck schema, old-presenter decode failure |
| CM-51 ×5 | `content(packs): Numbers & Time, levels 1-5 with the Pack Check in L5 (F-CURR-002)` | M each | CM-50a, CM-50b, plus the level rows above | overlays | U-rules, sources, MAR |
| CM-52 ×5 | `content(packs): People & Family (F-CURR-002)` | M each | same | overlays | same |
| CM-53 ×5 | `content(packs): Feelings & Me (F-CURR-002)` | M each | same | overlays | same, neutral options in every frame |
| CM-54 ×5 | `content(packs): Town & Travel (F-CURR-002)` | M each | same, CM-51 | overlays | same |
| CM-55 ×5 | `content(packs): Day & Study (F-CURR-002)` | M each | same | overlays | same |
| CM-56 ×5 | `content(packs): Arts & Music, extra MAR checklist (F-CURR-002)` | M each | same, CM-36 | overlays | same |
| CM-57 ×5 | `content(packs): Science & Inventions (F-CURR-002)` | M each | same | overlays | same |
| CM-58 ×5 | `content(packs): Body & Sports (F-CURR-002)` | M each | same | overlays | same |
| CM-59 | `feat(mobile): Heritage Trails library view by pillar (F-CURR-002)` | M | — | about 6 | grouping, e2e |

### Phase 6: social, lecture and measurement

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-60 | `feat(mobile): weekly quests and Passport stamps (F-CURR-002)` | M | CM-17 | about 30 | deterministic pick, latch merge |
| CM-61 | `feat(backend,mobile,web): family lantern, Worker total from summaries, space-goal read, target behind the PIN (F-CURR-002 OD-7)` (W→A) | M | CM-16, CM-17, owner request A account switching and PIN | about 8 | totals only, cross-device sum, offline total, PIN gate, e2e with 2 profiles |
| CM-62 | `feat(backend,web,mobile): class goal, space_goals, counts-only class-progress route, console setter, presenter bar (F-CURR-002 OD-7)` (W→A) | L | CM-3, CM-16, CM-17 | about 12 | Worker totals, class scope allowed on class-progress only, additive SQL, e2e |
| CM-63 | `feat(lecture): game block and presets by-topic, class-check, class-review (F-CURR-002)` | L | CM-16, CM-21, CM-36, CM-39 | about 18 | no names on projector, slide mapping, old-presenter decode failure, e2e |
| CM-70 | `feat(web): owner-only metrics page over learning_rollups (F-CURR-002)` | M | CM-70a, CM-70b | about 10 | small-group suppression, counts only |
| CM-71 | `feat(mobile): experiment exposure and E1-E4 (F-CURR-002 OD-11)` | S | CM-2, CM-70a | 0 | per-profile bucket stability |
| CM-72 | `feat(mobile): FSRS-lite shadow predictions and calibration bins (F-CURR-002)` | M | CM-12 | 0 | property tests, no scheduling effect |

**Row count:**

| Group | PRs |
|---|---|
| Phase 0 | 17 (plus the conditional CM-5B) |
| Phase 1 | 8 |
| Phase 2 | 8 (CM-23 counts as 3) |
| Phase 3 | 20 (CM-37 ×4, CM-3A ×5) |
| Phase 4 | 34 (5 themes ×5, book 2 ×5, plus CM-40, CM-46a, CM-47, CM-48) |
| Phase 5 | 44 (8 packs ×5, plus CM-50a, CM-50b, CM-50c, CM-59) |
| Phase 6 | 7 |
| **Total** | **138** |

CM-5B is conditional and is counted only if the CM-5 report triggers it. Each content row's PR description lists the MAR pass findings with outcomes, the `--report` bytes for the chunk, test counts and one 320 px screenshot.

**End state:**

| | Now | End state |
|---|---|---|
| Quests | 107 | about 107 + 75 (Volume 2) + 120 (packs) + about 5 (Stage 1 additions) = about 307 |
| Stories | 24 | 35 (11 new tales), every one with a read tier |
| Hours of guided content | about 8.2 | about 23 |
| Distinct taught items | about 930 | about 2,300 |
| Items in spaced review | 144 | all, from lessons, Stage 1 and stories |
| Stages with a ceremony and card | 1 | 7 |
| Listen & Pick share of Checks | about 90% | 40% or less |
| Grid | 5 x 7 | 5 x 7, unchanged on page 1, plus two topic pages that hold the 8 packs |

## 18. Dependencies

- **Shipped:** F-CURR-001, F-QUEST-002, F-VOC-005, F-STORY-005 (volumes, specified), F-STORY-006, F-ENT-003, F-PLAN-002, F-SYNC-001/002, F-RESTORE-001, the device principal of SEC-3 / SEC-4 (F-AUTH-003 is superseded), F-AUDIO-004, F-I18N-001, F-TCH-004 and lecture mode v2, F-REPORT-001, F-MOTION-003.
- **Amended here** (row CM-0b or the named row):
  - F-RVW-001: the age wording goes, and the engine becomes this spec's.
  - F-CURR-001 section 4: Stage Checks (OD-1). U-8: the read-plus-meaning spelling round (4.5). U-11 is added (4.6).
  - F-QUEST-002 L13: the reward step may offer Try these again (4.5).
  - F-VOC-005 P3: the spacing rule (4.3).
  - F-REPORT-001 OD-19: any learning activity keeps the streak (OD-14).
  - F-PLC-001: the ceiling (CM-25).
  - TELEMETRY-NAMES-2: section R.
- **Unblocked here:** F-CARD-S2..S7-001 (CM-23) and F-STORY-005 PR 5.8 (CM-40).
- **From owner request A:** per-profile partitioning and the grown-up PIN (section 4.9), needed by CM-12 (flush on switch) and CM-61.
- **Tokens:** no new design token is expected. Rings, glows, packs and scenes use the existing `theme.*` and feedback tokens. A new token goes through `design/tokens/` and the drift check in its row.

## 19. Unverified assumptions

1. **Per-quest size.** About 5 KB raw per quest on the compact literal is measured on Volume 1 cells. The first Volume 2 cell records its real number here.
2. **Assets instead of async bundles on web.** Resolved by CM-5 (decision record in section 10): Metro async bundles work in the PWA build once Metro's bundle loader is installed at the entry, so they are used; JSON assets stay the fallback.
3. **Memory delta size.** About 60-80 B per changed item state after JSON. CM-12's shadow period measures the p95 delta per day.
4. **NIKL word list licence.** The 2003 list is publicly distributed. It is used at build time only, and its terms are checked before it enters the repo. If they forbid that, `freq-coverage` runs from a local file outside the repo.
5. **Device voice on pseudo-words.** The Decoding Sprint uses real syllables only, because device voices read some non-words unpredictably. CM-32 tests the allowlist on iOS, Android and desktop voices.
6. **Weekly actives.** If there are fewer than about 400 per arm, A/B tests become directional staged rollouts (3.4).
7. **Review load.** The 60-day simulation (4.3) models learner behaviour. The shadow period checks the real due-pool sizes against it before `dailyReview` ramps.
8. **Worker CPU on shard merges.** A 500-item merge is expected to fit the free-tier CPU limit. CM-11 benchmarks it; if it does not fit, the cap per call is lowered.

## 20. Review round 1 (2026-10-21)

Two reviews (learning science and content; engineering and pipeline) raised 36 findings: 2 blockers, 21 majors and 13 minors. The blockers were that a box could rise several times inside one quest (fixed by the spacing rule, 4.3) and that telemetry had nowhere to persist before the shadow period (fixed by CM-70a and CM-70b in Phase 0). Every blocker and major is fixed in this revision, and so is every minor except the parts noted in the PR comment. The phase plan is unchanged; section 17 is re-sequenced.

## 21. Owner decisions (2026-10-21)

The owner answered section 16 on 2026-10-21:

- **OD-2 changed.** New categories (Topic Packs) are browsed by a horizontal swipe. The Journey view keeps the five themes exactly as today, and swiping sideways shows further pages of pack columns. Cells never shrink below the 48 dp target at 320 px; a visible affordance shows there is more to the side; buttons that need no swipe serve keyboard and screen-reader users; reduced motion is respected. The pack data model is unchanged. Sections 0, 6.1, 6.2, 12.2, 13, 14, 15 and 17 (rows CM-D3 and CM-50b) are updated, and the Explore shelf of the earlier draft is removed.
- **OD-4 confirmed.** The first wave is Numbers & Time, People & Family and Feelings & Me.
- **OD-6 confirmed.** Weekly dots are the Home headline, with 2 automatic rest days a local week.
- **Every other OD** stands as proposed and is now decided.

---

## Appendix A. How the plan was chosen (judging scores)

Three independent proposals were scored on five criteria. Each was scored 1-5 (5 = best; for effort and risk, 5 = lowest).

| Criterion | Weight | P1 learning science | P2 engagement and achievement | P3 content scale and engineering |
|---|---|---|---|---|
| Learning value | 30% | 5 | 4 | 4 |
| Delight and achievement | 20% | 3 | 5 | 4 |
| Effort (5 = low) | 15% | 2 | 3 | 4 |
| Risk (5 = low) | 15% | 3 | 3 | 4 |
| Fit with the standing rules | 20% | 4 | 4 | 5 |
| **Weighted total** | | **3.65** | **3.90** | **4.20** |

**Backbone: P3.** It has:
- the Topic Pack schema and template
- the authoring debottleneck
- the manifest split and budget lines
- the ranked category table with merges and Heritage Trails
- the three-checker MAR pipeline and its throughput target
- Volume 2 by theme
- Leitner kept as the scheduler

**Grafted from P1:**
- the typed item kinds (`sym`, `syl`, `lex`, `pat`, `exc`, `rea`)
- the modality ladder that brings production into review without speech
- the avalanche guard
- the separate memory store instead of a growing snapshot
- the `cellBest` latch so mastery never drops
- the quest warm-up
- adaptive pacing
- the Decoding Sprint
- the per-stage default Checks
- story coverage and "Fits you"
- shadow mode before any review UI
- the calibration-based FSRS shadow

**Grafted from P2:**
- points-based goals that accuracy never reduces
- weekly dots and rest days
- the streak switch-over that never drops a number
- "practise the ones you missed", now "Try these again"
- category albums
- weekly quests and Passport stamps
- the family lantern and class goal, totals only
- lecture `game` presets
- This week in Korea
- folk tales that keep the Stage 5 promise
- the explicit anti-shame list

**Not taken:**

| Idea | Why not |
|---|---|
| P1's FSRS as the live scheduler | It would break F-VOC-005 P3, which does not use response time and keeps boxes simple. It stays a shadow |
| P1's slow-answer "Hard" grade | Same reason |
| P1's KOGL museum images for Hidden Heritage | Licence tracking and file size; OD-10 keeps the option |
| P2's 54-file `THEME_REGISTRY` refactor | Packs avoid it |
| P2's exit ticket on learner devices | Needs a live session |
| P2's Quick and Boss quest variants | The Cell Check covers the Boss role with less surface |
| P3's 8-10 minute Stage Check | Shortened to 6-8 |
| A separate Shopping & Money pack | Merged into Town & Travel |

---

_Created 2026-10-21 (owner request B of 2026-10-21), synthesized from three independent planning proposals on `main` at `a384759ca`. Revised the same day after review round 1 (section 20) and with the owner decisions (section 21)._
