# Learner entry points: Welcome row, Profile row, dashboard card, PIN screen without a PIN (design mock v1, for A-7)

Wireframes: `design/wireframes/onboarding/welcome-personas.md` (Panels A to D), `design/wireframes/parent/grown-up-home-card.md` (Panels A to D), `design/wireframes/billing/plan-status.md` (Open billing only) · spec §3.6, §3.9 (`openGrownUpArea`, `GrownUpArea`), §3.12, §3.16 · mock: `mock/welcome.html`, `mock/learner-entry.html` · shots: `shots/welcome-320-first.png`, `welcome-375.png`, `welcome-1280.png`, `welcome-320-text200.png`, `learner-entry-375.png`, `learner-entry-1280.png`

Web only, behind `flags.grownUpHomeEnabled`. Native builds and flag off: today's screens, nothing added (OD-6).

## Welcome (`WelcomeScreen.tsx`)

```
            [Hoya waving 180]
            Hi! I'm Hoya.                 unchanged
   Want to learn Korean letters ...       unchanged
 [[            Let's start            ]]  hero, unchanged size and place
      ( I already have progress )         ghost, unchanged
 ------------------------------------     borderWidth.thin border.subtle, spacing.xs above
       Here to support a learner?         text.secondary, size.body
 ( Parent or caregiver ) (  Teacher  )    ghost md (64), side by side when both fit, else stacked (D10)
   learner.welcome.trust (unchanged)
```

| Panel | Row |
|---|---|
| A · first visit | lead line and the two buttons → `/signin?persona=parent` / `?persona=teacher`, same tab |
| B · last persona remembered | one ghost button **Continue as teacher** (or **Continue as family**) → `/signin`, and a text link **Someone else** (64 tall) that swaps in Panel A's row |
| C · offline | the buttons stay with their labels, disabled (`surface.sunken`, `text.muted`, opacity 0.6), and "Needs the internet" under them in `text.secondary` `size.bodySm`, the buttons' description; they re-enable on `online` |

Let's start ends at 466 px at 320 x 568: the row never pushes it out of the first view.

## Profile row (`ProfileScreen.tsx`, end of Profile)

```
 ... Profile, unchanged ...
 +------------------------------------+
 | [parent]  Grown-up home         >  |   card row, touchTarget.min; title semibold, line size.caption text.muted
 |           Your family, classes     |
 |           and billing              |
 +------------------------------------+
   (F-FEEDBACK-001 row goes here)
        ( Grown-up zone )                  the existing ghost button, unchanged
```

- Directly above the existing zone button, no new heading (D11). `openGrownUpArea({ via: 'profile' })`.
- Accessible name: title and line, plus "(PIN required)" on a gated device (`caregiver.gated`).
- Self-only device: the zone button reads "Account & backup" and the row title **Account home** (D9).
- Offline: the row is disabled (title and glyphs at 0.6 opacity) and its line becomes "Needs the internet", which stays at full contrast.

## Dashboard card (`ParentDashboardScreen.tsx`, top)

```
 [<]  Family Dashboard                      unchanged header
      Read-only — learners on this device.
 +------------------------------------+
 | Grown-up home                       |   size.prompt bold (h2)
 | Your family, classes and billing.   |   text.secondary
 |                          [[ Open ]] |   primary md, right-aligned
 +------------------------------------+
 ... local learner cards, Privacy card, unchanged (offline) ...
```

Offline: Open disabled with "Needs the internet" right-aligned above it. `openGrownUpArea({ via: 'dashboard' })`.

## Plan screen: Open billing (web, flag on)

The Plan screen itself is F-BILL-002's (B-9, PR #424, mock `design/screens/billing/plan-status.md` once it merges): status heading, lines, Plan details, the caption "Plans and receipts are on the billing page for grown-ups." and **Open billing** (`Button` tone `secondary` size `lg` full width, hint "Opens the billing page"), then **Back to journey**. A-7 changes only two things, drawn in `learner-entry.html`:

```
  Plans and receipts are on the billing page for grown-ups.     caption, unchanged
 [[            Open billing            ]]     online: PIN gate, then openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing }), same tab
 [[  Open billing (disabled)           ]]     offline: disabled, label kept
           Needs the internet                 its description (aria-describedby), text.secondary size.bodySm
 [[           Back to journey          ]]     unchanged
```

- **Online**: the PIN gate first (destination `Billing`, unchanged), then `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })` in **the same tab** (spec section 3.6), so the unlock is in the tab that opens billing. No "Open {url} in a browser" line on this path.
- **Offline** (`navigator.onLine` false): the button is disabled with its label and "Needs the internet" under it as its description; it re-enables on `online` (spec sections 3.6 and 3.12), as on Welcome, the Profile row and the dashboard card.
- **Which source wins.** Two F-BILL-002 sources disagree with F-APP-001 here: `design/wireframes/billing/plan-status.md` (and F-BILL-002 B-9b) name `via: 'paywall'`, and say offline Open billing leads to the grown-up offline page. F-APP-001 section 3.6 / 3.12 and the shipped telemetry schema (`packages/content-schema/src/schemas/app-shell.ts`: `via` is `profile | dashboard | plan | lock`) win: `via: 'plan'`, and the button is disabled offline. Recorded in the spec's review log for F-BILL-002 to align.

## PIN screen, destination `GrownUpArea`, no PIN stored (built by A-6, #404)

Drawn as `PinEntryScreen.tsx` renders it since A-6: the close button and the verify title ("Grown-up zone"), the line "This device has no grown-up PIN. Sign in on the grown-up page instead.", **Continue** (primary, large, full width) to the grown-up page, and **Cancel** (ghost). No PIN pad, no Forgot PIN, never a create step. **No change is proposed**; A-7 only adds the entries that lead here.

## Tokens

| Part | Tokens |
|---|---|
| Divider and lead | `borderWidth.thin` `border.subtle`, padding-top `spacing.md`; lead `text.secondary` `size.body` |
| Persona buttons | design-system `Button` tone `ghost` size `md`: `borderWidth.base` `brand.primary`, `brand.primary` label, `radii.pill`, `touchTarget.min` |
| Someone else | text link `brand.primaryDark` semibold, `touchTarget.min` tall |
| Profile row | design-system `Card` (`surface.paper`, `radii.lg`, `shadows.card`, padding `spacing.lg`); glyph `parent` 24 `text.secondary`, `arrow-right` 24 `text.muted` (the placement row's pattern) |
| Dashboard card | `Card`; title `size.prompt` bold; line `text.secondary`; Open `Button` primary md |
| Disabled | `Button` disabled (unchanged look) |
| Plan screen Open billing | `Button` tone `secondary` size `lg` full width (F-BILL-002's); offline: disabled, "Needs the internet" `text.secondary` `size.bodySm` under it |
