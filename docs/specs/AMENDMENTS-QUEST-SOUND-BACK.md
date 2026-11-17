Status: done; rows QB-1 to QB-4 done (#1037), rows QS-1 to QS-5 done (the PR that adds this line)

# Amendment: sounds get room at both ends, and a quest step can be taken back

> **Owner request of 2026-11-17 (in chat, translated):**
> 1. "In a quest the audio comes too fast, so its very start is not heard. In a quiz, I pick an answer, its audio is playing, the quest moves on and the audio ends in the middle. Sounds need a margin at the start and at the end, like a fade in and a fade out."
> 2. "In the middle of a quest I sometimes move on without meaning to. Add a way to go back to the one before."
>
> Amends `F-AUDIO-004-korean-voice-quality.md` (section 3.5), `AMENDMENTS-AUDIO-CLIPS.md` (section 2, G7), `F-QUEST-002-discover-check-stage1-complete.md` (section 3.2), `AMENDMENTS-AUDIT-2026-11.md` (AU-10, AU-12) and the wireframes `design/wireframes/quest/player.md` and `discover.md`.
> Every change is marked **[QS]** or **[QB]** where it lands in a spec, test or code comment.

**Standing rules that apply here**

- Anti-shame rules stay as written in CLAUDE.md section 1. Going back never lowers a meter, a star or a tally.
- UI strings come from `packages/i18n` with English, Spanish and Korean in the same PR; the review ledger of a changed `en` namespace is re-signed.
- One commit per row, test and code together.

## What was found (basis `origin/main` `140bcc5`)

- Web clips play through Web Audio with the source wired straight to the output: `node.connect(audio.destination); node.start(0)` (`platform/audio-player.web.ts`). No gain node, no ramp, no lead-in. A stop is `source.stop()`, a hard cut.
- A new play cuts the one before it (`logic/audio/controller.ts`, supersede), and every step change, page change and unmount calls `stop()`.
- Most games move to the next round on a fixed timer of 600 to 900 ms after the answer, whatever is still sounding: Listen and Pick and the Quick check (700), Cloze Pick (700, and it says a whole sentence), Hidden Heritage (700), Pic-Word Match (700), the vocabulary questions (600 / 700 / 1000), Read Pick (900), Card Match (800). Only Sentence Builder, Tap and Respond and Role Play wait for the sound (`logic/audio/reply-advance.ts`).
- The Look and learn page says its first letter one microtask after the page shows (AU-10), while the page is still arriving.
- The quest has no way back: `goNextStep` only, and the Look and learn pages only move forward. No spec forbids one. "Back" in this product means leaving a screen (`AMENDMENTS-LECTURE-V2.md` LV-M1), so the new control is named "Previous".

## Rows: sound

**QS-1 A clip starts a moment after it is asked for, and fades in.**
On the web player the source goes through a gain node. The clip is scheduled `60 ms` ahead (`180 ms` when the audio context had to be resumed for this play, the case where the output device is waking) and its gain rises from 0 to 1 over `20 ms`. The safety timer that ends a play grows by the same lead. Where the context has no gain node or clock (an old engine, a test fake), the player plays as before.
*Done when:* unit tests show the scheduled start time and the ramp, and the fallback path with no gain node.

**QS-2 A sound that is stopped fades out.**
Stopping a playing clip (a new play, a step or page change, mute, unmount, a hidden page) ramps its gain to 0 over about `80 ms` and stops the source then, instead of cutting it at once. A stopped clip never reports that it finished. The native player may keep its plain stop.
*Done when:* unit tests show the ramp and the delayed stop, that `stopAll` covers every playing clip, and that no "done" is reported for a stopped clip.

**QS-3 A sound played by itself waits for the screen.**
A sound the app starts without a tap on a screen that has just appeared waits `350 ms` first: the first letter of a Look and learn page (AU-10) and the first round's prompt of a game. Later rounds of the same game and every tap on a speaker stay immediate (G7's 150 ms holds for them). With reduced motion the wait is the same; with sound off nothing plays, as now.
*Done when:* tests show the wait on a first page and a first round and no wait on a tap or a later round; the e2e timing probes are updated to measure from when the sound is due.

