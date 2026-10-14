# Heritage card slide (screen spec v1)

Spec: F-TCH-004 section 3.4 (`card`) · PR 7
Mock: `mock/slide-card.html` (`card:book`) · shots `slide-card-1280x720.png`, `-1920x1080`

## Anatomy and builds

- `art`: `HeritageCardArt` at 360 units on the left (a bundled card it cannot draw, such as `card:sagwa`, shows its `CardArt` face at the same size instead: the story cover, the set plate or its Korean word on the theme tint, design/components/CardArt/spec.md, so the `art` build always shows a picture); right: "Heritage card" (kind label, `presenter.size.caption`), the card title (`presenter.size.title`), the Korean name as a `KoreanText` chip.
- `rom` (only with `tap`): the chip's romanization.
- `fact`: the card's fact (`presenter.size.body`), content text in the deck's language.
- No "earned", no star, no collection count: presenting never awards anything (section 3.9).
