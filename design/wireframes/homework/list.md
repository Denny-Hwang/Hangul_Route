# Homework/List — the assignment queue behind Today's mission (wireframe v1)

Spec: `docs/specs/F-HW-001-homework-page.md` §3.2 (completion), §3.3 (anti-shame), §3.4 (merge rules, 1 explicit / day) · `docs/blueprints/10-app-map.md` §3.1, §7
Code (F-PLAN-001, 2026-09-21): plan-derived assignments (`<planId>#<questId>`, pill "From class" / "From home") flow into this list after each inbox refresh; finishing the quest marks them done; items a learner has not unlocked never appear here (counted as not ready for the author).
Audience: **learner (P4/P5 child, 5–11)** — the child reads it; the assignments come from a parent / teacher / the system
Code (back-filled): `apps/mobile/src/screens/homework/HomeworkScreen.tsx` — route `Homework`

## Scenario (Given-When-Then)

Given: a learner is on `home/todays-mission` and a grown-up has assigned more than the one slot Today can show (F-HW-001 §3.4 caps explicit assignments at 1 per day; the rest wait in a queue)
When: they tap the Homework row on Home
Then: they see the full queue — what is for today, what waits for later, what was already done — with nothing red, counted-down or labelled "missed"

## Screen goal

"Show the whole assignment queue in three calm groups and let the child start any 'today' item."

Relation to `home/todays-mission`: Home is the *3-card* surface and stays the default door. This list only earns a visit when the queue is longer than the one explicit slot Home can hold (app-map §7 — measure entry rate in beta).

## Box diagram

```
+----------------------------------+
| [<- back]      Homework          |  <- back top-left, consistent
|  1 muted line: who sets these    |
|                                  |
| ( Hoya bubble: count for today,  |  <- "N things today" / "nothing today"
|   or a friendly all-clear )      |
|                                  |
|  Today                           |
|  +----------------------------+  |
|  | quest title      [by: parent] |  <- row = tap target -> quest/player
|  | episode name . short due   |  |     pill = assignedBy (parent/teacher/Hoya)
|  +----------------------------+  |
|  +----------------------------+  |
|  | quest title      [by: teacher]|
|  +----------------------------+  |
|                                  |
|  Coming up                       |  <- queue for later days (targetDate > today)
|  . quest title . day label       |     plain rows, not tappable
|                                  |
|  Recently done                   |
|  +----------------------------+  |
|  | quest title  (collected look) |  <- success tone, still tappable (replay)
|  +----------------------------+  |
+----------------------------------+
```

- "Today" rows are the only primary targets; the count in the Hoya bubble is the
  *only* number on screen. No badges on rows, no "N left".
- An item the child skipped yesterday simply appears in Today again with the
  same look (§3.3). Nothing here may render `missed`, `incomplete`, `failed`,
  `overdue` (`logic/homework/banned-text`).

## Interaction points

- Today row tap → `quest/player` (questId, episodeId of the assignment)
- Recently-done row tap → `quest/player` (replay; never subtracts anything, §3.2)
- All-clear card tap (empty state) → `reviews/daily-test` (**future, D**) — until then the card is informational only
- [<- back] → `home/todays-mission`

## Navigation graph

Enter from: `home/todays-mission` (Homework row)
Exit to:    `quest/player` · `home/todays-mission` (back) · `reviews/daily-test` (future)

## States

- **success**: at least one Today row; Coming up / Recently done may be empty and then collapse to one muted line each.
- **empty** (no assignments at all): Hoya all-clear card with one suggestion ("quick review" once F-RVW-001 exists, else "try your next quest" → `home/todays-mission`); sections Coming up / Recently done are omitted, not shown blank.
- **error** (progress snapshot unreadable): keep header + back, replace lists with one "can't load homework yet" line + [ TRY AGAIN ]; never render an empty queue as if it were real.

## Data needs

- reads: active profile (F-PROF-001) · `ProgressSnapshot.homework[]` (`HomeworkAssignment`: `targetDate`, `assignedBy`, `completedAt`, `dueAt`) · quest + episode titles from content
- grouping computed by pure logic (`logic/homework/*`): Today = `targetDate == today && !completedAt`; Coming up = `targetDate > today`; Done = `completedAt` set
- writes: none — completion is written by the quest flow
- telemetry: `homework.list_viewed` (beta entry-rate metric, app-map §7)

## Open questions

- **Discrepancy**: shipped rows are not tappable and show every uncompleted assignment under "Today" regardless of `targetDate`; `dueAt` is rendered raw. The wireframe assumes the §3.4 grouping.
- The shipped subtitle and Hoya copy mention a *streak* ("or Hoya if you have a streak"). Streak framing is close to the F-RVW-001 §4 anti-pattern; replace with neutral "Hoya sometimes adds a review" copy?
- Does the child need "Coming up" at all, or is that a caregiver-only view (`console/plan-builder`)? Default: show it, since it explains why a parent-assigned item is not on Home today.
