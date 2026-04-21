# Workflow: New Feature

F-XXX 스펙에서 PR 까지의 흐름.

## 1. 스펙 작성 (`docs/specs/F-XXX-<slug>.md`)
- 템플릿 8섹션 (README 참조) 채우기.
- 상태 `draft` → `ready` 로 전환 시 "구현 가능" 의미.

## 2. 브랜치
- `feat/<slug>` — 예: `feat/hangul-tile-game`
- 루틴 생성은 `claude/*`.

## 3. TDD 구현
1. 실패 테스트 작성 (unit 먼저).
2. 최소 구현.
3. 리팩터.
4. 필요하면 integration / e2e 테스트 추가.

## 4. 디자인 반영
- UI 있는 기능은 `design/screens/` 또는 `design/components/` 시안 링크 필수.
- 컴포넌트는 `packages/design-system` 토큰만 사용.

## 5. PR
- 제목: Conventional Commits — `feat(mobile): add hangul tile game`
- 본문:
  - F-XXX 링크
  - 변경 요약
  - 테스트 결과 (스크린샷 또는 로그)
  - 커버리지 델타
- 라벨: 영역 (`mobile` / `web` / `api` / `design`).

## 6. 리뷰
- 수동 리뷰 + (루틴 생성 시) R3 자동 리뷰.
- CI 6개 (ci / coverage-gate / content-validation / design-token-sync / routine-validation / preview-deploy) 통과 필요.

## 7. 머지
- Squash merge 권장.
- F-XXX 스펙 상태를 `shipped` 로 업데이트 (별도 PR 가능).
