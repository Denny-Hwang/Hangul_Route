# routines/

Claude Code 가 자동 실행하는 **루틴(Routine)** 명세. v2.2 기준 5개 유지한다.

| ID | 이름 | 트리거 | 파일 |
|---|---|---|---|
| R1 | Daily Task Runner | 매일 06:00 KST (cron) | `R1-daily-task-runner.md` |
| R2 | Content Validator | PR opened — paths: `content/**` | `R2-content-validator.md` |
| R3 | PR Reviewer | PR opened — label: `routine-generated` | `R3-pr-reviewer.md` |
| R4 | Coverage Monitor | push to `main` | `R4-coverage-monitor.md` |
| R6 | Weekly Report | 매주 금 18:00 KST (cron) | `R6-weekly-report.md` |

> R5 (Design Sync) 는 제거되었다. 디자인은 **수동** (`design/playbook/`) 으로 운영하며,
> `design/tokens/` ↔ `packages/design-system/` 동기화는
> `.github/workflows/design-token-sync.yml` CI 로 대체된다.

## 운영 원칙

- 모든 루틴 생성 PR 은 `claude/*` 브랜치 에서만 열린다 (메인 직접 push 금지).
- PR 에는 `routine-generated` 라벨이 자동 부착되어 R3 의 대상이 된다.
- 루틴 결과는 `docs/weekly/` 또는 `docs/tasks/` 에 기록된다.
- 각 루틴의 스펙(.md) 은 trigger / input / output / failure-mode 4 섹션을 반드시 포함한다.
