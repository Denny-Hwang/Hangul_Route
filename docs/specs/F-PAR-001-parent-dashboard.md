# F-PAR-001 — Parent Dashboard

**Status**: `draft`
**Scope**: `apps/mobile` (parent profile UI) · `packages/content-schema` · MVP-tier
**Owner**: solo dev
**Rollout**: MVP-thin — read-only summary cards. Explicit assignment + parent-message recording are Phase 2 expansions of the same surface.

Parent doc: `docs/blueprints/09-homework-review-profiles-addendum.md` §1.3, §3.5, §4.2. Originally hinted in `F-001 §4` (was referenced as `F-PAR-001`).

---

## 1. Context

When a parent switches into the parent profile (F-PROF-001 PIN flow), they land on the **Parent Dashboard**: a single-screen weekly digest of each linked learner's progress, presented as a *story of growth*, not a *grade report*. This is the only place in the app where numeric accuracy and percentages appear — strictly never on a learner screen (per F-RVW-001 §3.1).

The dashboard exists to:
1. Give parents enough signal to *trust* the app's curriculum (`02-core-feature-spec §4.5` parent alignment).
2. Provide a low-effort handle for parents to nudge — pre-recorded `N5` voice messages and (Phase 2) explicit homework assignment.
3. Reflect the addendum's *anti-pressure* contract — even with parents, copy emphasises **what was added this week**, not what's missing.

## 2. User story

> As a **parent** of a 6-year-old who started Hangul Route 3 weeks ago, I want to open the parent profile once a week and learn three things — *did she practice, what did she learn, what's next* — without wading through dashboards or graphs.

Companion stories:

- As a **parent**, I want to leave a 5-second voice message my child hears tomorrow morning, so my involvement feels personal even when I'm busy.
- As an **anxious parent**, I want the dashboard to gently reassure me that low practice days are fine, so I don't transfer that anxiety to my child.

## 3. Acceptance criteria

### 3.1 Dashboard structure (MVP — read-only)

For each linked learner, the dashboard renders a card with three sections:

```
┌─────────────────────────────────────┐
│  Suni — Stage 1, Chapter 2          │
├─────────────────────────────────────┤
│  This week                          │
│   · New jamo recognized: ㅁ ㅂ ㅅ   │
│   · Quests completed: 4             │
│   · Daily tests: 5 / 7              │
│   · Time on app: 38 min             │
├─────────────────────────────────────┤
│  Stage 1 anchor skill               │
│   Recognition: 78% (was 71%)        │
├─────────────────────────────────────┤
│  Suggestions                         │
│   · ㅂ wants one more visit         │
│   · Try Episode 1.A3 — story        │
└─────────────────────────────────────┘
```

- **Given** the parent dashboard opens,
  **when** the parent has 1+ linked learner,
  **then** one card per learner renders, ordered by most-recent activity first.
- **Given** a learner has < 3 days of app use,
  **when** the card renders,
  **then** "This week" section reads *"Just getting started — let's give Suni a few more days before reading the signal"*, and Anchor Skill section is hidden (too little data).

### 3.2 Numbers are allowed here — but framed

- The only places numbers appear in the **MVP** dashboard:
  - "Quests completed: N"
  - "Daily tests: K / 7"
  - "Time on app: N min"
  - "Recognition: X% (was Y%)" — only when delta is shown (no isolated %).
- **Banned**:
  - Any number that compares to *other learners* (no class average, no global percentile).
  - Any "behind / ahead of schedule" framing.
  - Trend graphs in MVP (line charts arrive in Phase 2 if requested).

### 3.3 Suggestion engine (MVP — rule-based)

Suggestions are produced by a small rules table:

| Trigger | Suggestion copy |
|---|---|
| Last 3 daily tests missed item X ≥ 2 times | "*X* wants one more visit" |
| Learner has not used Library Theme Pack this week | "Try a Story Time pack from the Library" |
| Stage 1 anchor accuracy gained ≥ 5% week-over-week | "Suni's recognition is climbing fast — celebrate!" |
| Learner missed ≥ 4 days this week | "No worries — pick one quick Quest to invite Suni back" |

- Max **3 suggestions per learner card**. Triggers run in priority order above.
- Each suggestion is **read-only in MVP** — tapping it does *not* create an assignment yet. Phase 2 will wire taps to F-HW-001's explicit assignment path.

