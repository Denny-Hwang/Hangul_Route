# 02 — PH Gallery (5 Slides)

**Maps 1:1 to [`docs/launch/gallery-spec.md`](../../docs/launch/gallery-spec.md).**
This is the deck Product Hunt shows above the fold.

Inherits the universal palette + style rules from
[`./README.md`](./README.md) — paste them into the Claude Design session
before running any of the five prompts below.

> ⚠️ **Difference from `design/brief/launch-assets.md` §5**: that file
> defines a 6-slide PH gallery from the original 12-week playbook. This
> file uses the **5-slide v2** spec the post-review (May 2026) launch
> pack actually ships. Use this one for the PH D-14 sprint. Keep §5 of
> the legacy brief as fallback only.

---

## Universal slide template

All 5 slides share this base. Mention it explicitly in every individual
prompt so Claude Design re-anchors each time.

```
Output: 1280 × 720 PNG (PH gallery ratio, landscape).
Color profile: sRGB. File size: < 2 MB.
Background: hanji canvas #FCF8F1 with subtle 4% paper-fiber texture and
a soft dancheong-light #FAD9C6 radial glow in the top-left corner
(~30% of canvas, 18% opacity falloff).

Layout grid (overlay reference only — do not draw):
- 12-column grid, 64px gutter, 80px outer margin.
- Caption band at bottom-left occupies columns 1–7, rows 9–12.
- Visual subject occupies columns 4–12 (or 5–12 for narrower subjects),
  rows 1–10.

Typography:
- Caption: text-primary #2A1F14, 40sp weight 700, friendly sans, max 2
  lines, line-height 1.15.
- Subtitle (if any): text-secondary #5C4A36, 22sp weight 500, max 1 line.

Anti-patterns: pure white background, pure black text, neon, cramped
text, more than 2 lines of caption, drop-shadow gradients, AI-watermark
artifacts in corners.
```

---

## Slide 1 — Hero: Heritage Journey grid

**Caption** (bottom-left, on hanji canvas, two lines):
> 7 stages × 5 themes.
> Your child draws the route.

```prompt
Render PH gallery slide 1 of 5 for Hangul Route.

[Use the universal slide template above.]

Visual subject (right 60% of canvas):

A 7-column × 5-row grid of rounded-square tiles, drawn in hand-painted
geometric minhwa style. Tiles are ~80 × 80 px each with 12px gaps. The
grid sits on canvas #FCF8F1, slightly rotated 3° clockwise for warmth.

- Stage 1 column (leftmost column of 5 tiles): all 5 tiles in dancheong
  orange #E8743B fill, each containing a tiny preview of a Stage 1
  heritage card. Use cards: puppy (강아지), butterfly (나비), full moon
  (보름달), ramen (라면), tiger (호랑이). Each preview is a simple
  ~36px illustrated icon, no text.
- Stages 2–7 columns: tiles in surface.sunken #F2EBDE, slightly faded
  (60% opacity). Each shows a tiny lock glyph (~16px) in
  border.subtle #E8DFCD.
- A wavy "route" line, ~5px warm-black #2A1F14 stroke with slight hand
  wobble, drawn THROUGH the 5 Stage-1 tiles top-to-bottom, ending in a
  small dancheong paw-print just past tile 5.
- Bottom-right corner: Hoya in the IDLE pose (see
  `01-hoya-three-poses.md` §3), ~140px tall, looking up-and-left toward
  the grid.

Theme column labels (small caps, 14sp, #8A7860) above each column:
LETTERS · LIFE · RITES · NATURE · CRAFTS.
Stage row labels (rotated 90° CCW, 14sp, #8A7860) left of each row:
Hangul · Words · Sentences · Dialogue · Stories · Real-use · Self-
expression.

Caption band (bottom-left):
- Line 1: "7 stages × 5 themes."
- Line 2: "Your child draws the route."

Palette only: #FCF8F1 #FAD9C6 #E8743B #F2EBDE #E8DFCD #2A1F14 #5C4A36
#8A7860 + Hoya tokens.

Anti-patterns: do NOT label any tile with English/Korean text inside the
tile itself (only the 36px icon). Do NOT use Duolingo green. Do NOT
straighten the grid to 0° — the 3° tilt is the warmth marker.

Deliverable: 1280 × 720 PNG, PH gallery slide 1.
```

