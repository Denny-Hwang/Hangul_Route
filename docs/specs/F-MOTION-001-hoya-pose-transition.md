# F-MOTION-001 — Hoya Pose Transition Pulse

**Status**: `ready`
**Scope**: `packages/design-system` · Hoya component · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish

---

## 1. Context

Hoya appears throughout the app with different poses tied to context (idle/cheering/thinking/reading/waving). When a screen changes the `pose` prop — e.g., the Results screen flipping Hoya from `idle` to `cheering` — the swap currently snaps. There's no visual cue that "Hoya just did something".

F-MOTION-001 adds a small **scale pulse** when the `pose` prop changes: Hoya scales from 1.0 → 1.06 → 1.0 over 300ms with bouncy easing. The pose itself swaps instantly at the midpoint, hiding the snap behind the scale moment.

Why not crossfade two Hoyas overlapping?
- Crossfade requires holding the old pose while the new mounts → 2x render cost + layout space concerns.
- Scale pulse is simpler, cheaper, more readable for kids ("Hoya wiggled and now he's cheering").
- Spec §4 keeps full crossfade reserved for a future motion brief if needed.

## 2. User story

> As **P5** (5–11 yo) watching Hoya at the Results screen flip from idle to cheering when I get 3 stars, I want the change to feel like Hoya **reacted**, not blinked.

## 3. Acceptance criteria

### 3.1 Pulse trigger

- **Given** `<Hoya pose="idle" />` is mounted,
  **when** the parent rerenders with `<Hoya pose="cheering" />`,
  **then** the rendered Hoya scales 1.0 → 1.06 over 150ms (bouncy easing) AND back 1.06 → 1.0 over 150ms,
  **and** the `pose` prop in the underlying SVG is the new value from the start (instant swap; scale animates the surrounding wrapper).

### 3.2 No-trigger paths

- **Given** the parent rerenders with the **same** `pose`,
  **then** no animation fires (no spurious pulses).

- **Given** the OS reports `prefers-reduced-motion: true`,
  **then** the pulse is skipped — pose swap is instant with no scale change.

- **Given** Hoya is initially mounted with a pose (first render),
  **then** the pulse does NOT fire on mount (only on subsequent changes).

### 3.3 Duration + easing

- Total ~300ms.
- Easing: `Easing.bezier(0.34, 1.56, 0.64, 1)` (bouncy) — matches `motion.easing.bouncy` from tokens.

### 3.4 Layout

- The pulse modifies `scale` only — no layout reflow. Surrounding content does not shift.

## 4. Out of scope

- **Crossfade between poses** — defer; current pulse is enough.
- **Per-pose unique animation** (e.g., cheering rotates slightly, thinking nods) — Phase 2.
- **Animated entry / exit** (Hoya fading in / out of a screen) — separate spec.
- **Sound effect** — silent.

## 5. UI sketch

```
t=0ms     t=75ms    t=150ms   t=225ms   t=300ms
[idle]    [idle?]   [cheer]   [cheer]   [cheer]
scale 1.0  → 1.04   → 1.06    → 1.04   → 1.0
```

The visible pose changes at t=0 (prop assignment); the scale pulse runs in parallel as the "reaction" cue.

## 6. Tests

- Manual: open Results screen with a 3-star result → see Hoya pulse from idle to cheering.
- Manual: enable reduced-motion → no pulse.
- Typecheck: 8 packages clean.

## 7. Rollout

- Ships immediately. Default-on.

## 8. Dependencies

### Upstream (must ship — all done)

- F-HOYA-001 Hoya 5-pose SVG (✅ PR #16).
- `react-native-reanimated` (✅ PR #13).
- `tokens.motion.easing.bouncy` (✅ PR #15).

### Downstream

- F-MOTION-005 Per-pose unique animation (Phase 2).