### 3.4 Parent voice message (N5)

- **Given** the parent taps "Record a message for Suni",
  **when** the recorder opens,
  **then** the parent records ≤ 10 s audio. On confirm, the audio is stored locally keyed by the target learner's profile.
- **Given** the target learner next opens their home screen,
  **when** the home renders,
  **then** Hoya plays the parent's audio inline ("엄마가 보낸 메시지!") *before* surfacing today's mission. Audio plays at most once per message.
- **Given** the parent records a new message before the previous one was heard,
  **when** the new message is saved,
  **then** the new one replaces the old (queue depth = 1, prevents stacking).

### 3.5 Linked learners only

- **Given** the parent profile is active,
  **when** the dashboard builds,
  **then** only learner profiles created **on this device** by **this parent profile** appear. Phase 1 has no cross-device link (no Clerk yet).
- A learner without a linked parent (e.g. a teacher-created profile, Phase 2) does **not** render on this dashboard.

### 3.6 Anti-shame contract — extends to caregivers

- Dashboard copy bans the substrings `behind`, `falling behind`, `should have`, `missed too many`, `compared to`. Lint hook in F-CNT-001 extends to caregiver-surface strings as well.
- Even when learners have low engagement, the suggestion phrasing always starts with an invitation, never a warning.

## 4. Out of scope

- **Class / multi-family aggregation** — F-TCH-001 (teacher) and Phase 3 family-link respectively.
- **Push notifications** to parent ("Suni hasn't opened the app for 2 days") → F-NOTIF-001.
- **Subscription / billing surface** → Phase 2.
- **Trend graphs** beyond simple delta numbers → Phase 2 if validated by user research.
- **Export / share progress** outside the app → Phase 3 (alumni / certificates already cover the share story).

## 5. UI sketch

To be authored in Week 5–6 design playbook:

- `design/wireframes/parent/dashboard.md` — single-screen learner cards
- `design/wireframes/parent/voice-recorder.md` — N5 message recorder
- `design/wireframes/parent/learner-detail.md` — drill-down on a single learner (Phase 2, optional in MVP)

## 6. Tests

### Unit — `apps/mobile/src/logic/parent-dashboard/`

| File | Coverage focus |
|---|---|
| `logic/parent-dashboard/week-summary.ts` | aggregates per-profile data into "This week" + Anchor Skill block |
| `logic/parent-dashboard/suggestions.ts` | rule-table priority, max-3 cap |
| `logic/parent-dashboard/banned-text.ts` | §3.6 — banned substrings never appear |
| `logic/parent-dashboard/message-queue.ts` | §3.4 — queue depth = 1, replace semantics |

### Integration

- Seed a learner with 14 days of fixture data (5 missed days, 9 active) → dashboard renders sensible suggestions, no banned copy.
- Parent records voice message → switch to learner profile → home plays message once → switch back to parent → record again → only the new one plays next time.

### E2E (Detox, nightly)

- Cold launch → profile picker → parent → PIN → dashboard renders 1 learner card → tap voice recorder → record 3 s → confirm → switch back to learner → home plays message.

## 7. Rollout

- **MVP-thin**: read-only summary + N5 voice messages.
- **Phase 2**: tappable suggestions → explicit assignment via F-HW-001 (gated by `homework.explicitAssignment` flag).
- Feature flag: `parentDashboard.voiceMessages` (default `true`).
- Beta: parents in W7+ family cohort validate clarity of suggestions.

## 8. Dependencies

### Upstream

- **F-PROF-001** — parent role + linked-learners model + PIN gate.
- **F-HW-001** — homework assignment data model (Phase 2 wiring only).
- **F-RVW-001** — `stage_anchor_accuracy` event + `ReviewSummary` aggregate.
- **packages/content-schema** — needs `WeekSummary`, `Suggestion`, `ParentMessage` types.

### Downstream

- **F-NOTIF-001** (push) — will consume `WeekSummary` to schedule the weekly digest push.
- **F-INFRA-004** (D1 sync, Phase 2) — caregiver assignments must round-trip to D1 once shared across devices.

### External

- Recording API: `expo-av` (already required by F-001). Audio capped at 10 s, m4a, ≤ 80 KB.
