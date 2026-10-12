Status: ready

# F-APP-001 — One product app: app.hangulroute.com with persona sign-in (learner, family, teacher) and a home per persona

> **Status note.** `ready` means the spec can be implemented PR by PR in the order of section 6. Owner decisions do **not** gate the whole spec: each one gates only the PRs named in section 8, and each has a default that applies until the owner answers. Basis: `origin/main` `b19885d8` (2026-10-11; the code facts below were read at `ea9049e4`, and nothing they cite changed between the two commits). Revised the same day after two reviews (review log at the end).
>
> **Owner request (2026-10-11), items this spec owns:** (1) hangulroute.com and app.hangulroute.com get clearly separate roles (the app side; the site side is F-SITE-002); (3) on app.hangulroute.com each persona signs in and sees different screens; (5) the learner experience stays optimised for learning; (13) everything user-friendly. It also owns the **entry points** of items 4, 6, 7, 11 and 14 on the grown-up homes (the pages themselves belong to the sibling specs), and item 12 (billing only on the app host) as **routing and hosting**; the billing page itself is F-BILL-002.

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a design mock and a wireframe)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now | A-0 docs, A-1 shared module | — | amendments, telemetry rows, pure shared code |
| now | A-9 token audience | — | backend hardening, no visible change |
| after A-1 merged and the API Worker deployed | A-2 service worker, A-6 learner plumbing | names on the Worker (rule "Worker first") | A-6 emits `shell.*` events |
| after A-2 | A-3 merged build | — | console pages exist on the app host, behind no link |
| after A-1 | A-4a lock libraries, then A-4b sign-in and routers | — | pages behind no link until M3 |
| after A-4b and the design pass | A-5a frame and teacher home, A-5b parent home, A-5c billing route | design mocks in `design/screens/` for the frame, the homes, the lock and sign-in | CLAUDE.md section 5 "no component without a mock" |
| after A-6 and the design pass | A-7 learner entry points | mock of the Welcome persona row, the Profile row and the dashboard card | flag off until M3 |
| M3 (owner steps) | S-3, F-SITE-002 S-10, F-BILL-002 B-10 | **A-2 in production at least 7 days**, production precache check (S-0), A-4b and A-5c live on the app host, M2 done | installed learner PWAs must have the denylist before grown-ups are sent to the app host (section 3.4) |
| last | A-10 flip defaults + full e2e | M3 at least 14 days old; OD-10 | |

**Scope**: `packages/content-schema` (new `schemas/app-shell.ts`, `LECTURE_CONSOLE_ORIGINS`, telemetry names) · `apps/mobile` (root chooser in `index.ts`, `platform/app-root*.ts`, `platform/grown-up-handoff*.ts`, `platform/shell-store*.ts`, `logic/shell/`, device gate marker writer, `account:pinSetAt`, PIN destination `GrownUpArea`, Welcome persona row, Profile "Grown-up home" row, ParentDashboard card, Plan screen billing hand-off, Join prefill, `privacyUrl`, flag, `scripts/pwa-postbuild.mjs`, new `scripts/app-host/merge-console.mjs`, `public/_headers`, `package.json` `build:web`, e2e) · `apps/web` (new `scripts/console-split.mjs`, `build:console`, `/signin`, `/start`, `/teach` router, `GrownUpLock`, `AdultFrame`, real `/parent` home replacing the demo, `/parent/space/**` aliases of every `/teach/space/**` page, `/account/billing` alias, legacy redirect pages on the app host, `lib/console/{grown-up-lock,personas,shell-nav,device-marker,unlock,shell-store,space-pages}.ts`, `ROUTES`) · `packages/backend` (`authorizedParties` from the CORS allow-list) · `packages/i18n` (`learner.welcome.grownUps`, `learner.profile.grownUpHome`, `caregiver.grownUpHome`, `console.shell`, `console.signIn.persona`, `console.signIn.create`, `console.lock`, `console.parentHome`, `console.home.noClass`, `console.offline`, `a11y.shell`) · `.github/workflows/web-app.yml`, `preview-deploy.yml` · docs (app map, runbook, amendments)
**Owner**: solo dev
**Rollout**: learner entry points behind `flags.grownUpHomeEnabled` (`EXPO_PUBLIC_GROWN_UP_HOME`, default off). The site side (hangulroute.com stops serving grown-up pages and redirects them) is F-SITE-002 S-10; Stripe return URLs are F-BILL-002 B-10. A-10 flips this spec's defaults. No D1 migration. No new endpoint.
**Wireframes** (this PR): `design/wireframes/shell/` `signin.md`, `adult-frame.md`, `parent-home.md`, `teacher-home.md`, `grown-up-lock.md`, `offline.md`; `design/wireframes/onboarding/welcome-personas.md`; `design/wireframes/parent/grown-up-home-card.md` (Profile row and dashboard card)

Parent / siblings: CLAUDE.md section 1 (any age, child safety, anti-shame, UI locales) · F-CONSOLE-001 (console shell, section 3.7 static export; amended) · F-AUTH-002 (Clerk client SDK; section 3.6 amended) · F-ENT-001 (section 3.5 paywall link, section 3.6 billing page; amended) · F-TCH-004 (presenter at `/present`, TD1 second root; `LECTURE_CONSOLE_ORIGINS`) · F-PROF-001 / F-LEARN-001 (PIN gate, `gateRequired`, `gateOpensDirectly`, 15-minute session, Forgot PIN) · F-PWA-001 (service worker, telemetry queue) · F-I18N-001 (locales, `?lang=` hand-off) · F-SPACE-001 (memberships, roles, Join) · F-PAR-001 (in-app dashboard) · sibling specs of wave 2026-10-11, section 6.4: F-SITE-002, F-BILL-002, F-REPORT-001, F-FEEDBACK-001, F-BROWSE-001, F-ENT-003, the Learning Route amendment to F-ROUTE-001

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
- `apps/mobile/public/_headers` sets cache rules for `sw.js`, the manifest, `index.html` and audio only; no security header (`:1-15`).

**Grown-up sign-in, billing and links all point at hangulroute.com.**

- Clerk runs only in the console, client SDK (`apps/web/src/components/console/auth-context.tsx:3`), hash routing, sign-out to `ROUTES.signIn = '/teach'` (`apps/web/src/lib/console/routing.ts:7`, `auth-context.tsx:55`). The API verifies the bearer with `verifyToken` and no `authorizedParties` (`packages/backend/src/lib/auth.ts:30`), so a token minted on another subdomain of the same Clerk instance is accepted. Production runs the Clerk Production instance (owner memory, 2026-10-11); a Production instance serves the root domain and its subdomains.
- CORS already allows `https://app.hangulroute.com` (`packages/backend/src/lib/cors.ts:6`).
- Stripe Checkout success, cancel and the portal return go to `${CONSOLE_URL ?? 'https://hangulroute.com'}/teach/billing` (`packages/backend/src/routes/entitlements.ts:82, 127`); production sets `CONSOLE_URL=https://hangulroute.com` (`docs/launch/owner-runbook.md:87`).
- The learner paywall opens `${EXPO_PUBLIC_CONSOLE_URL ?? 'https://hangulroute.com'}/teach/billing` (`apps/mobile/src/logic/paywall.ts:48-55`); the same variable builds the Privacy link (`logic/links.ts:1-14`), so one variable mixes "site" and "console".
- The lecture presenter accepts roster messages only from `LECTURE_CONSOLE_ORIGINS` = hangulroute.com, www and localhost (`packages/content-schema/src/schemas/lecture.ts:179-183`).
- The console header links "Back to site" to `/` (`apps/web/src/components/console/ui.tsx:89-92`): on the app host `/` is the learner app.
- The console keeps `hr:console:session` (`{ token, accountId, displayName, email }`) in `sessionStorage` (`apps/web/src/lib/console/session.ts:8-17`).

**No personas in the product.**

- The learner app has no adult entry except the PIN-gated grown-up zone (Profile, `ProfileScreen.tsx:73-95`) leading to the local `ParentDashboard` and the paywall. The gate opens directly inside a 15-minute session (`logic/profiles/session.ts:9`, `store/ui-store.ts:26` `openParentGate`) or on a self-only device without a PIN (`logic/profiles/gate-route.ts:12-18`, `learner-type.ts:52-57`). There is no separate profile chooser screen: profile switching lives on Profile.
- **The PIN screen creates a PIN when none is stored**: `initialPinMode` returns `setup-1` whenever `parentPinHash` is null (`logic/profiles/pin-flow.ts:16-17`). `gateRequired` is true on a family device even without a PIN (`learner-type.ts:63-68`), so a family device whose child profiles predate the PIN rule has a gate and no PIN. **Forgot PIN** resets with a Rescue Code stored on the device or after a 24-hour wait (`logic/profiles/pin-reset.ts:11-22`). The PIN hash lives in `account:parentPinHash` (`store/account-store.ts:25`); no time of setting is stored.
- Welcome offers Start and Restore only (`screens/onboarding/WelcomeScreen.tsx:43-55`). The learner tabs are Today, Journey and Library (`navigation/tabs.tsx:61-63`).
- The console has no persona: after sign-in one `/teach/home` lists Family, Classes and School spaces together (F-CONSOLE-001 section 3.4). Roles exist per membership: `owner | caregiver | teacher | admin | student` (`packages/content-schema/src/schemas/space.ts:36`), returned with each space and its counts by `GET /api/spaces` (`apps/web/src/lib/console/api.ts:28-34`). The roster returns learners sorted by most recent activity (`packages/backend/src/routes/spaces.ts:378`) with `joinedAt`, `lastActiveAt` and `minutesLast7d`.
- Learners have no account by design ("Kids don't need an account — they join with a code", F-CONSOLE-001 section 3.2). They keep local profiles, a Rescue Code (F-RESTORE-001) and class or family join codes (F-SPACE-001, `screens/sync/JoinSpaceScreen.tsx`).
- The console has no telemetry client (`apps/web/src/lib/i18n/locale-context.tsx:20`).

**What is missing against the owner request.** No persona choice anywhere; no grown-up sign-in on the app host; grown-up pages and billing on the marketing host; no rule for a shared family tablet where a grown-up is signed in and children learn; no path from the grown-up homes to reports, notes, Learning Route and the lesson browser; no migration path for existing bookmarks, Stripe sessions and installed PWAs.

## 2. User stories

> As a **parent**, I open app.hangulroute.com on my phone, tap "Parent or caregiver", sign in, and land on my family's home: each child's card has one tap to their report, to a note, and to their Learning Route, and billing is one tab away.
>
> As a **teacher**, I open the same address on the classroom laptop, sign in, and land on my classes, each with its class report one tap away. If I also have a family, one switch takes me to it; if I don't, one quiet link lets me set one up.
>
> As a **learner** of any age, I open the app and learn. I never see grown-up menus, and nothing asks me for an email.
>
> As a **parent on a shared tablet** where my child already learns, I find "Grown-up home" on Profile, enter my PIN once, and I am in; my children cannot open it, even though I stay signed in, and a child who changes or resets the PIN cannot use it to get in.
>
> As an **existing teacher** with a bookmark to hangulroute.com/teach/space?id=…, the link still works and takes me to the same page on the app host.

## 3. Acceptance criteria

### 3.1 Architecture decision (AD-1): one host, two bundles, one Worker

Options measured against the owner request, child safety, cost and production risk:

| Option | What it is | Meets items 3 and 12 | Cost | Main risks |
|---|---|---|---|---|
| A | Rewrite the console (about 15 Next pages, Clerk, billing) as Expo screens | yes | very high (weeks) | Clerk and adult code inside the child's offline bundle and the native binary; billing links in an iOS build (App Review 3.1.1); lose the console tests |
| B1 | Keep the Next console; Worker routes `app.hangulroute.com/teach*` etc. to `hangul-route-web` | yes | low | depends on dashboard routes the owner must add; precedence of a route over a Custom Domain Worker is unverified; two deploys must agree on paths; F-SITE-002's `_redirects` would loop (they cannot match on host) |
| **B2** | **Keep the Next console; build it in a "console" role and copy its pages into the learner Worker's `dist` under reserved prefixes** | **yes** | **low to medium (about 3 days of code)** | **one deploy builds two frameworks; service worker must exclude the prefixes (solved in section 3.4)** |
| B3 | Next `basePath` plus a router Worker with service bindings | yes | medium | new Worker code (`main`), more moving parts |
| C | Console on `console.hangulroute.com` | **no** (owner asked for app.hangulroute.com) | lowest | a third user-facing host |

**Decision: B2.** Reasons:

1. It keeps every console page, its Clerk integration and its tests unchanged (`apps/web` stays the source); only the deployment target changes.
2. No dashboard routing and no Worker code: the learner Worker stays assets-only. The only owner steps are build variables (section 6.2).
3. Same origin for learner and grown-up pages enables the PIN hand-off through `sessionStorage` (section 3.9), the same-origin presenter hand-off (F-TCH-004) and F-BROWSE-001's lesson browser without cross-origin messaging.
4. The child's offline bundle stays free of adult code: console files are excluded from the precache and never imported by the learner bundle.
5. Native builds are untouched: adult pages exist only on the web host.
6. **The `hangul-route-web` Worker never serves the console on the app host** (the contract F-SITE-002 S-10 needs for its host-blind `_redirects`): the app host is served only by `hangul-route-app`.

Consequences accepted: the learner Worker's build also runs `next build` (about 1-2 minutes); a console change redeploys the learner Worker but does **not** change `sw.js` (console files are not precached), so learners see no update banner for console-only changes.

### 3.2 Hosts and the route map

**hangulroute.com (site role)**: landing, persona pages, About, Privacy, Terms, waitlist (F-SITE-002 owns the content and, from its S-10, the redirects of every old grown-up URL, section 3.13). No sign-in, no billing, no grown-up page after S-10.

**app.hangulroute.com (app role)**: every path below. The table is the contract for all sibling specs; it lives in code as `APP_ROUTES`, `GROWN_UP_PREFIXES` (section 3.14) and the space page list `SPACE_PAGES` (`apps/web/src/lib/console/space-pages.ts`, section 3.8).

| Path | Bundle | Owner | What |
|---|---|---|---|
| `/signin` (`?persona=`, `?as=`, `?next=`, `?mode=create`, `?lang=`) | console | this spec | grown-up sign-in, account creation behind the adult step, and the router into the grown-up area |
| `/start` | console | this spec (moved from `/teach/start`) | first space for a grown-up (role cards) |
| `/parent` | console | this spec | family home (persona "Family") |
| `/parent/space/**` (`?id=`) | console | this spec (aliases) | the family twin of every page under `/teach/space/**`, see the rows below |
| `/parent/*` (other) | console | reserved for the family persona | a sibling that needs one amends this table (R-3) |
| `/teach` | console | this spec | router (section 3.7) |
| `/teach/home` | console | this spec (filtered) | teacher home |
| `/teach/space`, `/plan`, `/curriculum`, `/relink`, `/settings`, `/lecture` (`?id=`) | console | existing (F-CONSOLE-001, F-TCH-001, F-PLAN-*, F-TCH-004) | a space; every one has its `/parent/space/…` twin |
| `/teach/space/learner?id=&learner=&period=` | console | F-REPORT-001 RP-7a | learner report; twin `/parent/space/learner` |
| `/teach/space/report?id=&period=` | console | F-REPORT-001 RP-8 | class report (class spaces only; twin exists for uniformity) |
| `/teach/space/notes?id=` | console | F-FEEDBACK-001 FB-11 | notes composer and sent list; twin `/parent/space/notes` |
| `/teach/space/route?id=&learner=` | console | Learning Route amendment LR-8 | grown-up Learning Route; twin `/parent/space/route` |
| `/teach/*` (other) | console | reserved for the teacher persona | |
| `/account/billing` | console | this spec (alias), F-BILL-002 (content) | billing for every grown-up |
| `/account/billing/receipts?id=` | console | F-BILL-002 | receipts of one space |
| `/account/*` (other) | console | F-BILL-002, later account page (F-AUTH-005) | persona-neutral grown-up pages |
| `/teach/billing`, `/teach/start` | console | this spec | legacy on the app host: client redirect to `/account/billing`, `/start` (query kept) |
| `/present` | learner | F-TCH-004 | presenter root (TD1) |
| `/browse` | learner | F-BROWSE-001 | lesson browser, third root of the learner bundle; never a console page |
| `/` and every other path | learner | — | the learner app |

Rules:

- **R-1** A grown-up path is `/signin`, `/start`, `/teach`, `/parent`, `/account`, each followed by end of path, `/`, `?` or `.` (so `/teach.html` and `/teach.txt` match and `/teacher` does not). `isGrownUpPath` (section 3.14) is the only implementation. **`/billing` is not a grown-up prefix**: billing lives under `/account` (F-BILL-002 sets `BILLING_PATH = '/account/billing'`, section 6.4).
- **R-2** Learner identifiers in URLs are opaque ids in `?id=` / `?learner=` (F-CONSOLE-001 section 3.7). No path or query ever holds a learner's name, initials or email. The demo slugs (`/parent/mina`, `/parent/jun`) are removed with the demo (OD-4).
- **R-3** No new grown-up prefix and no new space page may be added without amending this table and `SPACE_PAGES` (a sibling spec that needs one amends section 3.2 in its docs PR).
- **R-4** `/design-preview/*` is not served on the app host (the console role never copies it, section 3.3); a redirect of it to the app host would land on the learner app (section 6.4).

