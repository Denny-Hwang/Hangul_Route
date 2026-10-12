# Browse/Preview-end — the end of a lesson preview (wireframe v2)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.8, BD9
Audience: **parent or teacher** in All lessons.

v2 (review of 2026-10-11): [[ Next lesson ]] on a closed next lesson (sampler, content switch on) opens its page in closed form; the strip stays on this screen.
Code (planned): `apps/mobile/src/screens/browse/PreviewEndScreen.tsx`
Notation: as `browse/home.md`.

## Scenario (Given-When-Then)

Given: a grown-up finished every step of a previewed lesson
When: the lesson ends
Then: they learn what a learner gets at this point, without being scored, and can go on to the next lesson in one tap

## Screen goal

"Go on to the next lesson." (secondary: preview again, or back to the lesson page)

## Box diagram

```
┌──────────────────────────────────┐
│ Preview. Nothing is saved.       │   preview strip
├──────────────────────────────────┤
│            (Hoya cheering)       │
│                                  │
│   That is the whole lesson.      │
│                                  │
│   At this point a learner sees   │   a sentence, not a result: no stars drawn,
│   1 to 3 stars and collects:     │   no score, no accuracy
│   ┌──────────┐                   │
│   │  [card]  │  Hanji Paper      │   static thumbnail; no flip, no burst animation
│   └──────────┘                   │
│                                  │
│   [[      Next lesson      ]]    │   next quest in the episode, else next shipped cell
│   [ Preview again ]              │
│   [ Back to the lesson page ]    │
└──────────────────────────────────┘
```

Story variant: "That is the whole story. A learner can read it again any time." with [[ Next story ]] (next in the shelf group), [ Read again ], [ Back to the story page ].

## Interaction points

- [[ Next lesson ]] -> `browse/item` of the next quest, catalogue order (closed next lesson: its page in closed form; never auto-plays)
- [ Preview again ] -> `browse/preview-player` (fresh run)
- [ Back to the lesson page ] -> `browse/item`

## Navigation graph

Enter from: `browse/preview-player` (last step)
Exit to: `browse/item` · `browse/preview-player`

## States

- **success**: as above.
- **no card** (lesson without a reward card): the card block and the "collects" clause are omitted ("At this point a learner sees 1 to 3 stars.").
- **last lesson of the course** (no next shipped lesson): [[ Next lesson ]] is hidden; [ Back to the lesson page ] becomes the primary.
- **error**: `OopsScreen` with [ Back ].

## Data needs

- reads: bundle only (`questById`, `cardById`, `episodeById`, catalogue order)
- writes: none (no stars, no card, no session, no result)
- telemetry: `browse.preview_ended { kind, itemId, reachedEnd: true, minutes }`

## Open questions

- None blocking. OD-6 records the alternative (show stars from the grown-up's answers); the default is no stars.
