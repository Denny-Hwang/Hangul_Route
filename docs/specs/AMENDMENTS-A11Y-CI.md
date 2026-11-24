# AMENDMENTS-A11Y-CI — accessibility checks in CI: a lint gate on pull requests, an axe ratchet on main

Status: draft (2026-11-23). Row AC-0 of work order WO-08 (`docs/roadmap/review-2026-11/phase-1-safety.md`, "WO-08 CI 에 접근성 검사를 넣는다"). The WO was written on `d5ba0217c`. This spec re-reads every citation on main `e72336a7d` and again on `d679cc8a7` (two commits later; neither touches a cited line). The owner decisions this spec needs are in §10 (OD-AC1 to OD-AC8). The spec cannot be `ready` until they are taken.

**Amends**: F-COV-001 (Coverage Gate Enforcement). F-COV-001 closed one of the "CI gate is a lie" risks, the coverage gate (its §1). This amendment closes two more: the `lint` task runs nothing in any workspace, and nothing checks accessibility. F-COV-001's coverage rules are unchanged. · tag **[AC]**
**Why an AMENDMENTS file**: WO-08 lets the rows go either into F-A11Y-001 or into a change of F-COV-001. Another session is writing F-A11Y-001 in parallel (WO-04, row AF-0). Rows added to that file now would collide. README §5.1 step 2 of the review plan puts changes to an existing spec in an `AMENDMENTS-<TOPIC>.md` file, so the CI part lives here. **F-A11Y-001** (answer feedback and announcements) is referred to by name only.
**Scope** (files the rows touch): `apps/mobile/package.json`, `apps/web/package.json`, `packages/design-system/package.json` (lint scripts and devDependencies); `apps/mobile/eslint.config.mjs`, `apps/web/eslint.config.mjs`, `packages/design-system/eslint.config.mjs` (new); `pnpm-lock.yaml`; `pnpm-workspace.yaml` (peer exceptions, OD-AC1/OD-AC2); `apps/web/next.config.js` (`eslint.ignoreDuringBuilds`); the suppressions files of §3.3 (method B); `apps/mobile/e2e/web/axe-smoke.spec.ts`, `axe-audit.ts`, `fixtures/axe-baseline.json` (new); `apps/web/e2e/axe-site.spec.ts`, `axe-console.spec.ts`, `axe-audit.ts`, `fixtures/axe-baseline.json` (new); their unit tests (§6); `scripts/__tests__/ci-workflows.test.mjs`; `.github/workflows/web-app.yml` (one spec path in the billing lane, only if OD-AC8 = lane; under OD-AC4 (a) also the PR step of §3.1). Nothing in `ci.yml` changes under the recommended option.
**Owner**: solo dev
**Rollout**: next release (CI only; nothing a learner sees)

---

## 1. Context

### 1.1 What CI checks today

- Every workspace's `lint` script is an `echo`. The WO named three: `apps/mobile/package.json:13`, `apps/web/package.json:10`, `packages/design-system/package.json:45`. The other six do the same: `apps/api/package.json:10`, `packages/backend/package.json:12`, `packages/content-schema/package.json:33`, `packages/i18n/package.json:17`, `packages/shared-types/package.json:13`, `packages/test-utils/package.json:13`.
- `ci.yml` job `checks` ("Lint · typecheck · build · repo checks", `.github/workflows/ci.yml:29-30`) runs `pnpm exec turbo run lint typecheck build` (`:64-65`). The lint part does nothing. The required check is the separate job `ci` ("lint · typecheck · test · build", `:233-251`), which fails when `checks` or `unit` fails.
- The `main-protection` ruleset requires three checks (read with `gh api repos/…/rulesets/24631759` on 2026-11-23): `lint · typecheck · test · build`, `Build PWA · offline e2e`, `Measure coverage vs rolling targets`. `scripts/__tests__/ci-workflows.test.mjs:99-175` keeps their layout honest. One of its rules matters here: a required check's workflow may have no `paths` filter on `pull_request` (`:110-116`).
- No ESLint is installed and no ESLint config exists. `git ls-files` finds no `eslint.config.*`, `.eslintrc*` or `.eslintignore`, and `pnpm-lock.yaml` has no `eslint` entry.
- No axe is installed. No `package.json` and no lock entry names `axe-core` or `@axe-core/playwright`. Where axe appears in the code, it is in comments that quote the 2026-11-15 product review's one-off scan (`apps/mobile/src/navigation/tab-button.tsx:63`, `apps/mobile/src/screens/__tests__/progress-labels.test.tsx:10`; review: `docs/launch/product-review-2026-11-15.md:24, 192, 196`).
- 68 `eslint-disable` comments exist under `apps/mobile/src` (57 in 34 `.tsx` files, 8 in `.ts` files) and `packages/design-system/src` (3 in 3 `.tsx` files). They name rules from plugins this repo never installed: `react-hooks/exhaustive-deps` 50 times, `@typescript-eslint/no-explicit-any` 16, `@typescript-eslint/no-namespace` 1, and the core rule `no-control-regex` 1. An example is `apps/mobile/src/components/ProfileLockCard.tsx:61`. `apps/web/src` has none. In ESLint 9 and 10, a disable comment that names a rule ESLint does not know is itself an error ("Definition for rule '…' was not found", `lib/linter/file-report.js:93-97` and `linter.js` `createDisableDirectives` in both `eslint@9.39.5` and `eslint@10.15.0`). §3.2 handles this without touching those comments.

### 1.2 Where Playwright runs, and how CI runs while the repository is private

