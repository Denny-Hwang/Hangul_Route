# design/

Claude Design (수동) 세션의 **작업 공간**. 시안, 에셋, 탐색본, 프롬프트 로그를 모두 여기에.

## 구성

| 경로 | 용도 |
|---|---|
| `playbook/` | **매일 아침 가이드**. week-01..12, 각 day 별 지시문 |
| `tokens/` | 색·타이포·간격 시안 → `packages/design-system` 으로 승격 |
| `wireframes/` | 저충실도 화면 스케치 |
| `components/` | 컴포넌트 시안 (button, card, bubble 등) |
| `screens/` | 전체 화면 시안 |
| `characters/` | 호야 (+ 조연) 캐릭터 에셋 |
| `illustrations/` | 배경·카드 일러스트 |
| `prompts.md` | 매일 쓴 프롬프트·결과 로그 |

## 핵심 원칙

1. **디자인은 수동.** 자동 루틴 없음 (v2.2 에서 R5 제거).
2. 매일 `design/playbook/` 의 그날 가이드를 따라 Claude Design 세션 진행.
3. 확정본은 `packages/design-system/` 로 승격 — 이곳(`design/`)은 히스토리.
4. `design/tokens/` ↔ `packages/design-system/` 동기화는 `.github/workflows/design-token-sync.yml` 이 CI 단계에서 검증.

## 시작하기

```
design/playbook/README.md           # 플레이북 사용법
design/playbook/overview.md         # 12주 로드맵 + 코드 의존성
design/playbook/week-01/day-01-monday.md   # 첫 날
```
