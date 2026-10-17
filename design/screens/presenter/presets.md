# Presenter home with presets and the preset preview (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 4.1, 4.6, 10, 12.2; section 18.2 to 18.4 (2026-10-16: the home's Back, Display (Aa), the grouped chooser) · wireframe `classroom/lecture-presets.md` Panels A to E (C and E revised 2026-10-16) · row **LV-3**
Mock: `mock/presets.html`, `presets-chosen.html`, `presets-stage.html`, `presets-empty.html`, `presets-words-fallback.html`, `presets-customize.html`, `presets-customize-stories.html`, `presets-customize-empty.html`, `preset-preview.html` (all re-shot 2026-10-16) · shots `presets-320`, `-320-text200`, `-768`, `-1180`, `presets-*-375`, `presets-*-1180`, `presets-stage-320-text200`, `preset-preview-375`, `-1280`, `-320-text200`; the grouped chooser: `presets-customize-320.png`, `-768`, `-1180`, `-375`, `-320-text200` (whole pages), `presets-customize-footer-375.png`, `-footer-1180` (the window scrolled to Customize, with the sticky footer), `presets-customize-stories-375.png`, `presets-customize-empty-375.png`
Overview, constants, decisions V1 to V4, strings and review log: `lecture-v2.md`. Replaces the layout of `home.md` (v1); Quick lesson itself is unchanged and now sits under Customize.

## Anatomy (top to bottom)

1. **Top row** (2026-10-16): **Back** at the top left (`common.buttons.back`, the `arrow-left` glyph; `history.back()` with a 1 s fallback to `/` only when this tab has an app page before `/present`, recorded at boot; else a link to `/`, which is the case in every new tab the console, All lessons and E5 open; `AMENDMENTS-LECTURE-V2.md` section 7 item 3), and at the right the **Display (Aa)** control (`common.display.*`) and **Keys and help**. ~~The language chips~~ are gone (section 18.4). **Header row**: Hoya, h1 **Lecture mode** (`learner.presenter.home.title`, changed).
2. **Ready-made lessons** (h2, `presets.title`, renamed in the LV-0 review round 3) and the lead line (`presets.lead`, `text.secondary`).
3. **Preset cards**: one column below 30rem of container width, two from 30rem (768), three from 46rem (1180 beside Recent). Each card is one button following the disclosure pattern (`aria-expanded`, `aria-controls` naming its panel; no `aria-pressed`, section 10), named `a11y.presenter.presetCard` "{title}, about {n} minutes"): title (`size.bodyLg` bold), line (`text.secondary`), then "about {n} min" (`home.quick.minutes`) and the `arrow-right` glyph. `paper`, `border.subtle`, `radii.lg`, `shadows.card`.
   - Order: section 4.1. With something to follow (a Recent lesson within 60 days), **Next lesson** is first with `next.device`; with nothing to follow, **Start from zero: Hangul week 1** is first and **Next lesson** last (`presets-empty`).
   - **Open card** (one at a time, V1): its panel (`aria-controls`) spans the row, `borderWidth.thick` `text.primary` outline; inside: the fallback line when it applies (`presets.fallback.*`, V3), the stage chips (Stage by stage only: `stage.choose`, chips "Stage {n}", only stages with a ready cell), the length chips (`length.title`, "{n} min"; Word review 10 / 20; Warm-up has none), and **Start** (`presets.start.cta`, `brand.primaryDark`, at least 2 x hero wide). Chip groups are radiogroups (README D19). Changing a chip re-resolves the deck; nothing else moves.
