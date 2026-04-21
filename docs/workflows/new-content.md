# Workflow: New Content

에피소드 / 퀘스트 / 카드 추가.

## 1. 스키마 확인
- `packages/content-schema/` 의 zod 스키마가 필요한 필드를 모두 커버하는지.
- 누락 시 스키마 먼저 업데이트 (별도 PR) → 콘텐츠는 그 다음.

## 2. 브랜치
- `content/<id>` — 예: `content/stage1-ep01`

## 3. 콘텐츠 작성
- 위치: `content/episodes/`, `content/cards/`, `content/quests/` (스키마 따라).
- 언어 정책 (`.claude/skills/content-skill/SKILL.md`):
  - UI text = English (CEFR Pre-A1)
  - Korean = 학습 대상만 (자모/단어/문장)
  - Romanization 항상 병기
  - English 의미 항상 병기

## 4. 로컬 검증
```bash
pnpm --filter @hangul-route/content-schema test
```

## 5. PR
- 제목: `content(stage1): add Episode 01 "Meeting Hoya"`
- 본문: 에피소드 학습 목표, 포함된 카드 수, 커버된 자모/단어 리스트.

## 6. CI
- `content-validation.yml` 이 zod 검증 + 언어 정책 체크 수행 (R2 와 동일 로직).

## 7. 머지 후
- `docs/blueprints/05-episode-learning-goals.md` 업데이트 (필요 시).
