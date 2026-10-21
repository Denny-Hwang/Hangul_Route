# scripts/

일회성·유지보수용 스크립트가 들어갈 자리. 콘텐츠 검증, 데이터 마이그레이션, 로컬 편의 도구 등이 대상이며, 앱/백엔드 런타임 코드는 각 패키지 안에 둔다.

## CI enforcement scripts

`.github/workflows/*.yml` 가 호출하는 Node 20+ ES module 들. 의존성 없이 빌트인만 사용 — `pnpm install` 실패와 무관하게 동작한다.

| Script | F-XXX | Workflow | Source of truth |
|---|---|---|---|
| `coverage-gate.mjs` | F-COV-001 | `.github/workflows/ci.yml` (job `Measure coverage vs rolling targets`, on the coverage of the `Unit tests` jobs) | `docs/tests/coverage-targets.json` (mirrors `docs/tests/coverage-targets.md`) |
| `validate-content.mjs` | F-CNT-001, F-I18N-001 §3.7 | `.github/workflows/content-validation.yml` | `.claude/skills/content-skill/SKILL.md` §3.3; `content/i18n/<locale>/*.json` go through the overlay rules of `overlay-rules.mjs` (allow-list in `overlay-fields.mjs`, banned words from `packages/i18n/src/banned-words.json`); `HANGUL_ROUTE_STRICT_LOCALES` makes missing translations errors |
| `check-token-drift.mjs` | F-DES-001 | `.github/workflows/design-token-sync.yml` | `design/tokens/*.v*.md` ↔ `packages/design-system/src/tokens.ts` |
| `check-i18n.mjs` | F-I18N-001 | `.github/workflows/ci.yml` | `docs/specs/F-I18N-001-ui-locales.md` §3.11; ratchet lists in `scripts/i18n-migrated.json` (`globs`: migrated surfaces; `pluralTernaryBaseline`: legacy plural ternaries per file, only ever lowered) |
| `check-coverage-targets-drift.mjs` | F-COV-002 | `.github/workflows/ci.yml` (job `Measure coverage vs rolling targets`) | `docs/tests/coverage-targets.md` "Enforced W4 gate" 표 ↔ `docs/tests/coverage-targets.json` |
| `e2e-shard-list.mjs` | CI speed-up (2026-10-12) | `.github/workflows/web-app.yml` (the release-build shards and the fixture-bundle parts) | `playwright test --list` output: deals the listed tests round-robin into `--test-list` files, so the shards come out even |
| `build-vocab.mjs` | F-VOC-001 | `.github/workflows/content-validation.yml` | `content/vocab/<topic>.json` + `content/i18n/{es,ko}/vocab-*.json` glosses → `apps/mobile/src/content/__generated__/vocab.ts` and `apps/web/src/data/vocab-catalog.ts`; `--check` fails on drift (`pnpm run vocab:check`) |
| `build-stories.mjs` | F-STORY-001 | `.github/workflows/content-validation.yml` | `content/stories/*.json` (ready stories) → `apps/mobile/src/content/__generated__/stories-index.ts` (the start-loaded shelf) and `__generated__/story-chunks/story-<slug>.ts` (one content-hashed body chunk per story, F-CURR-002 CM-8); `--check` fails on drift, `--report` fails over the budget |
| `check-migrations.mjs` | F-ROUTE-001 R-0 (E-1) | `.github/workflows/ci.yml` (through `pnpm run test:scripts`, whose self-test runs it on the repository) | `apps/api/migrations/*.sql`: every file is `NNNN_snake_case.sql` and no two share a prefix (wrangler and the SQLite shim apply them in sorted order) |
| `build-placement-bank.mjs` | F-PLC-001 | `.github/workflows/content-validation.yml` | `content/placement/*.json` (index + one file per strand, drafts included with their `status`) → `apps/mobile/src/content/placement.generated.ts`; `--check` fails on drift. Structure rules for `content/placement/**` live in `placement-rules.mjs` (called by `validate-content.mjs`); the `pitem:` overlay fields are checked by the shared overlay rules |
| `build-overlays.mjs` | F-I18N-001 §3.6 | `.github/workflows/content-validation.yml` (and `pnpm run test:scripts`, whose self-test runs `--check` on the repository) | `content/i18n/{es,ko}/*.json` → `packages/content-schema/src/i18n-overlays.generated.ts` (`OVERLAYS`, only allowed fields; imported through `@hangul-route/content-schema/overlays`, never the barrel); `--check` fails on drift. Authoring rules: `content/i18n/README.md` |
| `i18n-status.mjs` | F-I18N-001 §3.10 | `.github/workflows/ci.yml` (and `pnpm run test:scripts`, whose self-test runs it on the repository) | per locale and namespace of `packages/i18n/src/messages/en/`: missing keys (`fallbackPaths`; the English-authoritative legal text is not counted), native review from `packages/i18n/src/messages/review-ledger.json` (current / stale when the English file's sha256 changed / not reviewed), `LOCALE_STATUS`. Prints the current `enSha` of each English namespace (reviewers copy it into the ledger; CRLF is hashed as LF). Fails on missing keys in a `'shipped'` locale and on the automatable parts of the §3.10 step 5 release gate (a ledger entry per namespace, the locale in `HANGUL_ROUTE_STRICT_LOCALES` of `content-validation.yml`, declared once); with `--base <ref>` (CI on a pull request) the PR that flips a locale to `'shipped'` also needs every review current. Stale namespaces of a shipped locale warn. The §3.11 layout matrix is not checked here; it stays a manual gate for PR 15 / 16. `--list` prints the missing paths (R8 input). Loads the TypeScript dictionary through `ts-loader.mjs` |
| `check-locale-export.mjs` | F-I18N-001 §3.4, rows 15b / 16b | `.github/workflows/preview-deploy.yml` ("Exported locales match LOCALE_STATUS", on the default build) and `pnpm run test:scripts` | the site's static export (`apps/web/out`) against `LOCALE_STATUS` (`packages/i18n/src/locales.ts`): `index.html` and `404.html` are `lang="en"`; each `'shipped'` locale's home, `about` and `privacy` pages exist with their own `<html lang>`, no `data-hr-hidden-locale` and no `noindex`, and `sitemap.xml` lists its home; each `'hidden'` locale is absent. A rollback to `'hidden'` (owner runbook §I) keeps it green |
| `import-heritage.mjs` | F-STORY-001 | (none: one-time, run by hand) | `content/stories/research/<cluster>.final.json` → `content/stories/<slug>.json` drafts (`--dry-run` is the default, `--write` writes, never overwrites an authored story) |
| `check-story-versions.mjs` | F-STORY-001 §3.7 | `.github/workflows/content-validation.yml` (checkout with `fetch-depth: 0`) | each `content/stories/*.json` against `git show origin/main:<path>` (`--base <ref>` to change): `content-ver-not-bumped`, `fact-rev-not-bumped`, `fact-removed-silently`, `version-decreased` when the base is `ready`, and against the last `ready` version in the base's history when a held story turns `ready` again; append-only errata, `contentVer: 1` for a new file, and `story-removed` for a deleted or renamed `ready` file always. Plain JSON, no schema import |
| `build-presenter-font.mjs` | F-TCH-004 §3.6 | `.github/workflows/content-validation.yml` (and `pnpm run test:scripts`, whose self-test runs `--check` on the repository) | the Korean the lecture presenter draws (letters, example words, spoken carrier syllables, scope syllables / card pairs / Pic-Word words / sequence labels, Discover words, card subtitles, the Pause word, words of ready vocabulary topics, title / keywords / scene and check Korean of Library-listed stories, and the Listen & Pick prompts and options and the Tap to Respond lines and replies of the question slides, LV-S2) → `apps/mobile/public/fonts/hr-presenter-kr.glyphs.txt`; a rebuild (`--source <NotoSansKR-Bold.otf>`, pinned by SHA-256 to notofonts/noto-cjk Sans2.004; needs `pip install fonttools==4.66.1 brotli==1.2.0`) subsets it into `hr-presenter-kr.woff2` (SIL OFL 1.1, `OFL.txt` beside it) and writes the font and the list only after the subset succeeds. `--check` fails when the list differs from the content or the font's character map (read in plain Node, no Python in CI) is not exactly the list; `--report` fails over 150 000 bytes. Loads the TypeScript content through `ts-loader.mjs` |
| `third-party-notices.mjs` | proprietary LICENSE (owner decision 2026-10-14) | `.github/workflows/ci.yml` (through `pnpm run test:scripts`, whose self-test runs `--check` on the installed repository) | the production dependency tree of the shipped apps (`apps/mobile`, `apps/web`, `apps/api`, `packages/backend`; `dependencies`, `optionalDependencies` and required peers, never dev) + `content/assets-license.csv` + `apps/mobile/public/fonts/OFL.txt` + license texts in `scripts/third-party-notices/licenses/` → `THIRD_PARTY_NOTICES.md` and `apps/web/src/data/third-party-notices.json` (the site's `/licenses`). `--check` fails on drift, on a copyleft production dependency (GPL, AGPL, LGPL, SSPL, MPL, EPL, CDDL, CC-BY-SA and the like; an `OR` with a permissive choice passes; reviewed exceptions in `REVIEWED_EXCEPTIONS`) and on an unknown or missing license (`LICENSE_OVERRIDES` records packages read by hand). Platform builds (`os` / `cpu`) are checked, not listed, so macOS and Linux agree |
| `check-source-links.mjs` | F-STORY-001 §3.7 | `.github/workflows/source-links.yml` (monthly + manual, never on a PR; opens one issue labelled `source-links` when there are problems, or updates the one still open) | every unique `facts[].sources[].url` of `content/stories/*.json`: HEAD then GET, 10 s timeout, 2 requests per host per second (redirects followed by hand, up to 5 hops, each hop rate-limited); reports 4xx/5xx, redirects to another host, TLS failures and unreachable URLs. Hosts in `scripts/source-link-ignore.json` are skipped. Always exit 0 |

Run locally:

```bash
node scripts/coverage-gate.mjs
node scripts/validate-content.mjs
node scripts/check-token-drift.mjs
node scripts/check-coverage-targets-drift.mjs
node scripts/check-i18n.mjs
node scripts/i18n-status.mjs             # translation status per locale and namespace
node scripts/i18n-status.mjs --list      # ... with every missing key path
node scripts/check-migrations.mjs
node scripts/build-stories.mjs            # regenerate the story bundle
node scripts/build-stories.mjs --check    # drift detector (CI)
node scripts/build-stories.mjs --report   # sizes and budget (CI)
node scripts/build-vocab.mjs              # regenerate the vocabulary modules
node scripts/build-vocab.mjs --check      # drift detector (CI)
node scripts/build-placement-bank.mjs     # regenerate the placement bank
node scripts/build-placement-bank.mjs --check   # drift detector (CI)
node scripts/build-overlays.mjs           # regenerate the content overlays
node scripts/build-overlays.mjs --check   # drift detector (CI)
node scripts/build-presenter-font.mjs --check    # presenter font glyph list and font drift (CI)
node scripts/build-presenter-font.mjs --report   # presenter font size against the budget (CI)
node scripts/build-presenter-font.mjs --source NotoSansKR-Bold.otf   # rebuild the font (pyftsubset)
node scripts/import-heritage.mjs --src content/stories/research --dry-run   # report only (one-time importer)
node scripts/check-story-versions.mjs      # story version rules against origin/main (git fetch origin first)
node scripts/third-party-notices.mjs          # regenerate THIRD_PARTY_NOTICES.md and the /licenses data (after pnpm install)
node scripts/third-party-notices.mjs --check  # license policy and drift detector (CI, via test:scripts)
node scripts/check-source-links.mjs --list   # the cited source URLs (no requests)
node scripts/check-source-links.mjs          # check every cited URL (network; about a minute)
```

각 스크립트는 (a) gate 충족, 또는 (b) 검사할 데이터가 아직 없을 때 (커버리지 리포트 부재 / `content/*.json` 부재 / 토큰 MD 부재) **exit 0** 으로 통과하고, 그 외에는 `::error::` annotation 과 함께 **exit 1** 로 실패한다.

이 디렉토리는 `docs/tests/coverage-targets.md` 의 "측정 제외" 규칙에 따라 커버리지 측정에서 빠진다.

## Story bundle (`build-stories.mjs`)

The story modules (`stories-index.ts` and `story-chunks/`) are checked in and never edited by hand: change `content/stories/*.json` (or the script), run `node scripts/build-stories.mjs`, commit both (a run also removes the chunk of a story that no longer ships). Drafts are not bundled; `--include-drafts --out <dir>` writes preview modules (refused under `apps/`). Budget (F-CURR-002 §10): 70,000 B raw per story chunk, 2,000,000 B raw / 510,000 B gzip in total, the start-loaded manifest (`lessons-index.ts` and `stories-index.ts`) 60,000 B raw, scene art 130,000 B (`BUDGET` in the script; raising it is a reviewed one-line change).

The literals are typed against `Story[]`, `Episode[]` and `Quest[]`, so `tsc --noEmit` is the second content gate. `Story` is the schema's output type: a story JSON must already carry every defaulted field (what `parseStory` would add), or the app typecheck fails.

Cold-start note (spec §3.9, budget 50 ms module evaluation): the bundle is empty today (0 B of data), so there is nothing to measure on a device yet. Host proxy, Node 22 / V8: evaluating a 928 KB literal (48 copies of the ready fixture) takes about 6 ms worst case over 30 runs. This says nothing about Hermes on a mid-range Android phone; the device measurement belongs to the first PR that bundles real stories (F-STORY-001 PR 1.8, the first that makes a story `ready`; 1.7 imports drafts only), and if it exceeds 50 ms `storiesAll` moves to per-story lazy `require` behind the same API.
