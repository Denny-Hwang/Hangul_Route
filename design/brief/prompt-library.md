# Claude Design — Prompt Library (Index)

**Quick-copy index of every Claude Design prompt in `design/brief/`.** Use this when you know which artifact you want and just need the prompt text fast.

> Each entry lists the brief, the artifact it produces, and where the output goes. Open the linked brief and copy the `Claude Design prompt` block.

---

## Phase 0 — Visual identity foundation

Run these once at the start. Everything else inherits.

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P0-1 | [`00-visual-identity.md`](./00-visual-identity.md#10-claude-design-prompt--identity-exploration-sheet) | Identity exploration sheet | `design/brief/__output__/identity-sheet__v1__YYYY-MM-DD.png` |
| P0-2 | [`00-visual-identity.md`](./00-visual-identity.md#11-claude-design-prompt--hanji-paper-texture-studies) | Hanji texture pack (4 variants) | `design/brief/__output__/hanji-textures__v1__YYYY-MM-DD.png` |
| P0-3 | [`00-visual-identity.md`](./00-visual-identity.md#12-claude-design-prompt--single-hoya-thumbnail-smoke-test) | Single Hoya smoke test | `design/characters/hoya/v1/idle-smoke-test__YYYY-MM-DD.png` |

## Phase 1 — Character

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P1-1 | [`character/hoya-character-sheet.md`](./character/hoya-character-sheet.md#8-claude-design-prompt--full-character-sheet-v1) | Hoya 5-pose character sheet | `design/characters/hoya/v1/character-sheet__YYYY-MM-DD.png` |
| P1-2 | [`character/hoya-character-sheet.md`](./character/hoya-character-sheet.md#9-claude-design-prompt--single-pose-iteration) | Single-pose iteration (parameterized) | `design/characters/hoya/v1/{pose}.png` |

## Phase 2 — Illustrations

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P2-1 | [`illustrations/heritage-card-art.md`](./illustrations/heritage-card-art.md#6-claude-design-prompt--card-art-language-sheet) | Heritage card art language sheet (6 samples) | `design/illustrations/heritage-cards/_art-language__v1__YYYY-MM-DD.png` |
| P2-2 | [`illustrations/heritage-card-art.md`](./illustrations/heritage-card-art.md#7-claude-design-prompt--individual-card-template) | Single Heritage card (template — run 30×) | `design/illustrations/heritage-cards/{theme}/{card-id}__YYYY-MM-DD.png` |
| P2-3 | [`illustrations/scene-backgrounds.md`](./illustrations/scene-backgrounds.md#6-claude-design-prompt--hanji-texture-pack) | Hanji texture pack (6 backgrounds) | `design/illustrations/backgrounds/_texture-pack__v1__YYYY-MM-DD.png` |
| P2-4 | [`illustrations/scene-backgrounds.md`](./illustrations/scene-backgrounds.md#7-claude-design-prompt--stage-entry-tint-parameterized) | Tinted stage background (parameterized — run 7×) | `design/illustrations/backgrounds/bg-stage-{N}__v1__YYYY-MM-DD.png` |

## Phase 3 — Design system components

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P3-1 | [`components/button.md`](./components/button.md#5-claude-design-prompt) | Button 5×4×3 matrix | `design/components/Button/matrix__v1__YYYY-MM-DD.png` |
| P3-2 | [`components/card.md`](./components/card.md#5-claude-design-prompt) | Card 5×3×4 matrix | `design/components/Card/matrix__v1__YYYY-MM-DD.png` |
| P3-3 | [`components/tile.md`](./components/tile.md#5-claude-design-prompt) | Tile 4 states × 3 sizes matrix | `design/components/Tile/matrix__v1__YYYY-MM-DD.png` |
| P3-4 | [`components/hoya-bubble.md`](./components/hoya-bubble.md#5-claude-design-prompt) | HoyaBubble 6-cell variants sheet (F-002) | `design/components/HoyaBubble/variants__v1__YYYY-MM-DD.png` |
| P3-5 | [`components/progress.md`](./components/progress.md#5-claude-design-prompt) | Progress bar/dots variants | `design/components/Progress/variants__v1__YYYY-MM-DD.png` |
| P3-6 | [`components/star-row.md`](./components/star-row.md#5-claude-design-prompt) | StarRow 4 tiers × 4 sizes | `design/components/StarRow/variants__v1__YYYY-MM-DD.png` |
| P3-7 | [`components/pill.md`](./components/pill.md#5-claude-design-prompt) | Pill 6 tones × 2 sizes | `design/components/Pill/variants__v1__YYYY-MM-DD.png` |
| P3-8 | [`components/heading.md`](./components/heading.md#6-claude-design-prompt) | Typography sheet (Heading / Body / Caption) | `design/components/Heading/type-sheet__v1__YYYY-MM-DD.png` |
| P3-9 | [`components/screen.md`](./components/screen.md#5-claude-design-prompt) | Screen container 3-tone demo | `design/components/Screen/variants__v1__YYYY-MM-DD.png` |
| P3-10 | [`components/icon-set.md`](./components/icon-set.md#5-claude-design-prompt) | Icon set 19 glyphs | `design/components/Icon/set__v1__YYYY-MM-DD.png` |
| — | [`components/spacer.md`](./components/spacer.md) | (invisible — no prompt) | — |

## Phase 4 — Screens

### Onboarding (3)

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P4-01 | [`screens/01-onboarding-welcome.md`](./screens/01-onboarding-welcome.md#6-claude-design-prompt) | Welcome screen | `design/screens/onboarding/welcome__v1__YYYY-MM-DD.png` |
| P4-02 | [`screens/02-onboarding-create-profile.md`](./screens/02-onboarding-create-profile.md#5-claude-design-prompt) | Create profile | `design/screens/onboarding/create-profile__v1__YYYY-MM-DD.png` |
| P4-03 | [`screens/03-onboarding-first-quest-preview.md`](./screens/03-onboarding-first-quest-preview.md#5-claude-design-prompt) | First quest preview | `design/screens/onboarding/first-quest-preview__v1__YYYY-MM-DD.png` |

### Main tabs (4)

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P4-04 | [`screens/04-home-today.md`](./screens/04-home-today.md#5-claude-design-prompt) | Home / Today | `design/screens/home/today__v1__YYYY-MM-DD.png` |
| P4-05 | [`screens/05-journey-grid.md`](./screens/05-journey-grid.md#5-claude-design-prompt) | Journey grid (7×5) | `design/screens/journey/grid__v1__YYYY-MM-DD.png` |
| P4-15 | [`screens/15-library-overview.md`](./screens/15-library-overview.md#5-claude-design-prompt) | Heritage Library overview | `design/screens/library/overview__v1__YYYY-MM-DD.png` |
| P4-17 | [`screens/17-homework.md`](./screens/17-homework.md#5-claude-design-prompt) | Homework (due + empty) | `design/screens/homework/due__v1__YYYY-MM-DD.png` + `empty` |
| P4-18 | [`screens/18-profile-switcher.md`](./screens/18-profile-switcher.md#5-claude-design-prompt) | Profile switcher (Me tab) | `design/screens/profile/switcher__v1__YYYY-MM-DD.png` |

### Episode / Quest / Results (3)

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P4-06 | [`screens/06-episode-detail.md`](./screens/06-episode-detail.md#5-claude-design-prompt) | Episode detail | `design/screens/episode/detail__v1__YYYY-MM-DD.png` |
| P4-07 | [`screens/07-quest-player.md`](./screens/07-quest-player.md#5-claude-design-prompt) | Quest player narrative + reward variants | `design/screens/quest/player-narrative__v1__YYYY-MM-DD.png` + `player-reward` |
| P4-14 | [`screens/14-results.md`](./screens/14-results.md#5-claude-design-prompt) | Results (3-star + 1-star) | `design/screens/results/3-stars__v1__YYYY-MM-DD.png` + `1-star` |

### Minigames (6)

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P4-08 | [`screens/08-minigame-match-sound.md`](./screens/08-minigame-match-sound.md#5-claude-design-prompt) | Match Sound (idle + wrong) | `design/screens/minigames/match-sound__v1__YYYY-MM-DD.png` |
| P4-09 | [`screens/09-minigame-build-letter.md`](./screens/09-minigame-build-letter.md#5-claude-design-prompt) | Build a Letter | `design/screens/minigames/build-letter__v1__YYYY-MM-DD.png` |
| P4-10 | [`screens/10-minigame-trace-stroke.md`](./screens/10-minigame-trace-stroke.md#5-claude-design-prompt) | Trace Stroke | `design/screens/minigames/trace-stroke__v1__YYYY-MM-DD.png` |
| P4-11 | [`screens/11-minigame-card-match.md`](./screens/11-minigame-card-match.md#5-claude-design-prompt) | Card Match | `design/screens/minigames/card-match__v1__YYYY-MM-DD.png` |
| P4-12 | [`screens/12-minigame-story-sequence.md`](./screens/12-minigame-story-sequence.md#5-claude-design-prompt) | Story Sequence | `design/screens/minigames/story-sequence__v1__YYYY-MM-DD.png` |
| P4-13 | [`screens/13-minigame-voice-echo.md`](./screens/13-minigame-voice-echo.md#5-claude-design-prompt) | Voice Echo (TTS honor system) | `design/screens/minigames/voice-echo__v1__YYYY-MM-DD.png` |

### Library / Card detail / Parent (4)

| # | Brief | Artifact | Output path |
|---|---|---|---|
| P4-16 | [`screens/16-card-detail.md`](./screens/16-card-detail.md#5-claude-design-prompt) | Card detail (unlocked + locked) | `design/screens/library/card-detail-unlocked__v1__YYYY-MM-DD.png` + `locked` |
| P4-19 | [`screens/19-parent-gate.md`](./screens/19-parent-gate.md#5-claude-design-prompt) | Parent gate (math) | `design/screens/parent/gate__v1__YYYY-MM-DD.png` |
| P4-20 | [`screens/20-parent-dashboard.md`](./screens/20-parent-dashboard.md#5-claude-design-prompt) | Parent dashboard (mobile) | `design/screens/parent/dashboard-mobile__v1__YYYY-MM-DD.png` |

---

## Suggested run order (12-week playbook overlay)

| Week | Phase | Prompts to run | Why |
|---|---|---|---|
| 1 | P0 + P1 | P0-1 → P0-2 → P0-3 → P1-1 | Lock identity + Hoya before anything downstream |
| 2 | P3 (components) | P3-1 → P3-2 → P3-3 → P3-4 → P3-8 | Promote to design-system once approved |
| 3 | P3 (components cont.) | P3-5 → P3-6 → P3-7 → P3-9 → P3-10 | Finish component matrix |
| 4 | P2 + P4-01..03 | P2-1 → P2-3 → P4-01 → P4-02 → P4-03 | Card art language + onboarding screens |
| 5 | P4-04 → P4-07 | Main tabs + Episode + Quest | Core loop screens |
| 6 | P4-08 → P4-13 | All 6 minigames | Gameplay screens |
| 7 | P4-14 → P4-18 | Results + Library + Card detail + Homework + Profile | Reward / collection / family |
| 8 | P4-19 → P4-20 + P2-2 (×30) | Parent gate + dashboard + start individual cards | Final polish + card art at scale |
| 9–12 | iteration + beta | rerun specific prompts as needed | Refine based on user testing |

---

## Versioning convention

- **v1** = the first locked production version (this PR establishes v1 of all briefs).
- **v2+** = iterations after user testing or product changes.
- Increment the brief's title heading + the prompt's output filename suffix together.

## Prompt-rerun checklist (use when iterating)

When you re-run a prompt with changes:

1. Copy the original prompt from the brief.
2. Add a `MODIFY:` section at the end describing the change request:
   ```
   MODIFY: Hoya in thinking pose — make the thought cloud larger by 25%
   and shift it 12px to the right.
   ```
3. Keep all other constraints intact (don't rewrite the prompt).
4. Save the new output with `__v{N+1}__YYYY-MM-DD.png` suffix.
5. Log the change in `design/prompts.md` with date + brief id + change summary.

## Linkage to packages/design-system

Each component brief includes a "validate against" line pointing to its
TSX file in `packages/design-system/src/components/<Name>/`. After
Claude Design produces a matrix sheet, the designer reviews the
geometric SVG/Lottie placeholder against the new sheet and either:

- ✅ Accepts → updates placeholder (separate PR, follows
  `design-handoff-skill`)
- ⏸ Defers → notes drift in `design/components/_review-week-NN.md`

The `.github/workflows/design-token-sync.yml` CI gate ensures
token-level drift (color values, spacing values) cannot land
silently.
