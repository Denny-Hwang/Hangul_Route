# Minigame/Cloze Pick: read a sentence, pick what fills the gap (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F1 (`cloze-pick`, S2-S7, also as a Check; fallback Listen & Pick with a text prompt), §4.3 (produce rung of `pat` and `rea` items: "Cloze Pick on a sentence that states the value"), §4.5 (review sessions), §7.7 (anti-shame), §8 (lecture: the existing question slide), §12.2 (`game.cloze-pick`), row **CM-D2** (this file), built in row **CM-30** · extends `design/wireframes/minigame/shell.md` (layout A) and reuses the Listen & Pick option cards of `listen-pick.md` · audio states: `audio-fallback.md` W9 and W11
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-variety/` (`mock/cloze-pick.html`, `mock/states.html` board C; shots at 320 and 768)
Code (planned, CM-30): renderer `apps/mobile/src/screens/minigames/ClozePickGame.tsx`; pure rules `apps/mobile/src/logic/cloze-pick/` (round view, reducer, scoring); round schema `ClozePickRoundSchema` and `clozeToListenPick` in `packages/content-schema`; option card `design/components/ChoiceCard`, taught Korean `design/components/KoreanText`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization (`KoreanText`), `[___]` the gap, `{ x }` content-driven, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Stage 2-7 quest step, a Check, a pack level or a review item at the produce rung of a `pat`, `lex` or `rea` item
When: the learner reads a Korean sentence with one gap and taps the tile (a word, a particle or an ending) that fits
Then: the tile drops into the gap, the whole sentence is shown and said once, and the next round opens; a tile that does not fit only nudges ("Read the sentence again"), and the learner tries again

## Screen goal

"Read the sentence and pick what fills the gap."

## Round shape

- **One sentence, one gap, 3 or 4 tiles.** The gap is one taught unit: a word (`책을 [___].` with 읽어요 / 먹어요 / 마셔요), a particle (`물[___] 마셔요.` with 을 / 를 / 이) or a value read from a realia card (`[___] 원이에요.`, the `rea` produce rung of §4.3).
- **The prompt card**: the Korean sentence with the gap drawn as a slot, its romanization with the gap as `___`, and its meaning in the UI language. The meaning is the full sentence, so a word gap asks "which Korean word says this", a recall from meaning (the produce rung). For a `rea` gap the meaning keeps the gap (`It is ___ won.`), because the value must be read from the card above it. A particle gap's meaning is the full sentence; the meaning does not choose between 을 and 를, so the round still reads the word before the gap.
- **No sentence sound before the answer.** The sentence is not said while the gap is open, because hearing it would answer the round. After the right tile, the whole sentence is said once and **Hear it** stays for replays. This makes Cloze Pick a reading round; its listening partner is Listen & Pick.
- **Tiles** show the Korean and its romanization (a particle tile shows `을` `eul`). Tiles carry no gloss: the gloss would answer a word gap.
- **Rounds per step**: 3 to 5 (shell rule). As a Check, the step's rounds follow the Check rotation of §7.1 (no kind above 40% of a stage's Checks).
- **Realia gap** (S6, packs): the realia card of `realia-read.md` sits above the prompt card (side by side from window class 700, as Realia Read), and the value tiles are written the way the card writes them (`3,000` read `samcheon`).

## Box diagram

Compact (320 x 568, layout A of the shell):

```
+--------------------------------+
| [=====-----]          (2 / 4)  |  <- shell top row
|  (Fill the gap)                |  <- heading
| +----------------------------+ |
| |  책을 [_____].              | |  <- prompt card: Korean with the gap slot
| |  (chaegeul ___.)            | |  <- romanization, the gap as ___
| |  (I read a book.)           | |  <- meaning in the UI language
| +----------------------------+ |
|  (Pick the word that fits.)    |  <- instruction (particle gap: "Pick the piece that fits.")
|  +-------------------------+   |
|  |  ~~ 읽어요 ~~  (ilgeoyo) |   |  <- tiles: one column at 320 when a tile is a word,
|  +-------------------------+   |     two columns for one- or two-block tiles (particles);
|  +-------------------------+   |     each tile >= touchTarget.min tall, full width
|  |  ~~ 먹어요 ~~ (meogeoyo) |   |
|  +-------------------------+   |
|  +-------------------------+   |
|  |  ~~ 마셔요 ~~ (masyeoyo) |   |
|  +-------------------------+   |
|  ( Hoya bubble slot )          |  <- empty until a miss
+--------------------------------+
```

After the right tile (the same screen, nothing moves):

```
| +----------------------------+ |
| |  책을 [읽어요]. (check)      | |  <- the gap takes the tile, success look + check glyph
| |  (chaegeul ilgeoyo.)       | |  <- romanization completes
| |  (I read a book.)          | |
| |  [ (speaker) Hear it ]     | |  <- appears now; the sentence was said once
| +----------------------------+ |
|  tiles: the picked tile in the success look; the others quiet    |
|  auto-advance after the shell's pause (no Next button)           |
```

Regular (768 x 1024): the same column in the reading width; the prompt card text at `title` size; tiles in two columns when every tile fits one line at `prompt` size, else one column. The Hoya slot sits under the tiles. With a realia card, the card and the prompt sit side by side from window class 700.

## Interaction points

- **Tile, right**: the tile's text moves into the gap (a short slide of `motion.duration.base`; none with reduced motion), the gap takes the success look with the check glyph, the sentence is said through `playPrompt({ kind: 'sentence' })`, `answerRound(roundIdx, firstAnswer)`, auto-advance after the shell's pause.
- **Tile, does not fit**: the tile takes the nudge look with the mark glyph and stays locked; the gap stays empty; Hoya (`thinking`, amber) says one line: word gap "Read the sentence again. Which one fits?"; particle gap the Sentence Builder line "Look at how the word before it ends."; realia gap "Look at the card again.". The first answer scores; later taps are retries.
- **Second miss on a round**: the right tile gets the look-here ring and Hoya "This one fits here." (not inside a review session: CM-D1 decides there).
- **Hear it** (after the right tile): replays the sentence; unlimited.
- **No Skip** (a recognition round, shell rule). The quest player's own leave control is the way out.

## Fallback round when `game.cloze-pick` is off

Rendered by the shipped Listen & Pick renderer in its **text prompt** mode, derived by `clozeToListenPick(round)`:

```
+--------------------------------+
| [=====-----]          (2 / 4)  |
|  (Fill the gap)                |  <- the Cloze heading is passed in (not "Listen, then pick")
| +----------------------------+ |
| |  ~~ 책을 ___. ~~            | |  <- Listen & Pick's prompt zone in its text form (the layout
| |  (chaegeul ___.)           | |     of its "no sound" state without the "No sound?" line):
| |  (I read a book.)          | |     the sentence with ___, romanization, meaning
| +----------------------------+ |
|  [ ~~ 읽어요 ~~ ] [ ~~ 먹어요 ~~ ] |  <- the same tiles as Listen & Pick option cards
|  [ ~~ 마셔요 ~~ ]                |
+--------------------------------+
```

- Same options, same answer, same scoring; the gap does not animate (the option card takes the success look, as in Listen & Pick), and the completed sentence is said once on the right answer.
- CM-30 adds the text prompt mode to Listen & Pick (`promptMode: 'text'`: no speaker before the answer, the prompt drawn as text with an optional heading override). The mode is additive; existing Listen & Pick rounds are unchanged.
- **The fallback runs on new code, so it is tested as a rescue, not only as a screen** (this fallback and Match Shape's Read Pick both render through `promptMode: 'text'`). CM-30 (or CM-33, whichever adds the mode) gives the mode its own unit tests (the view with and without a heading override, the answer flow, the no-speaker rule) and keeps every existing Listen & Pick snapshot and test unchanged when the mode is added (no snapshot update in that PR). The switch-off content test (spec §14) renders **and answers** at least one fallback round per quest in Playwright with `game.cloze-pick` off (and with `game.match-shape` off in CM-33): it takes the right tap and reaches the next round, so turning the switch off is known to rescue the quest.

## No device voice

- Before the answer nothing needs sound, so the round opens the same with or without a voice.
- After the right tile the sentence is said once; when it cannot be (no Korean voice, sound off, blocked, failed), the **status panel** of `audio-fallback.md` W9 appears under the prompt card (the Korean is already printed): "(No Korean voice on this device.)" with [ How to add a voice ], "(Sound is off.)" with [ Turn sound on ], or "(The sound did not play.)" with [ Try again ]. It is neutral (never amber, never red), a polite live region, source `cloze-pick`, and it does not hold up the auto-advance.

## Navigation graph

Enter from: `quest/player` (a `practice`, `apply` or `check` step with a `cloze-pick` scope) via `minigame/shell`; a review session item (Daily Review, Cell Check, Stage Check, Pack Check, row CM-13) at the produce rung; the lecture question slide (§8, CM-30 maps it)
Exit to: `quest/player` (step complete) · the review session's next item

## States

- **asking** (default): gap empty, tiles live, no sound, no gloss on tiles.
- **miss**: tile locked in the nudge look, Hoya line; **second miss**: the ring.
- **found**: gap filled, sentence said, Hear it.
- **empty** (scope resolves to zero rounds): the shell's empty state with [ Back to quest ].
- **error**: a round whose answer is not among its tiles is skipped (and caught by the schema refinement); unknown ref is the shell's error state.
- **no Korean voice / sound off**: as above; the round plays the same.
- **large text (200 %)**: the prompt card grows, tiles go to one column, the body scrolls; tiles never shrink under the floor.
- **reduced motion**: no slide into the gap; the gap fills at once.

## Accessibility

- The prompt card is one group: "Sentence: chaegeul, blank. I read a book." (`a11y.minigame.clozePick.sentence`); after the right tile "Sentence complete: chaegeul ilgeoyo. I read a book." The Korean line carries `lang="ko"`, the romanization is read as words.
- Each tile is a button named by its Korean and romanization ("읽어요, ilgeoyo"); after a pick its state joins the name through `a11y.minigame.option.correct / wrong / hint`.
- Hoya's line and the status panel are polite live regions. Focus stays on the tapped tile; after the auto-advance it moves to the new prompt card.
- Nothing relies on colour: the gap's success look has a check glyph, a missed tile a mark glyph and a thicker border.

## Tokens and targets

- Tiles: `ChoiceCard` (radius `radii.lg`, border `borderWidth.base`, min height `touchTarget.min`; 48 dp floor of §14 met with room). Gap slot: `borderWidth.thick` underline in `brand.secondaryDark` (the Write Frame slot), min width `touchTarget.min`. Prompt card: `surface.paper`, `border.subtle`, `shadows.card`, padding `spacing.md` / `spacing.lg`.
- Type: Korean `typography.size.prompt` (phone) and `title` (regular), romanization and meaning `bodySm` in `text.secondary`. Success `feedback.success` / `successLight`; nudge `feedback.nudge` / `nudgeLight`; ring `border.focus`. No literal values.

## Data needs

- reads: the `cloze-pick` scope's rounds: `{ id, sentence: KoText with one gap marker, gapKind: 'word' | 'particle' | 'value', tiles: KoText[3..4], answerIndex, realiaRef?, itemId }` (row CM-2 / CM-30 schema; the gap marker is one `___` in `ko` and in `romanization`; the refinement requires the answer tile to be the only tile that makes a sentence the build accepts, and for a particle gap the `allomorph` helper to agree with the answer).
- logic: `clozeView(round, phase)` and the reducer (pure, 100 % covered); `clozeToListenPick(round)` (pure, 100 %).
- writes: `answerRound(roundIdx, correct)` on the first answer; the memory model records the item at the produce rung (CM-12) through the same `answerRound` path.
- telemetry: `minigame.finished { kind: 'cloze-pick' | 'listen-pick', questId, stepIndex }` (the kind rendered); `audio.fallback_shown { source: 'cloze-pick', reason }` once per session.

## Draft strings (CM-30 adds them with their es and ko values)

No `packages/i18n` key is added by this design row. CM-30 adds these under `learner.minigame.clozePick` and `a11y.minigame.clozePick`, en / es / ko in the same PR (F-I18N-001 §3.10). Reused as they are: `learner.minigame.progress.pill`, `learner.minigame.sentenceBuilder.missParticle`, `learner.audio.hearIt.cta`, the audio status lines, `a11y.minigame.option.*`.

| Key (proposed) | en draft |
|---|---|
| `clozePick.heading` | Fill the gap |
| `clozePick.instruction.word` | Pick the word that fits. |
| `clozePick.instruction.particle` | Pick the piece that fits. |
| `clozePick.instruction.value` | Read the card, then pick. |
| `clozePick.miss` | Read the sentence again. Which one fits? |
| `clozePick.missValue` | Look at the card again. |
| `clozePick.lookHere` | This one fits here. |
| `clozePick.found` | That fits! |
| `a11y.minigame.clozePick.sentence(romanization, meaning)` | Sentence: {romanization}. {meaning} |
| `a11y.minigame.clozePick.sentenceDone(romanization, meaning)` | Sentence complete: {romanization}. {meaning} |
| `a11y.minigame.clozePick.blank` | blank |

## Open questions

1. **Tiles with a picture.** A word gap could show WordArt pictures on its tiles for Stage 2 learners. Not in CM-30: a picture names the word's meaning, which the sentence meaning already gives; revisit after the first S2 Volume 2 cells ship.
2. **Romanization in tap mode.** With `romanizationMode: 'tap'` the sentence and the tiles hide their romanization until a tap, as everywhere else (F-BROWSE-001). A tile tap must not double as "show the romanization", so in tap mode each tile gets a separate "Show how it sounds" row under the tiles (one for all tiles). CM-30 checks the 320 height with it.
