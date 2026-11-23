# F-005 — Stroke Order Validation

**Status**: `ready`
**Scope**: `apps/mobile` · stroke-scoring + TraceStrokeGame · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish (after F-004)

---

> **Amended 2026-11-23 by `AMENDMENTS-STROKE-ORDER-STANDARD.md` [SO]** (work order WO-03 of the 2026-11 review: never teach a stroke order nobody has checked): the order line of section 3.3 is shown only for a letter whose stroke order a person has checked (`strokeOrderTaught`, ids in `reviewedStrokeIds`, row SO-3; none yet). For every other letter the order is not coached (`orderCorrect` is passed on as `null`), so no learner is told to change an order nobody has checked. Row SO-2 (open) checks the stroke data against a sourced table and may accept more than one order per letter (`altStrokes`, OD-SO4) (sections 3.1 to 3.3; row SO-1).

## 1. Context

F-004 scores trace coverage only — it ignores **stroke order**. A child can draw ㄷ by starting with the bottom horizontal first and still pass. Pedagogically OK for v1 ("just draw the shape") but Hangul has canonical stroke orders that, when followed, make writing flow easier.

F-005 adds **stroke order awareness** as an auxiliary signal (not a hard pass criterion):

- Coverage stays the threshold (0.65) — child still passes by drawing the shape.
- Order is **reported back** as a separate field: `orderCorrect: boolean`.
- A future spec (F-008) may make order a soft bonus (extra star, etc.).
- For v1: order is shown in the post-attempt HoyaBubble — *"You got it! Next time try drawing the top line first."*

## 2. User story

> As **P5 (8–11 yo, ready for stroke order coaching)** finishing a Trace Stroke round, I want to know if my drawing order matched the canonical Hangul order — not as a fail/pass — but as a small "try this next time" nudge.

## 3. Acceptance criteria

### 3.1 `scoreTrace` extension

`scoreTrace` accepts new optional `checkOrder?: boolean`. When true, the result includes:
- `orderCorrect: boolean` — true if the drawn strokes' best-matching target indices are monotonically increasing.
- `orderHint?: string` — e.g., `"start with the top line"` (per-jamo hint mapped to the first target stroke).

### 3.2 Pass criteria unchanged

Coverage threshold 0.65 still determines pass/fail. Order does NOT block.

### 3.3 Failure-side hint

If coverage passes but `orderCorrect === false`, the success HoyaBubble shows a gentle:
- *"You got it! Next time, try drawing the top line first."*

If coverage fails AND order is wrong, only the existing nudge ("Try again — start at the top!") is shown — no double feedback.

### 3.4 Algorithm

For each drawn stroke:
1. Find the target stroke index that best matches by coverage.
2. Append best-target-index to a sequence.

If sequence is monotonically non-decreasing → order correct.

## 4. Out of scope

- Order as a hard pass criterion — deferred to F-008.
- Per-stroke order hint UI (highlighting which stroke is next) — that's F-007 (animated hint).
- Stroke order coaching for ages 5–7 (too cognitively demanding) — feature stays opt-in via age group setting in a future F.

## 5. Dependencies

Upstream: F-004 (✅ PR #25).
Downstream: F-006 direction, F-007 hint, F-008 order as pass criterion.
