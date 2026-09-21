# F-CONSOLE-001 — Web console shell (`/teach`): sign-in, first space, home, roster

**Status**: `ready`
**Scope**: `apps/web` (Next.js App Router, `/teach/*`) · `packages/backend` (CORS allow-list) · `apps/api` (Worker vars)
**Owner**: solo dev
**Rollout**: Roadmap S3 (second half) — the adult side of F-SPACE-001

Parent: F-SPACE-001 (all routes exist) · F-AUTH-001 (bearer, dev fallback) · F-TCH-001 §3.2 (roster rules) · wireframes `design/wireframes/console/sign-in.md`, `onboarding-role.md`, `home.md`, `roster.md`

---

## 1. Context

A teacher needs one place to make a class, read the code aloud, and see who practiced — on a laptop, on Sunday. F-SPACE-001 shipped the API; this spec ships the four screens that use it, with the smallest possible chrome. Children never see it. Clerk is not provisioned yet, so sign-in is the F-AUTH-001 dev fallback behind a build flag; the widget swaps in with F-AUTH-002 without touching the pages.

## 2. User story

> As a 한글학교 teacher, I want to sign in, create "Sunday Class A", write its code on the board, and open the roster after the week to see who practiced — without reading anyone's raw history.

## 3. Acceptance criteria

### 3.1 API reachable from browsers

- The Worker answers CORS for `/api/*`: preflight `OPTIONS` → 204 with `Access-Control-Allow-Origin` echoing an **allowed** origin, `Allow-Headers: Content-Type, Authorization`, methods `GET POST PUT DELETE OPTIONS`, `Max-Age` 1 day. Disallowed origins get no `Allow-Origin` header (the browser blocks).
- Allowed origins come from the Worker var `ALLOWED_ORIGINS` (comma-separated). Unset → the defaults: `https://hangulroute.com`, `https://www.hangulroute.com`, `https://app.hangulroute.com`, any `https://*.workers.dev`, and `http://localhost:*` / `http://127.0.0.1:*`. Pure `lib/cors.ts`, 100 % tested.

### 3.2 Sign-in — `/teach` (`console/sign-in`)

- Three "why sign in" rows, the "Kids don't need an account" line, and the sign-in box.
- **Dev sign-in** (account id · your name · email optional) renders only when `devAuthEnabled`: `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`, or a non-production build. Otherwise the box says sign-in arrives with the Clerk connection (F-AUTH-002) and links back to the landing page.
- Submit → session `{ token, accountId, displayName, email }` kept in `sessionStorage` through `lib/console/session.ts` (try/catch wrapper — the web stand-in for `packages/hooks`) → `GET /api/spaces` → no spaces → `/teach/start`, else `/teach/home`. Network failure → one line + Try again; nothing stored.

### 3.3 First space — `/teach/start` (`console/onboarding-role`)

- Step 1 role cards (Parent / caregiver · Teacher · School admin) — radio style, Continue.
- Step 2 name, prefilled (`"<name> family"` · `"Class A"` · `"<name> school"`), Create → `POST /api/spaces` (owner membership in the same call).
- Step 3 (teacher only): the code large, "expires in 30 days", Copy, "Write it on the board", **Go to my class** → `/teach/space/:id`. Parent / admin → `/teach/home`.
- Reached from home's **+ New space** as well (returns to home after creation, except teachers who still get step 3).

### 3.4 Home — `/teach/home` (`console/home`)

- Spaces grouped Family / Classes / School, most recent first, one status line each (counts only: "2 learners", "12 students", "4 classes"); archived rows dimmed and last. **Open** → `/teach/space/:id`.
- Empty (no memberships): one card + **Create a space**. Fetch failure: error card + Try again (no misleading empty state).
- Top bar: Console · Account / Billing (disabled, "coming soon") · Sign out (clears the session).

### 3.5 Roster — `/teach/space/:id` (`console/roster`, read-only)

- Header: name, member count, back to home. Join-code panel (code, "expires in N days" / "expired", Copy, **Regenerate** behind a confirm — "the old code stops working") when the API returns a code; family/school owners get **Create a code** the same way.
- Cap banner from **80 %** of the free cap (20) on classes; persistent at the cap.
- Class roll-up computed client-side from summaries (`lib/console/rollup.ts`, pure): practiced this week (`minutesLast7d > 0`), Stage 1 anchor accuracy (mean of non-null), jamo to revisit together (most frequent `needsPractice`, ≤ 3), "haven't synced in 7+ days" count. No averages of time, no percentiles, no ranking.
- Student cards sorted as the API returns them (most recent activity first): name, age, last active ("today" / "yesterday" / weekday / date), quests `done / total`, minutes this week, revisit jamo, "not synced yet" when there is no summary.
- Empty: the code panel doubled in size + "Write it on the board — students join from Settings → Classes & family → Join a class." Plan / re-link / settings actions are visible but disabled with "coming with plans" (S4/S5).
- Copy on this surface passes the caregiver ban list (`lib/console/banned-text.ts`, mirror of `apps/mobile/src/logic/homework/banned-text.ts`), asserted in tests.

### 3.6 Landing

- Header nav gains **For teachers** → `/teach`; footer gains **Teacher console**.

## 4. Out of scope

- Clerk widget and real session verification → F-AUTH-002 (also removes the dev form). Account / billing pages → F-ENT-001. Plan builder → F-PLAN-001. Re-link approval, space settings, anonymize mode, learner detail page → S5 (F-TCH-001 promotion). School admin tree → S7.
- "Show rescue code" on a student card (roster wireframe): the server stores only the hash, so this becomes **Issue a new code** (rotates, caregiver/teacher path of `/recovery/issue`) in S5.
- Account join by code from home ("enter a code I was given") → S7 with teacher invites.

## 5. Tests

| File | Coverage |
|---|---|
| `backend/lib/__tests__/cors.test.ts` · `backend/__tests__/cors.test.ts` | allow-list parsing + defaults; preflight and simple-request headers through the app |
| `web/src/lib/console/__tests__/api.test.ts` | every method: 200 mapping, 401 / 403 / 404 / 422 / network |
| `web/src/lib/console/__tests__/session.test.ts` | read / write / clear, corrupt JSON, storage that throws, no storage (SSR) |
| `web/src/lib/console/__tests__/rollup.test.ts` | roll-up counts, accuracy mean ignoring null, revisit ranking, not-synced rule, relative day, code expiry, cap banner thresholds |
| `web/src/lib/console/__tests__/routing.test.ts` | landing after sign-in / create, grouping + ordering + archived last, status lines, prefills |
| `web/src/lib/console/__tests__/copy.test.ts` | every console string is caregiver-safe; `devAuthEnabled` matrix |
