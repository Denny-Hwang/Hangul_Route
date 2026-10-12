# Billing/Plan status — the learner's plan, status only (wireframe v2)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.7, §4.8, §4.12 · supersedes the body of `paywall/upgrade.md` (F-ENT-001 §3.5) · free-plan lines: `billing/plan-status-free-lessons.md` (F-ENT-003 §3.9.1, E3-8) · gate for Open billing: `profiles/pin-entry` · hand-off: F-APP-001 `openGrownUpArea`
Screen ID: `billing/plan-status` · Navigation route key stays `Paywall` (title "Plan")
Audience: **any learner** (status, no PIN), **their grown-up** for Open billing (after the PIN gate) on a family device, and **the learner themself** on a self-only device (the gate opens directly when no PIN is set). Same screen for every age; no age wording.

## Scenario (Given-When-Then)

Given: a learner profile on the free plan, on the full route from a family plan, or covered by a class or school
When: the learner opens Plan details from Profile, or a grown-up arrives through a locked-lesson "Ask a grown-up" (F-ENT-003)
Then: they see which plan this learner is on and where it comes from; on the web a grown-up can open Billing in the same tab after the gate; there is never a price, and native builds show no link or mention of buying elsewhere

## Screen goal

"Say which plan this learner is on, and where a grown-up manages it (web only)."

## Box diagram

Web, free plan, family audience, F-ENT-003 switch off:

```
+-----------------------------------+
| [< back]          Plan            |
|                                   |
|         [ Hoya, idle pose ]       |
|                                   |
|  <Name> is on the free plan.      |  <- summary heading (first accessible element)
|  Stage 1 is always free.          |  <- free slot: this spec's line until E3-8, and whenever F-ENT-003's switch is off
|                                   |
|  Plans and receipts are on the    |  <- web only (self: "Your plan and receipts are
|  billing page for grown-ups.      |     on the billing page.")
|  [ Open billing ]                 |  <- web only, secondary; PIN gate first, then same tab
|                                   |
|  [[ BACK TO JOURNEY ]]            |
+-----------------------------------+
```

Web, free plan, F-ENT-003 switch on (the slot holds F-ENT-003's free-plan lines; no offer, no price, no button, no link inside it; exact words in `billing/plan-status-free-lessons.md`):

```
|  <Name> is on the free plan.      |
|  [ F-ENT-003 free-lessons line:   |  <- counts from data, never typed
|    all of Stage 1: lessons,       |
|    letters, minutes; everything   |
|    finished stays ]               |
|  [ optional: stories, word topics]|
|  [ optional: one situation line ] |
|  Plans and receipts are on the    |
|  billing page for grown-ups.      |
|  [ Open billing ]                 |
```

Native (iOS / Android), free plan:

```
+-----------------------------------+
| [< back]          Plan            |
|         [ Hoya, idle pose ]       |
|  <Name> is on the free plan.      |
|  Stage 1 is always free.          |
|                                   |
|  [[ BACK TO JOURNEY ]]            |  <- no link, no price, no "web" wording
+-----------------------------------+
```

Other states (web and native identical except the web-only block):

```
full route, family source | [ Hoya, cheering ] | <Name> has the full route.    | From your family's Family Lifetime plan. | [ guidance slot: F-ENT-003 line, may be empty ] | (web: caption + Open billing) | [[ BACK TO JOURNEY ]]
full route, no source     | [ Hoya, cheering ] | <Name> has the full route.    | Everything is open.                      | (web: caption + Open billing) | [[ BACK TO JOURNEY ]]
covered (class / school)  | [ Hoya, cheering ] | <Name> is covered by <space>. | Everything is open while they are in it. |                               | [[ BACK TO JOURNEY ]]
self audience             | "You're on the free plan." · "You have the full route." · "From your Family Lifetime plan." · "You're covered by <space>." · "Everything is open while you are in it."
```

Profile card entry (every tier; no PIN for Plan details):

```
| Plan                      [ Free ]  |      | Plan                    [ Active ] |
| Free plan                           |      | Full route                         |
| Stage 1 is free. More stages are on |      | Everything is open, from <space>.  |
| the way.                            |      |                                    |
| [ Plan details ]                    |      | [ Plan details ]                   |
```

## Interaction points

- `[ Plan details ]` (Profile, every tier) → this screen, no PIN
- `[ Open billing ]` (web only) → `profiles/pin-entry` with destination `Billing` (opens directly while a grown-up session is open, or on a self-only device without a PIN) → with F-APP-001's flag on: `openGrownUpArea({ via: 'paywall', target: APP_ROUTES.billing })`, the **same tab**, no "Grown-ups only" lock → `billing/billing-home`; flag off (before F-APP-001 A-6): today's console billing URL in the browser. Failure → one line with the address to type.
- `[[ BACK TO JOURNEY ]]` → `journey/grid`
- `[< back]` → where the learner came from (`profile/settings`, or the lesson page through the gate)

## Navigation graph

Enter from: `profile/settings` plan card (Plan details) · F-ENT-003 locked-lesson "Ask a grown-up" (through `profiles/pin-entry`)
Exit to: `journey/grid` · `profile/settings` · `profiles/pin-entry` → `billing/billing-home` (web only, same tab)

## States

- **free** (switch off / on), **full route**, **covered**: as drawn.
- **offline / no cached tier**: the state the tier store gives (7-day grace; free when nothing is cached); nothing claims a purchase failed. Open billing then leads to F-APP-001's grown-up offline page.
- **empty** (no active profile): "Your learner" stands in for the name.
- **error** (billing could not be opened, web): "Open <address> in a browser."

## Accessibility

- The summary line is the first accessible element (`a11y.planStatus`: "<Name>: <state>.").
- Open billing is a button with the hint "Opens the billing page".
- No meaning by colour: the pill has text; Hoya's pose is decoration.

## Data needs

- reads: `tier-store` `effectiveTier(learnerId)` and its `source` (inbox tier with the 7-day grace, F-ENT-001 §3.4); audience (`store/audience.ts`); the active profile's name; F-ENT-003's switch and counts (inside its slot)
- writes: none
- telemetry: `paywall.viewed { from, state }`; `paywall.console_opened` (web only, when billing actually opens after the gate)

## Open questions

- Should a covered learner also see the cover's end date? Default: no; the date is a grown-up detail and lives on Billing for payers and staff.
