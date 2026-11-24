# AMENDMENTS-AUDIO-CANT-HEAR — a way out when the sound does not reach the learner

Status: draft (revision 1, 2026-11-23; written for work order WO-05 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row CH-0, on main `e72336a7d`; the WO was written on `d5ba0217c`). Built on owner decision **OD-R6** (approved 2026-11-22, `docs/roadmap/review-2026-11/README.md` §4): a play the learner taps does **not** play through the iOS silent switch (the 2026-10-10 decision stays); the app adds guidance and **Show the letters** instead. Waiting for: the multi-agent review (§12), owner decisions OD-CH1 to OD-CH6 (§11) and the owner's acceptance of departures D1 to D3 (§10).

**Amends**: F-AUDIO-004 §3.8 (visible text fallback: a third way in, the learner's own ask, and the one text the "no Korean voice" exception never takes back) and §8 item 3 (the silent-switch open question: closed by OD-R6 and this hint) · F-001 §3.3 (the "Revised 2026-10-10" text-prompt paragraph: the learner can ask for the text) · F-QUEST-002 §3.10 (Listen & Pick: the entry point) · F-CURR-002 §4.5 (review and warm-up rounds), §7.1 F2 (Dictation's `see` round) and F3 (Syllable Build) · F-VOC-004 (the Speed round's sound question, Relaxed mode) · `design/components/VoiceHelp/spec.md` §2 (the help sheet shows this device's steps only) · tag **[CH]**
**Not amended**: `PLAY_IN_SILENT_MODE` (`apps/mobile/src/config/audio.ts:10`) and OD-R6 itself. `AMENDMENTS-AUDIO-CLIPS.md`: the WO allows a section there; this is a separate file because (1) that amendment is about *what* the voice says and how the clips are made (Part A jamo voice, Part B clips), while this one changes the fallback UI that F-AUDIO-004 §3.8 owns; (2) it is `ready` with rows still open (AC-13 native clips, and clips held for a later round) and its own review log, and six PRs edited it this month (#1016, #1025, #1030, #1031, #1032, #1038), so a new section would collide with that work; (3) the CH rows and OD-CH decisions read cleanly on their own. No new native module, and nothing tries to detect the silent switch or a muted tab.
**Scope**: `apps/mobile/src/logic/audio/prompt-state.ts`, `logic/audio/voice-help.ts`, `logic/device-family.ts` (new), `logic/audio/cant-hear.ts` (new), `logic/pwa/install-guide.ts` (its user-agent tests move to `device-family.ts`, results unchanged), `platform/device-family.ts` (new), `components/use-prompt-slot.ts`, `components/CantHear.tsx` (new), `components/VoiceHelpSheet.tsx`, the screens of §3.1, `logic/type-hangul/hear-mode.ts` (CH-1c), the tests of §6, `packages/i18n` (en, es, ko)
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

- On an iPhone with the silent switch on, Match Sound plays the letter's name. The clip or the voice "plays" without sound and ends as `played`, the slot goes to `ok`, no text shows, and the heading still says "Tap the letter you hear". The learner sees a speaker that does nothing. The same happens on Android with the media volume at zero, in a browser tab that is muted, or with headphones paired somewhere else. The app gets no signal in any of these cases: iOS has no public API for the switch, and browsers do not report a muted tab.
- The only way to the text today is Profile → Sound off (the `muted` fallback, F-001 §3.3), and a learner does not know that.
- After a **miss**, Hoya's bubble shows the letter's name as text (`wrongAnswerBubble`, `logic/audio/prompt-view.ts:116-120`). But a miss is a first-try miss that costs stars (`answerRound(roundIdx, false, …)`, `MatchSoundGame.tsx:147`). Today the learner pays a star to learn that the phone is on silent.
- F-AUDIO-004 §8 item 3 already named this way out: "leave it false and show a 'phone is on silent?' hint (the state is not detectable)". OD-R6 chose it.

Who this helps: a learner on silent in a classroom, a service or a waiting room (the reason for the 2026-10-10 decision); a deaf or hard-of-hearing learner, who has no in-game switch to text today (review item accessibility #14); a family sharing an iPad.

## 2. User story

> As a learner whose phone is on silent, when I tap the speaker and hear nothing, I can tap **Can't hear it?**, see how to turn the sound on, or read the letters and keep playing, without first getting a question wrong.
>
> As a learner who is deaf or hard of hearing, I can turn a listening round into a reading round in two taps, inside the game.
>
> As a parent or teacher in a quiet room, the app never plays through the silent switch, and the learner still has a way to play.

## 3. Acceptance criteria

### 3.1 Where the entry point goes (inventory, read from the code)

A **sound-only prompt** is a prompt that shows only a speaker until its text fallback appears (`usePromptSlot` without `textOnScreen`, `components/use-prompt-slot.ts:44-62`). These are the only surfaces where not hearing blocks the round, so these are the ones that get the entry point. On the other surfaces the Korean is already printed next to the speaker (`textOnScreen: true`, the status panel, F-AUDIO-004 §3.9 A-5b), so "Show the letters" would add nothing.

| Surface (hosts) | File | Prompt slot | What "Show the letters" shows (the surface's own text fallback, unchanged) | Row |
|---|---|---|---|---|
| Match Sound (quest Play steps, Browse preview) | `screens/minigames/MatchSoundGame.tsx` | `:74` | the letter's name in Hangul with its romanization (`PromptPanel` `:194-200`) | CH-1a |
| Listen & Pick: every host (quest steps, quest Check, the Hangul Check in `screens/reviews/StageReviewScreen.tsx`, vocab, Browse preview; the Syllable Build and Cloze Pick fallbacks; quest pacing) | `screens/minigames/ListenPickGame.tsx` | `:186-191` | the prompt word and its romanization (`promptView` `:306-311`, live region `:418-428`). **Not in the spelling round**: its Korean is the answer, so it never shows the prompt text (`:303-311`), and the entry point is off there | CH-1b |
| Heard rounds of the Daily Review, Keep going, Stage Check and Cell Check | `screens/reviews/ReviewRounds.tsx` | `:94` (`useRoundSound`, `textOnScreen: !heard`) | the prompt Korean with its romanization (`:167`) | CH-1b |
| Quest warm-up and Try these again | `screens/quest/quest-review-chunk.tsx` | `:311` | the prompt Korean (`:407-410`) | CH-1b |
| Syllable Build (quest step `SyllableBuildGame`, review round `BuildRoundView`) | `screens/minigames/SyllableBuildBoard.tsx` | `:149` | the syllable's romanization only (the block is the answer, `:153`, `:350`); with the text up, a reveal is not counted as a hint (`voice: false`, `:210`) | CH-1b |
| The vocab Speed round's sound question, **Relaxed** mode only (the default; no clock, F-VOC-004 S1) | `screens/vocab/VocabQuestionView.tsx` | `:153-158` (`textOnScreen: promptKind === 'word'`) | the word with its romanization, read in full (`readHere` and `textFallback`, `logic/vocab/question-view.ts:108, 115-117`); the options are pictures | CH-1b |
| Dictation, Type Hangul `hear` (quest step, review round) | `screens/minigames/dictation-chunk.tsx` (`useHearRound` `:85-140`) | `:91` | the `see` round the no-voice fallback already draws (W11 of `design/wireframes/minigame/audio-fallback.md`) | CH-1c |
| Discover, guidance only (text on screen) | `screens/quest/DiscoverStep.tsx` | `:407` | nothing new: the sheet has no **Show the letters**, only the line and **Hear it** | CH-1d, gated by OD-CH3 |

Left out (each with its reason; ODs where the owner should decide):

- **Clocked drills**: the vocab Speed round in **Challenge** mode (opt-in, one session clock with a real countdown, F-VOC-004 S1; the sound question is built only for the Speed round, `logic/vocab/question-builder.ts:224`, since the word cards' quick check is word-to-picture, `logic/vocab/flashcards.ts:158`), and the Decoding Sprint: its drill (one clock for the minute), its probe, and the sprint's Syllable Build rounds (`screens/decode-sprint/SprintPick.tsx:46`, `screens/decode-sprint/DecodingSprintScreen.tsx:462`). A sheet costs time on the clock. OD-CH4.
- **The level check** (`screens/placement/*`): it has its own audio path and text fallback (F-PLC-001 §3.11; `placement/ItemScreen.tsx:97-99, 151-161, 267`), and its warm-up decides the run's sound-off draw (`placement/WarmupScreen.tsx`). It is a test that seeds the route. OD-CH5.
- **Surfaces whose round does not need the sound**, other than Discover. Either the Korean is printed next to the speaker (`textOnScreen: true`: Build Letter, Card Match, Tap & Respond, Culture Quiz, Voice Echo, Pic-Word Match, Realia Read, Cloze Pick, Sentence Builder, Story Order, Role Play, My Story, Hidden Heritage, Trace Stroke, Trace a Word, the story pages, Culture notes, word cards, card detail, the Browse topic list), or the sound is an extra after the answer (Match Shape, W11; Read Pick, whose letter is the prompt and whose options are printed). The story reader and story check always print their Korean too. The learner can go on without the sound.
- **The presenter** (lecture mode, `screens/presenter/*`): a grown-up's device, which has its own "Test the sound" (F-TCH-004 §3.7).

**Checks** (quest Check, Hangul Check, Stage Check, Cell Check) get the entry point through Listen & Pick and `ReviewRounds`, so a learner who cannot hear is never stuck on a check. The answer is recorded exactly as it is today when sound is off: the AD13 trade-off ("a text-assisted round proves reading, not listening", F-AUDIO-004). OD-CH6 asks the owner to confirm.

### 3.2 When the entry point shows (D1)

- **Given** a sound-only prompt that opts in (`usePromptSlot({ cantHear: true })`), **when** its text is not showing (`!view.textShown`), **then** a small **Can't hear it?** link is in the speaker row from the moment the round opens: before any play, before any answer.
- It is hidden while the text shows for any reason (`muted`, `no_voice`, `error`, `blocked`, or the learner's own ask). Those states already offer their own action (Turn sound on, How to add a voice, Try again, Tap to hear; F-AUDIO-004 §3.8), and the letters are already on screen.
- Why always, and not "after the first miss or after two replays" (the WO's suggestion, which left the choice to this spec):
  1. A link that only appears after a miss makes the learner pay a first-try miss, and stars, for a phone setting (§1.2). Anti-shame: a learner is never marked wrong for something that is not their reading.
  2. A learner who hears nothing may not tap the speaker at all, so a link that waits for two replays may never appear. Young learners in particular do not know a sound was supposed to play.
  3. A link that appears in the middle of a round moves the screen. The answers are held while a text may still come in, so that nothing moves under a finger (`settled`, `use-prompt-slot.ts:37-41, 89-90`; AMENDMENTS-TOUCH). A link that is there from the start never moves anything.
  4. WO-05's device check, "reach the text prompt within two taps", holds only if the link is already there: **Can't hear it?** (1), **Show the letters** (2).
- Cost: one more small control on every sound-only round, for learners who hear fine too. It is a ghost button, after the speaker caption, never the largest thing on the screen.

### 3.3 The sheet

- **Given** the link, **when** the learner taps it, **then** a bottom sheet opens, built like `VoiceHelpSheet` (`Modal`, the overlay scrim, `accessibilityViewIsModal`, the close button `common.buttons.close`, `components/VoiceHelpSheet.tsx:24-57`):
  - title **Can't hear it?** (the same words as the link);
  - **one** line for this device (§3.4, §3.10); never the other devices' lines;
  - **Show the letters**: primary. It closes the sheet and asks the slot for the text (§3.5). Not on the guidance-only sheet (Discover, OD-CH3);
  - **Hear it** (the existing `learner.audio.hearIt.cta`): secondary. It closes the sheet and plays the prompt once, through the same function as the speaker, so the learner can check at once after following the line (D3).
- The scrim, the close button and the back (Android hardware back through `onRequestClose`) close the sheet and change nothing else.
- The sheet closes if the round changes while it is open (the slot's `reset()`), so **Show the letters** always acts on the round on screen.
- Nothing is recorded: no answer, no attempt, no star, nothing stored. Opening the sheet does not stop or pause anything (no clock runs on the surfaces of §3.1).
- Look: the paper surface and neutral tones of the help sheet; never `colors.feedback.danger`, and not the amber `colors.feedback.nudge` either (this is not a miss). No Hoya pose change.

### 3.4 Which device's line (D2)

- New pure module `logic/device-family.ts`: `deviceFamily({ os, userAgent, maxTouchPoints }): 'apple' | 'android' | 'computer'`.
  - Native: `os === 'ios'` gives `apple`, `os === 'android'` gives `android`.
  - Web (`os === 'web'`): the user-agent tests `installGuideVariant` already uses (`logic/pwa/install-guide.ts:25-27`, applied at `:41-42`): `iPhone|iPad|iPod`, or `Macintosh` with more than one touch point (iPadOS asks for the desktop site), gives `apple`; `Android` gives `android`; anything else, an empty user agent included, gives `computer`. The row moves these three regexes into `device-family.ts` and imports them back into `install-guide.ts`, so the two cannot drift; `installGuideVariant`'s results and tests do not change.
  - Any other `os` gives `computer`.
- `platform/device-family.ts`: `currentDeviceFamily()` = `deviceFamily({ os: Platform.OS, ...installEnv() })`. `installEnv()` already returns the user agent and touch points on the web (`platform/pwa.web.ts:56-66`) and `''` / `0` on native (`platform/pwa.ts:25`). Read once per sheet open; there is no stored value.
- The same family picks the one section of the "Add a Korean voice" sheet (§3.9).

### 3.5 `promptReducer` gets a `'show_text'` event

`PromptState` gains `asked: boolean` (the learner asked for the text). `INITIAL_PROMPT_STATE.asked` is `false`. `PromptEvent` gains `'show_text'`.

- `'show_text'`: `{ ...s, phase: 'text', asked: true }`. The reason is kept as it is (usually `null`). Sending it twice changes nothing.
- **The rule: a text the learner asked for stays until `'reset'`.** The existing "once shown in a round it stays" rule (F-AUDIO-004 §3.8) already covers every event but one, the late "no Korean voice" clear. That branch (`prompt-state.ts:46-51`) leaves an asked text up and only drops the `no_voice` reason: `s.asked ? { ...s, reason: null } : <today>`.
- Why a field and not a fifth `FallbackReason`: a successful play sets the reason to `null` (`:39`), and a later voice-list event can then turn `null` into `no_voice` and clear it (`:52-53`, then `:46-51`). A reason cannot survive that chain; a field can. A reason is also a failure kind with its own panel line, action and telemetry value (`fallbackAction`, `panelDetail`, `audio.fallback_shown`), and the learner's ask is not a failure.

Interaction with the existing phases and events (rows marked **new** change; the rest is today's behaviour, pinned by tests):

| State before | Event | State after | Panel shows |
|---|---|---|---|
| `idle` / `playing` / `ok`, reason `null` | `'show_text'` **new** | `text`, reason `null`, `asked` | the Korean (or the surface's text), "No sound? Read it here.", no reason line, no action |
| `text`, reason `muted` / `no_voice` / `error` / `blocked` | `'show_text'` **new** (not normally reachable: the link is hidden) | phase and reason kept, `asked` | as today for that reason |
| `text`, `asked` | `'play'` | `text` (`:34`) | unchanged |
| `text`, `asked` | `{ result: 'played' }` | `text`, reason `null` (`:39`) | the text stays: the learner may still not hear it |
| `text`, `asked` | `{ result: 'unavailable' }` | `text`, reason `error` / `blocked` (`:42`) | that reason's line and action (Try again / Tap to hear), which are true |
| `text`, `asked` | `{ muted: true }` | `text`, reason `muted` (`:55`) | "Sound is off." with Turn sound on |
| `text`, `asked`, reason `muted` | `{ muted: false }` | `text`, reason `null` (`:56`) | the text stays |
| `text`, `asked` | capability `none` (no clip) | `text`, reason `no_voice` (`:52-53`) | "No Korean voice on this device." with How to add a voice |
| `text`, `asked`, reason `no_voice` | capability `ready` or clips **new** | `text`, reason `null` | **the text stays** (today, without `asked`, it would go back to `idle` / `ok`) |
| any | `'reset'` | `INITIAL_PROMPT_STATE` (`asked: false`) | the next round starts as a sound-only round again |

How long it lasts: **one round** (WO-05: "that round's prompt state"). The next round opens sound-only with the link, so a learner who fixed the sound hears it again. Whether to remember the choice beyond the round is OD-CH1.

### 3.6 The view and the slot

- `promptPanelView` does not change its signature. With an asked text and reason `null`: `textShown` is true, `detail`, `actionLabel` and `helpLabel` are `null`, the heading is the text one ("Tap the letter for this sound", `prompt-view.ts:76`), and the speaker label and caption are as today.
- `fallbackVisible` (`:89-92`) stays false for an asked text with reason `null`, so `audio.fallback_shown` is **not** sent (no new telemetry; OD-CH2).
- `shouldAutoReplay` (`:95-97`) stays true for an asked text: the 800 ms replay after a miss still plays, which helps a learner who has just turned the sound on and costs nothing otherwise.
- `usePromptSlot` (`components/use-prompt-slot.ts`):
  - option `cantHear?: boolean` (default `false`);
  - `slot.cantHear` = `cantHear && !view.textShown`;
  - `slot.showLetters()` sends `'show_text'`;
  - `settled` (`:89`) is also true once the text was asked for: the text is already up, so nothing can come in above the answers, and they must not stay held while the voice check runs;
  - `reset()` (`:118-124`) is unchanged and clears `asked` through `'reset'`.
- Each surface of §3.1 passes `cantHear: true`, except Listen & Pick in its spelling round and with a text prompt (`textOnScreen`, `ListenPickGame.tsx:190`). It renders `<CantHear onShowLetters={slot.showLetters} onHear={hear} />` in its speaker row, and puts nothing new in its scoring. Every surface already reads `slot.view.textShown` for its fallback (Match Sound and Listen & Pick for the prompt, Syllable Build for `voice`, `ReviewRounds` and the quest warm-up for the prompt line), so an asked text takes the same path as today's `muted` text.
- Dictation (CH-1c) decides its opening itself (`dictation-chunk.tsx:109-115`, `logic/type-hangul/hear-mode.ts:37-47`). There, **Show the letters** sets the round's opening to `{ kind: 'see', reason: 'asked' }` (`HearSeeReason` gains `'asked'`, `hear-mode.ts:24`, with no reason line) and calls `slot.showLetters()`. The round becomes the `see` round that two failed plays already lead to (`afterFailedPlay`, `:45-47`), and is recorded the same way.

### 3.7 Screen readers

- The link is a button whose accessible name is its visible words, "Can't hear it?" (WCAG 2.5.3). It has no hint. In focus order it comes after the speaker (and after Listen & Pick's Hear again) and before the answers.
- When the sheet opens, focus moves into it (the `Modal` with `accessibilityViewIsModal`, as in `VoiceHelpSheet`). The title is a heading. The order is title, line, Show the letters, Hear it, then close.
- The close button, the scrim and the back return focus to the link.
- **Show the letters**: the sheet closes and focus goes to the speaker button, the control just before the link (the link itself is gone, because the text is up). Then the letters are said **once**, with the `useTipAfterFocus` order (`screens/minigames/TraceControls.tsx:66-89`, AMENDMENTS-TRACE-IDLE TI-3b): focus first, and a beat later the text enters the panel's polite live region (the web, Android; `components/PromptPanel.tsx:80`), and VoiceOver is told through `announceForScreenReader` (`platform/screen-reader.ts:42-49`), because iOS has no live regions. Nothing is announced twice.
- **Hear it**: the sheet closes, focus goes back to the link (it is still there), and the prompt plays.
- VoiceOver's own speech normally goes on in silent mode, so a VoiceOver user can use all of this (checked on a device, §3.12).
- Never assertive; never a focus jump that the learner did not ask for.

### 3.8 The web

- Browsers do not report a muted tab, the system volume or the output device. `speechSynthesis` and the Web Audio clip player (`platform/audio-player.web.ts`) report a normal end, so the slot goes `ok`, as on a silent iPhone. The entry point is the same on the web.
- The line comes from the user agent (§3.4):
  - an iPhone or iPad browser, the installed PWA included, gets the **Apple** line. Whether the silent switch also mutes Web Audio clips and the browser voice there is unverified (F-AUDIO-004 §5 device matrix, "iPhone Safari, installed PWA"); the line is right either way, because a learner on an iPhone may have silent mode on;
  - an Android browser gets the **Android** line;
  - a computer gets the **computer** line (volume, and a muted tab).
- The page does **not** set `navigator.audioSession.type = 'playback'` (Safari 17 and later). That is the web's way to play through the silent switch, and OD-R6 rules it out as it rules out `PLAY_IN_SILENT_MODE = true`.
- A sound the browser blocked before any tap is already detected (`blocked`, "Tap to hear", F-AUDIO-004 §3.6, §3.8); the link is hidden then (§3.2).

### 3.9 The "Add a Korean voice" sheet shows one device (P2-22)

- `voiceHelpContent(copy, family)` (`logic/audio/voice-help.ts:59-66`) returns **one** section, the family's (§3.4), instead of the three of `SECTION_ORDER` (`:56`). The title, note and footer do not change. `VoiceHelpSheet` (`:22`) passes `currentDeviceFamily()`. Its two callers (Profile's Sound card, and "How to add a voice" on a `no_voice` panel) need no change.
- This also does WO-37 row NB-7 (`docs/roadmap/review-2026-11/phase-5-native-a11y.md`: "filter by `Platform.OS` on native, can share WO-05's PR"), on the web too. That row is done when CH-1a merges; its spec, when it is written, cites this one.
- `design/components/VoiceHelp/spec.md` §2 changes with it (row CH-0b).

### 3.10 Strings (`packages/i18n/src/messages/en/learner.ts`, block `learner.audio`, `:1115`)

| Key | English |
|---|---|
| `learner.audio.cantHear.cta` | Can't hear it? |
| `learner.audio.cantHear.lines.apple` | Turn off silent mode. Then turn the volume up. |
| `learner.audio.cantHear.lines.android` | Turn up the media volume with the volume buttons. |
| `learner.audio.cantHear.lines.computer` | Turn the volume up. Check that this tab is not muted. |
| `learner.audio.cantHear.showLetters.cta` | Show the letters |

- Reused, unchanged: `learner.audio.hearIt.cta` "Hear it" (`:1135`), `learner.audio.readHere` "No sound? Read it here." (`:1116`), `common.buttons.close`. The sheet's title is `cantHear.cta`.
- The Apple line does not name a switch: recent iPhones set silent mode with the Action button or Control Center, and most iPads have no switch.
- English is CEFR Pre-A1 and short (CLAUDE.md §1). "Silent mode", "media volume" and "muted" are the words the phones' own settings use.
- Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:30-34`; a missing key fails `es-coverage.ts` / `ko-coverage.ts`), so the CH-1a PR carries the es and ko values as R8 drafts with the F-I18N-001 §3.10 review, in the same PR. This spec writes English only.
- Telemetry, if OD-CH2 says yes: no new string.

### 3.11 Touch, layout and anti-shame

- The link is `Button tone="ghost" size="sm"`, which is `touchTarget.min` (64) tall (`packages/design-system/src/components/Button/Button.tsx:47`). The sheet's buttons are `md`, full width on a phone.
- The speaker row wraps: at 200 % text on a 320 x 568 screen the link drops under the speaker caption and stays on screen with the prompt zone. In the side-by-side layout (`GameColumns`, F-LAYOUT-001) it stays in the prompt column.
- The tiles never move because of the link (it is there from the start). When the text comes in after **Show the letters**, the answers move once, at the learner's own request, the same as the shipped text fallback.
- No danger colour, no amber, no X anywhere on the link or the sheet; nothing is recorded; no meter changes.

### 3.12 [On device, owner]

- iPhone, native build, silent mode on: open Stage 1 q1 and go to Match Sound. Reach the text prompt in two taps (**Can't hear it?**, **Show the letters**) and answer the round. The sheet shows the Apple line only. (WO-05 acceptance criterion.)
- The same in Safari and in the installed PWA on an iPhone (Apple line). Also note whether the clips and the voice are silent with the switch on: this closes the F-AUDIO-004 §5 "silent-switch behaviour of TTS and of clips" item.
- Android phone, media volume at zero: Android line; **Hear it** plays the prompt once the volume is up.
- Desktop Chrome with the tab muted: computer line.
- VoiceOver (with silent mode on) and TalkBack: the link and the sheet are read; after **Show the letters** the letters are read once and focus is on the speaker.
- "Add a Korean voice" from Profile on each device: one section only.

## 4. Out of scope

- Playing through the silent switch, on native or on the web (OD-R6); any way to detect the switch, the volume or a muted tab; a new native module.
- Remembering **Show the letters** beyond the round (OD-CH1 → row CH-2).
- The clocked drills, the level check and the presenter (§3.1, OD-CH4, OD-CH5).
- How a text-assisted answer counts toward memory and checks. It is the same as today's `muted` fallback (AD13). Whether a check item answered with the text up should count as heard is assessment-validity work (WO-10, WO-11, OD-R1), not this spec.
- iOS `MixWithOthers` letting music cover the prompt (`audio-player.ts:307`): WO-37 row NB-6.
- Turning sound back on from inside the sheet: muting is the app's Sound switch (Profile, `device:audio`), and the `muted` panel already offers Turn sound on.

## 5. UI sketch

- Wireframe: `design/wireframes/minigame/audio-cant-hear.md` (this row, CH-0). It extends `design/wireframes/minigame/audio-fallback.md` (W1-W4 Match Sound states, W7 the help sheet, W8 the state machine, W11 Dictation) and `design/wireframes/minigame/shell.md`.
- Mock: row CH-0b adds the link, the sheet (three device lines, phone and tablet, 200 % text) and the one-section help sheet in `design/screens/minigame-variety/` (or a new `design/screens/audio-cant-hear/`, the mock row decides), a component spec `design/components/CantHear/spec.md` and a revision of `design/components/VoiceHelp/spec.md` §2, approved by the multi-agent review (CLAUDE.md §5).

## 6. Tests

Unit (`apps/mobile/src/logic/**/__tests__/`):

1. `promptReducer`: `'show_text'` from `idle`, `playing` and `ok` gives `phase: 'text'`, `asked: true`, reason `null`; sending it twice is the same.
2. Every row of the §3.5 table after `'show_text'`: `'play'`, `played`, `unavailable` (`error`, `blocked`), `muted` true then false, capability `none`, capability `ready` with reason `no_voice` (**text stays**, reason `null`), `'reset'` (back to `INITIAL_PROMPT_STATE`).
3. Without `asked`, the late `no_voice` clear still works as today (the existing tests stay green unchanged).
4. `promptPanelView` on an asked text: `textShown`, no detail, no action, no help, the text heading; `fallbackVisible` false; `shouldAutoReplay` true.
5. `deviceFamily`, table-driven: native `ios`, `android`, another `os`; web user agents of an iPhone, an iPad (`iPad` token), iPadOS asking for the desktop site (`Macintosh`, 5 touch points), a Mac (0 and 1 touch points), an Android phone and tablet, Windows, Linux, ChromeOS, and an empty string.
6. `installGuideVariant`: its existing tests unchanged and green after the regexes move.
7. `voiceHelpContent(copy, family)`: exactly one section with that family's id for each family; title, note and footer unchanged.
8. `cantHearLine(family, copy)` (in `logic/audio/cant-hear.ts`) picks the family's line, for each family.

Hook (`components/__tests__/`):

9. `usePromptSlot({ cantHear: true })`: `slot.cantHear` is true while no text shows and false in each text state; `showLetters()` makes `view.textShown` true and `settled` true while `voiceCheckPending` is still true; `reset()` brings back the link.

Screen (`screens/minigames/__tests__/`, testing-library, the audio rig `test-support/audio-rig.ts`):

10. Match Sound, a play that ends `played`: the link is in the speaker row on round 1 before any tap. Tap it: the sheet shows the title, **one** line (`Platform.OS` and the user agent mocked for each family), Show the letters, Hear it and close.
11. Show the letters: the sheet closes; the panel shows the letter's name with its romanization and "No sound? Read it here."; the heading is the text heading; the link is gone. A right tap gives `answerRound(…, true)` once. The next round opens with no text and the link back.
12. Sound off (`muted`), no Korean voice (`no_voice`), a failed play (`error`) and a blocked play (`blocked`): no link.
13. Hear it: the sheet closes and the prompt plays once more (`playJamo` called once); no `answerRound`.
14. A wrong tap after Show the letters: the tile takes the wrong state (never `colors.feedback.danger`) and the 800 ms replay is scheduled.
15. Screen reader (`platform/screen-reader` mocked): after Show the letters, focus moves to the speaker first, then `announceForScreenReader` is called once with the letters' text, and the panel's live region holds it.
16. The round changes while the sheet is open: the sheet closes.
17. `VoiceHelpSheet` renders exactly one `voice-help-sheet-<family>` section.
18. CH-1b, one test per surface: the link is shown on a sound-only round and leads to that surface's text; for Listen & Pick, no link in the spelling round or with a text prompt; Syllable Build passes `voice: false` after Show the letters; the Speed round shows the link in Relaxed mode and not in Challenge mode.
19. CH-1c: Dictation `hear` round, Show the letters gives the `see` round with no reason line; `hearOpening` and `afterFailedPlay` are unchanged.

e2e (web, `apps/mobile/e2e/web/cant-hear.spec.ts`; the shared engine answers each utterance, so a play ends `played`): Match Sound in desktop Chromium shows the computer line, and an iPhone user-agent context shows the Apple line; the text prompt is reached in two taps. The Playwright shards run on `main` pushes only (owner decision 2026-11-18, `.github/workflows/web-app.yml`), so the CH-1a PR runs this suite locally and pastes the output.

Coverage: `apps/mobile` business logic stays at or above 90 %.

## 7. Rollout

Next release, no switch: the link only adds a way out, and nothing changes until it is tapped. Effects to watch: if OD-CH2 is yes, `audio.fallback_shown { source, reason: 'asked' }` counts how often learners cannot hear, per surface (counts only, once per session, source and reason, as row 19 of `docs/roadmap/TELEMETRY-NAMES-2.md`); otherwise nothing new is measured.

## 8. Dependencies

- OD-R6 (approved 2026-11-22). No other spec blocks this one.
- Shared files (`docs/roadmap/review-2026-11/README.md` §6): `MatchSoundGame.tsx` is shared with WO-04 (AF-4), WO-06 and WO-41; `ListenPickGame.tsx` and the other game files of §3.1 are likely in WO-04's AF-4 ("the rest of the games"); `packages/i18n/src/messages/en/learner.ts` is shared with almost every UI WO. Merge one at a time and rebase mechanically. WO-04's `useAnswerAnnouncement` (F-A11Y-001) may later take over the `announceForScreenReader` call of §3.7; the behaviour (said once) stays.
- WO-37 NB-7 is done by CH-1a (§3.9).
- `PromptPanel`, `VoiceHelpSheet` and `usePromptSlot` exist (F-AUDIO-004 A-5a, A-4b, A-12); `focusForScreenReader`, `announceForScreenReader` and `useTipAfterFocus` exist.

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| CH-0 | Opus 5.5 | This spec and the wireframe `design/wireframes/minigame/audio-cant-hear.md`; the WO's citations re-read (§1.1) | — | OD-R6 | `docs/audio-cant-hear-spec` |
| CH-0b | Opus 5.5 | Mock of the link, the sheet (three device lines; phone, tablet landscape, 200 % text at 320 x 568) and the one-section help sheet; `design/components/CantHear/spec.md`; `design/components/VoiceHelp/spec.md` §2 revised; multi-agent review | — | this spec `ready` | `design/audio-cant-hear` |
| CH-1a | Sonnet 5.5 | §3.5 reducer (`asked`, `'show_text'`); §3.6 slot (`cantHear`, `showLetters`, `settled`); §3.4 `logic/device-family.ts`, `platform/device-family.ts`, the install-guide regexes moved; `logic/audio/cant-hear.ts`; `components/CantHear.tsx`; Match Sound; §3.9 the one-section help sheet (P2-22, NB-7); §3.10 strings en + es + ko (R8 drafts, reviewed) | 1–17; e2e | CH-0b | `feat/audio-cant-hear` |
| CH-1b | Sonnet 5.5 | §3.1 surfaces: Listen & Pick (every host; not in the spelling round or with a text prompt), `ReviewRounds` heard rounds, the quest warm-up and Try these again, Syllable Build (quest step and review round, not the sprint), the Speed round's sound question in Relaxed mode (not in Challenge mode) | 18 | CH-1a | `feat/audio-cant-hear-surfaces` |
| CH-1c | Sonnet 5.5 | Dictation `hear`: Show the letters gives the `see` round (`HearSeeReason` `'asked'`) | 19 | CH-1a | `feat/audio-cant-hear-dictation` |
| CH-1d | Sonnet 5.5 | Only if OD-CH3 is yes: the guidance-only link and sheet on Discover (no Show the letters), once per page under the card's buttons | a Discover screen test | CH-1a, OD-CH3 | `feat/audio-cant-hear-discover` |
| CH-2 | Sonnet 5.5 | Only if OD-CH1 is (b): the "Always show the letters" device switch (§11) | per OD-CH1 | CH-1b, OD-CH1 | `feat/audio-show-letters-setting` |
| CH-3 | Sonnet 5.5 | "Amended 2026-11-xx by AMENDMENTS-AUDIO-CANT-HEAR" lines in F-AUDIO-004, F-001, F-QUEST-002, F-CURR-002, F-VOC-004; a W12 pointer in `design/wireframes/minigame/audio-fallback.md`; the `docs/specs/README.md` index line; if OD-CH2 is yes, row 19 of `TELEMETRY-NAMES-2.md` gains `'asked'`; status `shipped` | — | CH-1a – CH-1c (and CH-1d, CH-2 if built) | `docs/audio-cant-hear-amended` |

One commit = test + implementation. Estimates: CH-0b 0.5d, CH-1a 0.75d, CH-1b 0.5d, CH-1c 0.25d (the WO's 0.5d + 0.75d, plus the mock and the surfaces the inventory found).

## 10. Departures from WO-05 (for the owner to accept)

- **D1 — when the link shows: always**, on a sound-only round while no text is up (§3.2). WO-05 suggested "after the first miss or after two replays" and left the choice to this spec. Reasons: a miss-gated link charges a star for a phone setting; a learner who hears nothing may never replay; a link that appears mid-round moves the screen; and the WO's own "two taps" check needs it.
- **D2 — the device line is chosen by device family, not by `Platform.OS` alone** (§3.4). The WO says to filter by `Platform.OS` "the same way as `voice-help.ts:56`". But `:56` filters nothing (§1.1, row 6), and `Platform.OS` is `'web'` in every browser, so in the web PWA an iPhone would get the computer line. Native still uses `Platform.OS`; the web uses the user-agent tests the install guide already uses. The WO's goal, only this device's line, is kept.
- **D3 — the sheet also has Hear it** (an existing string), so the learner can check the sound right after following the line. WO-05 names only the line and Show the letters.

## 11. Owner decisions (each gates only the rows named; the default applies until the owner answers)

- **OD-CH1 — remember Show the letters beyond the round?** (a) No: one round, as WO-05 describes. (b) A saved **device** switch, "Always show the letters", on Profile's Sound card next to the Sound switch: `device:audio` and `DeviceAudioPrefsSchema` (`packages/content-schema/src/schemas/audio.ts:22`) gain `showLetters` (default `false`, so old values still parse); every sound-only prompt then opens with its letters, and the sound still plays. (c) A saved **per-profile** setting: the profile schema, its storage and sync. **Recommendation: (b), as row CH-2, after CH-1b.** It is the standing switch that review item accessibility #14 asks for. Mute and the Display settings are already per device (AMENDMENTS-DISPLAY-NAV), and (c) would touch the profile record and sync for little gain. Until the owner says (b) or (c), it is one round (a), and Profile → Sound off still gives text everywhere today. Gates CH-2.
- **OD-CH2 — count the learner's ask?** **Recommendation: yes**, as a new reason value `'asked'` on the existing `audio.fallback_shown` (sent once per session, source and reason when the learner taps Show the letters; no new event name). The Worker keeps `audio.*` payloads as sent (F-AUDIO-004 §3.14, amended 2026-10-17; `audio.fallback_shown` has no payload rule in `packages/backend/src/lib/server-events.ts`), so the row only changes the client type and row 19 of `TELEMETRY-NAMES-2.md`, and confirms the Worker keeps the event. It shows the owner how often learners cannot hear, per surface, and whether OD-CH4 matters. Default: nothing is sent (§3.6). Gates the telemetry part of CH-1a.
- **OD-CH3 — a guidance-only link on Discover?** Discover is the first page that plays a sound in every quest (since AU-10 it plays the first letter on open), so a learner on silent meets the problem there first. The letter is printed, so the sheet would have only the line and Hear it. **Recommendation: yes, on Discover only**, so the learner can fix the sound before the first sound-only game; on no other text-on-screen surface. Default: not built. Gates CH-1d.
- **OD-CH4 — the clocked drills** (the Speed round in Challenge mode; the Decoding Sprint drill and probe, and the sprint's Syllable Build rounds). **Recommendation: not now.** A sheet over a running clock costs the learner time, Challenge mode is opt-in, the same Speed round in Relaxed mode has the link (CH-1b), and the learner has already met the link in every untimed game. Revisit with the OD-CH2 counts. Default: not built.
- **OD-CH5 — the level check.** **Recommendation: a later amendment of F-PLC-001** that puts the link on the warm-up only, where Show the letters gives the run's existing sound-off draw (`warmupAudio`), so a learner on silent is not placed by guessing. Not in this amendment. Default: nothing changes.
- **OD-CH6 — the link in Checks** (quest Check, Hangul Check, Stage Check, Cell Check). **Recommendation: yes**, as built by CH-1b. A learner who cannot hear must not be stuck on a check, and the answer is recorded as it is today with sound off (AD13); assessment validity stays with WO-10 and WO-11. Default: yes (built). If the owner says no, CH-1b passes `cantHear: false` for the `check` and `review` hosts.

## 12. Review log

- (multi-agent review to come; findings and their adjudication are recorded here, as in `AMENDMENTS-TRACE-IDLE.md` §11.)
