Status: ready

# F-BILL-002 — Billing in the app for every persona: one billing home on app.hangulroute.com, plan status for each persona, receipts, nothing on the marketing site

**Status**: `ready`
**Scope**: `packages/content-schema` (billing summary, billing event and receipt schemas, telemetry names) · `packages/backend` + `apps/api` (additive D1 table `billing_events`, `GET /api/billing/summary`, `GET /api/billing/receipts`, webhook history, checkout and portal hardening, live-mode guard, return URL) · `apps/web` (the billing page at `/billing`, its view models, the old `/teach/billing` path forwarding, the console header link) · `apps/mobile` (the gated learner Plan screen replaces the price-bearing paywall; the billing link env split; the service-worker denylist) · `packages/i18n` (`console.billing.*` additions, `caregiver.plan.*`, `a11y.planStatus`) · `docs/launch/owner-runbook.md` (Step 8)
**Owner**: solo dev
**Rollout**: server first (B-1 to B-5, no visible change), then the page and the learner screen (B-6 to B-9, behind no flag: they replace what is there), then the cut-over (B-10) once the persona app shell serves grown-up pages on app.hangulroute.com. Stripe stays in **test mode**: a live key is refused in code until the owner sets `BILLING_LIVE_ALLOWED=true` (section 4.9).
**Wireframes** (drafted with this spec): `design/wireframes/billing/billing-home.md`, `billing/checkout-return.md`, `billing/receipts.md`, `billing/step-up.md`, `billing/plan-status.md`, `billing/moved-notice.md`. They supersede `console/billing.md` and `paywall/upgrade.md` (both get a header note in B-0).

Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit.

Owner request (2026-10-11), items covered here: **8** (every persona can see their own billing information) and **12** (billing only on app.hangulroute.com; hangulroute.com is intro and guide only). Item 13 (user-friendly overall) shapes the layout. Parallel specs written from the same request, referred to by short names in this document:

| Short name | What it owns | Branch (spec written in parallel) |
|---|---|---|
| **SHELL** | persona sign-in and the grown-up screens on app.hangulroute.com (how they are served, Clerk on the app origin, the service-worker denylist for grown-up paths, redirects of `/teach/*` and `/parent*`) | `docs/persona-app-shell` |
| **SITE** | the layered marketing site on hangulroute.com (copy, nav, CTAs, the Pricing aside) | `docs/marketing-site-layered` |
| **FREE** | the free plan "up to about day 2" and unlocked subscriber content | `docs/free-day2-unlocked-curriculum` |
| **BROWSE** | paying grown-ups browse the content as learners see it (item 14) | `docs/adult-content-browser` |

Each of them gets its own `F-` id when its docs PR lands; this spec names them by short name so it does not guess an id.

---

## 1. Problem

Today every money surface sits on the wrong host or shows the wrong thing to the wrong person:

1. **Billing lives on the marketing domain.** The only checkout page is `hangulroute.com/teach/billing` (`apps/web/src/app/(console)/teach/billing/page.tsx`). Stripe sends buyers back there (`packages/backend/src/routes/entitlements.ts:82` and `:127`, `CONSOLE_URL ?? 'https://hangulroute.com'`). The learner app's paywall button opens it too (`apps/mobile/src/logic/paywall.ts:51-55`, `DEFAULT_CONSOLE = 'https://hangulroute.com'`). The owner wants hangulroute.com to be an intro and guide site only (item 12).
2. **A persona who does not own a space sees nothing.** `GET /api/entitlements` (`entitlements.ts:38-46`) lists only the account's own rows and the spaces it **owns**. A teacher whose class sits under someone else's school, a co-parent (caregiver role), or a teacher invited into a school cannot see what covers them or until when. Item 8 asks that every persona can see their own billing information.
3. **No history.** There is no receipt list and no payment history (F-ENT-001 §4 left "invoices list" out). A parent who paid once has nothing in the product that proves it; a school cannot find last year's invoice.
4. **The child-side paywall shows a price and a purchase path.** The PIN-gated paywall shows the Family Lifetime price and an "Open the web console" button (`apps/mobile/src/screens/paywall/PaywallScreen.tsx:112-131`). On a native build the same button and the line "you can buy it once on the web console" (`packages/i18n/src/messages/en/caregiver.ts:43-44`) render too. That is a call to action toward a non-store purchase inside a store binary (section 4.8), and it puts a price on a surface a child can reach after a grown-up opens the gate.
5. **Nothing stops a live key.** The owner rule is "Stripe Live, real prices and commercial claims stay off until the owner says". Today that rests on nobody pasting an `sk_live_` key into the Worker; no code checks it.
6. **The return from Stripe is optimistic.** `?checkout=success` prints "the plan is active" (`console.ts:74`) before the webhook may have landed. A slow webhook leaves the page saying "Free" under a "Thank you" note.

## 2. User stories

> **Parent.** As a parent who bought the family plan, I open the app, go to Billing and see "Family Lifetime · yours for good", how many of my learners it covers, and the receipt for my one payment. I never had to visit the marketing site to pay.

> **Teacher with a stand-alone class.** As a teacher, I see my class licence, when it renews, how many students it holds, and the invoices for each year. Manage subscription takes me to Stripe and back to the same page.

> **Teacher inside a school.** As a teacher invited into a school, I see "Covered by Maple School's licence until 30 June 2027". I see no prices and no buttons, because the school pays.

> **School admin.** As the school's owner, I see the licence, seats used out of the limit for students and teachers, the invoices, and Contact us for a contract beyond the caps.

> **Co-parent.** As a second grown-up in a family, I see that the family has the plan, read-only.

> **Learner.** As a learner (behind the grown-up gate on a family device, directly on a self-only device), I see which plan I am on and where it comes from. I never see a price. On the web a grown-up can open Billing from here; inside an App Store or Google Play build there is no link and no mention of buying elsewhere.

## 3. Goals and non-goals

### 3.1 Goals

- **G1. One billing home on app.hangulroute.com.** `https://app.hangulroute.com/billing` is the only place to buy, manage, or read receipts. hangulroute.com shows no price, no plan comparison, no checkout and no billing link.
- **G2. Every persona sees their own plan.** Owner, caregiver, teacher and admin roles each get a card per space they belong to: coverage, status, dates, usage. Only the payer sees prices, actions and receipts.
- **G3. Receipts and history** for every Stripe payment, renewal, failed payment and refund recorded from now on, with a link to the Stripe-hosted receipt or invoice.
- **G4. The learner side is status only.** No price, no offer card, no promo hint. Web shows one "Open billing" button behind the gate. Native shows no link at all.
- **G5. Old links keep working.** `hangulroute.com/teach/billing` (bookmarks, emails, in-flight Stripe sessions, installed old builds) forwards to the app host, keeping `?checkout=`.
- **G6. Sandbox stays sandbox.** Test mode is visible on the page. A live key is refused for checkout, portal and promo lookups until the owner opts in.
- **G7. Honest return from Stripe.** The page waits for the webhook and says so, instead of claiming success early.
- **G8. The lifetime model is explicit.** One payment, no renewal, nothing to cancel, receipt available, refund rule written down.

### 3.2 Non-goals

- Store purchases (App Store / Google Play in-app purchase). F-IAP-002 owns them; this spec only states what a native build must not show (section 4.8).
- New products, new prices, coupons logic, taxes, multi-currency, seat-based billing UI. `PLAN_PRICING` (`packages/content-schema/src/schemas/entitlement.ts:64`) stays the single source.
- Changing who pays or how a learner inherits premium (`tierForLearner`, F-ENT-001 §3.2).
- The marketing copy itself (SITE) and how grown-up pages are served on the app host (SHELL). This spec states the requirements it needs from them (section 4.1, section 13 assumptions).
- What is free and what is locked (FREE). The Plan screen reads whatever that spec decides.
- Account deletion and data export of payments. Stripe stays the system of record for money.
- Invoices for a manual `school_seat` contract (the owner sends those outside the product).

## 4. Detailed behaviour

### 4.1 Hosts and paths

