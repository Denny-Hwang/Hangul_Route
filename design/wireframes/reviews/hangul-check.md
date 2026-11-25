# Reviews/Hangul Check — the Stage 1 graduation check, non-gating (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.9 (items, scoring, caregiver channel, leaving), §3.10 (Listen & Pick review mode), §3.13 (telemetry), §6 PR Q-10b · Stage 1 configuration of `reviews/stage-review.md` (F-RVW-001 §3.4; its "4 to 6 items" is superseded for Stage 1 only) · star rules F-RVW-001 §3.1
Audience: **learner (any age; P4/P5/P6)**; the numbers reach the grown-up channel only
Code: `apps/mobile/src/screens/reviews/StageReviewScreen.tsx` (renders), `apps/mobile/src/logic/stage1/hangul-check.ts` (`buildHangulCheck`), `apps/mobile/src/logic/stage1/review-flow.ts` (reducer, tally, result view, entry, telemetry), `apps/mobile/src/store/review-run-store.ts` (first try per item), `apps/mobile/src/logic/reviews/{star-calc,banned-text}.ts`, `store/progress-store.ts` `recordReview`, `logic/sync/summarize.ts` `stage1AnchorOf`
Amended 2026-11-25 by `docs/specs/AMENDMENTS-STAGE1-DECODING-CHECK.md` [DC] (WO-10 of the 2026-11 review; owner decision 2026-11-22, OD-R1): version 2 of the check measures reading. The romanization of every question waits for the answer (no switch on the intro, A); 12 of the 24 name items become decoding items (see a syllable, pick its sound among four recorded sounds, B2); the five words are read, not heard (B3, row DC-3), in a shuffled order; parts run decode items, names, finals, then the word; the grown-up verdict `met` is recomputed on the decode, name and final items (Data needs). Rows DC-1a (A, B), DC-2a (B2 mock), DC-2d (B2, parts, data) and DC-3 (B3).
Amended 2026-11-25 by `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` [LR]: an interrupted check goes on. The intro gains a reading frame and a resume page ("Pick up where you left off?", Continue and Start again, `reviews/check-resume.md`); Stop keeps the stored check for 24 hours and its sheet says "You can keep going later." once an answer is given, so "nothing is saved" no longer holds (E); the sheet draws the safe choice, Keep going, filled (rows LR-3a #1112 and LR-6 #1119; OD-LR1 (c), OD-LR9 (b)).

## Scenario (Given-When-Then)

Given: a learner who finished Stage 1 (or anyone who opens it; it never gates anything)
When: they tap **Take the Hangul Check** on the ceremony, or **Hangul Check** beside the Complete pill on the Journey
Then: a short intro, 35 items in 5 parts of 7 (12 letter names, 6 finals, 12 syllables to read, 5 words to read; [DC]) with a Hoya pause between parts, then stars, Hoya, a certificate and the Stage 1 cards; up to three tip letters open the quest that teaches them. They can stop at any time and take it again later; nothing is lost

## Screen goal

"Look back over every letter, calmly. No timer, no score, never a lock."

## Box diagram

```
A. Intro (route StageReview { stageKey: 'stage1' })
+-----------------------------------------+
| [x]                                     |  <- "Stop the check": leaves at once here
|            [hoya - waving]              |
|             Hangul Check                |
|   About four minutes. Read and          |  <- [DC] was "Pictures and sounds."
|   listen. No timer.                     |
|                                         |  <- [DC] no "Reading practice" switch: every
|                                         |     question holds its romanization (OD-DC1)
|   [[ LET'S GO ]]                        |  -> B, sends review.start
|   [ Maybe later ]                       |  -> back
+-----------------------------------------+

B. A part (7 items) — [DC] decode items (B2), then names, then finals, then the word (B3)
   parts 1-2: 2 decode, 3 names, 1 final, 1 word · parts 3-4: 3, 2, 1, 1 · part 5: 2, 2, 2, 1
   Name and final items: Listen & Pick, review mode
+-----------------------------------------+
| [x]  o o o . . . .                      |  <- fill-only dots for the part, no "n / N";
|   Listen and pick                       |     they continue across B, B2 and B3
|        ( (o) speaker )  Hear it again   |  <- name: the letter's name (기역, 이응);
|                                         |     final: 악 안 알 암 압 앙
|   [ ㄱ ] [ ㅋ ]                          |  <- 4 options: target + 3 confusables (name),
|   [ ㄴ ] [ ㄷ ]                          |     3 other finals or none (final). [DC] no option
|                                         |     shows its romanization until the right tap
|                                         |     (held: room kept, nothing drawn). Amber + mark
|                                         |     only; no hint ring, no gloss, no feedback text
+-----------------------------------------+

B2. A decode item [DC] (12 per check: 6 open syllables, 6 with a final) — mock in design/screens/hangul-check/ (DC-2a)
+-----------------------------------------+
| [x]  o . . . . . .                      |
|   Read it. Which sound is it?           |
|                 그                       |  <- Hangul only; a syllable no quest has practised
|   [ (speaker) Sound 1 ]                 |  <- tap: plays the clip and selects the card
|   [ (speaker) Sound 2 ]  (selected)     |     4 sounds in a balanced set: 그 드 거 더
|   [ (speaker) Sound 3 ]                 |     (no sound stands out by its pattern)
|   [ (speaker) Sound 4 ]                 |
|   [[ THIS ONE ]]                        |  <- shown once a card is selected; the answer
|   Can't hear it?                        |  <- Show the letters: the cards show their
|                                         |     romanization (geu, deu, geo, deo); 그 stays Hangul
+-----------------------------------------+
   after the right answer: 그 shows "geu", the right card plays once more, next item

B3. A word item [DC, row DC-3] (one per part, last)
+-----------------------------------------+
|   What does this mean?                  |
|                 한복                     |  <- Hangul only until the right pick
|   [pic] [pic]                           |  <- 4 of the 5 theme pictures, no labels
|   [pic] [pic]                           |
+-----------------------------------------+
   after the right pick: 한복 hanbok, the word is said once

C. Pause between parts (4 times)
|            [hoya - cheering]            |
|   Nice work! Ready for more?            |  <- one line, changes per pause ([DC] was "Nice listening!")
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
- A: [DC] no switch (removed, OD-DC1)
- A: [[ LET'S GO ]] -> B part 1; `review.start { kind: 'stage-certificate', stageKey }` ([DC] no `hideRomanization`)
- B: option tap -> first answer per item scores (review-run-store); a wrong tap is amber, the item stays open until the right one
- B2: sound card tap -> plays and selects (never scored); [[ THIS ONE ]] -> the answer (first one scores); a wrong answer is amber, the item stays open; Can't hear it? -> the CH sheet; Show the letters -> the cards show their romanization (the answer counts as usual; the Hangul Check records no hint)
- B3: picture tap -> as B
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
- **no sound**: Listen & Pick shows the prompt as text ("No sound? Read it here."); [DC] in this check the text is the romanization only while the item is open (OD-DC2), never the Hangul over Hangul options; the item scores normally. B2 with no sound (or its clip pack not loaded): the cards show their romanization from the start.
- **every letter right**: "Every letter!" in place of the tip row. [DC] Tips come from the name and final items; a missed decode item adds no tip, and "Every letter!" shows only when no name, final or decode item was missed (otherwise the row is left out) (OD-DC9).
- **no cards owned** (possible after a reset): the cards row is left out; the certificate still shows.
- **taken twice**: two entries; the caregiver summary reads the newest that carries `missedItemIds` (an entry an older build stripped is "unknown", never "all right"). [DC] It takes the highest check version first (version 2 = an entry with `decode:` item ids), then the newest.
- **a check stored before version 2** [DC]: its item ids differ, so the resume page is skipped and a new check starts (saved-check rule).
- **not ready** (the route opened before Stage 1 is complete, or for another stage key, e.g. a stale link): Hoya thinking, one line "The Hangul Check is not open yet. Keep playing your quests." and [[ BACK HOME ]]. Never a dead end.
- **an item the game cannot play** (guarded by content tests): it is never asked, it is no tip, and the caregiver entry lists it in `missedItemIds` (not right on the first try). A part with no playable item shows the empty line with a [ Stop the check ] button.
- **reduced motion**: no pulse or slide; instant changes.

## Data needs

- reads: the active profile (name, romanization mode: applied only after an answer, [DC]), `jamoAll`, the confusable table, the decode item pool (`logic/stage1/decode-items.json`, [DC]) and its clips, the Stage 1 curriculum (`teachingQuestFor`), owned cards, messages `learner.stageReview.*`, `a11y.practiceLetter`, `a11y.practiceFinal`
- writes: `progress-store.recordReview(profileId, { id: 'review:stage1:<iso>', kind: 'stage-certificate', generatedAt, scope: 'stage1', itemIds (35), resultStars, missedItemIds (the first-try misses and any item never asked, in item order) })`, persisted and synced; a sync merge keeps the higher stars and, on a tie, the copy that kept `missedItemIds`; `summarize` then writes `stage1Anchor { met, checkedAt, tricky }` for the caregiver channel. Version 1 entries: met = 27+ of 30 symbols and 4+ of 5 words. [DC] Version 2: met = 11+ of 12 decode items and 16+ of the 18 name and final items (the words are not in it); `tricky` = the missed name and final items; the summary carries `version`. Never shown to the learner
- telemetry: `review.start`, `review.complete { kind, stageKey, symbolsCorrect, wordsCorrect, retries, stars }` ([DC] plus `decodeCorrect` and `checkVersion`; `symbolsCorrect` counts the 18 name and final items) (internal analytics; never on a learner screen)

## Open questions

- None for Q-10b. A shareable certificate image is out of scope (F-CARD-003 family).
- [DC] The decode round's choice interaction (tap plays and selects, THIS ONE commits) is provisional (OD-DC10); the DC-2a mock settles it.
