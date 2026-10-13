# Results/Stage 1 complete — the Stage 1 prize ceremony (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.8 (completion, awards, ceremony, Journey pill), §3.15 (no gating, no Premium), §6 PR Q-9 (this screen) and PR Q-10b (adds the Hangul Check button) · extends `results/celebrate.md` and `results/extra-cards.md` · award engine F-STORY-006 §3.4
Audience: **learner (any age; P4/P5/P6)**
Code: `apps/mobile/src/screens/results/StageCompleteScreen.tsx` (renders), `apps/mobile/src/logic/stage1/stage-complete.ts` (decides: `opensStagePrize`, `symbolWall`, `stagePrizeCards`, `stageCompleteActions`), `apps/mobile/src/logic/quest-flow/results-teaser.ts` (`resultsActions`, the Results primary), `apps/mobile/src/logic/journey.ts` + `logic/my-route/latch.ts` (`stagePillState`, `completeStages`)

## Scenario (Given-When-Then)

Given: the learner finishes the last Stage 1 quest they were missing (all 15 quests have a `completedAt`, at any star count)
When: Results shows the run's stars and cards
Then: the one big button is **See your Stage 1 prize**; it opens the ceremony, where Hoya cheers, every one of the 30 symbols is lit on a wall, and the three legendary cards (Hangul Day, Paper Lantern, Gayageum Zither) are shown, each opening its card

## Screen goal

"You did it: you can read Hangul. Here is everything you learned, and your prize."

## Box diagram

```
A. Results on the run that completed Stage 1 (only the buttons change; see results/celebrate, results/extra-cards)
|  ( star row, Hoya, quest card banner )  |
|  ( extra-cards banner: the episode and  |
|    stage cards this run brought )       |
|  ( Next up card, when the cursor has    |
|    one, e.g. the Stage 2 taste )        |
|                                         |
|   [[ SEE YOUR STAGE 1 PRIZE ]]          |  <- the ONE primary -> B
|   [ Play next quest ]                   |  <- ghost (only when there is a next quest)
|   [ Back home ]                         |  <- ghost
|   [ Episode page ]                      |  <- ghost

B. Ceremony (route StageComplete { stageKey: 'stage1' })
+-----------------------------------------+
|            [hoya - cheering]            |
|            Hangul complete!             |  <- title (display)
|   +---------------------------------+   |
|   | You can read Hangul now!        |   |  <- Hoya bubble: headline + can-do line
|   | You know every letter and ...   |   |
|   +---------------------------------+   |
|                                         |
|   Every letter you learned              |  <- wall title
|   [ㄱ][ㄴ][ㄷ][ㄹ][ㅁ][ㅂ][ㅅ]             |  <- 30 tiles, fixed order: 14 consonants,
|   [ㅇ][ㅈ][ㅊ][ㅋ][ㅌ][ㅍ][ㅎ]             |     10 vowels, 6 finals; glyph + sound value
|   [ㅏ][ㅑ][ㅓ][ㅕ][ㅗ][ㅛ][ㅜ]             |     under it; every tile lit (fill-only)
|   [ㅠ][ㅡ][ㅣ][ㄱ][ㄴ][ㄹ][ㅁ]             |     finals carry a small "final" baseline
|   [ㅂ][ㅇ]                              |     wraps to the width, never scrolls sideways
|                                         |
|   Legendary cards for you               |  <- cards title
|   [card art] [card art] [card art]      |  <- HeritageCardArt in rarity frames;
|   Hangul Day  Paper Lantern  Gayageum   |     each a button -> library/card-detail
|                                         |
|   [[ SEE MY CARDS ]]                    |  <- the ONE primary -> library (Cards)
|   [ Back home ]                         |  <- ghost -> Main tabs
+-----------------------------------------+
   PR Q-10b: [[ TAKE THE HANGUL CHECK ]] becomes the primary ("about 4 minutes, you can skip it");
   See my cards and Back home are then ghost.

C. Journey Stage 1 header once complete
|  (1) Hangul                [ Complete ] |  <- pill reads Complete (success tone) instead of Open
|      Read and write the Korean letters  |     PR Q-10b adds a small [ Hangul Check ] button beside it
```

- No number, fraction or percent anywhere on B (D3): the wall is not counted and never says "30 of 30".
- No Premium pill, no price, no plan word and no purchase on A, B or C (D5). What comes after Stage 1 for a free learner is F-STORY-004 / F-VOC.
- Taught Korean on the wall is a symbol with its sound value (`g/k`, `silent/ng`, the final's `n`); the screen reader hears "Korean letter g/k" / "Korean final consonant n", never the glyph alone and never "empty set".
- The ceremony is never shown automatically a second time: a replay of the last quest shows ordinary Results.

## Interaction points

- A: [[ SEE YOUR STAGE 1 PRIZE ]] -> B (`navigate('StageComplete', { stageKey: 'stage1' })`)
- B: card tile -> `library/card-detail` (modal, `CardDetail { cardId }`), label "Open card: <title>"
- B: [[ SEE MY CARDS ]] -> `library/gallery` (Main tabs, Library, Cards)
- B: [ Back home ] -> Main tabs (stack reset)
- B: system back -> Results (unchanged)

## Navigation graph

Enter from: `results/celebrate` (the run that completed Stage 1, `QuestResultOutcome.stageCompleted === 'stage1'`)
Exit to: `library/card-detail` · `library/gallery` · `home/todays-mission` · back to `results/celebrate`

## States

- **success**: Hoya cheering, the 30-tile wall, the three cards, See my cards primary.
- **not ready** (a stage key with no prize cards, or opened for a stage the profile has not completed, e.g. a stale link): one line "This prize is not here yet. Keep playing your quests." and [ Back home ]. Never a dead end.
- **reduced motion**: the tiles and the cards appear at once (no fade); nothing else changes.
- **small screen (320 x 568) and 200 % text**: the page scrolls, the wall wraps (4-7 tiles a row), the cards wrap to two rows; no sideways scroll.
- **offline**: everything is bundled; nothing is fetched.

## Data needs

- reads: `QuestResultOutcome.stageCompleted` (Results); the active profile's snapshot (`completeStages`: the `stageDoneAt` latch or the derived rule); `jamoAll` (the wall); `heritageCardsAll` filtered by `unlockedBy === 'stage1-complete'` (the cards); messages `learner.stageComplete`, `learner.results.stagePrize`, `learner.journey.availability.complete`, `a11y.discoverLetter` / `a11y.discoverFinal`
- writes: nothing on this screen. The awards are written by `applyQuestResult` in the one Results write (F-STORY-006 engine: episode `rewardCardIds` plus the `stage1-complete` cards, not star-gated, idempotent)
- telemetry: `card.unlocked` per card and `stage.complete { stageKey: 'stage1', cardsAwarded }` once, both sent by `applyQuestResult` on the run that completes the stage

## Open questions

- None for Q-9. The Hangul Check entry (B primary, C button) is PR Q-10b (`reviews/hangul-check.md`).