**QS-4 The answer's sound ends before the quest moves on.**
Where an answer plays a sound (the item's clip or voice), the next round, the next question or the end of the step waits for that sound to end, with the game's present delay as the least wait and `2500 ms` as the most (`6000 ms` where the sound is a sentence, as `afterReply` already allows). This covers Listen and Pick and the Quick check, Cloze Pick, Hidden Heritage, Pic-Word Match, the vocabulary question view, Read Pick, Card Match, Syllable Build and Match Shape. Games that play nothing on an answer (Match Sound, Build a Letter, Culture Quiz) wait the same way for a prompt that is still sounding. One helper serves all of them (`afterReply` generalised), and each flow's present constant stays as its least wait so the flow tests keep their values.
*Done when:* a unit test per flow shows the advance held until the sound ends and released at the cap; an e2e shows a Listen and Pick answer's clip is not stopped by the next round.

**QS-5 The speech voice gets the same start room.**
When the sound is the device voice (no clip), the first utterance after the engine was idle is deferred by `150 ms` instead of `50 ms`. Text fallback is unchanged.
*Done when:* the controller test shows the longer defer for the first utterance only.

## Rows: taking a step back

**QB-1 Previous inside Look and learn.**
From page 2 on, a Look and learn step shows **Previous** beside Continue. It shows the page before and stops any sound. The page dots keep the furthest page reached (they only fill); the page shown is marked as now. On page 1 the control follows QB-2.

**QB-2 Previous between steps.**
From the second step on, every step shows **Previous**. It shows the step before, whatever its kind. Arriving on a Look and learn step this way opens its last page. A step shown again is a *revisit*:
- a teaching step (intro, Look and learn, the finish page) looks as it did, with Continue;
- a game step or the Check shows its launcher with **Continue** as the main button and **Play again** as the second; "Skip for now" is not shown on a revisit, because the step is already done or already skipped.
Previous never appears on the Results screen, and a game in play has no Previous (its own Close goes back to the launcher as today).

**QB-3 Going back changes no score.**
The run keeps the furthest step reached. Nothing tallied is undone by Previous. Playing a game again scores nothing new: rounds are keyed by step and round, so a replay cannot add a correct answer, a miss or a retry to the stars, and the memory store gets no second event. A step that was skipped stays skipped (AU-9) unless the learner plays it on the revisit; a full play of it removes it from the skipped steps. The telemetry events of a step (`quest.discover_completed`, `quest.check_completed`, the minigame finished event) are sent once per step per run.

**QB-4 The saved run follows the furthest step.**
The run saved for a reload (AU-12) stores the furthest step, so a reload after going back resumes at the furthest step, not behind it.

**Strings.** `learner.quest.previous.cta`: "Previous" / "Anterior" / "이전". The launcher's second button reuses an existing "Play again" string if one fits the quest namespace; otherwise `learner.quest.launcher.again.cta`: "Play again" / "Jugar otra vez" / "다시 하기".

**Layout.** Previous is a secondary button in the same row as the main button, to its left; the main button keeps the larger share. At 320 wide with the Largest text the row may wrap, main button first. Both stay at least 64 high. A design pass adds the row to the two wireframes and a mock under `design/screens/quest-previous/` before the component changes.

## Not in this amendment

- Undoing an answer inside a game, or going back to an earlier round.
- A fade on the native (expo-av) player.
- New recordings or changes to the silence the clips already carry.

## As built

### QS-1 to QS-5 (sound)

- **QS-1** `platform/audio-player.web.ts`: source -> gain node -> output; `start(currentTime + lead)` with `CLIP_LEAD_MS` 60 (`CLIP_WAKE_LEAD_MS` 180 when this play resumed the context); gain `setValueAtTime(0)` then `linearRampToValueAtTime(1)` over `CLIP_FADE_IN_MS` 20; the safety timer grows by the lead. No `createGain` or no `currentTime` (or a gain node that throws): the old wiring, `start(0)`.
- **QS-2** same file: a stop of a sounding clip runs `cancelScheduledValues`, `setTargetAtTime(0, now, 0.02)` and `source.stop(now + CLIP_FADE_OUT_MS / 1000)` with `CLIP_FADE_OUT_MS` 80; a clip still inside its lead, or an engine with no gain node, gets the plain stop. The handle leaves `stopAll`'s set at once and a stopped clip never reports done. The native player keeps its plain stop.
- **QS-3** `logic/audio/settle.ts` (`SCREEN_SETTLE_MS` 350, `afterScreenSettles`) for the Look and learn page (AU-10); `logic/audio/sound-pacing.ts` `opening()` with `components/use-sound-pacing.ts` for a game's first round: Match Sound, Trace Stroke, Trace a Word's first block, Tap and Respond, Role Play, the vocabulary question view, the quest review rounds and Hidden Heritage's first word. Any sound the screen starts first (a tap) drops the pending one; unmount and page change drop it. Later rounds and taps are immediate. Listen and Pick, Syllable Build and Dictation never autoplay round 1, so nothing changed there.
- **QS-4** `logic/audio/reply-advance.ts` `afterSound(sound, { minMs, maxMs })` (`afterReply` is now `afterSound` with 900 / 6000; `ANSWER_SOUND_MAX_MS` 2500); `sound-pacing.ts` `after(minMs, run, maxMs)` waits for the last tracked sound (`SENTENCE_SOUND_MAX_MS` 6000 for Cloze Pick and a Listen and Pick sentence). The flows keep their effects and constants (700, 600 / 700 / 1000, 800, 900, `FOUND_ADVANCE_MS`, `CLOZE_ADVANCE_MS`, `SOLVED_PAUSE_MS`, `PAIR_SOLVED_PAUSE_MS`) as the least wait; the last round's completion waits the same way. Read Pick keeps 0 under reduced motion and still waits for the sound. Match Sound, Build a Letter and Culture Quiz wait for a prompt still sounding.
- **QS-5** `logic/audio/controller.ts`: `FIRST_UTTERANCE_DEFER_MS` 150 before the first utterance after the engine was idle (`SPEECH_IDLE_AFTER_MS` 1000 with nothing said or stopped); after a cancel the 50 ms drain stays. Deviation: a prompt asked inside a tap's own task (`inGestureTask`, set by the web adapter's capture listeners) and one behind the speech unlock's warm-up are not deferred, because iOS Safari speaks only inside the tap's task (`learner-audio.spec.ts` checks `inTask`).

