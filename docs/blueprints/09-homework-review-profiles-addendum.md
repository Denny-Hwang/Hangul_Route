---
title: 서비스 계획 부록 — Homework · Reviews · Multi-Profile
version: v1
status: reference
created: 2026-05-18
note: 02-core-feature-spec / 04-main-content-outline 의 확장 부록. 구현 명세는 docs/specs/F-HW-001, F-RVW-001, F-PROF-001, F-PAR-001, F-TCH-001 을 따른다.
---

# 서비스 계획 부록 — Homework · Reviews · Multi-Profile

> **이 부록의 위치**
> - 02-core-feature-spec v1 의 6대 기능 (Journey · Library · Classroom · Companion · Goal Ceremony · 진단) 위에
> - 04-main-content-outline v1 의 격자(Stage × Theme) · Episode · Quest 위에
> 다음 세 축을 더한다:
>
> 1. **Homework** — Chapter / Session 단위 숙제 페이지 + 부모·교사 배정·확인
> 2. **Reviews** — Daily / Feedback / Stage Review 의 "작은 성취 누적" 패턴
> 3. **Multi-Profile** — 한 기기에 여러 학생·교사 프로필, 프로필별 통계

각 축은 별도 F-XXX 스펙으로 떨어지고, 본 부록은 *왜·어떻게 합쳐지는가* 만 정리한다.

---

## 0. 설계 텐션

| 텐션 | 잘못된 해법 | 우리 해법 |
|---|---|---|
| "복습은 필요하지만 시험처럼 느끼면 안 됨" | 점수 기반 quiz, 진도율 % 노출 | **누적 시각화** — 모은 자모/단어 개수, 호야와 함께한 시간, 별 컬렉션 |
| "숙제를 강제하면 자율성을 해치지만, 부모·교사가 개입할 여지는 필요" | 미완 시 빨간 경고, 캐릭터 슬퍼함 | **초대장 톤** ("호야가 같이 풀어줄게!") + 부모·교사 측에서만 미완 표기 |
| "한 기기에 형제·자매·반 친구가 함께" | 단일 계정 강제 → 진도 섞임 | **프로필 = 학습의 단위**. 호야의 모습·진도·컬렉션이 프로필 단위로 분리 |
| "부모/교사가 진도를 보면서 아이를 압박하지 않게" | 실시간 정답률 노출 | **요약·서사 중심 대시보드** — 점수가 아니라 "이번 주 새로 배운 자모 5개" 식 |

> 핵심 원칙: **"점수가 아니라 컬렉션이다"** — 모든 측정 결과는 *모은 것*으로 환산해서 보여준다.

---

## 1. Homework 페이지 (Chapter / Session 단위)

### 1.1 정의

- **Chapter Homework**: 한 Chapter (= 격자의 한 행, 한 Stage 묶음. 보통 4~5 Episode) 끝에 권장되는 묶음 복습.
- **Session Homework**: 한 Session (= 한 번에 앉아서 끝낸 1~3 Quest) 직후에 제안되는 짧은 미션.
- **Assigned Homework**: 부모·교사가 명시적으로 배정한 항목. 위 두 종류 위에 덧씌워진다.

> Session 의 정의는 04-main-content-outline §3.3 의 Quest 단위(3~4분) 와 다르다. 여기서 *Session* = "한 번 앱을 켰을 때의 학습 구간" (= 1~3 Quest 묶음). 부모·교사 관점의 "오늘 분량" 단위.

### 1.2 어린이 측 UX

```
[Home 화면]
 ┌─────────────────────────────────────┐
 │  🐯 호야가 기다리고 있어요!         │
 │  Today's mission (3 things)         │
 │   ① Replay yesterday's ㄱ ㄴ        │
 │   ② New Quest: 2.B1 시장의 음식    │
 │   ③ Daily test (1 min)              │
 │                                     │
 │  [Start]                            │
 └─────────────────────────────────────┘
```

- **Mission 카드 3개 고정**. 더 많이 노출하지 않는다 (어린이 인지 부담).
- 카드 순서: ① 어제·그제 학습의 가벼운 복습 → ② 오늘의 새 Quest → ③ Daily test.
- 완료한 카드는 즉시 ✨ 보상 애니메이션 + 컬렉션 카운트 증가.
- 미완료 카드 위에는 ❌ / "X 미완료" 같은 부정 표기 절대 금지. *기다리는 호야* 일러스트만.

