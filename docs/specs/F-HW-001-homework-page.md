# F-HW-001 — Homework Page (Chapter / Session)

**Status**: `ready` (promoted by T-027 — see §9 Decisions)
**Scope**: `apps/mobile` · `packages/content-schema` · MVP (system-suggested only) / Phase 2 (parent + teacher assignment)
**Owner**: solo dev
**Rollout**: MVP — Today's mission auto-suggestion. Parent / Teacher explicit assignment lands in Phase 2 alongside F-PAR-001 / F-TCH-001.

Parent doc: `docs/blueprints/09-homework-review-profiles-addendum.md` §1.

---

## 1. Context

The Heritage Journey grid (`04-main-content-outline.md`) gives the learner a 2D map (Stage × Theme) of Episodes and Quests. The grid alone, however, doesn't tell a 5-year-old *what to do today*. F-HW-001 adds a thin layer on top — a **homework page** — that:

1. Auto-suggests **3 mission cards** every day (Replay · New Quest · Daily test).
2. Accepts **explicit assignments** from a parent (F-PAR-001) or teacher (F-TCH-001) and merges them into the same 3-card surface.
3. Reports completion back to caregivers without ever showing a child a red ❌ or "missed".

The "3-card-only" cap is intentional: more cards trigger the *infinite to-do list* feeling we explicitly designed against (`02-core-feature-spec §4` Companion / anti-shame).

## 2. User story

> As **P4 / P5** opening the app in the morning, I want to see exactly **three things** my tiger friend wants to do today, so I know where to tap without scanning a long list.

Companion stories:

- As a **parent**, I want to add one specific replay to today's mission without overriding the auto-suggestions, so my child still feels the app — not me — is leading.
- As a **teacher** (Phase 2), I want to assign the same homework to a whole class in one click, so prep stays under 2 minutes per session.

## 3. Acceptance criteria

### 3.1 Today's mission surface (MVP)

- **Given** a learner profile opens the home screen on day N,
  **when** the home renders,
  **then** exactly **3 mission cards** are shown in this fixed order:
  1. **Replay** — a Quest from days N−1 or N−2 that the learner completed but had ≥ 1 wrong answer on.
  2. **New** — the next Quest in the learner's Journey (Stage × Theme cursor).
  3. **Daily test** — a 60–90 s review attempt scoped to the last 3 days of learning (see F-RVW-001).
- **Given** no qualifying *Replay* exists (e.g. day 1 of app use),
  **when** the home renders,
  **then** card ① is replaced by a *Story Time* card from the current Stage's recommended Library pack.

### 3.2 Card completion semantics

- **Given** a learner taps a mission card and finishes the underlying Quest / test / story,
  **when** completion fires,
  **then** the card flips to a ✨ "collected" state (Hoya cheering + heritage card / star count tick),
  **and** the home re-renders the remaining cards in their original positions (no shifting).
- **Given** the learner skips a card (taps another card first or exits the app),
  **when** the home re-renders next time,
  **then** the unfinished card is **still shown** without any visual penalty (no red badge, no "1 missed" text). Hoya idle illustration replaces the cheering one.

### 3.3 Anti-shame contract

