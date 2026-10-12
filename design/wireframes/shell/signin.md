# Shell/Signin — one grown-up sign-in on app.hangulroute.com, then straight home (wireframe v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.7, §3.11 · supersedes `console/sign-in.md` for the app host (Clerk widget and dev fallback unchanged, F-AUTH-002 §3.3)
Audience: **parent or caregiver, teacher, school admin** (grown-up surface, may address them directly). Learners never need it.
Route: `/signin` (`?persona=parent|teacher`, `?next=<grown-up path>`) · console bundle · exempt from `shell/grown-up-lock`

## Scenario (Given-When-Then)

Given: a grown-up taps "Parent or caregiver" or "Teacher" on Welcome, a "Sign in" link on hangulroute.com, or opens a grown-up link while signed out
When: `/signin` opens
Then: one short line says what signing in gives this persona, the Clerk widget is the only big control, and after sign-in they land on their home (or the page they asked for) with no extra tap

## Screen goal

"Authenticate one grown-up and route them to the right persona home."

## Box diagram

Panel A — signed out, `?persona=teacher`

```
+------------------------------------------+
| [< Back to learning]                     |  <- top-left, always -> learner app /
|                                          |
|  [hoya small]  title (placeholder)       |
|  1 line: persona intro                   |  <- teacher: "see your classes"; parent: "see your family's learning";
|                                          |     no hint: neutral line
|  +------------------------------------+  |
|  |   [ Clerk sign-in / sign-up ]       |  |  <- the primary control (Google, email code)
|  +------------------------------------+  |
|                                          |
|  1 muted line: learners need no account  |  <- "they join with a code" (any-age wording)
|  ( I'm here to learn )                   |  <- text link -> /
+------------------------------------------+
```

Panel B — signed in (or just signed in): router

```
+------------------------------------------+
|                                          |
|        "Taking you to your home..."      |  <- polite live region; visible link fallback
|        [ Go now ]                        |
+------------------------------------------+
```

- Phone width: same single column; the widget fills the width inside the page gutter.
- No persona choice on this screen: the persona comes from the account's spaces (§3.5). The hint only changes the intro line and preselects a card on `/start`.

## Interaction points

- Clerk success, account has spaces → `?next` when `safeNextPath` accepts it, else `homeFor` → `shell/parent-home` or `shell/teacher-home`
- Clerk success, account has no space → `console/onboarding-role` at `/start` (`?persona` preselects the card)
- A sign-in completed in this tab writes the grown-up unlock (§3.9) before routing
- [< Back to learning] and ( I'm here to learn ) → learner app `/` (Welcome or the learner's home)

## Navigation graph

Enter from: `onboarding/welcome-personas` · hangulroute.com CTAs (marketing spec) · `shell/grown-up-lock` "Sign in again" · any grown-up page while signed out (`?next=`) · `/teach` router · `shell/moved` (old `/teach`) · learner `openGrownUpArea` default target
Exit to:    `shell/parent-home` · `shell/teacher-home` · `console/onboarding-role` (`/start`) · the `next` page · learner app `/`

## States

- **success**: Panel B for at most a moment, then the home.
- **empty**: new person → Clerk offers sign-up inline; then `/start`.
- **error**:
  - Clerk unreachable or offline → widget replaced by one line + [ Try again ] + [ Back to learning ] (offline navigations get `shell/offline` instead).
  - spaces fetch failed after sign-in → one line + [ Try again ] (no wrong home).
  - `next` rejected (outside a grown-up path, another origin) → ignored silently; home used.

## Data needs

- reads: Clerk session; `GET /api/spaces` (kinds and roles → `personasFor`); IndexedDB `hr:shell:lastPersona`; `?persona`, `?next`, `?lang`
- writes: `sessionStorage` `hr:grownup:unlock` after a fresh sign-in; the `accounts` row upsert happens server-side as today

## Open questions

- Clerk Production on the `app.` subdomain is expected to need no extra setup; verified by the owner in step S-2. Default: no code change either way.
