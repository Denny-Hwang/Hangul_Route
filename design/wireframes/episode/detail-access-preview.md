# Episode/Detail — plan tags and the preview of a lesson that is not open yet (wireframe v2)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.3 (`questAccess`), §3.6 (guard at the point of play), §3.7 (episode page, ask button by audience), §3.11 (glossary), §3.15 (child safety) · extends `episode/detail.md`
Audience: **learner (any age; P4/P5/P6)**. The only grown-up control is the ask button, which opens the gate first (or the Plan screen directly on a self-only device with no PIN).
Code: `apps/mobile/src/screens/episode/EpisodeDetailView.tsx`, `apps/mobile/src/logic/content-access.ts`, `apps/mobile/src/logic/route-next.ts`, `apps/mobile/src/logic/access-copy.ts` (`askFor`)

## Scenario (Given-When-Then)

Given: a learner opens a lesson page from the Journey, Home, Results, the Library or the Learning Route (or is sent here by the quest player guard)
When: the page renders
Then: a subscriber sees which quest is next and which are in their plan, with every Start button working; a free learner on a lesson that is not open yet (switch on) sees everything the lesson holds, keeps Play again on quests already finished, and finds one calm way to ask for help or go back to open lessons

## Screen goal

"Show the whole lesson; start the next quest, or (preview) show what it holds and hand the decision to the right person."

## Box diagram — A. subscriber (or switch off) with a plan

```
+--------------------------------------------+
| [<- back]                                  |
| [ Stage 1 ] [ Life ]                       |  <- pills (unchanged)
| ===                                        |  <- stage accent bar
| Around the Korean Table (title)            |
| subtitle                                   |
| ( Hoya intro bubble )                      |
|                                            |
| Quests                                     |
| +----------------------------------------+ |
| | (1) Hello Kimchi & Rice    stars ***   | |
| |     blurb                              | |
| |     [ Play again ]                     | |
| +----------------------------------------+ |
| | (2) Family at the Table  [pin] Next    | |  <- tag: drawn pin + word
| |     blurb            (====) In your plan| |  <- tag: solid ring + word
| |     [[ START ]]                        | |  <- the primary of the page
| +----------------------------------------+ |
| | (3) Picnic Snacks                      | |  <- off-plan: no tag at all
| |     [ Start ]                          | |
| +----------------------------------------+ |
| Cards you can earn  [card] [card] [card]   |  <- unchanged
+--------------------------------------------+
```

## Box diagram — B. preview (free, switch on, lesson not open yet)

```
+--------------------------------------------+
| [<- back]                                  |
| [ Stage 2 ] [ Life ]                       |  <- a cell past Stage 1 (all of Stage 1 is free, OD-1)
| Lunch Box Words (title)                    |
| ( Hoya intro bubble )                      |
|                                            |
| Quests                                     |
| +----------------------------------------+ |
| | (1) Lunch Box Words                    | |
| |     blurb                              | |
| |     [ko chip] [ko chip]                | |  <- what it teaches, KoreanText with romanization (when it teaches any)
| |     Not open yet                       | |  <- caption replaces Start
| +----------------------------------------+ |
| | (2) a kept quest           stars **    | |  <- finished before: stays open
| |     [ Play again ]                     | |
| +----------------------------------------+ |
| Cards you can earn  [card] [card]          |  <- shown, never greyed out
|                                            |
| +----------------------------------------+ |
| |   [hoya reading]                       | |
| |   "This lesson is not open yet. You    | |
| |    can still see what it teaches."     | |
| |   [ {ask} ]                            | |  <- secondary, label by audience
| |   Back to open lessons                 | |  <- ghost link
| +----------------------------------------+ |
+--------------------------------------------+
```

**{ask}** (`askFor`, spec §3.7):

| Device and learner | Label | Goes to |
|---|---|---|
| family device | Ask a grown-up | `PinEntry { next: 'Paywall', from: 'episode' }` -> Plan screen |
| family device, learner only in a class or school | Ask your teacher or a grown-up | same; the Plan screen adds the class line |
| self-only device | See how to open it | Plan screen (directly when `gateOpensDirectly`, else the settings PIN) |

- The preview page has **no primary button**: nothing on it pushes the learner toward buying.
- Never on this page: a price, a product name, "Premium", "buy", "trial", "locked", a lock glyph, a countdown, a number of days. A self-only device never shows "grown-up".

## Interaction points

- [[ START ]] / [ Start ] -> `quest/player` (soft prerequisite sheet unchanged); fires `route.next_started { surface: 'episode' }` when the quest is `routeNext`.
- [ Play again ] -> `quest/player` (kept or finished quest).
- [ {ask} ] -> `access.help_asked { from: 'episode', audience }`, then the route in the table above.
- Back to open lessons -> `episode/detail` of the `routeNext` episode; at `free-end` -> the first free word topic (or the Library when none is playable).
- [<- back] -> where the learner came from.
- Opening state B fires `access.preview_opened { stage, theme, from }` once per open (`from: 'player'` when the quest player guard sent the learner here).

## Navigation graph

Enter from: `journey/grid-plan-and-access` · `home/next-and-free-end-card` · `results/back-to-plan-and-free-end` (Episode page) · Learning Route cell rows · `quest/player` guard (a closed quest was opened directly)
Exit to: `quest/player` · `profiles/pin-entry` -> `billing/plan-status-free-lessons` (F-BILL-002 Plan screen) · `episode/detail` (another lesson) · topic player · Journey tab

## States

- **A. subscriber with a plan**: as drawn (tags on next and plan quests; off-plan rows plain).
- **A'. no plan**: only the Next tag (default route cursor); no In your plan tag.
- **B. preview**: as drawn.
- **B'. preview with every quest kept**: no caption, no preview card — it is an open lesson.
- **Stage 1 lessons** never show state B: all of Stage 1 is free (F-ENT-003 OD-1).
- **Mixed episode** (one quest open by being finished, the rest closed): rows as drawn; the preview card shows.
- **Coming soon** (preview cell, not shipped): unchanged coming-soon card from `episode/detail`; no access words (nothing to open).
- **Empty** (episode not found): unchanged not-found line.
- **Error** (tier or snapshot unreadable): fail open — state A' with every Start live.

## Accessibility

- Tags are part of the row's label ("Family at the Table. Next. In your plan."). The caption "Not open yet" is read as text, not as a disabled button.
- The preview card is a group; focus order: title, quest list, preview card line, ask button, Back to open lessons.
- Buttons use `Button` (`touchTarget.min` or larger); body text 18 or larger; 200 % text reflows.

## Data needs

- Episode and quests from the bundle; `questAccess` per quest (`useQuestAccess()`); `routeNext` and `planView` for the tags; `routeDayOfQuest` for the telemetry `day`; device audience and memberships for `askFor`.
- Writes nothing except telemetry; no network call.

## Open questions

- None beyond OD-6 (resolved: "Not open yet") and OD-8 (no "day" anywhere).
