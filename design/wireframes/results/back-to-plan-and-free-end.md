# Results/Next teaser — next in your plan, back to your plan, and the end of Day 2 (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.5 (`routeNext`), §3.8 (Results), §3.12 (telemetry) · extends `results/next-quest-teaser.md` and `results/celebrate.md`
Audience: **learner (any age; P4/P5/P6)**. **Ask a grown-up** opens the PIN gate first.
Code: `apps/mobile/src/logic/quest-flow/results-teaser.ts`, `apps/mobile/src/screens/results/ResultsScreen.tsx`

## Scenario (Given-When-Then)

Given: the learner finished a quest and the celebration is shown
When: the teaser card below it renders
Then: it names the next step of the learner's plan (or the default route); after a quest outside the plan it says "Back to your plan"; after the last free quest (switch on, free) it celebrates the two finished days instead

## Screen goal

"After every quest, one obvious next step — and a celebration, not a wall, at the end of the free days."

## Box diagram (the part under the celebration)

```
A. next in plan / back to plan            B. end of Day 2
+----------------------------------+      +----------------------------------+
| Next in your plan   (caption)    |      |        [hoya cheering]           |
|   or: Back to your plan          |      | "You finished your first         |
| Family at the Table  (title)     |      |  two days!"                      |
| New letters: [ko] [ko]           |      | [card][card][card][card][card]   |
+----------------------------------+      | [card]   (earned cards row)      |
[[ PLAY NEXT QUEST ]]                     +----------------------------------+
[ Back home ]                             [[ BACK HOME ]]
[ Episode page ]                          [ Ask a grown-up ]
```

- A caption: "Next in your plan" (plan source), "Back to your plan" (the quest just played was off-plan while a plan exists), else today's "Next up".
- B replaces the teaser card and the button set; the row holds the cards earned in Day 1 and Day 2 (up to six), wraps, or shows the earned-cards count when it does not fit at 320 dp; no row when none was earned.
- Never: "you skipped", "wrong lesson", "not in your plan", "trial", a price, a countdown.

## Interaction points

- A [[ PLAY NEXT QUEST ]] -> `quest/player` (routeNext); fires `quest.teaser_tapped` (unchanged) and `route.next_started { surface: 'results' }`.
- A [ Back home ] -> Main tabs; [ Episode page ] -> `episode/detail`.
- B [[ BACK HOME ]] -> Main tabs (Home shows `home/next-and-free-end-card` state B).
- B [ Ask a grown-up ] -> `access.grownup_asked { from: 'results' }` -> `PinEntry { next: 'Paywall', from: 'results' }`.
- B shown the first time on this device for this profile -> `access.free_end_reached { freeDays: 2 }` (key `free-end-seen:<profileId>`, write in try/catch).
- Completing an off-plan quest with a plan -> `route.offplan_finished { source, stage }`.

## Navigation graph

Enter from: `quest/player` (quest finished)
Exit to: `quest/player` · Main tabs (Home) · `episode/detail` · `profiles/pin-entry` -> `paywall/free-plan-days`

## States

- **A, plan**: caption "Next in your plan".
- **A, off-plan**: caption "Back to your plan".
- **A, no plan**: caption "Next up" (today).
- **B, end of Day 2**: as drawn.
- **Skipped every game** (`total === 0`): unchanged ("Try this one again").
- **Rest** (nothing open left, not free-end): no card; the existing two buttons.
- **Error** (storage write for the seen key fails): B still shows; the event may send again later (acceptable).

## Accessibility

- The teaser card is plain content; caption and title are read in order. B's cards row is one image group labelled with the count of cards. Buttons via `Button`; focus on the celebration first (unchanged), then the card.

## Data needs

- `routeNext({ ..., justCompleted })`, `planQuestIds` (was the played quest in the plan before it was completed), kept cards from the snapshot; seen key through `platform/storage.ts`.

## Open questions

- None beyond OD-1 / OD-8 (defaults apply).
