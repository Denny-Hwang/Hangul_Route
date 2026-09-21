# Console/Billing — plan, upgrade, cancel, invoices (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §3.2 (tier), §7 (plans, web-only teacher/school), §8 (`/entitlements/*`), §10 S6 · F-SUB-001 / F-IAP-001 (mobile IAP, existing) · `docs/blueprints/02-core-feature-spec.md` §6.6
Code (F-ENT-001 §3.1–3.3, 2026-09-21 — API): `GET /api/entitlements`, `POST /verify` (family receipt), `POST /stripe/checkout` · `/stripe/portal` (503 until keys and price ids are set), `POST /stripe/webhook` (HMAC signature, subscription lifecycle → `applyEntitlement`). Learner tier travels in the sync inbox with a 7-day grace. The page is PR 3; prices stay placeholders (decision deferred).
Audience: **parent** (family_premium; web Stripe or native IAP) · **teacher** (teacher_pro; web only) · **school admin** (school_license / school_seat; web only)

## Scenario (Given-When-Then)

Given: an adult wants to know what they pay for, unlock more (Stage 2+, more students, seats) or stop paying
When: they open Billing from the hub, a cap nudge or the parent-gated paywall
Then: they see their current plan and status, what each plan unlocks, and one clear way to change it on *this* platform — never a child-facing purchase button

## Screen goal

"Show the current entitlement and offer exactly one upgrade / manage path for this platform."

## Box diagram

```
+------------------------------------------------------------+
| [< back]   Billing                                         |
|                                                            |
|  Current plan                                              |
|  +------------------------------------------------------+  |
|  | Free                                                 |  |  <- or family_premium / teacher_pro /
|  | status: -   (trial - active - past_due - expired - cancelled) |     school_license / school_seat
|  | renews / ends: -     paid via: -  (stripe / apple / google / manual) |
|  | seats: 38 / 300  (school only)                       |  |
|  |          [ Manage subscription ]  [ Restore purchases ] |  |  <- Stripe portal (web) / IAP restore (native)
|  +------------------------------------------------------+  |
|                                                            |
|  Plans (rows shown depend on who you are + platform)       |
|  +------------------------------------------------------+  |
|  | Free            Stage 1, 4 profiles, local progress, |  |
|  |                 Rescue Code, file backup   (current) |  |
|  | Family Premium  Stage 2-7, cloud sync, dashboard,    |  |
|  |                 family plans, up to 4 learners       |  |
|  |                 price: placeholder - decision deferred|  |
|  |                                        [ Choose ]    |  |
|  | Teacher Pro     unlimited classes / students, all    |  |  <- web only
|  |                 students premium while enrolled,     |  |
|  |                 worksheets, templates                |  |
|  |                 price: placeholder     [ Choose ]    |  |
|  | School License  up to 10 teachers / 300 students,    |  |  <- web only
|  |                 all classes Pro, admin view          |  |
|  |                 price: placeholder     [ Choose ]    |  |
|  | School Seats    per-student, 300+, contract          |  |  <- web only
|  |                 price: placeholder     [ Contact us ]|  |
|  +------------------------------------------------------+  |
|                                                            |
|  Invoices (Stripe only)                                    |
|   Sep 2026  $--  [ PDF ]   -   Aug 2026  $--  [ PDF ]      |
|                                                            |
|  1 line: "kids never see billing; this page opens only after the grown-up gate" |
+------------------------------------------------------------+
```

- The primary action is the [ Choose ] on the *recommended* row for this adult (parent → Family Premium, teacher → Teacher Pro, admin → School License); rendered as `[[ CHOOSE ]]` on that row only.
- **Native app** (iOS / Android): only Free + Family Premium rows render, purchase via IAP (F-IAP-001). Teacher / School rows and any link to web checkout are **absent** — not tucked under a link (roadmap §7, store rules).
- **Web**: [ Choose ] → Stripe Checkout; [ Manage subscription ] → Stripe customer portal.
- All prices display as "placeholder — decision deferred" (roadmap §11 Q5; BP02 §6.6 figures are proposals).

## Interaction points

- [[ CHOOSE ]] / [ Choose ] (web) → Stripe Checkout (external) → webhook upserts `entitlements` → returns to this screen in the "active" state
- [ Choose ] Family Premium (native) → IAP sheet (parent-gated: `profiles/pin-entry` must have passed) → `POST /entitlements/verify`
- [ Contact us ] (school seats) → mailto / form (external), `provider: manual`
- [ Manage subscription ] → Stripe portal (cancel, change card); native: store subscription settings (external)
- [ Restore purchases ] (native only) → store restore → `POST /entitlements/verify`
- [ PDF ] → Stripe-hosted invoice (external)
- [< back] → `console/home` (web) · `profile/settings` (mobile) · origin nudge (`console/roster` / `console/school-admin` / `paywall/upgrade`)

## Navigation graph

Enter from: `console/home` [ Billing ] · `console/roster` (free-cap nudge) · `console/school-admin` (seats / license) · `paywall/upgrade` (mobile, parent-gated) · `console/account` · `console/plan-builder` (dimmed premium item, parent path)
Exit to:    Stripe Checkout / portal (external, returns here) · `console/home` · `profile/settings` · `console/roster` · `console/school-admin`

## States

- **success / active**: current plan card filled; recommended row marked "current", others show [ Choose ].
- **empty / free** (no entitlement row): Free card marked current; recommended row carries the `[[ CHOOSE ]]`.
- **trial**: current card shows days left (plain count, no urgency color); same actions.
- **past_due**: 1-line neutral note "payment didn't go through — update your card" + [ Manage subscription ]; nothing else changes on this page (learner tier lapses per roadmap §3.2 grace, said in one line).
- **cancelled / expired**: current card shows end date; the recommended row's CTA reads "resume" (same checkout).
- **error**: entitlement fetch fails → current card "can't check your plan right now" + [ TRY AGAIN ]; plan rows still render, CTAs disabled. Checkout return without webhook confirmation → "almost there — refreshing" with auto-retry, then [ TRY AGAIN ].

## Data needs

- reads: `entitlements` for subject = this account (teacher_pro) and subjects = spaces this account owns (family_premium, school_*) — status, provider, expires_at, seats · seat usage (school) · Stripe invoices list (web) · platform flag (web / ios / android)
- writes: none directly; Stripe webhook → `/entitlements/stripe/webhook`; native → `/entitlements/verify` (same `applyEntitlement`, roadmap §7)
- telemetry: `console_billing_viewed{role, platform, currentPlan}`, `console_checkout_started{planKey}`, `console_checkout_returned{status}`, `console_manage_opened`

## Open questions

- **Family price** (roadmap §11 Q5) — **deferred**; all price cells stay placeholders until the PH launch A/B.
- **Teacher free cap** (roadmap §11 Q4) — **deferred**; the Free row's "up to N students" line is a placeholder.
- An adult who is both parent and teacher: two subjects (space + account) — show both current plans as two cards, or one combined? Default two cards; rare in pilot.
- Native "Manage subscription" opens the store; should the page state plainly that teacher / school plans exist "on the website" without a link? Store guidance suggests saying nothing — legal check (BP03).
- Roadmap §7 gives `family_premium` a 7-day trial: is the trial started from this page or from `paywall/upgrade`? Default: either entry, same checkout.
