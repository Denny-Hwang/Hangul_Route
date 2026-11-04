Status: ready (spec pass BL-0, revised after the first multi-agent review, section 21; amends F-PLAN-002, F-ROUTE-001 as amended by `AMENDMENTS-ROUTE-LEARNING-ROUTE.md`, F-TCH-004 as amended by `AMENDMENTS-LECTURE-V2.md`, and F-REPORT-001; implementation rows in section 16; owner decisions in section 17, each with a default that applies until answered)

# Amendment: class days and practice days — one Learning Route for a class that meets and learners who practise on their own

> Basis: `origin/main` `1bfda3fc8` (2026-10-30). Every `file:line` below is at that commit unless it names an open PR. Open PRs this amendment touches only by reference: #896 and #898 (two volumes per cell: `CatalogCell.episodeIds`, route days, the lecture chooser), #917 and its rows (GX, the grown-up UX amendment; in particular GX-11 #942, the child card week line), #930 (KT, the forgiving tap). No row here edits a file those PRs change before they merge; where a row needs their result it says so in its **Needs** column.

**Owner request 2026-11-03 (translated from Korean):** "A student's personal learning route and the teacher's lecture-mode plan can overlap. When, in one class, students have a personal study plan (1-7 times a week) and the teacher has a lecture plan (once a week or more), these must be properly separated and harmonised. So the Learning Route design must be layered by persona: a student studying alone (self-study), and a student in a class or school where lectures and personal study happen together. When lectures and study happen together, route planning must allow either overlapping lecture and study content, or splitting into lecture material and personal-study material. If students study personally 3 or more times a week and have one lecture a week with the teacher, then over the route period (e.g. 6 months) the route must be distributed to average 4 sessions a week (1 lecture + 3 personal). And because lecture time and personal study time can differ in weight, the amount of learning distributed must differ too: if a lecture is 30 minutes and personal study is 10 minutes per session, the plan must put more of the teaching material on lecture days."

**How each sentence of the request is met** (each row names the section and the test that holds it):

| Owner sentence | Reading in this spec | Section | Test |
|---|---|---|---|
| Personal route and lecture plan can overlap; separate and harmonise them | One class plan holds both kinds of session; the learner's own plan rests while it is in force; in the Class only layer an own plan never repeats a class lesson. Fully solved in the **Class with practice** layer; the Class only layer gets the dedupe only | 3.2, 8 | `plan-derivation.blend.test.ts` (pause, dedupe) |
| Layer by persona: alone, or lectures and study together | Three layers: Solo, Class only, Class with practice | 3 | `layer.test.ts` |
| Allow overlapping or split content | Two modes: Practise what class taught (overlap), Class and practice cover different lessons (split) | 5 | goldens C, D |
| Personal 1-7 times a week, lecture once a week or more | `P` practice sessions 1-7 a week (0 = Class only), `L` class days 1-5. Practice goes on non-class days first; only when `P > 7 - L` does a class day also hold a practice session, after class, with earlier classes' lessons or a Refresh (BL-OD-19). So 1 class + 7 practice is practice every day, class day included | 6.1, 6.3, 10.1 | `curriculum-blend-params.test.ts`, `practice-days.test.ts` |
| 3 personal + 1 lecture averages 4 a week over e.g. 6 months | Every class cycle holds `L + P` sessions, each with something to do (review weeks included); 26 weeks = 104 sessions; days off reported, and **Keep the average** can extend the route | 6.1, 5.3 | property "every session has content", golden C |
| Lecture 30 min, personal 10 min: more teaching material on lecture days | Each day's material is sized by its minutes (class days at a class pace); a class day always carries at least what a practice day carries | 6.2 | property G3 on 1+1, 1+3, 2+3, 3+4 (and `practice-short` on 2+1, 5+2), goldens C, D |

Two deliberate readings, stated plainly: (1) the practice frequency is set per class by the teacher; a learner (or a grown-up) may move their own practice **days** and change the count (BL-OD-7), but the **amount** of material per learner is the class's (a per-learner amount is BL-OD-17). (2) "More material on class days" means more **new** material is taught on class days; practice days then let each learner play that material on their own device, because only device play enters the memory model (section 6.4).

**Standing rules that apply here:**
- Any age: no age wording on shared surfaces.
- Child safety: grown-up gate on a child's plan changes (F-PLAN-002 OD-17), local-first data, no learner name or profile id in any URL or telemetry payload, learners never sign in.
- Anti-shame: no ranking, no comparison between learners, meters only fill, no count above 3 on learner screens, no dates or countdowns to the goal on learner screens, never "behind", "late", "missed", "overdue", "failed", "incomplete" or the F-PAR-001 section 3.6 phrases, in any locale.
- Strings: every UI string goes through `packages/i18n`; en, es and ko land in the same PR; design tokens only; no emoji. No copy claims review by a native speaker or a human expert.
- Commerce: no price, product name, "Premium" or ask-a-grown-up prompt on learner screens; Stripe stays in sandbox.
- Data: D1 changes additive only (this amendment adds **no** migration); the Worker deploys before any console or app build that writes or reads a new field.
- The presenter still writes no learner progress (F-TCH-004 section 3.9 is unchanged).

**Ids.**
- `BL-An` amends a section of a sibling spec (section 15).
- `BL-n` is a PR row (section 16). `BL-W` is the Worker-first row.
- `BL-OD-n` is an owner decision (section 17).
- F-PLAN-002's ids (P2-n, OD-n, FP-Bn), F-ROUTE-001's (R-n, LR-n, LR-OD-n) and the lecture specs' (LV-n) keep their meaning.

**Glossary (UI words; also proposed for the `docs/specs/README.md` glossary by BL-0).**
- **Class day**: a dated session where the teacher teaches the class together, usually with the presenter (lecture mode).
- **Practice day**: a dated session the learner does alone on their own device.
- **Class cycle** (spec word only): a class day and the days up to the day before the next class day. Every packing rule works per cycle, never per calendar week.
- **Refresh** (UI word): on a practice day, a short look back at what earlier classes taught, played with the existing Cell Check or Daily Review (section 6.4).
- **Class weekly plan with practice days** ("blended plan" in code and in this spec only, never in UI copy): a class (or a school's class) curriculum that holds both kinds of day.
- **Practise what class taught** (code `mode: 'overlap'`) and **Class and practice cover different lessons** (code `mode: 'split'`): the two ways the teacher can join the two tracks.
- **Weekly plan** keeps its meaning (any dated curriculum plan, F-PLAN-002 OD-7). "Lecture" is never a UI word: the console says "class day", the learner app says "class".

---

## 0. Summary

1. **Three persona layers, one generator.** A learner's route is planned in one of three layers (section 3): **Solo** (self-study: the learner's own weekly plan or a family's), **Class only** (today's class weekly plan, plus one dedupe rule) and **Class with practice** (new: class days plus practice days in one plan). The teacher picks the layer per class by one number, practice days a week (0 = Class only); Solo applies whenever no class plan is in force.
2. **Sessions add up, and every session has something in it.** A class with 1 class day and 3 practice days plans **4 sessions in every class cycle** for the whole route (26 weeks = 104 sessions). A practice day with no new lesson (a review week, or more practice days than lessons) gets a **Refresh** session, so no planned session is empty. The weekly goal, the Route card and the console readout all say 4 (section 6.1).
3. **Minutes decide how much a session holds.** Each session gets a minutes budget. Practice days are packed by catalogue minutes; class days by catalogue minutes times a **class pace** of 1.5 (group teaching takes longer than solo play, BL-OD-15). A 30-minute class day carries about 3 lessons; a 10-minute practice day about 2 lesson slots (section 6.2). Today every session holds exactly one item (`generate.ts:466-475`).
4. **Every lesson taught in class is played on the device.** Only device play puts letters and words into the memory model (F-CURR-002 section 4), so in both modes every class lesson also becomes a practice item after its class day ("From class"). The modes differ in what fills the rest of practice: **Practise what class taught** (default) fills it with Refresh; **Class and practice cover different lessons** fills it with further new lessons from groups the class has opened (section 5).
5. **The class always carries its share.** A class day's load is set by its own minutes, not by the practice room; lessons that do not fit the next practice days carry forward to later ones. Only when practice cannot keep up within two cycles (fewer practice days than class days, for example) does the class carry less, and the preview says why (section 6.2).
6. **One plan, no new table, no new capability.** The class's plan gains an optional `blend` block in its params, an optional `lectureDate` on items and an optional `refresh` list in its meta. Every item stays an ordinary dated practice item, so an older app derives the plan correctly without any projection (section 9).
7. **Learners see their class day; nobody is compared.** The Route card names the class day and practice days; the existing "From class" pill gains a small class glyph on lessons met in class. Nothing records attendance (sections 7 and 13).
8. **The own weekly plan steps aside, never deleted.** While a class plan with practice days is in force, the learner's own weekly plan rests and resumes when the class plan ends; in every layer, an own plan never schedules a lesson a class plan already scheduled (section 8).

## 1. Problem: what main does today

Measured at `1bfda3fc8`.

1. **Every session is the same.** A plan is a list of dated items, one item per session (`generate.ts:456-477`). `PlanItem = { kind, id, targetDate?, note?, week? }` (`schemas/plan-item.ts:8-15`) has no session kind and no weight. `CurriculumParamsSchema` (`curriculum/params.ts:33-65`) has one cadence per plan: `sessionsPerWeek` 1-7 or `sessionDays`, and one `minutesPerSession` (5/10/15/20/30).
2. **Minutes do not size a session.** `minutesPerSession` feeds only `stats.minutesAvailable` (`generate.ts:578`) and the warning `session-too-short` (`:568`).
3. **The class hint is a weekday tip.** The console wizard's class step says "Pick a class day and a homework day." (`packages/i18n/src/messages/en/console.ts:795`). Both days become ordinary items that every learner device derives as teacher homework (`plan-derivation.ts:62-67`). The class day is not recorded anywhere a device or the generator can read.
4. **Lecture mode is outside the plan.** "Present this plan" projects this week's items (`apps/web/src/lib/console/lecture.ts:94-107`) and `next-lesson` fills them to 10/20/30 minutes (`AMENDMENTS-LECTURE-V2.md` section 4.2 N1). The presenter writes no progress (F-TCH-004 section 3.9), so after class the same items are still pending homework on each device. The overlap mode exists by accident; a split mode does not exist.
5. **A class plan and an own plan ignore each other.** `proposeRoute` for a self plan excludes only finished quests (`apps/mobile/src/logic/route/proposal-flow.ts:126, 154-160`), so the own plan can schedule the class's lessons on other days. Merging is precedence only: Home card (2) takes one item a day by `SOURCE_RANK` teacher > parent > system (`assignment-merger.ts:12, 39-48`), `routeNext` and `pickGoal` follow the leading source (`route-next.ts:150-156`; `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 4.1), so a class plan hides the own plan.
6. **The weekly goal takes the top plan's days.** `planDaysInForce` (`apps/mobile/src/logic/goals/plan-days.ts:14-26`) returns the leading plan's `sessionsPerWeek`. A class plan of 1 day plus an own plan of 3 gives a goal of 1, not 4.
7. **One quest, one completion.** Derivation keys an assignment by `<source>#<questId>` and marks it done when the quest has ever been finished (`plan-derivation.ts:183-215`). A plan therefore cannot schedule the same quest twice as a "second retrieval": the second item would show done at once. Spaced retrieval after the first play is Daily Review's job (F-CURR-002 section 4), and a review or replay item kind is an F-PLAN-002 non-goal (section 4, D11).
8. **The non-goal this reverses.** F-PLAN-002 section 4 lists "mixing a class plan and a self-route into one list" as out of scope. This amendment does not mix two plans either: it puts both kinds of session **into the class plan** and rests the own plan while that plan is in force (section 8). F-PLAN-002 section 4 gains a pointer here (BL-A1).

