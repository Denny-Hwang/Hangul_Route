# ChoiceCard (component spec v1)

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.4 ("`ChoiceCard`" paragraph) and PR 3.3 in §6 · wireframe: `design/wireframes/story/check.md` screens A-D (notation `( )` option card) · Korean content is drawn with `design/components/KoreanText/spec.md`
Code: `packages/design-system/src/components/ChoiceCard/` (`ChoiceCard.tsx` paint, `style.ts` pure `choiceCardStyle`, `types.ts`, `index.ts`)

> **Amended 2026-10-31 by `docs/specs/AMENDMENTS-TOUCH.md` [KT]** (row KT-2, applied): while pressed the card shows a thick `border.shape` outline and shrinks to 0.97 (no shrink under reduced motion) instead of the `border.focus` border, which is also the `hint` ring; inside a `TapBoard` (`design/components/TapBoard/spec.md`) the card commits on release with a 24 px reach, fills gaps to the nearest card and ignores a bounce for 400 ms; the web-dead `hitSlop` is gone. The "While pressed" line, the touch-target bullet and the reduced-motion bullet below say so.

> **Amended 2026-11-16 by `docs/specs/AMENDMENTS-AUDIT-2026-11.md` [AU]** (row AU-17e, audit A11Y-4): the `idle` border is `border.shape` (4.55:1 on `surface.paper`, 4.29:1 on `surface.canvas`), not `border.subtle` (1.32:1), so an option's boundary meets WCAG 1.4.11. `Tile` idle and the app's text fields follow. `disabled` keeps `border.subtle` (an inactive control). With the stronger idle border no state rests on its border colour: `correct` and `wrong` have their fill and mark, `hint` its `borderWidth.thick` ring in `border.focus` (a different hue, but only 1.06:1 against `border.shape` in luminance, so the ring's width and the accessible name carry it), the press look its thicker outline and shrink. The contrast test holds the idle boundary to 3:1 and checks each state has a second cue.

> **Design note 2026-11-24, `docs/specs/F-A11Y-001-answer-feedback-and-announcements.md` [AF]** (row AF-0b; the code lands in AF-1, and AF-6 adds the formal "Amended by" line): `wrong` stops being `selected` (`selected: false`), so a reader does not say "Not this one: pear, selected", where "selected" sounds like the answer; `correct` stays `selected`. The marks do not change (the in-flow 24 mark is the "in the flow" size of `design/components/AnswerFeedback/spec.md`, D1), but, in revision 2 of that pass: **the row keeps its 24 mark column in every state** (an empty 24 view in `idle`, `hint` and `disabled`), so answering never rewraps the text or grows the card, and the romanization and gloss break at spaces, inside a word only as a last resort (D3); and **`hint` becomes the one look-here shape of every game**, a dashed `borderWidth.thick` `border.focus` ring `spacing.xs` outside the card, drawn by a negative-margin wrapper, in place of the card's own thick border (D4). **Tile:** `Tile` (no spec of its own, see the AU-17a note below) gains a `check` on `correct` (`feedback.success`), its mark grows from 16 to 20 and moves onto a 26 disc of the state's light fill straddling its top-end corner (AnswerFeedback D2), and a new `locked` prop reaches `TapTarget` as `inactive`, so a locked miss is focusable and never announced as disabled; `disabled` stays for Build a Letter's used tray tiles only. Culture Quiz and Tap & Respond move onto this card in row layout (OD-AF1 (B)).

> **Amended 2026-11-24 by `docs/specs/F-A11Y-001-answer-feedback-and-announcements.md` [AF]**: the design note above is applied (rows AF-1 and AF-2): `wrong` is no longer `selected`; the row keeps its 24 mark column in every state; `hint` is the one dashed look-here ring outside the card. Culture Quiz and Tap & Respond use the card in row layout (OD-AF1 (B)); Pic-Word Match's word cards use `layout="tile"` (follow-up F6, PR #1118).

## What it is

The one option card for "pick one" questions: a text option, a Korean option, or a picture option. It is **the only definition other specs reuse** (F-QUEST-002 Listen & Pick, Pic-Word Match, Hangul Check; F-VOC). A wrong tap is a nudge, never a failure: amber, no red, no X.

The design system has no copy and no i18n dependency. The caller passes already-localised `accessibilityLabel` (it should also say the outcome, for example "Dog. Try another") and the visible texts.

## Props

| Prop | Type | Notes |
|---|---|---|
| `label` | `string?` | Option text (English or any UI language). Wraps, left-aligned |
| `ko` | `string?` | Taught Hangul. Drawn with `KoreanText` (size `sm`) |
| `romanization` | `string?` | Passed to `KoreanText` (empty string draws no line). Required by `KoreanText` when `ko` is set; defaults to `''` |
| `romanizationReserved` | `boolean?` | `true`: the romanization line keeps its room but is not drawn or announced (`KoreanText` `romanizationReserved`); the open question of a quest Check (AMENDMENTS-AUDIT-2026-11 AU-8). Default `false` |
| `gloss` | `string?` | Passed to `KoreanText` |
| `art` | `ReactNode?` | Picture slot above the texts (SVG from F-STORY-002). Absent or `null`: the texts alone, never a broken image |
| `state` | `'idle' \| 'correct' \| 'wrong' \| 'hint' \| 'disabled'` | See States |
| `wrongMark` | `'replay' \| 'dash'`, default `replay` | The mark of `wrong`. `replay` ("try another") when a retry follows; `dash` for a locked miss that moves on (the F-VOC-004 Speed Round, which has no retry). Added in F-VOC-004 S-4b |
| `layout` | `'row' \| 'tile'`, default `row` | `tile`: a picture option in a grid. The content is centred and uses the whole width; the status mark sits on the top corner (see Anatomy). Added in F-VOC-004 S-4b |
| `onPress` | `() => void?` | Fires only in `idle` and `hint` |
| `accessibilityLabel` | `string` | Required. The accessible name (for a picture option, the text label) |
| `testID` | `string?` | |
| `pressableRef` | `Ref<View>?` | The pressable's node, for a screen that moves focus to the card (as Button's `pressableRef`) |
| `targetStyle` | `StyleProp<ViewStyle>?` | The hit area's own style, around the drawn card: a frame the caller draws (Pic-Word's selection ring and its 4 px padding) is part of the target, so a touch on it is a touch on the card and there is no dead ring (`AMENDMENTS-TOUCH.md` §6, row KT-4b). The press look stays on the drawn card. Added in KT-4b |

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
| `idle` | `surface.paper` | `border.shape` | `text.primary` | none | yes | no | no |
| `correct` | `feedback.successLight` | `feedback.success` | `text.primary` | `check` in `feedback.success` | no | yes | no |
| `wrong` | `feedback.nudgeLight` | `feedback.nudge` | `text.primary` | `replay` ("try another") in `text.primary`; `dash` with `wrongMark="dash"` | no (locked) | yes | no |
| `hint` | `surface.paper` | `border.focus`, thick | `text.primary` | none | yes | no | no |
| `disabled` | `surface.sunken` | `border.subtle` | `text.primary` | none | no | no | yes |

