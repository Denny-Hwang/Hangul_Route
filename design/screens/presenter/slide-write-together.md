# Write together slides (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (`type-hangul`, `trace-word`, `write-frame`), 5.2, 5.3, LV-D8 · wireframe Panel 7 · row **LV-S4**
Mock: `mock/slide-write-type.html` (Stage 6 life q1 t3 "Ask for water."), `slide-write-trace.html` (Stage 7 life q1 w1 아침), `slide-write-frame.html` (Stage 7 life q2 f1), `slide-write-own-name-0/1/2.html` (Stage 7 letters q3, the free-entry round) · shots `slide-write-*`, `-b0`

## Common (V10)

One row at the top: the kind label **Write together** (`slide.write.title`) and, with the `pencil` glyph, "Write on paper or on your own device. Nothing is typed here." (`slide.write.where`, caption size, `text.primary`). Nothing on these slides takes input; the answer comes only on the teacher's click; no timer starts by itself.

## Variants

- **type**: the variant line "Type it on your own device, then look." (`slide.write.type`), the prompt (`promptEn`, `presenter.size.prompt`) and its picture when it has one; the answer build shows the target in Korean (`presenter.size.title`), romanization and gloss.
- **trace** (V11): the word as a large outline ghost (`presenter.size.glyph`, the presenter font with a 6-unit `text.secondary` stroke); beside it "Trace it in the air, then on paper." (`slide.write.trace`) and, at the answer build, romanization and gloss.
- **frame**: "Fill the gap with a word from the list." (`slide.write.frame`), the frame at `presenter.size.title` with its gap box ("gap"), romanization and gloss; the bank as KoreanText chips (second build); "For example" (`slide.write.example`) with the frame filled by the first bank word (third build; observation O2 on the particle).
- **own name** (V12): "Write your own name in Hangul on paper." (`slide.write.ownName`); build 0 the frame "제 이름은 ___이에요/예요." with romanization and gloss; builds 1 and 2 the sound table, five groups each (every block with its romanization, 84 units wide, 13 across). No name is ever typed, shown or stored.

Builds: `[prompt, answer]` (type, trace), `[frame, bank, example]` (frame), `[frame, sound table 1, sound table 2]` (own name); romanization at the answer build with `tap`.

## As built (LV-S4)

Spec: AMENDMENTS-LECTURE-V2 section 5.2 "As built in LV-S4". Shots: `apps/mobile/e2e/web/presenter-write.spec.ts` with `HR_SHOTS=1` (1280 x 720, 1920 x 1080, 568 x 320, 844 x 390, es and ko).

- The mocks are followed: the head row (kind label, pencil, the line), the variant line, the type prompt with its picture on the right, the trace ghost with the line and the answer beside it, the frame with its gap box and the bank chips, "For example" in `text.secondary` caption bold, and the name round's table in place of its frame.
- **The type picture** is decorative: the prompt beside it already names it, and its name is never the answer's.
- **Two slots** (Stage 7 life q3 f3, rites q2 f1): one chip row per slot's bank, and the example fills both gaps.
- **The sound table on a phone**: at 568 x 320 the 18 px floor makes a block wider than 84 units, so the slide's compact levels let each block take its own width and drop its padding; a page of 60 blocks still fits the stage.
- **Nothing is read twice**: a sound-table block's Korean and romanization are its own text (no extra label), and the ghost is plain Korean text drawn as an outline.
