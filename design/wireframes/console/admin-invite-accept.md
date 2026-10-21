# Console/Admin-invite-accept — open an administrator invite link, sign in, accept (wireframe v1)

> **New 2026-10-20 [SA]** (`docs/specs/AMENDMENTS-SEATS-ADMINS.md` sections 6.3, 6.4 and 6.6 "Accept page"; design row SA-0b). Built by SA-4 after SA-2. Mock: `design/screens/console/admin-invite-accept.md`, `mock/admin-invite-accept.html`.

Spec: `docs/specs/AMENDMENTS-SEATS-ADMINS.md` §6.3 (the link, token in the fragment), §6.4 (preview, accept and their refusals), §6.6 steps 1 to 8 (capture before the gate, signed out, sign-up, locked, no stash, preview, accept, refusals), §9.4 (strings)
Screen ID: `console/admin-invite-accept` · URL: `https://app.hangulroute.com/account/invite` (`APP_ROUTES.adminInvite`; the link the owner sends is `/account/invite#t=<token>`)
Audience: **the invited grown-up** — most often someone new: signed out, or with no account yet, or a teacher of the school already. Never a learner surface; inside `GrownUpGate` like every console page.

## Scenario (Given-When-Then)

Given: a school owner sent a principal the link `app.hangulroute.com/account/invite#t=…`
When: the principal opens it on any device, signed in or not
Then: they sign in (or sign up) once, come straight back to the invite, read what an administrator can and cannot do, and accept; they land on the school page as an administrator

## Screen goal

"Say whose school this is and what joining means, then take one tap to accept, whatever happened on the way."

## Layout

The page uses the `/start` layout (one centred reading column, the brand mark, no tab row): an invitee may hold no space yet, so the frame's tab row would be empty. Every state below is that column.

## Box diagram

Signed in, preview (phone 375):

```
+-----------------------------------+
|              (HR)                 |  <- brand mark
| Join Maple School as an           |  <- h1, console.adminInvite.title(school)
| administrator?                    |
| Invited by Ms Park                |  <- invitedBy(name) | invitedByOwner when null
| Signed in as jin.cho@example.org  |  <- signedInAs(who): this account's own email (Clerk useUser), shown to that person only
|        ( Use another account )    |  <- switchAccount.cta: signs out, keeps the stash, back here after sign-in
| +-------------------------------+ |
| | As an administrator you can   | |  <- console.adminInvite.can
| | rename the school and its     | |
| | classes, make classes, invite,| |
| | assign and remove teachers,   | |
| | open class rosters and        | |
| | reports, move students between| |
| | the school's classes, remove  | |
| | students from a class, and    | |
| | approve a student's request to| |
| | link a new device.            | |
| | Billing and the list of       | |  <- console.adminInvite.cannot
| | administrators stay with the  | |
| | school's owner.               | |
| | The owner sees that you       | |  <- console.adminInvite.leave
| | joined and the email you sign | |
| | in with. You can leave at any | |
| | time, and the owner can remove| |
| | you.                          | |
| +-------------------------------+ |
| (( Accept ))                      |  <- primary, full width on phones
| ( Not now )                       |
+-----------------------------------+
```

Signed out, after the gate's redirect (`/signin?next=/account/invite`, no token in the address):

```
| (Back to learning)      (Aa)      |
|              (HR)                 |
| Grown-ups sign in                 |  <- /signin's own heading (console.signIn.title, unchanged)
| Sign in to your grown-up account. |  <- the neutral intro (no persona hint in next)
| Sign in to see this invite.       |  <- console.adminInvite.signIn, while a live stash exists
| [ Clerk sign-in ]                 |
| New here? Create a grown-up       |  <- /signin's own create link and adult step (unchanged)
| account                           |
```

Refusal (one calm line, then home):

```
|              (HR)                 |
| Administrator invite              |  <- h1, console.adminInvite.pageTitle
| This invite was already used.     |  <- one of used, expired, revoked, full(2), owner, alreadyAdmin(school), notFound, emailUnverified
| Ask for a new one.                |
| ( Go to my home )                 |  <- console.adminInvite.home.cta
```

No stash (a fresh tab, more than 30 minutes, another browser):

```
| Administrator invite              |
| Open your invite link again to    |  <- console.adminInvite.reopen
| see it.                           |
| ( Go to my home )                 |
```