- Start bundle: QS on top of QB measures 4,957,992 B raw (release build, CI=1); `PRECACHE_BUDGET.startBundleRaw` is 4,962,000 B.

### QB-1 to QB-4 (taking a step back)

Design pass first: `design/wireframes/quest/player.md`, `discover.md` and `check.md` (sections marked [QB]) and the mock and spec under `design/screens/quest-previous/`.

**QB-1.** `logic/stage1/discover-flow.ts` has a `prev` event (the page before, every sound and any Read along stopped) and keeps the furthest page reached; `pageRender` gives the dots the furthest page and, while the page shown is behind it, the page to mark. `DiscoverStep` draws the row through `screens/quest/StepActions.tsx`. The design system's `Progress` (dots) takes an optional `current` dot, drawn as a ring that takes no room; without it the dots are drawn as before.

**QB-2.** `quest-run-store` keeps `furthestStep` and has `goPrevStep` (never under the first step; it drops a pending advance) and `cameBack`. The player (`QuestPlayerView`) shows Previous from the second step on, on every kind of step. A step behind the furthest step is a revisit: a teaching step is drawn as it was; a game step or the Check shows Continue as its main button and Play again under the row, with no Skip for now (`launcherView(kind, copy, revisit)`). Look and learn reached by Previous opens on its last page with its dots full. The step dots keep the furthest step and ring the step shown; the count pill and the meter's words name the step shown. Previous is the run's own move: the header's Close and the browser's back still ask the leave question.

