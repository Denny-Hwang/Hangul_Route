# Hangul Check: the decode round and the version 2 part (screen note, DC-2a)

Spec: `docs/specs/AMENDMENTS-STAGE1-DECODING-CHECK.md` §3.4 (version 2 items and parts), §3.5 (the decode round), OD-DC10 (choosing among sounds), OD-DC11 (parts as segments) · row **DC-2a** · approved by multi-agent review (CLAUDE.md §5, owner decision 2026-10-12); review log at the end
Wireframe: `design/wireframes/reviews/hangul-check.md` B (a part), B2 (a decode item), B3 (a word item), C (the pause)
Related: `AMENDMENTS-AUDIO-CANT-HEAR.md` §3.2, §3.3 (the link and the sheet), §3.12 (Checks) · `design/components/ChoiceCard/spec.md` (the state looks) · `design/components/CantHear/spec.md` · `design/components/AnswerFeedback/spec.md` (marks) · `AMENDMENTS-TOUCH.md` (the tap board)
Mock (built by `tools/build.mjs` from `tools/frames.mjs`; rules in `mock/hangul-check.css`):
- `mock/decode-states.html`: one item played through (D1-D10), and no sound, a failed play, Show the letters, the sheet and the pack loading (N1-N6) at 375 x 667; six of them at 320 x 568
- `mock/decode-sizes.html`: every size at standard text in the arrangement it takes; the missed and Sound-off states at the row's phone sizes
- `mock/decode-largest.html`: Largest text on 390 x 844 (acceptance) and 375 x 667; 320 x 568 for the record
- `mock/decode-200.html`: 200 % text on 390 x 844 (stress case)
- `mock/part-v2.html`: a version 2 part: decode, name, final and word segments under one header with one set of 7 dots, and the pause
- `mock/decode-a11y.html`: the screen-reader focus order (numbered badges are board notes) and what each stop says

Shots: `shots/<page>.png` (each page, 1x), `shots/size-<w>x<h>[-largest|-200][-missed].png` (each size alone, 2x: Sound 2 selected and playing; `-missed`: after a wrong commit)
Tools: `node design/screens/hangul-check/tools/measure.mjs` (the measurements below, the checks, the shots; `--matrix` prints every arrangement at every size). Playwright from `apps/web`'s install (falls back to the main checkout), as `design/screens/discover-trace/tools/measure.mjs`. `tools/hoya-figure.mjs` is Hoya generated once from `hoyaFigure(pose)` (`packages/design-system/src/scene-art/hoya.ts`) on this commit.
Code (DC-2d): `apps/mobile/src/screens/reviews/DecodeRound.tsx` (new), `logic/stage1/decode-round.ts` (new, the pure view model `decodeRoundView`), `screens/reviews/StageReviewScreen.tsx` (the part player), `logic/listen-pick-flow.ts` (`headerView`)

**The mock is a design reference, not shipped code.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it; the non-token numbers are in "Constants". `colors.feedback.danger` is not even copied into the stylesheet, and the checks read every drawn colour for it. The decode items are illustrative balanced sets (§3.4, OD-DC5 (a)): **그** among 거 드 그 더 (initial ㄱ-ㄷ, vowel ㅡ-ㅓ), and **둠** among 곰 국 둠 독 (initial ㄷ-ㄱ, vowel ㅜ-ㅗ, final ㅁ-ㄱ; every pair of options differs in two places). No target is a block a Stage 1 quest shows (곰, a Stage 1 word, is only an option here), no option is a carrier, a Decoding Sprint probe block or a Hangul Check word block, and the two targets have different initials (§3.4 step 1). 그 is in the sprint's drill pool (preferred out, not excluded) and 둠 and 독 have no clip yet (DC-2c). DC-2b authors the real pool.

## Who and how it should feel

Any learner, any age (CLAUDE.md §1), near the end of Stage 1: they read a syllable no quest has shown and find how it sounds. Calm and unhurried: no timer, no score, no count on screen, never red. Listening to the four sounds is free play; only **This one** is an answer. A miss is amber with the replay mark and Hoya thinking, with no words (the review host draws no feedback text, F-QUEST-002 §3.10). Pre-A1 English, every string an existing key or one proposed below.

## The round

