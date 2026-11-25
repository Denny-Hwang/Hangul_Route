# Minigame/Listen & Pick: sound to written symbol, word or picture (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.10 (PR Q-3b) · promoted from S4 and S5 of `design/wireframes/quest/discover.md` (that file keeps the full set of screens until the other promotions land) · extends `design/wireframes/minigame/shell.md` and `families.md` (Family Recognition) · audio states: `design/wireframes/minigame/audio-fallback.md`
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Code: `apps/mobile/src/screens/minigames/ListenPickGame.tsx`; pure rules in `apps/mobile/src/logic/listen-pick-flow.ts` and `listen-pick.ts`; option card: `design/components/ChoiceCard`, taught Korean: `design/components/KoreanText`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization (`KoreanText`), `{ x }` content-driven, `( ) (*)` fill-only dots, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Listen & Pick step (the two-question Check, a practice step, later the Hangul Check)
When: the learner hears a sound, word or line and taps the option that matches
Then: a miss is a soft amber nudge and a second listen, the right tap is a green check and the next round, and a missing voice turns the sound into text so the game never goes silent

## Screen goal

"Hear it, pick it. A miss only means listen again."

## Box diagram

Text options (S4):

```
+----------------------------------+
| ( ) (*)       (Quick check) [x]  |  <- Check: 2 fill-only dots + title; practice: bar + "n / N"
|                                  |
|  (Listen, then pick)             |
|        [[ (speaker) ]]           |  <- hero-size; round 1 waits for a tap (pulses once), later rounds autoplay
|        [ Hear it again ]         |  <- unlimited
|                                  |
|  +-----------+  +-----------+    |
|  |  ~~ 가 ~~ |  |  ~~ 거 ~~ |    |  <- 2 columns for short text; 1 column when long or narrow
|  |  (ga)     |  |  (geo)    |    |  <- romanization visible (hidden until tap only if opted in)
|  +-----------+  +-----------+    |
|  +-----------+  +-----------+    |
|  |  ~~ 나 ~~ |  |  ~~ 너 ~~ |    |
|  +-----------+  +-----------+    |
|                                  |
|  (Hoya thinking: "Listen again") |  <- only after a miss
+----------------------------------+
```

Picture options (S5):

```
+----------------------------------+
|  ( ) (*)                         |
|        [[ (speaker) ]]  [Hear again]
|  +--------------+ +--------------+|
|  | {picture}    | | {picture}    ||
|  | (English     | | (English     ||  <- label stays visible (it is also the accessible name)
|  |  label)      | |  label)      ||
|  +--------------+ +--------------+|
|  +--------------+ +--------------+|
|  | {picture}    | | {picture}    ||
|  +--------------+ +--------------+|
+----------------------------------+
```

States of one round:

```
asking:   nothing on screen gives the answer away; no gloss
miss:     tapped card = amber + mark, stays locked; Hoya thinking: "(Listen again)"; sound replays after 0.8 s unless the learner acts first
2nd miss: the right card gets a "look here" ring (not in the Hangul Check)
hit:      card = green + check mark; the prompt's romanization + gloss appear; sound once more; next round after 0.7 s
no sound: the prompt zone becomes text: ~~ Korean ~~ + (romanization)  "(No sound? Read it here.)"; the round scores as usual
empty:    "(Nothing to play here)" + [ Back to quest ]
```

## Interaction points

- **Speaker / Hear it again**: plays the prompt (`playPrompt`); unlimited; cancels a pending replay.
- **Option card**: the first answer in a round is the scored one; a miss never ends the round; the right tap ends it. Only the first touch in a 50 ms window counts.
- **Round advance**: automatic, 0.7 s after the right tap; after the last round the step is complete.
- **Leave**: the quest player's own leave control (this screen adds none).

## Navigation graph

Enter from: `quest/player` (a `check` or `practice` step with a `listen-pick` scope) -> `minigame/shell` (push, returns)
Exit: the last round -> back to `quest/player` (step complete) · empty scope -> back to `quest/player`

## States

