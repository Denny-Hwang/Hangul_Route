Status: ready

# F-BILL-002 — Billing in the app for every persona: one billing home on app.hangulroute.com, plan status for each persona, receipts, nothing on the marketing site

**Status**: `ready` (revision 2, 2026-10-11, after two reviews; see the review log at the end)
**Scope**: `packages/content-schema` (billing summary, billing event and receipt schemas, telemetry names) · `packages/backend` + `apps/api` (additive D1 table `billing_events` and one index, `GET /api/billing/summary`, `GET /api/billing/receipts`, `POST /api/billing/receipt-link`, webhook history, checkout and portal hardening, live-mode guard, step-up) · `apps/web` (the content of the billing page at `/account/billing` and its receipts page, their view models) · `apps/mobile` (the status-only learner Plan screen replaces the price-bearing paywall; the Profile plan card words) · `packages/i18n` (`console.billing.*` additions, `caregiver.plan.*`, `a11y.planStatus`, learner Profile plan words) · `docs/launch/owner-runbook.md` (Step 8)
**Owner**: solo dev
**Rollout**: server first (B-1 to B-5, no visible change), then the learner Plan screen (B-9, ships alone and removes the price and the native link at once), then the billing page content (B-8a to B-8c) once the persona app shell serves `/account/billing` on app.hangulroute.com (F-APP-001 A-5c). Stripe stays in **test mode**: a live key is refused in code until the owner sets `BILLING_LIVE_ALLOWED=true` (section 4.9).
**Amended 2026-10-11 [BY]** by `AMENDMENTS-BILLING-FAMILY-YEARLY.md`: the family product is the **Family Plan**, $15.30 / year, a Stripe subscription that renews yearly and can be cancelled any time (no longer a one-time lifetime payment). Every [BY] mark below follows from it. The stored key stays `family_lifetime` (BY-D1).
**Wireframes** (drafted with this spec): `design/wireframes/billing/billing-home.md`, `billing/checkout-return.md`, `billing/receipts.md`, `billing/step-up.md`, `billing/plan-status.md`. They supersede `console/billing.md` and `paywall/upgrade.md` (both get a header note in B-0). The old-address notice is F-APP-001's `shell/moved.md`; this spec draws none.

Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit.

Owner request (2026-10-11), items covered here: **8** (every persona can see their own billing information) and **12** (billing only on app.hangulroute.com; hangulroute.com is intro and guide only). Item 13 (user-friendly overall) shapes the layout. Sibling specs written from the same request:

| Id | Short name | What it owns that this spec uses | Branch |
|---|---|---|---|
| **F-APP-001** | SHELL | the app host serving grown-up pages; `APP_ROUTES.billing = '/account/billing'`; the `/account/billing` route, its layout and the frame's Billing item (A-5c); the legacy `/teach/billing` redirect (A-5c, A-8 `legacyConsoleTarget`); the service-worker denylist and grown-up offline page (A-2); `billingReturnUrl(env, suffix)` (A-9); `openGrownUpArea` and the PIN destination `GrownUpArea` (A-6); `AdultFrame` (A-5a); `/start` (A-4) | `docs/persona-app-shell` |
| **F-SITE-002** | SITE | hangulroute.com content (no billing link, no price); `SITE_CLAIMS` in `apps/web/src/data/site-claims.ts` (S-2); builds no redirect table (old URLs are F-APP-001's stubs) | `docs/marketing-site-layered` |
| **F-ENT-003** | FREE | what is free (all of Stage 1, F-ENT-003 OD-1) and the access words; the free-plan lines on the Plan screen (E3-8) and their keys `caregiver.plan.freePlan` | `docs/free-day2-unlocked-curriculum` |
| **F-BROWSE-001** | BROWSE | lesson browsing for paying grown-ups; its own access rule `accountBrowseScope`; its [ See plans ] link targets `APP_ROUTES.billing` | `docs/adult-content-browser` |
| F-REPORT-001, F-FEEDBACK-001 | REPORTS, NOTES | features named in the billing page's "what you get" lines, through `SITE_CLAIMS` | `docs/progress-reports`, `docs/adult-feedback-channel` |

**One owner per piece** (binding for all five specs; section 13 lists the matching amendments the siblings carry):

| Piece | Owner | This spec |
|---|---|---|
| Path of the billing page | F-APP-001 `APP_ROUTES.billing` (`/account/billing`) | imports it; never spells the path |
| Route file, grown-up layout, `noindex`, frame nav item | F-APP-001 A-4, A-5a, A-5c | fills the page body (B-8a) |
| Old address on the app host (`/teach/billing`) | F-APP-001 A-5c redirect page | nothing |
| Old address on hangulroute.com | F-APP-001 A-8 stub pages (behind `CONSOLE_ORIGIN`), one hop via `legacyConsoleTarget` | nothing |
| Service-worker denylist and offline page for grown-up paths | F-APP-001 A-2 | nothing |
| Stripe return and portal URL helper `billingReturnUrl(env, suffix)` | F-APP-001 A-9 | B-5 adds `&plan=&id=` to the success suffix only |
| Learner app to billing hand-off | F-APP-001 A-6 `openGrownUpArea` | B-9b calls it from the Plan screen |
| What is free, and its wording | F-ENT-003 E3-8 (`caregiver.plan.freePlan`) | B-9 leaves slots on the Plan screen for it and owns the switch-off line `caregiver.plan.free.open` |
| "Paying grown-up" for browsing | F-BROWSE-001 `accountBrowseScope` | nothing (no second rule) |

---

## 1. Problem

Today every money surface sits on the wrong host or shows the wrong thing to the wrong person:

1. **Billing lives on the marketing domain.** The only checkout page is `hangulroute.com/teach/billing` (`apps/web/src/app/(console)/teach/billing/page.tsx`). Stripe sends buyers back there (`packages/backend/src/routes/entitlements.ts:82` and `:127`, `CONSOLE_URL ?? 'https://hangulroute.com'`). The learner app's paywall button opens it too (`apps/mobile/src/logic/paywall.ts:51-55`, `DEFAULT_CONSOLE = 'https://hangulroute.com'`). The owner wants hangulroute.com to be an intro and guide site only (item 12).
2. **A persona who does not own a space sees nothing.** `GET /api/entitlements` (`entitlements.ts:38-46`) lists only the account's own rows and the spaces it **owns**. A teacher whose class sits under someone else's school, a co-parent (caregiver role), or a teacher invited into a school cannot see what covers them or until when. Item 8 asks that every persona can see their own billing information.
3. **No history.** There is no receipt list and no payment history (F-ENT-001 §4 left "invoices list" out). A parent who paid has nothing in the product that proves it; a school cannot find last year's invoice.
4. **The learner side shows a price and a purchase path.** The PIN-gated paywall shows the family plan's price and an "Open the web console" button (`apps/mobile/src/screens/paywall/PaywallScreen.tsx:112-131`). On a native build the same button and the line "you can buy it once on the web console" (`packages/i18n/src/messages/en/caregiver.ts:43-44`) render too. That is a call to action toward a non-store purchase inside a store binary (section 4.8), and it puts a price one gate away from a child.
5. **A learner on a paid plan cannot see their plan.** The Profile plan button renders only when `tier !== 'premium'` (`apps/mobile/src/screens/profile/ProfileScreen.tsx:243`), and the card says "Premium" and "The full journey is unlocked" (`packages/i18n/src/messages/en/learner.ts:78-81`), words F-ENT-003 bans on learner surfaces.
6. **Nothing stops a live key.** The owner rule is "Stripe Live, real prices and commercial claims stay off until the owner says". Today that rests on nobody pasting an `sk_live_` key into the Worker; no code checks it.
7. **The return from Stripe is optimistic.** `?checkout=success` prints "the plan is active" (`console.ts:74`) before the webhook may have landed. A slow webhook leaves the page saying "Free" under a "Thank you" note.
8. **A cancelled license looks like it renews.** The Stripe portal cancels with `cancel_at_period_end=true` and the status stays `active` until the period ends; `entitlementFromStripeEvent` (`packages/backend/src/lib/stripe.ts:101-131`) ignores that flag, so the card would keep saying "renews".

## 2. User stories

> **Parent.** As a parent, I open the app, tap Billing in the grown-up area and see my family's plan, how many of my learners it covers, and the receipts for each year of the Family Plan, with **Manage subscription** to cancel or change the card. [BY] On a free family the buy button is right on my family's card. I never visit the marketing site to pay.

> **Teacher with a stand-alone class.** As a teacher, I see my class license, when it renews or ends, how many students it holds, and the receipts for each year. Manage subscription takes me to Stripe and back to the same page.

> **Teacher inside a school.** As a teacher invited into a school, I see "Covered by Maple School's license until 30 June 2027" and "Your school manages this plan." No prices, no buttons.

> **School admin.** As the school's owner or admin, I see the license, seats used for students and teachers, the receipts, and Contact us for a contract beyond the caps.

> **Co-parent.** As a second grown-up in a family, I see that the family has the plan and "The person who set up this family manages this plan."

> **Learner.** As a learner, I open Profile > Plan details without a PIN and see which plan I am on and where it comes from, never a price. On the web a grown-up can open Billing from there after the gate; inside an App Store or Google Play build there is no link and no mention of buying elsewhere.

> **Adult learning alone.** As an adult learning on my own phone, I want to buy the full route for myself without pretending to be someone's parent:
> 1. On app.hangulroute.com, sign in from the Welcome row or `/signin` and choose **Set up for me or my family** (this creates a family space; I am its owner).
> 2. Billing shows my family card with the buy button; I pay on Stripe and come back.
> 3. The done state says what to do next: **Connect a learner** shows my family's join code.
> 4. On my learning device: Profile > Classes and family > Join, type the code. My learner profile is now covered; the Plan screen says "You have the full route."

## 3. Goals and non-goals

### 3.1 Goals

- **G1. One billing home on app.hangulroute.com.** `https://app.hangulroute.com/account/billing` (`APP_ROUTES.billing`) is the only place to buy, manage, or read receipts. hangulroute.com shows no price, no plan comparison, no checkout and no billing link.
- **G2. Every persona sees their own plan.** Owner, caregiver, teacher and admin roles each get a card per space they belong to: coverage, status, dates, usage. Only the payer sees prices, actions and receipts. Learners see their own plan status on the Plan screen, for every tier, without a PIN.
- **G3. Receipts and history** for every Stripe payment, renewal, failed payment and refund recorded from now on, with a link to the Stripe-hosted receipt or invoice fetched fresh when opened.
- **G4. The learner side is status only.** No price, no offer card, no promo hint. Web shows one gated **Open billing** button. Native shows no link at all.
- **G5. Old links keep working** through the sibling redirects (section 4.1), keeping `?checkout=`.
- **G6. Sandbox stays sandbox.** Test mode is visible on the page. A live key is refused for checkout, portal and promo lookups until the owner opts in.
- **G7. Honest return from Stripe.** The page waits for the webhook and says so, instead of claiming success early, and pauses while offline.
- **G8. The yearly Family Plan is explicit [BY].** $15.30 a year, renews until cancelled, cancel any time in one step, access to the end of the paid year, a receipt for every year, refund rule written down.
- **G9. A purchase always leads somewhere.** When a paid space has no learner yet, the page shows how to connect one.

### 3.2 Non-goals

- Store purchases (App Store / Google Play in-app purchase). F-IAP-002 owns them; this spec only states what a native build must not show (section 4.8).
- New products, new prices, coupons logic, taxes, multi-currency, seat-based billing UI. `PLAN_PRICING` (`packages/content-schema/src/schemas/entitlement.ts:64`) stays the single source.
- Changing who pays or how a learner inherits the full route (`tierForLearner`, F-ENT-001 §3.2).
- Routing, hosting, sign-in, the adult frame, redirects and the service worker (F-APP-001); the marketing copy (F-SITE-002); what is free (F-ENT-003); who may browse lessons (F-BROWSE-001).
- Account deletion and data export of payments. Stripe stays the system of record for money.
- Invoices for a manual `school_seat` contract (the owner sends those outside the product).
- Disputes and chargebacks (`charge.dispute.*`): the owner handles them in the Stripe dashboard (section 14).

## 4. Detailed behaviour

### 4.1 Hosts and paths

| URL | What it is after this spec | Owner |
|---|---|---|
| `https://app.hangulroute.com/account/billing` | **The billing home** (wireframe `billing/billing-home`). Signed-in grown-ups only (Clerk), inside F-APP-001's grown-up layout and lock. | route: F-APP-001 A-5c · content: this spec B-8a |
| `https://app.hangulroute.com/account/billing/receipts?id=<spaceId>` | All receipts of one space the viewer pays for (wireframe `billing/receipts`). Query parameter, not a path segment, because the web build is a static export (F-CONSOLE-001 §3.7). The id is the opaque `space:…` id; no learner or space name ever appears in a URL. Inside F-APP-001's `/account/*` reservation (its section 3.2). | this spec B-8c |
| `https://app.hangulroute.com/teach/billing` | Client redirect to `/account/billing`, query kept. | F-APP-001 A-5c |
| `https://hangulroute.com/teach/billing` (and with a trailing slash) | Forwarded to `https://app.hangulroute.com/account/billing` with the query and fragment, in one hop, by F-APP-001 A-8's static stub page (`legacyConsoleTarget('/teach/billing') = '/account/billing'`), live once the owner sets `CONSOLE_ORIGIN` on the site build (F-APP-001 M3). F-SITE-002 adds no second forwarding layer. Until then the old page keeps rendering on hangulroute.com, as today. | F-APP-001 |
| Any other hangulroute.com page | No price, no plan list, no "Buy", no checkout or portal URL, no link to the billing page. It may link to the app's sign-in (F-SITE-002 decides the CTA). B-10 adds a guard test. | F-SITE-002 |

- **Path constants.** This spec never writes the path: the web page, the Worker and the mobile app read `APP_ROUTES.billing` from `packages/content-schema/src/schemas/app-shell.ts` (F-APP-001 A-1). `billing.ts` adds only `BILLING_RECEIPTS_PATH = \`${APP_ROUTES.billing}/receipts\``.
- **Who renders it.** F-APP-001 A-5c creates `app/(console)/account/billing/page.tsx` as a re-export of today's billing page. B-8a replaces that re-export with the new page, under the same file. The view models stay pure (`apps/web/src/lib/console/billing.ts` and the new `billing-summary.ts`), so a later renderer can reuse them.
- **Layout and indexing.** The page sits under F-APP-001's shared grown-up layout (`LocaleProvider`, `ConsoleAuthProvider`, `GrownUpLock`, its section 3.7). B-8a's page test asserts that the page renders inside those providers and that its metadata carries `robots: { index: false, follow: false }`; if F-APP-001's layout does not set `noindex` for `/account/*`, B-8a adds `app/(console)/account/layout.tsx` carrying only that metadata.
- **Service worker.** F-APP-001 A-2 adds one `navigateFallbackDenylist` entry per grown-up prefix (`/account` and `/teach` among them) and a `NetworkOnly` rule with the precached grown-up offline page. This spec adds nothing to `pwa-postbuild.mjs`.
- **Installed learner PWAs with an older worker.** A device whose controlling worker predates A-2 answers `/account/billing` with the learner shell until the new worker takes over (`skipWaiting: false`, `pwa-postbuild.mjs:106`). A Stripe return there opens the learner app instead of the billing page; the payment is still applied by the webhook, and the next visit to Billing shows it. Mitigation, binding: Stripe return URLs move to the app host (F-APP-001 S-4, `CONSOLE_URL=https://app.hangulroute.com`) only after A-2 has been in production for **at least 14 days** (section 7, step 3; F-APP-001 amendment A1). A boot-time update check cannot help here, because the stale worker serves the old bundle, which has no such check (review log R2-M1).

### 4.2 Personas and what each sees

Roles come from `SpaceRoleSchema` (`packages/content-schema/src/schemas/space.ts:36`: `owner | caregiver | teacher | admin | student`). The **payer** of a space is any account that passes `can(actor, 'space.manage', space)`, the same check checkout and portal already use (`entitlements.ts:52`): the space's `owner`, and on a school also the `admin` role (`lib/can.ts:41`, `:59`). Everyone else with a membership is a **viewer**.

| Persona | Where | Sees | Can do |
|---|---|---|---|
| Parent (owner of a family space) | Billing | Family card: plan (Free plan or Family Plan), status line, learners covered `n of 5` (`FAMILY_LIFETIME_LEARNERS`), latest 3 receipts | Free: **Get Family Plan** on the card (section 4.3), promo code. Family Plan: **Manage subscription** (portal), receipts, refund help line [BY]. 0 learners: **Connect a learner**. |
| Co-parent (caregiver in a family) | Billing | Family card read-only: plan and status, learners covered | Nothing; "The person who set up this family manages this plan." |
| Teacher, stand-alone class (owner) | Billing | Class card: Free plan (`n of 20` students, `FREE_CLASS_STUDENT_CAP`) or Group License (status, renews on / ends on, `n` students, no cap) | Free: **Get Group License**. License: **Manage subscription** (portal), receipts. |
| Co-teacher (role `teacher` on a class) | Billing | Class card read-only: plan and status, students `n` | Nothing; "The class owner manages this plan." |
| Teacher, class inside a school (owner of the class, school pays) | Billing | Class card: "Covered by *School*'s license until *date*", students `n` | Nothing; "Your school manages this plan." (the server already refuses a license for a class inside a school, `entitlements.ts:66-68`). |
| Teacher member of a school (role `teacher` on the school) | Billing | School card read-only: "Covered by *School*'s license until *date*", no seat counts | Nothing; "Your school manages this plan." |
| School owner or school admin | Billing | School card: license or contract, status, students `n of 300`, teachers `n of 10` (`SCHOOL_LICENSE_*`; contract seats when `school_seat`) | Free: **Get Group License**. License: **Manage subscription**, receipts. Always: **Contact us** for a contract. |
| Learner, family device | learner app, Profile > **Plan details** (no PIN) | Plan screen: free / full route / covered by *space* (wireframe `billing/plan-status`) | Web: **Open billing** (through the PIN gate, then the same tab). Native: nothing. |
| Learner, self-only device (adult learning alone) | same; the gate opens directly when no PIN is set (`logic/profiles/gate-route.ts`) | same, worded for "you" (audience `self`) | same. To buy: the adult self-learner story of section 2. |
| Grown-up with no space yet | Billing | Empty state: "Plans belong to a family or a class." | **Set up for me or my family** (`/start?persona=parent`) / **Set up a class** (`/start?persona=teacher`), F-APP-001's `/start`. |

Rules that hold across the table:

- **Prices, receipts and actions are for the payer only.** A viewer card never shows an amount, a promo field, a receipt or a button. The server enforces it (section 5.3); the page only renders what it gets.
- **One card per space**, never a merged "your plan" across spaces, because each space is paid separately. Order: spaces the viewer pays for first, then the rest; within each group family, class, school; then newest first (the order `GET /api/spaces` uses, `spaces.ts:141`).
- **Archived spaces** are left out, except that a space archived with a live Group License still shows to its payers, marked "(archived)", until the license ends, so the owner can cancel it (it would otherwise renew unseen).
- **Account-subject rows** (legacy `subjectKind: 'account'`, none are issued today) show as one extra card titled "Your account".
- **Status never relies on colour alone.** Every state has words (`console.entitlementStatus.*`, `console.ts:271`).

### 4.3 The billing home (`/account/billing`, wireframe `billing/billing-home`)

Layered, short, one decision per block (owner item 13). From top to bottom:

1. **F-APP-001's adult frame** (`AdultFrame`, its section 3.8): product name, persona switch or persona name, the nav (Home or Classes, Billing, and the items siblings register), language, **Back to learning**, Sign out. This spec draws no header of its own.
2. **Mode banner**, one line, neutral tone: `mode === 'test'` → "Test mode: no real card is charged."; `mode === 'none'` (no Stripe key bound) → "Payments aren't set up yet. Nothing was charged." and every buy and manage button disabled; `mode === 'live'` with `purchasesOpen === false` → "Payments are not open yet. Nothing was charged." and buttons disabled.
3. **Return notice** for `?checkout=` (section 4.5).
4. **Past-due note** when any payer card is past due (section 4.6).
5. **Your plans**: one card per space (section 4.2). A card has: kind label and space name (heading), a plan line, a status line, a usage line, then its actions. Payer cards add a collapsed **Receipts** disclosure with the latest 3 rows (date, kind, amount; no link) and **All receipts** whenever the space has any row (receipt links live on the receipts page, behind step-up, section 4.10).
   - **One buyable space** (the common case: one parent, one free family): the plan offer sits **inside that card**, under its usage line: what it includes, the sandbox price line, then **Have a code?** (collapsed, directly under the price it rewrites), then the primary button. There is no separate Add a plan block.
   - **Connect a learner**: a family card whose plan is active and whose `usage.learners === 0` shows "Next: connect a learner to this family." and **Connect a learner**, which goes to F-APP-001's family page (`/parent/space?id=<spaceId>`, which shows the join code panel). The code itself is not in the billing summary.
6. **Add a plan**: only when **more than one** payer card can buy. One row per buyable space: plan name and the space it is for, includes lines, price line (`PLAN_PRICING` through `formatUsd`), and a button. Exactly one row carries the primary button (the first recommendation, as `planRowsFor` does today, `billing.ts:139-145`); the rest are secondary. **Have a code?** sits once, under the first row's price line, and rewrites every row's price line (F-ENT-002 §3.3, unchanged behaviour). A school payer also gets the **Contact us** row.
7. **Help**: "Questions or a refund? Write to hello@hangulroute.com." (the address the site already uses), "Learners never see prices or receipts." and "On a shared device? Sign out when you are done."

**What the plan includes** (the includes lines of a buy row). Base lines always: Family Plan: "Every lesson of every Stage, new ones included" [BY], "Up to {n} learners in one family", "Cloud save on every device". Group License: "Every lesson for every student while they are enrolled", "No {cap}-student cap", and for a school "A school holds up to {teachers} teachers and {students} students". Feature lines appear only when the feature is live, read from F-SITE-002's `SITE_CLAIMS` (`apps/web/src/data/site-claims.ts`, the same flags the site uses): `browseAsLearner` → "Browse every lesson as your learner sees it" (family) / "as your students see it" (license); `parentReports` / `teacherReports` → "Reports on what went well and what to practice next" / "Student and class reports"; `feedbackNotes` → "Send notes to your learners" / "to your students". A line for an unbuilt feature never renders (test, section 11).

Copy rules for this page: no "best value", "save", "only today", countdowns, strike-through anchor prices other than the promo line F-ENT-002 already defines, no urgency colour, no comparison with other learners or schools. Prices appear only in buy rows and in the payer's receipts. The page never says "Premium"; it names the plan or says "the full route" (F-ENT-003's boundary phrase).

