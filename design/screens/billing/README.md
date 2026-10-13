# Billing screens: the learner Plan screen, the billing home, the checkout return, step-up and receipts (design mocks v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` (sections 4.2 to 4.7, 4.9, 4.10, 4.12, 6, 8).
Wireframes: `design/wireframes/billing/` `plan-status.md`, `plan-status-free-lessons.md`, `billing-home.md`, `checkout-return.md`, `step-up.md`, `receipts.md`.

Built by:

- **B-9** (merged): the learner Plan screen and the Profile plan card → `plan-status.md` (`apps/mobile/src/screens/paywall/PaywallScreen.tsx`, `logic/paywall.ts`).
- **B-8a**: the billing home at `app.hangulroute.com/account/billing` (`APP_ROUTES.billing`): mode banner, cards, the offer inside a single buyable card, Add a plan for several, includes lines, Connect a learner, the past-due note, the offline and error panels, Help → `billing-home.md`. This design pass is the "design mock in `design/screens/`" that section 12 lists as B-8a's dependency.
- **B-8b**: the checkout return (polling, offline pause) and the step-up dialog with `useReverification` around checkout and portal → `checkout-return.md`, `step-up.md`.
- **B-8c**: the receipts page at `/account/billing/receipts?id=<spaceId>`, receipt-link opening and step-up around it → `receipts.md`.
- **B-12** (the archive confirm) and **B-11** (e2e) read the card words and states drawn here; B-12's own lines are section 4.6's and are not drawn.

## What is here

| File | What it fixes |
|---|---|
| `plan-status.md` | B-9: the learner Plan screen and Profile card (unchanged by this pass) |
| `billing-home.md` | B-8a: anatomy at phone and wide widths, card variants per persona, the offer, Add a plan, disclosures, every state of the wireframe, what stays enabled when actions are off, accessibility, what never renders |
| `checkout-return.md` | B-8b: the eight return states from `checkout-return.ts`, the marked card, focus, the live region |
| `step-up.md` | B-8b and B-8c: the dialog's four states, focus, Escape, where it opens |
| `receipts.md` | B-8c: the table that reflows to a list, the row parts, View receipt, the failed lookup line, every state |
| `mock/plan-status.html`, `mock/plan-status.css` | B-9's board (unchanged) |
| `mock/billing.css` | the sheet of the four new surfaces; it is linked after `../../learning-route/mock/learning-route.css` (tokens, base rules, `.notice`, `.panel`, `.pill`, `.back-link`, `.skeleton`, the board) and `plan-status.css` (`.board-note`), and redefines no token |
| `mock/billing-home.html` | page: a parent with one free family (the common case: the offer inside the card) |
| `mock/billing-home-teacher.html` | page: a teacher with a licensed class (Receipts open), two free classes (so Add a plan, one primary) and a school seen as a member (read-only) |
| `mock/billing-home-states.html` | board, 21 items: loading, empty, all read-only, Family Plan with receipts, no learner yet, cancelled, past due, school payer, school on the free plan, archived, legacy one-time row, legacy account card, not configured, live key not opened, already active, offline, error, offline after load, Have a code? open, a code applied, feature lines once claims flip |
| `mock/checkout-return.html` | board, 8 items: checking, done, done with no learner, still processing, offline, error, cancelled, done-unknown |
| `mock/step-up.html` | board, 5 items: asking, verifying, unavailable, cancelled, asking over the receipts page |
| `mock/receipts.html` | page: the Kim family's six rows (renewal on Oct 5, 2028 after a payment that did not go through on the Oct 2 period end, a refund, a payment with a failed lookup, the first payment, a legacy row without a receipt) |
| `mock/receipts-states.html` | board, 7 items: loading, empty, older payments, not yours, offline, error, past 50 rows |
| `shots/` | every new mock in Chromium at 375, 1280 and 320 with the browser text size at 200 % (`-320-text200`). Pages at 2x, boards at 1x; 128-colour palette PNGs |

**The mocks are a design reference, not shipped code.**

