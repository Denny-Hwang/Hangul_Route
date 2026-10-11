# Placement: Result: where the route starts (`placement/result`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.6, 3.7, AM-1, AM-2, AM-12, AM-14, W-7)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet). A link leads grown-ups to the report through the PIN gate.
Code (planned): `screens/placement/ResultScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section G (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: a run has finished (or ended early)
When: Hoya shows the starting spot on a mini map
Then: the learner starts playing there, the route skips what they know without marking it done, and no number or score is shown

## Screen goal

"Show the starting spot and start the first quest there."

## Box diagram

```
┌──────────────────────────────────┐
│        [Hoya cheering]            │
│ "Hoya found your starting spot!"  │
│  mini map  (7 rows x 5 columns)   │
│    pin on the start cell,         │
│    light outline on cells you     │  <- placed-out cells are NOT completed cells
│    can skip ahead of              │
│ ┌ Start here ─ title of quest ───┐│
│ ├ Next ─ one or two quests ──────┤│
│ └ Later ─ title of the next stage┘│
│ [[ START ]]                       │  -> quest player on the start quest (Main underneath)
│ [ See the whole map ]             │  -> journey/grid
│  for grown-ups  (link)            │  -> PIN gate -> parent/placement-report
└──────────────────────────────────┘
```

- Words about level are the stage title and a band label ("Letters and sounds", "Reading words"). No number, ratio, percent or comparison anywhere.
- G2, no quest left for this tier: "You know a lot! More adventures are coming." with `[[ OPEN STORIES ]]` (Library) when a reviewed story exists, else `[[ SEE THE WHOLE MAP ]]`. No purchase button for the learner.
- G3, retake that does not change the route: "Your route stays right where it is." and the same buttons.
- A result with parts not tested (no sound, sound guide set to always, ended early) says so in one calm line for grown-ups only (J), never on this screen.
- **Amended (F-PLC-001 AM-1, AM-2, AM-12, AM-14; F-ROUTE-001 R-0):** the button row above is replaced by `journey/my-route-overview.md` J1 (self profile: weekly plan strip with **Use this plan** as the only primary, **Change**, **Just start**, links **See my route** and **For grown-ups**) and J2 (child profile: **Start**, **See my route**, **For grown-ups: set up a weekly plan**); a not-tested run uses J3's headline. **See the whole map** remains only while `flags.myRouteEnabled` is off. G3's learner line becomes "Your plan stays right where it is." when a plan exists; a retake that raises the start shows K3 there. Promoted here (F-PLC-001 P-0).
- **After a Short run (W-7):** no text to read for a child. "Hoya found your starting spot!", or "Here is a good place to start" when reading was not tested. A self profile also gets the quiet link "Try the standard check" when the Short hint fires. Never "for younger learners".

## Interaction points

- START (or the J1 / J2 primary when the route flag is on): resets the stack to Main plus the quest player on the start quest.
- See the whole map: `journey/grid` (only while `flags.myRouteEnabled` is off; otherwise See my route).
- For grown-ups: PIN gate -> `parent/placement-report`.
- Short with the hint (self profile): the quiet link "Try the standard check".

## Navigation graph

Enter from: `placement/item`, `placement/item-short`, `placement/pause`
Exit to: `quest/player`, `journey/grid` or `journey/my-route-overview`, `library/gallery` (stories), `parent/placement-report` (via PIN), `route/proposal` (Change, J1)

## States

- **success**: as drawn, or the J1 / J2 layout of `journey/my-route-overview.md` when `flags.routeEnabled` is on.
- **G2 nothing left for this tier**: "You know a lot!" with Open stories or See the whole map.
- **G3 retake that changes nothing**: "Your route stays right where it is." ("Your plan stays..." when a plan exists).
- **reading not tested**: "Here is a good place to start" (J3); the not-tested detail is for grown-ups only (report).
- **offline**: identical; the result syncs later.

## Data needs

- reads: the finished result (`finishRun`), the route seed, the catalogue (quest and stage titles), tier, flags
- writes: the result in the snapshot (`placements`), telemetry

## Open questions

- None open for this screen.
