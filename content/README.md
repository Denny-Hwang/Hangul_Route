# content/

학습 콘텐츠(Episode / Card / Grid 데이터)가 JSON·MDX 형태로 들어갈 디렉토리. 스키마 정의는 `packages/content-schema` 에서 관리한다.

## 하위 디렉토리 문서

- `stories/` — 이야기(story mode) JSON, 한 파일 = 한 이야기. 작성 절차, 사실(fact)·출처 규칙, 버전, **사실 정정(correction) 절차**: [`stories/README.md`](stories/README.md) (F-STORY-001)
- `audio/` — 생성 음성 클립의 입력 데이터 (AMENDMENTS-AUDIO-CLIPS AC-B3, AC-B5). 화면에 보이는 콘텐츠가 아니므로 `scripts/validate-content.mjs` 는 이 폴더를 건너뛴다.
  - `tts-manifest.json` — 콘텐츠에서 생성되는 클립 목록 (클립 하나 = 한 줄: `ref`, `key`, `kind`, `text`, `say`, `rate`, `pack`, `sources`). 손으로 고치지 않는다: 콘텐츠를 바꾼 뒤 `pnpm --filter @hangul-route/mobile audio:tts:manifest` 를 실행해 다시 쓰고 함께 커밋한다 (drift test 가 확인).
  - `pronunciation-overrides.json` — 손으로 고치는 발음 보정표. 키는 앱이 말하는 텍스트(`spokenKo ?? ko`), 값은 엔진에 보낼 `say`(한글 표기), 선택 `ipa`, `reason`, `engine`, `voice`, 선택 `accept`(QA 가 인정하는 인식 결과). 화면에 보이는 글은 바뀌지 않는다. 처음에는 비어 있다.
