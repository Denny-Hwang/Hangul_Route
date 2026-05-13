# DONE

최근 30일 완료 태스크. 그 이후엔 `tasks/archive/YYYY-Www.md` 로 롤오버.

## Completed

### 2026-05 / W2 (service-review bootstrap)

- [x] T-INFRA F-INFRA-001 Cloudflare Workers Bootstrap (Hello-Hoya worker, wrangler.toml, spec) — PR #7 (squashed `9a048f8`)
- [x] T-003 pnpm-lock.yaml 생성 후 main 에 커밋 (CI `--frozen-lockfile` 통과 가능) — PR #7
- [x] T-001 F-001 "Hangul Tile Game" spec 초안 작성 (Stage 1, Theme A, Match Sound) — PR #8 (squashed `5fb507b`)
- [x] T-004 vitest 워크스페이스 설정 + 첫 4 passing tests (zod sanity ×2, Hono router ×2) — PR #8
- [x] T-005 design playbook week-02 본문 작성 (5 일치 + README) — PR #8
- [x] T-006 F-COV-001 coverage gate enforcement (`scripts/coverage-gate.mjs` + `coverage-targets.json` + `coverage-gate.yml` 갱신) — PR #9 (squashed `7d6ae7a`)
- [x] T-007 F-CNT-001 content language policy validator (`scripts/validate-content.mjs` + `content-validation.yml` 갱신) — PR #9
- [x] T-008 F-DES-001 design token drift detector (`scripts/check-token-drift.mjs` + `design-token-sync.yml` 갱신) — PR #9
- [x] T-009 design playbook week-03 본문 작성 (5 일치 + README) — PR #10 (squashed `974bfa4`)
- [x] T-010 F-002 "Hoya Feedback Bubble" component spec 작성 (status: ready, props surface 닫힘, anti-shame 계약 명문화) — PR #10
- [x] T-019 scripts/__tests__/ 단위 테스트 (3 enforcement script × 8 positive/negative cases = 24 passing tests via Node built-in `node:test`, HANGUL_ROUTE_ROOT env override) + ci.yml 통합 — this PR
- [x] T-020 `@vitest/coverage-v8` 설치 + per-package coverage 활성화 (content-schema / backend / api) + `test:coverage` turbo task + coverage-gate.yml 갱신. coverage-gate.mjs 가 처음으로 진짜 % 측정: 3 pass · 3 skip · 0 fail (W4 alpha) — this PR
