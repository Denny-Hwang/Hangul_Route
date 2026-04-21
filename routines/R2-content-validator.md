# R2 — Content Validator

`content/` 디렉토리 변경 PR 에 대해 zod 스키마 검증과 언어 정책 체크를 수행.

## Trigger
- `pull_request` (opened / synchronize)
- Path filter: `content/**`, `packages/content-schema/**`

## Input
- 변경된 JSON/MDX 파일
- `packages/content-schema/` 의 zod 스키마
- `.claude/skills/content-skill/SKILL.md` — 언어 정책

## Steps
1. 모든 변경 파일을 zod 스키마로 검증.
2. 언어 정책 체크:
   - UI text = English (CEFR Pre-A1)
   - Korean = only for learning targets
   - Romanization present alongside 한글
   - English meaning/gloss present
3. Episode/Quest 간 의존성 그래프 검증 (깨진 링크 없음).
4. 결과를 PR 코멘트 로 보고.

## Output
- PR 체크 상태 (pass / fail)
- PR 코멘트 with 상세 에러 리스트

## Failure modes
- 스키마 미정의 → fail with `schema-missing` 코멘트.
- 언어 정책 위반 → fail, 구체적 라인 인용.
- 의존성 깨짐 → fail, 끊긴 링크 리스트.
