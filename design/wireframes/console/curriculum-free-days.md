# Console/Curriculum wizard — lessons left out for an unlicensed space, and plans that end early (wireframe v2)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.6 (derivation), §3.9.3 (console wizard), §3.11 (glossary) · extends `console/curriculum-planner.md` (F-PLAN-002 §3.8: preview, warnings, publish)
Audience: **teacher or parent** (signed-in console). No learner sees this screen.
Code: `apps/web/src/lib/console/curriculum.ts` (`unlockedStagesForSpace`, warning text), `apps/web/src/components/console/CurriculumParts.tsx`, `apps/web/src/lib/console/config.ts` (`contentGatingEnabled()`); the generator (`packages/content-schema/src/curriculum/generate.ts`) is unchanged (F-ENT-003 OD-1)

## Scenario (Given-When-Then)

Given: a teacher (free class) or a parent (family space without a purchase) builds a curriculum while the free-plan switch is on for the console build
When: the wizard shows the preview
Then: the plan holds only lessons that will open for these learners (all of Stage 1, plus stories; the stage rule the wizard already uses), one line says how many lessons were left out and which product opens them, and the preview says plainly when the plan's lessons end early, with a one-tap shorter length

## Screen goal

"Publish a plan that will really open on the learners' devices, know why some lessons are not in it, and avoid a plan that is mostly empty."

## Box diagram (preview step, the part that changes)

```
+------------------------------------------------------+
| Plan preview                              [ Back ]   |
|                                                      |
| Week 1  Meet the Letters     Sun letters-q1 ...      |
| Week 2  Meet the Letters...  Sun letters-q3 ...      |
| Week 3  Around the Korean... Sun life-q2 ...         |
| Week 4  Review                                       |
| Week 5  New Year & Festi...  Sun rites-q1 ...        |
| Week 6  New Year & Festi...  Sun rites-q3 ...        |
| Week 7  Yut, Kites & Paper   Sun crafts-q1 ...       |
| Week 8  Review                                       |
| ...                                                  |
|                                                      |
| +--------------------------------------------------+ |
| | (i) The free plan covers Stage 1 (lessons in     | |  <- warning `premium-needed` (new
| |     weeks 1 to 7). 3 more lessons open with a    | |     wording), product by space kind:
| |     Group License. They are left out of this     | |     class/school: a Group License
| |     plan.                     [ Open billing -> ] | |     family: the Family Plan [BY]
| +--------------------------------------------------+ |
|                                                      |
| This plan has lessons until week 7. After that it    |  <- short-plan line (only when the
| has stories and practice.   ( [ Use {weeks} weeks ] )|     plan runs longer than its lessons)
|                                                      |
| [[ PUBLISH ]]                  [ Save draft ]        |
+------------------------------------------------------+
```

- Drawn: a free class, 12 weeks, 2 sessions a week, today's catalogue (11 Stage 1 lessons; `stage2-life`, `stage2-nature` and `stage4-rites` left out). Numbers come from the draft (the `premium-needed` count, the last week with a lesson); never typed.
- `( [ Use {weeks} weeks ] )` shows only when a shorter length preset holds every lesson: not for this class today (4 weeks at 2 sessions hold 8 of the 11 lessons); 4 weeks for a family at 3 sessions a week.
- A licensed space never sees the warning (nothing is left out).
- With the console switch off, the wizard behaves as today (Stage 1 for an unlicensed space, the existing warning wording).
- No learner name, no ranking, no per-learner list, no price, no "day" in the warning.

## Interaction points

- [ Open billing ] -> the console's Billing route (F-BILL-002 / F-APP-001 own its path).
- [ Use {weeks} weeks ] -> re-runs the preview with that length preset; shown only when a shorter preset holds every lesson. Publishing the long plan stays allowed.
- [[ PUBLISH ]] -> publishes the plan (unchanged); devices derive only open items.
- Re-pace (later) -> unchanged: the stage rule is re-applied from the space's licence as today; no extra generator input (OD-1).

## Navigation graph

Enter from: roster page "Plan term" · parent home "Plan the term" (F-APP-001) · plan switcher
Exit to: roster page (after publish) · billing · back to the previous wizard step

## States

- **Unlicensed, switch on, plan longer than its lessons**: as drawn.
- **Unlicensed, switch on, plan fits** (for example 4 weeks): warning only, no short-plan line.
- **Licensed**: no warning, no short-plan line; all ready lessons scheduled.
- **Switch off**: today's behaviour.
- **Empty** (nothing open to schedule): the existing `content-runs-out` / free-practice weeks; the warning still states the left-out count.
- **Error** (entitlements request fails): today's error state; the wizard treats the space as unlicensed for the preview (fail safe for publishing: nothing scheduled that will not open).

## Accessibility

- The warning is a status region read after the preview heading; its link is a real link with its text as label. Keyboard order: preview, warning, short-plan line and button, Publish, Save draft.

## Data needs

- `GET /api/entitlements` (existing) -> `unlockedStagesForSpace`; `contentGatingEnabled()` from `NEXT_PUBLIC_CONTENT_GATING_ENABLED`; generator `premium-needed` count and week list; `LENGTH_PRESETS` for the shorter length.

## Open questions

- OD-5 (default: free classes follow the free-lessons rule, all of Stage 1 since OD-1). Beta check: how many spaces use "Use {weeks} weeks".
