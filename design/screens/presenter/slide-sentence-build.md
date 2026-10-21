# Sentence build slide (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (`order-it`, including the Stage 7 Check), 5.2, 10 · wireframe Panel 6 · row **LV-S3**
Mock: `mock/slide-build-0.html` (bank), `slide-build-2.html` (two tiles placed), `slide-build-4.html` (whole), `slide-build-particle.html` · Stage 3 life q3 r1 "친구가 학교에 가요." with the distractor 와요; Stage 7 life q2 r4 "저녁에 달걀을 먹어요." for the particle · shots `slide-build-*`

## Anatomy (V9)

- Kind label **Build the sentence together** (`slide.build.title`); the question **Which word comes next?** (`slide.build.next`) or, on a particle tile, **Which ending fits?** (`slide.build.particle`) at `presenter.size.prompt`.
- **Sentence line**: placed tiles in order, then a dashed empty box per tile still to come; a `text.primary` stage rule under it.
- **Bank** (`surface.sunken`, `radii.xl` units): the shuffled tiles (seeded, never already in order) and the distractors. A placed tile leaves a dashed ghost in its bank place, so nothing reflows.
- **Tile**: Korean at `presenter.size.title` on paper, a stage border in `text.primary`, `radii.lg` units, 108 units tall.
- **Particle tile**: the stem and both endings in dashed boxes with a slash; the next click keeps the one that fits.
- **Whole build**: the romanization and the meaning appear under the line; the distractor stays in the bank at `presenter.dimOpacity`, never crossed or coloured.

## Builds and announcements

`[bank, tile 1 … tile n, (particle), whole]`; romanization only at `whole`. Each move is announced politely, "{word} placed" (`a11y.presenter.tilePlaced`). Reduced motion: a tile appears in its slot (no travel).

## As built (LV-S3)

Spec: AMENDMENTS-LECTURE-V2 section 5.2 "As built in LV-S3". Shots: `apps/mobile/e2e/web/presenter-build.spec.ts` with `HR_SHOTS=1` (1280 x 720, 1920 x 1080, 568 x 320, 844 x 390, es and ko).

- **Tiles** drop the sentence mark, as the learner's Sentence Builder does (the mock drew 가요. beside the distractor 와요, so the mark told the last word apart); the meaning and the romanization still come at `whole`.
- **The particle build** comes right after its tile reaches the line, as the particle mock draws it (the third place still empty while the room chooses the ending); the endings are in their pair's order (을/를), never the content's.
- **One place size on the line**: every place, empty or placed, is as wide as the widest tile (or the particle tile with both endings) and as tall as a tile, so the line never reflows, nothing under it moves and no empty box's size gives its tile away; the mock's 200-unit empty box is this rule's empty place. Every move is an instant swap (nothing travels, with reduced motion or not).
- **Fit**: two compact levels (tiles at `presenter.size.prompt`, then everything at `presenter.size.body`); the longest shipped sentences (제가 좋아하는 동물은 호랑이예요, a particle on the last tile) take the second at 1280 x 720.
- **Empty places** are dashed in `border.shape` (3:1 on paper: they tell the room how many words are still to come); a bank ghost keeps the quieter `border.strong` (decorative, hidden from readers). A place wider than the line holds takes the line's inner width and may grow taller, so nothing leaves the line sideways.
- **The live region** on arriving or stepping back says what the stage shows at that build: the words already on the line, then its question (the ending question on a particle tile still choosing); at `whole`, where Previous from the next slide lands, the sentence with its romanization and meaning. A forward move says "{word} placed". The kind it names is **Build a sentence** (`grid.kind.build`). The mocks carry an "As built" note and these rules.
- **No picture**: the round's picture shows the meaning, which the room meets only at `whole`.
