Status: ready

# F-AUTH-004 — Native grown-up sign-in with no billing links: Family, Teacher and School in the iOS and Android builds

**Status**: `ready` (spec only, revision 2 after two reviews, see the review log; rows NS-0b to NS-8 build it; every open question has a decided default, section 23)
**Scope**: `apps/mobile` (Clerk Expo sign-in on iOS and Android only, the token cache in `expo-secure-store`, the native account screens, the chooser and Welcome rows on native, the Grown-up area account card, the native gate and session rules, screen-capture protection) · `packages/content-schema` (telemetry names and payload rules, the trust record schema, one telemetry enum value) · `packages/backend` (a status-only view of the billing summary, a guard on the money routes and a switch for native requests, `no-store` on the routes the native app reads; no new route, no D1 change) · `packages/i18n` (`caregiver.account.*`, `a11y.account.*`, en, es and ko) · `apps/mobile/app.json` (privacy manifest, Android backup rule, two config plugins) · `docs/launch/owner-runbook.md` (the owner steps of section 16.2)
**Owner**: solo dev
**Rollout**: every row ships dark behind `EXPO_PUBLIC_NATIVE_SIGNIN` (off); NS-8 turns it on after the owner's device checks (section 20.2). The web is unchanged. Native builds stay on TestFlight and internal testing until F-IAP-002, as F-BILL-002 OD-5 already requires; this spec does not change that release rule. Stripe stays in sandbox; nothing here touches checkout, the portal or a price.
**Row**: AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-11 (OQ-19, decided 2026-10-21: written after OA-10, which merged as #809).
**Wireframes and mocks**: row NS-0b (agent design pass approved by multi-agent review, CLAUDE.md section 5): `design/wireframes/account/native-sign-in.md`, `native-lock.md`, `native-homes.md`; mocks in `design/screens/account/` (its README holds the pass's decisions D1 to D22, which amend ND-8 and sections 6.3, 7.1, 7.3, 7.2, 7.4, 8.2, 8.3, 8.5, 8.7, 9.1, 9.2, 10 (CS-N9), 14 and 17 below, each marked [NS-0b]).

Basis: `origin/main` `4343e8955` (2026-11-08). Every `file:line` below is at that commit.

> **Owner request of 2026-10-21 (in chat, translated), as carried by AMENDMENTS-ONE-ACCOUNT-MANY-USERS:** "Even with one account, the user must be able to switch between uses (child 1, child 2, parent, teacher, ...). Switching to a parent or teacher use must be protected by a PIN-like permission setting." OQ-19 then scheduled this spec, "so native builds get Family, Teacher and School".
>
> Every change below is marked **[AU]** where it lands in another spec, a test or a code comment.

**Standing rules that apply here:**
- Audience is anyone of any age. No age wording anywhere new. **Learners never sign in** (F-APP-001 OD-2): a learner is a device profile; only grown-ups hold Clerk accounts.
- UI strings come from `packages/i18n` (`useMessages()`), en, es and ko in the same PR as the screen, written to the F-I18N-001 section 3.10 style guide; the es and ko values in section 17 are drafts for each row's multi-agent review (MAR). Design-system tokens only. No emoji.
- **No control or call to action that buys, upgrades, renews, manages or prices a plan, and no billing link, receipt or promo, anywhere in a native build**, and no sentence that points anyone to another place to buy, manage or create an account (F-BILL-002 section 4.8, OD-4). This spec extends that rule from the Plan screen to every grown-up screen it adds.
- Anti-shame (CLAUDE.md section 1): no ranking of learners, no comparison, stable card order.
- No PII in telemetry, crash reports or stored records outside the Clerk token cache.
- Stripe stays in sandbox. Nothing here turns on Stripe Live or changes `BILLING_LIVE_ALLOWED`.

---

## 0. Summary

Today a native build (iOS or Android, built with Xcode or Gradle) has no grown-up sign-in at all: the chooser's grown-up section shows **Grown-up area** only (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 6.1, `logic/profiles/who.ts:224`), and every grown-up entry that leads to the account (Welcome's persona row, Profile's Grown-up home row, the dashboard card, the Plan screen's Open billing) is web only (F-APP-001 OD-6). A parent who is also a teacher must use a browser for family and class tools.

This spec adds, **on native builds only**:

1. **Sign in as a grown-up** with Clerk's Expo SDK: email code first, password when the account has one, the second-step and new-device codes Clerk may ask for. No account creation, no Google, no passkey, no web view, no browser hop, no deep link (section 6).
2. **The Family, Teacher and School rows** on "Who is using this?" and in the Grown-up area, behind the grown-up PIN typed by hand, with a trust rule that stops a PIN changed since the last sign-in from opening the account. A sign-in is kept across launches **only on a device that holds a grown-up PIN**; anywhere else it ends when the grown-up leaves (section 7).
3. **Native grown-up homes** for those rows: the account's families, classes and schools with their learners, reports, join codes and a **plan name shown as a fact** (no dates, no actions). Tools that edit spaces stay in the console on the web; the app shows one quiet line and links nowhere (section 8).
4. **No billing anywhere**: render tests in three languages over every state, an import guard, and a Worker guard that refuses every money route to the native app (section 9).

The console on the web, its sign-in, its lock and its billing page do not change.

---

## 1. Goals and how they are measured

| # | Goal | Measure | Target | Source |
|---|---|---|---|---|
| NG1 | A signed-in grown-up on a native build reaches Family, Teacher or School as fast as on the web | Taps from a learner screen to a native home: chooser, the use's row, PIN | 2 taps and 4 digits (AMENDMENTS-ONE-ACCOUNT-MANY-USERS G2) | render test of the flow (NS-4) and device check D3 |
| NG2 | Native sign-in works for the grown-ups who try it | `auth.native.signin` flows that end `ok` over flows that end in any result except `cancelled` and `offline` (one event per flow, section 15), over 28 days after NS-8 | at least 0.8 | daily counters (`telemetry_daily`) |
| NG3 | No purchase surface in a native build | Render tests of every state of every native grown-up screen in en, es and ko against the deny list (section 9.2); the import guard; the Worker guard | 100 % pass; no App Review 3.1.1 or Google Play Payments policy rejection that cites these screens | NS-2 to NS-7 tests; store review notes |
| NG4 | Children never reach the account without the grown-up gate | CS-N1 to CS-N15 (section 10) and AMENDMENTS-ONE-ACCOUNT-MANY-USERS CS-1 to CS-21 (CS-4 as amended by ND-7) pass | 100 % | NS-7 and every later row |
| NG5 | Native grown-ups use their homes (a guide, no target) | `auth.native.home` per day, by `use` | trend only | daily counters |

**Kill criteria**: a store rejection under App Review 3.1.1 or the Google Play Payments policy that cites these screens; a CS-N failure in a release build; a support report of a child reaching a native account screen without the gate; NG2 below 0.5 for 7 days in a row. Any one sets the Worker switch `NATIVE_ACCOUNT` off at once (section 9.4: every account route refuses the native app, so installed builds lose the homes without an update), then `EXPO_PUBLIC_NATIVE_SIGNIN` off in the next build.

---

## 2. Why: store, safety and privacy grounding

- **Store payment rules** (F-BILL-002 section 4.8 records the reading this spec designs to; verify against the current text before any submission): App Review Guideline 3.1.1 forbids buttons, external links and other calls to action that direct customers, directly or indirectly, to purchasing mechanisms other than in-app purchase; 3.1.3(b) lets content bought elsewhere unlock in the app only with an in-app equivalent (F-IAP-002, so the release rule of F-BILL-002 OD-5 stays). This is an education app with its own plans, not a 3.1.3(a) reader app, so it gets no reader latitude: the native app shows **which plan covers a space as a plain fact**, with no date to act on, no "manage" or "change" wording, and nothing about where plans are bought or changed (ND-8). The console, which has a Billing tab and buy buttons, is never shown inside the app, in a web view or an in-app browser (ND-1).
- **Sign-in rules**: Guideline 4.8 asks an app that offers a third-party or social login (Google) as the primary account to offer an equivalent privacy-focused option as well; offering email code and password only keeps the native app outside it (ND-3). Guideline 5.1.1(v) and Google Play's account deletion policy apply to an app that creates accounts or points users to an account-creation flow elsewhere; the native app signs in only and never points anywhere (ND-4). Guideline 2.1 needs a working demo account for review (owner step O-5, device check D13).
- **Child safety**: many learners are children (CLAUDE.md section 1). A grown-up session that survives restarts is a standing door on a family tablet. On native it survives only where a typed grown-up PIN guards it, and the **trust epoch** (F-APP-001 section 3.9) keeps a PIN that changed since the grown-up last signed in, for example through the 24-hour wait, from opening it (section 7).
- **Least data**: the app keeps no account data on the device beyond Clerk's own token cache (keychain or keystore, and only on a PIN device) and a record of which uses the account has, with no names (section 13). Account pages are fetched while open and forgotten when the grown-up session closes.

**Threat model** (adds to AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 2):

| In scope | Out of scope |
|---|---|
| A child holding a device where a grown-up stays signed in (typed PIN, trust epoch, 5-minute background rule, section 7) | A rooted or jailbroken device reading the keychain or keystore |
| A child who sets a new PIN through the 24-hour wait and then tries Family (the epoch moved: sign in again, with the password where the account has one, CS-N3) | Someone who knows the grown-up's password |
| A child on a device where the grown-up's email inbox is open (Mail set up on a family iPad, code autofill): see accepted risk R-1 | Several grown-up accounts signed in on one device at once (one at a time, ND-14) |
| A face or fingerprint enrolled on the device by a child (account rows take a typed PIN only, CS-N11) | A child creating their own grown-up account on the web (the console's adult step, F-APP-001 OD-13) |
| A class iPad or a parent's phone with no learner profile and no PIN, where a teacher or parent signed in (no kept session there, ND-9) | |
| A device handed on after an uninstall and reinstall (iOS keeps keychain items: the install sweep, CS-N7) | |
| The app switcher's snapshot and screenshots of an account screen (CS-N12) | |
| A device backup or a phone-to-phone transfer carrying the sign-in (CS-N7) | |

**Accepted risk R-1.** On a device where the grown-up's email inbox is open to a child, an email code is not a secret against that child. Mitigations: a re-trust after any PIN change needs the password (or a second factor) when the account has one (section 7.3); the account home then shows, once, that the PIN changed (section 8.2); a session is kept only behind a typed PIN. An account that has only the email code can re-trust with it; the line in section 7.3 and the notice are its mitigation. Recorded here as the decided default (NQ-13).

---

## 3. Where things stand (basis `4343e8955`)

- **No Clerk in the app.** `apps/mobile/package.json` has `expo ~52.0.0`, `react-native 0.76.5`, `expo-secure-store ~14.0.1` and `expo-local-authentication ~15.0.2` (both from OA-9), and no `@clerk/*` package. The web console uses `@clerk/clerk-react` 5.x (F-AUTH-002).
- **Native stubs that say "web only"**: `platform/device-uses.ts` (no known uses on native), `platform/persona-signin.ts` and `platform/grown-up-handoff.ts` (throw: "web only (F-APP-001 OD-6)"), `platform/shell-store.ts` (no last persona), `platform/join-handoff.ts` (no hand-off), `platform/device-account.ts` (`signedInAccount()` is always `null`).
- **The chooser on native**: `grownUpRows` (`logic/profiles/who.ts:214-232`) gives `[]` account rows when `os !== 'web'` (line 224), so native shows Grown-up area only. The `GrownUpUse` PIN destination exists (`navigation/types.ts`, OA-4b) and hands off to the web; its `use` param is `GrownUpUse | 'signin'`, and `who.picked.use` is `family | teacher | school | area | signin` (`OA_TELEMETRY_PAYLOADS`, `schemas/app-shell.ts`).
- **Device gate state**: `store/device-gate.ts` keeps the in-memory marker, which is `null` before the stores load and is computed from memory even when the strict re-read refused a `none`; the account store sets `pinHashReadFailed` when the PIN read fails (F-APP-001 section 3.9). The native lock therefore cannot read the in-memory marker as it is (section 7.2).
- **Worker auth** (`packages/backend/src/lib/auth.ts`): a Clerk session JWT is verified with `authorizedParties` from the CORS allow-list; "A token with no `azp` (not minted by a browser) follows Clerk's default and is checked for signature and expiry only." Money routes need a first factor younger than 10 minutes (`fva`, F-BILL-002 section 4.4). CORS allows only `Content-Type` and `Authorization` headers (`packages/backend/src/app.ts:33`). `GET` under `/api/spaces/*` answers `Cache-Control: no-store` (`app.ts:38-41`); `/api/billing/summary` does not.
- **Routes the native homes need already exist** and check the account and its role (`requireAccount`, `packages/backend/src/lib/access.ts:14`; `can`, `lib/can.ts`): `GET /api/spaces` (`routes/spaces.ts:144-179`, `joinCode` only for `space.manage`), `GET /api/spaces/:id/roster` (needs `summary.read`; sorted by last activity, `spaces.ts:604`; carries `joinCode` under `space.manage`, `:609`), `POST /api/spaces/:id/code` (`space.manage`), `GET /api/spaces/:id/learners/:learnerId/report` and `GET /api/spaces/:id/class-report` (`summary.read`), `GET /api/spaces/:id/school` (`space.manage`, `routes/school.ts:38`: a school member with role `teacher` is refused), `GET /api/billing/summary` (`BillingSummarySchema`, `content-schema/src/schemas/billing.ts:182`: receipts with amounts and buy actions for payers; it records `billing.summary_viewed` on every read but a poll, `routes/billing.ts:54`).
- **Shared report models**: `packages/content-schema/src/reports/learner-report.ts` (`learnerReport()`, `:359`), `reports/class-report.ts`, `schemas/report-response.ts`. The native in-app report (`screens/parent/LearnerReportScreen.tsx`) renders the device's own snapshot.
- **No deep links on native**: `apps/mobile/app.json` has no `scheme` and no associated domains or intent filters; the navigation has no `linking` config.
- **Lecture mode is web only**: `screens/parent/LectureCard.tsx:136` returns nothing when `Platform.OS !== 'web'`. (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 0 listed Lecture mode among the native Grown-up area's tools; this PR corrects that line, section 19.)
- **Learner storage**: every learner key goes through `platform/storage.ts` with the prefix `hr:` (`:9`). Backups (`logic/sync/backup.ts`) export one profile and its snapshot, never device keys. The query client is a private constant in `App.tsx:47`; `closeGrownUpSession` lives in `store/grown-up-session.ts:31`. The Plan screen's deny list is inline in `screens/paywall/__tests__/PaywallScreen.test.tsx:80`. `config/__tests__/face-id-permission.test.ts` pins the `expo-secure-store` plugin options.

---

## 4. Decisions

| # | Decision | Why |
|---|---|---|
| ND-1 | **Native grown-up homes are native screens**, a focused subset of the console built in the app (section 8). The console is never shown in a web view or an in-app browser. | The console carries a Billing tab, buy buttons and price lines; any of them inside the app is a 3.1.1 call to action. A web view would need every future console page audited for a native mode, Google refuses sign-in inside embedded web views, and a cookie session would need a second sign-in. F-APP-001 AD-1 rejected rewriting the **whole** console for native; this is a small read-and-share subset with no billing code in the binary at all. |
| ND-2 | **What the native homes do** (v1): list the account's families, classes and schools; show each family's and class's learners (names, last active, minutes in the last 7 days); open a learner's report and a class's report; show, copy and make a join code (only when the server sends one), and join on this device; show the plan name. **Not in v1**: creating or renaming spaces, settings, archive, weekly plans and curriculum, notes, re-link and move decisions, admin invites, removing a learner's data, Lessons (F-BROWSE-001), Lecture mode, Learning Route pages, billing. | Covers what a grown-up checks on a phone; every edit tool keeps its tested console page. One quiet line says more tools exist, without a link or a place (section 8.6). |
| ND-3 | **Sign-in methods on native: email code first, password when the account has one**, then any second step or new-device check Clerk asks for that is a code (authenticator, text message, email, backup code). No Google, no Apple, no passkey, no email link. | Every account has a verified email (Clerk verifies it at sign-up, F-APP-001 section 3.7), so the email code works for accounts made with Google too. Each of these factors proves a secret (F-APP-001 section 3.9). No OAuth means no redirect, no browser hop and no Guideline 4.8 obligation. Sign in with Apple together with Google is a later pair (section 21). |
| ND-4 | **No account creation on native**, and no pointer to where accounts are made. The sign-in screen says "This app doesn't make new grown-up accounts." and nothing more. | Guideline 5.1.1(v) and Google Play's account deletion policy; the console's adult step (F-APP-001 OD-13) stays the one way in. |
| ND-5 | **A typed PIN guards every native account entry on a PIN device**: a PIN typed on the PIN pad within `GROWN_UP_FRESH_PIN_MS` (2 minutes, `ui-store.lastPinTypedAt`), or a native sign-in completed within the same 2 minutes. **Face or fingerprint does not open the account** (it keeps opening the local Grown-up area, OA-D10). An open 15-minute session alone never opens an account screen. | The OA-9 shortcut accepts a face or fingerprint enrolled before it was turned on; on a family tablet that can be a child's. The account shows other families' children (class rosters), so it takes the stronger proof. |
| ND-6 | **The trust epoch on native**: the account rows open with the PIN only while the device's PIN epoch equals the epoch stored at the last native sign-in (`hr:grownup:trust`); epoch `0` is never trusted. Otherwise **Sign in again** (sign out on this device, then sign in). | F-APP-001's trusted epoch, the same rule and the same reason: a PIN a child set must not open the account. |
| ND-7 | **A device with child profiles and no PIN (`nopin`) never opens the account.** Its account rows carry **Set a grown-up PIN first.** and open the Grown-up area destination, which runs PIN setup (F-PROF-001 section 10). | A choice, not a gap: Clerk's headless session verification could ask for a code on every entry instead, but a PIN set once is simpler and stronger on a family device. A difference from the web's CS-4, recorded in AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 9 by NS-4. |
| ND-8 | **The plan is shown as a fact, never as something to act on**: the plan's name (or "Covered by {school}'s license"; [NS-0b] D20: without its end date on native), and the usage line where the server sends it (not on a free plan, D20). No renewal or end date of the space's own plan, no "manages this plan" line, no payer line, no price, no action. | 3.1.1 forbids indirect references to purchasing elsewhere; a date to renew by, "manage" wording or "you can't change plans here" all point somewhere. A plan name is account status with no call to action. |
| ND-9 | **A sign-in is kept across launches only on a device that holds a grown-up PIN.** There the token cache is in the keychain or keystore, guarded by the typed PIN and the trust epoch. On a device with no PIN (no learner profile, or self-only learners), the token cache is in memory only: closing the grown-up session or the app signs out, and every account entry starts with a sign-in. | A class iPad or a parent's phone with no profile has no gate at all, and Welcome is the first screen a child sees there; the session must not outlive the grown-up's visit. A grown-up who wants to stay signed in on their own phone sets a grown-up PIN. |
| ND-10 | **No account data is kept on the device**: no offline copy of rosters, reports or codes. Only the uses record (no names, PIN devices only), the trust record and the install record are stored. Every route the native app reads answers `Cache-Control: no-store`, and the client asks for no cache. | Least data on a shared device; the native homes are online pages, as the console's are. |
| ND-11 | **Clerk runs only while a grown-up is in.** `ClerkProvider` wraps the Grown-up area stack and is mounted only while that stack is mounted, which is behind the gate; it unmounts when the grown-up session closes. The chooser reads the uses record, never Clerk. | No third-party SDK runs for a child; a learner's start, offline use and bundle stay as they are. |
| ND-12 | **No reset of the PIN by signing in on native** (OA-D8 stays web only). Native keeps the Rescue Code, the 24-hour wait and face or fingerprint. | The PIN-owner rules of AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.2 are browser-bound; porting them is its own decision (section 21). |
| ND-13 | **No native end-to-end runner is added.** Native behaviour is covered by render tests in the React Native test lane (`vitest.render.config.ts`, F-BILL-002 B-13) with Clerk mocked, plus the owner's device checks (section 20.2). | The repo has no Detox or Maestro lane; adding one is a project of its own (section 21). |
| ND-14 | **One account at a time.** Signing in as another account needs Sign out first. | Matches the console's single session; the uses record stays one account's. |

---

## 5. Store and policy rules, as code

| Rule | What the native build does | Enforced by |
|---|---|---|
| App Review 3.1.1; Google Play Payments | No control or call to action that buys, upgrades, renews, manages or prices; no renewal date or "manages" line; no URL to the app host or the site from a grown-up screen | deny-list render tests (9.2), import guard (9.3), Worker guard (9.4) |
| 3.1.3(b), F-BILL-002 OD-5 | A Family Plan bought on the web still unlocks only in TestFlight and internal builds until F-IAP-002 | release checklist (unchanged) |
| 3.1.3(c) | Inherited from F-BILL-002 section 4.8 for class and school coverage; a licence a teacher buys through self-serve checkout may read as a consumer sale (risk in section 18, flagged to F-BILL-002 and F-IAP-002 by NS-8) | before any public release |
| 4.8 Login services | Email code and password only | the sign-in step machine has no OAuth branch; import guard |
| 5.1.1(v), Google Play account deletion | No sign-up on native and no wording or pointer about where accounts are made | import guard (no sign-up hook); deny list (`sign up`, `create an account`, `가입`, `regístrate`) |
| 2.1 Completeness and demo account | No "coming soon" wording; a review account that signs in on a fresh install with a password alone | copy rules (section 17); owner step O-5; device check D13 |
| 5.1.1 and Play Data safety | Email address and user id collected for app functionality, linked to the grown-up, not for tracking; Clerk's own collection (IP address, device and user-agent data per session) assessed; a phone number when a text-message second step is used | `app.json` privacy manifest (NS-2); owner step O-4 |
| Audience: Education, not the Kids Category (CLAUDE.md section 1) | Clerk is the only new SDK, running only behind the gate (ND-11), with its telemetry off | NS-2 tests, CS-N1 |
| Google Play Families policy (when the Play target audience includes children) | Clerk runs only behind the grown-up gate; it collects a grown-up's email, never a child's; no ads SDK | CS-N1, CS-N2; owner step O-4 checks the Play Console answers |

---

## 6. Native sign-in (Clerk Expo)

### 6.1 Package and provider

- `@clerk/clerk-expo`, pinned to the release line that supports Expo SDK 52 and React Native 0.76 with the new architecture (the exact version is recorded in NS-2, with the native binary size before and after), plus any Expo module its pinned version needs at import time (recorded there; no OAuth flow is started). It is imported **only** from `.native.ts` / `.native.tsx` files (`platform/clerk.native.tsx`, `screens/account/**`), with `.ts` stubs for the web, so the web bundle never contains it (test, NS-2).
- **Where it mounts** (ND-11): `ClerkProvider` wraps the navigator of the Grown-up area stack. If `ParentDashboard` and its routes sit in the root stack at the basis, NS-2 moves them, with the account routes, into one nested `GrownUpStack` navigator (route names unchanged), so the provider wraps that navigator without remounting the root `NavigationContainer`. The stack is popped when the grown-up session closes (OA-2), which unmounts the provider. No learner screen calls a Clerk hook (import guard).
- Props: `publishableKey` from `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (a release build accepts only `pk_live_`; a development build also `pk_test_`; anything else, a secret key included, is ignored and the native rows stay hidden), `tokenCache` (6.2), and Clerk's SDK telemetry turned off.
- `nativeAccountEnabled({ os, flag, key, release })` (pure): true only on `ios` or `android`, with `flags.nativeSignInEnabled` (`EXPO_PUBLIC_NATIVE_SIGNIN`, `parseKillSwitch` semantics, default off until NS-8) and a key valid for the build. False hides every native row and screen of this spec and leaves the native app exactly as at the basis (CS-N13).

### 6.2 Token storage

- **Two caches, one rule** (ND-9). The `tokenCache` adapter (`platform/clerk-token-cache.native.ts`) writes to `expo-secure-store` **only when the device holds a grown-up PIN** (the gate state `pin` of section 7.2, read when the sign-in completes); otherwise it holds Clerk's items in memory for the run. On a PIN device it uses its own keychain service `hr.clerk`, `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` (never in iCloud Keychain, never restored to another device) and **no** `requireAuthentication` (a token read must not ask for a face). Nothing of Clerk's ever goes to AsyncStorage, the `hr:` storage wrapper, a log, a crash report or telemetry.
- **Key index.** `expo-secure-store` reads, writes and deletes by key only and cannot list a service. The adapter therefore keeps an index item, `hr.clerk.index` in the same service, holding the list of every key it wrote; it writes the index before the item and refuses to write a key it could not index (test). Sign-out and the install sweep delete every indexed key and then the index; NS-2 also records the keys the pinned Clerk version uses (its client token key among them) and deletes those by name too.
- **Install sweep** (CS-N7): iOS keeps keychain items after an uninstall. At the first launch where the storage wrapper has no `grownup:installed` record (a fresh install, or app data cleared), the app deletes every indexed and named `hr.clerk` key. It writes `{ v: 1, at }` **only after every delete answered success or not-found**; a failed delete (for example while the device has not been unlocked since a restart) leaves the record unwritten, and the sweep runs again at the next launch. Until the sweep has completed in this run, the native rows read as signed out and `ClerkProvider` never mounts. A device that upgrades from a build without this spec has no Clerk item, so the sweep removes nothing.
- **Unreadable items**: a SecureStore read that throws (an Android decrypt error after a restore, a damaged item) deletes that item and the index, and reads as signed out.
- **Persisted session only with a PIN**: at every launch and every gate-state change, a persisted Clerk session on a device whose gate state is not `pin` is deleted (sign-out), so a kept session exists only behind a PIN.
- **Android backups**: the `expo-secure-store` config plugin's Android backup option excludes its stored values from Auto Backup and device transfer (`configureAndroidBackup`; NS-2 confirms the option on the pinned version and otherwise adds the backup-rules file through a small config plugin, and updates `face-id-permission.test.ts`, which pins the plugin options). AsyncStorage is in Auto Backup, so a restore brings back the `hr:grownup:*` records but no Clerk item: the device reads as signed out, the old trust record is overwritten at the next sign-in, and the `installed` record makes no sweep run (none is needed: there is nothing in the keystore).
- The biometric shortcut's item (`hr.biometric`, OA-9) and the Clerk items never share a service.

**As built in NS-2** (sections 6.1, 6.2, 7.2, 7.4, 8.1, 8.5, 8.8, 9.2, 9.3; after its two reviews, correctness and consistency: 0 blockers, 2 majors, 7 minors; security and child safety: 0 blockers, 3 majors, 6 minors; all adopted but one, noted below):

- **Packages, pinned exactly**: `@clerk/clerk-expo` **2.20.2** (the last line that supports Expo SDK 52, React Native 0.76 and React 18.3; its successor `@clerk/expo` needs SDK 54 or later, and 2.20.2 prints a deprecation notice once when it loads), with the two Expo modules its index requires when it loads, `expo-web-browser` **14.0.2** and `expo-auth-session` **6.0.3** (which brings `expo-application` and `expo-linking`); no OAuth flow is ever started and neither module is imported by the app's own code (import guard). `expo-screen-capture` **7.0.1**. Each version is the SDK 52 line of `expo/bundledNativeModules.json`. `@clerk/clerk-expo` loads only `@clerk/clerk-js/headless`, a self-contained build that requires no package at run time, so `pnpm-workspace.yaml` removes the web UI's crypto-wallet stacks (Solana, Coinbase, Base: some 200 packages, one of them LGPL-3.0) and Stripe.js from `@clerk/clerk-js`'s dependencies (`overrides: "-"`; installed, the wallet stack's optional `ws` addons also split React Native into two copies and doubled it in the web bundle); `scripts/third-party-notices.mjs` does not follow a removed dependency, and the notices list the 70 new packages. The notice-only install scripts of `core-js` and `browser-tabs-lock` are skipped. `apps/mobile` pins `@types/node` 22.19.19, which the new tree no longer hoists. Accepted risk: the Core 2 line (`@clerk/clerk-expo` 2, `@clerk/clerk-react` 5) is deprecated and gets no new fixes; moving to `@clerk/expo` comes with the Expo SDK 54 upgrade.
- **Size**: the web start bundle is byte for byte the same as without this row (the same file hash: 4,927,400 B on the NS-1 basis, and 4,928,451 B on `main` at `c7fb71f08`, built with and without it); the native JavaScript bundle (Hermes bytecode, `expo export`) grows from 14,594,721 B to 15,824,998 B on iOS (+1.17 MiB, almost all of it Clerk's headless build) and from 14,605,096 B to 15,833,935 B on Android (+1.17 MiB); the native binary size before and after is the owner's next Xcode build (runbook §O, step O-0).
- **Status names and keys** of the pinned SDK: `SignIn.status` is `needs_identifier`, `needs_first_factor`, `needs_second_factor`, `needs_new_password` or `complete`; it has **no** `needs_client_trust`, so NS-3 reads the raw status and maps an unknown one to `unsupported`, and U6 stays open for D2 and D13. The token cache sees one key, the client token `__clerk_client_jwt` (no resource cache is set up); `CLERK_NAMED_KEYS` lists it.
- **Placement**: the root stack's `ParentDashboard` route is, on iOS and Android, `navigation/grown-up-stack.native.tsx`, chosen through an `EXPO_OS` test the web build folds away. With the native account off it is the dashboard itself. With it on it is a nested stack whose first route is the dashboard under the same name, so every `navigate('ParentDashboard')`, the PIN screen's `next`, the header registry and the session rules read it unchanged (React Navigation prints a development-only warning about nested routes sharing a name). The other Grown-up area routes stay in the root stack, pushed above it, so the provider stays mounted while any of them is in front and unmounts when the session close pops the area (OA-2); the account routes of NS-3 to NS-6 join the nested stack. The provider mounts only after the install sweep is complete and the gate state is `pin` or `open`, and the decision waits at most 2 seconds (`CLERK_MOUNT_WAIT_MS`) before the dashboard shows without Clerk for that visit. `platform/clerk.native.tsx` is loaded with `import()` then, so with the switch off no Clerk code runs.
- **Clerk's instance lives for the run**: `@clerk/clerk-expo` keeps one Clerk instance per run, and unmounting the provider does **not** end its session. So `ClerkHost.endSession` signs out of it (a `signOut` with a callback, so Clerk never tries to navigate a browser window): at every Grown-up area mount on an `open` or `nopin` device (an earlier visit's session ends there, ND-9; then every kept and memory item goes) and on a gate change that leaves `pin` (`applyGateChange`: sign-out first, while the token still reaches Clerk, then the wipe). Row NS-4 also calls it at the session close of a device with no PIN. Since a sign-out made offline may leave Clerk's local state, `accountLock` opens the `open` row's home only for a sign-in completed during this visit (`signedInThisVisit`), never for Clerk's own `isSignedIn`. The provider sets `rethrowOfflineNetworkErrors`, so a token call that fails for the network throws `network_error` (the API client reads it as `offline`) rather than answering null, which would read as a sign-out (8.8).
- **Web bytes**: three pieces live in native-only modules instead of the shared ones the sections above name, so the web start bundle (a few hundred bytes of room) carries none of them: the switch is read by `config/native-signin.ts` (`nativeSignInSwitch`, `parseKillSwitch`'s words, held equal by a test) rather than `flags.ts`; `nativeGateState()` is `store/native-gate-state.ts` rather than `store/device-gate.ts`; and the query client stays in `App.tsx`. The account queries are cleared from the native Grown-up area stack instead: at its unmount, and at every session close through a listener registered once at module level with the client the area last mounted with (a close by navigation runs after the area's unmount, so a listener of the mounted area would be gone; CS-N4).
- **Gate state**: the epoch counts as reconciled only while `account:pinHashSeen` matches the hash in memory, and memory and storage must hold the same PIN hash; anything else reads `unknown`. The watch reads once more 250 ms after an `unknown` (a store writes memory before storage).
- **Mount decision**: once the visit no longer waits (the 2-second wait ran out, the area closed), a late decision changes neither the token storage nor anything else. `ClerkMountContext` tells the area's screens whether the provider is above them (`pending`, `off`, `ready`), so a screen calls a Clerk hook only under `ready`. A Clerk render error falls back to the dashboard without Clerk (the local tools stay) and reports `app.crash` with an empty message (CS-N15).
- **API client** (8.1): an allow list, not a deny list: `/api/spaces` and its sub-paths (no query but `period`) and `/api/billing/summary?view=status`, read after decoding and resolving dot segments. React Native's fetch ignores `redirect: 'manual'` (the request follows a redirect and the platform decides whether `Authorization` goes along); an answer from another URL reads as `error`, the Worker never redirects these routes, and device check D11 covers the rest. `cache: 'no-store'` becomes a `_=<time>` query on a GET there, which the Worker ignores.
- **Token storage**: `applyGateToTokens` follows the gate state at the Grown-up area's mount (`pin` keeps, `open` and `nopin` delete every kept item and an earlier visit's memory items) and at every change while it is open (leaving `pin` ends a kept session; a PIN set after a memory sign-in keeps nothing, 7.3). A wipe reads every key back after deleting it (on iOS a delete never reports a failure). A damaged index is never written over (no key is kept until a wipe deleted it, and that wipe deletes the named keys), and an unreadable item deletes every kept item with the index, so no indexed key is ever left without an index. The install sweep runs at the first Grown-up area entry of a run (Clerk never runs before it) and again at the next entry after a failure; an install record that does not parse reads as none (the sweep runs and writes it again). Not adopted: wiping kept items while the switch is off (the O-7 rollback). The off build is the basis exactly (CS-N13) and never reads them; the next on build's first mount deletes them on a device that is no longer `pin`.
- **Android backups** (correcting the 6.2 bullet): the backup rules expo-secure-store installs include shared preferences only, minus SecureStore's, so AsyncStorage is not in Auto Backup either. A restored device reads as a fresh install (the sweep deletes nothing; signed out), which the same section asks for.
- **Deny list** (9.2): the spec's whole words missed their own forms, among them the lines ND-8 forbids ("manages this plan", "Renews on", "prices or receipts"). The en list matches stems (`manag*`, `renew*`, `pric*`, `receipt*`, `subscri*`, `purchas*`, `upgrad*`, `unlock*`, `invoic*`, `refund*`, `payment*`, `payer*`) and adds `buys`, `buying`, `bought`, `costs`, `trials`, `bill`, `bills`, `billed`, `pays`, `paid`, `paying`, `signup`; es adds `renuev`, `administr`, `pagad` (and `desbloque` as the stem of `desbloquear`); ko adds `관리`; symbols match in any case. A test holds that every `console.billing.readOnly` line, `status.renewsOn`, `help.learners` and `manage.cta` is caught in en, es and ko.
- **Import guard** (9.3): module imports are followed transitively (native resolution), app modules are matched after resolution (`'../paywall'` included), and it also refuses `expo-linking`, `Linking` read off react-native, Clerk's `signUp` resource, `authenticateWithRedirect` and the `oauth_`, `enterprise_sso`, `saml`, `web3_`, `email_link` and `passkey` strategies; only the Grown-up area stack imports `platform/clerk*`.
- **Plan block**: a school's own card seen by its admin (`school` coverage on `kind: 'school'`, SA-D11) shows the plan's name with no date, since that date is the space's own plan date (ND-8).
- **Capture protection set-up** (a limitation for NS-4 and D5: the cover is on the app's window, not the system keyboard's, so a keyboard left open on an account screen, with its suggestion bar, is not covered): the iOS cover plugin (`plugins/with-account-cover.js`) adds notification observers to `AppDelegate.mm` that cover the window on resign-active while the `NSUserDefaults` flag `hr.accountCover` is on (React Native's `Settings.set` writes it; row NS-4 sets and clears it; every launch clears it); a Swift app delegate fails the prebuild. `expo-screen-capture` declares Android's `DETECT_SCREEN_CAPTURE`, which `app.json` blocks: the app never listens for screenshots and `FLAG_SECURE` needs no permission.
- **U4** holds: expo-secure-store 14.0.1's plugin has `configureAndroidBackup` (on by default); `app.json` sets it explicitly and `face-id-permission.test.ts` pins it.
- **Logs**: Clerk's SDK writes its own development notices (the deprecation notice; a warning on an offline request that names the request path; an error when the Native API is off). No token, email or code is in them; the app itself logs nothing of Clerk's.
- **Tests**: a `native` vitest project (`vitest.native.config.ts`, `*.native.test.tsx`, `.native` files resolved first); the import guard (`logic/account/__tests__/account-imports.test.ts`); the web bundle guard (`config/__tests__/web-bundle-guard.test.ts`); the `app.json` and plugin test (`config/__tests__/native-account-config.test.ts`). The U1 device smoke build is the owner's step O-0.

### 6.3 Sign-in steps (`logic/account/sign-in-step.ts`, pure reducer; `screens/account/SignInScreen.native.tsx`)

| Step | Screen | On submit |
|---|---|---|
| `email` | title **Grown-up sign-in**, intro, an email field (`textContentType="emailAddress"`, `autoComplete="email"`, no autocorrect), **Continue**; under it "Learners don't need an account." and "This app doesn't make new grown-up accounts." | `signIn.create({ identifier })`; when the account's first factors include `email_code`, `prepareFirstFactor({ strategy: 'email_code', emailAddressId })` and go to `code` ([NS-0b] except while a re-trust is pending: `password` first when the account has one, 7.3, D21); when they include only `password`, go to `password`; neither: `unsupported` |
| `code` | "We sent a 6-digit code to {email}.", a code field (`textContentType="oneTimeCode"`, `autoComplete="one-time-code"`, digits), **Sign in**, **Send a new code**, **Use my password** (only when the account has a password), **Use another email** | `attemptFirstFactor({ strategy: 'email_code', code })` |
| `password` | a password field (`textContentType="password"`), **Sign in**, **Email me a code** (only when the account has the email code), **Use another email** | `attemptFirstFactor({ strategy: 'password', password })` |
| `second` | "Enter the code from your second sign-in step." (status `needs_second_factor`) or "We sent a code to check this new device." (status `needs_client_trust`, Clerk's device check), a code field, **Sign in**, and **Use a backup code** when the account has one | the first of the account's offered factors among `totp`, `phone_code`, `email_code` (the last two after `prepareSecondFactor`), or `backup_code` when chosen; none of those: `unsupported`. [NS-0b] **Send a new code** shows when the step's code was sent (the device check, a `phone_code` or `email_code` second step) and calls `prepareSecondFactor` (or the device check's prepare) again |
| done | — | `status === 'complete'`: `setActive({ session })`, then section 6.5 |

- Statuses the pinned SDK names differently (NS-2 records them) are mapped into these four steps; any status that is not a code step (a new password required, a step not in this list) ends in `unsupported`: "This account needs a sign-in step this app doesn't have." with **Use another email**.
- **Errors** are mapped by Clerk error code to our words; Clerk's own English messages are never shown:

| Clerk answer | Line | `result` (15) |
|---|---|---|
| `form_code_incorrect` | `wrongCode` | `wrong_code` |
| `verification_expired` | `codeExpired` | `expired` |
| `form_password_incorrect` | `wrongPassword` | `wrong_password` |
| `form_identifier_not_found`, any other refusal of the identifier | `cantSignIn` | `refused` |
| HTTP 429, `too_many_requests`, `user_locked` | `tooMany` | `too_many` |
| network failure | the offline line | `offline` |
| anything else | `generic` | `error` |

- The neutral `cantSignIn` line is a courtesy, not a defence: Clerk answers `form_identifier_not_found` to any caller, and a known email moves on to the code step, so which emails have accounts is visible through Clerk's API either way.
- A wrong code or password keeps the step; the field is cleared and focused, and the line is announced (section 14).
- [NS-0b] **Continue** on the email step is disabled until the field holds an @ (D1); while Clerk answers, the step's submit button is disabled and busy with the same words, no new string, and every other button but Back is disabled until the answer (D2); offline, every button that calls Clerk is disabled (Continue, Sign in, Send a new code, Email me a code) and the ones that only change the step stay enabled (Use my password, Use a backup code, Use another email; D2); after **Use a backup code** the field is plain text (backup codes hold letters), its accessible name is its visible label **Code** (not `a11y.account.codeField`) and that button goes (D4); every error line is one amber strip under its field (`feedback.nudgeLight`, a `feedback.nudge` edge), announced and tied to the field, never the danger colour; the field's own border stays `border.shape` and thickens (D5).
- **Offline**: the screen shows `learner.welcome.grownUps.needsInternet` under the title, **Continue** and **Sign in** are disabled, and they come back on the network's return (`platform/online.ts`). A step in progress keeps its place.
- Email links (Clerk's magic link) are never prepared, so no link in an email can open the app or a browser into the account.
- **Cancel** (the header's Back on the first step, or leaving the screen) returns to where the sign-in was opened (the chooser, Welcome or the Grown-up area).

### 6.4 Deep links and redirects

None. F-AUTH-004 adds no URL scheme, no universal or app link, no intent filter and no `linking` config, and the sign-in uses no redirect URL (no OAuth, no email link). No notification, link or boot path can open a native account screen; the only ways in are the rows of section 7 (CS-N6; a config test reads `app.json` and fails on a `scheme`, associated domains or intent filters). The Clerk Production instance needs its **Native API** turned on (owner step O-1); no redirect allow-list entry is needed.

### 6.5 After a sign-in

1. Read `GET /api/spaces` with the new token.
2. On a device whose gate state is `pin` with a real epoch (not `0`): write the uses record `hr:grownup:deviceUses` = `{ v: 1, uses: usesFor(items), at }` (`DeviceUsesSchema`, the console's shape, no names, no ids) and the trust `hr:grownup:trust` = `{ v: 1, epoch }` (`AccountTrustSchema`), subject to the re-trust rule of 7.3. On any other device neither is written (ND-9).
3. Note the sign-in time in memory (`ui-store.lastAccountSignInAt`), which counts as a fresh proof for 2 minutes (ND-5).
4. Emit `auth.native.signin { result: 'ok', method, second }` (section 15).
5. Open the home of the use the grown-up came for (a row's use), else `nativeHomeFor(uses)`: Family, then Teacher, then School; an account with no space opens the Family home's "no family yet" state.

A failure of step 1 still completes the sign-in; the home's own error state and **Try again** follow, and the records are written at the home's next successful load.

### 6.6 Signing out

- **Sign out** (`console.shell.signOut.cta`; in the Grown-up area account card and on every native home; a ConfirmSheet "Sign out of this account on this device?" with **Sign out** and **Cancel**): Clerk `signOut()`, then delete every `hr.clerk` key (6.2), `hr:grownup:deviceUses`, `hr:grownup:trust` and the account queries (7.4); return to the Grown-up area (or Welcome when the device has no learner profile). It stays enabled offline: the local items are deleted at once, and the session then ends on Clerk's side only at its normal end (accepted risk R-2, section 18; a remote revoke is F-AUTH-005's). Emits `auth.native.signout { via: 'user' }`.
- **Sign in again** on the native lock (7.2) signs out the same way, then opens the sign-in screen; it emits `auth.native.signout { via: 'lock' }`.
- **Session end without a sign-out**: on a device with no PIN, closing the grown-up session or the app ends the memory session (ND-9); no event.
- A session Clerk ended elsewhere (revoked, expired) reads as signed out at the next account screen: the records are deleted and the sign-in screen opens after the gate.

---

## 7. The rows on native and their gating

### 7.1 Where the rows are

| Surface | Native rows (switch on) | Gate |
|---|---|---|
| "Who is using this?" Grown-ups section (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 6.1) | the known uses **Family**, **Teacher**, **School** (fixed order), or **Grown-up account** when the uses record holds no use, or **Sign in as a grown-up** with no uses record; then **Grown-up area** as today | section 7.2 |
| Welcome (no learner profile on the device; F-APP-001 section 3.6 kept the row web only) | under **I already have progress**: the lead "Here to support a learner?" and one outlined button, **Sign in as a grown-up** (never a use row: a device with no profile keeps no session, ND-9); **Let's start** stays the only filled button | no PIN can exist yet; the sign-in is the gate, and the session ends when the grown-up leaves |
| Grown-up area (`ParentDashboard`), first card on native | **Grown-up account**: signed out, the line "Sign in to see your family, classes and school here." and **Sign in**; signed in and past the gate of 7.2, "Signed in as {who}" (`console.adminInvite.signedInAs`), one button per known use, **Sign out** and `console.billing.help.sharedDevice`; signed in but locked by 7.2, the lock's line and its button (no email shown) | inside the Grown-up area stack; every button goes through `AccountGate` (7.2) |

- Rows come from `grownUpRows` (`logic/profiles/who.ts`), which gains an input `nativeAccount: boolean` (`nativeAccountEnabled`) and the native uses record: on native with `nativeAccount` true the account rows follow the web's rule (the known uses, else the sign-in row), plus the **Grown-up account** row (use code `account`) for a record with no use. With `nativeAccount` false, native shows Grown-up area only, exactly as at the basis.
- The `account` use code: `GrownUpUse` gains the param value `'account'` (its target is the Family home's "no family yet" state), and `who.picked.use` gains `'account'` (row NS-1, Worker first; an appended enum value).
- The rows show only generic labels, never a name or an email; CS-7's list of labels gains **Grown-up account** (CS-N9).
- **Offline**: account rows are disabled with `learner.welcome.grownUps.needsInternet`, as the web's rows are (section 12); Grown-up area stays enabled.
- **`nopin`** (ND-7): every account row carries the caption **Set a grown-up PIN first.** (`caregiver.pin.needsPinFirst`) and opens the Grown-up area destination (`PinEntry { next: 'ParentDashboard' }`, which runs setup), never an account screen. [NS-0b] Offline, a `nopin` account row is disabled with **Needs the internet** like any account row (D3); the Grown-up area row still runs setup offline.
- [NS-0b] **The account card** (D7) sits after Switch user and before People on this device. "Past the gate" in the row above means the trust matches the epoch; the **email line** shows only with a fresh proof as well (`lastPinTypedAt` or `lastAccountSignInAt` within `GROWN_UP_FRESH_PIN_MS`), so a Grown-up area opened with face or fingerprint, or a PIN older than 2 minutes, shows the use rows, the shared-device line and Sign out without the email (CS-N9). The card decides this as AccountGate does, on mount, focus and return to `active` (no timer), so the email may stay on screen past the 2 minutes until the next of those. Every card button that opens an account screen or signs in (Sign in, a use row, **Sign in again**) goes through `AccountGate`, so it asks the typed PIN first when no fresh proof exists; Sign out (which only deletes) does not. An account with no space shows no use row (a button would only open "This account has no family space."; the chooser keeps its **Grown-up account** row because from the chooser that home is the way to Sign out). Gate state `unknown` shows `caregiver.account.lock.cantCheck` with **Try again** and no email; the card never shows on `nopin` (entering the Grown-up area there runs PIN setup first). On an `open` device the signed-in card's rows come from this run's in-memory `['account', 'spaces']` query (no record is kept, ND-9). A PinEntry, lock or SignIn reached with no use (the card's Sign in) is titled **Grown-up account** (D6).
- The uses record exists only on a PIN device (ND-9), so a known use makes a PIN device *shared* (OA-D6, `isSharedDevice`): after a native sign-in, a device with one learner and a PIN starts showing the chooser at launch, as a browser does after a console sign-in.

### 7.2 The native gate (`AccountGate`)

**Every account screen renders inside `AccountGate`**, and the gate decides on mount, on every focus, and on every return of `AppState` to `active` (the native form of the web's per-pathname `GrownUpLock`). It reads:

- **The gate state** (`nativeGateState()`, exported from `store/device-gate.ts`, pure decision over exact reads, as the marker writer reads them, F-APP-001 section 3.9): `unknown` while the profile or account store has not hydrated, when the strict profile read failed, when `pinHashReadFailed` is set, or when a stored value does not parse; else `pin` with `epoch` (`account:pinSetAt`, reconciled by the writer's fingerprint rule) when a PIN hash is stored, on any device, self-only ones included; else `nopin` when a learner needs the gate (`gateRequired`); else `open` (no profile, or self-only learners without a PIN), and `open` only when the strict stored read agrees (a refused `none` reads as `unknown`). Never the in-memory marker.
- Whether a Clerk session exists, the trust record (read exactly; a failed or unparsable read is no trust), `lastPinTypedAt` and `lastAccountSignInAt`.

| Gate state | Signed in | Trust | Result |
|---|---|---|---|
| `unknown` | any | any | locked: "Can't check this device right now. Try again in a moment." with **Try again** and **Back**; no account call |
| `nopin` | any | any | `needs_pin`: the Grown-up area destination (setup) |
| `open` | no | — | sign-in screen |
| `open` | yes (this run's memory session) | — | the use's home |
| `pin`, epoch `0` | any | — | locked: `console.lock.pinRenew` with **Back** |
| `pin` | no | any | sign-in screen; a completed sign-in writes the trust (6.5, 7.3) and opens the home |
| `pin` | yes | absent | locked: `console.lock.firstSignIn` with **Sign in again** |
| `pin` | yes | differs from the epoch | locked: `console.lock.pinChanged` with **Sign in again** |
| `pin` | yes | equals the epoch | the use's home, when fresh (below) |

- **Freshness** (ND-5): on `pin`, an account screen entered from outside the account routes needs `lastPinTypedAt` or `lastAccountSignInAt` within `GROWN_UP_FRESH_PIN_MS`; otherwise `PinEntry { next: 'GrownUpUse', use }` runs first, in verify mode, **without the face or fingerprint button**. Moving between account screens inside the stack keeps the 15-minute session (OA-D5b). On `open`, no PIN is asked (there is none).
- `GrownUpUse { use }` (verify only; never creates or resets a PIN, CS-4) gains a native branch: after a typed PIN it opens the use's account screen, which `AccountGate` then decides. Cancel on the PIN screen returns to the chooser (or the Grown-up area), never to a learner.
- Each locked result emits `auth.native.lock { cause }`. A decision on focus that locks an open home hides its content at once (the same cover as 7.4) before showing the lock.
- [NS-0b] A locked result is one lock card (the lock glyph, the line, the buttons) under the ScreenHeader titled with the label of the row the grown-up pressed (`learner.who.use.*`, or **Grown-up account**), as the PIN screen titles itself; it shows no email, name or account data (D6).

### 7.3 The trust epoch, end to end

- Written at a native sign-in on a `pin` device with a real epoch (6.5); deleted at sign-out.
- **Re-trust after a PIN change** (R-1): when the device has a trust record for another epoch, or the OA-D21 record `account:pinResetByWait` is set, a sign-in writes the new trust only if it used the password or a second step; an email code alone signs in but leaves the lock with "This PIN changed since your last sign-in here. Sign in with your password to use it." and **Sign in again**. An account that has no password (its only first factor is the email code) re-trusts with the code; R-1 records that case. [NS-0b] D21: while a re-trust is pending (a trust record for another epoch, or `account:pinResetByWait`), **Continue** on the email step goes to the password step first when the account has a password, so **Sign in again** from the lock never sends a code that cannot re-trust; **Email me a code** stays offered.
- A new PIN (set, change, Rescue Code reset, the 24-hour wait) moves the epoch (existing), so the next account entry shows the locked line. The OA-D21 notice ("The grown-up PIN was changed after the 24-hour wait…") still shows at the next Grown-up area entry, and the account home shows its own notice once after a re-trust (8.2).
- A device whose PIN was created after a sign-in had no kept session (ND-9), so the next entry asks for one sign-in.
- The trust is device-local, never sent, and holds no account id.

### 7.4 The grown-up session around the account screens

The native account screens are routes of the **Grown-up area stack**, so every rule of AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 6.3 and 8.4 applies unchanged: arriving at the chooser, any change of learner, and leaving the stack for a learner screen (Back at its root when opened from the chooser goes to the chooser) close the session; 15 minutes from the PIN; 5 minutes in the background (`GROWN_UP_BACKGROUND_MS`, CS-14). In addition:

- `closeGrownUpSession` (`store/grown-up-session.ts`) calls `clearAccountQueries()`, which first cancels the `['account', …]` queries and aborts their requests, then removes them, so an answer already on its way cannot refill the cache (CS-N4). NS-2 moves the query client out of `App.tsx` into an exported module (`store/query-client.ts`) so the session code can reach it. The sign-in step machine resets, and on a device with no PIN the memory session ends (ND-9).
- **Screen capture** (CS-N12): while any account screen is focused, Android sets `FLAG_SECURE` (through `expo-screen-capture`, an added Expo module, NS-2), which keeps the content out of the recents thumbnail and blocks screenshots and screen recording. On iOS, a small config plugin adds a native cover view in `applicationWillResignActive` and removes it in `applicationDidBecomeActive`, shown only while a native flag the account screens set is on, so the app-switcher snapshot never shows the content; `expo-screen-capture` also blocks screen recording there. A JavaScript cover in `surface.canvas` on `AppState` change stays as a second layer. Device check D5 proves both platforms (assumption U7). [NS-0b] Both covers draw the app's own splash (`app.json` `splash.image` on `splash.backgroundColor`), nothing else, hidden from assistive tech (D12).
- The account screens are not reachable by the Android hardware Back from a learner screen (they are popped when the session closes, as OA-2 did for the area's routes).

---

## 8. Native grown-up homes

### 8.1 Screens and data

All screens are in `screens/account/` (native files), inside the Grown-up area stack and `AccountGate`, online only (ND-10). Every call goes through `logic/account/api.ts` (pure client: base `EXPO_PUBLIC_API_BASE_URL`, refused unless it is `https:` (a development build may use `http://localhost`); a fresh Clerk token per call from `getToken()`; the header `X-HR-Client: native`; `cache: 'no-store'`; redirects not followed with the bearer; a null token short-circuits to `unauthorized` like the console's `createConsoleApi`; any path under `/api/sync/` or `/api/recovery/` is refused), cached in memory by `@tanstack/react-query` under the `['account', …]` keys.

| Screen | Route params (memory only) | Data |
|---|---|---|
| `AccountHome` | `use: 'family' \| 'teacher' \| 'school' \| 'account'` | `GET /api/spaces`; for the Family home only, `GET /api/spaces/:id/roster` per family; `GET /api/billing/summary?view=status` (8.5) |
| `AccountSpace` | `spaceId` | `GET /api/spaces/:id/roster` (its `joinCode` when present); the status card when one exists |
| `AccountLearnerReport` | `spaceId`, `learnerId`, `period` | `GET /api/spaces/:id/learners/:learnerId/report?period=` |
| `AccountClassReport` | `spaceId`, `period` | `GET /api/spaces/:id/class-report?period=` |
| `AccountSchool` | `spaceId` | `GET /api/spaces/:id/school` (owner and admin only, 8.4), the status card |
| `SignIn` | `use?` | section 6 |

Ids live only in navigation params in memory; nothing builds a URL from them (there is none to build, 6.4). On a PIN device each successful `GET /api/spaces` rewrites the uses record.

**Order of every list** (anti-shame): learners by `joinedAt` ascending, then id; spaces live first, then archived, each group oldest first, as the console's homes. A pure helper (`logic/account/order.ts`) sorts on the client, whatever order the server sent (the roster route sorts by last activity, `spaces.ts:604`); no list is ever sorted by activity, minutes or progress.

### 8.2 Family home (`use: 'family'`)

- Every family space where the account's role is `owner` or `caregiver`, live ones first, then archived ones with `console.home.archived`. Per family: the family name as heading; one card per learner (8.1 order) with the learner's name, the last-active day (the console's words, `describeRelativeDay` with `common.time.*`; [NS-0b] D10: `console.space.learner.lastActive(when)`, or `console.parentHome.lastActive.notStarted` when the learner has no activity) and `console.parentHome.minutes7d(n)`, and **See report** (`console.parentHome.child.seeReport`).
- **Join code** (only when the server sends `joinCode`, which it does for `space.manage`): the code in large type with **Copy** (`console.joinCode.copy`, then `.copied`; `expo-clipboard`; refused: `console.parentHome.copyFailed`), and **Join on this device**. For a manager with no live code: **Make a code** (`console.confirm.issueCode`, `POST /api/spaces/:id/code`). Anyone else reads `console.parentHome.askOwner`. An archived family shows no code. A copied code is on the system clipboard (on iOS, Universal Clipboard may carry it to the account holder's other devices); it holds no name. [NS-0b] D11: the code is drawn in two groups of three that never break inside a group; if a group does not fit, it steps down to no less than the body size; it is read as `a11y.account.joinCode(code)` with the characters passed spaced (`K 7 M P Q 4`) so they are spelled out; **Copied** is a polite status for about 2 seconds. Mechanisms (review): the two groups are two `Text` elements in a wrapping row; `minimumFontScale` is iOS only, so the size floor is computed from the measured width on both platforms; Copied is announced with `announceForAccessibility` on iOS and `accessibilityLiveRegion="polite"` on Android.
- **Join on this device**: closes the grown-up session, holds the code in memory and leaves the stack exactly like a `join` boot intent (OA-D20): on a shared device the chooser opens with the `join` trigger and **Pick who is joining.**, and a family code on a device with 2 or more learners goes to Who is joining? (OA-D14); on a single-learner, unshared device Join opens prefilled; on a device with no learner, Welcome's first run keeps the code for Join, as the web hand-off does (F-APP-001 section 3.6). The F-SPACE-001 consent step is unchanged; a sign-in never joins anyone by itself (CS-N8).
- A family with no learner yet: `console.parentHome.empty.title` and the code panel (the web's line about another device is not shown; **Join on this device** is the action here).
- The plan block (8.5) under each family that has a status card (an archived family usually has none: then no block).
- **After a re-trust** (7.3), once, at the top: "The grown-up PIN on this device changed since your last sign-in here. If that wasn't you, change it in the Grown-up area." (no button: the Grown-up area is reached by Back when the home was opened from it, or from the chooser's Grown-up area row; [NS-0b] corrected, 7.4).
- No family (also the `account` use): `caregiver.account.home.noFamily` and the line of 8.6. No set-up button (ND-2).

### 8.3 Teacher home (`use: 'teacher'`) and class page

- The account's classes (role `owner` or `teacher`), grouped as the console's teacher home groups them (`console.kind.group.*`), live first, archived after; then the account's schools (role `owner`, `admin` or `teacher`) as rows. A class row: name, `console.spaceCounts.students(n)` (from the spaces item's `counts.learners`, no roster read), **Class report** (`console.home.classReport`), and the row opens `AccountSpace`. When the spaces item carries attention counts (AMENDMENTS-GROWNUP-UX section 12), one plain line `console.home.attention(n)` with no action (the line of 8.6 follows). [NS-0b] Accepted: the line names no place where the approval is done.
- `AccountSpace` for a class: **Class report** at the top ([NS-0b] D13: on a phone a teacher enters the class first), the roster's names (8.1 order) with **See report** each, the code panel when the roster carries `joinCode` (**Join on this device** as in 8.2; a class code keeps the one-learner flow of OA-D14 and OA-D20), and the plan block when a status card exists for the space.
- A school row opens `AccountSchool` for role `owner` or `admin`; for a school member with role `teacher` it is plain text with no link (the school page needs `space.manage`, `routes/school.ts:38`).
- No class and no school: `caregiver.account.home.noClass` and the line of 8.6.

### 8.4 School (`use: 'school'`)

- Opens the Teacher home with accessibility focus on its first school row (the native form of the web's `focus=school`). If the account no longer holds a school (a stale uses record), `caregiver.account.home.noSchool` shows above the Teacher home.
- `AccountSchool` (owner and admin only): the school name, its classes (each opens `AccountSpace`; a refusal shows `cantLoad` on that row), `caregiver.account.home.teachers(n)`, and the plan block. The usage line shows only when the status card carries `usage` (payers and school admins, F-BILL-002 section 4.2, AMENDMENTS-SEATS-ADMINS SA-D11).

### 8.5 The plan block (a fact, never an action)

- Data: `GET /api/billing/summary?view=status` (row NS-1): the same `BillingSummarySchema`, in which the Worker always sends `receipts: []`, `hasReceipts: false`, `legacyNoHistory: false`, `actions: { buy: null, manage: false, contact: false }`, `purchasesOpen: false`, `mode: 'none'` and `account: []`; the status view records no `billing.summary_viewed` (it is not a visit to the billing page, F-BILL-002 section 10) and answers `Cache-Control: no-store`. The native client always asks for `view=status`, and the Worker answers a request carrying `X-HR-Client: native` with the status view whatever the query says (9.4).
- Rendered by `nativePlanLines(card)` (pure, `logic/account/plan-lines.ts`), whose input type holds only `kind`, `coverage` and `usage` (never `actions`, `receipts`, `mode`, `purchasesOpen`, `payer` or `readOnlyReason`; a type test pins it):

| Coverage | Plan line | Second line |
|---|---|---|
| `free` | `console.billing.coverage.free` | none ([NS-0b] D20: a free plan's cap on a build where nothing can be bought reads as a limit to lift elsewhere) |
| `own`, status `active`, `trial`, `past_due` or `cancelled` | the plan's name: `console.billing.coverage.family`, `.license` or `.contract` | the usage line when present; never a renewal or end date, never a payment state |
| `own`, status `expired` | `console.billing.coverage.free` | none (D20) |
| `school`, with `expiresAt` | `console.billing.coverage.school(name)` ([NS-0b] D20: never the end date on native; for a school's own admin it is the contract's end, a date to act on) | — |
| `school`, without | `console.billing.coverage.school(name)` | — |

- The usage line: `console.billing.usage.learners`, `.students` and `.teachers` from `usage`. Legacy account cards are not shown on native. A space with no card shows no block. Nothing on the block is pressable; `nativePlanLines` never returns a date (unit test, D20). [NS-0b] D9: the block is one accessible element, `accessibilityLabel` `a11y.account.planBlock` and `accessibilityValue.text` the visible lines in order (a label alone on a container would hide the plan name; NS-5 checks TalkBack reads the value and otherwise leaves the block ungrouped on Android, so its two lines are read in order), drawn as plain text in a `surface.sunken` box with no border or chevron.

### 8.6 What is not here

At the bottom of every native home, one quiet line: **"Some grown-up tools aren't in this app."** No link, no place, no "web", no "computer", no "yet". The tools of ND-2's "Not in v1" list are not drawn as disabled buttons either (F-APP-001 section 3.8: an unbuilt item is not shown).

### 8.7 Reports

- `AccountLearnerReport` renders `learnerReport()` (`content-schema/src/reports/learner-report.ts`) over the route's answer through the blocks of the in-app report (`screens/parent/LearnerReportScreen.tsx`), split by NS-5 into a data-agnostic viewer (`screens/parent/report-blocks.tsx`) that both the in-app report and the account report use, with the `report.*` keys and the period switch (day, week, month, all) of F-REPORT-001; the in-app report's behaviour does not change.
- `AccountClassReport` renders `reports/class-report.ts` the same way, with no learner ranked or compared (F-REPORT-001).
- Both are in the 9.2 sweep.
- [NS-0b] D14: **left out on native**, for every viewer: the free-end line `report.insight.free_days_done` ("{name} finished the free lessons."; on a build where nothing can be bought, saying the free part is over is an indirect pointer to buying elsewhere, the reasoning of ND-8; the P4 slot shows nothing for `{ end: true }`), "Now on" and **Open Learning Route**, the line actions and **Preview lessons** (ND-2), the skills rows (device data); on the class report Send a note, Print, **Plan a lesson** and the homework plan link (its counts stay as text). Heritage cards stay as learning facts (figures, totals, `cards_new`), see 9.2. The filter lives in the account report's wrapper (it drops the P4 line whose code is `free_days_done`), not in the shared `report-blocks.tsx`, so the in-app report is unchanged; the same line on the native in-app report (`logic/reports/report-view.ts`) is handled by F-BILL-002 section 4.8 item 5 in #1022, which hides it on iOS and Android and keeps it on the web.

### 8.8 States

| State | What shows |
|---|---|
| loading | the screen's skeleton in tokens, no data |
| offline (or the network drops) | `caregiver.account.home.offline` with **Try again**; reloads by itself when the network returns |
| an error while online | `caregiver.account.home.cantLoad` with **Try again** |
| `401` (the session ended) | the records are deleted and the sign-in screen opens (6.6) |
| `403 native_off` (the Worker switch, 9.4) | `caregiver.account.home.unavailable` and **Back**; nothing else |
| `403` / `404` on one space | that space's card shows `cantLoad`; the others stay |

---

## 9. No billing on native

### 9.1 What never appears in a native build

Any control or call to action that buys, upgrades, subscribes, renews, manages, prices or refunds a plan, or shows a receipt or a promo code; a renewal or end date of the account's own plan, a payment state, or a "manages this plan" line; any address of hangulroute.com or app.hangulroute.com on a grown-up screen; any line that says a thing can be done in a browser, on a computer, on a website, in the console, or that names where accounts are made. Plan names and the school coverage line of 8.5 (without a date, D20) are the only plan words. The Plan screen keeps F-BILL-002 section 4.7's native rules.

### 9.2 Deny-list render tests (NS-3 to NS-7)

Every state of every screen and card of this spec (sign-in steps and errors, lock lines, account card signed in, out and locked, chooser and Welcome rows, every home with every role, both reports, every plan-block row of 8.5, every empty, offline, error and unavailable state) is rendered with `Platform.OS` mocked as `ios` and as `android`, in **en, es and ko**, with fixture names; the text tree **and** every `accessibilityLabel` and `accessibilityHint` are scanned:

- **Words** (word-bounded, case-insensitive), en: `buy`, `purchase`, `price`, `cost`, `upgrade`, `subscribe`, `subscription`, `renew`, `manage`, `trial`, `refund`, `invoice`, `checkout`, `receipt`, `promo`, `billing`, `payment`, `pay`, `credit card`, `debit card`, `gift card`, `prepaid card`, `card number`, `card details`, `card on file`, `add a card`, `update your card`, `declined`, `premium`, `unlock`, `web`, `website`, `browser`, `console`, `computer`, `laptop`, `desktop`, `Stripe`, `App Store`, `Google Play`, `sign up`, `create an account`, `free lessons`; es: `comprar`, `compra`, `precio`, `costo`, `mejorar`, `suscrib`, `renov`, `gestion` (these three as stems), `prueba gratis`, `reembolso`, `factura`, `recibo`, `promo`, `facturación`, `pago`, `pagar`, `tarjeta de crédito`, `tarjeta de débito`, `tarjeta regalo`, `tarjeta de regalo`, `tarjeta prepago`, `número de tarjeta`, `datos de la tarjeta`, `agregar una tarjeta`, `añadir una tarjeta`, `lecciones gratuitas`, `premium`, `desbloquear`, `web`, `sitio`, `navegador`, `consola`, `computadora`, `ordenador`, `regístrate`; ko: `구매`, `결제`, `가격`, `요금`, `업그레이드`, `구독`, `갱신`, `환불`, `청구`, `영수증`, `프로모`, `신용카드`, `체크카드`, `기프트카드`, `선불카드`, `카드번호`, `카드결제`, `카드등록`, `카드변경`, `상품권`, `무료레슨`, `유료`, `프리미엄`, `잠금 해제`, `웹`, `사이트`, `브라우저`, `콘솔`, `컴퓨터`, `가입`.
- [NS-0b] D15: the card words are payment-card phrases, not the bare word: the account reports reuse `report.*`, which counts heritage cards in every language (`report.figure.cards`, `report.detail.totals` "…, 1 card", `report.insight.cards_new`, `report.class.cardsNew`; ko `새 카드`), so `card`, `tarjeta` and `카드` would fail the reports. D14 adds the free-lessons phrases. Matching ([NS-0b] review): en and es words are bounded by letters and every word of a phrase takes an optional plural ending (`s`, `es`), so "credit cards" and "tarjetas de crédito" match, es stems are bounded at the start only, and ko is matched as a substring with every space removed from both the text and the word, so spacing variants match. `카드 정보` is not on the list: the shipped heritage-card detail pane (`learner.panes.detail`) says it.
- **Symbols** (substring): `$`, `€`, `£`, `₩`, `USD`, `hangulroute.com`, `http`, and a digit followed by `원`.
- No pressable in the tree opens a URL (the test spies on `Linking.openURL` and `platform/external-link`).
- Names typed by grown-ups (a space or school name) are not checked by any test; the fixtures cover the app's own words.

NS-2 moves the Plan screen's inline list (`PaywallScreen.test.tsx:80`) and this one into one module, `logic/account/deny-list.ts`, so both grow together.

### 9.3 Import guard (NS-2)

A unit test reads every file under `apps/mobile/src/screens/account/**` and `apps/mobile/src/logic/account/**` and fails on an import of `platform/billing-handoff`, `platform/external-link`, `logic/paywall`, `react-native`'s `Linking`, `expo-web-browser`, `react-native-webview`, Clerk's `useSignUp`, `SignUp` or any OAuth hook, and on the strings `APP_ROUTES.billing`, `/api/entitlements/stripe` and `/api/billing/receipt`. It also fails when a file outside those folders and `platform/clerk*.native.*` imports `@clerk/clerk-expo`.

### 9.4 Worker guard and switch (NS-1, defence in depth)

- **Money routes**: a request that carries `X-HR-Client: native`, **or** (in production) a verified Clerk token with no `azp` (only a non-browser client mints one, `auth.ts`), is refused on `POST /api/entitlements/stripe/checkout`, `/stripe/portal`, `/stripe/promo`, `GET /api/billing/receipts` and `POST /api/billing/receipt-link` with `403 not_in_app`, before step-up, the live guard or any Stripe call; `GET /api/billing/summary` answers either with the status view (8.5). Webhooks are untouched. The header is our own app's statement, not an authentication; the token rule catches a native call that forgot it. Kill switch `NATIVE_MONEY_GUARD` (Worker variable, on; `false`, `0`, `off` or `disabled` turns the refusals off, never the status view). Assumption U8 (browser tokens always carry `azp`) is checked by device check D14 on the web before NS-8.
- **Account switch**: `NATIVE_ACCOUNT` (Worker variable, on): off, every `/api/spaces*` and `/api/billing*` request carrying `X-HR-Client: native` answers `403 native_off` (8.8), so installed builds lose the homes at once if a kill criterion fires (section 1). The web is untouched.
- **No caching**: `GET /api/billing/summary` answers `Cache-Control: no-store`, and NS-1 confirms `GET /api/spaces` itself (not only `/api/spaces/*` paths) carries it, adding it if not.
- Tests: each money route refuses with the header and with an `azp`-less token and is unchanged for a browser token; the summary with the header has no receipt row, no amount and no action, whatever the query; `NATIVE_MONEY_GUARD` off; `NATIVE_ACCOUNT` off.
- **As built in NS-1** (its two reviews): the `azp` rule applies wherever a Clerk key is bound (production, preview and test; the dev fallback has no token, so there only the header counts); the raw entitlement list `GET /api/entitlements` (Stripe customer and subscription ids, payment states, end dates) is a money route too; `NATIVE_ACCOUNT` off also refuses a token with no `azp` on `/api/spaces*` and `/api/billing*` and answers `no-store`; any value but `enabled`, `on`, `true` or `1` (not text included) is off, while for `NATIVE_MONEY_GUARD` only the off words turn the refusals off. The status view of 8.5 also sends `payer: false`, `readOnlyReason: null` and, on `own` coverage, `expiresAt: null`, `endsAtPeriodEnd: false` and a status of `active` (or `expired`), so a client slip can never show a payment state, an own end date or a "manages" line (9.1); the plan lines of 8.5 read the same.

---

## 10. Child safety (tests in section 20 name these)

| # | Invariant |
|---|---|
| CS-N1 | No learner screen renders the sign-in, an account name or email, or any Clerk element; `ClerkProvider` is mounted only while the Grown-up area stack is (render test of the learner roots with the module spied). |
| CS-N2 | Every account screen sits in `AccountGate`, which decides on mount, focus and return to `active`: on a `pin` device it needs a PIN typed within 2 minutes or a native sign-in within 2 minutes, plus the trust rule; an `open` device needs this run's sign-in; `nopin` and `unknown` never open one. An open 15-minute session alone never opens one from the chooser or the Grown-up area card. |
| CS-N3 | A PIN changed since the last native sign-in (any path) never opens an account screen; epoch `0` is never trusted; a failed trust read is no trust; a re-trust after a change needs the password or a second step when the account has a password (7.3). |
| CS-N4 | Closing the grown-up session (chooser, learner change, leaving the stack, 15 minutes, 5 minutes in the background) cancels and clears the account queries, resets the sign-in steps and ends a no-PIN device's session; reopening asks the gate again. |
| CS-N5 | No native screen shows a purchase, price, renewal, manage or billing control or text, in any language (9.1, 9.2); the import guard (9.3) and the Worker guard (9.4) hold. |
| CS-N6 | No URL scheme, link, notification or boot intent opens a native account screen; the only ways in are the rows of 7.1 (config test over `app.json`). |
| CS-N7 | Clerk's items live only in SecureStore service `hr.clerk`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, indexed, and only on a PIN device; never in AsyncStorage, logs, crash reports, telemetry or backups; a fresh install deletes them before anything reads them, and the install record is written only after the deletes succeed; an Android restore comes back signed out. |
| CS-N8 | Signing in never registers, joins or links a device learner, never changes a learner's tier, and never sends learner data with the account token; the account client refuses `/api/sync/*` and `/api/recovery/*`, and no device secret is sent on an account route. |
| CS-N9 | Chooser and Welcome rows show only generic labels (CS-7, with **Grown-up account**); the signed-in email appears only inside the Grown-up area stack and only past the gate, with a typed PIN or a native sign-in within the last 2 minutes ([NS-0b]: never after face or fingerprint alone). |
| CS-N10 | No account can be created on native, and nothing says where one is made (no sign-up step, import guard, deny list). |
| CS-N11 | Face or fingerprint never opens an account screen, never stands in for the sign-in, never writes the trust record and never counts as a typed PIN. |
| CS-N12 | No account screen's content reaches the app switcher, a screenshot or a screen recording (7.4). |
| CS-N13 | With `EXPO_PUBLIC_NATIVE_SIGNIN` off, or no valid publishable key, a native build behaves exactly as at the basis: Grown-up area only, no Clerk. |
| CS-N14 | A device with no PIN keeps no session: the Welcome row and every row there lead to a sign-in each time; a profile-read failure at boot (the app looks empty and shows Welcome) reads as `unknown` and opens nothing. |
| CS-N15 | A crash on an account route sends `app.crash` with `message: ''` (only the route and error class names), so no name or code from an account screen leaves the device. |

---

## 11. Sync and ownership

- **F-AUTH-001 and F-AUTH-003 rules, as they stand today.** The legacy routes those specs gated are unmounted (their header notes, audit SEC-1 to SEC-3); ownership now lives in the space routes (`requireAccount`, `can(actor, action, space)`, F-SPACE-001, AMENDMENTS-SEATS-ADMINS). The native app calls those routes with the same Clerk bearer the console sends and gets exactly the console's answers: only `space.manage` gets a join code, a school member with role `teacher` gets no school page, a school teacher gets no seat counts. **No server rule changes** for native requests except 8.5 and 9.4.
- **The Worker accepts native tokens.** A Clerk token minted by the Expo SDK carries no `azp` origin, and `auth.ts` checks such a token for signature and expiry only (section 3). NS-1 adds a Worker test for an `azp`-less token on `GET /api/spaces`, and device check D11 confirms it against production; if a native token ever carries an `azp`, the native rows stay off until the allow-list rule is amended (assumption U2).
- **Two principals, never mixed.** Learner sync stays device-authenticated (`Device <deviceId>:<secret>`, F-SYNC-001); the account token is attached only by `logic/account/api.ts`, which refuses sync and recovery paths (test). The sync client never reads Clerk.
- **No automatic linking.** Being signed in does not make a device learner a member of anything; joining stays Join or Who is joining? with its consent (verifiable parental consent before personal data is linked to an account, CLAUDE.md section 1). A learner's tier on the device keeps coming from the inbox (F-ENT-001); `signedInAccount()` (`platform/device-account.ts`) stays `null` on native, since F-ENT-003 keeps native store builds ungated and its dashboard line is about buying. F-AUTH-001 and F-AUTH-002 once reserved F-AUTH-004 for "sending the token on requests" from the sync and restore paths; this spec deliberately keeps the token off them.
- **Reports read the server**: a native account report is the consented roster projection the console reads (`roster-summary.ts`), not the device's local snapshot; the Grown-up area's existing on-device reports are unchanged.

---

## 12. Offline

- Learner use is untouched: the chooser, tiles, the PIN, the Grown-up area and every local tool work offline as today, and Clerk never runs for them (ND-11).
- Account rows on the chooser, Welcome and the account card are disabled offline with **Needs the internet**; the account card's **Sign out** stays enabled (6.6); the sign-in screen disables its submit buttons (6.3); open homes show the offline panel and reload on reconnect (8.8).
- Nothing of the account is stored for offline use (ND-10). The uses record lets the chooser draw its rows offline (disabled), without names.
- A wall-clock change can only make the 2-minute freshness and the 5-minute background rule stricter or end the session early; it never opens a screen (comparisons, as AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 12).

---

## 13. Data model

### 13.1 On the device (all additive)

| Key or item | Where | Contents | Written | Deleted |
|---|---|---|---|---|
| SecureStore service `hr.clerk` (PIN devices only) | `platform/clerk-token-cache.native.ts` | Clerk's token cache items and the index `hr.clerk.index` | by Clerk through the adapter | sign-out, install sweep, `401`, a non-PIN gate state, an unreadable item |
| memory token cache (other devices) | the same adapter | Clerk's items for this run | by Clerk | session close, app close |
| `hr:grownup:deviceUses` (PIN devices only) | storage wrapper (`grownup:deviceUses`) | `DeviceUsesSchema` `{ v: 1, uses, at }`, no names, no ids; read as "no record" after `DEVICE_USES_TTL_MS` (30 days) | 6.5 and every `GET /api/spaces` | sign-out, `401` |
| `hr:grownup:trust` | storage wrapper (`grownup:trust`) | `AccountTrustSchema` `{ v: 1, epoch }` (a positive integer) | 6.5 and 7.3 on a `pin` device | sign-out, `401` |
| `hr:grownup:retrustNotice` | storage wrapper | `{ v: 1, at }` | a re-trust (7.3) | after the home showed it once |
| `hr:grownup:installed` | storage wrapper (`grownup:installed`) | `{ v: 1, at }` | the install sweep, after its deletes | never (app data) |
| `ui-store.lastAccountSignInAt` | memory | epoch ms | 6.5 | session close |

- `platform/device-uses.ts` (native) reads `grownup:deviceUses` when `nativeAccountEnabled`, and keeps returning `[]` otherwise. These keys are device-level: they never end in a profile id, so Remove from this device (OA-7a) leaves them, and learner backups never carry them.

### 13.2 Shared schemas and constants (content-schema)

- `AccountTrustSchema` (`schemas/app-shell.ts`, beside `DeviceUsesSchema`).
- `NATIVE_AUTH_TELEMETRY_PAYLOADS` (section 15) and the names appended to `TELEMETRY_EVENT_NAMES`; `who.picked.use` gains `'account'`.
- `NATIVE_CLIENT_HEADER = 'X-HR-Client'`, `NATIVE_CLIENT_VALUE = 'native'`.

### 13.3 Server

No D1 migration, no new route. `GET /api/billing/summary` gains the `view=status` query, the header and token rule, and `no-store`; the money routes gain the guard; account routes gain the `NATIVE_ACCOUNT` switch for native requests; `keptEventFields` gains the payload rules; `isDailyCountedName` counts the new names.

---

## 14. Accessibility

- Every control at least `touchTarget.min`; Welcome's button at least `touchTarget.min` and outlined; text sizes Standard to Largest (DN) without truncating a name or a code (the code wraps by groups, never shrinks below the body size).
- Fields have visible labels (not placeholders), the right `textContentType` and `autoComplete` (6.3), and errors are announced (`AccessibilityInfo.announceForAccessibility`) and tied to the field (`accessibilityHint`). The code field reads digits one by one. [NS-0b] Mechanism: the code field's `accessibilityValue.text` is its digits spaced; device check D9 (VoiceOver) and D10 (TalkBack) confirm it. If a platform's text field ignores it (iOS fields report their own value), the field's `accessibilityHint` carries the spaced digits after the label's hint, and otherwise reading the code as one number is accepted.
- Reading order on a home: heading, space sections in order, the plan block, the quiet line, Sign out. The plan block is plain text, never a button.
- Status never by colour alone; no danger colour on any account screen, the Sign out ConfirmSheet included ([NS-0b] D8: signing out loses nothing, so its confirm is the primary fill, as every other ConfirmSheet without a loss).
- The covers are `accessibilityElementsHidden` and never announced.
- Reduced motion: no transitions beyond the stack's default.

---

## 15. Telemetry (Worker first, no PII)

New names go into `TELEMETRY_EVENT_NAMES` (append-only) and the Worker's rules (`NATIVE_AUTH_PAYLOAD_RULES` in `server-events.ts`, checked in `keptEventFields` beside `OA_PAYLOAD_RULES`) in row NS-1, before any client sends them. Each is stored without `profileId`, keeps only the keys and values below (anything else dropped, whatever the client sends) and is counted in `telemetry_daily`.

| Event | Payload | When | Row |
|---|---|---|---|
| `auth.native.signin` | `{ os: 'ios' \| 'android', method: 'none' \| 'email_code' \| 'password', result: 'ok' \| 'wrong_code' \| 'wrong_password' \| 'expired' \| 'refused' \| 'too_many' \| 'unsupported' \| 'offline' \| 'error' \| 'cancelled', second: boolean }` | **once per sign-in flow**, when it ends: `ok` on completion; otherwise, when the screen is left, the flow's last result (`cancelled` when it had none); `method` is the factor of the last attempt, `none` before one; `second` is true when a second step or device check was asked | NS-3 |
| `auth.native.signout` | `{ os, via: 'user' \| 'lock' }` | Sign out confirmed; Sign in again on a lock | NS-3 |
| `auth.native.lock` | `{ os, cause: 'unknown' \| 'needs_pin' \| 'epoch_zero' \| 'no_trust' \| 'pin_changed' \| 'retrust_password' }` | each locked decision of 7.2 and 7.3, at most once per screen mount | NS-4 |
| `auth.native.home` | `{ os, use: 'family' \| 'teacher' \| 'school' \| 'account', spaces: '0' \| '1' \| '2-4' \| '5+' }` | once per `AccountHome` mount, after its first successful load | NS-5, NS-6 |

The existing `who.picked { kind: 'grown_up', use }` (with `use: 'account'` added) and `parent.gate.opened { dest: 'use', via }` are emitted by the native rows exactly as by the web's. No email, account id, space id, learner id, code, period or error text is ever sent; `app.crash` from an account route carries an empty message (CS-N15). Clerk's own SDK telemetry is off (6.1).

---

## 16. Rollout, kill switches and owner steps

### 16.1 Switches

| Switch | Where | When its row lands | After NS-8 | Off means |
|---|---|---|---|---|
| `EXPO_PUBLIC_NATIVE_SIGNIN` | native build (`parseKillSwitch`) | off | **on** | CS-N13: Grown-up area only, no Clerk |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | native build (a public key) | unset | set by the owner (O-3) | as off |
| `NATIVE_ACCOUNT` | Worker | on | on | every account route refuses the native app (`403 native_off`); installed builds show "not available" |
| `NATIVE_MONEY_GUARD` | Worker | on | on | money routes stop refusing native requests (the status view stays) |
| `TELEMETRY_DAILY` | Worker (existing) | on | on | no counters |

Order: NS-1 reaches production first (names, rules, the status view, the guard and the switch before any native client sends a request). Every client row ships dark. NS-8 flips the default after the device checks. Rollback: `NATIVE_ACCOUNT` off at once, then the build switch off in the next build; no data needs repair (the records are ignored when the switch is off). Native builds are made with Xcode for iOS and Gradle for Android (the project's standing choice); `EXPO_PUBLIC_*` values are read when Metro bundles, so they are set in the build environment, never committed.

### 16.2 Owner steps (dashboard and devices only; each with a default timing)

| # | Step | Default timing |
|---|---|---|
| O-1 | Clerk Production instance: turn on the **Native API** (native applications); confirm the email verification code is an allowed sign-in factor (the web's `/signin` offers it first); record whether Device Trust (new-device check) is on, and the session lifetime (for R-2). | before device check D1 |
| O-2 | Clerk: leave password sign-in as the instance has it; native offers a password only to an account that has one. | none (no change) |
| O-3 | Native build environment: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (the same `pk_live_` key as the web) and `EXPO_PUBLIC_API_BASE_URL`; `EXPO_PUBLIC_NATIVE_SIGNIN` only for the device-check build until NS-8. | before D1 |
| O-4 | App Store Connect App Privacy and Google Play Data safety: add Email address and User ID (collected, linked to the user, app functionality, not tracking); assess what Clerk collects per session (IP address, device and user-agent data) and a phone number where a text-message second step is used; check the Play target-audience answers against the Families policy. | before the first TestFlight external or store submission with the switch on |
| O-5 | App Review demo account: a grown-up on the **production** Clerk instance with a password, holding one family and one class with sample learners in the Stripe sandbox; credentials and these review notes in App Review Information: "Tap Sign in as a grown-up on the first screen, then Use my password. Grown-up accounts are made by families and schools outside the app." **Device check D13 must pass on a fresh install**: if Clerk's new-device check asks this account for an emailed code, the owner chooses, at submission time only, between Device Trust off for the instance (it applies to the web too) and another review path; this is the one owner decision this spec leaves, and it gates only a store submission, no row. | same as O-4 |
| O-6 | Device checks D1 to D14 (section 20.2) on an iPhone (Xcode build), an Android phone and a desktop browser (D14). | gates NS-8 |

Release rule unchanged: no public store release before F-IAP-002 (F-BILL-002 OD-5).

---

## 17. Strings (en, es, ko)

Drafts. es neutral, "tú"; ko 해요체, no particle attached to a variable (colon forms where a value leads). Glossary from AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 17: grown-up 어른 / adultos (persona adulta); Grown-up area 어른 공간 / Zona de adultos; learner 학습자 / estudiante; Family 가족 / Familia; Teacher 선생님 / Docente; School 학교 / Escuela; sign in 로그인 / iniciar sesión or entrar (MAR aligns with the console's es). Each row's MAR may improve them. Every `cta` fits the 28-character budget and every es value fits `length-budget.test.ts` (at most the larger of 8 and 1.5x the English length), unless the row adds an allow-list entry with its reason. No string says "yet", "soon" or "coming" (Guideline 2.1). [NS-0b] D16: the rows marked (cta) land as `{ cta }` objects (`caregiver.account.signIn.submit.cta`, `.resend.cta`, …, `home.joinHere.cta`), as `console.lock.signInAgain.cta` does, so `length-budget.test.ts` holds them to 28 characters; every row of 17.1 to 17.4 fits its budget in en, es and ko (measured in `design/screens/account/README.md`).

### 17.1 Sign-in (`caregiver.account.signIn.*`, `caregiver.account.errors.*`, NS-3)

| Key | en | es | ko |
|---|---|---|---|
| `signIn.title` | Grown-up sign-in | Acceso para adultos | 어른 로그인 |
| `signIn.intro` | Sign in with the grown-up account of your family, class or school. | Inicia sesión con la cuenta de adulto de tu familia, clase o escuela. | 가족, 반, 학교에서 쓰는 어른 계정으로 로그인해 주세요. |
| `signIn.learners` | Learners don't need an account. | Los estudiantes no necesitan cuenta. | 학습자는 계정이 필요 없어요. |
| `signIn.noNewAccounts` | This app doesn't make new grown-up accounts. | Esta app no crea cuentas nuevas de adulto. | 이 앱에서는 새 어른 계정을 만들지 않아요. |
| `signIn.email` | Email | Correo | 이메일 |
| `signIn.codeSent(email)` | We sent a 6-digit code to {email}. | Enviamos un código de 6 dígitos a {email}. | 6자리 코드를 보냈어요: {email} |
| `signIn.deviceCheck` | We sent a code to check this new device. | Te enviamos un código para verificar este dispositivo nuevo. | 새 기기 확인 코드를 보냈어요. |
| `signIn.code` | Code | Código | 코드 |
| `signIn.password` | Password | Contraseña | 비밀번호 |
| `signIn.secondStep` | Enter the code from your second sign-in step. | Escribe el código de tu segundo paso de acceso. | 2단계 인증 코드를 입력해 주세요. |
| `signIn.submit` (cta) | Sign in | Entrar | 로그인 |
| `signIn.resend` (cta) | Send a new code | Enviar otro código | 새 코드 보내기 |
| `signIn.usePassword` (cta) | Use my password | Usar mi contraseña | 비밀번호로 로그인 |
| `signIn.useCode` (cta) | Email me a code | Enviarme un código | 이메일로 코드 받기 |
| `signIn.useBackup` (cta) | Use a backup code | Usar código de respaldo | 백업 코드 사용하기 |
| `signIn.changeEmail` (cta) | Use another email | Usar otro correo | 다른 이메일 사용하기 |
| `errors.wrongCode` | That code didn't work. Check it and try again. | Ese código no funcionó. Revísalo e inténtalo de nuevo. | 코드가 맞지 않아요. 확인하고 다시 해 보세요. |
| `errors.codeExpired` | That code has expired. Send a new code. | Ese código ya no sirve. Pide otro código. | 코드 유효 시간이 지났어요. 새 코드를 받아 주세요. |
| `errors.wrongPassword` | That password didn't work. Check it and try again. | La contraseña no funcionó. Revísala e inténtalo de nuevo. | 비밀번호가 맞지 않아요. 확인하고 다시 해 보세요. |
| `errors.cantSignIn` | We couldn't sign in with that email. | No pudimos iniciar sesión con ese correo. | 그 이메일로는 로그인할 수 없었어요. |
| `errors.tooMany` | Too many tries. Wait a few minutes, then try again. | Demasiados intentos. Espera unos minutos y reinténtalo. | 너무 많이 시도했어요. 몇 분 뒤에 다시 해 보세요. |
| `errors.unsupported` | This account needs a sign-in step this app doesn't have. | Esta cuenta necesita un paso de acceso que esta app no tiene. | 이 계정에는 이 앱에 없는 로그인 단계가 필요해요. |
| `errors.generic` | Can't sign in right now. Try again in a moment. | Ahora no se puede iniciar sesión. Reinténtalo en un momento. | 지금은 로그인할 수 없어요. 잠시 뒤에 다시 해 보세요. |

Reused: `common.buttons.continue`, `common.buttons.cancel`, `learner.welcome.grownUps.needsInternet`.

### 17.2 Gate, account card and sign-out (`caregiver.account.lock.*`, `.card.*`, `.signOut.*`, NS-3, NS-4)

| Key | en | es | ko |
|---|---|---|---|
| `lock.cantCheck` | Can't check this device right now. Try again in a moment. | Ahora no podemos verificar este dispositivo. Reinténtalo en un momento. | 지금은 이 기기를 확인할 수 없어요. 잠시 뒤에 다시 해 보세요. |
| `lock.retrustPassword` | This PIN changed since your last sign-in here. Sign in with your password to use it. | Este PIN cambió desde tu último acceso aquí. Inicia sesión con tu contraseña para usarlo. | 지난번 로그인한 뒤에 어른용 PIN이 바뀌었어요. 쓰려면 비밀번호로 로그인해 주세요. |
| `card.title` (also the chooser row of an account with no space) | Grown-up account | Cuenta de adulto | 어른 계정 |
| `card.signedOut` | Sign in to see your family, classes and school here. | Inicia sesión para ver aquí tu familia, tus clases y tu escuela. | 로그인하면 여기서 가족, 반, 학교를 볼 수 있어요. |
| `signOut.ask` | Sign out of this account on this device? | ¿Salir de esta cuenta en este dispositivo? | 이 기기에서 이 계정을 로그아웃할까요? |

Reused: `console.lock.pinChanged`, `.firstSignIn`, `.pinRenew`, `.signInAgain.cta`; `console.shell.signOut.cta`; `console.billing.help.sharedDevice`; `console.adminInvite.signedInAs(who)`; `caregiver.pin.needsPinFirst`; `learner.who.use.*` (row labels); `learner.welcome.grownUps.lead`; `common.buttons.back`, `common.buttons.tryAgain`. (`console.lock.pinRenew` says "set it again in the app", which reads true inside the app.)

### 17.3 Homes (`caregiver.account.home.*`, NS-5, NS-6)

| Key | en | es | ko |
|---|---|---|---|
| `home.noFamily` | This account has no family space. | Esta cuenta no tiene espacio familiar. | 이 계정에는 가족 공간이 없어요. |
| `home.noClass` | This account has no class. | Esta cuenta no tiene ninguna clase. | 이 계정에는 반이 없어요. |
| `home.noSchool` | This account has no school. | Esta cuenta no tiene escuela. | 이 계정에는 학교가 없어요. |
| `home.moreTools` | Some grown-up tools aren't in this app. | Algunas herramientas de adultos no están en esta app. | 어른용 도구 중 일부는 이 앱에 없어요. |
| `home.joinHere` (cta) | Join on this device | Unirse en este dispositivo | 이 기기에서 참여하기 |
| `home.codeLabel.family` | Family code | Código familiar | 가족 코드 |
| `home.codeLabel.class` | Class code | Código de clase | 반 코드 |
| `home.teachers(n)` | Teachers: {n} | Docentes: {n} | 선생님: {n}명 |
| `home.retrustNotice` | The grown-up PIN on this device changed since your last sign-in here. If that wasn't you, change it in the Grown-up area. | El PIN de adultos de este dispositivo cambió desde tu último acceso aquí. Si no fuiste tú, cámbialo en la Zona de adultos. | 지난번 로그인한 뒤에 이 기기의 어른용 PIN이 바뀌었어요. 직접 바꾼 게 아니면 어른 공간에서 바꿔 주세요. |
| `home.offline` | You're offline. These pages need a connection. | No tienes conexión. Estas páginas la necesitan. | 오프라인이에요. 이 페이지는 인터넷이 필요해요. |
| `home.cantLoad` | Can't load this right now. | No se puede cargar ahora. | 지금은 불러올 수 없어요. |
| `home.unavailable` | This isn't available right now. | Esto no está disponible ahora. | 지금은 쓸 수 없어요. |

Reused: `console.confirm.issueCode` (**Make a code**, [NS-0b]: the shipped value in all three languages, instead of a new `home.makeCode` row), `console.parentHome.minutes7d(n)`, `.child.seeReport`, `.askOwner`, `.copyFailed`, `.empty.title`; `console.joinCode.copy`, `.copied`; `console.home.classReport`, `.archived`, `.attention(n)`; `console.spaceCounts.students(n)`; `console.kind.group.*`; `console.billing.coverage.*`, `.usage.*`; `report.*`; `common.time.*`; `common.buttons.tryAgain`. Every reused value passes the deny list of 9.2 in all three languages (the test renders them).

### 17.4 Accessibility (`a11y.account.*`)

| Key | en | es | ko |
|---|---|---|---|
| `codeField` | Sign-in code, 6 digits | Código de acceso, 6 dígitos | 로그인 코드, 6자리 |
| `joinCode(code)` | Code {code}. Copy it to share. | Código {code}. Cópialo para compartir. | 코드: {code}. 복사해서 알려 주세요. |
| `planBlock` | Plan for this space | Plan de este espacio | 이 공간의 플랜 |

---

## 18. Risks, accepted risks and unverified assumptions

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| App Review reads a plan name or the school coverage line as steering | medium | a rejection | the block is a fact with no date to act on, no "manage", no action (ND-8); a rejection fires the kill criteria, and the fix drops the block (the rest of the homes stays) |
| 3.1.3(c) does not cover a licence a teacher bought by self-serve checkout | medium | a review question at public release | inherited from F-BILL-002; NS-8 adds the question to F-BILL-002 and F-IAP-002 before any public release |
| A future console feature is ported to native with a price or a link | medium | 3.1.1 breach | deny-list render tests in three languages, the import guard, the Worker guard (section 9) |
| A shared tablet stays signed in for weeks | medium | a child near the account | kept only behind a typed PIN, trust epoch, 5-minute background rule, capture protection, shared-device hint (sections 6, 7) |
| Clerk Expo SDK and Expo 52 or the new architecture disagree | medium | NS-2 blocked | pin the version in NS-2; NS-2's first commit is a device smoke build; a mismatch blocks NS-2 only |
| Clerk's new-device check asks the review account for an email code | medium | Guideline 2.1 rejection | O-1 records the setting; D13; the O-5 decision |
| Email-code delivery is slow or filtered | medium | NG2 drops | **Send a new code**, password where the account has one; NG2 kill criterion |
| Clerk's error codes or statuses change | low | wrong lines | unknown codes fall to `generic`, unknown statuses to `unsupported`; the mapping has a table test |
| Reinstalled iOS app inherits a sign-in | medium without the sweep | a child signed in | indexed sweep before any read, install record only after it (CS-N7), D7 |

Accepted risks: **R-1** (section 2: an email code on a device where the inbox is open); **R-2** (a sign-out made offline leaves the Clerk session valid on Clerk's side until its lifetime ends, O-1 records the lifetime; the device holds no token any more; a remote revoke is F-AUTH-005's).

Unverified assumptions (each checked by the row named; a failure stops that row, never the web):

- **U1** `@clerk/clerk-expo` has a release that runs on Expo SDK 52, React Native 0.76 and React 18.3 (NS-2 records the version, its status names and token-cache keys, and a device smoke build).
- **U2** Tokens from the Expo SDK carry no `azp`, or one the Worker accepts (NS-1 test with an `azp`-less token; D11 against production).
- **U3** The production instance offers the email code as a first factor to accounts made with Google (D1 with such an account).
- **U4** The pinned `expo-secure-store` has the Android backup exclusion option (NS-2; else a config plugin with backup rules).
- **U5** iOS `oneTimeCode` autofill offers the emailed code from Mail on recent iOS versions (D1; without it the grown-up types it).
- **U6** Clerk's new-device check (Device Trust), when on, asks native clients for a code the step machine handles (NS-3 test against the pinned SDK; D2 and D13).
- **U7** The iOS native cover and Android `FLAG_SECURE` keep account content out of the app switcher (D5 on both platforms).
- **U8** Every browser token from the console carries `azp`, so the token rule of 9.4 never refuses the web (D14: the sandbox checkout still opens on the web billing page).

---

## 19. Edits to other specs

Applied in this PR (NS-0, the OA-11 row):

| Spec | Section | Change |
|---|---|---|
| AMENDMENTS-ONE-ACCOUNT-MANY-USERS | standing rules, 0, 6.1 item 4, 21, 22 (OA-11), 23 (OQ-19), 24 | points at this spec; OA-11 done; native rows arrive with NS-4 and turn on in NS-8; section 0's list of native Grown-up area tools no longer names Lecture mode (web only, `LectureCard.tsx:136`) |
| F-APP-001 | header note; OD-6; section 4 | [AU] note: native builds get grown-up sign-in and native homes (not the console) under F-AUTH-004; OD-6 "Hidden until F-AUTH-004" holds until NS-8 |
| F-AUTH-001 section 4, F-AUTH-002 section 4 | the F-AUTH-004 pointers | [AU] notes: F-AUTH-004 is written; it keeps the account token off the sync and restore paths |
| `docs/specs/README.md` | index | this spec, and an "amended by F-AUTH-004" line under F-APP-001 |

Landing with the rows named:

| Spec or doc | Change | Row |
|---|---|---|
| AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 9 | CS-4's `nopin` path differs on native (ND-7); CS-7's labels gain **Grown-up account**; section 8.6's warning gains that face or fingerprint never opens the account | NS-4 |
| F-APP-001 sections 3.6, 3.9 ("The learner app never reads the Clerk session…"), 3.10, 3.17 ("Native builds show no grown-up entry"), AD-1 item 5, OD-2 ("may later link … under F-AUTH-004": now out of scope), OD-6 (closed) | [AU] notes for the native account | NS-8 |
| F-BILL-002 section 4.8 | the native rule extends to every grown-up screen; the 3.1.3(c) question for self-serve licences | NS-8 |
| `docs/blueprints/10-app-map.md` | `account/sign-in` (native), `account/home`, `account/space`, `account/report`, `account/school` | NS-8 |
| `docs/launch/owner-runbook.md` | owner steps O-1 to O-6 | NS-2 |

---

## 20. Tests

### 20.1 Per row

Native files are tested by importing the `.native` file directly (as `biometric.native.test.ts` does) or through a `native` project that NS-2 adds to `vitest.render.config.ts` with `.native.tsx` resolved first; Clerk is mocked at its hooks.

| Row | Unit (pure, 100 % on new logic) | Component (`vitest.render.config.ts`) | Web regression |
|---|---|---|---|
| NS-1 | payload rules for the four names and `who.picked.use: 'account'` (a smuggled `profileId`, an extra key and an out-of-range value dropped); `AccountTrustSchema`; names in the list | Worker: status view strips receipts, amounts, actions and account cards with `view=status`, with the header and with an `azp`-less token, records no `billing.summary_viewed`, answers `no-store`; each money route refuses the header and an `azp`-less token with `403 not_in_app` and is unchanged for a browser token; `NATIVE_MONEY_GUARD` off; `NATIVE_ACCOUNT` off answers `403 native_off` to native requests only; an `azp`-less token reads `GET /api/spaces`; `GET /api/spaces` answers `no-store` | `billing.spec.ts` and `billing-step-up.spec.ts` unchanged |
| NS-2 | `nativeAccountEnabled` (os, flag, key per build kind); key parsing (`sk_` ignored, `pk_test_` refused in release); `nativeGateState` (every input, `unknown` cases); token-cache adapter (index first, refuses an unindexed key, memory mode off a PIN device, deletes on a non-PIN gate state, unreadable item); install sweep (record only after deletes, retries); `account-lock` table (every row of 7.2 and 7.3); `nativePlanLines` over every coverage and status with an input type that has no `actions`, `receipts` or `payer`; `order.ts`; API client (header, fresh token, `no-store`, `https` only, `/api/sync` and `/api/recovery` refused, null token short-circuit) | provider mounts only with the Grown-up area stack (CS-N1); import guard; web-bundle guard (no `@clerk/clerk-expo` reachable from a web entry); `app.json` config test (privacy manifest entries; no `scheme`, associated domains or intent filters, CS-N6); `face-id-permission.test.ts` updated for the plugin options | web bundle size unchanged |
| NS-3 | `sign-in-step` reducer over every transition and status (`needs_second_factor`, `needs_client_trust`, backup code, unknown), the error table, one `auth.native.signin` per flow | each step and error state; offline disables; Cancel; account card signed in, out and locked; Sign out clears the records, the keys and the queries, also offline; the re-trust rule; deny list (en, es, ko) | — |
| NS-4 | `grownUpRows` with `nativeAccount` (uses, empty record, no record, `nopin`, offline) | chooser and Welcome rows on `ios` and `android`; a row asks a typed PIN and offers no face or fingerprint; `AccountGate` on mount, focus and `active`; the card's buttons go through the gate (a `pin` device with no trust locks); freshness after 2 minutes; the session close cancels and clears the queries (CS-N4); capture protection set and cleared; flag off is the basis (CS-N13); a profile-read failure at boot opens nothing (CS-N14) | `who-grown-up.spec.ts`, `who-is-using.spec.ts`: web rows unchanged |
| NS-5 | family ordering; code panel role rules; report viewer split | Family home, learner report, code panel, Join on this device holds the code and opens the chooser with `join`; plan block for every coverage row of 8.5; the re-trust notice once; empty, offline, error, `401`, `native_off`; deny list | the in-app report's tests unchanged |
| NS-6 | class grouping; school row link by role; school focus | Teacher home, class page, class report, school page with and without `usage`; a teacher member's school row has no link; attention line; deny list | — |
| NS-7 | — | the CS-N1 to CS-N15 suite in one file (`account-child-safety.test.tsx`), and AMENDMENTS-ONE-ACCOUNT-MANY-USERS CS-1, CS-4 (as amended by ND-7), CS-7, CS-14 and CS-15 re-run with `Platform.OS` native; the deny-list sweep over every state in three languages; `app.crash` from an account route has an empty message (CS-N15) | the full web child-safety suite unchanged |
| NS-8 | flags pin on, the off words and the unknown word | — | — |

Every row also runs the locale matrix and the es and ko coverage ratchets for its strings.

### 20.2 Owner device checks (O-6; release configuration, switch on, production Clerk and Worker)

| # | Check | Pass |
|---|---|---|
| D1 | iPhone with a grown-up PIN: sign in with the email code from a fresh install; an account made with Google included | home opens; the code offered by autofill or typed |
| D2 | Password sign-in on an account that has one; a wrong password; a wrong code; a new-device check if Clerk asks one | the right lines; no Clerk English text |
| D3 | Quit and relaunch; chooser → Family → typed PIN | home after 2 taps and the PIN; no face or fingerprint offered |
| D4 | Change the PIN in the Grown-up area, then open Family; sign in again with the code, then with the password | the changed-PIN line; the code alone asks for the password; the password opens the home and shows the notice once |
| D5 | On a home, open the app switcher; take a screenshot; on Android, look at recents; then 5 minutes in the background | no content in the switcher, recents or screenshot; the PIN asked again |
| D6 | Airplane mode | account rows disabled with Needs the internet; Sign out still works; learning unaffected |
| D7 | Delete the app, reinstall, open the chooser and the Grown-up area | signed out |
| D8 | Read every account screen and the plan block for a free family, a Family Plan family, a class, a school class and a school | no price, buy, renew, manage, billing, receipt, date of the own plan or web wording; no link out |
| D9 | VoiceOver walk of sign-in and the Family home | every control named, errors announced |
| D10 | Android phone: D1 to D9 (TalkBack for D9), plus a backup and restore to a second phone | same; the restored phone is signed out |
| D11 | Any home on the production Worker | data loads (U2) |
| D12 | A device with no learner profile and no PIN: sign in from Welcome, open the home, go Back, relaunch | Welcome shows only Sign in as a grown-up again; signed out |
| D13 | The O-5 review account on a fresh install, exactly the review notes' path | the home opens with the password alone (or the O-5 decision is taken) |
| D14 | Desktop browser, console billing page in the sandbox: start a checkout | Stripe test checkout opens (U8) |

The results go into NS-8's PR body.

---

## 21. Out of scope

- Google, Apple and passkey sign-in on native (a later pair: Sign in with Apple must come with Google under Guideline 4.8).
- Creating an account, deleting an account, changing the email, revoking sessions (F-AUTH-005) on native.
- Every console tool of ND-2's "Not in v1" list; a native Lecture mode presenter.
- Reset of the PIN by signing in on native (ND-12).
- In-app purchase (F-IAP-002) and any change to F-BILL-002 OD-4 or OD-5.
- A native end-to-end runner (Detox or Maestro) (ND-13).
- Linking an adult learner's own profile to the grown-up account (F-APP-001 OD-2's "may later"): learners keep never signing in.
- Several grown-up accounts on one device at once (ND-14; AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 21).
- Push notifications for grown-ups.

---

## 22. PR table

Sizes: S up to about 300 changed lines, M up to about 800, L above. Every row: tests in the same commit as the code (TDD), en, es and ko strings with MAR, tokens only, the deny list on every new state.

| Row | Type and contents | Size | Depends on | Flag |
|---|---|---|---|---|
| NS-0 | `docs(specs)`: this spec; README index; [AU] notes in AMENDMENTS-ONE-ACCOUNT-MANY-USERS (OA-11 done), F-APP-001, F-AUTH-001 and F-AUTH-002 (= AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-11) | M | OA-10 | — |
| NS-0b | `design(account)`: agent design pass approved by MAR: wireframes `design/wireframes/account/native-sign-in.md`, `native-lock.md`, `native-homes.md`; mocks in `design/screens/account/` for every sign-in step and error, the gate's lines, the Grown-up area account card (signed out, in, locked), the native chooser and Welcome rows (with `nopin` and offline), Family, Teacher and School homes, class page, both reports, the code panel, the plan block per coverage, the covers; phone, tablet, Largest text, es and ko lengths **Done (#1021)**: wireframes and mocks in `design/screens/account/` with 27 shots, decisions D1 to D22, two MAR rounds (both approve), amendments marked [NS-0b] | M | NS-0 | — |
| NS-1 | **done 2026-11-08 (#1020)** `feat(content-schema,backend)`: `auth.native.*` names, `NATIVE_AUTH_TELEMETRY_PAYLOADS`, `NATIVE_AUTH_PAYLOAD_RULES` in `keptEventFields`, daily counting, `who.picked.use: 'account'`; `AccountTrustSchema`, header constants; `GET /api/billing/summary?view=status`, the header and token rule, `no-store`; the money-route guard with `NATIVE_MONEY_GUARD`; `NATIVE_ACCOUNT`; wrangler.toml comments | M | NS-0 | `NATIVE_MONEY_GUARD`, `NATIVE_ACCOUNT` (on) |
| NS-2 | **done 2026-11-09 (#1023)** `feat(mobile)`: `@clerk/clerk-expo` (pinned; binary size recorded), `expo-screen-capture`, `platform/clerk.native.tsx`, the `GrownUpStack` nesting, the indexed token cache, the install sweep, Android backup exclusion, the iOS cover config plugin, privacy manifest entries, `nativeAccountEnabled` and the flag, `nativeGateState`, `store/query-client.ts`, `logic/account/` (`account-lock`, `plan-lines`, `order`, `api`, `deny-list` with the Plan screen's list moved in), the import guard, the web-bundle guard and the `app.json` config test; the `native` test project; owner runbook steps | L | NS-1 | `EXPO_PUBLIC_NATIVE_SIGNIN` (off) |
| NS-3 | `feat(mobile,i18n)`: the sign-in screen and step machine, trust (with the re-trust rule) and uses records, the Grown-up area account card, Sign out, `auth.native.signin` and `.signout`; strings of 17.1, 17.2 and 17.4 | M | NS-0b, NS-2 | same |
| NS-4 | `feat(mobile)`: native rows on the chooser, Welcome and the card (`grownUpRows` with `nativeAccount`), the `GrownUpUse` native branch (typed PIN only), `AccountGate`, freshness, query clearing on session close, capture protection, `auth.native.lock`; the AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 9 and 8.6 notes | M | NS-3 | same |
| NS-5 | `feat(mobile,i18n)`: Family home, the report viewer split and the account learner report, the code panel with Join on this device, the plan block, the re-trust notice, states, `auth.native.home`; strings of 17.3 | L | NS-4 | same |
| NS-6 | `feat(mobile,i18n)`: Teacher home, class page, class report, school page and focus, the attention line | L | NS-5 | same |
| NS-7 | `test(mobile)`: the CS-N suite and the native re-run of the OA child-safety cases; the deny-list sweep over every state in three languages; the empty crash message on account routes | M | NS-6 | — |
| NS-8 | `chore(flags)`, `docs(specs)`: **owner-assisted** (device checks): `EXPO_PUBLIC_NATIVE_SIGNIN` on by default after D1 to D14 pass (results in the PR); app map rows; F-APP-001 notes and OD-6 closed; F-BILL-002 notes | S | NS-7, owner steps O-1, O-3, O-6 | flips |

Shared files (append-only, expect mechanical rebases): `telemetry.ts`, `app-shell.ts` and `server-events.ts` (NS-1 only), `navigation/types.ts` (the account routes, NS-3 to NS-6), `logic/profiles/who.ts` (NS-4), `App.tsx` (NS-2 only), `packages/i18n` namespaces, `i18n-migrated.json`, `review-ledger.json`, `apps/mobile/package.json`, `app.json` and the lockfile (NS-2 only).

---

## 23. Decisions on the open questions

Every question below has a decided default under the owner's standing approval of defaults (2026-10-11 and 2026-10-21); none blocks a row. A change is a new owner decision and a new revision of this spec. The one decision left to the owner is O-5's review path, and only if D13 shows that Clerk's new-device check asks the review account for an emailed code; it gates a store submission, never a row.

| # | Question | Decision | Decided | Gates |
|---|---|---|---|---|
| NQ-1 | Show the console inside the app (web view or in-app browser) instead of native screens? | No (ND-1) | 2026-11-08 | all |
| NQ-2 | Google sign-in on native? | Not in v1; later together with Sign in with Apple (4.8) | 2026-11-08 | NS-3 |
| NQ-3 | What does the plan block say? | The plan name and usage only; no dates of the own plan, no "manages", no payer line (ND-8) | 2026-11-08 | NS-5 |
| NQ-4 | Account creation on native? | No, and no pointer to where accounts are made (ND-4) | 2026-11-08 | NS-3 |
| NQ-5 | Which console tools in v1? | Homes, rosters, reports, join codes, the plan name (ND-2) | 2026-11-08 | NS-5, NS-6 |
| NQ-6 | `nopin` devices | Set a PIN first (ND-7) | 2026-11-08 | NS-4 |
| NQ-7 | Stay signed in across launches? | Only on a device with a grown-up PIN (ND-9) | 2026-11-08 | NS-3 |
| NQ-8 | Offline copies of account pages? | None (ND-10) | 2026-11-08 | NS-5 |
| NQ-9 | Apple's US-storefront external purchase link, or Google's alternative billing? | No, on every storefront (F-BILL-002 OD-4 stands) | 2026-11-08 | — |
| NQ-10 | Reset the PIN by signing in on native? | Not in v1 (ND-12) | 2026-11-08 | — |
| NQ-11 | A native end-to-end runner? | Not in this spec (ND-13) | 2026-11-08 | NS-7 |
| NQ-12 | Face or fingerprint for the account rows? | No; a typed PIN (ND-5) | 2026-11-08 | NS-4 |
| NQ-13 | An email code on a device whose inbox a child can open (R-1) | Accepted, with the password re-trust rule and the notice (7.3, 8.2) | 2026-11-08 | NS-3, NS-5 |
| NQ-14 | Stripe Live | Unchanged: off until the owner says so; nothing here touches it | 2026-11-08 | — |

---

## 24. Dependencies

- **Upstream**: F-AUTH-001 (Clerk JWT verification), F-AUTH-002 (the Clerk instance and keys), F-APP-001 (device gate marker, trusted epoch, `usesFor` homes), AMENDMENTS-ONE-ACCOUNT-MANY-USERS (chooser, PIN, session rules, OA-9 biometrics; OA-10 merged as #809), F-BILL-002 (section 4.8, OD-4, OD-5; `BillingSummarySchema`), F-REPORT-001 (report routes and models), F-SPACE-001 (spaces, roles, join, consent), F-I18N-001.
- **Downstream**: F-IAP-002 (in-app purchase; the public store release), F-AUTH-005 (account page, deletion, session revoke).
- **External**: the Clerk Production instance with the Native API on (O-1).

---

## Review log

- 2026-11-08, NS-0 revision 1 (this PR, AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-11): written from a read-only pass over `4343e8955` (the native stubs, `grownUpRows`, the Worker's auth and space routes, the billing summary schema, the report models, `app.json`, the mobile dependencies) and the store rules F-BILL-002 section 4.8 records; every `file:line` checked at that commit.
- 2026-11-08, NS-0 revision 2, after two independent multi-agent reviews of this PR (consistency with the specs and code: 0 blockers, 7 majors, 21 minors; store policy, child safety and security: 2 blockers, 8 majors, 13 minors). All adopted; where both found the same issue it is listed once:
  - **Gate source** (blocker): the native gate reads its own exact state (`nativeGateState`: `unknown`, `nopin`, `open`, `pin`), never the in-memory marker; `unknown` opens nothing (7.2, CS-N14).
  - **Clerk new-device check** (blocker): `needs_client_trust` and `email_code` as a second step, **Use a backup code**, U6, D13, and the review account on the production instance with O-5's one owner decision at submission time (6.3, 16.2).
  - **Devices without a PIN**: a sign-in is kept only on a PIN device; Welcome offers only Sign in; the Families row of section 5 corrected (ND-9, 6.2, 7.1, CS-N14, D12).
  - **One gate for every entry**: `AccountGate` on mount, focus and `active`, the card's buttons included (7.2).
  - **Email inbox in reach** moved into scope: the password re-trust rule, the notice, accepted risk R-1 (2, 7.3, 8.2).
  - **Typed PIN only** for account rows; face or fingerprint keeps the local Grown-up area (ND-5, CS-N11).
  - **Plan block**: a fact only (plan name, usage, the school coverage line); the payer line, renewal and end dates and "manages" lines dropped; "reader-style" reasoning replaced; the 9.1 and D8 rules aligned; the risk raised to medium (ND-8, 8.5, 9.1).
  - **Capture protection**: Android `FLAG_SECURE` (`expo-screen-capture`) and an iOS native cover, U7 (7.4).
  - **Install sweep** buildable: an indexed key list, the record written only after the deletes, unreadable items deleted (6.2).
  - **Deny list**: more words in three languages, symbols as substrings, accessibility props scanned, the Plan screen's list moved into one module (9.2).
  - **Order and data**: learners sorted on the client by `joinedAt` (the roster route sorts by activity); no "classes of schools where it teaches" (the school page needs `space.manage`; a teacher member's school row has no link); the join code from the roster; no per-class roster reads on the Teacher home (8.1 to 8.4).
  - **Provider placement**: `ClerkProvider` wraps a nested Grown-up area navigator and unmounts with it (6.1, ND-11).
  - Also adopted (minors):
    - the `account` use code with its telemetry value;
    - no `billing.summary_viewed` from the status view;
    - every coverage and status mapped, and legacy account cards not shown;
    - the report viewer split named;
    - reused console strings instead of duplicates (`console.lock.*`, `console.shell.signOut.cta`, `console.billing.help.sharedDevice`, `console.home.attention`);
    - es drafts shortened to fit `length-budget.test.ts`;
    - the query client export and cancel-before-remove;
    - the `.native` test method;
    - Sign out enabled offline;
    - one `auth.native.signin` per flow with `method: 'none'` and the error-to-result table;
    - a Worker switch `NATIVE_ACCOUNT` for installed builds;
    - the `azp`-less token rule on money routes with U8 and D14, and the CORS rationale dropped;
    - `no-store` on the read routes, an `https` base, `pk_live_` in release builds;
    - the privacy labels for Clerk's own collection;
    - no "yet" in copy, and a section 5 row against pointing to account creation;
    - the 3.1.3(c) flag;
    - R-2 (offline sign-out);
    - Android restore behaviour;
    - ND-7 as a choice;
    - the clipboard note;
    - the crash-message rule (CS-N15);
    - section 19 completed (F-AUTH-001, F-AUTH-002 and README in this PR; F-APP-001 sections listed for NS-8);
    - the `face-id-permission.test.ts` update;
    - NS-8 marked owner-assisted;
    - decided dates in section 23;
    - the native binary size recorded;
    - D10's restore case;
    - the `app.json` config test.
- 2026-11-08, NS-0b (design pass, `design/screens/account/`, wireframes `design/wireframes/account/`): mocks for every state the row lists, with 27 shots, a deny-list scan of every board in en, es and ko, and the amendments marked [NS-0b] (decisions D1 to D22 in `design/screens/account/README.md`). Author pass: the deny list's bare card words failed the reports' heritage cards (D15); the reports' free-end line pointed to buying elsewhere (D14); the plan block's label would hide the plan name (D9); the learner card's words and the (cta) key shape were unnamed (D10, D16). Independent multi-agent review, two reviewers (design, accessibility and consistency; store, child safety, privacy and es/ko copy): 0 blockers, 6 majors (one raised by both), 13 minors, 7 nits, all adopted except two accepted as they stand (siblings' minutes on adjacent cards, Android's per-syllable Korean breaks):
  - the account card's email only with a fresh typed PIN or sign-in, never after face or fingerprint; the card's buttons through the gate (7.1, CS-N9);
  - no school end date and no free cap on the plan block (ND-8, 8.5, 9.1, D20);
  - the invalid field keeps a `border.shape` border (D5);
  - 6.3 gains the second step's Send a new code and every button's offline and busy state (D2, D4);
  - a pending re-trust opens the password step first (7.3, D21);
  - the deny list's phrases completed, plural-tolerant and spacing-free in Korean (9.2);
  - the free-end line also showed on the shipped native in-app report: handled by F-BILL-002 section 4.8 item 5 in #1022 (hidden on iOS and Android, kept on the web) (8.7);
  - 11 es and 12 ko values of section 17 revised by the language review (es "Inicia sesión" in sentences, "verificar"; ko 사용하기, 한 뒤에, 해 주세요, 2단계 인증), `errors.wrongPassword` and `home.noFamily` reworded in three languages, `home.makeCode` replaced by the shipped `console.confirm.issueCode`.
