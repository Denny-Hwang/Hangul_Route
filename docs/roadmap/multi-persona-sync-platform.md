# Multi-persona · Teacher Plans · Sync & Restore — 최소 DB 설계안

**Status**: `in progress` — S1 (F-SYNC-001/002) · S2 (F-RESTORE-001) · S3 (F-SPACE-001 서버 + 학습자 join · F-CONSOLE-001 웹 콘솔 셸: 로그인(dev)·첫 space·홈·roster) · S4 PR 1 (F-PLAN-001 서버 + 기기 파생) 구현됨 2026-09-21; S4 빌더 · S5–S7 (F-PLAN-001 / F-TCH-001 / F-ENT-001 / F-SCHOOL-001) 은 아직 proposal
**작성일**: 2026-09-19
**선행 문서**: `web-pwa-offline.md` (웹앱/오프라인), F-TCH-001 (draft), F-PROF-001, F-HW-001, F-SUB-001, F-AUTH-001, `apps/api/src/db/schema.sql` (v1)
**요구**: (1) 교사가 학습 계획을 짜서 배포하고 학생 진도를 본다 (2) DB 를 최소로 (3) 개인 · 가정 · 학급 · 학교 페르소나 전부 (4) 페르소나별 결제 (5) 앱 삭제 · 기기 이전 시 데이터 복원

---

## 0. 결론 (TL;DR)

**테이블 7개, 블롭 1개, 규칙 3개** 로 전부 된다.

```
accounts ──owner──▶ spaces (family | class | school) ◀──parent_space── spaces
                        │
                  memberships  (누가 어느 space 에 어떤 역할로)
                        │
                     learners  (아이. PII 최소: 이름·연령대·아바타)
                        │
                    snapshots  (진도 전체 = ProgressSnapshot JSON 블롭 1행/learner)
                        │
                       plans   (교사·부모의 학습 계획. 학급당 1행, 학생당 N행 아님)
                        
                 entitlements  (누가 무엇을 결제했나. subject = account 또는 space)
```

핵심 아이디어 세 가지:

1. **Space 하나로 가정 · 학급 · 학교를 통일.** `families` / `classes` / `schools` 테이블을 따로 두지 않는다. `spaces.kind` 로 구분하고 `parent_space_id` 로 학교 → 학급 트리를 만든다. 교사·부모·학생 연결은 전부 `memberships` 한 테이블.
2. **진도는 블롭 1행.** 이미 `ProgressSnapshot` (content-schema) 이 퀘스트·카드·세션·숙제·리뷰를 한 객체로 들고 있다. 이것을 그대로 `snapshots.payload_json` 에 넣는다. `card_unlocks` / `sessions` / `homework_assignments` 테이블은 **삭제** — 블롭 안에 있다. 교사용 집계는 클라이언트가 업로드 시 같이 보내는 `summary_json` 컬럼으로 해결 (교사는 이 컬럼만 읽는다 = F-TCH-001 §3.6 프라이버시 규칙이 스키마 수준에서 강제됨).
3. **계획은 저장하고, 배정은 계산한다.** 교사가 학급에 계획을 발행하면 `plans` 1행. 학생 30명분 `HomeworkAssignment` 30행을 서버에 만들지 않는다. 학생 기기가 동기화할 때 계획을 받아 **로컬에서** F-HW-001 규칙대로 오늘의 미션을 만든다. 완료 여부는 스냅샷의 `quests[]` 에 이미 있으므로 별도 상태 테이블도 없다.

복원은 "스냅샷이 서버에 있다" 에서 자동으로 따라온다. 계정이 없는 아이를 위해 **Rescue Code** (사람이 읽을 수 있는 복구 코드) 를 `learners` 의 컬럼 하나로 처리한다.

---

## 1. 페르소나

