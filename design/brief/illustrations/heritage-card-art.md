# Heritage Card Art

**The collectible visual moat.** 30 cards × 5 themes for Stage 1. Get the art language right once; everything else scales.

---

## 1. Context

Heritage cards are the primary reward in Hangul Route. A learner earns them by completing quests. A card visually represents one piece of Korean culture — kimchi, tiger, hanji paper, etc. — with:

- A **front face** (the art + Korean word + romanization)
- A **back face** (English meaning + 1-line fun fact)
- A **rarity border** color (`common` brown / `uncommon` green / `rare` blue / `legendary` orange)

The 30 cards for Stage 1 are listed in `apps/mobile/src/content/heritage-cards.ts`.

## 2. Universal card format

All 30 cards share this layout (front face):

- **Aspect**: 3 : 4 portrait (e.g., 600 × 800 PNG)
- **Outer border**: 12px wide rarity color, 24px radius (`radii.xl`)
- **Inner surface**: hanji cream `surface.canvas` #FCF8F1
- **Top-right pill**: rarity label in `pill.size.sm` style (rounded rect, rarity-light fill, rarity-dark text)
- **Top-left pill**: theme tag in muted neutral
- **Center 70% canvas**: the illustration (described per card below)
- **Bottom 25%**:
  - Korean word in large `display` 36sp, `text.primary` weight 700
  - Romanization below, `bodySm` 16sp, italic, `text.muted`
  - English title above the Korean (or below if the layout reads better), `body` 18sp, `text.secondary`

## 3. Illustration language (the moat)

**One sentence**: *Geometric minhwa* — Korean folk-painting energy, but flat geometric shapes, soft warm palette, never photorealistic.

- Built from **rounded geometric primitives** (circles, ellipses, rounded rectangles, soft pillshapes).
- **Outline weight**: ~3px at 600×800 scale. Slight wobble. Hand-painted feel.
- **Palette per card**: 3–5 colors max, all from the theme's tint family + cream surface.
- **No gradients** beyond 1-stop radial shadows.
- **Background**: always hanji cream + optional 4% paper texture.
- **Centered subject**: object occupies 60–70% of the illustration zone. Generous margin.
- **Smiling rule**: if the subject has a face (animals, characters), it smiles. Always.

### 3.1 [PX] Rules for every picture a question can show

Added by `docs/specs/AMENDMENTS-PICTURES-2026-11.md` section 3 (owner request of 2026-11-17: some pictures were too abstract to name). These rules come from what already reads well in WordArt, and they win over any older line of this brief that says otherwise:

- **R1 Ink outline.** The subject's outline is `text.primary` and at least 3 % of the grid's width (3 units on a 100 grid, 6 on a 200 grid); inner detail lines are at least 2 % (2 on 100, 4 on 200). Nothing the picture needs is drawn thinner.
- **R2 The subject fills the tile.** 60 to 70 % of the frame, one subject, at most two supporting things.
- **R3 Told by shape.** A picture that is told from another one of its set only by colour is rejected (WordArt C9, now for cards too). Sets: a vocabulary topic, the cards of one stage and theme, and the look-alike groups of the amendment's section 4 (the bowls, the moons, the bows).
- **R4 Real colours for real things.** Card art and hidden-heritage things may use the `colors.vocab.*` tones, as WordArt does (kimchi is red). `feedback.danger` stays out of every picture. Scene settings and story props keep their own palette rule.
- **R5 No picture names itself in print** where it can be a question's picture. A card that shows its own word as text is never used as a question picture (a test holds this).
- **R6 A word's picture is a glyph.** A vocabulary word no longer borrows a card: each has its own `word:` glyph. The cards stay as collectibles.

What this changes in this brief:

