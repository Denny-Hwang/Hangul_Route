# Wireframe — Trace shape guide (untaught letters)

Spec: `docs/specs/AMENDMENTS-STROKE-ORDER-STANDARD.md` §3.1, §3.2, §5 (row **SO-0c**) · Built in **SO-1**
Look: `design/screens/minigame-writing/trace-stroke-shape-guide.md` (mock and shots)
Amends the Show me part of the Trace Stroke row of `families.md` and of `trace-word.md`, and the stroke panel of `design/screens/presenter/slide-letter.md`. Everything else on those screens is unchanged.

A letter is **taught** when its jamo id is in `reviewedStrokeIds` (a person adds it in SO-3; the list is empty today). A Trace Word unit is taught only when every jamo id of every letter in it is taught (in letter-by-letter mode the unit is that one letter). Until then the app shows the letter's **shape**, never an order or a direction.

---

## 1. User scenario

- **Given** a learner on Stage 1 q2 (ㅁ ㅇ ㅗ ㅜ), q12 (final ㅁ ㅂ ㄹ ㅇ) or a Stage 7 Trace Word round, whose letter nobody has checked yet,
- **When** they tap **Show me**,
- **Then** the faint ghost steps aside and the whole letter fades in at once, labelled **Shape guide**, with no numbers, arrows or moving dot, so the app never teaches a stroke order that may differ from what their teacher or parent taught.

Teacher scenario: **Given** a teacher on the presenter's letter slide for an untaught letter, **when** the stroke build arrives (or R), **then** the class sees the letter appear whole in the panel, with no numbered start dots.

## 2. Screen goal

Keep Show me useful as "here is the whole letter" while removing everything that implies an order (sequence, dot, numbers, arrows, order read aloud). One goal; no new control.

## 3. Box diagram

Trace Stroke, compact phone (320 x 568). Show me playing, letter untaught, strip on its idle line.

```
+--------------------------------------+
| [X]  [=====progress=====] [3/4] [Aa] |   ScreenHeader (unchanged)
|                                      |
| Trace the letter o                   |   heading (unchanged)
|                                      |
|        +--------------------+        |
|        |                    |        |
|        |        |           |        |   canvas: ghost hidden, SHAPE REVEAL
|        |   -----+-----      |        |   (all strokes fade in as one group,
|        |                    |        |    no dot, no numbers, no arrows)
|        +--------------------+        |
|                                      |
|      [Show me (off)]  [Clear]        |   helpers (Show me off while the hint is up, as today)
| +----------------------------------+ |
| | Shape guide                      | |   strip: the caption in place of the idle line
| +----------------------------------+ |
| [   Done   ]          [   Skip   ]   |   actions (unchanged)
+--------------------------------------+
```

After the hint ends, the ghost is back and the strip shows the line of the screen's current state.

Reduced motion (and the fallback when the query fails): the ghost steps aside and the still letter shows in the hint look, **no badges, no arrows**; the strip rule is the same; a tap anywhere on the canvas closes it (as today).

Presenter letter slide (untaught), middle column only:

```
+-----------------------+
|                       |
|     ------+           |   stroke panel: the letter, no numbered start dots
|           |           |   (stroke build / R: the panel letter steps aside
|           |           |    and the shape reveal fades it in)
+-----------------------+
  Letter shape                caption (OD-SO8, 2026-11-23; was "Simplified stroke guide"; no second caption)
```

Taught (after SO-3, not reachable in SO-1): today's screens exactly: sequenced dot over the ghost, numbered still with arrows, numbered presenter dots, no **Shape guide** line.

## 4. Where the caption goes, and why

The caption is **a line of the Hoya strip** (`TraceFeedback` in Trace Stroke, the strip of Trace a Word): under the canvas in compact and roomy, in the control column beside the canvas in side mode. It takes the place of the **idle line only**: `hintPlaying && !taught && feedback === 'idle' ? trace.shapeGuide : <the current line>`. A miss line, a pass line (and, after TRACE-IDLE, its tip and keep-going lines) always win: Show me never hides them and never changes the strip's tone or Hoya's pose (`AMENDMENTS-TRACE-IDLE.md` §3.3: during a miss "the retry line stays").

The caption is drawn by the game screen, not by `StrokeHint`, because the presenter uses `StrokeHint` too and must not show it.

| Option | Verdict |
|---|---|
| A chip inside the canvas, under the letter | Fits Trace Stroke at 100 % text (all 30 jamo end by y 152.5 of 200), but Trace a Word's block zones reach y 190 (`BLOCK_ZONES`), so the chip would cover strokes there; and at 200 % text it covers strokes on Trace Stroke's 160 floor canvas too. Rejected. |
| A new row under the canvas | Takes height from the canvas, or makes it change size when the hint starts (the canvas must never move under the finger, UX-09). Rejected. |
| Beside Show me / Clear | Does not fit at 320 (two buttons + chip > 288). Swapping a button for it moves screen-reader focus. Rejected. |
| **The strip, idle line only** | Present in every mode and both games; planned height, and "Shape guide" is shorter than the idle line it stands in for in English, so it does not grow the strip (if a translation is longer, the strip grows as it already does for long lines; es and ko values should stay one line at 320); never covers the letter; never fights a miss or pass line. **Chosen.** |

## 5. Interaction points