| # | 페르소나 | Space | 결제 주체 | 인증 | 오늘 코드에서의 위치 |
|---|---|---|---|---|---|
| P-A | **개인 학습** — 어른 계정 없이 아이(또는 호기심 있는 청소년/성인)가 혼자 | 없음 (learner 만) | 없음 (Free) | 없음. Rescue Code 로만 복원 | 현재 앱의 기본 상태 (로컬 전용) |
| P-B | **가정** — 부모 1~2명 + 자녀 1~4명, 기기 공유 | `family` | 부모 | Clerk (부모만) | F-PROF-001 + F-AUTH-001 이 이미 이 형태 |
| P-C | **학급** — 한글학교 교사 1명 + 학생 ≤ 30명 | `class` | 교사 (또는 상위 school) | Clerk (교사) | F-TCH-001 draft |
| P-D | **학교** — 관리자 1명 + 교사 N + 학급 N | `school` → `class` 들 | 학교 | Clerk (관리자·교사) | 없음 (신규) |
| P-E | **기관 / B2G** — 교육청, 다문화센터 | `school` 여러 개 | 기관 (수동 계약) | Clerk | 없음. `entitlements.provider = 'manual'` 로 흡수 |

한 아이는 **동시에 여러 space 에 속할 수 있다** — 집에서는 family, 주말엔 class. 진도는 하나 (learner 1 = snapshot 1). 부모와 교사가 같은 스냅샷의 summary 를 본다 (F-TCH-001 §3.5 read consistency 가 공짜로 해결됨).

---

## 2. 데이터 모델 (D1 schema v2)

```sql
-- 어른. Clerk user 1명 = 1행. 아이는 여기 절대 없음 (COPPA).
CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,          -- Clerk user id
  email         TEXT UNIQUE,
  display_name  TEXT,
  consent_json  TEXT,                      -- {acceptedAt, policyVersion, mode:'parent'|'school'} — console/account 가 표시
  created_at    TEXT NOT NULL
);

-- 가정 / 학급 / 학교 를 하나의 개념으로.
CREATE TABLE spaces (
  id               TEXT PRIMARY KEY,       -- space:xxxx
  kind             TEXT NOT NULL CHECK (kind IN ('family','class','school')),
  name             TEXT NOT NULL,          -- "Kim family", "Sunday Class A", "Seoul Hangul School"
  parent_space_id  TEXT REFERENCES spaces(id) ON DELETE SET NULL,  -- class → school
  owner_account_id TEXT NOT NULL REFERENCES accounts(id),
  join_code        TEXT UNIQUE,            -- base32 6자리 (F-TCH-001 §3.1). family 도 사용 가능 (co-parent 초대)
  join_code_expires_at TEXT,
  settings_json    TEXT NOT NULL DEFAULT '{}',  -- anonymize_roster, consent_mode('parent'|'school'), 등
  created_at       TEXT NOT NULL
);

-- 누가(어른 or 아이) 어느 space 에 어떤 역할로.
CREATE TABLE memberships (
  space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  member_kind  TEXT NOT NULL CHECK (member_kind IN ('account','learner')),
  member_id    TEXT NOT NULL,              -- accounts.id 또는 learners.id
  role         TEXT NOT NULL CHECK (role IN ('owner','caregiver','teacher','admin','student')),
  joined_at    TEXT NOT NULL,
  PRIMARY KEY (space_id, member_kind, member_id)
);
CREATE INDEX idx_memberships_member ON memberships(member_kind, member_id);

-- 아이. PII 최소. 이메일·생년월일·성 없음.
CREATE TABLE learners (
  id                 TEXT PRIMARY KEY,     -- profile:xxxx (기존 Profile.id 그대로)
  display_name       TEXT NOT NULL,        -- 이름 또는 별명 (≤ 12자, Latin)
  age_group          TEXT NOT NULL CHECK (age_group IN ('5-7','8-9','10-11')),
  avatar             TEXT NOT NULL,
  recovery_hash      TEXT UNIQUE,          -- Rescue Code 의 해시 (§5). NULL 가능
  created_at         TEXT NOT NULL,
  last_active_at     TEXT NOT NULL
);

-- 아이 트래픽의 주체 (F-SYNC-001): learner 에 묶인 기기. 아이는 계정이 없으므로
-- 등록 시 기기에 랜덤 secret 을 발급하고 서버는 SHA-256 만 보관. Rescue Code / 재연결
-- 승인은 새 기기에 새 binding 을 만든다.
CREATE TABLE learner_devices (
  learner_id    TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,
  secret_hash   TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  PRIMARY KEY (learner_id, device_id)
);

-- 진도 전체. learner 당 정확히 1행.
CREATE TABLE snapshots (
  learner_id    TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  rev           INTEGER NOT NULL DEFAULT 0,   -- 낙관적 동시성 (§4)
  schema_ver    INTEGER NOT NULL,             -- ProgressSnapshot 스키마 버전
  content_ver   TEXT NOT NULL,                -- 클라이언트 CONTENT_VERSION
  device_id     TEXT NOT NULL,                -- 마지막으로 쓴 기기
  summary_json  TEXT NOT NULL,                -- 교사·부모용 집계 (§3.3). 교사는 이것만 읽는다
  payload_json  TEXT NOT NULL,                -- ProgressSnapshot 원본. 본인 기기와 부모만
  updated_at    TEXT NOT NULL
);

-- 학습 계획. 교사(class) 또는 부모(family) 가 발행. 학생당 fan-out 없음.
CREATE TABLE plans (
  id                TEXT PRIMARY KEY,
  space_id          TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  author_account_id TEXT NOT NULL REFERENCES accounts(id),
  title             TEXT NOT NULL,
  items_json        TEXT NOT NULL,       -- [{episodeId|questId, targetDate, note?}] 순서 있음
  target_learner_ids_json TEXT,          -- NULL = space 전원. 특정 학생만이면 id 배열
  published_at      TEXT,                -- NULL = 초안 (학생에게 안 감)
  archived_at       TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_plans_space_updated ON plans(space_id, updated_at);

-- 결제·권한. subject 가 account(교사 개인) 또는 space(가정·학교).
CREATE TABLE entitlements (
  id            TEXT PRIMARY KEY,
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('account','space')),
  subject_id    TEXT NOT NULL,
  plan_key      TEXT NOT NULL,      -- 'family_premium' | 'teacher_pro' | 'school_license' | 'school_seat'
  status        TEXT NOT NULL CHECK (status IN ('trial','active','past_due','expired','cancelled')),
  provider      TEXT NOT NULL CHECK (provider IN ('apple','google','stripe','manual')),
  provider_ref  TEXT,               -- 영수증 / Stripe subscription id / 계약번호
  seats         INTEGER,            -- school_seat 용. NULL = 무제한
  expires_at    TEXT,
  updated_at    TEXT NOT NULL,
  UNIQUE (subject_kind, subject_id, plan_key)
);

-- 텔레메트리는 그대로 (선택: Workers Analytics Engine 으로 옮기면 D1 write 절약)
CREATE TABLE events ( ... 기존과 동일 ... );
```

