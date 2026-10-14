# Minigame/Sentence Builder: word tiles in order, particle choice, the Stage 7 Check (wireframe v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.4 (Stage 3 practice), §3.7 (Stage 7 Build and Check), §3.11 (the `order-it` Check rule and skills), §3.14 (accessibility), §3.15 behaviour 3, PR **D-1** (this file), built by **G-1** · extends `design/wireframes/minigame/shell.md` and `families.md` (Family Construction) · the round lifecycle of `minigame/build-letter.md` and the tap-the-next-one rule of `story/sequence.md` · Check frame: `quest/check.md` · audio states: `minigame/audio-fallback.md`
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder, the drafts are in `design/screens/minigame-sentence-builder/v1/spec.md`.
Mock: `design/screens/minigame-sentence-builder/v1/` (HTML on tokens, shots at 320 px and tablet).
Code (G-1, to build): `apps/mobile/src/screens/minigames/SentenceBuilderGame.tsx` (paint) · pure rules in `apps/mobile/src/logic/sentence-builder/` (`reducer`, `scoring`, `progression`, `view`; 100 % covered) · kind `order-it` (`MinigameKindSchema`, existing member, no renderer until G-1) · round schema `OrderItRoundSchema` (C-1)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean drawn with `KoreanText` (Korean + romanization), `{ x }` content-driven, `[ n ]` an empty slot, `[+n]` an attached (particle) slot, `( ) (*)` fill-only dots, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Stage 3 quest's practice step, a Stage 7 build round, or a Stage 7 Check (`order-it` scope)
When: the learner reads (or hears) what the sentence means and taps the word tiles in the order the Korean sentence puts them, choosing the right particle where a round asks for one
Then: each right tile joins the sentence line, a wrong tile slides back with the amber nudge and a hint that explains Korean word order (never "wrong"), the round scores on its first try only, and the finished sentence is heard once with its romanization and meaning

## Screen goal

"Put the Korean words in order to say this."

One primary action at a time: the next tile is the target (no button while building). There is no Check / Submit button: like Story Order, each tap is answered at once, so a slip of the finger is a retry, not a lost round (decision in "Decisions" below).

## Where it is used

| Use | Step | Rounds | Header | Skip | Spec |
|---|---|---|---|---|---|
| Stage 3 practice | `practice` | 5 | round bar + `n / N` pill | yes (construction game, `shell.md`) | §3.1 rule 2, §3.4 |
| Stage 7 Build | `practice` or `apply` | 4 (practice) / 3-4 (apply) | round bar + `n / N` pill | yes | §3.7 item 1 |
| Stage 7 Check | `check` | exactly 2 | Check's 2 fill-only dots + "(Quick check)" pill, as `quest/check.md` | **no** | §3.7, §3.11 |

## Box diagram

### A. Order round, start (phone, 320 to 599 dp; stacked)

```
+----------------------------------+
| [=====------]          [2 / 5]   |  <- shell header (Check: ( ) (*) + "Quick check")
|                                  |
|  (Build the sentence)            |  <- heading, 1 line
|  (Tap the words in order.)       |  <- instruction, 1 line
|                                  |
|  +----------------------------+  |
|  | {picture}  (Meaning)       |  |  <- meaning card: optional picture (decorative),
|  |            "(I eat rice.)" |  |     the sentence's gloss in the UI language
|  |  [ (speaker) Hear it ]     |  |  <- plays the whole target sentence; unlimited
|  +----------------------------+  |
|                                  |
|   [ 1      ]  [ 2         ]      |  <- the sentence line: one slot per word (어절),
|                                  |     left to right, wraps at a slot boundary
|  - - - - - - - - - - - - - - -   |
|  +--------+ +--------+ +------+  |  <- the tray: tiles in a deranged order
|  |~~먹어요~~| |~~밥을~~ | |~~물을~~|  |     (never already in the right order)
|  |meogeoyo| | babeul | |mureul|  |  <- romanization under the Korean (romanizationMode)
|  +--------+ +--------+ +------+  |     at most 1 extra tile (a taught word)
|                                  |
|  ( Hoya bubble slot )            |  <- empty until a miss
|  [ Skip ]                        |  <- not in the Check
+----------------------------------+
```

