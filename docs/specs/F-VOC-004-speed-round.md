Status: ready

# F-VOC-004 — Speed Round: picture, word and sound questions with one session clock, a spark meter that only fills, and an opt-in Challenge mode

**Scope**: `apps/mobile` (`logic/vocab/`, `logic/shuffle.ts`, `platform/app-state*.ts`, `screens/vocab/`, `store/vocab-run-store.ts`, `navigation/`) · `packages/content-schema` (`ProfileSettings` fields, telemetry names) · `packages/design-system` (reuses `ChoiceCard` from F-STORY-003, `KoreanText`, `WordArt`, `StarRow`, `Progress`, `HoyaBubble`; adds one small `SparkMeter` component)
**Owner**: solo dev
**Rollout**: behind `flags.vocabTopicsEnabled` (F-VOC-003). PR order in §6.
**Wireframes**: `wireframes/vocab-speed-round.md` (A start sheet, B word-to-picture, C picture-to-word, D sound-to-picture, E right reveal, F gentle miss reveal, G Challenge clock and paused, H results, I stop sheet and empty states) — promoted to `design/wireframes/vocab/{speed-round,results}.md`

Parent / siblings: F-VOC-001 (items, sense groups, ids) · F-VOC-002 (pictures, `COLOR_CONFUSION_PAIRS`) · F-VOC-003 (the topic page launches this; shares the question view) · F-VOC-005 (what the answers write, which words are picked) · F-RVW-001 §3.1 and §3.7 (stars-only learner screens, session clock, fill-only meters, Challenge mode) · CLAUDE.md §1 "Feedback and motivation" (revised 2026-10-09) · F-QUEST-002 §3.10 and §3.12 (Listen & Pick, `MinigameHost`, `playPrompt`) · F-STORY-003 §3.4 (`ChoiceCard`) · F-AUDIO-004 (`canPlayKorean`, prompt-state fallback) · F-LEARN-001 (`levelOrder`) · F-I18N-001 (`ProfileSettings`, `romanizationShown`) · design input `topic-speed-quiz.md` §4 · blueprint 06 §0.4 (catalog rules: a session is about 3 minutes or less, a miss still moves the game on, touch only, sound paired with visuals)

---

## Decisions

Binding owner decisions this spec implements: **D1** (any age; the learner *level* changes the question mix and option count, never what a person is allowed to do) · **D3** (anti-shame rules loosened: **one session clock** with no per-question failure, **meters that only fill and never drop on a miss**, encouraging messages, an **opt-in Challenge mode with a real countdown, default Relaxed**; still forbidden: red-X shaming, public ranking of children, losing earned items, percentages or fractions on learner result screens) · **D2** (romanization visible by default) · **D5** (nothing gated) · **D6** (TTS with a capability check and a visible text fallback) · **D7** (pictures are SVG) · **D8** (spec id).

