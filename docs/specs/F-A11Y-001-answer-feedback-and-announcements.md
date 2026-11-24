Status: draft

# F-A11Y-001 — Answer feedback you can see without colour, and hear once

**Status**: `draft`. Revision 1 (2026-11-23). It is the AF-0 row of work order WO-04 (`docs/roadmap/review-2026-11/phase-1-safety.md`) and starts F-A11Y-001, the spec INBOX T-015 announced (`docs/tasks/INBOX.md:17`). It cannot go `ready` until the owner answers OD-AF1 to OD-AF8 (§10) and a multi-agent review has run (§11).

**Later sections**: WO-08 (CI accessibility checks, rows AC-*), WO-39 (headings and focus, SS-*), WO-40 (Korean voice, LP-*) and WO-41 (accessibility polish) each add their own section to this file. This revision covers WO-04 only.

**Amends** (each gets its "Amended by" line in row AF-6, not before):

- F-001 (Match Sound)
- F-002 (HoyaBubble: a `live` prop)
- F-003 (Build a Letter)
- F-010 (Odd One Out and Culture Quiz, the feedback line `:43`)
- F-011 (Card Match)
- F-012 (Tap & Respond, "wrong picks lock + nudge", `:36`)
- F-QUEST-002 (Listen & Pick, Pic-Word Match)
- F-STORY-003 (Story Sequence)
- F-CURR-001 (Sentence Builder, Realia Read)
- F-CURR-002 (Cloze Pick, Story Order, Role Play, Hidden Heritage, Syllable Build, Match Shape, Read Pick)
- `AMENDMENTS-TOUCH.md` §6.2 (KT-4a, Card Match's flash timer), only if OD-AF6 is accepted
- `AMENDMENTS-QUEST-SOUND-BACK.md` QS-4 (the least waits), only if OD-AF2 (b) or (c) is accepted
- the component spec `design/components/ChoiceCard/spec.md` (its Tile note)

Tag **[AF]**.

**Scope**:

- `apps/mobile/src/logic/answer-feedback.ts` (new, pure)
- `apps/mobile/src/platform/screen-reader.ts` and `.web.ts`
- `apps/mobile/src/components/AnswerAnnouncer.tsx` and `use-answer-announcement.ts` (new)
- the game screens of §3.6
- `packages/design-system` (`Tile` correct mark, `HoyaBubble` `live` prop)
- `packages/i18n` (`a11y` namespace)
- the tests of §6

**Owner**: solo dev · **Rollout**: next release; no switch (§7)

**Basis**: `origin/main` `e72336a7d` (2026-11-23). Every `file:line` below is at that commit unless it says otherwise. WO-04 was written on `d5ba0217c`; §1.2 re-reads each of its citations.

---

## 1. Context

### 1.1 The problem

WO-04's goal: in every minigame a result is (a) visible by something other than colour and (b) said to a screen reader once, on iOS, Android and the web (WCAG 1.4.1 Use of Color, 4.1.3 Status Messages). Six older games do neither:

- **Culture Quiz** and **Tap & Respond**
  - A right answer turns the option's fill from `brand.secondary` to `feedback.success`. In luminance the two are the same: 1.00:1 (relative luminance 0.1520 and 0.1515). Nothing else changes: no mark, and the button keeps the same accessible name.
  - A miss sets `tone='nudge'` **and** `disabled` on the option (`CultureQuizGame.tsx:155, 163`; `TapRespondGame.tsx:179, 187`). `Button` paints any disabled button `surface.sunken` at 0.6 opacity with `text.muted`, whatever its tone (`packages/design-system/src/components/Button/Button.tsx:139-146, 157`). So the amber is never drawn. The missed option looks like a greyed-out button: label 2.36:1, fill 1.07:1 against the canvas. A screen reader reads it as dimmed.
  - Nothing is announced. The Hoya bubble on a miss mounts together with its text (`CultureQuizGame.tsx:171-178`, `TapRespondGame.tsx:195-200`), and `HoyaBubble` is itself the live region (`HoyaBubble.tsx:55`). A region that appears with its text in place is not reliably read, and iOS has no live regions at all.
- **Card Match**
  - A wrong pair is a 600 ms amber flash on both cards (`CardMatchGame.tsx:70`, `:187-195`, colours `:205-221`). After that the Korean pick is let go.
  - The labels never change (`:253`, `:288`).
  - Matched cards are told by a green tint and 0.5 opacity (`:222`). That leaves their text at 2.94:1.
  - Nothing is announced.
- **Match Sound** and **Odd One Out**
  - A miss has the `replay` mark since AU-17a.
  - A right tile has no mark: `Tile`'s `correct` look is `mark: null` (`packages/design-system/src/components/Tile/style.ts:39-44`).
  - The tile labels never change (`MatchSoundGame.tsx:229`, `OddOneOutGame.tsx:131`).
  - Nothing is announced.
- **Build a Letter**
  - A right block turns the target box green, colour only (`BuildLetterGame.tsx:202, 204`).
  - A miss shows Hoya's shape hint, which disappears with the emptied slots after `WRONG_RESET_MS` = 900 ms (`:54`, `:152-155`, `:342-372`).
  - Nothing is announced.

The newer games mostly draw marks already. On iOS, though, most of them say nothing, and a right answer is announced almost nowhere (§1.3).

### 1.2 WO-04's citations, re-read on `e72336a7d`

| WO-04 says | Now | Verdict |
|---|---|---|
| `CultureQuizGame.tsx:155` `tone = showCorrect ? 'success' : isWrongLocked ? 'nudge' : 'secondary'` | same line | **holds**, with a correction: the `nudge` tone is never drawn, because the same option is `disabled` (`:163`) and `Button` paints every disabled button sunken (`Button.tsx:139-146`) |
| `tokens.ts:28` secondary `#2672A6`, `:51` success `#397952`; the two fills are 1.00:1 | same lines; measured 1.00:1 | **holds** |
| `TapRespondGame.tsx:179` same pattern | same line (`disabled` at `:187`) | **holds**, with the same correction |
| `CultureQuizGame.tsx:80-95`: at least 700 ms (until the sound ends), then the next round | `handleTap` is `:80-104`; the wait `afterSound(sounding.current, { minMs: 700 })` is `:88`; the next round `:89-97` | **moved** |
| `CardMatchGame.tsx:70, 187-195, 205-221`: a miss is a 600 ms `nudgeLight` flash only; the labels `:253, :288` never change | same lines | **holds**. Added: matched cards at opacity 0.5 (`:222`) |
| `HoyaBubble.tsx:55` uses only `accessibilityLiveRegion="polite"` (not supported on iOS) | same line | **holds** |
| `announceForScreenReader` is called from only 7 files | At `d5ba0217c`: the definition plus 6 caller files. Now: 15 calls in 10 caller files (the TI rows added `TraceStrokeGame.tsx:259`, `TraceWordGame.tsx:419` and `TraceControls.tsx:84`; the durable-progress rows added `ProgressReadFailedScreen.tsx:143, 162`) | **moved**. None of the 10 is one of the six games above |
| `PromptPanel.tsx` already describes the "wrapper stays mounted" pattern | `apps/mobile/src/components/PromptPanel.tsx:13` | **holds** |
| AF-5 done by AU-17a: Tile's wrong state uses `text.primary` and the replay mark (`Tile/style.ts:45-51`, Tile pairs in `contrast.test.ts`) | same lines; the tests are `contrast.test.ts:203-266` | **holds for the wrong state only**. The `correct` state still has no mark (`style.ts:39-44`). It is added in AF-1 (§9), not by reopening AF-5 |
| `ChoiceCard` must have a mark on wrong | `ChoiceCard/style.ts:62-70` (`replay`, or `dash`); `correct` has `check` (`:53-61`) | **holds** |
| Decision 4: build on `afterSound(…, { minMs: 700 })` (QS-4, #1038) | `apps/mobile/src/logic/audio/reply-advance.ts:32-44` (`ANSWER_SOUND_MAX_MS` 2500, `:17`); `sound-pacing.ts` `after(minMs, run, maxMs)` from `:86` | **holds** |
| Decision 4: reuse placement's `announceAndWait` pattern | `announceAndWait` is `apps/mobile/src/platform/screen-reader.ts:60-84`. It was added in #645 (F-CURR-001 Stage 4 Read Along: "announce, then play"), and its only caller is `screens/quest/DiscoverStep.tsx:193`, with a 320 ms gap (`motion.duration.slow`). Placement never calls it. Placement's own pattern is: the reader state read once at boot (`PlacementScreen.tsx:223`), no auto-play while a reader is on (`placement/ItemScreen.tsx:174`), and focus moved to the prompt on each question (`ItemScreen.tsx:166-168`). The module `screen-reader.ts` did start as placement's (F-PLC-001 §3.12, its header `:3-11`) | **partly false**. This spec uses both: Discover's `announceAndWait`, and placement's reader check and focus move (§3.4) |
| Test: "no colour literal is left in design-system (the existing token test)" | The existing no-literal test covers `Tile` only (`contrast.test.ts:258-266`). Literals remain at `Button.tsx:43` (`nudge` pressed fill `#D89B2B`), `Pill/style.ts:24, 26` and `StarRow/StarRow.tsx:134` | **false as written**. §6 test 10 checks the surfaces this spec changes. The rest belongs to WO-41 (#2, #3). `Button.tsx:43` is in scope only if OD-AF1 (A) is chosen |
| Implementation note: `screen-reader.web.ts` always reads the reader as off | `screen-reader.web.ts:10-12` | **holds** |
| (WO-40 lines this spec relies on) `KoreanText.tsx:135-136, 152-153`; `a11y.koreanItem` `a11y.ts:293-`; Tap & Respond label `:183`; Culture Quiz Hangul heading `:123` | same lines (`koreanItem` is `a11y.ts:293-296`) | **holds** |

Since `d5ba0217c`, `MatchSoundGame.tsx` and `OddOneOutGame.tsx` changed one line each: the locale's "or" in the tile label (#1062). The other files WO-04 cites did not change.

### 1.3 The other games today

Read from code on `e72336a7d`; the line numbers for each game are in the row PRs.

| Game | Correct mark | Miss mark | Miss look ends on a timer | State in the label | iOS hears the result | Advance after a correct answer |
|---|---|---|---|---|---|---|
| Listen & Pick | `check` (ChoiceCard) | `replay` | no | yes (`a11y.minigame.option`) | no | `pacing.after(700)` |
| Pic-Word Match | `check` + number badge | `replay` | **yes, 600 ms** (`missClearMs`) | yes; the miss wording goes with the flash | no | `pacing.after(700)`, last pair only |
| Read Pick | `check` | `replay` | no | **no** | no | `pacing.after(900)`, **0 with reduced motion** |
| Cloze Pick | `check` (on the tile and in the gap) | `replay` | no | yes | no | `pacing.after(700, …, 6000)` |
| Realia Read | `check` | `replay` | no | yes | no | `setTimeout(700)`, not paced to sound |
| Story Sequence | `check` on the filled slot | `replay` | **yes, 600 ms** | own words; the miss wording goes with the flash | no | none per tap; replay and Done |
| Story Order | slot filled with the line (no check) | `replay` | **yes, 600 ms** | own words; the miss wording goes with the flash | correct placement only | none per tap; Done |
| Hidden Heritage | ring in success colour (the found slot fills with the word) | ring in nudge colour, **same shape** | **yes, 600 ms** (`MISS_RING_MS`) | found yes, miss no | no | `pacing.after(700)` |
| Syllable Build | `check` | a drawn nudge **dot** (not an icon) | no | partly | no | `pacing.after(900)` |
| Match Shape | `check` | drawn nudge **dot** | no | found only | no | `pacing.after(900)`; origin rounds: Continue |
| Sentence Builder | `check` | `dash` | no | own words | no | own wait, 600 ms least |
| Role Play | colour while sending, then the reply moves into the log | `dash` | no | miss yes | miss only | `afterReply` (900 to 6000) |
| Story Check | "Correct" / "Try another" text | `replay` | no | yes | **yes, both** (`StoryCheckGame.tsx:88-91`, `:179-181`, `:224-227`) | Next button |
| Type Hangul, Write Frame, My Story | `check-circle` and a result line | marked blocks and a result line | no | the result line | by focus moving to the result line | `setTimeout(1100)` / Done |
| Trace Stroke, Trace a Word | owned by `AMENDMENTS-TRACE-IDLE.md` | | | | | |

In the `minigames` screens, no game uses `colors.feedback.danger` or the `close` (X) icon for a miss (checked by grep).

## 2. User story

> As a learner who cannot tell green from blue, I see a check on the answer that was right and a try-again mark on the one that was not, in every game.
>
> As a learner using VoiceOver or TalkBack, I hear "Right answer: sagwa, apple." once when I get it, and "Not this one: pear. Try another." once when I miss. The next question does not start talking over it.
>
> As a parent who reads Korean, I can watch my child play without the screen ever flashing a miss away before either of us has seen it.

## 3. Acceptance criteria

### 3.1 The result look (WO-04 decision 1)

One rule for every answer surface:

| Result | Mark (icon from `packages/design-system` `Icon`) | Colour | Tappable | Accessible state |
|---|---|---|---|---|
| right | `check` | `feedback.success` family | no | name says it (§3.2) |
| miss, the learner tries again on the same question | `replay` ("try another") | `feedback.nudge` family, mark in `text.primary` | no (locked), still focusable | name says it |
| miss that moves on (no retry) | `dash` | as above | no | name says it |
| not answered | none | as today | yes | plain name |

- Never `colors.feedback.danger`, never the `close` (X) icon, never an X drawn any other way.
- The mark is decorative: it is hidden from assistive tech, because the accessible name carries the state (as `Tile.tsx:32-43` and `ChoiceCard` already do).
- The mark reads at 3:1 or more on its state's fill (WCAG 1.4.11):
  - `check` in `feedback.success` on `successLight`: 4.28:1.
  - white `check` on a `success` fill: 5.21:1.
  - `replay` in `text.primary` on `nudgeLight`: 14.02:1; on a `nudge` fill: 8.66:1.
- The mark never covers the glyph, the romanization or the gloss, at any text size: it sits out of the flow, as `TILE_MARK` does (`Tile/style.ts:65-71`).
- In greyscale, right, miss and not-answered are told apart by the mark alone.

Per surface:

| Surface | Change | Row |
|---|---|---|
| `ChoiceCard` | none: it already follows the rule (`style.ts:53-70`) | — |
| `Tile` | `correct` gets a `check` in `feedback.success` at `TILE_MARK`. `wrong` keeps `replay` (AU-17a) | AF-1 |
| Culture Quiz, Tap & Respond answers | per OD-AF1: (B, recommended) `ChoiceCard` row layout; (A) a `Button` result look. Either way, a locked miss is no longer drawn as a disabled button | AF-2 |
| Card Match cards | a right pair: `check` on both cards, fill and border as today, **full opacity** (the 0.5 fade goes: text 2.94:1). A miss: `replay` on the meaning tried (§3.5) | AF-3 |
| Build a Letter target box | a right block: `check` on the target box beside its success fill | AF-4a |
| Hidden Heritage rings | the found ring gets `check`, the miss ring gets `replay`; until now they differ by colour alone | AF-4c |
| Syllable Build, Match Shape | the drawn nudge dot becomes `replay` (OD-AF8) | AF-4c |
| Sentence Builder, Role Play | `dash` stays (OD-AF8) | — |

The exact size, corner and inset of each new mark come from the design pass (AF-0b). The wireframe is `design/wireframes/minigame/answer-feedback.md`.

### 3.2 The words: labels and announcements (WO-04 decisions 2 and 6)

**Labels (decision 6).**

- An answered option's accessible name starts with its state, using the existing keys:
  - right: `a11y.minigame.option.correct(base)` → "Right answer: {base}"
  - miss: `a11y.minigame.option.wrong(base)` → "Not this one: {base}"
  - (`packages/i18n/src/messages/en/a11y.ts:169-176`)
- These keys are already used by Listen & Pick, Pic-Word Match, Cloze Pick, Realia Read and Role Play, and they are already translated and reviewed in es and ko.
- WO-04 proposed suffixes (", correct", ", try another"); this spec reuses the prefixes instead (OD-AF4).
- `base` is the option's name before the answer, with any "tap to select" part dropped:
  - a jamo tile → its sound value (`a11yRomanization`: "n", "silent or ng")
  - a Korean option → its current name
  - a UI-language option → its text
- A pure helper `answerOptionLabel(state, base, option)` in `logic/answer-feedback.ts` does this. Listen & Pick's own copy of it (`listen-pick-flow.ts:325`) may move onto the helper.
- Card Match's matched cards: new label key `a11y.minigame.option.paired` → "Matched: {base}".
- A locked miss stays focusable and is never announced as dimmed. A right answer's `accessibilityState` is `selected`, as `ChoiceCard` sets it (`ChoiceCard.tsx:130`).

**Announcements (decision 2).**

An announcement is one line, built by `answerAnnouncement(result, a11y)` (pure). Each template adds at most 12 words of its own. The kinds:

| Kind | Key | English | Used by |
|---|---|---|---|
| right | `a11y.answer.right(item)` | Right answer: {item}. | every game's right answer; Build a Letter's built block |
| miss | `a11y.answer.miss(item)` | Not this one: {item}. Try another. | a pick with no hint line (Culture Quiz, Tap & Respond, Read Pick, …) |
| miss, sound prompt | `a11y.answer.missListen(item)` | Not this one: {item}. Listen again. | Match Sound, Listen & Pick, Syllable Build |
| miss with a hint | `a11y.answer.missHint(item, hint)` | Not this one: {item}. {hint} | a game whose Hoya line is a real hint (Odd One Out `lookAgain`, Sentence Builder, Role Play's why line) |
| matched pair | `a11y.answer.matched(item)` | Matched: {item}. | Card Match |
| pair that does not match | `a11y.answer.notMatched(word, meaning)` | Not a match: {word} and {meaning}. Try another. | Card Match |
| a whole line | none: an existing dictionary line as is | (e.g. Build a Letter's `notQuite(hint)`) | Build a Letter's miss, where no single option was picked |

- `item` is how the answer is named, never in Hangul (see the next list):
  - a jamo: its sound value
  - a Korean word or reply: `a11y.answer.item(romanization, gloss)` → "{romanization}, {gloss}"
  - a UI-language option: its text
- **Korean, lined up with WO-40** (`phase-5-native-a11y.md`, WO-40; OD-AF5):
  - **This spec puts no Hangul in an announcement.** The iOS call (`AccessibilityInfo.announceForAccessibility*`) takes one plain string with no language per part, so Hangul in it would be read in the UI voice, or skipped.
  - This follows the app's existing rule for spoken names of taught Korean: `a11y.minigame.hear(romanization)` (`a11y.ts:105-107`: "`romanization` is a sound value, never Hangul"), `koreanWord(romanization ?? ko)`, and the jamo tile labels (`logic/korean-labels.ts`).
  - The romanization is never put before Hangul in a label (WO-40's TalkBack rule). Announcements hold no Hangul, so the rule cannot be broken there.
  - `answerAnnouncement` returns the line as **segments** (`{ text, lang? }[]`), and `AnswerAnnouncer` renders one `Text` per segment. This spec only ever emits UI-language segments. If WO-40's device survey (LP-0) finds that a `lang="ko"` segment in a live region is read in a Korean voice on the web or Android, WO-40 (LP-3) can add a Hangul segment there without changing a caller. iOS keeps the plain string.
  - Story Check already marks Korean inside an English line for a Korean voice (`StoryCheckGame.tsx:81-82`, F-STORY-003 §3.10). It is the precedent WO-40 will measure, and this spec does not change it.

### 3.3 One announcement per result (WO-04 decision 3)

- **`AnswerAnnouncer`** (`apps/mobile/src/components/AnswerAnnouncer.tsx`, new). One per game screen. What it is:
  - mounted for the whole life of the screen, empty until the first result
  - visually hidden (`srOnly`, `screens/minigames/korean-speech.ts:15`)
  - `accessibilityLiveRegion="polite"`, and `aria-live="polite"` on the web; never `assertive`; never focusable
- **Platforms:**
  - **Web and Android** read the region.
  - **iOS** has no live regions, so the hook makes exactly one queued call: `AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true })`. It is queued, as Story Check does (`StoryCheckGame.tsx:88-91`), so it does not cut off or get cut off by VoiceOver reading the control just pressed.
  - Android does not also get an `announceForAccessibility` call: the region is its channel (WO-04 decision 3, and the rule of `screen-reader.ts:37-49`).
- **The hook `useAnswerAnnouncement()`** (`apps/mobile/src/components/use-answer-announcement.ts`, new):
  - `announce(result): Promise<void>` writes the region and makes the iOS call. Its promise settles when the line has been said (§3.4).
  - `clear()` is called when a new round opens.
  - `screenReader: boolean` is read with `isScreenReaderEnabled()` and kept current with `subscribeScreenReader` (`screen-reader.ts:12-24`).
- **The text:**
  - It changes once per result.
  - When a new round opens, it is emptied.
  - When the same text comes twice in a row (possible across rounds), the `Text` is re-keyed so it is read again.
- **The visible bubble stays quiet.** In a game that uses the hook, the visible Hoya line is not a live region too:
  - `HoyaBubble` gets `live?: boolean` (default `true`, so every other caller keeps today's behaviour), and these games pass `live={false}`.
  - A game's own result wrapper (`<View accessibilityLiveRegion="polite">` around the bubble, e.g. `ListenPickGame.tsx:489`) stops being live.
  - The line is still on screen and still reachable by swiping. It is just said once, through the announcer.
- **Not changed:**
  - Region-only helpers like `PromptPanel`'s sound status (a different message, not a result).
  - Story Check (already one announcement per result).
- Nothing here is ever `assertive`.

### 3.4 When the round moves on (WO-04 decision 4)

- **Screen reader off** (native), and **the web** (where a reader cannot be detected, `screen-reader.web.ts:10-12`):
  - The game waits as it does today: `afterSound(sound, { minMs })` or `pacing.after(minMs, …)` (QS-4).
  - The least wait is `max(game's least wait, RESULT_MARK_MIN_MS)`, where `RESULT_MARK_MIN_MS` is set by OD-AF2: 0 under (a), 1000 under (b, recommended), 1200 under (c).
  - The floor is applied by the screen, so each flow's own constant and its tests stay (as QS-4 kept them).
  - It covers Read Pick's reduced-motion 0 (`ReadPickGame.tsx:93`): reduced motion asks for less motion, not less time to see the mark.
  - The web is OD-AF3.
- **Screen reader on** (native). Order: **announce, then any sound the answer plays, then advance.** This is Discover's "announce, then play" (`DiscoverStep.tsx:193`).
  - The advance waits for the announcement **and** for the sound, with the least wait as above.
  - iOS waits for `announcementFinished`, at most `ANNOUNCE_TIMEOUT_MS` (3000, `screen-reader.ts:52`). It uses `announceAndWait`, extended with the `queue` option (AF-1).
  - Android cannot tell when TalkBack has finished. It waits `ANDROID_ANNOUNCE_WAIT_MS` = 2000 after writing the region: a named constant in `platform/screen-reader.ts`, tuned on a device in §3.8.
  - An answer that plays a sound (Tap & Respond's reply, Listen & Pick's clip) starts that sound after the announcement. Card Match plays its word when a Korean card is picked, not on the answer; its last pair still waits for a word that is sounding (QS-4).
  - A sound the game plays by itself after a miss starts after the miss announcement: Match Sound's replay (`MatchSoundGame.tsx:151-154`, 800 ms), Listen & Pick's (`replayDelayMs` 800) and Syllable Build's (`REPLAY_AFTER_MS` 800). Round-start auto-play is WO-41 #6's, not this spec's.
- **Focus after the advance.** When a round moves on, focus goes to the new round's prompt (the element that names the question). This is the same as placement's per-question move (`ItemScreen.tsx:166-168`), through `focusForScreenReader` (`screen-reader.ts:31-35`; DOM focus on the web).
  - Without it, the focused option is unmounted with its round and focus is lost. Culture Quiz and Tap & Respond key their options by text.
  - Screen-level focus stays WO-39's (SS-3).
- **A miss never advances**, and nothing on the screen changes by itself after a result (§3.5). The one exception is the right answer's advance above.

### 3.5 A miss stays until the learner acts (WO-04 decision 5)

- **Card Match** (OD-AF6):
  - After a wrong pair, the meaning tried shows the miss look (amber plus `replay`). It is inactive, its label is "Not this one: …", and it stays **while the same Korean word is picked**.
  - The Korean card stays picked (its picked look, no amber), so the learner can tap another meaning straight away.
  - A second wrong meaning for the same word is marked too.
  - The marks clear when that word is matched or when the learner picks another Korean word.
  - The 600 ms timer (`WRONG_FLASH_MS`, `:70`) and its pick release (`:189-195`) go.
  - KT-4a's guarantees still hold: a bounce on the amber meaning is not a second miss (it is inactive), and the next pick is never undone by a timer (there is no timer).
- **The other games with a timed miss** (OD-AF7, recommended):
  - Pic-Word Match, Story Sequence, Story Order: 600 ms.
  - Hidden Heritage: the 600 ms miss ring.
  - Build a Letter: Hoya's shape hint, which goes with the 900 ms slot reset. The slots still empty after 900 ms, so the learner can rebuild; the hint stays until the next tile is placed.
  - Their miss look, and the miss words in the label, stay until the learner's next tap that changes the board.
  - If OD-AF7 is declined, only Card Match changes.

### 3.6 Per game

| Game | Marks (§3.1) | Labels (§3.2) | Announcer (§3.3) | Timing (§3.4) | Miss stays (§3.5) | Row |
|---|---|---|---|---|---|---|
| Culture Quiz | per OD-AF1 | `option.correct` / `.wrong` (base = the meaning) | right / miss | floor; reader: announce, then advance; focus to the Korean word | already (locked list) | AF-2 |
| Tap & Respond | per OD-AF1 | same (base = today's reply label) | right / miss (item = romanization, gloss) | reader: announce, then the reply clip, then advance (`afterReply`) | already | AF-2 |
| Card Match | `check` both cards, `replay` on the meaning tried | `option.paired`; `option.wrong` on the meaning tried | matched / notMatched | the last pair's 800 ms, floor | OD-AF6 | AF-3 |
| Match Sound | `Tile` `check` (AF-1) | `option.correct` / `.wrong` (base = sound value) | right / missListen | floor; reader: miss replay after the announcement | already | AF-4a |
| Odd One Out | `Tile` `check` | same | right / missHint (`oddOneOut.lookAgain`) | floor | already | AF-4a |
| Build a Letter | `check` on the target box | none: the target is the speaker and keeps its "Hear …" name; the slots keep their take-back names; the result is in the announcement | right (item = romanization) / the `notQuite` line | 900 ms, floor | OD-AF7 (the hint) | AF-4a |
| Listen & Pick, Cloze Pick, Realia Read | none | none (they already name state) | right / missListen or miss | floor; reader wait | — | AF-4b |
| Read Pick | none | add state (`answerOptionLabel`) | right / miss | floor (also covers reduced motion) | — | AF-4b |
| Pic-Word Match | none | none | matched-pair right / miss | floor (last pair) | OD-AF7 | AF-4b |
| Story Sequence, Story Order | Story Order's slot: as is | as is | right (placement) / miss; Story Order's existing iOS call moves onto the hook | none per tap | OD-AF7 | AF-4b |
| Hidden Heritage | ring marks | missed spot gets state | right / missHint ("Look again") replaces `liveText` | floor | OD-AF7 | AF-4c |
| Syllable Build, Match Shape | dot → `replay` (OD-AF8) | state on marked tiles and zones | right / missListen or missHint | floor; reader wait | already | AF-4c |
| Sentence Builder | as is | as is | its placed announcement and hint go through the hook | its own wait, floor | already | AF-4c |
| Role Play | as is | add state to the sent reply | right / missHint (why line); the existing iOS call moves onto the hook | `afterReply`; reader wait | already | AF-4c |
| Story Check, Type Hangul, Write Frame, My Story, Trace Stroke, Trace a Word, Story Read, Voice Echo | not changed (§4) | | | | | — |

### 3.7 Strings (`packages/i18n/src/messages/en/a11y.ts`; read aloud, never drawn)

| Key | English |
|---|---|
| `a11y.answer.item` | `(romanization, gloss)` → {romanization}, {gloss} |
| `a11y.answer.right` | Right answer: {item}. |
| `a11y.answer.miss` | Not this one: {item}. Try another. |
| `a11y.answer.missListen` | Not this one: {item}. Listen again. |
| `a11y.answer.missHint` | Not this one: {item}. {hint} |
| `a11y.answer.matched` | Matched: {item}. |
| `a11y.answer.notMatched` | Not a match: {word} and {meaning}. Try another. |
| `a11y.minigame.option.paired` | Matched: {label} |

- Reused, not new: `a11y.minigame.option.correct`, `.wrong`, `a11y.romanizationOr`, and each game's existing Hoya lines.
- This spec lists English only. Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts`, `LOCALE_STATUS`), so `i18n-status.mjs` fails a PR that adds an English key without them. The row that adds these keys (AF-1) therefore carries es and ko values drafted by R8 and reviewed under F-I18N-001 §3.10 in the same PR (ledger re-signed), as `AMENDMENTS-TRACE-IDLE.md` §3.6 did.
- No es or ko is written ad hoc.

### 3.8 [On device, owner]

- VoiceOver (iOS) and TalkBack (Android): in Culture Quiz, Tap & Respond, Card Match, Match Sound and Listen & Pick, each right answer and each miss is read **once** and is not cut off by the next round; focus lands on the next round's prompt.
- TalkBack: tune `ANDROID_ANNOUNCE_WAIT_MS` (2000) so a right-answer line is read in full before the next prompt, at the default speech rate.
- One web reader (VoiceOver with Safari, or NVDA with Chrome): the region is read once per result.
- Greyscale (the phone's colour filters): right, miss and not-answered are told apart in each game of §3.6.

## 4. Out of scope

- How Hangul is voiced in labels and announcements: WO-40 (LP-0 to LP-3). §3.2 leaves it a slot.
- Heading levels, landmarks, document titles and screen-level focus: WO-39.
- CI accessibility checks (axe smoke, ESLint a11y): WO-08. Its baseline shrinks as these rows merge; "Culture Quiz right after an answer" is one of its smoke targets.
- Round-start auto-play while a screen reader is on, and a web "play sounds by themselves" setting: WO-41 #6.
- Hoya as decoration inside the bubble, and the design-system's English default labels (`Tile.tsx:111` "Korean letter …, tap to select", `Hoya.tsx:111`): WO-41 #8.
- The colour literals left in design-system (`Button.tsx:43`, `Pill/style.ts:24, 26`, `StarRow.tsx:134`): WO-41 #2 and #3, unless OD-AF1 (A) makes `Button` an answer surface, in which case AF-2 moves `Button.tsx:43` onto a token.
- Games that already deliver a result and are not changed:
  - Story Check: one announcement per result, a Next button.
  - Type Hangul, Write Frame, My Story: focus moves to the result line.
  - Trace Stroke and Trace a Word: `AMENDMENTS-TRACE-IDLE.md`.
  - Story Read: no answer.
  - Voice Echo: behind a flag, no miss.
  - WO-42 checks them on a device.
- Answer screens outside `MinigameScreen`: the vocabulary question view, Speed Round, Decode Sprint, the level check, Daily Review, Yut review. A follow-up WO, after this one shows the pattern.
- Telemetry: none added.
- New dependencies: none. Everything here uses React Native's `AccessibilityInfo` and the existing design system.

## 5. UI sketch

- Wireframe (this row): `design/wireframes/minigame/answer-feedback.md`. It builds on `design/wireframes/minigame/families.md` and `shell.md`.
- Mock (row AF-0b): `design/components/AnswerFeedback/spec.md` and `design/components/AnswerFeedback/mock/answer-feedback-states.html`, with greyscale captures. It covers:
  - every new mark of §3.1
  - the answer surface chosen in OD-AF1
  - Card Match's states
  - the dot → `replay` change (OD-AF8)
  - a Tile note in `design/components/ChoiceCard/spec.md`
- The pass is approved by multi-agent review (CLAUDE.md §5).

## 6. Tests

Unit, pure (`apps/mobile/src/logic/__tests__/answer-feedback.test.ts`):

1. `answerAnnouncement`: for each kind of §3.2 the English line is as §3.7 says. No line, for any kind and any fixture item, contains a Hangul code point (U+1100-11FF, U+3130-318F, U+AC00-D7AF). That pins the WO-40 alignment until LP-3 changes it on purpose.
2. `answerOptionLabel`: idle → base; correct → `option.correct(base)`; wrong → `option.wrong(base)`; paired → `option.paired(base)`.
3. `resultLeastWait(gameMin)` = `max(gameMin, RESULT_MARK_MIN_MS)`, including a reduced-motion 0.
4. With fake timers and a fake sound:
   - reader off: the advance waits for the sound and the least wait, as today;
   - reader on: the announcement first, then the sound, then the advance;
   - the advance never comes after `ANSWER_SOUND_MAX_MS` (or 6000 for a sentence) plus `ANNOUNCE_TIMEOUT_MS`.

Platform (`apps/mobile/src/platform/__tests__/screen-reader.test.ts`, `screen-reader.web.test.ts`):

5. iOS: the queued announce calls `announceForAccessibilityWithOptions(text, { queue: true })` once. Android: no announce call. `announceAndWait(…, { queue: true })` resolves on `announcementFinished` or after `ANNOUNCE_TIMEOUT_MS`. Android resolves after `ANDROID_ANNOUNCE_WAIT_MS`. A reader that is off resolves at once with no call.
6. Web: every call is a no-op, and the reader reads as off.

Component and hook (`apps/mobile/src/components/__tests__/`):

7. `AnswerAnnouncer`:
   - is present and empty before any result, and polite (`accessibilityLiveRegion` and `aria-live`); no `assertive` anywhere;
   - its text changes once per result;
   - the same text twice in a row re-keys its `Text`;
   - `clear()` empties it.
8. `useAnswerAnnouncement`:
   - one iOS call per result, none on Android or the web;
   - it follows `subscribeScreenReader` when the reader is turned on mid-game.

Design system (`packages/design-system/src/`):

9. `HoyaBubble`: `live={false}` renders no live region; the default stays polite (existing tests unchanged).
10. `Tile` `correct` has a `check` mark in a colour token, at 3:1 or more on its fill. The existing loops (`contrast.test.ts:203-266`) already cover the token and "differs from idle by more than its border" rules for every state; the test asserts the correct mark explicitly. If AF-3 draws Card Match's card from a pure style (recommended, `cardMatchStyle`), the same three contrast rules cover it.

Screens (`apps/mobile/src/screens/minigames/__tests__/`, testing-library, fake timers, `Platform.OS` and `isScreenReaderEnabled` mocked):

11. Culture Quiz:
    - after a right answer, the option shows `check` and is named "Right answer: …";
    - after a miss, the option shows `replay`, is named "Not this one: …", is focusable, and is not drawn or announced as disabled;
    - the announcer's text changes once per result;
    - iOS: one call;
    - reader on: the next round waits for `announcementFinished`, then focus is on the new prompt;
    - reader off: the next round comes after the floor.
12. Tap & Respond: as 11. With the reader on, the reply clip starts after the announcement.
13. Card Match:
    - a miss: the meaning shows `replay` and is still marked 10 s later; the Korean pick is held;
    - another meaning is then scored;
    - another Korean word clears the mark;
    - matched cards show `check` at full opacity and are named "Matched: …";
    - no timer un-selects a pick (KT-4a's F3 test, rewritten).
14. Match Sound and Odd One Out: the right tile has `check` and is named "Right answer: {sound}". Match Sound, reader on: the miss replay starts after the announcement.
15. Build a Letter: `check` on the target box after a right block. After a miss, the hint is still shown after the 900 ms slot reset, until the next tile (OD-AF7).
16. One test per game in AF-4b and AF-4c:
    - right and miss are each announced once (region text, plus one iOS call);
    - the old result wrapper is no longer live;
    - the labels are as §3.6 says;
    - with OD-AF7, the miss look is still there past the old 600 ms.

e2e (web; `web-app.yml` runs it on `main`, owner decision 2026-11-18):

17. `apps/mobile/e2e/web/answer-feedback.spec.ts`: in Culture Quiz, after a right answer one `aria-live="polite"` region holds "Right answer:" once, and no element on the page is `aria-live="assertive"`.

Existing tests that change: `CardMatchGame.test.tsx` (the flash and stale-timer cases), `CultureQuiz` cases in `answer-sound-advance.test.tsx` (the floor), `TapRespondGame.test.tsx`, `MatchSoundGame.test.tsx`, `OddOneOutGame.test.tsx`, `BuildLetterGame.test.tsx`, `PicWordMatchGame-boards.test.tsx` (`missClearMs`), and the Story Sequence, Story Order and Hidden Heritage tests that wait out 600 ms. Each row lists its own.

Coverage: `apps/mobile` business logic at or above 90 %; `packages/design-system` at or above 85 %; `packages/i18n` 100 % (message files excluded).

## 7. Rollout

- Next release, row by row. No switch: no row changes data, scoring or stars, and each row is a small, separate revert.
- Effect to watch: none measured. Per-round events are named but not emitted by mobile (`AMENDMENTS-TRACE-IDLE.md` §7), and this spec adds no telemetry.
- If OD-AF2 (b) is accepted, a sighted learner's quest gets longer by at most 0.3 s per right answer in the 700 ms games (about 1.2 s for a four-round game).

## 8. Dependencies

- None blocking.
- Files shared with other work orders (README §6), merged one after another:
  - the game screens, with WO-06, WO-40 and WO-41
  - `sound-pacing.ts` and `reply-advance.ts`, with WO-41 #6
  - `Tile/` and `HoyaBubble/`, with WO-39, WO-40 and WO-41
- WO-40 decides Hangul voicing on top of §3.2's segments.
- WO-08's axe baseline drops the WO-04 violations as these rows merge.
- WO-25 (`phase-3-upper-stages.md`, row EA-2) uses this hook for its "why" line after a right answer.

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| AF-0 | Opus 5.5 | This spec and the wireframe `design/wireframes/minigame/answer-feedback.md` | — | — | `docs/answer-feedback-spec` |
| AF-0b | Opus 5.5 | Design pass (§5): every new mark, the OD-AF1 surface, Card Match's states, the Hidden Heritage rings, the dot → `replay` change; greyscale captures; the Tile note in the ChoiceCard component spec; multi-agent review | — | this spec `ready` | `design/answer-feedback` |
| AF-1 | Opus 5.5 | Shared parts: `logic/answer-feedback.ts` (`answerAnnouncement`, `answerOptionLabel`, `resultLeastWait`, `RESULT_MARK_MIN_MS`); `platform/screen-reader.ts` (queued announce, `announceAndWait(…, { queue })`, `ANDROID_ANNOUNCE_WAIT_MS`) and its `.web.ts`; `components/AnswerAnnouncer.tsx` and `use-answer-announcement.ts` (region, reader state, round focus); `HoyaBubble` `live`; `Tile` correct `check`; the §3.7 keys with R8 es and ko | 1–10 | AF-0b | `feat/answer-announcement` |
| AF-2 | Sonnet 5.5 | Culture Quiz and Tap & Respond (§3.6), on the OD-AF1 surface | 11, 12, 17 | AF-1, OD-AF1 | `fix/answer-feedback-quiz-respond` |
| AF-3 | Sonnet 5.5 | Card Match (§3.5, §3.6): marks, full opacity, the miss that stays, labels, announcer | 13 | AF-1, OD-AF6 | `fix/answer-feedback-card-match` |
| AF-4a | Sonnet 5.5 | Match Sound, Odd One Out, Build a Letter | 14, 15 | AF-1 | `fix/answer-feedback-tiles` |
| AF-4b | Sonnet 5.5 | Listen & Pick, Pic-Word Match, Read Pick, Cloze Pick, Realia Read, Story Sequence, Story Order | 16 | AF-1, OD-AF7 | `fix/answer-feedback-choice-games` |
| AF-4c | Sonnet 5.5 | Hidden Heritage, Syllable Build, Match Shape, Sentence Builder, Role Play | 16 | AF-1, AF-0b, OD-AF7, OD-AF8 | `fix/answer-feedback-boards` |
| AF-5 | — | `Tile` wrong-state mark, literal removed: **done by AU-17a (#1035)**. Its `correct` mark was not part of it and lands in AF-1 | — | — | — |
| AF-6 | Sonnet 5.5 | "Amended 2026-xx-xx by F-A11Y-001" lines in the specs listed under **Amends**; the `docs/specs/README.md` index line; status `shipped` once §3.8 is checked or recorded as open | — | AF-1 – AF-4c | `docs/answer-feedback-finish` |

One commit = test + implementation. AF-4a, AF-4b and AF-4c may run in parallel after AF-1. Each rebases over the others on the shared i18n file only if it adds a key (none is planned).

## 10. Owner decisions (open)

None of these is decided. Each has a recommendation. The spec goes `ready` once they are answered.

- **OD-AF1: the answer surface of Culture Quiz and Tap & Respond.** Today these are `Button`s whose miss is drawn disabled (§1.1).
  - (A) Keep `Button` and give it a result look. A new `result?: 'correct' | 'miss'` prop draws the mark (white `check` on the success fill, `replay` in `text.primary` on the nudge fill), keeps the tone, and is inactive but not disabled. `Button` is a general control, so it gains answer semantics, and `Button.tsx:43`'s literal must move to a token.
  - (B) Use `ChoiceCard` (row layout) like Listen & Pick, Cloze Pick, Realia Read and Story Check. Its marks, state names and contrast tests exist already. The height is the same: 80 dp, `touchTarget.child`, like `Button` `lg`. Tap & Respond's replies then render through `KoreanText`, so WO-40's fix reaches them; today they are one string, `replyOptionLabel`. The two games' answers change from blue pills to paper cards.
  - **Recommended: (B).** One answer surface for every "pick one" game, nothing new in `Button`.
- **OD-AF2: the advance for a sighted learner (screen reader off).** The mark needs time to be seen. Today the least wait is 700 ms in Culture Quiz, Match Sound and Odd One Out, Listen & Pick, Pic-Word Match, Cloze Pick, Realia Read and Hidden Heritage; it is 900 ms in Build a Letter, Read Pick (0 with reduced motion), Syllable Build and Match Shape.
  - (a) Keep every value.
  - (b) A floor, `RESULT_MARK_MIN_MS` = 1000, after every right answer, applied by the screen so the flows' constants and tests stay.
  - (c) The floor at 1200.
  - **Recommended: (b).** It costs at most 0.3 s per right answer, removes Read Pick's 0, and gives a web screen-reader user time to hear the line (OD-AF3).
- **OD-AF3: the web, where a screen reader cannot be detected** (`screen-reader.web.ts:10-12`).
  - (a) The web keeps the sighted timing (with OD-AF2's floor). The announcement is a polite region, and focus moves to the next prompt.
  - (b) This spec adds a device setting, "Give me time to hear results" in the Display sheet: new UI, strings and a design pass.
  - (c) On the web, always wait an extra fixed time after a right answer.
  - **Recommended: (a)**, and ask WO-41 #6, which already plans a web setting ("Play sounds by themselves"), to consider covering this in the same setting.
- **OD-AF4: the words of an answered option's name.**
  - WO-04 suggested suffixes: "…, correct" and "…, try another" (new keys).
  - This spec reuses the prefixes already used by five games (Listen & Pick, Pic-Word Match, Cloze Pick, Realia Read, Role Play), "Right answer: …" and "Not this one: …" (`a11y.ts:170-171`). They are already translated and reviewed in es and ko, and they say the state first.
  - **Recommended: reuse the prefixes.**
- **OD-AF5: Hangul in announcements.**
  - (a) None until WO-40's device survey (LP-0) reports. Answers are named by romanization and gloss, as every spoken name of taught Korean is today.
  - (b) Hangul now, in a `lang="ko"` segment on the web and Android, and none on iOS.
  - WO-04's example ("Correct. 사과, sagwa, apple.") had it; WO-40 says no structure changes before LP-0.
  - **Recommended: (a).** The segments of §3.2 make (b) a later, additive change.
- **OD-AF6: Card Match's miss** (WO-04 decision 5, made exact; amends `AMENDMENTS-TOUCH.md` §6.2 KT-4a).
  - The meanings tried stay marked while the same Korean word is picked, and the pick is no longer let go by a timer.
  - The alternative: keep the pick release, and only clear the mark on the next tap anywhere.
  - **Recommended: as §3.5 says.** One fewer tap to try again, and no timer anywhere on the board.
- **OD-AF7: the same rule in the other games with a timed miss.** These are Pic-Word Match, Story Sequence, Story Order and Hidden Heritage (600 ms each), plus Build a Letter's hint (900 ms). In three of them the miss words in the label vanish with the flash.
  - (yes) The miss look stays until the learner's next tap that changes the board.
  - (no) Only Card Match.
  - **Recommended: yes.**
- **OD-AF8: marks outside the rule of §3.1.** Syllable Build and Match Shape draw a nudge dot (not an icon); Sentence Builder and Role Play use `dash` where the learner then tries again.
  - (a) All four to `replay`.
  - (b) Keep all four as their specs designed them.
  - (c) The dots become `replay`; the `dash`es stay: they come from the icon set, and in those two games they mean "not here" rather than "try this question again".
  - **Recommended: (c).**

## 11. Review log

- 2026-11-23, revision 1 (AF-0): written on `e72336a7d`; WO-04's citations re-read (§1.2); the other games surveyed (§1.3). A multi-agent review follows. Its findings and their adjudication go here.
