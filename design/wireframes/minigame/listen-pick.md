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
