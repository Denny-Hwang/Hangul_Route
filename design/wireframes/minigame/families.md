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
|  wrong -> block-shape hint   |  |  +------------------------+  |
|   (build-letter.md)          |  |  [Show me] [Clear]  [[ DONE ]]|
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

Per game, inherited from the shell: success (rounds advance), empty (no rounds → should auto-complete), error (unknown ref / flag off → dead end today). Family-specific: trace-stroke evaluating state (Done, or 1.5 s idle on a *finished* letter only; see "Trace Stroke states" below) · voice-echo has no wrong state at all (honor system).

## Trace Stroke states (AMENDMENTS-TRACE-IDLE, row TI-0b)

Spec: `docs/specs/AMENDMENTS-TRACE-IDLE.md` §3.1–§3.4, §3.6 · mock `design/screens/minigame-writing/mock/trace-stroke-states.html` (board S1–S11) · screen note `design/screens/minigame-writing/trace-stroke.md`. Built in **TI-2** (Trace Stroke); **TI-3** applies the same states to Trace a Word.

Rule: **a pause never scores a letter.** The idle check only accepts a finished letter (every target stroke inked, §3.1); a miss is recorded only after Done. Nothing on the canvas changes by itself after a result, except the clean pass's 1.1 s advance.

```
                     finger down (hold)                    first real ink (start)
   [ IDLE ] ----------------------------------> drawing <-----------------------------+
   line: "Draw each line slowly.                  |  lift                              |
          Tap Done when you finish."              v                                    |
   Done: on if ink                     ready()? (finished letter)                      |
      ^                                 |yes                 |no                       |
      |                     1.5 s idle  v                    v  3 s, no finger down    |
      |                          [ SCORE ] <--- Done --- [ KEEP GOING ]                |
      |                              ^--- Done also from drawing: any time there is ink |
      |                           |     |                line: "Keep going. Tap Done  |
      |                     pass  |     | miss (Done       when you finish."          |
      |                           |     |  only)         canvas, Hoya, sound: no change|
      |               +-----------+     v                Done stays on                 |
      |               |           [ MISS ] amber, Hoya thinking, ink KEPT ------------+
      |       tip?    |           line: "Try again — start at the top!"   new stroke adds to the ink
      |     no|   yes |           Done off · Show me, Clear, Skip work
      |       v       v                  |
      |  [ PASS ]  [ PASS + TIP ]        | Clear
      |  1.1 s →   tip line, [[ NEXT ]]  |
      |  next      in Done's place,      |
      |  round     focus on Next;        |
      |            tap → next round      |
      +---- Clear (any result) ----------+   canvas empty after a result => check open again
```

| State | Canvas | Status line (key) | Hoya (roomy) | Done slot | Clear | Ends by |
|---|---|---|---|---|---|---|
| Idle, empty (S1, S5) | idle look | `trace.idle` (changed) | idle | Done, off | off | first stroke |
| Pause, not finished (S2, S8) | idle look, ink | `trace.keepGoing` (new) after `TRACE_KEEP_GOING_MS` = 3 s | idle (no change) | Done, **on** | on | next stroke (line back to idle), Done |
| Miss (S3, S9) | nudge fill + border, **ink kept** | `trace.retry.*` (unchanged) | thinking | Done, off | on | new stroke (adds to ink, S4), Clear (S5), Skip |
| Pass, clean (S7) | success look | `trace.pass.clean` | cheering | Done, off | on (as today) | 1.1 s advance (unchanged) |
| Pass + tip (S6, S10, S11) | success look | `trace.pass.order` / `.open` / `.loop` | cheering | **Next** (`trace.next.cta`, new), focused | on: empties, the check opens again (§3.3) | tap Next; Clear |

Wireframe decisions (for TI-2):

