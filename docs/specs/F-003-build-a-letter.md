# F-003 — Build a Letter (Construction Minigame)

**Status**: `shipped` (back-fill — code landed in PR #13, this spec written 2026-05-21)
**Scope**: Stage 1 · Theme A (Letters & Books) · Construction Family ④ · MVP
**Owner**: solo dev
**Rollout**: MVP (second Stage 1 minigame after F-001 Match Sound)
**Mini-game family**: Construction · Game ④ "Build a Letter" (`docs/blueprints/06-mini-game-catalog.md`)

---

## 1. Context

Build a Letter is the Construction-family counterpart to F-001's Recognition game. Where Match Sound teaches *which letter is this sound*, Build a Letter teaches *how letters combine to form syllables*. The child is shown a target Korean syllable (e.g., `가`, `gа`) and must tap the constituent jamo (`ㄱ` then `ㅏ`) in left-to-right order.

This is the first minigame to expose the **Korean syllable block structure** — the fundamental insight that Korean letters stack into 2- or 3-element blocks. It bridges Stage 1 (single letters) to Stage 2 (words built from blocks).

Implemented in PR #13 `feat: v1.0 full-vision prototype` as `apps/mobile/src/screens/minigames/BuildLetterGame.tsx`.

## 2. User story

> As **P5** (English-speaking K-culture child, 5–7 yo, just learned the Recognition game), I want to physically combine letters to make a syllable so that I feel I've gone from "I know letters" to "I can make Korean".

Companion stories:

- As **P4** (heritage child whose parents speak Korean), I want the syllable to look familiar — I should recognize 가, 나, 다 from family conversation — so the bridge from letters to recognition feels natural.
- As a **parent**, I want my child to not be stuck on a wrong sequence forever; the wrong-feedback should auto-clear the slots so they can try again immediately.

## 3. Acceptance criteria

### 3.1 Happy path

- **Given** a Build a Letter round with target `가` (jamoChars `['ㄱ', 'ㅏ']`),
  **when** the child taps the `ㄱ` tile first then the `ㅏ` tile,
  **then** both slots fill with the tapped jamo characters,
  **and** the target syllable card animates a soft success-tint border,
  **and** after 900ms the next round loads (or finish event fires if last round).

### 3.2 Wrong-answer path

- **Given** target `가`, **when** the child taps `ㅏ` first (vowel before consonant — wrong order),
  **then** after both slots fill (with wrong sequence) the screen shows a brief amber-tinted state,
  **and** after 900ms the slots auto-clear and HoyaBubble (`thinking` tone) shows: *"Not quite. Try again — letters go left to right."*,
  **and** the round is NOT counted as failed — the child gets unlimited retries.

### 3.3 Tile selection

- Each round shows 4 jamo tiles: the 2 (or 3) correct components + 2 distractors of opposite kind family (vowel distractors for consonant target, consonant distractors for vowel target).
- Tapping a tile that's already in a slot is a no-op (no duplicate adds).
- Once both slots are filled, no more tile taps are accepted until clear/advance.

### 3.4 Skip path

- A `Skip` ghost button is always visible. Tapping it marks the step complete (no stars) and advances.
- This prevents the child from getting stuck — a key anti-frustration affordance.

### 3.5 Audio

- On render, the target syllable card is tappable — tap plays the Korean pronunciation via `expo-speech` (ko-KR).
- No audio failure path required — the visual syllable is the source of truth.

### 3.6 Accessibility

- Target syllable card ≥ 160 × 160 dp (large prompt zone).
- Slots ≥ 72 dp (clearly tappable empty containers — dashed border distinguishes from filled tiles).
- Tile tap targets ≥ 80 dp (`touchTarget.child`).
- Inter-tile spacing ≥ 8 dp (`spacing.sm`).

## 4. Out of scope

- 3-component syllables (consonant + vowel + batchim final) — deferred to F-005.
- Drag-and-drop interaction (current is tap-to-fill, simpler for kids 5–7).
- Stroke order trace (covered by F-004 Trace Stroke).
- Audio playback on slot fill (only on target tap).
- Visual block-stacking animation (e.g., showing how 가 is ㄱ + ㅏ visually merging) — deferred to F-006.

## 5. UI sketch

`design/brief/screens/09-minigame-build-letter.md` is the design source of truth. Layout:

```
┌────────────────────────────────────┐
│ ▓▓░░░     [1 / 4]                  │ ← progress + step pill
│                                    │
│ Build this letter                  │
│                                    │
│   ┌─────────────┐                  │
│   │     가      │                  │ ← target syllable card (taps to hear)
│   │     ga      │                  │
│   └─────────────┘                  │
│                                    │
│ Slots:                             │
│   [   ] [   ]                      │ ← dashed-border empty slots
│                                    │
│ Tiles                              │
│   [ㄱ] [ㅏ] [ㄴ] [ㅓ]              │ ← 4 tiles (2 correct + 2 distractors)
│                                    │
│ (wrong-state HoyaBubble)           │
│ 🐯 Not quite. Try again —          │
│    letters go left to right.       │
│                                    │
│ [Skip]                             │
└────────────────────────────────────┘
```

## 6. Tests

Aligned to `apps/mobile/src/logic/` business-vs-platform split.

Unit (`apps/mobile/src/logic/round-builder.ts`):

| Coverage focus |
|---|
| `buildBuildLetterRounds` returns one round per input syllable |
| Each round's `componentJamoIds` length matches the syllable's jamo count (2 for CV, 3 for CVC) |
| Each round's `tileJamoIds` contains all components + 2 distractors (4 total) |
| Distractor selection picks opposite kind family (vowel → consonant distractors, etc.) |

Integration:

- Mounting `BuildLetterGame` with a 4-syllable scope renders 4 rounds.
- Tapping a tile that's not in the slot fills the next empty slot.
- Tapping the correct sequence triggers success → next round (or finish).
- Tapping wrong sequence shows the thinking HoyaBubble + auto-clears.

E2E (Detox, nightly):

- Not yet — deferred to F-DETOX-001.

## 7. Rollout

- **MVP** — shipped in PR #13.
- Plays in 2 of 9 Stage 1 quests (`quest:stage1-letters-q1` step 4 and `quest:stage1-letters-q3` step 4).
- 2 minigame configs in `apps/mobile/src/logic/minigame-config.ts`:
  - `minigame:s1-letters-build-1` — target syllables 가/나/다/라 (CV with vowel ㅏ)
  - `minigame:s1-letters-build-2` — target syllables 가/거/고/구 (CV with consonant ㄱ + various vowels)

## 8. Dependencies

### Upstream (must ship first — all done)

- F-001 Match Sound (Recognition family · ✅ shipped) — establishes the round-completion pattern.
- W1 design tokens (✅ shipped in PR #15 — `tokens.ts`).
- Hoya `thinking` pose (✅ shipped in PR #16) — required for wrong-answer feedback.

### Downstream

- F-004 Trace Stroke — separate Construction game (deferred placeholder shipped, awaits gesture-path matching implementation).
- F-005 Batchim Build — 3-component CVC syllables (e.g., 강, 산, 길).
- F-006 Syllable Animation — visual merging of jamo into block.

### External

- `apps/mobile/src/content/jamo.ts` (30 jamo with char + romanization)
- Korean syllable list in `apps/mobile/src/logic/minigame-config.ts`
