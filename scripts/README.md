# scripts/

일회성·유지보수용 스크립트가 들어갈 자리. 콘텐츠 검증, 데이터 마이그레이션, 로컬 편의 도구 등이 대상이며, 앱/백엔드 런타임 코드는 각 패키지 안에 둔다.

## CI enforcement scripts

`.github/workflows/*.yml` 가 호출하는 Node 20+ ES module 들. 의존성 없이 빌트인만 사용 — `pnpm install` 실패와 무관하게 동작한다.

| Script | F-XXX | Workflow | Source of truth |
|---|---|---|---|
| `coverage-gate.mjs` | F-COV-001 | `.github/workflows/coverage-gate.yml` | `docs/tests/coverage-targets.json` (mirrors `docs/tests/coverage-targets.md`) |
| `validate-content.mjs` | F-CNT-001 | `.github/workflows/content-validation.yml` | `.claude/skills/content-skill/SKILL.md` §3.3 |
| `check-token-drift.mjs` | F-DES-001 | `.github/workflows/design-token-sync.yml` | `design/tokens/*.v*.md` ↔ `packages/design-system/src/tokens.ts` |
| `check-i18n.mjs` | F-I18N-001 | `.github/workflows/ci.yml` | `docs/specs/F-I18N-001-ui-locales.md` §3.11; ratchet lists in `scripts/i18n-migrated.json` (`globs`: migrated surfaces; `pluralTernaryBaseline`: legacy plural ternaries per file, only ever lowered) |
| `check-coverage-targets-drift.mjs` | F-COV-002 | `.github/workflows/coverage-gate.yml` | `docs/tests/coverage-targets.md` "Enforced W4 gate" 표 ↔ `docs/tests/coverage-targets.json` |
| `build-stories.mjs` | F-STORY-001 | `.github/workflows/content-validation.yml` | `content/stories/*.json` (ready stories) → `apps/mobile/src/content/stories.generated.ts`; `--check` fails on drift, `--report` fails over the bundle budget |

Run locally:

```bash
node scripts/coverage-gate.mjs
node scripts/validate-content.mjs
node scripts/check-token-drift.mjs
node scripts/check-coverage-targets-drift.mjs
node scripts/check-i18n.mjs
node scripts/build-stories.mjs            # regenerate the story bundle
node scripts/build-stories.mjs --check    # drift detector (CI)
node scripts/build-stories.mjs --report   # sizes and budget (CI)
```

각 스크립트는 (a) gate 충족, 또는 (b) 검사할 데이터가 아직 없을 때 (커버리지 리포트 부재 / `content/*.json` 부재 / 토큰 MD 부재) **exit 0** 으로 통과하고, 그 외에는 `::error::` annotation 과 함께 **exit 1** 로 실패한다.

이 디렉토리는 `docs/tests/coverage-targets.md` 의 "측정 제외" 규칙에 따라 커버리지 측정에서 빠진다.

## Story bundle (`build-stories.mjs`)

`stories.generated.ts` is checked in and never edited by hand: change `content/stories/*.json` (or the script), run `node scripts/build-stories.mjs`, commit both. Drafts are not bundled; `--include-drafts --out <path>` writes a preview bundle (refused under `apps/`). Budget: 1.0 MB raw / 260 KB gzip in total, 60 KB raw per story (`BUDGET` in the script; raising it is a reviewed one-line change).

The literals are typed against `Story[]`, `Episode[]` and `Quest[]`, so `tsc --noEmit` is the second content gate. `Story` is the schema's output type: a story JSON must already carry every defaulted field (what `parseStory` would add), or the app typecheck fails.

Cold-start note (spec §3.9, budget 50 ms module evaluation): the bundle is empty today (0 B of data), so there is nothing to measure on a device yet. Host proxy, Node 22 / V8: evaluating a 928 KB literal (48 copies of the ready fixture) takes about 6 ms worst case over 30 runs. This says nothing about Hermes on a mid-range Android phone; the device measurement belongs to the first PR that bundles real stories (F-STORY-001 PR 1.8, the first that makes a story `ready`; 1.7 imports drafts only), and if it exceeds 50 ms `storiesAll` moves to per-story lazy `require` behind the same API.
