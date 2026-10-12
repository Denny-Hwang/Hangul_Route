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

## Checklist for batch B (W-4)

Registered, all `status: 'approved'`: the eight other animal glyphs (`animal-puppy`, `animal-rabbit`, `animal-bird`, `animal-fish`, `animal-duck`, `animal-fox`, `animal-monkey`, `animal-butterfly`; the cat is from W-1b, the bear and the elephant from W-3, so the animal family is complete) and the twelve body parts (from the `bodyPart` generator of W-1c). The owner's per-batch review is replaced by a multi-agent review against the §3.12 checklist (owner decision, 2026-10-11, production level); this section is its record, for the owner to spot-check.

Review sheet: `w4-review.png` in this folder, rendered from the data with `glyphToSvgString` at 96 and 48 px and in silhouette, all eleven animals and all twelve body parts. Result against the checklist:

- Recognisable at 48 px and in silhouette: every animal has its own outline in silhouette (the rabbit's ears, the fox's pointed ears and chin, the monkey's side ears and tuft, the puppy's hanging ears, the bird on its branch, the fish with its tail and bubbles, the duck on its wave, the butterfly's four wings), so no two animals of the topic share a silhouette. The body parts are uniform in silhouette by design (W8); the ring tells them apart in colour.
- Every face smiles through `face()`; the bird, the fish and the duck are profiles with one eye and the mouth line turned up (C5).
- Tokens only, at most 4 fill tones (puppy: `stage.stage2`, `vocab.brown`, `feedback.nudgeLight`, `hoya.cheek`; bird: `vocab.blue`, `vocab.skyBlue`, `hoya.fur`, `vocab.brown`), no text, digits or emoji, 8 to 16 shapes per animal.
- Topic fit: the faces (cat, puppy, rabbit, bear, fox, monkey, elephant) share one head size and the ink outline; the bodies (bird, fish, duck, butterfly) fill the same box, so a four-picture question has no "different" option. The cat and the fox, both orange faces with pointed ears, differ by the whiskers and round head against the fox's white cheeks, dark ear tips and pointed chin, also in silhouette. The bird is round and blue; the crow (a colour-swatch prop) is black with a long tail, and props are never options.
- Fixes made during review: the monkey's first face patch carried a second, open mouth under the `face()` smile (removed) and was 84 units wide, past C2 (ears and head brought in to 74).
- `body-mouth` and `body-tooth` side by side at 48 px: the mouth ring circles the whole open smile, the tooth ring sits tight on the two teeth; they differ only by the ring, as §3.6.3 records, so F-VOC-004 never offers the two in one question.

