# F-004 — Trace Stroke (Construction · Real Implementation)

**Status**: `ready`
**Scope**: `apps/mobile` · Trace Stroke minigame · MVP
**Owner**: solo dev
**Rollout**: MVP — replaces the v1 3-tap placeholder

---

## 1. Context

Stage 1 Construction-family Game ⑤ "Trace Stroke" teaches the **shape** of each Korean jamo. The child draws the letter on screen; the app validates whether the drawn path matches the target shape's stroke skeleton.

**v1 placeholder** (shipped in PR #13): the child taps the letter 3 times. Always succeeds. Pedagogically empty — no actual stroke practice.

**This spec**: replace with a real gesture-driven stroke tracer. The child drags their finger across the letter shape; the app captures the gesture path, compares it to a predefined stroke skeleton, and scores the trace by **coverage** (what fraction of the target skeleton was visited within tolerance).

## 2. User story

> As **P5** (5–11 yo) who has heard the sound of `ㄱ` (giyeok) and wants to learn its shape, I want to **draw** ㄱ with my finger and have the app tell me my shape was right — so that I feel I have *made* the letter, not just tapped it.

Companion stories:

- As **P4** (heritage child seeing 가족 / 김치 already), I want the trace to feel responsive — my finger should leave a visible trail.
- As **a child who's bad at handwriting** (which is fine for ages 5–7 motor development), I want generous tolerance — getting the rough shape should be enough.

## 3. Acceptance criteria

### 3.1 Stroke skeleton model

Each jamo has a `strokes` array — ordered list of strokes, each stroke being an array of `{ x, y }` points (in a 200 × 200 viewBox). Example for `ㄱ`:

```ts
{
  jamoId: 'jamo:giyeok',
  strokes: [
    [{ x: 40, y: 50 }, { x: 160, y: 50 }, { x: 160, y: 150 }],
    // single L-shape stroke: top horizontal then down vertical
  ],
}
```

Implemented for **all 30 jamo** (24 base + 6 batchim).

### 3.2 Gesture capture

- The trace zone is a 280 × 280 dp canvas. The target jamo is rendered as a faint outline.
- The child uses `react-native-gesture-handler` `PanGestureHandler` (already in deps from PR #13) to draw.
- On `onBegin`: start a new stroke. On `onUpdate`: append `{ x, y }` to the current stroke. On `onEnd`: stroke is complete.
- Multiple strokes are allowed (jamo like `ㅂ` needs 4 strokes).
- Visible feedback: the drawn path renders as a `react-native-svg` `<Path>` with a warm-brown stroke in real time.

### 3.3 Scoring

- After the child taps **Done** (or after a 1.5s idle timer past the last `onEnd`), compute the score:
  - For each target stroke, find the fraction of skeleton points that have a drawn point within `tolerance` (24 dp at 200 viewBox scale).
  - Coverage = average across all target strokes.
  - Pass threshold: **0.65 coverage** (generous — kids 5–7 motor calibration).
- On pass: success-tint the trace zone, fire `recordRound(true)`, advance to next round.
- On fail: show HoyaBubble `thinking` tone — "Try again — start at the top!" — clear the drawn path, allow retry.

### 3.4 Visual feedback during draw

- The drawn path appears in `colors.text.primary` (warm-brown) at 8px stroke width with rounded line caps + joins.
- The target jamo outline behind is at 12% opacity `colors.text.primary` so the child can "trace over" it.
- No real-time coverage feedback — score is computed only on Done / idle timeout.

### 3.5 Clear / undo

- A small **Clear** button at the bottom of the trace zone clears all drawn strokes and resets the round.
- No per-stroke undo in v1 — Clear all and retry is the gesture.

### 3.6 Reduced-motion / accessibility

- The trace is the gameplay — no motion to reduce. But the **success animation** (trace zone scaling to success-tint) honors `prefers-reduced-motion`.
- Screen reader: the trace zone has `accessibilityLabel="Draw the letter {romanization} with your finger"`.
- Skip button stays — always-on fallback.

### 3.7 Multi-jamo round

- Each Trace Stroke minigame plays 4 rounds (one jamo per round) using the existing scope contract (`scopeJamoIds` in `minigame-config.ts`).
- Round counter at top: "Round 1 / 4".

## 4. Out of scope

- **Stroke order validation** — v1 accepts any order; we only score coverage. A future spec (F-005) can add order-sensitive scoring.
- **Stroke direction validation** — drawing ㄱ right-to-left scores the same as left-to-right. Direction is a Phase 2 refinement.
- **Animated stroke skeleton hint** (showing "draw here next") — Phase 2.
- **Per-stroke timing requirements** — no idle penalty mid-stroke.
- **Eraser / pinch-zoom** — Clear button is the only undo affordance.
- **Hand drawn audio sound effect** — silent.
- **Real Hangul calligraphy quality scoring** — out of scope for kids.

## 5. UI sketch

```
┌─────────────────────────────────────┐
│ ▓░░░     [1 / 4]                    │
│                                     │
│ Trace the letter giyeok             │
│ Draw the letter with your finger.   │
│                                     │
│   ┌─────────────────────────┐       │
│   │                          │      │
│   │     ┌────────┐           │      │
│   │     │   ㄱ   │  ← faint  │      │
│   │     │  guide │  outline  │      │
│   │     └────────┘           │      │
│   │                          │      │
│   │   [drawn path overlay]   │      │
│   │                          │      │
│   └─────────────────────────┘       │
│                                     │
│              [Clear]                │
│                                     │
│ 🐯 Slowly draw the letter. Lift     │
│    your finger to finish.           │
│                                     │
│ [Done]                              │
│ [Skip]                              │
└─────────────────────────────────────┘
```

## 6. Tests

### Unit (`apps/mobile/src/logic/`)

| File | Coverage focus |
|---|---|
| `logic/stroke-scoring.ts` | `scoreTrace` — coverage between drawn path + skeleton |
| | Edge cases: empty drawn path (0 score), perfect overlap (1.0), partial (between) |
| | Tolerance respected: drawn points outside tolerance don't count |

### Integration (manual / Detox future)

- Draw ㄱ correctly → see success, advance
- Draw poorly → see HoyaBubble nudge, allow retry
- Tap Clear → drawn path resets
- Tap Skip → step completes, no score

### Typecheck

- 8 packages clean. New module `logic/jamo-strokes.ts` types the stroke skeleton structure.

## 7. Rollout

- Ships immediately. Replaces the 3-tap placeholder.
- Plays in `quest:stage1-letters-q2` step 3 (`minigame:s1-letters-trace-1`) — already wired.
- No data migration; round state is ephemeral.

## 8. Dependencies

### Upstream (must ship — all done)

- `react-native-gesture-handler` (✅ PR #13, in deps).
- `react-native-svg` (✅ PR #13, in deps).
- `apps/mobile/src/logic/round-builder.ts` `buildTraceStrokeRounds` (✅ PR #13).
- Tokens (✅ PR #15).

### New module

- `apps/mobile/src/content/jamo-strokes.ts` — 30 jamo × ordered stroke skeleton arrays. Hand-authored polygonal approximations (e.g., `ㄱ` is 3 points; `ㅂ` is ~10 points across 4 strokes).
- `apps/mobile/src/logic/stroke-scoring.ts` — coverage scoring algorithm.

### Downstream

- F-005 Stroke order validation.
- F-006 Stroke direction validation.
- F-007 Animated stroke hint ("draw here next").

### External

- No new packages.
