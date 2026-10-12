# Billing/Home — one billing page for every grown-up persona (wireframe v2)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.1-§4.6, §4.9, §4.12 · supersedes `console/billing.md` (F-ENT-001 §3.6) · promo box: F-ENT-002 §3.3 · frame: `shell/adult-frame.md` (F-APP-001 §3.8)
Screen ID: `billing/billing-home` · URL: `https://app.hangulroute.com/account/billing` (`APP_ROUTES.billing`, F-APP-001)
Audience: **parent** (family owner), **co-parent** (family caregiver), **teacher** (class owner, co-teacher, or teacher in a school), **school admin** (school owner or admin), **adult self-learner** (owner of their own family space). Grown-ups only; signed in with Clerk; inside F-APP-001's grown-up lock. Never a learner surface.

## Scenario (Given-When-Then)

Given: a signed-in grown-up who belongs to zero or more family, class or school spaces
When: they open Billing from the frame nav, a cap nudge, a learner's Plan screen (web, through the gate) or a Stripe return
Then: they see one card per space with what covers it and until when; if they pay for a space they can buy, manage or see receipts; if they do not, they see the status and who manages it

## Screen goal

"Show each space's plan at a glance, and give the payer exactly one clear next step."

## Box diagram

Phone (375), the most common case: one parent, one free family (offer inside the card; no separate Add a plan block):

```
+-----------------------------------+
| Hangul Route · Parent   [Sign out]|  <- F-APP-001 AdultFrame (not drawn by this spec)
| [Back to learning]   [Language v] |
| Home | Billing                    |  <- frame nav (plus sibling items when built)
|-----------------------------------|
| Billing                           |  <- h1
| ( Test mode: no real card is      |  <- mode banner, one line, neutral
|   charged. )                      |
|                                   |
| ( return notice, only after       |  <- see billing/checkout-return
|   Stripe )                        |
|                                   |
| Your plans                        |  <- h2
| +-------------------------------+ |
| | Family · <space name>         | |  <- h3: kind + name (payer card)
| | Free plan                     | |  <- plan line
| | 2 of 5 learners               | |  <- usage line
| |-------------------------------| |
| | Family Lifetime               | |  <- the offer, inside the one buyable card
| |  - Every lesson of every      | |  <- includes lines (base)
| |    Stage, now and later       | |
| |  - Up to 5 learners in one    | |
| |    family                     | |
| |  - Cloud save on every device | |
| |  - Browse every lesson as     | |  <- only when SITE_CLAIMS.browseAsLearner
| |    your learner sees it       | |
| | <price> once (sandbox amount) | |  <- price line
| | > Have a code?                | |  <- directly under the price it rewrites
| | [[ GET FAMILY LIFETIME ]]     | |  <- the one primary button on the page
| | > Receipts                    | |  <- only when the space has receipts
| +-------------------------------+ |
|                                   |
| Help                              |  <- h2
| Questions or a refund? Write to   |
| hello@hangulroute.com.            |
| Learners never see prices or      |
| receipts.                         |
| On a shared device? Sign out when |
| you are done.                     |
|-----------------------------------|
| About · Privacy · Terms           |  <- frame footer
+-----------------------------------+
```

Wide (1280), a teacher who pays for two classes and is a member of a school (several cards; Add a plan block because two spaces can buy):

```
+---------------------------------------------------------------------------+
| Hangul Route  ( Parent | Teacher )   [Language v] [Back to learning] [Sign out] |
|  Classes   Billing                                                        |
|---------------------------------------------------------------------------|
|  Billing                                                                  |
|  ( Test mode: no real card is charged. )                                  |
|                                                                           |
|  Your plans                                                               |
|  +-------------------------------+  +-------------------------------+     |
|  | Class · <name>                |  | Class · <name>                |     |
|  | Group License                 |  | Free plan                     |     |
|  | Renews on <date>              |  | 14 of 20 students             |     |
|  | 23 students                   |  |                               |     |
|  | [ Manage subscription ]       |  |                               |     |
|  | > Receipts                    |  |                               |     |
|  +-------------------------------+  +-------------------------------+     |
|  +-------------------------------+                                        |
|  | School · <name>               |  <- read-only card (teacher member)    |
|  | Covered by <school>'s license |                                        |
|  |   until <date>                |                                        |
|  | Your school manages this plan.|                                        |
|  +-------------------------------+                                        |
|                                                                           |
|  Add a plan                          <- h2, only when 2+ payer cards can buy |
|  +---------------------------------------------------------------------+  |
|  | Group License for <class name>                                      |  |
|  |  - Every lesson for every student while they are enrolled          |  |
|  |  - No 20-student cap                                                |  |
|  | <price> / year (sandbox amount)                                     |  |
|  | > Have a code?                                                      |  |
|  | [[ GET GROUP LICENSE ]]                                             |  |
|  +---------------------------------------------------------------------+  |
|                                                                           |
|  Help  ...                                                                |
+---------------------------------------------------------------------------+
```

Card variants (same box, different lines):

```
Parent, lifetime          | Family · <name> | Family Lifetime · yours for good | 4 of 5 learners | > Receipts |
Parent, lifetime, 0 learn.| Family · <name> | Family Lifetime · yours for good | 0 of 5 learners | Next: connect a learner to this family. | [ Connect a learner ] |
Co-parent (caregiver)     | Family · <name> | Family Lifetime · yours for good | 4 of 5 learners | The person who set up this family manages this plan. |
Co-teacher (class teacher)| Class · <name>  | Group License · Renews on <date> | 23 students | The class owner manages this plan. |
Class in a school         | Class · <name>  | Covered by <school>'s license until <date> | 31 students | Your school manages this plan. |
School owner / admin      | School · <name> | Group License · Renews on <date> | 212 of 300 students · 7 of 10 teachers | [ Manage subscription ] [ Contact us ] | > Receipts |
Cancelled, still covered  | Class · <name>  | Group License · Ends on <date> | 23 students | [ Manage subscription ] | > Receipts |
Past due (payer)          | ... | payment needs attention · full route kept for a week | [ Manage subscription ] |  + one neutral note above the cards
Archived class, license   | Class · <name> (archived) | Group License · Renews on <date> | [ Manage subscription ] |  (payers only)
```

