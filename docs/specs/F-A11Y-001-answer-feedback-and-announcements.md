Status: ready (owner decision 2026-11-24: OD-AF1 to OD-AF9 all as recommended, §10; AF-0 done; AF-5 done by AU-17a, #1035; AF-0b to AF-4c and AF-6 open)

# F-A11Y-001 — Answer feedback you can see without colour, and hear once

**Status**: `ready` (owner decision 2026-11-24, §10). Revision 2 (2026-11-24): the two-lens review of revision 1 is adjudicated in §11. This spec is the AF-0 row of work order WO-04 (`docs/roadmap/review-2026-11/phase-1-safety.md`) and starts F-A11Y-001, which INBOX T-015 announced (`docs/tasks/INBOX.md:17`). The owner answered OD-AF1 to OD-AF9 on 2026-11-24, all as recommended (§10).

**Rows** (§9):

- Done: AF-0 (this spec and its wireframe); AF-5, by AU-17a (#1035).
- Open: AF-0b, AF-1, AF-2, AF-3, AF-4a, AF-4b, AF-4c and AF-6.

**Later sections**: WO-08 (CI accessibility checks, rows AC-*), WO-39 (headings and focus, SS-*), WO-40 (Korean voice, LP-*) and WO-41 (accessibility polish) each add their own section to this file. This revision covers WO-04 only.

**Amends** (each gets its "Amended by" line in row AF-6, not before):

- Specs:
  - F-001 (Match Sound), F-003 (Build a Letter), F-010 (Odd One Out and Culture Quiz, the feedback line `:43`), F-011 (Card Match), F-012 (Tap & Respond, "wrong picks lock + nudge", `:36`)
  - F-002 (HoyaBubble: a `live` prop)
  - F-QUEST-002 (Listen & Pick, Pic-Word Match), F-STORY-003 (Story Sequence), F-CURR-001 (Sentence Builder, Realia Read), F-CURR-002 (Cloze Pick, Story Order, Role Play, Hidden Heritage, Syllable Build, Match Shape, Read Pick)
  - `AMENDMENTS-TOUCH.md` §6.2 (KT-4a, Card Match's flash timer), by OD-AF6 (a), decided 2026-11-24
  - `AMENDMENTS-QUEST-SOUND-BACK.md` QS-4 (the least waits), by OD-AF2 (b), decided 2026-11-24
  - F-PLC-001 §3.12 and `AMENDMENTS-DISPLAY-NAV.md` (the Display sheet), by OD-AF3 (d), decided 2026-11-24
- Design documents:
  - `design/components/ChoiceCard/spec.md` (its `wrong` state is no longer `selected`; the Tile note)
  - `design/wireframes/minigame/shell.md` §7 (a miss) and §12 (screen readers: "nothing steals focus" gets the round-focus exception of §3.4)
  - the game wireframes `design/wireframes/minigame/story-order.md`, `design/wireframes/story/sequence.md`, `minigame/pic-word-match.md`, `hidden-heritage.md`, `build-letter.md`, `syllable-build.md`, `match-shape.md`, `role-play.md`, `sentence-builder.md`
  - The answer announcer and the `HoyaBubble` `live` prop get their design file in row AF-0b: `design/components/AnswerFeedback/spec.md` documents both (the component-skill precondition).

Tag **[AF]**.

**Scope**:

- `apps/mobile/src/logic/answer-feedback.ts` (new, pure: every rule of §3 that can be a function)
- `apps/mobile/src/platform/screen-reader.ts` and `screen-reader.web.ts`
- `apps/mobile/src/screens/minigames/answer-announcer.tsx` and `use-answer-announcement.ts` (new, thin React glue)
- `apps/mobile/src/screens/minigames/sr-only.ts` (new: the hidden-text style, moved out of `korean-speech.ts`)
- the game screens of §3.6
- `packages/design-system` (`Tile`: correct mark and a `locked` prop; `ChoiceCard`: `wrong` not `selected`; `HoyaBubble`: `live` prop)
- `packages/i18n` (`a11y` namespace and one `learner` line)
- the tests of §6

**Owner**: solo dev · **Rollout**: next release; no switch (§7)

**Basis**: `origin/main` `e72336a7d` (2026-11-23). Every `file:line` below is at that commit unless it says otherwise. WO-04 was written on `d5ba0217c`; §1.2 re-reads each of its citations.

---

## 1. Context

### 1.1 The problem

WO-04's goal: in every minigame, a result is (a) visible by something other than colour and (b) said to a screen reader once, on iOS, Android and the web (WCAG 1.4.1 Use of Color, 4.1.3 Status Messages). Six older games do neither:

- **Culture Quiz** and **Tap & Respond**
  - A right answer changes the option's fill from `brand.secondary` to `feedback.success`. In luminance the two are the same: 1.00:1 (relative luminance 0.1520 and 0.1515). Nothing else changes: there is no mark, and the accessible name stays the same.
  - A miss sets `tone='nudge'` **and** `disabled` on the option (`CultureQuizGame.tsx:155, 163`; `TapRespondGame.tsx:179, 187`). `Button` paints every disabled button `surface.sunken` at 0.6 opacity with `text.muted`, whatever its tone (`packages/design-system/src/components/Button/Button.tsx:139-146, 157`).
    - So the amber is never drawn. The missed option looks like a greyed-out button (label 2.36:1, fill 1.07:1 against the canvas).
    - A screen reader reads it as dimmed.
  - Nothing is announced:
    - The Hoya bubble shown after a miss mounts together with its text (`CultureQuizGame.tsx:171-178`, `TapRespondGame.tsx:195-200`), and `HoyaBubble` is itself the live region (`HoyaBubble.tsx:55`). A region that appears with its text already in place is not reliably read.
    - iOS has no live regions at all.
- **Card Match**
  - A wrong pair is a 600 ms amber flash on both cards (`CardMatchGame.tsx:70`, `:187-195`, colours `:205-221`). After the flash, the Korean pick is let go.
  - The labels never change (`:253`, `:288`).
  - Matched cards are shown only by a green tint and 0.5 opacity (`:222`), which leaves their text at 2.94:1. They are also `disabled` (`:256`, `:289`), so a screen reader reads them as dimmed.
  - Nothing is announced.
- **Match Sound** and **Odd One Out**
  - A miss has had the `replay` mark since AU-17a. The locked tile is passed `disabled` (`MatchSoundGame.tsx:230`, `OddOneOutGame.tsx:132`). `Tile` forwards that to `TapTarget` (`Tile.tsx:110`), which sets `accessibilityState.disabled` (`TapBoard/TapTarget.tsx:69, 75`; `Tile/types.ts:10`: "announced as disabled").
  - A right tile has no mark: `Tile`'s `correct` look is `mark: null` (`packages/design-system/src/components/Tile/style.ts:39-44`).
  - The tile labels never change (`MatchSoundGame.tsx:229`, `OddOneOutGame.tsx:131`).
  - Nothing is announced.
  - The advance after a right answer differs between the two:
    - Odd One Out uses a bare `setTimeout(…, 700)` (`OddOneOutGame.tsx:69-78`). It is not paced to sound and not cleared on unmount.
    - Match Sound uses `pacing.after(700)` (`:137`).
- **Build a Letter**
  - A right block turns the target box green, and colour is the only cue (`BuildLetterGame.tsx:202, 204`).
  - A miss empties the slots after `WRONG_RESET_MS` = 900 ms (`:54`, `:152-155`). Hoya's shape hint disappears with them (`:342-372`), even though Undo and take-back exist (`:158-172`).
  - Nothing is announced.

The newer games mostly draw marks already. On iOS, though, most of them say nothing, and a right answer is announced almost nowhere (§1.3).

### 1.2 WO-04's citations, re-read on `e72336a7d`

| WO-04 says | Now | Verdict |
|---|---|---|
| `CultureQuizGame.tsx:155`: `tone = showCorrect ? 'success' : isWrongLocked ? 'nudge' : 'secondary'` | same line | **holds**, with a correction: the `nudge` tone is never drawn, because the same option is `disabled` (`:163`) and `Button` paints every disabled button sunken (`Button.tsx:139-146`) |
| `tokens.ts:28` secondary `#2672A6`, `:51` success `#397952`; the two fills are 1.00:1 | same lines; measured 1.00:1 | **holds** |
| `TapRespondGame.tsx:179`: the same pattern | same line (`disabled` at `:187`) | **holds**, with the same correction |
| `CultureQuizGame.tsx:80-95`: at least 700 ms (until the sound ends), then the next round | `handleTap` is `:80-104`; the wait `afterSound(sounding.current, { minMs: 700 })` is `:88`; the next round is `:89-97` | **moved** |
| `CardMatchGame.tsx:70, 187-195, 205-221`: a miss is only a 600 ms `nudgeLight` flash; the labels `:253, :288` never change | same lines | **holds**. Added: matched cards are drawn at opacity 0.5 (`:222`) and are `disabled` (`:256, :289`) |
| `HoyaBubble.tsx:55` uses only `accessibilityLiveRegion="polite"` (not supported on iOS) | same line | **holds** |
| `announceForScreenReader` has callers in only 7 files | At `d5ba0217c`: the definition plus 6 caller files. Now: 15 calls in 10 caller files. The TI rows added `TraceStrokeGame.tsx:259`, `TraceWordGame.tsx:419` and `TraceControls.tsx:84`; the durable-progress rows added `ProgressReadFailedScreen.tsx:143, 162` | **moved**. None of the 10 files is one of the six games above |
| `PromptPanel.tsx` already describes the "wrapper stays mounted" pattern | `apps/mobile/src/components/PromptPanel.tsx:13` | **holds** |
| AF-5 done by AU-17a: Tile's wrong state uses `text.primary` and the replay mark (`Tile/style.ts:45-51`; Tile pairs in `contrast.test.ts`) | same lines; the tests are `contrast.test.ts:203-266` | **holds for the wrong state only**. The `correct` state still has no mark (`style.ts:39-44`), and a locked wrong tile is still announced as disabled. Both land in AF-1 (§9); AF-5 is not reopened |
| `ChoiceCard` must have a mark on wrong | `ChoiceCard/style.ts:62-70` (`replay`, or `dash`); `correct` has `check` (`:53-61`) | **holds** |
| Decision 4: build on `afterSound(…, { minMs: 700 })` (QS-4, #1038) | `apps/mobile/src/logic/audio/reply-advance.ts:32-44` (`ANSWER_SOUND_MAX_MS` 2500 at `:17`; `ADVANCE_MIN_MS` 900 at `:13`); `sound-pacing.ts` `after(minMs, run, maxMs)` from `:86` | **holds** |
| Decision 4: reuse placement's `announceAndWait` pattern | `announceAndWait` is `apps/mobile/src/platform/screen-reader.ts:60-84`. It came in with #645 (F-CURR-001 Stage 4 Read Along: "announce, then play"). Its only caller is `screens/quest/DiscoverStep.tsx:193`, with a 320 ms gap (`motion.duration.slow`). Placement never calls it. Placement's own pattern: the reader state is read once at boot (`PlacementScreen.tsx:223`); nothing auto-plays while a reader is on (`placement/ItemScreen.tsx:174`); focus moves on each question to an accessible header View that has a question label (`ItemScreen.tsx:166-168, 236-247`). The module did start as placement's (F-PLC-001 §3.12, header `:3-11`) | **partly false**. This spec takes both patterns: Discover's `announceAndWait` and placement's reader check and focus move (§3.4) |
| Test: no colour literal is left in design-system ("the existing token test") | The existing no-literal test covers `Tile` only (`contrast.test.ts:258-266`). Literals remain at `Button.tsx:43` (the `nudge` pressed fill `#D89B2B`), `Pill/style.ts:24, 26` and `StarRow/StarRow.tsx:134` | **false as written**. §6 test 10 checks the surfaces this spec changes; the rest belongs to WO-41 (#2, #3). `Button.tsx:43` is in scope only if OD-AF1 (A) is chosen |
| Implementation note: `screen-reader.web.ts` always reads the reader as off | `screen-reader.web.ts:10-12` | **holds** |
| (WO-40 lines this spec relies on) `KoreanText.tsx:135-136, 152-153`; `a11y.koreanItem` `a11y.ts:293-`; the Tap & Respond label `:183`; the Culture Quiz Hangul heading `:123` | same lines (`koreanItem` is `a11y.ts:293-296`) | **holds** |

Since `d5ba0217c`, `MatchSoundGame.tsx` and `OddOneOutGame.tsx` changed one line each: the locale's "or" in the tile label (#1062). The other files WO-04 cites did not change.

### 1.3 The other games today

Read from code on `e72336a7d`. Each row PR gives the line numbers for its own games.

| Game | Correct mark | Miss mark | Miss look ends on a timer | State in the label | iOS hears the result | Advance after a correct answer |
|---|---|---|---|---|---|---|
| Listen & Pick | `check` (ChoiceCard) | `replay` | no | yes (`a11y.minigame.option`) | no | `pacing.after(700)` |
| Pic-Word Match | `check` and a number badge | `replay` | **yes, 600 ms** (`missClearMs`) | yes; the miss wording goes with the flash | no | `pacing.after(700)`, last pair only |
| Read Pick | `check` | `replay` | no | **no** | no | `pacing.after(900)`, **0 under reduced motion** |
| Cloze Pick | `check` (on the tile and in the gap) | `replay` | no | yes | no | `pacing.after(700, …, 6000)` |
| Realia Read | `check` | `replay` | no | yes | no | `setTimeout(700)`, not paced to sound |
| Story Sequence | `check` on the filled slot | `replay` | **yes, 600 ms** | own words; the miss wording goes with the flash | no | none per tap; replay, then Done |
| Story Order | the slot fills with the line (no check) | `replay` | **yes, 600 ms** | own words; the miss wording goes with the flash | correct placement only, **in Hangul** (`StoryOrderGame.tsx:177-180`) | none per tap; Done |
| Hidden Heritage | ring in the success colour (the found slot fills with the word) | ring in the nudge colour, **same shape** | **yes, 600 ms** (`MISS_RING_MS`) | found yes, miss no | no | `pacing.after(700)` |
| Syllable Build | `check` | a drawn nudge **dot** (not an icon) | no | partly | no | `pacing.after(900)` |
| Match Shape | `check` | a drawn nudge **dot** | no | found only | no | `pacing.after(900)`; origin rounds have Continue |
| Sentence Builder | `check` | `dash` in `text.secondary`; the tile **stays tappable** (`sentence-builder.md:75, 188`) | no | own words | no | its own wait, at least 600 ms |
| Role Play | colour while sending; then the reply moves into the log | `dash` in `text.secondary` on a locked reply, while the turn stays (`role-play.md:13, 116`) | no | miss yes | miss only: the why line, Hangul and romanization (`role-play/view.ts:113-114`, `RolePlayGame.tsx:177`) | `afterReply` (900 to 6000) |
| Story Check | "Correct" / "Try another" text | `replay` | no | yes | **yes, both** (`StoryCheckGame.tsx:88-91`, `:179-181`, `:224-227`) | Next button |
| Type Hangul, Write Frame, My Story | `check-circle` and a result line | marked blocks and a result line | no | the result line | by moving focus to the result line | `setTimeout(1100)` / Done |
| Trace Stroke, Trace a Word | owned by `AMENDMENTS-TRACE-IDLE.md` | | | | | |

In the `minigames` screens, no game uses `colors.feedback.danger` or the `close` (X) icon for a miss (checked by grep).

## 2. User story

> As a learner who cannot tell green from blue, I see a check on the answer that was right and a try-again mark on the one that was not, in every game.
>
> As a learner using VoiceOver, TalkBack or a screen reader in the browser, I hear "Right answer: sagwa, apple." once when I get it, and "Not this one: pear. Try another." once when I miss. The next question never cuts the line off.
>
> As a parent who reads Korean, I can watch my child play without the screen ever flashing a miss away before either of us has seen it.

## 3. Acceptance criteria

### 3.1 The result look (WO-04 decision 1)

One rule for every answer surface. Marks come from `packages/design-system` `Icon`.

| Result | Mark | Mark colour | Fill and border | Tappable | Accessible name and state |
|---|---|---|---|---|---|
| right | `check` | `feedback.success` on a light fill, `text.inverse` on a success fill | success family | no; **inactive**, never `disabled` | "Right answer: …" (§3.2) |
| miss; the learner tries again on the same question | `replay` ("try another") | `text.primary` | nudge family | no (locked); **inactive**, still focusable, never `disabled` | "Not this one: …" |
| look here (the second-miss hint, where a game has one) | as each game draws it today: `ChoiceCard` `hint` (thick `border.focus` ring); Hidden Heritage's dashed ring | — | as today | yes | "Look here: …" (`a11y.minigame.option.hint`, `a11y.ts:172`) |
| tried here, still tappable for another place (Sentence Builder only, per OD-AF8 (c)) | `dash` | `text.primary` (was `text.secondary`) | nudge family | **yes** | "…, tried" (as today) |
| not answered | none | — | as today | yes | plain name |

- **Never** `colors.feedback.danger`, never the `close` (X) icon, never an X drawn any other way.
- **Colour rule:** every mark is `text.primary`, except the `check`, which is `feedback.success`, or `text.inverse` on a success fill.
- **`dash` keeps its icon-set meaning** for a locked miss that moves on (`Icon/glyphs.ts:129-131`; the F-VOC-004 Speed Round, out of scope §4). No game in §3.6 has that case. Its one use here is Sentence Builder's tried tile, and only if OD-AF8 (c) is chosen.
- **Decorative:** the mark is hidden from assistive tech, because the accessible name carries the state (as `Tile.tsx:32-43` and `ChoiceCard` already do).
- **Contrast:** the mark reads at 3:1 or more on its state's fill (WCAG 1.4.11):
  - `check` in `feedback.success` on `successLight`: 4.28:1
  - white `check` on a success fill: 5.21:1
  - `replay` in `text.primary` on `nudgeLight`: 14.02:1; on a nudge fill: 8.66:1
- **Placement:** the mark sits out of the flow, as `TILE_MARK` does (`Tile/style.ts:65-71`), so it never covers the glyph, the romanization or the gloss at any text size.
- **Size:** AF-0b sets one minimum mark size. Aim for 20 to 24 dp where the surface has room; `Tile`'s 16 dp (`TILE_MARK`) is checked against it. Check it at a 320 width and at 200 % text.
  - On a tile the mark is the only greyscale cue.
  - `replay` also appears on action buttons (e.g. `SoundNeededScreen.tsx:38`). AF-0b checks that a learner does not read the mark as a button. The beta notes record how learners read it.
- **Greyscale:** right, miss, look-here and not-answered are told apart in greyscale without colour.
- **`ChoiceCard` `wrong` stops being `selected`:** it is `selected: false` (was `true`, `ChoiceCard/style.ts:62-70`, forwarded at `ChoiceCard.tsx:130`). Otherwise a reader says "Not this one: pear, selected", and "selected" sounds like the answer. `correct` stays `selected`.

**Locked is not disabled.**

- `Tile` gains `locked?: boolean`. A locked tile goes to `TapTarget` as `inactive` (claimed by the board, no press look, focusable, not `disabled`), the way `ChoiceCard` already passes a locked card (`ChoiceCard.tsx:128`).
- Match Sound and Odd One Out pass `locked` instead of `disabled` for a wrong tile.
- Card Match's matched cards become `inactive`, not `disabled`.
- `Tile/types.ts:10`'s "announced as disabled" applies only to a real `disabled` tile: Build a Letter's used tray tiles.

Per surface:

| Surface | Change | Row |
|---|---|---|
| `ChoiceCard` | `wrong` is not `selected`; the marks already follow the rule (`style.ts:53-70`) | AF-1 |
| `Tile` | `correct` gets `check` in `feedback.success` at the AF-0b size; `wrong` keeps `replay` (AU-17a); new `locked` prop | AF-1 |
| Culture Quiz, Tap & Respond answers | per OD-AF1: (B, recommended) `ChoiceCard` in row layout; (A) a `Button` result look (needs a locked path in `Button` that is neither `softDisabled` nor `disabled`: both set `looksDisabled`, `Button.tsx:111, 186`). Either way a locked miss is no longer drawn or announced as disabled | AF-2 |
| Card Match cards | a right pair: `check` on both cards, fill and border as today, **full opacity** (the 0.5 fade goes: its text is 2.94:1), inactive. A miss: `replay` on the meaning tried (§3.5). The picked Korean card is shown by colour alone today; AF-0b gives it a non-colour cue too | AF-3 |
| Build a Letter target box | a right block: `check` on the target box beside its success fill | AF-4a |
| Hidden Heritage rings | the found ring gets `check`, the miss ring gets `replay`; the look-here ring stays dashed. Today found and miss differ by colour alone | AF-4c |
| Syllable Build, Match Shape | the drawn nudge dot becomes `replay` (OD-AF8) | AF-4c |
| Role Play | a locked reply's `dash` becomes `replay`, in `text.primary` (OD-AF8) | AF-4c |
| Sentence Builder | the tried tile keeps `dash` (OD-AF8 (c)), now in `text.primary` | AF-4c |

The size, corner and inset of each new mark come from the design pass (AF-0b). The wireframe is `design/wireframes/minigame/answer-feedback.md`.

### 3.2 The words: labels and announcements (WO-04 decisions 2 and 6)

**Labels (decision 6).**

- An answered option's accessible name starts with its state. It uses the existing keys (`packages/i18n/src/messages/en/a11y.ts:169-176`):
  - `a11y.minigame.option.correct(base)` → "Right answer: {base}"
  - `a11y.minigame.option.wrong(base)` → "Not this one: {base}"
  - `a11y.minigame.option.hint(base)` → "Look here: {base}"
- These keys are already used by Listen & Pick, Pic-Word Match, Cloze Pick, Realia Read and Role Play, and are already translated and reviewed in es and ko.
- WO-04 proposed suffixes (", correct" / ", try another"). This spec reuses the prefixes instead (OD-AF4).
- `base` is the option's name before the answer, without any "tap to select" part:
  - a jamo tile: its sound value (`a11yRomanization`: "n", "silent or ng")
  - a Korean option: its name today
  - a UI-language option: its text
- Card Match's matched cards use `option.correct` too ("Right answer: Korean word gimchi"). There is no new label key. Revision 1's `option.paired` duplicated `option.matched(badge, label)` (`a11y.ts:175`) and is dropped.
- A pure helper, `answerOptionLabel(state, base, option)` in `logic/answer-feedback.ts`, does this. Listen & Pick's own copy (`listen-pick-flow.ts:325`) may move onto it.
- **Fallback for a double read** (§3.8): if a device check finds that renaming the option that was just pressed makes TalkBack or a web reader say the result twice (once from the new name, once from the announcer), that platform keeps the old name until the next round. The mark and the announcement still carry the result.

**Announcements (decision 2).**

- An announcement is one line, built by `answerAnnouncement(result, a11y)` (pure). Each template adds at most 12 words of its own.

| Kind | Key | English | Used by |
|---|---|---|---|
| right | `a11y.answer.right(item)` | Right answer: {item}. | every game's right answer, Card Match's pair and Build a Letter's block included |
| miss | `a11y.answer.miss(item)` | Not this one: {item}. Try another. | a pick with no hint line (Culture Quiz, Tap & Respond, Read Pick, …) |
| miss, sound prompt | `a11y.answer.missListen(item)` | Not this one: {item}. Listen again. | Match Sound, Listen & Pick, Syllable Build |
| miss with a hint | `a11y.answer.missHint(item, hint)` | Not this one: {item}. {hint} | a game whose Hoya line is a real hint (Odd One Out `lookAgain`, Sentence Builder, Role Play's why line, Match Shape's diff note), and **every miss that turns a look-here hint on**: `hint` is then the game's look-here line |
| pair that does not match | `a11y.answer.notMatched(word, meaning)` | Not a match: {word} and {meaning}. Try another. | Card Match |
| a whole line | none: an existing dictionary line, used as is | (e.g. Build a Letter's `notQuite(hint)`) | Build a Letter's miss, where no single option was picked |

- **`item`** names the answer without taught-Korean Hangul:
  - a jamo: its sound value
  - a Korean word or reply: `a11y.answer.item(romanization, gloss?)` → "{romanization}, {gloss}", or "{romanization}" when there is no gloss (e.g. the Korean UI under OD-R5, where the meaning may be a picture)
  - a UI-language option: its text
  - **Culture Quiz:** the right answer names the word *and* its meaning: `right(item(promptRomanization, meaning))` → "Right answer: sagwa, apple." A miss names the meaning picked: "Not this one: pear. Try another."

**Korean, lined up with WO-40** (`phase-5-native-a11y.md`, WO-40; OD-AF5):

- **No taught-Korean Hangul in an announcement.**
  - The iOS call takes one plain string, with no language for any part of it. Hangul in it would be read in the UI voice, or skipped.
  - This follows the existing rule for spoken names of taught Korean: `a11y.minigame.hear(romanization)` (`a11y.ts:105-107`: "`romanization` is a sound value, never Hangul"), `koreanWord(romanization ?? ko)`, and the jamo tile labels (`logic/korean-labels.ts`).
- **In the Korean UI** the templates themselves are Hangul ("정답: …"). That is UI language, not taught Korean, so it is allowed.
  - The romanization in them is read by the Korean voice. WO-40's LP-0 survey should record how that sounds.
  - R8's ko draft keeps `{item}` as given.
- **Segments:** `answerAnnouncement` returns the line as segments (`{ text, lang? }[]`), and the announcer renders one `Text` per segment. This spec emits only UI-language segments.
  - If LP-0 finds that a `lang="ko"` segment in a live region is read in a Korean voice on the web or on Android, LP-3 can add a Hangul segment there without changing a caller.
  - iOS keeps the plain string.
- **Lines that move onto the hook** stop carrying Hangul. This is a deliberate change, reversible by LP-3:
  - Story Order's placement line becomes `slotLabel(n, total, item(romanization, gloss))`, so the position stays. It was `slotLabel(n, total, card.line.ko)`, Hangul only, at `StoryOrderGame.tsx:177`.
  - Role Play's why line and Sentence Builder's hint render their `{ko:}` tokens as romanization only, through a new pure `spokenParts`. It sits beside `partsText`, which keeps Hangul plus romanization for the visible line.
  - Story Order's replay lines ("ko. en", `StoryOrderGame.tsx:243-245`) are not results. They stay as they are; WO-40 owns them.
- Story Check already marks Korean inside an English line for a Korean voice (`StoryCheckGame.tsx:81-82`, F-STORY-003 §3.10). It is the precedent WO-40 will measure, and this spec does not change it.

### 3.3 One announcement per result (WO-04 decision 3)

**The announcer** (`apps/mobile/src/screens/minigames/answer-announcer.tsx`, new). There is one per game screen.

- It is mounted for the screen's whole life and stays empty until the first result.
- It is visually hidden, using the `srOnly` style. That style moves to a neutral one-line module, `screens/minigames/sr-only.ts`, which `korean-speech.ts` re-exports, so the announcer does not import the speech module.
- It is `accessibilityLiveRegion="polite"`, plus `aria-live="polite"` on the web. It is never `assertive` and never focusable.
- **Per platform** (iOS gets its result through the API instead):
  - **iOS:** the announcer is hidden from VoiceOver (`accessibilityElementsHidden`, as Story Check's `a11yHidden`, `StoryCheckGame.tsx:84-85`), because its channel there is the announcement call.
  - **Android:** it stays a live region. `no-hide-descendants` would silence it, so it can be reached by swiping, but it is emptied each round.
  - **Web:** it can be reached by swiping and is emptied each round.

**Channels.**

- Web and Android read the region.
- iOS has no live regions, so the hook makes exactly one queued call per result: `announceForAccessibilityWithOptions(text, { queue: true })`. It is queued, as Story Check's call is (`StoryCheckGame.tsx:88-91`), so it neither cuts off nor is cut off by VoiceOver reading the control just pressed.
  - react-native-web 0.19.13 has no `announceForAccessibilityWithOptions`. So the hook never calls `AccessibilityInfo` itself: the call lives in `platform/screen-reader.ts`, guarded by `Platform.OS === 'ios'`, and it is a no-op in `screen-reader.web.ts`. Tests mock the platform module.
- Android gets no `announceForAccessibility` call as well: the region is its channel (WO-04 decision 3; the rule at `screen-reader.ts:37-49`).

**The hook** `useAnswerAnnouncement()` (`screens/minigames/use-answer-announcement.ts`, new). It only wires the pure rules and the platform calls together; every decision is in `logic/answer-feedback.ts`, which is covered by tests.

- `announce(result): Promise<void>`: writes the region and makes the iOS call. The promise settles when the line has been said (§3.4).
- `clear()`: when a new round opens.
- `readerOn: boolean`:
  - native: `isScreenReaderEnabled()`, kept current with `subscribeScreenReader` (`screen-reader.ts:12-24`)
  - web: OD-AF3
- `focusPrompt()`: §3.4.

**The text.**

- It changes once per result and is emptied when a new round opens.
- When the same text comes twice in a row (possible across rounds), its `Text` gets a new key so it is read again.

**Only result regions go quiet.**

- In a game that uses the hook, the **result** bubble and the **result** wrapper stop being live, because the announcer says the result.
- Regions that carry status, not a result, stay live.
- `HoyaBubble` gets `live?: boolean`, default `true`, so every other caller keeps today's behaviour.

| Game | Stop being live (result) | Stay live (status) |
|---|---|---|
| Culture Quiz, Tap & Respond, Odd One Out, Build a Letter | the miss `HoyaBubble` (`live={false}`) | `PromptPanel` |
| Match Sound | the miss `HoyaBubble` (with its Hear it button) | `PromptPanel` |
| Card Match | the new miss bubble (§3.5) | the `nowMeaning` pick prompt bubble (`CardMatchGame.tsx:319-324`, idle); `PromptPanel` |
| Listen & Pick | the result wrapper `:489`; the prompt wrapper `:419`, which only gains the word after a right answer | `PromptPanel` |
| Pic-Word Match | the miss wrapper `:323` | the selection caption `:253` ("Picture selected …"); `PromptPanel` |
| Read Pick, Cloze Pick, Realia Read | the result wrappers (`:134`; `:402`; `:300`) | `PromptPanel` |
| Story Sequence | the Hoya wrapper `:531` | — |
| Story Order | the placement line `:443` (moves onto the hook) and the Hoya wrapper `:488` | the replay line `:314` |
| Hidden Heritage | the live caption `:485` (`liveText`, moves onto the hook; the caption stays visible) | — |
| Syllable Build | the built block `:308` and the Hoya wrapper `:410` | the show-the-sound link `:321`; `PromptPanel` |
| Match Shape | the Hoya wrappers `:277` (with its diff note) and `:368` | `PromptPanel` |
| Sentence Builder | the placed line `:322`, the done panel `:341` and the hint wrapper `:350` | — |
| Role Play | the why bubble `:674` | — |

- Not changed: Story Check (already one announcement per result).
- Nothing here is ever `assertive`.

### 3.4 When the round moves on (WO-04 decision 4)

**Reader off** (native, or the web when OD-AF3 leaves the reader path off).

- The game waits as it does today: `afterSound(sound, { minMs })` or `pacing.after(minMs, …)` (QS-4).
- The least wait is `max(game's least wait, RESULT_MARK_MIN_MS)`. OD-AF2 sets `RESULT_MARK_MIN_MS`: 0 under (a), 1000 under (b, recommended), 1200 under (c).
- The floor is applied by the screen, so each flow keeps its own constant and its tests (as QS-4 kept them).
- The floor also covers Read Pick's reduced-motion 0 (`ReadPickGame.tsx:93`): reduced motion asks for less motion, not less time to see the mark.
- Odd One Out's bare `setTimeout(…, 700)` moves onto `pacing.after`, so the wait is paced and is dropped on unmount.
- Focus does not move. On the web, a reader that the app cannot detect is not guaranteed the whole line before the next round starts; OD-AF3 is the fix. The floor gives a sighted learner time to see the mark. It is **not** claimed to give a reader time to hear the line.

**Reader on** (native, or the web under OD-AF3 (d)): OD-AF9.

- **(b, recommended): Next after a right answer.**
  - The right answer's mark and name show, and a **Next** button appears below the answers (as in Story Check and after a Trace tip). It reuses the existing "Next" string, `learner.minigame.trace.next.cta`.
  - Focus moves to Next. The announcement is queued after the focus move (iOS `queue: true`; Story Check does this at `StoryCheckGame.tsx:224-227`).
  - The round moves on only when Next is pressed. Nothing waits on a guess about how long a reader takes.
  - An answer that plays a sound (Tap & Respond's reply, Listen & Pick's clip) starts it once the announcement has been said. iOS uses `announceAndWait` with `queue`; Android and the web use the length-scaled wait of (a). A wrong guess here only overlaps sound, and nothing moves on.
- **(a): timed, as revision 1 drafted.** In order: announce, then the answer's own sound, then the least wait, then the advance.
  - iOS waits for `announcementFinished`. It counts the event only when the event's `announcement` equals the text (today `announceAndWait` takes any event, `screen-reader.ts:78`). A lost event is guarded by a timeout of at least 8 s; `ANNOUNCE_TIMEOUT_MS` = 3000 was sized for Discover's short labels.
  - Android, and the web under (d), cannot tell when the reader has finished. They wait `announceWaitMs(text)`, a pure function that scales with the line's length, and it is tuned on a device at the slowest default rate with the es and ko lines (§3.8).
- **Either way:**
  - A sound the game would play by itself after a miss (Match Sound's replay, `MatchSoundGame.tsx:151-154`; Listen & Pick's `replayDelayMs`; Syllable Build's `REPLAY_AFTER_MS`, all 800 ms) is not played while a reader is on. The learner taps Hear it. This follows placement's "nothing auto-plays with a reader" and AU-10's Discover rule (`DiscoverStep.tsx:257`).
  - Round-start auto-play is WO-41 #6's to fix. Until then, Match Sound's next round may still speak over the focus move.
- **Focus on the new round** goes to its prompt, through `focusPrompt()` (`focusForScreenReader`, `screen-reader.ts:31-35`, DOM focus on the web). The target node:
  - It is an accessible View, `accessibilityRole="header"`, with the label `a11y.answer.round(n, total, prompt)`, as placement's `ItemScreen.tsx:236-247`.
  - It wraps the round's heading and any Korean shown as text, **never a button**. On iOS an accessible View swallows the buttons inside it.
  - It is **never the raw Hangul heading**, which WO-40 lists as read in the wrong voice (`CultureQuizGame.tsx:123`). The label names the Korean by romanization.
  - This is the round-level exception to `shell.md` §12's "nothing steals focus". Screen-level focus stays WO-39's (SS-3).

| Game | Focus node wraps | `prompt` in the label |
|---|---|---|
| Culture Quiz | the heading and the Korean word (`:120-124`), not Hear it | `cultureQuiz.heading` + the word's romanization ("What does this mean? sagwa") |
| Tap & Respond | "Someone says" and the line (`:141-146`), not Hear it | `tapRespond.someoneSays` + `item(npcRomanization, npcEn)` |
| Match Sound | the heading (`:175`) | `view.heading` |
| Odd One Out | the heading and the instruction (`:101-103`) | the heading + the instruction |
| Build a Letter | the heading (`:188`) | the heading + the target's romanization |
| Listen & Pick, Cloze Pick, Realia Read, Read Pick, Hidden Heritage, Syllable Build, Match Shape, Role Play | the game's heading block, as named in the row PR, following the same rule | the heading text + any taught Korean on it, by romanization |
| Card Match, Pic-Word Match (before its last pair), Story Sequence, Story Order, Sentence Builder | no per-tap round change: focus stays where it is | — |

**Neither a miss nor a result changes the screen by itself.** The only exception is the right answer's advance under reader off or OD-AF9 (a). Build a Letter's slot reset is OD-AF7's.

### 3.5 A miss stays until the learner acts (WO-04 decision 5)

**Card Match (OD-AF6).**

- After a wrong pair, the meaning that was tried shows the miss look (amber plus `replay`). It is inactive, its name is "Not this one: …", and it stays **while the same Korean word is picked**.
- The Korean card stays picked (its picked look, no amber), so the learner can tap another meaning at once. A second wrong meaning for the same word is marked too.
- The marks clear when that word is matched or when the learner picks another Korean word.
- The 600 ms timer (`WRONG_FLASH_MS`, `:70`) goes, and so does its pick release (`:189-195`).
- KT-4a's guarantees still hold: a bounce on the amber meaning is not a second miss (it is inactive), and no timer ever undoes the next pick (there is no timer).
- **Hoya on a miss** (CLAUDE.md §1: a miss uses the amber nudge and Hoya's `thinking` pose). While a miss mark shows, the idle `nowMeaning` bubble becomes a `thinking` bubble with a new line: `learner.minigame.cardMatch.tryAnother`, "Not a match. Try another meaning." That bubble is not live, because the announcer says the result. When no miss shows, the idle `nowMeaning` bubble comes back, live as today.

**The other games with a timed miss (OD-AF7, recommended "yes").**

- These are Pic-Word Match, Story Sequence and Story Order (600 ms), and Hidden Heritage's 600 ms miss ring.
- Their miss look, and the miss words in the name, stay until the learner's next tap that changes the board.

**Build a Letter (OD-AF7, sub-option).** Today the wrong build empties after 900 ms and the hint goes with it.

- (i), recommended: the wrong build stays in the slots, with the miss look and the hint, until the learner takes a tile back (a slot tap), taps Undo, or taps a tray tile. A tray tile empties the slots and starts a new build with that tile. The 900 ms timer and its tap lock (`WRONG_RESET_MS`) go.
- (ii): the slots still empty after 900 ms, but the hint stays until the next tile is placed.

If OD-AF7 is declined, only Card Match changes.

### 3.6 Per game

| Game | Marks (§3.1) | Labels (§3.2) | Announcer (§3.3) | Timing and focus (§3.4) | Miss stays (§3.5) | Row |
|---|---|---|---|---|---|---|
| Culture Quiz | per OD-AF1 | `option.correct` / `.wrong` (base = the meaning) | right (`item(promptRomanization, meaning)`) / miss | floor; reader: OD-AF9; focus node per the §3.4 table | already (the locked list) | AF-2 |
| Tap & Respond | per OD-AF1 | the same (base = today's reply label) | right / miss (`item(romanization, gloss)`) | `afterReply` (900), floor; reader: OD-AF9, the reply after the line | already | AF-2 |
| Card Match | `check` on both cards; `replay` on the meaning tried; matched cards inactive | `option.correct` on matched cards; `option.wrong` on the meaning tried | right (`item(romanization, gloss)`) / notMatched | the last pair's 800 ms, floor; no focus move | OD-AF6; Hoya `thinking` | AF-3 |
| Match Sound | `Tile` `check`; `locked` | `option.correct` / `.wrong` (base = sound value) | right / missListen | floor; reader: no miss replay; OD-AF9 | already | AF-4a |
| Odd One Out | `Tile` `check`; `locked` | the same | right / missHint (`oddOneOut.lookAgain`) | moves onto `pacing.after`, floor | already | AF-4a |
| Build a Letter | `check` on the target box | none: the target is the speaker and keeps its "Hear …" name; the slots keep their take-back names | right (the target's romanization) / the `notQuite` line | 900 ms, floor | OD-AF7 sub-option | AF-4a |
| Listen & Pick, Cloze Pick, Realia Read | none | none (they already name the state) | right / missListen or miss; missHint with the look-here line when the hint turns on | floor; reader: OD-AF9, no miss replay | — | AF-4b |
| Read Pick | none | add the state (`answerOptionLabel`) | right / miss | floor (reduced motion included) | — | AF-4b |
| Pic-Word Match | none | none | right (the matched pair) / miss | floor (last pair) | OD-AF7 | AF-4b |
| Story Sequence, Story Order | Story Order's slot: as is | as is | right (`slotLabel(n, total, item)`) / miss; Story Order's iOS call moves onto the hook | none per tap | OD-AF7 | AF-4b |
| Hidden Heritage | ring marks | the missed spot gets its state | right / missHint ("Look again"), replacing `liveText`; the look-here line when the hint turns on | floor | OD-AF7 | AF-4c |
| Syllable Build, Match Shape | dot → `replay` (OD-AF8) | the state on marked tiles and zones | right / missListen or missHint (Match Shape's diff note); the look-here line when the hint turns on | floor; reader: no miss replay | already | AF-4c |
| Sentence Builder | `dash` in `text.primary` (OD-AF8 (c)) | as is | its placed line and hint go through the hook, `{ko:}` read as romanization | its own wait, floor | already | AF-4c |
| Role Play | `replay` on a locked reply (OD-AF8) | add the state to the sent reply | right / missHint (why line, `spokenParts`); the existing iOS call moves onto the hook | `afterReply`, floor; reader: OD-AF9 | already | AF-4c |
| Story Check, Type Hangul, Write Frame, My Story, Trace Stroke, Trace a Word, Story Read, Voice Echo | not changed (§4) | | | | | — |

- **Owner decision 2026-11-24 (AF-0b review, Q1):** with a screen reader on, Next (§3.4, OD-AF9 (b)) shows after every right answer that ends a round, the last round and the last pair included, and the step moves on only when Next is pressed. Card Match's last-pair 800 ms (and Pic-Word Match's last-pair floor) apply only with the reader off. Design: `design/components/AnswerFeedback/spec.md` D9.

### 3.7 Strings (English; `packages/i18n/src/messages/en/`)

| Key | English |
|---|---|
| `a11y.answer.item` | `(romanization, gloss?)` → {romanization}, {gloss}; {romanization} alone when there is no gloss |
| `a11y.answer.right` | Right answer: {item}. |
| `a11y.answer.miss` | Not this one: {item}. Try another. |
| `a11y.answer.missListen` | Not this one: {item}. Listen again. |
| `a11y.answer.missHint` | Not this one: {item}. {hint} |
| `a11y.answer.notMatched` | Not a match: {word} and {meaning}. Try another. |
| `a11y.answer.round` | Question {n} of {total}. {prompt} |
| `learner.minigame.cardMatch.tryAnother` (drawn, Hoya) | Not a match. Try another meaning. |
| `common.display.screenReaderHelp` (drawn, the Display sheet's screen-reader row, web only; owner decision 2026-11-24, AF-0b Q3) | Tap Next to go on. Sounds play when you tap them. |

- Reused, not new:
  - `a11y.minigame.option.correct`, `.wrong` and `.hint`
  - `a11y.romanizationOr`
  - `learner.minigame.trace.next.cta` (Next, under OD-AF9 (b))
  - `learner.story.sequence.slotLabel`
  - each game's existing Hoya lines
  - under OD-AF3 (d), the level check's "I use a screen reader" label (`learner.ts:1468`); the row's help line is `common.display.screenReaderHelp` (above)
- Dropped since revision 1: `a11y.answer.matched` and `a11y.minigame.option.paired` (both duplicated existing keys).
- **es and ko:** this spec lists English only. Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts`, `LOCALE_STATUS`), and `i18n-status.mjs` fails a PR that adds an English key without them. So AF-1 carries es and ko values in the same PR, drafted by R8 and reviewed under F-I18N-001 §3.10, with the ledger re-signed. No es or ko string is written ad hoc.
- **Rebases:** `a11y.ts` and the `a11y` entry of `packages/i18n/src/messages/review-ledger.json` are also changed by WO-40 and WO-41. Every PR that touches `a11y.ts` re-signs the ledger, so expect mechanical rebases there.

### 3.8 [On device, owner]

**Screen readers.** VoiceOver (iOS) and TalkBack (Android) in Culture Quiz, Tap & Respond, Card Match, Match Sound and Listen & Pick:

- Each right answer and each miss is read **once** and is never cut off by the next round.
- Focus lands on Next (OD-AF9 (b)) or on the next round's prompt.
- A locked miss is never read as "dimmed" or "disabled".
- **Double read:** after a right answer, the pressed option's new name ("Right answer: …") and the announcer must not both be read. If they are on a platform, apply §3.2's fallback.
- **Under OD-AF9 (a):** tune `announceWaitMs` with TalkBack at its slowest default rate, using the longest en, es and ko lines.

**One web reader** (VoiceOver with Safari, or NVDA with Chrome):

- With OD-AF3 (d) on, the result is read once and the next round does not cut it off.
- With the flag off, record what happens: it is not guaranteed (§3.4).

**Greyscale** (the phone's colour filters): in each game of §3.6, right, miss, look-here and not-answered are told apart, and so is Card Match's picked card.

## 4. Out of scope

- How Hangul is voiced in labels and announcements: WO-40 (LP-0 to LP-3). §3.2 leaves it a slot. Add "a `lang="ko"` segment in a live region" and "romanization read by the Korean voice" to the LP-0 survey.
- Heading levels, landmarks, document titles and screen-level focus: WO-39.
- CI accessibility checks (the axe smoke and ESLint a11y): WO-08. Its baseline shrinks as these rows merge, and "Culture Quiz right after an answer" is one of its smoke targets.
- Round-start auto-play while a screen reader is on, and a web "play sounds by themselves" setting: WO-41 #6. Under OD-AF3 (d) that setting can read the same device flag.
- Playing the right answer's recorded word after the line with a reader on (Culture Quiz, Build a Letter). Hear it is one tap away; any automatic sound with a reader belongs with WO-41 #6.
- Hoya as decoration inside the bubble, and the design-system's English default labels (`Tile.tsx:111` "Korean letter …, tap to select", `Hoya.tsx:111`): WO-41 #8.
- The colour literals left in design-system (`Button.tsx:43`, `Pill/style.ts:24, 26`, `StarRow.tsx:134`): WO-41 #2 and #3. The exception: if OD-AF1 (A) makes `Button` an answer surface, AF-2 moves `Button.tsx:43` onto a token.
- Games that already deliver a result, which this spec leaves alone (WO-42 checks them on a device):
  - Story Check: one announcement per result, a Next button.
  - Type Hangul, Write Frame and My Story: focus moves to the result line.
  - Trace Stroke and Trace a Word: `AMENDMENTS-TRACE-IDLE.md`.
  - Story Read: no answer.
  - Voice Echo: behind a flag, no miss.
  - The Speed Round's locked-miss `dash`.
- Answer screens outside `MinigameScreen` (the vocabulary question view, the Speed Round, Decode Sprint, the level check, Daily Review, Yut review): a follow-up WO, once this one has shown the pattern.
- Telemetry: none is added.
- New dependencies: none. Everything here uses React Native's `AccessibilityInfo` and the existing design system.

## 5. UI sketch

- Wireframe (this row): `design/wireframes/minigame/answer-feedback.md`. It builds on `design/wireframes/minigame/families.md` and `shell.md`.
- Mock (row AF-0b): `design/components/AnswerFeedback/spec.md` with `design/components/AnswerFeedback/mock/answer-feedback-states.html` and greyscale captures. It covers:
  - every new mark of §3.1 and the minimum mark size
  - the look-here state
  - the answer surface chosen under OD-AF1
  - Card Match's states, including a non-colour cue for the picked card
  - the Hidden Heritage rings
  - the OD-AF8 marks
  - the Next button of OD-AF9 (b)
  - the screen-reader switch of OD-AF3 (d) in the Display sheet
  - the hidden announcer and `HoyaBubble`'s `live` prop (behaviour only, no look)
  - a note on Tile and `selected` in `design/components/ChoiceCard/spec.md`
- Multi-agent review approves the pass (CLAUDE.md §5).

## 6. Tests

**Unit, pure** (`apps/mobile/src/logic/__tests__/answer-feedback.test.ts`; unit lane, covered):

1. `answerAnnouncement`, `spokenParts` and the `a11y.answer.round` label:
   - For each kind in §3.2, the English line is the one §3.7 gives.
   - None of these outputs, for any kind and any fixture, contains a Hangul code point (U+1100-11FF, U+3130-318F, U+AC00-D7AF). This pins the WO-40 alignment until LP-3 changes it on purpose. The check covers the hook's output only; visible lines and labels may hold Hangul.
   - `item` with no gloss gives the romanization alone.
2. `answerOptionLabel`: idle → base; correct → `option.correct(base)`; wrong → `option.wrong(base)`; hint → `option.hint(base)`.
3. `resultLeastWait(gameMin)` = `max(gameMin, RESULT_MARK_MIN_MS)`, including a reduced-motion 0. `readerPath({ nativeReader, webFlag, platform })` follows the §3.4 and OD-AF3 rules.
4. With fake timers and a fake sound:
   - Reader off: the advance waits for the sound and for the least wait, as today.
   - Reader on, OD-AF9 (b): no advance until Next; the answer's sound starts after the line.
   - Reader on, OD-AF9 (a): line, then sound, then advance. `announceWaitMs` grows with the text and stays within its bounds.
   - A reader on: no automatic replay after a miss.

**Platform** (`apps/mobile/src/platform/__tests__/screen-reader.test.ts`, `screen-reader.web.test.ts`; unit lane, covered):

5. iOS: the queued announce calls `announceForAccessibilityWithOptions(text, { queue: true })` exactly once. Android: no announce call. `announceAndWait(…, { queue: true })` settles only on an `announcementFinished` event whose `announcement` equals its text, or on its timeout; an event for another line does not end it. A reader that is off settles at once, with no call.
6. Web: every call is a no-op; nothing touches `AccessibilityInfo.announceForAccessibilityWithOptions`.

**Announcer and hook** (`apps/mobile/src/screens/minigames/__tests__/answer-announcer.test.tsx`; render lane, the `prompt-slot-settled` pattern). The React glue sits outside both coverage lanes and stays thin; its decisions are in tests 1-6.

7. `AnswerAnnouncer`:
   - It is present and empty before any result, and polite (`accessibilityLiveRegion` and `aria-live`). There is no `assertive` anywhere.
   - On iOS it is `accessibilityElementsHidden`; on Android and the web it is not hidden.
   - Its text changes once per result, and the same text twice in a row gets a new key.
   - `clear()` empties it.
8. `useAnswerAnnouncement`:
   - One iOS call per result; none on Android or the web.
   - It follows `subscribeScreenReader` when the reader is turned on mid-game.
   - It follows the web flag under OD-AF3 (d).
   - `focusPrompt()` moves focus to the header node, and only when the reader path is on.

**Design system** (`packages/design-system/src/`):

9. `HoyaBubble`: `live={false}` renders no live region; the default stays polite (existing tests unchanged).
10. Marks and states:
    - `Tile` `correct` has a `check` in a colour token, at 3:1 or more on its fill.
    - `Tile` `locked` reaches `TapTarget` as `inactive`, and its `accessibilityState.disabled` is not `true`.
    - `ChoiceCard` `wrong` has `selected: false` (`choice-card.test.ts`).
    - The existing loops (`contrast.test.ts:203-266`) keep the token and "differs from idle by more than its border" rules for every state. If AF-3 draws Card Match's card from a pure style (recommended: `cardMatchStyle`), the same rules cover it.

**Screens** (`apps/mobile/src/screens/minigames/__tests__/`; testing-library, fake timers; `platform/screen-reader` mocked):

11. Culture Quiz:
    - After a right answer, the option shows `check` and is named "Right answer: …". After a miss, it shows `replay`, is named "Not this one: …", is focusable, and its `accessibilityState.disabled` is not `true`.
    - The announcer's text changes once per result: "Right answer: sagwa, apple.".
    - iOS: one call.
    - Reader on: per OD-AF9, Next takes focus, or the round waits for the matching `announcementFinished`; then focus is on the header node, whose label holds no Hangul.
    - Reader off: the next round comes after the floor, and focus does not move.
12. Tap & Respond: as test 11. With a reader on, the reply clip starts after the line.
13. Card Match:
    - A miss: the meaning shows `replay` and is still marked 10 s later. The Korean pick is held, and Hoya is `thinking` with `tryAnother`. Another meaning is then scored. Another Korean word clears the mark.
    - Matched cards show `check` at full opacity, are named "Right answer: …", and are not `disabled`.
    - No timer un-selects a pick (KT-4a's F3 test, rewritten).
14. Match Sound and Odd One Out:
    - The right tile has `check` and is named "Right answer: {sound}". A locked tile is not `disabled`.
    - Match Sound, reader on: no replay after a miss.
    - Odd One Out's advance is dropped on unmount.
15. Build a Letter: `check` on the target box after a right block. After a miss, per the OD-AF7 sub-option: (i) the wrong build and the hint stay until a slot tap, Undo or a tray tap; (ii) the hint stays past the 900 ms reset until the next tile.
16. One test per game in AF-4b and AF-4c:
    - Right and miss are each announced once (the region text plus one iOS call).
    - The §3.3 table's result regions are no longer live, and its status regions still are.
    - The names are as §3.6 says.
    - Story Order's, Role Play's and Sentence Builder's announced lines hold no Hangul, while Story Order's replay line is unchanged.
    - A miss that turns the hint on announces the look-here line.
    - With OD-AF7, the miss look is still there after the old 600 ms.

**Start bundle** (AF-1). The announcer module is shared by games in the entry and by chunked games (Sentence Builder, Hidden Heritage, Syllable Build, Match Shape, Cloze Pick, writing), so it folds into the entry by design (`start-bundle-content.test.ts`; `AMENDMENTS-FINISH-2026-11.md` FN-7).

17. Measure `build:web` (CI=1) against `PRECACHE_BUDGET.startBundleRaw`, 4,604,100 B (`apps/mobile/scripts/pwa/lesson-chunks.mjs:251`, test `lesson-chunks.test.mjs:741`).
    - Keep `logic/answer-feedback.ts`, the announcer and the hook small enough to stay under the line.
    - If they do not fit, AF-1 records one measured raise, with its numbers, in the `lesson-chunks.mjs` comment, as earlier rows did.

**e2e** (web; `web-app.yml` runs it on `main`, owner decision 2026-11-18):

18. `apps/mobile/e2e/web/answer-feedback.spec.ts`: in Culture Quiz, after a right answer, one `aria-live="polite"` region holds "Right answer:" once, and no element on the page is `aria-live="assertive"`.

**Existing tests that change** (each row lists its own):

- `packages/design-system/src/components/Tile/__tests__/Tile.test.tsx:174-177` ("idle, correct and disabled tiles draw no mark"), and `choice-card.test.ts`
- `CardMatchGame.test.tsx` (the flash and stale-timer cases)
- the Culture Quiz cases in `answer-sound-advance.test.tsx` (the floor)
- `TapRespondGame.test.tsx`, `MatchSoundGame.test.tsx`, `OddOneOutGame.test.tsx`, `BuildLetterGame.test.tsx`
- `PicWordMatchGame-boards.test.tsx` (`missClearMs`)
- `HiddenHeritageGame.test.tsx`, `RolePlayGame.test.tsx`, `SentenceBuilderGame.test.tsx`, `SyllableBuild.test.tsx`, `MatchShapeGame.test.tsx`, `RealiaReadGame.test.tsx`, `ClozePickGame.test.tsx`, and the Story Sequence and Story Order tests that wait out 600 ms
- e2e (layout under OD-AF1 (B), and the misses that now stay under OD-AF7): `touch-matrix.spec.ts` (the Culture Quiz, Tap & Respond and Card Match openers, `:69-199`), `text-size-fit.spec.ts`, `game-sizing.spec.ts`, `pic-word-touch.spec.ts`, and `realia-read-hidden-heritage*.spec.ts`

**Coverage:** `apps/mobile` business logic stays at or above 90 %, `packages/design-system` at or above 85 %, and `packages/i18n` at 100 % (message files excluded).

## 7. Rollout

- Next release, row by row. There is no switch: no row changes data, scoring or stars, and each row reverts on its own.
- Nothing is measured: per-round events are named but not emitted by mobile (`AMENDMENTS-TRACE-IDLE.md` §7), and this spec adds no telemetry.
- Under OD-AF2 (b), a sighted learner's quest gets longer by at most 0.3 s per right answer in the 700 ms games, about 1.2 s for a four-round game.
- **Under OD-AF9 (b),** a screen-reader learner taps Next once per round.

## 8. Dependencies

- None blocking.
- Files shared with other work orders (README §6) merge one after another:
  - the game screens, with WO-06, WO-40 and WO-41
  - `sound-pacing.ts` and `reply-advance.ts`, with WO-41 #6
  - `Tile/`, `ChoiceCard/` and `HoyaBubble/`, with WO-39, WO-40 and WO-41
  - `a11y.ts` and `review-ledger.json`, with WO-40 and WO-41 (§3.7)
- WO-40 decides Hangul voicing on top of §3.2's segments.
- WO-08's axe baseline drops the WO-04 violations as these rows merge.
- WO-25 (`phase-3-upper-stages.md`, row EA-2) uses this hook for its "why" line after a right answer.

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| AF-0 | Opus 5.5 | This spec and the wireframe `design/wireframes/minigame/answer-feedback.md` | — | — | `docs/answer-feedback-spec` |
| AF-0b | Opus 5.5 | Design pass (§5): the new marks and their minimum size; the look-here state; the OD-AF1 surface; Card Match's states and picked cue; the Hidden Heritage rings; the OD-AF8 marks; Next (OD-AF9 (b)); the Display sheet switch (OD-AF3 (d)); the announcer and `HoyaBubble` `live` in `design/components/AnswerFeedback/spec.md`; greyscale captures; the ChoiceCard spec note. Multi-agent review | — | this spec `ready` | `design/answer-feedback` |
| AF-1 | Opus 5.5 | Shared parts:<br>• `logic/answer-feedback.ts` (`answerAnnouncement`, `spokenParts`, `answerOptionLabel`, `resultLeastWait`, `readerPath`, and `announceWaitMs` under OD-AF9 (a))<br>• `platform/screen-reader.ts` (the queued announce, `announceAndWait(…, { queue })` matching its text, the iOS-only guard) and its `.web.ts`<br>• `screens/minigames/sr-only.ts`, `answer-announcer.tsx`, `use-answer-announcement.ts`<br>• the OD-AF3 (d) device flag (`store/locale-store.ts` `device:settings`, written by the level check and the Display sheet)<br>• `HoyaBubble` `live`; `Tile` correct `check` and `locked`; `ChoiceCard` `wrong` not `selected`<br>• the §3.7 keys, with R8 es and ko<br>• the start-bundle measurement | 1-10, 17 | AF-0b | `feat/answer-announcement` |
| AF-2 | Sonnet 5.5 | Culture Quiz and Tap & Respond (§3.6), on the OD-AF1 surface | 11, 12, 18 | AF-1, OD-AF1 | `fix/answer-feedback-quiz-respond` |
| AF-3 | Sonnet 5.5 | Card Match (§3.5, §3.6): marks, full opacity, inactive matched cards, the miss that stays, Hoya `thinking`, names, announcer | 13 | AF-1, OD-AF6 | `fix/answer-feedback-card-match` |
| AF-4a | Sonnet 5.5 | Match Sound, Odd One Out (onto `pacing.after`), Build a Letter | 14, 15 | AF-1, OD-AF7 | `fix/answer-feedback-tiles` |
| AF-4b | Sonnet 5.5 | Listen & Pick, Pic-Word Match, Read Pick, Cloze Pick, Realia Read, Story Sequence, Story Order | 16 | AF-1, OD-AF7 | `fix/answer-feedback-choice-games` |
| AF-4c | Sonnet 5.5 | Hidden Heritage, Syllable Build, Match Shape, Sentence Builder, Role Play | 16 | AF-1, AF-0b, OD-AF7, OD-AF8 | `fix/answer-feedback-boards` |
| AF-5 | — | `Tile` wrong-state mark and the literal removed: **done by AU-17a (#1035)**. Its `correct` mark and `locked` prop were not part of it and land in AF-1 | — | — | — |
| AF-6 | Sonnet 5.5 | The "Amended 2026-xx-xx by F-A11Y-001" lines in every spec and design document under **Amends**; the `docs/specs/README.md` index line. Status `shipped` only after the VoiceOver and TalkBack lines of §3.8 pass. The web line may be recorded as open, with its reason | — | AF-1 to AF-4c | `docs/answer-feedback-finish` |

- One commit = test + implementation.
- AF-4a, AF-4b and AF-4c may run in parallel after AF-1. They share no file except their own tests.
- Every row that touches `a11y.ts` rebases over WO-40 and WO-41 on that file and the ledger (§3.7).

## 10. Owner decisions (decided 2026-11-24)

Owner decision 2026-11-24 (in session: "전부 권고대로 승인", all approved as recommended).

- The last column records each decision.
- The "Gates" column says which rows it unblocks.
- With all nine decided, the spec is `ready`, and each "if" under **Amends** now holds:
  - OD-AF2 (b): QS-4's least waits are amended.
  - OD-AF3 (d): F-PLC-001 §3.12 and `AMENDMENTS-DISPLAY-NAV.md` are amended.
  - OD-AF6 (a): `AMENDMENTS-TOUCH.md` §6.2 is amended.

| OD | Question | Options | Recommended | Gates | Owner decision 2026-11-24 |
|---|---|---|---|---|---|
| **OD-AF1** | The answer surface of Culture Quiz and Tap & Respond | (A) keep `Button` and add a result look: a `result` prop draws the mark, keeps the tone, and is locked but not disabled, which needs a new locked path because `softDisabled` and `disabled` both draw it disabled (`Button.tsx:111, 186`), and moves `Button.tsx:43` onto a token; (B) `ChoiceCard` in row layout, as Listen & Pick, Cloze Pick, Realia Read and Story Check use it: the same 80 dp height, marks, names and contrast tests already exist, and Tap & Respond's replies render through `KoreanText`, so WO-40's fix reaches them. The options change from blue pills to paper cards | **(B)** | AF-0b, AF-2, the e2e layout tests | **(B)**: `ChoiceCard` |
| **OD-AF2** | The advance for a sighted learner (reader off). Today's least waits: 700 ms (Culture Quiz, Match Sound, Odd One Out, Listen & Pick, Pic-Word Match, Cloze Pick, Realia Read, Hidden Heritage); 800 (Card Match's last pair); 900 (Build a Letter, Read Pick with 0 under reduced motion, Syllable Build, Match Shape, and `afterReply` in Tap & Respond and Role Play); 600 (Sentence Builder) | (a) keep every value; (b) a floor of `RESULT_MARK_MIN_MS` = 1000 after every right answer, applied by the screen; (c) the same floor at 1200 | **(b)**: at most 0.3 s per right answer, and Read Pick's 0 goes | AF-1 (the constant), and the timing tests of AF-2 to AF-4c | **(b)**: 1000 ms floor |
| **OD-AF3** | The web, where a screen reader cannot be detected (`screen-reader.web.ts:10-12`), on the primary channel | (a) nothing extra: the web keeps the reader-off path, and the line may be cut off; (b) a **new** "screen reader" setting with new copy and design; (c) a fixed extra wait after every right answer, for everyone on the web; (d) keep the level check's existing answer, "I use a screen reader" (`learner.ts:1468`, `OptionsScreen.tsx:189-198`, already translated), as a device-level flag in `device:settings`, settable in the Display sheet with the same strings. When it is on, the web takes the reader-on path (OD-AF9) | **(d)**: it reuses reviewed strings and a question learners already meet. It only needs a row in the Display sheet (AF-0b) and the flag (AF-1). WO-41 #6 can read the same flag | AF-0b, AF-1, the web line of §3.8; adds F-PLC-001 and AMENDMENTS-DISPLAY-NAV to **Amends** | **(d)**: the level check's flag, kept for the device, with a Display sheet row |
| **OD-AF4** | The words of an answered option's name | (a) reuse the prefixes already used by five games: "Right answer: …", "Not this one: …", "Look here: …" (`a11y.ts:170-172`), translated, with the state said first; (b) WO-04's suffixes ", correct" and ", try another" (new keys) | **(a)** | AF-1 (strings), AF-2 to AF-4c (names) | **(a)**: reuse the prefixes |
| **OD-AF5** | Taught-Korean Hangul in announcements | (a) none until WO-40's LP-0 reports, naming Korean by romanization and gloss as every spoken name does today (moved lines included, §3.2); (b) Hangul now, in a `lang="ko"` segment on the web and Android, and none on iOS | **(a)**: the segments of §3.2 make (b) a later change that only adds | AF-1 (builder, test 1), AF-4b and AF-4c (moved lines) | **(a)**: no Hangul until LP-0 |
| **OD-AF6** | Card Match's miss (amends `AMENDMENTS-TOUCH.md` §6.2, KT-4a) | (a) as §3.5: the meanings tried stay marked while the same Korean word is picked, no timer lets the pick go, and Hoya shows `thinking`; (b) keep the pick release, and clear the mark on the next tap anywhere | **(a)**: one fewer tap to try again, and no timer on the board | AF-3 | **(a)**: as §3.5 |
| **OD-AF7** | The same rule in the other games with a timed miss: Pic-Word Match, Story Sequence and Story Order (600 ms), Hidden Heritage's ring (600 ms), and Build a Letter (900 ms) | yes / no. If yes, Build a Letter's sub-option: (i) the wrong build and its hint stay until a slot tap, Undo or a tray tap; (ii) the slots still empty after 900 ms and only the hint stays | **yes, with (i)** | AF-4a, AF-4b, AF-4c | **yes, with (i)** |
| **OD-AF8** | Marks outside the rule of §3.1: Syllable Build's and Match Shape's drawn dot; Role Play's `dash` on a locked reply while the turn stays; Sentence Builder's `dash` on a tried tile that stays tappable | (a) all four become `replay`; (b) keep all four as their specs drew them; (c) the dots and Role Play's `dash` become `replay`, Sentence Builder keeps `dash` with §3.1's "tried here, still tappable" row, and every mark is `text.primary` | **(c)**: Role Play is the try-another case; Sentence Builder's tile is not locked, so `replay` would say the wrong thing | AF-0b, AF-4c | **(c)** |
| **OD-AF9** | The advance with a screen reader on | (a) timed, as revision 1 drafted: line, then sound, then advance. iOS waits for its own `announcementFinished` (guard of at least 8 s); Android and the web under (d) wait a length-scaled guess, tuned on a device; (b) after a right answer a **Next** button appears and takes focus, the line is queued after it, and the round moves on when Next is pressed (Story Check and Trace precedent) | **(b)**: no timing guess, and the learner sets the pace (WCAG 2.2.1). The cost is one tap per round, for reader users only | AF-0b (Next), AF-1 (wait helpers), AF-2 to AF-4c | **(b)**: Next |

## 11. Review log

**2026-11-23, revision 1 (AF-0).** Written on `e72336a7d`. WO-04's citations were re-read (§1.2) and the other games surveyed (§1.3).

**2026-11-24, revision 2.** This revision adjudicates the multi-agent review of revision 1. The review had two lenses:

- *Code truth*: the facts were accurate, with 5 majors and 8 minors.
- *Charter and learner*: not ready, with 4 majors and 11 minors.

I re-checked every finding against the tree before adjudicating.

**Fixed, majors:**

- **Tests 7 and 8 sat in a folder that never runs.** `src/components/__tests__/` matches no vitest project: unit is `logic`, `store`, `content`, `config`, `platform` and `navigation`; render is `src/screens/**/*.test.tsx`; and `passWithNoTests` is on.
  - The announcer and hook moved to `screens/minigames/`, with their test in the render lane.
  - Every decision moved into `logic/` and `platform/`, which are in the coverage lanes, and the glue is said to be outside them (§3.3, §6).
- **A locked miss was still announced as disabled**, through `Tile`'s `disabled` → `TapTarget`, and so were Card Match's matched cards.
  - A new `Tile` `locked` prop goes to `TapTarget` as `inactive`; matched cards become inactive; tests assert "not disabled".
  - OD-AF1 (A)'s extra `Button` work is costed (§3.1, §10).
- **The web is the primary channel, and its results could be cut off.**
  - Revision 1's claim that the floor "gives a reader time" is withdrawn.
  - With the reader path off, the web no longer moves focus.
  - OD-AF3 gains (d): reuse the level check's translated "I use a screen reader" as a device flag. (b) is re-costed. §3.8 gains "not cut off by the next round" for the web (§3.4, §10).
- **The start-bundle ceiling.** AF-1 now carries a measurement step against `startBundleRaw` 4,604,100 B, a keep-small rule, and the record of a measured raise if one is needed. `srOnly` moves to a neutral module, so the announcer does not import `korean-speech.ts` (§3.3, §6 test 17).
- **`live={false}` reached too far.** Now only result bubbles and result wrappers stop being live. The §3.3 table lists, game by game, which regions stay live; Card Match's `nowMeaning` prompt is one of them.
- **The timed advance with a reader on rested on guessed waits.** That hidden decision is now OD-AF9.
  - The Next button is recommended.
  - The timed branch, if chosen, uses a guard of at least 8 s on iOS that matches its own text, and a length-scaled wait on Android tuned at the slowest rate in en, es and ko.
  - The automatic replay after a miss no longer plays while a reader is on.
- **"No Hangul" contradicted the lines that move onto the hook.** Story Order's placement line, Role Play's why line and Sentence Builder's hint are now defined game by game: romanization and gloss, and Story Order keeps its position. This is a deliberate change. Story Order's replay lines stay as they are. Test 1 is limited to the hook's output (§3.2).
- **`dash` contradicted its own rule.** §3.1's `dash` row is rewritten, and Role Play goes to `replay`. Sentence Builder's tried tile is recorded as still tappable. The colour rule is stated (`text.primary`), and OD-AF8's options and recommendation are rewritten.

**Fixed, minors:**

- The tests that break are listed, Tile's no-mark test and the e2e layout specs included.
- The focus target is named for each game: a header View with `a11y.answer.round`, never a button, never the raw Hangul heading. This is the exception to `shell.md` §12, and **Amends** lists it.
- `ChoiceCard` `wrong` is no longer `selected`.
- The hidden announcer is hidden from VoiceOver, stays a reachable live region on Android, and is emptied each round.
- Double reads get a device case and a fallback. `announceAndWait` ends only on an event that carries its own text.
- The wait inventory gains Tap & Respond's and Role Play's 900 ms. Odd One Out's bare `setTimeout` moves onto `pacing.after`.
- The `announceForAccessibilityWithOptions` call stays inside `platform/screen-reader.ts`, guarded to iOS (react-native-web 0.19.13 lacks it).
- The duplicate keys `option.paired` and `answer.matched` are dropped, and the ledger rebases are stated.
- Culture Quiz's right answer names the word: "Right answer: sagwa, apple."
- Korean UI: the rule is "no taught-Korean Hangul"; `item` may have no gloss; there is a note for ko in R8.
- Build a Letter's wording is fixed, and its reset is a sub-option of OD-AF7.
- The look-here row is added; a miss that turns the hint on ends with the look-here line.
- Card Match gets Hoya `thinking` on a miss (a new `learner` line), and its picked card gets a non-colour cue in AF-0b.
- **Amends** lists the design documents, and AF-0b's file documents the announcer and `live`.
- The wireframe gains panels for Story Sequence and Story Order, Hidden Heritage, Syllable Build and Match Shape, Role Play, the look-here state and loading, plus romanization under Build a Letter's tray.
- AF-6 marks the spec `shipped` only after the VoiceOver and TalkBack checks.
- AF-0b sets a minimum mark size and checks that `replay` is not read as a button.

**Kept:**

- No new dependency.
- Story Check is unchanged.
- The answer's recorded word is not played after the line with a reader on: Hear it is one tap away, and automatic sound with a reader is WO-41 #6's.
- No Hangul in announcements until LP-0 (OD-AF5 (a)).
- The recommendations for OD-AF1 (B), OD-AF2 (b), OD-AF6 and OD-AF7 stand.

**Moved:**

- Round-start auto-play with a reader (Match Sound's next round may still speak over the focus move) stays with WO-41 #6. That setting can read OD-AF3 (d)'s flag.
- "A `lang="ko"` segment in a live region" and "romanization in the Korean voice" are passed to WO-40's LP-0 survey (§4).

**2026-11-24, owner decisions.**

- OD-AF1 to OD-AF9 are approved as recommended in revision 2 (§10).
- The status is now `ready`.
- No text in §3 changed: revision 2 already described each recommended option as the behaviour.
