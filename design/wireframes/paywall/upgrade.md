# Paywall/Upgrade — parent-gated premium (wireframe v1)

Spec: `docs/specs/F-SUB-001-subscription-entitlement.md` (tier + Stage 1 free) · `docs/specs/F-IAP-001-receipt-verification.md` (activation) · `docs/roadmap/multi-persona-sync-platform.md` §3.2, §7 (who pays, platform rules)
Audience: **parent** — reached only after `profiles/pin-entry`; a child can never land here without an adult

## Scenario (Given-When-Then)

Given: a learner tapped a locked Stage 2+ cell on the grid (or a parent opened the plan card in settings) and an adult confirmed the PIN
When: this screen renders
Then: the parent sees that Stage 1 stays free, what Premium adds, two plan lengths, and one purchase button — or, if a class already covers the child, a "you're covered" state with no purchase button at all

## Screen goal

"Let a parent decide about Premium in one look, with Stage 1 free stated first."

## Box diagram

```
+----------------------------------+
| [<- back]           [ restore ]  |  <- restore purchases, top-right
|                                  |
|        [hoya - idle]             |
|   "Stage 1 is always free."      |  <- first line, largest copy
|                                  |
|   What Premium unlocks           |
|   - Stages 2-7 (the full journey)|
|   - Cloud save on every device   |
|   - Grown-up dashboard           |  <- 3-4 bullets, no more
|   - Up to 4 learners             |
|                                  |
|   +------------+ +------------+  |
|   | Monthly    | | Yearly     |  |  <- two cards, yearly
|   | price      | | price      |  |     preselected; prices are
|   | placeholder| | placeholder|  |     "price placeholder -
|   +------------+ +------------+  |     decision deferred"
|                                  |
|   [[ START PREMIUM ]]            |  -> store purchase sheet (IAP)
|                                  |     or Stripe Checkout (web)
|   terms / privacy / cancel any   |  <- one small line, links
|   time (placeholder)             |
+----------------------------------+

"covered by your class" variant (tier is premium via a class space)
+----------------------------------+
| [<- back]                        |
|   [hoya - cheering]              |
|   "<name> is covered by          |
|    <Class name>." (placeholder)  |
|   Everything is unlocked while   |
|   they're in the class.          |
|   [[ BACK TO JOURNEY ]]          |  -> journey/grid
+----------------------------------+
```

- The free line comes first so the screen never reads as "pay to continue". The locked cell the child tapped stays locked after "back" — no countdown, no "your child will lose…" copy.
- Two plans only. No feature-comparison table; the bullets are the same for both lengths.
- Prices are placeholders by decision: family pricing is deferred (roadmap §11 Q5). The design pass must not invent numbers.
- Platform rule: on iOS/Android the button opens the native store sheet (F-IAP-001 receipt → server). On the web PWA it opens Stripe Checkout. Teacher/school plans are **never** sold here (web console only, `console/billing`).

## Interaction points

- Plan card tap → selects; the button label updates to the chosen length
- [[ START PREMIUM ]] → native IAP sheet or Stripe Checkout → on success the entitlement refreshes → return to the entry screen with the stage unlocked (`journey/grid`) or `profile/settings`
- [ restore ] → store restore-purchases (native) / sign-in prompt → `console/sign-in` (web); on success the same return path
- [ terms ] / [ privacy ] → in-app browser (web `/terms`, `/privacy`)
- [<- back] → the screen that invoked the gate (`journey/grid` or `profile/settings`)

## Navigation graph

Enter from: `journey/grid` (locked Stage 2+ cell → `profiles/pin-entry` → here) · `profile/settings` (plan card → `profiles/pin-entry` → here)
Exit to:    `journey/grid` · `profile/settings` · `console/sign-in` (web restore) · `console/billing` (already premium → manage)

## States

- **success** (tier free, no covering space): full layout above.
- **covered** (tier premium via a class or school entitlement): the variant above — no prices, no button.
- **already premium** (family entitlement active): short "you're on Premium" card + [ manage plan ] → `console/billing` (web) or store subscription settings (native).
- **empty** (store products fail to load / offline): bullets and the free line still render; plan cards show "can't load prices right now" + [ try again ]; button disabled. Never show a blank price.
- **error** (purchase cancelled or receipt verification fails): return here with one inline line ("nothing was charged" for cancel; "we couldn't confirm the purchase — try restore" for verify failure). No modal alarms.
- **grace** (entitlement expired but within the 7-day offline grace, roadmap §3.2): treated as premium; this screen shows "renews when you're online" instead of the buy button.

## Data needs

- reads: `entitlementTier(subscription, now)` and the covering space (family | class | school) from the local inbox cache · store products (StoreKit / Play Billing) or Stripe price ids · online status · platform (native vs web)
- writes: `POST /api/subscriptions/:familyId/verify` (native receipt) · Stripe webhook → `entitlements` upsert (web, server side) · refreshed `account-store` subscription
- telemetry: `paywall.viewed` (source, tier, platform), `paywall.plan_selected`, `paywall.purchase_started | completed | cancelled | failed`, `paywall.restore_tapped`

## Open questions

- **Deferred decision — family price** (roadmap §11 Q5). Placeholders until PH launch data.
- F-SUB-001 §4 points paywall UI to "F-IAP-004", which does not exist in `docs/specs/`; the app map cites F-SUB-001 + F-IAP-001. Which spec owns this screen when it moves from R to implementation?
- Trial: roadmap §7 proposes a 7-day trial for `family_premium`; F-SUB-001 already treats `trial` as premium. Does the button read "start free trial" — and must the paywall then show the post-trial price up front (store policy)?
- Gate consolidation: `parent/gate` (math) vs `profiles/pin-entry` (PIN) — this wireframe assumes PIN per the app map note; the existing ProfileScreen still routes through `ParentGate`.
- Web PWA on iOS: linking to Stripe from the installed web app is fine, but the native app must not mention web pricing (App Store rule). Confirm the copy lint can distinguish platforms.
