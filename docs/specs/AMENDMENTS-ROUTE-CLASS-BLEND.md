Status: ready (spec pass BL-0; amends F-PLAN-002, F-ROUTE-001 as amended by `AMENDMENTS-ROUTE-LEARNING-ROUTE.md`, F-TCH-004 as amended by `AMENDMENTS-LECTURE-V2.md`, and F-REPORT-001; implementation rows in section 16; owner decisions in section 17, each with a default that applies until answered)

# Amendment: class days and practice days — one Learning Route for a class that meets and learners who practise on their own

> Basis: `origin/main` `1bfda3fc8` (2026-10-30). Every `file:line` below is at that commit unless it names an open PR. Open PRs this amendment touches only by reference: #896 and #898 (two volumes per cell: `CatalogCell.episodeIds`, route days, the lecture chooser), #917 and its rows (GX, the grown-up UX amendment; in particular GX-11 #942, the child card week line), #930 (KT, the forgiving tap). No row here edits a file those PRs change before they merge; where a row needs their result it says so in its **Needs** column.

**Owner request 2026-11-03 (translated from Korean):** "A student's personal learning route and the teacher's lecture-mode plan can overlap. When, in one class, students have a personal study plan (1-7 times a week) and the teacher has a lecture plan (once a week or more), these must be properly separated and harmonised. So the Learning Route design must be layered by persona: a student studying alone (self-study), and a student in a class or school where lectures and personal study happen together. When lectures and study happen together, route planning must allow either overlapping lecture and study content, or splitting into lecture material and personal-study material. If students study personally 3 or more times a week and have one lecture a week with the teacher, then over the route period (e.g. 6 months) the route must be distributed to average 4 sessions a week (1 lecture + 3 personal). And because lecture time and personal study time can differ in weight, the amount of learning distributed must differ too: if a lecture is 30 minutes and personal study is 10 minutes per session, the plan must put more of the teaching material on lecture days."

**Standing rules that apply here:**
- Any age: no age wording on shared surfaces.
- Child safety: grown-up gate on a child's plan changes (F-PLAN-002 OD-17), local-first data, no learner name or profile id in any URL or telemetry payload, learners never sign in.
- Anti-shame: no ranking, no comparison between learners, meters only fill, no count above 3 on learner screens, no dates or countdowns to the goal on learner screens, never "behind", "late", "missed", "overdue", "failed", "incomplete" or the F-PAR-001 section 3.6 phrases, in any locale.
- Strings: every UI string goes through `packages/i18n`; en, es and ko land in the same PR; design tokens only; no emoji. No copy claims review by a native speaker or a human expert.
- Commerce: no price, product name, "Premium" or ask-a-grown-up prompt on learner screens; Stripe stays in sandbox.
- Data: D1 changes additive only (this amendment adds **no** migration); the Worker deploys before any console or app build that writes or reads a new field; capability gates keep older apps on shapes they understand.
- The presenter still writes no learner progress (F-TCH-004 section 3.9 is unchanged).

**Ids.**
- `BL-An` amends a section of a sibling spec (section 15).
- `BL-n` is a PR row (section 16). `BL-W` is the Worker-first row.
- `BL-OD-n` is an owner decision (section 17).
- F-PLAN-002's ids (P2-n, OD-n, FP-Bn), F-ROUTE-001's (R-n, LR-n, LR-OD-n) and the lecture specs' (LV-n) keep their meaning.

**Glossary (UI words; also proposed for the `docs/specs/README.md` glossary by BL-0).**
- **Class day**: a dated session where the teacher teaches the class together, usually with the presenter (lecture mode). Code: `track: 'lecture'`.
- **Practice day**: a dated session the learner does alone on their own device. Code: `track: 'personal'`.
- **Class weekly plan with practice days** ("blended plan" in code and in this spec only, never in UI copy): a class (or a school's class) curriculum that holds both kinds of day.
- **Practise what class taught** (code `mode: 'overlap'`) and **Class and practice cover different lessons** (code `mode: 'split'`): the two ways the teacher can join the two tracks.
- **Weekly plan** keeps its meaning (any dated curriculum plan, F-PLAN-002 OD-7). "Lecture" is never a UI word: the console says "class day", the learner app says "class".

---

## 0. Summary

1. **Three persona layers, one generator.** A learner's route is planned in one of three layers (section 3): **Solo** (self-study: the learner's own weekly plan or a family's), **Class only** (today's class weekly plan, unchanged) and **Class with practice** (new: class days plus practice days in one plan). The teacher picks the layer per class; Solo applies whenever no class plan with practice days is in force.
2. **Sessions per week add up.** A class with 1 class day and 3 practice days plans **4 sessions a week**, every teaching week, for the whole route (for example 26 weeks = 6 months, 104 sessions). The weekly goal, the Route card and the console readout all say 4, not 1 or 3 (section 6.1).
3. **Minutes decide how much a session holds.** Each session gets a minutes budget, and lessons are packed into it by their catalogue minutes. A 30-minute class day carries about 5 five-minute lessons; a 10-minute practice day carries about 2 (section 6.2). Today every session holds exactly one item (`generate.ts:466-475`, F-PLAN-002 section 3.1 "`minutesPerSession` does not add items").
4. **Two blend modes, chosen by the teacher per class.** **Practise what class taught** (default): the class day brings the new lessons and the practice days that follow assign those same lessons to each learner on their own device, spaced after the class (section 5.1). **Class and practice cover different lessons**: the class day and the practice days take different lessons from one queue, shared by minutes, and practice never opens a lesson group before a class day has opened it (section 5.2).
5. **One plan, two tracks, no new table.** The class's plan gains an optional `blend` block in its params and an optional `track` and `lectureDate` on each item. Class-day items never become homework; practice items do, exactly as today. Old apps get a projection without the class-day items (section 9).
6. **Learners see their class day; nobody is compared.** The Route card and Homework say "From class" on practice lessons and show the class day by weekday; class-day-only lessons appear as a neutral "In class" mark, never a to-do and never counted. Nothing records attendance (sections 7 and 13).
7. **The own weekly plan steps aside, never deleted.** While a class plan with practice days is in force for a learner, that learner's own weekly plan is paused and resumes when the class plan ends; the proposal never schedules a lesson the class already scheduled (section 8).

## 1. Problem: what main does today

Measured at `1bfda3fc8`.