**Output path**: `design/launch/__output__/gallery/01-hero__v1__YYYY-MM-DD.png`

---

## Slide 2 — Card Collection grid

**Caption**:
> 24 Heritage Cards in Stage 1.
> One Korea, one child at a time.

```prompt
Render PH gallery slide 2 of 5 for Hangul Route.

[Use the universal slide template above.]

Visual subject (right 60% of canvas):

A 6-column × 4-row grid of Heritage Cards. Each card is ~140 × 200 px
(portrait), 12px gap, slight 2° rotation alternation (-2°, +2°, -2°…)
for a hand-laid feel.

Card structure (every card identical structure, contents vary):
- Outer border 3px solid in the rarity color (see palette below).
- Inner cream #FCF8F1 fill with a 4% hanji texture.
- Top: the Korean glyph (~32sp, warm-black #2A1F14) and tiny rarity
  label (10sp small caps in the same rarity color).
- Center: a small hand-painted illustration (~60% of card area).
- Bottom: romanization (16sp, #5C4A36) + English title (18sp weight
  600, #2A1F14).

Cards to fill in (left-to-right, top-to-bottom), 12 unlocked + 12
silhouetted:

Row 1: 강아지 puppy (common), 나비 butterfly (common), 보름달 full moon
       (uncommon), 라면 ramyeon (common), 무궁화 rose of Sharon (rare),
       호랑이 tiger (legendary)
Row 2: 밥 bap (common), 사과 sagwa (common), 인형 doll (common),
       잠자리 dragonfly (common), 책 book (common), 케이팝 K-pop (rare)
Row 3: 12 silhouetted card outlines (cream fill, dashed #C5B8A1 border).

Row 4: 12 silhouetted card outlines.

Rarity border colors:
- common #8A7860 · uncommon #7BB552 · rare #4A9DD6 · legendary #E8743B

Legendary tiger (row 1, last card) has a soft amber glow ring (~6px,
#F2B33D, 30% opacity) outside the orange border to mark its rarity.

Caption band (bottom-left):
- Line 1: "24 Heritage Cards in Stage 1."
- Line 2: "One Korea, one child at a time."

Palette only: #FCF8F1 #FAD9C6 + the 4 rarity tokens + #2A1F14 #5C4A36
#8A7860 #C5B8A1 + Hoya/illustration tokens.

Anti-patterns: do NOT use gold/silver border treatments (the rarity
border is the rarity). Do NOT animate or add motion lines. Do NOT
illustrate the silhouettes — they are blank outlines only.

Deliverable: 1280 × 720 PNG, PH gallery slide 2.
```

**Output path**: `design/launch/__output__/gallery/02-cards__v1__YYYY-MM-DD.png`

---

## Slide 3 — Mini-game collage

**Caption**:
> 9 mini-games.
> None of them feel like school.

