# F-MOTION-002 — Card Flip Animation

**Status**: `ready`
**Scope**: `apps/mobile` · CardDetailScreen · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish — adds motion to the flip introduced in F-CARD-002

---

## 1. Context

F-CARD-002 introduced a tap-to-flip Heritage card with **instant** content swap (no animation, intentional simplicity in v1). This spec adds a **3D rotateY animation** to the flip — the card visibly rotates around its vertical axis, mid-flip going edge-on (invisible), then revealing the back face.

Why animate:
- Reinforces the "real card" metaphor — physical cards flip, they don't snap.
- Hides the content swap behind the edge-on moment, so the change feels seamless.
- Respects `prefers-reduced-motion` (a CLAUDE.md design principle) — collapses to instant swap when the OS signals it.

The implementation uses `react-native-reanimated` (already in deps since PR #13) with a 2-stage timing pattern: rotate 0→90° (front becomes invisible at edge-on), swap content in React state, rotate 90°→0° (back appears).

## 2. User story

> As **P5** (English-speaking K-culture child, 5–11 yo) tapping a Heritage card to see its info, I want the card to **physically flip** — not just blink to new content — so that interacting with the card feels real, not screen-y.

Companion stories:

- As **a parent or child with motion sensitivity** (or with system reduce-motion enabled), I want the flip to instantly swap (no rotation) so I don't get visually overwhelmed.
- As **a developer**, I want the animation cost (~400ms total) to be opt-in and bypass-able for tests + reduced-motion — no test relies on waiting for animation.

## 3. Acceptance criteria

### 3.1 Happy path (motion enabled)

- **Given** CardDetailScreen is open on the front face,
  **when** the child taps the hero card,
  **then** within 200ms the card rotates from 0° to 90° around its Y axis (becomes edge-on, invisible),
  **and** at the 90° midpoint the React face state swaps from `front` to `back` (so the back face content is in place when rotation completes),
  **and** within the next 200ms the card rotates from 90° back to 0°, revealing the back face.

- Total animation duration: **~400ms** (200ms each leg). Uses `motion.duration.base` × 2 from the tokens.

- Easing: `cubic-bezier(0.2, 0, 0, 1)` (standard easing from `motion.easing.standard`) for both legs.

### 3.2 Reduced-motion path

- **Given** the OS reports `prefers-reduced-motion: true`,
  **when** the child taps the hero card,
  **then** the face swaps **instantly** with no rotation (current F-CARD-002 v1 behavior).

### 3.3 Tap during animation

- **Given** the card is mid-flip,
  **when** the child taps again,
  **then** the additional tap is **ignored** until the current flip completes (animation duration ≥ tap debounce).
- This prevents stuck-in-edge-on states from rapid re-tapping.

### 3.4 Locked card (unchanged)

- Locked cards do NOT respond to tap — no animation, no state change. (Same as F-CARD-002 §3.6.)

### 3.5 Layout stability

- The card container has enough min-height to hold both faces' content without layout shift mid-flip.
- The hero card retains its rarity border + radius during rotation.
- No layout reflow during animation — only the transform changes.

### 3.6 Animation correctness

- Uses `react-native-reanimated` `useSharedValue` + `useAnimatedStyle` + `withTiming` + `runOnJS`.
- Perspective is set in the transform array (`{ perspective: 1000 }`) before `rotateY` to render the 3D depth correctly.
- The face state swap happens on the **midpoint callback** of the first `withTiming`, ensuring the content for the new face is present before it becomes visible.

### 3.7 Accessibility

- The `Pressable` keeps its `accessibilityRole="button"` and `accessibilityLabel`.
- Screen readers announce the new state (front/back) after the swap — handled implicitly by React re-rendering the body.
- No new a11y traps introduced (the animation does not steal focus).

## 4. Out of scope

- **Sound effect** on flip — silent in v1 (no SFX system yet).
- **Spring animation** — uses `withTiming` (predictable duration), not `withSpring`.
- **3D shadow / lighting changes** during rotation — flat colors only.
- **Touch-drag flip** (swipe to rotate) — only tap-triggered.
- **Multiple cards flipping in sync** — single card view only.
- **Persisted "preferred face"** — face still resets to `front` on remount.

## 5. UI sketch

Same content as F-CARD-002 §3.2 / §3.3. The only change is the rotation between them. Mental model:

```
t=0ms       t=100ms      t=200ms      t=300ms      t=400ms
 ┌───┐       ┌─┐                       ┌─┐         ┌───┐
 │FR │       │FR│         |             │BK│        │BK │
 │ON │       │ON│         (edge-on,    │ACK│       │ACK │
 │ T │       │ T│         invisible —  │   │       │    │
 └───┘       └─┘          state swap)   └─┘         └───┘
  0°         45°            90°          135°        180° → 0° (final)
```

(The card's final rotation reads as 0° from the user's perspective because we run the second half of `rotateY` from 270°→360° equivalently → the back face appears upright.)

Simpler implementation note: we do **not** maintain two stacked views. The single visible body swaps based on React `face` state at the midpoint. The user perceives a 3D flip; the engine animates a single view's `rotateY` 0→90→0 with content swap at 90°.

## 6. Tests

- **Manual** (visual):
  - Flip with motion enabled — see smooth rotation
  - Flip with reduce-motion enabled — instant swap
  - Tap rapidly during animation — additional taps ignored
  - Locked card — no animation, no flip

- **Unit / integration**: no behavior change to logic layer. Existing tests pass.

- **Typecheck**: reanimated worklet correctness checked at compile-time.

## 7. Rollout

- Ships immediately after F-CARD-002. No feature flag.
- Default-on for all unlocked cards.
- Reduced-motion fallback ensures accessibility compliance.

## 8. Dependencies

### Upstream (must ship first — all done)

- F-CARD-002 Card back face (✅ PR #20) — provides the front/back state to animate around.
- `react-native-reanimated` ~3.16.1 (✅ PR #13).
- `babel.config.js` reanimated plugin (✅ PR #13).
- `platform/motion.ts` `useReducedMotion` hook (✅ PR #13).
- `tokens.motion.duration.base` (✅ PR #15).

### Downstream

- F-MOTION-003 Card unlock celebration animation (when a card is earned for the first time).
- F-MOTION-001 Hoya pose transitions.

### External

- No new packages.
