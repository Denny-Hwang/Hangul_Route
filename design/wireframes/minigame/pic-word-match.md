# Minigame/Pic-Word Match: pair 3-5 pictures with their Korean words (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.11 (PR Q-4) · promoted from S6 of `design/wireframes/quest/discover.md` (that file keeps the full set of screens until the other promotions land) · extends `design/wireframes/minigame/shell.md` and `families.md` (Family Recognition) · supersedes Card Match for new content (Card Match stays for the Stage 2 / Stage 4 taste quests)
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Code: `apps/mobile/src/screens/minigames/PicWordMatchGame.tsx`; pure rules in `apps/mobile/src/logic/pic-word-flow.ts`; tile card: `design/components/ChoiceCard`, taught Korean: `design/components/KoreanText`, picture: `apps/mobile/src/screens/minigames/PictureArt.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization (`KoreanText`), `{ x }` content-driven, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Pic-Word Match step (one board of 3-5 pairs; Stage 1 uses 4)
When: the learner taps a picture and then its word, or a word and then its picture
Then: a right pair locks under one number with a check and the word is spoken, a miss is a soft amber nudge that ends nothing, and the board closes when every pair is matched

## Screen goal

"Find each picture's word. A miss only means try another one."

## Box diagram

```
+----------------------------------+
| (progress bar)  (n / N)   [Skip] |  <- Skip appears after the first answer
|                                  |
|  (Match each picture)            |
|  (Tap a picture, then its word.) |  <- live region: names the selection and the next step
|                                  |
|  pictures            words       |
|  +--------+        +-----------+ |
|  |(1){pic}|        | ~~ 밥 ~~  | |  <- number badge + check on BOTH tiles of a matched pair
|  |   [v]  |        | (bap)     | |
|  +--------+        | (rice)    | |  <- gloss appears under the word only after the match
|  +========+        +-----------+ |
|  # {pic}  #        | ~~ 김치 ~~| |  <- selected tile: heavy ring
|  +========+        | (gimchi)  | |
|  +--------+        +-----------+ |
|  | {pic}  |        | ~~ 산 ~~  | |
|  +--------+        | (san)     | |
|  (Hoya thinking: "Try another one") |  <- only after a miss
+----------------------------------+
```

The two columns are shuffled independently; a word is never across from its own picture. At 5 pairs on a small phone the body scrolls; tiles never shrink below the minimum touch size. In landscape the pictures are smaller and the columns stay.

States of one attempt:

```
select:   tap a picture (or a word) -> heavy ring; the live region says "Picture selected: (gloss). Choose a word."
          tap the selected tile again -> the ring clears; tap another tile of the same side -> the ring moves
match:    both tiles lock, same number badge + check mark; the word is spoken; the gloss appears under the word
miss:     the second tile turns amber (+ a mark) for 0.6 s, then clears; the first tile stays selected; Hoya thinking; nothing ends
2nd miss: the right partner gets a "look here" ring (stays until the pair is matched)
no art:   the picture tile shows the English gloss in a plain tile (plays like Card Match); never blank
done:     all pairs locked -> 0.7 s -> the next board, or back to the quest
empty:    "(Nothing to play here)" + [ Back to quest ]
```

## Interaction points

- **Picture tile / word tile**: tap-tap pairing, either order; no drag (no gesture dependency). The pair that is **scored** is the one of the **first** tile selected; a wrong second tile never scores the pair it was tapped against.
- **Scoring**: one scored round per pair, keyed `b<board>:<pairId>`; the first answer scores, later ones are retries (`first-try.ts`), so a miss followed by the right match is a retry.
- **Skip** (ghost): after the first answer; ends the step without marking unmatched pairs.
- **Board advance**: automatic, 0.7 s after the last pair; after the last board the step is complete.
- **Leave**: the quest player's own leave control (this screen adds none).

## Navigation graph

Enter from: `quest/player` (a practice or apply step with a `pic-word-match` scope) -> `minigame/shell` (push, returns)
Exit: the last board or Skip -> back to `quest/player` (step complete) · empty scope -> back to `quest/player`

## States

- **success**: as drawn.
- **empty**: fewer than three playable pairs on every board shows one line and a Back button.
- **error**: an unreadable or unknown picture -> the gloss tile; audio failure or no voice -> the match still works (the word is already on screen); a pair without an id or Korean word, or one that repeats an earlier id or word, is skipped (and caught by the content test).
- **offline**: all content and art are bundled; nothing blocks.
- **reduced motion**: no motion is used; states change instantly.
- **large text / small phone**: the body scrolls; tiles keep their minimum touch size; pictures use the minimum size below 380 dp wide and in landscape.
- **accessibility**: every tile is a button with a name (picture: its English gloss; word: Korean, romanization and, once matched, the gloss), and the name carries the state (selected, matched with its number, not this one, look here); order is pictures top to bottom, then words.
- **anti-shame**: amber + Hoya thinking on a miss; a bar that only fills; no red, no timer; the "n / N" count is the only number.

## Data needs

- reads: `scopeFor(ref).picWord.boards` (each 3-5 pairs of `{ id, pictureRef?, word: KoText }`) · `romanizationMode` (F-I18N-001; `tap` hides a word's romanization until the tile is touched)
- writes: `host.answer('b<board>:<pairId>', correct)` -> `quest-run-store` (first-try tally); `host.complete()` -> `markStepComplete()`
- telemetry: `minigame.finished` `{ kind: 'pic-word-match', questId, stepIndex }` (existing, from `MinigameScreen`)

## Open questions

- Draw connecting lines instead of number badges? Recommend badges now (accessible without gestures); lines as motion polish later.
- The Check and review header variants (dots instead of the bar) are not defined for this game; it keeps the bar until a host that needs them (F-VOC, Hangul Check) says otherwise.
