# R6 — Weekly Report

매주 금요일 저녁 주간 활동을 요약하여 `docs/weekly/` 에 리포트 생성.

## Trigger
- Cron: `0 9 * * 5` UTC (= 금 18:00 KST)
- Manual: `workflow_dispatch`

## Input
- `git log` — 이번 주 커밋
- GitHub API — 이번 주 열린/닫힌 PR, 이슈
- `docs/tasks/DONE.md` — 완료 태스크
- `docs/weekly/` 이전 주 리포트

## Steps
1. 이번 주 기간 설정 (월 00:00 KST — 금 18:00 KST).
2. 커밋 / PR / 이슈 집계.
3. 완료 태스크 — INBOX 대비 처리율.
4. 커버리지 트렌드 (R4 로그 에서 추출).
5. 디자인 진행 상황 — `design/playbook/week-NN/` 완료 여부.
6. 베타 사이클 상태 (있으면).
7. 다음 주 계획 초안.
8. `docs/weekly/YYYY-Www.md` 로 PR 생성.

## Output
- PR: `claude/weekly-YYYY-Www` → `main`
- 파일: `docs/weekly/YYYY-Www.md`

## Failure modes
- 이번 주 활동 전무 → 짧은 "조용한 주" 리포트, 여전히 생성.
- GitHub API rate limit → 재시도 1회 후 실패 시 커밋 로그 기반 최소 리포트.