### 1.3 부모·교사 측 UX

```
[Caregiver Dashboard — Homework 탭]
 ┌─────────────────────────────────────┐
 │  민호 (Stage 1, Chapter 2)          │
 │                                     │
 │  ▶ Assign new mission               │
 │    □ Replay Episode 1.A1 (5 min)   │
 │    □ Daily test on ㄱ ㄴ ㄷ         │
 │    □ Watch story: "한글의 비밀"     │
 │    [Send to 민호]                   │
 │                                     │
 │  Recent (this week)                 │
 │   2026-05-15  ✓ Done in 6 min       │
 │   2026-05-16  ✓ Done in 4 min       │
 │   2026-05-17  · Skipped (no nudge)  │
 │   2026-05-18  · Waiting             │
 └─────────────────────────────────────┘
```

- 배정 가능한 항목은 격자 위의 Episode / Daily test / Story Time / Library Theme Pack 중 **이미 학습자가 접근 가능한 범위**로 제한 (Stage gating 존중).
- 미완료 항목은 **회색**, *빨간색·경고 아이콘 금지*. 다섯 칸 카드를 천천히 채우는 시각 메타포.
- 푸시 알림 톤: "민호가 오늘은 호야를 못 만났어요" 같이 *상태 보고*, *압박 금지*.

### 1.4 Journey / Library 와의 관계

| 상황 | 처리 |
|---|---|
| 배정된 숙제가 Journey 의 미완료 Quest | Quest 완료로 자동 반영. 별도 보상 중복 없음. |
| 배정된 숙제가 Library 의 복습용 Quest | Companion XP·컬렉션 카운트만 증가. Journey 는 영향 없음. |
| 학습자가 숙제 외 Quest 를 먼저 함 | 막지 않음. 숙제는 "추가" 이지 "관문" 이 아님. |
| 학습자가 배정된 숙제를 3일 이상 미완 | 부모·교사 대시보드에 "기다리는 중" 표시. 학습자 화면엔 표시 없음. |

### 1.5 데이터 모델 (요약)

```ts
// packages/content-schema/src/homework/
type HomeworkAssignment = {
  id: string;
  assignedBy: ProfileId;  // 부모 또는 교사 프로필
  assignedTo: ProfileId;  // 학습자 프로필
  targetType: 'quest' | 'episode' | 'daily-test' | 'story' | 'theme-pack';
  targetId: string;       // Quest / Episode / Test 의 ID
  createdAt: string;
  dueDate?: string;       // optional, no penalty if missed
  completedAt?: string;
  source: 'parent' | 'teacher' | 'system-suggested';
};
```

`system-suggested` 는 §1.2 ①·③ 의 자동 생성 미션. 부모·교사 배정과 같은 테이블에서 단지 source 만 다르다.

---

## 2. Review 시스템 — Daily / Feedback / Stage Review

### 2.1 세 종류의 비교

| 종류 | 길이 | 시점 | 출제 범위 | 보상 |
|---|---|---|---|---|
| **Daily Test** | 60~90 s | 매일 첫 진입 시 (선택) | 직전 3일 학습 요소 + 1주 전 스파스 1문항 | 별 1~3개, 자모 컬렉션 카운트 |
| **Feedback Review** | 30~45 s | Quest 직후 (Step 5 Celebrate 와 함께) | 방금 끝낸 Quest 의 핵심 1~2 요소 | 호야 반응 + Quest 점수에 흡수 |
| **Stage Review** | 5~7 min | Stage 의 모든 Episode 완료 직후 | 전 Stage 의 anchor skill | 🎓 Stage Certificate + Heritage 컬렉션 풀스택 보너스 |

### 2.2 핵심 철학 — "점수가 아니라 컬렉션"

모든 review 의 결과는 다음으로만 환산한다:

| 측정 결과 | 표시 방식 |
|---|---|
| 정답률 100% | "오늘 ⭐⭐⭐, 모은 자모 +3" |
| 정답률 60% | "오늘 ⭐⭐, 모은 자모 +2 — ㅂ 이 또 보고 싶대요!" |
| 정답률 30% | "오늘 ⭐, 호야랑 한 번 더 만나러 갈까?" |
| 정답률 0% | "오늘 ⭐, 별을 하나 모았어! ㄱ 부터 다시 같이 가자." |

