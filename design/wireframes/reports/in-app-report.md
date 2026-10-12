# Reports/In-App-Report — a learner's report in the learner app, behind the grown-up gate (wireframe v2)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` §3.1, §3.5, §3.6, §3.9, §3.12, §3.13
Screen: learner-app stack screen `LearnerReport { profileId }` (`GrownUpDestination` gains `'LearnerReport'`)
Audience: **parent / grown-up on a shared device** (no account needed), and the **adult learner on a self-only device** (second person). A child on a shared device never reaches it: it sits behind the grown-up gate like `parent/dashboard`.

## Scenario (Given-When-Then)

Given: a parent who shares one tablet with their child and has no console account
When: they open the grown-up area, pass the gate and tap "See report" on the child's profile card
Then: without scrolling they read the headline, what went well and what to practice next for the chosen period, built from this device's data; figures follow; More detail holds letters, level check, plan and what the quests practiced for reading, listening and writing

## Screen goal

"Tell the grown-up on this device, at a glance, how this learner is growing in a chosen period."

## Box diagram (phone; regular and wide keep one centred column)

```
+------------------------------------+
| [<- back]        Name : report     |  -> parent/dashboard
|                                    |     self-only device: "Your report"
|  Now on Stage N: title             |
|   - Open Learning Route            |  <- adult read-only route view, when present
|  Last practice: date               |
|                                    |
|  [Today][[Week]][Month][All time]  |  <- SectionTabs
|  [< Last week]                     |  <- stepper (35 days / 24 months)
|                                    |
|  HEADLINE (one sentence)           |  <- third person; second on self-only
|                                    |
|  WHAT WENT WELL                    |  <- LAYER 1 (hidden when empty)
|   o line  o line  o line           |
|                                    |
|  WHAT TO PRACTICE NEXT             |
|   o line  o line  o line           |  <- no plan actions, no notes, no
|                                    |     Browse links on the device
|- - - - - - - - - - - - - - - - - - |
|  THIS PERIOD                       |  <- LAYER 2
|  [days 3] [min 36] [quests 2]      |  <- figure tiles; "more than last
|  [cards 1] [letters 2]             |     week" only when grown
|  M  T  W  T  F  S  S               |
|  (v)( )(v)(v)( )( )( )             |  <- filled+check / outline; text list
|                                    |
|  [ More detail  v ]                |  <- LAYER 3, collapsed
|   Letters known well / practiced / |
|   new this period [chips]          |
|   Since the start: N quests, cards |
|   Starting spot - Milestones       |
|   Level check: strand words        |
|   Plan: N done - N ready to play   |  <- all plans on this device + own plan
|   What the quests practiced        |  <- device only (OD-8)
|    Reading    [marks]              |
|    Listening  [marks]              |
|    Writing    [marks]              |
|    Spelling with tiles: N quests   |
|    (one skills note sentence)      |
+------------------------------------+
```

- **All time** swaps the calendar for the cumulative growth line (only rises) with a text list.
- On this device every day up to today is saved, so there are no "not saved yet" cells.
- No print button in the app (print lives on the console, OD-7). Words stay hidden until F-VOC-005 P-4b, as on the console.
- Never: other profiles' figures next to this one, percentages, red, "missed", a price, speaking.

## Interaction points

- [<- back] -> `parent/dashboard` (top-left, same place as every screen).
- Period tab or stepper -> re-computes locally; sends `report.viewed { scope: 'learner', space: 'device', period }` without `profileId`.
- Open Learning Route -> the adult read-only Learning Route view (Learning Route amendment), when it exists on the build.
- Letter chip -> expanded line with romanization and gloss.
- [ More detail ] -> expands layer 3.
- Gate session lapses (15 min) while open -> next navigation goes through `profiles/pin-entry` as everywhere in the grown-up area.

## Navigation graph

Enter from: `parent/dashboard` (profile card "See report"; via `profiles/pin-entry` when the session lapsed)
Exit to: `parent/dashboard` · `parent/learning-route` · `profiles/pin-entry` (session lapsed)

## States

- **loading**: brief skeleton while the local summary is computed (local only, no network).
- **success**: as above.
- **empty** (profile never practiced): "Name has not started yet. The report fills in after the first practice." + the app's next line when it has one. Self-only: "You have not started yet. ..."
- **no practice in the period**: headline "No practice yet this week."; "What went well" not rendered; rhythm line first; calendar all outlines.
- **error** (local data cannot be read): "Can't show the report right now." + [ TRY AGAIN ]; never a crash screen.
- **offline**: identical to success (works fully offline).
- **flag off**: no "See report" button on the dashboard; the screen is not registered.

## Data needs

- reads: local progress snapshot of `profileId` (`store/progress-store.ts`), `buildActivity` + `summarize` (local), catalogue, `logic/my-route/skills.ts` for the skills rows; `gateOpensDirectly` decides the voice.
- writes: none (read-only; never writes progress, never switches the active profile). Telemetry: `report.viewed` as above.

## Open questions

- None blocking. Voice on self-only devices: second person by default (OD-17). Where the grown-up area itself lives once the persona app shell ships is owned by F-APP-001; this screen keeps its route.
