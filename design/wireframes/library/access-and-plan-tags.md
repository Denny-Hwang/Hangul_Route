# Library/Story and word-topic tiles — "Opens with the full route" and "In your plan" (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.2 (free set), §3.7 (Library), §3.11 (copy) · extends `library/stories.md` (tile states, F-STORY-004 §3.4) and the topic picker of F-VOC-003
Audience: **learner (any age; P4/P5/P6)**. The tile's grown-up path opens the PIN gate first (unchanged).
Code: `apps/mobile/src/screens/library/StoryShelf.tsx`, `StoryTile.tsx`, `apps/mobile/src/logic/content-access.ts` (`isContentLocked`), `apps/mobile/src/logic/route-next.ts` (`planQuestIds`)

## Scenario (Given-When-Then)

Given: a learner browses the Library shelves
When: a tile renders
Then: a free learner (switch on) sees the same calm phrase on a story or topic outside the free set as on a lesson past Day 2; a story or topic that is part of the learner's plan this week says "In your plan"; a subscriber never sees a lock

## Screen goal

"Every shelf shows everything; one phrase names the boundary, one tag names the plan."

## Box diagram (one tile, three looks)

```
open, in plan                 open, no tag               free, outside the free set
+----------------------+      +----------------------+   +----------------------+
| [scene art]          |      | [scene art]          |   | [scene art]      [k] |
| The Sun and the Moon |      | Jikji                |   | Eighty Thousand      |
| 5 min                |      | 5 min                |   | Woodblocks   5 min   |
| (o) In your plan     |      | New                  |   | Opens with the full  |
+----------------------+      +----------------------+   | route                |
                                                         +----------------------+
```

- [k] = the existing lock glyph (F-STORY-004 §3.4); only its word changes, from "Locked" to "Opens with the full route".
- (o) = the In your plan ring of the E3-D mock, plus the word.
- A tile never shows a price, "Premium", "buy" or a count of free items.

## Interaction points

- Open tile -> story reader / topic player (unchanged).
- [k] tile -> `access.grownup_asked { from: 'library' }` -> `PinEntry { next: 'Paywall', from: 'library' }` (unchanged route, F-STORY-004 §3.4).

## Navigation graph

Enter from: Library tab · Home story card · route page
Exit to: `story/reader` · topic player · `profiles/pin-entry` -> `paywall/free-plan-days`

## States

- **Subscriber, or switch off**: no [k] on any tile; (o) on plan items.
- **Free, switch on**: [k] on stories not in the sampler and topics past Food, Animals, Colors, Numbers.
- **Empty shelf** (no reviewed story bundled, production today): unchanged empty state of `library/stories.md`.
- **Error** (tier unreadable): fail open — no [k].

## Accessibility

- Tile label = title, minutes, then "In your plan" or "opens with the full route". Shapes plus words; never colour alone.

## Data needs

- `isContentLocked` (tier via `accessTier`, `flags.contentGatingEnabled`); `planQuestIds` for story quests in the plan.

## Open questions

- OD-4 (the free stories and topics stay the D5 set by default).
