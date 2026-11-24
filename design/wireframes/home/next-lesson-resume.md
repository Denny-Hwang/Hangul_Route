# Home/Next-lesson resume — the hero says the lesson goes on where it stopped, and keeps a way to start it again (wireframe v2)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` §3.2 and §3.3 (row LR-2; work order WO-07 a), revision 2 · amends `home/next-lesson-hero.md` (Panel A gains a resume variant; nothing else on Home moves) · the saved run is AMENDMENTS-AUDIT-2026-11 AU-12 · owner decisions 2026-11-23: OD-LR5 (a), OD-LR6 (a)
Audience: **learner, any age** (and a grown-up handing the device to them)
Route: learner app Home tab
Mock: row LR-0b, `design/screens/quest-leave-resume/`

## Scenario (Given-When-Then)

Given: a learner left the hero's lesson in the middle without choosing Leave (the app was closed, a call came, the tab was reloaded) less than 24 hours after starting it, past its first step
When: they open Home
Then: the hero reads Continue and says from which step it goes on; Continue opens that step; a quiet Start again asks first, then opens the first step

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
|| About 4 minutes              ||  <- the lesson's length (unchanged)
||                              ||
|| [[        CONTINUE        ]] ||  <- same place as Start; opens the saved step;
||                              ||     its accessibility hint = the caption below
|| You can go on from step 3    ||  <- one caption, UNDER the button, text.secondary (owner decision 2026-11-24)
||  of 5.                       ||
|| [ Start again ]              ||  <- quiet link, role button, >= touchTarget.min -> Panel B
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
|| [[     KEEP MY PLACE      ]] ||  <- cancel: first, filled (the safe choice; owner decision 2026-11-24)
|| [       START AGAIN        ] ||  <- confirm: plain, outlined
|+------------------------------+|
```

Panel C — plain hero (no resume variant): exactly `home/next-lesson-hero.md` Panel A (Start, or Continue once a quest is done; no caption, no link).

Panel D — 200 % text at 320 x 568: the hero card grows; the order stays title, where, minutes, [[ CONTINUE ]], caption (wraps), Start again, Route link; Home scrolls; every control stays at least `touchTarget.min` high and fully visible when scrolled to.

## Interaction points

- [[ CONTINUE ]] → `quest/player` for the hero's lesson; it opens on the saved step (the furthest step reached; the step from its beginning). `next.started` as for any hero tap.
- Start again → Panel B.
- [[ KEEP MY PLACE ]], the backdrop, a back → Panel B closes; nothing changes.
- [ START AGAIN ] → the saved run is forgotten, then `quest/player` opens the lesson on its first step.
- See your Learning Route → Route tab (unchanged).

## Navigation graph

Enter from: app start · the Home tab · Results "Back home" · any return to Home (the saved run is read each time Home comes into focus)
Exit to: `quest/player` (Continue, Start again) · Route tab · the cards' targets (unchanged)

## States

- **success**: Panel A (resume variant) → Continue or Panel B.
- **no candidate** (none stored; another lesson's run; a run still on its first step; older than 24 hours; a story lesson, which resumes only through Keep reading): Panel C, and no lesson chunk is asked for.
- **candidate, steps not in yet**: Panel C while the hero lesson's chunk loads; Panel A once it is in and the step list is unchanged; Panel C if the list changed.
- **loading**: Panel C until the read and the steps are in; the caption and the link then appear under the button, so the button never moves.
- **error**: the saved run cannot be read, or the lesson chunk fails to load → Panel C; no crash screen, no reload, nothing written.
- **first day** (no quest done yet) with a saved run: Panel A; the button reads Continue, not Start.
- **wide (1180)**: the same order inside the hero card in the main column; the caption and the link sit under the button, left-aligned.

## Data needs

- `readSavedRun(profileId)` (reads `hr:quest-run:<id>` through the read contract; a failed read is "nothing to resume"); a pure candidate check from the saved value; `resumableRun(saved, quest, now)` once the steps are in.
- The hero lesson's steps: the lesson store (`isQuestReady`, `ensureCells` with its failure swallowed), only for a candidate.
- Strings: `learner.home.next.resume.line`, `.startAgain.cta`, `.sheet.title`, `.sheet.message`, `.sheet.keep.cta` (new); `learner.home.next.continue.cta` (reused).
- Writes: only Start again's removal of the saved run.

## Open questions

- None blocking (OD-LR5, OD-LR6 decided by the owner 2026-11-23).
- WO-38 row 2 moves the hero on Home; the resume parts move with it (they belong to the hero card).
