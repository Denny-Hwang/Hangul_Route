# PH Gallery Spec — 5 images + 1 thumbnail GIF

All images **1280 × 720** unless noted. PNG, < 2 MB each. Color profile
sRGB. Background: `surface.canvas` `#FCF8F1` (warm hanji cream) — never
pure white.

Designer brief: if you cannot match the warm cream and dancheong orange
(see `design/tokens/colors.v1.md`), the asset is rejected.

---

## Image 1 — Hero: Heritage Journey grid

**Purpose**: this is the image people see *before* they click.

**Caption** (overlaid bottom-left, 28pt, `text.primary`):
> "7 stages × 5 themes. Your child draws the route."

**Composition**:
- Center-right (60% of frame): a 7×5 grid of rounded-square tiles.
  - Top-left tile (Stage 1 × Letters) glows with `brand.primary` orange.
  - 6 random Stage 1 tiles have a tiny heritage card peeking out
    (puppy 강아지, butterfly 나비, full moon 보름달, ramen 라면,
    rose of Sharon 무궁화, tiger 호랑이).
  - Remaining tiles soft `surface.sunken` cream, faded.
- Left third: a wavy "route" line drawn through the 6 unlocked tiles,
  ending in a 7th tile with a paw print (Hoya's tap).
- Bottom-right corner: Hoya the tiger, small, looking at the grid.

**Don't**: don't show the words "Duolingo" or "education." Don't show
adult learners.

---

## Image 2 — Card Collection grid

**Purpose**: the *promised reward*. The moment the brain says "I want
those."

**Caption**:
> "24 Heritage Cards in Stage 1. One Korea, one child at a time."

**Composition**:
- 6 × 4 grid of heritage cards on `surface.canvas`.
- 12 cards filled in (in color, illustrated), 12 silhouetted/locked.
- Filled cards (left-to-right, top-to-bottom):
  1. 강아지 (puppy) — common, soft brown
  2. 나비 (butterfly) — common, yellow + black
  3. 보름달 (full moon) — uncommon, deep blue night sky
  4. 라면 (ramen) — common, red-orange broth
  5. 무궁화 (rose of Sharon) — rare, pink with white center
  6. 호랑이 (tiger) — legendary, gold border
  7. 아리랑 (Arirang folk song) — rare, hanji scroll
  8. 태극기 (Korean flag) — rare, red/blue circle
  9. 팽이 (spinning top) — uncommon
  10. 윷놀이 (yutnori sticks) — rare
  11. 케이팝 (K-pop) — rare, microphone
  12. 그네 (swing) — uncommon
- Locked cards: subtle silhouette of a card outline only.

**Border treatment** by rarity (see `colors.rarity` tokens):
- common: muted brown `#8A7860`
- uncommon: green `#7BB552`
- rare: blue `#4A9DD6`
- legendary: dancheong orange `#E8743B`

---

## Image 3 — Mini-game collage

**Purpose**: prove there's substance behind the cute. Show 5 games at
once.

**Caption**:
> "8 mini-games. None of them feel like school."

**Composition**:
- 3×3 grid of phone screenshots (each ~250 × 540 px portrait), tilted
  slightly for a collage feel.
- Game screens to feature:
  1. **Match Sound** — Hoya plays /g/, child taps 'ㄱ' from 3 tiles
  2. **Trace Stroke** — finger trail showing how 'ㄴ' is drawn
  3. **Build Letter** — drag two strokes to form 'ㄷ'
  4. **Card Match** — flipping two cards to find 사과 / Apple
  5. **Quiz** — "Which one is a tiger?" with three pictures
  6. **Story Sequence** — three panels reordered into the right story
  7. **Tap Respond** — a moving rabbit, tap when you hear /토/
  8. **Odd One Out** — three Korean fruits + one wrong one
  9. (9th tile = small Hoya saying "Pick one!")

**Color**: each tile uses one `theme` accent (letters/life/rites/nature/
crafts) so the collage feels like a heritage rainbow.

---

## Image 4 — Hoya feedback moment

**Purpose**: communicate the *tone* of the product in one frame.

**Caption**:
> "Hoya never says 'wrong.' He says '거의!' — almost!"

**Composition**:
- Center: a phone screen mid-quest. A jamo prompt is visible, the
  child's last tap was incorrect.
- The whole screen is bathed in `feedback.nudgeLight` `#FCEED1` — the
  warm amber, **not red**.
- Hoya pops up bottom-right, paw raised, with a speech bubble:
  > "거의! (almost) Try once more 🐯"
- The "거의!" is in Korean, romanization "geo-eui!" tucked next to it.
- A small red X with a slash through it sits in the top-left corner —
  the *literal* anti-red mark, showing what the product refuses.

**Why this matters**: this is the most-shared screenshot in the PH
comment thread. People will quote-tweet this image.

---

## Image 5 — Parent handoff

**Purpose**: speak to the *buyer* (parent), not the user (child).

**Caption**:
> "5 minutes. One quest. Made for tired parents."

**Composition**:
- Top half: a parent's hand passing a phone to a child's hand
  (photo or illustration). The parent is mid-sentence, phone shows the
  Hoya intro screen.
- Bottom half: a horizontal "5-minute" timer bar, half filled, with
  three milestones:
  - "0:00 — Tap to start"
  - "2:30 — Mini-game"
  - "5:00 — Card earned"
- Small text bottom-right: "No ads. No data sold. Plays offline."

**Why**: PH's voters skew adult. Adults *buy* kids' apps. This frame is
for them.

---

## Bonus — Thumbnail GIF (240 × 240, ≤ 800 KB)

A 1.5-second loop:
1. Frame 1: An empty heritage card silhouette in a grid slot.
2. Frame 2 (0.4s in): The card flies in from off-screen at 30°.
3. Frame 3 (0.8s in): Card snaps into slot with a soft glow burst.
4. Frame 4 (1.0s in): Hoya's small paw print fades in beside it.
5. Frame 5 (1.5s in): Loops back to silhouette.

PH feed shows a small thumbnail next to the headline. A *moving* card-
snap is the highest stop-scroll pattern we have without crossing the
"is this an ad" line.

---

## Production checklist

- [ ] All 6 assets exported at 2× resolution (2560×1440 source)
- [ ] PNG/GIF, sRGB, < 2 MB each (< 800 KB for GIF)
- [ ] No emoji on actual app screenshots (use illustrated marks)
- [ ] Each image previewed on iPhone 14 and 13" MacBook before approval
- [ ] No Korean string appears without romanization in the same image
- [ ] No red on a child-fail surface (image 4 enforces this)
- [ ] Hoya's stripes are `#2A1F14` warm-black, never `#000000`
