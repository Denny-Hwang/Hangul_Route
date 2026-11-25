# AMENDMENTS-QUEST-LEAVE-RESUME — a game is never left by accident; a quest or a long check goes on where it stopped; a finish that was not saved never looks done

Status: ready (owner decisions 2026-11-23 and 2026-11-24) for rows LR-0b, LR-1, LR-2, LR-3a, LR-3b, LR-4 and LR-5. Owner decision 2026-11-23: OD-LR1 to OD-LR8 approved as recommended in revision 1 (§10); the review of 2026-11-23 re-opened OD-LR1 and added OD-LR9. Owner decision 2026-11-24: OD-LR1 (c) and OD-LR9 (b), both as recommended (§10); the LR-0b design-pass questions O2 to O5 also answered as recommended (§10). Revision 2 (2026-11-23) adjudicates the two-lens review of revision 1 (§11). Written for work orders WO-06 and WO-07 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row LR-0, on main `e72336a7d` (both work orders were written on `d5ba0217c`; §1 re-reads every citation).

**Amends**: AMENDMENTS-AUDIT-2026-11 AU-12 ("No new screen and no new string": Home now says that a lesson goes on) · AMENDMENTS-QUEST-SOUND-BACK QB-2 ("a game in play has no Previous (its own Close goes back to the launcher as today)": the Close stays, and asks first once the game has an answer) · F-QUEST-002 §3.9 (the Hangul Check, "Leaving ... nothing is saved": an interrupted check now goes on) · F-CURR-002 §4.5 and §7.3 (rows CM-14 and CM-22: the Daily Review and the Stage Check after a finish that could not be saved; the Stage Check also goes on after an interruption) · AMENDMENTS-DISPLAY-NAV §7.1 (one more route that asks before a back; nested guards on one route) and §9.1 (the Home hero) · wireframes `minigame/shell.md`, `home/next-lesson-hero.md`, `reviews/hangul-check.md`, `reviews/stage-check.md`, `reviews/daily-review.md` · tag **[LR]**
**Not amended**: the star rules (F-001 §3.2 first-try scoring, F-RVW-001 §3.1, AU-9's skip cap, QB-3's score-neutral replay). Nothing here changes how a star is counted. Nothing saves a game's state inside a step (WO-07 "하지 말 것"); a check's stored first answers are answers, not game state (§3.4).
**Scope**: `apps/mobile` — `screens/minigames/MinigameScreen.tsx`, `screens/use-back-guard.ts` (a guard scope for nested guards), `store/quest-run-store.ts` (one counter), `logic/quest-flow/saved-run.ts` (one pure helper), `store/quest-run-saved.ts` (the read), `screens/home/HomeScreen.tsx`, `screens/reviews/StageReviewScreen.tsx`, `logic/stage1/review-flow.ts`, `store/review-run-store.ts`, `store/check-run-saved.ts` (new), `logic/reviews/saved-check.ts` (new), `store/profile-keys.ts`, `screens/stage-check/StageCheckScreen.tsx`, `logic/reviews/stage-check-api.ts`, `screens/reviews/DailyReviewScreen.tsx`, `logic/reviews/daily-review-api.ts`, the Daily Review chunk (`screens/reviews/daily-review-chunk.tsx`), the tests of §6; `packages/i18n` (en, es, ko in each row's PR, §3.7)
**Owner**: solo dev
**Rollout**: next release; no migration; row LR-1 (WO-06) can ship before the WO-07 rows (§9)

---

## 1. Context

The charter promises that a learner never loses what they earned and is never shamed (CLAUDE.md §1, anti-shame rules). Two holes are left in that promise, and the review of 2026-11-21 found both:

- A game can be left by accident. A tap on the header's Close, the Android back or an iOS edge swipe takes the learner out of a game at once, and the game then starts again from its first round (WO-06).
- A long check stopped by an app kill, a phone call or a discarded browser tab starts again from its first item, and a finish that could not be saved shows a page that says something untrue (WO-07).

### 1.1 Citations re-read on `e72336a7d`

| Work order's claim (on `d5ba0217c`) | On `e72336a7d` | Verdict |
|---|---|---|
| WO-06: `navigation/root.tsx:165`, the `Minigame` route has no `gestureEnabled` | `root.tsx:175`. The `QuestPlayer` route above it (`:174`) has none either; the quest player turns the swipe off itself while it guards (`useRouteBackGuard(..., holds)`, `QuestPlayerView.tsx:353-357`). The guest stack's `Minigame` route has none (`navigation/guest-chunk.tsx:94`; not cited by the work order) | moved; one more route |
| WO-06: `root.tsx:169-178`, `:208`, the check screens have `gestureEnabled: false` | `:179` (StageReview), `:181` (DailyReview), `:182` (CellCheck), `:183` (WeekDrop), `:185` (StageCheck), `:188` (DecodingSprint), `:218` (Placement) | moved |
| WO-06: `navigation/screen-header-variants.ts:62` `Minigame: 'close'` | `:65` | moved |
| WO-06: `screens/minigames/MinigameScreen.tsx:87, 142-158`: one body per step, back is `navigation.goBack()` | `:87` keys the body `${questId}:${stepIndex}`; `:142` `learnerBack` is `navigation?.goBack()`, `:143` the exits, `:151` `finishIsSent`, `:152-157` `close`, `:162-166` `closeAs`. Also: a game's own finish (`close`, `closeAs`, `complete` `:201-204`), the not-found page's Back to quest (`fallback`, `:169-175`) and every game's empty-state Back to quest (`onBack`) leave through the same `exits.back()`, so a `GO_BACK` (`logic/navigation/back-action.ts:7`) that a guard would catch | true; range now `:142-166`; a guard must let the screen's own exits through (§3.1) |
| WO-06: `useRouteBackGuard` is used by one game, `StoryCheckGame.tsx` | `StoryCheckGame.tsx:208-215`. It guards only Story Check's recap (a back there ends the step like Done); it never asks a question | true |
| WO-06: the guard `screens/use-back-guard.ts:26-40` | `useBackGuard` `:26-40`, `useRouteBackGuard` `:46-49`. The native swipe cannot be cancelled by `beforeRemove`, so the guard turns the gesture off while it holds (`:20-24`, `:36-39`) | true |
| WO-06: the sheet is `ConfirmSheet` if WO-37's CS row is done, else `platform/dialog.ts` without `destructive` | WO-37 row NB-4 (`phase-5-native-a11y.md`) has no spec yet (`AMENDMENTS-NATIVE-PLATFORM-BASICS.md` does not exist). `platform/dialog.ts:36-51` is the system `Alert` on native. But the design system's `ConfirmSheet` is already drawn by screens on every platform: Daily Review (`DailyReviewScreen.tsx:316-325`), Cell Check (`CellCheckScreen.tsx:213-225`), Stage Check (`StageCheckScreen.tsx:180-194`) | the condition is unmet, and a third way exists (OD-LR2) |
| WO-07: `QuestPlayerView.tsx:132` "run kept in quest-run-store (memory only)" is stale | `:132`, unchanged. The view's store is memory only; the learner screen keeps a copy on the device (`QuestPlayerScreen.tsx:73-108`), so the line misleads | true |
| WO-07: `QuestPlayerView.tsx:321-340` leave resets the run | `:321-325` (`leaveQuest` → `runQuestLeave`, which resets the run and calls the ports' leave, `logic/quest-flow/quest-player-ports.ts:97-100`), `:327-339` the confirm (`destructive: true` at `:335`); the learner's leave also clears the saved run (`quest-player-ports.ts:221-223`) | true |
| WO-07: `learner.ts:712-717` "Stars from this try will not be saved." | `packages/i18n/src/messages/en/learner.ts:724-729` (`learner.quest.leave`; the message `:726`) | moved |
| WO-07: `store/review-run-store.ts:6` "Ephemeral: it persists nothing" | `:6-9` | true |
| WO-07: `screens/reviews/StageReviewScreen.tsx:160-161` | `:160-161` (the run is forgotten on unmount). The check's items come from a random seed made once per visit (`:108`), and its intro is drawn at once: the screen has no loading frame (`:100-110`) | true |
| WO-07: `screens/reviews/DailyReviewScreen.tsx:299-301, 456-465` go to "All refreshed today" when the save fails | `:299-301` (a rejected `finishSession` sets `nothing`), the page `:456-466` ("All refreshed today", "Nothing is waiting right now.") | true |
| WO-07: `screens/stage-check/StageCheckScreen.tsx:167` goes to "All refreshed today" | `:167` sets `nothing`, but the Stage Check's `nothing` page (`:335-350`) shows its title and `learner.stageCheck.notReady`, "This check is not open yet. Keep playing your quests." (`learner.ts:3020`), not "All refreshed today" | **line true, claim false**: the page shown is a different untrue line; §3.5 is built on what the code shows |
| WO-07: the right model is `screens/cell-check/CellCheckScreen.tsx:168, 180-188` (`failed` phase + Try again) | `:51` the phase, `:168` a rejected finish sets it, `:180-188` OopsScreen with Try again. But Try again there starts a **new attempt** (`:183-186`: a new plan, then the intro); the answers are not kept | true, but WO-07's test ("답 유지, Try again 성공 → 완료 화면") needs more than the model does (§3.5) |
| WO-07 item 5: the saved-run read uses WO-01's read contract | WO-01 is merged: `store/durable-read.ts:49` `durableRead(key, copyKey)` → `missing` / `value` / `failed`. The saved run is read today with `readJsonStrict(...).catch(() => null)` (`store/quest-run-saved.ts:50`): a failed read already means no resume and touches nothing else, but has no retry on a fresh connection | §3.3 moves it onto `durableRead` |
| WO-07: what already resumes, stories (bookmark) and the level check (saved run) | the story bookmark (`store/story-store.ts`, `getResumableBookmark`); the level check (`store/placement-run-store.ts`, `logic/placement/flow.ts:544, 582-591`: a 24 h window, a bank version, Continue or Start again) | true; §3.4 follows the level check's shape |

Facts the work orders do not state, which change the design:

- **The Home hero already says Continue and already resumes.** The hero's label is "Continue" for every learner with one quest done (`logic/placement/home-card.ts:88`, `learner.home.next.continue.cta`, `learner.ts:340`), and its tap opens the quest player (`HomeScreen.tsx:742-746`), which resumes a saved run of that quest (AU-12, `quest-player-ports.ts:176-192`). What is missing: a learner on their first day reads "Start" over a resumed run; nobody can see that a lesson will go on in the middle; and the only way to start a lesson from its first step is Leave inside it.
- **A story quest resumes a saved run only through Keep reading** (`quest-player-ports.ts:184-186`), so the hero, which opens the player without `resume`, never resumes one: it starts the story quest again and its new run replaces the saved one (`:182-191`).
- **The hook that loads a lesson's steps throws.** `useLessonQuestState` (`screens/lesson-content.tsx:193-217`) answers `'waiting'` until the cell's chunk is in and throws a failed load (`:216`, the crash screen), after it may have reloaded the page for a newer build (`:205`). A screen that only wants to peek at a lesson's steps cannot use it.
- **The check stores record every first answer at once.** The Stage Check writes each first answer into the memory store when it is given (`recordRound`, `StageCheckScreen.tsx:146`; `stage-check-api.ts:204-208`), and its screen keeps the recordings as a list in answer order (`recorded`, `:76`, `:146`), as the Daily Review does (`DailyReviewScreen.tsx:173`, `:264`).

### 1.2 What AU-12 and QB-2 to QB-4 already ship (no row here re-does it)

- The quest run is kept per learner at `hr:quest-run:<profileId>` (`QUEST_RUN_KEY`, `store/quest-run-saved.ts:17`): the quest, its episode, the step list's signature, the furthest step reached (QB-4), the tallies, the scored-round keys, the skipped steps, the step events already sent (QB-3) and the start time (`logic/quest-flow/saved-run.ts:31-48`).
- It is written when the run begins and at each step change (`keepRunSaved`, `quest-run-saved.ts:81-94`), one write after another (`:29-38`); a failed write is dropped (`:58`).
- Opening the same quest within 24 hours of the run's start resumes at that step, the step itself from its beginning (`SAVED_RUN_MAX_AGE_MS`, `saved-run.ts:22`; `resumableRun`, `:113-140`): another quest, a changed step list, a clock more than a day off either way or numbers that are not a run's discard it. A round scored before the reload is not scored again (its key is kept).
- It is cleared on finish and on Leave (`quest-player-ports.ts:217-223`), and with the learner (`quest-run-saved.ts:96-100`; `PER_PROFILE_KEYS`, `store/profile-keys.ts:49`). A guest run does not use it (GU-D12).
- Previous between steps; a step shown again scores nothing new; a game in play has no Previous and its Close goes back to the launcher (QB-2, QB-3).

So WO-07's "사양이 정해야 할 것" 1, 2, 3 and 5 are decided for the quest. What is left:

1. **LR-1** (WO-06): a back on a game that has an answer asks first.
2. **LR-2** (WO-07 a): Home says that the hero's lesson will go on, and keeps a way to start it again from the first step; the saved-run read moves onto `durableRead`.
3. **LR-3** (WO-07 b): the Hangul Check and the Stage Check go on after an interruption.
4. **LR-4** (WO-07 b): the Daily Review and the Stage Check show a finish that could not be saved as that, with Try again on the same answers.
5. **LR-5** (WO-07 c): every leave line is true after LR-1 to LR-4; the stale comments go; the finishing work.

## 2. User story

> As a learner in the middle of a game, I do not lose my place because my thumb touched the edge of the screen.
>
> As a learner whose phone rang in the middle of a lesson, I open the app and see that I can go on from where I stopped, or start the lesson again if I want.
>
> As a learner who took the Hangul Check for three parts before dinner, I come back and do the last two parts, not all five.
>
> As a parent, when the device could not save my child's review, the screen says so and lets them try again; it does not say "All refreshed today".

## 3. Acceptance criteria

### 3.1 A game asks before it is left (row LR-1)

**Where.** The `Minigame` route of the learner stack (`root.tsx:175`) and of the guest stack (`guest-chunk.tsx:94`). Not the All lessons preview (`inPreview`, `screens/browse/BrowseLessonScreens.tsx:51`: it records nothing, and a grown-up is browsing) and not a `story-read` step (its bookmark keeps the scene; leaving loses nothing) (OD-LR4).

**Answered here.** `quest-run-store` gains `answersGiven: number`, raised by 1 on every `answerRound` call: a first try, a retry, a hinted answer and an answer on a revisit alike (it is raised before QB-3's return for a revisit, `store/quest-run-store.ts:168`). `beginQuest` and `reset` set it to 0 (`blankRun`). It is never saved (`savedRunOf` is unchanged), never scored and never sent. `MinigameBody` reads it when it mounts (one body per step, `MinigameScreen.tsx:87`); the game has an answer here when the value is now larger. Every game answers through `answerRound`: the host games through `hostFor` (`:185-205`), the others through the store directly. It is a proxy for "the game has progress", with two known edges, both accepted (§4): work before the first answer counts as none (Write Frame answers once per frame, after its last slot, `logic/write-frame/flow.ts:209`; Trace Stroke and Trace a Word answer on a pass or a Done), and a game on its end card has answers (§3.1, end card).

**The rule.**

- **Given** a game with no answer here, **when** the learner goes back (the header's Close, `components/LearnerScreenHeader.tsx:76`; the Android back; the browser or phone back through the history bridge; an iOS edge swipe), **then** the game is left at once, as today.
- **Given** a game with an answer here, **when** the learner goes back by the header's Close, the Android back or the browser or phone back, **then** the game stays and the Keep playing sheet opens. All three reach the route's `beforeRemove` (`use-back-guard.ts:12-18`) and run the one guard.
- **iOS edge swipe with an answer here:** the native swipe cannot be held by `beforeRemove` (`use-back-guard.ts:20-24`), so it is turned off while the guard would ask (`holds` = answered here, `:36-39`): the swipe does nothing, and the Close asks (OD-LR3). Before the first answer the swipe leaves, as every other way does.
- **VoiceOver's escape gesture** (a two-finger Z) is a back too. Whether native-stack pops on it, and whether `gestureEnabled: false` stops it, is not known from the code; §3.9 checks it on a device, and a pop past the guard is a follow-up, not a reason to hold this row.
- **A back while the sheet is open is Keep playing**: the sheet closes, never a second sheet. The Android back reaches the sheet's `onRequestClose`, its cancel on native (`packages/design-system/src/components/ConfirmSheet/ConfirmSheet.tsx:149`); a browser back reaches the guard, which closes the sheet and holds the route.
- **End card.** A game that has answered its last round but has not closed yet (its end card or its last advance delay) has answers, so a back asks. That is true: leaving there does not complete the step, and the game starts again next time. Keep playing returns to the end card, whose button completes the step.

**The sheet** (OD-LR2): the design system's `ConfirmSheet`, drawn by `MinigameBody` over the game on every platform, as the Daily Review draws its stop sheet. Title `learner.minigame.leave.title`, message `learner.minigame.leave.message`; the cancel is **Keep playing** (`learner.quest.leave.keep.cta`), drawn first; the confirm is **Leave** (`learner.quest.leave.confirm.cta`), `confirmTone` `'primary'` (no danger tone: that is for a grown-up's destructive step only). `testID` `minigame-leave`.

- **Focus.** On the web the cancel takes focus when the sheet opens (`ConfirmSheet.tsx:85-91`). On iOS and Android the sheet is a `Modal`: the screen reader's focus moves into it and nothing behind it can be reached, in the order title, message, Keep playing, Leave (Leave is never first). Moving native focus to the cancel itself is a design-system change, not this row's (§4).
- **Opening the sheet stops the game's sound** (`stop()`, as leaving does, `MinigameScreen.tsx:140`); Keep playing does not restart it (the speaker plays it again). A game's own timers are not paused: a last-round advance that fires under the sheet completes the step as the game says, and the screen leaves through its own exit.
- **Keep playing**: the sheet closes. The game was never unmounted: its round, its answers and its hint are as they were.
- **Leave**: `exits.back()`, let through the guard: the quest player shows the step's launcher, as today's Close does. Rounds answered stay scored on the first try (AU-12, QB-3); the game opens at its first round next time. No `minigame.finished` (as today's Close: the event goes with the game's own finish).

**The screen's own exits pass.** A `leaving` ref is set before every exit the screen takes itself: `close`, `closeAs`, `complete`, the not-found page's Back to quest and every game's `onBack` (each is drawn only when the game has no round to play). So a game that ends never asks (the same pattern as `allowLeave`, `StageReviewScreen.tsx:113-121`).

**Nested guards: one listener per route.** Story Check's recap guard (`StoryCheckGame.tsx:211-215`) and the shell's guard sit on the same route. Two `beforeRemove` listeners depend on the order they were added (the shell's comes first when the game mounts after `MinigameBody`, which draws `LessonWaiting` while its switches decide, `MinigameScreen.tsx:177`), and two `setOptions({ gestureEnabled })` writers overwrite each other. So `use-back-guard.ts` gains a **guard scope**: `MinigameBody` provides it; a `useRouteBackGuard` inside the scope registers its `onBack` and `holds` with the scope instead of adding its own listener and writing the gesture. The scope owner adds the one listener, asks the nested guards first (the latest mounted first) and its own guard only when none took the back, and writes `gestureEnabled` once, from "own holds or any nested holds". Outside a scope `useRouteBackGuard` is unchanged (the quest player, every other screen). So a back in Story Check's recap ends the step with no sheet whatever mounted first; a back before the recap, with an answer, asks.

### 3.2 Home: a lesson left in the middle (row LR-2)

**When Home shows it.** Home reads the saved run when it comes into focus (`useFocusEffect`, as the level-check peek, `HomeScreen.tsx:773-786`) through `readSavedRun` (§3.3), then decides in two steps:

1. **A candidate, from the saved value alone** (a new pure helper beside `resumableRun` in `logic/quest-flow/saved-run.ts`): the value is a run of the hero's quest (`nextLesson.questId`), began at most 24 hours ago either way (the rule of `:119-120`), and its `stepIndex` is a whole number of 1 or more (a run saved as it began has nothing to go on from), and the quest has no `story-read` step (a story quest resumes only through Keep reading, §1.1). No candidate: the hero is drawn as today, and nothing else happens.
2. **Only for a candidate, the quest's steps.** A lesson quest's steps come with its cell's chunk. Home does not use `useLessonQuestState` (it throws a failed load and may reload the page, §1.1): it asks the lesson store directly, `lessonContent.isQuestReady(questId)` and, when not ready, `lessonContent.ensureCells([lessonContent.cellOfQuest(questId)])` with its rejection swallowed (`content/lessons.ts:33`; `logic/lessons/lesson-store.ts:160-168`), and decides when the store says the quest is ready. Then `resumableRun(saved, quest, now)` (`saved-run.ts:113`) must not be null (a changed step list drops it). A load that fails or never ends: the hero is drawn as today, no crash, no reload.

A saved run of another quest changes nothing on Home: it resumes when that quest is opened again, as AU-12 says (OD-LR5).

**The resume variant** (wireframe `home/next-lesson-resume.md`):

- The button reads **Continue** (`learner.home.next.continue.cta`) whatever `questsDone` is. Its tap is today's (`startNextLesson`, `HomeScreen.tsx:742-746`): the player resumes the saved step. The caption below is its accessibility hint.
- Under the button, so the button never moves when the read lands: one caption, `learner.home.next.resume.line(step, total)`, "You can go on from step 3 of 5." (`step` = the saved `stepIndex` + 1, which is the furthest step reached, QB-4, and the step the player opens; `total` = the quest's step count, as the player's own pill counts), then a quiet link **Start again** (`learner.home.next.resume.startAgain.cta`): role button, at least `touchTarget.min` high. The Learning Route link stays last. The minutes line stays (the lesson's length). The caption is `Caption tone="secondary"`, as the where line, not muted like the minutes line (owner decision 2026-11-24, O2).
- **Start again** opens a `ConfirmSheet`: title `learner.home.next.resume.sheet.title` "Start this lesson again?", message `.sheet.message` "You go back to the first step. Your stars and cards stay.", cancel **Keep my place** (`.sheet.keep.cta`, first, and **the filled button**, because it is the safe choice; owner decision 2026-11-24, O4), confirm **Start again** (`.startAgain.cta`, the plain outlined button, never danger). `testID` `home-start-again`. The shipped `ConfirmSheet` draws its cancel plain and its confirm filled (`confirmTone`), so LR-2 adds a small opt-in to the design system that fills the cancel and draws the confirm plain, with its tests and an update of `design/components/ConfirmSheet/spec.md`; the other sheets keep today's look.
  - Keep my place, the backdrop or a back: the sheet closes; nothing changes.
  - Start again: `clearSavedRun(profileId)` (`quest-run-saved.ts:67-69`), then, once it has run, `startNextLesson()` (OD-LR6). The player's read waits for the same queue (`:50`), so it reads nothing and the quest opens at its first step.
- The message is true: the run's tallies are not stars; stars already earned never drop (`recordBestQuest`, AU-9) and cards stay.
- No new telemetry: `next.started` goes out as for any hero tap.

### 3.3 The saved-run read (row LR-2)

- `readSavedRun` (`quest-run-saved.ts:44-56`) reads through `durableRead(QUEST_RUN_KEY(profileId), null)` (`store/durable-read.ts:49`): `value` → the value; `missing` → `null`; `failed` (either cause) → `null`. It keeps its wait for the queued writes and its 800 ms limit (`SAVED_RUN_READ_MS`, `:20`). A read whose fresh retry outlasts the limit answers `null` too: no resume, which is safe.
- A failed read means no resume and nothing else: no progress record is read or written, `loadFailedFor` is not touched, no screen changes. The copy key is `null`: the run holds nothing earned (stars are written only by the finish), so damaged bytes are not kept and the next run's save writes over them.
- No telemetry: `durableRead` reports only the three profile records (`store/storage-telemetry.ts:14-18, 39-41`).
- What it adds to today: one retry on a fresh connection after a read that threw (`durable-read.ts:43`).
- The same rule, with its own key and limit, for the check run (§3.4).

### 3.4 The Hangul Check and the Stage Check go on after an interruption (rows LR-3a, LR-3b; OD-LR1 (c) and OD-LR9 (b), owner decision 2026-11-24)

**What is common.**

- One stored check per learner: `hr:check-run:<profileId>` (`CHECK_RUN_KEY` in `store/check-run-saved.ts`, new), registered in `PER_PROFILE_KEYS` (`store/profile-keys.ts:26-50`) and removed with the learner (`onProfileRemoved`, as `quest-run-saved.ts:96-100`). A check's save replaces the other check's. Never synced, never sent. Guests take neither check.
- The pure rules (what is stored, whether it may be resumed) are `logic/reviews/saved-check.ts` (new); the module in `store/` reads (§3.3, a limit of 800 ms), writes one after another and clears, as `quest-run-saved.ts` does. A failed write is dropped: the check plays on.
- **What is stored, and when (OD-LR9).** Decided (owner decision 2026-11-24, (b)): **every first answer, when it is given** (the answers only, never a game's state; AU-12 keeps the quest's scored rounds the same way). The check then goes on at the item after the last one answered, and no first answer is ever asked again. The Stage Check writes an answer only after its memory recording has settled (`recordRound`'s promise), so a stored answer is a recorded answer. With OD-LR9 (a) instead (WO-07's "청크 사이 저장"): the run is stored at each pause, after the part's recordings have settled; the part in play when the check stopped is asked again from its first item, its first answers are dropped and scored again (a second chance after a miss), and for the Stage Check those items are written into the memory store twice (§4).
- **Lifetime**: 24 hours from the run's start, either way on the clock (`SAVED_RUN_MAX_AGE_MS` and the rule of `saved-run.ts:119-120`); the same learner (the key).
- **Cleared** when the result is recorded, when a new check starts from the intro (Let's go), and with the learner; with OD-LR1 (c) (§10) Stop keeps it, with (a) Stop clears it. **Kept** after a back on the resume page or on the intro reached by Start again, a reload, an app kill, a reset away, and a finish that could not be saved (§3.5).
- **Reading first.** The Hangul Check draws its intro at once today and builds its items from a seed made once per visit (`StageReviewScreen.tsx:100-110`). It gains a **reading** phase: the intro's Hoya and title with no buttons, for at most the read's limit; then the resume page or the intro. A read that lands after the limit switches the intro to the resume page only while the intro shows and nothing has started; after Let's go it is ignored (and the new run's first save replaces it). The Stage Check reads during its existing loading frame (`StageCheckScreen.tsx:209-249`).
- **The resume page** (wireframe `reviews/check-resume.md`). When a resumable run of this check is stored, the intro is replaced by: Hoya waving, the check's title, `learner.stageReview.resume.title` "Pick up where you left off?", the hero button **Continue** (`common.buttons.continue`) and a secondary **Start again** (`learner.stageReview.resume.startAgain.cta`). The reading-practice switch is not shown: the run's choice is kept.
  - Continue: the check goes on at the item after the last one answered (OD-LR9 (b); with (a), the first item of the next part), with the run's answers restored. A stored run with every item answered (§3.5: stored before the finish) goes straight to the finish.
  - **Start again** shows the normal intro (switch, Let's go, Maybe later) and clears nothing yet: the stored run is cleared only when Let's go starts the new check. Maybe later and the Close from that intro keep it. So a mis-tap on Start again costs nothing. (Decided in the text: review finding, §11.)
  - The header's Close leaves at once and keeps the stored run (the page is an intro: `guardsBack` is false, `review-flow.ts:78-80`). Pauses and results are unchanged; the stop sheet's words follow OD-LR1 (§3.6).
- **First tries.** A check's first try is its own rule, not the quest's `logic/first-try.ts` / `logic/round-keys.ts` (those key the quest run, `quest-run-store.ts:165-196`): the Hangul Check scores the first answer per item (`review-run-store.ts:28-33`), the Stage Check the first answer per round index (`StageCheckScreen.tsx:139-147`). With OD-LR9 (b) a resumed check restores every stored first answer and never asks those items again: nothing is scored twice and no first try is replaced (a kill between an answer and its write loses that one answer, which is asked again). With (a) the interrupted part's first answers are replaced, as above. The stars at the end come from all the answers by today's rules (`tallyReview`, `stageCheckResult`, `reviewStars`: unchanged).
- **Telemetry**: no new name. The start event is sent once per run (`reviewStartEvent` / the Stage Check's `begin`, `stage-check-api.ts:200-202`, not again on Continue); the complete event once, at the finish.
- A read that fails: no resume, the normal intro (§3.3).

**The Hangul Check (row LR-3a).**

- Stored: `{ v: 1, kind: 'hangul', seed, items, answers, hideRomanization, startedAt }`: the seed the run was built from (`StageReviewScreen.tsx:108`; the check is deterministic by seed, `logic/stage1/hangul-check.ts:7-9, 107-121`), `items` the item ids of `buildHangulCheck({ seed }).items` in order, `answers` the `ReviewAnswer` of each item answered (with OD-LR9 (a): of the items of the finished chunks), the attempt's romanization choice and the start time.
- Resumed only when the check rebuilt from `seed` has the same ids as `items` (a content update that adds, removes or moves a letter or word discards it), and `answers` names only items of the check, each `{ first: boolean, retries: integer ≥ 0 }`. An item whose round could not play has no answer, as today (`unansweredItemIds`, `review-flow.ts:98-102`). Anything else is dropped, not repaired.
- On Continue the screen rebuilds `check` from the stored seed (today it is built once from `Math.random`, `:108`), restores the answers (`review-run-store` gains `restore(itemIds, answers)`) and opens the chunk of the item after the last answered one, with that chunk's items from there on (Listen and Pick then counts the rounds left in the chunk). The flow gains `reading` and `resume` phases. The run store stays in memory (its reset on unmount, `:160-161`, stays). The check opens only for a learner who finished Stage 1 (`hangulCheckOpens`, `:73-78`); the stored run is read after that.
- Comments that become untrue are rewritten in the row: `StageReviewScreen.tsx:59` ("stopping saves nothing"), `:160`, and `review-run-store.ts:6-9`.

**The Stage Check (row LR-3b; OD-LR7).**

- Why it is different: the plan is drawn from the learner's memory store and the learner's settings at that moment (`planStageCheck`, `logic/reviews/stage-check.ts:85-105`; `startSession`, `stage-check-api.ts:180-198`; the surface index and the formats read the states, the voice and the `game.*` switches, `review-rounds.ts:149-165, 621`), and each first answer is written into that store at once. A plan made again, or rounds built again from the questions, after the first parts were recorded would be another check. So the stored run keeps **the planned rounds**.
- Stored: `{ v: 1, kind: 'stage', stage, locale, itemsHash, rounds, answers, hideRomanization, startedAt }`: `itemsHash` is the review items chunk's hash when the plan was made (`reviewItemsChunk.hash`, `content/review-items.ts:10`); `rounds` the plan's `ReviewRound`s as played (`logic/reviews/review-rounds.ts:365`: plain data, the meanings already in the UI language); `answers` the learner's first answer per round index (`[index, answer]` pairs).
- Resumed by a new `stageCheckApi().resumeSession(world, saved, locale)` (memory chunk). It reads the world (the recordings need it) and checks: the stage, the locale and `itemsHash` are the same; the run is at most 24 hours old; every round passes a shape check (its `type` is one of the six, and the fields its round view reads are present with the right types) and its item is still in the index and not retired; the answers name only rounds of the plan. Any failure: null, and the check opens on its normal intro. No round is built again. A `v` change is needed when a row changes a round's required fields (said in the type's comment). The open rule (`StageCheckScreen.tsx:81`) is checked first, as today.
- A resumed check records only new answers (the stored ones are in the memory store already) and `begin` is not called again.
- **Stored before the finish**: when the last round is answered the run is stored with every answer before `finishSession` runs, so an app kill or a failed save (§3.5) brings the learner back to the resume page, whose Continue goes straight to the finish.
- After Start again, the intro needs a plan: Let's go runs `startSession` behind the loading frame, as the first open does.

### 3.5 A finish that could not be saved (row LR-4)

**Today** (§1.1): a rejected `finishSession` shows the Daily Review's "All refreshed today" (`DailyReviewScreen.tsx:299-301`) or the Stage Check's "This check is not open yet" (`StageCheckScreen.tsx:167`). It rejects when a round's answer could not be recorded (it waits for every recording first, `daily-review-api.ts:210`, `stage-check-api.ts:212`) or the entry could not be made (`daily-review-api.ts:213`; `stage-check-api.ts:216-219`).

**New** (wireframe `reviews/save-failed.md`):

- Both screens gain a phase `{ kind: 'failed' }`. The plan and the answers are kept (they already live in refs), and each round's recording is kept **by round index** (`recorded` becomes a `Map<number, Promise<void>>`; today it is a list in answer order, `DailyReviewScreen.tsx:173`, `StageCheckScreen.tsx:76`).
- The page: Hoya `thinking`; title `learner.dailyReview.saveFailed.title` "We could not save this yet."; body `learner.dailyReview.saveFailed.body` "Your answers are still here."; one hero button **Try again** (`common.buttons.tryAgain`) in the footer. No danger colour, no X icon of its own, never "failed" or "error" in the copy. The Stage Check reuses the Daily Review's keys (as it reuses its result headlines).
- **Accessibility**, as the read-failed screen does (`screens/system/ProgressReadFailedScreen.tsx:17, 105, 124-137`): the title takes focus when the page opens; Try again is busy while a try runs (and cannot be pressed twice); a try that fails again announces the title once, politely; after 3 tries in a row a line shows above the button, `learner.dailyReview.saveFailed.stillStuck` "It still did not save. You can stop for now and try another time." (owner decision 2026-11-24, O3)
- **Try again** records again the rounds whose recording rejected (read from the map), then calls `finishSession` again with the same plan and answers. Resolved: the result page, as if the first try had worked. Rejected: the failed page again. A recording rejects, in practice, when the memory store or the item chunk could not be loaded, before any memory row changed (`logic/memory/memory-runtime.ts:318-321`); a throw from the word slice after the rows changed (`recordVocab`, `:346`: a bug path) would be applied again by Try again, and the memory store's same-day rule keeps that from moving a box (§4).
- **A finish is once per plan.** `finishSession` never writes a second `daily` or `stage-check` entry, a second latch or a second complete event for a plan whose entry it already wrote; a second call for that plan answers the result it computed (for example a `WeakMap` from plan to result in each api).
- **A back on the failed page asks** (decided in the text: review finding, §11). The header Close (`screen-header-variants.ts:69, 72`), the Android back and the browser back keep the screen's guard during `failed`, with the screen's own stop sheet: its title and buttons as today (Daily Review: "Stop for now?", Back to it, Stop; Stage Check: "Stop the check?", Keep going, Stop), and the body `learner.dailyReview.saveFailed.leaveBody` "This is not saved yet. Your stars and cards stay." (owner decision 2026-11-24, O3) in both (true whether or not a run is stored for the Stage Check). The stay button comes first. Stop leaves: the Daily Review's session is not written (a Daily Review not finished stays on Home); the Stage Check's stored run (§3.4) stays. **Stop counts the answered due items toward the day's 20**, as a Stop during a round does (`noteStopped`), unless a Try again's finish is in flight when Stop is chosen (the finished entry counts them, so they are not counted twice); a round whose recording rejected and was not recorded again before Stop is not an answer the memory store holds, so that item waits until tomorrow. A Try again still running when Stop is chosen writes nothing more.
- The Daily Review's yut hold (`:287`) is not waited for again on Try again.
- A Stage Check finish that answers `null` (the check switched off or the stage closed meanwhile, `StageCheckScreen.tsx:166`) keeps its calm page: that line is true.
- Not the Cell Check (it has a failed phase, `CellCheckScreen.tsx:180-188`; its Try again starts a new attempt, §4) and not the Hangul Check, whose finish is one synchronous `recordReview` (`StageReviewScreen.tsx:130-140`) and cannot reject this way.
- **The save-later line on the check result pages (OD-LR8).** A finish can resolve while the progress write behind it fails (AMENDMENTS-DURABLE-PROGRESS §3.7). Results already shows `learner.results.saveLater` then (`screens/results/ResultsScreen.tsx:121, 512-516`). The result pages of the Daily Review, the Stage Check, the Hangul Check and the Cell Check show the same line under the stars, with the same selector (`saveRetryFailedFor` or `loadFailedFor` holds the learner) and the same quiet look.

### 3.6 Leave lines that are true (row LR-5; OD-LR1 (c), owner decision 2026-11-24)

The table is the check the row makes on every screen that has a leave or stop sheet, with OD-LR1 (c) (owner decision 2026-11-24):

| Screen | Sheet | Line | True because |
|---|---|---|---|
| Quest (`QuestPlayerView.tsx:327-339`) | Leave this quest? | Stars from this try will not be saved. (unchanged) | Leave resets the run and clears the saved run (`quest-player-ports.ts:97-100, 221-223`); stars already earned are untouched. It stays true for a story quest, whose bookmark is not a star |
| Game (`MinigameScreen.tsx`, new, §3.1) | Keep playing? | If you leave, the game starts again next time. | the step's body opens at its first round (`:87`) |
| Hangul Check, Stage Check | Stop the check? | You can keep going later. (`learner.stageReview.leave.bodyKept`, new) | Stop keeps the stored check for 24 hours (§3.4); the resume page offers Continue |
| Cell Check (`learner.stageReview.leave`) | Stop the check? | You can take it again any time. (unchanged) | the Cell Check stores nothing |
| Daily Review (`learner.dailyReview.leave`) | Stop for now? | What you answered still counts. (unchanged) | each first answer is recorded at once (`DailyReviewScreen.tsx:264`); a stop writes no entry (`:249-250`) |
| Daily Review, Stage Check on the failed page (§3.5) | the stop sheet | This is not saved yet. Your stars and cards stay. (`learner.dailyReview.saveFailed.leaveBody`, new) | the finish has not been written |

With OD-LR1 (a): no line changes; Stop clears the stored check, and "You can take it again any time." stays true for both checks. With (b): also `learner.quest.leave.message` → "You can keep going later.", and Leave keeps the saved run (AU-12 and F-QUEST-002's NB-1 line "Leave still discards the unfinished run" are amended with it).

Also in LR-5: `QuestPlayerView.tsx:132` says "(memory only)" of the store and names the device copy the learner screen keeps (AU-12); the finishing work of §9.

### 3.7 Strings (`packages/i18n/src/messages/en/learner.ts`)

English at CEFR Pre-A1, for every age (CLAUDE.md §1). Spanish and Korean are shipped locales (`packages/i18n/src/locales.ts:31-35`), so a key missing in es or ko fails `es-coverage.ts` / `ko-coverage.ts`: **every row that adds a key** (LR-1, LR-2, LR-3a, LR-4, LR-5) carries its es and ko values from an R8 draft with the F-I18N-001 §3.10 review in the same PR, ledger re-signed (as AMENDMENTS-TRACE-IDLE §3.6 and AMENDMENTS-DURABLE-PROGRESS §3.8 did). A row that **changes** an English value re-translates its es and ko in the same PR: the coverage ratchet does not catch a stale translation. This spec gives English only.

| Key | English | Row |
|---|---|---|
| `learner.minigame.leave.title` | Keep playing? | LR-1 |
| `learner.minigame.leave.message` | If you leave, the game starts again next time. | LR-1 |
| `learner.home.next.resume.line` | `(step: number, total: number) => \`You can go on from step ${step} of ${total}.\`` | LR-2 |
| `learner.home.next.resume.startAgain.cta` | Start again | LR-2 |
| `learner.home.next.resume.sheet.title` | Start this lesson again? | LR-2 |
| `learner.home.next.resume.sheet.message` | You go back to the first step. Your stars and cards stay. | LR-2 |
| `learner.home.next.resume.sheet.keep.cta` | Keep my place | LR-2 |
| `learner.stageReview.resume.title` | Pick up where you left off? | LR-3a (the Stage Check reuses it) |
| `learner.stageReview.resume.startAgain.cta` | Start again | LR-3a (the Stage Check reuses it) |
| `learner.dailyReview.saveFailed.title` | We could not save this yet. | LR-4 (the Stage Check reuses it) |
| `learner.dailyReview.saveFailed.body` | Your answers are still here. | LR-4 (the Stage Check reuses it) |
| `learner.dailyReview.saveFailed.leaveBody` | This is not saved yet. Your stars and cards stay. | LR-4 (the Stage Check reuses it) |
| `learner.dailyReview.saveFailed.stillStuck` | It still did not save. You can stop for now and try another time. | LR-4 (the Stage Check reuses it) |
| `learner.stageReview.leave.bodyKept` | You can keep going later. | LR-3a, with OD-LR1 (b) or (c) |
| `learner.quest.leave.message` (changed) | You can keep going later. | LR-5, only with OD-LR1 (b) |

Reused, unchanged: `learner.quest.leave.keep.cta` (Keep playing), `learner.quest.leave.confirm.cta` (Leave), `learner.home.next.continue.cta` (Continue), `learner.dailyReview.leave.*` and `learner.stageReview.leave.*` (titles and buttons), `common.buttons.continue`, `common.buttons.tryAgain`, `learner.results.saveLater`. "Pick up where you left off?" and "Start again" are the level check's words (`learner.placement.resume`, `learner.ts:1532`), so the learner meets one way of saying it. The review-copy rule (`lintReviewStrings`, run by `scripts/validate-content.mjs:327-331`; namespaces `REVIEW_COPY_NAMESPACES`, `packages/content-schema/src/lesson-lint-copy.ts:131-157`) reads the new `dailyReview` and `stageReview` keys: they hold no percentage and no "n of m". `home` is not one of its namespaces; the Home line's "step 3 of 5" is a place in the lesson, as the hero's "lesson 2 of 3" (`learner.home.next.where`, `learner.ts:346`) already is, never a count of answers.

### 3.8 Telemetry

No new event. LR-1 adds a counter that is never sent. A resumed check sends its start event once per run and its complete event once (§3.4). `minigame.finished` is unchanged (§3.1).

### 3.9 [On device, owner]

- iPhone: in a game, before any answer, an edge swipe leaves; after one answer it does nothing, and Close asks Keep playing?.
- iPhone with VoiceOver: the escape gesture (two-finger Z) in a game before and after one answer. Before: it may leave. After: it must not leave without the sheet; if it does, file a follow-up (§3.1).
- Android: after one answer the back button asks; on the open sheet the back button closes the sheet and the round is the same.
- TalkBack and VoiceOver: when the sheet opens, focus is inside it; it reads title, message, Keep playing, Leave, in that order; nothing behind it can be reached.
- WO-07's acceptance: force-close the app on step 5 of a 6-step lesson and open it again: Home shows Continue and "You can go on from step 5 of 6."; Continue opens step 5. Start again, then Start again in the sheet, opens step 1.
- Force-close the app in the Hangul Check's fourth part and open the check again: the resume page; Continue goes on (OD-LR9); the result counts all five parts.
- At 200 % text on a 320 x 568 phone: the Home hero's caption and Start again, the check resume page and the save-failed page fit with every button reachable.

## 4. Out of scope

- A game's state inside a step (its round index, its hints, a half-drawn letter): a step still starts from its beginning (WO-07 "하지 말 것").
- The star rules and the first-try rules: unchanged.
- **Work before a game's first answer** (§3.1): a drawing not yet passed or Done (Trace Stroke, Trace a Word), cards arranged but not placed (Story Sequence), tiles moved (Sentence Builder, Syllable Build), a frame being written (Write Frame answers after its last slot), typed text not yet submitted (Type Hangul, My Story). With no answer yet a back leaves without asking, as today, and that work is lost. A follow-up if the owner wants a per-game "has progress" signal.
- **A game's timers under the sheet** (§3.1): not paused; a game that finishes under the sheet completes its step.
- **Native focus on the sheet's cancel**: ConfirmSheet moves focus to its cancel only on the web (`ConfirmSheet.tsx:85-91`). A design-system row (with WO-37 NB-4) if the owner wants it on native.
- **The episode page's Start and the mission cards** open a saved run as AU-12 does, under their own words ("Start"). Only the hero says so (§3.2). A follow-up for WO-38 (learner screens).
- **A story quest as the hero** opens without `resume`, so an interrupted story quest starts again and its new run replaces the saved one (`quest-player-ports.ts:182-191`); the story's own bookmark still holds its scene for Keep reading. Accepted (F-STORY-004 owns story resume).
- The Cell Check's Try again, which starts a new attempt (`CellCheckScreen.tsx:183-186`); the Cell Check, the Daily Review and Keep going do not resume (short sessions).
- **A check that opens on a store that cannot be read** shows the same untrue lines as a failed finish ("All refreshed today", `DailyReviewScreen.tsx:216-220`; the Stage Check's not-ready line, `StageCheckScreen.tsx:103-110`). The cause is a read, not a save: a follow-up with the other stores of AMENDMENTS-DURABLE-PROGRESS §4.
- **A memory answer applied twice.** With OD-LR9 (a), the Stage Check's interrupted part is asked again and its items are written into the memory store twice; with (b), only an answer whose write was cut by a kill is. A Try again after a `recordVocab` throw (§3.5, a bug path) also applies that round's day counts in the memory store again (accepted). On the same day the memory store's own rule keeps the second answer from moving a box (an answer is spaced only on a new day, `logic/memory/spacing.ts:132`; a fall happens at most once a day, `:149`); a check resumed the next day counts it as that day's answer. Accepted.
- `destructive: true` on the quest's Leave (`QuestPlayerView.tsx:335`) and the system `Alert` behind `confirm()` on native: WO-37 row NB-4, which owns both.
- The All lessons preview's games (§3.1) and a guest's run (GU-D12).

## 5. UI sketch

- Wireframes (row LR-0): `design/wireframes/minigame/keep-playing-sheet.md`, `design/wireframes/home/next-lesson-resume.md`, `design/wireframes/reviews/check-resume.md`, `design/wireframes/reviews/save-failed.md` (revision 2 each).
- Row LR-0b: the mocks in `design/screens/quest-leave-resume/` (the Home hero's resume variant and its sheet, the check's reading frame and resume page, the save-failed page and its stop sheet; at 390 x 844 and at 320 x 568 with the largest text), approved by multi-agent review (CLAUDE.md §5). The Keep playing sheet is the shipped `ConfirmSheet` (`design/components/ConfirmSheet/spec.md`) with new words, so LR-1 needs no mock and can ship before LR-0b.

## 6. Tests

Unit and render tests under `apps/mobile/src/**/__tests__/` (vitest, testing-library, fake timers); e2e under `apps/mobile/e2e/web/`. `@react-navigation/native` has no build that loads in Node and is mocked in every render test (`screens/minigames/__tests__/MinigameScreen.test.tsx:28`), so route-level tests use the fake navigation of `screens/__tests__/use-back-guard.test.tsx` (a fake `addListener` / `setOptions` and a `fire(type)` that runs the listeners), extended so the event carries `defaultPrevented`; what the stack shows after a back is left to e2e.

**LR-1**

1. `quest-run-store`: `answersGiven` rises on a first try, a retry, a hinted answer and an answer on a revisit; `beginQuest` and `reset` set it to 0; `savedRunOf` does not carry it.
2. `use-back-guard`, the guard scope: a nested guard that holds takes `GO_BACK` and the owner's guard is not asked; a nested guard that does not hold passes it to the owner; the result is the same whatever mounted first; `setOptions({ gestureEnabled })` is written only by the owner, from "own or any nested holds"; outside a scope `useRouteBackGuard` behaves as today (existing tests unchanged).
3. `MinigameScreen` with the fake navigation: no answer → `fire('GO_BACK')` and `fire('POP')` are not held; `fire('REPLACE')` never is.
4. One answer → `fire('GO_BACK')` is held and `minigame-leave` shows; Keep playing → the sheet goes, the same round shows with its answer state; Leave → `exits.back` runs once and the next `GO_BACK` is not held; no `minigame.finished`.
5. One answer → `fire('POP')` is held and the sheet shows; a `fire('GO_BACK')` while it is open closes it (Keep playing) and no second sheet opens.
6. Native: `setOptions({ gestureEnabled: false })` after the first answer, `true` before it; nothing on the web.
7. The game's own finish after answers (`onFinish` → `close`; `complete`) leaves with no sheet and sends `minigame.finished` once; Back to quest on an empty game leaves; a game on its end card (answers given, not closed) → the sheet.
8. Story Check, mounted after `MinigameBody` drew `LessonWaiting` (the order that breaks two listeners): in its recap a back ends the step and no sheet shows; before the recap, with an answer, the sheet shows.
9. A `story-read` step with a checkpoint answered: not held; the All lessons preview (`inPreview`): not held; the sheet opening calls `stop()`.
10. e2e `minigame-leave.spec.ts`: answer one Listen and Pick round, browser back → the sheet; Keep playing → the same round; browser back → Leave → the quest player's launcher for the same step, not advanced; with no answer, browser back → the launcher at once. The guest stack's quest 1: the same.

**LR-2**

11. `readSavedRun`: `missing` → null; a value → the value; a read that throws twice → null; one that throws once then reads → the value; bytes that do not parse → null; a retry that outlasts the limit → null; the progress store's state is the same before and after; no telemetry.
12. The candidate helper (pure): another quest, `stepIndex` 0, older than 24 h either way, not a number → no candidate.
13. Home: a resumable run of the hero's quest at step 3 → Continue (also with `questsDone` 0), "You can go on from step 3 of 5.", Start again. No resume variant for: no candidate (12), a story quest, a changed step list, a read that failed. No chunk load is asked without a candidate. A lesson whose chunk is not in: the variant once it lands; **a chunk load that rejects → the plain hero, no crash, no reload**.
14. The hero's button keeps its place when the read lands (the line and the link render after it); Continue carries the caption as its hint; Start again has the button role.
15. Start again → `home-start-again`; Keep my place → nothing changes; Start again → the saved run is cleared before the player reads it, and the player opens on step 1.
16. e2e `home-resume.spec.ts`: play a quest to step 3, reload, go Home: Continue and the line; Continue → step 3; again, Start again → the sheet → Start again → step 1.

**LR-3a**

17. `saved-check` (pure): the stored value after each first answer (OD-LR9 (b)); resumable rules (age either way, ids changed, answers of items not in the check, a bad answer shape, garbage) → null; the resume point is the item after the last one answered.
18. `review-flow`: `reading` → `resume` or `intro`; a late read switches `intro` to `resume` only before Let's go; Continue → `playing` at the resume point; a leave on the resume page exits; Start again → `intro` with the stored run kept; Let's go from there clears it.
19. `review-run-store.restore`: the restored items keep their first answer; a later answer to them is a retry.
20. `StageReviewScreen`: answers in chunks 1 to 3 stored; unmount, mount → reading → the resume page; Continue → the items after the last answered; the check is the one of the stored seed; the result counts every item; `review.start` once; the romanization choice kept; Stop → as OD-LR1 decides; the result → cleared.
21. `check-run-saved`: the learner's removal removes the key; `profile-keys.test.ts` passes with `check-run` listed.

**LR-3b**

22. `resumeSession`: the stored rounds come back as stored; null on another locale, another items hash, 24 h + 1 ms, a retired item, a round that fails the shape check, answers of rounds not in the plan.
23. `StageCheckScreen`: answers stored after their recordings settle; remount → the resume page → the round after the last answered; `recordRound` is not called for stored answers and `begin` not again; the stars equal those of an uninterrupted run with the same answers; the run is stored with every answer before the finish runs, and a remount after a rejected finish goes from Continue straight to the finish; Start again → the intro → Let's go runs `startSession`.

**LR-4**

24. Daily Review: the finish rejects → `daily-review-save-failed`, never `daily-review-nothing`; the title has focus; Try again → the result with its stars; only the round whose recording rejected is recorded again (the map); Try again is busy while it runs (a double tap is one try); a second failure announces the title; after 3 failures the still-stuck line shows.
25. Stage Check: the same, never `stage-check-nothing` after a rejection; a finish that answers null still shows the calm page.
26. On the failed page a back (`fire('GO_BACK')`) is held and the stop sheet shows with "This is not saved yet. Your stars and cards stay."; the stay button first; Stop leaves.
27. Both apis: a second `finishSession` for the same plan writes no second entry, latch or event.
28. OD-LR8: each of the four result pages shows `learner.results.saveLater` while the learner is in `saveRetryFailedFor` or `loadFailedFor`, and not otherwise.

**LR-5**

29. The leave lines of §3.6, by key and English, as OD-LR1 decides.

Coverage: `apps/mobile` business logic stays at or above 90 % (CLAUDE.md §6).

## 7. Rollout

- Next release. No migration: `hr:check-run:<id>` is a new key (absent is nothing stored), and an older build ignores it. A value a newer build cannot read is dropped by `resumableRun` / `saved-check`.
- LR-1 can ship first (§9). No flag: each row is small and its old behaviour is one revert away.
- Home asks the lesson store for the hero lesson's chunk only when a saved run of that lesson is a candidate (§3.2): the lesson the learner is about to open, precached on the web; on native one bundle holds every chunk. A load that fails changes nothing on Home.
- What to watch: nothing new is measured (§3.8). The on-device checks of §3.9 are the owner's.

## 8. Dependencies

- Merged upstream: AU-12 (#1035), QB-2 to QB-4 (#1037), AMENDMENTS-DURABLE-PROGRESS rows DP-1b and DP-2 (`durableRead`, `saveRetryFailedFor`).
- WO-37 row NB-4 is not needed (OD-LR2). It still owns `destructive: true` on the quest's Leave and native focus on a sheet's cancel (§4).
- Files shared with other work orders (README §6), merged one after another: `store/quest-run-store.ts` and `QuestPlayerView.tsx` (WO-06, WO-07, WO-38's launcher); `HomeScreen.tsx`'s hero (WO-38 row 2 moves it); `MinigameScreen.tsx` (WO-04 changes the game files beside it, not this file; `StoryCheckGame.tsx` is not changed: the guard scope is in `use-back-guard.ts`). `packages/i18n/src/messages/en/learner.ts`: rebase mechanically.
- es and ko values: R8 drafts and the §3.10 review, in each row's PR (§3.7).

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| LR-0 | Opus 5.5 | This spec and the four wireframes of §5; revision 2 after review | — | — | `docs/quest-leave-resume-spec` |
| LR-0b | Opus 5.5 | The mocks of §5 (Home resume variant and sheet, check reading frame and resume page, save-failed page and its stop sheet); multi-agent review | — | this spec `ready` for LR-0b | `design/quest-leave-resume` |
| LR-1 | Sonnet 5.5 | **built** (PR open, not merged) §3.1: `answersGiven`, the guard scope in `use-back-guard.ts`, the guard in `MinigameBody` (learner and guest stacks), the sheet (sound stops on open), the screen's own exits; strings `learner.minigame.leave.*` (en, es, ko) | 1–10 | this spec `ready` for LR-1 (WO-06: ships before the WO-07 rows) | `fix/minigame-back-guard` |
| LR-2 | Sonnet 5.5 | **built** (PR open, not merged) §3.2 the candidate helper, the non-throwing step load, the Home resume variant and its sheet; §3.3 `readSavedRun` on `durableRead`; the comment at `QuestPlayerScreen.tsx:32-34` ("No screen and no word of its own"); strings `learner.home.next.resume.*` (en, es, ko) | 11–16 | LR-0b | `feat/home-resume-lesson` |
| LR-3a | Sonnet 5.5 | **built** (PR open, not merged; the common parts LR-3b reuses are `isFreshCheckRun`, `isReviewAnswer`, `answeredLike`, `nextAfterLastAnswered` and `resumePointOf` in `saved-check.ts`, and `readSavedCheck` / `saveCheck` / `clearSavedCheck` on the one key in `check-run-saved.ts`; `saved-check.ts` imports no check's content so `profile-keys.ts`, which the start bundle loads, does not pull the Hangul Check in; the Hangul Check's stop sheet shows `leave.bodyKept` once an answer is given and keeps "You can take it again any time." before the first one, when nothing is stored yet; es and ko are drafts for MAR with the learner ledger re-signed, as LR-2 and LR-4 did) §3.4 common parts and the Hangul Check: `logic/reviews/saved-check.ts`, `store/check-run-saved.ts`, `PER_PROFILE_KEYS`, the `reading` and `resume` phases, `review-run-store.restore`, the resume page; strings `learner.stageReview.resume.*` and, with OD-LR1 (b) or (c), `learner.stageReview.leave.bodyKept` (en, es, ko) | 17–21 | LR-0b; **OD-LR1, OD-LR9** | `feat/hangul-check-resume` |
| LR-3b | Sonnet 5.5 | §3.4 the Stage Check: the stored rounds, `resumeSession`, the store before the finish, the resume page on the Stage Check (OD-LR7) | 22–23 | LR-3a; **OD-LR1, OD-LR9** | `feat/stage-check-resume` |
| LR-4 | Sonnet 5.5 | **built** (PR open, not merged; the Stage Check's store-before-finish, `next = rounds.length`, is LR-3b's: the stored run does not exist before LR-3a) §3.5: the `failed` phase and Try again on the same answers (Daily Review, Stage Check), recordings by round, a finish once per plan, the failed page's back guard and stop sheet, its accessibility, the save-later line on the four result pages (OD-LR8); strings `learner.dailyReview.saveFailed.*` (en, es, ko) | 24–28 | LR-0b; merged one after another with LR-3b (both touch `StageCheckScreen.tsx`) | `fix/review-save-failed` |
| LR-5 | Sonnet 5.5 | §3.6: the leave lines as OD-LR1 decides, the `QuestPlayerView.tsx:132` comment; "Amended YYYY-MM-DD by AMENDMENTS-QUEST-LEAVE-RESUME" lines in AU-12, QB, F-QUEST-002, F-CURR-002, AMENDMENTS-DISPLAY-NAV; [LR] notes in the five wireframes this spec amends and lines in `design/wireframes/README.md`; the `docs/specs/README.md` index line; status `shipped` | 29 | LR-1 – LR-4; **OD-LR1** | `docs/quest-leave-resume-finish` |
| LR-6 | Sonnet 5.5 | A later row, not in LR-3a's or LR-3b's scope (owner decision 2026-11-24, O5): the Hangul Check's `LeaveSheet` and the Stage Check's `ConfirmSheet` look the same, with the safe choice (**Keep going**) the filled button and **Stop** the plain one; the Stage Check's sheet takes LR-2's `ConfirmSheet` opt-in, and the Hangul Check's `LeaveSheet` is restyled to match or replaced by the `ConfirmSheet`. No string changes; the mock of this amendment keeps drawing both sheets as shipped. Its own PR carries the tests | with the row | LR-2, LR-3a, LR-3b | `fix/check-stop-sheet` |

One commit = test + implementation. A row that meets a decision this spec does not make stops and reports (README §3).

## 10. Owner decisions

Owner decision 2026-11-23: OD-LR1 to OD-LR8 approved as recommended in revision 1. The review of 2026-11-23 re-opened OD-LR1 and added OD-LR9. Owner decision 2026-11-24: OD-LR1 (c) and OD-LR9 (b), both as recommended; the rows they gated (marked in §9) are `ready`. The same day the owner answered the LR-0b design-pass questions O2 to O5 "all as recommended" (below, after OD-LR9).

- **OD-LR1 — What Leave and Stop do to a saved place. Owner decision 2026-11-24: (c), as recommended.** (Re-opened by the review of 2026-11-23.) The owner approved (a) on 2026-11-23; the charter review then showed (a) breaks §2's own story for the checks (a polite Stop loses the parts done, while an app kill keeps them) and proposed (c).
  - (a) As today: the quest's Leave clears the saved run (AU-12); the Hangul Check's and the Stage Check's Stop clear the stored check. No line changes.
  - (b) Leave and Stop keep the place: Home shows Continue after a chosen Leave; the episode page's "Start" and the mission cards then resume after it too, and a lesson other than the hero's has no way back to its first step for 24 hours (§4); the quest's line becomes "You can keep going later."; AU-12 and F-QUEST-002 NB-1 are amended.
  - (c) The quest's Leave as (a); the checks' Stop keeps the stored check, with "You can keep going later." (`learner.stageReview.leave.bodyKept`); the Cell Check keeps its line. Keeping costs one tap later (the resume page offers Start again, which itself clears nothing until Let's go); forgetting costs up to four parts.
  - **Recommendation: (c).** It keeps the quest where (a) is right (Leave is chosen in a sheet that says the stars of this try will not be saved, and the quest's other entries do not say they resume) and makes a check's Stop as kind as an interruption. Gates LR-3a, LR-3b, LR-5.
- **OD-LR2 — Which sheet asks in a game. Owner decision 2026-11-23: (a)** the design system's `ConfirmSheet`, drawn by the game screen on every platform (the alternatives were `platform/dialog.ts` without `destructive`, and waiting for WO-37 NB-4). Until NB-4, the quest's own Leave is still the system Alert on native.
- **OD-LR3 — The iOS edge swipe in a game. Owner decision 2026-11-23: (a)** off only while the guard would ask (`holds`); before the first answer the swipe leaves, as every other way does (the alternative was always off on the route).
- **OD-LR4 — Where the game guard applies. Owner decision 2026-11-23:** the learner and guest stacks; not the All lessons preview; not a `story-read` step.
- **OD-LR5 — What Home shows. Owner decision 2026-11-23: (a)** Continue opens the lesson at once; under it a caption and a quiet Start again that asks first; only for a saved run of the hero's own lesson (not a story quest, not a run at its first step); another lesson's saved run is not on Home. (Revision 2 changes only the caption's words, "You can go on from step 3 of 5.", and how the steps are loaded, §3.2.)
- **OD-LR6 — What Start again on Home does. Owner decision 2026-11-23: (a)** clear the saved run and open the lesson at its first step at once. (The review called this OD unnecessary because (b) is plainly worse; it stays recorded as decided.)
- **OD-LR7 — The Stage Check's resume. Owner decision 2026-11-23: (a)** yes, as its own row LR-3b after LR-3a. Revision 1 named the mechanism (store the engine's questions and rebuild the rounds); the code review showed a rebuild is not the same check (§3.4), so revision 2 stores the planned rounds instead. The decision (resume the Stage Check, in LR-3b) is unchanged; the owner may re-confirm it with the mechanism in view. LR-3b also depended on OD-LR1 and OD-LR9, decided on 2026-11-24 ((c) and (b)).
- **OD-LR8 — The save-later line on the check result pages. Owner decision 2026-11-23: (a)** the four result pages show `learner.results.saveLater` as Results does.
- **OD-LR9 — When a check's answers are stored. Owner decision 2026-11-24: (b), as recommended.** (Added by the review of 2026-11-23.)
  - (a) At each pause (WO-07's text). The part in play when the check stopped is asked again from its first item: its first answers are dropped and scored again (a learner who closes the app after a miss gets a second first try), and for the Stage Check the memory store already holds the real first answers, so the check's stars can differ from what it recorded, and a 3-star result latches the stage check that parents and teachers see.
  - (b) After every first answer (the answers only, after the Stage Check's recording has settled); the check goes on at the item after the last one answered. No first answer is asked again; one write per answer (35 small writes in a Hangul Check; about 20 in a Stage Check, each with its stored rounds).
  - (c) After every first answer, but the check goes on at the start of the interrupted part, replaying its answered items without scoring or recording them (QB-3's score-neutral replay).
  - **Recommendation: (b).** It is the only option where "first try" means the first try, and the learner lands exactly where they stopped. Saving answers is not saving a game's state (WO-07 "하지 말 것" is about a minigame's round state); (c) costs more code for a replay nobody asked for. Gates LR-3a, LR-3b.
- **The LR-0b design-pass questions (O2 to O5, `design/screens/quest-leave-resume/README.md` "Owner questions"). Owner decision 2026-11-24: all as recommended.** O1 is OD-LR1 and OD-LR9 above.
  - **O2 — Home caption tone.** `text.secondary` (`Caption tone="secondary"`), not muted like the minutes line (§3.2; mock D1).
  - **O3 — Copy over a failed save** (English only here; the rows that implement them carry the es and ko values, §3.7).
    - The stop sheet over the save-failed page reads "This is not saved yet. Your stars and cards stay." (`learner.dailyReview.saveFailed.leaveBody`).
    - `learner.dailyReview.saveFailed.stillStuck` reads "It still did not save. You can stop for now and try another time."
  - **O4 — Home's Start again sheet.** The safe choice, **Keep my place**, is the filled button and comes first; **Start again** is the plain outlined one (§3.2, row LR-2). The mock drew it the other way (the `ConfirmSheet` as shipped); it is redrawn.
  - **O5 — the two check stop sheets.** A later row, LR-6 (§9), makes the Hangul Check's `LeaveSheet` and the Stage Check's `ConfirmSheet` look the same, with the safe choice filled. Not in LR-3a's or LR-3b's scope.

## 11. Review log

- 2026-11-23, revision 1 (LR-0): written on `e72336a7d`. Every citation of WO-06 and WO-07 re-read (§1.1): most lines moved; one claim is false (the Stage Check shows its not-ready line, not "All refreshed today", after a failed finish); the Cell Check model's Try again starts a new attempt; WO-37's NB-4 has no spec, and the screens already draw `ConfirmSheet` on native; the Home hero already says Continue and already resumes.
- 2026-11-23, owner: OD-LR1 to OD-LR8 approved as recommended (§10).
- 2026-11-23, multi-agent review of revision 1 (two lenses: code truth, verdict hold at draft; charter and learner, verdict no blocker, four majors). The code lens confirmed every priority citation, found no double ask on the exit paths, and passed `durableRead`'s use, file placement, the Hangul Check's determinism, once per plan and the strings. Adjudicated in revision 2:
  - **Fixed, blocker:** Home cannot use `useLessonQuestState` (it throws a failed load, may reload the page, and cannot run without a hero): Home reads the saved run first, loads steps only for a candidate, through the lesson store with the rejection swallowed; a test for a rejected load (§3.2, §7, test 13).
  - **Fixed, majors (code):** the Stage Check stores the planned rounds, not questions rebuilt with `roundFor` (states, voice and switches change after the first parts are recorded); `reviewItemsChunk.hash`, not the unexported `REVIEW_ITEMS_HASH` (§3.4, test 22). Route tests use the fake navigation of `use-back-guard.test.tsx`; stack results are left to e2e (§6). The Hangul Check gains a bounded `reading` phase, a late read that lands only before Let's go, and a rebuild of `check` from the stored seed; the Stage Check runs `startSession` after Start again (§3.4). The `answersGiven` proxy's edges are stated: work before a first answer and an end card (§3.1, §4, test 7).
  - **Fixed, majors (charter):** OD-LR1 re-opened with option (c), recommended (§10). The interrupted part's first answers were not first tries: new OD-LR9, recommending a save after every first answer, and §3.4's "First tries" corrected for each option. Start again on the check resume page clears nothing until Let's go (decided in the text: no new string, and it only removes a way to lose work). The failed page keeps its back guard with the stop sheet and a true body, "This is not saved yet." (decided in the text: it only adds a question before work is dropped); the Stage Check stores its run with every answer before the finish (§3.4, §3.5).
  - **Fixed, minors:** nested guards share one listener and one gesture writer through a guard scope, so the order they mount in does not matter (§3.1, test 8); recordings kept by round index, and the Try again claim narrowed to what the memory runtime does (§3.5); the Stage Check stores an answer after its recording settles (§3.4); the 800 ms limit and a slow retry (§3.3); the Home caption says "You can go on from step 3 of 5." and is Continue's hint, Start again is a button of at least `touchTarget.min` (§3.2); native sheet focus restated and VoiceOver's escape gesture added to the backs and to §3.9; the save-failed page's focus, busy, announcement and still-stuck line (§3.5); a back on the open sheet is Keep playing, and the sheet stops the sound (§3.1); es and ko in every row that adds a key, and a changed English value re-translated (§3.7, §9); §4 names all work before a first answer, and the story quest as the hero.
  - **Kept:** OD-LR6 stays a recorded owner decision (it is decided; folding it into the text changes nothing). The hero's minutes line stays in the resume variant (it is the lesson's length; the caption says where it goes on). A game's own timers are not paused under the sheet (pausing them changes every game file, which WO-04 shares; a game that finishes under the sheet completes its step, which loses nothing).
  - **Moved:** dropping `destructive: true` on the quest's Leave → WO-37 row NB-4, which owns it and the native confirm; native focus on a sheet's cancel → a design-system row with NB-4.
