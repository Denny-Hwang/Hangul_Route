# Minigame / Trace shape guide (screen spec v1)

Spec: `docs/specs/AMENDMENTS-STROKE-ORDER-STANDARD.md` §3.1, §3.2, §5, OD-SO1, OD-SO2 · row **SO-0c** (this design pass), built in **SO-1** · to be approved by multi-agent review (CLAUDE.md §5, owner decision 2026-10-12); review log at the end
Wireframe: `design/wireframes/minigame/trace-stroke-shape-guide.md`
Mock: `mock/trace-stroke-shape-guide-states.html` (board G1 to G11 and the timing), `mock/trace-stroke-shape-guide.html` (G3 filling the window), `mock/shape-guide.css` (loaded after `writing.css`); presenter: `../presenter/mock/slide-letter-shape.html`, `slide-letter-shape-reveal.html`
Shots: `shots/trace-stroke-shape-guide-states.png`, `shots/trace-stroke-shape-guide-320.png` (320 x 568 at 2x); `../presenter/shots/slide-letter-shape-1280x720.png`, `slide-letter-shape-reveal-1280x720.png`
Code (SO-1): `components/StrokeHint.tsx` (props `orderTaught`, `romanization`; SO-1b: `retryLook`, `romanizationOr`), `screens/minigames/TraceStrokeGame.tsx`, `TraceWordGame.tsx`, `screens/presenter/slides/LetterSlide.tsx`
Owner decisions 2026-11-23 (spec §10, row SO-1b): OD-SO8 the presenter caption, OD-SO9 the reveal on the retry canvas, OD-SO10 "or" in the label's language; noted below where they change this pass

Kept in its own files so it does not collide with the TRACE-IDLE design pass (TI-0b), which changes `families.md` and adds Trace Stroke states to this folder; the README of this folder gets its row when both have merged.

## What changes, untaught letter or unit only

| Surface | Today (and taught, after SO-3) | Untaught (SO-1) |
|---|---|---|
| Show me, animated | a dot walks each stroke in order over the ghost, leaving a trail | **shape reveal**: the ghost hides, every stroke fades in together as one group, held, fades out, the ghost is back; no dot |
| Show me, reduced motion / query fails | still with numbered start badges and arrows | still letter only, ghost hidden: **no badges, no arrows** |
| Caption | none | **Shape guide** in the Hoya strip, in place of the **idle** line only, while the hint is up; a miss or pass line always wins (wireframe §4) |
| Screen reader | animated: nothing; still: "Stroke order. 2 strokes. 1: down. 2: right. Tap to close." | animated: one label "o, shape guide."; still: "o, shape guide. Tap to close." (romanization through `a11yRomanization`) |
| Trace a Word | the unit's strokes walked letter by letter; order read letter by letter | the unit's strokes fade in together; "ho, shape guide." (letter mode: the one letter, its own gate and romanization) |
| Presenter stroke panel | numbered start dots; the dot walk on the stroke build / R | the letter with **no dots**; on the stroke build / R the panel letter hides and the shape reveal fades it in; caption "Letter shape" (OD-SO8; the shots show the earlier "Simplified stroke guide"; a taught letter has no caption, OD-SO8 as corrected 2026-11-23), no "Shape guide" |

Unchanged: the canvas, ink, sizes and modes (the ghost only steps aside while an untaught hint is up); Show me and its sound; Done, Skip, Clear; scoring; the hint's colour.

## Look

