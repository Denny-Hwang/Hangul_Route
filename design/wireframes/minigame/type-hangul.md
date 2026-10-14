# Minigame/Type Hangul: the in-app two-set keyboard (wireframe v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7 item 2 (Type), §3.14 (accessibility, layout), §5 test P-1, OD-10 (in-app keyboard only), row **D-3** (this file), built in row **G-3** · extends `design/wireframes/minigame/shell.md` and `families.md` (Family 2, construction) · reused by `design/wireframes/minigame/write-frame.md` (the "type" part of a frame round)
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-writing/` (`type-hangul.md`, `keyboard.md`, `mock/type-hangul.html`, `mock/keyboard.html`)
Code (planned, G-3): renderer `apps/mobile/src/screens/minigames/TypeHangulGame.tsx`; the keyboard `HangulKeyboard` in `packages/design-system` (layout only: it reports key presses and draws what it is given); its pure arrangement `keyboardLayout(...)` next to it (like `SyllableBlock/layout.ts`); round logic in `apps/mobile/src/logic/type-hangul/` (reducer, scoring); the composition `composeTyped` in `packages/content-schema` (row C-1)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization and gloss (`KoreanText`), `{ x }` content-driven, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a `type-hangul` step (Stage 6 apply rounds, Stage 7 q1 and q2, the type part of a Write Frame)
When: the learner taps letters on the in-app keyboard under the prompt and taps Done
Then: the letters join into syllable blocks as they type, the answer is checked only after Done, syllable by syllable, and a near miss shows the amber nudge with the word under what they typed so they can fix it; nothing typed is ever marked wrong while they type, and nothing typed leaves the round

## Screen goal

"Type the word with the Korean keyboard, then tap Done."

## The keyboard (KS X 5002 two-set, dubeolsik)

The keys are the standard Korean layout: consonants on the left half, vowels on the right half, in the KS X 5002 order. Shift gives the five tense consonants and the two vowels ㅒ ㅖ; every other key types its own letter with or without Shift. Compound vowels (ㅘ ㅝ ㅟ ㅢ ㅚ ㅙ ㅞ) and double finals (ㄳ ㄺ ...) are typed as two keys, as on every Korean keyboard; `composeTyped` joins them.

```
KS X 5002 rows                                        Shift
row 1   ㅂ ㅈ ㄷ ㄱ ㅅ | ㅛ ㅕ ㅑ ㅐ ㅔ                ㅃ ㅉ ㄸ ㄲ ㅆ | ㅛ ㅕ ㅑ ㅒ ㅖ
row 2   ㅁ ㄴ ㅇ ㄹ ㅎ | ㅗ ㅓ ㅏ ㅣ                   unchanged
row 3   ㅋ ㅌ ㅊ ㅍ    | ㅠ ㅜ ㅡ                      unchanged
        consonants      vowels
```

### Two arrangements, one order

The touch-target floor (`touchTarget.min`, 64 on every side of every key's hit area) and the ten keys of row 1 meet only on a keyboard at least 10 x 64 = 640 wide. A 320 phone is half that, so the keyboard has two arrangements of the same keys in the same order. `keyboardLayout` picks one from the width it gets; no setting, no toggle.

```
standard: keyboard width >= 10 x touchTarget.min (tablet, desktop, landscape phone)
+----+----+----+----+----+----+----+----+----+----+
| ㅂ | ㅈ | ㄷ | ㄱ | ㅅ | ㅛ | ㅕ | ㅑ | ㅐ | ㅔ |   10 cells
+----+----+----+----+----+----+----+----+----+----+
  | ㅁ | ㄴ | ㅇ | ㄹ | ㅎ | ㅗ | ㅓ | ㅏ | ㅣ |       9 cells, half a cell in
+------+----+----+----+----+----+----+----+------+
| Shift| ㅋ | ㅌ | ㅊ | ㅍ | ㅠ | ㅜ | ㅡ |  Del |   Shift and Del 1.5 cells each
+------+----+----+----+----+----+----+----+------+
           |          ( Space )         |           5 cells, centred
           +----------------------------+

split: narrower (every phone in portrait, a 600-687 window)
+----+----+----+----+----+
| ㅂ | ㅈ | ㄷ | ㄱ | ㅅ |   C1  the consonant half of row 1
+----+----+----+----+----+
| ㅁ | ㄴ | ㅇ | ㄹ | ㅎ |   C2  ... of row 2
+----+----+----+----+----+
| ㅋ | ㅌ | ㅊ | ㅍ |Shift|  C3  ... of row 3, then Shift
+----+----+----+----+----+
  (gap: the two halves read as two groups)
