# Workflow: Routine Operations

5개 루틴 운영.

| ID | 이름 | 빈도 | 생성물 |
|---|---|---|---|
| R1 | Daily Task Runner | 매일 06:00 KST | PR |
| R2 | Content Validator | PR (content/**) | CI 체크 + 코멘트 |
| R3 | PR Reviewer | PR (label routine-generated) | 리뷰 코멘트 |
| R4 | Coverage Monitor | push to main | 이슈/weekly 로그 |
| R6 | Weekly Report | 매주 금 18:00 KST | PR (docs/weekly/) |

> R5 (Design Sync) 는 제거. 디자인 수동 + `design-token-sync.yml` 대체.

## 일반 규칙
- 모든 루틴 PR 은 `claude/*` 브랜치.
- `routine-generated` 라벨 부착 → R3 대상.
- 루틴 정의 변경은 `.github/workflows/routine-validation.yml` 이 문법·트리거 체크.

## 실패 대응
- 루틴 실패 시 GitHub Actions 자체 알림 (email/web).
- `blocked` 라벨 부착한 PR 은 자동 종료하지 않고 수동 확인 대기.
- 재시도 정책은 각 루틴 md 의 "Failure modes" 참조.

## 비활성화
- 임시 비활성화: 해당 워크플로우 파일 상단에 `if: false` 추가 (원복 용이).
- 영구 제거: 워크플로우 + `routines/RN-*.md` 함께 삭제, README 의 표 업데이트.
