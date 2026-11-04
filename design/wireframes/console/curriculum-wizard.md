# Console/Curriculum-wizard — Plan a term in four steps for a class or a family (wireframe v2, promoted)

Promoted in F-PLAN-002 P2-8 from `console/curriculum-planner.md` A to D (with the FP-B5 / FP-B13 amendment of step 2), drawn as P2-6 and P2-6b shipped. The plan builder it hands off to is `console/plan-builder.md` (section "Week groups, plan switcher, readout and re-pace"). The free-plan lines of the preview (lessons left out, plans that end early) are `console/curriculum-free-days.md` (F-ENT-003).
Spec: `docs/specs/F-PLAN-002-curriculum-planner.md` section 3.8 (wizard), 3.3 (generator), 3.4 (worked examples), 3.1 (audience defaults) · `docs/specs/AMENDMENTS-PLC-PLAN-HANDOFF.md` FP-B5, FP-B11 (pre-selection from `proposeRoute`)
Code: `apps/web/src/app/(console)/teach/space/curriculum/page.tsx` (`/teach/space/curriculum?id=` and `/parent/space/curriculum?id=`), `apps/web/src/components/console/CurriculumParts.tsx`, `apps/web/src/lib/console/curriculum.ts`; strings `console.curriculum.*`
Audience: **teacher** (class space) and **parent** (family space), signed in to the console on app.hangulroute.com. Learners never see this screen; they see one week of items on their device.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `(o)` / `( )` a radio, `[x]` / `[ ]` a checkbox or switch. Every sentence is a placeholder.

## Scenario (Given-When-Then)

Given: an adult wants a plan for a term or a half year instead of picking quests one by one
When: they say where the learners start, how long and how often, and what they care about
Then: they see a week-by-week plan that is honest about what exists today, save it as a draft, and publish it once from the plan builder

## Screen goal

"Turn four short answers into a draft plan the adult trusts."

## Box diagram

A. Step 1: starting point

```
┌────────────────────────────────────────────────────────────────┐
│ ← Back to <space>                                               │
│ Plan a term                                       Step 1 of 4   │
│ (family only) For: [ Mina v ]                                   │  <- required before Next
│ Where do they start?                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ Brand new    │ │ Knows some   │ │ Knows all    │              │
│ │ one line     │ │ letters      │ │ the letters  │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ Reads words  │ │ Reads first  │ │ Reads first  │              │
│ │              │ │ words        │ │ sentences    │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│ "Most of your students start here: Knows some letters"          │  <- 3+ results: a pre-selection only
│ [[ Next ]]                                                      │
└────────────────────────────────────────────────────────────────┘
```

B. Step 2: pace, length and rhythm (pre-selected from `proposeRoute`, P2-6b)

```
│ Pace     ( ) Gentle  (o) Steady [Suggested]  ( ) Brisk                     │
│ How long ( ) 4 weeks (o) 12 weeks [Suggested] ( ) 6 months ( ) Choose weeks [ 12 ] │
│          one preview line under each length ("Stage 1 is done around week 7, then heritage stories.") │
│ Starts   [ Thu, Oct 15 ]                                                    │
│ Days     [Sun][Mon][Tue][Wed][Thu][Fri][Sat]   (selected state in words, not colour only) │
│ Minutes  ( ) 5 ( ) 10 (o) 15 ( ) 20 ( ) 30                                   │
│ Days off [ + Add a break ]   Nov 22 - Nov 28  [ x ]                          │
│ note: that is 36 sessions in 12 weeks                                        │
│ [ Back ]  [[ Next ]]                                                         │
```

C. Step 3: goals

```
│ What matters most?  (o) A bit of everything ( ) Read Hangul ( ) First words ( ) Culture and stories │
│ Themes to start with (tap in order): [1. Nature] [2. Holidays] [Letters] [Food and daily life] [Play and crafts] │
│ [x] Mark Korean holidays                                                     │
│ [x] Include lessons that are not released yet                                │
│     one line: they start once they are released                              │
│ [ Back ]  [[ See the route ]]                                                 │
```

D. Step 4: preview

```
┌────────────────────────────────────────────────────────────────┐
│ Your route                                        Step 4 of 4   │
│ 30 lessons and stories · about 134 minutes · ends in Stage 1    │
│ ┌ Notices ───────────────────────────────────────────────────┐ │
│ │ No new lessons yet from week 15. Free practice and word topics fill those weeks. │
│ │ 5 lessons are not released yet. They start once they are.  │ │
│ │ (class) 3 lessons are not included yet.  [ See plans ]     │ │  <- grown-up only; never on a learner screen
│ └────────────────────────────────────────────────────────────┘ │
│ Week  Dates          Kind      What                 Items       │
│  1    Oct 15-21      Learn     Around the Table     Thu · Sat · Tue │
│  4    Nov 5-11       Review    Review and collect   -            │
│  ...  (narrow window: one card per week)                        │
│ one line: a draft; nothing reaches a learner until you publish  │
│ [ Change something ]   [[ Use this route ]]                     │
└────────────────────────────────────────────────────────────────┘
```