### 2.1 v1 → v2 대응 (마이그레이션은 사실상 무료 — D1 이 아직 바인딩되지 않았다)

| v1 (현재 `schema.sql`) | v2 | 비고 |
|---|---|---|
| `families` | `spaces(kind='family')` + `accounts` | `owner_id` → `owner_account_id` |
| `profiles` | `learners` + `memberships(role='student')` | `family_id` FK 가 membership 행으로 |
| `progress` | `snapshots` | `rev`, `summary_json` 추가 |
| `card_unlocks`, `sessions`, `homework_assignments` | **삭제** | 전부 `ProgressSnapshot` 블롭 안에 이미 존재 |
| `subscriptions` | `entitlements(subject_kind='space')` | `store` → `provider`, `stripe`/`manual` 추가 |
| (없음) | `plans` | 신규 |

테이블 수: v1 8개 → v2 8개 (`events` 포함). **행 수** 는 크게 준다 — 학급 30명에 숙제 1개 배정이 v1 로는 30행, v2 로는 1행.

### 2.2 클라이언트(content-schema) 변경

- `ProfileRoleSchema`: `['learner','parent']` → `['learner','parent','teacher','admin']` (F-PROF-001 이 예약해 둔 것).
- `HomeworkAssignmentSchema.assignedBy` 에 이미 `'teacher'` 가 있음 — 변경 없음.
- 신규 `PlanSchema`, `PlanItemSchema`, `ProgressSummarySchema`, `SyncEnvelopeSchema` (zod, 100% 커버리지 대상).
- `ProgressSnapshot` 에 `schemaVersion: number` 추가 (마이그레이션 근거).

---

## 3. 규칙 3개 (전부 순수 함수 → `logic/` 100% 테스트)

### 3.1 권한 (`logic/access/can.ts`)

