# F-008 — Stroke Order as Hard Pass Criterion

**Status**: `ready`
**Scope**: `apps/mobile` · stroke-scoring + TraceStrokeGame · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish (after F-005, F-006, F-007)

---

## 1. Context

F-005 added `orderCorrect` to the score envelope as an **auxiliary** signal — the post-pass hint *"next time try the top line first"* lands, but order didn't gate the pass.

F-008 makes order **optionally** part of the pass criterion via a `strictMode` toggle. When strict:

- `coverage >= 0.65 AND orderCorrect` → pass
- Otherwise → fail (HoyaBubble thinking + auto-clear + retry)

Strict mode is **off by default in v1**. The prop exists on `TraceStrokeGame` so future surfaces can opt in (e.g., older-kid difficulty, parent-set "strict practice" mode).

## 2. User story

> As **a parent** with an 11-year-old who already mastered Stage 1 the easy way, I want a **strict mode** that requires correct stroke order — so the child practices proper Hangul handwriting, not just shape recognition.

## 3. Acceptance criteria

### 3.1 `scoreTrace` extension

`scoreTrace` returns a new derived field:
- `passWithOrder?: boolean` — true iff `coverage >= 0.65 AND orderCorrect === true`. Only populated when `checkOrder: true`.

The existing pass threshold field (`coverage >= 0.65`) remains the **default** pass signal — F-008 adds an *alternative* signal, not a replacement.

### 3.2 `TraceStrokeGame` prop

New prop `strictMode?: boolean` (default false).

- `strictMode: false` (default) → pass criterion is `coverage >= 0.65` (unchanged from F-004)
- `strictMode: true` → pass criterion is `passWithOrder === true`

### 3.3 Failure message under strict mode

If strict mode is on AND the child passes coverage but fails order:
- HoyaBubble shows `tone="thinking"` with message: *"Almost! Try drawing the strokes in the right order. Tap **Show me** to see."*
- Strokes auto-clear after 2000ms (longer than the standard 1500ms — more cognitive lift)
- Skip remains available

### 3.4 Existing soft hints still apply

When strict mode is **off** AND the child passed coverage but failed order → the post-pass coaching from F-005 still fires ("you got it! next time try drawing the top line first").

### 3.5 No default UI surface in v1

This spec **does not** add a settings toggle. Activating strict mode requires the consuming screen to pass `strictMode={true}`. No UI work in this PR.

Future surfaces that may opt in:
- Parent-set difficulty per profile (F-PROF-002)
- Age 10-11 default-on (when age-group routing lands, F-PROF-003)
- "Strict practice" minigame variant in Homework (F-HW-002)

## 4. Out of scope

- **Settings UI** to toggle strict mode — separate F.
- **Per-profile default** based on `ageGroup` — separate F (needs profile schema).
- **Direction also as pass criterion** — F-006 stays auxiliary forever in v1; combine via `passWithOrderAndDirection` only when there's a real surface that needs it.
- **Star bonus** for passing with order — separate F-MOTION-006 (e.g., +1 star when strict pass).

## 5. Dependencies

Upstream: F-005 (✅ PR #26), F-004 (✅ PR #25).
Downstream: F-PROF-002 (per-profile difficulty), F-MOTION-006 (star bonus).
