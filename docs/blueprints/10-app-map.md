---
version: v1
created: 2026-09-19
status: reference (living — 화면·기능이 추가되면 이 문서를 먼저 갱신한다)
---

# 10 — App Map: 기능 트리 · 화면 인벤토리 · 내비게이션 그래프

> 개발이 더 복잡해지기 전에 **앱 전체를 한 장에** 놓는 문서.
> 여기서 정한 **화면 ID** 가 `design/wireframes/<flow>/<screen>.md` 의 파일 경로이자
> 스펙·코드·와이어프레임이 서로를 가리키는 키다.
>
> 관련: `02-core-feature-spec.md` (기능 배경) · `09-homework-review-profiles-addendum.md` (프로필/숙제/리뷰)
> · `docs/roadmap/web-pwa-offline.md` (웹앱/오프라인) · `docs/roadmap/multi-persona-sync-platform.md` (동기화/교사/결제)

---

## 0. 한눈에 보기

```
                       ┌────────────────────────────┐
                       │      Hangul Route 제품      │
                       └─────────────┬──────────────┘
        ┌───────────────────┬────────┴─────────┬─────────────────────┐
        ▼                   ▼                  ▼                     ▼
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
 │ A. Learner   │   │ B. Caregiver │   │ C. Teacher / │    │ D. Platform  │
 │    App       │   │    Console   │   │    School    │    │    (API·SW)  │
 │ 아이 5–11 ·  │   │ 부모 (앱+웹) │   │    Console   │    │ 동기화·결제  │
 │ 성인 초보 P6 │   │              │   │ 교사·관리자  │    │ 복원·오프라인│
 │ PWA·iOS·And. │   │              │   │ (웹 전용)    │    │              │
 └──────────────┘   └──────────────┘   └──────────────┘    └──────────────┘
```

| Surface | 코드 위치 | 상태 |
|---|---|---|
| A. Learner App | `apps/mobile` (Expo). **웹 PWA 가 주 채널** — 같은 코드의 `build:web` (roadmap `web-pwa-offline.md`, 런치: `docs/launch/web-app-launch.md`) | Stage 1 shipped · PWA P0–P3 shipped 2026-09-20 |
| B. Caregiver Console | 모바일: `apps/mobile/src/screens/parent/*` · 웹: `apps/web/src/app/parent/*` | 모바일 MVP shipped(읽기 전용) · 웹은 mock 데이터 |
| C. Teacher / School Console | `apps/web/src/app/teach/*` (신규) | proposal (F-TCH-001 draft + roadmap S3–S7) |
| D. Platform | `apps/api` + `packages/backend` (Workers/D1) · service worker | 인메모리 스텁. D1 미바인딩 |

상태 범례 (이 문서 전체 공통): **S** shipped · **R** spec ready(미구현) · **D** spec draft · **P** proposal(roadmap 만) · **–** 없음

---

## 1. 기능 트리 (Feature Tree)

