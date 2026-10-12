# Shell/Grown-up-lock — a shared family device keeps grown-up pages closed to children (wireframe v2)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.9 (decision table, trusted PIN epoch, secret-proving sign-in), §3.16, §3.17
Audience: **parent or caregiver, teacher** — but it is the screen a child would meet, so it shows nothing about anyone
Component target: `apps/web/src/components/console/GrownUpLock.tsx` + `lib/console/grown-up-lock.ts` (A-4a)

## Scenario (Given-When-Then)

Given: a tablet with child profiles, where a parent signed in yesterday (Clerk still holds the session)
When: anyone opens a grown-up page in a tab where nobody passed a fresh PIN or a secret-proving sign-in within the last 15 idle minutes
Then: a calm screen asks for the grown-up PIN (when this device's PIN is one a grown-up confirmed) or a fresh sign-in; no name, no number and no page content appears, and nothing is fetched

## Screen goal

"Prove a grown-up is here." (one primary: use the PIN, when available)

## Box diagram

Panel A — device with a PIN whose epoch a grown-up confirmed by signing in

```
+-----------------------------------+
| [< Back to learning]              |  <- top-left, -> learner app /
|                                   |
|        [lock outline]             |
|   "Grown-ups only" (title)        |
|   1 line: PIN or sign in again    |
|                                   |
|   [[ USE THE GROWN-UP PIN ]]      |  -> learner app PIN screen (verify only), then back here
|   [ Sign in again ]               |  -> Clerk sign-out -> shell/signin?next=
|                                   |
+-----------------------------------+
```

Panel B — sign-in only: the PIN changed since the last grown-up sign-in, no grown-up has signed in on this device yet, or the device has no PIN (`nopin`)

```
|        [lock outline]             |
|   "Grown-ups only" (title)        |
|   1 line, one of:                 |
|   - "The grown-up PIN changed on this device. Sign in again to use it."
|   - "Sign in once on this device to use the grown-up PIN here." (no grown-up sign-in yet)
|   - "Set a grown-up PIN in the app, or sign in again." (nopin)
|   [[ SIGN IN AGAIN ]]             |  <- becomes the primary
```

- No frame navigation, no persona switch, no account name or email on this screen.
- No countdown and nothing that changes while it is open.
- Same layout at phone and wide widths (single centred column).

## Interaction points

- [[ USE THE GROWN-UP PIN ]] → `/?gate=grown-up&next=<this path and query>` → `profiles/pin-entry` (destination `GrownUpArea`: verify mode only, no Forgot PIN, never creates a PIN) → on success the learner app writes the unlock (with the PIN epoch) and returns here, which now opens; telemetry `shell.grown_up_handoff { via: 'lock', target: 'next' }`
- PIN screen Cancel → learner app home (nothing written)
- [ Sign in again ] → Clerk sign-out → `shell/signin?next=…` → a secret-proving sign-in (OAuth adds reverification on this device) writes the unlock and confirms the PIN epoch
- [< Back to learning] → learner app

## Navigation graph

Enter from: any grown-up page on a locked device without an active unlock (direct URL, bookmark, browser Back after "Back to learning" including a back/forward-cache restore, 15 idle minutes, a tab switched back to after the idle time)
Exit to:    `profiles/pin-entry` (learner app) · `shell/signin` · learner app `/` · the requested page after unlock

## States

- **success**: Panel A or B; after unlock the requested page renders.
- **empty**: not applicable (the lock has no data).
- **error**: offline → the PIN path still reaches the PIN screen; the return lands on `shell/offline`. Storage unreadable → the lock does not apply (§3.9: such a browser cannot hold learner profiles).
- **before the decision**: frame without content (a few milliseconds of IndexedDB read), never page content. On a back/forward-cache restore or a return to a hidden tab, content is hidden first and the decision runs again.

## Data needs

- reads: IndexedDB `hr:device:gate` (`pin` + `pinEpoch` / `nopin` / `none`), presence of `hr:profiles` for learner apps older than A-6, shell store `pinEpoch` (trusted epoch), `sessionStorage` `hr:grownup:unlock`
- writes: removes `hr:console:session` from this tab when it renders; nothing else (the learner app writes a PIN unlock; `shell/signin` writes a sign-in unlock)

## Open questions

- 15 idle minutes mirrors the learner gate session (`PARENT_SESSION_MS`); default kept. A longer window for teachers on shared classroom devices would be an owner call (OD-3).
