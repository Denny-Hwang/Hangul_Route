# Syllable slide (screen spec v1)

Spec: F-TCH-004 section 3.4 (`syllable`) · wireframe E · PR 7
Mock: `mock/slide-syllable.html` · shots `slide-syllable-1280x720.png`, `-1920x1080`, `slide-syllable-build0-1280x720.png`, builds on `builds-board-1440.png`

## Builds

- `parts`: ㄱ + ㅏ centred at `presenter.size.display`, the plus a `plus` glyph in `text.secondary` (64 units).
- `join`: the parts become the block (README D5). 가 at `presenter.size.glyph`, with the parts kept small beside it (`presenter.size.prompt`, `aria-hidden`). The move is the parts sliding together (`motion.duration.base`); under reduced motion a crossfade.
- `rom`: the romanization (`presenter.size.prompt`, `text.secondary`); a hyphenated `syllableSplit` only here and on word slides when the content gives one.
- `sound`: the speaker button; the syllable plays on arrival forward.