- **Reveal and still strokes**: `colors.feedback.nudge`, width 14 of the 200 viewBox, round caps and joins, opaque inside **one group** whose opacity is 0.6 (today's value; **1** while the canvas is in its retry look, OD-SO9: `feedback.nudge` on `feedback.nudgeLight` is about 1.3:1 at 0.6 and about 1.6:1 at 1, still under 3:1, so a darker retry stroke is an open owner question), so crossings (ㅗ's junction, ㅁ's corners) do not darken into dot-like marks that would hint at where strokes break. In React Native: one `G`/`Svg` with `opacity` from the shared value.
- **Reveal timing** (board, "Timing"): group opacity 0 → 0.6 (1 on the retry canvas; in code one 0 → 1 progress value times the look) over `motion.duration.crawl` (600) with `motion.easing.standard` (`Easing.bezier(0.2, 0, 0, 1)` in Reanimated; today's demo uses a literal bezier), **one** shared value; held for max(1000, (n - 1) x crawl + 100); fade-out 400 (today's). ㅇ: 2000 ms (today 1100); from 3 strokes the total equals today's. `hintPlaying` ends on `onComplete`, so the lock follows. Spec test 8 asserts the single shared value, not a total in ms.
- **Strip while the hint is up**: only when the strip would show the idle line, it shows `learner.minigame.trace.shapeGuide` instead, in the idle look it already has (`surface.paper`, `border.subtle`; roomy: Hoya `idle`). A miss or pass line, its tone and Hoya's pose are never replaced. Height: the strip's planned lines (2, 3 beside the canvas). Rule: `hintPlaying && !taught && feedback === 'idle' ? shapeGuide : feedbackMessage`; the caption is the game screen's, `StrokeHint` renders none.
- **Presenter panel**: today's panel (`surface.paper`, `border.subtle`, stage radius) with the strokes in `text.primary` width 14 and no start dots. On the stroke build / R the panel hides its own strokes while `StrokeHint` reveals the letter in the hint look (a reveal over the black letter would only tint it, invisible on a projector), then the panel letter is back. Reduced motion: the unnumbered panel letter. Wiring: `StrokePanel` gets `orderTaught={slide.strokeReviewed}` and `romanization={slide.romanization}`.
- No new token, no new colour. Nothing on a miss uses `feedback.danger`; Hoya is never `thinking` because of the hint.

## Constants

Values that are not tokens; all are today's shipped values, unchanged.

| Where | Value | From |
|---|---|---|
| Hint stroke opacity / width | 0.6 / 14 (viewBox 200); the untaught shape guide on the retry canvas: 1 (OD-SO9) | `StrokeHint.tsx` |
| Reveal fade-out, hold after the last stroke | 400 / 100 ms | `StrokeHint.tsx` |
| Shape hold floor | 1000 ms | new in this pass: a 1-stroke letter is otherwise at full opacity for 100 ms |
| Still hold | `staticHintHoldMs(n)` = clamp(1400 + 700n, 2000, 5000) | `logic/stroke-diagram.ts` |
| Taught still badge (G9 only) | r 11, ring 2.5, arrow 3 | `BADGE_RADIUS` (`logic/stroke-diagram.ts`), `StrokeHint.tsx` |
| Board G2 opacity | 0.3 | the reveal half way (an illustration, not a value) |
| Side column | 45 %, 240 to 380 | `traceSidePanelWidth` |
| Zone guide dash / opacity | 3 5 / 0.7 | the D-3 mock (`trace-word.md`) |

## Board

G1 idle ㅗ (reference) · G2 reveal partway · G3 shape held · G4 reduced-motion still · G5 ㅇ still (no arrow) · G6 final ㅁ (q12) · G7 after a miss · G8 Trace a Word block 호 · G9 taught (contrast) · G10 roomy 390 x 844 · G11 side 844 x 390 · Timing.

Drawn data: `jamo-strokes.ts` on this commit (AU-14); 호 placed by the real `placeBlockStrokes`; G9 from the real `buildStrokeDiagram`. The strokes stay **hypotheses** until SO-0b's table is reviewed (WO-27); nothing here marks a letter taught.

## Checks made on the shots

- 320 x 568: canvas 220 x 220, Done and Skip end at 556 (on screen); the Trace a Word board frame fits 568 with the word strip.
- The reveal is the whole letter in every frame; no numeral, arrow or dot in any untaught frame.
- No red anywhere; the retry frame (G7) keeps the amber canvas.
- "Shape guide" is one line at 320 in every mode, shorter than the idle line it stands in for (today's, and TRACE-IDLE TI-2's "Draw each line slowly. Tap Done when you finish.").
- No 200 % text shot: the mock scales every rem, buttons included, so it cannot show the app's type scale. The caption cannot grow the strip in English (shorter than the idle line), and it never touches the canvas; SO-1 checks 200 % in the app.

## Review log

- 2026-11-22, multi-agent review (two lenses: spec conformance and code truth; charter, UX, accessibility, design system). No blocker. Fixed, majors: the presenter reveal was a tint over the black letter (the panel now hides its letter while revealing; held frame shot); Show me repeated the ghost (the ghost steps aside; trade-off in wireframe open question 1); a 1-stroke letter held the shape 100 ms (hold floor 1000); the caption replaced miss and pass lines, against TRACE-IDLE §3.3 (idle line only); spec test 8 tested the caption in `StrokeHint` (screen level; spec amended); the still read "o, shape guide Tap to close." (`shape` ends with a full stop; spec amended). Fixed, minors: crossings darkened (group opacity); double "shape guide" reading (one label; the `shapeGuide` a11y key dropped); `a11yRomanization`; Trace Word letter mode; side-mode wording; iOS live region; the strip line after the hint follows the current state; presenter wiring; `slide-letter.md` leads with the untaught panel; caption and retry contrast raised as open questions. Nits: easing, side width, `BADGE_RADIUS` file, unused variable, wording. Not taken: a 200 % text shot (reason above).
