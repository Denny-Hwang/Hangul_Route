# Reviews/Hangul Check — the Stage 1 graduation check, non-gating (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.9 (items, scoring, caregiver channel, leaving), §3.10 (Listen & Pick review mode), §3.13 (telemetry), §6 PR Q-10b · Stage 1 configuration of `reviews/stage-review.md` (F-RVW-001 §3.4; its "4 to 6 items" is superseded for Stage 1 only) · star rules F-RVW-001 §3.1
Audience: **learner (any age; P4/P5/P6)**; the numbers reach the grown-up channel only
Code: `apps/mobile/src/screens/reviews/StageReviewScreen.tsx` (renders), `apps/mobile/src/logic/stage1/hangul-check.ts` (`buildHangulCheck`), `apps/mobile/src/logic/stage1/review-flow.ts` (reducer, tally, result view, entry, telemetry), `apps/mobile/src/store/review-run-store.ts` (first try per item), `apps/mobile/src/logic/reviews/{star-calc,banned-text}.ts`, `store/progress-store.ts` `recordReview`, `logic/sync/summarize.ts` `stage1AnchorOf`

## Scenario (Given-When-Then)

Given: a learner who finished Stage 1 (or anyone who opens it; it never gates anything)
When: they tap **Take the Hangul Check** on the ceremony, or **Hangul Check** beside the Complete pill on the Journey
Then: a short intro, 35 Listen & Pick items in 5 parts of 7 with a Hoya pause between parts, then stars, Hoya, a certificate and the Stage 1 cards; up to three tip letters open the quest that teaches them. They can stop at any time and take it again later; nothing is lost

## Screen goal

"Look back over every letter, calmly. No timer, no score, never a lock."

## Box diagram

```
A. Intro (route StageReview { stageKey: 'stage1' })
+-----------------------------------------+
| [x]                                     |  <- "Stop the check": leaves at once here
|            [hoya - waving]              |
|             Hangul Check                |
|   About four minutes. Pictures and      |
|   sounds. No timer.                     |
|   (o-) Reading practice: hide the       |  <- switch, this attempt only; already on when
|        romanization until I tap         |     the profile reads in tap mode (D2)
|   [[ LET'S GO ]]                        |  -> B, sends review.start
|   [ Maybe later ]                       |  -> back
+-----------------------------------------+

B. A part (7 items: 6 symbols, then 1 word) — Listen & Pick, review mode
+-----------------------------------------+
| [x]  o o o . . . .                      |  <- fill-only dots for the part, no "n / N"
|   Listen and pick                       |
|        ( (o) speaker )  Hear it again   |  <- symbol: its sound (가, 이응); final: 악 안 알
|                                         |     암 압 앙; word: 한글 밥 한복 산 연
|   [ ㄱ ] [ ㅋ ]                          |  <- 4 options: target + 3 confusables (symbol),
|   [ ㄴ ] [ ㄷ ]                          |     3 other finals or none (final), 4 of the 5
|                                         |     theme pictures (word). Amber + check mark only;
|                                         |     no hint ring, no gloss, no feedback text
+-----------------------------------------+

C. Pause between parts (4 times)
|            [hoya - cheering]            |
|   Nice listening! Ready for more?       |  <- one line, changes per pause
|   [[ KEEP GOING ]]                      |

D. Result
+-----------------------------------------+
|            [hoya - cheering]            |
|              Wonderful!                 |  <- one word per tier, never a number
|              * * *                      |  <- stars (F-RVW-001 §3.1), 1 to 3, never 0
|   +---------------------------------+   |
|   | Certificate                     |   |  <- profile name, "Stage 1: Hangul", date, Hoya
|   | Dami  ·  Stage 1: Hangul        |   |
|   | Oct 12, 2026          [hoya]    |   |
|   +---------------------------------+   |
|   Hoya's tip                            |  <- only when a symbol was missed first try
|   Try again: [ ㅌ ] [ ㅠ ] [ ㅇ ]        |     up to three KoreanText chips -> the quest
|                t      yu    ng         |     that teaches each (quest/player)
|   -- or, with none missed: Every letter!|
|   Your Hangul cards                     |  <- the Stage 1 cards the learner owns
|   [card][card][card][card] ...          |     (wraps; each opens its card)
|   [[ BACK HOME ]]                       |
|   [ See my cards ]                      |
+-----------------------------------------+

E. Stop the check? (over B or C)
|   Stop the check?                       |
|   You can take it again any time.       |
|   [[ KEEP GOING ]]   [ Stop ]           |  <- Stop: back, nothing saved, nothing lost
```

