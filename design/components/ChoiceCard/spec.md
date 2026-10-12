# ChoiceCard (component spec v1)

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.4 ("`ChoiceCard`" paragraph) and PR 3.3 in §6 · wireframe: `design/wireframes/story/check.md` screens A-D (notation `( )` option card) · Korean content is drawn with `design/components/KoreanText/spec.md`
Code: `packages/design-system/src/components/ChoiceCard/` (`ChoiceCard.tsx` paint, `style.ts` pure `choiceCardStyle`, `types.ts`, `index.ts`)

## What it is

The one option card for "pick one" questions: a text option, a Korean option, or a picture option. It is **the only definition other specs reuse** (F-QUEST-002 Listen & Pick, Pic-Word Match, Hangul Check; F-VOC). A wrong tap is a nudge, never a failure: amber, no red, no X.

The design system has no copy and no i18n dependency. The caller passes already-localised `accessibilityLabel` (it should also say the outcome, for example "Dog. Try another") and the visible texts.

## Props

| Prop | Type | Notes |
|---|---|---|
| `label` | `string?` | Option text (English or any UI language). Wraps, left-aligned |
| `ko` | `string?` | Taught Hangul. Drawn with `KoreanText` (size `sm`) |
| `romanization` | `string?` | Passed to `KoreanText` (empty string draws no line). Required by `KoreanText` when `ko` is set; defaults to `''` |
| `gloss` | `string?` | Passed to `KoreanText` |
| `art` | `ReactNode?` | Picture slot above the texts (SVG from F-STORY-002). Absent or `null`: the texts alone, never a broken image |
| `state` | `'idle' \| 'correct' \| 'wrong' \| 'hint' \| 'disabled'` | See States |
| `wrongMark` | `'replay' \| 'dash'`, default `replay` | The mark of `wrong`. `replay` ("try another") when a retry follows; `dash` for a locked miss that moves on (the F-VOC-004 Speed Round, which has no retry). Added in F-VOC-004 S-4b |
| `layout` | `'row' \| 'tile'`, default `row` | `tile`: a picture option in a grid. The content is centred and uses the whole width; the status mark sits on the top corner (see Anatomy). Added in F-VOC-004 S-4b |
| `onPress` | `() => void?` | Fires only in `idle` and `hint` |
| `accessibilityLabel` | `string` | Required. The accessible name (for a picture option, the text label) |
| `testID` | `string?` | |

## Anatomy

```
 +-------------------------------------+      +--------------+
 | option text that can wrap onto      |      |   (picture)  |   <- art >= 96 (touchTarget.hero),
 | two lines without being cut     [v] |      |  label       |      centred, text under it
 +-------------------------------------+      +--------------+
   text block left-aligned                        picture option
   status mark at the end (correct / wrong)
```

Order inside the card: art, then the Korean block (`ko` + romanization + gloss), then `label`. Any of them may be missing. The status mark sits at the end of the row and is decorative (the state is in the accessible name and `accessibilityState`).

**Tile layout** (`layout="tile"`, F-VOC-004 S-4b, wireframe `design/wireframes/vocab/speed-round.md` B, D, E, F):

```
 +----------------(v)+     <- the status mark on the top corner: spacing.xs from the edges, on a round
 |                   |        disc (radii.pill, padding spacing.xxs) of the state's own fill, so it reads
 |     (picture)     |        over the art with the same contrast pairs as the row mark
 |                   |
 +-------------------+
   art centred, Korean block (if any) centred under it
```

The row keeps no width for the mark, so the narrowest tile is the art plus the horizontal padding and the thickest border: `choiceCardTileWidth(art) = art + 2 x spacing.lg + 2 x borderWidth.thick` (134 dp for a 96 dp picture). Two tiles and an 8 dp gap fit the 288 dp column of a 320 wide phone. The mark shows only once a card is answered, so it never covers the picture while the learner is choosing.

## Tokens (no literals)

