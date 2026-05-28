# Claude Design — PH Launch Prompts

**Paste-ready Claude Design prompts for the Product Hunt launch artifact pack.**
Each prompt here matches one item in [`docs/launch/`](../../docs/launch/) 1:1
and inherits the visual identity from
[`design/brief/00-visual-identity.md`](../brief/00-visual-identity.md).

> Run these in a Claude (claude.ai) Design session yourself — no API call,
> no automation. Save outputs to the paths at the bottom of each brief and
> log the session in [`design/prompts.md`](../prompts.md).

---

## Why this folder exists alongside `design/brief/`

| `design/brief/` | `design/launch/` (this folder) |
|---|---|
| The **canonical** Claude Design library — characters, components, screens, illustrations, store assets. Built for the 12-week design playbook. | The **launch sprint** — the specific assets demanded by `docs/launch/` for PH D-14 → D-0. |
| Long-term sources of truth (re-used every quarter). | Single-purpose, single-launch (re-author every PH). |
| Output: `design/characters/`, `design/components/`, `design/screens/`, `design/illustrations/`. | Output: `design/launch/__output__/`. |
| Examples: Hoya 5-pose sheet, 30-card illustration template, app icon. | Examples: Hoya **3-pose mini-pack** (idle/cheer/curious), PH gallery 5-slide deck, 1.5s thumbnail GIF. |

If a launch asset is already covered by a `design/brief/` prompt (e.g. app
icon — see `brief/launch-assets.md` §1), this folder **does not duplicate**
it; it only adds prompts for assets the launch pack actually needs that
brief doesn't yet cover, or where the launch spec deviates from brief.

---

## Mapping to `docs/launch/`

| `docs/launch/` doc | Claude Design prompt | Output |
|---|---|---|
| `gallery-spec.md` Image 1–5 | [`02-ph-gallery-5-slides.md`](./02-ph-gallery-5-slides.md) | 5 PNGs (1280 × 720) |
| `gallery-spec.md` Bonus GIF | [`04-thumbnail-gif.md`](./04-thumbnail-gif.md) | 5 frames @ 240 × 240 + assembly notes |
| `video-storyboard-30s.md` shots 1–10 | [`05-video-keyframes.md`](./05-video-keyframes.md) | 10 PNG keyframes |
| `maker-comment.md`, `faq.md` "Hoya never says wrong" | [`01-hoya-three-poses.md`](./01-hoya-three-poses.md) | 3 PNG poses + amber bubble variant |
| `content/episodes/stage-1/cards.json` (24 cards) | [`03-card-illustrations-24.md`](./03-card-illustrations-24.md) | 24 PNGs (560 × 800) |

---

## Run order (D-14 → D-7)

> All five briefs assume the existing
> [`design/brief/character/hoya-character-sheet.md`](../brief/character/hoya-character-sheet.md)
> sheet has been generated **once** (use the same Hoya across all
> launch-pack outputs).

| Day | Brief | Time | Why now |
|---|---|---|---|
| D-13 | [`01-hoya-three-poses.md`](./01-hoya-three-poses.md) | 1–2h | Used by gallery 4 + video shots 4, 6, 7, 9 |
| D-12 | [`03-card-illustrations-24.md`](./03-card-illustrations-24.md) | 4–6h | Used by gallery 1, 2, video shot 7, 8 |
| D-11 | [`02-ph-gallery-5-slides.md`](./02-ph-gallery-5-slides.md) | 2–3h | The PH page itself |
| D-10 | [`04-thumbnail-gif.md`](./04-thumbnail-gif.md) | 1h | PH feed scroll-stopper |
| D-9 | [`05-video-keyframes.md`](./05-video-keyframes.md) | 2h | Video editing locks at D-5 |

**Parallelizable**: D-12 (24 cards) is the bottleneck. Spin up a second
Claude Design thread for it while D-13 + D-11 run in the main thread.

---

## Output convention

All outputs land under `design/launch/__output__/` (gitignored by default —
add a `.gitkeep` if you want to track per-launch versioning):

