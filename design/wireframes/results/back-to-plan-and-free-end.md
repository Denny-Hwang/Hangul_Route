# Results/Next teaser — next in your plan, back to your plan, and the end of the free lessons (wireframe v2)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.5 (`routeNext`), §3.8 (Results), §3.12 (telemetry) · extends `results/next-quest-teaser.md` and `results/celebrate.md`
Audience: **learner (any age; P4/P5/P6)**. The ask button appears here at most once per profile and device (shared with Home).
Code: `apps/mobile/src/logic/quest-flow/results-teaser.ts`, `apps/mobile/src/screens/results/ResultsScreen.tsx`

## Scenario (Given-When-Then)

Given: the learner finished a quest and the celebration is shown
When: the teaser card below it renders
Then: it names the next step of the learner's plan (or the default route); after a quest outside the plan it says "Back to your plan"; after the last free lesson (switch on, free) it celebrates once and offers word practice; later, it says calmly that every open quest is played

## Screen goal

"After every quest, one obvious next step — and a celebration, not a wall, at the end of the free lessons."

## Box diagram (the part under the celebration)

```
A. next in plan / back to plan     B. end of the free lessons (once)   C. after B was seen
+----------------------------+     +------------------------------+    "You played every quest
| Next in your plan          |     |       [hoya cheering]        |     that is open for you."
|   or: Back to your plan    |     | "You finished your first     |    [[ PRACTICE WORDS ]]
| Family at the Table        |     |  lessons!"                   |    [ Back home ]
| New letters: [ko] [ko]     |     | [card][card][card][card]     |    [ Episode page ]
+----------------------------+     | [card][card] (earned row)    |
[[ PLAY NEXT QUEST ]]              +------------------------------+
[ Back home ]                      [[ BACK HOME ]]
[ Episode page ]                   [ Practice words ]
                                     {ask}  (ghost link)
```

- A caption: "Next in your plan" (plan source), "Back to your plan" (the quest just played was off-plan while a leading source exists), else today's "Next up".
- B replaces the teaser card and the button set; the row holds the cards earned in the free lessons (all of Stage 1: up to six tiles), and shows the earned-cards count when more were earned or the row does not fit at 320 dp; no row when none was earned. **{ask}** = `askFor` label (spec §3.7).
- C is shown at `free-end` once the seen key is set (for example after a replay): one line, Practice words added, **no ask**.
- Never: "you skipped", "wrong lesson", "not in your plan", "trial", a price, a product name, a countdown, a number of days.

## Interaction points

- A [[ PLAY NEXT QUEST ]] -> `quest/player` (`routeNext`); fires `quest.teaser_tapped` (unchanged) and `route.next_started { surface: 'results' }`.
- A [ Back home ] -> Main tabs; [ Episode page ] -> `episode/detail`.
- B [[ BACK HOME ]] -> Main tabs (Home shows `home/next-and-free-end-card` state C).
- B / C [ Practice words ] -> topic player (first free topic playable in this build).
- B {ask} -> `access.help_asked { from: 'results', audience }` -> `PinEntry { next: 'Paywall', from: 'results' }` (self-only device with no PIN: the Plan screen directly).
- B shown -> sets `free-end-seen:<profileId>` (write in try/catch) and sends `access.free_end_reached { freeDays, placedOut }` (`freeDays` = `freeLessonsFacts().days`: the route days of Stage 1, 5 today; F-ENT-003 OD-1).
- Completing an off-plan quest with a leading source -> `route.offplan_finished { source, stage }`.

## Navigation graph

Enter from: `quest/player` (quest finished)
Exit to: `quest/player` · Main tabs (Home) · `episode/detail` · topic player · `profiles/pin-entry` -> `billing/plan-status-free-lessons`

## States

- **A, plan**: caption "Next in your plan".
- **A, off-plan**: caption "Back to your plan".
- **A, no plan**: caption "Next up" (today).
- **B, end of the free lessons, first time**: as drawn.
- **C, free-end, seen**: as drawn.
- **Skipped every game** (`total === 0`): unchanged ("Try this one again").
- **Rest** (nothing open left, not free-end): no card; the existing two buttons.
- **Error** (storage write for the seen key fails): B still shows; it may show once more in a later session (acceptable); never twice in one session.

## Accessibility

- The teaser card is plain content; caption and title are read in order. B's cards row is one image group labelled with the count of cards. Buttons via `Button`; focus on the celebration first (unchanged), then the card.

## Data needs

- `routeNext({ ..., justCompleted })`, `planView` (was the played quest in the plan before it was completed), kept cards from the snapshot; seen key through `platform/storage.ts`; free topics in this build.

## Open questions

- None beyond OD-1 / OD-8 (defaults apply).