```
[x]  ○ ○ ○ ○ ○ ○ ○                      Stop the check; the part's 7 fill-only dots (one Progress for the whole part)
Read it. Which sound is it?              heading (prompt, bold)
Tap a sound to hear it. Then tap This one.   hint — not drawn in the tight arrangements (kept in the spoken heading)
+---------------------------------+
| (Hoya)        그                 |     the syllable: KoreanText lg, Hangul only; the romanization line keeps its
|              (geu: held)         |     room and draws nothing until the right commit (§3.1)
+---------------------------------+
[ (spk) Sound 1 ] [ (spk) Sound 2 ]      four sound cards, 2 x 2, 96 high (touchTarget.hero)
[ (spk) Sound 3 ] [ (spk) Sound 4 ]      a tap plays the clip and selects the card
[[ This one ]]  [ Can't hear it? ]       This one: drawn from the start, off until a card is selected
```

| Part | Look (tokens) |
|---|---|
| Header | Stop the check: `close` glyph in a 64 round target (`touchTarget.min`), name `learner.stageReview.leave.close`; the dots: `Progress variant="dots"` (12, `spacing.sm` gap, `brand.primary` on `surface.sunken`), value = items finished in the part, max 7 |
| Heading / hint | `Heading level="prompt"` (bold, `leading.tight`); the hint `Body` `text.secondary`. With Sound off or after a failed play the hint's place carries the status line ("Sound is off." / "The sound did not play.") |
| Syllable panel | `surface.paper`, `borderWidth.base` `border.subtle`, `radii.xl`, padding `spacing.sm` / `spacing.lg`; `KoreanText size="lg"` (Hangul `hero` bold, romanization `bodyLg` medium `text.secondary`, `romanizationReserved`); Hoya `spacing.xxxl` (48) at its start, decorative |
| Sound card | painted with `choiceCardStyle(state)`: idle `surface.paper` / `border.shape` `borderWidth.base`, `radii.lg`, min height `touchTarget.hero`, padding `spacing.sm`; the speaker disc `spacing.xxxl` round, `brand.secondaryLight` fill, `brand.secondary` border, `speaker` glyph 24 in `brand.secondaryDark` (Listen & Pick's speaker look, small); label `body` semibold "Sound n" |
| Target | the card inside a ring frame: padding `spacing.xs`, border `borderWidth.thick`, radius `radii.lg + spacing.xs + borderWidth.thick`, the border in `surface.canvas` at rest (Pic-Word Match's `RING_REST` / `targetStyle`): the ring and its padding are part of the button, so a touch on them is a touch on the card (AMENDMENTS-TOUCH KT-4b) and nothing moves when the selection shows. Grid gap `spacing.sm` |
| Selected | the ring frame turns solid `brand.primary` (Pic-Word's `RING_SELECTED`). Not ChoiceCard's dashed look-here ring, which the review host never draws. `brand.primary` is the selection colour by the press-look contract (`press-look.ts`) |
| Playing | the disc fills: `brand.secondary`, glyph `text.onSecondary`. A state of the sound, not of the answer; nothing else changes |
| Pressed | the press look on the card: thick `border.shape` outline growing inward, scale 0.97 (none under reduced motion) |
| Wrong commit | ChoiceCard `wrong`: `feedback.nudgeLight` / `feedback.nudge`, the `replay` mark (24, `text.primary`) on a disc of the fill at the top-end corner. **It still plays on a tap** (the mark means what it shows) but can no longer be selected; Hoya `thinking` |
| Right commit | ChoiceCard `correct`: `feedback.successLight` / `feedback.success`, the `check` mark (24, `feedback.success`); the syllable's romanization line shows; Hoya `cheering`; the dot fills |
| Latin sound chip | in the disc's place at the disc's height up to Largest text, so the cards do not move: pill, `surface.sunken`, `borderWidth.base` `border.shape`, `bodyLg` semibold romanization; after Show the letters a 20 `speaker` glyph in it (the card still plays). At 200 % text the chip's line is 6 taller than the disc and the cards grow once, at the learner's request |
| This one | `Button` primary `lg` (`touchTarget.child`): full width in `full`, one equal share of a row with the help slot elsewhere; `md` (`touchTarget.min`) in the tight arrangements. Off = the Button's soft-disabled look (`surface.sunken`, `text.muted`, opacity 0.6, focusable, `aria-disabled`) |
| Help slot | `CantHear` (Button ghost `sm`); with Sound off its place takes Turn sound on, after a failed play Try again (Button secondary `sm`, PromptPanel's actions); empty after Show the letters. **The slot keeps its room and its share in every state**, so This one never changes size |
| Focus | `border.focus` `borderWidth.thick`, `spacing.xxs` outside the control; on a card, outside the ring frame |

**No new token, no new design-system component, no new glyph.** The sound card is drawn by `DecodeRound` with ChoiceCard's pure state looks (`choiceCardStyle`, as Cloze Pick paints its tiles by hand) and Pic-Word Match's ring frame: ChoiceCard itself cannot hold it, because its `art` slot has a `touchTarget.hero` minimum height (`ChoiceCard.tsx:86`; a 152 high tile).

## OD-DC10: confirmed, with refinements (recorded in the spec by this row; the owner approves recommendations)

The mock confirms **(a): a tap plays and selects; This one commits**. Against (b) "a second tap on the same card commits": a learner who replays a sound to compare would answer by accident, and with a screen reader a double activation is the normal way to replay. Against (c) "the sounds play in order, then a tap commits": four clips of about 0.7 s with gaps add about 4 s per item, about 50 s over 12 items against the check's four-minute budget (§3.4), and a learner cannot replay one sound to compare it. Refinements:

1. **This one is drawn from the start, off (soft-disabled) until a card is selected** (§3.5 said "shown once a card is selected"). Nothing moves when the first card is selected, the commit step is visible from the first item of the check, and after a wrong commit focus stays on This one rather than falling to the page.
2. **A wrong commit clears the selection** (This one is off again). The wrong card turns amber with the replay mark and **still plays on a tap** (to compare; playing is never scored) but cannot be selected again. It stays a focusable button and is never announced as disabled (ChoiceCard's `wrong`: inactive in the board, `disabled: false`).
3. A tap on the selected card plays it again and keeps it selected.
4. **With a screen reader on, nothing talks over anything**: activating a card plays its clip only after the reader has said the card's new name; on a commit the result line is said first and only then the right card's replay (`announceAndWait`, as Can't hear it's Hear it, CH §3.7), on iOS too.
5. **This one's accessible name contains its visible words** (WCAG 2.5.3, so voice control's "tap This one" works): `a11y.minigame.pickSound(n)` = "This one: Sound 2", not "Pick sound 2".
6. **After the right commit the round moves on when the replay has ended (or failed), then `motion.duration.slow`**, not after `slow` alone, which would cut the replay.
7. **The Can't hear it? sheet's Hear it plays the selected card, else Sound 1, and changes no selection** (the round has no prompt sound for CH §3.3's "plays the prompt").

## Arrangements (measured)

The round takes the **first arrangement in which the syllable, the four cards, This one, the heading, the hint or status line (where drawn) and the help slot are all on screen with nothing scrolled, with at least `spacing.sm` left under the lowest control** (a margin for a device font taller than Chromium's), decided once per item from its tallest state. Portrait:

1. **full**: as drawn above, This one full width, the help slot on its own line.
2. **compact**: This one and the help slot share one row, one equal share each.
3. **tight**: compact, no hint line (it stays in the round's spoken heading), the round's gaps step down to `spacing.sm`, This one `md`.
4. **tight-row**: tight, and the heading and the syllable panel share a row (the panel as wide as its syllable); Hoya moves to the header's end. For small phones and large text.

Landscape (the `GameColumns` `side` arrangement, as Listen & Pick decides it): **side** puts the header, heading, hint and syllable in the prompt column and the cards, This one and the help slot in the answers column, half the reading column each, both top-aligned; the header rides in the prompt column so the answers column has the window's full height. The order is the portrait one, so rotating never changes the focus order. **side-tight**: side without the hint, `spacing.sm` gaps, This one `md`. The cards keep their portrait look everywhere (one card at every size).

**Table 1: the ladder's choice** (Chromium, `tools/measure.mjs`, this commit; every state of `STATES`: idle, selected and playing, after a miss, right after a miss, Sound off, a failed play with a selection, Show the letters)

| Size | Text | Arrangement | Card | This one bottom / help bottom / window | Least slack |
|---|---|---|---|---|---|
| 320 x 568 | standard | tight-row | 96 | 497 / 497 / 568 | 55 |
| 375 x 667 | standard | compact | 96 | 599 / 591 / 667 | 52 |
| 390 x 844 | standard | full | 96 | 599 / 671 / 844 | 157 |
| 844 x 390 | standard | side | 96 | 346 / 338 / 390 | 20 |
| 667 x 375 | standard | side-tight | 96 | 326 / 326 / 375 | 25 |
| 768 x 1024 | standard | full | 96 | 607 / 679 / 1024 | 321 |
| 1180 x 820 | standard | side | 96 | 354 / 346 / 820 | 434 |
| 390 x 844 | Largest (1.5) | compact | 108 | 755 / 757 / 844 | 71 |
| 375 x 667 | Largest (1.5) | tight-row | 108 | 571 / 572 / 667 | 79 |
| 320 x 568 | Largest (1.5) | none: the screen scrolls (not an acceptance size) | - | - | - |
| 390 x 844 | 200 % (2) | tight-row | 121 | 731 / 750 / 844 | 78 |

Every size the row names (320 x 568, 375 x 667, 390 x 844, landscape 844 x 390 and 667 x 375, Largest text on 390 x 844) and the spec's wide windows (1180 x 820, 768 x 1024) hold every state on one screen; Largest on 375 x 667 and 200 % on 390 x 844 fit too. **Tightest rows**: 844 x 390 leaves 20 and 667 x 375 25; if a device font needs more, 844 x 390 falls to side-tight (40), and 667 x 375 has no further step (the screen scrolls; open item). Largest on 320 x 568 fits no arrangement: the four cards are on screen and This one and the help slot are under the fold; the Screen scrolls, as Listen & Pick does today (open item for DC-2d's text-size run).

## States (board D1-D10, N1-N6)

| | State | What changes |
|---|---|---|
| D1 | opens | four idle cards, This one off, Hoya `idle`, the romanization line held. Nothing plays by itself (there is no prompt sound; a card is the first sound) |
| D2 | tap a card | its clip plays (the disc fills while it plays), it is selected (the ring), This one turns on. `tapLight` haptic. Never scored |
| D3 | tap another | it plays and takes the selection; the first is plain again |
| D4 | pressed | the press look on the card under the finger; the selection stays where it was until the release commits the tap |
| D5 | wrong commit | the first commit is the scored try (F-001 §3.2). The card turns amber with the replay mark; the selection clears; This one is off; Hoya `thinking` (no words); the nudge haptic; the polite region says "Not this one: Sound 2. Try another." once |
| D6 | after a miss | another card is selected; the amber card plays again on a tap without taking the selection; nothing is taken back |
| D7 | right commit | green with the check; the syllable shows its romanization (fades in over `motion.duration.base`; at once under reduced motion); the right card plays once more; Hoya `cheering`; the dot fills; "Right answer: geu." said once (before the replay); the round moves on after the replay (refinement 6) |
| D8 | a closed item | the same round with a syllable that has a final (둠 → dum) |
| D9, D10 | keyboard / switch focus | the focus ring on a selected card (outside its ring) and on This one |
| N1 | Sound off | each card shows its Latin sound chip; the syllable stays Hangul only; the hint's place reads "Sound is off."; the help slot is Turn sound on. A tap selects (nothing plays). The item still scores |
| N2 | the clip could not play (failed, blocked, the pack failed to load or offline) | the chips; "The sound did not play."; Try again |
| N3 | Show the letters | the chips with a small speaker (the cards still play); the link is gone (the text is up, CH §3.2) and its slot keeps its room; the hint stays |
| N4 | Can't hear it? | the CH sheet (SheetFrame): the one device line, **Show the letters** (primary), **Hear it** (secondary; refinement 7) |
| N5 | Sound off, right | the chips stay; the syllable shows its romanization |
| N6 | the clip pack still loading | the board holds the cards (no tap, no look change) and Can't hear it? is drawn inactive, as CH §3.2's hold, up to `VOICE_CHECK_HOLD_MAX_MS`; then D1, or N2 if the pack failed. A card never selects silently because its clip was not there yet |

Why the full sheet and not the guidance-only one (CH §3.1, the cue rule; CH-1g makes Dictation in a Check guidance only because its text prints the word to type): here Show the letters prints **all four** options' romanization and the syllable stays Hangul only, so the text names no option as the answer and the round stays a reading item (Hangul to sound value), as §3.5 says; the balanced set keeps the chips from pointing at the target by their pattern. A Check's text is the romanization only (§3.2, OD-DC2): no Hangul is added anywhere. The Hangul Check records no hinted mark (its host drops `meta.hinted`, CH-1f); the answer counts as usual.

## The version 2 part (`part-v2.html`)

Part 1 is 2 decode, 3 names, 1 final, 1 word (§3.4); parts 1-2 the same, parts 3-4 3, 2, 1, 1, part 5 2, 2, 2, 1. The board plays part 1: the decode segment (`DecodeRound`: 그, then 둠, different initials), then Listen & Pick in the review host for the names (ㅂ: a letter neither decode target holds, §3.4 step 2) and the final (안), then the word, then the pause (C).

- **One header for the whole part**: Stop the check and one `Progress` of 7 fill-only dots, filling one per finished item and never going back, the same on every segment. The switch from `DecodeRound` to Listen & Pick is invisible in the header.
- **Recommendation for DC-2d (OD-DC11 (a) as planned)**: the part player draws the header once, above the segments, rather than each game drawing its own dots with an offset. Two findings support it: (1) the review host's Listen & Pick draws **no Stop the check today** (the wireframe's `[x]`; `learner.stageReview.leave.close` exists and nothing in `apps/mobile/src` renders it; only the system back opens E), and (2) its round heading says "Question 1 of 5" in a names segment (`a11y.answer.round(roundIdx + 1, rounds.length)`), which must read "Question 3 of 7": the spoken count needs the part offset whichever way the dots are drawn. If DC-2d keeps the dots in Listen & Pick instead (the spec's "dots offset"), both the value and the spoken count take the offset.
- **A decode reveal must not show a letter the part's name or final items ask next**: the reveal (geu, dum) prints a letter's sound just before the name items. §3.4 step 2 (names first from the letters no decode target holds) covers the names; DC-2d's builder test adds the part rule for names and finals (a closed target's final is not the final asked in the same part), or records where the draw cannot meet it.
- After a decode segment, the first Listen & Pick round plays its prompt by itself (the This one tap was the gesture) and its speaker does not pulse.
- The name and final rounds hold their options' romanization until the answer (DC-1a, as built); the board shows it.
- The pause is drawn as built (Hoya `cheering` 120, the line, Keep going `hero`), with DC-2d's line "Nice work! Ready for more?".

## Accessibility

- **Touch targets**: every control is at least 64 x 64 at every size and text size (checked on every frame); the cards are 96 high (108 at Largest, 121 at 200 %) inside a 110 target; This one is 80 (`lg`) or 64 (`md`, tight arrangements).
- **Focus and reading order** (`decode-a11y.html`), the same in every arrangement and orientation: (1) Stop the check; (2) the dots, "Progress, 0 of 7" (a progress value, not drawn); (3) the round's heading node, where focus goes when a round opens: "Question 1 of 7. Read it. Which sound is it? Tap a sound to hear it. Then tap This one. geu" (the hint stays in it where it is not drawn; the syllable is its romanization read as a sound value through `a11yRomanization`, as Listen & Pick's text-prompt label; the panel itself is hidden); (4-7) the cards; (8) This one; (9) Can't hear it? (or the status action). The help slot comes after the answers, as wireframe B2 draws it: the cards are this round's speakers, and CH §3.7's "after the speaker" puts the link after them.
- **Names**: a card "Sound 2 of 4" (`a11y.minigame.soundOption`); selected "Selected: Sound 2 of 4" (`a11y.minigame.option.selected`, as Pic-Word Match: a web button does not read `aria-selected`, so the state is in the name); wrong "Not this one: Sound 2 of 4" (still plays; never "disabled"); right "Right answer: Sound 3 of 4"; with the chips "Sound 1 of 4: gom" (`a11y.minigame.soundOptionText`, new). This one: "This one", dimmed, before a selection; "This one: Sound 2" after. Each visible label is inside its name (WCAG 2.5.3).
- **Live region**: one polite region, always mounted, says the result of a commit once ("Not this one: Sound 2. Try another." / "Right answer: geu."); the iOS path calls `announceForScreenReader`; the replay and the move to the next round wait for it (refinement 4). Selecting and playing announce nothing beyond the name change.
- **Known limit** (spec §4, unchanged): the heading names the syllable by its romanization, so with a screen reader the item is a listening match, not reading evidence.
- **Colour**: every state has a non-colour cue: selected = the ring (a shape), playing = the filled disc (and the sound), wrong = the replay mark (`text.primary` on `nudgeLight`, 14:1; the amber border itself is 1.8:1 on canvas, so it is never the only cue), right = the check and the shown romanization; off = the dimmed look and the "dimmed" state. Contrast from the token values: the selection ring `brand.primary` on canvas 5.1:1; the card border `border.shape` 4.3:1 on canvas, 4.6:1 on paper; the disc border `brand.secondary` on paper 5.2:1, its glyph `brand.secondaryDark` on `secondaryLight` 5.8:1, the playing glyph white on `brand.secondary` 5.2:1; the chip text 13.6:1 on sunken, its border 3.8:1; the focus ring 4.1:1 on canvas. This one off: `text.muted` on sunken is 5.1:1, and at the Button's 0.6 opacity over canvas 2.4:1 (an inactive control, exempt; the shipped soft-disabled look, unchanged here). `feedback.danger` is never drawn (checked).
- **Reduced motion**: no press shrink, no fade of the romanization line; the disc still fills while a clip plays (a state, not motion).

## Strings (proposed for DC-2d; en here, es and ko in DC-2d with the multi-agent review and the ledger, §3.8)

| Key | English | Note |
|---|---|---|
| `learner.stageReview.decode.heading` | Read it. Which sound is it? | spec §3.5 |
| `learner.stageReview.decode.hint` | Tap a sound to hear it. Then tap This one. | **new, proposed by DC-2a**: the check's one new interaction; one line names both steps |
| `learner.stageReview.decode.sound` | `(n) => Sound ${n}` | spec §3.5 |
| `learner.stageReview.decode.pick.cta` | This one | spec §3.5 |
| `a11y.minigame.soundOption` | `(n, total) => Sound ${n} of ${total}` | spec §3.5 |
| `a11y.minigame.soundOptionText` | `(n, total, sound) => Sound ${n} of ${total}: ${sound}` | **new**: the chips shown; `sound` through `a11yRomanization` |
| `a11y.minigame.pickSound` | `(n) => This one: Sound ${n}` | **amended** from "Pick sound 2" (refinement 5) |

Reused unchanged: `learner.stageReview.leave.close`, `learner.audio.cantHear.*`, `learner.audio.hearIt.cta`, `learner.audio.soundIsOff`, `learner.audio.didNotPlay`, `learner.audio.action.turn_on.cta` / `try_again.cta`, `common.buttons.close`, `a11y.answer.round` / `.right` / `.miss`, `a11y.minigame.option.*`, `a11y.progress.*`. No age wording, no number of right answers, no banned word (checked against `packages/i18n/src/banned-words.json`). "Tap" is the app's word on every learner surface; the spoken heading keeps it.

## Constants

| Where | Value | From |
|---|---|---|
| Progress dot | 12 | `Progress.tsx` default height |
| Disabled / soft-disabled button opacity | 0.6 | `Button.tsx` |
| Press shrink | 0.97 | `PRESS_SCALE`, `press-look.ts` |
| Mark disc padding | `spacing.xxs` | ChoiceCard tile mark |
| Pause Hoya | 120 | `StageReviewScreen.tsx` pause phase |
| Pack hold | `VOICE_CHECK_HOLD_MAX_MS` | `use-prompt-slot.ts` (CH §3.2) |

## For DC-2d

- `decodeRoundView(item, state)` (pure, for the screen and the bot of §3.9): card states, `selected`, `playing`, `pickEnabled`, the names above, whether the chips show (`text: null | 'muted' | 'failed' | 'asked'`), the help slot, the hold while the pack loads; reducer events `tap(i)`, `played(i)`, `commit`, `showLetters`, `muted`, `failed`, `packReady`.
- **The cards are one tap board** (AMENDMENTS-TOUCH §6): `TapBoard lock="board"`, each target a `TapTarget` with the ring frame as its `style` (the hit area), the graze and bounce rules as Listen & Pick's board, `held` while the pack loads; a resolved round's cards are `inactive` (focusable, not disabled). In the touch matrix a tap that moves the selection counts as a commit of that tap (it plays and selects); only This one answers.
- The arrangement: a pure function of the Screen's content box and the text-size scale, evaluated once per item from its tallest state, with the part heights of this note (as `traceLayoutMode`); the side trigger is `GameColumns`' (`pictureTextArrangement`).
- Clips from the one pack of §3.4 (`useClipPacks`); a card whose clip is missing counts as a failed play (N2) for the item, never a silent card.
- No UI sound on a card tap (the clip is the sound); the commit's cues and haptics as Listen & Pick in the review host, ordered after the screen reader's line (refinement 4).
- The bot (§3.9) reads `decodeRoundView` and the rendered tree: before the right commit no visible text is an option's romanization unless the chips show (checked on this mock: the "hold" check of `measure.mjs`).

## Open items

- **OQ-1 (owner)**: Hoya in the syllable panel (idle, thinking after a miss, cheering on the right commit; no words). The review host's Listen & Pick rounds draw no Hoya today, so within a part only the decode items have him. Recommendation: keep him in the decode round (CLAUDE.md §1: a miss uses amber and Hoya's thinking pose); adding the same silent figure to the review host is a separate F-QUEST-002 §3.10 change, not proposed here.
- **OQ-2 (owner)**: the hint line `learner.stageReview.decode.hint` is new copy beyond §3.5. Recommendation: keep it (the round's one new interaction, both steps named). The tight arrangements do not draw it.
- Largest text on 320 x 568, and a device font taller than Chromium's at 667 x 375: see "Arrangements"; DC-2d's text-size and layout runs settle them.
- The theme pictures of the word round and the Listen & Pick looks are drawn only for the part's header; their own look is unchanged by this row.

## Review log

- 2026-11-26, multi-agent review (two lenses: interaction and visual design against the design system and the spec; accessibility and decoding validity). Both reviewers re-ran `tools/measure.mjs` (and `--matrix`); the table and every check matched, and every contrast figure was recomputed from the token hex values.
  - **Blockers**: none.
  - **Majors, fixed**:
    - The closed example target 곰 is a practised Stage 1 word (Discover example, a Check's right answer, a vocab card), against §3.4 "Not practised" → the target is 둠 in the same set (곰 only an option); the note states the exclusion.
    - The part board's two decode items shared the initial ㄱ (§3.4 step 1) and the name item asked ㄱ just after the reveal "geu" → 그 and 둠 (ㄱ, ㄷ), the name item asks ㅂ, and the part rule for reveals is handed to DC-2d's builder test.
    - With a screen reader, "Right answer" and the replay talked over each other and the advance cut the iOS announcement → refinement 4 covers commits: the line first, then the replay, then the move (refinement 6).
    - The replay mark sat on a card that could not play, and a locked card stopped the learner comparing sounds → a wrong card still plays on a tap and cannot be selected (refinement 2).
    - The selection ring was named after `choiceCardRingStyle` (dashed, the look-here ring) and sat outside the touch area → a solid `brand.primary` ring frame that is part of the target (Pic-Word's `targetStyle`, KT-4b), nothing moving at rest.
    - The note said the refinements were recorded in the spec, but no spec line had changed → this PR amends OD-DC10, §3.5, the strings line, the DC-2a row and wireframe B2.
  - **Minors, fixed**: This one changed width when the help slot emptied or changed → the slot keeps its room and an equal share; the chip is taller than the disc at 200 % → stated (one change, at the learner's request); wrong and resolved cards were marked `aria-disabled` → inactive in the board, never announced disabled; the Largest 320 x 568 note → re-measured and restated; the touch-board rules → "For DC-2d"; no pack-loading state → N6; focus order changed with orientation → one order (the help slot after the answers) in every arrangement; the hint did not name the commit → "Tap a sound to hear it. Then tap This one."; the off label's real contrast and the amber border's 1.8:1 → stated; "Sound 2" capitalised in every name; the 1180 x 820 columns top-aligned; the focus ring no longer reaches a neighbour (it sits outside the 7 ring frame and the grid gap is outside both).
  - **Kept**: "Tap" in the spoken heading (the app's word on every learner surface); 그 in the sprint's drill pool (preferred out, not excluded; an illustration).
