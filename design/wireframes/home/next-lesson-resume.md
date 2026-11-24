# Home/Next-lesson resume — the hero says the lesson goes on where it stopped, and keeps a way to start it again (wireframe v1)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` §3.2 and §3.3 (row LR-2; work order WO-07 a) · amends `home/next-lesson-hero.md` (Panel A gains a resume variant; nothing else on Home moves) · the saved run is AMENDMENTS-AUDIT-2026-11 AU-12
Audience: **learner, any age** (and a grown-up handing the device to them)
Route: learner app Home tab
Mock: row LR-0b, `design/screens/quest-leave-resume/`

## Scenario (Given-When-Then)

Given: a learner left the hero's lesson in the middle without choosing Leave (the app was closed, a call came, the tab was reloaded) less than 24 hours after starting it
When: they open Home
Then: the hero reads Continue and says where they stopped; Continue opens that step; a quiet Start again asks first, then opens the first step

## Screen goal

"Go on with the lesson." (secondary: start it again on purpose)

## Box diagram

Panel A — resume variant (phone)

```
+--------------------------------+
| (Hoya) Hi, Mina!  ( Aa )(Profile)|
| (week strip / pills as today)  |
|+------------------------------+|
|| NEXT LESSON          (eyebrow)||
|| Meet o, u, m and the circle  ||  <- lesson title
|| Stage 1 · Meet the Letters · ||  <- where line (unchanged)
||  lesson 2 of 3               ||
|| About 4 minutes              ||
||                              ||
|| [[        CONTINUE        ]] ||  <- same place as Start; opens the saved step
|| You stopped at step 3 of 5.  ||  <- one caption, UNDER the button
|| Start again                  ||  <- quiet link -> Panel B
|| See your Learning Route  >   ||  <- unchanged, last
|+------------------------------+|
| Today with Hoya                |  <- unchanged
+--------------------------------+
```

Panel B — Start again asks first (ConfirmSheet, bottom sheet on a phone)

```
|................................|  <- backdrop: a tap = Keep my place
|+------------------------------+|
|| Start this lesson again?     ||
|| You go back to the first     ||
||  step. Your stars and cards  ||
||  stay.                       ||
|| [[     KEEP MY PLACE      ]] ||  <- cancel: first, focused
|| [       START AGAIN        ] ||  <- confirm: plain tone
|+------------------------------+|
```

Panel C — plain hero (no resume variant): exactly `home/next-lesson-hero.md` Panel A (Start, or Continue once a quest is done; no caption, no link).

## Interaction points

- [[ CONTINUE ]] → `quest/player` for the hero's lesson; it opens on the saved step (the step from its beginning). `next.started` as for any hero tap.
- Start again → Panel B.
- [[ KEEP MY PLACE ]], the backdrop, a back → Panel B closes; nothing changes.
- [ START AGAIN ] → the saved run is forgotten, then `quest/player` opens the lesson on its first step.
- See your Learning Route → Route tab (unchanged).

## Navigation graph

Enter from: app start · the Home tab · Results "Back home" · any return to Home (the saved run is read each time Home comes into focus)
Exit to: `quest/player` (Continue, Start again) · Route tab · the cards' targets (unchanged)

## States

- **success**: Panel A (resume variant) → Continue or Panel B.
- **no saved run / not resumable** (none stored; another lesson's run; a run still on its first step; older than 24 hours; the lesson's steps changed; a story lesson, which resumes only through Keep reading): Panel C.
- **loading**: Panel C until the saved run is read and the lesson's steps are in; the caption and the link then appear under the button, so the button never moves.
- **error** (the saved run cannot be read): Panel C; nothing else changes and nothing is written.
- **first day** (no quest done yet) with a saved run: Panel A; the button reads Continue, not Start.
- **wide (1180)**: the same order inside the hero card in the main column; the caption and the link sit under the button, left-aligned.

## Data needs

- `readSavedRun(profileId)` (reads `hr:quest-run:<id>` through the read contract; a failed read is "nothing to resume") and `resumableRun(saved, quest, now)`.
- The hero lesson's steps (its lesson chunk, loaded as the player loads it).
- Strings: `learner.home.next.resume.line`, `.startAgain.cta`, `.sheet.title`, `.sheet.message`, `.sheet.keep.cta` (new); `learner.home.next.continue.cta` (reused).
- Writes: only Start again's removal of the saved run.

## Open questions

- OD-LR5 (this layout vs a choice sheet on every Continue; another lesson's saved run not on Home) and OD-LR6 (Start again opens the lesson at once) are the owner's (spec §10).
- "About 4 minutes" stays the whole lesson's length in the resume variant; shortening it would need the steps' durations. Left as is unless the review asks.
- WO-38 row 2 moves the hero on Home; the resume parts move with it (they belong to the hero card).
