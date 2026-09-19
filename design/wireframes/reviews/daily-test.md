# Reviews/Daily-Test — spaced-retrieval daily test (wireframe v1)

Spec: `docs/specs/F-RVW-001-review-tests.md` §3.1 (stars-only surface) · §3.2 (daily pool)
Audience: **learner (P4/P5 child, 5–11)** — a pre-reader must be able to finish without an adult

## Scenario (Given-When-Then)

Given: a learner has at least one day of quest history and taps home card ③ ("Daily test")
When: the test opens
Then: 4–5 short items drawn from yesterday / two days ago / last misses / a week ago play back-to-back in 60–90 s, and the learner leaves with stars, never a score

## Screen goal

"Answer a handful of remembered items quickly and collect stars."

## Box diagram

```
+----------------------------------+
| [<- back]      o o o o o         |  <- item dots (position only,
|                                  |     never right/wrong)
|        [hoya - idle/small]       |
|                                  |
|   prompt area                    |
|   (audio replay button + jamo    |
|    or picture prompt)            |
|                                  |
|   +------------+ +------------+  |
|   |  choice A  | |  choice B  |  |  <- 2-4 large targets, reuses
|   +------------+ +------------+  |     minigame/shell frame
|   +------------+ +------------+  |
|   |  choice C  | |  choice D  |  |
|   +------------+ +------------+  |
|                                  |
|   [ (o) hear it again ]          |  <- secondary, always present
+----------------------------------+
```

- Feedback per item: one short Hoya bubble (right, or "let's keep going") then auto-advance. No running count of misses anywhere.
- The item dots show *how many are left*, not which were correct — a wrong item looks identical to a right one in the row (§3.1 no comparative signal).
- Prompt kinds reuse the existing minigame families (pick-the-sound, match) so the learner needs no new interaction vocabulary; the daily test is a **sequence of `minigame/shell` rounds** with a different item picker.

## Interaction points

- Choice tap → answer registers, short feedback, auto-advance to the next item (no "next" button for the child)
- [ hear it again ] → replays prompt audio; unlimited, never counted against the learner
- [<- back] → confirm sheet ("stop for now?") → `home/todays-mission`; a stopped test records no attempt and card ③ stays available today
- Last item answered → `results/celebrate` (review variant: stars only; no heritage card unless the content pack attaches one)

## Navigation graph

Enter from: `home/todays-mission` (card ③, daily-test kind) · `homework/list` (teacher/parent-assigned Daily Test target, F-TCH-001 §3.3)
Exit to:    `results/celebrate` · `home/todays-mission` (back / stop)

## States

- **success**: 4–5 items, stars awarded at the end (K/N ≥ 0.8 → 3, ≥ 0.5 → 2, else 1; 0/N still earns 1 star with Hoya in `thinking` pose).
- **empty** (no history yet, pools A–D all empty): the card ③ builder does not emit the daily-test card, so this screen is normally unreachable; if reached by deep link, show Hoya + one line ("play a quest first") + [[ GO TO TODAY ]] → `home/todays-mission`.
- **error** (item pool or audio asset fails to load): skip the broken item silently; if fewer than 3 items load, end the test early and still award stars for what was answered. If audio is missing, fall back to the picture prompt — never a spinner longer than a beat.
- **already done today**: card ③ shows the collected look; tapping replays the same items for fun and does not write a second attempt.

## Data needs

- reads: active profile (F-PROF-001) · last 30 `ReviewAttempt`s for this profile · quest history anchors (yesterday, D-2/D-3, D-7) · Stage 1 review item seed (`content/reviews/stage-1.json`) · feature flag `reviews.dailyPoolD`
- computed by `logic/reviews/daily-pool` (pool A/B/C/D selection, anti-staleness exclusion) and `logic/reviews/star-calc` — the screen renders, it does not select
- writes: one `ReviewAttempt` (kind `daily`) to the profile's local store; caregiver-channel accuracy goes to the summary only (never rendered here)
- telemetry: `review.daily.started`, `review.daily.completed` (stars, itemCount, pool mix), `review.daily.abandoned`

## Open questions

- Should the item dots be shown at all for the youngest band (5–7), or does "how many left" itself read as pressure? (beta: A/B the dot row off)
- Pool C forced item: place it first (warm-up) or in the middle (buried)? Spec fixes inclusion, not position.
- Spec §3.1 Hoya copy is written in Korean; UI copy must be English per CLAUDE.md §1 — to be re-authored in the design pass.
- Deep-link entry from `homework/list` when a teacher assigns a Daily Test: same items as home card ③ that day, or a fresh draw? (F-TCH-001 §3.3 does not say)
