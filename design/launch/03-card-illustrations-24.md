# 03 — Stage 1 Heritage Card Illustrations (24 cards)

**One illustration per jamo.** Maps 1:1 to
[`content/episodes/stage-1/cards.json`](../../content/episodes/stage-1/cards.json).

Inherits from
[`design/brief/illustrations/heritage-card-art.md`](../brief/illustrations/heritage-card-art.md)
— that brief produces the *art-language sheet* (§6) and the *individual
card template* (§7). This file just gives you the **24 parameter sets**
for the launch and one launch-specific override.

> Output is the illustration ONLY — not the framed card. The framed card
> (border, rarity ring, title, romanization, English) is composited in
> the app and the PH gallery from the
> [`design/brief/illustrations/heritage-card-art.md`](../brief/illustrations/heritage-card-art.md)
> template.

---

## 1. Inputs (must be locked first)

- `design/brief/illustrations/heritage-card-art.md` §6 — **art-language
  sheet** committed (the 6-sample style anchor).
- `design/launch/01-hoya-three-poses.md` — for `card:horangi` only (the
  Hoya cameo).

If either is missing, do not run this brief. Lock them first.

---

## 2. Universal illustration prompt template

This is the single, parameterized prompt. Run it **24 times** with the
parameter table in §3.

```prompt
Generate a Stage 1 Heritage Card illustration for Hangul Route.

Output: 560 × 800 PNG (portrait), transparent background. The
illustration lives inside the inner 70% of the canvas (centered);
outer 15% on each side stays transparent for the card-frame composite.

Subject: {SUBJECT}

Visual treatment:
- Hand-painted geometric minhwa (Korean folk-art style). ~6px stroke
  with a slight hand wobble.
- Composition: subject occupies ~75% of inner area, single focal point,
  no busy background. If a background hint is needed, use a 6% hanji
  texture tint only — no scenery.
- Palette: prioritize the theme accent {THEME_ACCENT} for ~30% of the
  illustration's color mass. Fill out with palette tokens (see
  `design/launch/README.md` universal rules). Never any color outside
  the palette.
- Stroke: warm-black #2A1F14 outlines, ~6px, slight wobble.
- Highlight: a single small dancheong-orange #E8743B accent dot or
  curl (no more than one per card) — the "Korean signature."

Mood: {MOOD}.

Anti-patterns: no text inside the illustration, no realistic shading
(this is folk art, not Pixar), no pure black, no neon, no red except
the legendary border color #E8743B as a tiny accent, no animal showing
teeth or tongue.

Deliverable: 560 × 800 PNG with transparent background, illustration
in the inner 70%.
```

---

## 3. Parameter table — all 24 cards

The columns match `content/episodes/stage-1/cards.json`. Run the
prompt above 24 times, swapping `{SUBJECT}`, `{THEME_ACCENT}`,
`{MOOD}` per row.

`{THEME_ACCENT}` maps:
- letters → #E8743B
- life → #F2B33D
- rites → #8265C2
- nature → #7BB552
- crafts → #4A9DD6

