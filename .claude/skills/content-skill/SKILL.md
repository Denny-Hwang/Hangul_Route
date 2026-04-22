---
name: content-skill
description: Episode·Quest·Card·캐릭터 대사 등 콘텐츠 JSON 작성 시 사용.
  content/ 디렉토리 변경 시 트리거. 영어 UI + 한국어 학습 대상 분리, vocabulary
  scaffolding, Quest 5-step 타이밍 규약.
---

# Content Authoring Skill

`content/` 아래 Episode · Quest · Card · 캐릭터 대사 · 미니게임 fixture 등
모든 학습 콘텐츠 JSON 작성 규약. 언어 정책·어휘 scaffolding·Quest 구조·
fixture 작성 기준·공공누리 자료 라이선스 처리까지 커버한다.

근거: `docs/blueprints/04-main-content-outline.md`,
`docs/blueprints/05-episode-learning-goals.md`,
`CLAUDE.md` §1 (언어 정책), §8 (Do NOT).

---

## 1. Trigger

자동 트리거 조건:

- 경로: `content/**` (episodes, quests, cards, characters, assets, fixtures)
- 경로: `packages/content-schema/**` (schema 변경 동반 콘텐츠 조정)
- PR 레이블: `content`
- 사용자 요청 키워드: "에피소드 작성", "Quest 추가", "카드 카피", "호야 대사", "fixture"

동반 Skills:
- `test-skill` — 모든 콘텐츠는 zod 스키마 통과 테스트 + fixture 테스트
- `minigame-skill` — 각 미니게임 라운드는 해당 게임 스키마 준수
- `design-handoff-skill` — 카드 이미지·아이콘 자산 승격

---

## 2. Precondition (작업 전 필수 확인)

- [ ] `packages/content-schema/src/` 에 대상 타입 (Episode / Quest / Card / Minigame fixture) zod 스키마 존재
- [ ] `docs/blueprints/04` 의 grid 위치 (Stage × Theme) 확정
- [ ] `docs/blueprints/05` 의 해당 Episode 학습 목표 (Anchor Skill · Quest 3개 decomposition) 존재
- [ ] 이전 Episode 단어장 (누적 vocab) 확인 — 반복 대상 식별
- [ ] 공공누리 자료 사용 시 출처·기관·라이선스 정보 준비 (KOGL Type 1/2/3/4 구분)
- [ ] Character 대사는 `content/characters/hoya/voice.md` 규약 확인 (persona 일관성)

누락 시:

> "이 Quest 의 학습 목표가 05-episode-learning-goals 에 정의되어 있지 않습니다.
> Episode X.A1 의 Q2 대상·평가 기준을 먼저 확정해 주세요."

---

## 3. Standard Procedure

### 3.1 Quest 5-step 구조 (강제)

모든 Quest 는 다음 5 단계를 순서대로 포함한다 (blueprint 05):

| Step | 목표 | 타이밍 |
|---|---|---|
| **Hook** | 호기심·맥락 제시 | 15-20s |
| **Discover** | 학습 요소 노출·설명 | 45-60s |
| **Play** | 미니게임 (catalog 12종 중 선택) | 90-120s |
| **Check** | 2-3문항 확인 | 30-45s |
| **Celebrate** | 별·피드백·다음 안내 | 15-20s |

합계 **3-4분**. 초과하면 Quest 분할.

### 3.2 Episode 계층

```
Stage (S1..S7) × Theme (T1..T5) = Episode
Episode = { quests: Quest[3], completion_card: Card }
Quest   = { hook, discover, play, check, celebrate, learning_elements[] }
Card    = { pillar, title, image_url, source { institution, license, attribution } }
```

- Episode ID 규칙: `{stage}.{theme_code}.{ep_number}` 예) `1.A1.1`
- Quest ID 규칙: `{episode_id}-q{n}` 예) `1.A1.1-q2`
- Card ID 규칙: `card-{pillar}-{slug}` 예) `card-letters-hunminjeongeum`

