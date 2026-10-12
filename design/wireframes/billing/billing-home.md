# Billing/Home — one billing page for every grown-up persona (wireframe v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.1-§4.6, §4.9 · supersedes `console/billing.md` (F-ENT-001 §3.6) · promo box: F-ENT-002 §3.3
Screen ID: `billing/billing-home` · URL: `https://app.hangulroute.com/billing` (path constant `BILLING_PATH`)
Audience: **parent** (family owner), **co-parent** (family caregiver), **teacher** (class owner, or teacher in a school), **school admin** (school owner or admin). Grown-ups only; signed in with Clerk. Never a learner surface.

## Scenario (Given-When-Then)

Given: a signed-in grown-up who belongs to one or more family, class or school spaces
When: they open Billing from the grown-up home, a cap nudge, a learner's Plan screen (web) or a Stripe return
Then: they see one card per space with what covers it and until when; if they pay for a space they can buy, manage or read receipts; if they do not, they see the status only

## Screen goal

"Show each space's plan at a glance, and give the payer exactly one clear next step."

## Box diagram

Phone (one column; wide screens use the same order with a narrower content column):

```
+--------------------------------------------+
| [< grown-up home]   Billing     [lang] [out]|  <- SHELL header (SHELL spec)
|                                            |
| ( Test mode: no real card is charged. )    |  <- banner, mode = test (one line, neutral)
|                                            |
| ( return notice, only after Stripe )       |  <- see billing/checkout-return
|                                            |
|  Your plans                                |  <- h2
|  +--------------------------------------+  |
|  | Family · <space name>                |  |  <- h3: kind + name (payer card)
|  | Free plan                            |  |  <- plan line
|  | 2 of 5 learners                      |  |  <- usage line
|  | > Receipts                           |  |  <- collapsed; latest 3 when open
|  +--------------------------------------+  |
|  +--------------------------------------+  |
|  | Class · <space name>                 |  |
|  | Group License · renews on <date>     |  |
|  | 23 students                          |  |
|  | [ Manage subscription ]              |  |  <- Stripe portal (step-up first)
|  | > Receipts                           |  |
|  +--------------------------------------+  |
|  +--------------------------------------+  |
|  | School · <space name>                |  |  <- read-only card (viewer is a teacher member)
|  | Covered by <school>'s licence        |  |
|  |   until <date>                       |  |
|  | The plan owner manages this.         |  |
|  +--------------------------------------+  |
|                                            |
|  Add a plan                                |  <- h2, only when a payer card can buy
|  > Have a code?                            |  <- collapsed promo form (F-ENT-002)
|  +--------------------------------------+  |
|  | Family Lifetime   for <space name>   |  |
|  | what it includes (one short line)    |  |
|  | price (sandbox amount)               |  |
|  | [[ GET FAMILY LIFETIME ]]            |  |  <- the one primary button on the page
|  +--------------------------------------+  |
|                                            |
|  Help                                      |  <- h2
|  Questions or a refund? Write to <email>.  |
|  Learners never see prices or receipts.    |
|  On a shared device? Sign out when done.   |
+--------------------------------------------+
```

Card variants (same box, different lines):

```
Parent, lifetime        | Family · <name> | Family Lifetime · yours for good | 4 of 5 learners | > Receipts |
Co-parent (caregiver)   | Family · <name> | Family Lifetime · yours for good | 4 of 5 learners | The plan owner manages this. |
Class in a school       | Class · <name>  | Covered by <school>'s licence until <date> | 31 students |   (no buttons)
School owner            | School · <name> | Group License · renews on <date> | 212 of 300 students · 7 of 10 teachers | [ Manage subscription ] [ Contact us ] | > Receipts |
School admin (not owner)| same as the school owner: the admin role is a payer (it can already buy and manage) |
Past due (payer)        | ... | Payment didn't go through · kept for a week | [ Manage subscription ] |  + one neutral note above the cards
Archived class, licence | Class · <name> (archived) | Group License · renews on <date> | [ Manage subscription ] |  (payers only)
```

