# AMENDMENTS-AUDIO-CANT-HEAR — a way out when the sound does not reach the learner

Status: ready (owner decisions 2026-11-23 and 2026-11-24) for rows CH-0b, CH-1a, CH-1b, CH-1c, CH-1d, CH-1e, CH-1f, CH-2, CH-3 and CH-4. Owner decision 2026-11-23: OD-CH1 to OD-CH6 approved as recommended and departures D1, D2 and D3 approved (§10); the multi-agent review of 2026-11-23 then re-opened OD-CH2 and OD-CH6 and added OD-CH7. Owner decision 2026-11-24: OD-CH2 (b), OD-CH6 (c) and OD-CH7 (b), all as recommended (§11, §12); the CH-0b design-pass questions CH-Q1 to CH-Q3 also answered as recommended (§11). Revision 2 (2026-11-23) adjudicates that review (§12). Revision 1 (2026-11-23) was written for work order WO-05 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row CH-0, on main `e72336a7d`; the WO was written on `d5ba0217c`. Built on owner decision **OD-R6** (approved 2026-11-22, `docs/roadmap/review-2026-11/README.md` §4): a play the learner taps does **not** play through the iOS silent switch (the 2026-10-10 decision stays); the app adds guidance and **Show the letters** instead.

**Amends**: F-AUDIO-004 §3.8 (visible text fallback: a third way in, the learner's own ask, and the one text the "no Korean voice" exception never takes back) and §8 item 3 (the silent-switch open question: closed by OD-R6 and this hint) · F-001 §3.3 (the "Revised 2026-10-10" text-prompt paragraph: the learner can ask for the text) · F-QUEST-002 §3.10 (Listen & Pick: the entry point) · F-CURR-002 §4.5 (review and warm-up rounds), §7.1 F2 (Dictation's `see` round) and F3 (Syllable Build) · F-VOC-004 (the Speed round's sound question, Relaxed mode) · `design/components/VoiceHelp/spec.md` §2 (the help sheet shows this device's steps only; its scrim leaves the accessibility tree) · tag **[CH]**
**Not amended**: `PLAY_IN_SILENT_MODE` (`apps/mobile/src/config/audio.ts:10`) and OD-R6 itself. `AMENDMENTS-AUDIO-CLIPS.md`: the WO allows a section there; this is a separate file because (1) that amendment is about *what* the voice says and how the clips are made (Part A jamo voice, Part B clips), while this one changes the fallback UI that F-AUDIO-004 §3.8 owns; (2) it is `ready` with rows still open (AC-13 native clips, and clips held for a later round) and its own review log, and six PRs edited it this month (#1016, #1025, #1030, #1031, #1032, #1038), so a new section would collide with that work; (3) the CH rows and OD-CH decisions read cleanly on their own. No new native module, and nothing tries to detect the silent switch or a muted tab.
**Scope**: `apps/mobile/src/logic/audio/prompt-state.ts`, `logic/audio/voice-help.ts`, `logic/device-family.ts` (new), `logic/audio/cant-hear.ts` (new), `logic/pwa/install-guide.ts` (its user-agent tests move to `device-family.ts`, results unchanged), `platform/device-family.ts` (new), `components/use-prompt-slot.ts`, `components/CantHear.tsx` (new), `components/VoiceHelpSheet.tsx`, the screens of §3.1 (with `screens/reviews/ReviewRounds.tsx`'s `RoundView` and `screens/vocab/VocabQuestionView.tsx`, each gaining a `cantHear` prop, and their hosts), `logic/listen-pick-flow.ts` (CH-1e), `logic/type-hangul/hear-mode.ts` (CH-1c), the answer paths of §3.13 (CH-1f), `store/audio-store.ts`, `packages/content-schema/src/schemas/audio.ts` and `screens/profile/` (CH-2), `packages/backend/src/lib/server-events.ts` and the client telemetry types (CH-4), the tests of §6, `packages/i18n` (en, es, ko)
**Owner**: solo dev
**Rollout**: next release

---

## 1. Context

### 1.1 The citations of WO-05, re-read on `e72336a7d`

None of the four files the WO cites changed between `d5ba0217c` and `e72336a7d` (25 commits). In the files this spec also touches, the only change is one line of `screens/minigames/MatchSoundGame.tsx` (`:229`, the tile label's locale "or", SO-1b #1062), which does not affect it.

| # | WO-05 says | On `e72336a7d` | Verdict |
|---|---|---|---|
| 1 | `config/audio.ts:4-10`: `PLAY_IN_SILENT_MODE = false`, comment "the visible text prompt keeps every round playable" | The same: the comment is `:1-9`, the constant `:10` | correct |
| 2 | `logic/audio/prompt-state.ts:37-39`: `result === 'played'` gives `phase: 'ok'` | `:37-40` (the `if` block; the return is `:39`) | correct |
| 3 | text shows only in `muted` / `no_voice` / `error` (`showText`, `:65-67`) | `showText` is `:65-67`. It is true when sound is off, when the phase is `text`, or when there is no Korean voice and no clip. The `text` phase has **four** reasons: `muted`, `no_voice`, `error` and **`blocked`** (`:14`, `:41-42`) | correct in substance; `blocked` was left out |
| 4 | `platform/audio-player.ts:135` passes `playsInSilentModeIOS` | `:135` (inside `ensureMode`, `:132-144`) passes `env.playInSilentMode`, which `expoAvClipEnv` sets from `PLAY_IN_SILENT_MODE` (`:319`) | correct |
| 5 | reported: with the switch on, a play still ends as `played` (needs a device) | It matches the code. Nothing reads the output level: a native clip reports `onStart` and `onDone` (`audio-player.ts:213-224`, `:255-261`), and the controller returns `played` for a clip (`logic/audio/controller.ts:641-645`) and for a voice that ended (`:602`). Not checked on a device (F-AUDIO-004 §1 engine table, "Silent switch" row; §5 device matrix, iPhone rows) | unverified on a device; **this spec does not depend on it** (§3.2: the exit is always there) |
| 6 | the guidance is filtered by `Platform.OS` "the same way as `logic/audio/voice-help.ts:56`" | `:56` is `SECTION_ORDER = ['apple', 'android', 'computer']`: the "Add a Korean voice" sheet lists **all three** device families. Nothing in `voice-help.ts` or `components/VoiceHelpSheet.tsx` (`:22`, `:62-69`) reads `Platform.OS` | **false as a model.** `:56` is the defect itself (review item mobile P2-22; also WO-37 row NB-7 in `docs/roadmap/review-2026-11/phase-5-native-a11y.md`), not a filter to copy. Also, `Platform.OS` is `'web'` in every browser, so it cannot pick the iPhone line in the web PWA, the main channel (CLAUDE.md §1). §3.4 says how the device is chosen instead |

### 1.2 What happens today

- On an iPhone with the silent switch on, Match Sound plays the letter's name. The clip or the voice "plays" without sound and ends as `played`, the slot goes to `ok`, no text shows, and the heading still says "Tap the letter you hear". The learner sees a speaker that does nothing. The same happens on Android with the media volume at zero, in a browser tab or page that is muted, or with headphones paired somewhere else. The app gets no signal in any of these cases: iOS has no public API for the switch, and browsers do not report a muted tab.
- The only way to the text today is Profile → Sound off (the `muted` fallback, F-001 §3.3), and a learner does not know that.
- After a **miss**, Hoya's bubble shows the letter's name as text (`wrongAnswerBubble`, `logic/audio/prompt-view.ts:116-120`). But a miss is a first-try miss that costs stars (`answerRound(roundIdx, false, …)`, `MatchSoundGame.tsx:147`). Today the learner pays a star to learn that the phone is on silent.
- F-AUDIO-004 §8 item 3 already named this way out: "leave it false and show a 'phone is on silent?' hint (the state is not detectable)". OD-R6 chose it.

Who this helps: a learner on silent in a classroom, a service or a waiting room (the reason for the 2026-10-10 decision); a deaf or hard-of-hearing learner, who has no in-game switch to text today (review item accessibility #14); a family sharing an iPad.

## 2. User story

> As a learner whose phone is on silent, when I tap the speaker and hear nothing, I can tap **Can't hear it?**, see how to turn the sound on, or read the letters and keep playing, without first getting a question wrong.
>
> As a learner who is deaf or hard of hearing, I can turn a listening round into a reading round in two taps, inside the game, and a grown-up can turn on **Always show the letters** for this device so I do not have to ask every round (CH-2).
>
> As a parent or teacher in a quiet room, the app never plays through the silent switch, and the learner still has a way to play.

## 3. Acceptance criteria

### 3.1 Where the entry point goes (inventory, read from the code)

A **sound-only prompt** is a prompt that shows only a speaker until its text fallback appears (`usePromptSlot` without `textOnScreen`, `components/use-prompt-slot.ts:44-62`). These are the only surfaces where not hearing blocks the round, so these are the ones that get the entry point. On the other surfaces the Korean is already printed next to the speaker (`textOnScreen: true`, the status panel, F-AUDIO-004 §3.9 A-5b), so "Show the letters" would add nothing.

**The cue rule** (review 2026-11-23). On a pick round that already carries a **cue** that lets it be answered without sound (a picture or a meaning: Listen & Pick's spelling round, the `cue` of a Daily Review heard round, `ReviewRounds.tsx:168-169`, or of a quest warm-up round, `quest-review-chunk.tsx:404`), the sheet is **guidance only**: the device line and Hear it, no Show the letters. There, showing the prompt's Korean would print the exact right option, and the learner can already answer from the cue. On a pick round with no cue, Show the letters shows the surface's own text as today with Sound off (AD13); a right answer then carries the hinted mark of OD-CH7 (row CH-1f).

| Surface (hosts) | File | Prompt slot | What "Show the letters" shows (the surface's own text fallback, unchanged) | Focus after Show the letters | Row |
|---|---|---|---|---|---|
| Match Sound (quest Play steps, Browse preview) | `screens/minigames/MatchSoundGame.tsx` | `:74` | the letter's name in Hangul with its romanization (`PromptPanel` `:194-200`); not the tile, so no option is printed | the speaker (`match-sound-speaker`) | CH-1a |
| Listen & Pick, practice hosts (`quest`, `vocab`, `preview`; the Syllable Build and Cloze Pick fallbacks; quest pacing) | `screens/minigames/ListenPickGame.tsx` | `:186-191` | the prompt word and its romanization (`promptView` `:306-311`, live region `:419-429`). **Spelling round: guidance only** (cue rule; its picture and meaning, `SpellingCue` in `dictation-chunk.tsx`, settle it, and the shipped fallback never prints its prompt, `:303-311`) | the speaker | CH-1b |
| Listen & Pick in Checks (`check`: the quest Check; `review`: the Hangul Check, `screens/reviews/StageReviewScreen.tsx`) | same | same | per OD-CH6 (§3.12): the romanization only where the options hold or hide theirs | the speaker | CH-1e, ready (OD-CH6 (c)) |
| Heard rounds of `RoundView` in the Daily Review and Keep going (`screens/reviews/DailyReviewScreen.tsx:349`) and This week in Korea (`screens/week-drop/WeekDropScreen.tsx:198`) | `screens/reviews/ReviewRounds.tsx` (`RoundView` gains `cantHear?: boolean`; `useRoundSound` `:94` gets `cantHear: cantHear && heard`) | `:94` | a heard `spelling` round (`logic/reviews/review-rounds.ts:440, 447`) with a `cue`: guidance only; without a cue: the prompt Korean with its romanization (`:167`); a heard `reply` round (an exchange): the prompt line | the Hear again button (`daily-review-hear-again`, `:158-166`) | CH-1b |
| Heard rounds of `RoundView` in Stage Check (`screens/stage-check/StageCheckScreen.tsx:235`) and Cell Check (`screens/cell-check/CellCheckScreen.tsx:203`) | same | same | per OD-CH6 | the Hear again button | CH-1e, ready (OD-CH6 (c)) |
| Quest warm-up and Try these again, heard rounds | `screens/quest/quest-review-chunk.tsx` (its slot `:311` gets `cantHear` on the heard branch only, `:395-410`) | `:311` | with a `cue`: guidance only; without one (a syllable round): the prompt Korean (`:406-407`) | the speaker | CH-1b |
| Syllable Build (quest step `SyllableBuildGame`, review round `BuildRoundView`) | `screens/minigames/SyllableBuildBoard.tsx` | `:149` | the syllable's romanization only (the block is the answer, `:153`, `:350`) | the speaker | CH-1b |
| The vocab Speed round's sound question, **Relaxed** mode only (the default; no clock, F-VOC-004 S1) | `screens/vocab/VocabQuestionView.tsx` (gains `cantHear?: boolean`; `VocabSpeedRoundScreen.tsx:571` passes `cantHear={mode === 'relaxed'}`, `SpeedMode` in `logic/vocab/session-clock.ts:14`) | `:153-158` | the word with its romanization, read in full (`readHere` and `textFallback`, `logic/vocab/question-view.ts:108, 115-117`); the options are pictures | the large speaker | CH-1b |
| Dictation, Type Hangul `hear` (quest step, review round) | `screens/minigames/dictation-chunk.tsx` (`useHearRound` `:85-153`) | `:91` | the `see` round the no-voice fallback already draws (W11 of `design/wireframes/minigame/audio-fallback.md`): a typing round, not a pick round, so the cue rule does not apply | the `see` round's word, which focus then reads (nothing else is announced) | CH-1c |
| Discover, guidance only (text on screen) | `screens/quest/DiscoverStep.tsx` | `:407` | nothing new: the sheet has no **Show the letters**, only the line and **Hear it** | — | CH-1d (OD-CH3 approved) |

Left out (each with its reason):

- **Clocked drills**: the vocab Speed round in **Challenge** mode (opt-in, one session clock with a real countdown, F-VOC-004 S1; the sound question is built only for the Speed round, `logic/vocab/question-builder.ts:224`, since the word cards' quick check is word-to-picture, `logic/vocab/flashcards.ts:158`), and the Decoding Sprint: its drill (one clock for the minute), its probe, and the sprint's Syllable Build rounds (`screens/decode-sprint/SprintPick.tsx:46`, `screens/decode-sprint/DecodingSprintScreen.tsx:462`). A sheet costs time on the clock. OD-CH4 (approved: not now).
- **The level check** (`screens/placement/*`): it has its own audio path and text fallback (F-PLC-001 §3.11; `placement/ItemScreen.tsx:97-99, 151-161, 267`), and its warm-up decides the run's sound-off draw (`screens/placement/WarmupScreen.tsx:47`, `logic/placement/flow.ts:113`). It is a test that seeds the route. OD-CH5 (approved: a later amendment of F-PLC-001; §8 names the cost).
- **Surfaces whose round does not need the sound**, other than Discover. Either the Korean is printed next to the speaker (`textOnScreen: true`: Build Letter, Card Match, Tap & Respond, Culture Quiz, Voice Echo, Pic-Word Match, Realia Read, Cloze Pick, Sentence Builder, Story Order, Role Play, My Story, Hidden Heritage, Trace Stroke, Trace a Word, the story pages, Culture notes, word cards, card detail, the Browse topic list), or the sound is an extra after the answer (Match Shape, W11; Read Pick, whose letter is the prompt and whose options are printed). The story reader and story check always print their Korean too. The learner can go on without the sound.
- **The presenter** (lecture mode, `screens/presenter/*`): a grown-up's device, which has its own "Test the sound" (F-TCH-004 §3.7).

### 3.2 When the entry point shows (D1)

- **Given** a sound-only prompt that opts in (`usePromptSlot({ cantHear: true })`), **when** its text is not showing (`!view.textShown`), **then** a small **Can't hear it?** link is in the speaker row from the moment the round opens: before any play, before any answer.
- **While the round holds** (the voice check is still running, `!slot.settled`, `use-prompt-slot.ts:89`; Dictation's `hold` opening, `logic/type-hangul/hear-mode.ts:41`), the link is drawn but **inactive** (disabled; it takes no tap), so it never comes in later and moves the screen. It turns active when the hold ends (at most `VOICE_CHECK_HOLD_MAX_MS`, 2 s, or `HEAR_HOLD_MS`, 1.5 s).
- It is hidden while the text shows for any reason (`muted`, `no_voice`, `error`, `blocked`, or the learner's own ask). Those states already offer their own action (Turn sound on, How to add a voice, Try again, Tap to hear; F-AUDIO-004 §3.8), and the text is already on screen.
- Why always, and not "after the first miss or after two replays" (the WO's suggestion, which left the choice to this spec):
  1. A link that only appears after a miss makes the learner pay a first-try miss, and stars, for a phone setting (§1.2). Anti-shame: a learner is never marked wrong for something that is not their reading.
  2. A learner who hears nothing may not tap the speaker at all, so a link that waits for two replays may never appear. Young learners in particular do not know a sound was supposed to play.
  3. A link that appears in the middle of a round moves the screen. The answers are held while a text may still come in, so that nothing moves under a finger (`settled`, `use-prompt-slot.ts:37-41, 89-90`; AMENDMENTS-TOUCH). A link that is there from the start never moves anything.
  4. WO-05's device check, "reach the text prompt within two taps", holds only if the link is already there: **Can't hear it?** (1), **Show the letters** (2).
- Cost: one more small control on every sound-only round, for learners who hear fine too. It is a ghost button, after the speaker caption, never the largest thing on the screen.

### 3.3 The sheet

- **Given** the link, **when** the learner taps it, **then** a bottom sheet opens, built like `VoiceHelpSheet` (`Modal`, the overlay scrim, `accessibilityViewIsModal`, `components/VoiceHelpSheet.tsx:24-57`):
  - a title row: the title **Can't hear it?** (the same words as the link), then the close button (`common.buttons.close`, an icon button at the end of the row, as in `VoiceHelpSheet.tsx:43-57`);
  - **one** line for this device (§3.4, §3.10); never the other devices' lines;
  - **Show the letters**: primary. It closes the sheet and asks the slot for the text in the order of §3.7. Not on a guidance-only sheet (the cue rule of §3.1; Discover, OD-CH3);
  - **Hear it** (the existing `learner.audio.hearIt.cta`): secondary (primary on a guidance-only sheet). It closes the sheet and plays the prompt once, through the same function as the speaker, so the learner can check at once after following the line (D3).
- **Width on wide windows** (owner decision 2026-11-24, mock MD6): from window class `regular` (600) this sheet and the one-section help sheet of §3.9 (`VoiceHelpSheet`) are capped at `layout.maxWidth.reading` (720) and centred at the bottom; they stay bottom sheets. Below `regular` they are full width, as today. `DisplaySheet` caps at the same width but becomes a centred dialog; these two do not.
- The scrim, the close button and the back (Android hardware back through `onRequestClose`) close the sheet and change nothing else. The scrim is not an accessibility element (unlike today's `VoiceHelpSheet.tsx:26-32`, which reads as a second Close button; CH-1a fixes both sheets).
- The sheet closes when the round changes: `CantHear` takes a `round` prop (the surface's round index or key), and a new value closes it, so **Show the letters** always acts on the round on screen.
- The sheet also closes when a text arrives while it is open (sound turned off, no Korean voice, a failed or blocked play): the panel then offers its own action, and the link is hidden (§3.2).
- Nothing is recorded: no answer, no attempt, no star, nothing stored; the one exception is the count of row CH-4 (OD-CH2 (b), owner decision 2026-11-24). Opening the sheet does not stop or pause anything (no clock runs on the surfaces of §3.1).
- Look: the paper surface and neutral tones of the help sheet; never `colors.feedback.danger`, and not the amber `colors.feedback.nudge` either (this is not a miss). No Hoya pose change.

### 3.4 Which device's line (D2)

- New pure module `logic/device-family.ts`: `deviceFamily({ os, userAgent, maxTouchPoints }): 'apple' | 'android' | 'computer'`.
  - Native: `os === 'ios'` gives `apple`, `os === 'android'` gives `android`.
  - Web (`os === 'web'`): the user-agent tests `installGuideVariant` already uses (`logic/pwa/install-guide.ts:25-27`, applied at `:41-42`): `iPhone|iPad|iPod`, or `Macintosh` with more than one touch point (iPadOS asks for the desktop site), gives `apple`; `Android` gives `android`; anything else, an empty user agent included, gives `computer`. The row moves these three regexes into `device-family.ts` and imports them back into `install-guide.ts`, so the two cannot drift; `installGuideVariant`'s results and tests do not change.
  - Any other `os` gives `computer`.
  - Known limit: a large Android tablet whose Chrome asks for the desktop site sends a desktop Linux user agent and gets the computer line (wireframe open question 4).
- `platform/device-family.ts`: `currentDeviceFamily()` = `deviceFamily({ os: Platform.OS, ...installEnv() })`. `installEnv()` already returns the user agent and touch points on the web (`platform/pwa.web.ts:56-66`) and `''` / `0` on native (`platform/pwa.ts:25`). Read once per sheet open; there is no stored value.
- The same family picks the one section of the "Add a Korean voice" sheet (§3.9).

### 3.5 `promptReducer` gets a `'show_text'` event

`PromptState` gains an optional `asked?: true` (the learner asked for the text). It is **absent** until `'show_text'` sets it, so `INITIAL_PROMPT_STATE` does not change and the exact `toEqual` checks of `logic/audio/__tests__/prompt-state.test.ts` (`:26`, `:31`, `:32`, `:36`, `:65`, `:86`, `:87`, `:107`, `:109`) stay as they are. `PromptEvent` gains `'show_text'`.

- `'show_text'`: `{ ...s, phase: 'text', asked: true }`. The reason is kept as it is (usually `null`). Sending it twice changes nothing.
- `'play'` (`:33-35`) builds its state with `...s` (today it builds `{ phase, reason, attempts }` from scratch and would drop `asked`). Without this, the sequence `'show_text'` → capability `none` (reason `no_voice`) → `'play'` → capability `ready` would hit the late clear (`:49-50`) and take the learner's text away.
- **The rule: a text the learner asked for stays until `'reset'`.** The existing "once shown in a round it stays" rule (F-AUDIO-004 §3.8) already covers every event but one, the late "no Korean voice" clear. That branch (`prompt-state.ts:46-51`) leaves an asked text up and only drops the `no_voice` reason: `s.asked ? { ...s, reason: null } : <today>`.
- Why a field and not a fifth `FallbackReason`: a successful play sets the reason to `null` (`:39`), and a later voice-list event can then turn `null` into `no_voice` and clear it (`:52-53`, then `:46-51`). A reason cannot survive that chain; a field can. A reason is also a failure kind with its own panel line, action and telemetry value (`fallbackAction`, `panelDetail`, `audio.fallback_shown`), and the learner's ask is not a failure.

Interaction with the existing phases and events (rows marked **new** change; the rest is today's behaviour, pinned by tests):

| State before | Event | State after | Panel shows |
|---|---|---|---|
| `idle` / `playing` / `ok`, reason `null` | `'show_text'` **new** | `text`, reason `null`, `asked` | the Korean (or the surface's text), "No sound? Read it here.", no reason line, no action |
| `text`, reason `muted` / `no_voice` / `error` / `blocked` | `'show_text'` **new** (not normally reachable: the link is hidden) | phase and reason kept, `asked` | as today for that reason |
| `text`, `asked` | `'play'` **new: keeps `asked`** | `text` (`:34`) | unchanged |
| `text`, `asked` | `{ result: 'played' }` | `text`, reason `null` (`:39`) | the text stays: the learner may still not hear it |
| `text`, `asked` | `{ result: 'unavailable' }` | `text`, reason `error` / `blocked` (`:42`) | that reason's line and action (Try again / Tap to hear), which are true |
| `text`, `asked` | `{ muted: true }` | `text`, reason `muted` (`:55`) | "Sound is off." with Turn sound on |
| `text`, `asked`, reason `muted` | `{ muted: false }` | `text`, reason `null` (`:56`) | the text stays |
| `text`, `asked` | capability `none` (no clip) | `text`, reason `no_voice` (`:52-53`) | "No Korean voice on this device." with How to add a voice |
| `text`, `asked`, reason `no_voice` | capability `ready` or clips **new** | `text`, reason `null` | **the text stays** (today, without `asked`, it would go back to `idle` / `ok`) |
| any | `'reset'` | `INITIAL_PROMPT_STATE` (no `asked`) | the next round starts as a sound-only round again |

The sheet and the link around these states: while the slot holds, the link is inactive (§3.2); when any text arrives with the sheet open, the sheet closes (§3.3).

How long it lasts: **one round** (WO-05: "that round's prompt state"). The next round opens sound-only with the link, so a learner who fixed the sound hears it again. The standing switch for learners who need the text every round is row CH-2 (OD-CH1, approved).

### 3.6 The view and the slot

- `promptPanelView` does not change its signature. With an asked text and reason `null`: `textShown` is true, `detail`, `actionLabel` and `helpLabel` are `null`, the heading is the text one ("Tap the letter for this sound", `prompt-view.ts:76`), and the speaker label and caption are as today.
- `fallbackVisible` (`:89-92`) stays false for an asked text with reason `null`, so `audio.fallback_shown` is **not** sent unless row CH-4 is built (OD-CH2).
- `shouldAutoReplay` (`:95-97`) stays true for an asked text: the 800 ms replay after a miss still plays, which helps a learner who has just turned the sound on and costs nothing otherwise.
- `usePromptSlot` (`components/use-prompt-slot.ts`):
  - option `cantHear?: boolean` (default `false`);
  - `slot.cantHear` = `cantHear && !view.textShown`; `slot.cantHearActive` = `slot.cantHear && settled`;
  - `slot.showLetters()` sends `'show_text'`;
  - `settled` (`:89`) is also true once the text was asked for: the text is already up, so nothing can come in above the answers, and they must not stay held while the voice check runs;
  - `reset()` (`:118-124`) is unchanged and clears `asked` through `'reset'`.
- Each surface of §3.1 passes `cantHear: true` only where the table says so (heard rounds only for `ReviewRounds` and the quest warm-up, whose slots also serve text rounds; Relaxed only for the Speed round; practice hosts only for Listen & Pick until CH-1e). It renders `<CantHear round={…} onShowLetters={…} onHear={hear} focusAfter={…} />` in its speaker row, or `<CantHear guidanceOnly …/>` on a cue round, and puts nothing new in its scoring (the hinted mark is CH-1f). Every surface already reads `slot.view.textShown` for its fallback (Match Sound and Listen & Pick for the prompt, Syllable Build for `voice`, `ReviewRounds` and the quest warm-up for the prompt line, the Speed round for `textFallback`), so an asked text takes the same path as today's `muted` text.
- Dictation (CH-1c) decides its opening itself (`dictation-chunk.tsx:109-115`, `logic/type-hangul/hear-mode.ts:37-47`). There, **Show the letters** sets the round's opening to `{ kind: 'see', reason: 'asked' }` (`HearSeeReason` gains `'asked'`, `hear-mode.ts:24`, with no reason line) and calls `slot.showLetters()`. The round becomes the `see` round that two failed plays already lead to (`afterFailedPlay`, `:45-47`).

### 3.7 Screen readers

- The link is a button whose accessible name is its visible words, "Can't hear it?" (WCAG 2.5.3). It has no hint. In focus order it comes after the speaker (and after Listen & Pick's Hear again) and before the answers. While inactive (§3.2) it is announced as disabled.
- When the sheet opens, focus moves to its title (a heading). The order is title, close button, line, then the two buttons. The scrim is not focusable (§3.3).
- The close button, the scrim and the back return focus to the link.
- **Show the letters**, in this order, so the letters are said **once** and nothing cuts them off:
  1. the sheet closes (on iOS, the next step waits for the `Modal`'s `onDismiss`, because `setAccessibilityFocus` does not reach the screen while the modal is still up);
  2. focus moves to the surface's focus target (§3.1, "Focus after Show the letters"; `focusForScreenReader`, `platform/screen-reader.ts:31-35`);
  3. one beat later (`motion.duration.slow`, the beat `TIP_AFTER_FOCUS_MS` uses in `screens/minigames/TraceControls.tsx:24`; AMENDMENTS-TRACE-IDLE TI-3b), `CantHear` calls `onShowLetters`, so the text enters the surface's existing polite live regions only after the focus readout (Listen & Pick's prompt region `:419`, the quest warm-up's `:406`, `PromptPanel`'s `:59`/`:80`); and on iOS, which has no live regions, `announceForScreenReader` (`platform/screen-reader.ts:42-49`) says the letters' text once.
  No `PromptPanel` change is needed. Where focus lands on the text itself (Dictation's `see` round), nothing is announced in addition.
- **Hear it**: the sheet closes, focus returns to the link, and the prompt plays only after the screen reader has said the link's name: `announceAndWait(cantHear.cta, gap)` (`platform/screen-reader.ts:60`; it resolves at once with no screen reader), the "announce, then play" order of F-CURR-001 D-1 S3b. A reader may say the name twice (the focus readout and the announcement); that is the price of never talking over the Korean (§3.13, the device check).
- VoiceOver's own speech normally goes on in silent mode, so a VoiceOver user can use all of this (checked on a device, §3.13).
- Never assertive; never a focus jump that the learner did not ask for.

### 3.8 The web

- Browsers do not report a muted tab, the system volume or the output device. `speechSynthesis` and the Web Audio clip player (`platform/audio-player.web.ts`) report a normal end, so the slot goes `ok`, as on a silent iPhone. The entry point is the same on the web.
- The line comes from the user agent (§3.4):
  - an iPhone or iPad browser, the installed PWA included, gets the **Apple** line. Whether the silent switch also mutes Web Audio clips and the browser voice there is unverified (F-AUDIO-004 §5 device matrix, "iPhone Safari, installed PWA"); the line is right either way, because a learner on an iPhone may have silent mode on;
  - an Android browser gets the **Android** line;
  - a computer gets the **computer** line. It says "this page", not "this tab", because an installed desktop PWA has no tab (§3.10).
- The page does **not** set `navigator.audioSession.type = 'playback'` (Safari 17 and later). That is the web's way to play through the silent switch, and OD-R6 rules it out as it rules out `PLAY_IN_SILENT_MODE = true`.
- A sound the browser blocked before any tap is already detected (`blocked`, "Tap to hear", F-AUDIO-004 §3.6, §3.8); the link is hidden then (§3.2).

### 3.9 The "Add a Korean voice" sheet shows one device (P2-22)

- `voiceHelpContent(copy, family?)` (`logic/audio/voice-help.ts:59-66`): with a `family` it returns **one** section, that family's (§3.4); without one it returns the three of `SECTION_ORDER` (`:56`) as today, so `logic/audio/__tests__/voice-help.test.ts` (`:16`, `:109`) needs no rewrite. The title, note and footer do not change. `VoiceHelpSheet` (`:22`) passes `currentDeviceFamily()`. Its two callers (Profile's Sound card, and "How to add a voice" on a `no_voice` panel) need no change.
- Its scrim leaves the accessibility tree and focus starts on its title (§3.3, §3.7), as for the new sheet.
- This also does WO-37 row NB-7 (`docs/roadmap/review-2026-11/phase-5-native-a11y.md`: "filter by `Platform.OS` on native, can share WO-05's PR"), on the web too. That row is done when CH-1a merges; its spec, when it is written, cites this one.
- `design/components/VoiceHelp/spec.md` §2 changes with it (row CH-0b).

### 3.10 Strings (`packages/i18n/src/messages/en/learner.ts`, block `learner.audio`, `:1115`)

| Key | English | Row |
|---|---|---|
| `learner.audio.cantHear.cta` | Can't hear it? | CH-1a |
| `learner.audio.cantHear.lines.apple` | Turn off silent mode. Then turn the volume up. | CH-1a |
| `learner.audio.cantHear.lines.android` | Turn up the media volume with the volume buttons. | CH-1a |
| `learner.audio.cantHear.lines.computer` | Turn the volume up. Check that this page is not muted. | CH-1a |
| `learner.audio.cantHear.showLetters.cta` | Show the letters | CH-1a |
| `learner.audio.alwaysShowLetters` | Always show the letters | CH-2 |

- Reused, unchanged: `learner.audio.hearIt.cta` "Hear it" (`:1135`), `learner.audio.readHere` "No sound? Read it here." (`:1116`), `common.buttons.close`. The sheet's title is `cantHear.cta`.
- The Apple line does not name a switch: recent iPhones set silent mode with the Action button or Control Center, and most iPads have no switch.
- English is CEFR Pre-A1 and short (CLAUDE.md §1). "Silent mode", "media volume" and "muted" are the words the phones' own settings use.
- Note for translators: "letters" means written characters of any script. In Syllable Build, Show the letters shows the romanization (Latin letters), so the es and ko values must not say "Hangul letters".
- Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:31-35`; a missing key fails `es-coverage.ts` / `ko-coverage.ts`). The R8 routine runs only after a merge to `main`, so the PR that adds a key (CH-1a, CH-2) drafts its es and ko values itself, has them reviewed under F-I18N-001 §3.10 (the two-lens review) and re-signs the ledger, in the same PR. This spec writes English only.
- Telemetry (CH-4): no new string.

### 3.11 Touch, layout and anti-shame

- The link is `Button tone="ghost" size="sm"`, which is `touchTarget.min` (64) tall (`packages/design-system/src/components/Button/Button.tsx:47`). The sheet's buttons are `md`, full width on a phone.
- The speaker row wraps: at 200 % text on a 320 x 568 screen the link drops under the speaker caption and stays on screen with the prompt zone. In the side-by-side layout (`GameColumns`, F-LAYOUT-001) it stays in the prompt column.
- The tiles never move because of the link (it is there from the start, inactive while the round holds). When the text comes in after **Show the letters**, the answers move once, at the learner's own request, the same as the shipped text fallback.
- No danger colour, no amber, no X anywhere on the link or the sheet; no meter changes.

### 3.12 Checks (row CH-1e; OD-CH6 (c), owner decision 2026-11-24)

What a Check shows after Show the letters, by OD-CH6 (c) (owner decision 2026-11-24):

- Where the options **hold or hide** their romanization — the quest Check (AU-8, `checkHoldsRomanization`, `logic/listen-pick-flow.ts:273-275`), the Hangul Check and the Stage Check with their "hide the romanization" switch on (`RomanizationModeOverride mode="tap"`, `StageReviewScreen.tsx:190`, `StageCheckScreen.tsx:234`) — the asked text is the **romanization only**, with no Hangul. The round becomes a decoding item: read the sound, find its spelling. That is how the Decoding Sprint and Syllable Build already fall back (`screens/decode-sprint/SprintPick.tsx:16-19`). `promptView` (`listen-pick-flow.ts:213-227`) gains the asked case; `ReviewRounds` the same for Stage Check heard rounds.
- Where the options show their romanization (the Cell Check; the Hangul Check and Stage Check with the switch off), no text keeps the round a reading item. The asked text is the surface's own, as with Sound off today (AD13).
- The answer counts toward the Check as today (stars, the Check's result). With OD-CH7 (b), a right answer reaches the memory store as hinted. The progress summaries still cannot tell an asked answer from a heard one (`stage1Anchor`, `logic/sync/summarize.ts:180`; F-AUDIO-004 §8 item 9 stays the follow-up).
- The cue rule (§3.1) applies in Checks as in practice.

### 3.13 The hinted mark (row CH-1f; OD-CH7 (b), owner decision 2026-11-24)

By OD-CH7 (b) (owner decision 2026-11-24):

- **Given** the learner asked for the text in a round, **when** their first answer of that round is right, **then** it reaches the memory store as a **hinted** right answer (no promotion, no demotion; F-CURR-002 §4.3). A wrong first answer stays a plain miss, the existing rule for help shown (`screens/minigames/MinigameScreen.tsx:191-199`, row CM-3A S6). Stars do not change (`correct` reaches the run store as it is, `:193`).
- Through the channels that exist: `AnswerMeta.hinted` (`screens/minigames/host.ts:13-21`) for the host games, the fourth argument of `answerRound` (`store/quest-run-store.ts:92`) for Match Sound, `RoundAnswer.hinted` (`logic/reviews/daily-review.ts:125-128`) for `ReviewRounds`, the warm-up's first-try answer, Syllable Build's `hinted` (`logic/syllable-build/flow.ts:75`, which today counts a reveal only with `voice` true) and Type Hangul's `hinted` (`screens/minigames/TypeHangulGame.tsx:125-127`, which today counts it only in `hear` mode, so an asked `see` round would record an un-hinted right answer).
- Text from Sound off, no Korean voice, a failed or blocked play, or the CH-2 switch stays unmarked, as today: those are modes of the device, not help asked for in the round.

### 3.14 [On device, owner]

- iPhone, native build, silent mode on: open Stage 1 q1 and go to Match Sound. Reach the text prompt in two taps (**Can't hear it?**, **Show the letters**) and answer the round. The sheet shows the Apple line only. (WO-05 acceptance criterion.)
- The same in Safari and in the installed PWA on an iPhone (Apple line). Also note whether the clips and the voice are silent with the switch on: this closes the F-AUDIO-004 §5 "silent-switch behaviour of TTS and of clips" item.
- Android phone, media volume at zero: Android line; **Hear it** plays the prompt once the volume is up.
- The volume buttons may change the ringer rather than the media volume (iPhone "Change with Buttons" off or on; Android before 9). Check that following each line brings the sound back; if not, the line is changed by a follow-up string PR.
- Desktop Chrome with the tab muted, and an installed desktop PWA with the site muted: computer line.
- VoiceOver (with silent mode on) and TalkBack: the link and the sheet are read; after **Show the letters** the letters are read once and focus is on the §3.1 focus target; after **Hear it** the Korean is not talked over.
- "Add a Korean voice" from Profile on each device: one section only.

## 4. Out of scope

- Playing through the silent switch, on native or on the web (OD-R6); any way to detect the switch, the volume or a muted tab; a new native module.
- Keeping the asked text for the rest of a step (OD-CH1 option (d), not chosen); the standing switch is CH-2.
- The clocked drills, the level check and the presenter (§3.1, OD-CH4, OD-CH5).
- Changing what Sound off or no Korean voice shows in a Check today (the Hangul and romanization of the prompt, AD13). §3.12 changes only the asked text; aligning the Sound-off text in Checks is assessment-validity work for WO-10 and WO-11 (OD-R1).
- Telling an asked answer apart in the progress summaries and reports (F-AUDIO-004 §8 item 9, an `assist` meta on `answerRound`).
- iOS `MixWithOthers` letting music cover the prompt (`audio-player.ts:307`): WO-37 row NB-6.
- Turning sound back on from inside the sheet: muting is the app's Sound switch (Profile, `device:audio`), and the `muted` panel already offers Turn sound on.

## 5. UI sketch

- Wireframe: `design/wireframes/minigame/audio-cant-hear.md` (this row, CH-0; revised with this revision). It extends `design/wireframes/minigame/audio-fallback.md` (W1-W4 Match Sound states, W7 the help sheet, W8 the state machine, W11 Dictation) and `design/wireframes/minigame/shell.md`.
- Mock: row CH-0b adds the link (active and inactive), the sheet (three device lines; the guidance-only sheet; phone and tablet, 200 % text), the one-section help sheet and the CH-2 switch on Profile's Sound card, in `design/screens/minigame-variety/` (or a new `design/screens/audio-cant-hear/`, the mock row decides), a component spec `design/components/CantHear/spec.md` and a revision of `design/components/VoiceHelp/spec.md` §2, approved by the multi-agent review (CLAUDE.md §5).

## 6. Tests

Unit (`apps/mobile/src/logic/**/__tests__/`, `src/platform/**/__tests__/`; the `unit` vitest project):

1. `promptReducer`: `'show_text'` from `idle`, `playing` and `ok` gives `phase: 'text'`, `asked: true`, reason `null`; sending it twice is the same; `INITIAL_PROMPT_STATE` has no `asked`.
2. Every row of the §3.5 table after `'show_text'`: `'play'` (keeps `asked`), `played`, `unavailable` (`error`, `blocked`), `muted` true then false, capability `none`, capability `ready` with reason `no_voice` (**text stays**, reason `null`), `'reset'` (back to `INITIAL_PROMPT_STATE`). Plus the sequence `'show_text'` → capability `none` → `'play'` → capability `ready`: the text stays.
3. Without `asked`, the late `no_voice` clear still works as today; the nine exact `toEqual` checks of `prompt-state.test.ts` are not edited.
4. `promptPanelView` on an asked text: `textShown`, no detail, no action, no help, the text heading; `fallbackVisible` false; `shouldAutoReplay` true.
5. `deviceFamily`, table-driven: native `ios`, `android`, another `os`; web user agents of an iPhone, an iPad (`iPad` token), iPadOS asking for the desktop site (`Macintosh`, 5 touch points), a Mac (0 and 1 touch points), an Android phone and tablet, an Android tablet asking for the desktop site (computer, the known limit), Windows, Linux, ChromeOS, and an empty string.
6. `installGuideVariant`: its existing tests unchanged and green after the regexes move.
7. `voiceHelpContent(copy, family)`: exactly one section with that family's id for each family; title, note and footer unchanged; `voiceHelpContent(copy)` still returns all three (the existing tests).
8. `cantHearLine(family, copy)` (in `logic/audio/cant-hear.ts`) picks the family's line, for each family.
9. `platform/__tests__/device-family.test.ts`: `currentDeviceFamily()` with `Platform.OS` and `installEnv()` mocked, for `ios`, `android` and `web` (an iPhone and a Windows user agent). The platform lane's 70 % applies.

Render (`apps/mobile/src/screens/**/__tests__/`, the `render` vitest project; `platform/device-family` is mocked with `vi.mock` in every render test that needs a family, because react-native resolves to react-native-web there and every family would read `computer`):

10. `screens/__tests__/prompt-slot-cant-hear.test.tsx` (the `Probe` pattern of `prompt-slot-settled.test.tsx`): `slot.cantHear` is true while no text shows and false in each text state; `cantHearActive` is false while the voice check holds; `showLetters()` makes `view.textShown` true and `settled` true while `voiceCheckPending` is still true; `reset()` brings back the link.
11. Match Sound, a play that ends `played`: the link is in the speaker row on round 1 before any tap; inactive while the slot holds, then active. Tap it: the sheet shows the title, the close button, **one** line (each family mocked in turn), Show the letters and Hear it; the scrim is not an accessibility element.
12. Show the letters: the sheet closes; focus moves to the speaker; after `motion.duration.slow` the panel shows the letter's name with its romanization and "No sound? Read it here." (not before); the heading is the text heading; the link is gone; with the iOS path mocked, `announceForScreenReader` is called once with the letters' text. A right tap gives `answerRound(…, true)` once. The next round opens with no text and the link back.
13. Sound off (`muted`), no Korean voice (`no_voice`), a failed play (`error`) and a blocked play (`blocked`): no link. With the sheet open, a capability `none` event or a mute closes it.
14. Hear it: the sheet closes, focus returns to the link, `announceAndWait` resolves, then the prompt plays once (`playJamo` called once more); no `answerRound`.
15. A wrong tap after Show the letters: the tile takes the wrong state (never `colors.feedback.danger`) and the 800 ms replay is scheduled.
16. The round changes while the sheet is open (a new `round` prop): the sheet closes.
17. `VoiceHelpSheet` renders exactly one `voice-help-sheet-<family>` section, and its scrim is not an accessibility element.
18. CH-1b, one test per surface: the link is shown on a sound-only round and leads to that surface's text and focus target; the cue rule gives a guidance-only sheet on Listen & Pick's spelling round, a Daily Review heard round with a `cue` and a warm-up round with a `cue`; no link for Listen & Pick in `check` and `review` hosts and for `RoundView` in Stage Check and Cell Check (until CH-1e); `RoundView` in `WeekDropScreen` has it; Syllable Build passes `voice: false` after Show the letters; the Speed round shows the link in Relaxed mode and not in Challenge mode; no link on the text rounds of `ReviewRounds` and the warm-up.
19. CH-1c: Dictation `hear` round, Show the letters gives the `see` round with no reason line and focus on its word; the link is inactive during the `hold` opening; `hearOpening` and `afterFailedPlay` are unchanged.
20. CH-1d: Discover shows the guidance-only link once per page, hidden while its status panel shows a reason.
21. CH-1e: in a quest Check and in the Hangul Check and Stage Check with the switch on, the asked text is the romanization only (no Hangul is rendered); with the switch off, the surface's own text.
22. CH-1f: for each channel of §3.13, a right first answer after the ask is hinted, a wrong one is a plain miss, and an answer with Sound off is not hinted.
23. CH-2: `DeviceAudioPrefsSchema` parses a stored value without `showLetters` as `false` (`packages/content-schema`, 100 %); with the switch on, every opted-in prompt opens with its text, unmarked, and the sound still plays; the switch persists through `device:audio`.
24. CH-4: the Worker rule keeps only `{ source, reason }` for `audio.fallback_shown` and never a profile id (backend test, Worker first); the client sends `reason: 'asked'` once per session and source.

e2e (web, `apps/mobile/e2e/web/cant-hear.spec.ts`; the shared engine answers each utterance, so a play ends `played`): Match Sound in desktop Chromium shows the computer line, and an iPhone user-agent context shows the Apple line; the text prompt is reached in two taps. The Playwright shards run on `main` pushes only (owner decision 2026-11-18, `.github/workflows/web-app.yml`), so the CH-1a PR runs this suite locally and pastes the output.

Coverage: `apps/mobile` business logic stays at or above 90 %, the platform lane at or above 70 %, `packages/content-schema` at 100 %, `packages/backend` at or above 90 %.

## 7. Rollout

Next release, no switch: the link only adds a way out, and nothing changes until it is tapped. Effects to watch: if CH-4 is built (OD-CH2), `audio.fallback_shown { source, reason: 'asked' }` counts how often learners cannot hear, per surface (counts only, once per session, source and reason, as row 19 of `docs/roadmap/TELEMETRY-NAMES-2.md`, and with no profile id); otherwise nothing new is measured.

## 8. Dependencies

- OD-R6 (approved 2026-11-22). No other spec blocks this one.
- Shared files (`docs/roadmap/review-2026-11/README.md` §6): `MatchSoundGame.tsx` is shared with WO-04 (AF-4), WO-06 and WO-41; `ListenPickGame.tsx` and the other game files of §3.1 are likely in WO-04's AF-4 ("the rest of the games"); `packages/i18n/src/messages/en/learner.ts` is shared with almost every UI WO. Merge one at a time and rebase mechanically. WO-04's `useAnswerAnnouncement` (F-A11Y-001) may later take over the `announceForScreenReader` call of §3.7; the behaviour (said once) stays.
- WO-37 NB-7 is done by CH-1a (§3.9).
- `PromptPanel`, `VoiceHelpSheet` and `usePromptSlot` exist (F-AUDIO-004 A-5a, A-4b, A-12); `focusForScreenReader`, `announceForScreenReader` and `announceAndWait` exist.
- **The level check, left to a follow-up (OD-CH5, approved).** Today a learner on silent passes the warm-up's sound check (`WarmupScreen.tsx:47` dispatches `warmupAudio` with `played`), so the run keeps its listening items and the learner guesses them, and is placed by guessing. The follow-up is an amendment of F-PLC-001 that puts the link on the warm-up only, where Show the letters dispatches `warmupAudio` with `muted` and so gives the run's existing sound-off draw (`logic/placement/flow.ts:113, 303`). It is not in this spec's rows; the owner schedules it (the INBOX form of `docs/roadmap/review-2026-11/README.md` §8).

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| CH-0 | Opus 5.5 | This spec and the wireframe `design/wireframes/minigame/audio-cant-hear.md`; the WO's citations re-read (§1.1); revision 2 adjudicates the review (§12) | — | OD-R6 | `docs/audio-cant-hear-spec` |
| CH-0b | Opus 5.5 | Mock of the link (active, inactive), the sheet (three device lines; guidance-only; phone, tablet landscape, 200 % text at 320 x 568), the one-section help sheet and the CH-2 switch; `design/components/CantHear/spec.md`; `design/components/VoiceHelp/spec.md` §2 revised; multi-agent review | — | this spec `ready` for CH-0b | `design/audio-cant-hear` |
| CH-1a | Sonnet 5.5 | §3.5 reducer (`asked?`, `'show_text'`, `'play'` spreads); §3.6 slot (`cantHear`, `cantHearActive`, `showLetters`, `settled`); §3.4 `logic/device-family.ts`, `platform/device-family.ts`, the install-guide regexes moved; `logic/audio/cant-hear.ts`; `components/CantHear.tsx` (link, sheet, `round` prop, guidance-only, the §3.7 order); Match Sound; §3.9 the one-section help sheet and both scrims (P2-22, NB-7); §3.10 strings en + es + ko (drafted and reviewed in the PR) | 1–17; e2e | CH-0b | `feat/audio-cant-hear` |
| CH-1b | Sonnet 5.5 | §3.1 practice surfaces: Listen & Pick in `quest`, `vocab` and `preview` hosts (spelling round guidance-only); `RoundView` `cantHear` prop, passed by the Daily Review, Keep going and This week in Korea (cue rule); the quest warm-up and Try these again (heard rounds; cue rule); Syllable Build (quest step and review round, not the sprint); the Speed round's sound question in Relaxed mode (`VocabQuestionView` `cantHear` prop) | 18 | CH-1a | `feat/audio-cant-hear-surfaces` |
| CH-1c | Sonnet 5.5 | Dictation `hear`: Show the letters gives the `see` round (`HearSeeReason` `'asked'`); the link inactive during `hold` | 19 | CH-1a | `feat/audio-cant-hear-dictation` |
| CH-1d | Sonnet 5.5 | The guidance-only link and sheet on Discover, once per page under the card's buttons (OD-CH3, approved) | 20 | CH-1a | `feat/audio-cant-hear-discover` |
| CH-1e | Sonnet 5.5 | **Ready (OD-CH6 (c), owner decision 2026-11-24).** §3.12: Listen & Pick in `check` and `review` hosts, `RoundView` in Stage Check and Cell Check; the romanization-only asked text where the options hold or hide their romanization (`listen-pick-flow.ts` `promptView`, `ReviewRounds`) | 21 | CH-1b, OD-CH6 | `feat/audio-cant-hear-checks` |
| CH-1f | Sonnet 5.5 | **Ready (OD-CH7 (b), owner decision 2026-11-24).** §3.13: the hinted mark through each channel | 22 | CH-1a – CH-1c (and CH-1e if built), OD-CH7 | `feat/audio-cant-hear-hinted` |
| CH-2 | Sonnet 5.5 | "Always show the letters", a device switch on Profile's Sound card under the Sound switch (OD-CH1, approved): `DeviceAudioPrefsSchema` (`packages/content-schema/src/schemas/audio.ts:22`) gains `showLetters` (default `false`), `audio-store` keeps it with `muted` in `device:audio`, and every opted-in prompt opens with its text (proactively, like Sound off, unmarked, the sound still plays; the cue rule and §3.12 apply); string `learner.audio.alwaysShowLetters` | 23 | CH-1b | `feat/audio-show-letters-setting` |
| CH-3 | Sonnet 5.5 | "Amended 2026-11-xx by AMENDMENTS-AUDIO-CANT-HEAR" lines in F-AUDIO-004, F-001, F-QUEST-002, F-CURR-002, F-VOC-004; a W12 pointer in `design/wireframes/minigame/audio-fallback.md`; the `docs/specs/README.md` index line; status `shipped` for the built rows | — | CH-1a – CH-1d, CH-2 (and CH-1e, CH-1f, CH-4 if built) | `docs/audio-cant-hear-amended` |
| CH-4 | Sonnet 5.5 | **Ready (OD-CH2 (b), owner decision 2026-11-24).** Worker first: a payload rule for `audio.fallback_shown` keeping only `{ source, reason }` and never a profile id (like `audio.source_summary`, `packages/backend/src/lib/server-events.ts:346-353`; ordinary events keep the profile id, `:433`); then the client sends `reason: 'asked'` through a `FallbackShownReason = FallbackReason \| 'asked'` used only by the telemetry types (`logic/audio/controller.ts:193, 248`, `platform/audio.ts:323-325`, `platform/audio.web.ts:739-741`, `test-support/audio-rig.ts:62`), not by a wider `FallbackReason`; row 19 of `TELEMETRY-NAMES-2.md` | 24 | CH-1a, OD-CH2 | `feat/audio-cant-hear-telemetry` |

One commit = test + implementation. Estimates: CH-0b 0.5d, CH-1a 1d, CH-1b 0.75d, CH-1c 0.25d, CH-1d 0.25d, CH-1e 0.5d, CH-1f 0.5d, CH-2 0.5d, CH-4 0.25d.

## 10. Departures from WO-05 and owner decisions

**Owner decision 2026-11-23** (in session): departures D1, D2 and D3 approved; OD-CH1 to OD-CH6 approved as recommended in revision 1. The review of 2026-11-23 (§12) then re-opened OD-CH2 and OD-CH6 and added OD-CH7; those three were answered by the owner on 2026-11-24 (§11), and every row they gate is `ready`.

- **D1 — when the link shows: always** (owner decision 2026-11-23: approved), on a sound-only round while no text is up (§3.2). WO-05 suggested "after the first miss or after two replays" and left the choice to this spec. Reasons: a miss-gated link charges a star for a phone setting; a learner who hears nothing may never replay; a link that appears mid-round moves the screen; and the WO's own "two taps" check needs it.
- **D2 — the device line is chosen by device family, not by `Platform.OS` alone** (owner decision 2026-11-23: approved; §3.4). The WO says to filter by `Platform.OS` "the same way as `voice-help.ts:56`". But `:56` filters nothing (§1.1, row 6), and `Platform.OS` is `'web'` in every browser, so in the web PWA an iPhone would get the computer line. Native still uses `Platform.OS`; the web uses the user-agent tests the install guide already uses. The WO's goal, only this device's line, is kept.
- **D3 — the sheet also has Hear it** (owner decision 2026-11-23: approved), an existing string, so the learner can check the sound right after following the line. WO-05 names only the line and Show the letters.

## 11. Owner decisions (each gates only the rows named)

- **OD-CH1 — remember Show the letters beyond the round?** **Owner decision 2026-11-23: (b), approved as recommended → row CH-2.** Options were: (a) no, one round, as WO-05 describes; (b) a saved **device** switch, "Always show the letters", on Profile's Sound card; (c) a saved **per-profile** setting (the profile record, its storage and sync); (d) keep the asked text for the rest of the step, in memory (added by the review, for the record; it spares a deaf learner the taps within one step only). Trade-off of (b), recorded at review: a device switch applies to every learner on the device, a hearing sibling included (they still hear the sound, but their listening rounds become reading rounds); (c) would fit one learner, at the cost of the profile record and sync. Mute and the Display settings are already per device (AMENDMENTS-DISPLAY-NAV). The recommendation is unchanged: (b).
- **OD-CH2 — count the learner's ask? Owner decision 2026-11-24: (b), Worker rule first, as recommended; `audio.fallback_shown` keeps only { source, reason } and no profile id → row CH-4.** (Re-opened by the review of 2026-11-23.) Revision 1 recommended reason `'asked'` on `audio.fallback_shown` with no Worker change, and the owner approved that. The review found that an ordinary event keeps its profile id (`server-events.ts:433`), so `'asked'` on a child's profile is an inferred hearing signal. Options: (a) as approved in revision 1: `'asked'` sent, the profile id kept; (b) Worker first: a payload rule for `audio.fallback_shown` that keeps only `{ source, reason }` and never a profile id, as `audio.source_summary` already does (`:346-353`), shipped before the client sends `'asked'`; this also drops the profile id from today's `muted` / `no_voice` / `error` / `blocked` events of that name, which TELEMETRY-NAMES-2 row 19 already describes as counts; (c) no telemetry. **Recommendation: (b).** Gates CH-4.
- **OD-CH3 — a guidance-only link on Discover?** **Owner decision 2026-11-23: yes, on Discover only, approved as recommended → row CH-1d.** The cue rule of §3.1 is a different case (sound-only rounds whose Korean is the answer), decided by the review, not an extension of this decision to text-on-screen surfaces.
- **OD-CH4 — the clocked drills** (the Speed round in Challenge mode; the Decoding Sprint drill and probe, and the sprint's Syllable Build rounds). **Owner decision 2026-11-23: not now, approved as recommended.** Options recorded at review: (a) not now; (b) the link, with the sheet pausing the session clock through the screen's existing Pause (the Decoding Sprint and Challenge mode both have one) and resuming on close; (c) a one-tap link in clocked drills that shows the letters without a sheet. The Decoding Sprint already has a romanization prompt and a `heard` flag for no voice (`SprintPick.tsx:16-19, 72`), so (b) or (c) would be small there. The cost of (a): a learner on silent guesses in the clocked drills; the Relaxed Speed round and every untimed game have the link. Recommendation unchanged: (a); revisit with the CH-4 counts.
- **OD-CH5 — the level check.** **Owner decision 2026-11-23: a later amendment of F-PLC-001, approved as recommended.** The follow-up and the cost of waiting are in §8.
- **OD-CH6 — the link in Checks. Owner decision 2026-11-24: (c), as recommended → row CH-1e.** (Re-opened by the review of 2026-11-23.) Revision 1 recommended the link with the surface's own text, recorded as with Sound off today (AD13), and the owner approved that. The review found that the asked text then prints the prompt's Hangul with its romanization (`listen-pick-flow.ts:213-227`), so in a Check whose options hold their romanization (AU-8) the round becomes shape matching, and the Hangul Check feeds the parent-facing `stage1Anchor`. Options: (a) as approved in revision 1: the link, the surface's own text; (b) no link in Checks; (c) the link, where the options hold or hide their romanization the asked text is the romanization only (a decoding item, as `SprintPick` already does), elsewhere the surface's own text, and with OD-CH7 (b) a right answer reaches memory as hinted (§3.12). **Recommendation: (c).** Gates CH-1e. Until CH-1e lands, Checks have no link (CH-1b leaves the `check` and `review` hosts and Stage and Cell Check out).
- **OD-CH7 — does an answer given after Show the letters count as help? Owner decision 2026-11-24: (b), as recommended → row CH-1f.** (Added by the review of 2026-11-23.) Show the letters is a cheaper hint than the games' own: Syllable Build counts its reveal as a hint only with `voice` true (`logic/syllable-build/flow.ts:75`), and Type Hangul counts its hint only in `hear` mode (`TypeHangulGame.tsx:125-127`), so an asked round would record an un-hinted right answer. Options: (a) no mark, as with Sound off today: an asked shape match can promote memory; (b) a right first answer after the ask reaches the memory store as hinted (no promotion, no demotion), a wrong one stays a plain miss (the existing rule for help shown), stars unchanged, and text from Sound off, no voice or the CH-2 switch stays unmarked (§3.13); (c) mark every text-shown answer, Sound off included (changes the shipped AD13 behaviour; outside this amendment). **Recommendation: (b).** Gates CH-1f. Until CH-1f lands, an asked answer is recorded as with Sound off today.
- **The CH-0b design-pass questions (CH-Q1 to CH-Q6, `design/screens/audio-cant-hear/README.md` "Open questions"). Owner decision 2026-11-24: all as recommended.** They gate no row.
  - **CH-Q1 — a glyph on the link?** No: the "Can't hear it?" link is words only (MD3).
  - **CH-Q2 — the sheets' width on wide windows?** Both sheets are capped at 720 px (`layout.maxWidth.reading`) from window class `regular`, centred at the bottom (§3.3; MD6). CH-1a builds both sheets capped.
  - **CH-Q3 — tablets that ask for the desktop site?** Accepted: they get the computer line, which is still true there (§3.4, §3.10).
  - **CH-Q4, CH-Q5, CH-Q6** stay notes, as in the README: headphones paired elsewhere are not named; "Turn off silent mode" is judged by device check 3.14; the double "On" of the shipped Sound switch goes to CH-2.

## 12. Review log

- 2026-11-23, multi-agent review of revision 1 (two lenses: code truth; charter and learner). Both verdicts "ready after fixes"; D1–D3, anti-shame, copy level, touch targets and the wireframe's sections passed. Adjudicated in revision 2:
  - **Fixed, majors (code truth):** test 9 was in `components/__tests__`, which no vitest project runs → `screens/__tests__/prompt-slot-cant-hear.test.tsx` (test 10). `'play'` (`prompt-state.ts:34`) dropped `asked`, and `asked: false` in `INITIAL_PROMPT_STATE` would break nine exact `toEqual` checks → `asked?: true`, absent until set; `'play'` spreads `...s`; the sequence test added (§3.5, tests 1–3). The "text enters a beat after focus" order could not be built inside `PromptPanel` → the beat is in `CantHear`: focus first, then `'show_text'` (§3.7, from the charter lens). Daily Review heard spelling rounds and warm-up syllable rounds print the exact right option → decided by the cue rule (§3.1): guidance only where a cue exists, the surface's text with the OD-CH7 mark where none does.
  - **Fixed, majors (charter):** Checks → OD-CH6 re-opened with option (c), recommended, and §3.12, row CH-1e. The hidden hint decision → OD-CH7 (new), §3.13, row CH-1f. "Said once" → the §3.7 order, the per-surface focus targets (§3.1 column), and iOS waiting for the modal's `onDismiss`. OD-CH1 / story 2 → CH-2 is a built row (the owner approved (b)); the shared-device trade-off and option (d) are recorded; story 2 names the switch.
  - **Fixed, minors:** `WeekDropScreen` added and the Stage and Cell Check `RoundView`s tied to the same prop; `cantHear` only on heard rounds; the Speed round's Relaxed rule named (`cantHear={mode === 'relaxed'}`). `voiceHelpContent`'s `family` is optional, so its tests stand. The OD-CH2 profile-id finding → OD-CH2 re-opened, CH-4 Worker first, the client typing sites listed, `FallbackReason` not widened. The round-change close has a mechanism (`round` prop). `platform/device-family.ts` has its test (test 9), and render tests mock the family. es and ko are drafted in the adding PR, because R8 runs only after a merge (§3.10). Both sheets' scrims leave the accessibility tree, focus starts on the title, and the close button's place is stated (§3.3). Hear it waits for the readout (`announceAndWait`, §3.7). Loading: the link is inactive while the round holds, and an open sheet closes when a text arrives (§3.2, §3.3, §3.5). The computer line says "this page" (an installed PWA has no tab); a §3.14 check covers volume buttons that change the ringer; the Android-tablet desktop user agent is named as a limit; a translator note covers Syllable Build. "Nothing is recorded" now names the CH-4 exception.
  - **Kept:** OD-CH4 "not now" (the owner approved it; the review's options (b) pause the clock and (c) one-tap are recorded with the cost of waiting). OD-CH5 as a later F-PLC-001 amendment (approved): §8 names the follow-up and its cost instead of adding a row here. D1–D3 unchanged.
  - **Moved:** aligning the Sound-off text in Checks with §3.12 → WO-10 / WO-11 (§4). Telling asked answers apart in summaries → F-AUDIO-004 §8 item 9 (§4). The `speaker-off` glyph on the link and the Android-tablet case → the mock row's open questions (wireframe).