- **Outline.** "About 3 px at 600 x 800" was 1 unit on the 200 grid, too thin and too pale to read at 64 px. The outline is now `text.primary`, 6 units on the 200 grid, details 4 (R1). No wobble.
- **Palette.** "Theme tint plus cream" put cream subjects on a cream ground. A subject has a real colour of its own, and the `colors.vocab.*` tones are allowed in card art (R4).
- **Red.** The "no red except dancheong orange" lines in sections 6 to 8 are withdrawn for content colours: red in a picture is the colour of a thing (kimchi, an apple), not feedback. The anti-shame rule is about feedback on a miss, and `feedback.danger` still never appears in a picture.
- **Per-card briefs.** The briefs in section 4 are rewritten card by card in rows PX-2 and PX-3 of the amendment; until then, where a brief asks for a picture these rules reject (a sailboat for "sea", hands on a pouch for the New Year bow, amber kimchi), the rules win. **[PX]** Row PX-2 rewrote the 30 Stage 1 briefs below (each marked **[PX]**) to match the drawings; row PX-3 added the 30 upper-stage and legendary briefs (section 4.1). Where the art-language prompts of sections 6 and 7 still say "no red", a diamond kite or amber kimchi, section 3.1 wins.

Review surface: `/design-preview/cards` draws all 60 real card arts at 200, 64 and 54 px.

## 4. Per-card briefs

**[PX]** Stage 1 as drawn after row PX-2 (`HeritageCardArt.tsx`, reviewed on `/design-preview/cards`): ink outline 6 / 4 units, one subject at 60-70 %, the set told apart by shape (the kimchi plate, the tall rice bowl and the wide soup bowl; the crescent moon and the Chuseok full moon behind its plate; the bow alone and the bow to a grandparent).

Each entry: `id` · `ko (romanization)` · `theme` · `rarity` · 1-line visual brief.

### Letters & Books (6)
- `card:book` · 책 (chaek) · letters · common — An open book: two white pages over a red cover, rows of writing marks (no letters), a ribbon bookmark. **[PX]** ink outline.
- `card:hanji` · 한지 (hanji) · letters · uncommon — **[PX]** A sheet of mulberry paper with deckled edges and a curled corner over a second sheet, long fibres drawn at 4 units in `border.strong`, a paper roll lying in front.
- `card:brush` · 붓 (but) · letters · uncommon — **[PX]** A calligraphy brush at a slant: hanging loop, bamboo handle with two joints, a long black tip ending in a point, over the black stroke it has just made (no box, no page).
- `card:ink` · 먹 (meok) · letters · common — **[PX]** A black rectangular ink stick standing upright (a small gold label) on a rectangular grey inkstone (byeoru) seen at three-quarter view, a dark ink pool in its well.
- `card:origami` · 종이접기 (jongijeopgi) · letters · rare — **[PX]** A folded paper crane in orange: two raised wings with a crease line each, a long neck with the bent beak, a pointed raised tail.
- `card:hangul-day` · 한글날 (hangeullal) · letters · legendary — **[PX]** A tear-off calendar page with a red top band and two rings; its big mark is the word 한글 spelled correctly in drawn blue strokes (ㅎ+ㅏ+ㄴ, ㄱ+ㅡ+ㄹ; never font text, and never a misspelling a learner would read), two yellow sparkles.

### Food & Daily Life (6)
- `card:kimchi` · 김치 (gimchi) · life · common — **[PX]** Half a napa cabbage (pogi-kimchi) lying on a white plate, stem end on the left: white ribs fanning from the stem under red seasoning (`vocab.red`), a frilly green leaf edge, chili flakes and green-onion bits. On a flat plate, never a bowl (the rice and the soup are bowls); the same subject as the `food-kimchi` glyph.
- `card:rice` · 밥 (bap) · life · common — A tall blue bowl heaped with a high dome of white rice, grain ticks, three steam curls. **[PX]** ink outline; the bowl of the `food-rice` glyph.
- `card:chopsticks` · 젓가락 (jeotgarak) · life · common — **[PX]** Sujeo: a pair of flat grey metal chopsticks beside a flat metal spoon, laid parallel on a slant across a wooden rest.
- `card:hanbok` · 한복 (hanbok) · life · rare — A hanbok displayed on a hanger: dancheong-orange jeogori (top) with its white collar strip and long red goreum tie, a full sky-blue chima (skirt). **[PX]** ink outline.
- `card:kimbap` · 김밥 (gimbap) · life · uncommon — Three round kimbap slices on a diagonal: dark seaweed ring, white rice, carrot, spinach and egg inside. **[PX]** ink outline.
- `card:family-table` · 가족 식탁 (gajok siktak) · life · uncommon — **[PX]** A low round table seen from the side, curved wooden legs, set with a rice bowl, a soup bowl, a plate of kimchi and a spoon with chopsticks at the front.

