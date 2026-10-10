# ProfileAvatar (component spec v1)

Spec: `docs/specs/F-LEARN-001-all-ages-onboarding.md` §3.6 (L10, L11, L12) · wireframes: `design/wireframes/onboarding/all-ages-onboarding.md` (H, J, K), `design/wireframes/profiles/create-learner.md`
Code: `apps/mobile/src/components/ProfileAvatar.tsx` (paint) · `apps/mobile/src/logic/profiles/profile-avatar.ts` (view model, unit-tested) · `packages/design-system/src/components/Hoya` (`variant` prop) · tokens `hoya.fur*` in `design/tokens/colors.v1.md`

## What it is

The learner's own tinted tiger cub. It shows **who** is learning (profile switcher, grown-up dashboard, Home Profile entry, Results chip). The guide Hoya (greeting, bubbles, quest intros) is a different character and stays the standard gold `<Hoya/>`; the two never share a surface without the cub being the smaller one (L10).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `avatar` | `string` (`AvatarKind` when stored) | - | Unknown values draw the orange cub, never throw |
| `size` | number (dp) | - | Outer circle diameter |
| `pose` | `HoyaPose` | `idle` | Switcher uses `cheering` for the active profile |
| `ring` | boolean | `false` | Home Profile entry only |
| `testID` | string | - | |

## Colour contract (L11)

The avatar **name** decides the colour: `hoya-blue` is blue, `hoya-green` is green, `hoya-purple` is purple, `hoya-pink` is pink, `hoya-orange` is the gold cub. The Pillar `theme` in `AVATAR_PRESETS` is catalogue data and colours nothing.

| Avatar | Variant | Fur token | Shade token (ring) | English label |
|---|---|---|---|---|
| `hoya-orange` | orange | `hoya.fur` #F2B33D | `hoya.furDark` #B5862A | Book Tiger |
| `hoya-blue` | blue | `hoya.furBlue` #4891CB | `hoya.furBlueDark` #2E6A9E | Home Tiger |
| `hoya-green` | green | `hoya.furGreen` #5E9E3E | `hoya.furGreenDark` #437A2A | Feast Tiger |
| `hoya-purple` | purple | `hoya.furPurple` #7C57C0 | `hoya.furPurpleDark` #5B3F9A | Mountain Tiger |
| `hoya-pink` | pink | `hoya.furPink` #D0527F | `hoya.furPinkDark` #A33A62 | Craft Tiger |

Stripes, eyes, nose, cheek and belly are shared by all five. Only the fur fill (head, ears, paws) and the shadow ellipse use the variant.

## Anatomy

```
 no ring (switcher 72, dashboard 40, results 40)       ring (Home entry 52)
   ┌───────────┐                                         ┌───────────┐  <- 3 dp ring (borderWidth.thick)
   │   cub     │  paper-coloured circle, cub fills it    │ ┌───────┐ │     in the variant's SHADE
   │ (Hoya     │                                         │ │  cub  │ │     cub inset by ring + 4 dp
   │  variant) │                                         │ └───────┘ │
   └───────────┘                                         └───────────┘
```

- Circle background `surface.paper`; ring colour `hoya.*Dark` of the variant (not the fur: the gold fur is 1.8:1 on canvas, its shade is 3.1:1; WCAG 1.4.11 needs 3:1 for a UI graphic). The cub inside is drawn in the fur.
- Cub inside a ring: `diameter - 2 * (borderWidth.thick + spacing.xs)`. Without a ring the cub fills the circle.
- Home entry: ring 52 dp + the visible caption "Profile" and accessible name "Profile and settings" (PR #95, unchanged) keep the control above the 64 dp floor.

## Accessibility

- **Decorative**: no label of its own (`accessibilityElementsHidden`, `aria-hidden`). The control around it carries the name ("Profile and settings", "Switch to Mina") or the name sits beside it (dashboard, Results chip).
- **Colour is never the only cue** (WCAG 1.4.1): wherever a cub is *chosen* it has its English label under it ("Home Tiger"); where it is *shown* the learner's name sits next to it.
- **Non-text contrast** (WCAG 1.4.11), enforced in `packages/design-system/src/__tests__/contrast.test.ts`: every fur against `hoya.stripes` at least 3:1; the four tinted furs and all five shades against `surface.paper` and `surface.canvas` at least 3:1.
- **Colour-blind check** (design review, simulation by Machado deuteranopia / protanopia, CIELAB distance): the closest pairs are blue/purple (about 15 under deuteranopia) and orange/green (about 22 under protanopia); none below 10. The lightness band that the 3:1 rules allow is narrow, so the label is the real second cue.
- **Motion**: none added; the Hoya pose pulse already respects reduced motion.
- No emoji, no text inside the circle.

## States

| State | Look |
|---|---|
| default | cub in a paper circle |
| active profile (switcher) | `pose="cheering"`; the card around it changes to `brand.primaryLight` with a "Playing now" pill (existing) |
| ring (Home) | variant shade ring |
| unknown avatar string | orange cub |
| picker selected (PR 4b/8) | `accessibilityRole="radio"`, checked state, ring + label; selected is never colour alone |

## Where it appears

| Surface | Size | Ring | Notes |
|---|---|---|---|
| Profile switcher card | 72 | no | name + (PR 5) level label under it |
| Grown-up dashboard card | 40 | no | beside the learner's name |
| Home Profile entry | 52 | yes | caption "Profile" below |
| Results header | 40 | no | in a name chip above the guide Hoya |
| Create / Edit profile picker | 64+ | on selected | PR 4b / 8, with the label under each cub |
| Web console roster | 28 px chip | - | `AvatarChip`, PR 7: circle filled with the variant's shade, English label as `aria-label` |
