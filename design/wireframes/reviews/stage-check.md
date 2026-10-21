# Reviews/Stage Check — the optional check of Stages 2-7, the stage ceremony and the stage card (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.3 (one prize table `PRIZE_STAGES`, the stage latch triggers the F-MOTION-003 ceremony, a stage card and a "Stage N complete" page; the Stage Check is offered, never required, never blocks Stage N+1, its best result latches; "Stage Check", never "exam"; no certificate), §4.5 (sessions table "Stage Check": about 20 items, 6-8 min, untimed, retake freely, at least 30 % produce, from all five themes; "Never on a review screen"), §4.8 step 7 (the one retroactive summary), §7.7 (anti-shame checklist), §11.3 (`review.*` kind `stage-certificate`, `stage.card_opened`), §12.2 (`stageChecks` off), OD-1 · patterns from `results/stage1-complete.md` (Stage 1 ceremony) and `reviews/hangul-check.md` (parts and pauses), which stay valid for Stage 1 · ceremony motion F-MOTION-003
Supersedes for Stages 2-7: `reviews/stage-review.md` (F-RVW-001 §3.4's 4-6 item review and its certificate)
Audience: **learner, any age** (P4 / P5 / P6). No grown-up control on this screen; reports show the result to grown-ups (F-REPORT-001).
Mock: `design/screens/stage-check/` (shots at 320 and 768) · Built by row **CM-22** (behind `stageChecks`); stage cards by CM-23

## Scenario (Given-When-Then)

Given: a learner finishes the last quest they were missing in a stage from Stage 2 to Stage 7 (the stage latch)
When: Results shows the run
Then: the one big button is **See your Stage N prize**; the ceremony cheers, recaps the five places of the stage with their mastery rings, shows the stage card, and offers the Stage Check (about 7 minutes, skippable); the check, when taken, ends with stars and "Your best result is kept", never a score, and nothing ever waits on it

## Screen goal

"I finished a whole stage: here is what I can do now, and my stage card." (secondary: an optional Stage Check)

## Box diagram

```
A. Results on the run that completes Stage N (results/celebrate.md; only the buttons change, as Stage 1)
|  ( star row, Hoya, quest card banner, extra cards )  |
|   [[ SEE YOUR STAGE 2 PRIZE ]]  |  <- the ONE primary -> B
|   [ Play next quest ]           |  <- ghost, when there is one
|   [ Back home ]                 |

B. Ceremony (route StageComplete { stageKey: 'stage2' }; F-MOTION-003)
+--------------------------------+
|        [hoya - cheering]       |
|       Stage 2 complete!        |  <- title (display)
| +----------------------------+ |
| | You can read everyday      | |  <- Hoya bubble: one can-do line per stage
| | words now!                 | |
| +----------------------------+ |
|  Your places in Stage 2        |
|  [가][bowl][lant][leaf][top]   |  <- five mini cells with their mastery rings
|  Letters Food Holiday Nature Play |  (journey/mastery-ring.md; decorative recap)
|                                |
|  Your stage card               |
|  +--------------+              |
|  | [card art]   |              |  <- one card in its rarity frame (PRIZE_STAGES);
|  | Stage 2 card |              |     a button -> library/card-detail and
|  +--------------+              |     stage.card_opened { stage }
|                                |
|  [[ TAKE THE STAGE CHECK ]]    |  <- the ONE primary
|  About 7 minutes. You can      |     its description line
|  skip it.                      |
|  [ See my cards ]              |  <- ghost
|  [ Back home ]                 |  <- ghost
+--------------------------------+

C. Journey stage header once Stage N is complete (journey/grid.md stage row)
|  (2) Words              [ Complete ] |  <- the availability pill reads Complete
|      Read and write everyday words   |
|        [ See your prize ] [ Stage Check ] |  <- small ghost buttons; once taken, the
|                                      |     Stage Check button shows the best stars
|                                      |     after its word: [ Stage Check * * ]

D. Stage Check intro (route StageCheck { stageKey })
+--------------------------------+
| [x]                            |
|        [hoya - waving]         |
|   Stage Check                  |
|   About 7 minutes. Words,      |
|   sounds and sentences from    |
|   all five places. No timer.   |
|   Take it again any time. Your |
|   best result is kept.         |
|   (o-) Reading practice: hide  |  <- the Hangul Check switch, reused
|        the romanization until  |
|        I tap                   |
|   [[ LET'S GO ]]               |
|   [ Maybe later ]              |
+--------------------------------+

E. A part (4 parts of 5 rounds): reviews/daily-review.md B and B2, with the dots row showing the part's
   5 rounds only, and the theme line (the items mix all five themes)

E2. Pause between parts (3 times)
|        [hoya - cheering]       |
|   Lovely reading! Ready for    |  <- one line, changes per pause
|   more?                        |
|   [[ KEEP GOING ]]             |

F. Result
+--------------------------------+
|        [hoya - cheering]       |
|          Wonderful!            |  <- one word per star tier
|            * * *               |
|   Your best result is kept.    |
|   Hoya will bring the tricky   |  <- only when a round was missed first try
|   ones back in your Daily      |
|   Review.                      |
|   [[ BACK HOME ]]              |
|   [ See my cards ]             |
+--------------------------------+

G. The one retroactive summary (§4.8 step 7; shown once, the first time Home opens on the CM-22 build for a
   learner who had finished stages before it; latched in `stageRetroShownAt`, so it never shows again on
   another device or after a restore)
+--------------------------------+
|        [hoya - cheering]       |
|  You finished Stages 2 and 3   |
|  earlier                       |
|  Here are your stage cards.    |
|  [card] [card]                 |  <- the stage cards that exist then, each a button
|  [[ SEE MY CARDS ]]            |
|  [ Back home ]                 |
+--------------------------------+

H. Stop the check? (over E or E2; the live `learner.stageReview.leave.*` sheet, reused as it is)
|   Stop the check?              |
|   You can take it again any    |
|   time.                        |
|   [[ KEEP GOING ]]   [ Stop ]  |
```

- **Never on any panel**: a percentage, an "n of m", a score, a timer, "exam", "test", "pass", "fail" or a certificate (§7.3: no certificate for Stages 2-7; Stage 1 keeps its Hangul Check certificate).
- The Stage Check never gates: Stage N+1, its cells, cards and the route are unchanged whether or not it is taken (OD-1).
- The best result latches (`stageCheckAt`, earliest; best stars in `reviews[]`). A later lower result shows its own stars on F and never lowers the stars on C or in reports.
- No Premium pill, no price, no plan word on A to H.

## Interaction points

- A: [[ SEE YOUR STAGE N PRIZE ]] -> B (`navigate('StageComplete', { stageKey })`).
- B: stage card -> `library/card-detail`; sends `stage.card_opened { stage }`. Mini cells: not targets (decorative recap).
- B: [[ TAKE THE STAGE CHECK ]] -> D; [ See my cards ] -> Library (Cards); [ Back home ] -> Main tabs (stack reset).
- C: [ See your prize ] -> B; [ Stage Check ] -> D.
- D: [[ LET'S GO ]] -> E part 1; `review.start { kind: 'stage-certificate', stageKey, hideRomanization }` (the existing kind name; the UI never says "certificate"). [x] / [ Maybe later ] -> back.
- E: as `reviews/daily-review.md` B; the last round of a part -> E2 (or F after part 4). [x] or system back -> H.
- E2: [[ KEEP GOING ]] -> the next part.
- F: `review.complete { kind: 'stage-certificate', stageKey, stars }`; [[ BACK HOME ]] -> Main; [ See my cards ] -> Library (Cards).
- G: card -> `library/card-detail` (and `stage.card_opened`); [[ SEE MY CARDS ]] -> Library; [ Back home ] -> Home. Never shown again.
- H: [[ KEEP GOING ]] -> where it was; [ Stop ] -> back. The answers already given are recorded by the spacing rule, as on every surface (§4.3 "Due items answered anywhere count"); a stopped check writes no `reviews[]` entry and no `stageCheckAt`, and C keeps its best stars.

## Navigation graph

Enter from: `results/celebrate` (the run with `stageCompleted` in `PRIZE_STAGES`) · `journey/grid` stage header (C) · Home (G, once) · Passport "Stage N complete" page (CM-D3, CM-60)
Exit to: `library/card-detail` · `library/gallery` · `home/todays-mission` · back to `results/celebrate` or `journey/grid`

## States

- **success**: A -> B -> (optional) D -> E x 4 with E2 -> F.
- **ceremony seen**: the ceremony never shows automatically a second time; C's [ See your prize ] reopens it.
- **no stage card yet** (the stage's card content has not shipped): B leaves the card block out and keeps everything else; G lists only cards that exist (and is skipped when none do).
- **retroactive** (stages finished before CM-22): no ceremony per stage; G once, listing them all.
- **not ready** (a stale link for a stage not complete, or `stage1`, which keeps `results/stage1-complete.md`): Hoya thinking, "This check is not open yet. Keep playing your quests." and [[ BACK HOME ]].
- **taken again**: a new attempt; C keeps the best stars.
- **an item cannot play**: skipped; a part with no playable round is skipped. When the stage has fewer than `STAGE_CHECK_MIN_ITEMS` = 10 playable items in all (for example no device voice and no recordings), C and B show no Stage Check button; otherwise the check plays what it can, with ceil(0.3 x rounds) produce rounds. The floor is a decision for CM-22 (see Open questions).
- **loading**: the round frame ([x] and the empty dots row) until the engine returns the session; one frame, no spinner.
- **store unreadable** (the memory store or IndexedDB read fails through the safe storage wrapper): the Daily Review's D page ("Nothing is waiting right now", [[ Back home ]]); nothing is written and nothing latches. The ceremony B does not read the memory store, so it still shows.
- **no sound** (F-AUDIO-004): the sound notice; recognize rounds become read rounds.
- **offline**: plays fully offline.
- **`stageChecks` off** (§12.2): B has no Stage Check button (See my cards becomes the primary), C has no Stage Check button; latched results stay and show again when it is back on.
- **reduced motion**: the F-MOTION-003 ceremony's reduced variant: no burst or confetti; the title, cells and card appear at once; no star pop on F.
- **320 x 568 and 200 % text**: display headlines follow the native rule of `reviews/daily-review.md` (`DISPLAY_HEADLINE_MAX_SCALE`); B scrolls; the five mini cells keep one row (each 48 dp, not targets) and their theme words keep the caption size (`maxFontSizeMultiplier` 1, as the Journey grid's theme word), so they never collide; the level words are in the group's label; the card is 2 columns wide; buttons full width.
- **768 and wide**: B in the reading column, the card beside the places row; F in the reading column.

## Accessibility

- B title is the screen heading; the places row is one group, and each place is read with its level word, as "Your places in Stage 2: Letters, Practiced. Food, Done. Holidays, Mastered. Nature, Done. Play, Done." (the level words of `journey/mastery-ring.md`).
- Stage card: "Open card: <title>".
- C's Stage Check button: "Stage Check, best 2 stars" once taken.
- Results: headline, "3 stars", lines, then buttons; focus starts on the headline.
- Buttons `touchTarget.min` (64) or more; C's small header buttons keep at least 48 dp (the Stage 1 header pattern).

## Anti-shame checklist (§7.7)

| Rule | Here |
|---|---|
| no red for a miss | amber nudge in rounds only |
| no visible decay | best result latches; the rings in B never drop |
| no lost streak copy | none |
| no percentage | none; stars only |
| no per-question timer | none; "No timer" is said on D |
| no random rewards | the stage card is fixed by `PRIZE_STAGES` |
| no purchasable rewards | none; no price or plan word |
| no comparison between learners | none |
| no bad ending | every result is a cheer; 1 star says "Good try!" with a next step |
| no age wording | none |
| no speaking UI | none |
| no emoji | none |
| (§7.3) never "exam", no certificate | the UI word is "Stage Check"; no certificate block |

## Data needs

- reads: `QuestResultOutcome.stageCompleted`, `PRIZE_STAGES`, the stage's cards and the profile's cards, `cellBest` for the five cells, `stageCheckAt` and best stars from `reviews[]`, the stage's review items, the `stageChecks` flag, `stageRetroShownAt` for G
- **`stageRetroShownAt`** (new snapshot field, added to the §4.8 table by this design and built Worker-first by CM-3b, W→A in CM-22): one ISO time, merge earliest. Written when G is first shown; G shows only while it is absent, so a second device, a sync or a restore from a backup never shows it again. A fixture test asserts it survives PUT / GET and a backup restore.
- writes: answers to the memory store; one `reviews[]` entry `{ kind: 'stage-certificate', scope: stageKey, resultStars, itemIds, missedItemIds }`; `stageCheckAt[stage]` (earliest); `stageRetroShownAt` (G); the card award stays in `applyQuestResult` (F-STORY-006 engine)
- telemetry: `review.start` / `review.complete` (`kind: 'stage-certificate'`), `stage.card_opened { stage }`, `stage.complete` and `card.unlocked` (sent by `applyQuestResult`)

## Proposed copy (English; keys for CM-22, which adds es and ko)

| Key | English |
|---|---|
| `learner.results.upperStagePrize.cta(stage)` | See your Stage {stage} prize |
| `learner.upperStageComplete.title(stage)` | Stage {stage} complete! |
| `learner.upperStageComplete.canDo.stage2` .. `.stage7` | stage2 "You can read everyday words now!" · stage3 "You can read short sentences now!" · stage4 "You can read and answer short everyday exchanges now!" · stage5 "You can read heritage stories now!" · stage6 "You can read menus, signs and short messages now!" · stage7 "You can write a short introduction now!" |
| `learner.upperStageComplete.places(stage)` | Your places in Stage {stage} |
| `learner.upperStageComplete.cardTitle` | Your stage card |
| `learner.stageCheck.title` | Stage Check |
| `learner.stageCheck.offer.cta` | Take the Stage Check |
| `learner.stageCheck.offer.body` | About 7 minutes. You can skip it. |
| `learner.stageCheck.intro.body` | About 7 minutes. Words, sounds and sentences from all five places. No timer. Take it again any time. Your best result is kept. |
| `learner.stageCheck.pause.first` / `.second` / `.third` | Lovely reading! Ready for more? / You are doing great. Keep going? / Last part. Here we go! |
| `learner.stageCheck.result.best` | Your best result is kept. |
| `learner.stageCheck.result.tricky` | Hoya will bring the tricky ones back in your Daily Review. |
| `learner.stageCheck.notReady` | This check is not open yet. Keep playing your quests. |
| `learner.stageCheck.retro.title(stages)` | one stage: You finished Stage {stages} earlier · more: You finished Stages {stages} earlier (`stages` is the list joined by the locale's `Intl.ListFormat`, "2 and 3"; the form is chosen by the number of stages) |
| `learner.stageCheck.retro.body` | Here are your stage cards. |
| `a11y.stageCheck.best(stars)` | Stage Check, best 1 star / Stage Check, best {stars} stars (one / other by `plural()`) |

**New namespace on purpose:** `learner.stageComplete.*` and `learner.results.stagePrize.cta` are the live Stage 1 strings (`results/stage1-complete.md`: "Hangul complete!", the fixed can-do line, "See your Stage 1 prize"), so Stages 2-7 get `learner.upperStageComplete.*` and `learner.results.upperStagePrize.*` and the Stage 1 leaves stay exactly as they are. The header button reuses `learner.journey.stagePrize.cta` ("See your prize"); See my cards and Back home reuse `learner.stageComplete.seeCards` / `.backHome`. The can-do lines follow the OD-12 stage wording (no speaking claim: Stage 4 is reading and answering, Stage 7 is writing). The stop sheet reuses `learner.stageReview.leave.*` as it is ("Stop the check?", "You can take it again any time.", stay "Keep going", "Stop"; H draws those words), the switch `learner.stageReview.intro.hideRomanization`, the start and later buttons `learner.stageReview.intro.start` / `.later`, and star headlines `learner.dailyReview.result.headline.*`.

## Open questions

- None blocking CM-22. Decision recorded for CM-22 to write into §4.5: `STAGE_CHECK_MIN_ITEMS` = 10 playable items, below which no Stage Check is offered, and the produce share is ceil(0.3 x rounds). A test-out never completes a stage (`reviews/cell-check.md` States), so the ceremony, the card and the Stage Check only follow real quest runs.
- The Passport "Stage N complete" page and its report line are drawn by CM-D3 and F-REPORT-001's rows; this file only names the entry.
