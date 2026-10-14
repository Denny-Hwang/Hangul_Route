# Minigame/Trace a Word: syllable blocks over a ghost (wireframe v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7 item 3 (Trace), §3.14, §9 assumption 3 (block placement of the stroke data), row **D-3** (this file), built in row **G-4** · extends `design/wireframes/minigame/shell.md`, `families.md` (Family 2, trace-stroke) and the shipped Trace Stroke (`F-004`, `F-005`, `F-006`, `F-007`, `F-009`; `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx`) · block shape: `design/components/SyllableBlock/spec.md` · reused by `design/wireframes/minigame/write-frame.md` (the "trace" part of a frame round)
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-writing/` (`trace-word.md`, `mock/trace-word.html`)
Code (planned, G-4): renderer `apps/mobile/src/screens/minigames/TraceWordGame.tsx`; block placement of the jamo skeletons `apps/mobile/src/logic/trace-word/block-strokes.ts` (pure: a jamo's 200 x 200 skeleton -> its zone in the block); round flow `logic/trace-word/` (reducer, scoring on top of the shipped `scoreTrace`); layout reuses `logic/trace-layout.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean with romanization and gloss, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a `trace-word` step (Stage 7 q1 "trace and type names of the cast", My Favorite Animal q1, the trace part of a Write Frame)
When: the learner draws a whole syllable block, or a two-syllable word one block after the other, over a ghost of the word
Then: each letter sits in its place in the block (narrow initial, vowel beside or under, final at the bottom), the stroke-order and direction coaching of Trace Stroke speak up at the relaxed tolerance (they coach, they never fail a block), and a finished word shows whole before the next round

## Screen goal

"Write the word block by block over the ghost."

## Box diagram

Compact (320 x 568, portrait; the Trace Stroke frame, one block at a time):

```
+--------------------------------+
| [=====-----]          (1 / 3)  |  <- shell top row
|  (Trace the word) ~~ 호야 ~~    |  <- heading with the word, romanization, gloss
|      (hoya) · (Hoya)           |
|        [ 호 ] [ 야 ]            |  <- word strip: one chip per block; the current one lit
|                                |     (thick border), a done one with a check
|   +------------------------+   |
|   |  :  ㅎ  :              |   |  <- the canvas: the CURRENT block, as large as the
|   |  :......:              |   |     slot allows (trace-layout: 160 to 320, tablet 448)
|   |  :  ㅗ  :              |   |  <- ghost: every letter of the block in its zone;
|   |  :......:              |   |     the zone guides are faint dotted lines
|   +------------------------+   |
|  [ Show me ]  [ Clear ]        |  <- helpers (Trace Stroke)
|  ( Hoya strip: one line )      |  <- fixed-height feedback strip (Trace Stroke)
|  [[ Done ]]       [ Skip ]     |  <- side by side on a short portrait (compact mode)
+--------------------------------+
```

The ghost is the block drawn from the jamo skeletons placed in their zones (the `SyllableBlock` arrangement, scaled to the canvas): vowel beside (가, 야): initial left, vowel right; vowel under (호, 구): initial top, vowel below; a final (한, 름): its own lower band. Zone guides are faint dotted lines at the zone edges, a writing-paper look; they are a guide, not a target box, and they are never scored.

