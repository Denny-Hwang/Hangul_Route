# Reviews/Cell Check — the check of one grid cell, and Test out from an unstarted cell (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.4 (levels: the Cell Check passed toward Mastered, or as a test-out toward Done), §4.5 (sessions table "Cell Check", "Test-out details", "Never on a review screen"), §4.1 (pretesting and test-out), §7.7 (anti-shame checklist), §11.3 (`review.*` kind `cell-check`, `testout.finished`), §11.4 (experiment E3: Test out offered against hidden), §12.2 (`cellCheck` off), §14 (e2e "Cell Check and test-out") · access F-ENT-003 (a test-out needs access to the cell, the same as playing it) · star rules F-RVW-001 §3.1
Extends: `episode/detail.md` (the cell's page: one added block and one added line), `reviews/daily-review.md` (the round screen B, B2 and the stop sheet pattern), `journey/mastery-ring.md` (the ring and the level words)
Audience: **learner, any age** (P4 / P5 / P6). No grown-up control on this screen.
Mock: `design/screens/cell-check/` (shots at 320 and 768) · Built by row **CM-21** (behind `cellCheck`)

## Scenario (Given-When-Then)

Given: a learner who finished a cell's first volume, or who opens a cell they have not started and already knows some of it
When: they tap **Take the Cell Check** on the cell's page, or **Test out** on an unstarted cell
Then: about 3 minutes of 8-10 rounds from that cell only (at least 3 in 10 typed or built, §4.5) play in the review screen; the result shows stars; 3 stars (80 % or more right on the first try, never shown as a number) counts toward Mastered, or marks the cell Done as a test-out; any other result is a calm, useful next step, never a fail

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
|                                |     not-open-yet cell and with `cellCheck` off

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

I. Stop the check? (over D)
|   Stop the check?              |
|   Nothing changes. You can     |
|   take it again any time.      |
|   [[ BACK TO IT ]]   [ Stop ]  |
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
- I: [[ BACK TO IT ]] -> the same round; [ Stop ] -> the cell's page.

## Navigation graph

Enter from: `episode/detail` (the cell's page, panels A, A2, B) · the right pane of `journey/grid` on wide (F-LAYOUT-001 §3.7)
Exit to: `journey/grid` · `episode/detail` · `quest/player` (G) · the `routeNext` quest's page (F)

## States

- **check, passed** (3 stars): E; `cellCheckAt` latches (earliest pass); the level rises if §4.4's other parts hold; A2 from then on.
- **check, not 3 stars**: E2; nothing latches; items follow the spacing rule like any surface.
- **test out, passed**: F; level 1 (Done) latches; every quest of the cell's first volume shows "Tested out" with 2 stars (H); asked items go to box 2 (right) or box 1 (miss); unasked items to box 1, spread over 3 days (§4.5).
- **test out, not passed**: G; asked items are set by their result (right box 2, miss box 1), unasked stay unmet; the cell stays unstarted, so its first quest still teaches everything.
- **stopped**: I -> [ Stop ]. A stopped Cell Check keeps the answers given (they count by the spacing rule, as on every surface, §4.5). A stopped test-out writes nothing: the cell has not been taught, so no item is entered.
- **a cell the learner cannot open** (F-ENT-003 `closed`, the "Not open yet" preview of `episode/detail-access-preview.md`): no Test out line; nothing else changes.
- **E3 hidden arm**: B has no Test out line; A and the Cell Check are unchanged.
- **too few items** (a cell whose playable items are fewer than 8, for example audio missing with no device voice): the check uses what can play, at least 5 rounds; with fewer than 5 the A block shows no button and the B line is hidden.
- **no sound** (F-AUDIO-004): the sound notice; recognize rounds become read rounds; the check still counts.
- **offline**: plays fully offline (local engine, precached chunks).
- **`cellCheck` off** (§12.2): no Cell Check block button, no Test out line; latched results ("Cell Check done", "Tested out", levels) stay and show again when it is back on.
- **reduced motion**: the ring segment is drawn filled at once; no star pop.
- **320 x 568 and 200 % text**: the page scrolls; the mastery block's ring keeps 48 dp and the words wrap beside it; buttons are full width.
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
- writes: answers to the memory store; on finish one `reviews[]` entry `{ kind: 'cell-check', resultStars, itemIds, mode }`; on a 3-star check `cellCheckAt[cellId]`; on a passed test-out `testedOut[cellId]`, `cellBest[cellId] = max(1, ...)` and the asked and unasked item states of §4.5
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
| `learner.cellCheck.leave.title` / `.body` | Stop the check? / Nothing changes. You can take it again any time. |
| `learner.testOut.prompt` | Already know this? |
| `learner.testOut.cta` | Test out |
| `learner.testOut.title` | Test out |
| `learner.testOut.intro.extra` | If it goes well, this place is marked Done and you can skip ahead. Every quest stays open to play. |
| `learner.testOut.result.passed` | You tested out! |
| `learner.testOut.result.start` | Good start! |
| `learner.testOut.result.startBody` | Start with the first quest. Hoya will help with the rest. |
| `learner.testOut.result.next.cta` / `.first.cta` | Go to your next lesson / Start the first quest |
| `learner.testOut.pill` | Tested out |

Star headlines reuse `learner.dailyReview.result.headline.*`; the level words are `learner.mastery.level.*` (`journey/mastery-ring.md`).

## Open questions

- None blocking CM-21. Decision recorded for the row: a stopped test-out writes no item state (the spec defines only the finished case).
