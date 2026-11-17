# WordArt: word pictures

**One picture per vocabulary word, drawn as data.** The picture is how a learner who cannot read Hangul yet understands a word (F-I18N-001 §3.5.4): it has to read at a glance, at 48 px, in colour and in silhouette.

Spec: `docs/specs/F-VOC-002-wordart-svg-system.md` (the source of truth; this brief says the same thing in plain words, plus a brief per word) · code: `packages/design-system/src/word-art/` (data, builders, generators, tests) and `src/components/WordArt/` (the renderer, `design/components/WordArt/spec.md`) · review surface: the contact sheet `/design-preview/word-art` (PR W-2).

---

## 1. Where the pictures appear

- Vocabulary topics (F-VOC-003): the topic grid, the word wall (a soft silhouette for a word not met yet), flashcards (160 px and larger).
- Questions (F-VOC-004, F-QUEST-002 Pic-Word Match and Listen & Pick): four picture options at 48 to 96 px.
- The same data is drawn by the app (react-native-svg) and by the web contact sheet (an svg string). There is one drawing per word, never a second copy.

The audience is anyone learning Hangul from zero, at any age. The art is friendly and geometric: never babyish, never "for kids", never a mascot sticker sheet.

## 2. Style contract

| Rule | In plain words |
|---|---|
| Grid | A 100 x 100 square. Shapes stay inside it (strokes may touch the edge, nothing is cut off). |
| Shapes | Circles, ellipses, rounded rectangles and smooth paths written with the builders (`circle`, `blob`, `curve`, `leaf`, `poly`, `arc`, `drop`, `star`, ...). No hand-typed path strings unless the builders cannot say it. |
| Outline | `text.primary` ("ink"): 3 for the main silhouette, 2 for details. Never thinner than 2. Round caps and joins (the renderer sets them). |
| Colour | Design tokens only, named by path (`vocab.red`, `hoya.fur`). At most **4 fill colours** per picture, not counting the ink and the ground shadow. Ink-filled small details (eyes, pupils, wheels) are part of the ink. |
| Opacity | For the ground shadow (0.18) and highlights (0.55) only. Never to mix a new colour by layering. |
| Size and place | The subject covers 60 to 70 % of the square, centred. A waiver needs a written reason (the colour swatches have one: the square fills the frame). |
| Standing objects | Sit on `groundShadow()`. |
| Count | At most 32 shapes for a drawn picture, 48 for a generated one. |
| Faces | Every face smiles, through `face()` (it has no frown). A profile (a bird or a fish seen from the side) shows one eye; its smile is the mouth line, turned up where the beak or mouth meets the head (see `prop-crow`). |
| People | Neutral geometric figures: a paper face with an ink outline, never a skin-tone fill; hair and clothes carry the cues; no likeness of a real person; no costume beyond the brief. |
| No text | No Hangul, no Latin letters, no digits (counts are dots), no emoji. Signs, boards, covers and screens use marks and shapes, never characters. |
| No effects | No gradients, filters, clip paths, masks, images or `<use>`: the data model cannot express them, and the tests re-check. |
| Readable | Recognisable at 48 px and in silhouette. A picture that is only identifiable by its colour, or by a detail thinner than 3 units, goes back for rework. |

### [PX] The same rules now hold for every picture a question can show

`docs/specs/AMENDMENTS-PICTURES-2026-11.md` section 3 (owner request of 2026-11-17) takes the contract above as the standard for card art and hidden-heritage things too:

- **R1 Ink outline.** The subject's outline is `text.primary` and at least 3 % of the grid's width (3 units on a 100 grid, 6 on a 200 grid); inner detail lines are at least 2 % (2 on 100, 4 on 200). Nothing the picture needs is drawn thinner.
- **R2 The subject fills the tile.** 60 to 70 % of the frame, one subject, at most two supporting things.
- **R3 Told by shape.** A picture that is told from another one of its set only by colour is rejected (WordArt C9, now for cards too). Sets: a vocabulary topic, the cards of one stage and theme, and the look-alike groups of the amendment's section 4 (the bowls, the moons, the bows).
- **R4 Real colours for real things.** Card art and hidden-heritage things may use the `colors.vocab.*` tones, as WordArt does (kimchi is red). `feedback.danger` stays out of every picture. Scene settings and story props keep their own palette rule.
- **R5 No picture names itself in print** where it can be a question's picture. A card that shows its own word as text is never used as a question picture (a test holds this).
- **R6 A word's picture is a glyph.** A vocabulary word no longer borrows a card: each has its own `word:` glyph. The cards stay as collectibles.

