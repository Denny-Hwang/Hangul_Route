# Minigame/Match Shape: where a letter's shape comes from, and look-alike letters (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F4 (`match-shape`, schema kind present; S1; fallback Read Pick; "Letter-shape origins and confusable pairs (ㅂ / ㅍ, ㅓ / ㅗ)"), §5.2 (Letters S1 additions: ㄱ ㄴ ㅁ ㅅ ㅇ drawn from the speech organs and the three vowel bases, authored as Stage 1 TypeScript rows with their own unit tests and the three-checker MAR), §4.3 (produce rung of `sym`: "Syllable Build with the symbol in place, or Match Shape"), §7.7, §12.2 (`game.match-shape`), row **CM-D2** (this file), built in row **CM-33** · extends `shell.md` (layout A) and `families.md` (Family 1, recognition) · audio states: `audio-fallback.md` W9 and W11
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-variety/` (`mock/match-shape.html`, `mock/states.html` board M; shots at 320 and 768)
Code (planned, CM-33): renderer `apps/mobile/src/screens/minigames/MatchShapeGame.tsx`; pure rules `apps/mobile/src/logic/match-shape/` (view, reducer, scoring, `matchShapeToReadPick`); round schema `MatchShapeRoundSchema` in `packages/content-schema`; origin pictures as scene-art props `prop:shape-origin-*` (`packages/design-system/src/scene-art/props/`), drawn to `design/brief/illustrations/scene-art-style.md`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean with romanization (`KoreanText`), `(art)` a drawn picture, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Stage 1 Letters step (the shape-origin quest of §5.2) or a review item for a `sym` item that has a look-alike
When: the learner sees a picture of where a letter's shape comes from and picks the letter, or sees one letter and taps every copy of it among look-alikes
Then: a right pick shows the letter beside its picture with one sourced sentence and says its sound; a look-alike only nudges ("Look at the strokes again"), and the round stays open until it is found

## Screen goal

"See where the shape comes from; tell look-alike letters apart."

## Round shape

Two round types in one kind (`shape: 'origin' | 'pair'`):

- **Origin round.** A drawn picture and one line name what a basic letter copies; the learner picks the letter among 3. The five basic consonants and the vowel bases, from the sourced facts already shipped in the story `content/stories/shapes-of-hangeul.json` (facts f2, f3, f5; Academy of Korean Studies, Encyclopedia of Korean Culture; National Institute of Korean Language). CM-33 cites them in the rows' `sources`:
  - ㄱ: the root of the tongue closing the throat · ㄴ: the tongue touching the upper gum · ㅁ: the shape of the mouth · ㅅ: the shape of a tooth · ㅇ: the shape of the throat (f3, Haerye wording).
  - ㅡ: flat like the earth · ㅣ: upright like a person · the round dot `·` like the sky (f5). The dot is an old letter that is no longer used on its own (f7), so it is never an option and never asked: it appears only in the note of the ㅏ round ("ㅏ is made from ㅣ and the dot", f6), drawn as a shape, not as taught content.
  - The picture is an original, simple side view in tokens (a head outline, the tongue, the teeth, the throat) with the part that makes the shape drawn in the letter's stroke weight; never a copy of a printed diagram. Each picture is a registry prop with a `sourceRef` to the fact it shows.
- **Pair round.** A target letter with its sound (`ㅂ` `b`) above a grid of 6 tiles mixing it with one look-alike (ㅂ / ㅍ, ㅓ / ㅗ, ㅏ / ㅓ, ㄹ / ㄷ); 2 or 3 tiles are the target. The learner taps every copy. Tiles show the letter only (no sound value, which would answer the round); the sound value shows on each tile once it is found.
- **Scoring.** Origin: first tap (shell rule). Pair: the round is right first try when every copy is found before any look-alike is tapped; a look-alike tap is the round's first miss and later taps are retries.
- **Rounds per step**: 4 to 6, origin and pair interleaved. **No Skip** (recognition).

## Box diagram

Origin round, compact (320 x 568):

```
+--------------------------------+
| [=====-----]          (2 / 5)  |
|  (Which letter comes from      |  <- heading
|   this shape?)                 |
| +----------------------------+ |
| |   (art: side view, tongue  | |  <- picture card: the part that makes the shape is drawn
| |    touching the upper gum) | |     heavier; the rest is a quiet outline
| |  (The tongue touches the   | |  <- one line from the sourced fact
| |   top of the mouth.)       | |
| +----------------------------+ |
|  [ ㄱ g ] [ ㄴ n ] [ ㅁ m ]     |  <- 3 letter tiles, one row (3 x 88 at 320)
|  ( Hoya bubble slot )          |
+--------------------------------+

