# .claude/skills/

Claude Code (+ Routines) 가 자동 트리거하는 8개 Skills.

| Skill | 트리거 |
|---|---|
| `wireframe-skill` | 와이어프레임·스케치 작업 |
| `design-system-skill` | `packages/design-system/**` 변경 |
| `frontend-design-skill` | 시안·비주얼 기준 참조 |
| `design-handoff-skill` | 시안 → 코드 승격 |
| `component-skill` | 컴포넌트 구현·리뷰 |
| `minigame-skill` | 미니게임 구현 |
| `test-skill` | 테스트 작성·리뷰 |
| `content-skill` | `content/**` 변경 |

각 Skill 은 `SKILL.md` frontmatter 에 `description` 을 선언하여 트리거 조건을 표시한다. 8개 모두 실전 본문이 들어있으며 (각 280-380 줄, 8-섹션 공통 구조: Trigger / Precondition / Standard Procedure / Rules / Output Validation / Failure Handling / Related Skills / Examples), 해당 경로 변경 시 Claude Code 가 자동 참조한다.

## 원칙

- Skills 는 *참조 가능한 규약 모음* — 자동 스크립트 실행이 아님.
- Claude Code 는 관련 파일 수정 시 해당 Skill 을 자동으로 읽는다.
- Skills 내용과 `docs/design/*`, `docs/tests/*` 는 **중복 아닌 보완** — Skills 는 Claude Code 가 당장 참조할 체크리스트, docs 는 인간 독자를 위한 설명.
- 8개 Skill 은 서로 cross-reference 된다 (예: `minigame-skill` → `component-skill` + `test-skill` + `content-skill`). 연관 관계는 각 Skill 의 §7 참조.
