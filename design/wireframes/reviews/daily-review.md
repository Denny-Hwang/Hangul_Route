# Reviews/Daily Review — the 2-3 minute spaced review on the memory model (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.3 (due pool, selection order, review-first suggestion, rungs by kind), §4.5 (sessions table, interleaving, listening rule, "Never on a review screen"), §7.4 (points), §7.7 (anti-shame checklist), §12.2 (`dailyReview` off), §11.3 (`review.start` / `review.complete`), §14 (e2e and accessibility) · star rules `docs/specs/F-RVW-001-review-tests.md` §3.1 · sound notice F-AUDIO-004
**Supersedes the layout of `reviews/daily-test.md`** (F-RVW-001 §3.2 pools A to D): the Daily Test is rebuilt on the F-CURR-002 memory model. The item dots, the shell reuse and the "stars, never a score" rule carry over; the 4-5 item pool, the 60-90 s length and the pool-A-to-D picker are replaced.
Audience: **learner, any age** (P4 / P5 / P6). A first-time reader must be able to finish it with pictures, sounds and one button per step. No grown-up control on this screen.
Mock: `design/screens/daily-review/` (shots at 320 and 768) · Keep going: `reviews/keep-going.md` · Built by row **CM-14** (behind `dailyReview`)

## Scenario (Given-When-Then)

Given: a learner with 3 or more items due today (the memory store, §4.3) opens Home
When: they tap the Daily Review card in Today with Hoya
Then: 10 short rounds (about 2-3 minutes) bring back words, letters and sentences from earlier lessons, mixed across themes; each round is a game they already know; they leave with stars and "N got stronger", never a score, a percentage or a timer

## Screen goal

"Bring back what I learned, a few minutes a day, and feel it getting stronger." One primary action per step.

## Box diagram

```
A. Home: Today with Hoya, card 3 (F-HW-001 slots, `home/todays-mission.md`)
+--------------------------------+
| Today with Hoya           (h2) |
| [ card 1 ...                 ] |
| [ card 2 ...                 ] |
| +----------------------------+ |
| | (3) [replay] Daily Review  | |  <- card min height touchTarget.hero (96); the shipped
|                                |     `replay` glyph
| |      About 3 minutes       | |     subtitle: plain time, never a count owed
| +----------------------------+ |
+--------------------------------+

A2. Review first (the due pool is more than 3 x the Daily Review size, §4.3: over 30 at size 10,
    over 18 in E2's 6 arm)
| Today with Hoya           (h2) |
| 34 items are ready to refresh  |  <- one positive line above the cards
| [ (1) [replay] Daily Review ]  |  <- the day's plan puts it in slot 1; the slots
| [ (2) normal day's card 1    ] |     then keep their order all day (F-HW-001 §3.2)
| [ (3) normal day's card 2    ] |  <- new lessons stay right here: never blocked

B. A round (route DailyReview; one of the shipped round renderers, chosen by rung and kind, §4.3)
+--------------------------------+
| [x]      o o o o . . . . . .   |  <- [x] top left (Stop); fill-only dots: how far,
|                                |     never right or wrong; no "n / N", no clock
|   [glyph] Food                 |  <- the item's theme glyph and word (decorative
|                                |     context: items mix themes, §4.5)
|   Listen and pick              |  <- the round's own instruction (shipped string)
|   ( (o) ) Hear it again        |
|                                |
|   +-----------+ +-----------+  |  <- options, each >= touchTarget.min (64);
|   |   사과    | |    배     |  |     Korean with romanization under it
|   |   sagwa   | |    bae    |  |
|   +-----------+ +-----------+  |
|   +-----------+ +-----------+  |
|   |    밥     | |    떡     |  |
|   +-----------+ +-----------+  |
+--------------------------------+

B2. A miss (first try wrong)
|   +-----------+ +-----------+  |
|   | 배  (amber)| | 사과  (v) |  |  <- the tapped option: feedback.nudgeLight fill,
|   +-----------+ +-----------+  |     feedback.nudge thick border and a dot; the
|  [hoya thinking] It is 사과,   |     right option is outlined in success with the
|   sagwa, apple. Tap it!        |     check mark, and the round stays open until it
|                                |     is tapped, then on to the next round. Never
|                                |     red, never a cross

C. Result
+--------------------------------+
|        [hoya - cheering]       |
|          Wonderful!            |  <- one word per star tier, never a number
|            * * *               |  <- 1 to 3 stars (F-RVW-001 §3.1), never 0
|   [check] 6 got stronger       |  <- count of items whose best box rose today (the
|                                |     shipped `check` glyph)
|                                |     (0: "Every answer helps them stick.")
|   (ring) Daily goal done       |  <- goal line from home/goal-ring-weekly-dots.md
|                                |     (only with `goals` on)
|   [[        BACK HOME        ]]|  <- the ONE primary
|   Want a few more?             |  <- only while due items remain and fewer than
|   [ Keep going ]               |     3 Keep goings today (reviews/keep-going.md);
|                                |     never says how many are left
+--------------------------------+

D. All refreshed today (nothing to ask; also the end-early case, §4.5)
|        [hoya - cheering]       |
|      All refreshed today       |
|  Nothing is waiting right now. |
|  Play a quest or read a story. |
|   [[        BACK HOME        ]]|

E. Stop for now? (over B; [x] or a system back)
|   Stop for now?                |
|   What you answered still      |
|   counts.                      |
|   [[ BACK TO IT ]]   [ Stop ]  |  <- Stop -> Home; card 3 stays open today
```