- **0점도 별 1개**. 시도 자체에 별이 지급된다 — 자존감 보호.
- 정답률 % 숫자는 *부모·교사 대시보드* 에만 노출 (그리고 거기서도 "이번 주 새로 인식한 자모 5개" 같은 누적 서사 우선).
- *연속 정답* / *콤보* 표현은 사용하지 않는다 — 끊김에서 오는 좌절을 피하기 위해.

### 2.3 Daily Test 의 출제 알고리즘

Spaced Repetition 의 단순화 버전 (어린이용):

```
[1] Pool A: 어제 학습한 요소  → 50% 확률로 1~2 문항
[2] Pool B: 그제·3일 전 학습  → 30% 확률로 1 문항
[3] Pool C: 직전 daily test 에서 오답난 요소 → 무조건 1 문항
[4] Pool D: 1주 전 learned (장기 강화) → 10% 확률로 1 문항

총 3~5 문항, 60~90 초 분량.
```

- Pool C 가 자동 spaced retry 의 핵심. 한 번 틀린 요소는 다음날 무조건 다시 나오고, 다시 맞히면 Pool A→B 로 자연 이동.
- 같은 문항이 *연속 두 daily test* 에 나오는 일은 없다 (지루함 방지).

### 2.4 Feedback Review 는 Quest 의 Step 4 와 무엇이 다른가

| | Quest Step 4 (Check) | Feedback Review |
|---|---|---|
| 시점 | Quest 중간 | Quest 종료 직후, Celebrate 와 묶임 |
| 분위기 | "오늘 배운 것 확인해 볼까?" | "방금 호야랑 뭐 했더라?" — 회상 |
| 형식 | 2 문항 quiz | 1 문항 + 호야 회고 ("오늘 ㄱ 을 N 번 봤어!") |
| 보상 | Quest 점수 | 별도 보상 없음 — Quest 점수에 흡수 |

Feedback Review 의 진짜 가치는 *측정* 이 아니라 *기억 강화* + *서사 마감*.

### 2.5 Stage Review = 졸업식 축소판

- Stage 의 모든 Episode 완료 시 자동 시작 (skip 가능).
- 5~7 분, 4~6 문항. 각 문항은 그 Stage 의 5 Theme 에서 1씩 추출 (격자 균형).
- 완료 시 **Stage Certificate** + 그 Stage 에서 모은 Heritage 카드 **전체 컬렉션 뷰** (회고).
- Stage Review 의 점수는 학습자에게 *전혀 노출되지 않는다* — 부모·교사 리포트에만 "Stage 1 Anchor Skill 인식률 92%" 같은 형태로.

### 2.6 데이터 모델 (요약)

```ts
type ReviewAttempt = {
  id: string;
  profileId: ProfileId;
  kind: 'daily' | 'feedback' | 'stage';
  scope: { stageId?: string; chapterId?: string; questId?: string };
  items: ReviewItem[];          // 출제된 문항 + 정답 여부
  startedAt: string;
  completedAt?: string;
  starsAwarded: 1 | 2 | 3;      // 시도만 해도 최소 1
};

type ReviewItem = {
  prompt: string;               // 자모 / 단어 / 짧은 문장
  promptKind: 'jamo' | 'word' | 'sentence';
  correct: boolean;
  attempts: number;             // 한 문항 내 재시도
  themeId?: string;             // Pillar A~E
};
```

---

## 3. Multi-Profile — 한 기기, 여러 학습자

### 3.1 왜 필수인가

- 한 가정에서 자녀 2~3명이 한 태블릿 공유 → 진도 섞임 = 좌절.
- 한글학교 교사가 본인 기기로 시연 + 학생 기기로 학습 → 같은 기기에서 *역할 전환* 필요.
- 형제간 컬렉션·캐릭터 성장은 *경쟁* 이 아니라 *각자의 여정* 으로 분리되어야 함.

### 3.2 Profile 의 종류

| Role | 권한 | UI |
|---|---|---|
| `learner` | 본인 진도·숙제·컬렉션만 조회 | 호야 캐릭터 홈, 격자 지도 |
| `parent` | 1~N learner 의 모든 데이터 조회 + 숙제 배정 + 메시지 | Caregiver Dashboard |
| `teacher` | Classroom 단위로 N learner. 학습자별 진도 + 일괄 숙제 | Classroom (02-core-feature-spec §6) |
| `co-parent` | parent 와 동등 권한, 다른 사람 | Caregiver Dashboard (공유) |

