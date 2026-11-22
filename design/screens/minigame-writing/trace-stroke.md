# Minigame / Trace Stroke: pause, miss and tip states (screen note, TI-0b)

Spec: `docs/specs/AMENDMENTS-TRACE-IDLE.md` §3.2 (keep going), §3.3 (miss keeps the ink, Clear reopens), §3.4 (Next after a tip), §3.6 (strings) · row **TI-0b** · wireframe `design/wireframes/minigame/families.md` ("Trace Stroke states")
Mock: `mock/trace-stroke-states.html` (board S1–S11), `mock/trace-stroke-text200.html` (S12, the 200 % text open item) · Shots: `shots/trace-stroke-states.png`, `shots/trace-stroke-320-text200.png` (1x)
Code: `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx` (built in **TI-2**); the gate is `logic/trace-ready.ts` (TI-1, merged; TI-2 adds `TRACE_KEEP_GOING_MS` there)

## Layout

Unchanged from the shipped screen: modes `compact` (320 x 568: no Hoya in the strip, Done and Skip side by side), `roomy` (content 700 tall and more: Hoya 40 in the strip, the instruction caption, Done `lg` and Skip stacked), `side` (landscape: canvas left, control column of `traceSidePanelWidth`). Canvas looks are the shipped ones: idle `brand.primaryLight` / `brand.primary`; pass `feedback.successLight` / `success`; miss `feedback.nudgeLight` / `nudge` (never `feedback.danger`); `radii.xxl`, `borderWidth.thick`; ghost `text.primary` at opacity 0.12, width 18; ink width 8 (viewBox 200).

What TI-2 adds:

1. **Keep going line** (S2, S8): the status strip's text changes to `trace.keepGoing`; strip look, canvas look and Hoya pose stay idle. Done stays enabled.
2. **Miss keeps the ink** (S3, S9): no wipe; the canvas keeps the nudge look and the drawing until the next stroke (S4: back to idle, new ink added) or Clear (S5: empty, idle).
3. **Next** (S6, S10, S11): after a pass with a tip, `trace.next.cta` replaces Done in the same slot and at the same size (`md` = `touchTarget.min` in compact and side, `lg` = `touchTarget.child` in roomy), tone `primary`, and takes focus (focus ring `border.focus`, `borderWidth.thick`, shown for keyboard / switch focus only). The round advances only when it is tapped; focus then goes to the new round's heading. A clean pass (S7) is unchanged: 1.1 s advance, no Next.
4. **Clear** stays as today: on whenever there is ink, results included (§3.3: after a miss or a tip it empties the canvas and the check opens again).

**No new token, no new component, no new glyph.** Next is the design-system `Button`.

## Strings drawn (§3.6; TI-2 adds them with es and ko)

| Key | English |
|---|---|
| `learner.minigame.trace.idle` (changed) | Draw each line slowly. Tap Done when you finish. |
| `learner.minigame.trace.keepGoing` (new) | Keep going. Tap Done when you finish. |
| `learner.minigame.trace.next.cta` (new) | Next |

The other lines on the board are today's strings (`trace.retry.start`, `trace.pass.order`, `.open`, `.clean`, `showMe`, `clear`, `done`, `skip`).

## The drawings on the board

ㅂ (`jamo:bieup`, 4 strokes, the shipped skeleton). The ink was scored with the real `scoreTrace` (`logic/stroke-scoring.ts`, points every 3 units) on this commit:

| Board | Ink | Coverage | Per stroke (1–4) | Result |
|---|---|---|---|---|
| S2, S8 | strokes 1–2 | 0.73 | 1.00 1.00 0.46 0.46 | would pass on Done; not finished (floor 0.8), so no idle score |
| S3, S9 | stroke 1 + a stray line | 0.37 | 1.00 0.00 0.23 0.23 | miss on Done |
| S4 | S3's ink + stroke 2 | 0.73 | 1.00 1.00 0.46 0.46 | not finished; Done would pass |
| S7 | all 4 strokes, in order | 1.00 | 1.00 1.00 1.00 1.00 | finished; clean pass |
| S6, S11, S12 | all 4 strokes, bottom bar first | 1.00 | 1.00 1.00 1.00 1.00 | pass, `orderCorrect` false, so `pass.order` |
| S10 | all 4, bottom bar right to left | 1.00 | 1.00 1.00 1.00 1.00 | pass; stands for the direction tip `pass.open` (direction not re-run here) |

## Checks made on the shot

- Every device box on the board fits with no scroll (Playwright: content height equals box height in all 11 frames).
- At 320 x 568 the longest tip (`pass.order`) wraps to 3 lines and Next and Skip stay on screen.
- At 200 % text (S12) they do not: content 625 in a 566 box. Logged as open item 3 in the wireframe, with a recommended fix for TI-2.
- No red anywhere; a miss is amber plus Hoya `thinking` (roomy), and the text line, so it does not rely on colour.
- Next and Done have the same box in each mode, so the button rows do not move between S3, S4 and S6 (a 3-line tip still takes height from the canvas, as today).

**The mock is a design reference, not shipped code.** The board's `<style>` rules use only the token custom properties of `mock/writing.css`, plus one named layout constant (`--trace-side-panel`, `traceSidePanelWidth` for S11). SVG art geometry (Hoya, the `close` glyph) is copied from the shipped `Hoya.tsx` and `Icon/glyphs.ts`. Like the Trace a Word board, the mock leaves out the header's Display button.
