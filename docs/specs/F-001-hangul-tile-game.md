# F-001 — Hangul Tile Game (Match Sound)

**Status**: `ready`
**Scope**: Stage 1 · Theme A (Letters & Books) · MVP
**Owner**: solo dev
**Rollout**: MVP (first Stage 1 minigame)
**Mini-game family**: Recognition · Game ① "Match Sound" (`docs/blueprints/06-mini-game-catalog.md`)

---

## 1. Context

Stage 1 Anchor Skill is **jamo recognition** — 24 자모 + 6 받침 at ≥ 90 % accuracy (`docs/blueprints/05-episode-learning-goals.md` §1). The catalog (`06-mini-game-catalog.md`) prescribes "Match Sound" as the foundational Recognition game: child hears a jamo, taps the matching tile.

Hangul Tile Game is the **first feature spec** to land after F-INFRA-001. It functions as:

1. The reference implementation of the F-XXX spec template.
2. The first business-logic surface for `apps/mobile` (drives the `src/logic/` ↔ `src/platform/` split documented in `docs/tests/coverage-targets.md`).
3. The first concrete consumer of design tokens (W1) and Hoya v1 poses (W1 Thursday).

This spec covers **one round type only**: jamo → 4-tile selection. Variants (받침, syllable blocks, distractor difficulty) land via later specs (F-005+).

## 2. User story

> As **P5** (English-speaking K-culture child, 5–7 yo, zero Korean baseline) opening Episode 1·A1 for the first time, I want to hear a Korean letter and tap the matching tile so that I feel I just learned a real Korean letter in under 10 seconds.

Companion stories:

- As **P4** (heritage child whose parents speak Korean), I want the same flow to feel breezy because I may already half-recognize the sound — accuracy should be acknowledged without slowing me down. *Open question: heritage acceleration is out of scope; deferred to F-006.*
- As a **parent** observing the first session, I want the failure state to be encouraging (no red ❌, no shame), so I'm comfortable handing the device back to my child.

## 3. Acceptance criteria

### 3.1 Happy path

- **Given** Episode 1·A1 starts and Hoya plays the audio for `ㄱ` (`giyeok`),
  **when** the child taps the tile labelled `ㄱ`,
  **then** within ≤ 100 ms visual feedback (tile scale 1 → 1.08 → 1, color → `surface.success`) AND audio chime fire,
  **and** the round score increments by 1.

- **Given** 5 rounds complete (5 jamo × 1 prompt each),
  **when** the round counter reaches 5,
  **then** the results screen renders Hoya `cheering` + star count: 3 stars if 5/5, 2 stars if 3–4/5, 1 star if 1–2/5.

### 3.2 Wrong-answer path

- **Given** the prompt is `ㄱ` and the child taps `ㄴ`,
  **when** the tile registers,
  **then** the tile briefly shakes (`shake.gentle`, 200 ms), Hoya switches to `thinking` pose,
  **and** an English+romanization hint appears: *"Listen again. This says **giyeok**."*
  **and** the round is **NOT** counted as failed (re-tap allowed within the same round).
  **and** the prompt audio replays on its own after 800 ms unless the child taps again first.

### 3.3 Audio failure path

- **Given** the audio asset for the round fails to load (network, decode, or missing),
  **when** the round renders,
  **then** Hoya shows the prompt as **text** ("Tap the letter that says **giyeok**.") with romanization,
  **and** a small replay icon retries fetching the audio,
  **and** the round still scores normally if the child taps the correct tile.

### 3.4 Accessibility

- All 4 tiles ≥ **64 × 64 dp** with **8 dp** inter-tile spacing (CLAUDE.md §4).
- Each tile has an `accessibilityLabel` of the form `"Korean letter <romanization>, tap to select."`.
- `prefers-reduced-motion`: tile success animation collapses to instant color change; shake animation skipped.
- Sound on/off toggle in settings honored — failure path text hint always shown when sound is off, regardless of audio load state.
- Multi-touch: only the first registered touch within a 50 ms window is honored; subsequent touches on different tiles are ignored.

### 3.5 Determinism

- The 4 tiles in each round are: 1 correct + 3 distractors. Distractors are drawn from the same episode's jamo pool, with **no jamo repeated across the 4 tiles in a single round**.
- Tile order is **randomised per round** (no learner sees the same layout twice in a row).

