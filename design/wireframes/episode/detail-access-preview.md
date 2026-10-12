# Episode/Detail — plan tags and the preview of a lesson that opens with the full route (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.3 (`questAccess`), §3.7 (episode page), §3.11 (copy), §3.15 (child safety) · extends `episode/detail.md`
Audience: **learner (any age; P4/P5/P6)**. The only grown-up control is **Ask a grown-up**, which opens the PIN gate first.
Code: `apps/mobile/src/screens/episode/EpisodeDetailView.tsx`, `apps/mobile/src/logic/content-access.ts`, `apps/mobile/src/logic/route-next.ts`

## Scenario (Given-When-Then)

Given: a learner opens a lesson page from the Journey, Home, Results or the route page
When: the page renders
Then: a subscriber sees which quest is next and which are in their plan, with every Start button working; a free learner on a lesson past Day 2 (switch on) sees everything the lesson holds, keeps Play again on quests already finished, and finds one calm way to ask a grown-up or go back to open lessons

## Screen goal

"Show the whole lesson; start the next quest, or (preview) show what it holds and hand the decision to a grown-up."

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
| |     blurb                (o) In plan   | |  <- tag: drawn ring + word
| |     [[ START ]]                        | |  <- the primary of the page
| +----------------------------------------+ |
| | (3) Picnic Snacks                      | |  <- off-plan: no tag at all
| |     [ Start ]                          | |
| +----------------------------------------+ |
| Cards you can earn  [card] [card] [card]   |  <- unchanged
+--------------------------------------------+
```

## Box diagram — B. preview (free, switch on, lesson past Day 2)

```
+--------------------------------------------+
| [<- back]                                  |
| [ Stage 1 ] [ Rites ]                      |
| New Year & Festivals (title)               |
| ( Hoya intro bubble )                      |
|                                            |
| Quests                                     |
| +----------------------------------------+ |
| | (1) Bow & Eat Tteokguk                 | |
| |     blurb                              | |
| |     New letters: [ko chip] [ko chip]   | |  <- KoreanText with romanization
| |     Opens with the full route          | |  <- caption replaces Start
| +----------------------------------------+ |
| | (2) a kept quest           stars **    | |  <- finished before: stays open
| |     [ Play again ]                     | |
| +----------------------------------------+ |
| Cards you can earn  [card] [card]          |  <- shown, never greyed out
|                                            |
| +----------------------------------------+ |
| |   [hoya reading]                       | |
| |   "This lesson opens with the          | |
| |    full route." (one line)             | |
| |   [ Ask a grown-up ]                   | |  <- secondary -> PinEntry
| |   Back to your lessons                 | |  <- ghost link -> open lesson
| +----------------------------------------+ |
+--------------------------------------------+
```

- The preview page has **no primary button**: nothing on it pushes the learner toward buying.
- Never on this page: a price, "Premium", "buy", "trial", "locked" as a word, a countdown, a number of days.

## Interaction points

- [[ START ]] / [ Start ] -> `quest/player` (soft prerequisite sheet unchanged); fires `route.next_started { surface: 'episode' }` when the quest is `routeNext`.
- [ Play again ] -> `quest/player` (kept or finished quest).
- [ Ask a grown-up ] -> `access.grownup_asked { from: 'episode' }`, then `PinEntry { next: 'Paywall', from: 'episode' }`; a self-only device with no PIN opens `paywall/free-plan-days` directly (`gateOpensDirectly`).
- Back to your lessons -> `episode/detail` of the open `routeNext` episode; at `free-end` -> Journey tab.
- [<- back] -> where the learner came from.
- Opening state B fires `access.preview_opened { stage, day, from }` once per open.

## Navigation graph

Enter from: `journey/grid-plan-and-access` · `home/next-and-free-end-card` · `results/back-to-plan-and-free-end` (Episode page) · route page cell rows
Exit to: `quest/player` · `profiles/pin-entry` -> `paywall/free-plan-days` · `episode/detail` (another lesson) · Journey tab

## States

- **A. subscriber with a plan**: as drawn (tags on next and plan quests; off-plan rows plain).
- **A'. no plan**: only the Next tag (default route cursor); no In your plan tag.
- **B. preview**: as drawn.
- **B'. preview with every quest kept**: no caption, no preview card — it is an open lesson.
- **Mixed episode** (one quest open by being finished, the rest closed): rows as drawn; the preview card shows.
- **Coming soon** (preview cell, not shipped): unchanged coming-soon card from `episode/detail`; no access words (nothing to open).
- **Empty** (episode not found): unchanged not-found line.
- **Error** (tier or snapshot unreadable): fail open — state A' with every Start live.

## Accessibility

- Tags are part of the row's label ("Family at the Table. Next. In your plan."). The closed caption is read as text, not as a disabled button.
- The preview card is a group; focus order: title, quest list, preview card line, Ask a grown-up, Back to your lessons.
- Buttons use `Button` (`touchTarget.min` or larger); body text 18 or larger; 200 % text reflows.

## Data needs

- Episode and quests from the bundle; `questAccess` per quest (`useQuestAccess()`); `routeNext` and `planQuestIds` for the tags; `routeDayOfQuest` for the telemetry `day`.
- Writes nothing except telemetry; no network call.

## Open questions

- OD-6 wording and glyph (default "Opens with the full route" plus the lock glyph on the Journey cell).
- OD-8: no "Day N" here (default).
