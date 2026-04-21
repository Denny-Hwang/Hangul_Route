# Workflow: Design → Code

디자인 시안이 코드로 반영되는 경로.

## Input
- `design/playbook/week-NN/day-NN-*.md` 에서 생성된 산출물
  - `design/tokens/*.v1.md` (+ PNG)
  - `design/characters/hoya/v1/`
  - `design/icons/*`
  - `design/wireframes/`, `design/screens/`, `design/components/`

## Pipeline

### 1. 시안 저장
`design/playbook/week-NN/day-NN-*.md` 의 "결과 저장" 섹션 대로 `design/` 하위에 커밋.

### 2. 리뷰
- 본인 (Denny) 자체 확인 + 필요 시 PR 리뷰어 참여.
- 디자인 자체 변경은 `design/*` 브랜치.

### 3. 토큰 승격
- `design/tokens/*.v1.md` → `packages/design-system/src/tokens.ts`
- `.github/workflows/design-token-sync.yml` 이 양쪽 값 일치 검증.
- 승격 커밋 메시지: `design: promote W1 color palette to tokens`.

### 4. 컴포넌트 승격
- `design/components/<name>/spec.md` + 시안 이미지 → `packages/design-system/src/components/<Name>.tsx`
- Storybook story + 테스트 동시 추가.

### 5. 캐릭터·아이콘 승격
- `design/characters/hoya/v1/*.svg` → `packages/design-system/src/characters/hoya/`
- `design/icons/core.v1/*.svg` → `packages/design-system/src/icons/`

## 금지
- 시안 없이 컴포넌트 구현 금지 (CLAUDE.md §5).
- 토큰 거치지 않은 스타일 값 금지.
- `design/` 의 작업본을 임포트 금지 (확정본은 `design-system` 경유).