While pressed (`idle` and `hint` only; an answered or disabled card never looks pressed), the card shows the press look of `AMENDMENTS-TOUCH.md` §4.3: the border turns `border.shape` at `borderWidth.thick` and the drawn card shrinks to 0.97 (the pure `pressLook`, `packages/design-system/src/press-look.ts`). Instant, no fade. Under reduced motion there is no shrink, the outline alone. The press look is never `border.focus`, so a press never looks like the `hint` ring or the focus ring. The shrink is on the drawn card, not on the hit area a `TapBoard` measures.

No new token. `disabled` uses `surface.sunken` (the existing Tile convention) so a resolved item's other options read as inactive without lowering the text contrast.

### Deviation notes (against the F-STORY-003 paragraph)

- The spec lists `colors.hoya.furDark` as the replacement for the Tile literal `#B5862A`. `furDark` on `feedback.nudgeLight` is 2.85:1, under both the 4.5 text bar and the 3 non-text bar, so it is **not** used for text or the mark there. The wrong-state label stays `text.primary` (14:1) and the mark is `text.primary`. `furDark` is 3.28:1 on `surface.paper` and remains the documented accent for any other surface.
- `feedback.nudge` on `surface.paper` is 1.86:1, so the amber border alone cannot signal the state (WCAG 1.4.1 / 1.4.11). The `replay` (or `dash`) mark and the caller's accessible name carry it; `correct` has the `check` mark; `hint` has the thick `border.focus` ring (4.30:1 on paper).
- **[AU] 2026-11-16, `docs/specs/AMENDMENTS-AUDIT-2026-11.md` row AU-17a (audit A11Y-1):** `Tile` (the jamo tile of Match Sound, Odd One Out and Build a Letter; it has no spec of its own) now follows this card on a miss. Its literal `#B5862A` label (2.85:1 on `feedback.nudgeLight`) is gone: the wrong-state glyph is `text.primary` (14.02:1) and the tile carries the same `replay` mark in `text.primary`, 16 dp (`spacing.lg`), on its top corner 2 dp in (`spacing.xxs`), out of the flow. The glyph and the romanization line start 20 dp from the tile's inner edge (`spacing.md` + `spacing.sm`), so the mark covers neither at any text size and the tile keeps its size. Code: `packages/design-system/src/components/Tile/style.ts` (pure `tileStyle`, read by the contrast contract test).

