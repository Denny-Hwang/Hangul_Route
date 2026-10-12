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

## Checklist for batch D (W-6)

Registered, all `status: 'approved'`: the eleven other travel glyphs (the bus is from W-1b), the eleven other sport glyphs (the football is from W-1b), the seven K-Culture glyphs and the twelve science glyphs, so every family reaches its plan. The owner's per-batch review is replaced by a multi-agent review against the §3.12 checklist (owner decision, 2026-10-11, production level), the K-Culture keys under the heritage accuracy bar; this section is its record, for the owner to spot-check. People in motion (taekwondo, running, skiing, the dance) are drawn from the parts in `src/word-art/glyphs/pose.ts`: capsule limbs, a paper head with a hair cap and the smile of `face()`, paper hands, so they match `figure()` (C12). W7 is raised to 160 KB raw / 48 KB gzipped in this batch as in W-5 (spec §8.1 (b)).

Review sheet: `w6-review.png` in this folder (96 px, 48 px, silhouette), all 43 keys of the four families. Result against the checklist:

- Recognisable at 48 px. In silhouette the vehicles, buildings, people and objects each have their own outline. The balls (football, baseball, basketball, volleyball, playground ball) are discs in silhouette, like the W-1b football; their seams and panels tell them apart in colour, and no two share markings. The playground ball is red with paper and blue stripes, and the volleyball has three swirling panels in yellow, blue and white.
- Every face smiles through `face()`: the people, and the robot's screen face.
- Tokens only. At most 4 fill tones, except `science-rainbow`: its six arc colours plus the white of its two clouds make 7, so it has `maxTones: 7` with a reason. The spec's "6" did not count the clouds, and §3.3 is amended. No text, digits or emoji: the passport emblem is a ring and a bar, the ticket carries a star, the TV a play triangle, the map a dotted route and a pin.
- **K-Culture, against the heritage accuracy bar**:
  - `culture-hanok`: a giwa tile roof whose eaves lift at both ends (the curved cheoma line), a dark ridge (yongmaru), tile rows down the slope, a wooden frame with white walls, a lattice door (changhoji) and a stone base (gidan).
  - `culture-bibimbap`: a dark stone bowl (dolsot) seen from a little above, with namul in wedges round a fried egg (spinach green, carrot orange, bean-sprout yellow). There is no gochujang, which would be a fifth tone; the egg and the toppings in wedges are the recognisable cue.
  - `culture-tteokbokki`: short white cylinders of garae-tteok in a red-orange sauce, with spring onion and steam. It is told apart from `food-tteok` (white slices on a plate) by the sauce.
  - `culture-hangul`: three solid toy blocks (a bar, a cube, a ball) in three of the five traditional colours (obangsaek: yellow, blue, red). They allude to the shape-based design of Hangul without drawing a letter; every shape is a solid, never a stroke, so none reads as ㅇ, ㅁ or ㅡ.
  - `culture-dance`: a figure with raised arms and an open folding fan in each hand, as in the fan dance (buchaechum), with no costume beyond the brief (C12).
  - `culture-song` (beamed eighth notes and sound arcs) and `culture-drama` (a TV with a play triangle) are culture-neutral by design.
- Sport accuracy: the taekwondo figure wears a white dobok with a V collar and a black belt tied at the front, and makes a high side kick. The baseball has two red stitched seams.
- Fixes made during review: the map pin was upside down. The volleyball's first panels read as a pie chart and were redrawn as swirls. Eight glyphs were past C2, mostly where a curve's control points overshot (the car's body is now a rounded polygon), and were brought in. A crack on the stone was replaced by a highlight.

