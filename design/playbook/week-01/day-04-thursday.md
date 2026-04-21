---
date: week-01 / Thursday
duration: 20 min (08:10 – 08:30 KST — 5분 추가 허용)
deliverables:
  - design/characters/hoya/v1/idle.png
  - design/characters/hoya/v1/cheering.png
  - design/characters/hoya/v1/thinking.png
  - design/characters/hoya/v1/sad.png
  - design/characters/hoya/spec.md
depends_on:
  - design/tokens/colors.v1.md (primary/accent drive fur color)
unblocks:
  - Hoya feedback bubble (bubble shape is W3, content is Hoya)
  - Week 02 intro screen wireframe (Hoya greets)
  - minigame feedback animation (reaction pose set)
---

# Day 04 — Thursday · Hoya Character v1

## 오늘의 목표
가이드 캐릭터 **호야(Hoya)** 의 v1 — 4가지 기본 포즈 (idle / cheering / thinking / sad). 성격·비율·컬러룰·금지사항을 `spec.md` 한 장에 고정.

## 왜 오늘
- 호야는 학습 전반의 페르소나. 일찍 고정해두면 이후 모든 피드백·인트로·화면에서 재사용.
- 영어권 어린이 앱 톤을 유지하기 위해 **한국식 대두·극단 변형** 을 이 단계에서 잘라낸다.
- 목요일 20분 (5분 더 허용) — 캐릭터는 미세조정이 많아 시간 버퍼.

## 사전 준비 (2분)
- 레퍼런스 스캔: Tinkerbell (Pixar body proportion 참고), Duolingo Kids 캐릭터, Dino from DinoLingo.
- 금지 레퍼런스 상기: 2.0-head 뽀로로식 비율, 한국 학습지 호랑이 (직접적 문화 표상).

## Claude Design 프롬프트 (복붙)

```prompt
Design Hoya v1 — the guide character for Hangul Route.

Who is Hoya:
- A young tiger. Curious, warm, slightly silly. 7-year-old energy.
- Guide for English-speaking kids 5-11 learning Korean from zero.
- Shows up as: app mascot, feedback bubble companion, cheerleader after
  correct answers, gentle nudger after wrong answers.

Visual constraints:
- Pixar-influenced cartoon. NOT Korean studio big-head style
  (2.0-head) — use roughly 3.5-head proportion.
- Fur color: draw from this palette (attach design/tokens/colors.v1.md).
  Primary family (warm orange/amber) for body, cream/white for belly.
- Identity motif: a striped T-shirt that playfully references his own
  tiger stripes (so stripes live on the shirt, body is simpler).
- Silhouette must be recognizable at thumbnail size.

Deliver 4 poses, each a separate transparent-background PNG at 512×512:
1. idle — standing neutral, slight smile, curious.
2. cheering — both paws up, joyful.
3. thinking — one paw on chin, eyes up-and-to-the-side.
4. sad — not crying, not angry; gentle disappointed, used when the child
   got an answer wrong. Must NOT shame the child.

Also write a spec doc covering:
- personality keywords
- proportions (3.5-head, explain why)
- color rules (which palette tokens go where)
- stripe placement rules (shirt only, never face)
- poses library (include notes on what we're adding in later weeks)
- hard NOs (listed bans)

Attached palette:
[paste colors.v1.md]
```

## 작업 흐름 (12분)
1. 위 프롬프트로 세션 시작. Day 01 팔레트 첨부.
2. 1차 결과 검토 — **머리 비율** 먼저 확인 (3.5-head 맞는지). 2.0-head 가까우면 한 줄 수정 요청.
3. **옷 줄무늬** 위치 — 얼굴에 줄무늬 있으면 수정 (호랑이 얼굴 직접 표상은 학습지 느낌).
4. **sad 포즈** — 실망스러운 표정이 "화난/실망한 어른"처럼 보이면 수정 요청: "softer, more like 'let's try again together'".
5. 4 포즈 확정 후 512×512 PNG 요청.

## 결과 저장 (4분)
1. `design/characters/hoya/v1/` 아래 4 PNG 저장 (idle / cheering / thinking / sad).
2. `design/characters/hoya/spec.md` 에 스펙 작성.
3. `design/prompts.md` 로그.
4. 커밋: `design(character): add Hoya v1 — 4 base poses`.

## Code 다음 단계 안내
- 이번 주 금요일에는 승격하지 않는다 (캐릭터 에셋은 아이콘·토큰과 별도 승격 사이클).
- Week 03 에 호야 피드백 말풍선 컴포넌트와 함께 `packages/design-system/src/characters/hoya/` 로 이동.

## 막힐 때 대응
- 포즈 감정이 과장 → "tone down 50%, we want subtle".
- 얼굴 너무 사실적 호랑이 → "stylized cartoon like Duolingo Kids Bea, not realistic".
- 4 포즈가 일관성 없음 → 하나 포즈 고정한 뒤 "keep head/body ratio identical, only change limbs".
- 20분 초과 → 3 포즈 (sad 제외) 로 축소하고 sad 는 다음 주 월요일에 보강.

## 검토 체크리스트
- [ ] 3.5-head 비율 유지 (2.0-head 아님)
- [ ] 얼굴 없는 줄무늬, 옷에만 줄무늬
- [ ] Sad 포즈가 비난·실망이 아닌 "together again"
- [ ] 썸네일(64×64) 로 줄여도 어떤 포즈인지 구분 가능
- [ ] 팔레트 토큰 사용 (하드 오렌지 말고 brand.primary family)
- [ ] 영어권 어린이 눈에 친근 (문화 특정 마커 없음)

## 다음 시안 연결
- 내일(Fri) 아이콘은 호야와 같은 stroke / corner radius 룰 공유 (세계관 일관성).
- Week 02 인트로 화면: Hoya idle + "Hi! I'm Hoya!" 영어 문구.
- Week 06 에 10종 표정으로 확장 — 오늘 4포즈가 베이스라인.
