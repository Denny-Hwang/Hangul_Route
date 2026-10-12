# Shell/Signin — one grown-up sign-in on app.hangulroute.com, then straight home (wireframe v2)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.7, §3.9 (secret-proving sign-in), §3.11 · supersedes `console/sign-in.md` for the app host (Clerk widget and dev fallback, F-AUTH-002 §3.3)
Audience: **parent or caregiver, teacher, school admin** (grown-up surface, may address them directly). Learners never need it; it is also a screen a child could reach, so account creation sits behind an adult step.
Route: `/signin` (`?persona=parent|teacher` or `?as=`, `?next=<grown-up path>`, `?mode=create`, `?lang=`) · console bundle · exempt from `shell/grown-up-lock`

## Scenario (Given-When-Then)

Given: a grown-up taps "Parent or caregiver" or "Teacher" on Welcome, "Sign in" on hangulroute.com, or opens a grown-up link while signed out
When: `/signin` opens
Then: one short line says what signing in gives this persona, the Clerk sign-in is the only big control, and after sign-in they land on their home (or the page they asked for) with no extra tap

## Screen goal

"Authenticate one grown-up and route them to the right persona home."

## Box diagram

Panel A — signed out, `?persona=teacher`

```
+------------------------------------------+
| [< Back to learning]                     |  <- top-left, always -> learner app /
|                                          |
|  [hoya small]  title (placeholder)       |
|  1 line: persona intro                   |  <- teacher: "see your classes"; family: "see your family's learning";
|                                          |     no hint: neutral line
|  +------------------------------------+  |
|  |   [ Clerk sign-in ]                |  |  <- sign-in only; no sign-up link inside
|  +------------------------------------+  |     (installed iOS PWA: email code listed first)
|                                          |
|  ( New here? Create a grown-up account ) |  <- small link -> Panel C
|  1 muted line: learners need no account  |  <- "start learning right away, or join a class with a code"
|  ( I'm here to learn )                   |  <- text link -> /
+------------------------------------------+
```

Panel B — signed in (or just signed in): router

```
+------------------------------------------+
|        "Taking you to your home..."      |  <- polite live region; visible link fallback
|        [ Go now ]                        |
+------------------------------------------+
```

Panel C — `?mode=create`: the adult step, then sign-up

```
+------------------------------------------+
| [< Back to sign in]                      |
|  "Grown-up accounts are for parents,     |
|   guardians and teachers."               |
|  [ ] I am a parent, guardian or teacher  |  <- visible label; required
|  [[ CONTINUE ]]                          |  <- disabled until ticked
|------------------------------------------|
|  (after Continue) [ Clerk sign-up ]      |  <- email verification on; affirmation saved on the Clerk user
+------------------------------------------+
```

Panel D — signed in with Google on a device with learner profiles (locked device)

```
+------------------------------------------+
|  "Confirm it's you" (title)              |
|  1 line: this device has learner         |
|  profiles; enter the code we email you   |
|  [ Clerk reverification: email code /    |
|    password / passkey ]                  |
|  [ Back to learning ]                    |
+------------------------------------------+
```

- Phone width: same single column; the widget fills the width inside the page gutter.
- No persona choice on this screen: the persona comes from the account's spaces (§3.5). The hint only changes the intro line and picks which home (or its "not set up yet" state) opens.

## Interaction points

- Clerk sign-in success, account has spaces → `?next` when `safeNextPath` accepts it, else `homeFor` → `shell/parent-home` or `shell/teacher-home` (a hinted persona the account lacks opens that home's "not set up yet" state)
- Clerk success, account has no space → `console/onboarding-role` at `/start` (`?persona` preselects the card)
- A sign-in that proved a secret (password, email or SMS code, passkey) writes the grown-up unlock (and the trusted PIN epoch on a `pin` device) before routing; an OAuth sign-in on a locked device goes through Panel D first
- ( New here? ) → Panel C; [[ CONTINUE ]] → Clerk sign-up → `/start`
- [< Back to learning] and ( I'm here to learn ) → learner app `/` (Welcome or the learner's home)

## Navigation graph

Enter from: `onboarding/welcome-personas` · hangulroute.com CTAs (F-SITE-002, `?persona=` or `?as=`) · `shell/grown-up-lock` "Sign in again" · any grown-up page while signed out (`?next=`) · `/teach` router · learner `openGrownUpArea` default target · lesson browser Access screen
Exit to:    `shell/parent-home` · `shell/teacher-home` · `console/onboarding-role` (`/start`) · the `next` page · learner app `/`

## States

- **success**: Panel B for at most a moment, then the home.
- **empty**: new person → Panel C (never an inline sign-up in Panel A).
- **error**:
  - Clerk unreachable or offline → widget replaced by one line + [ Try again ] + [ Back to learning ] (offline navigations get `shell/offline` instead).
  - spaces fetch failed after sign-in → one line + [ Try again ] (no wrong home).
  - `next` rejected (outside a grown-up path, another origin) → ignored silently; home used.
  - Panel D cancelled → still signed in, the page stays locked (`shell/grown-up-lock`).
  - installed iOS PWA where Google finished in Safari → one line "Finish signing in here with an email code" + the email-code method.

## Data needs

- reads: Clerk session and the completed sign-in's first-factor strategy; `GET /api/spaces` (kinds and roles → `personasFor`); shell store `lastPersona`; device marker; `?persona`, `?as`, `?next`, `?mode`, `?lang`; `display-mode: standalone`
- writes: `sessionStorage` `hr:grownup:unlock` (`src: 'signin'`) after a secret-proving sign-in; shell store `pinEpoch` on a `pin` device; Clerk `unsafeMetadata.adultAffirmedAt` at sign-up; the `accounts` row upsert happens server-side as today

## Open questions

- Clerk Production on the `app.` subdomain is expected to need no extra setup; verified by the owner in step S-2, which also confirms email verification at sign-up and Google in the installed PWA. Default: no code change either way.
