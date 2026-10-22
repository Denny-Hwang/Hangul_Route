# Home/Next-lesson-hero — the next lesson first, with one big Start, above the unchanged three cards of the day (wireframe v1)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 9.1 (row DN-8) · amends the Home layout of `home/todays-mission.md` (slots unchanged) and folds the Home route strip of `journey/learning-route.md` (R-4b) into the hero
Audience: **learner, any age** (and a grown-up handing the device to them)
Route: learner app Home tab
Mock: `design/screens/learner-shell/home-hero.md`
Amended by: `home/goal-ring-weekly-dots.md` (F-CURR-002 §7.4: a week strip above the hero; the "Streak N days" pill moves into the strip as its streak line, and a "N words known" pill takes its place, `journey/mastery-ring.md` G)

## Scenario (Given-When-Then)

Given: a learner opens the app
When: Home shows
Then: the first thing is their next lesson with one big Start; today's three cards stay below as they are; the whole route is one tap away

## Screen goal

"Start the next lesson." (secondary: today's three cards)

## Box diagram

Panel A — 360 x 740, a learner on Stage 1 with a goal from the family plan

```
+--------------------------------+
| (Hoya) Hi, Mina!  ( Aa )(Profile)|  <- root: no Back
| Ready for today's quest?       |
| (Streak 2 days)(3 cards)(1★)   |  <- unchanged pills
|+------------------------------+|
|| NEXT LESSON          (eyebrow)||  <- hero card
|| Meet o, u, m and the circle  ||  <- lesson title (localized)
|| Stage 1 · Meet the Letters · ||  <- where: stage · episode · lesson i of n
||  lesson 2 of 3               ||
|| Goal: Stage 1 · Hangul       ||  <- the strip's goal line (when a goal source exists)
||                              ||
|| [[         START          ]] ||  <- one big Start (touchTarget.hero)
|| See your Learning Route  >   ||  <- quiet link to the Route tab
|+------------------------------+|
| Today with Hoya           (h2) |
| [ card 1: story / replay     ] |  <- F-HW-001 slots: unchanged chains,
|  Meet o, u, m and the circle   |     order and completion; card 2 is
|  Same as your next lesson above|     COMPACT (not a button) when it
|                                |     names the hero's lesson
| [ card 3: story / test       ] |
| [ Already know some Korean? ]  |  <- unchanged (placement card), then Homework, Tip
+--------------------------------+
```

Panel B — the route has nothing open left (`routeNext` gives `rest`)

```
|+------------------------------+|
|| NEXT LESSON                  ||
|| You did everything that is   ||  <- the route's existing rest line
||  open right now. More is     ||
||  coming.                     ||
|| [ Open stories ]             ||  <- the existing rest action (Library stories)
|| See your Learning Route  >   ||
|+------------------------------+|
```

Panel C — wide (1180): the hero spans the main column above the cards; the right column unchanged

```
+------------------------------------------------------------------------------+
| (Hoya) Hi, Mina!                                          ( Aa ) (Profile)   |
| +----------------------------------------------+  +------------------------+ |
| | NEXT LESSON                                  |  | (right column as today)| |
| | Meet o, u, m and the circle                  |  |                        | |
| | Stage 1 · Meet the Letters · lesson 2 of 3   |  |                        | |
| | [[ START ]]          See your Learning Route>|  |                        | |
| +----------------------------------------------+  |                        | |
| Today with Hoya: [card 1] [card 2] [card 3]       |                        | |
+------------------------------------------------------------------------------+
```

## Interaction points

- [[ START ]] → the hero lesson's quest player (the same target as card ② when they match; finishing collects card ② as F-HW-001 §3.2 says).
- Card ② when it names the hero's lesson: compact, not a button ("Same as your next lesson above", `learner.home.mission.sameAsHero`), so the same lesson has one Start on Home; it still shows done. When it names another quest it is the normal card with its own Start.
- See your Learning Route → the Route tab.
- Rest state button → its existing target.
- ( Aa ) → `shell/display-sheet.md`; (Profile) → `profile/profile-split.md` A.

## Navigation graph

Enter from: app start · the Home tab · Results "Back home"
Exit to: quest player · Route tab · Profile · the three cards' targets (unchanged)

## States

- **success**: Panel A (and C wide).
- **rest / free-end**: Panel B with the state's existing line and action.
- **first day** (nothing done): the hero is the first lesson of the route; the cards are F-HW-001's first-day cards.
- **route cannot be read** (`routeNext` throws, fail open): no hero; Home is as today without the strip.
- **loading**: the hero's frame with no text until the snapshot is hydrated (one frame; no spinner).

## Data needs

- `useActiveRouteNext()` (`routeNext`, `planView`), the route catalogue for "lesson i of n", the goal source for the goal line; nothing new stored. No telemetry beyond the quest's own.

## Open questions

- None blocking. The hero and card ② usually name the same lesson; card ② then draws compact with no second Start (AMENDMENTS-DISPLAY-NAV section 9.1, review 2026-10-17), and the day's plan keeps its shape.
