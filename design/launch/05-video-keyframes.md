# 05 — 30-Second Video Keyframes (10 stills)

**Maps 1:1 to [`docs/launch/video-storyboard-30s.md`](../../docs/launch/video-storyboard-30s.md).**

Claude Design renders **10 static keyframes**, one per shot in the
storyboard. The video edit happens in CapCut / Premiere / DaVinci by
crossfading and panning between these stills + recording the voiceover
+ adding the music bed.

> If you can later capture real device footage of the live app, splice
> it into shots 4–7 (the in-app moments). The keyframes here are the
> fallback that lets you ship the video even if the device capture
> falls through.

---

## 1. Universal frame spec

```
All 10 keyframes share this canvas:

Output: 1920 × 1080 PNG (16:9, horizontal). Also export a 1080 × 1920
crop (vertical) for TikTok/Reels — see §3 below.
Color profile: sRGB. Color depth: 8-bit per channel.

Style: same hand-painted geometric minhwa as the rest of the launch
pack. ~6px stroke with slight hand wobble. Generous whitespace.
Background: hanji canvas #FCF8F1 with subtle 4% paper-fiber texture
(except where otherwise noted).

Burned-in captions are NOT part of these keyframes — the captions
overlay in the editor as the burned-in subtitle track. Render the
PURE visual only.

Anti-patterns: pure white background, pure black, watermarks,
AI-style background blur, photo-real device chrome (use illustrated
phone outlines), real human faces (use hands-only or illustrated
silhouettes), brand logos other than Hangul Route's own.
```

---

## 2. Shot-by-shot prompts

### Shot 1 — "ABC came first" (0–3s)

```prompt
Render video keyframe 1 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- The frame is FADING IN from a warm-black #2A1F14 vignette (the outer
  ~12% of the canvas is darker, the center is full canvas brightness).
- Center: an illustrated child's hand (left-handed, palm up) holding a
  flat illustrated phone, screen facing the viewer.
- The phone screen shows the English alphabet — A, B, C, D, E… —
  drawn as a soft-pastel children's poster style, palette of cream
  #FCF8F1, soft pink #F8B4B4, dancheong-light #FAD9C6, secondary-light
  #CDE5F4. Letters in a friendly sans, ~28sp inside the phone.
- The phone occupies the lower-center, hand cropped at the wrist.

Mood: nostalgia, normal childhood. The "before" state.

Anti-patterns: real photo, identifiable faces, identifiable brand
typography (Comic Sans is fine, Apple SF is not).

Deliverable: 1920 × 1080 PNG, shot 1.
```

**Output**: `design/launch/__output__/video-keyframes/shot-01__v1__YYYY-MM-DD.png`

### Shot 2 — "Then your child asked…" (3–5s)

```prompt
Render video keyframe 2 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- Same camera angle, same hand, same phone as shot 1 — BUT now blurred
  / out of focus, ~40% of original sharpness. The phone is still there,
  the alphabet is still there, but the focus has shifted.
- A new element FADES IN, sharp and centered: a single large 한글 in
  warm-black #2A1F14, ~280sp, hand-drawn geometric minhwa style,
  positioned center-top-of-frame, ~30% larger than the phone.
- Below the 한글, in cream #FCF8F1 at 60% opacity, the romanization
  "Hangul" in friendly sans, 36sp.

Mood: a question forming. The pivot.

Anti-patterns: motion blur lines, sharp ABCs in the background (they
must blur), more than one large Korean word (just 한글, alone).

Deliverable: 1920 × 1080 PNG, shot 2.
```

**Output**: `design/launch/__output__/video-keyframes/shot-02__v1__YYYY-MM-DD.png`

### Shot 3 — "Hangul Route opens" (5–8s)

```prompt
Render video keyframe 3 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- The phone from shots 1–2 is now CENTERED and at full focus, screen
  facing the viewer.
- The phone screen shows the Hangul Route home screen:
  • Hanji cream #FCF8F1 background (no texture inside the phone screen
    — keep it clean to read at small sizes).
  • Hoya in IDLE pose at center, ~360px tall inside the screen.
  • Speech bubble next to Hoya: "안녕! · annyeong · Hello!" — three
    lines, with romanization and English gloss.
  • A primary CTA at the bottom: "Start quest" pill in dancheong
    #E8743B with cream text #FCF8F1, 28sp weight 700.
  • A faint background grid in surface.sunken #F2EBDE (~6% opacity)
    showing the 7×5 Heritage Journey grid behind Hoya — subtle, not
    competing.
- AROUND the phone (outside it), 3 illustrated heritage cards float
  in: puppy (top-right at ~25° tilt), nabi (left-middle, -15° tilt),
  and the tiger (bottom-right, +10° tilt). All at ~30% size relative
  to the phone, semi-transparent (75% opacity), entering from off-
  canvas.

Mood: welcome, warm. The first impression of the app.

Anti-patterns: more than 3 floating cards (overcrowds), Hoya in any
pose other than idle (continuity), real device chrome.

Deliverable: 1920 × 1080 PNG, shot 3.
```