- No number of right answers, ratio or percent on A to E (D3; `banned-text` scans every string of the screen's copy). The date and "Stage 1" are words on a certificate, not a score.
- The check never gates: Stage 2 and everything else stay as they are (D5). No Premium pill, no price.
- No session clock, no hearts, no fail state.

## Interaction points

- A: [x] / [ Maybe later ] -> back (nothing started)
- A: switch -> toggles "hide the romanization until I tap" for this attempt
- A: [[ LET'S GO ]] -> B part 1; `review.start { kind: 'stage-certificate', stageKey, hideRomanization }`
- B: option tap -> first answer per item scores (review-run-store); a wrong tap is amber, the item stays open until the right one
- B: last item of a part -> C (or D after part 5)
- B/C: [x] -> E; a system back (Android back, iOS swipe-back) during B or C also opens E (`guardsBack`); on A and D it leaves at once
- C: [[ KEEP GOING ]] -> next part
- D: tip chip -> `quest/player` for the quest that teaches the letter (`teachingQuestFor`); read "Practice the letter t again", or "Practice the final consonant n again" for a final
- D: card -> `CardDetail`; [[ BACK HOME ]] -> Main; [ See my cards ] -> Library on its Cards section (`section: 'cards'`)
- E: [[ KEEP GOING ]] -> back where it was; [ Stop ] -> back, the run is discarded

## Navigation graph

Enter from: `results/stage1-complete` (primary) · `journey/grid` Stage 1 header button (once complete). The route opens only for `stageKey: 'stage1'` once Stage 1 is complete (`hangulCheckOpens`); otherwise the not-ready state
Exit to: back (intro, stop) · `quest/player` (tip) · `library/card-detail` · `library/gallery` · `home/todays-mission`

## States

- **success**: A -> B x 5 with C between -> D; the entry is saved once.
- **no sound**: Listen & Pick shows the prompt as text ("No sound? Read it here."); the item scores normally.
- **every letter right**: "Every letter!" in place of the tip row.
- **no cards owned** (possible after a reset): the cards row is left out; the certificate still shows.
- **taken twice**: two entries; the caregiver summary reads the newest that carries `missedItemIds` (an entry an older build stripped is "unknown", never "all right").
- **not ready** (the route opened before Stage 1 is complete, or for another stage key, e.g. a stale link): Hoya thinking, one line "The Hangul Check is not open yet. Keep playing your quests." and [[ BACK HOME ]]. Never a dead end.
- **an item the game cannot play** (guarded by content tests): it is never asked, it is no tip, and the caregiver entry lists it in `missedItemIds` (not right on the first try). A part with no playable item shows the empty line with a [ Stop the check ] button.
- **reduced motion**: no pulse or slide; instant changes.

## Data needs

- reads: the active profile (name, romanization mode), `jamoAll`, the confusable table, the Stage 1 curriculum (`teachingQuestFor`), owned cards, messages `learner.stageReview.*`, `a11y.practiceLetter`, `a11y.practiceFinal`
- writes: `progress-store.recordReview(profileId, { id: 'review:stage1:<iso>', kind: 'stage-certificate', generatedAt, scope: 'stage1', itemIds (35), resultStars, missedItemIds (the first-try misses and any item never asked, in item order) })`, persisted and synced; a sync merge keeps the higher stars and, on a tie, the copy that kept `missedItemIds`; `summarize` then writes `stage1Anchor { met, checkedAt, tricky }` (met = 27+ of 30 symbols and 4+ of 5 words) for the caregiver channel
- telemetry: `review.start`, `review.complete { kind, stageKey, symbolsCorrect, wordsCorrect, retries, stars }` (internal analytics; never on a learner screen)

## Open questions

- None for Q-10b. A shareable certificate image is out of scope (F-CARD-003 family).