- **Slots** are dashed boxes in reading order. Every empty slot of a round has the same width (that of the round's longest tile), so no width gives a tile away; a filled slot takes the width of its tile, so the finished line looks like the sentence. The next slot to fill carries the focus outline; the others are dashed only. The place number is given to a screen reader only.
- **Tiles** are at least `touchTarget.min` tall and wide, tap only (no drag: a tap path is needed for screen-reader and switch users anyway, the `story/sequence.md` rule). They wrap onto as many rows as they need; the tray never scrolls sideways.
- **Romanization** on a tile follows the learner's `romanizationMode`, as Listen & Pick options do: shown under the Korean in `always` (the default), left off in `tap` (the tile's accessible name still carries it). Tiles show no gloss: the meaning card is the sentence's meaning.
- **The meaning card** never shows the Korean target. In the Korean UI its line is the lesson overlay's Korean gloss, which the translation review writes as a description that does not echo the target (`overlay-circular-gloss`, F-CURR-001 §3.8 pass 6; see Open questions 1).

### B. Order round, one tile placed, a miss on the next slot

```
+----------------------------------+
|   +--------+  [ 2         ]      |  <- 밥을 placed in slot 1 (right look: the tile
|   |~~밥을~~ |                      |     moved, a small check glyph, no colour alone)
|   +--------+                     |
|  - - - - - - - - - - - - - - -   |
|  +--------+           +------+   |  <- 물을 was tapped for slot 2: it slid to the slot,
|  |~~먹어요~~|           |~~물을~~|   |     paused, slid back; it is marked "tried" (amber
|  +--------+           +------+   |     outline + small dot glyph) and stays tappable
|                                  |
|  (Hoya, thinking)                |
|  "(Not that one yet. Try         |  <- the miss line
|    another word.)"               |
+----------------------------------+
```

- A placed tile is never taken back by the game: right tiles stay placed. The learner cannot remove a placed tile either (each placement was checked when it was made, so there is nothing to undo).
- **Hint lines** (pure rule, `logic/sentence-builder/view.ts`):
  - the tapped tile is the sentence's last word (the verb or describing word, Korean is predicate-final) and the slot is not the last one: "(In Korean, the doing or describing word comes last.)";
  - a particle slot (round C): "(Look at how the word before it ends.)" plus the pattern note of this quest's Discover page (content, `noteEn` with its `{ko:}` tokens), so the rule is shown again where it is needed;
  - any other miss: "(Not that one yet. Try another word.)".
- **Second miss on the same slot**: the right tile gets the "look here" ring (as Listen & Pick and Story Order) and Hoya says "(This one comes next.)". The ring also shows in the Check: the round is already scored, and the ring keeps a learner from getting stuck.

### C. Particle round (Stage 3: 이 / 가, 을 / 를)

```
+----------------------------------+
|  (Build the sentence)            |
|  (Tap the piece that fits.)      |  <- instruction for a round whose only open slot
|                                  |     is a particle
|  +----------------------------+  |
|  | {picture}  "(There is a    |  |
|  |             book.)"        |  |
|  |  [ (speaker) Hear it ]     |  |
|  +----------------------------+  |
|                                  |
|   +------+[+2 ]  +--------+      |  <- 책 is given (fixed, drawn as a placed tile
|   |~~책~~ |       |~~있어요~~|      |     with no check glyph), the attached slot [+2]
|   +------+       +--------+      |     sits against it with no space: it joins the
|                                  |     word before it
|  - - - - - - - - - - - - - - -   |
|      +------+    +------+        |
|      |~~이~~ |    |~~가~~ |        |  <- the two forms, in a random order
|      |  i   |    |  ga  |        |
|      +------+    +------+        |
+----------------------------------+

Right pick:
|   +-----------+  +--------+      |  <- the word and its particle become one tile
|   | ~~책이~~   |  |~~있어요~~|      |     with the romanization of the joined word
|   |  chaegi   |  |isseoyo |      |     (책 chaek + 이 i is said chaegi: the final
|   +-----------+  +--------+      |     moves on), from content, never computed
```

