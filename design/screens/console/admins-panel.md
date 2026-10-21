# School administrators: the panel, the one-time invite, the confirm sheets, history (design mock v1, for SA-4)

Wireframe: `design/wireframes/console/admins-panel.md`, `school-admin.md` · spec `docs/specs/AMENDMENTS-SEATS-ADMINS.md` sections 6.1 to 6.6, 9.4 · mock: `mock/admins-panel.html` (28 boards) · shots: `shots/admins-panel-320.png`, `-1280.png`, `-320-text200.png`

No new URL: the panel is part of the school page `/teach/space?id=<school>`, under **Invite a teacher** and above **This week**.

## Anatomy

```
 Administrators                         1 of 2 added     h2 (size.bodyLg) + console.admins.count, text.muted
 +----------------------------------------------------+
 | Ms Park · owner                                     |   one list (ul), rows touchTarget.min tall
 | Mr Lee · admin · joined Oct 3            ( Remove ) |   owner view only: Remove, a11y "Remove Mr Lee"
 |   lee@example.org                                   |   owner only: the verified sign-in email, text.secondary, size.bodySm
 +----------------------------------------------------+
 [ Invite made Oct 18 · ends Oct 25, 2026  ( Revoke ) ]  dashed border.strong box per open invite (owner only)
 A school can have 2 administrators besides its owner.   console.admins.about(2), text.secondary
 (( Invite an administrator ))  |  [ All 2 places are taken. ... ]   primary while places are free, else the full line (sunken)
 {polite status line}                                    revoked, removed, actionFailed, invite.failed, stepUp.cancelled
 > History                                               disclosure, closed, hidden while empty (owner only)
```

- The panel is a `section` labelled by its h2, `surface.paper`, `border.subtle`, `radii.lg`, padding `spacing.lg`, `spacing.sm` between parts (the school page's block style).
- The names are `semibold`; the role and the join day follow in regular weight (`ownerRow`, `adminRow`).
- An administrator's own row has the `surface.canvas` fill (a second cue; the row's words are the same).
- Emails show for the owner only; an administrator's view never carries them (section 6.3).

## Views

| Board | View | Shows |
|---|---|---|
| 1 | owner, one admin, no open invite (with the frame) | the whole school page: PageBack, title with Rename, licence with Manage billing, Invite a teacher, the panel with **Invite an administrator** (the page's only primary), This week, Classes with Rename, New class, the footer |
| 2 | administrator (with the frame) | no Manage billing (D9); the list without buttons; **Stop being an administrator** (secondary); no invites, no history |
| 3 | owner, nobody yet | `count(0, 2)`, the button, no History |
| 4 | owner, one admin + one open invite | the invite row with Revoke; `full(2)` instead of the button (an open invite holds a place) |
| 5 | owner, two admins, one joined 2 days ago | the new-admin notice above the panel (`newAdmin(name, email)`, info note, **Remove** and **Got it**); emails under both names; `full(2)`; History open, with a `history.someone` line |
| 26 | archived school, owner | **Invite an administrator** hidden (`422 archived`); **Remove** on each admin row and **Revoke** on each open invite stay, so the owner can take access away while classes stay live |
| 27 | school Settings as an administrator | Name with Rename; consent mode and privacy as read-only text; `ownerOnly`; Remove only on teachers (`canRemove`); no danger zone |

## Invite flow

| Board | Step | Shows |
|---|---|---|
| 6 | step-up asking | `StepUpDialog` (centred, 28rem, `shadows.card`): "Confirm it's you", `admins.invite.stepUp.body`, `.reason`, **Continue** (primary), **Not now**; focus on Continue |
| 7 | verifying | Clerk's reverification owns focus (placeholder) |
| 8 | unavailable | `stepUp.unavailable` (`role="status"`), only Not now |
| 9 | cancelled | the panel unchanged, `stepUp.cancelled` in the status line |
| 10 | made | the one-time box in the panel after the admin list, above the open invites; the new open invite listed; `full` |
| 11, 12 | copy | `invite.copied` / `invite.copyFailed` in the box's status line |
| 13 | closed | the box gone for good; the open invite stays |
| 14 | failed | `invite.failed` in the status line |

The box (D11): `invite-url` in `family.mono` `size.bodySm` on `surface.sunken`, selectable (`user-select: all`), `overflow-wrap: anywhere`; the warning with the lock glyph (`text.primary`, decoration); `invite.once(date)` in `text.secondary`; **Copy link** and **Close**; a polite status line. Border `borderWidth.base` `brand.secondaryDark`, `radii.lg`, `shadows.card`. The URL lives in component state only: never in storage, a URL, a title or telemetry.

## Confirm sheets (`ConfirmSheet`, AMENDMENTS-DISPLAY-NAV section 8)

Bottom sheet on phones, `radii.xl` top corners, `shadows.modal`, `role="alertdialog"`; **Cancel** first and focused, the verb second as the primary; no red.

| Board | Title | Message | Verb |
|---|---|---|---|
| 15 | `revokeAsk` | — | `revoke.cta`; the dismiss is `revokeKeep.cta` ("Keep it"), not Cancel |
| 16 | `removeAsk(name, school)` | `removeNote.staysTeacher` | `remove.cta` |
| 17 | `removeAsk(name, school)` | `removeNote.leaves` | `remove.cta` |
| 21 | `leaveAsk(school)` | `leaveNote.staysTeacher` | `leave.cta` |
| 22 | `leaveAsk(school)` | `leaveNote.leaves` | `leave.cta` |

After: board 18 (`revoked`), 19 (`removed(name)`), 20 (`actionFailed`, list unchanged: a network failure or a `5xx` only), 28 (`404`, `403` or `409`: the panel reloads with the current list, focus on its h2; a viewer who lost the admin role goes to their grown-up home), 23 (`left(school)` as a done note with the check glyph: on the teacher home when `stays: 'teacher'`, on the router's grown-up home when `stays: 'none'`, `/start` when no space is left, D14). The done note reaches the next page through a one-shot flash (`sessionStorage` `hr:console-flash` `{ kind: 'adminLeft', school }`, in this tab only, read and removed on that page's first render: after `stays: 'none'` the account can no longer load the school, so the name travels with the flash), never a query parameter.

## Other states

| Board | State |
|---|---|
| 24 | loading: two skeleton lines under the heading, `aria-busy`, no count, nothing moves |
| 25 | the admins call failed: `console.cantReach` and **Try again** inside the panel; the rest of the page stays usable |
| 28 | a Revoke, Remove or Stop answered `404`, `403` or `409` (done in another tab, the viewer's role just removed, `invite_used`): the panel reloads with the current list, no `actionFailed` |

## Accessibility

- Heading order: the page h1, then h2 per block; the panel's count is plain text after its h2 (read as "Administrators, 1 of 2 added").
- Every Remove names its row: `aria-label` `console.admins.remove.a11y(name)` ("Remove Mr Lee", on each panel row and on the new-admin notice); Revoke's row text says which invite. Settings keeps its shipped Remove button as it is (no new label there).
- After Revoke or Remove the row is gone, so focus goes to **Invite an administrator** when it comes back, else to the panel's h2 (`tabindex="-1"`); the status line announces the result. After **Close** on the invite box, focus goes to the new open invite's **Revoke**.
- The invite box is a `group` labelled by the link itself, so a screen reader reads the link when focus lands there.
- Every control is at least `touchTarget.min` tall; no sideways scroll at 320 with 200 % text.
