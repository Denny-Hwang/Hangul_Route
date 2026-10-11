# SparkMeter (component spec v1)

Spec: `docs/specs/F-VOC-004-speed-round.md` §3.6 ("spark meter" in the question-screen header), §3.8 (no flashing, reduced motion), §3.9 (`SparkMeter` props, `sparkLayout`) and PR S-4 in §6 · wireframe: `design/wireframes/vocab/speed-round.md` screens B to G (notation `* * * . .`, "fill-only, single soft fade") · anti-shame rules: CLAUDE.md §1 "Feedback & motivation" (meters only fill)
Render: `v1.png` (react-native-web at 320 wide: values 0, 1, 3, 10, 11, 29, 30, 45 on `surface.canvas`)
Code: `packages/design-system/src/spark.ts` (pure `sparkLayout`, `isNewlyLit`, `sparkEntrance`; unit-tested and counted by design-system coverage) and `packages/design-system/src/components/SparkMeter/` (`SparkMeter.tsx` paint with a hook-free `SparkMeterBody`, `types.ts`, `index.ts`; element-tree test in `__tests__/SparkMeter.test.tsx`)

## What it is

A row of small slots that light up one by one as the learner catches words in a Speed Round. It is a counter that **only fills**: the caller passes the number of sparks, which never goes down (F-VOC-004 S3), and the meter has no code path that animates downward, no empty-state reset and no "combo" that breaks. A miss leaves it exactly as it was.

The design system has no copy and no i18n dependency. The caller passes an already-localised `accessibilityLabel` (for example "3 sparks", and "Full of sparks" once full).

## Props

| Prop | Type | Notes |
|---|---|---|
| `value` | `number` | Sparks earned so far. Negative, non-finite or fractional input is read as the whole number at or below it, never below 0 |
| `slots` | `number?` | Slots per row, default `10` |
| `maxRows` | `number?` | Rows before the meter is full, default `3` |
| `reserveRows` | `boolean?` | Default `false`. When `true` the meter holds the height of all `maxRows` rows from the start, so a second or third row never pushes the content below it down mid-round (the Challenge header, where a round can pass 10 sparks). Relaxed rounds have at most 10 questions, so one row is enough there |
| `accessibilityLabel` | `string` | Required. The accessible name, already localised |
| `testID` | `string?` | |

## Layout (`sparkLayout(value, slots, maxRows)`, pure)

Returns `{ filled, rows, slots, full }`:

- `filled` = sparks drawn, `min(value, slots x maxRows)`, never negative.
- `rows` = how many sparks each visible row holds, in order. One row is always shown (all slots empty at the start of a round). Sparks beyond a full row start the next row: `value` 11 with 10 slots is `[10, 1]`; at most `maxRows` rows.
- `slots` = the slots per row actually used (`slots` and `maxRows` below 1 are read as 1).
- `full` = `value >= slots x maxRows` ("full of sparks"). Extra sparks after that change nothing on screen.

For any `a <= b`, `sparkLayout(b)` has at least as many filled sparks as `sparkLayout(a)` in every row (monotonic; a unit test pins it).

```
start            * . . . . . . . . .        one row, one spark
after 10         * * * * * * * * * *        a full row, not yet "full"
after 11         * * * * * * * * * *
                 * . . . . . . . . .        a second row starts
after 30+        ( * * * * * * * * * * )    three rows, the soft brand.primaryLight backdrop:
                 ( * * * * * * * * * * )    "full of sparks"
                 ( * * * * * * * * * * )
```

## Tokens (no literals)

| Part | Token |
|---|---|
| Slot size | `spacing.lg` (16) square, scaled with the window through `useMediaSize` (as `PipRow` does), so it is 16 on a phone and larger on tablet and desktop |
| Gap between slots and rows, and the padding | `spacing.xs`, scaled the same way |
| Lit spark | a four-point spark shape filled `brand.primary` |
| Empty slot | a small circle, fill `surface.sunken`, outline `border.strong` at `borderWidth.thin` on screen (the stroke is drawn as `borderWidth.thin x 24 / slot size` in the 24-unit box, so it stays a hairline at every scale) |
| Full backdrop | `brand.primaryLight`, `radii.pill` (`radii.lg` once there is more than one row), padding `spacing.xs` |

No new token.

### Width at 320 wide (for the Speed Round header, S-5 and S-6)

At a phone size the meter is 10 x 16 + 9 x 4 = 196 wide, plus 2 x 4 padding = 204. A 320-wide screen with 16 gutters leaves 288.

- Relaxed: Back (64) + a gap + the meter (204) fits on one line (64 + 204 = 268 of 288).
- Challenge: Back (64) + the meter (204) + Pause (64) = 332, which does not fit, and the clock digits and bar need room as well. A smaller meter does not solve this (even 12-wide slots leave about 14 for the clock). So in Challenge the header has **two lines**: Back, the clock digits and Pause on the first; the meter (with `reserveRows`, so it never grows into the question) and the clock bar on the second.
- The row Views also wrap (`flexWrap`), so a caller passing more `slots` than fit never overflows the screen.

## Motion (WCAG 2.3.1, no flashing)

- A newly lit spark plays **one** scale-and-fade of 300 ms (`SPARK_FILL_MS`, scale 0.6 to 1 and opacity 0 to 1). Nothing blinks, pulses, loops or shakes; at most one spark lights per answer, far under three changes a second. The first spark of a new row (the 11th, the 21st) plays the same fill: the meter compares the count drawn at the last commit with the new one (`isNewlyLit`), not each slot's own history.
- The entrance is decided **before the first frame** (`sparkEntrance`): a lit spark is its own element that mounts when its slot lights, with its starting progress already set, so it is never drawn full, hidden and shown again.
- Reduced motion (reanimated `useReducedMotion`, which is synchronous and follows the system setting on iOS, Android and the web): the spark appears instantly and is never hidden, not even for a frame.
- Sparks already lit when the meter appears are drawn as they are (no animation on mount).
- The meter never animates downward. If a caller ever passed a smaller value, slots would change silently (no animation), but the Speed Round reducer never lowers `sparks`.

## Contrast (enforced in `packages/design-system/src/__tests__/contrast.test.ts`)

- `brand.primary` spark on `surface.canvas`, `surface.paper` and `brand.primaryLight` >= 3:1 (non-text, WCAG 1.4.11).
- The empty slots are placeholders only: the count is carried by the lit sparks and by the accessible name, so the quiet `border.strong` outline is not required to reach 3:1.

## Accessibility

- One accessible element (`accessible`, `accessibilityRole="image"`, which react-native-web renders as `role="img"` so the name is read on every platform) with the caller's `accessibilityLabel`; the individual slots are hidden from assistive technology, on native through `importantForAccessibility` and `accessibilityElementsHidden`, and on the web through `aria-hidden` (react-native-web maps only that one to the DOM).
- Not a live region by itself: the Speed Round announces "3 sparks" politely at most once per question (F-VOC-004 §3.8), so the component never chatters.
- Colour is not the only cue: a lit slot changes shape (spark) as well as colour (circle to spark).

## Never

- No number, percentage or fraction drawn inside the meter.
- No red, no `feedback.danger`, no empty-state reset, no "streak" or "combo" wording (the caller's copy is checked by `scanLearnerCopy`).
