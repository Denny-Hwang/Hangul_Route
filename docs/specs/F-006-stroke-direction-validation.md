# F-006 — Stroke Direction Validation

**Status**: `ready`
**Scope**: `apps/mobile` · stroke-scoring + TraceStrokeGame · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish (after F-004)

---

## 1. Context

F-004 scores coverage only. F-005 adds order awareness. F-006 closes the loop with **direction awareness**: for each stroke, did the child draw it from start-to-end (per the canonical skeleton) or end-to-start?

Drawing ㄱ right-to-left along the top horizontal is "backwards" — pedagogically suboptimal but valid for the shape. F-006 reports it; doesn't block.

## 2. User story

> As **P5 (8–11 yo, learning to write Korean)** I want occasional gentle reminders about stroke direction — *"draw the top line left-to-right next time"* — without being graded down for getting it wrong.

## 3. Acceptance criteria

### 3.1 `scoreTrace` extension

`scoreTrace` accepts new optional `checkDirection?: boolean`. When true, the result includes:
- `directionsPerTarget: boolean[]` — one entry per target stroke: did the matching drawn stroke run start→end the same way?
- `directionsCorrect: boolean` — true iff every entry is true.

### 3.2 Algorithm

For each target stroke and its best-matching drawn stroke:
1. Compute target vector: `(targetEnd - targetStart)`, normalized.
2. Compute drawn vector: `(drawnLastPoint - drawnFirstPoint)`, normalized.
3. Dot product > 0.5 (within ~60° cone) → direction correct.

If a target stroke has no matching drawn stroke, that direction defaults to `false` (can't be correct if it wasn't drawn).

> **Revised 2026-10-10 (audit UX-02).** Closed loops (ㅁ ㅇ ㅎ and their batchim forms) start and end at the same spot, so the start→end vector above is zero and would fail every loop. For a closed target stroke, direction is its **winding** (clockwise vs counter-clockwise, by signed area) instead; a drawn stroke enclosing under 25% of the loop's area (for example one straight side of ㅁ) carries no winding and is never marked wrong. The result also reports which targets are loops (`closedPerTarget`). Open strokes keep the rule above.

### 3.3 Pass criteria unchanged

Direction is informational. Pass remains coverage ≥ 0.65.

### 3.4 Hint surface (combined with F-005)

If coverage passes but direction is wrong on the first stroke:
- *"Nice! Try drawing left-to-right next time."*

If F-005 order ALSO failed: order wins (it's the more important hint).

> **Revised 2026-10-10 (audit UX-02).** "Left-to-right" only makes sense for open strokes. If the only wrong directions are on closed loops, the hint is *"Nice! Next time, try going around the other way."* — never left-to-right. If an open stroke is wrong too, the left-to-right hint wins. (`logic/trace-copy.ts`)

## 4. Out of scope

- Per-stroke direction marker UI — F-007 (animated hint) handles visualization.
- Direction as pass criterion — never (too restrictive for kids).
- Right-to-left script direction setting — Korean is LTR only.

## 5. Dependencies

Upstream: F-004 (✅ PR #25).
Downstream: F-007 animated hint, F-008 stricter scoring.