Past-due note (above the cards, neutral tone, never the danger colour):

```
| A payment didn't go through. Update your card in Manage subscription;  |
| learners keep the full route for a week.                               |
```

Rules shown above:

- Payer cards first, then read-only cards; within each group: family, class, school; newest first.
- Prices appear only in an offer (inside the card, or in Add a plan). Read-only cards never show an amount, a button or receipts.
- Exactly one `[[ PRIMARY ]]` on the page (the first recommended offer). Manage, Contact us and Connect a learner are secondary.
- Inline Receipts rows show date, kind and amount only; links to Stripe live on `billing/receipts` behind step-up.
- Includes lines for a feature that is not live (browse, reports, notes) do not render.

## Interaction points

- `[[ GET FAMILY LIFETIME ]]` / `[[ GET GROUP LICENSE ]]` → `billing/step-up` when the sign-in is older than 10 minutes → Stripe Checkout (external) → back with `?checkout=` → `billing/checkout-return`
- `[ Manage subscription ]` → `billing/step-up` (if needed) → Stripe Billing Portal (external) → back to this screen
- `[ Contact us ]` (school) → mail to hello@hangulroute.com with the subject "Hangul Route school contract" (no space name or id in the mail link)
- `[ Connect a learner ]` → F-APP-001 family page `/parent/space?id=<spaceId>` (join code panel)
- `> Receipts` (payer card) → expands the latest 3 rows in place; `[ All receipts ]` → `billing/receipts?id=<spaceId>`
- `> Have a code?` → expands the promo form; `[ Apply code ]` rewrites every offer's price line (F-ENT-002 §3.3)
- Empty state `[[ SET UP FOR ME OR MY FAMILY ]]` / `[ Set up a class ]` → F-APP-001 `/start?persona=parent` / `/start?persona=teacher`
- Frame: nav items, `[Back to learning]` (clears the unlock, `/`), `[Sign out]` (→ `/signin`) — F-APP-001

## Navigation graph

Enter from: frame nav Billing · `console/roster` free-cap nudge · `console/school-admin` license link · `console/curriculum-planner` "open with a plan" note · `billing/plan-status` (web, Open billing, same tab) · F-BROWSE-001 [ See plans ] · old `/teach/billing` addresses (F-APP-001 redirects) · Stripe Checkout / Portal return
Exit to: Stripe Checkout / Portal (external, returns here) · `billing/step-up` · `billing/checkout-return` (same page state) · `billing/receipts` · F-APP-001 `/start`, family page, persona homes · learner app (Back to learning)

## States

- **loading**: frame, then three grey card outlines (no numbers; no shimmer motion when reduced motion is set).
- **success**: as drawn.
- **one buyable space**: the offer sits inside that card; no Add a plan block.
- **several buyable spaces**: Add a plan block with one row per space, one primary.
- **empty (no spaces)**: "Plans belong to a family or a class." + `[[ SET UP FOR ME OR MY FAMILY ]]` + `[ Set up a class ]`; Help block stays.
- **all read-only** (viewer pays for nothing): cards only; no offer; Help block stays.
- **not configured** (`mode = none`): banner "Payments aren't set up yet. Nothing was charged."; every buy and manage button disabled; cards still render.
- **live not enabled** (`mode = live`, `purchasesOpen = false`): banner "Payments are not open yet. Nothing was charged."; buttons disabled.
- **already active** (checkout answered 409): note "This plan is already active. Nothing was charged."; summary reloads.
- **offline** (no connection): panel "You're offline. Plans and receipts need a connection." + `[ Try again ]`; no cards, no offers; reloads by itself when the connection returns. Opening the page offline shows F-APP-001's grown-up offline page instead (`shell/offline`).
- **error** (summary failed while online): panel "Can't check your plan right now." + `[ Try again ]`; no cards, no offers.
- **signed out**: F-APP-001 sends to `/signin?next=` and back here afterwards.
- **locked** (device with learner profiles behind a PIN, no unlock in this tab): F-APP-001 `shell/grown-up-lock`; no API call before unlock.

## Data needs

- reads: `GET /api/billing/summary` → `{ mode, purchasesOpen, cards[], account[] }` (F-BILL-002 §5.2-§5.3); a payer card's latest 3 receipts arrive inside it (no links)
- reads: `SITE_CLAIMS` (build-time constant, F-SITE-002) for the feature includes lines
- reads: promo check `POST /api/entitlements/stripe/promo` (F-ENT-002)
- writes: `POST /api/entitlements/stripe/checkout` · `POST /api/entitlements/stripe/portal` (step-up, live guard, already-active guard)
- local: none persisted; the open or closed state of disclosures is per page view
- telemetry: Worker-side only (`billing.summary_viewed`, `billing.checkout_started`, `billing.checkout_refused`, `billing.portal_opened`); the page sends nothing

## Open questions

- Should the school admin's card show the teacher list behind the seat count? Default: no; the school page (`console/school-admin`) already has it.
- A grown-up who pays for many spaces (a teacher with 6 classes): collapse paid-up cards into one "5 more classes, all covered" row? Default: no collapse until a real account has more than 6 cards (check in beta).
- Contact us: mail link or a short form? Default: mail link (no new form, no new stored data).
