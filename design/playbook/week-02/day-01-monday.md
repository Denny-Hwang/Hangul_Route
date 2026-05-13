---
date: week-02 / Monday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/wireframes/onboarding/welcome.md
  - design/wireframes/onboarding/language-pick.md
  - design/wireframes/onboarding/first-quest-preview.md
depends_on:
  - design/characters/hoya/spec.md (placeholder OK if W1 Thursday rollover)
unblocks:
  - apps/mobile 첫 진입 플로우 (Week 5 mid-fi 가능)
  - F-001 에서 가정하는 "에피소드 1·A1 첫 진입" 경로
---

# Day 01 — Monday · Intro / Onboarding wireframe

## 오늘의 목표
앱을 처음 여는 P5 어린이(영어권 K-culture 5–7세)의 **진입 3 화면** 와이어프레임을 확정한다:

1. `onboarding/welcome` — 호야 인사 + value-first CTA.
2. `onboarding/language-pick` — UI 언어 / 한국어 학습 의향 분기 (P4/P5 라우팅 가중치 입력).
3. `onboarding/first-quest-preview` — 계정 생성 *없이* 첫 Quest 30 초 체험 (blueprint 01 "value first" 원칙).

## 왜 오늘
- F-001 은 "에피소드 1·A1 첫 진입"을 가정한다. 그 진입 경로가 없으면 spec 의 user story 가 허공이다.
- 온보딩은 **계정 생성을 뒤로 미룬다** (blueprint 01 anti-pattern: signup-wall). 오늘 그 결정을 와이어프레임에 박는다.
- 학부모(보조 사용자)는 이 단계에서 일절 등장하지 않는다 — child-first.

## 사전 준비 (1분)
- 레퍼런스 1탭: Duolingo Kids 의 첫 30 초.
- `.claude/skills/wireframe-skill/SKILL.md` §3.1 (7-섹션 구조) 재확인.
- 금지 패턴 상기: 죄책감 카피, SNS 공개 경쟁, signup-wall, 색·폰트 결정.

## Claude Design 프롬프트 (복붙)

```prompt
Produce 3 low-fidelity wireframes for the Hangul Route onboarding flow.

Audience: English-speaking child ages 5–7 (P5), opening the app for the
first time. They cannot read fluent English yet. UI text is English at
CEFR Pre-A1 / 5-7yo vocabulary.

Strict rules (from wireframe-skill):
- ASCII box diagrams only. No color, font, icon, or pixel decisions.
- Each screen has ONE primary goal.
- Each screen documents 7 sections: Scenario (Given-When-Then), Screen
  goal, Box diagram, Interaction points, Navigation graph (enter/exit
  with screen IDs), Data needs, Open questions.
- Each screen considers 3 states: success, empty, error.
- No signup wall on welcome — value first, account later (blueprint 01).
- No competitive / SNS framing.

Screens:

1. onboarding/welcome
   - Hoya idle pose + a 2-3 word English greeting placeholder.
   - One large CTA: "Start" (goes to language-pick).
   - One tiny tertiary link: "Sign in" (existing users), corner placement.

2. onboarding/language-pick
   - Two large tappable cards: "I'm Korean and want to learn" (P4 nudge),
     "I love K-culture" (P5 nudge). Both lead to the same content but
     write a routing-weight flag.
   - No "skip" — but a "Not sure" small option lands on a 50/50 default.

3. onboarding/first-quest-preview
   - 30-second taste of Episode 1·A1 (1 round of Match Sound).
   - Hoya speaks placeholder "Tap the letter you hear".
   - On completion: "[[ Keep going ]]" CTA → onboarding/account-create
     (optional) → journey/home. "[[ Maybe later ]]" → journey/home as guest.

For each screen output a single Markdown file in this exact path:
- design/wireframes/onboarding/welcome.md
- design/wireframes/onboarding/language-pick.md
- design/wireframes/onboarding/first-quest-preview.md
```

## 작업 흐름 (10분)
1. 프롬프트 실행 → 3 ASCII 박스 확인.
2. 각 화면이 7-섹션 다 채웠는지 빠르게 스캔. 누락 섹션 있으면 한 줄 보강 요청.
3. **welcome** 에 "Sign in" 링크가 너무 크면 → "make it tertiary, corner placement, not a card" 한 줄 수정.
4. **language-pick** 의 두 카드 카피가 너무 길면 → "≤ 5 words each, kid-readable".
5. **first-quest-preview** 의 다음 경로 그래프 검토 — 계정 없이도 journey/home 으로 갈 수 있는지 확인.

## 결과 저장 (3분)
1. 3 파일을 `design/wireframes/onboarding/` 아래 저장.
2. `design/prompts.md` 오늘자 엔트리 추가.
3. 커밋: `design(wireframe): add onboarding flow (welcome / language-pick / first-quest-preview)`.

## Code 다음 단계 안내
- 시안화는 Week 5 (mid-fi screens). 지금 단계에서는 코드 영향 없음.
- F-001 의 §5 UI sketch 가 참조하는 두 wireframe(`stage1/match-sound.md`, `stage1/match-sound-results.md`)은 Tue/Wed 가 채운다.

## 막힐 때 대응
- 호야 placeholder 가 모호 → `[Hoya idle 64dp box]` 처럼 박스 + 라벨로 표기.
- "Sign in" 위치가 자꾸 카드 가운데로 가 → "tertiary corner link, NOT primary card" 강하게 명시.
- 15 분 초과 → welcome 만 확정하고 다른 둘은 화요일에 합본.

## 검토 체크리스트
- [ ] welcome 에 signup-wall 없음 (Start = 즉시 첫 Quest 경로로)
- [ ] language-pick 가 "강요"가 아닌 "선택→가중치" 형태 (blueprint 01)
- [ ] first-quest-preview 의 "Maybe later" 경로가 끊기지 않음 (그래프 닫힘)
- [ ] 7-섹션 모두 채워짐
- [ ] success / empty / error 3 상태 검토 (특히 first-quest-preview 의 오디오 로드 실패 — F-001 §3.3 와 정합)

## 다음 시안 연결
- Tue 의 `journey/home` 진입 경로 중 하나는 `onboarding/first-quest-preview` exit.
- Wed 의 `quest/player` 가 first-quest-preview 의 단축 버전을 재사용 가능한지 표시.
- F-001 의 §5 UI sketch 링크는 Tue/Wed 결과를 참조.