### 3.3 언어 정책 (강제)

- **UI text = English** (CEFR Pre-A1, 5-7세 어휘)
- **Character dialogue = English**
- **Korean = 학습 대상만** (자모·단어·문장)
- **Romanization** 항상 동반 (McCune-Reischauer 가 아닌 Revised Romanization)
- **English gloss** 또는 visual 항상 동반

예:
```
✅ "Tap the letter that says 'ga' (가)"
✅ "What does 사과 (sa-gwa) mean? Apple? Banana? Orange?"
✅ hoya: "Let's learn ㄱ! It sounds like /g/."
❌ "ㄱ을 터치하세요"           (UI 가 한국어)
❌ "사과는 빨간 과일이에요"     (설명 문장이 한국어)
❌ "사과" (romanization 없음)
❌ "사과 — a fruit"            (visual 또는 영어 단어 gloss 필요)
```

### 3.4 어휘 scaffolding (blueprint 05)

- 한 Quest 에 새 항목 상한:
  - 자음 1-2개 / 모음 1-2개
  - 단어 3-4개
  - 문법 패턴 1개
  - 시나리오 1개 / 이야기 1개
- 한 Quest 안에서 새 단어는 **3+회 반복** (spaced)
- 이전 Episode 단어가 새 Quest 의 **최소 50%** 자연 재등장
- 누적 어휘 목표: Stage 1 = 30, Stage 2 = +200, Stage 7 = +1000

### 3.5 Character voice (호야)

- Persona: 호기심 많고 격려하는 새끼 호랑이
- 말투: 짧고 긍정, "Let's ...", "You got it!", "One more time?"
- 절대 금지: 죄책감 유발 ("You failed", "Duo is sad" 류), 조롱, 긴 설명
- 모든 오답 반응은 "괜찮아 + 정답 노출 + 다음 진행"
- 호야 대사 변형은 `content/characters/hoya/voice.md` 에 풀을 관리, 라운드마다 랜덤 선택

### 3.6 Fixture (content/fixtures/)

- 목적: 테스트 전용. 실제 Episode 와 무관
- 각 미니게임 타입마다 최소 1 valid + 1 invalid fixture
- 명명: `<minigame>.<variant>.fixture.json` 예) `match-sound.single-round.fixture.json`
- zod `safeParse` 로 valid / invalid 판정 테스트

### 3.7 Heritage Card 자산 (공공누리 등)

`content/assets-license.csv` 에 다음 행을 추가:

```csv
asset_path,source_institution,kogl_type,attribution_text,url
content/cards/letters/hunminjeongeum.png,국립한글박물관,KOGL Type 1,"국립한글박물관",https://...
```

- KOGL Type 4 (상업 이용·변경 금지) 는 **MVP 사용 금지**
- 2차 저작 시 attribution_text 에 "2차 저작" 명시

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ 모든 JSON 은 `packages/content-schema` zod 로 `safeParse` 통과
- ✅ 영어 UI 카피는 CEFR Pre-A1 수준 (능동·단문·구어)
- ✅ 한국어 학습 대상은 **Korean + Romanization + English gloss/visual** 3종 동반
- ✅ Quest 는 5-step 순서 준수, 합계 3-4분
- ✅ 이전 Episode 단어 재등장 비율 ≥ 50%
- ✅ 공공누리 출처는 `assets-license.csv` 에 동일 PR 에서 추가
- ✅ 호야 대사는 격려 톤, 짧게, voice.md pool 관리

### ❌ 하지 말아야 하는 것

- ❌ UI 문자열에 한국어 (예: "터치하세요")
- ❌ 한국어 설명 문장 (예: "사과는 빨간 과일이에요")
- ❌ Romanization 없이 한글 단독 노출
- ❌ 한 Quest 에 새 요소 남발 (단어 3-4 초과, 문법 2+ 등)
- ❌ 호야 대사에 죄책감·조롱·긴 설명
- ❌ KOGL Type 4 자료 사용
- ❌ fixture 를 실제 Episode 에 그대로 사용

