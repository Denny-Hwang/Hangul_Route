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
