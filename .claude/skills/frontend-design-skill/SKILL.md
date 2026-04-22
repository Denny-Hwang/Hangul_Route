---
name: frontend-design-skill
description: Visual·interaction design 시안 만들 때 참조하는 표준.
  본인이 Claude Design 세션 (수동) 진행 시 가이드로 사용.
  design/playbook/ 의 일일 가이드도 이 Skill을 따름.
  design/screens/ · design/components/ · design/characters/ · design/illustrations/ 신규·수정 시 트리거.
---

# Frontend Design Skill

Visual / interaction design 시안 작성의 표준. 본인이 Claude Design 세션
(수동) 을 진행할 때의 가이드, Claude Code 가 시안 → 코드 변환할 때의
기준, design 변경 PR 검토 시의 체크리스트 역할을 한다.

근거: `docs/blueprints/01-competitor-wireframe-analysis.md`,
`docs/blueprints/02-core-feature-spec.md`.

---

## 1. Trigger

자동 트리거 조건:

- 경로: `design/screens/**`, `design/components/**`, `design/characters/**`, `design/illustrations/**`
- 경로: `design/playbook/**` (일일 가이드도 본 Skill 준수)
- 사용자 요청 키워드: "시안", "visual design", "인터랙션", "호야 표정", "카드 비주얼"
- 선행 Skill 완료: `wireframe-skill` 이 확정된 이후에만 시작

동반 Skills:
- 선행: `wireframe-skill`
- 후행: `design-handoff-skill` (코드 승격), `design-system-skill` (토큰화)

---

## 2. Precondition (작업 전 필수 확인)

- [ ] `design/wireframes/<flow>/<screen>.md` 확정본 존재 (draft 아님)
- [ ] `docs/specs/F-XXX-*.md` 의 사용자 목표·대상자 확정
- [ ] 참조 시안 (Duolingo Kids 등) 최근 스크린샷 수집 — 유행 변화 반영
- [ ] Claude Design 세션을 쓰는 경우: `design/prompts.md` 템플릿 확인
- [ ] 대상 연령 범위 (5-6세 초기 학습자 / 7-9세 중간 / 10-11세 상급) 명시

누락 시:

> "wireframe 이 draft 상태라 시안 시작 불가. 먼저 [wireframe-skill] 로
> 구조를 확정한 뒤 시안을 진행해 주세요."

---

## 3. Standard Procedure

### 3.1 작업 흐름 (수동 Claude Design 세션 기준)

