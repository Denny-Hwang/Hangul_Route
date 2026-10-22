# Minigame/Syllable Build: build a whole block, first letter, vowel and final (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F3 (`syllable-build`, schema kind present; S1-S2; fallback Listen & Pick on the built block; "Initial + vowel + final; trains 받침"), §4.3 (produce rung of `sym`, `syl` and `lex` items), §5.2 (Letters S1 additions: a batchim quest for the 7 representative final sounds; S2 final-consonant words), §7.7, §12.2 (`game.syllable-build`), §19 assumption 5 (real syllables only), row **CM-D2** (this file), built in row **CM-32** · extends `shell.md` (layout A) and `build-letter.md` (the same tap-to-fill idea, one zone per part of the block) · audio states: `audio-fallback.md` W9 and W11
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-variety/` (`mock/syllable-build.html`, `mock/states.html` board S; shots at 320 and 768)
Code (planned, CM-32): renderer `apps/mobile/src/screens/minigames/SyllableBuildGame.tsx`; pure rules `apps/mobile/src/logic/syllable-build/` (round view, reducer, scoring, `syllableBuildToListenPick`); round schema `SyllableBuildRoundSchema` in `packages/content-schema` (the kind is already in `MinigameKindSchema`); block drawing `design/components/SyllableBlock` (its `layout.ts` decides beside / under, with the final zone at the bottom)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean with romanization (`KoreanText`), `[ _ ]` an empty zone of the block, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Stage 1 or Stage 2 step (the batchim quest of §5.2, an S2 final-consonant cell) or a review item at the produce rung
When: the learner hears a syllable (and sees its meaning when it is a word), then taps a first letter, a vowel and a final (or "no final") into the three zones of a block
Then: the block builds itself as they tap, any order; when every zone has a letter it is checked, a right block is said and the round moves on, and a zone that does not fit is marked in amber with a hint about where the sound is, while the zones that fit stay

## Screen goal

"Build the block you hear: first letter, vowel, final."

## Round shape

- **Target**: one real syllable block from the Stage 1 table or a taught word's block (밥 `bap`, 산 `san`, 곰 `gom`), never a pseudo-word (§19 assumption 5: device voices read non-words unpredictably). The gloss line shows the meaning when the block is a word (밥 "rice, a meal").
- **Prompt**: the speaker (`touchTarget.min` on a phone, where it sits beside the block and replays on each tap; `touchTarget.hero` with [ Hear it again ] from regular) and, under it, the **meaning button** of Dictation (`type-hangul.md`, hear mode): one hit area at least `touchTarget.min` tall with the meaning on its first line (밥 "rice, a meal"; a syllable that is not a word shows no meaning line) and "Show how it sounds" as a link line under it. **The romanization is held back before the block is right**, as in Dictation (D4 of the mocks' README): for the real syllables this round admits, `bap` maps straight to ㅂ ㅏ ㅂ, so a learner could build the block by matching Latin letters without decoding or listening. A tap on [ Show how it sounds ] reveals `bap` in place of the link line for this round, and the round is then recorded as **hinted** for the memory model (F-CURR-002 §4.3: no promotion, no demotion; its stars count as usual). It is a help, never a penalty line. The block itself (밥) is not shown until it is built; when it is right, the block shows with its romanization and meaning. (CM-D2 review round 3: the earlier draft kept `bap` visible and put a sound value on every tile, which let the round be solved by matching b-a-p.)
- **Three rows of tiles**, labelled, in block order: **First letter** (3-4 consonants), **Vowel** (3-4 vowels), **Final** (2-3 consonants plus a **No final** tile, so 3-4 tiles: four 64 tiles and their gaps fit the 288 of a 320 window). **Tiles show the jamo only**, never its sound value, before and after the check (the rule this PR applies in Dictation and in Match Shape pair rounds: a value on the face would answer the round). A final tile has the Build a Letter final look (the base line), not a value. The values appear once, with the right block (`bap` under 밥).
- **The final row never offers two letters with the same final sound** (lint and refinement `syllable-build-final-distinct`, CM-32): with 밥 the row may offer ㅂ, ㄴ, ㅇ and No final, never ㅍ, because 밥 and 밮 would sound the same [밥]. This applies `dictation-unambiguous` (§4.5) to the part that is heard. The seven representative final sounds (ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ) are the only finals a heard round asks; a final outside them (ㅋ, ㅍ, ㅅ ...) is only asked with the word's meaning on screen as the settling cue, and only in Stage 2 (the S2 word-family rows).
- **Rounds per step**: 4 to 6. **Skip**: yes (construction game, shell rule).

## Box diagram

Compact (320 x 568, layout A; the count pill, heading and Skip share the top row below `layout.compactHeight`):

```
+--------------------------------+
| (2/5) (Build the block you     |  <- compact top row: count, heading, Skip
|        hear)          [ Skip ] |
|  [(spk)]      +-------+-------+ |  <- speaker (touchTarget.min on a phone; each tap replays)
|               |  ㅂ   | [ _ ] | |     beside the block: zones drawn by SyllableBlock layout
|  [(rice, a    +-------+-------+ |     (vowel beside or under the first letter; the final
|    meal)      |     [ _ ]     | |     zone at the bottom); a filled zone shows its letter
|   Show how    +---------------+ |  <- meaning button: the meaning, and the hint link line
|   it sounds]                   |     (a tap shows `bap` there; the round is then hinted)
|  (First letter)                |
|  [ ㄱ ] [ ㅂ ] [ ㅁ ] [ ㄷ ]    |  <- 4 tiles of 64 x 64 in 288 (gap spacing.sm); jamo only
|  (Vowel)                       |
|  [ ㅏ ] [ ㅓ ] [ ㅗ ] [ ㅜ ]    |
|  (Final)                       |
|  [ ㅂ_] [ ㄴ_] [ ㅇ_] [No final]|  <- final look (base line); "No final" is a tile like the others
|  ( Hoya bubble slot )          |
+--------------------------------+
```

At 320 x 568 everything is on the first screen (measured in the mock: top row 64, speaker with the meaning button beside the block 140, three rows of caption + 64, the Hoya slot under them); with enlarged text the part under the block scrolls, and the block stays above the rows so a tap and its result are on one screen. Regular (768 x 1024): the speaker at `touchTarget.hero` with [ Hear it again ], the block beside it; rows of up to 5 tiles at `touchTarget.min x layout.mediaScale`, aligned to the start with their captions; Skip in the top row.

## Interaction points

- **A tile**: fills its own zone (a first-letter tile fills the first-letter zone, whatever order the learner taps in) and the block redraws (the letter appears in its zone, `motion.duration.base`; at once with reduced motion). A second tile in the same row replaces the first. The tile shows the selected look while it sits in the block.
- **Tap a filled zone**: empties it (undo), so nothing needs a Delete key.
- **Check**: automatic when all three zones hold a tile (No final counts). The round scores on the first full block.
  - **Right**: the block takes the success look with the check glyph, the syllable is said, its romanization (`bap`) shows under the block with the gloss, auto-advance after the shell's pause.
  - **A zone that does not fit**: that zone and its tile take the nudge look with the mark glyph; the zones that fit stay filled; Hoya (`thinking`, amber) says where to listen, by zone: first letter "Listen to how it starts.", vowel "Listen to the middle sound.", final "Listen to how it ends." (with No final picked when there is a final, or a final picked when there is none: "Listen to the end: is there a final sound?"). The sound replays after 0.8 s unless the learner acts first. Changing the marked zone checks again (a retry).
  - **Second miss on the same zone**: the right tile in that row gets the look-here ring and Hoya "This one goes here.".
- **Speaker / Hear it again**: replays the syllable; unlimited.
- **[ Skip ]**: `markStepComplete()` + `onFinish()` without recording the remaining rounds.

## Fallback round when `game.syllable-build` is off

**Listen & Pick on the built block**, derived by `syllableBuildToListenPick(round)`: the same speaker prompt (said on round open, as Listen & Pick), and 3-4 block options: the target and blocks that differ from it in one zone, built from the round's own tiles (밥 with 반, 방, 법), each a real syllable from the Stage 1 table and never two that sound the same (the final-distinct rule). Same scoring; the memory model records it at the recognize rung (a pick, not a build).

```
|  [((speaker))]  [ Hear it again ] |
|  [ ~~ 밥 ~~ bap ] [ ~~ 반 ~~ ban ] |
|  [ ~~ 방 ~~ bang ] [ ~~ 법 ~~ beop ]|
```

With no device voice the fallback is Listen & Pick's own text state (`audio-fallback.md` W3: the prompt zone shows `~~ 밥 ~~ (bap)` with the notice) and then the round asks the learner to find the block they read.

## No device voice

- Reading is then the only route to the sound, so **the prompt shows the romanization (`bap`) from the start** in place of the link line, with the meaning; the round is not recorded as hinted for it (the learner had no other way in). The tiles still show the jamo only, so the learner maps each sound of `bap` to a letter shape: that is the decoding skill. The speaker stays, disabled or "Tap to hear" by state.
- **The visible sound notice** (`PromptPanel`, text variant without the Korean, because the target block is the answer and is not drawn): under the speaker, "(No sound? Read it here.)" plus the reason line and its action: "No Korean voice on this device." [ How to add a voice ] (shown at round open when the capability is `none`), "Sound is off." [ Turn sound on ] (after a tap on the speaker while muted), "The sound did not play." [ Try again ]. Source `syllable-build`. The right block's sound after the check plays through the same slot; a failure there shows the status line under the block.
- The round scores as usual; the notice is neutral, never amber or red.

## Navigation graph

Enter from: `quest/player` (a Stage 1 or 2 play step with a `syllable-build` scope) via `minigame/shell`; a review session item at the produce rung of a `sym` (with the symbol already in place in its zone, §4.3), `syl` or one-block `lex` item; the Decoding Sprint of row CM-32 (it reuses this round in the Speed Round frame of `vocab/speed-round.md`; the sprint's own frame is outside this row)
Exit to: `quest/player` · the review session's next item

## States

- **building** (default), **full block: right**, **zone marked** (one or more), **second miss ring**, **skipped**.
- **sym item at the produce rung**: the asked symbol's zone is already filled and locked (a quiet look, no tile), so the learner builds the rest around it (§4.3 "with the symbol in place").
- **empty** / **error**: the shell's states; a round whose target is not in the Stage 1 table or the round's tiles fails the schema refinement.
- **no Korean voice / sound off**: as above.
- **large text (150 % and 200 %)**: captions and the gloss grow; jamo tile faces are media and keep their size; the rows wrap to 3 per line before the tiles shrink; the part under the block scrolls. The **No final** tile is a text label, not media: its label grows with the text setting and wraps onto two lines inside the tile, and the tile grows taller (never narrower than `touchTarget.min`, never truncated); the other tiles in its row keep their size. CM-32 adds a 320 px screenshot check at 150 % text with the final row shown.
- **reduced motion**: no letter travel into the block; the speaker does not pulse.

## Accessibility

- The block is one group with three zone buttons: "First letter, ㅂ, letter bieup" / "Vowel, empty" / "Final, empty" (`a11y.minigame.syllableBuild.zone`); after the check "Block 밥, bap, built" or "Final, ㄴ, letter nieun, listen again". The romanization of the block is read only once the block is right, or after [ Show how it sounds ] (then the meaning button reads "Meaning: rice, a meal" and the revealed `bap` is a polite live region, as in Dictation).
- Each tile is a button named by its jamo (tagged `lang="ko"` / `accessibilityLanguage="ko"`) and the letter's name in romanization, never its sound value in this block: "ㅂ, letter bieup"; a final tile "ㅂ, letter bieup, as a final"; No final "No final letter". The letter name is the jamo id's name (`jamo:bieup` -> `bieup`, the RR names of `content/episodes/stage-1/jamo.json`), so it is stable and distinct for every tile. (A vowel's name is its sound, 아 `a`; that is the only name a screen reader can give it, and it is the same name the Stage 1 lessons teach.) The shipped `a11y.minigame.finalTile` ("final p") is not used here, because it carries the value. Rows are groups with their caption as the name.
- Hoya's line and the sound notice are polite live regions; after a check focus stays on the last tapped tile.
- No colour-only state: success has the check glyph, a marked zone the mark glyph and a thicker border.

## Tokens and targets

- Tiles at `touchTarget.min` (64; 48 dp floor met), `radii.lg`, `borderWidth.base`, `surface.paper` (consonants) and `surface.sunken` (vowels, the keyboard's two quiet fills; the row caption and position also say which row a tile is in). The final row's tiles use `surface.paper` with a `border.strong` base line, the Build a Letter final look.
- Block: each zone is a tap target (a tap empties it), so every zone is at least `touchTarget.min` (64) on a phone, the final zone 64 tall across the block; from regular the top zones are `touchTarget.hero` (96); zones drawn by `SyllableBlock`; empty zone `borderWidth.base` dashed `border.shape`; filled zone `brand.secondaryLight`; right `feedback.successLight` + `feedback.success`; marked `feedback.nudgeLight` + `feedback.nudge`; ring `border.focus`.

## Data needs

- reads: the `syllable-build` scope's rounds: `{ id, target: KoText (one block), firstTiles: jamoId[3..4], vowelTiles: jamoId[3..4], finalTiles: jamoId[2..3] (No final is implicit), fixedZone?: 'first' | 'vowel' | 'final', itemId }` (CM-32); refinements: the target's parts are among the tiles, the target is a real syllable of the Stage 1 table or a taught word's block, and the final tiles are final-distinct.
- logic: `composeSyllable` and `decomposeSyllable` (`packages/content-schema/src/romanization/hangul.ts`, shipped); `syllableBuildView`, reducer, scoring and `syllableBuildToListenPick` (pure, 100 %).
- writes: `answerRound(roundIdx, correct)` on the first full block; memory item at the produce rung (CM-12), recorded as hinted when [ Show how it sounds ] was used (not in the no-voice state).
- CM-32 test: a unit test that, before the block is right, no tile face carries the target's romanization or a sound value, and no tile or zone accessible name carries either as a word of its own (the letter name, "letter bieup", is allowed; ", b" or "bap" is not), in every audio state, and that the prompt shows the romanization only after [ Show how it sounds ] or in the no-voice state; the same test runs on the Decoding Sprint's use of this round.
- telemetry: `minigame.finished { kind: 'syllable-build' | 'listen-pick', questId, stepIndex }`; `audio.fallback_shown { source: 'syllable-build', reason }`.

## Draft strings (CM-32 adds them with their es and ko values)

Reused: `learner.minigame.skip.cta`, `progress.pill`, `listenPick.hearAgain`, `audio.*`, `a11y.minigame.option.*`, `a11y.minigame.hear`, and Dictation's meaning button strings (`typeHangul.hear.showSound`, `typeHangul.hear.meaning`; row CM-31, reused as they are).

| Key (proposed) | en draft |
|---|---|
| `syllableBuild.heading` | Build the block you hear |
| `syllableBuild.row.first` | First letter |
| `syllableBuild.row.vowel` | Vowel |
| `syllableBuild.row.final` | Final |
| `syllableBuild.noFinal` | No final |
| `syllableBuild.miss.first` | Listen to how it starts. |
| `syllableBuild.miss.vowel` | Listen to the middle sound. |
| `syllableBuild.miss.final` | Listen to how it ends. |
| `syllableBuild.miss.finalOrNone` | Listen to the end: is there a final sound? |
| `syllableBuild.lookHere` | This one goes here. |
| `syllableBuild.built` | You built it! |
| `a11y.minigame.syllableBuild.zone(part, jamo?, name?)` | {part}, {jamo}, letter {name} / {part}, empty |
| `a11y.minigame.syllableBuild.tile(jamo, name)` | {jamo}, letter {name} |
| `a11y.minigame.syllableBuild.finalTile(jamo, name)` | {jamo}, letter {name}, as a final |
| `a11y.minigame.syllableBuild.block(ko, romanization)` | Block {ko}, {romanization}, built |
| `a11y.minigame.syllableBuild.noFinal` | No final letter |

## Open questions

1. **Double finals** (ㄳ ㄺ ㄻ ...). Not asked in a heard round (they are spoken as one of the seven sounds). If an S2 cell wants them, a fourth tile kind (a two-letter final tile) is added with the meaning as the settling cue; CM-32 leaves it out.
2. **Decoding Sprint frame** (F9). F9 is not in this row; CM-32 designs its bonus frame from `vocab/speed-round.md` (60 s, private best, the held-out probe), reusing this round and the fallback's Listen & Pick round unchanged.
