# Sequence slide (screen spec v1)

Spec: F-TCH-004 section 3.4 (`sequence`) · wireframe (row of section 3.4) · PR 7
Mock: `mock/slide-sequence.html` (`#v=steps`, `#v=order`; Hanbok and the Bow's New Year Order) · shots `slide-sequence-steps-*`, `slide-sequence-order-*`, `-gray`

## Builds

- `step` x n: the steps in their true order, two columns, each a numbered circle (80 units, `borderWidth.thick` units `text.primary`) with the step's gloss (bold, `presenter.size.body`), Korean (`presenter.size.prompt`) and romanization.
- `rom` (only with `romanization: 'tap'`): every step's romanization at once.
- `order`: the question "What comes first?" (`presenter.size.title`) and the steps in the builder's `shuffled` order, each marked with the quiz's shape-and-number markers instead of numbers, so the room can answer "triangle, 2" without the true order showing. The teacher reveals by going back a build (the true order) or just saying it; nothing is collected.