```
can(actor, action, target):
  learner 본인      → 자기 snapshot payload 읽기/쓰기
  caregiver/owner   → 같은 family 의 learner: summary + payload 읽기, plan 쓰기
  teacher           → 같은 class 의 learner: summary 만 읽기, plan 쓰기, roster 관리
  admin (school)    → 하위 class 전체: summary 만, 교사 초대, entitlement 관리
  그 외             → 403
```
서버 라우트는 이 함수 하나를 호출한다 (지금의 `authorizeFamily` / `authorizeProfile` 를 일반화). **teacher 가 payload_json 을 받는 코드 경로는 존재하지 않는다** — 쿼리에서 컬럼 자체를 선택하지 않는다.

### 3.2 권한 티어 (`logic/entitlement/tier.ts` — F-SUB-001 확장)

```
tier(learner) =
  premium  if ∃ space ∈ spaces(learner) 이고
              (space.kind='family' and active(entitlement(space,'family_premium')))
           or (space.kind='class'  and (active(entitlement(space.owner,'teacher_pro'))
                                        or active(entitlement(space.parent_space,'school_license'|'school_seat'))))
  free     otherwise
isStageEntitled(stage, tier)  -- 기존 그대로: stage1 은 항상 true
```
즉 **아이는 결제 주체가 누구든 "어딘가에 소속되어 있으면" 프리미엄**. 학급이 Pro 면 집에서도 프리미엄 (BP02 §6.6 "Classroom = 유저 획득 채널" 그대로). 학급을 떠나면 다음 동기화 때 free 로 (로컬 캐시 티어에 `validUntil` 을 두어 오프라인 7일 유예).

### 3.3 요약 집계 (`logic/sync/summarize.ts`)

클라이언트가 스냅샷을 올릴 때 같이 계산해 보내는 것. 서버는 계산하지 않는다 (Workers CPU 절약 + 규칙이 한 곳에).

```ts
interface ProgressSummary {
  schemaVersion: 1;
  lastActiveAt: string;
  streakDays: number;
  stage1: { questsDone: number; questsTotal: number; anchorAccuracy: number | null }; // F-TCH-001 roster
  cardsUnlocked: number;
  minutesLast7d: number;
  jamoRecognized: string[];          // BP09 §3.5 "New jamo recognized"
  needsPractice: string[];           // 정답률 < 0.6 인 자모 상위 3 (anti-shame 카피는 UI 책임)
  planProgress: Record<planId, { done: number; total: number }>;  // 교사가 "계획 대비" 를 보는 유일한 소스
}
```
BP09 §3.5 / F-PAR-001 §3.2 의 대시보드 숫자가 전부 이 객체에서 나온다. 30명 roster = `SELECT learner_id, summary_json FROM snapshots WHERE learner_id IN (...)` 한 방.

---

## 4. 동기화 프로토콜 (오프라인 우선)

```
[학생 기기]                                  [Worker + D1]
 quest 완료 / 세션 종료 / 앱 포그라운드
   │  (online 이면)
   ├─ PUT /sync/learners/:id  {baseRev, snapshot, summary, deviceId}
   │        ├─ server.rev == baseRev → 저장, rev+1, 200 {rev}
   │        └─ 아니면 409 {serverSnapshot, rev}
   │              └─ 클라이언트 merge(local, server) → 재시도 (최대 2회)
   └─ GET /sync/learners/:id/inbox?since=<ts>
            → { plans: [...published, updated_at > since],
                memberships: [...],  tier, snapshotRev }
              → 로컬에서 plan → HomeworkAssignment 파생 (F-HW-001 §3.4 규칙)
```

**Merge 는 결정적 집합 병합** (`logic/sync/merge.ts`). `ProgressSnapshot` 의 필드가 전부 "쌓이기만 하는" 성질이라 CRDT 없이 된다.

| 필드 | 병합 규칙 |
|---|---|
| `quests[]` | `questId` 로 union. 같은 id 는 `stars` 큰 쪽, 같으면 `accuracy` 큰 쪽, `attempts` 는 합 |
| `episodes[]` | `episodeId` union, `questsCompleted` max |
| `cards[]` | `cardId` union, `unlockedAt` 이른 쪽 |
| `sessions[]` | `id` union |
| `homework[]`, `reviews[]` | `id` union, `completedAt` 있는 쪽 우선 |
| `streakDays` | sessions 로부터 **재계산** (`nextStreak` 재사용) |
| `updatedAt` | max |

**쓰기 빈도 (D1 무료 10만 write/일)**: 업로드는 (a) 퀘스트 완료 시 debounce 30초 (b) 세션 종료 (c) 계획 수신 후. 학습자 1,000명 × 하루 6회 = 6,000 write. 여유 16배.