Rules shown above:

- Payer cards first, then read-only cards; within each group: family, class, school; newest first.
- Prices appear only in **Add a plan** rows. Read-only cards never show an amount, a button or receipts.
- Exactly one `[[ PRIMARY ]]` on the page (the first recommended Add-a-plan row). Manage and Contact us are secondary.

## Interaction points

- `[[ GET FAMILY LIFETIME ]]` / `[ Get Group License ]` → `billing/step-up` when the sign-in is older than 10 minutes → Stripe Checkout (external) → back to this screen with `?checkout=` → `billing/checkout-return`
- `[ Manage subscription ]` → `billing/step-up` (if needed) → Stripe Billing Portal (external) → back to this screen
- `[ Contact us ]` (school) → mail to the contact address with the subject prefilled (no space name or id in the mail link)
- `> Receipts` (payer card) → expands the latest 3 rows in place; `[ All receipts ]` → `billing/receipts?id=<spaceId>`
- `> Have a code?` → expands the promo form; `[ Apply code ]` rewrites every purchasable row's price line (F-ENT-002 §3.3)
- Empty state `[ Set up my family ]` / `[ Set up a class ]` → SHELL's create-space flow (today `console/onboarding-role`, `/teach/start`)
- Header `[< grown-up home]` → SHELL grown-up home; `[out]` → sign out → SHELL sign-in

## Navigation graph

Enter from: SHELL grown-up home (Billing) · `console/roster` free-cap nudge · `console/school-admin` licence link · `console/curriculum-planner` premium-needed note · `billing/plan-status` (web, Open billing) · `billing/moved-notice` (old path) · Stripe Checkout / Portal return
Exit to: Stripe Checkout / Portal (external, returns here) · `billing/step-up` · `billing/checkout-return` (same page state) · `billing/receipts` · SHELL create-space · SHELL grown-up home · SHELL sign-in

## States

- **loading**: header, then three grey card outlines (no numbers, no shimmer motion when reduced motion is set).
- **success**: as drawn.
- **empty (no spaces)**: "Plans attach to a family or a class." + `[[ SET UP MY FAMILY ]]` + `[ Set up a class ]`; no Add-a-plan block; Help block stays.
- **all read-only** (viewer pays for nothing): cards only; no Add-a-plan block; Help block stays.
- **not configured** (`mode = none`): banner "Checkout is not set up on this deployment yet."; every buy and manage button disabled; cards still render.
- **live not enabled** (`mode = live`, `purchasesOpen = false`): banner "Payments are not open yet. Nothing was charged."; buttons disabled.
- **already active** (checkout answered 409): note "This plan is already active. Nothing was charged."; summary reloads.
- **error** (summary failed): one panel "Can't check your plan right now." + `[ Try again ]`; no cards, no Add-a-plan rows (nothing to act on without data).
- **signed out**: SHELL sends to sign-in and back here afterwards.

## Data needs

- reads: `GET /api/billing/summary` → `{ mode, purchasesOpen, cards[], account[], adultAccess }` (F-BILL-002 §5.2-§5.3); the card's latest 3 receipts arrive inside it (payer only)
- reads: promo check `POST /api/entitlements/stripe/promo` (F-ENT-002)
- writes: `POST /api/entitlements/stripe/checkout` · `POST /api/entitlements/stripe/portal` (step-up, live guard, already-active guard)
- local: none persisted; the open/closed state of disclosures is per page view
- telemetry: Worker-side only (`billing.summary_viewed`, `billing.checkout_started`, `billing.checkout_refused`, `billing.portal_opened`); the page sends nothing

## Open questions

- Should the school admin's card show the teacher list behind the seat count? Default: no; the school page (`console/school-admin`) already has it.
- A grown-up who pays for many spaces (a teacher with 6 classes): collapse paid-up cards into one "5 more classes, all covered" row? Default: no collapse until a real account has more than 6 cards (check in beta).
- Contact us: mail link or a short form? Default: mail link (no new form, no new stored data).
