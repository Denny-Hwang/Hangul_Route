Status: ready (spec only; no row has started)

# F-CURR-002 — Category expansion and mastery: one memory model, review sessions, mastery and stage checks, Volume 2 of the five themes, and Topic Packs

> **Owner request 2026-10-21 (B, binding):** plan further development of the lesson categories. Today there are five themes (Letters 글자, Food 음식, Holidays 명절, Nature 자연, Play 놀이). Plan both directions: richer content inside each category, and new categories. The service must be more fun and varied, and above all give a sense of achievement and efficient learning. Production level: every row ships finished content reviewed by the multi-agent review (MAR, owner decision 2026-10-12). Rows do not wait on the owner, except where section 16 names an open decision; until the owner answers, rows follow the recommended default.

**Scope**: `packages/content-schema` (review items, memory state, topic packs, mastery, new round schemas, lint rules) · `scripts/` (`build-lessons.mjs` item extraction, manifest split, generated catalogue, `new-pack.mjs`) · `content/episodes/` (Volume 2 cells), `content/packs/` (new), `content/stories/` (new tales and read tiers), `content/i18n/{es,ko}/` · `apps/mobile` (memory store, review engine, Daily Review, mastery ring, Cell and Stage Checks, goals, new game renderers, Explore shelf) · `packages/backend` and `apps/api/migrations` (memory delta routes, remote config, class goal, rollups; additive, Worker first) · `apps/web` console (reports, class goal, metrics page) · lecture mode (presets and slide kinds) · `packages/i18n` (en, es, ko) · `design/wireframes/` and `design/screens/` (design rows CM-D1 to CM-D3)
**Owner**: solo dev (content written by agents and reviewed by MAR)
**Rollout**: phases 0 to 6 in section 12. Every new surface has a build-time kill switch and a remote off switch (section 12.2). The memory model runs in shadow mode for two weeks before any learner sees a review screen.
**Wireframes**: design rows CM-D1 (review and achievement surfaces), CM-D2 (new games), CM-D3 (Hidden Heritage, Explore shelf, pack page, Passport) produce them before any UI code. Existing `design/wireframes/journey/grid.md`, `quest/{player,discover,check}.md`, `reviews/hangul-check.md` and `minigame/*` stay valid.

Parent and siblings: CLAUDE.md section 1 (audience, languages, anti-shame, grid) · blueprint 04 (grid, themes, pillars, companions) · blueprint 05 (stage goals, cumulative word targets) · blueprint 06 (game catalogue: Role Play, Hidden Heritage, My Story) · F-CURR-001 (upper-stage content, rules U-1 to U-10, the lesson pipeline; section 4 amended here, OD-1) · F-QUEST-002 (six-step quest) · F-RVW-001 (review tests; amended by row CM-0b) · F-VOC-005 (Leitner boxes, local day, monotonic merge) · F-STORY-005 (volumes, `MAX_EPISODES_PER_CELL`, PR 5.8) · F-STORY-006 (card awards) · F-CARD-S2-001 .. S7-001 (card art, unblocked here) · F-PLC-001 (level check ceiling) · F-PLAN-002 (catalogue, `CATALOG_VERSION`) · F-ENT-003 (free plan = all of Stage 1) · F-TCH-004 and `AMENDMENTS-LECTURE-V2.md` (lecture mode) · F-REPORT-001 (reports) · F-SYNC-001 / F-SYNC-002 (snapshot sync, backup) · F-RESTORE-001 (Rescue Code) · F-AUDIO-004 (device voice, visible sound notice) · F-I18N-001 (overlays, ratchets) · `docs/roadmap/TELEMETRY-NAMES-2.md` (new section R) · the multi-learner account plan of owner request A (2026-10-21, its own spec; section 4.9 states what this spec needs from it)

---

## 0. Decisions on one page

1. **Make what we teach stick before we add more of it.** About 780 Korean strings taught in lessons never come back. Every taught item gets a stable id and enters one memory model, built on the shipped F-VOC-005 Leitner boxes (section 4).
2. **Review is short and interleaved.** Three sessions use it: a 2-3 minute Daily Review, a 30-second warm-up before a quest, and "practise the ones you missed" after a quest (section 4.5).
3. **Achievement continues past Stage 1.** Every cell gets a visible mastery ring that never goes down. Each cell gets a Cell Check, which doubles as a test-out. Stages 2-7 get a Stage Check, a ceremony and a stage card. The 25 upper cells get cards, grouped into five category albums (sections 4.4, 7).
4. **Variety comes from formats, not only content.** Eight new formats, all reading, listening or writing. A lint caps any one game at 40% of a stage's Checks, down from 100% today (section 7.1).
5. **Depth inside a category is Volume 2.** The volume system F-STORY-005 already specifies gives 25 upper cells a second volume and five Stage 5 books a second book. Nature and Play go first, because they are the thinnest (section 5).
6. **New categories are Topic Packs on an Explore shelf, not a sixth grid column.** A sixth column puts the cell under the 48 dp touch target at 320 px, and the theme key is in 47 files and the Worker. There are eight packs in three waves, starting with Numbers & Time (section 6).
7. **Remove authoring bottlenecks before content scales.** A content PR then touches only `content/` and its overlays: the catalogue, `CATALOG_VERSION`, route-day pins, presenter font and e2e cell list are all generated (section 9).
8. **Lessons load outside the start bundle.** A manifest of 60 KB or less is loaded at start. Lesson bodies are precached static chunks, so offline still works and start-up gets lighter while content triples (section 10).
9. **Every phase is measured without PII.** A public, read-only remote config replaces build-only kill switches, and each device places itself in an experiment bucket. Metrics are counts by content id, and any cell with fewer than 20 profiles is suppressed (sections 3, 11, 12).

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
| Streak | Quest sessions only, counted on the UTC day (`logic/streak.ts`) | Wrong day near midnight for most of the world |
| Stories | 24, but Nature has 2 and Food 3; 10 have no `read` tier; Stage 5 promises "folk stories" and has 2 | Thin columns; a copy promise not kept |
| Culture notes | 70 authored, none reach the screen; S2 Nature, S4 Letters, S4 Nature and S7 Food have none | Authored value is invisible |
| Lesson budget | 914,729 B raw / 133,276 B gzip of a 950,000 / 140,000 ceiling; `lessons-index.ts` (372 KB raw) loads at start | About 2 cells of headroom; start-up cost grows with every cell |
| Kill switches | Build-time `EXPO_PUBLIC_*` only (`config/flags.ts`) | Turning a feature off means a redeploy |
| Copy against the standing rules | Stage 4 "real-life mini conversations", Stage 6 "menus, signs, calls", Stage 7 `anchorSkillEn` "Record a 1-minute personal introduction", Stage 5 "folk stories"; F-RVW-001 has age wording | Fixed in row CM-1 and CM-0b |

## 2. User stories

> As **a learner of any age**, I want the words and sentences I learned last week to come back at the right moment, in short, varied rounds, so they stay with me, and I want to see on my map which places I have truly mastered.

> As **a learner who already knows some Korean**, I want to show what I know and skip ahead, so I spend my time on what is new.

> As **a learner who wants more**, I want each theme to keep going after its first volume, and new topics I can choose myself, such as numbers and time, people and family, or music and art.

> As **a parent or teacher**, I want to see what each learner has mastered and what is ready to refresh, set a shared weekly goal for my family or class without ranking anyone, and run a class review or a class game from the same content.

## 3. Goals and metrics

### 3.1 North star

**Weekly durable items.** Per active learner profile, the number of distinct items answered right on the first try at box 3 or higher (held for at least 7 days) in the last 7 local days. It goes up only when learners both learn and remember. It is reported as a distribution (p25, p50, p75) over profiles, never per person.

### 3.2 Goals

Baselines come from the two-week shadow period of row CM-12 and from existing events. Targets are measured 8 weeks after a phase reaches 100%.

| ID | Goal | Metric (no PII; source) | Target |
|---|---|---|---|
| G1 | Remember what was taught | First-try recall on items whose last practice was 6-8 days earlier (`memory.daily` lag histogram) | 80% or more |
| G2 | Spacing reaches learners | Share of items with 3 or more spaced retrievals within 30 days, for profiles active 3 or more days a week (`memory.daily`) | 70% or more |
| G3 | Efficient study | Items newly reaching box 3 per study minute (`memory.daily` and session minutes) | +25% against the before cohort, or against holdback E1 |
| G4 | Right difficulty | Share of quest and review sessions with first-try accuracy of 70-92% (`quest.complete`, `review.complete`) | 80% of sessions or more |
| G5 | Achievement past Stage 1 | Share of Stage 2-7 finishers who see their stage ceremony (`stage.complete`, `review.complete` kind `stage-certificate`); cells at mastery 2 or higher by day 30 among cells done | 100% of finishers see a ceremony; 50% of done cells at mastery 2 or higher |
| G6 | Habit | Days with a Daily Review done divided by days with any session; D7 and D30 return of new profiles by creation-week cohort | 55% or more; D7 +5 pp, D30 +3 pp |
| G7 | Variety | Largest share of one game kind among a stage's Checks; distinct kinds per stage (build-time report) | 40% or less (100% today in Stages 1-4 and 6); 5 or more kinds per stage |
| G8 | Depth | Total guided minutes; distinct taught items (build report) | About 494 to about 1,400 minutes; about 930 to about 2,300 items |
| G9 | Decoding fluency | Median correct decodes per minute, first Decoding Sprint against the fourth, Stage 1 finishers (`decode.sprint.finished`) | +30% |

### 3.3 Guardrails

