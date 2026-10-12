# Library/Story and word-topic tiles — "Not open yet" and "In your plan" (wireframe v2)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.2 (free set), §3.7 (Library, marks), §3.11 (glossary) · extends `library/stories.md` (tile states, F-STORY-004 §3.4) and the topic picker of F-VOC-003
Audience: **learner (any age; P4/P5/P6)**. The tile's grown-up path opens the gate first (unchanged route).
Code: `apps/mobile/src/screens/library/StoryShelf.tsx`, `StoryTile.tsx`, `apps/mobile/src/logic/content-access.ts` (`isContentLocked` with `gatingActive`), `apps/mobile/src/logic/route-next.ts` (`planView`)

## Scenario (Given-When-Then)

Given: a learner browses the Library shelves
When: a tile renders
Then: a free learner (switch on) sees the same words and the same shape on a story or topic outside the free set as on a lesson that is not open yet; a story or topic in the learner's plan says "In your plan"; a subscriber never sees a mark of access

## Screen goal

"Every shelf shows everything; one phrase and one shape name the boundary, one tag names the plan."

## Box diagram (one tile, three looks)

```
open, in plan                 open, no tag               free, outside the free set
+----------------------+      +----------------------+   .----------------------.
| [scene art]          |      | [scene art]          |   : [scene art]          :
| The Sun and the Moon |      | Jikji                |   : Eighty Thousand      :
| 5 min                |      | 5 min                |   : Woodblocks   5 min   :
| (====) In your plan  |      | New                  |   : Not open yet         :
+----------------------+      +----------------------+   '----------------------'
```

- `:....:` = the dotted ring (same shape as the Journey cell and the Learning Route pip); it replaces the lock glyph of F-STORY-004 §3.4, and the word changes from "Locked" to "Not open yet".
- `(====)` = the In your plan solid ring of the E3-D mock, plus the word.
- A tile never shows a price, a product name, "Premium", "buy" or a count of free items.

## Interaction points

- Open tile -> story reader / topic player (unchanged).
- Dotted tile -> `access.help_asked { from: 'library', audience }` -> `PinEntry { next: 'Paywall', from: 'library' }` (unchanged route, F-STORY-004 §3.4; self-only device with no PIN: the Plan screen directly). The tile's accessibility hint carries the `askFor` label ("Ask a grown-up", "Ask your teacher or a grown-up", "See how to open it").

## Navigation graph

Enter from: Library tab · Home story or practice card · Learning Route
Exit to: `story/reader` · topic player · `profiles/pin-entry` -> `billing/plan-status-free-lessons`

## States

- **Subscriber, or switch off, or native build**: no dotted ring on any tile; solid ring on plan items.
- **Free, switch on**: dotted ring on stories not in the sampler and topics past Food, Animals, Colors, Numbers.
- **Empty shelf** (no reviewed story bundled, production today): unchanged empty state of `library/stories.md`.
- **Error** (tier unreadable): fail open — no dotted ring.

## Accessibility

- Tile label = title, minutes, then "In your plan" or "not open yet"; hint = the ask label. Shapes plus words; never colour alone.

## Data needs

- `isContentLocked` (tier via `accessTier`, `gatingActive`); `planView().inPlanQuestIds` for story quests in the plan; device audience and memberships for the hint.

## Open questions

- OD-4 (the free stories and topics stay the D5 set by default).
