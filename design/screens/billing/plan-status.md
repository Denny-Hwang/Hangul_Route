# Plan screen: the learner's plan, status only (screen spec v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` sections 4.7, 4.8, 4.12, 6.2, 6.3, 8 · wireframe `design/wireframes/billing/plan-status.md`
Mock: `mock/plan-status.html` · shots `shots/plan-status-375.png`, `-1280.png`, `-320-text200.png`
Code: `apps/mobile/src/screens/paywall/PaywallScreen.tsx` (route key stays `Paywall`), view models `planView` and `planCardView` in `apps/mobile/src/logic/paywall.ts`, the billing hand-off in `apps/mobile/src/platform/billing-handoff.ts`

## Anatomy (top to bottom, `Screen tone="canvas" scrollable`)

1. **Top bar** (`touchTarget.min` high). The heading "Plan" (`caregiver.plan.title`, `typography.size.prompt`, bold, centred) comes first in reading order. Its accessible label is the summary, `a11y.planStatus(name, state word)`: "Mina: Free plan." or "Mina: Full route." (state words `learner.profile.plan.free` / `.fullRoute`). This makes the summary the screen's first accessible element (section 8). The back button (`arrow-left` 28, `a11y.goBack`) sits over the bar's left edge, so it is still the first control in keyboard order.
2. **Hoya** 96, centred: `idle` on the free plan, `cheering` on the full route and when covered. Decoration only.
3. **Title** (`Heading level="title"`, centred): the state sentence of section 4.7 in the device's audience.
4. **Lines** (`Body tone="secondary"`, centred):
   - free: the free slot `<FreePlanLines />`. Until F-ENT-003 E3-8 fills it (and whenever its switch is off), it holds `caregiver.plan.free.open`, "Stage 1 is always free."
   - full route: `full.fromFamily` (source family) or `full.noSource` (no source), then the guidance slot `<PlanGuidanceLine />`, empty until E3-8.
   - covered: `covered.note`.
   Neither slot ever holds an offer, a price, a button, a link, a promo hint or a terms line.
5. **Web only** (`Platform.OS === 'web'`, every state), `spacing.xl` above:
   - the caption `openBilling.caption` (`Body size="sm" tone="secondary"`, centred);
   - **Open billing** (`Button tone="secondary" size="lg" fullWidth`, hint `openBilling.a11yHint`);
   - on a failed hand-off, one line `openFailed(url)` (`Caption tone="muted"`, centred).
6. **Back to journey** (`Button tone="primary" size="lg" fullWidth`), `spacing.md` above it on web and `spacing.xl` on native.

## States (board order)

| # | Where | Title | Lines | Web block |
|---|---|---|---|---|
| 1 | web, free, family | "Mina is on the free plan." | "Stage 1 is always free." | caption (family) + Open billing |
| 2 | web, free, self | "You're on the free plan." | "Stage 1 is always free." | caption (self) + Open billing |
| 3 | web, full route, family source | "Mina has the full route." | "From your family's Family Plan." | caption + Open billing |
| 4 | web, full route, no source, self | "You have the full route." | "Everything is open." | caption (self) + Open billing |
| 5 | web, covered | "Mina is covered by Sunday Class A." | "Everything is open while they are in it." | caption + Open billing |
| 6 | web, hand-off failed | as 1 | as 1 | caption + Open billing + "Open https://hangulroute.com/teach/billing in a browser." (offline: "Opening billing needs a connection." first) |
| 6b | web, back from a correct PIN | as 1 | as 1 | caption + Open billing (focused) + "PIN accepted. Tap Open billing again." |
| 7 to 9 | native (iOS, Android) | as on the web | as on the web | none |