| # | Decision | Why |
|---|---|---|
| S1 | **Two modes, one clock rule.** *Relaxed* (default): a fixed number of questions (10; 8 for the Pictures-first level), **no clock shown and no time limit**. *Challenge* (opt-in): **one** session clock for the whole round (60 s, scalable) with a real countdown. There is never a per-question timer. | D3 allows "one session clock per session" and a Challenge countdown "optional, opt-in, off by default"; Relaxed is the default so that nobody meets a clock by accident. |
| S2 | **Time never marks anything wrong.** When the Challenge clock reaches zero the round ends; the question on screen is dropped, not recorded; nothing is marked wrong or skipped-as-wrong. **The clock stops while an answer is revealed**, so a miss costs no time. | F-RVW-001 §3.7 ("unanswered items are `skipped`, never `wrong`"); "no time penalty" for a miss. |
| S3 | **The spark meter is a counter that can only go up.** The state is an integer `sparks` and the reducer has no code path that lowers it; a miss leaves it unchanged. The meter is what the design input called a "streak": it gives the same feeling of momentum without a combo that resets (CLAUDE.md §1: a counter that resets on a miss is a meter that drops, so it is not allowed). | D3. |
| S4 | **Stars follow F-RVW-001 §3.1**: of the questions answered, `>= 0.8` right on the first try -> 3, `>= 0.5` -> 2, otherwise 1; **never 0** (a round with at least one answer always earns a star). They are **not** `starsForAccuracy` (`logic/score.ts:6-13`: 0.95 / 0.6 / 0.2, allows 0), which belongs to quests. The learner sees stars and a plain count of **words caught**; **no percentage, ratio or fraction** is shown anywhere on a learner screen. | F-RVW-001 §3.1; D3; the design input flagged the mismatch. |
| S5 | **No retry in a speed question**: the first tap decides, the answer is shown, and the round moves on ("a miss still moves the game on", blueprint 06 §0.4). This differs from the Quick check of F-VOC-003 and from Listen & Pick, which let the learner try again, because retries do not fit a fast round. | Pace and a clean "first try" measure for the spaced-repetition schedule. |
| S6 | **Three question formats**: word to picture, picture to word, sound to picture. The mix follows the learner **level** and, inside it, each word's Leitner box (F-VOC-005). | The brief; the design input §4. |
| S7 | **Audio questions need a working voice, decided once**: the builder asks `canPlayKorean()` (F-AUDIO-004 §3.4) when the round is built and drops sound-to-picture when it is false or sound is muted; if a voice fails *during* a round the question shows its text prompt and scores normally (F-QUEST-002 §3.10). | F-AUDIO-004 §3.8 ("speed quizzes call `canPlayKorean()` once before building the item list"). |
| S8 | **Challenge is a per-profile opt-in** stored in `ProfileSettings.challengeMode` (default `false`; **the one Challenge setting of the app** — F-RVW-001 §3.7's Challenge for the Daily Test reads the same field when it ships, so a learner or caregiver never has two switches) with a clock scale `1 / 1.5 / 2`; it is turned on from the Profile screen or from the start sheet's explicit "Try Challenge" switch (which flips the same setting, with a one-line explanation). It is never preselected for a profile that has not opted in. | D3 ("opt-in", "default Relaxed"); WCAG 2.2.1 "Timing adjustable" (turn off, adjust, extend). |
| S9 | **A personal best is private**: "most words caught in one Challenge round" per topic, compared only with the learner's own earlier best ("New best!"); never shown to a caregiver, teacher or another learner. | D3 (no public ranking of children, no learner-vs-learner comparison); blueprint 02 N2 ("faster than yesterday" compares only against your own past). |
| S10 | **No cards, no new reward objects**: finishing a round earns stars and a count; there is no heritage card per topic at launch (F-STORY-006's grammar can add `vocab-topic:*` later). Nothing earned is ever taken away. | Keeps the Library collection (30 + 12 cards) unchanged and F-CARD-S2-001's plan intact; the open question in the design input is answered "not at launch". |
| S11 | **Words to see again are listed, never scored**: the results screen lists the words missed as tiles under "Words to see again" with a button to practise them; the copy never says "wrong", "missed" or "failed" (banned words, `scripts/validate-content.mjs:42-46`). | D3; F-HW-001 §3.3 anti-shame contract. |
| S12 | **The question builder generalises `buildCultureQuizRounds`** (`logic/round-builder.ts:176-204`) into a module keyed by **item id**, not by English string (`:194` de-duplicates by `en`, which breaks for homonyms and for pictures). `shuffle` moves to `logic/shuffle.ts` unchanged. | Reuse, not rewrite; the existing tests (`round-builder.test.ts`, 19 passing in the design input's baseline) are the safety net for the move. |

---

## 1. Context

**What exists** (verified at `main` HEAD `ecf6365`, after PRs #102-#105; cites re-checked by the review of 2026-10-10):

- **A shipped 4-option quiz** to copy the shape of: `screens/minigames/CultureQuizGame.tsx` (`Progress` bar, a `HoyaBubble` on a wrong answer, auto-advance after 700 ms, `:36-57` and `:65`), fed by `buildCultureQuizRounds` (`logic/round-builder.ts:176-204`): one answer plus `optionCount - 1` distractors from the same pair list, with a seeded `shuffle` (`:16-25`, a linear congruential generator, `Date.now()` by default, tests pass a seed). Options are keyed and de-duplicated by the English string (`:194`, and `CultureQuizGame.tsx:81-92`), which cannot tell two senses of 눈 apart.
- **Scoring helpers**: `tallyAnswer` (first answer per round key scores, later ones are retries, `logic/first-try.ts:24-34`); `starsForAccuracy` (`logic/score.ts:6-13`, 0.95 / 0.6 / 0.2 thresholds, 0 stars possible); `shouldUnlockCard` (`logic/reward.ts:6-10`); the quest run store scores through `tallyAnswer` (`store/quest-run-store.ts:55-68`).
- **Games are wired to quests**: every game calls `useQuestRunStore` and the route needs `questId`/`stepIndex` (`screens/minigames/MinigameScreen.tsx:22-79`, `navigation/types.ts:32-36`). F-QUEST-002 §3.12 defines `MinigameHost` for reuse outside quests; the speed round does **not** run inside `MinigameScreen` (it has its own route) but reports through the same host shape (§3.9).
- **No clock exists anywhere in the learner app**: the only timers are animation timeouts and auto-advance (`CultureQuizGame.tsx:52`); `AppState` is not used (`grep` of `apps/mobile/src` finds none), so backgrounding does not pause anything today. Reduced motion has a hook (`platform/motion.ts:7-25`); haptics a wrapper (`platform/haptics`).
- **The review rules this spec must live inside**: F-RVW-001 §3.1 (stars 1-3, never 0, no percentage or fraction on the learner result), §3.7 (one clock per attempt; time-out ends the attempt, unanswered items are `skipped`; fill-only meters; encouraging streak messages; Challenge opt-in, default off), §4 (no leaderboards, no raising stakes on a streak). The wireframes for reviews say "No timer" (`design/wireframes/reviews/stage-review.md:59`) — that was before D3, and this spec is the first learner surface to use the allowance.
- **Telemetry**: `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:9-50`); the existing `minigame.finished` is **not** reused (it carries `questId`/`stepIndex`).
- **Settings**: `ProfileSettingsSchema` (`schemas/locale.ts:20-24`) is "additive only" by its own comment; F-I18N-001 §3.2 says later specs extend it and say so in their Decisions (this one does, S8).

**What this spec does.** (1) Defines the **question builder**: formats, how the level and each word's box choose them, and the distractor policy (homonyms, sense groups, colour confusion, counts, picture families, confusables). (2) The **session**: one pure reducer for the round, one pure clock, the spark meter, stars, nudges, hints. (3) The screens: start sheet, question, reveal, pause, results, stop. (4) **Challenge mode**: opt-in, a real countdown, adjustable and pausable. (5) Accessibility without a timing trap, no flashing. (6) What each answer writes and the telemetry.

Terms. **Round**: one Speed Round session. **Question**: one prompt with options. **Caught**: a word answered right on the first try (not hinted). **Spark**: one unit of the meter. **Reveal**: the beat after an answer where the right answer is shown and spoken. **Active time**: time with a question on screen and the round not paused.

## 2. User story

> As someone learning Korean words, I want a quick game where I match pictures, words and sounds, with a little spark that fills as I go, and — only if I choose — a clock to beat, so that I practise the words I have met in a way that feels like play and never like a test I can fail.

Companion stories:

- As a **beginner who cannot read Hangul yet**, I want the game to show me the picture and the sound first, with romanization beside the word, and three choices, not four.
- As a **learner who likes a challenge**, I want to switch on a countdown and a private best, and switch it off again.
- As a **learner who needs more time or uses a screen reader**, I want to turn the clock off, slow it down, pause it, and never be rushed.
- As a **parent or teacher**, I want to see how many words a learner caught and which to revisit, not a leaderboard.
- As a **developer**, I want the session, the clock and the question builder as pure functions, so the screens are thin and the "never drops" and "never marks wrong on time-out" rules are properties I can test.

## 3. Acceptance criteria

### 3.1 Settings and entry

- `ProfileSettingsSchema` (`packages/content-schema/src/schemas/locale.ts:20-24`) gains, additively:

```ts
challengeMode: z.boolean().default(false),                              // D3: off unless the learner or a caregiver turns it on
clockScale: z.union([z.literal(1), z.literal(1.5), z.literal(2)]).default(1),   // Challenge only: 60 s x scale
```

  Old stored values parse (both fields default); `locale.test.ts` gains the cases.

  **Amendment (S-1 as merged):** both fields are `.optional().catch(undefined)` instead of `.default(...)`: absent stays absent, so stored settings keep their shape, and readers resolve it with `?? DEFAULT_CHALLENGE_MODE` / `?? DEFAULT_CLOCK_SCALE` (exported next to `CLOCK_SCALES`, from which `ClockScaleSchema` is built). A value this version does not know (a later scale read after a rollback) reads as absent instead of failing the whole record, which would reset the learner's locale, romanization and Read to me settings. The setters live with the other profile settings in `store/locale-store.ts` (F-I18N-001 §3.2) as `setChallengeMode(profileId, on, source)` and `setClockScale(profileId, scale)`, each emitting `vocab.challenge_toggled` (§3.10). Until F-I18N-001 PR 3 lands the store, `challengeMode` is the constant `false` and the start sheet shows no Challenge control (S8).
- **Entry**: the topic page's **Speed round** button (F-VOC-003 §3.4) -> `VocabSpeedRound { topicKey; mode?: 'relaxed' | 'challenge' }` (root stack, `navigation/types.ts:3-37`, registered in `navigation/root.tsx:47-61`). Results: `VocabResults { topicKey; summary: RoundSummary }` (`RoundSummary` is a plain serialisable object, §3.6).
- **Availability**: at least **optionCount collected words** in the topic (3 for the Pictures-first level, 4 otherwise); fewer -> the start sheet shows "Learn a few more words first" and a primary button to Learn (never a dead end).

### 3.2 Question formats and who gets which

```ts
export type VocabFormat = 'word-to-image' | 'image-to-word' | 'audio-to-image';
```

| Format | Prompt | Options | Notes |
|---|---|---|---|
| `word-to-image` | the Korean word (`KoreanText`, romanization per `romanizationShown`) and **its audio plays automatically** when a voice exists | pictures (`PictureArt`, >= `touchTarget.hero` = 96) | the default first format for any word |
| `image-to-word` | the picture (160 dp) | Korean words (`ChoiceCard` with `KoreanText`, romanization per setting; >= `touchTarget.child` = 80) | needs reading, so not for Pictures first |
| `audio-to-image` | a large speaker button (unlimited replays); prompt text hidden until the voice fails | pictures | dropped when `canPlayKorean()` is false or sound is muted (S7) |

**Level ladder** (`levelOrder` from F-LEARN-001; `null` is treated as 1):

| Level | Formats allowed | Options | Questions (Relaxed) | Distractors |
|---|---|---|---|---|
| 0 Pictures first | `word-to-image`, `audio-to-image` | **3** | 8 | any word of the topic (rule 1-4 of §3.3) |
| 1 Some reading | all three | 4 | 10 | rules 1-4 |
| 2 Reads easily | all three | 4 | 10 | rules 1-4 **plus** confusables (§3.3 rule 6) |

**Within the level, a word's box chooses the format** (`formatFor(box, allowed, canPlay)`, F-VOC-005 §3.4 defines boxes): box 0-1 -> `word-to-image`; box 2 -> `audio-to-image`; box 3 and above -> `image-to-word`; each step falls back to the nearest allowed format (`image-to-word` -> `audio-to-image` -> `word-to-image` for Pictures first; `audio-to-image` -> `word-to-image` when `canPlay` is false). A word repeated within one round uses a **different** format the second time.

### 3.3 The question builder (`apps/mobile/src/logic/vocab/question-builder.ts`, pure, 100 % covered)

```ts
export interface VocabOption { id: string; text?: { ko: string; romanization: string; en: string }; pictureRef?: string; labelEn?: string }   // the ListenPickOption shape (F-QUEST-002 §3.10)
export interface VocabQuestion {
  key: string;                                  // `q${index}:${itemId}:${format}`
  itemId: string;
  format: VocabFormat;
  prompt: { kind: 'word' | 'image' | 'audio'; ko?: string; romanization?: string; pictureRef?: string; spokenKo?: string; audioRef?: string };
  options: VocabOption[];                       // shuffled
  answerId: string;                             // equals itemId
  topicChip?: string;                           // the answer's primary topic key (the view shows its localised title), only when another item in the universe shares `ko` (homonym prompt in a mixed pool)
}
export interface BuildInput {
  pool: readonly RuntimeVocabItem[];            // the words to ask about, already in selection priority order (F-VOC-005 §3.6)
  universe: readonly RuntimeVocabItem[];        // every candidate for distractors (the topic; the whole catalogue for a mixed review)
  count: number; optionCount: 3 | 4; levelOrder: 0 | 1 | 2;
  boxOf(id: string): number;                    // 0..5
  seed: number; canRender(ref: string): boolean; canPlay: boolean;
}
export function buildQuestions(i: BuildInput): VocabQuestion[];
export function distractorsFor(answer: RuntimeVocabItem, format: VocabFormat, i: BuildInput): RuntimeVocabItem[];
export class NotEnoughWords extends Error {}
```

**Selection of what is asked.** Walk `pool` in order and take items until `count` questions exist; if the pool is shorter than `count`, cycle it again (second pass), never placing the same item in adjacent questions and never repeating a format for the same item. A **second pass never adds more than `count - pool.length` questions**, so a pool of 4 words and `count` 10 gives 10 questions of 4 words in 2.5 passes. Every format shows a picture (as prompt or as options), so an item whose picture does not resolve (`canRender` false) is **dropped** from the pool (a topic with such an item is not offered at all, F-VOC-003 T8, so this only guards a partial bundle).

**Distractor rules** (applied in order to the candidate list `universe` minus the answer; every rule except 1 and 2 *relaxes* if it would leave fewer than `optionCount - 1` candidates, in the reverse order listed):
1. **Sense**: drop every candidate with the same `ko` as the answer or the same `senseGroup` (so 눈 eye never faces 눈 snow, 언니 never faces 누나, 오빠 never faces 형). *Never relaxed.*
2. **Picture**: drop every candidate whose `visual` equals the answer's, and (picture formats) every candidate whose picture does not resolve. *Never relaxed.*
3. **Colours**: if the answer is a colour, drop any candidate that forms a pair with it in `COLOR_CONFUSION_PAIRS` (F-VOC-002 §3.4); colour options are always other colours of the same topic.
4. **Counts**: if the answer is a number, drop candidates whose count differs by less than 2 when `levelOrder === 0` (by less than 1 otherwise — i.e. never the same count), and exclude `zero` and `twenty` unless one of them is the answer.
5. **Picture family**: prefer candidates whose picture family (`card` / `word-food` / ... / `word-count` / `word-body`) equals the answer's, so a card art's different style never identifies the answer (F-VOC-002 §3.11). A preference, not a filter.
6. **Confusables** (level 2 only): prefer candidates whose first syllable's initial consonant or first syllable equals the answer's (`decomposeSyllable`, `packages/content-schema/src/romanization/hangul.ts`, exported by the package index), e.g. 곰 / 공 / 고양이. A preference.
7. **Same topic**: `universe` is the topic's items; a mixed review (F-VOC-005 §3.6) passes the catalogue and the builder prefers the answer's topic first.
8. Among the preferred candidates, take `optionCount - 1` with the seeded `shuffle` (`logic/shuffle.ts`); the answer is inserted and the option list shuffled with `seed + 1`.

**Amendments from the S-2 review** (the builder as merged):
- **Rule 6 reserves one slot** at level 2: one distractor is a confusable whenever one is left (behaviour 14 as a guarantee, not only a preference). The reserved word comes from the answer's picture family first; from another family only when the answer is not a colour, so rule 3 ("colour options are always other colours") holds in a mixed review too.
- **Format fallback.** When the box format cannot get `optionCount - 1` distractors (for example too few pictures resolve), or would show a card-art answer as the only card-style tile (rule 5, F-VOC-002 §3.11), the builder tries the other allowed formats this word has not had, `image-to-word` first (it needs no option pictures); a word is skipped only when no format can be built. If every format left shows the card alone (Pictures first has no `image-to-word`), the word is still asked (§8 item 11).
- **Seeds**: the builder reads a negative, fractional or non-finite `seed` as `abs(trunc(seed))` (non-finite as 0) before deriving question seeds; `logic/shuffle.ts` itself is unchanged, so replays stay byte-identical.
- **`count` below 1** returns `[]`; `NotEnoughWords` is thrown only when a positive `count` yields no question.
- **`COLOR_CONFUSION_PAIRS`** is read from `logic/vocab/color-confusion.ts`, an app copy that a test pins equal to the design-system list: Metro (Expo SDK 52) does not read package `exports`, so app code never imports a design-system subpath at runtime (a guard test scans `apps/mobile/src`).

**Properties** (each a test): every question has exactly `optionCount` options, unique `id`s, unique pictures (picture formats) and unique `ko` (word options); the answer is always present and `answerId === itemId`; no option shares a `senseGroup` with the answer; the same `seed` gives the same output; across 1,000 seeds the answer's position is uniform within +-5 % per slot; `buildQuestions` throws `NotEnoughWords` only when it can build **zero** questions, otherwise it returns as many as it can (fewer than `count`). With `canPlay` false there is no `audio-to-image` question. A homonym answer in a mixed universe carries `topicChip`.

`logic/shuffle.ts` exports the existing seeded LCG unchanged (`logic/round-builder.ts:16-25` becomes `import { shuffle } from './shuffle'`; the existing `round-builder.test.ts` must stay green untouched, which proves the move changed nothing).

### 3.4 The session reducer and the clock (`logic/vocab/speed-session.ts`, `session-clock.ts`, pure, 100 % covered)

```ts
export interface SessionConfig {
  mode: 'relaxed' | 'challenge';
  questions: VocabQuestion[];                  // built up front; Challenge builds 40 and stops at the clock
  clockMs: number | null;                      // null in Relaxed; 60000 * clockScale in Challenge
  hintsEnabled: boolean;                       // Relaxed only, and false when a screen reader is on (§3.6)
}
export interface QuestionResult { itemId: string; format: VocabFormat; correct: boolean; hinted: boolean; ms: number }   // ms = active time to the first tap
export interface SpeedState {
  phase: 'ready' | 'question' | 'reveal' | 'paused' | 'done';
  resumePhase?: 'question';                    // what 'paused' returns to
  index: number;                               // current question
  sparks: number;                              // S3: only ever increases
  results: QuestionResult[];                   // one per answered question, in order
  chosenId: string | null;                     // the first tap of the current question
  hint: 'none' | 'soft' | 'ring';
  elapsedMs: number;                           // active time on the current question
  remainingMs: number | null;                  // Challenge clock
  totalActiveMs: number;
  pauses: number; pausedMs: number;
  endedBy: 'questions' | 'clock' | 'quit' | null;
}
export type SpeedEvent =
  | { type: 'start' }
  | { type: 'tick'; dtMs: number }             // active time only; ignored outside 'question'
  | { type: 'answer'; optionId: string }       // only the first answer per question counts
  | { type: 'reveal-done' }                    // the caller's reveal beat (600 ms right, 1000 ms miss) has elapsed
  | { type: 'pause'; reason: 'user' | 'background' }
  | { type: 'resume' }
  | { type: 'quit' };
export function initSession(c: SessionConfig): SpeedState;
export function reduce(s: SpeedState, e: SpeedEvent, c: SessionConfig): SpeedState;
```

**Rules** (all enforced in `reduce`, none in the screen):
- `start`: `ready -> question`, index 0, timers zero, `remainingMs = clockMs`. The Challenge clock **starts with the first question's appearance**, not at the button.
- `tick(dtMs)`: only in `question`; adds to `elapsedMs` and `totalActiveMs`; in Challenge subtracts from `remainingMs`; when `remainingMs <= 0`: `phase: 'done'`, `endedBy: 'clock'`, **the current question is not appended to `results`** (S2). In Relaxed with hints: `elapsedMs >= 12000` -> `hint: 'soft'`; `>= 20000` -> `hint: 'ring'`.
- `answer(optionId)`: only in `question` and only when `chosenId === null` (first tap wins; a second tap during the reveal is ignored). Appends one `QuestionResult` with `correct = optionId === answerId`, `hinted = hint !== 'none'`, `ms = elapsedMs`; sets `chosenId`; `phase: 'reveal'`; **`sparks` increases by 1 iff `correct`** (a hinted right answer also lights a spark: the learner still found the word); nothing else changes `sparks`.
- `reveal-done`: `reveal -> question` with the next index, `chosenId: null`, `elapsedMs: 0`, `hint: 'none'`; or, when the index passes the last question, `phase: 'done'`, `endedBy: 'questions'`.
- **The clock does not run in `reveal` or `paused`** (S2): `tick` is ignored there, so the time spent reading the answer is free.
- `pause`: only in `question` (and `reveal` is allowed to finish first: a pause during `reveal` is queued and takes effect at `reveal-done`); sets `phase: 'paused'`, `pauses + 1`; `resume` returns to `question` and adds the paused wall time (`pausedMs` is informational, supplied by the caller's clock). **A paused round never expires.** `reason: 'background'` is issued by the app-state wrapper (§3.8).
- `quit`: `done` with `endedBy: 'quit'`; **no stars, no results screen**, but every answer already given was written live (§3.6).
- After `done` every event except `quit` is ignored (a no-op returns the same state object).

**Invariants** (a seeded randomised test of 500 event sequences asserts them after every step): `sparks` never decreases; `sparks === results.filter(r => r.correct).length`; `results.length <= questions.length`; on `endedBy: 'clock'` the last result belongs to a question that was answered before expiry; `remainingMs` never increases and never goes below 0; `phase: 'done'` is absorbing; **no event path produces a result with `correct: false` that the learner did not tap** (time-out never adds a miss).

`session-clock.ts` (pure): `clockFor(mode, scale)` -> `null | 60000 * scale`; `formatClock(ms)` -> `"0:42"` (seconds rounded **up**); `clockBar(ms, total)` -> a fill amount in 0-1 stepped to 1/60 so the bar moves at most once per second. The hook that drives `tick` (`screens/vocab/useSpeedClock.ts`) uses a 250 ms interval and a monotonic time source (`performance.now()`), sends `tick(dt)` only while `phase === 'question'`, and survives a tab throttled to 1 Hz (the delta is whatever elapsed, capped at 2 s so a long freeze does not end a round).

**Stars and caught** (`logic/vocab/stars.ts`, pure):

```ts
export function starsForRound(firstTryCorrect: number, answered: number): 1 | 2 | 3 | null   // null when answered === 0: nothing was played
// ratio >= 0.8 -> 3, >= 0.5 -> 2, else 1  (F-RVW-001 §3.1); the same table as `logic/reviews/star-calc.ts` when F-RVW-001 lands, with a test that both agree on 0..N inputs
export function summarize(results: QuestionResult[], cfg: SessionConfig, endedBy): RoundSummary
```

`firstTryCorrect` counts results with `correct && !hinted`; `caught` is the number of **distinct words** with a correct first-try result (a word asked twice and caught twice counts once). `answered === 0` -> `null` stars: the round was not played, no results screen, nothing is written, not even a `session` event (F-VOC-005's reducer has no `answered` field and would count a session). **A round with at least one answer always has at least 1 star** (S4).

### 3.5 The start sheet (`screens/vocab/VocabSpeedRoundScreen.tsx`, wireframe A)

- Shows the topic title and cover, **Relaxed selected** with its one-line explanation ("10 words. No clock."; the number is the level's question count, 8 for Pictures first), and, **only when the profile has `challengeMode` on**, a segmented control Relaxed | Challenge; when it is off, a quiet text switch **"Try Challenge"** with "Adds a 60-second clock. You can turn it off any time." — turning it on calls `setChallengeMode(profileId, true, 'start_sheet')` and reveals the control with Challenge selected for this round (an explicit action, S8). In Challenge the **clock scale** control (1x, 1.5x, 2x, labelled "Normal / A bit longer / Twice as long") is shown, default from `clockScale`, and a line "The clock stops while you read the answer."
- Primary button **Start** (>= `touchTarget.child`), secondary Back (top-left). Level, options and format mix are chosen automatically; nothing here mentions an age or a level name.
- **Words are chosen** by F-VOC-005 §3.6 `selectSpeedWords(...)` from the topic's collected words (due words first); the builder runs on Start with `seed = Date.now()` in the app and a fixed seed in tests.
- **Audio check** happens here: `canPlayKorean(getCapability())` and `!isMuted()` set `canPlay`; the sheet shows a calm line "No sound on this device — pictures and words only." when audio questions will be dropped.
- **Empty / error**: too few collected words -> the learn-first card of §3.1; builder returns zero questions -> "Nothing to play yet" with Back; storage unreadable -> progress treated as empty (the round still runs, answers write once hydration completes, `progress-store.ts:127-135`).

### 3.6 The question screen, reveal and results

**Question screen** (wireframes B, C, D, G):
- Header: Back (top-left, opens the stop sheet), the **spark meter** (`SparkMeter`: up to 10 slots in a row, filled with `brand.primary`-tinted sparks; extra sparks beyond 10 start a second row, to a maximum of 3 rows, then a "full of sparks" state; **fill-only: it never animates downward and has no empty-state reset**; in Relaxed it shows the question dots instead (a `Progress variant="dots"` of the round, fill-only) **and** sparks), and in Challenge the **clock**: a bar (steps of 1/60, tone `brand.secondary`, never red, no pulsing) and the digits ("0:42") with a **Pause** button (>= `touchTarget.min`). In Relaxed there is no clock element at all. At 320 wide Back + meter + Pause do not fit on one line (64 + 204 + 64 > 288), so the Challenge header has two lines: Back, the digits and Pause, then the meter (`reserveRows`) and the clock bar (design/components/SparkMeter/spec.md, "Width at 320 wide").
- Prompt zone by format (§3.2) and options below: a 2 x 2 grid for four pictures (each >= 96 dp, 8 dp gaps), a 1 x 3 or 3-across row for three, a 1-column list for four Korean words when the width is under 340 dp. At 320 x 568 the screen scrolls rather than shrinking tiles below the minimum (`Screen scrollable`).
- **Tap a right option** (first tap, within the first 50 ms rule of F-001 §3.4): the option turns `feedback.success` with a **check mark**, the word is spoken (`playPrompt`, `kind: 'word'`, `source: 'vocab-speed'`), its gloss in the UI language and romanization appear under the prompt, one spark lights (a single 300 ms scale-and-fade; instant under reduced motion), Hoya says a short encouraging line (`nudges.ts`), the reveal beat is **600 ms**, then the next question.
- **Tap a wrong option**: that option turns **amber** (`feedback.nudge`, `colors.feedback.danger` is never used) with a **non-colour mark** (a short horizontal dash), the **right option** gets the check and the success tone, the word is spoken, the gloss appears, Hoya shows pose `thinking` and says a gentle line ("That one is <gloss>. Next time!"), the **spark meter does not change**, the reveal beat is **1000 ms**, then the next question. No red, no "wrong", no buzzer, no loss.
- **Hints** (Relaxed only, `hintsEnabled`): at 12 s Hoya says "Take your time."; at 20 s a soft ring (a `border.focus` outline, not colour alone: a thicker border) appears on the right option. A hinted answer lights a spark but is not counted in `firstTryCorrect` (§3.4) and does not promote the word (F-VOC-005 §3.2). This is the **one place where elapsed time touches the schedule**, so it only ever *withholds a promotion* — it never demotes — and hints are **off when a screen reader is enabled** (`hintsEnabled = false`: the ring is invisible to a screen reader anyway, and a learner who needs more time must not be scheduled worse, F-VOC-005 P3). Challenge has **no hints** and no idle messages.
- **Audio failure** during an `audio-to-image` question: the prompt zone shows the word as text (Korean and romanization, no gloss) with "No sound? Read it here." (F-AUDIO-004 §3.8) and the question scores normally.
- **The clock ends** (Challenge): the screen fades to a calm interstitial "That's the time! Nice work." for 1 s and moves to the results; the unanswered question is not shown as missed.
- **Pause** (button, or the app going to the background): an overlay "Paused" with a **Resume** button (>= `touchTarget.child`) and "Stop"; the question is hidden so a pause cannot be used to study the answer (the prompt is replaced by the overlay) — in Relaxed there is no clock, so a Pause button is not shown (leaving the app simply continues).
- **Stop sheet** (Back, system back): "Stop for now?" with "Keep playing" / "Stop"; Stop discards no progress: answers already given stay written and no results screen is shown.

**Results screen** (`VocabResultsScreen.tsx`, wireframe H):
- Hoya `cheering` and a `StarRow` with `stars` (1-3, **never empty stars for a 1-star round**, F-STORY-004 §3.4's pattern), the line **"N words caught"** (a plain count of distinct words), and in Challenge **"New best!"** only when `caught` exceeds the learner's earlier Challenge best for this topic. No percentage, ratio or fraction, no time-per-word, no comparison with anyone else, no "accuracy". The line for a round that ended on the clock reads "Time's up — here is what you caught."
- **Words to see again**: a horizontal list of the words answered wrongly as tiles (picture, Korean with romanization, gloss), under the neutral heading "Words to see again" (never "missed", "wrong", "failed"); a primary button "Practise these" -> `VocabCards` limited to those words, and **Play again** (primary when there are no such words), **Back to topic**. A learner with no missed words sees no such list.
- **Not shown**: caregiver numbers (accuracy %, average time, stars histogram) — those go to the summary (F-VOC-005 §3.8).

**What each answer writes** (F-VOC-005's single action, as the answer happens, so a closed app loses nothing): `{ type: 'answer', id, correct, format, source: 'speed', ms, hinted }`; at the end `{ type: 'session', topicKey, kind: 'speed', stars, caught, mode, endedBy }` (`stars` and `caught` update the topic's `bestStars` and, in Challenge, `bestCaught`, F-VOC-005 §3.2). A `quit` writes no session event.

### 3.7 Encouraging nudges (`logic/vocab/nudges.ts`, pure; D3)

`nudgeFor(event, sparks, seed)` returns one Hoya line (`VOCAB_COPY`, English until F-I18N-001's catalog exists) chosen from fixed sets; sets are rotated deterministically by `sparks` so the same line never plays twice in a row. Events and examples (placeholder copy):

| Event | Pose | Examples |
|---|---|---|
| right answer | `cheering` (brief) | "Got it!" · "Nice catch." · "Yes, <gloss>!" |
| milestone: sparks 3, 5, 8, 10 | `cheering` | "3 sparks!" · "Look at that glow." · "Full of sparks!" |
| gentle miss | `thinking` | "That one is <gloss>. Next time!" · "Good try. Now you know <gloss>." |
| idle 12 s (Relaxed) | `idle` | "Take your time." |
| round start | `idle` | "Ready when you are." |
| results (3 stars / 2 / 1) | `cheering` / `cheering` / `idle` | "Wow, a bright round!" / "Nice round." / "Good round. Every word helps." |
| results with **no** first-try right answer (1 star) | `thinking` | "Good try! You collected a star!" (the line and pose of F-RVW-001 §3.1) |

**Never produced**: any line naming a number of misses, a lost spark, "streak", "combo", "lives", a percentage, an age, or a comparison with another person. The test scans every line with `scanLearnerCopy` plus the `\d+%` and `\d+/\d+` regexes plus a word list (`streak`, `combo`, `lives`, `lose`, `lost`, `wrong`, `fail`). Messages about **days in a row** are Home's (F-VOC-005 §3.7), not the round's.

### 3.8 Accessibility, timing and "no flashing"

- **The clock is optional, adjustable, pausable and has no trap** (WCAG 2.2.1). Challenge is off by default and a profile-level opt-in (S8); the **scale** (1x / 1.5x / 2x) is a setting; **Pause** is always present in Challenge and a paused round never expires; **Relaxed has no clock**. A learner can leave Challenge at any time (the start sheet switch, the Profile switch).
- **Screen readers**: when `AccessibilityInfo.isScreenReaderEnabled()` is true and the learner turns Challenge on, the start sheet pre-selects **2x** and says so; the clock is **not** a live region (no ticking announcements); the digits are reachable as a single control "Time left: 42 seconds" that is read on focus only; the spark meter is announced politely at most once per question ("3 sparks"); the feedback line is a polite live region; after each advance **focus moves to the prompt** (the speaker button for sound questions); each option is a button with its label (pictures: the gloss, which is allowed, F-QUEST-002 §3.14: "picture options excepted"); the right/wrong state is announced in words ("Right. Apple." / "Not this one. The answer is apple.").
- **No flashing** (WCAG 2.3.1): no element changes more than three times a second; the spark is a single 300 ms scale-and-fade; the clock bar moves in 1-second steps, **does not blink, pulse, shake or change colour** as time runs low (the last 10 seconds only add the static words "A few seconds left"); no screen shake; no full-screen colour flashes; under `useReducedMotion` all of it is instant.
- **Colour is never alone**: right = success tone + check, miss = amber + a dash, hint = a thick border; the `vocab.*` swatches are paired with objects (F-VOC-002 §3.4). Contrast of feedback text follows the existing tokens (`tokens.ts:50-60`, AA tested in `contrast.test.ts`).
- **Targets**: picture options >= 96 dp (`touchTarget.hero`), word options >= 80 (`touchTarget.child`), Pause / Resume / Back >= 64 (`touchTarget.min`); a second tap during the reveal is ignored; double-tap protection per F-001 §3.4.
- **Sound**: no ticking, no countdown beeps, no alarm; only the spoken word and (when F-AUDIO-004's sound tokens exist) a soft positive chime on a right answer. Sound off keeps every visual cue (blueprint 06 §0.4). Haptics (`platform/haptics`: `success`, `nudge`, `tapLight`) follow `ui-store.hapticsOn`.
- **Background and rotation**: the app going to the background issues `pause('background')` (Challenge) through `platform/app-state.ts` (`AppState` on native; `visibilitychange` in `app-state.web.ts`; both behind `subscribeAppActive(cb): () => void`, unit-tested with an injected source, coverage lane 70 %); rotation re-lays out without losing state (the reducer owns it).
- **Small and large screens**: 320 x 568, landscape and 200 % text: the question scrolls, the options keep their minimum size, the Pause control stays reachable (sticky header).
- **Offline**: everything is bundled; the round works fully offline (audio per F-AUDIO-004's fallback).
- **Tone (D1, D3)**: plain Pre-A1 English; no age words; no "kids"; Hoya warm, not babyish; no red; no percentage, ratio or fraction anywhere a learner reads; no streak, combo or lives.

### 3.9 The vocabulary host and shared pieces

- `store/vocab-run-store.ts` (F-VOC-003 §3.9) already implements F-QUEST-002's `MinigameHost` for Match; the Speed Round reports through the same `recordVocab` action but **does not use `MinigameScreen`** (its own routes, its own reducer).
- **`VocabQuestionView`** (`screens/vocab/VocabQuestionView.tsx`): the prompt-plus-options view used by the Speed Round (`mode: 'speed'`, one try, reveal beats) and the Quick check of F-VOC-003 (`mode: 'check'`, try again until right, no clock, no sparks). It takes `{ question, mode, onAnswer(optionId), canPlay, romanizationShown, host }`; its decisions are the pure `question-flow.ts` reducer (`mode`-dependent: whether a wrong tap locks and continues, or locks and stays), covered 100 % like the others.
- `SparkMeter` (design-system, `components/SparkMeter/`): props `{ value: number; slots?: number (default 10); maxRows?: number (default 3); reserveRows?: boolean (default false; holds the height of all rows so the question never moves, used in Challenge); accessibilityLabel: string }`; the pure `sparkLayout(value, slots, maxRows)` -> `{ filled, rows, full }` lives in `src/` next to the component and is unit-tested (design-system coverage counts `.ts` outside `components/`, so the layout function is placed in `src/spark.ts`).

### 3.10 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `schemas/telemetry.ts:9-50`, and to `specs-out/TELEMETRY-NAMES-2.md` section G; convention: lifecycle `.start`/`.complete`, discrete action in the past tense, namespaced)

| Name | Payload | When |
|---|---|---|
| `vocab.round.start` | `{ topicKey, mode: 'relaxed' \| 'challenge', clockScale: 1 \| 1.5 \| 2 \| null, optionCount, level, questions, audio: boolean }` (`level` = `levelOrder`, never an age; `clockScale` null in Relaxed) | Start is tapped |
| `vocab.round.complete` | `{ topicKey, mode, endedBy: 'questions' \| 'clock', answered, firstTryCorrect, hinted, caught, stars, pauses, activeMs, newBest: boolean }` | the results screen shows (never for `quit` or `answered === 0`) |
| `vocab.challenge_toggled` | `{ on: boolean, source: 'profile' \| 'start_sheet', clockScale }` | Challenge is switched on or off |

Internal numbers (`firstTryCorrect`, `answered`) are allowed in telemetry and for caregivers; they are **never rendered** on a learner screen. The PR adding the names ships and deploys first (Worker before app) and updates the exact-list test (`packages/content-schema/src/__tests__/telemetry.test.ts:5-49`). No event carries a name, free text or a question's content.

### 3.11 Behaviours (Given / When / Then)

1. **Given** a profile that has not opted in, **when** the start sheet opens, **then** Relaxed is selected, no clock element exists on the question screen, and the only Challenge affordance is the quiet "Try Challenge" switch.
2. **Given** Relaxed and the Pictures-first level, **then** the round has 8 questions of `word-to-image` and (when a voice exists) `audio-to-image`, each with 3 options.
3. **Given** `canPlayKorean()` false, **when** the round is built, **then** no question is `audio-to-image` and the start sheet shows the calm no-sound line.
4. **Given** a right first tap, **then** the option shows a check, one spark lights, the word is spoken, and after 600 ms the next question opens; **given** a wrong first tap, **then** that option is amber with a dash, the right one is marked, the spark meter is unchanged, no number of misses is shown, and after 1000 ms the next question opens.
5. **Given** any sequence of answers, **then** `sparks` equals the number of right answers and never decreases.
6. **Given** Challenge with 60 s, **when** the clock reaches zero on an unanswered question, **then** the round ends, the results show stars for the answered questions, and the unanswered question is neither recorded nor shown as missed.
7. **Given** Challenge, **when** an answer is revealed for 1000 ms, **then** `remainingMs` does not change during the reveal.
8. **Given** Challenge, **when** the app goes to the background, **then** the round pauses; **when** the learner returns and taps Resume, **then** the remaining time is what it was and the question is shown again.
9. **Given** a screen-reader user who turns Challenge on, **then** the scale pre-selects 2x, no clock ticks are announced, and "Time left" is read on focus only.
10. **Given** 7 of 10 questions answered right first try (and nothing hinted), **then** the round earns 2 stars; **given** 8 of 10, 3 stars; **given** 0 of 10, 1 star and Hoya `thinking` says "Good try! You collected a star!" (F-RVW-001 §3.1); **given** no question answered, no stars and no results screen.
11. **Given** a round where `caught` exceeds the stored Challenge best, **then** the results say "New best!" and `bestCaught` is raised; **given** it does not, no comparison appears.
12. **Given** a pool of 4 collected words and `count` 10, **then** the builder returns 10 questions, never the same word twice in a row and never the same format twice for one word.
13. **Given** an answer 눈 (eye) in a topic-mixed review, **then** 눈 (snow) is never an option, and the prompt carries a topic chip.
14. **Given** `levelOrder === 2`, **then** at least one distractor per question shares the answer's first syllable or initial when such words exist.
15. **Given** the learner taps Stop, **then** no results screen is shown and every answer already given is stored.
16. **Given** the results of a round with missed words, **then** the heading is "Words to see again" and no learner string contains "wrong", "missed", "failed", "%" or a fraction.

## 4. Out of scope

- Snap (the Match / Not-match format), Mix mode, multi-topic rounds (v1.1).
- Leaderboards, class rankings, sharing a score, daily challenges, streak freezes (forbidden or later).
- A per-question timer of any kind; lives, hearts, ticking sounds.
- Cards or stickers per topic (S10).
- Adaptive stakes (raising the difficulty after a streak) — F-RVW-001 §4 keeps it out.
- Recorded audio for every word (F-AUDIO-004 PR A-10, owner task T-017).
- Teacher-facing live play (F-TCH-004's lecture presenter may reuse the builder later).
- Voice answers (speech recognition).

## 5. Tests

| File | Level | Coverage focus |
|---|---|---|
| `logic/vocab/__tests__/question-builder.test.ts` | unit, 100 % | the properties of §3.3 incl. seed determinism, 1,000-seed position uniformity, sense groups (눈, 배, 언니/누나, 오빠/형), colour confusion, count neighbour rule at level 0 and 1, picture-family preference, confusables at level 2 (곰 / 공), `canPlay` false, unresolved pictures, pool shorter than `count`, `NotEnoughWords`, `topicChip` |
| `logic/vocab/__tests__/format-for.test.ts` | unit, 100 % | the box x level x `canPlay` table incl. every fallback chain |
| `logic/vocab/__tests__/speed-session.test.ts` | unit, 100 % | every event in every phase; the invariants of §3.4 over 500 seeded random sequences; time-out records nothing; reveal and pause freeze the clock; pause during reveal queues; absorbing `done`; hints only in Relaxed; first answer wins |
| `logic/vocab/__tests__/session-clock.test.ts` | unit, 100 % | `clockFor`, `formatClock` (rounds up), `clockBar` steps |
| `logic/vocab/__tests__/stars.test.ts` | unit, 100 % | the F-RVW-001 table at 0.5 and 0.8 boundaries for N = 1..20; `null` for 0; `summarize` (caught counts distinct words, hinted excluded from first-try); equality with `logic/reviews/star-calc.ts` when it exists |
| `logic/vocab/__tests__/nudges.test.ts` | unit, 100 % | no repeats in a row; every line passes `scanLearnerCopy`, the `%` and fraction regexes, and the forbidden-word list |
| `logic/vocab/__tests__/question-flow.test.ts` | unit, 100 % | `mode: 'speed'` (one try) vs `'check'` (retry until right) |
| `logic/__tests__/shuffle.test.ts` and the existing `round-builder.test.ts` | unit | the move is behaviour-neutral (the old file passes unchanged) |
| `platform/__tests__/app-state.test.ts` | unit, platform lane | `subscribeAppActive` with an injected source |
| `design-system/src/__tests__/spark.test.ts` | unit | `sparkLayout` rows, cap, `full`, never negative |
| `content-schema/src/__tests__/locale.test.ts` (extended) | unit | `challengeMode` / `clockScale` defaults and rejection of other scales |
| `content-schema/src/__tests__/telemetry.test.ts` (extended) | unit | the exact list gains the three names |
| `e2e/web/vocab-speed.spec.ts` (Playwright) | e2e | Relaxed round to results: stars and "N words caught", no `%` or `n/m` in the DOM; Challenge on: clock shows, Pause and Resume, clock expiry ends the round; screen-reader mode (role queries): no live clock; sound off and no-voice keep visuals; reduced motion; the same flow offline; flag off: no route |

Coverage targets (CLAUDE.md §6): `apps/mobile` business logic **90 % -> 100 %** (everything above is under `src/logic/`, `apps/mobile/vitest.config.ts:33`); platform wrapper 70 %; `packages/content-schema` 100 %; design-system 85 %.

## 6. Rollout and PR breakdown (dependency order)

| # | PR | Size | Depends on |
|---|---|---|---|
| S-1 | `feat(content-schema)`: `ProfileSettings.challengeMode` / `clockScale`; telemetry names (`vocab.round.start`, `vocab.round.complete`, `vocab.challenge_toggled`) with tests; **ship and deploy the Worker first** | S | F-I18N-001 PR 1 (merged #100) |
| S-2 | `refactor(mobile)`: `logic/shuffle.ts` (pure move) + `logic/vocab/question-builder.ts`, `format-for.ts`, with tests | M | F-VOC-001 V-3, F-VOC-002 W-1b (`COLOR_CONFUSION_PAIRS`, exported from `@hangul-route/design-system/word-art`; until then the colour rule reads an empty list) |
| S-3 | `feat(mobile)`: `speed-session.ts`, `session-clock.ts`, `stars.ts`, `nudges.ts`, `question-flow.ts`, `VOCAB_COPY` additions, tests | M | S-2 |
| S-4 | `feat(design-system)`: `SparkMeter` + `src/spark.ts` + test (design mock in `design/components/` first, CLAUDE.md §5) | S | — |
| S-4b | `feat(mobile)`: the shared `screens/vocab/VocabQuestionView.tsx` (prompt plus options in `speed` and `check` mode, pure decisions already in S-3's `question-flow.ts`), design mock in `design/screens/vocab/` first; **F-VOC-003's quick check (C-5) uses it, so it must not wait for the Speed Round screens** | M | S-3, S-4, F-STORY-003 PR 3.3 (`ChoiceCard`), F-I18N-001 PR 4 (`KoreanText`), F-VOC-002 W-7 (`PictureArt`) |
| S-5 | `feat(mobile)`: `platform/app-state(.web).ts`, `useSpeedClock`, `VocabSpeedRoundScreen`, `VocabResultsScreen` (design mocks first), routes, store wiring to `recordVocab`, telemetry emits, e2e. **Merges only after the F-VOC-005 P-1 Worker deploy** | L | S-4b, F-VOC-003 C-4, F-VOC-005 P-1 (deployed), P-2a and P-2b (`selectSpeedWords`), F-AUDIO-004 PR A-3 |
| S-6 | `feat(mobile)`: Challenge mode — the settings setters in `locale-store`, the start-sheet switch and clock scale, the Profile switch, the clock UI and pause overlay, e2e additions | M | S-5, F-I18N-001 PR 3 |

(Order inside the feature: S-1..S-4 can land in parallel and independently of any UI; S-4b follows them and unblocks F-VOC-003's quick check. S-5 ships Relaxed only; S-6 turns Challenge on, so a problem with the clock never blocks the base round.) Rollback: the flag; Challenge alone is switched off by hiding its control (`challengeMode` constant false).

Estimated effort: about 8-10 working days.

## 7. Dependencies

- **Upstream**: F-VOC-001/002/003/005; F-RVW-001 §3.1 / §3.7 (rules); F-AUDIO-004 (`canPlayKorean`, `playPrompt`, prompt-state); F-STORY-003 PR 3.3 (`ChoiceCard`); F-I18N-001 PR 3-4 (settings store, `KoreanText`); F-LEARN-001 (`levelOrder`); `decomposeSyllable` from F-CNT-002 PR 1 (merged).
- **Downstream**: F-VOC-005 (the answer events feed the schedule), F-RVW-001's Daily Test (reuses `buildQuestions` with `universe` = the catalogue), F-PLC-001 (placement may reuse the builder and the `formatFor` ladder), F-TCH-004.

## 8. Unverified assumptions and open items

1. **The 60-second Challenge length and the 600 / 1000 ms reveal beats** are from the design input and the existing 700 ms auto-advance (`CultureQuizGame.tsx:52`); they have not been play-tested with learners. The telemetry (`activeMs`, `answered`) lets them be tuned; the scale control covers needs.
2. **The star thresholds on a Challenge round with very few answers** (two answers, both right, is 3 stars) are exactly F-RVW-001's formula; if it feels generous in testing, a minimum of answered questions for 3 stars is a one-line change in `starsForRound`.
3. **`feedback.nudge` amber and a dash mark** are assumed distinguishable for common colour-vision types because of the mark, not the hue; the F-QUEST-002 §9 notes the same assumption for its games.
4. **`AccessibilityInfo.isScreenReaderEnabled()`** on react-native-web is assumed to report a reasonable value; not verified. The scale pre-selection is a convenience, not the only protection.
5. **A timer behind a throttled background tab** (Safari/Chrome throttle timers): the 2 s cap on a tick delta and the `visibilitychange` pause are assumed enough; not tested on device.
6. **Leitner box thresholds and the mapping box -> format** are from the design input and F-VOC-005; whether a 2-box ladder (picture, then sound, then picture-to-word) suits adults is unmeasured.
7. **The Pictures-first level gets 3 options** (design input: "3 picture options" for the youngest); with only 4 collected words in a topic the same builder works at both counts.
8. **`logic/reviews/star-calc.ts` does not exist yet** (F-RVW-001 is `draft`); `logic/vocab/stars.ts` duplicates its table and a test pins them together once both exist.
9. **`HoyaBubble` and Hoya poses** (`idle`, `cheering`, `thinking`) are assumed available as in the existing game (`CultureQuizGame.tsx:101`); no new pose is added.
10. **Seeding with `Date.now()`** means two rounds started in the same millisecond are identical; irrelevant to learners, and tests pass a seed.
11. **호랑이 is the only card art in the Animals topic.** At levels 1 and 2 the builder asks it as `image-to-word`, so its card style never gives the answer away; at Pictures first (no `image-to-word`) its picture question still shows it as the one card-style tile. The content fix is a WordArt glyph `word:animal-tiger` (F-VOC-002 §3.11 exit), after which the topic has no lone card.
