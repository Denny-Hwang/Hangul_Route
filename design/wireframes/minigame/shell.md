# Minigame/Shell — the common frame every minigame renders inside (wireframe v1)

Spec: `docs/blueprints/06-mini-game-catalog.md` §0.3 (5 common rules: ≤ 3 min, 5–7 rounds, fail-but-advance, touch only, sound + visual) · `.claude/skills/minigame-skill/SKILL.md` · `docs/specs/F-HOYA-001-hoya-character-system.md` (bubble tones)
Audience: **learner (P4/P5 child, 5–11)**
Code (back-filled): `apps/mobile/src/screens/minigames/MinigameScreen.tsx` (router by `scope.kind`) + one component per game; run state `store/quest-run-store.ts`

## Scenario (Given-When-Then)

Given: the quest player launched a play step (`present` / `practice` / `apply`)
When: the game opens
Then: the child sees the same frame they saw last time — where the prompt is, where the answers are, where Hoya talks — and only the middle changes per game family

## Screen goal

"Answer one round at a time; a wrong answer teaches, never stops."

## Box diagram

```
+----------------------------------+
|  [=====------]         [2 / 5]   |  <- round progress bar + count pill (top, always)
|                                  |
|  Prompt heading (1 line)         |  <- "Tap the letter you hear" tone, per game
|                                  |
|  +----------------------------+  |
|  |        PROMPT AREA         |  |  <- speaker glyph + "replay" / Korean word +
|  |  (speaker | ko word | NPC  |  |     romanization / NPC line / trace box
|  |   line | trace canvas)     |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |        ANSWER AREA         |  |  <- tiles (2-4) / options (3) / two columns /
|  |  [ㄱ]   [ㄴ]   [ㄷ]         |  |     sequence slots / jamo pieces + slots
|  +----------------------------+  |
|                                  |
|  ( Hoya bubble slot )            |  <- empty by default; appears on wrong
|                                  |     (thinking) or as hint (idle)
|  [ Skip ]                        |  <- ghost, construction/discovery games only
+----------------------------------+
```

- No back / close control inside a game (see open questions); the frame belongs to the quest.
- Tiles show the jamo (taught content) **with romanization**; every tile ≥ child touch target.

## Interaction points

- Prompt replay tap → replays prompt audio (`platform/audio`)
- **Correct** answer → tile/option switches to the correct look, light + success haptic, `recordRound(true)`; after ~0.7 s auto-advance to the next round (no "Next" button)
- **Wrong** answer → that tile locks in the wrong look, nudge haptic, `recordRound(false)`, prompt audio replays after ~0.8 s, Hoya bubble (thinking tone) with the answer's Korean + romanization + [ Hear it ]. The round **stays open** until correct (catalog §0.3 rule 3 says reveal + auto-advance; see open questions)
- Last round done → `markStepComplete()` + `onFinish()` → `goBack()` to `quest/player`, which advances the step
- [ Skip ] (build-letter, card-match, story-sequence, trace-stroke) → `markStepComplete()` + `onFinish()` without recording the remaining rounds

## Navigation graph

Enter from: `quest/player` (play step)
Exit to:    `quest/player` (always, via goBack) — never to results directly

## States

- **success**: rounds 1..N advance; progress bar fills; exit on last round.
- **empty** (scope resolves to zero rounds): "no rounds" line today — should instead auto-complete the step and return (open question).
- **error**: `minigameRef` unknown → "minigame not found" line with no way out (**discrepancy**: needs a [ Back to quest ] button) · `voice-echo` with the flag off → beta notice line, same dead end · audio fails → visual-only round (never block on sound).

## Data needs

- reads: `questById().steps[stepIndex].minigameRef` → `scopeFor(ref)` (`logic/minigame-config`: kind, jamoIds, syllables, cardPairs, storySteps, dialogue, rounds) · round builders in `logic/round-builder` (pure)
- writes: `quest-run-store.recordRound / markStepComplete`
- telemetry: `minigame.finished` `{ kind, questId, stepIndex }` on close (profileId attached)

## Open questions

- **Discrepancy**: there is no shared frame component — each game re-implements the progress row, prompt heading and Hoya slot. Extract a `MinigameFrame` in `packages/design-system` before the mid-fi pass so the layout cannot drift per game.
- Wrong-answer rule: catalog §0.3 says "soft feedback + reveal answer + auto-advance"; shipped recognition games keep the round open until the child finds the right tile. Which is kinder for a 5-year-old on round 5 of a bad day? Beta A/B: reveal-after-2-wrong.
- Progress element: the shell uses a **bar**, the quest player uses **dots**. One idiom for both, or bar = rounds, dots = steps on purpose?
- Quit from inside a game: none today. Route through the quest's [x quit] confirm sheet rather than adding a second control here.
