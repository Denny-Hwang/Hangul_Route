# Quest/Player — the 5-step quest shell (wireframe v1)

Spec: `.claude/skills/content-skill/SKILL.md` (Quest 5-step timing: intro → present → practice → apply → reward) · `packages/content-schema/src/schemas/quest.ts` (`QuestStepKind`, 3–7 steps) · `docs/blueprints/10-app-map.md` §3.1, §4.1
Audience: **learner (P4/P5 child, 5–11)**
Code (back-filled): `apps/mobile/src/screens/quest/QuestPlayerScreen.tsx` — route `QuestPlayer { questId, episodeId }`; run state in `store/quest-run-store.ts`

## Scenario (Given-When-Then)

Given: a learner tapped Start on a quest (from Episode, Home or the first-quest preview)
When: the player opens
Then: they move through the quest's steps one at a time — Hoya talks in narrative steps, a minigame opens in play steps — and finish on the results screen without ever seeing a step list

## Screen goal

"Move the child through the quest's steps with one button per step."

## Box diagram

```
Narrative step (intro / reward):
+----------------------------------+
| [x quit]  o o . . .   [2 / 5]    |  <- step dots + count pill (quit: see open q)
|                                  |
|  Step title (title)              |
|  [step pill: "Hello"]           |  <- learner label, never the raw kind
|                                  |
|  +----------------------------+  |
|  |        [HOYA waving]       |  |  <- reward step: Hoya cheering, success tone
|  |  ( bubble: hoyaLineEn or   |  |
|  |    bodyEn, 1-2 lines )     |  |
|  +----------------------------+  |
|                                  |
|   [[ CONTINUE ]]                 |  <- reward step: [[ SEE RESULTS ]]
+----------------------------------+

Play step (present / practice / apply):
+----------------------------------+
| [x quit]  o o o . .   [3 / 5]    |
|  Step title                      |
|  [step pill: "Practice"]        |
|                                  |
|  "Ready for a quick game?"       |  <- 1 line + 1 muted line
|                                  |
|   [[ PLAY MINIGAME ]]            |  -> minigame/shell
|   [ Skip for now ]               |  <- ghost, see open q
+----------------------------------+
```

Step sequence (content-skill): intro (narrative) → present → practice → apply (each a minigame) → reward (narrative). The pill shows a learner label (`logic/quest-steps.questStepLabel`): Hello · Look and listen · Practice · Try it · Finish. Schema allows 3–7 steps; the dots row is driven by `quest.steps.length`.

## Interaction points

- [[ CONTINUE ]] → next step (`goNextStep`); on the last step → `results/celebrate`
- [ Previous ] (step 2 or later) → the step before; see "[QB] Previous" below
- [[ PLAY MINIGAME ]] → `minigame/shell` `{ questId, episodeId, stepIndex }` (push). The shell records rounds into the run store, calls `markStepComplete`, then `goBack()`; on re-focus the player consumes the pending advance and shows the next step. The launcher card is therefore never seen twice for one step.
- [ Skip for now ] → next step without recording rounds
- Hand-off to `results/celebrate`: the stack is **reset** to `Main` → `Results { stars, correct, total }` so hardware back from results cannot re-enter a finished quest
- [x quit] → confirm sheet (1 line, 2 buttons) → `episode/detail`; run store reset, session ended. **Not in shipped code** (see open questions).

## Navigation graph

Enter from: `episode/detail` · `home/todays-mission` (cards ①②) · `homework/list` · `onboarding/first-quest-preview` (target)
Exit to:    `minigame/shell` (push, returns) · `results/celebrate` (reset) · `episode/detail` (quit)

## States

- **success**: steps advance in order; dots fill; last step hands off to results.
- **empty** (quest has no steps / `questId` unknown): one-line "quest not found" + back to `episode/detail`; never a frozen shell.
- **error** (minigame ref unresolved for a play step): show the narrative body with Hoya "let's skip this one" + [[ CONTINUE ]] — the quest must always be finishable. Session end on unmount is guaranteed by the effect cleanup.

## Data needs

- reads: `questById(id).steps[]` (kind, titleEn, bodyEn, hoyaLineEn, minigameKind, minigameRef, durationSeconds) · active profile
- writes: `quest-run-store` (stepIndex, correct/total, pendingAdvance) · `progress-store.beginSession/endSession(profileId)`
- telemetry: none on this screen; `minigame.finished` fires in the shell, `quest.complete` on results

## [QB] Previous: a step can be taken back (AMENDMENTS-QUEST-SOUND-BACK QB-2, QB-3)

Owner request 2026-11-17: "I sometimes move on without meaning to." From the second step on, every step has [ Previous ] beside its main button. It is not the header's [x leave] and not the browser's back: those still ask the leave question.

```
Narrative step, step 2 or later:        Play step, first visit:               Play step or Check, shown again (revisit):
+--------------------------------+     +--------------------------------+    +--------------------------------+
| [x]  o o o . . .      (3 / 6)  |     | [x]  o o o . . .      (3 / 6)  |    | [x]  o o (o) o o .    (3 / 6)  |  <- dots: furthest step;
|  Step title  [step pill]       |     |  Step title  [step pill]       |    |  Step title  [step pill]       |     (o) = the step shown
|  ( Hoya's card )               |     |  "Ready for a quick game?"     |    |  "Ready for a quick game?"     |
|                                |     |                                |    |                                |
| [ Previous ] [[ CONTINUE ]]    |     | [ Previous ] [[ PLAY ]]        |    | [ Previous ] [[ CONTINUE ]]    |
+--------------------------------+     | [ Skip for now ]               |    | [ Play again ]                 |  <- no Skip for now
                                       +--------------------------------+    +--------------------------------+
```

- [ Previous ] -> the step before (`goPrevStep`), whatever its kind; a Look and learn step opens on its last page. Any sound stops.
- A step behind the furthest step reached is a **revisit**: a teaching step looks as it did; a game step or the Check shows [[ CONTINUE ]] (forward, `goNextStep`) and [ Play again ] (opens the game). The Check still has no Skip.
- Step 1 has no Previous; Results has none; a game in play has none (its Close returns to the launcher).
- Nothing tallied changes: stars, right answers, misses and retries stay; a game played again scores nothing; a skipped game stays skipped unless it is played in full on the revisit (QB-3). The step dots never go down.
- A reload resumes at the furthest step (QB-4).
- Narrow window or Largest text: the row wraps, main button first, then Previous.
- Mock: `design/screens/quest-previous/`.

## Open questions

- **Discrepancy / safety**: there is no quit control; only hardware back leaves a quest, and it lands wherever the stack came from. Add [x quit] top-left with a confirm sheet (wireframe above).
- **Discrepancy**: skipping every minigame ends with `correct || 5, total || 5` → 3 stars and a card for zero play. Should Skip count as 0/0 (results with 0 stars, no card) or should Skip be removed from `present` steps entirely? Recommend: Skip only on `apply`, and 0/0 → 1-star "you tried" path.
- `durationSeconds` exists in content but nothing on screen uses it. Show nothing (default) vs. a tiny "about N min" on the launcher.
- Should the reward step be merged into `results/celebrate` (one celebration surface, F-RVW-001 §3.3 also wants a feedback question there)? Two consecutive "yay" screens may dilute the card moment.