**교사 계획의 오프라인 도달**: 학생이 오프라인이면 계획은 다음 접속 때 온다. 교사 콘솔은 roster 에 "3 students haven't synced since Tue" 를 보여주고 (summary.lastActiveAt), 발행은 수업 전에 하도록 UX 로 유도. 계획 항목이 참조하는 콘텐츠 id 가 학생 앱 번들에 없으면 (구버전) 건너뛰고 "Update to see new lessons" 배너.

---

## 5. 복원 (Restore) — 4가지 경우

| 상황 | 어떤 사용자 | 복원 경로 | 필요한 것 |
|---|---|---|---|
| 앱 삭제 후 재설치 / 새 기기 | P-B 가정 | 부모 Clerk 로그인 → family space 의 learners 목록 → 아이 선택 → snapshot pull | 계정 |
| 새 기기 | P-C 학급 학생 | `sync/join-space` 에서 join code 입력 → "I was already in this class" → roster 에서 이름 선택 → **교사 승인** (`console/relink-approval`, 10분 창) 또는 Rescue Code. (`sync/restore` 는 3경로만 — 한 화면 한 목표) | join code + 교사 or 코드 |
| 계정 없음 (P-A) | 혼자 하는 아이 | **Rescue Code** 입력 → `recovery_hash` 매칭 → snapshot pull | 코드 |
| 인터넷을 한 번도 안 쓴 기기 | 누구나 | 진도 파일 내보내기/가져오기 (`.hangulroute.json`, 공유시트 / 다운로드) — 서버 불필요 | 없음 |

### 5.1 Rescue Code

