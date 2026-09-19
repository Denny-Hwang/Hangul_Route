# Console/Sign-in — adult sign-in via Clerk (wireframe v1)

Spec: `docs/specs/F-AUTH-001-family-ownership-clerk.md` (Clerk, adults only) · F-AUTH-002 (mobile sign-in, to be written) · `docs/roadmap/multi-persona-sync-platform.md` §1, §5, §8
Audience: **parent / teacher / school admin** — children never sign in (no child account exists anywhere, roadmap §2 `accounts`)

## Scenario (Given-When-Then)

Given: an adult reaches the console — on the web from the landing page, or inside the mobile app from `profile/settings` > "Grown-ups" after the PIN gate
When: this browser / device has no Clerk session yet
Then: they understand in one glance *why* signing in helps (sync across devices, restore after reinstall, billing) and complete sign-in or sign-up in one step, landing on the right next screen

## Screen goal

"Authenticate one adult with Clerk and route them: first space setup if they own no space, otherwise the hub."

## Box diagram

```
+------------------------------------------+
| [< back]                                 |   <- returns to origin (landing / profile/settings)
|                                          |
|  [hoya small]  "Grown-ups sign in"       |   <- title placeholder, short
|                                          |
|  Why sign in (3 short rows, no jargon)   |
|   o keep progress safe across devices    |   <- sync
|   o bring cards back after reinstall     |   <- restore
|   o manage plans and billing             |   <- billing
|                                          |
|  +------------------------------------+  |
|  |  [ Clerk sign-in / sign-up widget ] |  |   <- email + magic link / OAuth,
|  |  (email - continue)                 |  |      hosted by Clerk, one step
|  +------------------------------------+  |
|                                          |
|  "Kids don't need an account" (1 line)   |   <- reassurance, placeholder
|                                          |
|  [ I have a Rescue Code instead ]        |   -> sync/restore (mobile only)
+------------------------------------------+
```

- The Clerk widget *is* the primary CTA; no separate `[[ ]]` button on top of it.
- Same screen on web (`apps/web`) and mobile (`@clerk/clerk-expo`); the mobile variant is reachable only after `profiles/pin-entry`.
- No Korean text on this screen (UI = English; nothing is being taught here).

## Interaction points

- Clerk widget success (new user) → server has no `memberships` row for this account → `console/onboarding-role`
- Clerk widget success (existing user, ≥1 space) → `console/home`
- Clerk widget success, arrived via `sync/restore` "sign in as a parent" → back to `sync/restore` with the account's family learners listed
- [ I have a Rescue Code instead ] → `sync/restore` (mobile / PWA only; hidden on the web console)
- [< back] → origin: web landing `/` (not a wireframe target) or `profile/settings`

## Navigation graph

Enter from: web landing `/` · `profile/settings` "Grown-ups" (via `profiles/pin-entry`) · `sync/restore` ("sign in as a parent") · any `console/*` screen when the session expired
Exit to:    `console/onboarding-role` · `console/home` · `sync/restore` · `profile/settings` (back)

## States

- **success**: widget completes; brief "signed in" line, then automatic route (no extra tap).
- **empty** (no account yet): the same widget offers sign-up inline — no separate sign-up screen. First-time users never see an empty hub; they go to `console/onboarding-role`.
- **error**:
  - Clerk unreachable / offline → widget replaced by "can't reach sign-in right now" + [ TRY AGAIN ]; the learner app keeps working (offline-first, app map §5).
  - session expired mid-console → this screen with a one-line "please sign in again" and return-to-origin after success.
  - child guard: if the mobile entry is reached without a PIN pass, redirect to `profiles/pin-entry` first (never render the widget to a learner profile).

## Data needs

- reads: Clerk session (JWT) · `GET` memberships for this account (to decide onboarding vs hub) — via the `/spaces` surface, roadmap §8
- writes: `accounts` row upsert on first sign-in (id = Clerk user id, email) · nothing about learners
- telemetry: `console_sign_in_viewed`, `console_sign_in_succeeded` (role unknown at this point), `console_sign_in_failed{reason}`

## Open questions

- Should the "why sign in" rows differ by entry path (parent-flavoured from mobile, teacher-flavoured from the web landing)? Default: one neutral set; validate with 3 teachers in the F-TCH-001 pilot.
- F-AUTH-002 (mobile Clerk UI) is not yet written — this wireframe assumes the same widget; confirm before the design pass.
- Rescue Code default ON (roadmap §11 Q2) is **deferred**; the "I have a Rescue Code" link only makes sense if codes exist for solo learners, so its visibility follows that decision.
