# Library / Story card back face with its citation (wireframe v2)

Spec: `docs/specs/F-STORY-006-card-award-model.md` §3.8 (the heritage story cards: back face, citation), §3.10; base screen `library/card-detail.md` (front and back, flip, share); sources rules from `docs/specs/F-STORY-001-story-schema-pipeline.md` §3.3
Audience: anyone learning Hangul, any age (CLAUDE.md §1). The learner surface never leaves the app: a source is a line of text, never a link; the full list lives on the grown-up Sources screen.
Code: planned in PR 6.7: `apps/mobile/src/content/story-cards.ts` (story card entries with `factId`), the back-face citation band in `screens/library/CardDetailView.tsx`; card art through `StoryScene` cover crops (PR 6.8).
Notation: `~~ ko ~~` taught Korean drawn with `KoreanText`, `(sparkle)` the `Icon sparkle` (no emoji).

Promoted by F-STORY-006 PR 6.0 from panel G of the one-file draft (`journey/grid-with-stories.md`).

All copy in boxes is placeholder; card text (headword, title, summary, claim) is story content.

## Scenario (Given-When-Then)

Given: the learner owns the card of a heritage story
When: they open it and flip it
Then: the back shows the Korean headword with romanization and gloss, the story's summary, and one sourced fact in its verified wording with where it comes from

## Screen goal

"Read the true fact behind this card, and see where it comes from."

The card page's actions are unchanged (flip, Hear it, Share); the back face adds no button.

---

## G. Card back face of a story card

```
┌──────────────────────────────────┐   (tap to flip; front = art + title + ~~ ko ~~)
│        ~~ 측우기 ~~              │   <- headword: Korean large, romanization, gloss
│        cheugugi                  │
│        rain gauge                │
│                                  │
│ Rain Gauge                       │   <- English title
│ "<summary: 1-2 sentences>"       │   <- the story's summary (verified wording)
│                                  │
│ ┌──────────────────────────────┐ │
│ │ (sparkle) <the sourced fact, │ │   <- the claim verbatim, <= 180 characters
│ │  verbatim claim>             │ │
│ │ Source: <publisher>, <title> │ │   <- <= 2 lines, muted
│ │ and 3 more sources           │ │      only when the fact has more; no URL, no link
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- A card with no citation (the 42 older cards, set cards) keeps today's three bands.
- The claim is the fact's `claimEn` (or its locale overlay) exactly; the source line is the first source's publisher and title in their own language.
- The grown-up Sources row on the story's episode page lists every source; this face never links out.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Card | tap | flips front and back (as today; instant with reduced motion) |
| Hear it | tap | plays the headword (as today) |
| Share | tap | shares the front face image (as today; the citation band is not part of the share image) |

## Navigation graph

Enter from: `library/earn-hints` owned tile · `results/extra-cards` thumbnail · `results/celebrate` "See my card" · `episode/detail-story` earned card
Exit to: back (the caller) · nothing new

## States

- **success**: G as drawn.
- **empty**: a card without a citation: today's back face.
- **error**: a `factId` that no longer resolves (content update) drops the citation band and keeps the summary; never an error box.
- **long text / 200 % text**: the claim wraps (it is capped at 180 characters by lint); the source line wraps to two lines then truncates, with the full line in the accessible label.
- **offline**: bundled content.
- **reduced motion**: no flip animation.

## Data needs

- reads: the story card entry (`headword`, `titleEn`, `summaryEn`, `factId`), the fact (`claimEn`, `sources[]`) from the bundled story, locale overlays
- writes: nothing
- telemetry: none new

## Open questions

1. Should the citation band also show the "Checked in N passes" line? Default: no; the band stays two lines and Sources carries the verification.
