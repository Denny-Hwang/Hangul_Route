# Launch & Store Assets — Claude Design Prompts

**The assets you need to ship, not to teach.** Everything in
`design/brief/character/`, `design/brief/illustrations/`, and
`design/brief/screens/` covers the *in-app* art. This file covers the
**store + launch** layer that App Store / Google Play / Product Hunt
require — and a compressed 4–6 week run order so you can drive it from
Claude Design yourself.

> Inherits all rules from [`00-visual-identity.md`](./00-visual-identity.md)
> §3 (color), §4 (type), §8 (illustration), §13 (acceptance checklist).
> When in doubt, that document wins.

---

## 0. What already exists (do not redo)

| Need | Where the prompt already lives |
|---|---|
| Visual identity sheet, hanji textures | `00-visual-identity.md` §10–§12 |
| Hoya 5-pose character sheet | `character/hoya-character-sheet.md` §8 |
| 30 Heritage cards (per-card briefs + template) | `illustrations/heritage-card-art.md` §4, §7 |
| Episode scene backgrounds | `illustrations/scene-backgrounds.md` |
| Components & screens | `prompt-library.md` Phase 3–4 |

This file adds only the **store + marketing** prompts that were missing.

---

## 1. App icon — iOS

Run **after** the Hoya character sheet is locked (the icon reuses Hoya's head).

```prompt
Create the iOS app icon for Hangul Route, a Korean learning app for kids 5–11.

Output: 1024 × 1024 PNG, full-bleed (iOS masks the corners), no transparency,
no text.

Composition:
- Background: warm dancheong orange — a gentle radial from #E8743B (center)
  to #B5562A (edges), with a subtle 4% hanji paper-fiber texture.
- Subject: Hoya the tiger's HEAD ONLY (idle/waving energy from the character
  sheet), centered, occupying ~62% of the canvas. Big round warm eyes, gentle
  "U" smile, 3–4 soft tapered stripes, small rounded ears, soft pink cheeks.
- A thin cream ring (#FCF8F1, ~12px) just inside the edge as a light frame.

Palette (ONLY these):
- Hoya: fur #F2B33D, shading #B5862A, stripes #2A1F14, belly/face #FCF8F1,
  cheeks #F8B4B4, nose #2A1F14
- Background: #E8743B / #B5562A, frame #FCF8F1

Style: hand-painted geometric minhwa, ~6px stroke with slight wobble, round
everything. The face MUST read clearly at 60 × 60 px — test small.

Anti-patterns: no text, no pure black (#000000), no sharp teeth, no anime
sparkle eyes, no neon, no busy background, no drop shadow.

Deliverable: 1024 × 1024 PNG iOS app icon.
```

## 2. App icon — Android adaptive

```prompt
Create an Android adaptive icon for Hangul Route as TWO layers.

Output: two 1024 × 1024 PNGs.
1. FOREGROUND (transparent background): Hoya's head only, centered inside the
   inner 66% safe zone (Android crops the outer ~33% on some launchers). Same
   Hoya palette and style as the iOS icon prompt above.
2. BACKGROUND (opaque): flat dancheong orange #E8743B with a subtle 4% hanji
   texture. No subject — just the warm field.

Both layers must align so that when composited the head sits centered. The
foreground must survive a circular, rounded-square, and squircle mask.

Anti-patterns: no foreground content outside the 66% safe zone, no text,
no pure black.

Deliverable: foreground.png (transparent) + background.png (opaque), 1024².
```

## 3. Splash / launch screen

```prompt
Create a mobile splash screen for Hangul Route.

Output: 1284 × 2778 PNG (iPhone 6.7"). Keep all content inside the centered
60% safe zone so it crops cleanly to any device.

Composition (centered, top-to-bottom):
- Full background: hanji cream #FCF8F1 with subtle 4% paper-fiber texture.
- Hoya in the WAVING pose (from the character sheet), ~360px wide.
- 32px gap, then wordmark "Hangul Route" in #2A1F14, 36sp display weight 700,
  friendly sans.
- 8px gap, then tagline "Korean, played not taught." in #5C4A36, 18sp.

Style: calm, warm, generous whitespace. Do NOT draw a loading spinner.

Anti-patterns: cold white background, pure black, busy pattern, edge-bleeding
content.

Deliverable: 1284 × 2778 PNG splash screen.
```

## 4. App Store / Play screenshots (frame template — run 5×)

These are the marketing frames (device mock + caption band). The live app
screen is composited in afterward; this prompt produces the **frame around
it**. Replace `{HEADLINE}` and `{SCREEN_HINT}`.

```prompt
Create an App Store screenshot frame for Hangul Route.

Output: 1290 × 2796 PNG (6.7" portrait).

Layout:
- Background: a soft vertical wash from dancheong light #FAD9C6 (top) to
  hanji cream #FCF8F1 (bottom), subtle 4% paper texture.
- Top 18%: caption band. Headline "{HEADLINE}" centered, #2A1F14, 40sp
  weight 700, max two lines, friendly sans. Generous side margins (80px).
- Center 70%: a floating iPhone device mockup (rounded screen, soft warm
  shadow — NOT a hard Material shadow) containing a placeholder app screen
  hinting at: {SCREEN_HINT}. Leave the screen area a clean cream rectangle
  with light wireframe shapes if no real capture is supplied.
- A small Hoya (waving, ~120px) peeking from the bottom-right corner.

Palette only: #FAD9C6 #FCF8F1 #E8743B #2A1F14 #5C4A36 + Hoya tokens.

Anti-patterns: cold white, pure-black shadows, neon, more than 2 lines of
headline, tiny text under 28sp.

Deliverable: 1290 × 2796 PNG marketing frame.
```

Run with these 5 parameter sets (order = App Store gallery order):

| # | `{HEADLINE}` | `{SCREEN_HINT}` |
|---|---|---|
| 1 | Korean for kids who don't speak it — yet | Home / Today: Hoya greeting + "Start quest" |
| 2 | Draw your own route through Korean | Journey grid (7 stages × 5 themes) |
| 3 | Five-minute quests, played not taught | Match Sound minigame mid-play |
| 4 | Collect 30 culture cards | Card unlock celebration (legendary card) |
| 5 | A grown-up is always in control | Parent dashboard / parent gate |

## 5. Product Hunt gallery (run 6×)

PH gallery slides are wider (landscape) and richer than store screenshots.
Frame template — replace `{HEADLINE}`, `{BODY}`, `{COMPOSITION}`.

```prompt
Create a Product Hunt gallery slide for Hangul Route.

Output: 1270 × 760 PNG (landscape, PH gallery ratio).

Layout:
- Background: hanji cream #FCF8F1 with a subtle 4% paper texture and a soft
  dancheong-light #FAD9C6 corner glow (top-left).
- Left 45%: text zone. "{HEADLINE}" in #2A1F14, 40sp weight 700 (max 2 lines).
  Below, "{BODY}" in #5C4A36, 20sp (max 2 lines).
- Right 55%: {COMPOSITION}.

Palette only: #FCF8F1 #FAD9C6 #E8743B #4A9DD6 #2A1F14 #5C4A36 + Hoya + card
rarity tokens (#8A7860 #7BB552 #4A9DD6 #E8743B).

Style: warm, generous, hand-painted geometric minhwa. Soft radial shadows
only.

Anti-patterns: cold white, pure black, neon, cramped text, more than 2 lines
per text block.

Deliverable: 1270 × 760 PNG.
```

Run with these 6 parameter sets:

| # | `{HEADLINE}` | `{BODY}` | `{COMPOSITION}` |
|---|---|---|---|
| 1 (hero) | From ㄱ to Chuseok | The only Korean app made for kids who don't speak it — yet. | Hoya waving (220px) + a fanned strip of 5 heritage cards below him |
| 2 | Your child draws their own route | 7 stages × 5 culture themes, as a map not a course. | A Journey grid: Stage 1 row lit in dancheong colors, Stages 2–7 dimmed with small lock icons |
| 3 | Played, not taught | Five-minute quests that fit a small attention span. | Match Sound minigame: a large jamo "ㄱ" prompt + four answer tiles, Hoya thinking pose bottom-left |
| 4 | Cards worth collecting | Earn a piece of Korean culture every quest. | A legendary card (Tiger or Gayageum) mid-flip with 3 amber sparkles |
| 5 | 30 cards. Stage 1. More monthly. | Kimchi, hanbok, Seollal, the gayageum… | A 5-column Library grid: some cards in color, some as cream lock silhouettes |
| 6 | Always proud. Never frowning. | Anti-shame design, from the first tap. | Hoya's 5 poses in a row (waving, idle, thinking, cheering, reading) |

## 6. Product Hunt thumbnail

```prompt
Create the Product Hunt thumbnail for Hangul Route.

Output: 240 × 240 PNG (PH shows it small — must read at 60px).

Composition: Hoya's head (waving energy) on a dancheong orange #E8743B field
with a 4% hanji texture, a thin cream ring near the edge. Essentially the iOS
app icon, re-cropped a touch tighter on the face.

Palette: Hoya tokens + #E8743B background + #FCF8F1 ring.

Anti-patterns: text, pure black, busy background.

Deliverable: 240 × 240 PNG.
```

---

## 7. Launch-priority run order (4–6 week track)

Compressed track for shipping Stage 1. Run top-to-bottom — each step unblocks
the next. (The full 12-week playbook is in `prompt-library.md`; this is the
"get to the App Store and Product Hunt" subset.)

| Order | Asset | Prompt source | Why it's first |
|---|---|---|---|
| 1 | Hoya 5-pose sheet | `character/hoya-character-sheet.md` §8 | Every screen, the icon, splash, PH, and the Tiger card all reuse it |
| 2 | Card art-language sheet | `illustrations/heritage-card-art.md` §6 | Locks the look before the 30 cards |
| 3 | Legendary + hero cards (Tiger, Gayageum, Hangul Day, Lantern) | `heritage-card-art.md` §7 ×4 | Needed for PH slide 4 + the most-shown cards |
| 4 | App icon (iOS + Android) | this file §1–§2 | App Store / Play submission blocker |
| 5 | Remaining 26 cards | `heritage-card-art.md` §7 ×26 | Completes the Library reward loop |
| 6 | PH gallery (6 slides) + thumbnail | this file §5–§6 | Product Hunt launch day |
| 7 | App Store screenshots (5) | this file §4 | Store listing |
| 8 | Splash screen | this file §3 | Final polish |

**Parallelizable**: steps 4 (icon) and 5 (cards) can run in parallel with a
second Claude Design thread, since the icon only needs the Hoya sheet (step 1).

---

## 8. Output paths

```
design/illustrations/launch/app-icon/ios__1024__v1__YYYY-MM-DD.png
design/illustrations/launch/app-icon/android-foreground__v1__YYYY-MM-DD.png
design/illustrations/launch/app-icon/android-background__v1__YYYY-MM-DD.png
design/illustrations/launch/splash__v1__YYYY-MM-DD.png
design/illustrations/launch/store/screenshot-{1..5}__v1__YYYY-MM-DD.png
design/illustrations/launch/product-hunt/slide-{1..6}__v1__YYYY-MM-DD.png
design/illustrations/launch/product-hunt/thumbnail__v1__YYYY-MM-DD.png
```

After generating, log each session in `design/prompts.md` (date + asset +
what you kept/dropped), per its existing format.

## 9. Acceptance checklist (store + launch)

- [ ] App icon reads clearly at 60 × 60 px (the real test)
- [ ] No text inside the app icon or PH thumbnail
- [ ] Only palette tokens from `00-visual-identity.md` §3 used
- [ ] No pure black (#000000) anywhere — use #2A1F14
- [ ] No red except dancheong orange (#E8743B) accents
- [ ] Hoya never frowns; thinking pose looks UP
- [ ] Headlines ≤ 2 lines, body text ≥ 28sp on store frames
- [ ] Android foreground stays inside the 66% safe zone
- [ ] Splash content inside the centered 60% safe zone
- [ ] Every output saved to the `design/illustrations/launch/...` paths above
