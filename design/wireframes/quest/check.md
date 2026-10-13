# Quest/Check — two quick questions (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.3 (Check step), §3.1 (step kinds), §3.10 (Listen & Pick, check mode), §6 PR Q-5a
Extends: `design/wireframes/quest/player.md` (6-step shell) · the game itself is `minigame/listen-pick.md`
Audience: **any learner, any age** (CLAUDE.md §1); same screens for everyone. Wireframe level: structure, flow, interaction points; text in (parentheses) is a placeholder.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( ) (*)` dots (fill-only), `~~` taught Korean with romanization (`KoreanText`).
Code: `apps/mobile/src/screens/quest/QuestPlayerScreen.tsx` (launcher), `apps/mobile/src/logic/quest-flow/check-launcher.ts` (`launcherView`), `apps/mobile/src/screens/minigames/ListenPickGame.tsx` (host mode `check`)

> Promoted 2026-10-12 from the drafted screen S3 of `quest/discover.md` (F-QUEST-002 PR Q-11).

## Scenario (Given-When-Then)

Given: a learner finished the two games of a Stage 1 quest
When: the player reaches step 5, `check`
Then: a short launcher says "Two quick ones" with one Go button and no Skip; two Listen & Pick rounds follow (round 1: the quest's focus, a symbol, a syllable or a picture; round 2: a reading word built only from letters taught so far), scored first try like any round; then the reward step

## Screen goal

"Show that you can read what you just learned, in about half a minute."

## Box diagram

```
A. Launcher (quest/player, step `check`)
+----------------------------------+
| [x leave]  o o o o (*) .  (5 / 6)|  <- same header as every step
|  (Quick check)  [step pill]      |
|                                  |
|   (Hoya small)  "Two quick ones" |  <- one line
|                                  |
|   [[ GO ]]                       |
|                                  |  <- no "Skip for now" on this step
+----------------------------------+

B. Round (Listen & Pick, check mode; see minigame/listen-pick.md)
+----------------------------------+
| ( ) ( )            (Quick check) |  <- two fill-only dots, never "1 / 2"
|        [[ (speaker) ]]           |  <- round 1 waits for a tap; round 2 plays on open
|        [ Hear it again ]         |
|  [ ~~ ㅓ ~~ ] [ ~~ ㅏ ~~ ]         |  <- 2-4 options from the confusable table,
|  [ ~~ ㄱ ~~ ] [ ~~ ㄴ ~~ ]         |     filtered to letters already taught
+----------------------------------+
```

- A wrong tap is amber with Hoya `thinking`; the round stays open until the right tap; only the first answer counts.
- The Check adds 2 rounds to the quest's total (practice 6 + apply 4 + check 2 = 12).
- A quest with a Check shows no separate Feedback Review (F-RVW-001 §3.3, amended).

## Interaction points

- [[ GO ]] -> B (the `Minigame` route, host mode `check`)
- Option tap -> first answer scores (`answerRound`, key `${stepIndex}:${roundIdx}`); the right tap ends the round
- Back from B -> A with the scored keys kept; re-answers count as retries (no double counting)
- After round 2 -> step 6 `reward`; `quest.check_completed { questId, firstTryCorrect, retries }`
- [x leave] -> the quest's leave sheet

## Navigation graph

Enter from: `quest/player` step 4 (`apply`)
Exit to: `minigame/listen-pick` (push, returns) · `quest/player` step 6 (`reward`) -> `results/celebrate` · leave sheet -> `episode/detail`

## States

- **success**: A -> B (2 rounds) -> reward.
- **empty**: a check scope with no valid round shows "Nothing to play here" and Back (never a dead end; the content test keeps it out of shipped data).
- **no sound**: the prompt shows as text ("No sound? Read it here."); the round scores normally.
- **tap mode**: option romanization hides until tapped (D2 opt-in); the gloss is never hidden.
- **reduced motion**: no pulse; instant changes.

## Data needs

- reads: `questById(id).steps[]` (the `check` step's `minigameRef`) · `scopeFor(ref).listenPick.rounds` (exactly 2) · `romanizationMode`
- writes: `quest-run-store` (first-try tally through the host)
- telemetry: `quest.check_completed { questId, firstTryCorrect, retries }` · existing `minigame.finished`

## Open questions

- None for the shipped quests. Adopting a Check in the Stage 2 / Stage 4 taste quests is data only (F-011, F-012).
