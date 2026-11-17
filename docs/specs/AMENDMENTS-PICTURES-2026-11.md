Status: ready; rows PX-0 to PX-5 open

# Amendment: pictures a learner can name at a glance

> **Owner request of 2026-11-17 (in chat, translated):** "Improve the pictures. Some are abstract and easy to understand; some are so abstract they are hard to recognise, kimchi for example. Review them all, write the improvement plan first, then do the work, step by step."
>
> Amends `F-VOC-002-wordart-svg-system.md` (sections 3.5 and 3.11), `design/brief/illustrations/heritage-card-art.md`, `design/brief/illustrations/word-art.md`, `docs/design/illustration-style.md` and `docs/design/scene-art-style.md`. Every change is marked **[PX]** where it lands.
> The review behind this plan: `docs/design/picture-review-2026-11/triage.md` (every picture with a score, a verdict and what to change).

## 1. How the review was done

Every learner-facing picture was drawn by the real components and looked at on contact sheets at the sizes a question shows it (96, 64 and 54 px, plus the full size): 138 vocabulary glyphs, 60 heritage cards, 5 hidden-heritage scenes with their 36 things, 12 story settings, the 40 most-used story props of about 150, 17 realia dressings, Hoya's 5 poses and the route stickers.

Each picture was scored 0 to 2 on five questions (10 in all):

1. Does the silhouette alone name it at 64 px?
2. Does it have one feature a learner would name?
3. Can it be told from the other pictures of its set?
4. Is it named by more than its colour?
5. Is it right about the thing (kimchi is napa cabbage with red seasoning; a gayageum has a bridge under every string)?

8 or more: keep. 5 to 7: tweak (add the missing cue). 4 or less: redraw.

Limits of this review: one reviewer's eye, no learner test; cultural detail is from general knowledge, not checked against a source; story props past the 40 most used were not looked at.

## 2. What was found

| Family | Pictures | Keep | Tweak | Redraw |
|---|---|---|---|---|
| Vocabulary glyphs (WordArt) | 138 | 133 | 5 | 0 |
| Heritage cards, Stage 1 | 30 | 10 | 13 | 7 |
| Heritage cards, upper stages and legends | 30 | 12 | 14 | 4 |
| Hidden-heritage scenes (things inside) | 36 | 28 | 8 | 0 |
| Story settings | 12 | 7 | 5 | 0 |
| Story props (40 most used) | 40 | 30 | 10 | 0 |
| Realia dressings | 17 | 15 | 2 | 0 |
| Hoya poses | 5 | 3 | 2 | 0 |

**The vocabulary glyphs are the easy-to-read ones.** A dark outline 3 units wide on a 100 grid, flat real colours, a subject that fills most of the tile. Five need a cue: `food-egg` (a plain oval), `food-tteok` (reads as buttons), `science-shadow` (reads as a ball), `science-seed` (reads as a sprout) and `nature-cloud` (white on white).

**The heritage cards are the hard-to-read ones**, and 13 vocabulary words borrow a card as their picture, so those cards sit beside the glyphs in questions. The causes are in the card brief, not in single drawings:

- **Thin, pale outlines.** The brief asks for "about 3 px at 600 x 800", which is 1 unit on the 200 grid. Shipped strokes are 1.5 to 2 units in mid brown: about 0.6 px at 64 px, against 1.9 px of dark ink on a glyph.
- **Cream on cream.** "Theme tint plus cream" on a cream ground.
- **No red.** The brief bans red and tells kimchi to use amber, so kimchi is an orange mound in the same bowl as rice and rice cake soup. Red in a picture is not the red the anti-shame rule is about (that rule is about feedback on a miss); WordArt already draws a red apple.
- **Briefs that ask for the weak picture.** Sea is "a small sailboat in the centre" (it reads "boat", and the travel topic has a boat); the New Year bow is "hands on a pouch"; four cards are a full moon; the gayageum has two bridges.
- **Shared templates.** Five Stage 4 cards are the same two figures with speech bubbles; five Stage 7 cards are a word tile over a ruled page.

The worst fifteen: kimchi, greeting (`insa`), birthday (`saengil`), name (`ireum`), New Year bow (`sebae`), gayageum, yut game, sea, Hangul Day, ink stick, morning (`achim`), hanji, family table, the four moons (`moon`, `chuseok`, `hangawi`, `full-moon`), and the Stage 4 pair `mwoyeyo` / `gachi`.

**Scenes, props and realia mostly read well**; the weak spots are cream figures on cream, a pale full moon, and single things (the hooded crane reads as an emu). **Hoya's thinking pose has a downturned mouth**, which reads as a frown; the pose is shown on every miss, and the rule is "not sad".

