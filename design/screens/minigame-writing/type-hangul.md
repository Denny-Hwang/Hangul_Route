# Minigame / Type Hangul (screen spec v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7 item 2, §3.14, §3.15 behaviour 4 (for Write Frame), §5 P-1 · wireframe `design/wireframes/minigame/type-hangul.md` · built in **G-3**
Mock: `mock/type-hangul.html` (page), `mock/type-hangul-states.html` (board) · Shots: `shots/type-hangul-*.png`
Code (planned): `apps/mobile/src/screens/minigames/TypeHangulGame.tsx`; `logic/type-hangul/` (reducer, `scoreTyped`); `HangulKeyboard` (`keyboard.md`)

## Layout

```
compact height (< layout.compactHeight 640)        from 640 tall (375 x 667, tablets)
[pill] [prompt, wraps in the row] [Skip ghost]     [round bar ............] [pill]
[field ........................] [Done]            (heading) ~~ prompt ~~
[keyboard, pinned]                                 [field .............................]
                                                   [keyboard]          phone: [Done] beside the field
                                                   [Done, full width]  tablet: Done and Skip under
                                                   [Skip, ghost]               the keyboard
```

- Three bands: the prompt part (scrolls when it must), the answer row (`flex: none`), the keyboard or the result panel (`flex: none`, same height). On a phone the keyboard spans the window; from `regular` everything sits in the reading column.
- Field: `surface.paper`, `border.strong` `borderWidth.base`, `radii.md`, at least `touchTarget.min` tall, text `typography.size.title` (phone) / `display` (tablet), the open block underlined (`brand.secondary`, `borderWidth.base`), caret `text.primary` `borderWidth.base` wide (no blink with reduced motion). Empty: the mode's instruction as placeholder, `text.muted`, `size.bodySm`.
- Done: `Button` primary `md`; disabled look while empty. Skip: `Button` ghost `sm` in the compact row, ghost `md` full width under the keyboard on a tablet.
- Result panel (replaces the keyboard): `HoyaFeedback`-style strip (`radii.lg`, `borderWidth.base`; pass `feedback.successLight` / `success`, miss `feedback.nudgeLight` / `nudge`, Hoya 40), then on a miss the compare grid (labels `size.bodySm` `text.secondary`; blocks `touchTarget.min` square, `radii.md`; a differing block `feedback.nudgeLight` with a `feedback.nudge` `borderWidth.thick` border and a `spacing.md` dot; a missing block dashed `border.shape`), the target line (`KoreanText`, romanization always), and Fix it (`Button` primary, full width).
- Pass: the field takes `feedback.successLight` / `success` with a `check-circle` glyph; auto-advance after the Trace pass pause (1100 ms, the shipped value).

## Words (drafts; G-3 adds en / es / ko)

As in the wireframe's "Draft strings" table. The compact row's prompt is the `KoreanText` of the target with its gloss; the mode's instruction moves into the field placeholder there.

## States (board `type-hangul-states.html`)

T1 empty · T2 typing · T3 Shift on · T4 pass · T5 near miss · T6 hear · T7 picture · T8 far · T9 tablet portrait · T10 tablet landscape · T11 short window. Every one at 320 x 568 keeps the answer row and the whole keyboard on the first screen.

## Notes for G-3

- Pin the layout with a Playwright spec at 320 x 568, 768 x 1024 and 844 x 390 (screenshots checked by eye), and a unit test on `keyboardLayout`.
- Test P-1 for this kind: no typed string in any telemetry payload, breadcrumb, log line or store; the renderer clears its state on unmount.