- 형식: `TIGER-MOON-4821` (동물·자연 단어 2개 + 숫자 4자리, 아이가 읽을 수 있는 영어 단어 목록 256개 → 256² × 10⁴ ≈ 6.5억 조합).
- 생성 시점: learner 첫 스냅샷 업로드 성공 직후. 프로필 화면 "Save my progress" 카드에 표시 + 부모 이메일이 있으면 발송 (Resend — F-RESTORE-002 로 분리, 미구현). Hoya: *"Write this down — it brings your cards back on any device!"*
- 저장: 서버는 `sha256(code)` 만 (`learners.recovery_hash`). 재발급하면 이전 코드 무효.
- 방어: `/recovery/claim` 은 IP 당 5회/시간 (구현됨; 지수 백오프는 미구현). **재발급(`/recovery/issue` — 발급과 재발급이 같은 라우트, 구현됨)은 기기 소유만으로는 안 된다** — 클라이언트는 부모 PIN 뒤에 두고, 서버는 현재 `snapshots.device_id` 와 일치하는 기기이거나 caregiver membership 을 가진 account 만 허용. 성공 시 새 device 가 이 learner 를 "소유" (기존 기기는 그대로 — 두 기기 병합은 §4 merge 가 처리).
- 학급 학생도 자동으로 받으므로 교사 승인 없이도 복원 가능. 교사는 roster 에서 잃어버린 아이에게 코드를 다시 줄 수 있다 — 서버는 해시만 알므로 "보여주기" 가 아니라 **재발급** ("Issue a new code", 이전 코드 무효; S5, app map §7 #24). summary 만 보는 규칙에 위배되지 않음 — 코드는 진도 데이터가 아님.

### 5.2 복원 시 병합

새 기기가 이미 로컬 진도를 갖고 있으면 (아이가 새 기기에서 며칠 하다가 복원) §4 merge 로 합친다. 덮어쓰기 없음. UI 는 "We found your old cards! Adding them to your collection" 한 줄.

### 5.3 삭제권 (GDPR-K / COPPA)

부모 또는 교사(학교 consent 모드) 가 learner 삭제 → `learners` 행 삭제 → `snapshots`, `memberships` CASCADE. 이벤트는 `profile_id` 를 NULL 로. 한 테이블 삭제로 끝나는 것이 이 설계의 부수 이득.

---

## 6. 교사 워크플로우 ("학습 계획 설계")

```
[웹 콘솔 — apps/web /teach]
 1. Clerk 가입 (역할: teacher)  →  class space 생성  →  join code 표시 (칠판에 적기)
 2. 학생 기기: Profile Picker > "Join a class" > 코드 입력 > 이름 입력  → learner + membership 생성
      (학교 consent 모드면 여기서 끝. 가정 consent 모드면 부모 이메일 1회 입력)
 3. Plan Builder: 카탈로그(에피소드/퀘스트)에서 골라 순서 + 날짜 지정
      - "Pace" 헬퍼: 시작일 + 주 2회 → targetDate 자동 배분
      - 특정 학생만 대상 지정 가능 (target_learner_ids)
      - 초안 저장 / 발행
 4. Roster: 학생별 summary 카드 (계획 대비 done/total, 최근 활동, 연습 필요 자모)
      - 정렬 기본: 최근 활동순 (F-TCH-001 §3.2 — 랭킹 방지)
      - 카드 탭 → 주간 요약 (F-PAR-001 과 동일 컴포넌트, 읽기 전용)
 5. (Pro) 워크시트 PDF, 계획 템플릿 저장·공유 (F-TCH-002/003)
```

부모도 같은 Plan Builder 를 family space 에 대해 쓴다 (F-PAR-001 "explicit homework" T-P2-01 이 이것으로 흡수됨). 학생 쪽에서는 F-HW-001 §3.4 의 "1 explicit/day" 캡을 source 별로 적용 (teacher 1 + parent 1).

학교(P-D): admin 이 school space 를 만들고 교사에게 초대 코드 (space join_code, role=teacher). 학급은 `parent_space_id = school`. Admin 대시보드 = 학급별 roster summary 의 합 (학생 개인 카드는 열지 않음 — settings `anonymize_roster` 기본 on).

---

## 7. 결제 옵션

| plan_key | 대상 | 가격 (제안) | 포함 | 결제 경로 |
|---|---|---|---|---|
| (free) | P-A, P-B | $0 | Stage 1 전체, 프로필 4개, 로컬 진도, Rescue Code, 파일 백업 | — |
| `family_premium` | P-B | **$5.99/월 · $39.99/년** (7일 트라이얼) | Stage 2–7, 클라우드 동기화, 부모 대시보드, 가정 계획, learner ≤ 4 | iOS/Android IAP (F-IAP-001) · 웹은 Stripe |
| `teacher_free` (entitlement 행 없음) | P-C 자원봉사 교사 | $0 | class 1개, 학생 ≤ 20, 계획 발행, roster summary | — |
| `teacher_pro` | P-C | **$9.99/월 · $79/년** | class 무제한, 학생 무제한, 학생 전원 프리미엄(재학 중), 워크시트 PDF, 템플릿 | Stripe (웹 전용) |
| `school_license` | P-D 소규모 (한글학교) | **$50/월 · $450/년** | 교사 ≤ 10, 학생 ≤ 300, 전 학급 Pro, admin 대시보드 | Stripe 또는 인보이스 |
| `school_seat` | P-D 대규모 / P-E | **$2/학생/년** (최소 300석) | 위 + 좌석 단위, SSO 검토 | `manual` (계약) |

설계 원칙:
- **아이는 결제 주체가 아니다.** 결제는 항상 어른 계정 또는 space 에 붙는다 (`entitlements.subject`). 앱 내에 아이가 누를 수 있는 결제 버튼이 없다 (부모 게이트 뒤).
- **교사·학교 결제는 웹에서만.** 앱스토어 30% 를 피하고, Apple 의 IAP 규정(앱 내 디지털 상품 링크 금지)과 충돌하지 않도록 iOS 앱에는 teacher 결제 UI 자체를 두지 않는다. 교사 콘솔이 원래 웹(F-TCH-001) 이라 자연스럽다.
- **Free 교사 20명 캡** 은 `memberships` count 로 서버에서 검사. 21번째 join 시 교사에게 업그레이드 안내, 학생에게는 "Ask your teacher" 한 줄.
- **가격은 초안.** BP02 §6.6 의 교사 Pro $9.99 / 학교 $50 를 그대로 쓰고, family 가격은 경쟁사 대비 낮게 (DinoLingo $19/월 대비) 잡았다. 실 가격은 PH 런치 데이터 후 결정 (BP02 §8 열린 질문 "수익 모델 시점" 그대로 열림).
- 웹 결제 = Stripe Checkout + webhook → `entitlements` upsert. `F-IAP-001` 의 영수증 검증과 같은 함수(`applyEntitlement`) 로 수렴시켜 provider 만 다르게.

---

## 8. API 표면 (Hono 라우트, 최소)

| Method | Path | 누가 | 하는 일 |
|---|---|---|---|
| POST | `/spaces` | account | family/class/school 생성 (+ owner membership; class 는 코드 포함) — 구현됨 (F-SPACE-001) |
| GET | `/spaces` | account | 내 space 목록 + 인원 수 + (관리 역할만) join code — 구현됨 |
| POST | `/spaces/lookup` | 누구나 (코드, rate-limited 20/시간/IP) | 코드 → `{ space, full }` (join 전 확인) — 구현됨 |
| POST | `/spaces/:id/join` | learner 기기 (learnerId) 또는 account (코드) | membership 추가. 캡 검사 (학생 20/class free, class 3/learner), 학교는 account 만 — 구현됨 |
| POST | `/spaces/:id/leave` | learner 기기 | 학습자 탈퇴 — 구현됨 |
| DELETE | `/spaces/:id/members/:kind/:id` | roster.manage | 멤버 제거 (owner 불가) — 구현됨 |
| POST | `/spaces/:id/code` | space.manage (owner) | join code 발급·재발급 — 구현됨 |
| GET | `/spaces/:id/roster` | summary.read (caregiver/teacher/admin) | learners + `summary_json` (payload 없음), 최근 활동순 — 구현됨 |
| PUT | `/spaces/:id/plans` | plan.write (caregiver/teacher) | 계획 upsert (`publish` 로 발행; 발행 후 저장은 발행 유지) — 구현됨 (F-PLAN-001) |
| GET | `/spaces/:id/plans` | summary.read | 목록 (archived 포함) — 구현됨 |
| POST | `/spaces/:id/plans/:pid/archive` | plan.write | 보관 (inbox 에서 빠지고 미완료 숙제는 기기에서 제거) — 구현됨 |
| POST | `/sync/learners` | 기기 (인증 없음) | learner 등록 + 기기 secret 1회 발급 (F-SYNC-001, 구현됨) |
| PUT | `/sync/learners/:id/snapshot` | learner 기기 (`Authorization: Device <deviceId>:<secret>`), caregiver | 스냅샷 업로드 (rev 검사, 409 시 서버본 반환) — 구현됨 |
| GET | `/sync/learners/:id/inbox` | learner 기기 | plans + memberships + tier + rev — 구현됨 (plans/memberships 는 S3–S4 까지 빈 배열) |
| GET | `/sync/learners/:id/snapshot` | learner 기기, caregiver | 전체 payload (복원) — 구현됨 |
| POST | `/recovery/claim` | 누구나 (코드, rate-limited 5회/시간/IP) | Rescue Code → learner 바인딩 + 새 기기 secret + 스냅샷 반환 — 구현됨 (F-RESTORE-001) |
| POST | `/recovery/issue` | learner 기기 (클라이언트는 부모 PIN 뒤) | 코드 발급·재발급 (이전 코드 무효, §5.1) — 구현됨. caregiver account 경로는 F-SPACE-001 이후 |
| POST | `/spaces/:id/relink-requests` | 누구나 (join code + roster 이름) | 재연결 요청 생성 (10분 만료) |
| POST | `/spaces/:id/relink-requests/:rid/approve` · `/deny` | teacher/admin | 승인 시 요청 기기에 learner 바인딩 |
| DELETE | `/learners/:id` | caregiver/teacher(school-consent) | 삭제권 |
| POST | `/entitlements/stripe/webhook` · `/entitlements/verify` | Stripe / 앱 | entitlement upsert |

기존 `/api/auth/family`, `/api/profiles`, `/api/progress`, `/api/subscriptions` 는 위로 흡수 (인메모리 `store.ts` 도 같은 모양으로 교체 — 지금 라우트 테스트 패턴 유지).

---

## 9. 페르소나별 "이 설계로 되는가" 점검

| 시나리오 | 경로 |
|---|---|
| 아이 혼자 시작, 6개월 뒤 부모가 계정 만들어 합류 | learner 는 이미 있음 → 부모가 family 생성 → 아이 기기에서 family join code 입력 → membership 추가. 진도 이동 없음 |
| 형제 2명이 태블릿 1대 | family 1 + learners 2 + snapshots 2. 기존 F-PROF-001 그대로 |
| 학급 학생이 집에서 부모 대시보드로도 보임 | learner 가 family + class 양쪽 membership. summary 1개를 둘 다 읽음 (F-PAR-001 §3.5 Phase 2 note) |
| 교사 계획에 학생이 아직 못 연 퀘스트가 있다 | 학생 기기가 파생 시 건너뛰고 `summary.planProgress` 에 not-ready 로 보고. 교사 roster 각주. (부모의 단건 배정은 F-HW-001 §3.4 대로 즉시 실패) |
| 교사가 반을 다음 학기에 새로 만듦 | 새 class space. 학생은 새 코드로 join (3개 캡 안). 옛 class 는 archive (membership 유지, join 불가) |
| 학교가 교사 5명에게 Pro 를 주고 싶다 | school entitlement 1행. §3.2 규칙이 하위 class 전부에 전파 |
| 아이가 학급을 떠났는데 프리미엄이 계속 보인다 | inbox 의 tier 가 free 로 → 로컬 `validUntil` 만료 후 잠금. 오프라인이면 최대 7일 유예 |
| 부모가 아이 데이터 전부 삭제 요청 | `DELETE /learners/:id` 1회 |
| 기기 2대에서 같은 아이가 동시에 학습 | rev 충돌 → merge → 둘 다의 별·카드 보존 |

---

## 10. 단계 (web-pwa-offline.md 의 P0–P3 뒤에 이어짐)

| Phase | 스펙 | 내용 | 예상 |
|---|---|---|---|
| S1 | F-SYNC-001 · F-SYNC-002 | schema v2 + `snapshots` PUT/GET + `merge.ts` + `summarize.ts` + 파일 내보내기/가져오기. 가정(P-B) 복원 완성 — **구현됨 2026-09-21** (#67) | 3 d |
| S2 | F-RESTORE-001 | Rescue Code 생성·표시·claim + rate limit — **구현됨 2026-09-21**; 이메일 발송은 F-RESTORE-002 로 분리 | 1.5 d |
| S3 | F-SPACE-001 | `spaces` / `memberships` / join code / `can.ts`. F-TCH-001 §3.1 을 여기로 이관 — **구현됨 2026-09-21** (서버 + `sync/join-space`; 콘솔 화면은 F-CONSOLE-001) | 2 d |
| S4 | F-PLAN-001 | `plans` + 웹 Plan Builder (family·class 공용) + 학생 측 plan → homework 파생 — **PR 1 구현됨 2026-09-21** (서버 + inbox + 기기 파생 + `planProgress`); 빌더 화면은 PR 2 | 3 d |
| S5 | F-TCH-001 (ready 로 승격) | Roster summary 뷰, 교사 온보딩, 20명 캡, re-link 승인 | 2 d |
| S6 | F-ENT-001 | `entitlements` + `tier.ts` 확장 + Stripe Checkout/webhook + F-IAP-001 수렴 | 2.5 d |
| S7 | F-SCHOOL-001 | school space, admin 대시보드, 교사 초대, seat 카운트 | 2 d |

합계 약 **16 일**. S1–S2 만으로 "앱 지워도 안전" 이 되고, S3–S5 로 교사 페르소나가 산다. S6 이후가 매출.

---

## 11. 결정 (2026-09-20, 오너) + 남은 열린 질문

| # | 항목 | 결정 |
|---|---|---|
| 1 | 학교 consent 모드 | **(c) 둘 다 지원, space 설정에서 선택** — `spaces.settings_json.consent_mode ∈ {'parent','school'}`. school 모드는 F-SPACE-001 착수 전 법률 검토 1회 (BP03 §"법률 검토"). 급하지 않음 |
| 2 | Rescue Code 기본값 | **(a) 자동 생성** — 모든 learner 의 첫 스냅샷 업로드 성공 직후. 부모가 끌 수 있음 (설정) |
| 4 | 교사 Free 캡 | **20명** (BP02 §6.6 원안 유지). 베타에서 실제 반 크기를 재고 필요하면 30 으로 상향 |
| 5 | Family 가격 | **미룸** — 1.0 에 IAP 없음. PH 런치 데이터 후 결정 (제안값 $5.99/월 · $39.99/년 은 placeholder 유지) |

남은 열린 질문:

3. **텔레메트리 `events` 를 D1 에 둘지 Analytics Engine 으로 옮길지** — write 예산의 대부분을 먹는 것이 이 테이블이다. F-SYNC-001 스파이크 때 결정.
