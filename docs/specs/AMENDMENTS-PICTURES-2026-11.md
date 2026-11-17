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
