# F-MOTION-005 — StarRow Count-Change Animation

**Status**: `ready`
**Scope**: `packages/design-system` · StarRow component · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish (after F-MOTION-004)

---

## 1. Context

F-MOTION-004 ships the **mount-time** pop-in: each filled star scales 0→1.2→1.0 staggered 120ms when the StarRow first appears (e.g., on the Results screen).

F-MOTION-005 adds the **change-time** pop-in: if the same StarRow instance receives a new higher `stars` count later (parent rerenders without remount), the newly-filled stars pop in too — but only the new ones, and starting immediately (no stagger delay vs the existing fills).

Use cases:
- Home screen "Recent stars" updates when navigating back after a quest
- Episode quest list mid-render after a result lands
- Future: animated star count-up sequence ("you just earned another!")

## 2. User story

> As **P5** (5–11 yo) returning to the Home screen after a 3-star quest, I want the "Recent stars" card to show the new star **animating in** — not just appearing as if it was always there.

## 3. Acceptance criteria

### 3.1 Newly-filled stars pop

- **Given** `<StarRow stars={1} />` is mounted (1 filled, 2 unfilled),
- **when** the parent rerenders with `<StarRow stars={3} />` (no remount),
- **then** the originally-filled star (index 0) stays scaled at 1.0 with no animation,
- **and** the newly-filled stars (indices 1 and 2) each animate scale 0→1.2→1.0 over 300ms,
- **and** the staggering between the newly-filled stars is preserved (120ms between the two new ones).

### 3.2 Decrements ignored (out of scope)

- **Given** the count decreases (e.g., star tier dropped from 3 → 2),
- **then** the previously-filled star simply becomes unfilled — no animation. This case is rare in real app flow.

### 3.3 Reduced-motion path

- **Given** `prefers-reduced-motion: true`,
- **then** newly-filled stars appear instantly at scale 1 (no pop).

### 3.4 Initial mount still works (F-MOTION-004)

- The mount-time pop-in from F-MOTION-004 is preserved. If the StarRow mounts at `stars={2}`, both filled stars pop in staggered. F-MOTION-005 only adds the change-time path.

### 3.5 No re-animation on every rerender

- If the parent rerenders with the **same** stars count, no animation fires (idempotent).

## 4. Out of scope

- **Decrement animation** (star fading out) — rare; can be a separate spec if a real flow needs it.
- **Sound effect** per star — silent.
- **Cross-row count up** — e.g., "you earned a star" floating notification. Separate F-MOTION-006.
- **Count-up animation between stars** (e.g., simulated "filling" of partially filled stars) — out of scope.

## 5. Dependencies

Upstream: F-MOTION-004 (✅ PR #27), reanimated (✅ PR #13).
Downstream: F-MOTION-006 cross-row count notification.