after the right tile:
| +----------------------------+ |
| |  (art)        ~~ ㄴ ~~  n  | |  <- the letter beside the picture, its shape traced over the
| |  (ㄴ copies the tongue     | |     picture's heavy line (static under reduced motion)
| |   touching the top of the | |
| |   mouth.)                  | |
| +----------------------------+ |
|  [ ㄱ ] [ ㄴ (check) ] [ ㅁ ]   |
|  [ Sources ]                   |  <- opens the fact's sources (the Culture notes sheet)
```

Pair round, compact:

```
+--------------------------------+
| [=====-----]          (3 / 5)  |
|  (Tap every ~~ ㅂ ~~ b)         |  <- heading with the target and its sound
|                                |
|   [ ㅂ ] [ ㅍ ] [ ㅂ ]          |  <- 6 tiles, 3 x 2, each 88 x 88 at 320
|   [ ㅍ ] [ ㅍ ] [ ㅂ ]          |
|                                |
|  (found: 1 of the ones here    |  <- no count shown; found tiles carry a check and their
|   carries a check)             |     sound value; the rest stay plain
|  ( Hoya bubble slot )          |
+--------------------------------+
```

Regular (768 x 1024): origin: picture and tiles side by side in the reading column (picture 320 wide); pair: the grid at 3 x 2 with tiles at `touchTarget.hero` x `layout.mediaScale`.

## Interaction points

- **Origin, right tile**: success look + check glyph, the letter's sound plays (its spoken syllable, as Discover: ㄴ says 나), the picture card turns to the "explained" form above, `answerRound`. [ Next ] is not needed: auto-advance after a longer pause (the shell pause plus the time to read one line; the learner can tap the card to stay, which pauses the advance until they tap [ Continue ], a `touchTarget.child` button that appears only then).
- **Origin, other tile**: nudge look + mark glyph, locked; Hoya (`thinking`, amber) "Look at the picture again. Which letter has that shape?"; second miss: the look-here ring on the right tile.
- **Pair, a copy**: check glyph + success fill, its sound value appears under it; when the last copy is found the round is right, its sound plays once, auto-advance.
- **Pair, a look-alike**: nudge look + mark glyph on that tile, locked; Hoya "Look at the strokes again." plus one line on the difference, from the round's content (`ㅂ stands up, with two tall sides. ㅍ lies flat, with long lines at the top and bottom.`; `ㅓ: a short stroke points left from a tall line. ㅗ: a short stroke points up from a flat line.`); these describe the drawn shapes only (no origin claim), and CM-33's MAR checks each against the letter forms; second miss: each copy still to find gets the ring.
- **[ Sources ]** (origin, after the right tile): opens the sources sheet of the Culture notes (shipped), with the fact's institution names and links. Optional; does not affect the round.

## Fallback round when `game.match-shape` is off

**Read Pick**, derived by `matchShapeToReadPick(round)`: see the letter, pick its sound in romanization (the `sym` read rung of §4.3).

```
|  (Which sound does this letter make?) |
|          ~~ ㄴ ~~                     |  <- origin round: the target letter, large
|  [ n ]  [ g/k ]  [ m ]               |  <- the sound values of the round's letters
|  pair round: ~~ ㅂ ~~ with [ b ] [ p ] [ m ]: the look-alike's sound is a distractor
```

Read Pick renders with the Listen & Pick option cards and the text prompt mode of row CM-30 (`cloze-pick.md`, fallback section), so it adds no new renderer. Same scoring; the origin picture and its note are left out (they are a culture layer, not the asked skill).

## No device voice

- Nothing in the round needs sound: the letters and pictures are on screen. The right answer's sound is an extra.
- When that sound cannot play, the **status panel** (`audio-fallback.md` W9, the Korean is already printed) appears under the picture card or under the grid: "No Korean voice on this device." [ How to add a voice ], "Sound is off." [ Turn sound on ], "The sound did not play." [ Try again ]. It shows only after the first attempt to play in the step (the A-5b rule), is neutral and a polite live region, source `match-shape`.
- No line on this screen asks the learner to say the sound.

## Navigation graph

Enter from: `quest/player` (a Stage 1 Letters play step with a `match-shape` scope, §5.2) via `minigame/shell`; a review item at the produce rung of a `sym` item that has a look-alike pair
Exit to: `quest/player` · the review session's next item · [ Sources ] -> the Culture notes sources sheet (returns here)

## States

- **asking**, **miss** (tile locked), **second miss ring**, **found / explained** (origin), **all found** (pair), **paused to read** (origin, after a tap on the card).
- **art missing** (a prop not yet drawn): the origin round shows the line alone on the card, never a broken image; the content test for CM-33 requires every origin round's prop to exist before the round is `ready`.
- **empty / error**: the shell's states.
- **no Korean voice / sound off**: as above.
- **large text (200 %)**: the line grows and wraps; tiles keep their size (letters are media); the card scrolls with the page.
- **reduced motion**: no stroke tracing over the picture (the letter appears beside it at once); no tile animation.

## Accessibility

- The origin picture is an image with a description that is the fact itself ("A head from the side. The tongue touches the top of the mouth."), not decorative, because it is the prompt.
- Tiles are buttons named by the letter and, in origin rounds, its sound ("ㄴ, n"). In pair rounds a tile is named by its letter only, and a found tile adds "found" and its sound ("ㅂ, b, found"), so the screen-reader user does the same task: read the letter shape (the screen reader names the jamo, which the learner then compares with the target).
- The pair heading reads "Tap every ㅂ, b". Hoya's line and the status panel are polite live regions.
- No colour-only state: found tiles have a check, missed tiles a mark and a thicker border.

## Tokens and targets

- Letter tiles: origin 88 wide on a phone (three across, each at least `touchTarget.min`; 48 dp floor met), pair `touchTarget.hero` (96) where the window allows, never under `touchTarget.min`; letter face `typography.size.display`, sound value `caption`; `radii.lg`, `borderWidth.base`.
- Picture card: `surface.paper`, `border.subtle`, `shadows.card`; the picture in token colours only: outline `border.shape`, the shape-making part `text.primary` at the letter's stroke weight, skin and mouth in `hoya.belly` / `surface.sunken` (no `brand.primary`, no `feedback.danger`). Scene-art budget per prop: at most 8 shapes and 5 colours (style guide).

## Data needs

- reads: the `match-shape` scope's rounds: origin `{ id, shape: 'origin', target: jamoId, options: jamoId[3], propRef, noteKey, factRef: { story: 'shapes-of-hangeul', fact: 'f3' } }`; pair `{ id, shape: 'pair', target: jamoId, lookAlike: jamoId, layout: ('t' | 'l')[6], diffNoteKey }` (CM-33). The note lines are content strings with es and ko overlays (content, not UI keys); they restate the cited facts and add no new claim.
- logic: view, reducer, scoring, `matchShapeToReadPick` (pure, 100 %); the Stage 1 additions' unit tests (sources present, every new symbol shown before it is asked, §4.2).
- writes: `answerRound`; memory item `sym:<jamo>` at the produce rung.
- telemetry: `minigame.finished { kind: 'match-shape' | 'listen-pick', ... }`; `audio.fallback_shown { source: 'match-shape', reason }`.

## Draft strings (CM-33 adds them with their es and ko values)

Reused: `progress.pill`, `learner.minigame.listenPick.empty`, `learner.story.sources.*` (the sources sheet), `audio.*`, `a11y.minigame.option.*`. Content lines (the five origin notes, the vowel notes, the look-alike difference notes) are authored in the Stage 1 TypeScript rows with es and ko overlays and pass the three-checker MAR (§4.2).

| Key (proposed) | en draft |
|---|---|
| `matchShape.heading.origin` | Which letter comes from this shape? |
| `matchShape.heading.pair(letter, sound)` | Tap every {letter} {sound} |
| `matchShape.missOrigin` | Look at the picture again. Which letter has that shape? |
| `matchShape.missPair` | Look at the strokes again. |
| `matchShape.found` | Found it! |
| `matchShape.continue` | Continue |
| `matchShape.sources` | Sources |
| `readPick.heading` | Which sound does this letter make? |
| `a11y.minigame.matchShape.found(letter, sound)` | {letter}, {sound}, found |

## Open questions

1. **Aspirated letters from the basic five** (ㄴ -> ㄷ -> ㅌ, fact f4). A third round type ("add a stroke") would follow naturally; not in CM-33 (the spec lists origins and pairs only). Proposed for a later Letters row.
2. **Read Pick naming.** The fallback's heading key sits under `readPick`, a name F-PLC-001 uses for its own `read-pick-picture` format. CM-33 checks there is no clash in `packages/i18n` before adding it (the placement keys live under `learner.placement`).
