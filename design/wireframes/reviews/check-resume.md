# Reviews/Check resume — the Hangul Check and the Stage Check go on after an interruption (wireframe v2)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` §3.4 (rows LR-3a, LR-3b; work order WO-07 b), revision 2 · amends the intro of `reviews/hangul-check.md` (A) and `reviews/stage-check.md` (D) with a reading frame and a resume variant; parts, pauses and result unchanged · **waits for OD-LR1 (what Stop does) and OD-LR9 (when answers are stored)**, both awaiting the owner; this file draws the recommendations, OD-LR1 (c) and OD-LR9 (b)
Audience: **learner, any age** (P4 / P5 / P6)
Route: `StageReview { stageKey: 'stage1' }` (the Hangul Check) · `StageCheck { stageKey }` (Stages 2-7)
Mock: row LR-0b, `design/screens/quest-leave-resume/`

## Scenario (Given-When-Then)

Given: a learner answered some items of a check, and the app closed, a call came, the tab reloaded or they chose Stop, less than 24 hours after the check began
When: they open the same check again
Then: a page asks "Pick up where you left off?"; Continue goes on at the item after the last one answered; Start again leads to the normal intro, and only Let's go there begins a new check

## Screen goal

"Go on with the check." (secondary: start it again)

## Box diagram

Panel R — reading (at most 800 ms; the Hangul Check had no loading frame before)

```
+--------------------------------+
| [x]                            |
|        [hoya - waving]         |
|         Hangul Check           |  <- the intro's Hoya and title, no buttons yet
|                                |
+--------------------------------+
```

The Stage Check reads inside its existing loading frame (the [x] and the empty dots).

Panel A — resume page (phone), in place of the intro

```
+--------------------------------+
| [x]                            |  <- Close: leaves at once, the place is kept
|        [hoya - waving]         |
|         Hangul Check           |  <- the check's own title (or Stage Check)
|  Pick up where you left off?   |  <- learner.stageReview.resume.title
|                                |
|  [[       CONTINUE        ]]   |  <- -> the item after the last one answered
|  [      START AGAIN        ]   |  <- -> the normal intro (A / D); nothing cleared yet
+--------------------------------+
```

- No reading-practice switch here: the run keeps the choice it was started with.
- No count of items done or left, no "n of m", no percent (the review-copy rule).

Panel B — after Continue: the normal round frame (as `reviews/hangul-check.md` B / `reviews/stage-check.md` E) at the next item. In the Hangul Check the part's game counts only the items left in that part.

Panel C — after Start again: the normal intro with its switch, Let's go and Maybe later. Let's go clears the stored check and begins a new one (the Stage Check plans it behind its loading frame). Maybe later or Close keeps the stored check.

Panel E — the stop sheet (during a part or a pause), with OD-LR1 (c):

```
|+------------------------------+|
|| Stop the check?              ||
|| You can keep going later.    ||  <- learner.stageReview.leave.bodyKept (new)
|| [[      KEEP GOING        ]] ||
|| [          STOP            ] ||  <- keeps the stored check
|+------------------------------+|
```

## Interaction points

- [[ CONTINUE ]] → the item after the last one answered; the stored first answers are kept and never asked again. No second start event. A stored run with every item answered (a finish that did not save) → straight to the finish.
- [ START AGAIN ] → Panel C. A mis-tap costs nothing.
- [x] on Panel A or C → back; the stored check is kept.
- Stop (Panel E) → back; the stored check is kept (OD-LR1 (c); with (a) it is cleared and the body stays "You can take it again any time.").
- The result → the stored check is forgotten.

## Navigation graph

Enter from: the Stage 1 ceremony's Take the Hangul Check · the Journey's Hangul Check / Stage Check buttons (unchanged entries)
Exit to: the check's rounds (Continue) · the check's intro (Start again) · back (Close, Stop)

## States

- **success**: R → A → B → pauses → result.
- **nothing to resume** (none stored; another check's run; older than 24 hours; the Hangul Check's items changed; for the Stage Check another UI language, another review-item set, a retired item or a stored round that fails its shape check): R → the normal intro.
- **error** (the stored check cannot be read, or the read takes longer than 800 ms): the normal intro; a read that lands later switches to Panel A only while the intro shows and nothing has started.
- **not open** (Stage 1 not finished; the stage not open): the existing not-ready page, before any stored check is looked at.
- **200 % text at 320 x 568**: the page scrolls; both buttons stay full width, at least `touchTarget.min` high.

## Data needs

- `hr:check-run:<profileId>` (one stored check per learner; new): written after each first answer (OD-LR9 (b)), read through the read contract within 800 ms.
- Hangul Check: the seed, its item ids, the first answers, the romanization choice, the start time.
- Stage Check: the stage, UI language, review-item chunk hash, the planned rounds, the first answers, the romanization choice, the start time.
- Strings: `learner.stageReview.resume.title`, `.startAgain.cta`, `learner.stageReview.leave.bodyKept` (new); `common.buttons.continue` (reused).

## Open questions

- OD-LR1 (does Stop forget the place) and OD-LR9 (store at each pause, after each answer, or after each answer with a replay) await the owner (spec §10).
