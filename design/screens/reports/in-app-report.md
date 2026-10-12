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
What went well / What to practice next  no line actions, no notes, no Browse link on a letter
( Preview lessons )                     BR-12a's row, web only, behind the browse flag (below)
This period: figures, calendar
[ More detail v ]                       letters, totals, starting spot, level check, plan rows, skills rows
```

## Differences from the console page

| | Console | In-app |
|---|---|---|
| Header | back link, Send a note, Print | the stack's back button only (no Print, OD-7; no Send a note) |
| Glance | LR-D region with the goal line (`console.learningRoute.open`, region `console.learningRoute.section`) | "Now on" and **Open Learning Route** (`report.glance.openRoute`: the app reads the shared `report` namespace, never `messages.console.*`) as plain lines under the `h1`, with no named region (React Native has no region role; three lines need no landmark), to L1, which shows the device's own goal with its source; no goal line |
| Tabs | segmented row, roving tab stop, arrow keys | `SectionTabs` (`design/components/SectionTabs/spec.md`) with its own model: pills, selected `brand.primary` fill, wrap; **every tab is a Tab stop** (no `tabindex="-1"`), Enter or Space selects, `panelId` gives each tab `aria-controls`; no arrow-key roving (not in SectionTabs v1) |
| Insight actions | Add to a plan, Preview (P1), Open the plan | none on a line; one **Preview lessons** row under What to practice next (below) |
| Letters | links (Browse after RP-13) | plain text in sentences ("ㅂ (b)" already carries the romanization; no inline control); the More detail letter tiles are the chips that expand: disclosure buttons (`aria-expanded`, `aria-controls` the expansion, `touchTarget.min`, named by their visible letter and romanization) that open, under the tile row, the content romanization and gloss (`content/episodes/stage-1/jamo.json`) |
| Calendar | may show dashed "not saved yet" cells | no dashed cells: the device's own practice is complete up to today. A profile that also practices on another device shows those days once this device has pulled them; until then they draw as empty outlines. This is an accepted v1 limit, recorded in the spec's review log for RP-9 (the sentence under the calendar lists practiced days only and never says a day was missed) |
| Plan rows | family or class rows | `report.detail.planRow.device` (every plan on the device and the own route) |
| Skills | not shown (OD-8) | the skills rows in More detail (below) |
| Words | hidden until F-VOC-005 P-4b | hidden too |

## Open Learning Route

The link navigates on the root stack to `MyRoute { source: 'parent', profileId: <this report's profileId>, viewer: 'grownup' }`, the read-only grown-up view (L1), never the active profile's route and never the learner-facing page with play buttons. Back returns to `LearnerReport`. RP-9's test asserts both `profileId` and `viewer`. The link renders only when L1 exists on the build (spec section 3.6).

## Preview lessons (reserved for F-BROWSE-001 BR-12a)

F-BROWSE-001 section 4.11 item 2 and its BR-12a row put a **Preview lessons** entry in the in-app report. Its place is drawn here: one LR-D `link-button` (`touchTarget.min` tall) at the end of the What to practice next section, after its lines, never inside a line. It opens `{ kind: 'stage', stage: journey.here }` (else `stage1`) through `openBrowseFromGate` with source `'report'`, content ids only. It renders only where BR-12a renders it: on web, with the browse flag on; otherwise the section ends with its lines. Letters stay disclosures (section 3.9), so this row is the app report's only way into Browse. RP-9 leaves the slot to BR-12a (it does not render the row itself); the label is F-BROWSE-001's word (its "One name everywhere" rule), added by BR-12a.

## Skills rows (device only, OD-8)

The last block of More detail, drawn as `SkillsCard` draws them on the Learning Route (`screens/my-route/SkillsCard.tsx`), read-only:

- `h3`: `caregiver.journey.skillsTitle(name)` ("What Sam's quests practice"); on a self-only device `learner.myRoute.skills.title`.
- One row per skill, at least `touchTarget.min`: the glyph (`book`, `ear`, `pencil`, 28, `text.secondary`), the label (`learner.myRoute.skill.read` / `listen` / `write`, semibold), the done pips (`PipRow` done shape in `SKILL_ACCENT`: `stage.stage1`, `stage.stage4`, `stage.stage7`) and at most one faint next slot; under it `caregiver.journey.quests(name, n)` (self-only: `learner.myRoute.skill.quests(n)`).
- Then `caregiver.journey.tiles(n)` and `caregiver.skillsNote` (`size.caption` `text.muted`). Reading, listening and writing only.

## Voice (OD-17)

The second voice is for an adult learning alone reading their **own** report. RP-9 renders `voice: 'second'` when both hold:

- the device is self-only: `deviceAudience(profiles) === 'self'` (`logic/profiles/learner-type.ts`; every learner profile is effectively an adult), and
- the report's `profileId` is the device's active profile.

Otherwise it renders third person. `gateOpensDirectly` is **not** the check: it is also true while a grown-up session is open (`sessionOpen || !gateRequired(...)`, `logic/profiles/gate-route.ts`), and `LearnerReport` is only reached through that gate, so it would be true for a parent on a shared family device too. It stays the entry rule (whether **See report** opens directly or through `PinEntry`), nothing more.

In the second voice every sentence that names the learner uses its `report.you.*` twin: `you.title`, `you.headline.*`, `you.insight.*`, `you.detail.lettersStrong`, `you.state.empty`, `you.tip.*`. Lines that do not name the learner ("More practice time than last week: 36 minutes.", "2 plan items are ready to play.") read the same in both voices. The board's first item draws the whole screen in the second voice.

RP-9's tests for the voice: a family device with the grown-up session open renders third person; a self-only device viewing another self profile's report renders third person; a self-only device viewing the active profile's report renders second person (with and without an open session).

## States (board `mock/in-app-report-states.html`)

| State | Drawn |
|---|---|
| self-only device | second voice throughout, skills in second person |
| empty | `report.state.empty(name)` and the app's next line; the self-only text `report.you.state.empty` is drawn under it as a labelled alternative |
| no practice in the window | `headline.noneYet`, no What went well, `insight.rhythm` first |
| All time | the growth block with its table open (as `learner-report.md`) |
| a letter tile tapped | every tile has `aria-controls` naming its own expansion under the tile row (closed, `hidden`); tapping turns `aria-expanded` true and opens it: the letter large (`size.display`) beside its content romanization (bold) and gloss (`text.muted`) on `surface.sunken`. Tapping again closes it |
| error | `report.state.error` and `common.buttons.tryAgain` (a primary `Button`); never a crash screen |
| loading | a brief skeleton while the local summary is computed (as the console's skeleton blocks; not drawn again) |
| offline | identical to success: local data only |
| entry | **See report** (`report.action.seeReport`) as a primary `Button` on each profile card of the grown-up dashboard; the card's other rows unchanged. Absent with the flag off |

**First screen at 390 x 844**: the headline ends at 541 px and the first went-well line at 612 px.

## Accessibility

- The stack's back button is labelled `common.buttons.back`. Tabs are `SectionTabs` with the row named `a11y.report.periods` and `a11y.report.periodChanged` announced on change; every tab is a Tab stop and Enter or Space selects (SectionTabs' model; the console's roving tab stop is not used here).
- Calendar and growth line carry the same text alternatives as the console; letter tiles announce the letter (`lang="ko"`) and its romanization from their visible content, plus their expanded state.
- Tabs: each `SectionTabs` tab has `aria-controls` the report panel, and the report below the tabs is the `tabpanel` labelled by the selected tab (as the console, `learner-report.md`).
- Read-only: nothing on this screen writes progress or changes the active profile; `report.viewed` goes without `profileId` (spec section 3.13).