## 3. The rules after this amendment [PX]

One standard for every picture a question can show, taken from what already works in WordArt:

- **R1 Ink outline.** The subject's outline is `text.primary` and at least 3 % of the grid's width (3 units on 100, 6 on 200); inner detail lines at least 2 % (2 on 100, 4 on 200). Nothing the picture needs is drawn thinner.
- **R2 The subject fills the tile.** 60 to 70 % of the frame, one subject, at most two supporting things.
- **R3 Told by shape.** A picture that is told from another one of its set only by colour is rejected (WordArt C9, now for cards too). Sets: a vocabulary topic, the cards of one stage and theme, and any group listed in section 4 as look-alikes.
- **R4 Real colours for real things.** Card art and hidden-heritage things may use the `colors.vocab.*` tones, as WordArt does. `feedback.danger` stays out of every picture. Scene settings and props keep their own palette rule.
- **R5 No picture names itself in print** where it can be a question's picture. A card that shows its own word as text is never used as a question picture (a test says so).
- **R6 A word's picture is a glyph.** A vocabulary word no longer borrows a card (F-VOC-002 section 3.11 allowed it for 13 words). Each of the 13 gets its own `word:` glyph. The cards stay as collectibles.

The card brief, the WordArt brief and the two style docs are brought in line with these, and their lines about "kids 5 to 11" and a "Pixar" look are removed (CLAUDE.md section 1: any age).

## 4. Rows

Each row is one PR, in this order. Every PR shows the before and after contact sheets, and its drawings are looked at at 54, 64 and 96 px before it merges.

**PX-0 Rules and tooling.** The rules of section 3 in the briefs and style docs. The import guard lets card art and hidden-heritage art use the vocab tones. A contact sheet for the real card art (the 60 cards at 200, 64 and 54 px) joins `/design-preview`, replacing the stand-ins on `/design-preview/cards`. A test for R5.

**PX-1 The 13 borrowed words get glyphs, and five glyphs get a cue.** New glyphs: `food-rice`, `food-kimchi` (half a napa cabbage, white ribs fanning from the stem, red seasoning on the leaves), `food-kimbap`, `animal-tiger`, `school-book`, `nature-mountain`, `nature-sea` (waves as the subject, no boat), `nature-moon` (a crescent with stars, so it is not the sun), `culture-hanbok`, `culture-seollal` (a deep bow to an elder), `culture-chuseok` (songpyeon on a plate under the moon), `culture-yutnori` (the board with the four sticks), `culture-gayageum` (the long body, bold strings each over its own bridge). `content/vocab/*.json` point at them. Cues: `food-egg` (a cracked egg beside the whole one), `food-tteok`, `science-shadow` (a figure with its shadow), `science-seed` (seeds, one sprouting), `nature-cloud` (a tinted cloud on a sky patch).

**PX-2 Stage 1 cards.** Redraw 7 (kimchi, ink stick, Hangul Day, New Year bow, sea, yut game, gayageum) and tweak 13 (hanji, brush, paper folding, chopsticks, family table, Lunar New Year, harvest festival, rice cake soup, rose of Sharon, moon, foot shuttlecock, kite as the shield kite, celadon), all to R1 to R4. The kept cards get the R1 outline only.

**PX-3 Upper-stage and legend cards.** Redraw 4 (greeting, name, morning, birthday) and tweak 14. The Stage 4 and Stage 7 templates give way to one subject per card; the byte budgets in `card-ids.test.ts` are raised to what the new drawings measure. The four moon cards are told apart by what is in front of the moon.

**PX-4 Scenes, props and realia.** The 8 things inside the hidden-heritage scenes (kimchi, rice cake, flower, mountain, yut sticks, floor cushion, snow, string reel), 5 settings (countryside, mountains, modern room, temple, sea palace), 10 props (the cream figures get tinted clothes; hooded crane; full moon; feast table; and the rest in the triage), 2 realia.

**PX-5 Hoya.** The thinking pose's mouth is level, not downturned. The waving pose raises the arm above the ear with two motion ticks, so it differs from idle at 48 px.

## 5. Not in this amendment

- Story props past the 40 most used. They are reviewed when PX-4 is done, on the same sheets.
- A learner test of the pictures. The review record in the WordArt registry stays "in review" for new glyphs until the owner or a teacher has looked at the sheet.
- Raster or photographic pictures. Every picture stays hand-authored SVG from tokens (F-STORY-005 section 3.10).

## As built

_Filled in by each row's PR._

### PX-0 (2026-11-17)

