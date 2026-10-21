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
                    text.secondary. Granted automatically by the rest-day rule below, at most 2 a local
                    week; it keeps the streak going (§7.4)
  (o) today         border.shape base outline, the day letter in semibold under it; fills as (v) once
                    anything is finished today
  ( ) a day still to come, or a past quiet day that is not a rest day: surface.paper with a border.shape
                    thin outline (4.55:1 on paper, the §14 3:1 non-text contrast; today is told apart by
                    the base outline and the semibold letter). A past quiet day that is not a rest day
                    looks exactly like a day to come: never a cross, a gap mark, a red or amber dot, or
                    any word

 Rest-day rule (CM-17, one pure function over `dayLog`, `streakLocal` and the local week):
  - A quiet past day becomes a rest day only when it bridges a live run: the day before it was a learned
    day or a rest day of that run. Days before the profile's first finished activity, and quiet days
    while no run is live (after a run ended), always draw as ( ).
  - Rest days are taken in date order, at most 2 in each local week (a gap across a week boundary uses
    each week's own 2).
  - The third quiet day in a row of a week whose 2 rest days are used ends the run; it draws as ( ).
    The rest days already granted keep their crescent: a crescent is never taken back.
  - A rest day keeps the run going but does not add to its number: `streakLocal.run` counts learned
    days only, so the streak number and the dots always agree.

 Ring (48 dp, borderWidth.thick track in border.subtle, filling clockwise in brand.primary by today's points
 over the daily goal; no number, no percentage):
  empty: the track alone
  partly: the arc; the strip's description says "A little more for your daily goal"
  met:   the closed ring and a `check` glyph in brand.primary; "Daily goal done"

A2. The streak line's three forms (never a drop, never "lost")
  Streak 5 days                        <- a run in progress: its learned days (rest days bridge it
                                          and add nothing)
  Start a new run! Best run: 12 days   <- a run has ended and nothing is finished since: from the
                                          first visit after it ended until the next finished activity
  Streak 1 day                         <- the day of the first finished activity of a new run (or
                                          of the first run ever); from the next learned day, "Streak 2 days"
 Example (the A2 mock): Monday learned, Tuesday and Wednesday rest days, Thursday quiet (the third quiet
 day, so the run ended), Friday today with nothing finished yet:
        M   T   W   T   F   S   S
       (v) (r) (r) ( ) (o) ( ) ( )      Start a new run! Best run: 12 days

B. Wide and 768 (the strip spans the main column above the hero; one row)
 +--------------------------------------------------------------------------------+
 | 4 steady weeks          M T W T F S S   | (ring) A little more for your daily goal |
 | (bodyLg bold)           v v r v o . .   |  48dp  Light, about 5 minutes            |
 |                         Streak 5 days   |        (bodySm regular, caption)         |
 +--------------------------------------------------------------------------------+
 The order at every width is the order of the strip's label: the dots and "N steady weeks" first and
 largest, the streak line under the dots, then the daily goal ring with its state line. The state line
 is regular bodySm text (`small`), never a second headline: "N steady weeks" stays the biggest text.

C. Goals sheet (the strip tapped; a bottom sheet on a phone, a centred dialog at 768 and wide)
+--------------------------------+
| Your goals                [x]  |
| Every day                      |
| ( ) Light    about 5 minutes   |  <- three radio cards, each touchTarget.min, plain
| (o) Steady   about 10 minutes  |     time words only (no points shown)
| ( ) Strong   about 15 minutes  |
| Every week                     |
| (o) 3 days  ( ) 5 days ( ) 7 days |  <- segmented choice, each touchTarget.min;
|                                |     3 days is the default (§7.4) until changed
| A steady week is a week you    |
| reach your days goal. They add |
| up and never go away.          |
| Rest days: Hoya keeps your     |
| streak going on up to 2 quiet  |
| days a week.                   |
| [[ DONE ]]                     |
+--------------------------------+

D. The first choice (once, on Home, after the first finished activity; shown in both E4 arms)
 +----------------------------+
 | How much time a day suits  |
 | you?                       |
 | [ Light, about 5 minutes ] |  <- three buttons, each touchTarget.min
 | [ Steady, about 10 minutes]|
 | [ Strong, about 15 minutes]|
 | [ Not now ]                |  <- skipping it means Light in the "Light default" arm
 +----------------------------+     and no daily goal in the "no default" arm, until a
                                    choice is made in C; the weekly goal is 3 days in both

E. Goal moments, a banner on the Results of the activity that reached them (one line each, Hoya cheering)
 | (ring closes) Daily goal done!                         |   <- goal.met
 | (dot fills)  Week goal reached! That is 5 steady weeks. |   <- week.goal_met (when the week
                                                               latches in `steadyWeeks`)
```

- **Headline** (OD-6): "N steady weeks" is the biggest text in the strip (`typography.size.bodyLg`, bold) at every width. It is the number of keys in the stored latch `steadyWeeks` (see Data needs), so it only grows: a week latches once, when its learned days first reach the weekly goal in force that week, and stays latched after `dayLog` drops the week (70 days), after a goal change and after a restore. With 0 it reads "Your first steady week starts here" instead of a number.
- **Streak below**: `streakLocal.run` on the local day, counting learned days (rest days bridge the run, they add nothing); `streakBest` only appears in "Start a new run! Best run: N days". The displayed run never drops because of a sync (§4.8 step 8).
- **No numbers of points** anywhere: the ring is a shape, the goal is time words. No "n of m": the dots are the week, never "2 of 3 days".
- **Two goals on Home, told apart by their words.** The hero's goal line (`home/next-lesson-hero.md`, "Goal: Stage 1 · Hangul") names a stage: where the learner's route is heading. The strip's goal is time a day and is always called the **daily goal** ("Daily goal done", "A little more for your daily goal", the sheet's "Every day"), never a bare "goal". Both stay; neither replaces the other.
- **Copy rule** (§7.4): positive nudges only ("A little more for your daily goal", "N items are ready to refresh" on the Daily Review card). Never "lost", "missed", "broken", "behind", "late", "overdue", "don't lose", "keep it alive" or a countdown to midnight. No notification is sent by anything here.

## Interaction points

- A / B: the strip (one button) -> C. Its label is the whole strip's text (see Accessibility).
- C: a radio card or day choice -> selected; [[ DONE ]] or [x] -> saves `goals` (`setAt`), sends `goal.set { daily, weeklyDays }` once if anything changed, closes. Changing the goal mid-week keeps every dot and steady week as they are: a latched week is never judged again. The new days goal applies to the current week while it is not latched yet, and to every week after it.
- D: a choice -> saves `goals`, `goal.set`, D goes away for good; [ Not now ] -> D goes away for good (the arm's default applies).
- E: banners are not targets; `goal.met { points, target }` and `week.goal_met { days, target }` are sent once per day / week by the points logic (CM-17), not by the banner.

## Navigation graph

Enter from: Home (every visit) · Results "Back home"
Exit to: C (the goals sheet) and back · the hero and cards as `home/next-lesson-hero.md`

## States

- **success**: A (B on wide).
- **first day / no history**: all dots empty except today's outline (the days before today are before the first activity, so none is a rest day); "Your first steady week starts here"; "Streak" line hidden until the first finished activity; the ring empty.
- **defaults** (before any choice): `weeklyDays` is 3 in both E4 arms; the daily goal is Light in the "Light default" arm and none in the "no default" arm. The sheet C opens with these selected.
- **goal not chosen** (E4 "no default" arm, before a daily goal is chosen in D or C): the ring is not drawn; the strip shows the dots, the headline and the streak line only; D shows after the first finished activity.
- **rest days used**: the third quiet day in a row, once the week's 2 rest days are used, draws as a day to come ( ); the run ends quietly and the line becomes "Start a new run! Best run: N days" until the next finished activity (A2).
- **week reached**: the week's dots keep their looks; the week latches in `steadyWeeks` and the headline number grows by one (E banner on the Results that reached it).
- **time zone change or travel**: days follow the device's current local day; a day already logged keeps its `localDay` (§4.8: `SessionLog.localDay`), so no dot moves or empties.
- **sync from another device**: `dayLog` sums points per install key (§4.8), so dots and the ring can only fill more; nothing empties.
- **offline**: all local; nothing fetched.
- **`goals` off** (§12.2): no strip and no sheet; Home shows today's "Streak N days" pill (local day, CM-4) and the rest of Home as `home/next-lesson-hero.md`. Stored goals, `dayLog` and `steadyWeeks` stay.
- **`mastery` off, `goals` on**: the strip is unchanged; the pills row drops the "N words known" pill (it belongs to `mastery`, `journey/mastery-ring.md` G) and shows the other pills of `home/next-lesson-hero.md` in their order (cards, three-star quests); nothing takes its place. With both off, Home is today's Home with the streak pill.
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

- reads: `goals { daily, weeklyDays, setAt }`, `dayLog` (last 70 local days, summed over install keys), `steadyWeeks`, `streakLocal`, `streakBest`, the local week (device time zone, locale's first weekday), the first finished activity's local day, the E4 arm, the `goals` and `mastery` flags
- **`steadyWeeks`** (new snapshot field, added to the §4.8 table by this design and built Worker-first by CM-3b, W→A in CM-17): `Record<localWeekStart, ISO>`, keyed by the local date the week starts (`YYYY-MM-DD`, the locale's first weekday when it latched), valued by when it latched; merge is the union of keys with the earliest value per key. Written once per week, by the points logic of the activity that makes the week's learned days reach the `weeklyDays` in force at that moment (it also sends `week.goal_met`). The headline reads only its key count. A change of goal, of time zone or of first weekday never removes a key; a backup and a restore carry it like every snapshot field.
- derived (pure, CM-17): learned days of the week, rest days (the rest-day rule above), today's ring fraction (points over the daily goal's points: Light 3, Steady 6, Strong 10)
- writes: `goals` (C, D); `dayLog`, `steadyWeeks` and the streak are written by the activities (Results, Daily Review, story, word set), not here
- tests for CM-17 (derived state and latch): a steady week 71 days old still counts; raising `weeklyDays` from 3 to 7 keeps every latched week; a restore from a backup keeps the count; a sync from a device that never latched a week keeps it; rest days before the first activity and after a run ended are never granted; a third quiet day ends the run and keeps the two crescents; a rest day never changes the streak number
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
| `learner.goals.banner.weekMet(count)` | Week goal reached! That is 1 steady week. / Week goal reached! That is {count} steady weeks. (one / other by `plural()`) |
| `a11y.goals.strip(...)` | This week: {days}. {steadyWeeks}. {streak}. Daily goal: {goal}, {state}. Change goals. (a part with no value is left out with its full stop) |
| `a11y.goals.day.learned` / `.rest` / `.today` | learned / rest day / today |

The strip's streak line reuses `learner.home.streak.pill` ("Streak 1 day" / "Streak N days"), which also stays for the `goals`-off Home, so there is one streak string. Every string passes `review-copy` (§9.3: no `%`, no "n of m").

## Open questions

- None blocking CM-17. Decisions recorded:
  - "Steady weeks" counts every week the goal was reached, ever (not a consecutive run), so the OD-6 headline can never drop; the spec says "the count of steady weeks" without saying consecutive. It is a stored latch (`steadyWeeks`, §4.8), not a derivation over the 70-day `dayLog`, so it survives the `dayLog` window, goal changes and restores.
  - Rest days bridge a live run and add nothing to its number (the rest-day rule above); §7.4 says only "up to 2 rest days a local week are granted automatically".