```prompt
Render PH gallery slide 3 of 5 for Hangul Route.

[Use the universal slide template above.]

Visual subject (right 60% of canvas):

A 3 × 3 grid of small phone-screen mockups (~200 × 360 px each in
portrait), tilted alternately at -4°, 0°, +4° per cell, with 16px
gaps. Each phone has rounded device corners (radius 28px), no notch
detail (kept simple).

Each mini-game screen content (top-to-bottom, left-to-right):

1. **Match Sound** (theme letters #E8743B accent)
   - Big jamo ㄱ in center (~120sp), warm-black.
   - Three answer tiles below (small squares with ㄱ, ㄴ, ㄷ).
   - Hoya thumbnail bottom-right with speech bubble: "Tap /g/!"

2. **Trace Stroke** (theme crafts #4A9DD6 accent)
   - Big ㄴ shape with a dotted stroke-order path.
   - Finger-trail (cream blob fade) showing the trace start.
   - Small star row (1 of 3 lit) at the bottom.

3. **Build Letter** (theme crafts #4A9DD6 accent)
   - Two draggable jamo strokes at the bottom.
   - A target slot showing ㄷ outline at top.
   - One stroke mid-drag (slightly translucent).

4. **Card Match** (theme nature #7BB552 accent)
   - 6 face-down cards in 2 rows.
   - Two cards flipped showing matching 사과 / Apple.
   - A small success-green check ✓ between them.

5. **Culture Quiz** (theme rites #8265C2 accent)
   - Prompt "Which one is a tiger?" at top.
   - Three small illustrations below: tiger, rabbit, fox.
   - 10-second timer ring (amber #F2B33D, 70% remaining).

6. **Tap Respond** (theme letters #E8743B accent)
   - A small rabbit illustration mid-hop across the screen.
   - Big tap target (amber #F2B33D circle).
   - Caption "Tap when you hear /to/" (18sp).

7. **Odd One Out** (theme letters #E8743B accent)
   - Four jamo tiles: 사과, 배, 포도, 자동차 (apple, pear, grape, CAR
     — the odd one).
   - One tile (자동차) highlighted with amber border.

8. **Story Sequence** (theme rites #8265C2 accent)
   - Three illustrated panels (Hoya wake / Hoya eat / Hoya sleep) in a
     row.
   - One panel in mid-drag, dotted outline showing target slot.

9. **Hoya prompt cell** (no game — fills the 9th slot)
   - Small Hoya cheer pose (see `01-hoya-three-poses.md` §4).
   - Caption: "Pick one!" in a cream bubble.

Caption band (bottom-left):
- Line 1: "9 mini-games."
- Line 2: "None of them feel like school."

Palette: full palette allowed (we touch all 5 theme accents).

Anti-patterns: do NOT use real device chrome (Apple/Android logos). Do
NOT draw a status bar with real time. Do NOT use a 4×3 grid — it has
to be 3×3 to fit the rhythm.

Deliverable: 1280 × 720 PNG, PH gallery slide 3.
```

**Output path**: `design/launch/__output__/gallery/03-minigames__v1__YYYY-MM-DD.png`

---

## Slide 4 — Hoya feedback moment (the thesis)

**Caption**:
> Hoya never says "wrong."
> He says "거의!" — almost.

```prompt
Render PH gallery slide 4 of 5 for Hangul Route.

[Use the universal slide template above — but override the background:]
Background fully filled feedback.nudgeLight #FCEED1 (not the canvas).
This is the ONE slide that breaks the canvas rule, because the amber
field IS the message.

Visual subject (full canvas, centered):

- The Hoya amber-bubble centerpiece from
  `01-hoya-three-poses.md` §6, scaled to fit 720px tall, centered
  horizontally.
- TOP-LEFT corner: a 64 × 64 px red ❌ symbol (use #C84B3D, ONLY
  appearance in this entire launch pack), drawn small, then a 6px
  warm-black #2A1F14 slash struck THROUGH it diagonally. A tiny label
  next to it: "Never this." (14sp, #5C4A36).
- TOP-RIGHT corner: a 48 × 48 px amber star (#F2B33D), and a label
  next to it: "Always this." (14sp, #5C4A36).

Caption band (bottom-left, on top of the amber background):
- Line 1: "Hoya never says \"wrong.\""
- Line 2: "He says \"거의!\" — almost."

Palette: #FCEED1 background, #2A1F14 #5C4A36 #F2B33D, the controlled
#C8B43D for the crossed-out X symbol, + Hoya tokens.

The red is INTENTIONAL on this slide and ONLY on this slide. It is the
crossed-out red — the visual representation of the design principle.
Without the X-through-it, the slide would violate our own rule. Render
it small and crossed.

Anti-patterns: do NOT render the red X without the slash through it.
Do NOT enlarge the X past 64px. Do NOT use any other red anywhere on
the slide.

Deliverable: 1280 × 720 PNG, PH gallery slide 4.
```

