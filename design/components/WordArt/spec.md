# WordArt (component spec v1)

Spec: `docs/specs/F-VOC-002-wordart-svg-system.md` §3.7 (renderer, accessibility, modes) and PR W-1c in §6 · art brief: `design/brief/illustrations/word-art.md` · the screens that show it: `design/wireframes/vocab/topics.md`, `flashcards.md`, `speed-round.md` (the picture is the content of those screens, it has no wireframe of its own)
Code: `packages/design-system/src/components/WordArt/` (`WordArt.tsx` paint, `types.ts`, `index.ts`; imported from `@hangul-route/design-system/components/WordArt`, not the package root, so an app start that shows no word picture does not load the glyph registry) over the pure `packages/design-system/src/word-art/` (`model.ts`, `render.ts`, `registry.ts`); the web contact sheet draws the same render list as an svg string (`glyphToSvgString`)

## What it is

A vocabulary word's picture: a square, vector, drawn from data on a `0 0 100 100` viewBox. Every colour is a design token, the outline is ink (`text.primary`), and there is no text, raster or emoji inside. The component has no copy and no business logic: callers pass the key and an already-localised label.

## Props

| Prop | Type | Notes |
|---|---|---|
| `artKey` | `string` | The part after `word:` (`food-apple`) |
| `size` | `number` | dp, square. Tested at 48 (dense quiz option), 64, 96 (`touchTarget.hero`), 160 (flashcard). A value that is not a positive number reads as 96 |
| `mono` | `boolean?` | Silhouette in `border.strong` (a word not met yet) |
| `accessibilityLabel` | `string` | The item's localised gloss. **Required unless `decorative`** (a type error otherwise) |
| `decorative` | `true?` | Hidden from assistive technology; takes no label |
| `testID` | `string?` | |

## States

| State | Looks like | Assistive technology |
|---|---|---|
| Picture | the glyph, painted in order | `image`, named by `accessibilityLabel` |
| Silhouette (`mono`) | every fill and stroke in `border.strong`; a highlight or shadow below 0.5 opacity is lifted to 0.5 so it does not vanish. The generated families are uniform in silhouette by design (one square, one frame, one head or figure): see the brief §3 | as Picture or Decorative |
| Decorative | as Picture | hidden: `aria-hidden` (the attribute react-native-web writes on the web), `accessibilityElementsHidden` (iOS), `importantForAccessibility="no-hide-descendants"` (Android) |
| Unlabelled (a picture that carries the meaning, given a blank label) | as Picture; in development builds a dashed `border.strong` frame, like StoryScene's | neither named nor hidden: the model sets `unlabelled`, so `PictureArt` (W-7) can show its text tile instead |
| Unknown key | **nothing** (`null`): the caller (`PictureArt`, F-QUEST-002 §3.11) shows its text tile. Never a blank square, never the generic card fallback. The key test makes this unreachable for shipped data | the caller's tile is named |

## Tokens (no literals)

| Part | Token |
|---|---|
| Fills and strokes | the tone paths in the glyph data: any `colors.*` leaf except `feedback.danger`, `feedback.dangerLight`, `surface.overlay`, `surface.inkScrim` and `rarity.*`; `colors.vocab.*` only inside WordArt |
| Outline | `text.primary`, 3 (main outline) and 2 (details); round caps and joins set by the renderer |
| Silhouette | `border.strong` |
| Background | none: the caller's tile (`surface.paper`, `border.subtle`) |

## Accessibility

- A picture option in a question is the only carrier of meaning: its label is the gloss, and only the gloss (never "red, like an apple", which would give away a Korean-word-to-picture answer).
- A flashcard already has a `KoreanText` line with the gloss: the picture there is `decorative`.
- Colour is never the only cue: colour swatches carry an object, and every option is named.
- No motion inside the art. Any pop-in or flip belongs to the caller and respects `useReducedMotion`.

## Performance

The render list is memoised per glyph and mode in `word-art/model.ts`, and the component is `React.memo`: a 12-tile topic grid draws 12 glyphs once. A glyph has at most 32 shapes (drawn) or 48 (generated).

## Checklist for this PR (W-1c)

Nothing is learner-visible: no screen renders `WordArt` until F-VOC-003 flips `flags.vocabTopicsEnabled` and W-7 binds `PictureArt`. The registry holds the six W-1b samples and the four props (`status: 'review'`); the generated families (colours, counts, body) are registered by batches W-3 and W-4.

Review sheet (rendered from the data with `glyphToSvgString`, checked by eye at 96 and 48 px and in silhouette): `w1c-review.png` in this folder. It shows the four props, the swatches whose objects are drawn so far, every count, every body part, and figure and sibling compositions.
