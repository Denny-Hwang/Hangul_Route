Status: ready

# F-PLC-001 — Placement (the level check): choose a test language and a length (Short, Standard or Deep), answer a short adaptive run, start the route at the right spot

> Start order: P-1 (shared question engine) and P-2 (schemas, telemetry names) have no external dependency and can start now; P-2 must be **deployed to the API before** any app build that sends the new snapshot or summary fields (section 3.8). P-4 (bank content) shipped every template `ready` after the production review of 2026-10-11, which the owner decided replaces the native-speaker review (section 9, item 1). The route integration (P-5) works against today's 8 Stage 1 quests and against F-QUEST-002's 15 without code change; the full mapping table of section 3.6 is tested against a 15-quest fixture now and against the real bundle once F-QUEST-002 Q-6b lands.

**Scope**: `packages/content-schema` (new `src/assessment/` shared question engine, new `src/placement/` adaptive engine and route seed, `schemas/placement.ts`, additive `ProgressSnapshot` / `ProgressSummary` fields, telemetry names) · `content/placement/` (question bank, JSON-first, D4) · `content/i18n/{es,ko}/placement.json` (overlays) · `scripts/` (bank builder and validator rules) · `apps/mobile` (`logic/placement/`, `store/placement-run-store.ts`, `screens/placement/`, onboarding fork, Home / Profile / Journey / Parent changes, flag) · `apps/web` (`lib/console/placement.ts`, roster line, advisory plan hand-off) · `packages/i18n` (strings under `learner.placement`, `caregiver.placementReport`)
**Owner**: solo dev
**Rollout**: after F-I18N-001 PR 4 (`KoreanText`) and F-AUDIO-004 A-4 (`playPrompt`, `getCapability`, `canPlayKorean`), in parallel with F-QUEST-002; behind `flags.placementEnabled`, on by default on every platform since P-10 (2026-10-14; `EXPO_PUBLIC_PLACEMENT_ENABLED=false` or `0` is the kill switch). PR order in section 6.
**Wireframes**: `wireframes/placement.md` (drafted with this spec) -> promoted to `design/wireframes/placement/` (`invite`, `language`, `options`, `handoff`, `warmup`, `item`, `item-short`, `pause`, `sound-needed`, `result`, `report`, `home-entry`) (AM-15; promoted in P-0, 2026-10-11; `placement.md` is now the flow overview)

Parent / siblings: CLAUDE.md section 1 (levels, languages, anti-shame, grid) · F-RVW-001 (**shares one question engine, section 3.3 and appendix B**) · F-LEARN-001 (level labels, `levelOrder`) · F-I18N-001 (`getMessages(locale)` with an explicit locale, `LOCALE_META`, `romanizationShown`, overlays) · F-AUDIO-004 (`playPrompt`, `canPlayKorean`, spoken forms) · F-QUEST-002 (the 15 Stage 1 quests and 30 symbols, confusables, Listen & Pick, the Hangul Check) · F-CNT-001 / F-CNT-002 (validator, romanization) · F-STORY-004 / F-STORY-005 (`reachedStage` takes the placement as a floor; shelf stories never gated) · F-PLAN-001 / F-PLAN-002 (plans; the planner reads the level) · F-PAR-001 (parent dashboard) · F-TCH-001 (roster, no ranking) · F-HW-001 (3-card home, anti-shame) · F-PROF-001 (profiles) · design input `design-inputs/level-test.md` · blueprint 02 section 2 (diagnosis), blueprint 04 section 8.1 (motivation -> theme order), blueprint 05 section 1.4 (Stage 1 completion), section 3.3 (sentence patterns)

---

## 1. Context

There is no placement today. A new learner always lands in the first shipped quest, the Journey cursor is "the first quest in content order that is not done", and nothing lets a learner who already reads some Hangul skip what they know. The decision D10 (owner, 2026-10-10) asks for a 12 to 21 question adaptive check, at most 6 minutes (shorter for *Pictures first*), over five skills, in a test language the learner picks, that **never moves the route cursor backwards, grants no cards or stars, and seeds the route**; teachers can only advise; the engine is shared with F-RVW-001. On 2026-10-11 the owner split the check into three lengths (P14): **Short** for learners who do not read yet (6 to 9 questions, every question starts from a sound and takes one tap), **Standard**, the default (12 to 24 questions, usually under 10 minutes), and **Deep**, a careful check that confirms every step that moves the route (12 to 42). D10's question count and time limit apply to Standard, as amended by P15 to P17. (AM-16)

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

**What this spec does.** (1) A shared, pure **question engine** (`packages/content-schema/src/assessment/`) that placement and F-RVW-001 both use; (2) a pure **adaptive placement engine** (rungs of three questions, run in one of three modes: Short 6 to 9 questions, Standard 12 to 24, Deep 12 to 42; AM-16) with scoring, a level on the 7-stage grid and a mapping onto F-QUEST-002's Stage 1 quest list; (3) a **question bank** (`content/placement/*.json`, 260 templates after the production review) validated like all content, English first, Spanish and Korean as overlays; (4) the **screens** (test language, options, warm-up, items, pause, result), the onboarding fork "I already know some Korean", the Home "Take the level check" card, Profile and parent entries; (5) `seedRoute`, the **route seed** that tells the Journey cursor, the first-quest preview, the curriculum planner and the summaries where this learner starts, without writing a single completion; (6) retake rules, the **parent report and in-app override**, the **console roster line** and the advisory hand-off to the plan builder.

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

Screen ids: `placement/invite`, `placement/language`, `placement/options`, `placement/handoff`, `placement/warmup`, `placement/item`, `placement/pause`, `placement/sound-needed`, `placement/result`, `parent/placement-report` (AM-15); changed: `onboarding/first-quest-preview`, `home/todays-mission`, `journey/grid`, `profile/settings`, `parent/dashboard`, `console/roster`.

1. **Fork (`placement/invite`).** Inserted after CreateProfile and before FirstQuestPreview (`CreateProfileScreen.tsx:79` becomes `navigation.replace('PlacementInvite', { profileId })` when `flags.placementEnabled`; the route is added to `navigation/onboarding.tsx` and `OnboardingStackParamList`). Two big choices, equal weight: **I am new to Korean** (-> `FirstQuestPreview`, unchanged, records only `placement-ui:<profileId>.declinedAt`, fires `placement.skipped`) and **I already know some Korean** (-> `placement/language`). A small line says it takes a few minutes and can be stopped at any time (`invite.duration`; no digits; AM-17). Nothing here is a test of the grown-up; the screen works for a child alone (large targets, spoken prompt).
2. **Test language (`placement/language`).** Shown only when more than one locale is shipped (`availableLocales()`, F-I18N-001); with English only, the screen is skipped and `testLocale = 'en'`. Tiles show endonyms (English, 한국어, Español) from `LOCALE_META`. Default selection = the effective UI locale (profile override, else device, else detected). Tapping a tile selects it and plays one short spoken instruction in that language (`playPrompt` with `LOCALE_META[l].speechLang`; silent if unavailable). A tile for a locale whose voice cannot be played is still selectable for **en** and **es** (their instructions are also written); `ko` is disabled with the line "No Korean voice on this device" when `canPlayKorean(getCapability())` is false, because Korean instructions on reading items are audio-only (section 3.2). The choice sets `testLocale` for this run only; it never changes the UI locale or any profile setting. When the chosen test language has no instruction voice on this device (`hasVoiceFor(LOCALE_META[l].speechLang)`, a small addition to `platform/audio` in P-6; "unknown" counts as available, so it never blocks by mistake), the tile shows "No voice for this language here". It stays selectable for `en` and `es`, but Short is not available for that language (step 3). (AM-17)
3. **Options (`placement/options`)** is a **grown-up screen**: whoever sets the check up uses it, and the learner then only listens, looks and taps. Every label on it is also spoken when tapped. (AM-18)
   - **Mode** (P14): three equal radio tiles, **Short**, **Standard**, **Deep**. Each has a label, a one-line help (`options.mode.<m>.help`) and a duration line (`options.mode.<m>.duration`, hidden while *Take my time* is on). There is no "recommended" badge, and the tiles never say "easy", "hard", "test" or an age. The pre-selection (`flow.ts defaultMode(levelOrder, effectiveLevel, lastResult, shortAvailable)`) is the **first rule that matches**, in this order:

     1. The newest result is a Short whose report hint fired (section 3.9; this includes a Short held at `stage1` band 0 only by the 3-of-3 rule) -> **Standard**.
     2. The effective level is above `stage1` band 0, whatever `levelOrder` -> **Standard**. Short is never pre-selected at or above its own ceiling (`stage1` band 1), because it could not move the route. At `stage3` band 0 Standard is still pre-selected: no mode can move the route there, and a retake only adds history (P20).
     3. `levelOrder(profile.ageGroup)` is 0 and Short is available -> **Short**.
     4. `levelOrder` is 0 and Short is not available -> **Standard**.
     5. Otherwise (`levelOrder` 1 or 2, or unknown) -> **Standard**.

     Deep is never pre-selected. Whenever Short is not available, its tile is disabled with "The short check needs sound." (`learner.placement.options.mode.short.needsSound`), whichever rule matched. A screen reader never changes the mode; it only pre-sets *Take my time* (below). The effective level is `effectiveRoute(placements, ...).level`, or `stage1` band 0 when there is no result.

     **Short is available** when `shortAvailable(canPlayKorean(getCapability()), hasVoiceFor(LOCALE_META[testLocale].speechLang))` is true. Both inputs are read when the options screen opens, before the warm-up has run; a later warm-up failure is handled by `placement/sound-needed` (step 4). `levelOrder` is a reading-level id (F-LEARN-001), not an age.
   - **Layout for `levelOrder` 0.** When the pre-selected mode is **Short** (rule 3), one pre-filled card (wireframe C1) shows it with a **Change** link, and one primary **Start** button with an icon. Nothing has to be read or chosen first, and Short asks no sound-guide question (section 3.2, P19). **Change** opens the full screen (C2; *Take my time* and *Why Korean?* live there). When Standard is pre-selected (rules 1, 2 and 4), a `levelOrder` 0 learner gets the full screen C2 with the sound-guide question, so a Standard or Deep run never starts without an explicit `revealMode`.
   - **Tiles on small and wide screens.** The three mode tiles sit side by side only when the content is at least 480 pt wide and the font scale is at most 1.3; otherwise they stack in one full-width column. On wide windows the C1 card, the C2 controls and the item grid stay centred inside `Screen width="reading"` (F-LAYOUT-001, `maxWidth.reading`). The tiles are radios (`accessibilityRole="radio"` with `selected` and `disabled` state), and a disabled Short tile has `options.mode.short.needsSound` as its accessibility hint.
   - **Sound guide** (D2, OD-1 (c), AM-14), for Standard and Deep: asked first, with nothing pre-selected. NEXT stays disabled until one of *Always show it* or *Show it only when I tap* is chosen. Neither choice is recommended, highlighted or described as better. One neutral sentence states the consequence: "With the guide shown, the check looks at shapes and listening. With it hidden until you tap, it can also look at reading. Your own setting is not changed." The profile setting (`ProfileSettings.romanizationMode`, F-I18N-001) is never written. Choosing *Always* limits the check to listening and pictures (section 3.2).
   - **Take my time** (switch, off): removes the inactivity pause and the backstop clock. Pre-set to on when a screen reader is on (`AccessibilityInfo.isScreenReaderEnabled()`, read in `platform/`).
   - Optional **Why Korean?** four icon choices (my family, K-culture, just curious, a Korean friend; blueprint 02 section 2.2 step 2) + "Skip". It only sets the theme order of the route (blueprint 04 section 8.1).
3a. **Hand-off (`placement/handoff`)**, shown after options when Short is chosen or `levelOrder` is 0, in any mode. A large Hoya button and one spoken line, "Ready? Tap Hoya to start." (`learner.placement.handoff.ready`). Below it, one line for a grown-up, written and spoken once: "Helping? Let them choose. 'Not sure' is a fine answer." (`learner.placement.handoff.helper`). The screen has no age words and no shame words. Tapping Hoya opens the warm-up (or, after **Check without sound**, the first scored question; step 4). Test: a `levelOrder` 0 learner goes from options to the warm-up only through controls that have a spoken label and an icon (`flow.test.ts`). Reason: a grown-up sitting beside a young learner is the most likely set-up, and a grown-up who answers for the learner makes a false high that the union rule keeps. (AM-19)
4. **Warm-up (`placement/warmup`).** One unscored question (`pitem:warmup-rice`: hear a word, tap the picture) with Hoya showing how it works. It checks audio. A `playPrompt` result of `unavailable` sets `config.audio = false` for the whole run (audio-required templates leave the draw; section 3.5). (AM-20)
   - In **Standard and Deep** for a learner who is not listen-first, a one-line note says "No sound here, so we will use pictures and reading".
   - In **Short**, and for a **listen-first** learner (`levelOrder` 0) in any mode, the run does not start. A grown-up screen (`placement/sound-needed`) shows an icon, "Turn on sound to play", **Try again**, **Start learning** (to `FirstQuestPreview` or Home, nothing recorded), and a link **Check without sound**. That link is the grown-up's explicit choice of a Standard run with listen-first off. It returns to the full options screen (C2) with Standard selected, the Short tile disabled and the sound-guide question unanswered (NEXT disabled until it is answered), so the run never starts without an explicit `revealMode`. The warm-up is not repeated: `config.audio` stays `false`, and NEXT goes to the hand-off when `levelOrder` is 0, then to the first scored question.

   The warm-up's tap also unlocks audio for the run. Its word is passed to the engine as `avoidTags` (its `word:` tag), so no scored question repeats it. It is not recorded in the result.
5. **Items (`placement/item`).** Each question: Hoya line (one short sentence), the prompt (picture, Hangul via `KoreanText`, or a speaker button), 2 to 4 `ChoiceCard`s, a quiet **I am not sure** button (same size as a choice, never red), a **footstep trail** that only fills (no count), and a visible **Let us start learning** exit (section 3.5, stop reason `quit`). Answers are final: no right or wrong feedback, no retry, no hint; a neutral "Got it" (not in Short) and the next question. Every third answer Hoya says an encouraging line (rotating, in `learner.placement.cheer`), regardless of correctness. Prompts play on open in every mode, because the warm-up's tap unlocked audio for the run. The first question after a resume (**Continue**, step 8) or a cold start plays on a tap of a large speaker instead (`learner.placement.item.tapToHear`), because no gesture has unlocked audio yet. With a screen reader on, prompts never auto-play; they play when the focused speaker is activated (section 3.12). "Hear it again" is unlimited. There is no per-question timer (D3): a question stays open until it is answered or the learner taps **I am not sure** (recorded `skipped`). If nothing at all is touched for 45 seconds (unless *Take my time*) the pause sheet of step 6 opens and the open question is not recorded; no countdown is shown.

   **Short layout** (wireframe `item-short`; the engine is the same; AM-21):
   - **Portrait:** nothing scrolls at 320 x 568, up to 200 % text. **Landscape:** two columns (the exit, Hoya and the prompt on the left; the 2 x 2 grid with **I am not sure** under it on the right), which fits 568 x 320 at the default text size. Where it cannot fit (landscape at a large text size), the grid scrolls while the prompt and **I am not sure** stay pinned.
   - Four cards in 2 x 2 at `touchTarget.child` or larger. **I am not sure** has its own full-width row (full width of its column in landscape) with a Hoya shrug icon and a spoken label.
   - The exit is an icon with a spoken label.
   - The prompt plays on open (the warm-up tap unlocked audio), except the first item after a resume or a cold start, which plays on a tap of a large speaker (step 5 above). The choices are enabled when the prompt's playback reports its end **or** after a fallback delay (the estimated prompt length plus 3 seconds, at most 8 seconds), whichever comes first, so a play that never reports its end cannot lock the screen. **I am not sure** and the exit are always enabled. If the prompt cannot play, section 3.11 applies.
   - The instruction is spoken only on the first item of each rung; later items play only the Korean prompt.
   - An answer is acknowledged by the footstep trail filling, with no "Got it" word.
   - Hoya cheers every 2 answers with effort-only lines (`learner.placement.cheerShort`, for example "Thanks for listening!"). That list may not contain "right", "correct", "got it", "perfect" or "great job" (copy test).

   **Listen-first** (`levelOrder` 0, every mode, and every Short run): only formats in `LISTEN_FIRST_FORMATS` are drawn, which is every format except Latin sound chips (`see-pick-sound`) and tile building (`build-syllable`): `shape-odd-one-out`, `hear-pick-written`, `hear-pick-picture`, `read-pick-picture` and `reply-pick` (section 3.5). The reading formats stay in, so a listen-first learner who reads can still reach `stage3` in Standard and Deep. Short's rungs (`sound-basic`, `vocab` oral, `syl-cv`) have no other listen-first format than the sound-led ones, so every Short question starts from a sound.
