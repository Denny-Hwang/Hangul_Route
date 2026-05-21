# F-MOTION-003 — Card Unlock Celebration

**Status**: `ready`
**Scope**: `apps/mobile` · ResultsScreen · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish

---

## 1. Context

When the child completes a quest and unlocks a Heritage card, the Results screen shows a small "Card added to your library!" card. Today it appears statically. F-MOTION-003 makes the moment feel like a **reward**: the card drops in from above with a spring bounce, and a small sparkle burst appears around it for ~600ms.

## 2. User story

> As **P5** (5–11 yo) seeing the Results screen after a perfect quest, I want the new card I just earned to feel like a **gift dropping in**, not just text that appears.

## 3. Acceptance criteria

### 3.1 Drop-in animation

- **Given** the ResultsScreen mounts AND the completed quest has a `rewardCardId`,
  **when** the screen renders,
  **then** the "Card added to your library!" card animates from `translateY: -80, opacity: 0` to `translateY: 0, opacity: 1`,
  **and** the animation uses spring physics (damping 12, stiffness 90) for the bouncy "drop" feel,
  **and** there's a 400ms delay after screen mount so the stars + Hoya bubble register first.

### 3.2 Sparkle burst

- 100ms after the drop-in completes, 5 small amber sparkles appear around the card and fade out over 600ms.
- Sparkles are positioned: top-left, top-right, bottom-left, bottom-right, top-center of the card.
- Each sparkle: 12px 4-point star shape in `feedback.nudge` #F2B33D, opacity animates 0 → 0.9 → 0 over 600ms.

### 3.3 No-card path

- If the quest has no `rewardCardId`, the unlock card is not rendered (today's behavior) → no animation fires.

### 3.4 Reduced-motion path

- **Given** `prefers-reduced-motion: true`,
  **then** the card appears statically (no drop-in, no sparkles).

### 3.5 Star count gating

- The drop-in + sparkles fire only when `stars >= 2` (no card unlock on 1-star results per existing logic).
- For 3-star results: full sparkle burst.
- For 2-star results: drop-in only, no sparkle burst (more restrained).

### 3.6 Performance

- The animation should not block the "Back to journey" CTA — the CTA remains interactive throughout.

## 4. Out of scope

- **Confetti** — explicitly avoided per CLAUDE.md anti-shame / quiet generous principle ("no confetti spam").
- **Sound effect** — silent.
- **Hoya animated reaction synced with the drop** — Hoya's pose is already cheering on 2+ stars; F-MOTION-001 pulse handles it.
- **Background flash** — the bg-celebration texture is enough.

## 5. UI sketch

```
t=400ms   t=600ms   t=800ms   t=1000ms   t=1400ms
                                ✨  ✨    ✨  ✨
                              ┌─────────┐  ✨
                              │  Card!  │   ┌─────────┐
[hidden]  drop-in...  drop-in │ in lib  │   │  Card!  │
                              └─────────┘   └─────────┘
                                            ✨  ✨
                                              ✨
                                          sparkles fade
```

## 6. Tests

- Manual: complete a 3-star quest with a reward card → see drop-in + sparkles.
- Manual: complete a 2-star quest with reward card → drop-in only.
- Manual: complete a 1-star quest → no card-unlock UI at all.
- Manual: enable reduced-motion → static card.
- Typecheck: 8 packages clean.

## 7. Rollout

- Ships immediately. Default-on.

## 8. Dependencies

### Upstream (must ship — all done)

- `react-native-reanimated` (✅ PR #13).
- `react-native-svg` for sparkle shapes (✅ PR #13).
- `tokens.motion.duration` + `tokens.colors.feedback.nudge` (✅ PR #15).
- `platform/motion.useReducedMotion` (✅ PR #13).

### Downstream

- F-MOTION-004 Star pop-in animation on the StarRow (separate brief).