**Output**: `design/launch/__output__/video-keyframes/shot-03__v1__YYYY-MM-DD.png`

### Shot 4 — "Quest 1 — Meet ㄱ" (8–11s)

```prompt
Render video keyframe 4 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- The phone (same illustrated outline, same camera angle) now fills
  the center 50% of the frame at slightly larger scale than shot 3
  (~110%).
- The phone screen shows the quest intro:
  • At top, a Stage 1 pill (dancheong #E8743B fill, cream text):
    "STAGE 1 · LETTERS"
  • Center: Hoya in CURIOUS pose (head tilted, see
    `01-hoya-three-poses.md` §5), ~280px tall.
  • Speech bubble: "Let's meet ㄱ!" — with romanization "(giyeok)"
    on a second line in #5C4A36.
  • Below Hoya, the big jamo ㄱ alone in warm-black #2A1F14, ~160sp,
    centered, with a tiny dancheong sparkle #E8743B above it.
- Outside the phone, all illustrative cards from shot 3 are GONE.
  Background is clean hanji canvas.

Mood: focused attention. The quest is starting.

Anti-patterns: any other jamo visible, Hoya in cheer pose (save it
for shot 6), multiple sparkles (only one).

Deliverable: 1920 × 1080 PNG, shot 4.
```

**Output**: `design/launch/__output__/video-keyframes/shot-04__v1__YYYY-MM-DD.png`

### Shot 5 — "Mini-game" (11–14s)

```prompt
Render video keyframe 5 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- The same phone, now showing the Match Sound mini-game mid-play.
- Inside the phone screen, top-to-bottom:
  • Sound-wave glyph (3 concentric arcs in #E8743B, ~80px) — Hoya is
    playing the audio "ㄱ / g".
  • Caption "Tap /g/" in #2A1F14, 22sp.
  • Three answer tiles below, evenly spaced, each ~160 × 160 px in
    the phone's coordinate space: tile 1 shows ㄱ (correct, currently
    highlighted with a soft cream glow #FCF8F1 around it), tile 2
    shows ㄴ, tile 3 shows ㄷ. All tiles on surface.paper #FFFFFF with
    a thin border.subtle #E8DFCD outline.
  • Below the tiles, a small star row (3 dots, all empty).

Mood: in the moment. The play.

Anti-patterns: tile 1 showing a green ✓ already (that's shot 6, not
this), tile 1 highlighted with red (we never use red), more than 3
tiles, the tiles shown without spacing.

Deliverable: 1920 × 1080 PNG, shot 5.
```

**Output**: `design/launch/__output__/video-keyframes/shot-05__v1__YYYY-MM-DD.png`

### Shot 6 — "거의 perfect!" cheer (14–17s)

```prompt
Render video keyframe 6 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- The phone now shows the celebration moment.
- Inside the phone screen:
  • Hoya in CHEER pose (see `01-hoya-three-poses.md` §4), full body,
    ~360px tall, centered.
  • A speech bubble next to him: "거의 perfect!" with romanization
    "geo-eui!" on line 2 — even though it's positive feedback, this
    line shows the anti-shame language pattern of always offering
    "almost" alongside "perfect" so the same vocabulary works for
    wrong AND right answers.
  • Behind Hoya, 5 cream #FCF8F1 4-pointed sparkles (small, ~24px
    each, arranged in a soft arc above his head).
  • At the bottom, ONE filled star (gold #F2B33D, ~64px) of three
    available — the first earned. Two empty stars next to it.
- Outside the phone: nothing. Clean canvas.

Mood: earned joy. Quiet celebration.

Anti-patterns: confetti, more than 5 sparkles, more than 1 star
filled (this is the FIRST quest, not the last), Hoya with mouth open
showing teeth.

Deliverable: 1920 × 1080 PNG, shot 6.
```

