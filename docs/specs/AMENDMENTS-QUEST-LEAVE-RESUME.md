# AMENDMENTS-QUEST-LEAVE-RESUME — a game is never left by accident; a quest or a long check goes on where it stopped; a finish that was not saved never looks done

Status: draft (revision 1, 2026-11-23, written on main `e72336a7d`). Written for work orders WO-06 and WO-07 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row LR-0 (both work orders were written on `d5ba0217c`; §1 re-reads every citation on `e72336a7d`). Waits for the owner decisions of §10 and a multi-agent review before `ready`.

**Amends**: AMENDMENTS-AUDIT-2026-11 AU-12 ("No new screen and no new string": Home now says that a lesson goes on) · AMENDMENTS-QUEST-SOUND-BACK QB-2 ("a game in play has no Previous (its own Close goes back to the launcher as today)": the Close stays, and asks first once the game has an answer) · F-QUEST-002 §3.9 (the Hangul Check, "Leaving ... nothing is saved": an interrupted check now goes on) · F-CURR-002 §4.5 and §7.3 (rows CM-14 and CM-22: the Daily Review and the Stage Check after a finish that could not be saved; the Stage Check also goes on after an interruption) · AMENDMENTS-DISPLAY-NAV §7.1 (one more route that asks before a back) and §9.1 (the Home hero) · wireframes `minigame/shell.md`, `home/next-lesson-hero.md`, `reviews/hangul-check.md`, `reviews/stage-check.md`, `reviews/daily-review.md` · tag **[LR]**
**Not amended**: the star rules (F-001 §3.2 first-try scoring, F-RVW-001 §3.1, AU-9's skip cap, QB-3's score-neutral replay). Nothing here changes how a star is counted. Nothing saves a game's state inside a step (WO-07 "하지 말 것").
**Scope**: `apps/mobile` — `screens/minigames/MinigameScreen.tsx`, `screens/use-back-guard.ts` (one line), `store/quest-run-store.ts` (one counter), `store/quest-run-saved.ts` (the read), `screens/home/HomeScreen.tsx`, `screens/reviews/StageReviewScreen.tsx`, `logic/stage1/review-flow.ts`, `store/review-run-store.ts`, `store/check-run-saved.ts` (new), `logic/reviews/saved-check.ts` (new), `store/profile-keys.ts`, `screens/stage-check/StageCheckScreen.tsx`, `logic/reviews/stage-check-api.ts`, `screens/reviews/DailyReviewScreen.tsx`, `logic/reviews/daily-review-api.ts`, the Daily Review chunk (`screens/reviews/daily-review-chunk.tsx`), the tests of §6; `packages/i18n` (en here; es and ko in the same PRs, §3.7)
**Owner**: solo dev
**Rollout**: next release; no migration; rows LR-1 (WO-06) can ship before the WO-07 rows (§9)

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
| WO-07: `screens/reviews/StageReviewScreen.tsx:160-161` | `:160-161` (the run is forgotten on unmount). The check's items come from a random seed made per visit (`:108`) | true |
| WO-07: `screens/reviews/DailyReviewScreen.tsx:299-301, 456-465` go to "All refreshed today" when the save fails | `:299-301` (a rejected `finishSession` sets `nothing`), the page `:456-466` ("All refreshed today", "Nothing is waiting right now.") | true |
| WO-07: `screens/stage-check/StageCheckScreen.tsx:167` goes to "All refreshed today" | `:167` sets `nothing`, but the Stage Check's `nothing` page (`:335-350`) shows its title and `learner.stageCheck.notReady`, "This check is not open yet. Keep playing your quests." (`learner.ts:3020`), not "All refreshed today" | **line true, claim false**: the page shown is a different untrue line; §3.5 is built on what the code shows |
| WO-07: the right model is `screens/cell-check/CellCheckScreen.tsx:168, 180-188` (`failed` phase + Try again) | `:51` the phase, `:168` a rejected finish sets it, `:180-188` OopsScreen with Try again. But Try again there starts a **new attempt** (`:183-186`: a new plan, then the intro); the answers are not kept | true, but WO-07's test ("답 유지, Try again 성공 → 완료 화면") needs more than the model does (§3.5) |
| WO-07 item 5: the saved-run read uses WO-01's read contract | WO-01 is merged: `store/durable-read.ts:49` `durableRead(key, copyKey)` → `missing` / `value` / `failed`. The saved run is read today with `readJsonStrict(...).catch(() => null)` (`store/quest-run-saved.ts:50`): a failed read already means no resume and touches nothing else, but has no retry on a fresh connection | §3.3 moves it onto `durableRead` |
| WO-07: what already resumes, stories (bookmark) and the level check (saved run) | the story bookmark (`store/story-store.ts`, `getResumableBookmark`); the level check (`store/placement-run-store.ts`, `logic/placement/flow.ts:544, 582-591`: a 24 h window, a bank version, Continue or Start again) | true; §3.4 follows the level check's shape |

Two facts the work orders do not state, which change the design:

- **The Home hero already says Continue and already resumes.** The hero's label is "Continue" for every learner with one quest done (`logic/placement/home-card.ts:88`, `learner.home.next.continue.cta`, `learner.ts:340`), and its tap opens the quest player (`HomeScreen.tsx:742-746`), which resumes a saved run of that quest (AU-12, `quest-player-ports.ts:176-192`). What is missing: a learner on their first day reads "Start" over a resumed run; nobody can see that a lesson will go on in the middle; and the only way to start a lesson from its first step is Leave inside it.
- **A story quest resumes a saved run only through Keep reading** (`quest-player-ports.ts:184-186`), so the hero, which opens the player without `resume`, never resumes one.

