# Minigame/Block Sprint: the Decoding Sprint, a one-minute bonus after Stage 1 (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F9 (Decoding Sprint: "uses `syllable-build` and Listen & Pick", S1 review, fallback hidden; an optional 60-second bonus like the vocab Speed Round; real syllables only, from the Stage 1 table and an allowlist the device voice is tested on; a held-out probe of syllables not drilled in any sprint, which G9 measures; a private personal best, never compared), OD-8, §3.2 G9, §7.7 (a clock only in an optional bonus), §11.3 (`decode.sprint.finished`), §12.2 (`decodingSprint`), §19 assumption 5 · built in row **CM-32**, which `syllable-build.md` (open question 2) leaves to draw this frame from `vocab/speed-round.md` · extends `vocab/speed-round.md` panels G (the Challenge clock and Pause) and H (results), and reuses this row's Syllable Build round and its fallback's Listen & Pick round unchanged
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. Text in (parentheses) is a placeholder; the shipped strings are `learner.decodingSprint.*` and the reused `learner.vocab.speed.*`.
Code: `apps/mobile/src/screens/decode-sprint/DecodingSprintScreen.tsx` and `SprintPick.tsx` (the Syllable Build chunk); pure rules `apps/mobile/src/logic/syllable-build/sprint.ts` (plan, clock, result, event) and `pool.ts` (the real blocks and the held-out probe); the device record `apps/mobile/src/store/decode-sprint-store.ts`; the door `apps/mobile/src/screens/minigames/syllable-build-entry.tsx` (`DecodingSprintOffer`, `DecodingSprintRoute`)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ x ~~` taught Korean with romanization, `( x )` a placeholder.

## Name on screen

The spec's format name is the Decoding Sprint; the learner sees **Block Sprint** (`learner.decodingSprint.title`): "block" is the word the Stage 1 lessons teach, and "decoding" is above the plain English (Pre-A1) every learner string keeps.

## Scenario (Given-When-Then)

Given: a learner who has finished Stage 1, with `decodingSprint` on
When: they tap Block Sprint under the Stage 1 header of the Journey or on the Hangul Check results, then Start
Then: one minute of quick rounds (hear a real block, then pick it or build it), then a few blocks with no clock, then a count of blocks read beside their own best, never compared with anyone

## Where it is offered

- **Journey, Stage 1 header** (under the stage's cells, the stage footer slot of row CM-25), once Stage 1 is complete (the same rule as the Hangul Check button beside the stage pill): the bonus line "(Bonus round: read as many blocks as you can in one minute.)" and a secondary [ Block Sprint ] button. It stays there, so a learner can sprint again any day.
- **Hangul Check results** (the Stage 1 review of F-QUEST-002 §3.9), above Back home: the same line and button, the "Stage 1 review bonus" of §7.1.
- Never in a guest run (its first quest is all it plays), never for a grown-up persona, never while `decodingSprint` is off (built-in pct 0, so the row merges dark). Off: no line, no button, and the route goes back.

## A. Intro

```
+--------------------------------+
| [x]                            |  <- screen header (Close): leaving saves nothing
| (Hoya waving)                  |
| (Block Sprint)                 |  <- title
| (One minute on the clock. Hear |
|  a block, then pick it or      |
|  build it.)                    |
| (Then a few more blocks, with  |
|  no clock.)                    |
| [[ Start ]]                    |  <- vocab.speed.start
+--------------------------------+
```

## B. The drill (one clock for the minute)

```
+--------------------------------+
| [x]                            |
| [######------]   (0:42) [Pause]|  <- the vocab Challenge clock (ClockBar, ClockDigits): one bar in one-second
|                                |     steps, no pulse, no colour change; "A few seconds left" in the last ten
| (Which block do you hear?)     |  <- a pick round: Listen & Pick's heading, the speaker, 4 block options
| [(spk)]                        |     (Korean only, 2 x 2 at 320; never the romanization, which would answer it)
| [ ~~ 밥 ~~ ] [ ~~ 반 ~~ ]       |
| [ ~~ 방 ~~ ] [ ~~ 법 ~~ ]       |
+--------------------------------+
```

- **Rounds.** Real blocks only (the Stage 1 table and the allowlist, `pool.ts`), in a seeded order for this learner and sprint, never one of the held-out probe blocks, as answer or option. With `game.syllable-build` on every other round is a Syllable Build round (this row's board, unchanged: jamo-only tiles, the romanization held back); off, every round is a pick.
- **A pick.** One tap. Right: the card's check and the block with its romanization for 0.6 s. A miss: the tapped card amber with the dash (never red, never an X), the right card checked, 1 s; no retry, no count of misses. The round then moves on by itself.
- **A build.** As in Syllable Build: the first full block is the round's answer; a miss marks the zone in amber and says where to listen, and the learner fixes it; a right block is said, then the next round.
- **The clock** runs only while a round waits for its answer: it stops while an answer shows, while paused, and when the app goes to the background (which pauses). When it runs out the round on screen is simply dropped, never a miss.
- **Pause** (ghost button): the round is hidden (panel G' of the Speed Round: "Paused", [[ Resume ]], [ Stop ]), so a pause cannot be used to study it. Resume brings the round back; if it was showing its answer, the next round comes up. Stop leaves; nothing is saved.

## C. Time's up, then the probe

```
| (Hoya) (That's the time! Nice work.)   |  <- 1.2 s, vocab.speed.challenge.timeUp
| (Hoya) (A few more blocks. No clock    |
|  now.)                                 |
| [[ Start ]]                            |
| (Which block do you hear?) ...         |  <- 6 pick rounds, no clock on screen
```

- **The held-out probe.** Six pick rounds, one whole matched form of blocks no sprint ever drills (`PROBE_FORMS`, 4 forms of 6: allowlist blocks that are not in the Stage 1 table and are no review item or taught word of any stage); the n-th sprint takes form (n - 1) mod 4, so the first four sprints each probe blocks never shown before. Always picks, so the format is the same in every sprint and G9 compares like with like. A probe round's options are drill blocks, never another probe block. No clock on screen; the foreground time from each round coming up to its first tap is kept for the probe's rate (right first tries per minute), never shown.
- **The probe only measures.** One tap, then no right or miss and no answer: no check, no dash, no romanization, no success or nudge haptic. Every card dims for 0.4 s and the next block comes up, so a probe block is never practised with feedback. With no device voice the round shows the block's romanization as the drill does, and that sprint sends no event (a read probe is a different task).

## D. The result

```
+--------------------------------+
| (Hoya cheering)                |
| (14 blocks read)               |  <- the blocks read right on the first try in the minute
| (New best!)                    |  <- only from the second sprint, only above the learner's own best
| (Your best: 16)                |  <- from the second sprint: the learner's own best, this device only
| [[ Play again ]]               |
| [ Done ]                       |
+--------------------------------+
```

- A count only: no percentage, no "n of m", no time per block, no misses, no comparison with anyone (§7.7, the `review-copy` rule reads `decodingSprint`). The best is never sent: `decode.sprint.finished` carries three bucket codes (the drill rate, the probe rate, the sprint index), parsed before it is sent.
- The record (`decode-sprint:<profileId>`, sprints finished and the best) stays on this device; Remove from this device removes it.

## No device voice

The prompt is the block's romanization (`bap`) with the sound notice (`PromptPanel`, "No sound? Read it here." and why), and the learner finds or builds the block they read; the build round shows the romanization from the start, as Syllable Build does. The rounds and the rate are the same.

## States

- **loading** (the chunk or the record): the lesson waiting screen.
- **reduced motion**: nothing moves; the reveal pauses stay (they are reading time, not animation).
- **large text (150 %, 200 %)**: the round scrolls under the clock row; options keep their minimum size; Pause stays reachable.
- **screen reader**: the clock is read on focus only, never a live region ("Time left: 42 seconds"); the answer line is a polite live region.

## Accessibility and targets

- Every target at least `touchTarget.min` (64; the 48 dp floor of §14 met): the speaker, the options (at least `touchTarget.hero` wide), the tiles and zones of a build round, Pause, Resume, Stop, Start, Play again, Done.
- No colour-only state: right has the check, a miss the dash or the mark dot.

## Navigation graph

Enter from: `journey/grid` (Stage 1 footer) · `reviews/hangul-check` results · Exit to: where it came from (Close, Stop, Done) · Play again starts the next sprint on the same screen.

## Strings

New (`learner.decodingSprint`, with es and ko): `title`, `offer`, `intro`, `introPick` (the intro while `game.syllable-build` is off: "One minute on the clock. Hear a block, then pick it."), `introProbe`, `probe`, `read(n)`, `best(n)`, `done`. Reused: `learner.vocab.speed.start`, `.challenge.pause / paused / resume / stop / fewSeconds / timeUp`, `.results.newBest / playAgain`, `a11y.vocab.speed.timeLeft`, `learner.minigame.listenPick.heading`, `a11y.minigame.option.*`, `a11y.minigame.hearAgain`, `learner.audio.*`, and every Syllable Build string.