| Point | What happens (untaught) |
|---|---|
| Tap **Show me** | The letter's sound plays (unchanged). The ghost hides; all strokes fade in together, as one group, over `motion.duration.crawl` (`motion.easing.standard`) to the hint look; the shape is held for max(1000, (n - 1) x crawl + 100) ms; it fades out (400 ms); the ghost is back. A 1-stroke letter is up for 2000 ms (today 1100); from 3 strokes the total equals today's. The hint lock (`hintPlaying`) follows `onComplete`, as today. Show me is off until the hint ends (as today). |
| Hint ends | The strip shows the line of the current state (the round's result timers keep running during the hint, as today). Nothing is scored, stored or reset. |
| Reduced motion | The still unnumbered letter, ghost hidden, held `staticHintHoldMs(n)` (unchanged); tap anywhere on the canvas closes it early. |
| Draw during the hint | As today (the hint is `pointerEvents="none"` while animating; the still is a button over the canvas). |
| Presenter: stroke build or R | The panel's own letter hides while the reveal plays, so the class sees it fade in; at the end the panel letter is back. Reduced motion: the unnumbered panel letter only. |

## 6. Navigation graph

No new screens. Entry: Trace Stroke (Stage 1 q2, q12), Trace a Word (Stage 7), presenter letter slide. Exit: the hint ends back to the same screen.

## 7. Data needs

- `strokeOrderTaught(jamoId)` (§3.1) for each round's jamo; for Trace Word, every `jamoIds` entry of every `UnitLetter` of the hint's unit (the block, or the one letter in letter mode).
- The romanization for the screen-reader text, passed through `a11yRomanization` (as `traceLetterA11yText` does: ㅇ "silent/ng" is read "silent or ng"): the jamo's romanization; in Trace Word block mode the block's, in letter mode the letter's.
- Presenter: `StrokePanel` gets `orderTaught={slide.strokeReviewed}` and `romanization={slide.romanization}`; when untaught it drops its inline badge loop and hides its strokes while `StrokeHint` reveals.
- Nothing stored. No migration.

## 8. Accessibility

- Animated hint: today it has no accessible node. SO-1 adds one over the canvas: `accessible`, `accessibilityLabel = shape(romanization)`, e.g. "o, shape guide." (one label, no separate hint, so "shape guide" is not read twice).
- Still: the button over the canvas reads `strokeOrder.close(shape(romanization))`: "o, shape guide. Tap to close." `shape` ends with a full stop for this reason (spec §3.6 as amended in this pass).
- The strip is a polite live region on Android; iOS does not announce it (`accessibilityLiveRegion` is Android-only, as TRACE-IDLE §4 notes). Nothing extra is announced on iOS: the hint's label is there when the reader reaches the canvas, as today's still is.
- Trace Word: `orderLabel` becomes `shape(romanization)` for an untaught unit ("ho, shape guide.").
- The still never shows numerals or arrows, so there is no visual-only order information to describe.
- Colours: the reveal is `feedback.nudge` (the colour Show me already uses) at group opacity 0.6 (1 while the canvas is in its retry look: OD-SO9, 2026-11-23), the strokes opaque inside the group so crossings do not darken (darker crossings read like start dots). It is help, not a miss: Hoya's pose never changes because of the hint, and `feedback.danger` is never used.

## 9. Draft strings (SO-1 adds them with reviewed es and ko, spec §3.6)

| Key | English |
|---|---|
| `learner.minigame.trace.shapeGuide` | Shape guide |
| `a11y.minigame.strokeOrder.shape` | `${romanization}, shape guide.` |

`a11y.minigame.strokeOrder.shapeGuide` of spec §3.6 is not needed by this design (one label per hint, above); the spec now marks it dropped. The presenter keeps `strokeCaption` ("Simplified stroke guide") and shows no "Shape guide". Since OD-SO8 (2026-11-23, row SO-1b) an untaught letter's panel is captioned `learner.presenter.slide.shapeCaption` ("Letter shape"), a taught one `strokeCaption`.

## 10. States

Trace Stroke: idle (unchanged) · reveal fading in · shape held · reduced-motion still · after a miss (strip and canvas keep the miss look and line) · final (q12) · ㅇ (no arrow) · roomy · side. Trace a Word: block reveal (letter mode: the one letter). Presenter: still panel, reveal. Taught (contrast). No loading, empty or error state is new: a letter with no stroke data draws nothing (as today).

## 11. Open questions (for the owner)

> Decided by the owner 2026-11-23, all as recommended: see `docs/specs/AMENDMENTS-STROKE-ORDER-STANDARD.md` §10, OD-SO6 (question 1), OD-SO7 (2), OD-SO8 (3) and OD-SO9 (4).

1. **Show me now adds little over the ghost.** The ghost already shows the shape; the reveal hides the ghost and fades the letter in, which reads as "here is the letter" but teaches no more than the ghost does. That is the point of SO-1 (show nothing unchecked), and order teaching comes back per letter with SO-3. Accept knowingly.
2. **ㅇ and the loop nudge.** An untaught ㅇ still gets `pass.loop` ("try going around the other way", OD-SO1), but the shape guide shows no direction. The line does not send the learner to Show me, so nothing contradicts; whether the ring keeps one arrow is the owner's call.
3. **The presenter caption.** "Simplified stroke guide" (OD-SO2: unchanged) now captions a panel that shows no strokes in order; "Letter shape" would be truer. Changing it is a string change outside this pass.
4. **Contrast of the reveal on the retry canvas.** `feedback.nudge` at 0.6 on `feedback.nudgeLight` is faint (about 1.3:1), as today's trail is. With the dot gone, the reveal is the only cue there. Option: full group opacity when the canvas is in its retry look.
