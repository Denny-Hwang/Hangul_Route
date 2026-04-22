---
name: wireframe-skill
description: 저충실도 와이어프레임 작업 시 참조. 시안 전 단계, 정보 구조와 플로우에 집중.
  design/wireframes/ 아래 신규 작업, 사용자 플로우 설계, 새 화면 구조 논의 시 트리거.
---

# Wireframe Skill

저충실도 (low-fidelity) 와이어프레임 단계. 색·폰트·일러스트·최종 카피를 빼고
**정보 구조 · 사용자 플로우 · 화면 전환 · 인터랙션 포인트** 에만 집중한다.
영어권 어린이 5-11세 기준. 시안 (frontend-design-skill) 전 필수 단계.

근거: `docs/blueprints/01-competitor-wireframe-analysis.md`.

---

## 1. Trigger

자동 트리거 조건:

- 경로: `design/wireframes/**` 신규 파일·수정
- 사용자 요청 키워드: "와이어프레임", "플로우 설계", "화면 구조", "사용자 동선"
- 새 F-XXX 사양에서 화면 추가가 명시될 때
- screens/ 에 새 화면을 만들려는데 wireframes/ 에 대응 파일이 없을 때

동반 Skills:
- 이후 단계 → `frontend-design-skill` (시안 작성)
- 이후 단계 → `design-handoff-skill` (코드 승격)

---

## 2. Precondition (작업 전 필수 확인)

- [ ] `docs/specs/F-XXX-*.md` 에 화면 목록·사용자 목표가 명시되어 있나
- [ ] `docs/blueprints/01-competitor-wireframe-analysis.md` 의 해당 화면 타입이 이미 분석되어 있나
- [ ] 대상 사용자가 P4 (heritage) / P5 (K-culture) / 학부모 / 교사 중 누구인지 명확한가
- [ ] 이미 `design/wireframes/` 에 유사 화면이 있다면 그 규약을 따르는가 (독자 패턴 신설 지양)

누락 시:

> "F-XXX 의 [화면이름] 와이어프레임을 시작하기 전에,
> 사용자 목표·주 대상자·유사 선행 화면 유무를 확인해 주세요."

---

## 3. Standard Procedure

### 3.1 산출물 구조 (한 화면 = 한 Markdown 파일)

`design/wireframes/<flow-name>/<screen-name>.md` 에 다음 섹션을 포함한다:

1. **User scenario (Given-When-Then)** — 누가, 어떤 상태에서, 무엇을 하려 왔나
2. **Screen goal** — 이 화면이 달성해야 할 한 가지 행동 (1-2 개 이하)
3. **Box diagram (ASCII)** — 레이아웃 블록만 (색·폰트 금지)
4. **Interaction points** — 탭·스와이프·드래그·음성 지점과 결과
5. **Navigation graph** — 진입 출처 / 이탈 대상 (화면 ID 로)
6. **Data needs** — 어떤 데이터를 어디서 가져오나 (API·로컬 상태)
7. **Open questions** — 아직 미확정 항목 (다음 회의·실험 필요)

### 3.2 작성 순서 (권장 흐름)

1. 사용자 시나리오를 한 문장 Given-When-Then 으로 고정 (Figma 대신 글로 시작)
2. 경쟁 제품 분석 (blueprint 01) 에서 가장 가까운 화면 타입 식별
3. Box diagram 을 ASCII 로 그린다 — 픽셀 수치 금지, 상대 위치만
4. 플로우 그래프를 그린다 — 진입 경로 최소 2가지, 이탈 경로 최소 2가지
5. 인터랙션 포인트마다 "무엇이 일어나는가" 1 문장
6. 이 화면에서 fetch 하는 데이터·저장하는 데이터를 표기
7. 모든 항목이 채워지면 파일명 동결, 다음 단계 (frontend-design-skill) 로

### 3.3 화면당 규칙 (5-11세 대상 반영)

