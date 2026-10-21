# Minigame/Shell — the common frame every minigame renders inside (wireframe v1)

Spec: `docs/blueprints/06-mini-game-catalog.md` §0.3 (5 common rules: ≤ 3 min, 5–7 rounds, fail-but-advance, touch only, sound + visual) · `.claude/skills/minigame-skill/SKILL.md` · `docs/specs/F-HOYA-001-hoya-character-system.md` (bubble tones)
Audience: **any learner, any age** (CLAUDE.md §1; this line said a child age range before the 2026-10-09 audience rule, corrected in row CM-D2)
Code (back-filled): `apps/mobile/src/screens/minigames/MinigameScreen.tsx` (router by `scope.kind`) + one component per game; run state `store/quest-run-store.ts`

## Scenario (Given-When-Then)

Given: the quest player launched a play step (`present` / `practice` / `apply`)
When: the game opens
Then: the learner sees the same frame they saw last time — where the prompt is, where the answers are, where Hoya talks — and only the middle changes per game family

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
- Tiles show the jamo (taught content) **with romanization**; every tile ≥ `touchTarget.child` (the token name; it is an accessibility size for every age).

## Interaction points

- Prompt replay tap → replays prompt audio (`platform/audio`)
- **Correct** answer → tile/option switches to the correct look, light + success haptic, `answerRound(roundIdx, true)`; after ~0.7 s auto-advance to the next round (no "Next" button)
- **Wrong** answer → that tile locks in the wrong look, nudge haptic, `answerRound(roundIdx, false)`, prompt audio replays after ~0.8 s, Hoya bubble (thinking tone) with the answer's Korean + romanization + [ Hear it ]. The round **stays open** until correct (catalog §0.3 rule 3 says reveal + auto-advance; see open questions)
- **Scoring** (F-001 §3.2, audit UX-02): a round scores on its **first** answer only — right first time = correct round, wrong first time = missed round. Re-taps are retries: they never add a round or change stars, and are counted separately (`retryCount`, `quest.complete.retries`)
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
- writes: `quest-run-store.answerRound / markStepComplete` (first answer per `stepIndex:roundKey` scores; later answers are retries)
- telemetry: `minigame.finished` `{ kind, questId, stepIndex }` on close (profileId attached)

## Open questions

- **Discrepancy**: there is no shared frame component — each game re-implements the progress row, prompt heading and Hoya slot. Extract a `MinigameFrame` in `packages/design-system` before the mid-fi pass so the layout cannot drift per game.
- Wrong-answer rule: catalog §0.3 says "soft feedback + reveal answer + auto-advance"; shipped recognition games keep the round open until the learner finds the right tile. Which is kinder for a beginner on round 5 of a bad day? Beta A/B: reveal-after-2-wrong.
- Progress element: the shell uses a **bar**, the quest player uses **dots**. One idiom for both, or bar = rounds, dots = steps on purpose?
- Quit from inside a game: none today. Route through the quest's [x quit] confirm sheet rather than adding a second control here.

---

## F-CURR-002 formats in the shell (row CM-D2, 2026-10-21)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 (formats F1-F6, F8, F10), §4.5 (`dictation-unambiguous`, the spelling round), §7.7 (anti-shame checklist), §12.2 (`game.<kind>` switches). F7 Hidden Heritage is designed in row CM-D3 and F9 Decoding Sprint with row CM-32; both use the rules below. Every F-CURR-002 screen is for **any learner, any age** (CLAUDE.md §1), with no age wording.

The eight formats, and the read-plus-meaning spelling round of §4.5, render inside this frame. Each one has its own wireframe; this section holds what they share, so the frame cannot drift per game.

| Format | Kind | Family (`families.md`) | Wireframe | Fallback round when `game.<kind>` is off | Skip |
|---|---|---|---|---|---|
| F1 Cloze Pick | `cloze-pick` | Recognition | `cloze-pick.md` | Listen & Pick with a text prompt | no |
| F2 Dictation | `type-hangul`, `mode: 'hear'` | Construction | `type-hangul.md` (hear mode) | Type Hangul `see` | yes |
| Spelling round (Letters S2, §4.5) | `listen-pick`, `promptKind: 'spelling'` | Recognition | `type-hangul.md` (the spelling round) | Listen & Pick on the same word, the look-alike spelling left out | no |
| F3 Syllable Build | `syllable-build` | Construction | `syllable-build.md` | Listen & Pick on the built block | yes |
| F4 Match Shape | `match-shape` | Recognition | `match-shape.md` | Read Pick (see the letter, pick its sound) | no |
| F5 Story Order | `story-order` | Discovery | `story-order.md` | Story Sequence (`story-sequence`) | yes ("Skip this one") |
| F6 Role Play | `role-play` | Interaction | `role-play.md` | Tap to Respond on the same turns | no |
| F8 My Story | `my-story` | Construction | `my-story.md` | Write Frame on the first frame | yes |
| F10 Yut Review | review skin | (review screen) | `yut-review.md` | the plain review screen | the review screen's Stop |

### Rules every format follows

