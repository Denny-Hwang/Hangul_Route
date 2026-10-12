# Shell/Grown-up-lock — a shared family device keeps grown-up pages closed to children (wireframe v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.9 (decision table), §3.16, §3.17
Audience: **parent or caregiver, teacher** — but it is the screen a child would meet, so it shows nothing about anyone
Component target: `apps/web/src/components/console/GrownUpLock.tsx` + `lib/console/grown-up-lock.ts` (A-4)

## Scenario (Given-When-Then)

Given: a tablet with child profiles behind a PIN, where a parent signed in yesterday (Clerk still holds the session)
When: anyone opens a grown-up page in a tab where nobody passed the PIN or signed in within the last 15 idle minutes
Then: a calm screen asks for the grown-up PIN (or a fresh sign-in); no name, no number and no page content appears, and nothing is fetched

## Screen goal

"Prove a grown-up is here." (one primary: use the PIN)

## Box diagram

```
+-----------------------------------+
| [< Back to learning]              |  <- top-left, -> learner app /
|                                   |
|        [lock outline]             |
|   "Grown-ups only" (title)        |
|   1 line: PIN or sign in again    |
|                                   |
|   [[ USE THE GROWN-UP PIN ]]      |  -> learner app PIN screen, then back here
|   [ Sign in again ]               |  -> Clerk sign-out -> shell/signin?next=
|                                   |
+-----------------------------------+
```

- No frame navigation, no persona switch, no account name or email on this screen.
- No countdown and nothing that changes while it is open.
- Same layout at phone and wide widths (single centred column).

## Interaction points

- [[ USE THE GROWN-UP PIN ]] → `/?gate=grown-up&next=<this path and query>` → `profiles/pin-entry` (destination `GrownUpArea`) → on success the learner app writes the unlock and returns here, which now opens; telemetry `shell.grown_up_handoff { via: 'lock', target: 'next' }`
- PIN screen Cancel → learner app home (nothing written)
- [ Sign in again ] → Clerk sign-out → `shell/signin?next=…` → a fresh sign-in writes the unlock
- [< Back to learning] → learner app `/`

## Navigation graph

Enter from: any grown-up page on a `pin` device without an active unlock (direct URL, bookmark, browser Back after "Back to learning", 15 idle minutes)
Exit to:    `profiles/pin-entry` (learner app) · `shell/signin` · learner app `/` · the requested page after unlock

## States

- **success**: lock as drawn; after unlock the requested page renders.
- **empty**: not applicable (the lock has no data).
- **error**: offline → the PIN path still reaches the PIN screen; the return lands on `shell/offline`. Storage unreadable → the lock does not apply (§3.9: such a browser cannot hold learner profiles).
- **before the decision**: frame without content (a few milliseconds of IndexedDB read), never page content.

## Data needs

- reads: IndexedDB `hr:device:gate` (`pin` / `none`), presence of `hr:profiles` for learner apps older than A-6, `sessionStorage` `hr:grownup:unlock`
- writes: nothing on this screen (the learner app writes the unlock after the PIN; `shell/signin` writes it after a fresh sign-in)

## Open questions

- 15 idle minutes mirrors the learner gate session (`PARENT_SESSION_MS`); default kept. A longer window for teachers on shared classroom devices would be an owner call (OD-3).
