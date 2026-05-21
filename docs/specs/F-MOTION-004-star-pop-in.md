# F-MOTION-004 — StarRow Pop-in Animation

**Status**: `ready`
**Scope**: `packages/design-system` · StarRow component · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish

---

## 1. Context

StarRow renders 0-3 amber stars in a horizontal row (ResultsScreen, Episode quest list, Home recent-stars card). Today the stars appear instantly. F-MOTION-004 adds a **staggered pop-in** for the *filled* stars when StarRow mounts — each filled star scales 0 → 1.2 → 1.0 over ~300ms with a 120ms stagger between stars.

The effect is the visual climax of the Results screen: stars literally land one by one as the child reads "Wonderful!".

## 2. User story

> As **P5 (5–11 yo)** seeing my star count on Results, I want the stars to **arrive** one at a time — first star, then second, then third — so I feel each star being earned, not all dropped at once.

## 3. Acceptance criteria

### 3.1 Stagger sequence

- **Given** `<StarRow stars={N} />` mounts with N ∈ {1, 2, 3} and motion enabled,
- **then** each filled star animates from `scale: 0` → `scale: 1.2` → `scale: 1.0` over ~300ms,
- **and** star indices are staggered by 120ms each (so a 3-star row takes ~540ms total).
- Unfilled stars (positions ≥ N) appear statically at scale 1 from t=0 (no animation).

### 3.2 No-trigger paths

- **Given** `stars = 0`, **then** all 3 unfilled stars appear statically (no animation).
- **Given** `prefers-reduced-motion: true`, **then** all stars appear instantly at scale 1 (no pop-in).

### 3.3 Animate-on-mount only

- The pop-in fires **once on mount**. If parent rerenders with a different `stars` count without remount, no animation fires.
- (For Results screen, this is fine — the screen mounts fresh after a quest, so the pop-in always plays.)

### 3.4 Easing

- Use `Easing.bezier(0.34, 1.56, 0.64, 1)` (bouncy) for the scale leg — gives the small overshoot at 1.2 a "pop" feel before settling at 1.0.

### 3.5 Performance

- Driven by `react-native-reanimated` `withSequence(withDelay(withTiming))` — pure native-thread animation. Adds <10ms JS overhead per StarRow mount.

## 4. Out of scope

- **Sparkle/particle effects** around each star — separate F.
- **Sound effect** per star — silent.
- **Star count change animation** mid-screen (e.g., "you earned another star!") — Phase 2.
- **Animation on Home recent-stars card** — same StarRow component, but small size (28px) so the pop-in is visually subtle; ships automatically.

## 5. Dependencies

Upstream: F-HOYA-001 (✅ token motion easing), tokens (✅ PR #15), react-native-reanimated (✅ PR #13).
Downstream: F-MOTION-005 star count change animation.
