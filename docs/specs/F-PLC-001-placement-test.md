Status: ready

# F-PLC-001 — Placement (the level check): choose a test language, answer 12 to 21 adaptive questions, start the route at the right spot

> Start order: P-1 (shared question engine) and P-2 (schemas, telemetry names) have no external dependency and can start now; P-2 must be **deployed to the API before** any app build that sends the new snapshot or summary fields (section 3.8). P-4 (bank content) needs native-speaker review of the Korean sentences before items become `ready` (section 9). The route integration (P-5) works against today's 8 Stage 1 quests and against F-QUEST-002's 15 without code change; the full mapping table of section 3.6 is tested against a 15-quest fixture now and against the real bundle once F-QUEST-002 Q-6b lands.

**Scope**: `packages/content-schema` (new `src/assessment/` shared question engine, new `src/placement/` adaptive engine and route seed, `schemas/placement.ts`, additive `ProgressSnapshot` / `ProgressSummary` fields, telemetry names) · `content/placement/` (question bank, JSON-first, D4) · `content/i18n/{es,ko}/placement.json` (overlays) · `scripts/` (bank builder and validator rules) · `apps/mobile` (`logic/placement/`, `store/placement-run-store.ts`, `screens/placement/`, onboarding fork, Home / Profile / Journey / Parent changes, flag) · `apps/web` (`lib/console/placement.ts`, roster line, advisory plan hand-off) · `packages/i18n` (strings under `learner.placement`, `caregiver.placementReport`)
**Owner**: solo dev
**Rollout**: after F-I18N-001 PR 4 (`KoreanText`) and F-AUDIO-004 A-4 (`playPrompt`, `getCapability`, `canPlayKorean`), in parallel with F-QUEST-002; behind `flags.placementEnabled` (default off). PR order in section 6.
**Wireframes**: `wireframes/placement.md` (drafted with this spec) -> promoted to `design/wireframes/placement/` (`invite`, `language`, `options`, `warmup`, `item`, `pause`, `result`, `report`, `home-entry`)

Parent / siblings: CLAUDE.md section 1 (levels, languages, anti-shame, grid) · F-RVW-001 (**shares one question engine, section 3.3 and appendix B**) · F-LEARN-001 (level labels, `levelOrder`) · F-I18N-001 (`getMessages(locale)` with an explicit locale, `LOCALE_META`, `romanizationShown`, overlays) · F-AUDIO-004 (`playPrompt`, `canPlayKorean`, spoken forms) · F-QUEST-002 (the 15 Stage 1 quests and 30 symbols, confusables, Listen & Pick, the Hangul Check) · F-CNT-001 / F-CNT-002 (validator, romanization) · F-STORY-004 / F-STORY-005 (`reachedStage` takes the placement as a floor; shelf stories never gated) · F-PLAN-001 / F-PLAN-002 (plans; the planner reads the level) · F-PAR-001 (parent dashboard) · F-TCH-001 (roster, no ranking) · F-HW-001 (3-card home, anti-shame) · F-PROF-001 (profiles) · design input `design-inputs/level-test.md` · blueprint 02 section 2 (diagnosis), blueprint 04 section 8.1 (motivation -> theme order), blueprint 05 section 1.4 (Stage 1 completion), section 3.3 (sentence patterns)

---

## 1. Context

There is no placement today. A new learner always lands in the first shipped quest, the Journey cursor is "the first quest in content order that is not done", and nothing lets a learner who already reads some Hangul skip what they know. The decision D10 (owner, 2026-10-10) asks for a 12 to 21 question adaptive check, at most 6 minutes (shorter for *Pictures first*), over five skills, in a test language the learner picks, that **never moves the route cursor backwards, grants no cards or stars, and seeds the route**; teachers can only advise; the engine is shared with F-RVW-001.

