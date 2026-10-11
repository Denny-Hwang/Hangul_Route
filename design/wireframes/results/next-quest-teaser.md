# Results/Next-quest teaser — "Next up" card and one primary action (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.5 (cursor, teaser, soft prerequisite), §3.15 (no new gating), §6 PR Q-5b · extends `results/celebrate.md`
Audience: **learner (any age; P4/P5/P6)**
Code: `apps/mobile/src/screens/results/ResultsScreen.tsx` (renders), `apps/mobile/src/logic/quest-flow/results-teaser.ts` (decides)

## Scenario (Given-When-Then)

Given: the learner finished a quest and the score is written
When: the Results screen shows the celebration (stars, optional new card)
Then: below the card banner a "Next up" card names the learner's real next quest, and the one big button is "Play next quest"; going home or to the episode page is still one tap away but quieter

## Screen goal

"Celebrate, then make the next step obvious — never a must."

## Box diagram (the part that changes; everything above is `results/celebrate`)

```
|  ( card banner, 2+ stars, first time ) |
|                                        |
|  +----------------------------------+  |
|  | Next up                          |  |  <- caption
|  | Meet j, ch                       |  |  <- next quest titleEn
|  | New letters: [ㅈ] [ㅊ]           |  |  <- teaserEn, else "New letters:" + KoreanText
|  |               jj    ch           |  |     chips, else blurbEn. Hangul is taught content:
|  +----------------------------------+  |     KoreanText (romanization shown), never plain text
|                                        |
|   [[ PLAY NEXT QUEST ]]                |  <- the ONE primary -> quest/player (next quest)
|   [ Back home ]                        |  <- ghost -> Main tabs
|   [ Episode page ]                     |  <- ghost -> episode/detail
```

- The card never shows a count, a percent or "you must". No emoji.
- The teaser is the Journey **cursor** (`nextQuestAfter`), the same quest Home offers, not "the next quest in this episode". Replaying quest 3 while the cursor is quest 7 teases quest 7.
- Only stages the learner can open are teased (`isStageEntitled` with the real tier): a free learner is never pointed into a Premium stage.

## Interaction points

- [[ PLAY NEXT QUEST ]] -> `quest/player` (questId, episodeId of the next quest); fires `quest.teaser_tapped { fromQuestId, toQuestId }`
- [ Back home ] -> `Main` tabs (stack reset); [ Episode page ] -> `episode/detail`

## States

- **next**: as drawn.
- **skipped every game** (`total === 0`, nothing completed): the card offers the same quest and the primary reads "Try this one again" (same event, `toQuestId` = the quest just played).
- **no next quest** (everything done, or nothing entitled): no card; the existing two buttons stay as on `results/celebrate` (Back home primary, Episode page ghost). The Stage 1 completion flow of §3.8 is a later PR.
- **no teaser line** (quest has no `teaserEn`, no Discover jamo, no `blurbEn`): title only.

## Accessibility

- The card is plain content (no role); the CTA is a button whose label is its text. The KoreanText chips carry "ko, romanization" labels.
- Touch targets: `touchTarget` tokens via `Button`. Reduced motion: the card is static.

## Open questions

- None for Q-5b. The Stage 1 ceremony replaces the buttons for the last quest (Q-9).
