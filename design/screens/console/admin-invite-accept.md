# Administrator invite page `/account/invite` (design mock v1, for SA-4)

Wireframe: `design/wireframes/console/admin-invite-accept.md` · spec `docs/specs/AMENDMENTS-SEATS-ADMINS.md` sections 6.3, 6.4, 6.6 (steps 1 to 8), 9.4 · mock: `mock/admin-invite-accept.html` (19 boards) · shots: `shots/admin-invite-accept-320.png`, `-1280.png`, `-320-text200.png`

URL: `https://app.hangulroute.com/account/invite` (`APP_ROUTES.adminInvite`); the link the owner sends adds `#t=<token>`. The fragment is read and removed on the first render of `GrownUpGate` (`captureAdminInvite`), before any redirect, lock or child renders; the token then lives only in `sessionStorage` (`hr:admin-invite`, through `safe-storage.ts`) and in the JSON body of preview and accept.

## Anatomy (board 1)

```
                (HR)                     brand mark (the /start column, D15)
 Join Maple School as an administrator?  h1, size.title (console.adminInvite.title(school))
 Invited by Ms Park                      size.bodyLg, text.secondary (invitedBy | invitedByOwner)
 [ Signed in as jin.cho@example.org  ( Use another account ) ]   surface.sunken, radii.md: signedInAs, switchAccount
 +--------------------------------------+
 | As an administrator you can ...      |  consent block: surface.paper, border.subtle, radii.md,
 |--------------------------------------|  three paragraphs (can, cannot, leave) split by border.subtle
 | Billing and the list of ...          |  rules, leading.relaxed
 |--------------------------------------|
 | The owner sees that you joined. ...  |
 +--------------------------------------+
 (( Accept ))  ( Not now )               phones: full width, stacked; from 45em side by side
```

- The column is `layout.maxWidth.reading` (720 px), centred, gutters `layout.gutter.*`; no tab row.
- The browser tab title is `console.adminInvite.pageTitle` in every state (never the school's name).
- Accept is the page's only primary.

## Boards

| Board | State | Shows |
|---|---|---|
| 1 | preview | as above, with Signed in as and Use another account; focus on the h1 on arrival |
| 2 | preview, owner without a display name | `invitedByOwner` (the preview never carries an email) |
| 3 | signed out | `/signin?next=/account/invite` as shipped, plus `console.adminInvite.signIn` in an info note above the Clerk widget while a live stash exists |
| 4 | sign-up | the shipped adult step, then Clerk's sign-up; it returns to `/account/invite` |
| 5 | locked device | `GrownUpLock` as shipped; both ways back return here |
| 6 | loading | `console.space.loading`, `aria-busy` |
| 7 | accepting | Accept `aria-busy`, Not now unavailable |
| 8 to 15 | refusals | `used`, `expired`, `revoked`, `full(2)`, `owner`, `alreadyAdmin(school)`, `notFound`, `emailUnverified` (at accept): h1 `pageTitle`, one calm line (`role="status"`), **Go to my home** (secondary) |
| 16 | 429 | `caregiver.retry.tooManyAttempts`, **Try again** (the stash kept for it) and **Go to my home** (the stash removed) |
| 17 | network failure, `503 identity_not_configured` | `console.cantReach`, **Try again** (the stash kept for it) and **Go to my home** (the stash removed) |
| 18 | no stash | `console.adminInvite.reopen`, Go to my home |
| 19 | accepted | the school page with `console.adminInvite.done(school)` (from the one-shot flash `hr:console-flash`, never a query parameter) as a done note (`feedback.successLight`, the check glyph in `feedback.successDark`, decoration) above the title |

## Behaviour

- **Accept** → `POST /api/admin-invites/accept { token }` → `/teach/space?id=<school>` with the done note; the stash removed. The note travels as a one-shot flash (`sessionStorage` `hr:console-flash` `{ kind: 'adminJoined', school }`, in this tab only, read and removed on the school page's first render), so no school name is in an address, the history or a log.
- **Not now** and **Go to my home** → the grown-up's home (the router's choice; `/start` when the account holds no space). Both **always** remove the stash, on every board: the original link still works, and a kept stash would make `/start` forward an invitee with no space straight back here, into the same `429`.
- **Try again** (boards 16, 17) → the preview or the accept once more; it is the only action besides Use another account that keeps the stash.
- **Use another account** → Clerk's sign-out with the stash kept, then `/signin?next=/account/invite` (board 3), so the right person can sign in on a shared computer.
- **Every other sign-out** (the frame's Sign out, Back to learning, Open the app on this device: the callers of `clearGrownUpTab`) removes the stash with the rest of the grown-up tab, so the next person to sign in in that tab is never forwarded to this invite. The lock's Sign in again and PIN are not sign-outs and keep it (board 5).
- A refusal at accept (the invite used, revoked, expired or the school full in between) replaces the preview with that refusal's board.
- The token never appears in an address the app builds (`/signin?next=`, Clerk's `redirect_url`), a page title, a log line or telemetry.

## Accessibility

- On arrival and after each state change focus goes to the h1, so the new state is read from its top.
- Refusal and status lines are `role="status"` (polite); nothing is an alert.
- The consent block is plain paragraphs (no list markup needed), read in order before Accept.
- Every control is at least `touchTarget.min` tall (the adult step's checkbox sits in its 64 px label, as shipped); no sideways scroll at 320 with 200 % text.
