# Reviews/Check resume — the Hangul Check and the Stage Check go on from the next part after an interruption (wireframe v1)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` §3.4 (rows LR-3a, LR-3b; work order WO-07 b) · amends the intro of `reviews/hangul-check.md` (A) and `reviews/stage-check.md` (D) with a resume variant; parts, pauses, stop sheet and result unchanged
Audience: **learner, any age** (P4 / P5 / P6)
Route: `StageReview { stageKey: 'stage1' }` (the Hangul Check) · `StageCheck { stageKey }` (Stages 2-7)
Mock: row LR-0b, `design/screens/quest-leave-resume/`

## Scenario (Given-When-Then)

Given: a learner finished some parts of a check (the Hangul Check's 5 parts of 7, the Stage Check's parts of 5) and the app closed, a call came or the tab reloaded, less than 24 hours after the check began
When: they open the same check again
Then: a page asks "Pick up where you left off?"; Continue opens the first item of the next part; Start again begins a new check from the intro

## Screen goal

"Go on with the check." (secondary: start it again)

## Box diagram

Panel A — resume page (phone), in place of the intro

```
+--------------------------------+
| [x]                            |  <- Close: leaves at once, the place is kept
|        [hoya - waving]         |
|         Hangul Check           |  <- the check's own title (or Stage Check)
|  Pick up where you left off?   |  <- learner.stageReview.resume.title
|                                |
|  [[       CONTINUE        ]]   |  <- -> first item of the next part
|  [      START AGAIN        ]   |  <- -> the normal intro (A / D), place forgotten
+--------------------------------+
```

- No reading-practice switch here: the run keeps the choice it was started with.
- No count of parts done and none left, no "n of m", no percent (the review-copy rule).

Panel B — after Continue: the normal round frame of the next part (as `reviews/hangul-check.md` B / `reviews/stage-check.md` E), its dots empty for the new part.

## Interaction points

- [[ CONTINUE ]] → the next part's first item. The answers of the parts already done are kept and never asked again. No second `review.start` / Stage Check start event.
- [ START AGAIN ] → the stored check is forgotten; the normal intro with its switch and Let's go.
- [x] → back; the stored check is kept (open the check again within 24 hours and this page shows again).
- Stop the check? (during a part or a pause, unchanged sheet) → Stop forgets the stored check (OD-LR1 (a)).
- The result → the stored check is forgotten.

## Navigation graph

Enter from: the Stage 1 ceremony's Take the Hangul Check · the Journey's Hangul Check / Stage Check buttons (unchanged entries)
Exit to: the check's parts (Continue) · the check's intro (Start again) · back (Close)

## States

- **success**: Panel A → Panel B → pauses → result, as today.
- **nothing to resume** (none stored; another check's run; older than 24 hours; the check's content changed; for the Stage Check also another UI language, another review-item set, or a round that cannot be built again): the normal intro (no Panel A).
- **error** (the stored check cannot be read): the normal intro; nothing else changes.
- **loading**: the check's loading frame as today until the stored check is read (the Stage Check also rebuilds its rounds and loads their meanings).
- **not open** (Stage 1 not finished; the stage not open): the existing not-ready page, before any stored check is looked at.
- **200 % text at 320 x 568**: the page scrolls; both buttons stay full width, at least `touchTarget.min` high.

## Data needs

- `hr:check-run:<profileId>` (one stored check per learner; new): written at each pause, read through the read contract.
- Hangul Check: the seed, its item ids, the parts done, their first answers, the romanization choice, the start time.
- Stage Check: the stage, UI language, review-item hash, seed, the engine's questions, the next part, the answers before it, the romanization choice, the start time.
- Strings: `learner.stageReview.resume.title`, `.startAgain.cta` (new); `common.buttons.continue` (reused).

## Open questions

- OD-LR1 (does Stop forget the place) and OD-LR7 (Stage Check resume now, or the Hangul Check only) are the owner's (spec §10).
- The part in play when the check stopped is asked again from its first item; for the Stage Check those items were already written to the memory store once (spec §4).
