# Home/Today's mission card 2 — next in your plan, and the end of the free days (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.5 (`routeNext`), §3.7 (Home), §3.11 (copy) · extends `home/todays-mission.md` (three cards, F-HW-001 §3.1, day pin §3.2) · Home stack order stays F-ROUTE-001 §6.4
Audience: **learner (any age; P4/P5/P6)**. **Ask a grown-up** opens the PIN gate first.
Code: `apps/mobile/src/logic/homework/mission-builder.ts` (`buildTodaysMission`), `apps/mobile/src/screens/home/HomeScreen.tsx`, `apps/mobile/src/logic/route-next.ts`

## Scenario (Given-When-Then)

Given: a learner opens Home
When: today's three cards are built
Then: card (2) is today's assignment if there is one, else the next step of the learner's own plan (or the default route); a free learner who has finished Day 1 and Day 2 (switch on) instead sees a celebration card with one replay button and a quiet grown-up button

## Screen goal

"Card (2) is always the one next step — or, at the end of the free days, a celebration with a replay."

## Box diagram — card (2) only (cards 1 and 3 unchanged)

```
A. next in your plan                      B. free-end card
+----------------------------------+      +----------------------------------+
| [quest art]                      |      |        [hoya cheering]           |
| Family at the Table  (title)     |      | "You finished your first         |
| Next in your plan    (subtitle)  |      |  two days!"        (title)       |
|                                  |      | "More lessons open with the      |
| [[ PLAY ]]                       |      |  full route."      (one line)    |
+----------------------------------+      | [[ PLAY A FAVOURITE AGAIN ]]     |
                                          | [ Ask a grown-up ]               |
                                          +----------------------------------+
```

- A, subtitle rule: "Next in your plan" when the next step comes from a class, family or own plan; today's "New" when it comes from the default route; today's "From class" / "From home" pills stay for a dated assignment.
- B is shown in slot (2) only, so Home always has three cards.
- Never on Home: "trial", "ended", "locked", "left", a number of days, a countdown, a price.

## Interaction points

- A [[ PLAY ]] -> `quest/player`; fires `route.next_started { source, surface: 'home' }`.
- B [[ PLAY A FAVOURITE AGAIN ]] -> `quest/player` for the best replay among kept quests (else `letters-q1`).
- B [ Ask a grown-up ] -> `access.grownup_asked { from: 'home' }` -> `PinEntry { next: 'Paywall', from: 'home' }` (self-only device with no PIN: the paywall directly).

## Navigation graph

Enter from: app start · Home tab · Results "Back home"
Exit to: `quest/player` · `profiles/pin-entry` -> `paywall/free-plan-days` · other Home blocks (unchanged)

## States (card 2 order)

1. **Assignment for today** (F-HW-001 §3.4): unchanged card with its pill.
2. **A. routeNext quest**: as drawn. Plan item dated later this week -> still shown (nothing is late or early).
3. **B. free-end**: as drawn.
4. **Rest** (nothing open left, subscriber or switch off): today's replay fallback (`mission-builder.ts:120-121`).
- **Day pin**: card (2) stays the same for the day once shown (F-HW-001 §3.2); B appears the next time Home builds the day's cards or right after the quest that ends Day 2 (the pin is re-taken when the pinned quest is done).
- **Empty** (no profile): Home is not shown (onboarding).
- **Error** (snapshot unreadable): fail open — card A from the default route.

## Accessibility

- Card label = title plus subtitle; B's label = title plus line. Buttons via `Button`; focus lands on the card title. Hoya pose static under reduced motion.

## Data needs

- `routeNext` (snapshot, derived assignments, bundle, `cursorContext` with `isQuestOpen`); kept quests from the snapshot for B's replay pick.
- No network call.

## Open questions

- OD-1 (what a day is) changes only the trigger of B. OD-8: the title says "your first two days", never "Day 2".