For WordArt, R1 to R3 restate the table above (outline, size, "readable"); R4 opens the `colors.vocab` tones to card art and hidden-heritage art (the source scan allows those two places and nothing else); R6 ends the card reuse of section 8.

### The one deliberate difference from the Heritage card art

The pictures share the card art's language (`heritage-card-art.md` §3: geometric minhwa, rounded primitives, a 3-unit outline, a centred subject, smiling faces), and, since **[PX]** R4, the content colours too: the card brief used to allow **no red except dancheong orange**, while WordArt draws content reds, blacks and pinks from the `colors.vocab` group. That group is used **only inside WordArt, the card art and the hidden-heritage scene art** (a source scan test enforces it): `vocab.red` is the colour of an apple, never a feedback colour, and it never replaces `feedback.nudge` on a learner's miss.

Two differences remain, and they follow from the format: a picture has no background (the caller's tile is the background), and the lines are clean vector lines (no wobble or paper texture), so they stay crisp at 32 px.

### Colour is never the only cue

About 1 in 12 men cannot tell some colour pairs apart (red and brown, orange and green, blue and purple, pink and gray). So every colour swatch carries an object, every picture option has a spoken name, and a question never offers two colours that collapse under one colour-vision deficiency as the only difference (`COLOR_CONFUSION_PAIRS`, read by F-VOC-004).

## 3. Generated families

These pictures are built by functions from data, so a family stays consistent and costs no drawing time. The batches register them (colours and counts in W-3, body in W-4).

In silhouette a generated family is deliberately uniform: every colour swatch is the same square, every count the same frame, every body part the same head or figure (only a ring halo may show past the edge). A colour or a number has no shape of its own to hint at, so on the word wall these tiles all read as "not met yet"; the silhouette check of the review applies to hand-drawn pictures (F-VOC-002 W8).

### Colour swatches (`color-*`, 12)

A rounded square in the colour (margin 6, corner 14, the 3-unit ink outline), with an **object** as a sticker in the lower right: the object's own picture at 55 %, standing on a paper halo (the outline of every shape drawn again behind it with a wide paper stroke, as one path), so a red apple still reads on the red square. Because the halo is one shape, a swatch is the object's shapes plus two, and any object within the 32-shape limit makes a swatch within the 48-shape limit. The object's ground shadow is dropped (the halo does its job). The square fills the frame, so every swatch carries the size waiver; with the object's colours a swatch may use up to 5 fill colours.

| Colour | Object | Colour | Object |
|---|---|---|---|
| red | `food-apple` | sky blue | `nature-cloud` |
| orange | `prop-tangerine` | brown | `animal-bear` |
| yellow | `food-banana` | gray | `animal-elephant` |
| green | `prop-leaf` | white | `food-milk` |
| blue | `food-water` | black | `prop-crow` |
| purple | `prop-grapes` | pink | `nature-flower` |

An object must be recognisable without its colour (outline and shape), because under the confusion pairs the object, not the fill, tells red from brown.

### Counts (`count-0` .. `count-10`, `count-20`, 12)

A ten-frame: a paper frame with the ink outline, two rows of five cells outlined in `border.strong`, and one dot per unit. Dots fill left to right, top row first; the first five are `brand.primary`, the next five `brand.secondary`, so 7 reads as "five and two". 20 is two full frames; 0 is one empty frame. No numerals.

### Body parts (`body-*`, 12)

A friendly neutral figure (paper face and limbs, a `hoya.fur` shirt, short hair, smiling; not the Hoya component) with a highlight ring on the part: a 3-unit `brand.secondary` circle on a paper halo that shows only outside the ring, so the part inside stays visible.

- Zoomed head: eye, nose, mouth, ear, tooth, face. The head has ears, a hair cap, eyes, cheeks, a nose and an open smile with the two upper front teeth.
- Whole figure: head, hand, arm, leg, foot, belly.

The ring positions are data (`BODY_ANCHORS`), worked out from the same geometry the figure is drawn from. Mouth and tooth share the open smile: the mouth ring circles the whole mouth, the tooth ring sits tight on the teeth. Only the ring tells them apart, so the W-4 review checks the pair side by side at 48 px, and `body-mouth` and `body-tooth` are never offered as options in the same question (F-VOC-002 §3.6.3).

### People (`figure()`, for the Family batch)

`figure({ height, hair, clothes, accessory?, x?, ground?, hairTone?, compact? })` draws one standing figure, `height` units from the ground to the top of the head (20 to 80):

- `hair`: `short`, `long` (falls to the shoulders), `bun`, `grey` (short, `vocab.gray`), `none`. `hairTone` recolours long, short and bun hair (the grandmother's bun is gray).
- `accessory`: `glasses`, `cane` (an ink cane in the right hand), `blanket` (a swaddled baby: the blanket wraps the body and its hood frames the face).
- `compact` drops the hands and shoes, so four figures fit the 32-shape limit (`family-family`).
- `siblings(older, speaker)` draws the four sibling words: the older sibling on the left, the speaker smaller on the right with the **marker** (a small `brand.secondary` dot above the head). Long or short hair tells the speaker's side, the convention the card back names.

## 4. Props

Helper pictures drawn only so a colour swatch has an object. They are not vocabulary words.

| Key | Picture |
|---|---|
| `prop-tangerine` | A flattened round orange fruit, a green star calyx, a small leaf on a short stem, a few peel dots, a highlight. Flatter than the apple, so the two never look alike. |
| `prop-leaf` | One broad green leaf on a short stem, an ink midrib and three pairs of side veins, a soft highlight. |
| `prop-grapes` | A purple bunch narrowing to one grape (4, 3, 2, 1), a stem and a leaf, three highlights. |
| `prop-crow` | A black bird in profile on a brown branch: a fanned tail, a wing edged in gray, a white eye, an orange pointed beak whose mouth line turns up. |

## 5. Per-glyph recipe

1. Sketch on the 100 x 100 grid: the subject's most recognisable silhouette (side view for an animal's body, front view for a face, three-quarter for an object).
2. Write the glyph with builders in its family file: the silhouette `blob` or `poly` in the main colour first, at most three detail shapes, the outline pass (3) and details (2), then `face()` and `groundShadow()`.
3. Run `corepack pnpm --filter @hangul-route/design-system test` (colour, grammar, size, count and distinctness tests) and open `/design-preview/word-art?topic=<family>`.
4. Set `status: 'review'` in the registry meta. The owner marks `approved`, or comments on the PR.

## 6. Review checklist (the owner, per batch, recorded in the PR)

- Recognisable at 48 px.
- Recognisable in silhouette.
- Every face smiles.
- Colours from tokens, no more than 4 (or the allowance written in the meta).
- Matches its brief below.
- Culturally accurate (the K-Culture keys especially).
- No text, digits or emoji.
- Neutral people.
- Fits next to the other words of its topic, so no option in a four-picture question looks "different".

## 7. Per-word briefs

`<key>` is written without `word:`. "Ink" is `text.primary`. The brief says what to draw; the author chooses the coordinates.

| Family | Key: brief |
|---|---|
| food (12) | `food-apple`: red apple, leaf, highlight · `food-banana`: curved yellow banana, brown tips · `food-milk`: carton, blue band, drop · `food-bread`: golden loaf, three slashes · `food-ramyeon`: bowl, wavy noodles, steam, chopsticks · `food-water`: glass with a blue drop, highlight · `food-egg`: **[PX]** a pale whole egg and, beside it, one cracked into a fried egg (white with a round yolk) · `food-strawberry`: red heart-shaped berry, green cap, seed dots · `food-tteok`: **[PX]** a cut slab of layered rainbow rice cake (white, pink, yellow and green layers) on a plate · **[PX]** `food-rice`: a tall bowl heaped with white rice in a high dome, grain ticks, steam · **[PX]** `food-kimchi`: half a napa cabbage lying on a plate, **not a bowl**: white ribs fanning from the white stem end, leaves coated red with darker flecks, green at the frilly leaf tips · **[PX]** `food-kimbap`: the roll above, its cut end showing the seaweed ring, the white rice and the yellow, orange and green fillings; **[FU]** two big slices stand apart below it, so the outline is a roll over two rounds, not one block |
| animal (12) | `animal-cat`: orange cat face, ears, whiskers · `animal-puppy`: tan puppy face, floppy ears, tongue out · `animal-rabbit`: white face, long ears with pink inside · `animal-bear`: brown bear face, round ears · `animal-bird`: small round bird on a branch, blue · `animal-fish`: blue fish, tail, fin, bubbles · `animal-duck`: yellow duck on blue wave · `animal-fox`: orange fox face, pointed ears, white cheeks · `animal-monkey`: brown monkey face, cream face patch · `animal-elephant`: gray face, trunk, ears · `animal-butterfly`: pink-purple wings, antennae · **[PX]** `animal-tiger`: tiger face in Hoya's gold, round ears, ink stripes on the brow and cheeks, pale muzzle (Hoya's colours, not Hoya's figure) |
| family (12) | `family-mom`: adult figure, long hair · `family-dad`: adult figure, short hair · `family-grandma`: adult figure, hair bun in gray · `family-grandpa`: adult figure, gray short hair, cane · `family-eonni`: older long-haired figure + smaller long-haired speaker (marker) · `family-nuna`: older long-haired figure + smaller short-haired speaker · `family-oppa`: older short-haired figure + smaller long-haired speaker · `family-hyeong`: older short-haired figure + smaller short-haired speaker · `family-dongsaeng`: larger figure + small figure (the speaker is the larger) · `family-baby`: infant in a blanket · `family-family`: four figures in a row · `family-me`: one figure with a ring on the chest, a hand pointing to it |
| school (12) | `school-school`: building, flag, door, no clock · `school-teacher`: adult figure beside a board, pointer · `school-friend`: two figures holding hands · `school-pencil`: yellow pencil, pink eraser end · `school-bag`: backpack, pocket, straps · `school-notebook`: spiral notebook, plain cover · `school-eraser`: pink block eraser, wrapper band · `school-desk`: wooden desk, drawer · `school-chair`: chair · `school-scissors`: scissors, two handles · `school-board`: green board, chalk marks as shapes, tray · **[PX]** `school-book`: an open book, two white pages over a red cover, rows of marks (no letters), a ribbon bookmark |
| nature (12) | `nature-sky`: sky-blue field, two clouds, no sun · `nature-sun`: yellow sun, rays, smile · `nature-star`: yellow star, smile, sparkles · `nature-tree`: green round crown, brown trunk · `nature-flower`: pink flower on a stem · `nature-rain`: gray-blue cloud, drops, small umbrella · `nature-snow`: snowflake and falling dots on pale blue · `nature-river`: blue winding stream, green banks · `nature-cloud`: **[PX]** a big cloud tinted light blue, a white highlight on top and a deeper underside (never white on white, no sky behind it: that is `nature-sky`) · **[PX]** `nature-mountain`: three green peaks, the tall one with a snow cap, ridge lines · **[PX]** `nature-sea`: waves are the subject, a small sun over the water, **no boat**; **[FU]** one big wave curling over at its crest above a band of water with foam (three flat bands made a block in silhouette) · **[PX]** `nature-moon`: a crescent moon, two stars, a small night cloud (never a disc: that is the sun, or the harvest moon of `culture-chuseok`) |
| travel (12) | `travel-airplane`: airplane · `travel-train`: train front, windows, headlight · `travel-bus`: bus · `travel-taxi`: yellow car, roof sign as a blank rounded rectangle · `travel-subway`: train front in an arched tunnel · `travel-car`: blue car, wheels · `travel-boat`: sailboat on a blue wave · `travel-map`: folded map, dotted route, pin · `travel-passport`: blue booklet, circle emblem, no letters · `travel-ticket`: ticket with a notch and a dashed line · `travel-airport`: terminal with a tower and a small plane · `travel-hotel`: tall building, awning, no bed |
| sport (12) | `sport-soccer`: football · `sport-baseball`: white ball, red stitches · `sport-basketball`: orange ball, black lines · `sport-volleyball`: white ball, blue and yellow panels · `sport-tabletennis`: paddle and white ball · `sport-swimming`: swimmer's head, goggles, waves · `sport-taekwondo`: figure in a white uniform, belt, high kick · `sport-running`: figure running, shoes · `sport-jumprope`: figure mid-jump, rope arc · `sport-bicycle`: bicycle, side view · `sport-skiing`: skier, skis, poles · `sport-ball`: striped rubber playground ball |
| culture (12) | `culture-hangul`: abstract blocks of a circle, a square and a bar (alluding to jamo shapes, **no letters**) · `culture-hanok`: tiled curved roof, wooden pillars, door · `culture-bibimbap`: stone bowl, colourful toppings, egg · `culture-tteokbokki`: bowl, red-orange sauce, white rice-cake pieces · `culture-song`: two music notes and sound arcs · `culture-dance`: figure with raised arms and a fan or ribbon · `culture-drama`: TV screen with a play triangle · **[PX]** `culture-hanbok`: a hanbok laid flat, yellow jeogori with a white collar and the long goreum tie, a full red skirt · **[PX]** `culture-seollal`: a child in hanbok in the deep New Year bow, head lowered onto the hands on the floor; **[FU]** the body folded over the knees and drawn larger, the floating lucky pouch left out, so it reads at 48 px · **[PX]** `culture-chuseok`: a plate of songpyeon (half-moon rice cakes) under the big full moon · **[PX]** `culture-yutnori`: the round yut board with its 29 stations (ring and cross) and the four half-round sticks, three flat faces up · **[PX]** `culture-gayageum`: the long zither at an angle, bold strings each over its own bridge (anjok) in a slanting row, the tail cords; **[FU]** three strings 8 units apart and bigger bridges (four merged at 54 px) |
| science (12) | `science-fire`: flame in three colours · `science-ice`: light-blue ice cube, shine · `science-stone`: gray rounded stone · `science-magnet`: horseshoe, red and blue ends · `science-earth`: blue globe, green continents · `science-space`: dark sky, stars, ringed planet · `science-robot`: boxy robot, antenna, a smiling screen face · `science-seed`: **[PX]** seeds are the subject; **[FU]** four pointed teardrop seeds in golden tan (never round and brown: that read as a chestnut), the big one split at its tip where a stem rises with two leaves · `science-rainbow`: six arcs (allowance of 6 colours), two clouds · `science-shadow`: **[PX]** a person standing in the sun and the long gray shadow they cast · `science-wind`: three swirls and a leaf · `science-light`: bulb, glow, rays |
| prop (4) | `prop-tangerine` · `prop-leaf` · `prop-grapes` · `prop-crow` (§4) |

## 8. Heritage card art reused for no word [PX]

Until 2026-11 thirteen words used a heritage card as their picture (`card:<id>`). The picture review of 2026-11-17 found that those cards did not read at 64 px beside the glyphs, so each of the 13 has its own glyph now, and **a word's picture is always a glyph** (rule R6 of `docs/specs/AMENDMENTS-PICTURES-2026-11.md`, row PX-1). The cards stay as collectibles.

| Word | Was | Is |
|---|---|---|
| 밥 (bap, cooked rice) | `card:rice` | `word:food-rice` |
| 김치 (gimchi, kimchi) | `card:kimchi` | `word:food-kimchi` |
| 김밥 (gimbap, seaweed rice roll) | `card:kimbap` | `word:food-kimbap` |
| 호랑이 (horangi, tiger) | `card:tiger` | `word:animal-tiger` |
| 책 (chaek, book) | `card:book` | `word:school-book` |
| 산 (san, mountain) | `card:mountain` | `word:nature-mountain` |
| 바다 (bada, sea) | `card:sea` | `word:nature-sea` |
| 달 (dal, moon) | `card:moon` | `word:nature-moon` |
| 한복 (hanbok) | `card:hanbok` | `word:culture-hanbok` |
| 설날 (seollal, Lunar New Year) | `card:seollal` | `word:culture-seollal` |
| 추석 (chuseok, harvest festival) | `card:chuseok` | `word:culture-chuseok` |
| 윷놀이 (yunnori, yut game) | `card:yutnori` | `word:culture-yutnori` |
| 가야금 (gayageum) | `card:gayageum` | `word:culture-gayageum` |

The contact sheet's "Card-art reuses" section now says "none". A `card:` visual in a vocabulary topic fails the tests (`vocab-keys.test.ts`, `registry-px1.test.ts`).

## 9. Prompt: author one glyph with Claude Code

```prompt
Add the WordArt glyph `<key>` to packages/design-system/src/word-art/glyphs/<family>.ts
for Hangul Route (F-VOC-002). Brief: <the brief from design/brief/illustrations/word-art.md §7>.

Follow design/brief/illustrations/word-art.md §2 exactly: 100 x 100 grid, builders only
(circle, ellipse, rect, poly, blob, curve, leaf, arc, line, drop, star, groundShadow, face),
token paths only (no hex), ink outline 3 (main outline) and 2 (details), at most 4 fill colours,
subject 60-70 % of the frame and centred, at most 32 shapes, every face smiles through face(),
no text, digits or emoji. Add `status: 'review'` to the registry meta.

Run `corepack pnpm --filter @hangul-route/design-system test`, then render the glyph at 160,
96, 64, 48 and 32 px and in silhouette (glyphToSvgString with mono: 'border.strong') and
check by eye that it reads at 48 px and in silhouette before opening the PR.
```
