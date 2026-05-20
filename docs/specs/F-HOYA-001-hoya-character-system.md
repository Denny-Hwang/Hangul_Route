# F-HOYA-001 — Hoya Character System (5-Pose SVG)

**Status**: `shipped` (back-fill — landed in PR #13 / refined in PR #16, this spec written 2026-05-21)
**Scope**: `packages/design-system` · MVP
**Owner**: solo dev
**Rollout**: MVP — Hoya is the face of every screen

---

## 1. Context

Hoya (호야) is a young Korean tiger that guides the child through the Heritage Journey (CLAUDE.md §1). He appears on:

- Welcome screen (180px hero, waving)
- HoyaBubble component (72px, all 3 tones — see F-002)
- Home screen (72px, waving)
- Episode preview cards (96px, reading)
- Quest player results (140px, cheering or thinking)
- FirstQuestPreview (120px, cheering)
- Profile cards (64px, idle or cheering)
- Inside the Tiger Heritage card (Heritage Card Art)

F-HOYA-001 defines the **5-pose geometric SVG placeholder** that ships until externally commissioned illustrator output replaces it. The placeholder is intentionally faithful to the character sheet brief so the eventual replacement is a drop-in: same poses, same anatomy points, same emotional contract.

Implemented across:
- PR #13 (`feat: v1.0 full-vision prototype`) — initial 5-pose SVG
- PR #16 (`design(hoya): refine v1 SVG placeholder per character-sheet brief`) — pose differentiation refined per `design/brief/character/hoya-character-sheet.md`

## 2. User story

> As **any user** (child or parent) seeing Hoya for the first time, I want a single, consistent character voice across every screen — same warm tiger, same anatomy, same emotional register — so that Hoya feels like a real friend, not 5 different mascots stitched together.

Companion stories:

- As **P5** (5–7 yo who just got a wrong answer), I want Hoya to look CURIOUS, not sad — eyes UP, mouth neutral — so I'm not embarrassed.
- As **a designer reviewing the visual system**, I want the placeholder to specify enough constraints (palette / anatomy / pose deltas) that the illustrator commission has zero ambiguity.

## 3. Acceptance criteria

### 3.1 Pose set

`<Hoya pose={pose} size={size} />` must support exactly these 5 poses:

| Pose | When it appears | Emotional energy |
|---|---|---|
| `idle` | Default — Home, Episode browse | Warm, attentive, slight smile |
| `cheering` | Correct answers, Results, Card unlock | Joyful, arms up, sparkles around |
| `thinking` | Wrong answers, hints | Curious, looking UP, thought bubble |
| `reading` | Quest intros, narrative steps | Concentrated, looking down at a book |
| `waving` | Welcome, profile switch, "hi!" | One paw up, warm smile, bigger |

### 3.2 Anti-shame contract (F-002 §3 enforcement)

- **`thinking` pose looks UP-RIGHT** (eyes at y=68, shifted to upper-right). NEVER down.
- **Mouth in `thinking`** is a small neutral curve, never a frown.
- **Cheek blush** appears ONLY in `idle / cheering / waving`. Hidden in `thinking` and `reading` (focus matters).
- **No sharp teeth** in any pose. Closed-mouth or soft "U" smile.
- **No pure black**. All "black" lines are `colors.hoya.stripes` #2A1F14.
- **No red** anywhere.

### 3.3 Anatomy invariants

All 5 poses must share:

- **Head**: round, radius 44 at 128 viewBox, centered (cx=64, cy=64).
- **Ears**: rounded circles at 1 o'clock (cx=98, cy=32) and 11 o'clock (cx=30, cy=32), radius 12, with inner pink dot radius 6.
- **Eyes**: 2 ellipses, ~28 units apart, dark `hoya.stripes` fill. Position/shape varies by pose.
- **Belly oval**: cream `hoya.belly` ellipse at (64, 84), rx=26, ry=16.
- **Nose**: small downward triangle at (58–70, 84–90), `hoya.nose` fill.
- **Stripes**: 3 tapered curves per side + 1 forehead stripe, `hoya.stripes` stroke 3px.
- **Foot shadow**: thin opacity-0.18 ellipse at (64, 116), rx=38, ry=5.

### 3.4 Pose-specific accents

- **idle**: tiny eye glints (0.9 radius cream circles at +1.2,-1.3 from eye centers).
- **cheering**: both arms raised with curved Q-paths to (8, 46) and (120, 46), terminating in 7-radius paw circles. Two 4-point pinwheel sparkles at top corners (#F2B33D 85% opacity).
- **thinking**: thought cloud — 2 bubble dots leading up-right + a rounded rect (108, 2, 18, 12) in cream with `brand.secondary` 1.5px border.
- **reading**: cream book rectangle (36, 94, 56, 22) with spine crease + 4 calligraphy strokes (2 per page). Two front-paw circles at (42, 102) and (86, 102).
- **waving**: right arm curved Q-path to (122, 54), 7-radius paw circle.

### 3.5 Palette restriction

Uses ONLY `colors.hoya.*` (fur / furDark / stripes / belly / cheek / nose) plus:
- `feedback.nudge` for cheering sparkles
- `brand.secondary` for thinking cloud border
- `surface.paper` for thought cloud fill
- `surface.canvas` for book pages
- `text.primary` / `text.secondary` / `text.muted` for accents

### 3.6 Sizes

`size` prop scales the 128 viewBox uniformly. Common values in app:
- 56–72 (HoyaBubble thumbnails)
- 96 (Episode preview reading)
- 120 (FirstQuestPreview cheering)
- 140 (Results cheering / thinking)
- 180 (Welcome hero waving)

## 4. Out of scope

- **Real illustrator art** — replaces this SVG when commission lands.
- **Pose extensions** (sleeping / peeking / holding-card / painting / surprised) — Phase 2 per brief §10.
- **Hanji texture behind Hoya** — optional per brief §6, skipped in v1.
- **Animation between poses** — separate motion brief (F-MOTION-001).
- **Multi-Hoya scenes** — Hoya appears alone in v1 (no group portraits).
- **Hoya outside HeritageCardArt** — the Tiger card embeds Hoya inline at smaller scale; other cards do not embed Hoya.

## 5. UI sketch

`design/brief/character/hoya-character-sheet.md` is the canonical design source.

```
┌────────────────────────────────────────────────────────┐
│  IDLE    CHEERING   THINKING   READING    WAVING       │
│  ┌───┐    ┌───┐      ┌───┐      ┌───┐      ┌───┐       │
│  │🐯 │    │🐯 │      │🐯 │      │🐯 │      │🐯 │       │
│  │   │    │   │      │  💭│     │   │      │👋 │       │
│  │   │    │ ✨ │      │   │     │📖 │      │   │       │
│  └───┘    └───┘      └───┘      └───┘      └───┘       │
│  warm     joyful     curious    focused    greeting    │
└────────────────────────────────────────────────────────┘
```

## 6. Tests

The component is render-only. Validation:

- **Typecheck**: `HoyaPose` enum constrains the `pose` prop to exactly 5 values.
- **Token sanity** (✅ shipped in PR #15): 10 vitest tests in `packages/design-system/src/__tests__/tokens.test.ts` verify the Hoya palette (fur / stripes / belly / cheek) exists and uses correct hex values.
- **Visual regression** (deferred to F-VR-001): Storybook snapshot per pose.
- **Manual designer review**: open `/design-preview` "Hoya (placeholder)" section and validate all 5 poses against the brief acceptance checklist.

## 7. Rollout

- **PR #13**: initial 5-pose SVG (all poses sharing a template).
- **PR #16**: refined per character-sheet brief — pose-conditional cheek visibility, thinking eyes look UP, reading pose gets a book, cheering gets 4-point sparkles, etc.
- Real illustrator output replaces this SVG in a future sprint. The 5-pose / anatomy / palette contract is preserved.

## 8. Dependencies

### Upstream (must ship first — all done)

- `tokens.colors.hoya.*` palette (✅ PR #15).
- `tokens.colors.brand.secondary` for thinking cloud (✅ PR #15).
- `tokens.colors.feedback.nudge` for cheering sparkles (✅ PR #15).
- `react-native-svg` for RN-side rendering.

### Downstream

- F-002 HoyaBubble — consumes Hoya thumbnails at 72px in 3 tones (idle/cheering/thinking).
- F-CARD-001 Heritage Card Art — Tiger card embeds Hoya cheering at scaled-down size inline.
- F-MOTION-001 — Hoya pose transitions (eyes blink, ears wiggle, etc.).
- Real illustrator commission — replaces SVG; same 5 poses and anatomy.

### External

- `design/brief/character/hoya-character-sheet.md` — canonical visual contract.
- `design/characters/hoya/v1/` — illustrator output destination (currently empty).