- The home screen must never render text containing the substrings `missed`, `incomplete`, `failed`, or `overdue` to a learner profile. Lint covered by F-CNT-001 (extend the validator's banned-on-learner-surface list).
- Push notifications about unfinished homework are **disabled** for the learner profile. They surface only to parent / teacher profiles (gated by `role !== 'learner'`).

### 3.4 Assignment merge rules (Phase 2)

- **Given** a parent / teacher has assigned 1 explicit homework targeting today,
  **when** today's mission is built,
  **then** the assignment **replaces card ②** (New). Cards ① and ③ stay system-suggested.
- **Given** 2+ explicit assignments exist for today,
  **when** today's mission is built,
  **then** the assignment with earliest `createdAt` takes card ②; the rest move to tomorrow's queue (cap = 1 explicit / day to protect the 3-card budget).
- **Given** an assignment targets a Quest the learner has not yet unlocked (Stage gating),
  **when** the assignment is created,
  **then** the create call **fails fast** with a UI message on the caregiver side (English, e.g. "Suni hasn't reached this quest yet"). The caregiver never silently creates a blocked assignment. (The draft carried a Korean string here — corrected per CLAUDE.md §8, see §9.1.)

### 3.5 Accessibility / multi-profile

- 3 cards each ≥ 88 × 88 dp (above the 64 dp baseline — these are primary tap targets). Implemented with the existing `touchTarget.hero` token (96 dp) rather than a new 88 dp token — see §9.3.
- Card audio preview uses `platform/audio.ts` wrapper (F-001 §6).
- Mission generation reads `currentProfileId` from the active profile (F-PROF-001) — switching profiles re-runs §3.1 from scratch.

## 4. Out of scope

- **Push notifications** to caregivers when a child completes / skips homework → F-NOTIF-001 (later).
- **Recurring assignments** ("every Tuesday for 4 weeks") → Phase 3.
- **Class-level bulk assignment UI** (drag onto multiple students) → F-TCH-001 specifically.
- **Reward differentiation** between system-suggested and assigned homework. Same star math for both — caregiver assignments must not buy extra rewards.
- **Skip penalty** mechanics. There are none, ever.

## 5. UI sketch

To be authored in Week 5 design playbook:

- `design/wireframes/home/todays-mission.md` — the 3-card surface
- `design/wireframes/caregiver/homework-assign.md` — parent / teacher assignment screen (Phase 2)
- `design/screens/home/todays-mission.png` (mid-fi, Week 6)

Tokens only (CLAUDE.md §4). Card state uses the existing `Card` tones — `success` for collected, `paper` for pending (the draft named `colors.surface.celebration` / `colors.surface.idle`, which do not exist; see §9.3).

## 6. Tests

### Unit — `apps/mobile/src/logic/homework/`

| File | Coverage focus |
|---|---|
| `logic/homework/mission-builder.ts` | §3.1 — 3-card selection given a profile's history |
| `logic/homework/assignment-merger.ts` | §3.4 — explicit assignment ≤ 1 / day cap, locking to card ② |
| `logic/homework/gating.ts` | §3.4 — Stage gating rejection of out-of-range targets |
| `logic/homework/banned-text.ts` | §3.3 — banned substrings never appear in learner-facing strings |

### Integration

- 7-day simulated history (some replays, some skips, one parent assignment on day 4) → home screen renders the expected card mix each day.
- Profile switch (learner A → learner B mid-session) → home re-renders with B's history, A's state untouched.

### E2E (Detox, nightly)

- Cold launch → profile picker → learner → home → 3 cards visible → tap card ③ → daily test runs → return → card ③ in ✨ state.

## 7. Rollout

- **MVP (Phase 1)**: system-suggested only (no explicit assignment). Card ② source = Journey cursor; card ① = Replay or Story fallback; card ③ = daily test.
- **Phase 2**: enable explicit parent assignment via F-PAR-001. Teacher assignment via F-TCH-001.
- Feature flag: `homework.explicitAssignment` (default `false` in MVP, `true` after F-PAR-001 ships).

## 8. Dependencies

### Upstream

- **F-001** (Hangul Tile Game) — first concrete Quest target for Replay / New cards.
- **F-002** (Hoya Feedback Bubble) — card success animation reuses cheering pose.
- **F-PROF-001** (profiles) — must ship first; mission builder needs `currentProfileId`.
- **F-RVW-001** (review tests) — card ③ launches the Daily Test surface.
- **packages/content-schema** — needs `HomeworkAssignment` type added.

### Downstream

- **F-PAR-001** consumes the assignment API to create cards from the caregiver side.
- **F-TCH-001** extends assignment to class-level fan-out.

---

## 9. Decisions (T-027 — draft → ready)

### 9.1 Korean UI string in §3.4 — corrected

The draft specified the caregiver-side gating error as a Korean sentence.
UI copy is English everywhere (CLAUDE.md §8; Korean appears only as content
being taught, always with romanization + gloss). §3.4 now carries an English
message. **Residual risk**: none — no code shipped from the draft wording.

### 9.2 Daily-test card ③ ships behind a capability flag

§3.1 fixes card ③ as a Daily Test from **F-RVW-001**, which is still `draft`
(its promotion is T-030). Rather than ship a card that navigates nowhere —
the exact "dead button" class of defect cleaned up in PR #53 — the builder
takes a `capabilities: { dailyTestAvailable: boolean }` input:

- `dailyTestAvailable: false` (MVP today) → slot ③ falls back down the same
  preference chain used for slot ①, so the learner still sees **exactly three
  live cards**. That three-card invariant is the child-facing contract; which
  engine backs slot ③ is not.
- `dailyTestAvailable: true` (once F-RVW-001 lands) → slot ③ is the Daily
  Test, exactly as §3.1 specifies. No builder change, no migration.

**Residual risk**: until F-RVW-001 ships, a learner's third card is a second
replay/story rather than a spaced-review test, so the review-interval benefit
of §3.1 is not yet realised. Tracked by T-030–T-032, not by this feature.

### 9.3 Design tokens named in §5 do not exist

`colors.surface.celebration` and `colors.surface.idle` are not in
`packages/design-system/src/tokens.ts`, and there is no 88 dp touch-target
token. Rather than invent three tokens for one screen (which would also need
a `design/tokens/*.v1.md` counterpart to satisfy the F-DES-001 drift gate),
the surface uses what exists: `Card` tone `success` for a collected card,
`paper` for a pending one, and `touchTarget.hero` (96 dp) for the minimum
card height — 96 ≥ 88, so the acceptance criterion holds.

**Residual risk**: `success` tone is shared with other celebratory surfaces,
so a future visual pass may want a dedicated collected-card tint. That is a
design-system change (design-system-skill + token sync), deliberately not
bundled into this feature.

### 9.4 `HomeworkAssignment` — fields added, ordering key unified

`HomeworkAssignmentSchema` already existed in `packages/content-schema`
(`schemas/progress.ts`) but lacked what §3.4 needs. Added `profileId` (an
assignment targets one learner) and `targetDate` (the day it is *for*, which
is not the day it was created). §3.4 speaks of ordering by `createdAt` while
the schema carries `assignedAt`; unified on **`assignedAt`** rather than
carrying two timestamps that mean the same thing.

### 9.5 Banned-text enforcement lives in two places

§3.3's list is `missed`, `incomplete`, `failed`, `overdue`. Learner-facing
copy lives in *both* content JSON and screen code, so one mechanism cannot
cover it:

1. `scripts/validate-content.mjs` (F-CNT-001) gains a banned-substring pass
   over learner-facing English fields in `content/**/*.json`.
2. `logic/homework/banned-text.ts` is the pure, unit-testable guard the app
   uses for generated copy — the mission builder's own card text is asserted
   against it in tests.

The check is case-insensitive and word-boundary aware, so legitimate copy is
not caught by substring accident (e.g. "dismissed" must not trip `missed`).
The caregiver-surface list (F-PAR-001 §3.6) reuses mechanism 1 and lands with
T-037; the two lists stay separate because a word banned for a child
("missed") is sometimes necessary for an adult.
