# Title slide (screen spec v1)

Spec: F-TCH-004 sections 3.3 rules 1, 2, 4, 5 and 3.4 (`title`) · wireframe C · PR 6
Mock: `mock/slide-title.html` (episode), `slide-story-title.html` (PR 11), `slide-topic-title.html` (PR 12) · shots `slide-title-*`, `slide-story-title-*`, `slide-topic-title-1280x720.png`

## Anatomy

- Hoya (`hoyaNodes`, 240 units): `waving` on an episode or quest title, `idle` on a topic title. A story title shows its cover scene (400 x 300 units) instead of Hoya.
- Right column: on the first slide only, the deck title (teacher text) as a caption line (`presenter.size.caption`, `text.secondary`, prefixed for screen readers by `learner.presenter.slide.deckTitle`); a kind label on story and topic titles ("Story", "Word topics"); the title (`presenter.size.title`); the subtitle (`presenter.size.body`, `text.secondary`) when the content has one; Hoya's line in a bubble (`borderWidth.thick` units `border.strong`, `radii.xl` units, `presenter.size.body`).
- One build. All text is the content's own, in the deck's UI language (overlays).