- **Tokens.** Every value in `mock/billing.css` is a token of `packages/design-system/src/tokens.ts` through the custom properties `learning-route.css` defines once (named after the token: `--spacing-xl` is `spacing.xl`). Every `var()` it reads was checked to exist there; it holds no colour, spacing or radius literal. B-8a to B-8c write the same values with token imports (`components/console/ui.tsx` style objects). Numbers that are not tokens are under "Constants".
- **Units.** Text in rem (token / 16), so the browser text size enlarges every line; the page switches layout in em (45em = the adult frame's phone / wide switch, F-APP-001 section 3.8; 70em = the wide gutter), mobile first. The receipts table switches on its column's width (a container query in rem, see `receipts.md`).
- **Words.** Every drawn UI string was produced by running the B-7 view models of this commit (`billingHomeView`, `summaryFailureNotice`, `receiptRow` in `apps/web/src/lib/console/billing-summary.ts`; `initialReturnState`, `returnStep`, `returnNotice`, `busyCardId`, `focusCardId` in `checkout-return.ts`) on fixture summaries, plus dictionary values read directly where no view model exists yet (the step-up dialog `console.billing.stepUp.*`, the receipts page frame `console.billing.receipts.*`, the F-ENT-002 promo form `console.billing.promo.*`, `console.promoLabel`, `console.promoHint`). Those are B-6 (#402) and B-7 (#426) keys. **This pass adds no string.** Prices come from `PLAN_PRICING` through `formatUsd`, dates from `formatDate(…, 'monthDayYear', { utc: true })`, limits from content-schema constants. Space names (Kim family, Sunday Class A, Room 4, Maple School) and dates are fixture data; the fixture clock is Oct 12, 2028, so every receipt row falls after B-3 began recording history. Every Family Plan row is a yearly one except one edge-case row on the receipts page: a one-time session opened before BY-1 and completed after B-3 went live (Oct 12, 2026; see `receipts.md`). The usual legacy case, a one-time payment with no recorded row, is board item 11. Renewals follow Stripe's cycle: a failed renewal attempt sits on the period end and the successful retry comes after it, while the renews-on date keeps the original anchor.
- **Test mode only.** Stripe stays in Sandbox and Live stays off (owner decision, PNNL), so every page and board item carries the summary's banner, "Test mode: no real card is charged.", and every receipt row the "test" pill. Board item 14 draws the live-key guard ("Payments are not open yet. Nothing was charged.", buttons disabled), which is the state a live key shows while `BILLING_LIVE_ALLOWED` is unset; no mock draws a live, chargeable page.
- **Family Plan.** $15.30 a year, a Stripe subscription that renews yearly and can be cancelled any time (AMENDMENTS-BILLING-FAMILY-YEARLY BY-0 #369, BY-1 #371); Group License $153 a year. No mock says "lifetime", "once", "one payment" or "for good".
- **App host only.** Every surface here lives on app.hangulroute.com inside F-APP-001's grown-up layout and lock. Nothing is drawn for hangulroute.com.
- **The adult frame** (F-APP-001 A-5a, `design/screens/app-shell/adult-frame.md`) is drawn as two dashed placeholder rows (header, tabs with Billing current) and a footer placeholder; the billing page draws no header of its own (section 4.3). The boards leave the frame out.
- **Glyphs** are `Icon/glyphs.ts` paths, rendered from the module by the generator: `check` (includes lines), `arrow-right` (disclosures; turned 90 degrees when open), `arrow-left` (Back to Billing), `replay` (checking), `check-circle` (done). Decoration only (`aria-hidden`). No emoji. `colors.feedback.danger` is not used anywhere.
- **Generator.** The HTML files were written by a throw-away script run as a vitest file inside `apps/web` (so it imports the real view models); it is not committed, as for the reports and browse mocks. To change a mock, change the view model or the dictionary first.

Open any file in a browser. Links are placeholders; the disclosures work (native `details`).

## Constants

| Where | Value | Derived from |
|---|---|---|
| Card column | `minmax(min(100%, 22rem), 1fr)` | one card per row on phones, two across in the 1280 column (three from about 1150 px of content); the same 22rem as the board column of the other mocks |
| Step-up dialog width | at most 28rem | a confirm dialog's reading column: the body line runs on two lines at 375 and 1280; full width minus the gutters below it |
| Receipts table switch | a column of 36rem (576 px at the default text size) | the five columns (date, what, plan, amount, View receipt) fit without breaking "Payment didn't go through" into more than two lines; narrower, each row reflows to a block |
| Receipts amount column | at least 6rem (table layout only) | the widest amount `formatUsd` renders (it drops the cents for whole dollars: "$15.30", "$153") on one line, with room for the "$153.00" form |
| Adult frame placeholder | 145 px at phone width | the frame's phone height (header row 80 + tab row 64 + border 1), `design/screens/app-shell/adult-frame.md` |
| Disclosure glyph turn | 90 degrees, no transition | the open state has a second cue beside the content itself; nothing animates, reduced motion or not |
| Font stack | the system stack | `typography.family.sans` is `'System'`; from `learning-route.css` |

## Measured on the mocks (Chromium)

| Check | Target | Mock |
|---|---|---|
| First screen, billing home at 375 x 844 (parent, one free family) | the plan and its one next step without scrolling (owner item 13: one decision per block) | **met with the frame counted**: the card heading ends at 338 px, the price at 574 and **Get Family Plan** at 769 of 844 (the same at 390) |
| Sideways scroll | none at 320 with 200 % text (section 8) | none on any of the 21 shots (`scrollWidth` equals the viewport), boards included |
| Targets | `touchTarget.min` (64) for every control (section 8) | every button, link, summary and input outside an inert page is at least 64 px tall (checked by script on all 21 renders) |
| Ids | no duplicate id, no dangling `aria-labelledby` / `aria-describedby` / `for` | none on any mock |
| Contrast (WCAG 2.1 AA, computed from the token values) | 4.5:1 text, 3:1 non-text | mode banner `text.secondary` on `surface.sunken` 7.12; disabled button `text.muted` on `surface.sunken` 5.07; links and disclosures `brand.secondaryDark` on paper 7.59; card lines `text.secondary` on paper 8.44; notices `text.primary` on `feedback.infoLight` 12.69, on `feedback.successLight` 13.24; primary button 5.44; test pill 7.12; check glyph `feedback.success` on paper 5.21; the marked card's outline `brand.secondary` on paper 5.20 |

## Decisions this pass takes (each within the spec; the PRs follow them)

- **D1. The renew line is the dictionary's.** The wireframe draws "Renews yearly. Cancel any time"; the offer's renew line is B-7's `console.familyLine` / `groupLine`, "Renews yearly. Cancel from Manage subscription any time." (the B-7 view model, #426). It says "renews yearly" and "cancel any time" as section 4.11 requires.
- **D2. No "(sandbox amount)" after the price.** The wireframe's "(sandbox amt.)" is an annotation; there is no such key. The mode banner above the cards says test mode (section 4.9, OD-2).
- **D3. The wide teacher example has two free classes.** The wireframe's wide drawing shows Add a plan with one licensed and one free class, but the rule (section 4.3 item 6, `billingHomeView`) puts the offer inside the card when only one space can buy. `billing-home-teacher.html` therefore has two free classes; the one-buyable case is `billing-home.html`.
- **D4. The promo form is F-ENT-002's, unchanged.** Inside **Have a code?**: the form labelled `promo.formLabel`, the field `console.promoLabel` with the placeholder `promo.placeholder`, **Apply code** (then **Change code**), and the line under it (`console.promoHint`, or `promo.applied` once a code is in). Applying rewrites every offer's price line (`promoPriceLine`).
- **D5. What "actions off" disables.** With `actionsEnabled` false (no key, live not opened), while offline after the cards loaded, and on the card a checkout return waits on: the buy buttons, **Manage subscription** and **Apply code** are disabled (all three reach Stripe behind the same guard). **Connect a learner**, **Receipts**, **All receipts** and **Contact us** stay enabled: no money moves through them.
- **D6. The legacy no-history line on the card.** A payer card with `legacyNoHistory` shows `receipts.older` ("Older payments are in the receipt email from Stripe.") at its end, the line the receipts page shows in the same case (the view model already exposes the flag).
- **D7. Notice tones.** One look, the console `Notice`: the info tone (`feedback.infoLight`) for every neutral line (past due, already active, the return states, cancelled, "Nothing was changed."), the success tone only for the done line. Never `feedback.danger`, never the learner's amber nudge.
- **D8. The marked card.** During a checkout return the card for `id` has a `borderWidth.thick` `brand.secondary` outline (a shape change, and the notice above names the state), set by `busyCardId` while waiting and kept by `focusCardId` once done.
- **D9. No motion.** The checking glyph is a static `replay`; skeletons do not shimmer; disclosures do not animate.
- **D10. The receipts table switches by its column.** One `table` with explicit ARIA roles (a CSS display change can drop table semantics in some browsers); below a 36rem column each row is a block. On the page the column and the viewport switch together; on a board a narrow column draws the phone form.

## Not drawn here

- The adult frame itself (F-APP-001, drawn in `design/screens/app-shell/`), F-APP-001's grown-up offline page (`shell/offline`, opening a billing URL offline) and the grown-up lock.
- Clerk's reverification UI (a placeholder in `step-up.html`; Clerk owns it) and the Stripe pages.
- B-12's archive confirm lines (section 4.6) and the learner Plan screen's free-lessons lines (F-ENT-003 E3-8, already in `plan-status.md`).