1. **Next takes Done's slot and size** (md 64 in compact and side, lg 80 in roomy). Done is off during any result, so the button rows do not change. Skip stays beside / under it.
   - Focus: Next takes focus when it appears, after the tip is queued in the live region (or Next carries the tip as its `accessibilityHint`), so the tip is not cut off; native `AccessibilityInfo.setAccessibilityFocus`, web `focus()`. The ring shows for keyboard / switch focus only (`:focus-visible`), `border.focus`, `borderWidth.thick`.
   - On advance (Next, or the clean pass's 1.1 s), focus goes to the new round's heading (the `header` view).
   - **Next must never be off screen while it has focus** (see open item 3).
2. **Keep going is a line, not a state of the canvas.** Same idle strip look (paper, subtle border), no amber: the learner did nothing wrong. It is a separate `keepGoing` flag; `feedback` stays `idle`.
3. **After a miss the ink stays.** The amber look and Hoya `thinking` hold until the learner draws again or taps Clear; no wipe timer. A resting finger (`hold` with no ink) changes nothing.
4. Strip heights stay as today (2 planned lines; 3 in side mode). The new lines (`idle`, `keepGoing`) fit 2 lines at 320. `pass.order` (today's string) takes 3 at 320 (S6): the strip grows and the canvas gives up that height, as today; the button rows stay put.
5. **Live region.** The Keep going line is announced once per pause. The return to the idle line on the next stroke is not announced (TI-2 turns the strip's live region off for the idle line), so a screen-reader user does not hear the idle line after every stroke.

Open for the owner:

1. **Recommended spec line (copy): the miss line.** `trace.retry.start` ("Try again — start at the top!") now sits over ink that is kept and meant to be added to (§3.3, D2; S3, S4). Proposal: a §3.6 row changing it to **Add the missing lines, or tap Clear.**, with es and ko in TI-2. It is not in §3.6 today, so TI-2 keeps the old line unless the owner adds the row.
2. **Spec errata: Next's size.** §3.4 says "same size as Done, `touchTarget.min`". Done is `md` (`touchTarget.min`) in compact and side, but `lg` (`touchTarget.child`) in roomy. This design follows "same size as Done" (S10). A one-line errata lets TI-2's test assert Done's size in roomy.
3. **Text at 200 % on a 320 x 568 phone** (`mock/trace-stroke-text200.html`, `shots/trace-stroke-320-text200.png`, S12): with the canvas at its 160 floor the column is about 60 px taller than the window, so Next and Skip fall below the edge. Today's screen has the same limit, but a tip that now waits for Next makes it matter. TI-2 checks this in the app (the app caps some text sizes). If Next does not fit, the recommended fix: while a pass shows, the control column under the canvas scrolls and Next is scrolled into view when it takes focus.
4. **Skip beside Next.** After a pass, Skip ends the step, as today (§3.3 keeps Skip). Two "go on" buttons may read oddly; hiding Skip while Next shows would need a spec line. Kept as is.


## Data needs

- reads: `MinigameScope` fields by family — `jamoIds` (recognition, trace) · `syllables` (build-letter) · `dialogue` (tap-respond) · `cardPairs` (card-match, culture-quiz, voice-echo target) · `storySteps` (story-sequence) · `rounds`
- writes: `answerRound(roundKey, correct)`, `markStepComplete` (all). Round keys: round index (recognition, build-letter, trace, tap-respond) · Korean word of the pair being matched (card-match) · slot position (story-sequence)
- schema kinds **not implemented** (enum only, no component, no round schema): `match-shape`, `syllable-build`, `tap-rhythm`, `order-it` — the shell falls through to "coming soon"

## Open questions

- **Discrepancy**: schema kind names and catalog names diverge — schema `odd-one-out` sits where the catalog has ③ Listen & Pick, `tap-rhythm` where it has ⑧ Voice Echo, `order-it` where it has ⑨ Role Play, `card-match`/`culture-quiz` where it has ⑩ Hidden Heritage / ⑫ My Story. Reconcile the catalog (v2) with the enum before authoring Stage 2 content.
- `RoundSchema` (6 kinds) lags the enum (13) and the code (9): `odd-one-out`, `culture-quiz`, `tap-respond` have components but no round schema; content for them lives in `minigame-config.ts`, not in validated JSON.
- voice-echo: keep the honor-system placeholder in the beta build, or hide the kind until STT exists? A child cannot tell the difference, but the run store records it as always-correct.
