# F-RVW-001 — Review Tests (Daily / Feedback / Stage)

**Status**: `draft`
**Scope**: `apps/mobile` · `packages/content-schema` · `packages/content-schema/src/assessment/` (shared question engine, owner F-PLC-001) · MVP (Stage 1 range)
**Owner**: solo dev
**Rollout**: MVP — all three review kinds, Stage 1 content only. Stage 2+ extensions are content work, not new spec.

Parent doc: `docs/blueprints/09-homework-review-profiles-addendum.md` §2.

> **Amended 2026-10-11 by F-PLC-001 appendix B (B1 to B9, PR P-0).** The attempt session, selection helpers, seeded RNG and session clock are shared with the placement check and already live in `packages/content-schema/src/assessment/` (F-PLC-001 PR P-1, #161). This spec stays `draft` until its own PR 1; no review code is in the tree, so nothing shipped changes.

> **Amended 2026-10-12 by F-QUEST-002 (PR Q-11).** §3.3: a quest with a Check step shows no Feedback Review (decision L13). §3.4: for Stage 1 the Stage Review is the **Hangul Check**, 35 items (F-QUEST-002 §3.9, PR Q-10b), superseding "N = 4 to 6" for Stage 1 only. The `stage_anchor_accuracy` event is replaced by `review.complete` (analytics) and `ProgressSummary.stage1Anchor` (the caregiver channel). F-QUEST-002 Q-10b built the minimal engine files this spec names, `logic/reviews/star-calc.ts` and `logic/reviews/banned-text.ts`; this spec's PR 1 extends them.

> **Amended 2026-10-21 by F-CURR-002 (row CM-0b; owner decisions of 2026-10-21, F-CURR-002 sections 16 and 21).**
> - **Age wording removed** (CLAUDE.md section 1: the app is for anyone learning Hangul, at any age, so a shared surface or spec never names an age range or an age group). Sections 1, 2, 3.7 and 4 now say "learner", "parent or teacher" and "learners"; no rule changed with the wording.
> - **The Daily Test is rebuilt as the F-CURR-002 Daily Review** on the F-CURR-002 memory model and review engine (F-CURR-002 sections 4.2, 4.3 and 4.5; rows CM-12 to CM-14). The engine is `logic/reviews/engine.ts`, in the existing `apps/mobile/src/logic/reviews/` directory of section 3.5; F-CURR-002 section 4.5 writes the path as `logic/review/engine.ts`, and row CM-13 builds it in `logic/reviews/` rather than opening a second directory. The Pool A/B/C/D selection of section 3.2 is replaced by the F-CURR-002 due pool (lowest box first, then the oldest due day, then a jitter seeded by the item id) and its spacing rule; the quest reward step may offer F-CURR-002's "Try these again" (kind `feedback`, the misses of the quest just played), while a quest with a Check step still shows no one-question Feedback Review of section 3.3 (F-QUEST-002 L13 as amended); and for Stages 2-7 the Stage Review of section 3.4 is the F-CURR-002 Stage Check (sections 4.5 and 7.3): optional, never blocking, called "Stage Check" and never "exam", with a ceremony and a stage card and no certificate (F-CURR-002 OD-1). The Stage 1 Hangul Check of section 3.4 is unchanged.
> - **Kept unchanged:** the stars-only learner result of section 3.1 (1-3 stars, the 1-star floor, no percentage, ratio or fraction on a learner screen) and the anti-shame rules of section 3.7. Every F-CURR-002 review session that shows a result (Daily Review, Keep going, Try these again, Cell, Stage and Pack Check) shows stars only per section 3.1; the warm-up shows no result, only a soft "Warmed up" (F-CURR-002 section 4.5). All of them follow section 3.7.
> - **Review kinds.** F-CURR-002 adds the `ReviewKindSchema` kinds `cell-check` and `warmup` (row CM-3b, which first makes `reviews[]` lenient per entry on every read path and ships Worker first, F-CURR-002 section 4.8). Where this spec says `ReviewEntrySchema` is unchanged (sections 3.5 and 8), that holds for this spec's own rows only.

---

## 1. Context

Review tests are how Hangul Route turns *measurement into collection*. The blueprint forbids learner-visible scores (`02-core-feature-spec §4.3`, anti-shame); however, spaced retrieval is critical for jamo retention (a new learner can forget ㅂ within a few days without reactivation). F-RVW-001 reconciles these by routing every measurement into one of two channels:

| Channel | Audience | Format |
|---|---|---|
| **Learner channel** | the learner | stars (1–3, minimum 1) + collection count delta |
| **Caregiver channel** | parent / teacher (F-PAR-001 / F-TCH-001) | accuracy %, time-on-task, missed-element list |

Three review kinds, all sharing one engine:

- **Daily Test** — gateway from home card ③ (F-HW-001). 60–90 s. Spaced retrieval focus. (Rebuilt as the F-CURR-002 Daily Review, 10 items in about 2-3 minutes: see the 2026-10-21 amendment above.)
- **Feedback Review** — tail of every Quest, attached to Step 5 Celebrate. 30–45 s. Memory consolidation.
- **Stage Review** — fires once when a learner completes the last Episode of a Stage. 5–7 min. Anchor-skill audit + Stage Certificate. (Stages 2-7, amended 2026-10-21: the F-CURR-002 Stage Check, about 20 items, no certificate, F-CURR-002 OD-1; see the 2026-10-21 amendment above.)

## 2. User story

> As **P4 / P5**, I want to look back at what I learned and *feel I'm collecting more*, not *being graded*, so I want to return tomorrow.

Companion stories:

- As a **parent or teacher**, I want a single number ("Stage 1 jamo recognition: 78%") so I can answer "is this learner actually learning?" — but never have that number shown to the learner.
- As a **content author**, I want one review engine across three kinds so adding a new prompt type doesn't fork the code.

## 3. Acceptance criteria

### 3.1 Stars-only learner surface

- **Given** a `ReviewAttempt` completes with `correctCount = K` out of `totalCount = N`,
  **when** the learner-facing result screen renders,
  **then** stars are awarded as: `K / N ≥ 0.8 → 3 stars`, `0.5 ≤ K / N < 0.8 → 2 stars`, `K / N < 0.5 → 1 star`.
- **Given** the learner answered 0 / N correctly,
  **when** the result renders,
  **then** the screen still awards **1 star** and renders Hoya in `thinking` pose with copy *"Good try! You collected a star!"* (English — CLAUDE.md §8; Korean appears only as taught content) — never 0 stars, never empty.
- The learner result screen must not render any percentage, ratio, fraction, or comparative number. Lint: extend F-CNT-001 banned regex with `\d+\s*%`, `\d+\s*/\s*\d+`.

### 3.2 Daily Test — spaced retrieval

> **Superseded 2026-10-21 by F-CURR-002 section 4.5 (owner decisions of 2026-10-21; row CM-0b).** The Daily Review selects from the F-CURR-002 due pool under its spacing rule (section 4.3), so the pools below no longer apply once row CM-14 ships. The placement hand-over below (the `sym:` priority tokens) is carried by F-CURR-002 seeding (section 4.8 step 5: placement `priorityTokens` symbols are seeded at box 1, due on day 1). Kept here as the record of the earlier design.

- **Given** a learner runs the daily test on day N,
  **when** items are selected,
  **then** the item pool follows the algorithm in `09-...-addendum.md §2.3`:
  - Pool A (yesterday): 1–2 items (50 % weight)
  - Pool B (D-2, D-3): 1 item (30 % weight)
  - Pool C (last test's misses): 1 item (forced inclusion)
    - For the first three Daily Tests after a placement, the `sym:` entries of the newest placement result's `priorityTokens` take the Pool C slot in turn, one per test, each once (Pool C stays one forced item; `skill:` tokens are not items and are ignored here) (F-PLC-001 section 3.7).
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
  **then** a 1-question Feedback Review fires inline — same route as `results/celebrate`, rendered as a second panel after the stars register (no new navigation entry; wireframe `design/wireframes/reviews/feedback-review.md`) — prompting recall of the Quest's main new element. The trigger is new-element count ≥ 1, **not** "≥ 1 wrong item": a perfect Quest still seeds tomorrow's Daily Test pool (§3.2). Ruling recorded in `docs/blueprints/10-app-map.md` §7.
- **Given** the learner answers the Feedback Review,
  **when** the answer registers,
  **then** Hoya delivers a recap line (e.g. *"You saw ㅂ four times today!"* — English frame, the jamo is the taught content) regardless of correctness. **No extra stars** — Quest score absorbs the result.
- **Amended 2026-10-12 (F-QUEST-002 decision L13, PR Q-11): a quest that has a Check step (F-QUEST-002 §3.3, every Stage 1 quest) does not also show this Feedback Review.** The Check's two scored rounds are that quest's recall, so the learner answers one recall per quest, not two. A quest without a Check step (the Stage 2 / Stage 4 taste quests today) keeps the rule above.
- Feedback Review must complete in ≤ 45 s wall-clock, including animation. If the learner doesn't answer within 15 s, the system auto-marks `skipped` (not wrong) and proceeds to Hoya recap. The auto-skip is recorded through the shared `session.skip` (F-PLC-001 B9): the shared outcome set is `correct`, `wrong`, `skipped`, and there is no `timeout` outcome.

### 3.4 Stage Review — anchor audit

> **Amended 2026-10-21 by F-CURR-002 OD-1 (owner decisions of 2026-10-21; row CM-0b).** For Stages 2-7 the Stage Review below is the F-CURR-002 Stage Check (sections 4.5 and 7.3, row CM-22): about 20 items from all five themes, at least 30% at the produce rung, untimed, retaken freely, best result latching, and **no certificate**. The certificate bullets below now apply to Stage 1 only, whose Hangul Check is unchanged, and "Other stages keep N = 4 to 6" no longer applies to any stage.

- **Given** a learner completes the last Episode of a Stage,
  **when** the Episode results screen exits (or, later, when the learner taps the completed Stage cell on `journey/grid` — both entries lead here),
  **then** a Stage Review **invitation** appears (skippable — "Now or later?"). Default: take now.
- **Given** the learner accepts a Stage Review,
  **when** items are built,
  **then** N = 4 to 6, drawn so that **each of the 5 Theme pillars contributes ≥ 1 item** (grid balance).
- **Given** the Stage Review completes,
  **when** the result screen renders,
  **then** the learner sees:
  - 3-star tier (per §3.1) — never the accuracy number
  - the **Stage Certificate** (their name, Hoya stage form, date) (Stage 1 only; Stages 2-7: the F-CURR-002 Stage Check, no certificate, OD-1)
  - a horizontally-scrollable **collection wall** of every Heritage card earned in that Stage
- ~~The caregiver dashboard (F-PAR-001) receives a `stage_anchor_accuracy` event with the actual percentage.~~ **Replaced 2026-10-12 (F-QUEST-002 §3.9, PR Q-11):** the attempt is saved as a `stage-certificate` review entry (`progress-store.recordReview`: `itemIds`, `resultStars`, `missedItemIds`), `summarize` writes `ProgressSummary.stage1Anchor { met, checkedAt, tricky }` from the newest one that carries `missedItemIds` for the caregiver dashboard (F-PAR-001; `missedItemIds` means "not right on the first try", the misses plus any item never asked, and an entry an older build stripped of the field gives no verdict), and `review.complete { kind, stageKey, symbolsCorrect, wordsCorrect, retries, stars }` goes to internal analytics. No `stage_anchor_accuracy` event exists (it was never in `TELEMETRY_EVENT_NAMES`). `stage1Anchor` is not `stage1.anchorAccuracy` (the average accuracy of completed Stage 1 quests); a dashboard must not conflate them.
- **Stage 1 configuration (F-QUEST-002 §3.9, amended 2026-10-12 by PR Q-11): the Hangul Check.** For Stage 1 the item count is **35, not 4 to 6**: 30 symbol items (one per symbol: hear the sound, pick the written letter among the target and its first three confusables; a final as the syllable ㅇ + ㅏ + final among syllables that differ only in the final) and 5 word items, one per theme pillar (hear the word, pick the picture), which satisfies "each pillar contributes ≥ 1". Seven items per chunk (6 symbols + 1 word), 5 chunks, a Hoya pause between chunks. Stars by §3.1 over the 35 items (1-star floor). Entry from the Stage 1 ceremony and the Journey Stage 1 header, never gating (Stage 2 is not unlocked by it). Built by `logic/stage1/hangul-check.ts` (`buildHangulCheck`), played by `screens/reviews/StageReviewScreen.tsx`; wireframe `design/wireframes/reviews/hangul-check.md`. Other stages keep N = 4 to 6.

### 3.5 Engine separation (testability)

- The review **engine** (selection, scoring, star math) lives in `apps/mobile/src/logic/reviews/` and is fully pure — no React, no platform, no audio.
- Selection helpers (`selectSpread`, `placeCorrect`), the seeded RNG, the attempt session (`startSession`, `answer`, `skip`, `expire`, `tally`) and the session clock live in `@hangul-route/content-schema` (`src/assessment/`, F-PLC-001 section 3.3). `apps/mobile/src/logic/reviews/` keeps Daily Pool, star math, stage balance and banned text and imports the shared module. Review items are `AssessmentQuestion`s built from jamo / vocab ids, `ReviewAttempt` responses use `AssessmentResponseSchema`, and `ReviewEntrySchema` (`schemas/progress.ts`) is unchanged.
- The Hangul Check builder (`buildHangulCheck`, F-QUEST-002 section 3.9) is unchanged and may later emit `AssessmentQuestion`s; that is a follow-up, not required here (F-PLC-001 B8).
- The review **player** (UI shell, animations, Hoya wiring) lives in `apps/mobile/src/screens/reviews/` and consumes the engine.
- Engine coverage target: 100 % branch.

### 3.6 Persistence

- Each `ReviewAttempt` is persisted to the active profile's local store (Phase 1 — through `apps/mobile/src/platform/storage.ts`, the only sanctioned AsyncStorage surface; `packages/hooks` does not exist in the tree).
- The last 30 attempts are retained per profile; older attempts roll into a monthly `ReviewSummary` aggregate (stars histogram, misses by item).
- Phase 2: same writes go to D1 (F-INFRA-004).

### 3.7 Motivation surfaces — anti-shame rules (revised 2026-10-09)

Source: `CLAUDE.md` §1 "Feedback & motivation" (owner decision 2026-10-09) and `09-...-addendum.md` §2.2. Positive nudges are allowed; shame is not. These rules bound every learner-facing review surface — they permit the surfaces below, they do not require them.

- **Session clock (allowed)** — a review may show **one** clock for the whole attempt, never one per item. When it runs out the attempt ends: unanswered items are recorded `skipped` (as in §3.3), never `wrong`, and the 1-star floor (§3.1) still holds. This is implemented once by `expire` in the shared session (`packages/content-schema/src/assessment/session.ts`): unanswered -> `skipped`, never `wrong`, the 1-star floor unchanged.
- **Fill-only meters (allowed)** — item dots, collection counts and progress meters only grow; a miss never empties or shrinks them. A combo counter that resets on a miss is a meter that drops, so it is not allowed.
- **Encouraging streak messages (allowed)** — e.g. Hoya after a Daily Test: *"3 days in a row!"*. A missed day gets no message about the break and no "streak lost" state.
- **Challenge mode (allowed, opt-in)** — off by default. When the learner or a caregiver turns it on, a review may show a real countdown timer. With it off, nothing else changes.
- **Still forbidden** — red-X or red failure styling (`colors.feedback.danger` is never used on a learner's miss), any public ranking of learners (§4), and taking away earned stars, cards or collection progress.

## 4. Out of scope

- **Voice / pronunciation review** (speak-the-jamo) → blocked on STT bench (INBOX T-013), tracked separately.
- **Adaptive difficulty** (raise stakes after a 3-star streak) — out of scope. Encouraging streak *messages* are allowed (§3.7), but raising the stakes on a streak turns encouragement into pressure. The placement check (F-PLC-001) is the one adaptive use: it lives in `src/placement/`, runs once at the learner's request, decides only which rung comes next, and is never a review. The shared session reducer (`assessment/session.ts`) stays non-adaptive and is used by both.
- **Public ranking of learners** (multi-learner leaderboards, class rankings) — explicit no, ever (§3.7).
- **Stage 2+ Review content** — content work, this spec only covers the engine + Stage 1 question set.

## 5. UI sketch

Authored 2026-09-19 (IDs per `docs/blueprints/10-app-map.md` §3.1):

- `design/wireframes/reviews/daily-test.md`
- `design/wireframes/reviews/feedback-review.md` — the Quest tail (§3.3)
- `design/wireframes/reviews/stage-review.md` — invitation + review; certificate and collection wall are the certificate variant of `design/wireframes/results/celebrate.md`

## 6. Tests

### Unit — `apps/mobile/src/logic/reviews/`

| File | Coverage focus |
|---|---|
| `logic/reviews/star-calc.ts` | §3.1 — thresholds + 0/N → 1 star floor |
| `logic/reviews/daily-pool.ts` | §3.2 — Pool A/B/C/D weighting, Pool C forced, anti-staleness (superseded by F-CURR-002 sections 4.3 and 4.5 once row CM-14 ships; the 60-day simulation of row CM-13 replaces these tests) |
| `logic/reviews/stage-balance.ts` | §3.4 — each pillar contributes ≥ 1 |
| `logic/reviews/banned-text.ts` | §3.1 — no %, no x/y fractions reach learner UI |
| `logic/reviews/engine.ts` | end-to-end attempt lifecycle (started → item answer × N → completed), testing the composition with the shared `assessment/session`; §3.7 — if a session clock expires, remaining items become `skipped`, never `wrong`, and earned stars / cards never decrease |

The shared reducer's own tests (`startSession`, `answer`, `skip`, `expire`, `tally`, the clock, selection and RNG) live in `packages/content-schema/src/__tests__/assessment-*.test.ts` (F-PLC-001) and are not repeated here.

### Integration

- 14-day simulated learner: every day runs the daily test; verify Pool C correctly retries-then-graduates a missed item; long-term Pool D triggers on day 8. (Superseded by the F-CURR-002 60-day simulation of row CM-13 once row CM-14 ships.)
- Quest completion → Feedback Review fires within Celebrate surface (timing).
- Stage 1 simulated completion → Stage Review with 5-pillar balance + Certificate + collection wall.

### E2E (Detox, nightly)

- Cold launch → learner profile → daily test from home card ③ → 5 items → result screen → no % shown.

## 7. Rollout

- **MVP**: full engine, Stage 1 content only.
- Feature flag: `reviews.stageReview` (default `true`). `reviews.dailyPoolD` (default `false` until 14 days of telemetry exists — Pool D needs history; superseded by F-CURR-002 sections 4.3 and 4.5 once row CM-14 ships, after which the flag has no pool to switch).
- Beta: families with 7+ days of use validate spaced retrieval feels natural.

## 8. Dependencies

### Upstream

- **F-001** (Hangul Tile Game) — Quest source for Feedback Review tail.
- **F-002** (Hoya Feedback Bubble) — used for all learner-facing result copy.
- **F-HW-001** (Homework) — daily test is invoked from home card ③.
- **F-PROF-001** (profiles) — every attempt is scoped to `currentProfileId`.
- **packages/content-schema** — needs `ReviewAttempt` / `ReviewItem` types + Stage-1 item pool seed.
- **F-PLC-001 PR P-1** (shared question engine, `packages/content-schema/src/assessment/`, merged as #161) — the session, clock, selection and RNG this engine imports. `ReviewEntrySchema` (`schemas/progress.ts`) is unchanged.

### Downstream

- **F-PAR-001** consumes per-profile review history for the caregiver dashboard.
- **F-TCH-001** ~~consumes class-aggregated `stage_anchor_accuracy`~~ (amended 2026-10-12, F-QUEST-002 PR Q-11): no class aggregate of the anchor verdict; `stage1Anchor` is a family-channel key (`TEACHER_HIDDEN_SUMMARY_KEYS`, `packages/content-schema/src/schemas/transfer-consent.ts`), so a teacher never receives it.
- **F-INFRA-004** (D1 sync) — Phase 2 dual-write target.

### Content

- **Stage 1 review item seed**: 30 jamo prompts + 12 first-syllable prompts authored in `content/reviews/stage-1.json`. Reuses F-001 audio assets.
