# Reviews/Save failed — a review or check whose finish could not be saved says so and tries again on the same answers (wireframe v1)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` §3.5 (row LR-4; work order WO-07 b) · amends the "store rejects" path of `reviews/daily-review.md` (it showed D, "All refreshed today") and `reviews/stage-check.md` (it showed the not-ready line) · same layout family as `shell/progress-read-failed.md` and the Oops screen
Audience: **learner, any age** (P4 / P5 / P6)
Route: `DailyReview` · `StageCheck`
Mock: row LR-0b, `design/screens/quest-leave-resume/`

## Scenario (Given-When-Then)

Given: a learner answered the last round of a Daily Review (or Keep going) or a Stage Check
When: the session's finish cannot be saved (a round's answer or the session's entry could not be written)
Then: a calm page says the app could not save it yet and that the answers are still here; Try again finishes the same session with the same answers and shows the result; nothing says "All refreshed today" or "not open yet"

## Screen goal

"Try the save again." (one action)

## Box diagram

Panel A — save failed (phone)

```
+--------------------------------+
| [x]                            |  <- route header Close: leaves at once
|                                |
|        [hoya - thinking]       |
|                                |
|  We could not save this yet.   |  <- learner.dailyReview.saveFailed.title
|  Your answers are still here.  |  <- learner.dailyReview.saveFailed.body
|                                |
+--------------------------------+
|  [[        TRY AGAIN       ]]  |  <- footer, always in view; busy while trying
+--------------------------------+
```

- No danger colour, no warning icon, no "failed" or "error" word (anti-shame rules; the review-copy rule).
- No score, no count of answers.

Panel B — after a Try again that worked: the session's normal result (`reviews/daily-review.md` C, `reviews/stage-check.md` F), with its stars, as if the first save had worked.

Panel C — the result page while the progress write is still waiting (OD-LR8): the normal result with one quiet line under the stars, "We could not save this yet. Keep the app open and we will try again." (`learner.results.saveLater`, the line Results shows). Same on the Hangul Check and Cell Check results.

## Interaction points

- [[ TRY AGAIN ]] → busy (cannot be pressed twice) → the rounds whose answer was not written are written again, then the finish runs again → Panel B; if it fails again → Panel A again.
- [x] → back to where the session was opened; this session's result is not written (earned stars and cards are untouched; a Daily Review not finished stays on Home).

## Navigation graph

Enter from: the last round of `reviews/daily-review` (B) or `reviews/keep-going` · the last round of `reviews/stage-check` (E)
Exit to: the result (Try again) · back (Close)

## States

- **success**: Panel A → Try again → Panel B.
- **fails again**: Panel A again (Try again stays; the header Close is the way out).
- **empty**: not applicable (the page exists only after a finish was tried).
- **loading**: Try again's busy state on the button; the page does not change under it.
- **finish answers "nothing to save"** (the Stage Check switched off or the stage closed meanwhile): the existing calm page, not this one (that line is true there).
- **200 % text at 320 x 568**: the body scrolls; Try again stays in the footer (the Oops screen's rule).

## Data needs

- Kept in the screen's memory: the plan, each round's first answer, each round's write (which ones failed).
- The finish is once per plan: a second try never writes a second entry, latch or event.
- Strings: `learner.dailyReview.saveFailed.title`, `.body` (new; the Stage Check reuses them); `common.buttons.tryAgain`, `learner.results.saveLater` (reused).

## Open questions

- OD-LR8 (the save-later line on the four check result pages) is the owner's (spec §10).
- After several failed tries there is no "still stuck" line (the progress-read-failed screen has one). A child who keeps tapping meets the same page; the header Close is the way out. Add the line if the review asks for it.
