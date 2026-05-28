# 01 — Hoya Three-Pose Mini Pack

**For PH launch only.** A focused 3-pose set + 1 amber-bubble variant
that the gallery, video, and FAQ rely on.

Inherits everything from
[`design/brief/character/hoya-character-sheet.md`](../brief/character/hoya-character-sheet.md).
That brief produces the canonical 5-pose sheet (waving, idle, thinking,
cheering, reading). **This pack adds three poses + one bubble variant**
the launch artifact pack specifically calls out.

> Run this **after** the 5-pose sheet from `design/brief/character/` is
> locked. The 3 poses below must match that sheet's anatomy, palette, and
> stroke weight exactly — they are not redrawn from scratch, they are
> *iterated*.

---

## 1. Why these specific poses

| Pose | Used by | Why it has to exist |
|---|---|---|
| **idle (relaxed, neutral)** | Gallery slide 1, video shots 1–3, app icon backup | The "resting state" face. The cover image of the PH gallery sits Hoya in idle. |
| **cheer (both paws up, mouth open in a soft round 'O')** | Gallery slide 4, video shot 6, card-unlock celebration | The reward moment. PH commenters will quote this image. |
| **curious (head tilted, one ear up, paw to chin)** | Gallery slide 5, video shots 8–9, parent-handoff section | The "is this for me?" face. Parents see themselves in it. |
| **amber-bubble variant (idle pose + a 거의! speech bubble in amber)** | Gallery slide 4 *centerpiece*, FAQ section "Hoya never says wrong" | The single most-shareable image in the launch. The product's thesis in one frame. |

---

## 2. Universal Hoya inputs (must hold across all 3 poses)

Before running any pose, paste these inputs into the Claude Design
session **after** the universal palette rules in `README.md`:

```
Hoya is a young tiger, 4–6 years old in tiger years, kid-energy.
Body proportions (locked, from design/brief/character/hoya-character-sheet.md):
- Big round head (~52% of body height), big round eyes, soft "U" smile
  (never visible teeth, never open jaw on idle/curious).
- Belly cream patch covering chest + face center; fur gold above; stripes
  are 3–4 soft tapered shapes on each cheek, arms, and tail tip.
- 4 fingers per paw, rounded paw pads in soft pink #F8B4B4.
- Tail: short, curved, single soft taper, gold + 1 stripe near tip.
- Whiskers: 3 per side, thin (#2A1F14), faint.
- Cheeks: soft pink #F8B4B4 oval blush.

Materials & stroke (locked):
- Hand-painted geometric minhwa, ~6px stroke with slight hand wobble.
- All corners ≥ 8px radius. No sharp teeth, claws, or angles.
- Shadows: a single soft warm radial shadow under the feet only.
- Background: transparent PNG. The canvas color goes on the composite,
  not the character file.
```

---

## 3. Prompt — Hoya **idle** pose

```prompt
Generate a single PNG illustration of Hoya the tiger in the IDLE pose.

Output: 1024 × 1024 PNG, transparent background, character fills ~78% of
the canvas height, vertically centered, looking slightly off-camera 5°
to the right (warm, not deer-in-headlights).

Pose specifics:
- Standing upright on both hind paws, full body visible.
- Arms relaxed at sides, slight bend at elbow, paws open and facing the
  viewer.
- Head straight, mouth a soft closed "U" smile (~80° arc, no teeth, no
  tongue).
- Eyes: ~32% wider than tall, both pupils round, looking *forward*
  (not down).
- Tail visible behind the right hip, gently curved upward.
- Weight on both feet — symmetric, restful.

Palette: Hoya tokens only (fur #F2B33D, shading #B5862A, stripes #2A1F14,
belly #FCF8F1, nose #2A1F14, cheek #F8B4B4).

Mood: alert but not eager. The first impression face. A child should feel
"this tiger is safe."

Anti-patterns: do NOT show teeth, do NOT make the eyes anime-sparkle,
do NOT add a drop shadow, do NOT pose Hoya from 3/4 — keep him front-on.

Deliverable: 1024 × 1024 PNG, transparent, Hoya idle pose.
```

**Output path**: `design/launch/__output__/hoya/idle__v1__YYYY-MM-DD.png`

---

## 4. Prompt — Hoya **cheer** pose

```prompt
Generate a single PNG illustration of Hoya the tiger in the CHEER pose.

Output: 1024 × 1024 PNG, transparent background, character fills ~82% of
the canvas height, vertically centered, looking directly at the camera.

Pose specifics:
- Standing upright, BOTH paws raised above the head, elbows wide.
- Each paw open, palms facing the viewer, fingers spread softly.
- Head straight, mouth open in a SOFT ROUND "O" (~30% face width) — never
  showing teeth, no tongue, no scream-shape. The corners of the mouth
  curve UP, not flat.
- Eyes squeezed slightly happy (~70% the height of the idle pose), tiny
  joy-curve at the bottom of each eye (an upward arc, like a flipped
  smile).
- Tail visible behind, curved sharply upward in an excited "S".
- Hind paws slightly off the ground (toe-tips touching, "almost a
  jump").
- A few (3–4) tiny dancheong-orange #E8743B 4-pointed sparkles around
  the head, ~24px each.

Palette: Hoya tokens + #E8743B for the sparkles. NOTHING else.

Mood: earned joy, the moment a card snaps in. Quiet, warm, a 3-year-old's
laugh — not a confetti explosion.

Anti-patterns: do NOT show open jaw / teeth, do NOT add confetti, do NOT
add motion-lines, do NOT use yellow or neon for the sparkles.

Deliverable: 1024 × 1024 PNG, transparent, Hoya cheer pose.
```

