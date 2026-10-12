Status: ready

# F-APP-001 — One product app: app.hangulroute.com with persona sign-in (learner, parent or caregiver, teacher) and a home per persona

> **Status note.** `ready` means the spec can be implemented PR by PR in the order of section 6. Owner decisions do **not** gate the whole spec: each one gates only the PRs named in section 8, and each has a default that applies until the owner answers. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below was read at that commit.
>
> **Owner request (2026-10-11), items this spec owns:** (1) hangulroute.com and app.hangulroute.com get clearly separate roles; (3) on app.hangulroute.com each persona signs in and sees different screens; (5) the learner experience stays optimised for learning; (13) everything user-friendly. Item 12 (billing only on the app host) is delivered here as **routing and hosting**; the billing page itself belongs to the billing spec (wave 2026-10-11, branch `docs/billing-in-app-all-personas`).

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a design mock and a wireframe)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now | A-0 docs, A-1 shared module | — | amendments, telemetry rows, pure shared code |
| after A-1 merged and the API Worker deployed | A-2 service worker, A-6 learner plumbing | names on the Worker (rule "Worker first") | A-6 emits `shell.*` events |
| after A-2 | A-3 merged build | denylist in production for at least 7 days before A-10 | installed learner PWAs must update before grown-ups are sent to the app host (section 3.4) |
| after A-1 | A-4 sign-in, router and lock | — | pages behind no link until A-10 |
| after A-4 and the design pass | A-5a frame and teacher home, A-5b parent home, A-5c billing route | design mocks `design/screens/` for the frame, the parent home and the lock | CLAUDE.md section 5 "no component without a mock" |
| after A-6 and the design pass | A-7 learner entry points | mock of the Welcome persona row and the dashboard card | flag off until A-10 |
| after A-3 | A-8 site redirect stubs | — | no-op until `CONSOLE_ORIGIN` is set on the site build |
| after A-5c is live on the app host | A-9 Stripe return URLs | — | returns must land on a page that exists |
| last | A-10 flip defaults + full e2e | OD-10 (default: owner verifies sign-in on the app host once) | |

