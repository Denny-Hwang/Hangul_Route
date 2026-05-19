# Heritage Card Art

**The collectible visual moat.** 30 cards × 5 themes for Stage 1. Get the art language right once; everything else scales.

---

## 1. Context

Heritage cards are the primary reward in Hangul Route. The child earns them by completing quests. A card visually represents one piece of Korean culture — kimchi, tiger, hanji paper, etc. — with:

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

## 4. Per-card briefs

Each entry: `id` · `ko (romanization)` · `theme` · `rarity` · 1-line visual brief.

### Letters & Books (6)
- `card:book` · 책 (chaek) · letters · common — A small cream rectangular book, open, two black calligraphy strokes on the visible page. Soft shadow.
- `card:hanji` · 한지 (hanji) · letters · uncommon — A square sheet of fibrous cream paper, slightly torn corner, lit from above. Visible long mulberry fibers.
- `card:brush` · 붓 (but) · letters · uncommon — A vertical brush with cream wooden handle, dark `text.primary` bristles, a single drop of ink suspended above an empty page.
- `card:ink` · 먹 (meok) · letters · common — A rectangular black ink stick (`text.primary`) resting on a stone slab (`surface.sunken`), with a cream-colored grinding area.
- `card:origami` · 종이접기 (jong-i-jeop-gi) · letters · rare — A folded paper crane in `theme.letters` orange, mid-flight, suggested wing creases.
- `card:hangul-day` · 한글날 (hangeul-nal) · letters · legendary — A glowing "한글" character composed of generous brush strokes, surrounded by 6 small dancheong-orange sparkles (`feedback.nudge`). Hint of a calendar page in the background (faintly).

### Food & Daily Life (6)
- `card:kimchi` · 김치 (gimchi) · life · common — A small cream bowl with bright dancheong-red cabbage (use `theme.life` amber for warmth, NOT alarm-red), 3 visible cabbage layers, no liquid spill.
- `card:rice` · 밥 (bap) · life · common — A round cream bowl filled with mound of white rice grains, soft shadow, suggested steam rising as 3 wavy lines.
- `card:chopsticks` · 젓가락 (jeotgarak) · life · common — A pair of slim flat metal chopsticks crossed at the bottom, slight metallic warm-grey, resting on a small cream chopstick holder.
- `card:hanbok` · 한복 (hanbok) · life · rare — A child's hanbok displayed on a hanger: dancheong-orange jeogori (top) with cream collar, sky-blue chima (skirt). Two sleeve openings visible.
- `card:kimbap` · 김밥 (gimbap) · life · uncommon — Three round kimbap slices arranged diagonally, dark seaweed exterior (`text.primary` at 80%), cream rice center with one orange (carrot) and one green (spinach) dot inside each.
- `card:family-table` · 가족식탁 (gajok-siktak) · life · uncommon — A circular wooden table (warm `theme.life` amber) viewed top-down with 4 small bowls arranged at cardinal points and a central rice bowl.

### Holidays & Traditions (6)
- `card:seollal` · 설날 (seollal) · rites · rare — Two abstract figures (one larger adult, one smaller child) bowing — represented by simple rounded shapes in `theme.rites` purple and dancheong-orange, with a cream floor and a hint of a folding screen behind.
- `card:chuseok` · 추석 (chuseok) · rites · rare — A large warm cream full moon centered, with a stylized small rabbit silhouette in `text.primary`, three rice stalks (`theme.nature` green) at the bottom.
- `card:tteokguk` · 떡국 (tteokguk) · rites · uncommon — A cream bowl with light broth and 4 oval white rice-cake slices floating, garnished with a tiny green dot (scallion) and a thin egg yellow ribbon.
- `card:songpyeon` · 송편 (songpyeon) · rites · uncommon — Three half-moon rice cakes on a pine-needle bed: one cream, one pink (`hoya.cheek`), one green (`theme.nature`).
- `card:sebae` · 세배 (sebae) · rites · common — A pair of small folded hands resting on a tiny silk bag (light dancheong-orange), suggesting receiving lucky money. Minimal scene.
- `card:lantern` · 연등 (yeondeung) · rites · legendary — A round paper lantern glowing warm amber (`feedback.nudge`), with a tassel below and three smaller lanterns floating behind at decreasing opacity (60%, 30%, 15%).

### Nature & Animals (6)
- `card:tiger` · 호랑이 (horangi) · nature · legendary — Hoya himself in the cheering pose (see character sheet), but slightly more painterly. Crown of 3 small dancheong-orange sparkles above his head. The "first card" the child earns.
- `card:magpie` · 까치 (kkachi) · nature · uncommon — A round black-and-white magpie (body `text.primary`, belly `surface.canvas`, long tail at 45°) perched on a small leafless branch (`theme.life` amber).
- `card:mugunghwa` · 무궁화 (mugunghwa) · nature · rare — A 5-petal pink flower (`hoya.cheek` deepened) centered with a deep `theme.rites` purple middle dot, on a green stem with two leaves.
- `card:mountain` · 산 (san) · nature · common — Three overlapping mountain triangles in `theme.nature` green at decreasing opacity (100%/70%/40%), with a small cream sun rising behind the back peak.
- `card:sea` · 바다 (bada) · nature · common — Three wavy horizontal lines in `brand.secondary` blue at the bottom 40%, a small cream sailboat with an orange sail in the center, calm sky above.
- `card:moon` · 달 (dal) · nature · uncommon — A full warm cream moon centered with 3 rounded crater shadows in `text.muted`, on a deep `theme.rites` purple night sky with 5 small pin-point stars.

### Play & Crafts (6)
- `card:yutnori` · 윷놀이 (yutnori) · crafts · rare — Four cream wooden sticks arranged scattered, with one flat-side up showing a small dancheong-orange marking; three round-side up. Below: 4 small piece-tokens in cream.
- `card:jegi` · 제기 (jegi) · crafts · uncommon — A bundled feather shuttlecock: warm-grey coin base (`text.muted`) with 4 cream feathers radiating up from a `theme.rites` purple wrap.
- `card:kite` · 연 (yeon) · crafts · uncommon — A diamond kite in cream with a `theme.crafts` blue border, central round hole in the middle, painted with a small tiger face. Two tassels hanging.
- `card:top` · 팽이 (paengi) · crafts · common — A wooden spinning top mid-spin (motion lines suggesting rotation), cream body with a dancheong-orange stripe band. Soft floor shadow.
- `card:pottery` · 청자 (cheongja) · crafts · rare — A round-bellied celadon vase in muted `theme.nature` green with a flowing crackle pattern (thin darker lines in `text.muted`). Single curved crane shape etched lightly on the side.
- `card:gayageum` · 가야금 (gayageum) · crafts · legendary — A horizontal long zither in warm `theme.crafts` blue-tinted wood, 12 cream strings stretched along the body, two small movable bridges. Subtle glow around the strings suggesting sound.

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
culture cards in Hangul Route (Korean learning app for kids 5–11).

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

- Stage 2–7 cards (separate brief per stage when content lands)
- Animated card-reveal sequences (separate animation brief)
- Print-quality high-DPI exports (deferred until parents request physical merch)