+----+----+----+----+----+
| ㅛ | ㅕ | ㅑ | ㅐ | ㅔ |   V1  the vowel half of row 1
+----+----+----+----+----+
| ㅗ | ㅓ | ㅏ | ㅣ | Del|   V2  ... of row 2, then Del
+----+----+----+----+----+
| ㅠ | ㅜ | ㅡ | ( Space ) |  V3  ... of row 3, then Space (2 cells)
+----+----+----+----+----+
```

- **Split keeps the standard order.** Each half keeps its KS X 5002 rows and their left-to-right order; the vowel half moves under the consonant half instead of beside it. A learner who later meets a real Korean keyboard finds every key in the same row and in the same order within its half.
- **Width.** On a `compact` window the keyboard spans the window edge to edge (inside the safe-area insets), like a system keyboard, so a 320 window gives five cells of exactly 64. From `regular` up it sits in the reading column (`layout.maxWidth.reading`, inside the gutter).
- **Cell size.** Every cell is a hit area, with no gap between hit areas; the visible key is drawn inside it, inset by `spacing.xxs`. Standard: cell width = keyboard width / 10 (64 to 72 in the reading column); split: keyboard width / 5, at most `touchTarget.hero` (wider windows centre a keyboard of 5 x 96). Cell height: `touchTarget.min` on a phone and on any `short` window; on a tablet `touchTarget.min x mediaScale` (77 regular, 90 wide), never above `touchTarget.hero` (F-LAYOUT-001 LD4: media scales, the floor does not).
- **Height.** Split: 6 x 64 + `spacing.sm` between the halves = 392. Standard: 4 rows (256 on a phone in landscape, 308 regular, 360 wide).
- **Short and narrow.** A short window under 640 wide (a small phone on its side: 568 x 320, 592 x 360) has no room for split's 392 under the answer row, so it gets standard at 4 x 64 with cells under 64 wide (56, 59). A window that cannot hold the answer row, the keyboard and one row of prompt (answer row + keyboard + 64) scrolls the answer row and the keyboard with the prompt instead of pinning them, so no key is cut off and the 64 height is kept (G-3).
- **Under 640 tall, any width.** Done sits beside the field (as on a phone), Skip is in the top row only, and the keys stay at the 64 floor (no media scale): a 1024 x 600 laptop window fits the top row, the answer row and 4 x 64 (G-3).
- **Below 320.** 320 is the narrowest supported window (F-LAYOUT-001); a narrower one (200 % browser zoom on a 568 phone) gets split cells under 64, and the keyboard keeps working. G-3's layout test pins 320 -> 64.

### Key faces

```
+--------+     +--------+     +--------+     +----------+
|   ㄱ   |     |   ㄲ   |     |  Shift |     |   Del    |
|  g/k   |     |  kk/k  |     |  (on)  |     |  (glyph) |
+--------+     +--------+     +--------+     +----------+
 letter key    shifted face    toggle on       action key
