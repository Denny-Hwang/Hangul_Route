# Reviews/Quest warm-up and Try these again (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.5 (sessions table: Warm-up, Try these again), §4.3 (due items answered anywhere count), §7.7 (anti-shame checklist), §11.3 (`review.start` / `review.complete`, kinds `warmup` and `feedback`), §12.2 (`questWarmup` and `missedPractice` off: the surface hides), §13 (the minimum-app-version gate of `warmup`) · `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` L13 as amended by CM-0b · star rules `docs/specs/F-RVW-001-review-tests.md` §3.1
Round look: **`reviews/daily-review.md` panels B and B2** (the round frame, the amber miss, the fill-only dots), reused as they are; the quest reward step is `quest/player.md`.
Audience: **learner, any age** (P4 / P5 / P6). One primary action per panel.
Built by row **CM-15** (behind `questWarmup` and `missedPractice`, both at built-in pct 0 until the ramp)

## Scenario (Given-When-Then)

Given: a learner with words due from earlier cells opens a Stage 2+ quest
When: the quest player opens
Then: up to 3 quick rounds bring those words back (30 s or less), a soft "Warmed up", and the quest's six steps start as always, with their own counter, timing and stars

Given: a learner missed some rounds on the first try in the quest just played
When: the quest reaches its reward step
Then: "Try these again" is the suggested next tap, See results stays right under it, and the short session ends on stars only

## Box diagram

```
W. Warm-up round (before step 1; the quest's step counter is not shown, it has not started)
+--------------------------------+
| [x Close]                 [Aa] |  <- the route header: Close asks the quest's Leave sheet
| o o .              [Warm-up]   |  <- fill-only dots (how far, never right or wrong); the pill
| A quick look back before we    |  <- round 1 only
| start.                         |
| (sound notice, no voice only)  |  <- F-AUDIO-004: recognize read instead
| What does this mean?      (h)  |  <- the shipped instruction line of the round kind
|          [ 고추 ]              |  <- KoreanText; romanization per the learner's setting
|           gochu                |     (never under a "pick its sound" prompt)
| [ chili pepper               ] |  <- ChoiceCard options, 3, stacked; >= touchTarget.child
| [ cheese                     ] |
| [ father                     ] |
| ( Skip warm-up )               |  <- ghost; answers so far still count
+--------------------------------+

W2. A miss: daily-review.md B2 (amber nudge, the right option ringed "Look here", Hoya thinking with the
    shipped line), the round stays open until the right one is tapped, then the next round. Never red.

W3. Warmed up
|        [hoya - cheering]       |
|           Warmed up            |  <- no stars, no count: nothing is scored
| [[          CONTINUE          ]]|  -> quest step 1

R. Reward step (quest/player.md), when the play had first-try misses and missedPractice is on
|  ... the reward card ...       |
|  A quick second look at the    |
|  tricky ones.                  |
| [[      TRY THESE AGAIN      ]]|  <- the one primary
| [        See results         ] |  <- secondary; Play again stays on the episode page
   (no misses, switch off, or no miss that can be asked: the step's own [[ SEE RESULTS ]], as today)

T. Try these again rounds: as W, with the pill "Try these again" and ( See results ) as the ghost way on.

T2. Result
|        [hoya - cheering]       |
|        Wonderful! / Great work! / You did it!   <- the word of the star tier
|            * * *               |  <- 1 to 3 stars (F-RVW-001 §3.1), never 0
| [[         SEE RESULTS         ]]|  -> Results (the quest's own stars, unchanged)
```

## Rules

- Both sit **outside the six steps**: the warm-up before step 1, Try these again after the reward step. The quest's
  steps, `durationSeconds` (F-CURR-001 U-5), score and stars never change.
- Rounds are quick picks at recognize or read: hear it and pick it (Korean options, or an exchange's replies), or
  see it and pick its sound (a symbol or a block), its picture or its meaning (a word or a sentence), or a reply. A
  realia card or an item without two other options is left out. With no device voice every round is read and the
  sound notice shows.
- Never on these panels: a percentage, an "n of m", a running count of misses, a per-question timer or red.
- The warm-up is skipped (no panel at all) when nothing from an earlier cell is due, before Stage 2, on a quest that
  resumes past its first step, or when its plan is not ready within 1.5 s. The reward step holds its buttons at most
  0.8 s while Try these again is planned.
- Try these again opens on Results, over its content, once Results has saved the quest's score and card: its
  button finishes the quest as See results does. A back during it, or its See results, shows Results (the quest is
  done and saved); a back during the warm-up asks the quest's Leave sheet, as on any step.

## States

- **switch off** (`questWarmup` / `missedPractice`, or `memoryRecord`, build or remote): the surface hides; the quest
  plays exactly as before and the sessions' chunk never loads.
- **loading**: W shows the quest's waiting frame (`LessonWaiting`) for at most 1.5 s; R keeps the reward card and an
  empty button area for at most 0.8 s.
- **store unreadable**: no plan, so no panel.
- **320 x 568 and 200 % text**: the round scrolls; options keep their touch size; no sideways scroll.
- **wide**: the reading column, centred.

## Accessibility

- Dots: the shared Progress (position only). Options read their outcome after a tap ("Not this one: rice", "Look
  here: water", "Right answer: water"); a picture option reads its meaning. The speaker reads "Play the sound again".
- Stars read in words (the shipped StarRow).

## Anti-shame checklist (§7.7)

| Rule | Here |
|---|---|
| no red for a miss | amber nudge (`feedback.nudge`); `feedback.danger` never used |
| no visible decay | none |
| no lost streak copy | none |
| no percentage | none; Try these again shows stars only, the warm-up nothing |
| no per-question timer | none |
| no random rewards | stars follow F-RVW-001 §3.1 |
| no purchasable rewards | none |
| no comparison between learners | none |
| no bad ending | 1 star at least, with its tier word |
| no age wording | none |
| no speaking UI | none |
| no emoji | none |

## Data needs

- reads: the memory store (due pool, the misses' states), the review-item chunk, the learner's flags, the device voice
- writes: each first try to the memory store (`recordAnswers`, credit inside sentences, spacing rule); on a finished
  session one `reviews[]` entry a local day: `warmup:<day>` (no stars) or `feedback:<day>` (stars, misses), kept 14
  local days; `review.start { kind, items }`, `review.complete { kind, items, retries, stars? }`

## Copy (English; es and ko in the same row, CM-15)

| Key | English |
|---|---|
| `learner.warmUp.pill` | Warm-up |
| `learner.warmUp.intro` | A quick look back before we start. |
| `learner.warmUp.skip.cta` | Skip warm-up |
| `learner.warmUp.done` | Warmed up |
| `learner.tryAgain.cta` | Try these again |
| `learner.tryAgain.intro` | A quick second look at the tricky ones. |

Every other line is a shipped string: the round instructions (`learner.placement.instruction.*`,
`learner.minigame.cultureQuiz.heading`, `learner.presenter.quiz.reply`), the Hoya miss lines, Hear it again,
Continue, See results, the star-tier words (`learner.stageReview.result.headline`) and the sound notice. The two new
namespaces are read by the `review-copy` rule.