- Kinds and tags are words (Learn, Culture, Review and collect, Days off, coming soon, optional words), never colour alone.
- Notices are invitations, never alarms: nothing says behind, late, missed or overdue, and nothing ranks learners.

## Interaction points

- Learner picker (family) -> the plan targets that learner; the start card pre-selects from their level check.
- Start card -> selects; the hint only pre-selects.
- Pace / length / weekday / minutes / break -> the calendar; the sessions note updates live. More than the item cap: one sentence, **Next** disabled with the reason beside it.
- Focus and theme chips -> the generator's goals (theme order changes what comes first after Stage 1 only).
- **See the route** -> runs the generator in the page (no network).
- **Use this route** -> `PUT /api/spaces/:id/plans` as a draft with `meta` (`publish: false`), then the plan builder for that plan.
- **Change something** -> step 3 (or step 2 when the problem is the rhythm).

## Navigation graph

Enter from: `console/roster` (**Plan this term**) · `console/plan-builder` empty state (**Start from a template**) · `console/home` and the family learner card (**Update the plan**, P2-6b)
Exit to: `console/plan-builder` (the saved draft) · `console/roster` / the family space (back) · `console/billing` (**See plans**, class notice only)

## States

- **success**: as drawn.
- **empty**: nothing schedulable for the choices -> the preview shows the reason and **Change something** only.
- **error**: the roster does not load -> "Try again"; the save fails -> one line above the buttons, the draft stays in the page.
- **offline**: the steps and the preview work (the generator is local); saving needs the API.
- **small window (320 px)**: the start cards and chips wrap, the week table becomes week cards, **Next** stays reachable, nothing scrolls sideways (P2-8 `apps/web/e2e/curriculum.spec.ts`).

## Data needs

- reads: the roster (`summary.placement.level`, `stage1.questsDone`), the space's entitlement (`unlockedStagesForSpace`), the shared catalogue, today
- writes: a draft plan row with `meta` (`params`, `weeks`, `horizonDays` = 7) and week-numbered items
- telemetry: none in the console beyond the existing plan saves

## Open questions

- Should a class wizard remember last term's choices per space? (default: no; templates are out of scope)
- Is "Review and collect" the right name for a week with no items? (default: yes until a review item kind exists, F-RVW-001)

## Meeting (class with practice days; AMENDMENTS-ROUTE-CLASS-BLEND BL-D)

Spec: `docs/specs/AMENDMENTS-ROUTE-CLASS-BLEND.md` sections 10.1 (meeting block), 10.2 (preview and readout), 10.3 (the lecture card on a blended plan), 5 (the two modes), 6.1 and 6.3 (sessions and practice days), 19 (draft strings) · Mocks: `design/screens/route-blend/` (`wizard-meeting.html`, `wizard-preview.html`, `readout.html`; shots at 320 and 1280 in en, es and ko) · Built by BL-4 (wizard, preview, readout) and BL-5 (lecture card), both behind `routeBlendEnabled()` (`NEXT_PUBLIC_ROUTE_BLEND_ENABLED`, default off until BL-10).
Audience: **teacher** only (class audience). The family wizard and a school space have no meeting block. Learners never see these screens.

### Scenario (Given-When-Then)

Given: a teacher whose class meets on Tuesdays for 30 minutes, and who wants learners to practise alone three times a week for 10 minutes
When: they open step 2 of the class wizard
Then: one block asks when the class meets and how learners practise, suggests the practice days, offers the two ways class and practice fit together, and the preview shows class days and practice days side by side with honest totals

### Screen goal

"Say how the class meets and how learners practise, on one screen."

### M1. Step 2, the meeting block (class audience, flag on; 1280 px)