- **`web-app.yml`, pull request** (owner decision 2026-11-18, #1043; `web-app.yml:25-29`): a change check, then the release build (`:132-134`) and the wrangler dry run (`:136-138`). The fixture bundles and the uploads run on push only (`:144-210`). The required check `Build PWA · offline e2e` passes a pull request once the build has passed (`:587-590`). CLAUDE.md §4 says the same.
- **`web-app.yml`, push to `main`**: four e2e shards (`:226-235`; `if` at `:230`) run the whole release-build list (`playwright test --list`, dealt by `scripts/e2e-shard-list.mjs`, `:294-309`) plus the fixture lists. The billing and grown-up home lane (`:454-458`) runs on the app-host build with an API base at a mock host. The WO's line "Playwright 는 `web-app.yml` 에서 이미 돈다" holds only for pushes to `main`.
- **Not in the WO:** `preview-deploy.yml` ("Web Console (static export)") runs **apps/web's whole Playwright suite on pull requests** (`pnpm --filter @hangul-route/web test:e2e`, `:107-111`). It does so only for pull requests that touch `apps/web/**`, `packages/design-system/**`, `packages/content-schema/**`, `packages/i18n/**` or `content/stories/**` (`:8-18`), on the default static export. Its job is not a required check (ruleset above), and its path filter means it cannot become one (the `ci-workflows` rule above).
- `switch-on-e2e.yml` runs nightly and on demand (`:17-25`), never on a pull request.
- **While private:** `AMENDMENTS-FINISH-2026-11.md:11, 19` says CI does not run while the repository is private and out of Actions minutes. Each row is checked locally (typecheck, lint, the unit suites it touches, the e2e specs it touches against a local release build), and the full CI run happens once, when the owner opens the repository. That happened. From 2026-11-18 11:55 to 2026-11-19 16:13 UTC, and again around 2026-11-22 08:00 UTC, jobs did not start. The job annotation read: "The job was not started because recent account payments have failed or your spending limit needs to be increased". Since 2026-11-22 08:17 UTC every pull request has run CI, and on 2026-11-23 `gh repo view` reports the repository **PUBLIC**. This spec plans for the binding case, a private repository with counted minutes, and gives the public numbers too.
- Private repositories run on 2-core runners, public ones on 4-core runners (`ci.yml:110-112`). The e2e shards took 19 to 22 min on 4 cores and 35 to 39 min on 2 cores (`web-app.yml:232-234`, PR #1043).

### 1.3 WO-08's citations, re-verified

| WO says | On `e72336a7d` / `d679cc8a7` | Verdict |
|---|---|---|
| 확인: `apps/mobile/package.json:13`, `apps/web/package.json:10`, `packages/design-system/package.json:45` `lint` = `echo '(no lint yet …)'` | Same lines, same text. No commit since `d5ba0217c` touched these lines. (`ce8dc196b` changed the `ios`/`android` scripts of `apps/mobile/package.json`; `lint` is still at `:13`.) | true |
| 보고: ESLint 설정 파일 없음 | None tracked; none in the lockfile | true |
| 보고: axe 계열 0건 | No dependency. Only comments quoting the 2026-11-15 one-off scan | true |
| 보고: `.github/workflows/ci.yml:65` `turbo run lint` 가 no-op | `:65` is `run: pnpm exec turbo run lint typecheck build` in job `checks` (`:29-30`). The lint part is a no-op in **all nine** workspaces, not three | true, incomplete |
| 보고: Playwright 는 `web-app.yml` 에서 이미 돈다 | On push to `main` only (since #1043). apps/web's suite also runs on path-filtered PRs in `preview-deploy.yml:107-111`, which the WO does not mention | partly true; §3.1 uses the missing half |
| 재확인 줄: PR 에서는 릴리스 빌드와 dry run 만, 샤드는 main push 만 | `web-app.yml:25-29, 132-138, 226-235, 587-590` | true |
| 재확인 줄: FINISH 는 "비공개인 동안 CI 는 돌지 않는다" | `AMENDMENTS-FINISH-2026-11.md:19`. The repository is public on 2026-11-23 (§1.2) | true as a rule; the state has changed for now |
| 결정 사항: WO-04, WO-40, WO-41 이 머지될 때마다 기준선을 줄인다 | Partly false. axe cannot see most of what WO-04 and WO-40 fix (§3.6) | corrected in §3.6 |
| 수용 기준: `accessibilityLabel` 없는 버튼 → CI 실패 | `eslint-plugin-react-native-a11y` has no rule that requires a label. Its closest rule is satisfied by `accessibilityRole` alone (§3.2, §3.7) | the probe is defined exactly in §3.7; OD-AC7 closes the gap |

## 2. User story

> As a learner who uses a screen reader, I can trust that every button I reach says what it does. A change that adds a nameless button is stopped before it reaches me.
>
> As the solo developer, I find out on the pull request, in seconds, when I add a touchable with no accessibility props. I find out on `main` when a screen I scan gets a new axe violation. I never have to bury old problems under `eslint-disable`.

## 3. Acceptance criteria

### 3.1 Where the checks run: option (a) or (b) (OD-AC4)

**(a) A light PR job that runs axe.** ESLint (AC-3) is the lint gate under both options. Under (a), the PWA axe smoke (AC-1) also runs on pull requests, as extra steps in the existing `build` job of `web-app.yml`, after the release build (`if: needs.changes.outputs.run == 'true' && github.event_name == 'pull_request'`). Those steps restore the Playwright browsers, run `playwright install --with-deps chromium` and then `playwright test axe-smoke.spec` on the `dist` the job has just built. No artifact is uploaded and no new job is added, so the `pwa` gate and its `needs` stay as they are (`ci-workflows.test.mjs:149-175`). The shard listing then leaves `axe-smoke.spec` out, so it does not run twice. A failure fails `Build PWA · offline e2e` on the pull request. Under (a), the owner decision of 2026-11-18 changes from "pull requests run the release build only" to "the release build and the axe smoke", and CLAUDE.md §4 changes with it.

**(b) ESLint as the PR gate, axe as a `main` alarm (recommended).** AC-3 replaces the `echo` scripts with ESLint. `ci.yml:65` already runs `turbo run lint` inside `checks`, so the gate appears with **no workflow change**. The PWA axe smoke (AC-1) is a new spec file in `apps/mobile/e2e/web/`. It joins the release-build list of the `main` shards by itself (`web-app.yml:300`), also with no workflow change. A new violation turns `main` red. The red is an alarm: the deploy is Cloudflare Workers Builds on every push (`web-app.yml:3-6`) and is not gated by it. The site and sign-in scans (AC-2) run in `preview-deploy.yml`'s existing `test:e2e` step on the pull requests it covers, as a visible but non-required check. Under OD-AC8 = lane, the teacher class page scan runs in the billing lane on `main`.

**Minutes.** All numbers are wall-clock minutes from the GitHub API (job `started_at` to `completed_at`, successful runs), billed as GitHub bills Actions: each job is rounded up to a whole minute. The public 4-core window is 2026-11-19 18:00 to 2026-11-24 UTC; the 2-core numbers are from 2026-11-18. ESLint and axe have never run in this repository, so their cost is an **estimate** from comparable steps. AC-1 and AC-3 record the measured cost of their first CI run in their PRs.

| | Measured base | (a) adds | (b) adds |
|---|---|---|---|
| `ci.yml` `checks` job | PR median 3.0 min (n=29; its turbo step 143 s in run 45279523824); 5.1 and 5.3 min on 2 cores (runs 44244078730, 44220446217) | ESLint inside the parallel turbo run. About 620 non-test `.tsx` files, 115k lines, no type-aware rules: est. +5 to 30 s on 4 cores, +15 to 60 s on 2 cores. **+0 to 1 billed min per run** | same |
| `web-app.yml` `build` job on a PR | median 2.0 min when the PWA changed (n=39; build step 80 s in run 45279523888); 2.3 to 2.5 min on 2 cores; the PWA changed in 39 of 57 sampled PR runs (68 %) | browsers 3 to 5 s + install 9 to 16 s (the shard and preview logs) + 5 scans. The onboarding-type specs take 2.2 to 7.6 s per test (`scripts/e2e-shard-weights.json`: `grown-up-gate` 2.2, `target-size` 3.0, `audio` 3.9, `discover-check` 5.0, `game-sizing` 7.6) plus two axe passes of about 1 to 2 s each per screen: est. **+1 billed min on 4 cores, +2 to 3 on 2 cores** (1 worker) per PWA-changing PR run | 0 |
| `web-app.yml` shards on `main` | median 19.6 min each (n=40); 95.8 billed min per `web-app.yml` push run in all | 0 if listed out (a); else as (b) | the same 5 tests dealt over 4 shards: est. **+0 to 4 billed min per push** |
| billing lane on `main` (OD-AC8) | median 5.7 min (n=10) | +0 to 1 | +0 to 1 |
| `preview-deploy.yml` on a PR | median 3.4 min (n=39; its Playwright install 16 s and suite 70 s in run 45236504306) | site home + sign-in, 2 tests: **+0 to 1** | same |

Per pull request run today: `ci.yml` about 27 billed min, `web-app.yml` about 4, `preview-deploy.yml` about 4 when its paths match. From 2026-10-24 to 2026-11-23 there were 652 `ci.yml` PR runs (92 of them cancelled), 107 `ci.yml` pushes, 89 `web-app.yml` pushes, 536 `preview-deploy.yml` runs and 142 merged PRs. At that cadence, CI costs about 29,000 billed min per 30 days on public speeds. Option (b) adds at most about 1,500 of that (about +5 %; most runs add 0 or 1 min). Option (a) adds a further 350 to 1,100 (68 % of about 520 non-cancelled `web-app.yml` PR runs, at 1 to 3 min each), less up to about 300 when the shards list the spec out. On a private repository each figure is about 1.8 times larger (the 2-core ratio of `checks`, §1.2). GitHub's included usage for a private repository on the Free plan is $12 of compute a month. At $0.006 a minute for a Linux 2-core runner, that is about 2,000 minutes (docs.github.com, "GitHub Actions" billing concepts and "Actions runner pricing"; the pricing page also states the per-job rounding used here). That is far below the base alone, which is why minutes ran out on 2026-11-18. So while the repository is private, neither option gates CI in practice. The gate is the local check every row runs (FINISH-2026-11). Locally, ESLint takes seconds and needs no build. The axe smoke needs a release build (`build:web`, 80 s on a CI runner) and a Playwright run.

**Recommendation: (b).**
1. The WO's acceptance criterion is a static property of source code (a touchable with no accessibility props). ESLint finds it in every file. axe finds it only on the screens it visits.
2. (b) needs no workflow change for the PR gate or for the PWA scans (only OD-AC8's lane adds one spec path), and it leaves the 2026-11-18 decision as it is.
3. Its PR cost is at most one billed minute per run, and it is the cheapest check to run locally while the repository is private.
4. axe still runs on every push to `main` (PWA screens) and on the apps/web PRs `preview-deploy.yml` covers (site and sign-in).

(a) buys PR-time axe for five PWA screens at 1 to 3 extra minutes per PWA PR.

### 3.2 ESLint rule sets (AC-3): accessibility rules only

- **Per workspace**: one `eslint.config.mjs` (flat config) in `apps/mobile`, `packages/design-system` and `apps/web`. The other six workspaces keep their `echo`: they have no JSX.
- **Files**: non-test `.tsx` under `src/`, plus `apps/mobile/App.tsx`. Ignored: `**/__tests__/**`, `**/*.test.tsx`, `**/__generated__/**`. `.ts` files have no JSX, so these rules have nothing to check there; they are not linted. Neither are `e2e/` and `scripts/`.
- **Parser**: `@typescript-eslint/parser` with `ecmaFeatures.jsx`, and no `project` (no type-aware linting, which keeps it fast).
- **No style or correctness rules.** The config has no `@eslint/js` recommended set, no `typescript-eslint` rules, no `eslint-plugin-react`, no `eslint-plugin-react-hooks` and no `eslint-config-next`. The only rules on are the accessibility rules below (plus OD-AC7's rule, which is also an accessibility rule).
- **The scripts** (method B of §3.3; method A replaces `--max-warnings=0` with the measured count):
  - `apps/mobile`: `eslint --no-inline-config --max-warnings=0 App.tsx "src/**/*.tsx"`
  - `packages/design-system` and `apps/web`: `eslint --no-inline-config --max-warnings=0 "src/**/*.tsx"`
- **Why `--no-inline-config`**: it tells ESLint to read no `eslint-disable` or `/* eslint */` comments at all (`allowInlineConfig: false`). That does two things. (1) The existing comments of §1.1 (44 of the 68 are in the linted files, non-test `.tsx` in 32 files) cannot fail the run with "Definition for rule … was not found", so they stay untouched and keep serving whatever linter they were written for. (2) No one can cover an accessibility violation with an `eslint-disable` comment. The WO forbids that, and the flag makes it mechanical. If a later spec adds `react-hooks` or `typescript-eslint`, that spec revisits the flag.
- **`apps/web/next.config.js`** gains `eslint: { ignoreDuringBuilds: true }`. Next 14.2's `next build` has its own lint step, written before flat config and ESLint 9/10. The `lint` task already runs ESLint, so the build must not run it a second time or fail on it. AC-3 records the `next build` output before and after; it should be unchanged.

**`apps/mobile`, `packages/design-system`: `eslint-plugin-react-native-a11y` 3.5.1.** "Touchable" below means `Pressable`, `Touchable`, `TouchableOpacity`, `TouchableHighlight`, `TouchableWithoutFeedback`, `TouchableNativeFeedback` and `TouchableBounce` (`lib/util/isTouchable.js`).

| Rule | On | What it catches · today (heuristic count from a scan of the opening tags, not ESLint; AC-3 records the real count) |
|---|---|---|
| `has-valid-accessibility-descriptors` | yes | A touchable or `TextInput` with **none** of `role`, `accessibilityRole`, `accessibilityLabel`, `accessibilityActions`, `accessible`. The rule skips elements with a spread. **This is the WO's acceptance rule.** Today about 2 touchables and 2 `TextInput`s in apps/mobile (of 152 and 12; 28 and 3 have spreads), 0 in design-system (13 touchables, 7 with spreads) |
| `has-valid-accessibility-role`, `-state`, `-value`, `-actions` | yes | Invalid values. Expected 0 |
| `has-valid-accessibility-live-region` (Android), `has-valid-important-for-accessibility` (Android) | yes | Invalid values. Expected 0 |
| `has-valid-accessibility-ignores-invert-colors` (iOS) | yes | An `Image` from `react-native` without `accessibilityIgnoresInvertColors`. 1 in today's non-test source (`apps/mobile/src/screens/account/AccountCover.tsx`) |
| `no-nested-touchables` | yes | Touchables inside an `accessible` group (they cannot be reached). Expected 0 |
| `has-accessibility-props`, `has-valid-accessibility-component-type`, `-traits`, `-states` | yes | Deprecated prop combinations. Expected 0 |
| `has-accessibility-hint` | **no** | It reports every `accessibilityLabel` without an `accessibilityHint`: 556 labels against 41 hints in that source, so about 515 hits. Hints are optional and WCAG does not require them. This is exactly the "hundreds of hits" the WO rules out |

**`apps/web`: `eslint-plugin-jsx-a11y` 6.10.2.** All of `flatConfigs.recommended` as published, with these levels as in 6.10.2:

- `error`: `alt-text`, `anchor-has-content`, `anchor-is-valid`, `aria-activedescendant-has-tabindex`, `aria-props`, `aria-proptypes`, `aria-role`, `aria-unsupported-elements`, `autocomplete-valid`, `click-events-have-key-events`, `heading-has-content`, `html-has-lang`, `iframe-has-title`, `img-redundant-alt`, `interactive-supports-focus`, `label-has-associated-control`, `media-has-caption`, `mouse-events-have-key-events`, `no-access-key`, `no-autofocus`, `no-distracting-elements`, `no-interactive-element-to-noninteractive-role`, `no-noninteractive-element-interactions`, `no-noninteractive-element-to-interactive-role`, `no-noninteractive-tabindex`, `no-redundant-roles`, `no-static-element-interactions`, `role-has-required-aria-props`, `role-supports-aria-props`, `scope`, `tabindex-no-positive`.
- `off`: `anchor-ambiguous-text`, `label-has-for` (deprecated).

Plus **`control-has-associated-label` turned on**, with the recommended config's own options (`ignoreElements`: audio, canvas, embed, input, textarea, tr, video; `ignoreRoles`: grid, listbox, menu, menubar, radiogroup, row, tablist, toolbar, tree, treegrid; `includeRoles`: alert, dialog). This rule catches a `<button>` with no text and no `aria-label`, the web form of the acceptance case. apps/web has no `eslint-disable` today. The heuristic scan finds 116 `<button>`s and 54 `<label>`s; `label-has-associated-control` may flag `<label>{children}</label>` wrappers it cannot see into. AC-3 measures the real count.

**OD-AC7 (recommended): one local rule for the gap.** `react-native-a11y` accepts `<Pressable accessibilityRole="button" onPress={go}><Icon name="speaker" /></Pressable>`, which has a role but no name. That is the realistic regression: an icon button whose label is forgotten. The local rule `hangul-route/touchable-has-name` flags a touchable, or an element whose `accessibilityRole` or `role` is `button`, `link`, `checkbox`, `switch`, `radio`, `tab` or `menuitem`, when **all** of these hold:
- it has no `accessibilityLabel`, `aria-label`, `aria-labelledby` or `accessibilityLabelledBy`;
- it has no spread;
- no child is JSX text or a `{…}` expression;
- no child is an element other than `Icon`, `Image` or an `svg` element.

The design-system `Button` always names its `Pressable` (`accessibilityLabel={accessibilityLabel ?? label}`, `packages/design-system/src/components/Button/Button.tsx:185, 201`), so it is not affected.

### 3.3 Today's lint violations: never `eslint-disable` (OD-AC5, OD-AC6)

Both methods below hold today's violations without a single disable comment (`--no-inline-config` makes disables inert anyway). With both, a new violation fails the run from the day AC-3 merges.

- **Method A (the WO's wording).** A rule with no violations at AC-3 starts at `error`. A rule with violations starts at `warn`. Each package's script carries `--max-warnings=<the warnings ESLint reports on main at AC-3>`, so one more warning fails the run. A PR that fixes a warning lowers the number in the same PR. Lowering it is up to review, because ESLint does not fail on fewer warnings. On the OD-AC6 date, every `warn` rule becomes `error` (row AC-3b).
- **Method B (recommended).** Every rule is `error` from the start. Today's violations are recorded with ESLint's bulk suppressions: `eslint --suppress-all` writes `<package>/eslint-suppressions.json` (file → rule → count; built into ESLint since 9.24, present in both 9.39.5 and 10.15.0). A violation beyond a file's count fails. When a suppressed violation is fixed, ESLint exits 2 ("There are suppressions left that do not occur anymore", `lib/cli.js` in both versions) until `--prune-suppressions` lowers or removes the entry. So the file only shrinks: the same ratchet as the touch-target list (`apps/mobile/e2e/web/target-size.spec.ts:24-37`) and §3.5's axe baseline.
  - Rules for the file: never add an entry by hand and never use `--suppress-rule` for new code. A file **rename** that carries a suppressed violation re-records the same count under the new path in the same PR, and says so in its description.
  - On the OD-AC6 date the file must be empty and is deleted (row AC-3b). AC-3's test then asserts that no suppressions file exists.

Under either method, the acceptance rules of §3.7 (`has-valid-accessibility-descriptors`, `control-has-associated-label` and OD-AC7's rule) fail a new violation on the day AC-3 merges. Under method A that comes from `--max-warnings` if the rule had to start at `warn`.

### 3.4 The axe smoke: what it scans and how (AC-1, AC-2)

- **Engine**: `@axe-core/playwright` (`AxeBuilder`), tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`. `best-practice` is in because WO-39's acceptance names `heading-order`, `landmark-one-main` and `page-has-heading-one` (`docs/roadmap/review-2026-11/phase-5-native-a11y.md:137`). No experimental rules.
- **Excluded**: only the PWA overlay layer, `[data-testid="pwa-banners"]`, `[data-testid="install-guide"]` and `[data-testid="portrait-guard"]`. It appears on its own schedule; `measureTargets` leaves it out for the same reason (`apps/mobile/e2e/web/target-audit.ts:107-121`). On the console, Clerk's widget, if a build ever has a key, is third-party and is excluded by its container.
- **Settled scan**: `analyze()` is run until two runs 300 ms apart give the same rule → node-count map, at most 5 runs. This is the `settledOffenders` pattern (`target-size.spec.ts:47-69`). Entrance animations then cannot decide the result.
- **Browser**: the configs' own defaults. Mobile: Pixel 5, `en-US`, `scripts/serve-dist.mjs` on `dist` (`apps/mobile/playwright.config.ts:23-46`). Web: Chromium, `en-US`, `e2e/serve-out.mjs` on `out` or `E2E_OUT` (`apps/web/playwright.config.ts:19-35`). Every spec takes `test` from `e2e/web/fixtures.ts` (silent speech; the release build's clips off), so the scans see CI's no-voice state.

| Screen id | Screen (the WO's list; † = added here) | Bundle · lane under (b) | Reached with existing code |
|---|---|---|---|
| `home` | Home of a fresh learner | release build · `main` shards | `onboardChild(page, { name, startJourney: false })` (`e2e/web/helpers.ts:268-274`), `page.goto('/')`, ready on "Hi, ‹name›!", as `target-size.spec.ts` `walk()` (`:74-80`) |
| `discover` | Quest Discover, Stage 1 quest 1, first page | release · shards | `onboardChild(page, { name })`, then Continue, ready on the "Look and learn" pill, as `discover-check.spec.ts` `openDiscover` (`:58-64`) |
| `match-sound-round-1` | Match Sound round 1 | release · shards | from the first-quest preview: Continue, `passDiscover` (`helpers.ts:457-468`), Play minigame, ready on "1 / 6", as `audio.spec.ts` `openMatchSound` (`:177-183`, local to that file; AC-1 composes the same steps from `helpers.ts` and does not edit `audio.spec.ts`) |
| `culture-quiz-correct` | Culture Quiz right after a correct answer | release · shards | `openCultureQuiz` of `audio.spec.ts:445-456` (also `touch-matrix.spec.ts:69-77`): Picnic Snacks (Stage 1 Food & Daily Life quest 3, `apps/mobile/src/content/quests.ts:222, 251`), Discover, Skip for now, Play minigame. **New in AC-1**: no existing spec answers this quiz correctly. The spec reads the round's Korean heading and taps the option whose English is its pair in `minigame:s1-life-q3-apply` (`apps/mobile/src/logic/minigame-config.ts:335-345`: 토마토 Tomato, 코코아 Cocoa, 쿠키 Cookie, 토스트 Toast, 김밥 Kimbap). **Holding the state:** the game moves on `afterSound(…, { minMs: 700 })` after a correct tap (`screens/minigames/CultureQuizGame.tsx:88`). AC-1 installs `page.clock` before the first navigation and pauses it just before the tap; if axe needs a running timer, it steps the clock in steps that stay under 700 ms. Fallback: tap Hear first with the never-answering speech engine of `audio-engine.spec.ts`, which holds the state for up to `ANSWER_SOUND_MAX_MS` = 2,500 ms (`logic/audio/reply-advance.ts:17`). Before and after the scan, the spec asserts that the pill still reads "1 / 4" and that the tapped option shows the success fill (after WO-04 lands, its ", correct" name). A scan of the wrong state then fails instead of passing |
| `pin-entry` | PIN entry, Grown-up area (verify mode) | release · shards | `onboardChild`, then `openGrownUpZone(page, name)` (`helpers.ts:393-405`), ready on "Enter your 4-digit PIN to continue." |
| `site-home` † | the site's home `/` (AC-2 is "사이트·콘솔") | apps/web default export · `preview-deploy.yml` PRs | `page.goto('/')` on `out`, as `landing-layout.spec.ts`. Runs when `E2E_OUT` is unset: on the merged dist, `/` is the learner app |
| `signin` | Console sign-in `/signin` | default export · `preview-deploy.yml` PRs | `page.goto('/signin')`, as `locale-routes.spec.ts:116-118`. The default export is a production build with no Clerk key, so the dev sign-in is off (`devAuthEnabled`, `apps/web/src/lib/console/config.ts:79-84`). The scan covers the page and its signed-out state, not Clerk's form |
| `class-page` | Teacher class page `/teach/space?id=space%3Aa` | a build with an API base · billing lane on `main` (OD-AC8) or local | `mockClass` of `class-page-order.spec.ts:84-99`: the console session seeded in `sessionStorage`, the account API answered by `page.route` with two learners and a plan. That spec is skipped unless `GROWNUP_E2E=1` and says "no CI lane runs it yet" (`:20-24`). The merged app-host dist of the billing lane has an API base at `https://api.billing-e2e.test` and signs in from that same session (`apps/web/e2e/billing.spec.ts:10-21`). AC-2's spec matches any cross-origin `/api/` call, runs when `BILLING_E2E=1` or `GROWNUP_E2E=1`, and is ready on two `student-card`s |

AC-1 puts the five PWA screens in `apps/mobile/e2e/web/axe-smoke.spec.ts`. AC-2 splits the web scans by bundle: `apps/web/e2e/axe-site.spec.ts` (`site-home`, `signin`; skipped when `E2E_OUT` is set) and `apps/web/e2e/axe-console.spec.ts` (`class-page`). Each screen is one test, so the shards can deal them (`scripts/e2e-shard-list.mjs`). After its first CI run, AC-1 may add its mean seconds to `scripts/e2e-shard-weights.json`; a file the table lacks weighs 0.25 s (the table's own note).

### 3.5 The axe baseline file and when the smoke fails

One file per app: `apps/mobile/e2e/web/fixtures/axe-baseline.json` and `apps/web/e2e/fixtures/axe-baseline.json`. Each holds the violations measured on `main` when its row lands, as a **node count per screen and rule**:

```json
{
  "note": "AMENDMENTS-A11Y-CI §3.5 axe ratchet (axe-smoke.spec.ts). Violations found today, per screen and rule, as node counts. Never add an entry or raise a count: a new violation fails the smoke until it is fixed. When a count drops, the smoke fails until the entry is lowered or removed, so this file only shrinks.",
  "axeCore": "4.14.1",
  "tags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
  "screens": {
    "home": [{ "rule": "region", "nodes": 3, "impact": "moderate", "expectedFix": "WO-39 SS-3" }],
    "pin-entry": []
  }
}
```

The `region` entry above shows the format only; the real entries come from AC-1's measurement. `expectedFix` names the WO row expected to remove the entry, or `"none"`.

- **Key = screen + rule; the value is the node count.** Node selectors from react-native-web are generated class chains (`.r-…`) that change with any style edit, so the file does not store them. The trade-off: a fix and a new violation of the same rule on the same screen cancel out. The test prints each node's `target`, the first 200 characters of its `html` and its `failureSummary`, so a reviewer can see what is counted.
- **Fails when**, per screen:
  - a rule with violations has no entry (**new**);
  - a count is above its entry (**more**);
  - a count is below its entry (**fewer**: lower it to the new count);
  - an entry's rule has no violations (**gone**: remove the entry).
  
  This is the touch-target ratchet's rule (`target-size.spec.ts:24-37`, `target-audit.ts` `ratchet()` at `:98-105`).
- **Version pin**: the smoke fails when `axe.version` differs from `axeCore`. An axe-core update is then a deliberate PR that re-measures the baseline.
- **Pure helpers**: the comparison is a pure module (`axe-audit.ts` in each app's e2e folder), unit-tested like `target-audit.ts` (`apps/mobile/src/config/__tests__/touch-target-ratchet.test.ts`) and `landing-targets.ts` (`apps/web/src/app/__tests__/landing-targets.test.ts`).
- **Who runs it**: under (b), axe runs on `main`, not on the pull request. Any PR that changes a screen of §3.4, and every PR of WO-04, WO-39, WO-40 and WO-41, runs `axe-smoke.spec` (and the web specs, if it touches the console) **locally against a release build** before it asks for review, and shrinks the baseline in the same PR. This follows the FINISH-2026-11 rule: the e2e specs a row touches run against a local release build. Otherwise the next push turns `main` red with a "fewer"/"gone" message, as the touch-target ratchet already does since #1043.

### 3.6 How the baseline shrinks (WO-04, WO-39, WO-40, WO-41)

axe checks names, roles, ARIA validity, colour contrast of text, document structure and `lang` validity. It does **not** check that a state is shown by more than colour (WCAG 1.4.1), that a result is announced, that parts of a page in Korean carry `lang="ko"`, non-text contrast of borders (1.4.11), or a hard-coded English default label. So:

| WO | What it fixes | Expected baseline effect |
|---|---|---|
| WO-39 (SS-1 to SS-4) | heading levels, `role="main"`, document titles, skip link | removes `heading-order`, `page-has-heading-one`, `landmark-one-main`, `region`, `document-title` entries (its acceptance, `docs/roadmap/review-2026-11/phase-5-native-a11y.md:137`) |
| WO-41 #2, #3 | text contrast: the console's `feedback.danger` text, `feedback.info`, overlays, disabled composites | removes `color-contrast` entries on the screens that draw them (`signin`, `class-page` if shown) |
| WO-41 #1, #8 | input and checkbox borders; English default labels | none: axe cannot see them. Their guard is `packages/design-system/src/__tests__/contrast.test.ts` and WO-41's own tests |
| WO-04 (F-A11Y-001, AF rows) | results shown by more than colour; announced once | probably none. `culture-quiz-correct` is a net for names and roles on that state; colour-only state and announcements are guarded by F-A11Y-001's own tests and the contrast contract |
| WO-40 (LP rows) | Korean read with a Korean voice | probably none. Its guard is its own DOM test ("every accessible name with Hangul comes from a `lang="ko"` element", WO-40's acceptance) |

AC-1 and AC-2 list in their PR descriptions each baseline entry whose `expectedFix` is `"none"`. These are new findings for the owner. AC-1 and AC-2 do not add them to `docs/tasks/INBOX.md` (README §8 of the plan).

### 3.7 Acceptance: a button without `accessibilityLabel` fails CI; `main` passes

- **Given** a throwaway branch `ci/a11y-lint-probe` off `main`, with one commit that adds `apps/mobile/src/components/A11yLintProbe.tsx`:

  ```tsx
  import { Pressable } from 'react-native';

  export function A11yLintProbe({ onPress }: { onPress: () => void }) {
    return <Pressable onPress={onPress} />;
  }
  ```

  **when** CI runs on its draft PR, **then** the job `Lint · typecheck · build · repo checks` fails at its step "Lint, typecheck and build" (`ci.yml:64-65`) with `react-native-a11y/has-valid-accessibility-descriptors` from `@hangul-route/mobile#lint`, and the required check **`lint · typecheck · test · build`** (`ci.yml:233-251`) fails. The same commit typechecks.
- **Given** the same probe under `apps/web/src/components/` with `<button type="button" onClick={onClick} />`, **then** the same checks fail with `jsx-a11y/control-has-associated-label` from `@hangul-route/web#lint`.
- **If OD-AC7 is taken**, a third probe, `<Pressable accessibilityRole="button" onPress={onPress} />`, fails with `hangul-route/touchable-has-name`. Without OD-AC7 this probe passes ESLint. axe's `button-name` would catch it only on a scanned screen, on `main`.
- **On `main`** the same checks pass.
- **Which check proves it.** Under (b), the lint step above and nothing else, because axe does not run on the pull request. Under (a), additionally `Build PWA · offline e2e`, for a nameless button rendered on one of the five PWA screens.
- **Proof that survives the probe.** AC-3's unit tests (§6) lint the same snippets in memory through ESLint's Node API on every run. If the config or the plugin ever stops catching them, CI says so on any PR.
- **While the repository is private** and CI does not start, the probe is proven locally (`pnpm --filter @hangul-route/mobile lint` and `pnpm --filter @hangul-route/web lint` exit 1 on the probe branch and 0 on `main`). The draft PR's red check is recorded when CI runs. The probe PR is closed unmerged and its branch deleted.

## 4. Out of scope

- Lint for the six workspaces without JSX, and any style, correctness, `react-hooks` or `typescript-eslint` rule. A later spec may add them; it then revisits `--no-inline-config` (§3.2).
- The 68 existing `eslint-disable` comments: left as they are.
- Fixing the violations the baseline and suppressions record. That work belongs to WO-04, WO-39, WO-40, WO-41 and row AC-3b's debt fixes, not to AC-1 to AC-3. AC-3 fixes none of them.
- Native screen readers (VoiceOver, TalkBack) and the native app: axe runs on the web build only. Native checks are WO-42's (the owner's).
- Making `preview-deploy.yml` a required check, or trimming it for minutes.
- Visual or colour-only state checks (WCAG 1.4.1): F-A11Y-001.

## 5. UI sketch

N/A. CI only; no screen changes.

## 6. Tests

TDD applies to configuration too: each row's commit holds its test and its change.

**AC-3 (lint).**
1. `apps/mobile/src/config/__tests__/eslint-a11y-config.test.ts` (vitest, ESLint Node API, `lintText` with a `filePath` under `src/`):
   - the §3.7 probe fails `has-valid-accessibility-descriptors`;
   - `<Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={f} />` passes;
   - `has-accessibility-hint` is off;
   - a snippet with `// eslint-disable-next-line react-hooks/exhaustive-deps` reports nothing when `allowInlineConfig: false` is passed, as the script does;
   - the config enables only `react-native-a11y/*` (and `hangul-route/*` under OD-AC7) rules.
2. The same for `packages/design-system` (`src/__tests__/eslint-a11y-config.test.ts`).
3. `apps/web/src/app/__tests__/eslint-a11y-config.test.ts`:
   - the `<button>` probe fails `control-has-associated-label`;
   - `<button type="button">Save</button>` passes;
   - only `jsx-a11y/*` rules are on.
4. Under OD-AC7: the rule's RuleTester cases (valid: text child, `{label}` child, `accessibilityLabel`, spread; invalid: role-only with `Icon` child, role-only empty, `TouchableOpacity` empty) in `packages/design-system`'s vitest.
5. `scripts/__tests__/ci-workflows.test.mjs` gains "lint is a real gate":
   - the `lint` scripts of the three workspaces start with `eslint` and contain `--no-inline-config`;
   - `ci.yml`'s `checks` job still runs `turbo run lint`.
   - Under method B, each workspace's suppressions file is valid ESLint suppressions JSON, or absent after AC-3b.
6. Locally and in the PR: `pnpm exec turbo run lint` on `main` passes; the §3.7 probes fail; `next build` output unchanged; `node scripts/third-party-notices.mjs --check` passes (all new packages are devDependencies).

**AC-1 (PWA axe).**
1. `apps/mobile/src/config/__tests__/axe-baseline.test.ts` covers the pure compare of §3.5:
   - new, more, fewer and gone each produce their message;
   - equal passes;
   - a version mismatch fails;
   - the settle loop stops on two equal maps and throws after 5.
2. `apps/mobile/e2e/web/axe-smoke.spec.ts` passes locally against a release build (`pnpm --filter @hangul-route/mobile build:web`, then `exec playwright test axe-smoke.spec`).
3. A local probe adds a nameless `Pressable` with `accessibilityRole="button"` to Home. The smoke fails on `home` with `button-name` "new". Not committed.

**AC-2 (web axe).**
1. `apps/web/src/app/__tests__/axe-baseline.test.ts`, the same cases as AC-1.
2. `axe-site.spec.ts` passes on the default export (`pnpm --filter @hangul-route/web build` then `test:e2e`).
3. `axe-console.spec.ts` passes on the merged dist (the billing lane's two commands, `billing.spec.ts:18-19`) and on the `GROWNUP_E2E` export (`class-page-order.spec.ts:18-19`).
4. Under OD-AC8 = lane, `ci-workflows.test.mjs`'s existing "the web billing run plays every spec that reads BILLING_E2E" (`:596`) requires the new path in the billing step.

## 7. Rollout

Next release. Order: AC-3 first (the PR gate), then AC-1 and AC-2 in parallel. AC-3b comes on the OD-AC6 date; AC-4 comes last. No flag: CI only.

## 8. Dependencies

- **Specs**: F-COV-001 (amended). F-A11Y-001 (WO-04), by name. WO-39, WO-40, WO-41 (Phase 5) shrink the baseline (§3.6). F-LAYOUT-001 §3.8 (the touch-target ratchet, the pattern for §3.5).
- **Owner decision 2026-11-18** (PR e2e on `main` only, #1043): kept under (b), changed under (a).
- **New devDependencies** (owner decision, exact versions, looked up with `npm view` on 2026-11-23; repo: Node 22 from `.nvmrc`, root `engines` `>=20.6`, pnpm 10.33.0, TypeScript 5.9.3, React 18.3.1, React Native 0.76.5, react-native-web 0.19.13, Next 14.2.35, `@playwright/test` and `playwright-core` 1.63.0):

| Package | Version | Where | Peer / engine check | Licence |
|---|---|---|---|---|
| `eslint` | **10.15.0** (OD-AC1; fallback 9.39.5) | apps/mobile, apps/web, packages/design-system | engines `^20.19.0 \|\| ^22.13.0 \|\| >=24` (CI's Node 22 passes; a machine on Node 20.6 to 20.18 does not). ESLint 9 has been end of life since 2026-08-06 (eslint.org/version-support: v9.39.5, 2026-07-10, is its last release) | MIT |
| `@typescript-eslint/parser` | 8.74.0 | same three | peers `eslint ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`, `typescript >=4.8.4 <6.1.0`: both met | MIT |
| `eslint-plugin-jsx-a11y` | 6.10.2 (latest; published 2024-10-26) | apps/web | peer `eslint ^3 … \|\| ^9`: **unmet by 10.15.0**, met by 9.39.5. By reading its `lib/`, it uses only `context.options`, `context.report` and `context.settings`, all present in ESLint 10's rule context. Depends on `axe-core ^4.10.0` | MIT |
| `eslint-plugin-react-native-a11y` | 3.5.1 (latest; published 2024-11-04) | apps/mobile, packages/design-system | peer `eslint ^3 … \|\| ^8`: **unmet by both 9 and 10**. By reading: `context.options` and `context.report`, and in one rule `context.sourceCode \|\| context.getSourceCode()`; `sourceCode` exists in 9 and 10 (`getSourceCode` was removed in 10 but is then never called). Its legacy `configs` cannot be used in flat config; the rules are listed by hand (§3.2) | MIT |
| `@axe-core/playwright` | 4.14.0 (latest stable; 4.14.1 is prerelease only) | apps/mobile, apps/web | peer `playwright-core >= 1.0.0` (1.63.0 met); engines `node >=22.12.0` (CI met; root `engines` is wider). Depends on `axe-core ~4.14.0`, which resolves to 4.14.1 today; the lockfile pins it and §3.5 pins it again | **MPL-2.0** (both) |

Peer exceptions are written in `pnpm-workspace.yaml`, beside its other documented install decisions: `peerDependencyRules.allowedVersions`, `eslint-plugin-react-native-a11y>eslint: "10"` and `eslint-plugin-jsx-a11y>eslint: "10"` (only the first if OD-AC1 picks 9.39.5). Without them, pnpm only warns.

All of these must stay **devDependencies**. `scripts/third-party-notices.mjs --check` reads only the production tree. It treats MPL as copyleft and would fail if axe-core ever reached `dependencies`.

Nothing else is added: no `@eslint/js`, `globals`, `typescript-eslint` (meta package), `eslint-config-next`, `eslint-plugin-react`, `eslint-plugin-react-hooks` or `@eslint/compat`.

## 9. Rows

| Row | Model | Contents | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| AC-0 | Opus 5.5 | This spec: re-verified citations, option (a)/(b) with minutes, rule sets, suppressions/baseline method, axe targets, acceptance, ODs. Multi-agent review, then `ready` once the ODs are taken | doc checks only | — | `docs/a11y-ci-spec` |
| AC-3 | Sonnet 5.5 | §3.2: three `eslint.config.mjs`, three `lint` scripts, the devDependencies of OD-AC1/OD-AC2, the `pnpm-workspace.yaml` peer exceptions, `next.config.js` `ignoreDuringBuilds`. §3.3 with OD-AC5's method: measure each rule's count, then the suppressions files (B) or levels and `--max-warnings` (A); record the counts in As built. OD-AC7's rule if taken (`packages/design-system/eslint/touchable-has-name.mjs`). §3.7 probes run, recorded and closed | §6 AC-3 1–6 | AC-0 `ready`; OD-AC1, OD-AC2, OD-AC5, OD-AC6, OD-AC7 | `ci/a11y-lint` |
| AC-1 | Sonnet 5.5 | §3.4 PWA screens in `apps/mobile/e2e/web/axe-smoke.spec.ts`; `axe-audit.ts`; `fixtures/axe-baseline.json` measured on a release build of `main`, each entry with its `expectedFix`; `@axe-core/playwright` devDependency. Under (a), also the PR steps of §3.1 and their `ci-workflows.test.mjs` pins, and the shard listing leaves the spec out | §6 AC-1 1–3 | AC-0 `ready`; OD-AC3, OD-AC4 | `ci/a11y-axe-pwa` |
| AC-2 | Sonnet 5.5 | §3.4 web screens in `apps/web/e2e/axe-site.spec.ts` and `axe-console.spec.ts`; `axe-audit.ts`; `fixtures/axe-baseline.json`; devDependency. OD-AC8 = lane: `e2e/axe-console.spec.ts` added to the billing step `web-app.yml:502-507` | §6 AC-2 1–4 | AC-0 `ready`; OD-AC3, OD-AC8 | `ci/a11y-axe-web` |
| AC-3b | Sonnet 5.5 | On the OD-AC6 date: fix every remaining suppressed (B) or warned (A) violation (no disables; a new label means en, es and ko strings in `packages/i18n`, since es and ko are shipped), then delete the suppressions files (B) or turn the `warn` rules into `error` and set `--max-warnings=0` (A) | AC-3's tests; `pnpm exec turbo run lint` | AC-3 | `fix/a11y-lint-debt` |
| AC-4 | Sonnet 5.5 | Finish: "Amended YYYY-MM-DD by AMENDMENTS-A11Y-CI" line in F-COV-001's header; the `docs/specs/README.md` index line; status `shipped` | — | AC-1, AC-2, AC-3 | `docs/a11y-ci-amended` |

**Same files.**
- AC-1, AC-2 and AC-3 all change `pnpm-lock.yaml`; AC-1 and AC-3 both change `apps/mobile/package.json`; AC-2 and AC-3 both change `apps/web/package.json`. Merge them one after another and rebase the lockfile with `pnpm install`, never by hand.
- AC-1's `culture-quiz-correct` and `home` entries change when WO-04's AF-2 or WO-39's rows land (§3.5: those PRs shrink the file).

One commit = test + change.

## 10. Owner decisions

None is taken yet. Each has a recommendation.

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **OD-AC1** | Add ESLint to apps/mobile, apps/web and packages/design-system: `eslint`, `@typescript-eslint/parser@8.74.0`, and in apps/web `eslint-plugin-jsx-a11y@6.10.2`, all as exact-version devDependencies | `eslint@10.15.0` (current; peer exceptions for both plugins) **or** `eslint@9.39.5` (satisfies jsx-a11y's peer; end of life since 2026-08-06) | **`eslint@10.15.0`**, with the `pnpm-workspace.yaml` peer exceptions of §8. If AC-3's rule tests fail on 10, use 9.39.5 and record why |
| **OD-AC2** | Add `eslint-plugin-react-native-a11y@3.5.1` to apps/mobile and packages/design-system (devDependency), with its peer exception. Last published 2024-11-04; its peer range ends at ESLint 8 | add it **or** write the few checks we need as local rules | **Add it**, with the exception. Its rules use only APIs ESLint 9 and 10 still have (§8), and AC-3's tests prove each enabled rule fires |
| **OD-AC3** | Add `@axe-core/playwright@4.14.0` (brings `axe-core` 4.14.x, 4.14.1 today; MPL-2.0) to apps/mobile and apps/web (devDependency) | add **or** no axe (ESLint only) | **Add it**, dev only (§8 licence note) |
| **OD-AC4** | Where axe runs | (a) a PR step in `web-app.yml`'s build job (changes the 2026-11-18 decision and CLAUDE.md §4; +1 to 3 billed min per PWA PR run) **or** (b) ESLint is the PR gate, axe runs on `main` (+0 to 1 per PR run) | **(b)**, §3.1 |
| **OD-AC5** | How today's ESLint violations are held | A: per-rule `warn`, `--max-warnings` = today's count, `error` on a date (the WO's wording) **or** B: every rule `error`, ESLint's bulk suppressions file per workspace, which can only shrink, empty by a date | **B**. Exact per file and rule, fails on new and on stale entries without a custom script, the same ratchet as the touch-target list and the axe baseline. This changes the WO's "warn first" wording, which is why the owner decides |
| **OD-AC6** | The date for AC-3b (the step to `error` under A; the empty suppressions files under B) | any date | **2026-12-21** for apps/mobile and packages/design-system (heuristic: about 5 violations); **2027-01-11** for apps/web (count unknown until AC-3). If AC-3 measures more than 40 in a workspace, it asks the owner for that workspace's date instead |
| **OD-AC7** | Add the local rule `hangul-route/touchable-has-name` (§3.2) in a new folder `packages/design-system/eslint/` (CLAUDE.md §2: a new folder needs approval), tested with ESLint's RuleTester in that package's vitest | add **or** accept the gap (a role with no name passes ESLint; axe's `button-name` catches it only on a scanned screen, on `main`) | **Add it**. A forgotten label on an icon button with a role is the likeliest real regression, and the plugin cannot see it |
| **OD-AC8** | Where the teacher class page is scanned in CI | the billing lane on `main` (one spec path in `web-app.yml:507`; +0 to 1 min per push) **or** local only, like `class-page-order.spec.ts` ("no CI lane runs it yet") | **The billing lane**. Its merged dist already has the API base and the session bridge the page needs |

## 11. Departures from WO-08

- **D1 File.** The WO allowed rows in F-A11Y-001 or a change to F-COV-001. This is `AMENDMENTS-A11Y-CI.md`, amending F-COV-001, because F-A11Y-001 is being written in parallel (front matter).
- **D2 Option (b) recommended.** Under (b) the acceptance is proved by ESLint alone, as the WO's `> 재확인` line foresaw (§3.1, §3.7).
- **D3 The acceptance probe is defined exactly.** `react-native-a11y` has no label rule. The probe is a touchable with no accessibility props; the role-only case needs OD-AC7 (§3.7).
- **D4 Method B for existing lint violations** (OD-AC5). It replaces the WO's per-rule `warn` if the owner takes it. Method A is fully specified as the alternative (§3.3).
- **D5 `--no-inline-config`.** The 44 existing disable comments in the linted files (non-test `.tsx`) name uninstalled plugins' rules and would otherwise fail ESLint. The flag also makes the WO's "no `eslint-disable`" rule mechanical (§3.2).
- **D6 `has-accessibility-hint` off.** About 515 hits, not a WCAG requirement (§3.2).
- **D7 `preview-deploy.yml` found.** apps/web's Playwright already runs on path-filtered PRs, so the site and sign-in scans get PR-time feedback with no workflow change (§1.2, §3.4).
- **D8 The site's home added** to AC-2's screens. AC-2 names the site; the WO's screen list did not (§3.4).
- **D9 "The baseline shrinks with WO-04, WO-40, WO-41" corrected.** WO-39 and WO-41's text-contrast items shrink it; WO-04 and WO-40 mostly fix what axe cannot see (§3.6).
- **D10 Rows AC-3b and AC-4 added.** The WO's table had no row for the dated step or for the README §5.1 step 6 finish.

## 12. Review log

- 2026-11-23: revision 1 (AC-0), draft for the multi-agent review.