## 4. Out of scope

Explicit deferrals (will get their own spec when they arrive):

- **Trace Stroke** (Game ⑤) → F-004.
- **Voice Echo** (Game ⑧) → blocked on STT bench (INBOX T-013).
- **Build a Letter** (Game ④, jamo + 모음 assembly) → F-003.
- **받침 distractor pool** (final-consonant tile family) → F-005.
- **Heritage Card unlock** at episode end → F-007 (consumes Card schema from `packages/content-schema` once it exists).
- **Heritage-kid acceleration** (skip-recognized prompts) → F-006.
- **Parent dashboard reporting** of game accuracy → F-PAR-001.
- **TTS generation pipeline** for jamo audio assets → F-CNT-002. For F-001 we ship 30 pre-recorded MP3s (one per jamo) under `apps/mobile/assets/audio/jamo/` checked into git for MVP.
- **Cloud progress sync** (Cloudflare D1 write of round results) → F-INFRA-004. F-001 stores results in local-only state.

## 5. UI sketch

Wireframes (Week 2 playbook):

- `design/wireframes/stage1/match-sound.md` (round screen — produced W2 Tuesday as part of "Home → Quest" flow)
- `design/wireframes/stage1/match-sound-results.md` (5-round results — produced W2 Wednesday)

Mid-fi screens (Week 5):

- `design/screens/stage1/match-sound.png`
- `design/screens/stage1/match-sound-results.png`

UI must consume only `@hangul-route/design-system` tokens (no hard-coded color / spacing — CLAUDE.md §4).

## 6. Tests

Aligned to the business-vs-platform split in `docs/tests/coverage-targets.md` (W4 mobile business target: 90 %).

### Unit — `apps/mobile/src/logic/`

| File | Coverage focus |
|---|---|
| `logic/match-sound/score.ts` | star calculation (1/2/3 stars by accuracy) — 100 % branch |
| `logic/match-sound/round-builder.ts` | distractor selection — no duplicate jamo, deterministic given seed |
| `logic/match-sound/state-machine.ts` | round transitions (prompt → answered → next-round → results) |
| `logic/audio/audio-loader.ts` | fallback path when fetch / decode rejects |

### Platform-wrapper — `apps/mobile/src/platform/`

| File | Coverage focus |
|---|---|
| `platform/audio.ts` (expo-av wrapper) | mocked via `@hangul-route/test-utils` — W4 target 70 % |
| `platform/haptics.ts` (expo-haptics wrapper) | mocked |
| `platform/animation.ts` (react-native-reanimated wrapper) | mocked |

### Integration

- 5-round dry run with stubbed audio: correct/correct/wrong-then-correct/correct/correct → 3 stars.
- `prefers-reduced-motion` honored end-to-end.

### E2E (Detox, nightly only)

- Cold launch → Episode 1·A1 → 5 rounds with mocked audio → results screen visible.

## 7. Rollout

- **MVP** — first Stage 1 game. Ships before any other Stage 1 minigame.
- No feature flag; toggling F-001 off means Episode 1·A1 has nothing playable.
- Beta cycle: first family play-test (INBOX T-014 parent dashboard arrives in parallel) before App Store submission.

## 8. Dependencies

### Upstream (must ship first)

- **F-INFRA-001** (Cloudflare Workers bootstrap) — `shipped`.
- **W1 design tokens** (colors / typography / spacing) — `in-progress`.
- **W1 Hoya v1** (idle / cheering / thinking poses) — `in-progress`. *`sad` pose is intentionally not used here; failure path uses `thinking` per blueprint 02's anti-shame rule.*
- **packages/content-schema** Quest schema — needs a `MatchSoundRound` type. Drives T-001 follow-up in the same sprint.

### Downstream (will unblock once F-001 ships)

- F-003 Build a Letter (reuses round-builder + score)
- F-004 Trace Stroke (reuses tile component)
- F-007 Heritage Card unlock (consumes round results)

### External

- 30 jamo audio recordings (MVP: pre-recorded MP3, 24 자모 + 6 받침). Sourced from a single native-speaker volunteer to keep pronunciation consistent. Stored under `apps/mobile/assets/audio/jamo/`, < 50 KB each, committed to git (acceptable for MVP; migrates to R2 in F-INFRA-003).