**QB-3.** On a revisit `answerRound` changes nothing (no right answer, no miss, no retry, nothing for Try these again or the pacing rules, no event for the memory store), unless the step is in the skipped steps: a skipped game was never played, so its rounds score as a first play, and when it ends (`markStepComplete`) it leaves the skipped steps and stops capping the stars. `reportOnce` keeps the step events already sent: `quest.discover_completed` and `quest.check_completed` go out once per step per run, and `minigame.finished` is not sent for a game played again (`logic/minigame-finished.ts`, `gameFinishIsReported`). `watchCheck` keeps what a Check had counted when the learner leaves it by Previous half-way and takes its baseline again when the Check is back on screen, so its event still carries all of its rounds and only its rounds.

**QB-4.** `savedRunOf` stores the furthest step as the run's step, and the step events already sent, so a reload after Previous resumes at the furthest step and sends nothing twice. A value stored before this row is still resumed.

**Strings.** `learner.quest.previous.cta` (Previous / Anterior / 이전) and `learner.quest.launcher.again.cta` (Play again / Jugar otra vez / 다시 하기). The existing "Play again" is the episode page's (`learner.episode.quests.playAgain`), not the quest's, so the quest got its own key.

**Layout as built.** In the row both buttons are `lg` (80 high): Previous `secondary` on the left with one share, the main button `primary` on the right with two. A step with no Previous (the first step) keeps its button as it was (hero, full width). The row wraps upward when the two labels cannot share a line, so the main button is the first line (seen at 320 wide with Largest text; at 390 wide with the standard size the two share a line). The second button (Skip for now, or Play again on a revisit) stays under the row, `ghost`, 64 high.

**Decisions made while building, beyond the row text.**

- On the finish page with Try these again offered, the offer keeps its two buttons and Previous sits under them (`ghost`, 64 high, full width); it is not drawn during the moment the offer is being planned, so no button moves under a finger.
- A game left open on the furthest step (closed half-way, then Previous and forward again) is taken up as before: only steps behind the furthest step are score-neutral.
- A skipped game that is opened on a revisit and closed half-way keeps the rounds it answered (scored on the first try, as any game closed half-way) and stays a skipped step until it is played to its end. A game's own Skip button ends the step as it always did (AU-9), so it also ends a skipped step.
- On the furthest step `minigame.finished` is sent as before, including once per part of a story told in parts; only a revisit is held to once per step.
- A replay is score-neutral for the run store. What a game writes by itself outside the run (a story's bookmark, practice time) is unchanged by this amendment.
- Look and learn says its first letter again when the step is opened again by Previous (the step is a new page opening, AU-10); going back a page inside the step does not.
- A Close on a revisit asks the leave question as on any step before the finish page; only the finish page itself ends the run on Close (NB-1), as before.

**Tests.** Unit: `store/__tests__/quest-run-store.test.ts`, `quest-run-saved.test.ts`, `logic/quest-flow/__tests__/saved-run.test.ts`, `logic/__tests__/check-launcher.test.ts`, `logic/stage1/__tests__/discover-flow.test.ts`, the design system's `Progress.test.tsx`. Render: `screens/quest/__tests__/discover-previous.test.tsx`, `quest-previous.test.tsx`. E2E: `apps/mobile/e2e/web/quest-previous.spec.ts` (Previous inside Look and learn and back to the intro; a revisited launcher and a bad replay that leaves three stars; a reload after going back, and the browser back; the row at 320 x 568 with Largest text). Shots of the app: `design/screens/quest-previous/shots/app-*.png`.

**Start bundle.** The rows are quest player code, so they are in the start bundle: the release `build:web` (CI=1, Metro cache cleared) measures 4,953,393 B raw, 1,393 B over the line; the line is raised to 4,957,400 B (`apps/mobile/scripts/pwa/lesson-chunks.mjs`).
