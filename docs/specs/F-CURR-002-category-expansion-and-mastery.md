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
9. **Every phase is measured without PII, and the data has somewhere to land first.** A persistent rollup table ships in Phase 0, before the shadow period it measures. A public, read-only remote config with off-only overrides replaces build-only kill switches, and a daily guardrail evaluator lowers a ramp on a breach. Each learner profile is placed in an experiment bucket. Metrics are counts by content id, and any group with fewer than 20 events on a day (profile-days for the once-a-day names) is suppressed (sections 3, 11, 12).

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

The guardrail evaluator (row CM-70b) checks these once a day from the rollup table. On a breach it lowers the ramping flag to its previous step through the remote config (section 12.3). A rise or fall counts as a breach only when it passes the line below and is statistically clear for the cohort sizes; section 12.3 gives the exact rule.

- Mid-quest quit rate, overall and per game kind (`session.end` with `questLeft: 1`, by `leftAtKind`), must not rise by more than 2 pp. Until row CM-70c the per-kind rate is the kind's share of all reporting sessions, so it is weaker than written (12.3).
- Quits after a wrong streak (`session.end` with `afterWrongStreak: 2` and `questLeft: 1`) must not rise.
- Median session length must not fall by more than 10%, and p90 must stay under 20 minutes.
- Sync 4xx and 5xx rates must not double, the p95 memory delta size must stay under 32 KB, and D1 rows written per day must stay under 50% of the free-tier daily quota. The evaluator's D1 line is advisory until row CM-70d: it sees only the rows the rollup sink writes, which stop at 20% (12.3), so the account total is the owner's check.
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

**Decision record (row CM-10, 2026-10-22).**
- **Where it lives.** The item shape, its ids, its formats and the chunk rows are `packages/content-schema/src/review-items/review-item.ts` (`@hangul-route/content-schema/review-items`, outside the package barrel, so the start bundle does not carry them). Extraction (`extract.ts`), the frozen ids (`stable-ids.ts`) and the choice of sources (`sources.ts`: ready cells of any volume, ready pack levels, ready stories) are build time only. `build-lessons.mjs` (`lessonReviewOccurrences`) and `build-stories.mjs` (`storyReviewOccurrences`) read their own files through them, and `scripts/build-review-items.mjs`, the seventh generator of `pnpm generate`, merges the three sources into one chunk. The `items-stable-id` rule of `lesson-lint.ts` reads the content tree through the same sources, so the build and the lint agree on what is taught.
- **Ids.** A word, sentence or frame, exchange and syllable is `<kind>:<slug of its F-CNT-002 romanization>`; a frame's `___` reads `n` (`pat:n-juseyo`). A symbol is named by its romanized letter name, as its jamo id is (`sym:bieup`, `sym:bieup-batchim`), because ㅂ as a first and as a final letter are two items and the table's `sym:ㅂ` would name both. A realia card's reading skill is named by its realia ref (`rea:menu-prices`). A homograph of `_senses.json` takes the sense its gloss names (`lex:bae~pear`, or the topic word's own `vocab:bae-boat`); a second spelling with the same romanization takes a numbered variant (`lex:nat~2`). An exchange is its line and its reply, so one line with two replies is two items (`exc:annyeonghaseyo`, `exc:annyeonghaseyo~2`). A final-sound rule is the final letter's `sym` item (`sym:giyeok-batchim`, as Stage 1 and Word Builder teach it), not a `syl:batchim-k` item: the table's `syl` example names the rule, and the symbol already is it. A letter's example word and a pattern's example sentences illustrate the letter or the frame on the Discover page and are not items; the letter and the frame are.
- **Identity and the snapshot.** An item's identity is its key: its kind and its Korean (NFC, spaces collapsed, edge punctuation dropped), with the sense of a homograph and an exchange's reply. A gloss or romanization edit keeps the key. `items-stable-id.json` holds `ids` (an item's key to its frozen id), `alias` (the key an edited text now gives, to the frozen id it keeps) and `retired`, one entry per line. A frozen id no longer taught, a retired id taught again, and an alias or retirement that names no frozen id stop the build. A new item is written with a warning, and the lint and the snapshot test fail until `node scripts/build-review-items.mjs --freeze` adds it (it never removes one). A round's bare word that a Discover page teaches as a sentence is that sentence.
- **Stage 1.** `stage1-items.json` holds the app's symbol table (`jamoKnown`) and the Stage 1 occurrences (each symbol and word a Discover page teaches, a word glossed at its quest's overlay field, and the symbols, blocks and words of every scored round). The build reads it without loading the app; `apps/mobile/src/content/__tests__/review-items-stage1.test.ts` re-extracts it from the live Stage 1 data and fails on any difference.
- **Cells and the denominator (4.4).** An item's `cells` are the cells that teach it: the first cell that asks it, the first grid cell that asks it when a story came first (a story has no ring), and every cell whose Discover page shows it. A later cell or story that only asks it again in a scored round, a recycle, is in `asked`. A Volume k ≥ 2 file is its own cell, `episode:<cell>-v<k>` (`cellOfVolume`). `masteryDenominator(items, cell, startedVolumes, retired)` takes the grid cell's own id and the volumes the learner has started, and holds the items whose `cells` name one of those volumes' cells, minus the retired ones. So a Volume 2 item counts once Volume 2 is started and not before, and a recycled item counts only in the cells that teach it, never in the later cells that ask it again. `stage` and `volume` are those of the first teaching cell.
- **Glosses.** An item's English and its gloss key come from the same occurrence (the first Discover one), so the es and ko overlays translate that English. When that occurrence has no key (a listen-pick option, a realia round's key word), the item takes the first overlay field that glosses the same Korean with the same English: a realia card entry, an exchange reply, a topic word. A content test holds every item with an English gloss to a key that resolves in both the es and ko overlays.
- **Formats and hear mode (4.5).** "Hear mode" is Type Hangul `hear` (the `dictation` format): it needs one spelling for the sound among the taught items and no `soundChange`. A heard round with spelling options (`hear-pick`) needs one spelling too, unless its prompt shows the item's picture or gloss, which settles it. So an item with a homophone and neither picture nor gloss is never asked by ear, and the review engine (row CM-13) shows the picture or gloss in the heard round of an item that has a homophone. A `soundChange` item keeps `hear-pick` (the device voice says the standard pronunciation, and the learner picks the spelling) and stays out of dictation until recordings A-9 and A-10 exist.
- **Retired items.** A retired id has no row, so nothing selects it or counts it. The chunk keeps a small retired table, `[id, Korean, romanization]`, the Korean read from the frozen key (a symbol's letter from the symbol table, a realia skill's realia ref), so a report can still name the item its kept state belongs to. It keeps no gloss key, because the overlay field went with the content.
- **The chunk.** Positional rows with shared tables (cells and homes by index, a romanization equal to the converter's reading left out, gloss keys abbreviated), the retired table, and a 16-hex content hash that the start-loaded `review-items-index.ts` names. Metro emits it as its own web bundle; `pwa-postbuild.mjs` checks it with the lesson and story chunks and holds the built bundle to its line. Measured at CM-10: 733 items (55 `sym`, 36 `syl`, 275 `lex` of which 90 are topic words, 286 `pat`, 67 `exc`, 14 `rea`), 97,670 B raw / 20,024 B gzip as generated, about 133 B an item; the built web bundle is 105,189 B raw / 19,475 B gzip. The start bundle carries only the chunk's hash and loader: 4,733,566 B raw on the release build, under the 4,740,000 B line. At that rate the end state of about 2,300 items passes the 150,000 B line, so a later row either raises it with its measurement or splits the chunk by volume.

### 4.3 The scheduler

**Box rules: F-VOC-005 P3 with a spacing rule** (P3 is amended in CM-0b; the rule applies to topic words too).

- **Box 0** means not met. The first time a learner meets an item (its first scored round; as amended by row CM-12, a Discover page shows the item but does not meet it), it enters **box 1, due tomorrow**, with first day `f` = today.
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
| S-a | 1 quest a day, Daily Review every day, one Keep going sitting (taken while it is offered, up to 3 rounds) on days the opening pool is over 20 | the pool left at the end of the day is at most 3 x the Daily Review size on 90% of days 30-60; G2 is reachable (70% or more of items introduced in days 1-30 get 3 spaced answers within 30 days). Pinned as well: the opening pool, the days 30-60 the review-first suggestion shows, and the median answers a day (row CM-13 decision record) |
| S-b | 2 quests a day; on days the review-first suggestion shows, Daily Review and Keep going replace the second quest | the pool on day 60 is no more than the pool on day 30 plus 30, both for the pool left at the end of the day and for the opening pool |
| S-c | an existing learner with all 107 quests done (about 930 seeded items), then S-a | every seeded item has a due day; no day has more than 15 seeded due; the spread ends by day 62; the Daily Reviews of a day draw at most 20 due items; every seeded item is answered by day 60. Pinned as well: the peak opening pool and the pool left on day 60 |
| S-d | any number of right answers to one item in one day (property test) | the box rises by 1 or less; it falls by 1 or less, at every step of the day |
| S-e | one quest-day introduces 8 items, then S-a | no item reaches box 3 before day 4 |

**Decision record (row CM-13, 2026-10-22).**
- **Where it lives.** `apps/mobile/src/logic/reviews/engine.ts`, pure and offline, beside `banned-text.ts` and `star-calc.ts`. It reads the item index, the learner's states (the memory store's rows, with topic words read from the `vocab` slice by `engineStates`) and the local day, and returns plans. It never writes a state; answers go to `recordAnswers` and the CM-12 spacing rule. Nothing in the start bundle imports it: the memory store's lazy chunk (CM-12) imports it for the credit inside sentences, so the start bundle is unchanged (measurement in the PR). CM-14 and CM-15 load the sessions behind their own flags; there is no new flag.
- **Selection.** The due pool is every item with a box, `d` ≤ today, not answered today, not retired, and with at least one visible source. Section 12.2: an item is skipped when every cell in its `cells` and `asked` is hidden (a `-v<k>` cell with `volumes` off, an `episode:pack-<key>-s<n>` cell with `topicPacks` or `pack.<key>` off). A story id carries no volume, so `SourceVisibility.cellVolume` names it: a Stage 5 book 2 story is Volume 2 and hides with `volumes` off. Row CM-46 passes it from the story shelf; every story shipped today is book 1 and always shown. The order is box, then due day, then FNV-1a of seed and id, then the id. The seed only moves ties.
- **Rungs.** Box 1-2 asks at `min(c, read)`. The other one of recognize and read is a second choice, used only when it keeps the format cap. Box 3 and up asks at `c`, and `c` = 3 asks at produce. A rung with no usable format falls back to read. With no device voice the heard formats (`hear-pick`, `dictation`) are never used, recognize is asked at read, and the question carries `voiceFallback`, so the session shows the F-AUDIO-004 notice. It does so only for an item that would have had a heard round with a voice: a `rea` item (no recognize rung) or a homophone with no picture or gloss shows no notice. A right answer at read passes recognize too (CM-12), so this is the two-rung ladder. The engine checks `dictation-unambiguous` again: no dictation for an item with a homophone or a sound change. A heard pick of an item with a homophone carries `cue: 'picture' | 'gloss'`, and with neither it is not heard. Topic words have no rungs in the `vocab` slice, so they are asked at read.
- **Interleaving.** Each slot takes the first candidate in selection order, with its first way of asking, that keeps both caps. If none does, the theme cap is dropped first, then the format cap, and last the first candidate is taken as it is. So a lower-box item moves up only to break a run, and a slot is never left empty. The theme cap is off when every candidate has one theme.
- **Sessions.**
  - Daily Review (10): stretch items (best box 3+, not due, not answered today, `c` < 3, soonest due first) are a second tier. They are used only after every due item. A stretch item is asked at its next rung `c` at box 3 and up; one whose box fell to 1-2 keeps the recognize-or-read rule. Section 4.8 step 3 is read as a day cap on the Daily Reviews of a day: they draw at most 20 due items (`DayReviewLog.dailyDueDrawn`). When this cap is what holds the pool back, no stretch item fills in, the session carries `capped`, and the surface offers Keep going (`canKeepGoing`); a capped Daily Review with no questions is never played and is not "All refreshed today". `endsEarly` is set only when there is nothing left to ask.
  - Keep going: 10 due items, never stretch, while due items remain, at most `KEEP_GOING_ROUNDS_PER_DAY` rounds a day.
  - Warm-up: up to 3 due items before a Stage 2+ quest, from earlier cells: taught by a cell before the quest's in route order (`WarmupQuest.earlier`, which the CM-15 quest player passes; without it, a stage at most the quest's), and not taught or asked again by the quest's own cell, which asks them anyway. So a replay of an early quest never warms up with a later stage's items.
  - Try these again: the session's misses, each once, in the order missed, at most 8 (the 30-60 s of the session table).
  - Check selector (CM-21, CM-22, pack L5): met and unmet items of the request, box first. At least 30% of the questions are at produce: the items the ladder already asks there, then the most held items that allow it. Then it interleaves.
  - Review first: the due pool is larger than 3 × 10.
- **Credit inside sentences.** A sentence's taught words are found in its line (and an exchange's reply). A word counts when a run of up to three words is a word item, or is one with a particle or copula ending on its last word that fits it: 가, 는, 를 after a vowel, 이, 은, 을 after a final consonant, 로 after a vowel or ㄹ, 으로 after another final. So 물가 (prices) is not 물 with 가. A spelling shared by two word items (배 the pear, 배 the boat) names neither. A credit is a read-rung right answer, placed right after the answer that earned it. It is given only to a met word that is due today, was not answered today and is not asked in the same batch, and at most once a batch. It goes through the spacing rule, so it can raise a word at most once a day. The memory store applies `withSentenceCredit` to every batch it records (`recordAnswers`, so quest rounds, story check rounds, warm-ups, reviews and Checks alike), and a topic word's credit goes to the `vocab` slice. Applying it again to a batch that already carries its credits adds nothing. The simulation records the same way.
- **Typing tolerance.** `gradeTyped` normalizes both sides as the build keys items (NFC, edge punctuation off) and drops every space. It splits blocks into first letter, vowel and final, and takes the edit distance over those letters: 0 is right, 1 is hinted, 2 or more is a miss, and an empty answer is a miss. `typedAnswer` gives the answer to record.
- **The simulation** (`__tests__/simulate.ts`, `engine-simulation.test.ts`, 5 seeds each).
  - The learner plays this build's 107 lesson quests in route order. A cell's first-taught items are split over its quests, the cell's recycle items come in its last quest, and each new item is answered twice on the day it is met.
  - Answers are right about 85% of the time (recognize 0.90, read 0.87, produce 0.75, plus 0.01 a box), and 5% of right produce answers are hinted. Every answer goes through `applyAnswer`, as the store records it.
  - **"The pool" of S-a and S-b is the due pool a day leaves.** The opening pool includes what falls due that day: in S-a it is 40-43 on a median late day (about 7.8 new items a quest-day, each due again on days 1, 4, 11 and 25), whatever a session plan does. Measured on the opening pool, no engine could pass: the opening-pool line cannot be reached at this intro rate and these intervals.
  - **"One Keep going" in S-a is read as one Keep going sitting**: the learner keeps going while it is offered, up to the knob. With a single 10-item round no setting passes (0% of days).
  - The 4.3 table states both readings, open for the owner (section 21). Their cost is pinned in the gate, so a change cannot make it worse unseen: the opening pool on days 30-60 at most 80, the review-first suggestion on at most 28 of days 30-60, and a median of at most 60 answers a day.
- **Knobs** (S-a: the share of days 30-60 whose left pool is ≤ 30; S-b: day 30 to day 60, left and opening pools).

| Keep going rounds | Warm-up | Credit | S-a | S-b |
|---|---|---|---|---|
| 1 | 3 | on | 0.00 | fails (about 110 to 350) |
| 2 | 3 | on | 0.35-0.42 | fails (8-28 to 167-185) |
| 3 | 0 | on | 0.97-1.00 | fails on 4 of 5 seeds |
| 3 | 3 | off | 1.00 | the opening pool fails on 1 of 5 seeds (32 to 72) |
| **3** | **3** | **on** | **1.00** | **passes: left 0-24 to 0-16, opening 32-69 to 22-52** |

  The engine ships at 3 rounds, a warm-up of 3 and credit on, the most the session table allows.
