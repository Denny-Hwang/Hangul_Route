# Minigame/Story Order: put four panels in order by reading their Korean (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F5 (`story-order`, new kind; S4-S5 and packs; fallback Story Sequence; "Reorder 4 illustrated panels with Korean captions. At least 1 round in 2 is captions only, or has captions that settle the order on their own (lint `story-order-text`), so the order cannot come from the pictures alone"), §8 (lecture: the existing sentence slide), §7.7, §12.2 (`game.story-order`), row **CM-D2** (this file), built in row **CM-34** · reuses the tap-to-place frame of `design/wireframes/story/sequence.md` (Story Order v2, panels F and G) and `shell.md` (layout A) · audio states: `audio-fallback.md` W10 (the Story Order replay) and W11
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-variety/` (`mock/story-order.html`, `mock/states.html` board O; shots at 320 and 768)
Code (planned, CM-34): renderer `apps/mobile/src/screens/minigames/StoryOrderGame.tsx`, built on the shipped pure rules of the sequence game (`logic/story/sequence-player.ts`, `seeded-order.ts`, `sequence-view.ts`) with a caption mode; round schema `StoryOrderRoundSchema` and `storyOrderToSequence` in `packages/content-schema`; lint `story-order-text` in `scripts/`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean with romanization (`KoreanText`), `(art)` a `StoryScene` picture, `[ n ]` a numbered slot.

## Scenario (Given-When-Then)

Given: a Stage 4-5 quest step or a pack level step with a `story-order` scope (outside the story reader: a short everyday sequence, a recipe, a festival's order of events)
When: the learner reads four Korean captions (with or without pictures) and taps them in the order they happen
Then: each card moves into the next slot and its line is said; a card that does not come next only nudges; when the row is full the four lines replay in order with their meanings

## Screen goal

"Read the four lines and put them in order."

## Round shape

- **4 cards** per round (3 to 5 allowed by the schema; 4 is the authoring default). Each card has a Korean caption (one short sentence of taught words) with its romanization; a picture when the round is **illustrated**; no picture when it is **captions only**.
- **No meaning on the cards while ordering.** The gloss in the UI language would let the order come from English, so cards show Korean and romanization only (the realia rule, `realia-read` D3). [ Show meanings ] reveals the glosses on every card for the rest of the round; the round is then recorded as hinted for the memory model (§4.3) and still scores as usual. The replay always shows the meanings.
- **The text settles the order** (lint `story-order-text`, CM-34): counted over all the `story-order` rounds of a quest (or of a pack level), at least half of them, rounded up, are **text-settled**: captions only, or illustrated with captions that settle the order on their own (sequence words such as 먼저, 그다음에, 그리고, 마지막에; time words such as 아침, 점심, 저녁; or cause and result). So a quest with a single Story Order round makes that round text-settled. A round counts as text-settled only if it passes the marker test, illustrated or not: a sequence or time marker in at least 3 of its 4 captions (n - 1 of n), or an authored `orderCue` note the MAR confirms. An illustrated round that does not pass is allowed but does not count.
- **Start order** is a derangement (never the right order, no card in its own place), seeded per round (the shipped `seeded-order`).
- **Scoring** per slot: the slot's first answer scores (the Story Sequence rule). The round's first-try result is right when every slot was right first time.
- **Rounds per step**: 1 or 2. **Skip**: [ Skip this one ] (as Story Sequence).

## Box diagram

Captions only, compact (320 x 568):

```
+--------------------------------+
| [=====-----]          (1 / 2)  |  <- round count of the step
|  (Put the lines in order)      |  <- heading (illustrated rounds: "Put the pictures in order")
|  (Read each line. Tap the one  |
|   that comes first.)           |
|  slots: [ 1      ][ 2      ]   |  <- 2 x 2 on a phone, each half the column wide (4 across
|         [ 3      ][ 4      ]   |     from regular), filled in order; a filled slot shows its
|                                |     line's first word with romanization (~~ 먼저 ~~ meonjeo)
|                                |     and is read-only
|  +--------------------------+  |
|  | ~~ 그리고 밥을 먹어요. ~~    |  |  <- cards: one column at 320, full width, each at least
|  | (geurigo babeul meogeoyo)|  |     touchTarget.child tall; Korean at bodyLg, romanization
|  +--------------------------+  |     caption under it; no meaning
|  +--------------------------+  |
|  | ~~ 마지막에 공원에 가요. ~~  |  |
|  | (majimage gongwone gayo) |  |
|  +--------------------------+  |
|  [ Show meanings ]             |  <- secondary; reveals glosses for this round
|  [ Skip this one ]             |  <- ghost
|  ( Hoya bubble slot )          |
+--------------------------------+
```

Illustrated, compact: the Story Sequence card (picture 80 to 192 wide on top, then the Korean and romanization), one column at 320, two from 360. Regular (768 x 1024): cards in two columns (captions only) or up to four (illustrated), slots in one row above them, the replay picture capped at 42 % of the window height (Story Sequence rule).

Replay (after the last slot):

```
+--------------------------------+
|  (The lines, in order)         |
|  1 ~~ 먼저 일어나요. ~~          |  <- each line with romanization and its meaning;
|    (meonjeo ireonayo)          |     the line being said is marked (a bar at its side
|    (First, I get up.)          |     and the bold weight, never colour alone)
|  2 ~~ 그다음에 세수해요. ~~      |
|    (geudaeume sesuhaeyo)       |
|    (Next, I wash my face.)     |
|  3 ...  4 ...                  |
|  [ Pause ]                     |
|  [ Skip replay ]  [[ DONE ]]   |
+--------------------------------+
```

## Interaction points

- **Card that comes next**: moves into the next slot (`motion.duration.base`; at once with reduced motion), its line is said once (`playPrompt({ kind: 'sentence' })`), `answerRound(slot, firstAnswer)`.
- **Card that does not come next**: a brief nudge look on the card (amber border and the mark glyph for `motion.duration.slow`, then back), nothing moves, Hoya (`thinking`, amber) "Read the lines again. What happens first?" (later slots: "What happens next?"); with sequence words in the captions, Hoya adds "Look for words like these:" followed by the round's markers drawn as taught Korean with romanization (`~~ 먼저 ~~ (meonjeo)` · `~~ 마지막에 ~~ (majimage)`), never as bare Hangul inside the English line. Second wrong tap on one slot: the right card gets the look-here ring and "This one comes next." (the shipped `sequence.lookHere`).
- **[ Show meanings ]**: glosses appear under every card's romanization; the button changes to a quiet "Meanings shown" label (not a toggle back: the round is hinted either way).
- **Replay**: auto-advances about every 2.5 s with a visible Pause; with reduced motion nothing auto-advances and Back / Next buttons step through (the Story Sequence replay rule). **Done** ends the step.
- **[ Skip this one ]**: completes the step without recording the remaining slots.

## Fallback round when `game.story-order` is off

**Story Sequence** (`story-sequence`, shipped), derived by `storyOrderToSequence(round)`: the same cards as Story Sequence cards (picture when there is one, the text block alone when there is none, its shipped "cards without art" rule), the meaning shown as the card caption as Story Sequence does, the same slots, the same replay. Same scoring per slot. The caption-only rule does not apply to the fallback (it is a shipped game with its own rules); the memory model records the round at the read rung, not the produce rung.

## No device voice

- The round needs no sound: everything is read. Each placed line is said as an extra, and the replay says each line.
- When a line cannot be said, the **status panel** appears under the slot row (while ordering) or under the line being replayed (the A-12 rule of `audio-fallback.md` W10: one slot for the screen, it starts again with each line): "No Korean voice on this device." [ How to add a voice ], "Sound is off." [ Turn sound on ], "The sound did not play." [ Try again ]. Source `story-order`. Neutral, a polite live region; the replay keeps its pace (each line still shows for its 2.5 s).

## Navigation graph

Enter from: `quest/player` (S4-S5 `practice` or `apply`, pack levels 3 and 5) via `minigame/shell`; the lecture sentence slide (§8, CM-34 maps it)
Exit to: `quest/player` (next step) · the quest player's leave sheet

## States

- **ordering** (default), **nudge**, **look-here ring**, **meanings shown**, **replay**, **replay paused**, **skipped**.
- **empty / bad data** (fewer than 3 cards): the Story Sequence empty line "There is nothing to put in order yet." with Continue.
- **missing art** on an illustrated round: the card shows the text block alone (never a broken image).
- **no Korean voice / sound off**: as above.
- **large text (150 % and 200 %)**: cards grow; a slot's first word and romanization wrap inside the slot and the slot grows taller (never truncated, never narrower than half the column on a phone); slots that no longer fit two across stack one per row; the screen scrolls; Skip stays reachable at the end. CM-34 adds a 320 px screenshot check at 150 % text with every slot filled.
- **reduced motion**: no card travel, no flash animation (the mark and Hoya's line still show), no auto-advance in the replay.

## Accessibility

- Cards are buttons named by the Korean line and its romanization ("그리고 밥을 먹어요, geurigo babeul meogeoyo"); with meanings shown, the meaning joins the name. Their visual order is the shuffled order; their focus order is the same (WCAG 2.4.3).
- Slots are read-only text: "Place 2 of 4: 그다음에 세수해요" / "Place 3 of 4, empty" (the shipped `sequence.slotLabel`).
- Hoya's line and the status panel are polite live regions. After a card is placed, focus moves to the next card in the list (not to the slot), so the learner keeps choosing.
- The replay's current line is announced; Pause, Back and Next are buttons.

## Tokens and targets

- Cards: min height `touchTarget.child` (80), full width at 320 (48 dp floor met); `radii.lg`, `borderWidth.base`, `surface.paper`, `border.subtle`. Slots: half the column wide on a phone (2 x 2; 4 across from regular), at least `touchTarget.min` tall, growing with their text, `radii.md`, empty `borderWidth.base` dashed `border.shape`, filled `brand.secondaryLight`. Korean `bodyLg` bold; romanization `bodySm` `text.secondary`; meaning `bodySm` `text.secondary`.
- Nudge `feedback.nudge` / `nudgeLight`, success `feedback.success` / `successLight`, ring `border.focus`. Replay current line: a `spacing.xs` bar in `brand.secondary` at its side and the bold weight.

## Data needs

- reads: the `story-order` scope's rounds: `{ id, mode: 'illustrated' | 'captions', cards: [{ id, line: KoText, sceneRef? }][3..5] (in the right order), orderCue?: string }` (CM-34); overlays for the meanings (es, ko).
- logic: the shipped sequence player with a `captionMode` and the meanings switch (pure, 100 %); `storyOrderToSequence` (pure, 100 %); the `story-order-text` lint.
- writes: `answerRound(sequenceRoundKey(slot), correct)` (first answer per slot); memory items: each line's taught `lex` and `pat` items at the read rung (credit inside sentences, §4.3).
- telemetry: `minigame.finished { kind: 'story-order' | 'story-sequence', ... }`; `audio.fallback_shown { source: 'story-order', reason }`. The story-bound `story.sequence.finished` is not sent (this is not a story's sequence).

## Draft strings (CM-34 adds them with their es and ko values)

Reused: `learner.story.sequence.slotLabel`, `.lookHere`, `.emptyLine`, `.continue`, `.replay.*`, `.skip`, `progress.pill`, `audio.*`.

| Key (proposed) | en draft |
|---|---|
| `storyOrder.heading.captions` | Put the lines in order |
| `storyOrder.heading.illustrated` | Put the pictures in order |
| `storyOrder.hint` | Read each line. Tap the one that comes first. |
| `storyOrder.missFirst` | Read the lines again. What happens first? |
| `storyOrder.missNext` | Read the lines again. What happens next? |
| `storyOrder.missCue` | Look for words like these: |
| `storyOrder.showMeanings` | Show meanings |
| `storyOrder.meaningsShown` | Meanings shown |
| `storyOrder.replayTitle` | The lines, in order |
| `a11y.minigame.storyOrder.card(line, romanization)` | {line}, {romanization} |

`storyOrder.missCue` is followed by the round's markers drawn as taught Korean (`~~ 먼저 ~~ (meonjeo)`), never typed into the string.

## Open questions

1. **Drag to reorder.** Tap only, as Story Sequence (a tap path is needed for switch and screen-reader users anyway). A drag could come later as a second way, never the only one.
2. **Five cards.** The schema allows 5; at 320 five caption cards make the list long. Authoring default stays 4; CM-34 checks a 5-card round at 320 x 568 before any content uses it.