```
design/launch/__output__/
├── hoya/
│   ├── idle__v1__YYYY-MM-DD.png
│   ├── cheer__v1__YYYY-MM-DD.png
│   ├── curious__v1__YYYY-MM-DD.png
│   └── amber-bubble__v1__YYYY-MM-DD.png
├── gallery/
│   ├── 01-hero__v1__YYYY-MM-DD.png
│   ├── 02-cards__v1__YYYY-MM-DD.png
│   ├── 03-minigames__v1__YYYY-MM-DD.png
│   ├── 04-hoya-feedback__v1__YYYY-MM-DD.png
│   └── 05-parent-handoff__v1__YYYY-MM-DD.png
├── cards/
│   ├── 01-gangaji__v1__YYYY-MM-DD.png
│   ├── 02-nabi__v1__YYYY-MM-DD.png
│   └── … (24 total)
├── thumbnail-gif/
│   ├── frame-01-empty__v1__YYYY-MM-DD.png
│   ├── frame-02-incoming__v1__YYYY-MM-DD.png
│   ├── frame-03-snap__v1__YYYY-MM-DD.png
│   ├── frame-04-paw__v1__YYYY-MM-DD.png
│   └── frame-05-loop__v1__YYYY-MM-DD.png
└── video-keyframes/
    ├── shot-01__v1__YYYY-MM-DD.png
    ├── shot-02__v1__YYYY-MM-DD.png
    └── … (10 total)
```

Final exports for upload (downsampled, < 2 MB) live in `__output__/_final/`
and are the files referenced in `docs/launch/gallery-spec.md` &
`video-storyboard-30s.md`.

---

## Universal rules (every prompt in this folder)

These travel with every launch-pack prompt. **Paste them into the Claude
Design session as a system note** before running any individual brief:

```
You are designing for Hangul Route, a Korean learning app for English-
speaking kids aged 5–11. Heritage-warm, hanji-paper feel, hand-painted
geometric minhwa illustration.

Strict palette — use ONLY these hex codes:

Brand:     #E8743B (orange, primary) · #B5562A (dark) · #FAD9C6 (light)
           #4A9DD6 (blue, secondary) · #2E72A3 (dark) · #CDE5F4 (light)

Surface:   #FCF8F1 (canvas — always the background)
           #FFFFFF (card/sheet)
           #F2EBDE (sunken/inactive)

Text:      #2A1F14 (warm-black, body)
           #5C4A36 (secondary)
           #8A7860 (muted)

Feedback:  #4FA871 (success green)
           #F2B33D (amber — the wrong-answer color, NEVER red)
           #C84B3D (danger — parent/admin only, never for kids)

Hoya:      #F2B33D (fur) · #B5862A (shading) · #2A1F14 (stripes)
           #FCF8F1 (belly) · #F8B4B4 (cheeks)

Rarity:    #8A7860 common · #7BB552 uncommon · #4A9DD6 rare
           #E8743B legendary

Stage 1 anchor: #E8743B   Theme axis: letters #E8743B · life #F2B33D ·
rites #8265C2 · nature #7BB552 · crafts #4A9DD6

Anti-patterns (refuse silently — do not render):
- Pure black #000000 anywhere. Always use #2A1F14.
- Red (#FF0000 family) for child feedback. Use #F2B33D amber.
- Cold white #FFFFFF for the app background. The canvas is #FCF8F1.
- Sharp teeth, anime sparkle eyes, neon, drop-shadow gradients.
- Text rendered inside character/icon art (PH thumbnail, app icon, cards).
- A frowning Hoya. Ever.

Style: ~6px stroke with slight hand wobble, rounded corners ≥ 8px on
touchables, soft radial shadows only, generous whitespace.
```

---

## Acceptance gates

Before saving any output to `_final/`:

- [ ] Reads cleanly at 60 × 60 px (for icons / thumbnails) or at the spec'd
      gallery size at 50% scale (for gallery slides).
- [ ] Only palette hex codes from the universal rules above.
- [ ] No pure `#000000` anywhere in the file (sample pixels to verify).
- [ ] No red on a child-context surface.
- [ ] Hoya's mouth is at rest or smiling — never frowning, never open-
      mouthed scream.
- [ ] Korean text (if any) has romanization in the same frame.
- [ ] Output filename matches the convention above.
- [ ] Session logged in `design/prompts.md`.

If any gate fails, iterate the prompt — do not edit the output by hand.
The point of Claude Design is repeatability.
