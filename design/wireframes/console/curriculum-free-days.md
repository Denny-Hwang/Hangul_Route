# Console/Curriculum wizard — lessons past Day 2 for an unlicensed space (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.6 (derivation), §3.9 (console wizard) · extends `console/curriculum-planner.md` (F-PLAN-002 §3.8: preview, warnings, publish)
Audience: **teacher or parent** (signed-in console). No learner sees this screen.
Code: `apps/web/src/lib/console/curriculum.ts` (`unlockedStagesForSpace`), `apps/web/src/components/console/CurriculumParts.tsx`, `apps/web/src/lib/console/config.ts` (`contentGatingEnabled()`), `packages/content-schema/src/curriculum/generate.ts`

## Scenario (Given-When-Then)

Given: a teacher (free class) or a parent (family space without a purchase) builds a curriculum while the free-plan switch is on for the console build
When: the wizard shows the preview
Then: the plan holds only lessons that will open for these learners (Day 1 and Day 2, plus stories), and one invitational line says how many lessons were left out and what opens them, with the existing link to billing

## Screen goal

"Publish a plan that will really open on the learners' devices, and know why some lessons are not in it."

## Box diagram (preview step, the part that changes)

```
+------------------------------------------------------+
| Plan preview                              [ Back ]   |
|                                                      |
| Week 1  Meet the Letters     Sun letters-q1 ...      |
| Week 2  Around the Korean... Sun life-q1 ...         |
| Week 3  Stories and words    Sun story ...           |
| ...                                                  |
|                                                      |
| +--------------------------------------------------+ |
| | (i) {n} lessons past Day 2 open with a Family    | |  <- warning `premium-needed`,
| |     Lifetime or a Group License. They are left   | |     new wording for this case
| |     out of this plan.     [ See plans -> billing ]| |
| +--------------------------------------------------+ |
|                                                      |
| [[ PUBLISH ]]                  [ Save draft ]        |
+------------------------------------------------------+
```

- A licensed space never sees this line (nothing is left out).
- With the console switch off, the wizard behaves as today (Stage 1 for an unlicensed space).
- No learner name, no ranking, no per-learner list in the warning.

## Interaction points

- [ See plans ] -> console billing (today `/teach/billing`; moved by the billing-on-app spec).
- [[ PUBLISH ]] -> publishes the plan (unchanged); devices derive only open items.
- Re-pace (later) -> the wizard passes the free quest ids again (`regenerateFrom` opts), because they are never stored in `meta`.

## Navigation graph

Enter from: roster page "Plan term" · family row "Plan term" · plan switcher
Exit to: roster page (after publish) · billing · back to the previous wizard step

## States

- **Unlicensed, switch on**: as drawn.
- **Licensed**: no warning; all ready lessons scheduled.
- **Switch off**: today's behaviour.
- **Empty** (nothing open to schedule): the existing `content-runs-out` / free-practice weeks; the warning still states the left-out count.
- **Error** (entitlements request fails): today's error state; the wizard treats the space as unlicensed for the preview (fail safe for publishing: nothing scheduled that will not open).

## Accessibility

- The warning is a status region read after the preview heading; its link is a real link with its text as label. Keyboard order: preview, warning, Publish, Save draft.

## Data needs

- `GET /api/entitlements` (existing) -> `unlockedStagesForSpace`; `contentGatingEnabled()` from `NEXT_PUBLIC_CONTENT_GATING_ENABLED`; `freeRouteQuestIds(CATALOG)`; generator `locked[]` count.

## Open questions

- OD-5 (default: free classes follow the Day 1 and Day 2 rule). Beta check: how many free classes publish a plan with the warning shown.
