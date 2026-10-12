# Console and grown-up zone — the free-lessons line on learner cards and reports (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.9.2 (`freeLessonsLine`), §3.11 (glossary), §3.15 (privacy) · hosts: the console roster cards (`console/roster.md`), the F-APP-001 parent home child card (`shell/parent-home.md`, sibling branch), the on-device parent dashboard child row (`parent/dashboard.md`), the F-REPORT-001 learner report next-steps block (`reports/learner-report.md`, sibling branch)
Audience: **parent or teacher who owns the space** (console), or the grown-up on the learner's device behind the gate. Never a learner; never a teacher who does not own the space.
Code: `packages/content-schema/src/catalog/free-lessons-line.ts` (pure), `apps/web/src/lib/console/free-lessons-line-view.ts`, the roster card component, `apps/mobile/src/screens/parent/` (dashboard child row), `packages/i18n` `console.access`, `caregiver.access`

## Scenario (Given-When-Then)

Given: the free-plan switch is on, the space is not covered (no Family Plan, no Group License), and the viewer owns the space
When: the grown-up looks at a learner's card or report
Then: a learner who has done everything open sees one calm line saying so and naming what opens more, with Open billing; no price, no ranking, no comparison, nothing when the data cannot tell

## Screen goal

"A grown-up sees why a learner has nothing new to do, on their own screen, without asking the child."

## Box diagram — A. console roster card (family or class)

```
+--------------------------------------------------+
| [avatar] Mina                         [ Open ]   |
| Last active: today · 25 minutes this week        |  <- existing figures (unchanged)
| Plan: 9 done                                     |  <- existing plan row (notReady never "locked")
|                                                  |
| Mina finished everything open in this plan.      |  <- plan-waiting line (one line, body text)
| 3 more lessons open with a Group License.        |
| Open billing                                     |  <- link, space owner only
+--------------------------------------------------+
```

## Box diagram — B. on-device parent dashboard child row (behind the gate)

```
+--------------------------------------------------+
| Mina                                              |
| ...existing rows...                               |
| Mina finished the free lessons. Stage 2 and later |  <- free-end line (exact: from the snapshot)
| open with the Family Plan.                        |
| Open billing  (web build only)                    |
+--------------------------------------------------+
```

## Box diagram — C. learner report, practice next block (F-REPORT-001 row P6)

```
Practice next
 - Revisit these letters: [ko] [ko]               <- existing rows
 - On the free plan, all of Stage 1 is open        <- free-plan line (neutral), or plan-waiting;
   (11 lessons). Stage 2 and later open with          the count is freeLessonsFacts().lessons
   the Family Plan.                                   (all of Stage 1, F-ENT-003 OD-1)
   Open billing
```

- Product name by space kind: family -> "the Family Plan" (renamed from "Family Lifetime" 2026-10-11, `AMENDMENTS-BILLING-FAMILY-YEARLY.md` [BY]); class or school -> "a Group License". No price anywhere.
- Lines are codes from `freeLessonsLine` turned into strings by the host; no string is built from free text.
- No "behind", "stuck", "only", "trial", "day", no comparison with another learner, no class figure.

## Interaction points

- Open billing -> console: the Billing route (F-BILL-002 / F-APP-001 own the path); device web build: `billingUrl()` (F-BILL-002); native: no link.
- No other action; the line never changes learner data.

## Navigation graph

Enter from: parent home (F-APP-001) · class or family roster · on-device grown-up zone · learner report (F-REPORT-001)
Exit to: billing page · the learner report / Learning Route (existing card actions)

## States

- **Console, plan-waiting** (F-ENT-003 section 3.9.2, revision 3.2): a live plan of this space that reaches the learner has `done === total > 0` and `notReady > 0`, holds closed lessons (`planFreeFacts`), has no open item past the horizon measured from the device's last derivation day, and the device skipped at least as many items as the closed lessons inside that horizon -> card line A with `{closed}` = the plan's closed-lesson count. **Open billing** is described by its line, so several cards never list identical links without context.
- **Console, any other case**: no line on the card (the console cannot tell which lessons were finished; it never guesses). The report page shows the neutral `free-plan` line C.
- **Device, free-end** (row E3-12b, after E3-4): `routeNext` for that learner is `free-end` -> row line B.
- **Covered space, switch off, viewer not the owner**: nothing.
- **Empty** (no learners): unchanged empty state of the host.
- **Error** (entitlements request failed): no line (never claim a limit the console cannot confirm).

## Accessibility

- The line is plain text inside the card; the link is a real link with its text as label, `touchTarget` on phone width. Read after the card's figures.

## Data needs

- Console: the roster summary's `planProgress` for this space's plans (existing), the account's `GET /api/entitlements` (existing, already called for Billing), `contentGatingEnabled()`, the viewer's ownership of the space (existing roster role). No new field.
- Device: the learner's snapshot, `accessTier`, `gatingActive`, `routeNext`.

## Open questions

- None; wording follows the glossary of F-ENT-003 §3.11.
