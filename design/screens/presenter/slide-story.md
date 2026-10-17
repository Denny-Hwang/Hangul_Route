# Story scene slide (screen spec v1)

Spec: F-TCH-004 sections 3.3 rule 5, 3.4 (`story`), D14 · wireframe G · PR 11
Mock: `mock/slide-story-title.html`, `slide-story.html` (scene s4 of "King Sejong's New Letters"), `slide-story-tap.html`, `slide-story-check.html` · shots `slide-story-title-*`, `slide-story-*`, `slide-story-check-*`, builds on `builds-board-1440.png`

## Anatomy and builds

- Row 1: the scene (`StoryScene` art, 400 x 300 units, `radii.xl` units) and the narration beside it (`presenter.size.body`, `leading.normal`). Keyword tokens in the narration render as inline `KoreanText` chips (백성 baekseong).
- Row 2: the scene's Korean line as a chip at `presenter.size.prompt` with its gloss after it (`text.secondary`).
- Builds `art`, `narration` (Read-to-me speaks the narration with the speaker key S), `korean`; with `tap`, one more build reveals every romanization on the slide at once.
- The scene caption (`captionEn`) is the art's accessible name and is not drawn (README D8).
- Every word comes from the story's own fields (D14); a traditional tale's "retold" line belongs on its title slide.
- Checks follow as quiz slides (`slide-quiz.md`) with gloss options and the check's explanation at the answer.

## Read-to-me reads the scene's Korean (amendment 2026-10-17)

- **S** or **Sound** reads the narration as before and, once the `korean` build shows, the scene's Korean after it, in Korean: its line at the sentence rate, its keyword at the word rate (`readToMePlan`, F-TCH-004 section 3.4), as the story reader does with both parts on. A keyword the narration already says as a chip is not said twice. Before the `korean` build, only the narration plays. With no Korean voice only the English plays, as before.