### 4.4 Buying (`POST /api/entitlements/stripe/checkout`, extended)

- **Who.** Unchanged: a payer of the space (the `space.manage` check, section 4.2); `family_lifetime` for a family, `group_license` for a stand-alone class or a school (F-ENT-001 §3.3).
- **Step-up first** (OD-7, default on). Reason: the billing page now shares an origin with the learner app on a family device, and a signed-in grown-up session can outlive the grown-up at the keyboard.
  - The Worker reads the session token's `fva` claim (factor verification age in minutes, `[firstFactor, secondFactor]`). B-5 makes `lib/auth.ts` return the verified claims next to `sub` (`{ sub, fva }`), unchanged for every existing caller.
  - When `fva[0] > STEP_UP_MAX_AGE_MIN` (10), **or when `fva` is absent** (fail closed), the Worker answers `403` with Clerk's reverification hint body, so `useReverification` in `@clerk/clerk-react` 5.x recognises it, plus our own code: `{ clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } }, error: { code: 'reverify_required' } }`. B-5 builds it with `reverificationError` from `@clerk/shared` when that export is available in the pinned version, else writes the same JSON by hand; a test compares the body with the shape the hook parses.
  - The page wraps checkout, portal and receipt-link calls in `useReverification`, whose fetcher returns the parsed body. On a hint, the page shows `billing/step-up` ("Confirm it's you", with the reason line "This keeps payments safe on a shared device."); **Continue** runs Clerk's reverification; on success the same request is retried once. If the retry is refused again (for example a token format without `fva`), the dialog shows "Can't confirm right now. Try again in a moment." and never loops.
  - A fresh sign-in in this tab within 10 minutes has `fva[0] ≤ 10`, so it skips step-up (test).
  - Dev fallback (no Clerk key bound, `lib/auth.ts:27`): step-up is skipped, because there is no token to read; it is never active in production (F-AUTH-002).
  - Prerequisite (runbook Step 8, M2 of F-APP-001): the owner confirms once that a production session token carries `fva` (Clerk session token v2). If it does not, money actions stay refused with "Can't confirm right now." and the owner switches the instance's session token version; no code change.