### 영어 어휘 체크리스트 (5-7세 기준)

- ✅ OK: tap, go, see, find, try, match, nice job, one more
- ⚠️ 경계: recognize → "find", collection → "cards", progress → "steps"
- ❌ 금지 (추상·행정·학술): recognize, evaluate, progression, consequence

---

## 5. Output Validation

### 자동 검증 (CI)

- `.github/workflows/content-validation.yml`:
  - 모든 `content/**/*.json` → zod `safeParse` 통과
  - `assets-license.csv` 에 자산 파일마다 대응 행 존재
  - `content/characters/hoya/voice.md` 의 대사 토큰이 실제 대사 참조와 일치
- `R2 Content Validator` 루틴이 PR 레벨에서 동일 검증 + 길이·어휘 휴리스틱

### 수동 체크리스트 (PR 제출 전)

- [ ] Quest 3개 모두 5-step 완비
- [ ] 총 재생 시간 3-4분 × 3 Quest ≈ 10-15분 (Episode)
- [ ] 이전 Episode 단어 재등장 50%+ 확인 (스크립트 또는 수동)
- [ ] 한 Quest 에 새 요소 상한 준수
- [ ] 호야 대사가 voice.md 톤에 부합
- [ ] Card 자산 라이선스 행 추가
- [ ] fixture 는 `content/fixtures/` 아래, 실 Episode 에 섞이지 않음

---

## 6. Failure Handling

### 6.1 zod 스키마 실패

1. 오류 메시지에서 경로·기대 타입 식별
2. 콘텐츠 JSON 수정 (스키마 수정이 아님 — 스키마는 source of truth)
3. 스키마 자체에 문제가 있다고 판단되면 content-skill 중단, `packages/content-schema` 별도 PR

### 6.2 어휘·길이 휴리스틱 경고 (R2)

- 영어 UI 가 Pre-A1 초과 → 단어 교체
- Quest 총 시간이 4분 초과 → Play 라운드 감소 (5→3) 또는 Quest 분할

### 6.3 이전 Episode 단어 재등장 <50%

- 새 Play 라운드 1-2 개에 기존 단어를 distractor 로 삽입
- 해결 불가하면 해당 Episode 순서 조정을 04 에 제안하는 이슈로 보고

### 6.4 호야 대사 tone 이탈

- voice.md 의 pool 에서 맞는 대사 선택
- 신규 대사가 필요하면 voice.md 먼저 업데이트 (별도 커밋)

### 6.5 공공누리 자산 라이선스 미확보

- 자산 사용 즉시 중단
- `assets-license.csv` 확인 → 출처 없는 자산이면 대체 자산 탐색 또는 Card 자체 보류

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `test-skill` | fixture 와 zod 스키마 통과 테스트 | content 작성 ↔ test 동시 |
| `minigame-skill` | 각 Play 단계는 미니게임 스키마 준수 | content 가 minigame catalog 를 consume |
| `design-handoff-skill` | 카드·아이콘 자산 승격 | content 가 자산 경로 참조, design-handoff 가 파일 제공 |
| `component-skill` | Episode Player 컴포넌트가 content 를 렌더 | content 스키마 확정 후 component 구현 |

---

## 8. Examples

### 8.1 좋은 예 — Episode 1.A1 Quest 1 JSON (발췌)