```

- A letter key shows the jamo (the key's picture: media, it grows with the cell) and, under it, its sound value at caption size: `JAMO_SOUND_VALUES` for the 24 basic letters (`g/k`, `silent/ng`, `a`); the nine letters that table does not hold (ㄲ ㄸ ㅃ ㅆ ㅉ ㅐ ㅔ ㅒ ㅖ) need their values added (open question 1).
- **Consonant half and vowel half** use two quiet key fills (paper and sunken) and sit as two groups (split) or two halves (standard); the fill is never the only cue: the group position and the letters already say which half a key is in.
- **Shift** is one-shot: it shows the shifted faces on its seven keys, types one letter, then turns off by itself. A second tap turns it off without typing. On: the key looks pressed (the selected fill and a thick border) and its accessible state is "on". No caps lock: there is nothing to lock.
- **Del** removes the last letter typed (the last jamo, not the whole block): 한 -> 하 -> ㅎ -> nothing (`composeTyped` "backspace by jamo"). No hold-to-repeat.
- **Space** ends the block and types a space; only multi-word answers need it (저는 호야예요). Extra spaces are ignored when the answer is checked (trimmed, runs of spaces read as one).
- **No key sounds.** A key tap plays no audio (typing would turn into noise) and gives no haptic; the success and nudge haptics stay on Done as in every game.

## Box diagram

Compact (320 x 568; below `layout.compactHeight` (640) the count pill, the prompt and Skip share one row and the round bar is left out; the keyboard is pinned to the bottom):

```
+--------------------------------+
| (2/4) (Type) ~~ 호야 ~~ [ Skip ] |  <- one row: count pill, the prompt (wraps to two lines
|       (hoya) · (Hoya)          |     inside the row if it must), Skip (ghost, 64 tall)
| +----------------------+ +----+ |
| | 호ㅇ|                | |Done| |  <- answer row: the typed text, the block being built
| +----------------------+ +----+ |     underlined; [[ Done ]] beside it (disabled while empty)
|+------------------------------+|
|| ㅂ  ㅈ  ㄷ  ㄱ  ㅅ           ||
|| ㅁ  ㄴ  ㅇ  ㄹ  ㅎ           ||
|| ㅋ  ㅌ  ㅊ  ㅍ  Shift        ||  <- split keyboard, edge to edge, 6 x 64 + the gap
||                              ||
|| ㅛ  ㅕ  ㅑ  ㅐ  ㅔ           ||
|| ㅗ  ㅓ  ㅏ  ㅣ  Del          ||
|| ㅠ  ㅜ  ㅡ  (  Space  )      ||
|+------------------------------+|
+--------------------------------+
```

Budget at 320 x 568 (measured in the mock): prompt row 64 + padding = 103, answer row 72, keyboard 393 = 568. The part above the answer row scrolls if a long prompt (a long gloss in Spanish, 200 % text) needs more; the answer row and the keyboard never move. From 640 tall (375 x 667 and up) the shell's top row with the round bar comes back and the prompt has its own line.

Regular (tablet portrait, 768 x 1024; wide is the same column with taller keys):

```
+------------------------------------------+
| [==========---------]          (2 / 4)   |  <- the shell's top row
|  (Type this word)                        |  <- heading
|  ~~ 이름 ~~  (ireum) · (name)             |  <- prompt, larger
|  +------------------------------------+  |
|  | 이ㄹ|                               |  |  <- answer field
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ          |  |
|  |  ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ           |  |  <- standard keyboard in the reading column
|  | Shift ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ Del        |  |
|  |        (    Space    )             |  |
|  +------------------------------------+  |
|  [[            Done             ]]       |  <- Done full width under the keyboard
|  [ Skip ]                                |  <- ghost, as in the shell
+------------------------------------------+
```

Short window (landscape phone after "Keep sideways", 844 x 390): the compact-height row (count, prompt, Skip), the answer row with Done, the standard keyboard (4 x 64, edge to edge) below: 68 + 66 + 256 = 390. The prompt row scrolls if it needs more; the answer row stays in view.

After Done (the result panel takes the keyboard's place, same height, so nothing jumps):

```
pass                                    near miss (호야 typed as 호여)
+--------------------------------+      +--------------------------------+
| (prompt line unchanged)        |      | (prompt line unchanged)        |
| +--------------------------+   |      | +--------------------------+   |
| |  호야              (check)|   |      | |  호여                    |   |
| +--------------------------+   |      | +--------------------------+   |
| +----------------------------+ |      | +----------------------------+ |
| | (Hoya cheering)            | |      | | (Hoya thinking)            | |
| | (You typed it!)            | |      | | (Almost! Check the marked  | |
| |                            | |      | |  block.)                   | |
| |                            | |      | | (You typed)  [호][여 *]    | |  <- the different block marked:
| |                            | |      | | (The word)   [호][야 *]    | |     amber border and a mark,
| |                            | |      | |   ~~ 호야 ~~ (hoya)        | |     never colour alone
| +----------------------------+ |      | | [[ Fix it ]]               | |
|  auto-advance after a pause    |      | +----------------------------+ |
+--------------------------------+      +--------------------------------+
```

- **Pass**: the field takes the correct look with a check glyph, success haptic, Hoya cheering in the panel, auto-advance after the pause Trace uses (no Next button).
- **Not a match**: nudge haptic, Hoya thinking (amber, never red), the two rows "You typed" and "The word", block under block; each block that differs is marked (amber border plus a small mark), a missing or extra block shows as an empty dashed box. [[ Fix it ]] brings the keyboard back with the typed text kept and the caret at the end, so the learner changes only what differs. The word stays in the panel's place above the keyboard (one line: `~~ 호야 ~~ (hoya)`) until the next Done.
- **Near or far**: one block different (or one missing or extra) is a near miss ("Almost! Check the marked block."); more is far ("Here is how it is written. Try again."). Same panel, same button; only Hoya's line changes.

## Prompt modes

The round says what the learner types from (round schema, C-1); every mode shows the word's romanization, because taught Korean always carries it (CLAUDE.md §1).

| Mode | Prompt line | Used for |
|---|---|---|
| `see` | (Type) `~~ 호야 ~~` (hoya) · (Hoya) | copying a word or sentence: Stage 7 q1 and q2 |
| `hear` | [speaker, hero size] (Type the word you hear) (hoya) · (Hoya) | hear and spell; the Korean is hidden until the result panel |
| `picture` | [WordArt picture] (Type the word for the picture) (gimbap) · (gimbap) | Stage 6 apply ("type the dish you want to order") |

- `hear` shows the romanization on purpose (CLAUDE.md §1: taught Korean always carries it, and the no-voice fallback needs it), so a `hear` round is answerable from the romanization by design; the audio adds the sound, it is not the only route. Whether `hear` should hide the romanization until a replay is open question 4, decided in G-3.
- `hear` without a Korean voice (F-AUDIO-004): the speaker is replaced by the existing no-sound line of `audio-fallback.md` and the romanization and gloss stay; the round is still answerable from the romanization.
- In every mode the Korean target is shown in the result panel after Done; before Done only `see` shows it.

## Interaction points

- **Key** -> the jamo goes through `composeTyped`; the field redraws (the block being built underlined, as an IME shows it). A final consonant moves to the next block when a vowel follows (한+ㅏ -> 하나), as `composeTyped` decides.
- **Shift** -> one-shot toggle (above). **Del** -> one jamo back. **Space** -> a space.
- **[[ Done ]]** (disabled while the field is empty) -> check by syllable (`scoreTyped`, G-3), result panel.
  - **Scoring**: the round scores on the **first** Done only (shell rule): a match first time is a right round, anything else a missed round. Later Dones are retries (`retryCount`); they never change stars or add a round. A round is never scored while the learner types.
- **[[ Fix it ]]** -> keyboard back, text kept.
- **[ Skip ]** -> `markStepComplete()` + `onFinish()` without recording the remaining rounds (shell rule for construction games).
- **Speaker** (`hear` mode) -> replays the word through `playPrompt`; unlimited.
- The last round's pass -> `markStepComplete()` + `onFinish()` -> `quest/player`.

## Navigation graph

Enter from: `quest/player` via `minigame/shell` (play step `type-hangul`); `minigame/write-frame` embeds the keyboard and the field for its type part (it is not a separate screen there).
Exit to: `quest/player` (always, via goBack).

## States

- **typing** (default): keyboard live, Done enabled once the field has a letter.
- **empty field**: the field shows the mode's instruction as its placeholder ("Type this word", "Type the word you hear", "Type the word for the picture"), so the instruction is there even when the compact row has no room for a heading; Done disabled, Del does nothing.
- **pass** / **near miss** / **far miss**: as drawn.
- **no rounds** (scope resolves to zero rounds): the shell's empty state.
- **error** (unknown ref): the shell's error state with its way back to the quest.
- **no Korean voice** (`hear`): the audio-fallback line; never a silent dead end.
- **large text (200 %)**: the prompt and the field text grow; key faces are media and keep the cell size; the part above the keyboard scrolls; the keyboard never shrinks under the floor.
- **reduced motion**: the result panel appears without a slide; the caret does not blink.

## Accessibility

- Every key is a button (`accessibilityRole="button"`) whose name is the jamo and its sound value read as words: "ㄱ, g or k", "ㅇ, silent or ng" (`a11yRomanization`, the rule of `logic/korean-labels.ts`). Shifted keys read their shifted letter while Shift is on ("ㄲ, kk or k"). Shift is a toggle with its state ("Shift, more letters, on"); Del reads "Delete the last letter"; Space reads "Space".
- The field is a live region (polite): after each finished block and after Del it reads the text so far, then its romanization ("호, ho" ... "호야, hoya"); it does not read every jamo while a block is open, so typing is not drowned in speech.
- Focus order follows the drawn layout (WCAG 2.4.3), so it differs by window: on a phone and any window under 640 tall, the top row (count, prompt, Skip), the field, Done, then the keys; on a short window, the top row, the field, Done, Skip, then the keys; from `regular` up and 640 tall, the prompt, the field, the keys, Done, Skip (Done is drawn full width under the keyboard). Keys are in reading order (row by row, the consonant half first in split). (G-3 review: the earlier "prompt, field, Done, keys, Skip" did not match the layouts drawn above; the layouts win.) Every key is reachable by keyboard focus on the web and by switch access; Enter or Space on a focused key types it.
- The result panel takes focus when it opens; its first line is Hoya's line, then the two rows, read block by block ("You typed: 호, 여. The word: 호, 야. Block 2 is different.").
- Nothing in the round relies on colour alone: marked blocks have a mark and a thicker border; Shift has a pressed look and a state.

## Data needs

- reads: the round list of the `type-hangul` scope (C-1 round schema): per round `{ target: KoText (ko, romanization, en), mode: 'see' | 'hear' | 'picture', pictureRef?, audioRef? }`; the gloss in the UI language from the lesson overlay; `JAMO_SOUND_VALUES` plus the nine added values (open question 1).
- logic: `composeTyped(keys[])` -> `{ text, openBlock }` and backspace by jamo (`packages/content-schema`, C-1, 100 % covered); `scoreTyped(typed, target)` -> per-block `same | different | missing | extra` and `match | near | far` (G-3, pure, 100 %); `keyboardLayout(width, layoutClass)` -> arrangement, cell size, rows (design-system, pure, tested at 320, 375, 599, 600, 687, 688, 768, 1180 and 844 x 390).
- writes: `answerRound(roundIdx, correct)` on the first Done only; `markStepComplete`. The typed text stays in the renderer's React state; it is never written to a store, a persisted slice, a breadcrumb, a log line or telemetry (test P-1).
- telemetry: none new; `minigame.finished` keeps `{ kind, questId, stepIndex }` (ids, counts and codes only).

## Draft strings (G-3 adds them with their es and ko values)

No `packages/i18n` key is added by this design row. G-3 adds these under `learner.minigame.typeHangul` and `a11y.minigame.keyboard`, en / es / ko in the same PR (F-I18N-001 §3.10). Reused as they are: `learner.minigame.skip.cta`, `learner.minigame.progress.pill`, `learner.minigame.trace.done.cta` (Done) and the audio-fallback lines.

| Key (proposed) | en draft |
|---|---|
| `typeHangul.heading.see` | Type this word |
| `typeHangul.heading.hear` | Type the word you hear |
| `typeHangul.heading.picture` | Type the word for the picture |
| `typeHangul.pass` | You typed it! |
| `typeHangul.near` | Almost! Check the marked block. |
| `typeHangul.far` | Here is how it is written. Try again. |
| `typeHangul.typedLabel` | You typed |
| `typeHangul.targetLabel` | The word |
| `typeHangul.fixIt.cta` | Fix it |
| `keyboard.key(jamo, sound)` | {jamo}, {sound} |
| `keyboard.shift(on)` | Shift, more letters |
| `keyboard.delete` | Delete the last letter |
| `keyboard.space` | Space |
| `keyboard.field(text, romanization)` | You typed: {text}, {romanization} |
| `keyboard.different(n)` | Block {n} is different. |

## Open questions

1. **Sound values of nine keys.** `JAMO_SOUND_VALUES` holds the 24 basic letters; the keyboard also shows ㄲ ㄸ ㅃ ㅆ ㅉ ㅐ ㅔ ㅒ ㅖ. Proposal for C-1 or G-3: add them additively (`kk/k`, `tt`, `pp`, `ss/t`, `jj`, `ae`, `e`, `yae`, `ye`; Revised Romanization), checked by the romanization suite. Owner of the decision: C-1.
2. **Physical keyboard.** OD-10 rules out the system Korean keyboard. A hardware keyboard on the web or a tablet could type through the same two-set positions (Q -> ㅂ, W -> ㅈ ...) without any Korean input method. Not in G-3 by default; proposed as a follow-up for keyboard-only learners, since every on-screen key is already focusable.
3. **The `silent/ng` face.** At 320 the visible key is 60 wide; "silent/ng" at caption size is the longest face and fits in the mock (checked in `shots/keyboard-board.png`, board K1). If a locale ever needs a longer face, the face shows the letter only and the sound stays in the accessible name.
4. **Hear a key.** Long-press to hear a letter's sound is not in G-3 (no key sounds). Revisit after the first Stage 7 lessons ship.
5. **Assumption to test in G-3**: split rows are learnable at the speed Stage 7 needs (two to five blocks per answer). The Playwright spec times a scripted entry only for regressions; real speed comes from the first lessons.
4. **Romanization in `hear` mode.** (Open: G-3 shipped `see` and `picture` only, because the C-1 `TypeHangulRoundSchema` has no `mode` or `audioRef`. The first S6 or S7 row that authors a `hear` round adds both fields additively, `heading.hear` in en / es / ko and this choice; F-CURR-001 section 6 notes it.) This design keeps it visible (see the input modes). G-3 may instead show it only after the first replay, or only in the no-voice fallback state, if playtests show learners skip the audio; the choice and its reason go in the G-3 PR, with the e2e updated to match.
