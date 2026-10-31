# Approvals and learner status (design mocks v1, GX-0)

Spec: `docs/specs/AMENDMENTS-GROWNUP-UX.md` (owner request 2026-10-31). Wireframes: `design/wireframes/console/approvals.md`, `design/wireframes/parent/needs-you.md`. This is the design pass CLAUDE.md section 5 requires before the components of rows GX-1 to GX-5; agents make the mock and the multi-agent review approves it (owner decision 2026-10-12).

Reused, not redrawn: the AdultFrame, buttons, panels and tokens of `design/screens/app-shell/mock/app-shell.css` (loaded first), the shipped consent sheet (`design/screens/transfer/consent-sheet.md`) and the class-scope text (`design/screens/class-moves/README.md`). `mock/approvals.css` adds only the parts below; every value is a token custom property (the two tokens app-shell.css does not carry, `colors.feedback.nudge` and `colors.feedback.info`, are added under their token names). Classes are prefixed `gx-` where app-shell.css already uses the name.

## Files

| Mock | Shows | Shots (360 x 740 full page, 1280 x 800) |
|---|---|---|
| `mock/class-{en,es,ko}.html` | class page: attention banner, action card with **Needs your OK** and inline Approve / Deny, **In class**, **New**, **Move waiting**; the nav dot | `shots/class-{lc}-{360,1280}.png` |
| `mock/sheet-{lc}.html` | review sheet: New devices, Asking to join this class (initials only, Accept first), Moves out of this class | `shots/sheet-{lc}-{w}.png` |
| `mock/popup-{lc}.html` | re-link pop-up (`alertdialog`): Approve, Deny, Later | `shots/popup-{lc}-{w}.png` |
| `mock/home-{lc}.html` | teacher home: the class row's **{n} need your OK** chip; a nav row that scrolls inside itself on a phone | `shots/home-{lc}-{w}.png` |
| `mock/parent-{lc}.html` | parent home: Needs you strip, the move notice, child chips, class line, the week line and squares, never-started card | `shots/parent-{lc}-{w}.png` |

Measured on the shots (Chromium): no page scrolls sideways at 360 in any locale; every button and action chip is at least `touchTarget.min` (64) tall; with the GX-6 rule (`min-width: touchTarget.child`) no short label ("OK", "확인", "Abrir") renders as a circle.

## Rules the mock fixes

- **Text first.** Every chip carries words; the dot and fill are a second cue. Text is `text.primary` on `feedback.nudgeLight`, `feedback.infoLight`, `feedback.successLight` or `surface.sunken`; amber (`feedback.nudge`) is a border, bar or dot only; `feedback.danger` appears nowhere.
- **Action chips are buttons** (`gx-chip-action`, 64 tall); status chips are text in the heading.
- **An action card** gets a `borderWidth.base` amber border and sits first in the list.
- **Primary first.** Approve before Deny, Accept before Not now, in the card, the sheet and the pop-up.
- **No names off the page.** The home row and the nav dot carry counts only; the sheet shows initials for a learner who is not in the class yet.
- **Korean copy** never attaches a particle to a variable (colon forms: "새 기기 연결 요청: 재한").

## Review record

Multi-agent review (design, accessibility, anti-shame and copy, privacy, Spanish, Korean) runs on the PR that lands this folder; its findings are applied here and in the spec before merge.