### 3.3 Build and deploy

- **Console role** (`apps/web`): new script `build:console` = `next build && node scripts/console-split.mjs out && node scripts/prune-hidden-locales.mjs out` (the trailing prune leaves `apps/web/out` as pruned as the site role's `build` does, since `next build` rewrites it; 2026-10-12, A-3 review). It writes `apps/web/out-console/` holding only: every exported file whose path matches a grown-up prefix (R-1), including the `.html` pages and their React Server Component `.txt` payloads, plus the whole `_next/` folder. It never copies `index.html`, `404.html`, `about*`, `privacy*`, `terms*`, `learners*`, `parents*`, `teachers*`, `es*`, `ko*` or `design-preview*`. The split script imports `GROWN_UP_PREFIXES` from `packages/content-schema` through `scripts/ts-loader.mjs` (precedent: `scripts/check-i18n.mjs`), so the list exists once.
- **Site role**: unchanged by this spec. `build` stays `next build && node scripts/prune-hidden-locales.mjs out`; F-SITE-002 S-9 adds its own site-only output `out-site/` (no grown-up file at all) and `_redirects`, and S-10 points `hangul-route-web` at it. Until S-10 hangulroute.com keeps serving the console from `out/` exactly as today (including the new `/signin`, `/start`, `/account/billing` pages once they exist; nothing links there from the site).
- **Merged learner build** (`apps/mobile`): `build:web` becomes audio map, `expo export`, `node scripts/app-host/merge-console.mjs dist`, `pwa-postbuild.mjs dist`. `merge-console.mjs`:
  - runs `pnpm --filter @hangul-route/web build:console` unless `SKIP_CONSOLE=1` (local learner-only builds and `build:web:fixtures` set it);
  - passes `NEXT_PUBLIC_API_BASE_URL` from `EXPO_PUBLIC_API_BASE_URL` when the first is unset, and `NEXT_PUBLIC_APP_URL` defaults to `https://app.hangulroute.com` (`apps/web/src/lib/console/config.ts:68`);
  - copies `out-console/**` into `dist/` and **fails the build** if any target path already exists in `dist` (collision guard), if a copied path is not a grown-up path or under `_next/`, or if `dist/index.html` would be touched;
  - appends the grown-up header block to `dist/_headers` (generated from `GROWN_UP_PREFIXES`, section 3.17);
  - writes nothing when `SKIP_CONSOLE=1`, so learner-only builds are unchanged.
- The Workers Builds command of `hangul-route-app` does not change (`pnpm --filter @hangul-route/mobile build:web`); its build variables gain `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and optionally `NEXT_PUBLIC_LECTURE_MODE`, `NEXT_PUBLIC_SCHOOL_CONSENT_MODE` and the sibling console flags) in owner step S-1. Until then the console pages on the app host show the existing "sign-in is not set up on this build" line (`devAuthEnabled` is false in a production build, `config.ts:47-52`); nothing links there before M3.
- `apps/mobile/public/_headers` gains `/_next/static/*  Cache-Control: public, max-age=31536000, immutable` (same rule as `apps/web/public/_headers`). The learner rules are unchanged.
  - The rule ships with A-2 and does nothing until A-3 copies `_next/` in. Unlike `hangul-route-web` (`404-page`), this Worker's single-page fallback answers a request under `/_next/` that has no file with `index.html` (200 `text/html`), and the rule would let a browser keep that answer for a year under the chunk URL. A-3 therefore either answers such a miss with a 404 and `Cache-Control: no-store` (for example `run_worker_first` for `/_next/*`), or removes the rule; `app-host.spec.ts` requests a missing chunk URL and checks it is never `text/html` with `immutable` (2026-10-12 amendment, A-2 review). **Chosen in A-3: the rule is removed** (the Worker stays assets-only, AD-1), console chunks revalidate, and `merge-console.mjs` refuses a learner `_headers` that brings back a long-cache rule matching `/_next/` (2026-10-12, A-3 review).
- CI: `.github/workflows/web-app.yml` ("Build PWA · offline e2e", required) adds `apps/web/**` to its path filter and builds with the console (no `SKIP_CONSOLE`), so the merged output is what is tested. `preview-deploy.yml` keeps its checks over `apps/web/out` and adds `test -f apps/web/out-console/teach/home.html` and `test ! -f apps/web/out-console/index.html` after a `build:console` run.

### 3.4 Service worker and manifest

- `pwa-postbuild.mjs` (A-2):
  - `navigateFallbackDenylist`: one RegExp per grown-up prefix built from `GROWN_UP_PREFIXES` (R-1 boundaries), so a navigation to a grown-up path never receives the learner shell.
  - A runtime rule for **navigations** to grown-up paths: `NetworkOnly` with `precacheFallback` to `/grown-ups-offline.html` (section 3.12). Workbox serialises the `urlPattern` function into `sw.js`, so it cannot import the prefix list at runtime: the generator **inlines the prefix RegExp source** into the rule, and a test reads the emitted `sw.js` text.
  - `globIgnores` adds every grown-up path and `_next/**`; a new guard `consoleLeaks(manifestUrls)` fails the build if any precache entry is a grown-up path or under `_next/` (same shape as `precacheLeaks`, `scripts/audio/lib.mjs`), and `consolePages` fails it if any precached HTML page loads `/_next/` code whatever its path (a Next `404.html`).
  - Generates `dist/grown-ups-offline.html`: self-contained (inline styles from tokens read like `canvas` and `brand` at `:16-20`, no script except locale pick), precached.
- The denylist never lists `/present` or `/browse` (learner roots, F-TCH-004 and F-BROWSE-001 load them through `navigateFallback`).
- The manifest is **not changed**: `id`, `start_url` and `scope` stay `/`, so no installed PWA is orphaned. Grown-up pages are inside the scope: opened from an installed learner PWA they stay in its window. The adult frame therefore always shows a way back to the learner app (section 3.8), because a standalone window has no address bar.
- **Old workers.** A device whose installed worker predates A-2 still answers grown-up navigations with the learner shell until its new worker activates (on "Update ready" or after every window of the app closes). The learner app shows its normal home there. Mitigation: A-2 reaches production **at least 7 days before M3** (the first step that sends anyone to the app host: S-3 learner entry points, F-SITE-002 S-10 redirects, F-BILL-002 B-10 Stripe returns), and owner step S-0 checks that the production precache manifest carries the denylist before S-3. The bounce rule below sends an updated learner bundle that boots on a grown-up path to the right place.
- **Bounce rule** (A-6). `index.ts` chooses the root before `App` mounts (as F-TCH-004 TD1 does for `/present`): `platform/app-root.web.ts` returns `'grown-up-bounce'` when `isGrownUpPath(location.pathname)`. This only happens when the Worker's SPA fallback served `index.html` for a grown-up path that has no file (an unknown or mistyped URL). The bounce root renders nothing, emits `shell.path_bounced`, and calls `location.replace` with the persona entry for the prefix: `/parent*` to `/parent`, `/teach*` to `/teach`, anything else to `/signin`. Native stub: always `'app'`. A path that already is its persona entry (`/parent`, `/teach`, `/signin`, with or without a trailing slash) does not bounce: it mounts the learner app, so a host that has no page there (production before A-3, a learner-only build) cannot reload the tab forever; the bounce carries the query keys the entries read (`persona`, `as`, `lang`) and drops the rest (2026-10-12, A-6). The app-host legacy pages go first (A-6 review): `/teach/billing` bounces to `/account/billing` and `/teach/start` to `/start`, each with the whole query, as their redirect pages (A-5c, A-4b) would, so a Stripe return keeps `checkout=` on a host that does not serve those pages yet; neither target is a legacy page, so the chain ends.

### 3.5 Personas

- Personas: `learner`, `parent` (shown as **Family**: a parent, caregiver, or an adult who set up a family space for their own learning), `teacher` (teacher or school admin). `PersonaSchema` and `AdultPersonaSchema` live in `schemas/app-shell.ts`. The code name stays `parent`; every label says "Family" (OD-14), and the Welcome button says "Parent or caregiver".
- **Learner** is a device role, not an account: whoever uses a local learner profile. Learners never sign in with an email or a password (OD-2). A learner "signs in" by choosing their profile on the device, by restoring with a Rescue Code (F-RESTORE-001) or a backup file (F-SYNC-002), or by joining a class or family with a code (F-SPACE-001). This keeps the rule "verifiable parental consent before personal data is linked to an account": no learner account exists to link.
- **Adult personas come from memberships**, never from a self-declared flag: `personasFor(memberships)` returns `parent` when the account holds a `family` space as `owner` or `caregiver`, and `teacher` when it holds a `class` space as `owner` or `teacher`, or a `school` space as `owner`, `admin` or `teacher`. `student` memberships are ignored (accounts never hold them). Archived spaces count (their pages stay reachable). Order: `parent`, then `teacher`.
- An account with no space has no persona yet: the router sends it to `/start`, whose role cards (Parent or caregiver · Teacher · School admin, F-CONSOLE-001 section 3.3) create the first space and therefore the persona. A `?persona=` hint preselects the matching card.
- **Persona home** (`homeFor({ personas, last, hint })`, pure):
  1. no persona → `/start` (hint kept as `?persona=`);
  2. a `hint` → that persona's home, **whether or not the account holds it**; a home for a persona the account does not hold shows that home's "not set up yet" state (section 3.8), never the other persona's home;
  3. else `last` when the account still holds it;
  4. else the only persona;
  5. else `parent` (OD-11).
  Homes: `parent` → `/parent`, `teacher` → `/teach/home`.
- **Last persona** is remembered per browser in the shell store (section 3.14: IndexedDB database `hr-shell`, store `kv`, key `lastPersona`, `LastPersonaSchema` `{ v: 1, persona }`), written by the adult frame whenever a persona home renders with that persona held. It is **not** in the learner's `hr:` namespace, so learner backups and key listings never see it. The learner Welcome reads it (read only) to offer "Continue as …" (section 3.6). It is a convenience: unreadable or missing means "none".

### 3.6 Learner side: entry and home

- **Welcome** (web only, behind `flags.grownUpHomeEnabled`; wireframe `onboarding/welcome-personas.md`). The hero button stays "Let's start" (unchanged position and size; F-I18N-001 section 3.3 keeps the primary action fixed). Below the existing "I already have progress" link, one short row: "Here to support a learner?" with two outlined (ghost) buttons, **Parent or caregiver** and **Teacher** (2026-10-12, design pass D10: "Let's start" stays the only filled button), which navigate the tab to `/signin?persona=parent` or `/signin?persona=teacher` (sign-in only; creating an account is behind the adult step of section 3.7). Emits `shell.persona_chosen { persona, from: 'welcome' }`; "Let's start" emits `{ persona: 'learner', from: 'welcome' }`.
- When the shell store holds a last persona, the row becomes one button **Continue as family** or **Continue as teacher** (to `/signin`, which routes a signed-in grown-up home) plus a small "Someone else" link that shows the two-button row. Emits `{ persona, from: 'welcome-continue' }`.
- **Offline**: when `navigator.onLine` is false, the persona buttons stay visible but disabled, with one inline line "Needs the internet" (they re-enable on the `online` event). The offline page (section 3.12) stays the fallback for direct URLs.
- Welcome only shows when the device has no learner profile (`navigation/root.tsx`, initial route `Onboarding`), so a child who already plays never sees the row. Native builds never show it (OD-6).
- **Learner home is unchanged by this spec**: tabs Today, Journey and Library, plus the **Route** tab (LEARNING ROUTE, accessibility label "Learning Route") when `flags.myRouteEnabled` is on (Learning Route amendment LR-4). No grown-up entry is added to any of the four tabs.
- **Grown-up home row on Profile** (web, flag on; wireframe `parent/grown-up-home-card.md` Panel A): the grown-up zone on Profile gets a **first row** "Grown-up home" with the line "Your family, classes and billing". It calls `openGrownUpArea({ via: 'profile' })` (section 3.9), which asks for the PIN when needed and then opens the grown-up area directly, with no stop at the local dashboard. This is the entry on every family device that already has learner profiles (where Welcome never shows).
- **Grown-up home card** (wireframe `parent/grown-up-home-card.md` Panel B): `ParentDashboardScreen` (behind the gate already) shows, on web with the flag on, one card at the top: title "Grown-up home", the same line, button **Open**. It calls `openGrownUpArea({ via: 'dashboard' })`. The local dashboard below it is unchanged and still works offline and without an account.
- Both entries: when `navigator.onLine` is false the button is disabled with "Needs the internet" (as on Welcome). The line names only things that exist today (family, classes, billing); the learner bundle cannot read the console's feature flags, so it never promises reports or notes.
- **Plan screen** (F-BILL-002 section 4.7, route key `Paywall`; web, flag on): its **Open billing** button calls `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })` **in the same tab**, never a new tab, so the unlock written by the hand-off is in the tab that opens billing. Native builds keep F-BILL-002's behaviour (no purchase link). Flag off: F-BILL-002's `billingUrl()` behaviour.
- **Join prefill**: when the parent home's "Open the app on this device" hands over a family join code (section 3.8), the learner app's `JoinSpaceScreen` opens with the code filled in the next time it is shown in this tab within 30 minutes; the F-SPACE-001 steps (consent included) are unchanged. On a device without a learner profile, the code waits through the normal first run and fills the Join screen when the learner opens it.
- **Privacy link**: `privacyUrl()` reads `EXPO_PUBLIC_SITE_URL`, then `EXPO_PUBLIC_CONSOLE_URL` (back-compat; F-BILL-002 keeps reading it as "the site root"), then `https://hangulroute.com`. Legal pages stay on the site.

### 3.7 Grown-up sign-in and routing on the app host

- **`/signin`** (wireframe `shell/signin.md`) replaces the sign-in at `/teach`. Same Clerk widget and dev fallback as F-AUTH-002 section 3.3 (`<SignIn routing="hash" …/>`), with the **sign-up link hidden** (Clerk appearance `footerAction` hidden; sign-up is not reachable from this widget). Copy follows `?persona=` (or its alias `?as=`, which F-SITE-002 may send; unknown values are ignored): family intro, teacher intro, or a neutral intro without a hint. The line under the widget reads "Learners don't need an account. They start learning right away, or join a class with a code." (any-age wording). A link "I'm here to learn" goes to `/`. The old `whySignIn` bullets and the `clerkIntro` line are not shown on `/signin` (2026-10-12, design pass D14).
- **Creating a grown-up account (adult step, OD-13)**: under the widget, a small link "New here? Create a grown-up account" opens `/signin?mode=create` (persona kept). That view shows first, alone: "Grown-up accounts are for parents, guardians and teachers." and a checkbox "I am a parent, guardian or teacher" with **Continue** (disabled until ticked). Only then does Clerk `<SignUp>` render, with `unsafeMetadata={{ adultAffirmedAt: <ISO> }}` (stored on the Clerk user; no D1 row, no endpoint; F-AUTH-005 later shows it in the account page) and the instance's email verification (owner step S-2 confirms "verify email at sign-up" is on). After sign-up the router sends the new account to `/start`. No learner-facing screen links to `mode=create` directly.
- **After sign-in, and for a visitor who is already signed in**: `GET /api/spaces` → `personasFor` → `safeNextPath(?next)` when present and allowed for the account, else `homeFor({ personas, last, hint })`. One `location.replace`, no extra tap. Network failure: one line and Try again (F-CONSOLE-001 section 3.2 behaviour).
- A sign-in completed **in this tab** writes the grown-up unlock (section 3.9) **only when it proved a secret**: on a device whose marker is `pin` or `nopin`, or absent with profiles, an OAuth or SSO sign-in (Google) does not count by itself; the page then runs Clerk reverification (section 3.9) before writing the unlock. On a device with marker `none` there is no lock, so nothing extra is asked.
- **Installed PWA on iOS** (OD-15): when `matchMedia('(display-mode: standalone)')` matches, `/signin` lists the email-code method first, because an OAuth redirect may finish in Safari instead of the standalone window. Verified in M2 (section 6.2); the default stays until then.
- **`/teach`** becomes a router page (no UI beyond a "Taking you to …" line): it reads a hint from `?persona=` or `?as=` when present, otherwise none (old `/teach` bookmarks were the sign-in of every grown-up, families included). Signed out → `/signin` with the hint and `next=<current path and query>` when the URL has a query; signed in → `homeFor` with that hint.
- **`/start`** is the existing first-space page moved from `/teach/start` (component unchanged); `/teach/start` becomes a client redirect page to `/start` with the query kept. After creating a family the router lands on `/parent`; a class keeps step 3 (the code) then `/teach/space?id=`; a school goes to `/teach/home`. `/start` is also reached from the "not set up yet" states and the cross-links of section 3.8 (`/start?persona=parent|teacher`), so an account can always add its second persona.
- Clerk: `afterSignOutUrl` and `signOut({ redirectUrl })` become `/signin`; `fallbackRedirectUrl` becomes `/signin` (the router), `signUpFallbackRedirectUrl` becomes `/start`. `ROUTES.signIn = '/signin'`, `ROUTES.start = '/start'`.
- Every grown-up page uses one layout (`LocaleProvider`, `ConsoleAuthProvider`, `GrownUpLock`); `/signin` is exempt from the lock. A signed-out visitor on any other grown-up page is sent to `/signin?next=<path and query>` (today `useConsole()` sends to `/teach`, F-AUTH-002 section 3.1).
- Console locale: `pickConsoleLocale` reads a valid `?lang=` first and stores it (F-I18N-001 hand-off convention); then the stored choice; then the browser.

### 3.8 The adult frame and the persona homes

**Frame** (`components/console/AdultFrame.tsx`, replaces `ConsoleShell`; wireframe `shell/adult-frame.md`):

- Header: product name linking to the current persona home; the **persona switch** (segmented, two options, "Family" and "Teacher") only when the account holds both personas; otherwise the persona name as plain text; then the way back to the learner app.
- **Active persona** on a page: the page's own persona for `/parent*` and `/teach/home`; on any `/teach/space/**` or `/parent/space/**` page it comes from the **kind of the page's space** (`?id=` looked up in the spaces list the frame already fetched): `family` → `parent`, `class` or `school` → `teacher`, not from the path. The highlighted nav item follows the same rule. While the lookup is pending the frame shows the persona switch with no option checked (or the persona text) and the nav items of the account's last persona (Family when none), none highlighted, so the tab row keeps its height and usually its items (2026-10-12, design pass D16).
- **Navigation registry** `lib/console/shell-nav.ts`: `ADULT_NAV: { id, persona: AdultPersona | 'both', labelKey, target(ctx) → { href } | { action }, enabled(ctx) }[]`. **This spec registers every item**, so the frame never depends on a sibling adding itself:

| id | Persona | Label | Target | Shown when |
|---|---|---|---|---|
| `home` | parent | Home | `/parent` | always |
| `reports` | parent | Reports | the learner report (`ROUTES.learnerReport(…, 'family')`) when the account has exactly one family space with exactly one learner (the frame fetches that one roster once per tab, in memory); otherwise `/parent` (the cards are the index) | `reportsEnabled()` |
| `notes` | parent | Notes | `ROUTES.spaceNotes(familyId, 'family')` when there is one family space; otherwise `/parent` | `notesEnabled()` |
| `classes` | teacher | Classes | `/teach/home` | always |
| `lessons` | both | Lessons | action: F-BROWSE-001 `openBrowse({ source: 'nav' })` (a button, it opens the named browse window) | `browseEntryEnabled()` |
| `billing` | both | Billing | `/account/billing` | always |

- The four predicates live in `apps/web/src/lib/console/config.ts`, read build-time literal env names (`config.ts:20-30` pattern), default **off**: `reportsEnabled()` = `NEXT_PUBLIC_REPORTS_ENABLED` (F-REPORT-001), `notesEnabled()` = `NEXT_PUBLIC_NOTES_ENABLED` (F-FEEDBACK-001), `browseEntryEnabled()` = `NEXT_PUBLIC_BROWSE_ENABLED` (F-BROWSE-001 BR-10), `learningRouteEnabled()` = `NEXT_PUBLIC_LEARNING_ROUTE_ENABLED` (Learning Route LR-8). Whichever PR lands first (A-5b or the sibling's) adds the reader; the other imports it. An item whose page is not built is **not shown** (no disabled "coming soon" buttons; the disabled Account button of `ui.tsx:100` is removed).
- **Way back to the learner app**: labelled **Back to learning**, or **Open the learner app** when the device marker is absent or `none` and no `hr:profiles` list exists (a teacher's laptop). It clears the unlock and the console session (section 3.9), then `location.assign(learnerHome())`, where `learnerHome()` is `APP_ORIGIN + '/'` when the console runs on a site origin (`https://hangulroute.com` or `https://www.hangulroute.com`, the console still served there before F-SITE-002 S-10) and `/` on every other origin (the app host, a merged-build preview, a local build), so a preview or a test never leaves for production (2026-10-12, A-4a review; it first said `/` only on `APP_ORIGIN`).
- Language select and **Sign out**: in the header on wide screens; at phone width (below 720 px) they move to the footer, so the phone frame is one header row (brand mark and persona text, or the persona switch alone, then Back to learning; with the switch the brand mark steps out below 720 px) plus the tab row. From 720 px the brand mark returns and the brand name joins it only from 1120 px (`layout.maxWidth.full`), so the wide header is one row too (2026-10-12, design pass D2).
- Footer: "About Hangul Route" to `https://hangulroute.com` (the site), Privacy, Terms (site links); at phone width also Language and Sign out. "Back to site" (`console.shell.backToSite`) is removed.
- Phone width: the navigation is a row of tabs under the header (no hamburger menu); targets use `touchTarget`. **First-screen budget**: on `/parent` at 375 x 667 the frame and the whole first learner card are visible without scrolling (asserted in e2e, section 5).
- Switching persona: writes the last persona and navigates to the other home.

**Family home** `/parent` (wireframe `shell/parent-home.md`; the demo and `apps/web/src/data/mock-family.ts` are removed, OD-4):

- Data: `GET /api/spaces` (family spaces where the role is `owner` or `caregiver`), then `GET /api/spaces/:id/roster` per family space (existing routes; the roster is projected to the consented allow-list, `packages/backend/src/lib/roster-summary.ts`).
- One section per family space (usually one): family name as heading, then one card per learner: avatar, display name, last active ("today" / "yesterday" / weekday), "Minutes, last 7 days: n".
- **Card actions** (this spec owns them; each shown only when its predicate is on):
  - primary: **See report** → `ROUTES.learnerReport(familyId, learnerId, undefined, 'family')` when `reportsEnabled()`; otherwise **Open** → `ROUTES.space(familyId, 'family')` (the family roster);
  - **Send a note** → `ROUTES.spaceNotes(familyId, 'family')` (plus F-FEEDBACK-001's learner preselect parameter, an id, if it defines one) when `notesEnabled()`;
  - **Learning Route** → `ROUTES.learnerRoute(familyId, learnerId, 'family')` when `learningRouteEnabled()`.
- **Order**: stable, the order learners joined the family (`joinedAt` ascending, then id), sorted client-side; never by activity or minutes, so the card order never ranks siblings and does not change when activity changes.
- Actions under the cards: **Lessons** (F-BROWSE-001 `openBrowse({ source: 'nav' })`, when `browseEntryEnabled()`), **Plan the week** (`ROUTES.spacePlan(id, undefined, 'family')`), **Plan the term** (`ROUTES.spaceCurriculum(id, 'family')`), **Family settings** (`ROUTES.spaceSettings(id, 'family')`), **Add a learner** (a disclosure button, `aria-expanded`: it opens the family join code panel of the roster page and the join line inline under these actions; a second press closes it; 2026-10-12, design pass D15).
- **Family with no learner yet**: the join code panel large; one line "On the learner's own device, go to {profile}, then {section}, then "{join}", and enter this family code.", where `{profile}`, `{section}` and `{join}` are the learner app's labels for the Profile entry (`learner.home.profileLabel`), the Classes & family card (`caregiver.spaces.title`) and its Join button (`caregiver.spaces.join.cta`), the same i18n keys, so the line follows any rename (2026-10-12, design pass review: the path, not only the label); and **Open the app on this device**, which writes the join hand-off (`sessionStorage` key `hr:shell:joinCode` = `{ v: 1, code, at }`, `JoinHandoffSchema`, no name, no space id), clears the unlock and the console session like Back to learning, and opens `learnerHome()`.
- **No family yet** (the account does not hold the family persona: a teacher who chose Family on Welcome, a stale "Continue as family", an old `/parent` link): heading "You don't have a family space yet.", primary **Set up my family** (`/start?persona=parent`), and **Go to Classes** when the account holds the teacher persona. Nothing else.
- Quiet cross-link at the bottom when the account has no teacher persona: "Also teach a class? Set up a class" (`/start?persona=teacher`); when it has one: "Your classes are under Teacher" with the switch.
- No ranking, no comparison between children, no class average (F-PAR-001 section 3.5): no "best" or "behind" wording; copy passes `lib/console/banned-text.ts`.

**Teacher home** `/teach/home` (wireframe `shell/teacher-home.md`): the existing home with the Family group removed (families live under the Family persona). Classes and School groups, statuses and links unchanged; **+ New class** (`console.home.newClass.cta`, replacing "+ New space") goes to `/start?persona=teacher`; the "Hi, {name}" title is dropped (2026-10-12, design pass D8). Each class row gets **Class report** (`ROUTES.classReport(id, undefined, 'class')`) when `reportsEnabled()` and **Notes** (`ROUTES.spaceNotes(id, 'class')`) when `notesEnabled()`. An archived class row keeps Class report (a past term's report) and has no Notes (2026-10-12, design pass D8). Under the list, **Lessons** when `browseEntryEnabled()`.

- **No class yet** (the account does not hold the teacher persona): heading "You don't have a class yet.", primary **Set up a class** (`/start?persona=teacher`), and **Go to Family** when the account holds the family persona.
- Quiet cross-link at the bottom: "Learning at home too? Set up a family space" (`/start?persona=parent`) when the account has no family persona; "Your family is under Family" with the switch when it has one.

**Space pages under both prefixes** (`lib/console/space-pages.ts`, A-5b): `SPACE_PAGES` lists every subpage of `app/(console)/teach/space/` (`''`, `plan`, `curriculum`, `relink`, `settings`, `lecture`, and the sibling pages `learner`, `report`, `notes`, `route` as they land). Each has a twin file under `app/(console)/parent/space/` that re-exports the teacher page component. A unit test walks `app/(console)/teach/space/**/page.tsx` and fails when a page has no twin or is missing from `SPACE_PAGES` (so a sibling page cannot ship without its family URL).

- **Route builders**: one helper `spacePath(sub, query, kind?)` returns `/parent/space…` for `kind === 'family'` and `/teach/space…` otherwise. Every space builder in `ROUTES` (this spec's and the siblings': `space`, `spacePlan`, `spaceCurriculum`, `spaceRelink`, `spaceSettings`, `spaceLecture`, `learnerReport`, `classReport`, `spaceNotes`, `learnerRoute`) takes `kind?: SpaceKind` as its **last, optional** parameter. Omitted means `/teach/space…`, which renders every kind (the pre-A-5b behaviour), so a sibling builder that lands before A-5b keeps working and A-5b adds `kind` at the call sites.
- `/teach/space?id=<family>` keeps working (same component), so no link breaks.

**Billing**: `app/(console)/account/billing/page.tsx` re-exports today's billing page; `/teach/billing` becomes a client redirect page to `/account/billing` with the query kept (Stripe `?checkout=` returns). F-BILL-002 then changes the page in place and adds `/account/billing/receipts`. The redirect page is the only `/teach/billing` forwarder on the app host; moves from hangulroute.com are F-SITE-002's `_redirects` (section 3.13).

### 3.9 Shared devices: child profiles and grown-up sign-in on one browser

The problem: a parent signs in once on the family tablet (Clerk keeps the session for days). A child on the same browser must not reach grown-up pages, even though Clerk would let the browser in. The device PIN may unlock the grown-up area only when it is at least as strong as the account sign-in.

**Device gate marker.** The learner app writes `hr:device:gate` (`DeviceGateMarkerSchema`) through `platform/storage` (`writeJson('device:gate', …)`) on boot and whenever profiles or the PIN change, from A-6 on, independent of the flag:

| Device state | Marker |
|---|---|
| at least one learner profile, `gateRequired(...)` true, `parentPinHash !== null` | `{ v: 1, gate: 'pin', pinEpoch }` |
| at least one learner profile, `gateRequired(...)` true, `parentPinHash === null` (a family device without a PIN) | `{ v: 1, gate: 'nopin' }` |
| otherwise (no learner profile, or a self-only device without a PIN) | `{ v: 1, gate: 'none' }` |

- `pinEpoch` is the time the current PIN was set, from a new device key `account:pinSetAt` (epoch ms) that `account-store.setPin` writes with every new PIN (first set, change, Forgot PIN reset). A PIN set before A-6 has no `pinSetAt` and reads as epoch `0`. The marker holds no name, no count and no profile data.
- Marker writer details (2026-10-12, A-6, `store/device-gate.ts`): it writes nothing before the profiles and the account have loaded; a profile without a role counts as a learner (the `ProfileRoleSchema` default); and a `none` marker is written only when the stored `hr:profiles` list, read again strictly, also gives `none` (no learner, or self learners only without a PIN), so a profile read that failed at boot (the app then looks empty) never tells the console to open. `account:pinHashSeen` is read strictly too: a read that fails counts as a changed PIN, so the epoch moves. Only a correct PIN on the PIN screen sets `ui-store.lastPinVerifiedAt`; creating a PIN does not.
- Exact reads for the marker (2026-10-12, A-6 review): the `none` check reads both `hr:profiles` and `account:parentPinHash` again with `readJsonExact` (only a missing key is "nothing"; a failed read or a value that does not parse throws) and computes the confirming marker from the stored list and the stored hash, never from memory; a stored profile value that is not a list, or a stored hash that is not a string, refuses `none`. The account store reads the PIN hash exactly at hydrate: when that read fails (and a lenient retry finds no hash) or the value is not a string, `pinHashReadFailed` is set, the writer writes no marker, the epoch is not reconciled and no `account:pinHashSeen` is written until a PIN is set again, and the hand-off sees no marker (no unlock). A stored `account:pinHashSeen` that is present but not a fingerprint (16 hex digits) or `none` reads as unread, so it moves the epoch.
- Older learner tabs and `none` (2026-10-12, A-6 review): a tab still running a learner bundle older than A-6 can add a child profile without rewriting the marker, so a `none` written by an A-6 tab can be stale until any A-6 tab boots again (every boot rewrites the marker from the stored list). The console opens a grown-up page on a stale `none` only for a grown-up already signed in on the app host, which first happens at M2. So **M2 (owner step S-2) starts at least 7 days after A-6 reached production**, the same window section 3.4 gives old workers; the A-3 merge itself needs no wait (A-3 adds pages, no grown-up session).

**Trusted epoch.** The console keeps, in the shell store (`hr-shell` / `kv`, key `pinEpoch`), the marker's `pinEpoch` seen at the last **secret-proving sign-in** in this browser. The PIN path is available only while `marker.pinEpoch === trustedEpoch`. A child who changes or resets the PIN changes the epoch, so the PIN stops opening the grown-up area until a grown-up signs in again. The first time on a device the grown-up therefore signs in once (they usually do anyway). **Epoch `0` is never trusted** (review 2026-10-11): `0` is the shared value of every PIN set before A-6 (no `account:pinSetAt`), so a tab still running a pre-A-6 bundle could reset the PIN without changing it. When the marker's `pinEpoch` is `0` the console stores no trusted epoch, the PIN path stays off and the grown-up signs in, until the PIN is next set by an A-6 or later bundle (which writes `account:pinSetAt`). **Any PIN change moves the epoch, whichever bundle made it** (2026-10-12, A-4a review, for A-6): a tab still running a pre-A-6 bundle could also reset a PIN whose real epoch a grown-up already confirmed, without touching `account:pinSetAt`. So the A-6 marker writer also keeps a fingerprint of the stored `parentPinHash` (device key `account:pinHashSeen`, a short digest, never the hash itself in the marker) and, on a boot that finds a different hash, writes `account:pinSetAt = now` before it writes the marker.

**Secret-proving sign-in.** A Clerk sign-in completed in this tab counts when its first factor asked for a secret: password, email code, SMS code or passkey. An OAuth or SSO sign-in (`oauth_*`, `enterprise_sso`, read from the completed sign-in's first-factor strategy) does not count on its own on a device with marker `pin`, `nopin` or absent-with-profiles: the page then runs Clerk reverification (`useReverification`, first factor, the same mechanism F-BILL-002 section 4.4 uses for step-up), which asks for an email code to the account's address, the password or a passkey; the unlock is written after it succeeds. Cancelled reverification: the visitor stays signed in, the lock stays, and the lock screen shows.

**Grown-up lock** (`GrownUpLock`, decision in `lib/console/grown-up-lock.ts`, pure, 100 % covered; wireframe `shell/grown-up-lock.md`):

| Marker | Unlock in this tab | Result |
|---|---|---|
| any | — on `/signin` | open (exempt) |
| absent and no `hr:profiles` key, or `none`, or no IndexedDB API | — | open |
| absent but `hr:profiles` holds a non-empty list (a learner app older than A-6), or the read failed or took longer than 3 s | `signin` unlock active | open |
| absent but `hr:profiles` holds a non-empty list, or the read failed or took longer than 3 s | otherwise | locked: sign-in only, line "Sign in again to open grown-up pages on this device." (no PIN path can follow) |
| `pin` | `signin` unlock active | open |
| `pin` | `pin` unlock active and `unlock.pinEpoch === marker.pinEpoch === trustedEpoch` | open |
| `pin` | `pin` unlock active but not all three epochs equal | locked: sign-in only, with the line of the cause below |
| `pin` | none or expired | locked: PIN path and sign-in when `marker.pinEpoch === trustedEpoch`; else sign-in only, with the line of the cause below |
| `nopin` | `signin` unlock active | open |
| `nopin` | otherwise | locked: sign-in only, line "Set a grown-up PIN in the app, or sign in again." |

Lines of a `pin` device that the PIN cannot open, chosen by the cause whether or not a PIN unlock exists, so each promises only what a sign-in can do (2026-10-12, A-4a review; the first table showed the PIN-changed line for a PIN unlock with no trusted epoch and "sign in once" for epoch `0`):

| Cause | Line |
|---|---|
| marker `pinEpoch` is `0` (a PIN set before A-6; a sign-in never trusts it) | "To use the grown-up PIN here, set it again in the app, then sign in once." |
| no trusted epoch in this browser | "Sign in once on this device to use the grown-up PIN here." |
| trusted epoch differs from the marker, or the PIN unlock carries another epoch | "The grown-up PIN changed on this device. Sign in again to use it." |

- The `hr:profiles` fallback reads only whether the stored string is longer than `[]`; it never parses or shows profile data. "No IndexedDB API" (the API is missing, or touching it throws) means open because such a browser cannot keep learner profiles either. A read that fails where the API exists (a connection the browser closed, a backing store error) is retried once on a fresh connection; if it fails again, or the device or trusted-epoch read takes longer than 3 s (WebKit can hang the first IndexedDB open), the lock treats the device as one that may hold profiles: sign-in only, never open (2026-10-12, A-4a review; the first draft opened on any unreadable storage).
- **Unlock record**: `sessionStorage` key `hr:grownup:unlock` = `{ v: 1, at, seen, src: 'pin' | 'signin', pinEpoch? }` (`GrownUpUnlockSchema`; `pinEpoch` is **required** for `src: 'pin'` and absent for `src: 'signin'`, copied from the marker by the learner app; a `pin` record without `pinEpoch` reads as absent, so the lock falls to the "none or expired" row of the table above). Active while `now - seen` is in `[0, GROWN_UP_IDLE_MS)`, 15 minutes (the learner gate's `PARENT_SESSION_MS`, `session.ts:9`). `GrownUpLock` refreshes `seen` on navigation and on interaction (pointer, key, click and wheel, listened for on `window` in the capture phase) at most once a minute; on a page that only an unlock keeps open, an interaction after the 15 idle minutes is stopped before it reaches the page (pointer, key and click; a wheel cannot be), the page is covered and the decision runs again (2026-10-12, A-4a review; the frame of A-5a then needs no refresh of its own). `sessionStorage` is per tab and per origin and survives same-tab navigations, including the round trip to Stripe Checkout.
- **Before the decision** the page renders an empty `surface.canvas` (no frame) and makes **no API call** (as A-4a built it; 2026-10-12, design pass D12); no grown-up data is fetched or shown while locked.
- **Restores from the back/forward cache**: `GrownUpLock` listens for `pageshow` with `event.persisted === true` and for `visibilitychange` to `visible`; on either it first hides the content synchronously (before the next paint), then re-reads the marker and the unlock and re-runs the decision. Grown-up paths are also served with `Cache-Control: no-store` (section 3.17), which keeps most browsers from putting them in the cache at all. Refinements (2026-10-12, A-4a review): the content is hidden by an opaque full-viewport cover in the canvas colour, with the content wrapper `aria-hidden`, never collapsed, so a re-check that opens again keeps the layout, the scroll position and the focus; a page that only an unlock keeps open is also covered on `visibilitychange` to `hidden` (before the tab switcher takes its picture) and on `pagehide` into the cache; a page that cannot lock (marker `none`, or absent with no profiles) is never covered on a tab switch, and its return re-checks in the background. The decision key is the pathname: a new pathname decides again before the page renders, and a decision is never reused after the page left that pathname or the exemption; a query-only change (a page's own `router.replace`) keeps the page mounted and re-checks in the background. `Use the grown-up PIN` and `Sign in again` carry the path and the query.
- **Lock screen**: title "Grown-ups only", one line, primary **Use the grown-up PIN** (only when the PIN path is available) → `location.assign('/?gate=grown-up&next=<path and query>')`; **Sign in again** → Clerk sign-out, then `/signin?next=…` (a secret-proving sign-in writes the unlock); tertiary **Back to learning** → `learnerHome()`. Rendering the lock removes `hr:console:session` from this tab.
- **PIN path in the learner app** (A-6): the learner root parses the boot intent once (`logic/shell/boot-intent.ts`, pure) and removes it from the address with `history.replaceState`. `gate=grown-up` with a `next` accepted by `safeNextPath` opens `PinEntry { next: 'GrownUpArea', url: next }` over the normal start screen (`GrownUpDestination` gains `'GrownUpArea'`). Cancel or back: the learner home, nothing written.
- **Destination `GrownUpArea` never creates or resets a PIN**: it always opens in `verify` mode, hides "Forgot PIN?", and never enters `setup-1` / `setup-2` or `PinReset`. When no PIN hash is stored it shows one line "This device has no grown-up PIN. Sign in on the grown-up page instead." with **Continue** → `location.assign(next ?? '/signin')` (no unlock written; `?lang=` as in step 4 below, 2026-10-12, A-6).
- **`openGrownUpArea({ via, target? })`** (web only, `platform/grown-up-handoff.web.ts`; native stub throws in tests and is never called), `via: 'profile' | 'dashboard' | 'plan' | 'lock'`:
  1. marker `none` (self-only device without a PIN): no unlock is needed; navigate.
  2. marker `nopin`: write nothing; navigate (the console's lock asks for a sign-in).
  3. marker `pin`: a PIN verification must have succeeded in the last `GROWN_UP_FRESH_PIN_MS` = 2 minutes (`ui-store.lastPinVerifiedAt`, memory only, set by `PinEntry` on a correct PIN). A gate opened through the 15-minute session (`gateOpensDirectly`) does **not** count: the hand-off first opens `PinEntry { next: 'GrownUpArea' }` in verify mode. So a parent who just entered the PIN to reach the dashboard or the Plan screen is not asked again, and a tablet handed to a child after a PIN entry a while ago is.
  4. then write the unlock `{ v: 1, at: now, seen: now, src: 'pin', pinEpoch }`, emit `shell.grown_up_handoff { via, target: 'router' | 'billing' | 'next' }`, and `location.assign(target ?? '/signin')` with `?lang=<UI locale>` appended when the learner's UI locale is not the default (F-I18N-001 hand-off).
- **Clearing**: every boot of a learner-bundle root (`app`, `/present`, `/browse`) removes `hr:grownup:unlock` and `hr:console:session` from its own tab, except the `app` root booting with a `gate=grown-up` intent (which may write a new unlock after the PIN). **Back to learning**, **Open the app on this device** and **Sign out** remove both before leaving. So a device handed back to a child is locked again, and a new tab opened from a grown-up page (`window.open` copies `sessionStorage`) carries no unlock once it boots a learner root. Also (2026-10-12, A-6): the `app` root clears with a `gate=grown-up` intent too, since the lock that sent the tab there already removed the console session and the unlock it could not use is replaced after the PIN (so a hand-typed intent keeps nothing); a learner page restored from the back/forward cache (`pageshow` with `persisted`) clears both keys again and forgets the in-memory `lastPinVerifiedAt` and `parentGateOpenedAt` (A-6 review), so browser Back to the app and Forward into a grown-up page meets the lock, and a tap on a grown-up entry right after Back asks for the PIN. Until F-BROWSE-001 BR-6 mounts `BrowseApp`, `/browse` mounts the learner app and clears as the `app` root does (it reads no boot intent); `BrowseApp` itself never clears the unlock (F-BROWSE-001 BD1 and section 12, whose BR-0b amends section 6.4).
- The `/present` and `/browse` roots never hydrate or persist any learner store (F-TCH-004 TD1, F-BROWSE-001 BD1 and BD3); they only clear the two keys above. Deviation until F-BROWSE-001 BR-6 (2026-10-12, A-6 review): `/browse` still mounts the learner `App`, so it hydrates, persists and writes the device gate marker exactly as the app root does (behaviour that predates A-6); the test-plan item "`/browse` never calls learner hydration" moves to BR-6, which mounts `BrowseApp` and takes `browse` out of `LEARNER_APP_ROOTS`.
- The learner app never reads the Clerk session, a grown-up's name or email. The console never reads learner progress or profiles (only the marker and the `hr:profiles` presence check above).
- **Self-only devices** (an adult learner's own phone, no PIN): the marker is `none`, so a signed-in grown-up opens directly, mirroring `gateOpensDirectly`.
- **Classroom devices** where students made child profiles: the marker is `pin` or `nopin`; the teacher uses the device PIN (after one secret-proving sign-in) or signs in again. A teacher's own laptop without learner profiles has no lock.

### 3.10 Role switching

| From | To | How | Gate |
|---|---|---|---|
| learner | learner | Profile switch (F-PROF-001 section 3.4) | none (unchanged) |
| learner | family or teacher | Profile → grown-up zone → **Grown-up home** row (first row) | fresh PIN (section 3.9), then Clerk sign-in if signed out |
| learner | family or teacher | Profile → grown-up zone → dashboard card **Open**; Plan screen **Open billing** | as above |
| no profile (Welcome) | family or teacher | persona row → `/signin?persona=` | Clerk sign-in; account creation behind the adult step; the lock applies only when the marker is not `none` (not possible without profiles) |
| family | teacher (or back) | persona switch in the frame; or the "Go to …" buttons of the "not set up yet" states | none (same account) |
| family or teacher | the other persona, not yet held | cross-link "Also teach a class?" / "Learning at home too?" → `/start?persona=` | none |
| family or teacher | learner | **Back to learning** / **Open the learner app** | clears the unlock and the console session |
| family or teacher | another account | Sign out → `/signin` | Clerk |
| any grown-up page | the same page after 15 idle minutes on a locked device | lock screen | PIN (when the epoch is trusted) or a secret-proving sign-in |

A grown-up who is also a learner on the same device uses both: learning at `/`, the grown-up area through the gate.

### 3.11 Deep links and `next`

- **Grown-up deep links** (emails, bookmarks, Stripe returns, links from the site): any grown-up path with its query. Order of checks on load: signed in? (else `/signin?next=`) → lock decision → page. The page itself checks membership through the API (403 shows the existing "no access" panel).
- **`safeNextPath(raw)`** (pure): expects the value read with `URLSearchParams.get('next')` (already decoded) and takes a value that starts with `/` as is, so escapes such as `%3A`, `%26` or `%25` in a deep link's query survive; any other value is percent-decoded once. It refuses a percent-encoded `..` segment too, and accepts only a relative path that starts with `/`, not `//` or `/\`, has no scheme, no control characters, no `..` segment, is at most 512 characters, and passes `isGrownUpPath`; returns path and query without a fragment; anything else returns `null` (then the persona home is used). This closes open redirects through `next`.
- **Learner deep links**: the learner app stays non-addressable (no `linking`): any non-reserved path opens the learner app's start screen, never a specific learner's data. Boot intents read once and removed from the address: `gate=grown-up&next=` (section 3.9) and the existing `?lang=` (`platform/locale.web.ts`). Unknown query keys are ignored.
- **Second and third roots** of the learner bundle: `/present` (F-TCH-004) and `/browse` (F-BROWSE-001). The root chooser checks them before the bounce rule. **`/browse` access** is F-BROWSE-001's: a scope decided by the server for the signed-in account (`GET /api/entitlements/browse`: `full` for a paying account, `sampler` otherwise) and handed to the browse tab by the console (`postMessage` from the window it opened, section 4.3 of that spec), or the in-app gate hand-off after the PIN; with no pass `/browse` shows only its Access screen (no lesson, title or card). Typing `/browse` therefore gives a child nothing beyond that screen.
- `/teach/space…?id=<family>` and `/parent/space…?id=<family>` show the same page; links generated after A-5b use the prefix of the space kind.

### 3.12 Offline behaviour

- **Learner app**: unchanged; plays offline after one visit (F-PWA-001).
- **Grown-up pages are online-only** (Clerk and the API need the network; the console never had a service worker). A grown-up navigation while offline is answered by the precached `/grown-ups-offline.html` (wireframe `shell/offline.md`): "You're offline", "Grown-up pages need the internet. Learning still works offline.", **Back to learning** (`/`), **Try again** (reload). Its strings are the shipped locales of `console.offline`, picked by `navigator.languages`, English otherwise.
- The learner-side entry buttons (Welcome row, Profile row, dashboard card, Plan screen Open billing) are disabled with "Needs the internet" while `navigator.onLine` is false (section 3.6), so a first-time grown-up is not sent to a page load that cannot work.
- A grown-up page already open that loses the network shows the existing "can't reach" panels and Try again (F-CONSOLE-001).
- The lock's PIN path works offline up to the PIN (the learner app is precached); the following navigation lands on the offline page.
- The presenter (`/present`) stays offline-capable (F-TCH-004 section 3.8); nothing here changes its precache.
- A device that never visited the app host and is offline gets the browser's own offline page (no worker yet), as today.

### 3.13 Migration of existing users and URLs

**One owner per mechanism**: the app host's own legacy paths (`/teach/billing`, `/teach/start`) are this spec's client redirect pages (A-4b, A-5c). Everything that moves **from hangulroute.com** is F-SITE-002's: its site-only output `out-site/` holds no grown-up file and its `_redirects` (S-9 builds, S-10 serves) send old URLs to the app host. This spec writes no stub page on the site (OD-5).

**Phases** (each reversible):

| Phase | What changes | Done by | Reversible by |
|---|---|---|---|
| M0 | denylist and offline page in the learner worker, `/_next/static` header rule (A-2); the grown-up `no-store` and security headers of section 3.17 ship with A-3 (`merge-console.mjs`) | merge | revert |
| M1 | console pages served on the app host as well (A-3); nothing links there | merge; owner step S-1 (Clerk key on `hangul-route-app` build) follows A-4b (section 6.2) | revert A-3 |
| M2 | owner signs in on `app.hangulroute.com/signin` in a browser **and** in the installed PWA on iOS and Android, opens a class, the family home and the billing page (OD-10, S-2) | owner | — |
| M3 | learner entry points on (S-3); site redirects on (F-SITE-002 S-10); Stripe returns to the app host (F-BILL-002 B-10, `BILLING_URL`) | owner steps and merges, **at least 7 days after A-2 reached production**, after S-0 | S-3: unset the variable, Retry deployment; S-10: revert (F-SITE-002); B-10: unset `BILLING_URL` |
| M4 | A-10 flips this spec's code defaults (flag on) | merge, at least 14 days after M3 | revert A-10 |

**Redirects from hangulroute.com** (F-SITE-002 section 3.10, contract in section 6.4): `/teach` and `/teach/*` → the same path on the app host (the app host's `/teach` router, `/teach/billing` and `/teach/start` redirect pages then finish the move), `/parent` and `/parent/*` (demo slugs included) → `/parent`, and `/signin`, `/start`, `/account`, `/account/*` → the same path. Query strings are kept; browsers keep the fragment across an HTTP redirect whose target has none. The console language does not travel (different origin); the grown-up's browser language or a `?lang=` from the site's sign-in links picks it (F-SITE-002 may append `lang` for a non-English site page).

**Who is affected and how**

- **Learners**: nothing changes. Same origin, same IndexedDB, same manifest. Installed PWAs keep working.
- **Grown-ups with a Clerk account**: same Clerk instance and user id, so the same `accounts` row and spaces. They may need to sign in once on the app host; on a device with child profiles the first visit asks for a secret-proving sign-in (section 3.9).
- **In-flight Stripe Checkout** started before B-10 returns to `hangulroute.com/teach/billing?checkout=…`; after S-10 the site redirect forwards it with the query to the app host, whose `/teach/billing` page forwards to `/account/billing?checkout=…`. Before S-10 the site still serves the billing page itself.
- **Bookmarks and emailed links** to `/teach/space?id=…`: forwarded with the query.
- **Old `/parent/mina` demo links**: forwarded to `/parent` (sign-in), the demo no longer exists.
- **Lecture presenter**: the console opens `/present` on its own origin; `LECTURE_CONSOLE_ORIGINS` gains `https://app.hangulroute.com` (A-1) and keeps the old entries, so a console still open on the site during the move keeps working.
- **Owner runbook**: Step 6 confirmation line and the build variable table are updated in A-0 (console URL moves, `EXPO_PUBLIC_SITE_URL` replaces `EXPO_PUBLIC_CONSOLE_URL`).

**Rollback**: set `EXPO_PUBLIC_GROWN_UP_HOME=false` (Retry deployment); revert F-SITE-002 S-10 (the site Worker serves `out/`, which still contains the console, until F-SITE-002 removes it); unset `BILLING_URL` (F-BILL-002). The app host keeps serving console pages harmlessly. No data changes in either direction. **Reverting A-6** (2026-10-12, A-4a review): once a learner build wrote `hr:device:gate`, the console trusts the marker over the `hr:profiles` fallback, and a reverted learner bundle would never update it (a `none` marker would stay while child profiles are added). A revert of A-6 therefore ships a learner build that deletes `hr:device:gate` on boot, so the console falls back to the `hr:profiles` rule; the owner runbook carries this rule.

### 3.14 Data and API (additive only)

- **No D1 migration. No new endpoint. No change to any request or response shape.** Personas are derived from `GET /api/spaces` (`role`, `space.kind`), which every console page already calls.
- **New module** `packages/content-schema/src/schemas/app-shell.ts` (exported from `src/index.ts`, appended), pure, 100 % covered:
  - `APP_ORIGIN = 'https://app.hangulroute.com'`, `SITE_ORIGIN = 'https://hangulroute.com'`
  - `PersonaSchema`, `AdultPersonaSchema`, types `Persona`, `AdultPersona`
  - `GROWN_UP_PREFIXES = ['/signin', '/start', '/teach', '/parent', '/account'] as const`, `LEARNER_ROOTS = ['/present', '/browse'] as const`
  - `APP_ROUTES = { signIn: '/signin', start: '/start', parentHome: '/parent', teacherIndex: '/teach', teacherHome: '/teach/home', billing: '/account/billing', learn: '/' } as const`
  - `isGrownUpPath(pathname)`, `isLearnerRoot(pathname)`, `safeNextPath(raw)`, `legacyAppTarget(pathname)` (app-host legacy pages: `/teach/start` → `/start`, `/teach/billing` → `/account/billing`, else `null`), `personaHint(params)` (reads `persona`, then `as`; unknown → `null`)
  - `personasFor(memberships: readonly { kind: SpaceKind; role: SpaceRole }[])`, `homeFor({ personas, last, hint })`
  - `DeviceGateMarkerSchema` (`{ v: 1, gate: 'pin', pinEpoch: number } | { v: 1, gate: 'nopin' | 'none' }`), `GrownUpUnlockSchema` (`{ v: 1, at, seen, src: 'pin', pinEpoch } | { v: 1, at, seen, src: 'signin' }`, finite non-negative numbers; a `pin` record without `pinEpoch` is absent), `LastPersonaSchema` (`{ v: 1, persona }`), `JoinHandoffSchema` (`{ v: 1, code, at }`, code matches the join-code shape of F-SPACE-001), all lenient on read (`safeParse`; invalid means absent)
  - `GROWN_UP_IDLE_MS = 15 * 60_000`, `GROWN_UP_FRESH_PIN_MS = 2 * 60_000`, `JOIN_HANDOFF_MS = 30 * 60_000`, `unlockActive(record, now)`
  - storage names: `DEVICE_GATE_KEY = 'device:gate'` (stored as `hr:device:gate` by the learner app), `PIN_SET_AT_KEY = 'account:pinSetAt'`, `SHELL_DB = 'hr-shell'`, `SHELL_STORE = 'kv'`, `SHELL_KEYS = { lastPersona: 'lastPersona', pinEpoch: 'pinEpoch' }`, `UNLOCK_SESSION_KEY = 'hr:grownup:unlock'`, `CONSOLE_SESSION_KEY = 'hr:console:session'` (the existing key, named once), `JOIN_HANDOFF_KEY = 'hr:shell:joinCode'`
  - telemetry codes: `SHELL_TELEMETRY_PREFIX = 'shell.'` and `SHELL_TELEMETRY_PAYLOADS` (per `shell.*` name, the only payload keys and values of section 3.18)
- `LECTURE_CONSOLE_ORIGINS` gains `'https://app.hangulroute.com'` (append).
- `packages/backend/src/lib/auth.ts` (A-9): `verifyToken` gets `authorizedParties` = the CORS allow-list the Worker already uses (`lib/cors.ts`: `ALLOWED_ORIGINS` when set, else its defaults, which include hangulroute.com, www, app.hangulroute.com and localhost), so a token whose `azp` names another site is refused. On a named non-production deployment (`ENVIRONMENT` set and not `production`) previews keep working exactly where CORS already lets them call; production (`ENVIRONMENT` unset or `production`) uses the list alone, so the local dev server and `*.workers.dev` leniency that CORS keeps without an explicit list never applies to tokens there (a Clerk Production instance serves only its own domain). A token with no `azp` (not minted by a browser) follows Clerk's default and is accepted after its signature and expiry checks.
- Stripe return URLs are F-BILL-002's (`billingReturnUrl`, `BILLING_URL`, default `https://app.hangulroute.com/account/billing` from its B-10); this spec does not change `entitlements.ts`.
- `apps/web` adds the dependency `idb-keyval` (already used by `apps/mobile`) to read `hr:device:gate` and `hr:profiles` from the learner's default store and to read and write the shell store (`createStore(SHELL_DB, SHELL_STORE)`); every access is wrapped in try/catch in `lib/console/device-marker.ts` and `lib/console/shell-store.ts` (the web stand-ins for the safe storage hook, like `lib/console/session.ts`). `sessionStorage` access goes through `lib/console/unlock.ts` (try/catch) on the web and `platform/grown-up-handoff.web.ts` in the learner app. The learner app reads the shell store only through `platform/shell-store.web.ts` (read-only `lastPersona`; native stub returns null).

### 3.15 i18n keys (`packages/i18n`, English authored; `ko` / `es` follow the F-I18N-001 overlay process)

| Key | Where | Note |
|---|---|---|
| `learner.welcome.grownUps.lead` | Welcome | "Here to support a learner?" |
| `learner.welcome.grownUps.parent`, `.teacher` | Welcome | button labels |
| `learner.welcome.grownUps.continueParent`, `.continueTeacher`, `.someoneElse` | Welcome | returning grown-up |
| `learner.welcome.grownUps.needsInternet` | Welcome, Profile row, dashboard card, Plan screen | offline line |
| `learner.profile.grownUpHome.title`, `.line`, `.selfTitle` | Profile grown-up zone row | `selfTitle` on a self-only device (design pass D9, `design/screens/app-shell/`) |
| `caregiver.grownUpHome.title`, `.line`, `.cta` | ParentDashboard card | |
| `caregiver.grownUpHome.noPin`, `.continue.cta` | PinEntry `GrownUpArea` without a PIN | button keyed `.cta` for the 28-character budget (A-6) |
| `console.shell.backToLearning`, `.openLearnerApp`, `.aboutSite`, `.privacy`, `.terms` | frame | `backToSite` is removed (unused after A-5a) |
| `console.shell.persona.groupLabel`, `.parent` ("Family"), `.teacher` | frame switch | |
| `console.shell.nav.home`, `.reports`, `.notes`, `.classes`, `.lessons`, `.billing` | frame | registered here (section 3.8) |
| `console.signIn.persona.parent.intro`, `.teacher.intro`, `console.signIn.neutralIntro`, `console.signIn.learnersNoAccount`, `console.signIn.imLearning` | `/signin` | replaces `kidsNoAccount` on this page |
| removed: `console.whySignIn`, `console.clerkIntro`, `console.kidsNoAccount` (A-4b); `console.home.title` ("Hi, {name}"), `console.home.newSpace` (A-5a) | — | not drawn by the design pass (D8, D14); the PR that removes the last reader deletes the key with its `es` and `ko` overlays (2026-10-12) |
| `console.signIn.create.link`, `.lead`, `.affirm`, `.continue`, `.back` | `/signin?mode=create` | adult step |
| `console.signIn.router.goNow`, `console.signIn.unreachable`, `console.signIn.standaloneFinish` | `/signin`, routers | visible router link, Clerk unreachable, installed iOS PWA (section 3.19; added by the design pass) |
| `console.signIn.reverify.title`, `.line` | `/signin` on a locked device after OAuth | |
| `console.lock.title`, `.line`, `.usePin.cta`, `.signInAgain.cta`, `.backToLearning.cta`, `.pinChanged`, `.firstSignIn`, `.noPin`, `.pinRenew`, `.signInOnly` | lock | buttons end in `.cta` (the 28-character budget); `pinRenew` and `signInOnly` added 2026-10-12 (A-4a review) |
| `console.parentHome.title`, `.minutes7d`, `.child.open`, `.child.seeReport`, `.child.sendNote`, `.child.route`, `.actions.lessons`, `.actions.planWeek`, `.actions.planTerm`, `.actions.settings`, `.actions.addLearner`, `.empty.title`, `.empty.line`, `.empty.openApp`, `.noFamily.title`, `.noFamily.setUp`, `.noFamily.goTeacher`, `.cross.addClass`, `.cross.toTeacher` | `/parent` | reuse `console.roster.*` relative-day strings; `.empty.line` takes the learner Join label |
| `console.home.classReport`, `.notes`, `.lessons`, `.newClass.cta`, `.noClass.title`, `.noClass.setUp`, `.noClass.goFamily`, `.cross.addFamily`, `.cross.toFamily` | teacher home | |
| `console.offline.title`, `.line`, `.back`, `.retry` | offline page | read at build time by `pwa-postbuild.mjs` through `scripts/ts-loader.mjs` |
| `a11y.shell.personaSwitch`, `a11y.shell.redirecting` | frame, routers | `personaSwitch` is the switch's group label ("Switch between Family and Teacher", design pass review); `a11y.shell.lockRegion` dropped (2026-10-12): the lock region is labelled by its heading (section 3.16) |

Copy rules: shared surfaces (Welcome, Profile row, `/signin`, offline page) use no age wording and never say "kids"; grown-up pages may address parents and teachers directly (CLAUDE.md section 1). Draft strings: Appendix A. Every string passes the caregiver ban list (`apps/web/src/lib/console/banned-text.ts`, and `apps/mobile/src/logic/homework/banned-text.ts` for learner strings). No string names a price or "Premium" (the Lessons entry included).

### 3.16 Accessibility

- Persona switch: `role="radiogroup"` with two `role="radio"` options (`aria-checked`), label `a11y.shell.personaSwitch`. Manual activation: arrow keys move focus only and never change `aria-checked`; Space, Enter or a click commits and navigates, because choosing opens the other home (WCAG 3.2.2). A-5a tests that ArrowRight alone does not navigate (2026-10-12, design pass D17). On phone width it keeps text labels (no icon-only control).
- Lock screen: `role="region"` labelled by its heading; focus moves to the heading on mount; the buttons in visual order; no timer is shown and nothing auto-expires while the screen is open.
- Router pages announce "Taking you to …" in a polite live region (`a11y.shell.redirecting`) and render a visible link (works without script).
- The adult step: the checkbox has a visible label; Continue is a real disabled button until ticked, and its disabled state is announced.
- Disabled offline buttons keep their label and expose the "Needs the internet" line as their description.
- Every new button meets `touchTarget`; body text keeps the 18 floor on learner screens; Tab order equals visual order (asserted by the e2e, as `apps/web/e2e/landing-layout.spec.ts` does for the landing).
- `<html lang>` follows the console locale (existing `LocaleProvider`) and the learner locale; the offline page sets `lang` to the locale it picked.
- No sideways scroll at 320, 375 and 768 for `/signin`, `/parent`, `/teach/home`, the lock and the offline page. First-screen budget of section 3.8 at 375 x 667.

### 3.17 Privacy and child safety

- **No adult screen is reachable by a child**: grown-up pages need a Clerk session; on a device with child profiles they also need, in the same tab within 15 idle minutes, either a fresh PIN whose epoch a grown-up confirmed by signing in, or a secret-proving sign-in (section 3.9); OAuth one-tap alone never unlocks such a device; the PIN screen reached from a grown-up entry never creates or resets a PIN; every learner-app entry point sits behind the existing PIN gate; the lock renders no data and makes no API call; back/forward cache restores re-run the lock.
- **Creating a grown-up account** needs the adult step (affirmation) and a verified email (section 3.7; OD-13); the Welcome row and the site links open sign-in only. Money still needs F-BILL-002's step-up before any payment.
- **Response headers for grown-up paths** (generated from `GROWN_UP_PREFIXES` into `dist/_headers` by `merge-console.mjs`, three patterns per prefix, `/teach`, `/teach/*` and `/teach.*`, the last for the page's RSC payload `/teach.txt`, which R-1 counts as a grown-up path): `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex, nofollow` (grown-up pages of the app host never appear in search results; the third pattern and the robots header: 2026-10-12, A-3 review). Learner paths keep their rules.
- **Tokens**: the API refuses a token whose `azp` names a site not on the allow-list (`authorizedParties`, A-9; in production the list alone, with no local dev or `*.workers.dev` leniency); a token with no `azp` (not minted by a browser) follows Clerk's default and is accepted. The console session key is removed whenever the device goes back to learning (section 3.9).
- **Local-first**: no learner data leaves the device because of this spec. The marker holds a gate code and one timestamp; the shell store holds a persona code and one timestamp; the unlock holds timestamps and a source code; the join hand-off holds a join code for at most 30 minutes; all stay on the device.
- **No learner accounts** (OD-2); account linking stays with the consent flows of F-SPACE-001 / F-SPACE-002 (verifiable parental consent before linking).
- **No names in URLs** (R-2); `next` carries ids only.
- **Child's offline bundle** contains no console code (`consoleLeaks` build guard); the learner bundle never imports console code (an import scan test, section 5).
- **Anti-shame**: learner cards in a stable join order, no sorting by activity, minutes labelled "last 7 days" with no target and no comparison.
- **No ads, no new third parties**: Clerk was already used by the console; nothing else is added.
- **Native builds** show no grown-up entry and no purchase link (store rules, OD-6).
- `CLASS_TRANSFER` is untouched.

### 3.18 Telemetry (Worker first)

Names added to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:9`) and to the exact-list test in A-1, deployed with the API Worker **before** any app release that sends them (TELEMETRY-NAMES-2 rule 1). Rows go to `docs/roadmap/TELEMETRY-NAMES-2.md` as a new section in A-0. Sent by the learner app only (the console has no telemetry client, OD-9); **no `profileId`** on any of them, codes only.

| Name | Payload | Emitted by |
|---|---|---|
| `shell.persona_chosen` | `{ persona: 'learner' \| 'parent' \| 'teacher', from: 'welcome' \| 'welcome-continue' }` | A-7 |
| `shell.grown_up_handoff` | `{ via: 'profile' \| 'dashboard' \| 'plan' \| 'lock', target: 'router' \| 'billing' \| 'next' }` | A-6 (lock), A-7 (profile, dashboard, plan) |
| `shell.path_bounced` | `{ prefix: 'signin' \| 'start' \| 'teach' \| 'parent' \| 'account' }` | A-6 |

`paywall.console_opened` keeps firing where F-BILL-002 keeps it (flag off).

**Server guard (review 2026-10-11, A-1).** The Worker (`packages/backend/src/routes/telemetry.ts`) treats `shell.*` like `space.transfer.*`: it drops `profileId` and keeps only the keys and values in `SHELL_TELEMETRY_PAYLOADS` for that name, so a client bug cannot store a learner id next to a grown-up hand-off. **Gate before merging A-6**: confirm that the latest `hangul-route-api` deployment includes the A-1 merge commit, or that `POST /api/telemetry` with `{"name":"shell.path_bounced","payload":{"prefix":"teach"}}` returns 201 (the client drops any 4xx for good).

### 3.19 States and errors

| Surface | Loading | Empty | Error |
|---|---|---|---|
| `/signin` | widget loading line | — (sign-up only through `mode=create`) | Clerk unreachable: one line + Try again + Back to learning |
| `/signin?mode=create` | — | affirmation unticked: Continue disabled | as `/signin` |
| reverification on a locked device | Clerk dialog | — | cancelled: signed in, still locked, lock screen |
| installed iOS PWA | email code listed first | — | OAuth finished in Safari, not here: one line "Finish signing in here with an email code" + the email-code method |
| router (`/signin` signed in, `/teach`) | "Taking you to …" | no persona → `/start` | spaces fetch failed: one line + Try again |
| lock decision | an empty `surface.canvas`, no frame, no API call (as A-4a built it; design pass D12) | — | no IndexedDB API → open; a read that failed twice or took longer than 3 s → sign-in only (section 3.9) |
| family home | skeleton cards (no numbers) | family without learners: join panel; no family persona: "no family yet" | roster fetch failed for one family: that section shows Try again, others render |
| teacher home | as today | no teacher persona: "no class yet"; archived only: archived rows + New class | as today |
| offline page | — | — | it is the error state |
| learner entry buttons | — | — | offline: disabled + "Needs the internet" |

### 3.20 Behaviours (Given / When / Then)

1. Given a phone with no learner profile and no last persona, When the app opens, Then Welcome shows "Let's start" as the largest action and the row "Here to support a learner?" with Parent or caregiver and Teacher (web, flag on).
2. Given that Welcome, When the visitor taps Teacher, Then the tab goes to `/signin?persona=teacher`, the teacher intro shows, no sign-up link is shown, and `shell.persona_chosen { persona: 'teacher', from: 'welcome' }` is queued.
3. Given an account with one class space, When sign-in completes, Then the browser lands on `/teach/home` with no extra tap and the last persona becomes `teacher`.
4. Given an account with a family and a class, When it signs in with no hint and no last persona, Then it lands on `/parent`, and the frame shows the persona switch; choosing Teacher opens `/teach/home`.
5. Given an account with no space, When it signs in from the Parent button, Then `/start` opens with Parent or caregiver preselected; creating the family lands on `/parent`.
6. Given a family tablet with two child profiles, a PIN, and a parent signed in yesterday, When someone types `app.hangulroute.com/parent`, Then the lock screen shows and no API call is made.
7. Given that lock and a trusted PIN epoch, When Use the grown-up PIN is tapped and the correct PIN is entered, Then the browser returns to `/parent` and the home renders; `shell.grown_up_handoff { via: 'lock', target: 'next' }` is queued.
8. Given an open grown-up page on that tablet, When 15 minutes pass without interaction and the parent taps a link, Then the lock shows again.
9. Given a grown-up who taps Back to learning, When a child then presses the browser Back button into the grown-up page (restored from the back/forward cache or reloaded), Then the lock shows and no roster text is visible.
10. Given a parent who just entered the PIN to open the Plan screen (flag on, web), When they tap Open billing, Then the same tab opens `/account/billing` with no second PIN prompt and no lock screen, and after Stripe returns with `?checkout=success` the page shows the success state.
11. Given an installed learner PWA that has the A-2 worker, When the device is offline, Then the Profile row and the dashboard card are disabled with "Needs the internet", and a direct navigation to `/parent` shows the offline page with Back to learning.
12. Given F-SITE-002 S-10 is live, When `hangulroute.com/teach/space?id=sp_1` is opened, Then the browser lands on `app.hangulroute.com/teach/space?id=sp_1`.
13. Given F-SITE-002 S-10 is live, When `hangulroute.com/teach/billing?checkout=cancel` is opened, Then the browser lands on `app.hangulroute.com/account/billing?checkout=cancel`.
14. Given `/signin?next=https://evil.example`, `next=//evil.example` or `next=/` (not a grown-up path), When sign-in completes, Then the persona home is used.
15. Given `app.hangulroute.com/teach/does-not-exist`, When opened online with the A-6 bundle, Then the browser replaces it with `/teach` and `shell.path_bounced { prefix: 'teach' }` is queued.
16. Given a self-only device (one adult learner, no PIN), When its owner signs in on `/signin`, Then grown-up pages open without a lock.
17. Given a native iOS or Android build, When Welcome, Profile, the dashboard or the Plan screen render, Then no grown-up home entry and no web purchase link appear.
18. Given a console-only change merged to `main`, When the learner Worker redeploys, Then `sw.js` is byte-identical to the previous build (no update banner for learners).
19. Given a family device with child profiles and no PIN (marker `nopin`), When a child reaches the lock screen, Then only Sign in again and Back to learning are offered; Given the same device, When a grown-up entry opens the PIN screen for `GrownUpArea`, Then no PIN can be created there.
20. Given a child who resets the PIN with Forgot PIN, When the new PIN is used on the lock screen, Then the lock stays, offers only Sign in again, and shows "The grown-up PIN changed on this device".
21. Given a device with marker `pin` where the parent's Google account is signed in, When "Sign in again" completes with Google, Then Clerk reverification asks for an email code (or password, or passkey) before any grown-up page opens.
22. Given a parent who entered the PIN 10 minutes ago and handed the tablet over, When the dashboard card Open is tapped, Then the PIN screen asks for the PIN in verify mode before the grown-up area opens.
23. Given a device with two child profiles, When a parent opens Profile, Then the grown-up zone's first row is "Grown-up home"; after the PIN it opens the family home directly.
24. Given a teacher-only account, When it taps Parent or caregiver on Welcome and signs in, Then `/parent` shows "You don't have a family space yet." with Set up my family and Go to Classes.
25. Given a family with two learners whose activity changes, When `/parent` renders before and after, Then the card order is the same (join order) and the number is labelled "last 7 days".
26. Given `reportsEnabled()` and `notesEnabled()` are on, When `/parent` renders, Then each learner card offers See report and Send a note, and the nav shows Reports and Notes; with both off, neither appears.
27. Given an account on `/signin?mode=create`, When the affirmation is not ticked, Then the Clerk sign-up form does not render.
28. Given a family with no learner, When the parent taps Open the app on this device and the learner then opens Join, Then the join code is filled in and the F-SPACE-001 steps follow unchanged.

## 4. Out of scope

- The **content** of reports (daily, weekly, monthly, all-time; went well / needs work; class statistics) → F-REPORT-001. This spec owns only the entries on the homes and in the nav.
- The **feedback channel** from grown-ups to learners → F-FEEDBACK-001 (entries here).
- **Billing content** for every persona, receipts, step-up, Stripe return URLs, and the learner Plan screen → F-BILL-002. This spec provides `/account/billing`, the same-tab hand-off and the legacy redirect page on the app host.
- The **lesson browser** ("see the lessons exactly as the learner sees them") → F-BROWSE-001; this spec reserves `/browse`, registers the Lessons entry and clears the unlock in the browse tab.
- **LEARNING ROUTE** pages and the free / subscriber learning flow → the Learning Route amendment to F-ROUTE-001 and F-ENT-003 (entries here).
- **The marketing site content, IA and the redirects from hangulroute.com** → F-SITE-002 (contract in section 6.4).
- Mobile (native) Clerk sign-in → F-AUTH-004 (not written). Account page (email change, consent record, delete data, the adult affirmation shown) → F-AUTH-005.
- An `api.hangulroute.com` custom domain for the API (not needed: CORS and Clerk already work).

## 5. Tests

| File | Covers | PR |
|---|---|---|
| `packages/content-schema/src/__tests__/app-shell.test.ts` | `isGrownUpPath` boundaries (`/teach`, `/teach/`, `/teach?x`, `/teach.html`, `/teacher` false, `/parentx` false, `/billing` false, case-sensitive); `safeNextPath` (relative ok; the `URLSearchParams.get` round trip keeps `%3A`, `%26`, `%25`, `%23`; `//x`, `/\x`, `https:`, `javascript:`, encoded `%2F%2F`, `..`, control chars, >512, non-grown-up → null; fragment dropped); `legacyAppTarget`; `personaHint` (`persona`, `as`, unknown); `personasFor` every kind × role, archived, student ignored, unknown kind ignored, order; `SHELL_TELEMETRY_PAYLOADS` exact; `homeFor` matrix (none, held hint, unheld hint, last, single, both); marker union (`pin` needs `pinEpoch`); schemas lenient on bad JSON; `unlockActive` at 0, 14:59, 15:00, negative clock | A-1 |
| `packages/content-schema/src/__tests__/telemetry.test.ts` | exact list includes the three `shell.*` names | A-1 |
| `packages/content-schema/src/__tests__/lecture.test.ts` | origins include the app origin | A-1 |
| `apps/mobile/scripts/__tests__/pwa-postbuild-shell.test.mjs` | denylist RegExps from the prefixes; the emitted `sw.js` text contains the inlined prefix source in the NetworkOnly rule; `/present` and `/browse` not denied; `consoleLeaks` flags a grown-up path and `_next/`; `consolePages` flags an HTML page that loads `/_next/` code; the build fails on either and on a missing offline page; offline page has every shipped locale's strings and no external URL, and its locale pick (run against a stand-in document) sets `lang`, title and text | A-2 |
| `apps/mobile/e2e/web/offline.spec.ts` (extended) | with the new worker, an offline navigation to `/parent` shows the offline page; `/` still plays offline | A-2 |
| `apps/web/scripts/__tests__/console-split.test.mjs` | copies only grown-up paths + `_next` (including `.txt` payloads); never `index.html`/`404.html`/legal/locale/persona/design-preview | A-3 |
| `apps/mobile/scripts/__tests__/merge-console.test.mjs` | collision guard; refuses non-grown-up paths; `SKIP_CONSOLE=1` writes nothing; the appended `_headers` block has the three patterns per prefix (`/p`, `/p/*`, `/p.*`) and every header of section 3.17; the console build never gets the dev sign-in form (`NEXT_PUBLIC_CONSOLE_DEV_AUTH=false`) | A-3 |
| `apps/mobile/e2e/web/app-host.spec.ts` (new, merged build) | `/` is the learner app; `/teach/home`, `/parent`, `/signin`, `/account/billing` serve console HTML; precache manifest has no grown-up path; a missing `/_next/static` chunk URL is never answered as `text/html` with `immutable` (section 3.3); learner progress keys unchanged after visiting grown-up pages; `/teach/zzz` bounces to `/teach`; navigate home → space → back with JavaScript on (RSC payloads). A-3 requires `/teach`, `/teach/home` and `/parent` by name; A-4b adds `/signin` and `/start`, A-5c `/account/billing` to that list (a review checklist item of both rows) | A-3, A-4b, A-5c, A-6 |
| `apps/web/src/lib/console/__tests__/grown-up-lock.test.ts` | the full table of section 3.9, including `nopin`, epoch match and mismatch, missing trusted epoch, marker epoch `0` never stored as trusted, a `pin` unlock without `pinEpoch` read as absent (the "none or expired" row), `src` of the unlock, the `hr:profiles` fallback and unreadable storage | A-4a |
| `apps/web/src/lib/console/__tests__/device-marker.test.ts`, `unlock.test.ts`, `shell-store.test.ts` | reads and writes with throwing storage, missing IndexedDB, corrupt JSON; shell keys live in `hr-shell`, never under `hr:` | A-4a |
| `apps/web/src/components/console/__tests__/grown-up-lock.test.tsx` | locked renders no children and triggers no fetch; buttons by availability (PIN path hidden without a trusted epoch); `pageshow` persisted and `visibilitychange` hide then re-decide; lock render removes `hr:console:session` | A-4a |
| `apps/web/src/app/__tests__/signin-router.test.tsx` | signed-in router uses `next` then `homeFor`; persona intro by `persona` and `as`; sign-up link absent; `mode=create` renders `<SignUp>` only after the affirmation with `unsafeMetadata.adultAffirmedAt`; secret-factor sign-in writes the unlock and the trusted epoch; OAuth on a locked device triggers reverification and writes only after it; standalone lists email code first; `/teach` router honours `persona` / `as` and has no hint otherwise; `/teach/start` and `/teach/billing` redirects keep the query | A-4b, A-5c |
| `apps/web/src/lib/console/__tests__/shell-nav.test.ts` · `personas.test.ts` | the full registry id list; nav filtering by persona and each predicate; Reports target with one family and one learner vs otherwise; active persona from the space kind on `/teach/space*` and `/parent/space*`; switch writes last persona | A-5a |
| `apps/web/src/components/console/__tests__/adult-frame.test.tsx` | switch shown only with both personas, labelled Family / Teacher; Back to learning clears the unlock and the console session; label Open the learner app without profiles; `learnerHome()` on both hosts; phone layout puts Language and Sign out in the footer; no "Back to site"; no disabled items | A-5a |
| `apps/web/src/app/__tests__/parent-home.test.tsx` | cards in join order and unchanged when activity changes; "last 7 days" label; card actions by predicate; empty state with the Join label and the join hand-off; no-family state; cross-links; one family failing; no banned words; links use ids and the `/parent/space` prefix | A-5b |
| `apps/web/src/app/__tests__/teacher-home.test.tsx` (extended) | no Family group; class row Class report and Notes by predicate; no-class state; cross-links | A-5a, A-5b |
| `apps/web/src/lib/console/__tests__/space-pages.test.ts` | every `teach/space/**/page.tsx` has a `parent/space` twin and a `SPACE_PAGES` entry | A-5b |
| `apps/web/src/lib/console/__tests__/routing.test.ts` (extended) | every space builder with and without `kind`; legacy family URLs still render | A-5b |
| `apps/mobile/src/logic/shell/__tests__/boot-intent.test.ts` | `gate=grown-up` with valid / invalid `next`; `lang` untouched; unknown keys ignored | A-6 |
| `apps/mobile/src/logic/shell/__tests__/device-gate.test.ts` | marker for: no profiles, child profiles with PIN (`pin` + epoch from `pinSetAt`, `0` when absent), child profiles without PIN (`nopin`), self-only with and without PIN | A-6 |
| `apps/mobile/src/logic/shell/__tests__/handoff-rules.test.ts` | `openGrownUpArea` decision: `none` direct, `nopin` writes nothing, `pin` with a PIN verified 1:59 ago writes, 2:00 ago or session-only asks for the PIN | A-6 |
| `apps/mobile/src/logic/profiles/__tests__/pin-flow.test.ts` (extended) | destination `GrownUpArea` is always `verify`, never `setup-*`, no Forgot PIN; no hash → the no-PIN line | A-6 |
| `apps/mobile/src/store/__tests__/account-store.test.ts` (extended) | `setPin` writes `account:pinSetAt` on first set, change and reset | A-6 |
| `apps/mobile/src/platform/__tests__/grown-up-handoff.web.test.ts` · `app-root.web.test.ts` | unlock written with `src: 'pin'` and the epoch before navigation; `lang` appended; every root's boot clears the unlock and `hr:console:session` (app root with a gate intent excepted); `/present` roots never call learner hydration (`/browse`: from F-BROWSE-001 BR-6, section 3.9); a back/forward-cache restore also forgets the fresh PIN; root chooser order (`/present`, `/browse`, grown-up bounce, app) | A-6 |
| `apps/mobile/src/logic/shell/__tests__/no-console-imports.test.ts` | source scan: nothing under `apps/mobile/src` imports from `apps/web` or `@clerk/*` | A-6 |
| `apps/mobile/src/screens/onboarding/__tests__/welcome-personas.test.tsx` · `screens/profile/__tests__/grown-up-row.test.tsx` · `screens/parent/__tests__/grown-up-home-card.test.tsx` · `screens/paywall/__tests__/PaywallScreen.test.tsx` (extended) · `screens/sync/__tests__/join-prefill.test.tsx` · `logic/__tests__/links.test.ts` (extended) | row hidden on native and with the flag off; continue-as from the shell store; offline disabled state; Profile row first in the zone; telemetry payloads; Plan screen Open billing disabled offline with the flag on (A-7; its same-tab `openGrownUpArea` hand-off is F-BILL-002 B-9b's test); Join prefill read once and expired after 30 minutes; privacy base order | A-7 |
| `packages/backend/src/__tests__/auth.test.ts` (extended) | `authorizedParties` from `ALLOWED_ORIGINS` and from the defaults; a token for an unlisted origin is refused | A-9 |
| `apps/mobile/e2e/web/grown-up-shell.spec.ts` (new) | behaviours 1, 2, 6-11, 15, 18-20, 22-26 of section 3.20 on a test build with the dev auth bridge (`NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`, no Clerk in CI) and the API answered by Playwright route mocks; Back to learning then `history.back()` shows the lock region and no roster text; `/parent` first-screen budget at 375 x 667 | A-10 |

Coverage: `packages/content-schema` 100 %; `apps/web` verification logic (`lib/console/*`) at least 90 %; `apps/mobile` business logic (`logic/shell/*`) at least 90 %, platform wrappers at least 70 % (CLAUDE.md section 6); `packages/backend` at least 90 %.

## 6. Rollout and PR breakdown

Sizes: S < 300 changed lines, M < 700. Every UI PR links its design mock (`design/screens/…`) and attaches screenshots at 375 and 1280.

### 6.1 PR table

| PR | Content | Size | Depends on |
|---|---|---|---|
| A-0 | `docs`: amendments: `docs/blueprints/10-app-map.md` (sections 3.2, 3.3, 4.3, a new decision row "app host serves the console, B2"), F-CONSOLE-001 sections 3.6 / 3.7 (dated note: host and paths per F-APP-001), F-AUTH-002 section 3.6 (sign-in at `/signin` on the app host, sign-up behind the adult step), F-ENT-001 sections 3.5 / 3.6 (billing at `/account/billing` on the app host), F-TCH-004 D12 note (same-origin console), F-LEARN-001 note (PIN screen never creates a PIN for `GrownUpArea`; `account:pinSetAt`), `docs/launch/owner-runbook.md` (steps S-0 to S-3 of section 6.2, variable table), `docs/launch/web-app-launch.md`, `docs/roadmap/TELEMETRY-NAMES-2.md` new section | S | — |
| A-1 | `feat(content-schema)`: `schemas/app-shell.ts` + tests; `LECTURE_CONSOLE_ORIGINS` append; three telemetry names + exact-list test; Worker keeps only the `shell.*` codes (section 3.18); console `SESSION_KEY` reads `CONSOLE_SESSION_KEY` | S | — |
| A-2 | `feat(mobile)`: `pwa-postbuild.mjs` denylist, grown-up NetworkOnly rule with inlined prefix source and offline fallback, generated `grown-ups-offline.html` (strings via `ts-loader`), `consoleLeaks` guard, `/_next/static` header rule; tests; offline e2e case | S | A-1 |
| A-3 | `feat(web,mobile)`: `console-split.mjs` (console role), `build:console`, `merge-console.mjs` (with the grown-up `_headers` block), `build:web` runs it (`SKIP_CONSOLE`), API base pass-through, `web-app.yml` path filter, `preview-deploy.yml` checks, `app-host.spec.ts` first cases. Confirms in its description that `hangul-route-web` never serves the app host (F-SITE-002 S-10 contract) | M | A-2 |
| A-4a | `feat(web)`: pure `lib/console/{grown-up-lock,device-marker,unlock,shell-store}.ts`, `GrownUpLock` component (decision, bfcache re-check, console-session removal), `idb-keyval` dependency; strings `console.lock.*`; tests | M | A-1 |
| A-4b | `feat(web)`: `/signin` page (persona intro, `as` alias, hidden sign-up, `mode=create` adult step, secret-factor check and reverification, standalone email-first) and router, `/teach` router, `/start` move and `/teach/start` redirect, shared grown-up layout, Clerk redirect URLs, `ROUTES.signIn/start`, `useConsole()` to `/signin?next=`, `?lang=` read; strings `console.signIn.*` | M | A-4a, mock |
| A-5a | `feat(web)`: `AdultFrame` (persona switch, `shell-nav.ts` full registry with the four predicates, active persona from space kind, way back, phone layout, footer site links) replacing `ConsoleShell`, `lib/console/personas.ts`, last-persona write, teacher home filter, class row entries, no-class state and cross-links; strings `console.shell.*`, `console.home.*` | M | A-4b, mock |
| A-5b | `feat(web)`: real `/parent` home (card actions, stable order, empty state with join hand-off, no-family state, cross-links), `space-pages.ts` and every `/parent/space/**` twin, `spacePath` and `kind` on every space builder, removal of the demo (`parent/[childId]`, `components/parent/*`, `data/mock-family.ts`, `e2e/parent-demo.spec.ts`, related unit tests); strings `console.parentHome.*` | M | A-5a, mock |
| A-5c | `feat(web)`: `/account/billing` alias, `/teach/billing` redirect page, frame Billing item | S | A-5a |
| A-6 | `feat(mobile)`: root chooser (`platform/app-root*.ts`, bounce), boot intent, `GrownUpArea` destination in `PinEntry` (verify only, no-PIN line), `openGrownUpArea` with the fresh-PIN rule, `ui-store.lastPinVerifiedAt`, unlock and console-session clearing on every root's boot, device gate marker writer (`pin` / `nopin` / `none`, epoch), `account:pinSetAt`, `platform/shell-store*.ts`, `flags.grownUpHomeEnabled`, telemetry `shell.grown_up_handoff` (lock) and `shell.path_bounced`, import scan test | M | A-1 (Worker deployed, gate in section 3.18), A-2 |
| A-7 | `feat(mobile)`: Welcome persona row and continue-as, Profile Grown-up home row, ParentDashboard card, ~~Plan screen same-tab billing hand-off~~ (moved to F-BILL-002 B-9b by its amendment A2), offline disabled states (Welcome, Profile, dashboard and the Plan screen's Open billing), Join prefill, `privacyUrl` base order, `EXPO_PUBLIC_SITE_URL`; strings `learner.welcome.grownUps.*`, `learner.profile.grownUpHome.*`, `caregiver.grownUpHome.*`; `shell.persona_chosen`, `shell.grown_up_handoff` (profile, dashboard; plan is sent by B-9b) | M | A-6, mock |
| A-9 | `feat(backend)`: `authorizedParties` for `verifyToken` from the CORS allow-list; tests | S | — |
| A-10 | `chore`: flip default (`grownUpHomeEnabled` on); `grown-up-shell.spec.ts`; runbook "done" lines | S | all above; M3 at least 14 days old (OD-10) |

(A-8, the site redirect stubs of the first draft, is withdrawn: the move from hangulroute.com is F-SITE-002 S-9 / S-10. Stripe return URLs, the first draft's A-9, are F-BILL-002 B-5 / B-10.)

A-0, A-1, A-4a and A-9 can run in parallel. A-4b, A-5a, A-5b and A-7 wait for their mocks (CLAUDE.md section 5); the mocks are `design/screens/app-shell/` (design pass, 2026-10-12).

### 6.2 Owner steps (dashboard only; each has a default timing)

| Step | What | When (default) |
|---|---|---|
| S-1 | `hangul-route-app` → Settings → Build → Variables: add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (the same `pk_live_…` as `hangul-route-web`); optionally `NEXT_PUBLIC_LECTURE_MODE`, `NEXT_PUBLIC_SCHOOL_CONSENT_MODE` with the site's values, and the sibling console flags as each sibling turns them on (never `NEXT_PUBLIC_CONSOLE_DEV_AUTH`; the console build forces it off) → Retry deployment | after A-4b merges (its shared grown-up layout puts `GrownUpLock` on every console page, and `/signin`, the step's check, arrives with it; 2026-10-12, A-3 review) |
| S-2 | Clerk dashboard (Production): confirm sign-in works on `https://app.hangulroute.com/signin` (subdomains of the root domain are served by the same instance); if Clerk lists allowed redirect origins, add `https://app.hangulroute.com`; confirm "verify email at sign-up" is on. Then M2: sign in on the app host in a desktop browser, and from the **installed PWA** on an iPad or iPhone and on Android Chrome, each with Google and with an email code; open a class, `/parent` and `/account/billing` | during M2, after A-4b and A-5c are live on the app host and at least 7 days after A-6 reached production (section 3.9, older learner tabs) |
| S-0 | Check, on production, that `https://app.hangulroute.com/sw.js` contains the grown-up denylist and that A-2 has been in production for at least 7 days | right before S-3 |
| S-3 | `hangul-route-app` build variable `EXPO_PUBLIC_GROWN_UP_HOME=true`, and `EXPO_PUBLIC_SITE_URL=https://hangulroute.com` (then delete `EXPO_PUBLIC_CONSOLE_URL` once F-BILL-002 no longer reads it) → Retry | M3, after S-0 and M2 |
| — | F-SITE-002 S-10 (site serves `out-site/` with redirects) and F-BILL-002 B-10 (`BILLING_URL=https://app.hangulroute.com/account/billing` on `hangul-route-api`) | M3, same window as S-3, each after S-0 |

### 6.3 Shared files (expect mechanical rebases)

`packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its exact-list test (A-1; every spec) · `apps/mobile/index.ts` and `platform/app-root*.ts` (A-6; F-TCH-004 PR 6 and F-BROWSE-001 BR-3 add their roots: one root chooser, whichever lands later adds its branch) · `apps/mobile/scripts/pwa-postbuild.mjs` (A-2; F-TCH-004 PR 3, F-AUDIO-004 A-6, F-BILL-002 B-9) · `apps/mobile/src/navigation/types.ts` (A-6; F-ROUTE-001 R-3 #317 and the Learning Route amendment add `MyRoute` / `Route`) · `apps/mobile/src/screens/profile/ProfileScreen.tsx` (A-7; F-FEEDBACK-001 adds a row) · `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx` (A-7; F-FEEDBACK-001, F-BROWSE-001 BR-12, F-REPORT-001 add entries) · `apps/web/src/lib/console/routing.ts`, `config.ts`, `components/console/ui.tsx`, `app/(console)/teach/space/page.tsx`, `teach/home/page.tsx` (A-4, A-5; F-ROUTE-001 R-9a #313, F-TCH-004 PR 10, F-REPORT-001, F-FEEDBACK-001, F-BROWSE-001, F-BILL-002, LR-8) · `packages/i18n/src/messages/en/{console,learner,caregiver,a11y}.ts` (append keys only) · `.github/workflows/web-app.yml`.

### 6.4 Contract for the sibling specs of wave 2026-10-11

Each row states what the sibling must use or change so the specs agree. The sibling amends its own text in its docs PR; until then this table wins for paths and entry points.

| Sibling (branch) | Contract |
|---|---|
| **F-SITE-002** marketing site (`docs/marketing-site-layered`) | `GROWN_UP_PATHS = { signIn: '/signin', billing: '/account/billing', parentHome: '/parent', teacherHome: '/teach/home' }`; `signIn(persona)` = `APP_ORIGIN + '/signin?persona=parent\|teacher'` (`/signin` also accepts `?as=`), optionally `&lang=<site locale>` for a non-English page. F-SITE-002 owns **all** moves from hangulroute.com: `out-site/` holds no file for which `isGrownUpPath` is true (its guard checks every `GROWN_UP_PREFIXES` entry; a test compares `site-routes.json` to that list), and `_redirects` gains `/signin`, `/start`, `/account`, `/account/*` → same path on the app host next to its `/teach`, `/teach/*`, `/parent`, `/parent/*` rows. `/design-preview/*` is not served on the app host (R-4), so it must not redirect there. S-10 also waits for the 7-day old-worker rule (S-0). This spec writes no stub page on the site. |
| **F-BILL-002** billing (`docs/billing-in-app-all-personas`) | `BILLING_PATH = '/account/billing'`, `BILLING_RECEIPTS_PATH = '/account/billing/receipts'` (its OD-1 allows exactly this change); the pages live under `app/(console)/account/billing/`; Stripe returns to `https://app.hangulroute.com/account/billing` (`billingReturnUrl`, `BILLING_URL`). Its B-9 does **not** add `/billing` to the service-worker denylist (`/account` is already denied). Its own forwarder (`billingForward`, `billing/moved-notice`) is not needed: the app-host `/teach/billing` redirect page is this spec's A-5c and the cross-host move is F-SITE-002's. The Plan screen's **Open billing** opens billing in the **same tab** through `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })` when `flags.grownUpHomeEnabled` is on (web); its `billingUrl()` new-tab link applies only with the flag off. Empty state links: Set up my family → `/start?persona=parent`, Set up a class → `/start?persona=teacher`. Its step-up (reverification) is the same Clerk mechanism this spec uses on locked devices. |
| **F-REPORT-001** reports (`docs/progress-reports`) | Pages at `/teach/space/learner` and `/teach/space/report` get `/parent/space/…` twins through `SPACE_PAGES`; `ROUTES.learnerReport(spaceId, learnerId, period?, kind?)` and `ROUTES.classReport(spaceId, period?, kind?)`. Entries: this spec owns the family-home card **See report**, the nav item **Reports** and the teacher-home **Class report** row link, all behind `reportsEnabled()` (`NEXT_PUBLIC_REPORTS_ENABLED`). The roster-card "See report" stays F-REPORT-001's. The "console home family row Reports" of RP-7a is dropped (the Family group leaves the teacher home). |
| **F-FEEDBACK-001** notes (`docs/adult-feedback-channel`) | `/teach/space/notes` gets a `/parent/space/notes` twin; `ROUTES.spaceNotes(spaceId, kind?)` (a learner preselect parameter, ids only, is F-FEEDBACK-001's choice). Entries: this spec owns the family-home card **Send a note**, the nav item **Notes** and the teacher-home **Notes** row link, behind `notesEnabled()` (`NEXT_PUBLIC_NOTES_ENABLED`). Learner-side surfaces stay in the learner app; a new Profile row sits below this spec's Grown-up home row. |
| **F-BROWSE-001** lesson browser (`docs/adult-content-browser`) | `/browse` is a learner-bundle root (BD1); the denylist never lists it. Access is its server-backed pass (§4.3). Entry label **Lessons**, registered here in `ADULT_NAV` and on both homes behind `browseEntryEnabled()` (`NEXT_PUBLIC_BROWSE_ENABLED`, which BR-10 reads too); visibility: shown to every signed-in grown-up, `full` for a paying account, `sampler` otherwise, never a price or "Premium". Its [Sign in] on the Access screen goes to `APP_ORIGIN + '/signin'`. The browse root clears `hr:grownup:unlock` and `hr:console:session` in its own tab on boot (section 3.9) and hydrates no learner store. Its in-app gate hand-off sits behind the same PIN gate. |
| **Learning Route** amendment (`docs/learning-route`) | The learner shell gets the Route tab (LR-4); no grown-up entry in any learner tab. `/teach/space/route` gets a `/parent/space/route` twin; `ROUTES.learnerRoute(spaceId, learnerId, kind?)`. Entry: this spec owns the family-home card **Learning Route**, behind `learningRouteEnabled()` (`NEXT_PUBLIC_LEARNING_ROUTE_ENABLED`, which LR-8 reads); the roster-card link stays LR-8's. "See plans" on the adult page goes to `APP_ROUTES.billing`. |
| **F-ENT-003** free plan (`docs/free-day2-unlocked-curriculum`) | Learner home and tabs; no change to this shell. Any "see plans" link on a grown-up page goes to `APP_ROUTES.billing`. |

## 7. Dependencies

- **Upstream (shipped)**: F-CONSOLE-001, F-AUTH-002, F-ENT-001, F-SPACE-001, F-PROF-001, F-LEARN-001, F-PWA-001, F-I18N-001 (`?lang=`), F-INFRA-001.
- **Coordinated**: F-TCH-004 PR 6 (presenter root in `index.ts`), F-ROUTE-001 R-3 (#317) and R-9a (#313) (shared navigation and routing files).
- **Downstream**: every sibling spec in section 6.4; F-AUTH-004 (native sign-in) and F-AUTH-005 (account page) later reuse `/signin` and `/account/*`.
- **Gating the site and billing switch-overs (M3)**: F-SITE-002 S-10 and F-BILL-002 B-10 wait for A-4b and A-5c on the app host, M2 and S-0.

## 8. Owner decisions (each with a default; each gates only the PRs named)

| # | Question | Default (applies until answered) | Gates |
|---|---|---|---|
| OD-1 | Hosting architecture for grown-up pages on app.hangulroute.com | **B2**: console built in a console role and merged into the learner Worker's `dist` under reserved prefixes (section 3.1) | A-3 |
| OD-2 | Do learners get a sign-in (email or password)? | **No.** Learners choose a profile on the device, restore with a Rescue Code or backup file, or join with a code; adult learners may later link to a grown-up account under F-AUTH-004 | A-7 copy |
| OD-3 | Grown-up lock on shared devices | **On** when the device has learner profiles behind a gate; 15 idle minutes; unlock by a fresh device PIN (entered in the last 2 minutes, epoch confirmed by a grown-up sign-in) or a secret-proving sign-in (OAuth needs reverification on such a device) | A-4a, A-4b, A-6 |
| OD-4 | The `/parent` demo on mock data | **Removed** from the product; the marketing spec may show a static picture instead | A-5b |
| OD-5 | Who moves old hangulroute.com grown-up URLs? | **F-SITE-002** (`out-site/` + `_redirects`, S-9 / S-10); this spec writes no stub page | — (F-SITE-002 S-10) |
| OD-6 | Grown-up entry in native iOS / Android builds | **Hidden** until F-AUTH-004; the local PIN dashboard stays | A-7 |
| OD-7 | Path names | `/signin`, `/start`, `/parent`, `/teach`, `/account` (billing at `/account/billing`; keeps every existing `/teach/*` URL and test) | A-4b, A-5 |
| OD-8 | Where the persona choice sits for a new visitor | A **secondary row on Welcome** under "Let's start"; no separate chooser screen, so a learner starts in one tap; on devices with profiles, the **Grown-up home** row on Profile | A-7 |
| OD-9 | Telemetry from grown-up pages | **None** (the console has no telemetry client); learner-side `shell.*` events only | — |
| OD-10 | Who verifies before the switch-over | The owner does M2 (browser and installed PWA, iOS and Android, Google and email code); A-10 waits at least 14 days after M3 | A-10 |
| OD-11 | Persona for an account with both and no history | **Family** first; the switch is always visible | A-4b |
| OD-12 | Clerk session length | **Clerk's default** (unchanged); the lock covers shared devices | — |
| OD-13 | How strong is the adult step for creating a grown-up account? | **Affirmation checkbox + verified email** (Clerk), sign-up never shown from the Welcome row or the sign-in widget; stronger options (a knowledge question, card check) are not used | A-4b |
| OD-14 | Name of the parent persona in labels | **Family** (fits a parent, a caregiver and an adult learning alone); Welcome button stays "Parent or caregiver" | A-5a |
| OD-15 | iOS installed-PWA sign-in method | **Email code listed first** in standalone mode until M2 shows Google works there | A-4b |

## 9. Unverified assumptions and risks

- **Clerk Production on a subdomain** is expected to work without satellite setup because the instance serves the root domain; verified only in M2 (S-2). If it fails, the fallback is to add `app.hangulroute.com` as an allowed origin in Clerk, no code change.
- **Clerk reverification for OAuth-only accounts** is expected to offer an email code to the account's address (Clerk's first-factor reverification); verified in M2. If it does not, the fallback is Google re-authentication with `oidcPrompt: 'login'` on locked devices.
- **iOS standalone PWA**: an OAuth redirect may complete in Safari, outside the PWA window (separate cookies and storage). Covered by OD-15 and the M2 check; the email-code path stays inside the window.
- **Next RSC payload files** (`.txt`) are copied with the pages; client navigation between console pages relies on them. Covered by `app-host.spec.ts`.
- **Old service workers** answer grown-up URLs with the learner shell until they update (section 3.4). The 7-day gap before M3, S-0 and the update banner bound the window; not measured. A device that never opens the learner app does not have the worker at all.
- **Back/forward cache**: `no-store` plus the `pageshow` re-check cover current Chrome, Safari and Firefox; a browser that restores a page without firing `pageshow` would show stale content until the next interaction (none known).
- **Duplicate tab**: the browser's "Duplicate tab" on a grown-up page copies `sessionStorage`, so the copy is unlocked for the rest of the 15 idle minutes. Accepted (it needs an unlocked grown-up page open in the first place); the idle timer still applies.
- **Adult step** is an affirmation, not proof of age; combined with email verification and F-BILL-002's step-up before money moves (OD-13).
- **Marker gap for learner apps older than A-6**: covered by the `hr:profiles` presence fallback (sign-in only). A browser where IndexedDB was cleared has no profiles and no lock, which is correct.
- **Clerk session carried from hangulroute.com**: a grown-up already signed in on the site may arrive signed in; on a locked device the first visit still asks for a secret-proving sign-in (no trusted epoch yet).
- **Build time**: the learner Worker build adds a Next build (about 1-2 minutes on Workers Builds; the 20-minute limit is far). The `web-app.yml` job grows by the same amount.
- **Two copies of `_next`** (site and app hosts) are independent deploys of the same commit; a console page and its chunks always come from the same build, so there is no skew between them.
- **Noticed, not changed here**: `learner.welcome.trust` says "Built with kids, parents, and grandparents in mind" on a shared surface; the marketing and copy owners should review it against the CLAUDE.md audience rule.

---

## Appendix A — draft English strings (final copy is the dictionary's)

- Welcome row: "Here to support a learner?" · "Parent or caregiver" · "Teacher" · "Continue as family" · "Continue as teacher" · "Someone else" · "Needs the internet"
- Profile row: "Grown-up home" · "Your family, classes and billing" · on a self-only device "Account home"
- Dashboard card: "Grown-up home" · "Your family, classes and billing." · "Open"
- PIN screen, no PIN stored: "This device has no grown-up PIN. Sign in on the grown-up page instead." · "Continue"
- Sign-in: family intro "Sign in to see your family's learning." · teacher intro "Sign in to see your classes." · neutral "Sign in to your grown-up account." · "Learners don't need an account. They start learning right away, or join a class with a code." · "I'm here to learn" · "New here? Create a grown-up account" · router "Taking you to your home…" (`a11y.shell.redirecting`) · "Go now" · "Sign-in can't load right now." · "Finish signing in here with an email code"
- Adult step: "Grown-up accounts are for parents, guardians and teachers." · "I am a parent, guardian or teacher" · "Continue" · "Back to sign in"
- Reverification: "Confirm it's you" · "This device has learner profiles. Confirm it's you to open grown-up pages." (names no factor: Clerk may ask for an email code, a password or a passkey)
- Frame: switch label "Switch between Family and Teacher" (`a11y.shell.personaSwitch`) · "Back to learning" · "Open the learner app" · "About Hangul Route" · "Family" · "Teacher" · "Home" · "Reports" · "Notes" · "Classes" · "Lessons" · "Billing"
- Lock: "Grown-ups only" · "Enter this device's grown-up PIN, or sign in again." · "Use the grown-up PIN" · "Sign in again" · "Back to learning" · "The grown-up PIN changed on this device. Sign in again to use it." · "Sign in once on this device to use the grown-up PIN here." · "Set a grown-up PIN in the app, or sign in again." · "To use the grown-up PIN here, set it again in the app, then sign in once." · "Sign in again to open grown-up pages on this device."
- Family home: "Family home" (`console.parentHome.title`, visually hidden heading) · "Minutes, last 7 days: {n}" · "Open" · "See report" · "Send a note" · "Learning Route" · "Lessons" · "Plan the week" · "Plan the term" · "Family settings" · "Add a learner" · "No learner has joined yet." · "On the learner's own device, go to {profile}, then {section}, then "{join}", and enter this family code." (`{profile}` "Profile", `{section}` "Classes & family", `{join}` "Join a class", the learner app's own keys) · "Open the app on this device" · "You don't have a family space yet." · "Set up my family" · "Go to Classes" · "Also teach a class? Set up a class" · "Your classes are under Teacher"
- Teacher home: "+ New class" · "Class report" · "Notes" · "Lessons" · "You don't have a class yet." · "Set up a class" · "Go to Family" · "Learning at home too? Set up a family space" · "Your family is under Family"
- Offline: "You're offline" · "Grown-up pages need the internet. Learning still works offline." · "Back to learning" · "Try again"

## Review log

- 2026-10-11: written from the five current-system maps of the 2026-10-11 owner request (marketing site, domains and deploy, learner app, console, entitlements and reports); options A to C measured; B2 chosen.
- 2026-10-11, revision 2, after two reviews (product/UX and cross-spec; security and migration). Applied:
  - **Billing path** (blocker): kept `/account/billing`; F-BILL-002 aligns `BILLING_PATH`, drops its `/billing` denylist entry and its forwarder; every learner-side billing entry, the Plan screen included, uses the same-tab hand-off (`via: 'plan'`, renamed from `paywall`); behaviour 10.
  - **PIN weaker than sign-in** (blocker): markers `pin` / `nopin` / `none`; `GrownUpArea` never creates or resets a PIN; `pinEpoch` from `account:pinSetAt` with a trusted epoch set at sign-in; behaviours 19, 20.
  - **Site contract**: sign-in at `/signin?persona=` (with `as` alias); `/teach` router honours a hint and has none otherwise; the move from hangulroute.com belongs to F-SITE-002 only (A-8 and the `moved` wireframe withdrawn, OD-5 rewritten, rollback rewritten). This also closes the review finding that `/signin`, `/start`, `/account/billing` and the RSC payloads stayed live on the site behind stubs: `out-site/` holds no grown-up file.
  - **Family pages under `/teach/space`**: active persona from the space kind; `SPACE_PAGES` twins for every space page with a test; `kind` as the last optional parameter of every space builder; sibling routes added to section 3.2.
  - **Homes lead to the jobs**: this spec registers every nav item and the card and row entries behind the sibling flags; dashboard card line names only what exists.
  - **Second persona**: "no family yet" / "no class yet" states, unheld hints route there, cross-links to `/start?persona=`.
  - **Grown-ups on devices with profiles**: Profile "Grown-up home" first row straight to the hand-off.
  - **bfcache and duplicate tabs**: `pageshow` / `visibilitychange` re-check, `no-store`, every learner root clears the unlock in its tab; duplicate-tab limit in section 9.
  - **OAuth one-tap on shared devices**: secret-proving sign-in rule with Clerk reverification; behaviour 21.
  - **Child sign-up from Welcome**: sign-in only from the widget; account creation behind the adult step (OD-13); behaviour 27.
  - **Old service workers**: the 7-day rule moved to M3 (S-3, F-SITE-002 S-10, F-BILL-002 B-10) with the production check S-0.
  - **`/browse` access**: aligned with F-BROWSE-001's server-backed pass and Access screen; roots that do not hydrate learner stores.
  - **iOS installed PWA sign-in**: M2 check on iOS and Android, email code first in standalone mode (OD-15).
  - Minor: console session cleared with the unlock; fresh-PIN rule instead of the 15-minute session reuse (`GROWN_UP_FRESH_PIN_MS`); security headers and `authorizedParties` (A-9 repurposed); `learnerHome()` on both hosts; stable join order and "last 7 days"; shell keys moved to their own `hr-shell` store; A-4 split into A-4a / A-4b; A-4b and A-5c gate M3; inlined prefix source in the Workbox rule; "Family" label (OD-14); phone frame in one header row with Language and Sign out in the footer, "Open the learner app" label, first-screen budget; join code hand-off with the Join label instead of typed steps; learner tabs corrected (Today, Journey, Library, Route); "start learning right away, or join a class with a code"; one entry label "Lessons" with its visibility rule; offline-disabled entry buttons.
  - Not applied as proposed, with reasons:
    - "When the family's only learner is the account holder, title the home 'Your learning'": the console cannot know it (`learnerType` lives only on the device, F-LEARN-001), so the label change to "Family" carries the any-age fix instead.
    - "Optional 'Grown-ups' link on the profile chooser": the app has no separate profile chooser screen; the Profile row is the place every family device passes through.
    - "Only the `app` root clears the unlock": every learner root clears it in its own tab instead, because `window.open` copies `sessionStorage` into the new tab; clearing the copy cannot affect the opener and closes the duplicated-unlock path.
    - "A `hr:browse:pass` in `sessionStorage` written by a console page under a grown-up prefix": F-BROWSE-001 already defines a server-backed pass handed over by `postMessage` with an Access screen when absent; one mechanism is kept, and this spec adopts it.
    - "Always ask for the PIN on `dashboard` / `paywall` entries": replaced by the 2-minute fresh-PIN rule, which meets both reviews (no second prompt right after a PIN; a prompt after a hand-over).
    - "Show 'Reports, messages and billing' on the dashboard card once those features exist": the learner bundle cannot read the console flags, so the card always says "Your family, classes and billing", which is true at every stage.
- 2026-10-11, A-9 review (PR #379), amended: sections 3.14 and 3.17 now say that a token with no `azp` follows Clerk's default (accepted after signature and expiry checks), and that production (`ENVIRONMENT` unset or `production`) uses the allow-list alone for tokens, without the local dev and `*.workers.dev` leniency CORS keeps when `ALLOWED_ORIGINS` is unset (the live Worker runs with it unset). `ALLOWED_ORIGINS` is documented as the Clerk token allow-list too (`apps/api/wrangler.toml`, owner runbook Step 6, F-CONSOLE-001 section 3.1).
- 2026-10-12, A-2 review (PR #386). Applied: the M0 row names what A-2 ships (the grown-up `no-store` and security headers were always A-3's, sections 3.3 and 3.17); `consolePages` joins `consoleLeaks` (section 3.4); the `/_next/static` rule stays in A-2, inert, and A-3 keeps a `/_next/` miss off the single-page fallback or removes the rule (section 3.3, `app-host.spec.ts`).
- 2026-10-12, A-4a review (PR #387). Applied: lock lines chosen by cause (section 3.9: a PIN unlock with no trusted epoch shows "sign in once", epoch `0` shows the new PIN-renew line, an absent marker with profiles shows the new plain sign-in line; Appendix A, section 3.15); a failed or slow device read locks to sign-in only, and only a missing IndexedDB API opens (sections 3.9, 3.19); interaction refresh and re-check inside `GrownUpLock` (section 3.9); cover instead of collapse, cover on `hidden`, no cover on a device that cannot lock, pathname as the decision key with a background re-check on a query change (section 3.9); `learnerHome()` is `/` except on the site origins (section 3.8); A-6 fingerprints the PIN hash so any PIN change moves the epoch (section 3.9); a revert of A-6 deletes the marker (section 3.13); `.cta` key names and no `a11y.shell.lockRegion` (section 3.15).
- 2026-10-12, A-3 review (PR #405). Applied: `build:console` ends with `prune-hidden-locales.mjs out` (section 3.3); A-3 removed the `/_next/static` rule and `merge-console.mjs` refuses one that comes back (section 3.3); three header patterns per prefix (`/p.*` for RSC payloads) and `X-Robots-Tag: noindex, nofollow` on every grown-up path (section 3.17, section 5); the app-host console build forces `NEXT_PUBLIC_CONSOLE_DEV_AUTH=false`, so the dev sign-in form never reaches the learner origin (section 5); `app-host.spec.ts` names `/signin`, `/start` (A-4b) and `/account/billing` (A-5c) as later required pages (section 5); owner step S-1 waits for A-4b, so the Clerk key never opens console pages on the app host before `GrownUpLock` wraps them (section 6.2). Not changed here, recorded for the owner: the `web-app.yml` path filter and `preview-deploy.yml` checks of row A-3 need a token with the `workflow` scope (exact diff in PR #405); until the owner pushes them, a PR that changes only `apps/web/` skips "Build PWA · offline e2e", so the merge loop runs `pnpm --filter @hangul-route/mobile build:web` and the `app-host` e2e on such a PR's head before merging it. Open cross-spec question before M3: this spec (A-8 withdrawn) and F-SITE-002 (S-9 dropped) each name the other as owner of the forwarding of old grown-up URLs on hangulroute.com; one of them must take it in a docs amendment before M3. The "Back to site" links (`href="/"`) lead to the learner app on the app host; A-5a replaces them (section 3.8).
- 2026-10-12, A-6 (learner plumbing, after its review). Recorded as built: persona entries never bounce to themselves and the bounce keeps `persona`, `as` and `lang` (section 3.4); the marker writer's load, role and strict-read rules for `none`, a failed fingerprint read moves the epoch, and only a verified PIN is "fresh" (section 3.9); the `app` root clears with a gate intent too, a back/forward-cache restore clears again, and `/browse` clears only while it still mounts the learner app (section 3.9; F-BROWSE-001 section 12); the hand-off drops a stale `lang` for the default locale, and Continue on the no-PIN screen carries `?lang=`; `caregiver.grownUpHome.continue.cta` (section 3.15).
- 2026-10-12, A-6 review (PR #404). Applied: exact reads behind `none` (stored list and stored PIN hash, damaged data refuses), `pinHashReadFailed` stops the marker and the epoch, and a damaged `account:pinHashSeen` moves the epoch (section 3.9); a back/forward-cache restore forgets the fresh PIN and the parent gate session (section 3.9); the legacy app-host pages bounce to their new page with the whole query (section 3.4); `/browse` hydrates until BR-6, its test-plan item moves there (sections 3.9 and 5); M2 waits 7 days after A-6 for older learner tabs (section 3.9). Section 3.18 gate checked: the `Workers Builds: hangul-route-api` check passed on `main` `cdb59c7b`, which contains the A-1 merge `814d4cab`.
- 2026-10-12, design pass (`design/screens/app-shell/`). The mocks that A-4b, A-5a, A-5b and A-7 wait for: `/signin` (Panels A to D, adult step, router, errors), the adult frame (phone header in one row, persona switch, tab row, footer), the family and teacher homes with every state, and the learner entry points; the lock (A-4a) and the offline page (A-2) drawn as built. Added drafts to Appendix A and keys to section 3.15: `console.signIn.create.back`, `console.signIn.router.goNow`, `console.signIn.unreachable`, `console.signIn.standaloneFinish`, `console.home.newClass.cta`, `learner.profile.grownUpHome.selfTitle`, and first drafts for the existing keys `a11y.shell.redirecting` and `console.parentHome.title`; the `{join}` label is quoted (sections 3.8 and Appendix A). Decisions D1 to D14 are in that folder's README (no Hoya on grown-up pages; on phones the brand steps out when the persona switch shows; "Account home" on a self-only device; the lock keeps A-4a's empty canvas while it decides, where section 3.19 says "frame only").
- 2026-10-12, design pass review (PR #420, two reviews). Applied: the wide header stays one row from 720 px (the brand name joins the mark from 1120 px) and the `/parent` side column opens from 1120 px, with 768 shots (section 3.8, D2, D6); the Plan screen's Open billing drawn online and offline (A-7, D18); the join line gives the path Profile, Classes & family, Join a class and says "family code" (sections 3.8, Appendix A); spec text written back for D2, D8, D10, D12, D14 and D16 (sections 3.6 to 3.9, 3.15, 3.19); keys A-4b and A-5a delete listed in section 3.15; the reverification line names no factor; `a11y.shell.personaSwitch` draft; archived class rows keep Class report, no Notes; Add a learner is a disclosure (D15); the persona switch uses manual activation (section 3.16, D17); the join code is read through a visually hidden spaced copy, never `aria-label` on a paragraph; text links at least 64 x 64. Open for F-BILL-002 (not changed here): `design/wireframes/billing/plan-status.md` and F-BILL-002 B-9b and its `billing-handoff` test row name `via: 'paywall'` and send offline Open billing to the grown-up offline page; this spec (sections 3.6, 3.12, 3.18) and the shipped schema (`packages/content-schema/src/schemas/app-shell.ts`, `via` is `profile | dashboard | plan | lock`) use `via: 'plan'` and a disabled button offline, so F-BILL-002 aligns in its next amendment.
- 2026-10-12, A-7 (PR #454, after its two reviews). Recorded as built: the Plan screen's same-tab billing hand-off and `shell.grown_up_handoff { via: 'plan' }` are F-BILL-002 B-9b (its amendment A2); A-7 owns the Plan screen's offline entry state (sections 3.6, 3.12, 3.19: with the flag on, web, offline, Open billing is disabled with "Needs the internet" under it as its description, and re-enables on `online`), which F-BILL-002's B-9b review log also assigns to A-7. The section 5 component tests (`*.test.tsx`) wait for a React Native renderer in the mobile suite, as F-BILL-002 B-9 does; meanwhile the rules are pure tests (`logic/shell/__tests__/entry-points.test.ts`: rows, panels, the "Let's start" event, the hand-off runner with the stale-PIN branch of behaviour 22 and its one-tap guard, the offline Plan rule, titles), the platform pieces have web tests, and the screens run in `e2e/web/grown-up-entries.spec.ts` (flag on and off, tab order in Panels A and B, offline on Welcome, Profile, dashboard and Plan). The Join prefill ships without the flag (section 3.6: inert until A-5b writes the hand-off key). The Profile row's accessible name is its title and the line it shows (learner-entry.md), so offline it says "Needs the internet". The dashboard card says "Account home" on a self-only device, as the Profile row does (D9). The Welcome row renders once the shell store has answered, so Panel B never swaps in after Panel A; Someone else moves focus to Parent or caregiver. The flag-on e2e runs with `E2E_GROWN_UP_HOME=1` on a flag-on build; a CI job for it is left to A-10 (the flag flip), since A-7 does not change workflows.