### 1.2 What AU-12 and QB-2 to QB-4 already ship (no row here re-does it)

- The quest run is kept per learner at `hr:quest-run:<profileId>` (`QUEST_RUN_KEY`, `store/quest-run-saved.ts:17`): the quest, its episode, the step list's signature, the furthest step reached (QB-4), the tallies, the scored-round keys, the skipped steps, the step events already sent (QB-3) and the start time (`logic/quest-flow/saved-run.ts:31-48`).
- It is written when the run begins and at each step change (`keepRunSaved`, `quest-run-saved.ts:81-94`), one write after another (`:29-38`); a failed write is dropped (`:58`).
- Opening the same quest within 24 hours of the run's start resumes at that step, the step itself from its beginning (`SAVED_RUN_MAX_AGE_MS`, `saved-run.ts:22`; `resumableRun`, `:113-140`): another quest, a changed step list, a clock more than a day off either way or numbers that are not a run's discard it. A round scored before the reload is not scored again (its key is kept).
- It is cleared on finish and on Leave (`quest-player-ports.ts:217-223`), and with the learner (`quest-run-saved.ts:96-100`; `PER_PROFILE_KEYS`, `store/profile-keys.ts:49`). A guest run does not use it (GU-D12).
- Previous between steps; a step shown again scores nothing new; a game in play has no Previous and its Close goes back to the launcher (QB-2, QB-3).

So WO-07's "사양이 정해야 할 것" 1, 2, 3 and 5 are decided for the quest. What is left:

1. **LR-1** (WO-06): a back on a game that has an answer asks first.
2. **LR-2** (WO-07 a): Home says that the hero's lesson will go on, and keeps a way to start it again from the first step; the saved-run read moves onto `durableRead`.
3. **LR-3** (WO-07 b): the Hangul Check and the Stage Check go on after an interruption, part by part.
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

