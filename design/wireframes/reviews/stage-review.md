# Reviews/Stage-Review — anchor audit and certificate handoff (wireframe v1)

Spec: `docs/specs/F-RVW-001-review-tests.md` §3.4 (+ §3.1 star rules)
Audience: **learner (P4/P5 child, 5–11)**; the certificate is designed to be shown to a grown-up afterwards

## Scenario (Given-When-Then)

Given: a learner just completed the last episode of Stage 1 (or later taps the completed-stage cell on the grid)
When: the invitation appears
Then: they can take a 5–7 minute, 4–6 item review that touches every theme pillar — or say "later" — and finishing it hands them a Stage Certificate plus a wall of every card from that stage

## Screen goal

"Show what you remember from the whole stage, then receive the certificate."

## Box diagram

```
A. invitation (sheet over results or grid)
+----------------------------------+
|        [hoya - cheering]         |
|   "Ready for a big review?"      |  <- one line placeholder
|                                  |
|   [[ LET'S GO ]]                 |  -> B (default)
|   [ maybe later ]                |  -> back to where I came from
+----------------------------------+

B. review player (N = 4-6 items)
+----------------------------------+
| [<- back]     o o o o o o        |  <- item dots, position only
|                                  |
|   prompt (jamo / word / picture  |
|   + audio), one per pillar       |  <- Letters, Life, Rites,
|                                  |     Nature, Crafts each >= 1
|   +------------+ +------------+  |
|   |  choice    | |  choice    |  |  <- reuses minigame/shell
|   +------------+ +------------+  |
|   +------------+ +------------+  |
|   |  choice    | |  choice    |  |
|   +------------+ +------------+  |
|   [ (o) hear it again ]          |
+----------------------------------+

C. handoff -> results/celebrate (certificate variant)
+----------------------------------+
|   * * *   (stars, 1-3)           |
|   +--------------------------+   |
|   |   STAGE CERTIFICATE      |   |  <- name, Hoya stage form,
|   |   name / date / hoya     |   |     date. Shareable image.
|   +--------------------------+   |
|   collection wall (h-scroll)     |
|   [card][card][card][card] >     |  <- every card earned in stage
|   [[ SEE MY CARDS ]]             |  -> library/gallery
|   [ share certificate ]          |  -> share sheet
+----------------------------------+
```

- The invitation defaults to "now" but "later" is a first-class exit; the completed-stage cell on `journey/grid` re-offers it, so nothing is lost by declining.
- Item dots show progress only. No timer, no per-item score, no percentage anywhere on A/B/C (§3.1 lint applies).
- Panel C is not a new screen: it is `results/celebrate` rendered with a `certificate` variant — same star row, same primary-CTA position, plus the certificate and wall blocks.

## Interaction points

- [[ LET'S GO ]] → panel B
- [ maybe later ] → `results/celebrate` (if invited from episode end) or `journey/grid` (if invited from the grid cell)
- Choice tap → registers, brief Hoya feedback, auto-advance
- [<- back] during B → confirm sheet → `journey/grid`; the partial attempt is discarded, the invitation stays available
- Last item → `results/celebrate` (certificate variant)
- [[ SEE MY CARDS ]] → `library/gallery` (scrolled to the stage's set)
- [ share certificate ] → platform share sheet (image), no account needed
- Card tap on the wall → `library/card-detail` (modal)

## Navigation graph

Enter from: `results/celebrate` (last episode of the stage just finished) · `journey/grid` (completed-stage cell)
Exit to:    `results/celebrate` (certificate variant) · `library/gallery` · `library/card-detail` · `journey/grid` (later / back)

## States

- **success**: A → B (4–6 items) → C with stars, certificate, and a non-empty collection wall.
- **empty** (stage complete but zero cards earned — possible if every quest scored 1 star): certificate still renders; the wall block is replaced by one Hoya line ("your cards are waiting — replay a quest") and the CTA becomes [[ BACK TO JOURNEY ]] → `journey/grid`. No empty scroll rail.
- **error** (item build cannot satisfy the 5-pillar rule, or assets missing): fall back to whatever ≥ 4 items are loadable; if fewer than 4, show the invitation again with "try again later" and return to the entry screen. A failed review never blocks the certificate from being re-offered.
- **already certified**: grid-cell tap opens panel C directly (view certificate / wall again); B is offered only as a secondary "review again", and a repeat attempt never lowers stored stars.

## Data needs

- reads: active profile · stage completion state from `ProgressSnapshot` · Stage 1 review item seed grouped by pillar · cards unlocked in this stage · feature flag `reviews.stageReview`
- computed by `logic/reviews/stage-balance` (≥ 1 item per pillar) and `logic/reviews/star-calc`
- writes: `ReviewAttempt` (kind `stage`) · certificate record (stage, date, stars) on the snapshot · `stage_anchor_accuracy` event to the caregiver channel (the actual percentage — never rendered here)
- telemetry: `review.stage.invited` (accepted | later), `review.stage.completed` (stars), `certificate.shared`

## Open questions

- Spec §5 names separate files `stage-certificate.md` and `collection-wall.md`; the app map folds both into the `results/celebrate` certificate variant (this wireframe). Confirm one or the other before the design pass.
- Certificate share: image only, or a link that opens the web app? A link implies a public certificate endpoint and a privacy review.
- Should the certificate show the learner's display name by default, or avatar only for the youngest band? (COPPA-adjacent; a parent may prefer avatar)
- Stage 2+ reuse: same layout with the stage's Hoya form — confirm Hoya has one form per stage in `design/characters/`.
