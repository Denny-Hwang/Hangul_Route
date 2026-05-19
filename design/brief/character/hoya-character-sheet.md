# Hoya — Character Sheet

**The face of Hangul Route.** Every screen has Hoya somewhere. Get this right and the rest is easier.

---

## 1. Context

Hoya (호야) is a young Korean tiger (호랑이) who guides the child through the Heritage Journey. He is:

- **A friend, not a teacher.** He learns *with* the child.
- **Always proud of you.** Never disappointed. Never frowns.
- **Curious about the world.** Slight head-tilt when listening.
- **Slightly silly.** Inspired by Korean minhwa folk-painting tigers — round, smiling, sometimes a little goofy.

He carries the **anti-shame contract** of the whole app (CLAUDE.md §8, F-002 §1): when the child gets a wrong answer, Hoya does not look sad or disappointed. He goes into `thinking` pose — head up, eyes looking at the thought bubble, gentle "let's try again" energy.

## 2. Required poses (v1)

| Pose | When it appears | Energy |
|---|---|---|
| `idle` | Default — Home screen, Episode browse | Warm, attentive, slight smile |
| `cheering` | Correct answers, results screen, card unlock | Joyful, arms up, sparkles around |
| `thinking` | Wrong answers, hints, "let's try" | Curious, looking up, thought bubble |
| `reading` | Quest intros, narrative steps | Concentrated, looking down at a book |
| `waving` | Welcome screen, profile switch, "hi!" | One paw up, warm smile, slightly bigger |

## 3. Anatomy specs (consistency across poses)

