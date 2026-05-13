# scripts/

일회성·유지보수용 스크립트가 들어갈 자리. 콘텐츠 검증, 데이터 마이그레이션, 로컬 편의 도구 등이 대상이며, 앱/백엔드 런타임 코드는 각 패키지 안에 둔다.

## CI enforcement scripts

`.github/workflows/*.yml` 가 호출하는 Node 20+ ES module 들. 의존성 없이 빌트인만 사용 — `pnpm install` 실패와 무관하게 동작한다.

| Script | F-XXX | Workflow | Source of truth |
|---|---|---|---|
| `coverage-gate.mjs` | F-COV-001 | `.github/workflows/coverage-gate.yml` | `docs/tests/coverage-targets.json` (mirrors `docs/tests/coverage-targets.md`) |
| `validate-content.mjs` | F-CNT-001 | `.github/workflows/content-validation.yml` | `.claude/skills/content-skill/SKILL.md` §3.3 |
| `check-token-drift.mjs` | F-DES-001 | `.github/workflows/design-token-sync.yml` | `design/tokens/*.v*.md` ↔ `packages/design-system/src/tokens.ts` |

Run locally:

```bash
node scripts/coverage-gate.mjs
node scripts/validate-content.mjs
node scripts/check-token-drift.mjs
```

각 스크립트는 (a) gate 충족, 또는 (b) 검사할 데이터가 아직 없을 때 (커버리지 리포트 부재 / `content/*.json` 부재 / 토큰 MD 부재) **exit 0** 으로 통과하고, 그 외에는 `::error::` annotation 과 함께 **exit 1** 로 실패한다.

이 디렉토리는 `docs/tests/coverage-targets.md` 의 "측정 제외" 규칙에 따라 커버리지 측정에서 빠진다.
