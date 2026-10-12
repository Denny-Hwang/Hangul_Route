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
- `body-mouth` and `body-tooth` side by side at 48 px: the mouth ring circles the whole open smile. The first tooth view put a small ring with its paper halo on the two teeth of the same zoomed head; the second review found that the halo covered the whole smile, so the face read as a pacifier in the mouth (against C5 and D1), and the two teeth could not be seen at 48 px. Fixed at the review: `body-tooth` is now drawn on its own, a paper molar with two roots, a shine line and a ground shadow, with no ring and no face; it reads as a tooth at 96, 48 and 32 px and in silhouette, and a generator test keeps the bottom of the smile clear of the ring and its halo in every ringed view. The mouth glyph still shows the teeth, so the pair `vocab:ip` / `vocab:i-tooth` stays in `VOCAB_EXCLUDED_PAIRS` (`apps/mobile/src/logic/vocab/excluded-pairs.ts`, F-VOC-004 §3.3 rule 1): the question builder never shows the two in one question, as answer and option or as two options; a builder test checks every listed pair both ways, in its topic and over the whole catalogue.
- `body-arm` against `body-hand` and `body-leg` against `body-foot`, side by side at 48 px: each pair rings the same limb of the same figure about 10 units apart (the arm ring on the upper arm, the hand ring on the hand; the leg ring on the shin, the foot ring on the shoe). At 96 px they read apart; at 48 px the difference is about 5 px and too close to rely on. The pairs `vocab:son` / `vocab:pal-arm` and `vocab:dari-leg` / `vocab:bal` go into `VOCAB_EXCLUDED_PAIRS` with the mouth and the tooth.
- Overlap in meaning (a picture that is a right answer for another word), checked for every new key: within the animals none; within the body the mouth and the tooth, the arm and the hand, and the leg and the foot, handled above. The head and the face differ by the view (whole figure against zoomed head) and by the ring.

## Checklist for batch C (W-5)

Registered, all `status: 'approved'`: the twelve family glyphs (composed from `figure()` and `siblings()`), the ten other school glyphs (the chair is from W-1b) and the seven other nature glyphs (the cloud is from W-1b, the flower from W-3), so the family, school and nature families are complete. The owner's per-batch review is replaced by a multi-agent review against the §3.12 checklist (owner decision, 2026-10-11, production level); this section is its record, for the owner to spot-check. W7 is raised to 160 KB raw / 48 KB gzipped in this batch (spec §8.1 (b)).

Review sheet: `w5-review.png` in this folder (96 px, 48 px, silhouette), all 32 keys of the three families. Result against the checklist:

