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
