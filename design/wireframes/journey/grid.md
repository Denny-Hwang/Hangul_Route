# Journey/Grid — the 7 × 5 Heritage Journey map (wireframe v1)

Spec: `docs/blueprints/02-core-feature-spec.md` §1 · `docs/blueprints/04-main-content-outline.md` (grid) · `docs/specs/F-SUB-001-subscription-entitlement.md` §3 (Stage 1 free, `isStageEntitled`) · `docs/blueprints/10-app-map.md` §3.1, §4.2
Audience: **learner (P4/P5 child, 5–11)**
Code (back-filled): `apps/mobile/src/screens/journey/JourneyScreen.tsx` — tab `Main/Journey`; content `stages.ts`, `themes`, `episodeFor()`

## Scenario (Given-When-Then)

Given: a learner opens the Journey tab (any progress level)
When: the grid renders
Then: they can see where they are, which cells are open right now, and pick one episode to open — without reading a paragraph

## Screen goal

"Pick one episode cell to open." (secondary: see that Stages 2–7 exist and are coming)

## Box diagram

```
+----------------------------------+
|  Heritage Journey                |  <- title + 1 muted line ("draw your route")
|                                  |
|        Let  Life Rite Nat  Craft |  <- 5 theme column labels (short)
|  (1) Hangul            [open]    |  <- stage row header: number badge, title,
|      1-liner                     |     1-liner, status pill
|      [L*] [L ] [R ] [N ] [C ]    |  <- 5 cells; * = completed look
|                                  |
|  (2) Words             [soon]    |
|      [ # ] [L ] [ # ] [N ] [ # ] |  <- # = preview (lock glyph, disabled)
|      (lock) 1-line unlock hint   |     L / N = shipped taste cells
|                                  |
|  (3) Sentences         [soon]    |
|      [ # ] [ # ] [ # ] [ # ] [ # ] |
|  (4) Dialogue          [soon]    |
|      [ # ] [ # ] [R ] [ # ] [ # ] |
|  (5)(6)(7) ... same pattern      |
|                                  |
|  +----------------------------+  |
|  | How the journey works, 2 ln|  |  <- explainer card, sunken
|  +----------------------------+  |
+----------------------------------+
```

Cell looks (4): **shipped** (theme initial, stage-tinted border) · **completed** (success tint) · **preview** (lock glyph, disabled) · **premium-locked** (lock glyph + tappable, future — see below).

- Rows scroll vertically; the 5 columns always fit one screen width (no horizontal scroll — a child must never lose a column).
- Stage 1 row is first and open by default (`unlockedByDefault`).
- The unlock hint under Stage 2 is one muted line, never a countdown.

## Interaction points

- Shipped / completed cell tap → `episode/detail` (episodeId)
- Preview cell: disabled (accessibility label "coming soon"); no navigation, no toast
- **Premium-locked cell** (Stage 2+ content once it is real, `isStageEntitled == false`) → `paywall/upgrade` (**future, R** — parent-gated via `profiles/pin-entry` first, app-map §4.2)
- **Stage-complete row** (every cell completed) → `reviews/stage-review` (**future, D**, F-RVW-001 §3.4) — slot: the status pill becomes the tap target
- Row header tap: no-op (rows are labels, cells are buttons)

## Navigation graph

Enter from: `Main` tab bar (Journey) · `results/celebrate` (via tabs reset) · `home/todays-mission`
Exit to:    `episode/detail` · `paywall/upgrade` (future) · `reviews/stage-review` (future)

## States

- **success**: full 7 × 5 grid, mixed cell looks.
- **empty** (no progress yet): identical grid, no completed cells; Stage 1 first cell is the obvious start — no extra "start here" overlay needed (position is the cue).
- **error** (progress unreadable): render the grid from content with *no* completed look, plus one muted "progress will show up in a moment" line; content is bundled so the grid itself cannot fail.

## Data needs

- reads: `stages[]`, `themes[]`, `episodeFor(stage, theme)` (bundle) · `ProgressSnapshot.quests[]` per profile (completed look) · `entitlementTier` (`account-store`) for the premium-locked look
- writes: none
- telemetry: candidate `journey.cell_opened` (stage, theme) — no per-cell view events

## Open questions

- **Discrepancy**: the row pill shows "Soon" for every stage except 1, yet the Stage 2 (life, nature) and Stage 4 (rites) taste cells are open and tappable. Row status and cell status need one rule (default: pill reflects "any cell open").
- **Discrepancy**: no entitlement check in the shipped grid (F-SUB-001 §4 defers it). When Stage 2 becomes gated, does the *cell* or the *row* carry the lock, and does a locked cell open `paywall/upgrade` directly or show `episode/detail` in preview mode first? Default: cell → paywall, because a child tapping "something locked" should meet the grown-up gate, not a dead page.
- Completed cell defined as "any quest completed" (code) vs "all quests completed" (episode progress). Pick before the mid-fi pass; it changes how Stage 1 looks at 50 %.
