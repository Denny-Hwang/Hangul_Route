---
date: week-01 / Monday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/tokens/colors.v1.md
  - design/tokens/colors.v1.png
depends_on: []
unblocks:
  - packages/design-system/src/tokens.ts (colors export)
  - every UI component work (blocked until this lands)
---

# Day 01 — Monday · Color Palette v1

## 오늘의 목표
영어권 어린이 5-11세 를 위한 **브랜드 팔레트 v1** 결정. Primary / Secondary / Accent / Semantic (success / warning / error / info) / Neutral 9단계. WCAG AA 통과.

## 왜 오늘
- 한 주의 첫 토대. 색 없으면 Typography·Spacing 다 허공에 뜬다.
- `packages/design-system/src/tokens.ts` 의 `colors` 가 지금 빈 객체 — 컴포넌트 착수 전제 조건.

## 사전 준비 (1분)
- 레퍼런스 탭 2개: Duolingo Kids, Khan Academy Kids.
- 금지 스타일 상기: 한국 학습지 원색 빨강·원형 도장.
- 기기 밝기 중간.

## Claude Design 프롬프트 (복붙)

```prompt
You are designing a color palette v1 for "Hangul Route" — a Korean-language
learning app for English-speaking children ages 5-11 (target audience:
Korean heritage kids whose parents speak Korean but they don't, plus
K-culture-curious international kids).

Visual reference I want to match: Duolingo Kids, Khan Academy Kids, DragonBox.
Visual reference I do NOT want: Korean workbook red circles, oversaturated
kids-TV primaries, Korean heritage-style hanji/dancheong as UI chrome.

Propose a palette with:
- 1 Primary (warm, friendly, kid-safe; will be Hoya-adjacent orange family)
- 1 Secondary (complementary, cool tone for calm surfaces)
- 1 Accent (for celebration / reward moments)
- 4 Semantic: success (green family), warning (amber), error (soft red — not
  alarming), info (blue)
- 9-step Neutral scale from white to near-black

For each color give:
- name (semantic, not "blue-500"): e.g. "brand.primary", "surface.muted"
- hex
- on-color (the text color that passes WCAG AA on top of it, 4.5:1 for body)
- notes on where to use (1 short sentence)

Finally show two contrast checks:
1. body text on each surface color
2. primary button with its on-color label

Return the palette as a Markdown table and as a single PNG of swatches.
Keep saturation tempered — we want "friendly cartoon" not "energy drink".
```

## 작업 흐름 (10분)
1. 위 프롬프트로 세션 시작.
2. 1차 제안 확인 — Primary 가 너무 빨강/노랑 극단이면 "slightly more coral/amber" 같은 한 줄로 미세 조정.
3. WCAG AA 테이블 확인. 미달 페어가 있으면 "adjust X to pass AA on Y" 요청.
4. 최종 확정되면 PNG 스와치 받아두기.

## 결과 저장 (3분)
1. 팔레트 표를 `design/tokens/colors.v1.md` 에 저장 (Markdown 표 그대로 + 간단한 사용 노트).
2. 스와치 PNG 를 `design/tokens/colors.v1.png` 로 저장.
3. 세션 프롬프트 + 느낌을 `design/prompts.md` 의 오늘 날짜 엔트리로 추가.
4. 커밋: `design(tokens): add color palette v1`.

## Code 다음 단계 안내
오늘 바로 승격하지 않는다. 금요일에 spacing·typography 까지 확정된 뒤 일괄 승격 PR 을 연다:
```
design: promote W1 tokens to design-system
```

## 막힐 때 대응
- Claude Design 이 너무 "성인 UI" 느낌으로 제안 → "the audience is children ages 5-7 starting grade; think Duolingo Kids" 한 번 더 못박기.
- 접근성 테이블 혼란 → 본문/타이틀 기준 분리해서 다시 요청.
- 15분 초과 → 일단 "MVP 팔레트" 로 고정하고 내일 이동. `week-01/README.md` 에 "revisit colors next Monday" 메모.

## 검토 체크리스트
- [ ] Primary 가 호야 털색과 충돌하지 않나 (호야는 내일모레 디자인하지만 orange/amber 가정).
- [ ] Error 가 "비난" 느낌 아닌가 (아동 대상은 soft red).
- [ ] Surface 색이 본문 텍스트와 4.5:1 이상인가.
- [ ] 색상 이름이 semantic 한가 (`brand.primary` ✓ / `orange500` ✗).

## 다음 시안 연결
- 내일(Tue) Typography 는 이 팔레트의 on-color 대비를 전제로 한다.
- 목(Thu) 호야 v1 털색은 여기 Primary family 를 재사용.
- 금(Fri) 아이콘 stroke 기본색도 여기 Neutral 에서 고른다.