It sits at the top of step 2 and replaces the class-day + homework-day chips (and the "Pick a class day and a homework day." hint) and the pace chips. Starts, Days off and the sessions note stay below it.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Back to <class>                                                                         │
│ Plan a term                                                               Step 2 of 4     │
│ ┌ How does this class meet? ──────────────────────────────────────────────────────────┐ │
│ │ Class                                        Learners also practise on their own     │ │
│ │ [Sun][Mon][TUE][Wed][Thu][Fri][Sat]          [ 3 v] times a week × [10 v] min each time │ │
│ │ Class length [ 30 min v ]                    Practice on Wed, Fri, Sun  Change days   │ │
│ │                                              (Change days open: [Sun]..[Sat] chips)   │ │
│ │ How do class and practice fit together?      (shown only with 1 or more practice days)│ │
│ │ ┌(o) Practise what class taught [Suggested]─┐ ┌( ) Class and practice cover different ┐│ │
│ │ │ Each class's lessons come back on the     │ │ lessons. Practice days also bring new ││ │
│ │ │ practice days after it.                   │ │ lessons from the groups class has ... ││ │
│ │ └───────────────────────────────────────────┘ └───────────────────────────────────────┘│ │
│ │ How long? (4 weeks) (12 weeks) (6 months [Suggested]) (Choose weeks)                 │ │
│ │           [ ] Keep the average when there are days off                               │ │
│ └──────────────────────────────────────────────────────────────────────────────────────┘ │
│ Starts [ Mon, Nov 9 ]                                                                     │
│ Days off [ Mon, Dec 21 ] – [ Sun, Jan 3 ]  [ ] Only the class is off                      │
│          [ Tue, Feb 16 ] – [ Tue, Feb 16 ] [x] Only the class is off                      │
│          [ + Add a break ]                                                                │
│ That is 100 sessions in 26 weeks.                                                         │
│                                                                   [ Back ]  [[ Next ]]    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Class** weekday chips are a multi-select of 1 to 5 days (`role="checkbox"`, selected state bold with a thicker outline, never colour alone); a sixth tap is refused with one line beside the chips. **Class length**: 15, 20, 30, 45, 60 min, default 30 (BL-OD-13).
- **Practice row**: count 0 to 7 (default 0 until the BL-10 flip, then 3, BL-OD-12) × minutes 5, 10, 15, 20, 30 (default 10; 5 when pictures-first). 0 is today's Class only plan: the suggested-days line and the mode cards hide (state `zero`). A teacher who wanted one homework day picks 1.
- **Suggested days line**: `practiceDaysFor(classDays, P)` as short weekday names in week order from Monday ("Practice on Wed, Fri, Sun"). With `7 - L` practice days: "Practice every day"; above it, "Practice every day, also after class on Tuesday" (state `every`). **Change days** (`aria-expanded`) opens the seven weekday chips; the count stays the row's count; a class day may be chosen (it then holds a session after class, section 6.1).
- **Mode cards** (radio group, arrow keys move and select): *Practise what class taught* preselected with the *Suggested* tag (BL-OD-1); *Class and practice cover different lessons* (state `split`).
- **Length**: the length chips stay; **Keep the average when there are days off** is a checkbox, off (BL-OD-18); when on, the preview names the new end date.
- **Days off**: each break row gains the checkbox **Only the class is off** (`blend.classDaysOff`): practice goes on, the class day carries nothing. Off = today's break (no sessions at all).
- One block, one screen: measured by `design/screens/route-blend/tools/capture.mjs` (assumption c; numbers in that README).

### M2. Step 2 at 320 px (and 200 % text)

```
┌──────────────────────────┐
│ How does this class      │
│ meet?                    │
│ Class                    │
│ [Sun][Mon][TUE]          │
│ [Wed][Thu][Fri]          │
│ [Sat]                    │
│ Class length [30 min v]  │
│ Learners also practise   │
│ on their own             │
│ [3 v] times a week ×     │
│ [10 v] min each time     │
│ Practice on Wed, Fri,    │
│ Sun                      │
│ Change days              │
│ How do class and         │
│ practice fit together?   │
│ ┌(o) Practise what ... ┐ │
│ └──────────────────────┘ │
│ ┌( ) Class and practice┐ │
│ └──────────────────────┘ │
│ How long?  chips wrap    │
│ [ ] Keep the average ... │
└──────────────────────────┘
```

- One column, chips wrap, nothing scrolls sideways, no scroll area inside the block; the block is one vertical scroll (assumption c).
- The practice row follows the locale's word order: Korean reads "주 [3]회 × 한 번에 [10]분" (the mocks propose one key, `practice.inline`, for the row; see the route-blend README).