- 한 화면당 **주 목표 1개** (보조 목표 1개 허용, 그 이상은 분할)
- 주 CTA 1개가 시각적으로 가장 커야 (ASCII 로는 `[[ LARGE CTA ]]` 표기)
- 부모·교사용 컨트롤은 항상 보조 위치 (아이 화면과 섞지 않음)
- "뒤로가기" 는 항상 동일 위치 (좌상단) — 일관성이 문해력 전 UX 의 핵심
- 로딩·빈 상태·오류 상태 각각의 와이어프레임 필수 (성공 상태만 그리면 반려)

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ Box diagram 은 ASCII / 단순 도형만 — 누구나 에디터에서 수정 가능
- ✅ 모든 버튼·링크에 **목적지** 표기 (화면 ID)
- ✅ 사용자 플로우 최소 3가지 상태 (success / empty / error) 모두 검토
- ✅ 아이·학부모·교사 중 대상자 명시
- ✅ "선택 → 추천" 원칙 — 시스템이 먼저 강요하지 않는다 (01 의 핵심 교훈)
- ✅ 단어 수는 최소. 이 단계에서는 카피 라이팅 X, 자리·길이 지시만

### ❌ 하지 말아야 하는 것

- ❌ 색상·폰트·일러스트·아이콘 결정 — 시안 단계로 미룬다
- ❌ 픽셀 단위 수치 (`width: 360px`) — 상대 배치로만
- ❌ 한 화면에 목표 3개 이상 — 분할
- ❌ 죄책감·위협 기반 패턴 ("Duo 가 슬퍼해") — blueprint 01 명시 anti-pattern
- ❌ SNS 스타일 공개 경쟁·리더보드 — 어린이 정신 건강 위험
- ❌ 최종 카피 확정 — 문자는 "placeholder" 또는 의미 단위 지시 ("짧은 격려 문구")

### ASCII 예시

```
✅ GOOD — Episode completion screen (wireframe)
┌──────────────────────────────┐
│ [← back]               [⚙]   │  ← nav, 상단 일관
│                              │
│     [CARD ILLUSTRATION]      │  ← heritage card 자리
│                              │
│   "Nice job!" (placeholder)  │  ← 카피는 미정, 길이만
│                              │
│   [[ COLLECT CARD ]]         │  ← 주 CTA (가장 큼)
│                              │
│   [ See all cards → gallery ]│  ← 보조 CTA → screen: library/gallery
└──────────────────────────────┘

States: success (above) / empty (no card yet) / error (asset load failed)
Enter from: quest-check success / onboarding-finish
Exit to:    library/gallery · journey/home
```

```
❌ BAD — 너무 상세해진 와이어프레임
┌──────────────────────────────┐
│ Color: #FFD93D               │  ← 색 결정 (시안 단계에서)
│ Font: Poppins 24px bold      │  ← 타이포 결정
│ Icon: star-filled.svg        │  ← 아이콘 자산 결정
│ Margin: 16px 24px            │  ← 픽셀 수치
│ "Congratulations! You just   │  ← 최종 카피
│  earned the 훈민정음 card!"   │
└──────────────────────────────┘
```

---

## 5. Output Validation

### 자동 검증

- 파일 경로: `design/wireframes/<flow>/<screen>.md` 컨벤션 준수
- Markdown 파싱 가능 (CI lint)
- 필수 섹션 7개 존재 (Scenario / Goal / Box / Interaction / Navigation / Data / Open questions)

### 수동 체크리스트

- [ ] 한 화면당 주 목표 1개로 수렴되는가
- [ ] 상태 3종 (success / empty / error) 모두 고려되었나
- [ ] 진입·이탈 화면 ID 가 실제 존재하거나 곧 만들 계획이 있나
- [ ] 대상자 (아이 / 학부모 / 교사) 가 명시되었나
- [ ] anti-pattern (죄책감·SNS 비교·3+ 목표) 에 해당하는 요소가 없나
- [ ] 다음 단계 (frontend-design-skill) 로 넘길 준비가 되었나

---

## 6. Failure Handling

### 6.1 사용자 목표가 명확하지 않을 때

1. 구현·시안으로 진행 금지
2. F-XXX 사양에 "사용자 목표" 섹션이 있는지 확인
3. 없으면 사용자에게 2-3 문장 질문 + 트레이드오프 제시
4. 답을 받기 전에는 draft 상태로 `design/wireframes/<flow>/<screen>.draft.md` 저장

