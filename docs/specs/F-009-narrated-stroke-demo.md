# F-009 — Narrated Stroke Demo

**Status**: `ready`
**Scope**: `apps/mobile` · TraceStrokeGame · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish (after F-007)

---

## 1. Context

F-007 ships the animated stroke hint — a dot walks each target stroke leaving a trail. Visually clear, but silent. For a 5-year-old, hearing the letter spoken at the start of the demo reinforces the sound-shape connection.

F-009 adds **Korean voice narration** that speaks the jamo's character when the demo plays. Uses `expo-speech` (already wrapped in `platform/audio`).

Why minimal narration (not per-stroke):
- Per-stroke narration ("first stroke", "second stroke") in English would conflict with the Korean-only language policy for content (F-CNT-001).
- Korean stroke-number narration ("첫 번째", "두 번째") at age 5–7 isn't recognized vocabulary.
- The single ko-KR utterance of the jamo at demo start is **simple, on-policy, and pedagogically tight**.

## 2. User story

> As **P5** (5–7 yo, just learned the sound of `giyeok`) tapping **Show me** on `ㄱ`, I want to **hear** "기역" while I watch the animation — so the sound and shape connect.

## 3. Acceptance criteria

### 3.1 Trigger

- **Given** the child taps **Show me** on the trace zone (F-007 animation starts),
- **and** the OS reports sound is enabled AND the UI sound setting is on (`useUiStore.soundOn`),
- **then** `speak(jamo.char, { language: 'ko-KR' })` is called once at the start of the demo.

### 3.2 Mute paths

- **Given** the UI sound is muted (`useUiStore.soundOn === false`),
- **then** narration is skipped (animation still plays).

- **Given** the OS reports audio is unavailable (rare — silent mode + screen reader),
- **then** narration may or may not fire (let `expo-speech` handle gracefully — no error UI).

### 3.3 No race with the on-mount jamo speak

When the trace round starts (F-004), the screen already speaks the jamo via `speak()` (`useEffect` on round mount). Tapping **Show me** AFTER that initial speak will:

- If the initial speak is still active: `expo-speech.stop()` is called (already in `platform/audio.speak`) and the new utterance starts. No overlap.
- If the initial speak completed: simply start the new utterance.

### 3.4 Reduced-motion path (F-007 §3.4)

When `prefers-reduced-motion: true`, F-007 flashes each stroke instead of animating. F-009 narration **still fires** — the audio is independent of motion preferences.

### 3.5 Replay narration on replay

Each tap of **Show me** triggers narration AND animation. Unlimited replays.

### 3.6 No per-stroke narration

The narration is **one utterance per demo**, at the start. No "stroke 1, stroke 2" voice cues. (Explicitly out of scope per spec §1 rationale.)

## 4. Out of scope

- **Per-stroke voice cues** (stroke number / direction word) — see §1 rationale.
- **Sound effect (chime / tone) instead of voice** — voice carries pedagogical value; SFX doesn't.
- **Adjusting speech rate** — keep the default rate from `platform/audio.speak`.
- **Narration in non-Korean languages** — Korean only (the learning target).
- **Subtitled / captioned narration** — the on-screen romanization already serves this; no caption overlay.

## 5. Dependencies

Upstream: F-007 (✅ PR #26), `platform/audio.speak` (✅ PR #13).
Downstream: F-010 narrated full-quest playback (Phase 2).
