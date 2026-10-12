# In-app report: LearnerReport behind the grown-up gate (screen spec v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` sections 3.1, 3.5, 3.6, 3.9, 3.12, 3.13 · wireframe `design/wireframes/reports/in-app-report.md`
Mock: `mock/in-app-report.html` (shared device, third person), `mock/in-app-report-states.html` (board)
Shots: `shots/in-app-report-390-first.png`, `-375.png`, `-1280.png`, `in-app-report-states-375.png`, `-1280.png`
Code (planned): RP-9, `screens/parent/LearnerReportScreen.tsx` (stack screen `LearnerReport { profileId }`), the **See report** button on `ParentDashboardScreen` profile cards

## Layout

A learner-app stack screen drawn as HTML with LR-D's app rules: one centred column of at most `layout.maxWidth.reading`, gutters `layout.gutter.compact` / `.regular` (600) / `.wide` (900), parts `spacing.lg` apart. The same three layers as the console, single column at every width.

```
( < )                                   back to the dashboard (icon button, touchTarget.min)
Sam: report                             h1; "Your report" on a self-only device
Now on Stage 1: Hangul
( Open Learning Route )                 opens L1 for this report's profile, read-only (see below)
Last practice: Oct 12
( Today ) ([This week]) ( This month )  SectionTabs: pills, wrap to two rows at 375
( All time )
( < Last week )  Oct 6 to Oct 12
Sam practiced on 3 days this week.
What went well / What to practice next  no actions, no notes, no Browse links
This period: figures, calendar
[ More detail v ]                       letters, totals, starting spot, level check, plan rows, skills rows
```

## Differences from the console page

| | Console | In-app |
|---|---|---|
| Header | back link, Send a note, Print | the stack's back button only (no Print, OD-7; no Send a note) |
| Glance | LR-D region with the goal line | "Now on" and **Open Learning Route** (`console.learningRoute.open`, in the region labelled `console.learningRoute.section`) to L1, which shows the device's own goal with its source; no goal line |
| Tabs | segmented row | `SectionTabs` (`design/components/SectionTabs/spec.md`): pills, selected `brand.primary` fill, wrap |
| Insight actions | Add to a plan, Open the plan | none |
| Letters | links (Browse after RP-13) | plain text in sentences ("ㅂ (b)" already carries the romanization; no inline control); the More detail letter tiles are the chips that expand: disclosure buttons (`aria-expanded`, `aria-controls` the expansion, `touchTarget.min`, named by their visible letter and romanization) that open, under the tile row, the content romanization and gloss (`content/episodes/stage-1/jamo.json`) |
| Calendar | may show dashed "not saved yet" cells | no dashed cells: the device's own practice is complete up to today. A profile that also practices on another device shows those days once this device has pulled them; until then they draw as empty outlines. This is an accepted v1 limit, recorded in the spec's review log for RP-9 (the sentence under the calendar lists practiced days only and never says a day was missed) |
| Plan rows | family or class rows | `report.detail.planRow.device` (every plan on the device and the own route) |
| Skills | not shown (OD-8) | the skills rows in More detail (below) |
| Words | hidden until F-VOC-005 P-4b | hidden too |

## Open Learning Route

The link navigates on the root stack to `MyRoute { source: 'parent', profileId: <this report's profileId>, viewer: 'grownup' }`, the read-only grown-up view (L1), never the active profile's route and never the learner-facing page with play buttons. Back returns to `LearnerReport`. RP-9's test asserts both `profileId` and `viewer`. The link renders only when L1 exists on the build (spec section 3.6).

## Skills rows (device only, OD-8)

The last block of More detail, drawn as `SkillsCard` draws them on the Learning Route (`screens/my-route/SkillsCard.tsx`), read-only:

- `h3`: `caregiver.journey.skillsTitle(name)` ("What Sam's quests practice"); on a self-only device `learner.myRoute.skills.title`.
- One row per skill, at least `touchTarget.min`: the glyph (`book`, `ear`, `pencil`, 28, `text.secondary`), the label (`learner.myRoute.skill.read` / `listen` / `write`, semibold), the done pips (`PipRow` done shape in `SKILL_ACCENT`: `stage.stage1`, `stage.stage4`, `stage.stage7`) and at most one faint next slot; under it `caregiver.journey.quests(name, n)` (self-only: `learner.myRoute.skill.quests(n)`).
- Then `caregiver.journey.tiles(n)` and `caregiver.skillsNote` (`size.caption` `text.muted`). Reading, listening and writing only.

## Voice (OD-17)

On a self-only device (`gateOpensDirectly`), every sentence that names the learner uses its `report.you.*` twin: `you.title`, `you.headline.*`, `you.insight.*`, `you.detail.lettersStrong`, `you.state.empty`, `you.tip.*`. Lines that do not name the learner ("More practice time than last week: 36 minutes.", "2 plan items are ready to play.") read the same in both voices. The board's first item draws the whole screen in the second voice.

## States (board `mock/in-app-report-states.html`)

| State | Drawn |
|---|---|
| self-only device | second voice throughout, skills in second person |
| empty | `report.state.empty(name)` and the app's next line; the self-only text `report.you.state.empty` is drawn under it as a labelled alternative |
| no practice in the window | `headline.noneYet`, no What went well, `insight.rhythm` first |
| All time | the growth block with its table open (as `learner-report.md`) |
| a letter tile tapped | the tile's `aria-expanded` turns true and the expansion opens under the tile row: the letter large (`size.display`) beside its content romanization (bold) and gloss (`text.muted`) on `surface.sunken`. Tapping again closes it |
| error | `report.state.error` and `common.buttons.tryAgain` (a primary `Button`); never a crash screen |
| loading | a brief skeleton while the local summary is computed (as the console's skeleton blocks; not drawn again) |
| offline | identical to success: local data only |
| entry | **See report** (`report.action.seeReport`) as a primary `Button` on each profile card of the grown-up dashboard; the card's other rows unchanged. Absent with the flag off |

**First screen at 390 x 844**: the headline ends at 541 px and the first went-well line at 612 px.

## Accessibility

- The stack's back button is labelled `common.buttons.back`. Tabs are `SectionTabs` with the row named `a11y.report.periods` and `a11y.report.periodChanged` announced on change.
- Calendar and growth line carry the same text alternatives as the console; letter tiles announce the letter (`lang="ko"`) and its romanization from their visible content, plus their expanded state.
- Tabs: each `SectionTabs` tab has `aria-controls` the report panel, and the report below the tabs is the `tabpanel` labelled by the selected tab (as the console, `learner-report.md`).
- Read-only: nothing on this screen writes progress or changes the active profile; `report.viewed` goes without `profileId` (spec section 3.13).
