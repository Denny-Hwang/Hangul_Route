# Home/Goal ring and weekly dots — Light / Steady / Strong, the week's dots and steady weeks, the streak below (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.4 (daily goal in plain time words, points from finished activities, weekly goal of 3, 5 or 7 days, "Home shows 7 dots for the local week, and the count of steady weeks is the headline number", the local-day streak, up to 2 automatic rest days a local week, "Start a new run", `streakBest`, never "lost", the copy rule), OD-6 (confirmed 2026-10-21: weekly dots and steady weeks as the Home headline, the local-day streak below them, 2 automatic rest days a local week), OD-14 (any learning activity keeps the streak), §4.8 (`goals`, `dayLog`, `streakLocal`, `streakBest`; the displayed number never drops because of a sync), §11.3 (`goal.set`, `goal.met`, `week.goal_met`), §11.4 (experiment E4: Light against no default), §7.7 (anti-shame checklist), §12.2 (`goals` off)
Amends: the Home pills row of `home/next-lesson-hero.md` (the "Streak N days" pill moves into the week strip as its streak line; a "N words known" pill takes its place, `journey/mastery-ring.md` G) and adds one strip above the Next lesson hero. The hero, its single Start and the three cards of the day are unchanged.
Audience: **learner, any age** (P4 / P5 / P6). Goals are the learner's own; a family or class goal is a separate surface (F-CURR-002 §7.6, rows CM-61 and CM-62).
Mock: `design/screens/goal-ring-weekly-dots/` (shots at 320 and 768) · Built by row **CM-17** (behind `goals`); streak on the local day by CM-4

## Scenario (Given-When-Then)

Given: a learner who learns on some days and not on others, in their own time zone
When: they open Home
Then: the first thing above the next lesson is this week as 7 dots (a dot fills on each day they learned; up to 2 quiet days are rest days), the number of steady weeks they have had, their streak in plain words below, and a small ring that fills toward today's goal; nothing says lost, missed, behind or late

## Screen goal

"See my week and today's goal at a glance, then start." (the hero's Start stays the one primary action on Home)

## Box diagram

```
A. Home at 320 x 568 (the strip above the hero; the rest of Home as home/next-lesson-hero.md)
+--------------------------------+
| (Hoya) Hi, Mina!  (Aa)(Profile)|
| Ready for today's quest?       |
| +----------------------------+ |  <- the week strip: ONE button (-> C), min height
| | (ring) 4 steady weeks      | |     touchTarget.hero; ring 48 dp at the left
| |  48dp  M  T  W  T  F  S  S | |  <- day letters: the locale's narrow weekday names,
| |        (v)(v)(r)(v)(o)( )( )| |     the week starting on the locale's first day
| |        Streak 5 days       | |  <- the streak line, caption size, under the dots
| +----------------------------+ |
| (120 words known) (3 cards)    |  <- pills: words known replaces the streak pill
| (1 three-star quest)           |
| +----------------------------+ |
| | NEXT LESSON ...  [[START]] | |  <- unchanged hero: the one primary on Home
| +----------------------------+ |
| Today with Hoya ...            |
+--------------------------------+

 Dots (each spacing.xl, 24 dp; not targets; spacing.xs gaps; 7 dots = 192 dp, fits the 240 dp beside the ring):
  (v) learned day   brand.primary fill, `check` glyph in text.onPrimary
  (r) rest day      surface.sunken fill, border.shape thin outline, `rest` glyph (new, a crescent) in
                    text.secondary. Granted automatically: a past day of this local week with no learning
                    becomes a rest day, at most 2 a week; it keeps the streak (§7.4)
  (o) today         border.shape base outline, the day letter in semibold under it; fills as (v) once
                    anything is finished today
  ( ) a day still to come, or a past day after the 2 rest days: surface.paper with a border.strong thin
                    outline. A past quiet day beyond the rest days looks exactly like a day to come:
                    never a cross, a gap mark, a red or amber dot, or any word

 Ring (48 dp, borderWidth.thick track in border.subtle, filling clockwise in brand.primary by today's points
 over the daily goal; no number, no percentage):
  empty: the track alone
  partly: the arc; the strip's description says "A little more for your daily goal"
  met:   the closed ring and a `check` glyph in brand.primary; "Daily goal done"

A2. The streak line's three forms (never a drop, never "lost")
  Streak 5 days                        <- a run in progress (rest days included)
  Start a new run! Best run: 12 days   <- after a run ended: the first day back, and every day until
                                          the new run reaches 2 days
  Streak 1 day                         <- the first day of a run

B. Wide and 768 (the strip spans the main column above the hero; one row)
 +--------------------------------------------------------------------------+
 | (ring) Daily goal done       |  4 steady weeks   M T W T F S S   Streak 5 days |
 |        Light, about 5 minutes|                   v v r v o . .                 |
 +--------------------------------------------------------------------------+

C. Goals sheet (the strip tapped; a bottom sheet on a phone, a centred dialog at 768 and wide)
+--------------------------------+
| Your goals                [x]  |
| Every day                      |
| ( ) Light    about 5 minutes   |  <- three radio cards, each touchTarget.min, plain
| (o) Steady   about 10 minutes  |     time words only (no points shown)
| ( ) Strong   about 15 minutes  |
| Every week                     |
| ( ) 3 days  (o) 5 days ( ) 7 days |  <- segmented choice, each touchTarget.min
| A steady week is a week you    |
| reach your days goal. They add |
| up and never go away.          |
| Rest days: Hoya keeps your     |
| streak going on up to 2 quiet  |
| days a week.                   |
| [[ DONE ]]                     |
+--------------------------------+

D. The first choice (once, on Home, after the first finished activity; E4's "no default" arm only shows D)
 +----------------------------+
 | How much time a day suits  |
 | you?                       |
 | [ Light, about 5 minutes ] |  <- three buttons, each touchTarget.min
 | [ Steady, about 10 minutes]|
 | [ Strong, about 15 minutes]|
 | [ Not now ]                |  <- Light (E4 "Light default" arm) or no goal (the
 +----------------------------+     "no default" arm) until a choice is made in C

E. Goal moments, a banner on the Results of the activity that reached them (one line each, Hoya cheering)
 | (ring closes) Daily goal done!                         |   <- goal.met
 | (dot fills)  Week goal reached! That is 5 steady weeks. |   <- week.goal_met
```

- **Headline** (OD-6): "N steady weeks" is the biggest text in the strip (`typography.size.bodyLg`, bold). It counts every local week whose weekly goal was reached, ever, so it only grows. With 0 it reads "Your first steady week starts here" instead of a number.
- **Streak below**: `streakLocal.run` on the local day, rest days included; `streakBest` only appears in "Start a new run! Best run: N days". The displayed run never drops because of a sync (§4.8 step 8).
- **No numbers of points** anywhere: the ring is a shape, the goal is time words. No "n of m": the dots are the week, never "2 of 3 days".
- **Two goals on Home, told apart by their words.** The hero's goal line (`home/next-lesson-hero.md`, "Goal: Stage 1 · Hangul") names a stage: where the learner's route is heading. The strip's goal is time a day and is always called the **daily goal** ("Daily goal done", "A little more for your daily goal", the sheet's "Every day"), never a bare "goal". Both stay; neither replaces the other.
- **Copy rule** (§7.4): positive nudges only ("A little more for your daily goal", "N items are ready to refresh" on the Daily Review card). Never "lost", "missed", "broken", "behind", "late", "overdue", "don't lose", "keep it alive" or a countdown to midnight. No notification is sent by anything here.

