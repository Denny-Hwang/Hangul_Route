# Billing/Plan status — the learner's plan, status only (wireframe v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.7, §4.8 · supersedes the body of `paywall/upgrade.md` (F-ENT-001 §3.5) · gate: `profiles/pin-entry`
Screen ID: `billing/plan-status` · Navigation route key stays `Paywall` (title "Plan")
Audience: **learner's grown-up** on a family device (after the PIN gate); **the learner themself** on a self-only device (the gate opens directly when no PIN is set). Same screen for every age; no age wording.

## Scenario (Given-When-Then)

Given: a learner profile on the free plan, on a family plan, or covered by a class or school
When: a grown-up (or a self-learner) opens Plan details from Profile, or a locked-content tap that the free-plan spec routes here
Then: they see which plan this learner is on and where it comes from; on the web a grown-up can open Billing; there is never a price, and native builds show no link or mention of buying elsewhere

## Screen goal

"Say which plan this learner is on, and where a grown-up manages it (web only)."

## Box diagram

Web, free plan (family audience):

```
+--------------------------------------------+
| [< back]            Plan                   |
|                                            |
|            [ Hoya, idle pose ]             |
|                                            |
|   <Name> is on the free plan.              |  <- summary heading (first accessible element)
|   Stage 1 is open to everyone.             |  <- line owned by the free-plan spec
|                                            |
|   Plans and receipts are on the billing    |  <- web only
|   page for grown-ups.                      |
|   [ Open billing ]   (opens the browser)   |  <- web only, secondary, new tab
|                                            |
|   [[ BACK TO JOURNEY ]]                    |
+--------------------------------------------+
```

Native (iOS / Android), free plan:

```
+--------------------------------------------+
| [< back]            Plan                   |
|            [ Hoya, idle pose ]             |
|   <Name> is on the free plan.              |
|   Stage 1 is open to everyone.             |
|                                            |
|   [[ BACK TO JOURNEY ]]                    |  <- no link, no price, no "web" wording
+--------------------------------------------+
```

Other states (web and native identical except the web-only block):

```
premium (family)   | [ Hoya, cheering ] | <Name> has the full journey.  | From your family's Family Lifetime plan. | (web: Open billing) | [[ BACK TO JOURNEY ]]
covered (class)    | [ Hoya, cheering ] | <Name> is covered by <space>. | Everything is open while they are in it. |                     | [[ BACK TO JOURNEY ]]
self audience      | "You're on the free plan." instead of "<Name> is on the free plan."
```

Profile card entry (unchanged pill, new button label):

```
| Plan                        [ Free ] |
| Stage 1 is free. More stages are on the way.  |
| [ Plan details ]  (PIN required)     |  <- was "Unlock the journey"
```

## Interaction points

- `[ Open billing ]` (web only) → `billingUrl()` in a new browser tab (`billing/billing-home`); failure → one line with the address to type
- `[[ BACK TO JOURNEY ]]` → `journey/grid`
- `[< back]` → where the learner came from (`profile/settings` or the locked tile)

## Navigation graph

Enter from: `profile/settings` plan card (Plan details, through `profiles/pin-entry`) · locked-content taps routed here by the free-plan spec (through the gate)
Exit to: `journey/grid` · `profile/settings` · `billing/billing-home` (web only, external tab)

## States

- **free**, **premium**, **covered**: as drawn.
- **offline / no cached tier**: the free state with the same words (the tier store falls back to free); nothing claims a purchase failed.
- **empty** (no active profile): "Your learner" stands in for the name.
- **error** (the browser could not be opened, web): "Open <address> in a browser."

## Data needs

- reads: `tier-store` `effectiveTier(learnerId)` and its `source` (inbox tier with the 7-day grace, F-ENT-001 §3.4); audience (`store/audience.ts`); the active profile's name
- writes: none
- telemetry: `paywall.viewed { from, state }`; `paywall.console_opened` (web only, when Open billing is pressed)

## Open questions

- Should a covered learner also see the cover's end date? Default: no; the date is a grown-up detail and lives on Billing for the payer and staff.
