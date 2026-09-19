# Minigame/Families — appendix: one frame per family, shipped games inside (wireframe v1)

Spec: `docs/blueprints/06-mini-game-catalog.md` §0.4 (4 families) · `packages/content-schema/src/schemas/minigame.ts` (`MinigameKindSchema`, 13 kinds) · `design/wireframes/minigame/shell.md` (common frame; not repeated here)
Audience: **learner (P4/P5 child, 5–11)**
Code (back-filled): `apps/mobile/src/screens/minigames/*Game.tsx` — 9 components (8 active + `voice-echo` behind `flags.voiceEchoEnabled = false`)

## Scenario (Given-When-Then)

Given: a play step resolves to a `MinigameKind`
When: the shell picks the game
Then: the prompt/answer areas of the common frame take the family's shape below; a child who has seen one game in a family can predict the next

## Screen goal

"Document the four prompt/answer shapes so new games reuse a shape instead of inventing one."

## Box diagram

```
Family 1 . RECOGNITION ("look/listen and spot it")     shipped: match-sound, odd-one-out
+------------------------------+  +------------------------------+
| match-sound                  |  | odd-one-out                  |
|  [speaker] "tap to replay"   |  |  "tap the one that doesn't   |
|                              |  |   belong"                    |
|  [ㄱ]  [ㄴ]  [ㄷ]  ([ㄹ])     |  |  [ㄱ] [ㄴ] [ㅏ] [ㄷ]           |  <- 4 tiles, 1 differs
|  2-4 tiles, ko + romanization|  |  by kind (vowel among        |
|  wrong -> Hoya + [Hear it]   |  |  consonants)                 |
+------------------------------+  +------------------------------+

Family 2 . CONSTRUCTION ("make it yourself")           shipped: build-letter, trace-stroke
+------------------------------+  +------------------------------+
| build-letter                 |  | trace-stroke                 |
|  target: 가  (ga)            |  |  "trace the letter g"        |
|  slots: [ _ ][ _ ]           |  |  +------------------------+  |
|  pieces: [ㄱ] [ㅏ] [ㄴ] [ㅗ]   |  |  |   large trace canvas   |  |
|  tap piece -> fills next slot|  |  |   (skeleton hint below)|  |
|  wrong -> "letters go left   |  |  +------------------------+  |
|   to right"                  |  |  [Show me] [Clear]  [[ DONE ]]|
|  [ Skip ]                    |  |  [ Skip ]   pass = coverage  |
+------------------------------+  +------------------------------+

Family 3 . INTERACTION ("give and take")               shipped: tap-respond, voice-echo (beta, off)
+------------------------------+  +------------------------------+
| tap-respond                  |  | voice-echo  (flag off)       |
|  NPC line: ko / roman / en   |  |  "say it out loud"           |
|  "choose your reply"         |  |  target ko + roman  [Hear it]|
|  [ reply A  ko/roman/en ]    |  |  [ ] "I said it" (honor tap) |
|  [ reply B  ko/roman/en ]    |  |  [[ CONTINUE ]] (disabled    |
|  [ reply C  ko/roman/en ]    |  |   until tapped)              |
|  wrong -> "that doesn't fit" |  |  no mic, no STT yet          |
+------------------------------+  +------------------------------+

Family 4 . DISCOVERY ("explore and find")              shipped: card-match, story-sequence, culture-quiz
+------------------+  +------------------+  +------------------+
| card-match       |  | story-sequence   |  | culture-quiz     |
| ko      | en     |  | "put it in order"|  | prompt: ko word  |
| [김치]  | [rice] |  | picked: 1 2 _ _  |  | "what does this  |
| [밥]    | [kimchi]|  | [step][step]     |  |  mean?"          |
| tap left, then   |  | [step][step]     |  | [ meaning A ]    |
| its meaning      |  | (shuffled)       |  | [ meaning B ]    |
| progress=pairs   |  | progress=picked  |  | [ meaning C ]    |
| [ Skip ]         |  | [ Skip ]         |  |                  |
+------------------+  +------------------+  +------------------+
```

## Interaction points

Family-level only (per-round rules live in `minigame/shell.md`):

- Recognition: single tap answers the round; audio is the prompt (match-sound) or the odd category is the prompt (odd-one-out)
- Construction: multi-tap or gesture builds an answer; an explicit [[ DONE ]] (trace) or slot-fill completion (build) evaluates; [ Skip ] always present
- Interaction: the prompt is a *turn*; one tap answers, the next turn replaces the prompt
- Discovery: the whole board is the answer; progress = items resolved, not rounds; [ Skip ] present except culture-quiz

## Navigation graph

Enter from: `minigame/shell` (router)
Exit to:    `minigame/shell` → `quest/player`

## States

Per game, inherited from the shell: success (rounds advance), empty (no rounds → should auto-complete), error (unknown ref / flag off → dead end today). Family-specific: trace-stroke evaluating state (1.5 s idle or Done) · voice-echo has no wrong state at all (honor system).

## Data needs

- reads: `MinigameScope` fields by family — `jamoIds` (recognition, trace) · `syllables` (build-letter) · `dialogue` (tap-respond) · `cardPairs` (card-match, culture-quiz, voice-echo target) · `storySteps` (story-sequence) · `rounds`
- writes: `recordRound`, `markStepComplete` (all)
- schema kinds **not implemented** (enum only, no component, no round schema): `match-shape`, `syllable-build`, `tap-rhythm`, `order-it` — the shell falls through to "coming soon"

## Open questions

- **Discrepancy**: schema kind names and catalog names diverge — schema `odd-one-out` sits where the catalog has ③ Listen & Pick, `tap-rhythm` where it has ⑧ Voice Echo, `order-it` where it has ⑨ Role Play, `card-match`/`culture-quiz` where it has ⑩ Hidden Heritage / ⑫ My Story. Reconcile the catalog (v2) with the enum before authoring Stage 2 content.
- `RoundSchema` (6 kinds) lags the enum (13) and the code (9): `odd-one-out`, `culture-quiz`, `tap-respond` have components but no round schema; content for them lives in `minigame-config.ts`, not in validated JSON.
- voice-echo: keep the honor-system placeholder in the beta build, or hide the kind until STT exists? A child cannot tell the difference, but the run store records it as always-correct.
