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

## As built (LV-S2)

Spec: AMENDMENTS-LECTURE-V2 section 5.2 "As built in LV-S2". Shots: `apps/mobile/e2e/web/presenter-questions.spec.ts` with `HR_SHOTS=1`.

- **No second sheet slide**: every shipped Realia Read sheet is already the quest's Discover realia page (LV-S1), so its questions follow at once; a sheet no page showed gets one realia slide of its own first (the sheet alone).
- **The key row**: the lead line sits in a slot at least `REALIA_ASK_MIN` (240) units wide, under the key word in a narrower column (a long Spanish line, a phone); at the reveal "Hoya's answer" (a `touchTarget.min` Hoya, caption words) takes its place inside that slot, so nothing moves.
- **The found line**: RealiaSheet's `found` look on the answer line; on a price card the `check` glyph is smaller, in the card's top-left corner, so the card's text keeps its place.
- **Options**: Korean (romanization, no meaning), a plain figure at prompt size, or pictures; pictures beside a sheet that leaves less than `REALIA_GRID_MIN` (480) units (a price-card sheet grown for a phone's text floor) are rows of pictures as tall as their markers.
- **Fit**: compact rows, then the question at body size, then romanizations at caption size. A picture grid whose rows come out shorter than their markers (a key row that wraps above it) also draws the question at body size. The sheet fits on its own: a sheet taller than the content area (the found line's glyph can wrap its value onto one more row, and a Linux browser's wider Latin fallback font can wrap a line before that) is drawn `tight`, with the same widths: the dressing strip at `spacing.sm` units, the paper's top and bottom padding at `spacing.xxs` and no gap between lines.

## The CM-47 kinds (F-CURR-002 row CM-47)

- **Anatomy**: the stage draws each of the eight added kinds with the anatomy of the learner's `RealiaKindSheet` (design/screens/minigame-realia-read/README.md D9-D12) in stage units at the presenter's text sizes, the lines as text: rows (recipe card, receipt, food label, timetable) with the kind's rule between rows, tiles (forecast, calendar) like the price cards, a map's places with their pins under the drawn park, a poster's lines centred. The dressing (`REALIA_KIND_REGISTRY`) is a strip `spacing.xl` units tall (a map's park `spacing.jumbo`), a receipt's torn edge `spacing.sm` under it.
- **Width**: tiles side by side (a forecast's days, a calendar's dates) take the price cards' `SHEET_CARDS_W` (600) units, every other kind the `SHEET_W` (420); a receipt is a strip of at most 384 units, centred.
- **Lazy**: the looks and dressings come from the realia kinds chunk (`useRealiaKinds`), never the presenter's own bundle, so the learner chunk and the presenter share them; until it is in, the sheet is the plain sheet.
- **Fit**: `tight` changes on these kinds what it changes on the four: the strip (a map's park from `spacing.jumbo` to `spacing.xl`), the sheet's top and bottom padding and its gap after the title, and between lines either each ruled row's half gap or the list's gap; widths and horizontal padding stay (`fit-levels.test.tsx`).
- **Shipped**: the station departure board and Hoya's trip plan (Holidays S6 q2, q3) are timetables and the order slip (Life S6) a receipt; the presenter question e2e (`presenter-questions.spec.ts`) draws them in en, es and ko at 1280 x 720 and 568 x 320.