```json
{
  "id": "1.A1.1-q1",
  "episode_id": "1.A1.1",
  "sequence": 1,
  "learning_elements": [
    { "type": "jamo", "value": "ㄱ", "romanization": "g" },
    { "type": "jamo", "value": "ㄴ", "romanization": "n" }
  ],
  "steps": [
    {
      "type": "hook",
      "duration_sec": 18,
      "lines": [
        { "speaker": "hoya", "en": "Look! Two new shapes. What could they be?" }
      ]
    },
    {
      "type": "discover",
      "duration_sec": 50,
      "visual": "jamo-mouth-ga-na.mp4",
      "lines": [
        { "speaker": "hoya", "en": "This is ㄱ. It says /g/ — like 'go'." },
        { "speaker": "hoya", "en": "This is ㄴ. It says /n/ — like 'no'." }
      ]
    },
    {
      "type": "play",
      "minigame_id": "match_sound",
      "duration_sec": 110,
      "content_ref": "content/minigames/match-sound/q-1.A1.1-q1.json"
    },
    {
      "type": "check",
      "duration_sec": 35,
      "items": [
        { "prompt_audio": "ga", "options": ["ㄱ", "ㄴ"], "answer": 0 },
        { "prompt_audio": "na", "options": ["ㄱ", "ㄴ"], "answer": 1 }
      ]
    },
    {
      "type": "celebrate",
      "duration_sec": 18,
      "stars_max": 3,
      "lines": [
        { "speaker": "hoya", "en": "You got it! ㄱ and ㄴ are friends now." }
      ]
    }
  ]
}
```

왜 좋은가:
- 5-step 모두 존재, 총 231초 = 3분 51초 (범위 내)
- UI = English, Korean = jamo 학습 대상만, romanization 별도 필드
- 호야 대사 격려 톤·짧음

### 8.2 좋은 예 — Card JSON + 라이선스

```json
{
  "id": "card-letters-hunminjeongeum",
  "pillar": "letters",
  "title": "Hunminjeongeum",
  "image_url": "content/cards/letters/hunminjeongeum.png",
  "source": {
    "institution": "국립한글박물관",
    "license": "KOGL-Type1",
    "attribution": "국립한글박물관",
    "url": "https://..."
  }
}
```

`content/assets-license.csv` 에 동일 PR 에서:

```csv
content/cards/letters/hunminjeongeum.png,국립한글박물관,KOGL Type 1,"국립한글박물관",https://...
```

### 8.3 나쁜 예 — 회피해야 할 패턴

```json
// UI 가 한국어 + romanization 없음 + 긴 설명
{
  "type": "hook",
  "lines": [
    { "speaker": "narrator", "ko": "오늘은 ㄱ을 배울 거예요. ㄱ은 한국어의 첫 번째 자음이고..." }
  ]
}
```

```json
// 한 Quest 에 새 요소 과다 — 분할 필요
{
  "learning_elements": [
    { "type": "jamo", "value": "ㄱ" },
    { "type": "jamo", "value": "ㄴ" },
    { "type": "jamo", "value": "ㄷ" },
    { "type": "jamo", "value": "ㄹ" },
    { "type": "vowel", "value": "ㅏ" },
    { "type": "vowel", "value": "ㅓ" }
  ]
}
```

```
// 호야 tone 이탈
hoya: "You failed. Try harder next time."
```

---

## 9. Quick Reference

콘텐츠 경로:
```
content/
├── stages/<stage>/episodes/<episode-id>.json
├── quests/<quest-id>.json
├── cards/<pillar>/<slug>.json
├── minigames/<type>/<ref>.json
├── characters/hoya/voice.md
├── assets-license.csv
└── fixtures/<minigame>.<variant>.fixture.json
```

커밋 메시지 예:
```
content(stage1): add 가-하 consonant cards (F-017)
content(episode): add 1.A1.1 quests (ㄱ·ㄴ·ㅏ·ㅓ)
content(card): add hunminjeongeum heritage card + KOGL attribution
```

P4 (heritage child) 고려:
- 일부 P4 자녀는 가족 단어 (엄마 · 김치 등) 친숙
- 현재 MVP 는 **P5 기준 설계**
- W8 알파 후 "가속 학습" 옵션 검토 — 지금은 추가 분기 금지
