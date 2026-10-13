# Step-up: confirm it's you before money moves or a receipt opens (screen spec v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` sections 4.4 (OD-7), 4.10, 4.12, 8, 9 · wireframe `design/wireframes/billing/step-up.md`
Mock: `mock/step-up.html` (board, five items) · shots `shots/step-up-375.png`, `-1280.png`, `-320-text200.png`
Code: B-8b wraps checkout and portal in Clerk's `useReverification` (`@clerk/clerk-react` 5.x); B-8c wraps the receipt link the same way. The dialog opens when the Worker answers `403` with Clerk's reverification hint and our code `reverify_required` (sign-in older than `STEP_UP_MAX_AGE_MIN`, 10 minutes, or no `fva`).

## Anatomy

- The page behind stays where it was, dimmed by `surface.overlay` and `inert` (no focus, no clicks, hidden from assistive technology).
- The dialog (`role="dialog"`, `aria-modal="true"`, labelled by its title, described by its body): `surface.paper`, `radii.lg`, `shadows.card`, padding `spacing.xl`, at most 28rem wide, centred, `spacing.md` between parts.
  1. Title (h2) "Confirm it's you" (`stepUp.title`), `size.prompt`.
  2. Body "Before a payment, a plan change or a receipt, sign in again." (`stepUp.body`).
  3. Reason "This keeps payments safe on a shared device." (`stepUp.reason`), `text.secondary`, `size.bodySm`.
  4. **Continue** (primary, full width) then **Not now** (secondary, full width). This is a second primary button on the page while the dialog is open; the page behind is inert, so the dialog's one way forward is the only active primary.

## States

| # | State | Drawn |
|---|---|---|
| 1 | asking | over the billing home after **Get Family Plan**; focus on **Continue** |
| 2 | verifying | Clerk's own reverification UI (password, code or provider) is open; the dialog's buttons are disabled. A dashed placeholder stands for Clerk's UI, which Clerk owns |
| 3 | unavailable | Clerk unreachable, offline, or the retried request refused again: the body is replaced by "Can't confirm right now. Try again in a moment." (`stepUp.unavailable`, `role="status"`) and only **Not now** remains, focused. No second prompt, no loop |
| 4 | cancelled or failed | the dialog closed; focus back on the button that was pressed; "Nothing was changed." (`stepUp.cancelled`) as an info note above the cards |
| 5 | asking over the receipts page | after **View receipt**: the blank tab is already open (opened inside the tap); a cancel closes it |
| — | success | the dialog closes and the original request runs once (checkout, portal or receipt link); no extra message |

A sign-in completed in this tab less than 10 minutes ago never shows the dialog.

## Accessibility

- Focus is trapped inside the dialog while it is open; Escape is **Not now**; on close focus returns to the pressed button.
- The title and body are the dialog's accessible name and description; the unavailable line is announced (`role="status"`).
- Both buttons are at least `touchTarget.min` tall; at 320 px with 200 % text the dialog wraps inside the viewport with no sideways scroll.
