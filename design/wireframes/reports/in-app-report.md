# Reports/In-App-Report — a learner's report in the learner app, behind the grown-up gate (wireframe v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` §3.1, §3.5, §3.6, §3.9, §3.12, §3.13
Screen: learner-app stack screen `LearnerReport { profileId }` (`GrownUpDestination` gains `'LearnerReport'`)
Audience: **parent / grown-up on a shared device** (no account needed). A learner never reaches it: it sits behind the grown-up gate like `parent/dashboard`.

## Scenario (Given-When-Then)

Given: a parent who shares one tablet with their child and has no console account
When: they open the grown-up area, pass the gate and tap "See report" on the child's profile card
Then: they see the same report the console shows (at a glance, period tabs, went well, practice next), built from this device's data, plus what the quests practiced for reading, listening and writing

## Screen goal

"Tell the grown-up on this device how this learner is growing, for a chosen period."

## Box diagram (phone; regular and wide keep one centred column)

```
+------------------------------------+
| [<- back]        Name : report     |  -> parent/dashboard
|                                    |
|  AT A GLANCE                       |
|   Now on: Stage N - title          |
|   Started at: level (if any)       |
|   Letters known well: [chips] more |
|   Letters being practiced: [chips] |
|   Quests N - Cards N - Last: date  |
|                                    |
|  [Today][[Week]][Month][All time]  |  <- SectionTabs
|                                    |
|  HEADLINE (one sentence)           |
|  [days 3] [min 36] [quests 2]      |  <- figure tiles; "more than last
|  [cards 1] [letters 2]             |     week" only when grown
|                                    |
|  M  T  W  T  F  S  S               |
|  (v)( )(v)(v)( )( )( )             |  <- filled+check / outline; text list
|                                    |
|  WHAT WENT WELL                    |
|   o line  o line  o line           |
|                                    |
|  WHAT TO PRACTICE NEXT             |
|   o line  o line  o line           |  <- no plan actions on the device
|                                    |
|  WHAT THE QUESTS PRACTICED         |  <- device only (OD-8)
|   Reading    [marks]               |
|   Listening  [marks]               |
|   Writing    [marks]               |
|   Spelling with tiles: N quests    |
|   (one skills note sentence)       |
|                                    |
|  LEVEL CHECK  strand words         |
|  PLAN  N done - N ready to play    |  <- all plans on this device + own plan
+------------------------------------+
```

- **All time** swaps the calendar for the cumulative growth line (only rises) with a text list.
- No print button in the app (print lives on the console, OD-7).
- Never: other profiles' figures next to this one, percentages, red, "missed", speaking.

## Interaction points

- [<- back] -> `parent/dashboard` (top-left, same place as every screen).
- Period tab -> re-computes locally; sends `report.viewed { scope: 'learner', space: 'device', period }` without `profileId`.
- Letter chip -> expanded line with romanization and gloss.
- Gate session lapses (15 min) while open -> next navigation goes through `profiles/pin-entry` as everywhere in the grown-up area.

## Navigation graph

Enter from: `parent/dashboard` (profile card "See report"; via `profiles/pin-entry` when the session lapsed)
Exit to: `parent/dashboard` · `profiles/pin-entry` (session lapsed)

## States

- **loading**: brief skeleton while the local summary is computed (local only, no network).
- **success**: as above.
- **empty** (profile never practiced): "Name has not practiced yet. Reports appear after the first quest." + next on the route.
- **no practice in the period**: headline "No practice yet this week." + rhythm line first; calendar all outlines.
- **error** (local data cannot be read): "Can't show the report right now." + [ TRY AGAIN ]; never a crash screen.
- **offline**: identical to success (works fully offline).
- **flag off**: no "See report" button on the dashboard; the screen is not registered.

## Data needs

- reads: local progress snapshot of `profileId` (`store/progress-store.ts`), `buildActivity` + `summarize` (local), catalogue, `logic/my-route/skills.ts` for the skills rows.
- writes: none (read-only; never writes progress, never switches the active profile). Telemetry: `report.viewed` as above.

## Open questions

- None blocking. Where the grown-up area itself lives once the persona app shell ships is owned by that sibling; this screen keeps its route.