Regular and wide (tablet, 768 x 1024 portrait and 1180 x 820 landscape): a two-block word shows **both** blocks side by side, each canvas at least 240 (the canvas floor of Trace Stroke's roomy mode); the current block is live, the other is the ghost only (to come) or the traced block (done). A one-block word and a phone keep one canvas.

```
+------------------------------------------------+
| [==========----------]                (1 / 3)  |
|  (Trace the word) ~~ 이름 ~~ (ireum) · (name)    |
|  +--------------------+  +--------------------+ |
|  |  (live: 이)         |  |  (ghost: 름)        | |  <- current block lit (thick border);
|  |                    |  |  (waits)           | |     the other one quiet
|  +--------------------+  +--------------------+ |
|  [ Show me ] [ Clear ]   ( Hoya strip )         |
|  [[            Done            ]]               |
|  [ Skip ]                                       |
+------------------------------------------------+
```

Landscape phone and wide-short windows use Trace Stroke's `side` mode: canvas left, word strip, prompt and controls in the column beside it.

Letter-by-letter mode (the fallback of spec §9 assumption 3, if whole blocks read poorly at block size; chosen per round, `mode: 'block' | 'letter'`):

```
+------------------------+
|  +------+              |
|  | ㅎ   |  <- live zone: the current letter's zone is lit; the learner
|  +------+     traces only that letter, then the next zone lights
|  : ㅗ  :  <- waiting zone: ghost only
|  :.....:               |
+------------------------+
  ( ㅎ * · ㅗ )  <- part dots under the canvas: initial, vowel, final; done ones filled
```

## Interaction points

- **Draw** -> strokes captured as in Trace Stroke (pan gesture, the canvas owns vertical drags, no scrolling).
- **[[ Done ]]** or 1.5 s idle (`TRACE_IDLE_MS`, the shared gate of `trace-evaluator`) -> evaluate the **current block**. **Idle gate in block mode:** the idle timer runs only once every letter zone of the current block has ink (at least one stroke whose points fall mostly inside that zone); before that, a pause never evaluates, so a learner who finishes ㅎ in 호 and stops to look at the ghost of ㅗ keeps their work. Done evaluates at any time. In letter mode the idle gate stays per letter, as in Trace Stroke. G-4 adds a reducer or component test: strokes in the first zone only, then an idle pause longer than `TRACE_IDLE_MS`, and the block is not evaluated. Evaluation: `scoreTrace` against the block's placed skeleton (all its letters in reading order), the shipped default threshold (coverage 0.65), `checkOrder` and `checkDirection` on. This is the relaxed tolerance: order and direction produce coaching lines, never a fail. Strict mode (F-008) is not used here.
  - **Block passes**: success look on the canvas, the chip gets its check, Hoya's strip shows the pass line (order, direction or clean, as Trace Stroke chooses it), then after the pass pause the next block becomes current. After the last block the word strip shows the whole word traced (the drawn strokes of each block, small) for the pass pause, then the next round.
  - **Block does not pass**: amber look (never red), nudge haptic, Hoya thinking with the retry line; the drawing clears after the retry pause and the same block stays current. Blocks already passed stay passed.
- **Scoring** (shell rule, by round = one word): the round is right first time when every block passed on its first evaluation; otherwise a missed round. Retries never change stars; `answerRound(roundIdx, correct)` fires once per round, after its last block.
- **[ Show me ]** -> the animated hint of the current block (`StrokeHint` with the placed strokes, letter after letter in writing order), narrating each letter's sound at its start (F-009); reduced motion: the still stroke-order diagram (numbered starts and arrows) for the block, read aloud by its label (F-007 revision).
- **[ Clear ]** -> clears the current block's drawing; never touches a passed block.
- **Chip tap** (word strip) -> plays the block's sound; it does not change the current block (the order of blocks is the reading order).
- **[ Skip ]** -> `markStepComplete()` + `onFinish()` (shell rule; Trace Stroke's always-on fallback).

## Navigation graph

Enter from: `quest/player` via `minigame/shell` (play step `trace-word`); `minigame/write-frame` embeds the word strip and the canvas for its trace part.
Exit to: `quest/player` (via goBack).

## States

- **idle**: ghost and guides shown, Hoya strip idle line, Done disabled until a stroke exists.
- **evaluating**: Done disabled for the one evaluation (shared gate).
- **block pass** / **block retry** / **word done**: as above.
- **one-block word**: the word strip has one chip; the round ends on that block's pass.
- **no stroke data** for a letter of the word (a placement the transform cannot draw): the round is built without that word (the round builder drops it, the shell's empty state if none is left); never a canvas with a missing letter. G-4's test lists every word of the Stage 7 cells against the stroke data.
- **no rounds** / **error**: the shell's states.
- **large text (200 %)**: the heading and strip text grow; the canvas takes what is left above its floor (160), as Trace Stroke does; the word strip wraps under the heading.
- **reduced motion**: Show me is the still diagram; the pass shows no movement.

## Accessibility

Trace Stroke's accessible path, applied to a block:

- The heading is a header whose label reads the word, its romanization and gloss ("Trace the word 호야, hoya, Hoya").
- The canvas label names the current block and where it is in the word: "Draw 호, ho, block 1 of 2, with your finger" (`a11y.minigame.traceBlock`, draft below).
- Show me is the way to hear the stroke order: the still diagram's label reads every letter of the block in order ("Stroke order. ㅎ: 3 strokes ... ㅗ: 2 strokes ..."), using the shipped `strokeOrder.summary` per letter. As built (G-4): each letter is named by its place in the block, never in Hangul ("Letter 1 of 2. Stroke order. 3 strokes ...", `a11y.minigame.traceWordLetterOrder`), and Show me plays the block's sound once as the hint starts, not each letter's (a consonant alone has no sound of its own to play).
- The Hoya strip is a polite live region (pass and retry lines).
- Skip stays on screen in every layout; a learner who cannot draw finishes the step with it.
- The chips are buttons named "Hear 호, ho"; the current chip also has the selected state; a passed chip says "done".

## Data needs

- reads: the `trace-word` scope's rounds (C-1 round schema): per round `{ target: KoText (1-2 blocks), mode: 'block' | 'letter' }`; the jamo skeletons `content/jamo-strokes.ts`; the block split of each syllable (initial, vowel, final; compound vowels and double finals as the jamo the stroke data holds).
- logic: `placeBlockStrokes(syllable)` -> per letter `{ jamoId, zone, strokes }` (G-4, pure, 100 %); `scoreTrace` (shipped); the reducer for the block sequence and first-try scoring (G-4).
- writes: `answerRound` once per word, `markStepComplete`. Drawn strokes live in component state only: a failed block's strokes are dropped at the retry; a passed block's strokes stay in component state until the round (the word) ends, so the word-done view can show them small, and are then dropped. Nothing is stored or sent (test P-1 covers the round kinds of Stage 7).
- telemetry: none new.

## Draft strings (G-4 adds them with their es and ko values)

Reused: `trace.showMe.cta`, `trace.clear.cta`, `trace.done.cta`, `trace.pass.*`, `trace.retry.start`, `skip.cta`, `progress.pill`, `a11y.minigame.strokeOrder.*`.

| Key (proposed) | en draft |
|---|---|
| `learner.minigame.traceWord.heading(word)` | Trace the word {word} |
| `learner.minigame.traceWord.idle` | Write each block. Start with the first letter. |
| `learner.minigame.traceWord.blockDone` | One block done! Now the next one. |
| `learner.minigame.traceWord.wordDone` | You wrote the whole word! |
| `learner.minigame.traceWord.letterIdle` | Trace the letter in the bright box. |
| `a11y.minigame.traceBlock(block, romanization, n, total)` | Draw {block}, {romanization}, block {n} of {total}, with your finger |
| `a11y.minigame.hearBlock(block, romanization)` | Hear {block}, {romanization} |

## Open questions

1. **Block placement (spec §9 assumption 3).** G-4 prototypes `placeBlockStrokes` on the 50 syllables of S7-1 first and compares each placed ghost with the same syllable set in the system Korean font; if a placement reads poorly, that round uses `mode: 'letter'`. The design draws both modes so the switch needs no new design.
2. **Coverage at block size.** The 0.65 coverage threshold was tuned for one letter on the whole canvas. A block's letters are smaller, so a learner's line covers relatively more; G-4 measures pass rates on the scripted traces of the test suite and may scale the stroke width of the coverage check with the zone, with the change written in its PR. **Resolved (G-4):** the tolerance is scaled to block size (12 units), with a per-stroke floor, a precision check and an outline check for ㅁ against ㅇ, so a near-miss letter (가 for 기, 공 for 곰) fails; the numbers are in F-CURR-001 §9 assumption 3.
3. **Two canvases on a tablet** need both at 240 or more; a 600-wide portrait window with the reading column gets two of 264. Below that, one at a time, as on a phone.
