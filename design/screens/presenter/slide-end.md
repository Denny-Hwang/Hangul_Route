# End slide (screen spec v1)

Spec: F-TCH-004 section 3.3 rules 9 and 10, 3.4 (`end`), 3.5 (last slide) · wireframe C, L · PR 6
Mock: `mock/slide-end.html` (letters, words, class code), `slide-end-words.html` (words only) · shots `slide-end-1280x720.png`, `-1920x1080`, `-gray`, `slide-end-words-1280x720.png`

## Anatomy

- Left column: "Today we met" (`presenter.size.title`); a letters list and a words list, each a wrapping row of pairs (Korean at `presenter.size.body` in the presenter font, romanization at `presenter.size.caption` in `text.secondary`), introduced by its label ("Letters", "Words") as the first item of the row; at most two rows each, the rest in one "+ 7 more" pill (README D7); "Practice at home in Hangul Route" at the bottom.
- Right column, only with a `class-code` block: a bordered panel with "Join our class" (`presenter.size.prompt`), the code at `presenter.size.title` in the mono stack (letter-spaced; its accessible name spells the characters), and the line "Tap “Join a class” in Hangul Route and type this code.", built from the shipped Join label (`caregiver.spaces.join.cta`), so it follows that label if it changes.
- Every word that has a gloss in the presenter locale shows it after its romanization (`presenter.size.caption`, `text.primary`), in every End slide (owner decision D2, section 3.13); a syllable with no gloss (가 `ga`) shows Korean and romanization only. Glosses are never dropped to fit: the fit rule (README D7) shows fewer items before the pill instead.
- Next on this slide does nothing but show "To finish, choose Exit." in the hint pill above the bar (`#v=hint`); Exit is focused.
