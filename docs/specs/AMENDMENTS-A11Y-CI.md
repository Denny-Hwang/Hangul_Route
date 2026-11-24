# AMENDMENTS-A11Y-CI — accessibility checks in CI: a lint gate on pull requests, an axe ratchet on main

Status: ready (owner decisions 2026-11-24, §10; revision 2 of 2026-11-24). Row AC-0 of work order WO-08 (`docs/roadmap/review-2026-11/phase-1-safety.md`, "WO-08 CI 에 접근성 검사를 넣는다").
- The WO was written on `d5ba0217c`. Revision 1 (2026-11-23) re-read every citation on main `e72336a7d` and again on `d679cc8a7`; neither of the two commits between them touches a cited line.
- Revision 2 takes the two-lens multi-agent review of 2026-11-24 (§12). That review ran ESLint and the plugins on the real source, so the lint counts in §3.2 are measured, not estimated.
- The owner decided OD-AC1 to OD-AC9 on 2026-11-24, all as recommended ("전부 권고대로 승인", §10).

**Amends**: F-COV-001 (Coverage Gate Enforcement). F-COV-001 closed one of the "CI gate is a lie" risks, the coverage gate (its §1). This amendment closes two more: the `lint` task runs nothing in any workspace, and nothing checks accessibility. F-COV-001's coverage rules are unchanged. · tag **[AC]**

**Why an AMENDMENTS file**: WO-08 lets the rows go either into F-A11Y-001 or into a change of F-COV-001. Another session is writing F-A11Y-001 in parallel (WO-04, row AF-0), so rows added there now would collide. README §5.1 step 2 of the review plan puts changes to an existing spec in an `AMENDMENTS-<TOPIC>.md` file, so the CI part lives here. **F-A11Y-001** (answer feedback and announcements) is referred to by name only.

**Scope** (every file a row may touch):
- **AC-3**:
  - `apps/mobile/package.json`, `apps/web/package.json`, `packages/design-system/package.json` (lint scripts, devDependencies; design-system also its `exports` entry under OD-AC7);
  - `apps/mobile/eslint.config.mjs`, `apps/web/eslint.config.mjs`, `packages/design-system/eslint.config.mjs` (new);
  - the suppressions files `<workspace>/eslint-suppressions.json` (method B);
  - `pnpm-lock.yaml`, and `pnpm-workspace.yaml` for the peer exception;
  - under OD-AC7, `packages/design-system/eslint/touchable-has-name.mjs` and its test;
  - the config tests of §6;
  - `scripts/__tests__/ci-workflows.test.mjs`.
- **AC-1**:
  - `apps/mobile/e2e/web/axe-smoke.spec.ts`, `axe-audit.ts`, `fixtures/axe-baseline.json`;
  - `apps/mobile/src/config/__tests__/axe-baseline.test.ts`;
  - `apps/mobile/package.json`, `pnpm-lock.yaml`;
  - optionally `scripts/e2e-shard-weights.json`.
- **AC-2**:
  - `apps/web/e2e/axe-site.spec.ts`, `axe-console.spec.ts`, `axe-audit.ts`, `fixtures/axe-baseline.json`;
  - `apps/web/src/app/__tests__/axe-baseline.test.ts`;
  - `apps/web/package.json`, `pnpm-lock.yaml`;
  - under OD-AC8 = lane, one step in `.github/workflows/web-app.yml`'s billing lane and its pin in `scripts/__tests__/ci-workflows.test.mjs`.
- **Only under OD-AC4 = (a)**:
  - PR steps in `web-app.yml`'s `build` job, and its header comment (`:25-29`);
  - the shard listing that leaves the spec out (`web-app.yml:294-309`);
  - the "e2e runs on the push to main only" test in `ci-workflows.test.mjs` (`:149-167`);
  - the sentence on PR e2e in CLAUDE.md §4.
- **AC-3b, AC-3c**:
  - the source files that hold today's violations (§3.2);
  - `packages/i18n/src/messages/{en,es,ko}/*.ts` if a fix needs a new label;
  - the suppressions files, the config tests.
