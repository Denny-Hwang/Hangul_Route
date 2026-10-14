Status: ready

# F-VOC-005 — Word progress: a per-word store, Leitner boxes, a monotonic sync merge, the Daily Test hook and the caregiver summary

**Scope**: `packages/content-schema` (`schemas/vocab-progress.ts`, `ProgressSnapshot.vocab`, `ProgressSummary.vocab`, telemetry name) · `packages/backend` (`routes/sync.ts` preserve rule, tests) · `apps/mobile` (`logic/vocab/`, `logic/sync/merge.ts`, `logic/sync/summarize.ts`, `store/progress-store.ts`, `logic/homework/mission-builder.ts`, parent dashboard) · `apps/web` (console roster line and roll-up) · `apps/api` (**no migration**: the snapshot is a JSON text column)
**Owner**: solo dev
**Rollout**: **server first** (§3.3): PR P-1 ships and deploys before any client PR that writes the new field; the client PRs follow behind `flags.vocabTopicsEnabled`. PR order in §6.
**Wireframes**: `wireframes/vocab-topics.md` section B (collection meter) and a Home card note in `wireframes/vocab-flashcards.md` section G; the caregiver rows are a copy change on existing screens (no new wireframe)

Parent / siblings: F-VOC-001 (ids, `senseGroup`) · F-VOC-003 (writes `introduced`, `self`, quick-check answers) · F-VOC-004 (writes speed answers, sessions) · F-SYNC-001 §3.3 (deterministic snapshot merge; "every collection only grows"), §3.4 (the summary is the only caregiver column), §3.5 (sync engine) · F-SYNC-002 (client) · F-RVW-001 §3.2 (Pools A/B/C/D, anti-staleness), §3.7 (anti-shame) · F-HW-001 §3.1 (Today's mission) · F-PAR-001 (parent dashboard) · F-TCH-001 §3.2 (no ranking, no per-student percentiles in the class roll-up) · F-CONSOLE-001 · blueprint 09 §2.3 (the simplified spaced-repetition algorithm), 02 N8 ("a word not reviewed for 3 days" nudge) · design input `topic-speed-quiz.md` §1, §5

---

## Decisions

Binding owner decisions this spec implements: **D3** (meters only fill; encouraging messages; a missed day is never mentioned) · **D1** (nothing in the schedule depends on age) · **D4** (ids come from the validated vocabulary JSON) · **D8** (spec id).

| # | Decision | Why |
|---|---|---|
| P1 | **Word progress is a new optional `vocab` slice of `ProgressSnapshot`**, not a separate store or table. It travels with the snapshot, is written by the same `progress-store` persistence path (`progress:${profileId}`), merges in `mergeSnapshots`, backs up in `BackupFile` and restores with a Rescue Code, with no new route. | Everything else the learner earns already syncs this way (`schemas/progress.ts:77-88`); a second channel would need its own auth, conflict and restore story. |
| P2 | **Every learner-visible fact is monotonic.** Collected (`first`), `seen`, `right`, `bestBox`, topic `bestStars`, `sessions`, `bestCaught` only grow and merge by **max** (or **min** for the first day). The *schedule* (`box`, `due`) is the one thing that can go down and is merged **last-writer-wins by a timestamp**, deterministically. Learner screens read only monotonic fields; the schedule is read only by the scheduler. | The merge contract "no clock skew can lose a card or a star" (`logic/sync/merge.ts:12-16`) must hold; a Leitner box that falls on a miss is not monotonic, so it is kept out of everything the learner sees (D3: never lose earned items). |
| P3 | **Simple Leitner, six boxes, no speed factor.** Box 0 is "not met"; a collected word starts in box 1 and moves up one box on a first-try right answer (not hinted); a wrong answer moves it down one box (not below 1) and makes it due tomorrow; intervals are 1, 3, 7, 14, 30 days for boxes 1-5. **Response time is not used** (the design input proposed fast/slow thresholds). The one exception is the Relaxed idle hint of F-VOC-004 §3.6 (12 s / 20 s): a right answer given *with* the ring showing is not promoted, but is never demoted either, and the hint is off with a screen reader. | A learner who needs more time (a screen reader, motor or reading needs, any age) must not be scheduled worse; speed is also not monotonic and not stored. |
| P4 | **Self-marking is a weak signal**: "Got it" on a flashcard seeds box 2 at most and never raises `bestBox` above 2; "Show me again" sets box 1 and due tomorrow. | F-VOC-003 T3; only a right answer in a question earns higher boxes. |
| P5 | **Days are the device's local calendar day** (`YYYY-MM-DD`), not UTC. | "Due tomorrow" must mean tomorrow for the learner; the existing streak and `dayKey` helpers use the UTC prefix of an ISO string (`store/progress-store.ts:12`, `logic/streak.ts`), which would make a word due at 4 pm local time on the US west coast. The slice stores plain day strings so nothing converts on sync. |
| P6 | **Server first**: the `vocab` field is added to the shared schemas and the Worker is deployed **before** any client build can write it, because `z.object` strips unknown keys (`SnapshotPutSchema.safeParse`, `packages/backend/src/routes/sync.ts:49`), so an old Worker would silently drop the slice. The Worker also **preserves** an existing `vocab` when a later snapshot arrives without one (an old app build re-uploading). | Same rule as telemetry names (`TELEMETRY-NAMES.md` rule 1), applied to the one field that carries learner data. |
| P7 | **The Daily Test and the Speed Round share one scheduler.** Vocabulary answers from F-RVW-001's Daily Test call the same `recordVocab` with `source: 'review'`; the review engine reads the pools through `vocabPools()` (§3.6) and never keeps its own per-word state. | One box per word; no drift between two schedules. |
| P8 | **Caregivers see counts, a first-try rate and up to three words to revisit**, never per-question history; a learner sees none of those numbers. **No average response time** is stored or shown. | F-RVW-001 §1 two channels; P3. |
| P9 | **No percent, ratio or rank appears on a learner screen or in a teacher class roll-up order** (F-TCH-001 §3.2); the revisit list is the class signal. | D3; F-TCH-001. |

---

## 1. Context

**What exists** (verified at `main` HEAD `ecf6365`, after PRs #102-#105; the sync and Worker claims were re-read in `packages/backend/src/routes/sync.ts`, `db/d1.ts`, `apps/api/migrations/0002_schema_v2.sql`, `apps/mobile/src/logic/sync/{merge,engine}.ts` and `platform/sync-api.ts` by the review of 2026-10-10):

- **The snapshot** is `ProgressSnapshotSchema` with `episodes`, `quests`, `cards`, `sessions`, `homework`, `reviews`, `streakDays` (`packages/content-schema/src/schemas/progress.ts:77-88`). `ReviewEntry` carries `itemIds: string[]` and a free `scope: string` (`:65-73`), so `vocab:*` ids already fit there. There is **no per-item history** anywhere: only quest stars and accuracy.
- **Merge**: `mergeSnapshots` builds the result from explicit fields (`apps/mobile/src/logic/sync/merge.ts:80-98`) with `unionBy` per collection (`:29-38`), "collections only grow" (`:12-16`); `isSubsetOf` decides whether an upload is needed from quests, cards and sessions only (`:101-111`). **A field not listed in `mergeSnapshots` is dropped on the first conflict merge** — which is also what an older app build does to `vocab`.
- **Conflict flow**: the engine uploads, and on a 409 folds the server copy in with `mergeSnapshots` and retries once (`logic/sync/engine.ts:34-53`); the server's stored payload is returned as is (`packages/backend/src/routes/sync.ts:56-64`) and the client casts it (`platform/sync-api.ts:138-141`, no schema parse).
- **The Worker** parses `SnapshotPutSchema` (`schemas/sync.ts:49-55`) and stores `payload: body.snapshot` and `summary: body.summary` (`routes/sync.ts:49-79`); both are `TEXT` columns, `payload_json TEXT NOT NULL` of the `snapshots` table (`apps/api/migrations/0002_schema_v2.sql:32-41`; `0001_schema_v1.sql:30` is the older `progress` table the sync route does not use), written and read as opaque `JSON.stringify` / `JSON.parse` (`packages/backend/src/db/d1.ts:31,159-173`; `SnapshotRecord.payload` is typed `unknown`, `store.ts:85-94`), so an additive JSON field needs **no migration**. `schemaVer` is stored but never branched on (`routes/sync.ts:73`); the client sends `SCHEMA_VERSION = 1` (`platform/sync-api.ts:10`).
- **The summary** is the only thing caregivers and teachers read (`schemas/sync.ts:14-45`, `logic/sync/summarize.ts:44-84`); it has `needsPractice` for jamo and `planProgress`; the web console rolls it up without ranking (`apps/web/src/lib/console/rollup.ts:23-39`) and prints `Revisit:` per student (`apps/web/src/app/teach/space/page.tsx:161`). The parent dashboard reads the snapshot directly (`apps/mobile/src/screens/parent/ParentDashboardScreen.tsx:25,44-49`).
- **Persistence**: `progress-store` writes `progress:${profileId}` only after the saved copy has been read (`store/progress-store.ts:121-135`), merges writes made earlier (`:151-174`), and notifies sync after each save (`:91-94`); `hydrateLearnerData()` loads every profile before the navigator (`store/bootstrap.ts:10-15`).
- **Home**: Today's mission is exactly three fixed slots (`logic/homework/mission-builder.ts:1-13`); the card kinds are `replay | new | daily-test | story` (`:17`); slot ③ is the daily-test gateway and falls back to slot ①'s chain while F-RVW-001 has not shipped (`:152-175`, capabilities `:41-44`); `HomeScreen` shows the streak (F-I18N-001 cites `HomeScreen.tsx:188`).
- **F-RVW-001 is `draft` and its engine does not exist** (`apps/mobile/src/logic/reviews/` is absent); its Pools are specified in §3.2 of that spec and `09-homework-review-profiles-addendum.md` §2.3.

**What this spec does.** (1) The `vocab` slice: schema, event model and a pure reducer. (2) The Leitner schedule. (3) The monotonic **merge**, the **server-first** schema change and the Worker's preserve rule. (4) The pools the Daily Test and the Speed Round read. (5) The Home nudge. (6) The caregiver and teacher summary. (7) Telemetry and tests, including a 30-day simulation.

Terms. **Collected**: a word with a state (it has been introduced). **Strong**: `bestBox >= 3`. **Due**: `due <= today`. **Event**: one thing that happened (§3.2). **Slice**: `ProgressSnapshot.vocab`.

## 2. User story

> As someone learning words, I want the app to remember which words I have met and to bring the right ones back at the right time — a day later, then a few days, then a week — so that they stick, without ever taking a word away from me or telling me I forgot.

Companion stories:

- As a **learner on two devices** (a phone and a tablet), I want my words to merge, never overwrite, so nothing I collected is lost.
- As a **parent**, I want to see how many words my child has collected, how many are solid, and which two or three to look at together.
- As a **teacher**, I want the class roll-up to name the words that need another look, without ranking my students.
- As a **developer**, I want the schedule, the merge and the pools as pure functions with properties I can test, and the server change to be unmissable in the PR order.

## 3. Acceptance criteria

### 3.1 Data (`packages/content-schema/src/schemas/vocab-progress.ts`, exported from `src/index.ts`, 100 % covered)

```ts
const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDay); // local calendar day (P5) that exists (no 2026-13-45)
const AtSchema = z.string().max(40).regex(ISO_DATE_TIME).refine(parses);   // UTC or offset; bounded, so no string outsorts every real time
const BoxSchema = z.number().int().min(0).max(5);

export const VocabItemStateSchema = z.object({
  id: VocabIdSchema,                      // F-VOC-001 §3.1
  first: DaySchema,                       // the day the word was first collected          — merge: min
  seen: z.number().int().nonnegative(),   // answers recorded (first answers only)         — merge: max
  right: z.number().int().nonnegative(),  // right first-try answers, not hinted           — merge: max
  bestBox: BoxSchema,                     // highest box ever reached; never drops         — merge: max
  last: DaySchema,                        // last day the word was practised               — merge: max
  // the schedule (the only part that can go down) — merge: last writer wins on `at`
  box: BoxSchema,
  due: DaySchema.nullable(),              // null = not scheduled
  at: AtSchema,                           // ISO timestamp of the last schedule change
}).refine((s) => s.right <= s.seen && s.bestBox >= s.box, 'right <= seen and bestBox >= box');

export const VocabTopicProgressSchema = z.object({
  topic: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),                       // VocabTopicKey
  bestStars: z.number().int().min(0).max(3),                                   // 0 = no round yet           — max
  sessions: z.number().int().nonnegative(),                                    // cards + speed + match      — max
  last: DaySchema,                                                             //                            — max
  bestCaught: z.number().int().nonnegative(),                                  // Challenge personal best    — max (private, S9)
});

export const VocabProgressSchema = z.object({
  v: z.literal(1),
  items: z.array(VocabItemStateSchema).max(1000),
  topics: z.array(VocabTopicProgressSchema).max(100),
}).superRefine(noDuplicateIdsOrTopics);  // one state per word, one row per topic
export type VocabProgress = z.infer<typeof VocabProgressSchema>;
```

- `ProgressSnapshotSchema` gains **`vocab: VocabProgressSchema.optional()`** (not `.default`: an optional field leaves the inferred type optional, so `blankSnapshot` (`store/progress-store.ts:77-89`) and every test fixture still compile and old snapshots, backups and server rows parse unchanged; consumers read it through `vocabOf(snapshot)`, §3.2).
- `ProgressSummarySchema` gains **`vocab: VocabSummarySchema.optional()`** (§3.8). `schemaVersion` stays `z.literal(1)` (an additive optional field is not a version change); the client keeps sending `SCHEMA_VERSION = 1` (`platform/sync-api.ts:10`).
- **Size**: about 120 bytes of JSON per word: 144 words about 17 KB, the v1.1 288 words about 35 KB, the schema's 1,000-item cap about 120 KB — small next to the D1 row / bound-value limit (documented as 2 MB at the time of writing; to be re-checked against the Cloudflare docs before P-1 ships) and the Worker request limit. The slice rides every snapshot upload (about 17 KB extra at launch); if uploads become a cost concern, a delta format is a later change under `v: 2`.
- **Why `seen` and `right` are max-merged, not summed**: two devices that both recorded the same early answers would double count; max can undercount genuine parallel work, which only affects the caregiver rate (P8) and is accepted.

### 3.2 Events and the pure reducer (`apps/mobile/src/logic/vocab/progress.ts`, 100 % covered)

```ts
export type VocabEvent =
  | { type: 'introduced'; id: string }
  | { type: 'self'; id: string; known: boolean }
  | { type: 'answer'; id: string; correct: boolean; hinted?: boolean; format?: string; source: 'cards' | 'speed' | 'match' | 'review'; ms?: number }
  | { type: 'session'; topicKey: string; kind: 'cards' | 'speed' | 'match'; stars?: 1 | 2 | 3; caught?: number; mode?: 'relaxed' | 'challenge'; endedBy?: 'questions' | 'clock' };   // `endedBy` is accepted and ignored (F-VOC-004 §3.6 sends it; telemetry reads it)

export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;              // days until due, by box (box 0 unused for a collected word)
export function localDay(now: Date): string;                         // 'YYYY-MM-DD' in the device's local time (P5)
export function addDays(day: string, n: number): string;
export function vocabOf(snapshot: { vocab?: VocabProgress }): VocabProgress;   // empty slice when absent
export function applyVocabEvents(v: VocabProgress, events: readonly VocabEvent[], now: Date): VocabProgress;
```

**Reducer rules** (each event is applied in order; `today = localDay(now)`; `at = now.toISOString()`; an event whose `id` fails `VocabIdSchema` or whose `topicKey` is malformed is **ignored**, never thrown):

| Event | Effect |
|---|---|
| `introduced` | if the id has no state: create `{ first: today, seen: 0, right: 0, bestBox: 1, last: today, box: 1, due: addDays(today, 1), at }`; otherwise nothing (idempotent) |
| `self`, `known: true` | ensure the state exists (as `introduced`); if `box < 2`: `box = 2`, `due = addDays(today, BOX_DAYS[2])`, `at`; `bestBox = max(bestBox, 2)`; never raises `bestBox` above 2 and never lowers a higher box |
| `self`, `known: false` | ensure the state; `box = 1`, `due = addDays(today, 1)`, `at`; `bestBox` unchanged |
| `answer`, `correct` and not `hinted` | ensure the state; `seen + 1`, `right + 1`, `last = today`; `box = min(5, box + 1)`, `bestBox = max(bestBox, box)`, `due = addDays(today, BOX_DAYS[box])`, `at` |
| `answer`, `correct` and `hinted` | ensure the state; `seen + 1`, `last = today`; box unchanged; `due = addDays(today, BOX_DAYS[box])`, `at` (a right answer with help is not promoted) |
| `answer`, not `correct` | ensure the state; `seen + 1`, `last = today`; `box = max(1, box - 1)`, `due = addDays(today, 1)`, `at` |
| `session` | upsert the topic: `sessions + 1`, `last = today`; `bestStars = max(bestStars, stars ?? 0)`; `bestCaught = max(bestCaught, caught ?? 0)` **only when `mode === 'challenge'`** |

`ms` and `format` are **accepted and ignored by the reducer** (P3); they exist for telemetry and for a future analysis. Output arrays are **sorted by id / topic** so the result is deterministic and merge-friendly.

**The one store action** (`store/progress-store.ts`, added to `Actions` `:50-75`): `recordVocab(profileId: string, events: readonly VocabEvent[], now?: Date): void` — reads `get().byProfile[profileId] ?? blankSnapshot(profileId)`, sets `vocab: applyVocabEvents(vocabOf(snap), events, now)` and `updatedAt`, `set(...)`, `persist(profileId, updated)` (which already defers writes until the saved copy is loaded, `:127-135`, and notifies sync, `:91-94`). Writes made **before hydration** are normally impossible (`hydrateLearnerData()` runs before the navigator, `store/bootstrap.ts:10-15`), but a profile created later could hit the race. They must **not** be merged as a slice built from a blank one: a state created from `introduced` carries a fresh `at`, so `mergeVocab`'s last-writer-wins would let it overwrite the saved schedule of a word that was already in box 3. So while a profile is not hydrated the store keeps the events in a small in-memory queue (`pendingVocabEvents[profileId]`) and `hydrate` replays them with `applyVocabEvents` onto the loaded slice (the same replay idea as homework, `replayUnsaved` `:107-110`), then clears the queue; `mergeSnapshots` (`:159-164`) still merges `vocab` of two full snapshots (§3.3).

### 3.3 Merge (`apps/mobile/src/logic/sync/merge.ts`) and the server-first change

**`mergeVocab(local, server)`** (pure; added beside `mergeQuest` etc.):

- if both are undefined, the result is undefined (`mergeSnapshots` omits `vocab`); if one is undefined, the result is the other;
- **items**: union by `id` (the `unionBy` helper, `:29-38`); for an id present on both sides: `first = min`, `seen = max`, `right = max`, `bestBox = max`, `last = max`; the schedule triple `(box, due, at)` comes **from the side with the later `at`**; on equal `at`, from the side with the higher `box`; on equal `box`, the later `due` (`null` earliest); finally `bestBox = max(bestBox, box)` and `right = min(right, seen)` re-establish the schema refinement;
- **topics**: union by `topic`; `bestStars`, `sessions`, `last`, `bestCaught` are all `max`;
- the output arrays are sorted by key, like `unionBy` (`:37`).

`mergeSnapshots` (`:80-98`) gains `vocab: mergeVocab(local.vocab, server.vocab)` (spread only when defined, so a snapshot with no vocabulary stays byte-identical to today's). `isSubsetOf` (`:101-111`) gains `vocabCovered(local.vocab, server.vocab)`: true when every local item exists on the server with `server.at >= local.at` and `server.bestBox >= local.bestBox`, `server.seen >= local.seen`, and every local topic is covered likewise — so an upload happens exactly when the server lacks something.

**Properties** (each a unit test, 100 % of the new code): `mergeVocab` is **commutative, associative and idempotent** (checked over 500 seeded random triples); `bestBox`, `seen`, `right`, `first` (min) and every topic field are **monotonic**: `mergeVocab(a, b)` is `>=` both inputs field-wise; the result always satisfies `VocabItemStateSchema`; a **schedule drop is never visible as a collection loss** (a word in box 4 on the tablet and box 1 on the phone merges to the later-`at` schedule and `bestBox = 4`).

**Clock skew**: `at` is a device timestamp. A device whose clock is far in the future can make its schedule win every merge until real time catches up. The consequence is limited to *when a word comes back*; nothing earned depends on `at`. `applyVocabEvents` clamps a supplied `now` to at most 24 hours ahead of the previous latest `at` it sees in the slice, so one wrong clock cannot push a schedule years out; the clamp has a test.

**Server first (P6).**
1. **PR P-1** (content-schema + backend, no client change): `schemas/vocab-progress.ts`, `ProgressSnapshotSchema.vocab`, `ProgressSummarySchema.vocab` (§3.8), exports, 100 % tests; in `packages/backend/src/routes/sync.ts` the **preserve rule**: after the compare-and-set read, when `body.snapshot.vocab === undefined` (**the key is absent**; an explicit empty slice `{ v: 1, items: [], topics: [] }` is a value and replaces) and the stored `current?.payload` is an object with a `vocab`, the stored record's payload is `{ ...body.snapshot, vocab: current.payload.vocab }` — an old app build (which re-uploads without the slice after a conflict merge) can never erase it. `summary.vocab` is kept from `current.summary` **only in that same case** (when the payload's slice was preserved), so a summary never describes a slice the payload no longer has. `SnapshotRecord.payload` and `.summary` are typed `unknown` (`store.ts:85-94`), so the rule reads them as plain objects and guards for `null`. A new build that has ever held a slice always sends one (a reset sends the empty slice, §3.10), so the rule protects old builds only. **Deploy the Worker** and verify with the checklist in §6 **before** merging P-3.
2. **Backend tests** (`packages/backend/src/__tests__/sync.test.ts`, the existing sync suite): a `PUT` snapshot containing `vocab` returns 200 and a `GET` returns it intact; a `PUT` without `vocab` after one with it keeps the stored `vocab` (the preserve rule); a body with `vocab.items[0].box = 9`, with more than 1,000 items, or with `first: 'yesterday'` is 422 `bad_request`; an old-shaped snapshot (no `vocab`) is accepted exactly as today; a 409 response returns the stored `vocab`.
3. **Client**: the first screen PR that records events (F-VOC-003 C-5, F-VOC-004 S-5, P-3 here) merges only after the Worker with P-1 is deployed (P-2 adds `recordVocab` but nothing calls it from a screen). Independently, **no release build enables `vocabTopicsEnabled`** until then (F-VOC-003 C-7's dependency); with the flag off no `vocab` data exists, so nothing is emitted. A restore from a **backup file** (`BackupFileSchema` embeds `ProgressSnapshotSchema`, `schemas/sync.ts:88-94`) round-trips the slice; an older app restoring a newer backup simply parses without it (the field is optional; a zod object strips it). `BackupFileSchema` parses the slice leniently (`.catch(undefined)`): a malformed or newer-version slice in a file is dropped and the rest of the file still restores, while `SnapshotPutSchema` stays strict (422). `ProgressSummary.vocab` is likewise dropped when malformed, never fatal (as `selfRoute`), so a bad derived summary cannot stop a learner's sync.
4. **What if an old Worker were hit anyway**: the slice is stripped on the way in, the app keeps its own copy locally (no data loss on the device), and the next restore from the server would lack it — this is the exposure the PR order and the deploy checklist exist to close.

### 3.4 The Leitner schedule

- Boxes and intervals: `BOX_DAYS = [0, 1, 3, 7, 14, 30]` for boxes 0-5. A collected word enters box 1 (due the next day).
- **Promotions and demotions** are exactly the table of §3.2. A word cannot be demoted below box 1, cannot be promoted above 5, and `bestBox` never decreases.
- **Due**: `isDue(state, today) = state.due !== null && state.due <= today`; `daysOverdue = daysBetween(due, today)` is used **only** to order words (oldest due first), never to select a message or a style.
- **Mastery for display** is `bestBox >= 3` ("strong"): used by caregivers (§3.8) and nowhere on a learner screen.
- **No speed factor, no decay of `bestBox`, no "lapse count"** (P3).
- **Skipped days are invisible**: nothing in the schedule or the copy knows how many days a learner was away; a word that is overdue by 20 days is simply due.
- **Topic completion** (used by F-VOC-003's meter): `topicState` counts items with a state (`collected`), never boxes.

### 3.5 Choosing words for a Speed Round (`logic/vocab/select-words.ts`, pure, 100 % covered)

```ts
export function selectSpeedWords(i: {
  collected: readonly RuntimeVocabItem[];       // the topic's collected items, in file order
  progress: VocabProgress; today: string; count: number; seed: number;
}): RuntimeVocabItem[];
```

- Target mix for `count` words: **about 60 % due** (oldest due first), **about 30 % new this week** (`first >= today - 7`, not already taken), **about 10 % strong** (`box >= 4`, not already taken, oldest `last` first); a shortfall in one group is filled from the next, then from any collected word with the oldest `last`. `count` 10 -> 6 / 3 / 1.
- Never returns a word twice; returns **all** collected words when there are fewer than `count`; deterministic for a seed (the seed only breaks ties inside a group via `shuffle`, `logic/shuffle.ts`).
- The list is in **selection priority order**, which is the `pool` order of F-VOC-004's `buildQuestions`.

### 3.6 The review hook (F-RVW-001) — `logic/vocab/review-pools.ts`

```ts
export function vocabPools(v: VocabProgress, today: string): { a: string[]; b: string[]; d: string[] };
export function recordReviewAnswer(id: string, correct: boolean): VocabEvent;   // { type: 'answer', id, correct, source: 'review' }
```

- **Pool A** = ids with `box === 1` and due; **Pool B** = `box === 2` and due; **Pool D** = `box >= 3` and due. Each list is ordered oldest due first, then by id. **Pool C** (the last test's misses) is **not** derived here: F-RVW-001's engine takes it from its own `ReviewEntry.missedItemIds` (the field exists on `main` since F-QUEST-002 Q-1, `schemas/progress.ts:72-73`), exactly as it does for symbols.
- The Daily Test engine **excludes yesterday's items** and applies the pool weights itself (F-RVW-001 §3.2); this module only supplies the due ids per pool. `ReviewEntry.itemIds` holds `vocab:*` ids next to `jamo:*` ids and `scope` is `'daily'` or `'vocab-topic:<key>'` for a topic-scoped test (`schemas/progress.ts:65-73`: no schema change).
- Answers in the Daily Test for `vocab:*` ids are recorded with `recordReviewAnswer` through `recordVocab` — **one scheduler, one box per word** (P7). Until F-RVW-001 ships, `vocabPools` has no caller except tests and the Home card (§3.7).
- A **14-day simulation** (the F-RVW-001 §6 harness, extended): introduce 12 words on day 0; a seeded learner answers right with probability 0.8; every day run the pool logic; assert that a word answered right on day 1 comes back on day 4 (box 2 -> due 3 days later), that a miss on day 5 returns it to box 1 and due on day 6, that no pool contains a not-yet-due word, that `bestBox` never falls, and that Pool D first has members on **day 11** (a word promoted to box 3 on day 4 is due again 7 days later; nothing can reach box 3 earlier than day 4), so the test pins the exact days.

### 3.7 Home: a nudge that is a gift, not a guilt trip (`logic/vocab/nudge.ts`, `mission-builder.ts`)

- `vocabNudge(v: VocabProgress, topicTitleOf, today): { topicKey: string; due: number } | null` — **only when** `due >= 3` words are due across the collected words (the "a word you learned a few days ago is ready" nudge, blueprint 02 N8 reduced to a count); `topicKey` is the topic with the most due words (ties: topic order). It reads no dates other than `due <= today` and returns **no information about how long anything has been overdue**. *As shipped in P-2b (#356):* the second argument is `topicOf(id) -> { key, order } | undefined` (the visible topic that opens the word and its picker order, which breaks ties, then key), and a due word whose topic cannot be opened (an id from a newer app, a hidden topic) is **not counted** toward the threshold of 3, because the card could not take the learner to it. P-3 is reviewed against this contract.
- **Mission card**: `MissionCardKind` (`logic/homework/mission-builder.ts:17`) gains `'vocab'` and `MissionCard` gains `topicKey?: string` (`:19-30`); `HomeScreen` maps a card kind to an icon through `ICON_FOR[card.kind]` (`screens/home/HomeScreen.tsx:78`, the map near `:42-47`), so the `vocab` kind gets the existing `library` icon, and its press handler (`:138-143`) navigates to `VocabSpeedRound` for `card.topicKey`; `BuildMissionInput` gains `vocab?: { topicKey: string; due: number } | null`. The **slot ③ chain** (no daily test) is reconciled with F-STORY-004 §3.7, whose table for ③ reads `next` story -> best remaining replay -> `again` story -> `explore` (and whose reason for putting stories before replays — an active learner has a replay candidate almost every day — applies to the vocabulary card even more: after a replay it would almost never show). The chain becomes **③: vocabulary card (only when `input.vocab` is set, i.e. at least 3 words are due) -> `next` story -> best remaining replay -> `again` story -> `explore`**, a one-row amendment of F-STORY-004 §3.7's table (recorded in `reviews/REVIEW-VOC.md`; **owner decision**: a due-words card ahead of a new story). Slot ① keeps its chain (a vocabulary card never takes slot ①; F-STORY-004 puts a `continue` story there). `fallbackCard` (`:152-175`) is shared by ① and ③ today, so the vocabulary step is added to the ③ call only. When F-RVW-001 ships (`capabilities.dailyTestAvailable`, `:41-44`) slot ③ is the Daily Test, whose pools already include the due words (§3.6), and `input.vocab` is ignored. The card is built **once per day and pinned** with the rest of the plan (`:177-...`, the §3.2 rule "cards never shift mid-day"). F-STORY-004 §3.7 also edits this function: whichever PR lands second rebases onto the other.
- **Card copy** (placeholder; `VOCAB_COPY`): title "Words are ready", subtitle "<N> words would like another look", button "Say hello again" -> `VocabSpeedRound { topicKey }` in **Relaxed**; the card is `collected` once a speed round for that topic completes today. **It never mentions a day count, "overdue", "missed", "behind" or "you forgot"** (banned list, `scripts/validate-content.mjs:42-46`, scanned by test).
- **Encouraging streak messages (D3)** stay Home's existing streak (`HomeScreen.tsx:188`, `snapshot.streakDays`); this spec adds none of its own and a missed day is never mentioned.
- **Telemetry** `home.vocab_card.shown` (§3.9) once per pinned plan.
- With `flags.vocabTopicsEnabled` false the input is `null` and Home is unchanged.

### 3.8 Caregiver and teacher summary

`ProgressSummarySchema.vocab` (`schemas/sync.ts`, optional):

```ts
export const VocabSummarySchema = z.object({
  collected: z.number().int().nonnegative(),            // words with a state, all topics
  strong: z.number().int().nonnegative(),               // bestBox >= 3
  topicsStarted: z.number().int().nonnegative(),
  topicsPracticed7d: z.number().int().nonnegative(),    // topics whose `last` is within the last 7 days — see below
  firstTryRate: z.number().min(0).max(1).nullable(),    // sum(right) / sum(seen); null when nothing answered; rounded to 2 decimals
  needsPractice: z.array(VocabIdSchema).max(3),         // up to three words to look at together (rule below)
});
```

- **`needsPractice` rule** (pure `vocabSummaryOf(v, today)`): words with `seen >= 2`, `box === 1` (currently failing) and the lowest `right / seen`, ties by the most recent `last` then id, the first three. A learner who has never missed gets `[]`.
- **`topicsPracticed7d`** is `topics.filter(t => t.last >= today - 6).length`: the slice keeps cumulative session counts, not a log, so a count of *rounds* in a week cannot be derived; the name says what it is.
- **`summarize`** (`logic/sync/summarize.ts:44-84`) gains `vocab: vocabSummaryOf(vocabOf(snapshot), localDay(now))`, omitted when the learner has no collected words (a learner who never used Words uploads a summary byte-identical to today's).
- **Parent dashboard** (`screens/parent/ParentDashboardScreen.tsx:44-49`): when the profile has a vocab slice, one extra row "Words: N collected, M strong. First-try rate: P %. To look at together: <ko · gloss>, ..." — the caregiver channel may show percentages (F-RVW-001 §1) but the row is plain text with the Korean word (`KoreanText`, romanization and gloss), never a chart or a rank. A parent with no vocab sees no row.
- **Console** (`apps/web`): the student line `Revisit:` (`teach/space/page.tsx:161`) gains `Words: N collected · M strong` and, when `needsPractice` is non-empty, `Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)` — taught Korean always travels with its romanization and gloss (CLAUDE.md §1), which also tells the two senses of a homonym apart; looked up in the generated `vocab-catalog.ts` (F-VOC-001 §3.7: id, ko, romanization, en, and `glosses { en, es?, ko? }` so the gloss follows the UI language, amended by P-4) so the web app needs no vocabulary logic and the Hangul is drawn with `lang="ko"`; an unknown id (a newer app) is shown by its romanized slug with no Hangul. `classRollup` (`lib/console/rollup.ts:23-39`) gains `vocabRevisit: string[]` — the up-to-three most common `needsPractice` ids across the class, **with no per-student percentiles and no ordering of students** (F-TCH-001 §3.2); `firstTryRate` is **not** shown in the roster (it is available in a student's detail view only). *[TV] 2026-10-14:* the student's detail view is the learner report (F-REPORT-001 section 3.5), which carries `vocab` with `firstTryRate` for a family and for a full-scope class (`AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` section 2).
- **Teacher language**: the console strings pass the caregiver banned list (F-PAR-001 §3.6); "Words to revisit" (not "weak words", "failed", "behind").
- **Privacy**: the slice holds word ids, counts and days only — no free text, no names, no audio, no answer content; nothing new is sent in telemetry beyond counts and topic keys.

### 3.9 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `schemas/telemetry.ts:9-50`, and to `specs-out/TELEMETRY-NAMES-2.md` section G)

| Name | Payload | When |
|---|---|---|
| `home.vocab_card.shown` | `{ topicKey, due }` | the pinned Today plan includes the vocabulary card (once per plan; same family as `home.story_card.shown`, F-STORY-004 §3.11). Since P-3b: once per profile per **local** day (`vocabCardShownKey`), not per UTC day, so a learner far from UTC can send it twice in one UTC day (the card shown, then derived again at local midnight); count it per local day, the Worker does not deduplicate |

(F-VOC-003 adds `vocab.topic_opened`, `vocab.cards.start`, `vocab.cards.complete`; F-VOC-004 adds `vocab.round.start`, `vocab.round.complete`, `vocab.challenge_toggled`. Together the feature adds **7** names; none collides with the 38 on `main`, the 21 pending names of the story and audio specs in `TELEMETRY-NAMES-2.md` or the other VOC names). The PR adding the names ships first (rule 1) and updates the exact-list test (`packages/content-schema/src/__tests__/telemetry.test.ts:5-49`). No event carries a word, a name or free text.

### 3.10 Accessibility, errors and offline

- Nothing in this spec renders new UI except the Home card (>= `touchTarget.min`, an accessible name "Words are ready. 5 words would like another look. Opens a quick round.") and two caregiver text rows.
- **Offline**: all writes are local; the slice syncs when the next upload succeeds; a failed upload retries on the existing schedule (`logic/sync/scheduler.ts`).
- **Corrupt or missing slice**: `vocabOf` returns the empty slice; a stored snapshot whose `vocab` fails `safeParse` on load is treated as having none and the next write rebuilds from events (the app never crashes on it; `readJson` already swallows read errors, `platform/storage.ts:10-17`).
- **Hydration race**: events recorded before hydration are merged with the saved slice by `hydrate` (§3.2).
- **Reset**: the parent's existing profile reset (`progress-store.reset`, `:269-273`) clears the slice with the rest: for a profile that has ever held a slice it writes the **empty slice** `{ v: 1, items: [], topics: [] }` (not an absent key), so the Worker's preserve rule (§3.3) does not bring the old words back from the server. As with the cards and quests, a second device that still has the words merges them back on its next conflict ("collections only grow"). The same happens today on the reset device itself when it is behind the server: its upload of the empty slice meets a 409, the engine folds the server copy in and the union brings every word back onto the reset device (pinned by the P-5 integration suite). So a reset sticks only on a device that is up to date with the server and while no other device still holds the words. This is a known limitation, not an accepted design: a parent who resets a stale phone after the other device was lost or uninstalled sees the words return although no device holds them. Making a reset stick is open item 10 (§8), an owner decision.

### 3.11 Behaviours (Given / When / Then)

1. **Given** a new word introduced on 2026-10-10, **then** its state is `box 1`, `bestBox 1`, `due 2026-10-11`, `seen 0`.
2. **Given** that word answered right first try on 2026-10-11, **then** `box 2`, `bestBox 2`, `due 2026-10-14`, `seen 1`, `right 1`.
3. **Given** the same word in box 3 answered wrong, **then** `box 2`, `due` tomorrow, `bestBox 3`, `seen` +1, `right` unchanged — and no learner-visible number decreased.
4. **Given** a right answer with a hint, **then** `seen` +1, `right` unchanged, box unchanged.
5. **Given** "Got it" on a new word, **then** `box 2`, `due` in 3 days, `bestBox 2`; **given** "Got it" on a word already in box 4, **then** nothing lowers and `bestBox` stays 4.
6. **Given** two devices that each collected different words and each answered some, **when** their snapshots merge in either order, **then** the result is the same, contains every collected word, and each word's `bestBox`, `seen`, `right` are the larger of the two.
7. **Given** device A (box 4, `at` 10:00) and device B (box 1, `at` 11:00) for the same word, **then** the merged schedule is B's (box 1) and `bestBox` is 4.
8. **Given** an old app build that re-uploads a snapshot without `vocab` after a conflict, **when** the Worker stores it, **then** the stored `vocab` is unchanged.
9. **Given** a body with `vocab.items[0].box = 9`, **then** the Worker answers 422.
10. **Given** 12 collected words of which 4 are due and `count` 10, **then** `selectSpeedWords` returns the 4 due words first (oldest due first), then recently collected, then the oldest-practised.
11. **Given** 3 or more due words and the flag on, **when** Today is built, **then** slot ③ is a "Words are ready" card for the topic with the most due words, pinned for the day; **given** fewer than 3, no such card.
12. **Given** a learner who played Challenge twice, catching 9 then 7, **then** `bestCaught` is 9.
13. **Given** a learner with no collected words, **then** `summarize` output has no `vocab` key.
14. **Given** the console and a student with `needsPractice: ['vocab:sagwa-apple','vocab:nun-eye']`, **then** the line reads `Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)` with no ranking or percentile of students.
15. **Given** a profile reset, **then** the local slice is the empty slice (the Worker preserves only an *absent* key). The next upload from a device that is up to date with the server replaces the server's slice with it, and a second device that still holds the words can bring them back through a conflict merge (the existing "collections only grow" semantics). A device that is behind the server meets a 409 on that upload and merges the server's words back in (§3.10; open item 10).

## 4. Out of scope

- A delta or event-log sync format; per-answer history; response-time analytics (P3).
- A "Words" tab in the parent dashboard with charts; per-word detail for caregivers.
- Teacher plan items of kind `vocab-topic` (F-PLAN-002) and plan progress for them.
- Heritage cards or badges per topic (F-VOC-004 S10).
- The Daily Test itself (F-RVW-001): this spec supplies pools and the answer hook only.
- Changing the streak rule (UTC day) or `computeStreak` (`logic/streak.ts`).
- Server-side merging of two snapshots (the client merges on 409, F-SYNC-001 §3.5).
- Importing words from another app; export of word lists.

## 5. Tests

| File | Level | Coverage focus |
|---|---|---|
| `content-schema/src/__tests__/vocab-progress.test.ts` | unit, 100 % | `VocabItemStateSchema` (refinements: `right <= seen`, `bestBox >= box`), bad day strings, topic schema, `VocabProgressSchema` caps, `VocabSummarySchema`; old snapshots, backups and summaries **without** the fields still parse; a snapshot with `vocab` round-trips |
| `content-schema/src/__tests__/sync.test.ts` (extended) | unit | `SnapshotPutSchema` accepts and keeps `vocab`; `ProgressSummarySchema.vocab` optional |
| `content-schema/src/__tests__/telemetry.test.ts` (extended) | unit | the exact list gains `home.vocab_card.shown` (with the six from F-VOC-003/004) |
| `backend/src/__tests__/sync.test.ts` (extended) | integration | the five cases of §3.3 item 2, incl. the preserve rule for `payload` and `summary` |
| `mobile/src/logic/vocab/__tests__/progress.test.ts` | unit, 100 % | every row of §3.2's table; unknown / malformed ids ignored; idempotent `introduced`; deterministic sorted output; the 24-hour clamp; `localDay` / `addDays` across month and year ends and a DST change |
| `mobile/src/logic/vocab/__tests__/srs.test.ts` | unit, 100 % | box transitions, intervals, floor at 1, ceiling at 5, `bestBox` monotonic over 1,000 random events |
| `mobile/src/logic/vocab/__tests__/select-words.test.ts` | unit, 100 % | the 60 / 30 / 10 mix and every shortfall fill, fewer words than `count`, determinism by seed |
| `mobile/src/logic/vocab/__tests__/review-pools.test.ts` | unit, 100 % | pool membership by box and due; ordering; the **14-day simulation** of §3.6 |
| `mobile/src/logic/vocab/__tests__/nudge.test.ts` | unit, 100 % | threshold 3, topic choice with ties, no date information in the return value |
| `mobile/src/logic/homework/__tests__/mission-builder.test.ts` (extended) | unit | the slot ③ chain: replay -> vocab -> story; slot ① unchanged; ignored when `dailyTestAvailable`; pinned plan stable; still exactly three cards; the card copy passes `scanLearnerCopy` and has no day count |
| `mobile/src/logic/sync/__tests__/merge.test.ts` (extended) | unit | `mergeVocab`: commutative, associative, idempotent over 500 seeded triples; monotone fields; schedule last-writer-wins and tie-breaks; one side undefined; result passes the schema; `mergeSnapshots` omits `vocab` when neither side has it; `isSubsetOf` with and without vocab |
| `mobile/src/logic/sync/__tests__/summarize.test.ts` (extended) | unit | `vocabSummaryOf` (`needsPractice` rule and tie-breaks, `firstTryRate` rounding, `strong`), omitted when empty |
| `mobile/src/store/__tests__/progress-store.test.ts` (extended) | unit | `recordVocab` persists once hydrated, defers before hydration and merges, notifies sync, `reset` clears the slice |
| `mobile/src/logic/sync/__tests__/engine.test.ts` (extended) | unit | a conflict round with `vocab` on both sides merges and uploads the union; an upload is skipped when the server already covers everything |
| `web/src/lib/console/__tests__/rollup.test.ts` (extended) | unit | `vocabRevisit` counts and ties; no student ordering |
| `web/src/data/__tests__/vocab-catalog.test.ts` | unit | catalogue lookup for known and unknown ids |

Coverage targets (CLAUDE.md §6): `packages/content-schema` **100 %**; `packages/backend` **90 %**; `apps/mobile` business logic **90 % -> 100 %** (all new code is under `src/logic/`, `apps/mobile/vitest.config.ts:33`); `apps/web` verification logic **90 %** (`lib/console/`).

## 6. Rollout and PR breakdown (dependency order)

| # | PR | Size | Depends on |
|---|---|---|---|
| P-1 | `feat(content-schema,backend)`: `vocab-progress.ts`, `ProgressSnapshot.vocab`, `ProgressSummary.vocab`, the Worker **preserve rule** and its tests, the telemetry name | M | F-VOC-001 V-1 (`VocabIdSchema`) |
| **Deploy** | **Deploy the Worker (`apps/api`) with P-1** and run the checklist below | — | P-1 |
| P-2a | `feat(mobile)`: the core — `logic/vocab/{progress,srs}.ts`, `merge.ts` (`mergeVocab`) / `isSubsetOf` changes, `progress-store.recordVocab` with the pre-hydration queue and the reset slice, tests | M | P-1 |
| P-2b | `feat(mobile)`: `logic/vocab/{select-words,review-pools,nudge}.ts`, `summarize.ts` (`vocabSummaryOf`), tests | M | P-2a |
| P-3 | `feat(mobile)`: Home vocabulary card (`mission-builder.ts`, `HomeScreen`), parent dashboard row | M | P-2b, F-VOC-003 C-4, F-VOC-004 S-5 (the card opens `VocabSpeedRound`; the Worker deploy must have happened) |
| P-3b | `fix(mobile)`: one day basis for the Home vocabulary card (review of P-3, #579, follow-up 2). `homeVocabNudge` counts due words by the device's local day (P5), but Home pins the whole plan, and keys `vocabRoundsDone` and the shown event, by the plan's UTC day key (`dayKey`, F-HW-001 section 3.2), so far from UTC the card appears or leaves at the UTC rollover, not at local midnight. *Checked 2026-10-13 (home and i18n follow-ups):* this cannot be fixed inside `logic/vocab/home-card.ts` and `HomeScreen` alone: the pinned plan (`pinnedMission(profileId, today)`) freezes slot (3), and the card's due count, for the UTC day, so moving it needs a pinned-path rule in `buildTodaysMission` (re-derive or drop a slot-3 vocabulary card when the local day changes) and a local-day key for `vocabRoundsDone`, without changing F-HW-001's `dayKey` for the other cards. Tests: a mission-builder test at a UTC offset far from zero (for example `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`) showing the card appears and leaves at local midnight. Words are never lost and the copy names no day, so nothing is wrong for a learner meanwhile. *As built (stacked on F-ROUTE-001 R-7e):* `BuildMissionInput` gains `vocabDay` (the local day) and `vocabCarry` (the profile's latest pin, `latestPin`); `MissionPlan` gains `vocabDay`. On a pinned plan whose local day changed, `repinVocabDay` derives a slot-3 vocabulary card again (with nothing left in slot (3)'s chain the old card is dropped, as a fresh plan leaves slot (3) empty), or lets an uncollected slot-3 card give way to it when words are now due, except a story the learner has started ("Keep reading"), which stays (an amendment to F-HW-001 section 3.2 for slot (3) only); a collected card and the Daily Test stay, and cards (1) and (2) never move. A fresh plan on a new UTC day keeps the carried pin's vocabulary state while the local day is the same. `vocabRoundsDone` is keyed by `localDay`, `home.vocab_card.shown` is sent once per profile and local day (`vocabCardShownKey`), and Home re-renders at local midnight through `useToday('local')` | S | P-3, F-HW-001 |
| P-4 | `feat(web)`: console student line and `vocabRevisit`, `vocab-catalog.ts` consumption. P-1 lists `vocab` in `TEACHER_HIDDEN_SUMMARY_KEYS`, so no roster carries `summary.vocab` yet; P-4 moves it to `TEACHER_VISIBLE_SUMMARY_KEYS` together with a consent item (F-SPACE-002 T-1a), or the line stays empty | S | P-1, F-VOC-001 V-2b |
| P-4b | `feat(content-schema,backend,web)`: **the consent item for words** (owner-blocked: consent text, counsel gate G2). P-4 shipped the console lines dormant (the "line stays empty" branch). P-4b, following F-FEEDBACK-001 FB-1: adds a `words` item to `transfer-consent.ts`, moves `vocab` from `TEACHER_HIDDEN_SUMMARY_KEYS` to `TEACHER_VISIBLE_SUMMARY_KEYS`, bumps `TRANSFER_CONSENT_TEXT_VERSION` (new pinned hashes, earlier versions kept in `ACCEPTED_CONSENT_TEXT_VERSIONS`), gives `teacherVisibleSummary` (`roster-summary.ts`) a `vocab` branch that copies only `VocabSummary`'s known keys and **drops `firstTryRate`** for every roster viewer (§3.8: a student's detail view only), and stops zeroing activity `w` (F-REPORT-001 RP-1; its coupling test flips). The F-REPORT-001 P5 `words_revisit` line waits on this row. **[TV] Done 2026-10-14 as the owner's decision** (no counsel gate): delivered by PR TV-B of `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md`, where `vocab` joins `TEACHER_FULL_SCOPE_EXTRA_KEYS` (visible to a family always, and to a class once the family has read the class-scope update), the `words` item is in both consent texts and `transfer-2026-10d` is the current version | S | P-4, owner consent-text decision (given 2026-10-14) |
| P-5 | `test`: the 14-day and 30-day simulations and the two-device merge test as an integration suite (can sit in P-2a/P-2b if small) | S | P-2b |

**Deploy checklist** (in the P-1 PR description, ticked by the owner before P-3 merges and before `vocabTopicsEnabled` is flipped): (1) the Worker deploy of P-1 is live; (2) a test learner `PUT` with a `vocab` block returns 200 and the following `GET` returns the block; (3) a second `PUT` without `vocab` leaves it in place; (4) the Rescue Code restore of that learner returns the block. (I could not run any of this against production from here; it is a checklist, not a result.)

*Amendment 2026-10-13 (P-3 review, #579; the owner may revert it):* the P-3 merge gate is item (1), the Worker deploy of P-1, the same gate F-VOC-003 C-5 and F-VOC-004 S-5 (#496) merged on. P-1 is #287 (merged 2026-10-11), the Worker auto-deploys from main, and `GET /health` on the production Worker returns `{"status":"ok","environment":"production",...}` on 2026-10-13. Items (2) to (4) move wholly to the flag flip (F-VOC-003 C-7): P-3 ships behind `flags.vocabTopicsEnabled` (off), so no release build writes a `vocab` slice and the sync paths those items check carry none until the flip. The owner still ticks the whole checklist before C-7.

*C-7 status 2026-10-13 (owner decision 2026-10-13: turn vocabulary topics on; F-VOC-003 C-7 flips the flag on the owner's behalf).* **The flip went ahead on the owner's decision before items (2) to (4) were ticked**, which departs from the line above ("the owner still ticks the whole checklist before C-7"). Those items can only be proven against production data, which an agent does not touch (no authenticated, sync-write or recovery request is sent to production), so they are **post-merge owner checks, due within 24 hours of the C-7 deploy**; if either (2) or (4) fails, roll back at once (below). The flip is web-first: iOS and Android bundles keep Words off by default until the FlipCard device pass is recorded (`design/screens/vocab/cards.md`, "Device flip pass"). Each item, with what the repo proves and what is left:

- [x] **(1) The Worker deploy of P-1 is live.** P-1 is #287 (merged 2026-10-11); Workers Builds deploys `hangul-route-api` from `main`, and its check run on the later P-3 merge commit (`e3aea0e2f`, #579) succeeded on 2026-10-13, so the deployed Worker carries P-1's preserve rule; `GET /health` on the production Worker returned `{"status":"ok","environment":"production",...}` on 2026-10-13.
- [ ] **(2) A `PUT` with a `vocab` block returns 200 and the following `GET` returns it.** Repo proof: `packages/backend/src/__tests__/sync.test.ts`, "a PUT with vocab returns 200 and the GET returns the slice and summary intact", on the in-memory DB and on SQLite (`test:sqlite`). **Owner step**: on app.hangulroute.com, in a new browser profile, make a test learner, open Library, Words, Food, Learn, and go through the first four cards; wait for the sync (or reload). In the Cloudflare dashboard, D1 `hangul-route`, Console, run `SELECT rev, json_extract(payload_json, '$.vocab.items') FROM snapshots ORDER BY updated_at DESC LIMIT 1;` and check the row lists the four Food words. Tick when it does.
- [ ] **(3) A second `PUT` without `vocab` leaves it in place.** Repo proof: `sync.test.ts`, "preserve rule: a PUT without vocab after one with it keeps the stored slice and summary.vocab" (both DBs), and `additive-fields.ts` (`VOCAB`). **Owner step**: no release build sends a snapshot without `vocab` once it has one, so this can only be seen with an older build; it is the same code path as (2)'s Worker and needs no separate check unless the owner wants one. Tick after (2) passes.
- [ ] **(4) The Rescue Code restore of that learner returns the block.** Repo proof: `packages/backend/src/__tests__/recovery.test.ts`, "F-VOC-005 deploy checklist item 4" (added by C-7: a `vocab` PUT, an older build's PUT without it, then a claim that returns the slice and `summary.vocab`). **Owner step**: for the test learner of (2), open the grown-up area (PIN), **Save my progress**, and write down the rescue code; in a second new browser profile choose **I have a rescue code**, enter it, **Find my cards**, then open Library, Words: Food shows 4 collected. Tick when it does.

Rollback for any failed owner step (no data migration; the stored slice stays and is inert, because `merge.ts` sends `vocab` only when it is defined and the Worker keeps the stored slice when a snapshot carries none):

1. In the Cloudflare dashboard, the Workers Builds project `hangul-route-app` (app.hangulroute.com), Settings, **Build**, Variables and Secrets: add the build variable `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED` = `false` (`docs/launch/owner-runbook.md` §0). `EXPO_PUBLIC_*` values are inlined into the bundle at build time, so the variable must be set where the production build runs, not at runtime.
2. Clear the project's build cache (Settings, Build, Build cache, **Clear cache**), then **Retry deployment**: a cached Metro bundle can still carry Words on (see `topic-data.ts`); a local rollback build uses `expo export --clear` for the same reason.
3. Check the deployed site: Library shows no Words tab. Report the failing step.

The flag-off e2e describes (vocab-topics, vocab-cards, vocab-speed, home-vocab-card) run only on a build made with `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=false` and `E2E_VOCAB_TOPICS=0`; no CI lane makes that build yet, so run them locally before relying on the rollback: `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=false corepack pnpm --filter @hangul-route/mobile exec expo export --platform web --clear`, then `E2E_VOCAB_TOPICS=0 playwright test vocab-topics vocab-cards vocab-speed home-vocab-card`.

Rollback: `flags.vocabTopicsEnabled = false` stops new data; the slice already stored is inert (the schemas keep parsing it). The schedule's rules can change without a data migration because the stored fields (`box`, `due`) are interpreted by the app. Estimated effort: about 5-7 working days.

## 7. Dependencies

- **Upstream**: F-VOC-001 (`VocabIdSchema`, items); F-SYNC-001 / F-SYNC-002 (merge, engine, the `snapshots` table of migration 0002); F-HW-001 (mission slots); the 38 existing telemetry names and the exact-list test.
- **Downstream**: F-VOC-003 / F-VOC-004 (write events, read pools), F-RVW-001 (pools, review answers), F-PAR-001 (dashboard row), F-TCH-001 / F-CONSOLE-001 (roster line, roll-up), F-PLAN-002 (vocabulary plan items, later), F-TCH-004.

## 8. Unverified assumptions and open items

1. **Production behaviour of the preserve rule** and of D1 with a 17-120 KB `payload_json` is untested here (the spec was written read-only); the in-memory test DB (`packages/backend/src/db/memory.ts`) is what the tests exercise. The row-size limit of D1 is assumed comfortably above 120 KB.
2. **`z.object` stripping unknown keys on the old Worker** is taken from the design input and from reading `routes/sync.ts:49-51`; not re-run against a deployed Worker.
3. **Interval lengths (1, 3, 7, 14, 30) and the one-box demotion** are the design input's and blueprint 09 §2.3's simplified algorithm, not evidence-tuned; the stored fields allow changing them without a migration.
4. **`max`-merge of `seen`/`right`** under-counts parallel work on two devices; it only affects the caregiver rate.
5. **Local-day strings** assume the device's time zone changes rarely; a traveller crossing zones may see a word due a day early or late — harmless.
6. **`topicsPracticed7d` counts topics practised in the last 7 days**, not rounds (the slice keeps cumulative session counts, not a log); a log would break the "only grows, merges by max" shape. If caregivers want a count of rounds, that needs the event-log format of §4.
7. **The Home slot ③ chain** (vocabulary -> `next` story -> replay -> `again` story -> `explore`) puts the due-words card ahead of a new story; this is the review's reconciliation of two specs that both claimed slot ③ and is an owner decision (the alternative, replay first, would hide the card for any active learner). Whichever of this PR and F-STORY-004 PR 4.4a lands second rebases.
8. **Parent dashboard** (`ParentDashboardScreen.tsx`) reads the snapshot directly; the exact row placement is a copy/layout decision at implementation time and uses the existing caregiver typography.
9. **`ReviewEntry.missedItemIds`** exists on `main` (`schemas/progress.ts:72-73`, F-QUEST-002 Q-1); F-RVW-001's engine, which would fill it, does not exist yet.
10. **A reset on a stale device does not stick** (owner decision, found by the P-5 integration suite). Today a profile reset on a device whose `rev` is behind the server's uploads the empty slice, meets a 409, and the engine's union merge brings every word back (§3.10, behaviour 15). It matters most when the other device that uploaded is gone (lost or uninstalled): no device holds the words, yet they return. Options: (a) the reset pulls the server rev first, so its upload replaces the slice; (b) a reset epoch on the slice that the merge honours (a slice from an older epoch merges as empty). Cards and quests share the same "collections only grow" behaviour, so the decision should cover the whole snapshot, not words alone. No row yet: one is added once the owner picks an option.
