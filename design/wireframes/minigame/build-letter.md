# Minigame/Build a Letter: batchim tiles and the block-shape slots (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.7 (PR Q-7a) · extends `design/wireframes/minigame/shell.md` and `families.md` (Family 2, build-letter) · related: `design/wireframes/minigame/audio-fallback.md` W6 (the `SyllableBlock` diagram on Discover)
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Code: `apps/mobile/src/screens/minigames/BuildLetterGame.tsx` + `BlockLayout.tsx`; pure rules in `apps/mobile/src/logic/build-letter-view.ts` and `round-builder.ts`
Notation: `[ X ]` secondary action, `( x )` text placeholder, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a build-letter step whose target is a block with a final consonant (물, 밥) or whose vowel sits under the first letter (구)
When: the learner picks tiles into the slots
Then: the slots look like the block they are building, a final-consonant tile says it is a final, and a wrong answer explains the shape instead of "left to right"

## Screen goal

"Build the block the way it is written, including the letter at the bottom."

## Box diagram

```
Target 물 (mul): initial + vowel under + final        Target 밥 (bap): vowel beside + final
+------------------------------+                      +------------------------------+
|  [=====------]       [2 / 5] |                      |  (same frame as shell.md)    |
|  (Build this letter)         |                      |                              |
|        +----------+          |                      |        +----------+          |
|        |    물    |  (mul)   |                      |        |    밥    |  (bap)   |
|        +----------+          |                      |        +----------+          |
|                              |                      |                              |
|          +-----+             |                      |     +-----+  +-----+         |
|          |  1  |  initial    |                      |     |  1  |  |  2  |         |
|          +-----+             |                      |     +-----+  +-----+         |
|          +-----+             |                      |        +-----------+         |
|          |  2  |  vowel      |                      |        |     3     | final   |
|          +-----+  (under)    |                      |        +-----------+  (lower)|
|          +-----+             |                      |                              |
|          |  3  |  final      |                      |                              |
|          +-----+  (lower)    |                      |                              |
|                              |                      |                              |
|  Tiles:                      |                      |  Tiles:                      |
|  [ㅁ] [ㅜ] [ㄹ] [ㅅ] [ㄴ]     |                      |  [ㅂ][ㅏ][ㅂ][ㅈ][ㅁ]         |
|  (m) (u) (l)(s)(n)           |                      |  (b)(a)(p)(j)(m)             |
|            ^ final ㄹ shows  |                      |        ^ final ㅂ shows "p"  |
|              "l", reads      |                      |                              |
|              "final l"       |                      |                              |
|  [ Skip ]                    |                      |  [ Skip ]                    |
+------------------------------+                      +------------------------------+

Wrong answer (the round stays open; the slots clear after a short pause):
+------------------------------+
|  (Hoya) Not quite. Try again.|
|  (The vowel goes under the   |
|   first letter. The last     |
|   letter sits at the bottom.)|
|        +---+                 |   <- small block-shape diagram, boxes numbered 1 2 3
|        | 1 |                 |      in reading order, same shape as the slots
|        +---+                 |
|        | 2 |                 |
|        +---+                 |
|        | 3 |                 |
|        +---+                 |
+------------------------------+
```

- The block has two or three slots in reading order: initial, vowel, final. Vowel beside the initial (ㅏ ㅑ ㅓ ㅕ ㅣ): slots 1 and 2 on one row. Vowel under the initial (ㅗ ㅛ ㅜ ㅠ ㅡ): slot 2 below slot 1. A final consonant fills a lower row.
- A final-consonant tile shows its glyph and its final romanization (`k`, `n`, `l`, `m`, `p`, `ng`), and a screen reader announces "final <romanization>". An initial consonant with the same glyph is a different tile; a round never offers both the initial and the final of a glyph the target uses.
- A 3-part round offers 5 tiles: the 3 parts + 1 other initial consonant + 1 other final consonant. A 2-part round is unchanged (4 tiles).
- A syllable never uses the same tile twice; 밥 has an initial ㅂ tile and a final ㅂ tile.

## Interaction points

- Tile tap fills the next empty slot in reading order; tapping a placed tile removes it (unchanged).
- Slots full and in the right order: correct look, success haptic, auto-advance (unchanged). Otherwise wrong: nudge haptic, Hoya bubble with the shape hint and the shape diagram.
- The target block replays its sound on tap (unchanged). [ Skip ] unchanged.

## Navigation graph

Enter from: `quest/player` via `minigame/shell` · Exit to: `quest/player` (unchanged).

## States

- **success**: rounds advance as in the shell.
- **empty** / **error**: unchanged (shell.md).
- **wrong**: the bubble text depends on the block: vowel beside / under, plus "The last letter sits at the bottom." when there is a final.

## Data needs

- reads: `MinigameScope.syllables[]` `{ ko, romanization, jamoChars, jamoIds? }`; batchim syllables carry explicit `jamoIds` (for example `jamo:mieum`, `jamo:u`, `jamo:rieul-batchim`)
- writes: `answerRound(roundIdx, correct)`, `markStepComplete` (unchanged)

## Open questions

- Hear-it for a single tile is not in this PR: a tile's sound waits on F-AUDIO-004's `playPrompt`.
- The slot boxes are plain views here; when F-QUEST-002 PR Q-5a lands `SyllableBlock`, the slots and the hint diagram can switch to it.
