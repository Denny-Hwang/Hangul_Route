# Library/Gallery — the Heritage card collection (wireframe v1)

Spec: `docs/specs/F-CARD-001-heritage-card-art.md` §3.1, §3.4 (30 Stage 1 cards = 5 themes × 6) · `docs/blueprints/02-core-feature-spec.md` (Library) · `docs/blueprints/10-app-map.md` §3.1
Audience: **learner (P4/P5 child, 5–11)**
Code (back-filled): `apps/mobile/src/screens/library/LibraryScreen.tsx` — tab `Main/Library`; content `heritage-cards.ts`

## Scenario (Given-When-Then)

Given: a learner opens the Library tab (after any number of quests, possibly zero)
When: the gallery renders
Then: they see their collected cards as the prize, the locked slots as "more to find", and can open any card in one tap — with no comparison to anyone else

## Screen goal

"Look at my cards and open one."

## Box diagram

```
+----------------------------------+
|  Heritage Library    [ n / N ]   |  <- count pill; 1 muted line "n of N collected"
|                                  |
|  [All] [Let] [Life] [Rite] [Nat] [Craft] |  <- theme filter chips, wrap to 2 rows
|                                  |
|  +-------------+ +-------------+ |
|  | [rarity]    | | [rarity]    | |  <- collected slot: rarity pill, card art,
|  |  [ART]      | |  [ART]      | |     ko word, romanization, English title
|  |  책  chaek  | |  김치 kimchi | |
|  |  Book       | |  Kimchi     | |
|  +-------------+ +-------------+ |
|  +-------------+ +-------------+ |
|  |   (lock)    | |   (lock)    | |  <- locked slot: lock glyph + "Locked",
|  |   Locked    | |   Locked    | |     no title, no art (no spoilers)
|  +-------------+ +-------------+ |
|   ... 2-column grid, scrolls ... |
|                                  |
|  +----------------------------+  |
|  | How to collect more, 2 ln  |  |  <- explainer card
|  +----------------------------+  |
+----------------------------------+
```

- Grid order = content order (theme, then rarity), never "most recent first": a stable position is the child's memory anchor.
- Locked slots are shown *in place* so the child sees the shape of the whole collection (learner surface only; the parent surface hides them — see `parent/learner-detail.md`).
- No sort, no search, no "friends' collections".

## Interaction points

- Collected slot tap → `library/card-detail` (cardId, modal)
- Locked slot tap → `library/card-detail` in its locked variant (lock, no flip, no share) — allowed so the tap is never "dead"
- Filter chip tap → filter grid by theme (local state, not persisted)
- Explainer card: no-op text

## Navigation graph

Enter from: `Main` tab bar (Library) · `results/celebrate` (via tabs) · certificate variant "See my cards" (future)
Exit to:    `library/card-detail` (modal, returns here)

## States

- **success**: mixed collected / locked grid; count pill.
- **empty** (0 collected): full grid of locked slots + count "0 of N" + the explainer card gains one Hoya line pointing at the next quest (→ `home/todays-mission`). Never a blank tab.
- **error** (progress unreadable): render the grid with *no* locked/collected distinction (neutral slots) + one "your cards will show up in a moment" line + [ TRY AGAIN ]; do not show everything as locked — that reads as "you lost your cards".

## Data needs

- reads: `heritageCardsAll` (id, titleEn, subtitleKo, romanization, theme, rarity), `supportedCardIds` (art availability) · `ProgressSnapshot.cards[]` (`cardId`, `unlockedAt`, `newSinceLastView`) for the active profile
- writes: none today; candidate: clear `newSinceLastView` on open
- telemetry: candidate `library.viewed` `{ collected, total }` — no per-card view events

## Open questions

- **Discrepancy**: app-map and F-CARD-001 speak of **30** cards; `heritageCardsAll` is **42** (30 Stage 1 + 8 Stage 2 + 4 Stage 4), so the count reads "n of 42" and the locked Stage 2/4 slots appear before those stages are truly open. Filter by entitled stages, or show 30 until Stage 2 lands?
- `newSinceLastView` exists in the schema but nothing sets a "new" mark on a slot. Add a small "new" corner on unseen cards? (Sparkle pattern from `home/todays-mission` ③.)
- Rarity on the thumb: pill text vs. border only (code does both). For pre-readers the border is the cue; pill may be dropped in mid-fi.