1. **Every session is the same.** A plan is a list of dated items, one item per session (`generate.ts:456-477`). `PlanItem = { kind, id, targetDate?, note?, week? }` (`schemas/plan-item.ts:8-15`) has no session kind and no weight. `CurriculumParamsSchema` (`curriculum/params.ts:33-65`) has one cadence per plan: `sessionsPerWeek` 1-7 or `sessionDays`, and one `minutesPerSession` (5/10/15/20/30).
2. **Minutes do not size a session.** `minutesPerSession` feeds only `stats.minutesAvailable` (`generate.ts:578`) and the warning `session-too-short` (`:568`).
3. **The class hint is a weekday tip.** The console wizard's class step says "Pick a class day and a homework day." (`packages/i18n/src/messages/en/console.ts:795`). Both days become ordinary items that every learner device derives as teacher homework (`plan-derivation.ts:62-67`). The class day is not recorded anywhere a device or the generator can read.
4. **Lecture mode is outside the plan.** "Present this plan" projects this week's items (`apps/web/src/lib/console/lecture.ts:94-107`) and `next-lesson` fills them to 10/20/30 minutes (`AMENDMENTS-LECTURE-V2.md` section 4.2 N1). The presenter writes no progress (F-TCH-004 section 3.9), so after class the same items are still pending homework on each device. The overlap mode exists by accident; a split mode does not exist.
5. **A class plan and an own plan ignore each other.** `proposeRoute` for a self plan excludes only finished quests (`apps/mobile/src/logic/route/proposal-flow.ts:126, 154-160`), so the own plan can schedule the class's lessons on other days. Merging is precedence only: Home card (2) takes one item a day by `SOURCE_RANK` teacher > parent > system (`assignment-merger.ts:12, 39-48`), `routeNext` and `pickGoal` follow the leading source (`route-next.ts:150-156`; `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 4.1), so a class plan hides the own plan.
6. **The weekly goal takes the top plan's days.** `planDaysInForce` (`apps/mobile/src/logic/goals/plan-days.ts:14-26`) returns the leading plan's `sessionsPerWeek`. A class plan of 1 day plus an own plan of 3 gives a goal of 1, not 4.
7. **The non-goal this reverses.** F-PLAN-002 section 4 lists "mixing a class plan and a self-route into one list" as out of scope. This amendment does not mix two plans either: it puts both kinds of session **into the class plan** and pauses the own plan while that plan is in force (section 8). F-PLAN-002 section 4 gains a pointer here (BL-A1).

## 2. Contracts with sibling specs