## Contrast (enforced in `packages/design-system/src/__tests__/contrast.test.ts`)

- `text.primary` on `surface.paper`, `feedback.successLight`, `feedback.nudgeLight`, `surface.sunken` >= 4.5:1 (already covered for paper and sunken; the two tints are added)
- `feedback.success` mark on `feedback.successLight` >= 3:1 (non-text)
- `text.primary` mark on `feedback.nudgeLight` >= 4.5:1
- `border.focus` ring on `surface.paper` and `surface.canvas` >= 3:1 (already covered)
- `hoya.furDark` is pinned at >= 3:1 on `surface.paper` and documented as under 3:1 on `feedback.nudgeLight` (why it is not used there)

## Accessibility

- One accessible element: `accessibilityRole="button"`, `accessibilityLabel` from the caller, `accessibilityState={{ disabled, selected }}` from `choiceCardStyle`. It is drawn through `TapTarget` (`design/components/TapBoard/spec.md`): an answered or `disabled` card is `inactive` there (a board claims a touch on it and commits nothing), and it stays a focusable button with the same accessible state, so a screen can still move focus to it.
- Taps: inside a `TapBoard` the board decides (commit on release, 24 px reach, 32 px travel, gap fill to the nearest card, the 400 ms lock); outside one the card is a plain button whose press is guarded against a finger's bounce (`usePressGuard`: a finger's repeat within 400 ms and a finger's press during the app-level tap lock are dropped; a mouse, keyboard or screen-reader press runs). A card with no `onPress` is inactive too.
- The Korean block inside is not a separate stop (the card is one element); the caller's label names it.
- Colour is never the only cue (see deviation notes): mark, ring and the accessible name.
- Touch target: whole card >= `touchTarget.child` (80), full row width is tappable. No `hitSlop` (react-native-web dropped it, so it never reached the web); inside a `TapBoard` the board's gap fill (`spacing.lg`, 16) reaches the card from the gap around it on every platform.
- Text wraps, never truncates; the card grows with the learner's text size. No emoji, no raster, no fixed height.
- Reduced motion: the only motion is the 0.97 press shrink, and under reduced motion it is not drawn (the outline alone).
- Tests: `src/__tests__/choice-card.test.ts` (the pure styles, `wrongMark`, `choiceCardTileWidth`), `src/__tests__/press-look.test.ts` (the press look) and `src/components/ChoiceCard/__tests__/ChoiceCard.test.tsx` (where the mark sits in each layout; the `TapTarget`, `inactive` states, the press look and reduced motion).

## Where it appears

F-STORY-003 (`StoryCheckGame`: text, Korean and picture options), F-QUEST-002 (Listen & Pick, Pic-Word Match, Hangul Check), F-VOC (`VocabQuestionView`: `layout="tile"` for picture options, `wrongMark="dash"` in the Speed Round, `replay` in the quick check, where a retry follows). Visual regression: all five states are shown in `/design-preview/components` (F-VR-001).
