# Word topic slides (screen spec v1)

Spec: F-TCH-004 sections 3.3 rule 4, 3.4 (`vocab`) · PR 12 (adapter `logic/lecture/sources/vocab.ts`)
Mock: `mock/slide-topic-title.html`, `slide-topic-word.html` (사과 from Food), `slide-quiz-meaning.html` · shots `slide-topic-title-1280x720.png`, `slide-topic-word-*`, `slide-quiz-meaning-*`

## Anatomy

- Title: Hoya `idle`, "Word topics" kind label, the topic title, its Hoya line in a bubble.
- Word: the flashcard of `slide-vocab.md` with the word's WordArt picture (360 units, `glyphToSvgString`) as the `art` build (README D9).
- Quiz (topics with 4 or more words): word to meaning, gloss options.
