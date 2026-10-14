# HangulKeyboard (screen spec v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7 item 2, §3.14, OD-10 · wireframe `design/wireframes/minigame/type-hangul.md` ("The keyboard") · built in **G-3**
Mock: `mock/keyboard.html` (board), `mock/type-hangul.html` · Shots: `shots/keyboard-board.png`, `shots/type-hangul-320-first.png`, `-768.png`, `-844x390.png`
Code (planned): `packages/design-system/src/components/HangulKeyboard/` (`HangulKeyboard.tsx` paint, `layout.ts` pure `keyboardLayout`, `keys.ts` the KS X 5002 key table, `types.ts`); used by Type Hangul and Write Frame (G-3, G-5)

## What it is

The in-app two-set (dubeolsik) Korean keyboard. It draws keys and reports presses (`onKey(jamo)`, `onDelete()`, `onSpace()`); it does not compose text (that is `composeTyped` in `packages/content-schema`) and holds no text. Layout only, no copy: the caller passes the localised accessible names.

## Props

| Prop | Type | Notes |
|---|---|---|
| `onKey` | `(jamo: string) => void` | the jamo of the key as drawn (the shifted one while Shift is on) |
| `onDelete` / `onSpace` | `() => void` | |
| `width` | `number` | the width it gets; `keyboardLayout` picks the arrangement from it |
| `layoutClass` | `Pick<LayoutClass, 'width' \| 'short' \| 'mediaScale'>` | the cell height and the edge-to-edge rule |
| `soundOf` | `(jamo) => string` | the face's sound value (`JAMO_SOUND_VALUES` + the nine added values) |
| `labels` | `{ key(jamo, sound), shift, delete, space }` | accessible names from `a11y.minigame.keyboard` |
| `disabled` | `boolean` | while the result panel is up the keyboard is not drawn at all (the panel takes its place); `disabled` is for a preview |

## `keyboardLayout(width, layoutClass)`

| Input | Arrangement | Cell width | Cell height |
|---|---|---|---|
| width >= 10 x `touchTarget.min`, or any `short` window | `standard`: rows 10 / 9 (half-cell indent) / Shift 1.5 + 7 + Del 1.5 / Space 5 centred | width / 10 | `touchTarget.min`, or x `mediaScale` on a tablet (77 regular, 90 wide), at most `touchTarget.hero`; a short window: `touchTarget.min` |
| narrower | `split`: C1 C2 C3+Shift, gap `spacing.sm`, V1 V2+Del V3+Space(2) | min(width / 5, `touchTarget.hero`), centred | `touchTarget.min` |

`width` is the window width on a `compact` window (edge to edge, inside the safe-area insets) and the reading column (`min(window - 2 x gutter, layout.maxWidth.reading)`) from `regular` up. Tests: 320 -> split 64 x 64; 375 -> split 75; 599 -> split 96 (capped, centred); 600 -> split 96; 687 -> split; 688 -> standard 64; 768 -> standard 72 x 77; 1180 -> standard 72 x 90; 844 x 390 short -> standard 84 x 64; 568 x 320 and 592 x 360 short -> standard 56 and 59 x 64 (G-3 review: split is 392 tall and would be cut off in a window under 480 tall, so a short window keeps the 4 x 64 rows with cells under 64 wide, the same exception as a window under 320; where even that and the answer row do not fit, Type Hangul scrolls them with the prompt).

## Key table (`keys.ts`)

| Row | Consonant half | Vowel half | With Shift |
|---|---|---|---|
| 1 | ㅂ ㅈ ㄷ ㄱ ㅅ | ㅛ ㅕ ㅑ ㅐ ㅔ | ㅃ ㅉ ㄸ ㄲ ㅆ, ㅒ ㅖ |
| 2 | ㅁ ㄴ ㅇ ㄹ ㅎ | ㅗ ㅓ ㅏ ㅣ | unchanged |
| 3 | ㅋ ㅌ ㅊ ㅍ | ㅠ ㅜ ㅡ | unchanged |

## Look (tokens)

| Part | Token |
|---|---|
| Tray | `surface.canvas`, top hairline `border.subtle` (`borderWidth.thin`) on a phone |
| Consonant key | `surface.paper`, `border.subtle` `borderWidth.thin`, `radii.sm` |
| Vowel key | `surface.sunken`, same border and radius |
| Face | glyph `typography.size.title` (phone) / `display` (tablet) in dp, `weight.semibold`, `text.primary`; sound value `size.caption` / `bodySm` in dp, `text.secondary`, `tracking.tight` |
| Shift, Del, Space | `surface.paper`, `border.strong` `borderWidth.base`; Shift on: `brand.secondaryLight`, `brand.secondaryDark` `borderWidth.thick`, filled glyph; shifted faces `brand.secondaryDark` |
| Pressed | `brand.primaryLight` fill for the press (as `Button` ghost), no animation with reduced motion |
| Key inset | `spacing.xxs` inside the cell; hit areas touch |

The halves differ by fill and by position (split: two groups with a gap; standard: left and right of the row); the fill is never the only cue.

## Accessibility

- Each key: `accessibilityRole="button"`, label `labels.key(jamo, a11yRomanization(sound))` ("ㄱ, g or k"); Shift `accessibilityState={{ selected }}` and its label; Del and Space their labels.
- Web: every key is a focusable button in reading order (row by row; in split the consonant half first); Enter or Space types it.
- No key sound, no haptic per key.

## States

`default` · `shift on` (one-shot) · `pressed` · reduced motion (no press scale) · 200 % text (faces keep their size; the Space label is text and may wrap inside its 2- or 5-cell key).