**Output path**: `design/launch/__output__/gallery/04-hoya-feedback__v1__YYYY-MM-DD.png`

---

## Slide 5 — Parent handoff

**Caption**:
> 5 minutes. One quest. One card.
> Made for tired parents.

```prompt
Render PH gallery slide 5 of 5 for Hangul Route.

[Use the universal slide template above.]

Visual subject (right 60% of canvas):

Two-tier composition.

Top tier (top 55% of subject area):
- A LARGE adult hand (warm beige #E8C5A6 with a soft outline) entering
  from the left, palm down, fingers extended.
- A SMALL child hand (slightly lighter warm beige #F0D5B8) entering
  from the right, palm up.
- BETWEEN them, suspended mid-air, a stylized phone (~180 × 320 px) in
  portrait, screen facing viewer.
- The phone screen shows the Hoya idle pose with a speech bubble:
  "Annyeong! Ready?" (cream bubble with romanization shown).
- Both hands are abstract / flat illustration, NOT photo-real, NOT
  detailed enough to read race or age beyond "adult ↔ child."

Bottom tier (bottom 45% of subject area):
- A horizontal timeline bar, ~520px wide, 24px tall, with rounded
  ends.
- Bar fill: dancheong orange #E8743B from 0% to 50% (half-progress).
- Bar background (remaining half): surface.sunken #F2EBDE.
- Three milestone markers along the bar, each with a small label
  below:
    0:00 — "Tap to start"     (#5C4A36, 14sp)
    2:30 — "Mini-game"        (#5C4A36, 14sp)
    5:00 — "Card earned"      (#5C4A36, 14sp)
- The 2:30 marker is currently active (small amber #F2B33D dot above
  it).

Below the timeline (small caption strip, 12sp, #8A7860, centered):
"No ads. No data sold. Plays offline."

Caption band (bottom-left of the SLIDE, not the subject):
- Line 1: "5 minutes. One quest. One card."
- Line 2: "Made for tired parents."

Palette: #FCF8F1 canvas, #FAD9C6 corner glow, #E8743B orange, #2A1F14
#5C4A36 #8A7860 text, #F2EBDE bar bg, #F2B33D amber active marker,
#E8C5A6 / #F0D5B8 hand tones, + Hoya tokens.

Anti-patterns: do NOT show real facial features or jewelry on hands.
Do NOT render the timeline at 100% (we want it mid-progress so the
parent can see the SHAPE of the session). Do NOT use a digital LCD
clock font — keep timestamps in the same friendly sans.

Deliverable: 1280 × 720 PNG, PH gallery slide 5.
```

**Output path**: `design/launch/__output__/gallery/05-parent-handoff__v1__YYYY-MM-DD.png`

---

## Acceptance checklist (gallery deck)

- [ ] All 5 slides at 1280 × 720, sRGB, < 2 MB each.
- [ ] All 5 slides share the same caption typography (40sp weight 700,
      #2A1F14, max 2 lines).
- [ ] Slides 1, 2, 3, 5 use the hanji canvas #FCF8F1 background. Slide 4
      uses #FCEED1 — the one principled exception.
- [ ] Red (#C84B3D) appears in slide 4 only, only inside the crossed-
      out symbol.
- [ ] Hoya appears in slides 1, 3, 4, 5 — and is the SAME Hoya across
      all four (compare anatomy side-by-side).
- [ ] No emoji in any rendered output (use real illustrations).
- [ ] Korean text is romanized inline where it appears (slides 2 and
      4).
- [ ] Each slide previewed on iPhone 14 and 13" MacBook before
      approval. Tile readability test: at 50% zoom, can a person 6 feet
      away identify the slide's topic?
- [ ] All 5 outputs saved to `design/launch/__output__/gallery/`.
- [ ] Session logged in `design/prompts.md`.
