# Access screen (BR-6)

Wireframe: `design/wireframes/browse/access.md` · Spec: F-BROWSE-001 §4.3 (Access screen), §8 · Mock: `mock/access.html`, `mock/access-states.html` · Shots: `shots/access-375.png`, `-1280.png`, `-320-text200.png`, `shots/access-states-375.png`

It shows **no lesson, title or card**. It is the root's only screen when no pass is active, so it has no Close and no back.

## Layout (one reading column, centred, `layout.maxWidth.reading`)

| Part | Look |
|---|---|
| Hoya | `waving`, 96, centred, `spacing.xl` from the top, `spacing.md` above the title |
| Title | "This page is for parents and teachers." Heading `title` (28) bold, centred, `accessibilityRole="header"` |
| Line | by source (below), Body (18) `text.secondary`, centred, `spacing.md` above |
| Primary | `Button` primary `lg` (80 tall), full width (capped at 26rem from the regular class), `spacing.xl` above |
| Secondary | `Button` ghost (64), `spacing.sm` above |
| Offline line | account and unknown sources only: "Grown-up pages need the internet." Body (18) `text.secondary`, `spacing.md` above, after the buttons |

## By source

| Source | Line | Primary | Secondary |
|---|---|---|---|
| gate (an expired gate pass) | Your time in the grown-up area ended. | Back to the grown-up area → `/?gate=browse` | Back to the app → `/` |
| account (an expired account pass, or `lastPersona` set) | Open lessons again from your account. | Open lessons from my account → `/parent` or `/teach/home` | Sign in → `APP_ROUTES.signIn` |
| unknown | On a family device, open them from the grown-up area. Parents and teachers can also open them from their account. | Back to the grown-up area → `/?gate=browse` | Sign in |

**Until BR-12b ships** (no `gate=browse` boot intent):
- **gate**: the line gains "Then open the grown-up area again." and the only button is [[ Back to the app ]].
- **unknown**: the primary becomes [[ Back to the app ]] and Sign in stays as the secondary. The line is the spec's line unchanged: it already says to open lessons from the grown-up area, and "again" would be wrong for a visitor who was never there.

The spec names this form for the gate source only. The unknown source uses the same `/?gate=browse` target, so it takes the same primary (README decision 4).

## Accessibility

- One header (the title).
- The line is not a live region: the screen is a page, announced by its title on load.
- Buttons are at least 64 tall; at 200 % text their labels wrap inside them (`access-320-text200.png`).
- Every account target is a grown-up page behind Clerk and F-APP-001's grown-up lock (spec §4.3), so a child on a shared device reaches nothing through this screen.