| URL | What it is after this spec |
|---|---|
| `https://app.hangulroute.com/billing` | **The billing home** (wireframe `billing/billing-home`). Signed-in grown-ups only (Clerk). Canonical. |
| `https://app.hangulroute.com/billing/receipts?id=<spaceId>` | All receipts of one space the viewer pays for (wireframe `billing/receipts`). Query parameter, not a path segment, because the web build is a static export (F-CONSOLE-001 §3.7). The id is the opaque `space:…` id; no learner or space name ever appears in a URL. |
| `https://hangulroute.com/teach/billing` (and `/teach/billing/`) | **Forwarder** (wireframe `billing/moved-notice`): replaces the location with `https://app.hangulroute.com/billing` plus the original query string. Kept indefinitely (OD-10). |
| `https://app.hangulroute.com/teach/billing` | Same forwarder logic, to `/billing` on the same host (an old path on the new host). |
| Any other hangulroute.com page | No price, no plan list, no "Buy", no checkout or portal URL, no link to `/billing`. It may link to the app's sign-in (SITE decides the CTA). |

- **Path constant.** `BILLING_PATH = '/billing'` and `BILLING_RECEIPTS_PATH = '/billing/receipts'` live in `packages/content-schema/src/schemas/billing.ts`, so the web page, the Worker's default return URL and the mobile link agree. If SHELL serves grown-up pages under a prefix (for example `/grown-ups/billing`), only these constants change (OD-1).
- **Who renders it.** Default (OD-1): the existing Next.js billing code moves from `app/(console)/teach/billing/page.tsx` to a new route `app/(console)/billing/page.tsx` (plus `billing/receipts/page.tsx`), and SHELL's mechanism serves it on app.hangulroute.com. The view models stay pure (`apps/web/src/lib/console/billing.ts` and the new `billing-summary.ts`), so a later move to another renderer reuses them.
- **Host guard (pure, `apps/web/src/lib/console/billing-host.ts`).** `billingForward(current: URL, appOrigin: string | null): string | null` returns the URL to replace the location with, or null to stay. It forwards when the current path is `/teach/billing` (any host) or when the current origin is not `appOrigin` and the path is `/billing` or `/billing/receipts`. It never forwards when `appOrigin` is null (local dev, previews without `NEXT_PUBLIC_APP_URL`), when the current origin equals `appOrigin` and the path is already canonical, or when the host is `localhost` / `127.0.0.1`. It keeps the query string and drops the hash. The page calls it before rendering anything else and uses `location.replace` so Back does not loop.
- **Before the cut-over (B-10)** the guard is off entirely (`billingForwardEnabled = false` in `apps/web/src/lib/console/config.ts`), so both `/teach/billing` and `/billing` render the page on whichever host serves the console, exactly as today. B-10 turns it on after SHELL serves `/billing` on the app host (section 7, step 4).
- **Service worker.** The learner PWA's Workbox `navigateFallback: '/index.html'` (`apps/mobile/scripts/pwa-postbuild.mjs:104`) would answer `/billing` with the learner app. B-9 adds `/^\/billing(\/|$|\?)/` to `navigateFallbackDenylist` and keeps the console's files out of the precache glob. If SHELL already added a denylist, B-9 appends this entry to it.

### 4.2 Personas and what each sees

Roles come from `SpaceRoleSchema` (`packages/content-schema/src/schemas/space.ts:36`: `owner | caregiver | teacher | admin | student`). The **payer** of a space is any account that passes `can(actor, 'space.manage', space)`, the same check checkout and portal already use (`entitlements.ts:52`): the space's `owner`, and on a school also the `admin` role (`lib/can.ts:41`, `:59`). Everyone else with a membership is a **viewer**.