- **Already active.** When the subject already holds an **active** row of the same plan (`isEntitlementActive`), the Worker answers `409 already_active` and creates no session. [BY] The server answer landed in BY-1 (#371, AMENDMENTS-BILLING-FAMILY-YEARLY BY-D4), limited to Stripe subscription rows (`sub_…`) so a legacy one-time sandbox row can move to the yearly plan; B-5 adds its telemetry and B-8 the page note. The page shows "This plan is already active. Nothing was charged." and reloads the summary. This stops a second purchase **after the first has landed**. Two checkouts opened in two tabs before either is paid can both complete; the webhook then records the second `purchase` normally and sends `billing.checkout_completed { duplicate: true }`, and runbook Step 8 tells the owner to refund the duplicate (both payments show in Receipts).
- **Live guard** (section 4.9): `503 live_not_enabled` before any Stripe call.
- **Return URLs** come from F-APP-001 A-9's `billingReturnUrl(env, suffix)` (base `CONSOLE_URL ?? 'https://app.hangulroute.com'`, path `APP_ROUTES.billing`). This spec changes only the success suffix: `?checkout=success&plan=<planKey>&id=<spaceId>`; cancel stays `?checkout=cancel`. Until A-9 merges, B-5 appends the same suffix to today's builder (`entitlements.ts:82`); whichever of B-5 and A-9 lands second rebases one line. The space id is opaque; no name enters the URL.
- **Metadata.** Unchanged `metadata[subjectKind|subjectId|planKey]` and `subscription_data[metadata]`, which both plans now carry because both are subscriptions [BY]. `payment_intent_data[metadata]` is dropped: no payment-mode session is created any more (section 5.4 finds refunds through the invoice).
- **The checkout page itself** is Stripe-hosted. Both plans are `mode=subscription` [BY]; Stripe creates the customer and an invoice for the first year and every renewal, so every payment has an invoice (OD-11 withdrawn).

### 4.5 Coming back from Stripe (wireframe `billing/checkout-return`)

The page reads `checkout`, `plan` and `id` once, then removes them with `history.replaceState` so a refresh or a copied URL does not repeat the notice. Polls send `GET /api/billing/summary?poll=1` (the Worker skips its view event for polls, section 10).

| Query | State | What the grown-up sees |
|---|---|---|
| `checkout=success&plan=P&id=S` | **checking** | "Almost there: checking your plan." The page polls every `CHECKOUT_POLL_MS` (2 s), at most `CHECKOUT_POLL_MAX` (10) times, until the card for `S` shows plan `P` as active. A polite live region announces each state change once. Buttons on that card are disabled while checking. |
| same, and the card turns active | **done** | "Thank you. The plan is active. Learners get it the next time they open Hangul Route." Focus moves to that space's card heading. If that card is a family with no learner yet, the card's **Connect a learner** step is shown (section 4.3). |
| same, 10 polls and still not active | **still processing** | "Your payment went through. The plan shows here in a minute." and **Check again** (one more round of 10). No error tone: the webhook is late, not failed. |
| same, the browser goes offline while checking | **offline** | "You're offline. Plans and receipts need a connection." Polling pauses on the `offline` event and resumes on `online` without using up attempts. **Try again** resumes by hand. |
| same, a poll fails while online | **error** | "Can't check your plan right now." and **Try again**. The payment line is not repeated (we do not know). |
| `checkout=cancel` | **cancelled** | "Nothing was charged." (`console.billingCancelled`, unchanged). |
| `checkout=success` without `plan`/`id` (a return from an older session) | **done-unknown** | Reloads the summary once and shows the done line. |

### 4.6 Managing and ending

- **Group License and Family Plan [BY]**: **Manage subscription** opens the Stripe Billing Portal (cancel, change card, invoices there too). Portal `return_url` from `billingReturnUrl(env, '')`. Step-up applies (section 4.4).
- **Cancel at period end.** BY-1 (moved from B-3 [BY]) maps a subscription event with `cancel_at_period_end === true`, or a non-null `cancel_at`, to status `cancelled` with `expiresAt` = the period end. Coverage continues while `expiresAt` is in the future (`cancelled` is active until then, F-ENT-001 §3.2); the card says "Ends on *date*" and shows no "renews" line. Reactivating in the portal (flag back to false, status `active`) returns the row to `active` and the card to "Renews on *date*".
- **Period end location.** BY-1's mapper [BY] reads `current_period_end` from the subscription's top level (older API versions) or, when that is absent, the latest `items.data[].current_period_end` (2025-03-31.basil and later); both shapes are tested.
- **Past due**: the card status reads `console.entitlementStatus.pastDueKept` ("payment needs attention · full route kept for a week") while the 7-day grace runs (`PAST_DUE_GRACE_MS`), and a one-line note above the cards: "A payment didn't go through. Update your card in Manage subscription; learners keep the full route for a week." Neutral tone, not the danger colour.
- **Family Plan [BY]**: renews yearly like the license; the card reads "Renews on *date*" (or "Ends on *date*" after a cancel) and has **Manage subscription**. A legacy one-time sandbox row (`expiresAt` null, BY-D2) reads "Family Plan" with no date and no Manage button. The help line carries the refund contact.
- **Refunds** are done by the owner in the Stripe dashboard. The webhook records them (section 5.4). **Rule (OD-6, revised [BY-D8])**: a refund never changes coverage by itself, for either plan; Stripe's subscription events decide the status. To end a refunded plan at once, the owner cancels the subscription immediately in the Stripe dashboard (`customer.subscription.deleted` → `expired`). Learners keep every star, card and progress item (CLAUDE.md §1: earned items are never taken away); only full-route coverage ends, so lessons past the free set follow F-ENT-003's rules again.
- **A space archived** with an active plan (`POST /api/spaces/:id/archive`, `spaces.ts:227`; no route deletes a space today): B-12 makes the space settings archive confirm name the plan it affects ("Learners in *space* lose the Family Plan while it is archived. It keeps renewing until you cancel it in Billing." / "The Group License keeps renewing until you cancel it in Billing.") [BY]. Unarchiving restores coverage, because `tierFromSpaces` skips archived spaces only while they are archived (`lib/entitlement.ts:97-104`). A Family Plan belongs to its family space and does not move to another space. Like a license, a family archived with a live Family Plan still shows to its payers, marked "(archived)", until the plan ends [BY].

### 4.7 The learner Plan screen (mobile, wireframe `billing/plan-status`)

Replaces the current price-bearing paywall body. The navigation route key stays `Paywall`, so the entries F-ENT-003 and F-ROUTE-001 add keep working; the screen's title becomes "Plan".

- **Status only, no PIN.** The screen holds no price and, on native, no link, so it is not gated. Profile shows **Plan details** for **every tier** (was "Unlock the journey", only for free, `ProfileScreen.tsx:243`) and navigates straight to it. Entries that already pass the gate (F-ENT-003's **Ask a grown-up**) keep doing so; arriving through the gate is harmless and leaves the grown-up session open for **Open billing**.
- **States** from `paywallState(tier, source)` (`logic/paywall.ts:16-19`, unchanged), worded per audience (`store/audience.ts`):

| State | Family audience | Self audience |
|---|---|---|
| **covered** (class or school) | "*Name* is covered by *space*." · "Everything is open while they are in it." | "You're covered by *space*." · "Everything is open while you are in it." |
| **premium**, source family | "*Name* has the full route." · "From your family's Family Plan." | "You have the full route." · "From your Family Plan." | [BY]
| **premium**, no source (legacy subscription, F-SUB-001) | "*Name* has the full route." · "Everything is open." | "You have the full route." · "Everything is open." |
| **free** | "*Name* is on the free plan." | "You're on the free plan." |

- **Slots for F-ENT-003.** Under the free title the screen renders `<FreePlanLines />`: until E3-8 fills it, and whenever F-ENT-003's effective switch is off, it renders this spec's line `caregiver.plan.free.open`, "Stage 1 is always free." (today's wording, moved from `caregiver.paywall.free.bubble`); with the switch on, E3-8 renders F-ENT-003 §3.9.1's free-plan lines there (the free-lessons line with counts from data, the optional stories and topics list, at most one situation line; keys `caregiver.plan.freePlan`). Under the full-route lines the screen renders `<PlanGuidanceLine />`, empty until E3-8 adds F-ENT-003's "Set a plan to guide what comes next." line. Neither slot ever holds an offer, a price, a button, a link, a promo hint or a terms line.
- **Web only** (`Platform.OS === 'web'`): under the state, one caption ("Plans and receipts are on the billing page for grown-ups." for the family audience; "Your plan and receipts are on the billing page." for self) and a secondary button **Open billing**. Pressing it goes through the grown-up gate (`openGrownUps('Billing')`; it opens directly while a grown-up session is open or on a self-only device without a PIN, F-LEARN-001 L7). After the gate:
  - B-9 (before the shell hand-off): `openExternalUrl(consoleBillingUrl())` (`platform/billing-handoff.ts`), today's target, in a new tab opened inside the tap with its opener cleared; the base must be `https:` (anything else comes back as `failed` and shows the address). On the web, back from a correct PIN the screen shows `caregiver.plan.gateDone` and moves focus to **Open billing** instead of opening a tab outside a tap (a browser may block it); with the grown-up session now open, the next tap opens it. Native opens on return. Offline, `caregiver.plan.needsConnection` comes before the address line.
  - B-9b (F-APP-001 A-6 merged, `flags.grownUpHomeEnabled` on): `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })` in the **same tab**. It writes F-APP-001's per-tab unlock, so the billing page opens without the "Grown-ups only" lock, and the unlock survives the Stripe round trip; **Back to learning** in the frame returns to the app. This replaces the "paywall same-origin billing" item of F-APP-001 A-7 (amendment A2). No new tab opens, so back from the gate's PIN billing opens by itself (no `gateDone` tap); a PIN older than F-APP-001's 2 minutes (a gate the 15-minute session opened) opens the grown-up area's PIN screen (`GrownUpArea`) first, which hands off after a correct PIN. A device that had no PIN creates one on the gate, and creating a PIN is not a PIN entry (F-APP-001 section 3.9: only a correct PIN on the PIN screen sets `lastPinVerifiedAt`), so the `GrownUpArea` PIN screen then asks for it once. A second press while the hand-off is under way does nothing. Offline (`navigator.onLine` false) with the flag on, Open billing keeps its label, is disabled and is described by "Needs the internet", and it re-enables on the `online` event: F-APP-001 A-7's entry state (sections 3.6 and 3.12, design D18), shipped in PR #454 as `planOpenBlocked`; B-9b uses the same rule, and a return from the gate while offline starts no hand-off either. With the flag off, B-9's `needsConnection` and address line stay the offline answer. `openGrownUpArea` sends `shell.grown_up_handoff { via: 'plan', target: 'billing' }`; `paywall.console_opened` is sent only with the flag off. Code: `platform/billing-handoff.ts` (`billingOpensSameTab`, `BILLING_HANDOFF`, `openBilling`) and `logic/paywall.ts` (`billingHandOffStep`).
  - If opening fails, one line shows the address to type (`caregiver.plan.openFailed`).
- **Native builds** (`ios`, `android`): no button, no URL, no price, and no sentence that mentions the web, a website or buying elsewhere (section 4.8).
- **Removed from the learner side**: the Family Plan offer card and its price, the bullets list, the promo hint, the "buy it once on the web console" and "buying inside this app arrives with the store update" lines, the terms line. Their dictionary keys are deleted in the same PR (section 6.4). Nothing that F-ENT-003 adds is deleted.
- **The Profile plan card**: title "Full route" (was "Premium") or "Free plan"; note "Everything is open." / "Everything is open, from {source}." (was "The full journey is unlocked…") or the free note; pill unchanged ("Active" / "Free"); button **Plan details** for every tier, not gated. No learner string on the card or the screen contains "Premium", "unlock", "buy", "price" or "pay" (test against F-ENT-003's banned fixture).

### 4.8 Native builds and store rules

Reading of the store rules this spec designs to (verify against the current text before any store submission; OD-4, OD-5):

- **Apple App Review Guideline 3.1.1**: digital content and features unlocked inside the app use in-app purchase; the app and its metadata must not include buttons, external links or other calls to action that direct customers to purchasing mechanisms other than in-app purchase. Apple changed this for the **United States storefront** in May 2025 (external purchase links and buttons allowed there). This spec does **not** use that exception (OD-4).
- **Guideline 3.1.3(b) Multiplatform Services**: content bought elsewhere may be unlocked in the app if it is also offered as an in-app purchase. A Family Plan bought on the web therefore needs an in-app equivalent, an auto-renewable yearly subscription (F-IAP-002, [BY]) before a store-distributed build unlocks it (OD-5).
- **Guideline 3.1.3(c) Enterprise Services**: an app sold directly to organisations for their students may let those users access what the organisation bought. Group License and school contracts fit here, so class and school coverage stays honoured in native builds.
- **Google Play Payments policy**: in-app digital purchases use Google Play Billing; linking to another payment method needs an enrolled programme in an eligible region. Not enrolled (OD-4).
- **Audience**: the app ships in Education, not the Kids Category (CLAUDE.md §1). Any external link inside a grown-up area stays behind the gate regardless.

What this means in code (B-9), enforced by tests:

1. On `ios` and `android`, the Plan screen renders no button that opens a URL, no price, no promo text, and no string from the deny list `['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console']` (a unit test renders every state of section 4.7, both audiences, with `Platform.OS` mocked and scans the text tree).
2. The Profile card on native never shows "Unlock" or "Buy" wording; it shows **Plan details**.
3. Native builds keep reading the inbox tier for every source (family, class, school), as today (`store/tier-store.ts`). The constraint in OD-5 is a release rule, not a code switch.
4. Nothing in the native app takes a promo code (F-ENT-002 §3.4, unchanged).

### 4.9 Test mode, live mode, prices

- **Mode** comes from the Stripe secret key prefix: `sk_test_` / `rk_test_` → `test`; `sk_live_` / `rk_live_` → `live`; no key → `none` (`stripeMode(env)` in `lib/stripe.ts`).
- **Live guard**: in `live` mode, `POST /stripe/checkout`, `/stripe/portal`, `/stripe/promo` and `POST /api/billing/receipt-link` answer `503 live_not_enabled` unless the Worker variable `BILLING_LIVE_ALLOWED` is exactly `true`. The webhook keeps processing in every mode (so nothing paid is ever lost). `GET /health` (`healthReport`, `lib/runtime.ts:82`, booleans only per SEC-2) adds `bindings.stripeLive` (true when the bound key is a live key) and `bindings.billingLiveAllowed`.
- **Prices**: the signed-in billing page keeps showing `PLAN_PRICING` amounts in test mode under the test banner (OD-2), as `/teach/billing` does today. Nothing else shows a price: not the learner app, not hangulroute.com, not telemetry, not a notification. The owner lifts this only together with `BILLING_LIVE_ALLOWED`.
- **Receipts** recorded from a test-mode event carry `livemode: false` and show a "test" pill.

### 4.10 Receipts and history

- **Source**: Stripe webhooks recorded in a new table `billing_events` (section 5.1) from the day B-3 deploys and the owner subscribes the new events (runbook Step 8). Earlier sandbox payments have no rows; the receipts page says "Older payments are in the receipt email from Stripe." when the space has an active Stripe plan but no rows.
- **Who**: payers of the space only (section 4.2). Caregivers and teachers never receive receipt rows.
- **Row**: date (the event's `occurred_at`, shown as the UTC calendar day like the status line, `billing.ts:72`), kind (Payment, Renewal, Refund, Payment didn't go through), plan name ("Family Plan" or "Group License"; a legacy one-time sandbox row shows the plan name only, with no "one payment" label: `receipts.oneTime` is deleted by BY-D9), amount (`formatUsd` for `usd`; other currencies through `Intl.NumberFormat` with the stored ISO code), a "test" pill when `livemode` is false.
- **Where links live.** Inline rows on a card (latest 3) carry no link. The receipts page shows **View receipt** on each row that has one (`hasReceipt`).
- **Opening a receipt** (`POST /api/billing/receipt-link { id }`, `id` = the opaque `bev:` id): payer check, **step-up** (section 4.4: the Stripe page shows the payer's name, email and address, and the billing page shares an origin with the learner app), live guard, then a fresh Stripe lookup: a subscription row (Family Plan or license) → `GET /v1/invoices/<id>` → `hosted_invoice_url`; a legacy one-time payment → `GET /v1/payment_intents/<id>?expand[]=latest_charge` → `latest_charge.receipt_url` [BY]; a refund → `GET /v1/charges/<charge>` → `receipt_url` (Stripe shows the refund on it). The Worker returns `{ url }`; nothing is stored, so a link is never stale and never sits in our database. On a Stripe error: `502 receipt_unavailable` and the row shows "Can't open this receipt right now." The page opens a blank tab synchronously on the click (so it is not blocked as a pop-up), sets `opener = null`, then sets its location to the returned URL; the button's accessible name says it opens Stripe in a new tab. When the call answers with the step-up hint, the page closes that blank tab before "Confirm it's you" opens; after step-up it opens the receipt in a new tab (opener cleared), and if the browser blocks that tab the row says "Confirmed. Tap View receipt again to open it." (`receipts.tapAgain`).
- **Count**: the receipts page shows up to `RECEIPTS_PAGE_LIMIT` (50) newest rows. Past 50: "Older receipts: see Stripe's emails or write to us."
- **A failed payment** row is plain text, never red, with the same note as the past-due card.

### 4.11 Family Plan model (restated, binding) [BY]

- Product `family_lifetime` (the key keeps its historical name, `AMENDMENTS-BILLING-FAMILY-YEARLY.md` BY-D1): the **Family Plan**, `PLAN_PRICING.family_lifetime` = $15.30, `per: 'year'`, Stripe Checkout `mode=subscription` on the recurring yearly price `STRIPE_PRICE_FAMILY_YEARLY`, `subscription_data[metadata]` carrying the subject.
- `expiresAt` = the subscription's current period end; it moves forward one year at every renewal (`customer.subscription.updated`).
- It covers one family space and every learner in it, up to `FAMILY_LIFETIME_LEARNERS` (5), every Stage (new ones included) while it is active.
- Cancel any time in the portal: the row becomes `cancelled` with `expiresAt` = the period end and keeps covering until then; it ends with `customer.subscription.deleted` (`expired`). A failed renewal is `past_due` with the 7-day grace. Archiving the family space pauses its coverage until it is unarchived; the plan keeps renewing until cancelled (B-12 says so first).
- When it ends, learners keep everything they earned; only lessons past the free set follow F-ENT-003 again.
- Copy calls it "Family Plan", says "renews yearly" and "cancel any time", and never says "lifetime", "once", "one payment" or "for good" about it. Legacy one-time sandbox rows (BY-D2) stay readable and show no renewal date.

### 4.12 Offline and errors

| Where | Situation | What shows |
|---|---|---|
| Any billing URL | navigation while offline, on a device with F-APP-001 A-2's worker | F-APP-001's grown-up offline page ("You're offline", Back to learning, Try again) |
| Billing home | summary request fails because the browser is offline (`navigator.onLine === false` or a network error) | panel "You're offline. Plans and receipts need a connection." and **Try again**; no cards and no buy rows (nothing to act on without data); reloads by itself on `online` |
| Billing home | summary fails while online | "Can't check your plan right now." and **Try again** (`console.billing.cantCheck`, exists) |
| Billing home | buy or manage pressed while offline | the button is disabled while offline, with the offline line above the cards |
| Checkout return | offline while checking | section 4.5 (polling paused, attempts kept) |
| Step-up | Clerk cannot be reached | "Can't confirm right now. Try again in a moment." and **Not now** |
| Receipts page | offline / error | the offline panel / "Can't load receipts right now." and **Try again** |
| Receipt link | Stripe or network error | "Can't open this receipt right now." on that row |
| Learner Plan screen | offline | the state from the tier store (7-day grace, F-ENT-001 §3.4); nothing claims a purchase failed; **Open billing** on web leads to F-APP-001's offline page |

## 5. Data and API (all additive)

### 5.1 D1: migration `0007_billing_events.sql` (next free number at the basis commit)

```sql
-- F-BILL-002 §5.1: payment history recorded from Stripe webhooks. Additive only.
CREATE TABLE IF NOT EXISTS billing_events (
  id            TEXT PRIMARY KEY,   -- bev:xxxx
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('account', 'space')),
  subject_id    TEXT NOT NULL,
  plan_key      TEXT NOT NULL CHECK (plan_key IN ('family_lifetime', 'group_license', 'school_seat')),  -- family_lifetime = the yearly Family Plan (historical name, BY-D1)
  kind          TEXT NOT NULL CHECK (kind IN ('purchase', 'renewal', 'refund', 'failed')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency      TEXT NOT NULL,      -- ISO 4217, lower-case as Stripe sends it
  provider      TEXT NOT NULL CHECK (provider IN ('apple', 'google', 'stripe', 'manual')),
  provider_ref  TEXT NOT NULL,      -- payment intent / checkout session / invoice id; refunds: <charge>:refund:<cumulative cents>
  payment_ref   TEXT,               -- the payment intent behind an invoice (refund matching); NULL when unknown
  livemode      INTEGER NOT NULL DEFAULT 0,
  occurred_at   TEXT NOT NULL,      -- ISO, from the Stripe object
  created_at    TEXT NOT NULL,
  UNIQUE (provider, provider_ref, kind)
);
CREATE INDEX IF NOT EXISTS idx_billing_events_subject ON billing_events(subject_kind, subject_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_payment ON billing_events(payment_ref);
-- The webhook looks entitlements up by Stripe subscription id (entitlementByProviderRef).
CREATE INDEX IF NOT EXISTS idx_entitlements_provider_ref ON entitlements(provider, provider_ref);
```

- The file takes the next free four-digit prefix at merge time; `scripts/check-migrations.mjs` fails CI on a shared prefix, so a parallel spec that lands a migration first (F-FEEDBACK-001 FB-2 adds one) means a rename on rebase, nothing more.
- No card data, no email, no name, no address, **no receipt URL**. Amounts, dates and Stripe ids only.
- Webhook retries are idempotent through the unique key (`INSERT … ON CONFLICT DO NOTHING`, then a `payment_ref` update when the stored row has none and the new event has one).
- Rows live as long as their space. No route deletes a space today (spaces are archived, `spaces.ts:227`); a later spec that adds space or account deletion must delete the space's `billing_events` rows with it. Stripe keeps the payment record and the buyer keeps Stripe's email.
- The migration is applied by the API Worker's deploy command before the Worker code (server-first, `apps/api/wrangler.toml`). Nothing reads the table until B-4 deploys.

### 5.2 Schemas (`packages/content-schema/src/schemas/billing.ts`, new; exported from `index.ts`, appended)

- `BILLING_RECEIPTS_PATH` (from `APP_ROUTES.billing`, section 4.1), `STEP_UP_MAX_AGE_MIN = 10`, `RECEIPTS_PAGE_LIMIT = 50`, `RECEIPTS_CARD_LIMIT = 3`, `CHECKOUT_POLL_MS = 2000`, `CHECKOUT_POLL_MAX = 10`.
- `BillingEventKindSchema = z.enum(['purchase', 'renewal', 'refund', 'failed'])`.
- `BillingEventSchema`: `{ id: /^bev:[a-z0-9-]+$/, subjectKind, subjectId, planKey, kind, amountCents: int ≥ 0, currency: /^[a-z]{3}$/, provider, providerRef, paymentRef: non-empty string | null, livemode: boolean, occurredAt, createdAt }`. `amountCents` is Stripe's minor unit: cents for `usd`, whole units for zero-decimal currencies (`krw`, `jpy`), so a formatter uses the currency's own fraction digits, never a fixed `/ 100`.
- `ReceiptViewSchema`: `{ id, kind, planKey, amountCents, currency, livemode, occurredAt, hasReceipt: boolean }` (no Stripe id, no URL; `id` is the opaque `bev:` id used by the receipt-link call).
- `StripeModeSchema = z.enum(['test', 'live', 'none'])`.
- `CoverageSchema` (discriminated on `state`):
  - `{ state: 'free' }`
  - `{ state: 'own', planKey, status, expiresAt: string | null, statusSince: string, endsAtPeriodEnd: boolean }` (the space holds the plan)
  - `{ state: 'school', schoolName: string, planKey: 'group_license' | 'school_seat', expiresAt: string | null }` (a class covered by its school, or a school seen by a teacher member)
- `UsageSchema`: `{ learners: int ≥ 0, learnerCap: int | null, teachers: int | null, teacherCap: int | null }` (`null` cap = unlimited; teachers only for school payers).
- `ReadOnlyReasonSchema = z.enum(['family', 'class', 'school'])` (which "manages this plan" line a viewer sees).
- `BillingSpaceCardSchema`: `{ spaceId, kind, name, role (any role but student), archived: boolean, payer: boolean, readOnlyReason: ReadOnlyReason | null, coverage, usage: Usage | null (null = no usage line: a school seen by a teacher member, section 4.2), actions: { buy: PurchasablePlanKey | null, manage: boolean, contact: boolean }, receipts: ReceiptView[] (payer only, at most 3, `hasReceipt` ignored inline), hasReceipts: boolean, legacyNoHistory: boolean }`.
- `BillingAccountCardSchema` (subject `account`, always the viewer's own): `{ coverage, actions: { manage: boolean }, receipts: ReceiptView[] (at most 3, inline only), legacyNoHistory: boolean }`. No All receipts link, because the receipts page takes a space id.
- `BillingSummarySchema`: `{ mode: StripeMode, purchasesOpen: boolean, cards: BillingSpaceCard[], account: BillingAccountCard[] (usually empty) }`, the strict contract the Worker answers with. There is no "paying grown-up" flag here: F-BROWSE-001 owns that rule (`accountBrowseScope`).
- Pages read the response with `parseBillingSummary(raw): BillingSummary | null`, never with the strict schema, so a newer Worker never breaks an older page: unknown keys are stripped; a card or receipt row with a value the page does not know is dropped and its siblings stay; more than 3 inline rows are cut to the newest 3; an unknown `mode` reads as `none` (buttons off). `null` only when the summary itself is unreadable.

### 5.3 Routes

| Method · path | Who | Result |
|---|---|---|
| `GET /api/billing/summary` | signed-in account | `BillingSummary`. One card per non-archived space where the account is `owner`, `caregiver`, `teacher` or `admin` (plus archived spaces the viewer pays for that still hold a live Group License). `payer` = the `space.manage` check of section 4.2. Viewer cards carry `receipts: []`, `hasReceipts: false`, actions all off, and a `readOnlyReason`. `usage` for viewers: learner count only for family and class; a school's seat counts only for payers. Never a learner name, never a promo code, never a price, never `customerRef`, never a join code. `?poll=1` only suppresses the view event. |
| `GET /api/billing/receipts?id=<spaceId>` | a payer of the space | `{ spaceName, receipts: ReceiptView[] }`, newest first, at most 50. 403 for any other role, 404 for an unknown space. Makes no Stripe call and writes nothing. |
| `POST /api/billing/receipt-link` `{ id }` | a payer of the row's space | `{ url }` fetched fresh from Stripe (section 4.10). Step-up (`403` hint), live guard (`503`), 403 / 404 as above, `404 no_receipt` for a row Stripe keeps no page for (`hasReceipt: false`), `404 other_mode` for a row of the other Stripe mode, `502 receipt_unavailable` on a Stripe error, `503 not_configured` when no key is bound. The URL is never logged and never stored. |
| `POST /api/entitlements/stripe/checkout` | a payer of the space | as F-ENT-001 §3.3, plus: step-up `403` hint (section 4.4), `409 already_active` (landed in BY-1, #371 [BY]), `503 live_not_enabled`, the success suffix with `plan` and `id` (both plans are subscriptions, [BY]). |
| `POST /api/entitlements/stripe/portal` | a payer of the space | as today, plus step-up and the live guard. |
| `POST /api/entitlements/stripe/promo` | account | as today, plus the live guard. |
| `POST /api/entitlements/stripe/webhook` | Stripe | as today, plus history recording and the cancel-at-period-end mapping (section 5.4). |
| `GET /api/entitlements` | account | unchanged (the old page keeps working until B-8a; other console pages keep using it). |
| `GET /health` | anyone | adds the booleans `bindings.stripeLive`, `bindings.billingLiveAllowed`. |

`/api/billing/*` is a new Hono router mounted in `packages/backend/src/app.ts` next to `/api/entitlements`. CORS already allows `https://app.hangulroute.com` (`packages/backend/src/lib/cors.ts` defaults), and `verifyToken` checks `authorizedParties` against the same CORS allow-list (F-APP-001 A-9), which includes `https://app.hangulroute.com`, so a Clerk token minted on the app origin is accepted with no change.

### 5.4 Webhook history (`lib/billing-events.ts`, pure mapping + Db writes; Stripe lookups through the injected `fetch`)

New events to subscribe in the Stripe dashboard (runbook Step 8, shipped with B-3): `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. Existing: `checkout.session.completed`, `customer.subscription.created|updated|deleted`.

| Event | Recorded as | Subject from | Amount |
|---|---|---|---|
| `checkout.session.completed`, `mode=payment` (legacy one-time sandbox sessions only; none are created after BY-1) | `purchase`, `provider_ref` = `payment_intent` (or the session id when a 100%-off code made it free; then no receipt) | session `metadata` (already set) | `amount_total` |
| `checkout.session.completed`, `mode=subscription` | nothing (the first `invoice.paid` records it) | | |
| `invoice.paid` | `purchase` when `billing_reason === 'subscription_create'`, else `renewal`; `provider_ref` = invoice id; `payment_ref` = see below | `parent.subscription_details.metadata` (2025 versions) or `subscription_details.metadata` (older), else the entitlement whose `providerRef` equals the subscription id (`parent.subscription_details.subscription` or `subscription`) via `entitlementByProviderRef` | `amount_paid` |
| `invoice.payment_failed` | `failed`; `provider_ref` = invoice id | as above | `amount_due` |
| `charge.refunded` | `refund`; `provider_ref` = `<charge id>:refund:<amount_refunded>` | the `purchase` / `renewal` row whose `provider_ref` equals the charge's `payment_intent` (legacy one-time) or whose `payment_ref` equals it (license); fallback below | `amount_refunded` minus the refunds already recorded for that charge |

- **`payment_ref` on current API versions.** `invoice.payment_intent` (older versions) is used when present. On 2025-03-31.basil and later it is gone and `invoice.payments` is not expanded in webhook payloads, so the mapper calls `GET /v1/invoice_payments?invoice=<invoice id>` and stores the first `payment.payment_intent`. If that call fails, the row is stored with `payment_ref` NULL and the event still answers 200.
- **Refund fallback.** When `charge.refunded` matches no row by `payment_intent`, the mapper calls `GET /v1/invoice_payments?payment[type]=payment_intent&payment[payment_intent]=<pi>`, takes the invoice id and matches the row whose `provider_ref` is that invoice. If nothing matches, the event is acknowledged `200 { applied: false }` and recorded nowhere. [B-3 review] Two cases answer `503` so Stripe delivers the refund again: the lookup could not be made (network, timeout, 401 / 403 key problem, 429, 5xx; code `stripe_unavailable`), or Stripe names the invoice (the charge's `invoice`, or the lookup) but its `purchase` / `renewal` row is not recorded yet because the refund arrived before that `invoice.paid` (code `payment_not_recorded`; only while the event is under 72 hours old, Stripe's retry window, then `200 { applied: false }`).
- **Subscription status** (`entitlementFromStripeEvent`, `stripe.ts:101-131`, changed in BY-1, moved from B-3 [BY]): `cancel_at_period_end === true` or a non-null `cancel_at` → `cancelled` with `expiresAt` = period end; period end from the top level, else the latest `items.data[].current_period_end` (section 4.6).
- **Duplicate purchase**: a completion for a subject that already holds an active row of the same plan (two checkouts opened before either was paid) is recorded as a normal `purchase` and sends `billing.checkout_completed { duplicate: true }` (section 4.4).
- The webhook endpoint's API version is whatever the Stripe dashboard pins; runbook Step 8 records it. The mapper reads both the older and the 2025 shapes, the way `promoFromStripe` already reads two coupon locations (`stripe.ts:224-245`).
- A refund changes no entitlement (OD-6 revised, BY-D8); it is recorded only.
- `livemode` is copied from the event.
- Signature checks, tolerance and responses stay exactly as F-ENT-001 §3.3.

### 5.5 Db interface (`packages/backend/src/db/types.ts`, memory and D1 implementations)

Appended methods: `recordBillingEvent(input): Promise<BillingEvent>` (insert or keep, then fill `payment_ref` when missing), `billingEventsFor(subjectKind, subjectId, limit): Promise<BillingEvent[]>`, `billingEventById(id)`, `billingEventByRef(provider, providerRef, kind?)`, `billingEventByPaymentRef(paymentRef)`, `entitlementByProviderRef(provider, providerRef): Promise<Entitlement | null>`. The test-reset list (`db/memory.ts:438`) clears the new map.

### 5.6 Worker variables (dashboard, Type Text; documented in `apps/api/wrangler.toml` comments and runbook Step 8)

| Variable | Meaning | Default when unset |
|---|---|---|
| `BILLING_LIVE_ALLOWED` | `true` lets a live Stripe key create checkout, portal, promo and receipt-link calls | unset = refused |
| `CONSOLE_URL` | base of the Stripe return and portal URLs (F-APP-001 A-9; set to `https://app.hangulroute.com` in its owner step S-4) | F-APP-001 A-9's default |

No new web or mobile build variable.

## 6. Copy and i18n

All strings in `packages/i18n` (F-I18N-001). English is written in this spec's PRs; `ko` and `es` entries follow the dictionary's native-review process (the typed overlay files gain the same keys, marked for review). No price, limit or date is typed into a message: amounts come from `formatUsd`, limits from content-schema constants, dates from `formatDate` (`billing.ts:2`). English spelling is US ("license").

### 6.1 `console.billing` (appended to `packages/i18n/src/messages/en/console.ts`)

| Key | English |
|---|---|
| `testMode` | Test mode: no real card is charged. |
| `notConfigured` | Payments aren't set up yet. Nothing was charged. |
| `liveOff` | Payments are not open yet. Nothing was charged. |
| `offline` | You're offline. Plans and receipts need a connection. |
| `retry.cta` | Try again |
| `sections.yours` / `.add` / `.help` | Your plans / Add a plan / Help |
| `kind.family` / `.class` / `.school` | Family / Class / School |
| `archived` | (archived) |
| `accountCard.title` | Your account (the heading of a legacy account-subject card, section 4.2; added in the B-7 review fix) |
| `coverage.free` | Free plan |
| `coverage.family` | Family Plan ([BY]; was `coverage.lifetime` "Family Lifetime · yours for good") |
| `coverage.license` | Group License |
| `coverage.contract` | School Contract (B-6 review: the same words and casing as `planTitle.school_seat`, tested) |
| `coverage.school(school)` | Covered by {school}'s license |
| `coverage.schoolUntil(school, date)` | Covered by {school}'s license until {date} |
| `status.renewsOn(date)` | Renews on {date} |
| `status.endsOn(date)` | Ends on {date} |
| `readOnly.family` | The person who set up this family manages this plan. |
| `readOnly.class` | The class owner manages this plan. |
| `readOnly.school` | Your school manages this plan. |
| `usage.learners(n, cap)` | {n} of {cap} learners (plural forms) |
| `usage.students(n, cap)` | {n} of {cap} students; `cap` null → {n} students |
| `usage.teachers(n, cap)` | {n} of {cap} teachers |
| `connectLearner.line` | Next: connect a learner to this family. |
| `connectLearner.cta` | Connect a learner |
| `buy.forSpace(plan, space)` | {plan} for {space} |
| `buy.family_lifetime.cta` / `buy.group_license.cta` | Get Family Plan / Get Group License [BY] |
| `includesLines.family.everyLesson` | Every lesson of every Stage, new ones included [BY] |
| `includesLines.family.learners(n)` | Up to {n} learners in one family |
| `includesLines.family.cloudSave` | Cloud save on every device |
| `includesLines.family.browse` | Browse every lesson as your learner sees it |
| `includesLines.family.reports` | Reports on what went well and what to practice next |
| `includesLines.family.notes` | Send notes to your learners |
| `includesLines.license.everyStudent` | Every lesson for every student while they are enrolled |
| `includesLines.license.noCap(cap)` | No {cap}-student cap |
| `includesLines.license.school(teachers, students)` | A school holds up to {teachers} teachers and {students} students |
| `includesLines.license.browse` | Browse every lesson as your students see it |
| `includesLines.license.reports` | Student and class reports |
| `includesLines.license.notes` | Send notes to your students |
| `promo.disclosure` | Have a code? |
| `noSpaces.title` | Plans belong to a family or a class. |
| `noSpaces.family.cta` / `noSpaces.class.cta` | Set up for me or my family / Set up a class |
| `alreadyActive` | This plan is already active. Nothing was charged. |
| `checking` | Almost there: checking your plan. |
| `done` | Thank you. The plan is active. Learners get it the next time they open Hangul Route. |
| `stillProcessing` | Your payment went through. The plan shows here in a minute. |
| `checkAgain.cta` | Check again |
| `receipts.title` | Receipts |
| `receipts.all.cta` | All receipts |
| `receipts.empty` | No receipts yet. |
| `receipts.older` | Older payments are in the receipt email from Stripe. |
| `receipts.beyondLimit` | Older receipts: see Stripe's emails or write to us. |
| `receipts.kind.purchase` / `.renewal` / `.refund` / `.failed` | Payment / Renewal / Refund / Payment didn't go through |
| ~~`receipts.oneTime`~~ | **Deleted by BY-D9** (AMENDMENTS-BILLING-FAMILY-YEARLY; not added in B-6, #402): a legacy one-time sandbox row shows the plan name only. Do not add this key back (BY-1's lifetime-wording scan rejects "one payment"). |
| `receipts.test.pill` | test |
| `receipts.view.cta` | View receipt |
| `receipts.viewA11y(date)` | View receipt from {date} (opens Stripe in a new tab) |
| `receipts.linkFailed` | Can't open this receipt right now. |
| `receipts.pageTitle(space)` | {space} · receipts |
| `receipts.notYours` | This page is for the person who pays for this space. |
| `receipts.cantLoad` | Can't load receipts right now. |
| `receipts.back.cta` | Back to Billing |
| `stepUp.title` | Confirm it's you |
| `stepUp.body` | Before a payment, a plan change or a receipt, sign in again. |
| `stepUp.reason` | This keeps payments safe on a shared device. |
| `stepUp.cta` | Continue |
| `stepUp.cancel.cta` | Not now |
| `stepUp.cancelled` | Nothing was changed. |
| `stepUp.unavailable` | Can't confirm right now. Try again in a moment. |
| `contact.mailSubject` | Hangul Route school contract |
| `help.refund(email)` | Questions or a refund? Write to {email}. |
| `help.learners` | Learners never see prices or receipts. |
| `help.sharedDevice` | On a shared device? Sign out when you are done. |
| `pastDue` | A payment didn't go through. Update your card in Manage subscription; learners keep the full route for a week. |

Existing keys reused unchanged: `console.billing.title`, `.cantCheck`, `.checkoutFailed`, `.portalFailed`, `.manage.cta` ("Manage subscription"), `.contact.cta` ("Contact us"), `.planTitle.*`, `.promo.*`, `console.billingCancelled`, `console.price.*`, `console.promoPrice`, `console.entitlementStatus.*`. B-6 changes two English values of `console.entitlementStatus`: `pastDueKept` → "payment needs attention · full route kept for a week", `pastDuePaused` → "payment needs attention · full route paused" (their `ko` / `es` entries are re-marked for review).

Deleted in B-8c with their `ko` / `es` entries: `console.billingKidsLine` (replaced by `help.learners`: no "kids" on a surface that also serves adult learners' billing), `console.billingPastDue` (replaced by `pastDue`), `console.billingSuccess` (replaced by `done`: "next sync" is jargon), `console.billingNotConfigured` (replaced by `notConfigured`), `console.billing.includes.*` (replaced by `includesLines.*`, which drop "premium" and "cloud sync"), `console.billing.choose`, `console.billing.plans`, `console.billing.current`, `console.billing.isCurrent`, `console.billing.source`, `console.billing.seats`, `console.billing.yourAccount` when no remaining caller uses them (B-8c's test lists every key it removes and checks for no reference).

### 6.2 `caregiver.plan` (new, `packages/i18n/src/messages/en/caregiver.ts`)

| Key | English |
|---|---|
| `title` | Plan |
| `learnerFallback` | Your learner |
| `covered.title.family(name, source)` / `.self(source)` | {name} is covered by {source}. / You're covered by {source}. |
| `covered.note.family` / `.self` | Everything is open while they are in it. / Everything is open while you are in it. |
| `covered.sourceFallback` | the class |
| `full.title.family(name)` / `.self` | {name} has the full route. / You have the full route. |
| `full.fromFamily.family` / `.self` | From your family's Family Plan. / From your Family Plan. [BY] |
| `full.noSource` | Everything is open. |
| `free.title.family(name)` / `.self` | {name} is on the free plan. / You're on the free plan. |
| `free.open` | Stage 1 is always free. (moved from `caregiver.paywall.free.bubble`; F-ENT-003's lines replace it while its switch is on) |
| `openBilling.cta` | Open billing |
| `openBilling.caption.family` / `.self` | Plans and receipts are on the billing page for grown-ups. / Your plan and receipts are on the billing page. |
| `openBilling.a11yHint` | Opens the billing page |
| `openFailed(url)` | Open {url} in a browser. |
| `needsConnection` | Opening billing needs a connection. (web only, offline, before `openFailed`; added in B-9) |
| `gateDone` | PIN accepted. Tap Open billing again. (web only, back from a correct PIN; added in B-9) |
| `backToJourney.cta` | Back to journey |

`a11y.planStatus(name, stateWords)`: "{name}: {state}." for the screen's summary heading.

### 6.3 Learner Profile plan card (`packages/i18n/src/messages/en/learner.ts`, `profile.plan`)

| Key | English |
|---|---|
| `fullRoute` (new) | Full route |
| `open(source)` (new) | Everything is open. / Everything is open, from {source}. |
| `details.cta` (new) | Plan details |

Kept: `free`, `freeNote`, `pillActive`, `pillFree`. Deleted (B-9): `premium` ("Premium"), `unlocked`, `unlock` ("Unlock the journey").

### 6.4 Keys removed in B-9 (with their `ko` / `es` entries)

- `caregiver.paywall`, the whole object: `learnerFallback` moves to `caregiver.plan.learnerFallback`, `free.bubble` moves to `caregiver.plan.free.open` (same English), and `backToJourney`, `covered`, `premium`, `free.unlocks`, `free.openConsole`, `free.openFailed`, `free.terms`, `bullets`, `offer` are deleted.
- The namespace for every Plan screen string, F-ENT-003's included, is `caregiver.plan.*`: F-ENT-003 E3-8 adds `caregiver.plan.freePlan` to the object B-6 creates.
- `caregiver.audience.shared.paywallBuyOnWeb`, `.paywallBuyLater`, `.promoHint`; `a11y.familyOffer` (renamed from `a11y.lifetimeOffer` by BY-1); `learner.profile.plan.premium`, `.unlocked`, `.unlock`.

### 6.5 Copy checks

Buttons ≤ 24 characters in English and ≤ 32 in `es` (F-I18N-001 §3.11 budgets through the `cta` key suffix). `caregiver.plan.*` and `learner.profile.plan.*` pass F-ENT-003's learner banned fixture (`Premium`, `price`, `buy`, `pay`, `trial`, `unlock`, …) and the shared lists. `console.billing.*` passes the caregiver banned list (`apps/web/src/lib/console/banned-text.ts`) and has no `kids` and no age range.

## 7. Rollout order (server first)

1. **B-1 … B-5 merge and deploy** (API Worker). Migration first, then code. Nothing visible changes: `/teach/billing` keeps calling `GET /api/entitlements`; the live guard changes nothing in test mode. Step-up starts applying to the old page's checkout and portal too (the old page shows its existing "Couldn't start checkout" line on a 403; acceptable for the short window, and the owner is the only buyer in sandbox). After B-3 deploys, the owner subscribes the three new events (runbook Step 8).
2. **B-9 merges** (mobile, needs only B-6). The learner Plan screen loses its price and its native link at once. **B-9b** follows once F-APP-001 A-6 is in.
3. **F-APP-001 serves grown-up pages on app.hangulroute.com** (A-2, A-3, A-4, A-5a, A-5c; M1). **S-4** (Stripe return base to the app host) waits until A-2 has been in production at least 14 days (section 4.1).
4. **B-8a … B-8c merge** (web). The new page replaces the re-export at `/account/billing`; the old `/teach/billing` path redirects there (F-APP-001 A-5c).
5. **B-10** (guard test) after F-SITE-002's page PRs and F-APP-001 A-8. **B-11** e2e on the merged state. **B-12** any time after B-8a.

Rollback: every step is a revert. Setting `CONSOLE_URL` back returns checkouts to the old path, which the sibling redirects still handle; the table stays (additive, unused).

## 8. Accessibility

- Page structure: one `h1` (page title), one `h2` per section, one `h3` per card (kind and name). Cards are `section` elements labelled by their heading.
- Status is always words; pills have text; nothing is conveyed by colour alone. Past due and failed rows use the neutral notice tone, never `colors.feedback.danger`.
- The checkout-return states use one polite live region (`aria-live="polite"`), announced once per state change; focus moves to the activated card's heading when done.
- Disclosures (Receipts, Have a code?) are native `details`/`summary` or buttons with `aria-expanded` and `aria-controls`.
- Receipts on the receipts page are a table with a caption, column headers and the date as row header; on narrow screens it reflows to a list without horizontal scroll at 320 px width.
- Links and buttons that leave for Stripe say so in their accessible name.
- Every interactive control meets the `touchTarget` token; keyboard order equals visual order; a visible focus ring from the design-system tokens.
- The step-up dialog traps focus while open, restores focus to the button that opened it, and closes on Escape ("Not now").
- Mobile Plan screen: the summary line is the screen's first accessible element (`a11y.planStatus`); the web-only button has `accessibilityRole="button"` and the hint "Opens the billing page".

## 9. Privacy and safety

- **Learners never pay and never see prices.** All buying is by a signed-in grown-up account on the billing page. The learner app shows status only (section 4.7). No promo field anywhere a learner can reach.
- **Shared-device step-up** before any money moves and before a Stripe receipt (which carries the payer's name, email and address) opens (section 4.4, 4.10), plus F-APP-001's grown-up lock (15 idle minutes on a device with learner profiles behind a PIN) and a "sign out when you are done" line.
- **Least data.** `billing_events` holds ids, amounts, dates and Stripe refs. No card numbers, names, emails, addresses or receipt URLs are stored by us; Stripe Checkout collects them. The customer email already sent to Stripe (`customer_email` in `checkoutForm`, `lib/stripe.ts`) is the Clerk account email, unchanged.
- **Receipt URLs are capability links.** They are fetched per click, go only to the payer, are never logged, never sent in telemetry, never placed in a URL of ours.
- **Viewers see coverage, not money.** Enforced on the server (section 5.3).
- **No dark patterns.** Cancelling a license is one button away (portal), as easy as buying; a cancelled license says "Ends on" at once. No urgency, no countdown, no "you will lose" wording; when coverage ends, learners keep everything they earned.
- **No ads, no third-party scripts** on the billing pages beyond Clerk (already on the console) and Stripe's hosted pages (off-site).
- **Verifiable parental consent** is untouched: billing links no learner data to an account. Coverage reaches learners only through the memberships that F-SPACE-001 and its consent flow created; **Connect a learner** only points to that existing join flow.
- **Learner identifiers** never appear in billing URLs, responses or telemetry.

## 10. Telemetry (Worker-first)

The console has no telemetry client (F-APP-001 OD-9). Billing events are therefore emitted **by the Worker** into the same store `POST /api/telemetry` writes to (`routes/telemetry.ts`), through a new `recordServerEvent(name, payload)` helper (B-3). That store is an in-memory, per-isolate buffer capped at 10k entries with no read route (SEC-3): these events are **transient diagnostics, not a metric of record**; the record of money is the D1 `billing_events` table. Each name is appended to `TELEMETRY_EVENT_NAMES` (with the exact-list test) in the same PR as the only code that sends it, so no client can send a name the Worker does not know.

| Name | Sent when | Payload (codes only) | PR |
|---|---|---|---|
| `billing.checkout_completed` | webhook `checkout.session.completed` applied | `{ planKey, mode, duplicate: boolean }` | B-3 |
| `billing.payment_failed` | webhook `invoice.payment_failed` recorded | `{ planKey, mode }` | B-3 |
| `billing.refund_recorded` | webhook `charge.refunded` recorded | `{ planKey, full: boolean, mode }` | B-3 |
| `billing.checkout_started` | a checkout session is created | `{ planKey, mode, promo: boolean }` | B-5 |
| `billing.checkout_refused` | checkout answers 403 / 409 / 503 | `{ planKey, reason: 'reverify_required' \| 'already_active' \| 'live_not_enabled' \| 'not_configured' }` | B-5 |
| `billing.portal_opened` | a portal session is created | `{ planKey, mode }` | B-5 |
| `billing.summary_viewed` | `GET /api/billing/summary` answers without `poll=1` | `{ cards: n, payerCards: n, mode }` | B-4 |
| `billing.receipts_viewed` | `GET /api/billing/receipts` answers | `{ rows: n }` | B-4 |

- No account id, space id, learner id, amount, currency, promo code or URL in any payload. `profileId` is never set for these names.
- **What the three webhook names count** (B-3 review): `billing.payment_failed` and `billing.refund_recorded` count history rows, once each (a retried delivery writes no second row and sends nothing). `billing.checkout_completed` counts **applied deliveries**, not completions: Stripe delivers at least once and the owner can press Resend, so one checkout can send it more than once. It is a diagnostic only; checkouts are counted from Stripe or from `billing_events`.
- **Client forgery guard** (B-3): `POST /api/telemetry` rejects any name starting with `billing.` with `422` (server-only names), with a test.
- **Learner app**: keeps `paywall.viewed` (payload `{ from, state }`; `state` is `covered | premium | free`) and `paywall.console_opened` (web only, sent when Open billing actually opens after the gate; native never sends it because the button does not exist). Section D of `docs/roadmap/TELEMETRY-NAMES-2.md` records the payload note; the new names go in the next free section letter of that file in B-3 (B-4 and B-5 append their rows there).

## 11. Tests

| File | Covers |
|---|---|
| `packages/content-schema/src/__tests__/billing.test.ts` | every schema: valid and invalid ids, currency pattern, coverage union (with `endsAtPeriodEnd`), read-only reasons, receipt view has no URL or Stripe id, summary lenient parse (unknown keys stripped), constants, `BILLING_RECEIPTS_PATH` built from `APP_ROUTES.billing` |
| `packages/content-schema/src/__tests__/telemetry.test.ts` | exact list includes the `billing.*` names, appended in order (B-3, B-4, B-5 each add theirs) |
| `packages/backend/src/lib/__tests__/billing-events.test.ts` | mapping table of section 5.4: payment-mode session → purchase (with and without payment intent), subscription session → nothing, `invoice.paid` create vs cycle, both metadata locations, `payment_ref` from `invoice.payment_intent` and from the `invoice_payments` lookup (injected fetch: success, failure → NULL), fallback through `entitlementByProviderRef`, `invoice.payment_failed`, `charge.refunded` partial then full (delta amounts) matched through `provider_ref`, `payment_ref` and the `invoice_payments` fallback, unmappable events, `livemode` copy, duplicate purchase flag |
| `packages/backend/src/lib/__tests__/stripe.test.ts` (extended) | `stripeMode` for each prefix; success suffix carries `plan` and `id` (the `entitlementFromStripeEvent` cancel and period-end cases landed with BY-1, #371 [BY]) |
| `packages/backend/src/__tests__/billing.test.ts` | `GET /summary` per persona: owner family free / Family Plan / Family Plan with 0 learners, caregiver read-only (`readOnlyReason: 'family'`, no receipts, no actions, no amounts), owner class free with cap usage, co-teacher (`'class'`), class in school (coverage `school`, `'school'`, no buy), school teacher member (no seat counts), school owner and school admin (both payers: seat counts, actions, receipts), archived class with live license for payers only, no spaces, account-subject legacy row, no join code anywhere; `?poll=1` sends no view event; `GET /receipts` payers only (owner and school admin allowed; 403 caregiver / teacher, 404 unknown), 50-row limit, newest first, no outbound fetch; `POST /receipt-link`: step-up hint when `fva` is old or absent, payer only, each row kind calls the right Stripe path (injected fetch), Stripe error → 502, live guard, no key → 503, the URL is not written to the db |
| `packages/backend/src/__tests__/entitlements.test.ts` (extended) | checkout `409 already_active` (landed in BY-1, #371 [BY]; B-5 adds only the `billing.checkout_refused { reason: 'already_active' }` event on it); `503 live_not_enabled` with a live key and without `BILLING_LIVE_ALLOWED`, allowed with it; portal and promo live guard; step-up: `fva[0] > 10` and absent `fva` → 403 with the Clerk hint body and `error.code = 'reverify_required'`, allowed at ≤ 10; webhook records history; a refund leaves the row unchanged and an immediate cancel expires it (learner inbox tier flips to free; progress untouched) [BY-D8]; idempotent retries (same event twice → one row) |
| `packages/backend/src/lib/__tests__/auth.test.ts` (extended) | verified claims expose `fva` next to `sub`; existing callers unchanged |
| `packages/backend/src/__tests__/telemetry.test.ts` (extended) | `billing.*` names refused from clients with 422; server events recorded with codes-only payloads |
| `packages/backend` `test:sqlite` | migration applies on top of 0001-0006; unique key and idempotent insert; `idx_entitlements_provider_ref` exists; index used by `billingEventsFor` |
| `packages/backend/src/__tests__/health.test.ts` (extended) | `stripeLive`, `billingLiveAllowed`, booleans only, no key material |
| `apps/web/src/lib/console/__tests__/billing-summary.test.ts` | card view models for every persona row of section 4.2 (words via the dictionary), order, read-only lines per reason, one buyable space → offer inside the card and no Add a plan block, two buyable spaces → Add a plan with one primary, includes lines per `SITE_CLAIMS` state (a claim that is off renders no line), connect-a-learner step, receipt rows (kinds, test pill, currency formatting, a legacy one-time row showing the plan name only with no "one payment" label, BY-D9), empty state |
| `apps/web/src/lib/console/__tests__/checkout-return.test.ts` | the return state machine: checking → done, → still processing after 10 polls, check again, offline pauses without using attempts and resumes on online, poll error, cancelled, success without plan / id, done with a 0-learner family shows the next step |
| `apps/web/src/app/__tests__/billing-page.test.tsx` | renders inside the grown-up layout with `noindex`; test banner, live-off, not configured, offline panel, error panel; step-up dialog flow against the real Clerk hint body (`useReverification` mocked at the fetcher boundary), retry refused twice → unavailable line, cancel → "Nothing was changed."; `already_active` note; no price or receipt on viewer cards |
| `apps/web/src/app/__tests__/receipts-page.test.tsx` | rows, test pill, View receipt opens a blank tab then sets its location with `opener` cleared, link failure line, not-yours and error states, 320 px list layout |
| `apps/web/src/app/__tests__/site-no-billing.test.ts` (B-10) | scans `app/(en)`, `app/(loc)` and `components/landing` for **links and amounts only**: hrefs to `APP_ROUTES.billing`, `/teach/billing` or `/billing`, Stripe checkout or portal URLs, and price patterns (reuses the landing-claims banned-price regexes); allows the legal pages' prose (Terms and Privacy may say payments go through Stripe, F-SITE-002 S-7); F-SITE-002's own `site-links` and page tests pin the same rule from the site's side |
| `apps/mobile/src/logic/__tests__/paywall.test.ts` (extended) | `paywallState` unchanged; the plan view model picks the right keys per state, source and audience |
| `apps/mobile/src/screens/paywall/__tests__/PaywallScreen.test.tsx` (B-13: rendered through react-native-web into `react-test-renderer`, in the mobile suite's `render` project, `apps/mobile/vitest.render.config.ts`; `Platform.OS` and `EXPO_OS` set per platform) | every state on `web`, `ios`, `android`, both audiences: no price text anywhere; native renders no URL-opening control and none of the deny-list words (section 4.8); web renders one Open billing button that calls the gate with destination `Billing`; the free slot renders "Stage 1 is always free." by default and the guidance slot renders nothing; no banned learner word |
| `apps/mobile/src/screens/profile/__tests__/ProfileScreen.test.tsx` (B-13, new; the same `render` project as the row above) | Plan details shows for free, premium and covered tiers and opens the Plan screen without a PIN; the card says "Full route" and never "Premium" or "unlock" |
| `apps/mobile/src/platform/__tests__/billing-handoff.test.ts` (B-9b) | with `flags.grownUpHomeEnabled` the `Billing` destination calls `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })`; without it, `openExternalUrl(consoleBillingUrl())`, and an `http:` base comes back as `{ outcome: 'failed', url }` (B-9) |
| `packages/i18n/src/__tests__/billing-messages.test.ts` | new keys exist in `en`, typed in `ko` / `es` overlays; removed keys gone; every string a billing wireframe draws has a key (a list kept in the test); no message contains a digit-dollar pattern or a hard-coded limit; banned words (`kids`, age ranges) absent from `console.billing`; learner banned fixture passes for `caregiver.plan` and `learner.profile.plan` |
| `apps/web/e2e/billing.spec.ts` (B-11) | Playwright on F-APP-001's merged app-host build with a mocked API: parent with one free family → Get Family Plan on the card → (mock Stripe URL) → return checking → active → Connect a learner shown; caregiver read-only; receipts page and View receipt with step-up; offline banner; `/teach/billing?checkout=cancel` lands on `/account/billing` with the query; 320 px no sideways scroll; tab order = visual order |
| `apps/mobile/e2e/web/plan-status.spec.ts` (B-11; the mobile Playwright `testDir` is `e2e/web`) | PWA: Profile → Plan details (no PIN) shows no price; Open billing → PIN → the same tab opens `/account/billing` without the "Grown-ups only" lock (flag on); a gate the 15-minute session opened with a PIN older than 2 minutes asks on the `GrownUpArea` PIN screen first, then hands off; offline, Open billing is disabled with "Needs the internet" and re-enables online (A-7's state); with the A-2 worker active, a navigation to `/account/billing?checkout=success` serves the billing page, not the learner shell. |

Coverage: `packages/content-schema` 100 %, `packages/backend` ≥ 90 %, `apps/web` verification logic (`billing-summary.ts`, `checkout-return.ts`) 100 %, `apps/mobile` `logic/paywall.ts` 100 % (docs/tests/coverage-targets.md).

## 12. PR table

| PR | Type and contents | Size | Depends on |
|---|---|---|---|
| B-0 | `docs`: this spec, five wireframes under `design/wireframes/billing/`, superseded notes on `console/billing.md` and `paywall/upgrade.md`, index rows in `docs/specs/README.md` and `design/wireframes/README.md` | S | — |
| B-1 | `feat(content-schema)`: `schemas/billing.ts` (constants, event, receipt view, coverage, usage, read-only reason, card, summary, mode) + tests; export appended to `index.ts` | S | B-0, F-APP-001 A-1 (`APP_ROUTES`) |
| B-2 | `feat(backend,api)`: additive migration `0007_billing_events.sql` (table, two indexes, `idx_entitlements_provider_ref`), Db methods (memory + D1), sqlite tests | S | B-1 |
| B-3 | `feat(backend,content-schema)` + `docs`: `lib/billing-events.ts` mapping (both API shapes, `invoice_payments` lookups), webhook recording, refund recording (OD-6 revised: no entitlement change, BY-D8), `recordServerEvent`, the three webhook telemetry names + exact-list test + client 422 guard, names doc section, runbook Step 8 (subscribe `invoice.paid`, `invoice.payment_failed`, `charge.refunded`; record the pinned webhook API version; duplicate-refund note) | M | B-1, B-2 |
| B-5 | `feat(backend)`: `stripeMode`, live guard (`BILLING_LIVE_ALLOWED`), step-up (`lib/auth.ts` exposes `fva`; Clerk hint body; fail closed) on checkout and portal, success suffix with `plan` and `id`, `/health` booleans, wrangler.toml comments, runbook line "confirm `fva` in a production token", three telemetry names (`billing.checkout_refused` also reports the `409 already_active`). [BY] The checkout `409 already_active` itself landed in BY-1 (#371, `AMENDMENTS-BILLING-FAMILY-YEARLY.md` BY-D4) and is not B-5 work | M | B-1, B-3 |
| B-4 | `feat(backend)`: `/api/billing` router: `GET /summary` (`poll`), `GET /receipts`, `POST /receipt-link` (step-up, live guard, fresh Stripe lookup); two telemetry names | M | B-2, B-3, B-5 |
| B-6 | `feat(i18n)`: `console.billing.*` additions, the two `entitlementStatus` value changes, `caregiver.plan.*`, `learner.profile.plan` new keys, `a11y.planStatus` (en; ko / es overlay entries for review) + tests | S | B-0 |
| B-7 | `feat(web)`: pure view models `billing-summary.ts` (reads `SITE_CLAIMS` through a parameter defaulting to it), `checkout-return.ts` + API client `billingSummary()` / `receipts()` / `receiptLink()` + tests | M | B-1, B-6, F-SITE-002 S-2 (`site-claims.ts`) |
| B-8a | `feat(web)`: the page body at `app/(console)/account/billing/page.tsx` (replaces F-APP-001's re-export): mode banner, cards, offer inside a single buyable card, Add a plan for several, includes lines, connect-a-learner, past-due note, offline and error panels, help; `noindex` check (and `account/layout.tsx` metadata if needed). **Done (#514)** | M | B-4 and B-5 deployed, B-7, F-APP-001 A-5c, a design mock in `design/screens/` from these wireframes |
| B-8b | `feat(web)`: checkout-return states (polling, offline pause) and the step-up dialog with `useReverification` around checkout and portal. **Done (#548**, which replaced #521) | M | B-8a |
| B-8c | `feat(web)`: `/account/billing/receipts` page, receipt-link opening, step-up around it; removal of the old `console.*` billing keys of section 6.1. **Done (#529)** | M | B-8a, B-8b |
| B-9 | `feat(mobile)`: Plan screen (status only, ungated, family / self wording, free slot, web-only Open billing through the gate destination `Billing` → today's `consoleBillingUrl()`, native no link), Profile card words and Plan details for every tier, removed paywall keys + tests | M | B-6 |
| B-9b | `feat(mobile)`: the `Billing` destination hands off in the same tab through `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })` when `flags.grownUpHomeEnabled` is on (replaces F-APP-001 A-7's paywall item) | S | B-9, F-APP-001 A-6 |
| B-10 | `test(web)`: `site-no-billing` guard test (links and amounts only, allow-list of section 11) | S | F-SITE-002 S-5 (last page PR), F-APP-001 A-8 |
| B-11 | `test(e2e)`: web billing spec and PWA plan-status spec on the merged app-host build. The web spec (`BILLING_E2E=1`) and the plan-status flag-on group (`E2E_GROWN_UP_HOME=1`) need a build with an API base and the flag on, which no CI job makes yet: they run by hand until B-14; the plan-status release-build tests run in CI's PWA shards | S | B-8c, B-9b, F-APP-001 A-3 |
| B-12 | `feat(web)`: space settings archive confirm names the active plan it affects (section 4.6) | S | B-8a |
| B-13 | `test(mobile)`: a React Native renderer in the mobile test suite (or the Detox job `apps/mobile/vitest.config.ts` names), then `PaywallScreen.test.tsx` and the `ProfileScreen.test.tsx` extension of section 11 | M | B-9b |
| B-14 | `ci`: a CI job that builds the merged app-host dist with an API base (`EXPO_PUBLIC_API_BASE_URL` at a mock host) and `EXPO_PUBLIC_GROWN_UP_HOME=true`, then runs `apps/web/e2e/billing.spec.ts` and `billing-step-up.spec.ts` (`BILLING_E2E=1`, `E2E_OUT=../mobile/dist`) and the flag-on PWA specs (`E2E_GROWN_UP_HOME=1`: `plan-status`, `plan-screen-same-tab`, `grown-up-entries`). Edits `.github/workflows`, so it is its own PR | S | B-11 |

B-1 and B-6 can run in parallel right after B-0 (B-1 also needs F-APP-001 A-1, a small PR with no dependencies). B-2 → B-3 → B-5 → B-4 is the server chain. B-9 needs only B-6 and ships before anything on the app host (it removes the native link and the price at once). F-ENT-003 E3-8 lands after B-9 (it fills B-9's slots and adds `caregiver.plan.freePlan`).

## 13. Owner decisions and sibling amendments

### 13.1 Owner decisions (each has a default; work never waits)

| # | Question | Default (applies until the owner answers) | Gates |
|---|---|---|---|
| OD-1 | Where does the billing page live on app.hangulroute.com? | `APP_ROUTES.billing` = `/account/billing` (F-APP-001 OD-7), in the existing Next.js console served on the app host (F-APP-001 OD-1). | B-8a |
| OD-2 | Show `PLAN_PRICING` amounts on the signed-in billing page while Stripe is in test mode? | Yes, under the "Test mode: no real card is charged." banner (as `/teach/billing` does today). Never on the learner app or hangulroute.com. | B-8a |
| OD-3 | Learner Plan screen on the web: offer an **Open billing** button? | Yes, web only, through the gate, same tab (B-9b), no price. Native: none. | B-9 |
| OD-4 | Use Apple's US-storefront external purchase link exception, or a Google Play alternative billing programme? | No, on every storefront. Native builds carry no external purchase link or mention. | B-9 (copy), store submissions |
| OD-5 | Native family coverage before F-IAP-002: may a store-distributed build unlock a Family Plan bought on the web? | Native builds keep honouring every tier source in code; before the first public store release, F-IAP-002 adds the Family Plan as an auto-renewable yearly in-app subscription (Guideline 3.1.3(b), [BY]). Until then native builds go only to TestFlight / internal testing. Class and school coverage is fine under 3.1.3(c). | release checklist only |
| OD-6 | What does a refund do? | Revised 2026-10-11 [BY-D8]: nothing by itself, for either plan; status follows Stripe's subscription events, and the owner cancels immediately in the dashboard to end a refunded plan at once. Learners keep everything they earned. | B-3 |
| OD-7 | Require a fresh sign-in before checkout, portal and receipts? | Yes, when the first factor is older than 10 minutes (`STEP_UP_MAX_AGE_MIN`), failing closed when the token has no `fva`. | B-5, B-4, B-8b |
| OD-8 | Do viewers (co-parents, co-teachers, teachers in a school) see receipts? | No. They see coverage and status only. School admins are payers (they can already buy and manage), so they see receipts. | B-4 |
| OD-9 | How does an adult learning alone buy? | Through a family space they own, with the empty-state button "Set up for me or my family" and the steps of section 2. No new product. | none (copy only) |
| OD-10 | (withdrawn) The old-address forwarder. | F-APP-001 and F-SITE-002 own the redirects (section 4.1). | — |
| OD-11 | Stripe invoices for one-time lifetime payments (`invoice_creation`)? | Withdrawn 2026-10-11 [BY]: no one-time payment is sold any more; both plans are subscriptions and Stripe issues an invoice for every year. | — |
| OD-12 | When does Stripe go live? | Not in this spec. `BILLING_LIVE_ALLOWED` stays unset and a live key is refused, until the owner says otherwise. | — |

### 13.2 Amendments the sibling specs carry (so the five specs agree)

| Id | Spec | Amendment |
|---|---|---|
| A1 | F-APP-001 | Owner step S-4 (`CONSOLE_URL` to the app host) waits until A-2 has been in production at least 14 days (section 4.1, old workers). |
| A2 | F-APP-001 | A-7 drops "paywall same-origin billing": the learner Plan screen's hand-off is F-BILL-002 B-9b, through A-6's `openGrownUpArea`. |
| A3 | F-APP-001 | A-9's `billingReturnUrl(env, suffix)` is the only return-URL helper; F-BILL-002 B-5 supplies the success suffix `?checkout=success&plan=<k>&id=<spaceId>`. |
| A4 | F-APP-001 | (optional copy) the `/start` parent role card reads "For me or my family", matching the billing empty state, so adult self-learners recognise it. |
| S1 | F-SITE-002 | (answered, superseded) F-SITE-002 revision 2 builds no `_redirects` and no `site-routes.json`; F-APP-001's stubs forward `/teach/billing` in one hop and the site renders no billing link. Remaining edit: F-SITE-002's sentences that mention "F-BILL-002's `/teach/billing` forwarder", `BILLING_URL` and `EXPO_PUBLIC_BILLING_URL` describe revision 1; revision 2 has none of them (the old address on the app host is F-APP-001 A-5c's redirect page; the learner app keeps `consoleBillingUrl()` until B-9b hands off through F-APP-001). |
| S2 | F-SITE-002 | B-10's guard scans links and amounts only and allows the S-7 legal prose; if F-SITE-002 ships its own equivalent guard, B-10 reuses it. |
| F1 | F-ENT-003 | (adopted in F-ENT-003 revision 2: §3.9.1, wireframe `billing/plan-status-free-lessons.md`, E3-8 after B-9, keys `caregiver.plan.freePlan`, "Every lesson of every Stage, now and later" moved to the billing page.) Remaining edit: the switch-off line F-ENT-003 quotes is `caregiver.plan.free.open` = "Stage 1 is always free." (today's wording), not "Stage 1 is open to everyone." (revision 1). |
| F2 | F-ENT-003 | Closed by F-ENT-003 OD-1 (2026-10-11): the Profile `learner.profile.plan.freeNote` ("Stage 1 is free. More stages are on the way.") stays true when the switch is on, because all of Stage 1 stays free; no swap. |
| F3 | F-ENT-003 | §3.9.2's **Open billing** link: there is no `billingUrl()` in F-BILL-002 revision 2. On the console it is `APP_ROUTES.billing`; on the learner device it is the Plan screen's gated **Open billing** (B-9 / B-9b); nothing on native. |
| F4 | F-ENT-003 | The locked story and topic entries (`logic/story/story-tile.ts` `lockedStoryGate`, `TopicGrid.tsx`, `VocabTopicScreen.tsx`) still send a learner through `PinEntry { next: 'Paywall' }`. Since B-9 the Plan screen is status only and ungated, so on native that PIN leads to a screen with no action. Section 4.7 allows it (arriving through the gate is harmless); E3-8, which owns these entries and their **Ask a grown-up** wording, either points them straight at `Paywall` or keeps the gate on purpose and says so, and pins the choice with a `story-tile` test. **Closed by F-ENT-003 E3-8 (revision 3.4): the gate stays on purpose** (the entries ask a grown-up, as F-ENT-003 §3.7's ask rows do); `story-tile.test.ts` pins it. |
| B1 | F-BROWSE-001 | [ See plans ] targets `APP_ROUTES.billing` on the app host; F-BILL-002 exposes no "paying grown-up" flag (BROWSE's `accountBrowseScope` is the only rule). |

Assumptions this spec relies on (and what happens if they change):

- **AS1.** F-APP-001 serves grown-up pages on app.hangulroute.com with Clerk on that origin. If it slips, B-0 to B-7 and B-9 still ship; only B-8a onward waits, and the old page keeps working at `/teach/billing` on hangulroute.com.
- **AS2.** The family cap of 5 learners stays on every family space, paid or not (`spaces.ts:300`). This spec does not change it.
- **AS3.** F-ENT-003 decides what is free; the Plan screen renders its slots. Until E3-8, the free slot says "Stage 1 is always free."
- **AS4.** Production Clerk session tokens carry `fva` (checked once, section 4.4).

## 14. Out of scope

- App Store and Google Play purchases and restore (F-IAP-002), receipts for them, and their entitlement rows.
- Proration, plan switching between products, seat purchases, multi-currency prices, taxes and VAT invoices.
- Manual contract invoices (`school_seat`).
- Disputes and chargebacks (`charge.dispute.*`): not recorded; the owner handles them in the Stripe dashboard.
- Preventing two concurrent checkouts before either is paid (section 4.4 handles the duplicate after the fact).
- A billing area inside native builds beyond the status-only Plan screen.
- Moving the console to the app host (F-APP-001) and rewriting the marketing site (F-SITE-002).
- Email notifications about renewals or failed payments (Stripe's own emails cover them).

## 15. Dependencies

- F-ENT-001 (entitlements, tier rule, checkout, portal, webhook) and F-ENT-002 (promo codes): extended, not replaced.
- F-CONSOLE-001 (static export, `?id=` addressing) and F-AUTH-002 (Clerk console sign-in).
- F-I18N-001 (dictionary, budgets, overlays).
- F-PWA-001 (telemetry names list) and F-LEARN-001 / F-PROF-001 (gate, `gateOpensDirectly`, audience copy).
- F-APP-001 (A-1, A-2, A-4, A-5a, A-5c, A-6, A-8, A-9), F-SITE-002 (S-2, S-5), F-ENT-003 (E3-8 after B-9), F-BROWSE-001 (link target only).

## Review log

**2026-10-11, revision 1**: written from the owner request and the code at `ea9049e4`.

**2026-10-11, revision 2**, after two reviews (R1: "needs revision", 2 blockers, 4 majors, 7 minors; R2: "approve with changes", 4 majors, 9 minors). Every blocker and major is applied; minors are applied unless noted.

| Finding | Resolution |
|---|---|
| R1-B1 three specs disagree on path, forwarder and return helper | Applied. Path = F-APP-001 `APP_ROUTES.billing` (`/account/billing`); this spec's forwarder (`billingForward`, the moved-notice wireframe, OD-10) is removed; app-host legacy redirect = F-APP-001 A-5c; site-host = F-APP-001 A-8 stubs, one hop (F-SITE-002 revision 2 dropped its `_redirects`, so S1 is superseded); `billingReturnUrl` = F-APP-001 A-9 only, `BILLING_URL` dropped; ownership table in the header; B-10 depends on F-SITE-002's page PRs and F-APP-001 A-8 by name. |
| R1-B2 learner Plan screen contradicts F-ENT-003 | Applied. Plan screen has slots for F-ENT-003's lines; one namespace for both specs, `caregiver.plan.*` (F-ENT-003 revision 2 chose `caregiver.plan.freePlan`); §6.4 deletes only the removed keys and moves the rest; the invented "Stage 1 is open to everyone." is replaced by the existing "Stage 1 is always free."; E3-8 after B-9 (amendment F1). |
| R1-M1 new tab breaks the grown-up unlock | Applied. B-9b uses `openGrownUpArea` in the same tab; a11y hint "Opens the billing page"; tests and e2e updated. |
| R1-M2 learner cannot reach own plan status | Applied. Plan details for every tier, Plan screen ungated (only Open billing is gated), Profile card says "Full route" / "Everything is open…"; tests for reachability and banned words. |
| R1-M3 purchase with no learner; no self-learner path | Applied. Connect a learner step (links to F-APP-001's family page with the join panel; the code is not added to the billing summary, to keep it out of a money response), self-learner story with steps, audience-specific copy, new done line. |
| R1-M4 offline states missing | Applied. Section 4.12, offline keys, polling pause without spending attempts, states in every wireframe. |
| R1 minors (single-space layout, missing strings, terms, includes lines, adultAccess, guard scope, step-up reason and header) | Applied. `adultAccess` removed (BROWSE owns the rule); includes lines read `SITE_CLAIMS`; header is F-APP-001's `AdultFrame`. |
| R2-M1 old service workers on the Stripe return | Applied in part. F-APP-001 A-2's denylist covers `/account` and `/teach`; S-4 waits 14 days after A-2 (amendment A1); B-11 checks an updated worker serves the billing page. Not applied: a learner-bundle boot guard calling `SKIP_WAITING`, because a stale controlling worker serves the old bundle, which cannot contain the guard; and an e2e "old worker ends on billing", which cannot pass by construction. The residual case loses nothing (the webhook applies the plan). |
| R2-M2 cancel at period end shows "renews"; basil period end | Applied in B-3 with tests. |
| R2-M3 step-up would not trigger `useReverification`; no-`fva` backstop | Applied. Clerk hint body plus our code; fail closed without `fva`; no-loop rule; production `fva` check in the runbook. |
| R2-M4 refund history on basil | Applied. `invoice_payments` lookups for `payment_ref` and the refund fallback; pinned API version recorded in runbook Step 8. |
| R2 minor: PR ordering (`deleteSpace`, telemetry names, B-8 size) | Applied. `deleteSpace` removed; names land with their senders (B-3, B-5, B-4) and B-5 / B-4 depend on B-3; B-8 split into B-8a, B-8b, B-8c. |
| R2 minor: `/billing` outside the `/teach` layout | Applied through F-APP-001's shared grown-up layout, with a `noindex` test. |
| R2 minor: forwarder as a Next page on the marketing host | Moot: the forwarder is removed (R1-B1). |
| R2 minor: learner can open receipts with the payer's PII | Applied in part: step-up and payer check on opening a receipt (`POST /receipt-link`); inline rows carry no link. Not applied to the receipts list itself (dates and amounts only, no PII), to avoid a second prompt for no gain. The inactivity timeout is F-APP-001's grown-up lock (15 idle minutes). |
| R2 minor: receipt URLs cached forever, Stripe call inside a GET | Applied differently: receipt URLs are no longer stored; `receipt_url` column removed; the GET makes no Stripe call; a fresh link is fetched per click through a POST. `charge.succeeded` is therefore not needed. |
| R2 minor: `already_active` overclaims | Applied. Claim reworded; duplicate flagged in telemetry and handled by a runbook refund note; concurrent-checkout prevention listed out of scope (no new column). |
| R2 minor: telemetry is transient; `summary_viewed` inflated by polls | Applied. |
| R2 minor: step-up strings missing | Applied (`stepUp.cancelled`, `stepUp.unavailable`). |
| R2 minor: no index on `entitlements.provider_ref`; disputes | Applied (index in 0007; disputes out of scope). |

**2026-10-11, revision 2 (sibling pass)**: re-read the sibling specs as revised in parallel. F-SITE-002 revision 2 dropped its redirect table, so the old site address is F-APP-001 A-8's one-hop stub only (amendment S1 closed; B-10 now depends on F-SITE-002's page PRs and A-8). F-ENT-003 revision 2 moved its lines onto the Plan screen under `caregiver.plan.freePlan`; this spec now uses `caregiver.plan.*` for every Plan screen string, moves `free.bubble` to `caregiver.plan.free.open` with the same words, and adds a guidance slot for F-ENT-003's premium no-plan line (amendments F1 to F3 updated).

**2026-10-11, B-1 review amendments (PR #375)**, after two reviews of B-1. Section 5.2 only; no behaviour elsewhere changes.

| Finding | Resolution |
|---|---|
| `usage` could not be omitted, but a school teacher member sees no seat counts (section 4.2, 5.3) | `usage: Usage \| null`; null means no usage line. |
| "A newer Worker never breaks an older page" held for unknown keys only: a new enum value or a higher inline limit failed the whole summary | `parseBillingSummary` is per-card and per-row tolerant, cuts inline rows to 3 and reads an unknown mode as `none`; `BillingSummarySchema` stays the strict Worker contract. |
| The account card had no Manage action and a `hasReceipts` with nowhere to point | `BillingAccountCardSchema` named: `actions: { manage }` (the portal accepts subject `account`), no `hasReceipts`. |
| Zero-decimal currencies | `amountCents` is documented as Stripe's minor unit. |
| `paymentRef` could be empty; a student could get a card | `paymentRef` non-empty or null; the card role excludes `student`. |

**2026-10-12, B-9 review amendments (PR #424, follow-up PR)**, after two reviews of B-9 (both approve, minors only). The text now matches what B-9 shipped; no behaviour changes.

| Finding | Resolution |
|---|---|
| §4.7, §6.2 and §11 still said `Linking.openURL` and lacked the two new keys | Applied. §4.7's B-9 bullet names `openExternalUrl`, the web's one more tap after the PIN (`gateDone`) and the offline line; §6.2 lists `needsConnection` and `gateDone`; §11's hand-off row says `openExternalUrl`. |
| `paywall.console_opened` payload change unrecorded | Applied in docs/roadmap/TELEMETRY-NAMES-2.md: `{ state }` since B-9, sent only on `opened`; older builds send `{ plan: 'family_lifetime' }`, so readers accept both. |
| Open billing now refuses an `http:` console base | Applied as a documented rule, not loosened for dev builds: the base must be `https:` (doc comment, runbook Step 5 note, a hand-off test through the real web hand-off). |
| Two copies of the gate-session read (Sources and Plan) | Applied: `store/gate-now.ts` `gateOpensDirectlyNow()` with tests; both screens import it. |
| Source tests matched code shape (whitespace, 80-character windows) | Applied: identifier and import checks only. The §11 render tests stay deferred until the mobile suite has a renderer (rows marked). |
| Locked tiles PIN-gate a status-only screen | Recorded as amendment F4 for F-ENT-003 E3-8; no change in B-9 (§4.7 allows it). |
| Button hint node used the deprecated `nativeID` on the web | Applied: the web branch passes `id`. |
| Plan screen e2e ran only at 375 and 320 px | Applied: one 1280 x 800 case (status only, Open billing's accessible description, no sideways scroll). |
| B-7 review (PR #426): `formatMinorAmount` took fraction digits from Intl's CLDR data, which differs from Stripe's minor unit for HUF, ISK, COP and others | Applied: Stripe's zero-decimal and three-decimal tables decide the digits; usd receipt amounts go through `formatUsd` as section 4.10 says. |
| B-7 review: past-due note after the grace, test mode with `purchasesOpen: false`, Contact rows by kind, `stillProcessing` ignoring a later summary, `cleanedReturnSearch` stripping a page's own `?id=`, an all-dropped summary showing the empty state, an unchecked receipt link, the lowercase account heading | Applied: the note shows only inside the grace week; buttons follow section 4.3 item 2 (off only for `none` and closed `live`); Contact rows follow `actions.contact`; a later active summary ends `stillProcessing`; only a `checkout=success\|cancel` query is cleaned; a summary whose every row is unreadable is `unreadable_summary`; `receiptLink` accepts only an `https:` URL; `accountCard.title` added. |

**2026-10-12, B-4 review amendments (PR #450)**, after two reviews of B-4 (R1: approve, 7 minors; R2: 1 major, 4 minors). Sections 4.2, 5.3 and 5.5 as shipped.

| Finding | Resolution |
|---|---|
| R2 major: `GET /api/billing/summary` read each card's plans, members and receipts one by one (and each class of a payer's school), so a large school or a teacher with many classes would pass D1's 50 statements per invocation | Applied. Four set-based Db reads (section 5.5, memory and D1, `json_each`): `entitlementsForSpaces`, `membersOfSpaces`, `childSpacesOfSpaces`, `billingEventsForSpaces` (`ROW_NUMBER() OVER (PARTITION BY subject_id)`). The summary makes the same number of Db calls for a school of 1 class or 45, and for a teacher with 1 class or 45 (budget test: equal counts, at most 10). `schoolLimitsFrom` and `schoolUsageFrom` count from rows already read. |
| R1: viewers got the learner cap | Applied as section 5.3 says: a viewer card's `usage` is the learner count only (`learnerCap: null`). |
| R1 / R2: the owner of a class inside a school was a payer | Applied as the persona table says: on the billing home that owner is a viewer (`payer: false`, `readOnlyReason: 'school'`, no receipts, viewer ordering), unless the class still holds its own plan row (a class moved into a school with its own license), where the owner stays its payer and can manage it. `GET /receipts` and `POST /receipt-link` keep the `space.manage` check. |
| R1: an archived family with a legacy one-time row stayed forever; R2: an archived space past due beyond the grace lost its card | Applied. An archived space shows to its payers while its shown row renews (a Stripe subscription or a dated Family Plan or license row, never a legacy one-time row) and is active or past due, so a subscription Stripe still retries keeps its Manage button. |
| R2: rows of the other Stripe mode showed View receipt | Applied. `hasReceipt` is false for a row the bound key cannot open (test rows under a live key, live rows under a test key, every row without a key); `POST /receipt-link` answers `404 other_mode` before calling Stripe. |
| R1: account cards shared one receipts list | Applied. Each account card carries its own plan's receipts, and `legacyNoHistory` counts those only. |
| R1: `404 no_receipt` undocumented | Applied in section 5.3; the page maps it like any failure ("Can't open this receipt right now."). |
| R1 / R2: weak tests (receipts without step-up, outbound calls, untested branches) | Applied: `GET /receipts` with a stale `fva`, a `globalThis.fetch` spy, a school teacher member under a seat contract, a class in an archived school, a member of a school past due beyond the grace, account cards past due and with no history. |

**2026-10-12, B-9b (F-APP-001 alignment and review)**. The text now uses the shipped name; the offline state is A-7's.

| Finding | Resolution |
|---|---|
| §4.7, §11 and the PR table named `via: 'paywall'`; F-APP-001 (sections 3.6, 3.18, its 2026-10-12 design-pass note) and the shipped schema (`schemas/app-shell.ts`, `via` is `profile \| dashboard \| plan \| lock`) use `plan` | Applied: `via: 'plan'` here, in `design/wireframes/billing/plan-status.md` and in `design/screens/billing/plan-status.md`. |
| What the Plan screen does after the gate with the flag on | Applied in §4.7's B-9b bullet: no extra tap, the `GrownUpArea` PIN screen on a stale PIN, `shell.grown_up_handoff` instead of `paywall.console_opened`. |
| B-9b review: with the flag on, offline Open billing went to the grown-up offline page, against F-APP-001 sections 3.6 and 3.12 and design D18 | Applied. The disabled "Needs the internet" state is F-APP-001 A-7's and shipped with it (PR #454, `planOpenBlocked`); B-9b keys it on the same predicate (`planOpenBlocked(billingOpensSameTab(), online)`) and also starts no hand-off on a return from the gate while offline. The wireframe and the mock no longer send offline Open billing to the offline page. |
| B-9b review: a double tap during `openGrownUpArea`'s telemetry wait (up to 1 s) ran the hand-off twice | Applied: a second press while a hand-off is under way does nothing. |
| B-9b review: on a device with no PIN, the gate creates one and the `GrownUpArea` PIN screen then asks for it again | Kept as F-APP-001 section 3.9 decides (creating a PIN does not set `lastPinVerifiedAt`, so a PIN a child could create never opens the grown-up area by itself); recorded in §4.7. |
| B-9b review: the flag-on behaviour was checked only by source checks | Applied: `apps/mobile/e2e/web/plan-screen-same-tab.spec.ts` (flag-on build, `E2E_GROWN_UP_HOME=1`, as A-7's spec) covers the same tab, a self-only device and the stale PIN; the B-11 row of §11 names the stale-PIN case. |

**2026-10-12, design pass** (B-8a's "design mock in `design/screens/`" dependency): `design/screens/billing/` gains `billing-home.md`, `checkout-return.md`, `step-up.md`, `receipts.md`, their mocks on `mock/billing.css` and shots at 375, 1280 and 320 with 200 % text. Every drawn string comes from B-6 / B-7 keys through the B-7 view models; no string, key or behaviour of this spec changes. The decisions the mocks take (D1 to D10: the dictionary's renew line, no "(sandbox amount)" suffix, what stays enabled while actions are off, the legacy no-history line on the card, notice tones, the marked card, no motion, the receipts table switching by its column) are recorded in `design/screens/billing/README.md`. Reviewed for design, accessibility, copy and billing correctness before the PR; the fixes are in the mocks.

**2026-10-13, B-8 review (PRs #514, #521, #529)**. Two independent reviews of the stacked billing page PRs.

| Finding | Resolution |
|---|---|
| B-8a: a code checked for the first offer's plan rewrote every price line in Add a plan, so a Group License row could show a price checkout then refused | Applied: the page keeps the plan the code was checked for; `billingHomeView` (`promoPlanKey`) prices only that plan's offers with the promo, and checkout for another plan carries no code. |
| B-8b: the step-up dialog made every `body` child inert, including Clerk's own root, so a second step-up in one page session could leave Clerk's modal unusable behind an inert subtree | Applied: the dialog steps aside while Clerk verifies (no scrim, nothing inert; `design/screens/billing/step-up.md` state 2) and never makes Clerk's root inert (`#clerk-*`, `data-clerk-*`, `cl-*`). |
| B-8b: in "verifying" nothing ended the wait if Clerk's UI never opened (its script blocked or offline), against section 4.12's "Clerk cannot be reached" row | Applied: offline is "Can't confirm right now" at once; otherwise, if Clerk's modal (`.cl-modalBackdrop`) has not appeared within `CLERK_UI_OPEN_TIMEOUT_MS` (10 s), the attempt reads "Can't confirm right now" and a late answer is dropped. Once Clerk's UI has shown, the grown-up takes as long as they need. |
| B-8b: the dialog's fixed scrim was inside the page's size container (`.hr-bill`, `container: bill / inline-size`), which is the containing block of a fixed descendant, so it did not cover the viewport | Applied: the dialog is portalled to `body`; `apps/web/e2e/billing-step-up.spec.ts` (export built for it, `BILLING_E2E=1`) checks at 320 and 1280 px, opened far down the page, that the scrim is the viewport, the dialog is inside it, the page is inert and Clerk's root is not, Tab and Shift+Tab wrap, and Escape gives focus back. |
| B-8b: each step-up sent the refused request twice before Clerk's UI opened (double-counting `billing.checkout_refused`) | Applied: the hint already in hand is handed to Clerk's handler, so only Clerk's retry reaches the Worker. |
| B-8b: untested branches (checkout `promo_invalid`, a refused portal, the legacy account card's Manage, a return whose first read fails) and a poll that could start while a slow first read was out | Applied: page tests for each; a poll never starts while a summary read is in flight. |
| B-8c: on the receipts page the blank tab opened in front of the step-up dialog, so on a phone the grown-up saw an empty tab while this one asked them to confirm | Applied (section 4.10): the blank tab is closed before the dialog opens; after step-up the receipt opens in a new tab, or, when the browser blocks it, the row says "Confirmed. Tap View receipt again to open it." (`receipts.tapAgain`, en / es / ko), and that tap opens it inside the tap. |
| B-8c: the blocked-tab fallback used `window.open(url, '_blank', 'noopener,noreferrer')`, which returns null even when the tab opens, so a successful fallback still showed the failure line | Applied: the fallback opens without a features string and clears `opener` on the returned window; the test's fake `open` returns null for `noopener` as browsers do. |
| B-8c: the beyond-limit line shows at exactly 50 rows although nothing is older | Kept and documented (`design/screens/billing/receipts.md` item 5): `GET /api/billing/receipts` carries no "more" flag (B-4's contract), and the line is guidance that stays true at exactly 50. A `more` flag is a Worker contract change for a later row. |
| B-8c: removing `console.*` keys leaves the es / ko `console` ledger entries stale | Not applied: the `console` entries were already stale on `main` before this stack (other merged PRs changed `en/console.ts` after the last sign-off), so re-signing here would sign text this review did not read. The next §3.10 review round re-signs `console`. |

**2026-10-13, B-12 review amendments (PR #538)**, after two reviews of B-12 (both approve, minors only). Section 4.6's archive confirm as shipped.

| Finding | Resolution |
|---|---|
| R2: "keeps renewing" was decided from `expiresAt`, so a dated row Billing cannot cancel (not a Stripe subscription) would point at a cancel that is not there | Applied. The renewing line follows the server's rule: the payer's card with `actions.manage`, a dated row, not cancelled at period end, status active, trial or past due. Archive needs `space.manage`, so the archiver's card is the payer card. |
| R1 / R2: a plan past due beyond its grace week got no line, though Stripe still retries the renewal | Applied. The confirm says the plan keeps renewing (the learners already lost it, so no loss line): "The Group License keeps renewing until you cancel it in Billing." or the new standalone "The Family Plan keeps renewing until you cancel it in Billing." (`console.billing.archiveConfirm.familyRenewsAlone`, with es and ko). |
| R1 / R2: the summary was read last in the page load and again after every settings action; a click before it settled gave the plain confirm | Applied. The page reads the summary once per live space (its own effect, quietly with `poll`), and the archive click waits for a read still under way for at most 1.5 s before it asks; a slow or failed read keeps the plain confirm. |
| R1: a Group License that will not renew gets no line, though learners lose it while the class is archived | Kept as section 4.6 words it: the license line is the renewing one only. A class's learners return to the license when it is unarchived, and a cancelled license ends at its period end either way. |
| R1 / R2: untested branches (trial, license past due, cancelled and ended licenses, the Korean confirm, a click before the read settles) | Applied: unit cases for each and two page cases. |

**2026-10-13, B-11 review (PR #568)**. Two independent reviews of the B-11 e2e specs.

| Finding | Resolution |
|---|---|
| R1: the plan-status row's offline item (Open billing disabled with "Needs the internet", back online) had no test in `plan-status.spec.ts` | Applied: a flag-on test checks the disabled button, its "Needs the internet" description and line, that a tap opens no PIN screen, page or tab, and the online hint once the connection returns (`grown-up-entries.spec.ts` keeps A-7's copy of the state). |
| R1: `PaywallScreen.test.tsx` and the `ProfileScreen.test.tsx` extension were due "at the latest B-11" | Deferred to the new row B-13: the mobile suite runs in `node` with no React Native renderer, and adding one is not test-only e2e work. Section 4.7's web behaviour stays covered by `plan-screen*.spec.ts` and `plan-status.spec.ts`, the rest by `paywall.test.ts` and `plan-screen-source.test.ts`. |
| R1 / R2: the web billing spec and the plan-status flag-on group are env-gated and run in no CI job | Recorded: the B-11 row says they run by hand, and the new row B-14 adds the CI job (it edits `.github/workflows`, which B-11 does not). The plan-status release-build tests run in CI's PWA shards today. |
| R1: the stale-PIN test did not show that the grown-up area's PIN screen, not the Plan gate, asked | Applied: three minutes on, a gate (Edit profile) still opens with no PIN, so the one PIN asked after Open billing is the 2-minute rule; the test also checks no new tab and the `src: 'pin'` unlock. |
| R1: weak assertions (Connect a learner's address, the price pattern, the receipts test pill) | Applied: the address is `APP_ROUTES.parentHome` + `/space?id=` of the family; the price pattern takes the landing-claims amount and term patterns; the pill is read from the receipt's own row. |
| R1: the section 11 row named `apps/mobile/e2e/plan-status.spec.ts` | Applied: the row names `apps/mobile/e2e/web/plan-status.spec.ts`. |
| R2: on CI's build (no API base) the release-build checkout-return test never reaches its mock | Kept, with a comment: run on a plain `build:web` it passes, and what it pins there is the routing and the cleared query; the cards are checked on the API-base build. |
| R2: `E2E_OUT` went into the server command unquoted | Applied: quoted with `JSON.stringify`. |
| R2: the 320 px tab-order walk stopped at the first stop outside the billing body | Applied: such stops are skipped; the walk ends when focus leaves the page, comes back to the heading or repeats, and must reach Get Family Plan (free family) or All receipts (paid family). |

**2026-10-13, docs follow-ups after the 2026-10-13 merges** (#514, #521, #529, #568). Section 11's `plan-status.spec.ts` row drops the "Until B-11, `plan-screen-same-tab.spec.ts` covers..." sentence, since B-11 (#568) has merged; rows B-8a, B-8b and B-8c are marked done (#514, #548, which replaced #521, and #529).

**2026-10-14, B-13**. The mobile suite gains a React Native renderer instead of the Detox job: `apps/mobile/vitest.workspace.ts` runs two projects in one `vitest run` (so `--coverage` and `-t` filters cover both), `unit` (`vitest.config.ts`, unchanged) and `render` (`vitest.render.config.ts`), where `react-native` resolves to react-native-web and screens render into `react-test-renderer` in Node. The native-only libraries a screen pulls in (safe-area insets, reanimated, react-native-svg, the expo modules, AsyncStorage) get still stand-ins in `src/test-support/render-setup.ts`, and no request leaves a render test. Section 11's `PaywallScreen.test.tsx` and `ProfileScreen.test.tsx` rows are in: every state on `web`, `ios` and `android` for both audiences (no price, purchase or banned learner word; native: no link, no Open billing and no deny-list word of section 4.8 in en, es and ko; web: one Open billing button that goes to the gate with `{ next: 'Billing' }` while the device needs a PIN; the free slot reads "Stage 1 is always free." and the guidance slot is empty by default), and Plan details on every tier opening `Paywall` with no PIN on a device whose gated rows ask for it, the card reading "Full route" or "Free plan" and never "Premium" or "unlock".