> **Phase 1 (MVP)**: `learner` × N + `parent` × 1 만 지원. `teacher` / `co-parent` 는 Phase 2.

### 3.3 Profile 전환 흐름

```
[앱 첫 진입]
   ↓
[Profile Picker]  ← 모든 프로필 아바타 그리드
   ↓ 선택
[(parent 만) PIN 4 자리]  ← 어린이 프로필 보호용
   ↓
[해당 프로필 홈]
```

- learner 프로필 전환에는 PIN 없음 — 6세 아이가 직접 자기 프로필 탭 가능.
- parent 프로필 전환에만 PIN 4 자리. PIN 분실 시 이메일 복구 (Cloud Sync 활성화 시).
- 프로필 아바타 = 호야의 자라고 있는 모습 + 이름 첫 글자. 형제끼리 시각적으로 구분되어야 함.

### 3.4 데이터 격리 규칙

| | learner 본인 화면 | parent 대시보드 | teacher 대시보드 |
|---|---|---|---|
| 본인 진도 | ✓ | ✓ (자녀만) | ✓ (담당 반만) |
| 다른 learner 진도 | ✗ (절대) | ✓ (자녀만) | ✓ (담당 반만) |
| 정답률 % | ✗ | ✓ | ✓ |
| 누적 컬렉션 | ✓ (본인) | ✓ (자녀) | ✓ (반) |
| 부모 메시지 (N5) | ✓ 수신 | ✓ 발신 | ✗ |

§ "절대" — 어린이 화면에는 다른 형제의 별·진도가 *어떤 식으로도* 비교 노출되지 않는다 (경쟁 회피).

### 3.5 프로필별 통계 — 어떤 것을 보여주나

**Learner 본인 (호야 홈 화면)**

```
┌─────────────────────────────────────┐
│  민호의 컬렉션                       │
│                                     │
│  📜 모은 자모        14 / 24        │
│  🎴 Heritage 카드     3 / 25        │
│  ⭐ 모은 별         142             │
│  🔥 호야와 함께한 날  12 일         │
│                                     │
│  [지도 보기]                        │
└─────────────────────────────────────┘
```

진도 % 없음. *모은 것* 만.

**Parent / Teacher 대시보드**

```
┌─────────────────────────────────────┐
│  민호 — Stage 1                     │
│                                     │
│  This week                          │
│   · New jamo recognized: ㅁ ㅂ ㅅ   │
│   · Quests completed: 4             │
│   · Daily tests: 5 / 7              │
│   · Time on app: 38 min             │
│                                     │
│  Anchor skill (Stage 1)             │
│   Recognition accuracy: 78%         │
│   (last week: 71%)                  │
│                                     │
│  Suggestions                         │
│   · ㅂ needs one more session       │
│   · Try Episode 1.A3 — story        │
└─────────────────────────────────────┘
```

수치는 있되, *변화*·*제안* 중심. 절대 평가 아님.

### 3.6 디바이스·클라우드 분리

| 데이터 | Phase 1 (MVP) | Phase 2 |
|---|---|---|
| 프로필 메타 (이름, 아바타, role) | 로컬 (AsyncStorage 래퍼) | + Cloudflare D1 동기화 |
| 진도·컬렉션 | 로컬 | + D1 동기화 (Clerk 로그인) |
| 숙제 배정 | 로컬 (단일 기기) | D1 — 부모 기기에서 배정, 자녀 기기에서 수신 |
| Review 결과 | 로컬 | + D1 (분석용 익명 집계) |

> 03-engineering-blueprint-v2 §1.2 의 "$0 stack" 정합. MVP 는 로컬 only, Phase 2 부터 Clerk + D1.

---

## 4. 통합 — 어떻게 한 화면에서 만나는가

### 4.1 어린이 측 하루 (예시)

```
07:50  앱 켬 → Profile Picker → "민호" 탭
07:51  Home → Today's mission 3 카드
07:52  ① Daily test (60 초) — ⭐⭐ 획득, 자모 +2
07:53  ② Episode 1.A1 Quest 1 (4 분) — 새 자모 ㅂ 배움
07:57  Quest 종료 → Feedback Review (30 초) → ⭐ 추가
07:58  ③ 부모가 배정한 "Story Time: 한글의 비밀" — 시청
08:01  컬렉션 화면 자동 노출 → Heritage 카드 1 새로 모음
08:02  앱 종료. parent 대시보드에 "민호: 12분, 자모 +1, 카드 +1" 자동 갱신.
```