6. **Pause (`placement/pause`).** It is spoken, with two large icon buttons (**Keep going** / **That is enough, start learning**) and the grown-up PIN link (`gateRequired`, F-LEARN-001; stop reason `grown-up`). It opens: (AM-22)
   - after three "not sure" in a row (**not in Short**: Short is at most nine questions and its exit stays visible);
   - after 45 seconds without any touch (unless *Take my time*; nothing is recorded for the open question, which is asked again on **Keep going**);
   - when the learner opens the exit (engine event `exit`);
   - when the app leaves the foreground (`AppState` is `background` or `inactive`: the screen locks or another app opens). The caller sends `exit`, so the backstop stops, and the sheet is shown on return.

   **That is enough, start learning** ends the run with `not-sure` when the sheet opened after three "not sure", and with `quit` otherwise (the idle pause, the exit, the background, Deep's rest card).

   **Rest card (Deep only):** after 18 answers, when more rungs remain, a spoken, number-free card says "Hoya is stretching. Keep going?" with the same two buttons. It shows once per run.

   The backstop clock stops while the pause sheet, the exit sheet or the rest card is open (**Keep going** moves the deadline by the time spent paused).
7. **Result (`placement/result`).** Hoya cheering; "Hoya found your starting spot!"; a mini grid (7 x 5) with a pin on the start cell and a light outline on placed-out cells; three route cards **Start here** (start quest title), **Next** (the next one or two quests on the route), **Later** (the next stage title).
   > **Amended by F-ENT-003 (2026-10-11).** When the start quest is closed for a free learner (effective switch on), the primary action starts `routeNext` (always open); when `routeNext` is `free-end` with `placedOut` (the learner tested out of the free lessons), it opens the first free word topic. The pin still marks the start cell (F-ENT-003 §3.6, PR E3-4).

   **Weekly plan strip.** Shown when `flags.routeEnabled`, `proposeRoute` (F-PLAN-002 section 3.1a) returns a proposal, the plan prompt is not dismissed (AM-6, section 3.10), and the profile is a **self** profile (`effectiveLearnerType(profile) === 'self'`, `apps/mobile/src/logic/profiles/learner-type.ts:20`). Visibility does **not** use `gateRequired`, which is device-level (`learner-type.ts:52-57`: true with a PIN or any child on the device); `gateRequired` only decides whether a grown-up destination needs the PIN.

   | | device without a PIN, self-only | device with a PIN, or with a child profile |
   |---|---|---|
   | self profile | strip; **Use this plan** with one tap | strip; **Use this plan** with one tap, no PIN (it is the learner's own plan; OD-14) |
   | child profile | cannot occur (a child makes the device "family") | no strip; the link reads **For grown-ups: set up a weekly plan** and the grown-up finds the proposal first on the report (AM-5) |

   The strip: "Hoya made a weekly plan for you", the length and pace in words ("4 weeks, 3 days a week, about 15 minutes a day"), three pace chips (Gentle 2 / Steady 3 / Brisk 4, one pre-selected, `AMENDMENTS-PLC-PLAN-HANDOFF.md` section 1.1), the primary **Use this plan** (creates the plan with exactly what is shown, derives its first week, fires `route.created`, then opens the start quest, or the first plan item when `startQuestId` is `null`) and a ghost **Change** (opens `RouteProposal`). Below the strip: secondary **Just start** (resets the stack to Main plus `QuestPlayer` on the start quest, the pattern of `FirstQuestPreviewScreen.tsx:30-41`; records `route.proposal_skipped` and dismisses the prompt, AM-6), then the text links **See my route** (F-ROUTE-001 `MyRoute`; **See the whole map** while `flags.myRouteEnabled` is off) and **For grown-ups** (PIN gate -> `parent/placement-report`). Four actions in all; **Use this plan** is the only primary.

   **Without the strip** (flag off, child profile, dismissed, or `proposeRoute` returns `null`): primary **Start**, links **See my route** (or **See the whole map**) and **For grown-ups**.

   The only words about level are the stage title and the band label ("Letters and sounds", "Reading words"), never a number, ratio, percent or word such as "score", "passed", "failed", "level 3" (CLAUDE.md section 1, F-RVW-001 section 3.1). If the route has no entitled quest left (`startQuestId === null`): "You know a lot! More adventures are coming." with **Open stories** (Library) when a reviewed shelf story exists, else **See the whole map**. If a retake does not change the route: "Your route stays right where it is." (no comparison words). If a retake raises the starting spot and the profile has an active self plan, the strip is replaced by "Hoya found a later place to start." / "Your weekly plan can move ahead and keep the same end date." with **Update my plan** (applies `proposeRoute` with `existing`: the future skips what is now known, length and end date kept, past days keep their items) and the ghost **Keep my plan**. For a retake that changes nothing the learner line becomes "Your plan stays right where it is." A **retake** never moves the start earlier: the level only rises (`higher()`, `placement/route-seed.ts:145-146`) and results only add placed-out ids. A **grown-up override** may move it earlier: it removes ids from the placed-out set (`route-seed.ts:169-178`); the put-back quests then return to the plan's future queue. (AM-2)

   **Headline when reading was not tested (OD-1, default (c); AM-14).** For Standard and Deep the options screen asks first whether to show the sound guide, with no pre-selection (one more tap; D2 respected). When the decoding strands are `not-tested`, the result headline is **Here is a good place to start** (not "Hoya found your starting spot!"). It is followed by "We checked listening and shapes. To find where to start reading, try the check with the sound guide hidden." On a **self** profile a text button follows, **Try it with the sound guide hidden** (one-tap retake). On a **child** profile no text button is shown to the learner; the retake offer is on the parent report. The weekly-plan strip, when shown, sits below that line. (AM-23)

   **After a Short run.** When the report hint fires (section 3.9), a self profile also gets a quiet link, **Try the standard check** (`learner.placement.result.tryStandard`). A child profile gets nothing extra on this screen. A Short result never says the check is for younger learners. (AM-23)
8. **Resume.** The run state is written after every answer (`placement-run:<profileId>`). Reopening within 24 hours offers **Continue** or **Start again**; older or from another bank version is discarded silently.

### 3.2 Test language and the sound guide (D2, D10)

- **`testLocale`** (`UiLocale`) selects: the Hoya lines and instructions (`getMessages(testLocale).learner.placement`), the instruction audio language, and the labels of picture options for screen readers (`labelEn` via the overlay of that locale). Taught Korean content is identical in every language.
- **English / Spanish**: every instruction is written and spoken.
- **Korean**: instructions on `decode`-form rungs (`recog`, `sound-basic`, `syl-cv`, `sound-rest`, `syl-cvc`) are **audio plus icons only** — no visible Hangul sentence — because reading a Korean instruction would show letter forms of the very symbols being tested. Test (T-leak): in the `ko` messages, `learner.placement.instruction[format].visible` is `null` for the four formats that test letter forms or sounds (`shape-odd-one-out`, `hear-pick-written`, `see-pick-sound`, `build-syllable`) and may be a written sentence for `hear-pick-picture`, `read-pick-picture` and `reply-pick` (their tested element is a word or sentence, which a generic instruction cannot reveal). Picture options carry no text label in Korean (a Korean label would equal the answer); screen-reader users therefore get vocabulary and sentence rungs as `not-tested` when `testLocale === 'ko'` and a screen reader is on (reported, never a failure).
- **Sound guide / romanization (D2).** The profile setting `romanizationMode` is **not read and not changed** by the check. The run has its own `revealMode`, `'tap'` or `'always'`, **chosen on the options screen for this run only, with nothing pre-selected** (OD-1 (c), AM-14; the engine has no default of its own), except in Short (below; AM-24). The app never starts a Standard or Deep run without that choice, including a `levelOrder` 0 learner and the **Check without sound** path (section 3.1 steps 3 and 4).
  - `tap`: for any item flagged `leaks: true` (all `decode` formats, `read-pick-picture`, `reply-pick`'s written replies) the romanization of the tested element is hidden; a small "Show how it sounds" reveals it for that item only. A **revealed** answer is recorded `assisted: true` and counts like "not sure" (neither pass nor fail) for gate scoring, and its symbols are not counted as covered (section 3.6). The gloss of picture options is never shown on the item.
  - `always`: the engine draws only templates with `leaks: false` (`shape-odd-one-out` and `hear-pick-picture`; `hear-pick-written` leaks because its written options show the tested symbol), so the check measures shapes and listening to words and sentences; the decoding strands become `not-tested`, the level is the conservative `stage1` band 0 and the report says "not measured" (section 3.9). Choosing `always` is allowed and never presented as worse; such a run asks fewer than 12 questions (recognition 3 + oral 6), which is the documented exception to the floor.
  - **Short and the sound guide (P19).** Short asks no sound-guide question and runs with `revealMode: 'tap'` without a **Show how it sounds** button. While a Short question is open, the letter tiles of a `hear-pick-written` item show no romanization: the romanization would be the answer, and a learner who does not read yet cannot use it. Everything is shown after the run. This is the second narrow exception after assumption 13. (A Short run with `revealMode: 'always'` stays defined in the engine, 6 questions of words and shapes at `stage1` band 0, but the app never starts one.) (AM-24)
  - After the run (result, report) all romanization and glosses are shown (CLAUDE.md section 1). Withholding the gloss of a picture option while the question is open is the one narrow exception to "taught Korean always shows a gloss" in this spec (the gloss would be the answer); it is listed for owner confirmation in section 9, assumption 13.
- **Item copy rule.** Hoya's one-line text on an item never names the answer, a letter, or a Korean word (test T-copy).
- **Spoken forms.** A symbol is spoken as a sound (consonant + carrier vowel, vowel as ㅇ + vowel), never by its name (F-AUDIO-004, D6).

### 3.3 The shared question engine (`packages/content-schema/src/assessment/`, 100 % covered)

Pure TypeScript, no React, no platform, no clock reads, no randomness except through an explicit seed. It is the single implementation for placement (this spec), daily reviews and the Hangul Check (F-RVW-001, F-QUEST-002 section 3.9). Exported from `src/index.ts` as `export * from './assessment'` (the `romanization/` directory at `src/index.ts:18-23` is the precedent for a logic folder inside the package).

| File | Exports | Rule |
|---|---|---|
| `question.ts` | `ASSESSMENT_FORMATS`, `AssessmentOptionSchema`, `AssessmentQuestionSchema`, `OutcomeSchema` (`'correct' \| 'wrong' \| 'skipped'`; a tap on "I am not sure" and every unanswered question are `skipped`, never `wrong`), `AssessmentResponseSchema`, types | The built question the player renders (below). |
| `rng.ts` | `hashSeed(parts: string[]): number`, `createRng(seed): () => number` (mulberry32), `shuffleSeeded<T>(items, rng)`, `sampleSeeded<T>(items, n, rng)` | Replaces the private LCG in `round-builder.ts:16-25` for new code; that file is not edited here. |
| `options.ts` | `placeCorrect(options, rng, avoidFirst = true)` | Shuffles so that over any 200 seeds the correct option is first in at most 35 % of cases (test), never the same index three times in a row within a run. Placement calls `placeCorrect(options, rng, false, recent)`: it keeps the "never the same slot three times in a row" rule but does not move the correct option off slot 0. Measured: with `avoidFirst = true` the correct option sits in slots 1 to 3 with probability 7/24 each, so a tapper who never picks the first card is placed above band 0 in 4.35 % of Standard runs (uniform guessing 3.2 %); with `false`, every tapping pattern stays at chance or below. The shared default stays `true` for reviews. (AM-25) |
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
  noSound: z.literal(true).optional(),                 // additive (post-merge #258): the heard prompt could not play; kept out of scoring (section 3.11)
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
  reviewedBy: z.string().trim().min(1).max(16).optional(), // language review record of a sentence template (section 9)
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export const PlacementBankSchema = z.object({ version: z.number().int().positive(), templates: z.array(PlacementTemplateSchema).min(1) })
  .superRefine(/* ids unique; strand matches the gate table below; each (gate, form) with status ready has >= 9 templates (three full draws); tags reference known symbols; sentence / vocab templates carry a resolvable picture requirement; see rules */);
```

- Gate -> strand -> forms (also exported as `RUNG_TABLE`): `recog` -> hangul-recognition (decode) · `sound-basic` and `sound-rest` -> sound-letter (decode) · `syl-cv` and `syl-cvc` -> syllable-reading (decode) · `vocab` -> vocabulary (read, oral) · `sentence` -> sentences (read, oral).
- **Tags** drive scoring and spreading: `sym:<symbol key>` (`sym:ㄱ`, `sym:ㄴ/final`), `group:basic|rest|final`, `syl:<romanization>`, `shape:cv|cvc`, `word:<romanization>`, `topic:<theme>`, `pattern:n-ieyo|n-eul-v|reply`, `look-alike`. A template of `sound-basic` / `sound-rest` / `syl-*` carries one `sym:` tag per component.
- **Validation** (vitest in `packages/content-schema/src/__tests__/placement-bank.test.ts` reads the JSON with `fs`; plus `scripts/validate-content.mjs` rules for the plain-Node CI step): the Korean policy of F-CNT-001 (every Korean-bearing object has `romanization` and `en`), romanization equals the converter output for every `ko` that is not a single jamo (`checkRomanization`, `romanization/compare.ts:90`), `leaks` is true for every format except `hear-pick-picture` and `shape-odd-one-out`, every scored template has at least 3 options (4 except `reply-pick`; the guess-resistance figures of section 9 assume it), `requires.audio` is true exactly for formats that start from audio, no `sentences` template is `ready` without its language review record (`reviewedBy` and `reviewedAt`; rule `placement-sentence-ready`), every single jamo carries a value of the jamo table (`checkJamoRomanization`, `JAMO_SOUND_VALUES`: ㄱ `g/k`, ㄷ `d/t`, ㄹ `r/l`, ㅂ `b/p`, ㅇ `silent/ng`, and the same value wherever the letter appears), no picture item offers two pictures that show the same thing or belong to each other (the conflict list of the bank test), no Stage 2 card appears, every symbol of `RUNG_SYMBOLS` is covered by at least two templates of its gate, per-format pools the modes rely on (`PLACEMENT_MIN_FORMAT_READY` in `PlacementBankSchema`, next to the nine-per-gate rule: at least 6 ready `hear-pick-written` templates for each of `sound-basic`, `syl-cv`, `sound-rest` and `syl-cvc`, for two listen-first draws, and at least 2 ready `build-syllable` for each of `syl-cv` and `syl-cvc`, for Deep's tile item; the bank test also checks at least 3 ready `vocab` oral templates besides the warm-up's word; AM-26), and **the bank has at least 40 ready templates per strand** (section 5 counts them; appendix A lists 260, all ready).
- **Build.** `scripts/build-placement-bank.mjs` reads the JSON and writes `apps/mobile/src/content/placement.generated.ts` (checked in; `--check` is a CI step, the same pattern as `build-overlays.mjs`, F-I18N-001 section 3.6). The app parses it with `PlacementBankSchema` at start (a failure is a development error; at runtime the check is hidden, section 3.11).
- **Overlay fields** for the `pitem:` prefix (an addition to F-I18N-001's `OVERLAY_FIELDS` table, PR P-4): `gloss`, `options.<optionId>.gloss` (picture accessible label; the `gloss` naming follows the inline-pair rule of F-I18N-001 section 3.6). Never overridable: `ko`, `romanization`, `sound`, `pictureRef`, ids.
- **Exclusions at draw time:** `requires.audio` when `config.audio` is false; `requires.picture` when the picture does not resolve (`PictureArt` resolver, F-QUEST-002 section 3.11; a text tile is never substituted); `leaks: true` when `revealMode === 'always'`; any format outside `LISTEN_FIRST_FORMATS` when the run is listen-first (Short, or `config.listenFirst`); any template carrying a tag in `config.avoidTags` (the warm-up's word); the ids of the learner's previous result (`exclude`), relaxed only when a rung would otherwise have fewer than three questions (so a retake may repeat items). (AM-26)
- **Bank as shipped:** appendix A (260 templates: recognition 40, sound-letter 46, syllable-reading 72, vocabulary 48, sentences 54), **all `ready` and all drawable**. `supportedCardIds` (`HeritageCardArt.tsx:21-57`) holds the 30 Stage 1 cards only, and the 8 Stage 2 cards (`card:sagwa`, `uyu`, `ppang`, `dosirak`, `haneul`, `kkot`, `namu`, `byeol`) have no art, so the production review (2026-10-11) replaced the 17 templates of the first outline that needed them with Stage 1 words whose art exists (hear: 먹, 종이접기, 밥상, 설날, 추석, 세배, 연등; read: 종이접기, 밥상; sentences: 한복을 입어요, 연을 날려요) and dropped the four read words that have no decodable Stage 1 replacement, plus 한글날 in the read form (its picture carries the written word 한글, so it can be matched without reading). When F-VOC-002 supplies `word:` art, Stage 2 words can be added back as new templates.

### 3.5 The adaptive engine (`packages/content-schema/src/placement/`, 100 % covered)

Files: `rungs.ts` (`RUNG_TABLE`, `RUNG_SYMBOLS`; the mode helpers `PLACEMENT_MODES`, `legacyLengthOf`, `modeOf`, `modeCeiling`, `questionCap`, `backstopMs`, `drawsFor`, `passAtFor`, `LISTEN_FIRST_FORMATS`, `DEEP_REST_AT`; AM-27), `plan.ts` (`nextRung`), `run.ts` (`startRun`, `currentQuestion`, `apply`), `scoring.ts` (`gateResult`, `rowsPassed`, `stepPassed`, `strandStatuses`, `levelOf`), `level-map.ts` (`questsPlacedOutAtLevel`, `coveredSymbols`), `route-seed.ts` (`seedRoute`, `effectiveRoute`, `RouteCatalog`). All functions are pure; time enters only as `nowMs` arguments.

**Run configuration**

```ts
export const PLACEMENT_MODES = ['short', 'standard', 'deep'] as const;   // placement/rungs.ts (a leaf; schemas import it)
export type PlacementMode = (typeof PLACEMENT_MODES)[number];

// Every format except Latin sound chips and tile building (section 3.1 step 5). The reading
// formats stay in, so a listen-first reader can reach stage3 in Standard and Deep.
export const LISTEN_FIRST_FORMATS = ['shape-odd-one-out', 'hear-pick-written', 'hear-pick-picture', 'read-pick-picture', 'reply-pick'] as const;

export interface PlacementConfig {
  mode: PlacementMode;               // short: 6-9 questions, no clock; standard: 12-24, 10 min; deep: 12-42, 20 min
  listenFirst?: boolean;             // levelOrder 0: LISTEN_FIRST_FORMATS only, in every mode (Short always)
  avoidTags?: readonly string[];     // the warm-up's word: never drawn
  revealMode: 'tap' | 'always';
  audio: boolean;                    // from the warm-up (`playPrompt` result) and canPlayKorean(getCapability())
  visual: boolean;                   // false with a screen reader: `recog` is not run
  takeMyTime: boolean;               // true: no inactivity pause, no backstop clock
  seed: number;                      // hashSeed([profileId, startedAt])
  exclude: string[];                 // template ids of the previous result
  resolvesPicture: (ref: string) => boolean;
}
```

The engine has no `quick` or `full` mode. Those words survive only as the stored `PlacementResult.length` (section 3.8). (AM-27)

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

**Short** (`nextRung`, `mode: 'short'`): `sound-basic` → `vocab` oral → `syl-cv` only if `sound-basic` passed. Letters come first and words sit between two decoding rungs, so a learner who knows a few letters but few words is not met by three "not sure" in a row, and no format runs six in a row. When `sound-basic` cannot run (sound guide shown), `recog` follows the words. With no sound neither `sound-basic` nor `vocab` oral can run, and Short asks nothing; the app never starts Short without sound (section 3.1 step 4) and `recordPlacement` never stores a result with zero responses. (AM-27)

**Standard and Deep:**

1. Always ask rung 1 (if `visual`).
2. **Main steps**, in order: `sound-basic`, `syl-cv`, `sound-rest`, `syl-cvc`, `vocab` read, `sentence` read. Each is asked only while every step before it has passed (`rowsPassed`). The first step that does not pass ends the ladder.
3. **Confirming draws** (`drawsFor`):
   - Standard: a `vocab` read pass is confirmed at once by a second, different draw of three (the `vocab` read pass places out every Stage 1 quest through the stage-lower rule, bypassing the per-quest cut-back).
   - Deep: every main step is confirmed by a second draw, asked **after the next step's first draw** (so one format never runs six in a row). `sound-basic` is not confirmed when `syl-cv` did not pass, because it sets no level alone. `sentence` read has no next step: its second draw comes right after `vocab` read's second draw, before listening. A full Deep run asks, in order: `recog`, `sound-basic` 1, `syl-cv` 1, `sound-basic` 2, `sound-rest` 1, `syl-cv` 2, `syl-cvc` 1, `sound-rest` 2, `vocab` read 1, `syl-cvc` 2, `sentence` read 1, `vocab` read 2, `sentence` read 2, `sentence` oral.
   - Both draws must pass. A failed first draw ends the step at once. A second draw that is unavailable, or stopped mid-draw while still undecided, keeps the first pass (the report shows "not finished").
   - **A step asked before an earlier confirmation failed (Deep).** Because a confirming draw comes one step late, step N+1's first draw may already be asked when step N's second draw fails, which ends the ladder. That row is stored as it was answered, but the step counts as **not passed** everywhere: the planner neither continues the ladder from it nor counts it as a `vocab` read pass for listening (the learner gets the oral pair); `strandStatuses` may make its strand *getting there* from its correct answers, never *secure*; `levelOf` already needs consecutive evidence; and `oralStageOf` never lets it stand in for `vocab` oral. The rule is one pure predicate in `scoring.ts`, `stepPassed(gates, gate, form)`: `rowsPassed` for that gate/form **and** for every main step before it (only for `decode` and `read` steps; `recog` and the oral forms have no predecessor). In Short and Standard a step is only asked after every earlier one passed, so `stepPassed` equals `rowsPassed` there. No stored field changes, so old readers are unaffected.
4. **Listening.**
   - Standard: when the ladder stopped before `syl-cvc` passed, ask `vocab` oral then `sentence` oral — every Standard run that does not read through to `vocab` read therefore measures listening, which is what a heritage learner who understands but cannot read needs. When `vocab` read did not pass, ask `vocab` oral once. A Standard run that reads vocabulary and sentences reports `oralStage: null`.
   - Deep: a learner whose `vocab` read step did not pass (`stepPassed` false, including the case above) gets the oral pair. A reader whose `vocab` read step passed (both draws, or one with the second unavailable or stopped, and every earlier step passed) gets `sentence` oral only (or `vocab` oral while no sentence draw is available), so every Deep run measures listening without ending on six easy picture questions.
5. `audio === false` removes oral rungs and all `requires.audio` templates. A rung with fewer than three eligible templates is `not-run` with reason `unavailable` (never a fail).

**Second draws.** Pre-built at `startRun` with their own seed (`[seed, gate, form, '2']`). They never repeat a template of the first draw, and they prefer templates whose symbol, syllable or word (`spreadKey`) the first draw did not touch, falling back to any unused template. A confirming `syl-cv` or `syl-cvc` draw holds one `build-syllable` item when one is eligible (not for a listen-first learner). A resumed run is identical.

**Length.** (AM-27)

- **Short:** 6 (`sound-basic` not passed) or 9.
- **Standard:** floor `rung1 + rung2 + oral(6) = 12`; then 15, 18, 21 (fails `syl-cvc`; or fails `vocab` read and hears words once); 24 (passes `vocab` read twice and reads sentences, or fails the confirming `vocab` read and hears words once).
- **Deep:** 12 to 42 (`recog` 3 + four confirmed decoding steps 24 + `vocab` read 6 + `sentence` read 6 + `sentence` oral 3).
- **Runs shorter than the floor:** early exits (below), `visual === false` (no recognition rung), `audio === false` (oral rungs not run) and `revealMode === 'always'` (9 questions: recognition 3 + oral 6; section 3.2). The result lists what was not run and never treats it as a failure.

**Gate result (`gateResult(responses, asked, passAt = 2)`).** `correct` = unassisted correct answers. `pass` iff `correct >= passAt`; `fail` iff `correct + (3 - asked) < passAt`; otherwise `not-run`. `passAt` is 3 only for Short's `syl-cv` (`passAtFor`), and 2 everywhere else. The stored `result` is authoritative: no consumer recomputes pass or fail from `correct`. A gate/form with two rows (one per draw) passed when a row passed and none failed (`rowsPassed`). (AM-27) "Not sure" (`skipped`), `wrong` and assisted answers all count as not correct; none of them is shown as a miss.

**Stop reasons (`StopReasonSchema`):** `complete` (no rung left), `cap` (no rung left **and** the run asked the mode's longest run, Standard 24 or Deep 42; no path is longer than the cap, so the cap labels the longest path and never cuts a run short; a Short run always ends `complete`; AM-27), `time` (backstop clock, below), `quit` (learner: the exit, or "That is enough" on the idle pause, after the background or on Deep's rest card), `grown-up` (PIN), `not-sure` (the learner chose "That is enough" after three "not sure" in a row). Only `complete` and `cap` are full runs.

**Clock (D3).** One backstop per run, started at the first scored question: **none for Short** (nine questions bound it), **10 minutes for Standard**, **20 minutes for Deep**, and none with *Take my time*. It is not displayed, and it **stops while the pause sheet, the exit sheet or Deep's rest card is open**, including the sheet opened when the app leaves the foreground (section 3.1 step 6: the caller sends `exit` on `AppState` `background` or `inactive`). When it expires the current question may be answered; then the run ends with `time`. No question is ever marked wrong because of time, and the result is computed from what was asked. The 45-second inactivity pause (screen 5) is session-level, not a question timer: it records nothing and ends nothing. (AM-27)

**Pure run API.**

```ts
startRun(bank: PlacementBank, config: PlacementConfig, nowMs: number): PlacementRunState
currentQuestion(state): AssessmentQuestion | null            // built (options placed) from the template
apply(state, event, nowMs): PlacementRunState                // events: answer{optionId, assisted} | notSure | idle | tick | touch | exit | quit{by} | keepGoing
isFinished(state): boolean
finishRun(state, ctx: { catalog: RouteCatalog; isEntitled: (s: StageKey) => boolean; completedQuestIds: ReadonlySet<string>; completedAt: string; motivation?: Motivation; contentVer: string; testLocale: UiLocale; source: PlacementSource }): PlacementResult
```
`PlacementRunState` is a plain JSON value (persisted under `placement-run:<profileId>`, `PlacementRunStateSchema` versioned); the questions of the current rung are rebuilt from `seed` + `bankVersion`, so a resumed run is identical. `apply` never reads a clock; `nowMs` comes from the caller (tests pass constants). `pause` is one of `not-sure`, `idle`, `rest` (Deep) or `exit`; the run state's config holds `mode` and `listenFirst` (still `version: 1`; no run state is stored anywhere before P-5). (AM-27)

### 3.6 Scoring, level on the 7-stage grid, mapping onto Stage 1

**Strand status (`strandStatuses`).** For each strand with the gates it owns: `not-tested` if none of its gates ran; `secure` if every gate of the strand was run and passed; `getting-there` if not secure and at least one unassisted correct answer exists in the strand; `not-yet` if a gate ran and there is no correct answer. Sound-letter owns `sound-basic` + `sound-rest`; syllable-reading owns `syl-cv` + `syl-cvc`; vocabulary and sentences own one gate each (their form, `read` or `oral`, is stored on the gate result). Statuses are shown to grown-ups as words. A strand's gate may have two rows (one per draw); it counts as passed only when `stepPassed` holds (`rowsPassed` for its rows and every earlier main step; section 3.5). (AM-28)

**Level (`levelOf`).** `PlacementLevel = { stage: StageKey; band: 0 | 1 | 2 | 3 }` — the **decoding level** (what the learner can read), on the existing grid (`StageKeySchema`, `schemas/heritage-card.ts:9-17`):

| Highest consecutive decoding evidence | Level | Meaning (band label key) |
|---|---|---|
| `sound-basic` or `syl-cv` not passed | `stage1` band 0 | At the beginning |
| `sound-basic` + `syl-cv` | `stage1` band 1 | Letters and sounds |
| + `sound-rest` | `stage1` band 2 | Every letter |
| + `syl-cvc` | `stage1` band 3 | Reading words |
| + `vocab` read passed | `stage2` band 0 | First words |
| + `sentence` read passed | `stage3` band 0 | First sentences |

**Ceilings by mode (AM-28).** Short stops after `syl-cv`, so its level is at most `stage1` band 1 and it places out at most q1 to q3 (`modeCeiling`). Standard and Deep can reach `stage3` band 0. The item accuracy at which a rung passes half the time is 0.50 for 2 of 3, 0.64 for 2 of 3 on two draws (Deep; Standard's `vocab` read) and 0.79 for 3 of 3 (Short's `syl-cv`): the modes set different bars on purpose. Measured: the intermediate learner of appendix D is placed above band 2 in 23.5 % of Deep runs and 49.0 % of Standard runs. Results combine by the maximum (section 3.7), so a stricter later run cannot correct an earlier, higher result.

When no decoding rung ran (`revealMode: 'always'`, or the ladder was never reached because the run was stopped first) the level is the conservative `stage1` band 0 and the decoding strands are `not-tested`: the level is a *route default*, never a claim about the learner. Stage 4 and above are not measured (stages 5 to 7 are story reading, real-use and writing: no reliable multiple-choice proxy). `beyondContent` is true when `stage3` is reached. **Listening level** `oral: StageKey | null`: `stage2` if `vocab` oral passed, `stage3` if `sentence` oral also passed, else `stage1`; `null` when no oral rung ran. A Deep reader who passed `vocab` read is asked `sentence` oral only; with no `vocab` oral row, the read pass stands in for it, but only when the `vocab` read step passed (`stepPassed`; an unconfirmed pass never stands in) (AM-28). The route uses the decoding level; the listening level is reported and used by the planner (section 3.7) and never lowers or raises the route.

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

- **Priority tokens** (at most three, in this order): symbols answered wrong, then skipped, then assisted; `skill:blending` when `syl-cv` or `syl-cvc` has a `fail` row with fewer than two correct after its `sound-*` passed (a strict-rule fail with 2 correct, Short's `syl-cv` 2 of 3, adds no blending token); `skill:finals` when `syl-cvc` has such a row. (AM-29)
- **Theme order**: motivation `heritage` and `friends` -> `life`; `kculture` -> `rites`; `curious` -> `letters` (blueprint 04 section 8.1); then the other themes in canonical order. Stage 1 lessons are **not** reordered by themes (F-QUEST-002: symbols are taught in list order); the order applies from Stage 2, to stories and to the planner.
- **Entitlement.** Quests of a stage the tier does not include are neither start nor offered by the cursor (`isEntitled`, `logic/entitlement.ts:31-33`); `needsStage` records it for the grown-up report ("Sam is ready for Stage 2"; see section 3.9 for the wording rule). Stories and vocabulary stay free (D5): the result screen offers them. No paywall is shown to the learner.
- **Effective route (`effectiveRoute`) and the retake rule.** Fold the snapshot's `placements` in `completedAt` order: `placedOut` is the **union** of every result's `placedOutQuestIds` (results never remove an id), minus quests the parent put back (override, section 3.9); `level` is the highest ever reached; `oralStage` is the **highest any result measured** (`null` only when none did); priority tokens come from the **newest result whose mode ceiling was above the level already reached when it was taken** (a Short taken at band 1 or higher does not replace them); the theme order comes from the newest motivation. Results combine by the maximum, never by "the more careful mode" (P20). A stored result's mode is read with `modeOf(result) = result.mode ?? (result.length === 'quick' ? 'short' : 'standard')`. (AM-29) Because the set only grows, a retake **cannot move the start quest backwards**; a lower retake is stored as history, changes nothing but (when its mode could still move the route) the priority tokens, and the result screen says "Your route stays right where it is." Completed quests are never touched.
- **Consumers (each a small, tested change):**
  1. *Cursor.* P-5 passes `skipQuestIds = seed.placedOutQuestIds` to the shared cursor `nextQuestAfter` (F-ROUTE-001 R-4a adds the option); no second cursor function. (AM-13)
  2. *First-quest preview.* `firstQuestFor` is not used when a result exists; `FirstQuestPreview` is skipped and the result's **Start** button opens `RouteSeed.startQuestId`.
  3. *Journey look.* A cell whose quests are all placed out or done, and not all done, draws the **placed-out** look: a light outline and a small check-in-circle glyph, clearly different from the completed tint (`JourneyScreen.tsx:150-171`, `colors.feedback.successLight`); it stays tappable and awards normally. A pin marks the start cell. Pure helper `logic/placement/cell-look.ts` (`placedOutEpisodeIds`, `startCell`) so F-STORY-005's `cellModel` can take it as an input. `logic/placement/cell-look.ts` is a thin adapter over F-ROUTE-001's `pipStateOf` (`logic/my-route/pips.ts`), so 'placed out' has one definition. `GridCell` edits land in the order F-STORY-005 5.5a, P-7, F-QUEST-002 Q-9. (AM-13)
  4. *Home.* The progress bar "Stage 1 progress" (`HomeScreen.tsx:199-202`, total = every quest, `:108`) is **owned by F-ROUTE-001 (R-4b)**, which replaces it with the My route strip; this spec adds the **level check card** (section 3.10). Home's order is F-ROUTE-001 section 6.4. (AM-3)
  5. *Summary.* `summarize` writes `placement` (section 3.8) and, until the learner has quest history, seeds `needsPractice` with the first three priority symbols so a new grown-up view is meaningful (`summarize.ts:63` merges them behind real practice data).
  6. *Plans and curriculum.* `proposeRoute` (F-PLAN-002 section 3.1a) reads the effective seed (`effectiveRoute`, never a raw newest result, called with the learner's real completions so the plan starts at the first quest still to play) and returns the recommended plan: `level = seed.level`, `placedOutQuestIds = seed.placedOutQuestIds`, `goals.themes = seed.themeOrder`, `goals.motivation` from "Why Korean?", `goals.focus` = `reading` when `oralStage` is two or more stages above `level.stage`, else `balanced`. (F-ROUTE-001's start marker calls `effectiveRoute` with **no** completions, so its "You started here" stays fixed; the two calls differ on purpose.) The result strip, the report card, the Home prompt and the console wizard show these as changeable pre-selections; `questsPlacedOutAtLevel` is the coarse mapping when only a level is known (the console). (AM-4)
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
  testLocale: UiLocaleSchema, length: z.enum(['quick', 'full']),   // unchanged: legacyLengthOf(mode), short -> quick, standard and deep -> full
  mode: PlacementModeSchema.optional(),                             // P14; absent on results written before the modes (AM-30)
  revealMode: z.enum(['tap', 'always']),
  bankVersion: z.number().int().positive(), contentVer: z.string(),
  motivation: MotivationSchema.optional(),
  responses: z.array(AssessmentResponseSchema).max(48),            // Deep asks up to 42; Short and Standard stay within 24
  gates: z.array(GateResultSchema).max(16),                         // Deep stores one row per draw (up to 15); Short and Standard stay within 9
  strands: z.object({ 'hangul-recognition': StrandStatusSchema, 'sound-letter': StrandStatusSchema, 'syllable-reading': StrandStatusSchema, vocabulary: StrandStatusSchema, sentences: StrandStatusSchema }),
  level: PlacementLevelSchema, oralStage: StageKeySchema.nullable(), beyondContent: z.boolean(),
  startQuestId: z.string().nullable(), placedOutQuestIds: z.array(z.string()).max(40),
  priorityTokens: z.array(z.string()).max(3), needsStage: StageKeySchema.nullable(),
  stopReason: StopReasonSchema,
  override: z.object({ by: z.literal('parent'), at: z.string(), startQuestId: z.string() }).optional(),
});
export const PLACEMENT_KEEP = 10;
```

`GateResultSchema` and `PlacementSummarySchema` are unchanged by the modes (the summary gets no `mode`: it carries statuses and the level only, F-TCH-001 section 3.2). (AM-30)

- **Snapshot.** `ProgressSnapshotSchema` gains `placements: z.array(PlacementResultSchema).default([])` (so old snapshots, backups and server copies parse; `profile.ts:23` is the `.default` precedent). `blankSnapshot` (`progress-store.ts:77-89`) does **not** add the key (P-5 amendment, 2026-10-11: a snapshot keeps its shape until a result is recorded; see "Local copies carry no defaults"); `mergeSnapshots` (`merge.ts:80-98`) unions by `id` (for the same id the copy that carries an `override` wins, the later `override.at` when both do, otherwise local), sorts by `completedAt`, keeps the newest `PLACEMENT_KEEP`; `isSubsetOf` (`merge.ts:101-111`) also compares placement ids. A new action `progress-store.recordPlacement(profileId, result)` appends, persists and notifies sync (`persist` / `notifyProgressPersisted`, `progress-store.ts:91-94, 127-135`); `applyPlacementOverride(profileId, resultId, startQuestId)` sets `override`.
- **Summary.** `ProgressSummarySchema` gains optional `placement: { takenAt, level, oralStage, strands, beyondContent, overridden: boolean } | undefined` (`schemaVersion` stays `1`). It carries statuses and the level only — no per-question data, no counts (teachers see no scores, F-TCH-001 section 3.2). `summarize` fills it from the newest result (`logic/sync/summarize.ts:44-84`).
- **Run state.** `placement-run:<profileId>` and `placement-ui:<profileId>` (`{ declinedAt?, dismissedAt? }`) through `platform/storage.ts` (`readJson` / `writeJson`, `:10-21`). No `localStorage` / `AsyncStorage` directly (CLAUDE.md section 8).
- **No migration, no new route.** Snapshots and summaries are JSON columns (`apps/api/migrations/0002_schema_v2.sql:30-40`). **Deploy order: Worker (new schemas) first, then the app**; until then the Worker would silently drop `placements` / `placement` (test in `packages/backend` asserts the round trip).
- **Modes and old readers (AM-30).**
  - Every Short and Standard result also parses with the pre-change schema (test against a frozen copy, `fixtures/placement-result-schema-v1.ts`, on the engine's real output). An old reader drops `mode`, and `modeOf` recovers it.
  - A Deep result with more than 24 responses or 9 rows is rejected by an older Worker: a 422 for the whole snapshot PUT. Measured: 84 % of intermediate and 99 % of strong-reader Deep results (appendix D: 16 % and 1 % parse).
  - So the Worker carrying `mode` and the 48 / 16 bounds is deployed **before any app build that sets `mode`** (P-3b, a gate for P-5). When P-3b shipped no `PlacementResult` was stored anywhere (`flags.placementEnabled` was off until P-10), so relaxing the bounds broke no stored data.
  - A copy stripped of `mode` by an older Worker stays readable: the report groups rows by gate/form through `rowsPassed`, so a Deep result without `mode` renders like a Standard one with two-row rungs.
  - **No Worker rollback past P-3b.** Once any app build that sets `mode` has shipped, the Worker is never rolled back to a version before P-3b. An older Worker answers 422 to every snapshot PUT of a learner whose `placements` (ten kept, sent in every PUT) holds a long Deep result, which stops all progress sync for that learner, not only placement. P-3b's PR body and the release note of its Worker deploy state the rule; an unavoidable rollback ships a Worker that keeps P-3b's `PlacementResultSchema`.
  - **Older app builds read backups.** Every build since P-2 parses an imported backup file with `BackupFileSchema.safeParse` (`apps/mobile/src/logic/sync/backup.ts:40`), whose snapshot holds `PlacementResultSchema` with the pre-change bounds (`responses` 24, `gates` 9). A build released before P-3b therefore rejects, as `invalid`, a whole backup file that holds one long Deep result, with every quest, card and streak in it. Deploying the Worker first does not help an installed native build. Gate: `flags.placementEnabled` is flipped (P-10) only after a store build carrying P-3b's schema has shipped at least one release earlier on iOS and Android (the PWA updates itself). **Decision 2026-10-14, taken under the owner's standing production-level pre-approval (owner to confirm): the gate is satisfied.** No native iOS or Android build of the app has been released to any store or to TestFlight, so there is no older released native build whose `BackupFileSchema` would reject a long Deep result; the only installed app is the PWA, which updates itself to the current schema. The first store build will already carry P-3b's schema (it has been on `main` since #200), so it can never be the older build the gate protects against. The gate applies again only if a store or TestFlight build without P-3b's schema is ever shipped; none can be built from `main` now. A local Xcode or TestFlight install on a test device that predates P-3b is rebuilt from `main` before it imports a backup made after P-10 (owner runbook). Test (P-3b, `placement-schema.test.ts`): a 42-response Deep result fails the frozen pre-change schema (`fixtures/placement-result-schema-v1.ts`, the schema inside every older build's `BackupFileSchema`), so the limit is recorded.
  - Test in `packages/backend/src/__tests__/sync.test.ts`: PUT a 42-response Deep result with `mode` next to a legacy result, GET them, and check that every response and `mode` survive.
- **Local copies carry no defaults.** The zod `.default([])` protects server copies, backups and restores, but the progress store reads its own snapshot with `readJson<ProgressSnapshot>` and no parsing (`store/progress-store.ts:156`), so every snapshot already on a device lacks `placements` at runtime. A small `withSnapshotDefaults(snapshot)` (in `logic/sync/merge.ts`; the first of F-PLC-001 P-5 / F-PLAN-002 P2-4 / F-VOC-005 P-3 to land creates it, the others add their key) is applied by `recordPlacement` only (P-5 amendment, 2026-10-11): `hydrate`, `replaceSnapshot`, restore and the server read keep a stored snapshot's shape, the rule P-2 pinned with a progress-store test ("a saved snapshot that predates placements hydrates and takes writes without gaining the key"). Every reader (`mergeSnapshots`, `isSubsetOf`, `summarize`, `recordPlacement`, the cursor's skip set) treats a missing `placements` as `[]`. A server copy always carries the key (the Worker stores the zod-parsed payload), so the first sync writes `placements: []`, which the preserve rule treats as unset. F-PLAN-002 P2-4 and F-VOC-005 P-3 follow the same rule for their keys. Test: merge, `isSubsetOf` and `recordPlacement` on a legacy snapshot object without the key.
- **Mixed app versions (data-loss guard).** The Worker stores the uploaded snapshot as the new payload (`routes/sync.ts:71-79`). An older app build re-uploading after a conflict merge has already stripped `placements` and `summary.placement` and would erase them from the server copy (the device that took the check re-uploads them on its next sync, but a Rescue Code restore in between would miss them). P-2 therefore extends the **preserve rule** that F-VOC-005 P-1 adds to `PUT .../snapshot` (one shared helper listing the additive keys; the first PR to land creates it): when the stored payload has a non-empty `placements` and the incoming one has none, the stored list is kept; the same for `summary.placement`. `placements` is append-only, so "incoming empty and stored non-empty" can only mean an old client. Test in `packages/backend/src/__tests__/sync.test.ts`.
- **Size.** A result is about 2 KB (24 responses), or about 4 KB for a long Deep run (42); ten are kept. (AM-30)

### 3.9 Grown-up and teacher surfaces

**Parent dashboard (in-app, local data).** `ParentDashboardScreen` (`screens/parent/ParentDashboardScreen.tsx:43-94`, one card per profile) gains a **Starting spot** row under the card stats: stage title and band label, the date, and `See the check` -> new route `PlacementReport { profileId }` (added to `RootStackParamList`, behind the PIN gate: `PinEntry.next` gains `'PlacementReport'`, `navigation/types.ts:20`). The report (wireframe `report`):

- the five strands, each with a status word (*secure*, *getting there*, *not yet*, *not tested*) and a plain example ("knows the sounds of ㅏ ㅓ ㄱ ㄴ; the vowels in ㅕ ㅠ are new" — Korean via `KoreanText`, with romanization and gloss); numbers are allowed here and framed as growth ("3 of 3" per rung) for Short and Standard, never compared with other learners; a **Deep** rung shows a status word, plus "checked twice" when both draws ran, or "not finished" when the confirming draw was stopped, and never counts out of 6 or the words "first time" or "first try" (the second draw is new questions, not a retry; AM-31) (F-PAR-001 section 3.2, section 3.6 banned phrases);
- what was **not** tested and why (no sound on this device, sound guide set to *always*, screen reader on, ended early). For Short: "Shapes of letters and sentences are not part of the short check"; the recognition and sentences strands show *not tested (short check)* (`caregiver.placementReport.notTestedShort`), never "not yet" (AM-31);
- the skills note, message key `caregiver.skillsNote` (one string everywhere, F-ROUTE-001 section 3.12): "The level check looks at reading and listening. Writing is practiced with tracing games and is not scored. The rows count finished quests that include these games; a game skipped inside a quest still counts." (AM-5)
- **Spelling with tiles** (Deep): when a `build-syllable` item was asked, a status word from those responses (all correct → *secure*, some → *getting there*, none → *not yet*). The format is found by looking the response id up in the bank (`placement.generated.ts`); an id not in the bank is skipped. It is not a strand and never changes the route. (AM-31)
- the recommended start with a `needsStage` note when the account does not include that stage ("Sam is ready for Stage 2. Stage 2 lessons are not included with this account yet."): no price, no plan name, no purchase or upgrade button, no commercial claim (the exact words are the owner's to set, assumption 10);
- a **Suggested weekly plan** card at the top (when `flags.routeEnabled`): "Suggested weekly plan for Sam", the basis in words ("Stage 1 · Letters and sounds, 2 days a week, 10 minutes"), the pace chips and the three lengths with the recommended one selected, the grown-up warnings in plain words (no price, no plan name, no purchase button), **Use this plan** (the grown-up is through the gate), **Change**, **Not now**. After a retake that raised the start: "Sam's newest check found a later place to start" with **Update the plan**. (AM-5)
- **Choose a different start** (opens a list of the learner's quests in order; the parent taps one): `applyPlacementOverride` stores `override: { by: 'parent', at, startQuestId }`; `effectiveRoute` then places out every grid quest *before* the chosen one, puts back (un-places) the chosen one and everything after it, and later retakes cannot re-place the put-back quests. The override in force is the one on the newest result that carries one, so it survives later retakes. This is the only action that can move the start earlier, and it is explicit. Telemetry `placement.override_applied`;
- **Take the check again** (-> section 3.1 flow, `source: 'parent'`; the mode is pre-selected by `defaultMode`). **Short hint:** when `modeOf(result) === 'short'`, `sound-basic` passed and the `syl-cv` row has at least 2 correct (band 1, or band 0 caused only by the 3-of-3 rule), the report says "The short check looks at the first letters only. The standard check can find a later starting spot." and offers **Try the standard check** (`caregiver.placementReport.tryStandard`). There is no offer of the Deep check after a Standard result: results combine by the maximum, so Deep cannot correct an earlier, higher result (P20). (AM-31)

**Console roster (`apps/web`).** `RosterLearner.summary.placement` (`api.ts:25-34`) drives a line on each student / child card: "Starting spot: Stage 1 · Letters and sounds · Oct 9" (`lib/console/placement.ts`: `startingSpotLine(summary)`, pure, band labels from the same messages) and, when `overridden`, a quiet "Changed by a grown-up". Absent summary or placement -> no line. No class average, no distribution, no sort by level (roster order stays most recent activity first, `routes/spaces.ts:386`). The F-PLAN-002 wizard may use the *most common* level of the roster as a hint (3 or more learners with a result).

**Advisory override.** In the console, **Suggest a different start** on a student card opens the existing plan builder (`/teach/space/plan?id=`, `apps/web/src/app/teach/space/plan/page.tsx`) pre-filled with one quest item, a note ("Try this next"), `targetLearnerIds: [learnerId]` — a normal F-PLAN-001 plan, so it arrives as a "From class" / "From home" card (2) and never edits the learner's placement, placed-out set or progress (decision P6). No new route, table or inbox field. A teacher or parent cannot read the item-level answers (summary only, F-TCH-001 section 3.6).

### 3.10 Entry points

- **Onboarding fork** (section 3.1 step 1). Applies to the first profile and to profiles added later (`firstRun: false` goes through the same `CreateProfile` -> `PlacementInvite`).
- **Home card "Take the level check"** (`screens/home/HomeScreen.tsx`, below the mission cards, above "Stage 1 progress" at `:199`): a quiet `Card tone="sunken"` with one sentence and a ghost button, shown when `flags.placementEnabled`, the active profile has no placement result, fewer than 3 quests are complete, and `placement-ui.dismissedAt` is empty. A **Not now** link sets `dismissedAt` (never shown again until the learner opens Profile). Not shown while a run is resumable (then it reads "Continue the level check"). No streak or guilt copy. **Order with sibling Home blocks:** the three mission cards (F-STORY-004 may change what slots 1 and 3 hold) come first; then at most **one** quiet card from {this level-check card, F-PLAN-002's weekly-plan prompt}, the level-check card winning while eligible (it disappears after three quests, a result or "Not now"). The plan prompt ("Hoya can make a weekly plan for you", **Make my plan**, **Not now**) is eligible when `flags.routeEnabled`, no active plan, at least one finished quest **or** a placement result, and the prompt is not dismissed. **Dismissal:** "Not now" on the prompt, "Not now" on the proposal screen, or "Just start" on the result sets `route-ui:<profileId>.dismissedAt`; the prompt and the result strip stay hidden until the next placement result or 14 days later, whichever comes first (OD-16). Profile's **Make a weekly plan** row is always available. One skip label, **Not now**, on every surface except the result screen's **Just start** (which skips and plays). Then the My route strip, then Homework (F-ROUTE-001 section 6.4). (AM-6)
- **Profile** (`screens/profile/ProfileScreen.tsx`, a row under the stats, above F-PLAN-002's "Plan my route" row): "Find my starting spot again" -> `Placement` (not PIN-gated: a learner may do this alone; the result is still only a start) with `source: 'profile'`.
- **Parent report** (section 3.9): `source: 'parent'`.
- The check is a nested stack `PlacementStack` (language, options, hand-off, warm-up, sound-needed, item, result; the same pattern as `OnboardingStack`, `navigation/onboarding.tsx:10-18`) mounted as the root route `Placement: { source: PlacementSource }`, plus the root route `PlacementReport: { profileId: string }` (`navigation/root.tsx:47-61`, `navigation/types.ts:3-37`). The onboarding fork stays in `OnboardingStack` and reaches `Placement` through its parent navigator. Full screen; back = the exit sheet.

### 3.11 Offline, audio and errors

- Everything runs offline: engine, bank (generated TS) and pictures are bundled; the check never waits on the network; the result syncs later like any snapshot write.
- Audio is optional. `playPrompt` results (`played`, `muted`, `unavailable`) never block: `muted` is a user choice (the item shows the prompt as text only for formats where the spoken prompt is not the tested element; otherwise the question is skipped from the draw at start), `unavailable` at the warm-up sets `audio = false`; mid-run `unavailable` shows the text fallback "No sound? Read it here." for formats where that does not give the answer away, and otherwise records the item `skipped` (not wrong) and continues.
  - **As built (P-6 and the post-merge #258 follow-up).** (a) `muted` at the warm-up is treated like `unavailable`: `audio = false`, the heard formats leave the draw, and Short or a listen-first run goes to `placement/sound-needed`. `hear-pick-picture` and `reply-pick` are therefore not kept in the draw as text at the start; the text fallback is the mid-run case only. (b) Mid-run, `muted` and `unavailable` are handled alike. Words and replies show the text fallback at once, with their romanization unless the prompt `leaks` (section 3.2; then only after **Show how it sounds**, or always with *Always show it*). A heard letter or syllable is **not skipped on the first failure** (a voice that is slow to start also reports `unavailable`): the speaker reads "Tap to hear it." and only a tap that fails too records the item. (c) That record is `skipped` with `noSound: true` (an optional, additive field of `AssessmentResponseSchema`; old readers drop it). It is kept out of scoring: `gateResult` leaves it out of `asked` and `correct` and counts it as one that could still have been right, so it never fails a rung, and a rung it leaves undecided is stored `not-run` with reason `unavailable`; `coveredSymbols` does not cut its symbols back and `priorityTokensOf` does not list them. (d) Sound that stops mid-run never skips a run to its end: the engine opens a **sound pause** (`pause: 'no-sound'`) after the first silent prompt in Short or a listen-first run (every question there is heard), and after two in a row in Standard and Deep. The sheet says "Turn on sound to play" with **Try again** (Keep going), **That is enough** (stop reason `quit`) and the grown-up link. (e) A run whose only responses are silent prompts is not stored and offers no `finish` on reopening (AM-32). (f) The level check counts bundled clips toward `koreanAudio` only when the placement bank carries them (`audioRef`); until then Short and `ko` need a ready Korean voice.
- Empty and error states: bank fails to parse -> the Home card and Profile row are hidden and the onboarding fork is skipped (no dead end); fewer eligible templates than the mode's floor -> for Standard or Deep and a learner who is not listen-first, the options screen says what is limited ("This device cannot play Korean sound, so we will use pictures and reading") and runs the shorter set; Short, or any listen-first run, without sound does not start and the grown-up screen `placement/sound-needed` is shown (section 3.1 step 4); with no voice for the instruction language Short is disabled for that language (step 2); `recordPlacement` never stores a result with zero responses (AM-32); a rung with fewer than three eligible questions is `not-run`; storage write fails -> the result is kept in memory for the session and retried (existing `persist` behaviour); an unknown `startQuestId` on a later build -> the cursor falls back to the first non-placed-out quest.
- The run is never uploaded in pieces; only the finished result enters the snapshot.

### 3.12 Accessibility, layout, privacy

- Targets and type: choices at least `touchTarget.child` (80), "I am not sure" and exit at least `touchTarget.min` (64), body text 18 or larger, tokens only, no emoji, no raster (CLAUDE.md sections 1 and 4, D7). Reflow at 320 x 568, landscape and 200 % text; Screen scrolls and the primary action stays reachable (F-LAYOUT-001 once shipped).
- Screen readers: Korean through `KoreanText` with `accessibilityLanguage="ko"`; the question announces "Question, 4 choices"; picture choices expose their gloss in the test language (except `ko`, section 3.2); the footstep trail is `importantForAccessibility="no"`; focus moves to the prompt on each question. Recognition (`recog`) is visual by nature and is not run with a screen reader on (reported as not tested). With a screen reader on, nothing auto-plays when focus moves: the prompt (every mode, Short included) and the hand-off line play when the focused speaker or Hoya button is activated, so speech and the screen reader never talk over each other. The mode tiles are radios with `selected` and `disabled` state, and a disabled Short tile announces `options.mode.short.needsSound` as its hint (section 3.1 step 3). The full options screen (C2) has a switch **I use a screen reader** (`learner.placement.options.screenReader`): it starts on when the device reports a screen reader, it is the only way to say so on the web (assumption 5), and turning it on pre-sets *Take my time*. A screen reader turned on or off during the check is followed for auto-play and the speaker labels; a run already started keeps its own settings (`visual`). (post-merge #258) Every link on a placement screen (**Change**, **Check without sound**, **Try the standard check**, **For grown-ups**) has a hit area of at least `touchTarget.min`.
- Reduced motion: Hoya and the trail change state instantly. No flashing. Haptics only on the existing tap pattern.
- Privacy: nothing leaves the device but the finished result inside the normal snapshot / summary; telemetry carries ids, codes and counts only (section 3.14); `learnerType` is not sent (REVIEW-1 owner answer 2).
- Copy: plain English at Pre-A1; Spanish and Korean follow F-I18N-001. No "kids", no age, no "test" in the learner-facing name ("level check" or "find my starting spot"), no shame words (`logic/homework/banned-text.ts` lists plus the per-locale lists of F-I18N-001), no `%`, no `x / y`, no score-like numbers on the learner screens (tests over every string of `learner.placement` in all locales: no `%`, no `x / y`, and no digit except in the allow-listed duration strings `learner.placement.options.mode.standard.duration` and `learner.placement.options.mode.deep.duration`; `learner.placement.invite.duration` has no digit). The mode labels and help lines never name an age, a school year or "kids". `learner.placement.cheerShort` contains no success words ("right", "correct", "got it", "perfect", "great job"). `learner.placement.handoff.helper` is covered by the same scan. (AM-33)
- Copy for the modes (English; Korean and Spanish follow F-I18N-001's review ledger; AM-33). Every key is a full path. The flow's screens, the grown-up options screen and `placement/sound-needed` included, live under `learner.placement`, so the copy scan above covers all of them; the parent report lives under `caregiver.placementReport`.

  | Key | English |
  |---|---|
  | `learner.placement.invite.duration` | It takes a few minutes. You can stop at any time. |
  | `learner.placement.options.cardTitle` / `.title` / `.howLong` / `.change` | Set up the check (C1) / A few choices (C2) / How long? / Change |
  | `learner.placement.options.mode.short.label` / `.help` / `.duration` / `.needsSound` | Short / A few picture and sound questions. / Just a few minutes. / The short check needs sound. |
  | `learner.placement.options.mode.standard.label` / `.help` / `.duration` | Standard / Letters, sounds, words and sentences. / Usually under 10 minutes. |
  | `learner.placement.options.mode.deep.label` / `.help` / `.duration` | Deep / More questions, to be extra sure. Hoya takes a break halfway. / Usually under 20 minutes. |
  | `learner.placement.handoff.ready` / `.helper` | Ready? Tap Hoya to start. / Helping? Let them choose. "Not sure" is a fine answer. |
  | `learner.placement.item.tapToHear` | Tap to hear it. |
  | `learner.placement.rest.line` | Hoya is stretching. Keep going? |
  | `learner.placement.soundNeeded.title` / `.tryAgain` / `.startLearning` / `.withoutSound` | Turn on sound to play / Try again / Start learning / Check without sound |
  | `learner.placement.language.noVoice` | No voice for this language here |
  | `learner.placement.cheerShort` (rotating) | Thanks for listening! / Nice and steady. / Hoya likes your listening. |
  | `learner.placement.result.tryStandard` | Try the standard check |
  | `caregiver.placementReport.shortHint` | The short check looks at the first letters only. The standard check can find a later starting spot. |
  | `caregiver.placementReport.tryStandard` | Try the standard check |
  | `caregiver.placementReport.shortNotTested` / `.notTestedShort` | Shapes of letters and sentences are not part of the short check. / not tested (short check) |
  | `caregiver.placementReport.checkedTwice` / `.notFinished` / `.spellingTiles` | checked twice / not finished / Spelling with tiles |

  The durations are approximations, not hard bounds: the backstop starts at the first scored question, lets the open question finish, stops while a sheet is open, and is off with *Take my time*.

### 3.13 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9-43`, and its exact-list test)

| Name | Payload | When |
|---|---|---|
| `placement.start` | `{ source, testLocale, length, mode, revealMode, level }` (`length` is the legacy `quick` \| `full`; AM-34) | first scored question shown (`level` = the D1 level id) |
| `placement.item_answered` | `{ itemId, gate, outcome, assisted, ms, noSound }` | each scored response (no option text); `noSound: true` marks a prompt that could not play (section 3.11), so it is told apart from the learner's "not sure" |
| `placement.complete` | `{ stopReason, asked, stage, band, oralStage, beyondContent, strandsSecure, mode }` (AM-34) | result computed (`strandsSecure` = count) |
| `placement.skipped` | `{ source: 'onboarding' \| 'home' }` | "I am new to Korean" or Home **Not now** |
| `placement.override_applied` | `{ by: 'parent' }` | in-app override saved |

Names follow `TELEMETRY-NAMES.md` (`<unit>.start` / `.complete`, past-tense actions, namespaced). The console has no telemetry client (F-I18N-001 section 3.12), so the advisory plan produces no event; the Worker needs no change beyond the shared list. The modes add no names; the Worker stores payloads without validating them, so no deploy is needed for the `mode` payload field; the P-5 caller test asserts both payloads (AM-34).

### 3.14 Behaviours (Given / When / Then)

- **Given** the learner taps "I am new to Korean", **when** the fork closes, **then** no run starts, `placement.skipped` fires, `FirstQuestPreview` opens as today, and the snapshot is unchanged.
- **Given** a learner who fails `sound-basic`, **when** the run proceeds, **then** exactly the two oral rungs follow, 12 questions are asked, the level is `stage1` band 0, `startQuestId` is the first Stage 1 quest, `placedOutQuestIds` is empty, and the result screen shows no number.
- **Given** a learner who answers every rung through `syl-cvc` correctly and passes `vocab` read, **when** the run ends, **then** (Standard) at most 24 questions were asked (the `vocab` read pass is confirmed by a second draw), the level is `stage2` band 0, all 15 Stage 1 quests are placed out, **none** is completed (no `QuestProgress`, no card, no star, no `stage.complete`), and on a free tier `startQuestId` is `null`, `needsStage` is `stage2`, and the screen offers stories.
- **Given** a placed-out quest, **when** the learner opens and finishes it from the Journey, **then** it awards stars and its card exactly as any quest.
- **Given** a retake that places lower than the stored route, **when** it finishes, **then** the start quest does not change, the result is saved as history and Hoya says the route stays where it is.
- **Given** `revealMode: 'tap'` and the learner reveals the sound guide on an item and picks the right answer, **then** the response is `assisted: true`, counts as not correct, and its symbol is not covered.
- **Given** `revealMode: 'always'`, **then** no `leaks: true` template is drawn, decoding strands are `not-tested`, and the grown-up report says why.
- **Given** the audio check fails, **then** audio-required templates are excluded, oral rungs are `not-run` (`unavailable`), and the result states that listening was not tested.
- **Given** the backstop clock expires during a question, **then** the question can still be answered, the run ends with `time`, and no response is marked wrong for lack of time.
- **Given** the app is closed mid-run and reopened within 24 hours, **then** **Continue** resumes at the same question with the same options.
- **Given** a parent overrides the start to quest 2, **then** quests 3 onward are put back, a later retake cannot place them out again, and `placement.override_applied` fires.
- **Given** a self profile on a self-only device without a PIN and `flags.routeEnabled`, **when** the result appears, **then** the strip shows the recommended length and pace, **Use this plan** is the only primary, and one tap creates the plan and opens the start quest. (AM-7)
- **Given** a self profile on a device with a PIN or a child profile, **then** the strip is shown and **Use this plan** needs no PIN.
- **Given** a child profile, **then** no strip is shown, the primary is **Start**, the link reads **For grown-ups: set up a weekly plan**, and the proposal is the first card of the gated report.
- **Given** a retake that finds nothing new, **then** no strip and "Your plan stays right where it is." (learner) are shown.
- **Given** a retake that raises the start and an active self plan, **when** the learner taps **Update my plan**, **then** future items skip the newly known quests, end date and length are unchanged, past items stay, and the start never moves earlier.
- **Given** a grown-up override that puts quests back, **then** the plan's future queue regains them and `diff` reports items added.
- **Given** the learner taps **Just start**, **then** no plan is created, `route.proposal_skipped` fires once, and the Home prompt stays hidden for 14 days or until the next result.
- **Given** decoding strands `not-tested`, **then** the headline is "Here is a good place to start", the listening-and-shapes line and the one-tap retake are shown, and "Hoya found your starting spot!" is not.
- **Given** a free-tier learner placed at Stage 2+ on today's bundle, **then** no strip is shown (nothing to schedule) and the existing "You know a lot!" screen is unchanged; no learner screen contains "Premium".
- **Given** a *Pictures first* profile with no result and working sound, **when** options open, **then** one pre-filled card shows Short, **Start** needs no other choice, the hand-off speaks "Ready? Tap Hoya to start.", and the learner reaches the warm-up without reading any text. (AM-35)
- **Given** Short, **when** the learner answers, **then** the order is sounds, words, then syllables (only if the sounds passed); at most 9 questions; no "three not sure" sheet; no backstop; the level is at most `stage1` band 1.
- **Given** Short and `syl-cv` 2 of 3, **then** the stored row is `fail` with `correct: 2`, the level is band 0, no `skill:blending` token is added, and the parent report shows the Short hint.
- **Given** a *Pictures first* learner in any mode, **then** no `see-pick-sound` or `build-syllable` item is drawn.
- **Given** Short or a listen-first run and no sound at the warm-up, **then** the run does not start and the grown-up "Turn on sound to play" screen is shown; nothing is stored.
- **Given** Standard and a passed first `vocab` read draw, **then** a second, different draw follows at once, and the level is `stage2` only if both pass.
- **Given** Deep, **then** each confirming draw comes after the next rung's first draw, the rest card appears once after 18 answers, and a reader who passed `vocab` read hears sentences only.
- **Given** Deep and the learner stops after one wrong answer in a confirming draw, **then** that row is `not-run (stopped)`, the first pass stands, and the report shows "not finished".
- **Given** the exit sheet or the pause sheet is open, **then** the backstop does not run; **Keep going** moves the deadline by the time spent paused.
- **Given** a Short result at band 1 or higher already in the history, **when** a later Short finishes, **then** the priority tokens and the listening level of the route do not change.
- **Given** an older reader strips `mode`, **then** the result still parses, `modeOf` reads `quick` as Short and `full` as Standard, and the report scores two-row rungs correctly.
- **Given** a *Pictures first* profile whose route is already above `stage1` band 0 (or whose newest Short fired the hint), **when** options open, **then** Standard is pre-selected, the full options screen is shown and **NEXT** stays disabled until the sound-guide question is answered.
- **Given** the grown-up taps **Check without sound** on the sound-needed screen, **then** the options screen opens with Standard selected, Short disabled and the sound-guide question unanswered, and the run starts without a second warm-up only after that choice.
- **Given** Deep, a passed first `vocab` read draw and then a failed `syl-cvc` confirmation, **then** the ladder ends, the level is `stage1` band 2, the oral pair follows, and the vocabulary strand is not *secure* from the read row.
- **Given** the app goes to the background mid-run, **when** the learner comes back, **then** the pause sheet is shown and the backstop did not run while the app was away.
- **Given** a Short item whose prompt starts but never reports its end, **then** the choices are enabled after the fallback delay (at most 8 seconds), and **I am not sure** and the exit were enabled throughout.

## 4. Out of scope

- Measuring Stages 4 to 7, speaking (STT is blocked on T-013), writing / tracing (gap list, section 4 of `AMENDMENTS-PLC-PLAN-HANDOFF.md`), and any numeric score or CEFR / TOPIK label. (AM-8)
- A free-writing scorer (no ghost letter, precision check, validated on real samples, about 20 per symbol group). Tracing measures copying (`TraceStrokeGame` draws a ghost letter, and `scoreTrace` scores coverage only), so it is not scored either. Deep's "Spelling with tiles" line is the only writing-side signal. (AM-36)
- The length, pace and start day of a weekly plan are F-PLAN-002's `proposeRoute`; this spec only hosts the strip and the report card. (AM-8)
- A class-wide required check (a future plan item of kind `placement`), teacher-written changes to a learner's route (the override is a plan item, section 3.9), any ranking or class comparison.
- Re-offering the check after 21 days away (blueprint 02 section 2.4), a statistical (IRT) model, reading the answers of other learners to calibrate (collect telemetry first; recalibrate after about 200 completed runs per level).
- New art: the bank uses `card:` art that exists; `word:` art from F-VOC adds templates later (data only).
- Moving the Home "Stage 1 progress" bar to the route stage (REVIEW-1 section 9, a separate fix: F-ROUTE-001 R-4b, AM-3).
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
| `…/placement-schema.test.ts` | unit | `PlacementResultSchema`, `PlacementBankSchema` rules, old snapshot without `placements` parses to `[]`, summary without `placement` parses; bounds 48 / 16; `length` still `quick` \| `full`; optional `mode`; a 42-response Deep result fails the frozen pre-change schema (the old-build backup limit, section 3.8) (AM-37) |
| `…/placement-rungs.test.ts` | unit | `RUNG_TABLE`, `RUNG_SYMBOLS` = 30 keys, 12 + 12 + 6, no duplicates; `PLACEMENT_MODES` and `PlacementModeSchema` share one tuple; `legacyLengthOf`, `modeOf`, `modeCeiling`, `questionCap` (null / 24 / 42), `backstopMs` (null / 10 / 20 min; Take my time null), `drawsFor`, `passAtFor`, `LISTEN_FIRST_FORMATS` equals exactly `['shape-odd-one-out', 'hear-pick-written', 'hear-pick-picture', 'read-pick-picture', 'reply-pick']` (no `see-pick-sound`, no `build-syllable`), `DEEP_REST_AT` (AM-37) |
| `…/placement-plan.test.ts` | unit | `nextRung` for every path. Standard 12, 15, 18, 21, 24 (the `vocab` read confirmation; a failed confirmation hears words once; an unavailable second draw keeps the pass), `visual: false`, `audio: false`, read-form switch, oral rungs after a decoding stop; Short 9 / 6, sound guide shown 6 (words, then shapes), no sound 0; Deep's delayed confirmation order (the full order of section 3.5, `sentence` read's second draw right after `vocab` read's), no `sound-basic` confirmation after a `syl-cv` fail, a failed confirmation ends the ladder, a step asked before an earlier confirmation failed is not passed (a `syl-cvc` confirmation fails after a passed first `vocab` read draw: the oral pair follows, the level is `stage1` band 2), sentences-only listening, words while sentences are unavailable; a listen-first perfect reader reaches `stage3` in Standard and Deep; every pass/fail mix within 6-9, 12-24 and 12-42 and no draw repeated (AM-37) |
| `…/placement-run.test.ts` | unit | `startRun` / `apply` / `finishRun` end to end; stop reasons `complete`, `cap` (the longest Standard and Deep paths end `cap`, every shorter full path `complete`, and no run is ever cut short by the cap), `time`, `quit` (including **That is enough** on the idle pause and on Deep's rest card), `grown-up`, `not-sure`; an `exit` sent for the background stops the backstop (background longer than the backstop, then **Keep going**: not ended by `time`); three "not sure" -> pause event; 45 s without a touch -> pause event with no response recorded; `takeMyTime` disables clocks; resume equality (serialise, rebuild, same question). Modes (AM-37): Short end to end (order, `quick` + `short`, `complete`); strict 2 of 3 is a stored fail without blending; no "three not sure" pause in Short; **no `see-pick-sound` or `build-syllable` for Short or for any listen-first run**; Short with no sound asks nothing (with and without a screen reader); listen-first with no sound asks shapes only; `avoidTags`; Deep: rows, rest card at 18, a confirming draw never shares a template id with its first draw and shares no spread key whenever at least three eligible fresh-key templates exist, one tile item, fallback and unavailable second draws, quitting inside a confirming draw (1 wrong: stopped and the pass stands; 2 wrong: fail); the backstop stops during the exit and pause sheets; **old reader: Short and Standard results parse with the frozen pre-change schema** |
| `…/placement-scoring.test.ts` | unit | `gateResult` (pass / fail / not-run, assisted excluded; `passAt` 2 and 3), `rowsPassed` truth table, `stepPassed` (equals `rowsPassed` when every earlier step passed; false for a pass row after a failed earlier confirmation), two-row `gatePassed`, level and strand (an unconfirmed `vocab` read pass makes vocabulary *getting there*, not *secure*), `strandStatuses` truth table, `levelOf` for all six rows, `oralStageOf` with the read pass standing in only when `stepPassed` (AM-37) |
| `…/placement-level-map.test.ts` | unit | every row of section 3.6 against a **15-quest fixture** (`__tests__/fixtures/stage1-15.ts`): start quest, placed-out ids, covered symbols with wrong / assisted answers cutting a quest back; the 8-quest layout of today's bundle |
| `…/placement-route-seed.test.ts` | unit | `seedRoute` priorities (<= 3, order), theme order by motivation, entitlement (`needsStage`, `startQuestId` null), `beyondContent`; `effectiveRoute` union, lower retake keeps the start, override puts back and blocks re-placing, completed quests untouched; strict-rule fail adds no blending; Deep rows; `effectiveRoute` takes the highest `oralStage`; a Short at band 1+ (with or without `mode`) does not replace tokens; a Standard or Deep retake taken below `stage3` does (at `stage3` no mode's ceiling is above the level reached, so the tokens stay) (AM-37) |
| `…/placement-simulated.test.ts` | integration | six simulated learners on the fixture bank (zero, letters only, decoder, heritage listener, advanced, random guesser), per mode, 1,000 seeded runs: Standard question counts (zero = 12, max <= 24), a guesser with 4-option items placed at `stage1` band 0 or 1 in >= 95 %, never-first and fixed-slot tappers at band 1 or lower in at least 97 %; Short 6-9, never above band 1, at most 3 placed out, any guesser above band 0 in at most 1 %; Deep any guesser above band 1 in at most 0.5 %, at most 42, advanced `stage3` at least 90 % with listening measured; "not sure" at band 0 in every mode (AM-37) |
| `…/placement-bank-schema.test.ts` | unit | `PLACEMENT_MIN_FORMAT_READY`: 6 ready `hear-pick-written` per decoding gate, 2 ready `build-syllable` per syllable gate, drafts never count (AM-37) |
| `…/placement-bank-modes.test.ts` | content | the shipped bank through `scripts/build-placement-bank.mjs`, at most 200 runs per case: per-format minimums; Short with sound and a hidden guide always asks `sound-basic` and never the warm-up word; listen-first never meets chips or tiles; Standard's floor is 12, a perfect reader reaches `stage3` in Standard (24) and Deep (42); Deep's confirming syllable draw holds a tile item (AM-37) |
| `…/placement-modes-simulation.test.ts` | integration | the mode table on the shipped bank with the time model of appendix D: seeded learners (five guessing patterns, not sure, intermediate, advanced) drive `startRun` / `apply` / `finishRun`, 300 runs per cell; per mode: question range, p90 minutes (Short at most 5, Standard at most 10, Deep at most 20), guesser false-high bounds, Short's ceiling and placed-out bound, Standard's intermediate `stage2` bound, Deep's higher bar than Standard, old-schema parsing (AM-37) |
| `…/placement-bank.test.ts` | content | reads `content/placement/*.json`: schema, >= 40 ready templates per strand, every `RUNG_SYMBOL` covered by >= 2 templates of its gate, romanization equals the converter, `leaks` / `requires.audio` consistent with the format, ko-instruction leak rule, no Hangul in `en` / `es` messages |
| `…/telemetry.test.ts` (extend the exact sorted list) | unit | the five new names |
| `packages/backend/src/__tests__/sync.test.ts` (extend) | integration | a snapshot with `placements` and a summary with `placement` round-trip through `PUT /api/sync/learners/:id/snapshot` and the roster; unknown extra keys still stripped; a 42-response Deep result with `mode` round-trips next to a legacy result; 49 responses, 17 rows, an unknown `mode` or `length` are a 422 (AM-37) |
| `scripts/__tests__/validate-content.test.mjs` (extend) | unit | new rules for `content/placement/**` and the `pitem:` overlay fields |
| `mobile/src/logic/placement/__tests__/*.test.ts` | unit, 100 % | `flow.ts` (screen state machine: fork, language skip with one locale, `defaultMode` first-match rules (each rule, a Short held at band 0 by the 3-of-3 rule whose hint fired -> Standard, a learner at `stage3` -> Standard, Short tile disabled whenever Short is unavailable), `shortAvailable(audio, voice)` from `canPlayKorean(getCapability())` and `hasVoiceFor(...)` at options time, the `levelOrder` 0 card shown only when Short is pre-selected and hand-off (every control on the path to the warm-up has a spoken label and an icon), a `levelOrder` 0 learner with Standard pre-selected gets C2 and the sound-guide question, the sound-needed state and **Check without sound** (C2 with Standard, Short disabled, the sound-guide question unanswered, no second warm-up), `revealMode` never set for Standard or Deep without an explicit choice, the sound-guide question asked only for Standard and Deep with nothing pre-selected and NEXT disabled until answered, the item gate (choices enabled on the playback end or after the fallback delay, at most 8 s; **I am not sure** and the exit always enabled; the first item after a resume or a cold start plays on tap; no auto-play with a screen reader), pause rules including the background `exit`, exit sheet; AM-37), `copy.ts` (every string in en / es / ko: no banned word, no `%`, no `x / y`, no digits outside the two allow-listed duration strings, no Hangul in en / es, no age words in the mode labels, the effort-only `cheerShort`, the helper line), `result-view.ts` (route cards, "stays where it is", stories fallback; strip visibility matrix (flag x learner type x device has PIN or child x proposal null x dismissed x retake unchanged / raised / override), primary-button identity per cell, the not-tested headline (no text button on a child profile), the Short hint rows (band 1; `sound-basic` pass and `syl-cv` 2 of 3 -> hint; `sound-basic` fail -> no hint), `modeOf` fallback, Deep rows grouped by gate/form with status words and no counts out of 6, the tiles line by bank lookup, copy scan of the strip strings (no `%`, no `x / y`, no Premium, no speaking words) (AM-9)), `cell-look.ts`, `home-card.ts` (when the card shows) |
| `mobile/src/store/__tests__/placement-run-store.test.ts` | integration | persists after every answer, resume within 24 h, discards stale and other-bank runs |
| `mobile/src/store/__tests__/progress-store.test.ts` (extend) | integration | `recordPlacement` appends only to `placements` (no quests, cards, homework, sessions, streak), notifies sync, and does not store a result with zero responses (AM-37); `applyPlacementOverride` |
| `mobile/src/logic/sync/__tests__/merge.test.ts`, `summarize.test.ts` (extend) | unit | placements union / cap / `isSubsetOf`; summary `placement` block; `needsPractice` seeding |
| `mobile/src/logic/homework/__tests__/mission-builder.test.ts` (extend) | unit | cursor with a route skips placed-out ids; falls back as before without one |
| `mobile/src/content/__tests__/placement-bank.test.ts` | integration | the generated bank equals `content/placement/*.json`; every `card:` picture resolves in `supportedCardIds` |
| `apps/web/src/lib/console/__tests__/placement.test.ts` | unit | `startingSpotLine`, advisory plan prefill |
| `apps/mobile/e2e/web/placement.spec.ts` (every PR, release build; P-10) | e2e | fork -> options -> a Standard run -> result with the weekly-plan strip -> **Use this plan** with one tap and no PIN -> the plan on the Learning Route; the same for a self profile added on a device with a PIN (OD-14); a child profile: no strip, **For grown-ups: set up a weekly plan** behind the PIN; a Deep run stored as `deep`; a *Pictures first* Short run to its end with sound; the Home card and the Profile row open the check, **Not now** hides the card; a check taken offline; every screen at 320 x 568. On the weekly plan bundle (every locale shown): the test-language screen and a Spanish run. Screen-level cases (the rest card, the sound pause, resume) stay in `placement-screens.spec.ts` on the fixture bundle (AM-37) |

Coverage: `packages/content-schema` 100 % (`assessment/` and `placement/` included), `apps/mobile/src/logic` >= 90 % with `logic/placement/` at 100 %, `apps/web` verification logic >= 90 %. Component files are verified by Playwright, not unit tests (the mobile vitest setup cannot render components, `apps/mobile/vitest.config.ts:21-27`).

## 6. Rollout and PR breakdown

Flag `flags.placementEnabled` (`apps/mobile/src/config/flags.ts`, `parseBool(process.env.EXPO_PUBLIC_PLACEMENT_ENABLED, true)`: read by its literal name so the web bundle inlines an override; on by default on every platform since P-10, and `false` or `0` in a build is the kill switch). With it off the fork, the Home card, the Profile row and the report entry are hidden; stored results stay and keep shaping the route. Beta measures (telemetry): share who start / complete, median length, stop reasons, how often a parent overrides, quest-1 accuracy of placed-out learners versus others; by mode: share chosen, median length, stop reasons, share ended by the backstop, how often the Short hint fires and is followed, `revealMode` per mode, and `see-pick-sound` accuracy by `testLocale` (AM-38); recalibrate the bank after about 200 completed runs per level.

| PR | Content | Size | Needs |
|---|---|---|---|
| P-0 | `docs`: CLAUDE.md section 2 line for `content/placement/` (**only after the owner approves P12**; fold it into F-I18N-001 PR 0's single charter edit if that has not merged yet); F-RVW-001 amendments (appendix B); the `pitem:` row for F-I18N-001 section 3.6 `OVERLAY_FIELDS`; wireframes promoted | S | owner approval P12 |
| P-0b | `docs`: `AMENDMENTS-PLC-PLAN-HANDOFF.md` applied (AM-1 to AM-14, errata E-1 to E-5); the same PR is F-ROUTE-001 R-0 and F-PLAN-002 P2-0 | S | — |
| P-0c | `docs`: three check lengths, `AMENDMENTS-PLC-THREE-MODES.md` applied (AM-15 to AM-42; P14 to P20), wireframe edits W-1 to W-8 (`options` rewritten, `handoff`, `item-short`, `sound-needed`, `pause` rest card, `result`, `report`) | S | — |
| P-1 | `feat(content-schema)`: `assessment/` (question, rng, options, select, session, clock) + tests | M | — |
| P-2 | `feat(content-schema,backend)`: `schemas/placement.ts`, snapshot `placements` and summary `placement` (additive), the Worker preserve rule for both (shared with F-VOC-005 P-1 / F-PLAN-002 P2-4), telemetry names + exact-list test (and rows in `TELEMETRY-NAMES-2.md`), backend round-trip test. **Deploy the Worker before any app build** | M | P-1 |
| P-3 | `feat(content-schema)`: `placement/` (rungs, plan, run, scoring, level map, route seed, effective route), 15-quest fixture, simulated learners | L | P-1, P-2 |
| **P-3b** | **`feat(content-schema)`: engine modes** — `rungs.ts`, `plan.ts`, `run.ts`, `run-state.ts`, `scoring.ts` (with `stepPassed`), `route-seed.ts`, `schemas/placement.ts` (`mode`, 48 / 16, `PLACEMENT_MIN_FORMAT_READY`), their tests, `placement-bank-modes.test.ts`, `placement-modes-simulation.test.ts`, and the backend round-trip test (AM-38). **Deploy the Worker before P-5 ships**; once a build that sets `mode` has shipped, the Worker is never rolled back past P-3b (section 3.8; stated in the PR body and the deploy note) | M | P-3 (#168), P-4 (#177), P-0c |
| P-4 | `content`: `content/placement/` 265 templates (260 after the production review), overlay skeletons, `build-placement-bank.mjs`, validator rules, `placement.generated.ts` | L | P-2; the production review (2026-10-11) set every template `ready` |
| P-5 | `feat(mobile)`: `logic/placement/` (flow with `defaultMode`, `shortAvailable`, hand-off and sound-needed states; copy; result view with `modeOf`, the Short hint and rows grouped by gate/form; cell look; home card), `placement-run-store`, `recordPlacement` (no zero-response result), `avoidTags` from the warm-up, merge / summarize / mission-builder changes, flag (AM-38) | M | P-3b **and the Worker deploy**, P-4 |
| P-6 | `feat(mobile)`: screens (language with the instruction-voice line; options as a grown-up screen with the `levelOrder` 0 card and the three mode tiles; hand-off; warm-up; item with the Short layout; pause with exit and rest; sound-needed; result), navigation, audio capability hooks and `platform/audio` `hasVoiceFor` (AM-38) | L | P-5, F-I18N-001 PR 4, F-AUDIO-004 A-4, OD-1 (sound-guide choice screen; AM-10, AM-14), wireframes W-1 to W-7 |
| P-7 | `feat(mobile)`: entry points (onboarding fork, Home card, Profile row; "Take the check again" pre-selects with `defaultMode`; AM-38), Journey placed-out look and start pin | M | P-6, F-ROUTE-001 R-2a (`pin`, `check-circle` glyphs; AM-10) |
| P-8 | `feat(mobile)`: parent report (Short not-tested line and hint, Deep status words and "checked twice", Spelling with tiles by bank lookup, retake offer location by profile type; AM-38), override, dashboard row | M | P-6, wireframe W-8 |
| P-7b | `feat(mobile)`: result weekly-plan strip and not-tested copy, `RouteProposal` entry from the result, report "Suggested weekly plan" card (AM-10). **Done (#573)**, behind `flags.routeEnabled` | M | P-6, P-8, F-PLAN-002 P2-3b (`proposeRoute`) and P2-7a (`RouteProposal`); no owner gate from OD-12 / OD-13 (decided 2026-10-12, accepted as proposed) |
| P-9 | `feat(web)`: roster line, advisory plan prefill, `lib/console/placement.ts` | S | P-2 |
| P-10 | `test(e2e)` + flag flip for beta. **Done**: `apps/mobile/e2e/web/placement.spec.ts` on the release build (the fork, Standard, Short and Deep, the result strip, **Use this plan** with one tap and no PIN for a self profile on a device with or without a PIN, the plan on the Learning Route, a child's **For grown-ups: set up a weekly plan** behind the PIN, the Home card and the Profile row, a check taken offline, every screen at 320 x 568) and on the weekly plan bundle (the test-language screen); `placementEnabled` defaults to `true` on every platform, `EXPO_PUBLIC_PLACEMENT_ENABLED=false` or `0` turns it off | S | P-7, P-7b, P-8 (OD-14 decided 2026-10-14, assumption 16), **the P-3b Worker deploy** (AM-38; live: on 2026-10-14 the production `GET /health` answered `ok` and reports `features.notesSend`, a field added by F-FEEDBACK-001 FB-3a (#459, 2026-10-12), so the deployed Worker is newer than P-3b (#200, 2026-10-11)), and **a store build carrying P-3b's schema shipped at least one release earlier on iOS and Android** (older builds reject backups with a long Deep result, section 3.8). **Decision 2026-10-14 under the owner's standing production-level pre-approval (owner to confirm): satisfied**, because no native build has been released to any store or to TestFlight and the first such build will already carry P-3b's schema; the gate applies again only if a store or TestFlight build without P-3b's schema ever ships (section 3.8) |

## 7. Dependencies

- **Upstream:** F-LEARN-001 PR 1 (`levelOrder`; already in `packages/content-schema/src/schemas/learner-level.ts`), F-I18N-001 PR 1-4 (`UiLocale`, `getMessages`, `KoreanText`), F-AUDIO-004 (`playPrompt`, `canPlayKorean`), F-QUEST-002 Q-1 (`KoTextSchema`, `PictureRefSchema` if not yet created: P-2 creates them with exactly the F-QUEST-002 shapes), F-CNT-002 (converter and checker already in `romanization/`), F-PLAN-001 (plans for the advisory hand-off), F-STORY-004 PR 4.2 (`isFreeContent`, only read, never called here).
- **Downstream:** F-PLAN-002 (level input, shared coarse mapping, `RouteCatalog`), F-RVW-001 (shared engine, Pool C seeding), F-STORY-005 (`reachedStage` floor), F-PAR-001 (report), F-TCH-001 / F-CONSOLE-001 (roster line), F-QUEST-002 (the `teaches` symbol keys), F-TCH-004.
- **External:** none for review: the Korean sentence and reply templates are reviewed (the three-lens review, assumption 1, 2026-10-11), and the Spanish and Korean overlay strings go through the F-I18N-001 §3.10 multi-agent review (owner decision 2026-10-12); counsel is not involved (no new personal data; nothing leaves the device but the snapshot).

## 8. Decisions

Binding owner decisions applied (not re-opened): **D1** audience any age; levels are reading levels (*Pictures first* only changes the default mode and makes the check listen-first; AM-39). **D2** romanization hidden-until-tap is allowed in the check as a run-scoped choice; the profile setting is untouched. **D3** one backstop clock, no per-question timer, no combo, no red, no scores on learner screens. **D4** JSON-first bank, generated into the app, validated on the shipped content. **D5** nothing gated; stories and vocabulary remain the free destination. **D6** TTS with a capability check and a text fallback; consonants spoken as sounds. **D7** `card:` SVG art only. **D8** this id. **D10** 12 to 21 questions, <= 6 minutes, shorter for *Pictures first*, never backwards, no cards or stars, seeds the route, teacher override advisory, one shared engine, selectable test language. **D10 is amended by the owner request of 2026-10-11** (P14 to P17): three modes; Standard keeps the floor of 12, its ceiling becomes 24 and its backstop 10 minutes (the owner's "5 to 10 minutes"); Short is 6 to 9; Deep is 12 to 42. (AM-39)

Decisions made in this spec (each is reversible):

| # | Decision | Why |
|---|---|---|
| P1 | **Seven rungs of three; always rungs 1 and 2, then either the reading rungs or the two oral rungs** | Gives the 12 floor of D10 without padding, measures listening for every learner who does not read through to sentences (heritage listeners), and a true beginner is asked only 12 easy-to-skip questions |
| P2 | The 12 floor is for runs the engine completes; learner / grown-up exit, "that is enough" after three "not sure", and the backstop clock may end earlier | A learner is never trapped; the result is still computed from evidence |
| P3 | *Replaced by P14* (AM-39). | — |
| P4 | Shared engine lives in `packages/content-schema/src/assessment/` (no new package) | Precedent `romanization/`; the console can import it; coverage gate already 100 % there |
| P5 | Placement is stored as its own append-only record, never as completions; the route is **derived** (`effectiveRoute`) from it | Keeps stars, cards, homework and dashboards honest; deterministic; syncs and restores for free |
| P6 | Teacher override = a targeted one-item plan (advisory); parent override = in-app, local, explicit | Needs no server table or inbox field; reuses F-PLAN-001; a class role never edits a learner's progress (F-TCH-001 section 3.6) |
| P7 | "Placed out" is a route concept with its own look; a quest is placed out only when **every** symbol it teaches is covered | Prevents false skips from a three-question sample |
| P8 | `revealMode` is a run setting chosen on the options screen with nothing pre-selected (OD-1 (c), AM-14; D2: neither choice is recommended; assumption 11), never written back to the profile; Short runs `tap` without the reveal button (P19); revealed answers do not count | Honors D2 (nothing persistent changes) and keeps the measurement meaningful |
| P9 | Korean test language: audio-only instructions on decoding rungs | Written Korean instructions would leak letter forms |
| P10 | Telemetry carries `level` (the D1 id) but never `learnerType` | REVIEW-1 owner answer 2 |
| P11 | Server first, app second for the two additive fields, plus a Worker preserve rule | Zod strips unknown keys (`schemas/sync.ts:49-56`); an old app re-uploads without the field |
| P12 | `content/placement/` is a new content directory — **approved by the owner on 2026-10-11** | CLAUDE.md section 2 asks for approval; same pattern as D4's directories |
| P13 | The sampled coverage rule (untested symbols covered by their rung's pass) is accepted | The Hangul Check (F-QUEST-002 section 3.9), priority tokens and ordinary play correct gaps; the alternative is a 30-question census |
| P14 | **Three modes: Short, Standard (default), Deep.** Defaults by `levelOrder` and the effective level, as an ordered first-match list (section 3.1 step 3); Deep is opt-in; Short is never pre-selected once the effective level is above `stage1` band 0. Stored as `length` (legacy `quick` / `full`) plus an optional `mode`. (AM-39) | Owner request 2026-10-11; old readers keep parsing Short and Standard results |
| P15 | **Short:** `sound-basic` → `vocab` oral → `syl-cv`; listen-first formats only; `syl-cv` needs 3 of 3; no "three not sure" sheet; no backstop; ceiling `stage1` band 1; does not start without sound. Below D10's floor at the owner's request: the band-1 evidence is the same `sound-basic` and `syl-cv` items as Standard's, and what it drops (recognition, sentence listening) the report names as not part of the short check. | A short, one-tap, spoken check for learners who do not read yet; it errs low because a false high is permanent (any guessing pattern above band 0 in at most 0.2 %, against about 2.5 % with 2 of 3) |
| P16 | **Standard:** the merged Full path; a `vocab` read pass is confirmed by a second draw (ceiling 24); 10-minute backstop. | The `vocab` read pass places out all of Stage 1; the second draw cuts the intermediate learner's `stage2`-or-higher false high from about 21 % to 9 %. A 12-minute backstop was considered: it would cut 2.1 % instead of 7.0 % of a rare learner (a *Pictures first* profile who reads sentences), and the label "Usually under 10 minutes" holds either way |
| P17 | **Deep:** every route-moving pass is confirmed by a second, different draw, asked after the next rung; listening for everyone (sentences only for a reader); a rest card after 18; up to 42 questions; 20-minute backstop; `responses` 48 and `gates` 16 before the first app write. | Thorough without six-in-a-row blocks or an easy tail; the Worker is deployed first |
| P18 | **Listen-first is a property of the learner** (`levelOrder` 0), applied in every mode. Test language `ko` is not listen-first by default (assumption 19). | The learner who tops out in Short must not meet Latin chips or tiles in the Standard retake |
| P19 | **Short and the sound guide:** no sound-guide question in Short; letter tiles hide romanization only while a Short question is open; everything is shown after the run. | The romanization is the answer and a learner who does not read yet cannot use it; without it, a grown-up who picks *Always show it* would get a 6-question Short that measures no reading |
| P20 | **Results combine by the maximum:** level and placed-out set as before; `oralStage` is the highest measured; priority tokens come from the newest result that could still move the route. No "check with Deep" offer after a Standard result. | Modes set different bars; a stricter later run must not erase richer evidence or pose as a correction |
| P21 | **Per-stage `known` counts on the console are covered by "Level check results"** (F-ROUTE-001 R-7a). `summary.placement` itself keeps statuses and the level only, no counts; `summary.journey` now also carries, per stage, how many quests every stored result (and a grown-up override) placed out and the learner has not done | The counts are stage-level, never per question or a score, and they come only from the level check, which the class and family consent lists already name (`level_check`); no new consent line and no `TRANSFER_CONSENT_TEXT_VERSION` bump. The transfer-consent test pins `placement` -> `level_check` on the allow-list |

## 9. Unverified assumptions

1. **Language review (resolved 2026-10-11, owner decision).** The owner decided that a three-lens review (Korean usage and spelling, Revised Romanization against the repo converter and jamo table, English and neutral Latin-American Spanish glosses), adjudicated in the production-review PR, replaces the native-speaker review, and that no template stays `draft`. Every sentence template records it as `reviewedBy: "ai-3-lens"`, `reviewedAt: "2026-10-11"`. The Spanish / Korean instruction strings are not bank content and follow F-I18N-001's review ledger.
2. **Guess resistance** was computed, not measured: with four options, P(pass a rung by guessing) = 0.156, so reaching `syl-cv` pass by luck is about 2.4 % and `sound-rest` about 0.4 %; the simulation test asserts >= 95 % of 1,000 guessers stay at band 1 or lower. Measured on the shipped bank with uniform, never-first and fixed-slot tappers (placement places the correct option without `avoidFirst`): Short above band 0 at most 0.2 %; Standard at band 1 or lower in more than 99 % and above band 0 in at most 3.2 %; Deep above band 1 0 %. The `sentence` read rung (two four-option items and one three-option reply) is passed by guessing with probability 0.19, not 0.156. Real learners guess differently; recalibrate from telemetry. (AM-40)
3. **Three-question rungs are noisy** (a 2-of-3 pass can come from a lucky pair). The cut-back rule (wrong symbols un-place their quest) and the monotonic retake rule limit the harm; a larger rung would break Standard's 24 ceiling; Deep confirms each route-moving pass with a second draw instead (AM-40).
4. **Time**: modelled per item (appendix D), including a fixed spoken overhead per rung and per cheer. Standard's p90 is 6.1 to 7.5 minutes at the *Some reading* pace and up to 10.8 at the *Pictures first* pace for a strong reader (7 % of those runs end with `time`, losing the `sentence` read rung). Short's p90 is 4.0 minutes at the *Pictures first* pace. Deep's p90 is up to 19.1 minutes for a strong reader at that pace (4.2 % end with `time`). Real timings come from `placement.item_answered.ms`; recalibrate after about 200 completed runs per level. (AM-40)
5. `AccessibilityInfo.isScreenReaderEnabled()` is assumed available through a thin `platform/` wrapper; not verified on device. (P-6 finding: react-native-web does not forward it, it always answers true, so `platform/screen-reader.web.ts` reads the web as off; the screens stay fully labelled. Post-merge #258: the options screen's **I use a screen reader** switch lets a grown-up say so, which drives auto-play, *Take my time* and the visual rung like the device reading, section 3.12.) Likewise `canPlayKorean()` and `playPrompt` come from F-AUDIO-004 and are assumed to match its spec.
6. The 15-quest layout of F-QUEST-002 and the `teaches` symbol keys (`questTeaches`, F-QUEST-002 section 3.7) do not exist in code yet (8 quests, `questJamo` at `content/sync-context.ts:13-25` gives characters, not final keys). The engine is tested on a fixture; the real-bundle test is enabled by F-QUEST-002 Q-6b.
7. Picture quality of the `card:` art as quiz options (`HeritageCardArt`) was reviewed against the SVG sources on 2026-10-11: pairs that show the same thing or belong to each other (the full moon on the moon and Chuseok cards, the round lantern and the moon, Seollal and tteokguk or the New Year games, the tiger face on the kite, the paper crane and the magpie, the yut sticks and the chopsticks, and others) are never offered together (bank test). A design pass on real illustrator art should re-check the list when the art changes.
8. The Web `Home` card and the onboarding fork change screens other specs also edit (`CreateProfileScreen.tsx`, `HomeScreen.tsx`, `ProfileScreen.tsx`); land F-LEARN-001 PR 4b first, then P-7 (mechanical rebase).
9. `PictureRefSchema` / `KoTextSchema` names come from F-QUEST-002 (not in code yet).
10. **Free tier (owner to confirm; assumption, not a decision).** The Journey does not block opening a Stage 2 cell today (the stage header carried only a "Premium" pill, `JourneyScreen.tsx:104`; F-ROUTE-001 R-J, OD-8, replaced it with the availability word and made the header a plain row), but F-QUEST-002 section 3.5 makes the cursor skip stages the tier does not include, and this spec follows it: a learner placed at Stage 2 or above on the free tier gets no entitled start quest, the result says "You know a lot! More adventures are coming." and offers stories (free, D5) or the whole map, where every cell stays openable as today. No paywall, price, plan name or purchase button is ever shown to a learner by this spec; the grown-up report only says the stage is "not included with this account yet". The exact words, and whether placed learners should instead keep today's Stage 2 taste quests on the cursor, are the owner's call (PNNL outside-activity and pricing questions stay out of the specs).
11. **D2 and the sound-guide choice (OD-1 default (c), AM-14).** Standard and Deep ask the sound-guide question first with no pre-selection. A learner who picks *Always show it* gets the *listening and shapes* check (recognition 3 + oral 6 = 9 questions; `stage1` band 0; decoding strands `not-tested`), a documented exception to the floor, and the AM-14 headline. Short asks no such question (P19). (AM-40)

12. **Sentence rungs test less than their names say.** The `sentence` oral draw (`hear-pick-picture`) mostly tests the noun (the picture is the noun of the sentence), so it overlaps `vocab` oral; and the read sentences use vowels Stage 1 never teaches (ㅔ in 에요/예요, ㅐ in 책, the double final ㄺ in 읽어요), so they are read as chunks with picture support. This only affects the step from `stage2` to `stage3` (which places out Stage 2 grid quests), so a mis-placement is mild; a native-teacher review should decide whether the rung stays, shrinks to the reply items, or waits for F-VOC sentences.
13. **Gloss withheld on an open question.** CLAUDE.md section 1 says taught Korean always shows romanization and a gloss. On an open placement item the gloss of a picture option is withheld because it would be the answer (the romanization follows the sound guide choice). Everything is shown after the run. Owner to confirm this narrow exception.
14. **Mixed-version uploads** are handled by the Worker preserve rule of section 3.8 (shared with F-VOC-005 P-1); until it is deployed the guard is only the order "Worker first, app second".
15. **Default plan length** — owner decision OD-12 in F-ROUTE-001 section 9, **decided 2026-10-12: accepted as proposed** (thresholds 4 and 16 weeks); the pace chips on the result strip follow OD-13, decided the same day (Gentle 2 / Steady 3 / Brisk 4, default Gentle for "Pictures first" and for classes, Steady otherwise). (AM-11)
16. **One-tap plan for a self profile on any device** — OD-14, **decided 2026-10-14 by the owner: confirmed as proposed** (a self profile applies the recommended plan with one tap, **Use this plan**, no PIN, on any device; a child profile still goes through the grown-up gate).
17. **The level check and writing** — the report's skills note (AM-5); gap list in `AMENDMENTS-PLC-PLAN-HANDOFF.md` section 4.
18. **A helping grown-up** is the most realistic source of false-high results for young learners. The hand-off line asks them to let the learner choose; nothing can enforce it. Beta: compare quest-1 accuracy of placed-out Short learners with others. (AM-40)
19. **Listen-first for `testLocale: 'ko'`** is not assumed. Revisit when beta shows `see-pick-sound` accuracy by test language. (AM-40)
20. **The 4-card Short layout fits 320 x 568 without scrolling** in portrait up to 200 % text, and in landscape (568 x 320) at the default text size with the two-column layout; at larger text in landscape the grid scrolls while the prompt and **I am not sure** stay pinned. The `item-short` wireframe shows both orientations; P-6 verifies them in Playwright at 320 x 568, 568 x 320 and 200 % text. (AM-40) (P-6 finding: react-native-web ignores the font scale, so a browser cannot show 200 % text the way a phone does; Playwright checks 320 x 568 and 568 x 320, the landscape-scroll rule at a larger text size is unit-tested (`shortLayout`), and 200 % text is an on-device check before P-7 turns the flag on.)
21. **Retakes may repeat items.** The previous result's ids are excluded only while each rung still has three questions; a repeated item is a small practice effect, and under the union rule it pushes upward. (AM-40)

---

## Appendix A — bank outline (EN first; 260 templates after the production review of 2026-10-11)

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

Ids: `pitem:sound-basic-hear-<sym-id>`, `pitem:sound-basic-see-<sym-id>`, `pitem:sound-rest-hear-<sym-id>`, `pitem:sound-rest-see-<sym-id>` (`<sym-id>` is the jamo id without the prefix: `giyeok`, `nieun`, ...). Tags: `sym:<symbol>`, `group:basic|rest`. `requires`: hear = `{ audio: true }`, see = `{ audio: false }`. Leaking when romanization is withheld: both formats (the symbol or its tiles are the tested element). Every written single letter (a tile, or the prompt of `see-pick-sound`) carries its value from the jamo table (`JAMO_SOUND_VALUES`: ㄱ `g/k`, ㄴ `n`, ㄷ `d/t`, ㄹ `r/l`, ㅁ `m`, ㅂ `b/p`, ㅅ `s`, ㅇ `silent/ng`, ㅈ `j`, ...), the same value the app's letter cards teach; the carrier syllable (`ga`, `na`, ...) is only the sound chip.

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

Formats: `hear-pick-picture` (oral form: a spoken word, four pictures) and `read-pick-picture` (read form: a written word, four pictures). Pictures are `card:` art that exists today (`supportedCardIds`, `HeritageCardArt.tsx:21`), so every template here resolves without new art (D7); the Stage 2 cards, which have no art, are not used (note below); pictures show no text label during the item. The read list contains only words built from the 24 jamo plus the six taught finals (decodable after Stage 1); the hear list may contain any concrete word. Distractor pictures are three other cards of the picture pool drawn with the seed, never two from the same row of `avoidWith` (for example 김치 and 김밥 are not shown together).

| Form | Count | Words (card id, romanization generated) |
|---|---|---|
| hear | 29 | 김치 `card:kimchi` gimchi, 밥 `card:rice` bap, 젓가락 `card:chopsticks` jeotgarak, 한복 `card:hanbok` hanbok, 김밥 `card:kimbap` gimbap, 떡국 `card:tteokguk` tteokguk, 송편 `card:songpyeon` songpyeon, 호랑이 `card:tiger` horangi, 까치 `card:magpie` kkachi, 무궁화 `card:mugunghwa` mugunghwa, 산 `card:mountain` san, 바다 `card:sea` bada, 달 `card:moon` dal, 윷놀이 `card:yutnori` yunnori, 제기 `card:jegi` jegi, 연 `card:kite` yeon, 팽이 `card:top` paengi, 청자 `card:pottery` cheongja, 가야금 `card:gayageum` gayageum, 책 `card:book` chaek, 한지 `card:hanji` hanji, 붓 `card:brush` but, 먹 `card:ink` meok, 종이접기 `card:origami` jongijeopgi, 밥상 `card:family-table` bapsang, 설날 `card:seollal` seollal, 추석 `card:chuseok` chuseok, 세배 `card:sebae` sebae, 연등 `card:lantern` yeondeung |
| read | 19 | 김치 `card:kimchi` gimchi, 밥 `card:rice` bap, 한복 `card:hanbok` hanbok, 김밥 `card:kimbap` gimbap, 송편 `card:songpyeon` songpyeon, 호랑이 `card:tiger` horangi, 산 `card:mountain` san, 바다 `card:sea` bada, 달 `card:moon` dal, 연 `card:kite` yeon, 한지 `card:hanji` hanji, 청자 `card:pottery` cheongja, 종이접기 `card:origami` jongijeopgi, 밥상 `card:family-table` bapsang, 가야금 `card:gayageum` gayageum, 연등 `card:lantern` yeondeung, 설날 `card:seollal` seollal, 추석 `card:chuseok` chuseok, 먹 `card:ink` meok |

Notes: `card:yutnori` is the card for 윷놀이; `card:rice` is 밥; `card:family-table` (a table top-down with the bowls of a meal) is 밥상. The Stage 2 cards (`card:sagwa`, `uyu`, `ppang`, `dosirak`, `haneul`, `kkot`, `namu`, `byeol`) have no art in `supportedCardIds`, so the first outline's 13 vocabulary templates on them (hear: 사과 우유 빵 도시락 하늘 꽃 나무 별; read: 우유 하늘 별 나무 도시락) were replaced in the production review by the remaining Stage 1 cards (hear: 먹 종이접기 밥상 설날 추석 세배 연등; read: 종이접기 밥상; no other Stage 1 card name is decodable with the 24 jamo and six taught finals). 한글날 (`card:hangul-day`) is not a target: its picture carries the written word 한글. Distractor pictures come from the 30 art-backed cards; the read form never shows `card:hangul-day`, and the conflict list of the bank test keeps pictures that share what they show or belong to each other apart (for example 설날 never with 떡국, the folk games or 까치; 달 never with 추석 or 연등; 호랑이 never with 연, whose kite carries a tiger face). 먹 is the ink stick (`card:ink`). Ids: `pitem:vocab-hear-<rr>`, `pitem:vocab-read-<rr>`. Tags: `word:<rr>`, `topic:<theme>`. A template whose picture does not resolve is excluded from the draw (never replaced by a text tile).

### A.5 Simple sentences (`sentences`, gate `sentence`, 54 templates)

Formats: `hear-pick-picture` and `read-pick-picture` for the two sentence patterns of blueprint 05 section 3.3, and `reply-pick` (read form: hear a line, choose the reply among three written replies; the Stage 4 taste quest already teaches the first three, `minigame-config.ts:282-310`). Picture options are `card:` art; the target picture is the noun in the sentence. The sentences below were converted with the same pronunciation-based converter F-CNT-002 uses; every romanization is generated at build time and compared (never typed).

| Pattern | Forms | Count | Sentences (romanization) -> picture |
|---|---|---|---|
| N-ieyo / N-yeyo ("it is a N") | hear + read | 28 | 호랑이예요 (horangiyeyo) -> `card:tiger`; 달이에요 (darieyo) -> `card:moon`; 산이에요 (sanieyo) -> `card:mountain`; 바다예요 (badayeyo) -> `card:sea`; 연이에요 (yeonieyo) -> `card:kite`; 팽이예요 (paengiyeyo) -> `card:top`; 까치예요 (kkachiyeyo) -> `card:magpie`; 한복이에요 (hanbogieyo) -> `card:hanbok`; 김치예요 (gimchiyeyo) -> `card:kimchi`; 책이에요 (chaegieyo) -> `card:book`; 붓이에요 (busieyo) -> `card:brush`; 제기예요 (jegiyeyo) -> `card:jegi`; 윷이에요 (yuchieyo, 'These are yut sticks.', tag `word:yut`) -> `card:yutnori`; 한지예요 (hanjiyeyo) -> `card:hanji` |
| N-eul/reul V-yo ("I eat / wear / read / fly N") | hear + read | 16 | 밥을 먹어요 (babeul meogeoyo) -> `card:rice`; 김치를 먹어요 (gimchireul meogeoyo) -> `card:kimchi`; 김밥을 먹어요 (gimbabeul meogeoyo) -> `card:kimbap`; 떡국을 먹어요 (tteokgugeul meogeoyo) -> `card:tteokguk`; 송편을 먹어요 (songpyeoneul meogeoyo) -> `card:songpyeon`; 한복을 입어요 (hanbogeul ibeoyo) -> `card:hanbok`; 책을 읽어요 (chaegeul ilgeoyo) -> `card:book`; 연을 날려요 (yeoneul nallyeoyo) -> `card:kite` |
| greeting and reply | reply-pick | 10 | 안녕하세요! (annyeonghaseyo) -> 안녕하세요. (annyeonghaseyo); 이름이 뭐예요? (ireumi mwoyeyo) -> 저는 호야예요. (jeoneun hoyayeyo); 만나서 반가워요! (mannaseo bangawoyo) -> 저도 반가워요. (jeodo bangawoyo); 감사합니다. (gamsahamnida) -> 천만에요. (cheonmaneyo); 안녕히 가세요. (annyeonghi gaseyo) -> 안녕히 계세요. (annyeonghi gyeseyo); 잘 지냈어요? (jal jinaesseoyo, 'Have you been well?') -> 네, 잘 지냈어요. (ne jal jinaesseoyo); 이거 김치예요? (igeo gimchiyeyo) -> 네, 김치예요. (ne gimchiyeyo); 밥 먹었어요? (bap meogeosseoyo) -> 네, 먹었어요. (ne meogeosseoyo); 고마워요. (gomawoyo) -> 아니에요. (anieyo); 미안해요. (mianhaeyo) -> 괜찮아요. (gwaenchanayo) |

Ids: `pitem:sent-n-hear-<rr>`, `pitem:sent-n-read-<rr>`, `pitem:sent-v-hear-<rr>`, `pitem:sent-v-read-<rr>`, `pitem:sent-reply-<n>`. Tags: `pattern:n-ieyo|n-eul-v|reply`, `word:<noun>`. Reply distractors are two replies of other rows, never a pair that is also a natural answer (the replies to 안녕하세요 and 만나서 반가워요 are not distractors of each other; each template lists its `incompatibleWith` row ids and the bank test checks them). Every line and reply ends with its sentence mark (표준 문장 부호). The production review (section 9, item 1) moved 천만에요 to the formal 감사합니다 and 아니에요 to the everyday 고마워요, grounded row 7 as a yes/no question, and removed distractors that are also natural replies (저는 호야예요 after 안녕하세요, 안녕히 계세요 after 감사합니다, 괜찮아요 after 밥 먹었어요?, 안녕하세요 after 잘 지냈어요?). All 54 sentence templates are `ready` with `reviewedBy` / `reviewedAt`.

### A.6 Counts

| Strand | Templates | Minimum |
|---|---|---|
| hangul-recognition | 40 | 40 |
| sound-letter | 46 | 40 |
| syllable-reading | 72 | 40 |
| vocabulary | 48 (hear 29, read 19) | 40 |
| sentences | 54 | 40 |
| total | 260, all ready | 200 |

## Appendix B — amendments to F-RVW-001 (applied by PR P-0; F-RVW-001 is `draft` and no review code is in the tree, so nothing shipped changes; it stays `draft` until its own PR 1)

> **Applied 2026-10-11 in PR P-0.** B1 to B7 and B9 are in the text of `F-RVW-001-review-tests.md`; B8 is a no-change note recorded there as well. The `pitem:` row of F-I18N-001 section 3.6 `OVERLAY_FIELDS` was already in that spec and in `scripts/overlay-fields.mjs` (P-4), and the CLAUDE.md section 2 line landed with the owner's P12 approval (#194).

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

## Appendix C — rung and path summary (for implementers; AM-41)

```
SHORT (levelOrder 0 default; listen-first; no "not sure" sheet; no clock)
  sound-basic   hear-pick-written           3   fail -> vocab oral, end
  vocab oral    hear-pick-picture           3   (warm-up word avoided)
  syl-cv        hear-pick-written, 3 of 3   3   only if sound-basic passed
  paths: 6 · 9 (no sound: does not start)

STANDARD (default)
  recog, sound-basic, syl-cv, sound-rest, syl-cvc   3 each, ladder ends at the first not passed
  vocab read     x2 (second draw at once)   3+3  only if syl-cvc passed
  sentence read                              3   only if vocab read passed twice
  oral pair      vocab oral, sentence oral   6   when the ladder stopped before syl-cvc passed
  vocab oral                                 3   once, after a vocab read that did not pass
  paths: 12 · 15 · 18 · 21 · 24

DEEP (opt-in; rest card after 18)
  recog 3; then sound-basic, syl-cv, sound-rest, syl-cvc, vocab read, sentence read: 3+3 each,
  the second draw after the next step's first draw (sound-basic not confirmed when syl-cv did not pass);
  sentence read's second draw right after vocab read's second draw; a step asked before an earlier
  confirmation failed is stored but not passed (stepPassed)
  listening: oral pair if vocab read not passed; else sentence oral only (vocab oral while no sentence draw)
  paths: 12 to 42
```

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

Reading the table: a guesser is placed at band 1 or lower in more than 98 % of runs (the section 5 threshold is 95 %), the 12-question floor is the common case for a learner who does not read yet, and the Quick length is intentionally capped, which is why the report offers the full check after a clean quick run. The table above is the pre-modes Full ladder (P3, replaced by P14); Standard differs from it only by the second `vocab` read draw.

**Three modes (P14 to P17), measured 2026-10-11 (AM-42).** The real engine with the P-3b change (`startRun`, `apply`, `finishRun`), the shipped bank (260 ready), the 15-quest fixture, 2,000 seeded runs per mode x learner x pace, `revealMode: 'tap'`, audio and visual on, `takeMyTime` off, the warm-up word avoided, listen-first at the *Pictures first* pace, the backstop live. Every result was parsed as the engine wrote it, with the new schema and with a frozen copy of the pre-change schema. `placement-modes-simulation.test.ts` re-runs the same model at 300 runs per cell in CI.

**Learners.** A learner *knows* an item with probability p per rung; otherwise taps "not sure" with probability u, else guesses. Guessers (p 0, u 0): uniform, never the first card, always slot 0 / 1 / 2. Not sure (u 1). Intermediate, true level about band 2: `recog` .95, `sound-basic` .92, `syl-cv` .88, `sound-rest` .8, `syl-cvc` .45, `vocab` read .35, `vocab` oral .6, `sentence` read .25, `sentence` oral .4, u .4. Advanced: .97 everywhere, u .5.

**Time model.** Seconds per answered item at the *Some reading* pace: `shape-odd-one-out` 7, `hear-pick-written` 9, `see-pick-sound` 9, `build-syllable` 14, word `hear-pick-picture` 8, sentence `hear-pick-picture` 11, word `read-pick-picture` 10, sentence `read-pick-picture` 14, `reply-pick` 15, "not sure" 5; x1.5 *Pictures first*, x0.8 *Reads easily*; per-learner speed lognormal (σ 0.25), per-item noise lognormal (σ 0.35); plus 1.5 s per transition, 2.5 s of spoken instruction on the first item of each rung, a 2 s cheer every 2 answers (Short) or 3 (others), 8 s per pause sheet, 10 s for Deep's rest card and 30 s of warm-up. The options, language and hand-off screens are not counted.

| Mode | Learner | Asked | p50 / p90 min | Levels | Above band 0 / above band 1 |
|---|---|---|---|---|---|
| Short (*Pictures first*) | guessers (worst of five) | 6-9 | 2.3 / 3.2 | band 0 99.8 % | 0.20 % / 0 % |
| Short | not sure | 6 | 1.6 / 2.0 | band 0 100 % | 0 / 0 |
| Short | intermediate | 9 | 3.0 / 3.8 | band 0 27.6 %, band 1 72.3 % | — |
| Short | advanced | 9 | 3.0 / 4.0 | band 0 6.1 %, band 1 93.9 % | — |
| Standard (*Some reading*) | guessers (worst of five) | 12-21 | 3.0 / 4.0 | band 0 96.8 % | 3.2 % / 0.60 % |
| Standard | not sure | 12 | 2.5 / 3.0 | band 0 100 % | 0 / 0 |
| Standard | intermediate | 12-24 (mean 21.1) | 4.7 / 6.1 | band 2 39.1 %, band 3 39.9 %, `stage2` 6.1 %, `stage3` 3.0 % | — |
| Standard | advanced | 12-24 (mean 23.9) | 5.8 / 7.5 | `stage3` 98.5 % | — |
| Deep (*Some reading*) | guessers (worst of five) | 12-30 | 3.0 / 4.0 | band 0 99.8 % | 0.15 % / 0 % |
| Deep | not sure | 12 | 2.6 / 3.0 | band 0 100 % | 0 / 0 |
| Deep | intermediate | 12-42 (mean 31.3) | 7.1 / 9.8 | band 2 54.4 %, band 3 19.7 %, `stage2` 3.5 %, `stage3` 0.3 % | — |
| Deep | advanced | 12-42 (mean 41.6) | 10.3 / 13.3 | `stage3` 97.7 % | — |

- **Short is conservative.** No run placed above band 1 or more than three quests out. The report hint (section 3.9) reaches 97.0 % of the intermediate runs (72.3 % at band 1 plus 24.7 % held at band 0 only by the 3-of-3 rule) and 99.7 % of the advanced ones; a uniform guesser triggers it in 2.8 %.
- **Standard's second `vocab` read draw** puts the intermediate learner at `stage2` or higher in 9.0 % of runs; with one draw it is about 21 % (9.0 % / 0.42, the chance of passing the second draw).
- **Deep sets a higher bar:** the intermediate learner is above band 2 in 23.5 % of Deep runs and 49.0 % of Standard runs. The rest card appears in 94 % (intermediate) and 99 % (advanced) of runs.
- **By pace (p50 / p90 minutes; share ended by the backstop).** Standard, *Pictures first*: intermediate 6.2 / 8.4 (1.0 %), advanced 7.8 / 10.8 (7.0 %); *Reads easily*: 4.1 / 5.3 and 5.0 / 6.3 (0 %). Deep, *Pictures first*: intermediate 9.3 / 13.1 (0.4 %), advanced 13.7 / 19.1 (4.2 %); *Reads easily*: 6.2 / 8.4 and 8.7 / 11.1 (0 %). Short, *Some reading* and *Reads easily*: 2.3 / 2.9 and 2.1 / 2.6.
- **Listen-first:** no Standard or Deep run of a *Pictures first* learner drew `see-pick-sound` or `build-syllable`.
- **Old readers:** 100 % of Short and Standard results parse with the pre-change schema; Deep results parse when they end early (guessers, beginners), and 16 % (intermediate) and 1 % (advanced) otherwise.
- **`avoidFirst`.** With the shared default `true`, the worst tapping pattern reached 4.35 % above band 0 and 1.30 % above band 1 in Standard and 0.65 % above band 0 in Short; hence `false` for placement (AM-25).

## Review log

- 2026-10-13, docs follow-ups after the 2026-10-13 merges. Row P-7b is marked done (#573: the result weekly-plan strip, the `RouteProposal` entry and the report's Suggested weekly plan card, all behind `flags.routeEnabled`). OD-14's proposed default (one tap, no PIN, for a self profile) is what P-7b built; the owner confirms it before P-10's flag flip, and P-10's Needs list OD-14.
- 2026-10-14, owner decision OD-14 (answered in chat): confirmed as proposed; a self profile applies the recommended plan with one tap (**Use this plan**, no PIN) on any device, and a child profile still needs the grown-up gate. Assumption 16 records it, and P-10's Needs no longer list OD-14 (P-10 still needs P-7, P-7b, P-8, the P-3b Worker deploy and the store build carrying P-3b's schema). No code change: P-7b (#573) built this behaviour.
- 2026-10-14, P-10 (the beta flip). `flags.placementEnabled` defaults to `true` on every platform and is read by its literal name, so `EXPO_PUBLIC_PLACEMENT_ENABLED=false` (or `0`) reaches the web bundle as the kill switch. Decision 2026-10-14 on the store-build gate of section 3.8, taken under the owner's standing production-level pre-approval and recorded for the owner to confirm (no explicit owner answer on this gate): no native iOS or Android build has been released to any store or to TestFlight, so the gate has no older released build to protect; it is satisfied because the first such build will already carry P-3b's schema, and it applies again only if a store or TestFlight build without that schema ever ships. Any local Xcode or TestFlight install that predates P-3b is rebuilt from `main` before it imports a newer backup (owner runbook). The P-3b Worker is live: a read-only `GET /health` on production answered `ok` and carries `features.notesSend` (FB-3a, #459, merged after P-3b's #200). `placement.spec.ts` (section 5) runs on every PR. Row P-10 is marked done.