- **Body proportions**: head ≈ 60% of total height. Body is a soft ellipse. Always two short front legs visible.
- **Head shape**: round, slightly wider than tall (1.1 : 1). Ears are small rounded triangles at 1 o'clock and 11 o'clock.
- **Eyes**: round, dark brown (`hoya.stripes` #2A1F14). Spacing = 1 eye-width apart. Size shifts slightly by pose (smaller when cheering = squint, bigger when thinking).
- **Stripes**: 3–4 visible on the head/sides — soft tapered shapes, not sharp. Stripes follow body curvature.
- **Belly**: cream (`hoya.belly` #FCF8F1) oval covering 60% of the front torso.
- **Cheeks**: soft pink (`hoya.cheek` #F8B4B4) circular blush, 30% opacity, only visible in idle/cheering/waving.
- **Nose**: small downward triangle, `hoya.nose` #2A1F14.
- **Mouth**: small "U" or soft curve. Always closed. Never sharp teeth.
- **No tail visible** in front-facing portraits (keeps the silhouette clean).

## 4. Palette (do not deviate)

| Token | Hex | Use |
|---|---|---|
| `hoya.fur` | #F2B33D | Main body fill |
| `hoya.furDark` | #B5862A | Shading under chin, behind ears |
| `hoya.stripes` | #2A1F14 | Stripes, eyes, mouth line |
| `hoya.belly` | #FCF8F1 | Belly + face center |
| `hoya.cheek` | #F8B4B4 | Soft cheek blush |
| `hoya.nose` | #2A1F14 | Nose triangle |

Accent props per pose (sparingly):
- `feedback.nudge` #F2B33D — sparkle glow (cheering)
- `brand.secondary` #4A9DD6 — thought bubble (thinking)
- `surface.paper` #FFFFFF — book pages (reading)

## 5. Sizes used in the app

| Context | Pixel size | Pose |
|---|---|---|
| HoyaBubble thumbnail | 56–72 | tone-dependent |
| Home screen avatar | 72 | waving |
| FirstQuestPreview | 120 | cheering |
| Episode detail (preview state) | 96 | reading |
| Results screen | 140 | cheering / thinking |
| Welcome screen hero | 180 | waving |
| Profile switcher card | 64–72 | idle / cheering (active) |

The character sheet should render Hoya at **480 × 480 each pose** so all downstream sizes downsample cleanly.

## 6. Style markers (consistency across poses)

- Hand-painted, slightly imperfect linework — ~3px stroke at 480px scale, slight wobble (not perfectly geometric).
- Round everything — no sharp angles anywhere.
- Soft radial shadow under the feet — no hard cast shadow.
- Cream (#FCF8F1) background, ready to be knocked out to transparent.
- Subtle hanji-paper texture *behind* the character at 4% opacity (optional — keep light).

## 7. Anti-patterns

- Sharp teeth, snarl, narrowed eyes.
- Anime "uwu" face — sparkle eyes, oversized irises, mouth wide open.
- Photorealistic fur strands.
- Pure black anywhere (use `#2A1F14`).
- Sad expression for `thinking` (look UP, not down).
- Multiple Hoyas in one frame (overwhelms).
- Bow tie, hat, glasses (no accessories in v1 — character should read clean).

---

## 8. Claude Design prompt — Full character sheet v1

```prompt
Create a Hoya character sheet for Hangul Route, a Korean learning app for
kids 5–11. Output: one 2400 × 1600 PNG with 5 portraits of the same
character in 5 different poses, arranged in a single row, each 480 × 480
with a label below.

Character: Hoya, a young Korean tiger (호랑이) inspired by Korean folk
painting (minhwa) tigers. Round body, gentle smile, round eyes, slightly
silly. Never sharp, never aggressive.

Palette (use ONLY these — no other colors):
- Fur main #F2B33D
- Fur shading #B5862A (under chin, behind ears, soft)
- Stripes #2A1F14 (warm-black, tapered soft shapes — not sharp lines)
- Belly + face center #FCF8F1 (cream oval)
- Cheeks #F8B4B4 (light pink, 30% opacity blush, idle/cheering/waving only)
- Nose #2A1F14 (small downward triangle)
- Background #FCF8F1 (canvas cream, with subtle hanji-fiber texture at 4%)

Anatomy (apply consistently across all 5 portraits):
- Head ≈ 60% of total height. Round, slightly wider than tall.
- Two small rounded-triangle ears at 1 and 11 o'clock.
- Round dark-brown eyes, 1 eye-width apart, size shifts by pose.
- 3–4 soft tapered stripes on head/sides, following body curvature.
- Cream belly oval covering 60% of front torso.
- Two short front legs visible in front.
- No tail (front-facing portraits).
- Closed mouth always — small "U" or soft curve. Never teeth.

Style: hand-painted feel, ~3px stroke with slight wobble (not perfectly
geometric), generous whitespace, soft radial shadow under feet.

The 5 poses (left to right):

1. IDLE — front-facing, head slightly tilted right, eyes warm and curious,
   mouth a small soft "U" smile, paws resting in front. Default state.
   Label: "idle — default"

2. CHEERING — body slightly bigger, both arms (paws) raised up and out,
   eyes squinted into upward curves (joy), mouth wider soft smile.
   Two small dancheong-orange sparkles (#F2B33D 80% opacity, 4-point
   star shapes) near the top-left and top-right. Cheeks visible.
   Label: "cheering — correct answer / card unlock"

3. THINKING — head tilted up looking slightly off-frame to upper-right,
   eyes wide and curious (NOT sad, NOT closed — looking UP), mouth small
   neutral curve. A soft thought-cloud (rounded rectangle, white fill,
   1.5px sky-blue border #4A9DD6) hovers near the top-right with two
   small bubble dots leading from Hoya's head to the cloud. Cheeks NOT
   visible. This pose is the wrong-answer surface — must feel
   encouraging, never disappointed.
   Label: "thinking — wrong answer / hint"

4. READING — looking down at a small cream paper rectangle (book,
   #FFFFFF fill with thin #5C4A36 border) held between front paws. Eyes
   focused down on the page, mouth small neutral, body slightly hunched
   forward. Two black calligraphy strokes visible on the book page.
   Label: "reading — quest intro / preview"

5. WAVING — body slightly bigger than idle, right front paw raised up to
   shoulder height in a wave, mouth wider soft smile, eyes warm.
   Cheeks visible. This is the hello-greeting pose.
   Label: "waving — welcome / hi"

Layout: 5 portraits left-to-right with 40px gutters. Cream label below
each portrait in #5C4A36, 24sp friendly sans, lowercase. A 60px header at
the top reads "Hoya — Character Sheet v1" in #2A1F14 28sp bold.

Anti-patterns (do not produce):
- Sharp teeth, snarl, narrowed angry eyes
- Anime sparkle eyes, oversized irises
- Photorealistic fur, fur strands visible
- Pure black (#000000) anywhere — use #2A1F14
- Sad face in thinking pose (eyes must look UP, not DOWN)
- Multiple Hoyas overlapping
- Background patterns louder than 4% opacity
- Red anywhere

Deliverable: one 2400 × 1600 PNG showing all 5 poses, ready to be split
into 5 separate transparent-background PNGs at 480 × 480 each.
```

## 9. Claude Design prompt — Single-pose iteration

For when one pose needs revision. Replace `[POSE]` and `[CHANGE_REQUEST]`.

```prompt
Iterate on Hoya the tiger in the [POSE] pose for Hangul Route. Keep all
specs from design/brief/character/hoya-character-sheet.md §3, §4, §6
(anatomy, palette, style markers) — only change: [CHANGE_REQUEST].

Output a single 480 × 480 PNG with transparent background.
```

## 10. Claude Design prompt — Pose extensions (Phase 2)

Beyond v1's 5 poses, these may be needed later. Mark Phase 2 — do not produce in this PR.

Reserved future poses:
- `sleeping` (rest screen, daily streak break)
- `peeking` (parent-gate, settings)
- `holding-card` (heritage card showcase)
- `painting` (Stage 7 Self-expression)
- `surprised` (rare-card unlock — but keep tasteful, never shocked)

## 11. Acceptance checklist

- [ ] Exactly 5 poses delivered: idle / cheering / thinking / reading / waving
- [ ] All poses share anatomy (head ratio, ear position, stripe count, belly oval)
- [ ] Palette: only the 6 hoya.* tokens used
- [ ] Thinking pose looks UP (not down), feels curious not sad
- [ ] No sharp teeth, no anime, no pure black
- [ ] Cheek blush present only in idle / cheering / waving
- [ ] Sparkles in cheering use `feedback.nudge` amber (#F2B33D)
- [ ] Thought cloud in thinking uses `brand.secondary` border (#4A9DD6)
- [ ] All poses cropped consistently — Hoya occupies ~70% of the 480×480 frame
- [ ] Soft shadow under feet (no hard cast)
- [ ] Optional 4% hanji texture in background (do not exceed)

## 12. Output path

- `design/characters/hoya/v1/character-sheet__YYYY-MM-DD.png` (the full 5-pose sheet)
- `design/characters/hoya/v1/idle.png`
- `design/characters/hoya/v1/cheering.png`
- `design/characters/hoya/v1/thinking.png`
- `design/characters/hoya/v1/reading.png`
- `design/characters/hoya/v1/waving.png`

Splits go into individual transparent-background PNGs at 480 × 480. The 5
splits are what `packages/design-system/src/components/Hoya/` will eventually
consume (replacing the geometric SVG placeholder currently in v1.0 prototype).