**Scope**: `packages/content-schema` (new `schemas/app-shell.ts`, `LECTURE_CONSOLE_ORIGINS`, telemetry names) · `apps/mobile` (root chooser in `index.ts`, `platform/app-root*.ts`, `platform/grown-up-handoff*.ts`, `logic/shell/`, device gate marker writer, PIN destination `GrownUpArea`, Welcome persona row, ParentDashboard card, paywall billing link, `privacyUrl`, flag, `scripts/pwa-postbuild.mjs`, new `scripts/app-host/merge-console.mjs`, `public/_headers`, `package.json` `build:web`, e2e) · `apps/web` (new `scripts/console-split.mjs`, `build:console`, `/signin`, `/start`, `/teach` router, `GrownUpLock`, `AdultFrame`, real `/parent` home replacing the demo, `/parent/space*` and `/account/billing` route aliases, legacy redirect pages, `lib/console/{grown-up-lock,personas,shell-nav,device-marker,unlock}.ts`, `ROUTES`) · `packages/backend` (Stripe return and portal URLs) · `packages/i18n` (`learner.welcome.grownUps`, `caregiver.grownUpHome`, `console.shell`, `console.signIn.persona`, `console.lock`, `console.parentHome`, `console.offline`, `a11y.shell`) · `.github/workflows/web-app.yml`, `preview-deploy.yml` · docs (app map, runbook, amendments)
**Owner**: solo dev
**Rollout**: learner entry points behind `flags.grownUpHomeEnabled` (`EXPO_PUBLIC_GROWN_UP_HOME`, default off); site redirects behind the site build variable `CONSOLE_ORIGIN` (unset = today's behaviour). A-10 flips both defaults. No D1 migration. No new endpoint.
**Wireframes** (this PR): `design/wireframes/shell/` `signin.md`, `adult-frame.md`, `parent-home.md`, `teacher-home.md`, `grown-up-lock.md`, `offline.md`, `moved.md`; `design/wireframes/onboarding/welcome-personas.md`; `design/wireframes/parent/grown-up-home-card.md`

Parent / siblings: CLAUDE.md section 1 (any age, child safety, anti-shame, UI locales) · F-CONSOLE-001 (console shell, section 3.7 static export; amended) · F-AUTH-002 (Clerk client SDK; section 3.6 amended) · F-ENT-001 (section 3.5 paywall link, section 3.6 billing page; amended) · F-TCH-004 (presenter at `/present`, TD1 second root; `LECTURE_CONSOLE_ORIGINS`) · F-PROF-001 / F-LEARN-001 (PIN gate, `gateRequired`, `gateOpensDirectly`, 15-minute session) · F-PWA-001 (service worker, telemetry queue) · F-I18N-001 (locales, `?lang=` hand-off) · F-SPACE-001 (memberships and roles) · F-PAR-001 (in-app dashboard) · sibling specs of wave 2026-10-11, section 6.4

---

## 1. Context

The owner wants two clearly different places: **hangulroute.com** explains the service, **app.hangulroute.com** is where every persona signs in and uses it. Today the split runs the other way for grown-ups.

Facts at `ea9049e4`:

**Two static Workers, two frameworks.**

- `app.hangulroute.com` is the learner app: Expo web export, Worker `hangul-route-app`, assets only, `not_found_handling = "single-page-application"`, `html_handling = "auto-trailing-slash"` (`apps/mobile/wrangler.toml:15-19`). The custom domain is attached in the dashboard (`:21-25`). Build: `build:web` = audio map, `expo export --platform web --output-dir dist`, `scripts/pwa-postbuild.mjs dist` (`apps/mobile/package.json:22`).
- `hangulroute.com` and `www` are one Next 14 static export, Worker `hangul-route-web`, `not_found_handling = "404-page"` (`apps/web/wrangler.toml:22-26`, `apps/web/next.config.js:6`). That one export serves the landing, About, Privacy, Terms **and** the whole grown-up console: `/teach` (sign-in), `/teach/start`, `/teach/home`, `/teach/space*`, `/teach/billing`, plus the `/parent` demo on mock data (`apps/web/src/app/(console)/`).
- The learner app has **no URL routing**: React Navigation with no `linking` (`App.tsx:96`), so every path serves the same SPA. `index.ts:1-4` registers `App` only; F-TCH-004 TD1 already plans a second root for `/present`.

**Service worker and manifest (the main technical constraint).**

- `pwa-postbuild.mjs:101-109` generates a Workbox worker with `navigateFallback: '/index.html'` and **no denylist**, `clientsClaim: true`, `skipWaiting: false`. Every navigation on `app.hangulroute.com`, online or offline, is answered with the learner shell by any device that has visited once.
- The precache glob is `**/*.{js,html,ico,png,json,webmanifest,svg,mp3,woff2}` (`:95`): anything copied into `dist` would be precached into the learner's offline bundle.
- The manifest has `"id": "/"`, `"start_url": "/"`, `"scope": "/"` (`apps/mobile/public/manifest.webmanifest:5-7`). Changing any of them orphans installed PWAs.

**Grown-up sign-in, billing and links all point at hangulroute.com.**

- Clerk runs only in the console, client SDK (`apps/web/src/components/console/auth-context.tsx:3`), hash routing, sign-out to `ROUTES.signIn = '/teach'` (`apps/web/src/lib/console/routing.ts:7`, `auth-context.tsx:55`). The API verifies the bearer with `verifyToken` and no `authorizedParties` (`packages/backend/src/lib/auth.ts:30`), so a token minted on another subdomain of the same Clerk instance is accepted. Production runs the Clerk Production instance (owner memory, 2026-10-11); a Production instance serves the root domain and its subdomains.
- CORS already allows `https://app.hangulroute.com` (`packages/backend/src/lib/cors.ts:6`).
- Stripe Checkout success, cancel and the portal return go to `${CONSOLE_URL ?? 'https://hangulroute.com'}/teach/billing` (`packages/backend/src/routes/entitlements.ts:82, 127`).
- The learner paywall opens `${EXPO_PUBLIC_CONSOLE_URL ?? 'https://hangulroute.com'}/teach/billing` (`apps/mobile/src/logic/paywall.ts:48-55`); the same variable builds the Privacy link (`logic/links.ts:1-14`), so one variable mixes "site" and "console".
- The lecture presenter accepts roster messages only from `LECTURE_CONSOLE_ORIGINS` = hangulroute.com, www and localhost (`packages/content-schema/src/schemas/lecture.ts:179-183`).
- The console header links "Back to site" to `/` (`apps/web/src/components/console/ui.tsx:89-92`): on the app host `/` is the learner app.

**No personas in the product.**

- The learner app has no adult entry except the PIN-gated grown-up zone (Profile, `ProfileScreen.tsx:73-95`) leading to the local `ParentDashboard` and the paywall. The gate opens directly inside a 15-minute session (`logic/profiles/session.ts:9`, `store/ui-store.ts:26` `openParentGate`) or on a self-only device without a PIN (`logic/profiles/gate-route.ts:12-18`, `learner-type.ts:52-57`).
- Welcome offers Start and Restore only (`screens/onboarding/WelcomeScreen.tsx:43-55`).
- The console has no persona: after sign-in one `/teach/home` lists Family, Classes and School spaces together (F-CONSOLE-001 section 3.4). Roles exist per membership: `owner | caregiver | teacher | admin | student` (`packages/content-schema/src/schemas/space.ts:36`), returned with each space by `GET /api/spaces` (`apps/web/src/lib/console/api.ts:28-34`).
- Learners have no account by design ("Kids don't need an account — they join with a code", F-CONSOLE-001 section 3.2). They keep local profiles, a Rescue Code (F-RESTORE-001) and class or family join codes (F-SPACE-001).
- The console has no telemetry client (`apps/web/src/lib/i18n/locale-context.tsx:20`).

**What is missing against the owner request.** No persona choice anywhere; no grown-up sign-in on the app host; grown-up pages and billing on the marketing host; no rule for a shared family tablet where a grown-up is signed in and children learn; no migration path for existing bookmarks, Stripe sessions and installed PWAs.

## 2. User stories

> As a **parent**, I open app.hangulroute.com on my phone, tap "Parent or caregiver", sign in with Google, and land on my family's home: my children, their progress, messages and billing in one place.
>
> As a **teacher**, I open the same address on the classroom laptop, sign in, and land on my classes. If I also have a family, one switch takes me to it.
>
> As a **learner** of any age, I open the app and learn. I never see grown-up menus, and nothing asks me for an email.
>
> As a **parent on a shared tablet**, I can open my grown-up home from the app with my PIN; my children cannot open it, even though I stay signed in.
>
> As an **existing teacher** with a bookmark to hangulroute.com/teach/space?id=…, the link still works and takes me to the same page on the app host.

## 3. Acceptance criteria

### 3.1 Architecture decision (AD-1): one host, two bundles, one Worker

Options measured against the owner request, child safety, cost and production risk:

| Option | What it is | Meets items 3 and 12 | Cost | Main risks |
|---|---|---|---|---|
| A | Rewrite the console (about 15 Next pages, Clerk, billing) as Expo screens | yes | very high (weeks) | Clerk and adult code inside the child's offline bundle and the native binary; billing links in an iOS build (App Review 3.1.1); lose the console tests |
| B1 | Keep the Next console; Worker routes `app.hangulroute.com/teach*` etc. to `hangul-route-web` | yes | low | depends on dashboard routes the owner must add; precedence of a route over a Custom Domain Worker is unverified; two deploys must agree on paths |
| **B2** | **Keep the Next console; build it in a "console" role and copy its pages into the learner Worker's `dist` under reserved prefixes** | **yes** | **low to medium (about 3 days of code)** | **one deploy builds two frameworks; service worker must exclude the prefixes (solved in section 3.4)** |
| B3 | Next `basePath` plus a router Worker with service bindings | yes | medium | new Worker code (`main`), more moving parts |
| C | Console on `console.hangulroute.com` | **no** (owner asked for app.hangulroute.com) | lowest | a third user-facing host |

**Decision: B2.** Reasons:

1. It keeps every console page, its Clerk integration and its tests unchanged (`apps/web` stays the source); only the deployment target changes.
2. No dashboard routing and no Worker code: the learner Worker stays assets-only. The only owner steps are build variables and two dashboard values (section 6.2).
3. Same origin for learner and grown-up pages enables the PIN hand-off through `sessionStorage` (section 3.9), the same-origin presenter hand-off (F-TCH-004) and the adult content browser of the sibling spec without cross-origin messaging.
4. The child's offline bundle stays free of adult code: console files are excluded from the precache and never imported by the learner bundle.
5. Native builds are untouched: adult pages exist only on the web host.

Consequences accepted: the learner Worker's build also runs `next build` (about 1-2 minutes); a console change redeploys the learner Worker but does **not** change `sw.js` (console files are not precached), so learners see no update banner for console-only changes.

### 3.2 Hosts and the route map

**hangulroute.com (site role)**: landing, About, Privacy, Terms, waitlist, `/design-preview/*`. No sign-in, no billing, no grown-up page (the marketing spec, branch `docs/marketing-site-layered`, owns the content). Old grown-up paths answer with redirect stubs (section 3.13).

**app.hangulroute.com (app role)**: every path below. The table is the contract for all sibling specs; it lives in code as `APP_ROUTES` and `GROWN_UP_PREFIXES` (section 3.14).

| Path | Bundle | Owner | What |
|---|---|---|---|
| `/signin` | console | this spec | grown-up sign-in and the router into the grown-up area |
| `/start` | console | this spec (moved from `/teach/start`) | first space for a grown-up with none (role cards) |
| `/parent` | console | this spec (frame), reports spec (content) | parent home |
| `/parent/space?id=`, `/parent/space/plan?id=`, `/parent/space/curriculum?id=`, `/parent/space/settings?id=` | console | this spec (aliases of the existing pages) | a family space |
| `/parent/*` (other) | console | reports, feedback, browse specs | reserved for the parent persona |
| `/teach` | console | this spec | router: signed out to `/signin?persona=teacher`, signed in to the persona home |
| `/teach/home` | console | this spec (filtered) | teacher home |
| `/teach/space*` | console | existing (F-CONSOLE-001, F-TCH-001, F-PLAN-*, F-TCH-004) | class and school spaces |
| `/teach/*` (other) | console | reports, feedback, browse specs | reserved for the teacher persona |
| `/account/billing` | console | this spec (alias), billing spec (content) | billing for every grown-up |
| `/account/*` (other) | console | billing spec, later account page (F-AUTH-005) | persona-neutral grown-up pages |
| `/teach/billing`, `/teach/start` | console | this spec | legacy: client redirect to `/account/billing`, `/start` (query kept) |
| `/present` | learner | F-TCH-004 | presenter root (TD1) |
| `/browse` | learner | adult content browser spec (branch `docs/adult-content-browser`) | reserved as a second root of the learner bundle; never a console page |
| `/` and every other path | learner | — | the learner app |

Rules:

- **R-1** A grown-up path is `/signin`, `/start`, `/teach`, `/parent`, `/account`, each followed by end of path, `/`, `?` or `.` (so `/teach.html` and `/teach.txt` match and `/teacher` does not). `isGrownUpPath` (section 3.14) is the only implementation.
- **R-2** Learner identifiers in URLs are opaque ids in `?id=` (F-CONSOLE-001 section 3.7). No path or query ever holds a learner's name, initials or email. The demo slugs (`/parent/mina`, `/parent/jun`) are removed with the demo (OD-4).
- **R-3** No new grown-up prefix may be added without amending this table (A sibling spec that needs one amends section 3.2 in its docs PR).

### 3.3 Build and deploy

- **Console role** (`apps/web`): new script `build:console` = `next build && node scripts/console-split.mjs --role console out`. It writes `apps/web/out-console/` holding only: every exported file whose path matches a grown-up prefix (R-1), including the `.html` pages and their React Server Component `.txt` payloads, plus the whole `_next/` folder. It never copies `index.html`, `404.html`, `about*`, `privacy*`, `terms*`, `es*`, `ko*` or `design-preview*`. The split script imports `GROWN_UP_PREFIXES` from `packages/content-schema` through `scripts/ts-loader.mjs` (precedent: `scripts/check-i18n.mjs`), so the list exists once.
- **Site role**: `build` stays `next build && node scripts/prune-hidden-locales.mjs out`, then `node scripts/console-split.mjs --role site out`. With `CONSOLE_ORIGIN` unset the site step does nothing (today's output, byte for byte). With `CONSOLE_ORIGIN=https://app.hangulroute.com` it replaces every grown-up page in `out/` with a redirect stub (section 3.13). The Workers Builds command of `hangul-route-web` does not change.
- **Merged learner build** (`apps/mobile`): `build:web` becomes audio map, `expo export`, `node scripts/app-host/merge-console.mjs dist`, `pwa-postbuild.mjs dist`. `merge-console.mjs`:
  - runs `pnpm --filter @hangul-route/web build:console` unless `SKIP_CONSOLE=1` (local learner-only builds and `build:web:fixtures` set it);
  - passes `NEXT_PUBLIC_API_BASE_URL` from `EXPO_PUBLIC_API_BASE_URL` when the first is unset, and `NEXT_PUBLIC_APP_URL` defaults to `https://app.hangulroute.com` (`apps/web/src/lib/console/config.ts:68`);
  - copies `out-console/**` into `dist/` and **fails the build** if any target path already exists in `dist` (collision guard), if a copied path is not a grown-up path or under `_next/`, or if `dist/index.html` would be touched;
  - writes nothing when `SKIP_CONSOLE=1`, so learner-only builds are unchanged.
- The Workers Builds command of `hangul-route-app` does not change (`pnpm --filter @hangul-route/mobile build:web`); its build variables gain `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and optionally `NEXT_PUBLIC_LECTURE_MODE`, `NEXT_PUBLIC_SCHOOL_CONSENT_MODE`) in owner step S-1. Until then the console pages on the app host show the existing "sign-in is not set up on this build" line (`devAuthEnabled` is false in a production build, `config.ts:47-52`); nothing links there before A-10.
- `apps/mobile/public/_headers` gains `/_next/static/*  Cache-Control: public, max-age=31536000, immutable` (same rule as `apps/web/public/_headers`). The learner rules are unchanged.
- CI: `.github/workflows/web-app.yml` ("Build PWA · offline e2e", required) adds `apps/web/**` to its path filter and builds with the console (no `SKIP_CONSOLE`), so the merged output is what is tested. `preview-deploy.yml` keeps its checks over `apps/web/out` and adds `test -f apps/web/out-console/teach/home.html` and `test ! -f apps/web/out-console/index.html` after a `build:console` run.

### 3.4 Service worker and manifest

- `pwa-postbuild.mjs` (A-2):
  - `navigateFallbackDenylist`: one RegExp per grown-up prefix built from `GROWN_UP_PREFIXES` (R-1 boundaries), so a navigation to a grown-up path never receives the learner shell.
  - A runtime rule for **navigations** to grown-up paths: `NetworkOnly` with `precacheFallback` to `/grown-ups-offline.html` (section 3.12).
  - `globIgnores` adds every grown-up path and `_next/**`; a new guard `consoleLeaks(manifestUrls)` fails the build if any precache entry is a grown-up path or under `_next/` (same shape as `precacheLeaks`, `scripts/audio/lib.mjs`).
  - Generates `dist/grown-ups-offline.html`: self-contained (inline styles from tokens read like `canvas` and `brand` at `:16-20`, no script except locale pick), precached.
- The manifest is **not changed**: `id`, `start_url` and `scope` stay `/`, so no installed PWA is orphaned. Grown-up pages are inside the scope: opened from an installed learner PWA they stay in its window. The adult frame therefore always shows "Back to learning" (section 3.8), because a standalone window has no address bar.
- **Old workers.** A device whose installed worker predates A-2 still answers grown-up navigations with the learner shell until its new worker activates (on "Update ready" or after every window of the app closes). The learner app shows its normal home there. Mitigation: A-2 reaches production **at least 7 days before** A-10 sends anyone to the app host (section 6.1), and the bounce rule below sends a learner bundle that boots on a grown-up path to the right place once updated.
- **Bounce rule** (A-6). `index.ts` chooses the root before `App` mounts (as F-TCH-004 TD1 does for `/present`): `platform/app-root.web.ts` returns `'grown-up-bounce'` when `isGrownUpPath(location.pathname)`. This only happens when the Worker's SPA fallback served `index.html` for a grown-up path that has no file (an unknown or mistyped URL). The bounce root renders nothing, emits `shell.path_bounced`, and calls `location.replace` with the persona entry for the prefix: `/parent*` to `/parent`, `/teach*` to `/teach`, anything else to `/signin`. Native stub: always `'app'`.

### 3.5 Personas

- Personas: `learner`, `parent` (parent or caregiver), `teacher` (teacher or school admin). `PersonaSchema` and `AdultPersonaSchema` live in `schemas/app-shell.ts`.
- **Learner** is a device role, not an account: whoever uses a local learner profile. Learners never sign in with an email or a password (OD-2). A learner "signs in" by choosing their profile on the device, by restoring with a Rescue Code (F-RESTORE-001) or a backup file (F-SYNC-002), or by joining a class or family with a code (F-SPACE-001). This keeps the rule "verifiable parental consent before personal data is linked to an account": no learner account exists to link.
- **Adult personas come from memberships**, never from a self-declared flag: `personasFor(memberships)` returns `parent` when the account holds a `family` space as `owner` or `caregiver`, and `teacher` when it holds a `class` space as `owner` or `teacher`, or a `school` space as `owner`, `admin` or `teacher`. `student` memberships are ignored (accounts never hold them). Archived spaces count (their pages stay reachable). Order: `parent`, then `teacher`.
- An account with no space has no persona yet: the router sends it to `/start`, whose role cards (Parent or caregiver · Teacher · School admin, F-CONSOLE-001 section 3.3) create the first space and therefore the persona. A `?persona=` hint preselects the matching card.
- **Persona home** (`homeFor({ personas, last, hint })`, pure): no persona → `/start`; the `hint` when the account has it; else `last` when the account still has it; else the only persona; else `parent`. Homes: `parent` → `/parent`, `teacher` → `/teach/home`.
- **Last persona** is remembered per browser in IndexedDB key `hr:shell:lastPersona` (`LastPersonaSchema`, `{ v: 1, persona }`) written by the adult frame whenever a persona home renders. It holds a persona code only. The learner Welcome reads it to offer "Continue as …" (section 3.6). It is a convenience: unreadable or missing means "none".

### 3.6 Learner side: entry and home

- **Welcome** (web only, behind `flags.grownUpHomeEnabled`; wireframe `onboarding/welcome-personas.md`). The hero button stays "Let's start" (unchanged position and size; F-I18N-001 section 3.3 keeps the primary action fixed). Below the existing "I already have progress" link, one short row: "Here to support a learner?" with two secondary buttons, **Parent or caregiver** and **Teacher**, which navigate the tab to `/signin?persona=parent` or `/signin?persona=teacher`. Emits `shell.persona_chosen { persona, from: 'welcome' }`; "Let's start" emits `{ persona: 'learner', from: 'welcome' }`.
- When `hr:shell:lastPersona` exists, the row becomes one button **Continue as parent** or **Continue as teacher** (to `/signin`, which routes a signed-in grown-up home) plus a small "Someone else" link that shows the two-button row. Emits `{ persona, from: 'welcome-continue' }`.
- Welcome only shows when the device has no learner profile (`navigation/root.tsx`, initial route `Onboarding`), so a child who already plays never sees the row. Native builds never show it (OD-6).
- **Learner home is unchanged by this spec**: tabs Home, Journey, Library; LEARNING ROUTE is the learning route spec (branch `docs/learning-route`). No grown-up menu is added to any learner tab. The only grown-up entry inside the learner app stays the PIN-gated grown-up zone on Profile.
- **Grown-up home card** (wireframe `parent/grown-up-home-card.md`): `ParentDashboardScreen` (behind the gate already) shows, on web with the flag on, one card at the top: title "Grown-up home", one line ("Reports, messages and billing for your account"), button **Open**. It calls `openGrownUpArea({ via: 'dashboard' })` (section 3.9). The local dashboard below it is unchanged and still works offline and without an account.
- **Paywall** (web, flag on): the "Manage plan" or "Get the family plan" button calls `openGrownUpArea({ via: 'paywall', target: '/account/billing' })` in the same tab instead of opening hangulroute.com. Native builds keep F-ENT-001 section 3.5 behaviour (no purchase link). Flag off: today's `consoleBillingUrl()`.
- **Privacy link**: `privacyUrl()` reads `EXPO_PUBLIC_SITE_URL`, then `EXPO_PUBLIC_CONSOLE_URL` (back-compat), then `https://hangulroute.com`. Legal pages stay on the site.

### 3.7 Grown-up sign-in and routing on the app host

- **`/signin`** (wireframe `shell/signin.md`) replaces the sign-in at `/teach`. Same Clerk widget and dev fallback as F-AUTH-002 section 3.3 (`<SignIn routing="hash" …/>`). Copy follows `?persona=`: parent intro, teacher intro, or a neutral intro without a hint. The "Kids don't need an account" line is replaced by "Learners don't need an account. They join with a code." (any-age wording). A link "I'm here to learn" goes to `/`.
- **After sign-in, and for a visitor who is already signed in**: `GET /api/spaces` → `personasFor` → `safeNextPath(?next)` when present and allowed for the account, else `homeFor({ personas, last, hint })`. One `location.replace`, no extra tap. Network failure: one line and Try again (F-CONSOLE-001 section 3.2 behaviour).
- A sign-in completed **in this tab** writes the grown-up unlock (section 3.9), because it proves the person holds the account's credentials.
- **`/teach`** becomes a router page (no UI beyond a loading line): signed out → `/signin?persona=teacher&next=<current path and query>` when it has a query, else `/signin?persona=teacher`; signed in → `homeFor` with hint `teacher`.
- **`/start`** is the existing first-space page moved from `/teach/start` (component unchanged); `/teach/start` becomes a client redirect page to `/start` with the query kept. After creating a family the router lands on `/parent`; a class keeps step 3 (the code) then `/teach/space?id=`; a school goes to `/teach/home`.
- Clerk: `afterSignOutUrl` and `signOut({ redirectUrl })` become `/signin`; `fallbackRedirectUrl` becomes `/signin` (the router), `signUpFallbackRedirectUrl` becomes `/start`. `ROUTES.signIn = '/signin'`, `ROUTES.start = '/start'`.
- Every grown-up page uses one layout (`LocaleProvider`, `ConsoleAuthProvider`, `GrownUpLock`); `/signin` is exempt from the lock. A signed-out visitor on any other grown-up page is sent to `/signin?next=<path and query>` (today `useConsole()` sends to `/teach`, F-AUTH-002 section 3.1).
- Console locale: `pickConsoleLocale` reads a valid `?lang=` first and stores it (F-I18N-001 hand-off convention); then the stored choice; then the browser.

### 3.8 The adult frame and the persona homes

**Frame** (`components/console/AdultFrame.tsx`, replaces `ConsoleShell`; wireframe `shell/adult-frame.md`):

- Left of the header: product name linking to the current persona home; the **persona switch** (segmented, two options) only when the account has both personas; otherwise the persona name as plain text.
- Navigation: items come from one registry, `lib/console/shell-nav.ts` (`ADULT_NAV: { id, persona: AdultPersona | 'both', href, labelKey, enabled(ctx) }[]`). This spec registers: parent **Home** (`/parent`), teacher **Classes** (`/teach/home`), both **Billing** (`/account/billing`). Sibling specs add their items in their own PRs (reports, messages, browse lessons). An item whose page is not built is **not shown** (no disabled "coming soon" buttons; the disabled Account button of `ui.tsx:100` is removed).
- Right of the header: language select (existing), **Back to learning** (clears the unlock, then `location.assign('/')`), Sign out.
- Footer: "About Hangul Route" to `https://hangulroute.com` (the site), Privacy, Terms (site links). "Back to site" (`console.shell.backToSite`) is removed: on the app host `/` is the learner app.
- Phone width: the navigation collapses into a row of tabs under the header (no hamburger menu); targets use `touchTarget`.
- Switching persona: writes `hr:shell:lastPersona` and navigates to the other home.

**Parent home** `/parent` (wireframe `shell/parent-home.md`; the demo and `apps/web/src/data/mock-family.ts` are removed, OD-4):

- Data: `GET /api/spaces` (family spaces), then `GET /api/spaces/:id/roster` per family space (existing routes; the roster is projected to the consented allow-list, `packages/backend/src/lib/roster-summary.ts`).
- One section per family space (usually one): family name, then one card per learner: avatar, display name, last active ("today" / "yesterday" / weekday), minutes this week, and **Open**. Until the reports spec (branch `docs/progress-reports`) lands its child page, **Open** goes to `/parent/space?id=<familyId>`; after, it goes to that spec's child route (an id, never a name).
- Actions under the cards: **Plan the week** (`/parent/space/plan?id=`), **Plan the term** (`/parent/space/curriculum?id=`), **Family settings** (`/parent/space/settings?id=`), **Add a learner** (shows the family join code panel already on the roster page).
- Empty (family with no learner yet): the join code panel large, "Open Hangul Route on the learner's device, then Profile, then Classes and family, then Join" (existing join path), and **Open the app on this device** (`/`; clears the unlock like Back to learning).
- No ranking, no comparison between children, no class average (F-PAR-001 section 3.5): cards keep the API order (most recent activity) and show no "best" or "behind" wording; copy passes `lib/console/banned-text.ts`.

**Teacher home** `/teach/home` (wireframe `shell/teacher-home.md`): the existing home with the Family group removed (families live under the parent persona) and a one-line cross-link "Your family is under Parent" when the account also has the parent persona. Classes and School groups, **+ New class** (to `/start?persona=teacher`), statuses and links unchanged.

**Family space pages under `/parent`**: `app/(console)/parent/space/page.tsx`, `.../plan`, `.../curriculum`, `.../settings` re-export the existing `/teach/space*` page components. `ROUTES.space(id)` and siblings gain a `kind` argument: `family` → `/parent/space…`, `class` and `school` → `/teach/space…`. The `/teach/space?id=<family>` URL keeps working (same component), so no link breaks.

**Billing**: `app/(console)/account/billing/page.tsx` re-exports today's billing page; `/teach/billing` becomes a client redirect to `/account/billing` with the query kept (Stripe `?checkout=` returns). The billing spec then changes the page in place.

### 3.9 Shared devices: child profiles and grown-up sign-in on one browser

The problem: a parent signs in once on the family tablet (Clerk keeps the session for days). A child on the same browser must not reach grown-up pages, even though Clerk would let the browser in.

**Device gate marker.** The learner app writes IndexedDB key `hr:device:gate` = `{ v: 1, gate: 'pin' | 'none' }` (`DeviceGateMarkerSchema`) whenever profiles or the PIN change, and on boot: `gate = 'pin'` when the device has at least one learner profile and `gateRequired(...)` is true (`learner-type.ts:52-57`); else `'none'`. It holds no name, no count and no profile data. Written through `platform/storage` (`writeJson('device:gate', …)`), from A-6 on, independent of the flag.

**Grown-up lock** (`GrownUpLock`, decision in `lib/console/grown-up-lock.ts`, pure, 100 % covered; wireframe `shell/grown-up-lock.md`):

| Marker | Unlock in this tab | Result |
|---|---|---|
| any | — on `/signin` | open (exempt) |
| absent and no `hr:profiles` key, or `none`, or storage unreadable | — | open |
| absent but `hr:profiles` holds a non-empty list (a learner app older than A-6) | active | open |
| absent but `hr:profiles` holds a non-empty list | none or expired | locked |
| `pin` | active | open (refresh `seen`) |
| `pin` | none or expired | locked |

- The `hr:profiles` fallback reads only whether the stored string is longer than `[]`; it never parses or shows profile data. "Storage unreadable" means open because a browser that cannot use IndexedDB cannot keep learner profiles either.
- **Unlock record**: `sessionStorage` key `hr:grownup:unlock` = `{ v: 1, at, seen }` (`GrownUpUnlockSchema`). Active while `now - seen` is in `[0, GROWN_UP_IDLE_MS)`, 15 minutes (the learner gate's `PARENT_SESSION_MS`, `session.ts:9`). The frame refreshes `seen` on navigation and on interaction at most once a minute. `sessionStorage` is per tab and per origin and survives same-tab navigations, including the round trip to Stripe Checkout.
- **Before the decision** the page renders the frame without content and makes **no API call**; no grown-up data is fetched or shown while locked.
- **Lock screen**: title "Grown-ups only", one line, primary **Use the grown-up PIN** → `location.assign('/?gate=grown-up&next=<path and query>')`; secondary **Sign in again** → Clerk sign-out, then `/signin?next=…` (a fresh sign-in writes the unlock); tertiary **Back to learning** → `/`.
- **PIN path in the learner app** (A-6): the learner root parses the boot intent once (`logic/shell/boot-intent.ts`, pure) and removes it from the address with `history.replaceState`. `gate=grown-up` with a `next` accepted by `safeNextPath` opens `PinEntry { next: 'GrownUpArea', url: next }` over the normal start screen (`GrownUpDestination` gains `'GrownUpArea'`). On a correct PIN (or `gateOpensDirectly`), `openGrownUpArea({ via: 'lock', target: next })`. Cancel or back: the learner home, nothing written.
- **`openGrownUpArea({ via, target? })`** (web only, `platform/grown-up-handoff.web.ts`; native stub throws in tests and is never called): writes the unlock `{ v: 1, at: now, seen: now }`, emits `shell.grown_up_handoff { via, target: 'router' | 'billing' | 'next' }`, then `location.assign(target ?? '/signin')` with `?lang=<UI locale>` appended when the learner's UI locale is not the default (F-I18N-001 hand-off). It is only called after the PIN gate passed or `gateOpensDirectly` (dashboard, paywall and lock entries are all behind the gate already).
- **Clearing**: every normal boot of the learner app (a boot that is not a `gate=grown-up` intent) removes `hr:grownup:unlock`; **Back to learning** removes it before leaving; **Sign out** removes it. So a device handed back to a child after the grown-up returns to the app is locked again.
- The learner app never reads the Clerk session, a grown-up's name or email. The console never reads learner progress or profiles (only the marker and the `hr:profiles` presence check above).
- **Self-only devices** (an adult learner's own phone, no PIN): the marker is `none`, so a signed-in grown-up opens directly, mirroring `gateOpensDirectly`.
- **Classroom devices** where students made child profiles: the marker is `pin`; the teacher uses the device PIN or signs in again. A teacher's own laptop without learner profiles has no lock.

### 3.10 Role switching

| From | To | How | Gate |
|---|---|---|---|
| learner | learner | Profile switch (F-PROF-001 section 3.4) | none (unchanged) |
| learner | parent or teacher | Profile → grown-up zone → PIN → dashboard card **Open**; or the paywall | learner PIN gate, then Clerk sign-in if signed out |
| no profile (Welcome) | parent or teacher | persona row → `/signin?persona=` | Clerk sign-in; lock applies only when the marker is `pin` (not possible without profiles) |
| parent | teacher (or back) | persona switch in the frame | none (same account) |
| parent or teacher | learner | **Back to learning** | clears the unlock |
| parent or teacher | another account | Sign out → `/signin` | Clerk |
| any grown-up page | the same page after 15 idle minutes on a `pin` device | lock screen | PIN or fresh sign-in |

A grown-up who is also a learner on the same device uses both: learning at `/`, the grown-up area through the gate.

### 3.11 Deep links and `next`

- **Grown-up deep links** (emails, bookmarks, Stripe returns, links from the site): any grown-up path with its query. Order of checks on load: signed in? (else `/signin?next=`) → lock decision → page. The page itself checks membership through the API (403 shows the existing "no access" panel).
- **`safeNextPath(raw)`** (pure): decodes once; accepts only a relative path that starts with `/`, not `//` or `/\`, has no scheme, no control characters, no `..` segment, is at most 512 characters, and passes `isGrownUpPath`; returns path and query without a fragment; anything else returns `null` (then the persona home is used). This closes open redirects through `next`.
- **Learner deep links**: the learner app stays non-addressable (no `linking`): any non-reserved path opens the learner app's start screen, never a specific learner's data. Boot intents read once and removed from the address: `gate=grown-up&next=` (section 3.9) and the existing `?lang=` (`platform/locale.web.ts`). Unknown query keys are ignored.
- **Second roots** of the learner bundle: `/present` (F-TCH-004) and `/browse` (reserved, adult content browser spec). The root chooser checks them before the bounce rule.
- `/teach/space?id=<family>` and `/parent/space?id=<family>` show the same page; links generated after A-5a use the persona prefix of the space kind.

### 3.12 Offline behaviour

- **Learner app**: unchanged; plays offline after one visit (F-PWA-001).
- **Grown-up pages are online-only** (Clerk and the API need the network; the console never had a service worker). A grown-up navigation while offline is answered by the precached `/grown-ups-offline.html` (wireframe `shell/offline.md`): "You're offline", "Grown-up pages need the internet. Learning still works offline.", **Back to learning** (`/`), **Try again** (reload). Its strings are the shipped locales of `console.offline`, picked by `navigator.languages`, English otherwise.
- A grown-up page already open that loses the network shows the existing "can't reach" panels and Try again (F-CONSOLE-001).
- The lock's PIN path works offline up to the PIN (the learner app is precached); the following navigation lands on the offline page.
- The presenter (`/present`) stays offline-capable (F-TCH-004 section 3.8); nothing here changes its precache.
- A device that never visited the app host and is offline gets the browser's own offline page (no worker yet), as today.

### 3.13 Migration of existing users and URLs

**Phases** (each reversible until M5):

| Phase | What changes | Done by | Reversible by |
|---|---|---|---|
| M0 | denylist and offline page in the learner worker (A-2) | merge | revert |
| M1 | console pages served on the app host as well (A-3); nothing links there | merge + owner step S-1 (Clerk key on `hangul-route-app` build) | revert A-3 |
| M2 | owner signs in once on `app.hangulroute.com/signin`, opens a class and the billing page (OD-10) | owner | — |
| M3 | learner entry points on (`EXPO_PUBLIC_GROWN_UP_HOME=true` on the app build) and site redirects on (`CONSOLE_ORIGIN` on the site build); Stripe `CONSOLE_URL` set to the app host | owner steps S-2, S-3, S-4 | unset the variables, Retry deployment |
| M4 | A-10 flips the code defaults (flag on, `CONSOLE_ORIGIN` default `https://app.hangulroute.com`, API default return base) | merge, at least 14 days after M3 | revert A-10 |
| M5 | (later, optional) delete the console pages from the site build entirely; stubs stay | separate PR | — |

**Redirect stubs on hangulroute.com** (A-8, wireframe `shell/moved.md`). With `CONSOLE_ORIGIN` set, the site role replaces each grown-up page (`teach.html`, `teach/**.html`, `parent.html`, `parent/**.html`) with a small static page that:

- runs `location.replace(CONSOLE_ORIGIN + legacyConsoleTarget(pathname) + search + hash)`, adding `lang=<stored console locale>` from the site's `hr:console:uiLocale` when the query has no `lang` (so the grown-up keeps their language across the move);
- shows, without script, one line "Grown-up pages have moved to app.hangulroute.com" and a link to the same target;
- carries `<meta name="robots" content="noindex">` and the site's `<html lang="en">`;
- holds no tracking and no name: the old URLs held only ids (R-2), and the target holds the same.

`legacyConsoleTarget` maps: `/teach` → `/teach`; `/teach/start` → `/start`; `/teach/billing` → `/account/billing`; `/teach/<rest>` → `/teach/<rest>`; `/parent` and `/parent/<demo slug>` → `/parent`. Query and fragment are kept. HTTP-level redirects (`_redirects`) are not used in this spec (OD-5): stub pages are deterministic, tested end to end, and keep the fragment and query on every browser.

**Who is affected and how**

- **Learners**: nothing changes. Same origin, same IndexedDB, same manifest. Installed PWAs keep working.
- **Grown-ups with a Clerk account**: same Clerk instance and user id, so the same `accounts` row and spaces. They may need to sign in once on the app host. Their console language comes along through the stub's `lang`.
- **In-flight Stripe Checkout** started before M3 returns to `hangulroute.com/teach/billing?checkout=…`; the stub forwards it with the query to `/account/billing?checkout=…`. After A-9 and S-4, new sessions return to the app host directly.
- **Bookmarks and emailed links** to `/teach/space?id=…`: forwarded with the query.
- **Old `/parent/mina` demo links**: forwarded to `/parent` (sign-in), the demo no longer exists.
- **Lecture presenter**: the console now opens `/present` on its own origin; `LECTURE_CONSOLE_ORIGINS` gains `https://app.hangulroute.com` (A-1) and keeps the old entries until M5, so a console still open on the site during the move keeps working.
- **Owner runbook**: Step 6 confirmation line and the build variable table are updated in A-0 (console URL moves, `EXPO_PUBLIC_SITE_URL` replaces `EXPO_PUBLIC_CONSOLE_URL`).

**Rollback**: unset `CONSOLE_ORIGIN` (site serves the console again), set `EXPO_PUBLIC_GROWN_UP_HOME=false`, set `CONSOLE_URL` back; the app host keeps serving console pages harmlessly. No data changes in either direction.

### 3.14 Data and API (additive only)

- **No D1 migration. No new endpoint. No change to any request or response shape.** Personas are derived from `GET /api/spaces` (`role`, `space.kind`), which every console page already calls.
- **New module** `packages/content-schema/src/schemas/app-shell.ts` (exported from `src/index.ts`, appended), pure, 100 % covered:
  - `APP_ORIGIN = 'https://app.hangulroute.com'`, `SITE_ORIGIN = 'https://hangulroute.com'`
  - `PersonaSchema`, `AdultPersonaSchema`, types `Persona`, `AdultPersona`
  - `GROWN_UP_PREFIXES = ['/signin', '/start', '/teach', '/parent', '/account'] as const`, `LEARNER_ROOTS = ['/present', '/browse'] as const`
  - `APP_ROUTES = { signIn: '/signin', start: '/start', parentHome: '/parent', teacherIndex: '/teach', teacherHome: '/teach/home', billing: '/account/billing', learn: '/' } as const`
  - `isGrownUpPath(pathname)`, `isLearnerRoot(pathname)`, `safeNextPath(raw)`, `legacyConsoleTarget(pathname)`
  - `personasFor(memberships: readonly { kind: SpaceKind; role: SpaceRole }[])`, `homeFor({ personas, last, hint })`
  - `DeviceGateMarkerSchema` (`{ v: 1, gate: 'pin' | 'none' }`), `GrownUpUnlockSchema` (`{ v: 1, at, seen }`, finite non-negative numbers), `LastPersonaSchema` (`{ v: 1, persona }`), all lenient on read (`safeParse`; invalid means absent)
  - `GROWN_UP_IDLE_MS = 15 * 60_000`, `unlockActive(record, now)`
  - storage key constants `DEVICE_GATE_KEY = 'device:gate'` (stored as `hr:device:gate`), `LAST_PERSONA_KEY = 'shell:lastPersona'` (stored as `hr:shell:lastPersona`), `UNLOCK_SESSION_KEY = 'hr:grownup:unlock'`
- `LECTURE_CONSOLE_ORIGINS` gains `'https://app.hangulroute.com'` (append).
- `packages/backend/src/routes/entitlements.ts`: the two return builders become one helper `billingReturnUrl(env, suffix)` with base `CONSOLE_URL ?? 'https://app.hangulroute.com'` and path `/account/billing` (A-9). The old path still works through the redirect page and stub.
- `apps/web` adds the dependency `idb-keyval` (already used by `apps/mobile`, same default store) to read the two IndexedDB keys; reads are wrapped in try/catch in `lib/console/device-marker.ts` (the web stand-in for the safe storage hook, like `lib/console/session.ts`). `sessionStorage` access goes through `lib/console/unlock.ts` (try/catch) on the web and `platform/grown-up-handoff.web.ts` in the learner app.

### 3.15 i18n keys (`packages/i18n`, English authored; `ko` / `es` follow the F-I18N-001 overlay process)

| Key | Where | Note |
|---|---|---|
| `learner.welcome.grownUps.lead` | Welcome | "Here to support a learner?" |
| `learner.welcome.grownUps.parent`, `.teacher` | Welcome | button labels |
| `learner.welcome.grownUps.continueParent`, `.continueTeacher`, `.someoneElse` | Welcome | returning grown-up |
| `caregiver.grownUpHome.title`, `.line`, `.cta` | ParentDashboard card | |
| `console.shell.backToLearning`, `.aboutSite`, `.privacy`, `.terms` | frame | `backToSite` is removed (unused after A-5a) |
| `console.shell.persona.groupLabel`, `.parent`, `.teacher` | frame switch | |
| `console.shell.nav.home`, `.classes`, `.billing` | frame | siblings add their own `nav.*` keys |
| `console.signIn.persona.parent.intro`, `.teacher.intro`, `console.signIn.neutralIntro`, `console.signIn.learnersNoAccount`, `console.signIn.imLearning` | `/signin` | replaces `kidsNoAccount` on this page |
| `console.lock.title`, `.line`, `.usePin`, `.signInAgain`, `.backToLearning` | lock | |
| `console.parentHome.title`, `.empty.title`, `.empty.line`, `.empty.openApp`, `.child.open`, `.actions.planWeek`, `.actions.planTerm`, `.actions.settings`, `.actions.addLearner` | `/parent` | reuse `console.roster.*` relative-day and minutes strings |
| `console.home.otherPersona.parent` | teacher home | cross-link line |
| `console.offline.title`, `.line`, `.back`, `.retry` | offline page | read at build time by `pwa-postbuild.mjs` through `scripts/ts-loader.mjs` |
| `landing.consoleMoved.line`, `.link` | site stub | read at build time by `console-split.mjs` |
| `a11y.shell.personaSwitch`, `a11y.shell.lockRegion`, `a11y.shell.redirecting` | frame, lock, stubs | |

Copy rules: shared surfaces (Welcome, `/signin`, stubs, offline page) use no age wording and never say "kids"; grown-up pages may address parents and teachers directly (CLAUDE.md section 1). Draft strings: Appendix A. Every string passes the caregiver ban list (`apps/web/src/lib/console/banned-text.ts`, and `apps/mobile/src/logic/homework/banned-text.ts` for learner strings).

### 3.16 Accessibility

- Persona switch: `role="radiogroup"` with two `role="radio"` options (`aria-checked`), arrow keys move, label `a11y.shell.personaSwitch`. On phone width it keeps text labels (no icon-only control).
- Lock screen: `role="region"` labelled by its heading; focus moves to the heading on mount; the three buttons in visual order; no timer is shown and nothing auto-expires while the screen is open.
- Router and stub pages announce "Taking you to …" in a polite live region (`a11y.shell.redirecting`) and render a visible link (works without script).
- Every new button meets `touchTarget`; body text keeps the 18 floor on learner screens; Tab order equals visual order (asserted by the e2e, as `apps/web/e2e/landing-layout.spec.ts` does for the landing).
- `<html lang>` follows the console locale (existing `LocaleProvider`) and the learner locale; the offline page sets `lang` to the locale it picked.
- No sideways scroll at 320, 375 and 768 for `/signin`, `/parent`, `/teach/home`, the lock and the offline page.

### 3.17 Privacy and child safety

- **No adult screen is reachable by a child**: grown-up pages need a Clerk session; on a device with child profiles they also need a PIN pass or a fresh sign-in in the same tab within 15 idle minutes (section 3.9); every learner-app entry point sits behind the existing PIN gate; the Welcome persona buttons lead to a credential prompt; the lock renders no data and makes no API call.
- **Local-first**: no learner data leaves the device because of this spec. The marker holds `pin` or `none`; the last-persona key holds a persona code; the unlock holds two timestamps; all stay on the device.
- **No learner accounts** (OD-2); account linking stays with the consent flows of F-SPACE-001 / F-SPACE-002 (verifiable parental consent before linking).
- **No names in URLs** (R-2); `next` carries ids only; stubs forward only what the old URL held.
- **Child's offline bundle** contains no console code (`consoleLeaks` build guard); the learner bundle never imports console code (an import scan test, section 5).
- **No ads, no new third parties**: Clerk was already used by the console; nothing else is added.
- **Native builds** show no grown-up entry and no purchase link (store rules, OD-6).
- `CLASS_TRANSFER` is untouched.

### 3.18 Telemetry (Worker first)

Names added to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:9`) and to the exact-list test in A-1, deployed with the API Worker **before** any app release that sends them (TELEMETRY-NAMES-2 rule 1). Rows go to `docs/roadmap/TELEMETRY-NAMES-2.md` as a new section in A-0. Sent by the learner app only (the console has no telemetry client, OD-9); **no `profileId`** on any of them, codes only.

| Name | Payload | Emitted by |
|---|---|---|
| `shell.persona_chosen` | `{ persona: 'learner' \| 'parent' \| 'teacher', from: 'welcome' \| 'welcome-continue' }` | A-7 |
| `shell.grown_up_handoff` | `{ via: 'dashboard' \| 'paywall' \| 'lock', target: 'router' \| 'billing' \| 'next' }` | A-6 (lock), A-7 (dashboard, paywall) |
| `shell.path_bounced` | `{ prefix: 'signin' \| 'start' \| 'teach' \| 'parent' \| 'account' }` | A-6 |

`paywall.console_opened` keeps firing when the flag is off (today's link).

### 3.19 States and errors

| Surface | Loading | Empty | Error |
|---|---|---|---|
| `/signin` | widget loading line | sign-up inline (Clerk) | Clerk unreachable: one line + Try again + Back to learning |
| router (`/signin` signed in, `/teach`) | "Taking you to …" | no persona → `/start` | spaces fetch failed: one line + Try again |
| lock decision | frame only, no content | — | storage unreadable → open (section 3.9) |
| parent home | skeleton cards (no numbers) | family without learners: join panel | roster fetch failed for one family: that section shows Try again, others render |
| teacher home | as today | as today | as today |
| offline page | — | — | it is the error state |
| stub | "Taking you to …" | — | script off: the visible link |

### 3.20 Behaviours (Given / When / Then)

1. Given a phone with no learner profile and no last persona, When the app opens, Then Welcome shows "Let's start" as the largest action and the row "Here to support a learner?" with Parent or caregiver and Teacher (web, flag on).
2. Given that Welcome, When the visitor taps Teacher, Then the tab goes to `/signin?persona=teacher`, the teacher intro shows, and `shell.persona_chosen { persona: 'teacher', from: 'welcome' }` is queued.
3. Given an account with one class space, When sign-in completes, Then the browser lands on `/teach/home` with no extra tap and `hr:shell:lastPersona` becomes `teacher`.
4. Given an account with a family and a class, When it signs in with no hint and no last persona, Then it lands on `/parent`, and the frame shows the persona switch; choosing Teacher opens `/teach/home`.
5. Given an account with no space, When it signs in from the Parent button, Then `/start` opens with Parent or caregiver preselected; creating the family lands on `/parent`.
6. Given a family tablet with two child profiles and a parent signed in yesterday, When someone types `app.hangulroute.com/parent`, Then the lock screen shows and no API call is made.
7. Given that lock, When Use the grown-up PIN is tapped and the correct PIN is entered, Then the browser returns to `/parent` and the home renders; `shell.grown_up_handoff { via: 'lock', target: 'next' }` is queued.
8. Given an open grown-up page on that tablet, When 15 minutes pass without interaction and the parent taps a link, Then the lock shows again.
9. Given a grown-up who taps Back to learning, When a child then presses the browser Back button into the grown-up page, Then the lock shows (the unlock was cleared).
10. Given a learner on the paywall (gate passed, flag on), When they tap the plan button, Then the same tab opens `/account/billing` without a lock screen, and after Stripe returns with `?checkout=success` the page shows the success note.
11. Given an installed learner PWA that has the A-2 worker, When the device is offline and the grown-up home card is tapped, Then the offline page shows with Back to learning.
12. Given `CONSOLE_ORIGIN` is set on the site, When `hangulroute.com/teach/space?id=sp_1#x` is opened, Then the browser lands on `app.hangulroute.com/teach/space?id=sp_1#x` (with `lang` added only when a console language was stored).
13. Given `hangulroute.com/teach/billing?checkout=cancel`, When opened after M3, Then the browser lands on `app.hangulroute.com/account/billing?checkout=cancel`.
14. Given `/signin?next=https://evil.example`, `next=//evil.example` or `next=/` (not a grown-up path), When sign-in completes, Then the persona home is used.
15. Given `app.hangulroute.com/teach/does-not-exist`, When opened online with the A-6 bundle, Then the browser replaces it with `/teach` and `shell.path_bounced { prefix: 'teach' }` is queued.
16. Given a self-only device (one adult learner, no PIN), When its owner signs in on `/signin`, Then grown-up pages open without a lock.
17. Given a native iOS or Android build, When Welcome, the dashboard or the paywall render, Then no grown-up home entry and no web purchase link appear.
18. Given a console-only change merged to `main`, When the learner Worker redeploys, Then `sw.js` is byte-identical to the previous build (no update banner for learners).

## 4. Out of scope

- The **content** of the parent and teacher dashboards and reports (daily, weekly, monthly, all-time; went well / needs work; class statistics) → reports spec (branch `docs/progress-reports`).
- The **feedback channel** from grown-ups to learners → feedback spec (branch `docs/adult-feedback-channel`).
- **Billing content** for every persona, and what a learner sees about billing → billing spec (branch `docs/billing-in-app-all-personas`). This spec only provides `/account/billing` and the hand-off.
- The **adult content browser** ("see the lessons exactly as the learner sees them") → content browser spec (branch `docs/adult-content-browser`); this spec reserves `/browse` and provides the same-origin hand-off.
- **LEARNING ROUTE** page and the free / subscriber learning flow → learning route spec (branch `docs/learning-route`) and free-plan spec (branch `docs/free-day2-unlocked-curriculum`).
- **The marketing site content and IA** → marketing spec (branch `docs/marketing-site-layered`); this spec defines only the app-host URLs it links to (section 6.4).
- Mobile (native) Clerk sign-in → F-AUTH-004 (not written). Account page (email change, consent record, delete data) → F-AUTH-005.
- An `api.hangulroute.com` custom domain for the API (not needed: CORS and Clerk already work).
- HTTP-level redirects on the site (OD-5).

## 5. Tests

| File | Covers | PR |
|---|---|---|
| `packages/content-schema/src/schemas/__tests__/app-shell.test.ts` | `isGrownUpPath` boundaries (`/teach`, `/teach/`, `/teach?x`, `/teach.html`, `/teacher` false, `/parentx` false, case-sensitive); `safeNextPath` (relative ok; `//x`, `/\x`, `https:`, `javascript:`, encoded `%2F%2F`, `..`, control chars, >512, non-grown-up → null; fragment dropped); `legacyConsoleTarget` table of section 3.13; `personasFor` every kind × role, archived, student ignored, order; `homeFor` matrix (none, hint, last, single, both); schemas lenient on bad JSON; `unlockActive` at 0, 14:59, 15:00, negative clock | A-1 |
| `packages/content-schema/src/__tests__/telemetry.test.ts` | exact list includes the three `shell.*` names | A-1 |
| `packages/content-schema/src/schemas/__tests__/lecture.test.ts` | origins include the app origin | A-1 |
| `apps/mobile/scripts/__tests__/pwa-postbuild-shell.test.mjs` | denylist RegExps from the prefixes; `consoleLeaks` flags a grown-up path and `_next/`; offline page has every shipped locale's strings and no external URL | A-2 |
| `apps/mobile/e2e/web/offline.spec.ts` (extended) | with the new worker, an offline navigation to `/parent` shows the offline page; `/` still plays offline | A-2 |
| `apps/web/scripts/__tests__/console-split.test.mjs` | console role copies only grown-up paths + `_next`; never `index.html`/`404.html`/legal/locale/design-preview; site role no-op without `CONSOLE_ORIGIN`; with it, every grown-up page is a stub and nothing else changes | A-3, A-8 |
| `apps/mobile/scripts/__tests__/merge-console.test.mjs` | collision guard; refuses non-grown-up paths; `SKIP_CONSOLE=1` writes nothing | A-3 |
| `apps/mobile/e2e/web/app-host.spec.ts` (new, merged build) | `/` is the learner app; `/teach/home`, `/parent`, `/signin`, `/account/billing` serve console HTML; precache manifest has no grown-up path; learner IndexedDB keys unchanged after visiting grown-up pages; `/teach/zzz` bounces to `/teach` | A-3, A-6 |
| `apps/web/src/lib/console/__tests__/grown-up-lock.test.ts` | the full table of section 3.9, including the `hr:profiles` fallback and unreadable storage | A-4 |
| `apps/web/src/lib/console/__tests__/device-marker.test.ts`, `unlock.test.ts` | reads and writes with throwing storage, missing IndexedDB, corrupt JSON | A-4 |
| `apps/web/src/app/__tests__/signin-router.test.tsx` | signed-in router uses `next` then `homeFor`; persona intro by hint; fresh sign-in writes the unlock; `/teach` router; `/teach/start` and `/teach/billing` redirects keep the query | A-4, A-5c |
| `apps/web/src/components/console/__tests__/grown-up-lock.test.tsx` | locked renders no children and triggers no fetch; buttons' targets | A-4 |
| `apps/web/src/lib/console/__tests__/shell-nav.test.ts` · `personas.test.ts` | nav filtering by persona and `enabled`; switch writes last persona | A-5a |
| `apps/web/src/components/console/__tests__/adult-frame.test.tsx` | switch shown only with both personas; Back to learning clears the unlock; no "Back to site"; no disabled items | A-5a |
| `apps/web/src/app/__tests__/parent-home.test.tsx` | cards in API order; empty state; one family failing; no banned words; links use ids | A-5b |
| `apps/web/src/lib/console/__tests__/routing.test.ts` (extended) | `ROUTES.space(id, kind)` prefixes; legacy family URLs still render | A-5b |
| `apps/web/e2e/console-moved.spec.ts` (new, site build with `CONSOLE_ORIGIN` pointing at a local server) | query, fragment and `lang` kept; noindex; no-script link | A-8 |
| `apps/mobile/src/logic/shell/__tests__/boot-intent.test.ts` | `gate=grown-up` with valid / invalid `next`; `lang` untouched; unknown keys ignored | A-6 |
| `apps/mobile/src/logic/shell/__tests__/device-gate.test.ts` | marker value for: no profiles, child profiles, self-only with and without PIN | A-6 |
| `apps/mobile/src/platform/__tests__/grown-up-handoff.web.test.ts` · `app-root.web.test.ts` | unlock written before navigation; `lang` appended; boot clears the unlock; root chooser order (`/present`, `/browse`, grown-up bounce, app) | A-6 |
| `apps/mobile/src/logic/shell/__tests__/no-console-imports.test.ts` | source scan: nothing under `apps/mobile/src` imports from `apps/web` or `@clerk/*` | A-6 |
| `apps/mobile/src/screens/onboarding/__tests__/welcome-personas.test.tsx` · `screens/parent/__tests__/grown-up-home-card.test.tsx` · `logic/__tests__/paywall.test.ts` (extended) · `logic/__tests__/links.test.ts` (extended) | row hidden on native and with the flag off; continue-as from the marker; telemetry payloads; paywall target by flag; privacy base order | A-7 |
| `packages/backend/src/__tests__/entitlements.test.ts` (extended) | return URLs use `/account/billing` and the app default base; `CONSOLE_URL` still wins | A-9 |
| `apps/mobile/e2e/web/grown-up-shell.spec.ts` (new) | behaviours 1, 2, 6-11, 15, 18 of section 3.20 on a test build with the dev auth bridge (`NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`, no Clerk in CI) and the API answered by Playwright route mocks | A-10 |

Coverage: `packages/content-schema` 100 %; `apps/web` verification logic (`lib/console/*`) at least 90 %; `apps/mobile` business logic (`logic/shell/*`) at least 90 %, platform wrappers at least 70 % (CLAUDE.md section 6).

## 6. Rollout and PR breakdown

Sizes: S < 300 changed lines, M < 700. Every UI PR links its design mock (`design/screens/…`) and attaches screenshots at 375 and 1280.

### 6.1 PR table

| PR | Content | Size | Depends on |
|---|---|---|---|
| A-0 | `docs`: amendments: `docs/blueprints/10-app-map.md` (sections 3.2, 3.3, 4.3, a new decision row "app host serves the console, B2"), F-CONSOLE-001 sections 3.6 / 3.7 (dated note: host and paths per F-APP-001), F-AUTH-002 section 3.6 (sign-in at `/signin` on the app host), F-ENT-001 sections 3.5 / 3.6 (billing at `/account/billing` on the app host), F-TCH-004 D12 note (same-origin console), `docs/launch/owner-runbook.md` (steps S-1 to S-4 of section 6.2, variable table), `docs/launch/web-app-launch.md`, `docs/roadmap/TELEMETRY-NAMES-2.md` new section | S | — |
| A-1 | `feat(content-schema)`: `schemas/app-shell.ts` + tests; `LECTURE_CONSOLE_ORIGINS` append; three telemetry names + exact-list test | S | — |
| A-2 | `feat(mobile)`: `pwa-postbuild.mjs` denylist, grown-up NetworkOnly rule with offline fallback, generated `grown-ups-offline.html` (strings via `ts-loader`), `consoleLeaks` guard, `_headers` rule; tests; offline e2e case | S | A-1 |
| A-3 | `feat(web,mobile)`: `console-split.mjs` (console role), `build:console`, `merge-console.mjs`, `build:web` runs it (`SKIP_CONSOLE`), API base pass-through, `web-app.yml` path filter, `preview-deploy.yml` checks, `app-host.spec.ts` first cases | M | A-2 |
| A-4 | `feat(web)`: `/signin` page and router, `/teach` router, `/start` move and `/teach/start` redirect, shared grown-up layout, `GrownUpLock`, `lib/console/{grown-up-lock,device-marker,unlock}.ts`, `idb-keyval` dependency, Clerk redirect URLs, `ROUTES.signIn/start`, `useConsole()` to `/signin?next=`, `?lang=` read; strings `console.signIn.persona.*`, `console.lock.*` | M | A-1 |
| A-5a | `feat(web)`: `AdultFrame` (persona switch, `shell-nav.ts`, Back to learning, footer site links) replacing `ConsoleShell`, `lib/console/personas.ts`, last-persona write, teacher home filter and cross-link; strings `console.shell.*`, `console.home.otherPersona` | M | A-4, mock |
| A-5b | `feat(web)`: real `/parent` home, `/parent/space*` aliases, `ROUTES.space(id, kind)`, removal of the demo (`parent/[childId]`, `components/parent/*`, `data/mock-family.ts`, `e2e/parent-demo.spec.ts`, related unit tests), landing links to `/parent` left to the marketing spec; strings `console.parentHome.*` | M | A-5a, mock |
| A-5c | `feat(web)`: `/account/billing` alias, `/teach/billing` redirect page, frame Billing item | S | A-5a |
| A-6 | `feat(mobile)`: root chooser (`platform/app-root*.ts`, bounce), boot intent, `GrownUpArea` destination in `PinEntry`, `openGrownUpArea`, unlock clearing on boot, device gate marker writer, `flags.grownUpHomeEnabled`, telemetry `shell.grown_up_handoff` (lock) and `shell.path_bounced`, import scan test | M | A-1 (Worker deployed), A-2 |
| A-7 | `feat(mobile)`: Welcome persona row and continue-as, ParentDashboard grown-up home card, paywall same-origin billing, `privacyUrl` base order, `EXPO_PUBLIC_SITE_URL`; strings `learner.welcome.grownUps.*`, `caregiver.grownUpHome.*`; `shell.persona_chosen`, `shell.grown_up_handoff` (dashboard, paywall) | M | A-6, mock |
| A-8 | `feat(web)`: site role of `console-split.mjs` (stubs, `lang` carry, noindex) behind `CONSOLE_ORIGIN`; strings `landing.consoleMoved.*`; `console-moved.spec.ts` | S | A-3 |
| A-9 | `feat(backend)`: `billingReturnUrl`, default base `https://app.hangulroute.com`, path `/account/billing`; tests | S | A-5c deployed on the app host (M1) |
| A-10 | `chore`: flip defaults (`grownUpHomeEnabled` on; `CONSOLE_ORIGIN` default `https://app.hangulroute.com` in the site role); `grown-up-shell.spec.ts`; runbook "done" lines | S | all above; M3 at least 14 days old (OD-10); A-2 in production at least 7 days |

A-0, A-1 and A-4 can run in parallel. A-5a, A-5b and A-7 wait for their mocks (CLAUDE.md section 5).

### 6.2 Owner steps (dashboard only; each has a default timing)

| Step | What | When (default) |
|---|---|---|
| S-1 | `hangul-route-app` → Settings → Build → Variables: add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (the same `pk_live_…` as `hangul-route-web`); optionally `NEXT_PUBLIC_LECTURE_MODE`, `NEXT_PUBLIC_SCHOOL_CONSENT_MODE` with the site's values → Retry deployment | after A-3 merges |
| S-2 | Clerk dashboard (Production): confirm sign-in works on `https://app.hangulroute.com/signin` (subdomains of the root domain are served by the same instance); if Clerk lists allowed redirect origins, add `https://app.hangulroute.com` | during M2 |
| S-3 | `hangul-route-app` build variable `EXPO_PUBLIC_GROWN_UP_HOME=true`, and `EXPO_PUBLIC_SITE_URL=https://hangulroute.com` (then delete `EXPO_PUBLIC_CONSOLE_URL`); `hangul-route-web` build variable `CONSOLE_ORIGIN=https://app.hangulroute.com` → Retry both | M3, right after M2 succeeds |
| S-4 | `hangul-route-api` → Variables: `CONSOLE_URL=https://app.hangulroute.com` → Deploy | M3 (same day as S-3) |

### 6.3 Shared files (expect mechanical rebases)

`packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its exact-list test (A-1; every spec) · `apps/mobile/index.ts` (A-6; F-TCH-004 PR 6 adds the presenter root: both use one root chooser, whichever lands second rebases) · `apps/mobile/scripts/pwa-postbuild.mjs` (A-2; F-TCH-004 PR 3, F-AUDIO-004 A-6) · `apps/mobile/src/navigation/types.ts` (A-6; F-ROUTE-001 R-3 #317 adds `MyRoute`) · `apps/web/src/lib/console/routing.ts`, `components/console/ui.tsx` (A-4, A-5; F-ROUTE-001 R-9a #313, F-TCH-004 PR 10, sibling specs) · `packages/i18n/src/messages/en/{console,learner,caregiver,a11y,landing}.ts` (append keys only) · `.github/workflows/web-app.yml`.

### 6.4 Contract for the sibling specs of wave 2026-10-11

| Sibling (branch) | Uses from this spec |
|---|---|
| Marketing site (`docs/marketing-site-layered`) | site has no sign-in or billing; its CTAs link to `https://app.hangulroute.com/` (learn), `/signin?persona=parent`, `/signin?persona=teacher`; it removes `/teach` and `/parent` links from the landing header and footer |
| Reports (`docs/progress-reports`) | adds pages under `/parent/*` and `/teach/*` (ids in `?id=`), registers nav items in `shell-nav.ts`, replaces the parent home's **Open** target |
| Feedback channel (`docs/adult-feedback-channel`) | grown-up pages under the persona prefixes; learner-side surfaces stay in the learner app |
| Billing (`docs/billing-in-app-all-personas`) | owns `/account/billing` content and any `/account/*` page; reaches the page from the learner app only through `openGrownUpArea({ via: 'paywall', target: '/account/billing' })` |
| Adult content browser (`docs/adult-content-browser`) | `/browse` is a learner-bundle root (like `/present`); entry from the frame nav; same-origin hand-off; must write no learner progress |
| Learning route (`docs/learning-route`), free plan (`docs/free-day2-unlocked-curriculum`) | learner home and tabs; no change to this shell |

## 7. Dependencies

- **Upstream (shipped)**: F-CONSOLE-001, F-AUTH-002, F-ENT-001, F-SPACE-001, F-PROF-001, F-LEARN-001, F-PWA-001, F-I18N-001 (`?lang=`), F-INFRA-001.
- **Coordinated**: F-TCH-004 PR 6 (presenter root in `index.ts`), F-ROUTE-001 R-3 (#317) and R-9a (#313) (shared navigation and routing files).
- **Downstream**: every sibling spec in section 6.4; F-AUTH-004 (native sign-in) and F-AUTH-005 (account page) later reuse `/signin` and `/account/*`.

## 8. Owner decisions (each with a default; each gates only the PRs named)

| # | Question | Default (applies until answered) | Gates |
|---|---|---|---|
| OD-1 | Hosting architecture for grown-up pages on app.hangulroute.com | **B2**: console built in a console role and merged into the learner Worker's `dist` under reserved prefixes (section 3.1) | A-3 |
| OD-2 | Do learners get a sign-in (email or password)? | **No.** Learners choose a profile on the device, restore with a Rescue Code or backup file, or join with a code; adult learners may later link to a grown-up account under F-AUTH-004 | A-7 copy |
| OD-3 | Grown-up lock on shared devices | **On** when the device has learner profiles behind a PIN; 15 idle minutes; unlock by the device PIN or a fresh sign-in | A-4, A-6 |
| OD-4 | The `/parent` demo on mock data | **Removed** from the product; the marketing spec may show a static picture instead | A-5b |
| OD-5 | HTTP-level redirects (`_redirects`) on hangulroute.com | **Not used**; client stub pages only (keep query and fragment, testable) | A-8 |
| OD-6 | Grown-up entry in native iOS / Android builds | **Hidden** until F-AUTH-004; the local PIN dashboard stays | A-7 |
| OD-7 | Path names | `/signin`, `/start`, `/parent`, `/teach`, `/account` (keeps every existing `/teach/*` URL and test) | A-4, A-5 |
| OD-8 | Where the persona choice sits for a new visitor | A **secondary row on Welcome** under "Let's start"; no separate chooser screen, so a learner starts in one tap | A-7 |
| OD-9 | Telemetry from grown-up pages | **None** (the console has no telemetry client); learner-side `shell.*` events only | — |
| OD-10 | Who verifies before the switch-over | The owner signs in once on `app.hangulroute.com/signin`, opens a class roster and the billing page (M2); A-10 waits at least 14 days after M3 | A-10 |
| OD-11 | Persona for an account with both and no history | **Parent** first; the switch is always visible | A-4 |
| OD-12 | Clerk session length | **Clerk's default** (unchanged); the lock covers shared devices | — |

## 9. Unverified assumptions and risks

- **Clerk Production on a subdomain** is expected to work without satellite setup because the instance serves the root domain; verified only in M2 (S-2). If it fails, the fallback is to add `app.hangulroute.com` as an allowed origin in Clerk, no code change.
- **Next RSC payload files** (`.txt`) are copied with the pages; client navigation between console pages relies on them. Covered by `app-host.spec.ts` (navigate home → space → back with JavaScript on).
- **Old service workers** answer grown-up URLs with the learner shell until they update (section 3.4). The 7-day gap before A-10 and the update banner bound the window; not measured. A device that never opens the learner app does not have the worker at all.
- **Marker gap for learner apps older than A-6**: covered by the `hr:profiles` presence fallback (section 3.9). A browser where IndexedDB was cleared has no profiles and no lock, which is correct.
- **Build time**: the learner Worker build adds a Next build (about 1-2 minutes on Workers Builds; the 20-minute limit is far). The `web-app.yml` job grows by the same amount.
- **Two copies of `_next`** (site and app hosts) are independent deploys of the same commit; a console page and its chunks always come from the same build, so there is no skew between them.
- **Noticed, not changed here**: `learner.welcome.trust` says "Built with kids, parents, and grandparents in mind" on a shared surface; the marketing and copy owners should review it against the CLAUDE.md audience rule.

---

## Appendix A — draft English strings (final copy is the dictionary's)

- Welcome row: "Here to support a learner?" · "Parent or caregiver" · "Teacher" · "Continue as parent" · "Continue as teacher" · "Someone else"
- Dashboard card: "Grown-up home" · "Reports, messages and billing for your account." · "Open"
- Sign-in: parent intro "Sign in to see your family's learning." · teacher intro "Sign in to see your classes." · neutral "Sign in to your grown-up account." · "Learners don't need an account. They join with a code." · "I'm here to learn"
- Frame: "Back to learning" · "About Hangul Route" · "Parent" · "Teacher" · "Home" · "Classes" · "Billing"
- Lock: "Grown-ups only" · "Enter this device's grown-up PIN, or sign in again." · "Use the grown-up PIN" · "Sign in again" · "Back to learning"
- Parent home: "Your family" · "No learner has joined yet." · "Open Hangul Route on the learner's device, then Profile, Classes and family, Join." · "Open the app on this device" · "Open" · "Plan the week" · "Plan the term" · "Family settings" · "Add a learner"
- Teacher home cross-link: "Your family is under Parent."
- Offline: "You're offline" · "Grown-up pages need the internet. Learning still works offline." · "Back to learning" · "Try again"
- Site stub: "Grown-up pages have moved to app.hangulroute.com." · "Go there now"

## Review log

- 2026-10-11: written from the five current-system maps of the 2026-10-11 owner request (marketing site, domains and deploy, learner app, console, entitlements and reports); options A to C measured; B2 chosen.