- **success**: as drawn.
- **empty**: a scope with no valid round shows one line and a Back button.
- **error**: audio failure, unavailable voice or sound switched off -> the prompt as text; a round whose answer is not among its options is skipped (and caught by the content test).
- **offline**: all content is bundled; no Korean voice -> text, nothing blocks.
- **reduced motion**: the speaker does not pulse; states change instantly.
- **large text / small phone**: the body scrolls; options fall back to one column below 340 dp and for long text.
- **anti-shame**: amber + Hoya thinking on a miss; fill-only dots; no red, no timer, no number beyond "n / N" on a practice bar.

## Data needs

- reads: `scopeFor(ref).listenPick.rounds` (prompt `KoText`, 2-4 options with text or `pictureRef`, `answerId`) · `romanizationMode` (F-I18N-001)
- writes: `host.answer(roundIdx, correct)` -> `quest-run-store` (first-try tally); `host.complete()` -> `markStepComplete()`
- telemetry: `minigame.finished` `{ kind: 'listen-pick', questId, stepIndex }` (existing)

## Open questions

- The Hangul Check shows chunk dots instead of the bar; its header comes with the review screen (Q-10), this game keeps the bar until a host supplies chunk data.
- Should the text fallback also appear before the first tap when sound is already known to be off? Recommend no: the first tap reveals it, as in audio-fallback W2.

## [MP] Contrast round (plain, aspirated, tense)

Spec: `docs/specs/AMENDMENTS-MINIMAL-PAIRS.md` [MP] §3.5-§3.9 (row MP-2). A contrast round is a Listen & Pick round whose options are one approved **contrast set** (2 or 3 members that differ only in the first consonant's series: 가 / 카, 달 / 탈 / 딸). It lives in its own practice step (`contrast: true`) right after the quest's practice step; the step draws its rounds and targets per play: quest 6 "(Hear the Puff)", Stage 2 Letters quest 2 "(Soft, Puff or Tight?)". It is never scored and never shown as text.

Asking (same layout as S4; 2 or 3 text options, no picture):

```
+----------------------------------+
| (bar)                     n / N  |  <- N counts playable rounds only
|  (Listen, then pick)             |
|        [[ (speaker) ]]           |  <- clip only; never the device voice
|        [ Hear it again ]         |
|  (Can't hear it?)                |  <- guidance only (no Show the letters)
|  +-----------+  +-----------+    |
|  |  ~~ 가 ~~ |  |  ~~ 카 ~~ |    |  <- a word set adds its gloss after the answer
|  +-----------+  +-----------+    |
+----------------------------------+
```

Miss (the compare row replaces the 0.8 s replay):

```
+----------------------------------+
|  +-----------+  +-----------+    |
|  |  ~~ 가 ~~ |  |  ~~ 카 ~~ |    |  <- tapped card: amber + replay mark, locked
|  +-----------+  +-----------+    |
|  (Hoya thinking: "Listen to both.")
|  +--------------+ +--------------+
|  | ~~ 카 ~~      | | ~~ 가 ~~      |  <- right one first, then the one tapped; each plays in turn
|  | (Big puff,    | | (Soft, starts |     the one playing: outline + speaker glyph (not colour alone)
|  |  starts       | |  lower.)      |  <- each item is a button that plays it again
|  |  higher.)     | |               |
|  +--------------+ +--------------+
|  [[ Next ]]  (pair only)         |  <- a pair ends here, unscored; a triple stays open
+----------------------------------+
```

Hit: green + check (as S4); every option shows its kind line ("(Soft, starts lower.)", "(Big puff, starts higher.)", "(Tight, no puff.)"; ㅅ "(Soft, with a little breath.)", ㅆ "(A long, sharp hiss.)") and its gloss, and becomes a button that plays its clip; the prompt plays once more; next round after 0.7 s.

States:
- **not playable** (set not approved, a member's clip cannot play, sound off, "Always show the letters" on): the round is not shown; nothing is said or marked.
- **step with nothing to play** (no playable round, or fewer than two sets, or one series only; decided after the clip packs have loaded): the quest goes on to the next step (and back past it on Previous); no step screen; its step dot still fills.
- **clip fails while shown**: the round ends with nothing scored; the next one opens.
- **Can't hear it? opened**: guidance only; the step's later contrast rounds are dropped after this one.
- **large text / 320-wide window**: the compare row stacks its two or three items in one column and the body scrolls; Hear it again and the options stay reachable.
- **anti-shame**: amber and Hoya thinking only; no red, no counter, no timer; nothing counts toward stars.
