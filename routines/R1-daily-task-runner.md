# R1 — Daily Task Runner

매일 아침 `docs/tasks/INBOX.md` 의 최상위 태스크 한 건을 집어 PR 로 만드는 루틴.

## Trigger
- Cron: `0 21 * * *` UTC (= 06:00 KST)
- Manual: `workflow_dispatch`

## Input
- `docs/tasks/INBOX.md` — 할 일 큐
- `docs/specs/` — 참조 가능한 F-XXX 명세
- `docs/tests/coverage-targets.md` — 커버리지 기준

## Steps
1. `INBOX.md` 최상단 태스크를 `DOING.md` 로 옮긴다.
2. Claude Code 가 해당 태스크를 구현한다 (TDD — 테스트 먼저).
3. `claude/daily-YYYY-MM-DD` 브랜치 에서 작업.
4. 완료 시 PR 생성 + `routine-generated` 라벨 부착.
5. PR 본문에 F-XXX 링크, 테스트 결과, 커버리지 델타 기록.

## Output
- PR (branch: `claude/daily-YYYY-MM-DD`)
- `DOING.md` 업데이트

## Failure modes
- INBOX 비어 있음 → no-op, 슬랙/이슈 알림 없음.
- 태스크가 모호함 (명세 없음) → 실행 중단, `blocked` 라벨 부착 후 종료.
- CI 실패 → PR 은 열어두되 본문에 `CI: FAILED` 기록.
