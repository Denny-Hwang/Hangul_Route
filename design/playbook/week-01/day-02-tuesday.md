---
date: week-01 / Tuesday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/tokens/typography.v1.md
  - design/tokens/fonts.md
depends_on:
  - design/tokens/colors.v1.md (contrast baseline)
unblocks:
  - packages/design-system/src/tokens.ts (typography export)
  - all text-bearing components (bubbles, cards, labels)
---

# Day 02 — Tuesday · Typography Scale

## 오늘의 목표
**영문 + 한글 동시 사용**을 전제로 한 타입 스케일 v1. 폰트 스택 2종 (영문 primary, 한글 companion), 8단계 크기, weight 3종 (regular / semibold / bold), line-height / letter-spacing 규칙.

## 왜 오늘
- 영어권 어린이가 영문을 읽으면서 동시에 **한글 자모의 모양을 식별**해야 한다. 장식 폰트 쓰면 받침 모양이 뭉개져 학습 실패.
- Day 01 의 색을 실제 가독성으로 검증하는 첫 번째 자리.

## 사전 준비 (1분)
- `design/tokens/colors.v1.md` 열어두기 — 대비 체크에 사용.
- 폰트 후보 한 번 눈에 확인:
  - 영문: Nunito / Baloo 2 / Quicksand / Open Sans
  - 한글: Pretendard / Noto Sans KR / Gowun Dodum
- 금지: 손글씨·장식 폰트 (한글 자모 학습 방해).

## Claude Design 프롬프트 (복붙)

```prompt
Design a typography scale v1 for Hangul Route.

Audience: English-speaking kids ages 5-11 learning Korean from zero.
UI text = English (CEFR Pre-A1). Korean = ONLY for learning targets.
When Korean appears, romanization is shown alongside.

Constraints:
- Need two font families that pair well:
  (a) English primary — friendly, rounded, rendered well at small sizes;
      candidates: Nunito, Baloo 2, Quicksand.
  (b) Korean companion — MUST render 자모 (including 받침) clearly without
      decorative strokes; candidates: Pretendard, Noto Sans KR.
- 8-step size scale from caption to display.
- 3 weights only: regular / semibold / bold.
- line-height optimized for children (more generous than adult UI).
- letter-spacing notes where relevant.
- Accessibility: every pairing must clear WCAG AA on the palette from
  design/tokens/colors.v1.md (I'll attach key colors).

Deliverables:
1. A table: size-name | px | line-height | weight | use-case
2. Two visual specimens side-by-side (English vs Korean) at sizes:
   body, title, and display. Korean specimen must show 자음 + 모음 + 받침.
3. Explicit notes on:
   - when to mix weights (never use bold for body)
   - when Korean appears, should it match English body size exactly, or be
     slightly larger because learners are parsing shapes?

Attached palette (from yesterday):
[paste the colors.v1.md table here]
```

## 작업 흐름 (10분)
1. 위 프롬프트로 세션 시작. Day 01 팔레트 표를 붙여넣는다.
2. 크기 8단계 받기. 본문 16px / 18px 사이에서 고르되 **작은 기기에서 손가락 2개로 쉽게 읽을 수 있는지** 체크.
3. 한글이 영문보다 약간 커야 하는지(+1–2px) 의견 듣고 결정.
4. 최종 스펙시멘 2장 확정.

## 결과 저장 (3분)
1. `design/tokens/typography.v1.md` — 표 + 결정 노트.
2. `design/tokens/fonts.md` — 고른 폰트 2개, 라이선스 출처, webfont / Expo 로딩 방법 메모.
3. 스펙시멘 이미지를 `design/tokens/typography.v1.png` 로 저장.
4. `design/prompts.md` 로그.
5. 커밋: `design(tokens): add typography scale v1`.

## Code 다음 단계 안내
- 금요일 일괄 승격 PR 에 포함.
- Expo mobile 에서 `expo-font` 로 해당 폰트 로딩 — 승격 PR 과 함께 설정 파일 업데이트.

## 막힐 때 대응
- 한글 폰트가 "너무 차갑다" 느낌 → "softer but still legible — think Pretendard over Noto Sans KR heavy".
- 크기 단계가 너무 촘촘 → "collapse to 6 steps if 8 feels over-engineered".
- 영문·한글 병기 시 줄 무너짐 → 세션에 실제 문장 샘플 ("What does 사과 mean?") 주고 다시 조정.

## 검토 체크리스트
- [ ] 한글 자모 (ㄱ/ㄴ/ㄷ/ㅅ/ㅇ) 각기 구분 확실한가
- [ ] 받침(예: 강·밤·김) 잘림 없는가
- [ ] 작은 크기(caption) 에서 한글·영문 둘 다 읽히는가
- [ ] Bold 남용 없는가 (본문·메뉴·버튼 중 어디에 쓸지 명시됨)

## 다음 시안 연결
- 내일(Wed) Spacing 은 line-height 와 맞물려 수직 리듬을 결정한다.
- Thu 호야 대사 말풍선의 내부 텍스트가 이 스케일을 사용.
- Fri 아이콘 크기는 본문 글자 높이와 비례 (일반적으로 1.25em).