### Holidays & Traditions (6)
- `card:seollal` · 설날 (seollal) · rites · rare — **[PX]** A child in hanbok in the deep kneeling bow (the `card:sebae` figure, smaller) to a smiling grandparent seated on a red cushion, a lucky pouch on the floor between them. The elder is what tells it from `card:sebae`. **[FU]** The child is drawn larger and faces the grandparent (it had its back to her); the pouch is left out to make room.
- `card:chuseok` · 추석 (chuseok) · rites · rare — **[PX]** A plate of songpyeon (pink, white, green) in front of the full yellow harvest moon with a clean two-eared moon-rabbit silhouette, a ripe rice ear on either side. What is in front of the moon (the songpyeon plate) tells it from the other moon cards; the `culture-chuseok` glyph shows the same.
- `card:tteokguk` · 떡국 (tteokguk) · rites · uncommon — **[PX]** A wide white bowl seen open, large oval rice-cake slices outlined in ink in the broth, yellow egg strips and dark gim strips on top, a spoon resting in it. Wide and low, unlike the tall rice bowl.
- `card:songpyeon` · 송편 (songpyeon) · rites · uncommon — Three half-moon rice cakes on a pine-needle bed: one white, one pink, one green. **[PX]** ink outline, needles 5 units.
- `card:sebae` · 세배 (sebae) · rites · common — **[PX]** One child in hanbok (yellow jeogori, red chima) in the deep kneeling New Year bow, side view: legs folded under, back rounded, head lowered, hands flat on the floor, on a mat. (Was "hands on a pouch", which read as a chef's hat and is not a bow.)
- `card:lantern` · 연등 (yeondeung) · rites · legendary — A round red paper lantern glowing on an amber halo, ribs, yellow caps and a tassel, two smaller lanterns behind. **[PX]** ink outline, real red.

### Nature & Animals (6)
- `card:tiger` · 호랑이 (horangi) · nature · legendary — Hoya himself in the cheering pose (see character sheet). Crown of 3 small sparkles above his head. The "first card" the learner earns. **[PX]** ink outline.
- `card:magpie` · 까치 (kkachi) · nature · uncommon — A round black-and-white magpie (black body, white belly and shoulder patch, long tail) perched on a bare brown branch. **[PX]** ink outline.
- `card:mugunghwa` · 무궁화 (mugunghwa) · nature · rare — **[PX]** A five-petal pink flower whose dark red eye radiates up each petal from the centre, the long pale stamen column with a yellow tip, two lobed green leaves on the stem.
- `card:mountain` · 산 (san) · nature · common — Three green peaks, the tall middle one with a white snow cap, a yellow sun behind. **[PX]** ink outline; the `nature-mountain` glyph's peaks.
- `card:sea` · 바다 (bada) · nature · common — **[PX]** The water is the subject: three rows of big waves (sky blue, blue, sky blue) with curling crests and white foam fill most of the tile, a yellow sun low over them and one gull. No boat (it read "boat", and the travel topic has a boat); the `nature-sea` glyph shows the same.
- `card:moon` · 달 (dal) · nature · uncommon — **[PX]** A yellow crescent moon on a deep blue night sky, three white sparkle stars and a small pale cloud across its lower horn, as the `nature-moon` glyph. A crescent, so it is not one more full moon beside Chuseok and the upper-stage moon cards.

### Play & Crafts (6)
- `card:yutnori` · 윷놀이 (yunnori) · crafts · rare — **[PX]** The round yut board with its ring of twenty stations and the cross of stations inside (bigger dots at the corners and centre), a red and a blue token on it, and the four half-round sticks thrown beside it: three flat faces up (one with the back-do X), one round back up. The `culture-yutnori` glyph shows the same. **[FU]** The board sits at the top and the sticks lie in two pairs below it, none over the board (they crowded its corner at 54 px).
- `card:jegi` · 제기 (jegi) · crafts · uncommon — **[PX]** A fan of bright paper strands (red, yellow, blue, green, pink, orange) rising from a brass coin with a square hole, dashed kick arcs either side.
- `card:kite` · 연 (yeon) · crafts · uncommon — **[PX]** The rectangular shield kite (bangpaeyeon), as the card's fact says: a white rectangle with the round centre hole, a red circle at the top on a blue band, bamboo sticks (upright, crossbar, two diagonals), a green band near the foot, the string trailing. (Was a diamond kite.)
- `card:top` · 팽이 (paengi) · crafts · common — A wooden spinning top mid-spin (motion lines either side), gold body with an orange band, a point below. Soft floor shadow. **[PX]** ink outline.
- `card:pottery` · 청자 (cheongja) · crafts · rare — **[PX]** A Goryeo celadon maebyeong (small mouth, broad shoulder, narrow foot) in soft jade (`stage.stage7` at half strength), one inlaid white crane flying in a white roundel and white inlaid cloud marks. Told by the shape and the crane, not only the colour.
- `card:gayageum` · 가야금 (gayageum) · crafts · legendary — **[PX]** The long wooden body at three-quarter view on a slant (its side showing), five bold dark strings, each over its own white movable bridge (anjok) in a slanting row, the fixed bridge at the head and the cords coiled at the tail. (Was a flat zither with two bridges for twelve hairline strings.) The `culture-gayageum` glyph shows the same.

### 4.1 [PX] Upper stages and legendary cards (30)

Added by row PX-3 of `docs/specs/AMENDMENTS-PICTURES-2026-11.md` (`UpperCellArt.tsx`, reviewed on `/design-preview/cards`). These cards had no entry here: their pictures followed the stage specs, and two of those asked for the weak picture, which the entries below replace. F-CARD-S4-001 section 3.2 asked for "two figures facing each other" with "one or two speech bubbles" on every Stage 4 talk (five cards, one silhouette); F-CARD-S7-001 drew every Stage 7 card as "the card's word as a word-bank tile over a ruled page" (the picture was the printed word). Row PX-3 of the amendment replaces both templates with one subject per card, so those lines no longer bind the drawings. Now each card is its own subject in the section 3.1 rules: ink outline 6 / 4 units, one subject at 60-70 %, told from the rest of the upper set by shape. The Stage 6 and 7 cards and the legendary cards still print their Korean, small and secondary (R5 allows it: a test keeps every text card out of the question pictures), and the picture carries the meaning without it.

The four moons of the whole set are told apart by what stands in front of the moon: `card:moon` is a crescent with stars and a cloud, `card:chuseok` the full moon with its rabbit behind a songpyeon plate and rice ears, `card:full-moon` the full moon behind a tiled hanok roof, `card:hangawi` a small moon behind a heap of songpyeon and a fruit pyramid.

Stage 2 (all rare):
- `card:norae` · 노래 (norae) · letters — Two beamed notes, heads in orange, over two orange sound waves, two yellow sparkles. **[PX]** ink outline.
- `card:dosirak` · 도시락 (dosirak) · life — An open white lunch box with its blue lid leaning behind: four rice balls, a rolled egg, greens. **[PX]** ink outline.
- `card:bokjumeoni` · 복주머니 (bokjumeoni) · rites — A round purple silk pouch with an orange band, gold tie cords and a round gold knot. **[PX]** ink outline.
- `card:byeol` · 별 (byeol) · nature — One big smiling yellow five-point star on a dusk sky, two white twinkles. **[PX]** ink outline.
- `card:swing` · 그네 (geune) · crafts — A seat on two ropes hung from a willow branch, swung forward, green willow strands, motion arcs. **[PX]** ink outline.

Stage 3 (all rare):
- `card:hangeul` · 한글 (hangeul) · letters — **[PX]** An open book with the first four letters ㄱ ㄴ (left page) and ㄷ ㄹ (right page) in bold strokes, each a letter on its own. (The right page drew ㄱ over ㅡ, which reads as the syllable 그.)
- `card:tteok` · 떡 (tteok) · life — **[PX]** A cut block of rainbow rice cake (mujigae-tteok) at three-quarter view on a white plate: pink, yellow, green and white layers on the front and the side. (Was pastel cubes that read as marshmallows.)
- `card:full-moon` · 보름달 (boreumdal) · rites — **[PX]** The big full moon on a deep blue night sky, rising behind the dark tiled roof of a hanok with its upturned eaves and white wall. (Was a moon over hills, the fourth look-alike full moon.)
- `card:gom` · 곰 (gom) · nature — A round black bear with the white half-moon mark on its chest, smiling. **[PX]** ink outline.
- `card:yut` · 윷 (yut) · crafts — **[PX]** Four half-round sticks lying side by side, each showing its half-round end: three round backs up, one flat face up with its X marks. (Was a fan of sticks that read as ice-lolly sticks.) The board belongs to `card:yutnori`.

Stage 4 (all rare):
- `card:mwoyeyo` · 이게 뭐예요? (ige mwoyeyo) · letters — **[PX]** A friend beside a big purple wrapped box with a red ribbon; one bubble with a big question mark.
- `card:masisseoyo` · 맛있어요 (masisseoyo) · life — **[PX]** One friend with pink cheeks behind a big white bowl of rice, a spoon in hand, red hearts rising.
- `card:insa` · 인사 (insa) · rites — **[PX]** Two friends in side view bowing to each other: bodies bent at the waist, heads lowered, eyes shut, smiling; no bubbles. (Was two smiley bubbles over two standing friends.) **[FU]** Drawn a tenth larger, heads close over the middle, no motion arcs.
- `card:biga-wayo` · 비가 와요 (biga wayo) · nature — **[PX]** A grey-blue cloud with big drops over a friend under a red umbrella, a puddle at the feet; no bubbles.
- `card:gachi` · 같이 할까요? (gachi halkkayo) · crafts — **[PX]** Two friends hold one big red-and-white ball between them, a paw on each side; no bubbles.

Stage 6 (all rare; the Korean is drawn small):
- `card:won` · 원 (won) · letters — **[PX]** A big gold coin with the ₩ sign drawn as strokes over a blue banknote; a small price card above (김밥 이천 원). (Was a menu board that only the printed Korean named.)
- `card:yeogiyo` · 여기요 (yeogiyo) · life — A friend at a table raises a paw and calls; one bubble (여기요!). **[PX]** ink outline.
- `card:gichapyo` · 기차표 (gichapyo) · rites — A ticket with a notch at each side, a purple top band (기차표), a small blue train on the left and the stations and time on the right. **[PX]** ink outline and the train, so it reads without its text.
- `card:jeongsang` · 정상 (jeongsang) · nature — A green mountain with a white peak, a trail sign on a post pointing up (정상 ↑). **[PX]** ink outline.
- `card:deom` · 덤 (deom) · crafts — **[PX]** Three red apples with stems and leaves under a small price card, a green "+" and a fourth apple set apart with sparkles. (Was brown discs.)

Stage 7 (all rare; the cell's sentence on a small note strip under the subject):
- `card:ireum` · 이름 (ireum) · letters — **[PX]** A name badge on a blue lanyard with a clip: a blue top band, Hoya's face on the left and the name 호야 on the right. (Was a word tile over a page.)
- `card:achim` · 아침 (achim) · life — **[PX]** The orange sun rising over a green ridge, seen through a wooden window, a slice of toast in front of the sill. (Was the same page as `ireum` plus a small sun.)
- `card:saengil` · 생일 (saengil) · rites — **[PX]** A round pink cake with white cream on top and drips, three blue candles alight, on a white plate. (Was a pink box beside a word tile.)
- `card:tokki` · 토끼 (tokki) · nature — **[PX]** The whole white rabbit sitting in the grass, long pink-lined ears up, a round tail, smiling. (Was two ears over a word tile.)
- `card:bihaenggi` · 비행기 (bihaenggi) · crafts — **[PX]** A big folded paper plane with its fold line, a sky-blue underside, on a dashed flight arc.

Legendary (gold frame, the Korean name small on a label):
- `card:hunminjeongeum` · 훈민정음 (hunminjeongeum) · letters — **[PX]** An old thread-bound book: aged patterned cover, a white title slip at the upper left, the five-hole red binding along the right edge. (Was a blue slab that read as a notebook.)
- `card:jang` · 장 담그기 (jang damgeugi) · life — Three round brown onggi jars with lids on a stone terrace. **[PX]** ink outline.
- `card:hangawi` · 한가위 (hangawi) · rites — **[PX]** A white plate heaped with songpyeon (white, green, yellow) in front, a footed dish piled with red apples and yellow pears behind, a small full moon in the corner. (Was a moon over a small plate.)
- `card:jirisan` · 지리산 (jirisan) · nature — **[PX]** Ridges one behind another with a white sea of clouds between them and the grey summit stone on the top peak; no sun. **[FU]** The front peak rises out of a second cloud band; the stone is an angular rock with facets (a straight-sided slab read as a chimney).
- `card:ssireum` · 씨름 (ssireum) · crafts — **[FU]** Two wrestlers crouched in the hold on a sand ring: legs bent wide, bodies leaning in to heads on each other's shoulder, white satba belts at waist and thigh, each hand gripping the other's thigh band. (Was two friends leaning in, which read as a hug.)

## 5. Card back layout (universal)

Same outer dimensions and rarity border. Inside:
- Top zone (40%): a centered, larger version of the Korean word in `display` 36sp + romanization below.
- Middle zone (30%): English title in `prompt` 22sp + 1-line English blurb in `body` 18sp.
- Bottom zone (30%): "💡" lightbulb glyph + 1-line fun fact in `bodySm` 16sp `text.muted` italic.

Content for each card's back face is in `apps/mobile/src/content/heritage-cards.ts` — `blurbEn` and `factEn` fields.

---

## 6. Claude Design prompt — Card art language sheet

Run this first. It locks the style before producing the 30 individual cards.

```prompt
Create an art-language style sheet for "Heritage Cards" — collectible
culture cards in Hangul Route (a Korean learning app for learners of any age).

Output: one 1600 × 1200 PNG showing 6 sample cards in a 3 × 2 grid, with
a 100px title bar at top reading "Heritage Card — Art Language v1" in
#2A1F14 28sp bold.

Each card frame: 480 × 480 — they're square here only for the language
sheet; final cards are 3:4 portrait.

The 6 samples (one per theme + 1 rarity example):
1. Book (theme: letters · rarity: common) — cream open book with two
   black calligraphy strokes on the page.
2. Kimchi (theme: life · rarity: common) — small cream bowl with red-
   orange cabbage layers.
3. Lunar New Year bow (theme: rites · rarity: rare) — two abstract bowing
   figures, parent and child, on cream floor.
4. Magpie (theme: nature · rarity: uncommon) — black-and-white round bird
   on a branch.
5. Kite (theme: crafts · rarity: uncommon) — diamond paper kite with
   tiger face, two tassels.
6. Tiger (theme: nature · rarity: legendary) — Hoya the tiger in cheering
   pose with 3 amber sparkles above his head — this is the most precious
   card in Stage 1.

Universal frame style for every card:
- 12px outer border in rarity color (common #8A7860, uncommon #7BB552,
  rare #4A9DD6, legendary #E8743B)
- 24px radius corners
- Inner surface: hanji cream #FCF8F1 with subtle 4% paper-fiber texture
- Top-left small pill: theme name in muted brown
- Top-right small pill: rarity label in rarity-light fill / rarity-dark text
- Center 70%: the illustration
- Bottom 25%: Korean word large (#2A1F14, weight 700) + romanization
  italic small below in #5C4A36

Art language to lock (apply to all 6 illustrations):
- Geometric minhwa — round geometric primitives, soft warm palette
- ~3px stroke with slight hand-painted wobble
- Palette per card: max 5 colors from {theme tint + brand tints + surface
  cream + warm-dark}
- No gradients beyond single radial shadows under objects
- Subjects centered, occupying 60–70% of illustration zone
- Smiling rule: any face smiles
- Hanji cream background, optional 4% texture
- No photorealism, no anime sparkle eyes, no neon

Anti-patterns:
- Red anywhere except dancheong-warm orange (#E8743B) accents and the
  kimchi cabbage (use amber-red #D89B2B for cabbage, not alarm-red)
- Pure black — use #2A1F14
- White cold backgrounds — always cream
- Heavy drop shadows — only soft radial shadows under objects
- More than 5 colors in any single card

Color tokens (use ONLY these):
- Surfaces: #FCF8F1 (cream canvas) · #FFFFFF (paper) · #F2EBDE (sunken)
- Text: #2A1F14 (primary) · #5C4A36 (secondary) · #8A7860 (muted)
- Themes: letters #E8743B · life #F2B33D · rites #8265C2 · nature #7BB552
  · crafts #4A9DD6
- Rarity: common #8A7860 · uncommon #7BB552 · rare #4A9DD6 · legendary
  #E8743B

Deliverable: a single PNG style sheet that the next 30 cards will
visually inherit from.
```

## 7. Claude Design prompt — Individual card (template)

Replace `{CARD_ID}`, `{KO}`, `{ROM}`, `{TITLE_EN}`, `{THEME}`, `{RARITY}`,
`{ILLUSTRATION_BRIEF}` from the per-card briefs above. Run 30 times.

```prompt
Create a single Heritage Card for Hangul Route at 600 × 800 portrait PNG.

Card frame:
- 12px outer border in rarity color {RARITY_HEX}
- 24px radius corners
- Inner surface: hanji cream #FCF8F1 with subtle 4% paper fiber texture
- Top-left pill: "{THEME}" in muted brown #5C4A36 on #F2EBDE fill
- Top-right pill: "{RARITY}" label, rarity-light fill, rarity-dark text

Illustration (centered, 70% of card height):
{ILLUSTRATION_BRIEF}

Bottom 25% text block (centered):
- "{KO}" — display 36sp, #2A1F14, weight 700
- "{ROM}" — italic body small 16sp, #8A7860, directly below Korean
- "{TITLE_EN}" — body 18sp, #5C4A36, weight 600, above the Korean

Style markers:
- Geometric minhwa style — rounded primitives, ~3px stroke with slight
  hand-painted wobble
- Palette max 5 colors from {brand · surface · text · theme · rarity}
- Smiling rule: any face has a small "U" smile
- No photorealism, no anime, no neon, no pure black, no red except
  dancheong orange accents

Inherits style from design/brief/illustrations/heritage-card-art.md §6
art-language style sheet.

Deliverable: 600 × 800 PNG card front face.
```

## 8. Acceptance checklist (apply to all 30 cards)

- [ ] 600 × 800 portrait, 24px radius, 12px rarity border
- [ ] Hanji cream interior #FCF8F1
- [ ] Theme pill top-left, rarity pill top-right
- [ ] Illustration centered, 60–70% of card height
- [ ] Korean word in display 36sp + romanization italic below
- [ ] English title above Korean
- [ ] Max 5 colors per card
- [ ] ~3px stroke with hand-painted wobble
- [ ] Smiling rule: any face smiles
- [ ] No red except dancheong orange accents
- [ ] No pure black (use #2A1F14)
- [ ] No gradient backgrounds
- [ ] Style consistent with the art-language sheet (§6)

## 9. Output path

- Style sheet: `design/illustrations/heritage-cards/_art-language__v1__YYYY-MM-DD.png`
- Per-card: `design/illustrations/heritage-cards/{theme}/{card-id}__YYYY-MM-DD.png`

Example:
- `design/illustrations/heritage-cards/nature/tiger__2026-05-25.png`
- `design/illustrations/heritage-cards/letters/book__2026-05-25.png`

Backs (Phase 2):
- `design/illustrations/heritage-cards/{theme}/{card-id}-back__YYYY-MM-DD.png`

## 10. Out of scope (this PR)

- Stage 2–7 cards (separate brief per stage when content lands). **[PX]** The 25 upper-stage album cards and the 5 legendary cards now have their entries in section 4.1.
- Animated card-reveal sequences (separate animation brief)
- Print-quality high-DPI exports (deferred until parents request physical merch)
