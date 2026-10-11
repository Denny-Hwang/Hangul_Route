# R3 — PR Reviewer

루틴이 생성한 PR 에 대해 Claude 가 리뷰어 역할로 코멘트를 단다.

## Trigger
- `pull_request` (opened, reopened, ready_for_review)
- Label filter: `routine-generated`

## Input
- PR diff
- 관련 F-XXX 명세 (`docs/specs/`)
- `CLAUDE.md` — 코딩 규칙
- `.claude/skills/*` — 해당 영역 스킬

## Steps
1. 변경 범위 확인 — 스펙 밖 파일 수정이 있는지.
2. 테스트 유무 확인 — 각 새 함수/컴포넌트 마다 테스트가 있는지.
3. 커버리지 델타 확인 — `docs/tests/coverage-targets.md` 기준.
4. 디자인 토큰 사용 확인 — 하드코딩된 색/간격/타이포 없는지.
5. 언어 정책 확인 (UI 면) — UI 문자열은 사전 (`packages/i18n`) 에서 선택된 locale (en/es/ko) 로; 영어가 원문 (source); 가르치는 한국어는 `KoreanText` 로 로마자 + gloss 와 함께 (F-I18N-001 §9). `es` / `ko` UI 문자열이나 `content/i18n/` overlay 를 추가하는 것 자체는 위반이 아니다.
   - R8 (Translation Sync) 초안 PR 이면 추가로: `routines/R8-translation-sync.md` 의 Style guide (스페인어 `tú`, 한국어 해요체, 변수에 조사 붙이지 않기, `es` 에 한글 없음, 반-수치심 어휘, 이모지 없음, 말하기 측정 문구 없음) 를 확인하고, R8 이 `packages/i18n/src/messages/en/**`, `landing.legal.privacy.*` / `landing.legal.terms.*`, `LOCALE_STATUS`, `review-ledger.json`, `HANGUL_ROUTE_STRICT_LOCALES` 를 건드리지 않았는지 확인한다. 어긋나면 `review-blocked`.
6. 블로킹 이슈 / 권고 / nit 를 구분하여 코멘트.

## Output
- PR 리뷰 코멘트 (line-level + summary)
- 라벨: `review-pass` / `review-blocked` / `review-nits`

## Failure modes
- 명세 (F-XXX) 링크 없음 → `review-blocked`, "spec required" 코멘트.
- 테스트 없음 → `review-blocked`, 해당 심볼 리스트.
- 디자인 토큰 미준수 → `review-blocked`, 라인 인용.
