# Console screens: inline rename, school administrators, administrator invite (design mocks v1)

Spec: `docs/specs/AMENDMENTS-SEATS-ADMINS.md` (header, sections 5.3, 6.6, 9.3, 9.4 and 10). This is design row **SA-0b**: the agent design pass that CLAUDE.md section 5 requires before SA-3 and SA-4 build a component (no component without a mock, no mock without a wireframe), approved by multi-agent review on the F-SPACE-002 T-0b precedent (#472).
Wireframes: `design/wireframes/console/rename-inline.md`, `admins-panel.md`, `admin-invite-accept.md` (new); `school-admin.md` and `design/wireframes/billing/billing-home.md` (updated).
Built by:
- **SA-3**: the inline rename on the family home, the family page, the class page, the school page title and class rows, and the Settings Name row; `console.start.nameLater` on `/start` → `rename-inline.md`. The admin's read-only school card on the billing page → `design/screens/billing/billing-home.md`, boards 22 and 23 of `billing/mock/billing-home-states.html`. The school page's unlicensed, at-cap and over-cap lines are drawn in `design/wireframes/console/school-admin.md` (text in the existing note slot of the licence block).
- **SA-4**: the Administrators panel, the one-time invite box with step-up, revoke, remove, stop being an administrator, history, school Settings for an administrator → `admins-panel.md`; the accept page `/account/invite` → `admin-invite-accept.md`.

## What is here

| File | What it fixes |
|---|---|
| `rename-inline.md` | where Rename sits on each surface, the open field (label, hints, openMoves, error line, Save, Cancel), keys, focus, every state |
| `admins-panel.md` | the panel for the owner and for an administrator, the invite box, step-up, the three confirm sheets, history, Settings as an administrator |
| `admin-invite-accept.md` | `/account/invite`: signed out, sign-up, locked, loading, preview, accepting, every refusal, no stash, done |
| `mock/console.css` | the sheet of this pass, linked after `../../app-shell/mock/app-shell.css` (tokens, frame, board) and `../../app-shell/mock/display-nav.css` (the current frame: Aa, Learner app exit, PageBack) |
| `mock/rename-inline.html` | 27 boards (two with the adult frame) |
| `mock/admins-panel.html` | 27 boards: the school page as owner and as administrator (with the frame), then the states |
| `mock/admin-invite-accept.html` | 19 boards |
| `shots/` | each mock in Chromium at 320 and 1280, and at 320 with the browser text size at 200 % (`-320-text200`), full page, 1x (boards) |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it (`--spacing-xl` is `spacing.xl`). `console.css` copies three tokens the app-shell sheets do not carry (`colors.feedback.successDark`, `shadows.modal`, `radii.xl`) and redefines none. Every `var()` in the three sheets and the HTML was checked to resolve in Chromium. No colour, spacing or radius literal; no emoji; no `feedback.danger`; no motion.
- **Units.** Text in rem, the console switch in em (45em, F-APP-001 section 3.8). The rename field switches its layout with a **container query** (`36rem`), so the same field is right in a narrow class row or a board column and on a wide page title.
- **Words.** Every drawn UI string is an English dictionary value (`packages/i18n`) or a key of the amendment's section 9, word for word. Nine strings had no row; this pass adds them to section 9.4 with es and ko drafts (below). The mocks were made by a throw-away generator that is not committed (as for the reports, billing and browse mocks).
- **Annotations.** Grey dashed boxes and monospace labels are board notes, not UI. A dashed box stands for an unchanged part of a page.
- **Fixture.** Tue Oct 20, 2026. Maple School: owner Ms Park; Mr Lee (administrator, teaches Sunday Class B, so `staysTeacher`); Dr Cho (administrator, no class, so she would leave the school); Ms Han (teacher). The invite token is a made-up 43-character base64url example.

## Constants

| Where | Value | Derived from |
|---|---|---|
| Rename input, widest column next to Save and Cancel | 28rem | 40 characters of `size.bodyLg` bold measure about 27rem, so a full-length name shows whole |
| Rename layout switch | container width 36rem | the input column plus Save and Cancel at `size.body`: below it, the hints go between the input and the buttons |
| Step-up dialog width | 28rem | the billing step-up dialog (`design/screens/billing/README.md`), the same `StepUpDialog` |
| Drawn sheet backdrop height | 24rem | design board only, not UI |

## New strings (no row in section 9)

Added to `docs/specs/AMENDMENTS-SEATS-ADMINS.md` section 9.4 by this pass, with es and ko drafts written to the F-I18N-001 section 3.10 style guide; SA-4 lands them with the other 9.4 rows and its fix-stage review may still improve the drafts.

| Key | en | Why |
|---|---|---|
| `console.admins.invite.stepUp.body` | Before you make an invite link, sign in again. | the billing body names "a payment, a plan change or a receipt", which is wrong here |
| `console.admins.invite.stepUp.reason` | This keeps the school's rosters safe on a shared device. | the billing reason names payments |
| `console.admins.revoked` | Invite revoked. The link no longer works. | the polite line after Revoke |
| `console.admins.removed(name)` | {name} is no longer an administrator. | the polite line after Remove |
| `console.admins.left(school)` | You're no longer an administrator of {school}. | the line on the teacher home after Stop being an administrator |
| `console.admins.actionFailed` | Couldn't save that change. Try again. | Revoke, Remove or Stop failed (only `invite.failed` existed) |
| `console.settings.ownerOnly` | Only the school's owner can change these settings. | school Settings as an administrator (section 6.6: read-only values) |
| `console.settings.privacy.anonymizeOn` | Rosters show initials. | the read-only value of Anonymize roster |
| `console.settings.privacy.anonymizeOff` | Rosters show names. | the same, off |

## Decisions taken in this design pass

- **D1. Rename is text only.** A secondary text button "Rename" at `touchTarget.min`, never an icon alone; its accessible name `console.rename.a11y(name)` starts with the visible word (WCAG 2.5.3).
- **D2. The field replaces the title; the heading stays.** While the field is open the h1 (or the family's h2) stays in the page as visually hidden text with the stored name, so the page outline and a screen reader's heading list do not change.
- **D3. Save is `aria-disabled`, not `disabled`,** while the value is unchanged or invalid: it stays in the tab order and the reason is the field's description (the error line comes first in `aria-describedby`). Enter on an invalid value does nothing.
- **D4. One label everywhere.** The field's label is `console.rename.label` ("Name") on every surface; in Settings the block heading is the same word.
- **D5. Errors use text and weight, never colour.** The error line is `text.primary` semibold and the input border thickens (`borderWidth.thick`, `text.primary`); never `feedback.danger`. The input border is `border.shape` (4.55:1 on paper) so the field is visible against the page (WCAG 1.4.11; `border.strong` is 1.95:1).
- **D6. A class row holds one task.** While a row's field is open, its Change or Assign teacher and Open roster buttons step aside; Save or Cancel brings them back with focus on the row's Rename.
- **D7. Offline and 429 lines** reuse `caregiver.retry.offline` (named by section 5.3) and `caregiver.retry.tooManyAttempts`.
- **D8. Archived spaces show no Rename.** Settings says `console.rename.archived` in the Name row instead; a `422 archived` after Save (archived in another tab) shows the same line in the open field.
- **D9. The administrator sees no Manage billing** on the school page (the button would open a card they cannot act on); Billing stays in the frame's tab row and shows the read-only card.
- **D10. The step-up dialog is the billing one with two admin lines** (`stepUp.title`, `.cta`, `.cancel`, `.cancelled` and `.unavailable` are reused as they are).
- **D11. The invite box.** A raised paper box with a `brand.secondaryDark` border, the whole link in monospace on `surface.sunken`, selectable, wrapping anywhere; the lock glyph (decoration) before the warning; **Copy link** and **Close** (`common.buttons.close`); a polite status line. It sits first in the panel and takes focus on its link. It is never drawn again after Close.
- **D12. The count counts administrators only** (`count(n, 2)`); an open invite holds a place, so one administrator and one open invite show `full(2)` with "1 of 2 added".
- **D17. Owner-only identity lines.** Each admin's verified email sits under the name in `text.secondary` `size.bodySm`; the new-admin notice is an info note (`feedback.infoLight`) above the panel with **Remove** and **Got it**, never a warning colour. The invite page's "Signed in as" sits in a sunken strip between Invited by and the consent block, with **Use another account** beside it.
- **D18. `503 identity_not_configured`** at accept reads as `console.cantReach` with **Try again** (it is the service, not the person; the invite stays open).
- **D13. History is closed by default and hidden while empty.** Newest first, at most 20 lines, names at request time.
- **D14. After Stop being an administrator** the page goes to the teacher home with `console.admins.left(school)` in both outcomes: section 6.6 says "the school page as a teacher", but a teacher member cannot open the school page (section 6.5 matrix, first row), so the school page would answer "This school isn't yours to manage.". Section 6.6 is corrected in this PR.
- **D15. The accept page uses the `/start` column**, not the adult frame: an invitee may hold no space, so the frame's tab row would be empty. Its tab title is `console.adminInvite.pageTitle` in every state, never the school's name.
- **D16. School Settings for an administrator** (section 6.6): consent mode as the current option's existing label (`console.settings.consent.*`), Anonymize roster as its label and `anonymizeOn` / `anonymizeOff`, one `ownerOnly` line, Remove only where `canRemove`; no danger zone.

## Measured on the mock (Chromium)

- No sideways scroll on any render (320, 375, 1280, and 320 at 200 % text), no duplicate id, no dangling `aria-labelledby`, `aria-describedby` or `for`. No control under 64 px tall, except the shipped adult step's checkbox inside its 64 px label (drawn unchanged on the invite page's sign-up board).
- Contrast from the token values: `text.secondary` on paper 8.44 and on sunken 7.12 (hints, the openMoves line, the full line); `text.muted` on paper 6.01 (count, licence lines); the aria-disabled Save, `text.muted` on sunken, 5.07; History link `brand.secondaryDark` on paper 7.59; primary 5.44; info and done notes 12.69 / 13.24; the check glyph on the done note 6.21; the invite box border 7.59 and the rename input border 4.55 (non-text, 3:1 needed); the focus ring 4.06 on canvas.

## Notes for the language review (SA-3, SA-4 fix stages)

- ko `console.admins.removed(name)` "관리자에서 뺐어요: {name}" and `left(school)` "관리자를 그만뒀어요. {school}" follow the colon and period forms of `removeAsk` and `done(school)`; a reviewer may prefer one form for both.
- `console.settings.privacy.anonymizeOn` / `Off`: es "listas" and ko "명단" for rosters; check them against the console glossary's roster term.

## Review

Author pass (design, accessibility, copy, privacy, against sections 5.3, 6.6, 9 and the wireframes), done before the PR; each finding is fixed in this PR:

- Design: on phones the hint lines first fell under Save and Cancel, away from the field; the field now orders input, hints, buttons below a 36rem column and puts the buttons beside the input above it (a container query, so a class row behaves like a phone). A class row kept its teacher and roster buttons under an open field (two tasks at once); they now step aside (D6). The first owner wireframe drew **Invite an administrator** with one admin and one open invite, which section 6.6 forbids (`admins + open invites < 2`); corrected, and a separate board draws that state with `full`.
- Accessibility: the rename input border (`border.strong`, 1.95:1) failed WCAG 1.4.11; it is `border.shape` (4.55:1). Repeated `id`s on the two school page boards and a heading that pushed the page sideways at 320 with 200 % text (one long word) are fixed. The pages the boards hold carry no second `main`.
- Copy: the billing step-up body and reason name payments, wrong for an invite: two strings are added (D10). Five more lines had no row (revoked, removed, left, actionFailed, and the Settings values); every drawn string is now a dictionary value or a section 9 row.
- Spec: section 6.6 sent an administrator who stops but still teaches to the school page, which a teacher member cannot open; corrected to the teacher home (D14).
- Billing board: board 8 still said "School owner or admin" and board 9's free school read "18 of 20 students" (a free school now holds 50, SA-D3); both corrected.
- Spec alignment: the pass was rebased onto #746's second adjudication (`7fd1b763a`) and draws what it added: each admin's verified email (owner only), the new-admin notice with Remove and Got it, Signed in as with Use another account, `revokeKeep` on the revoke sheet, `full(max)`, the wider `can` and `leave` lines, `emailUnverified`, `history.someone`.
- Privacy: the invite token is shown only in the one-time box; no drawn address, title or label carries it, a name, an email or an id.

The independent multi-agent review on the PR (CLAUDE.md section 5) approves this pass; its findings and the fixes are added here in the fix stage.
