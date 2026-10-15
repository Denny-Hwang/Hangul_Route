# Realia slide and realia question (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (Discover `realia`, `realia-read`), 5.2, 10 · wireframe Panel 4 · rows **LV-S1** (realia) and **LV-S2** (question)
Mock: `mock/slide-realia.html` (Stage 6 life q1, the menu), `slide-realia-question.html` (q3 r1 "How much is this?", `#b=0` question, default answer) · shots `slide-realia-*`, `slide-realia-question-*`, `-b0`, `-gray`

## The sheet on the stage

RealiaSheet's menu anatomy in stage units (`--sheet-w` 420): the awning dressing (`drawProp('prop:realia-awning')`, `spacing.xl` units tall), the paper (`surface.paper`, `text.secondary` border, `radii.md` units), the centred title (Korean at `presenter.size.prompt` with romanization), then one row per entry: Korean (`presenter.size.body`) over romanization (`caption`), a dotted `border.strong` leader, the value right-aligned the same way. The sheet's accessible name is its `altEn` (F-CURR-001 §3.14).

## Realia slide (LV-S1)

- Right column: the item's caption (`captionEn`, `presenter.size.body`), then the key words as KoreanText chips (Korean at body size, romanization and gloss at caption size) at the second build.
- Builds `[sheet, key words]`; with `tap` the key words' romanization one build later.

## Realia question (LV-S2, V7)

- Right column: the question (`questionEn`) as the heading at `presenter.size.prompt`; under it the key word chip with "Look closely and find the answer." (`slide.realia.ask`) beside it; the options below, one row each (V8).
- **Answer build**: the correct option as every quiz (README D6: `feedback.success` border, `successLight`, check); "Hoya's answer" with the cheering Hoya takes the lead line's place in the key row (the row keeps a 96-unit height, so nothing moves); the answer entry on the sheet gets the `found` look and the `check` glyph.
- Builds `[question (+ key word), answer]`; with `tap`, option romanizations at the answer build. The sheet stays the same between the realia slide and its questions, so the room keeps its place.
