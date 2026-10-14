# Letter slide (screen spec v1)

Spec: F-TCH-004 sections 3.4 (`letter`), 3.6 (glyph font, stroke guide), 3.7 (voice, fallbacks, romanization) · wireframe D · PR 6 (no-voice text: PR 9)
Mock: `mock/slide-letter.html`, `slide-letter-novoice.html`, `slide-letter-tap.html` · shots `slide-letter-1280x720.png`, `-1920x1080`, `-build0`, `-gray`, `-4x3`, `-21x9`, `slide-letter-novoice-*`, `slide-letter-tap-build0-1280x720.png`, and the five builds on `builds-board-1440.png`

## Anatomy (three columns)

1. **Glyph**: the jamo in `HR Presenter KR` at `presenter.size.glyph` (380 units), and its romanization under it at `presenter.size.prompt` in `text.secondary`.
2. **Stroke guide**: `StrokeHint` at 360 units in a paper panel (`border.subtle`, `radii.xl` units); numbered start dots (README Constants). Under it "Simplified stroke guide" (`presenter.size.caption`) until the jamo is in `reviewedStrokeIds`. `strokeGuide: false` removes the column. Reduced motion: the still numbered diagram (as drawn).
3. **Facts**, top to bottom: the sound row (a round speaker button, `brand.secondary` border and `brand.secondaryDark` glyph, at least 96 px, named "Play the sound"; then the carrier syllable, e.g. 가 ga, at `presenter.size.prompt`); "Letter name: giyeok" (bold, `presenter.size.body`); the sound hint (`text.secondary`); the example word as a `KoreanText` chip (Korean and romanization in `text.primary` on `brand.secondaryLight`, `brand.secondary` border) with its gloss after it.

## Builds

`ko` (glyph and romanization), `stroke`, `sound` (plays on arrival forward), `name` (name and hint), `example`. With `romanization: 'tap'` the romanization under the glyph is its own build right after `ko` (`slide-letter-tap-build0` shows the glyph alone). A build that is not reached yet keeps its space, so nothing shifts when it appears.

## No Korean voice or sound off (PR 9)

The sound row becomes a "Say it:" box on `surface.sunken`: the spoken syllable and its romanization at `presenter.size.prompt` and the IPA in brackets, all `text.primary` (the only 7:1 text on sunken); the bar shows the "No Korean voice here. You say it!" chip. When the browser blocks audio after a long idle, the speaker's name reads "Tap to hear" (`learner.audio.tapToHear`).