### M3. Step 4, the preview header and the cycle table

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Your route                                                          Step 4 of 4  │
│ About 4 sessions a week: 1 class day (30 min) and 3 practice days (10 min each,  │
│ plus about 2-3 minutes of Daily Review).                                         │
│ Class days teach about 3 lessons; practice days play about 1.                    │  <- overlap; split: about 2
│ 96 sessions in all, 4 a teaching week.                                           │
│ Starts with the first class on Tue, Nov 10.                                      │
│ ┌ The weeks of the route ────────────────────────────────────────────────────┐   │
│ │ Week │ Dates            │ Kind   │ Class             │ Practice            │   │
│ │  1   │ Tue, Nov 10 –    │ Learn  │ Tue, Nov 10       │ Wed, Nov 11         │   │
│ │      │ Mon, Nov 16      │        │ First letters 1   │  First letters 1    │   │
│ │      │                  │        │ First letters 2   │  Refresh            │   │
│ │      │                  │        │ First letters 3   │ Fri ... Sun ...     │   │
│ │  4   │ Tue, Dec 1 – ... │ Review │ Review together   │ Wed: Refresh ...    │   │
│ └────────────────────────────────────────────────────────────────────────────┘   │
│ A draft; nothing reaches a learner until you publish.                            │
│                                         [ Change something ]  [[ Use this route ]] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Each row is one **class cycle** (a class day and the days up to the next one, section 6.3). **Class** cell: the class date and its lesson titles. **Practice** cell: each practice weekday and date, then its lessons: the class's lessons first, then (split only) practice-only lessons written "Title (practice only)", then **Refresh** where the day has room or no lesson. Tags are words, never colour alone.
- The table keeps header cells (`th scope="col"`) and the week cell as the row header (`th scope="row"`). Below 600 px each row becomes a card; each cell is introduced by its column name.
- The per-day line takes its numbers from `stats.byTrack`: in overlap a practice day plays about 1 lesson plus Refresh (golden C); the spec's example "about 2" is the split case (golden D). BL-4 reads the stats, never a constant.
- Warnings `item-cap`, `practice-short`, `class-paced` and `content-runs-out` join the existing Notices box above the table, worded as invitations.

### M4. Published readout (plan builder, This week)

```
│ This week                                                    │
│ Class · Tue, Nov 17                                           │
│   First letters 7 · First letters 8 · First letters 9        │  <- the class day's lessons first
│ Practice                                                      │
│   Practice on Wed, Fri, Sun                                   │  <- the class's default days, never a learner's own
│   41 / 54 so far · 234 planned                                │  <- the existing class aggregate line, counts only
│ Class days so far: 2 of 26                                    │  <- scheduled class dates up to today, never attendance
│ [ Re-pace from today ]  [ Move this class day ]               │
│ Stop practice days                                            │
```

- **Move this class day** sits next to **Re-pace from today** and asks first, like Re-pace: "the class day's lessons and every later class day's move to the following class days" (BL-3 `classDay` shift); nothing done is moved.
- **Stop practice days** (link) re-lays the future without practice days; a class-only published plan shows **Add practice days to this plan** instead (opens M1 prefilled).
- No learner list, no learner sorted or compared, no per-learner practice days; nothing asks "Did class happen?" (BL-OD-8).

### M5. The lecture card on a blended plan (BL-5)

```
│ Present this plan                 │
│ Class day: Tuesday · 3 lessons    │
│ Class length: 30 min              │  <- no 10 / 20 / 30 length chips on this card
│ [[ Present this plan ]]           │
```

- The deck is the next class day's lessons at the plan's class length (`fillOutline`); the length is changed in the plan, not here. A classic or class-only plan keeps the chips. "Lecture" is never a UI word on this card.

### Interaction points (meeting)

- Class chips, Class length, practice count and minutes, Change days chips, mode, Keep the average, Only the class is off -> the draft params (`toParams` writes `blend` when practice is 1 or more); the sessions note updates live.
- **See the route** -> the generator in the page (offline, no network).
- **Move this class day** / **Stop practice days** / **Add practice days to this plan** -> confirm, then `regenerateFrom` with the same plan id; devices reconcile on their next sync.

### States (meeting)

- **default**: Tuesday, 30 min, 3 × 10 min, overlap (mock state default).
- **zero practice days**: the block keeps Class and Class length only; mode and suggested days hidden; Class only plan, unchanged generation.
- **every day**: 7 practice days with one class day: "Practice every day, also after class on Tuesday".
- **no class day chosen**: **Next** is disabled with one line beside it: pick at least one class day.
- **offline**: the block and the preview work; saving needs the API.
- **flag off**: today's step 2 exactly (class-day + homework-day chips).

### Accessibility (meeting)

- Chips and cards are buttons with `role` radio or checkbox and `aria-checked`; groups are labelled by their visible label; the practice selects are named by their unit words; **Change days** carries `aria-expanded`.
- The cycle table reads row by row: week (row header), dates, kind, class, practice.
