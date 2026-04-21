# R3 — PR Reviewer

루틴이 생성한 PR 에 대해 Claude 가 리뷰어 역할로 코멘트를 단다.

## Trigger
- `pull_request` (opened, reopened, ready_for_review)
- Label filter: `routine-generated`

## Input
- PR diff
- 관련 F-XXX 명세 (`docs/specs/`)
- `CLAUDE.md` — 코딩 규칙
- `.claude/skills/*` — 해당 영역 스킬

## Steps
1. 변경 범위 확인 — 스펙 밖 파일 수정이 있는지.
2. 테스트 유무 확인 — 각 새 함수/컴포넌트 마다 테스트가 있는지.
3. 커버리지 델타 확인 — `docs/tests/coverage-targets.md` 기준.
4. 디자인 토큰 사용 확인 — 하드코딩된 색/간격/타이포 없는지.
5. 언어 정책 확인 (UI 면) — 영어 기반 UI 유지.
6. 블로킹 이슈 / 권고 / nit 를 구분하여 코멘트.

## Output
- PR 리뷰 코멘트 (line-level + summary)
- 라벨: `review-pass` / `review-blocked` / `review-nits`

## Failure modes
- 명세 (F-XXX) 링크 없음 → `review-blocked`, "spec required" 코멘트.
- 테스트 없음 → `review-blocked`, 해당 심볼 리스트.
- 디자인 토큰 미준수 → `review-blocked`, 라인 인용.