4. **Recent lessons** (unchanged rows): right column from 900 px (`--side-col` 18rem), under the presets below it; empty and storage-off lines as v1.
5. **Customize** (`presets.customize.cta`): a disclosure button with the `plus` glyph (`dash` when open) and `customize.lead` under it; open, it shows ~~today's Quick lesson panel unchanged~~ the **grouped chooser** (2026-10-16, section 18.3; `presets-customize*.html`):
   - **What to add** (`presets.chooser.label`) and four **tabs** (`role="tablist"`; pills at `touchTarget.min`, the selected one `brand.primaryDark` with `text.onPrimary` and bold, the others paper with `border.strong`; arrows move and select): Lessons, Stories, Word topics, Letters. One panel shows at a time.
   - **Lessons**: "Choose a stage" and the stage chips (radiogroup; default the open preset's stage, else Stage 1), then the stage's episodes as checkbox rows (the v1 `.pick` row: box, title, "about {n} min"), each with a **{n} lessons inside** disclosure button (`presets.chooser.lessonsIn`) that opens its single lessons as indented checkbox rows (a `border.subtle` rule on the left). Five rows at most (one per theme). **An episode and its lessons are one tri-state choice** (review 2026-10-17, AMENDMENTS-LECTURE-V2 section 18.3): checking the episode checks its lessons and disables them (Word Builder in `presets-customize.html`); choosing some lessons draws the episode row **mixed** (`.pick.mixed`: the `dash` glyph in the box, `aria-checked="mixed"`; Lunch Box Words with Fruit and Snacks chosen); checking a mixed episode replaces those lessons with the one episode. So no lesson enters the deck twice.
   - **Stories** and **Word topics**: 8 rows, then **Show 8 more** (`presets.chooser.showMore`). **Letters**: Consonants, Vowels.
   - **Your lesson** (`presets.chooser.tray.title`): the chosen parts in order on `surface.sunken` rows (number, title, "about {n} min", a remove button named "Remove {title}"); empty: the dashed line `presets.chooser.tray.empty` (`presets-customize-empty`).
   - **Sticky footer**: "{n} parts · about {m} min" (`presets.chooser.summary`, a polite status) and **Build lesson**; disabled with `home.quick.nothing` when nothing is chosen. It stays at the bottom of the window while Customize scrolls (`presets-customize-footer-*`).
   - Titles come localized (content overlays), English where none.

## Start → preview (`preset-preview.html`)

Start on a card opens the start screen of the resolved deck (v1 `start-screen.md`; no picker row from 2026-10-16; **Back to lessons** and **Display (Aa)** share its top row) with two additions (V4): **What's in this lesson** (`presets.preview.title`) listing the resolved blocks in order (content title or the block's row label, and "about {n} min"), and a ghost **Customize** under Start, which goes back to the home with Customize open and nothing chosen (section 4.6). The deck is saved to Recent only at Start on this screen. The facts line and the skipped line are the builder's own (observation O1 in `lecture-v2.md`).

## States drawn

something to follow · a card open · Stage by stage open with Stage 3 · nothing to follow (Next lesson last, open with "Nothing to follow yet, so this starts with Hangul week 1.", empty Recent) · Word review with no words this week · Customize open · the preview. Storage off: Recent's v1 line; presets still work and Next lesson falls back.

## Accessibility

Every card, chip and button at least `touchTarget.min`; Start on the preview 1.25 x hero (v1). 320 px at 200 % text: one column, no sideways scroll, nothing clipped (`presets-320-text200`, `presets-stage-320-text200`, `preset-preview-320-text200`). Focus ring `border.focus` 3 px.

## Back from the start screen (2026-10-16, section 18.2)

**Back to lessons** and the browser back return to this page exactly as it was: the open card, its length and stage chips, Customize open or closed, the chooser's tab and choices, and the scroll position. Nothing is saved to Recent before Start.

## Constants (2026-10-16)

`mock/presenter-or.css`: `--sheet-max` (`layout.maxWidth.reading`, the More sheet's width cap); the chooser and footer use tokens only (`touchTarget.min`, `spacing.*`, `radii.pill`, `radii.md`, `border.*`, `surface.sunken`). Media query 480 px (`layout.shortHeight`) for the phone start screen; a media query cannot read a custom property.