## Interaction points

- A / B: the strip (one button) -> C. Its label is the whole strip's text (see Accessibility).
- C: a radio card or day choice -> selected; [[ DONE ]] or [x] -> saves `goals` (`setAt`), sends `goal.set { daily, weeklyDays }` once if anything changed, closes. Changing the goal mid-week keeps every dot and steady week as they are; the new days goal counts from this week.
- D: a choice -> saves `goals`, `goal.set`, D goes away for good; [ Not now ] -> D goes away for good (the arm's default applies).
- E: banners are not targets; `goal.met { points, target }` and `week.goal_met { days, target }` are sent once per day / week by the points logic (CM-17), not by the banner.

## Navigation graph

Enter from: Home (every visit) · Results "Back home"
Exit to: C (the goals sheet) and back · the hero and cards as `home/next-lesson-hero.md`

## States

- **success**: A (B on wide).
- **first day / no history**: all dots empty except today's outline; "Your first steady week starts here"; "Streak" line hidden until the first finished activity; the ring empty.
- **goal not chosen** (E4 "no default" arm, before D is answered): the ring is not drawn; the strip shows the dots, the headline and the streak line only; D shows after the first finished activity.
- **rest days used**: a third quiet past day of the week is drawn as a day to come ( ); the streak ends quietly and the line becomes "Start a new run! Best run: N days" on the next visit.
- **week reached**: the week's dots keep their looks; the headline number grows by one (E banner on the Results that reached it).
- **time zone change or travel**: days follow the device's current local day; a day already logged keeps its `localDay` (§4.8: `SessionLog.localDay`), so no dot moves or empties.
- **sync from another device**: `dayLog` sums points per install key (§4.8), so dots and the ring can only fill more; nothing empties.
- **offline**: all local; nothing fetched.
- **`goals` off** (§12.2): no strip and no sheet; Home shows today's "Streak N days" pill (local day, CM-4) and the rest of Home as `home/next-lesson-hero.md`. Stored goals and `dayLog` stay.
- **loading**: the strip's frame with the 7 empty dots until the snapshot is read (one frame, no spinner).
- **reduced motion**: the ring and dots are drawn in their end state at once; E's banners appear without a scale or burst.
- **320 x 568 and 200 % text**: the strip grows taller; the headline and streak line wrap under the ring; dots keep 24 dp (media, not text) and one row; no sideways scroll; the hero moves down and Home scrolls.

## Accessibility

- The strip is one button read as: "This week: Monday learned, Tuesday learned, Wednesday rest day, Thursday learned, Friday today, Saturday, Sunday. 4 steady weeks. Streak 5 days. Daily goal: Light, about 5 minutes, a little more to go. Change goals." (day names from `Intl`, full, not the narrow letters). Every day is read with its state, because the dots are the headline. A part with nothing to say is left out, never read as an empty pause: no streak on the first day, no daily goal before one is chosen (E4 "no default" arm).
- C: a dialog with the title "Your goals"; radio groups "Every day" and "Every week"; focus starts on the selected daily goal; [x] "Close".
- Targets: the strip at least `touchTarget.hero` tall; radio cards and buttons `touchTarget.min` (64); dots and the ring are not targets.
- Colour is never the only cue: learned = fill plus `check`, rest = `rest` glyph, today = thicker outline plus semibold letter, goal met = closed ring plus `check`.

## Anti-shame checklist (§7.7)

| Rule | Here |
|---|---|
| no red for a miss | no dot is ever red or amber; a quiet day looks like a day to come |
| no visible decay | dots, steady weeks, the ring and the streak never empty or drop; travel and sync only add |
| no lost streak copy | "Start a new run! Best run: N days"; "lost" and "broken" never appear |
| no percentage | none; the ring has no number |
| no per-question timer | none; no countdown to the end of the day |
| no random rewards | none |
| no purchasable rewards | none; no price or plan word |
| no comparison between learners | none; the strip is the learner's own (shared goals are §7.6, totals only) |
| no bad ending | a run ending is "Start a new run" with the best run kept |
| no age wording | none |
| no speaking UI | none |
| no emoji | none: Icon glyphs `check`, `rest` (new) |

## Data needs

- reads: `goals { daily, weeklyDays, setAt }`, `dayLog` (last 70 local days, summed over install keys), `streakLocal`, `streakBest`, the local week (device time zone, locale's first weekday), the E4 arm, the `goals` flag
- derived (pure, CM-17): learned days of the week, rest days (at most 2 a local week), steady weeks (weeks whose learned days reach `weeklyDays`, counted ever), today's ring fraction (points over the daily goal's points: Light 3, Steady 6, Strong 10)
- writes: `goals` (C, D); `dayLog` and the streak are written by the activities (Results, Daily Review, story, word set), not here
- telemetry: `goal.set`, `goal.met`, `week.goal_met` (§11.3); no PII, no free text

## New glyph (proposed for CM-17)

`rest`: a crescent moon outline (24 viewBox), drawn with the glyph sheet test like `shift` and `backspace` in D-3. Path in `design/screens/goal-ring-weekly-dots/mock/goal-ring-weekly-dots.html`. It never means "missed": it marks a granted rest day only.

## Proposed copy (English; keys for CM-17, which adds es and ko)

| Key | English |
|---|---|
| `learner.goals.steadyWeeks(count)` | 1 steady week / {count} steady weeks |
| `learner.goals.firstWeek` | Your first steady week starts here |
| `learner.goals.newRun(best)` | Start a new run! Best run: 1 day / Start a new run! Best run: {best} days |
| `learner.goals.today.met` | Daily goal done |
| `learner.goals.today.more` | A little more for your daily goal |
| `learner.goals.daily.light` / `.steady` / `.strong` | Light / Steady / Strong |
| `learner.goals.daily.time.light` / `.steady` / `.strong` | about 5 minutes / about 10 minutes / about 15 minutes |
| `learner.goals.weekly.days(n)` | 3 days / 5 days / 7 days |
| `learner.goals.sheet.title` | Your goals |
| `learner.goals.sheet.everyDay` / `.everyWeek` | Every day / Every week |
| `learner.goals.sheet.steadyHelp` | A steady week is a week you reach your days goal. They add up and never go away. |
| `learner.goals.sheet.restHelp` | Rest days: Hoya keeps your streak going on up to 2 quiet days a week. |
| `learner.goals.sheet.done.cta` | Done |
| `learner.goals.first.title` | How much time a day suits you? |
| `learner.goals.first.later.cta` | Not now |
| `learner.goals.banner.dayMet` | Daily goal done! |
| `learner.goals.banner.weekMet(count)` | Week goal reached! That is {count} steady weeks. |
| `a11y.goals.strip(...)` | This week: {days}. {steadyWeeks}. {streak}. Daily goal: {goal}, {state}. Change goals. (a part with no value is left out with its full stop) |
| `a11y.goals.day.learned` / `.rest` / `.today` | learned / rest day / today |

The strip's streak line reuses `learner.home.streak.pill` ("Streak 1 day" / "Streak N days"), which also stays for the `goals`-off Home, so there is one streak string. Every string passes `review-copy` (§9.3: no `%`, no "n of m").

## Open questions

- None blocking CM-17. Decision recorded: "steady weeks" counts every week the goal was reached, ever (not a consecutive run), so the OD-6 headline can never drop; the spec says "the count of steady weeks" without saying consecutive.