## Flow

```
open /account/invite#t=TOKEN
  -> GrownUpGate's first render: captureAdminInvite stashes { token, savedAt } in sessionStorage
     (hr:admin-invite) and strips the fragment (replaceState); nothing else has run yet
  -> signed out   -> /signin?next=/account/invite  (+ signIn line) -> Clerk -> back to /account/invite
     sign-up      -> the adult step -> Clerk sign-up -> /account/invite (not /start; /start also forwards while a stash lives)
     locked       -> GrownUpLock -> Sign in again or PIN -> /account/invite
  -> signed in, stash live  -> POST /admin-invites/preview { token }
        open          -> preview (title, invitedBy, can / cannot / leave, Accept, Not now)
        already_admin -> alreadyAdmin(school) + Go to my home (the invite stays open for someone else)
        404 / 410 / 409 / 429 -> the refusal line
        Use another account -> sign out (stash kept) -> /signin?next=/account/invite
  -> Accept  -> POST /admin-invites/accept { token } -> /teach/space?id=<school> with done(school)
  -> Not now -> the home (stash removed)
  -> signed in, no stash -> reopen + Go to my home
```

## Interaction points

- **Accept** → `POST /api/admin-invites/accept` (token in the JSON body only) → the school page `/teach/space?id=<school>` with the notice `console.adminInvite.done(school)` at the top; the stash is removed. A refusal at accept (used, revoked, expired or full in between) → that refusal's line on this page.
- **Not now** → the grown-up's home (`/teach/home` or `/parent`, the router's choice; `/start` when the account holds no space); the stash is removed; the invite stays open for the owner to revoke.
- **Go to my home** → the same destination as Not now; the stash is removed after a final refusal (used, expired, revoked, full, owner, already admin, not found, email not verified) and kept after `429` and a network failure.
- **Use another account** → Clerk sign-out with the stash kept, then `/signin?next=/account/invite`.
- **Try again** (network failure or `503 identity_not_configured`, `console.cantReach`) → the preview or the accept once more with the stashed token.

## Navigation graph

Enter from: the invite link (email, chat, any app) · `/signin` (after sign-in, `next`) · Clerk sign-up · `GrownUpLock` · `/start` (forwarded while a stash lives)
Exit to: `console/school-admin` (accepted) · persona home (Not now, Go to my home) · `/signin` (signed out)

## States

- **capturing** (first render, never seen: the gate shows its own `Pending` frame)
- **signed out** → `/signin` with the `signIn` line
- **sign-up** → Clerk's sign-up, then back here
- **locked** → `GrownUpLock`, then back here
- **loading** (preview in flight): the column with `console.space.loading`
- **preview, invitedBy** · **preview, invitedByOwner** (owner without a display name: never the owner's email)
- **accepting**: Accept busy (`aria-busy`), Not now disabled
- **already admin** (`200 already_admin`): `alreadyAdmin(school)` + Go to my home
- **refusals**: `used` (410 invite_used), `expired` (410 invite_expired), `revoked` (410 invite_revoked), `full(2)` (409 admins_full), `owner` (409 already_owner), `notFound` (404 invite_not_found), `emailUnverified` (403 email_unverified, at accept; the invite stays open)
- **slow down** (429): `caregiver.retry.tooManyAttempts` + Go to my home (the stash kept)
- **network failure**, or **503 identity_not_configured**: `console.cantReach` + **Try again**
- **no stash**: `reopen` + Go to my home
- **done**: the school page with `done(school)` (drawn in the mock as the page's first notice)

## Data needs

- local: `sessionStorage` key `hr:admin-invite` `{ token, savedAt }` through `safe-storage.ts`; removed after accept, Not now, a final refusal, or 30 minutes
- reads: `POST /api/admin-invites/preview { token }` → `{ school: { name }, invitedBy, expiresAt, state }`
- writes: `POST /api/admin-invites/accept { token }` → `{ space, role: 'admin' }`
- never: the token in a path, a query, `next`, Clerk's `redirect_url`, the page title or telemetry
- telemetry: Worker only (`space.admin.joined`, `space.admin.accept_refused { reason }`)

## Open questions

- None open for SA-4. The page title in the browser tab is `console.adminInvite.pageTitle` in every state (never the school's name, so the tab and history never hold it).
