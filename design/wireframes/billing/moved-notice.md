# Billing/Moved notice — the old billing address forwards to the app (wireframe v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.1 (host guard, OD-10), §7 step 4
Screen ID: `billing/moved-notice` · URLs: `https://hangulroute.com/teach/billing` (and with a trailing slash), `https://app.hangulroute.com/teach/billing`
Audience: **any grown-up** with an old bookmark, an old email link, an old learner-app build, or an in-flight Stripe session that still returns to the old address

## Scenario (Given-When-Then)

Given: a link to the old billing address, possibly carrying `?checkout=success` or `?checkout=cancel`
When: the browser opens it after the cut-over
Then: it lands on `https://app.hangulroute.com/billing` with the same query, without a loop and without needing to understand why

## Screen goal

"Get the visitor to the new billing page, with the query intact."

## Box diagram

Shown only for the instant before the location is replaced, or when script is off:

```
+--------------------------------------------+
|  Hangul Route                              |
|                                            |
|  Billing is in the app now                 |  <- h1
|  Taking you there.                         |
|                                            |
|  [[ OPEN BILLING ]]                        |  <- a real link to app.hangulroute.com/billing + query
+--------------------------------------------+
```

## Interaction points

- On load: `billingForward(location, appOrigin)` returns the target → `location.replace(target)` (no history entry, Back does not loop)
- `[[ OPEN BILLING ]]` → the same target (works without script)

## Navigation graph

Enter from: old bookmarks and emails · old learner-app builds (`consoleBillingUrl` default) · Stripe success / cancel / portal returns created before `BILLING_URL` was set
Exit to: `billing/billing-home` (or `billing/checkout-return` when the query carries `checkout=`)

## States

- **forwarding**: as drawn, normally invisible (replaced at once).
- **no script**: the page stays; the link is the way forward.
- **no app origin configured** (preview, local): no forwarding; the old path renders `billing/billing-home` in place (the guard returns null).
- **error**: none possible beyond the browser's own; the link always works.

## Data needs

- reads: `location` (path, query), `NEXT_PUBLIC_APP_URL` (build-time)
- writes: none
- telemetry: none

## Open questions

- None. Retention is indefinite by default (OD-10).
