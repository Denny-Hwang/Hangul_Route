# Presenter home with presets and the preset preview (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 4.1, 4.6, 10, 12.2 · wireframe `classroom/lecture-presets.md` Panels A to E · row **LV-3**
Mock: `mock/presets.html`, `presets-chosen.html`, `presets-stage.html`, `presets-empty.html`, `presets-words-fallback.html`, `presets-customize.html`, `preset-preview.html` · shots `presets-320`, `-320-text200`, `-768`, `-1180`, `presets-*-375`, `presets-*-1180`, `presets-stage-320-text200`, `preset-preview-375`, `-1280`, `-320-text200`
Overview, constants, decisions V1 to V4, strings and review log: `lecture-v2.md`. Replaces the layout of `home.md` (v1); Quick lesson itself is unchanged and now sits under Customize.

## Anatomy (top to bottom)

1. **Header row** (unchanged from v1): Hoya, h1 **Lecture mode** (`learner.presenter.home.title`, changed), the language chips when the build offers two or more, **Keys and help**.
2. **Ready-made lessons** (h2, `presets.title`, renamed in the LV-0 review round 3) and the lead line (`presets.lead`, `text.secondary`).
3. **Preset cards**: one column below 30rem of container width, two from 30rem (768), three from 46rem (1180 beside Recent). Each card is one button following the disclosure pattern (`aria-expanded`, `aria-controls` naming its panel; no `aria-pressed`, section 10), named `a11y.presenter.presetCard` "{title}, about {n} minutes"): title (`size.bodyLg` bold), line (`text.secondary`), then "about {n} min" (`home.quick.minutes`) and the `arrow-right` glyph. `paper`, `border.subtle`, `radii.lg`, `shadows.card`.
   - Order: section 4.1. With something to follow (a Recent lesson within 60 days), **Next lesson** is first with `next.device`; with nothing to follow, **Start from zero: Hangul week 1** is first and **Next lesson** last (`presets-empty`).
   - **Open card** (one at a time, V1): its panel (`aria-controls`) spans the row, `borderWidth.thick` `text.primary` outline; inside: the fallback line when it applies (`presets.fallback.*`, V3), the stage chips (Stage by stage only: `stage.choose`, chips "Stage {n}", only stages with a ready cell), the length chips (`length.title`, "{n} min"; Word review 10 / 20; Warm-up has none), and **Start** (`presets.start.cta`, `brand.primaryDark`, at least 2 x hero wide). Chip groups are radiogroups (README D19). Changing a chip re-resolves the deck; nothing else moves.
4. **Recent lessons** (unchanged rows): right column from 900 px (`--side-col` 18rem), under the presets below it; empty and storage-off lines as v1.
5. **Customize** (`presets.customize.cta`): a disclosure button with the `plus` glyph (`dash` when open) and `customize.lead` under it; open, it shows today's Quick lesson panel unchanged (`presets-customize`).

## Start → preview (`preset-preview.html`)

Start on a card opens the start screen of the resolved deck (v1 `start-screen.md`) with two additions (V4): **What's in this lesson** (`presets.preview.title`) listing the resolved blocks in order (content title or the block's row label, and "about {n} min"), and a ghost **Customize** under Start, which goes back to the home with Customize open and nothing chosen (section 4.6). The deck is saved to Recent only at Start on this screen. The facts line and the skipped line are the builder's own (observation O1 in `lecture-v2.md`).

## States drawn

something to follow · a card open · Stage by stage open with Stage 3 · nothing to follow (Next lesson last, open with "Nothing to follow yet, so this starts with Hangul week 1.", empty Recent) · Word review with no words this week · Customize open · the preview. Storage off: Recent's v1 line; presets still work and Next lesson falls back.

## Accessibility

Every card, chip and button at least `touchTarget.min`; Start on the preview 1.25 x hero (v1). 320 px at 200 % text: one column, no sideways scroll, nothing clipped (`presets-320-text200`, `presets-stage-320-text200`, `preset-preview-320-text200`). Focus ring `border.focus` 3 px.
