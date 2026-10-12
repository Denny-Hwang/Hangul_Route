# Home/Today's mission card 2 — next in your plan, the end of the free lessons once, then practice (wireframe v2)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.5 (`routeNext`), §3.7 (Home), §3.11 (glossary), §3.15 (no recurring ask) · extends `home/todays-mission.md` (three cards, F-HW-001 §3.1, day pin §3.2) · Home stack order stays F-ROUTE-001 §6.4
Audience: **learner (any age; P4/P5/P6)**. The ask button appears at most once per profile and device.
Code: `apps/mobile/src/logic/homework/mission-builder.ts` (`buildTodaysMission`), `apps/mobile/src/screens/home/HomeScreen.tsx`, `apps/mobile/src/logic/route-next.ts`

## Scenario (Given-When-Then)

Given: a learner opens Home
When: today's three cards are built
Then: card (2) is today's assignment if there is one, else the next step of the learner's own plan (or the default route); a free learner who has finished the free lessons (switch on) sees a celebration once, and from then on a plain practice card with no request to anyone

## Screen goal

"Card (2) is always one useful next step — never a daily request to get something bought."

## Box diagram — card (2) only (cards 1 and 3 unchanged)

```
A. next in your plan               B. free-end card (once)            C. practice card
+----------------------------+     +------------------------------+   +----------------------------+
| [quest art]                |     |       [hoya cheering]        |   | [topic art]                |
| Family at the Table        |     | "You finished your first     |   | Food words       (title)   |
| Next in your plan          |     |  lessons!"         (title)   |   | Keep practicing (subtitle) |
|                            |     | "You played every quest that |   |                            |
| [[ PLAY ]]                 |     |  is open for you."           |   | [[ PLAY ]]                 |
+----------------------------+     | [[ PRACTICE WORDS ]]         |   +----------------------------+
                                   | [ Play a favorite again ]    |
                                   |   {ask}  (ghost link)        |
                                   +------------------------------+
```

- A, subtitle rule: "Next in your plan" when `routeNext.source` is a plan source; today's "New" when it is the default route (`cursor`); today's "From class" / "From home" pills stay for a dated assignment.
- B shows only while `free-end-seen:<profileId>` is not set; showing B (here or on Results) sets it. **{ask}** = "Ask a grown-up" / "Ask your teacher or a grown-up" / "See how to open it" (`askFor`, spec §3.7).
- B primary: **Practice words** (first free word topic playable in this build); when none is playable and a sampler story is bundled, **Read a story**. For a placed-out learner the primary is also **Practice words**.
- C: the first of a free word topic not finished today, a sampler story, or the best kept replay. **No ask, no grown-up button, no line about what is not open.**
- B and C are shown in slot (2) only, so Home always has three cards.
- Never on Home: "trial", "ended", "locked", "left", a number of days, a countdown, a price, a product name.

## Interaction points

- A [[ PLAY ]] -> `quest/player`; fires `route.next_started { source, surface: 'home' }`.
- B [[ PRACTICE WORDS ]] -> topic player (F-VOC-003); [[ READ A STORY ]] -> story reader.
- B [ Play a favorite again ] -> `quest/player` for the best replay among kept quests (else `letters-q1`).
- B {ask} -> `access.help_asked { from: 'home', audience }` -> `PinEntry { next: 'Paywall', from: 'home' }` (self-only device with no PIN: the Plan screen directly).
- B shown -> `access.free_end_reached { freeDays, placedOut }` if Results has not sent it already.
- C [[ PLAY ]] -> topic player, story reader or `quest/player`.

## Navigation graph

Enter from: app start · Home tab · Results "Back home"
Exit to: `quest/player` · topic player · story reader · `profiles/pin-entry` -> `billing/plan-status-free-lessons` · other Home blocks (unchanged)

## States (card 2 order)

1. **Assignment for today** (F-HW-001 §3.4; equals `routeNext` step 1): unchanged card with its pill.
2. **A. routeNext quest**: as drawn. Plan item dated later this week -> still shown (nothing is late or early).
3. **B. free-end, first time**: as drawn.
4. **C. free-end, seen**: as drawn; every later day.
5. **Rest** (nothing open left, subscriber or switch off): today's replay fallback (`mission-builder.ts:120-121`).
- **Day pin**: card (2) stays the same for the day once shown (F-HW-001 §3.2); B appears the next time Home builds the day's cards, or right after the quest that ends the free lessons when Results did not show it.
- **Empty** (no profile): Home is not shown (onboarding).
- **Error** (snapshot unreadable): fail open — card A from the default route. Seen key unreadable: C (never B twice in a session).

## Accessibility

- Card label = title plus subtitle; B's label = title plus line. Buttons via `Button`; focus lands on the card title. Hoya pose static under reduced motion.

## Data needs

- `routeNext` (snapshot, plan sources, derived assignments, bundle, `cursorContext` with `isQuestOpen`); kept quests from the snapshot for the replay pick; free topics and sampler stories in this build; seen key through `platform/storage.ts`.
- No network call.

## Open questions

- OD-1 (what the free part is) changes only the trigger of B. OD-8: no "day" in any string.