1. Wireframe 확정본을 `design/prompts.md` 의 세션 템플릿에 입력
2. 참조 제품의 스크린샷 3-5 장 첨부 (DO / DON'T 예시)
3. 대상 연령 범위·감정 톤 (기분 좋은 / 자랑스러운 / 궁금한 등) 명시
4. 세션 output (PNG / HTML) 을 `design/screens/<flow>/<screen>/v<n>/` 아래 저장
5. 변형 버전을 v1, v2, v3 로 반복 (동일 폴더) — 선택본만 확정 표기
6. 확정된 시안에 메타 (tokens 사용·애니메이션 사양·sound 큐) 를 `spec.md` 로 동반 기록
7. `design-handoff-skill` 로 넘기기 전 §5 체크리스트 통과

### 3.2 연령대별 발달 고려

- **5-6세 (Pre-literate)**: 이미지·아이콘 > 텍스트. 문해력 전제 금지. 색·모양 시그널 강함.
- **7-9세 (Early reader)**: 짧은 영어 문장 OK, 읽기 속도 느림. 큰 타이포, 한 화면 30단어 이하.
- **10-11세 (Reader)**: 긴 문장 OK, 유머 코드 이해. 단, 유치한 인상 회피 ("대접받는 느낌") 중요.

같은 컴포넌트가 3 연령대를 모두 커버한다면 **중간(7-9세)** 을 기본 타깃으로 잡고, 연령 옵션은 텍스트 난이도·톤 레벨로만 조절.

### 3.3 Korean cultural motifs — 비율 가이드

- **콘텐츠 내부 (Heritage Card·배경·일러스트)**: 80% 까지 한국 모티프 OK, 풍부할수록 좋음
- **Stage theme 배경 (L0-L4)**: 30% 수준. 한국 색상 팔레트 (indigo·sepia·gold 등 blueprint 02) 는 OK.
- **주 UI (버튼·메뉴·네비·아이콘)**: 5% 이하. 영어권 어린이 친숙도 우선.
- **한자·한글 장식 배경**: 금지. 학습 대상과 혼동 위험.

### 3.4 Reference visual language

| 참조 | 배울 점 |
|---|---|
| Duolingo Kids (ABC) | 캐릭터 표정·대사 리듬, 라운드 완결 감 |
| Khan Academy Kids | 여백, 유아 시각적 명료함 |
| DragonBox | 인터랙션 피드백·수학 직관화 은유 |
| DinoLingo | 다국어 아동 학습 UX (참고만) |
| Lingokids | 미니게임 전환·캐릭터 퀘스트 구조 |

회피:

- 한국 학습지·교과서 스타일 (네모칸, 빨간 동그라미 X 표시, 시험지 배경)
- 한국 어린이 앱의 "큰 머리·작은 몸" 과장 비율 (프록시미티 불편감)
- 죄책감·위협 프레임 (예: "Duo is sad", 캐릭터 울음)

### 3.5 Heritage stage color (blueprint 02)

| Stage | Theme color |
|---|---|
| L0 (Hangul) | indigo / ink |
| L1 (Words) | sepia |
| L2 (Phrases) | gold / ink |
| L3 (Conversations) | red / gold |
| L4 (Stories) | parchment |

이 팔레트를 한국 전통 5방색 (오방색) 에서 차용했으며, 변형은 design-system-skill 절차로만.

### 3.6 Motion / interaction

- 속도: "cheerful, not frantic" — 200-400ms 기본, 강조 600ms
- easing: `tokens.motion.easing.standard` (ease-out 계열)
- 정답 피드백: 0-200ms 시각 (캐릭터 표정) + 0-300ms 사운드 큐
- 오답 피드백: 짧은 흔들림 (150ms × 2), 정답 노출, 다음 라운드 자동
- `prefers-reduced-motion` 또는 learner-setting off 시: 정지 프레임 + 사운드만

### 3.7 Claude Design 프롬프트 팁 (design/playbook/ 작성 시)

- 항상 "연령대 / 감정 톤 / 대상자" 3종 명시
- DO / DON'T 스크린샷 첨부 (말로만 설명 금지)
- "Korean flat illustration, watercolor, Pixar-style cartoon" 등 스타일 단어 1-2개 픽스
- 결과가 tone off 되면 프롬프트보다 **reference 이미지** 를 보강

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ wireframe 확정 후에만 시안 시작
- ✅ 연령대·감정 톤·대상자 3종 명시
- ✅ Heritage stage 팔레트 준수 (L0-L4)
- ✅ Positive feedback only (blueprint 01)
- ✅ Cascading reward 층위 준수 (quiz 작음 → episode 중간 → stage 큼)
- ✅ 모든 시안에 state 3종 (default / pressed / disabled) 노출
- ✅ 한 컴포넌트 시안은 `design/components/<Name>/v<n>/` 구조

### ❌ 하지 말아야 하는 것

- ❌ 죄책감·위협 기반 프레임 ("Hoya is sad")
- ❌ SNS 스타일 리더보드·비교 (어린이 정신 건강 위험)
- ❌ 한자·한글을 UI 배경 장식으로
- ❌ "큰 머리·작은 몸" 과장 캐릭터
- ❌ 시험지·교과서 인상 (네모칸, 빨간 X)
- ❌ wireframe 없이 바로 시안
- ❌ 주 UI 에 한국 모티프 과다 (5% 초과)

### 캐릭터 예시 (호야)

- ✅ 둥근 몸·호기심 있는 표정·밝은 색상·입꼬리 올림 기본
- ✅ 8가지 표정 세트 최소 (neutral / excited / cheering / thinking / curious / proud / gentle-sad / sleeping)
- ❌ 눈물·절망·굴욕 표정 — 만들지 않음
- ❌ 사람 비율 과장 (머리:몸 > 1:1.2)

---

## 5. Output Validation

### 자동 검증

- `design/screens/**`, `design/components/**` 에 `spec.md` 동반 존재
- 파일 포맷 (PNG 또는 HTML) + 해상도 (2× 이상)
- `design-token-sync.yml` 이 후속 단계에서 토큰 매칭 검증

### 수동 체크리스트

- [ ] wireframe 확정본이 근거로 링크되어 있나
- [ ] 연령대·대상자·감정 톤 명시되어 있나
- [ ] state 3종 (default / pressed / disabled) 모두 그렸나
- [ ] loading / empty / error 상태 시안도 있나
- [ ] 색상 대비 WCAG AA 이상 (7-9세 가독성 위해 AAA 권장 영역 있음)
- [ ] 한국 모티프 비율이 영역별 가이드 내 (UI 5%, stage 30%, 콘텐츠 80%)
- [ ] 캐릭터는 긍정 표정 범위 안
- [ ] Heritage stage 팔레트 (L0-L4) 준수
- [ ] 애니메이션·사운드 큐가 `spec.md` 에 기술됨

---

## 6. Failure Handling

### 6.1 Claude Design 세션 결과가 톤 off

1. 프롬프트 탓 결론 금지 — **reference 이미지 불충분** 이 더 흔한 원인
2. 좋은 예·나쁜 예 각 2-3장 추가 후 재시도
3. 3회 재시도 후에도 off 면 현 결과를 v1 로 저장하고 사용자 판단 요청

### 6.2 wireframe 과 시안이 어긋날 때

- 시안이 틀린 경우: 재작업
- wireframe 이 실제로 부족한 경우: wireframe-skill 로 백트래킹 (별도 PR 로 wireframe 업데이트)
- 직접 시안만 수정해서 wireframe 과 불일치 상태 유지하지 말 것

### 6.3 토큰으로 표현 불가능한 시각

- 새 토큰 필요 → `design-system-skill` 절차로 추가 (별도 PR)
- 시안 자체에 토큰 번호·네이밍을 메모

### 6.4 어린이 검증이 부정적

- 알파 베타 (한글학교) 피드백에서 "너무 유치" / "너무 무서움" 등 반응
- `docs/beta/<cycle>/` 에 feedback 기록
- 재디자인은 별도 F-XXX, 현 시안 버전 동결

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `wireframe-skill` | 선행 (구조) | wireframe → frontend-design |
| `design-system-skill` | 후행 (토큰·컴포넌트 승격) | frontend-design → design-system |
| `design-handoff-skill` | 후행 (코드 변환) | frontend-design → design-handoff |
| `component-skill` | 시안 확정 후 구현 | frontend-design → component |
| `content-skill` | 화면에 담길 콘텐츠 타입·카피 | 병행 |

---

## 8. Examples

### 8.1 좋은 예 — 시안 spec.md

```markdown
# design/screens/quest-play/match-sound/v3/spec.md

## Wireframe source
design/wireframes/quest-play/match-sound.md (v2, finalized)

## Target
- Age: 5-6 (pre-literate) + 7-9 (early reader)
- Emotion tone: curious → cheerful upon success
- Persona: P5 child, ~first month of Hangul

## Tokens used
- Surface: `tokens.color.surface.muted`
- Brand: `tokens.color.brand.primary`
- Option tile: `tokens.color.surface.elevated`
- Pressed opacity: `tokens.opacity.pressed`

## States
- default / pressed / correct / incorrect / all-answered
- loading (audio not yet loaded)
- error (asset failed — fallback to text)

## Motion
- Tile press: scale(0.96) 150ms ease-out
- Correct: tile glow 300ms + hoya "excited" expression 400ms
- Incorrect: tile shake 120ms × 2, correct tile highlight 400ms

## Sound cues
- Press: `tokens.sound.tap`
- Correct: `tokens.sound.positive-short`
- Incorrect: `tokens.sound.gentle-oops`
- Round complete: `tokens.sound.celebrate-small`
```

### 8.2 좋은 예 — Claude Design 프롬프트 (design/prompts.md 발췌)

```
Day 3 — Tuesday (illustration): Heritage Card — Hunminjeongeum

Age: 7-11
Mood: proud, discovery
Style: Korean flat illustration + watercolor wash
DO reference: design/references/dinolingo-card-01.png, dinolingo-card-03.png
DONT reference: design/references/korean-textbook-01.png (square box, red circle)

Output: 3 variants, 1024x1536 2x, export PNG
Save to: design/illustrations/cards/letters/hunminjeongeum/v1/
```

### 8.3 나쁜 예 — 회피할 패턴

```
❌ wireframe 없이 "대충 시안 그려줘" 로 시작
❌ 참조 이미지 없이 텍스트 프롬프트만
❌ 캐릭터 울음·좌절 표정 포함 ("우는 호야")
❌ UI 배경에 한자·한글 장식 텍스처
❌ 5-6세 대상인데 긴 영어 설명문 포함 시안
❌ state 하나 (default) 만 그리고 종료
```

---

## 9. Quick Reference

시안 파일 구조:
```
design/
├── wireframes/<flow>/<screen>.md
├── screens/<flow>/<screen>/v<n>/
│   ├── default.png
│   ├── pressed.png
│   ├── error.png
│   └── spec.md
├── components/<Name>/v<n>/
├── characters/hoya/v<n>/
├── illustrations/cards/<pillar>/<slug>/v<n>/
└── prompts.md
```

Stage 팔레트 요약:
- L0 Hangul = indigo/ink
- L1 Words = sepia
- L2 Phrases = gold/ink
- L3 Conversations = red/gold
- L4 Stories = parchment

커밋 메시지:
```
design(screens): add quest-play/match-sound v3
design(character): hoya — add excited / proud expressions
```
