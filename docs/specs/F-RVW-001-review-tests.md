# F-RVW-001 — Review Tests (Daily / Feedback / Stage)

**Status**: `draft`
**Scope**: `apps/mobile` · `packages/content-schema` · MVP (Stage 1 range)
**Owner**: solo dev
**Rollout**: MVP — all three review kinds, Stage 1 content only. Stage 2+ extensions are content work, not new spec.

Parent doc: `docs/blueprints/09-homework-review-profiles-addendum.md` §2.

---

## 1. Context

Review tests are how Hangul Route turns *measurement into collection*. The blueprint forbids learner-visible scores (`02-core-feature-spec §4.3`, anti-shame); however, spaced retrieval is critical for jamo retention (a 5-year-old learner forgets ㅂ in 72 hours without reactivation). F-RVW-001 reconciles these by routing every measurement into one of two channels:

| Channel | Audience | Format |
|---|---|---|
| **Learner channel** | the child | stars (1–3, minimum 1) + collection count delta |
| **Caregiver channel** | parent / teacher (F-PAR-001 / F-TCH-001) | accuracy %, time-on-task, missed-element list |

Three review kinds, all sharing one engine:

- **Daily Test** — gateway from home card ③ (F-HW-001). 60–90 s. Spaced retrieval focus.
- **Feedback Review** — tail of every Quest, attached to Step 5 Celebrate. 30–45 s. Memory consolidation.
- **Stage Review** — fires once when a learner completes the last Episode of a Stage. 5–7 min. Anchor-skill audit + Stage Certificate.

## 2. User story

> As **P4 / P5**, I want to look back at what I learned and *feel I'm collecting more*, not *being graded*, so I want to return tomorrow.

Companion stories:

- As a **parent**, I want a single number ("Stage 1 jamo recognition: 78%") so I can answer "is my kid actually learning?" — but never have that number shown to my child.
- As a **content author**, I want one review engine across three kinds so adding a new prompt type doesn't fork the code.

## 3. Acceptance criteria

### 3.1 Stars-only learner surface

- **Given** a `ReviewAttempt` completes with `correctCount = K` out of `totalCount = N`,
  **when** the learner-facing result screen renders,
  **then** stars are awarded as: `K / N ≥ 0.8 → 3 stars`, `0.5 ≤ K / N < 0.8 → 2 stars`, `K / N < 0.5 → 1 star`.
- **Given** the learner answered 0 / N correctly,
  **when** the result renders,
  **then** the screen still awards **1 star** and renders Hoya in `thinking` pose with copy *"좋은 시도! 별 하나 모았어!"* — never 0 stars, never empty.
- The learner result screen must not render any percentage, ratio, fraction, or comparative number. Lint: extend F-CNT-001 banned regex with `\d+\s*%`, `\d+\s*/\s*\d+`.

### 3.2 Daily Test — spaced retrieval

