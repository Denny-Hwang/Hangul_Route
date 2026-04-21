# docs/specs/

**기능 명세 (Feature Spec) 디렉토리.** 모든 구현 작업은 `F-XXX` 스펙 링크 없이 시작할 수 없다 (CLAUDE.md §5).

## 파일 네이밍
```
F-XXX-<slug>.md
```
- `F-001-hangul-tile-game.md`
- `F-002-hoya-feedback-bubble.md`

## 템플릿 섹션
1. **Context** — 왜 이 기능이 필요한가, 어느 Stage/테마에 속하는가
2. **User story** — P4/P5 의 눈으로 (영어)
3. **Acceptance criteria** — Given/When/Then
4. **Out of scope** — 명시적으로 제외
5. **UI sketch 링크** — `design/wireframes/` 또는 `design/screens/`
6. **Tests** — 어떤 레벨(unit/integration/e2e) 에서 검증
7. **Rollout** — MVP/v1/v2 중 어디
8. **Dependencies** — 다른 F-XXX, 토큰, 에셋

## 상태
- `draft` — 작성 중
- `ready` — 구현 가능
- `in-progress` — 어느 PR 에서 작업 중
- `shipped` — main 반영됨
