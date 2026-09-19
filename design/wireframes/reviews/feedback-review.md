# Reviews/Feedback-Review — quest-tail recall (wireframe v1)

Spec: `docs/specs/F-RVW-001-review-tests.md` §3.3
Audience: **learner (P4/P5 child, 5–11)**

## Scenario (Given-When-Then)

Given: a learner just finished a quest, saw their stars on `results/celebrate`, and at least one item in that quest was answered wrong
When: they tap the primary CTA on the results screen
Then: one quick "do you remember?" question about the quest's main new element appears, Hoya recaps regardless of the answer, and the learner is back on home within 45 s — with nothing subtracted

## Screen goal

"Recall today's one new thing once more, then move on."

## Box diagram

```
+----------------------------------+
|                    [ skip ]      |  <- top-right, always visible,
|                                  |     plain text not a button
|        [hoya - thinking]         |
|                                  |
|   "Do you remember this one?"    |  <- one-line prompt placeholder
|                                  |
|   +--------------------------+   |
|   |   prompt (new jamo /     |   |  <- the quest's main new
|   |   picture + audio)       |   |     element, large
|   +--------------------------+   |
|                                  |
|   +------------+ +------------+  |
|   |  choice A  | |  choice B  |  |  <- 2 choices max (quick)
|   +------------+ +------------+  |
|                                  |
|   (no timer shown)               |  <- 15 s auto-skip is silent
+----------------------------------+

after answer / skip:
+----------------------------------+
|        [hoya - cheering]         |
|   recap bubble: "you saw X       |  <- same line for right, wrong
|    N times today" (placeholder)  |     and skipped
|                                  |
|   [[ DONE ]]                     |  -> home/todays-mission
+----------------------------------+
```

- One question, two choices, one recap. No stars here — the quest's stars already covered it (§3.3 "no extra stars").
- No countdown ring or ticking sound: the 15 s auto-skip exists so a stuck child is not stuck, not to create urgency.
- Skipped is recorded as `skipped`, never as wrong.

## Interaction points

- Choice tap → answer registers → recap state (the Hoya line does not change with correctness)
- [ skip ] → recap state immediately, attempt marked `skipped`
- 15 s with no input → same as skip, silently
- [[ DONE ]] → `home/todays-mission` (Main tabs reset, mirrors the current `results/celebrate` "Back to journey")
- Audio prompt tap → replay, unlimited

## Navigation graph

Enter from: `results/celebrate` (only when the quest had ≥ 1 wrong item — otherwise results goes straight to home)
Exit to:    `home/todays-mission` (done / skip) · `episode/detail` (if results passed a "next quest" intent through)

## States

- **success**: question → recap → done, ≤ 45 s wall-clock including animation.
- **empty** (quest had no wrong item, or new-element count is 0): this screen does not fire; `results/celebrate` exits directly. Not a rendered state.
- **error** (prompt asset missing): skip straight to the recap state with a generic line ("nice work today") — never block the exit from a celebration.
- **reduced motion**: recap appears without the Hoya pose-change animation.

## Data needs

- reads: the just-completed quest (id, main new element, wrong-item list from the quest result params) · active profile
- computed by `logic/reviews/engine` (`feedback` kind, 1 item) — the trigger condition lives in `results/celebrate`, not here
- writes: `ReviewAttempt` (kind `feedback`, result `correct | wrong | skipped`) to the profile store; feeds Pool C of tomorrow's daily test
- telemetry: `review.feedback.shown`, `review.feedback.answered` (result), `review.feedback.skipped` (reason: tap | timeout)

## Open questions

- **Trigger rule conflict**: spec §3.3 fires the tail whenever new-element count ≥ 1; the app map (§4.2) and this wireframe fire it only when ≥ 1 item was wrong. Which is authoritative? (recommend the map's rule — a perfect quest should not be followed by a quiz)
- Inline in the Celebrate surface (spec wording) vs a separate screen after the primary CTA (this wireframe)? Separate keeps `results/celebrate` untouched; inline keeps the child on one screen. Decide before the design pass.
- Spec §3.3 recap copy is written in Korean — English placeholder used here per CLAUDE.md §1.
- Should skip be tappable by the child at all, or only reachable by the 15 s timeout? (beta: measure skip-tap rate by age band)
