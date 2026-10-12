# Preview end (BR-8)

Wireframe: `design/wireframes/browse/preview-end.md` · Spec: F-BROWSE-001 §4.8, BD9 · Mock: `mock/preview-end.html`, `mock/preview-end-states.html` · Shots: `shots/preview-end-375.png`, `-1280.png`, `shots/preview-end-states-375.png`, `-1280.png`

It replaces the learner Results screen. There are no stars, no score, no accuracy and no card animation.

| Part | Look |
|---|---|
| Strip | text only, 64 tall (`preview-frame.md`) |
| Hoya | `cheering`, 96, centred |
| Title | "That is the whole lesson." Heading `title`, centred, the one header |
| Line | "At this point a learner sees 1 to 3 stars and collects:" Body, centred |
| Card | a still `CardArtThumb` (96, `borderWidth.thick` rarity border, 90 face) beside the English title (Body large bold) and the Korean with romanization; no flip, no burst |
| Actions | [[ Next lesson ]] primary `lg`; [ Preview again ] ghost; [ Back to the lesson page ] ghost. Full width, capped at 26rem from the regular class |

## Variants

- **No next lesson** (the last shipped lesson in catalogue order, today Greeting Dialogues): [[ Next lesson ]] is hidden and [ Preview again ] becomes the primary.
- **No card**: the card block is left out, and the line ends "…sees 1 to 3 stars."
- **Story**:
  - "That is the whole story." with "A learner can read it again any time.", and no card.
  - [[ Next story ]], [ Read again ], [ Back to the story page ].
- **A closed next lesson**: [[ Next lesson ]] opens its item page in closed form and never auto-plays.
