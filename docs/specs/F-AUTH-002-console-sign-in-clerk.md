# F-AUTH-002 — Console sign-in with Clerk (web)

**Status**: `ready` (shipped 2026-10-07)
**Scope**: `apps/web` (`/teach` sign-in, auth provider, API client token provider) · docs. `packages/backend` is unchanged: F-AUTH-001 already verifies Clerk session JWTs when `CLERK_SECRET_KEY` is bound.
**Owner**: solo dev
**Rollout**: after the owner created the Clerk application (Development instance, Consumer, Email + Google — 2026-10-07). Keys live only in the Cloudflare dashboard: `CLERK_SECRET_KEY` as an API Worker Secret, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as a `hangul-route-web` build variable. Nothing in the repository.

Parent: F-AUTH-001 (JWT verification, dev fallback) · F-CONSOLE-001 §3.2 / §3.7 (static export, no server) · wireframe `design/wireframes/console/sign-in.md`

---

## 1. Context

The console is a static export on an assets-only Worker, so there is no Next middleware and no server session. Clerk's **client SDK** (`@clerk/clerk-react`) runs in the browser, keeps the session, and mints a short-lived JWT per request; the API Worker verifies that JWT (F-AUTH-001). The dev sign-in form stays only for builds without a publishable key.

## 2. User story

A teacher opens `/teach`, signs in with Google or an email code, lands on the home hub, and every console call carries a verified token. Signing out returns to `/teach`. Children never see any of it.

## 3. Acceptance criteria

### 3.1 Auth provider (`components/console/auth-context.tsx`)

- `ConsoleAuthProvider` wraps `/teach/*` (the `teach/layout.tsx`). With `clerkPublishableKey()` it renders `ClerkProvider` + a bridge; without one, the F-AUTH-001 dev bridge (sessionStorage session, bearer = account id).
- Both expose the same `useConsoleAuth()`: `mode` (`clerk` | `dev`), `ready`, `session` (`accountId`, `displayName`, `email?`), `getToken()` (fresh Clerk token per call; the dev bearer in dev mode; `null` when signed out), `signOut()`, `devSignIn()` (no-op under Clerk).
- `useConsole()` (every page) builds the API client with `getToken` and redirects a signed-out visitor to `/teach` once `ready`.

### 3.2 Session mapping (`lib/console/clerk.ts`, pure)

- `sessionFromClerkUser(user)`: `accountId` = Clerk user id; `displayName` = full name → first + last → username → email local part → "Grown-up"; `email` = primary email when present. Null without a user id.
- `requireAccount` on the Worker keeps upserting the `accounts` row from the bearer's `sub`; name and email arrive with the first `createSpace` as before.

### 3.3 Sign-in page (`/teach`)

- Clerk mode: `COPY.clerkIntro` + `<SignIn routing="hash" fallbackRedirectUrl="/teach/home" signUpFallbackRedirectUrl="/teach/start" />` (hash routing because a static export has no catch-all route). A signed-in visitor is sent to `/teach/home`.
- Dev mode: the F-AUTH-001 form (only when `devAuthEnabled()`; it is **false whenever a publishable key is present**). Otherwise `COPY.clerkPending`.

### 3.4 API client (`lib/console/api.ts`)

- `createConsoleApi({ token })` accepts a string or a provider `() => Promise<string | null>`; a null token short-circuits to `{ ok: false, error: 'unauthorized', status: 401 }` without a network call.

### 3.5 Config (`lib/console/config.ts`)

- `clerkPublishableKey(env)` accepts only `pk_test_…` / `pk_live_…` (a pasted secret key is ignored, never bundled). `devAuthEnabled` returns false when a key is present.

### 3.6 Owner operations

- Keys stay in the dashboard (runbook Step 7). Moving the Clerk instance from Development to **Production** later changes both keys and requires the production domain (`hangulroute.com`) in Clerk; the console code does not change.

## 4. Out of scope

- Mobile sign-in (`sync/restore` → "sign in" path, `@clerk/clerk-expo`) → **F-AUTH-004** (the number F-AUTH-002 was reserved for it in F-AUTH-001; this spec took it for the console because the console shipped first).
- Account page (email change, delete learner data from the account, consent record) → F-AUTH-005 / F-SPACE-002.
- Replacing the Account button in the shell with Clerk's `UserButton` → with the account page.

## 5. Tests

| File | Covers |
|---|---|
| `web/lib/console/__tests__/config.test.ts` | publishable-key parsing, dev auth off under Clerk |
| `web/lib/console/__tests__/clerk.test.ts` | display-name order, session mapping |
| `web/lib/console/__tests__/api.test.ts` | token provider per call, signed-out short-circuit |
| `next build` (static export) + `wrangler deploy --dry-run` | widget bundles without a server |
