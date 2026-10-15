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