| Spec | This amendment takes | This amendment gives or changes | Until that sibling row merges |
|---|---|---|---|
| **F-PLAN-002** curriculum planner | `generateCurriculum`, `regenerateFrom` (`shift`, `requeue`, `reseed`), `proposeRoute`, the wizard (`lib/console/curriculum.ts`), the `?cap=curriculum` gate, `CURRICULUM_MAX_ITEMS` 260, derivation rules 1-4 (section 3.6) | `blend` params, item `track` / `lectureDate`, the blended generator path, minutes packing for blended plans only, `?cap=blend`, the wizard's meeting step (sections 5, 6, 9, 10). Solo and class-only generation is byte-for-byte unchanged (goldens A and B stay) | — (all on main) |
| **F-TCH-004 / AMENDMENTS-LECTURE-V2** lecture mode | `planOutline`, `pickPlan`, preset `next-lesson` N1, `fillToLength` | For a blended plan, N1 and "Present this plan" take **the class day's items** (the next class day on or after today), not the whole week (section 10.3). The presenter itself changes nothing and still writes nothing | — |
| **F-ROUTE-001 / AMENDMENTS-ROUTE-LEARNING-ROUTE** | `pickGoal`, `routeNext`, the route card's weekly plan line, the grown-up route card | The weekly plan line names the class day and practice days; practice items are tagged **From class**; class-day-only lessons get the **In class** mark (section 7). `pickGoal` precedence is unchanged; the paused own plan simply is not a source (section 8) | — |
| **F-REPORT-001** progress reports | the plans block (`planProgress`, at most 3 plans), the 7-day squares | Blended plans report practice items only; the class readout adds a class-day line that is calendar-based, never attendance (section 11) | — |
| **F-CURR-002** cells, volumes and mastery | Daily Review (2-3 minutes, Leitner boxes 1/3/7/14/30/60/120 days), the weekly goal of 3/5/7 days, `class-review` / `class-check` presets, cell = 3 quests | Practice days are placed after the class day at the Leitner box-1 and box-2 gaps (section 6.4). Daily Review stays outside the plan and outside every budget here. When #896 / #898 merge, a cell's "opened by class" rule (section 5.2) reads `CatalogCell.episodeIds` (both volumes count as one cell) | Before #898: one episode per cell, as on main |
| **AMENDMENTS-ONE-ACCOUNT-MANY-USERS** | device uses `family` / `teacher` / `school`; a learner in one family and up to 3 classes (`LEARNER_CLASS_CAP`) | Two blended class plans for one learner: both derive; the leading one (newest within the teacher rank) sets the Route line; the weekly goal counts the union of their days (section 6.1) | — |
| **F-SPACE-002** class transfer (`CLASS_TRANSFER` on) | the transfer flow and its reconcile | A move between classes changes the leading plan; nothing is lost and nothing is shown as missed (section 12.2) | — |
| **GX (#917, open)** grown-up UX | the parent child card's week line and the class line (GX-4 #937, GX-11 #942) | BL-9 appends the class-day words to the existing class line; it adds no new row to the card | BL-9 waits for GX-4 and GX-11 |
| **KT (#930, open)** forgiving tap | `TapTarget` for any new learner control | BL-8's practice-day chips use it | BL-8 waits for KT-1 (#943) |

## 3. Personas and the three layers

### 3.1 Personas

| Persona | Where they work | What they need from the route |
|---|---|---|
| **P-S Solo learner** (self device, or a child on a family device, no class plan with practice days) | learner app | One weekly plan of their own (or the family's), at their own cadence and minutes. Today's F-PLAN-002 self-route, unchanged. |
| **P-C Class learner with practice** (in a class, or a class inside a school, whose plan has practice days) | learner app, sometimes a class-scoped device | To know which day is the class day, to get practice that fits the class, and one weekly goal that counts both. Never to see a second plan fighting the first. |
| **P-T Teacher planning a class** | console (`/teach/space/curriculum`), presenter | To say how the class meets (class days, their length) and how much learners practise alone (days a week, minutes), to choose overlap or split, and to see a preview with honest totals. On a class day, "Present this plan" shows that day's lessons. |
| **P-P Parent** (family space) | console family home, learner report | To see that the child has class on Tuesday and practises on 3 days, and how practice is going (fill only), without seeing the class or other children. To keep or pause a family weekly plan that would now be a third source. |
| **P-A School admin** | console school view (aggregate only) | Nothing new beyond the existing `classesWithPlan` counts; a class plan with practice days counts as a plan. No per-learner view (F-SCHOOL-001). |

### 3.2 The layers

| Layer | When it applies | Who plans | Plan shape | Generator path |
|---|---|---|---|---|
| **Solo** | No class plan with practice days is in force for the learner today | The learner (self) or a grown-up (family) | One track: today's self-route or family curriculum | `generateCurriculum` without `blend` (unchanged; one item per session, BL-OD-9) |
| **Class only** | The teacher chose "Class days only" (today's class plan) | Teacher | One track: class days + homework days as ordinary items | Unchanged. Own and family plans run beside it as today (precedence) |
| **Class with practice** | The teacher chose "Class days and practice days" | Teacher sets the frame; the learner (or a grown-up) may move the practice days (BL-OD-7) | Two tracks in one plan: `lecture` items and `personal` items | `generateCurriculum` with `params.blend` (sections 5 and 6) |

**Layer resolution on a device** (`layerOf(sources, today)`, pure, `apps/mobile/src/logic/route/layer.ts`, BL-6): `class-with-practice` when any inbox source has `meta.params.blend` and a week holding today; else `class-only` when any class or school curriculum is in force; else `solo`. The layer only decides two things: whether the own weekly plan is paused (section 8) and which weekly-goal rule applies (section 6.1). Everything else (derivation, precedence, `routeNext`) runs on the sources as today.

**Schools.** A school's classes plan with the class wizard (a class inside a school is a class). A school-space plan keeps deriving as `parent` (`plan-derivation.ts:65`) and cannot be blended; the console wizard still has no school audience (non-goal).

## 4. Goals and non-goals

**Goals.**
1. **G1.** A teacher can plan class days and practice days in one plan, choose overlap or split, and see per-track totals before publishing.
2. **G2.** Over the route period the plan holds exactly `L + P` sessions in every teaching week (L class days, P practice days); a week with days off loses only those sessions, and the console states the average both over teaching weeks and over the calendar.
3. **G3.** New material is distributed by minutes: on any day, the material planned is proportional to that day's minutes budget, so a 30-minute class day carries more than a 10-minute practice day (owner example: 5 lessons against 2).
4. **G4.** A learner in such a class has one weekly goal that counts class and practice days together, one Route line, and no duplicate or conflicting own plan.
5. **G5.** Everything works offline on the device and on the presenter; only console pages need the network, as today.
6. **G6.** No learner is ever compared with another; no attendance is recorded; nothing on a learner screen reads as a debt.

**Non-goals.**
- Attendance, "covered in class" per learner, or any write from the presenter (F-TCH-004 section 3.9 stays).
- Per-learner overrides of the class's lesson list (F-PLAN-001 section 4; F-PLAN-002 section 4). A learner may move their practice **days** (BL-OD-7), never change which lessons.
- Minutes packing for Solo and Class-only plans (BL-OD-9 keeps them byte-identical).
- A school-wide or multi-class blended plan; a school audience in the wizard.
- A new D1 table, a lecture log or server-saved decks (F-TCH-004 section 3.15 keeps them a later phase).
- A `review` plan item kind (F-PLAN-002 D11; Daily Review stays outside the plan).
- Any change to Stripe, prices or entitlements: `unlockedStages` still comes from the space's entitlement.

## 5. The blend modes

Both modes read one queue built exactly as today (stage order, then the story pool, coming-soon capped at 5; F-PLAN-002 section 3.3 steps 1-5) and one calendar (section 6.3). They differ only in who takes which items.

### 5.1 Practise what class taught (`mode: 'overlap'`, default, BL-OD-1)

- **Class day.** Takes new items from the queue head by the class budget `B_L` (section 6.2), capped by the practice room before the next class day (`B_L_eff = min(B_L, Σ B_P` of the practice days up to the next class day`)`, at least one item), so every lesson taught has a practice slot before the next class. Items are stored with `track: 'personal'`, `lectureDate: <class date>` and `targetDate: <practice date>` (one item per lesson, never two: derivation keeps the first item naming a quest and its date, `deriveAssignments` in `plan-derivation.ts`).
- **Practice days after it.** Hold that class day's lessons in class order, packed by `B_P` per day. The learner plays each lesson on the device; this is the first recorded completion, since the class run recorded none.
- **Room left on a practice day** (the class's lessons are placed and minutes remain): the story of a cell the class has opened, if one fits; else nothing (Daily Review and free play fill it). Practice days never pull new lessons in this mode (BL-OD-3), so the next class never re-teaches something some learners already met alone.
- **Why default.** It is the stronger pattern for beginners (meet it with the teacher, then retrieve it alone a day later), and a learner who was absent from class still gets every lesson: each quest teaches itself (Discover step, F-QUEST-002), so nobody falls out of the plan.
- **Cost.** New material per week is the class budget only. With 1 x 30 and 3 x 10: 5 lessons a week (section 6.5).

### 5.2 Class and practice cover different lessons (`mode: 'split'`)

- **Week packet.** The week's new material is taken from the queue head until its minutes reach `Σ B_L + Σ B_P` over the week's sessions.
- **Class takes the openers.** Walking the packet in order, each cell's first lesson (the cell opener) goes to the class day that comes first; then the class day takes further lessons in order while its budget allows. Practice days take the rest in order, each on a date after the class day that opened its cell.
- **Invariant (BL-OD-4, tested):** a practice item's cell has an opener on a class day on or before the practice item's date. When the class budget cannot hold every opener in the packet, the packet is cut before the first cell whose opener does not fit, and the practice days' spare room goes to stories of opened cells.
- **Storage.** Class items: `track: 'lecture'`, `targetDate: <class date>` (never derived on devices). Practice items: `track: 'personal'`, `targetDate`.
- **Cost.** New material per week is the whole week's minutes, so the catalogue is covered about twice as fast as in overlap, and the catalogue's end or the 260-item cap can bind on a 6-month plan (section 6.5). The preview says so in plain words.

### 5.3 Review and culture weeks

- **Review week** (`reviewEvery`, F-PLAN-002 section 3.3 step 6): the class day carries no new item; the console's lecture card suggests the `class-review` preset (F-CURR-002 section 8); practice days carry no item (Daily Review and the week's free practice). In overlap mode, the practice days of the review week may hold the previous class day's lessons that did not fit before (never dropped).
- **Culture week:** the week's story (and festival anchor) goes to the class day in overlap mode (read together, then read alone on the first practice day) and to the first practice day in split mode.
- **Break week** (every session removed by days off): nothing is placed; the queue waits.

## 6. Scheduling maths

### 6.1 Sessions per week and the average

Let `L` = class days a week (1-5, `blend.lecture.days`), `P` = practice days a week (1-7, `blend.personal.perWeek`), `W` = weeks, `D_off(w)` = sessions removed by days off in week `w`.

- **Sessions in week w:** `S(w) = L + P - D_off(w)`.
- **Route sessions:** `S = Σ_w S(w)`. The console shows **"About {L+P} a week: {L} class day(s) and {P} practice days"** and, when any week loses sessions, "{S} sessions in all".
- **Averages:** over teaching weeks (weeks with `S(w) > 0`) the average is exactly `L + P` unless a days-off range splits a week; over the calendar it is `S / W`. Example: 26 weeks, 1 + 3, two holiday weeks off: 96 sessions, 4.0 a teaching week, 3.7 over the calendar; the preview says both.
- **Distinct days.** Practice days are placed on non-class weekdays first. When `L + P > 7`, the extra practice sessions sit on class days as "after class" sessions (same date, after the class). The plan's `sessionsPerWeek` is written as `min(7, |class days ∪ practice days|)`, the number of **distinct days**, so `planDaysInForce` (which counts days for the weekly goal) reads the right value on old and new apps alike (section 9.4).
- **Weekly goal (BL-6).** `planDaysInForce` keeps its rank rule; for a blended leading plan it returns the plan's distinct days (4 in the owner example). With two blended class plans in force, it returns the size of the union of their days, capped at 7. With a learner's moved practice days (BL-OD-7), it counts the learner's days.

### 6.2 Minutes budgets and packing

- **Class budget:** `B_L = T_L - 4` when `T_L >= 20`, else `T_L`, where `T_L` is the class length (`blend.lecture.minutes`: 15, 20, 30, 45, 60; BL-OD-13). The 4 minutes are the review quiz `fillToLength` adds to a lecture deck (`AMENDMENTS-LECTURE-V2.md` section 4.2 rule 2), so a class day's lessons and its review fit the stated length (BL-OD-2).
- **Practice budget:** `B_P = T_P` (`blend.personal.minutes`: 5, 10, 15, 20, 30). Daily Review is outside the budget.
- **Packing** (`packSession(queue, budget)`, pure): take items in queue order while `running + m(item) <= budget`, where `m` is the catalogue minutes (`CatalogQuest.minutes`, `CatalogCell.minutes`, `CatalogStory.minutes`; the generator's `lookup.minutes`, `generate.ts:139-142`); the first item is always taken when the queue is not empty, so no session is empty while material remains (the existing `session-too-short` warning still fires for an item longer than 1.5 x the budget).
- **Proportionality (G3).** Items on a day ≈ `floor(B / m̄)`. In split mode the class days' share of a week's new minutes is `Σ B_L / (Σ B_L + Σ B_P)`; per day the ratio is `B_L : B_P`. Owner example: `26 : 10`, so a class day carries 2.6 times a practice day's material.

### 6.3 Calendar

- **Class days:** `blend.lecture.days` (weekdays, 1-5, required; the teacher picks them).
- **Default practice days** (`practiceDaysFor(lectureDays, P)`, pure, exported, 100 % covered): take the cycle of non-class weekdays starting the day after the first class day. With one class day, `n = 7 - L` candidates, pick index `floor(i * n / P)` for `i = 0..P-1`. With several class days, split the week into segments (the days after each class day up to the next one), give each segment `round(P * len / n)` days by largest remainder (each segment at least 1 while `P >= L`), and pick inside each segment with the same formula. When `P > n`, the remaining `P - n` go on class days, latest class day first.
- **Table (tested):**

| Class days | P | Practice days |
|---|---|---|
| Tue | 1 | Wed |
| Tue | 2 | Wed, Sat |
| Tue | 3 | Wed, Fri, Sun |
| Tue | 6 | Wed, Thu, Fri, Sat, Sun, Mon |
| Tue | 7 | Wed to Mon, plus Tue after class |
| Mon, Thu | 3 | Tue, Fri, Sun |

- The teacher may override the practice days in the wizard (weekday chips, the count fixed by P). Days off remove sessions of both tracks and never move them (F-PLAN-002 rule).

### 6.4 Spacing and review placement

- The first practice day after a class day is the next day (Leitner box 1: one day) whenever a non-class day exists; the second lands about 3 days after the class (box 2) in the 3-a-week default. In overlap mode the class's lessons go to the practice days in class order, so every lesson is first retrieved 1 to 5 days after it was taught, before the next class.
- Further spacing is Daily Review's: completing a quest on the device puts its letters and words in the Leitner boxes (F-CURR-002 section 4.3). The plan adds no review items.
- **Class review.** The class deck already ends with a 4-round quiz over the previous lessons (`fillToLength` rule 2); in overlap mode the lecture card's `next-lesson` deck for a class day is that day's lessons plus that quiz (section 10.3).

### 6.5 Worked examples (goldens C and D, BL-2)

Assumptions: 26 weeks (6 months) from a Monday, class on Tuesday 30 minutes, 3 practice days of 10 minutes, start Brand new, 5-minute lessons in cells of 3, no days off, `reviewEvery` 4 (the default for 12+ weeks).

| | Practise what class taught (overlap) | Class and practice cover different lessons (split) |
|---|---|---|
| Sessions a week | 4 (Tue class; Wed, Fri, Sun practice) | 4 (same days) |
| Class day | 5 lessons (25 min) + review quiz (4) = 29 min | 4 cell openers + 1 more lesson = 5 lessons (25 min) + quiz |
| Practice days | Wed 2 lessons, Fri 2, Sun 1 (+ a story of an opened cell when one fits) | Wed 2, Fri 2, Sun 2 different lessons (10 min each) |
| New lessons a learner plays alone a week | 5 (the class's lessons) | 6 (the rest of the week's packet) |
| New lessons a week in all | 5 | 11 |
| Items over 26 weeks (20 learn weeks after 6 review weeks) | about 100 | about 220, likely past the end of the shipped catalogue: the preview warns `content-runs-out` (and `item-cap` on a longer or denser plan) |
| Per-day ratio class : practice | 5 : about 2 | 5 : 2 |

The exact numbers come from the frozen catalogue fixture (`fixtures/catalog-2026-10.ts`); the goldens assert them, and the table above is regenerated from the goldens when BL-2 lands.

### 6.6 Caps and limits

- The params refinement keeps `weeks x distinct days <= 260` (`params.ts:93`).
- **Items:** the generator stops placing at `CURRICULUM_MAX_ITEMS` (260) and adds the new warning `item-cap` ("This plan is full at week {n}. Choose fewer weeks, or practise what class taught."). The schema cap does not change, so every app in the field still parses every plan.
- **Content runs out:** the existing `content-runs-out` warning, worded per track.
- **New warnings** (`WARNING_CODES` gains, additively): `item-cap`, `lecture-underfilled` (overlap: `B_L_eff` is below half of `B_L` because practice room is small; "Class days use about {m} of {t} minutes. Add a practice day, or let class and practice cover different lessons."), `practice-overfull` (a class day's lessons need more practice room than the week has; they carry into the next practice day).

## 7. What the learner sees (Class with practice)

All behind `flags.routeBlendEnabled` (app, default off until BL-10).

- **Route card, weekly plan line** (LR's line, F-ROUTE-001 section 3.9): "Your class's weekly plan: class on {weekday}, practice on {weekdays}." Weekday names come from `Intl.DateTimeFormat(locale, { weekday: 'long' })`, joined with the locale's list format. Two class days: "class on Tuesday and Thursday". No dates, no counts above 3 (weekdays are names, not counts), no countdown.
- **Homework and Home card (2).** Practice items with `lectureDate` carry the pill **From class** (the existing `assignedByLabel` "From class" pill is the teacher source; this one is a second, quieter tag: "Met in class" is the a11y label). Practice items in split mode carry the ordinary pill. Precedence, the three-row Today cap and the stacking exception are unchanged.
- **Class day on the device.** On a class day Home shows one calm line above card (2): "Class today." Nothing is assigned for the class itself; no question "Did you go?".
- **In class mark (split only, BL-OD-10).** Class-only lessons appear in the Route's week list under the class day with the **In class** mark: a solid outline glyph `class` with the text label, never a ring that fills, never counted in any meter, never in Homework. A learner may open the lesson from there like any open lesson (the curriculum is unlocked by entitlement as today).
- **Weekly goal ring.** Counts days with any practice or play; the target is the plan's distinct days (section 6.1). A class day counts when the learner plays anything that day; the class itself never counts (the presenter writes nothing).
- **Own plan paused** (section 8): Profile's weekly plan row reads "Your own weekly plan is resting while your class's plan has practice days." with **See it** (read-only overview). Never "stopped" or "cancelled".
- **Accessibility:** every tag and mark has text; screen readers read "From class", "In class", "Class today"; contrast and size per tokens; the weekday list is one text node.

## 8. The own weekly plan and the family's (harmonising sources)

- **Paused, not archived (BL-OD-5).** While the layer is `class-with-practice`, `sourcesOf` (`plan-derivation.ts:70-76`) leaves the active self-route out (a pure `pausedBy` check, no stored state). Its pending assignments stay in `snapshot.homework` but are hidden from Home and Homework (filtered by the `route:` prefix while paused); none is removed, and none is marked late.
- **Resume.** When the blended class plan ends or the learner leaves the class, the next derivation includes the self-route again and runs `repaceSelfRoute` once (`requeue`, F-PLAN-002 section 3.7), so its remaining lessons start from today, minus anything the learner finished meanwhile. The Hoya line "Your own weekly plan is back." shows once.
- **Proposal.** `proposeRoute` for a self plan excludes the quests any in-force class or school curriculum has scheduled (every inbox curriculum's items, not just finished ones; BL-6), so a new own plan never duplicates the class. While the layer is `class-with-practice` the proposal is not offered (Home prompt and Profile row say "Your class's weekly plan has practice days for you." instead), and **Make a weekly plan** stays reachable from Profile for a learner whose class plan ends soon (it starts the day after the class plan's last day).
- **Family weekly plan (BL-OD-6).** A family plan is a grown-up's choice and is not paused automatically. The family console's learner card shows "{name}'s class has practice days on {weekdays}." and offers **Pause the family weekly plan while class runs** (sets the family plan's `targetLearnerIds` to exclude the learner, an existing field, no new state; **Resume** reverses it). Until the parent acts, both derive by today's precedence (class first).
- **Class only layer.** Nothing changes, except the proposal's exclusion rule above.

## 9. Data, API and sync (additive; no migration)

### 9.1 Params (`curriculum/params.ts`, BL-W)

```ts
export const BlendSchema = z.object({
  mode: z.enum(['overlap', 'split']),
  lecture: z.object({
    days: z.array(WeekdaySchema).min(1).max(5),
    minutes: z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]),
  }),
  personal: z.object({
    perWeek: z.number().int().min(1).max(7),
    /** Teacher's default practice weekdays; length = perWeek when present (else practiceDaysFor). */
    days: z.array(WeekdaySchema).min(1).max(7).optional(),
    minutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  }),
});
// paramsShape gains:  blend: BlendSchema.optional()   (audience 'class' only; refinement 'blend-not-class')
```

Refinements: `blend` only with `audience: 'class'`; class and practice days distinct unless `perWeek > 7 - days.length`; `personal.days.length === perWeek` when present. When `blend` is present the generator writes `sessionsPerWeek` = distinct days, `sessionDays` = their union and `minutesPerSession` = `personal.minutes`, so any reader that ignores `blend` (an old app, an old console) sees a valid single-cadence plan.

### 9.2 Items (`schemas/plan-item.ts`, BL-W)

```ts
track: z.enum(['lecture', 'personal']).optional(),   // absent = today's single-track item
lectureDate: DateKeySchema.optional(),               // overlap: the class day that taught it
```

Refinement: `lectureDate` only with `track: 'personal'`; `track: 'lecture'` items need `targetDate`. `GENERATOR_VERSION` becomes 2; a v1 plan never has these fields.

### 9.3 Worker, inbox and capability (BL-W)

- `PlanSchema`, `PlanUpsertSchema`, `InboxPlanSchema`, `SelfRouteSchema` (items) and `HomeworkAssignmentSchema` (gains `fromClass: z.boolean().optional()`, BL-6 writes it) accept the new fields. Deploy the Worker **before** the console can publish a blended plan (BL-4) and before an app reads one (BL-6); zod would otherwise strip them on save.
- **Inbox (`routes/sync.ts:185-208`):** a new capability `?cap=blend`. A blended plan reaches an app that sends `cap=blend` unchanged. An app that sends `cap=curriculum` but not `cap=blend` gets the **projection**: `track: 'lecture'` items removed, other items as stored (the unknown keys are stripped by its parser), `meta.params.blend` left in (stripped by its parser). The old app then derives exactly the practice items on their dates with the right weekly count, and never assigns a class-day-only lesson as homework. An app with neither capability gets no curriculum, as today.
- `inboxPlansFor` keeps its rules (published, unarchived, targeted). The 409 `curriculum_needs_new_plan` rule is unchanged; a published curriculum may gain or lose `blend` (section 14).
- Roster and `planProgress` are unchanged in shape; `planProgress` counts derived assignments, so class-day-only items never enter it.
- **No D1 migration:** `plans.items_json` and `plans.meta_json` (`0006_plan_meta.sql`) carry the new keys. If a later row needs a table, it takes the next free migration number when it opens (`scripts/check-migrations.mjs` enforces unique prefixes).

### 9.4 Device (BL-6)

- `platform/sync-api.ts` `getInbox` adds `cap=blend` in the same build that understands it.
- `deriveAssignments` skips `track: 'lecture'` items (they are neither derived nor counted in `notReady`), copies `fromClass: lectureDate !== undefined` onto the assignment, and otherwise runs rules 1-4 unchanged (horizon 7 days, reconcile, precedence, ids `plan:<id>#<questId>`).
- `planDaysInForce` per section 6.1. `layerOf` and the pause rule per sections 3.2 and 8.
- **Learner practice days (BL-8, BL-OD-7):** `snapshot.practiceDays?: { planId, days: Weekday[], updatedAt }[]` (additive, at most 3 entries, one per class plan; Worker preserve rule: an absent key never erases a stored one; merge by newest `updatedAt`). `placePractice(items, practiceDays)` re-dates the plan's practice items **on the device only**: the week's practice items keep their order and are packed into the learner's days by `B_P` (more days = fewer per day; fewer days = more per day, never dropped). The console never sees the learner's days (no field in the summary except the count in section 11).

### 9.5 Offline

- The generator, `practiceDaysFor`, `packSession` and `placePractice` are pure and bundled; the wizard preview and every device rule run offline.
- Derivation still re-runs at app start, on foreground and when the inbox fails (F-PLAN-002 section 3.6), so a class day crossing midnight offline moves practice items into the horizon on time.
- The presenter's `next-lesson` on `/present` (no console) is unchanged (N4: Recent lessons); the class-day pick of section 10.3 needs the console's plan and therefore the network, as "Present this plan" does today.

## 10. Console (teacher)

### 10.1 Wizard: "How does this class meet?" (BL-4; `lib/console/curriculum.ts`, wireframe `design/wireframes/console/curriculum-wizard.md` section "Meeting", BL-D)

A new first part of step 2 (Length and rhythm), class audience only, behind `routeBlendEnabled()` (`NEXT_PUBLIC_ROUTE_BLEND_ENABLED`, default off):

1. **How does this class meet?** Two cards: **Class days only** (today's flow, unchanged: class day + homework day chips) and **Class days and practice days** ("Learners also practise on their own between classes.").
2. **Class days:** weekday chips (1-5) and **Class length** chips 15, 20, 30, 45, 60 min (default 30).
3. **Practice on their own:** **Days a week** chips 1-7 (default 3) and **Minutes each time** chips 5, 10, 15, 20, 30 (default 10; 5 when pictures-first, `PICTURES_FIRST_MINUTES`). The suggested practice weekdays show as preselected chips ("Suggested: Wed, Fri, Sun"), changeable.
4. **How do class and practice fit together?** Two radio cards: **Practise what class taught** (default, tagged *Suggested*; "Each class's lessons come back on the practice days after it.") and **Class and practice cover different lessons** ("Class brings the first lesson of each group; practice days take the next ones. Covers more, faster.").
5. **Length and pace.** The length chips (4 weeks, 12 weeks, 6 months, Choose weeks) stay; the pace chips are hidden for a blended plan (the cadence is the meeting frame).

`defaultsFor('class', ...)` gains `meeting: 'class-only'` (unchanged default until BL-OD-12's flip; then `'class-and-practice'`), `blendMode: 'overlap'`, `lectureDays: []`, `lectureMinutes: 30`, `practicePerWeek: 3`, `practiceMinutes: 10`. `toParams` writes `blend` per section 9.1.

### 10.2 Preview and readout

- **Preview header:** "About 4 a week: 1 class day (30 min) and 3 practice days (10 min each). Class days carry about 5 lessons; practice days about 2." The numbers come from the draft's new stats: `stats.byTrack = { lecture: { sessions, items, minutesPlanned }, personal: { ... } }`, `stats.sessionsPerTeachingWeek`, `stats.sessionsPerCalendarWeek` (rounded to one decimal).
- **Week table:** each week row splits into a **Class** cell (date, lesson titles) and a **Practice** cell (weekdays, lesson titles; in overlap mode headed "Practising: {class lessons}"). Tables keep header cells and row scope (F-PLAN-002 section 3.11).
- **Readout (published):** the This week block shows the class day's lessons first, then practice as the existing class aggregate `done / so far` (counts only, learners in activity order, no ranking). A line "Class days so far: {n} of {N}" counts **scheduled** class dates up to today, never attendance.
- **Move this class day** (BL-4, BL-OD-8): on the readout, next to Re-pace from today. It runs `regenerateFrom(plan, today, catalog, { mode: 'shift', track: 'lecture', from: <class date> })` (BL-3): that class day's lessons and every later class day move to the following class days; in overlap mode their practice items move with them (practice dates recomputed by section 6.3); in split mode practice items stay unless their cell opener moved past them, then they move to the first practice day after the new opener date. The plan id stays; devices reconcile on the next sync (rule 2).
- **Add practice days to this plan** (migration, section 14): on a published class-only curriculum.

### 10.3 Lecture mode on a blended plan (BL-5)

- `planOutline(plan, today)` (`lib/console/lecture.ts:94-107`): for a blended plan the outline is **the class day's items**: the items with `track: 'lecture'` and `targetDate` = the next class date on or after today (split), or the personal items whose `lectureDate` is that date (overlap), in plan order; before the route the first class day, after it the last. A classic or single-track curriculum keeps today's rule.
- `next-lesson` N1 builds from that outline, then `fillToLength(..., review: true)` with the plan's class length as the default chip (15/20 -> 20, 30 -> 30, 45/60 -> 30 with the outline kept whole up to `LECTURE_MAX_BLOCKS`; the length chips stay 10/20/30). The title stays the plan title rule.
- The presenter, its isolation test and `lecture.complete` are unchanged: no plan, space or deck id is sent.

## 11. Reports and grown-up views

- **F-REPORT-001 plans block:** for a blended plan, `{assigned, started, finished, itemsDone}` counts practice items only (they are the only derived items). The block's line names the plan "Your class's weekly plan (class and practice)" on grown-up views.
- **Teacher (class roster, readout):** the class aggregate of practice (`done / so far`), the class-days-so-far line (scheduled, not attended), no per-learner practice-day list, no learner sorted or compared. Class viewers never see `selfRoute` or the learner's chosen practice days (`spaces.ts:581` redaction stays).
- **Parent (family space, BL-9):** the child card's class line (GX-4) gains the meeting words: "In: {class} · class on {weekday}, practice {n} days a week". The device writes a family-only summary field `summary.practiceWeek = { classDays, practiceDays, practicedDays }` (whole numbers 0-7; `practicedDays` = days this plan week with a finished practice item), redacted from class rosters like `selfRoute`. The report's 7-day squares already show the days practised; `practiceWeek` adds the line "Practised on {practicedDays} of {practiceDays} practice days this week" on the grown-up report only (fill only, never "missed"; BL-OD-11).
- **School admin:** unchanged aggregates; a blended class plan counts in `classesWithPlan`.
- **Minutes:** `minutesLast7d` (F-REPORT-001) keeps counting quest, story, game and level-check time; class runs add nothing.

## 12. Edge cases

### 12.1 A class day that does not happen

- **The teacher skips or moves it:** **Move this class day** (section 10.2). Nothing else is required; the plan never asks "did class happen?" by default (BL-OD-8).
- **The teacher does nothing:** the plan stays as published. In overlap mode the learners' practice items arrive as planned and each quest teaches itself, so practice still makes sense; the next class can open with the `class-review` preset.
- **A learner is absent:** nothing is recorded and nothing changes on that learner's device. Practice items arrive as for everyone; the "From class" tag stays (it names where the lesson belongs in the plan, not who attended).

### 12.2 A learner moves classes, joins late or leaves

- **Move (F-SPACE-002):** the old class's plan leaves the inbox; its pending practice items are dropped and finished ones stay (rule 2). The new class's plan derives from today; lessons the learner already finished show done on any date (`plan-derivation.ts:183-189`). Practice days the learner had moved for the old plan are discarded with it (`practiceDays` keyed by plan id).
- **Join mid-term:** derivation includes earlier practice items (past-dated items are not bounded by the horizon); the three-row Today cap and the "A few to do today" words apply (F-PLAN-002 section 3.6 review amendment). No count, no "catch up".
- **Leave every blended class:** the layer becomes Solo or Class only; the own plan resumes (section 8).
- **Two blended classes:** both derive; the newest teacher plan leads Route and `routeNext`; the weekly goal counts the union of days (section 6.1).

### 12.3 Class-scoped devices (school labs)

A class-scoped device receives class plans only (`sync.ts:192, 208`). Practice days work on it unchanged; the own plan does not exist there. `practiceDays` belongs to the profile on that device.

### 12.4 Free learners

Unchanged entitlement rules: lessons outside `unlockedStages` are never scheduled (listed for the console as today). A practice item a learner cannot open counts as not ready, and learner screens show F-ENT-003's words only.

## 13. Anti-shame, privacy and safety

- No learner screen shows: a count above 3, a date to the goal, the words in the standing rules, attendance, another learner, or a comparison. "From class", "In class" and "Class today" are neutral facts.
- The teacher's readout counts **scheduled** class days and **class-total** practice; never a per-learner practice list, never a ranking.
- The parent's line fills only; its words never say what was not done.
- No new identifier leaves the device: `practiceDays` rides the snapshot (sync, backup, Rescue Code) like `selfRoute`; the summary gains counts only, family-only.
- A child's practice days change only through the grown-up gate (`planChangesOpen`, OD-17); a self learner changes them directly.
- Copy tests: every new key passes `isCaregiverSafe` and the anti-shame list in en, es and ko (the existing curriculum copy test, extended).

## 14. Migration of existing plans and launch

- **Existing plans are untouched.** Every plan published before BL-4 has no `blend`; solo and class-only generation is unchanged (goldens A and B unchanged; generator v1 plans keep `generatorVersion: 1`).
- **Upgrade path (BL-4):** a published class-only curriculum shows **Add practice days to this plan**. It opens the meeting step prefilled (class days from the plan's `sessionDays` minus the homework day, when the teacher's original pick is recoverable; else empty), and saves with `regenerateFrom(plan, today, catalog, { mode: 'shift', params: <with blend> })` (BL-3): past items stay, future items are re-laid as a blended plan, same plan id. Devices reconcile on the next sync; old apps get the projection (section 9.3).
- **Back to class only:** **Stop practice days** re-lays the future without `blend` the same way.
- **Self routes and family plans:** untouched; self routes pause only while a blended plan is in force.
- **Flags:** console `routeBlendEnabled()` (`NEXT_PUBLIC_ROUTE_BLEND_ENABLED`) gates the wizard's meeting step, the readout controls and the lecture class-day pick; app `flags.routeBlendEnabled` (`EXPO_PUBLIC_ROUTE_BLEND_ENABLED`) gates the learner tags, lines and the practice-days setting. Derivation (skip class-day items, `cap=blend`, pause the own plan, weekly goal) is **not** flagged: it must be right the moment any blended plan exists. Both flags default off; BL-10 flips both after its e2e (BL-OD-12).
- **Rollback:** once a blended plan is published, the Worker is not rolled back below BL-W (an older Worker would strip `track` and old apps would derive class-day items as homework). Recorded in `docs/launch/owner-runbook.md` by BL-W.

## 15. Amendments to sibling specs (applied in the rows named)

| Id | Spec, section | Change | Row |
|---|---|---|---|
| BL-A1 | F-PLAN-002 section 4 | The non-goal "mixing a class plan and a self-route into one list" gains: "A class plan may hold practice days and pauses the own plan while in force: `AMENDMENTS-ROUTE-CLASS-BLEND.md`." | BL-0 (this PR) |
| BL-A2 | F-PLAN-002 sections 3.1, 3.3, 3.5 | `blend` params, item `track` / `lectureDate`, the blended path with minutes packing, `?cap=blend`, new warnings | BL-W, BL-2 |
| BL-A3 | F-PLAN-002 sections 3.7, 3.8, 3.10 | Move this class day; the meeting step; pause rule and proposal exclusion | BL-3, BL-4, BL-6 |
| BL-A4 | AMENDMENTS-LECTURE-V2 section 4.2 N1; F-TCH-004 section 3.11 | Class-day outline for blended plans | BL-5 |
| BL-A5 | F-ROUTE-001 section 3.9 (as amended by LR) | Weekly plan line with class and practice weekdays; From class; In class | BL-7 |
| BL-A6 | F-REPORT-001 plans block | Practice items only; parent practice-week line | BL-9 |

## 16. PR table

Each row is one reviewable PR, TDD, en + es + ko for every string it adds, multi-agent reviewed before merge.

| PR | Content | Size | Needs |
|---|---|---|---|
| **BL-0** | `docs(specs)`: this amendment; BL-A1 pointer in F-PLAN-002 section 4; README index line and glossary words | S | — |
| **BL-D** | `docs(design)`: wireframes: console wizard "Meeting" part, preview week table with Class / Practice cells, readout with Move this class day; learner Route weekly plan line, From class tag, In class mark, Class today line, own plan resting row, practice-days setting; parent card class line. Mocks in `design/screens/route-blend/` at 320 and 1280, en / es / ko | S | BL-0 |
| **BL-W** | `feat(content-schema,backend)`: `BlendSchema`, `paramsShape.blend` and refinements; `PlanItem.track` / `lectureDate`; `HomeworkAssignment.fromClass`; `snapshot.practiceDays` with its preserve rule; `summary.practiceWeek` (family-only redaction); new `WARNING_CODES`; `?cap=blend` and the projection in `inboxPlansFor`; schema, inbox and redaction tests; runbook rollback line; telemetry names of section 18 with exact-list tests. **Deploy the Worker before BL-4 and BL-6 reach users** | M | BL-0 |
| **BL-1** | `feat(content-schema)`: `practiceDaysFor`, `packSession`, `blendSessionsOf` (distinct days), table tests of section 6.3, property tests (every practice day after a class day when possible; distinct days `<= 7`) | S | BL-W |
| **BL-2** | `feat(content-schema)`: `generateCurriculum` blended path (`GENERATOR_VERSION` 2 for blended plans only): budgets, overlap and split, the cell-opener invariant, review / culture / break weeks, `stats.byTrack`, `sessionsPerTeachingWeek` / `sessionsPerCalendarWeek`, warnings; goldens C (overlap) and D (split) on the frozen fixture; goldens A and B unchanged; property tests (G2 count per week; G3 proportionality; no item lost; invariant) | M | BL-1 |
| **BL-3** | `feat(content-schema)`: `regenerateFrom` gains `track: 'lecture'` + `from` for Move this class day, and a `params` override for add / stop practice days; tests including "nothing done is moved or lost" | S | BL-2 |
| **BL-4** | `feat(web,i18n)`: wizard meeting step, defaults, `toParams`, preview header and week table by track, readout lines, Move this class day, Add practice days / Stop practice days, `routeBlendEnabled()`; `console.curriculum.blend.*` keys | L | BL-3, BL-D, BL-W deployed |
| **BL-5** | `feat(web)`: `planOutline` class-day rule; `next-lesson` N1 default length from the plan; lecture card line "Class day: {weekday} · {n} lessons"; tests on goldens C and D | S | BL-2 |
| **BL-6** | `feat(mobile)`: `cap=blend`; derivation skips class-day items and writes `fromClass`; `layerOf`; own-plan pause and resume; `planDaysInForce` distinct and union rules; `proposeRoute` excludes class-scheduled quests; reconcile tests (move, join, leave, two classes) | M | BL-W deployed, BL-1 |
| **BL-7** | `feat(mobile,i18n)`: Route weekly plan line, From class tag, In class mark (split), Class today line, own plan resting row and proposal line; `learner.route.blend.*`, `a11y.route.blend.*` keys; screen tests at 320 x 568; behind `flags.routeBlendEnabled` | M | BL-6, BL-D |
| **BL-8** | `feat(mobile,i18n)`: practice-days setting (Profile -> weekly plan; chips 1-7 and weekdays; grown-up gate for a child), `placePractice`, `snapshot.practiceDays` write and merge, `route.practice_days_changed` | M | BL-7, KT-1 (#943) merged |
| **BL-9** | `feat(mobile,web,i18n)`: device writes `summary.practiceWeek`; parent card class line words; report plans block practice-only and the practice-week line; teacher readout class aggregate; redaction test (class roster never has the field) | M | BL-6, BL-W deployed, GX-4 (#937) and GX-11 (#942) merged |
| **BL-10** | `test(e2e)` + flag flip: `apps/web/e2e/route-blend.spec.ts` (wizard to publish to readout to Present this plan on the class day; overlap and split), `apps/mobile/e2e/web/route-blend.spec.ts` (old-app projection with `cap=curriculum`; new app tags; own plan resting; weekly goal 4); en / es / ko screenshots; then `NEXT_PUBLIC_ROUTE_BLEND_ENABLED` and `EXPO_PUBLIC_ROUTE_BLEND_ENABLED` default on | S | BL-4, BL-5, BL-7, BL-8, BL-9 |

**Order.** BL-0, then BL-D and BL-W in parallel; BL-1 -> BL-2 -> BL-3; BL-5 after BL-2; BL-6 after the BL-W deploy and BL-1; BL-4 after BL-3 and the deploy; BL-7 -> BL-8; BL-9 after BL-6 and the GX rows; BL-10 last.

**Total:** 12 rows (one design row, one Worker row), one Worker deploy, no D1 migration, no new endpoint (one new inbox capability).

## 17. Owner decisions (each has a default that applies until answered)

| Id | Question | Default | Alternative | Gates | Reversible |
|---|---|---|---|---|---|
| BL-OD-1 | Which blend mode is preselected? | **Practise what class taught** (overlap), tagged *Suggested* | Class and practice cover different lessons (split) preselected | BL-4 | yes (one default) |
| BL-OD-2 | Does a class day keep room for its review quiz? | **yes**: `B_L = T_L - 4` from 20 minutes up, so the lessons and the quiz fit the class length | the whole class length holds lessons; the quiz runs over time | BL-2 | yes (one constant) |
| BL-OD-3 | In overlap, may practice days pull new lessons when the class's lessons are placed and room is left? | **no**: stories of opened cells only, else free practice and Daily Review | yes: the next lessons in order (covers more; the next class may re-teach what some met alone) | BL-2 | yes |
| BL-OD-4 | In split, must class open each lesson group before practice uses it? | **yes** (the cell-opener invariant) | pure minutes split in route order | BL-2 | yes |
| BL-OD-5 | What happens to a learner's own weekly plan while a class plan with practice days is in force? | **paused, kept, resumes re-paced** when the class plan ends | both run as today (class first); or the own plan is archived | BL-6 | yes |
| BL-OD-6 | And a family weekly plan for that child? | **keeps running**; the parent gets a one-tap **Pause the family weekly plan while class runs** | paused automatically like the own plan | BL-6, BL-9 | yes |
| BL-OD-7 | May a learner change their practice days? | **yes**: days and count (1-7) on the device; a child through the grown-up gate; the lessons never change | the teacher's days only | BL-8 | yes |
| BL-OD-8 | Ask the teacher "Did class happen?" after a class day? | **no**: Move this class day is always there; nothing asks | a one-line prompt on the readout the day after each class day | BL-4 | yes |
| BL-OD-9 | Do Solo and Class-only plans also pack sessions by minutes? | **no**: unchanged, one item per session (no existing plan changes) | minutes packing for every new plan (generator v2 for all) | BL-2 | yes, for new plans |
| BL-OD-10 | Show class-only lessons (split) to learners? | **yes**, as the neutral **In class** mark under the class day, never a to-do, never counted | hide them from learner screens | BL-7 | yes |
| BL-OD-11 | Does the parent see practice days kept this week? | **yes**: family-only `summary.practiceWeek`, a fill-only line on the grown-up report | no new field; the 7-day squares only | BL-W, BL-9 | yes (drop the field) |
| BL-OD-12 | Launch | **flip both flags in BL-10** after its e2e and the multi-agent review; the wizard's first card stays **Class days only** for one release, then **Class days and practice days** becomes the default card | owner approval before the flip | BL-10 | yes |
| BL-OD-13 | Class lengths offered | **15, 20, 30, 45, 60 minutes** (default 30) | 10 to 30 only, like the lecture chips | BL-W, BL-4 | yes |
| BL-OD-14 | UI names | **Class day** / **Practice day**; modes **Practise what class taught** / **Class and practice cover different lessons** | "Lesson day" / "Study day" | BL-D, BL-4, BL-7 | yes (strings) |

**Assumptions to verify:**

| # | Assumption | Verified in |
|---|---|---|
| a | Catalogue minutes are close to real play time for a typical lesson (about 5 minutes), so packing by them gives honest days | BL-2 (compare with `minutesLast7d` medians from F-REPORT-001 rollups, aggregates only) |
| b | An old app with only `cap=curriculum` derives the projection correctly (practice items only, right dates, weekly goal from `sessionsPerWeek`) | BL-W unit test on the old schema; BL-10 e2e with an old-build fixture |
| c | The meeting step fits 320 px with 200 % text without sideways scroll | BL-D mock, BL-4 e2e |
| d | Practice-day words with three weekday names fit the Route card at 320 x 568 in es and ko | BL-D, BL-7 |

## 18. Telemetry (Worker first, BL-W; app only, the console has no telemetry client)

Section **T** of `docs/roadmap/TELEMETRY-NAMES-2.md` (the next free letter when BL-W opens):

| # | Name | Payload | Added by | Emitted by |
|---|---|---|---|---|
| 1 | `route.practice_days_changed` | `{ days: 1-7, by: 'self' \| 'grownup' }` | BL-W | BL-8 |

Payload widenings of existing names (no Worker change: these names have no payload allowlist): `route.next_started` gains `fromClass: boolean` (BL-7); `route.created` is unchanged. No plan id, space id, weekday list, date or learner id is sent. Blended plan counts for the owner come from D1 (`plans.meta_json`) as aggregate queries, not from telemetry.

## 19. Strings (draft English; en, es and ko land with each row)

Console (`console.curriculum.blend.*`, BL-4): `meeting.title` "How does this class meet?" · `meeting.classOnly` "Class days only" · `meeting.withPractice` "Class days and practice days" · `meeting.withPracticeHint` "Learners also practise on their own between classes." · `classDays` "Class days" · `classLength` "Class length" · `practice.title` "Practice on their own" · `practice.days` "Days a week" · `practice.minutes` "Minutes each time" · `practice.suggested` "Suggested: {days}" · `mode.title` "How do class and practice fit together?" · `mode.overlap` "Practise what class taught" · `mode.overlapHint` "Each class's lessons come back on the practice days after it." · `mode.split` "Class and practice cover different lessons" · `mode.splitHint` "Class brings the first lesson of each group; practice days take the next ones. Covers more, faster." · `preview.header` "About {total} a week: {classDays} class day(s) ({classMin} min) and {practiceDays} practice days ({practiceMin} min each)." (ICU plural forms) · `preview.perDay` "Class days carry about {classItems} lessons; practice days about {practiceItems}." · `preview.average` "{sessions} sessions in all, {teaching} a teaching week." · `readout.classDays` "Class days so far: {n} of {total}" · `readout.move` "Move this class day" · `readout.addPractice` "Add practice days to this plan" · `readout.stopPractice` "Stop practice days" · `warn.itemCap`, `warn.lectureUnderfilled`, `warn.practiceOverfull` (section 6.6) · `lecture.classDay` "Class day: {weekday} · {n} lessons" · `family.classLine` "In: {class} · class on {weekday}, practice {n} days a week" · `family.pause` "Pause the family weekly plan while class runs" · `family.resume` "Resume the family weekly plan" · `report.practiceWeek` "Practised on {done} of {days} practice days this week".

Learner (`learner.route.blend.*`, BL-7 and BL-8): `planLine` "Your class's weekly plan: class on {classDays}, practice on {practiceDays}." · `fromClass` "From class" · `inClass` "In class" · `classToday` "Class today." · `ownResting` "Your own weekly plan is resting while your class's plan has practice days." · `ownBack` "Your own weekly plan is back." · `proposalInstead` "Your class's weekly plan has practice days for you." · `practiceDays.title` "My practice days" · `practiceDays.hint` "Pick the days you practise. Your lessons stay the same." Accessibility (`a11y.route.blend.*`): `fromClass` "Met in class", `inClass` "Taught in class", `practiceDay` "Practice day, {weekday}".

Every key passes the anti-shame copy test in all three locales; Korean uses the existing glossary (수업 for class, 연습 for practice); Spanish uses *clase* and *práctica*.

## 20. Tests

| File | Level | Covers |
|---|---|---|
| `content-schema/src/__tests__/curriculum-blend-params.test.ts` | unit | schema bounds, refinements, written `sessionsPerWeek` = distinct days |
| `…/practice-days.test.ts` | unit | section 6.3 table; segments; `P > 7 - L` |
| `…/curriculum-golden.test.ts` (extend) | golden | C overlap, D split; A and B byte-identical |
| `…/curriculum-blend.property.test.ts` | property | sessions per week = L + P minus days off; per-day items proportional to budget within one item; no item lost or duplicated; split invariant; overlap: every class item has a practice date before the next class day when room allows |
| `backend/src/__tests__/inbox-blend.test.ts` | integration | `cap=blend` full plan; `cap=curriculum` projection; no cap: absent; redaction of `practiceWeek` from class rosters |
| `apps/mobile/src/logic/homework/__tests__/plan-derivation.blend.test.ts` | unit | class items skipped; `fromClass`; pause and resume; move, join, leave, two classes |
| `apps/mobile/src/logic/goals/__tests__/plan-days.test.ts` (extend) | unit | distinct days; union of two blended plans; learner practice days |
| `apps/web/src/lib/console/__tests__/curriculum-blend.test.ts`, `lecture.test.ts` (extend) | unit | wizard defaults and `toParams`; class-day outline |
| `apps/web/e2e/route-blend.spec.ts`, `apps/mobile/e2e/web/route-blend.spec.ts` | e2e | BL-10 |

## 21. Review log

- **BL-0 (this PR).** Written from a code survey of `1bfda3fc8` (generator, params, derivation, merger, weekly goal, lecture outline, inbox gate) against the owner request of 2026-11-03. Open questions are the BL-OD rows; none blocks BL-W, BL-1 or BL-2.