**Output**: `design/launch/__output__/video-keyframes/shot-06__v1__YYYY-MM-DD.png`

### Shot 7 — "Card flies in" (17–21s)

```prompt
Render video keyframe 7 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- The phone now shows the card-unlock moment.
- Inside the phone screen:
  • The puppy card (`card:gangaji`) is centered, full size, snapped
    into a slot — exactly like frame 3 of the thumbnail GIF (see
    `04-thumbnail-gif.md` §3) but rendered larger.
  • Around the card, 4 cream sparkles at 4-corner positions, ~32px
    each.
  • Below the card, a caption: "+1 Heritage Card" in #5C4A36, 22sp.
- Outside the phone (in the background, large illustrated cards):
  faded silhouettes of 5 more cards (boreumdal, nabi, ramyeon,
  mugunghwa, horangi) at 25% opacity, arranged in an arc above the
  phone — the "what's coming next" tease. Each silhouette is just
  the card outline + a hint of its theme accent color.

Mood: the reward. The unlock.

Anti-patterns: more than 4 sparkles around the card, more than 5
silhouettes in the background, the card visible OUTSIDE the phone
(the unlock happens INSIDE the screen, not in the world).

Deliverable: 1920 × 1080 PNG, shot 7.
```

**Output**: `design/launch/__output__/video-keyframes/shot-07__v1__YYYY-MM-DD.png`

### Shot 8 — "24 cards in Stage 1" (21–24s)

```prompt
Render video keyframe 8 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- Camera pans up to show the Heritage Library grid.
- Fill the center 80% of the frame with a 6 × 4 grid of Heritage Cards
  (24 cards total, see `03-card-illustrations-24.md` for the 24 card
  illustrations). Cards arranged in a clean grid, 12px gap, slight 2°
  rotation alternation.
- 12 of the 24 cards are UNLOCKED (full color, full opacity), the
  other 12 are SILHOUETTED (cream fill, dashed border, no
  illustration inside).
- Unlocked cards (in grid order):
  Row 1 — gangaji, nabi, boreumdal, ramyeon, mugunghwa, horangi
  Row 2 — bap, sagwa, inhyeong, jamjari, chaek, kpop
  Row 3 — silhouettes
  Row 4 — silhouettes
- Hoya in the CURIOUS pose tucked into the bottom-right corner of the
  frame (outside the grid), ~120px tall, looking up at the grid.

Mood: the collection. The library that's filling up.

Anti-patterns: cards in random order (they must follow the order in
content/episodes/stage-1/cards.json), all 24 unlocked (we want the
silhouettes to communicate "more to come"), Hoya inside the grid.

Deliverable: 1920 × 1080 PNG, shot 8.
```

**Output**: `design/launch/__output__/video-keyframes/shot-08__v1__YYYY-MM-DD.png`

### Shot 9 — "See you tomorrow!" (24–27s)

```prompt
Render video keyframe 9 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above.]

Composition:
- The camera pulls back from the grid. Hoya now occupies center, in
  the WAVING pose (from the existing 5-pose sheet in
  `design/brief/character/hoya-character-sheet.md` — NOT in this
  launch pack, since the existing sheet already covers it).
- Hoya is ~520px tall, centered, slightly rotated 3° right.
- Speech bubble above Hoya: "See you tomorrow!" (English only — Hoya
  speaks English to the child throughout the app per the UI=English
  rule, with Korean reserved for the learning target).
- Behind Hoya, faint silhouettes of the 24-card grid from shot 8
  (15% opacity, no detail) — the world he lives in.
- The Hangul Route wordmark fades in at the bottom of the frame in
  warm-black #2A1F14, 32sp weight 700, with the tagline below it in
  #5C4A36 18sp: "Korean for kids who don't speak it — yet."

Mood: warm goodbye. End of a session.

Anti-patterns: Hoya in any pose other than waving, the wordmark
above Hoya (it must be below), the tagline in any color other than
#5C4A36.

Deliverable: 1920 × 1080 PNG, shot 9.
```

**Output**: `design/launch/__output__/video-keyframes/shot-09__v1__YYYY-MM-DD.png`

### Shot 10 — Outro card (27–30s)