### 4.2 부모 측 하루 (예시)

```
21:30  부모 프로필 → PIN 입력
21:31  Dashboard → "민호 오늘의 요약"
21:32  내일 미션 제안 검토 → "Replay ㅂ 한 번 더" 만 추가 배정
21:33  부모 메시지 (N5): "민호 잘했어! 내일 ㅂ 하나 더 보자" 녹음
21:34  앱 종료. 다음 날 민호 첫 진입 시 메시지 재생.
```

### 4.3 교사 측 하루 (Phase 2)

```
09:00  Classroom Projection Mode 시작
09:05  반 전체 진도 보드 → 오늘의 Stage Review 대상 학생 5명 식별
09:30  수업 중 학생별 숙제 배정 (드래그)
15:00  학생들 귀가 후 자녀 기기에서 숙제 수신
```

---

## 5. MVP 스코프 추가

02-core-feature-spec §8.2 표 위에 한 행씩:

| # | 기능 | MVP 포함 범위 | MVP 제외 (Phase 2+) |
|---|---|---|---|
| ⑦ Homework | system-suggested 3 카드 (Today's mission) + Episode 단위 학습자 자동 매칭 | parent 의 명시 배정, teacher 의 일괄 배정, 푸시 알림 |
| ⑧ Reviews | Daily test (Stage 1 범위) + Feedback Review + Stage 1 Review | Stage 2+ Review, spaced repetition Pool D, 음성 응답 review |
| ⑨ Multi-Profile | learner × N + parent × 1, 로컬 only, PIN 보호 | teacher / co-parent, Cloud Sync, 가족 간 멀티 디바이스 |

→ Phase 1 후속 검증 지표:

| 지표 | 목표 |
|---|---|
| 1 기기당 평균 프로필 수 | 1.4+ (혼자 안 쓰는 사람이 의미 있게 있음) |
| Daily test 완료율 (열어본 사람 기준) | 70%+ |
| Stage 1 Review 완료자의 7 일 후 재방문 | 50%+ |
| Parent 대시보드 7 일 활성 | parent 가입자의 35%+ |

---

## 6. 다음 액션 (개발 큐 연결)

이 부록이 만드는 F-XXX 5개:

| ID | 제목 | 의존 | MVP 포함 |
|---|---|---|---|
| F-HW-001  | Homework page (chapter / session) | F-001, content-schema | ✓ (system-suggested only) |
| F-RVW-001 | Review tests (daily / feedback / stage) | F-001, F-002, F-HW-001 | ✓ (Stage 1 범위) |
| F-PROF-001 | Device-shared profiles | packages/hooks (AsyncStorage 래퍼) | ✓ |
| F-PAR-001 | Parent dashboard | F-PROF-001, F-HW-001, F-RVW-001 | △ (로컬 only) |
| F-TCH-001 | Teacher / Classroom management | F-PROF-001, F-HW-001 | ✗ (Phase 2) |

`docs/tasks/INBOX.md` 에 W4~W6 큐 추가는 본 부록과 함께 PR 으로 들어간다.

---

## 부록. 데이터 모델 통합 (02-core-feature-spec §부록 위에)

```
User (auth identity, Phase 2+)
 └── Device
      └── Profile (1~N, role: learner | parent | teacher | co-parent)
           ├── ProfileStats
           │    ├── jamo_collected, words_collected
           │    ├── heritage_cards_collected
           │    ├── stars_total, streak_days
           │    ├── anchor_skill_accuracy (per stage)
           │    └── time_on_app (per week)
           │
           ├── (learner only)
           │    ├── journey_progress
           │    ├── library_history
           │    ├── companion_state (호야 성장)
           │    ├── homework_inbox: HomeworkAssignment[]
           │    └── review_history: ReviewAttempt[]
           │
           └── (parent / teacher only)
                ├── linked_learners: ProfileId[]
                ├── homework_outbox: HomeworkAssignment[]
                ├── parent_messages: Message[]   (N5)
                └── pin_hash
```

---

*문서 버전 v1 — 2026.05.18*