- **Given** a learner runs the daily test on day N,
  **when** items are selected,
  **then** the item pool follows the algorithm in `09-...-addendum.md §2.3`:
  - Pool A (yesterday): 1–2 items (50 % weight)
  - Pool B (D-2, D-3): 1 item (30 % weight)
  - Pool C (last test's misses): 1 item (forced inclusion)
  - Pool D (D-7 long-term): 1 item (10 % weight)
- **Given** a Pool C item is answered correctly on day N,
  **when** the next daily test runs,
  **then** the item moves from Pool C to Pool A weighting (re-enters normal rotation, not re-forced).
- **Given** any item appeared in yesterday's daily test,
  **when** today's items are selected,
  **then** that item is **excluded** from today's pool (anti-staleness rule). The Pool C forced item is exempt — that's its whole purpose.

### 3.3 Feedback Review — Quest tail

- **Given** a Quest's Step 5 Celebrate fires,
  **when** the Quest has new-element count ≥ 1,
  **then** a 1-question Feedback Review fires inline (within the same Celebrate surface), prompting recall of the Quest's main new element.
- **Given** the learner answers the Feedback Review,
  **when** the answer registers,
  **then** Hoya delivers a recap line ("오늘 ㅂ 을 4 번 봤어!") regardless of correctness. **No extra stars** — Quest score absorbs the result.
- Feedback Review must complete in ≤ 45 s wall-clock, including animation. If the learner doesn't answer within 15 s, the system auto-marks `skipped` (not wrong) and proceeds to Hoya recap.

### 3.4 Stage Review — anchor audit

- **Given** a learner completes the last Episode of a Stage,
  **when** the Episode results screen exits,
  **then** a Stage Review **invitation** appears (skippable — "Now or later?"). Default: take now.
- **Given** the learner accepts a Stage Review,
  **when** items are built,
  **then** N = 4 to 6, drawn so that **each of the 5 Theme pillars contributes ≥ 1 item** (grid balance).
- **Given** the Stage Review completes,
  **when** the result screen renders,
  **then** the learner sees:
  - 3-star tier (per §3.1) — never the accuracy number
  - the **Stage Certificate** (their name, Hoya stage form, date)
  - a horizontally-scrollable **collection wall** of every Heritage card earned in that Stage
- The caregiver dashboard (F-PAR-001) receives a `stage_anchor_accuracy` event with the actual percentage.

### 3.5 Engine separation (testability)

- The review **engine** (selection, scoring, star math) lives in `apps/mobile/src/logic/reviews/` and is fully pure — no React, no platform, no audio.
- The review **player** (UI shell, animations, Hoya wiring) lives in `apps/mobile/src/screens/reviews/` and consumes the engine.
- Engine coverage target: 100 % branch.

### 3.6 Persistence

- Each `ReviewAttempt` is persisted to the active profile's local store (Phase 1 — `packages/hooks` AsyncStorage wrapper).
- The last 30 attempts are retained per profile; older attempts roll into a monthly `ReviewSummary` aggregate (stars histogram, misses by item).
- Phase 2: same writes go to D1 (F-INFRA-004).

## 4. Out of scope

- **Voice / pronunciation review** (speak-the-jamo) → blocked on STT bench (INBOX T-013), tracked separately.
- **Adaptive difficulty** (raise stakes if 3-star streak) — explicit anti-pattern; competition / streak inflation conflicts with anti-shame.
- **Multi-learner leaderboards** — explicit no, ever.
- **Stage 2+ Review content** — content work, this spec only covers the engine + Stage 1 question set.

## 5. UI sketch

To be authored in Week 5–6 design playbook:

- `design/wireframes/reviews/daily-test.md`
- `design/wireframes/reviews/feedback-tail.md`
- `design/wireframes/reviews/stage-review.md`
- `design/wireframes/reviews/stage-certificate.md`
- `design/wireframes/reviews/collection-wall.md`

## 6. Tests

### Unit — `apps/mobile/src/logic/reviews/`

| File | Coverage focus |
|---|---|
| `logic/reviews/star-calc.ts` | §3.1 — thresholds + 0/N → 1 star floor |
| `logic/reviews/daily-pool.ts` | §3.2 — Pool A/B/C/D weighting, Pool C forced, anti-staleness |
| `logic/reviews/stage-balance.ts` | §3.4 — each pillar contributes ≥ 1 |
| `logic/reviews/banned-text.ts` | §3.1 — no %, no x/y fractions reach learner UI |
| `logic/reviews/engine.ts` | end-to-end attempt lifecycle (started → item answer × N → completed) |

### Integration

- 14-day simulated learner: every day runs the daily test; verify Pool C correctly retries-then-graduates a missed item; long-term Pool D triggers on day 8.
- Quest completion → Feedback Review fires within Celebrate surface (timing).
- Stage 1 simulated completion → Stage Review with 5-pillar balance + Certificate + collection wall.

### E2E (Detox, nightly)

- Cold launch → learner profile → daily test from home card ③ → 5 items → result screen → no % shown.

## 7. Rollout

- **MVP**: full engine, Stage 1 content only.
- Feature flag: `reviews.stageReview` (default `true`). `reviews.dailyPoolD` (default `false` until 14 days of telemetry exists — Pool D needs history).
- Beta: families with 7+ days of use validate spaced retrieval feels natural.

## 8. Dependencies

### Upstream

- **F-001** (Hangul Tile Game) — Quest source for Feedback Review tail.
- **F-002** (Hoya Feedback Bubble) — used for all learner-facing result copy.
- **F-HW-001** (Homework) — daily test is invoked from home card ③.
- **F-PROF-001** (profiles) — every attempt is scoped to `currentProfileId`.
- **packages/content-schema** — needs `ReviewAttempt` / `ReviewItem` types + Stage-1 item pool seed.

### Downstream

- **F-PAR-001** consumes per-profile review history for the caregiver dashboard.
- **F-TCH-001** consumes class-aggregated `stage_anchor_accuracy`.
- **F-INFRA-004** (D1 sync) — Phase 2 dual-write target.

### Content

- **Stage 1 review item seed**: 30 jamo prompts + 12 first-syllable prompts authored in `content/reviews/stage-1.json`. Reuses F-001 audio assets.
