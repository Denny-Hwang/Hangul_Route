# WordArt (component spec v1)

Spec: `docs/specs/F-VOC-002-wordart-svg-system.md` §3.7 (renderer, accessibility, modes) and PR W-1c in §6 · art brief: `design/brief/illustrations/word-art.md` · the screens that show it: `design/wireframes/vocab/topics.md`, `flashcards.md`, `speed-round.md` (the picture is the content of those screens, it has no wireframe of its own)
Code: `packages/design-system/src/components/WordArt/` (`WordArt.tsx` paint, `types.ts`, `index.ts`; imported by the app from the package root, with `WORD_ART_KEYS`, because Metro does not read package `exports` (amended at W-7; the `components/WordArt` subpath stays for tools that do)) over the pure `packages/design-system/src/word-art/` (`model.ts`, `render.ts`, `registry.ts`); the web contact sheet draws the same render list as an svg string (`glyphToSvgString`)

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
| Background | none: the caller's tile (`surface.paper`, `border.subtle`, padding `spacing.xs`, border `borderWidth.thin`, radius `radii.lg`), the same tile `PictureArt` draws round card art (W-7); the art in it is never below 48 dp, so at a smaller requested side the tile grows outward |

## Accessibility

- A picture option in a question is the only carrier of meaning: its label is the gloss, and only the gloss (never "red, like an apple", which would give away a Korean-word-to-picture answer).
- A flashcard already has a `KoreanText` line with the gloss: the picture there is `decorative`.
- Colour is never the only cue: colour swatches carry an object, and every option is named.
- No motion inside the art. Any pop-in or flip belongs to the caller and respects `useReducedMotion`.

## Performance

The render list is memoised per glyph and mode in `word-art/model.ts`, and the component is `React.memo`: a 12-tile topic grid draws 12 glyphs once. A glyph has at most 32 shapes (drawn) or 48 (generated).

## Checklist for this PR (W-1c)

At W-1c nothing was learner-visible: the registry held the six W-1b samples and the four props (`status: 'review'`). Since then W-7 has bound `PictureArt`, so a `word:` ref with a registered glyph draws it in every picture game; the vocabulary topic screens still wait for F-VOC-003's `flags.vocabTopicsEnabled`. The colours and counts are registered by W-3 (below) and the body family by W-4.

Review sheet (rendered from the data with `glyphToSvgString`, checked by eye at 96 and 48 px and in silhouette): `w1c-review.png` in this folder. It shows the four props, the swatches whose objects are drawn so far, every count, every body part, and figure and sibling compositions.

## Checklist for batch A (W-3)

Registered, all `status: 'review'`: the eight other food glyphs, the three colour-swatch objects of later families (`animal-bear`, `animal-elephant`, `nature-flower`; `nature-cloud` is from W-1b), the twelve colour swatches (from `colorGlyphs`, each with the C2 size waiver and its reason; no swatch needs a fifth fill tone, so none has `maxTones`) and the twelve counts (from the ten-frame generator).

Review sheet: `w3-review.png` in this folder, rendered from the data with `glyphToSvgString` at 96 and 48 px and in silhouette. It shows the nine food glyphs, the four swatch objects, the twelve swatches and the twelve counts. Result against the §3.12 review checklist:

- Recognisable at 48 px and in silhouette (hand glyphs). A swatch is a square and a ten-frame a bar in silhouette by design; the object sticker and the dot count carry them.
- Faces smile (bear, elephant). Tokens only, at most 4 fill tones on every glyph, no text, digits or emoji.
- Standing objects sit on a ground shadow. One fix made during review: the banana floated above its shadow (shadow moved from y 82 to 78).
- Swatch stickers read on their swatch thanks to the paper halo (the crow on black, the milk on white).

Open for the owner's review:

- Counts at the 48 dp minimum: the ten-frame is 70 by 28 units, so at 48 dp the frame is about 13 px tall and a dot has a radius of about 2.2 px; 7 against 8 and 9 against 10 are hard to tell apart. Picture games draw at hero size today. If a count is ever drawn below about 64 dp, either raise the minimum size for the count family in `PictureArt` or scale the frame up to the 88-unit width as the swatches do (with a C2 waiver), and add a 48 dp check of `count-7` against `count-8` to the sheet.
- Colour words and their sticker objects (red and the apple, brown and the bear, and so on) are look-alike pictures. Before a question builder runs over a cross-topic universe, those pairs must be excluded as distractors of each other (derived from `COLOR_SWATCHES[*].object`).

## Checklist for batch C (W-5)

Registered, all `status: 'approved'`: the twelve family glyphs (composed from `figure()` and `siblings()`), the ten other school glyphs (the chair is from W-1b) and the seven other nature glyphs (the cloud is from W-1b, the flower from W-3), so the family, school and nature families are complete. The owner's per-batch review is replaced by a multi-agent review against the §3.12 checklist (owner decision, 2026-10-11, production level); this section is its record, for the owner to spot-check. W7 is raised to 160 KB raw / 48 KB gzipped in this batch (spec §8.1 (b)).

Review sheet: `w5-review.png` in this folder (96 px, 48 px, silhouette), all 32 keys of the three families. Result against the checklist:

- Recognisable at 48 px and in silhouette. People: one adult (mom, dad, grandma with her bun, grandpa with his cane), a pair (the four sibling words and dongsaeng), the swaddled baby, the row of four, and `me`. Objects each have their own outline (the school's tower and flag, the backpack's loop, the spiral notebook, the eraser block, the desk, the open scissors, the board on its legs, the pencil on the diagonal). Nature: the sky is a dome, the sun has rays, the star has five points, the tree has a crown, the rain is a cloud with drops and an umbrella, the snowflake has six arms, and the river winds between its banks.
- Every face smiles through `face()` (the figures, the sun, the star). No skin-tone fills: faces are paper, and hair and clothes carry the cues (C12).
- Sibling words follow the convention of §3.6.4, which matches Korean usage: the speaker is the smaller figure with the marker, and long or short hair tells the speaker's side. Eonni is the older long-haired figure with a long-haired speaker; nuna has a short-haired speaker; oppa is the older short-haired figure with a long-haired speaker; hyeong has a short-haired speaker. In dongsaeng the speaker is the larger figure, so the marker is over the larger one. These four are distinct data (C8).
- `family-family` uses ink hair (`text.primary`, part of the ink) for all four people, so it stays within 4 fill tones. `family-me` points at a ring on its own chest; its shirt is redrawn with the arm bent in, so it never has three arms.
- No text, digits or emoji (C10). The chalk marks on the two boards are small pictures (a sun with rays, two hills), never a lone circle or triangle, which could read as a letter or a jamo (ㅇ, ㅅ). The school has no clock and the notebook label is blank.
- Deviations from the one-line briefs, made for C9: `nature-snow` drops the pale-blue backdrop, because a disc behind the flake would turn the silhouette into a plain circle; the falling dots carry the pale blue instead. `nature-sky` puts its two clouds in a sky dome over a strip of hills, so the silhouette (a dome) differs from the cloud and from the sky-blue colour swatch.
- Fixes made during review: three glyphs were just past C2 (77.5-79 units: the family row, the star's sparkles, the river), and were brought in. The snowflake's branches were turned to open outwards. The first chalk marks on the boards (a circle and a triangle) were replaced because they read as letters.