```
Hangul Route
│
├─ A. Learner App ──────────────────────────────────────────────── 아이
│   ├─ A0. Layout (모든 화면 공통): compact · regular · wide · short 클래스 · regular 는 가운데 읽기 칼럼 · wide 는 Journey/Library 두 pane · 폰 가로는 부드러운 세로 안내 ("Keep sideways") · 터치 64 하한 불변 [S] F-LAYOUT-001
│   ├─ A1. Onboarding                                   [S] F-PROF-001
│   │    ├─ Welcome (value-first, 계정 없음)
│   │    ├─ Create parent (PIN)  →  Create learner (name·age·avatar)
│   │    └─ First-quest preview (바로 첫 퀘스트로)
│   ├─ A2. Profiles (기기 1대, 학습자 N)                 [S] F-PROF-001
│   │    ├─ Picker · PIN entry · Switch button
│   │    └─ role: learner | parent  (+ teacher | admin 예약)   [P]
│   ├─ A3. Today (홈 = 3-card mission)                  [S] F-HW-001
│   │    ├─ Story time card (① continue · next · again → explore 순서, 하루 고정) [S] F-STORY-004 §3.7 (PR 4.4a)
│   │    ├─ ① Continue · ② New/Assigned · ③ Story/Review
│   │    └─ Homework list (배정 큐)                       [S]
│   ├─ A4. Journey (격자 7 Stage × 5 Theme)              [S] 02 §1
│   │    ├─ Stage 1 = 5 episodes / 11 quests (shipped)
│   │    ├─ Stage 2·4 taste (F-011, F-012)               [S]
│   │    ├─ Heritage stories on the grid (24편 · 15 셀: count mark · stories-only 셀 · Cell page · lesson page 의 stories row) [R] F-STORY-005
│   │    └─ Stage 3·5·6·7 preview cells                  [–] blueprint only
│   ├─ A5. Quest player (intro→present→practice→apply→reward) [S] content-skill
│   │    ├─ Story quest steps: story check (`story-check`) · word recap · Story Order v2 (`story-sequence`) → Results story extras [S/R] F-STORY-003
│   │    └─ Minigame shell + 13 kinds (9 구현: 8 active + voice-echo beta)  06
│   ├─ A6. Results & celebration (stars · card unlock)   [S] F-MOTION-003/004/005
│   │    └─ Card award model: episode · stage · welcome · set · story 카드, Results extra cards, Today 의 1회 catch-up 카드, Library earn hints, story 카드 뒷면 출처 [S 엔진 / R 화면] F-STORY-006
│   ├─ A7. Library (Heritage cards 42 = 30 Stage 1 + 12 taste · detail · share) [S] F-CARD-001/002/003
│   │    ├─ Sections: Cards · Story Time · Culture (`SectionTabs`, 이야기가 있을 때만) · Picked for you · 고정 순서 선반 [R] F-STORY-004 §3.3-3.4
│   │    └─ Culture notes (찾은 노트만, 테마별) · story episode page (Start · Keep reading · Read it again) [R] F-STORY-004 §3.5-3.6
│   ├─ A8. Reviews (Daily test · Feedback · Stage review · Certificate) [D] F-RVW-001
│   ├─ A9. Hoya companion (5 poses · bubble · lines)     [S] F-HOYA-001, F-002
│   ├─ A10. Settings / Profile page (plan status · mute · switch · grown-ups) [S]
│   ├─ A11. Save & Restore  (Rescue Code · sign-in · file) [S] F-SYNC-002 · F-RESTORE-001 (sign-in 경로는 [P] F-AUTH-002)
│   ├─ A12. Join a space (class / family code)          [S] F-SPACE-001 §3.5 (PIN 없음, §7 #21) · "I was already in this class" 재연결 요청 [S] F-TCH-001 §10.1
│   ├─ A13. Paywall / Upgrade (parent-gated)            [S] F-ENT-001 §3.5 (covered / premium / free 상태; 구매는 웹 콘솔로 — 스토어 IAP 는 F-IAP-002)
│   ├─ A14. PWA shell (offline-ready · update banners · offline chip · install guide) [S] roadmap P2 · F-PWA-001
│   ├─ A15. Lecture presenter (`/present`, 교사·어른이 TV·프로젝터로 하는 수업 · 로그인·프로필 없음 · 진도 기록 없음) [R] F-TCH-004
│   │    └─ Projection mode (자원봉사 학생이 학습자 화면을 그대로 띄우는 옵션 · 교사 역할 불필요) [D] 연기 F-TCH-001 §3.4
│   └─ A16. Story reader & Sources (퀘스트의 `story-read` 단계 · "Read it again" replay · 어른용 Sources · SVG 장면 그림) [S] F-STORY-002
│
├─ B. Caregiver Console ─────────────────────────────────────────── 부모
│   ├─ B1. Parent gate (PIN)                             [S] F-PROF-001
│   ├─ B2. Dashboard (per-learner weekly card · anti-shame) [S] F-PAR-001
│   ├─ B3. Learner detail (journey position · week dots · collection) [S-thin]
│   ├─ B4. Voice message (≤10 s)                         [R] F-PAR-001 N5
│   ├─ B5. Plan builder (family)  = "Send homework"      [S] F-PLAN-001 §3.5 (`/teach/space/:id/plan`, class 와 공용) (T-P2-01 흡수)
│   ├─ B6. Account (Clerk sign-in · email · consent · delete learner) [R/P] F-AUTH-001/002
│   ├─ B7. Billing (Family Plan $15.30/년, 매년 갱신)    [S] F-ENT-001 §3.6 (`/teach/billing`, Stripe 연간 구독; 결정 #30 → 2026-10-11 연 단위로 변경, AMENDMENTS-BILLING-FAMILY-YEARLY) + 프로모·레퍼럴 코드 입력 (F-ENT-002)
│   └─ B8. Backup (rescue code 보기 · 파일 내보내기)      [S] F-SYNC-002 · F-RESTORE-001
│
├─ C. Teacher / School Console (웹 전용) ────────────────────────── 교사·관리자
│   ├─ C1. Onboarding (역할 선택 → space 생성)            [S] F-CONSOLE-001 §3.3 (`/teach/start`)
│   ├─ C2. Class home / Roster (summary only)            [S-thin] F-CONSOLE-001 §3.5 (`/teach/space/:id` — 코드·롤업·학생 카드; 계획·재연결·설정은 S4–S5)
│   ├─ C3. Join code (발급·재발급·만료)                    [S] F-SPACE-001 §3.2 (서버; 콘솔 화면은 F-CONSOLE-001)
│   ├─ C4. Plan builder (class) + Pace helper             [S] F-PLAN-001 §3.5 (`/teach/space/:id/plan` — 카탈로그·순서·날짜·spread·대상·발행·readout)
│   ├─ C5. Learner card (parent B3 재사용, 읽기 전용)      [P]
│   ├─ C6. Re-link approval (기기 이전 승인)               [S] F-TCH-001 §10.1 (`/teach/space/:id/relink` — 승인·거절·10분 창·rescue 재발급)
│   ├─ C7. School admin (교사 초대 · 학급 트리 · seats)     [S] F-SCHOOL-001 (`/teach/space/:id` school 변형 — 초대 코드 · 라이선스/seats · 이번 주 집계 · 학급 표 · 교사 배정 · 새 학급)
│   ├─ C8. Billing (group_license $153/yr, Stripe)        [S] F-ENT-001 §3.6 (`/teach/billing`; 상한 초과 school_seat 은 Contact us)
│   ├─ C9. Worksheets PDF · Templates                     [–] F-TCH-002/003
│   └─ C10. Lecture setup (`/teach/space/lecture?id=` — 덱 구성 · 옵션 · 헬퍼 피커 · 발표 탭 열기; 이름은 postMessage, URL 에 없음) [R] F-TCH-004 §3.11
│
└─ D. Platform ──────────────────────────────────────────────────── 시스템
    ├─ D1. Content bundle (jamo · episodes · quests · cards, CONTENT_VERSION) [S]
    ├─ D2. Local store (AsyncStorage · IndexedDB on web)  [S]
    ├─ D3. Sync (snapshot PUT/GET · merge · summary · rescue code) [S] F-SYNC-001 · F-RESTORE-001 (inbox 의 plans/memberships 는 S3–S4)
    ├─ D4. Spaces & memberships [S] F-SPACE-001 (`can()` 포함) · plans [S] F-PLAN-001 (upsert·inbox·기기 파생·planProgress·빌더)
    ├─ D5. Entitlements (IAP · Stripe · manual)           [S] F-ENT-001 §3.1–3.4 (`entitlements` 1 테이블 · membership → tier · Stripe checkout/portal/webhook · 영수증 수렴 · 기기 tier 캐시 7일 유예); 화면은 PR 2–3
    ├─ D6. Telemetry (fire-and-forget, offline queue)     [S] F-PWA-001
    ├─ D7. Service worker (precache · update)             [S] roadmap P2
    └─ D8. Auth (Clerk — adults only)                     [R] F-AUTH-001
```

---

## 2. 페르소나 × Surface

| 페르소나 (roadmap §1) | A Learner | B Caregiver | C Teacher/School | 결제 |
|---|---|---|---|---|
| P-A 개인 학습 (어른 없음) | ✓ 전부 (Stage 1) + Rescue Code | – | – | Free |
| P-B 가정 | ✓ · Lecture presenter (A15, `/present`, 가족 TV, 프로필 없음) | ✓ 앱+웹 | C10 만 (가족 공간 `caregiver`; `plan.write` 와 같은 조건, F-TCH-004 §3.11) | Family Plan (`family_lifetime`, $15.30/년, 매년 갱신) |
| P-C 학급 학생 | ✓ + Join code | (부모가 있으면 ✓) | – | 교사가 지불 |
| P-C 교사 | Lecture presenter 만 (A15, `/present`, 프로필 없음) | – | ✓ C1–C6, C8, C10 | 학생 ≤ 20 무료 → group_license ($153/yr) |
| P-D 학교 관리자 | – | – | ✓ C7, C8 | group_license ($153/yr) / 상한 초과 seat 계약 |
| P-6 성인 초보 학습자 (외국인, 2026-09-20 추가) | ✓ 아이와 동일 화면 (Stage 1 은 성인에게도 유효) · Rescue Code | – | – | Free → family_lifetime 과 동일 플랜 (개인 결제) |

---

## 3. 화면 인벤토리 (Screen Inventory)

화면 ID = `design/wireframes/` 경로. **코드 라우트** 는 `apps/mobile/src/navigation/types.ts` 의 이름.
와이어프레임 열: ✓ 존재 · **NEW** 이번 패스에서 작성 · – 대상 아님.

### 3.1 A. Learner App (mobile / PWA)

