# Sentence pattern slide (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (Discover `pattern`), 5.2, 10 · wireframe Panel 2 · row **LV-S1**
Mock: `mock/slide-pattern.html` (Stage 3 life q1, "___을/를 먹어요.") · shots `slide-pattern-*`, `slide-pattern-b0-1280x720`

## Anatomy and builds

- Kind label **Sentence pattern** (`slide.pattern.label`).
- The frame at `presenter.size.title`; each `___` is a gap box (`--slot-w` 160 units, `surface.sunken`, a stage border in `text.primary`, `radii.md` units) named "gap" (`a11y.presenter.slot`). Under it, the frame's romanization and gloss on one line.
- The note (`noteEn`, overlay-localized) at `presenter.size.body`; its `{ko:…}` tokens are KoreanText chips with romanization ("을 eul").
- Two examples, one row each: a numbered circle (64 units), the Korean at `presenter.size.prompt`, romanization and gloss on the same row.
- Builds `[frame, note, example 1, example 2]`; with `tap` the frame's and each example's romanization come one build after their Korean. Parts sit `spacing.md` units apart (`.tight`) so two examples and a two-line note fit 504 units.