### 6.2 선행 화면과 흐름이 맞지 않을 때

- navigation graph 상 진입 경로가 기존 화면 어디와도 연결되지 않으면
  → 해당 선행 화면의 출구 업데이트가 먼저. 별도 커밋·별도 와이어프레임.

### 6.3 경쟁 제품에 유사 사례가 없을 때

- blueprint 01 에 없는 신규 화면 타입은 **새로운 가설** 로 간주
- `Open questions` 섹션에 "베타에서 검증 필요" 명시
- 베타 전까지 F-XXX 를 `ready` 로 승격하지 않는다

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `frontend-design-skill` | 시안의 입력 — 와이어프레임 확정 후에만 시안 시작 | wireframe → frontend-design |
| `design-system-skill` | 시안 후 단계 — 토큰화 | wireframe → frontend-design → design-system |
| `component-skill` | 구현 전 디자인 시안이 필요하며, 그 시안은 와이어프레임이 필요 | wireframe → 시안 → component |
| `content-skill` | 화면이 담는 콘텐츠 타입 (Episode / Card 등) 을 정의 | 병행. 콘텐츠 스키마 없으면 데이터 섹션 작성 불가 |

---

## 8. Examples

### 8.1 좋은 예 — Journey 홈 화면 와이어프레임

```markdown
# Journey/Home — wireframe v1

## Scenario (Given-When-Then)
Given: P5 아이가 앱을 처음 연다 (온보딩 완료 상태)
When: 오늘 Episode 를 선택하려 한다
Then: 현재 Stage 의 다음 Quest 가 가장 눈에 띄게 제시되어야 한다

## Screen goal
"다음으로 해야 할 Quest 1개를 즉시 식별·시작할 수 있게 한다."

## Box diagram
┌──────────────────────────────┐
│ [hoya avatar]     [settings] │
│                              │
│  Stage 1: Hangul             │
│  ▓▓▓▓░░░░ 4/15               │  ← progress
│                              │
│  [[ Continue: Quest 1.A1.2 ]]│  ← 주 CTA
│                              │
│  [ Library → gallery ]       │
│  [ Classroom → class-home ]  │
└──────────────────────────────┘

## Interaction points
- Continue CTA → quest-player (:questId)
- Library → library/gallery
- Classroom → classroom/home (parent mode only)
- Hoya avatar tap → hoya-dialog (친구 대사 1개)

## Navigation graph
Enter from: onboarding/finish · splash · quest/celebrate
Exit to:    quest-player · library/gallery · classroom/home

## Data needs
- 현재 user 의 progress (D1, React Query)
- 다음 Quest ID 계산 (client logic, pure)
- hoya 의 mood (local state, 최근 성공률 기반)

## Open questions
- 복습 Quest 는 "Continue" 와 별도로 노출? (베타에서 확인)
- Classroom 진입은 아이 화면에 노출 vs 학부모 인증 후만?
```

### 8.2 나쁜 예 — 흔한 실수

```markdown
# Home — wireframe v1

## Scenario
홈을 연다.                     ← 너무 얕음, Given-When-Then 아님

## Box diagram
(Figma URL: https://...)        ← wireframe 파일에 Figma 링크로 도피

## Goal
- 진도 확인                     ← 목표 여러 개
- Quest 시작
- Card 수집 상황 확인
- 친구 초대                     ← 4개 목표 → 화면 분할 필요

## Color
brand.primary 사용              ← 색 결정은 시안 단계
```

### 8.3 플로우 그래프 예시

```
onboarding/welcome
   └─> onboarding/language-pick
         └─> onboarding/first-quest (value-first)
               └─> quest/celebrate
                     └─> onboarding/account-create (optional)
                           └─> journey/home
```

- "Value first, account later" 원칙 (blueprint 01) 반영
- 계정 생성은 옵셔널 위치

---

## 9. Quick Reference

산출물 경로:
```
design/wireframes/<flow>/<screen>.md    # 확정
design/wireframes/<flow>/<screen>.draft.md  # 미확정
```

파일 구조 템플릿은 `design/wireframes/_template.md` 참조 (없으면 본 Skill §3.1).

커밋 메시지:
```
design(wireframe): add <flow>/<screen> wireframe
```
