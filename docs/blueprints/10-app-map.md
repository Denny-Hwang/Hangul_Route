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
│   ├─ A1. Onboarding                                   [S] F-PROF-001
│   │    ├─ Welcome (value-first, 계정 없음)
│   │    ├─ Create parent (PIN)  →  Create learner (name·age·avatar)
│   │    └─ First-quest preview (바로 첫 퀘스트로)
│   ├─ A2. Profiles (기기 1대, 학습자 N)                 [S] F-PROF-001
│   │    ├─ Picker · PIN entry · Switch button
│   │    └─ role: learner | parent  (+ teacher | admin 예약)   [P]
│   ├─ A3. Today (홈 = 3-card mission)                  [S] F-HW-001
│   │    ├─ ① Continue · ② New/Assigned · ③ Story/Review
│   │    └─ Homework list (배정 큐)                       [S]
│   ├─ A4. Journey (격자 7 Stage × 5 Theme)              [S] 02 §1
│   │    ├─ Stage 1 = 5 episodes / 11 quests (shipped)
│   │    ├─ Stage 2·4 taste (F-011, F-012)               [S]
│   │    └─ Stage 3·5·6·7 preview cells                  [–] blueprint only
│   ├─ A5. Quest player (intro→present→practice→apply→reward) [S] content-skill
│   │    └─ Minigame shell + 13 kinds (9 구현: 8 active + voice-echo beta)  06
│   ├─ A6. Results & celebration (stars · card unlock)   [S] F-MOTION-003/004/005
│   ├─ A7. Library (Heritage cards 42 = 30 Stage 1 + 12 taste · detail · share) [S] F-CARD-001/002/003
│   ├─ A8. Reviews (Daily test · Feedback · Stage review · Certificate) [D] F-RVW-001
│   ├─ A9. Hoya companion (5 poses · bubble · lines)     [S] F-HOYA-001, F-002
│   ├─ A10. Settings / Profile page (plan status · mute · switch · grown-ups) [S]
│   ├─ A11. Save & Restore  (Rescue Code · sign-in · file) [S] F-SYNC-002 · F-RESTORE-001 (sign-in 경로는 [P] F-AUTH-002)
│   ├─ A12. Join a space (class / family code)          [S] F-SPACE-001 §3.5 (PIN 없음, §7 #21) · "I was already in this class" 재연결 요청 [S] F-TCH-001 §10.1
│   ├─ A13. Paywall / Upgrade (parent-gated)            [R] F-SUB-001, F-IAP-001
│   ├─ A14. PWA shell (offline-ready · update banners · offline chip · install guide) [S] roadmap P2 · F-PWA-001
│   └─ A15. Projection mode (교사용 교실 표시)            [D] F-TCH-001 §3.4
│
├─ B. Caregiver Console ─────────────────────────────────────────── 부모
│   ├─ B1. Parent gate (PIN)                             [S] F-PROF-001
│   ├─ B2. Dashboard (per-learner weekly card · anti-shame) [S] F-PAR-001
│   ├─ B3. Learner detail (journey position · week dots · collection) [S-thin]
│   ├─ B4. Voice message (≤10 s)                         [R] F-PAR-001 N5
│   ├─ B5. Plan builder (family)  = "Send homework"      [S] F-PLAN-001 §3.5 (`/teach/space/:id/plan`, class 와 공용) (T-P2-01 흡수)
│   ├─ B6. Account (Clerk sign-in · email · consent · delete learner) [R/P] F-AUTH-001/002
│   ├─ B7. Billing (family_premium)                      [P] roadmap S6
│   └─ B8. Backup (rescue code 보기 · 파일 내보내기)      [S] F-SYNC-002 · F-RESTORE-001
│
├─ C. Teacher / School Console (웹 전용) ────────────────────────── 교사·관리자
│   ├─ C1. Onboarding (역할 선택 → space 생성)            [S] F-CONSOLE-001 §3.3 (`/teach/start`)
│   ├─ C2. Class home / Roster (summary only)            [S-thin] F-CONSOLE-001 §3.5 (`/teach/space/:id` — 코드·롤업·학생 카드; 계획·재연결·설정은 S4–S5)
│   ├─ C3. Join code (발급·재발급·만료)                    [S] F-SPACE-001 §3.2 (서버; 콘솔 화면은 F-CONSOLE-001)
│   ├─ C4. Plan builder (class) + Pace helper             [S] F-PLAN-001 §3.5 (`/teach/space/:id/plan` — 카탈로그·순서·날짜·spread·대상·발행·readout)
│   ├─ C5. Learner card (parent B3 재사용, 읽기 전용)      [P]
│   ├─ C6. Re-link approval (기기 이전 승인)               [S] F-TCH-001 §10.1 (`/teach/space/:id/relink` — 승인·거절·10분 창·rescue 재발급)
│   ├─ C7. School admin (교사 초대 · 학급 트리 · seats)     [P] roadmap S7
│   ├─ C8. Billing (teacher_pro · school_license, Stripe)  [P] roadmap S6
│   └─ C9. Worksheets PDF · Templates                     [–] F-TCH-002/003
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
| P-B 가정 | ✓ | ✓ 앱+웹 | – | family_premium |
| P-C 학급 학생 | ✓ + Join code | (부모가 있으면 ✓) | – | 교사가 지불 |
| P-C 교사 | Projection mode 만 | – | ✓ C1–C6, C8 | teacher_pro |
| P-D 학교 관리자 | – | – | ✓ C7, C8 | school_license / seat |
| P-6 성인 초보 학습자 (외국인, 2026-09-20 추가) | ✓ 아이와 동일 화면 (Stage 1 은 성인에게도 유효) · Rescue Code | – | – | Free → family_premium 과 동일 플랜 (개인 결제) |

---

## 3. 화면 인벤토리 (Screen Inventory)

화면 ID = `design/wireframes/` 경로. **코드 라우트** 는 `apps/mobile/src/navigation/types.ts` 의 이름.
와이어프레임 열: ✓ 존재 · **NEW** 이번 패스에서 작성 · – 대상 아님.

### 3.1 A. Learner App (mobile / PWA)

| ID | 코드 라우트 | 목표 (한 줄) | 상태 | 스펙 | WF |
|---|---|---|---|---|---|
| `onboarding/welcome` | Onboarding/Welcome | 계정 없이 프로필 → 첫 퀘스트 (PIN 설정은 첫 grown-up zone 진입 시로 미룸, F-PROF-001 §10) | S | F-PROF-001 | NEW |
| `profiles/create-parent` | Onboarding/CreateProfile(firstRun) | 부모 PIN 1회 설정 | S | F-PROF-001 | ✓ |
| `profiles/create-learner` | Onboarding/CreateProfile | 이름·연령대·아바타 | S | F-PROF-001 | ✓ |
| `onboarding/first-quest-preview` | Onboarding/FirstQuestPreview | Hoya 소개 + 첫 퀘스트 진입 | S | – | NEW |
| `profiles/picker` | (root, cold launch) | 학습자 선택 (PIN 없음) | S | F-PROF-001 | ✓ |
| `profiles/pin-entry` | (modal) | 부모 확인 | S | F-PROF-001 | ✓ |
| `profiles/switch-button` | (component) | 세션 중 전환 | S | F-PROF-001 | ✓ |
| `home/todays-mission` (alias `home/home`) | Main/Home | 오늘 할 3가지 | S | F-HW-001 | ✓ |
| `homework/list` | Homework | 배정된 숙제 큐 | S | F-HW-001 | NEW |
| `journey/grid` | Main/Journey | 격자에서 에피소드 고르기 | S | 02 §1, 04 | NEW |
| `episode/detail` | EpisodeDetail | 퀘스트 목록 + 보상 카드 미리보기 | S | 05 | NEW |
| `quest/player` | QuestPlayer | 5-step 진행 셸 | S | content-skill | NEW |
| `minigame/shell` | Minigame | 라운드 진행·피드백 공통 프레임 | S | 06, minigame-skill | NEW |
| `minigame/families` | (appendix) | 4 family 별 박스 다이어그램 | S | 06 | NEW |
| `results/celebrate` | Results | 별 + 카드 언락 + 다음 행동 1개 | S | F-MOTION-003 | NEW |
| `library/gallery` | Main/Library | 모은 카드 보기 | S | F-CARD-001 | NEW |
| `library/card-detail` | CardDetail (modal) | 카드 앞/뒤 + 공유 | S | F-CARD-002/003 | NEW |
| `profile/settings` | Profile | 플랜 상태 · 소리 · 전환 · Grown-ups | S | F-SUB-001 | NEW |
| `parent/gate` | ~~ParentGate~~ → PinEntry (modal) | **retired** — `profiles/pin-entry` 로 통합 (§7 결정) | S→PIN | F-PROF-001 §10 | ✓ (기록용) |
| `reviews/daily-test` | (신규) | 하루 1회 간격 반복 테스트 | D | F-RVW-001 §3.2 | NEW |
| `reviews/feedback-review` | (results/celebrate 의 2번째 패널) | 퀘스트 끝 새 요소 1문항 회상 (새 요소 ≥1 이면 항상) | D | F-RVW-001 §3.3 | NEW |
| `reviews/stage-review` | (신규) | Stage 앵커 점검 + 인증서 | D | F-RVW-001 §3.4 | NEW |
| `sync/save-progress` | SaveProgress (PIN 뒤) | Rescue Code 보여주기·복사·공유·재발급 | S | F-RESTORE-001 §3.3 | ✓ |
| `sync/restore` | Restore | 코드 / 로그인 (P, F-AUTH-002) / 파일로 복원 (학급 재연결은 `sync/join-space` 쪽) | S | F-RESTORE-001 §3.4 · F-SYNC-002 §3.3 | ✓ |
| `sync/join-space` | JoinSpace | 학급·가정 코드 입력 → 이름 확인 → 완료 (PIN 없음) | S | F-SPACE-001 §3.5 | ✓ |
| `sync/merge-notice` | (Restore 의 결과 카드) | "옛 카드를 찾았어요" 병합 안내 | S | F-SYNC-002 | ✓ |
| `paywall/upgrade` | (신규, parent-gated) | Stage 2+ 잠금 해제 · "covered by <class>" 상태 | R (tier API S) | F-ENT-001 §3.5 · F-SUB-001 | ✓ |
| `pwa/install-guide` | InstallGuide sheet (web only) | 홈 화면 추가 안내 (iOS/Android/PC), 3회째 열 때 · 5회 스누즈 | S | F-PWA-001 | ✓ |
| `pwa/system-banners` | (신규, web only) | 오프라인 준비됨 · 업데이트 · 오프라인 상태 | P | roadmap P2 | NEW |
| `classroom/projection-mode` | (신규, teacher role) | 교실 TV 표시 토글 | D | F-TCH-001 §3.4 | NEW |

※ `parent/gate` (수학 문제) 는 2026-09-19 에 PIN 으로 통합됨 (§7). 파일은 결정 기록용으로 남긴다.

### 3.2 B. Caregiver Console (mobile `parent/*` + web `/parent`)

| ID | 위치 | 목표 | 상태 | 스펙 | WF |
|---|---|---|---|---|---|
| `parent/dashboard` | ParentDashboard · web `/parent` | 학습자별 주간 카드 | S | F-PAR-001 | ✓ |
| `parent/learner-detail` | web `/parent/[childId]` | 한 아이 깊이 보기 | S-thin | F-PAR-001 §5 | ✓ |
| `parent/voice-recorder` | (신규) | 10초 음성 메시지 | R | F-PAR-001 N5 | ✓ |
| `console/sign-in` | web `/teach` (+ mobile 나중) | 어른 로그인 — **dev 폼** (bearer = account id, 비프로덕션 또는 `NEXT_PUBLIC_CONSOLE_DEV_AUTH`) · Clerk 위젯은 F-AUTH-002 | S (dev) | F-CONSOLE-001 §3.2 · F-AUTH-001/002 | ✓ |
| `console/plan-builder` | web `/teach/space/:id/plan` (family·class 공용) | 계획 만들기·발행·readout | S | F-PLAN-001 §3.5 | ✓ |
| `console/account` | web + mobile | 이메일·동의·백업·학습자 삭제 | P | roadmap §5.3 | NEW |
| `console/billing` | web (Stripe) · mobile (IAP) | 플랜 보기·변경 | P (API S: list · checkout · portal · webhook) | F-ENT-001 §3.6 | ✓ |

### 3.3 C. Teacher / School Console (web `/teach`)

| ID | 목표 | 상태 | 스펙 | WF |
|---|---|---|---|---|
| `console/onboarding-role` | web `/teach/start` | 부모/교사/관리자 선택 → 첫 space 생성 → (교사) 코드 | S | F-CONSOLE-001 §3.3 | ✓ |
| `console/home` | web `/teach/home` | 내 space 들 (가정·학급·학교) 전환 허브 — 모든 행이 `/teach/space/:id` 로 (§7 #23) | S | F-CONSOLE-001 §3.4 | ✓ |
| `console/roster` | web `/teach/space/:id` | join code (복사·재발급) · 이번 주 롤업 · 학생 summary 카드 (계획·재연결·설정 버튼은 비활성) | S-thin | F-CONSOLE-001 §3.5 · F-TCH-001 §3.2 | ✓ |
| `console/space-settings` | web `/teach/space/:id/settings` | 코드 재발급 · 동의 모드 · 익명 roster · 멤버/학습자 제거 · 보관/해제 · 학습자 데이터 삭제 (이름 입력 확인) | S | F-TCH-001 §10.3 | ✓ |
| `console/relink-approval` | web `/teach/space/:id/relink` | 기기 이전 승인 10분 창 · 학습자 rescue code 재발급 | S | F-TCH-001 §10.1–10.2 | ✓ |
| `console/school-admin` | 학급 트리 · 교사 초대 · seat 사용량 | P | roadmap S7 | NEW |
| `console/plan-builder` | (B 와 공용) | S | F-PLAN-001 §3.5 | ✓ |
| `console/billing` | (B 와 공용, teacher_pro / school) | P (API S) | F-ENT-001 §3.6 | ✓ |

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
home/todays-mission card ③ ─▶ reviews/daily-test ─▶ results/celebrate
journey/grid (stage 완료 셀) ─▶ reviews/stage-review ─▶ certificate (results 변형) ─▶ library/gallery

profile/settings ─┬─▶ sync/save-progress (Rescue Code)
                  ├─▶ sync/join-space
                  ├─▶ paywall/upgrade  (parent-gated: profiles/pin-entry 선행)
                  └─▶ console/account  (parent-gated)
onboarding/welcome ─▶ sync/restore ("I already have progress") ─┬─▶ profiles/picker
                                                                └─▶ sync/merge-notice (로컬 진도 있을 때)
journey/grid (잠긴 Stage 셀) ─▶ paywall/upgrade (parent-gated)

[web only] 첫 방문 ─▶ pwa/system-banners (offline-ready) ; 설치 안 됨 + 3회 방문 ─▶ pwa/install-guide
[teacher role] profile/settings ─▶ classroom/projection-mode
```

### 4.3 Caregiver / Teacher Console (web)

```
/ (landing) ─▶ console/sign-in ─▶ (space 없음) console/onboarding-role ─▶ space 생성 ─▶ console/home
                              └─▶ (space 있음) console/home
console/home ─┬─ [family] ─▶ parent/dashboard ─▶ parent/learner-detail ─▶ parent/voice-recorder
              │                              └─▶ console/plan-builder (family)
              ├─ [class]  ─▶ console/roster ─┬─▶ parent/learner-detail (읽기 전용, summary 만)
              │                              ├─▶ console/plan-builder (class)
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
| 22 | join 시 부모 이메일(동의) 수집 | **S3 에서는 수집 안 함** — `spaces.settings_json.consentMode` 만 저장. 수집 UI 는 F-SPACE-002 (F-AUTH-002 이후) | F-SPACE-001 §4 |
| 23 | 콘솔 홈의 family/school 행 목적지 (`parent/dashboard` 웹판 · `console/school-admin` 부재) | 셋 다 **같은 summary 페이지** `/teach/space/:id` 로 (kind 별 명사만 다름). 웹 부모 대시보드는 F-PAR-001 웹판, 학교 트리는 S7 에서 분리 | F-CONSOLE-001 §3.4 |
| 24 | roster 의 "Show rescue code" (roadmap §5.1) vs 해시만 저장 | 평문을 서버가 모르므로 **"Issue a new code" (재발급)** 로 대체 — caregiver/teacher 경로의 `/recovery/issue` (구현됨 2026-09-21) | F-CONSOLE-001 §4 · F-TCH-001 §10.2 |
| 25 | 재연결 시 새 기기의 임시 프로필 | 새 기기에서 만든 임시 프로필은 **그대로 두고** 복원된 프로필을 활성으로 전환 (자동 삭제는 아동 데이터 손실 위험) | F-TCH-001 §10.1 · 코드 `JoinSpaceScreen` |

코드 ↔ 스펙 불일치 (shipped 화면) 는 같은 날 코드로 수정했다 — 각 와이어프레임의 Open questions 와 PR 본문 참조.

### 오너 결정 (2026-09-20)

| 항목 | 결정 | 반영 |
|---|---|---|
| 학교 동의 모드 | 둘 다 지원, space 설정에서 선택 (school 모드는 법률 검토 후 활성) | roadmap §11, `console/space-settings` 토글 |
| Rescue Code | 모든 학습자에게 자동 생성, 부모가 끌 수 있음 | roadmap §11, `sync/save-progress` |
| 교사 Free 캡 | 20명 (베타 후 재검토) | roadmap §7, §11, `console/roster` |
| Family 가격 | 미룸 (1.0 에 IAP 없음) | — |
| **스토어 카테고리** | **Education (Kids Category 아님)** — 성인 외국인 학습자도 대상이므로 Kids 전용 앱으로 제출하지 않는다. 부모 게이트·무광고·로컬 저장 등 아동 보호 설계는 그대로 유지 | `docs/launch/app-store-submission.md` §5 |

> **대상 사용자 확장 — 반영 완료 (2026-09-20)**: CLAUDE.md §1 이 **kids-first, never kids-only** 로 갱신됨 (P6 성인 초보 = 같은 화면·같은 콘텐츠, 별도 성인 모드 없음). README · `docs/launch/faq.md` · 스토어 카피 동기화. 앱 UI 문구 중 `onboarding/welcome` 의 "Made for kids 5–11" 한 줄은 오너 결정 후 코드 변경 (제안: "Made for kids 5–11 — and grown-ups starting from zero"). 베타에서 성인 5명 인터뷰로 Hoya 톤 수용도 확인 권장.

추가로 이 패스에서 드러난 것:
- `homework/list` 는 `home/todays-mission` 과 역할이 겹침 → 배정 큐가 3장을 넘을 때만 의미. 베타에서 진입률 측정.
