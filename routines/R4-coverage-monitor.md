# R4 — Coverage Monitor

`main` 푸시 때마다 커버리지를 측정하고 rolling target 과 비교.

## Trigger
- `push` to `main`

## Input
- 테스트 실행 결과 (`vitest --coverage`)
- `docs/tests/coverage-targets.md` — rolling target

## Steps
1. 모든 패키지 테스트 실행 (`pnpm -r test -- --coverage`).
2. 커버리지 리포트 집계:
   - `content-schema` line / branch / func
   - `backend`
   - `design-system`
   - `mobile` (business logic vs platform-dependent 분리)
   - `web` (verification logic)
3. 각 영역을 rolling target 과 비교.
4. 미달 영역 있으면 이슈 생성 + `docs/weekly/` 에 기록.

## Output
- 이슈 (미달 시): `coverage: <area> below target`
- `docs/weekly/YYYY-Www.md` 자동 추가

## Failure modes
- 테스트 실패 → R4 스킵, 테스트 복구 이슈 우선.
- 커버리지 측정 실패 (도구 에러) → blocked 이슈 생성.
- rolling target 미달 → 경고, push 자체는 차단하지 않음 (차단은 coverage-gate.yml 담당).
