# Reviews/Save failed — a review or check whose finish could not be saved says so and tries again on the same answers (wireframe v2)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` §3.5 (row LR-4; work order WO-07 b), revision 2 · amends the "store rejects" path of `reviews/daily-review.md` (it showed D, "All refreshed today") and `reviews/stage-check.md` (it showed the not-ready line) · same layout family as `shell/progress-read-failed.md` and the Oops screen · owner decision 2026-11-23: OD-LR8 (a)
Audience: **learner, any age** (P4 / P5 / P6)
Route: `DailyReview` · `StageCheck`
Mock: row LR-0b, `design/screens/quest-leave-resume/`

## Scenario (Given-When-Then)

Given: a learner answered the last round of a Daily Review (or Keep going) or a Stage Check
When: the session's finish cannot be saved (a round's answer or the session's entry could not be written)
Then: a calm page says the app could not save it yet and that the answers are still here; Try again finishes the same session with the same answers and shows the result; nothing says "All refreshed today" or "not open yet"; a back asks before the answers are dropped

## Screen goal

"Try the save again." (one action)

## Box diagram

Panel A — save failed (phone)

```
+--------------------------------+
| [x]                            |  <- route header Close: asks (Panel F)
|                                |
|        [hoya - thinking]       |
|                                |
|  We could not save this yet.   |  <- learner.dailyReview.saveFailed.title (takes focus)
|  Your answers are still here.  |  <- learner.dailyReview.saveFailed.body
|                                |
|  It still did not save. You    |  <- learner.dailyReview.saveFailed.stillStuck,
|  can stop for now and try      |     only after 3 failed tries in a row
|  another time.                 |
+--------------------------------+
|  [[        TRY AGAIN       ]]  |  <- footer, always in view; busy while trying
+--------------------------------+
```

- No danger colour, no warning icon, no "failed" or "error" word (anti-shame rules; the review-copy rule).
- No score, no count of answers.

Panel B — after a Try again that worked: the session's normal result (`reviews/daily-review.md` C, `reviews/stage-check.md` F), with its stars, as if the first save had worked.

Panel C — the result page while the progress write is still waiting (OD-LR8): the normal result with one quiet line under the stars, "We could not save this yet. Keep the app open and we will try again." (`learner.results.saveLater`, the line Results shows). Same on the Hangul Check and Cell Check results.

Panel F — a back on Panel A (Close, Android back, browser back): the screen's own stop sheet with a true body

```
|+------------------------------+|
|| Stop for now?                ||  <- Daily Review's title (Stage Check: Stop the check?)
|| This is not saved yet. Your  ||  <- learner.dailyReview.saveFailed.leaveBody
||  stars and cards stay.       ||
|| [[       BACK TO IT       ]] ||  <- stay: first (Stage Check: Keep going)
|| [          STOP            ] ||
|+------------------------------+|
```

## Interaction points

- [[ TRY AGAIN ]] → busy (cannot be pressed twice) → the rounds whose answer was not written are written again, then the finish runs again → Panel B; if it fails again → Panel A, its title announced once (politely).
- [x], Android back, browser back → Panel F.
- Panel F [[ BACK TO IT ]] / a back on the sheet → Panel A. [ STOP ] → back to where the session was opened; this session's result is not written (earned stars and cards are untouched; a Daily Review not finished stays on Home; a Stage Check's stored answers stay for its resume page, `reviews/check-resume.md`).

## Navigation graph

Enter from: the last round of `reviews/daily-review` (B) or `reviews/keep-going` · the last round of `reviews/stage-check` (E) · the Stage Check's resume page when every item was answered
Exit to: the result (Try again) · back (Stop in Panel F)

## States

- **success**: Panel A → Try again → Panel B.
- **fails again**: Panel A again; after 3 tries in a row the still-stuck line shows.
- **empty**: not applicable (the page exists only after a finish was tried).
- **loading**: Try again's busy state on the button; the page does not change under it.
- **finish answers "nothing to save"** (the Stage Check switched off or the stage closed meanwhile): the existing calm page, not this one (that line is true there).
- **200 % text at 320 x 568**: the body scrolls; Try again stays in the footer (the Oops screen's rule).

## Data needs

- Kept in the screen's memory: the plan, each round's first answer, each round's write by round index (which ones failed).
- The finish is once per plan: a second try never writes a second entry, latch or event.
- Strings: `learner.dailyReview.saveFailed.title`, `.body`, `.leaveBody`, `.stillStuck` (new; the Stage Check reuses them); the stop sheets' titles and buttons, `common.buttons.tryAgain`, `learner.results.saveLater` (reused).

## Open questions

- None blocking.
