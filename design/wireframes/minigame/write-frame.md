# Minigame/Write Frame: my own sentence from a word bank, and My page (wireframe v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7 (Write Frame, the allomorph rule, "My page", the free-entry data rule of Write Your Name q3), §3.15 behaviours 4 and 10, §5 test P-1, OD-6 (nothing kept), row **D-3** (this file), built in row **G-5** (and S7-1 for the name round's content and test) · embeds `design/wireframes/minigame/type-hangul.md` (keyboard, field, result panel) and `design/wireframes/minigame/trace-word.md` (word strip, canvas) · extends `design/wireframes/minigame/shell.md`
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-writing/` (`write-frame.md`, `mock/write-frame.html`)
Code (planned, G-5): renderer `apps/mobile/src/screens/minigames/WriteFrameGame.tsx`; round flow `apps/mobile/src/logic/write-frame/` (reducer: pick -> write -> sentence; the name round's unscored path); the allomorph helper and `composeTyped` in `packages/content-schema` (C-1); the keyboard and field of G-3; the canvas of G-4
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean with romanization and gloss, `[___]` a slot, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a `write-frame` step of a Stage 7 quest (My Day q2 and q3, My Holiday Memory q2 and q3, My Favorite Animal q3, Make & Share q3; Write Your Name q3 is the name round below)
When: the learner picks a word for the blank from a bank of words they were taught, then types or traces that word
Then: any pick is right, the particle or ending after the blank changes to fit the pick, the writing is checked against the word they picked (a near miss shows the picked word under the typed one), and the finished sentences make up "My page", which is shown once and is not kept, sent or shown to anyone else

## Screen goal

"Pick a word, write it, and read your own sentence."

## Box diagram

Phase 1, pick (320 x 568; the page scrolls, Skip at the end):

```
+--------------------------------+
| [=====-----]          (1 / 4)  |  <- shell top row: rounds = frames in the step
|  (Make your own sentence)      |  <- heading
| +----------------------------+ |
| | 저는 [_____]을/를 좋아해요.  | |  <- frame card: the Korean frame, the slot, the particle
| | (jeoneun ___eul/reul        | |     slot written with both forms until a pick fills it
| |  joahaeyo)                  | |  <- romanization line, the slot shown as ___
| | (I like ___.)               | |  <- gloss in the UI language
| +----------------------------+ |
|  (Pick a word. Any word works.)|  <- one line
|  +-------------+ +-------------+|
|  | [picture]   | | [picture]   ||  <- word bank: 2 columns at 320, 3 on regular, 4 on wide;
|  | ~~ 떡볶이 ~~ | | ~~ 김밥 ~~   ||     each card: WordArt picture when the word has one,
|  | (tteokbokki)| | (gimbap)    ||     the Korean, romanization, gloss; at least
|  | (spicy rice | | (gimbap)    ||     touchTarget.child tall
|  |  cakes)     | |             ||
|  +-------------+ +-------------+|
|  +-------------+ +-------------+|
|  | ~~ 라면 ~~  | | ~~ 비빔밥 ~~ ||
|  +-------------+ +-------------+|
|  [ Skip ]                      |
+--------------------------------+
```

Phase 2, write (after the pick; the frame shrinks to one line, the keyboard or the canvas takes the rest):

```
type (the field IS the slot)              trace (the canvas of Trace a Word)
+--------------------------------+        +--------------------------------+
| (1/4) [ Change word ]  [ Skip ]|        | [=====-----]          (1 / 4)  |
| 저는 [떡볶이]를 좋아해요.        |        | 저는 [떡볶이]를 좋아해요.        |
|                                |        |   [ Change word ]              |
| +----------------------+ +----+|        |   [ 떡 ] [ 볶 ] [ 이 ]           |  <- word strip
| | 떡보|                | |Done||        |  +------------------------+     |
| +----------------------+ +----+|        |  |   (ghost of 떡)        |     |
|+------------------------------+|        |  +------------------------+     |
||  (keyboard, split, 6 rows)   ||        |  [ Show me ] [ Clear ]         |
||                              ||        |  ( Hoya strip )                |
|+------------------------------+|        |  [[ Done ]]      [ Skip ]      |
+--------------------------------+        +--------------------------------+
```

- Type, below `layout.compactHeight`: the count pill, [ Change word ] and [ Skip ] share the top row (as in Type Hangul), then the one-line frame, the answer row and the keyboard (64 + 30 + 72 + 393 at 320 x 568). From 640 tall the round bar row comes back.
- The one-line frame shows the picked word in the slot as a ghost to write over (type) or the word strip (trace); the particle after the slot is **already the right form** for the pick (를 after 떡볶이, a vowel; 을 after 김밥, a final consonant), computed by the allomorph helper from the picked word's last block. The learner never chooses the particle; it is drawn as part of the frame, not as a slot.
- [ Change word ] goes back to phase 1 with the pick kept selected; it is there until the first Done of the round.
- A two-slot frame (`___에 ___을/를 먹었어요`): pick and write slot 1, then pick and write slot 2; the top row counts frames, not slots; the frame card marks which slot is current (thick border on that slot).

Phase 3, the finished sentence (after the writing passes, or after Fix it and a pass):

```
+--------------------------------+
| +----------------------------+ |
| | 저는 떡볶이를 좋아해요.      | |  <- the whole sentence, the learner's word in place,
| | (jeoneun tteokbokkireul     | |     the particle fitted, the sentence mark
| |  joahaeyo)                  | |  <- romanization of the finished sentence (converter)
| | (I like spicy rice cakes.)  | |  <- gloss: the frame's gloss with the pick's gloss
| +----------------------------+ |
|  (Hoya cheering: You wrote a   |
|   sentence!)                   |
|   auto-advance to the next frame after the pass pause
+--------------------------------+
```

Closing panel, **My page** (after the last frame of the step; the step's own last screen):

```
+--------------------------------+
|        [Hoya cheering]         |
|  (My page)                     |  <- title
|  +--------------------------+  |
|  | 저는 떡볶이를 좋아해요.    |  |  <- every sentence written in this step, in order,
|  | (jeoneun tteokbokkireul  |  |     each with romanization and gloss
|  |  joahaeyo)               |  |
|  | (I like spicy rice cakes.)|  |
|  |                          |  |
|  | 아침에 빵을 먹어요.        |  |
|  | (achime ppangeul meogeoyo)|  |
|  | (In the morning I eat     |  |
|  |  bread.)                  |  |
|  +--------------------------+  |
|  (This page is just for now.   |  <- one quiet line: it is not saved
|   It is not saved.)            |
|  [[ Continue ]]                |  -> markStepComplete, onFinish: the page is gone
+--------------------------------+
```

- No share, save, print, export or copy control; no "send to a grown-up"; the page is not a card, a screenshot or a thumbnail the app saves. Make & Share's "share" means showing the screen to someone next to you (spec §3.7).
- **Where My page sits.** The spec places My page on the quest's reward step. The reward step is a different screen, two steps later (Check comes between), and the data rule keeps the name in the round component's own state, so the design draws My page as the **closing panel of the Write Frame step**, in the reward look (Hoya cheering, title, Continue), and the quest's reward step is unchanged. Nothing has to leave the renderer. See open question 1.

### The name round (Write Your Name q3, free entry, unscored)

```
+--------------------------------+
| [==========] (1 / 1)  [ Skip ] |
|  (Write your name in Hangul)   |
|  제 이름은 [호야]예요.           |  <- the frame; the ending follows the last block live:
|  (je ireumeun hoyayeyo)        |     예요 after a vowel, 이에요 after a final consonant
|  (There is no wrong way to     |  <- Hoya line (idle), always shown
|   write your name.)            |
| +----------------------+ +----+|
| | 호야|                | |Done||  <- the field; Done is on as soon as one block exists
| +----------------------+ +----+|
|  ( Blocks | Keyboard )         |  <- SectionTabs: two ways to build the same field
|+------------------------------+|
|| (Sounds)                 Del ||  <- Blocks: the short sound table of S7-1 as tiles,
|| [아 a][에 e][이 i][오 o][우 u]||     grouped by sound; a tile adds its block to the name;
|| [마 ma][나 na][라 ra][사 sa]..||     a final tile (ㄴ n, ㄹ l, ㅁ m, ㅇ ng) adds a final to
|| (At the end)                 ||     the last block; the panel scrolls inside its height;
|| [ㄴ n][ㄹ l][ㅁ m][ㅇ ng]     ||     Del removes the last letter, as on the keyboard
|+------------------------------+|
+--------------------------------+
```

- **Blocks** and **Keyboard** edit the same field through `composeTyped`; switching tabs keeps the field. The panel has the keyboard's height, so switching does not move the field. Blocks is the first tab: a learner can write a name without knowing the keyboard.
- **Unscored**: Done accepts any name with at least one block; no compare panel, no nudge, no "near miss". The finished sentence and My page follow as for the other frames. Nothing about the round reaches progress except the quest completion.
- **Length**: up to 8 blocks (the frame stays on one line at 320); a ninth block is not added and the field's helper line says the name is at its longest (draft below).
- **The data rule** (spec §3.7, test P-1): the name exists only in this renderer's React state. It is never written to a zustand store, a `persist` slice, the quest-run store, the quest-state snapshot, a storage key, navigation params or the URL; it is excluded from telemetry payloads, breadcrumbs and logs; it is cleared when the renderer unmounts (Continue, Skip, the quest's quit, the app going to the background and being killed). My page renders it from that same state, with no cache.
- **Grown-up preview** (F-BROWSE-001): the field is prefilled with the cast name 호야 and the round plays as for a learner with that name; the preview never shows or keeps an entry. **Screenshots and e2e** use 호야 only, never a real name.

## Interaction points

- **Word card tap** (phase 1) -> the pick; the slot and the particle update at once; phase 2 opens. Any pick is accepted: no wrong look on a card, ever.
- **Type part**: the keyboard, field, Done and the result panel of Type Hangul, checked against the **picked** word. A near miss shows "You typed / The word" with the picked word; [[ Fix it ]] as there.
- **Trace part**: the word strip and canvas of Trace a Word, blocks of the picked word.
- **Scoring** (word-bank frames): the write part scores on its first Done, as in Type Hangul or Trace a Word; the pick itself is never scored. The name round is unscored (`answerRound` is not called for it).
- **[ Change word ]** -> phase 1, until the first Done.
- **[ Skip ]** -> `markStepComplete()` + `onFinish()`; My page is not shown and the state is cleared.
- **[[ Continue ]]** on My page -> `markStepComplete()` + `onFinish()`.
- **SectionTabs** (name round) -> Blocks or Keyboard; the field keeps its text.

## Navigation graph

Enter from: `quest/player` via `minigame/shell` (play step `write-frame`).
Exit to: `quest/player` (via goBack) after My page or Skip. The quest's own reward step (`quest/player`, narrative) and then `results/celebrate` follow unchanged; neither shows the learner's sentences.

## States

- **pick** / **write (type)** / **write (trace)** / **sentence done** / **My page**: as drawn.
- **near miss** (type part): the Type Hangul result panel with the picked word.
- **two slots**: the current slot marked; the sentence-done panel only after the last slot.
- **name round**: Blocks (default) and Keyboard tabs; empty field: Done disabled, the field shows its placeholder; at 8 blocks: the helper line.
- **word without a picture**: the card shows the Korean, romanization and gloss only (spec §9 assumption 4); the card keeps its size.
- **no rounds** / **error**: the shell's states.
- **large text (200 %)**: phase 1 scrolls; in phase 2 the frame line wraps and the part above the keyboard scrolls; the field and keyboard stay.
- **reduced motion**: the particle swaps without animation; panels appear without a slide.

## Accessibility

- The frame card is one element whose label reads the frame with the blank said as "blank" and both particle forms ("저는, blank, 을 or 를, 좋아해요. I like blank."); after a pick it reads the sentence with the pick and the fitted particle.
- Word cards are buttons named by the Korean, the romanization and the gloss; the picked card has the selected state.
- The particle change is announced politely after a pick ("를 after 떡볶이"), so a screen-reader user hears why the ending changed.
- Keyboard, field and result panel: Type Hangul's accessibility; canvas: Trace a Word's.
- My page takes focus when it opens and is read top to bottom; Continue is last.
- Name round: the tiles are buttons named by the block and its sound ("마, ma"); the field reads the name after each block and its romanization; the name is never read into a log or telemetry by the accessibility layer either (it lives in the view, not in an analytics label).

## Data needs

- reads: the `write-frame` scope's rounds (C-1 round schema): per round `{ frame: { ko with slot markers and explicit particle slots (___을/를, ___이에요/예요, ___에), romanization with ___, en with ___ }, slots: [{ bank: wordRef[], write: 'type' | 'trace' }] }`; the name round `{ kind: 'name', frame, soundTable }` (S7-1 content); words from the lesson and vocabulary data (KoText, `pictureRef`).
- logic: the allomorph helper `fitParticle(word, slotForms)` (C-1); `composeTyped` (C-1); the converter for the finished sentence's romanization (`packages/content-schema` romanization); the write-frame reducer (G-5, 100 %).
- writes: `answerRound` for the write part of word-bank frames only; `markStepComplete`. Picks, typed text, the name and the sentences stay in the renderer's React state and are cleared on unmount (P-1).
- telemetry: none new; `minigame.finished` `{ kind, questId, stepIndex }` only (no pick, no text, no count of blocks of a name).

## Draft strings (G-5 adds them with their es and ko values)

Reused: the Type Hangul and Trace a Word strings, `skip.cta`, `progress.pill`, `common` Continue.

| Key (proposed) | en draft |
|---|---|
| `learner.minigame.writeFrame.heading` | Make your own sentence |
| `learner.minigame.writeFrame.pick` | Pick a word. Any word works. |
| `learner.minigame.writeFrame.changeWord.cta` | Change word |
| `learner.minigame.writeFrame.sentenceDone` | You wrote a sentence! |
| `learner.minigame.writeFrame.myPage.title` | My page |
| `learner.minigame.writeFrame.myPage.notKept` | This page is just for now. It is not saved. |
| `learner.minigame.writeFrame.name.heading` | Write your name in Hangul |
| `learner.minigame.writeFrame.name.noWrong` | There is no wrong way to write your name. |
| `learner.minigame.writeFrame.name.tabs.blocks` | Blocks |
| `learner.minigame.writeFrame.name.tabs.keyboard` | Keyboard |
| `learner.minigame.writeFrame.name.sounds` | Sounds |
| `learner.minigame.writeFrame.name.atTheEnd` | At the end |
| `learner.minigame.writeFrame.name.longest` | That is the longest name that fits here. |
| `a11y.minigame.frameBlank` | blank |
| `a11y.minigame.particleFits(particle, word)` | {particle} after {word} |

## Open questions

1. **My page placement (needs a one-line spec wording change).** Spec §3.7 says "shown on the reward step"; this design shows it as the Write Frame step's closing panel, because the reward step comes after the Check and the name may not leave the renderer's state. G-5 writes the wording change into the spec with its PR ("shown at the end of the Write Frame step, in the reward look"), unless the owner prefers the reward step and accepts holding the page in the quest player's own React state (still component state, never a store).
2. **Sound table content** is S7-1's: which sounds, how many tiles, and the loanword spelling note. The design fixes only the panel: grouped tiles, one Del, the keyboard's height.
3. **Make & Share q3** writes three steps in order, two joined with -고: a three-slot frame drawn as three one-slot sentences, the -고 form shown in place like a particle (the helper's job). If S7-5 needs a different frame shape, it adds a board to the mock.