- **Never on any panel** (§4.5, lint `review-copy`): a percentage, an "n of m" or "n/m", a running count of misses, a per-question timer, a session clock, hearts or a fail state.
- The dots row holds 10 dots at 320 (and 6 in experiment E2's short arm): `spacing.sm` dots with `spacing.xs` gaps, 116 dp wide. A dot fills when its round is answered, the same fill for right and wrong.
- "N got stronger" is a count of the learner's own items, never a ratio and never compared with anyone. "34 items are ready to refresh" is a positive nudge (§7.4 copy rule), never "overdue", "behind" or "missed".
- Rounds use only shipped renderers and the F-CURR-002 formats as they ship (Listen & Pick, Read Pick Meaning, Pic-Word Match, Type Hangul `see` / `picture`, Dictation, Syllable Build, Cloze Pick, Sentence Builder, Realia Read). Every format is reading, listening or writing; nothing records or measures speech.

## Interaction points

- A: card tap -> B round 1; `review.start { kind: 'daily' }`. A collected card (done today) -> `reviews/keep-going.md` panel E (the "done today" page).
- B: option tap -> the first answer of the round scores (memory store, spacing rule §4.3); a wrong first try -> B2 (amber, Hoya shows the right answer with romanization and gloss); the right tap -> check mark, then the next round after `motion.duration.slow` (no Next button).
- B: typed rounds (Type Hangul, Dictation) keep their own Done button; a one-jamo slip shows the amber "almost" panel of `minigame/type-hangul.md` and counts as hinted (§4.3).
- B: [ Hear it again ] -> replays the prompt; unlimited, never counted.
- B: [x] or a system back (Android back, iOS swipe-back) -> E.
- Last round -> C; `review.complete { kind: 'daily', stars }`; the Daily Review's 3 points go to today's `dayLog` (§7.4).
- C: [[ BACK HOME ]] -> Home (card 3 collected); [ Keep going ] -> `reviews/keep-going.md` B.
- D: [[ BACK HOME ]] -> Home.
- E: [[ BACK TO IT ]] -> the same round; [ Stop ] -> Home. Answers already given stay recorded (they count anywhere, §4.5); no `reviews[]` entry, no points.

## Navigation graph

Enter from: `home/todays-mission` (slot 3, or slot 1 on a review-first day) · `homework/list` (an assigned Daily Review: the same items as card 3 that day)
Exit to: `home/todays-mission` · `reviews/keep-going` · (system back) the stop sheet

## States

- **success**: A -> B x 10 -> C.
- **review first**: A2 (one line, slot 1). Nothing is locked; the normal day's cards 1 and 2 move down to slots 2 and 3 in their order (the normal day's slot 3 fallback is not shown that day).
- **loading**: the round frame ([x] and the empty dots row) shows until the engine returns the session and the review-item chunk is read; one frame, no spinner, nothing written.
- **store unreadable** (the memory store or IndexedDB read fails through the safe storage wrapper): D's "Nothing is waiting right now" page with [[ Back home ]]; nothing is written, no `review.start` is sent, and card 3 stays as it was.
- **ends early**: the pool runs out before 10 rounds (stretch items fill only what the pool cannot, §4.5) -> C with the stars of what was answered; with no round answered at all -> D.
- **nothing due** (fewer than 3 due, `dailyReview` on): the slot 3 builder does not emit the card (today's fallback chain); a deep link shows D.
- **already done today**: card 3 has the collected look and stays tappable (keep-going panel E).
- **no sound** (F-AUDIO-004): the visible sound notice shows on B; recognize rounds become read rounds (§4.5), never skipped.
- **offline**: the engine and the review-item chunk are local and precached (§10); the review plays fully offline. An item whose lesson chunk is not cached is skipped silently, as an unplayable item.
- **an item cannot play** (missing art or audio for its rung): skipped silently; if fewer than 3 rounds can play -> D.
- **`dailyReview` off** (build or remote, §12.2): the card is not emitted, slot 3 falls back to today's chain, a deep link shows D's "Nothing is waiting right now" page with [[ Back home ]]. Memory states stay.
- **`memoryRecord` off, `dailyReview` on** (remote config can only switch things off, so this is the likely emergency lever): the effective flag is `dailyReview && memoryRecord`. With answers not recorded, "N got stronger" would always be 0 and Keep going would serve the same items again, so the screen behaves exactly as `dailyReview` off: no card, no Keep going, a deep link shows D. Memory states, `reviews[]` entries and points already earned stay. CM-14 has a test that turns `memoryRecord` off remotely while `dailyReview` stays on.
- **access changed** (a plan lapses, a Family Plan ends, the learner leaves a class): the Daily Review draws only items the learner has already met, and learned content stays reviewable, as "Play again on quests already finished" in `episode/detail-access-preview.md`. Nothing is removed from the pool, and no Premium pill, price, plan word or ask-a-grown-up door is added to any panel. CM-14's e2e covers a lapsed-plan profile.
- **reduced motion**: no slide between rounds and no star pop; the next round replaces the last at once; the check mark appears without a scale.
- **320 x 568 and 200 % text**: B scrolls inside the round area; the [x] and dots row stays at the top; options keep `touchTarget.min`; no sideways scroll. **Display headlines** ("Wonderful!", "All refreshed today", and on the other review screens "Mastered!", "You tested out!", "Stage 2 complete!") use `useCappedFont('display', DISPLAY_HEADLINE_MAX_SCALE)` with the named constant `DISPLAY_HEADLINE_MAX_SCALE = 1.5` (the existing `cappedFont` budget for OS size x the chosen step), so one word never breaks mid-word in the 288 dp column; Korean keeps `KOREAN_LINE_BREAK`; web adds `hyphens: auto` as the mock does. The CM-14, CM-20, CM-21 and CM-22 visual tests cover 320 at 200 % on native as well as web. This rule is shared by `reviews/keep-going.md`, `reviews/cell-check.md` and `reviews/stage-check.md`.
- **768 and wide**: the round sits in the reading column (`layout.maxWidth.reading`), centred; options in a 2 x 2 grid up to 4 across on wide; the dots row stays above the round.

## Accessibility

- [x]: "Stop the review" (button). Dots: one group with the label "Round 4" (position only, never right or wrong). Theme glyph: hidden; the theme word is read once ("Food").
- Options: the Korean, its romanization and, for pictures, the picture's word ("사과, sagwa, apple"); a miss announces Hoya's line politely, never "wrong".
- Result: stars read as "3 stars" (words), "6 got stronger", then the buttons. Focus starts on the headline. The "Want a few more?" line is the Keep going button's description (`aria-describedby`).
- Every target is at least 48 dp, and buttons and options are `touchTarget.min` (64) or more.
- Colour is never the only cue: a miss is amber plus a thicker border and a dot; a right answer is the check mark.

## Anti-shame checklist (§7.7)

| Rule | Here |
|---|---|
| no red for a miss | amber nudge (`feedback.nudge`, `nudgeLight`); `feedback.danger` never used |
| no visible decay | nothing fades or drops; the result counts what got stronger |
| no lost streak copy | none on this screen |
| no percentage | none; stars and a count of stronger items only |
| no per-question timer | none; no session clock |
| no random rewards | stars follow F-RVW-001 §3.1 deterministically |
| no purchasable rewards | none |
| no comparison between learners | none |
| no bad ending | 0 right still earns 1 star with Hoya thinking and "Good try!" |
| no age wording | none |
| no speaking UI | none; no microphone, no "say it" |
| no emoji | none; glyphs come from `Icon/glyphs.ts` |

## Data needs

- reads: active profile; the memory store (`logic/review/engine.ts` selection for `kind: 'daily'`, size 10 or the E2 arm), the review-item chunk, `dayLog` (goal line), the `dailyReview` flag, the device-voice check
- writes: one answer per round to the memory store (CM-12, spacing rule); on finish one `reviews[]` entry `{ kind: 'daily', scope: localDay, resultStars, itemIds }` (`scope` is the required field, holding the local day the review was played, `YYYY-MM-DD`; `reviews/keep-going.md` counts today's Keep goings from it), 3 points in `dayLog[today][installKey]`
- **retention** (§4.8, built by CM-3b with CM-14): `daily` entries (the Daily Review and every Keep going) are kept for 14 local days. After every merge, on the client and in the Worker, the list keeps only the `daily` entries whose `scope` is within 14 days of the newest `daily` entry's `scope`, so the prune gives the same result on every side and the union never brings a pruned entry back. `cell-check`, `stage-certificate` and every other kind are never pruned (they carry best results). A snapshot-size test asserts that a year of daily use (a Daily Review and 3 Keep goings every day) keeps `reviews[]` under 64 entries of `daily` kind
- telemetry: `review.start` / `review.complete` with `kind: 'daily'` (existing names, §11.3); no item text, no id beyond the content ids already allowed

## Proposed copy (English; keys for CM-14, which adds es and ko)

| Key | English |
|---|---|
| `learner.home.mission.dailyReview.title` | Daily Review |
| `learner.home.mission.subtitle.dailyReview` | About 3 minutes |
| `learner.dailyReview.readyLine(count)` | 1 item is ready to refresh / {count} items are ready to refresh |
| `learner.dailyReview.result.headline.three` / `.two` / `.one` | Wonderful! / Great work! / Good try! |
| `learner.dailyReview.result.stronger(count)` | 1 got stronger / {count} got stronger |
| `learner.dailyReview.result.noneStronger` | Every answer helps them stick. |
| `learner.dailyReview.result.backHome.cta` | Back home |
| `learner.dailyReview.allRefreshed.title` | All refreshed today |
| `learner.dailyReview.allRefreshed.body` | Nothing is waiting right now. Play a quest or read a story. |
| `learner.dailyReview.leave.title` | Stop for now? |
| `learner.dailyReview.leave.body` | What you answered still counts. |
| `learner.dailyReview.leave.stay.cta` | Back to it |
| `learner.dailyReview.leave.stop.cta` | Stop |
| `a11y.dailyReview.close` | Stop the review |
| `a11y.dailyReview.round(n)` | Round {n} |

**Slot 3 copy.** The card is a mission card like every other slot (F-HW-001 `logic/homework/mission-builder`, a new card kind `dailyReview`), so its title and subtitle sit beside the existing `learner.home.mission.*` strings. The superseded Daily Test card strings (`learner.home.mission.dailyTest.title` "Quick review", `learner.home.mission.subtitle.dailyTest` "About a minute with Hoya") are left in place until CM-14 removes the `dailyTest` kind, and CM-14 deletes them in the same PR, with their es and ko values. The page title uses `learner.dailyReview.title` ("Daily Review").

| Key | English |
|---|---|
| `learner.dailyReview.title` | Daily Review |

The Hoya miss line reuses the shipped round's feedback strings. Every string passes `review-copy` (§9.3).

## Open questions

- None blocking CM-14. Experiment E1 (slot 3 against the top of Home) only moves the entry card; panels B to E are the same in both arms.
