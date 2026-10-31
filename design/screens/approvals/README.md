# Approvals and learner status (design mocks v2, GX-0)

Spec: `docs/specs/AMENDMENTS-GROWNUP-UX.md` (owner request 2026-10-31). Wireframes: `design/wireframes/console/approvals.md`, `design/wireframes/parent/needs-you.md`. This is the design pass CLAUDE.md section 5 requires before the components of rows GX-1 to GX-5; agents make the mock and the multi-agent review approves it (owner decision 2026-10-12).

Reused, not redrawn: the AdultFrame, buttons, panels and tokens of `design/screens/app-shell/mock/app-shell.css` (loaded first), the shipped consent sheet (`design/screens/transfer/consent-sheet.md`) and the class-scope text (`design/screens/class-moves/README.md`). `mock/approvals.css` adds only the parts below; every value is a token custom property (the two tokens app-shell.css does not carry, `colors.feedback.nudge` and `colors.feedback.info`, are added under their token names). Classes are prefixed `gx-` where app-shell.css already uses the name.

## Files

| Mock | Shows | Shots (360 x 740 full page, 1280 x 800) |
|---|---|---|
| `mock/class-{en,es,ko}.html` | class page (state once GX-W is deployed): attention banner; **Asking to join this class** card (initials, **Needs your OK**, Accept / Not now); action cards with **Needs your OK** for a new device (inline Approve / Deny) and a move out (Review); **In class**, **New**; the nav count | `shots/class-{lc}-{360,1280}.png` |
| `mock/sheet-{lc}.html` | review sheet: New devices, Asking to join this class (initials only, Accept first), Moves out of this class (the same learners and counts as the class page and its banner) | `shots/sheet-{lc}-{w}.png` |
| `mock/popup-{lc}.html` | re-link pop-up (`alertdialog`): Approve, Deny, Later | `shots/popup-{lc}-{w}.png` |
| `mock/home-{lc}.html` | teacher home: the frame's re-link bar, the class row's **{n} need your OK** chip, the nav count; a nav row that scrolls inside itself on a phone | `shots/home-{lc}-{w}.png` |
| `mock/parent-{lc}.html` | parent home: compact Needs you strip with the fold rule (3 items), child status chips (text), class line, the move notice inside its child's card, the week line and squares, never-started card | `shots/parent-{lc}-{w}.png` |

Measured on the shots (Chromium): no page scrolls sideways at 360 in any locale; every button and action chip is at least `touchTarget.min` (64) tall; with the GX-6 rule (`min-width: touchTarget.child`) no short label ("OK", "확인", "Abrir") renders as a circle; on the parent home at 360 x 740 with three items waiting, the first child's name starts at 516 px (en, es) / 495 px (ko) and the week line ends at 638 / 659 / 582 px, inside the first screen.

## Rules the mock fixes

- **Text first.** Every chip carries words; the dot and fill are a second cue. Text is `text.primary` on `feedback.nudgeLight`, `feedback.infoLight`, `feedback.successLight` or `surface.sunken`; amber (`feedback.nudge`) is a border, bar or dot only; `feedback.danger` appears nowhere.
- **Amber means "your action".** Only the action states (new device, move out that waits for this class, asking to join) and the family's own items carry amber; **Waiting for a seat** and **Move waiting** are `surface.sunken`.
- **Action chips are buttons** (`gx-chip-action`, 64 tall) named "{chip}: {reason}" (`aria-label`); the inline buttons are described by the name and the reason. Status chips are text in the heading; the parent's child chips are text too (the strip owns the buttons).
- **An action card** gets a `borderWidth.base` amber border and sits first in the list, soonest-closing first.
- **One state per learner.** The same learners, states and counts on the class page, the banner, the sheet and the home row.
- **The nav shows the number** ("Classes 3", "반 3"); the tab's accessible name says what it counts.
- **Primary first.** Approve before Deny, Accept before Not now, in the card, the sheet and the pop-up.
- **No names off the page.** The home row and the nav dot carry counts only; the sheet shows initials for a learner who is not in the class yet.
- **Korean copy** never attaches a particle to a variable (colon forms: "새 기기 연결 요청: 재한").

## Review record

Multi-agent review (design, accessibility, anti-shame and copy, privacy, Spanish, Korean) runs on the PR that lands this folder; its findings are applied here and in the spec before merge. v2 (2026-10-31) applies the two reviews of PR #917 (spec section 17).