## 2. Contracts with sibling specs

| Spec | This amendment takes | This amendment gives or changes | Until that sibling row merges |
|---|---|---|---|
| **F-PLAN-002** curriculum planner | `generateCurriculum`, `regenerateFrom` (`shift`, `requeue`, `reseed`), `proposeRoute`, the wizard (`lib/console/curriculum.ts`), the `?cap=curriculum` gate, `CURRICULUM_MAX_ITEMS` 260, derivation rules 1-4 (section 3.6) | `blend` params, item `lectureDate`, meta `refresh`, the blended generator path with minutes packing (blended plans only), the wizard's meeting block (sections 5, 6, 9, 10). Solo and class-only generation is byte-for-byte unchanged (goldens A and B stay) | — (all on main) |
| **F-TCH-004 / AMENDMENTS-LECTURE-V2** lecture mode | `planOutline`, `pickPlan`, preset `next-lesson` N1, `fillToLength` | For a blended plan, N1 and "Present this plan" take **the class day's lessons** (items whose `lectureDate` is the next class day on or after today), not the whole week (section 10.3). The presenter itself changes nothing and still writes nothing | — |
| **F-ROUTE-001 / AMENDMENTS-ROUTE-LEARNING-ROUTE** | `pickGoal`, `routeNext`, the route card's weekly plan line, the grown-up route card | The weekly plan line names the class day and practice days; the existing "From class" pill gains a class glyph and a longer a11y label on lessons met in class; a Refresh step on practice days (section 7). `pickGoal` precedence is unchanged; the resting own plan simply is not a source (section 8) | — |
| **F-REPORT-001** progress reports | the plans block (`planProgress`, at most 3 plans), the 7-day squares | The class readout adds a class-day line that is calendar-based, never attendance; the parent line is fill-only (section 11) | — |
| **F-CURR-002** cells, volumes and mastery | Daily Review (2-3 minutes, Leitner boxes 1/3/7/14/30/60/120 days), Keep going, the Cell Check, the weekly goal of 3/5/7 days, `class-review` / `class-check` presets, cell = 3 quests | Refresh sessions open the Cell Check of an earlier class cell, or Daily Review with Keep going (section 6.4); nothing in the memory model changes. When #896 / #898 merge, a cell's "opened by class" rule (section 5.2) reads `CatalogCell.episodeIds` (both volumes count as one cell) | Before #898: one episode per cell, as on main |
| **AMENDMENTS-ONE-ACCOUNT-MANY-USERS** | device uses `family` / `teacher` / `school`; a learner in one family and up to 3 classes (`LEARNER_CLASS_CAP`) | Two blended class plans for one learner: both derive; the leading one (newest within the teacher rank) sets the Route line; the weekly goal counts the union of their days (section 6.1) | — |
| **F-SPACE-002** class transfer (`CLASS_TRANSFER` on) | the transfer flow and its reconcile | A move between classes changes the leading plan; nothing is lost and nothing is shown as missed (section 12.2) | — |
| **GX (#917, open)** grown-up UX | the parent child card's week line and the class line (GX-4 #937, GX-11 #942) | BL-9 appends the class-day words to the existing class line; it adds no new row to the card | BL-9 waits for GX-4 and GX-11 |
| **KT (#930, open)** forgiving tap | `TapTarget` for any new learner control | BL-8's practice-day chips use it | BL-8 waits for KT-1 (#943) |

## 3. Personas and the three layers

### 3.1 Personas

| Persona | Where they work | What they need from the route |
|---|---|---|
| **P-S Solo learner** (self device, or a child on a family device, no class plan) | learner app | One weekly plan of their own (or the family's), at their own cadence and minutes. Today's F-PLAN-002 self-route, unchanged. |
| **P-C Class learner with practice** (in a class, or a class inside a school, whose plan has practice days) | learner app, sometimes a class-scoped device | To know which day is the class day, to get practice that fits the class, and one weekly goal that counts both. Never to see a second plan fighting the first. |
| **P-T Teacher planning a class** | console (`/teach/space/curriculum`), presenter | To say, on one screen, when the class meets and for how long, and how often learners practise alone and for how long; to choose overlap or split; to see a preview with honest totals. On a class day, "Present this plan" shows that day's lessons. |
| **P-P Parent** (family space) | console family home, learner report | To see that the child has class on Tuesday and practises on 3 days, and how practice is going (fill only), without seeing the class or other children. To keep or pause a family weekly plan that would now be a third source. |
| **P-A School admin** | console school view (aggregate only) | Nothing new beyond the existing `classesWithPlan` counts; a class plan with practice days counts as a plan. No per-learner view (F-SCHOOL-001). |

### 3.2 The layers

| Layer | When it applies | Who plans | Plan shape | Generator path |
|---|---|---|---|---|
| **Solo** | No class or school curriculum is in force for the learner today | The learner (self) or a grown-up (family) | One track: today's self-route or family curriculum | `generateCurriculum` without `blend` (unchanged; one item per session, BL-OD-9) |
| **Class only** | The teacher set practice days to 0 (today's class plan) | Teacher | One track: class days + homework days as ordinary items | Unchanged. Own and family plans run beside it as today (precedence), with one new rule: an own plan's pending items whose quest the class plan schedules are hidden (section 8) |
| **Class with practice** | The teacher set practice days to 1 or more | Teacher sets the frame; the learner (or a grown-up) may move the practice days (BL-OD-7) | Class days and practice days in one plan | `generateCurriculum` with `params.blend` (sections 5 and 6) |

**Where the owner's overlap problem is solved.** Fully in the **Class with practice** layer: one plan, the own plan rests, practice is sized and placed around the class. The **Class only** layer gets the dedupe and the proposal exclusion (section 8), so the same lesson is never on two plans, but its class day still becomes ordinary homework as today. That is why the wizard's default becomes 3 practice days at the BL-10 flip (BL-OD-12).

**Layer resolution on a device** (`layerOf(sources, today)`, pure, `apps/mobile/src/logic/route/layer.ts`, BL-6): `class-with-practice` when any inbox source has `meta.params.blend` and its route (class cycles included, section 6.3) holds today; else `class-only` when any class or school curriculum is in force; else `solo`. The layer decides three things: whether the own weekly plan rests (section 8), which weekly-goal rule applies (section 6.1) and whether the Refresh step shows (section 7). Everything else (derivation, precedence, `routeNext`) runs on the sources as today.

**Schools.** A school's classes plan with the class wizard (a class inside a school is a class). A school-space plan keeps deriving as `parent` (`plan-derivation.ts:65`) and cannot be blended; the console wizard still has no school audience (non-goal).

## 4. Goals and non-goals

**Goals.**
1. **G1.** A teacher can plan class days and practice days in one plan, on one screen, choose overlap or split, and see per-track totals before publishing.
2. **G2.** Over the route, every class cycle holds exactly `L + P` sessions (L class days, P practice days), and every planned practice session has something to do (a lesson, or a Refresh). A cycle with days off loses only those sessions; the console states the average over teaching weeks and over the calendar, and offers to keep the average by extending the route.
3. **G3.** New material is sized by minutes: each day's material follows its own minutes budget (class days at the class pace), and a class day always carries at least what a practice day of the same plan carries, while practice days are at least as many as class days.
4. **G4.** Every lesson taught on a class day reaches a scored play on the learner's device within two class cycles of its class day, so it enters the memory model and the cell's mastery.
5. **G5.** A learner in such a class has one weekly goal that counts class and practice days together, one Route line, and no duplicate or conflicting own plan.
6. **G6.** Everything works offline on the device and on the presenter; only console pages need the network, as today.
7. **G7.** No learner is ever compared with another; no attendance is recorded; nothing on a learner screen reads as a debt.

**Non-goals.**
- Attendance, "covered in class" per learner, or any write from the presenter (F-TCH-004 section 3.9 stays).
- Per-learner overrides of the class's lesson list (F-PLAN-001 section 4; F-PLAN-002 section 4). A learner may move their practice **days** (BL-OD-7), never change which lessons.
- Minutes packing for Solo and Class-only plans (BL-OD-9 keeps them byte-identical).
- A school-wide or multi-class blended plan; a school audience in the wizard.
- A new D1 table, a lecture log or server-saved decks (F-TCH-004 section 3.15 keeps them a later phase).
- A `review` or `replay` plan item kind (F-PLAN-002 D11). Refresh sessions are listed in the plan's meta and open existing review activities; they are not items and never become homework.
- Any change to Stripe, prices or entitlements: `unlockedStages` still comes from the space's entitlement.

## 5. The blend modes

Both modes read one queue built exactly as today (stage order, then the story pool, coming-soon capped at 5; F-PLAN-002 section 3.3 steps 1-5) and one calendar of class cycles (section 6.3). In both modes:

- **The class day takes new lessons** from the queue head, by its class budget at the class pace (section 6.2), opening at most `C_max` new cells (BL-OD-16: 2 in Stages 1-2, 3 above). A class lesson is stored as an ordinary item with `lectureDate: <class date>` and `targetDate: <a practice date after the class>`: the class teaches it, then each learner plays it on the device. One item per lesson, never two (derivation keeps one assignment per quest, section 1.7).
- **Practice days hold the class's lessons first**, spread over the cycle's practice days (section 6.2), each on a date after its class day. Lessons that do not fit carry forward to the next practice days, before that cycle's own class lessons, never dropped.
- **What fills the rest** depends on the mode.

### 5.1 Practise what class taught (`mode: 'overlap'`, default, BL-OD-1)

- **Rest of a practice day:** a **Refresh** (section 6.4): no new lesson is ever placed on a practice day (BL-OD-3), so the next class never re-teaches something some learners already met alone.
- **Why default.** It is the stronger pattern for beginners (meet it with the teacher, retrieve it alone a day or so later, then come back to it in Refresh and Daily Review), and a learner who was absent from class still gets every lesson: each quest teaches itself (Discover step, F-QUEST-002), so nobody falls out of the plan.
- **Cost.** New material per cycle is the class's only. With 1 x 30 and 3 x 10: 3 new lessons a week (section 6.5).

### 5.2 Class and practice cover different lessons (`mode: 'split'`)

- **The cycle's packet.** The cycle takes new lessons from the queue head until their minutes fill the class room (`B_L` at the class pace) plus the practice room left after the class lessons' replays. The class day takes the openers of the packet's cells first (each cell's first lesson, at most `C_max` new cells), then further packet lessons in order while its budget allows.
- **Rest of a practice day:** the packet's remaining lessons, which all belong to cells the class has just opened or opened before. These items have no `lectureDate`.
- **Invariant (BL-OD-4, tested):** a practice-only item's cell has its opener on a class day strictly before the item's date. When the next queue item belongs to a cell no class has opened yet, the practice day takes a Refresh for the rest of its room instead, and that cell waits for the next class day.
- **Why the class lessons come back on practice days here too.** The presenter records nothing, so a lesson taught only in class would never enter the memory model: no Daily Review, no mastery, and the practice lessons after it would build on an opener the learner never played. Playing it once on the device costs about one lesson slot per class lesson and is what makes the class's teaching count (G4). This is still a split: class and practice teach different **new** lessons; practice also replays the class's ones once (BL-OD-4b).
- **Cost.** New material per cycle is the class's lessons plus the practice-only lessons, so the catalogue is covered about twice as fast as in overlap, and the catalogue's end or the 260-item cap can bind on a 6-month plan (section 6.5). The preview says so in plain words.

### 5.3 Review, culture and break cycles

- **Review cycle** (`reviewEvery`, F-PLAN-002 section 3.3 step 6, counted in class cycles): the class day carries no new lesson; the console's lecture card suggests the `class-review` preset (F-CURR-002 section 8). Practice days take any carried-over class lessons first, then a Refresh each. So a review cycle still holds `L + P` sessions, each with something to do.
- **Culture cycle:** the cycle's story (and festival anchor) is a class lesson in both modes (read together, then read alone on the first practice day). Like review, the culture cadence (`CULTURE_EVERY`) is counted in class cycles (as built, BL-2), so with `L` class days a week a culture class comes about `L` times as often per calendar week as in a single-cadence plan.
- **Before the first class lesson** (as built, BL-2): a practice date before any class has taught a lesson (the route's first class day is off, for example) has no cell to refresh, so it holds neither a lesson nor a Refresh entry; the device offers Daily Review there as on any day without plan items.
- **Break cycle** (every session removed by days off): nothing is placed; the queue waits.
- **Class day off, practice days on** (`blend.classDaysOff`, section 9.1, for a teacher absence or a school event while learners keep practising): that class day carries nothing; the cycle's practice days take carried-over lessons, then a Refresh each. Later class days are not moved (use **Move this class day** to shift them, section 10.2).
- **A practice day off** (the plan's `daysOff`, covering that date only): that session is removed; its lessons carry to the next practice day. The class's load does not change.

## 6. Scheduling maths

### 6.1 Sessions, cycles and the average

Let `L` = class days a week (1-5, `blend.lecture.days`), `P` = practice sessions a week (1-7, `blend.personal.perWeek`, the owner's "1-7 times a week"; 0 means the Class only layer and writes no `blend`). Practice sessions go on the `7 - L` non-class days first; when `P > 7 - L`, the remaining `P - (7 - L)` sessions go on class days (section 6.3, BL-OD-19). A class cycle `c` runs from a class day to the day before the next class day; with `L` class days a week there are `L` cycles a week.

- **A practice session on a class day** belongs to the cycle that ends there: it is the last practice day of the previous cycle, played after class. It holds lessons of earlier class days (carried over, `targetDate > lectureDate` still holds) or a Refresh, never the lessons taught that day, which are played from the next day on (section 6.4). The route's first class day has no such session (nothing has been taught yet); it is counted out like a day off. A plan day off (`daysOff`) removes both sessions of that date; a class day off removes only the class.
- **Sessions and days.** `D = |class days ∪ practice days|` distinct days a week, so `D = L + P` when no class day holds practice (the default while `P <= 7 - L`, the owner example included), `D = 7` with the default days above it, and in general `D <= L + P` (a teacher or learner who picks a class day as a practice day).

- **Sessions in a week:** `S(w) = L + P - D_off(w)`, where `D_off(w)` counts sessions removed by days off (both tracks) and class days off.
- **Route sessions:** `S = Σ_w S(w)`. The console shows **"About {L+P} sessions a week: {L} class day(s) and {P} practice days"** and, when any week loses sessions, "{S} sessions in all". When `L + P > 7` the header adds "on all 7 days" (`preview.everyDay`), because some class days also hold practice. The weekly goal ring and the Route line count distinct days `D`; the console counts sessions.
- **Averages:** over teaching weeks (weeks with `S(w) > 0`) the average is exactly `L + P` unless a days-off range splits a week; over the calendar it is `S / W`. Example: 26 weeks, 1 + 3, two holiday weeks off: 96 sessions, 4.0 a teaching week, 3.7 over the calendar; the preview says both.
- **Keep the average** (wizard option, off by default, BL-OD-18): the route is extended by the number of weeks lost to full-week days off, so the route still holds `W x (L + P)` sessions, and the calendar average over the planned period is met exactly (`stats.sessionsPerCalendarWeek` is then taken over the planned `W` weeks, as built in BL-2). The preview shows the new end date.
- **Weekly goal (BL-6).** `planDaysInForce` keeps its rank rule; for a blended leading plan it returns the plan's distinct days `D` (4 in the owner example; 7 for 1 class + 7 practice). With two blended class plans in force, it returns the size of the union of their days, capped at 7. With a learner's moved practice days (BL-OD-7), it counts the learner's days. The generator writes `sessionsPerWeek = D` (1-7, the existing schema range), so an older app reads the same number.

### 6.2 Minutes budgets and packing

- **Class budget:** `B_L = T_L - 4` for every class length `T_L` (`blend.lecture.minutes`: 15, 20, 30, 45, 60; BL-OD-13). The 4 minutes are the review quiz `fillToLength` adds to a lecture deck (`AMENDMENTS-LECTURE-V2.md` section 4.2 rule 2), so a class day's lessons and its review fit the stated length at every length, 15 minutes included (BL-OD-2).
- **Class pace:** a lesson of catalogue minutes `m` takes `k x m` minutes in class, `k = 1.5` (BL-OD-15): group teaching with a presenter (turn-taking, choral reading, moving between slides) runs longer than solo play. Assumption (a) (section 17) checks `k` against presenter run lengths.
- **Practice budget:** `B_P = T_P` (`blend.personal.minutes`: 5, 10, 15, 20, 30). Daily Review stays outside the budget, as in F-CURR-002; the preview says so ("plus about 2-3 minutes of Daily Review on each practice day").
- **Class packing** (`packClass(queue, B_L, k, C_max)`, pure): take items in queue order while `running + k x m(item) <= B_L` and the number of new cells opened stays `<= C_max`; the first item is always taken when the queue is not empty. In split mode the class day takes the packet's cell openers first (section 5.2). `m` is the catalogue minutes (`CatalogQuest.minutes`, `CatalogCell.minutes`, `CatalogStory.minutes`; the generator's `lookup.minutes`, `generate.ts:139-142`). The existing `session-too-short` warning still fires for an item longer than 1.5 x the budget.
- **Practice packing is spread, not greedy** (`spreadPractice(cycleItems, practiceDates, B_P)`, pure): the cycle's due items (carried-over class lessons first, then this cycle's class lessons, then in split the practice-only lessons) are dealt **round robin** over the cycle's practice days, so each day gets about the same number, and each day mixes an earlier and a later lesson of the class rather than the class's order in blocks (lesson 1 and 4 on Wednesday, 2 and 5 on Friday, 3 on Sunday). A day never goes over `B_P` by more than one item; whatever does not fit carries forward. A practice day that ends with room of at least 3 minutes, or with no lesson at all, gets a Refresh (section 6.4). So **every practice date has something to do** (the one exception, a practice date before any class lesson, is in section 5.3).
- **Carry-forward bound (G4).** Every class lesson must get a practice date within two class cycles of its class day. The generator checks this before it fixes a class day's load: if the carried-over lessons plus the class day's packed lessons would break it, the class day takes fewer lessons, the fewest needed, but **never fewer than one practice day of the same plan holds** (`floor(B_P / m̄)`, at least 1) while `P >= L`. That floor is what keeps G3: a class day carries at least a practice day's load, and in every case with `P >= L` the backlog stays within the bound, since the practice room of a cycle is at least one practice day.
  - *As built (BL-2):* "two cycles" counts the cycles that hold a practice date, from the class day's own cycle on (a cycle with none, such as Monday's in Mon + Tue classes, carries into the next one that has, and so do cycles whose practice days are all off). The check simulates to the end of the route and reserves every later class day's floor load (what one practice day takes, counted on its own lessons), so a class day never takes a lesson that would push a later one past the bound; it is held back only by shortfalls it causes, not by days off or the route's end. When the minutes mix leaves no other way (short practice days and long lessons), G4 wins over the floor and the plan shows `class-paced`: in a run of 3,000 random plans with `P >= L` and no days off (seed 42), 69 of 5,097 class days (about 1 %) carried no lesson for this reason. The floor is counted the way a practice day takes lessons: while the minutes are under `B_P`, so the last lesson may run over by one item, as `spreadPractice` allows. *Pending acceptance:* this note (two cycles counted as cycles that hold a practice date; G4 over the floor, flagged `class-paced`) refines the G3 and G4 text above and needs the merge reviewer's or the owner's acceptance.
  - *Re-pacing (as built, BL-2):* `regenerateFrom` on a blended plan keeps every item dated before today, and every lesson whose class day is before today keeps its `lectureDate`: if it is not finished (in `shift`, always), it is played on the next practice dates and no later class day teaches it again. Class days before today are replayed from what they taught, so review and culture cycles, opened cells (split), the stage reached and the Refresh cells stay as stored, and the stored Refresh entries before today are kept. The 260-item cap counts the kept items.
- **When `P < L`** (for example 2 class days and 1 practice day): practice cannot hold what class days could teach. G4 wins (a class lesson that is never played on a device does not count anywhere): class days carry what the practice room can take within two cycles, which may be less than a practice day's load, and the preview shows the warning `practice-short` (section 6.6). A cycle with no practice day (its class falls between two class days with no practice day in between) carries its lessons into the next cycle's practice days.
- **Proportionality (G3).** On a learn cycle, a class day's lessons fill `B_L` at the class pace (up to the bound above) and a practice day's fill `B_P` at solo pace. Owner example: class `26` minutes of teaching (3 lessons at 7.5 class minutes each) against practice `10` minutes (2 lesson slots). In minutes the class day holds 2.6 times a practice day; in new lessons taught, 3 against at most 2.

### 6.3 Calendar

- **Class days:** `blend.lecture.days` (weekdays, 1-5, required; the teacher picks them).
- **Default practice days** (`practiceDaysFor(lectureDays, P)`, pure, exported, 100 % covered): take the non-class weekdays, `n = 7 - L` of them, in the order of the cycles: the days after each class day up to the next one form that class's segment. Give each segment `round(P * len / n)` days by largest remainder (each segment at least 1 while `P >= L`), and pick inside each segment with index `floor(i * len / p)` for `i = 0..p-1`, so the first practice day after a class day is the next day whenever the segment has one. When `P > n`, every non-class weekday is a practice day and the remaining `P - n` go on class days, the class weekdays in week order from Monday (BL-OD-19).
- **Table (tested):**

| Class days | P | Practice days |
|---|---|---|
| Tue | 1 | Wed |
| Tue | 2 | Wed, Sat |
| Tue | 3 | Wed, Fri, Sun |
| Tue | 6 | Wed, Thu, Fri, Sat, Sun, Mon |
| Tue | 7 | Wed, Thu, Fri, Sat, Sun, Mon, and Tue after class (every day) |
| Thu | 3 | Fri, Sun, Tue |
| Mon, Thu | 3 | Tue, Fri, Sat |
| Mon, Thu | 1 | Fri (the Monday segment has none; Monday's lessons carry to Friday) |
| Mon, Thu | 6 | Tue, Wed, Fri, Sat, Sun, and Mon after class |

- **First cycle.** The route starts on the **first class day on or after the start date**. Days between the chosen start date and that class day carry nothing and are not counted as sessions; the preview says "Starts with the first class on {date}". A Wednesday start with a Thursday class starts on Thursday.
- **Last cycle.** The route ends with the last class day's whole cycle: the end date is the day before the next class day would fall, so the last class's lessons always get their practice days. The params' `weeks` counts cycles of the first class weekday; the refinement `weeks x (L + P) <= 260` (`params.ts:93`) still holds the session cap.
- **Teacher override:** the teacher may change the practice days in the wizard (weekday chips, the count fixed by P; hidden behind **Change days**, section 10.1); a class day may be picked as a practice day like any other (it then holds a session after class, section 6.1). Days off remove sessions and never move them (F-PLAN-002 rule); class days off are section 5.3.

### 6.4 Spacing, interleaving and Refresh

- **What the memory model sees.** The class run records nothing, so a lesson's first play on a practice day is its **first scored meeting**: its letters and words enter Leitner box 1 there (F-CURR-002 section 4.3). The class is a teaching exposure the day before; it is not a box. After that first play, Daily Review brings each item back at the box gaps (1, 3, 7 days and up), interleaved across cells. The plan adds no replay items (section 1.7).
- **Placement.** The first practice day after a class is the next day whenever the cycle has one, so the first scored play comes a day after the teaching; with spread packing every lesson of a cycle is played within the cycle, and at the latest within two cycles (section 6.2).
- **Refresh** (both modes; `meta.refresh`, section 9.2): a practice date with spare room or no lesson lists the cells taught by the class in the previous one or two cycles, earliest first. On that date the device offers, after the day's lessons (or as the day's only step), **Refresh**: the Cell Check of the first listed cell whose Check is open to the learner (first volume done, `cellCheck` on; it is interleaved and at least 30 % produce by F-CURR-002's selector), else Daily Review with Keep going, which draws on everything due. Refresh is optional, never homework, never counted in `planProgress`, and finishing it counts as play for the weekly goal like any play. In review cycles every practice day is a Refresh day unless a carried lesson is due.
- **Class review.** The class deck already ends with a 4-round quiz over the previous lessons (`fillToLength` rule 2), within `T_L` since `B_L = T_L - 4`.

### 6.5 Worked examples (goldens C, D and E, BL-2)

Assumptions: 26 weeks (6 months) starting on a Monday, class on Tuesday 30 minutes, 3 practice days of 10 minutes, start Brand new, `k = 1.5`, `C_max = 2`, no days off, `reviewEvery` 4 (the default for 12+ weeks), on the frozen catalogue `fixtures/catalog-2026-10.ts` (18 lessons, 24 stories, coming-soon capped at 5). *Regenerated from the goldens by row BL-2; the golden tests are authoritative.*

| | Practise what class taught (overlap), golden C | Class and practice cover different lessons (split), golden D |
|---|---|---|
| Sessions | 4 a week (Tue class; Wed, Fri, Sun practice), 104 in all (26 class, 78 practice), 4.0 a teaching week | the same |
| Class day | 3 lessons in week 1 (22.5 class minutes) + review quiz (4) = 26.5 of 30 minutes; 4 lessons in week 2 (24 class minutes) | week 1: the openers of 2 cells first (`letters-q1`, `life-q1`), then `letters-q2` (22.5 class minutes) + quiz |
| Practice days | 1 class lesson each (2 on Wednesday of week 2) + Refresh | weeks 1 and 2: 1 class lesson + 1 practice-only lesson each (10 minutes); week 3: the next cell is not opened yet, so the room is a Refresh |
| New lessons a week while the lessons last | 3 to 4 | 6 (3 from class + 3 more from the cells it opened) |
| The 18 lessons are taught by | week 7 (then stories, then the 5 coming-soon cells) | week 5 |
| Review / culture weeks | 5 / 3 (class: `class-review`; practice: Refresh) | 4 / 3 |
| Items over 26 weeks | 47 (all with `lectureDate`); 70 Refresh days; `content-runs-out` from week 24 | 47 (41 from class, 6 practice-only); 65 Refresh days; `content-runs-out` from week 21 |

On the frozen catalogue both modes place every lesson, story and coming-soon cell; split reaches the end three weeks sooner. With the shipped catalogue (more cells each release) the difference grows: split covers about twice the lessons a week, so the catalogue's end or the 260-item cap binds sooner, and the preview says so (`content-runs-out`, `item-cap`).

**Golden E** (cycle rules): start on a Wednesday, class on Thursday 45 minutes, 3 practice days of 10 minutes (Fri, Sun, Tue), overlap. The route starts on Thursday 5 November and ends on Wednesday 5 May 2027, the day before the next class would fall. The first class carries 6 lessons over 2 cells (`41` class minutes: three 5-minute and three 4-minute lessons, 40.5 at the class pace), the practice days take 2, 2 and 2; 47 items, 56 Refresh days, `content-runs-out` from week 15. **Property goldens** (BL-2): 1 + 1, 1 + 3, 2 + 3 and 3 + 4 at 30/10 minutes (G3 holds), and 2 + 1 and 5 + 2 (fewer practice days than class days: `practice-short`, G4 holds).

### 6.6 Caps and limits

- The params refinement keeps `weeks x (L + P) <= 260` (`params.ts:93`).
- **Items:** the generator stops placing at `CURRICULUM_MAX_ITEMS` (260) and adds the new warning `item-cap` ("This plan is full at week {n}. Choose fewer weeks, or practise what class taught."). The schema cap does not change, so every app in the field still parses every plan. `meta.refresh` has its own cap of 364 entries (one per practice date at most).
- **Content runs out:** the existing `content-runs-out` warning, worded per mode.
- **New warnings** (`WARNING_CODES` gains, additively): `item-cap`; `practice-short` ("Practice days can't keep up with what class days could teach, so class days carry less. Add practice days, or make them longer."); `class-paced` (a class day carries fewer lessons than its minutes allow because of the two-cycle bound: "Some class days carry fewer lessons so learners can practise each one soon after.").

## 7. What the learner sees (Class with practice)

All behind `flags.routeBlendEnabled` (app; on by default since BL-10, a kill switch).

- **Route card, weekly plan line** (LR's line, F-ROUTE-001 section 3.9): "Your class's weekly plan: class on {classDays}, practice on {practiceDays}." Weekday names come from `Intl.DateTimeFormat(locale, { weekday: 'long' })`, joined with the locale's list format. Two class days: "class on Tuesday and Thursday". With 4 or more practice days the practice part collapses: every weekday (7 days, or every non-class day plus class days) "practice every day", 6 days "practice every day except {weekday}", 4 or 5 days "practice on most days". The line uses **the learner's own practice days** when they moved them (BL-OD-7); the console keeps showing the class's default (section 10.2). No dates, no counts above 3, no countdown. The class part never collapses (BL-7, BL-D finding 10): class days are the days the learner goes to class, so each one is named, 1 to 5 names; a locale-dependent "weekdays" or a vague "most days" would hide a fact the learner needs. With 3 or more class days the line may take a fourth line at 320 px (assumption d).
- **Homework and Home card (2).** Practice items are teacher items as today and keep the existing **From class** pill (`assignedByLabel`, `packages/i18n/src/messages/en/learner.ts:683`). An item with `lectureDate` shows the same pill with a small `class` glyph in front of the words and the a11y label "From class. You met this in class." There is no second tag, so a row never shows two labels with the same words (tested). Precedence, the three-row Today cap and the stacking exception are unchanged.
- **Refresh.** On a practice date with a `meta.refresh` entry, after the day's lessons are done (or when there are none), card (2) shows **Refresh** with the line "Look back at what class taught." It opens the Cell Check or Daily Review per section 6.4. It is never a to-do and has no count.
- **Class day on the device.** On a class day Home shows one calm line above card (2): "Class today." Nothing is assigned for the class itself; no question "Did you go?".
- **Weekly goal ring.** Counts days with any practice or play; the target is the plan's distinct days (section 6.1). A class day counts when the learner plays anything that day; the class itself never counts (the presenter writes nothing).
- **Own plan resting** (section 8): Profile's weekly plan row reads "Your own weekly plan is resting while your class's plan has practice days." with **See it** (read-only overview). Never "stopped" or "cancelled".
- **Accessibility:** every tag and mark has text; screen readers read "From class. You met this in class.", "Refresh", "Class today"; contrast and size per tokens; the weekday line is one text node.

## 8. The own weekly plan and the family's (harmonising sources)

- **Resting, not archived (BL-OD-5).** While the layer is `class-with-practice`, `sourcesOf` (`plan-derivation.ts:70-76`) leaves the active self-route out (a pure `pausedBy` check, no stored state). Its pending assignments stay in `snapshot.homework` but are hidden from Home and Homework (filtered by the `route:` prefix while resting); none is removed, and none is marked late.
- **Resume.** When the blended class plan ends or the learner leaves the class, the next derivation includes the self-route again and runs `repaceSelfRoute` once (`requeue`, F-PLAN-002 section 3.7), so its remaining lessons start from today, minus anything the learner finished meanwhile. The Hoya line "Your own weekly plan is back." shows once.
- **Dedupe in every layer (BL-6).** When any class or school curriculum is in force, derivation hides an own-plan (or family-plan) pending item whose quest that curriculum also schedules: the item is skipped for the other source (hidden, never deleted; it comes back if the class plan drops the quest). So in the Class only layer the same lesson is never on two plans at once.
- **Proposal.** `proposeRoute` for a self plan excludes the quests any in-force class or school curriculum has scheduled (every inbox curriculum's items, not just finished ones; BL-6), so a new own plan never duplicates the class. While the layer is `class-with-practice` the proposal is not offered (Home prompt and Profile row say "Your class's weekly plan has practice days for you." instead), and **Make a weekly plan** stays reachable from Profile for a learner whose class plan ends soon (it starts the day after the class plan's last day).
- **Family weekly plan (BL-OD-6).** A family plan is a grown-up's choice and is not paused automatically. The family console's learner card shows "{name}'s class has practice days on {weekdays}." and offers **Pause the family weekly plan while class runs** (sets the family plan's `targetLearnerIds` to exclude the learner, an existing field, no new state; **Resume** reverses it). Until the parent acts, both derive by today's precedence (class first), with the dedupe above.

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
  /** Class days that do not happen while practice goes on (section 5.3). */
  classDaysOff: z.array(DateKeySchema).max(52).default([]),
  /** Extend the route by the full weeks lost to days off (section 6.1, BL-OD-18). */
  keepAverage: z.boolean().default(false),
});
// paramsShape gains:  blend: BlendSchema.optional()   (audience 'class' only; refinement 'blend-not-class')
```

Refinements: `blend` only with `audience: 'class'`; `personal.days` has no repeated weekday and `personal.days.length === perWeek` when present (it may include class days, section 6.1; `L + P` may exceed 7 since BL-OD-19); every `classDaysOff` date is a class weekday. When `blend` is present the generator writes `sessionsPerWeek = D` (distinct days, section 6.1), `sessionDays` = their union and `minutesPerSession` = `personal.minutes`, so any reader that ignores `blend` (an old app, an old console) sees a valid single-cadence plan with the right weekly count.

### 9.2 Items and meta (`schemas/plan-item.ts`, `curriculum/draft.ts`, BL-W)

```ts
// PlanItem gains
lectureDate: DateKeySchema.optional(),   // the class day that taught it; targetDate > lectureDate
// CurriculumMeta gains
refresh: z.array(z.object({ date: DateKeySchema, cellIds: z.array(z.string()).min(1).max(6) })).max(364).optional(),
```

Refinements: `lectureDate` needs `targetDate` and `targetDate > lectureDate`. Every item of a blended plan is an ordinary practice item; there is no class-only item. `GENERATOR_VERSION` becomes 2 for blended plans; a v1 plan never has these fields.

### 9.3 Worker, inbox and capability (BL-W)

- `PlanSchema`, `PlanUpsertSchema`, `InboxPlanSchema`, `CurriculumMetaSchema`, `SelfRouteSchema` (items) and `HomeworkAssignmentSchema` (gains `fromClass: z.boolean().optional()`, BL-6 writes it) accept the new fields. Deploy the Worker **before** the console can publish a blended plan (BL-4) and before an app reads one (BL-6); zod would otherwise strip them on save.
- **No new capability.** A blended plan is a list of dated practice items, so the inbox (`routes/sync.ts:185-208`) sends it unchanged under `?cap=curriculum`. An older app strips `lectureDate`, `meta.refresh` and `meta.params.blend` with its parser and derives exactly the practice items on their dates, with the weekly count `D` from `sessionsPerWeek`; it shows no Refresh and no class glyph, which loses nothing. An app with no curriculum capability gets no curriculum, as today.
- `inboxPlansFor` keeps its rules (published, unarchived, targeted). The 409 `curriculum_needs_new_plan` rule is unchanged; a published curriculum may gain or lose `blend` (section 14).
- Roster and `planProgress` are unchanged in shape; Refresh never enters `planProgress`.
- **No D1 migration:** `plans.items_json` and `plans.meta_json` (`0006_plan_meta.sql`) carry the new keys. If a later row needs a table, it takes the next free migration number when it opens (`scripts/check-migrations.mjs` enforces unique prefixes).

### 9.4 Device (BL-6, BL-8)

- `deriveAssignments` copies `fromClass: lectureDate !== undefined` onto the assignment and otherwise runs rules 1-4 unchanged (horizon 7 days, reconcile, precedence, ids `plan:<id>#<questId>`), plus the dedupe of section 8.
- `planDaysInForce` per section 6.1. `layerOf` and the rest rule per sections 3.2 and 8. `refreshFor(sources, today)` reads `meta.refresh` of the leading blended plan.
- **Learner practice days (BL-8, BL-OD-7):** `snapshot.practiceDays?: { planId, days: Weekday[], updatedAt }[]` (additive, at most 3 entries, one per class plan; Worker preserve rule: an absent key never erases a stored one; merge by newest `updatedAt`). The learner picks 1 to 7 days; a class day may be picked (its session comes after class and holds earlier classes' lessons or a Refresh, section 6.1). A learner day **before** the class day in the week (a Tuesday for a Thursday class) holds only lessons of earlier class days; that week's class lessons wait for the learner's first day after the class, at the latest within two cycles (invariants 1-4). `placePractice(items, refresh, practiceDays)` re-dates the plan's practice items **on the device only**, cycle by cycle, with `spreadPractice` (section 6.2), under these invariants (property-tested):
  1. every item's new date is after its `lectureDate`;
  2. in split, every practice-only item's new date is after its cell opener's class date;
  3. an item stays in its own cycle or moves to a later one, never an earlier one;
  4. a day holds at most `1.5 x B_P` of items; the excess carries to the learner's next practice day, and an item that would then fall more than two cycles after its class day keeps its plan date instead (it shows on that day as usual);
  5. Refresh entries move to the learner's days that end with room or no lesson.
  The console never sees the learner's days (no field in the summary except the count in section 11).

### 9.5 Offline

- The generator, `practiceDaysFor`, `packClass`, `spreadPractice` and `placePractice` are pure and bundled; the wizard preview and every device rule run offline.
- Derivation still re-runs at app start, on foreground and when the inbox fails (F-PLAN-002 section 3.6), so a class day crossing midnight offline moves practice items into the horizon on time.
- The presenter's `next-lesson` on `/present` (no console) is unchanged (N4: Recent lessons); the class-day pick of section 10.3 needs the console's plan and therefore the network, as "Present this plan" does today.

## 10. Console (teacher)

### 10.1 Wizard: "How does this class meet?" (BL-4; `lib/console/curriculum.ts`, wireframe `design/wireframes/console/curriculum-wizard.md` section "Meeting", BL-D)

One compact block at the top of step 2 (Length and rhythm), class audience only, behind `routeBlendEnabled()` (`NEXT_PUBLIC_ROUTE_BLEND_ENABLED`, default off). It replaces the class-day + homework-day chips while the flag is on:

1. **Class:** weekday chips (1-5) and a **Class length** select (15, 20, 30, 45, 60 min; default 30).
2. **Learners also practise on their own:** a row "[0-7] times a week x [5, 10, 15, 20, 30] min" (defaults: 0 until BL-OD-12's flip, then 3; 10 minutes, 5 when pictures-first, `PICTURES_FIRST_MINUTES`). 0 is today's Class only plan. The old homework day maps onto this row: a teacher who wants one homework day picks 1. The suggested practice weekdays show as one line ("Practice on Wed, Fri, Sun"; with 7 - L or more, "Practice every day" plus "also after class on {weekday}" when a class day holds practice) with **Change days**, which opens the weekday chips.
3. **How do class and practice fit together?** Shown only when practice days are 1 or more. Two radio cards: **Practise what class taught** (preselected, tagged *Suggested*; "Each class's lessons come back on the practice days after it.") and **Class and practice cover different lessons** ("Practice days also bring new lessons from the groups class has started. Covers more, faster.").
4. **Length.** The length chips (4 weeks, 12 weeks, 6 months, Choose weeks) stay, with **Keep the average when there are days off** (checkbox, off). The pace chips are hidden for a blended plan (the cadence is the meeting frame). **Class days off** sits with the existing days-off control as a second kind ("Only the class is off").

The whole block fits one screen at 1280 px and one scroll at 320 px with 200 % text (assumption c, BL-D mock). `defaultsFor('class', ...)` gains `blendMode: 'overlap'`, `lectureDays: []`, `lectureMinutes: 30`, `practicePerWeek: 0` (3 after the flip), `practiceMinutes: 10`, `keepAverage: false`. `toParams` writes `blend` per section 9.1 when `practicePerWeek >= 1`.

### 10.2 Preview and readout

- **Preview header:** "About 4 sessions a week: 1 class day (30 min) and 3 practice days (10 min each, plus about 2-3 minutes of Daily Review). Class days teach about 3 lessons; practice days play about 2." The numbers come from the draft's new stats: `stats.byTrack = { lecture: { sessions, items, minutesPlanned }, personal: { sessions, items, refreshDays, minutesPlanned } }`, `stats.sessionsPerTeachingWeek`, `stats.sessionsPerCalendarWeek` (one decimal).
- **Week table:** each cycle row splits into a **Class** cell (date, lesson titles) and a **Practice** cell (weekdays; lessons from class, practice-only lessons in split, and "Refresh"). Tables keep header cells and row scope (F-PLAN-002 section 3.11).
- **Readout (published):** the This week block shows the class day's lessons first, then practice as the existing class aggregate `done / so far` (counts only, learners in activity order, no ranking). A line "Class days so far: {n} of {N}" counts **scheduled** class dates up to today, never attendance. The readout shows the class's default practice days; learners' own days are never shown.
- **Move this class day** (BL-4, BL-OD-8): on the readout, next to Re-pace from today. It runs `regenerateFrom(plan, today, catalog, { mode: 'shift', classDay: <class date> })` (BL-3): that class day's lessons and every later class day's move to the following class days, with their practice dates recomputed by sections 6.2 and 6.3; split practice-only items move to after their opener's new class date. The plan id stays; devices reconcile on the next sync (rule 2). Only a class date of the route from today on can move (section 12.1: the teacher knows ahead); a class day that has gone by is refused. When the move pushes lessons past the route's end, the items at the queue's tail (stories after lessons) are left out and the preview shows `fewer-sessions-than-units`; adding weeks brings them back. The `params` override (section 14) changes how the class meets, never the route: start date, weeks, audience and level stay.
- **Add practice days to this plan** (migration, section 14): on a published class-only curriculum.

### 10.3 Lecture mode on a blended plan (BL-5)

- `planOutline(plan, today)` (`lib/console/lecture.ts:94-107`): for a blended plan the outline is **the class day's lessons**: the items whose `lectureDate` is the next class date on or after today, in plan order; before the route the first class day, after it the last. A classic or single-track curriculum keeps today's rule.
- **The whole class day is presented, at the class's real length.** On main, N1 calls `fillToLength(planBlocks, minutes, true, catalog)` with the chip value (`PresetMinutes` 10/20/30, `packages/content-schema/src/schemas/lecture-presets.ts` `nextLesson` and `fillToLength`), and `fillToLength` stops taking blocks once their catalogue minutes pass `minutes`; a 45- or 60-minute class day mapped to a 30 chip would lose its last lessons from the deck. So, for a blended plan, BL-5 adds a full-outline path and does not route it through the chips:
  - `PresetContext.plan` gains `classMinutes?: 15 | 20 | 30 | 45 | 60` (the plan's `blend.lecture.minutes`; the console sets it only for a blended plan's class-day outline).
  - When `classMinutes` is set, N1 calls the new pure `fillOutline(outline, classMinutes, review: true, catalog)` instead of `fillToLength`: it takes **every** outline block in order (never a minutes stop; at most `LECTURE_MAX_BLOCKS - 2` = 28 lesson blocks), then adds the review quiz and the closing activity by the same rules and constants as `fillToLength` (quiz when at least 5 minutes are left of `classMinutes`, activity when at least 2, each only while blocks are under `LECTURE_MAX_BLOCKS`). `ResolvedPreset.minutes` is `classMinutes`. `fillToLength`, `PresetMinutes`, the chips and every other preset are unchanged (their tests stay byte-identical).
  - The deck therefore holds the whole class day at every class length: the generator packs a class day to `B_L = T_L - 4` at the class pace `k = 1.5`, so its catalogue minutes are at most `(T_L - 4) / 1.5`, which leaves the quiz its 4 minutes at every length, 15 included. BL-2 asserts that no class day holds more than 28 lessons (at most 56 / 7.5 ≈ 8 at 60 minutes), so `fillOutline` never cuts. Even if a deck were short, nothing is lost from the plan: every class lesson is also a practice item (section 5).
  - The lecture card shows no length chips for a blended class day; it shows "Class day: {weekday} · {n} lessons" and "Class length: {minutes} min" (`lecture.classLength`), the length being changed in the plan, not on the card. A classic or class-only plan, and N2-N4, keep the chips and `fillToLength`.
  - The title stays the plan title rule.
- The presenter, its isolation test and `lecture.complete` are unchanged: no plan, space or deck id is sent.

## 11. Reports and grown-up views

- **F-REPORT-001 plans block:** for a blended plan, `{assigned, started, finished, itemsDone}` counts its items as today (every item is a practice item). The block's line names the plan "Your class's weekly plan (class and practice)" on grown-up views.
- **Teacher (class roster, readout):** the class aggregate of practice (`done / so far`), the class-days-so-far line (scheduled, not attended), no per-learner practice-day list, no learner sorted or compared. Class viewers never see `selfRoute` or the learner's chosen practice days (`spaces.ts:581` redaction stays).
- **Parent (family space, BL-9):** the child card's class line (GX-4) gains the meeting words: "In: {class} · class on {weekday}, practice {n} times a week". The device writes a family-only summary field `summary.practiceWeek = { practicedDays }` (a whole number 0-7: days this week with a finished practice item or a finished Refresh), redacted from class rosters like `selfRoute`. The grown-up report shows "Practised on {n} days this week" with a 7-day strip that fills (BL-OD-11): no denominator and no empty-day words.
- **School admin:** unchanged aggregates; a blended class plan counts in `classesWithPlan`.
- **Minutes:** `minutesLast7d` (F-REPORT-001) keeps counting quest, story, game and level-check time; class runs add nothing.

## 12. Edge cases

### 12.1 A class day that does not happen

- **The teacher knows ahead:** **Class days off** (section 5.3) keeps practice going and moves nothing; **Move this class day** (section 10.2) shifts the class's lessons to later class days. The plan never asks "did class happen?" by default (BL-OD-8).
- **The teacher does nothing:** the plan stays as published. Learners' practice items arrive as planned and each quest teaches itself, so practice still makes sense; the next class can open with the `class-review` preset.
- **A learner is absent:** nothing is recorded and nothing changes on that learner's device. Practice items arrive as for everyone; the class glyph stays (it names where the lesson belongs in the plan, not who attended).

### 12.2 A learner moves classes, joins late or leaves

- **Move (F-SPACE-002):** the old class's plan leaves the inbox; its pending practice items are dropped and finished ones stay (rule 2). The new class's plan derives from today; lessons the learner already finished show done on any date (`plan-derivation.ts:183-189`). Practice days the learner had moved for the old plan are discarded with it (`practiceDays` keyed by plan id).
- **Join mid-term:** derivation includes earlier practice items (past-dated items are not bounded by the horizon); the three-row Today cap and the "A few to do today" words apply (F-PLAN-002 section 3.6 review amendment). No count, no "catch up".
- **Leave every blended class:** the layer becomes Solo or Class only; the own plan resumes (section 8).
- **Two blended classes:** both derive; the newest teacher plan leads Route, `routeNext` and Refresh; the weekly goal counts the union of days (section 6.1).

### 12.3 Class-scoped devices (school labs)

A class-scoped device receives class plans only (`sync.ts:192, 208`). Practice days and Refresh work on it unchanged; the own plan does not exist there. `practiceDays` belongs to the profile on that device.

### 12.4 Free learners

Unchanged entitlement rules: lessons outside `unlockedStages` are never scheduled (listed for the console as today). A practice item a learner cannot open counts as not ready, and learner screens show F-ENT-003's words only. Refresh offers only cells the learner can open.

## 13. Anti-shame, privacy and safety

- No learner screen shows: a count above 3, a date to the goal, the words in the standing rules, attendance, another learner, or a comparison. "From class", "Refresh" and "Class today" are neutral facts.
- The teacher's readout counts **scheduled** class days and **class-total** practice; never a per-learner practice list, never a ranking.
- The parent's line fills only; it has no denominator and never says what was not done.
- No new identifier leaves the device: `practiceDays` rides the snapshot (sync, backup, Rescue Code) like `selfRoute`; the summary gains one count, family-only.
- A child's practice days change only through the grown-up gate (`planChangesOpen`, OD-17); a self learner changes them directly.
- Copy tests: every new key passes `isCaregiverSafe` and the anti-shame list in en, es and ko (the existing curriculum copy test, extended).

## 14. Migration of existing plans and launch

- **Existing plans are untouched.** Every plan published before BL-4 has no `blend`; solo and class-only generation is unchanged (goldens A and B unchanged; generator v1 plans keep `generatorVersion: 1`).
- **Upgrade path (BL-4):** a published class-only curriculum shows **Add practice days to this plan**. It opens the meeting block prefilled (class days from the plan's `sessionDays` minus the homework day, when the teacher's original pick is recoverable; else empty), and saves with `regenerateFrom(plan, today, catalog, { mode: 'shift', params: <with blend> })` (BL-3): past items stay, future items are re-laid as a blended plan, same plan id. Devices reconcile on the next sync.
- **Back to class only:** **Stop practice days** re-lays the future without `blend` the same way.
- **Self routes and family plans:** untouched; self routes rest only while a blended plan is in force.
- **Flags:** console `routeBlendEnabled()` (`NEXT_PUBLIC_ROUTE_BLEND_ENABLED`) gates the meeting block, the readout controls and the lecture class-day pick; app `flags.routeBlendEnabled` (`EXPO_PUBLIC_ROUTE_BLEND_ENABLED`) gates the learner glyph, lines, Refresh and the practice-days setting. Derivation (`fromClass`, the dedupe, rest the own plan, weekly goal) is **not** flagged: it must be right the moment any blended plan exists. Both flags defaulted off until BL-10, which flipped both after its e2e (BL-OD-12); each is now on by default, a kill switch.
- **Rollback:** once a blended plan is published, the Worker is not rolled back below BL-W (an older Worker would strip `lectureDate` and `meta.refresh` on the next save). Recorded in `docs/launch/owner-runbook.md` by BL-W.

## 15. Amendments to sibling specs (applied in the rows named)

| Id | Spec, section | Change | Row |
|---|---|---|---|
| BL-A1 | F-PLAN-002 section 4 | The non-goal "mixing a class plan and a self-route into one list" gains: "A class plan may hold practice days and rests the own plan while in force: `AMENDMENTS-ROUTE-CLASS-BLEND.md`." | BL-0 (this PR) |
| BL-A2 | F-PLAN-002 sections 3.1, 3.3, 3.5 | `blend` params, item `lectureDate`, meta `refresh`, the blended path with class and practice packing, class cycles, new warnings | BL-W, BL-2 |
| BL-A3 | F-PLAN-002 sections 3.6, 3.7, 3.8, 3.10 | Dedupe against class plans; Move this class day; the meeting block; rest rule and proposal exclusion | BL-3, BL-4, BL-6 |
| BL-A4 | AMENDMENTS-LECTURE-V2 section 4.2 N1; F-TCH-004 section 3.11 | Class-day outline for blended plans | BL-5 |
| BL-A5 | F-ROUTE-001 section 3.9 (as amended by LR) | Weekly plan line with class and practice weekdays; class glyph on the From class pill; Refresh | BL-7 |
| BL-A6 | F-REPORT-001 plans block | Parent practice-week line (fill only) | BL-9 |

## 16. PR table

Each row is one reviewable PR, TDD, en + es + ko for every string it adds, multi-agent reviewed before merge.

| PR | Content | Size | Needs |
|---|---|---|---|
| **BL-0** | `docs(specs)`: this amendment; BL-A1 pointer in F-PLAN-002 section 4; README index line and glossary words | S | — |
| **BL-D** | `docs(design)`: wireframes: console wizard "Meeting" block (one screen at 1280, one scroll at 320), preview cycle table with Class / Practice cells, readout with Move this class day; learner Route weekly plan line (1, 3, 5 and 6 practice days), From class pill with the class glyph, Refresh card, Class today line, own plan resting row, practice-days setting; parent card class line and the filling 7-day strip. Mocks in `design/screens/route-blend/` at 320 and 1280, en / es / ko | S | BL-0 |
| **BL-W** | `feat(content-schema,backend)`: `BlendSchema`, `paramsShape.blend` and refinements; `PlanItem.lectureDate`; `CurriculumMeta.refresh`; `HomeworkAssignment.fromClass`; `snapshot.practiceDays` with its preserve rule; `summary.practiceWeek` (family-only redaction); new `WARNING_CODES`; schema, inbox (old-schema parse of a blended plan) and redaction tests; runbook rollback line; telemetry names of section 18 with exact-list tests. **Deploy the Worker before BL-4 and BL-6 reach users** | M | BL-0 |
| **BL-1** | `feat(content-schema)`: `practiceDaysFor`, class cycles (`cyclesOf`: first and last cycle rules), `packClass`, `spreadPractice`; table tests of section 6.3; property tests (practice after its class day; round robin within one item; no item lost) | S | BL-W |
| **BL-2** | `feat(content-schema)`: `generateCurriculum` blended path (`GENERATOR_VERSION` 2 for blended plans only): budgets and class pace, `C_max`, overlap and split, the two-cycle bound and its floor, the opener invariant, Refresh entries, review / culture / break cycles, class days off, keep the average, `stats.byTrack`, `sessionsPerTeachingWeek` / `sessionsPerCalendarWeek`, warnings; goldens C, D, E on the frozen fixture; goldens A and B unchanged; property tests of section 20 | M | BL-1 |
| **BL-3** | `feat(content-schema)`: `regenerateFrom` gains `classDay` for Move this class day, and a `params` override for add / stop practice days; tests including "nothing done is moved or lost" | S | BL-2 |
| **BL-4** | `feat(web,i18n)`: wizard meeting block, defaults, `toParams`, preview header and cycle table, readout lines, Move this class day, Add practice days / Stop practice days, `routeBlendEnabled()`; `console.curriculum.blend.*` keys | L | BL-3, BL-D, BL-W deployed |
| **BL-5** | `feat(content-schema,web,i18n)`: `planOutline` class-day rule; `PresetContext.plan.classMinutes` and `fillOutline` (section 10.3), N1 using it for a blended class day at the plan's real class length; lecture card lines "Class day: {weekday} · {n} lessons" and "Class length: {minutes} min" (no chips there). Tests: on goldens C, D and E and at every class length 15, 20, 30, 45 and 60, the deck holds every outline lesson in order (none cut), plus the quiz and activity by the fill rules; a 45- and a 60-minute class day whose catalogue minutes pass 30 keep every lesson; `fillToLength` and the other presets byte-identical | S | BL-2 |
| **BL-6** | `feat(mobile)`: derivation writes `fromClass`; the dedupe against class plans (every layer); `layerOf`; own-plan rest and resume; `planDaysInForce` distinct and union rules; `proposeRoute` excludes class-scheduled quests; `refreshFor`; reconcile tests (move, join, leave, two classes) | M | BL-W deployed, BL-1 |
| **BL-7** | `feat(mobile,i18n)`: Route weekly plan line (with the collapse rules), the class glyph and a11y label on the From class pill, the Refresh card and its routing to Cell Check or Daily Review, Class today line, own plan resting row and proposal line; `learner.route.blend.*`, `a11y.route.blend.*` keys; screen tests at 320 x 568 including "no row shows two identical labels"; behind `flags.routeBlendEnabled` | M | BL-6, BL-D |
| **BL-8** | `feat(mobile,i18n)`: practice-days setting (Profile -> weekly plan; chips 1 to 7 and weekdays, class days allowed; grown-up gate for a child), `placePractice` with its five invariants (named cases: a learner day **before** the class day, such as Tuesday for a Thursday class, never gets that week's class lessons or, in split, a practice-only lesson of a cell that class opens; a learner who picks only the class day gets each class's lessons on the next class day, within two cycles), `snapshot.practiceDays` write and merge, `route.practice_days_changed` | M | BL-7, KT-1 (#943) merged |
| **BL-9** | `feat(mobile,web,i18n)`: device writes `summary.practiceWeek`; parent card class line words; report practice-week line and filling strip; teacher readout class aggregate; redaction test (class roster never has the field) | M | BL-6, BL-W deployed, GX-4 (#937) and GX-11 (#942) merged |
| **BL-10** | `test(e2e)` + flag flip: `apps/web/e2e/route-blend.spec.ts` (wizard to publish to readout to Present this plan on the class day; overlap and split), `apps/mobile/e2e/web/route-blend.spec.ts` (old-app parse of a blended plan; new app glyph and Refresh; own plan resting; weekly goal 4); en / es / ko screenshots; the flag-on lane also sets `ROUTE_BLEND_E2E=1` so BL-9's `apps/web/e2e/family-blend.spec.ts` (P1, P2 at 320 px, 1280 px and 200% text) runs in CI (deferred: a lane is a workflow change, so it is issue #990; until then each PR runs the console specs locally), and the launch keeps class moves on (`NEXT_PUBLIC_CLASS_TRANSFER`, which feeds BL-9's class line and Pause); then `NEXT_PUBLIC_ROUTE_BLEND_ENABLED` and `EXPO_PUBLIC_ROUTE_BLEND_ENABLED` default on and the wizard's practice default 3 | S | BL-4, BL-5, BL-7, BL-8, BL-9 |

**Order.** BL-0, then BL-D and BL-W in parallel; BL-1 -> BL-2 -> BL-3; BL-5 after BL-2; BL-6 after the BL-W deploy and BL-1; BL-4 after BL-3 and the deploy; BL-7 -> BL-8; BL-9 after BL-6 and the GX rows; BL-10 last.

**Total:** 12 rows (one design row, one Worker row), one Worker deploy, no D1 migration, no new endpoint and no new inbox capability.

## 17. Owner decisions (each has a default that applies until answered)

| Id | Question | Default | Alternative | Gates | Reversible |
|---|---|---|---|---|---|
| BL-OD-1 | Which blend mode is preselected? | **Practise what class taught** (overlap), tagged *Suggested* | Class and practice cover different lessons (split) preselected | BL-4 | yes (one default) |
| BL-OD-2 | Does a class day keep room for its review quiz? | **yes**: `B_L = T_L - 4` at every length, so the lessons and the quiz fit the class length | the whole class length holds lessons; the quiz runs over time | BL-2 | yes (one constant) |
| BL-OD-3 | In overlap, may practice days take new lessons when the class's lessons are placed and room is left? | **no**: the room goes to Refresh | yes: the next lessons in order (covers more; the next class may re-teach what some met alone) | BL-2 | yes |
| BL-OD-4 | In split, must class open each lesson group before practice uses it? | **yes** (the opener invariant) | pure minutes split in route order | BL-2 | yes |
| BL-OD-4b | In split, are class lessons also played once on a practice day? | **yes**: so they enter the memory model and mastery (G4) | no: class-only lessons, which then never get spaced review or count toward mastery | BL-2 | yes |
| BL-OD-5 | What happens to a learner's own weekly plan while a class plan with practice days is in force? | **rests, kept, resumes re-paced** when the class plan ends | both run as today (class first, with the dedupe); or the own plan is archived | BL-6 | yes |
| BL-OD-6 | And a family weekly plan for that child? | **keeps running** with the dedupe; the parent gets a one-tap **Pause the family weekly plan while class runs** | paused automatically like the own plan | BL-6, BL-9 | yes |
| BL-OD-7 | May a learner change their practice days? | **yes**: days and count (1 to 7, class days allowed) on the device, under the `placePractice` invariants; a child through the grown-up gate; the lessons never change | the teacher's days only | BL-8 | yes |
| BL-OD-8 | Ask the teacher "Did class happen?" after a class day? | **no**: Class days off and Move this class day are always there; nothing asks | a one-line prompt on the readout the day after each class day | BL-4 | yes |
| BL-OD-9 | Do Solo and Class-only plans also pack sessions by minutes? | **no**: unchanged, one item per session (no existing plan changes) | minutes packing for every new plan (generator v2 for all) | BL-2 | yes, for new plans |
| BL-OD-10 | *(retired by the review: every class lesson is now a practice item, so there is no class-only lesson to mark)* | — | — | — | — |
| BL-OD-11 | Does the parent see practice days this week? | **yes**: family-only `summary.practiceWeek`, "Practised on {n} days this week" with a filling strip, no denominator | no new field; the 7-day squares only | BL-W, BL-9 | yes (drop the field) |
| BL-OD-12 | Launch and the default layer | **flip both flags in BL-10** after its e2e and the multi-agent review, and at the same time make **3 practice days** the wizard's default (so the default class plan is a Class with practice plan) | keep 0 practice days (Class only) as the default for one more release; owner approval before the flip | BL-10 | yes |
| BL-OD-13 | Class lengths offered | **15, 20, 30, 45, 60 minutes** (default 30) | 10 to 30 only, like the lecture chips | BL-W, BL-4 | yes |
| BL-OD-14 | UI names | **Class day** / **Practice day** / **Refresh**; modes **Practise what class taught** / **Class and practice cover different lessons** | "Lesson day" / "Study day" | BL-D, BL-4, BL-7 | yes (strings) |
| BL-OD-15 | Class pace factor `k` | **1.5** (a 5-minute lesson takes 7.5 class minutes) | 1.0 (catalogue minutes) or 2.0; tuned by assumption (a) | BL-2 | yes (one constant) |
| BL-OD-16 | New cells a class day may open (`C_max`) | **2 in Stages 1-2, 3 above** | no cap (minutes only) | BL-2 | yes |
| BL-OD-17 | A per-learner amount of practice material | **no**: the class's amount; a learner changes days only | a learner's own minutes per practice day | — (later spec) | yes |
| BL-OD-18 | Keep the average when weeks are off | **offered, off by default** | always on; or not offered | BL-2, BL-4 | yes |
| BL-OD-19 | Practice 1-7 times a week when the class meets too (the owner's "1-7 times a week") | **yes, 1-7**: practice goes on non-class days first; above `7 - L` a class day also holds a session after class, with earlier classes' lessons or a Refresh (never that day's own lessons) | cap practice at `7 - L` days (every session on its own day; 1 class + 6 practice is the most) | BL-W, BL-1, BL-2, BL-4, BL-8 | yes (one bound) |

**Assumptions to verify:**

| # | Assumption | Verified in |
|---|---|---|
| a | Catalogue minutes are close to solo play time, and `k x` catalogue minutes is close to class time | BL-2: solo against `minutesLast7d` medians (F-REPORT-001 rollups); class against the `minutes` of `lecture.complete` (TELEMETRY-NAMES-2 row 2) divided by slides per lesson, as aggregate medians by length chip. Both aggregates only, no plan or learner id |
| b | An old app with only `cap=curriculum` parses a blended plan and derives every practice item on its date, with the weekly goal from `sessionsPerWeek` | BL-W unit test on the old schema; BL-10 e2e with an old-build fixture |
| c | The meeting block fits one screen at 1280 px and one scroll at 320 px with 200 % text | BL-D mock, BL-4 e2e |
| d | The weekly plan line fits the Route card at 320 x 568 in es and ko with 1-3 practice weekday names and with the collapsed forms: in at most 3 lines with 1 or 2 class days (Korean in 2) and at most 4 lines with 3 to 5 class days (amended in BL-7 for BL-D finding 10; the class part never collapses, section 7) | BL-D, BL-7 |

## 18. Telemetry (Worker first, BL-W; app only, the console has no telemetry client)

Section **T** of `docs/roadmap/TELEMETRY-NAMES-2.md` (the next free letter when BL-W opens):

| # | Name | Payload | Added by | Emitted by |
|---|---|---|---|---|
| 1 | `route.practice_days_changed` | `{ days: 1-7, by: 'self' \| 'grownup' }` | BL-W | BL-8 |
| 2 | `route.refresh_started` | `{ via: 'cell-check' \| 'daily-review' }` | BL-W | BL-7 |

Payload widenings of existing names (no Worker change: these names have no payload allowlist): `route.next_started` gains `fromClass: boolean` (BL-7); `route.created` is unchanged. No plan id, space id, cell id, weekday list, date or learner id is sent. Blended plan counts for the owner come from D1 (`plans.meta_json`) as aggregate queries, not from telemetry.

## 19. Strings (draft English; en, es and ko land with each row)

Console (`console.curriculum.blend.*`, BL-4): `meeting.title` "How does this class meet?" · `classDays` "Class" · `classLength` "Class length" · `practice.row` "Learners also practise on their own" · `practice.days` "times a week" · `practice.minutes` "min each time" · `practice.suggested` "Practice on {days}" · `practice.change` "Change days" · `mode.title` "How do class and practice fit together?" · `mode.overlap` "Practise what class taught" · `mode.overlapHint` "Each class's lessons come back on the practice days after it." · `mode.split` "Class and practice cover different lessons" · `mode.splitHint` "Practice days also bring new lessons from the groups class has started. Covers more, faster." · `keepAverage` "Keep the average when there are days off" · `classDayOff` "Only the class is off" · `preview.header` "About {total} sessions a week: {classDays} class day(s) ({classMin} min) and {practiceDays} practice days ({practiceMin} min each, plus about 2-3 minutes of Daily Review)." (ICU plural forms) · `preview.perDay` "Class days teach about {classItems} lessons; practice days play about {practiceItems}." · `preview.average` "{sessions} sessions in all, {teaching} a teaching week." · `preview.start` "Starts with the first class on {date}." · `preview.refresh` "Refresh" · `readout.classDays` "Class days so far: {n} of {total}" · `readout.move` "Move this class day" · `readout.addPractice` "Add practice days to this plan" · `readout.stopPractice` "Stop practice days" · `warn.itemCap`, `warn.practiceShort`, `warn.classPaced` (section 6.6) · `lecture.classDay` "Class day: {weekday} · {n} lessons" · `lecture.classLength` "Class length: {minutes} min" · `preview.everyDay` "on all 7 days" · `practice.everyDay` "Practice every day" · `practice.afterClass` "also after class on {weekday}" · `family.classLine` "In: {class} · class on {weekday}, practice {n} times a week" · `family.pause` "Pause the family weekly plan while class runs" · `family.resume` "Resume the family weekly plan" · `report.practiceWeek` "Practised on {n} days this week".

Learner (`learner.route.blend.*`, BL-7 and BL-8): `planLine` "Your class's weekly plan: class on {classDays}, practice on {practiceDays}." · `practiceMost` "practice on most days" · `practiceAllBut` "practice every day except {weekday}" · `practiceEvery` "practice every day" · `refresh` "Refresh" · `refreshLine` "Look back at what class taught." · `classToday` "Class today." · `ownResting` "Your own weekly plan is resting while your class's plan has practice days." · `ownBack` "Your own weekly plan is back." · `proposalInstead` "Your class's weekly plan has practice days for you." · `practiceDays.title` "My practice days" · `practiceDays.hint` "Pick the days you practise. Your lessons stay the same." Accessibility (`a11y.route.blend.*`): `fromClassMet` "From class. You met this in class.", `practiceDay` "Practice day, {weekday}", `refresh` "Refresh: look back at what class taught". The visible pill keeps the existing `from.teacher` key; no new visible "From class" key is added.

Every key passes the anti-shame copy test in all three locales; Korean uses the existing glossary (수업 for class, 연습 for practice); Spanish uses *clase* and *práctica*.

## 20. Tests

| File | Level | Covers |
|---|---|---|
| `content-schema/src/__tests__/curriculum-blend-params.test.ts` | unit | schema bounds (`perWeek` 1-7; 1 class + 7 practice parses), refinements, written `sessionsPerWeek = D` (4 for 1 + 3, 7 for 1 + 7), `lectureDate` before `targetDate` |
| `…/practice-days.test.ts` | unit | section 6.3 table (including `P > 7 - L`); segments; an empty segment; first and last cycle |
| `…/curriculum-golden.test.ts` (extend) | golden | C overlap, D split, E (Thursday class, Wednesday start); A and B byte-identical |
| `…/curriculum-blend.property.test.ts` | property | over random `L` 1-5, `P` 1-7, lengths, minutes, modes, start weekdays and days off: (1) every whole week holds `L + P` sessions minus days off (the route's first class day excepted when it holds practice), and every practice session has a lesson or a Refresh (a practice date before any class lesson excepted, section 5.3); a practice session on a class day holds no lesson with that `lectureDate`; (2) G3: with `P >= L`, every learn-cycle class day's lessons are at least one practice day's load, and class minutes `>= ` practice minutes per day (asserted by name for 1+1, 1+3, 2+3, 3+4); over the random plans, a held class day (review slots aside) that teaches nothing while a later one teaches carries `class-paced` (section 6.2, as built); (3) G4: every lesson with a `lectureDate` has a `targetDate` after it and within two cycles that hold a practice date (section 6.2; asserted for every `L` and `P` without days off), and with `P < L` the plan carries `practice-short`; (4) round robin: practice days of one cycle differ by at most one item; (5) no item lost or duplicated; (6) split opener invariant; (7) overlap: no item without `lectureDate`; and re-pacing (`shift`, `requeue`) at a random date keeps every class date before it, adds no duplicate, stays within 260 items and keeps the earlier Refresh entries. Random cases run with a fixed seed |
| `content-schema/src/__tests__/place-practice.property.test.ts` | property | the five `placePractice` invariants (section 9.4) for random learner days and counts (1-7, class days included); named cases: a learner day before the class day (Tuesday for a Thursday class) in overlap and split; only the class day picked |
| `backend/src/__tests__/inbox-blend.test.ts` | integration | a blended plan round-trips the Worker; the old schema parses it and keeps every item; redaction of `practiceWeek` from class rosters |
| `apps/mobile/src/logic/homework/__tests__/plan-derivation.blend.test.ts` | unit | `fromClass`; the dedupe in Class only and Class with practice; rest and resume; move, join, leave, two classes |
| `apps/mobile/src/logic/goals/__tests__/plan-days.test.ts` (extend) | unit | distinct days; union of two blended plans; learner practice days |
| `apps/mobile/src/logic/route/__tests__/refresh.test.ts` | unit | `refreshFor`; Cell Check first, Daily Review fallback; locked cells skipped |
| `content-schema/src/__tests__/lecture-presets.test.ts` (extend) | unit | `fillOutline`: every outline block kept in order at 15, 20, 30, 45 and 60 minutes (a 45- and a 60-minute outline over 30 catalogue minutes included), quiz and activity by the fill rules, at most `LECTURE_MAX_BLOCKS`; N1 with `classMinutes` uses it, N1 without it and every other preset unchanged |
| `apps/web/src/lib/console/__tests__/curriculum-blend.test.ts`, `lecture.test.ts` (extend) | unit | wizard defaults and `toParams` (0 practice days writes no `blend`); class-day outline from `lectureDate`; `classMinutes` passed for a blended plan only |
| `apps/web/e2e/route-blend.spec.ts`, `apps/mobile/e2e/web/route-blend.spec.ts` | e2e | BL-10 |

## 21. Review log

- **BL-0 (this PR).** Written from a code survey of `1bfda3fc8` (generator, params, derivation, merger, weekly goal, lecture outline, inbox gate) against the owner request of 2026-11-03. Open questions are the BL-OD rows; none blocks BL-W, BL-1 or BL-2.
- **BL-0 multi-agent review, 2026-11-03 (two reviewers: learning design; product and teacher UX; both "changes requested"; all 16 findings adjudicated, all accepted, some with a different fix).**
  - *Split openers never enter memory (high)*: accepted, fix (a). In both modes every class lesson is also a practice item after its class day (BL-OD-4b; G4; section 5). This also removed the `lecture` track, the "In class" mark (BL-OD-10 retired), the old-app projection and the `?cap=blend` capability: every item is now an ordinary practice item.
  - *Overlap caps class load by practice room (high)*: accepted. The class carries its own budget; overflow carries forward; the class carries less only under the two-cycle bound, never below one practice day's load while `P >= L`; `P < L` is defined (`practice-short`), as is an empty segment. `B_L_eff` and `lecture-underfilled` are gone. Property tests for 1+1, 1+3, 2+3 and 3+4 (G3), and 2+1 and 5+2 (`practice-short`, G4) (sections 6.2, 6.5, 20). The reviewer's 5+7 case is not valid once `L + P <= 7`; 3+4 and 5+2 replace it.
  - *Week packets vs class cycles (medium)*: accepted. Packing is per class cycle; the route starts on the first class day and ends with the last class's cycle; golden E has a Thursday class and a Wednesday start (6.3, 6.5).
  - *Class pace and the 15-minute quiz (medium)*: accepted. `k = 1.5` (BL-OD-15), `C_max` new cells per class day (BL-OD-16), `B_L = T_L - 4` at every length; assumption (a) now checks class time against `lecture.complete` minutes (6.2, 17).
  - *No spacing or interleaving delivered (medium)*: accepted with a different fix. A replayed quest item cannot work (one completion per quest, section 1.7), so spare practice room and review-cycle practice days get a **Refresh** that opens the existing Cell Check (interleaved) or Daily Review with Keep going (6.4); practice packing is round robin so each day mixes earlier and later lessons; 6.4's Leitner reading is corrected (the first device play is box 1).
  - *placePractice invariants (medium)*: accepted; five invariants, property-tested (9.4, 20).
  - *Sessions vs days when `L + P > 7`; P = 0; holidays and the average (low)*: accepted. `L + P <= 7`, so sessions are days everywhere; P = 0 is the Class only layer; **Keep the average** (BL-OD-18).
  - *Partial weeks off, class-only days off, Daily Review outside the budget (low)*: accepted. Per-mode rules and `blend.classDaysOff` (5.3); the preview names the extra 2-3 minutes of Daily Review rather than taking it out of the practice budget, because the owner's 10 minutes describes lesson time.
  - *104 sessions vs empty review-week practice (high)*: accepted, option (a) in spirit: carried lessons, then Refresh, so every session has content and 104 holds (5.3, 6.5).
  - *Greedy packing leaves practice days empty (high)*: accepted. Spread (round robin) packing for the generator and `placePractice`; extra days get Refresh rather than a repeated quest (section 1.7).
  - *Class only default leaves the overlap unfixed (medium)*: accepted, both fixes: the dedupe now applies in every layer (8), 3.2 says where the problem is fully solved, and BL-OD-12 makes 3 practice days the wizard default at the flip.
  - *"From class" tag collides with the existing pill (medium)*: accepted. One pill, with a class glyph and a longer a11y label; a test that no row shows two identical labels (7, 19).
  - *Teacher wizard too dense (medium)*: accepted. One compact block; practice days 0-6 replaces the Class only card and maps the old homework day; the mode shows only with practice; practice weekdays behind Change days (10.1).
  - *Parent "X of Y" line (low)*: accepted. "Practised on {n} days this week" with a filling strip, no denominator (11).
  - *Long weekday lists and learner vs class days (low)*: accepted. Collapse rules past 3 names; learner surfaces use the learner's days, the console the class's (7, 10.2).
  - *Owner sentences met only implicitly (low)*: accepted. The mapping table at the top; per-learner amount is BL-OD-17.
- **BL-0 verification follow-ups, 2026-11-03 (PR #952: verifier's three follow-ups and the two Codex P2 comments).**
  - *45 and 60 minute classes cut by `fillToLength` (Codex P2, verifier a)*: accepted. `fillToLength` stops at its `minutes` argument, so mapping a 45 or 60 minute class to the 30 chip would drop lessons from the deck. Section 10.3 now gives a blended class day its own path: `PresetContext.plan.classMinutes` and `fillOutline`, which keeps every outline block and sizes the quiz and activity by the real class length; no chips on that card; `fillToLength` and every other preset unchanged. BL-5's scope and tests (and section 20) assert that no lesson is cut at any class length.
  - *"1-7 times a week" vs `perWeek` max 6 (verifier b)*: accepted, the owner's range is honoured: `P` is 1-7 practice sessions a week; practice goes on non-class days first and, above `7 - L`, on class days after class with earlier classes' lessons or a Refresh (BL-OD-19, default yes; the alternative is the old cap at `7 - L`). Sessions and days now differ only above `7 - L`: the weekly goal and `sessionsPerWeek` count distinct days `D`, the console counts sessions (6.1, 6.3, 9.1, 9.4, 10.1, 17, 18, 19, 20). This supersedes the earlier "`L + P <= 7`" reading in the review entry above.
  - *Learner picks a weekday before the class day (Codex P2, verifier c)*: covered by section 9.4 invariants 1-3 (a practice item is never dated on or before its class day; in split never before its cell opener's class day; never moved to an earlier cycle). Made explicit: 9.4 states the case, and BL-8 and the `placePractice` property test name it (Tuesday for a Thursday class, overlap and split; only the class day picked).
- **BL-1 multi-agent review, 2026-11-03 (PR #960: two reviewers; one medium, the rest low or info; all adjudicated).**
  - *Split hook stops at the (C_max+1)th opener (medium)*: accepted. In split mode only the budget ends the class day: an opener past `C_max` is skipped, the packet's other lessons follow in queue order while the budget allows, a lesson whose cell opener was not taken waits for it, and `rest` is the queue minus `taken`, in queue order (5.2, BL-OD-4).
  - *Round robin within one item (low)*: recorded. With mixed minutes, days of one cycle differ by at most one item **unless the day with fewer is full**: "never over `B_P` by more than one item" wins over the even count. Property (4) of section 20 reads this way for BL-1 and BL-2.
  - *Input checks (low)*: accepted. `cyclesOf` checks practice weekdays like class days and caps `weeks` at 260; `packClass` and `spreadPractice` reject amounts that are not finite or below 0; `spreadPractice` rejects a repeated or unreal date.
  - *Where the helpers live (info)*: the 9.5 helpers are exported from the `@hangul-route/content-schema/blend` subpath, not the package index, so the start bundle does not grow; BL-2 and BL-6 import from there.
- **BL-7 multi-agent review, 2026-11-04 (PR #967: two reviewers, both "changes requested"; all findings adjudicated).**
  - *BL-D finding 10, class part with 3 to 5 class days (medium)*: decided, the bound is relaxed rather than the class part collapsed. Class days are where the learner must be, so each is named; "class on weekdays" reads differently by region and "most days" would hide which days. Section 7 and assumption d now allow 4 lines with 3 or more class days; the assumption d test builds 1 to 5 class-day weeks.
  - *"Class today." on a plan day off (medium)*: accepted; `daysOff` takes both sessions of the date (6.1), so the line stays away.
  - *Own plan back line drawn and taken away in one frame (medium)*: accepted; the line is kept for the visit like the moved line, and shows only for a resume at most 7 days old, so a resume written while the switch was off never surfaces at BL-10.
  - *`fromClass` on results and placement (low)*, *Not now on the class-plan line counted as a proposal skip (low)*, *Home and Route disagree on the week line (low)*: accepted and fixed.
  - *Screen-level tests (low)*: accepted in part: HomeworkScreen is render-tested with the switch off and on (one From class pill per row, the glyph and the reader's name only when on) and Home's plan slot on the real route store; the rest of the screen wiring is covered by the parts at 320 x 568 and the e2e spec run with `E2E_ROUTE_BLEND=1` (section 20).
  - *es and ko wording (advisory)*: accepted. es `refresh` "Repasar" (the shorter form keeps the 1.5x length budget); ko `proposalInstead` without "나를 위한" and `fromClassMet` "수업에서 배웠어요".
- **BL-10 (launch flip), 2026-11-04.** Both switches are on by default and each is a kill switch: the console's `routeBlendEnabled()` is off only for `false`, `0`, `off`, `no` or `disabled`, the app's `flags.routeBlendEnabled` only for `false`, `0`, `off`, `no` or `disabled` (`parseLectureSwitch`), so one value turns both off. The wizard opens on 3 practice days (`PRACTICE_PER_WEEK_DEFAULT`, BL-OD-12). `apps/web/e2e/route-blend.spec.ts` (wizard, preview, publish, readout, Present this plan on the class day; overlap and split; 320 and 1280, 200 % text; en, es, ko) and `apps/mobile/e2e/web/route-blend.spec.ts` (an older app's parse with the schema frozen at cf7a4e483: every practice item on its date and a weekly goal of 4; this app's Class today, Route line, From class glyph and label, Refresh; the own plan resting; a weekly goal of 4; 320, 1280, Largest text, es and ko) run on the release build without a blend setting; the BL-7 and BL-8 PWA specs drop their opt-in gate (`E2E_ROUTE_BLEND=0` skips them on a kill-switch build). An archived family reads no plan for Pause and Resume. The start bundle measures 4,866,385 B on main 76c5ad15f: the flip adds no code. The flip waits for the merge reviewer's multi-agent review (BL-OD-12).
  - *Console e2e CI lane (medium)*: deferred, recorded here. The row's flag-on lane with `ROUTE_BLEND_E2E=1` needs a `.github/workflows` change, which BL-10 does not make; issue #990 adds the job (the console e2e export with no blend setting, then `route-blend.spec.ts`, `route-blend-meeting.spec.ts`, `family-blend.spec.ts` and the blend case of `console-lecture-presets.spec.ts`, with the test output as an artifact). Until then the console side of the flip is verified locally on each PR that touches it, and the merge reviewer accepts the deferral before the draft is taken off. The app side runs in CI: `apps/mobile/e2e/web/route-blend.spec.ts` and the BL-7 and BL-8 PWA specs run in the release-build shards with the switch on by default.
  - *en / es / ko screenshots (low)*: accepted; the shots at 320 and 1280, 200 % text and Largest text are linked from the PR.
  - *Kill-switch build (low)*: accepted; `route-blend.spec.ts` (app) skips the blended views with `E2E_ROUTE_BLEND=0`, and still runs the older-app copy, the own plan resting out of sight (the resting line must then be absent) and the weekly goal, which are derivation (section 14).
  - *"Older app" overclaims (low)*: accepted; the test is named for what it runs. The frozen-schema parse is the older app's own check; the stripped copy then runs in this app, so the dates and the goal are shown to survive the strip, and the older app's own derivation (unchanged code) is covered by that parse and the Worker's `inbox-blend.test.ts`.
  - *Refresh opens the review (low)*: accepted; the test now sees the Daily Review or the Cell Check on screen.
  - *Two kill-switch parses (low)*: accepted; the console's `routeBlendEnabled()` also reads `no` as off, the same five values as `parseLectureSwitch`, so one value turns both sides off.
  - *Thinner web checks at 200 % text and in es and ko (low)*: accepted; every web test collects page errors and unexpected API calls, and the readout lines and the presented class day are checked for clipped text.
