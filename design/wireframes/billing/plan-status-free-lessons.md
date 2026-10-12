# Billing/Plan screen — the free-plan lines (wireframe v2; a state of `billing/plan-status.md`)

> **Header note.** The learner **Plan** screen (route key `Paywall`, title "Plan", status only, no price anywhere, web-only **Open billing**, nothing on native) is owned by F-BILL-002 §4.7 and drawn in `billing/plan-status.md`. This file draws only the lines F-ENT-003 adds to its free and premium states. It replaces revision 1's `paywall/free-plan-days.md`, which drew a price-bearing paywall that F-BILL-002 removes.

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.9.1 (Plan screen lines), §3.9.4 (subscribers without a plan), §3.11 (glossary), §3.15 (child safety) · F-BILL-002 §4.7, §4.8, §6.2
Audience: **parent or self-learner** — reached only through `profiles/pin-entry` (or directly on a self-only device with no PIN, `gateOpensDirectly`)
Code: the Plan screen of F-BILL-002 B-9 (`apps/mobile/src/screens/paywall/`), `apps/mobile/src/logic/paywall.ts` (`paywallState`), `packages/content-schema/src/catalog/route-days.ts` (`freeLessonsFacts`), `packages/i18n` `caregiver.plan.freePlan`

## Scenario (Given-When-Then)

Given: a learner pressed the ask button on a lesson that is not open yet, on the one-time free-end card or on a closed Library tile, and an adult passed the gate (switch on, learner free); or an adult opened Plan details from Profile
When: the Plan screen renders
Then: the adult reads, in one line built from data, exactly what is free and that everything finished stays; one extra line explains a situation (class learner, free lessons finished); no price, no offer, no purchase wording

## Screen goal

"Say what is free, plainly, in one line; F-BILL-002 does the rest."

## Box diagram (free state, effective switch on; F-BILL-002 parts in brackets)

```
+--------------------------------------------+
| [<- back]          Plan                    |  <- F-BILL-002
|                                            |
| [ Mina is on the free plan. ]              |  <- F-BILL-002 title (self: "You're on the free plan.")
| Stage 1 is free: 11 lessons, 24 letters,   |  <- freePlan.line (numbers from data; all of
| about 50 minutes. Everything finished      |     Stage 1, F-ENT-003 OD-1; 15 lessons once
| stays.                                     |     Stage 1 is complete)
|   - 4 word topics                          |  <- What is free list; 0-count lines hidden
|                                            |     (no story bundled today: no stories line)
| Mina's teacher can open every lesson for   |  <- at most one extra line (see States)
| the class.                                 |
|                                            |
| [ Open billing ]   (web only)              |  <- F-BILL-002 (label, target, caption)
| [ Plans and receipts are on the billing    |  <- F-BILL-002
|   page for grown-ups. ]  (web only)        |
+--------------------------------------------+
```

- F-ENT-003 adds no price, no product card, no offer bullets, no button and no link. Native builds show no button and no web wording (F-BILL-002 §4.8 deny list applies to these lines too).
- Every number comes from `freeLessonsFacts(CATALOG)` and the build's bundle; none is typed in a string.
- No countdown, no "limited time", no "trial", no "day", no comparison with other learners.

## Interaction points

- None added. [<- back] and the web-only **Open billing** are F-BILL-002's.
- Opening fires `paywall.viewed { state, from }` (F-BILL-002 keeps it); `from` gains `episode`, `home`, `results`.

## Navigation graph

Enter from: `profiles/pin-entry` (next: Paywall) from `episode/detail-access-preview`, `home/next-and-free-end-card`, `results/back-to-plan-and-free-end`, `library/access-and-plan-tags`; Profile plan card **Plan details**
Exit to: the opening surface · the billing page on app.hangulroute.com (web only, F-BILL-002)

## States

- **Free, switch on**: `freePlan.line(lessons, letters, minutes)` (or `lineNoLetters` when the free lessons teach no letter) plus the What is free list. Then at most one extra line, first that applies:
  1. Learner only in a class or school: family "{name}'s teacher can open every lesson for the class." / self "Your teacher can open every lesson for the class."
  2. Free lessons finished (`free-end`): family "{name} finished the free lessons." / self "You finished the free lessons."
- **Free, switch off, or any native build**: F-BILL-002's line "Stage 1 is always free." (`caregiver.plan.free.open`) unchanged; no F-ENT-003 line. It stays true with the switch on (OD-1).
- **Premium, no plan** (item 10): one line under F-BILL-002's premium lines, "Set a plan to guide what comes next."; on the web also "Plans are made in the grown-up area: Plan the term." (no link).
- **Premium with a plan, covered**: F-BILL-002's states unchanged; no F-ENT-003 line.
- **Empty** (catalogue has no free lesson, impossible by test): the line is hidden.
- **Error** (bundle facts unreadable): the line is hidden; F-BILL-002's title stays.

## Accessibility

- The line is plain body text after F-BILL-002's summary heading (`a11y.planStatus`); the What is free list is a list; numbers are read inside the sentence. Body text 18 or larger; 200 % text reflows.

## Data needs

- `freeLessonsFacts(CATALOG)`; sampler stories in this build's bundle; free topics playable in this build; the learner's memberships (class-only); `routeNext` (`free-end`); `paywallState(tier, source)` (F-BILL-002); `gatingActive`.

## Open questions

- OD-9 (default: the line replaces "Stage 1 is always free." while the switch is on, adding the figures). OD-1 decided 2026-10-11 (all of Stage 1 is free; OD-12 promise line withdrawn).
