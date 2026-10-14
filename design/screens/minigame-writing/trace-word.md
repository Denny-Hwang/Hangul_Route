# Minigame / Trace a Word (screen spec v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7 item 3, §9 assumption 3 · wireframe `design/wireframes/minigame/trace-word.md` · built in **G-4**
Mock: `mock/trace-word.html` (page), `mock/trace-word-states.html` (board) · Shots: `shots/trace-word-*.png`
Code (planned): `apps/mobile/src/screens/minigames/TraceWordGame.tsx`; `logic/trace-word/` (`placeBlockStrokes`, reducer); reuses `trace-layout.ts`, `trace-evaluator.ts`, `stroke-scoring.ts`, `StrokeHint`

## Layout

The Trace Stroke screen (`TraceStrokeGame.tsx`) with two additions, everything else unchanged (modes `roomy` / `compact` / `side`, the fixed-height Hoya strip, Done and Skip always on screen, no scrolling):

1. **Word strip** under the heading: one chip per block, `touchTarget.min` square, `radii.md`, text `size.title`. Current: `brand.primaryLight` with a `brand.primary` `borderWidth.thick` border. Done: `feedback.successLight`, `feedback.success` border, a `check` glyph (18). Waiting: `surface.paper`, `border.subtle`. In letter mode the part marks (letters of the block, a check after each done one, the current one bold) sit at the end of the strip, so the canvas keeps its height.
2. **Block ghost**: the canvas draws every letter of the block from `jamo-strokes.ts`, placed in its zone, at the shipped ghost look (`text.primary`, opacity 0.12, width 18 of 200). Zone guides: `border.shape` hairline, dash 3 / 5, opacity 0.7; in letter mode the live zone is `surface.paper` with a `brand.primary` line and the other letters' ghosts drop to opacity 0.06.

Canvas looks are Trace Stroke's: idle `brand.primaryLight` / `brand.primary`; pass `feedback.successLight` / `success`; retry `feedback.nudgeLight` / `nudge`; `radii.xxl`, `borderWidth.thick`; size from `traceCanvasSize` (160 to 320, 448 on a tablet). Tablet with a two-block word: two canvases side by side when both reach 240; the waiting one is `surface.paper` with a `border.subtle` `borderWidth.base` border (W6 draws the done one in its pass look).

## States (board)

W1 idle · W2 block 1 passed · W3 retry on block 2 · W4 word done · W5 letter-by-letter · W6 tablet, two canvases.

## Notes for G-4

- The zones in the mock are a first proposal (`gen` transform: each skeleton's 30-170 box mapped into its zone). G-4 tunes them on S7-1's syllables against the system Korean font and records the final numbers as named constants.
- Playwright at 320 x 568 and 768 x 1024: scripted strokes over 호야 pass block by block; screenshots checked by eye.