| ID | 코드 라우트 | 목표 (한 줄) | 상태 | 스펙 | WF |
|---|---|---|---|---|---|
| `onboarding/welcome` | Onboarding/Welcome | 계정 없이 프로필 → 첫 퀘스트 (PIN 설정은 첫 grown-up zone 진입 시로 미룸, F-PROF-001 §10) | S | F-PROF-001 | NEW |
| `profiles/create-parent` | Onboarding/CreateProfile(firstRun) | 부모 PIN 1회 설정 (자녀 프로필은 폼 안에서 생성, 본인 프로필은 선택) | S | F-PROF-001 | ✓ |
| `profiles/create-learner` | Onboarding/CreateProfile | 누가 배우나·이름·레벨·아바타 (F-LEARN-001) | S | F-PROF-001 | ✓ |
| `onboarding/first-quest-preview` | Onboarding/FirstQuestPreview | Hoya 소개 + 첫 퀘스트 진입 | S | – | NEW |
| `profiles/picker` | (root, cold launch) | 학습자 선택 (PIN 없음) | S | F-PROF-001 | ✓ |
| `profiles/pin-entry` | (modal) | 부모 확인 | S | F-PROF-001 | ✓ |
| `profiles/switch-button` | (component) | 세션 중 전환 | S | F-PROF-001 | ✓ |
| `home/todays-mission` (alias `home/home`) | Main/Home | 오늘 할 3가지 | S | F-HW-001 | ✓ |
| `home/story-time-card` | Main/Home (mission card ①/③) | 읽던 이야기 이어 읽기 · 다음 이야기 · 다시 읽기 — 하루 고정, 이야기 없으면 explore 카드 | S | F-STORY-004 §3.7 | ✓ |
| `homework/list` | Homework | 배정된 숙제 큐 | S | F-HW-001 | NEW |
| `home/cards-catch-up` | Main/Home (인사말 아래 1회) | "Hoya found N cards you already earned!" — 세션당 1회, 타이머·남은 개수 없음 | R | F-STORY-006 §3.5 | ✓ |
| `journey/grid` | Main/Journey | 격자에서 에피소드 고르기 | S | 02 §1, 04 | NEW |
| `journey/grid-with-stories` | Main/Journey | 이야기가 있는 셀 표시 (count mark · stories-only 셀) — PIN 없음, 스테이지 pill 불변 | R | F-STORY-005 §3.6 | ✓ |
| `story/cell-stories` | CellStories | 한 셀의 이야기 선반 (그 셀의 lesson 이 먼저) — 남은 개수·순위·타이머 없음 | R | F-STORY-005 §3.6 | ✓ |
| `episode/detail-cell-stories-row` | (EpisodeDetail 의 한 줄) | lesson 페이지에 "Heritage stories for this cell" 행 (이야기 0 이면 숨김) | R | F-STORY-005 §3.6 | ✓ |
| `episode/detail` | EpisodeDetail | 퀘스트 목록 + 보상 카드 미리보기 | S | 05 | NEW |
| `episode/detail-story` | EpisodeDetail (`format: story`) | 이야기 1편 (또는 책 에피소드) — 큰 버튼 1개, 낱말, 문화 노트, 스포일러 없는 보상 카드, Sources | R | F-STORY-004 §3.6 | ✓ |
| `quest/player` | QuestPlayer | 5-step 진행 셸 | S | content-skill | NEW |
| `story/reader` | Minigame (`story-read` 단계) · StoryReader (replay) | 장면 하나씩: 그림 · 내레이션 · 한국어 + 로마자 + 뜻 — 점수·타이머·자동 넘김 없음, 읽던 장면 기억 | S | F-STORY-002 §3.3-3.7 | ✓ |
| `story/term-gloss` | (story/reader 안의 인라인 카드) | 낱말 칩 탭 → 듣기 + 한국어·로마자·뜻 카드 (팝오버 아님) | S | F-STORY-002 §3.5 | ✓ |
| `story/sources` | StorySources | 주장마다 출처 · 인용 · 링크 · 검증 · 정정 (링크 열기는 어른 게이트) | S | F-STORY-002 §3.8 | ✓ |
| `minigame/shell` | Minigame | 라운드 진행·피드백 공통 프레임 | S | 06, minigame-skill | NEW |
| `minigame/families` | (appendix) | 4 family 별 박스 다이어그램 | S | 06 | NEW |
| `story/check` | Minigame (`story-check`) | 이야기 뒤 쉬운 질문 3개+: 첫 탭만 채점, 오답은 amber "Try another", 정답 이유 항상 표시 | R | F-STORY-003 §3.4 | ✓ |
| `story/word-recap` | (story/check 의 마지막 패널) | 이야기의 새 낱말 다시 듣기 — 채점 없음, Done 으로 끝 | R | F-STORY-003 §3.6 | ✓ |
| `story/sequence` | Minigame (`story-sequence`) | 그림 카드를 순서대로 슬롯에 — 시작 순서는 절대 정답 아님, 다 채우면 다시 보기 | S | F-STORY-003 §3.5 | ✓ |
| `results/celebrate-story` | (Results 의 story 변형) | 이야기 제목 · 문화 노트 링크 · Next story / Read it again — 숫자·비율 없음 | R | F-STORY-003 §3.7 | ✓ |
| `results/celebrate` | Results | 별 + 카드 언락 + 다음 행동 1개 | S | F-MOTION-003 | NEW |
| `results/extra-cards` | (Results 의 배너) | 에피소드·스테이지·세트를 끝낸 그 런에서만 "N more cards joined your Library!" + 썸네일 | R | F-STORY-006 §3.3, §3.7 | ✓ |
| `library/earn-hints` | Main/Library (Cards) · CardDetail | 잠긴 카드마다 얻는 방법 1-2줄 · New pill · 정직한 explainer · N/M pill 없음 | R | F-STORY-006 §3.7 | ✓ |
| `library/card-back-citation` | CardDetail (뒷면) | 이야기 카드 뒷면: 검증된 사실 원문 + 출처 한 줄 (링크 없음) | R | F-STORY-006 §3.8 | ✓ |
| `library/gallery` | Main/Library | 모은 카드 보기 | S | F-CARD-001 | NEW |
| `library/card-detail` | CardDetail (modal) | 카드 앞/뒤 + 공유 | S | F-CARD-002/003 | NEW |
| `library/stories` | Main/Library `{ section: 'story-time' }` | Picked for you + 고정 순서 이야기 선반 (진도로 재정렬 안 함) | R | F-STORY-004 §3.3-3.4 | ✓ |
| `library/culture` | Main/Library `{ section: 'culture' }` | 찾은 문화 노트 카드 (개수만) + culture 이야기 타일 | R | F-STORY-004 §3.5 | ✓ |
| `story/culture-notes` | CultureNotes | 찾은 노트를 테마별로 — 용어 듣기 · 출처는 링크 없는 텍스트 · 잠긴 자리 없음 | R | F-STORY-004 §3.5 | ✓ |
| `profile/settings` | Profile | 플랜 상태 · 소리 · 전환 · Grown-ups | S | F-SUB-001 | NEW |
| `parent/gate` | ~~ParentGate~~ → PinEntry (modal) | **retired** — `profiles/pin-entry` 로 통합 (§7 결정) | S→PIN | F-PROF-001 §10 | ✓ (기록용) |
| `reviews/daily-test` | (신규) | 하루 1회 간격 반복 테스트 | D | F-RVW-001 §3.2 | NEW |
| `reviews/feedback-review` | (results/celebrate 의 2번째 패널) | 퀘스트 끝 새 요소 1문항 회상 (새 요소 ≥1 이면 항상) | D | F-RVW-001 §3.3 | NEW |
| `reviews/stage-review` | (신규) | Stage 앵커 점검 + 인증서 | D | F-RVW-001 §3.4 | NEW |
| `sync/save-progress` | SaveProgress (PIN 뒤) | Rescue Code 보여주기·복사·공유·재발급 | S | F-RESTORE-001 §3.3 | ✓ |
| `sync/restore` | Restore | 코드 / 로그인 (P, F-AUTH-002) / 파일로 복원 (학급 재연결은 `sync/join-space` 쪽) | S | F-RESTORE-001 §3.4 · F-SYNC-002 §3.3 | ✓ |
| `sync/join-space` | JoinSpace | 학급·가정 코드 입력 → 이름 확인 → 완료 (PIN 없음) | S | F-SPACE-001 §3.5 | ✓ |
| `sync/merge-notice` | (Restore 의 결과 카드) | "옛 카드를 찾았어요" 병합 안내 | S | F-SYNC-002 | ✓ |
| `paywall/upgrade` | Paywall (PIN 뒤) | Stage 2+ 잠금 해제 · "covered by <class>" 상태 · 웹 콘솔로 안내 (가격은 placeholder) | S | F-ENT-001 §3.5 | ✓ |
| `pwa/install-guide` | InstallGuide sheet (web only) | 홈 화면 추가 안내 (iOS/Android/PC), 3회째 열 때 · 5회 스누즈 | S | F-PWA-001 | ✓ |
| `pwa/system-banners` | (신규, web only) | 오프라인 준비됨 · 업데이트 · 오프라인 상태 | P | roadmap P2 | NEW |
| `layout/wide` | (모든 화면, `useLayoutClass`) | 넓은 창은 그림·두 화면 동시 보기에 쓰고 타깃은 작게 하지 않음: 클래스 4 · Home 2열 · Journey/Library 두 pane · 폰 가로 안내 · pane 상태 | S | F-LAYOUT-001 §3.1-3.8 | ✓ |
| `classroom/lecture-presenter` | PresenterApp (`/present`, 별도 root, 웹 전용) | 교사가 TV·프로젝터로 하는 슬라이드 수업 — 점수·순위 없음, 이름은 피커에만 (URL 에 없음), 학습자 진도 기록 없음 | R | F-TCH-004 | ✓ |
| `home/notes-card` | Main/Home (row 2a, F-ROUTE-001 §6.4) | 새 노트 1장 (보낸 사람 · 격려 문구) → Read — 미션 카드 뒤, 타이머·카운터 없음 | R | F-FEEDBACK-001 §6.5 | ✓ |
| `notes/list` | Notes | 내 노트: New · Earlier, 최신순 — 삭제 없음 | R | F-FEEDBACK-001 §6.5 | ✓ |
| `notes/detail` | NoteDetail | 노트 읽기 · 추천 퀘스트 Start (열리지 않는 퀘스트는 "Opens with the full route" 만, 결제 경로 없음) · 프리셋 반응 4개 (자유 입력 없음, 누가 보는지 한 줄) · Put this note away (게이트 없음, 이 기기만) · Tell a grown-up | R | F-FEEDBACK-001 §6.5-6.7 | ✓ |
| `classroom/projection-mode` | (연기, 자원봉사 학생용 — 교사 수업은 `classroom/lecture-presenter`) | 학습자 화면을 교실 TV 에 그대로 표시 | D | F-TCH-001 §3.4 | NEW |

