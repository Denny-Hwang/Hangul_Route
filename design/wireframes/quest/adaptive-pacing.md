# Quest/Adaptive pacing: compact Discover and the scaffold round (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.6 (strong and hard rounds, U-11), §7.7 (anti-shame checklist), §11.3 (`quest.adapt { questId, dir }`), §12.2 (`questAdapt` off: the standard path) · `docs/specs/F-CURR-001-upper-stage-content.md` U-5 and U-11 · `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` (the six-step quest)
Panels reused as they are: **`quest/discover.md`** (the item card, Hear it, the page dots, Continue) and **`minigame/listen-pick.md`** (the round frame, the ringed hint card, the amber miss).
Audience: **learner, any age** (P4 / P5 / P6). One primary action per panel.
Built by row **CM-24** (behind `questAdapt`, built-in pct 0 until the owner ramps it)

## Scenario (Given-When-Then)

Given: a learner answered 90% or more of a lesson quest's Practice right on the first try
When: they open a later quest of the same cell in the same app session
Then: that quest's second Discover page, when it holds two words, shows both on one card (each with its own Hear it), and its Apply plays one round fewer; the six steps, the counter and the stars are as always

Given: a learner missed two Practice rounds on the first try
When: the Practice ends
Then: one more round of the same words comes before Apply, in Listen & Pick with the right card ringed from the start, and then Apply opens as always

## Box diagram

```
C. Compact Discover page (page 2 of a later quest in the cell)
+--------------------------------+
| [x Close]                 [Aa] |
| o o . . . .             [2/6]  |  <- the quest's own counter: no step was added or removed
| Weather Words                  |
| [Look and learn]               |
| (Hoya) Tap Hear it, then ...   |
| Page 2 of 2  o o               |
| Words you can read now         |
| +----------------------------+ |  <- ONE card (surface.paper) instead of two
| | Two on one card. Tap Hear  | |  <- Caption, secondary: learner.quest.discover.compactLine
| | it for each.               | |
| |          [ 구름 ]          | |  <- KoreanText: romanization + gloss, as on every card
| |          gu-reum, cloud    | |
| |      ( (speaker) Hear it ) | |  <- size lg (>= 48 dp; 64 at the touchTarget floor)
| | -------------------------- | |  <- border.subtle, thin: the second row
| |          [ 바람 ]          | |
| |          ba-ram, wind      | |
| |      ( (speaker) Hear it ) | |
| +----------------------------+ |  <- no picture in a row (it only repeats the word, decorative)
| [         Continue           ] |  <- enabled at once, as on every Discover page
+--------------------------------+

S. Scaffold round (after Practice, before Apply; outside the steps)
+--------------------------------+
| [x Close]                 [Aa] |  <- Close asks the quest's Leave sheet, as on every step
| ==========================[1/1]|  <- the game's own bar: one round
| Listen, then pick              |
| One more, with a hint. Hear    |  <- Body, secondary: learner.quest.adapt.scaffoldHint
| it, then tap the highlighted   |
| card.                          |
|          ( (speaker) )         |  <- the shipped Listen & Pick prompt (round 1 never autoplays)
|        ( Hear it again )       |
| +----------------------------+ |  <- the right card ringed from the start (ChoiceCard `hint`:
| | 별  byeol                  | |     border.focus, thick); its name reads "Look here: ..."
| +----------------------------+ |
| | 하늘 haneul                | |  <- the other words of this Practice, missed ones first
| +----------------------------+ |
| | 나무 namu                  | |
| +----------------------------+ |
+--------------------------------+
```

## States and rules

- **No mention of speed, no timer, no red.** The compact card says only how to use it; a miss in the scaffold round is the shipped amber nudge (`colors.feedback.nudge`) and Hoya `thinking`.
- **Nothing is taken away.** Every Discover item still shows (U-11); the scaffold round adds, it never replaces Apply; stars count the quest's own rounds only (the scaffold round is recorded for review, marked hinted, never scored).
- **Off** (`questAdapt` off, a guest run, the All lessons preview, a Stage 1 or story quest): the standard path, nothing loads.
- **320 px**: the compact card stacks its two rows; each Hear it is a full button; the options stack in one column.
