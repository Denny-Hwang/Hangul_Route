# Read along slide (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (Discover `exchange`), 5.2 · wireframe Panel 3 · row **LV-S1**
Mock: `mock/slide-read-along.html` (line B playing), `slide-read-along-a.html` (line A playing) · Stage 4 life q1 "밥 먹었어요? / 네, 먹었어요." · shots `slide-read-along-*`, `-gray`

## Anatomy and builds

- Kind label **Read along** (`slide.readAlong.label`).
- Two turns as bubbles: speaker A at the left, B at the right (at most 78 % of the width). Each: the speaker's name (content `speakerEn`, `presenter.size.caption`), the line at `presenter.size.prompt`, romanization and gloss on one row.
- **Playing line** (V6): the bar's Sound (or `S`) plays the current line; that bubble gets a `spacing.sm`-unit `brand.secondary` border, `brand.secondaryLight` ground and the `speaker` glyph (`brand.secondaryDark`) before the name; its text turns `text.primary` (secondary misses 7:1 on that ground). No stage speaker button.
- Builds `[line A, line B]`; with `tap` each romanization one build after its Korean. No voice: both lines show, nothing plays, the bar's teacher chip shows (spec 5.1).
- Reduced motion: the light switches without a fade.