| # | Card id | `{SUBJECT}` | Theme | `{THEME_ACCENT}` | `{MOOD}` |
|---|---|---|---|---|---|
| 1 | `card:gangaji` | A small floppy-eared puppy sitting upright, tail mid-wag, looking up at the viewer with round eyes. Coat in soft warm beige (#F2D4B0 / #B58963), nose #2A1F14, no collar. | life | #F2B33D | "warm welcome — first word a child meets" |
| 2 | `card:nabi` | A symmetric Korean folk-painting butterfly, wings spread, pale yellow #FCE6A3 base with #F2B33D wing pattern and a single #E8743B center dot. Body in #5C4A36. | nature | #7BB552 | "summer afternoon, slow flight" |
| 3 | `card:boreumdal` | A large full moon high in a deep #2A1F14 sky (top 70% of inner canvas). Cream moon #FCF8F1 with subtle craters. Below the moon, a single silhouette of a rabbit pounding rice cake (folk motif). | rites | #8265C2 | "Chuseok night, quiet awe" |
| 4 | `card:ramyeon` | A steaming bowl of ramen with one wooden chopstick lifting noodles. Bowl in red-orange #E8743B with cream interior, broth in soft amber #F2B33D, one egg half on top. 3 small steam curls. | life | #F2B33D | "Friday night, cozy noodles" |
| 5 | `card:mugunghwa` | A single Rose of Sharon bloom, 5 petals, soft pink #F8B4B4 with a #B5562A center stamen and #5C4A36 anthers, on a short green stem. Composition centered, single flower. | nature | #7BB552 | "summer hedge, proud and gentle" |
| 6 | `card:bap` | A traditional Korean rice bowl: white-cream rice mound #FCF8F1 in a celadon-blue #4A9DD6 bowl, with a single wooden spoon (#B5862A) leaning. A few rice grains spilling cute on the canvas. | life | #F2B33D | "home meal — the word that means 'how are you'" |
| 7 | `card:sagwa` | A large red apple in dancheong-orange #E8743B with a leaf #7BB552 and tiny shine highlight #FCF8F1. One stem, slight tilt 8°. | life | #F2B33D | "crisp autumn — also the Korean word for sorry" |
| 8 | `card:inhyeong` | A traditional Korean doll: a girl in hanbok with red #E8743B jeogori, blue #4A9DD6 chima, hair in two braids, eyes closed in a soft smile, holding a tiny fan. Flat, no shading. | crafts | #4A9DD6 | "handmade, generations old" |
| 9 | `card:jamjari` | A dragonfly with long thin body, four lacy wings showing as overlapping ovals with delicate stroke detail, blue-iridescent body #4A9DD6 with #2E72A3 segments. Centered, viewed top-down. | nature | #7BB552 | "summer pond, fast and shimmer" |
| 10 | `card:chaek` | A stack of three traditional Korean books bound with string (Joseon style), spines facing the viewer, top book open showing two pages of dotted dummy text (no real glyphs). Cover cloth in #B5562A, #4A9DD6, #7BB552. | letters | #E8743B | "the gift of being able to read" |
| 11 | `card:kpop` | A friendly stylized microphone on a small stand, with three sound waves curving out to the right (each in a different theme accent #E8743B, #F2B33D, #4A9DD6). Mic head in #2A1F14, body in dancheong-orange #E8743B. | letters | #E8743B | "stadium night, bright joy" |
| 12 | `card:taegeukgi` | The Korean flag at REST on a wooden pole, drawn in folk style: white cream field #FCF8F1, the taegeuk circle (red #E8743B top half, blue #4A9DD6 bottom half) centered, four black trigrams (#2A1F14) at the corners. Slight wave in the cloth. | rites | #8265C2 | "national pride, gentle" |
| 13 | `card:paengi` | A wooden spinning top mid-spin: top body in #B5562A with #2A1F14 and #4A9DD6 stripe bands, slight motion-blur ring in cream #FCF8F1 at the base (curve only, no streaks). A small dancheong #E8743B paw mark beside it (Hoya passed through). | crafts | #4A9DD6 | "winter ice play, focused fun" |
| 14 | `card:horangi` | A small folk-art tiger in the IDLE pose — but NOT Hoya. This is the "wild ancestor" version: same Hoya proportions, BUT seated on hind legs with a full tail curl around the front paws, eyes half-closed in a contented expression, a tobacco pipe (a tiny one) loosely held — the folktale opener. Use Hoya palette tokens. | letters | #E8743B | "Long ago, when tigers smoked tobacco… — the folktale archetype" |
| 15 | `card:arirang` | A hanji scroll partially unrolled, showing 3–4 stylized hand-drawn mountain ridges and a moon, with five small flying birds. Scroll edges in #B5562A, hanji #FCF8F1, mountains in #5C4A36 to #4A9DD6 gradient (use only the two flat colors, no gradient). | rites | #8265C2 | "homesickness, beautiful sorrow" |
| 16 | `card:yagu` | A baseball with stitches (red stitching #E8743B on cream #FCF8F1) above a small wooden bat (#B5562A). A single dancheong-orange #E8743B 4-pointed sparkle near the ball — the "home run" pulse. | crafts | #4A9DD6 | "stadium afternoon, drums and cheers" |
| 17 | `card:eomuk` | A wooden skewer holding two layered fish-cake squares, soft brown #B58963 outer, cream #FCF8F1 striations. Beside it a tiny cup of broth (cream #FCF8F1 in a small #4A9DD6 cup), three steam curls. | life | #F2B33D | "cold morning street, hot snack" |
| 18 | `card:yeou` | A nine-tailed fox depicted in folk style, head and front body visible, with 9 thin curled tails fanning behind. Body in dancheong-orange #E8743B with cream belly, eyes round and FRIENDLY (NOT predatory), small smile. | nature | #7BB552 | "clever and a little magic — not scary" |
| 19 | `card:ori` | A small brown duck (#B58963 body, #2A1F14 head, cream belly) paddling, with three tiny water ripples #4A9DD6 below it. A reed of grass #7BB552 to the left. | nature | #7BB552 | "pond afternoon, gentle waddle" |
| 20 | `card:yong` | A Korean dragon (long, no wings — water spirit). Sinuous body in dancheong-orange #E8743B with cream belly, antlers, whiskers, and a small cloud puff #FCF8F1 from its mouth. Single dancheong-orange flame? — NO, replace with a tiny cloud (water spirit, not fire dragon). | nature | #7BB552 | "rain bringer, sky river" |
| 21 | `card:usan` | A small yellow paper umbrella #F2B33D opened, with #E8743B trim and a tiny dancheong-orange handle. Two raindrops #4A9DD6 falling beside it. | life | #F2B33D | "rainy season, every kid has one" |
| 22 | `card:yutnori` | Four wooden yut sticks arranged in a soft "X", each ~280px long, in #B5562A with #FCF8F1 painted half on each flat side. One stick rotated 30° for play. A small dancheong-orange #E8743B sparkle in the center. | crafts | #4A9DD6 | "Seollal night, family laughter" |
| 23 | `card:geune` | A traditional Korean swing (a single board hung from two long ropes), seen from the front, NO rider. Board in #B5562A, ropes in #5C4A36, slight motion arc shown as a faint cream #FCF8F1 curve below the board. | crafts | #4A9DD6 | "Dano festival, the higher the wish" |
| 24 | `card:ibul` | A padded Korean blanket folded into a low neat stack (3 layers), top blanket in #E8743B and #F2B33D folk-pattern stripes, middle in #4A9DD6, bottom in #FCF8F1. A small dancheong paw mark on the top fold. | rites | #8265C2 | "morning routine, grandma's hands" |

---

## 4. Output convention

```
design/launch/__output__/cards/
├── 01-gangaji__v1__YYYY-MM-DD.png
├── 02-nabi__v1__YYYY-MM-DD.png
├── 03-boreumdal__v1__YYYY-MM-DD.png
├── … (one per row in the table above, numbered by `order` in
│         content/episodes/stage-1/jamo.json)
└── 24-ibul__v1__YYYY-MM-DD.png
```

Use the same id slug from `cards.json` (`card:gangaji` → `gangaji.png`)
plus the numeric prefix matching the linked jamo's `order`.

---

## 5. Iteration discipline

Each card takes 2–5 minutes if the art-language sheet is locked. If the
first 3 cards come back wildly off-style, **stop running** and re-anchor
on the art-language sheet (`design/brief/illustrations/heritage-card-art.md`
§6) — do not push through 24 mis-styled cards.

Iteration knobs (one at a time):
- Stroke wobble: "slight" ↔ "smooth" ↔ "noticeable"
- Single-color dominance: theme accent at 25% ↔ 30% ↔ 40% of color mass
- Background hint: none ↔ 4% hanji texture ↔ 8% hanji texture
- Subject scale: 70% of inner area ↔ 75% ↔ 80%

---

## 6. Acceptance checklist (per card)

- [ ] Subject readable at 96 × 96 px (the smallest size it'll appear in
      the Heritage Library grid).
- [ ] Single focal point — a viewer must be able to name the subject in
      < 1 second.
- [ ] Only palette tokens used (no out-of-palette colors).
- [ ] No text inside the illustration.
- [ ] Slight stroke wobble visible — not perfectly geometric, not
      wildly imperfect.
- [ ] The theme accent (#THEME_ACCENT for the row) is dominant.
- [ ] Saved with the filename convention above.

## 7. Acceptance checklist (deck — all 24)

- [ ] All 24 share the same stroke weight (sample 3 cards side-by-side
      at 100%; the strokes should look like they came from the same
      brush).
- [ ] Theme distribution matches `content/episodes/stage-1/README.md`:
      4 letters · 7 life · 4 rites · 5 nature · 4 crafts.
- [ ] Rarity treatments visible at the framed-card layer (border color
      varies — verified in slide 2 of the gallery).
- [ ] `card:horangi` is recognizably tiger-folk-archetype, but
      **distinct from Hoya** (seated, contented, pipe-holding — never
      mistakable for the actual Hoya character).
- [ ] All 24 outputs saved.
- [ ] Session block logged in `design/prompts.md` (one block for the
      24-card run, listing the date range and which cards iterated
      multiple times).
