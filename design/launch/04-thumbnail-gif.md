# 04 — PH Thumbnail GIF (5 frames, 1.5s loop)

**Maps 1:1 to [`docs/launch/gallery-spec.md`](../../docs/launch/gallery-spec.md)
Bonus section.**

PH shows the thumbnail at ~60 × 60 px in the feed. A *moving* thumbnail
(card snapping into a slot) is the highest stop-scroll pattern we have
without crossing into "is this an ad?" territory.

> Claude Design renders **5 static frames**. The GIF assembly happens in
> ffmpeg (one line) or in any GIF editor. The brief includes the ffmpeg
> command at the bottom.

---

## 1. Frame design grid

All 5 frames share the same camera, lighting, and palette. Only the
animated elements change. Output each as 240 × 240 PNG, sRGB,
transparent background (the GIF will compose on a dancheong field).

| Frame | t (loop time) | Held for | What's on screen |
|---|---|---|---|
| 1 — empty | 0.0s | 0.30s | Empty card silhouette in a single grid slot. No motion. |
| 2 — incoming | 0.40s | 0.10s | A heritage card flying in at 30° from off-canvas top-right, ~60% scale, slight rotation. |
| 3 — snap | 0.55s | 0.20s | The card snapped into the slot, full color, with a tiny burst of 4 cream sparkles around it. |
| 4 — paw print | 0.85s | 0.20s | The sparkles gone; a small dancheong paw print appears beside the card. |
| 5 — settle | 1.10s | 0.40s | The paw fades to 60% opacity. The card sits still. Loop returns to frame 1 at 1.50s. |

A single GIF cycle: **1.5s total**. Loops indefinitely.

---

## 2. Shared canvas spec (paste once)

```
All five frames share this canvas:

Output: 240 × 240 PNG, sRGB, transparent background.
Center the subject; safe zone is the inner 200 × 200 px (PH crops a
soft mask).

Background (when composed into the final GIF): dancheong orange #E8743B
with a subtle 4% hanji paper-fiber texture, and a thin cream ring
(#FCF8F1, 6px) inset 10px from the edge — same field as the PH
thumbnail when standing still (see `design/brief/launch-assets.md` §6).

But the RAW PNGs from Claude Design must be TRANSPARENT background so
the GIF assembly can lay them on the orange field cleanly. Draw only
the foreground subject described in each frame prompt.

Style: hand-painted geometric minhwa, ~5px stroke (one notch lighter
than the standard 6px so it reads at 60px), warm-black #2A1F14
outlines.

Anti-patterns: text of any kind, pure black, motion-line streaks,
photo-real chrome, drop shadows.
```

---

## 3. Frame prompts

### Frame 1 — empty slot

```prompt
Frame 1 of 5 of the PH thumbnail GIF.

Subject: a single Heritage Card slot, empty. Drawn as a rounded square
~140 × 200 px (card aspect ratio), positioned centered on the 240 × 240
canvas. Slot is a dashed outline:
- Dash: 6px, gap: 4px
- Color: surface.sunken #F2EBDE (a quiet, expectant frame)
- Inside the dashed outline: nothing — full transparency.

Above the slot, a tiny "?" mark? — NO. No glyph. The empty slot itself
is the icon for "something is coming."

Anti-patterns: no card visible, no fill inside the slot, no text.

Deliverable: 240 × 240 PNG, transparent background, frame 1.
```

**Output**: `design/launch/__output__/thumbnail-gif/frame-01-empty__v1__YYYY-MM-DD.png`

### Frame 2 — incoming card

```prompt
Frame 2 of 5 of the PH thumbnail GIF.

Subject: a Heritage Card flying in from the TOP-RIGHT, captured mid-
flight at ~60% of its final scale.

- Card is the puppy card (`card:gangaji`) — common rarity, brown puppy
  illustration inside, common border color #8A7860.
- Position: card center at (180, 80) of the 240 × 240 canvas (upper-
  right area, but still fully visible).
- Rotation: 25° clockwise from upright.
- Scale: ~60% of the final card size in frame 3.
- A faint cream "trail" curve behind the card (cream #FCF8F1, 20%
  opacity, 12px stroke), suggesting the path it came from. Single curve,
  ~60px long, no streak particles.

Behind the card, KEEP the empty slot from frame 1 visible (same
dashed outline at the same position) — this is the slot the card is
about to fill.

Anti-patterns: motion blur, multiple trail particles, the card
overlapping out of the canvas.

Deliverable: 240 × 240 PNG, transparent background, frame 2.
```

**Output**: `design/launch/__output__/thumbnail-gif/frame-02-incoming__v1__YYYY-MM-DD.png`

### Frame 3 — snap (the money frame)