```prompt
Render video keyframe 10 of 10 for Hangul Route's 30-second launch
video.

[Universal spec above — but a slight palette tweak:]
- Background: dancheong-light #FAD9C6 with a 6% hanji texture (one
  shade warmer than the other 9 shots — the outro is a "warm hug"
  close).

Composition:
- Center-top (40% of frame): the app icon (see
  `design/brief/launch-assets.md` §1 prompt — Hoya head on dancheong
  orange), rendered at 256 × 256 px with rounded iOS-mask corners.
- Below the icon (8% gap): the wordmark "Hangul Route" in #2A1F14,
  48sp weight 700.
- Below the wordmark (4% gap): the tagline "Korean for kids who don't
  speak it — yet." in #5C4A36, 22sp.
- Below the tagline (8% gap): the URL "hangulroute.com" in #E8743B,
  20sp weight 600, with a small dancheong underline.
- Bottom-right corner: a small "Free first 12 cards · No ads ·
  Offline" pill in surface.paper #FFFFFF with #5C4A36 text, 16sp.

Mood: clean close. Memorable. The card a viewer would screenshot to
remember the name.

Anti-patterns: any "Tap to install" or App Store badges (we don't
have them yet at PH launch), QR code (the URL is sufficient), more
than the four elements listed (icon, wordmark, tagline, URL + corner
pill).

Deliverable: 1920 × 1080 PNG, shot 10.
```

**Output**: `design/launch/__output__/video-keyframes/shot-10__v1__YYYY-MM-DD.png`

---

## 3. Vertical crop (TikTok / Reels)

After generating the 10 horizontal keyframes, also render a 1080 ×
1920 vertical crop of each. The vertical version is NOT a re-shoot —
it is a re-frame: take the 1920×1080 source and crop a 1080×1920
window from it centered on the primary subject.

For shots where the primary subject is the phone:
- Shots 1, 2, 3, 4, 5, 6, 7 — crop centered on the phone.

For shots where the primary subject spreads horizontally:
- Shot 8 — re-render in 9:16 with a 4 × 6 grid (24 cards still, but
  4 columns × 6 rows instead of 6 × 4).
- Shot 9 — same Hoya centered, but adjust the wordmark + tagline to
  stack vertically below him with more breathing room.
- Shot 10 — same outro elements, stacked vertically with bigger
  spacing.

**Output**: `design/launch/__output__/video-keyframes/vertical/shot-XX__v1__YYYY-MM-DD.png`

---

## 4. Assembly in the editor

After Claude Design returns the 10 (or 20, with verticals) PNGs:

1. **Drop the 10 horizontal stills into CapCut** in shot order.
2. Set each clip's duration per the table in
   `docs/launch/video-storyboard-30s.md` (the "Time" column).
3. **Transitions**: cross-dissolve 0.3s between every pair. No swipes,
   no zooms, no whip pans. The hand-painted style is gentle; respect
   that.
4. **Camera "movement"** within a still: a slow 1.5% Ken Burns pan
   (toward the focal point) on shots 1, 7, 8. No movement on the rest.
5. **Voiceover**: record per the script in `video-storyboard-30s.md`
   §3. Pace 165–175 WPM, warm.
6. **Music**: gayageum + kalimba bed at -22 dB. Cue starts at 0.0s,
   final beat at 27.5s.
7. **Burned-in captions** (per `video-storyboard-30s.md` shot table):
   28sp friendly sans, #2A1F14 text on a cream #FCF8F1 pill at 90%
   opacity, anchored to the lower-third. PH plays muted by default —
   captions ARE the message.
8. **Export**: 1080p H.264 high, 8–12 Mbps, < 50 MB.

For the vertical TikTok cut: same shot order, same captions, but
9:16 frames.

---

## 5. Acceptance checklist

- [ ] All 10 horizontal keyframes at 1920 × 1080, sRGB.
- [ ] All 10 share the same Hoya (same eye spacing, same belly patch,
      same tail curl — compare side-by-side).
- [ ] The phone outline is the SAME illustrated shape across shots 1–7
      (continuity).
- [ ] Shot 6 is the ONLY shot with a star row showing a filled star.
- [ ] Shot 7 is the ONLY shot with the card-snap composition.
- [ ] No real device chrome, no Apple/Android logos.
- [ ] No real human faces (only abstract hands in shots 1–2).
- [ ] Vertical re-frames generated for at least shots 3, 5, 6, 7, 10
      (the most critical for TikTok).
- [ ] All 10 (horizontal) + 5 (vertical re-frames) outputs saved with
      the filename convention.
- [ ] Session block logged in `design/prompts.md`.
