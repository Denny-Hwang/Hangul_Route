# F-007 — Animated Stroke Hint ("Draw Here Next")

**Status**: `ready`
**Scope**: `apps/mobile` · TraceStrokeGame · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish (after F-004)

---

## 1. Context

F-004 ships the trace experience with a static faint guide outline. When a child is stuck — or wants to see the "correct" stroke order + direction — they need a **demonstration**: an animated overlay showing where to start, which way to go, and in what sequence.

F-007 adds a **"Show me" button** that plays a brief animation: a dot travels along each target stroke in order from start to end, then fades. The child watches, dismisses, and tries again.

## 2. User story

> As **P5 (any age)** stuck on tracing ㅂ (4 strokes), I want to tap **"Show me"** and watch the letter draw itself once, so that I see *where* each stroke starts and *how* it flows.

## 3. Acceptance criteria

### 3.1 Trigger

- A **"Show me"** button appears below the trace zone, between the trace area and the Clear button.
- Style: `tone="secondary"`, `size="sm"`.
- Tap → play the animation once. Button is disabled during playback.

### 3.2 Animation

For each target stroke in order:
1. A small bright dot (`feedback.nudge` amber, 10px radius) starts at the stroke's first point.
2. Travels along the stroke path to the last point over `motion.duration.crawl` (~600ms).
3. As it travels, a fading trail follows it (drawn as the stroke itself with strokeOpacity animating 0 → 0.6 along the path).
4. When the dot reaches the end, pause 100ms, then begin the next stroke (if any).
5. After the last stroke completes, the entire trail fades out over 400ms.

Total animation: ~`(numStrokes × 700ms) + 400ms`. For ㄱ (1 stroke): ~1.1s. For ㅂ (4 strokes): ~3.2s.

### 3.3 Don't block the child

- The trace zone remains visible during the animation (no overlay covering it).
- The child can still see their own drawn strokes underneath the demonstration.
- After animation, the dot disappears. Drawn strokes are NOT cleared.

### 3.4 Reduced-motion path

- If `prefers-reduced-motion: true`: skip animation. Briefly flash each target stroke at full opacity for 200ms in sequence. Total ~`(numStrokes × 300ms)`.

### 3.5 Replay limit

- No replay limit. Child can tap "Show me" as many times as they want.

## 4. Out of scope

- **Voice narration** during the demonstration ("first stroke", "second stroke") — F-009.
- **Slow-motion mode** for older learners.
- **Per-stroke speed customization**.
- **Pause / scrub** mid-animation.
- **Multiple-letter demonstration** (e.g., entire syllable) — F-MOTION-008.

## 5. Dependencies

Upstream: F-004 (✅ PR #25).
Downstream: F-009 narrated demonstration.