※ `parent/gate` (수학 문제) 는 2026-09-19 에 PIN 으로 통합됨 (§7). 파일은 결정 기록용으로 남긴다.

### 3.2 B. Caregiver Console (mobile `parent/*` + web `/parent`)

> **F-APP-001 (2026-10-11, 결정 #33)**: 어른 페이지 전부가 **`app.hangulroute.com`** 으로 옮겨 간다 (학습자 Worker `hangul-route-app` 이 콘솔 정적 내보내기를 예약 경로 `/signin` · `/start` · `/teach` · `/parent` · `/account` 아래에 함께 서빙, F-APP-001 §3.1 B2). hangulroute.com 은 소개·가이드 전용 (F-SITE-002 S-10 부터 옛 어른 주소를 앱 호스트로 리다이렉트). 경로 표의 원본은 F-APP-001 §3.2 와 코드의 `APP_ROUTES` / `GROWN_UP_PREFIXES` (`packages/content-schema/src/schemas/app-shell.ts`). 아래 "web" 표기는 M3 이후 app 호스트를 뜻한다.

| ID | 위치 | 목표 | 상태 | 스펙 | WF |
|---|---|---|---|---|---|
| `shell/signin` | app `/signin` (`?persona=` · `?as=` · `?next=` · `?mode=create` · `?lang=`) | 어른 로그인 + 페르소나 홈으로 라우팅 · 계정 만들기는 어른 확인 단계 뒤 · 기기에 학습자 프로필이 있으면 OAuth 만으로는 열리지 않음 (재인증) | R | F-APP-001 §3.7 | ✓ |
| `shell/adult-frame` | app 의 모든 어른 페이지 | 페르소나 전환 (Family · Teacher) · 메뉴 · Back to learning · 사이트 링크 (푸터) | R | F-APP-001 §3.8 | ✓ |
| `shell/parent-home` | app `/parent` | 가족 홈: 학습자 카드 (고정 순서, 최근 7일 분) · 카드 액션 · 빈 상태 (이 기기에서 앱 열기 + join 코드) · 가족 없음 상태 · 교사로 교차 링크 | R | F-APP-001 §3.8 | ✓ |
| `shell/teacher-home` | app `/teach/home` (필터됨) | 교사 홈: 학급·학교만 · 학급 행 entries · 학급 없음 상태 · 가족으로 교차 링크 | R | F-APP-001 §3.8 | ✓ |
| `shell/grown-up-lock` | app 어른 페이지 위 (학습자 프로필이 있는 기기) | Grown-ups only: 기기 PIN (서명으로 확인된 epoch 일 때) 또는 다시 로그인 · Back to learning · 잠긴 동안 데이터·API 호출 없음 | R | F-APP-001 §3.9 | ✓ |
| `shell/offline` | 프리캐시 `/grown-ups-offline.html` | 오프라인에서 어른 경로로 갈 때: "You're offline" · Back to learning · Try again | R | F-APP-001 §3.12 | ✓ |

| ID | 위치 | 목표 | 상태 | 스펙 | WF |
|---|---|---|---|---|---|
| `parent/dashboard` | ParentDashboard · web `/parent` (F-APP-001 A-5b 부터 app `/parent` = `shell/parent-home`) | 학습자별 주간 카드 | S | F-PAR-001 | ✓ |
| `parent/grown-up-home-card` | Profile 어른 영역 첫 행 + ParentDashboard 상단 카드 (웹, `flags.grownUpHomeEnabled`) | "Grown-up home" → 신선한 PIN → app 어른 영역 (`openGrownUpArea`) · 오프라인이면 비활성 | R | F-APP-001 §3.6, §3.9 | ✓ |
| `parent/learner-detail` | web `/parent/[childId]` (데모; F-APP-001 A-5b 에서 제거, 옛 주소는 `/parent` 로) | 한 아이 깊이 보기 | S-thin | F-PAR-001 §5 | ✓ |
| `parent/voice-recorder` | (신규) | 10초 음성 메시지 | R | F-PAR-001 N5 | ✓ |
| `console/sign-in` | web `/teach` (+ mobile 나중, F-AUTH-004) · F-APP-001 부터 app `/signin` (`shell/signin`), `/teach` 는 라우터 | 어른 로그인 — **Clerk 위젯** (publishable key 가 빌드에 있을 때, hash routing) · dev 폼은 키 없는 빌드에서만 | S | F-CONSOLE-001 §3.2 · F-AUTH-001/002 | ✓ |
| `console/plan-builder` | web `/teach/space/:id/plan` (family·class 공용) | 계획 만들기·발행·readout | S | F-PLAN-001 §3.5 | ✓ |
| `console/account` | web + mobile | 이메일·동의·백업·학습자 삭제 | P | roadmap §5.3 | NEW |
| `console/billing` | web `/teach/billing` (mobile IAP 는 F-IAP-002) · F-APP-001 부터 app `/account/billing` (모든 어른, 내용은 F-BILL-002), `/teach/billing` 은 리다이렉트 페이지 | 현재 플랜 카드 · 역할별 플랜 행 (추천 1개) · Choose → Stripe Checkout · Manage → Portal · 미설정 시 조용한 안내 | S | F-ENT-001 §3.6 | ✓ |
| `parent/notes` | ParentDashboard 의 학습자별 행 → NotesGrownUp (PIN 뒤) | 학습자별 모든 노트 · 숨기기 · 신고 · 학급 노트 설정 (전체 / 격려만 / 끔) · 교사가 보는 것 안내 · 웹: Send a note → app 의 `/parent/notes` | R | F-FEEDBACK-001 §6.10 | ✓ |
| `parent/note-report` | sheet (PIN 뒤, `NoteReport`) | 노트 신고 (사유 4개, 자유 입력 없음) → 모든 기기에서 숨김 · Just hide it (신고 없이 숨김) | R | F-FEEDBACK-001 §6.10 | ✓ |
| `console/family-notes` | app `/parent/space/notes?id=` (Received · Sent 탭) | 학습자 한 명씩: 받은 모든 노트 (가정·학급, 되돌린 노트 포함, 가정 노트는 보낸 계정 표시) · 숨기기 · 신고 · 보낸 사람 막기 · 학급 노트 설정 · 가족 설정의 Can send notes | R | F-FEEDBACK-001 §6.13, §7.2, §8.2-8.5 | ✓ |
| `console/notes-hub` | app `/parent/notes`, `/teach/notes` (adult nav Notes) | 공간이 하나면 바로 그 노트 페이지로, 여러 개면 목록 | R | F-FEEDBACK-001 §6.13 | ✓ |

### 3.3 C. Teacher / School Console (web `/teach`)

> **F-APP-001 (2026-10-11)**: 모든 경로가 `app.hangulroute.com` 에서 서빙된다 (결정 #33). `/teach/start` → **`/start`** (role cards, `?persona=` 로 카드 미리 선택; app 호스트의 `/teach/start` 는 쿼리를 유지하는 리다이렉트 페이지). `/teach` 는 라우터, `/teach/home` 은 학급·학교만 보이는 교사 홈 (`shell/teacher-home`; 가족 그룹은 `/parent` 로). 모든 `/teach/space/**` 페이지에 `/parent/space/**` 쌍둥이가 생긴다 (`SPACE_PAGES`, A-5b).

| ID | 목표 | 상태 | 스펙 | WF |
|---|---|---|---|---|
| `console/onboarding-role` | web `/teach/start` (F-APP-001 부터 app `/start`) | 부모/교사/관리자 선택 → 첫 space 생성 → (교사) 코드 | S | F-CONSOLE-001 §3.3 | ✓ |
| `console/home` | web `/teach/home` | 내 space 들 (가정·학급·학교) 전환 허브 — 모든 행이 `/teach/space/:id` 로 (§7 #23) | S | F-CONSOLE-001 §3.4 | ✓ |
| `console/roster` | web `/teach/space/:id` | join code (복사·재발급) · 이번 주 롤업 · 학생 summary 카드 (계획·재연결·설정 버튼은 비활성) | S-thin | F-CONSOLE-001 §3.5 · F-TCH-001 §3.2 | ✓ |
| `console/space-settings` | web `/teach/space/:id/settings` | 코드 재발급 · 동의 모드 · 익명 roster · 멤버/학습자 제거 · 보관/해제 · 학습자 데이터 삭제 (이름 입력 확인) | S | F-TCH-001 §10.3 | ✓ |
| `console/relink-approval` | web `/teach/space/:id/relink` | 기기 이전 승인 10분 창 · 학습자 rescue code 재발급 | S | F-TCH-001 §10.1–10.2 | ✓ |
| `console/school-admin` | web `/teach/space/:id` (kind = school) | 학급 트리 · 교사 초대 · seat 사용량 · 교사 배정 (집계만, 학생 이름 없음) | S | F-SCHOOL-001 §3.3 | ✓ |
| `console/plan-builder` | (B 와 공용) | S | F-PLAN-001 §3.5 | ✓ |
| `console/billing` | (B 와 공용, group_license / school) | S | F-ENT-001 §3.6 | ✓ |
| `console/note-composer` | 노트 페이지 위의 sub-view (`&compose=1`; roster 카드 · parent home · 리포트 action slot 의 Send a note) | 받는 사람 · 격려 프리셋 (필수) · 짧은 글 120자 · 퀘스트 추천 (열리지 않는 퀘스트 표시) · 미리보기 → Send | R | F-FEEDBACK-001 §6.1-6.4, §6.13 | ✓ |
| `console/notes-sent` | app `/teach/space/notes?id=` (가정은 Sent 탭) | 보낸 노트 최신순 · 상태 Sent / Not shown / Taken back (교사에게 Opened 없음) · 반응 · 되돌리기 — 개봉률·순위 없음 | R | F-FEEDBACK-001 §7.2, §9 | ✓ |
| `console/lecture-setup` | web `/teach/space/lecture?id=` (C10) | 이번 주 계획 · 카탈로그 · 다시 보기로 덱 구성 · 옵션 · 헬퍼 피커 · [[ Open presenter ]] / [ Copy link ] | R | F-TCH-004 §3.11 | ✓ (`classroom/lecture-presenter.md` K) |

### 3.4 웹 마케팅 (`apps/web`) — 와이어프레임 대상 아님

`/` 랜딩 · `/about` · `/privacy` · `/terms` · `/design-preview/*` (F-PREV-001). 런치 카피는 `docs/launch/`.

---

## 4. 내비게이션 그래프

### 4.1 Learner App — 코드 기준 (현재 shipped)

```
cold launch
  ├─ (profiles == 0) ─▶ onboarding/welcome ─▶ profiles/create-parent ─▶ profiles/create-learner
  │                                                                          └─▶ onboarding/first-quest-preview ─▶ quest/player
  └─ (profiles ≥ 1) ─▶ profiles/picker ──(learner tap)──▶ Main tabs
                                    └────(parent tap)───▶ profiles/pin-entry ─▶ parent/dashboard

Main tabs ─┬─ home/todays-mission ─┬─▶ quest/player (card ①②)
           │                       ├─▶ episode/detail (card ③ story)
           │                       ├─▶ homework/list
           │                       └─▶ profile/settings (avatar corner)
           ├─ journey/grid ────────▶ episode/detail ─▶ quest/player
           └─ library/gallery ─────▶ library/card-detail (modal) ─▶ share sheet

quest/player ─▶ minigame/shell (×3 steps: present·practice·apply) ─▶ results/celebrate
results/celebrate ─┬─▶ episode/detail (next quest)
                   └─▶ Main tabs (reset)

profile/settings ─┬─▶ profiles/pin-entry (modal; 첫 진입 시 PIN 설정) ─▶ parent/dashboard
                  ├─▶ profiles/picker (switch)
                  └─▶ onboarding (add learner)
```

### 4.2 Learner App — 추가 예정 (D·R·P 화면 포함)

```
quest/player ─▶ ... ─▶ results/celebrate ─(같은 route, 2번째 패널)─▶ reviews/feedback-review (새 요소 ≥1 이면) ─▶ Main tabs
quest/player (story-read 단계) · "Read it again" (replay) ─▶ story/reader ─┬─▶ story/term-gloss (같은 화면, 인라인 카드)
                                                                          └─▶ story/sources ─▶ profiles/pin-entry (Open link, 게이트가 필요할 때) ─▶ 기기 브라우저
home/todays-mission card ③ ─▶ reviews/daily-test ─▶ results/celebrate
story/reader ─▶ story/check ─▶ story/word-recap ─▶ story/sequence ─▶ results/celebrate-story ─┬─▶ quest/player (Next story) · story/reader (Read it again, replay)
                                                                                            └─▶ episode/detail-story · home/todays-mission
journey/grid (stage 완료 셀) ─▶ reviews/stage-review ─▶ certificate (results 변형) ─▶ library/gallery
library/stories · library/culture ─▶ episode/detail-story ─┬─▶ quest/player (Start · Keep reading = resume) · story/reader (Read it again)
                                                           └─▶ story/culture-notes · story/sources · library/card-detail
home/story-time-card ─▶ quest/player (continue = resume · next) | story/reader (again) | episode/detail (explore)

profile/settings ─┬─▶ sync/save-progress (Rescue Code)
                  ├─▶ sync/join-space
                  ├─▶ paywall/upgrade  (parent-gated: profiles/pin-entry 선행)
                  └─▶ console/account  (parent-gated)
onboarding/welcome ─▶ sync/restore ("I already have progress") ─┬─▶ profiles/picker
                                                                └─▶ sync/merge-notice (로컬 진도 있을 때)
(앱 업데이트 후 첫 세션, reconcile 이 카드를 더했을 때) home/todays-mission ─▶ home/cards-catch-up ─▶ library/earn-hints (New pill)
results/celebrate (에피소드·스테이지·세트 완료 런) ─▶ results/extra-cards ─▶ library/card-detail (뒷면: library/card-back-citation)
journey/grid (잠긴 Stage 셀) ─▶ paywall/upgrade (parent-gated)
journey/grid-with-stories ─┬─ (lesson 셀) ─▶ episode/detail ─▶ episode/detail-cell-stories-row ─▶ story/cell-stories
                           └─ (stories-only 셀) ─▶ story/cell-stories ─▶ episode/detail-story ─▶ quest/player

[web only] 첫 방문 ─▶ pwa/system-banners (offline-ready) ; 설치 안 됨 + 3회 방문 ─▶ pwa/install-guide
[모든 채널] 창 크기·회전 ─▶ layout/wide (클래스 재계산) ; wide: journey/grid · library/gallery 의 셀/카드 탭 ─▶ 오른쪽 pane (이동 없음) ; 폰 가로 ─▶ 세로 안내 ─▶ "Keep sideways" 또는 회전
[web, 로그인 없음] /present ─▶ classroom/lecture-presenter (A home: Recent · Quick lesson ─▶ B start ─▶ C stage) — 프로필·진도를 읽거나 쓰지 않음 (F-TCH-004 §3.9)
[연기] 자원봉사 학생 ─▶ classroom/projection-mode (F-TCH-001 §3.4)
```

### 4.3 Caregiver / Teacher Console (web)

F-APP-001 이후 (app.hangulroute.com, M3 부터 학습자 진입점 켜짐):

```
학습자 앱 Welcome (프로필 없음) ─ [Parent or caregiver | Teacher] ─▶ shell/signin (?persona=)
학습자 앱 Profile 어른 영역 · ParentDashboard 카드 · Plan 화면 Open billing ─▶ (신선한 PIN) ─▶ shell/signin 또는 /account/billing
hangulroute.com 의 Sign in 링크 ─▶ shell/signin (?persona=, ?lang=)

shell/signin ─┬─ (space 없음) ─▶ console/onboarding-role (/start) ─▶ space 생성 ─▶ 페르소나 홈
              └─ (space 있음) ─▶ 페르소나 홈 (homeFor: hint → last → 하나뿐인 페르소나 → Family)
shell/grown-up-lock ─ 학습자 프로필이 있는 기기에서 모든 어른 페이지 앞 (PIN 또는 다시 로그인)
shell/adult-frame ─┬─ [Family]  ─▶ shell/parent-home (/parent) ─▶ /parent/space/** (roster · plan · settings …)
                   ├─ [Teacher] ─▶ shell/teacher-home (/teach/home) ─▶ /teach/space/** (roster · plan · lecture …)
                   ├─▶ console/billing (/account/billing)
                   └─▶ Back to learning (/) — unlock 과 콘솔 세션을 지움
```

출시 전 (현재 hangulroute.com, F-SITE-002 S-10 전까지 그대로):

```
/ (landing) ─▶ console/sign-in ─▶ (space 없음) console/onboarding-role ─▶ space 생성 ─▶ console/home
                              └─▶ (space 있음) console/home
console/home ─┬─ [family] ─▶ parent/dashboard ─▶ parent/learner-detail ─▶ parent/voice-recorder
              │                              └─▶ console/plan-builder (family)
              ├─ [class]  ─▶ console/roster ─┬─▶ parent/learner-detail (읽기 전용, summary 만)
              │                              ├─▶ console/plan-builder (class) ─▶ console/lecture-setup ("Present this plan")
              │                              ├─▶ console/lecture-setup ("Lecture") ─▶ (새 탭) classroom/lecture-presenter
              │                              ├─▶ console/relink-approval
              │                              └─▶ console/space-settings (join code)
              ├─ [school] ─▶ console/school-admin ─▶ console/roster (학급별)
              ├─▶ console/account
              └─▶ console/billing
```

---

## 5. 데이터 흐름 (요약)

```
 콘텐츠 (번들, CONTENT_VERSION) ──────────────┐
                                             ▼
 [Learner App] ── ProgressSnapshot (로컬) ──▶ summarize() ──▶ PUT /sync/learners/:id ──▶ D1 snapshots
       ▲                                                                                    │ summary_json
       │  plans → HomeworkAssignment 파생 (F-HW-001)                                        ▼
       └──────────── GET /sync/learners/:id/inbox ◀──── plans · memberships · tier ◀── [Console] roster / plan-builder
```

- 아이 화면은 **절대** 서버를 기다리지 않는다 (오프라인 우선). 서버는 "복원"과 "어른이 보는 요약"에만 관여.
- 교사는 `summary_json` 만, 부모는 `payload_json` 까지. 라우트가 아니라 쿼리 컬럼에서 갈린다 (roadmap §3.1).

---

## 6. 개발 순서 제안 (이 맵 기준)

| 순서 | 묶음 | 화면 | 근거 |
|---|---|---|---|
| 1 | **와이어프레임 back-fill** | §3.1 의 shipped 화면 12개 | "와이어프레임 없는 시안 금지" 부채 청산. 이후 시안·시각 회귀(F-VR) 의 기준 |
| 2 | **PWA P0–P3** | pwa/* | 채널 전환 (roadmap web-pwa-offline) |
| 3 | **Sync S1–S2** | sync/save-progress · sync/restore · sync/merge-notice · console/sign-in | "앱 지워도 안전" |
| 4 | **Reviews** | reviews/* | Stage 1 학습 효과 (F-RVW-001 이 INBOX T-030–033 에 이미 큐잉) |
| 5 | **Spaces S3–S5** | sync/join-space · console/onboarding-role · home · roster · plan-builder · space-settings · relink | 교사 페르소나 |
| 6 | **Entitlement S6** | paywall/upgrade · console/billing | 매출 |
| 7 | **School S7** | console/school-admin | 학교 페르소나 |

---

## 7. 결정 기록 (2026-09-19 reconciliation) + 열린 결정

와이어프레임 패스에서 드러난 문서 간 불일치는 아래처럼 **스펙 우선** 원칙으로 정리했다 (스펙이 CLAUDE.md 나 코드 현실과 충돌할 때만 스펙을 고침). 각 스펙에 같은 문구가 반영되어 있다.

| # | 불일치 | 결정 | 반영 위치 |
|---|---|---|---|
| 1 | 부모 게이트 이중 (수학 `ParentGate` vs PIN) | **PIN 으로 통합.** 첫 진입 시 PIN 설정 (parent-first 온보딩 미출시 동안) | F-PROF-001 §10 · 코드 `PinEntryScreen` |
| 2 | Feedback Review 트리거 (새 요소 ≥1 vs 틀림 ≥1) | **스펙 (새 요소 ≥1).** 완벽한 퀘스트도 내일 Daily Test 풀에 씨를 뿌려야 함 | F-RVW-001 §3.3 · `reviews/feedback-review.md` |
| 3 | Feedback Review 위치 (inline vs 별도 화면) | **같은 route 의 2번째 패널** (내비게이션 항목 없음) | F-RVW-001 §3.3 · §4.2 그래프 |
| 4 | 계획 gating (즉시 실패 vs 조용히 건너뜀 vs 기기 파생) | **둘 다 유지, 범위 분리**: 단건 배정 = 즉시 실패 (F-HW-001), 학급 계획 = 기기 파생 + 건너뜀 + not-ready 보고 | F-HW-001 §3.4 · F-TCH-001 §3.3 · roadmap §9 |
| 5 | F-RVW-001 Hoya 대사 한국어 | 영어로 교체 (자모만 한국어) | F-RVW-001 §3.1, §3.3 |
| 6 | F-TCH-001 D1 테이블 5개 vs roadmap schema v2 | schema v2 로 통일, 초안 테이블 철회 | F-TCH-001 §3.6, §8 |
| 7 | 와이어프레임 경로 (`teacher/*`, `reviews/feedback-tail` 등) | 앱 맵 ID 로 스펙 갱신 | F-RVW-001 §5 · F-TCH-001 §5 |
| 8 | 투영 모드 +6 dB | 플랫폼 허용 범위 내 부스트 + iOS 는 힌트 | F-TCH-001 §3.4 |
| 9 | join code "6-digit" | "6-character base32" | F-TCH-001 §3.1 |
| 10 | 학급 코드 입력 진입점 3가지 | `profile/settings` (parent-gated) → `sync/join-space` | F-TCH-001 §3.1 |
| 11 | Rescue Code 재발급 권한 | 부모 PIN (클라) + 기기/계정 검증 (서버) | roadmap §5.1, §8 |
| 12 | 재연결 승인 API 부재 | `/spaces/:id/relink-requests` + approve/deny 추가 | roadmap §8 |
| 13 | 동의 기록 저장 위치 없음 | `accounts.consent_json` | roadmap §2 |
| 14 | 학급 학생 4번째 복원 경로 | `sync/restore` 는 3경로 유지, 재연결은 `sync/join-space` | roadmap §5 |
| 15 | 페이월 스펙 F-IAP-004 (없음) | F-SUB-002 (작성 예정) + 웹/교사는 F-ENT-001 | F-SUB-001 §4 |
| 16 | F-PAR-001 §3.5 "이 기기에서 만든 학습자만" | Phase 2 note: family space membership 기준 | F-PAR-001 §3.5 |
| 17 | 카드 수 30 vs 42 | 42 (30 Stage 1 + 8 Stage 2 taste + 4 Stage 4 taste) | 본 문서 A7 |
| 18 | 교사 Free 캡 20 vs 30 | **미룸** (placeholder) | — |
| 19 | 미니게임 enum 이름 ↔ 카탈로그 06 번호 이름 | 이름 대응표만 `minigame/families.md` 에 기록, 코드 변경 없음 | — |
| 20 | 홈 화면 Streak 노출 | **유지** — PH 런치 결정(#51). 학습자 프로필 통계 카드에서는 제거 (F-RVW-001 §4 anti-pattern 최소화) | 코드 `ProfileScreen` |
| 21 | 학급 코드 입력의 부모 PIN 게이트 (#10 의 parent-gated) | **게이트 없음** — 교실에서 교사가 도와 입력하며 교사는 부모 PIN 을 모른다. 진도는 이동·초기화되지 않으므로 위험이 낮음. F-TCH-001 §3.1 문구는 F-SPACE-001 §3.5 로 대체 (2026-09-21) | F-SPACE-001 §3.5 · 코드 `JoinSpaceScreen` |
| 22 | join 시 부모 이메일(동의) 수집 | **S3 에서는 수집 안 함** — `spaces.settings_json.consentMode` 만 저장. 수집 UI 는 F-SPACE-003 (F-AUTH-002 이후) | F-SPACE-001 §4 |
| 23 | 콘솔 홈의 family/school 행 목적지 (`parent/dashboard` 웹판 · `console/school-admin` 부재) | 셋 다 `/teach/space/:id` 로; **school 은 같은 경로에서 admin 뷰를 렌더** (F-SCHOOL-001, 2026-09-21). 웹 부모 대시보드는 F-PAR-001 웹판 | F-CONSOLE-001 §3.4 · F-SCHOOL-001 §3.3 |
| 24 | roster 의 "Show rescue code" (roadmap §5.1) vs 해시만 저장 | 평문을 서버가 모르므로 **"Issue a new code" (재발급)** 로 대체 — caregiver/teacher 경로의 `/recovery/issue` (구현됨 2026-09-21) | F-CONSOLE-001 §4 · F-TCH-001 §10.2 |
| 26 | `onboarding/welcome` 의 "Made for kids 5–11" 한 줄 | **"Start Korean from zero."** 로 교체 (오너 결정 2026-10-06). 랜딩 OG/Twitter description 도 동일 | 코드 `WelcomeScreen` · `apps/web layout.tsx` |
| 27 | 학교 동의 모드 (c) 의 활성 시점 | **법률 검토 전까지 선택 불가** — Worker `SCHOOL_CONSENT_MODE=enabled` + 콘솔 `NEXT_PUBLIC_SCHOOL_CONSENT_MODE=enabled` 가 모두 설정될 때만 school 모드 저장 가능. 그 전에는 API 422 `consent_mode_locked`, 콘솔 라디오 비활성 (오너 결정 2026-10-06) | F-TCH-001 §10.3 · `apps/api/wrangler.toml` |
| 28 | App Store 트랙 (T-040–T-044) 시점 | **웹앱 안정화 이후** (오너 결정 2026-10-06). 런치 채널은 웹앱 단일 | `docs/tasks/INBOX.md` |
| 30 | 가격 모델 (3 플랜 × 월/연 placeholder) | **상품 2개 (오너 결정 2026-10-06)**: `family_lifetime` = **Family Plan $15.30/년** (2026-10-11 오너 결정으로 일회 평생 → 1년 단위 자동 갱신·언제든 해지, AMENDMENTS-BILLING-FAMILY-YEARLY; 한 가족 space, 학습자 5명까지, 모든 Stage) · `group_license` **$153/년** (단독 학급 또는 학교; 학교는 교사 10 / 학생 300 상한) · 상한 초과는 `school_seat` **Contact us** (계약). Teacher Pro · 월 결제 폐지. 가족 space 학습자 cap 5 (`cap_family`) | F-ENT-001 §3.1–3.6 · `PLAN_PRICING` |
| 33 | 어른 페이지 (콘솔) 의 호스트 — hangulroute.com 유지 vs app.hangulroute.com | **app 호스트가 콘솔을 서빙 (B2)**: Next 콘솔을 "console" 역할로 빌드해 학습자 Worker `hangul-route-app` 의 `dist` 에 예약 경로 (`/signin` · `/start` · `/teach` · `/parent` · `/account`) 로 복사. Worker 코드·대시보드 라우트 없음, 같은 origin 이라 PIN 핸드오프 (`sessionStorage`) 와 발표자 핸드오프가 그대로 동작. 서비스 워커는 어른 경로를 프리캐시·폴백에서 제외하고 오프라인 페이지를 보여 준다. hangulroute.com 은 소개·가이드 전용 (F-SITE-002 S-10 이 옛 주소를 리다이렉트), 결제도 app 호스트 `/account/billing` 에서만 (오너 요청 2026-10-11) | F-APP-001 §3.1–3.4 · F-CONSOLE-001 §3.7 · `docs/launch/owner-runbook.md` §E |
| 32 | 인메모리 store → D1 전환 방식 | **`Db` 인터페이스 + 구현 2개** (`D1Db` / `MemoryDb`, 읽기는 복사본·쓰기는 `put`). 라우트 응답 불변. 테스트는 계약 스위트(두 백엔드) + 전체 스위트를 메모리·SQLite(`node:sqlite` 셔임 위에 실제 마이그레이션) 로 두 번 실행. v1 표는 메모리 유지 (클라이언트 미사용) | F-INFRA-003 |
| 31 | 프로모션·레퍼럴 코드의 저장 위치 (자체 테이블 + 관리 화면 vs Stripe) | **Stripe Promotion Code 가 유일한 원본** (오너 요청 2026-10-06: 코드·할인율을 나중에 직접 관리). 생성·수정·만료·사용 횟수 제한은 Stripe 대시보드, API 는 조회·적용·귀속만. 자동 리워드(추천인 보상) 는 첫 코드 운영 후 별도 스펙 | F-ENT-002 |
| 29 | 랜딩·콘솔 (`apps/web`) 호스팅 — Vercel vs Cloudflare(OpenNext) | **Cloudflare 통일, 단 어댑터 없이 Next `output: 'export'` 정적 내보내기 → assets-only Worker `hangul-route-web`** (학습자 앱과 같은 모양). 최신 OpenNext 어댑터는 Next ≥ 15.5 를 요구해 Next 14 콘솔과 맞지 않고, Vercel 무료 플랜은 상업 이용 불가. 결과로 space 주소가 `/teach/space/:id` → `/teach/space?id=` 로 바뀜 (오너 결정 2026-10-06) | F-CONSOLE-001 §3.7 · `apps/web/wrangler.toml` |
| 25 | 재연결 시 새 기기의 임시 프로필 | 새 기기에서 만든 임시 프로필은 **그대로 두고** 복원된 프로필을 활성으로 전환 (자동 삭제는 아동 데이터 손실 위험) | F-TCH-001 §10.1 · 코드 `JoinSpaceScreen` |

코드 ↔ 스펙 불일치 (shipped 화면) 는 같은 날 코드로 수정했다 — 각 와이어프레임의 Open questions 와 PR 본문 참조.

### 오너 결정 (2026-09-20)

| 항목 | 결정 | 반영 |
|---|---|---|
| 학교 동의 모드 | 둘 다 지원, space 설정에서 선택 — **school 모드는 법률 검토 전까지 잠금** (결정 #27, 2026-10-06) | roadmap §11, `console/space-settings` 토글 |
| Rescue Code | 모든 학습자에게 자동 생성, 부모가 끌 수 있음 | roadmap §11, `sync/save-progress` |
| 교사 Free 캡 | 20명 (베타 후 재검토) | roadmap §7, §11, `console/roster` |
| Family 가격 | **Family Plan $15.30/년, 매년 갱신** (결정 #30, 2026-10-06 → 2026-10-11 연 단위로 변경) · 그룹 **$153/년** · 상한 초과 Contact us | F-ENT-001 · `console/billing` · `paywall/upgrade` |
| **스토어 카테고리** | **Education (Kids Category 아님)** — 성인 외국인 학습자도 대상이므로 Kids 전용 앱으로 제출하지 않는다. 부모 게이트·무광고·로컬 저장 등 아동 보호 설계는 그대로 유지 | `docs/launch/app-store-submission.md` §5 |

> **대상 사용자 확장 — 반영 완료 (2026-09-20)**: CLAUDE.md §1 이 **kids-first, never kids-only** 로 갱신됨 (P6 성인 초보 = 같은 화면·같은 콘텐츠, 별도 성인 모드 없음). README · `docs/launch/faq.md` · 스토어 카피 동기화. 앱 UI 문구 중 `onboarding/welcome` 의 "Made for kids 5–11" 한 줄은 **"Start Korean from zero."** 로 교체됨 (결정 #26, 2026-10-06). 베타에서 성인 5명 인터뷰로 Hoya 톤 수용도 확인 권장.

추가로 이 패스에서 드러난 것:
- `homework/list` 는 `home/todays-mission` 과 역할이 겹침 → 배정 큐가 3장을 넘을 때만 의미. 베타에서 진입률 측정.
