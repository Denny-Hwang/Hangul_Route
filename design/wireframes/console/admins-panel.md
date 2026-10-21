# Console/Admins-panel — the school's owner and up to two administrators, invite links, history (wireframe v1)

> **New 2026-10-20 [SA]** (`docs/specs/AMENDMENTS-SEATS-ADMINS.md` sections 6.1 to 6.6, SA-D10 to SA-D12; design row SA-0b). Built by SA-4 after SA-2 (the admin routes) and SA-3. Mock: `design/screens/console/admins-panel.md`, `mock/admins-panel.html`.

Spec: `docs/specs/AMENDMENTS-SEATS-ADMINS.md` §6.1 (model, ending a role), §6.3 (invite link, step-up), §6.4 (routes), §6.5 (who may do what), §6.6 (console), §9.4 (strings)
Lives on: `console/school-admin` (`/teach/space?id=<school>`), one panel under **Invite a teacher**.
Audience: **school owner** (full panel) · **school administrator** (the list and **Stop being an administrator**). Teachers of the school never see the school page, so never this panel.

## Scenario (Given-When-Then)

Given: the owner of a school who wants a principal and a dean to help run it
When: they open the school page and press **Invite an administrator**
Then: after a fresh sign-in they get a one-time link to send; the panel shows the open invite until it is used, revoked or ends; once accepted, the person is listed as an administrator, and the owner can remove them and see the history

## Screen goal

"See who runs the school with you, add up to two people with a link, and take a place back at any time."

## Box diagram

Owner, phone (375), one admin, no open invite:

```
+-----------------------------------+
| Administrators       1 of 2 added |  <- h2 + console.admins.count(admins, 2): admins only, open invites are not counted here
| A school can have 2 administrators|  <- console.admins.about(2)
| besides its owner.                |
| +-------------------------------+ |
| | Ms Park · owner               | |  <- console.admins.ownerRow
| |-------------------------------| |
| | Mr Lee · admin · joined Oct 3 | |  <- console.admins.adminRow
| | lee@example.org  ( Remove )   | |  <- the verified sign-in email (owner only, section 6.3)
| +-------------------------------+ |
| (( Invite an administrator ))     |  <- primary, while admins + open invites < 2
| > History                         |  <- disclosure (console.admins.history.title)
+-----------------------------------+
```

Owner, both places taken by one admin and one open invite:

```
| Administrators       1 of 2 added |
|  Ms Park · owner                  |
|  Mr Lee · admin · joined Oct 3      ( Remove ) |
|    lee@example.org                             |
|  Invite made Oct 18 · ends Oct 25, 2026  ( Revoke ) |  <- console.admins.openInvite(day, date)
|  A school can have 2 administrators besides its owner. |
|  All 2 places are taken. Remove an administrator or    |  <- console.admins.full(2)
|  revoke an invite to add someone else.                 |
|  > History                                             |
```

Owner, both places taken by two admins, one of them new (joined within 7 days):

```
| New administrator: Dr Cho (cho@example.org). If this is not the  |  <- console.admins.newAdmin(name, email), info note above the panel
| person you invited, remove them.        ( Remove )  ( Got it )   |  <- Remove: the remove sheet; Got it: console.admins.newAdminDismiss.cta
| Administrators       2 of 2 added |
|  Ms Park · owner                  |
|  Mr Lee · admin · joined Oct 3      ( Remove ) |
|    lee@example.org                             |
|  Dr Cho · admin · joined Oct 18     ( Remove ) |
|    cho@example.org                             |
|  A school can have 2 administrators besides its owner. |
|  All 2 places are taken. Remove an administrator or    |  <- console.admins.full(2) (replaces the Invite button)
|  revoke an invite to add someone else.                 |
|  > History                                             |
```

The one-time invite box (after **Invite an administrator** and the step-up):

```
 +--------------------------------------------------+
 | https://app.hangulroute.com/account/invite#t=q7R…|  <- the whole link, monospace, wraps anywhere, selectable
 | Anyone with this link can become an administrator|  <- console.admins.invite.warning
 | after signing in. Send it only to the person you |
 | mean.                                            |
 | It works once and ends on Oct 27, 2026. It is    |  <- console.admins.invite.once(date)
 | shown only now: copy it before you close this.   |
 | ( Copy link )  ( Close )                         |  <- Copy (console.admins.invite.copy.cta), Close (common.buttons.close)
 | {Link copied. | Couldn't copy. Select the link…} |  <- polite status line
 +--------------------------------------------------+
```

Administrator, phone (375):

```
| Administrators       2 of 2 added |
|  Ms Park · owner                  |
|  Mr Lee · admin · joined Oct 3    |  <- no Remove on any row
|  Dr Cho · admin · joined Oct 18   |  <- the viewer's own row
|  A school can have 2 administrators besides its owner. |
|  ( Stop being an administrator )                       |  <- secondary
```

History (owner only, open):