- **Rules in the docs.** A **[PX]** section with R1 to R6 in `design/brief/illustrations/heritage-card-art.md` (§3.1, with what it changes: outline 6 / 4 on the 200 grid, real colours, red allowed for content), `design/brief/illustrations/word-art.md`, `docs/design/illustration-style.md` and `design/brief/illustrations/scene-art-style.md` (§3a; the guide lives under `design/brief/illustrations/`, not `docs/design/`). The lines naming "kids 5 to 11", kids products and a "Pixar" look are gone. The per-card briefs are untouched (PX-2).
- **Import guard.** `word-art/__tests__/import-guard.test.ts` allows `colors.vocab` in `components/HeritageCardArt/` and `scene-art/hidden-heritage/` and nowhere else beside WordArt (a test pins neighbours such as the story props and the app screen that paints the scenes as still forbidden). Types were left alone: scene art's `ColorToken` / `isColorToken` still exclude the vocab group for every scene, so a hidden-heritage thing gets a vocab tone only when PX-4 opens that type for those scenes. Card art draws with `colors.*` directly, so it needs no type change.
- **Card-art contact sheet.** `/design-preview/cards` draws the real `HeritageCardArt` (30 Stage 1) and `UpperCellCardArt` (25 album and 5 legendary) at 200, 64 and 54 px with id and title, replacing the hand-copied stand-ins of 30 cards. The rows live in `apps/web/src/data/card-art-sheet.ts` (titles pinned to the app's `heritage-cards.ts` by a test; the romanization registry follows them there). The web `react-native-svg` shim maps `Text` for the cards that draw their own word. Tests: `apps/web/src/app/__tests__/card-art-sheet.test.tsx`, and `e2e/word-art-sheet.spec.ts` opens the sheet from the WordArt page.
- **R5 test.** `components/HeritageCardArt/__tests__/text-cards.test.ts` reads which cards draw text from the drawings (a case that reaches `SvgText`, `word(...)` or a frame that does: 15 cards, the Stage 6 and 7 cards and the legendary ones) and fails when any `visual`, `picture` or `pictureRef` under `content/` names one.

### PX-1 (2026-11-17)

- **13 new glyphs**, each the picture of one word (`content/vocab/*.json`), so no vocabulary word has a `card:` visual: `food-rice` (a tall blue bowl with a domed white heap, grain ticks, steam), `food-kimchi` (half a napa cabbage lying on a plate: white ribs fanning from the stem end, red leaves with dark flecks, a frilly green leaf edge; wider than tall, where the rice bowl is taller than wide), `food-kimbap` (the roll behind three cut slices showing seaweed, rice and yellow, orange, green fillings), `animal-tiger` (a gold face with round ears and ink stripes, the animal-face style of the topic, Hoya's colours not Hoya's figure), `school-book` (open, two pages on a red cover, a ribbon), `nature-mountain` (three green peaks, a snow cap), `nature-sea` (three wave bands and a sun, no boat), `nature-moon` (a crescent, two stars, a night cloud), `culture-hanbok` (jeogori with collar and goreum over a full red chima), `culture-seollal` (a child in the deep New Year bow, a lucky pouch), `culture-chuseok` (songpyeon on a plate under the full moon), `culture-yutnori` (the round board with its 29 stations and the four sticks, three flat faces up), `culture-gayageum` (the long body at an angle, four bold strings each over its own bridge, the tail cords).
- **Five cues:** `food-egg` (a fried egg beside the whole one), `food-tteok` (a cut slab of layered rainbow rice cake), `science-shadow` (a person in the sun with the long shadow they cast), `science-seed` (three seeds, the big one splitting with a root and a leaf), `nature-cloud` (tinted light blue with a white highlight; a first try with a sky patch behind it looked like `nature-sky` and was dropped).
- All 18 are `review` in the registry (`registry-px1.test.ts` asserts what each must show, e.g. kimchi is not a bowl). The family plan is 12 for every topic family (148 keys). The cards and their ids are untouched; the `card:` path of `picture-ref.ts` stays.
- **WordArt budget:** 157,177 B raw / 46,674 B gzip (141,841 / 41,851 before), within 160 / 48 KB, so the line did not move; about 6.6 KB raw is left.
- **App start bundle** (WordArt is in it): measured alone on its branch, the release `build:web` (CI=1) was 4,959,384 B raw. Merged on top of the quest Previous and sound rows (#1037, #1038), the line stayed at 4,962,000 B; see PX-2.
- **Side effect fixed:** a card page found its word's recording through the word's `card:` visual (`apps/mobile/src/logic/library/card-speech.ts`); it now also takes the one visible word with the card's Korean name, so the 13 cards still play their word's clip.
- Contact sheets of every changed topic were reviewed at 160, 64, 54 and 48 px and in silhouette. Still weakest in the reviewer's eye: `culture-seollal` (the bow reads at 64 px, less so at 48), `science-seed` (the big seed can read as a chestnut) and `food-kimbap` (a dark mass in silhouette).

### PX-2 (2026-11-17)

- **All 30 Stage 1 cards to R1-R4** in `packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx`. Shared props carry the rule: `INK` (`text.primary`, 6 units) for every subject's outline, `DET` (4 units) for detail; no stroke in the module is thinner than 4. A `Card` wrapper replaces the per-card `Svg` + `Frame` boilerplate, so the module shrank from 57,446 B to 39,366 B.
- **Redrawn 7:** `kimchi` (half a napa cabbage on a white plate: white ribs fanning from the stem under red seasoning, a frilly green leaf edge, chili flakes; wider than tall, never a bowl), `ink` (a black ink stick upright, with a gold label, on a grey inkstone at three-quarter view with a black ink pool), `hangul-day` (a tear-off calendar page, red top band and rings, its mark the word 한글 spelled correctly in drawn blue strokes, ㅎ+ㅏ+ㄴ and ㄱ+ㅡ+ㄹ, not font text; a first try with three loose jamo read as the misspelling 흥글 and was redrawn), `sebae` (one child in hanbok in the deep kneeling bow, side view, hands on the floor, on a mat), `sea` (three rows of waves with foam, a low sun and a gull; no boat), `yutnori` (the round board with its 20-station ring and the cross, a red and a blue token, the four sticks: three flat faces up, one with the back-do X, one round back up), `gayageum` (the long body on a slant with its side showing, five bold strings each over its own white bridge in a slanting row, the head bridge, the tail cords).
- **Tweaked 13** as the triage asked: hanji (deckled sheet with a curled corner over a second sheet, 4-unit fibres, a roll), brush (loop, bamboo joints, pointed tip, the stroke it made), origami (long neck with the bent beak, raised pointed tail, creased wings), chopsticks (flat grey metal with the spoon, on a rest), family-table (a low round table seen from the side with rice, soup, kimchi, spoon and chopsticks), seollal (the bowing child to a grandparent on a cushion, a lucky pouch), chuseok (a songpyeon plate and rice ears in front of the full moon, a clean two-eared rabbit), tteokguk (a wide open bowl, big oval slices, egg and gim strips, a spoon), mugunghwa (red eye radiating up each petal, the stamen column, lobed leaves), moon (a crescent with stars and a small cloud on a night sky), jegi (bright paper strands on a brass coin with a square hole, kick arcs), kite (the rectangular shield kite with the centre hole and the red top circle), pottery (a maebyeong with an inlaid white crane in a roundel and cloud marks).
- **Kept 10** (book, rice, hanbok, kimbap, songpyeon, lantern, tiger, magpie, mountain, top) got the ink outline, and a few the cue the triage named (hanbok's white collar strip and goreum, thicker pine needles, the magpie's white shoulder patch). Rice is the tall blue bowl of the `food-rice` glyph; sea, moon, chuseok, yutnori, gayageum, kimchi and seollal show what their PX-1 glyphs show, with the theme frame.
- **Sets told by shape (R3):** the kimchi plate, the tall rice bowl and the wide soup bowl with a spoon; the crescent moon and the Chuseok full moon behind its plate; the bow alone (`sebae`) and the bow to a grandparent (`seollal`). The upper-stage moons are PX-3.
- **Test:** `components/HeritageCardArt/__tests__/stage1-art.test.ts` (5 tests): tokens only and no `feedback.danger`; `INK` / `DET` and no stroke under 4; every drawing outlined in ink; per-card pins from the triage (kimchi red on a plate, the moon a crescent, no boat at sea, the shield kite has no polygon, four yut sticks, a bridge per gayageum string, Hangul Day without text); a budget of 1,800 B per drawing (largest measured: `TigerArt` 1,715 B) and 40,000 B for the module (39,366 B). No new SVG element, so the web shim is unchanged.
- **Briefs:** the 30 Stage 1 entries of `design/brief/illustrations/heritage-card-art.md` section 4 describe the new drawings, each marked **[PX]**.
- **App start bundle** (the card art is in it): the shared outline props shrink the card module (57,446 B to 39,366 B). PX-0 to PX-2 together, on top of #1037 and #1038, measure 4,957,650 B raw (release `build:web`, CI=1), under the 4,962,000 B line, which does not move.
- Contact sheets before and after, 12 cards a sheet at 200, 64 and 54 px, from the real `/design-preview/cards` export. Still weakest in the reviewer's eye: `seollal` (the bowing child is small at 54 px; the elder carries it), `yutnori` (the sticks crowd the board's corner at 54 px) and `gayageum` (the strings merge at 54 px; the slanting body and bridges still read).
