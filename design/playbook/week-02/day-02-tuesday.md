---
date: week-02 / Tuesday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/wireframes/journey/home.md
depends_on:
  - design/wireframes/onboarding/first-quest-preview.md (어제 산출물)
unblocks:
  - F-001 의 §5 UI sketch (홈 → Quest 진입)
  - Stage 1 진도 시각화 (Week 5 mid-fi)
---

# Day 02 — Tuesday · Home (Route) wireframe

## 오늘의 목표
"하루의 첫 화면"인 **Journey Home** 와이어프레임 확정. 학습자의 다음 행동(다음 Quest 1 개)을 즉시 식별·시작할 수 있게 한다. blueprint 02 §3 의 격자(Grid) 구조를 시각화하지만, **격자 전체보다 "다음 1 보"** 가 우선.

## 왜 오늘
- F-001 user story 의 시작점이 이 화면이다.
- 격자 시각화를 잘못 잡으면 정보 과부하 (5-7세에게 7×5 = 35 셀은 너무 많음).
- Home 의 결정이 Library / Classroom 진입 위치를 좌우 (blueprint 02 §2 — 3-view 아키텍처).

## 사전 준비 (1분)
- 어제 산출물 `onboarding/first-quest-preview.md` 의 exit ID 확인 — 오늘 화면이 그 exit 의 대상이어야 함.
- 레퍼런스 스캔: Duolingo path 화면, Khan Academy Kids 홈.
- 금지: 7×5 격자 전체 노출 (정보 과부하), 학부모 위젯 (보조 사용자, child-first 깨짐).

## Claude Design 프롬프트 (복붙)

```prompt
Produce a low-fidelity wireframe for the Hangul Route journey/home screen.

Audience: English-speaking child ages 5–11. Child-first screen — parent
controls live elsewhere.

Strict rules (from wireframe-skill):
- ASCII box diagram only. No color, font, icon, or pixel decisions.
- One primary screen goal — see below.
- 7 sections required: Scenario, Goal, Box, Interaction, Navigation,
  Data, Open questions.
- 3 states required (success / empty / error).
- No competitive social features.

Screen goal:
"Make the next Quest the most obvious tap on the screen."

Must include:
- Hoya avatar (top-left or top-right, placeholder box).
- Settings icon (top corner, tiny, parent-mode entry — placeholder, not
  detailed).
- Current Stage label and a simple progress bar (e.g. "Stage 1: Hangul
  — 4 of 15"). NO 7×5 grid visible at this level; the grid is a Library
  detail.
- Primary CTA: "[[ Continue: Quest 1.A1.2 ]]" — visually largest.
- Two secondary links: Library (→ library/gallery) and Classroom
  (→ classroom/home, parent-mode gated).
- Recently-earned Heritage Card thumbnail (one only, optional;
  empty-state if zero cards).

Edge states:
- Empty: brand-new account, no progress → Hoya invites to start
  Quest 1.A1.1. No card slot shown.
- Error: progress fetch fails → cached progress shown + tiny
  "Reconnecting…" indicator. Continue CTA still tappable with the last
  known Quest.

Output one Markdown file at:
design/wireframes/journey/home.md
```

## 작업 흐름 (10분)
1. 프롬프트 실행 → ASCII 박스 점검.
2. **격자 전체가 노출돼 있으면 강하게 거부**: "no full grid visible; just current Stage + progress bar".
3. Continue CTA 크기 검토 — secondary 링크보다 시각적으로 *명확히* 커야 함.
4. Navigation graph 의 enter 경로에 어제의 `onboarding/first-quest-preview` 가 들어있는지 확인.
5. Empty / Error 상태가 다 그려졌는지 스캔.

## 결과 저장 (3분)
1. `design/wireframes/journey/home.md` 저장.
2. `design/prompts.md` 로그.
3. 커밋: `design(wireframe): add journey/home`.

## Code 다음 단계 안내
- Week 3 의 Progress 컴포넌트 spec(`design/components/progress.md`)이 이 화면의 progress bar 자리를 사용.
- F-001 spec 의 §8 dependencies 에서 "Hoya v1 idle / cheering / thinking" 가 이 화면 + Quest 화면 둘 다에서 필요.

## 막힐 때 대응
- 격자 전체가 자꾸 나옴 → "the grid is a Library/Gallery detail, not the Home screen — Home is 'next 1 thing'".
- "Settings" 아이콘이 너무 커서 child-first 가 깨짐 → "tertiary, corner, finger-tip-size NOT thumb-zone-primary".
- 15 분 초과 → success 상태만 확정, empty / error 는 수요일 30 초로 묶어 처리.

## 검토 체크리스트
- [ ] Continue CTA 가 화면 내 가장 큰 탭 타겟 (≥ 64dp 가정)
- [ ] 7×5 격자 미노출 (Library 로 위임)
- [ ] enter / exit ID 가 어제·내일 화면과 닫힘
- [ ] empty / error 상태 모두 그려짐
- [ ] 학부모 위젯 (예: 시간 제한 표시) 노출 없음

## 다음 시안 연결
- 내일(Wed) `quest/player` 는 Home 의 Continue CTA tap 의 즉시 도착지.
- 목(Thu) `library/gallery` 는 Home 의 Library 링크 도착지.
- F-001 §5 의 첫 sketch (`stage1/match-sound.md`) 가 quest/player 의 하위 변형으로 정의됨.