- **Results at those values.**
  - **S-a:** 100% of days 30-60 are within the line on every seed. The largest left pool is 27. G2 is 1.00 (234 items introduced in days 1-30, each with 3 spaced answers within 30 days). It also holds with no device voice. The cost: the opening pool on days 30-60 has a median of 40-43 and a largest of 52-71, and is within 30 on only 13-16% of those days; the review-first suggestion shows on 26-27 of days 30-60 (36-39 of the 60); the learner answers a median of 55-56 items a day, about 40 of them review (the Daily Review and up to three Keep going rounds).
  - **S-b:** the review-first suggestion shows on 50-53 of the 60 days.
  - **S-c:** this build seeds 620 items over 42 days, not the end state's 930 over 62. Every item is dated, no day holds more than 15, and the spread ends by day 62. Played until the cap is spent, the Daily Reviews of a day draw at most 20 due items, and the next one draws none and carries `capped` while due items remain. Every seeded item is answered within the 60 days. **Owner-visible risk for the `dailyReview` ramp of existing learners:** under CM-12's cautious seed box every seeded item of this fixture starts at box 1, and the opening pool peaks at 414 on day 42 (366 left; the seeded items' second and third reviews), with 190 still left on day 60, falling. Section 4.3 sets no pool line for S-c, so the gate pins the peak at 440 and day 60 at 210.
  - **S-d** is a fast-check property through sessions and credits, on the box at every step of the day, not only its end.
  - **S-e:** the earliest box 3 is day 4.

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

**Decision record (row CM-20, 2026-10-22).**
- **Where it lives.** The derivation is `apps/mobile/src/logic/memory/mastery.ts`, pure, in the memory chunk with the review engine: `deriveMastery` (each cell's level, its started volumes, its denominator and the New volume flag), `latchCellBest` (raises `cellBest`, never lowers it), `selectDueCellIds` (the mastered cells with an item due, one pass a read) and `wordsMilestoneCrossed`. `memoryRuntime().mastery(profileId, opts)` runs it after every earlier operation on the profile, latches each rise into the snapshot's `cellBest` (merged by max, saved and synced like any write) and sends one `mastery.level_up { cellId, level }` per rise, parsed by `CURR_TELEMETRY_PAYLOADS` (no PII; the device that latched sends it). Nothing is latched before the one-time seeding has run (`memSeededAt`): the seeding latches Done for the cells finished earlier without an event, so an existing learner's history is never sent as rises. A device's first mastery read for a profile (the day the owner ramps `mastery`, or a new device) is a silent baseline: it latches the levels reached before, but sends no `mastery.level_up` and shows no banner, so a ramp never reads as a burst of live rises in the funnel. The baseline is the device's first mastery read after the seeding: a read before `memSeededAt` latches nothing and sets no Words known count (`wk`), so it does not take the baseline, and the levels reached before the seeding stay history on the read after it. The ring and the Results banners are a learner chunk of their own (`screens/mastery/mastery-chunk.ts`, marker `mastery-chunk:ui`, reached only through the literal `import()` of `store/mastery-entry.ts`), so no module is shared by two chunks. The start bundle carries `store/mastery-entry.ts`, the screens' few lines and the English strings.
- **Rules as built.** An item is held at box k when `s` >= k with a real answer (`n` >= 1) of which one was right (`r` >= 1), the Words known rule of CM-16, so a seeded box alone, or one followed only by wrong answers, holds nothing. `b`, `c` and `d` are never read for a level (a property test changes them and the level stays). The shares are whole-number comparisons (`held x 100 >= 80 x size`). The levels are cumulative: Practiced needs Done and Mastered needs Practiced, so items held through other cells never lift a cell nobody finished, and an empty denominator never reaches Practiced (Stage 5's books teach no review items, so they stay at Done). A volume k >= 2 is a catalogue quest or an item named `<cell>-v<k>` (`cellOfVolume`); it is started by one of its quests done or a test-out of its volume cell (`testedOut[<cell>-v<k>]`), and "New volume" shows on a started cell whose later volume has quests in the catalogue and is not started, only with `volumes` on. This build ships no later volume, so no marker shows yet.
- **Topic words in the denominator (as the table says).** Every topic word a started volume teaches is in the denominator, collected or not; a word not collected yet is simply not held. A cell made mostly of topic words (Stage 2 Nature: 12 of 14; Stage 2 Letters: 46 of 89) therefore reaches Practiced only when its words are practised in the word topics and the Daily Review, never on a few lesson items. An earlier draft of this row left uncollected words out, which let Nature reach Practiced on 3 of its 14 items; review of the PR rejected it, because a latched level can never be taken back (a test pins the Nature case).
- **Ready to refresh** shows only while the review surface is on (`dailyReview`), as reports show items ready to refresh only then (CM-16 review fix 1). This narrows the rule above (which says a mastered cell with items due glows) and is open for the owner's acknowledgement: during the `memoryRecord` shadow period nothing asks the due items, and a glow that nothing can answer would read as a backlog (section 7.7). It shows on latched level 3 cells only, never on the Next cell's sticker spot (the label still says it), and never pulses.
- **Words known and its milestones.** The counter is `wordsKnownOf` of `summary.ts`, the same function as the report's count, so the two never disagree. Each device keeps the last count it read (`wk`, in the profile's memory store; device-only, never uploaded). The first read after the seeding sets it without a celebration (a read before `memSeededAt` leaves it unset), so an existing learner past 100 words is not congratulated for words learned before. Latching and celebrating are kept apart: whichever read sees a rise or a milestone first (Home, the Journey and the Learning Route stay mounted under the Results and re-read when a quest is written) latches it and moves `wk`, and adds it to the moments waiting in the store (`mc`: the levels this device latched and the highest milestone crossed, kept for their local day). Only the Results of an activity (`celebrate`) returns them and takes them, once: the milestone first, then one level up (the quest's own cell when it rose, else the highest). A rise synced from another device is latched there and shown there; a moment left from an earlier day is dropped, never shown late.
- **Surfaces.** The ring round the Journey grid's lesson cells (the cell keeps its own border width in a transparent colour and the 3 dp track is drawn over its outer edge, inside the thickest border the cell layout reserves (`maxEdge`): a ringed cell is exactly as wide and tall as a level 0 one, 54 dp at 320. A thicker border would not do: on the web a flex cell grows by its border, so a 3 dp border made a ringed cell 1.6 dp wider than its neighbours; while the rings are on, the stage header's margin is `spacing.md` and the notes' `spacing.sm`); the cell label adds "Done.", "Practiced." or "Mastered.", then "Ready to refresh." and "New volume."; the Home pill "120 words known" (from 1, first in the pills row); the Learning Route card's "Words you know: 120" (the learner's own card only, read in its summary); the milestone and level-up banners on quest Results (the 48 dp ring fills its new segment in `motion.duration.slow`, drawn full at once with reduced motion). The cell labels reuse the `learner.mastery` level words, so there are no separate `a11y.mastery` keys.
- **Not in this row.** The cell page block of the wireframe (E, with its hint lines "Take the Cell Check to reach Mastered.") goes with the Cell Check block of row CM-21, which owns that button and its copy. The legend line's mastery entries (wireframe F) need new mark kinds in the design system's `RouteLegend`; the legend is decorative (hidden from screen readers) and the cell labels carry the words, so it is left open for the owner.
- **Flag and launch state.** Everything is behind `currFlagOn('mastery')` (build floor `EXPO_PUBLIC_CURR_MASTERY` on, built-in pct 0, unchanged), and only for a profile that records (`memoryRecordsFor`: `memoryRecord` on and a learner; a grown-up persona never records), because the levels above Done need answered memory. The PR merges dark; the owner ramps `mastery` in `remote_config` (12.3) after `memoryRecord`. Off (either flag): no ring, glow, marker, pill, route line or banner, and no read; `cellBest` stays and shows again when the flag is back on. Reports keep reading `cellBest` (`cellBestCounts`) whatever the flag, so a grown-up sees levels 2 and 3 as soon as they are latched.
- **Budget.** `build:web --budget` measures the start bundle at 4,808,758 B raw / 1,267,721 B gzip on main with GU-7 (#833), under the 4,810,000 B line (no raise; 1,242 B of headroom). The derivation and the moments add about 5.2 KB to the memory chunk (63.4 kB on main, now 68,558 B raw / 24,193 B gzip) and the mastery chunk is 8,144 B raw / 2,928 B gzip, both precached.

### 4.5 Review sessions

All sessions share one engine (`logic/reviews/engine.ts`, in the existing `apps/mobile/src/logic/reviews/` directory, row CM-13). The engine is pure, deterministic for a seed, and works offline.

| Session | Length | Where it lives | Selection | Learner sees |
|---|---|---|---|---|
| **Daily Review** (the F-RVW-001 Daily Test, rebuilt on this model) | 10 items, about 2-3 min (experiment E2: 6 against 10) | Today mission slot 3, when 3 or more items are due; also on Home | the due pool in selection order (4.3); stretch items (the next rung of a best box 3+ item that is not due) only fill slots the pool cannot. Ends early with "All refreshed today" when there is nothing to ask | Stars by F-RVW-001 section 3.1, and "N got stronger" |
| **Keep going** | 10 more items, optional | Offered at the end of a Daily Review while due items remain, up to 3 times a day | the due pool, same order | stars; never required; never shown as owed |
| **Warm-up** | up to 3 items, 30 s or less, before the six steps of a Stage 2+ quest | Quest player, outside the six steps (so F-CURR-001 U-5 timing is unchanged) | due items from earlier cells; skipped when none are due | nothing scored; a soft "Warmed up" |
| **Try these again** | the quest's missed items, 30-60 s | Quest reward step, as the default suggestion when there were misses (a full replay stays available) | the misses of the session just played (kind `feedback`). This amends F-QUEST-002 L13: the reward step may offer it, while the Check still replaces the one-question Feedback Review inside the quest | stars |
| **Cell Check** | 8-10 items, about 3 min (row CM-21: down to 5 where a cell has fewer playable items) | Cell sheet, after the first volume is done; on any unstarted cell as **Test out** (row CM-21: not in Stage 1, and only on a cell whose topic words are at most 30% of its items) | the cell's items, at least 30% at the produce rung, interleaved | stars; 80% or more first-try counts toward Mastered, or marks Done when used as a test-out |
| **Stage Check** | about 20 items, 6-8 min, untimed, retake freely, best result latches | Journey stage header, after the stage latch | items from all five themes of the stage, at least 30% produce | stars, then the ceremony and the stage card |
| **Pack Check** | 10 items | Pack page, after level 5 | the pack's items | stars, then the pack badge |

**Interleaving rules, when the pool allows.** No more than 2 consecutive items from one theme, and no more than 3 consecutive items in one format. When every due item comes from one theme, the theme cap is skipped and the format cap still applies.

**Format by rung and kind** is the table in 4.3. Recognize falls back to read with no device voice, and the visible F-AUDIO-004 sound notice shows.

**Listening rounds never depend on telling homophones apart.**
- **`dictation-unambiguous` lint and engine rule.** An item may be asked in Dictation (Type Hangul `hear`), or in any heard round whose options are spellings, only if its standard pronunciation has exactly one spelling among the taught items (낫 / 낮 / 낯 all sound [낟]; 같이 sounds [가치]), or the prompt shows a picture or gloss that settles it. Items with a `soundChange` flag stay out of hear mode until recordings A-9 and A-10 exist. The review engine applies the same rule when it picks a produce-rung format.
- **The spelling round of Letters S2** (section 5.2) is a read-plus-meaning round: picture or gloss with audio, then "Which spelling matches this word?". Its two options may sound the same (책이 and 채기 are both [채기]), and the picture or gloss is what settles it. CM-0b amends F-CURR-001 U-8 for this one round kind, and the lint requires the picture or gloss on it. With a screen reader on, each option's label spells the option block by block with the letter names (책이: 치읓 애 기역, 이응 이; 채기: 치읓 애, 기역 이), never the word or its romanization alone, so the two options can be told apart by ear.

**Never on a review screen:** a percentage, an "n of m" score, or a per-question timer. A lint enforces this (section 9.3).

**Test-out details:**
- The quests of a cell passed by test-out show "Tested out" and 2 stars, and stay replayable.
- **Items the Check asked** are set by their result: right goes to box 2 (due in 3 days), a miss to box 1 (due tomorrow). (Row CM-21: on a test-out that did not pass, a missed item not met yet stays unmet, for its first quest to teach.)
- **Items it did not ask** go to box 1, due spread over the next 3 days within the caps, so the first reviews check them. (Row CM-21: topic words excepted, which the memory store records only once collected; hence the 30% topic-word limit on Test out.)
- So "Words known" grows only with items the learner actually answered.
- `routeNext` skips tested-out cells.
- A test-out needs access to the cell under F-ENT-003, the same as playing it.

**Decision record (row CM-15, 2026-10-22).**
- **Where they live.** The plans are built in the memory store's chunk beside the engine (`logic/reviews/quest-reviews.ts`, `quest-review-planner.ts`, reached through `questReviewPlanner` of `logic/memory/boot.ts`); the sessions and their round view are a chunk of their own (`screens/quest/quest-review-chunk.tsx`, marker `quest-review-chunk:session`), loaded by `screens/quest/quest-reviews.ts` only while `questWarmup` or `missedPractice` is on. No module sits in both chunks, because the web build hoists a module two chunks share into the start bundle. Design: `design/wireframes/reviews/quest-warmup-try-again.md` (the round look is the Daily Review's B and B2).
- **Who gets them.** The warm-up: `questWarmup` and `memoryRecord` on for a learner, a Stage 2+ quest, from its first step (a story quest that resumes past it gets none). Its items come from cells before the quest's in route order: the planner passes `WarmupQuest.earlier`, built from `routeOrder` (each grid cell at the place of its first quest), so a replay of an early Stage 2 quest never asks what a later Stage 2 cell taught. A cell off the route (a shelf story) counts as earlier when its stage is at most the quest's; a quest off the route keeps the engine's stage rule. Try these again: `missedPractice` and `memoryRecord` on, and a first-try miss in this play (`quest-run-store` keeps what each missed round asked; the memory store's resolver turns it into items). With `memoryRecord` off the pool is not real, so both hide, as `dailyReview` does. Both keep built-in pct 0 and ramp only after the `memoryRecord` 2-week shadow, the `dailyReview` rule of 4.8 (runbook K-4).
- **Rounds.** Quick pick rounds at recognize or read (`maxRung` on the engine context): an item the ladder would ask at produce is asked at read here, and its ladder moves on in the Daily Review and the Checks; a spaced right answer at any rung raises the box, so the schedule is the same. A symbol is read rather than heard (the voice cannot say a letter's sound alone). Options: the answer and two others of its kind, met items first, with a face of their own (no same-sounding word in a heard round; a meaning in the UI language, from the overlay the gloss key names once the item's lesson cell is loaded). A realia card, or an item without two such others, is left out. Every answer is recorded with the credit inside sentences.
- **Timing.** The first step waits at most 1.5 s for the warm-up's plan; the reward step holds its buttons at most 0.8 s for Try these again's. A later plan is dropped. So that a plan is in time, the lesson page and the quest player start loading the sessions' chunk and what the planner reads (the memory chunk, the learner's rows, the review items) as soon as either switch is on for the learner, and an English learner's plan waits for no lesson cell (the gloss is the item's own). The warm-up plays inside the quest's session, after `quest.start`: its time counts in the session's minutes, and a leave from it is a quit before the first step is done, so the K-4 guardrail reading of the `questWarmup` ramp counts both; the step counts, the stars and `durationSeconds` of the steps (U-5) are unchanged.
- **Try these again plays on Results.** Its button finishes the quest as See results does, and Results, having written the score, the card and the quest's done mark, opens the session over its own content (the session is handed over in memory for that quest and learner only). Closing the app, the OS ending it, or a profile switch during the session never loses the quest. A back during it, or its See results, shows Results.
- **What they leave.** One `reviews[]` entry a kind and local day, `warmup:<day>` (no stars) and `feedback:<day>` (stars, the items not right first try); two copies of a day merge (every item, the better stars). Both kinds are kept for 14 local days after the newest of their kind, the `daily` rule, on the device and in the Worker's write path (`pruneReviews`). A wrong device clock cannot anchor that window in the future: the entry's day is never later than the latest local day of the last server time seen, or the day after the newest entry of its kind (`entryDayOf`, the CM-12 `stampOf` rule), and every prune (the Worker's write with its own clock, the device's merge and write with now) drops a day after the latest local day (`latestLocalDay`), so it never prunes the real days. An entry is written only when the session is finished; leaving early keeps the answers. `review.start { kind, items }` and `review.complete { kind, items, retries, stars? }`, no item and no text.
- **The warm-up gate** is the section 13 row "Older builds and rollbacks after a W→A row ships".
- **Start bundle.** 4,744,698 B raw (release `build:web`) against 4,738,771 B on its parent: the player's two gates and their timing, the hand-over to Results, the preload, the review-kind gate of the sync and backup paths and the merge's retention. By module (esbuild-minified source): the player 1,626 B, `quest-reviews.ts` 1,114 B, the content-schema gate and retention 797 B, the merge 552 B, Results 355 B, the gate 256 B, boot 205 B, the rest under 110 B each; no new dependency. The line moved to 4,750,000 B in one line with these numbers (`apps/mobile/scripts/pwa/lesson-chunks.mjs`). The sessions' chunk is about 10 kB; the engine and the planner ride in the memory chunk.

**Decision record (row CM-21, 2026-10-22; review fixes 2026-10-23).**
- **Where it lives.** The pure session (`logic/reviews/cell-check.ts`: the cell's items through the CM-13 Check selector, the result, the entry, the latch, the test-out rules, the events) and its reads and writes (`logic/reviews/cell-check-api.ts`, `cellCheckApi()`) are in the memory chunk beside `dailyReviewApi()`; the test-out placement and derivation are `logic/memory/test-out.ts`. The cell page's block, the Test out line and the screen are a screen chunk of their own (`screens/cell-check/cell-check-chunk.tsx`, marker `screen-chunk:cell-check`, `SCREEN_CHUNKS`), reached only through the literal `import()` of `screens/cell-check/cell-check-entry.tsx`. It reaches the Daily Review chunk's rounds, top row and headline (`dailyReviewChunk()`), the mastery chunk's 48 dp ring (`LevelRing`) and the memory chunk at run time, so no module sits in two chunks. The offer rules are `logic/reviews/cell-check-offer.ts`, read by the screen chunk only.
- **Gate and launch state.** `currFlagOn('cellCheck')` (which covers the test-out) with `memoryRecord`, for a learner; built-in pct 0, so the row merges dark and the owner ramps it after the `memoryRecord` shadow. The session reads the gate when it starts and again when it finishes: a switch turned off while a Check plays writes nothing (no answers placed, no entry, no latch, no event). Off (12.2): no Check button and no Test out line; `cellCheckAt`, `testedOut`, the levels and the `reviews[]` entries stay, and "Cell Check done" shows again when it is back on. With `memoryRecord` off and `cellCheck` on it is off too (answers would not be recorded).
- **The Tested out mark while off** (open for the owner). 12.2 reads as if every latched mark hides while the switch is off. The quests of a tested-out cell keep "Tested out" and 2 stars whatever the switch, because `routeNext` keeps skipping the cell: a hidden mark would leave the route jumping over a cell that looks untouched. The mark is a latch, as the levels in reports are. The alternative is to gate the skip on the switch too, which threads the switch through every `routeNext` caller.
- **Selection.** The cell's items are the items whose `cells` names it, topic words included, met or not, through `buildCheck`: 10 rounds, box first, at least ceil(0.3 x rounds) at the produce rung, interleaved. Review fix to the selector: when the first 10 items cannot hold the produce share (Stage 1 symbols have no shipped produce round), the next items of the request that allow it take the places of the last ones that do not. In es and ko the cell's lesson chunks load first; an item none of whose chunks loads is left out, never shown in English.
- **Offers** (wireframe A, A2, B). The Check after every quest of the cell's first volume is done, or on a tested-out cell: the page's one primary until a Check latches, then "Cell Check done" and Take it again, secondary. Test out on an unstarted cell (no quest done, not tested out), not in Stage 1, with every quest of the cell open to the learner under F-ENT-003 (a locked cell offers none; the gate is `useQuestAccess`, the same as playing it), on a cell whose topic words are at most 30% of its items (below), in E3's offered arm (`testOutArmFor`, every learner until row CM-71 assigns arms). The session checks the test-out rules again (`testOutAllowed` with `questOpenFor`) at its start and before its latch, so a plan that lapsed or a profile change while it played latches nothing and places nothing. The mastery block (mastery-ring.md E, left to this row by CM-20) shows the latched level, Ready to refresh, New volume and one hint for the next level while `mastery` is on.
- **Narrowings of 4.5, open for the owner.** Each comes from the wireframe or from the memory store, and the 4.5 table and Test-out details carry a note:
  1. **Test out is never offered in Stage 1** (4.5: "on any unstarted cell"). Placement covers Stage 1, and its prize and Hangul Check need its quests (cell-check.md B).
  2. **A Check of 5 to 10 rounds** (4.5: "8-10 items"). A cell with fewer than 8 playable items gets a shorter Check down to 5 (`CELL_CHECK_MIN_ROUNDS`, the wireframe's floor); below 5 there is no Check and no Test out (Stage 5 books teach no review items).
  3. **A missed item on a test-out that did not pass stays unmet** (4.5: asked items "are set by their result"). The cell stays unstarted and its first quest teaches the item (cell-check.md States).
  4. **Test out only where topic words are at most 30% of the cell's items** (`TEST_OUT_MAX_TOPIC_SHARE`). A topic word (`vocab:`) is recorded only once it is collected (F-VOC-005 P7), so the memory store can neither place an asked one by its result nor derive an unasked one; on a Stage 2 cell (topic words: Nature 12 of 14 items, Letters 46 of 89, Food 8 of 16, Crafts 8 of 16, Holidays 5 of 12) a passed test-out would mark the cell Done and skip it while most of its words were never taught or reviewed. With the limit, Test out is offered from Stage 3 up today (every Stage 3, 4, 6 and 7 cell is at 0 to 29%; Stage 6 Letters, 5 of 17, is the highest), and at least 70% of what a test-out skips is scheduled. The alternative, collecting a tested-out cell's topic words into the word slice, would add words the learner never answered to the collection, against "Words known grows only with items actually answered"; it is left for the owner.
- **Result and latches.** Stars only (F-RVW-001 3.1, first try, unhinted); 80% or more first try over every round is the 3-star tier, so a pass is never shown as anything but 3 stars. A passed Cell Check latches `cellCheckAt` (earliest, toward Mastered). A passed test-out latches `testedOut` only (Done, level 1 through CM-20's derivation and `mastery.level_up`), never `cellCheckAt`, `questDoneAt` or a quest's stars, so it never completes a stage (the wireframe's decision; a whole-stage skip is CM-25). The latches and the entry carry the memory store's guarded stamp (`stampOf`, CM-12's wrong-clock cap: at most a day past the latest stored answer or the server's time), never a device clock far ahead.
- **One entry per cell.** A finished Check writes or merges the cell's one `reviews[]` entry of kind `cell-check` (id `cell-check:<cell id>`, scope the cell, no profile id). The kind is never pruned because it carries a best result, so retakes merge into it (`mergeReview`: the best stars, then the earliest time at that best, so two devices converge) and the snapshot holds at most one entry per cell however often a Check is taken (the 30-cell retake test). A Cell Check records each first answer as given (the spacing rule), so a stopped one keeps them and writes no entry; a test-out writes nothing until it is finished, so a stopped one writes nothing.
- **Test-out placement** (4.5). An asked item not met yet is placed by its result: right first try to box 2, due in 3 days; on a passed test-out a miss (or a hinted answer) to box 1, due tomorrow; on a test-out that did not pass a missed item stays unmet (narrowing 3). An asked item already met (seeded or answered) follows the spacing rule, so a test-out never lifts a held box two steps. An asked topic word follows the spacing rule, recorded only if collected (narrowing 4).
- **Unasked items: derived, not recorded** (the CM-11 / CM-12 hand-off). Every item the tested-out cell teaches (not a topic word, not retired) gets a seeded-style state (`n` = 0: never uploaded, in no Words known or level) at box 1, due over the 3 days after the test-out's local day, round robin, at most 15 seeded items due on any day with the quest seeding's load counted in (beyond that, the next days). Cells in `testedOut` order, items in an FNV-1a order of the cell id; an item the quest seeding holds or an earlier tested-out cell placed keeps that state; an asked item is answered, so `laySeed` keeps its own state. `seedInputKey` includes `testedOut`, so a device derives again when a sync brings it, and two devices derive the same states (fixtures `test-out.test.ts` and `memory-runtime.test.ts`; fixed clocks at UTC+14, UTC-12, Asia/Seoul and America/Los_Angeles, and a spread across the US daylight-saving change of 1 November 2026).
- **`routeNext`.** The cursor (step 3) skips the quests of a tested-out cell; they stay playable and are never marked done. An assignment (steps 1 and 2) is never skipped, and a tested-out quest is never the placed-out fallback.
- **Worker first (W then A).** The PR's first commit appends `cell-check` to `GATED_REVIEW_KINDS`: the Worker serves the entries only to a reader that declares `?cap=cell-check` and keeps the stored ones when a build that does not re-uploads (section 13); the app declares `?cap=warmup,cell-check`; a backup file never holds the entry (its result is the latch, which the file keeps).
- **Telemetry.** `review.start { kind: 'cell-check' }` when the learner taps Let's go (an intro left with Maybe later or [x] sends nothing), `review.complete { kind: 'cell-check', stars }` and, for a test-out, `testout.finished { cellId, passed, items, firstTryCorrect }`, parsed by `CURR_TELEMETRY_PAYLOADS` before it is sent. No item, no text, no profile id in a URL (the route carries the cell id and the mode only).
- **Strings.** 19 learner strings (`cellCheck.*`, `testOut.*`) in en, es and ko, down from 21 at the first review: Cell Check, its line and button, Cell Check done, Take it again (its own words, as every quest row of the page has a Play again), the end lines ("the tricky ones", "Your best result is kept"), Back to this place, Back to the map, the three level hints (mastery-ring.md E, left to this row by CM-20); Already know this?, Test out, its intro, You tested out!, Good start! and its line, and Tested out. Shipped keys carry the rest: the star headlines, the stop sheet, the intro buttons, the test-out's Next lesson (`home.next.heading`) and its first quest's Start. The row's "about 10" did not count the end lines, the three hints and the two navigation buttons the wireframe names, and no shipped key says "Back to the map" or "Back to this place". They pass `review-copy` and the 7.7 list: "Cell Check" (es "Repaso a fondo", ko "칸 확인"); "Test out" is the spec's name for the way in, and no other string frames it as a test or an exam.
- **Not in this row.** The Journey stage header caption for a stage whose cells are all done or tested out (`learner.testOut.stageHint`, cell-check.md States) goes with the Stage Check row CM-22, which owns that header; E3's arms and exposure are CM-71; the lapsed-plan case is covered by unit tests rather than an e2e (`cell-check-api.test.ts`: the cell checked again at the start and the finish; `cell-check-block.test.tsx`: a locked cell offers none), recorded in the wireframe.
- **Budget.** `build:web --budget` (release build) measures the start bundle at 4,809,323 B raw / 1,268,690 B gzip, 189 B under main with CM-20 (4,809,512 B, the base it is stacked on) and 677 B under the 4,810,000 B line, which does not move. What the row adds there: the entry and slot (`cell-check-entry.tsx`), the route, the cell page's slot and Tested out pill, `routeNext`'s skip, the merge's one-entry rule and the 19 English strings (about 3,700 B at the first review, 779 B of them strings). It is paid for by importing React's hooks by name, never `import React, { ... }`, in the start-bundle modules this row touches or opens from the cell page (`cell-check-entry.tsx`, `DailyReviewRoute.tsx`, `EpisodeDetailView.tsx`, `StoryEpisodeDetail.tsx`, `CellStoriesScreen.tsx`, `StorySourcesScreen.tsx`, `lesson-content.tsx` and `navigation/root.tsx`): a default-and-named import makes Babel inline a wildcard interop helper of about 500 B into each module. **Open for the owner:** 341 modules of the start bundle carry that helper today, and about 217 source files of the app and the design system use that import, so a repo-wide codemod (or a shared Babel runtime helper) could shrink the start bundle by tens of kilobytes; it is left to its own row. (Closed by the named React imports row, 2026-10-23: the codemod took the helper out of 142 start-bundle modules, 69,890 B raw, and the line came down to 4,750,000 B; see Ceilings below.) The Cell Check's chunk is 13,011 B raw / 4,415 B gzip (`screenChunkRaw` 60,000 B), the memory chunk 78,692 B raw / 27,214 B gzip with this row's session logic, the Daily Review chunk 20,403 B, the mastery chunk 8,247 B.

**Later (row CM-25): Stage Jump Ahead.** It applies the Cell Check rule to a whole stage. It also amends F-PLC-001, because a learner could then be placed above `stage3`.

**Decision record (row CM-25, 2026-10-22; review fixes 2026-10-23).**
- **Where it lives.** The session is CM-21's, with a third mode: `planStageJump` and `testedOutKeys` (`logic/reviews/cell-check.ts`), `jumpOfferable` and the `jump` mode of `startSession` / `finishSession` (`cell-check-api.ts`), all in the memory chunk. The offer rule (`stageJumpOffer`, `jumpCells`) is `logic/reviews/cell-check-offer.ts`, read by the Cell Check's screen chunk only. The Journey line (`screens/cell-check/StageJumpLine.tsx`) rides in CM-21's chunk (`screen-chunk:cell-check`), reached through `StageJumpSlot` of `cell-check-entry.tsx`, which `JourneyGrid` draws under each stage's cells (`stageFooter`). The screen is CM-21's `CellCheck` route with `mode: 'jump'` and the stage key as `cellId` (a content id; nothing about the learner in the URL). No new chunk and no new route.
- **The Check.** One Check over the stage's playable grid cells (`jumpCells`): 20 rounds (the Stage Check's length, "About 7 minutes"), at least 10 playable (`STAGE_JUMP_MIN_ROUNDS`, a full Cell Check's 10; Stage 5's books teach no review items, so Stage 5 has no jump). Each cell's items go through the CM-13 Check selector on their own and the 20 are taken round robin from those orders, so every cell with a playable item is asked and a cell of many words cannot crowd out a small one; the selector's Check over the 20 then sets the produce share (at least 30%) and interleaves across the themes. Stars only; a pass is the 3-star tier (80% or more first try over every round), as CM-21.
- **Seeding by result.** As a test-out: nothing is recorded until the jump is finished; asked items not met yet go by their result (right first try to box 2, due in 3 days; on a pass a miss to box 1, due tomorrow; on no pass a missed item stays unmet); an item already met follows the spacing rule. Unasked items are CM-21's derived states (`deriveTestedOut`): box 1, `n` = 0, due from the day after over 3 days round robin, at most 15 seeded due a day with the quest seeding counted in, then the next days. A whole stage holds more than 3 x 15 items, so the cap spreads the rest over the following days without a gap. All the stage's cells share one instant, so cells are ordered by id; two devices derive the same states (fixtures in `test-out.test.ts` and `memory-runtime.test.ts`, fixed clocks at UTC+14, UTC-12, Asia/Seoul and America/Los_Angeles across the end of daylight time).
- **The latch.** A pass latches `testedOut` for every cell of the stage and for the stage key (`testedOut.stage3`), in one write, earliest wins; never `questDoneAt`, a quest's stars or `cellCheckAt`, so a jump never completes a stage or fires a ceremony (cell-check.md "test out and the stage"). Each cell shows Done (level 1), its quests "Tested out" with 2 stars, and stay playable. The stage key amends the 4.8 field table: `testedOut` is `Record<cellId | stageKey, ISO>`; every reader of a cell key ignores it (`routeNext`, `deriveTestedOut`, the mastery derivation). `routeNext` skips the stage through its cells (CM-21's skip), so no `routeNext` change was needed; a test pins it.
- **Where it is offered.** On the Journey stage header of the stage the route has reached, under its cells (the wireframe's Test out line, one stage up: "Already know this stage?" and a secondary Jump ahead): a stage from 2 to 7 whose every cell may take Test out (CM-21's narrowing 4, cell by cell: topic words at most 30% of each cell's items, so no Stage 2 jump today; Stages 3, 4, 6 and 7 qualify, Stage 5 has no review items), not jumped, no quest of it done and no cell of it tested out, every quest of it open to the learner (F-ENT-003 through `useQuestAccess`, the same as playing them; a locked stage shows no line, no lock, no price), every quest of every earlier stage done, placed out or in a tested-out cell, E3's offered arm, 10 or more playable rounds. "The stage the route has reached" keeps the jump's level honest: the coarse mapping of the level a jump stands for places out every lower stage, which the learner has then covered. No wireframe existed for this row; the line reuses cell-check.md B's pattern, and its built shots are in `design/screens/cell-check/` (README).
- **F-PLC-001 amended (section 3.6 "Above the ceiling", section 3.7, section 5).** `modeCeiling` is unchanged: no placement run goes above `stage3` band 0. `jumpLevelOf(stage)` is the next stage's band 0 (Stage 7 clamps to `stage7` band 0); `jumpedStagesOf(testedOut)` reads the stage keys. `effectiveRoute` takes `RouteOptions.testedOut` and folds each jump in by the maximum: the level rises to the jump's, and the quests of the cells the jump marked are placed out (a cell shipped later in that stage is new content and is not). The catalogue-growth rule keeps reading each result's own level. So a placement result and a jump never lower each other, and only a jump goes above `stage3` (fixtures: Short, Standard and Deep results each with a Stage 2 and a Stage 3 jump, in either order, `placement-stage-jump.test.ts`; the catalogue-growth and level-map tests of both packages). The planner passes it (`ProposalContext.testedOut`, so a plan starts past a jumped stage); the result screen, the start marker, the report and the summary read placement results only, as before.
- **The grown-up keeps the last word (fix stage, review finding).** A child can pass a jump without a grown-up seeing it, and the latch only gains keys, so the jump must not outrank a grown-up's choice. The newer of a jump and the grown-up override in force wins: `effectiveRoute` folds a jump latched before the override before it (the override's put-back covers the jumped stage) and one latched after it after it, and `routeNext` does not skip a tested-out cell latched before the override in force (a cell's own test-out too: the override "puts back the chosen one and all after it", F-PLC-001 section 3.9). The latch, its Tested out pills and the jump's level stay; only the route goes back. Showing a jump on the grown-up report needs new report copy and is left to a later row; until then **Choose a different start** is the grown-up's undo.
- **Every cell asked (fix stage).** A pass latches every cell, so `planStageJump` returns null when a cell that teaches review items would get no round (offline in es or ko with that cell's lesson chunk not cached, or no round of it can play here): the route then shows the "nothing" state and no cell is latched unasked.
- **The format cap (fix stage).** In a test-out every item is unmet, so the selector asked every non-produce pick at its ladder rung only, and a 20-round jump ran 11 to 14 heard rounds in a row. `buildCheck` now pins only the produce picks; the others keep the box 1-2 choice between recognize and read (section 4.3). With no device voice read is the only other way, so `buildCheck` lays the questions out again when a run of one format is longer than the cap (`spreadFormats`: each slot takes, among the questions that keep the caps, the one whose format has the most left). The questions and the produce share do not change, only their order; the jump test asserts no run over 3 on every shipped stage, with and without a voice. A Cell Check whose `compose` order already keeps the cap is untouched.
- **The plan update (fix stage).** A jump raises the planner's seed, so it is a start change: `planChangeAt` takes the snapshot's `testedOut` and counts each jumped stage's latch, so **Keep my plan** / the report's **Not now** after a jump holds with no level check, and a jump after an earlier kept change is offered. The update's `route.updated` source stays `retake` (no new value before the Worker accepts one).
- **On the route only.** The line does not show on a stage the level check placed out whole (a `stage3` band 0 result shows it on Stage 3, not Stage 2). The `CellCheck` route checks the same rule from the stores in jump mode before it plans and again before it latches (`stageJumpRuleNow`), so a stale or future way in cannot jump a locked, started or passed stage.
- **The result.** The jump's result takes the mastery moment as every result does, so no cell's rise reaches the next Results; it shows a Words known milestone the jump crossed, and no single cell's level-up. The Jump ahead button has no screen-reader hint (the prompt line above it is read once).
- **Telemetry (choice recorded).** `review.start { kind: 'cell-check' }` and `review.complete { kind: 'cell-check', stars }`, stars only, and one `reviews[]` entry of kind `cell-check` with the stage key as its scope. No `testout.finished`: a jump's items and first tries are not split per cell, and a per-cell event would report counts the learner was never asked per cell. No new event name, so nothing goes Worker first.
- **Gate and launch state.** `currFlagOn('cellCheck')` with `memoryRecord`, for a learner (CM-21's gate); built-in pct 0, so the row merges dark. Off: no Jump ahead line; the latched `testedOut` keys, the Tested out pills (shown again when the switch is back on) and the route skip stay.
- **Strings.** 6 learner strings (`learner.stageJump.*`: the prompt, the button, its screen-reader label with the stage number and title, the intro, its extra line and the passed headline) in en, es and ko; the not-passed result, the next and first-quest buttons, the stop sheet and the intro buttons reuse CM-21's and the shipped keys. `stageJump` joins the `review-copy` namespaces; no percentage, no exam framing, no age wording.
- **CM-21's review fixes, taken over (fix stage).** The jump uses CM-21's session gate at both ends (`on`), and checks the stage and each of its cells at both ends too (`jumpAllowed`: not jumped, each cell `testOutAllowed` through `testOutCell`), so a lapsed plan or a cell started on another device latches nothing. Its entry is CM-21's one entry per scope (`cell-check:stage3`), its latches carry the guarded stamp (`stampOf`), and `review.start` is sent when the learner taps Let's go. The e2e jumps Stage 3 after Stages 1 and 2.
- **Budget.** `build:web --budget` measures the start bundle at 4,808,980 B raw / 1,269,117 B gzip, 343 B under CM-21's head (4,809,323 B) and 1,020 B under the 4,810,000 B line, which does not move. What the row adds there (the 6 English strings, the slot, the stage footer, the route fold in the content-schema placement module, the planner context, the override rule in `routeNext` and `planChangeAt`) is paid for as CM-21 did: React's hooks and types imported by name, never `import React, { ... }`, in the start-bundle modules this row touches or whose offer it changes (`JourneyScreen.tsx`, `JourneyGrid.tsx`, `RouteProposalScreen.tsx`, `PlanPromptCard.tsx`, `RouteOverviewScreen.tsx`). The Cell Check chunk is 17.1 kB, the memory chunk 80.8 kB.

**Decision record (row CM-14, 2026-10-22).**
- **Gate.** The Daily Review and Keep going run while `currFlagOn('dailyReview')` and `memoryRecord` are both on for a learner profile (with answers not recorded the review would repeat itself, `design/wireframes/reviews/daily-review.md`). `dailyReview` keeps built-in pct 0. Off, slot 3 keeps today's chain (word set, story, replay), a pinned Daily Review card gives way to it, and the route shows "All refreshed today". Shadow rule: the row may merge now; `dailyReview` is not ramped in `remote_config` until `memoryRecord` has run its 2-week shadow and the due-pool sizes match the CM-13 simulation.
- **Slot 3.** The card shows from 3 due items, or once the day's Daily Review is done (collected, still tappable: the done-today page). It replaces the vocabulary card, whose due words the engine reads from the `vocab` slice. On a review-first day (more than 3 x 10 due) the plan's first card is the Daily Review and the normal day's cards 1 and 2 follow in order, under "N items are ready to refresh"; the new lesson is never removed. The day pin keeps the order all day; a pinned plan never turns review first. One exception to the F-HW-001 §3.2 rule that cards never shift mid-day, as the vocabulary card already has: when the due count reaches 3 after the pin (the store could not be read in time at pin time, a sync pull, a re-seed), `repinDailyReview` puts the Daily Review in slot 3 unless the pinned slot-3 card is collected or a started story; nothing else moves. Home waits for the first read of the due count before it pins a fresh plan, at most 1.5 s (`DAILY_REVIEW_HOME_WAIT_MS`); a slower read pins the day without the card, which then joins slot 3 by that exception, so the Today cards and the new lesson are never held back (section 4.3). The unshipped `daily-test` card kind and its two strings are removed.
- **Formats.** The rounds are drawn from the review item with the shipped ways of asking: Listen and pick (`hear-pick`), the read pick (meaning, the reply of an exchange, or the letter for a shown sound), Type Hangul `see` and `picture` (graded by `gradeTyped`), and Sentence Builder. The section 7.1 formats (Dictation, Syllable Build, Match Shape, Cloze Pick) join with their rows behind `game.<kind>`; the engine falls back to another format or the read rung. A symbol is not heard (the device voice reads a lone letter's name), a frame with a blank is not heard or ordered, and a realia card needs its card, so `rea` items are left to their own surfaces. An item that cannot be played is left out and the engine is asked again without it; fewer than 3 playable rounds where the engine offered more is "All refreshed today". In es and ko the meanings come from the lesson chunks; an item none of whose chunks loads (offline, not cached) is skipped. The chunks of the options beside each answer, and of the items that take a skipped item's slot, are loaded too before the rounds are built; a meaning still missing is never shown in English beside Spanish or Korean ones: that option is not offered, or the item is asked another way.
- **Day log with no new field.** Today's Keep goings are today's `daily` entries (`scope` = the local day) minus the Daily Review. A stopped Daily Review writes no entry; the due items it drew are counted in memory for the app session toward the day's 20 (section 4.8 step 3). Once stopped Daily Reviews alone have drawn the 20 while items are still due, the day's Daily Review counts as done: the Home card collects, the route opens on the done-today page with Keep going (never "All refreshed today" while items are due), and every `daily` entry of that day is a Keep going (up to 3). The count is not persisted: after an app restart the day starts its 20 again, which can only add review.
- **Result.** Stars by F-RVW-001 section 3.1 over the rounds answered (first try, unhinted); "N got stronger" counts the session's items (and the credits inside sentences) whose best box `s` rose, read from the store after the answers are recorded. `review.start` / `review.complete` carry `kind: 'daily'` and the stars only. The 3 and 2 points of section 7.4 and the goal line on the result join with row CM-17's points API (`recordActivityPoints`), whichever of the two rows merges second wires them (tracked as a checklist line on both PRs, #819 and #831).
- **Retention (W then A).** `pruneDailyReviews` (content-schema) runs in the Worker's snapshot PUT, after every app merge and after each review write: only the `daily` entries within 14 local days of the newest `daily` scope stay. A year of daily use (a Daily Review and 3 Keep goings a day) keeps 56, about 22 KB with 10 item ids and the missed ones each. Amendment to section 4.8 (the section 13 wrong-clock rule): a `daily` scope later than `latestLocalDay(now)` (the latest local day any time zone has) never anchors the window, so one device with a clock far ahead cannot prune the real entries, today's included; the Worker drops such an entry, as it drops a later `dayLog` day, and the app keeps it until then (its own clock may be the wrong one). The Worker change is the PR's first commit and deploys first.
- **Where it lives (start bundle).** The engine, the rounds, the session logic and the reads and writes (`logic/reviews/daily-review-api.ts`) are in the memory chunk (`dailyReviewApi()`), so no scheduler module is shared by two chunks (Metro hoists a module two chunks share into the start bundle: a first build with the engine in the screen's chunk grew the start bundle by 16 KB). The screen and its rounds are the `daily-review-chunk` bundle (marker `review-chunk:daily`), loaded by the `DailyReview` route; it reaches the API through the boot module's `memoryChunk()`, as a chunk that `import()`s another chunk is not named by its md5. The start bundle carries the route, Home's hook, the mission card and the strings: 4,744,598 B raw / 1,247,230 B gzip on this branch with the review fixes (4,743,992 B before them, 4,738,790 B before the row), so the line is raised to 4,750,000 B.
- **Not in this row.** An assigned Daily Review in the Homework list (no assignment kind exists yet), the E1 and E2 experiments (CM-71), and the lapsed-plan e2e (the Daily Review draws only items already met, so access never changes what it asks).

### 4.6 Adaptive pacing inside a quest

- **Strong round:** first-try accuracy of 90% or more in Practice makes the second Discover page of later quests in the same cell **compact**: both items on one card, each with Hear it, and Continue at once. It also shortens Apply by one round. **No teaching content is ever skipped**: every new item of a quest still appears on a Discover surface before its first scored round.
- **Hard round:** two wrong first tries in Practice insert one scaffold round: the same items in an easier format, with the hint showing.
- Nothing is ever taken away and nothing is said about speed. The event is `quest.adapt { questId, dir: 'compact' | 'scaffold' }`.
- The F-CURR-001 timing bands describe the standard path. U-5 checks the standard path only. A new rule **U-11** checks every adapted path: each new item appears on a Discover surface before it is first asked.

**Decision record (row CM-24, 2026-10-22).**
- **Gate.** A learner's quest in an upper-stage lesson cell (Stages 2-4, 6, 7) adapts while `currFlagOn('questAdapt')` is on for the profile; built-in pct 0, so the row merges dark and the owner ramps it under the CM-70b guardrail (mid-quest quit rate). Off, a guest run, the All lessons preview, a Stage 1 quest or a story quest: the standard path, and the pacing chunk never loads. Stage 1 keeps one path because its rounds ask letters (a scaffold would need letter sounds the voice cannot say alone) and it is the guest's first quest.
- **Triggers.** First tries of the Practice step only (`quest-run-store` keeps each first answer with its step): strong is 90% or more right, in whole numbers (9 of 10 and 6 of 6 are strong, 8 of 9 and 5 of 6 are not), over 3 first tries or more (so a Practice left after a round or two with the game's Skip is never strong); hard is two first-try misses or more. A Practice skipped from its card is neither.
- **Where the strong round lives.** In memory for the app session, per profile and cell (device-only; never stored, synced or sent). It names the lowest quest index of the cell with a strong Practice; a later quest of that cell plays compact, an earlier one or a replay of the same one does not. Per session, not persisted: it needs no storage key, no cleanup when a profile is removed and no migration, and it cannot go stale across content changes; the cell's quests are usually played in one sitting. A persisted form can follow if the ramp shows it is wanted.
- **Compact.** The second Discover page, when it holds exactly two word cards (a word, a sentence, a pattern example or a realia key word; never a letter page or an exchange), draws both on one card, each row with its KoreanText, note, picture (smaller, `touchTarget.min`) and Hear it, so the card only regroups the page and nothing is left out; Continue is enabled at once, as on every page. Apply plays one round fewer when it has 3 rounds or more and its rounds are separate (Listen & Pick, Pic-Word Match, Sentence Builder, Type Hangul, Write a Frame, Card Match, Tap & Respond); a story order and a word's blocks keep theirs. Of the 78 shipped lesson quests, 45 have a two-word second page and 58 an Apply that can shorten. `quest.adapt { dir: 'compact' }` is sent once per run, only for this quest's own run and only when the run will reach what changes (a run not past the two-word second page, or not past the shorter Apply); a run resumed past both, or a player with no run, sends nothing and marks no shorter Apply. Every shorter Apply keeps two rounds or more and is the full Apply less its last round (checked over every shipped quest in the U-11 block); 17 shipped Applies go from 3 rounds to 2.
- **Scaffold.** After a hard Practice, one Listen & Pick round (the shipped format) before Apply, outside the six steps: the prompt is the last item missed on the first try, the options the missed items first and then the Practice's other items, three at most, all from the Practice scope itself (no new Korean), with the right card ringed from the start (the shipped hint) and one hint line; the ring stays on after a miss (the Listen & Pick flow keeps a ring once it is on). Every shipped Practice can scaffold (78 of 78): Pic-Word Match, Sentence Builder, Type Hangul, Listen & Pick and Tap & Respond by their words, Trace a Word by its traced words, Realia Read by each round's key word or, with none, its word answer (a picture or figure answer lists nothing). No scaffold offers two options that sound the same (U-8 `soundKey`, checked over every pair of Practice misses of every shipped quest). Its first answer goes to the memory store through `recordRound` (and so `recordAnswers`): a right answer marked hinted, a miss as a plain miss (a hinted answer is never wrong, `logic/memory/spacing.ts`); it is not scored, so the stars, the step counter and every step's `durationSeconds` are the quest's own. `quest.adapt { dir: 'scaffold' }` once. Both payloads are parsed with `CURR_TELEMETRY_PAYLOADS` before they are sent.
- **U-11.** `upper-stage-curriculum.test.ts` runs every shipped lesson quest through four paths (standard, compact, scaffold after every pair of Practice misses, compact with scaffold): every Discover item is drawn by the cards `DiscoverStep` renders (`discoverCards`), no adapted round asks Korean the quest's standard rounds do not, and the quest object (steps, `durationSeconds`, scopes) is unchanged. U-5 still checks the standard path only.
- **Where it lives (start bundle).** The rules, the shorter Apply, the scaffold builder and its round view are the `quest-pacing-chunk` bundle (marker `quest-pacing-chunk:adapt`, `LEARNER_CHUNKS`), reached only through the literal `import()` of `screens/quest/quest-pacing.ts` while the switch is on. The start bundle carries the gate and loader, the player's hand-off, the compact card in `DiscoverStep`, the Listen & Pick `hint` prop, the run store's first tries and the two English strings: 4,807,110 B raw / 1,266,931 B gzip (release `build:web --budget`, on main 10ac11fb0; first measured 4,807,027 B on 33fd796af, where main was 4,804,191 B; a first build with the rules and the scaffold in the start bundle measured 4,810,495 B, over the line). The pacing chunk is 5.73 kB raw. The line (4,810,000 B) is unchanged.
- Design: `design/wireframes/quest/adaptive-pacing.md`.

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

**Decision record (row CM-11, 2026-10-22).**
- **Where it lives.** Migration `0016_memory_shards.sql` (0013 to 0015 were taken by then) adds the table above, with `learner_id` a foreign key on `learners` (`ON DELETE CASCADE`, and a learner erase deletes the rows explicitly too). The wire contract and the merge are `packages/content-schema/src/memory/memory-sync.ts`, reached as `@hangul-route/content-schema/memory` and kept out of the package barrel, so the start bundle does not carry them; the item state stays `MemoryItemStateSchema` of `schemas/sync.ts` (row CM-3b). The Worker's merge is `packages/backend/src/lib/memory-shards.ts`, the routes are in `routes/sync.ts`.
- **Push.** `POST /api/sync/learners/:id/memory` takes `{ shards: { <shard>: { <item id>: state } } }` and answers `{ stored, seeded, written }`. A declared or real body over 64 KB, more than 500 states (counted before validation) or more than 24 shards (16 at the end state) is `413 payload_too_large` with the caps; a malformed body is 422 with issue paths only. The body is checked by `parseMemoryPush`, a hand-written copy of `MemoryPushSchema` that a property test holds equal to it, because zod alone took most of the CPU budget. A shard whose merged text equals the stored text is not written, so a repeated call writes no row.
- **Seq and races.** Each written row takes `MAX(seq) + 1` inside its own statement, so in D1's single writer every commit has a higher `seq` than any row a reader has seen. Each write is a compare-and-set on the `seq` the merge read (an insert only while the shard has no row); a shard another isolate wrote in between is read and merged again, up to 3 times, then `409 conflict`. A Worker that runs before the migration answers both routes `503 memory_unavailable`.
- **Pull.** `GET .../memory?since=<seq>` returns `{ cursor, shards: [{ shard, seq, states }] }` in `seq` order, the stored text passed on unparsed. A cursor past the learner's highest `seq` reads from the start. A Rescue Code claim is unchanged: the claimed device pulls with `since=0`.
- **App hook.** `apps/mobile/src/logic/sync/memory-hook.ts` is the store hook CM-12 fills (`backup`, `restore`, `pull`). The backup card writes the `memory` key only when the store holds states, the file restore hands the key to the store, and an adopted learner (Rescue Code claim, re-link) starts the store's pull. With no store registered nothing changes.
- **CPU (assumption 8).** `memory-shards-bench.test.ts` runs the whole push path (parse, caps, validation, seeded filter, clock guard, merge into 2,300 stored items, serialize) for 500 states. The merge parses each stored shard once and merges the sent states into it in place, re-sorting keys only when an item is added. Measured on the development machine (Apple M4, Node 22): 1.8 ms warm and 3.6 ms on the cold first run, of which 1.1 ms is the native parse and serialize of the stored shards themselves (266 KB at the end state), about 0.3 ms the body's parse and validation, and about 0.4 ms the merge. Lowering the state cap to 250 saves about 0.35 ms, so the cap stays at 500; the stored shards are what scale, and they are bounded by a learner's whole store (2,300 items, all in the three touched shards in the benchmark), whatever the shard count of a call. CI runs the test on a shared runner under v8 coverage, where the first CM-11 run measured 7.2 ms warm and 14.2 ms cold. The runner is not taken as Worker CPU: each round also runs a fixed reference workload (a 2,000-row JSON parse, Map fold and serialize, unrelated to the memory code), and the times are divided by how much slower than on the development machine (0.64 ms) that reference ran, never by less than 1. The gate is under 5 ms warm (half the 10 ms free-tier limit, leaving the rest for routing, auth and D1 I/O) and under 10 ms cold, at development-machine speed; the test prints both the raw and the scaled numbers. If either fails, the cap is lowered or the stored shards are made smaller.
- **Byte cap first.** A state is about 90 B of JSON plus its id (up to 64 characters, 47 today), so with real ids 64 KB holds about 450 states and the byte cap, not the 500-state cap, is the one a full queue meets. The body is read only up to 64 KB, with or without a declared length. Row CM-12 splits its queue by bytes as well as by count (the 413 details carry `maxStates`, `maxBytes` and `maxShards`).
- **Item ids.** The push, the pull and the backup file's `memory` key share one id cap, `MEMORY_ITEM_ID_MAX` (64), so an id the Worker stores is never dropped on a pull or a restore. A content test holds every frozen review-item id and topic word id under it.
- **Wrong clocks.** Before it merges, the Worker reads a pushed `at` up to 10 minutes after its now as now; further ahead, the stored schedule (`b`, `d`, `c` and its `at`) is kept when the item is stored, so a later real answer from another device still wins on every later sync, while `r`, `n`, `f` and `s` still merge; with nothing stored it is read as now (`boundMemoryStateToNow`, section 13). Row CM-12 caps the `at` it writes at the last server time seen.
- **Rows per call.** A push writes at most one `memory_shards` row per touched shard, and none for a shard its merge leaves unchanged. Like every device route, `authorizeDevice` also writes the device's `lastSeenAt`, so a push writes up to touched shards + 1 rows and a pull 1 row. The snapshot routes already do the same. So the cost line above (1-3 rows a sync) counts the shard rows only: each memory call adds one device row, and the rows-written guardrail (3.3) counts the device rows too.
- **App hook timeout.** The backup card and the file restore wait at most 3 s for the memory store (`MEMORY_HOOK_TIMEOUT_MS`), then go on without it, so a store that hangs never stops a backup or a restore.
- **Hand-off to row CM-12 (states with `n` = 0 that are not seeded).** Every state with `n` = 0 is treated as seeded and never syncs. Two other states have `n` = 0 under sections 4.3 and 4.5: an item first met on a Discover page before its first scored answer, and the unasked items of a test-out. CM-12 either counts a Discover meeting as `n` ≥ 1, or derives both deterministically from snapshot fields (`questDoneAt`, `memSeededAt`, `testedOut`) the way seeding is derived, with a "derive the same on two devices" fixture for test-out and Discover-met items.

**Decision record (row CM-12, 2026-10-22).**
- **Where it lives.** `apps/mobile/src/logic/memory/`: the spacing rule (`spacing.ts`), what a round asked as review items (`resolve.ts`), the seeding (`seed.ts`), the day counts and `memory.daily` (`daily.ts`), the stored shape (`memory-file.ts`) and the runtime (`memory-runtime.ts`). The runtime is a lazy chunk of its own (`memory-chunk.ts`, marker `memory-chunk:runtime`, held by `pwa-postbuild.mjs` with the other marked chunks: never in the start bundle). The start bundle carries only `boot.ts` (the gate, the wiring and `recordAnswers`, the API the warm-up, Daily Review and Check rows call), `keys.ts` and one optional argument per game. `@hangul-route/content-schema/review-items` and `/memory` gained a file at the package root, as `overlays.ts` has, because Metro reads the path, not `exports`.
- **Gate and shadow mode (section 12.3).** Everything runs only while `currFlagOn('memoryRecord')` is on for a learner profile; a grown-up persona never records (section 4.9). `memoryRecord` keeps built-in pct 0. Off, nothing is recorded, seeded or sent, and nothing is deleted: a profile switch then only saves the outgoing store, and a restored backup file's states are kept on the device without asking for a sync. No memory surface exists in this row (no review screen, ring or counter): it records, seeds, syncs and sends `memory.daily` only. One thing a learner in the ramp can notice: topic words are scheduled by the spacing rule while it is on (below), so which words a word review picks and when the word nudge comes can differ from a learner outside the ramp.
- **Store and partition (sections 4.8, 4.9).** One stored value per profile, `memory:<profileId>` (IndexedDB on the web, the app's storage on native, through `platform/storage`), listed in `store/profile-keys.ts` and deleted on `onProfileRemoved`. It holds each answered item's shared state with its shard, the device-only facts of the spacing rule, the pending ids, the pull cursor, the seeding it was derived from and the day's counts. Seeded states are not stored: each read of the store derives them from the snapshot, so the stored value holds only answered rows (with all 107 quests done and one answer it is under 2 KB, against about 100 KB with the 620 seeded rows; Android's AsyncStorage database is 6 MB for every learner of the device). The value is read with `readJsonExact`, and a stored value that is not an object is never written over. A switch of the active profile saves the outgoing profile's store and starts its push before the next profile activates.
- **Rungs.** `r` bit 0 is recognize, bit 1 read, bit 2 produce; `c` is 0 recognize, 1 read, 2 produce, 3 the ladder passed in full (review keeps asking at produce).
- **The spacing rule needs facts the shared state does not hold.** "First answer of the local day", "fell today", the day of the previous spaced answer (the lag of `memory.daily`) and the last durable answer (the north star) are device-only facts beside each state, never uploaded. `at` moves only when `b`, `d` or `c` change, so an answer that changes no schedule never wins the last-writer-wins merge of CM-11, and it is never more than a day past the latest stamp the store holds (its own and every pulled state), as the word slice's clamp, so a device clock set ahead stops (CM-11's clock guard holds the server side). Because every spaced answer moves `d` past today, an answer on another device the same day is spaced at most once there too.
- **Topic words (F-VOC-005 P3 as amended by CM-0b).** `applyVocabEvents` takes the spacing rule while `memoryRecord` is on (boxes 0-5, schema unchanged). The "fell today" check of F-VOC-005 section 3.4 reads the stamp's local day, but the stamp clamp (24 hours past the latest stamp in the slice, section 3.3) dates the stamp of a learner back after a day away before today; so a word counts as fallen when it stands below its best box, is due tomorrow and was answered today (`last`), or its stamp is on today (a "Show me again" moves no `last`). A right answer early on a word that happens to be due tomorrow below its best box reads as fallen (no second fall that day): the cautious side.
- **Recording from every surface.** Only the first answer of a round is recorded (it is the scored one). The host games pass their scope and the answered round or pair id (Listen & Pick, Pic-Word Match, Sentence Builder, Realia Read, Type Hangul, Write a Frame); the older games pass the Korean or the jamo they asked (Match Sound, Build a Letter, Card Match, Tap & Respond); story checks pass the check, reader checkpoints the story tier. One answer grades the item the round asks and no other: a Realia Read round its card (one `rea` item, read rung), a story check its Korean target (its Korean right answer only when it has no target); "credit inside sentences" belongs to CM-13. Recycle rounds are rounds like any other. An asked text is the item with the same Korean (normalized as the build keys items), preferring an item the round's own cell teaches, then the kind the context names. Trace rounds copy a shown word, Voice Echo speaks, and Culture Quiz, Odd One Out and Story Sequence ask no taught unit, so they record nothing. An answer to a topic word goes to the word slice (`recordVocab`, source `review`), for words the learner has collected only, so no topic meter grows in shadow mode. An answer to a topic word the learner has not collected (the quest round words such as 김치, 밥 and 김밥 before their topic is opened) is not recorded anywhere: during the shadow the `lex` cells of the G1-G3 baselines count only collected topic words and the lesson words.
- **Hand-off from row CM-11 (states with `n` = 0 that are not seeded), closed.** A Discover page does not meet an item: the item is met by its first scored round, recorded with `n` >= 1 (section 4.3 is amended to match), so the only `n` = 0 states are the seeded ones, derived the same on every device. The unasked items of a test-out (section 4.5) are left to the test-out row (CM-21): it either records them with `n` >= 1 or derives them from `testedOut` the way seeding is derived, with its own "derive the same on two devices" fixture. Until it ships no test-out exists, so no such state does.
- **Seeding (steps 1-6).** Items carry their cells, not their quests, so step 1's "box 2 when the quest scored 3 stars" takes the cautious reading: an item's seed box is 2 only when every done quest of the cells that teach it scored 3 stars, else 1, and a cell that only asks it again (a recycle) dates it but never raises its box; its first day is the local day of the earliest quest of those cells. Only quests done by `memSeededAt` count, so a later quest never changes another device's derivation. The order is the latest finish of the item's cells, then the stage, then the id; day 1 is the day after `memSeededAt`'s local day, 15 a day. A story's listen quest seeds the story's taught words. The device that latches `memSeededAt` sends `items.seeded` once; a device that receives it by sync derives the same states without sending. A learner registered for sync latches only after this device's first successful snapshot sync of the session (a stale or blank local snapshot never latches a wrong seeding); a learner not registered latches at once. Every read of the store, every app start and every snapshot sync derives the seeded states again when their inputs changed (`seedInputKey`: the quests done by `memSeededAt` with their finish and 3-star mark, the route's priority tokens, the local day of `memSeededAt`, the item index), so a device that seeded before a sync brought older quests ends with the same states as the others; a merge that moves `memSeededAt` earlier is one such change. An answered state from elsewhere replaces a seeded one whole, as the seeding keeps an answered one. A new learner with nothing done latches too and sends `items.seeded` with `countBucket` `0`. The derivation reads local days, so two devices of one learner in different time zones can place a seeded item a day apart; seeded states are never uploaded, so nothing compares them. An item's quests are those of the cells that teach it and of those that ask it again (CM-10's `cells` and `asked`). Measured on this build (733 items): a learner with all 107 quests done and 2 priority symbols seeds 620 items over 42 days, at most 15 a day.
- **`memory.daily` (section 11.3).** One event a profile-day on each device, for the last day with answers, sent when the next day's first answer comes or the app starts or comes back on a later day (a learner who studies on two devices on one day sends two). `hist` counts spaced answers by kind x rung x lag (days since the item's previous spaced answer on this device; with none here, an item answered on another device counts from the day its schedule last moved, `d` less its box's interval, and a topic word from its last answer; never before the first day); `lapses` spaced answers not right first time. A seeded item's first check (an answer to a state with `n` = 0) moves its schedule by the rule but is not measured: it is in no `hist` cell and no lapse, and it is neither durable nor newly held, because its lag would run from its quest, often months back, and an all-done learner would add about 15 "durable" items a day during the very weeks that set the baselines; `items` distinct items answered; `newHeld` items whose best box reached 3; `minutes` the day's session minutes by `localDay`; `durableWeekBucket` items with a durable answer in the 7 local days ending that day; `dueVolumeBucket` the due pool at the day's first answer. No `calib` (CM-72) and no `arms` (CM-71). Every payload is parsed with `CURR_TELEMETRY_PAYLOADS` before it is sent. Worker first: the four bucket fields of `items.seeded` and `memory.daily` take only the codes of their shared edges (`ItemCountBucketSchema`, `SeededCountBucketSchema`, `SpreadDaysBucketSchema`), and the spread edges run past 31 days (31-45, 46-62, 63-90, 91+), so the shadow check can tell a spread against gate S-c's 62 days (this build's all-done spread is 42 days, `31-45`).
- **Baselines (section 3.2).** G1 reads the `4-7` and `8-14` lag cells (its "6-8 days" falls across the two; the lag buckets of section 11.3 are kept). G3 reads `newHeld` and `minutes`. G2 (items introduced in a 30-day window with 3 or more spaced answers within 30 days) needs a per-item count no field of `memory.daily` carries, so the shadow gives no G2 baseline: row CM-12b adds a bucketed G2 counter, Worker first, and G2's baseline starts when it ships.
- **Sync.** Answered states (`n` >= 1) are queued in the store and pushed after each snapshot sync of the learner (the existing offline queue: the sync scheduler retries when back online), in calls within the CM-11 caps; a class device's `403 scope_limited` keeps them on the device for the session. Each sync then makes one GET of the shards written since the cursor (the CM-11 route is not paged, and each GET writes the device's `lastSeenAt`); a Rescue Code claim pulls from 0. The schedule stamp `at` is capped a day past the later of the last server time seen (the learner's last snapshot sync, the inbox `serverTime`, CM-11's hand-off) and the latest stamp in the store: the hand-off names only the server time, but a state pulled from another device can carry a later real `at`, and an answer here must not be stamped under it. With neither (a learner never synced) there is no cap, and CM-11's `boundMemoryStateToNow` reads such an `at` as now on its first push. Backup files carry the answered states (`memory` key); a restore folds them in with the shared merge and queues them.
- **Shadow rule.** `dailyReview` (CM-14) keeps built-in pct 0 and is not ramped until `memoryRecord` has recorded for 2 weeks and the seeded due spread and the real due-pool sizes are checked against the CM-13 simulation (assumption 7). The two weeks start at `memoryRecord`'s first remote step. Building and merging CM-13 and CM-14 does not wait for the shadow; only the `dailyReview` ramp does (runbook K-4).
- **Start bundle.** `build:web --budget` measures 4,738,771 B raw (line 4,740,000 B) on this branch, which carries CM-10 and CM-11: about 4.3 KB for the boot module, the vocabulary spacing rule, the two store hooks and the game arguments. The memory chunk is 34.1 KB; nothing of the scheduler, the seeding or the sync is in the start bundle.

**Decision record (row CM-16, 2026-10-22).**
- **The block on the device.** `apps/mobile/src/logic/memory/summary.ts` (`memorySummaryOf`, in the memory chunk) computes `summary.memory` from the profile's store and snapshot: `wordsKnown` counts `lex` rows at best box `s` >= 2 with `n` >= 1 and `r` >= 1 (review fix: a seeded box followed only by wrong answers is not known, since seeding writes `s` with `n` 0 and a wrong answer leaves `s` where it was) plus topic words at `bestBox` >= 2 with `seen` >= 1 (retired items kept, so it never drops; a seeded box alone never counts); `readyToRefresh` is the due pool (the runtime's own rule, seeded items included); `cellBestCounts` counts `cellBest` entries at exactly level 1, 2 and 3 (CM-12 seeds level 1; CM-20's levels 2 and 3 show with no change); `stageChecks` counts `stageCheckAt` keys; `weekPoints` sums `dayLog` over the ISO week, Monday to today (0 without `dayLog`, until CM-17); `topDue` is the 8 due items in selection order (lowest box, oldest due day, then an FNV-1a jitter of the id). The start bundle holds only the last block per profile (`logic/sync/memory-hook.ts`): the sync asks the store for it, within `MEMORY_HOOK_TIMEOUT_MS`, right before each snapshot PUT, and the in-app report asks when it opens (read-only). A profile that does not record (`memoryRecord` off, a grown-up persona) sends no block, and the Worker keeps a stored block when a summary lacks one (CM-3b), so nothing is deleted.
- **Consent.** The block got its own consent item, `memory` ("Words known, how well each episode is known and Stage Checks passed. Points this week and items ready to refresh", in en, es and ko): `transfer-2026-10e` (10d plus the item; every earlier text stays accepted) and `class-scope-2026-10b` (the list names it; the pinned hash now covers the generated list too, so an item cannot reach the list without a bump). `memory` moved from "hidden" to `TEACHER_FULL_SCOPE_EXTRA_KEYS` with `FULL_SCOPE_KEY_VERSIONS.memory = MEMORY_SCOPE_TEXT_VERSIONS = ['class-scope-2026-10b']`: a family always reads it; a class or school reads it only for a learner whose family acknowledged the 10b text. The 10 acknowledgement keeps the full scope without it (`FULL_SCOPE_TEXT_VERSIONS` keeps both), the update reads as needed again until the 10b text is acknowledged (until then teachers see what they saw before), an acknowledgement that opens less never replaces one that opens more (`classScopeRank`), and a class-move consent at `transfer-2026-10d` acknowledges `class-scope-2026-10`. The `CLASS_SCOPE_FULL` kill switch closes the memory counts with the rest. Both acknowledgement bodies carry an optional `shown` (review fix, Worker first): the class-scope text the client drew from its own bundle. A client from before this row confirms the version the Worker names current but sends no `shown`, because it drew the 10 list without the `memory` item; the Worker records that acknowledgement at `class-scope-2026-10` (`CLASS_SCOPE_PRE_MEMORY_VERSION`, `acknowledgedScopeVersion`), which keeps the full scope without the memory counts and keeps the update needed. Only a current build, which drew the 10b list, opens them. So an installed native build or a cached PWA never opens the memory counts after a list that did not name them, however long it stays in use.
- **Teacher read route.** `GET /api/spaces/:spaceId/learning-summary` (`routes/space-reports.ts`, body `LearningSummaryResponseSchema` at `@hangul-route/content-schema/learning-summary`, outside the barrel): each learner's block (`memory: null` where the reader may not read it), and `class: { learners, counted, topDue }`, the items due for the most learners with how many have each one due (content ids only, ordered by count then id, at most 8). No item state, no name, `Cache-Control: no-store`, no server event. It requires `summary.read`, not the `snapshot.read` that section 8 names: `can.ts` never grants `snapshot.read` to a class role (a teacher never reads the saved progress itself), so `snapshot.read` would shut out the teacher the route is for; the block is part of the summary, which `summary.read` already covers for the roster and the reports, and each block is projected by the same memory scope as the roster (`memoryFor`). A school answers 409 `wrong_kind`. The class-tablet counts of row CM-62 have a typed hook (`classProgress` per learner, null, and `classProgressOf` returning none) that CM-62 fills.
- **Reports.** `learnerReport` carries `detail.memory` (current counts, absent without a block or when every count is 0), and the console's learner report and the in-app report draw a Words and review block in More detail, a line only per count above 0; `classReport` sums the blocks the class copy carries into `ClassReport.memory` (optional, totals only, with how many learners), drawn first in the class report's More detail. Nine English strings with es and ko (`report.detail.memory`, `.wordsKnown`, `.readyToRefresh`, `.mastery`, `.stageChecks`, `report.class.memoryFrom`, `.wordsKnown`, `.readyToRefresh`, `.stageChecks`). Design: the CM-16 sections of `design/screens/reports/learner-report.md`, `class-report.md` and `in-app-report.md`.
- **Review fixes (2026-10-22).** (1) `reviewOn`: the block carries `reviewOn: true` only while the profile has the review surface (`currFlagOn('dailyReview')`, row CM-14). Reports show items ready to refresh only then (`readyToRefreshOf`, learner and class): during the `memoryRecord` shadow period the seeded items fall due with nothing asking them, and a count that grows every day with nothing the learner can do reads as a backlog (section 7.7). The block and the learning summary still carry the due pool for `class-review` (row CM-63). (2) The mastery line names only the levels above 0 ("Episodes: 5 done" until CM-20 derives levels 2 and 3), so no zero reads as a result. (3) Across devices: each device computes the block before it pulls what other devices recorded, and the last upload replaced the summary, so a second device could lower what grown-ups read. The Worker now combines the counts that never drop on each snapshot PUT (`mergeMemoryCounts`, `lib/additive-fields.ts`): the larger `wordsKnown`, `cellBestCounts` recounted from the merged `cellBest`, the largest `stageChecks`; `readyToRefresh`, `weekPoints` and `topDue` stay as the sending device computed them today. The block can still be one sync behind the device's own latest pull; it never drops. (4) A Worker kill switch, `MEMORY_SUMMARY` (dashboard text variable, on when unset, `disabled` = off, the `CLASS_SCOPE_FULL` pattern; `GET /health` shows `features.memorySummary`): off, every reader (family, class, school; rosters, reports, the learning summary) reads no block, and the stored block is kept for when it is back on (runbook K-4). Turning `memoryRecord` down for a profile stops new blocks but leaves its last block readable, as true counts as of that day; the switch is the way to take the lines off every console at once. (5) Section 8 now names `summary.read`. After these fixes `build:web --budget` measures 4,742,801 B raw / 1,246,581 B gzip, under the 4,745,000 B line (no raise).
- **Start bundle.** `build:web --budget` measures 4,742,194 B raw / 1,246,397 B gzip on this branch (CM-10 to CM-12 below it), 3,423 B over CM-12's 4,738,771 B: the consent item's en and es text, the scope and report schema additions, the class report sums, the summary cache and the report lines, all of it in barrel modules or the in-app report screen the start bundle already carries. The line is raised to 4,745,000 B (`PRECACHE_BUDGET.startBundleRaw`).

**New snapshot fields** (optional, additive, lenient on read, preserved by the Worker before any app writes them; row CM-3b):

| Field | Contents | Merge |
|---|---|---|
| `cellBest` | `Record<id, 0-3>` | max |
| `cellCheckAt` | `Record<id, ISO>` | earliest |
| `stageCheckAt` | `Record<stage, ISO>` | earliest |
| `testedOut` | `Record<cellId, ISO>` | earliest |
| `goals` | `{ daily: 3 \| 6 \| 10, weeklyDays: 3 \| 5 \| 7, setAt }` | last writer wins on `setAt` |
| `dayLog` | `Record<localDay, Record<installKey, points>>`, the newest 70 days that hold points (counted as days, so one wrong-clock day evicts at most one real day). `installKey` is a random id made on the device; it never leaves the snapshot | max per day and install key; read as the sum over install keys |
| `streakLocal` | `{ run, lastDay }`, the current run on the local day | later `lastDay` wins; equal days take the higher `run` |
| `streakBest` | the best run ever | max |
| `stamps` | `Record<stampId, ISO>` | earliest |
| `memSeededAt` | ISO | earliest |
| `steadyWeeks` | `Record<weekMonday, ISO>`: the weeks whose learned days reached the weekly days in force that week (an active F-PLAN-002 plan's days, else `goals.weeklyDays`). The week is the ISO week on local days, Monday to Sunday in every locale, keyed by its Monday (`YYYY-MM-DD`), so a UI-language switch or two devices on different locales give one key. A pure, idempotent latch check writes it after each finished activity, each snapshot merge, on Home open and when goals are saved, over the weeks still in `dayLog` (7.4; `design/wireframes/home/goal-ring-weekly-dots.md`). The steady-weeks headline reads only its key count, so it never drops when `dayLog` passes 70 days or the goal changes | union of keys; earliest per key |
| `stageCeremonyAt` | `Record<stageKey, ISO>`: stages 2-7 whose ceremony was offered (7.3) or which the retroactive summary (step 7 below) listed. The summary lists only finished stages with no key, so no stage is summed up twice | union of keys; earliest per key |

- `SessionLog` gains an optional `localDay`, written when the session is logged, so a later local-day count never depends on today's time zone.
- `reviews[]` starts to receive `daily`, `feedback` and `stage-certificate` entries; the schema already exists. `ReviewKindSchema` gains `cell-check` and `warmup`. Because `ReviewKindSchema` is a strict enum inside `SnapshotPutSchema` and `BackupFileSchema`, row CM-3b first makes the `reviews` array lenient per entry on every read path (unknown kinds are dropped per entry, as `lenientArray` does in `sync.ts`) and deploys that to the Worker. Every row that writes a new kind is marked W→A.
- **`daily` retention.** `daily` entries (the Daily Review and each Keep going) are kept for 14 local days: after every merge, on the client and in the Worker's merge and preserve path, the list keeps only the `daily` entries whose `scope` (the local day) is within 14 days of the newest `daily` entry's `scope`. The prune gives the same result on every side, so the union never brings a pruned entry back. No other kind is pruned (`cell-check` and `stage-certificate` carry best results), except the quest warm-up and Try these again entries (`warmup`, `feedback`, one a local day, row CM-15), which carry no lasting result and follow the same 14-day rule (`RETAINED_REVIEW_KINDS`; CM-14 appends `daily`). A snapshot-size test covers a year of daily use (rows CM-3b and CM-14; `design/wireframes/reviews/daily-review.md`).
- `ProgressSummarySchema` gains an optional, lenient `memory` block, computed on the device and carried by the existing snapshot PUT: `{ wordsKnown, readyToRefresh, cellBestCounts: [l1, l2, l3], stageChecks, weekPoints, topDue: up to 8 item ids }`. It feeds reports, the console, the family lantern and `class-review` (sections 7.6, 8).

**One-time seeding on first launch of the new build.** It runs per profile, is idempotent, and is guarded by `memSeededAt`.
1. Every quest done in `questDoneAt` seeds its cell's items: box 2 when the quest scored 3 stars, box 1 otherwise. `n` stays 0, so no seeded item counts in Words known or in mastery above level 1 until it is answered.
2. **Stagger.** Seeded items are spread over `ceil(count / 15)` days from `memSeededAt`, at most 15 a day, ordered by the most recent quest first (the freshest memories are checked while they can still be recovered), then by stage. A learner with all 107 quests done holds about 930 seeded items, spread over 62 days. The spread length is reported in `items.seeded` as a bucket.
3. On any day, the Daily Review draws at most 20 due items, seeded items included, before it offers Keep going.
4. Topic words already in `vocab` are not copied; the engine reads them where they are.
5. Placement `priorityTokens` symbols are seeded at box 1, due on day 1.
6. `cellBest` starts at 1 for every cell done.
7. **Upper-cell cards and stage ceremonies are awarded retroactively.** Each card row (CM-23) awards its own cards from `questDoneAt` when it ships. The Stage Check row (CM-22) shows one summary screen, "You finished Stages 2-3 earlier", which lists whatever cards exist at that time. The summary is shown once, not one modal per stage, and each stage it lists is latched in `stageCeremonyAt`.
8. **Streak switch-over.** `streakLocal.run` starts at `max(old streakDays, the run recomputed on local days)`, and `streakBest` at the larger of that and any earlier best. The old `streakDays` is still written for older builds, but the new build displays only `streakLocal` and `streakBest`, so a sync from an older device can never make the number drop (section 7.4 names the one case between two new builds where a sync shows a run has ended).

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
| Page 1 | The five themes and seven stage rows, **exactly as today** (`design/wireframes/journey/grid.md`): the same cells, sizes, glyphs, words, states and rings. Page 1 never scrolls sideways inside itself, so a theme column is never cut off. With no pack shown the screen is today's, unchanged. *(CM-D3 proposal, owner to confirm:)* with packs shown, the page bar sits above the column labels and the header band is one height on every page (the larger of 64 dp and page 1's measured label height), so only the space above page 1's theme labels grows (`design/wireframes/journey/topic-pages.md` "Header band") |
| Pages 2 and later | Pack columns, **at most five a page**, in the pack order of section 6.5. With all eight packs: page 2 holds packs 1-5 and page 3 holds packs 6-8. A page with fewer than five packs keeps the same column width and leaves the rest of the row empty; columns never stretch or shrink to fill it |
| Cell size | A pack column uses the theme-column width of the same window (`journeyCellSize`), so a pack cell is 54 dp wide at 320 px, as on page 1, and **never under the 48 dp target**. At 768 px and in the two-pane wide window, pages keep the cell sizes of `grid.md` |
| Rows | Every page has the same seven stage rows at the same heights, so paging keeps the vertical scroll position. A pack level sits in the row of its stage (`levels[].stage`: Stages 2, 3, 4, 6 and 7). Rows 1 and 5 of a pack page hold an empty, unlabelled space, not a "coming later" cell |
| Column header | The pack's name and its `homeTheme` glyph. Tapping it opens the pack page; the target is 48 dp or more. *(CM-D3 proposal, owner to confirm:)* the full name does not fit a 54 dp column, so the header shows the pack's short word (`learner.journey.packWord.<key>`, one word of the pack's title in the UI locale) under the glyph, with the full title as the accessible name (`design/wireframes/journey/topic-pages.md` "The pack word rule") |
| Pack cell | Opens the level's cell sheet, like a theme cell. It shows the mastery ring of its pack level (4.4), and its entitlement follows section 6.3 |
| Which packs show | Packs with `status: 'ready'` whose `topicPacks` and `pack.<key>` switches are on. A page with no pack to show is not drawn. With no pack to show, the Journey view is page 1 alone, with no dots and no arrows: exactly today's screen |
| Swipe | A horizontal swipe moves one whole page and snaps to it. The gesture locks direction, so a swipe that starts mostly vertical stays a vertical scroll |
| Visible affordance | A row of page dots under the title, the current dot filled, and an arrow button at the right edge of the column-header row while a later page exists (a matching arrow at the left edge on later pages). The dots and arrows only appear when there are two or more pages. As designed in CM-D3 (`design/wireframes/journey/topic-pages.md`): the arrows sit at the two ends of a page bar directly above the column-header row, with the page name and the dots between them, because at 320 px the five columns fill the whole header row |
| Buttons (no swipe needed) | The arrow buttons are 48 dp targets or larger (64 dp, `touchTarget.min`, as designed in CM-D3), in the tab order, and do exactly what a swipe does. On web, Left and Right arrow keys change the page while focus is in the column-header row. After a page change, focus moves to the first column header of the new page; on page 1, which has no header button, focus moves to the page 1 region |
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
| F10 | **Yut Review** | review skin | any | M | the plain review screen | Every finished review item throws the yut sticks on a board, whatever its result, so the board never shows a miss (amended in row CM-D2; was "right answers throw"). The randomness is play only; it never decides a reward |

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

**Decision record (row CM-30, 2026-10-23): Cloze Pick (F1).**
- **Schema (additive).** `cloze-pick` is the last code of `MinigameKindSchema`; `ClozePickRoundSchema` (one sentence, one `___` in its Korean and in its romanization, 3 or 4 tiles, `answerIndex`, `gapKind` `word` (default), `particle` or `value`, and `filledRomanization` for a particle gap, whose particle links to the word before it) joins `RoundSchema` and `LessonScopeSchema` (`{ ref, kind, rounds[1..6], realia? }`). The refinement checks the gaps, that the meaning keeps its gap only for a value gap, distinct tiles, and for a particle gap the allomorph of the word before it (`물___` takes 을); the quest checks that a value gap has its card, that a card has a value gap, and that a value gap's answer is written on the card as a whole value (an entry's text or value, spaces and a closing 원, 시 or 분 aside), so a round never shows 5,000 won and accepts 3,000, nor shows 15,000 won (만 오천 원) and accepts 5,000 (오천); a tile that is another value of the card needs a sentence that names the line it asks (사과는 ___ 원이에요). Older content parses unchanged. Overlay fields: `clozePick.rounds.<roundId>.sentence.gloss`, `.tiles.<tile>.gloss`, and the card's `clozePick.realia.alt`, `.title.gloss`, `.entries.<entry>.text.gloss` and `.entries.<entry>.value.gloss` (as Realia Read's), so an es or ko learner reads the card in their language; a translated sentence meaning keeps exactly the gaps (___) of its English (one for a value gap, none otherwise; `content/__tests__/overlays.test.ts`, `cloze-gap-mismatch`), so no translation shows the answer before the tap. The review-item build reads a word or particle gap as its completed sentence (`pat`) and a word gap's answer word, and a value gap as its card (`rea`). No content row is authored here: the S3 and Stage 4 Holidays Checks of this section come with CM-3A.
- **Where it lives.** The game (`screens/minigames/ClozePickGame.tsx`: the Listen & Pick shell, layout A, with a text prompt card), its flow (a Listen & Pick flow with no sound before the answer), its prompt view and tile columns (`logic/cloze-pick/flow.ts`, `view.ts`) and the fixture build's e2e step (shipped unmounted: only a fixture build mounts it) are the `cloze-pick-chunk` (marker `screen-chunk:cloze-pick`, precached, 14 kB). The start bundle carries the door (`cloze-pick-entry.tsx`), the fallback (`cloze-pick-fallback.tsx`, with the value card `ClozeRealia.tsx` and the round helpers `logic/cloze-pick/round.ts`), the schema, the English strings, the lecture mapping and Listen & Pick's text prompt mode.
- **Gate.** `game.cloze-pick` through `currFlagOn` (`useCurrFlagDecided`, read once when the step opens, so a remote change never swaps the game mid-round), built-in pct 0 (`CURR_KEYED_BUILT_IN_PCT`): the row merges dark. The build floor is `EXPO_PUBLIC_CURR_GAMES_OFF=cloze-pick`.
- **Fallback (12.2).** Off, every round renders as the shipped Listen & Pick in its new text prompt mode (`textPrompt`: no speaker, nothing said before the answer, the Cloze heading and miss line, the sentence with its gap and meaning as the prompt, a value gap's card above it), on the same tiles, answer, round ids and scoring; the completed sentence is said once after the right tile. Existing Listen & Pick rounds are unchanged. `minigame.finished` names the kind drawn (`listen-pick` when off). The fallback never depends on the chunk: off, nothing is loaded; on, a chunk that cannot load, or does not answer within 15 s (the lesson chunks' timeout; its pending script is abandoned so a later step asks again), plays the fallback as well, so neither a broken build nor a hung network leaves the quest step stuck. `content/__tests__/game-switch-off.test.ts` reads every step of every quest and checks that each switched game's fallback plays all its rounds; until CM-3A authors the first `cloze-pick` steps it asserts only on the fixture scope, so CM-3A also asserts that the shipped count of `cloze-pick` steps is above 0. `cloze-pick-launch-state.test.tsx` renders the real launch state (no stored copy, built-in pct 0: the step waits for the stored copy, then plays the fallback and loads nothing) and the build floor; the Playwright suite answers a fallback step to the end.
- **Review engine (4.3).** With `game.cloze-pick` on for the profile, the review surfaces (Daily Review, Keep going, Cell and Stage Checks) may ask a sentence (`pat`) at the produce rung as Cloze Pick (`CLOZE_SURFACE_FORMATS`): one word left out, the meaning shown, word tiles taken from the same place, counted from the end, of other sentences, never one that differs only in its ending, is already in the sentence or makes another sentence of the same meaning. Off, or when no word has two such tiles (the surface index drops `cloze-pick` from such a sentence), the engine asks it another way (Sentence Builder) or at read. A round also needs the meaning in the UI language (without it 책이 ___ takes 있어요 and 없어요 alike): while it is missing the item is asked as Sentence Builder at the same produce rung, or skipped when it has no Sentence Builder. A `rea` item stays with its own surfaces, as CM-14 decided: the review item does not carry the card a value gap reads.
- **Memory and pacing.** A round records its completed sentence (or a value gap's card) at the produce rung, from the game and the fallback alike; one answer grades the item the round asks (section 4.8), so a word gap's answer word, which the review-item build also makes an item of, is never graded at produce here (picking a tile is no lex produce format of section 4.3) and a due answer word gets its read-rung credit inside the sentence instead. Adaptive pacing (CM-24) shortens a Cloze Pick Apply by its last round, and its scaffold round hears the completed sentences.
- **Lecture (8).** No new slide kind and no deck `v` change: a word or particle gap is a `check` question whose target is the sentence with its gap (its meaning shown, nothing said before the answer build); a value gap is a `realia` question beside its card. An older presenter skips the step as an unsupported one.
- **Telemetry (Worker first).** `leftAtKind` and `minigame.finished` take the new code through `MinigameKindSchema`, which the Worker parses (`server-events.ts`, `learning-rollups.ts`); the Worker deploys first so quits at the new kind are kept (an older Worker drops the unknown code).
- **Strings.** 10 English strings (`learner.minigame.clozePick.*`, `a11y.minigame.clozePick.*`, `learner.myRoute.games.clozePick`) with their es and ko values; `review-copy` and the 7.7 checklist pass.
- **Budget.** Release `build:web --budget` (Metro cache cleared): start bundle 4,762,235 B raw / 1,269,443 B gzip, against 4,751,444 B on main 524961dae (+10,791 B: the schema and its cross-checks, the strings, the lecture mapping, the text prompt mode, the door and the fallback with its card and round helpers). Main had 8,556 B left under its 4,760,000 B line, so the line is raised to 4,765,000 B (the measurement plus a 2,765 B rounding margin) as a one-line change. The fallback was first kept in the chunk to save about 4 kB; review found that it made the kill switch depend on the code it guards (a chunk that cannot load, with the switch off, left the step on the crash screen), so it moved to the start bundle. Learner screen chunks: the largest 34,298 B (line 60,000 B); the cloze-pick chunk 14 kB. Locale chunks: the largest 933,530 B (line 1,000,000 B).

### 7.2 Cards and albums

- **Upper-cell cards.** Each upper cell gives one card in its first volume, 25 in all. This settles F-CURR-001 OD-7 and unblocks the F-CARD-S2..S7 art specs, which were waiting on content that now exists.
- **Category albums.** The cards are grouped into five albums: Letters, Food, Holidays, Nature, Play. A finished album unlocks that category's legendary card. Albums give a goal that runs across stages and pull learners into the thin columns.
- **Packs.** Each pack gives 2 cards and a badge.
- **Retroactive cards.** Each card row (CM-23) awards its cards from `questDoneAt` when it ships (section 4.8).
- **Fairness.** Cards are never random and never purchasable.

**Decision record (row CM-23 part 1, Stages 2-3, 2026-10-23).**
- **One card per upper cell, earned by finishing the cell.** Each card names its cell in `unlockedBy: 'episode:stage<n>-<theme>'` and sits in the cell file's `rewardCardIds`; no quest carries it (`rewardCardId`), so it is the cell's card, not a quest card, and the award engine's episode rule gives it (F-STORY-006). The eight new cards (`upperCellCards` in `apps/mobile/src/content/heritage-cards.ts`, all rare; their backs in `content/upper-card-backs.ts`): Word Builder 노래 Song (`card:norae`), Holiday Words 복주머니 Lucky Pouch (`card:bokjumeoni`), Playground Words 그네 Swing (`card:swing`), First Sentences 한글 Hangeul (`card:hangeul`), Daily Mini-Sentences 떡 Rice Cake (`card:tteok`), Festival Sentences 보름달 Full Moon (`card:full-moon`), Animal Sentences 곰 Bear (`card:gom`), Game Sentences 윷 Yut Sticks (`card:yut`). Each Korean word is taught in its cell and romanized through the F-CNT-002 converter.
- **The taste cells keep their awards exactly** (F-CURR-001 "Cards", T-AWARD green). Lunch Box Words and Outdoor Words still give their four cards each, and their q1 `rewardCardId`s (`card:dosirak`, `card:byeol`) stay. **Their album card is that q1 card**: the cell's rare card and the one a learner earns first, so no shipped card moves and none is added. Those two are never gated by `upperCards` (`UPPER_CARD_SHIPPED`). Greeting Dialogues' `card:insa` is the same choice for part 2 (Stage 4).
- **Albums.** `content/upper-cell-cards.ts` lists the upper-cell card of each cell; the card carries its stage and theme, so an album is one theme's cards over the album stages 2, 3, 4, 6 and 7 (Stage 5 holds the books). The Library shows the five albums (Letters, Food, Holidays, Nature, Play) under Your cards: each row has the cards held, as faces that open the card page, and "N cards", or "New" for an album with none. It only fills: no empty slot is drawn and nothing counts what is left (D3, 7.7). `albumSets` (`logic/awards/albums.ts`) turns an album that can complete into a `set:album-<theme>` set, so a legendary card with that `unlockedBy` arrives through the existing set rule; it names no set while a slot has no card, and the legendary cards ship in CM-23c.
- **Retroactive award (4.8 step 7).** The new cards are dated by the cell's first finishes: the latest of each quest's `questDoneAt` latch (or its `completedAt` when no latch entry exists, the earlier of the two when both do), `firstFinishedAt` in `logic/awards/derive.ts`, used for the cards in `awardWorld.firstFinishCardIds`. A learner who finished the cells before this build gets the cards on the next reconcile (launch, sync, restore), once; two devices derive the same card and time whatever replays each holds, and their merge holds one entry (tests). Home names them in the existing catch-up card; CM-22's summary and stage ceremony now show a stage's upper-cell cards (`stageCeremonyCards`).
- **Gate and launch state.** `currFlagOn('upperCards')` (built-in pct 0, so the row merges dark). The award world drops a gated card the learner does not hold (`awardWorldFor`, `logic/awards/upper-cards.ts`): Results, the reconcile, the Library list and the cell page read it, so with the switch off no new card is awarded, listed, hinted or shown on a cell page, and a held card stays. The progress store reads the switch through `store/upper-cards-switch.ts`, which `App.tsx` wires to the remote config (`store/upper-cards-wiring.ts`); when a remote copy turns it on after launch, the reconcile runs then.
- **Art.** The ten album drawings (the eight new cards, `card:dosirak` and `card:byeol`) are `UpperCellCardArt` in `packages/design-system/src/components/HeritageCardArt/UpperCellArt.tsx`, a sibling of `HeritageCardArt.tsx` in the same geometric minhwa style and theme tokens (no new token), with their ids in `card-ids.ts` (`upperCellCardArtIds`, exported by the barrel). The drawings are not in the barrel: the app's upper-cards chunk (`screens/library/upper-cards-chunk.tsx`, marker `screen-chunk:upper-cards`, with the albums) imports the file by its own path, which Metro resolves without reading `exports` (the metro-subpaths test now allows a subpath that names a file of the package). `CardArt` shows the Korean-word face until the chunk is in, and keeps it while the switch is off. Budget test: each drawing at most 2,000 B of source, the module at most 16,000 B (13,020 B); the built chunk, with the card backs and the albums, is 15,908 B raw, under the 60,000 B `screenChunkRaw` line.
- **Sources (5.1, 6.6).** Every back-face fact cites a §6.6 institution: NIKL (복주머니, 반달가슴곰, 알고 싶은 한글), the Korea Heritage Service (단오, 추석, 윷놀이, 떡 만들기) and UNESCO (Arirang, inscribed 2012 under its UNESCO name; the Hunminjeongum Manuscript). The full sources with their access dates and quoted words are `apps/mobile/src/content/upper-cell-card-sources.ts`, test data that no app module imports; the card's back (`content/upper-card-backs.ts`, in the upper-cards chunk) carries only its source line (`citation`, the first source), which `HeritageCardSchema` now allows on a card without a story. The card page merges the back once the chunk is in (`useUpperCardBack`) and, like a story card, does not flip or share before that; it loads the back whatever the switch, so a held card keeps its fact. `lintCardSources` (the `culture-source` rule on cards, `lesson-lint.ts`) holds them to the allowlist. The review record (`UPPER_CARD_REVIEW`: MAR, author, three checkers, reviser and third pass) is in the same file.
- **Strings.** Six English messages (`learner.library.albums.*`: title, line, the five names, count, New, the row's spoken name) with es and ko, and the eight cards' titles, blurbs and facts with es and ko overlays (`content/i18n/{es,ko}/stage1-cards.json`). `library` joins the `review-copy` namespaces. The independent review passed the es and ko strings (its nits applied: ko 새로 시작, the gom fact's single 겨울, es "a partir de la Etapa 2"), and the fix stage re-signed `es.learner` and `ko.learner` in the review ledger. The title Hangeul keeps the Revised Romanization of the stories beside the shipped Hangul Day card and Hangul Check, whose shipped names this row does not change.
- **Start bundle.** `build:web --budget` measured 4,809,851 B raw / 1,270,481 B gzip on CM-22's 4,806,089 B (+3,762 B, under the 4,810,000 B line, which stays); after the fix stage, 4,809,488 B raw / 1,270,425 B gzip (512 B under the line; the app-host build, which CI also budgets, measures about 156 B more), with the card page's screen (`CardDetailScreen.tsx`) importing React's hooks by name too: the eight cards' fronts (the Library, Results and the catch-up read them), the gate, the first-finish dating, the wiring and the album strings, with the start-bundle modules this row touches (Library, the card page, `CardArt`, `App.tsx`) importing React's hooks by name, the CM-21 way. The card backs, the drawings and the albums are the upper-cards chunk (15,908 B raw).
- **Fix stage (2026-10-23).**
  - **All lessons is gated too.** The grown-up preview has no learner to bucket and reads no remote copy, so it reads `upperCards` at its built-in launch state (`currFlagOn('upperCards', null, null)`: off at pct 0, on at 100). Off, `browseBundleUnderUpperCards` (`logic/browse/upper-cards-gate.ts`, imported by the browse root only, so it is in the browse root chunk) leaves the eight new cards out of the card list and every episode's reward list: no catalogue entry, outline row or card link names one. On the learner card page, an upper-cell card the learner does not hold opens "Card not found" while the switch is off for them, with no earn hint (`useUpperCardBack(card, held).hidden`).
  - **The card page** draws the front's fact box only once the chunk with the back is in, and the upper-cards chunk is tried again every 5 s after a failed load while a surface that needs it is mounted. In the two-pane Library, an album card of another theme than the filter's clears the filter, so the pane can show it.
  - **Results** and the reconcile read one award world (`awardWorldOf` in `store/progress-store.ts`); a store test runs the last quest of Word Builder with the switch on (Song on Results, dated by the first finishes) and off (none).
  - **Launch order.** CM-22's one-time retroactive summary latches every stage it lists when it shows, so `upperCards` ramps together with `stageChecks` or before it: a summary shown before the upper-cell cards arrive lists none of them, and those cards are then named only in Home's catch-up card.
  - **CM-23c wiring.** `albumSets` is not yet in `awardWorld.sets` (no album can complete in part 1). CM-23c adds it with the five legendary cards; a test already runs a synthetic complete album through `derivedAwards` to its `set:album-<theme>` card.
  - **Headroom for parts 2 and 3.** About 350 B are left under the start-bundle line in the app-host build, so CM-23b and CM-23c cannot add card fronts to the start bundle as part 1 did: they move the upper-cell fronts (titles and Korean words) behind the upper-cards chunk, or pay the start bundle down first (for example the shared Babel interop helper the CM-21 decision record leaves open for the owner), before they add their cards.

**Decision record (row CM-23 part 2, Stage 4, 2026-10-23).** Extends the part 1 record above; everything there holds unless said here.
- **Four new cards, one per upper cell, each a polite line its cell teaches.** Stage 4 is the Dialogue stage, so each card is a line of its cell's talk in the polite 해요체 (`upperCellCards`, all rare, `unlockedBy: 'episode:stage4-<theme>'`, in the cell file's `rewardCardIds`, on no quest): Read Along 이게 뭐예요? What Is This? (`card:mwoyeyo`, q1), Kitchen Talk 맛있어요 It Is Tasty (`card:masisseoyo`, q2), Park Conversations 비가 와요 It Is Raining (`card:biga-wayo`, q1), Playdate Talk 같이 할까요? Do It Together? (`card:gachi`, q3, the cell's polite line; its other lines are casual). Romanization through the F-CNT-002 converter (test).
- **Greeting Dialogues keeps its award exactly** (F-CURR-001 "Cards", T-AWARD green): `episode:stage4-rites` still gives `card:annyeong`, `card:gamsa`, `card:chingu` and `card:insa`, and q1's `rewardCardId` is still `card:insa`. **Its album card is that q1 card, `card:insa`**, the same choice part 1 made for Lunch Box Words and Outdoor Words: the cell's rare card, the one a learner earns first, so no shipped card moves and none is added; it is never gated (`UPPER_CARD_SHIPPED`). It gains a Stage 4 drawing in the upper-cards chunk; while `upperCards` is off it keeps its Korean-word face, as before.
- **Retroactive award.** The four cards are dated by their cells' first finishes (`firstFinishedAt`, `questDoneAt`), so a learner who finished Stage 4 cells before this build gets them on the next reconcile, once, and two devices derive the same card and time (tests on `episode:stage4-letters`, and the e2e on the release build). Album progress across Stages 2-4 is tested: every album now has three slots that can fill, and still none can complete, so `albumSets` names no set until part 3. CM-22's Stage 4 ceremony and summary list the stage's five album cards (`stageCeremonyCards`).
- **Gate and launch state.** Unchanged: `currFlagOn('upperCards')`, built-in pct 0, so the row merges dark. Off: no Stage 4 card is awarded, listed or drawn; a held one stays; Greeting Dialogues' four cards are awarded whatever the switch (test and e2e).
- **Art (F-CARD-S4-001 as amended).** Five drawings join `UpperCellCardArt`: the four new cards and `card:insa`. Each is two round friends facing each other (Hoya's gold and a blue friend, `Pal`) with speech bubbles in the `HoyaBubble` language (`surface.canvas` fill, `brand.secondary` border, never red, `Bubble`), each bubble holding a drawn word: a question mark and an eraser, a question and a heart over a bowl, two warm hellos with a small bow, raindrops and a little house, a question and a star over a ball. Theme tint, theme tokens only, at most five fill colours besides the frame's tint and the shadow (the earlier stages' cap; S4-001's seven and its corner watermark are not used). Budget tests: each drawing at most 2,000 B (the new ones at most 1,600 B), the shared friends and bubble at most 2,600 B, the module at most 22,000 B (was 16,000 B; now about 19,700 B). The album ids moved from `card-ids.ts` to their own pure file, `upper-card-ids.ts` (package export `./upper-card-ids`), which only the drawings and the tests read.
- **Sources (5.1, 6.6).** Every fact cites the National Institute of Korean Language, re-opened 2026-10-23: the Standard Korean Language Dictionary entries 이게, 뭐 and 무어 (two short forms), 장마 (the summer rainy weather) and 반말 (talk used between people who are very close, neither raising nor lowering), and Standard Pronunciation article 15 with its proviso (맛있다 may be said [마딛따] or [마싣따]; the card says both are correct). No UNESCO claim. The rainy-season fact defines the Korean word only and claims no origin. `lintCardSources` passes. The review is part 2's own record, `UPPER_CARD_REVIEW_S4` (author, language, culture and facts, learning design, reviser and third pass, then the independent es and ko pass of the fix stage), kept apart from part 1's `UPPER_CARD_REVIEW`, with no native-speaker or expert claim.
- **Strings.** Twelve English card strings (the four cards' titles, blurbs and facts) with es and ko overlays (`content/i18n/{es,ko}/stage1-cards.json`); no new UI message. `check-i18n` and `validate-content` pass. The card strings live in the card overlays, not in the `packages/i18n` messages, so this part changes no ledgered English namespace and the review ledger needs no new sign-off (part 1's re-sign covers the album UI).
- **Fix stage (2026-10-23).** The independent MAR passed ko and failed es on one string; its fixes, applied: Playdate Talk's card is **Do It Together?** (es **¿Lo hacemos juntos?**, from a second es MAR of the changed strings: the first fix, ¿Lo hacemos en equipo?, added a teamwork sense 같이 does not carry, and juntos matches the cell's reviewed es gloss ¿lo hacemos juntos? (cortés)), because the cell glosses 같이 할까요? "shall we do it together?" and 할 is "do", so "Play Together?" / "¿Jugamos?" taught the wrong verb (the id `card:gachi` names the card's first word, as `card:annyeong` and `card:gamsa` do, and stays); the en and es masisseoyo facts name the headword masitda, which article 15 covers; the ko gachi fact reads '요'를 빼고 '같이 할까?'라고 하면 반말이에요. Art: It Is Raining draws every drop in `brand.secondary` and What Is This?'s eraser in `hoya.furBlue`, so each drawing has at most five fill colours; the colour test now sets aside only the frame's own tint and the shadow (it had set aside every theme value, and `hoya.fur` shares `theme.life`'s value, so the gold fur was never counted). Not taken: a two-line word face for a held phrase card whose drawing is not loaded (`upperCards` off after a ramp). The word face is in the start bundle; the change measured +193 B, about 60 % of the 331 B the app-host build has left under the 4,810,000 B line, which part 3 also needs; and CardArt's rule is that the full word is printed beside the face; it goes to a later row with its own start-bundle room. The off e2e seeds Stage 2-4 finishes without the rites cards and waits for the reconcile to award them before it checks that no Stage 4 card and no album appear.
- **Start bundle.** `build:web --budget`: 4,809,875 B raw against part 1's 4,809,851 B (+24 B), under the 4,810,000 B line, which stays. After the fix stage, on CM-23a's head `fad5f3345`: 4,809,513 B raw, 1,270,472 B gzip (487 B under the line); the app-host build (`EXPO_PUBLIC_GROWN_UP_HOME`, which CI also budgets) 4,809,669 B raw (331 B under). The four fronts and the cell files' `rewardCardIds` add about 600 B; they are paid for by keeping one copy of the album list in the start bundle (the art ids leave `card-ids.ts`), by moving the album order (`content/album-order.ts`) and `UPPER_CARD_SHIPPED` (test data) out of it, and by a front that omits its romanization when it is spelled like its id. The upper-cards chunk (backs, drawings, albums) is about 22 kB raw, under the 60,000 B line.

**Decision record (row CM-23 part 3, Stages 6-7 and the album legendary cards, 2026-10-23).** Extends the part 1 and 2 records above; everything there holds unless said here. This completes the 25 upper-cell cards and the albums.
- **Ten new cards, one per Stage 6-7 cell** (`upperCellCards`, all rare, `unlockedBy: 'episode:stage<6|7>-<theme>'`, in the cell file's `rewardCardIds`, on no quest; every cell of the two stages gives a new card, so no album slot waits). Stage 6 is real use, so each card is a thing read in the world, its Korean drawn in the picture: Read the Menu 원 Won (`card:won`, a menu board, 김밥 이천 원 and 라면 삼천 원), Order Food 여기요 Over Here! (`card:yeogiyo`), Travel for Chuseok 기차표 Train Ticket (`card:gichapyo`, 서울 → 부산, 두 시), Hike & Ask 정상 Summit (`card:jeongsang`, a trail sign), Buy at Market 덤 A Little Extra (`card:deom`, 사과 세 개 이천 원 and one apple more); amounts are round practice amounts in won, and no brand is drawn. Stage 7 is writing, so each card is a word of its cell's word bank on a ruled page with a sentence the cell builds: 이름 Name (제 이름은 호야예요.), 아침 Morning, 생일 Birthday, 토끼 Rabbit, 비행기 Plane; the cast is Hoya only and no card carries a learner's details. Romanization through the F-CNT-002 converter (test).
- **The five legendary cards** (`albumLegendCards`, legendary, stage 7, one per album in album order, `unlockedBy: 'set:album-<theme>'`): Letters 훈민정음 Hangul Book (`card:hunminjeongeum`), Food 장 담그기 Jang Making (`card:jang`), Holidays 한가위 Hangawi (`card:hangawi`), Nature 지리산 Jirisan (`card:jirisan`), Play 씨름 Ssireum (`card:ssireum`). Their sets are `albumCardSets` in `content/award-world.ts`, one per album, its members the album's five upper-cell cards; the award world reads them after the story sets, so the existing set rule brings a legendary card once all five members are held or derived, dated by the last of them, and `albumSets` (`logic/awards/albums.ts`) derives the same sets from the album views (test). An album completes only with all five; a held legendary card is never added again; the shipped album cards (`card:dosirak`, `card:byeol`, `card:insa`) count, whatever the switch (tests).
- **Retroactive award (4.8 step 7).** The new cards are dated by the cells' first finishes as in parts 1 and 2, and a legendary card by the latest of its members' times, so a learner who finished every upper cell before this build gets the ten cards and the five legendary cards on one reconcile, once, and two devices derive the same cards and times whatever replays each holds; their merge keeps one entry (unit, store and e2e tests). Home names them in the catch-up card.
- **The celebration.** A run that fills an album shows its legendary card on Results in the new-card banner (`CardUnlockBanner`, now with an optional title and line) with "Album complete!", the album's line and the F-MOTION-003 drop-in and sparkles (always, as a legendary moment); under reduced motion the banner is there at once, with no sparkles (render test). The extras row leaves the legendary card out, so it is shown once. The Library's album row says "Album complete" and leads with the held legendary card; a locked legendary card waits in Cards to find in a row named for its album ("Letters album"), with the hint "Collect every card in the Letters album" (never how many are left). Its face is its drawing in the upper-cards chunk, and its album's plate until the chunk is in (`CardArt`).
- **Gate and launch state.** Unchanged: `currFlagOn('upperCards')`, built-in pct 0, so the row merges dark. The legendary cards join `UPPER_CARD_GATED_IDS`, so with the switch off no Stage 6-7 card and no legendary card is awarded, listed, hinted or celebrated; a held one stays (tests and e2e).
- **Art (F-CARD-S6-001 and F-CARD-S7-001 as amended).** Fifteen drawings join `UpperCellCardArt` on three shared frames: `word` (Korean drawn in the picture with react-native-svg's `Text`), `Page` (the word-bank tile over a ruled page; a long sentence takes a smaller size so it stays on the page) and `Legend` (a frame in `colors.rarity.legendary` with the card's Korean on a label). Theme tokens only, no new token, at most five fill colours besides the frame's tint and the shadow, counted by part 2's stricter test (Ssireum's sand ring is the gold at 30 % opacity so the drawing keeps five). Their ids are `upperCellCardArtIds` (now 25) and `albumLegendArtIds` (5) in `upper-card-ids.ts`. Budget tests: each new drawing at most 1,700 B of source, the shared frames at most 3,200 B, the module at most 34,000 B (was 22,000 B; now 31,987 B). The built upper-cards chunk is 34,805 B raw / about 9.6 kB gzip, under the 60,000 B `screenChunkRaw` line. `UpperCellArt.tsx` joins the romanization scan's ignore list: the Korean drawn in a picture is never a reading aid, and each card's Korean and romanization are on its face.
- **Sources (5.1, 6.6).** National Institute of Korean Language (원, 여기요 from the Online Ganada answer, 역귀성, 덤, the loanword spelling rules, 에, 돌, 토끼, 종이접기, 한가위), the Korea National Park Service (trail start hours; Jirisan the first national park in 1967, 24 parks of which 19 are mountain parks) and UNESCO under the exact element names with the inscription year on the page: Hunminjeongum Manuscript (Memory of the World, 1997), Knowledge, beliefs and practices related to jang making in the Republic of Korea (2024) and Traditional Korean wrestling (Ssirum/Ssireum) (2018, on the joint application of the DPR Korea and the Republic of Korea). Sources a cell's MAR already recorded keep their access dates; the rest were opened again on 2026-10-23. The Getbol World Heritage page could not be opened (HTTP 403), so the Nature legendary card rests on the Korea National Park Service instead of an unopened page. The jang fact claims the inscription only, no origin. A test holds every UNESCO claim to a UNESCO source whose title is in the fact and whose page gives the year. `lintCardSources` passes. The review is part 3's own record, `UPPER_CARD_REVIEW_S67` (author, language, culture and facts, learning design, reviser and third pass, then the independent es and ko pass of the fix stage, whose four es fixes are applied in its wording), kept apart from parts 1 and 2, with no native-speaker or expert claim.
- **Strings.** 45 card strings (the fifteen cards' titles, blurbs and facts) with es and ko overlays, and five UI messages with es and ko: `learner.library.albums.complete` and `.named`, `learner.library.earnHint.album`, and `learner.results.albumDone.title` and `.line`; iOS reads "Album complete!" and the card title. The album names are one table per locale (`ALBUM_NAMES`). `check-i18n`, `validate-content`, `review-copy` and the 7.7 list pass. The review ledger is re-signed in the fix stage after the independent review of the es and ko strings.
- **Start bundle.** `build:web --budget` on part 2's fix-stage head (`ad213c881`): 4,809,752 B raw / 1,271,043 B gzip (248 B under the 4,810,000 B line, which stays) against that head's 4,809,513 B (+239 B); the app-host build (`EXPO_PUBLIC_GROWN_UP_HOME=true`, which CI also budgets) 4,809,908 B raw (92 B under). The ten fronts, the five legendary fronts and their sets, the cell files' `rewardCardIds`, the album-complete banner and the five English strings add about 2.4 kB; nearly all of it is paid for by deriving `UPPER_CELL_CARDS` from the cards (a cell's rare card, named for its own grid cell, after Stage 1) instead of listing it, by one `row` per stage for the fronts, and by importing React's hooks by name in six start-bundle modules of the screens this row extends (Results' `ExtraCardsBanner` and `ResultsFreeEnd`, the Library's `CardDetailScreen`, `CultureSection`, `StoryShelf` and `StoryTileGrid`), the CM-21 way. Under 100 B are left in the app-host build, so the next row that adds to the start bundle pays it down first or raises the line with its measurement. The largest locale chunk is 930,101 B raw (line 1,000,000 B). On main with the named React imports (#847), those six modules already import by name, so the row's cost there is its gross addition: +2,161 B raw on main 2851bac3b (4,744,852 B) and the same on main e31bc3b33, where #859 to #862 had brought main to 4,749,283 B. The head measures 4,751,444 B raw / 1,266,428 B gzip (release `build:web`, Metro cache cleared; the app-host build 4,751,600 B), 1,444 B over the 4,750,000 B line, so the line is raised to 4,760,000 B, that measurement plus an 8,556 B rounding margin (§10). The largest locale chunk is now 932,830 B raw.

### 7.3 Stage ceremonies for Stages 2-7

- **One prize table.** `PRIZE_STAGE = 'stage1'` becomes a per-stage table, `PRIZE_STAGES`.
- **What triggers it.** The stage latch (finishing the stage) triggers the F-MOTION-003 ceremony, a stage card and a "Stage N complete" page. The page appears in reports and in the Passport (7.5). Opening the stage card or that Passport page sends `stage.card_opened` (G5).
- **The Stage Check.** It is offered, never required, and it never blocks Stage N+1. Its best result latches and shows in reports.
- **Names.** The UI says "Stage Check", never "exam". No certificate is issued, which keeps F-CURR-001 section 4 in spirit. Amending section 4 for the checks is OD-1.

**Decision record (row CM-22, 2026-10-23).**
- **One prize table.** `PRIZE_STAGE = 'stage1'` is now `PRIZE_STAGES` (`logic/stage1/stage-complete.ts`): Stage 1 keeps its Hangul ceremony, Hangul Check and legendary cards exactly as they were (`opensStagePrize`, `ownsStagePrize` and the Stage 1 header unchanged); Stages 2-7 get the stage ceremony, the Stage Check and a stage card slot, behind `stageChecks`. `prizeStageOf(outcome, upperOn)` picks Results' one primary: "See your Stage N prize" on the run that finishes a Stage 2-7.
- **Gate and launch state.** The ceremony, its prize button and the retroactive summary run while `currFlagOn('stageChecks')` is on for a learner; the Stage Check needs `memoryRecord` too (answers are recorded). Built-in pct 0, so the row merges dark; the owner ramps it after the `memoryRecord` shadow. Off (12.2): no prize button, no ceremony, no summary and no check; `stageCheckAt`, `stageCeremonyAt` and the `stage-certificate` entries stay and show again when it is back on. The stage card slot also needs `upperCards` (row CM-23 ships the cards; until then the block is left out).
- **The Stage Check.** `logic/reviews/stage-check.ts` and `stage-check-api.ts` (`stageCheckApi()`, memory chunk). Each grid cell of the stage gets a fair share of the 20 places (round robin, a cell that cannot fill its share gives way), its share chosen box first by the CM-13 Check selector; the selector then runs once over the chosen items, so at least ceil(0.3 x rounds) are at produce and the theme and format caps interleave them. Stages 2, 3, 4, 6 and 7 plan 20 rounds over all five themes, 6 at produce, with or without a device voice. `STAGE_CHECK_MIN_ITEMS` = 10 (the wireframe's open question): Stage 5 (the books) teaches no review items, so it offers no Stage Check; its ceremony still shows. Parts of 5 with a pause between parts (the first pause line is new, the later ones reuse the Hangul Check's). Untimed, stars only, then "Your best result is kept." A 3-star result (80% or more first try, every round answered) latches `stageCheckAt` (earliest), the reports' "Stage Checks passed". A finished check writes the stage's one `reviews[]` entry of kind `stage-certificate` (`stage-check:<stage>`, scope the stage, never pruned): a retake merges into it like the Cell Check's entry (row CM-21), the best stars and then the earliest copy at equal stars, so retakes never grow `reviews[]` and two devices converge; the Journey header reads the best stars from it, so a later lower result never lowers it. The entry and the latch carry the memory store's guarded stamp (`stampOf`, row CM-12's wrong-clock cap). The switch and the stage's access (F-ENT-003) are read again when the check finishes: either gone meanwhile writes nothing and the screen shows the calm page (the CM-21 rule). A stopped check keeps the answers given (the spacing rule) and writes no entry and no latch. Whether a stage has 10 playable rounds is read once per learner, stage, day and sound setting, with one store read for every header asked together. `review.start { kind: 'stage-certificate', stageKey, hideRomanization }` when the first part starts, `review.complete { kind, stageKey, stars }` at the end.
- **Never blocks, never required.** Nothing outside these files reads the check: `routeNext`, `completeStages` and the next stage's cells are the same whether it was taken or not (test). The UI says "Stage Check" (es "Repaso de etapa", ko "단계 확인"), never "exam", and no certificate is drawn (OD-1).
- **Entitlement (F-ENT-003).** The check is offered only when every quest of the stage is open to the learner (`useQuestAccess`), its route shows the calm not-ready page otherwise, and the session reads the stage's access again when it finishes. This narrows the wireframe's "access changed" state, which kept a finished stage's check playable after a lapse; the ceremony and its card stay reachable.
- **The ceremony.** `StageComplete` for a Stage 2-7 draws `UpperStageCompleteScreen`: Hoya cheering, "Stage N complete!", one cheer line (the six per-stage can-do lines and the places row of the wireframe are left to a later copy row, so this row adds no new facts), the stage card when one exists, Take the Stage Check (primary, "About 7 minutes. You can skip it."), See my cards, Back home. The title and the card drop in with the F-MOTION-003 spring after 400 ms and five amber sparkles; reduced motion shows them at once with no sparkles. Opening the page, or the card, sends `stage.card_opened { stage }` (G5), parsed by `CURR_TELEMETRY_PAYLOADS`. The Journey header of a finished Stage 2-7 carries See your prize and Stage Check (with the best stars, read "Stage Check, best 2 stars"); from the Larger text setting up (text scale 1.3) the two buttons sit under the whole header and wrap, so they never squeeze the title at 320 px (Playwright at Largest); and the header of a stage whose every cell is done or tested out carries `learner.testOut.stageHint` (left to this row by CM-21).
- **`stageCeremonyAt` (W then A).** The PR's first commit adds the optional, lenient field to the snapshot schema, the Worker's preserve and merge (union of keys, earliest per key) and `boundToNow` (a latch time after the Worker's now is read as now, section 13); an older build that leaves the key out keeps the stored value. The app merges it the same way. Results writes the key of the stage whose ceremony it offers; the summary writes a key for every stage it lists.
- **The one retroactive summary** (4.8 step 7). Home opens `StageRecap` once while some finished Stage 2-7 has no key (finished before this build, or on a device still on an older one): one screen, "You finished Stages 2 and 3 earlier", the stage cards that exist then (none before CM-23: "Every stage you finished stays on your Journey."). It reads its list once and latches every stage on it as it shows, so it is never shown again on this or any other device, or after a restore (tests across two devices merging, and an older build). The wireframe skipped the screen when no card exists; this row shows it with the second line, so a learner who finished stages hears it once now, and CM-23 awards the cards from `questDoneAt` on its own. It opens only once this app session's sync of the learner has settled (`recapSyncSettled`: a finished sync, offline, or no server; while a pull runs, never; with no sync started, after a 4-second grace), so a key that another device already latched is pulled first and the summary is not shown twice. A navigation asked while the first screen is still settling can be dropped, so Home asks again a few times until the summary marks itself shown.
- **Strings.** 16 English strings with es and ko (`results.upperStagePrize.cta`, `upperStageComplete.*`, `stageCheck.*`, `testOut.stageHint`, `a11y.stageCheck.best`); the stop sheet, the intro buttons, the reading switch, two pause lines, the star headlines, the tricky line, See my cards and Back home reuse shipped keys. The summary title joins the stage numbers per locale in its message function, never with `Intl.ListFormat`. They pass `review-copy` (`upperStageComplete` joins its namespaces), the 7.7 list and the length budgets.
- **Reports.** The reports carry the stage completion (`stageDone`) and the Stage Checks passed count (the `stageCheckAt` keys), as they already do; the "Stage N complete" page of the Passport comes in row 7.5. The analytics rollup counts `review.complete` stars by review kind only, so Stage 2-7 Stage Check stars and Stage 1 Hangul Check stars share the `stage-certificate` bucket; the payload's `stageKey` is there for a later Worker-first row that splits them.
- **Start bundle.** The line stays at 4,810,000 B. `build:web --budget` measures 4,806,089 B raw / 1,268,793 B gzip, 3,234 B under CM-21's 4,809,323 B. The start bundle keeps only the prize table, the Results prize, the gate, the three routes and two slots (Journey header, Home's summary), the `stageCeremonyAt` schema and merge, and the 16 English strings. Every stage's prize ceremony (the `StageComplete` route: Stage 1's wall and legendary cards unchanged, and the Stages 2-7 one), the Stage Check, the summary and Home's trigger for it, the header extras and the `stageCeremonyAt` writer are the `stage-check-chunk` (marker `screen-chunk:stage-check`, 32,189 B raw, under the 60,000 B `screenChunkRaw` line, precached, so the Stage 1 ceremony opens offline as before); the session logic is in the memory chunk.

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
- When a run ends, Home shows "Start a new run" and keeps the best run (`streakBest`). It never says "lost". The displayed number never drops because of a sync, with one exception (amended 2026-10-21 in the CM-4 review, for the owner to see):
  - **The exception.** Another device on a new build already shows the same run as ended, because it knew a learning day earlier in that week that this device did not. It holds a longer run on the same last day, and a stored run never goes down in a merge (the field rule in section 4.8, the Worker's too). So the merged record also shows that the run has ended. It never shows a smaller number, and the next learning day starts the run as usual.
  - **Why it cannot be avoided without a schema change.** The merged record is then the same as that other device's own record, which must show nothing: it showed the longer run the day before, and showing a shorter one would be visible decay (section 7.7).
  - **Everything else holds.** A sync with an older build never lowers the number. Days another device adds never end the run this device shows: the merge carries each copy's own run, and `streakLocal` keeps the run Home shows.
  - **Hand-off.** CM-4 shows nothing for an ended run (the pill hides). Row CM-17 ships the "Start a new run" copy (en, es and ko, with the review ledger) and the `streakBest` display on Home.

**Copy.** Copy may nudge positively ("2 minutes to today's goal", "4 items are ready to refresh"). It never uses loss framing, and nothing sends a nagging notification.

**As shipped in row CM-17.**
- One points API, `recordActivityPoints(profileId, kind)` (`apps/mobile/src/store/goals.ts`): quests and stories call it from Results, a story read again in the reader when its end is reached, a word set from the progress store; the Daily Review, Keep going, Try these again and pack quests call it from their own rows. Points go under this device's install key (`hr:goals:install-key`, never in a summary, report or event).
- Every write of `goals`, `dayLog`, `streakLocal` and `steadyWeeks` takes its time from the device clock capped at the last `meta.serverTime` seen, carried forward (section 13), and goes through `boundToNow`, so a value a wrong clock wrote earlier is brought back to now and stops being sent. A device clock that moved back since the reading (a fast clock set right) drops the cap until a fresh server time arrives, so offline days after the fix land on their real days; the Worker's `boundToNow` still bounds the upload. The session local day (CM-4) takes the cap only while `goals` is on, so the kill switch leaves CM-4 as it shipped.
- The weekly days in force are read only after the learner's cached weekly plans are: the latch never judges a week against 3 days while a plan's days are still loading. An earlier week is judged against a plan that covered it, else goals set before it ended, else the default 3 when no goals were ever stored. `week.goal_met.target` is that week's days in force, 1 to 7, so a plan pace of 2 or 4 days is sent too.
- Not now on the first choice stores the defaults with the earliest `setAt` (1970), so a choice made on another device always wins the merge; closing the sheet on the defaults with no goals stored stores and sends nothing. Only a real choice sends `goal.set`.
- Rest days on the week dots follow the CM-4 run (`logic/streak.ts`), so the dots and the streak number agree: a quiet past day is a rest day while the run that holds it goes on (no week of a run has more than 2), and a crescent once drawn is never taken back. In the rare case where a later run re-anchors over an ended one in the same week, that week can show more than 2 crescents; the number Home shows is the run's.
- The goals' logic and screens are a chunk of their own (`goals-chunk`, section 10), loaded only while `goals` is on; the start bundle carries the English strings and a small entry. `goals` keeps built-in pct 0 (the owner ramps it).

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

- **Teacher read route (row CM-16).** `GET /api/spaces/:spaceId/learning-summary` is Clerk-authed and space-scoped. It requires the existing `summary.read` permission on the space (amended by row CM-16: `can.ts` grants `snapshot.read` only to a family caregiver, so it would shut out the teacher the route is for; the block is part of the summary), projects each block by the reader's memory scope (`memoryFor`: a family always, a class or school only for a learner whose family acknowledged the class-scope text that lists the `memory` item), and returns each learner's `memory` summary block (teachers see all learner info) plus a class aggregate: the top due item ids with how many learners have each one due. Class-tablet learners count through their `class-progress` posts. It returns no item states.
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
| `CATALOG_VERSION` and the quest additions history | Each new quest carries `addedIn`, an integer date stamp `YYYYMMDD`, in its content file. `CATALOG_VERSION` is generated as the largest stamp. The history up to 32 keeps its integers, which are all smaller than any date stamp, so the order holds. A CI check on the up-to-date branch fails if a new quest's stamp is not above `main`'s current version; the fix is a one-field edit in the PR's own file |
| Route-day pins | Derived from the manifest, with a snapshot test |
| Presenter font subset | Derived from all taught Korean |
| e2e spec | `journey-upper-cell.spec.ts` lists cells and packs from the manifest |

**Decision record (row CM-6, 2026-10-21).**
- **Where the modules are written.** `scripts/generate.mjs` (`pnpm generate`) runs the six content generators. The turbo task `//#generate` is a dependency of `dev`, `build`, `typecheck`, `test` and `test:coverage`. The root `postinstall` runs it too: the content-validation steps call package scripts directly, and the three Workers Builds deploys run only `pnpm install` before they bundle. No workflow file changed.
- **`--check` is the determinism test.** In CI the files on disk come from the postinstall run, so each existing `--check` step compares a second run with the first. `scripts/__tests__/generate.test.mjs` (`test:scripts`) runs the generators twice into fresh trees, once with every folder listed in reverse, and compares the bytes.
- **Catalogue.** `build-lessons.mjs` writes `packages/content-schema/src/catalog/catalog.generated.ts`: the upper-stage cells and quests, the story rows and the topic rows. `data.ts` keeps the Stage 1 and Stage 5 rows, which are TypeScript, and the frozen shelf order and anchors of the first 24 stories. A later story takes the next shelf place, in `addedIn` order (slug breaks a tie), so a shipped story never moves. A later festival story names its anchor in its own file (`shelf.anchor`); the first 24 state none there, and two stories may not claim one anchor.
- **Hand-written quests.** A Stage 1 quest (row CM-33) or a Stage 5 book quest (rows CM-46a and CM-46) added after version 32 is still a TypeScript row of `data.ts`, so it is stamped in `packages/content-schema/src/catalog/hand-stamps.json` (quest id to `addedIn`). The generator folds those stamps into `CATALOG_VERSION` and the additions history, the stamp check holds them to the same rules as a content file's stamp, and a test fails a stamp on a quest that is not a hand-written one added after 32. Such a PR edits `data.ts` and this file; a content PR does not. Row for row, the switch matched the committed catalogue (`fixtures/catalog-v32.json`). Only the quest order changed: it is now route order, so the console quest picker lists stages 1 to 7 in order. The cells and their quests are written as compact rows (`[stage, theme, title, status, minutes, quests]`, a quest being `[title, minutes, teaches]`), and `expandCellRows` (`assemble.ts`) gives back the ids, cells and kinds. Written out as full objects they grew the start bundle by 13,803 B. Compact, it measures 7,335,491 B raw on the release build, 425 B above CM-5's 7,335,066 B and under the 7,340,000 B line. A new quest adds about 40 B.
- **Stamp check.** `scripts/check-added-in.mjs` runs from `build-lessons.mjs --check` against `origin/main`. Content-validation checks out the full history. Where `origin/main` does not resolve, a local run skips the check with a notice and a CI run fails. The rules:
  - A new quest's stamp must be **above** main's version. An equal stamp would leave `CATALOG_VERSION` where it is, so a placement stored between the two deploys would never place out the new quest (`placedOutGrowth`). The message names the stamp to use: today (UTC), or the day after main's version if that is later.
  - A new quest's stamp is at most 14 days after the first stamp the branch may use (today, or the day after main's version if that is later), so one typo cannot raise the floor of every later PR. The window counts from that stamp, not from today: each stamped merge can move main's version a day ahead of the calendar, and a window from today would leave no valid stamp after a burst of more than 14 such merges.
  - The version never falls. A branch that stops shipping the quest holding main's version (a removed story, a ready cell turned back to draft) fails: a plan or placement stored at the higher version would stop growing. Turning a lower-stamped cell back to draft is allowed.
  - A quest main already ships keeps its stamp. A quest of the history up to 32 carries none.
  - The base tree is read leniently (status, ids, stamps), so a lesson rule that only the branch enforces does not fail on main's files.
  - The order holds only when the check runs on the branch as it will merge. `scripts/__tests__/stamp-order.test.mjs` runs the check in the required CI unit job (`test:scripts`) with no workflow change: on GitHub Actions it fetches the pull request's base branch and checks the checked-out merge with main against it, failing closed when the fetch fails. The ruleset does not require an up-to-date branch (`strict_required_status_checks_policy` is off), so a green run can be stale once another stamped PR merges. Turning that on is a ruleset change left to the owner. Until then, stamped content PRs merge one at a time, each brought up to date with main first (the merge watcher's update-branch re-runs the required check), and never in one batch. This is a merge rule for every row that adds a quest, starting with the first CM content row.
  - Generation needs the devDependencies: `build-lessons.mjs` reads the app's jamo through `scripts/ts-loader.mjs`, which needs `typescript`. An install without them (`--prod`, `NODE_ENV=production`) fails at the postinstall with a message that says so. Every CI job and deploy build installs them today (a plain `pnpm install --frozen-lockfile`).
- **Native and dev builds.** `apps/mobile/metro.config.js` runs `scripts/generate.mjs` before it returns Expo's default config. Metro loads it for `expo start`, `expo export` and the Xcode bundle phase (`expo export:embed`), so a build started outside turbo still bundles the current content. Each generator writes a module only when its bytes change, so a dev server does not reload for nothing.
- **Presenter font.** The font stays committed, because CI has neither the subsetter nor the source font. It is built from all taught Korean: the drawn fields plus every `ko` / `…Ko` field of the letters, scopes, quests, cards, listed topics, and the title, keywords and tiers of listed stories (566 code points, 49,408 B). `--check` now tests coverage, so a wider font passes.

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
- **On demand.** The reader, its games, Sources and Culture notes wait for their stories' chunks with the lessons' waiting state (`LessonWaiting`: the header for a frame or two, then the calm "Loading lesson" line). Culture notes waits for every story that carries notes, failure included: a note story whose chunk fails goes to the crash screen like the reader, so a note the learner found is never left out of the list or of a deep link (`CultureNotes { storyId, noteId }`). Results loads its story's chunk, but which story extras it shows (Next story, Read again, Episode) is known from the shelf (the title and the levels), so they are drawn at the first frame and never shift in when the chunk lands. The same recovery as CM-5 applies: a load times out after 15 s and gives up its pending script (`platform/lesson-chunk-abandon.web.ts`, by the story's bundle name `story-<slug>`), a chunk of a newer build reloads the page once (online only, at most once a minute), a script error asks the chunk URL once more (`platform/new-build-reload.web.ts` matches `story-<slug>-<md5>.js` as well as the lesson chunks), and any other failed chunk goes to the crash screen, whose Try again loads it again. `pwa-postbuild.mjs` fails a build whose `_headers` would send nosniff on a story chunk, as on a lesson chunk. The shelf, Home and the episode page load the chunks of the stories they show, and draw each cover as it arrives (the theme tint stands in). A card face and a card page subscribe to their own story only, and a card page shows its front only (no flip, no Share) until its story's chunk is in, so a blank back is never drawn or shared; meanwhile the card is marked busy (`accessibilityState.busy`), so a screen reader hears that it is loading, not only that the flip is unavailable. The story cards are built at start from the shelf, so a cold build lists, groups and awards the same cards with the same faces as a warm one (`content/__tests__/story-cards-cold.test.ts`); a card's blurb, fact and citation switch to the loaded values when its story's chunk arrives. All lessons, the presenter and the e2e hook mount once every chunk is in; a failed story chunk shows the crash screen there, never a catalogue without that story. The story index of All lessons and the presenter reads the shelf's levels, so it never depends on a chunk. On the web, once the first screen is up, every story chunk loads in the background with the lesson chunks (`prefetchWhenIdle`, again on back-online), so a session that started online keeps every story when the network goes, as it did while the stories were in the start bundle.
- **Story overlays: a known start-bundle cost** (closed by the start bundle shrink: the es / ko overlays, story ones included, are now a precached chunk per locale, decision record below). The es and ko story overlays stay in the start bundle (`OVERLAYS` of `i18n-overlays.generated.ts`: 374,426 B of its 636,321 B of overlay JSON are `story:*` entries, mostly scene narration) and apply to the body once it is in. They grow with each story or tier that CM-46a and CM-46 add. The start bundle line now sits less than 5 KB over its measurement, so that growth fails `build:web --budget` and cannot pass unseen. Row **CM-8b** (section 17), which CM-46a and CM-46 depend on, moves the `story:<slug>` narration and caption overlays into the story's chunk (or a per-locale story overlay chunk) and keeps only titles and card text at start, instead of raising the line.
- **Measured (release build `pnpm build:web` of this row's final code, on CM-5's head fe2be67e8, no recorded clips; CI's `build:web` report on the pull request head is the enforcing check).**

  | Measure | Size |
  |---|---|
  | Start bundle | 7,337,815 B raw / 1,793,420 B gzip before CM-8 (after CM-5); 6,345,469 B raw / 1,573,399 B gzip after (-992,346 B raw; -1,976,314 B raw since before CM-5) |
  | Story chunks (24 bundles) | 983,601 B raw / 241,020 B gzip; the same lines hold the built bundles (below) |
  | Generated story modules (`build-stories.mjs --report`) | 869,644 B raw / 220,524 B gzip; largest chunk `pansori-tales` 46,511 B raw |
  | Manifest (`lessons-index.ts` 30,364 B + `stories-index.ts` 27,116 B) | 57,480 B raw, under the 60,000 B line (2,520 B headroom) |
  | Learner precache | 59 files, 8,778,584 B |

  - The start bundle line (`PRECACHE_BUDGET.startBundleRaw`) is lowered to the CM-8 measurement plus a 4,531 B rounding margin: 6,350,000 B (it was 7,340,000 B after CM-5). The bundle cannot grow back by more than that margin, so neither the stories nor anything else can return to it unseen; a row that adds to the start bundle raises the line as a reviewed one-line change with its measurement. `build:web --budget` in CI enforces it on the real build; the budget test only pins the line. On the phase-0 integration branch (#802), where CM-1 to CM-4, CM-6, CM-7, CM-70a and CM-70b join CM-5 and CM-8, the release build measures 6,371,165 B raw / 1,582,440 B gzip (+25,696 B raw over CM-8 alone), so the line is raised to 6,380,000 B, that measurement plus an 8,835 B rounding margin.
  - The story lines are checked twice: on the generated modules (`build-stories.mjs --check` and `--report`) and on the built bundles the service worker caches (`pwa-postbuild.mjs --budget`: the largest story bundle against 70,000 B, the story bundles against 2,000,000 B raw and 510,000 B gzip; `PRECACHE_BUDGET` holds the same numbers as `BUDGET`, and a test keeps them equal). A built bundle is about 13% larger than its module (983,601 against 869,644 B).
  - The stories gzip line is 510,000 B: the measured gzip share of the story modules (220,524 / 869,644) applied to the 2,000,000 B raw line (507,155 B), rounded up. The two lines describe the same planned capacity (Sizing basis). Story content that compresses like today's reaches the raw line first; content that compresses worse (inline art, long unrepeated text) reaches the gzip line first, so the gzip line still binds.
  - Manifest headroom is 2,520 B, and each story's shelf entry averages about 1,130 B, so today the 60,000 B manifest line, not the 2,000,000 B stories line, sets how many stories fit: about two more. The 11 book 2 tales of CM-46 add about 12,400 B of shelf, and CM-46a about 300 B of tier levels.
  - The Hoya lines (`hoyaIntroEn`, `hoyaOutroEn`, 4,415 B together) stay in the shelf: the shelf quests and episodes (`content/stories.ts`) and the book quests (`content/books.ts`, `storyQuestSkeleton`) are derived from them at start, and `storyQuestSkeleton` throws on an empty line. They can move only with that derivation.
  - The fields that only body readers use move first: `coverSceneId` (456 B; read only with the tiers it names, by the covers, the scene view, card art and the presenter deck, which all need the chunk anyway), then `review.advisoryNoteEn` (899 B; read by the reader, Sources and the presenter, which all wait for the chunk), then `cardKeyword` (2,719 B; the card face then waits for its story's chunk, so it goes last). Together about 4,070 B, which is not room for CM-46.
  - So row **CM-8b** (section 17) lands before CM-46a: it makes those moves, and if the projection for the plan's 35 stories with CM-40's lesson manifest (about 35,400 B without the display lines) still passes 80% of the line, it gives the story shelf a manifest chunk of its own, loaded before the first screen the way CM-40's lesson headers chunk is, instead of raising the 60,000 B line.
- **Native.** `npx expo export --platform ios` of this row's final code gives one Hermes bundle (`index-<md5>.hbc`, 10,857,728 B) and no `story-*` file; the 24 story chunk hashes and the story text (for example a fact of `pansori-tales`) are inside it. The story chunks are reached through the same literal `import()` as CM-5's lesson chunks, which on native resolves from the bundle with no request (CM-5 run evidence: a native dependency map carries no `paths`, so `import()` goes straight to `require.importAll`), so `loadStoryBody` never reaches the network. CM-8 also removes the Hermes start-up evaluation of the 1.26 MB story literal: the start bundle holds the 27,116 B shelf, and a story body is evaluated when its chunk is first asked for. Not run: a Release build in the iOS simulator or on a device (as for CM-5); the check of a story offline stays on the release checklist of the next native build, with F-STORY-001 PR 1.10.

**Decision record (start bundle shrink, `perf(mobile): shrink the start bundle`, 2026-10-21): the es / ko text and the grown-up roots as precached chunks.**
- **Why.** After CM-8 every row that added to the app raised the start bundle line, because the line sat a few KB over the measurement and the bundle still carried things a learner's start never uses. A source-map report of the release build (`expo export --platform web --source-maps` on main 2fe5f34ce, 6,490,728 B) attributed 890,111 B to the content overlays (`i18n-overlays.generated.ts`, both locales), 534,341 B to the es and ko UI messages (`packages/i18n/src/messages/{es,ko}`; English is 199,962 B), and about 427,000 B to the presenter, All lessons and the lecture code they alone use (`PresenterApp`, `BrowseApp`, `screens/presenter`, `logic/lecture`). The next largest are react-dom (128,651 B), the level-check bank (`placement.generated.ts`, 151,545 B, read by Home) and zod; they stay.
- **Locale chunks (web only).** Each UI locale but English is one Metro async bundle, `locale-<locale>-<md5>.js`, from `apps/mobile/src/content/locale-chunks/locale-<locale>.ts`: that locale's message overlay (`@hangul-route/i18n/messages-<locale>`) and its content overlays (`@hangul-route/content-schema/overlays-<locale>`, the one-locale module `build-overlays.mjs` now also writes). It is reached only through the literal `import()`s of `platform/locale-packs.web.ts`. On the web, `packages/i18n` resolves `./bundled-messages` to `bundled-messages.web.ts` (no overlay) and `@hangul-route/content-schema` resolves the overlays subpath's relative `./src/overlay-tables` to `overlay-tables.web.ts` (an empty `OVERLAYS`; a relative import, so the swap holds whether or not Metro reads `package.json` `exports`, which from Expo SDK 53 uses an export target as written): Metro's web build is the only consumer that reads `.web.ts`, so the site, the Worker, the scripts, the tests and the native app keep both locales from the start, unchanged.
  - **Applying a locale.** `content/locale-packs.ts` (`logic/locale/locale-pack-store.ts`) loads a locale's chunk once and lays it in: `registerMessageOverlay` (the next `getMessages(locale)` merges it) and `installContentOverlay` (every reader passes `OVERLAYS` to `localize` at call time, and `content-locale.ts` merges it into the lesson table). `useLocale` applies a newly chosen locale only once its chunk is in, with no grace, so a screen is never drawn in a locale whose menus are missing; until then the screens keep the locale they last drew in (the same rule as the title chunks, without their 2.5 s grace). The learner app waits for the device locale's chunk before its first screen, with the title chunk, for 5 s at most (`LOCALE_BOOT_GRACE_MS`: a stalled request with no worker in control would otherwise hold the splash for the full 15 s); past that the first screen shows in English, whole, and changes to the locale when its chunk arrives. The grown-up roots wait for every locale chunk with their content. Screens that draw another locale than the UI's (the level check's test language and its language tiles, the consent sheet's language chips, the Display sheet's pending language) load the chunks they can show (`useLocalePacks`) and draw again as each arrives. Once the first screen is up, every locale chunk loads in the background with the lesson and story chunks (`prefetchWhenIdle`), so a session that started online keeps every language offline.
  - **Failure.** The same recovery as a lesson chunk: a load that hangs past 15 s gives up its pending script; a chunk of a newer build (the host's HTML page, a chunk with another locale's marker, or a URL that now answers 404 or HTML) reloads the page once, online only, at most once a minute (`new-build-reload.web.ts` matches `locale-<locale>-<md5>.js`); any other failure leaves that locale's text in English (the screens stay in the locale they last drew in, English at a first start) until the next try, when the network is back or the language is chosen again. With a worker in control the chunk comes from the precache, offline too; with no worker (the open iOS 14 issue), a session that could load the start bundle loads the chunk the same way, so the iOS 14 issue is not made worse.
  - **Native.** `npx expo export --platform ios --no-bytecode` of this change gives one bundle (9,142,664 B) with the es and ko messages and overlays inside (eager, as before) and no locale chunk module; `platform/locale-packs.ts` has no loader, so nothing is fetched or waited for.
- **Grown-up root chunks.** `index.ts` hands `withLessonContent` the presenter and All lessons as `LazyRoot`s (literal `import()`s), so `PresenterApp-<md5>.js` and `BrowseApp-<md5>.js` are bundles of their own and a learner's start bundle carries neither. `withLessonContent` loads the root's code with the content the root reads (15 s timeout, the pending script given up), and a root that fails shows the crash screen with Try again, or reloads once for a newer build, like a content chunk. Native builds mount only the learner app; there the `import()` resolves from the one bundle.
- **Build checks.** `pwa-postbuild.mjs` fails the build unless each locale chunk and each root chunk has exactly one bundle, named by the md5 of its content, carrying its marker (`LOCALE_PACK` `locale-pack:<locale>`, `ROOT_CHUNK` `root-chunk:presenter` / `root-chunk:browse`) and precached, and unless no start bundle carries a marker (a static import would pull it back in); the nosniff check covers them, and the precache report prints them on lines of their own. The content half of a locale chunk stays under the 1 MiB of JSON per locale of `overlays-bundle.test.ts`.
- **Story overlays (CM-8b).** The `story:*` overlays left the start bundle with the rest of the content overlays, so they no longer grow it: each story or tier that CM-46a and CM-46 add grows its locale chunk instead (precached, loaded for the active locale). CM-8b's overlay move therefore becomes optional (it would only make the locale chunk smaller); its manifest half (the body-only shelf fields, and a shelf chunk if the projection needs it) stands.
- **Measured (release build `pnpm build:web` on main 7eb5bad61 before and after this change, no recorded clips; CI's `build:web` report on the pull request head is the enforcing check).**

  | Measure | Before | After |
  |---|---|---|
  | Start bundle | 6,491,546 B raw / 1,617,974 B gzip | 4,712,987 B raw / 1,237,660 B gzip (-1,778,559 B raw, -27.4%; -380,314 B gzip) |
  | Locale chunks (2 bundles) | — | 1,428,629 B raw / 298,015 B gzip (es 527,438 B, ko 901,191 B raw) |
  | Grown-up root chunks (2 bundles) | — | 357,309 B raw / 86,154 B gzip |
  | Learner precache | 61 files, 8,961,307 B | 65 files, 8,968,686 B (+7,379 B: what the four bundles repeat) |

  - After the review fixes (the overlay tables behind a relative `.web.ts` twin, the presenter's chunk-aware memos, the 5 s boot grace) the same build measures 4,713,416 B raw / 1,237,770 B gzip for the start bundle and 357,368 B raw for the root chunks (PresenterApp 245,964 B, BrowseApp 111,404 B); the locale chunks are unchanged.
  - **Merged onto the final integration (#815: OA-7b #798, SN-1 #813, SN-2 #804; main fc580beed).** Its new strings (Who is joining?, the join batch and name field, the PIN entry lines, the site-entry and `landing` strings) are read through `useMessages` / `getMessages` like every other key, so their es and ko values travel in the locale chunks with no other change, and English stays in the start bundle. The release build `pnpm build:web` of the merge measures 4,732,797 B raw / 1,243,089 B gzip for the start bundle (6,518,688 B raw on #815 alone: -1,785,891 B raw, -27.4%), 1,436,390 B raw / 299,798 B gzip for the locale chunks (es 530,463 B, ko 905,927 B raw), 357,368 B raw for the root chunks (unchanged) and 65 files, 8,996,316 B for the learner precache.
  - The start bundle line (`PRECACHE_BUDGET.startBundleRaw`) is lowered to the merged measurement plus a 7,203 B rounding margin: 4,740,000 B (it was 6,525,000 B on #815; on main 7eb5bad61 this change had measured 4,713,416 B and set 4,720,000 B). An English learner downloads 1.78 MB less before the first screen; a Spanish or Korean learner about 1.25 MB or 0.88 MB less, since their own locale chunk is fetched (from the precache once installed) before the first screen.
  - **Phase-1 integration (integrate/curr-phase1: CM-10 to CM-17 on main 82237b684).** Each row measured on its own base: CM-13's head 4,738,771 B, CM-14 4,744,598 B and CM-15 4,744,698 B (both on CM-13's head, line 4,750,000 B), CM-16 4,742,801 B (on CM-12's head, line 4,745,000 B), CM-17 4,739,306 B (on main, under 4,740,000 B, its goals in a learner chunk of their own). Together, the release build `pnpm build:web` measures 4,760,960 B raw / 1,253,023 B gzip, about what the rows' own additions sum to (4,760,457 B). The line is raised to that measurement plus a 9,040 B rounding margin: 4,770,000 B.
  - **Guest first quest integration (integrate/guest-gu1-6: AMENDMENTS-GUEST-FIRST-LESSON GU-0b to GU-6 on main ece5eee02, the guest switch and the `guestLesson` site claim off).** The guest rows measured 4,774,256 B raw on GU-5 (merged onto the GU-4 review head) against 4,732,797 B on their main: 41,459 B, the always-on guest rules (GU-2), the try intent and Welcome's waiting card (GU-3), the save's parts of the shared start screens (GU-4) and the chooser's tiles (GU-5); the guest's screens and its grown-up side are learner screen chunks (21,036 B raw, 2 bundles). Together with the phase-1 rows, the release build `pnpm build:web` (Metro cache cleared) measures 4,804,191 B raw / 1,265,853 B gzip, 1,772 B over the sum of the two (4,802,419 B). The line is raised to that measurement plus a 5,809 B rounding margin: 4,810,000 B.

**Ceilings.** Each ceiling is a reviewed one-line change with measured numbers in its PR. These are lazy and precached, so they put no weight on start-up (OD-5).

| Budget line | Today | New ceiling |
|---|---|---|
| Start bundle | 8,321,783 B raw before CM-5; 7,337,815 B raw after CM-5; 6,345,469 B raw after CM-8; 6,371,165 B raw on the phase-0 integration (#802); 6,487,010 B raw with the AMENDMENTS-ONE-ACCOUNT-MANY-USERS integration (#801); 6,495,837 B raw with SN-2 (#804); 6,518,688 B raw on the final integration of OA-7b, SN-1 and SN-2 (#798, #813, #804); 4,712,987 B raw after the start bundle shrink (6,491,546 B on its main); 4,732,797 B raw with the shrink merged onto the final integration; 4,744,234 B raw with the always-on guest rules ([GU] GU-2, 4,734,519 B raw on GU-1); 4,747,423 B raw with the GU-2 review fixes; 4,757,493 B raw with the guest's launch, Welcome's waiting card and the 16.1 strings ([GU] GU-3; the guest's screens are a precached screen chunk, 7,673 B raw); 4,759,347 B raw / 1,251,446 B gzip with the GU-3 review fixes (guest chunk 7,753 B raw); 4,767,105 B raw / 1,253,769 B gzip with the guest's save ([GU] GU-4: CreateProfile's guest steps, PinEntry's SaveGuest path, the Home bubble and the 16.2 strings; guest chunk 11,950 B raw); 4,769,566 B raw / 1,254,382 B gzip with GU-4's review fixes (the save's gate read again at Continue; guest chunk 14,344 B raw, which also holds the guest stack's navigation guard); 4,759,663 B raw / 1,251,533 B gzip with the second GU-3 review's fixes (guest chunk 8,125 B raw); 4,760,960 B raw on the phase-1 integration (CM-10 to CM-17); 4,804,191 B raw on the guest first quest integration (GU-0b to GU-6, switch off); 4,804,193 B raw / 1,265,857 B gzip with the guest switch and the `guestLesson` claim on ([GU] GU-7, on main 33fd796af), under the line; 4,812,581 B raw / 1,272,017 B gzip on the phase-2 integration (CM-20 to CM-25, integrate/curr-phase2); 4,742,691 B raw / 1,263,763 B gzip with named React imports (on main 150c07383, release build, Metro cache cleared; the app-host build 4,742,847 B): 142 start-bundle modules of the app and the design system no longer inline Babel's wildcard interop helper (the CM-21 decision record's open item), 69,890 B raw less; 4,749,283 B raw / 1,265,555 B gzip on main e31bc3b33 (#859 to #862, +6,592 B); 4,751,444 B raw / 1,266,428 B gzip with CM-23c (#845, Stages 6-7 cards and the five legendary cards, release build, Metro cache cleared; +2,161 B over that main, as on main 2851bac3b; the app-host build 4,751,600 B); 4,762,235 B raw / 1,269,443 B gzip with CM-30 (#852, Cloze Pick's door and its Listen & Pick fallback in the start bundle, the game in its own `cloze-pick-chunk`; release build, Metro cache cleared; +10,791 B over main 524961dae, which used most of the margin: the game rows after it share Listen & Pick's text prompt mode as their start-bundle fallback rather than each adding its own) | must not grow at any row: 4,765,000 B raw, the CM-30 measurement (4,762,235 B raw, release build) plus a 2,765 B rounding margin (`PRECACHE_BUDGET.startBundleRaw`; 4,760,000 B with CM-23c, 4,751,444 B raw plus 8,556 B; 4,750,000 B after the named React imports, 4,742,691 B raw plus 7,309 B; `apps/mobile/scripts/__tests__/named-react-imports.test.mjs` keeps `import React` and default-beside-named imports out of the app's sources; 4,813,000 B on the phase-2 integration, 4,812,581 B raw plus 419 B; 4,810,000 B on the guest first quest integration, 4,804,191 B raw plus 5,809 B; 4,770,000 B on the phase-1 integration, 4,760,960 B raw plus 9,040 B; 4,740,000 B after the start bundle shrink on the final integration; 6,525,000 B on the final integration, #815; 6,504,000 B with SN-2, #804; 6,495,000 B on the one-account integration, #801; 6,380,000 B on the phase-0 integration, #802; 6,350,000 B after CM-8 alone, 7,340,000 B after CM-5); after CM-5 and CM-8 it shrank by 1,976,314 B raw (the lesson index and the story module left it), and by 1,785,891 B raw more (against 6,518,688 B) when the es / ko text and the grown-up roots became precached chunks |
| Locale chunk (es or ko UI messages and content overlays, each), raw | es 527,438; ko 901,191 (start bundle shrink); es 530,463; ko 905,927 (merged onto the final integration); es 542,657; ko 925,171 (main 8dfb8a43c, release build) | 1,000,000 B (`PRECACHE_BUDGET.localeChunkRaw`): a Spanish or Korean learner waits for theirs before the first screen, and every es / ko string and story overlay grows it; the line left about 99 KB for the stories and strings ahead (CM-46a, CM-46) at the start bundle shrink (ko 901,191 B) and about 94 KB on the final integration (ko 905,927 B), and about 75 KB is left on main 8dfb8a43c (ko 925,171 B); crossing it raises it with its measurement or moves text out (CM-8b's story overlay split) |
| Grown-up root chunk (the presenter, All lessons, each), raw | PresenterApp 245,964; BrowseApp 111,404 (start bundle shrink); PresenterApp 232,574; BrowseApp 104,116 (main 8dfb8a43c, with named React imports) | 300,000 B (`PRECACHE_BUDGET.rootChunkRaw`) |
| `manifestRaw` (English, lessons and story shelf) | 372 KB (whole lesson index) | 60,000 B |
| Title chunk per locale | — | 30,000 B |
| Per cell chunk (one cell's emitted body chunk module: steps, scopes and their glosses), raw / gzip | — (largest at CM-5: 61,381 / 11,070, Stage 2 Letters & Books) | 90,000 / 16,000 (`cellChunkRaw`, `cellChunkGzip`); Volume 2 gets a chunk of its own per cell and volume (CM-40), because both volumes in one chunk would pass the line (about 120 KB for Letters & Books), and CM-40 re-measures the line |
| Core lessons total (Volume 1 + 2), raw / gzip | 950,000 / 140,000 | 1,400,000 / 210,000 |
| Per stage chunk (a stage's game scopes and their glosses, as F-CURR-001 measured its stage module), raw / gzip | 150,000 / 32,000 | 220,000 / 40,000 |
| Per pack chunk, raw / gzip | — | 90,000 / 14,000 |
| All packs, raw / gzip | — | 750,000 / 120,000 (8 packs) |
| Review-item index, raw / gzip | — (generated: 94,162 / 19,597 at CM-10's first cut, 728 items; 97,670 / 20,024 with CM-10's review fixes, 733 items); the built chunk 105,189 / 19,475 at CM-10 and 105,189 / 19,478 on main 8dfb8a43c (733 items) | 150,000 / 30,000 |
| Per story chunk, raw | — | 70,000 (the generated module and the built bundle) |
| Stories total, raw | 1,255,855 (1,300,000 ceiling), in the start bundle | 2,000,000, precached; gzip 510,000 (set from the CM-8 measurement); checked on the modules and on the built bundles. Today the manifest line sets the story capacity (decision record above, CM-8b) |
| Hidden Heritage scene | — | 25,000 B each |
| Learner precache total | 8,787,329 B (CM-5, 35 files, no recorded clips); 9,361,858 B (main 8dfb8a43c, 77 files, no recorded clips; 1,925,471 B under the line) | measured + 2.5 MB = 11,287,329 B (`PRECACHE_BUDGET.learnerPrecacheRaw`); re-measured when the jamo recordings land |
| Per-quest average, raw | 9,000 | 9,000 (unchanged) |

**Sizing basis.**
- A quest is about 5 KB raw on the compact literal. Volume 2 is 75 quests, about 400 KB raw. The packs are 120 quests, about 650 KB raw.
- Stories: 11 new tales (after the de-duplication of section 5) at about 52 KB each is about 570 KB raw, and read tiers for 10 listen-only stories at about 12 KB each is about 120 KB raw. 1,256 KB + 690 KB is about 1.95 MB, under the 2,000,000 B ceiling.
- About 1.9 MB raw is added over the whole plan, all of it outside the start bundle.
- The 60,000 B manifest line covers Volume 1, Volume 2 and the story shelf once CM-40 has moved the lesson display lines out; the packs keep a manifest chunk of their own (CM-50a), because at the plan's scale they alone would pass it (decision record above).
- CM-46a and CM-46 depend on CM-8, so no story row can grow the start bundle with story bodies (tiers, scenes, art). Two things still grow with each story or tier until CM-8b moves them: the es / ko story overlays (374,426 B of `story:*` entries, mostly scene narration; since the start bundle shrink they grow the locale chunks, not the start bundle), and the story shelf in the 60,000 B manifest (2,520 B of headroom, about two stories). CM-46a and CM-46 therefore depend on CM-8b as well.

**Offline.** The memory store, review engine, goals and "This week in Korea" all work offline. Remote config fails safe (12.2). Nothing in Phases 1-2 adds a network dependency, so the open iOS 14 offline issue is not made worse.

## 11. Telemetry

### 11.1 Rules

- **Payloads.** They carry ids, codes, counts and buckets only: no names, no free text, no learner input. Write Frame and My Story text is never sent. `profileId` rides in the envelope, as rule 3 of TELEMETRY-NAMES-2 says, and is never stored by the rollup.
- **Worker first.** Every name is added to `TELEMETRY_EVENT_NAMES` and deployed to the Worker before the app sends it. The exact-list test is updated.
- **Per-item data stays on the device.** It is aggregated into one daily event.
- **Small groups are hidden.** Dashboards suppress any group with fewer than 20 events on a day. For the once-a-day names (`memory.daily`, `items.seeded`, `goal.met`, `week.goal_met`) events are profile-days; every other metric is labelled as events, never as profiles (`readRollups` in `packages/backend/src/lib/learning-rollups.ts`).

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
- **Profile-days, not profiles.** Each per-profile metric is a once-per-local-day device event (`memory.daily`, `goal.met`), so its `events` on one day are about the profiles that sent it that day: a local day straddles two UTC days, and a once-a-day event whose client time is more than 24 hours before ingest (a late offline flush) adds no rows, so a device back after days offline counts once. Suppression applies per day (fewer than 20 events hides the group), and a distribution such as the north star's p25, p50 and p75 comes from the counts per bucket.
- **The device emits guardrail inputs itself**, so no per-profile join is needed: `questLeft` and `leftAtKind` on `session.end` give the quit rate, and `durableWeekBucket` in `memory.daily` gives the north star.
- **Experiment arms** are a `dim`, so A/B arms can be compared without an id.
- **Cost.** One upsert per rollup row touched, plus one for the day's counter row; a daily event touches about 10 rows (at most 15). Rows written count toward the D1 guardrail of 3.3: rollups are capped at 20,000 rows written a day (20% of the free tier), counted exactly in the counter row, so 30,000 stay for sync and every other table under the 50% line. A day that reached the cap is partial, and readers mark or skip it.
- **Retention.** No purge yet: the table holds aggregate codes and counts only, a few hundred rows a day. A bounded purge can follow with row CM-70.

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
| `mastery`, `cellCheck`, `stageChecks` | The ring or check hides; latched levels and results stay and show again when it is back on. With `mastery` on and `dailyReview` off, a mastered cell shows no "Ready to refresh" glow, since nothing asks its due items (row CM-20, a narrowing of 4.4 open for the owner) |

**Ramp gate for `stageChecks` (row CM-22).** `stageChecks` is not ramped above 0 until the Worker build that keeps and merges `stageCeremonyAt` (`ADDITIVE_FIELDS`, the row's first commit) is live in production. An older Worker drops the key, so every device would show the retroactive summary again. The app writes the key only while `stageChecks` is on, so the row merges dark safely.

### 12.3 Ramp

1. Development, then the owner's own profiles, for 2 days.
2. 10% of profiles for 7 days.
3. 50% for 7 days.
4. 100%.

- **The owner advances each step** by editing `remote_config`.
- **Guardrail evaluator (row CM-70b).** A scheduled Worker (Cron Trigger) runs once a day. For each ramping flag it compares the last 7 days of guardrail metrics (3.3) with the cohort before the ramp step. On a breach it lowers the flag's `pct` to the previous step, writes the reason to `remote_config.reason`, and the owner metrics page shows it. Lowering is the only automatic action, which matches "remote can only reduce". The rule as built (row CM-70b):
  - **Windows.** The step is the row's `updated_at`. The cohort after it is the full UTC days since the step (at most the last 7); the cohort before it is the 7 days before the step day; the step day is in neither. A step is compared once 3 full days have passed. A baseline step more than 14 days old is no longer compared (`stale-step`: it has passed about 10 daily checks, and a baseline that old reads seasonal drift as a breach); after a lowering the age is the kept baseline's, not the lowering's. A ramp held past that has no automatic guardrail until the owner advances or re-stamps it, and the run log counts it as `unguarded`.
  - **Same weekdays.** Use has a weekly rhythm, and the after window holds 3 to 7 days. Each cohort keeps only the days whose weekday the other cohort also holds (each weekday once on each side), so a Friday-to-Sunday after window is read against Friday to Sunday before the step. A day on which the rollups stopped at their cap (row CM-70a, `cappedDays`) is partial; it is left out of both cohorts with its weekday.
  - **Noise.** Each rule needs its line and a one-sided test: a two-proportion z with continuity correction for the quit rates, Mann-Whitney for the median, a one-sample z on the share of sessions of 20 minutes or more for p90. All comparisons of one run for one flag share a 2% alpha (Bonferroni: about z 3.1 with 21 game kinds). A comparison needs at least 100 sessions in each cohort. Seeded tests show a healthy ramp at realistic sizes (1 to 21 kinds, 25 to 200 sessions per kind a day) is lowered on at most about 4% of steps.
  - **Small groups (a deviation from the per-day rule of 11.2).** The evaluator shows no cell, so the 20-event threshold applies to the group a comparison uses, summed over the cohort's days: a (cohort, metric, dim) group. Per day it would leave out nearly every game kind at real traffic (2 or 3 quits a kind a day) and keep only the days with many quits, which leans every rate upward. An after group under 20 is never compared, and a before group under 20 is read as its upper bound, 19 (the reason shows `<=`), which understates a rise. The owner metrics page (row CM-70) keeps the per-day rule of 11.2. A flag none of whose comparisons had the cohorts to run is logged as skipped `unchecked`, never as kept.
  - **Quit rate.** Two lines with the same 2 pp limit and test: all kinds together (the quits over every session that reports `questLeft`), which also sees a game kind that did not exist before the step, and per game kind. A `session.end` names the game kind only for a quit (`leftAtKind`, the round on screen), so the rate for kind K is the rollups' own definition (row CM-70a): the quits at K over every session that reports `questLeft`. That is K's share of all play: with 8 kinds played evenly, a kind's own quit rate has to rise by about 16 pp to move its line by 2 pp (about 40 pp with 21 kinds), so this line catches a kind that breaks badly, and the overall, median, p90 and wrong-streak lines catch smaller drifts. Row CM-70c adds a per-kind count of sessions so the 3.3 line can be measured as written.
  - **Absolute lines.** The p90 line (20 minutes) and the D1 line (50%) count only when the cohort before the step was under the line, so a level the ramp did not cause never walks a flag down. When p90 was already 20 minutes or more before a step, the owner checks it by hand during that ramp.
  - **D1 rows written** reads the rollup sink's own day counter: the rows it wrote that day, counted exactly (row CM-70a). The sink stops at 20,000 rows (20% of the free tier), so this line cannot fire while that cap holds; it is advisory. Row CM-70d reads the account total, sync included; until then that is the owner's check in the D1 dashboard (runbook K-3).
  - **Cohort, not arm (a deviation from "for the flag's arm").** `session.end` names no flag, so the cohort after a step is everyone who used the app in that window, not the flag's arm. A real effect inside a 10% arm shows about 10 times smaller overall, so the guardrail is weakest at the first step. A breach cannot be pinned on one flag, so every ramping flag whose windows show it is lowered in the same run (the safe direction). The owner ramps one flag at a time to keep a breach attributable. Row CM-70c adds per-flag arms so this becomes the arm comparison.
  - **Baseline after a lowering.** The reason names the step whose before window was used (`guardrail <day> base <day> pct 50->10: ...`). While the row is as the evaluator left it (its `updated_at` day and `pct` are those of the reason), the next comparisons keep that before window, so a lower step that is still worse than before the ramp is lowered again. Any owner edit of the row, even of `reason` alone with a new `updated_at`, starts a new baseline from that `updated_at`, so the owner changes `updated_at` only when advancing a step.
  - **Writes.** The UPDATE applies only while the row is exactly as read (on, the whole-number `pct`, the same `updated_at`), so any owner edit during the run wins. A run makes at most 3 write attempts (a refused one counts), so with the retention purge at its worst (41 statements, the AMENDMENTS-ONE-ACCOUNT-MANY-USERS `telemetry_daily` step included) it stays at 46 of the 50 statements a Free-plan invocation allows. A breached flag past the cap is lowered on the next day's run. Each run logs one `guardrail.run` line (flag names, steps, skip codes, the `unguarded` count) to Workers Logs. The run goes after the retention purge, so the purge never waits on it.
  - **Re-raising after a lowering.** The owner's edit starts a new baseline from its `updated_at`, and that before window holds the breached days. So after a `guardrail` reason the owner waits at least 7 full days at the lowered step before raising again (runbook K-3), so the new baseline is the lowered step's own week.
  - **Kill switch.** `GUARDRAIL_EVALUATOR` (a dashboard text variable, unset is on) set to anything but `enabled` stops the evaluator at once without a deploy; the purge still runs and the run logs `disabled: true`.
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
| Older builds and rollbacks after a W→A row ships | The Worker must not be rolled back past CM-3b once any W→A row has shipped: an older Worker strips the new fields on the next PUT and answers 422 to the new review kinds. App builds from before CM-3b read backups strictly and cannot restore a file that holds a `cell-check` or `warmup` review, so the first row that writes one gates on a minimum app version (CM-3b). **Decision (row CM-15, Worker first):** the gate is a declared capability, not a version number. A build that reads a gated kind (`GATED_REVIEW_KINDS`, `warmup` now; CM-21 appends `cell-check`) says so with `?cap=warmup` on its snapshot GET and PUT and its Rescue Code claim. The Worker (`packages/backend/src/lib/review-kinds.ts`) serves gated entries only to a caller that declares them (the GET, a 409, the claim), and a backup file never holds one (any build may restore a file; the warm-up carries no result). Builds from CM-3b to CM-14 do not declare it either and simply never see warm-up entries. The Worker part deploys with the row and the app writes no warm-up entry before `questWarmup` ramps (built-in pct 0), so it is in place first. Once `questWarmup` has ramped, the web app is not rolled back past CM-15: a CM-3b to CM-14 build reads the warm-up entries already on the device and its backup writer does not leave them out, so a file it made could not be restored by a build from before CM-3b |
| A wrong device clock wins every merge | The Worker drops a `dayLog` day after its own UTC today + 1 day, reads such a `streakLocal` as absent, and reads a latch time or `memSeededAt` after its now as now. A `goals.setAt` up to 10 minutes ahead is read as now; further ahead it reads as absent when goals are stored, so stored goals are kept and a later real change on another device still wins on every later sync. `dayLog` is trimmed by count, not by distance from its newest day, and a day with 0 points takes no place (CM-3b). The wrong-clock device keeps its own value and sends it again on each sync; the rows that write goals, `dayLog` and `streakLocal` (CM-17) cap what they write at the last server time seen, so it stops. The memory store's `at` (CM-11) follows the same rule: a pushed `at` up to 10 minutes ahead is read as now, and further ahead the stored schedule is kept (read as now when nothing is stored); the memory store (CM-12) caps the `at` it writes at the last server time seen. The `warmup` and `feedback` days of `reviews[]` (CM-15) follow it too: the Worker drops one after its UTC today + 1 day, the device's merges and writes drop one after the latest local day of now, so none anchors the 14-day retention, and the device writes a day no later than the latest local day of the last server time seen (or the day after its kind's newest) |
| A review kind added after CM-3b | The Worker stores `reviews` as sent, so a build that does not know a newer kind drops those entries on its next sync and the server copy loses them. The row that adds the kind first adds a Worker preserve rule for stored entries of kinds the sender left out (Worker first). **Row CM-15:** on a PUT from a caller that does not declare a gated kind, the stored entries of that kind not in the sent list are kept; a caller that declares it sends the whole list, stored as sent. The 14-day retention of `warmup` and `feedback` entries runs after it, so an older build cannot bring a pruned entry back |
| The new fields cannot be cleared | Every F-CURR-002 field merges one way (union, max or earliest) on both sides, and an absent key keeps the stored value, so no client can clear them. A reset or start-over row needs a Worker-side reset first (Worker first) |
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
- commutative and idempotent for memory item fields (with the tie-break), `cellBest`, `dayLog` (summed per install key), `streakLocal`, `streakBest`, `stamps`, `testedOut`, `cellCheckAt`, `stageCheckAt`, `steadyWeeks` and `stageCeremonyAt`
- the `daily` retention prune of `reviews[]`: the same result whichever side merges first, and an entry pruned on one side never returns from the other
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
- keyboard paging on web and focus moving to the new page's first column header (on page 1, which has no header button, to the page 1 region)
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
| OD-5 | Lesson and story budget ceilings | **Raise as in section 10**; all lazy and precached; the start bundle must not grow | Keep today's ceilings (no Volume 2, book 2 or packs fit) | CM-5, CM-8, CM-8b (the story overlays and shelf leave the start bundle and the manifest before CM-46a, instead of a raise), CM-40, CM-46, CM-50a |
| OD-6 | Home headline number | **Confirmed: weekly dots and steady weeks**, with the local-day streak kept below them and 2 automatic rest days a local week | Keep the streak as the headline | CM-17 |
| OD-7 | Family lantern and class goal | **On**, totals only, target set by a grown-up behind the PIN | Off until asked | CM-61, CM-62 |
| OD-8 | Decoding Sprint, a 60-second optional bonus | **Yes**, optional, private personal best, like the vocab Speed Round | No timed activity outside the Speed Round | CM-32 |
| OD-9 | 차례 (ancestral memorial rite) in Holidays Volume 2 | **Teach as a reading word with a neutral, sourced note** (National Folk Museum of Korea) | Keep it out, as in Volume 1 (F-CURR-001 OD-9) | CM-45 |
| OD-10 | Hidden Heritage art | **Original token-coloured scenes** about genre-painting subjects, with source facts on the card back | Use public-domain museum images under KOGL Type 1 (larger files, licence tracking) | CM-36, CM-37 |
| OD-11 | Holdbacks | **Only for experiments E1-E4, at most 4 weeks**; otherwise staged rollouts with before and after cohorts | No holdbacks at all | CM-71 |
| OD-12 | Stage one-liner wording | **S4** "Read and answer short everyday exchanges." · **S5** "Read heritage stories and tales with Hoya." (folk stories return once the book 2 tales ship) · **S6** "Take Korean out into the world: menus, signs and short messages." · **S7** `anchorSkillEn` "Write a short personal introduction" | Other wording | CM-1 |
| OD-13 | My Story keepsake | **Not kept**: "My page" is shown at the end and cleared, as F-CURR-001 OD-6 | A kept, device-only keepsake page (needs a privacy review row and its own spec) | CM-38 |
| OD-14 | What keeps the streak | **Any learning activity** (quest, Daily Review, story, word set); amend F-REPORT-001 OD-19 in CM-0b | Quest sessions only, as F-REPORT-001 OD-19 today | CM-4, CM-17 |

**After OD-12 (open, needs owner wording).** Row CM-1 changed only the four OD-12 strings. Four older `stages.ts` strings still break the `review-copy` patterns (9.3), and CM-1's test holds them in a shrink-only `KNOWN_EXCEPTIONS` list: `stage7.oneLinerEn` "Say what you think, feel, and create — in Korean." (a speaking word; shown on the Journey), `stage2.anchorSkillEn` "Read and pronounce 60 core words across daily themes" (a speaking word), and `stage1.anchorSkillEn` and `stage5.anchorSkillEn` (`%`). The es and ko values of these fields carry the same wording. A reading and writing frame for Stage 7, such as "Write about what you think, feel and make, in Korean.", is a proposal only. A follow-up copy PR with the owner's wording rewrites them with es and ko and removes them from the list.

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
| CM-4 | `fix(mobile): streak on the local day, streakLocal and streakBest, no-drop switch-over (F-CURR-002 OD-14)` (W→A) | M | CM-3b | 0 | TZ fixed-clock tests, switch-over, an older-build sync never lowers the display; between two new builds, only the section 7.4 exception (a run another copy already ended), never a smaller number |
| CM-5 | `perf(content): lesson manifest split, per-locale title chunks, content-hashed precached bodies, budget lines, precache report (F-CURR-002)` | L | — | 0 | start-bundle and manifest budgets, precache gaps, chunk hash check, lazy-load test, offline e2e |
| CM-5B | `feat(mobile): Save for offline for packs` (only if the precache ceiling is crossed) | M | CM-5 report | 4 | offline e2e |
| CM-5C | `feat(mobile): in-place retry on the lesson waiting screen when a chunk needs the internet (F-CURR-002 §10)` | S | CM-5 | about 2 | render test from a cold store, offline e2e with the worker blocked |
| CM-6 | `build(content): generated modules no longer committed, turbo generate task, generated catalogue, addedIn date stamps for CATALOG_VERSION, derived route-day pins, presenter font and e2e cell list (F-CURR-002)` | L | CM-5 | 0 | generator determinism, catalogue parity, stamp check, route-day snapshot, font coverage |
| CM-7 | `feat(content-schema): lint rules (errors for Volume 2, packs and new stories; warnings for Volume 1) and coverage reports (F-CURR-002)` | M | — | 0 | rule unit tests with fixtures |
| CM-8 | `perf(content): stories out of the start bundle, shelf metadata in the manifest, per-story precached chunks (F-CURR-002)` | L | CM-5 | 0 | start bundle shrinks, per-story budget, offline story e2e |
| CM-8b | `perf(content): story narration overlays into the story chunks, body-only shelf fields out of the manifest, a story shelf chunk if the projection needs it (F-CURR-002 §10)` | M | CM-8 (and CM-40 for the projection) | 0 | start bundle shrinks (budget test), manifest budget with the 35-story projection, es and ko overlays applied to a story whose chunk loads later, offline story e2e in Spanish |
| CM-70a | `feat(backend): learning_rollups table and aggregation at ingest (F-CURR-002)` (Worker first) | M | CM-3 | 0 | no id stored, profile-day counting, suppression, additive SQL |
| CM-70b | `feat(backend): daily guardrail evaluator on a Cron Trigger that lowers a breached ramp (F-CURR-002)` | M | CM-2, CM-70a | 0 | breach lowers one step, only lowers, reason recorded |
| CM-70c | `feat(content-schema,backend,mobile): per-flag arms on session.end and arm cells in learning_rollups, so the guardrail evaluator compares a flag's arm with the rest (F-CURR-002)` (Worker first) | M | CM-2, CM-3, CM-70a, CM-70b | 0 | arm list closed to served flag names, no id stored, arm-vs-rest comparison, cohort fallback while arms are under the minimum; a per-kind session count (the kinds a session played, a closed set) so the per-kind quit line of 3.3 is the kind's own rate |
| CM-70d | `feat(backend): the D1 guardrail reads the account's rows written per day, not only the rollup sink's (F-CURR-002)` | S | CM-70b | 0 | owner chooses the source (Cloudflare GraphQL Analytics with a read-only scoped token, or the Worker summing `meta.rows_written` per day); the evaluator's D1 line reads it; no new write per request |
| CM-D1 | `design(reviews): Daily Review and Keep going, mastery ring, Cell and Stage Check, ceremony, goal ring and weekly dots (F-CURR-002)` | M | CM-0 | 0 | MAR design review |
| CM-D2 | `design(minigame): Cloze Pick, Dictation, Syllable Build, Match Shape, Story Order, Role Play, My Story, Yut Review (F-CURR-002)` | M | CM-0 | 0 | MAR design review |
| CM-D3 | `design(journey): Hidden Heritage scene style, Journey topic pages by horizontal swipe with page dots and arrow buttons, pack page, Passport; grid.md amended for the topic pages (F-CURR-002 OD-2)` | M | CM-0 | 0 | MAR design review |

### Phase 1: memory and review

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-10 | `feat(content-schema,content): review items from lessons, Stage 1 tables and stories, frozen ids, alias and retired lists (F-CURR-002)` | L | CM-5, CM-8 | 0 | `items-stable-id` snapshot, Stage 1 parity, extraction coverage over all three sources |
| CM-11 | `feat(backend): memory_shards table, delta routes with a seq cursor, backup and Rescue Code memory key (F-CURR-002)` (W first) | M | CM-10, CM-3b | 0 | full scope only, 413 cap, LWW with tie-break, OR and max merge, `seq` paging, rows written, CPU benchmark, additive SQL |
| CM-12 | `feat(mobile): memory store, spacing rule, recording from every surface, seeding, shadow mode (F-CURR-002)` | L | CM-2, CM-3, CM-3b, CM-11, CM-70a, owner request A profile rows | 0 | seeding fixtures (5 points and the all-done fixture), derived seeding, profile partition and flush on switch, `memory.daily` payload |
| CM-12b | `feat(content-schema,backend,mobile): G2 counter in memory.daily, the items introduced 30 days before the day and how many had 3 or more spaced answers, as buckets (F-CURR-002)` (Worker first) | S | CM-12, CM-70a | 0 | the counter on fixed clocks, rollup cells, payload parse before send |
| CM-13 | `feat(mobile): review engine: selection, interleaving, rungs by kind, credit inside sentences, 60-day simulation gate (F-CURR-002)` | L | CM-12 | 0 | property tests, determinism, simulations S-a to S-e |
| CM-14 | `feat(mobile): Daily Review, Keep going and mission slot 3 (F-CURR-002)` | M | CM-13, CM-D1 | about 16 | e2e incl. offline, stars-only result, end-early, review-first suggestion |
| CM-15 | `feat(mobile): quest warm-up and Try these again (F-CURR-002)` (W→A for `warmup`) | M | CM-13, CM-3b | about 6 | U-5 unchanged, e2e |
| CM-16 | `feat(content-schema,backend,web,mobile): summary memory block, teacher learning-summary route, reports show words known, ready to refresh and mastery (F-CURR-002)` (W→A) | L | CM-3b, CM-12, CM-20 | about 10 | report builder tests, route permission tests, console e2e |
| CM-17 | `feat(mobile,backend): daily and weekly goals, rest days, points per install key (F-CURR-002)` (W→A for new fields) | L | CM-4, CM-3, CM-3b, CM-D1 | about 16 | points accrual and sum, rest days, TZ tests, merge; also ships the ended-run "Start a new run" copy (en, es, ko, review ledger) and the `streakBest` display on Home (section 7.4), which CM-4 leaves out |

### Phase 2: achievement

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-20 | `feat(mobile): mastery levels on best box, started-volume denominator, cellBest latch, grid ring, words known milestones (F-CURR-002)` | M | CM-12, CM-D1 | about 8 | derivation reads only monotonic fields, latch never drops, New volume marker, 320 px visual, a11y labels |
| CM-21 | `feat(mobile): Cell Check and test-out (F-CURR-002)` (W→A for `cell-check`) | L | CM-13, CM-20, CM-3b, CM-D1 | about 10 | seeding by result, untested at box 1, entitlement, `routeNext` skip, e2e |
| CM-22 | `feat(mobile): Stage Checks for Stages 2-7, PRIZE_STAGES, ceremony, retroactive summary listing existing cards (F-CURR-002)` (W→A for `stageCeremonyAt`) | L | CM-21, CM-3b, CM-D1, OD-1 | about 12 | prize table, summary once, never blocks, `stage.card_opened`, e2e |
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
| CM-36 | `feat(mobile): Hidden Heritage engine, first scene (Food) and slide kind (F-CURR-002 OD-10)` | L | CM-D3 | about 8 | hit areas a11y, Korean-word targets, 25 KB budget, fallback, Playwright |
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
| CM-46a | `content(stories): read tiers for the 10 listen-only stories (F-CURR-002)` | M | CM-8, CM-8b | overlays | story checks, per-story budget |
| CM-46 ×5 | `content(stage5): book 2 tales for Nature, Food, Holidays (folk tales), Play, Letters (F-CURR-002)` | M each | CM-8, CM-8b, CM-34, CM-46a | overlays | story pipeline, `story-topic-unique`, adaptation rule, coverage report, MAR |
| CM-47 | `feat(mobile,content-schema): realia kinds recipe, receipt, label, forecast, calendar, timetable, map, poster (F-CURR-002)` | M | — | about 8 | renderer per kind, art budget |
| CM-48 | `feat(mobile,content): This week in Korea, engine and first 13 drops (F-CURR-002)` | M | CM-12 | about 4 + overlays | date gating offline, TZ tests |

### Phase 5: breadth (Topic Packs)

Each pack is 5 level PRs; the Pack Check ships in the L5 PR. Level dependencies by format: L1 needs CM-32 (Syllable Build); L2 needs CM-30 (Cloze Pick); L3 needs CM-34 and CM-35 (Story Order, Role Play); L4 needs CM-31 and CM-47 (Dictation, realia kinds); L5 needs CM-38 (My Story) and CM-13 (Pack Check).

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-50a | `feat(content-schema,scripts): Topic Pack schema, PACK_LEVEL_ID_RE, CatalogPack, build-lessons pack input, pack order list, placement and route-day rules, new-pack scaffold (F-CURR-002 OD-2, OD-3)` | L | CM-6 | 0 | schema, `pack-skeleton`, packs never placed out, every pack directory in `order.json`, scaffold, pack levels outside the start-loaded manifest (section 10: a pack manifest chunk and a pack title chunk per locale, loaded with the topic pages) |
| CM-50b | `feat(mobile): Journey topic pages by horizontal swipe, with page dots, arrow buttons and keyboard paging, and the pack page (F-CURR-002 OD-2)` | M | CM-50a, CM-20, CM-D3 | about 37 | page layout (page 1 unchanged, five columns a page, 54 dp at 320 px), swipe direction lock, buttons and arrow keys, screen-reader labels, reduced motion, entitlement, `topicPacks` and `pack.<key>` off behaviour, e2e |
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
| CM-60 | `feat(mobile): weekly quests and Passport stamps (F-CURR-002)` | M | CM-17 | about 48 | deterministic pick, latch merge, quest kind stored with each weekly stamp |
| CM-61 | `feat(backend,mobile,web): family lantern, Worker total from summaries, space-goal read, target behind the PIN (F-CURR-002 OD-7)` (W→A) | M | CM-16, CM-17, owner request A account switching and PIN | about 8 | totals only, cross-device sum, offline total, PIN gate, e2e with 2 profiles |
| CM-62 | `feat(backend,web,mobile): class goal, space_goals, counts-only class-progress route, console setter, presenter bar (F-CURR-002 OD-7)` (W→A) | L | CM-3, CM-16, CM-17 | about 12 | Worker totals, class scope allowed on class-progress only, additive SQL, e2e |
| CM-63 | `feat(lecture): game block and presets by-topic, class-check, class-review (F-CURR-002)` | L | CM-16, CM-21, CM-36, CM-39 | about 18 | no names on projector, slide mapping, old-presenter decode failure, e2e |
| CM-70 | `feat(web): owner-only metrics page over learning_rollups (F-CURR-002)` | M | CM-70a, CM-70b | about 10 | small-group suppression, counts only |
| CM-71 | `feat(mobile): experiment exposure and E1-E4 (F-CURR-002 OD-11)` | S | CM-2, CM-70a | 0 | per-profile bucket stability |
| CM-72 | `feat(mobile): FSRS-lite shadow predictions and calibration bins (F-CURR-002)` | M | CM-12 | 0 | property tests, no scheduling effect |

**Row count:**

| Group | PRs |
|---|---|
| Phase 0 | 20 (plus the conditional CM-5B) |
| Phase 1 | 8 |
| Phase 2 | 8 (CM-23 counts as 3) |
| Phase 3 | 20 (CM-37 ×4, CM-3A ×5) |
| Phase 4 | 34 (5 themes ×5, book 2 ×5, plus CM-40, CM-46a, CM-47, CM-48) |
| Phase 5 | 44 (8 packs ×5, plus CM-50a, CM-50b, CM-50c, CM-59) |
| Phase 6 | 7 |
| **Total** | **141** |

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
- **Unblocked here:** F-CARD-S2..S7-001 (CM-23), delivered by rows CM-23a, CM-23b and CM-23c (F-CARD-S2, S3, S4, S6 and S7 amended to one card per upper cell; Stage 5 holds the books), and F-STORY-005 PR 5.8 (CM-40).
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
9. **Guardrails on cohorts, not arms.** Until row CM-70c, the guardrail evaluator compares everyone before a step with everyone after it (12.3). It assumes a harmful feature shows in the whole cohort. At a 10% step an effect inside the arm is diluted about 10 times, and a breach lowers every ramping flag whose windows show it. The inputs come from an anonymous endpoint; a forger can at most pause a ramp one step, with the reason on the row, or spend the rollup budget so the flag is `unchecked`.
10. **Guardrail lines weaker than 3.3 states.** Until row CM-70c the per-kind quit line is a kind's share of all play (12.3), and until row CM-70d the D1 line sees only the rollup sink's rows, so it is advisory. The evaluator applies the 20-event threshold per cohort, not per day (12.3); the owner metrics page keeps the per-day rule.

## 20. Review round 1 (2026-10-21)

Two reviews (learning science and content; engineering and pipeline) raised 36 findings: 2 blockers, 21 majors and 13 minors. The blockers were that a box could rise several times inside one quest (fixed by the spacing rule, 4.3) and that telemetry had nowhere to persist before the shadow period (fixed by CM-70a and CM-70b in Phase 0). Every blocker and major is fixed in this revision, and so is every minor except the parts noted in the PR comment. The phase plan is unchanged; section 17 is re-sequenced.

## 21. Owner decisions (2026-10-21)

The owner answered section 16 on 2026-10-21:

- **OD-2 changed.** New categories (Topic Packs) are browsed by a horizontal swipe. The Journey view keeps the five themes exactly as today, and swiping sideways shows further pages of pack columns. Cells never shrink below the 48 dp target at 320 px; a visible affordance shows there is more to the side; buttons that need no swipe serve keyboard and screen-reader users; reduced motion is respected. The pack data model is unchanged. Sections 0, 6.1, 6.2, 12.2, 13, 14, 15 and 17 (rows CM-D3 and CM-50b) are updated, and the Explore shelf of the earlier draft is removed.
- **OD-4 confirmed.** The first wave is Numbers & Time, People & Family and Feelings & Me.
- **OD-6 confirmed.** Weekly dots are the Home headline, with 2 automatic rest days a local week.
- **Every other OD** stands as proposed and is now decided.
- **Open for the owner (row CM-13 simulation gate).** As written, the S-a assertion of 4.3 cannot pass at about 7.8 new items a quest-day with these intervals, because the items falling due each day alone exceed 3 x the Daily Review size. Row CM-13 reads "the pool" as the pool left at the end of the day and "one Keep going" as one sitting of up to 3 rounds; the 4.3 table now states both. At that reading the review-first suggestion shows on most late days for a one-quest-a-day learner (26-27 of days 30-60), and the learner reviews about 40 items a day. The gate pins those numbers. Before `dailyReview` ramps (row CM-14), the owner confirms the readings or chooses another lever: a review-first line measured on another pool or factor, a lower intro rate, or other intervals. Existing learners migrated by seeding peak at a 414-item opening pool, with 190 left on day 60 (S-c); the shadow period (section 19, assumption 7) checks the real pools against the simulation.
- **Open for the owner (row CM-22).** Three departures from design/wireframes/reviews/stage-check.md, each recorded in the 7.3 decision record: (a) Stage 5 (the books) teaches no review items, so it offers no Stage Check while sections 0 and 7.3 say Stages 2-7 (its ceremony still shows); (b) the retroactive summary shows even when no stage card exists yet ("Every stage you finished stays on your Journey."), where the wireframe skipped it; (c) after a plan lapses the Stage Check of a finished stage is not offered (F-ENT-003, as the row says), where the wireframe kept it playable. The ceremony's six per-stage can-do lines and places row are left to a later copy row, so this row adds no new facts.
- **Open for the owner (CM-D3 design pass).** Two §6.1 write-backs are proposals until the owner confirms them: the header band that grows the space above page 1's theme labels when packs are shown (README D3), and the short pack word under the column-header glyph in place of the full name (README D5).

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