- A round may mix A and C: a particle slot is one more slot of the line, filled in reading order, and its tray holds both forms (one of them is the round's one extra tile).
- After a right particle the joined word shows the romanization of the whole word (`chaegi`), not `chaek` + `i`, because the final consonant moves on when a vowel follows (Word Builder q5's rule). The round data carries it (Data needs).

### D. Round complete

```
+----------------------------------+
|   +-----------+  +--------+      |  <- the line in the right look (success fill and
|   | ~~밥을~~   |  |~~먹어요~~|  (v) |     a check glyph); the tray is gone
|   +-----------+  +--------+      |
|   (babeul meogeoyo)              |  <- the sentence's romanization (always shown here)
|   "(I eat rice.)"                |  <- and its meaning
+----------------------------------+
```

- The sentence plays once (`playPrompt`, `kind: 'sentence'`), then the next round starts after the line is heard in full (`afterReply`, as Tap to Respond), or after `motion.duration.crawl` when there is no sound. The last round ends the step.

### E. Stage 7 Check (2 rounds)

```
+----------------------------------+
| ( ) (*)        (Quick check)     |  <- the Check frame (quest/check.md), no Skip
|  (Build the sentence)            |
|  +----------------------------+  |
|  | "(I like tteokguk.)"       |  |
|  |  [ (speaker) Hear it ]     |  |
|  +----------------------------+  |
|   [ 1     ] [ 2         ] [ 3       ]   <- three words wrap to two lines at 320
|  +-------+ +----------+ +--------+ |
|  |~~좋아해요~~| |~~저는~~ | |~~떡국을~~ |
|  +-------+ +----------+ +--------+ |
+----------------------------------+
```

- Same game, same rules; only the frame changes (dots, title, no Skip). Two rounds, each scored on its first try.

### F. Tablet (regular and wide, 600 dp and up)

```
+------------------------------------------------------------+
|        [==========---------------]              [2 / 5]    |
|        (Build the sentence)                                |
|        +----------------------------------------------+    |
|        | {picture}  (Meaning) "(I eat rice.)"         |    |  <- the meaning card lays out in
|        |            [ (speaker) Hear it ]             |    |     one row (picture beside the words)
|        +----------------------------------------------+    |
|          [ 1           ]   [ 2               ]             |  <- the line on one row
|        - - - - - - - - - - - - - - - - - - - - - - - -     |
|          [~~먹어요~~]   [~~밥을~~]   [~~물을~~]              |
|        ( Hoya bubble slot )                [ Skip ]        |
+------------------------------------------------------------+
```

- **Stacked at every width**, centred in the reading column (`layout.maxWidth.reading`). The game opts out of the side-by-side arrangement (`gameArrangement`): the sentence line must read left to right across one column, and half a column would wrap a three-word sentence. Tiles keep `touchTarget` sizes and get `layout.mediaScale` like the other games.
- Landscape phone (short window): the same stacked layout; the body scrolls and the tray stays below the line.

## Interaction points

| Where | Gesture | Result |
|---|---|---|
| Hear it (meaning card) | tap | plays the target sentence (`playPrompt`, `kind: 'sentence'`); unlimited; never autoplays (reading is the task, sound is a help) |
| Tile, right for the next slot | tap | slides into the slot (`motion.duration.base`, `easing.standard`), light haptic; when it fills the last slot: success haptic, D, and `answerRound(round, true)` if the round had no miss |
| Tile, wrong for the next slot | tap | slides to the slot, waits `motion.duration.fast`, slides back; nudge haptic; marked "tried"; Hoya thinking + hint; the round's first miss records `answerRound(round, false)` once; later misses are retries (`retryCount`) |
| Tile marked "tried" | tap | still tappable (a tile that was wrong for slot 2 may be right for slot 3); the mark clears when a slot is filled |
| Placed tile / fixed tile / slot | none | read-only (accessible name: "(Place 1 of 2: 밥을, babeul)") |
| Skip | tap | `markStepComplete` + `onFinish` without recording the rounds left (not in the Check) |

- Only the first touch in a 50 ms window counts (as Listen & Pick); taps during a slide are ignored.
- **Scoring**: a round is right first time when its sentence was built without a miss. One miss marks the round missed (the F-001 §3.2 "first answer only" rule applied to a whole sentence: the first wrong tile is the round's first answer). Nothing is taken away; the bar only fills.

## Navigation graph

Enter from: `quest/player` (a `practice`, `apply` or, for a `stage7` quest, `check` step with an `order-it` scope) via `minigame/shell`; the Check enters through the "(Two quick ones)" launcher of `quest/check.md`
Exit to: `quest/player` (step complete, via `goBack`) · empty scope -> `quest/player` (Back to quest) · leave: the quest player's own leave sheet (this screen adds none)

## States

- **success**: A, B, C, D per round; the last round returns to the player.
- **empty**: a scope with no valid round (no tiles, or an answer that is not in the tray): one line "(Nothing to play here)" and [ Back to quest ]; the content test (U-7) keeps it out of shipped data.
- **error**: a picture ref that does not resolve: the meaning card shows the words alone (never a broken image) · audio fails, no Korean voice or sound off: Hear it shows the status line of `audio-fallback.md` (the `PromptPanel` "status" variant, as Tap to Respond: "(Sound is off.)" with its "(Turn sound on)" action). The "(No sound? Read it here.)" text fallback is **not** used in this game, because the text it reveals is the answer; the meaning card already carries the round, so the round never depends on sound. Round complete D shows the sentence as text with its romanization; nothing blocks.
- **offline**: all content is bundled; no network.
- **reduced motion**: no slide; a right tile appears in its slot, a wrong tile stays in the tray with the amber "tried" mark and the hint; no ring pulse.
- **large text (200 %) / 320 px**: slots and tiles wrap onto more rows, the body scrolls, Skip stays reachable at the end of the page; a long word never breaks inside itself (`word-break: keep-all` on web, one tile is one unbreakable word).
- **screen reader**: the tray is a list of buttons named by `KoreanText`'s accessible name (Korean, spaced romanization); a placement is announced ("(Place 1 of 2: 밥을)"); a miss announces the hint (polite live region); the completed sentence is announced with its romanization and meaning.
- **anti-shame**: amber + Hoya `thinking` on a miss, never red; no per-question timer; no count of misses shown; the bar fills only.

## Data needs

- reads: `scopeFor(ref)` -> `orderIt.rounds[]` (C-1 `OrderItRoundSchema`), proposed shape:
  - `meaning`: the sentence gloss (`en` in the cell, `es` / `ko` from the lesson overlay) and optional `picture` (`PictureRefSchema`);
  - `sentence`: `KoText` of the whole sentence (audio, romanization for D);
  - `words[]` in the right order: each `{ ko, romanization, fixed?: boolean, attachesToPrevious?: boolean }`, an attached word being a particle slot; a word that is joined with its particle also carries `joined: { ko, romanization }` (책이, chaegi) for the right look of C;
  - `extra?`: at most one extra tile `{ ko, romanization }` (a taught word or the other particle form);
  - `noteRef?`: the Discover pattern whose note the particle hint shows again.
  `romanizationMode` (F-I18N-001); `layoutClass` (F-LAYOUT-001).
- writes: `quest-run-store.answerRound(roundIdx, correct)` once per round (first try), retries counted; `markStepComplete` at the end or on Skip.
- telemetry: `minigame.finished { kind: 'order-it', questId, stepIndex }` (existing event; no new name, §3.11). No Korean text in any payload.
- skills: `order-it` -> read, write (§3.11, OD-5; G-1 changes the map and pins `TILE_KINDS`).

## Decisions taken in this design pass

1. **Each tap is answered at once; no Done button.** Story Order and §3.15 behaviour 3 ("the tile slides back") already answer each tap. A Done button would score a whole line that one stray tap spoiled; answering each tap keeps the round scored on the first real mistake and lets every other tap teach.
2. **A placed tile stays placed.** Since each placement is checked, removing a tile would only undo a right answer.
3. **The verb-last hint** is the one grammar hint the game adds by itself; any other rule comes from the quest's own Discover note, so the game never teaches something Discover did not show.
4. **No romanization of the target before it is built.** Hear it plays the sentence, but the sentence's romanization appears only in D; showing it while building would turn reading into matching Latin letters.
5. **Stacked at every width** (F above).

## Open questions

1. **Meaning line in the Korean UI.** A learner using the Korean UI reads the target language already; the meaning card's Korean gloss can make ordering easy. Default: keep it (the round still asks the learner to read the tiles and the overlay gloss never echoes the target); the language review of each Stage 3 cell checks the ko glosses of order rounds for give-aways. Alternative: show the picture and Hear it only in the Korean UI.
2. **Extra tiles in Stage 7.** §3.7 asks for 2-3 sentence pieces; default at most one extra tile at every stage, so a 3-word round has 4 tiles. Alternative: none in the Check.
3. **Tile sound.** A tile could play its own word on a long press. Default: no (long press is not discoverable and a tap places the tile); Hear it plays the whole sentence.