```prompt
Frame 3 of 5 of the PH thumbnail GIF. This is the visual hero of the
GIF.

Subject: the puppy Heritage Card SNAPPED into the slot at full scale,
upright (0° rotation), centered at (120, 120) of the 240 × 240 canvas.

- Card: 140 × 200 px, common rarity (border #8A7860, 3px solid), cream
  #FCF8F1 fill, hand-painted puppy illustration centered inside
  (~70% of card area), no text, no romanization — at 60px this would
  be unreadable.
- Around the card, FOUR cream #FCF8F1 sparkles, each a soft 4-pointed
  star ~20px wide, placed at 45° intervals (NE, NW, SE, SW corners,
  10–15 px outside the card edge).
- Sparkles at 90% opacity.

The card is FULLY visible — no transparency, no motion blur. This is
the held frame.

Anti-patterns: dashed slot outline still visible (the slot is now
filled), motion lines, more than 4 sparkles.

Deliverable: 240 × 240 PNG, transparent background, frame 3.
```

**Output**: `design/launch/__output__/thumbnail-gif/frame-03-snap__v1__YYYY-MM-DD.png`

### Frame 4 — paw print appears

```prompt
Frame 4 of 5 of the PH thumbnail GIF.

Subject: same as frame 3 (puppy card centered in its slot at full
scale, no rotation), BUT:

- The four cream sparkles from frame 3 are GONE.
- A small dancheong-orange #E8743B paw print appears at position (60,
  60) of the 240 × 240 canvas — top-left of the card, slightly
  overlapping the card's top-left corner.
- Paw print: ~32 × 32 px, classic tiger paw silhouette (one main pad
  + 4 small toe pads), all in #E8743B, no outline.

The paw print is at 100% opacity in this frame.

Anti-patterns: sparkles still showing, paw print drawn with a black
outline, paw print not overlapping the card.

Deliverable: 240 × 240 PNG, transparent background, frame 4.
```

**Output**: `design/launch/__output__/thumbnail-gif/frame-04-paw__v1__YYYY-MM-DD.png`

### Frame 5 — settle

```prompt
Frame 5 of 5 of the PH thumbnail GIF.

Subject: same as frame 4, BUT the paw print has faded to 60% opacity.
Nothing else changes. The card stays. The settle.

The next frame in the loop will be frame 1 again (empty slot) — so the
GIF should feel like the puppy card vanishes briefly between cycles
(natural blink) before the next card flies in. This frame's faded paw
print primes that transition.

Anti-patterns: any movement of the card, repositioning the paw print,
changing the opacity to anything other than 60%.

Deliverable: 240 × 240 PNG, transparent background, frame 5.
```

**Output**: `design/launch/__output__/thumbnail-gif/frame-05-settle__v1__YYYY-MM-DD.png`

---

## 4. GIF assembly

After Claude Design returns the five frames, composite them on the
dancheong orange field and assemble into a GIF with one ffmpeg
command. Run from the repo root:

```bash
cd design/launch/__output__/thumbnail-gif

# Step 1 — composite each transparent PNG onto the dancheong field.
# (skip if you exported with the field baked in)
for f in frame-0?-*.png; do
  convert -size 240x240 xc:'#E8743B' "$f" -composite -density 144 \
    "_composed_${f}"
done

# Step 2 — assemble the loop with per-frame holds matching the table in §1.
ffmpeg -y \
  -loop 1 -t 0.30 -i _composed_frame-01-empty__*.png \
  -loop 1 -t 0.10 -i _composed_frame-02-incoming__*.png \
  -loop 1 -t 0.20 -i _composed_frame-03-snap__*.png \
  -loop 1 -t 0.20 -i _composed_frame-04-paw__*.png \
  -loop 1 -t 0.40 -i _composed_frame-05-settle__*.png \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0,fps=20[v]" \
  -map "[v]" -loop 0 thumbnail__v1.gif

# Verify size — PH cap is 800KB.
ls -lh thumbnail__v1.gif
```

If the file exceeds 800 KB:
- Reduce to 16 fps instead of 20.
- Use `gifsicle -O3 --colors 64 thumbnail__v1.gif -o thumbnail__v1.opt.gif`.
- Last resort: drop frame 5 entirely (still loops correctly, just less
  graceful).

---

## 5. Acceptance checklist

- [ ] All 5 PNG frames at 240 × 240, transparent.
- [ ] Assembled GIF is **1.5 s** total (verify with `gifsicle --info`).
- [ ] Loops forever (`-loop 0`).
- [ ] File size ≤ 800 KB.
- [ ] At 60 × 60 px scale (the actual PH feed size), the card → snap
      → paw sequence is still legible. Pull the GIF into a 60×60 box
      in Figma and watch from arm's length.
- [ ] No text visible in any frame.
- [ ] Final GIF saved to
      `design/launch/__output__/thumbnail-gif/thumbnail__v1.gif`.
- [ ] Session block logged in `design/prompts.md`.

## 6. Reuse beyond PH

The same 5 frames + a few variants can be re-purposed:
- **Twitter/X card unlock GIF**: same 5 frames, scaled to 480 × 480.
- **TikTok hook**: replace frame 3's card with the legendary tiger card
  (`card:horangi`). Same composition, same animation. Stronger stop.
- **Email signup confirmation animation**: same 5 frames inline at the
  top of the welcome email.

If you ship the GIF once, it earns its keep four times.