**Answered here.** `quest-run-store` gains `answersGiven: number`, raised by 1 on every `answerRound` call: a first try, a retry, a hinted answer and an answer on a revisit alike (it is raised before QB-3's return for a revisit, `store/quest-run-store.ts:168`). `beginQuest` and `reset` set it to 0 (`blankRun`). It is never saved (`savedRunOf` is unchanged), never scored and never sent. `MinigameBody` reads it when it mounts (one body per step, `MinigameScreen.tsx:87`); the game has an answer here when the value is now larger. Every game answers through `answerRound`: the host games through `hostFor` (`:185-205`), the others through the store directly.

**The rule.**

- **Given** a game with no answer here, **when** the learner goes back (the header's Close, `components/LearnerScreenHeader.tsx:76`; the Android back; the browser or phone back through the history bridge; an iOS edge swipe), **then** the game is left at once, as today.
- **Given** a game with an answer here, **when** the learner goes back by the header's Close, the Android back or the browser or phone back, **then** the game stays and the Keep playing sheet opens. All three reach the route's `beforeRemove` (`use-back-guard.ts:12-18`) and run the one guard.
- **iOS edge swipe with an answer here:** the native swipe cannot be held by `beforeRemove` (`use-back-guard.ts:20-24`), so it is turned off while the guard would ask (`holds` = answered here, `:36-39`): the swipe does nothing, and the Close asks (OD-LR3). Before the first answer the swipe leaves, as every other way does.
- One question at a time: a back while the sheet is open does nothing more. An Android back on the open sheet is Keep playing (the sheet's `onRequestClose` is its cancel on native, `packages/design-system/src/components/ConfirmSheet/ConfirmSheet.tsx:149`).

**The sheet** (OD-LR2): the design system's `ConfirmSheet`, drawn by `MinigameBody` over the game on every platform, as the Daily Review draws its stop sheet. Title `learner.minigame.leave.title`, message `learner.minigame.leave.message`; the cancel is **Keep playing** (`learner.quest.leave.keep.cta`), drawn first and focused (the ConfirmSheet rule); the confirm is **Leave** (`learner.quest.leave.confirm.cta`), `confirmTone` `'primary'` (no danger tone: that is for a grown-up's destructive step only). `testID` `minigame-leave`.

- **Keep playing**: the sheet closes. The game was never unmounted: its round, its answers, its hint and its sound are as they were.
- **Leave**: `exits.back()`, let through the guard: the quest player shows the step's launcher, as today's Close does. Rounds answered stay scored on the first try (AU-12, QB-3); the game opens at its first round next time. No `minigame.finished` (as today's Close: the event goes with the game's own finish).

**The screen's own exits pass.** A `leaving` ref is set before every exit the screen takes itself: `close`, `closeAs`, `complete`, the not-found page's Back to quest and every game's `onBack` (each is drawn only when the game has no round to play). So a game that ends never asks (the same pattern as `allowLeave`, `StageReviewScreen.tsx:113-121`).

**A game's own guard first.** Story Check's recap guard (`StoryCheckGame.tsx:211-215`) takes a back in its recap. Its listener is added first (a child's effect runs before its parent's), and `useBackGuard` skips `onBack` for an event another listener already prevented (`defaultPrevented`; one line in `use-back-guard.ts`, the listener's event type gains `defaultPrevented?: boolean`). So a back in the recap ends the step, with no sheet; a back before the recap, with an answer, asks.

### 3.2 Home: a lesson left in the middle (row LR-2)

**When Home shows it.** Home reads the saved run when it comes into focus (`useFocusEffect`, as the level-check peek, `HomeScreen.tsx:773-786`) through `readSavedRun` (§3.3). The hero shows the **resume variant** only when all of these hold:

1. the saved run is of the hero's quest (`nextLesson.questId`) and `resumableRun(saved, quest, now)` (`saved-run.ts:113`) is not null;
2. its step is past the first (`stepIndex` 1 or more): a run saved as it began has nothing to go on from;
3. the quest has no `story-read` step (a story quest resumes only through Keep reading, §1.1);
4. the quest's steps are in. A lesson quest's steps come with its cell's chunk, so Home calls the hook the player uses, `useLessonQuestState(nextLesson.questId)` (`screens/lesson-content.tsx:193-210`; it loads the cell), and decides once it is `'ready'`. Until then, or when it fails, the hero is drawn as today.

A saved run of another quest changes nothing on Home: it resumes when that quest is opened again, as AU-12 says (OD-LR5).

**The resume variant** (wireframe `home/next-lesson-resume.md`):

- The button reads **Continue** (`learner.home.next.continue.cta`) whatever `questsDone` is. Its tap is today's (`startNextLesson`, `HomeScreen.tsx:742-746`): the player resumes the saved step.
- Under the button, so the button never moves when the read lands: one caption, `learner.home.next.resume.line(step, total)`, "You stopped at step 3 of 5." (`step` = the saved `stepIndex` + 1, `total` = the quest's step count; the player's own pill counts the same way), then a quiet link **Start again** (`learner.home.next.resume.startAgain.cta`). The Learning Route link stays last.
- **Start again** opens a `ConfirmSheet`: title `learner.home.next.resume.sheet.title` "Start this lesson again?", message `.sheet.message` "You go back to the first step. Your stars and cards stay.", cancel **Keep my place** (`.sheet.keep.cta`, first, focused), confirm **Start again** (`.startAgain.cta`, `confirmTone` `'primary'`). `testID` `home-start-again`.
  - Keep my place, the backdrop or a back: the sheet closes; nothing changes.
  - Start again: `clearSavedRun(profileId)` (`quest-run-saved.ts:67-69`), then, once it has run, `startNextLesson()` (OD-LR6). The player's read waits for the same queue (`:50`), so it reads nothing and the quest opens at its first step.
- The message is true: the run's tallies are not stars; stars already earned never drop (`recordBestQuest`, AU-9) and cards stay.
- No new telemetry: `next.started` goes out as for any hero tap.

### 3.3 The saved-run read (row LR-2)

- `readSavedRun` (`quest-run-saved.ts:44-56`) reads through `durableRead(QUEST_RUN_KEY(profileId), null)` (`store/durable-read.ts:49`): `value` → the value; `missing` → `null`; `failed` (either cause) → `null`. It keeps its wait for the queued writes and its 800 ms limit (`SAVED_RUN_READ_MS`, `:20`).
- A failed read means no resume and nothing else: no progress record is read or written, `loadFailedFor` is not touched, no screen changes. The copy key is `null`: the run holds nothing earned (stars are written only by the finish), so damaged bytes are not kept and the next run's save writes over them.
- No telemetry: `durableRead` reports only the three profile records (`store/storage-telemetry.ts:14-18, 39-41`).
- What it adds to today: one retry on a fresh connection after a read that threw (`durable-read.ts:43`).
- The same rule, with its own key, for the check run (§3.4).

### 3.4 The Hangul Check and the Stage Check go on after an interruption (rows LR-3a, LR-3b)

**What is common.**

- One stored check per learner: `hr:check-run:<profileId>` (`CHECK_RUN_KEY` in `store/check-run-saved.ts`, new), registered in `PER_PROFILE_KEYS` (`store/profile-keys.ts:26-50`) and removed with the learner (`onProfileRemoved`, as `quest-run-saved.ts:96-100`). A check's save replaces the other check's. Never synced, never sent. Guests take neither check.
- The pure rules (what is stored, whether it may be resumed) are `logic/reviews/saved-check.ts` (new); the module in `store/` reads (§3.3), writes one after another and clears, as `quest-run-saved.ts` does. A failed write is dropped: the check plays on.
- **Saved at each pause**, never inside a part (WO-07: "청크 사이 저장"): the Hangul Check after its chunks 1 to 4 (`stepReviewFlow` `'chunk-done'` → `pause`, `logic/stage1/review-flow.ts:60-63`); the Stage Check at the end of each part of 5 (`StageCheckScreen.tsx:154`). The part in play when the check was stopped is asked again from its first item; the answers given in it are dropped.
- **Lifetime**: 24 hours from the run's start, either way on the clock (`SAVED_RUN_MAX_AGE_MS` and the rule of `saved-run.ts:119-120`); the same learner (the key).
- **Cleared** when the result is recorded, when the learner chooses Stop in the stop sheet (OD-LR1), on Start again, and with the learner. **Kept** after a back on the resume page, a reload, an app kill, a reset away, and a finish that could not be saved (§3.5).
- **The resume page** (wireframe `reviews/check-resume.md`). When the check opens and a resumable run of this check is stored, the intro is replaced by: Hoya waving, the check's title, `learner.stageReview.resume.title` "Pick up where you left off?", the hero button **Continue** (`common.buttons.continue`) and a secondary **Start again** (`learner.stageReview.resume.startAgain.cta`). The reading-practice switch is not shown: the run's choice is kept. Continue opens the first item of the next part, with the run's answers restored. Start again clears the stored run and shows the normal intro. The header's Close leaves at once and keeps the stored run (the page is an intro: `guardsBack` is false, `review-flow.ts:78-80`). Stop sheets, pauses and results are unchanged.
- **First tries.** A check's first try is its own rule, not the quest's `logic/first-try.ts` / `logic/round-keys.ts` (those key the quest run, `quest-run-store.ts:165-196`): the Hangul Check scores the first answer per item (`review-run-store.ts:28-33`), the Stage Check the first answer per round index (`StageCheckScreen.tsx:139-147`). A resumed check restores the first answers of the parts already done and never asks those items again, so nothing is scored twice and no first try is replaced. The stars at the end come from all the answers by today's rules (`tallyReview`, `stageCheckResult`, `reviewStars`: unchanged).
- **Telemetry**: no new name. The start event is sent once per run (`reviewStartEvent` / the Stage Check's `begin`, `stage-check-api.ts:200-202`, not again on Continue); the complete event once, at the finish.
- A read that fails: no resume, the normal intro (§3.3).

**The Hangul Check (row LR-3a).**

- Stored: `{ v: 1, kind: 'hangul', seed, items, done, answers, hideRomanization, startedAt }`: the seed the run was built from (`StageReviewScreen.tsx:108`; the check is deterministic by seed, `logic/stage1/hangul-check.ts:7-9, 107-121`), `items` the item ids of `buildHangulCheck({ seed }).items` in order, `done` the chunks finished (1 to 4), `answers` the `ReviewAnswer` of each item of those chunks (and only those), the attempt's romanization choice and the start time.
- Resumed only when the rebuilt check's ids equal `items` (a content update that adds, removes or moves a letter or word discards it), `done` is 1 to `chunks - 1`, and `answers` holds only items of chunks `0 … done - 1` (an item whose round could not play has none, as today: `unansweredItemIds`, `review-flow.ts:98-102`), each `{ first: boolean, retries: integer ≥ 0 }`. Anything else is dropped, not repaired.
- `review-run-store` gains `restore(itemIds, answers)`; the flow gains a resume start (a `resume` phase whose Continue goes to `playing` at chunk `done`). The store stays in memory (its reset on unmount, `StageReviewScreen.tsx:160-161`, stays). The check opens only for a learner who finished Stage 1 (`hangulCheckOpens`, `:73-78`); the stored run is looked at after that.
- Comments that become untrue are rewritten in the row: `StageReviewScreen.tsx:59` ("stopping saves nothing" stays true only with OD-LR1 (a)), `:160`, and `review-run-store.ts:6-9`.

**The Stage Check (row LR-3b; OD-LR7).**

- Why it is different: the plan is drawn from the learner's memory store (`planStageCheck`, `logic/reviews/stage-check.ts:85-105`; `startSession`, `stage-check-api.ts:180-198`), and each first answer is written into that store at once (`recordRound`, `StageCheckScreen.tsx:146`; `stage-check-api.ts:204-208`). A plan made again after an interruption would be another check. So the stored run keeps the engine's questions.
- Stored: `{ v: 1, kind: 'stage', stage, locale, itemsHash, seed, questions, next, answers, hideRomanization, startedAt }`: `itemsHash` is `REVIEW_ITEMS_HASH` (`content/review-items.ts:1, 10`) when the plan was made; `seed` the plan's seed string (`${ctx.seed}|${stage}`, `stage-check-api.ts:183`); `questions` the `ReviewQuestion` of each round (`logic/reviews/engine.ts:117-131`: plain data); `next` the first round of the next part (a multiple of 5); `answers` the `RoundAnswer` of the rounds before `next` that have one, as `[index, answer]` pairs (only indices below `next`).
- Resumed by a new `stageCheckApi().resumeSession(world, saved, locale)` (memory chunk): it rebuilds every round with `roundFor(question, { index, gloss, seed, states })` (`logic/reviews/review-rounds.ts:647`), loading the lesson chunks of the items for es and ko as `startSession` does. It answers null, and the check opens on its normal intro, when the stage, the locale or `itemsHash` differ, the run is older than 24 hours, an item is missing or retired, a round cannot be rebuilt (`roundFor` answers null) or a meaning's chunk cannot load, or `next` and `answers` do not match. The open rule (`StageCheckScreen.tsx:81`) is checked first, as today.
- A resumed check records only new answers (the done parts' answers are in the memory store already) and `begin` is not called again. The interrupted part's answers were recorded too and are asked again: see §4.

### 3.5 A finish that could not be saved (row LR-4)

**Today** (§1.1): a rejected `finishSession` shows the Daily Review's "All refreshed today" (`DailyReviewScreen.tsx:299-301`) or the Stage Check's "This check is not open yet" (`StageCheckScreen.tsx:167`). It rejects when a round's answer could not be recorded (it waits for every recording first, `daily-review-api.ts:210`, `stage-check-api.ts:212`) or the entry could not be made (`daily-review-api.ts:213`; `stage-check-api.ts:216-219`).

**New** (wireframe `reviews/save-failed.md`):

- Both screens gain a phase `{ kind: 'failed' }`. The plan, the answers and each round's recording are kept (they already live in refs).
- The page: Hoya `thinking`; title `learner.dailyReview.saveFailed.title` "We could not save this yet."; body `learner.dailyReview.saveFailed.body` "Your answers are still here."; one hero button **Try again** (`common.buttons.tryAgain`), busy while a try runs and not pressable twice. No danger colour, no X icon of its own, never "failed" or "error" in the copy. The Stage Check reuses the Daily Review's keys (as it reuses its result headlines). The route's header Close stays (`screen-header-variants.ts:69, 72`) and leaves at once: the back guards hold only while a round or a pause shows.
- **Try again** records again only the rounds whose recording rejected (a rejected `recordAnswers` changed nothing: the memory rows change only after the store and the items have loaded, `logic/memory/memory-runtime.ts:314-347`), then calls `finishSession` again with the same plan and answers. Resolved: the result page, as if the first try had worked. Rejected: the failed page again.
- **A finish is once per plan.** `finishSession` never writes a second `daily` or `stage-check` entry, a second latch or a second complete event for a plan whose entry it already wrote; a second call for that plan answers the result it computed (for example a `WeakMap` from plan to result in each api).
- The Daily Review's yut hold (`:287`) is not waited for again on Try again.
- A Stage Check finish that answers `null` (the check switched off or the stage closed meanwhile, `StageCheckScreen.tsx:166`) keeps its calm page: that line is true.
- **The stored Stage Check run** (§3.4) is cleared only when the finish resolves.
- Not the Cell Check (it has a failed phase, `CellCheckScreen.tsx:180-188`; its Try again starts a new attempt, §4) and not the Hangul Check, whose finish is one synchronous `recordReview` (`StageReviewScreen.tsx:130-140`) and cannot reject this way.
- **The save-later line on the check result pages (OD-LR8).** A finish can resolve while the progress write behind it fails (AMENDMENTS-DURABLE-PROGRESS §3.7). Results already shows `learner.results.saveLater` then (`screens/results/ResultsScreen.tsx:121, 512-516`). The result pages of the Daily Review, the Stage Check, the Hangul Check and the Cell Check show the same line under the stars, with the same selector (`saveRetryFailedFor` or `loadFailedFor` holds the learner) and the same quiet look.

### 3.6 Leave lines that are true (row LR-5)

With OD-LR1 (a) (recommended), no line changes. The table is the check the row makes on every screen that has a leave or stop sheet:

| Screen | Sheet | Line | True because |
|---|---|---|---|
| Quest (`QuestPlayerView.tsx:327-339`) | Leave this quest? | Stars from this try will not be saved. | Leave resets the run and clears the saved run (`quest-player-ports.ts:97-100, 221-223`); stars already earned are untouched. It stays true for a story quest, whose bookmark is not a star |
| Game (`MinigameScreen.tsx`, new, §3.1) | Keep playing? | If you leave, the game starts again next time. | the step's body opens at its first round (`:87`) |
| Hangul Check, Stage Check, Cell Check (`learner.stageReview.leave`) | Stop the check? | You can take it again any time. | Stop clears the stored check (§3.4); the Cell Check has none |
| Daily Review (`learner.dailyReview.leave`) | Stop for now? | What you answered still counts. | each first answer is recorded at once (`DailyReviewScreen.tsx:264`); a stop writes no entry (`:249-250`) |

With OD-LR1 (b), the row changes: `learner.quest.leave.message` → "You can keep going later."; the Hangul Check and the Stage Check get their own stop body, `learner.stageReview.leave.bodyKept` "You can keep going later." (the Cell Check keeps "You can take it again any time."); and Leave and Stop keep the stored run instead of clearing it (AU-12 and F-QUEST-002's NB-1 line "Leave still discards the unfinished run" are amended with it).

Also in LR-5: `QuestPlayerView.tsx:132` says "(memory only)" of the store and names the device copy the learner screen keeps (AU-12); the finishing work of §9.

### 3.7 Strings (`packages/i18n/src/messages/en/learner.ts`)

English at CEFR Pre-A1, for every age (CLAUDE.md §1). Spanish and Korean are shipped locales (`packages/i18n/src/locales.ts:31-35`), so a key missing in es or ko fails `es-coverage.ts` / `ko-coverage.ts`: the row that adds a key carries its es and ko values from an R8 draft with the F-I18N-001 §3.10 review in the same PR, ledger re-signed (as AMENDMENTS-TRACE-IDLE §3.6 and AMENDMENTS-DURABLE-PROGRESS §3.8 did). This spec gives English only.

| Key | English | Row |
|---|---|---|
| `learner.minigame.leave.title` | Keep playing? | LR-1 |
| `learner.minigame.leave.message` | If you leave, the game starts again next time. | LR-1 |
| `learner.home.next.resume.line` | `(step: number, total: number) => \`You stopped at step ${step} of ${total}.\`` | LR-2 |
| `learner.home.next.resume.startAgain.cta` | Start again | LR-2 |
| `learner.home.next.resume.sheet.title` | Start this lesson again? | LR-2 |
| `learner.home.next.resume.sheet.message` | You go back to the first step. Your stars and cards stay. | LR-2 |
| `learner.home.next.resume.sheet.keep.cta` | Keep my place | LR-2 |
| `learner.stageReview.resume.title` | Pick up where you left off? | LR-3a (the Stage Check reuses it) |
| `learner.stageReview.resume.startAgain.cta` | Start again | LR-3a (the Stage Check reuses it) |
| `learner.dailyReview.saveFailed.title` | We could not save this yet. | LR-4 (the Stage Check reuses it) |
| `learner.dailyReview.saveFailed.body` | Your answers are still here. | LR-4 (the Stage Check reuses it) |
| `learner.stageReview.leave.bodyKept` | You can keep going later. | LR-5, only with OD-LR1 (b) |
| `learner.quest.leave.message` (changed) | You can keep going later. | LR-5, only with OD-LR1 (b) |

Reused, unchanged: `learner.quest.leave.keep.cta` (Keep playing), `learner.quest.leave.confirm.cta` (Leave), `learner.home.next.continue.cta` (Continue), `common.buttons.continue`, `common.buttons.tryAgain`, `learner.results.saveLater`. "Pick up where you left off?" and "Start again" are the level check's words (`learner.placement.resume`, `learner.ts:1532`), so the learner meets one way of saying it. The review-copy rule (`lintReviewStrings`, run by `scripts/validate-content.mjs:327-331`; namespaces `REVIEW_COPY_NAMESPACES`, `packages/content-schema/src/lesson-lint-copy.ts:131-157`) reads the new `dailyReview` and `stageReview` keys: they hold no percentage and no "n of m". `home` is not one of its namespaces; the Home line's "step 3 of 5" is a place in the lesson, as the hero's "lesson 2 of 3" (`learner.home.next.where`, `learner.ts:346`) already is, never a count of answers.

### 3.8 Telemetry

No new event. LR-1 adds a counter that is never sent. A resumed check sends its start event once per run and its complete event once (§3.4). `minigame.finished` is unchanged (§3.1).

### 3.9 [On device, owner]

- iPhone: in a game, before any answer, an edge swipe leaves; after one answer it does nothing, and Close asks Keep playing?.
- Android: after one answer the back button asks; on the open sheet the back button closes the sheet and the round is the same.
- TalkBack and VoiceOver: the sheet's focus starts on Keep playing; the title and the message are read.
- WO-07's acceptance: force-close the app on step 5 of a 6-step lesson and open it again: Home shows Continue and "You stopped at step 5 of 6."; Continue opens step 5. Start again opens step 1.
- Force-close the app on the Hangul Check's third pause and open the check again: the resume page; Continue opens part 4; the result counts all five parts.

## 4. Out of scope

- A game's state inside a step (its round index, its hints, a half-drawn letter): a step still starts from its beginning (WO-07 "하지 말 것").
- The star rules and the first-try rules: unchanged.
- **Typed text before it is submitted** (Write Frame, My Story, Type Hangul): with no answer yet, a back leaves without asking, as today, and the text is lost. A follow-up if the owner wants it.
- **The episode page's Start and the mission cards** open a saved run as AU-12 does, under their own words ("Start"). Only the hero says so (§3.2). A follow-up for WO-38 (learner screens).
- The Cell Check's Try again, which starts a new attempt (`CellCheckScreen.tsx:183-186`); the Cell Check, the Daily Review and Keep going do not resume (short sessions).
- **A check that opens on a store that cannot be read** shows the same untrue lines as a failed finish ("All refreshed today", `DailyReviewScreen.tsx:216-220`; the Stage Check's not-ready line, `StageCheckScreen.tsx:103-110`). The cause is a read, not a save: a follow-up with the other stores of AMENDMENTS-DURABLE-PROGRESS §4.
- **The Stage Check's interrupted part is asked again** (§3.4): its first answers were written into the memory store before the interruption, so those items are answered twice. On the same day the memory store's own rule keeps the second answer from moving a box (an answer is spaced only on a new day, `logic/memory/spacing.ts:132`; a fall happens at most once a day, `:149`); a check resumed the next day counts it as that day's answer. Accepted: saving after every answer would end this, against WO-07's "between parts".
- `destructive: true` on the quest's Leave (`QuestPlayerView.tsx:335`) and the system `Alert` behind `confirm()` on native: WO-37 row NB-4.
- The All lessons preview's games (§3.1) and a guest's run (GU-D12).

## 5. UI sketch

- Wireframes (this row, LR-0): `design/wireframes/minigame/keep-playing-sheet.md`, `design/wireframes/home/next-lesson-resume.md`, `design/wireframes/reviews/check-resume.md`, `design/wireframes/reviews/save-failed.md`.
- Row LR-0b: the mocks in `design/screens/quest-leave-resume/` (the Home hero's resume variant and its sheet, the check resume page, the save-failed page; at 390 x 844 and at 320 x 568 with the largest text), approved by multi-agent review (CLAUDE.md §5). The Keep playing sheet is the shipped `ConfirmSheet` (`design/components/ConfirmSheet/spec.md`) with new words, so LR-1 needs no mock and can ship before LR-0b.

## 6. Tests

Unit and render tests under `apps/mobile/src/**/__tests__/` (vitest, testing-library, fake timers); e2e under `apps/mobile/e2e/web/`.

**LR-1**

1. `quest-run-store`: `answersGiven` rises on a first try, a retry, a hinted answer and an answer on a revisit; `beginQuest` and `reset` set it to 0; `savedRunOf` does not carry it.
2. `use-back-guard`: an event already prevented does not call `onBack`; a fresh one does.
3. `MinigameScreen` in a two-route stack: no answer → Close leaves (the quest route shows); `goBack()` (the Android back and the history bridge both dispatch it) and `POP` leave.
4. One answer → Close → `minigame-leave` shows and the route stays; Keep playing → the sheet goes, the same round shows with its answer state; Close → Leave → the quest player's launcher for the same step (not advanced), `scoredRounds` unchanged, no `minigame.finished`.
5. One answer → `goBack()` → the sheet; `POP` → the sheet; a second back while it is open → one sheet.
6. Native: `setOptions({ gestureEnabled: false })` after the first answer, `true` before it; nothing on the web.
7. The game's own finish after answers (`onFinish` → `close`; `complete`) leaves with no sheet and sends `minigame.finished` once; Back to quest on an empty game leaves.
8. Story Check: in its recap a back ends the step and no sheet shows; before the recap, with an answer, the sheet shows.
9. A `story-read` step with a checkpoint answered: a back leaves; the All lessons preview (`inPreview`): a back leaves; the guest stack: as test 4.
10. e2e `minigame-leave.spec.ts`: answer one Listen and Pick round, browser back → the sheet; Keep playing → the same round; browser back → Leave → the launcher.

**LR-2**

11. `readSavedRun`: `missing` → null; a value → the value; a read that throws twice → null; one that throws once then reads → the value; bytes that do not parse → null; the progress store's state is the same before and after; no telemetry.
12. Home: a resumable run of the hero's quest at step 3 → Continue (also with `questsDone` 0), "You stopped at step 3 of 5.", Start again. No resume variant for: a run at step 1, another quest's run, a story quest, a run 24 h + 1 ms old, a changed step list, a read that failed, a lesson whose chunk is not in yet (then the variant once it lands).
13. The hero's button keeps its place when the read lands (the line and the link render after it).
14. Start again → `home-start-again`; Keep my place → nothing changes; Start again → the saved run is cleared before the player reads it, and the player opens on step 1.
15. e2e `home-resume.spec.ts`: play a quest to step 3, reload, go Home: Continue and the line; Continue → step 3; again, Start again → step 1.

**LR-3a**

16. `saved-check` (pure): the stored value at each pause; resumable rules (age either way, ids changed, `done` out of range, answers of other items, a bad answer shape, garbage) → null.
17. `review-flow`: a resume start → Continue → `playing` at chunk `done`; a leave on the resume page exits; Start again → the intro.
18. `review-run-store.restore`: the restored items keep their first answer; a later answer to them is a retry.
19. `StageReviewScreen`: two chunks done → stored; unmount, mount → the resume page; Continue → chunk 3; the result counts chunks 1 to 5; `review.start` once; the romanization choice kept; Stop → cleared; the result → cleared.
20. `check-run-saved`: the learner's removal removes the key; `profile-keys.test.ts` passes with `check-run` listed.

**LR-3b**

21. `resumeSession`: with the same states and seed the rebuilt rounds equal the planned ones; null on another locale, another items hash, 24 h + 1 ms, a retired item, a round that cannot be rebuilt, a meaning chunk that cannot load.
22. `StageCheckScreen`: part 1 done → stored; remount → the resume page → part 2; `recordRound` is not called for part 1 and `begin` not again; the stars equal those of an uninterrupted run with the same answers.

**LR-4**

23. Daily Review: the finish rejects → `daily-review-save-failed`, never `daily-review-nothing`; Try again → the result with its stars; only the round whose recording rejected is recorded again; Try again is busy while it runs (a double tap is one try).
24. Stage Check: the same, never `stage-check-nothing` after a rejection; a finish that answers null still shows the calm page; the stored run is cleared only after a finish that resolves.
25. Both apis: a second `finishSession` for the same plan writes no second entry, latch or event.
26. OD-LR8: each of the four result pages shows `learner.results.saveLater` while the learner is in `saveRetryFailedFor` or `loadFailedFor`, and not otherwise.

**LR-5**

27. The leave lines of §3.6, by key and English (with OD-LR1 (b), the changed ones).

Coverage: `apps/mobile` business logic stays at or above 90 % (CLAUDE.md §6).

## 7. Rollout

- Next release. No migration: `hr:check-run:<id>` is a new key (absent is nothing stored), and an older build ignores it. A value a newer build cannot read is dropped by `resumableRun` / `saved-check`.
- LR-1 can ship first (§9). No flag: each row is small and its old behaviour is one revert away.
- Home loads the hero lesson's chunk on focus (§3.2): the lesson the learner opens next, precached on the web; on native one bundle holds every chunk.
- What to watch: nothing new is measured (§3.8). The on-device checks of §3.9 are the owner's.

## 8. Dependencies

- Merged upstream: AU-12 (#1035), QB-2 to QB-4 (#1037), AMENDMENTS-DURABLE-PROGRESS rows DP-1b and DP-2 (`durableRead`, `saveRetryFailedFor`).
- WO-37 row NB-4 is not needed (OD-LR2's recommendation). If the owner picks it instead, LR-1 waits for it.
- Files shared with other work orders (README §6), merged one after another: `store/quest-run-store.ts` and `QuestPlayerView.tsx` (WO-06, WO-07, WO-38's launcher); `HomeScreen.tsx`'s hero (WO-38 row 2 moves it); `MinigameScreen.tsx` (WO-04 changes the game files beside it, not this file). `packages/i18n/src/messages/en/learner.ts`: rebase mechanically.
- es and ko values: R8 drafts and the §3.10 review, in each row's PR (§3.7).

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| LR-0 | Opus 5.5 | This spec and the four wireframes of §5 | — | — | `docs/quest-leave-resume-spec` |
| LR-0b | Opus 5.5 | The mocks of §5 (Home resume variant and sheet, check resume page, save-failed page); multi-agent review | — | LR-0 `ready` | `design/quest-leave-resume` |
| LR-1 | Sonnet 5.5 | §3.1: `answersGiven`, the guard in `MinigameBody` (learner and guest stacks), the sheet, the screen's own exits, `defaultPrevented` in `useBackGuard`; strings `learner.minigame.leave.*` (en, es, ko) | 1–10 | LR-0 `ready` (WO-06: ships before the WO-07 rows) | `fix/minigame-back-guard` |
| LR-2 | Sonnet 5.5 | §3.2 the Home resume variant and its sheet; §3.3 `readSavedRun` on `durableRead`; the comment at `QuestPlayerScreen.tsx:32-34` ("No screen and no word of its own"); strings `learner.home.next.resume.*` | 11–15 | LR-0b | `feat/home-resume-lesson` |
| LR-3a | Sonnet 5.5 | §3.4 common parts and the Hangul Check: `logic/reviews/saved-check.ts`, `store/check-run-saved.ts`, `PER_PROFILE_KEYS`, the flow's resume start, `review-run-store.restore`, the resume page; strings `learner.stageReview.resume.*` | 16–20 | LR-0b | `feat/hangul-check-resume` |
| LR-3b | Sonnet 5.5 | §3.4 the Stage Check: the stored questions, `resumeSession`, the resume page on the Stage Check (OD-LR7) | 21–22 | LR-3a | `feat/stage-check-resume` |
| LR-4 | Sonnet 5.5 | §3.5: the `failed` phase and Try again on the same answers (Daily Review, Stage Check), a finish once per plan, the save-later line on the four result pages (OD-LR8); strings `learner.dailyReview.saveFailed.*` | 23–26 | LR-0b; after LR-3b when both touch `StageCheckScreen.tsx` | `fix/review-save-failed` |
| LR-5 | Sonnet 5.5 | §3.6: the leave lines (changed only with OD-LR1 (b)), the `QuestPlayerView.tsx:132` comment; "Amended YYYY-MM-DD by AMENDMENTS-QUEST-LEAVE-RESUME" lines in AU-12, QB, F-QUEST-002, F-CURR-002, AMENDMENTS-DISPLAY-NAV; [LR] notes in the five wireframes this spec amends and lines in `design/wireframes/README.md`; the `docs/specs/README.md` index line; status `shipped` | 27 | LR-1 – LR-4 | `docs/quest-leave-resume-finish` |

One commit = test + implementation. A row that meets a decision this spec does not make stops and reports (README §3).

## 10. Owner decisions (open)

Each has a recommendation. None is decided yet; the spec reads as if each recommendation were taken, and says where an answer changes a row.

- **OD-LR1 — What Leave and Stop do to a saved place.** (a) As today: the quest's Leave clears the saved run (AU-12), and the Hangul Check's and the Stage Check's Stop clear the stored check. The run goes on only after an interruption the learner did not choose (an app kill, a call, a reload). The sheets keep their words, all true (§3.6). (b) Leave and Stop keep the place: the next open goes on; Home shows Continue after a Leave; the lines become "You can keep going later." (§3.6, §3.7); AU-12 and F-QUEST-002 NB-1 are amended; the episode page's "Start" then resumes after a chosen Leave too (§4). **Recommendation: (a).** WO-07's goal is the app kill and the phone call, which AU-12 and LR-3 cover; "Keep playing" is already the first choice; a learner who reads "Stars from this try will not be saved" and picks Leave has chosen to start again; and (a) leaves fewer screens whose words do not say what they do.
- **OD-LR2 — Which sheet asks in a game.** (a) The design system's `ConfirmSheet`, drawn by the game screen on every platform, as the Daily Review, the Cell Check and the Stage Check already do. (b) `platform/dialog.ts`'s `confirm()` without `destructive` (WO-06's fallback): the system `Alert` on native, the ConfirmSheet on the web. (c) Wait for WO-37 row NB-4 (no spec yet). **Recommendation: (a).** It is the app's sheet on native today with no new work, which is what WO-06 asks for. Until NB-4, the quest's own Leave is still the system Alert on native, so the two questions look different there.
- **OD-LR3 — The iOS edge swipe in a game.** (a) Off only while the guard would ask (`holds`, as the quest player does): before the first answer the swipe leaves, as every other way does. (b) Always off on the route (`gestureEnabled: false` in `root.tsx` and `guest-chunk.tsx`, WO-06's text): the swipe never works in a game, before an answer too. **Recommendation: (a)**: at no answer every way back does the same thing, and with an answer the swipe does nothing either way (no sheet can follow a native swipe).
- **OD-LR4 — Where the game guard applies.** Recommended: the learner and guest stacks; not the All lessons preview (a grown-up browsing; it records nothing); not a `story-read` step (its bookmark keeps the scene). The alternatives are to add either one.
- **OD-LR5 — What Home shows.** (a) The hero's Continue opens the lesson at once; under it the line and a quiet Start again that asks first (§3.2); only for a saved run of the hero's own lesson (not a story quest, not a run at its first step); another lesson's saved run is not on Home. (b) Continue opens a sheet "Pick up where you left off?" with Continue and Start again: one more tap on every Continue. (c) As (a), plus a line for another lesson's saved run. **Recommendation: (a)**: the main path stays one tap, starting again is one tap and a confirm, and Home gets no second "next" (AMENDMENTS-DISPLAY-NAV §9.1 keeps one).
- **OD-LR6 — What Start again on Home does.** (a) Clears the saved run and opens the lesson at its first step at once. (b) Clears it and stays on Home (the hero then reads as without a saved run). **Recommendation: (a)**: the learner said "start again", and (b) leaves them looking for the button that does it.
- **OD-LR7 — The Stage Check's resume.** (a) Row LR-3b as §3.4 says: store the engine's questions and the seed, rebuild the rounds, drop the run when the content, the locale or a round changed. (b) No Stage Check resume for now: only the Hangul Check (LR-3a); the Stage Check (about 7 minutes, behind `stageChecks`, every curriculum switch at built-in pct 0, `apps/mobile/src/config/flags.ts:540`) starts again after an interruption, as today. **Recommendation: (a)**, as a row of its own after LR-3a: WO-07 asks for both checks, and the stored questions are plain data the engine already makes. Choose (b) if the stage checks will not ramp soon: LR-3b is the row with the most code in the memory chunk.
- **OD-LR8 — The save-later line on the check result pages.** (a) The Daily Review, Stage Check, Hangul Check and Cell Check result pages show `learner.results.saveLater` under the stars while the progress write has not landed, as Results does (DP-2, OD-DP7). (b) Results only, as built. **Recommendation: (a)**: WO-07's "저장 실패는 성공 화면으로 가리지 않는다" holds for these pages only with it; it is one line and one selector each.

## 11. Review log

- 2026-11-23, revision 1 (LR-0): written on `e72336a7d`. Every citation of WO-06 and WO-07 re-read (§1.1): most lines moved; one claim is false (the Stage Check shows its not-ready line, not "All refreshed today", after a failed finish); the Cell Check model's Try again starts a new attempt; WO-37's NB-4 has no spec, and the screens already draw `ConfirmSheet` on native; the Home hero already says Continue and already resumes. What AU-12 and QB-2 to QB-4 ship is listed so no row repeats it (§1.2). Waiting for the owner decisions of §10 and a multi-agent review.