- **AC-4**: F-COV-001's header, `docs/specs/README.md` (index line), this file's status, and a proposed CLAUDE.md §4/§8 line for the owner to approve.
- **Not changed**:
  - `ci.yml`, under every option;
  - the root `engines` (§8);
  - `apps/web/next.config.js` (revision 1's `ignoreDuringBuilds` was a no-op, §12).

**Owner**: solo dev · **Rollout**: next release (CI only; nothing a learner sees)

---

## 1. Context

### 1.1 What CI checks today

- **Lint is an `echo` everywhere.** The WO named three workspaces: `apps/mobile/package.json:13`, `apps/web/package.json:10`, `packages/design-system/package.json:45`. The other six are the same: `apps/api/package.json:10`, `packages/backend/package.json:12`, `packages/content-schema/package.json:33`, `packages/i18n/package.json:17`, `packages/shared-types/package.json:13`, `packages/test-utils/package.json:13`.
- **Where lint would run.** The `ci.yml` job `checks` ("Lint · typecheck · build · repo checks", `.github/workflows/ci.yml:29-30`) runs `pnpm exec turbo run lint typecheck build` (`:64-65`), so the lint part does nothing. The required check is the separate job `ci` ("lint · typecheck · test · build", `:233-251`). It fails when `checks` or `unit` fails. `unit` runs every vitest suite, F-A11Y-001's included (`:107-180`).
- **Required checks.** The `main-protection` ruleset requires `lint · typecheck · test · build`, `Build PWA · offline e2e` and `Measure coverage vs rolling targets` (read 2026-11-23 with `gh api …/rulesets/24631759`). `scripts/__tests__/ci-workflows.test.mjs:99-175` keeps their layout honest. One of its rules matters here: a required check's workflow may have no `paths` filter on `pull_request` (`:110-116`).
- **No ESLint and no axe.** No ESLint config is tracked, and the lockfile has no `eslint`. No `package.json` and no lock entry names `axe-core` or `@axe-core/playwright`. axe appears only in comments quoting the 2026-11-15 product review's one-off scan (`apps/mobile/src/navigation/tab-button.tsx:63`, `apps/mobile/src/screens/__tests__/progress-labels.test.tsx:10`; `docs/launch/product-review-2026-11-15.md:24, 192, 196`).
- **68 existing `eslint-disable` comments**:
  - under `apps/mobile/src`: 57 in 34 `.tsx` files and 8 in `.ts` files;
  - under `packages/design-system/src`: 3 in 3 `.tsx` files;
  - 44 of the 68 are in files §3.2 lints (non-test `.tsx`, 32 files).
  
  They name rules from plugins that were never installed: `react-hooks/exhaustive-deps` 50 times, `@typescript-eslint/no-explicit-any` 16, `@typescript-eslint/no-namespace` 1, and the core rule `no-control-regex` 1 (example: `apps/mobile/src/components/ProfileLockCard.tsx:61`). In ESLint 9 and 10, a disable comment naming an unknown rule is itself an error, "Definition for rule '…' was not found". The source is `lib/linter/file-report.js:93-97` and `createDisableDirectives` in `lib/linter/linter.js`, the same in `eslint@9.39.5` and `eslint@10.15.0`. §3.2 handles this without touching the comments.

### 1.2 Where Playwright runs, and how CI runs while the repository is private

- **`web-app.yml` on a pull request** (owner decision 2026-11-18, #1043; `web-app.yml:25-29`): a change check, the release build (`:132-134`) and the wrangler dry run (`:136-138`). The fixture bundles and the uploads run on push only (`:144-210`). The required check `Build PWA · offline e2e` passes a pull request once the build has passed (`:587-590`). CLAUDE.md §4 says the same.
- **`web-app.yml` on a push to `main`**:
  - four e2e shards (`:226-235`, `if` at `:230`) run the whole release-build list (`playwright test --list` at `:300`, dealt by `scripts/e2e-shard-list.mjs`, `:294-309`) and the fixture lists;
  - the billing and grown-up home lane (`:454-458`) runs on the app-host build with an API base at a mock host;
  - so the WO's "Playwright 는 `web-app.yml` 에서 이미 돈다" holds only for pushes to `main`.
- **Not in the WO**: `preview-deploy.yml` runs **apps/web's whole Playwright suite on pull requests** (`pnpm --filter @hangul-route/web test:e2e`, `:107-111`), on the default static export. It does so only for pull requests touching `apps/web/**`, `packages/design-system/**`, `packages/content-schema/**`, `packages/i18n/**` or `content/stories/**` (`:8-18`). It is not a required check, and with that path filter it cannot become one.
- **Nightly**: `switch-on-e2e.yml` runs nightly and on demand (`:17-25`), never on a pull request.
- **While private.** `AMENDMENTS-FINISH-2026-11.md:11, 19`: CI does not run while the repository is private and out of Actions minutes. Each row is verified locally (typecheck, lint, the unit suites it touches, the e2e specs it touches against a local release build). The full CI run happens once, when the owner opens the repository.
  - From 2026-11-18 11:55 to 2026-11-19 16:13 UTC, and around 2026-11-22 08:00 UTC, jobs did not start because the Actions spending limit had been reached.
  - Since 2026-11-22 08:17 UTC every pull request has run CI. On 2026-11-23 `gh repo view` reports the repository **public**.
- **Runner size.** Private repositories run on 2-core runners and public ones on 4-core runners (`ci.yml:110-112`). The e2e shards took 19 to 22 min on 4 cores and 35 to 39 min on 2 cores (`web-app.yml:232-234`, #1043).

### 1.3 WO-08's citations, re-verified

| WO says | On `e72336a7d` / `d679cc8a7` | Verdict |
|---|---|---|
| 확인: `apps/mobile/package.json:13`, `apps/web/package.json:10`, `packages/design-system/package.json:45` `lint` = `echo` | Same lines, same text (`ce8dc196b` changed `ios`/`android` in `apps/mobile/package.json`; `lint` is still at `:13`) | true |
| 보고: ESLint 설정 파일 없음 | none tracked; none in the lockfile | true |
| 보고: axe 계열 0건 | no dependency; only comments quoting the one-off scan | true |
| 보고: `.github/workflows/ci.yml:65` `turbo run lint` 가 no-op | `:65` is `run: pnpm exec turbo run lint typecheck build` in job `checks`. It is a no-op in **all nine** workspaces | true, incomplete |
| 보고: Playwright 는 `web-app.yml` 에서 이미 돈다 | on push to `main` only (since #1043); apps/web's suite also runs on path-filtered PRs in `preview-deploy.yml:107-111` | partly true |
| 재확인 줄: PR 은 릴리스 빌드와 dry run 만, 샤드는 main push 만 | `web-app.yml:25-29, 132-138, 226-235, 587-590` | true |
| 재확인 줄: "비공개인 동안 CI 는 돌지 않는다" | `AMENDMENTS-FINISH-2026-11.md:19`; the repository is public on 2026-11-23 | true as a rule; the state has changed for now |
| 결정 사항: WO-04, WO-40, WO-41 이 머지될 때마다 기준선을 줄인다 | axe cannot see most of what WO-04 and WO-40 fix (§3.6) | partly false |
| 결정 사항: 기준선은 "새 위반만 실패" | revision 1 made the ratchet strict (fewer/gone fail too), without saying so | now OD-AC9 (§3.5) |
| 수용 기준: `accessibilityLabel` 없는 버튼 → CI 실패 | `eslint-plugin-react-native-a11y` has no label rule; its closest rule is satisfied by `accessibilityRole` alone | the probe is defined exactly in §3.7; OD-AC7 closes the gap |

## 2. User story

> As a learner who uses a screen reader, I can trust that every button I reach says what it does. A change that adds a nameless button is stopped before it reaches me.
>
> As the solo developer, I want three things:
> - to find out on the pull request, in seconds, when I add a touchable with no accessibility props;
> - to find out on `main` when a scanned screen gets a new axe violation;
> - never to bury an old problem under `eslint-disable`.

## 3. Acceptance criteria

### 3.1 Where the checks run: option (a) or (b) (OD-AC4)

**What WO-08's goal needs.** The goal is "WO-04 류의 회귀가 CI 에서 걸린다". WO-04's class of fault is a result shown only by colour, a result not announced, and a label that does not change with the state. **Neither ESLint nor axe sees it** (§3.6). The CI guard for that class is F-A11Y-001's own unit tests (WO-04, rows AF-1 to AF-4). They run in `ci.yml`'s `unit` job behind the required check `lint · typecheck · test · build`. WO-08 adds the guard for the other class: missing names and roles, invalid ARIA, text contrast, and document structure (D11).

**Option (a): a light PR job that runs axe.**
- ESLint (AC-3) is the lint gate under both options.
- Under (a), the PWA axe smoke (AC-1) also runs on pull requests, as extra steps in `web-app.yml`'s existing `build` job after the release build (`if: needs.changes.outputs.run == 'true' && github.event_name == 'pull_request'`). The steps restore the browsers, run `playwright install --with-deps chromium`, then run `playwright test axe-smoke.spec` on the `dist` just built.
- No new job is added, so the `pwa` gate and its `needs` stay as they are (`ci-workflows.test.mjs:149-175`). The shard listing leaves the spec out.
- A failure fails `Build PWA · offline e2e` on the pull request.
- It changes the 2026-11-18 decision ("pull requests run the release build only") and CLAUDE.md §4.

**Option (b), recommended: ESLint as the PR gate, axe as an alarm on `main`.**
- **The lint gate.** AC-3 replaces the `echo` scripts with ESLint. `ci.yml:65` already runs `turbo run lint`, so the gate needs **no workflow change**.
- **The PWA scans.** AC-1's spec joins the release-build list of the `main` shards by itself (`web-app.yml:300`). A new violation turns `main` red. That red is an alarm only: the deploy is Cloudflare Workers Builds on every push and is not gated by it (`web-app.yml:3-6`).
- **The site and sign-in scans** (AC-2) run in `preview-deploy.yml`'s existing `test:e2e` step, on the PRs it covers, as a visible but not required check.
- **The teacher class page** runs in the billing lane on `main` (OD-AC8).

**What (b) does not catch on a pull request** (it is caught later on `main`, or not at all):
- **Touchables with a spread.** `has-valid-accessibility-descriptors` skips any element with a spread: 28 of 152 touchables in apps/mobile and 7 of 13 in design-system (heuristic scan of the opening tags).
- **Wrapper components.** Components that render a `Pressable` but whose name is not in the plugin's touchable list (`lib/util/isTouchable.js`): only their inner `Pressable` is checked, where it usually has a spread.
- **Labels empty at run time.** `accessibilityLabel={label}` where `label` is `''` passes ESLint. axe's `button-name` sees it only on a scanned screen.
- **Rendered-page faults on the PWA screens.** Contrast, headings, landmarks, document title and `lang` are seen only after the merge, on `main`.
- **Gaps in the PR-time web scans.** An apps/web PR outside `preview-deploy.yml`'s path filter gets no PR-time axe. And `preview-deploy.yml` is not required, so its red does not block a merge.

**Minutes: what each option costs, in each repository state.**
- **Method.** The numbers are wall-clock minutes from the GitHub API (`started_at` to `completed_at`, successful runs). GitHub rounds each job up to a whole minute ("Actions runner pricing" on docs.github.com).
- **Windows.** The 4-core numbers come from the public window, 2026-11-19 18:00 to 2026-11-24 UTC. The 2-core numbers are from 2026-11-18.
- **ESLint and axe** have never run here, so their own cost is an **estimate** (the review's lab run of ESLint on the real source took seconds). AC-1 and AC-3 record their measured first-run cost in their PRs.

| | Measured base | (a) adds | (b) adds |
|---|---|---|---|
| `ci.yml` `checks` job | PR median 3.0 min (n=29; turbo step 143 s, run 45279523824); 5.1 and 5.3 min on 2 cores (runs 44244078730, 44220446217) | ESLint inside the parallel turbo run, about 620 non-test `.tsx` files with no type-aware rules: **+0 to 1 billed min per run** | same |
| `web-app.yml` `build` job, PR | median 2.0 min when the PWA changed (n=39; build step 80 s, run 45279523888); 2.3 to 2.5 min on 2 cores; the PWA changed in 39 of 57 sampled PR runs (68 %) | Browsers 3 to 5 s, install 9 to 16 s, then 5 tests. Similar specs take 2.2 to 7.6 s per test (`scripts/e2e-shard-weights.json`), plus about 1 to 2 s per axe pass. **+1 billed min on 4 cores, +2 to 3 on 2 cores**, per PWA-changing PR run | 0 |
| shards on `main` | median 19.6 min each (n=40); 95.8 billed min per `web-app.yml` push | 0 when listed out | **+0 to 4 per push** |
| billing lane on `main` (OD-AC8) | median 5.7 min (n=10) | +0 to 1 | +0 to 1 |
| `preview-deploy.yml`, PR | median 3.4 min (n=39; Playwright install 16 s, suite 70 s, run 45236504306) | 2 tests: +0 to 1 | same |

**Cadence.** From 2026-10-24 to 2026-11-23 there were:
- 652 `ci.yml` PR runs, 92 of them cancelled;
- 107 `ci.yml` pushes and 89 `web-app.yml` pushes;
- 536 `preview-deploy.yml` runs;
- 142 merged PRs.

At that cadence and on 4 cores, CI is about 29,000 billed minutes per 30 days. (b) adds at most about 1,500 (most runs add 0 or 1 min). (a) adds a further 350 to 1,100, less up to about 300 if the shards list the spec out. On 2 cores, multiply by about 1.8.

**Who pays for those minutes**, by the state of the repository:
- **Public (today):** standard runners are free for public repositories (docs.github.com, "GitHub Actions" billing). Neither option costs money. (b) is still recommended, for the ops reasons below.
- **Private, within the included quota:** the quota is $12 of compute a month on GitHub Free, about 2,000 Linux 2-core minutes at $0.006. Whether the account is on Free or Pro was not checked. The base alone is far above either quota, so CI barely runs, as on 2026-11-18. The gate is then the local check each row runs (FINISH-2026-11). There, ESLint takes seconds with no build, while the axe smoke needs a release build and a Playwright run.
- **Private with a raised spending limit:** the only state where minutes cost money. On 2 cores, (a)'s extra over (b) is about 630 to 2,000 minutes per 30 days, about $4 to $12. (b)'s own upper bound is about 2,700 minutes, about $16, but most of its runs add nothing.

**Ops factors.**
- (a) puts Playwright and axe, with their timing risk, into the required check of every PWA PR.
- (a) also catches "fewer" and "gone" baseline drift on the PR, before merge (§3.5).
- Under (b), flakes stay out of the required checks, and "fewer" and "gone" are handled by OD-AC9.

**Recommendation: (b).**
1. ESLint covers every linted file on every PR. axe covers only the screens it visits.
2. (b) leaves the 2026-11-18 decision and CLAUDE.md §4 as they are. The PR gate and the PWA scans need no workflow change; only OD-AC8's lane adds one step.
3. Flaky browser tests stay off the required checks.
4. It is the cheapest gate to run locally while the repository is private.

(a) buys PR-time axe on five PWA screens.

### 3.2 ESLint rule sets (AC-3): accessibility rules only

**Where ESLint runs.**
- One `eslint.config.mjs` (flat config) in each of `apps/mobile`, `packages/design-system` and `apps/web`. The other six workspaces keep their `echo`: they have no JSX.
- **Files**: non-test `.tsx` under `src/`, plus the three entry roots of apps/mobile, `App.tsx`, `BrowseApp.tsx` and `PresenterApp.tsx`. (Revision 1 missed the last two. The review's counts below cover `src/`, so AC-3 measures the two roots and records them.)
- **Ignored**: `**/__tests__/**`, `**/*.test.tsx`, `**/__generated__/**`. `.ts` files hold no JSX, so these rules have nothing to check there. Neither `e2e/` nor `scripts/` is linted.
- **Parser**: `@typescript-eslint/parser` with `ecmaFeatures.jsx` and no `project`, so there are no type-aware rules.

**No style or correctness rules.** The configs load none of `@eslint/js`, `typescript-eslint` rules, `eslint-plugin-react`, `eslint-plugin-react-hooks` or `eslint-config-next`. Only the accessibility rules below are on (and OD-AC7's rule, also an accessibility rule).

**The scripts** (method B, §3.3):
- `apps/mobile`: `eslint --no-inline-config --max-warnings=0 App.tsx BrowseApp.tsx PresenterApp.tsx "src/**/*.tsx"`
- `packages/design-system` and `apps/web`: `eslint --no-inline-config --max-warnings=0 "src/**/*.tsx"`
- No script ever uses `--fix`, `--suppress-all`, `--suppress-rule` or `--pass-on-unpruned-suppressions`. `ci-workflows.test.mjs` pins this (§6).
- `--fix` is ruled out because `has-valid-accessibility-descriptors` is fixable: it inserts `accessibilityRole="button"`, which would silence the rule without naming anything.

**Why `--no-inline-config`.** This sets `allowInlineConfig: false`: ESLint reads no `eslint-disable` and no `/* eslint */` comment.
- The 44 existing comments in linted files cannot fail the run with "Definition for rule … was not found". They stay untouched for whatever linter they were written for.
- No one can cover an accessibility violation with a disable comment.
- The config option `linterOptions.noInlineConfig` is *not* used. It warns once per comment, and with `--max-warnings=0` that would fail every run.
- A later spec that adds `react-hooks` or `typescript-eslint` revisits the flag.

**Next.js.** `apps/web/next.config.js` is not changed. Next 14.2.35's `next build` lints only when it finds an `.eslintrc*` file or a `package.json` `eslintConfig` (`runLintCheck.js`). An `eslint.config.mjs` alone does not trigger it.

**`apps/mobile`, `packages/design-system`: `eslint-plugin-react-native-a11y` 3.5.1.** "Touchable" means `Pressable`, `Touchable`, `TouchableOpacity`, `TouchableHighlight`, `TouchableWithoutFeedback`, `TouchableNativeFeedback` and `TouchableBounce` (`lib/util/isTouchable.js`). The counts below are measured by the review's lab run on `src/`.

| Rule | On | What it catches · hits today |
|---|---|---|
| `has-valid-accessibility-descriptors` | yes | A touchable or `TextInput` with **none** of `role`, `accessibilityRole`, `accessibilityLabel`, `accessibilityActions`, `accessible`. It skips elements with a spread. It does **not** accept `aria-label`, `aria-labelledby` or `accessibilityLabelledBy`, so `<Pressable aria-label="x" onPress={f} />` fails. The repository's convention is `accessibilityLabel` (about 556 uses), and a touchable named by `aria-label` needs a role too. **The WO's acceptance rule.** mobile **2**: `apps/mobile/src/screens/parent/BiometricShortcutCard.tsx:61` (a Pressable hidden from assistive tech) and `apps/mobile/src/screens/reviews/StageReviewScreen.tsx:406` (an `aria-hidden` dimmer). The fix for both is `accessible={false}` or a role. 0 `TextInput`s; design-system 0 |
| `has-valid-accessibility-role`, `-state`, `-value`, `-actions` | yes | invalid values · 0 |
| `has-valid-accessibility-live-region`, `has-valid-important-for-accessibility` (Android) | yes | invalid values · 0 |
| `has-valid-accessibility-ignores-invert-colors` (iOS) | yes | an `Image` from `react-native` without `accessibilityIgnoresInvertColors` · mobile **1**: `apps/mobile/src/screens/account/AccountCover.tsx:25` |
| `no-nested-touchables` | yes | touchables inside an `accessible` group · mobile **1**: `apps/mobile/src/screens/minigames/role-play/RolePlayGame.tsx:377` |
| `has-accessibility-props`, `has-valid-accessibility-component-type`, `-traits`, `-states` | yes | deprecated props · 0 |
| `has-accessibility-hint` | **no** | It reports every `accessibilityLabel` without an `accessibilityHint`: about 515 hits (556 labels against 41 hints). Hints are optional and WCAG does not require them; this is the "hundreds of hits" the WO rules out |

Total today: apps/mobile **4** in `src/`, design-system **0**.

**`apps/web`: `eslint-plugin-jsx-a11y` 6.10.2.** All of `flatConfigs.recommended` as published.
- At `error`: `alt-text`, `anchor-has-content`, `anchor-is-valid`, `aria-activedescendant-has-tabindex`, `aria-props`, `aria-proptypes`, `aria-role`, `aria-unsupported-elements`, `autocomplete-valid`, `click-events-have-key-events`, `heading-has-content`, `html-has-lang`, `iframe-has-title`, `img-redundant-alt`, `interactive-supports-focus`, `label-has-associated-control`, `media-has-caption`, `mouse-events-have-key-events`, `no-access-key`, `no-autofocus`, `no-distracting-elements`, `no-interactive-element-to-noninteractive-role`, `no-noninteractive-element-interactions`, `no-noninteractive-element-to-interactive-role`, `no-noninteractive-tabindex`, `no-redundant-roles`, `no-static-element-interactions`, `role-has-required-aria-props`, `role-supports-aria-props`, `scope`, `tabindex-no-positive`.
- `off`: `anchor-ambiguous-text`, `label-has-for` (deprecated).
- Plus **`control-has-associated-label` turned on**, with the recommended config's own options:
  - `ignoreElements`: audio, canvas, embed, input, textarea, tr, video;
  - `ignoreRoles`: grid, listbox, menu, menubar, radiogroup, row, tablist, toolbar, tree, treegrid;
  - `includeRoles`: alert, dialog.
  
  It catches a `<button>` with no text and no `aria-label`, the web form of the acceptance case.

**Measured web hits: 29.** The largest are `no-redundant-roles` 18 (for example `apps/web/src/components/console/BillingHomeParts.tsx:498, 515`, `apps/web/src/components/console/FamilyNeedsYou.tsx:340`, `apps/web/src/components/console/GrownUpLock.tsx:659`), `no-noninteractive-element-interactions` 5, `no-interactive-element-to-noninteractive-role` 4, and `interactive-supports-focus` 1 (`apps/web/src/app/(console)/teach/space/curriculum/page.tsx:285`). `control-has-associated-label` and `label-has-associated-control` have 0.

**OD-AC7 (recommended): one local rule for the gap.** `react-native-a11y` accepts `<Pressable accessibilityRole="button" onPress={go}><Icon name="speaker" /></Pressable>`, which has a role but no name. That is the realistic regression: an icon button whose label is forgotten.

`hangul-route/touchable-has-name` flags a touchable, or an element whose `accessibilityRole` or `role` is `button`, `link`, `checkbox`, `switch`, `radio`, `tab` or `menuitem`, when **all** of these hold:
- it has no `accessibilityLabel`, `aria-label`, `aria-labelledby` or `accessibilityLabelledBy`;
- it has no spread;
- no child is JSX text or a `{…}` expression;
- no child is an element other than `Icon`, `Image` or an `svg` element.

It accepts `aria-label`, where `has-valid-accessibility-descriptors` does not. The two rules then agree on what passes: a labelled touchable without a role still needs a role for the plugin rule.

The design-system `Button` always names its `Pressable` (`accessibilityLabel={accessibilityLabel ?? label}`, `packages/design-system/src/components/Button/Button.tsx:185, 201`).

### 3.3 Today's lint violations: never `eslint-disable` (OD-AC5, OD-AC6)

The two methods below hold today's violations without any disable comment (`--no-inline-config` makes disables inert anyway). Both fail a new violation from the day AC-3 merges.

- **Method A (the WO's wording).**
  - A rule with no violations at AC-3 starts at `error`; a rule with violations starts at `warn`.
  - Each workspace's script carries `--max-warnings=<the warnings on main at AC-3>`, so one more warning fails.
  - A fix lowers the number in the same PR. ESLint does not fail on fewer warnings, so this is up to review. AC-3's ceiling test (below) only stops the number from rising.
  - On the AC-3b/AC-3c date, every `warn` rule becomes `error`.
- **Method B (recommended).**
  - Every rule is `error` from the start.
  - `eslint --suppress-all` records today's violations once, in `<workspace>/eslint-suppressions.json` (file → rule → count). Bulk suppressions are built into ESLint since 9.24, and present in 9.39.5 and 10.15.0.
  - A violation beyond a file's count fails.
  - When a suppressed violation is fixed, ESLint exits 2 ("There are suppressions left that do not occur anymore", `lib/cli.js`) until `--prune-suppressions` lowers or removes the entry. So the file only shrinks, the same ratchet as the touch-target list (`apps/mobile/e2e/web/target-size.spec.ts:24-37`).
  - A file **rename** that carries a suppressed violation re-records the same count under the new path, in the same PR, and says so.
  - On the AC-3b/AC-3c date the file must be empty, and it is deleted.

**Nothing may grow a ratchet without a test edit.** ESLint has three ways to grow one: `--suppress-all`, hand edits, and `--pass-on-unpruned-suppressions` (`lib/options.js:467` in 9.39.5). So:
- AC-3's config test pins a **ceiling map**: each workspace's suppressions as merged at AC-3 (under A, its `--max-warnings` value). It fails when the file has a key the map lacks, or a count above the map's. Raising a ceiling is then a visible test change that review must justify.
- `ci-workflows.test.mjs` asserts that the lint scripts carry `--max-warnings=0` (method B) and none of `--fix`, `--suppress-all`, `--suppress-rule` or `--pass-on-unpruned-suppressions`.

**False positives.** For each hit, AC-3 records in As built whether it is a real fault or a false positive. A false positive is handled only by:
- a rule option (for example, a component list);
- or, if no option fits, a file-scoped `off` for that one rule in `eslint.config.mjs`, with a comment that gives the reason and cites this section.

Every such entry is listed in As built and pinned by the config test. A false positive is never handled by a suppression, a disable comment or a `--fix`. A real fault waits in the suppressions file (B) or as a warning (A) until AC-3b or AC-3c fixes it.

**When the date passes.** Nothing happens by itself: no test turns red on a date. The suppressions keep holding, and the owner starts AC-3b or AC-3c (README §8: rows are not put in INBOX automatically). If a workspace has more than 40 hits at AC-3, AC-3 still merges, and only that workspace's date is asked of the owner again. Today's measured counts are 4, 0 and 29, all under 40.

### 3.4 The axe smoke: what it scans and how (AC-1, AC-2)

**How it scans.**
- **Engine**: `@axe-core/playwright` (`AxeBuilder`), tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`. `best-practice` is included because WO-39's acceptance names `heading-order`, `landmark-one-main` and `page-has-heading-one` (`docs/roadmap/review-2026-11/phase-5-native-a11y.md:137`). No experimental rules.
- **Excluded**: only the PWA overlay layer, `[data-testid="pwa-banners"]`, `[data-testid="install-guide"]` and `[data-testid="portrait-guard"]`. It appears on its own schedule (`apps/mobile/e2e/web/target-audit.ts:107-121`). Clerk's widget is third-party; it is excluded by its container if a build ever has a key.
- **Settled scan**: `analyze()` repeats until two runs 300 ms apart give the same rule → node-count map, at most 5 runs. This is the `settledOffenders` pattern (`target-size.spec.ts:47-69`).
- **Browser**: each config's defaults.
  - Mobile: Pixel 5, `en-US`, `scripts/serve-dist.mjs` (`apps/mobile/playwright.config.ts:23-46`).
  - Web: Chromium, `en-US`, `e2e/serve-out.mjs` on `out` or `E2E_OUT` (`apps/web/playwright.config.ts:19-35`).
  - Mobile specs take `test` from `e2e/web/fixtures.ts`: silent speech, and the release build's clips off.

**What it scans** († = added here):

| Screen id | Screen | Bundle · lane under (b) | Reached with existing code |
|---|---|---|---|
| `home` | Home of a fresh learner | release · `main` shards | `onboardChild(page, { name, startJourney: false })` (`e2e/web/helpers.ts:268-274`), `page.goto('/')`, ready on "Hi, ‹name›!" (as `target-size.spec.ts:74-80`) |
| `discover` | Quest Discover, Stage 1 quest 1, page 1 | release · shards | `onboardChild`, then Continue, ready on "Look and learn" (as `discover-check.spec.ts:58-64`) |
| `match-sound-round-1` | Match Sound round 1 | release · shards | Continue, `passDiscover` (`helpers.ts:457-468`), Play minigame, ready on "1 / 6" (as `audio.spec.ts:177-183`, which is local to that file; AC-1 composes the same steps and does not edit `audio.spec.ts`) |
| `culture-quiz-correct` | Culture Quiz right after a correct answer | release · shards | see below |
| `pin-entry` | PIN entry, Grown-up area | release · shards | `onboardChild`, then `openGrownUpZone(page, name)` (`helpers.ts:393-405`), ready on "Enter your 4-digit PIN to continue." |
| `site-home` † | the site's home `/` (AC-2 is "사이트·콘솔") | apps/web default export · `preview-deploy.yml` PRs | `page.goto('/')` (as `landing-layout.spec.ts`). Skipped when `E2E_OUT` is set: on the merged dist, `/` is the learner app |
| `signin` | Console sign-in `/signin` | default export · `preview-deploy.yml` PRs | `page.goto('/signin')` (as `locale-routes.spec.ts:116-118`). The default export has no Clerk key and the dev sign-in is off (`apps/web/src/lib/console/config.ts:79-84`), so the scan covers the page and its signed-out state |
| `class-page` | Teacher class page `/teach/space?id=space%3Aa` | billing lane on `main` (OD-AC8), or local | see below |

**`culture-quiz-correct`.**
- It opens like `openCultureQuiz` (`audio.spec.ts:445-456`; also `touch-matrix.spec.ts:69-77`): Picnic Snacks (`apps/mobile/src/content/quests.ts:222, 251`), Discover, Skip for now, Play minigame.
- **New in AC-1**: no existing spec answers this quiz correctly. The spec taps the option paired with the Korean heading in `minigame:s1-life-q3-apply` (`apps/mobile/src/logic/minigame-config.ts:335-345`: 토마토 Tomato, 코코아 Cocoa, 쿠키 Cookie, 토스트 Toast, 김밥 Kimbap).
- **Holding the state.** After a correct tap the game moves on after `afterSound(…, { minMs: 700 })` (`screens/minigames/CultureQuizGame.tsx:88`).
  - AC-1 installs `page.clock` before the first navigation and pauses it just before the tap. If axe needs a running timer, it steps the clock in steps under 700 ms. (Departure: a paused or stepped clock did not hold; the built spec wraps the page's `setTimeout` instead. See "AC-1 as built" in §9.)
  - Fallback: tap Hear first, with the never-answering speech engine of `audio-engine.spec.ts`. That holds the state for up to `ANSWER_SOUND_MAX_MS` = 2,500 ms (`logic/audio/reply-advance.ts:17`).
- Before and after the scan, the spec asserts that the pill reads "1 / 4" and that the tapped option shows the success fill (once WO-04 lands, its ", correct" name).

**`class-page`.**
- It reuses `mockClass` from `class-page-order.spec.ts:84-99`: the session is seeded in `sessionStorage`, and `page.route` answers the API with two learners and a plan.
- `class-page-order.spec.ts` itself is skipped unless `GROWNUP_E2E=1` and runs in no CI lane (`:20-24`).
- The billing lane's merged dist has an API base at `https://api.billing-e2e.test` and signs in from that session (`apps/web/e2e/billing.spec.ts:10-21`).
- The spec runs when `AXE_CONSOLE_E2E=1` (the lane, OD-AC8) or `GROWNUP_E2E=1` (local). It matches any cross-origin `/api/` call and is ready on two `student-card`s.

**The spec files.**
- AC-1: the five PWA screens in `apps/mobile/e2e/web/axe-smoke.spec.ts`.
- AC-2: `apps/web/e2e/axe-site.spec.ts` (`site-home`, `signin`; skipped when `E2E_OUT` is set) and `apps/web/e2e/axe-console.spec.ts` (`class-page`).
- One screen per test. After its first CI run, AC-1 may add its mean seconds to `scripts/e2e-shard-weights.json`; an unlisted file weighs 0.25 s.

### 3.5 The axe baseline file and when the smoke fails (OD-AC9)

**The file.** One per app: `apps/mobile/e2e/web/fixtures/axe-baseline.json` and `apps/web/e2e/fixtures/axe-baseline.json`. It holds the violations measured on `main` when the row lands, as a **node count per screen and rule**:

```json
{
  "note": "AMENDMENTS-A11Y-CI §3.5 axe ratchet. Violations found today, per screen and rule, as node counts. Never add an entry or raise a count. A PR that lowers a count or clears a rule updates this file in the same PR, so the file only shrinks.",
  "axeCore": "4.14.1",
  "tags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
  "screens": {
    "home": [{ "rule": "region", "nodes": 3, "impact": "moderate", "expectedFix": "WO-39 SS-3" }],
    "pin-entry": []
  }
}
```

The `region` entry shows the format only. `expectedFix` names the WO row expected to remove the entry, or `"none"`.

**Key and value.**
- The key is screen + rule, and the value is the node count. react-native-web's selectors are generated class chains that change with any style edit, so the file does not store them.
- The trade-off: a fix and a new violation of the same rule on the same screen cancel out. The test prints each node's `target`, the first 200 characters of its `html`, and its `failureSummary`.

**Comparison** (per screen):
- **new**: a rule with violations has no entry;
- **more**: a count is above its entry;
- **fewer**: a count is below its entry;
- **gone**: an entry's rule has no violations.

**Which results fail (OD-AC9).**
- **WO-08 says "새 위반만 실패": only new violations fail.** Revision 1 made fewer and gone fail too, like the touch-target ratchet (`target-size.spec.ts:24-37`, `target-audit.ts:98-105`). Under (b), that means an improvement merged by WO-39, WO-40 or WO-41 without a local scan turns `main` red.
- **Recommended:**
  - *new* and *more* always fail.
  - *fewer* and *gone* fail when the spec runs locally (`process.env.CI` unset). On CI they print a `::warning::` annotation naming the line to lower or remove, and the test passes.
  - A PR author who scans locally must shrink the file; `main` never turns red for an improvement.
  - Under (a) the strict rule works on the PR itself, and OD-AC9 can choose it.

**Guards.**
- **Version pin**: the smoke fails when `axe.version` differs from `axeCore`, so an axe-core update is a deliberate PR that re-measures.
- **Ceiling**: `axe-baseline.test.ts` pins a ceiling map (the file as merged). It fails if the JSON gains a key or a higher count, so raising a line is a visible test change (§3.3's rule).
- **Pure helpers**: the comparison lives in `axe-audit.ts`. It is unit-tested like `target-audit.ts` (`apps/mobile/src/config/__tests__/touch-target-ratchet.test.ts`) and `landing-targets.ts` (`apps/web/src/app/__tests__/landing-targets.test.ts`).

**Who shrinks it.**
- Any PR that changes a screen of §3.4, and every PR of WO-04 (F-A11Y-001), WO-39, WO-40 and WO-41, runs the axe specs **locally against a release build** and shrinks the file in the same PR. This follows the FINISH-2026-11 rule: the e2e specs a row touches run against a local release build.
- That step must be written into those specs' rows (§8).

### 3.6 How the baseline shrinks (WO-04, WO-39, WO-40, WO-41)

axe checks names, roles, ARIA validity, text contrast, document structure and `lang` validity. It does **not** check:
- a state shown by colour alone (WCAG 1.4.1);
- an announcement;
- Korean parts that lack `lang="ko"`;
- non-text contrast (1.4.11);
- a hard-coded English default label.

| WO | What it fixes | Expected baseline effect |
|---|---|---|
| WO-39 (SS-1 to SS-4) | heading levels, `role="main"`, titles, skip link | removes `heading-order`, `page-has-heading-one`, `landmark-one-main`, `region`, `document-title` (`docs/roadmap/review-2026-11/phase-5-native-a11y.md:137`) |
| WO-41 #2, #3 | text contrast (console `feedback.danger`, `feedback.info`, overlays, disabled composites) | removes `color-contrast` on the screens that draw them |
| WO-41 #1, #8 | borders; English default labels | none (axe cannot see them). Guarded by `packages/design-system/src/__tests__/contrast.test.ts` and WO-41's own tests |
| WO-04 (F-A11Y-001) | colour-only results; announcements; labels that follow the state | probably none. Guarded by F-A11Y-001's unit tests in `ci.yml`'s `unit` job (§3.1, D11) |
| WO-40 (LP rows) | Korean read with a Korean voice | probably none. Guarded by its own DOM test (WO-40's acceptance) |

AC-1 and AC-2 list each entry whose `expectedFix` is `"none"` in their PR descriptions, as new findings for the owner. They are not put in `docs/tasks/INBOX.md` (README §8 of the plan).

### 3.7 Acceptance: a button without `accessibilityLabel` fails CI; `main` passes

- **The mobile probe.** **Given** a throwaway branch `ci/a11y-lint-probe` off `main`, with one commit that adds `apps/mobile/src/components/A11yLintProbe.tsx`:

  ```tsx
  import { Pressable } from 'react-native';

  export function A11yLintProbe({ onPress }: { onPress: () => void }) {
    return <Pressable onPress={onPress} />;
  }
  ```

  **when** CI runs on its draft PR, **then** two things fail:
  - the job `Lint · typecheck · build · repo checks`, at its step "Lint, typecheck and build" (`ci.yml:64-65`), with `react-native-a11y/has-valid-accessibility-descriptors` from `@hangul-route/mobile#lint`;
  - so the required check **`lint · typecheck · test · build`** (`ci.yml:233-251`).
  
  The commit typechecks.
- **The web probe.** The same probe under `apps/web/src/components/` with `<button type="button" onClick={onClick} />` fails the same checks with `jsx-a11y/control-has-associated-label`.
- **The role-only probe, under OD-AC7.** `<Pressable accessibilityRole="button" onPress={onPress} />` fails with `hangul-route/touchable-has-name`. Without OD-AC7 it passes ESLint, and axe's `button-name` catches it only on a scanned screen, on `main`.
- **On `main`** the same checks pass.
- **Which check proves it.** Under (b), the lint step alone. Under (a), also `Build PWA · offline e2e`, for a nameless button rendered on one of the five PWA screens.
- **The standing proof.** AC-3's tests lint every probe above in memory, on every run (§6), so CI proves the gate on any PR from then on.
- **The probe PR is the owner's to trigger.** README §7 item 6: commits and PRs are made when the owner asks. On a private repository it costs about 31 billed minutes (`ci.yml` about 27, `web-app.yml` about 4).
  - AC-3 runs the probes locally and records the result: `pnpm --filter @hangul-route/mobile lint` and `pnpm --filter @hangul-route/web lint` exit 1 on the probe and 0 on `main`.
  - When the owner runs the probe PR, it is closed unmerged and its branch deleted.

## 4. Out of scope

- Lint for the six workspaces without JSX, and any style, correctness, `react-hooks` or `typescript-eslint` rule. A later spec may add them, and then revisits `--no-inline-config`.
- The 68 existing `eslint-disable` comments: left as they are.
- Fixing the recorded violations in AC-1 to AC-3. That is AC-3b, AC-3c, and WO-04, WO-39, WO-40 and WO-41.
- Native screen readers and the native app (WO-42, the owner's).
- Making `preview-deploy.yml` required, or trimming it for minutes.
- Colour-only state (WCAG 1.4.1) and announcements: F-A11Y-001.

## 5. UI sketch

N/A. CI only.

## 6. Tests

One commit = test + change.

**AC-3 (lint).**

The config tests load each config through ESLint's Node API (`new ESLint({ cwd, overrideConfigFile: 'eslint.config.mjs' })`, `lintText` with a `filePath` under `src/`, `calculateConfigForFile`). They do not import the `.mjs`. If a test must import it, add an `eslint.config.d.mts` beside it (precedent: `apps/mobile/scripts/audio/lib.d.mts`), because the packages are `strict` with no `allowJs`.

1. `apps/mobile/src/config/__tests__/eslint-a11y-config.test.ts`:
   - **One invalid snippet per enabled rule** (14 rules, plus OD-AC7's), each reporting exactly that rule. The §3.7 probe is the descriptors case.
   - Valid: `<Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={f} />`.
   - `<Pressable aria-label="x" onPress={f} />` still reports `has-valid-accessibility-descriptors` (a documented limit of the plugin).
   - `has-accessibility-hint` is off.
   - With `allowInlineConfig: false`, a snippet with `// eslint-disable-next-line react-hooks/exhaustive-deps` reports nothing.
   - A disable comment naming an enabled accessibility rule does **not** silence it.
   - `calculateConfigForFile` lists only `react-native-a11y/*` rules (and `hangul-route/*` under OD-AC7). Any file-scoped `off` from §3.3 is pinned by name.
   - The **ceiling map** of §3.3 for `apps/mobile/eslint-suppressions.json`.
2. The same for `packages/design-system` (`src/__tests__/eslint-a11y-config.test.ts`). Its ceiling is empty, because design-system has no hits.
3. `apps/web/src/app/__tests__/eslint-a11y-config.test.ts`:
   - one invalid snippet per enabled rule (32), including the `<button>` probe for `control-has-associated-label`;
   - valid: `<button type="button">Save</button>`;
   - only `jsx-a11y/*` rules are on;
   - the ceiling map for its 29.
4. Under OD-AC7: RuleTester cases in `packages/design-system/src/__tests__/touchable-has-name.test.ts`.
   - Valid: a text child, a `{label}` child, `accessibilityLabel`, `aria-label`, a spread.
   - Invalid: role-only with an `Icon` child, role-only and empty, an empty `TouchableOpacity`.
5. `scripts/__tests__/ci-workflows.test.mjs`, a new test "lint is a real gate":
   - the three `lint` scripts start with `eslint`;
   - they contain `--no-inline-config` and `--max-warnings=0` (method B);
   - they contain none of `--fix`, `--suppress-all`, `--suppress-rule`, `--pass-on-unpruned-suppressions`;
   - `ci.yml`'s `checks` job still runs `turbo run lint`.
6. Locally, recorded in the PR:
   - `pnpm exec turbo run lint` passes on the branch;
   - the §3.7 probes fail;
   - `node scripts/third-party-notices.mjs --check` passes;
   - each hit is classified real or false positive (§3.3).

**AC-1 (PWA axe).**
1. `apps/mobile/src/config/__tests__/axe-baseline.test.ts`:
   - new and more fail;
   - fewer and gone fail locally and warn on CI (as OD-AC9 decides);
   - equal passes;
   - a version mismatch fails;
   - the settle loop stops on two equal maps and throws after 5;
   - the ceiling map of the JSON.
2. `axe-smoke.spec.ts` passes locally on a release build (`pnpm --filter @hangul-route/mobile build:web`, then `exec playwright test axe-smoke.spec`).
3. A local probe adds a nameless role-button to Home. The smoke fails on `home` with `button-name`, new. The probe is not committed.
4. `node scripts/third-party-notices.mjs --check` passes. `@axe-core/playwright` is a devDependency; its licence is MPL-2.0.

**AC-2 (web axe).**
1. `apps/web/src/app/__tests__/axe-baseline.test.ts`, the same cases.
2. `axe-site.spec.ts` passes on the default export (`pnpm --filter @hangul-route/web build`, then `test:e2e`).
3. `axe-console.spec.ts` passes on the merged dist, with `AXE_CONSOLE_E2E=1` (the lane's commands, `billing.spec.ts:18-19`), and on the `GROWNUP_E2E` export (`class-page-order.spec.ts:18-19`).
4. Under OD-AC8 = lane, a new `ci-workflows.test.mjs` test pins the lane's own step:
   - the step is named "Console axe (merged dist)" and runs with `if: ${{ !cancelled() }}`;
   - it sets `AXE_CONSOLE_E2E: "1"` and `E2E_OUT: ../mobile/dist`;
   - it runs `e2e/axe-console.spec.ts`.
   
   The existing assertion at `:596-605`, which lists the specs that read `BILLING_E2E`, stays unchanged: the new spec does not read that variable.
5. `third-party-notices.mjs --check` passes.

## 7. Rollout

Next release.
- **Order**: AC-3 first (the PR gate), then AC-1 and AC-2, merged one after another (same files, §9). AC-4 follows those three.
- **The dated rows** AC-3b and AC-3c start when the owner starts them, on or after their dates.
- **Status**: this spec stays `in-progress` until the last of AC-3b and AC-3c, which sets `shipped`. This follows the precedent of `AMENDMENTS-DURABLE-PROGRESS.md` (DP-4), which kept the spec open until every row had merged.
- No flag.

## 8. Dependencies

- **Specs**:
  - F-COV-001 (amended).
  - F-A11Y-001 (WO-04), by name.
  - WO-39, WO-40 and WO-41 (Phase 5).
  - F-LAYOUT-001 §3.8 (the touch-target ratchet).
- **Rows in other specs.** **F-A11Y-001's AF-2 to AF-4, and the rows of WO-39, WO-40 and WO-41, must carry the step "run the axe specs locally against a release build and shrink `axe-baseline.json`"** (§3.5). Their spec authors add it. This file cannot edit them.
- **Owner decision 2026-11-18** (PR e2e on `main` only, #1043): kept under (b), changed under (a).
- **New devDependencies**, all exact versions, looked up with `npm view` on 2026-11-23.
  - Repository facts: Node 22 from `.nvmrc`; root `engines` `>=20.6`; no `.npmrc`, so `engine-strict` is off and an engine mismatch only warns; pnpm 10.33.0, TypeScript 5.9.3, React 18.3.1, React Native 0.76.5, react-native-web 0.19.13, Next 14.2.35, Playwright 1.63.0.
  - **The root `engines` stays `>=20.6`.** The new tools are dev-only and need Node 20.9+ (ESLint 9) and Node 22.12+ (`@axe-core/playwright`). CI's Node 22 meets both. A machine on an older Node gets a pnpm warning and should use `.nvmrc`.

| Package | Version | Where | Peer / engine check | Licence |
|---|---|---|---|---|
| `eslint` | **9.39.5** (OD-AC1; 10.15.0 is the pre-approved fallback inside AC-3 only) | mobile, web, design-system | engines `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0`. End of life since 2026-08-06 (eslint.org/version-support; v9.39.5, 2026-07-10, is its last release). 10.15.0 needs `^20.19.0 \|\| ^22.13.0 \|\| >=24` | MIT |
| `@typescript-eslint/parser` | 8.74.0 | same three | peers `eslint ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`, `typescript >=4.8.4 <6.1.0`: met | MIT |
| `eslint-plugin-jsx-a11y` | 6.10.2 (latest, 2024-10-26) | web | peer `eslint ^3 … \|\| ^9`: **met by 9.39.5**, not by 10. It uses `context.options`, `context.report` and `context.settings`, all present in 9 and 10. Depends on `axe-core ^4.10.0` (MPL-2.0), so the dev tree gets axe-core through it too | MIT |
| `eslint-plugin-react-native-a11y` | 3.5.1 (latest, 2024-11-04) | mobile, design-system | peer `eslint ^3 … \|\| ^8`: **unmet by 9 and 10**. It uses `context.options`, `context.report`, and in one rule `context.sourceCode \|\| context.getSourceCode()`; `sourceCode` exists in both. Its legacy `configs` are unusable in flat config, so the rules are listed by hand | MIT |
| `@axe-core/playwright` | 4.14.0 (latest stable) | mobile, web | peer `playwright-core >= 1.0.0` (1.63.0); engines `node >=22.12.0`. Depends on `axe-core ~4.14.0`, 4.14.1 today (pinned by the lockfile and by §3.5) | **MPL-2.0** (with axe-core) |

**Peer exception.** `pnpm-workspace.yaml` gets `peerDependencyRules.allowedVersions`, beside its other documented install decisions: `eslint-plugin-react-native-a11y>eslint: "9"` (with the fallback, also `"10"` for it and for `eslint-plugin-jsx-a11y`). Without it, pnpm only warns.

**All are devDependencies.** `scripts/third-party-notices.mjs --check` reads only the production tree and treats MPL as copyleft, so it would fail if axe-core ever reached `dependencies`.

**Nothing else is added**: no `@eslint/js`, `globals`, `typescript-eslint`, `eslint-config-next`, `eslint-plugin-react`, `eslint-plugin-react-hooks` or `@eslint/compat`.

## 9. Rows

| Row | Model | Contents | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| AC-0 | Opus 5.5 | This spec; multi-agent review; `ready` 2026-11-24 with §10 decided | doc checks | — | `docs/a11y-ci-spec` |
| AC-3 **built 2026-11-24** (As built below) | Sonnet 5.5 | §3.2 configs and scripts, OD-AC1/OD-AC2 devDependencies, the peer exception; §3.3 with OD-AC5's method, each hit classified, the ceiling maps; OD-AC7's rule if taken, with its `exports` entry; local probes recorded. If 9.39.5 fails the per-rule tests, AC-3 may switch to 10.15.0 and records why. Any later change of major goes back to the owner | §6 AC-3 1–6 | AC-0 `ready`; OD-AC1, 2, 5, 6, 7 | `ci/a11y-lint` |
| AC-1 **built 2026-11-24** (As built below) | Sonnet 5.5 | §3.4 PWA screens, `axe-audit.ts`, `axe-baseline.json` measured on a release build of `main` with `expectedFix`, devDependency; under (a) also the §3.1 PR steps, the shard listing and their test pins | §6 AC-1 1–4 | AC-0 `ready`; OD-AC3, 4, 9; merges after AC-3 (same `package.json` and lockfile) | `ci/a11y-axe-pwa` |
| AC-2 | Sonnet 5.5 | §3.4 web screens, `axe-audit.ts`, `axe-baseline.json`, devDependency; under OD-AC8 = lane, the "Console axe (merged dist)" step in the billing lane | §6 AC-2 1–5 | AC-0 `ready`; OD-AC3, 8, 9; merges after AC-3 and AC-1 (same lockfile) | `ci/a11y-axe-web` |
| AC-4 | Sonnet 5.5 | "Amended YYYY-MM-DD by AMENDMENTS-A11Y-CI" in F-COV-001; the `docs/specs/README.md` index line; status `in-progress (AC-3b, AC-3c open)`; a proposed CLAUDE.md §4/§8 line for the owner's approval: "lint is real (accessibility rules); `eslint-disable` does nothing; never raise an ESLint suppression or an axe baseline line" | — | AC-1, AC-2, AC-3 | `docs/a11y-ci-amended` |
| AC-3b | Sonnet 5.5 | apps/mobile and design-system: fix the remaining hits (today 4: the two descriptors hits, `apps/mobile/src/screens/minigames/role-play/RolePlayGame.tsx:377`, `apps/mobile/src/screens/account/AccountCover.tsx:25`, plus any in the entry roots). No disables; a new label means en, es and ko strings. Then delete the suppressions file (B) or flip `warn` to `error` (A) | AC-3's tests; `pnpm exec turbo run lint` | AC-3; the owner starts it | `fix/a11y-lint-mobile` |
| AC-3c | Sonnet 5.5 | apps/web: the same for its 3 real hits (28 raw at AC-3; 25 are false positives handled in `apps/web/eslint.config.mjs`, see As built); the last of AC-3b and AC-3c sets the status `shipped` | same | AC-3; the owner starts it | `fix/a11y-lint-web` |

**AC-3 as built (2026-11-24, branch `ci/a11y-lint`).**

- **Versions.** `eslint@9.39.5`, `@typescript-eslint/parser@8.74.0` in the three workspaces; `eslint-plugin-jsx-a11y@6.10.2` in apps/web; `eslint-plugin-react-native-a11y@3.5.1` in apps/mobile and design-system. The fallback to 10.15.0 was not needed: every per-rule test passes on 9.39.5. Peer exception `eslint-plugin-react-native-a11y>eslint: "9"` in `pnpm-workspace.yaml`; `pnpm install --frozen-lockfile` prints 0 warnings.
- **Rules enabled.** apps/mobile and design-system: 13 plugin rules plus `hangul-route/touchable-has-name` (the plugin has 14 rules; `has-accessibility-hint` is off, so §6's "14 rules" is 13 enabled plus the local rule). apps/web: 32 jsx-a11y rules (the 31 at `error` plus `control-has-associated-label`).
- **Files.** `apps/mobile/eslint.config.mjs`, `apps/web/eslint.config.mjs`, `packages/design-system/eslint.config.mjs`; the rule `packages/design-system/eslint/touchable-has-name.mjs` (+ `.d.mts`, `exports` entry, CLAUDE.md §2 line dated 2026-11-24). Suppressions files: `apps/mobile/eslint-suppressions.json` (4), `apps/web/eslint-suppressions.json` (3); design-system has none.
- **Tests.** `apps/mobile/src/config/__tests__/eslint-a11y-config.test.ts`, `packages/design-system/src/__tests__/eslint-a11y-config.test.ts`, `apps/web/src/app/__tests__/eslint-a11y-config.test.ts` (one invalid snippet per enabled rule, ceiling maps, disable comments inert, file-scoped `off`s pinned by name), `packages/design-system/src/__tests__/touchable-has-name.test.ts` (RuleTester), and "lint is a real gate" in `scripts/__tests__/ci-workflows.test.mjs`.
- **Cost.** `eslint` alone: mobile 6.7 s (418 files), web 4.2 s (159 files), design-system 1.6 s (47 files), local, cold.
- **Probes (§3.7), local.** A bare `<Pressable onPress>` in apps/mobile: `pnpm lint` exits 1 with `react-native-a11y/has-valid-accessibility-descriptors` (and `hangul-route/touchable-has-name`). A nameless `<button>` in apps/web: exits 1 with `jsx-a11y/control-has-associated-label`, and `turbo run lint` fails. The role-only Pressable fails with `hangul-route/touchable-has-name` (in the config test). Probe files removed; `turbo run lint` passes on the branch (10 of 10 tasks).

**AC-1 as built (2026-11-24, branch `ci/a11y-axe-pwa`).**

- **Dependency.** `@axe-core/playwright@4.14.0`, exact, devDependency of `apps/mobile` only (OD-AC3). The lockfile change is the importer line, the package entry and its snapshot (14 lines; `axe-core@4.14.1` was already in the tree through `eslint-plugin-jsx-a11y`). `pnpm install --frozen-lockfile` prints 0 warnings; `node scripts/third-party-notices.mjs --check` passes.
- **Files.** `apps/mobile/e2e/web/axe-smoke.spec.ts` (5 tests, one per screen), `axe-audit.ts` (pure helpers: `ruleCounts`, `compareBaseline`, `verdict`, `settledScan`, `versionMismatch`, `describeNodes`), `fixtures/axe-baseline.json`, and `apps/mobile/src/config/__tests__/axe-baseline.test.ts` (26 tests: new, more, fewer and gone with the local/CI split, equal, version mismatch, the settle loop at 2 equal reads and a throw after 5, the ceiling map, held equal to the JSON: lowering a count or clearing a rule edits the map in the same PR as the JSON, and raising one fails). No workflow change (option (b)): the spec joins the release-build list of the `main` shards by itself, and it skips itself on the fixture, gating and weekly-plan bundles. `scripts/e2e-shard-weights.json` is untouched (no CI run yet; an unlisted file weighs 0.25 s).
- **Baseline, measured on a release build of `main` (axe-core 4.14.1, Pixel 5, en-US), identical on every run after the readiness fix below (more than ten, serial and `--fully-parallel`):**

  | Screen | Rule | Nodes | Impact | Class | `expectedFix` |
  |---|---|---|---|---|---|
  | `home` | `region` | 8 | moderate | real: content outside any landmark (the tab bar and the page's blocks; the app has no `main` or `nav` landmark) | WO-39 SS-3 |
  | `discover` | `region` | 11 | moderate | real, same cause | WO-39 SS-3 |
  | `match-sound-round-1` | `region` | 3 | moderate | real, same cause | WO-39 SS-3 |
  | `match-sound-round-1` | `label-content-name-mismatch` | 4 | serious | real (WCAG 2.5.3): each letter tile is named "Korean letter g or k, tap to select" while its visible text is "ㄱ g/k", which the name does not contain; voice-control users cannot say what they see | none |
  | `culture-quiz-correct` | `region` | 4 | moderate | real, same cause | WO-39 SS-3 |
  | `culture-quiz-correct` | `label-content-name-mismatch` | 1 | serious | real (WCAG 2.5.3): the Hear button is named "Hear tomato", its visible text is "Hear it" | none |
  | `pin-entry` | `region` | 3 | moderate | real, same cause | WO-39 SS-3 |
  | `pin-entry` | `aria-prohibited-attr` | 1 | serious | real: the PIN dots row is a `div` with `aria-label="0 of 4 digits entered"` and no role, so most screen readers drop the label | none |

  There are no false positives. **New findings for the owner (`expectedFix` `none`, AC-1's PR description repeats them): the two `label-content-name-mismatch` entries and `aria-prohibited-attr`.** None of the three is fixed by WO-39; WO-41 #8 (English default labels) does not cover them either.
- **How a screen is scanned.** Each test onboards a fresh learner (`onboardChild`) and scans with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`, the overlay layer excluded, after a settle loop (two equal rule-to-count maps 300 ms apart, at most 5 reads). Two readiness details were needed to make the result stable, and are in the spec: Match Sound's four glyphs have no layout box for the first half second, and a scan before that read `label-content-name-mismatch` as 0 (reads 1 and 2 of a run gave 0, read 3 on gave 4), so the test first waits for all four glyphs to be visible; and Home was scanned at four dates from December 2026 to September 2027 with the same result (`region` 8), so the count does not depend on the day.
- **`culture-quiz-correct` departs from §3.4's `page.clock` plan.** A paused `page.clock` hangs axe-core (it runs on the page's timers, `frame.evaluate` timed out at 60 s), and stepping the clock 1 ms at a time was flaky (in some runs `clock.runFor` threw "page closed", in another axe hung). The spec instead wraps the page's `setTimeout` in an init script: while `window.__axeHold` is set, a 700 ms timer (the quiz's `afterSound(..., { minMs: 700 })`) is never scheduled, and every other delay runs as usual. The spec sets the flag just before the tap and checks before the scan that the tapped option's fill changed and differs from another option's, and after the scan that the pill still reads "1 / 4". It held in every run after the change (8 in a row, then the full-spec runs).
- **Probes, local.** (1) New: `<View role="button" accessible style={{ width: 24, height: 25 }} />` in `HomeScreen.tsx` on a rebuilt release build failed `home` with `new axe rule "button-name" on 1 node(s)` and printed the node (`<button role="button" ... style="width: 24px; height: 25px;">`); the probe was reverted and the build redone. (2) Fewer and gone: with `home.region` raised to 9 and a `discover` `heading-order` line added to a copy of the baseline, the local run failed with `lower "region" from 9 to 8` and `remove the "heading-order" line (was 2)`, and with `CI=1` the same two lines printed as `::warning title=axe baseline::` and both tests passed. The baseline was restored from the saved copy.
- **A trap while verifying.** `playwright.config.ts` reuses a server already on port 4173 (`reuseExistingServer` for the release build), so a second checkout running Playwright at the same time makes the specs scan the other checkout's `dist`. It did happen during this row (another worktree's `serve-dist` was listening); the final record was taken with a throwaway config on another port (`PORT=4199`, not committed), and the counts are the same. Check `lsof -nP -iTCP:4173 -sTCP:LISTEN` before recording or shrinking a baseline.

**Measured hits (without suppressions or false-positive handling), and how each was classified.**

| Workspace | Raw | Real, held in suppressions | False positive, handled in config |
|---|---|---|---|
| apps/mobile | 6 | 4 | 2 |
| apps/web | 28 | 3 | 25 |
| design-system | 0 | 0 | 0 |

The spec's web count was 29; its own breakdown (18 + 5 + 4 + 1) sums to 28, and 28 is what ran.

*apps/mobile, real (the four of §3.2, AC-3b's list; each is held in `eslint-suppressions.json`):*
- `src/screens/account/AccountCover.tsx:25`, `has-valid-accessibility-ignores-invert-colors`.
- `src/screens/minigames/role-play/RolePlayGame.tsx:377`, `no-nested-touchables`.
- `src/screens/parent/BiometricShortcutCard.tsx:61`, `has-valid-accessibility-descriptors` (a Pressable hidden from assistive tech; the fix is `accessible={false}`).
- `src/screens/reviews/StageReviewScreen.tsx:406`, `has-valid-accessibility-descriptors` (the `aria-hidden` dimmer; the same fix).

*apps/mobile, false positive (2), by rule option:* `hangul-route/touchable-has-name` at `src/screens/notes/HideConfirmSheet.tsx:30` (`accessible={false}`) and `src/screens/reviews/StageReviewScreen.tsx:406` (`aria-hidden`). Both are dimmed-backdrop Pressables that assistive tech never reaches, so they need no name. The rule gained an option `ignoreHidden` (default off; the configs of apps/mobile and design-system set it to `true`): it skips an element with `accessible={false}`, `aria-hidden`, `accessibilityElementsHidden`, or `importantForAccessibility="no-hide-descendants"` (plain `no` is Android-only, iOS ignores it, so it does not count). Without it the AC-3b fix named above (`accessible={false}`) would not clear the local rule.

*apps/web, real (3), held in suppressions:* `jsx-a11y/no-redundant-roles` for `<section role="region" aria-labelledby>` at `src/components/console/FamilyNeedsYou.tsx:340`, `GrownUpLock.tsx:659`, `PinResetPage.tsx:160`. Removing the role is the fix (AC-3c).

*apps/web, false positive (25):*
- **By rule option, 19.**
  - `no-redundant-roles` option `ul: ['list'], ol: ['list']` (13): `<ul|ol role="list">` with `list-style: none`, which WebKit needs for VoiceOver (documented at `SiteFooter.tsx:63` and `LearningRouteParts.tsx:257`). Files: `HomePage.tsx` (160, 214, 246), `LanguageMenu.tsx:121`, `LearnersPage.tsx` (97, 132), `LicensesPage.tsx` (66, 91), `SiteFooter.tsx:72`, `TeachersPage.tsx:125`, `site-parts.tsx` (90, 107), `LearningRouteParts.tsx:258`.
  - `no-redundant-roles` option `thead: ['rowgroup'], tbody: ['rowgroup']` (2) and `no-interactive-element-to-noninteractive-role` option `td: ['cell']` (4): the receipts table (`BillingHomeParts.tsx` 498, 515, 521, 525, 528, 531) sets `display: block` on its parts (`.hr-bill-table`), which drops table semantics the same way. The rule's default exception `nav: ['navigation']` is kept, because setting options replaces it.
- **By file-scoped `off`, 6 (no option fits).**
  - `no-noninteractive-element-interactions` (5): `AttentionParts.tsx:354`, `ConfirmSheet.tsx:154`, `DisplaySheet.tsx:189`, `StepUpDialog.tsx:184`, `TransferParts.tsx:207`. A modal dialog handles its own Escape and Tab keys on the dialog element (WAI-ARIA dialog pattern). The rule's options are keyed by element type (`div`), not role, so the only option that fits would exempt every `div`. The rule is off for those five files only.
  - `interactive-supports-focus` (1): `src/app/(console)/teach/space/curriculum/page.tsx:285`, a `radiogroup` that holds the arrow-key handler of its radio chips (roving focus; the chips are the focusable parts). Off for that file only.
- Every option and `off` carries a reason comment in `eslint.config.mjs` citing §3.3, and is pinned by `apps/web/src/app/__tests__/eslint-a11y-config.test.ts`.

**Judgment calls to confirm (not spelled out in §3.2/§3.3).**
- `ignoreHidden` on the local rule (above) is an addition to OD-AC7's four conditions. It is a rule option, off by default, as §3.3 allows.
- The 19 option and 6 `off` entries reduce apps/web's held hits from 28 to 3, so AC-3c is much smaller than "29 hits". If the owner wants those 25 fixed in code instead, the option or `off` is removed and the entries are recorded in the suppressions file by `--suppress-all`, in a follow-up.

**Same files.**
- AC-1, AC-2 and AC-3 all change `pnpm-lock.yaml`. AC-1 and AC-3 change `apps/mobile/package.json`; AC-2 and AC-3 change `apps/web/package.json`. Merge them one after another, and rebuild the lockfile with `pnpm install`, never by hand.
- AC-3b and AC-3c may touch files in README §6's serial table (the plan's). They certainly touch `packages/i18n/src/messages/en/*.ts` if a label is added. They check that table before starting.
- WO-04's AF rows and WO-39's rows change AC-1's `culture-quiz-correct` and `home` entries (§3.5).

## 10. Owner decisions (all taken 2026-11-24, as recommended)

| ID | Decision | Options | Recommendation | Gates | Decided |
|---|---|---|---|---|---|
| **OD-AC1** | ESLint for mobile, web and design-system: `eslint`, `@typescript-eslint/parser@8.74.0`, and in apps/web `eslint-plugin-jsx-a11y@6.10.2`, all exact devDependencies | **`eslint@9.39.5`**: jsx-a11y's peer is met; one peer exception (react-native-a11y); end of life, but pinned and dev-only, and the repository runs no Dependabot or Renovate. **Or `eslint@10.15.0`**: current; two peer exceptions; narrows Node to `^20.19 \|\| ^22.13 \|\| >=24` | **9.39.5.** Move to 10 in its own PR once jsx-a11y supports it. 10.15.0 is pre-approved as a fallback inside AC-3 only, if a per-rule test fails on 9 | AC-3 | Owner decision 2026-11-24: as recommended. `eslint@9.39.5`, `@typescript-eslint/parser@8.74.0`, `eslint-plugin-jsx-a11y@6.10.2`; 10.15.0 only as the in-AC-3 fallback |
| **OD-AC2** | `eslint-plugin-react-native-a11y@3.5.1` for mobile and design-system, with the peer exception (its range ends at ESLint 8; last release 2024-11-04) | add it **or** write the checks as local rules | **Add it.** It uses only rule APIs ESLint 9 and 10 have, and AC-3's per-rule tests prove each enabled rule fires | AC-3 | Owner decision 2026-11-24: as recommended. Add `eslint-plugin-react-native-a11y@3.5.1` with the peer exception |
| **OD-AC3** | `@axe-core/playwright@4.14.0` (axe-core 4.14.x; MPL-2.0) for mobile and web; jsx-a11y already brings axe-core into the dev tree | add it **or** no axe, which cuts AC-1 and AC-2 and leaves ESLint only | **Add it**, devDependency only | AC-1, AC-2 | Owner decision 2026-11-24: as recommended. Add `@axe-core/playwright@4.14.0`, devDependency only |
| **OD-AC4** | Where axe runs | (a) a PR step in `web-app.yml`'s build job: PR-time axe on 5 screens; flaky tests in a required check; changes the 2026-11-18 decision and CLAUDE.md §4. **Or** (b) ESLint is the PR gate and axe runs on `main`. Cost: free while public; CI barely runs on a private quota; on a paid private repository (a) adds about $4 to $12 per 30 days | **(b)**: ESLint covers every file; the 2026-11-18 decision stays; flakes stay off the required checks | AC-1 (and AC-2's lane) | Owner decision 2026-11-24: as recommended, (b) |
| **OD-AC5** | How today's ESLint hits are held | A: per-rule `warn`, `--max-warnings` = today's count, `error` on a date (the WO's wording). **Or** B: all `error`, ESLint bulk suppressions that only shrink, empty by a date. Both with the ceiling test and no disables | **B**: exact per file and rule, fails on new and on stale entries, no custom script. It changes the WO's "warn first" wording | AC-3, AC-3b, AC-3c | Owner decision 2026-11-24: as recommended, method B |
| **OD-AC6** | The dates for AC-3b and AC-3c | relative to AC-3's merge, or fixed dates | **AC-3b: 4 weeks after AC-3 merges** (4 hits). **AC-3c: 7 weeks after** (29 hits). Nothing triggers on the date: the owner starts the row. If a workspace has more than 40 at AC-3, AC-3 still merges and only that date is asked again | AC-3b, AC-3c | Owner decision 2026-11-24: as recommended. Relative dates: AC-3b 4 weeks and AC-3c 7 weeks after AC-3 merges |
| **OD-AC7** | The local rule `hangul-route/touchable-has-name`, in a new folder `packages/design-system/eslint/` | Add it there, with an `exports` entry `"./eslint/touchable-has-name": "./eslint/touchable-has-name.mjs"` (apps/mobile imports it through `@hangul-route/design-system/eslint/touchable-has-name`). It sits outside coverage (`src/**/*.ts`) and is tested by RuleTester under `src/__tests__/`. It needs a CLAUDE.md §2 approval line ("2026-xx-xx 오너 승인: `packages/design-system/eslint/` (AMENDMENTS-A11Y-CI OD-AC7)"). **Or** add it under `packages/design-system/src/eslint/`, also a new folder. **Or** accept the gap | **Add it in `packages/design-system/eslint/`**, with the exports entry and the §2 line. A forgotten label on an icon button with a role is the likeliest real regression | AC-3 | Owner decision 2026-11-24: as recommended. `packages/design-system/eslint/` with the `exports` entry; the owner approves the new folder, and AC-3 adds the CLAUDE.md §2 line |
| **OD-AC8** | Where the teacher class page is scanned | **The billing lane on `main`**: a new step "Console axe (merged dist)" with `AXE_CONSOLE_E2E=1` and `if: ${{ !cancelled() }}`; +0 to 1 min per push. **Or** local only: the spec reads only `GROWNUP_E2E`, like `class-page-order.spec.ts` | **The billing lane.** Its merged dist already has the API base and the session bridge | AC-2 | Owner decision 2026-11-24: as recommended, the billing lane |
| **OD-AC9** | Which baseline results fail | **Strict**: new, more, fewer and gone all fail everywhere (the touch-target precedent; under (b), an unscanned improvement turns `main` red). **Or WO-shaped**: new and more fail everywhere; fewer and gone fail locally and warn on CI | **WO-shaped** under (b). Strict only if OD-AC4 = (a) | AC-1, AC-2 | Owner decision 2026-11-24: as recommended, WO-shaped |

**What the decisions rule out.** The rows do not build the options the owner did not take: option (a), with its PR steps and shard listing (OD-AC4); method A (OD-AC5); a local-only class page (OD-AC8); the strict ratchet (OD-AC9). The rest of this spec still describes them, for the record. Where a sentence says "under OD-AC7", "under OD-AC8 = lane" or "method B", that branch is the one now in force.

## 11. Departures from WO-08

- **D1 The file.** `AMENDMENTS-A11Y-CI.md`, amending F-COV-001, instead of rows in F-A11Y-001: that spec is being written in parallel.
- **D2 Option (b) is recommended.** The acceptance is then proved by ESLint alone, as the WO's `> 재확인` line foresaw.
- **D3 The probe is defined exactly.** `react-native-a11y` has no label rule; the role-only case needs OD-AC7.
- **D4 Method B** for today's lint hits, taken by OD-AC5 on 2026-11-24, instead of the WO's per-rule `warn`.
- **D5 `--no-inline-config`.** The 44 disable comments in linted files would otherwise fail ESLint, and the flag makes "no `eslint-disable`" mechanical.
- **D6 `has-accessibility-hint` is off**: about 515 hits, and WCAG does not require hints.
- **D7 `preview-deploy.yml`** already runs apps/web's Playwright on path-filtered PRs. The WO missed it.
- **D8 The site's home is added** to AC-2's screens.
- **D9 "The baseline shrinks with WO-04, WO-40, WO-41" is corrected** (§3.6).
- **D10 Added rows.** AC-3b and AC-3c (the dated step, split by workspace) and AC-4 (the finish).
- **D11 WO-04's class is guarded by unit tests, not by WO-08.** The goal "WO-04 류의 회귀가 CI 에서 걸린다" is met for WO-04's own class (colour-only, unannounced, unchanged labels) by F-A11Y-001's unit tests in the `unit` job. WO-08 guards names, roles, ARIA, text contrast and structure.
- **D12 The baseline's fail rule is an owner decision.** Revision 1 failed fewer and gone too, departing from the WO's "only new violations fail" without saying so. That is now OD-AC9, recommended WO-shaped on CI.

## 12. Review log

**2026-11-23**: revision 1 (AC-0), draft.

**2026-11-24**: two-lens multi-agent review (tooling truth; charter, process and ops). No blockers. Revision 2 adjudicates as follows.

*Fixed.*
- **Tooling lens.**
  - **1.** The mobile counts are measured (descriptors 2, `no-nested-touchables` 1, invert-colors 1, design-system 0), with file:line.
  - **2.** The web count is measured: 29.
  - **3.** The descriptors rule ignores `aria-label`; no `--fix`, ever; a test pins both.
  - **4.** `ignoreDuringBuilds` is dropped: it is a no-op in Next 14.2.35.
  - **5.** Tests load the configs through ESLint's API; `.d.mts` if one must be imported.
  - **6.** `BrowseApp.tsx` and `PresenterApp.tsx` are linted.
  - **7.** The engines are stated; the root `engines` is unchanged.
- **Charter lens.**
  - **1.** §3.1 "What (b) does not catch on a PR", and D11.
  - **2.** Cost in three states, ops factors, OD-AC4 rewritten.
  - **3.** Strict ratchet: D12 and OD-AC9; §8 asks the other specs to carry the shrink step.
  - **4.** Ceiling maps in AC-3, AC-1 and AC-2; forbidden flags pinned; a disable naming an a11y rule still reports.
  - **5.** The false-positive path of §3.3.
  - **6.** OD-AC1 now recommends 9.39.5; one invalid snippet per enabled rule; fallback only inside AC-3.
  - **7.** OD-AC3 notes axe-core via jsx-a11y and labels "no axe" as a cut; `third-party-notices --check` in AC-1 and AC-2.
  - **8.** Relative dates; AC-3b and AC-3c split; owner-started; no time-bomb test; what ">40" means.
  - **9.** OD-AC7 names the `exports` entry, the coverage position and the CLAUDE.md §2 line, with `src/eslint/` as an alternative.
  - **10.** OD-AC8 uses its own env var and step; the `:596-605` assertion stays untouched.
  - **11.** The scope line is complete.
  - **12.** AC-4 leaves the status `in-progress` until AC-3b and AC-3c; AC-1 and AC-2 merge after AC-3; overlap with README §6 noted.
  - **13.** The probe PR is the owner's; the in-memory tests are the standing proof.
  - **14.** The billing annotation is paraphrased; the public-state case is added to OD-AC4.
  - **15.** AC-4 proposes a CLAUDE.md line for the owner.

*Kept.*
- **Method B stays the recommendation** (OD-AC5): the review agreed the suppressions and the CLI flag are right.
- **The baseline key stays screen + rule with a node count, not node selectors**: react-native-web's class chains churn on any style edit.
- **The OD-AC7 location stays `packages/design-system/eslint/`, not `src/eslint/`**: a rule module is not app source and should not be counted as untested source. Either way a new folder needs the §2 line, and the alternative is listed.

*Moved.*
- **The shrink step for the baseline** moves into the rows of F-A11Y-001 and of WO-39, WO-40 and WO-41 (§8), so it does not live only in this file.
- **The decision on the strict ratchet** moves to the owner (OD-AC9).

**2026-11-24**: owner decisions, in session ("전부 권고대로 승인"): OD-AC1 to OD-AC9 all as recommended, recorded in §10. The status is now `ready`. AC-3 may start, and AC-1 and AC-2 follow it (§7).