| Persona | Where | Sees | Can do |
|---|---|---|---|
| Parent (owner of a family space) | `/billing` | Family card: plan (Free or Family Lifetime), status line, learners covered `n of 5` (`FAMILY_LIFETIME_LEARNERS`), latest 3 receipts | Free: **Get Family Lifetime** (checkout), promo code. Lifetime: nothing to manage; receipts; refund help line. |
| Co-parent (caregiver in a family) | `/billing` | Family card read-only: plan and status, learners covered | Nothing; the line "The plan owner manages this." |
| Teacher, stand-alone class (owner) | `/billing` | Class card: Free (`n of 20` students, `FREE_CLASS_STUDENT_CAP`) or Group License (status, renews / ends on, students `n`, no cap) | Free: **Get Group License** (checkout). Licence: **Manage subscription** (portal), receipts. |
| Teacher, class inside a school (owner of the class, school pays) | `/billing` | Class card: "Covered by *School*'s licence", the licence end date, students `n` | Nothing (the server already refuses a licence for a class inside a school, `entitlements.ts:66-68`). |
| Teacher member of a school (role `teacher` on the school) | `/billing` | School card read-only: "Covered by *School*'s licence until *date*", no seat counts | Nothing. |
| School admin (owner of a school) | `/billing` | School card: licence or contract, status, students `n of 300`, teachers `n of 10` (`SCHOOL_LICENSE_*`; contract seats when `school_seat`) | Free: **Get Group License**. Licence: **Manage subscription**, receipts. Always: **Contact us** for a contract. |
| Admin role on a school (not owner) | `/billing` | Same card as the school owner (the admin role may already buy and manage today) | Same as the school owner. |
| Learner, family device | learner app, Profile > Plan details, behind the PIN gate | Plan screen: free / full journey / covered by *space* (wireframe `billing/plan-status`) | Web: **Open billing** (opens `/billing` in a new tab). Native: nothing. |
| Learner, self-only device (adult learning alone) | same; the gate opens directly when no PIN is set (`logic/profiles/gate-route.ts`) | same, worded for "you" (audience `self`) | same. To buy, they sign in as a grown-up on `/billing` and set up a family space for themselves (OD-9). |
| Grown-up with no space yet | `/billing` | Empty state: "Plans attach to a family or a class." | **Set up my family** / **Set up a class** (SHELL's create-space flow, today `/teach/start`). |

Rules that hold across the table:

- **Prices, receipts and actions are for the payer only.** A non-payer card never shows an amount, a promo field, a receipt or a button. The server enforces it (section 5.3); the page only renders what it gets.
- **One card per space**, never a merged "your plan" across spaces, because each space is paid separately. Order: spaces the viewer pays for first, then the rest; within each group family, class, school; then newest first (the order `GET /api/spaces` uses, `spaces.ts:141`).
- **Archived spaces** are left out. A space archived with an active group licence still shows in `/billing` for its payers until the licence ends, so the owner can cancel it (it would otherwise renew unseen).
- **Account-subject rows** (legacy `subjectKind: 'account'`, none are issued today) show as one extra card titled "Your account" for the account itself.
- **Status never relies on colour alone.** Every state has words (`console.entitlementStatus.*`, `console.ts:271`).

### 4.3 The billing home (`/billing`, wireframe `billing/billing-home`)

Layered, short, one decision per block (owner item 13). From top to bottom:

1. **Shell header** from SHELL (title "Billing", back to the grown-up home, language select, sign out).
2. **Test-mode banner** when `summary.mode === 'test'`: "Test mode: no real card is charged." One line, neutral tone, always visible while in test mode. When `summary.mode === 'none'` (no Stripe key bound), the line reads "Checkout is not set up on this deployment yet." and every buy and manage button is disabled. When `summary.purchasesOpen === false` with `mode === 'live'`, the line reads "Payments are not open yet. Nothing was charged." and buttons are disabled.
3. **Return notice** for `?checkout=` (section 4.5).
4. **Your plans**: one card per space (section 4.2). A card has: kind label and space name (heading), a plan line, a status line, a usage line, then actions. Payer cards add a collapsed **Receipts** disclosure showing the latest 3 rows and **All receipts** when there are more (wireframe `billing/receipts`).
5. **Add a plan**: only when at least one payer card has a buy action. One row per buyable space: plan name, what it includes (`console.billing.includes.*`), price (`planPrice`, from `PLAN_PRICING` through `formatUsd`), and a button. Exactly one row carries the primary button (the first recommendation, as `planRowsFor` does today, `billing.ts:139-145`); the rest are secondary. A school also gets the **Contact us** row. Above the rows, a collapsed **Have a code?** disclosure holds the promo form (F-ENT-002 §3.3, unchanged behaviour: one code rewrites every purchasable row's price line).
6. **Help**: "Questions or a refund? Write to hello@hangulroute.com." (the address the site already uses), "Learners never see prices or receipts." and "On a shared device? Sign out when you are done."

Copy rules for this page: no "best value", "save", "only today", countdowns, strike-through anchor prices other than the promo line F-ENT-002 already defines, no urgency colour, no comparison with other learners or schools. Prices appear only in the Add a plan rows and in the payer's receipts. The page never says "Premium" to mean a person; it names the plan.

### 4.4 Buying (`POST /api/entitlements/stripe/checkout`, extended)

- **Who.** Unchanged: a payer of the space (the `space.manage` check, section 4.2); `family_lifetime` for a family, `group_license` for a stand-alone class or a school (F-ENT-001 §3.3).
- **Step-up first** (OD-7, default on). If the Clerk session's first-factor verification is older than `STEP_UP_MAX_AGE_MIN = 10` minutes, the Worker answers `403 reverify_required` and the page shows `billing/step-up` ("Confirm it's you"), which runs Clerk's reverification (`useReverification` in `@clerk/clerk-react` 5.x) and retries the same request once. The Worker reads the age from the session token's `fva` claim (factor verification age, minutes, first factor first). When the claim is absent (an older token format), the Worker does not block, and the page's own reverification call is the backstop. Reason: the billing page now shares an origin with the learner app on a family device, and a signed-in grown-up session can outlive the grown-up at the keyboard.
- **Already active.** New: when the subject already holds an **active** row of the same plan (`isEntitlementActive`), the Worker answers `409 already_active` and creates no session. The page shows "This plan is already active. Nothing was charged." and reloads the summary. This stops a double lifetime purchase from two tabs.
- **Live guard** (section 4.9): `503 live_not_enabled` before any Stripe call.
- **Return URLs.** `success_url = <billingUrl>?checkout=success&plan=<planKey>&id=<spaceId>`, `cancel_url = <billingUrl>?checkout=cancel`. `<billingUrl>` comes from `billingReturnUrl(env)`:
  - `env.BILLING_URL` when set (a full URL, for example `https://app.hangulroute.com/billing`);
  - else, until B-10: `${CONSOLE_URL ?? 'https://hangulroute.com'}/teach/billing` (today's behaviour, so deploying the server first changes nothing);
  - else, from B-10: `https://app.hangulroute.com/billing`.
  The forwarder (section 4.1) makes even an old return land on the app host.
- **Metadata.** Unchanged `metadata[subjectKind|subjectId|planKey]` (and `subscription_data[metadata]` for the licence). New for payment mode: `payment_intent_data[metadata][subjectKind|subjectId|planKey]`, so a refund found through the payment intent maps back to the subject without a table lookup (section 5.4 keeps the lookup as the fallback).
- **The checkout page itself** is Stripe-hosted. A one-time lifetime payment keeps `customer_creation=always` (`stripe.ts:183`). `invoice_creation` stays off (OD-11): the receipt for a lifetime payment is Stripe's charge receipt, which costs nothing extra.

### 4.5 Coming back from Stripe (wireframe `billing/checkout-return`)

The page reads `checkout`, `plan` and `id` once, then removes them with `history.replaceState` so a refresh or a copied URL does not repeat the notice.

| Query | State | What the grown-up sees |
|---|---|---|
| `checkout=success&plan=P&id=S` | **checking** | "Almost there: checking your plan." The page polls `GET /api/billing/summary` every 2 s, at most 10 times (20 s), until the card for `S` shows plan `P` as active. A polite live region announces each state change once. |
| same, and the card turns active | **done** | "Thank you. The plan is active. Learners see it on their next sync." (`console.billingSuccess`, `console.ts:74`, unchanged words). Focus moves to that space's card heading. |
| same, 10 polls and still not active | **still processing** | "Your payment went through. The plan shows here in a minute." and **Check again** (one more poll round). No error tone: the webhook is late, not failed. |
| `checkout=cancel` | **cancelled** | "Nothing was charged." (`console.billingCancelled`). |
| `checkout=success` without `plan`/`id` (a return from an older session) | **done-unknown** | Reloads the summary once and shows the existing success line. |

### 4.6 Managing and ending

- **Group License**: **Manage subscription** opens the Stripe Billing Portal (cancel, change card, invoices there too). Portal `return_url = <billingUrl>` (same `billingReturnUrl`). Step-up applies (section 4.4). Cancelling keeps coverage until the period end (`cancelled` while `expiresAt` is in the future, F-ENT-001 §3.2); the card says "Ends on *date*".
- **Past due**: the card status reads `console.entitlementStatus.pastDueKept` while the 7-day grace runs (`PAST_DUE_GRACE_MS`), and a one-line note above the cards: "A payment didn't go through. Update your card in Manage subscription; learners keep the full journey for a week." Neutral tone, not the danger colour.
- **Family Lifetime**: no Manage button (nothing renews). The card reads "Family Lifetime · yours for good". The help line carries the refund contact.
- **Refunds** are done by the owner in the Stripe dashboard. The webhook records them (section 5.4). **Rule (OD-6, default)**: a **full** refund of a Family Lifetime payment sets that family's `family_lifetime` row to `expired`; a partial refund changes nothing. Learners keep every star, card and progress item (CLAUDE.md §1: earned items are never taken away); only premium coverage ends, so stages beyond the free set follow FREE's rules again. A Group License refund changes nothing by itself; Stripe's own subscription events decide its status.
- **A space archived** with an active plan (`POST /api/spaces/:id/archive`, `spaces.ts:227`; no route deletes a space today): B-12 makes the space settings archive confirm name the plan it affects ("Learners in *space* lose the Family Lifetime plan while it is archived." / "The Group License keeps renewing until you cancel it in Billing."). Unarchiving restores coverage, because `tierFromSpaces` skips archived spaces only while they are archived (`lib/entitlement.ts:97-104`). A lifetime plan belongs to its family space and does not move to another space.

### 4.7 The learner Plan screen (mobile, wireframe `billing/plan-status`)

Replaces the current price-bearing paywall body. The navigation route key stays `Paywall` (and `GrownUpDestination` `'Paywall'`), so the entries FREE and F-ROUTE-001 add keep working; the screen's title becomes "Plan".

- **Entry**: Profile > plan card button **Plan details** (was "Unlock", `ProfileScreen.tsx:243`), through the grown-up gate as today; and any locked-content tap that FREE routes here.
- **States** from `paywallState(tier, source)` (`logic/paywall.ts:16-19`, unchanged):
  - **covered** (premium from a class or school): "*Name* is covered by *space*." and "Everything is open while they are in it." No button except **Back to journey**.
  - **premium** (from the family): "*Name* has the full journey." and "From your family's Family Lifetime plan."
  - **free**: family audience "*Name* is on the free plan."; self audience "You're on the free plan." Then one line on what is open, from FREE's copy key (until FREE ships: "Stage 1 is open to everyone.").
- **Web only** (`Platform.OS === 'web'`): under the state, a secondary button **Open billing** that opens `billingUrl()` in a new tab through `Linking.openURL`, and one caption "Plans and receipts are on the billing page for grown-ups." If opening fails, the existing fallback line pattern shows the URL to type (`caregiver.plan.openFailed`).
- **Native builds** (`ios`, `android`): no button, no URL, no price, and no sentence that mentions the web, a website or buying elsewhere (section 4.8).
- **Removed from the learner side**: the Family Lifetime offer card and its price, the bullets list, the promo hint, the "buy it once on the web console" and "buying inside this app arrives with the store update" lines, the terms line. Their dictionary keys are deleted in the same PR (section 6.3).
- **The Profile plan card** keeps its Free / Premium pill and "Unlocked by *space*" note (F-ENT-001 §3.4); only the button label changes.
- **Link target.** `billingUrl(env)` in `logic/paywall.ts` replaces `consoleBillingUrl`: `EXPO_PUBLIC_BILLING_URL` when set; else, until B-10, `${EXPO_PUBLIC_CONSOLE_URL || 'https://hangulroute.com'}/teach/billing` (today's target, which the forwarder later redirects); from B-10 the default is `https://app.hangulroute.com/billing`. `privacyUrl` (`logic/links.ts`) keeps reading `EXPO_PUBLIC_CONSOLE_URL`, which now only means "the site root".

### 4.8 Native builds and store rules

Reading of the store rules this spec designs to (verify against the current text before any store submission; OD-4, OD-5):

- **Apple App Review Guideline 3.1.1**: digital content and features unlocked inside the app use in-app purchase; the app and its metadata must not include buttons, external links or other calls to action that direct customers to purchasing mechanisms other than in-app purchase. Apple changed this for the **United States storefront** in May 2025 (external purchase links and buttons allowed there). This spec does **not** use that exception (OD-4).
- **Guideline 3.1.3(b) Multiplatform Services**: content bought elsewhere may be unlocked in the app if it is also offered as an in-app purchase. Family Lifetime bought on the web therefore needs an in-app equivalent (F-IAP-002) before a store-distributed build unlocks it (OD-5).
- **Guideline 3.1.3(c) Enterprise Services**: an app sold directly to organisations for their students may let those users access what the organisation bought. Group License and school contracts fit here, so class and school coverage stays honoured in native builds.
- **Google Play Payments policy**: in-app digital purchases use Google Play Billing; linking to another payment method needs an enrolled programme in an eligible region. Not enrolled (OD-4).
- **Kids audiences**: the app ships in Education, not the Kids Category (CLAUDE.md §1). Any external link inside a grown-up area stays behind the gate regardless.

What this means in code (B-9), enforced by tests:

1. On `ios` and `android`, the Plan screen renders no button that opens a URL, no price, no promo text, and no string from the deny list `['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console']` (a unit test renders all three states with `Platform.OS` mocked and scans the text tree).
2. The Profile card on native never shows an "Unlock" or "Buy" wording; it shows **Plan details**.
3. Native builds keep reading the inbox tier for every source (family, class, school), as today (`store/tier-store.ts`). The constraint in OD-5 is a release rule, not a code switch.
4. Nothing in the native app takes a promo code (F-ENT-002 §3.4, unchanged).

### 4.9 Test mode, live mode, prices

- **Mode** comes from the Stripe secret key prefix: `sk_test_` / `rk_test_` → `test`; `sk_live_` / `rk_live_` → `live`; no key → `none` (`stripeMode(env)` in `lib/stripe.ts`).
- **Live guard**: in `live` mode, `POST /stripe/checkout`, `/stripe/portal` and `/stripe/promo` answer `503 live_not_enabled` unless the Worker variable `BILLING_LIVE_ALLOWED` is exactly `true`. The webhook keeps processing in every mode (so nothing paid is ever lost). `GET /health` (`healthReport`, `lib/runtime.ts:82`, booleans only per SEC-2) adds `bindings.stripeLive` (true when the bound key is a live key) and `bindings.billingLiveAllowed`.
- **Prices**: the signed-in billing page keeps showing `PLAN_PRICING` amounts in test mode under the test banner (OD-2), as `/teach/billing` does today. Nothing else shows a price: not the learner app, not hangulroute.com, not telemetry, not a notification. The owner lifts this only together with `BILLING_LIVE_ALLOWED`.
- **Receipts** recorded from a test-mode event carry `livemode: false` and show a "test" pill.

### 4.10 Receipts and history

- **Source**: Stripe webhooks recorded in a new table `billing_events` (section 5.1) from the day B-3 deploys. Earlier sandbox payments have no rows; the receipts list says "Older payments are in the receipt email from Stripe." when the space has an active Stripe plan but no rows.
- **Who**: payers of the space only (section 4.2). Caregivers and teachers never receive receipt rows or links.
- **Row**: date (the event's `occurred_at`, shown as the UTC calendar day like the status line, `billing.ts:72`), kind (Payment, Renewal, Refund, Payment didn't go through), plan name, amount (`formatUsd` for `usd`; other currencies through `Intl.NumberFormat` with the stored ISO code), a "test" pill when `livemode` is false, and **View receipt** when a receipt URL exists.
- **Receipt link**: for a licence, Stripe's hosted invoice page (`hosted_invoice_url`); for a lifetime payment, the charge receipt (`receipt_url`), fetched on first view and cached (section 5.4); for a refund, the original charge's receipt (Stripe shows the refund on it). The link opens in a new tab with `rel="noopener noreferrer"`; its accessible name says it opens Stripe.
- **Count**: the card shows the latest 3; **All receipts** opens `/billing/receipts?id=` with up to 50 newest rows. Older rows stay in the table and in Stripe; the page says "Older receipts: see Stripe's emails or write to us." past 50.
- **A failed payment** row is plain text, never red, with the same note as the past-due card.

### 4.11 Lifetime purchase model (restated, binding)

- Product `family_lifetime`: one payment (`PLAN_PRICING.family_lifetime`, `per: 'once'`), Stripe Checkout `mode=payment`, `customer_creation=always`, no subscription, no portal.
- On `checkout.session.completed` the row becomes `active` with `expiresAt: null` and never lapses (F-ENT-001 §3.1).
- It covers one family space and every learner in it, up to `FAMILY_LIFETIME_LEARNERS` (5), every Stage now and later.
- It ends only by a full refund (OD-6). Archiving the family space pauses its coverage until it is unarchived (B-12 says so first).
- Copy never says "subscription", "renews" or "cancel" about it. The page and the receipt both say "one payment".

## 5. Data and API (all additive)

### 5.1 D1: `billing_events` (new migration, next free number; `0007_billing_events.sql` at the basis commit)

```sql
-- F-BILL-002 §5.1: payment history recorded from Stripe webhooks. Additive only.
CREATE TABLE IF NOT EXISTS billing_events (
  id            TEXT PRIMARY KEY,   -- bev:xxxx
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('account', 'space')),
  subject_id    TEXT NOT NULL,
  plan_key      TEXT NOT NULL CHECK (plan_key IN ('family_lifetime', 'group_license', 'school_seat')),
  kind          TEXT NOT NULL CHECK (kind IN ('purchase', 'renewal', 'refund', 'failed')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency      TEXT NOT NULL,      -- ISO 4217, lower-case as Stripe sends it
  provider      TEXT NOT NULL CHECK (provider IN ('apple', 'google', 'stripe', 'manual')),
  provider_ref  TEXT NOT NULL,      -- payment intent / checkout session / invoice id; refunds: <charge>:refund:<cumulative cents>
  payment_ref   TEXT,               -- the payment intent behind an invoice (refund matching); NULL when unknown
  receipt_url   TEXT,               -- Stripe-hosted invoice or receipt page; NULL until known
  livemode      INTEGER NOT NULL DEFAULT 0,
  occurred_at   TEXT NOT NULL,      -- ISO, from the Stripe object
  created_at    TEXT NOT NULL,
  UNIQUE (provider, provider_ref, kind)
);
CREATE INDEX IF NOT EXISTS idx_billing_events_subject ON billing_events(subject_kind, subject_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_payment ON billing_events(payment_ref);
```

- The file takes the next free four-digit prefix at merge time; `scripts/check-migrations.mjs` fails CI on a shared prefix, so a parallel spec that lands a migration first means a rename on rebase, nothing more.
- No card data, no email, no name, no address. Amounts, dates, Stripe ids and a Stripe-hosted URL only.
- Webhook retries are idempotent through the unique key (`INSERT … ON CONFLICT DO NOTHING`, then a receipt-URL update when the new row has one).
- Rows live as long as their space. No route deletes a space today (spaces are archived, `spaces.ts:227`); a later spec that adds space or account deletion must delete the space's `billing_events` rows with it. Stripe keeps the payment record and the buyer keeps Stripe's email.
- The migration is applied by the API Worker's deploy command before the Worker code (server-first, `apps/api/wrangler.toml`). Nothing reads the table until B-4 deploys.

### 5.2 Schemas (`packages/content-schema/src/schemas/billing.ts`, new; exported from `index.ts`, appended)

- `BILLING_PATH`, `BILLING_RECEIPTS_PATH`, `STEP_UP_MAX_AGE_MIN = 10`, `RECEIPTS_PAGE_LIMIT = 50`, `RECEIPTS_CARD_LIMIT = 3`.
- `BillingEventKindSchema = z.enum(['purchase', 'renewal', 'refund', 'failed'])`.
- `BillingEventSchema`: `{ id: /^bev:[a-z0-9-]+$/, subjectKind, subjectId, planKey, kind, amountCents: int ≥ 0, currency: /^[a-z]{3}$/, provider, providerRef, paymentRef: string | null, receiptUrl: url | null, livemode: boolean, occurredAt, createdAt }`.
- `ReceiptViewSchema`: `BillingEventSchema` without `subjectKind`, `subjectId`, `providerRef`, `paymentRef`, `createdAt` (the page never needs Stripe ids).
- `StripeModeSchema = z.enum(['test', 'live', 'none'])`.
- `CoverageSchema` (discriminated on `state`):
  - `{ state: 'free' }`
  - `{ state: 'own', planKey, status, expiresAt: string | null, statusSince: string }` (the space holds the plan)
  - `{ state: 'school', schoolName: string, planKey: 'group_license' | 'school_seat', expiresAt: string | null }` (a class covered by its school)
- `UsageSchema`: `{ learners: int ≥ 0, learnerCap: int | null, teachers: int | null, teacherCap: int | null }` (`null` cap = unlimited; teachers only for schools).
- `BillingSpaceCardSchema`: `{ spaceId, kind, name, role, payer: boolean, coverage, usage, actions: { buy: PurchasablePlanKey | null, manage: boolean, contact: boolean }, receipts: ReceiptView[] (payer only, at most 3), moreReceipts: boolean, legacyNoHistory: boolean }`.
- `BillingSummarySchema`: `{ mode: StripeMode, purchasesOpen: boolean, cards: BillingSpaceCard[], account: EntitlementView-like cards for subject `account` (usually empty), adultAccess: { coveredAny: boolean } }`.
  - `adultAccess.coveredAny` is true when any card's coverage is not `free`. BROWSE may use it as its "paying grown-up" predicate; this spec only provides it.
- Parsing is lenient on the client (`safeParse`, unknown keys stripped), so a newer Worker never breaks an older page.

### 5.3 Routes

| Method · path | Who | Result |
|---|---|---|
| `GET /api/billing/summary` | signed-in account | `BillingSummary`. One card per non-archived space where the account is `owner`, `caregiver`, `teacher` or `admin` (plus archived spaces the viewer pays for that still hold an active group licence). `payer` = the `space.manage` check of section 4.2. Viewer cards carry `receipts: []`, `actions` all off. `usage` for viewers: learner count only for family and class; a school's seat counts only for payers. Never a learner name, never a promo code, never a price, never `customerRef`. |
| `GET /api/billing/receipts?id=<spaceId>` | a payer of the space | `{ spaceName, receipts: ReceiptView[] }`, newest first, at most 50. 403 for any other role, 404 for an unknown space. For a lifetime `purchase` row without `receiptUrl`, the Worker fetches `GET /v1/payment_intents/<ref>?expand[]=latest_charge` once, stores `latest_charge.receipt_url`, and returns it; on a Stripe error it returns the row with `receiptUrl: null`. |
| `POST /api/entitlements/stripe/checkout` | a payer of the space | as F-ENT-001 §3.3, plus: `403 reverify_required` (section 4.4), `409 already_active`, `503 live_not_enabled`, return URLs from `billingReturnUrl`, `payment_intent_data[metadata]` in payment mode. |
| `POST /api/entitlements/stripe/portal` | a payer of the space | as today, plus step-up, live guard and `billingReturnUrl`. |
| `POST /api/entitlements/stripe/promo` | account | as today, plus the live guard. |
| `POST /api/entitlements/stripe/webhook` | Stripe | as today, plus history recording (section 5.4). |
| `GET /api/entitlements` | account | unchanged (the old page keeps working until B-10; the new page uses the summary). |
| `GET /health` | anyone | adds the booleans `bindings.stripeLive`, `bindings.billingLiveAllowed`. |

`GET /api/billing/*` is a new Hono router mounted in `packages/backend/src/app.ts` next to `/api/entitlements`. CORS already allows `https://app.hangulroute.com` (`packages/backend/src/lib/cors.ts` defaults), and `verifyToken` has no `authorizedParties` (`lib/auth.ts:30-33`), so a Clerk token minted on the app origin is accepted with no change.

### 5.4 Webhook history (`lib/billing-events.ts`, pure mapping + one Db write)

New events to subscribe in the Stripe dashboard (runbook Step 8, B-10): `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. Existing: `checkout.session.completed`, `customer.subscription.created|updated|deleted`.

| Event | Recorded as | Subject from | Amount | Receipt URL |
|---|---|---|---|---|
| `checkout.session.completed`, `mode=payment` | `purchase`, `provider_ref` = `payment_intent` (or the session id when a 100%-off code made it free) | session `metadata` (already set) | `amount_total` | null (filled on first receipts view) |
| `checkout.session.completed`, `mode=subscription` | nothing (the first `invoice.paid` records it) | | | |
| `invoice.paid` | `purchase` when `billing_reason === 'subscription_create'`, else `renewal`; `provider_ref` = invoice id; `payment_ref` = `payment_intent` (older API versions) or the first `payments.data[].payment.payment_intent` (2025 versions) | `parent.subscription_details.metadata` (2025 versions) or `subscription_details.metadata` (older), else the entitlement whose `providerRef` equals the subscription id (`parent.subscription_details.subscription` or `subscription`) | `amount_paid` | `hosted_invoice_url` |
| `invoice.payment_failed` | `failed`; `provider_ref` = invoice id | as above | `amount_due` | `hosted_invoice_url` |
| `charge.refunded` | `refund`; `provider_ref` = `<charge id>:refund:<amount_refunded>` | the `purchase` / `renewal` row whose `provider_ref` equals the charge's `payment_intent` (lifetime) or whose `payment_ref` equals it (licence), or whose `provider_ref` equals the charge's `invoice` when that field is present | `amount_refunded` minus the refunds already recorded for that charge | the charge's `receipt_url` |

- The webhook endpoint's API version is whatever the Stripe dashboard pins; the mapper reads both the older and the 2025 shapes listed above, the way `promoFromStripe` already reads two coupon locations (`stripe.ts:224-245`). An event that cannot be mapped to a subject is acknowledged `200 { applied: false }` and recorded nowhere.
- A full refund (`charge.refunded` with `refunded === true`) of a `family_lifetime` purchase also calls `applyEntitlement({ …, status: 'expired', provider: 'stripe' })` (OD-6).
- `livemode` is copied from the event.
- Signature checks, tolerance and responses stay exactly as F-ENT-001 §3.3.

### 5.5 Db interface (`packages/backend/src/db/types.ts`, memory and D1 implementations)

Appended methods: `recordBillingEvent(input): Promise<BillingEvent>` (insert or keep, then fill `receipt_url` when missing), `billingEventsFor(subjectKind, subjectId, limit): Promise<BillingEvent[]>`, `billingEventByRef(provider, providerRef, kind?)`, `billingEventByPaymentRef(paymentRef)`, `setBillingReceiptUrl(id, url)`, `entitlementByProviderRef(provider, providerRef): Promise<Entitlement | null>`. The test-reset list (`db/memory.ts:438`) clears the new map.

### 5.6 Worker variables (dashboard, Type Text; documented in `apps/api/wrangler.toml` comments and runbook Step 8)

| Variable | Meaning | Default when unset |
|---|---|---|
| `BILLING_URL` | full URL of the billing page that Stripe returns to | until B-10: `${CONSOLE_URL ?? 'https://hangulroute.com'}/teach/billing`; from B-10: `https://app.hangulroute.com/billing` |
| `BILLING_LIVE_ALLOWED` | `true` lets a live Stripe key create checkout, portal and promo lookups | unset = refused |
| `CONSOLE_URL` | kept for backwards compatibility only; read only when `BILLING_URL` is unset, until B-10 | — |

Web build variables: `NEXT_PUBLIC_APP_URL` (exists; its origin is the guard's `appOrigin`). Mobile build variables: `EXPO_PUBLIC_BILLING_URL` (new, optional).

## 6. Copy and i18n

All strings in `packages/i18n` (F-I18N-001). English is written in this spec's PRs; `ko` and `es` entries follow the dictionary's native-review process (the typed overlay files gain the same keys, marked for review). No price, limit or date is typed into a message: amounts come from `formatUsd`, limits from content-schema constants, dates from `formatDate` (`billing.ts:2`).

### 6.1 `console.billing` (appended to `packages/i18n/src/messages/en/console.ts`)

| Key | English |
|---|---|
| `testMode` | Test mode: no real card is charged. |
| `liveOff` | Payments are not open yet. Nothing was charged. |
| `sections.yours` / `.add` / `.help` | Your plans / Add a plan / Help |
| `kind.family` / `.class` / `.school` | Family / Class / School |
| `coverage.free` | Free plan |
| `coverage.lifetime` | Family Lifetime · yours for good |
| `coverage.school(school)` | Covered by {school}'s licence |
| `coverage.schoolUntil(school, date)` | Covered by {school}'s licence until {date} |
| `readOnly` | The plan owner manages this. |
| `usage.learners(n, cap)` | {n} of {cap} learners (plural forms) |
| `usage.students(n, cap)` | {n} of {cap} students; `cap` null → {n} students |
| `usage.teachers(n, cap)` | {n} of {cap} teachers |
| `buy.family_lifetime.cta` / `buy.group_license.cta` | Get Family Lifetime / Get Group License |
| `promo.disclosure` | Have a code? |
| `noSpaces.title` | Plans attach to a family or a class. |
| `noSpaces.family.cta` / `noSpaces.class.cta` | Set up my family / Set up a class |
| `alreadyActive` | This plan is already active. Nothing was charged. |
| `checking` | Almost there: checking your plan. |
| `stillProcessing` | Your payment went through. The plan shows here in a minute. |
| `checkAgain.cta` | Check again |
| `receipts.title` | Receipts |
| `receipts.all.cta` | All receipts |
| `receipts.empty` | No receipts yet. |
| `receipts.older` | Older payments are in the receipt email from Stripe. |
| `receipts.beyondLimit` | Older receipts: see Stripe's emails or write to us. |
| `receipts.kind.purchase` / `.renewal` / `.refund` / `.failed` | Payment / Renewal / Refund / Payment didn't go through |
| `receipts.oneTime` | one payment |
| `receipts.test.pill` | test |
| `receipts.view.cta` | View receipt |
| `receipts.viewA11y(date)` | View receipt from {date} (opens Stripe in a new tab) |
| `receipts.pageTitle(space)` | {space} · receipts |
| `stepUp.title` | Confirm it's you |
| `stepUp.body` | Before a payment or a plan change, sign in again. |
| `stepUp.cta` | Continue |
| `stepUp.cancel.cta` | Not now |
| `help.refund(email)` | Questions or a refund? Write to {email}. |
| `help.learners` | Learners never see prices or receipts. |
| `help.sharedDevice` | On a shared device? Sign out when you are done. |
| `pastDue` | A payment didn't go through. Update your card in Manage subscription; learners keep the full journey for a week. |
| `moved.title` | Billing is in the app now |
| `moved.body` | Taking you there. |
| `moved.cta` | Open billing |

`console.billingKidsLine` (`console.ts:71`) is replaced by `help.learners` (audience rule: no "kids" on a surface that also serves adult learners' own billing). `console.billingPastDue` is replaced by `console.billing.pastDue` ("premium" → "the full journey"). Both old keys are deleted in B-8 together with their `ko` / `es` entries.

### 6.2 `caregiver.plan` (new, `packages/i18n/src/messages/en/caregiver.ts`)

| Key | English |
|---|---|
| `title` | Plan |
| `covered.title(name, source)` | {name} is covered by {source}. |
| `covered.note` | Everything is open while they are in it. |
| `covered.sourceFallback` | the class |
| `premium.title(name)` | {name} has the full journey. |
| `premium.note` | From your family's Family Lifetime plan. |
| `free.title.family(name)` | {name} is on the free plan. |
| `free.title.self` | You're on the free plan. |
| `free.open` | Stage 1 is open to everyone. (FREE replaces this line with its own key when it ships) |
| `openBilling.cta` | Open billing |
| `openBilling.caption` | Plans and receipts are on the billing page for grown-ups. |
| `openFailed(url)` | Open {url} in a browser. |
| `backToJourney.cta` | Back to journey |
| `profileCard.details.cta` | Plan details |

`a11y.planStatus(name, stateWords)`: "{name}: {state}." for the screen's summary heading.

### 6.3 Keys removed (B-9, with their `ko` / `es` entries)

`caregiver.paywall` (the whole object: `learnerFallback`, `backToJourney`, `covered`, `premium`, `free`, `bullets`, `offer`), `caregiver.audience.shared.paywallBuyOnWeb`, `.paywallBuyLater`, `.promoHint`, `a11y.lifetimeOffer`, and `learner.profile.plan.unlock` ("Unlock the journey") in favour of `caregiver.plan.profileCard.details`. `learnerFallback` moves to `caregiver.plan.learnerFallback` ("Your learner").

### 6.4 Length budgets

Buttons ≤ 24 characters in English and ≤ 32 in `es` (F-I18N-001 §3.11 budgets apply through the `cta` key suffix). The forwarder page's strings must render with no JavaScript bundle beyond the guard (section 8).

## 7. Rollout order (server first)

1. **B-1 … B-5 merge and deploy** (API Worker). Migration first, then code. Nothing visible changes: `/teach/billing` keeps calling `GET /api/entitlements`; checkout return URLs are unchanged while `BILLING_URL` is unset; the live guard changes nothing in test mode.
2. **B-6 … B-9 merge** (web + mobile). The new page exists at `/billing` on whichever host serves the console; `/teach/billing` still renders the page in place (forwarding off). The learner Plan screen loses its price and its native link immediately.
3. **SHELL serves grown-up pages on app.hangulroute.com**, including `/billing` and `/billing/receipts`, with Clerk working on that origin and the service-worker denylist live.
4. **B-10 cut-over**: forwarder on, defaults flipped (web `billingUrl`, mobile default, Worker fallback), runbook updated; owner sets `BILLING_URL=https://app.hangulroute.com/billing` and adds the three webhook events in the Stripe dashboard (test mode). The SITE marketing pages already carry no billing link by then (SITE's PR); B-10 adds the guard test that keeps it so.
5. **B-11 e2e** runs on the merged state. **B-12** may land any time after B-8.

Rollback: every step is a revert. Unsetting `BILLING_URL` returns checkouts to the old path, which the forwarder still handles; the table stays (additive, unused).

## 8. Accessibility

- Page structure: one `h1` (page title), one `h2` per section, one `h3` per card (kind and name). Cards are `section` elements labelled by their heading.
- Status is always words; pills have text; nothing is conveyed by colour alone. Past due and failed rows use the neutral notice tone, never `colors.feedback.danger`.
- The checkout-return states use one polite live region (`aria-live="polite"`), announced once per state change; focus moves to the activated card's heading when done.
- Disclosures (Receipts, Have a code?) are native `details`/`summary` or buttons with `aria-expanded` and `aria-controls`.
- Receipts on `/billing/receipts` are a table with a caption, column headers and the date as row header; on narrow screens it reflows to a list without horizontal scroll at 320 px width.
- Links that leave for Stripe say so in their accessible name; they open a new tab with `rel="noopener noreferrer"`.
- Every interactive control meets the `touchTarget` token; keyboard order equals visual order; a visible focus ring from the design-system tokens.
- The step-up dialog traps focus while open, restores focus to the button that opened it, and closes on Escape ("Not now").
- The forwarder page has a real link ("Open billing") so it works without script, with screen readers and with reduced motion; it does not auto-refresh more than once.
- Mobile Plan screen: the summary line is the screen's first accessible element (`a11y.planStatus`); the web-only button has `accessibilityRole="link"` and a hint that it opens the browser.

## 9. Privacy and safety

- **Children never pay and never see prices.** All buying is by a signed-in grown-up account on `/billing`. The learner app shows status only (section 4.7). No promo field anywhere a child can reach.
- **Shared-device step-up** before any money moves (section 4.4), and a "sign out when you are done" line.
- **Least data.** `billing_events` holds ids, amounts, dates, Stripe refs and a Stripe-hosted URL. No card numbers, names, emails or addresses are stored by us; Stripe Checkout collects them. The customer email already sent to Stripe (`customer_email` in `checkoutForm`, `lib/stripe.ts`) is the Clerk account email, unchanged.
- **Receipt URLs are capability links.** They go only to the payer, are never logged, never sent in telemetry, never placed in a URL of ours.
- **Non-payers see coverage, not money.** Enforced on the server (section 5.3).
- **No dark patterns.** Cancelling a licence is one button away (portal), as easy as buying. No urgency, no countdown, no "you will lose" wording; when coverage ends, learners keep everything they earned.
- **No ads, no third-party scripts** on `/billing` beyond Clerk (already on the console) and Stripe's hosted pages (off-site).
- **Verifiable parental consent** is untouched: billing links no learner data to an account. Coverage reaches learners only through the memberships that F-SPACE-001 and its consent flow created.
- **Learner identifiers** never appear in billing URLs, responses or telemetry.

## 10. Telemetry (Worker-first)

The console has no telemetry client (`telemetry.ts` comment at the F-PLAN-002 block). Billing events are therefore emitted **by the Worker** into the same telemetry store `POST /api/telemetry` writes to (`routes/telemetry.ts`), through a new `recordServerEvent(name, payload)` helper. The names are added to `TELEMETRY_EVENT_NAMES` (appended, with the exact-list test) in B-3, in the same PR as the only code that sends them, so no client can send a name the Worker does not know.

| Name | Sent when | Payload (codes only) |
|---|---|---|
| `billing.summary_viewed` | `GET /api/billing/summary` answers | `{ cards: n, payerCards: n, mode }` |
| `billing.checkout_started` | a checkout session is created | `{ planKey, mode, promo: boolean }` |
| `billing.checkout_refused` | checkout answers 403 / 409 / 503 | `{ planKey, reason: 'reverify_required' | 'already_active' | 'live_not_enabled' | 'not_configured' }` |
| `billing.checkout_completed` | webhook `checkout.session.completed` applied | `{ planKey, mode }` |
| `billing.portal_opened` | a portal session is created | `{ planKey, mode }` |
| `billing.payment_failed` | webhook `invoice.payment_failed` recorded | `{ planKey, mode }` |
| `billing.refund_recorded` | webhook `charge.refunded` recorded | `{ planKey, full: boolean, mode }` |
| `billing.receipts_viewed` | `GET /api/billing/receipts` answers | `{ rows: n }` |

- No account id, space id, learner id, amount, currency, promo code or URL in any payload. `profileId` is never set for these names.
- **Client forgery guard**: `POST /api/telemetry` rejects any name starting with `billing.` with `422` (server-only names), with a test.
- **Learner app**: keeps `paywall.viewed` (payload `{ from, state }`; `state` is `covered | premium | free`) and `paywall.console_opened` (web only; native never sends it because the button does not exist). Section D of `docs/roadmap/TELEMETRY-NAMES-2.md` records the payload note; the new names go in the next free section letter of that file in B-3.

## 11. Tests

| File | Covers |
|---|---|
| `packages/content-schema/src/__tests__/billing.test.ts` | every schema: valid and invalid ids, currency pattern, coverage union, summary lenient parse (unknown keys stripped), constants |
| `packages/content-schema/src/__tests__/telemetry.test.ts` | exact list includes the `billing.*` names, appended in order |
| `packages/backend/src/lib/__tests__/billing-events.test.ts` | mapping table of section 5.4: payment-mode session → purchase (with and without payment intent), subscription session → nothing, `invoice.paid` create vs cycle, both metadata and both payment-intent locations, fallback through `entitlementByProviderRef`, `invoice.payment_failed`, `charge.refunded` partial then full (delta amounts) matched through `provider_ref`, `payment_ref` and `invoice`, unmappable events, `livemode` copy |
| `packages/backend/src/lib/__tests__/stripe.test.ts` (extended) | `stripeMode` for each prefix; `checkoutForm` adds `payment_intent_data[metadata]` in payment mode only; `billingReturnUrl` precedence (`BILLING_URL`, `CONSOLE_URL`, default) |
| `packages/backend/src/__tests__/billing.test.ts` | `GET /summary` per persona: owner family free / lifetime, caregiver read-only (no receipts, no actions, no amounts), owner class free with cap usage, class in school (coverage `school`, no buy), school teacher member (no seat counts), school owner and school admin (both payers: seat counts, actions, receipts), class owner inside a licensed school (payer with no action and no price), archived class with live licence for payers only, no spaces, account-subject legacy row, `adultAccess.coveredAny`; `GET /receipts` payers only (owner and school admin allowed; 403 caregiver / teacher, 404 unknown), 50-row limit, newest first, lazy receipt URL fetch with injected fetch (success, Stripe error → null, cached second time) |
| `packages/backend/src/__tests__/entitlements.test.ts` (extended) | checkout `409 already_active`; `503 live_not_enabled` with a live key and without `BILLING_LIVE_ALLOWED`, allowed with it; portal and promo live guard; `403 reverify_required` when `fva[0] > 10`, allowed at ≤ 10 and when `fva` is absent; webhook records history and full lifetime refund expires the row (learner inbox tier flips to free; progress untouched); idempotent retries (same event twice → one row) |
| `packages/backend/src/__tests__/telemetry.test.ts` (extended) | `billing.*` names refused from clients with 422; server events recorded with codes-only payloads |
| `packages/backend` `test:sqlite` | migration applies on top of 0001-0006; unique key and idempotent insert; index used by `billingEventsFor` |
| `packages/backend/src/__tests__/health.test.ts` (extended) | `stripeLive`, `billingLiveAllowed`, booleans only, no key material |
| `apps/web/src/lib/console/__tests__/billing-summary.test.ts` | card view models for every persona row of section 4.2 (words via the dictionary), order, the one primary buy, receipts rows (kinds, test pill, currency formatting, one-payment label), empty state |
| `apps/web/src/lib/console/__tests__/billing-host.test.ts` | `billingForward` matrix: old path on both hosts, canonical on app host, canonical on site host, receipts path, localhost, null app origin, query kept, hash dropped, flag off |
| `apps/web/src/lib/console/__tests__/checkout-return.test.ts` | the return state machine: checking → done, → still processing after 10 polls, check again, cancelled, success without plan / id |
| `apps/web/src/app/__tests__/billing-page.test.tsx` | renders test banner, live-off, not configured; step-up dialog flow on `reverify_required`; `already_active` note; no price or receipt on non-payer cards |
| `apps/web/src/app/__tests__/site-no-billing.test.ts` (B-10) | scans `app/(en)`, `app/(loc)` and `components/landing` for `/billing`, `/teach/billing`, `checkout`, `stripe` and price patterns (reuses the landing-claims banned-price regexes); fails on any hit |
| `apps/mobile/src/logic/__tests__/paywall.test.ts` (extended) | `billingUrl` precedence (env, console fallback, default after B-10); `paywallState` unchanged |
| `apps/mobile/src/screens/paywall/__tests__/PaywallScreen.test.tsx` | all three states on `web`, `ios`, `android`: no price text anywhere; native renders no URL-opening control and none of the deny-list words (section 4.8); web renders one Open billing button; audience family vs self wording |
| `apps/mobile/src/screens/profile/__tests__/ProfileScreen.test.tsx` (extended) | the plan card button reads Plan details and routes through the gate |
| `apps/mobile/scripts/__tests__/pwa-postbuild.test.mjs` (extended) | `navigateFallbackDenylist` contains the `/billing` pattern; console files not precached |
| `packages/i18n/src/__tests__/billing-messages.test.ts` | new keys exist in `en`, typed in `ko` / `es` overlays; removed keys gone; no message contains a digit-dollar pattern or a hard-coded limit; banned words (`kids`, age ranges) absent from `console.billing` |
| `apps/web/e2e/billing.spec.ts` (B-11) | Playwright on the static export with a mocked API: parent free → Choose → (mock Stripe URL) → return checking → active; caregiver read-only; receipts page; `/teach/billing?checkout=cancel` forwards with the query; 320 px no sideways scroll; tab order = visual order |
| `apps/mobile/e2e/plan-status.spec.ts` (B-11) | PWA: Profile → gate → Plan screen shows no price; Open billing opens a new tab to the configured URL |

Coverage: `packages/content-schema` 100 %, `packages/backend` ≥ 90 %, `apps/web` verification logic (`billing-summary.ts`, `billing-host.ts`, `checkout-return.ts`) 100 %, `apps/mobile` `logic/paywall.ts` 100 % (docs/tests/coverage-targets.md).

## 12. PR table

| PR | Type and contents | Size | Depends on |
|---|---|---|---|
| B-0 | `docs`: this spec, six wireframes under `design/wireframes/billing/`, superseded notes on `console/billing.md` and `paywall/upgrade.md`, index rows in `docs/specs/README.md` and `design/wireframes/README.md` | S | — |
| B-1 | `feat(content-schema)`: `schemas/billing.ts` (constants, event, receipt, coverage, usage, card, summary, mode) + tests; export appended to `index.ts` | S | B-0 |
| B-2 | `feat(backend,api)`: additive migration `billing_events`, Db methods (memory + D1), `deleteSpace` cascade, sqlite tests | S | B-1 |
| B-3 | `feat(backend,content-schema)`: `lib/billing-events.ts` mapping, webhook recording, full-refund rule (OD-6), `payment_intent_data[metadata]`, `recordServerEvent`, `billing.*` telemetry names + exact-list test + client 422 guard, names doc section | M | B-1, B-2 |
| B-4 | `feat(backend)`: `/api/billing` router: `GET /summary`, `GET /receipts` (lazy receipt URL), `billing.summary_viewed` / `billing.receipts_viewed` | M | B-2, B-3 |
| B-5 | `feat(backend)`: `stripeMode`, live guard (`BILLING_LIVE_ALLOWED`), `409 already_active`, `billingReturnUrl` (`BILLING_URL`, old fallback kept), step-up `reverify_required` via `fva` (OD-7; `lib/auth.ts` exposes the verified claims next to `sub`), `/health` booleans, wrangler.toml comments | M | B-1 |
| B-6 | `feat(i18n)`: `console.billing.*` additions, `caregiver.plan.*`, `a11y.planStatus` (en; ko / es overlay entries for review) + tests | S | B-0 |
| B-7 | `feat(web)`: pure view models `billing-summary.ts`, `billing-host.ts` (forwarding flag off), `checkout-return.ts` + API client `billingSummary()` / `receipts()` + tests | M | B-1, B-6 |
| B-8 | `feat(web)`: the `/billing` page and `/billing/receipts` page (sections of 4.3, test banner, step-up dialog, return states, receipts disclosure), `/teach/billing` renders the same page, ConsoleShell Billing link → `BILLING_PATH`; old `billingKidsLine` / `billingPastDue` keys removed | L | B-4, B-5 deployed, B-7, a design mock in `design/screens/` from these wireframes |
| B-9 | `feat(mobile)`: Plan screen (status only, web-only Open billing, native no link), Profile button label, `billingUrl` + `EXPO_PUBLIC_BILLING_URL`, SW denylist `/billing`, removed paywall keys + tests | M | B-6 |
| B-10 | `feat(web,mobile,backend)` + `docs`: cut-over: forwarder on, defaults flipped to `https://app.hangulroute.com/billing`, `site-no-billing` guard test, runbook Step 8 (`BILLING_URL`, three new webhook events, `BILLING_LIVE_ALLOWED` stays unset) | S | B-8 deployed, SHELL serving `/billing` on the app host, SITE's link removal merged |
| B-11 | `test(e2e)`: web billing spec and PWA plan-status spec | S | B-9, B-10 |
| B-12 | `feat(web)`: space settings archive confirm names the active plan it affects (section 4.6) | S | B-8 |

B-1, B-6 can run in parallel right after B-0. B-2 → B-3 → B-4 is the server chain; B-5 runs beside it. B-9 needs only B-6 and can ship before the cut-over (it removes the native link and the price at once).

## 13. Owner decisions (each has a default; work never waits)

| # | Question | Default (applies until the owner answers) | Gates |
|---|---|---|---|
| OD-1 | Where does the billing page render on app.hangulroute.com, and under which path? | The existing Next.js billing code, moved to `/billing`, served on the app host by SHELL's mechanism. A different prefix changes only `BILLING_PATH`. | B-8 path, B-10 |
| OD-2 | Show `PLAN_PRICING` amounts on the signed-in billing page while Stripe is in test mode? | Yes, under the "Test mode: no real card is charged." banner (as `/teach/billing` does today). Never on the learner app or hangulroute.com. | B-8 |
| OD-3 | Learner Plan screen on the web: offer an **Open billing** button behind the gate? | Yes, web only, new tab, no price. Native: none. | B-9 |
| OD-4 | Use Apple's US-storefront external purchase link exception, or a Google Play alternative billing programme? | No, on every storefront. Native builds carry no external purchase link or mention. | B-9 (copy), store submissions |
| OD-5 | Native family coverage before F-IAP-002: may a store-distributed build unlock a Family Lifetime bought on the web? | Native builds keep honouring every tier source in code; before the first public store release, F-IAP-002 adds Family Lifetime as an in-app purchase (Guideline 3.1.3(b)). Until then native builds go only to TestFlight / internal testing. Class and school coverage is fine under 3.1.3(c). | release checklist only |
| OD-6 | What does a refund do? | A full refund of a Family Lifetime payment expires that family's plan; a partial refund changes nothing; Group License status follows Stripe's subscription events. Learners keep everything they earned. | B-3 |
| OD-7 | Require a fresh sign-in before checkout and portal? | Yes, when the first factor is older than 10 minutes (`STEP_UP_MAX_AGE_MIN`). | B-5, B-8 |
| OD-8 | Do viewers (co-parents, teachers in a school) see receipts? | No. They see coverage and status only. School admins are payers (they can already buy and manage), so they see receipts. | B-4 |
| OD-9 | How does an adult learning alone buy? | Sign in on `/billing` as a grown-up, set up a family space for themselves (the empty state links to it), buy Family Lifetime. No new product. | none (copy only) |
| OD-10 | How long does `hangulroute.com/teach/billing` keep forwarding? | Indefinitely (a static page, no cost). | B-10 |
| OD-11 | Stripe invoices for one-time lifetime payments (`invoice_creation`), for buyers who need a formal invoice? | Off. The Stripe charge receipt is the proof; a buyer who needs an invoice writes to hello@hangulroute.com and the owner issues one from the Stripe dashboard. Licences already get Stripe invoices. | B-3 |
| OD-12 | When does Stripe go live? | Not in this spec. `BILLING_LIVE_ALLOWED` stays unset and a live key is refused, until the owner says otherwise. | — |

Assumptions this spec relies on (and what happens if they change):

- **A1.** SHELL serves grown-up pages on app.hangulroute.com with Clerk on that origin. If SHELL slips, B-0 to B-9 still ship; only B-10 waits, and the page keeps working at `/teach/billing` on hangulroute.com.
- **A2.** The family cap of 5 learners stays on every family space, paid or not (`spaces.ts:300`). This spec does not change it.
- **A3.** FREE decides what is open on the free plan; the Plan screen reads its line. Until FREE ships, the line is "Stage 1 is open to everyone."

## 14. Out of scope

- App Store and Google Play purchases and restore (F-IAP-002), receipts for them, and their entitlement rows.
- Proration, plan switching between products, seat purchases, multi-currency prices, taxes and VAT invoices.
- Manual contract invoices (`school_seat`).
- A billing area inside native builds beyond the status-only Plan screen.
- Moving the rest of the console to the app host (SHELL) and rewriting the marketing site (SITE).
- Email notifications about renewals or failed payments (Stripe's own emails cover them).

## 15. Dependencies

- F-ENT-001 (entitlements, tier rule, checkout, portal, webhook) and F-ENT-002 (promo codes): extended, not replaced.
- F-CONSOLE-001 (static export, `?id=` addressing, console shell) and F-AUTH-002 (Clerk console sign-in).
- F-I18N-001 (dictionary, budgets, overlays).
- F-PWA-001 (telemetry names list) and F-LEARN-001 / F-PROF-001 (gate, audience copy).
- SHELL, SITE, FREE (section header table); BROWSE may consume `adultAccess.coveredAny`.
