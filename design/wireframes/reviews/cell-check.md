# Reviews/Cell Check — the check of one grid cell, and Test out from an unstarted cell (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.4 (levels: the Cell Check passed toward Mastered, or as a test-out toward Done), §4.5 (sessions table "Cell Check", "Test-out details", "Never on a review screen"), §4.1 (pretesting and test-out), §7.7 (anti-shame checklist), §11.3 (`review.*` kind `cell-check`, `testout.finished`), §11.4 (experiment E3: Test out offered against hidden), §12.2 (`cellCheck` off), §14 (e2e "Cell Check and test-out") · access F-ENT-003 (a test-out needs access to the cell, the same as playing it) · star rules F-RVW-001 §3.1
Extends: `episode/detail.md` (the cell's page: one added block and one added line), `reviews/daily-review.md` (the round screen B, B2 and the stop sheet pattern), `journey/mastery-ring.md` (the ring and the level words)
Audience: **learner, any age** (P4 / P5 / P6). No grown-up control on this screen.
Mock: `design/screens/cell-check/` (shots at 320 and 768) · Built by row **CM-21** (behind `cellCheck`)

## Scenario (Given-When-Then)

Given: a learner who finished a cell's first volume, or who opens a cell they have not started and already knows some of it
When: they tap **Take the Cell Check** on the cell's page, or **Test out** on an unstarted cell
Then: about 3 minutes of 8-10 rounds from that cell only (at least ceil(0.3 x rounds) typed or built: 3 of 8, 9 or 10, §4.5) play in the review screen; the result shows stars; 3 stars (80 % or more right on the first try, never shown as a number) counts toward Mastered, or marks the cell Done as a test-out; any other result is a calm, useful next step, never a fail

## Screen goal

"Show what I know about this place." (secondary: skip ahead when I already know it)

## Box diagram

```
A. The cell's page after its first volume is done (episode/detail.md, the added block under the header)
+--------------------------------+
| [<- back]                      |
| [Stage 2] [Food]               |
| Lunch Box Words        (title) |
| +----------------------------+ |
| | (ring48) Practiced         | |  <- mastery block (journey/mastery-ring.md E):
| | Take the Cell Check to     | |     the ring at 48 dp, the level word, at most
| | reach Mastered.            | |     two state lines (level 3 only) and the hint
| | Cell Check                 | |
| | About 3 minutes. Show what | |
| | you know from this place.  | |
| | [[ TAKE THE CELL CHECK ]]  | |  <- the page's ONE primary when every quest of
| +----------------------------+ |     the cell has stars; otherwise a secondary
| Quests                         |     button (the next quest's Start stays primary)
| (1) ... * * *  [ Play again ]  |
| (2) ... * * *  [ Play again ]  |
+--------------------------------+

A2. After a Cell Check with 3 stars (the result latches, §4.4)
| | Cell Check  [check-circle]   | |  <- one line "Cell Check done" with the check;
| | [ Take it again ]            | |     the button becomes secondary; any other
|                                      result adds no line at all

B. An unstarted cell the learner may open (episode/detail.md, quest list)
| Quests                         |
| (1) Fruit and Snacks           |
|     [[ START ]]                |  <- the first quest's Start stays the primary
| (2) ...                        |
| (3) ...                        |
| Already know this?             |  <- one quiet line under the list, never above
| [ Test out ]                   |     Start; hidden in E3's hidden arm, on a
|                                |     not-open-yet cell, on Stage 1 cells and
|                                |     with `cellCheck` off

C. Intro (route CellCheck { cellId, mode: 'check' | 'testout' })
+--------------------------------+
| [x]                            |
|        [hoya - waving]         |
|   Cell Check                   |  <- or "Test out"
|   About 3 minutes. Pictures,   |
|   sounds and typing. No timer. |
|   -- test out adds:            |
|   If it goes well, this place  |
|   is marked Done and you can   |
|   skip ahead. Every quest stays|
|   open to play.                |
|   [[ LET'S GO ]]               |
|   [ Maybe later ]              |
+--------------------------------+

D. A round: reviews/daily-review.md B, B2 (the cell's items only, interleaved by kind and format; no theme
   line, because every item is from this cell; a typed round keeps its Done button and the HangulKeyboard)

E. Cell Check result, 3 stars
|        [hoya - cheering]       |
|           Mastered!            |  <- the level word when this check raised the level;
|            * * *               |     otherwise the star headline ("Wonderful!")
|   (ring48 fills to the level)  |  <- the new segment fills once (reduced motion: drawn
|   [[ BACK TO THE MAP ]]        |     filled); then Back to the map is the primary
|   [ Back to this place ]       |

E2. Cell Check result, 1 or 2 stars
|        [hoya - thinking]       |
|          Great work!           |  <- "Good try!" at 1 star
|            * *                 |
|   Hoya will bring the tricky   |
|   ones back in your reviews.   |
|   You can take the check again |
|   any time.                    |
|   [[ BACK TO THIS PLACE ]]     |
|   [ Back to the map ]          |

F. Test out result, 3 stars
|        [hoya - cheering]       |
|        You tested out!         |
|            * * *               |
|   (ring48: the Done segment)   |
|   [[ GO TO YOUR NEXT LESSON ]] |  <- routeNext, which now skips this cell
|   [ Back to the map ]          |

G. Test out result, 1 or 2 stars
|        [hoya - waving]         |
|          Good start!           |
|            * *                 |
|   Start with the first quest.  |
|   Hoya will help with the rest.|
|   [[ START THE FIRST QUEST ]]  |
|   [ Back to the map ]          |

H. The cell's page after a test-out
| (1) Fruit and Snacks           |
|     [Tested out]  * *          |  <- a pill with the words, and 2 stars (§4.5)
|     [ Play ]                   |  <- every quest stays replayable
| ...                            |

I. Stop the check? (over D; the same sheet in both modes)
|   Stop the check?              |
|   You can take it again any    |
|   time.                        |
|   [[ KEEP GOING ]]   [ Stop ]  |  <- the live `learner.stageReview.leave.*` sheet,
                                       reused as it is (no claim about what is saved)
```

- **Never on any panel**: a percentage, "8 of 10", a score, a pass mark, a timer, "failed", "not passed" or "try harder". The 80 % threshold is the 3-star tier of F-RVW-001 §3.1, so the learner only ever sees stars.
- A Cell Check result that is not 3 stars changes nothing visible on the map: no line, no mark, no lower ring. Only a 3-star result adds the "Cell Check done" line.
- "Tested out" is a pill with words, in the success tone with `text.primary` words, never a lock or a skip arrow.

## Interaction points

- A: [[ TAKE THE CELL CHECK ]] -> C (`mode: 'check'`). A2: [ Take it again ] -> C.
- B: [ Test out ] -> C (`mode: 'testout'`).
- C: [[ LET'S GO ]] -> D; `review.start { kind: 'cell-check' }`. [x] / [ Maybe later ] -> back (nothing started).
- D: as `reviews/daily-review.md` B and B2; [x] or system back -> I.
- Last round -> E / E2 (check) or F / G (test out); `review.complete { kind: 'cell-check', stars }`; a test-out also sends `testout.finished { cellId, passed, items, firstTryCorrect }` (internal analytics, never on a learner screen).
- E: [[ BACK TO THE MAP ]] -> `journey/grid`; [ Back to this place ] -> the cell's page. E2: the same two, with the order swapped.
- F: [[ GO TO YOUR NEXT LESSON ]] -> the `routeNext` quest's page; [ Back to the map ] -> `journey/grid`.
- G: [[ START THE FIRST QUEST ]] -> `quest/player` for the cell's first quest; [ Back to the map ] -> `journey/grid`.
- I: [[ KEEP GOING ]] -> the same round; [ Stop ] -> the cell's page.

## Navigation graph

Enter from: `episode/detail` (the cell's page, panels A, A2, B) · the right pane of `journey/grid` on wide (F-LAYOUT-001 §3.7)
Exit to: `journey/grid` · `episode/detail` · `quest/player` (G) · the `routeNext` quest's page (F)

## States

- **check, passed** (3 stars): E; `cellCheckAt` latches (earliest pass); the level rises if §4.4's other parts hold; A2 from then on.
- **check, not 3 stars**: E2; nothing latches; items follow the spacing rule like any surface.
- **test out, passed**: F; level 1 (Done) latches; every quest of the cell's first volume shows "Tested out" with 2 stars (H); asked items go to box 2 (right) or box 1 (miss); unasked items to box 1, spread over 3 days (§4.5).
- **tested out (the cell's page afterwards)**: A shows, as on any level 1 cell: the ring with "Done", the hint "Keep reviewing to reach Practiced." and the Cell Check block, whose [ Take the Cell Check ] is a secondary button (the cell's quests keep their [ Play ] buttons of H, and `routeNext` has moved on). A passed test-out does **not** write `cellCheckAt`: the test-out is a way in (Done), and Mastered needs a Cell Check taken once the cell's items have been reviewed, so "Cell Check done" keeps one meaning. A2's line appears only after a real 3-star Cell Check.
- **test out, not passed**: G; asked items answered right on the first try go to box 2 (the learner showed them), and **missed asked items stay unmet, like the unasked ones**: the cell stays unstarted and its first quest teaches every item, so no untaught item is put up for review. This narrows §4.5 "Test-out details", which places items without a passed/not-passed condition: see Open questions.
- **test out and the stage**: a passed test-out writes `testedOut[cellId]` only, never `questDoneAt` or a quest's best stars (the "Tested out" pill and its 2 stars in H are drawn from `testedOut`). The stage latch keeps coming from `applyQuestResult` on a real quest run (`QuestResultOutcome.stageCompleted`, which needs every quest of the stage in `questDoneAt`), so a test-out never fires the stage ceremony, the stage card or the Stage Check. Testing out of a whole stage is CM-25 (Stage Jump Ahead, which amends F-PLC-001), not this row. The e2e "Cell Check and test-out" case asserts it: testing out of the last unfinished cell of a stage shows F, and no "See your Stage N prize".
- **a stage whose every cell is done or tested out, with quests still unplayed**: the stage pill keeps its state (it never reads Complete), and the Journey stage header shows one calm caption under its subtitle: "Play the quests you tested out of to finish this stage." (`learner.testOut.stageHint`, caption size, `text.secondary`, no icon, not a target). The caption goes away when the stage latches. Nothing reads as missing or late.
- **Stage 1 cells**: no Test out line. Placement (F-PLC-001) already places a learner inside Stage 1, and Stage 1's prize, Hangul Check and certificate need its quests done (pill `complete`), so a Stage 1 test-out would leave them out of reach. The Cell Check itself is offered on Stage 1 cells as on any cell.
- **stopped**: I -> [ Stop ]. A stopped Cell Check keeps the answers given (they count by the spacing rule, as on every surface, §4.3 and §4.5) and writes no `reviews[]` entry and no `cellCheckAt`. A stopped test-out writes nothing: the cell has not been taught, so no item is entered.
- **loading**: the round frame ([x] and the empty dots row) until the engine returns the cell's session; one frame, no spinner.
- **store unreadable** (the memory store or IndexedDB read fails through the safe storage wrapper): the Daily Review's D page ("Nothing is waiting right now", [[ Back home ]]) with [[ Back to this place ]] in place of Back home; nothing is written and nothing latches.
- **a cell the learner cannot open** (F-ENT-003 `closed`, the "Not open yet" preview of `episode/detail-access-preview.md`): no Test out line; nothing else changes.
- **E3 hidden arm**: B has no Test out line; A and the Cell Check are unchanged.
- **too few items** (a cell whose playable items are fewer than 8, for example audio missing with no device voice): the check uses what can play, at least `CELL_CHECK_MIN_ROUNDS` = 5 rounds (a floor below §4.5's 8-10, recorded in Open questions); with fewer than 5 the A block shows no button and the B line is hidden. The produce share stays ceil(0.3 x rounds).
- **no sound** (F-AUDIO-004): the sound notice; recognize rounds become read rounds; the check still counts.
- **offline**: plays fully offline (local engine, precached chunks).
- **`cellCheck` off** (§12.2): no Cell Check block button, no Test out line; latched results ("Cell Check done", "Tested out", levels) stay and show again when it is back on.
- **`memoryRecord` off, `cellCheck` on**: the effective flag is `cellCheck && memoryRecord`, so this is the same as `cellCheck` off (no Cell Check button, no Test out line). Answers would not be recorded, so a Cell Check could otherwise latch Mastered while no memory state moved. Latched results stay. CM-21 has a test that turns `memoryRecord` off remotely while `cellCheck` stays on.
- **access changed** (a plan lapses, a Family Plan ends, the learner leaves a class): on a cell with finished quests, A, A2 and the Cell Check stay playable, because learned content stays reviewable, as "Play again on quests already finished" in `episode/detail-access-preview.md`. Test out follows F-ENT-003 like playing the cell: on a `closed` cell there is no Test out line (the state above). No Premium pill, price, plan word or ask-a-grown-up door is added to any panel. CM-21's e2e covers a lapsed-plan profile.
- **`mastery` off, `cellCheck` on** (independent flags, §12.2): A's block keeps only "Cell Check", its body line and the button (no ring, no level word, no hint); A2 keeps "Cell Check done" and [ Take it again ]; E shows the star headline ("Wonderful!") and the stars with no ring and no level word; F shows "You tested out!" and the stars with no ring. B, C, D, E2, G, H and I are unchanged.
- **reduced motion**: the ring segment is drawn filled at once; no star pop.
- **320 x 568 and 200 % text**: the page scrolls; the mastery block's ring keeps 48 dp and the words wrap beside it; buttons are full width; display headlines follow the native rule of `reviews/daily-review.md` (`DISPLAY_HEADLINE_MAX_SCALE`).
- **768 and wide**: the page is the reading column (one pane) or the right pane (two panes); the mastery block's ring and words sit on one row.

## Accessibility

- Mastery block: one group read as its words, for example "Practiced. Take the Cell Check to reach Mastered." or "Mastered. Ready to refresh." (the ring itself is hidden; its level is in the words).
- [ Test out ]: the line "Already know this?" is its description.
- "Tested out" pill: read with the quest ("Fruit and Snacks. Tested out. 2 stars.").
- Results: the headline, "3 stars", then the lines; focus starts on the headline.
- All buttons `touchTarget.min` (64) or more; the 48 dp ring is not a target.

## Anti-shame checklist (§7.7)

| Rule | Here |
|---|---|
| no red for a miss | amber nudge in rounds; no result uses danger |
| no visible decay | a lower result changes nothing on the map; the ring never drops |
| no lost streak copy | none |
| no percentage | none; 80 % is only the 3-star tier |
| no per-question timer | none |
| no random rewards | none |
| no purchasable rewards | none; a closed cell has no Test out, and no price or plan word is drawn |
| no comparison between learners | none |
| no bad ending | E2 and G give a next step; "failed" never appears |
| no age wording | none |
| no speaking UI | none; produce rounds are typed or built |
| no emoji | none |

## Data needs

- reads: the cell's review items (CM-10), the memory store, `cellBest`, `cellCheckAt`, `testedOut`, `questDoneAt`, `useQuestAccess()` (entitlement), the E3 arm, the `cellCheck` flag, `routeNext`
- writes: answers to the memory store; on finish one `reviews[]` entry `{ kind: 'cell-check', scope: cellId, resultStars, itemIds, missedItemIds }` (no `mode` field: `ReviewEntrySchema` strips unknown keys on every parse; the mode lives in the route param during the session, a passed test-out is `testedOut[cellId]`, and `testout.finished` carries the rest for analytics); on a 3-star check `cellCheckAt[cellId]`; on a passed test-out `testedOut[cellId]`, `cellBest[cellId] = max(1, ...)` and the asked and unasked item states of §4.5; never `questDoneAt`
- telemetry: `review.start` / `review.complete` (`kind: 'cell-check'`), `testout.finished` (§11.3), `mastery.level_up` when the level rises

## Proposed copy (English; keys for CM-21, which adds es and ko)

| Key | English |
|---|---|
| `learner.cellCheck.title` | Cell Check |
| `learner.cellCheck.block.body` | About 3 minutes. Show what you know from this place. |
| `learner.cellCheck.block.cta` | Take the Cell Check |
| `learner.cellCheck.done` | Cell Check done |
| `learner.cellCheck.again.cta` | Take it again |
| `learner.cellCheck.intro.body` | About 3 minutes. Pictures, sounds and typing. No timer. |
| `learner.cellCheck.intro.start.cta` / `.later.cta` | Let's go / Maybe later |
| `learner.cellCheck.result.tricky` | Hoya will bring the tricky ones back in your reviews. You can take the check again any time. |
| `learner.cellCheck.result.toMap.cta` / `.toPlace.cta` | Back to the map / Back to this place |
| `learner.testOut.prompt` | Already know this? |
| `learner.testOut.cta` | Test out |
| `learner.testOut.title` | Test out |
| `learner.testOut.intro.extra` | If it goes well, this place is marked Done and you can skip ahead. Every quest stays open to play. |
| `learner.testOut.result.passed` | You tested out! |
| `learner.testOut.result.start` | Good start! |
| `learner.testOut.result.startBody` | Start with the first quest. Hoya will help with the rest. |
| `learner.testOut.result.next.cta` / `.first.cta` | Go to your next lesson / Start the first quest |
| `learner.testOut.pill` | Tested out |
| `learner.testOut.stageHint` | Play the quests you tested out of to finish this stage. |

Star headlines reuse `learner.dailyReview.result.headline.*`; the level words are `learner.mastery.level.*` (`journey/mastery-ring.md`). The stop sheet I reuses the live `learner.stageReview.leave.*` ("Stop the check?", "You can take it again any time.", "Keep going", "Stop"), the same sheet as `reviews/stage-check.md` H.

## Open questions

- None blocking CM-21. Decisions recorded for the row, for CM-0b or CM-21 to write into §4.5 so the engine's tests assert one number each:
  - A stopped test-out writes no item state (the spec defines only the finished case).
  - Unasked items and missed asked items stay unmet on a test-out without 3 stars: the cell stays unstarted and is taught by its first quest, so placing untaught items in box 1 would review words the learner has not met. Only asked items right on the first try are entered (box 2). §4.5 "Test-out details" (unasked items to box 1, spread over 3 days) then applies to a passed test-out only.
  - A passed test-out writes `testedOut` and `cellBest` = 1 but never `cellCheckAt`; the Cell Check part of Mastered needs a real Cell Check.
  - Test out is not offered on Stage 1 cells (placement covers Stage 1, and its prize and Hangul Check need its quests). For CM-21 and CM-22: a stage whose cells are all done or tested out, with tested-out quests unplayed, keeps its pill and shows `learner.testOut.stageHint` under the stage header until it latches.
  - The produce share is ceil(0.3 x rounds) (§4.5 "at least 30 %"): 3 rounds of 8, 9 or 10, and 2 of 5.
  - `CELL_CHECK_MIN_ROUNDS` = 5: a cell with 5 to 7 playable items still offers a shorter check; with fewer than 5 there is none.
  - A test-out never completes a stage (see States); a whole-stage skip stays CM-25.