| Part | Token |
|---|---|
| Radius | `radii.lg` |
| Min height | `touchTarget.child` (80); grows with 200 % text |
| Border width | `borderWidth.base` (`borderWidth.thick` in `hint`, the ring) |
| Padding | `spacing.md` vertical, `spacing.lg` horizontal; `spacing.sm` between art, Korean and label |
| Label | `typography.size.body` (18 floor), `typography.weight.semibold`, `colors.text.primary`, `typography.leading.normal` |
| Art | min height `touchTarget.hero`, centred |
| Status mark | `Icon` at `spacing.xl` (24) |

State styles (the pure `choiceCardStyle(state)`):

| State | Background | Border | Text | Mark | Tappable | `selected` | `disabled` |
|---|---|---|---|---|---|---|---|
| `idle` | `surface.paper` | `border.subtle` | `text.primary` | none | yes | no | no |
| `correct` | `feedback.successLight` | `feedback.success` | `text.primary` | `check` in `feedback.success` | no | yes | no |
| `wrong` | `feedback.nudgeLight` | `feedback.nudge` | `text.primary` | `replay` ("try another") in `text.primary`; `dash` with `wrongMark="dash"` | no (locked) | yes | no |
| `hint` | `surface.paper` | `border.focus`, thick | `text.primary` | none | yes | no | no |
| `disabled` | `surface.sunken` | `border.subtle` | `text.primary` | none | no | no | yes |

While pressed, the border is `border.focus` (no scale, no fade: instant, so reduced motion needs nothing extra).

No new token. `disabled` uses `surface.sunken` (the existing Tile convention) so a resolved item's other options read as inactive without lowering the text contrast.

### Deviation notes (against the F-STORY-003 paragraph)

- The spec lists `colors.hoya.furDark` as the replacement for the Tile literal `#B5862A`. `furDark` on `feedback.nudgeLight` is 2.85:1, under both the 4.5 text bar and the 3 non-text bar, so it is **not** used for text or the mark there. The wrong-state label stays `text.primary` (14:1) and the mark is `text.primary`. `furDark` is 3.28:1 on `surface.paper` and remains the documented accent for any other surface.
- `feedback.nudge` on `surface.paper` is 1.86:1, so the amber border alone cannot signal the state (WCAG 1.4.1 / 1.4.11). The `replay` (or `dash`) mark and the caller's accessible name carry it; `correct` has the `check` mark; `hint` has the thick `border.focus` ring (4.30:1 on paper).

## Contrast (enforced in `packages/design-system/src/__tests__/contrast.test.ts`)

- `text.primary` on `surface.paper`, `feedback.successLight`, `feedback.nudgeLight`, `surface.sunken` >= 4.5:1 (already covered for paper and sunken; the two tints are added)
- `feedback.success` mark on `feedback.successLight` >= 3:1 (non-text)
- `text.primary` mark on `feedback.nudgeLight` >= 4.5:1
- `border.focus` ring on `surface.paper` and `surface.canvas` >= 3:1 (already covered)
- `hoya.furDark` is pinned at >= 3:1 on `surface.paper` and documented as under 3:1 on `feedback.nudgeLight` (why it is not used there)

## Accessibility

- One accessible element: `accessibilityRole="button"`, `accessibilityLabel` from the caller, `accessibilityState={{ disabled, selected }}` from `choiceCardStyle`.
- The Korean block inside is not a separate stop (the card is one element); the caller's label names it.
- Colour is never the only cue (see deviation notes): mark, ring and the accessible name.
- Touch target: whole card >= `touchTarget.child` (80), full row width is tappable; `hitSlop` `spacing.sm`.
- Text wraps, never truncates; the card grows with the learner's text size. No emoji, no raster, no fixed height.
- Reduced motion: no motion at all in the component.
- Tests: `src/__tests__/choice-card.test.ts` (the pure styles, `wrongMark`, `choiceCardTileWidth`) and `src/components/ChoiceCard/__tests__/ChoiceCard.test.tsx` (where the mark sits in each layout).

## Where it appears

F-STORY-003 (`StoryCheckGame`: text, Korean and picture options), F-QUEST-002 (Listen & Pick, Pic-Word Match, Hangul Check), F-VOC (`VocabQuestionView`: `layout="tile"` for picture options, `wrongMark="dash"` in the Speed Round, `replay` in the quick check, where a retry follows). Visual regression: all five states are shown in `/design-preview/components` (F-VR-001).
