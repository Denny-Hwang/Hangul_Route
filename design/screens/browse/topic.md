# Word topic page (BR-9)

Wireframe: `design/wireframes/browse/item.md` D · Spec: F-BROWSE-001 §4.6 (topic), §4.7 (vocabulary topic), §4.2 · Mock: `mock/topic.html`, `mock/topic-states.html` · Shots: `shots/topic-375.png`, `-1280.png`, `shots/topic-states-375.png`, `-1280.png`

Data: `itemFacts({ kind: 'vocab-topic', id })`. Until F-VOC-003's screens ship, the word list is the preview.

| Part | Look |
|---|---|
| Header row | back and [ Lesson display ] |
| Title | the topic title (English), Heading `title`; under it the Korean title with romanization (`KoreanText`) |
| Kicker | the pill "Words" and "12 words" |
| What this teaches | a paper `Card` list with one row per word, rows split by `border.subtle` |
| Row | the 64 picture tile (PictureArt: `WordArt` or `HeritageCardArt` on paper with a `border.subtle` edge; a key with no drawing shows the text tile, the gloss on `surface.sunken`); the Korean with romanization; the gloss (Body small `text.secondary`); a 64 Hear button (`speaker` glyph in a `brand.secondary` outline, "Hear {romanization}", learner audio through `playPrompt`, writes nothing) |
| Primary | none today. Once F-VOC-003 ships: [[ ▶ Preview the flashcards ]] (host mode `'preview'`), pinned like the item page's primary |

**Closed** (sampler, switch on; every shipped topic is free today, so none is closed): the words stay, and the item page's closed box replaces the primary (`item.md`).