1. **Reading, listening or writing only.** No microphone, no recording, no speaking prompt, no voice echo, no "say it" line. Nothing asks the learner to speak, and nothing measures speech. This also applies to fallback lines: the `audio-fallback.md` W5 caption "Say it out loud" is never used on these screens; they use "No sound? Read it here." and the reasons of the sound notice.
2. **Switch names.** One `game.<kind>` per format (F-CURR-002 §12.2): `game.cloze-pick`, `game.type-hangul-hear` (Dictation is a mode of a shipped kind, so its switch names the mode), `game.spelling-pick` (the read-plus-meaning spelling round of §4.5, a new round kind on the Listen & Pick renderer), `game.syllable-build`, `game.match-shape`, `game.story-order`, `game.role-play`, `game.my-story`, `game.yut-review`. Row CM-2 registers them with these names.
3. **The fallback round is decided before the round opens.** When `game.<kind>` is off (the build floor or the remote override, F-CURR-002 §12.2), the router renders the round's fallback with the shipped renderer of that kind. The fallback data is derived by a pure function next to the kind's schema (`clozeToListenPick`, `spellingPickToListenPick`, `syllableBuildToListenPick`, `matchShapeToReadPick`, `storyOrderToSequence`, `rolePlayToTapRespond`, `myStoryToWriteFrame`; Dictation is the round itself in `see` mode; Yut Review is the plain screen), so a quest never meets an "unavailable" line. The learner sees an ordinary shipped game: no notice, no "this game is off". A content test renders every quest with each `game.<kind>` off (spec §14), and for each switch it also answers at least one fallback round per quest in Playwright (renders, takes the right tap, reaches the next round), so a switch is known to rescue the quest, not only to mount a screen.
4. **A switch that turns off mid-quest** (a config refetch on foreground) takes effect at the next step, never inside an open round, so a round never changes under the learner's finger.
5. **The no-device-voice fallback** follows `audio-fallback.md` and its new screen W11: the visible F-AUDIO-004 sound notice (`PromptPanel`, text or status variant) and a round that is still answerable by reading. Every round scores as usual in every audio state.
6. **Scoring is the shell rule.** A round scores on its first answer only; later taps are retries (`retryCount`). Role Play scores each learner turn; My Story frames are never right or wrong (Write Frame rule: any pick is right; the writing part scores like Type Hangul or Trace a Word).
7. **A miss is amber, never red.** The tapped option takes the nudge look (`feedback.nudgeLight` fill, `feedback.nudge` border, a mark glyph); Hoya's bubble is the `thinking` pose in the amber tone with one line that says what to look at, never "wrong". `feedback.danger` is not used by any of these screens. The second miss on one round rings the answer ("look here": dashed `border.focus`, thick, plus the pointer glyph), except inside a review session, where the review screen's rule applies (row CM-D1).
8. **No per-question timer, no countdown, no score number.** Progress is the fill-only bar and the `n / N` pill of this shell (review sessions use fill-only dots and no count, F-CURR-002 §4.5). No percentage anywhere on a learner screen.
9. **Targets.** Every tap target is at least 48 dp (F-CURR-002 §14) and is drawn at `touchTarget.min` (64), the app floor, or larger (`touchTarget.child` 80 for primary actions, `touchTarget.hero` 96 for a prompt speaker). Hit areas never overlap; a card that holds a button of its own is split into two hit areas, each at least 64 tall.
10. **Tokens only.** Every colour, size, radius, border and motion is a token of `packages/design-system/src/tokens.ts`; the mocks in `design/screens/minigame-variety/` copy them once as custom properties. No emoji anywhere (copy, art or glyphs).
11. **Reduced motion.** With `reducedMotion` (or `prefers-reduced-motion`) there is no shake, slide, flip, throw or travel animation; states change at once, and the success and nudge cues stay as fill, border, glyph and text. Auto-advance still waits the same pause, so nothing appears to rush.
12. **Screen readers.** Each option, slot, chat bubble and board element has an accessible name that includes its Korean and its romanization read as words (`a11yRomanization`) and, after a pick, its state (`a11y.minigame.option.correct / wrong / hint`). Hoya's bubble and the sound notice are polite live regions; nothing steals focus except a result panel that opens in place of the keyboard (Type Hangul rule).
13. **Copy.** Taught Korean always carries romanization (CLAUDE.md §1). UI strings come from `packages/i18n` through `useMessages`; the proposed English strings and intended keys are listed in each wireframe and land with their es and ko values in the build rows CM-30 to CM-39. No age wording, no loss framing, no comparison between learners.

### Layout bands at 320 px

The new formats use three layouts of this frame; each wireframe says which one it uses.

```
A. options under a prompt          B. a pinned answer area           C. a band above the item
   (Cloze Pick, Match Shape,          (Role Play, Dictation,            (Yut Review)
    Syllable Build, Story Order)       My Story's write phase)
+---------------------------+      +---------------------------+     +---------------------------+
| [=====-----]     (2 / 5)  |      | [=====-----]     (2 / 4)  |     | [x]  o o o . . . . . . .  |
| (heading)                 |      | (scene title)             |     | +---------+ (throw name)  |
| +-----------------------+ |      | chat log or prompt        |     | | board   | (moves)      |
| | prompt card           | |      | (scrolls)                 |     | +---------+               |
| +-----------------------+ |      |                           |     | prompt + options of the   |
| [ option ] [ option ]     |      +---------------------------+     | review item (shell A)     |
| [ option ] [ option ]     |      | pinned: replies, or field |     |                           |
| ( Hoya bubble slot )      |      | and keyboard              |     |                           |
+---------------------------+      +---------------------------+     +---------------------------+
```

From `regular` (600) up, A keeps one reading column (`layout.maxWidth.reading`); B keeps the pinned area in the reading column; C puts the board beside the item (two panes, `layout.pane.gap`).

### Data and telemetry

- Each new kind adds an additive round schema in `packages/content-schema` (row CM-2 and the build rows) and a `MinigameKindSchema` value where it is new (`cloze-pick`, `story-order`, `role-play`, `my-story`); `syllable-build` and `match-shape` are already in the enum and gain their round schemas.
- `minigame.finished` keeps `{ kind, questId, stepIndex }`; a fallback round reports the kind it rendered as, so the rollups count what the learner played. `session.end.leftAtKind` (row CM-3) carries the same code. No learner input is ever sent (My Story, Dictation and every typed answer stay in the renderer's state).