A ramp step halts automatically if any guardrail is breached (section 12.3).

- Mid-quest quit rate per game kind (`quest.start` with no `quest.complete` within 15 minutes) must not rise by more than 2 pp.
- Quits after a wrong streak (two or more wrong first tries in a row, then exit) must not rise.
- Median session length must not fall by more than 10%, and p90 must stay under 20 minutes.
- Sync 4xx and 5xx rates must not double, and the p95 memory delta size must stay under 32 KB.
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
| Spacing (Cepeda et al. 2006) | Leitner boxes at 1, 3, 7, 14, 30 days on the local day (F-VOC-005), over every taught item |
| Interleaving (Rohrer and Taylor 2007) | Review mixes themes, kinds and formats; content lint `lesson-recycle` |
| Desirable difficulty, the "85% rule" (Bjork; Wilson et al. 2019) | Adaptive pacing keeps first-try accuracy in about 70-92%; the modality ladder moves a known item up from recognition to production |
| Forward testing effect (Pastötter and Bäuml 2014) | Up to three due items before new material in a quest |
| Mastery learning (Bloom 1968) | Mastery levels depend on spaced success, not on replays |
| Pretesting and test-out (Richland et al. 2009) | The Cell Check works as a test-out from any unstarted cell |
| Comprehensible input (Krashen; Nation's 95-98% coverage) | A story coverage report and a "fits you" label |
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
- **Extraction.** `build-lessons.mjs` reads every Discover item and every scored round's answer, and writes a lazy `review-items` chunk. Each entry carries: id, kind, Korean text, romanization, gloss key, theme or pack, stage, the cells that teach it, and the formats it allows.
- **Size.** About 1,100 items today and about 2,300 at the end state. At about 60 B each that is about 140 KB raw, loaded lazily (section 10).

### 4.3 The scheduler

- **Box rules are F-VOC-005 P3, unchanged.** Box 0 means not met. A first-try right answer that was not hinted moves the item up one box. A wrong answer moves it down one box, never below 1, and makes it due tomorrow. Intervals for boxes 1-5 are 1, 3, 7, 14 and 30 days, on the device's local day. **Response time is not used**, so a learner who needs more time is not scheduled worse.
- **Modality ladder.** Each item records which of three rungs it has passed:
  1. **recognize**: hear it and pick it (or see it and pick it when no voice is available)
  2. **read**: see the Korean and pick the meaning or picture
  3. **produce**: type it, build it, take it as dictation, or fill a gap

  At box 3 or higher, review asks the item at its next unpassed rung. A right answer at a higher rung also marks the lower rungs. A miss at the produce rung clears only the produce flag and lowers the box by one. Production enters review without any speaking.
- **Avalanche guard.**
  - A day shows at most 20 due items.
  - Overflow moves to the next 7 days with jitter seeded by the item id, so it is deterministic.
  - A day introduces at most 15 items from seeding (section 4.8).
- **Later: an FSRS-lite shadow (row CM-72).** It predicts recall for the same items without scheduling anything, and reports calibration bins in `memory.daily`. A switch from Leitner to FSRS is a later decision, made on measured calibration after 8 weeks. It is not part of this spec's rollout.

### 4.4 Mastery

Each grid cell (all volumes together) and each pack level shows a level from 0 to 3. It is drawn as a three-segment ring in theme tokens around the 54 dp cell, so it needs no extra width.

| Level | Name on screen | Rule |
|---|---|---|
| 0 | none | not started |
| 1 | Done | every quest of the cell's first volume done, or the Cell Check passed as a test-out |
| 2 | Practiced | 80% or more of the cell's items at box 3 or higher |
| 3 | Mastered | Practiced, plus the Cell Check passed (80% or more first-try), plus 60% or more of the items at box 4 or higher |

- **The level never drops.** A new snapshot field `cellBest: Record<cellOrPackLevelId, 0-3>` merges by max. Boxes can fall, but the visible level cannot. This follows F-VOC-005 P2: learner screens read only monotonic fields.
- **Due items glow.** When a mastered cell has items due, the ring shows a soft glow labelled "Ready to refresh". The glow is never drawn as wilting, cracking or loss.
- **Words known.** A counter of items at box 2 or higher appears on Home and the Learning Route. Milestones at 100, 250, 500, 1,000 and 2,000 bring a short Hoya celebration.

### 4.5 Review sessions

All sessions share one engine (`logic/review/engine.ts`, row CM-13). The engine is pure, deterministic for a seed, and works offline.

| Session | Length | Where it lives | Selection | Learner sees |
|---|---|---|---|---|
| **Daily Review** (the F-RVW-001 Daily Test, rebuilt on this model) | 10 items, about 2-3 min (experiment E2: 6 against 10) | Today mission slot 3, when 3 or more items are due; also on Home | 60% due (oldest first), 25% at risk (a miss in the last 3 days, or box 1-2 due within 2 days), 15% stretch (next rung of a box 3+ item). Ends early with "All refreshed today" when nothing is due | Stars by F-RVW-001 section 3.1, and "N got stronger" |
| **Warm-up** | up to 3 items, 30 s or less, before the six steps of a Stage 2+ quest | Quest player, outside the six steps (so F-CURR-001 U-5 timing is unchanged) | due items from earlier cells; skipped when none are due | nothing scored; a soft "Warmed up" |
| **Practise the ones you missed** | the quest's missed items, 30-60 s | Quest reward step, as the default suggestion when there were misses (a full replay stays available) | the misses of the session just played (F-RVW-001 Feedback Review, kind `feedback`) | stars |
| **Cell Check** | 8-10 items, about 3 min | Cell sheet, after the first volume is done; on any unstarted cell as **Test out** | the cell's items, at least 30% at the produce rung, interleaved | stars; 80% or more first-try counts toward Mastered, or marks Done when used as a test-out |
| **Stage Check** | about 20 items, 6-8 min, untimed, retake freely, best result latches | Journey stage header, after the stage latch | items from all five themes of the stage, at least 30% produce | stars, then the ceremony and the stage card |
| **Pack Check** | 10 items | Pack page, after level 5 | the pack's items | stars, then the pack badge |

**Interleaving rules.** No more than 2 consecutive items from one theme, and no more than 3 consecutive items in one format.

**Format by rung and kind:**

| Rung or kind | Format |
|---|---|
| recognize | Listen & Pick, or Read Pick when the device has no voice |
| read | Pic-Word Match, or Read Pick Meaning |
| produce, `lex` | Type Hangul in `see` or `picture` mode, Dictation (Type Hangul `hear`), or Syllable Build |
| produce, `pat` | Cloze Pick, or Sentence Builder |
| `exc` | Dialogue reply pick |
| `rea` | A one-question realia micro-read |

**Never on a review screen:** a percentage, an "n of m" score, or a per-question timer. A lint enforces this (section 9.3).

**Test-out details:**
- The quests of a cell passed by test-out show "Tested out" and 2 stars, and stay replayable.
- The cell's items are seeded at box 2.
- `routeNext` skips tested-out cells.
- A test-out needs access to the cell under F-ENT-003, the same as playing it.

**Later (row CM-25): Stage Jump Ahead.** It applies the Cell Check rule to a whole stage. It also amends F-PLC-001, because a learner could then be placed above `stage3`.

### 4.6 Adaptive pacing inside a quest

- **Strong round:** first-try accuracy of 90% or more in Practice skips the second Discover page of later quests in the same cell and shortens Apply by one round.
- **Hard round:** two wrong first tries in Practice insert one scaffold round: the same items in an easier format, with the hint showing.
- Nothing is ever taken away and nothing is said about speed. The event is `quest.adapt { questId, dir }`.
- The F-CURR-001 timing bands describe the standard path. U-5 checks the standard path only.

### 4.7 Comprehensible input for stories

- **Report `story-coverage` (report only).** For each story and tier, it gives the share of tokens taught by the story's recommended stage. The authoring target is 95% or more.
- **"Fits you" label.** On the shelf, a story is marked "Fits you" when 95% or more of its items are at box 2 or higher for the active profile. It is computed on the device and never sent.

### 4.8 Storage, sync and migration of existing users

**Where state lives**
- **Topic words stay in the `vocab` slice of the snapshot**, unchanged (F-VOC-005).
- **Lesson and pack items live in a separate memory store.**
  - A full snapshot is pushed on every sync (`PUT /api/sync/learners/:id/snapshot`). An object per item like the vocab slice is about 150 B, so 2,300 items in the snapshot would add about 340 KB per learner per sync. Accounts with several learners make this worse (section 4.9).
  - On the device, the store is a local table keyed by profile and item, in IndexedDB on web and in the app's storage on native.
  - The server copy is a new D1 table:

    ```sql
    -- next free migration number at merge time (0013 on main today); additive
    CREATE TABLE memory_items (
      learner_id TEXT NOT NULL,
      item_id    TEXT NOT NULL,
      state      TEXT NOT NULL,   -- compact JSON: {b, d, r, n, l, f, s, at}
      at         TEXT NOT NULL,   -- last-writer-wins key of the schedule
      PRIMARY KEY (learner_id, item_id)
    );
    ```

- **State fields and merge rules:**

| Field | Meaning | Merge |
|---|---|---|
| `b` | box 0-5 | last writer wins on `at` |
| `d` | due local day | last writer wins on `at` |
| `r` | rungs, as a bitmask | OR |
| `n` | reps | max |
| `l` | lapses | max |
| `f` | first day | min |
| `s` | best box | max |

  This is the F-VOC-005 contract applied to a new store: learner-visible fields only grow, and the schedule merges last-writer-wins.

**Routes (Worker first)**
- `POST /api/sync/learners/:id/memory` takes up to 500 changed states per call. Anything larger is rejected with 413.
- `GET /api/sync/learners/:id/memory?since=<cursor>` returns changes since a cursor.
- Both use the F-AUTH-003 ownership guards. The path carries only the opaque learner id, as the snapshot route already does. No name or email appears.
- Writes queue in the existing offline queue and flush when online.
- The F-SYNC-002 backup file and the F-RESTORE-001 Rescue Code restore gain a `memory` section.

**New snapshot fields** (optional, additive, preserved by the Worker before any app writes them):

| Field | Contents | Merge |
|---|---|---|
| `cellBest` | `Record<id, 0-3>` | max |
| `cellCheckAt` | `Record<id, ISO>` | earliest |
| `stageCheckAt` | `Record<stage, ISO>` | earliest |
| `testedOut` | `Record<cellId, ISO>` | earliest |
| `goals` | `{ daily: 3 \| 6 \| 10, weeklyDays: 3 \| 5 \| 7, setAt }` | last writer wins on `setAt` |
| `dayLog` | `Record<localDay, points>`, last 70 days | max per day |
| `stamps` | `Record<stampId, ISO>` | earliest |
| `memSeededAt` | ISO | earliest |

`reviews[]` starts to receive `daily`, `feedback` and `stage-certificate` entries; the schema already exists. Two kinds are added to `ReviewKindSchema`: `cell-check` and `warmup`.

**One-time seeding on first launch of the new build.** It runs per profile, is idempotent, and is guarded by `memSeededAt`.
1. Every quest done in `questDoneAt` seeds its cell's items: box 2 when the quest scored 3 stars, box 1 otherwise. Due dates are staggered over 14 days, at most 15 a day, ordered by stage.
2. Topic words already in `vocab` are not copied; the engine reads them where they are.
3. Placement `priorityTokens` symbols are seeded at box 1, due on day 1.
4. `cellBest` starts at 1 for every cell done. Nothing seeded counts above level 1 until it is earned.
5. **Upper-cell cards and stage ceremonies are awarded retroactively.** A latched stage gets one summary screen, "You finished Stages 2-3 earlier; here are your cards", not one modal per stage.
6. **Streak switch-over.** The new local-day streak shows `max(old UTC streak, new local streak)` once, so no number drops.

Fixture tests run against snapshots from five historical schema points: before `vocab`, before `questDoneAt`, before `placements`, a current snapshot, and an empty one. Backup-file restore is tested too.

### 4.9 Accounts shared by several people (owner request A)

Owner request A (same day, its own spec) lets one account hold several learners plus grown-up personas, switched on one device, with a PIN for grown-up personas. This spec depends on only three things from it:

- **All learning state is per learner profile.** That covers memory items, `cellBest`, goals, `dayLog` and stamps, so switching profile switches all of it. A parent who also learns has a learner profile and counts like any learner.
- **Grown-up personas read and never write learning state.** Reports, the console and lecture mode show mastery, words known, items ready to refresh and Stage Check results for every learner, because parents and teachers see all learner info. Grown-up personas never record review answers.
- **Shared goals are set by a grown-up.** The family weekly goal and the class goal are set in a grown-up persona, so behind the PIN on a shared device. Learner screens show totals only (section 7.6).

On a shared device the memory store is partitioned by profile id. A profile switch flushes the outgoing profile's pending deltas first.

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

### 5.2 Letters & Books (`letters`)

| Stage | Volume 2 content | New formats |
|---|---|---|
| S1 (additions, free) | Letter-shape origins: ㄱ ㄴ ㅁ ㅅ ㅇ drawn from the speech organs, and the three vowel bases ㆍ ㅡ ㅣ (National Hangeul Museum). A Decoding Sprint review. A batchim quest for the 7 representative final sounds | Match Shape, Syllable Build, Decoding Sprint |
| S2 | Final-consonant words grouped by the 7 representative sounds; word families (학교, 학생, 학년); sound-change spotting for liaison (책이 [채기]) and nasalization | Syllable Build, Listen & Pick between two spellings |
| S3 | Library and classroom sentences (책을 읽어요, 이름을 써요); why Hangul was made (National Hangeul Museum) | Cloze Pick, Sentence Builder |
| S4 | At the library desk and the bookshop: borrow a book, ask where a shelf is. Adds the missing culture notes (Hunminjeongeum, Hangeul Day on 9 October) | Role Play (read and tap) |
| S5 (book 2) | Jikji and movable metal type (Cheongju Early Printing Museum; UNESCO Memory of the World 2001); the Annals of the Joseon Dynasty (UNESCO Memory of the World 1997); read tiers for the listen-only Letters stories | Story Order |
| S6 | Library card, book cover, a Hangeul Day poster, subway station name boards (drawn, generic) | Realia Read, new kind `poster` |
| S7 | Write a postcard (편지 frame) or a one-line diary (일기); trace a word in brush-style letters | My Story, Trace a Word |

### 5.3 Food & Daily Life (`life`)

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Five tastes (달다, 짜다, 맵다, 시다, 쓰다); spoon and chopsticks (숟가락, 젓가락); the table set (밥, 국, 반찬); a market scene | Hidden Heritage (market scene), Card Match |
| S3 | Taste and preference patterns (맛있어요, 좋아해요, ___ 주세요); recipe steps in order | Cloze Pick, Sentence Builder as sequence |
| S4 | Snack bar (분식집) ordering; mealtime set phrases (잘 먹겠습니다 / 잘 먹었습니다) | Role Play |
| S5 (book 2) | Kimjang, making and sharing kimchi (UNESCO 2013; Korea Heritage Service); a market day in Kim Hongdo's genre paintings (National Museum of Korea) | Story Order |
| S6 | Recipe card, a receipt, a packaged-food label, a snack-bar menu (all drawn, no brands) | Realia Read, new kinds `recipe`, `receipt`, `label` |
| S7 | Write my favourite food or the steps of a simple recipe. Adds the missing S7 culture notes on table manners and banchan | My Story |

### 5.4 Holidays & Traditions (`rites`)

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Holiday foods (떡국, 송편, 오곡밥); Dano, Daeboreum and Dongji words; the first-birthday table (돌잔치); 차례 as a reading word with a neutral, sourced note (OD-9) | Pic-Word Match, Syllable Build |
| S3 | Greeting-card sentences (새해 복 많이 받으세요 and its variants); seasonal sentences from the 24 solar terms (dates from the Korea Astronomy and Space Science Institute) | Cloze Pick |
| S4 | Seollal visit exchange: the New Year bow (세배), replies to elders. Kinship and honorific forms follow the National Institute of Korean Language guide 「표준 언어 예절」 | Role Play, greeting pick by occasion |
| S5 (book 2) | Folk tales that keep the "folk stories" promise: Gyeonu and Jiknyeo (견우와 직녀, Chilseok) and The Sun and the Moon (해와 달이 된 오누이), both traditional and public domain; Gangneung Danoje (UNESCO 2008) | Story Order |
| S6 | Event poster, festival timetable, a holiday train ticket, a lunar and solar calendar page | Realia Read, new kinds `calendar`, `timetable` |
| S7 | Write a New Year card or a holiday message to a relative | My Story |

### 5.5 Nature & Animals (`nature`). It absorbs Weather & Seasons and Animals, so these are not separate packs

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Seasons and weather (봄, 여름, 가을, 겨울; 비, 눈, 바람); native animals (까치, 반달가슴곰; National Institute of Biological Resources). Adds the missing culture notes: the magpie and the tiger in folk painting (minhwa, National Folk Museum of Korea) | Hidden Heritage (four-season scene), Pic-Word Match |
| S3 | 비가 와요, 눈이 와요; comparisons (더 커요, 더 추워요) | Cloze Pick |
| S4 | Weather small talk; planning a hike with national park names (Korea National Park Service). Adds the missing S4 culture notes | Role Play |
| S5 (book 2) | Three new readers: Jeju Volcanic Island and Lava Tubes (UNESCO World Heritage 2007), a national park (Korea National Park Service), a migratory-bird wetland (a Ramsar site; National Wetlands Center of the Ministry of Environment). Plus the rain gauge (측우기) as a science tale | Story Order |
| S6 | A simplified weather forecast card (Korea Meteorological Administration style, generic), park trail sign, park map | Realia Read, new kinds `forecast`, `map` |
| S7 | Describe my favourite season; a culture note on the 24 solar terms (절기) | My Story |

### 5.6 Play & Crafts (`crafts`). It absorbs Hobbies & Sports and Colours & Shapes

| Stage | Volume 2 content | New formats |
|---|---|---|
| S2 | Traditional games (윷놀이, 제기차기, 공기, 연날리기, 딱지); the five colours (오방색) and shapes | Yut Review (review skin), Hidden Heritage (play scene) |
| S3 | Rule sentences (내 차례예요, 던져요, 이겼어요) | Sentence Builder, Cloze Pick |
| S4 | Inviting a friend to play; rock-paper-scissors (가위바위보) and who goes first | Role Play |
| S5 (book 2) | Hahoe masks and talchum (UNESCO 2022); Ganggangsullae (UNESCO 2009); ssireum (UNESCO 2018, joint inscription of both Koreas); hanji (Korea Heritage Service) | Story Order |
| S6 | Game rules card, a craft instruction card, a workshop sign-up sheet (drawn, generic) | Realia Read |
| S7 | Write the rules of my own game ("how to play ~") | My Story |

### 5.7 Across all themes

- **Culture notes on screen (row CM-3C).** A "Did you know?" tip at the reward step and on the card back. The four cells with no note get theirs first.
- **Stage 6 realia** grow from 15 scopes to about 30. Every scope gets a `kind`; the 3 scopes without one are fixed.
- **"This week in Korea" (row CM-48).** One micro-lesson a week of about 2 minutes and 5 items, keyed to the calendar. Topics are the 24 solar terms (KASI dates) and holidays: Seollal, Daeboreum, Dano, Chilseok, Chuseok, Hangeul Day, Dongji. Sources are the National Folk Museum of Korea and its Encyclopedia of Korean Seasonal Customs. The lessons are bundled and date-gated on the device, so they work offline, and their items enter review. Drops ship in quarterly content PRs of 13.

## 6. New categories: Topic Packs

### 6.1 Why packs and not a sixth column

- **Touch target.** A sixth column takes the 320 px cell from 54 dp to about 45 dp, under the 48 dp target.
- **Reach of the theme key.** `ThemeKey` appears in 47 non-test files, in the Worker's hard-coded `/themes` list, in the colour tokens and in `catalog/data.ts`.
- **Cost before it is worth showing.** A coherent column needs 7 cells, about 21 quests.

So the 5 x 7 grid stays the core route, and new categories ship as **Topic Packs** on an **Explore** shelf under the Journey grid and on Home. Pack details:
- **Colour.** A pack borrows a `homeTheme` for its colour and a small marker on that theme's column, so it needs no new tokens.
- **Progress.** A pack has its own ring, album, cards and badge.
- **Routing.** Packs never move the Journey cursor. They appear in the Today mission's "Explore" slot, in the planner and in lecture mode.
- **Promotion.** A pack that later earns a grid column already has 5 of the 7 stages. That promotion needs its own spec.

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

**Files**
- Each pack lives in `content/packs/<key>/`, with a `pack.json` and five stage files, `stage-<n>.json`.
- A stage file uses the existing lesson cell schema exactly, so these all apply unchanged: the 9 `lesson-*` rules, U-1 to U-10, the overlays and MAR.

**Ids**
- Episodes are `episode:pack-<key>-s<n>`.
- Quests are `quest:pack-<key>-s<n>-q<m>`.

**Integration**
- Packs do not count toward cell capacity, so `cellsOverCapacity` is unchanged.
- The Worker gains `GET /api/content/packs`, which is public and read-only. `/themes` is unchanged.
- Older clients do not read the new field, so they ignore packs safely.

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
| L5 Expression | S7 | 3 | 1 frame and 3 or fewer words | Write Frame, My Story | — | Pack card 2 |
| Pack Check | — | 10 items | — | review engine | — | Pack badge |

- Each level carries 1 sourced culture note or more.
- Each level recycles 30% or more of its practice and check items (`lesson-recycle`).
- A pack totals 15 quests and about 70 minutes, with about 48 core words and about 16 patterns or exchanges.

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
| 6 | **Arts & Music** 예술과 소리 (`arts-music`, rites) | 2 | 3 | 2 | 5 | 2 | 2 | 3 | Gugak instruments, pansori (UNESCO 2003; pillar C3), minhwa, hanbok (B4), talchum. Traditional material only: no lyrics, artist names or trademarks. It carries an extra MAR checklist and reuses the `k-culture` and `colors` topics |
| 7 | **Science & Inventions** 과학과 발명 (`science-inventions`, letters) | 2 | 4 | 2 | 4 | 4 | 4 | 3 | The rain gauge and the water clock (pillar E3), astronomy (E5), Hangul as a designed script (A1), Donguibogam (UNESCO Memory of the World 2009, E4). It reuses the `science` topic and 3 science stories |
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
| Numbers & Time | Sino-Korean 일 이 삼 and native 하나 둘 셋; counters 개, 명, 살 | 몇 시예요?, 얼마예요?, dates | Asking the time and a price | Clock, calendar, receipt (round practice amounts in won), a timetable | My week with times | National Institute of Korean Language (counters, number reading); Bank of Korea (banknotes and coins, and their figures: Yi Hwang, Yi I, King Sejong, Shin Saimdang) |
| People & Family | Kinship terms, both sides of the family | 이 사람은 ___예요, possessives | Introducing someone, honorific replies | A name card, a family tree card | Introduce someone I like | NIKL 「표준 언어 예절」 (kinship and address terms) |
| Feelings & Me | Feelings and describing words | 기뻐요, 왜냐하면 ~ | Asking how someone feels | A feelings chart, a message card | How I feel today, and why | NIKL Standard Korean Dictionary (word senses) |
| Town & Travel | Places, transit words, directions | ___에 가요, ___이/가 어디예요? | Asking the way, buying a ticket | Subway map (generic), bus sign, palace ticket, price tag | My trip plan | Korea Tourism Organization; Korea Heritage Service (palaces and villages); Bank of Korea (money) |
| Day & Study | Routine verbs, school and work words | Time order: 아침에, 그리고, 그 다음에 | Planning the day | A class timetable, a notice board | My daily routine | NIKL |
| Arts & Music | Instruments (가야금, 장구), arts words | Describing sound and colour | At a performance | A performance programme, a museum sign | My favourite art | National Gugak Center; UNESCO Intangible Cultural Heritage lists; National Museum of Korea |
| Science & Inventions | Tools and inventions | ___으로 ___을/를 재요 | At a science museum | Museum exhibit labels | An invention I would make | National Museum of Korea; National Hangeul Museum; Korea Astronomy and Space Science Institute; UNESCO Memory of the World |
| Body & Sports | Body parts and sports words | ___이/가 아파요, ___을/를 해요 | At the clinic desk (signs only) and at practice | A clinic sign, a sports schedule | My favourite sport | Kukkiwon (taekwondo terms); Korea Heritage Service and UNESCO (ssireum) |

**Source allowlist** for the `culture-source` lint. A note fails without one of these:
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
- National Wetlands Center
- Korea Tourism Organization
- Bank of Korea
- Kukkiwon
- UNESCO

**Risk notes**
- **Family sensitivity.** Family content never requires the learner's own family. Write-frames offer neutral options, and the cast is Hoya's family.
- **K-culture.** Excludes lyrics, artists and brands.

## 7. Achievement and variety mechanics

### 7.1 New formats

Every format is reading, listening or writing. None records or measures speech.

| # | Format | Kind | Stages | Build | Notes |
|---|---|---|---|---|---|
| F1 | **Cloze Pick** | `cloze-pick` (new) | S2-S7, also as a Check | S-M | A sentence with a gap and 3-4 tiles. It reuses the Listen & Pick shell with a text prompt |
| F2 | **Dictation** | Type Hangul `hear` mode | S2-S7, review | M | The G-3 follow-up: `mode` and `audioRef` are added to `TypeHangulRoundSchema` additively. With no voice it falls back to a `see` round and the sound notice |
| F3 | **Syllable Build** | `syllable-build` (schema present) | S1-S2 | M | Initial + vowel + final; trains 받침 |
| F4 | **Match Shape** | `match-shape` (schema present) | S1 | S | Letter-shape origins and confusable pairs (ㅂ / ㅍ, ㅓ / ㅗ) |
| F5 | **Story Order** | `story-order` (new) | S4-S5, packs | S | Reorder 4 illustrated panels with Korean captions |
| F6 | **Role Play** (read and tap) | `role-play` (new) | S4, S6, packs | L | Blueprint 06 game 9. A branching chat of 4-6 turns: the learner picks a reply bubble, the partner answers, and the story has a small outcome. Text and listening only |
| F7 | **Hidden Heritage** | `hidden-heritage` (new) | S2-S5 | L | Blueprint 06 game 10, its "signature". Find the named things in a large scene. Scenes are **original** art in theme tokens about subjects that genre paintings show; they are not copies or tracings (OD-10). One scene is 25 KB or less, lazy. Also a projector slide |
| F8 | **My Story** | `my-story` (new) | S7, packs | M | Blueprint 06 game 12. 3-5 chained write-frames with a word bank make a short text. It is kept on the device only (F-CURR-001 OD-6 rule) and never sent in telemetry |
| F9 | **Decoding Sprint** | uses `syllable-build` and Listen & Pick | S1 review | M | An optional 60-second bonus, like the vocab Speed Round. It plays only real syllables from the Stage 1 table and an allowlist the device voice is tested on. The rate is a private personal best, never compared with anyone (OD-8) |
| F10 | **Yut Review** | review skin | any | M | Right answers throw the yut sticks on a board. The randomness is play only; it never decides a reward |

**Check rotation (`lesson-check-variety`).**
- No game kind may be used for more than 40% of a stage's Checks.
- From Stage 2 on, every Check has at least 1 read-meaning or produce round.
- No two adjacent quests share the same Practice, Apply and Check triple.
- The rule warns in Phase 0 and becomes an error after the re-authoring rows (CM-3A, CM-3B).

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
- **Retroactive cards.** Cards for upper cells are awarded from `questDoneAt` (section 4.8).
- **Fairness.** Cards are never random and never purchasable.

### 7.3 Stage ceremonies for Stages 2-7

- **One prize table.** `PRIZE_STAGE = 'stage1'` becomes a per-stage table, `PRIZE_STAGES`.
- **What triggers it.** The stage latch (finishing the stage) triggers the F-MOTION-003 ceremony, a stage card and a "Stage N complete" page. The page appears in reports and in the Passport (7.5).
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
- Points come from finished activities, not accuracy:

| Activity | Points |
|---|---|
| Quest or pack quest | 3 |
| Daily Review | 2 |
| Story | 2 |
| Word set | 1 |
| Practise the ones you missed | 1 |

- Accuracy never removes points.

**Weekly goal.** 3, 5 or 7 learning days a week; the default is 3. Home shows 7 dots for the local week, and the count of "steady weeks" is the headline number.

**Streak.**
- The streak stays, counted on the local day.
- Any activity keeps it, not only a quest.
- Up to 2 rest days a local week are granted automatically.
- When a run ends, Home shows "Start a new run" and keeps the best run. It never says "lost".

**Copy.** Copy may nudge positively ("2 minutes to today's goal", "4 items are ready to refresh"). It never uses loss framing, and nothing sends a nagging notification.

### 7.5 Weekly quests and the Passport

- **Weekly quests.** Three quests a local week, picked deterministically from a 20-entry table by ISO week and a hash of the profile id. They need no storage until one is done. Examples: "Finish 2 stories", "Refresh 20 items", "Try a game you have not played", "Visit Nature twice".
- **Passport stamps.** A stamp marks each weekly quest done and each category milestone: first cell, album, mastered column, pack badge.
- **Fairness.** Stamps are deterministic and shown in advance. There are no chests with random contents. Rewards are cosmetic only: stamp art and card-back variants.

### 7.6 Shared goals for a family or a class

- **Family lantern.** A grown-up sets a weekly points target behind the PIN (section 4.9). Every learner profile on the account fills one lantern. Learner screens show only the total ("Your family: 42 of 60 this week"), never who added what. Grown-ups still see each learner in reports, as today.
- **Class goal.** The teacher sets a weekly target: stories read, items refreshed or quests done. The presenter and the learner app show a class-total bar only.
  - It extends the console's `classGoalLine` with a count.
  - The Worker totals the count from synced snapshots, in a new additive D1 table `space_goals(space_id, week, metric, target, created_at)`.
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
- no age wording
- no speaking UI
- no emoji

## 8. Lecture-mode reuse

- **Ready lessons are automatic.** Every Volume 2 episode and every pack level becomes a ready lesson, because lecture blocks build from quests.
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
| `class-review` | Up to 8 items the class has most often ready to refresh, from the per-learner memory the teacher can already see. The projector shows the items only |

- **New `game` block** with four presets, none measuring speech:

| Game | How it works |
|---|---|
| `team-relay` | 2-4 teams; the projector shows team totals only |
| `yut-race` | Each right class answer throws the sticks |
| `hidden-heritage-big` | The class finds things in a projected scene |
| `bingo` | A 4 x 4 grid of taught words to copy; extends `copy-on-paper` |

- **Not in this spec.** An exit ticket answered on learners' devices needs a live class session, which does not exist.

## 9. Content pipeline and MAR throughput

### 9.1 Remove the bottlenecks (rows CM-6, CM-50)

Today every new cell hand-edits several shared files: `catalog/data.ts`, `CATALOG_VERSION`, the route-day test pins, the presenter font subset and the e2e cell list. These touchpoints serialize content PRs and cause rebase churn. After row CM-6, each one is generated:

| Item today | After CM-6 |
|---|---|
| Catalogue | Generated from `content/` by `build-lessons.mjs` |
| `CATALOG_VERSION` | Stays an integer. The build stores a hash of the catalogue content, and fails when the content changed but the version did not. `build-lessons.mjs --bump` raises it |
| Route-day pins | Derived from the manifest, with a snapshot test |
| Presenter font subset | Derived from all taught Korean |
| e2e spec | `journey-upper-cell.spec.ts` lists cells and packs from the manifest |

- **Pack scaffolding (row CM-50).** `scripts/new-pack.mjs <key> --home <theme>` scaffolds `pack.json` and five `stage-<n>.json` skeletons with `status: 'draft'`. Their TODO strings fail lint for `ready`.
- **Target.** A level PR (3 quests plus es and ko overlays) touches only `content/` and `content/i18n/`. Six level PRs can run in parallel worktrees with no shared conflict point.

### 9.2 MAR pipeline per content PR

1. **Author.** A content-skill agent writes the cell or the level.
2. **Three parallel checkers:**
   - **Language:** Korean naturalness, particles, polite register, and romanization through the F-CNT-002 converter.
   - **Culture and facts:** every claim is matched to a `sources[]` URL from the allowlist.
   - **Learning design:** the lint rules of 9.3, item load, Check variety, and sound-change flags for the device voice (십육 is read [심뉵], 같이 [가치]).
3. **Reviser.**
4. **Third pass.** This keeps the existing `passes >= 3` rule and `reviewedBy: "MAR"`.

- es and ko overlays ship in the same PR, per the coverage ratchet.
- **Throughput target:** 12 reviewed quests a week, as 4 level PRs, with 90% or more passing MAR on the first try.
- **Audit:** each week a second MAR re-reviews a random 10% of merged levels. Findings go to the follow-ups list.
- **Status:** content ships `draft` until all passes are recorded.

### 9.3 New lint rules

New rules live in `packages/content-schema/src/lesson-lint.ts` and run in `validate-content.mjs`. They warn in Phase 0 and become errors in row CM-3B.

| Rule | What it enforces |
|---|---|
| `lesson-new-load` | At most 8 new items per quest |
| `lesson-recycle` | At least 30% of a Volume 2 or pack quest's practice and check items come from earlier quests in the same route or pack |
| `lesson-check-variety` | Section 7.1 |
| `lesson-culture-coverage` | At least 2 notes per Volume 2 cell and at least 1 per pack level |
| `culture-source` | Every note has a `sources[]` entry from the allowlist (6.6) |
| `items-stable-id` | Section 4.2 |
| `pack-skeleton` | Section 6.4 |
| `review-copy` | No `%` and no "n of m" or "n/m" patterns in learner review strings; no age words, speaking-UI words or emoji in new copy |
| `freq-coverage` (report only) | Share of taught words on the NIKL grade-A list. The list is used at build time only and never bundled; its licence is checked before it is committed (assumption 4) |
| `story-coverage` (report only) | Section 4.7 |

## 10. Bundle and offline budget

**The constraint.** Under Metro web, a lazy `require` defers evaluation, not download. F-CURR-001 assumption 2 found the per-stage modules land in the one web bundle. Growing content therefore needs real separate assets.

**Row CM-5:**
1. **Split the manifest from the bodies.** `lessons-index.ts` keeps only ids, titles, minutes, stage, theme, pack and volume, at 60 KB raw or less (372 KB today).
2. **Move bodies out of the JS bundle.** Quest bodies, the review-item index, Volume 2 and packs move to static JSON assets.
   - The PWA build emits them, Workbox precaches them, and they are fetched on demand.
   - Native builds bundle them as assets.
   - A spike first checks whether Metro async bundles work in the PWA build. If they do, they are used instead of JSON; if not, JSON. The decision is recorded in this section.
3. **Build checks.**
   - The build fails if a content chunk is pulled into the start bundle.
   - The build fails if a chunk is missing from the precache, using the same mechanism as the letter-clip gaps check in `pwa-postbuild.mjs`.
   - A new precache-size report shows the totals.
4. **Fallback.** If the learner precache passes its ceiling, packs switch to runtime caching with a "Save for offline" control (row CM-5B, conditional). The precache is measured first.

**Ceilings.** Each ceiling is a reviewed one-line change with measured numbers in its PR. These are lazy and precached, so they put no weight on start-up (OD-5).

| Budget line | Today | New ceiling |
|---|---|---|
| Start bundle | measured in CM-5 | must not grow; the manifest saves about 300 KB raw |
| `manifestRaw` | 372 KB (whole index) | 60,000 B |
| Core lessons total (Volume 1 + 2), raw / gzip | 950,000 / 140,000 | 1,400,000 / 210,000 |
| Per stage chunk, raw / gzip | 150,000 / 32,000 | 220,000 / 40,000 |
| Per pack chunk, raw / gzip | — | 90,000 / 14,000 |
| All packs, raw / gzip | — | 750,000 / 120,000 (8 packs) |
| Review-item index, raw / gzip | — | 150,000 / 30,000 |
| Stories, raw / gzip | 1,300,000 / 260,000 | 1,550,000 / 310,000 (book 2 tales and read tiers) |
| Hidden Heritage scene | — | 25,000 B each |
| Learner precache total | measured in CM-5 | measured + 2.5 MB |
| Per-quest average, raw | 9,000 | 9,000 (unchanged) |

**Sizing basis.** A quest is about 5 KB raw on the compact literal:
- Volume 2 is 75 quests, about 400 KB raw.
- The packs are 120 quests, about 650 KB raw.
- About 1.2 MB raw is added over the whole plan, about 190 KB over the wire with gzip.

**Offline.** The memory store, review engine, goals and "This week in Korea" all work offline. Remote config fails safe (12.2). Nothing in Phases 1-2 adds a network dependency, so the open iOS 14 offline issue is not made worse.

## 11. Telemetry

### 11.1 Rules

- **Payloads.** They carry ids, codes, counts and buckets only: no names, no free text, no learner input. Write Frame and My Story text is never sent. `profileId` rides in the envelope, as rule 3 of TELEMETRY-NAMES-2 says.
- **Worker first.** Every name is added to `TELEMETRY_EVENT_NAMES` and deployed to the Worker before the app sends it. The exact-list test is updated.
- **Per-item data stays on the device.** It is aggregated into one daily event.
- **Small groups are hidden.** Dashboards suppress any group with fewer than 20 profiles.

### 11.2 New names: section R of `TELEMETRY-NAMES-2.md`, added by row CM-3

| Name | Payload | Emitted by |
|---|---|---|
| `memory.daily` | `{ hist: [kind x rung x lagBucket x {right, wrong}] counts, calib: 10 bins (CM-72 only), items, newHeld, minutes }`. Lag buckets are 0-1, 2-3, 4-7, 8-14, 15-30 and 31+ days. Sent once a local day | CM-12 |
| `items.seeded` | `{ countBucket }` | CM-12 |
| `review.start` / `review.complete` | existing; kinds `daily`, `feedback`, `stage-certificate`, plus new `cell-check` and `warmup` | CM-14, CM-15, CM-21, CM-22 |
| `mastery.level_up` | `{ cellId, level }` | CM-20 |
| `testout.finished` | `{ cellId, passed, items, firstTryCorrect }` | CM-21 |
| `quest.adapt` | `{ questId, dir: 'skip' \| 'scaffold' }` | CM-24 |
| `goal.set` / `goal.met` / `week.goal_met` | `{ daily, weeklyDays }` / `{ points, target }` / `{ days, target }` | CM-17 |
| `decode.sprint.finished` | `{ rateBucket, sprintIndexBucket }` | CM-32 |
| `stamp.earned` / `weekly_quest.complete` | `{ stampId }` / `{ questKind }` | CM-60 |
| `pack.opened` / `pack.level_complete` | `{ packId }` / `{ packId, stage }` | CM-50 |
| `family.goal_met` | `{ weekTarget }`, account level, no profile breakdown | CM-61 |
| `space.goal.set` / `space.goal.met` | Worker side | CM-62 |
| `lecture.game.finished` | `{ preset, rounds, teams }` | CM-63 |
| `exp.exposure` | `{ experimentId, arm }` | CM-71 |

There is no abandon event on `main`; the quit guardrail is derived from `quest.start` with no `quest.complete` within 15 minutes. The wrong-streak guardrail adds an optional `afterWrongStreak: 0 | 1 | 2` (2 meaning two or more) to `session.end`, additively, in row CM-3.

**Rollups.** A new additive D1 table `learning_rollups(day, content_id, event, bucket, count)` has no profile column. It feeds an owner-only console metrics page that shows counts only (row CM-70).

### 11.3 Experiments

- **Arm.** `hash(profileId + experimentId) mod 100`, computed on the device. It adds no new identifier and is stable across a learner's devices.
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

| Phase | Content | Calendar (parallel lanes) |
|---|---|---|
| 0 Foundations | Copy fixes, spec amendments, remote config, telemetry names, local-day streak, manifest split, generated catalogue, lint in warn mode, design rows | weeks 1-3 |
| 1 Memory and review | Items, memory store and routes, seeding (shadow 2 weeks), review engine, Daily Review, warm-up, missed-items practice, goals, reports | weeks 2-7 |
| 2 Achievement | Mastery ring, Cell Check and test-out, Stage Checks and ceremonies, cards and albums, adaptive pacing | weeks 5-10 |
| 3 Variety | New formats F1-F10, Check rotation re-authoring, culture notes on screen | weeks 3-11 (renderers start at once) |
| 4 Depth | PR 5.8 volumes, Volume 2 in 25 cells, Stage 5 book 2, realia kinds, This week in Korea | weeks 9-18 |
| 5 Breadth | Pack framework, packs in three waves, Heritage Trails | weeks 12-28 |
| 6 Social and measurement | Weekly quests and Passport, family lantern, class goal, lecture games, rollups, experiments, FSRS shadow | weeks 8-20 |

**Critical path:** CM-5 and CM-10, then CM-11, CM-12 (and 2 weeks of shadow), CM-13, CM-14.

### 12.2 Kill switches and remote config

**How remote config works**
- `GET /api/config` is public and read-only. It carries no identifier, is cached at the edge for 1 hour, and is cached on the device.
- Each flag has two parts:
  - a build-time floor, the existing `parseKillSwitch` on `EXPO_PUBLIC_*`
  - a remote `{ on: false }` override or a `pct` of 0-100
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

### 12.3 Ramp

1. Development, then the owner's own profiles, for 2 days.
2. 10% of profiles for 7 days.
3. 50% for 7 days.
4. 100%.

- **Automatic halt.** A step is held automatically when a guardrail of section 3.3 is breached (quit rate up by more than 2 pp, or sync errors doubled). It is then switched off remotely if needed, with no redeploy.
- **Shadow first.** `memoryRecord` ships 2 weeks before `dailyReview`. During that time it only records and computes, which sets the baselines for G1 to G3 and checks the seeding's due spread.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Review flood after seeding | 14-day stagger, at most 15 seeded and 20 due a day, `memoryRecord` and `dailyReview` switches |
| Memory sync size or cost | Separate delta table; 500-item cap per call; p95 delta guardrail; the snapshot does not grow |
| Item ids shift when copy is edited | `items-stable-id` snapshot plus an alias table |
| Device voice only (no recordings; the iOS 14 offline issue is open) | Sound-change flags in MAR; Dictation and Decoding Sprint use allowlisted items and fall back to reading with the existing sound notice; no ambiguous minimal pairs in listen-only Checks until recordings A-9 and A-10 exist (owner task; it blocks nothing here) |
| Goals or streak become pressure | Light default, automatic rest days, no loss copy, no nagging, MAR anti-shame list |
| Shared goals expose a weaker learner | Totals only on learner and presenter screens |
| Heritage accuracy at volume | Source allowlist lint, MAR culture pass, weekly 10% audit, `draft` until passes |
| Hidden Heritage art cost and size | Original token scenes, 25 KB each, 1 scene before scaling to 5 |
| Confusion between packs and the route | Packs never move the Journey cursor; clear "Explore" label |
| Pressure to widen `ThemeKey` | Recorded decision: packs use `homeTheme`; promoting a pack to the grid needs its own spec |
| Author and MAR throughput (25 Volume 2 cells, 8 packs, about 195 quests) | Generated shared files (9.1), parallel level PRs, 12 quests a week target, phases sized to it |
| Overlay debt (about 150 strings per level in es and ko) | Same-PR overlays under the ratchet |
| Small user base makes A/B tests weak | Directional staged rollouts (3.4) |

## 14. Tests

**Scheduler and engine** (unit and property tests with fast-check):
- box moves follow F-VOC-005 P3
- rung promotion and the miss-at-produce rule
- interleaving caps
- determinism under a seed
- due caps and jitter
- end-early

**Merge** (Worker and client):
- commutative and idempotent for `memory_items` fields, `cellBest`, `dayLog`, `stamps`, `testedOut`, `cellCheckAt` and `stageCheckAt`
- the Worker preserve rule when keys are absent
- older-client snapshots round-trip

**Worker**:
- memory routes: ownership, a 501-item call returns 413, last-writer-wins conflict, `since` paging
- the migration SQL is additive
- `/api/config` is public, carries no identifier and has cache headers
- `/api/content/packs`
- `space_goals` totals

**Seeding fixtures**:
- five historical snapshot points plus backup restore
- no day has more than 15 seeded items due
- streak `max()`
- retroactive cards and the summary screen shown once

**Time zones**:
- the suite runs under `TZ=UTC`
- fixed-clock tests at UTC+14, UTC-12, `Asia/Seoul` and `America/Los_Angeles` across DST, for streak, rest days, due days, goals and weekly quests

**Content**:
- the lint rules of 9.3
- U-1 to U-10 extended to Volume 2 and packs
- `pack-skeleton`
- generated catalogue parity
- route-day snapshot
- presenter-font coverage

**e2e** (Playwright web):
- Daily Review from slot 3, including offline
- warm-up
- missed-items practice
- Cell Check and test-out
- Stage 2 Check and ceremony
- the retroactive summary
- goal ring and weekly dots
- each new format
- the Explore shelf and a pack level
- family lantern across 2 learner profiles with PIN-gated target setting
- lecture `team-relay` and `class-check`

**Visual and accessibility**:
- grid with mastery rings at 320 px, cells still 54 dp
- 48 dp targets on the shelf and the new games
- reduced-motion ceremonies
- contrast of theme tokens
- screen-reader labels for rings ("Mastered", "Ready to refresh")

**Budgets**: the ceilings of section 10, and the start bundle and manifest enforced in CI.

**i18n**: the en, es and ko ratchet in every PR; the `review-copy` lint.

## 15. Out of scope

- A sixth grid column or widening `ThemeKey`.
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
- Companions other than Hoya; blueprint 04 section 2.4's five companions are a later spec.

## 16. Open owner decisions (rows follow the recommended default until the owner answers)

| OD | Question | Recommended default | Alternative | Affects |
|---|---|---|---|---|
| OD-1 | Stage Checks for Stages 2-7 against F-CURR-001 section 4, which excluded stage exams and certificates | **Yes**: an optional, never-blocking "Stage Check" with a ceremony and a stage card; no certificate; amend section 4 in CM-0b | No checks; ceremony and card only | CM-22 |
| OD-2 | Where new categories live | **Topic Packs on an Explore shelf**; the grid stays 5 x 7 | A sixth grid column (cells under 48 dp at 320 px; 47-file refactor) | CM-50 onward |
| OD-3 | Pack entitlement | **Levels follow their stage** (S2+ paid once gating is on); free learners see the pack page and one Discover preview | The first quest of each pack is free (widens the free plan beyond Stage 1) | CM-50 |
| OD-4 | First wave of packs | **Numbers & Time, People & Family, Feelings & Me** | Any other order of section 6.5 | CM-51 to CM-53 |
| OD-5 | Lesson and story budget ceilings | **Raise as in section 10**; all lazy and precached; the start bundle must not grow | Keep today's ceilings (no Volume 2 or packs fit) | CM-5, CM-40, CM-46, CM-50 |
| OD-6 | Home headline number | **Weekly dots and steady weeks**, with the local-day streak kept below them and 2 automatic rest days | Keep the streak as the headline | CM-17 |
| OD-7 | Family lantern and class goal | **On**, totals only, target set by a grown-up behind the PIN | Off until asked | CM-61, CM-62 |
| OD-8 | Decoding Sprint, a 60-second optional bonus | **Yes**, optional, private personal best, like the vocab Speed Round | No timed activity outside the Speed Round | CM-32 |
| OD-9 | 차례 (ancestral memorial rite) in Holidays Volume 2 | **Teach as a reading word with a neutral, sourced note** (National Folk Museum of Korea) | Keep it out, as in Volume 1 (F-CURR-001 OD-9) | CM-45 |
| OD-10 | Hidden Heritage art | **Original token-coloured scenes** about genre-painting subjects, with source facts on the card back | Use public-domain museum images under KOGL Type 1 (larger files, licence tracking) | CM-36, CM-37 |
| OD-11 | Holdbacks | **Only for experiments E1-E4, at most 4 weeks**; otherwise staged rollouts with before and after cohorts | No holdbacks at all | CM-71 |
| OD-12 | Stage one-liner wording | **S4** "Read and answer short everyday exchanges." · **S5** "Read heritage stories and tales with Hoya." (folk stories return once the book 2 tales ship) · **S6** "Take Korean out into the world: menus, signs and short messages." · **S7** `anchorSkillEn` "Write a short personal introduction" | Other wording | CM-1 |

## 17. PR breakdown

Sizes: S under about 300 changed lines, M about 300-1,000, L above 1,000 (split if it grows past about 2,000). "W→A" means the Worker deploys first, then the app. Strings are new English UI strings, each with es and ko in the same PR. "×n" rows count as n PRs.

### Phase 0: foundations

| PR | Title (conventional commit) | Size | Depends on | Strings (en + es + ko) | Tests |
|---|---|---|---|---|---|
| CM-0 | `docs(specs): F-CURR-002 category expansion and mastery` (this spec, README index line) | S | — | 0 | — |
| CM-0b | `docs(specs): amend F-RVW-001 (age wording, engine on F-CURR-002), F-CURR-001 section 4 (Stage Checks), TELEMETRY-NAMES-2 section R` | S | CM-0 | 0 | — |
| CM-1 | `fix(mobile,i18n): stage one-liners and Stage 7 anchor skill follow the standing rules (F-CURR-002 OD-12)` | S | — | 4 changed | stages copy test; `review-copy` patterns |
| CM-2 | `feat(backend,mobile): public remote config with off-only overrides and percentage ramps (F-CURR-002)` (W→A) | M | — | 0 | Worker route, cache headers, client fallback order, pct bucketing |
| CM-3 | `feat(content-schema,backend): telemetry names section R (F-CURR-002)` (Worker first) | S | CM-0b | 0 | exact-list test |
| CM-4 | `fix(mobile): streak on the local day with a no-drop switch-over (F-CURR-002)` | S | — | 0 | TZ fixed-clock tests, `max()` switch-over |
| CM-5 | `perf(content): lesson manifest split, bodies as precached assets, budget lines, precache report (F-CURR-002)` | L | — | 0 | start-bundle and manifest budgets, precache gaps, lazy-load test, offline e2e |
| CM-5B | `feat(mobile): Save for offline for packs` (only if the precache ceiling is crossed) | M | CM-5 report | 4 | offline e2e |
| CM-6 | `build(content): generated catalogue, CATALOG_VERSION guard, derived route-day pins, presenter font and e2e cell list (F-CURR-002)` | L | CM-5 | 0 | catalogue parity, route-day snapshot, font coverage |
| CM-7 | `feat(content-schema): lint rules in warn mode and coverage reports (F-CURR-002)` | M | — | 0 | rule unit tests with fixtures |
| CM-D1 | `design(reviews): Daily Review, mastery ring, Cell and Stage Check, ceremony, goal ring and weekly dots (F-CURR-002)` | M | CM-0 | 0 | MAR design review |
| CM-D2 | `design(minigame): Cloze Pick, Dictation, Syllable Build, Match Shape, Story Order, Role Play, My Story, Yut Review (F-CURR-002)` | M | CM-0 | 0 | MAR design review |
| CM-D3 | `design(journey): Hidden Heritage scene style, Explore shelf, pack page, Passport (F-CURR-002)` | M | CM-0 | 0 | MAR design review |

### Phase 1: memory and review

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-10 | `feat(content-schema,content): review items, extraction in build-lessons, frozen ids (F-CURR-002)` | L | CM-5 | 0 | `items-stable-id` snapshot, extraction coverage (every Discover item maps to an item) |
| CM-11 | `feat(backend): memory_items table and delta routes, backup and Rescue Code include memory (F-CURR-002)` (W first) | M | CM-10 | 0 | ownership, 413 cap, LWW and max merge, `since` paging, additive SQL |
| CM-12 | `feat(mobile): memory store, recording from quest rounds, seeding, shadow mode (F-CURR-002)` | L | CM-2, CM-3, CM-11 | 0 | seeding fixtures (5 points), stagger cap, profile partition and flush on switch, `memory.daily` payload |
| CM-13 | `feat(mobile): review engine: selection, interleaving, rungs, caps (F-CURR-002)` | L | CM-12 | 0 | property tests, determinism |
| CM-14 | `feat(mobile): Daily Review screen and mission slot 3 (F-CURR-002)` | M | CM-13, CM-D1 | about 14 | e2e incl. offline, stars-only result, end-early |
| CM-15 | `feat(mobile): quest warm-up and practise the ones you missed (F-CURR-002)` | M | CM-13 | about 6 | U-5 unchanged, e2e |
| CM-16 | `feat(web,mobile): reports show words known, ready to refresh and mastery (F-CURR-002)` | M | CM-12, CM-20 | about 10 | report builder tests, console e2e |
| CM-17 | `feat(mobile,backend): daily and weekly goals, rest days, points (F-CURR-002)` (W→A for new fields) | L | CM-4, CM-3, CM-D1 | about 16 | points accrual, rest days, TZ tests, merge |

### Phase 2: achievement

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-20 | `feat(mobile): mastery levels, cellBest latch, grid ring, words known milestones (F-CURR-002)` | M | CM-12, CM-D1 | about 8 | derivation, latch never drops, 320 px visual, a11y labels |
| CM-21 | `feat(mobile): Cell Check and test-out (F-CURR-002)` | L | CM-13, CM-20 | about 10 | seeding at box 2, entitlement, `routeNext` skip, e2e |
| CM-22 | `feat(mobile): Stage Checks for Stages 2-7, PRIZE_STAGES, ceremony, retroactive summary (F-CURR-002)` | L | CM-21, OD-1 | about 12 | prize table, retroactive once, never blocks, e2e |
| CM-23 ×3 | `feat(cards): upper-cell cards and category albums, Stages 2-3 / 4 / 6-7 (F-CARD-S2..S7, F-CURR-002)` | L each | CM-22 | about 60 each (card names and backs) | card-award tests, album legendary, art budget |
| CM-24 | `feat(mobile): adaptive pacing in quests (F-CURR-002)` | M | CM-12 | about 2 | skip and scaffold rules, standard-path U-5 |
| CM-25 | `feat(mobile): Stage Jump Ahead; amend F-PLC-001 ceiling (F-CURR-002)` | M | CM-21 | about 6 | placement fixtures |

### Phase 3: variety

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-30 | `feat(mobile): Cloze Pick game and lecture mapping (F-CURR-002)` | M | CM-D2 | about 4 | renderer, reducer, Playwright |
| CM-31 | `feat(mobile,content-schema): Type Hangul hear mode (Dictation) (F-CURR-002)` | M | CM-D2 | about 3 | additive schema, fallback to `see`, Playwright |
| CM-32 | `feat(mobile): Syllable Build game and Decoding Sprint (F-CURR-002 OD-8)` | M | CM-D2, CM-3 | about 6 | allowlist test, private best, Playwright |
| CM-33 | `feat(mobile,content): Match Shape game and Stage 1 letter-shape origins (F-CURR-002)` | M | CM-D2 | about 4 | sources, Playwright |
| CM-34 | `feat(mobile): Story Order game (F-CURR-002)` | S | CM-D2 | about 3 | Playwright |
| CM-35 | `feat(mobile): Role Play read-and-tap game (F-CURR-002)` | L | CM-D2 | about 5 | branch reducer, no speaking UI, Playwright |
| CM-36 | `feat(mobile): Hidden Heritage engine, first scene (Food) and slide kind (F-CURR-002 OD-10)` | L | CM-D3 | about 5 | hit areas a11y, 25 KB budget, Playwright |
| CM-37 ×4 | `feat(content): Hidden Heritage scenes for Letters, Holidays, Nature, Play (F-CURR-002)` | M each | CM-36 | about 10 each | scene budget, MAR culture pass |
| CM-38 | `feat(mobile): My Story game (F-CURR-002)` | M | CM-D2 | about 5 | device-only data rule (P-1 extended), Playwright |
| CM-39 | `feat(mobile): Yut Review skin (F-CURR-002)` | M | CM-14, CM-D2 | about 4 | randomness never decides reward, Playwright |
| CM-3A ×5 | `content(stage<n>): Check rotation re-authoring for S2, S3, S4 (with de-duplication), S6, S7 (F-CURR-002)` | M each | CM-30, CM-31, CM-34, CM-35 | overlays only | U-1..U-10, `lesson-check-variety` |
| CM-3B | `chore(content-schema): lint rules from warn to error (F-CURR-002)` | S | CM-3A | 0 | rule tests |
| CM-3C | `feat(mobile,content): culture notes on screen, notes for the four empty cells (F-CURR-002)` | M | CM-7 | about 3 + notes overlays | `culture-source`, e2e |

### Phase 4: depth (Volume 2)

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-40 | `feat(mobile,content-schema): two volumes per cell, Vol 1 and Vol 2 on the cell sheet (F-STORY-005 PR 5.8, F-CURR-002)` | M | CM-5, CM-6 | about 3 | capacity, `episodesFor` order, e2e |
| CM-41 ×5 | `content(stage<n>): Nature Volume 2, S2 / S3 / S4 / S6 / S7 (F-CURR-002)` | M each | CM-40, CM-3B | overlays | U-rules, recycle, sources, MAR |
| CM-42 ×5 | `content(stage<n>): Play Volume 2 (F-CURR-002)` | M each | CM-40, CM-3B | overlays | same |
| CM-43 ×5 | `content(stage<n>): Food Volume 2 (F-CURR-002)` | M each | CM-40, CM-3B | overlays | same |
| CM-44 ×5 | `content(stage<n>): Letters Volume 2 (F-CURR-002)` | M each | CM-40, CM-3B | overlays | same |
| CM-45 ×5 | `content(stage<n>): Holidays Volume 2 (F-CURR-002 OD-9)` | M each | CM-40, CM-3B | overlays | same |
| CM-46a | `content(stories): read tiers for the 10 listen-only stories (F-CURR-002)` | M | — | overlays | story checks, budget |
| CM-46 ×5 | `content(stage5): book 2 for Nature, Food, Holidays (folk tales), Play, Letters (F-CURR-002)` | M each | CM-40, CM-46a | overlays | story pipeline, coverage report, MAR |
| CM-47 | `feat(mobile,content-schema): realia kinds recipe, receipt, label, forecast, calendar, timetable, map, poster (F-CURR-002)` | M | — | about 8 | renderer per kind, art budget |
| CM-48 | `feat(mobile,content): This week in Korea, engine and first 13 drops (F-CURR-002)` | M | CM-12 | about 4 + overlays | date gating offline, TZ tests |

### Phase 5: breadth (Topic Packs)

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-50 | `feat(content-schema,mobile,backend): Topic Pack framework, new-pack scaffold, Explore shelf, pack page (F-CURR-002 OD-2, OD-3)` | L | CM-6, CM-20, CM-D3 | about 14 | schema, `pack-skeleton`, entitlement, `/api/content/packs`, e2e |
| CM-51 ×6 | `content(packs): Numbers & Time, levels 1-5 and Pack Check (F-CURR-002)` | M each | CM-50, CM-31 | overlays | U-rules, sources, MAR |
| CM-52 ×6 | `content(packs): People & Family (F-CURR-002)` | M each | CM-50 | overlays | same |
| CM-53 ×6 | `content(packs): Feelings & Me (F-CURR-002)` | M each | CM-50 | overlays | same |
| CM-54 ×6 | `content(packs): Town & Travel (F-CURR-002)` | M each | CM-50, CM-47, CM-51 | overlays | same |
| CM-55 ×6 | `content(packs): Day & Study (F-CURR-002)` | M each | CM-50 | overlays | same |
| CM-56 ×6 | `content(packs): Arts & Music, extra MAR checklist (F-CURR-002)` | M each | CM-50, CM-36 | overlays | same |
| CM-57 ×6 | `content(packs): Science & Inventions (F-CURR-002)` | M each | CM-50 | overlays | same |
| CM-58 ×6 | `content(packs): Body & Sports (F-CURR-002)` | M each | CM-50 | overlays | same |
| CM-59 | `feat(mobile): Heritage Trails library view by pillar (F-CURR-002)` | M | — | about 6 | grouping, e2e |

### Phase 6: social, lecture and measurement

| PR | Title | Size | Depends on | Strings | Tests |
|---|---|---|---|---|---|
| CM-60 | `feat(mobile): weekly quests and Passport stamps (F-CURR-002)` | M | CM-17 | about 30 | deterministic pick, latch merge |
| CM-61 | `feat(mobile,web): family lantern, totals only, target behind the PIN (F-CURR-002 OD-7)` | M | CM-17, owner request A account switching | about 8 | totals only, PIN gate, e2e with 2 profiles |
| CM-62 | `feat(backend,web,mobile): class goal, space_goals, console setter, presenter bar (F-CURR-002 OD-7)` (W→A) | L | CM-3, CM-17 | about 12 | Worker totals, additive SQL, e2e |
| CM-63 | `feat(lecture): game block and presets by-topic, class-check, class-review (F-CURR-002)` | L | CM-36, CM-39, CM-21 | about 18 | no names on projector, slide mapping, e2e |
| CM-70 | `feat(backend,web): learning rollups and owner-only metrics page (F-CURR-002)` (W first) | M | CM-3 | about 10 | small-group suppression, no profile column |
| CM-71 | `feat(mobile): experiment exposure and E1-E4 (F-CURR-002 OD-11)` | S | CM-2, CM-70 | 0 | bucket stability |
| CM-72 | `feat(mobile): FSRS-lite shadow predictions and calibration bins (F-CURR-002)` | M | CM-12 | 0 | property tests, no scheduling effect |

**Row count:**

| Group | PRs |
|---|---|
| Phase 0 | 12 (plus the conditional CM-5B) |
| Phase 1 | 8 |
| Phase 2 | 8 (CM-23 counts as 3) |
| Phase 3 | 20 (CM-37 ×4, CM-3A ×5) |
| Phase 4 | 34 (5 themes ×5, book 2 ×5, plus CM-40, CM-46a, CM-47, CM-48) |
| Phase 5 | 50 (8 packs ×6, plus CM-50, CM-59) |
| Phase 6 | 7 |
| **Total** | **139** |

CM-5B is conditional and is counted only if the CM-5 report triggers it. Each content row's PR description lists the MAR pass findings with outcomes, the `--report` bytes for the chunk, test counts and one 320 px screenshot.

**End state:**

| | Now | End state |
|---|---|---|
| Quests | 107 | about 107 + 75 (Volume 2) + 120 (packs) + about 5 (Stage 1 additions) = about 307 |
| Hours of guided content | about 8.2 | about 23 |
| Distinct taught items | about 930 | about 2,300 |
| Items in spaced review | 144 | all |
| Stages with a ceremony and card | 1 | 7 |
| Listen & Pick share of Checks | about 90% | 40% or less |
| Grid | 5 x 7 | 5 x 7, unchanged, plus an Explore shelf of 8 packs |

## 18. Dependencies

- **Shipped:** F-CURR-001, F-QUEST-002, F-VOC-005, F-STORY-005 (volumes, specified), F-STORY-006, F-ENT-003, F-PLAN-002, F-SYNC-001/002, F-RESTORE-001, F-AUTH-003, F-AUDIO-004, F-I18N-001, F-TCH-004 and lecture mode v2, F-REPORT-001, F-MOTION-003.
- **Amended here** (row CM-0b or the named row):
  - F-RVW-001: the age wording goes, and the engine becomes this spec's.
  - F-CURR-001 section 4: Stage Checks (OD-1).
  - F-PLC-001: the ceiling (CM-25).
  - TELEMETRY-NAMES-2: section R.
- **Unblocked here:** F-CARD-S2..S7-001 (CM-23) and F-STORY-005 PR 5.8 (CM-40).
- **From owner request A:** per-profile partitioning and the grown-up PIN (section 4.9), needed by CM-12 (flush on switch) and CM-61.
- **Tokens:** no new design token is expected. Rings, glows, packs and scenes use the existing `theme.*` and feedback tokens. A new token goes through `design/tokens/` and the drift check in its row.

## 19. Unverified assumptions

1. **Per-quest size.** About 5 KB raw per quest on the compact literal is measured on Volume 1 cells. The first Volume 2 cell records its real number here.
2. **Assets instead of async bundles on web.** Whether Metro async bundles work in the PWA build is not known. CM-5 decides with a spike, and JSON assets are the safe default.
3. **Memory delta size.** About 60-80 B per changed item state after JSON. CM-12's shadow period measures the p95 delta per day.
4. **NIKL word list licence.** The 2003 list is publicly distributed. It is used at build time only, and its terms are checked before it enters the repo. If they forbid that, `freq-coverage` runs from a local file outside the repo.
5. **Device voice on pseudo-words.** The Decoding Sprint uses real syllables only, because device voices read some non-words unpredictably. CM-32 tests the allowlist on iOS, Android and desktop voices.
6. **Weekly actives.** If there are fewer than about 400 per arm, A/B tests become directional staged rollouts (3.4).

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
- the separate memory delta table instead of a growing snapshot
- the `cellBest` latch so mastery never drops
- the quest warm-up
- adaptive pacing
- the Decoding Sprint
- the per-stage default Checks
- story coverage and "fits you"
- shadow mode before any review UI
- the calibration-based FSRS shadow

**Grafted from P2:**
- points-based goals that accuracy never reduces
- weekly dots and rest days
- the streak `max()` switch-over
- "practise the ones you missed"
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
| P2's 47-file `THEME_REGISTRY` refactor | Packs avoid it |
| P2's exit ticket on learner devices | Needs a live session |
| P2's Quick and Boss quest variants | The Cell Check covers the Boss role with less surface |
| P3's 8-10 minute Stage Check | Shortened to 6-8 |
| A separate Shopping & Money pack | Merged into Town & Travel |

---

_Created 2026-10-21 (owner request B of 2026-10-21), synthesized from three independent planning proposals on `main` at `a384759ca`._