**Output path**: `design/launch/__output__/hoya/cheer__v1__YYYY-MM-DD.png`

---

## 5. Prompt — Hoya **curious** pose

```prompt
Generate a single PNG illustration of Hoya the tiger in the CURIOUS pose.

Output: 1024 × 1024 PNG, transparent background, character fills ~76% of
the canvas height, vertically centered, head tilted 15° to the LEFT
(viewer's right).

Pose specifics:
- Standing upright on both hind paws.
- Right paw raised to chin (paw-pad showing), index "finger" gently
  touching lower lip.
- Left paw on hip.
- Head tilted 15° to the LEFT from the character's POV, RIGHT from
  viewer's POV.
- One ear (the higher one) perked up, the other relaxed.
- Eyebrows (use 2 small stripe-shapes above each eye) slightly raised
  in a soft "thinking" expression.
- Mouth: tiny closed "v" — not a smile, not a frown, the universal
  "hmm?" mouth.
- Eyes wide open, pupils slightly LOOKING UP (toward the source of
  curiosity).

Palette: Hoya tokens only.

Mood: "wait, what is this?" — open, not skeptical. The face a parent
makes when their kid hands them a phone.

Anti-patterns: do NOT make the brow look angry (eyebrows must arc UP),
do NOT have Hoya look DOWN (he always looks up or forward), do NOT
show teeth.

Deliverable: 1024 × 1024 PNG, transparent, Hoya curious pose.
```

**Output path**: `design/launch/__output__/hoya/curious__v1__YYYY-MM-DD.png`

---

## 6. Prompt — Hoya **amber bubble** variant (the centerpiece)

```prompt
Generate the "Hoya never says wrong" centerpiece image.

Output: 1280 × 1280 PNG (square — for cropping into gallery slide 4).
Background fully filled: feedback.nudgeLight #FCEED1, with a subtle 4%
hanji paper-fiber texture.

Composition:
- Hoya in the IDLE pose (see §3), positioned LEFT-CENTER of the canvas,
  occupying ~52% of canvas height. Right paw raised about 30° in a soft
  wave, palm facing viewer.
- To the RIGHT of Hoya, a hand-drawn speech bubble (cream #FCF8F1 fill,
  warm-black #2A1F14 outline at ~5px stroke). Bubble points to Hoya's
  mouth with a soft rounded triangle (no sharp point).
- Inside the bubble, on three lines, centered horizontally:
    Line 1 — "거의!"           in #2A1F14, 96sp display weight 700
    Line 2 — "geo-eui"         in #5C4A36, 28sp italic
    Line 3 — "(almost — try once more)" in #5C4A36, 24sp regular
- Above the bubble, a small dancheong-orange #E8743B paw-print mark
  (~36px) — the "no red" badge.

Palette: #FCEED1 background, #FCF8F1 bubble, #2A1F14 outlines and Korean
text, #5C4A36 secondary text, #E8743B paw mark, + Hoya tokens.

Mood: the entire product thesis in one image. Warm, gentle, the moment
a kid hears "almost!" instead of "wrong."

Anti-patterns: do NOT use red anywhere (the literal point of this image),
do NOT use a yellow harsher than #FCEED1, do NOT use Comic Sans or any
casual handwritten font, do NOT add any English-only word that doesn't
have romanization next to it.

Deliverable: 1280 × 1280 PNG amber-bubble centerpiece.
```

**Output path**: `design/launch/__output__/hoya/amber-bubble__v1__YYYY-MM-DD.png`

---

## 7. Iteration parameters

If a pose comes back wrong, change ONE of these per iteration — never two
at once:

| Knob | Default | Stretch values |
|---|---|---|
| Head size | 52% of body | 48% (more grown-up) ↔ 56% (more chibi) |
| Eye round-ness | 100% round pupils | 80% (oval) — never use anime-sparkle |
| Stripe count per cheek | 3 | 2 (cleaner) ↔ 4 (more tiger) |
| Stroke wobble | "slight" | "smooth" ↔ "noticeable" |
| Pose energy | as specified | "calmer 10%" ↔ "more eager 10%" |

Log every iteration in `design/prompts.md` with what you changed and why.

---

## 8. Acceptance checklist (this pack)

- [ ] All 3 poses + bubble variant share the SAME Hoya (compare
      side-by-side: same eye spacing, same belly patch shape, same tail
      curvature).
- [ ] No teeth visible in any pose (cheer's "O" is closed, not open jaw).
- [ ] Every pose readable at 96 × 96 px (the smallest place we'll show
      Hoya — e.g. a chat avatar).
- [ ] amber-bubble image: the word "거의!" sits visually higher than
      "geo-eui" sits higher than "(almost — try once more)" — a clear
      three-tier hierarchy.
- [ ] No red anywhere in any of the 4 images.
- [ ] Each output saved at the path in its prompt block.
- [ ] Session logged in `design/prompts.md` with date + iteration count.
