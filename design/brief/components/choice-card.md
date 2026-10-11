# ChoiceCard

**The one option card for "pick one" questions.** A text option, a Korean option or a picture option; a wrong tap is a nudge, never a failure.

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.4 (the `ChoiceCard` paragraph), PR 3.3 · component spec (props, anatomy, token table, states): `design/components/ChoiceCard/spec.md` · code (built): `packages/design-system/src/components/ChoiceCard/` (`ChoiceCard.tsx`, pure `style.ts` `choiceCardStyle`) · used by: story checks and reader checkpoints (F-STORY-003, F-STORY-002), Story Order cards, Listen & Pick and Pic-Word Match (F-QUEST-002), vocabulary questions (F-VOC)

## 1. Context

Every "pick one" question in the app uses this card, so a learner meets one consistent look: the same idle card, the same amber "try another", the same green "correct". It replaces the pill-shaped `Button` for options (a pill cannot hold a two-line option) and the 36-point Tile-style option.

The card has no copy of its own: the caller passes the visible texts and an accessible label that also says the outcome ("Sebae. Correct.", "Deokdam. Try another.").

## 2. Layout

- Full width of its column (or one cell of a 2-column picture grid), radius `radii.lg`, minimum height `touchTarget.child` (80), growing with 200 % text.
- Inside, top to bottom: optional picture (at least `touchTarget.hero` tall, centred) · optional Korean block (`KoreanText` size `sm`: Korean, romanization, gloss) · optional label (left-aligned, wraps).
- Status mark at the end of the row (`Icon`, `spacing.xl`): `check` when correct, `replay` ("try another") when wrong; decorative (the state is in the label and `accessibilityState`).
- Padding `spacing.md` vertical, `spacing.lg` horizontal; `spacing.sm` between picture, Korean and label.

## 3. States

| State | Fill | Border | Mark | Tappable |
|---|---|---|---|---|
| `idle` | `surface.paper` | `border.subtle`, `borderWidth.base` | none | yes |
| `correct` | `feedback.successLight` | `feedback.success` | `check` | no |
| `wrong` | `feedback.nudgeLight` | `feedback.nudge` | `replay` | no (locked) |
| `hint` | `surface.paper` | `border.focus`, `borderWidth.thick` (the ring) | none | yes |
| `disabled` | `surface.sunken` | `border.subtle` | none | no |

Label text is always `text.primary` (`typography.size.body`, semibold): the state is never carried by colour alone. `feedback.danger` never appears. Reduced motion removes the press scale.

## 4. Claude Design prompt

```prompt
Draw a ChoiceCard state matrix for Hangul Route. Output: one 2000 x 1400 sheet.

Rows (5 states): idle, correct, wrong, hint, disabled.
Columns (3 contents): a text option that wraps onto two lines ("The bow you give to elders
on New Year's morning"); a Korean option (세배 large, "sebae" smaller, "New Year bow to
elders" gloss); a picture option (a simple flat illustration of a bowl of rice cake soup
above the label "Tteokguk").

Tokens by name: idle surface.paper fill + border.subtle 2-unit border; correct
feedback.successLight fill + feedback.success border + a check icon at the end; wrong
feedback.nudgeLight fill + feedback.nudge border + a circular-arrow "try again" icon;
hint surface.paper fill + border.focus 3-unit ring; disabled surface.sunken fill. Label
text text.primary 18 semibold, left-aligned. Corner radius radii.lg (16). Minimum height
80. Canvas surface.canvas. Row labels on the left in text.secondary.

Anti-patterns: red anywhere, an X mark, pill-shaped options, centred multi-line text,
text that changes colour by state, emoji.
```

## 5. Acceptance checklist

- [ ] Five states, each told apart by more than colour (mark, ring, or locked look)
- [ ] Wrong is amber with a "try again" mark; no red, no X
- [ ] Two-line labels wrap left-aligned inside an 80-tall minimum card
- [ ] Picture option keeps a text label under the picture
- [ ] Token names only

## 6. Output path

- `design/components/ChoiceCard/matrix__v1__YYYY-MM-DD.png`