What exists (verified on the working tree, `main` after PRs #91-#97):

- **First quest is hard-wired.** `firstQuestFor` returns the first quest of the lowest-ordered `shipped` episode (`apps/mobile/src/logic/onboarding/first-quest.ts:17-37`); `CreateProfileScreen` sends every new profile to `FirstQuestPreview` (`screens/onboarding/CreateProfileScreen.tsx:79`), whose button resets the stack to Main plus `QuestPlayer` (`screens/onboarding/FirstQuestPreviewScreen.tsx:30-41`). The onboarding stack has exactly Welcome, CreateProfile, FirstQuestPreview (`navigation/onboarding.tsx:12-16`, `navigation/types.ts:39-43`).
- **The cursor is the first unfinished quest.** `nextQuest` offers quests of `shipped`/`ready` episodes and returns the first without `completedAt`, else the last offerable (`logic/homework/mission-builder.ts:100-119`); Home card (2) uses it (`:204-217`) and `mergeAssignments` lets an assignment replace it (`logic/homework/assignment-merger.ts:47-88`). It does not consult the tier: a free learner is offered Stage 2 and Stage 4 taste quests today.
- **Completion drives everything a grown-up sees.** `recordQuestComplete` writes `QuestProgress`, closes open assignments and notifies sync (`store/progress-store.ts:184-204`); `summarize` counts `stage1.questsDone`, accuracy, `jamoRecognized` from completed quests (`logic/sync/summarize.ts:44-84`); an episode is complete only when every quest has `completedAt` (`logic/journey.ts:29-38`). A placement that wrote fake completions would award cards and stars, close homework and falsify the dashboards, so the result needs its **own record**.
- **Where a record can live.** `ProgressSnapshotSchema` is a plain object (`packages/content-schema/src/schemas/progress.ts:77-88`); every collection is merged by id (`apps/mobile/src/logic/sync/merge.ts:80-98`) and `isSubsetOf` decides whether an upload is needed (`:101-111`); `ProgressSummarySchema` is the only column grown-ups read (`schemas/sync.ts:15-38`, `schemaVersion: z.literal(1)`); the Worker parses both with zod, which **drops unknown keys** (`SnapshotPutSchema`, `schemas/sync.ts:49-56`; the route stores `payload: body.snapshot`, `routes/sync.ts:49-79`), hence server first, app second (REVIEW-1 section 3, telemetry rule 1). The class roster returns `summary` only (`packages/backend/src/routes/spaces.ts:361-390`, row type `apps/web/src/lib/console/api.ts:25-34`).
- **Levels and locales are already modelled.** `LEARNER_LEVELS` and `levelOrder()` (`schemas/learner-level.ts:32-36, 58-60`; 0 = *Pictures first*); `UI_LOCALES = ['en','es','ko']`, `RomanizationMode = 'always' | 'tap'` (`schemas/locale.ts:10-17`). F-I18N-001 gives `getMessages(locale)` with an **explicit locale** (so the test language need not equal the UI language) and the overlay pipeline for content.
- **Audio is not guaranteed.** `speak` has `language?: 'ko-KR' | 'en-US'` and wires `onDone`, `onStopped` and `onError` to the same callback (`platform/audio.ts:19-24, 36-38`); F-AUDIO-004 adds `playPrompt` with a result and `canPlayKorean(getCapability())`; F-QUEST-002 section 3.12 fixes the spoken forms (a consonant is spoken with a carrier vowel, not by its letter name).
- **Shared building blocks exist as specs.** F-QUEST-002 provides the 30-symbol accounting (14 consonants, 10 vowels, 6 finals, taught once, in 10 quests), the confusable table (section 3.9), Listen & Pick (section 3.10), `ChoiceCard` and `KoreanText`. Seeded shuffle exists privately in `logic/round-builder.ts:16-25`.
- **Premium.** `FREE_STAGES = {stage1}` (`logic/entitlement.ts:16, 31-33`); D5: no new gating of stories or vocabulary; one `isFreeContent(kind, id)` (F-STORY-004).
- **Review engine is a draft** (F-RVW-001 `Status: draft`, section 3.5: pure engine under `apps/mobile/src/logic/reviews/`, 100 % branch) and calls "adaptive difficulty" an anti-pattern (section 4). That line targets raising stakes on a streak; section 3.3 and appendix B clarify it.

**What this spec does.** (1) A shared, pure **question engine** (`packages/content-schema/src/assessment/`) that placement and F-RVW-001 both use; (2) a pure **adaptive placement engine** (seven rungs of three questions, a 12-question floor and a 21-question ceiling) with scoring, a level on the 7-stage grid and a mapping onto F-QUEST-002's Stage 1 quest list; (3) a **question bank** (`content/placement/*.json`, 265 templates in the initial outline) validated like all content, English first, Spanish and Korean as overlays; (4) the **screens** (test language, options, warm-up, items, pause, result), the onboarding fork "I already know some Korean", the Home "Take the level check" card, Profile and parent entries; (5) `seedRoute`, the **route seed** that tells the Journey cursor, the first-quest preview, the curriculum planner and the summaries where this learner starts, without writing a single completion; (6) retake rules, the **parent report and in-app override**, the **console roster line** and the advisory hand-off to the plan builder.

Terms. **Rung**: one gate of three questions (`recog`, `sound-basic`, `syl-cv`, `sound-rest`, `syl-cvc`, `vocab`, `sentence`). **Form**: `decode` (needs reading Hangul), `read` / `oral` (vocabulary and sentences by reading or by listening). **Strand**: one of the five skills (`hangul-recognition`, `sound-letter`, `syllable-reading`, `vocabulary`, `sentences`). **Symbol key**: `'ㄱ'` for a consonant or vowel, `'ㄱ/final'` for a final (F-QUEST-002 section 3.7). **Placed out**: a quest the cursor skips; it stays playable, awards normally, and is never marked done. **Route seed**: the pure output of `seedRoute`. **Start quest**: the first playable grid quest that is neither placed out nor done.

## 2. User story

> As someone who already knows some Korean — a child who understands what grandma says, a teenager who learned the letters from a video, an adult who reads Hangul slowly — I want a short, friendly check in my own language that finds where to begin, so that I do not repeat what I know and do not start somewhere too hard.

Companion stories:

- As a **learner with no Korean**, I want to say "I am new to Korean" in one tap and never be tested.
- As a **parent**, I want to see which skills are secure and which are new, to change the starting point if the check got it wrong, and to take the check again later, without my child ever seeing a score.
- As a **teacher**, I want each student's starting spot on the roster and a way to suggest a different one, without any ranking and without changing what is on the student's device.
- As a **maintainer**, I want one question engine for placement, daily reviews and the Hangul Check, so a new question type is data plus one renderer.

## 3. Acceptance criteria

### 3.1 Flow and screens (wireframe `placement.md`)

Screen ids: `placement/invite`, `placement/language`, `placement/options`, `placement/warmup`, `placement/item`, `placement/pause`, `placement/result`, `parent/placement-report`; changed: `onboarding/first-quest-preview`, `home/todays-mission`, `journey/grid`, `profile/settings`, `parent/dashboard`, `console/roster`.

1. **Fork (`placement/invite`).** Inserted after CreateProfile and before FirstQuestPreview (`CreateProfileScreen.tsx:79` becomes `navigation.replace('PlacementInvite', { profileId })` when `flags.placementEnabled`; the route is added to `navigation/onboarding.tsx` and `OnboardingStackParamList`). Two big choices, equal weight: **I am new to Korean** (-> `FirstQuestPreview`, unchanged, records only `placement-ui:<profileId>.declinedAt`, fires `placement.skipped`) and **I already know some Korean** (-> `placement/language`). A small line says it takes about 4 to 6 minutes and can be stopped at any time. Nothing here is a test of the grown-up; the screen works for a child alone (large targets, spoken prompt).
2. **Test language (`placement/language`).** Shown only when more than one locale is shipped (`availableLocales()`, F-I18N-001); with English only, the screen is skipped and `testLocale = 'en'`. Tiles show endonyms (English, 한국어, Español) from `LOCALE_META`. Default selection = the effective UI locale (profile override, else device, else detected). Tapping a tile selects it and plays one short spoken instruction in that language (`playPrompt` with `LOCALE_META[l].speechLang`; silent if unavailable). A tile for a locale whose voice cannot be played is still selectable for **en** and **es** (their instructions are also written); `ko` is disabled with the line "No Korean voice on this device" when `canPlayKorean(getCapability())` is false, because Korean instructions on reading items are audio-only (section 3.2). The choice sets `testLocale` for this run only; it never changes the UI locale or any profile setting.
3. **Options (`placement/options`)**, one screen, three groups:
   - **Length**: *Quick (about 4 minutes)* or *Full (about 6 minutes)*. Pre-selected by `levelOrder(profile.ageGroup)`: 0 -> Quick, 1 and 2 -> Full.
   - **Sound guide** (D2): two plain choices, *Always show it* and *Show it only when I tap*. The one **pre-selected is the learner's current setting** (`ProfileSettings.romanizationMode`, F-I18N-001; it is read here to pre-select and is never written; while the setting is its default the pre-selection is *Always show it*). Neither choice is recommended, highlighted or described as better. One neutral sentence states the consequence: "With the guide shown, the check looks at shapes and listening. With it hidden until you tap, it can also look at reading. Your own setting is not changed." NEXT is enabled from the start because a choice is always pre-selected. Choosing *Always* limits the check to listening and pictures (section 3.2).
   - **Take my time** (switch, off): removes the inactivity pause and the session backstop clock. Pre-set to on when a screen reader is on (`AccessibilityInfo.isScreenReaderEnabled()`, read in `platform/`).
   - Optional **Why Korean?** four icon choices (my family, K-culture, just curious, a Korean friend; blueprint 02 section 2.2 step 2) + "Skip". It only sets the theme order of the route (blueprint 04 section 8.1).
4. **Warm-up (`placement/warmup`).** One unscored question (`pitem:warmup-rice`: hear a word, tap the picture) with Hoya showing how it works. It checks audio: `playPrompt` result `unavailable` sets `config.audio = false` for the whole run (audio-required templates leave the draw; section 3.5) and shows a one-line "No sound here, so we will use pictures and reading". It is not recorded in the result.
5. **Items (`placement/item`).** Each question: Hoya line (one short sentence), the prompt (picture, Hangul via `KoreanText`, or a speaker button), 2 to 4 `ChoiceCard`s, a quiet **I am not sure** button (same size as a choice, never red), a **footstep trail** that only fills (no count), and a visible **Let us start learning** exit (section 3.5, stop reason `quit`). Answers are final: no right or wrong feedback, no retry, no hint; a neutral "Got it" and the next question. Every third answer Hoya says an encouraging line (rotating, in `learner.placement.cheer`), regardless of correctness. The prompt of the first question of a rung plays on tap (first audio needs a gesture); later ones play on open. "Hear it again" is unlimited. There is no per-question timer (D3): a question stays open until it is answered or the learner taps **I am not sure** (recorded `skipped`). If nothing at all is touched for 45 seconds (unless *Take my time*) the pause sheet of step 6 opens and the open question is not recorded; no countdown is shown.
6. **Pause (`placement/pause`).** Appears after three "not sure" in a row, after 45 seconds without any touch (the session inactivity pause; nothing is recorded for the open question, which is asked again on **Keep going**), and when the learner opens the exit ("Need a break?" **Keep going** / **That is enough, start learning**). A grown-up can also end it behind the PIN gate (`gateRequired`, F-LEARN-001) from the exit sheet (stop reason `grown-up`).
7. **Result (`placement/result`).** Hoya cheering; "Hoya found your starting spot!"; a mini grid (7 x 5) with a pin on the start cell and a light outline on placed-out cells; three route cards **Start here** (start quest title), **Next** (the next one or two quests on the route), **Later** (the next stage title). Primary button: **Start** (resets the stack to Main plus `QuestPlayer` on the start quest, the pattern of `FirstQuestPreviewScreen.tsx:30-41`); secondary **See the whole map** (Journey); text link **For grown-ups** (PIN gate -> `parent/placement-report`). The only words about level are the stage title and the band label ("Letters and sounds", "Reading words"), never a number, ratio, percent or word such as "score", "passed", "failed", "level 3" (CLAUDE.md section 1, F-RVW-001 section 3.1). If the route has no entitled quest left (`startQuestId === null`): "You know a lot! More adventures are coming." with **Open stories** (Library) when a reviewed shelf story exists, else **See the whole map**. If a retake does not change the route: "Your route stays right where it is." (no comparison words).
8. **Resume.** The run state is written after every answer (`placement-run:<profileId>`). Reopening within 24 hours offers **Continue** or **Start again**; older or from another bank version is discarded silently.

### 3.2 Test language and the sound guide (D2, D10)

- **`testLocale`** (`UiLocale`) selects: the Hoya lines and instructions (`getMessages(testLocale).learner.placement`), the instruction audio language, and the labels of picture options for screen readers (`labelEn` via the overlay of that locale). Taught Korean content is identical in every language.
- **English / Spanish**: every instruction is written and spoken.
- **Korean**: instructions on `decode`-form rungs (`recog`, `sound-basic`, `syl-cv`, `sound-rest`, `syl-cvc`) are **audio plus icons only** — no visible Hangul sentence — because reading a Korean instruction would show letter forms of the very symbols being tested. Test (T-leak): in the `ko` messages, `learner.placement.instruction[format].visible` is `null` for the four formats that test letter forms or sounds (`shape-odd-one-out`, `hear-pick-written`, `see-pick-sound`, `build-syllable`) and may be a written sentence for `hear-pick-picture`, `read-pick-picture` and `reply-pick` (their tested element is a word or sentence, which a generic instruction cannot reveal). Picture options carry no text label in Korean (a Korean label would equal the answer); screen-reader users therefore get vocabulary and sentence rungs as `not-tested` when `testLocale === 'ko'` and a screen reader is on (reported, never a failure).
- **Sound guide / romanization (D2).** The profile setting `romanizationMode` is **not read and not changed** by the check. The run has its own `revealMode`, `'tap'` or `'always'`, **initialised from the profile setting** (the options screen shows it pre-selected and the learner may change it for this run only; the engine has no default of its own).
  - `tap`: for any item flagged `leaks: true` (all `decode` formats, `read-pick-picture`, `reply-pick`'s written replies) the romanization of the tested element is hidden; a small "Show how it sounds" reveals it for that item only. A **revealed** answer is recorded `assisted: true` and counts like "not sure" (neither pass nor fail) for gate scoring, and its symbols are not counted as covered (section 3.6). The gloss of picture options is never shown on the item.
  - `always`: the engine draws only templates with `leaks: false` (`shape-odd-one-out` and `hear-pick-picture`; `hear-pick-written` leaks because its written options show the tested symbol), so the check measures shapes and listening to words and sentences; the decoding strands become `not-tested`, the level is the conservative `stage1` band 0 and the report says "not measured" (section 3.9). Choosing `always` is allowed and never presented as worse; such a run asks fewer than 12 questions (recognition 3 + oral 6), which is the documented exception to the floor.
  - After the run (result, report) all romanization and glosses are shown (CLAUDE.md section 1). Withholding the gloss of a picture option while the question is open is the one narrow exception to "taught Korean always shows a gloss" in this spec (the gloss would be the answer); it is listed for owner confirmation in section 9, assumption 13.
- **Item copy rule.** Hoya's one-line text on an item never names the answer, a letter, or a Korean word (test T-copy).
- **Spoken forms.** A symbol is spoken as a sound (consonant + carrier vowel, vowel as ㅇ + vowel), never by its name (F-AUDIO-004, D6).

### 3.3 The shared question engine (`packages/content-schema/src/assessment/`, 100 % covered)

Pure TypeScript, no React, no platform, no clock reads, no randomness except through an explicit seed. It is the single implementation for placement (this spec), daily reviews and the Hangul Check (F-RVW-001, F-QUEST-002 section 3.9). Exported from `src/index.ts` as `export * from './assessment'` (the `romanization/` directory at `src/index.ts:18-23` is the precedent for a logic folder inside the package).

| File | Exports | Rule |
|---|---|---|
| `question.ts` | `ASSESSMENT_FORMATS`, `AssessmentOptionSchema`, `AssessmentQuestionSchema`, `OutcomeSchema` (`'correct' \| 'wrong' \| 'skipped'`; a tap on "I am not sure" and every unanswered question are `skipped`, never `wrong`), `AssessmentResponseSchema`, types | The built question the player renders (below). |
| `rng.ts` | `hashSeed(parts: string[]): number`, `createRng(seed): () => number` (mulberry32), `shuffleSeeded<T>(items, rng)`, `sampleSeeded<T>(items, n, rng)` | Replaces the private LCG in `round-builder.ts:16-25` for new code; that file is not edited here. |
| `options.ts` | `placeCorrect(options, rng, avoidFirst = true)` | Shuffles so that over any 200 seeds the correct option is first in at most 35 % of cases (test), never the same index three times in a row within a run. |
| `select.ts` | `selectSpread<T>({ candidates, count, rng, exclude, spreadBy, filter })` | Picks `count` candidates, filters first (`filter`, `exclude` ids), then spreads over distinct values of `spreadBy(c)` (symbol key, group) before repeating one; if fewer than `count` remain it returns what it has (the caller decides). |
| `session.ts` | `startSession`, `answer`, `skip`, `expire(session, nowMs)`, `tally(responses)` | A linear list of questions with a response log. `expire` marks every unanswered question `skipped`, **never `wrong`**, and ends the session (F-RVW-001 section 3.7). `tally` returns `{ asked, correct, wrong, skipped, assistedCorrect }`. |
| `clock.ts` | `deadline(startMs, limitMs \| null)`, `isExpired(nowMs, deadlineMs)`, `isIdle(nowMs, lastTouchMs, idleMs \| null)` | The only time logic; `null` limit = never. |

```ts
// question.ts (additive; no Korean typed here — Korean text uses KoTextSchema from schemas/ko-text.ts, F-QUEST-002 §3.1)
export const ASSESSMENT_FORMATS = [
  'shape-odd-one-out',   // pick the tile that differs (visual only)
  'hear-pick-written',   // hear a sound / syllable / word, pick the written form      (Listen & Pick sym | syl | word)
  'see-pick-sound',      // see a symbol or syllable, pick its sound chip
  'build-syllable',      // tap tiles into the blocks (Build a Letter; explicit jamo ids)
  'hear-pick-picture',   // hear a word or sentence, pick the picture                 (Listen & Pick pic)
  'read-pick-picture',   // read a word or sentence, pick the picture
  'reply-pick',          // hear a line, pick the written reply                        (Tap & Respond)
] as const;
export const AssessmentOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  ko: z.string().optional(), romanization: z.string().optional(), en: z.string().optional(),  // en = gloss / accessible label, never shown on the item
  pictureRef: PictureRefSchema.optional(),            // 'card:…' | 'word:…' | 'swatch:…' (F-QUEST-002 §3.11)
  sound: z.string().regex(/^[a-z]{1,8}$/).optional(), // Latin sound chip: language-neutral
  isCorrect: z.boolean(),
}).refine((o) => o.ko !== undefined || o.pictureRef !== undefined || o.sound !== undefined, 'an option needs Korean, a picture or a sound chip');
export const AssessmentQuestionSchema = z.object({
  id: z.string(),                                      // template id, or an item id of a review
  format: z.enum(ASSESSMENT_FORMATS),
  promptKo: z.string().optional(), promptRomanization: z.string().optional(),
  spokenKo: z.string().optional(), audioRef: z.string().optional(),   // what the voice says (F-AUDIO-004 `spokenKo` wins over `promptKo`)
  options: z.array(AssessmentOptionSchema).min(2).max(4),
  tags: z.array(z.string()).max(8),
  requires: z.object({ audio: z.boolean(), picture: z.enum(['card', 'word']).nullable() }),
  leaks: z.boolean(),                                  // true: showing romanization or a gloss would give the answer away
}).superRefine(/* exactly one isCorrect; option ids unique; no two options with the same ko or pictureRef */);
export const AssessmentResponseSchema = z.object({
  questionId: z.string(), outcome: OutcomeSchema,
  chosenOptionId: z.string().nullable(),
  assisted: z.boolean().default(false),                // the sound guide was revealed before answering
  ms: z.number().int().nonnegative().max(600_000),
});
```

**How F-RVW-001 changes** (full patch list in appendix B; applied by PR P-0, so the review spec and this one agree before either is coded):

- Its engine (`apps/mobile/src/logic/reviews/engine.ts`, section 3.5) **imports** `session.ts`, `clock.ts` and `tally` instead of owning an attempt state machine; the "session clock expires -> remaining items `skipped`, never `wrong`" rule of its section 3.7 is implemented once, in `expire`. Daily-pool selection (`daily-pool.ts`), star math (`star-calc.ts`), stage balance and banned text stay review-specific in `logic/reviews/`.
- Review items become `AssessmentQuestion`s built from jamo / vocab ids (builders may reuse `placeCorrect` and `selectSpread`); `ReviewAttempt` responses use `AssessmentResponseSchema`; `ReviewEntrySchema` (`schemas/progress.ts:65-73`) is unchanged.
- Section 4 "Adaptive difficulty" gains one sentence: *"The placement check (F-PLC-001) is the one adaptive use: it lives in `packages/content-schema/src/placement/`, runs once at the learner's request, decides only which rung comes next, and never raises stakes in a review. The shared session reducer (`assessment/session.ts`) stays non-adaptive and is used by both."* The review spec stays non-adaptive.
- The Hangul Check builder (`buildHangulCheck`, F-QUEST-002 section 3.9) may emit `AssessmentQuestion`s; that is a follow-up, not required here.

### 3.4 The bank (`content/placement/`, JSON-first, D4)

`content/placement/` is a **new content directory**. CLAUDE.md section 2 requires approval for new directories; D4 approved `content/stories/` and `content/vocab/` and this spec asks for `content/placement/` on the same terms (decision P12; PR P-0 adds the line to CLAUDE.md section 2 once approved).

- Files: `index.json` (`{ "version": 1, "warmup": "pitem:warmup-rice", "files": [...] }`), `recognition.json`, `sound-letter.json`, `syllable-reading.json`, `vocabulary.json`, `sentences.json`. English (the base language of all content) only; Spanish and Korean are overlays (`content/i18n/es/placement.json`, `content/i18n/ko/placement.json`, domain `placement`, entity ids `pitem:*`, F-I18N-001 section 3.6).
- A **template** is one concrete question with explicit options (no runtime distractor generation, so the bank is reviewable line by line and independent of mobile modules):

```ts
// packages/content-schema/src/schemas/placement.ts
export const PLACEMENT_GATES = ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab', 'sentence'] as const;
export const PlacementGateSchema = z.enum(PLACEMENT_GATES);
export const PlacementStrandSchema = z.enum(['hangul-recognition', 'sound-letter', 'syllable-reading', 'vocabulary', 'sentences']);
export const PlacementFormSchema = z.enum(['decode', 'read', 'oral']);
export const PlacementTemplateSchema = z.object({
  id: z.string().regex(/^pitem:[a-z0-9-]+$/),
  strand: PlacementStrandSchema,
  gate: PlacementGateSchema,
  form: PlacementFormSchema,            // vocab / sentence: 'read' or 'oral'; every other gate: 'decode'
  question: AssessmentQuestionSchema.omit({ id: true }),
  glossEn: z.string().max(60),           // for reports and the result; never on the item. Overlay field `gloss`
  status: z.enum(['draft', 'ready']),
});
export const PlacementBankSchema = z.object({ version: z.number().int().positive(), templates: z.array(PlacementTemplateSchema).min(1) })
  .superRefine(/* ids unique; strand matches the gate table below; each (gate, form) with status ready has >= 9 templates (three full draws); tags reference known symbols; sentence / vocab templates carry a resolvable picture requirement; see rules */);
```

- Gate -> strand -> forms (also exported as `RUNG_TABLE`): `recog` -> hangul-recognition (decode) · `sound-basic` and `sound-rest` -> sound-letter (decode) · `syl-cv` and `syl-cvc` -> syllable-reading (decode) · `vocab` -> vocabulary (read, oral) · `sentence` -> sentences (read, oral).
- **Tags** drive scoring and spreading: `sym:<symbol key>` (`sym:ㄱ`, `sym:ㄴ/final`), `group:basic|rest|final`, `syl:<romanization>`, `shape:cv|cvc`, `word:<romanization>`, `topic:<theme>`, `pattern:n-ieyo|n-eul-v|reply`, `look-alike`. A template of `sound-basic` / `sound-rest` / `syl-*` carries one `sym:` tag per component.
- **Validation** (vitest in `packages/content-schema/src/__tests__/placement-bank.test.ts` reads the JSON with `fs`; plus `scripts/validate-content.mjs` rules for the plain-Node CI step): the Korean policy of F-CNT-001 (every Korean-bearing object has `romanization` and `en`), romanization equals the converter output for every `ko` that is not a single jamo (`checkRomanization`, `romanization/compare.ts:90`), `leaks` is true for every format except `hear-pick-picture` and `shape-odd-one-out`, every scored template has at least 3 options (4 except `reply-pick`; the guess-resistance figures of section 9 assume it), `requires.audio` is true exactly for formats that start from audio, no template with `status: ready` has an unreviewed sentence (`reviewedBy` comes with F-CNT-002's ledger), every symbol of `RUNG_SYMBOLS` is covered by at least two templates of its gate, and **the bank has at least 40 ready templates per strand** (section 5 counts them; appendix A lists 265).
- **Build.** `scripts/build-placement-bank.mjs` reads the JSON and writes `apps/mobile/src/content/placement.generated.ts` (checked in; `--check` is a CI step, the same pattern as `build-overlays.mjs`, F-I18N-001 section 3.6). The app parses it with `PlacementBankSchema` at start (a failure is a development error; at runtime the check is hidden, section 3.11).
- **Overlay fields** for the `pitem:` prefix (an addition to F-I18N-001's `OVERLAY_FIELDS` table, PR P-4): `gloss`, `options.<optionId>.gloss` (picture accessible label; the `gloss` naming follows the inline-pair rule of F-I18N-001 section 3.6). Never overridable: `ko`, `romanization`, `sound`, `pictureRef`, ids.
- **Exclusions at draw time:** `requires.audio` when `config.audio` is false; `requires.picture` when the picture does not resolve (`PictureArt` resolver, F-QUEST-002 section 3.11; a text tile is never substituted); `leaks: true` when `revealMode === 'always'`; the ids of the learner's previous result (`exclude`), relaxed only when a rung would otherwise have fewer than three questions.
- **Initial outline:** appendix A (265 templates: recognition 40, sound-letter 46, syllable-reading 72, vocabulary 53, sentences 54). **Only 248 are drawable today**: `supportedCardIds` (`HeritageCardArt.tsx:21-57`) holds the 30 Stage 1 cards only, and the 8 Stage 2 cards (`card:sagwa`, `uyu`, `ppang`, `dosirak`, `haneul`, `kkot`, `namu`, `byeol`) have no art (`LibraryScreen.tsx:142` and `ResultsScreen.tsx:283` already fall back for them). The 17 templates that need them (vocabulary 13, sentences 4) are `status: draft` until F-VOC-002 supplies `word:` art (a data-only change of `pictureRef`) and are excluded from the draw meanwhile.

### 3.5 The adaptive engine (`packages/content-schema/src/placement/`, 100 % covered)

Files: `rungs.ts` (`RUNG_TABLE`, `RUNG_SYMBOLS`), `plan.ts` (`nextRung`), `run.ts` (`startRun`, `currentQuestion`, `apply`), `scoring.ts` (`gateResult`, `strandStatuses`, `levelOf`), `level-map.ts` (`questsPlacedOutAtLevel`, `coveredSymbols`), `route-seed.ts` (`seedRoute`, `effectiveRoute`, `RouteCatalog`). All functions are pure; time enters only as `nowMs` arguments.

**Run configuration**

```ts
export interface PlacementConfig {
  length: 'quick' | 'full';          // quick: <= 15 questions, 4 min; full: <= 21, 6 min
  revealMode: 'tap' | 'always';
  audio: boolean;                    // from the warm-up (`playPrompt` result) and canPlayKorean(getCapability())
  visual: boolean;                   // false with a screen reader: `recog` is not run
  takeMyTime: boolean;               // true: no inactivity pause, no backstop clock
  seed: number;                      // hashSeed([profileId, startedAt])
  exclude: string[];                 // template ids of the previous result
  resolvesPicture: (ref: string) => boolean;
}
```

**Rungs.** Each rung is exactly three questions; `RUNG_SYMBOLS` (30 symbol keys, the F-QUEST-002 accounting): `basic` = ㅏ ㅓ ㄱ ㄴ ㅗ ㅜ ㅁ ㅇ ㅡ ㅣ ㄷ ㄹ · `rest` = ㅈ ㅊ ㅂ ㅅ ㅋ ㅌ ㅍ ㅎ ㅑ ㅕ ㅛ ㅠ · `finals` = ㄴ/final ㄹ/final ㅇ/final ㄱ/final ㅁ/final ㅂ/final.

| # | Rung (gate) | Strand | Draw (three questions, spread by symbol / group) | Needs |
|---|---|---|---|---|
| 1 | `recog` | hangul-recognition | `shape-odd-one-out`, three distinct look-alike pairs | `visual` |
| 2 | `sound-basic` | sound-letter | `hear-pick-written` / `see-pick-sound`, three different groups of `basic` | — |
| 3 | `syl-cv` | syllable-reading | CV syllables from `basic` symbols: hear / see / build | G2 passed |
| 4 | `sound-rest` | sound-letter | three different symbols of `rest` | G3 passed |
| 5 | `syl-cvc` | syllable-reading | syllables with a taught final | G4 passed |
| 6 | `vocab` | vocabulary | read form (three questions) when G5 passed, otherwise oral form | — |
| 7 | `sentence` | sentences | read form when `vocab` read passed (two `read-pick-picture` + one `reply-pick`), otherwise oral form (three `hear-pick-picture`; a reply needs reading, so it is never an oral item) | — |

**Order (`nextRung(state)`, pure).**

1. Always ask rung 1 (if `visual`) and rung 2, in that order (the entry rungs).
2. **Decoding ladder.** While the previous decoding rung passed: ask the next one (3, 4, 5), unless `length === 'quick'` and rung 3 is done (quick ladder ends after `syl-cv`). The first decoding rung that fails ends the ladder (`decodingStoppedAt`); rung 2 failing ends it immediately.
3. **Reading rungs.** If rung 5 passed: ask `vocab` in read form; if it passes ask `sentence` in read form; if `vocab` read fails, ask `vocab` in oral form once (21 questions reached, stop `cap`). A failed `sentence` read ends the run.
4. **Oral rungs.** If the ladder stopped before rung 5 passed (or `quick`): ask `vocab` oral then `sentence` oral (6 questions) — every run that does not read through to sentences therefore measures listening, which is what a heritage learner who understands but cannot read needs (a run that reads vocabulary and sentences needs no separate listening measure and reports `oralStage: null`).
5. `audio === false` removes oral rungs and all `requires.audio` templates; a rung with fewer than three eligible templates is `not-run` with reason `unavailable` (never a fail).

**Length.** The sequence above gives: floor `rung1 + rung2 + oral(6) = 12` (a learner who fails rung 2); 15 (fails rung 3); 18 (fails rung 4); 21 (fails rung 5: 15 decoding + 6 oral; or passes rung 5 and then reads vocabulary and sentences: 15 + 3 + 3; or fails `vocab` read: 15 + 3 read + 3 oral). Quick: at most 3 + 3 + 3 + 6 = 15. The runs shorter than 12 are: early exits (below) and the three documented exceptions — `visual === false` (no recognition rung, floor 9), `audio === false` (oral rungs not run) and `revealMode === 'always'` (section 3.2); the result lists what was not run and never treats it as a failure.

**Gate result (`gateResult(responses, asked)`).** `correct` = unassisted correct answers. `pass` iff `correct >= 2`; `fail` iff `asked === 3` (or `correct + (3 - asked) < 2`) and not pass; otherwise `not-run`. "Not sure" (`skipped`), `wrong` and assisted answers all count as not correct; none of them is shown as a miss.

**Stop reasons (`StopReasonSchema`):** `complete` (no rung left), `cap` (quick limit or 21 reached), `time` (backstop clock, below), `quit` (learner), `grown-up` (PIN), `not-sure` (the learner chose "That is enough" after three "not sure" in a row). Only `complete` and `cap` are full runs.

**Clock (D3).** One backstop per run, started at the first scored question: 4 minutes (quick) or 6 minutes (full), disabled by *Take my time*. It is not displayed. When it expires the current question may be answered; then the run ends with `time`, no question is ever marked wrong because of time, and the result is computed from what was asked. The 45-second inactivity pause (screen 5) is session-level, not a question timer: it records nothing and ends nothing.

**Pure run API.**

```ts
startRun(bank: PlacementBank, config: PlacementConfig, nowMs: number): PlacementRunState
currentQuestion(state): AssessmentQuestion | null            // built (options placed) from the template
apply(state, event, nowMs): PlacementRunState                // events: answer{optionId, assisted} | notSure | idle | tick | quit{by} | keepGoing
isFinished(state): boolean
finishRun(state, ctx: { catalog: RouteCatalog; isEntitled: (s: StageKey) => boolean; completedQuestIds: ReadonlySet<string>; completedAt: string; motivation?: Motivation; contentVer: string; testLocale: UiLocale; source: PlacementSource }): PlacementResult
```
`PlacementRunState` is a plain JSON value (persisted under `placement-run:<profileId>`, `PlacementRunStateSchema` versioned); the questions of the current rung are rebuilt from `seed` + `bankVersion`, so a resumed run is identical. `apply` never reads a clock; `nowMs` comes from the caller (tests pass constants).

### 3.6 Scoring, level on the 7-stage grid, mapping onto Stage 1

**Strand status (`strandStatuses`).** For each strand with the gates it owns: `not-tested` if none of its gates ran; `secure` if every gate of the strand was run and passed; `getting-there` if not secure and at least one unassisted correct answer exists in the strand; `not-yet` if a gate ran and there is no correct answer. Sound-letter owns `sound-basic` + `sound-rest`; syllable-reading owns `syl-cv` + `syl-cvc`; vocabulary and sentences own one gate each (their form, `read` or `oral`, is stored on the gate result). Statuses are shown to grown-ups as words.

**Level (`levelOf`).** `PlacementLevel = { stage: StageKey; band: 0 | 1 | 2 | 3 }` — the **decoding level** (what the learner can read), on the existing grid (`StageKeySchema`, `schemas/heritage-card.ts:9-17`):

| Highest consecutive decoding evidence | Level | Meaning (band label key) |
|---|---|---|
| `sound-basic` or `syl-cv` not passed | `stage1` band 0 | At the beginning |
| `sound-basic` + `syl-cv` | `stage1` band 1 | Letters and sounds |
| + `sound-rest` | `stage1` band 2 | Every letter |
| + `syl-cvc` | `stage1` band 3 | Reading words |
| + `vocab` read passed | `stage2` band 0 | First words |
| + `sentence` read passed | `stage3` band 0 | First sentences |

When no decoding rung ran (`revealMode: 'always'`, or the ladder was never reached because the run was stopped first) the level is the conservative `stage1` band 0 and the decoding strands are `not-tested`: the level is a *route default*, never a claim about the learner. Stage 4 and above are not measured (stages 5 to 7 are story reading, real-use and writing: no reliable multiple-choice proxy). `beyondContent` is true when `stage3` is reached. **Listening level** `oral: StageKey | null`: `stage2` if `vocab` oral passed, `stage3` if `sentence` oral also passed, else `stage1`; `null` when no oral rung ran. The route uses the decoding level; the listening level is reported and used by the planner (section 3.7) and never lowers or raises the route.

**Covered symbols (`coveredSymbols(result)`).** A symbol key is *covered* when the rung that owns it passed and no response on a template tagged with it was `wrong`, `skipped` or assisted: `basic` symbols need `sound-basic` **and** `syl-cv`; `rest` symbols need `sound-rest`; `finals` need `syl-cvc`. Symbols that no question touched are covered by their rung's pass (the check samples, it does not census; section 9 records the risk and the mitigation: the Hangul Check and the priority tokens).

**Mapping onto F-QUEST-002's Stage 1 list (`questsPlacedOutAtLevel` and `seedRoute`).** A *grid* quest `q` of stage `s` is **placed out** iff:

1. its stage is lower than the level's stage (`stage1` quests when the level is `stage2` or higher, `stage1` and `stage2` quests when it is `stage3`), or
2. it is a Stage 1 quest, `q.teaches` is non-empty and **every** key of `q.teaches` is covered, or
3. it is a Stage 1 quest with `q.teaches` empty (a consolidation quest, F-QUEST-002 rule R5) and the level is at least `stage2` band 0 (the `vocab` read rung passed: the learner reads Stage 1 words).

Applied to the 15 quests of F-QUEST-002 section 3.6:

| Evidence | Placed out | Start quest | Band |
|---|---|---|---|
| nothing / `sound-basic` or `syl-cv` failed | none | `quest:stage1-letters-q1` | 0 |
| + `sound-basic` + `syl-cv` (covered ㅏㅓㄱㄴㅗㅜㅁㅇㅡㅣㄷㄹ) | q1, q2, q3 | `quest:stage1-life-q1` (q4) | 1 |
| + `sound-rest` (ㅈㅊㅂㅅㅋㅌㅍㅎㅑㅕㅛㅠ covered) | + q4, q5, q6 | `quest:stage1-rites-q1` (q7) | 2 |
| + `syl-cvc` (finals covered) | + q7 to q10 (q8, q9 teach consonants **and** finals: both covered) | `quest:stage1-nature-q2` (q11) | 3 |
| + `vocab` read passed | + q11 to q15 (all Stage 1) | first playable, entitled quest of Stage 2 or later, else `null` | `stage2`/0 |
| + `sentence` read passed | + Stage 2 grid quests | first playable, entitled quest of Stage 4 (shipped taste) else `null` | `stage3`/0 |

Rows that rely on a symbol being *wrong* are cut back per quest: for example a learner who passes `sound-basic` and `syl-cv` but answered a ㅡ item wrong has q3 (ㅡㅣㄷㄹ) **not** placed out, so the start quest is q3, not q4, although the band is 1. The start quest is always "the first playable grid quest that is not placed out and not done", never "the first quest after a prefix". With today's 8 quests (g n d l / m b s ng / six vowels, life x2, rites, nature, crafts) the same rules apply through `teaches`; the Journey never shows more than the bundle contains.

**Coarse mapping without evidence** (`questsPlacedOutAtLevel(level, catalog)`, the same module, used by F-PLAN-002 when a grown-up simply chooses a starting point): covered symbols are `basic` for `stage1` band 1, plus `rest` for band 2, plus `finals` for band 3; any level at or above `stage2` band 0 places out every Stage 1 quest, at or above `stage3` also Stage 2; rules 1 and 2 above then apply, rule 3 (consolidation quests) applies only from `stage2`. It returns exactly the "Placed out" column of the table.

Non-grid content (shelf stories, vocabulary topics) is never placed out and never gated by the result (F-STORY-005 section 3.4 rule 1).

### 3.7 `seedRoute`, the route seed and everything that reads it

```ts
// placement/route-seed.ts  (types are structural so F-PLAN-002's catalog satisfies them)
export interface RouteQuest { id: string; episodeId: string; stage: StageKey; theme: ThemeKey; order: number;
  teaches: readonly string[]; playable: boolean; grid: boolean }
export interface RouteCatalog { quests: readonly RouteQuest[] }
export interface RouteSeed {
  level: PlacementLevel; oralStage: StageKey | null;
  startQuestId: string | null; startEpisodeId: string | null;
  placedOutQuestIds: string[];
  priorityTokens: string[];            // <= 3: 'sym:ㅓ', 'sym:ㄹ/final', 'skill:blending' ...
  themeOrder: ThemeKey[];              // motivation first, then canonical order
  beyondContent: boolean;
  needsStage: StageKey | null;         // lowest stage the learner is placed at but not entitled to
}
export function seedRoute(result: PlacementResult, catalog: RouteCatalog, opts: { isEntitled: (s: StageKey) => boolean; completedQuestIds: ReadonlySet<string> }): RouteSeed;
export function effectiveRoute(placements: readonly PlacementResult[], catalog: RouteCatalog, opts): RouteSeed | null;
```

- **Priority tokens** (at most three, in this order): symbols answered wrong, then skipped, then assisted, taken from the *newest* result; `skill:blending` when `syl-cv` or `syl-cvc` failed after a pass of `sound-*`; `skill:finals` when `syl-cvc` failed.
- **Theme order**: motivation `heritage` and `friends` -> `life`; `kculture` -> `rites`; `curious` -> `letters` (blueprint 04 section 8.1); then the other themes in canonical order. Stage 1 lessons are **not** reordered by themes (F-QUEST-002: symbols are taught in list order); the order applies from Stage 2, to stories and to the planner.
- **Entitlement.** Quests of a stage the tier does not include are neither start nor offered by the cursor (`isEntitled`, `logic/entitlement.ts:31-33`); `needsStage` records it for the grown-up report ("Sam is ready for Stage 2"; see section 3.9 for the wording rule). Stories and vocabulary stay free (D5): the result screen offers them. No paywall is shown to the learner.
- **Effective route (`effectiveRoute`) and the retake rule.** Fold the snapshot's `placements` in `completedAt` order: `placedOut` is the **union** of every result's `placedOutQuestIds` (results never remove an id), minus quests the parent put back (override, section 3.9); priority tokens and theme order come from the newest result; `level` is the highest ever reached. Because the set only grows, a retake **cannot move the start quest backwards**; a lower retake is stored as history, changes nothing but the priority tokens, and the result screen says "Your route stays right where it is." Completed quests are never touched.
- **Consumers (each a small, tested change):**
  1. *Cursor.* `nextQuest` (`mission-builder.ts:110-119`) and F-QUEST-002's `nextQuestAfter` take an optional `route?: { placedOut: ReadonlySet<string> }`: offerable quests exclude placed-out ids; the fall-through `?? offerable[last]` is unchanged. The Home builder passes `effectiveRoute(...)`.
  2. *First-quest preview.* `firstQuestFor` is not used when a result exists; `FirstQuestPreview` is skipped and the result's **Start** button opens `RouteSeed.startQuestId`.
  3. *Journey look.* A cell whose quests are all placed out or done, and not all done, draws the **placed-out** look: a light outline and a small check-in-circle glyph, clearly different from the completed tint (`JourneyScreen.tsx:150-171`, `colors.feedback.successLight`); it stays tappable and awards normally. A pin marks the start cell. Pure helper `logic/placement/cell-look.ts` (`placedOutEpisodeIds`, `startCell`) so F-STORY-005's `cellModel` can take it as an input.
  4. *Home.* The progress bar "Stage 1 progress" (`HomeScreen.tsx:207-209`, total = every quest, `:103`) is out of scope (a pre-existing mismatch noted in REVIEW-1 section 9); only the **level check card** is added (section 3.10).
  5. *Summary.* `summarize` writes `placement` (section 3.8) and, until the learner has quest history, seeds `needsPractice` with the first three priority symbols so a new grown-up view is meaningful (`summarize.ts:63` merges them behind real practice data).
  6. *Plans and curriculum.* The planner reads the seed (F-PLAN-002 section 3.1): `CurriculumParams.level = seed.level`, `placedOutQuestIds = seed.placedOutQuestIds` (the exact set, so the plan starts at `startQuestId`), `goals.themes = seed.themeOrder`, and a suggested `goals.focus` of `reading` when `oralStage` is two or more stages above `level.stage` (a listener who cannot read yet gets letters first) and `balanced` otherwise. The wizard shows these as pre-selections the adult can change; `questsPlacedOutAtLevel` is the shared coarse mapping when only a level is known.
  7. *Reviews.* When F-RVW-001 ships, the `sym:` priority tokens take the single Pool C slot of the first three Daily Tests, one per test, each exactly once (Pool C stays one forced item; `skill:` tokens are ignored by reviews).
  8. *Stories.* `reachedStage(snapshot, grid, placement?: number)` (F-STORY-005 section 3.4) receives `stageNumber(level.stage)` (its `placement` argument is a stage number 1 to 7, not a `StageKey`) as the floor (raises, never lowers); stories are never hidden by it. Note the word "placement" also names `Episode.placement` (`'grid' | 'shelf'`, F-STORY-001) and F-STORY-005's `placement` argument; here it always means the level check.
- **Never written by placement:** `quests`, `episodes`, `cards`, `homework`, `sessions`, `streakDays`, stars. `recordPlacement` appends to `placements` and nothing else (test).

### 3.8 Data, storage, sync (additive only)

`packages/content-schema/src/schemas/placement.ts` (exported from `src/index.ts`):

```ts
export const GateResultSchema = z.object({
  gate: PlacementGateSchema, form: PlacementFormSchema,
  asked: z.number().int().min(0).max(3), correct: z.number().int().min(0).max(3), assisted: z.number().int().min(0).max(3),
  result: z.enum(['pass', 'fail', 'not-run']), reason: z.enum(['unavailable', 'stopped']).optional(),
});
export const StrandStatusSchema = z.enum(['secure', 'getting-there', 'not-yet', 'not-tested']);
export const PlacementLevelSchema = z.object({ stage: StageKeySchema, band: z.number().int().min(0).max(3) });
export const StopReasonSchema = z.enum(['complete', 'cap', 'time', 'quit', 'grown-up', 'not-sure']);
export const PlacementSourceSchema = z.enum(['onboarding', 'home', 'profile', 'parent']);
export const MotivationSchema = z.enum(['heritage', 'kculture', 'curious', 'friends']);
export const PlacementResultSchema = z.object({
  id: z.string().regex(/^placement:[a-z0-9-]+$/),
  startedAt: z.string(), completedAt: z.string(),
  source: PlacementSourceSchema,
  testLocale: UiLocaleSchema, length: z.enum(['quick', 'full']), revealMode: z.enum(['tap', 'always']),
  bankVersion: z.number().int().positive(), contentVer: z.string(),
  motivation: MotivationSchema.optional(),
  responses: z.array(AssessmentResponseSchema).max(24),
  gates: z.array(GateResultSchema).max(9),
  strands: z.object({ 'hangul-recognition': StrandStatusSchema, 'sound-letter': StrandStatusSchema, 'syllable-reading': StrandStatusSchema, vocabulary: StrandStatusSchema, sentences: StrandStatusSchema }),
  level: PlacementLevelSchema, oralStage: StageKeySchema.nullable(), beyondContent: z.boolean(),
  startQuestId: z.string().nullable(), placedOutQuestIds: z.array(z.string()).max(40),
  priorityTokens: z.array(z.string()).max(3), needsStage: StageKeySchema.nullable(),
  stopReason: StopReasonSchema,
  override: z.object({ by: z.literal('parent'), at: z.string(), startQuestId: z.string() }).optional(),
});
export const PLACEMENT_KEEP = 10;
```

- **Snapshot.** `ProgressSnapshotSchema` gains `placements: z.array(PlacementResultSchema).default([])` (so old snapshots, backups and server copies parse; `profile.ts:23` is the `.default` precedent). `blankSnapshot` (`progress-store.ts:77-89`) adds `placements: []`; `mergeSnapshots` (`merge.ts:80-98`) unions by `id` (for the same id the copy that carries an `override` wins, the later `override.at` when both do, otherwise local), sorts by `completedAt`, keeps the newest `PLACEMENT_KEEP`; `isSubsetOf` (`merge.ts:101-111`) also compares placement ids. A new action `progress-store.recordPlacement(profileId, result)` appends, persists and notifies sync (`persist` / `notifyProgressPersisted`, `progress-store.ts:91-94, 127-135`); `applyPlacementOverride(profileId, resultId, startQuestId)` sets `override`.
- **Summary.** `ProgressSummarySchema` gains optional `placement: { takenAt, level, oralStage, strands, beyondContent, overridden: boolean } | undefined` (`schemaVersion` stays `1`). It carries statuses and the level only — no per-question data, no counts (teachers see no scores, F-TCH-001 section 3.2). `summarize` fills it from the newest result (`logic/sync/summarize.ts:44-84`).
- **Run state.** `placement-run:<profileId>` and `placement-ui:<profileId>` (`{ declinedAt?, dismissedAt? }`) through `platform/storage.ts` (`readJson` / `writeJson`, `:10-21`). No `localStorage` / `AsyncStorage` directly (CLAUDE.md section 8).
- **No migration, no new route.** Snapshots and summaries are JSON columns (`apps/api/migrations/0002_schema_v2.sql:30-40`). **Deploy order: Worker (new schemas) first, then the app**; until then the Worker would silently drop `placements` / `placement` (test in `packages/backend` asserts the round trip).
- **Local copies carry no defaults.** The zod `.default([])` protects server copies, backups and restores, but the progress store reads its own snapshot with `readJson<ProgressSnapshot>` and no parsing (`store/progress-store.ts:156`), so every snapshot already on a device lacks `placements` at runtime. A small `withSnapshotDefaults(snapshot)` (in `logic/sync/merge.ts`; the first of F-PLC-001 P-5 / F-PLAN-002 P2-4 / F-VOC-005 P-3 to land creates it, the others add their key) is applied in `hydrate`, `replaceSnapshot`, restore and the server read, and `mergeSnapshots` / `isSubsetOf` treat a missing `placements` as `[]`. Test: merge, `isSubsetOf` and `recordPlacement` on a legacy snapshot object without the key.
- **Mixed app versions (data-loss guard).** The Worker stores the uploaded snapshot as the new payload (`routes/sync.ts:71-79`). An older app build re-uploading after a conflict merge has already stripped `placements` and `summary.placement` and would erase them from the server copy (the device that took the check re-uploads them on its next sync, but a Rescue Code restore in between would miss them). P-2 therefore extends the **preserve rule** that F-VOC-005 P-1 adds to `PUT .../snapshot` (one shared helper listing the additive keys; the first PR to land creates it): when the stored payload has a non-empty `placements` and the incoming one has none, the stored list is kept; the same for `summary.placement`. `placements` is append-only, so "incoming empty and stored non-empty" can only mean an old client. Test in `backend/src/__tests__/sync.test.ts`.
- **Size.** A result is about 2 KB (24 responses); ten are kept.

### 3.9 Grown-up and teacher surfaces

**Parent dashboard (in-app, local data).** `ParentDashboardScreen` (`screens/parent/ParentDashboardScreen.tsx:43-94`, one card per profile) gains a **Starting spot** row under the card stats: stage title and band label, the date, and `See the check` -> new route `PlacementReport { profileId }` (added to `RootStackParamList`, behind the PIN gate: `PinEntry.next` gains `'PlacementReport'`, `navigation/types.ts:20`). The report (wireframe `report`):

- the five strands, each with a status word (*secure*, *getting there*, *not yet*, *not tested*) and a plain example ("knows the sounds of ㅏ ㅓ ㄱ ㄴ; the vowels in ㅕ ㅠ are new" — Korean via `KoreanText`, with romanization and gloss); numbers are allowed here and framed as growth ("3 of 3 on the first try" per rung), never compared with other learners (F-PAR-001 section 3.2, section 3.6 banned phrases);
- what was **not** tested and why (no sound on this device, sound guide set to *always*, screen reader on, ended early);
- the recommended start with a `needsStage` note when the account does not include that stage ("Sam is ready for Stage 2. Stage 2 lessons are not included with this account yet."): no price, no plan name, no purchase or upgrade button, no commercial claim (the exact words are the owner's to set, assumption 10);
- **Choose a different start** (opens a list of the learner's quests in order; the parent taps one): `applyPlacementOverride` stores `override: { by: 'parent', at, startQuestId }`; `effectiveRoute` then places out every grid quest *before* the chosen one, puts back (un-places) the chosen one and everything after it, and later retakes cannot re-place the put-back quests. The override in force is the one on the newest result that carries one, so it survives later retakes. This is the only action that can move the start earlier, and it is explicit. Telemetry `placement.override_applied`;
- **Take the check again** (-> section 3.1 flow, `source: 'parent'`, the learner's level pre-fills Quick / Full). When a Quick check passed every rung it asked (`length === 'quick'` and `stopReason === 'cap'`), the report says "the quick check stops here; the full check can place higher" and offers the full length.

**Console roster (`apps/web`).** `RosterLearner.summary.placement` (`api.ts:25-34`) drives a line on each student / child card: "Starting spot: Stage 1 · Letters and sounds · Oct 9" (`lib/console/placement.ts`: `startingSpotLine(summary)`, pure, band labels from the same messages) and, when `overridden`, a quiet "Changed by a grown-up". Absent summary or placement -> no line. No class average, no distribution, no sort by level (roster order stays most recent activity first, `routes/spaces.ts:386`). The F-PLAN-002 wizard may use the *most common* level of the roster as a hint (3 or more learners with a result).

**Advisory override.** In the console, **Suggest a different start** on a student card opens the existing plan builder (`/teach/space/plan?id=`, `apps/web/src/app/teach/space/plan/page.tsx`) pre-filled with one quest item, a note ("Try this next"), `targetLearnerIds: [learnerId]` — a normal F-PLAN-001 plan, so it arrives as a "From class" / "From home" card (2) and never edits the learner's placement, placed-out set or progress (decision P6). No new route, table or inbox field. A teacher or parent cannot read the item-level answers (summary only, F-TCH-001 section 3.6).

### 3.10 Entry points

- **Onboarding fork** (section 3.1 step 1). Applies to the first profile and to profiles added later (`firstRun: false` goes through the same `CreateProfile` -> `PlacementInvite`).
- **Home card "Take the level check"** (`screens/home/HomeScreen.tsx`, below the mission cards, above "Stage 1 progress" at `:207`): a quiet `Card tone="sunken"` with one sentence and a ghost button, shown when `flags.placementEnabled`, the active profile has no placement result, fewer than 3 quests are complete, and `placement-ui.dismissedAt` is empty. A **Not now** link sets `dismissedAt` (never shown again until the learner opens Profile). Not shown while a run is resumable (then it reads "Continue the level check"). No streak or guilt copy. **Order with sibling Home blocks:** the three mission cards (F-STORY-004 may change what slots 1 and 3 hold) come first; then at most **one** quiet card from {this level-check card, F-PLAN-002's route card}, the level-check card winning while it is eligible (it disappears after three quests, a result or "Not now", and the route card takes its place); then "Stage 1 progress"; then the Homework card.
- **Profile** (`screens/profile/ProfileScreen.tsx`, a row under the stats, above F-PLAN-002's "Plan my route" row): "Find my starting spot again" -> `Placement` (not PIN-gated: a learner may do this alone; the result is still only a start) with `source: 'profile'`.
- **Parent report** (section 3.9): `source: 'parent'`.
- The check is a nested stack `PlacementStack` (language, options, warm-up, item, result; the same pattern as `OnboardingStack`, `navigation/onboarding.tsx:10-18`) mounted as the root route `Placement: { source: PlacementSource }`, plus the root route `PlacementReport: { profileId: string }` (`navigation/root.tsx:47-61`, `navigation/types.ts:3-37`). The onboarding fork stays in `OnboardingStack` and reaches `Placement` through its parent navigator. Full screen; back = the exit sheet.

### 3.11 Offline, audio and errors

- Everything runs offline: engine, bank (generated TS) and pictures are bundled; the check never waits on the network; the result syncs later like any snapshot write.
- Audio is optional. `playPrompt` results (`played`, `muted`, `unavailable`) never block: `muted` is a user choice (the item shows the prompt as text only for formats where the spoken prompt is not the tested element; otherwise the question is skipped from the draw at start), `unavailable` at the warm-up sets `audio = false`; mid-run `unavailable` shows the text fallback "No sound? Read it here." for formats where that does not give the answer away, and otherwise records the item `skipped` (not wrong) and continues.
- Empty and error states: bank fails to parse -> the Home card and Profile row are hidden and the onboarding fork is skipped (no dead end); fewer than 12 eligible templates for the chosen options -> the options screen says what is limited ("This device cannot play Korean sound, so we will use pictures and reading") and runs the shorter set; a rung with fewer than three eligible questions is `not-run`; storage write fails -> the result is kept in memory for the session and retried (existing `persist` behaviour); an unknown `startQuestId` on a later build -> the cursor falls back to the first non-placed-out quest.
- The run is never uploaded in pieces; only the finished result enters the snapshot.

### 3.12 Accessibility, layout, privacy

- Targets and type: choices at least `touchTarget.child` (80), "I am not sure" and exit at least `touchTarget.min` (64), body text 18 or larger, tokens only, no emoji, no raster (CLAUDE.md sections 1 and 4, D7). Reflow at 320 x 568, landscape and 200 % text; Screen scrolls and the primary action stays reachable (F-LAYOUT-001 once shipped).
- Screen readers: Korean through `KoreanText` with `accessibilityLanguage="ko"`; the question announces "Question, 4 choices"; picture choices expose their gloss in the test language (except `ko`, section 3.2); the footstep trail is `importantForAccessibility="no"`; focus moves to the prompt on each question. Recognition (`recog`) is visual by nature and is not run with a screen reader on (reported as not tested).
- Reduced motion: Hoya and the trail change state instantly. No flashing. Haptics only on the existing tap pattern.
- Privacy: nothing leaves the device but the finished result inside the normal snapshot / summary; telemetry carries ids, codes and counts only (section 3.14); `learnerType` is not sent (REVIEW-1 owner answer 2).
- Copy: plain English at Pre-A1; Spanish and Korean follow F-I18N-001. No "kids", no age, no "test" in the learner-facing name ("level check" or "find my starting spot"), no shame words (`logic/homework/banned-text.ts` lists plus the per-locale lists of F-I18N-001), no `%`, no `x / y`, no score-like numbers on the learner screens (tests over every string of `learner.placement` in all locales: no `%`, no `x / y`, and no digit except in the allow-listed duration strings `invite.duration`, `options.lengthQuick` and `options.lengthFull`).

### 3.13 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9-43`, and its exact-list test)

| Name | Payload | When |
|---|---|---|
| `placement.start` | `{ source, testLocale, length, revealMode, level }` | first scored question shown (`level` = the D1 level id) |
| `placement.item_answered` | `{ itemId, gate, outcome, assisted, ms }` | each scored response (no option text) |
| `placement.complete` | `{ stopReason, asked, stage, band, oralStage, beyondContent, strandsSecure }` | result computed (`strandsSecure` = count) |
| `placement.skipped` | `{ source: 'onboarding' \| 'home' }` | "I am new to Korean" or Home **Not now** |
| `placement.override_applied` | `{ by: 'parent' }` | in-app override saved |

Names follow `TELEMETRY-NAMES.md` (`<unit>.start` / `.complete`, past-tense actions, namespaced). The console has no telemetry client (F-I18N-001 section 3.12), so the advisory plan produces no event; the Worker needs no change beyond the shared list.

### 3.14 Behaviours (Given / When / Then)

- **Given** the learner taps "I am new to Korean", **when** the fork closes, **then** no run starts, `placement.skipped` fires, `FirstQuestPreview` opens as today, and the snapshot is unchanged.
- **Given** a learner who fails `sound-basic`, **when** the run proceeds, **then** exactly the two oral rungs follow, 12 questions are asked, the level is `stage1` band 0, `startQuestId` is the first Stage 1 quest, `placedOutQuestIds` is empty, and the result screen shows no number.
- **Given** a learner who answers every rung through `syl-cvc` correctly and passes `vocab` read, **when** the run ends, **then** at most 21 questions were asked, the level is `stage2` band 0, all 15 Stage 1 quests are placed out, **none** is completed (no `QuestProgress`, no card, no star, no `stage.complete`), and on a free tier `startQuestId` is `null`, `needsStage` is `stage2`, and the screen offers stories.
- **Given** a placed-out quest, **when** the learner opens and finishes it from the Journey, **then** it awards stars and its card exactly as any quest.
- **Given** a retake that places lower than the stored route, **when** it finishes, **then** the start quest does not change, the result is saved as history and Hoya says the route stays where it is.
- **Given** `revealMode: 'tap'` and the learner reveals the sound guide on an item and picks the right answer, **then** the response is `assisted: true`, counts as not correct, and its symbol is not covered.
- **Given** `revealMode: 'always'`, **then** no `leaks: true` template is drawn, decoding strands are `not-tested`, and the grown-up report says why.
- **Given** the audio check fails, **then** audio-required templates are excluded, oral rungs are `not-run` (`unavailable`), and the result states that listening was not tested.
- **Given** the backstop clock expires during a question, **then** the question can still be answered, the run ends with `time`, and no response is marked wrong for lack of time.
- **Given** the app is closed mid-run and reopened within 24 hours, **then** **Continue** resumes at the same question with the same options.
- **Given** a parent overrides the start to quest 2, **then** quests 3 onward are put back, a later retake cannot place them out again, and `placement.override_applied` fires.

## 4. Out of scope

- Measuring Stages 4 to 7, speaking (STT is blocked on T-013), writing / tracing, and any numeric score or CEFR / TOPIK label.
- A class-wide required check (a future plan item of kind `placement`), teacher-written changes to a learner's route (the override is a plan item, section 3.9), any ranking or class comparison.
- Re-offering the check after 21 days away (blueprint 02 section 2.4), a statistical (IRT) model, reading the answers of other learners to calibrate (collect telemetry first; recalibrate after about 200 completed runs per level).
- New art: the bank uses `card:` art that exists; `word:` art from F-VOC adds templates later (data only).
- Moving the Home "Stage 1 progress" bar to the route stage (REVIEW-1 section 9, a separate fix).
- Changing the nine existing games, `ListenPickGame` or `quest-run-store`; placement renders its own item view from shared primitives because an answer is final and gives no feedback.
- Gating anything (D5): no `isFreeContent` call is added by this spec.

## 5. Tests

| File | Level | Coverage |
|---|---|---|
| `content-schema/src/__tests__/assessment-rng.test.ts` | unit | `hashSeed` stable; `createRng` deterministic and uniform enough; `shuffleSeeded` is a permutation; `sampleSeeded` distinct |
| `…/assessment-options.test.ts` | unit | `placeCorrect`: correct option first <= 35 % over 200 seeds, never three equal indexes in a row |
| `…/assessment-select.test.ts` | unit | filter, exclude, spread over distinct tag values before repeats, fewer candidates than `count`, determinism |
| `…/assessment-session.test.ts` | unit | answer / skip, `expire` marks unanswered `skipped` never `wrong`, `tally` including `assistedCorrect`; ids not in the session rejected |
| `…/assessment-clock.test.ts` | unit | `deadline` null, `isExpired` boundary, `isIdle` |
| `…/assessment-question.test.ts` | unit | zod: exactly one correct, unique ids, no duplicate `ko` / `pictureRef`, option needs content; responses |
| `…/placement-schema.test.ts` | unit | `PlacementResultSchema`, `PlacementBankSchema` rules, old snapshot without `placements` parses to `[]`, summary without `placement` parses |
| `…/placement-rungs.test.ts` | unit | `RUNG_TABLE`, `RUNG_SYMBOLS` = 30 keys, 12 + 12 + 6, no duplicates |
| `…/placement-plan.test.ts` | unit | `nextRung` for every path: floor 12, 15, 18, 21 (full), 15 (quick), `visual: false` (9), `audio: false`, read-form switch, oral rungs after a decoding stop, `vocab` read fail -> oral once |
| `…/placement-run.test.ts` | unit | `startRun` / `apply` / `finishRun` end to end; stop reasons `complete`, `cap`, `time`, `quit`, `grown-up`, `not-sure`; three "not sure" -> pause event; 45 s without a touch -> pause event with no response recorded; `takeMyTime` disables clocks; resume equality (serialise, rebuild, same question) |
| `…/placement-scoring.test.ts` | unit | `gateResult` (pass / fail / not-run, assisted excluded), `strandStatuses` truth table, `levelOf` for all six rows |
| `…/placement-level-map.test.ts` | unit | every row of section 3.6 against a **15-quest fixture** (`__tests__/fixtures/stage1-15.ts`): start quest, placed-out ids, covered symbols with wrong / assisted answers cutting a quest back; the 8-quest layout of today's bundle |
| `…/placement-route-seed.test.ts` | unit | `seedRoute` priorities (<= 3, order), theme order by motivation, entitlement (`needsStage`, `startQuestId` null), `beyondContent`; `effectiveRoute` union, lower retake keeps the start, override puts back and blocks re-placing, completed quests untouched |
| `…/placement-simulated.test.ts` | integration | six simulated learners (zero, letters only, decoder, heritage listener, advanced, random guesser): placed levels, question counts (zero = 12, max <= 21, quick <= 15), a guesser with 4-option items is placed at `stage1` band 0 or 1 in >= 95 % of 1,000 seeded runs |
| `…/placement-bank.test.ts` | content | reads `content/placement/*.json`: schema, >= 40 ready templates per strand, every `RUNG_SYMBOL` covered by >= 2 templates of its gate, romanization equals the converter, `leaks` / `requires.audio` consistent with the format, ko-instruction leak rule, no Hangul in `en` / `es` messages |
| `…/telemetry.test.ts` (extend the exact sorted list) | unit | the five new names |
| `backend/src/__tests__/sync.test.ts` (extend) | integration | a snapshot with `placements` and a summary with `placement` round-trip through `PUT /api/sync/learners/:id/snapshot` and the roster; unknown extra keys still stripped |
| `scripts/__tests__/validate-content.test.mjs` (extend) | unit | new rules for `content/placement/**` and the `pitem:` overlay fields |
| `mobile/src/logic/placement/__tests__/*.test.ts` | unit, 100 % | `flow.ts` (screen state machine: fork, language skip with one locale, options defaults by `levelOrder` and the sound-guide pre-selection from the profile setting, pause rules, exit sheet), `copy.ts` (every string in en / es / ko: no banned word, no `%`, no `x / y`, no digits outside the three allow-listed duration strings, no Hangul in en / es), `result-view.ts` (route cards, "stays where it is", stories fallback), `cell-look.ts`, `home-card.ts` (when the card shows) |
| `mobile/src/store/__tests__/placement-run-store.test.ts` | integration | persists after every answer, resume within 24 h, discards stale and other-bank runs |
| `mobile/src/store/__tests__/progress-store.test.ts` (extend) | integration | `recordPlacement` appends only to `placements` (no quests, cards, homework, sessions, streak), notifies sync; `applyPlacementOverride` |
| `mobile/src/logic/sync/__tests__/merge.test.ts`, `summarize.test.ts` (extend) | unit | placements union / cap / `isSubsetOf`; summary `placement` block; `needsPractice` seeding |
| `mobile/src/logic/homework/__tests__/mission-builder.test.ts` (extend) | unit | cursor with a route skips placed-out ids; falls back as before without one |
| `mobile/src/content/__tests__/placement-bank.test.ts` | integration | the generated bank equals `content/placement/*.json`; every `card:` picture resolves in `supportedCardIds` |
| `apps/web/src/lib/console/__tests__/placement.test.ts` | unit | `startingSpotLine`, advisory plan prefill |
| `apps/mobile/e2e/web/placement.spec.ts` (nightly) | e2e | fork -> language -> options -> 12 answers -> result -> Start opens the expected quest; pin on the grid; Home card appears and dismisses; offline run; Spanish run |

Coverage: `packages/content-schema` 100 % (`assessment/` and `placement/` included), `apps/mobile/src/logic` >= 90 % with `logic/placement/` at 100 %, `apps/web` verification logic >= 90 %. Component files are verified by Playwright, not unit tests (the mobile vitest setup cannot render components, `apps/mobile/vitest.config.ts:21-27`).

## 6. Rollout and PR breakdown

Flag `flags.placementEnabled` (`apps/mobile/src/config/flags.ts`, `readBool('EXPO_PUBLIC_PLACEMENT_ENABLED', false)`; add to `launchDefaults` and the flags test). It hides the fork, the Home card, the Profile row and the report entry. Beta measures (telemetry): share who start / complete, median length, stop reasons, how often a parent overrides, quest-1 accuracy of placed-out learners versus others; recalibrate the bank after about 200 completed runs per level.

| PR | Content | Size | Needs |
|---|---|---|---|
| P-0 | `docs`: CLAUDE.md section 2 line for `content/placement/` (**only after the owner approves P12**; fold it into F-I18N-001 PR 0's single charter edit if that has not merged yet); F-RVW-001 amendments (appendix B); the `pitem:` row for F-I18N-001 section 3.6 `OVERLAY_FIELDS`; wireframes promoted | S | owner approval P12 |
| P-1 | `feat(content-schema)`: `assessment/` (question, rng, options, select, session, clock) + tests | M | — |
| P-2 | `feat(content-schema,backend)`: `schemas/placement.ts`, snapshot `placements` and summary `placement` (additive), the Worker preserve rule for both (shared with F-VOC-005 P-1 / F-PLAN-002 P2-4), telemetry names + exact-list test (and rows in `TELEMETRY-NAMES-2.md`), backend round-trip test. **Deploy the Worker before any app build** | M | P-1 |
| P-3 | `feat(content-schema)`: `placement/` (rungs, plan, run, scoring, level map, route seed, effective route), 15-quest fixture, simulated learners | L | P-1, P-2 |
| P-4 | `content`: `content/placement/` 265 templates, overlay skeletons, `build-placement-bank.mjs`, validator rules, `placement.generated.ts` | L | P-2; native review gates `ready` |
| P-5 | `feat(mobile)`: `logic/placement/` (flow, copy, result view, cell look, home card), `placement-run-store`, `recordPlacement`, merge / summarize / mission-builder changes, flag | M | P-3, P-4 |
| P-6 | `feat(mobile)`: screens (language, options, warm-up, item, pause, result), navigation, audio capability hooks | L | P-5, F-I18N-001 PR 4, F-AUDIO-004 A-4 |
| P-7 | `feat(mobile)`: entry points (onboarding fork, Home card, Profile row), Journey placed-out look and start pin | M | P-6 |
| P-8 | `feat(mobile)`: parent report, override, dashboard row | M | P-6 |
| P-9 | `feat(web)`: roster line, advisory plan prefill, `lib/console/placement.ts` | S | P-2 |
| P-10 | `test(e2e)` + flag flip for beta | S | P-7, P-8 |

## 7. Dependencies

- **Upstream:** F-LEARN-001 PR 1 (`levelOrder`; already in `packages/content-schema/src/schemas/learner-level.ts`), F-I18N-001 PR 1-4 (`UiLocale`, `getMessages`, `KoreanText`), F-AUDIO-004 (`playPrompt`, `canPlayKorean`), F-QUEST-002 Q-1 (`KoTextSchema`, `PictureRefSchema` if not yet created: P-2 creates them with exactly the F-QUEST-002 shapes), F-CNT-002 (converter and checker already in `romanization/`), F-PLAN-001 (plans for the advisory hand-off), F-STORY-004 PR 4.2 (`isFreeContent`, only read, never called here).
- **Downstream:** F-PLAN-002 (level input, shared coarse mapping, `RouteCatalog`), F-RVW-001 (shared engine, Pool C seeding), F-STORY-005 (`reachedStage` floor), F-PAR-001 (report), F-TCH-001 / F-CONSOLE-001 (roster line), F-QUEST-002 (the `teaches` symbol keys), F-TCH-004.
- **External:** native Korean review of the sentence and reply templates; a native Spanish reviewer for the overlay; counsel is not involved (no new personal data; nothing leaves the device but the snapshot).

## 8. Decisions

Binding owner decisions applied (not re-opened): **D1** audience any age; levels are reading levels (*Pictures first* only changes the default length). **D2** romanization hidden-until-tap is allowed in the check as a run-scoped choice; the profile setting is untouched. **D3** one backstop clock, no per-question timer, no combo, no red, no scores on learner screens. **D4** JSON-first bank, generated into the app, validated on the shipped content. **D5** nothing gated; stories and vocabulary remain the free destination. **D6** TTS with a capability check and a text fallback; consonants spoken as sounds. **D7** `card:` SVG art only. **D8** this id. **D10** 12 to 21 questions, <= 6 minutes, shorter for *Pictures first*, never backwards, no cards or stars, seeds the route, teacher override advisory, one shared engine, selectable test language.

Decisions made in this spec (each is reversible):

| # | Decision | Why |
|---|---|---|
| P1 | **Seven rungs of three; always rungs 1 and 2, then either the reading rungs or the two oral rungs** | Gives the 12 floor of D10 without padding, measures listening for every learner who does not read through to sentences (heritage listeners), and a true beginner is asked only 12 easy-to-skip questions |
| P2 | The 12 floor is for runs the engine completes; learner / grown-up exit, "that is enough" after three "not sure", and the backstop clock may end earlier | A learner is never trapped; the result is still computed from evidence |
| P3 | **Quick (<= 15, 4 min) vs Full (<= 21, 6 min)**, default by `levelOrder` | D10 "shorter for Pictures first" without hiding the longer check from a child who reads |
| P4 | Shared engine lives in `packages/content-schema/src/assessment/` (no new package) | Precedent `romanization/`; the console can import it; coverage gate already 100 % there |
| P5 | Placement is stored as its own append-only record, never as completions; the route is **derived** (`effectiveRoute`) from it | Keeps stars, cards, homework and dashboards honest; deterministic; syncs and restores for free |
| P6 | Teacher override = a targeted one-item plan (advisory); parent override = in-app, local, explicit | Needs no server table or inbox field; reuses F-PLAN-001; a class role never edits a learner's progress (F-TCH-001 section 3.6) |
| P7 | "Placed out" is a route concept with its own look; a quest is placed out only when **every** symbol it teaches is covered | Prevents false skips from a three-question sample |
| P8 | `revealMode` is a run setting, pre-selected from the profile's current `romanizationMode` (D2: visible unless the learner opted into hiding; neither choice is recommended; assumption 11); revealed answers do not count | Honors D2 (nothing persistent changes) and keeps the measurement meaningful |
| P9 | Korean test language: audio-only instructions on decoding rungs | Written Korean instructions would leak letter forms |
| P10 | Telemetry carries `level` (the D1 id) but never `learnerType` | REVIEW-1 owner answer 2 |
| P11 | Server first, app second for the two additive fields, plus a Worker preserve rule | Zod strips unknown keys (`schemas/sync.ts:49-56`); an old app re-uploads without the field |
| P12 | `content/placement/` is requested as a new content directory | CLAUDE.md section 2 asks for approval; same pattern as D4's directories |
| P13 | The sampled coverage rule (untested symbols covered by their rung's pass) is accepted | The Hangul Check (F-QUEST-002 section 3.9), priority tokens and ordinary play correct gaps; the alternative is a 30-question census |

## 9. Unverified assumptions

1. **Native review** of the 28 hear/read sentence templates, the 10 reply pairs (replies 4 to 10 are beyond shipped content) and the Spanish / Korean instruction strings. Until signed, those templates stay `draft` and the check runs on the rest (each rung needs >= 9 ready templates per form; the outline has far more for rungs 1 to 5, and vocabulary and sentences fall back to their ready subsets).
2. **Guess resistance** was computed, not measured: with four options, P(pass a rung by guessing) = 0.156, so reaching `syl-cv` pass by luck is about 2.4 % and `sound-rest` about 0.4 %; the simulation test asserts >= 95 % of 1,000 guessers stay at band 1 or lower. Real learners guess differently; recalibrate from telemetry.
3. **Three-question rungs are noisy** (a 2-of-3 pass can come from a lucky pair). The cut-back rule (wrong symbols un-place their quest) and the monotonic retake rule limit the harm; a larger rung would break the 21 ceiling.
4. **Time**: 21 questions in 6 minutes is about 17 seconds each; fast for a child who reads slowly. *Quick* and *Take my time* exist for that; real timings come from `placement.item_answered.ms`.
5. `AccessibilityInfo.isScreenReaderEnabled()` is assumed available through a thin `platform/` wrapper (react-native-web forwards it); not verified on device. Likewise `canPlayKorean()` and `playPrompt` come from F-AUDIO-004 and are assumed to match its spec.
6. The 15-quest layout of F-QUEST-002 and the `teaches` symbol keys (`questTeaches`, F-QUEST-002 section 3.7) do not exist in code yet (8 quests, `questJamo` at `content/sync-context.ts:13-25` gives characters, not final keys). The engine is tested on a fixture; the real-bundle test is enabled by F-QUEST-002 Q-6b.
7. Picture quality of the `card:` art as quiz options (`HeritageCardArt`) was not reviewed for look-alikes; a design pass should confirm no two pictures of one question are confusable.
8. The Web `Home` card and the onboarding fork change screens other specs also edit (`CreateProfileScreen.tsx`, `HomeScreen.tsx`, `ProfileScreen.tsx`); land F-LEARN-001 PR 4b first, then P-7 (mechanical rebase).
9. `PictureRefSchema` / `KoTextSchema` names come from F-QUEST-002 (not in code yet).
10. **Free tier (owner to confirm; assumption, not a decision).** The Journey does not block opening a Stage 2 cell today (the stage header only carries a "Premium" pill, `JourneyScreen.tsx:100`), but F-QUEST-002 section 3.5 makes the cursor skip stages the tier does not include, and this spec follows it: a learner placed at Stage 2 or above on the free tier gets no entitled start quest, the result says "You know a lot! More adventures are coming." and offers stories (free, D5) or the whole map, where every cell stays openable as today. No paywall, price, plan name or purchase button is ever shown to a learner by this spec; the grown-up report only says the stage is "not included with this account yet". The exact words, and whether placed learners should instead keep today's Stage 2 taste quests on the cursor, are the owner's call (PNNL outside-activity and pricing questions stay out of the specs).
11. **D2 and the sound-guide choice (resolved in review).** D2 makes visible romanization the default and "hide until tap" an explicit opt-in (also for placement). The options screen therefore pre-selects the profile's current setting, recommends nothing, and writes nothing back. Consequence for the owner to confirm: a learner on the default setting who just taps NEXT gets the *listening and shapes* check (recognition 3 + oral 6 = 9 questions, `stage1` band 0, decoding strands `not-tested`, a documented exception to D10's 12-question floor), because reading cannot be measured while the answer is printed beside the letters. The grown-up report offers the one-tap retake with the guide hidden (a retake can only move the route forward). Alternatives, owner's choice: (a) accept as is, (b) pad `always` runs to 12 with two extra oral draws of vocabulary and sentences, (c) make hiding the explicit first choice with no pre-selection (one more tap, D2 still respected).

12. **Sentence rungs test less than their names say.** The `sentence` oral draw (`hear-pick-picture`) mostly tests the noun (the picture is the noun of the sentence), so it overlaps `vocab` oral; and the read sentences use vowels Stage 1 never teaches (ㅔ in 에요/예요, ㅐ in 책, ㅘ in 사과, ㅢ in 읽어요), so they are read as chunks with picture support. This only affects the step from `stage2` to `stage3` (which places out Stage 2 grid quests), so a mis-placement is mild; a native-teacher review should decide whether the rung stays, shrinks to the reply items, or waits for F-VOC sentences.
13. **Gloss withheld on an open question.** CLAUDE.md section 1 says taught Korean always shows romanization and a gloss. On an open placement item the gloss of a picture option is withheld because it would be the answer (the romanization follows the sound guide choice). Everything is shown after the run. Owner to confirm this narrow exception.
14. **Mixed-version uploads** are handled by the Worker preserve rule of section 3.8 (shared with F-VOC-005 P-1); until it is deployed the guard is only the order "Worker first, app second".

---

## Appendix A — initial bank outline (EN first; 265 templates)

All romanizations below were produced by the project's pronunciation-based converter (`romanize`, `packages/content-schema/src/romanization/rr.ts:180`, D13); the 131 distinct Korean strings of this appendix were run through the repository converter on 2026-10-10 and all 131 agree, and the bank test compares them again at build time. Counts are per template (one concrete question each). Pictures are `card:` ids that exist in `HeritageCardArt` today.


### A.1 Hangul recognition (`hangul-recognition`, gate `recog`, form `decode`, 40 templates)

Format `shape-odd-one-out`: four tiles, three show one letter and one shows a look-alike; the prompt is "Which one is different?" (spoken and written, no Korean in the instruction). Each pair gives two templates (the odd one is either letter). No audio; no romanization is shown or needed.

| Id pattern | Count | Look-alike pairs (odd one is either) |
|---|---|---|
| `pitem:recog-odd-<a>-<b>` and `pitem:recog-odd-<b>-<a>` | 40 | ㄱㄴ · ㅁㅂ · ㅗㅜ · ㅏㅓ · ㅇㅎ · ㅈㅊ · ㄷㄹ · ㅅㅈ · ㅋㄱ · ㅡㅣ · ㅑㅕ · ㅛㅠ · ㅏㅑ · ㅓㅕ · ㅌㄷ · ㅁㅇ · ㄴㄷ · ㅅㅇ · ㅜㅠ · ㅗㅛ |

Tags: `sym:<odd>`, `sym:<base>`, `look-alike`. `requires`: `{ audio: false, picture: null }`. Instruction audio plays but is not required to answer.

### A.2 Sound-letter mapping (`sound-letter`, gates `sound-basic` and `sound-rest`, 46 templates)

Two formats per symbol. `hear-pick-written`: the prompt is spoken (consonants with the carrier vowel ㅏ, vowels as ㅇ + vowel, F-QUEST-002 §3.12 interim map) and the four tiles are written symbols (the symbol plus the three confusables of F-QUEST-002 §3.9, same kind). `see-pick-sound`: the prompt is the written symbol and the four chips are Latin sound chips of the carrier syllables of the symbol and its confusables (language-neutral, not translated). ㅇ is not tested here (silent as an initial); it is tested inside the syllable templates.

| Gate | Format | Count | Symbols (spoken form -> sound chip) |
|---|---|---|---|
| `sound-basic` | hear-pick-written | 11 | ㅏ (아 -> a), ㅓ (어 -> eo), ㄱ (가 -> ga), ㄴ (나 -> na), ㅗ (오 -> o), ㅜ (우 -> u), ㅁ (마 -> ma), ㅡ (으 -> eu), ㅣ (이 -> i), ㄷ (다 -> da), ㄹ (라 -> ra) |
| `sound-basic` | see-pick-sound | 11 | the same 11 symbols |
| `sound-rest` | hear-pick-written | 12 | ㅈ (자 -> ja), ㅊ (차 -> cha), ㅂ (바 -> ba), ㅅ (사 -> sa), ㅋ (카 -> ka), ㅌ (타 -> ta), ㅍ (파 -> pa), ㅎ (하 -> ha), ㅑ (야 -> ya), ㅕ (여 -> yeo), ㅛ (요 -> yo), ㅠ (유 -> yu) |
| `sound-rest` | see-pick-sound | 12 | the same 12 symbols |

Ids: `pitem:sound-basic-hear-<sym-id>`, `pitem:sound-basic-see-<sym-id>`, `pitem:sound-rest-hear-<sym-id>`, `pitem:sound-rest-see-<sym-id>` (`<sym-id>` is the jamo id without the prefix: `giyeok`, `nieun`, ...). Tags: `sym:<symbol>`, `group:basic|rest`. `requires`: hear = `{ audio: true }`, see = `{ audio: false }`. Leaking when romanization is withheld: both formats (the symbol or its tiles are the tested element).

### A.3 Syllable reading (`syllable-reading`, gates `syl-cv` and `syl-cvc`, 72 templates)

Formats: `hear-pick-written` (spoken syllable; four written syllables that differ from the target in exactly one jamo), `see-pick-sound` (written syllable; four Latin chips that differ in one sound), `build-syllable` (tap the tiles into the blocks; tiles carry explicit jamo ids so a final consonant is a final tile, F-QUEST-002 §3.7).

| Gate | Format | Count | Syllables (romanization generated by the converter) |
|---|---|---|---|
| `syl-cv` | hear-pick-written | 18 | 가 ga, 거 geo, 고 go, 구 gu, 나 na, 너 neo, 노 no, 누 nu, 다 da, 더 deo, 도 do, 두 du, 마 ma, 머 meo, 모 mo, 무 mu, 라 ra, 이 i |
| `syl-cv` | see-pick-sound | 12 | 그 geu, 기 gi, 느 neu, 니 ni, 드 deu, 디 di, 므 meu, 미 mi, 아 a, 어 eo, 오 o, 우 u |
| `syl-cv` | build-syllable | 6 | 가 ga, 나 na, 다 da, 마 ma, 모 mo, 구 gu |
| `syl-cvc` | hear-pick-written | 18 | 달 dal, 물 mul, 문 mun, 산 san, 강 gang, 곰 gom, 밥 bap, 집 jip, 봄 bom, 별 byeol, 공 gong, 줄 jul, 연 yeon, 한 han, 국 guk, 학 hak, 눈 nun, 입 ip |
| `syl-cvc` | see-pick-sound | 12 | 달 dal, 물 mul, 문 mun, 산 san, 강 gang, 곰 gom, 밥 bap, 집 jip, 봄 bom, 별 byeol, 공 gong, 한 han |
| `syl-cvc` | build-syllable | 6 | 달 dal, 물 mul, 문 mun, 산 san, 강 gang, 곰 gom |

Ids: `pitem:syl-cv-hear-<rr>`, `pitem:syl-cv-see-<rr>`, `pitem:syl-cv-build-<rr>`, `pitem:syl-cvc-hear-<rr>`, ... Tags: `sym:<each component>` (initial, vowel, final as `ㄴ/final`), `syl:<rr>`, `shape:cv|cvc`. Every syllable uses only the 24 consonant and vowel jamo and the six taught finals (test).

### A.4 Vocabulary (`vocabulary`, gate `vocab`, 53 templates)

Formats: `hear-pick-picture` (oral form: a spoken word, four pictures) and `read-pick-picture` (read form: a written word, four pictures). Pictures are `card:` art that exists today (`supportedCardIds`, `HeritageCardArt.tsx:21`), so every Stage 1 template here resolves without new art (D7); the Stage 2 ids marked in the note below do not (their cards have no art yet); pictures show no text label during the item. The read list contains only words built from the 24 jamo plus the six taught finals (decodable after Stage 1); the hear list may contain any concrete word. Distractor pictures are three other cards of the picture pool drawn with the seed, never two from the same row of `avoidWith` (for example 김치 and 김밥 are not shown together).

| Form | Count | Words (card id, romanization generated) |
|---|---|---|
| hear | 30 | 김치 `card:kimchi` gimchi, 밥 `card:rice` bap, 젓가락 `card:chopsticks` jeotgarak, 한복 `card:hanbok` hanbok, 김밥 `card:kimbap` gimbap, 떡국 `card:tteokguk` tteokguk, 송편 `card:songpyeon` songpyeon, 호랑이 `card:tiger` horangi, 까치 `card:magpie` kkachi, 무궁화 `card:mugunghwa` mugunghwa, 산 `card:mountain` san, 바다 `card:sea` bada, 달 `card:moon` dal, 윷놀이 `card:yutnori` yunnori, 제기 `card:jegi` jegi, 연 `card:kite` yeon, 팽이 `card:top` paengi, 청자 `card:pottery` cheongja, 가야금 `card:gayageum` gayageum, 책 `card:book` chaek, 한지 `card:hanji` hanji, 붓 `card:brush` but, 사과 `card:sagwa` sagwa, 우유 `card:uyu` uyu, 빵 `card:ppang` ppang, 도시락 `card:dosirak` dosirak, 하늘 `card:haneul` haneul, 꽃 `card:kkot` kkot, 나무 `card:namu` namu, 별 `card:byeol` byeol |
| read | 23 | 김치 `card:kimchi` gimchi, 밥 `card:rice` bap, 한복 `card:hanbok` hanbok, 김밥 `card:kimbap` gimbap, 송편 `card:songpyeon` songpyeon, 호랑이 `card:tiger` horangi, 산 `card:mountain` san, 바다 `card:sea` bada, 달 `card:moon` dal, 연 `card:kite` yeon, 한지 `card:hanji` hanji, 청자 `card:pottery` cheongja, 하늘 `card:haneul` haneul, 별 `card:byeol` byeol, 나무 `card:namu` namu, 우유 `card:uyu` uyu, 가야금 `card:gayageum` gayageum, 연등 `card:lantern` yeondeung, 도시락 `card:dosirak` dosirak, 설날 `card:seollal` seollal, 추석 `card:chuseok` chuseok, 먹 `card:ink` meok, 한글날 `card:hangul-day` hangeullal |

Notes: `card:yutnori` is the card for 윷놀이; `card:rice` is 밥; `card:sagwa`, `card:uyu`, `card:ppang`, `card:dosirak`, `card:haneul`, `card:kkot`, `card:namu`, `card:byeol` are the Stage 2 cards (`stage2Cards`, `heritage-cards.ts:70-82`) and **have no art in `supportedCardIds`**: the 13 vocabulary templates that use them (hear: 사과 우유 빵 도시락 하늘 꽃 나무 별; read: 우유 하늘 별 나무 도시락) and the two sentences 우유를 마셔요 and 사과를 먹어요 (hear + read = 4 templates) start as `draft`. Distractor pictures come from the 30 art-backed cards only. That leaves vocabulary 40 (hear 22, read 18) and sentences 50, so the 40-per-strand minimum is met exactly for vocabulary; adding any Stage 1 word is the safe margin. 먹 is the ink stick (`card:ink`); the read list has 23 words. Ids: `pitem:vocab-hear-<rr>`, `pitem:vocab-read-<rr>`. Tags: `word:<rr>`, `topic:<theme>`. A template whose picture does not resolve is excluded from the draw (never replaced by a text tile).

### A.5 Simple sentences (`sentences`, gate `sentence`, 54 templates)

Formats: `hear-pick-picture` and `read-pick-picture` for the two sentence patterns of blueprint 05 section 3.3, and `reply-pick` (read form: hear a line, choose the reply among three written replies; the Stage 4 taste quest already teaches the first three, `minigame-config.ts:282-310`). Picture options are `card:` art; the target picture is the noun in the sentence. The sentences below were converted with the same pronunciation-based converter F-CNT-002 uses; every romanization is generated at build time and compared (never typed).

| Pattern | Forms | Count | Sentences (romanization) -> picture |
|---|---|---|---|
| N-ieyo / N-yeyo ("it is a N") | hear + read | 28 | 호랑이예요 (horangiyeyo) -> `card:tiger`; 달이에요 (darieyo) -> `card:moon`; 산이에요 (sanieyo) -> `card:mountain`; 바다예요 (badayeyo) -> `card:sea`; 연이에요 (yeonieyo) -> `card:kite`; 팽이예요 (paengiyeyo) -> `card:top`; 까치예요 (kkachiyeyo) -> `card:magpie`; 한복이에요 (hanbogieyo) -> `card:hanbok`; 김치예요 (gimchiyeyo) -> `card:kimchi`; 책이에요 (chaegieyo) -> `card:book`; 붓이에요 (busieyo) -> `card:brush`; 제기예요 (jegiyeyo) -> `card:jegi`; 윷이에요 (yuchieyo) -> `card:yutnori`; 한지예요 (hanjiyeyo) -> `card:hanji` |
| N-eul/reul V-yo ("I eat / drink / read N") | hear + read | 16 | 밥을 먹어요 (babeul meogeoyo) -> `card:rice`; 김치를 먹어요 (gimchireul meogeoyo) -> `card:kimchi`; 김밥을 먹어요 (gimbabeul meogeoyo) -> `card:kimbap`; 떡국을 먹어요 (tteokgugeul meogeoyo) -> `card:tteokguk`; 송편을 먹어요 (songpyeoneul meogeoyo) -> `card:songpyeon`; 우유를 마셔요 (uyureul masyeoyo) -> `card:uyu`; 책을 읽어요 (chaegeul ilgeoyo) -> `card:book`; 사과를 먹어요 (sagwareul meogeoyo) -> `card:sagwa` |
| greeting and reply | reply-pick | 10 | 안녕하세요! (annyeonghaseyo) -> 안녕하세요 (annyeonghaseyo); 이름이 뭐예요? (ireumi mwoyeyo) -> 저는 호야예요 (jeoneun hoyayeyo); 만나서 반가워요! (mannaseo bangawoyo) -> 저도 반가워요 (jeodo bangawoyo); 감사합니다. (gamsahamnida) -> 아니에요 (anieyo); 안녕히 가세요. (annyeonghi gaseyo) -> 안녕히 계세요 (annyeonghi gyeseyo); 잘 지냈어요? (jal jinaesseoyo) -> 네, 잘 지냈어요 (ne jal jinaesseoyo); 이거 뭐예요? (igeo mwoyeyo) -> 김치예요 (gimchiyeyo); 밥 먹었어요? (bap meogeosseoyo) -> 네, 먹었어요 (ne meogeosseoyo); 고마워요. (gomawoyo) -> 천만에요 (cheonmaneyo); 미안해요. (mianhaeyo) -> 괜찮아요 (gwaenchanayo) |

Ids: `pitem:sent-n-hear-<rr>`, `pitem:sent-n-read-<rr>`, `pitem:sent-v-hear-<rr>`, `pitem:sent-v-read-<rr>`, `pitem:sent-reply-<n>`. Tags: `pattern:n-ieyo|n-eul-v|reply`, `word:<noun>`. Reply distractors are two replies of other rows, never a pair that is also a natural answer (the replies to 안녕하세요 and 만나서 반가워요 are not distractors of each other; each template lists its `incompatibleWith` row ids and the bank test checks them). Replies 4 to 10 go beyond the shipped Stage 4 quest and need native review before `status: "ready"` (section 9).

### A.6 Counts

| Strand | Templates | Minimum |
|---|---|---|
| hangul-recognition | 40 | 40 |
| sound-letter | 46 | 40 |
| syllable-reading | 72 | 40 |
| vocabulary | 53 (40 drawable today) | 40 |
| sentences | 54 (50 drawable today) | 40 |
| total | 265 (248 drawable today) | 200 |

## Appendix B — amendments to F-RVW-001 (applied by PR P-0; F-RVW-001 is `draft` and no review code is in the tree, so nothing shipped changes; it stays `draft` until its own PR 1)

| # | Where in F-RVW-001 | Change |
|---|---|---|
| B1 | Header `Scope` | add `packages/content-schema/src/assessment/` (shared question engine, owner F-PLC-001) |
| B2 | Section 3.5 (engine separation) | After the first bullet: "Selection helpers (`selectSpread`, `placeCorrect`), the seeded RNG, the attempt session (`startSession`, `answer`, `skip`, `expire`, `tally`) and the session clock live in `@hangul-route/content-schema` (`src/assessment/`, F-PLC-001 section 3.3). `apps/mobile/src/logic/reviews/` keeps Daily Pool, star math, stage balance and banned text and imports the shared module." |
| B3 | Section 3.7 "Session clock" | "implemented once by `expire` (unanswered -> `skipped`, never `wrong`, the 1-star floor unchanged)" |
| B4 | Section 3.2 Pool C | "For the first three Daily Tests after a placement, the `sym:` entries of the newest placement result's `priorityTokens` take the Pool C slot in turn, one per test, each once (Pool C stays one forced item; `skill:` tokens are not items and are ignored here) (F-PLC-001 section 3.7)." |
| B5 | Section 4 "Adaptive difficulty" | append: "The placement check (F-PLC-001) is the one adaptive use: it lives in `src/placement/`, runs once at the learner's request, decides only which rung comes next, and is never a review. The shared session reducer (`assessment/session.ts`) stays non-adaptive and is used by both." |
| B6 | Section 6 Tests | unit rows for `daily-pool`, `star-calc`, `stage-balance`, `banned-text` stay; the "end-to-end attempt lifecycle" row tests the composition with `assessment/session`; the shared reducer's own tests live in `packages/content-schema/src/__tests__/assessment-*.test.ts` |
| B7 | Section 8 Upstream | add F-PLC-001 PR P-1 (shared engine); `ReviewEntrySchema` (`schemas/progress.ts:65-73`) unchanged |
| B8 | Section 3.4 / F-QUEST-002 section 3.9 | no change; `buildHangulCheck` may later emit `AssessmentQuestion`s |
| B9 | Section 3.3 (Feedback Review) | no change of behaviour: the 15 s auto-skip is recorded `skipped` through `session.skip` (the shared outcome set is `correct`, `wrong`, `skipped`; there is no `timeout` outcome) |

## Appendix C — rung and path summary (for implementers)

```
rung 1 recog        always (if visual)            3 questions  hangul-recognition
rung 2 sound-basic  always                        3 questions  sound-letter           fail -> oral rungs
rung 3 syl-cv       if rung 2 passed              3 questions  syllable-reading      fail -> oral rungs   (quick ends here -> oral rungs)
rung 4 sound-rest   if rung 3 passed              3 questions  sound-letter           fail -> oral rungs
rung 5 syl-cvc      if rung 4 passed              3 questions  syllable-reading      fail -> oral rungs
rung 6 vocab        read if rung 5 passed         3 questions  vocabulary             read fail -> vocab oral (once, stop)
rung 7 sentence     read if vocab read passed     3 questions  sentences               end
oral rungs          vocab oral, sentence oral     6 questions  (every run that did not pass rung 6 read; a failed vocab read adds vocab oral only)
```

Path lengths: 12 (fail rung 2) · 15 (fail rung 3, or quick) · 18 (fail rung 4) · 21 (fail rung 5, or pass through rung 7, or fail vocab read).

## Appendix D — prototype simulation (not a test; the tests assert the thresholds in section 5)

A throwaway simulation of the ladder of section 3.5 (re-run and checked exactly in review: the question counts are 12, 15, 18 or 21 in full, 12 or 15 in quick, and the guesser rows below match the closed forms; a 2-option guesser would reach band 2 or higher in 12.6 % of runs, hence the 3-option minimum of section 3.4) with fixed per-question accuracy per rung, 1,000 runs each, full length unless marked quick (scratch files, not in the repo):

| Simulated learner | Questions asked | Placed (share of runs) |
|---|---|---|
| zero knowledge (25 % correct on 4 options) | 12 to 21 | `stage1`/0 97.5 %, /1 2.1 %, /2 0.3 %, /3 0.05 % (exact: 1 - 0.156^2, 0.156^2 x 0.844, ...) |
| pure guesser (33 % correct on 3 options) | 12 to 21 | /0 93.3 %, /1 4.9 %, /2 1.3 %, /3 0.4 %, `stage2` 0.1 % (98.2 % at band 1 or lower) |
| knows letter sounds, cannot blend (90 % / 30 %) | 12 to 21 | /0 78.1 %, /1 18.0 %, higher 3.9 % |
| decodes well, cannot yet read words (92 % on decoding, 30 % after) | 12 to 21 | /3 72.9 %, `stage2` 15.7 %, `stage3` 4.1 %, lower 7.3 % |
| heritage listener (25 % reading, 90 % listening) | 12 to 21 | /0 97.7 % (listening level reported separately) |
| advanced (97 % everywhere) | 12 to 21 | `stage3` 98.6 % |
| any learner, Quick | 12 to 15 | never above band 1 (quick stops after `syl-cv`) |

Reading the table: a guesser is placed at band 1 or lower in more than 98 % of runs (the section 5 threshold is 95 %), the 12-question floor is the common case for a learner who does not read yet, and the Quick length is intentionally capped, which is why the report offers the full check after a clean quick run.
