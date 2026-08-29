# Parent/Learner-Detail — single-learner drill-down (wireframe v1, MVP-optional)

Spec: `docs/specs/F-PAR-001-parent-dashboard.md` §5 (listed as "Phase 2, optional in MVP")
Audience: **parent**

> Status note: wireframed now so `parent/dashboard` has a stable exit target;
> may ship as MVP-thin (sections 1–2 only) or slip to Phase 2 without breaking
> the dashboard flow.

## Scenario (Given-When-Then)

Given: a parent read a learner's weekly card and wants one level more depth
When: they tap "More about `<name>`"
Then: they see that learner's Journey position, this week's jamo/quest history, and the Heritage collection — still framed as growth, still no cross-learner comparison

## Screen goal

"Answer 'where exactly is she on the journey?' for one learner."

## Box diagram

```
┌──────────────────────────────────┐
│ [← back]   [avatar] Name         │
│                                  │
│  Journey position                │
│  Stage 1 · Chapter 2             │
│  ▓▓▓▓░░░░░░ (chapter progress)   │
│                                  │
│  This week, day by day           │
│  M  T  W  T  F  S  S             │
│  ●  ●  ○  ●  ○  ○  ●             │  ← practiced-day dots,
│  (no red, no "missed" label)     │    absent days just hollow
│                                  │
│  New this week                   │
│  [ㅁ] [ㅂ] [ㅅ] (jamo chips)     │
│  · quest title line ×N           │
│                                  │
│  Heritage collection             │
│  [card] [card] [card] [card] →   │  ← horizontal scroll,
│  (collected only, no locked      │    mirrors child's Library
│   slots shown here)              │
│                                  │
│  [ 🎤 Record a message ]         │  → parent/voice-recorder
└──────────────────────────────────┘
```

- Day-dots row shows presence, never absence-as-failure: hollow dots carry no color-coded warning, no streak-break framing (§3.6).
- Locked/uncollected cards are hidden on the parent surface — "what's missing" framing is the learner's own discovery, not a parent report.

## Interaction points

- [ 🎤 Record a message ] → `parent/voice-recorder` (this learner preselected)
- Heritage card tap → read-only card zoom (same asset as learner Library, no stats)
- Jamo chip tap: no-op MVP (Phase 2: per-jamo accuracy popover)
- [← back] → `parent/dashboard`

## Navigation graph

Enter from: `parent/dashboard` ("More about `<name>`")
Exit to:    `parent/dashboard` · `parent/voice-recorder` · card zoom (modal, self-dismissing)

## States

- **success**: sections above.
- **empty** (< 3 days of use / no collection yet): Journey position always renders; other sections replaced by one "just getting started" reassurance line — no empty grids.
- **error** (aggregation fails): Journey position from last snapshot + "can't load this week yet" + [ TRY AGAIN ].

## Data needs

- reads: `ProgressSnapshot` (journey position) · practiced-day set for current week (`logic/parent-dashboard/week-summary`) · collected `HeritageCard` ids for this profile
- writes: none; telemetry `parent_learner_detail_viewed`
- copy: F-CNT-001 caregiver-surface banned-substring lint applies

## Open questions

- Does this screen justify MVP inclusion, or does the dashboard card already answer 90% of parent questions? (beta: instrument tap-through rate from dashboard)
- Card zoom: reuse the learner CardDetail screen vs a stripped parent variant? (default stripped — learner screen carries celebration copy that reads oddly to adults)
