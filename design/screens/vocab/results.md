# Speed Round: the results screen (F-VOC-004 S-5)

Spec: `docs/specs/F-VOC-004-speed-round.md` S4, S9, S10, S11, §3.4 (stars, caught), §3.6 (results screen, what each answer writes), §3.7 (results nudges), behaviours 10, 11 and 16.
Wireframe: `design/wireframes/vocab/speed-round.md` frame H.
Code: `apps/mobile/src/screens/vocab/VocabResultsScreen.tsx` (render only); decisions in `apps/mobile/src/logic/vocab/{speed-round,stars,nudges}.ts` (100 % covered).
Components: `Hoya`, `HoyaBubble`, `StarRow`, `Heading`, `Body`, `Button`, `KoreanText` (design system); `PictureArt` (app).
Screenshots: as `design/screens/vocab/speed-round.md` (`vocab-speed-results-*.png`).

## Frame

```
H  Results
┌────────────────────────────────┐
│          (Hoya cheering)       │  <- `cheering`; `thinking` for a round with no first-try catch
│            * * .               │  <- StarRow: 1 to 3 lit stars, never an empty row
│       7 words caught           │  <- a plain count of distinct words (Heading)
│       New best!                │  <- Challenge only (S-6), only above your own earlier best
│ (Hoya) "Nice round."           │  <- the results nudge (3 / 2 / 1 stars, or the first-star line)
│                                │
│ Words to see again             │  <- only when there are some; neutral heading
│ ┌────────┐ ┌────────┐ ┌──────  │  <- a horizontal row of tiles, scrolls sideways
│ │ [pic]  │ │ [pic]  │ │        │     picture, Korean, romanization (per the setting), meaning
│ │ 사과    │ │ 배     │ │        │
│ │ sagwa  │ │ bae    │ │        │
│ │ apple  │ │ pear   │ │        │
│ └────────┘ └────────┘ └──────  │
│ [[ PRACTICE THESE ]]           │  <- once the flashcards exist (C-5): those words only
│                                │
│ [[ PLAY AGAIN ]]               │  <- primary when there is no "see again" list
│ [ BACK TO TOPIC ]              │
└────────────────────────────────┘
```

## Layout, top to bottom

1. **Hoya** (`Hoya`, `touchTarget.hero` 96 dp, the pose of the results nudge) above a `StarRow` (48) with the round's stars, 1 to 3. The row is never empty: a round with an answer always earns at least one star (S4), and a round with none has no results screen (F-STORY-004 §3.4's pattern: no empty star row).
2. **Caught**: "7 words caught" (`Heading level="title"`): the distinct words answered right on the first try without a hint. "1 word caught", "0 words caught" read the same way; never "of", never a percentage.
3. **Time line**, a round the clock ended (Challenge, S-6): "Time's up. Here is what you caught." above the count.
4. **New best!** (`Body weight="semibold"`), Challenge only and only when `caught` is above the learner's own earlier Challenge best for the topic, read before the round's session was written (S9). Relaxed never shows it.
5. **Hoya's line** (`HoyaBubble`): 3 stars "Wow, a bright round!", 2 "Nice round.", 1 "Good round. Every word helps.", and with no first-try catch "Good try! You collected a star!" (pose `thinking`).
6. **Words to see again** (only when a word was answered wrongly): the heading (`Heading level="prompt"`) and a horizontal row of tiles in the order the words came up, each one element named like a word wall tile ("Korean: 사과, sagwa, apple"); then **Practice these** (`Button primary lg`) to the flashcards limited to those words, drawn only once the flashcards are in the build (`VOCAB_SCREENS.learn`, F-VOC-003 C-5).
7. **Play again** (`Button lg`, primary when there is no list, otherwise secondary): a new round on the same topic (the start sheet again, so the learner sees the mode). **Back to topic** (`Button ghost md`).

## What is never shown

No percentage, ratio or fraction, no "n of m", no time per word, no accuracy, no count of misses, no comparison with anyone, no "wrong", "missed" or "failed" (behaviour 16; the e2e scans the page). Caregiver numbers live in the summary (F-VOC-005 §3.8).

## States

| State | What shows |
|---|---|
| no word to see again | no heading, no tiles, no Practice these; Play again is primary |
| a stale or broken route (no summary, or a summary with no stars) | the screen goes back to the topic page; nothing is written here |
| a topic word no longer in the bundle | its tile is left out of the list |

## Accessibility

- Stars are one image named "2 stars" (`a11y.stars`); Hoya is decorative next to his line; the count is text.
- The tile row scrolls sideways and each tile is one element; buttons are 64 / 80 dp.
- 200 % text and 320 wide: the page scrolls; the tile row keeps whole tiles and scrolls.

## Decisions taken while building

- **The screen writes nothing.** The round screen writes every answer live and the session once before it opens the results, so a reload or Back here can never write a second session.
- **Practice these waits for the flashcards.** `VocabCards` gains an optional `ids` (the words to practise); the button is drawn once C-5 registers the screen and honours it, so this build never shows a button that goes nowhere.
