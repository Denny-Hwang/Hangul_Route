Status: ready; rows QS-1 to QS-5 and QB-1 to QB-4 open

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

_Filled in by the PR that closes the rows._
