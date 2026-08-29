# Parent/Dashboard — weekly digest (wireframe v1)

Spec: `docs/specs/F-PAR-001-parent-dashboard.md` §3.1–3.3, §3.6
Audience: **parent** (only surface where numbers/percentages may appear — never mirrored on learner screens)

## Scenario (Given-When-Then)

Given: a parent passed the PIN gate on a device with 1+ linked learners
When: the dashboard opens (typically once a week)
Then: within one scroll they learn, per child: *did she practice · what did she learn · what's next* — as a story of growth, never a grade report

## Screen goal

"One card per learner answering practice / learned / next — read-only in MVP."

## Box diagram

```
┌──────────────────────────────────┐
│ [← back to picker]     [⚙]       │
│                                  │
│  "This week" (screen title       │
│   placeholder + date range)      │
│                                  │
│ ┌──────────────────────────────┐ │  ← 1 card per learner,
│ │ [avatar] Name — Stage/Chapter│ │    most-recent activity first
│ │──────────────────────────────│ │
│ │ This week                    │ │
│ │  · new jamo chips [ㅁ][ㅂ].. │ │
│ │  · quests completed: N       │ │
│ │  · daily tests: K / 7        │ │  ← only §3.2-allowed numbers
│ │  · time on app: N min        │ │
│ │──────────────────────────────│ │
│ │ Anchor skill                 │ │
│ │  recognition X% (was Y%)     │ │  ← delta always paired
│ │──────────────────────────────│ │
│ │ Suggestions (max 3, rows)    │ │
│ │  · suggestion line           │ │  ← read-only MVP (no tap)
│ │  · suggestion line           │ │
│ │──────────────────────────────│ │
│ │ [ 🎤 Record a message ]      │ │  → parent/voice-recorder
│ │ [ More about Name → detail ] │ │  → parent/learner-detail
│ └──────────────────────────────┘ │
│ ┌── next learner card … ───────┐ │
└──────────────────────────────────┘
```

- No primary [[ CTA ]]: this is a reading surface; per-card actions are secondary buttons.
- Banned anywhere on this tree: cross-learner comparison, class averages, "behind/should have" framing (§3.2, §3.6). Cards are visually parallel but never ranked or scored against each other.

## Interaction points

- [ 🎤 Record a message ] → `parent/voice-recorder` (that learner preselected)
- [ More about `<name>` ] → `parent/learner-detail`
- Suggestion rows: no-op in MVP (Phase 2 wires to F-HW-001 assignment)
- [← back] → `profiles/picker` · [⚙] → parent settings

## Navigation graph

Enter from: `profiles/pin-entry` success · `profiles/switch-button` "Grown-ups" path
Exit to:    `parent/voice-recorder` · `parent/learner-detail` · `profiles/picker` · settings

## States

- **success**: cards as above.
- **new learner** (< 3 days of use): "This week" replaced by "just getting started" reassurance line; Anchor-skill block hidden (§3.1).
- **empty** (no linked learners — parent created, kids not yet): single centered card, "add your first learner" placeholder + [[ ADD A LEARNER ]] → `profiles/create-learner`.
- **error** (summary aggregation fails): per-card fallback "can't load this week yet" + [ TRY AGAIN ] on the card; other cards unaffected.

## Data needs

- reads: linked learner profiles (this device, this parent — §3.5) · `WeekSummary` per learner (`logic/parent-dashboard/week-summary`, local aggregation) · suggestions (`logic/parent-dashboard/suggestions`, rule table, max 3)
- writes: none (read-only surface); telemetry `parent_dashboard_viewed`
- copy pipeline: all strings pass F-CNT-001 caregiver-surface banned-substring lint (§3.6)

## Open questions

- Card collapse for 3+ learners (weekend-school device): accordion vs full scroll? (default full scroll; measure with 4+ profiles in beta)
- "Time on app" risks pressure framing — keep in MVP per spec, but flag for beta parent interviews
