# docs/tasks/

태스크 큐. R1 Daily Task Runner 가 여기서 매일 한 건을 가져간다.

| 파일 | 역할 |
|---|---|
| `INBOX.md` | 대기 중인 태스크 (상단이 우선순위 높음) |
| `DOING.md` | R1 또는 본인이 작업 중인 태스크 |
| `DONE.md` | 최근 완료 태스크 (30일 보관 후 `tasks/archive/` 로) |
| `PR-TEMPLATE.md` | 태스크 → PR 로 넘길 때 템플릿 |
| `tasks/` | 큰 태스크의 상세 설명 (INBOX 라인이 `- [ ] T-XXX see tasks/T-XXX.md` 같은 참조일 때) |

## 태스크 포맷 (INBOX 한 줄)
```
- [ ] T-042 F-001 핵심 타일 게임 비즈니스 로직 골격 — 2h — spec:docs/specs/F-001-*.md
```
- `T-XXX` = 태스크 ID
- `F-XXX` = 관련 스펙 링크 (없으면 R1 가 blocked 처리)
- 뒤에 예상 소요 시간

## R1 과 본인 수동 운영 병행
- R1 가 하루 한 건 자동. 본인은 원할 때 INBOX 최상단을 직접 집어 작업 가능.
- 중복 방지: INBOX → DOING 이동은 항상 커밋 단위.