```
 > History
   Ms Park renamed a class · Oct 19
   Dr Cho joined as an administrator · Oct 18
   Ms Park made an invite · Oct 18
   Ms Park renamed the school · Oct 12
   Mr Lee joined as an administrator · Oct 3
   Ms Park made an invite · Oct 2
```

## Interaction points

- **Invite an administrator** (owner) → `POST /api/spaces/:id/admin-invites`. A sign-in older than the step-up window answers `403 reverify_required` → the step-up dialog (`StepUpDialog`, with the admin body line, see the mock's D10) → Continue → Clerk → the request runs once more → `201 { invite, url }` → the one-time box in the panel, focus on its first line. `409 admins_full` (another tab took the last place) → the panel reloads and shows `full(2)`. Any other failure → `console.admins.invite.failed` under the button.
- **Copy link** → clipboard; `invite.copied` or `invite.copyFailed` in the box's status line (the link stays on screen and selectable).
- **Close** (or leaving the page) → the box goes for good: the token is never stored or shown again; the open invite stays listed.
- **Revoke** (owner, open invite) → ConfirmSheet: title `console.admins.revokeAsk`, dismiss `console.admins.revokeKeep.cta` ("Keep it", first and focused), confirm `console.admins.revoke.cta` → `DELETE /admin-invites/:inviteId` → the row goes; the polite line `console.admins.revoked`. `409 invite_used` → the panel reloads (the person is now an admin).
- **Remove** (owner, an admin row) → ConfirmSheet: title `console.admins.removeAsk(name, school)`, message `console.admins.removeNote.staysTeacher` when `staysTeacher`, else `removeNote.leaves`, confirm `console.admins.remove.cta` → `DELETE /admins/:accountId` → the row goes; the polite line `console.admins.removed(name)`.
- **Stop being an administrator** (admin) → ConfirmSheet: title `console.admins.leaveAsk(school)`, message `leaveNote.staysTeacher` or `leaveNote.leaves`, confirm `console.admins.leave.cta` → `POST /admins/leave` → the teacher home `/teach/home` with `console.admins.left(school)` (both outcomes: a teacher member cannot open the school page).
- **History** → a disclosure, closed by default; one line per event, newest first, at most 20; an account that no longer exists reads `console.admins.history.someone`.
- **New-admin notice** (owner, for 7 days after an `admin_joined` whose admin still holds the role) → **Remove** opens the remove sheet; **Got it** hides it in this browser (the event id through the safe storage wrapper).
- Any of Revoke, Remove, Stop fails → `console.admins.actionFailed` in the panel's line; nothing in the list changes.

## Navigation graph

Enter from: `console/school-admin` (the panel is part of it)
Exit to: `billing/step-up` (dialog, over the page) · Clerk reverification (modal) · `console/teacher-home` after Stop being an administrator

## States

- **loading**: two grey rows under the heading (the school page's own skeleton), no count.
- **owner, no admin, no invite**: owner row, `count(0, 2)`, `about(2)`, **Invite an administrator**; History hidden while it has no line.
- **owner, one admin, no invite** (drawn first above): the button stays while admins + open invites < 2.
- **owner, one admin, one open invite**: the open invite row with **Revoke**, and `full(2)` (an open invite holds a place).
- **owner, full**: `full(2)` instead of the button; Remove on each admin row, Revoke on each open invite.
- **owner, a new admin**: the new-admin notice above the panel (Remove, Got it); each admin row with its verified email (owner only).
- **invite box**: shown once, inside the panel, above the open invites.
- **step-up**: asking, verifying (the dialog steps aside for Clerk), unavailable, cancelled (`console.billing.stepUp.cancelled`) — the billing dialog's states with the admin body line.
- **administrator**: the list without buttons, `about(2)`, **Stop being an administrator**; no invites, no history.
- **confirm sheets**: revoke, remove (stays teacher / leaves), stop (stays teacher / leaves).
- **failed load**: the panel says `console.cantReach` with **Try again** (the `LoadErrorPanel` words); the rest of the school page stays usable.
- **archived school**: the panel lists the owner and admins only; no Invite, no Revoke, no Remove (the Worker refuses an invite on an archived school, `422 archived`); Stop being an administrator stays.

## Data needs

- reads: `GET /api/spaces/:id/admins` → `{ owner, admins[{ accountId, name, joinedAt, staysTeacher }], limit, invites[] (owner only), events[] (owner only) }`
- writes: `POST /admin-invites` (step-up) · `DELETE /admin-invites/:inviteId` · `DELETE /admins/:accountId` · `POST /admins/leave`
- local: none; the invite URL lives in component state only, never in storage, a URL or telemetry
- telemetry: Worker only (`space.admin.invite_created`, `invite_revoked`, `removed`, `left`); the page sends nothing

## Open questions

- None open for SA-4. The panel's strings beyond section 9.4 (the step-up body, `revoked`, `removed`, `left`, `actionFailed`) are added to section 9.4 by this design pass (mock README "New strings").
