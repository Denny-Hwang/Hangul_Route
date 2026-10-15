# Sentence slide (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (Discover `sentence`), 5.2 · wireframe `classroom/lecture-big-screen-v2.md` Panel 1 · row **LV-S1**
Mock: `mock/slide-sentence.html` (Stage 3 life q1, "물을 마셔요.") · shots `slide-sentence-1280x720`, `-1920x1080`, `-b0-1280x720`

## Anatomy and builds

- Kind label **Sentence** (`slide.sentence.label`, `presenter.size.caption`, V5).
- Left column: the Korean at `presenter.size.title` (`word-break: keep-all`), its romanization at `presenter.size.body` (`text.secondary`), a `border.subtle` rule, then the gloss in the presenter locale at `presenter.size.prompt`.
- Right: the item's picture (`PictureArt` / WordArt) in a 300-unit paper tile, only when `hasPicture`; with no picture the text column takes the width (wireframe "no picture").
- Builds `[ko+rom, gloss, picture]` (`always`); with `tap`: `[ko, rom, gloss, picture]`. Announced "Slide 14 of 31, Sentence, 물을 마셔요., mureul masyeoyo".
