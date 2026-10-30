# Quiz slide: question and teacher reveal (screen spec v1)

Spec: F-TCH-004 sections 3.4 (`quiz`, Match Sound text variant), 3.10 (reveal, D3), TD6 · wireframe H · PR 9 (story checks: PR 11; word to meaning: PR 9 and PR 12)
Mock: `mock/slide-quiz.html` (`#b=0` question, default answer), `slide-quiz-text.html`, `slide-quiz-meaning.html`, `slide-quiz-odd.html`, `slide-story-check.html` · shots `slide-quiz-question-*`, `slide-quiz-answer-*`, `-gray`, `slide-quiz-text-1280x720.png`, `slide-quiz-meaning-*`, `slide-quiz-odd-1280x720.png`, `slide-story-check-*`

## Anatomy

- **Question row**: Match Sound with a voice: the speaker button ("Play the sound") and "Which letter makes this sound?" (`presenter.size.prompt`; README D6). Without a voice or with sound off: the same question and a "Say it:" box with the spoken syllable and romanization (`textPrompt: true`). Word to meaning: "What does this mean?" (existing `learner.minigame.cultureQuiz.heading`) and the word as a `KoreanText` chip at `presenter.size.display`. Odd one out: "Which one is different?". A story check: the check's own prompt (content).
- **Options**: a 2 x 2 grid (2 or 3 options fill it in order). Each option is a paper card (`borderWidth.thick` units `border.strong`, `radii.xl` units) with its marker (circle 1, triangle 2, square 3, star 4: outlined shapes with the numeral inside, 80 units, `text.primary`; accessible name "Option 3, square") and the content: a letter at `presenter.size.display` with its romanization, or a gloss at `presenter.size.prompt`.
- With `romanization: 'tap'` the options' romanizations appear at the answer build.

## Answer build (the teacher's reveal)

- The correct option: `spacing.sm`-unit `feedback.success` border, `feedback.successLight` ground, the `check-circle` glyph (named "Hoya's answer"), every line `text.primary`.
- The others: `presenter.dimOpacity` (0.8), every line `text.primary`. No red, no cross, no "wrong", no count of hands, nothing tallied.
- "Hoya's answer" with a cheering Hoya joins the question row; a story check's explanation appears under the options (`presenter.size.body`).
- Greyscale: the answer still reads by the thicker border and the check mark (`slide-quiz-answer-1280x720-gray.png`).

## Notes

- Options never move between builds; the layout is reserved.
- A quiz with fewer than 4 distinct items is skipped by the builder and listed on the start screen; it is never drawn half-empty.
- **A crowded grid**: `pictureCrowded` lives in the shared `QuizOptions` (`QuizParts.tsx`), beside the gloss check, so every slide that draws the 2 x 2 grid gets it, a plain quiz included. A picture card never draws below its marker: a grid row shorter than the marker (`MARKER_BODY_FACTOR` x `presenter.size.body`, 80 units today) plus the card's padding and border (a key row or a two-line question above the grid, a Linux browser's wider fallback font) reports the grid as crowded, as a gloss that still spills out of its card at body size does. The slide then gives the grid room: a realia question draws its question at `presenter.size.body` (as its fit level 2 does), and the quiz slide draws the asked word of "What does this mean?" at `presenter.size.prompt`, not `display`; the listen question and the story check do not take the signal. Today only listen and realia questions carry pictures. A grid not measured yet is never crowded. Tests: `apps/mobile/src/screens/presenter/__tests__/fit-levels.test.tsx`.

## Pointed option (owner choice O2, decided 2026-10-29; `AMENDMENTS-PRESENTER-NAV.md` section 7.3; row PN-5)

Mock: `mock/nav-quiz.html#b=0&point=3` (and `#point=1` to `4`) · shots `slide-quiz-pointed-1280x720.png`, `-1920x1080`, `-1280x720-gray`, `-844x390` (the phone rail), and the projector look `slide-quiz-pointed-1280x720-projector.png` · wireframe `classroom/lecture-nav.md` Panel B

- **A tap or click on an option points at it**; keys `1` to `4` do the same. Tapping the pointed option again clears it, tapping another moves it there; one option at a time. It never steps, never reveals, never shows or hides a bar.
- **Look**: a dashed outline, `STAGE_BORDER` (`borderWidth.thick`) units in `text.primary`, never thinner than `STAGE_BORDER_MIN` (`borderWidth.base`), drawn `spacing.sm` units **outside** the card's own border, so it reads as a second line rather than a thicker edge; and the `pin` glyph (`Icon/glyphs.ts`, the map pin) at the marker's top right, on a `surface.paper` disc over the marker's corner, at `max(spacing.xl, presenter.size.body units)` (40 units, above the `presenter.size.caption` floor of the spec; 24 px on a phone). The marker's number stays readable (the disc sits on the shape's corner, never on the numeral), and the pin never covers the letter, the word or the picture.
- **Nothing judges**: no fill change, no `feedback` colour, no motion (it appears at once, with or without reduced motion), nothing tallied. The card's own border, ground and text are unchanged.
- **Any step clears it**: `next` (the Reveal build included), `prev`, `first`, `last`, `goto`. So the answer build (`slide-quiz-answer-*`) never shows a pick still outlined, and nothing on the stage reads as "that pick was wrong".
- **At the back of a room** (`slide-quiz-pointed-1280x720-projector.png`, lowered contrast, washed out): the dashed line and the pin still read against the cards; the outline is `text.primary` on `surface.paper` (16.10:1 before the projector). Greyscale (`-gray`): the same picture, since no colour is involved.
- **Announced**: the live region says `a11y.presenter.pointed(n)` ("Option 3 pointed at" / "Opción 3 señalada" / "3번 선택지를 표시했어요") or `a11y.presenter.unpointed`.
- **The phone** (`slide-quiz-pointed-844x390.png`): the same outline at the rail's unit (0.58); the 2 px floor keeps it visible.
- Listen and reply grids and rows: `slide-listen-reply.md` "Pointed option" (on one-column rows the outline is centred in the row gap instead of `spacing.sm` units out, so the 2 px floor never reaches the next row at a phone's unit).

