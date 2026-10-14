# Vocabulary flashcard (screen spec v1)

Spec: F-TCH-004 section 3.4 (`vocab`) · wireframe F · PR 7 (topic words: PR 12, `slide-topic.md`)
Mock: `mock/slide-vocab.html` (김치 from Hello Kimchi & Rice) · shots `slide-vocab-1280x720.png`, `-1920x1080`

## Anatomy and builds

- Left column: the word at `presenter.size.display` in the presenter font, its romanization under it (`presenter.size.prompt`, `text.secondary`), the gloss under that (`presenter.size.prompt`, `text.primary`).
- Right: the picture at 360 units when there is one (`HeritageCardArt` for a card pair, WordArt for a topic word); none means text only, as here (the quest's card pairs carry no picture).
- Builds `ko` (word and romanization), `gloss`, `art`. With `romanization: 'tap'` the romanization is its own build after `ko`; the gloss is never hidden by that setting.