- Recognisable at 48 px and in silhouette. People: one adult (mom, dad, grandma with her bun, grandpa with his cane), a pair (the four sibling words and dongsaeng), the swaddled baby, the row of four, and `me`. Objects each have their own outline (the school's tower and flag, the backpack's loop, the spiral notebook, the eraser block, the desk, the open scissors, the board on its legs, the pencil on the diagonal). Nature: the sky is a dome, the sun has rays, the star has five points, the tree has a crown, the rain is a cloud with drops and an umbrella, the snowflake has six arms, and the river winds between its banks.
- Every face smiles through `face()` (the figures, the sun, the star). No skin-tone fills: faces are paper, and hair and clothes carry the cues (C12).
- Sibling words follow the convention of §3.6.4, which matches Korean usage: the speaker is the smaller figure with the marker, and long or short hair tells the speaker's side. Eonni is the older long-haired figure with a long-haired speaker; nuna has a short-haired speaker; oppa is the older short-haired figure with a long-haired speaker; hyeong has a short-haired speaker. In dongsaeng the speaker is the larger figure, so the marker is over the larger one. These four are distinct data (C8). Second review: at 48 px the speaker's long hair (the hair behind the head, 2 units wider than the head at that size) and short hair were almost the same, so eonni read like nuna and oppa like hyeong. Fixed: long hair now also draws a lock down over each shoulder, over the shirt and under the head (`LONG_HAIR_LOCKS` in `generated/figure.ts`; compact figures leave it out, like the hands), so the speaker's side reads at 48 px on the re-rendered sheet; a generator test pins the locks below the shoulder line. The question builder already keeps eonni from nuna and oppa from hyeong by `senseGroup`; recognition on the flashcard and the word wall is what the locks fix. Open item 5 of the spec (a native reviewer confirms the hair convention) stays open.
- Clothes carry no gender cue (C12, review follow-up): mom wears `feedback.success` and dad `brand.primary`, and the two adults of `family-family` wear the same (the small long-haired child wears `brand.primary` too, so the row stays within 4 fill tones), so hair alone tells them apart, as the briefs say. The first draft dressed mom in pink and dad in blue, a gendered colour stereotype, and was changed. A test (`__tests__/family.test.ts`) keeps pink off mom, dad and the family row.
- `family-family` uses ink hair (`text.primary`, part of the ink) for all four people, so it stays within 4 fill tones. `family-me` points at a ring on its own chest; its shirt is redrawn with the arm bent in, so it never has three arms. `__tests__/family.test.ts` pins this: exactly figure()'s shirt and its hands path are dropped, one shirt and two paper hands are drawn, so a later change to `figure()` cannot silently leave two shirts or three arms.
- No text, digits or emoji (C10). The chalk marks on the two boards are small pictures (a sun with rays, two hills), never a lone circle or triangle, which could read as a letter or a jamo (ㅇ, ㅅ). The school has no clock and the notebook label is blank.
- Deviations from the one-line briefs, made for C9: `nature-snow` drops the pale-blue backdrop, because a disc behind the flake would turn the silhouette into a plain circle; the falling dots carry the pale blue instead. `nature-sky` puts its two clouds in a sky dome over a strip of hills, so the silhouette (a dome) differs from the cloud and from the sky-blue colour swatch.
- Overlap in meaning (a picture that is a right answer for another word): the rain is a cloud with drops and the sky draws two clouds, so each is paired with `vocab:gureum`, and the teacher stands at a board, so `vocab:seonsaengnim` is paired with `vocab:chilpan`, in `VOCAB_EXCLUDED_PAIRS` (`apps/mobile/src/logic/vocab/excluded-pairs.ts`, F-VOC-004 §3.3 rule 1); the builder never shows a pair in one question. The sibling pairs and `school-friend` are told apart by the speaker marker, which the friends do not have; eonni and nuna (one sense group, older sister) and oppa and hyeong (older brother) are already kept apart by `senseGroup`.
- Fixes made during review: three glyphs were just past C2 (77.5-79 units: the family row, the star's sparkles, the river), and were brought in. The snowflake's branches were turned to open outwards. The first chalk marks on the boards (a circle and a triangle) were replaced because they read as letters.

## Checklist for batch D (W-6)

Registered, all `status: 'approved'`: the eleven other travel glyphs (the bus is from W-1b), the eleven other sport glyphs (the football is from W-1b), the seven K-Culture glyphs and the twelve science glyphs, so every family reaches its plan. The owner's per-batch review is replaced by a multi-agent review against the §3.12 checklist (owner decision, 2026-10-11, production level), the K-Culture keys under the heritage accuracy bar; this section is its record, for the owner to spot-check. People in motion (taekwondo, running, skiing, the dance) are drawn from the parts in `src/word-art/glyphs/pose.ts`: capsule limbs, a paper head with a hair cap and the smile of `face()`, paper hands, so they match `figure()` (C12). W7 is raised to 160 KB raw / 48 KB gzipped in this batch as in W-5 (spec §8.1 (b)).

Review sheet: `w6-review.png` in this folder (96 px, 48 px, silhouette), all 43 keys of the four families. Result against the checklist:

- Recognisable at 48 px. In silhouette the vehicles, buildings, people and objects each have their own outline. The balls (football, baseball, basketball, volleyball, playground ball) are discs in silhouette, like the W-1b football; their seams and panels tell them apart in colour, and no two share markings. The playground ball is red with paper and blue stripes, and the volleyball has three swirling panels in yellow, blue and white.
- Every face smiles through `face()`: the people, and the robot's screen face.
- Tokens only. At most 4 fill tones, except `science-rainbow`: its six arc colours plus the white of its two clouds make 7, so it has `maxTones: 7` with a reason. The spec's "6" did not count the clouds, and §3.3 is amended. No text, digits or emoji: the passport emblem is a globe (a disc with one meridian and the equator), the ticket carries a star, the TV a play triangle, the map a dotted route and a pin.
- **K-Culture, against the heritage accuracy bar**:
  - `culture-hanok`: a giwa tile roof whose eaves lift at both ends (the curved cheoma line), a dark ridge (yongmaru), tile rows down the slope, a wooden frame with white walls, a lattice door (changhoji) and a stone base (gidan).
  - `culture-bibimbap`: a dark stone bowl (dolsot) seen from a little above, with namul in wedges round a fried egg (spinach green, carrot orange, bean-sprout yellow). There is no gochujang, which would be a fifth tone; the egg and the toppings in wedges are the recognisable cue.
  - `culture-tteokbokki`: short white cylinders of garae-tteok in a red-orange sauce, with spring onion and steam, in a bowl on a ground shadow like the other bowls (C6). It is told apart from `food-tteok` (white slices on a plate) by the sauce; since it still shows tteok, the two words are an excluded pair (below).
  - `culture-hangul`: three solid toy blocks (a bar, a cube, a ball) in three of the five traditional colours (obangsaek: yellow, blue, red). They allude to the shape-based design of Hangul without drawing a letter; every shape is a solid, never a stroke, so none reads as ㅇ, ㅁ or ㅡ.
  - `culture-dance`: a figure with raised arms and an open folding fan in each hand, as in the fan dance (buchaechum), with no costume beyond the brief (C12).
  - `culture-song` (beamed eighth notes and sound arcs) and `culture-drama` (a TV with a play triangle) are culture-neutral by design.
- Sport accuracy: the taekwondo figure wears a white dobok with a V collar and a black belt tied at the front, and makes a high side kick (eolgul height: the kicking foot is level with the head, the near fist up in guard). Both feet are bare paper feet, as taekwondo is practised barefoot. The baseball has two red stitched seams.
- Overlap in meaning (a picture that is a right answer for another word), checked for every key: the taxi is a car, the subway is a train seen from the front, the airport has a plane, the shadow shows a ball and the sun, space has stars, the rainbow stands on clouds, and tteokbokki shows tteok. Each pair (`jadongcha`/`taeksi`, `gicha`/`jihacheol`, `bihaenggi`/`gonghang`, `geurimja`/`gong-ball`, `geurimja`/`hae-sun`, `byeol`/`uju`, `gureum`/`mujigae`, `tteok`/`tteokbokki`) is in `VOCAB_EXCLUDED_PAIRS` (`apps/mobile/src/logic/vocab/excluded-pairs.ts`, F-VOC-004 §3.3 rule 1), so the builder never shows the two in one question. Not paired, because the second thing is not the subject a learner would name: the egg on the bibimbap, the planet in space against the earth, the bulb's rays against the sun.
- Fixes made in the review follow-up: the first passport emblem, a ring over a bar, read as the syllable 으 (C10, W6) and is now a globe; the taekwondo kick was at body height and is now at head height, with the standing foot bare like the kicking one; `culture-tteokbokki` had no ground shadow (C6) and now has one. Second review: `sport-tabletennis`, one red disc on a long handle with a ring inside, read as a magnifying glass at 48 px and in silhouette; it is now two paddles crossed at the handles (red rubber set in a wooden rim, a short handle that flares) with the white ball above them, the common sign for the sport, and its silhouette is an X of two discs. A test in `__tests__/batch-d-review.test.ts` pins the two paddles and the ball.
- Fixes made during review: the map pin was upside down. The volleyball's first panels read as a pie chart and were redrawn as swirls. Eight glyphs were past C2, mostly where a curve's control points overshot (the car's body is now a rounded polygon), and were brought in. A crack on the stone was replaced by a highlight.