- **Covered on the web** (state 5). The wireframe's "Other states" table leaves the covered row's web cell empty. Sections 4.7 ("Web only: under the state ...") and 11 ("every state on `web` ... web renders one Open billing button") show it on every web state, and the spec decides. A covered learner's grown-up can still read the class or school card on Billing.
- **No active profile**: `caregiver.plan.learnerFallback`, "Your learner", stands in for the name.
- **Offline**: the state the tier store gives (7-day grace; free when nothing is cached). Nothing on the screen claims a purchase failed.
- **Covered with no space name**: `covered.sourceFallback`, "the class".

## Open billing (web only)

- The press goes through the grown-up gate with destination `Billing`. While a grown-up session is open, or on a self-only device without a PIN, the gate opens directly and the billing page opens inside the same tap.
- Otherwise the PIN screen comes first. A correct PIN returns to this screen, which shows "PIN accepted. Tap Open billing again." (`caregiver.plan.gateDone`) and moves focus to Open billing. It does not open the tab by itself: a browser may block a tab opened outside a tap (`HAND_OFF_NEEDS_TAP` in `platform/external-link.web.ts`, the rule Sources follows). The grown-up session is open now, so the next press opens the billing page inside that tap. A cancelled PIN opens nothing.
- B-9 opens today's `consoleBillingUrl()` in a new browser tab, through the same safe hand-off that Sources uses (`openExternalUrl`). That hand-off clears the opener and reports a blocked tab. B-9b changes only the target: with `flags.grownUpHomeEnabled` on, `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })` in the same tab. No tab opens, so back from the PIN billing opens by itself (no "Tap Open billing again"); a PIN older than 2 minutes, or one just created on the gate, is asked once more on the grown-up area's PIN screen. Offline with the flag on, Open billing keeps its label, is disabled (`surface.sunken`, `text.muted`, opacity 0.6, as `design/screens/app-shell/learner-entry.md` draws it) and has "Needs the internet" under it in `text.secondary` `size.bodySm` as its description; it re-enables on `online`.
- If the tab could not open (a pop-up blocker), the line "Open {url} in a browser." shows under the button; offline, "Opening billing needs a connection." (`caregiver.plan.needsConnection`) comes first. Pressing Open billing again opens it directly, because the grown-up session is now open. The line sits in a polite live region, so it is read out as it appears.
- `paywall.console_opened { state }` is sent only when the billing page actually opened.

## Profile plan card (every tier)

`Card padding="md"`: tone `sunken` (free) or `success` (full route); a row with the title and note on the left and the pill on the right; then **Plan details** (`Button tone="secondary" size="md"`).

| Tier | Title | Note | Pill |
|---|---|---|---|
| free | "Free plan" | "Stage 1 is free. More stages are on the way." | "Free" (neutral) |
| full route, with a source | "Full route" | "Everything is open, from {source}." | "Active" (success) |
| full route, no source | "Full route" | "Everything is open." | "Active" (success) |

- **Plan details** opens the Plan screen straight away, with no PIN, on every tier and on every device. Its accessible label has no "PIN required".
- The card never says "Premium", "unlock" or "buy" (section 4.8, rule 2).

## What the code must never render

- **Anywhere on the learner side**: a price or amount, an offer card, the bullets list, a promo hint, the "buy it on the web console" and "store update" lines, or a terms line. The section 6.4 keys are deleted in B-9.
- **On native**: no button that opens a URL. No string from the deny list `web`, `website`, `browser`, `hangulroute.com`, `billing page`, `console` (or its `es` and `ko` forms).

## Accessibility

- The summary is the first accessible element (see Top bar). The state sentence follows as a heading, with its lines after it.
- Open billing is a button. Its hint "Opens the billing page" is `accessibilityHint` on native. On the web it is the button's `aria-describedby` text, because react-native-web drops `accessibilityHint`.
- Every state is in words; Hoya's pose and the card tone are decoration only.
- Every control meets `touchTarget.min` (back button, Plan details) or `touchTarget.child` (`lg` buttons).
- At 320 px wide with 200 % text there is no sideways scroll (`shots/plan-status-320-text200.png`).
