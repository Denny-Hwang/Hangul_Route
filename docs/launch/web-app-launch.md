# 웹앱 (PWA) 런치 체크리스트 — 주 배포 채널

> 2026-09-20 결정: **주 채널은 웹앱.** 인터넷과 기기만 있으면 접근하고, 한 번 열면 오프라인에서 학습된다.
> 앱스토어 (`app-store-submission.md`) 는 같은 코드로 나중에 올리는 **선택지**로 남긴다.
> 설계 근거: `docs/roadmap/web-pwa-offline.md` · 화면: `design/wireframes/pwa/*`

---

## 1. 저장소에서 끝낸 것 (P0–P3, 2026-09-20)

| 단계 | 내용 | 검증 |
|---|---|---|
| P0 웹 빌드 | `react-native-web` · `react-dom` · `@expo/metro-runtime` · `@babel/runtime` 추가, `app.json web.output = single`, 워크스페이스 패키지에 `main` 진입점 | `pnpm --filter @hangul-route/mobile build:web` → JS 2.08 MB, 899 modules |
| P1 플랫폼 래퍼 웹 버전 | `storage.web.ts` (IndexedDB, idb-keyval) · `audio.web.ts` (speechSynthesis, ko-KR 보이스 선택) · `haptics.web.ts` (vibrate) · `sharing.web.ts` (미지원 → Share 버튼 숨김) · `dialog.web.ts` (confirm) · `pwa.web.ts` (SW 이벤트) | 단위 테스트 16개, platform 레인 커버리지 게이트 통과 |
| P2 PWA 오프라인 | `public/manifest.webmanifest` · `scripts/pwa-postbuild.mjs` (메타/CSS/SW 등록 주입 + Workbox `generateSW` 프리캐시) · 앱 내 배너 `PwaBanners` (offline-ready / update-ready / offline chip) · `navigator.storage.persist()` · trace 캔버스 `touch-action: none` | **Playwright 오프라인 E2E 통과** (`e2e/web/offline.spec.ts`): 온보딩 → 첫 퀘스트 → SW 설치 → 네트워크 차단 → 새로고침 → 프로필 유지 · 라이브러리 진입, pageerror 0 |
| P3 배포 파이프라인 | **Cloudflare Workers Builds (Connect GitHub)** 가 main 푸시마다 빌드·배포. `apps/mobile/wrangler.toml` (assets-only Worker, SPA 폴백, `_headers`). GitHub Actions `web-app.yml` 은 머지 게이트 (빌드 + wrangler dry-run + 오프라인 E2E) 만 | 2026-09-21 Pages → Workers 전환 |
| 대시보드 전용 배포 (2026-10-07) | 오너 PC 가 프록시로 Cloudflare API 를 못 쓰므로 로컬 wrangler 단계를 전부 제거. `apps/api/wrangler.toml`: D1 바인딩 주석 처리 (존재하지 않는 database_id 는 배포를 막고, 코드는 `env.DB` 를 읽지 않음) + `keep_vars = true` (대시보드 변수 보존) + 변수·시크릿을 대시보드에서 넣는 안내. `pnpm-workspace.yaml` `neverBuiltDependencies` (esbuild · workerd · sharp · @clerk/shared — 빌드·배포에 불필요, 경고만 제거). CI 에 API `wrangler deploy --dry-run` 게이트. 오너 순서표는 `owner-runbook.md` 로 이동 | `wrangler deploy --dry-run` (api) 통과 · `pnpm install` 경고 0 |
| 프로모·레퍼럴 코드 (2026-10-06) | F-ENT-002: 코드·할인율은 **Stripe Promotion Code** 로 오너가 직접 관리 (테이블·관리 화면 없음). API `POST /entitlements/stripe/promo` 가 Stripe 에서 조회해 할인가를 돌려주고 (분당 20회 제한), checkout 이 서버에서 재검증 후 `discounts[0]` 로 적용, 웹훅이 entitlement 에 `promoCode` 를 남김 (레퍼럴 귀속). 콘솔 billing 에 코드 입력칸 + 할인가 표시, 페이월엔 안내 한 줄. 코드 없이도 Stripe 자체 코드 입력칸은 열려 있음 | 단위 backend 130 · web 50 · content-schema 37 · mobile 388 |
| 가격 모델 (2026-10-06) | 상품 2개로 통합 (결정 #30): `family_lifetime` $15.30 일회 (가족 학습자 ≤ 5, 만료 없음, Stripe `mode=payment`) · `group_license` $153/년 (단독 학급 또는 학교, 구독) · 상한 초과 `school_seat` Contact us. Teacher Pro · 월 결제 · 가격 placeholder 제거. 페이월은 Lifetime 카드 1개, 콘솔 billing 은 interval 선택 없음 | 단위 backend 128 · web 49 · mobile 388 · content-schema 36 |
| 콘솔 배포 (2026-10-06) | `apps/web` 를 Next `output: 'export'` 정적 내보내기로 전환 → `apps/web/wrangler.toml` (assets-only Worker `hangul-route-web`, 404 페이지, `_headers`). 동적 세그먼트 제거: `/teach/space?id=` · `/plan?id=` · `/relink?id=` · `/settings?id=`. `preview-deploy.yml` 은 Pages 업로드 대신 정적 빌드 + wrangler dry-run 머지 게이트 (F-CONSOLE-001 §3.7, 결정 #29) | `next build` 21 페이지 · `wrangler deploy --dry-run` 103 파일 · 단위 web 49 |
| 데스크톱 폭 | 600px 이상에서 폰 폭(480px) 컬럼 중앙 정렬 — 토큰(canvas/border) 을 빌드 시 읽어 셸 CSS 생성 | `scripts/pwa-postbuild.mjs` |
| 랜딩 CTA | `apps/web` 헤더·히어로·#get 섹션이 `NEXT_PUBLIC_APP_URL` (기본 app.hangulroute.com) 로 연결 | T-048 |
| 부수 수정 | 콜드 런치 시 저장소 hydrate 전에 온보딩으로 보내던 버그 (네이티브 공통) — `RootNavigator` 가 hydrate 까지 대기 | E2E 의 오프라인 새로고침 단계가 이 버그를 잡아냄 |
| S7 학교 (2026-09-21) | `GET /spaces/:id/school` (초대 코드 · 라이선스 · seats 사용량 · 이번 주 집계 · 학급 표 with 교사/학생 수/최근 활동/계획) · `POST /spaces/:id/members` 교사 배정 · 라이선스 seat 캡 (`cap_school`, 학교 내 중복 학생 1회 계산) (F-SCHOOL-001). 콘솔: `/teach/space/:id` 가 school 이면 admin 뷰 (집계만, 학생 이름 없음; 새 학급 · 교사 배정 · Manage billing) | 단위 backend 128 · web 48 (lane 99.7 %) |
| S6 콘솔 billing (2026-09-21, PR 3) | `/teach/billing`: 현재 플랜 카드 (상태·결제 경로·seats·Manage subscription → Stripe Portal) · 역할별 플랜 행 (family / teacher / school, 추천 1개, school seats 는 Contact us, 가격은 placeholder) · Choose → Stripe Checkout (월/연) · `?checkout=success|cancel` 안내 · past_due 안내. 홈 상단 Billing 버튼과 roster 캡 배너의 Upgrade 가 연결됨 (F-ENT-001 §3.6). 키 미설정이면 "Checkout is not set up yet" | 단위 web 45 (lane 99.7 %); `next build` 라우트 8개 |
| S6 paywall (2026-09-21, PR 2) | 앱 `paywall/upgrade` (PIN 뒤): "Stage 1 is always free" 먼저 · covered by <class> / Premium / Free 세 상태 · 월/연 카드 (가격 placeholder) · 구매는 **웹 콘솔** 로 안내 (`EXPO_PUBLIC_CONSOLE_URL`, 기본 hangulroute.com) — 아이 화면에 결제 버튼 없음. 진입: 설정 플랜 카드 "Unlock the journey" · Journey 의 미보유 Stage 행 (Premium 필) (F-ENT-001 §3.5) | 단위 mobile 388; e2e 3/3 |
| S6 결제·권한 (2026-09-21, PR 1) | `entitlements` 1 테이블 (subject = account 또는 space) + `applyEntitlement` 하나로 영수증·Stripe·계약 수렴 (F-ENT-001). 학습자 tier 는 membership 에서 계산 (family_premium · teacher_pro · school_license/seat) → inbox `tier`/`tierSource`/`tierValidUntil` (7일 오프라인 유예) → 기기 `tier-store` → Stage 잠금 해제 · 설정 카드 "covered by <class>". Pro 학급은 20명 캡 해제. Stripe Checkout/Portal/Webhook (SDK 없이 HMAC 서명 검증). 화면 (paywall · console billing) 은 PR 2–3 | 단위 backend 125 · mobile 386 · content-schema 36; e2e 3/3 |
| S5 콘솔 설정·승인 (2026-09-21, PR 2) | `/teach/space/:id/settings` (코드 · 동의 모드 · 익명 roster · 어른/학습자 제거 · 보관/해제 · 학습자 데이터 삭제는 이름 입력 확인) · `/teach/space/:id/relink` (대기 요청 카드 승인/거절, 10초 갱신, rescue code 재발급 1회 표시) · roster 에 요청 수 배지 (F-TCH-001 §10). `GET /spaces/:id/members` 추가 | 단위 backend 116 · web 41 (lane 99.6 %); `next build` 라우트 7개 |
| S5 재연결·설정 (2026-09-21, PR 1) | 학급 학생의 새 기기: `sync/join-space` → "I was already in this class" → 이름 선택 → 교사 승인 (10분) → 자격 1회 수령 → 프로필·진도 복원 (F-TCH-001 §10.1). 교사·부모의 rescue code 재발급 (§10.2). space 설정 API: 익명 roster · 동의 모드 · 보관/해제 · 학습자 데이터 삭제 (§10.3). 콘솔 화면은 PR 2 | 단위 backend 115 · mobile 384 · content-schema 34; e2e 3/3 |
| S4 계획 빌더 (2026-09-21, PR 2) | 콘솔 `/teach/space/:id/plan` (F-PLAN-001 §3.5): Stage 1 카탈로그(에피소드/퀘스트) → 순서·날짜·메모 → Spread dates (하루 1개) → 대상 (전원/일부) → 발행·초안·보관 → 발행 후 학습자별 readout (`done / total`, not ready, 최근 활동; 순위 없음). roster 카드에 최신 계획 진행 표시 | 단위 web 38 (lane 99.6 %); `next build` 라우트 5개 |
| S4 계획 (2026-09-21, PR 1) | `plans` (space 당 1행, `PUT/GET /spaces/:id/plans` + archive) → 학습자 inbox → 기기에서 `HomeworkAssignment` 파생 (잠긴 항목은 조용히 건너뛰고 `summary.planProgress.notReady` 로 보고) → Home 카드 ② 가 그날의 배정을 받음 → 퀘스트 완료 시 배정 완료 처리 (F-PLAN-001 §3.1–3.4). 콘솔 빌더 화면은 PR 2 | 단위 backend 107 · mobile 380 · content-schema 32; e2e 3/3 |
| S3 콘솔 셸 (2026-09-21) | `apps/web` `/teach` (F-CONSOLE-001): dev 로그인 (Clerk 전까지, 비프로덕션 또는 `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`) → 역할 선택·첫 space·학급 코드 → 홈 허브 → roster (코드 복사·재발급, 이번 주 롤업, 학생 summary 카드). Worker 에 **CORS allow-list** (`ALLOWED_ORIGINS`, 기본 hangulroute.com 3종 + localhost + workers.dev) — 브라우저(PWA·콘솔)에서 API 호출의 전제 | 단위 web 30 (lane 99.5 %) · backend 104; `next build` 라우트 4개 |
| S3 스페이스 (2026-09-21) | `accounts` / `spaces` / `memberships` + join code (base32 6자, 30일) + 권한 함수 `can()` (교사는 payload 를 받을 경로가 없음) + `/api/spaces` 8 라우트 (F-SPACE-001). 학습자 앱: 설정 "Classes & family" 카드 → `sync/join-space` (코드 → 이름 확인 → 완료, PIN 없음) · Leave. 콘솔 화면은 다음 PR (F-CONSOLE-001) | 단위 backend 99 · mobile 369 · content-schema 30; 게이트 7/7 |
| S1–S2 동기화·복원 (2026-09-21) | 서버 스냅샷 + 결정적 병합 + 30 s 디바운스 클라이언트 (F-SYNC-001/002) · 파일 백업/복원 · **Rescue Code** 자동 발급·복사·공유·재발급·새 기기 claim (F-RESTORE-001). `EXPO_PUBLIC_API_BASE_URL` 이 없으면 전부 조용히 꺼짐 (파일 백업만 동작) | 단위 (mobile 359 · backend 77) + `e2e/web/backup.spec.ts` 파일 왕복. 코드 경로 실기기 확인은 API 연결 후 T-046 에 포함 |

## 2. 오너 작업 — 대시보드 전용 (2026-10-07 개정)

> 순서·확인 기준·입력값은 **`owner-runbook.md`** 가 원본이다. 로컬 `wrangler` 는 쓰지 않는다 (회사 프록시가 Cloudflare API 를 막는다): 배포는 Workers Builds (GitHub 연동), 변수·시크릿·D1 은 대시보드, 저장소 변경은 PR → required checks → 머지 → 자동 재배포.

| Step | 내용 | 시간 |
|---|---|---|
| 1 | GitHub `main` 보호 — PR 필수 + 체크 3개 (`lint · typecheck · test · build`, `Build PWA · offline e2e`, `Measure coverage vs rolling targets`) | 10분 |
| 2 | `hangul-route-app` Import a repository (학습자 PWA) | 20분 |
| 3 | `hangul-route-api` Import a repository (D1 바인딩 없이 배포됨) + D1 을 대시보드에서 생성 → Database ID 전달 → 바인딩 PR | 25분 |
| 4 | `hangul-route-web` Import a repository (랜딩 + 콘솔, 정적 내보내기) | 15분 |
| 5 | 앱 빌드 변수 `EXPO_PUBLIC_API_BASE_URL` → Retry deployment → Rescue Code · 학급 코드 왕복 확인 | 10분 |
| 6 | 도메인 `app.hangulroute.com` · `hangulroute.com` · `www` + API `ALLOWED_ORIGINS` | 15분 + DNS |
| 7 | Clerk → Secret `CLERK_SECRET_KEY` (API) + 빌드 변수 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (web) → F-AUTH-002 착수 | 20분 |
| 8 | Stripe → Price 2개 → Text 변수 `STRIPE_PRICE_FAMILY_LIFETIME` / `STRIPE_PRICE_GROUP_LICENSE_YEARLY` / `CONSOLE_URL` + Secret `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` + 웹훅 4 이벤트 | 40분 |
| 9 | 프로모·레퍼럴 코드 (Stripe Coupons → Promotion code, 배포 불필요) | 15분 |
| 10 | 설치 3종 + 오프라인 실기기 완주 | 30분 |
| 11 | Lighthouse (설치 가능 전부 녹색, Performance ≥ 80) | 15분 |
| 12 | 자모 MP3 30개 녹음 | 1일 |

프로젝트 3개의 Project name / Build / Deploy command / Build variables / 런타임 변수·시크릿 표는 `owner-runbook.md` §0.

## 3. 웹에서 다른 점 (사용자 안내용)

| 항목 | 네이티브 | 웹 | 조치 |
|---|---|---|---|
| 발음 | expo-speech TTS | 브라우저 speechSynthesis — 한국어 보이스는 iOS Safari·Android Chrome 은 보통 있음, PC 는 기기마다 다름. 오프라인 보장 없음 | **T-017 자모 MP3** 가 근본 해법 (INBOX 최상단으로) |
| 카드 공유 | 공유시트 | 버튼 숨김 (view-shot 미지원) | 후속: SVG → canvas → Web Share (roadmap §2) |
| 햅틱 | 있음 | Android 만 진동, iOS 없음 | 없음 (선택적 피드백) |
| 퀘스트 나가기 확인 | 네이티브 Alert | 브라우저 confirm() | 후속: 토큰 스타일 시트로 교체 |
| 저장소 | AsyncStorage | IndexedDB + persist() 요청. iOS 는 홈 화면에 추가하지 않으면 7일 미사용 시 삭제 가능 | 설치 안내 시트 (F-PWA-001, 구현됨) + Rescue Code (F-RESTORE-001, 구현됨 — API 연결 시 첫 클라우드 저장 후 자동 발급) |
| 데스크톱 | — | 폰 폭 컬럼 중앙 정렬 (600px+) | 가로 레이아웃 시안은 별도 |
| 업데이트 | 스토어 | "New lessons are ready — Refresh" 배너, 사용자가 누를 때만 적용 (퀘스트 중 강제 새로고침 없음) | — |

## 4. 아직 안 한 것 (다음 PR 후보, 우선순위순)

1. **T-017 자모 MP3 30개** → 프리캐시에 포함하면 오프라인 발음 보장 (0.5 d 코드 + 녹음)
2. ~~`pwa/install-guide` 화면~~ (F-PWA-001, 2026-09-21 완료 — 3회째 열 때 시트, 5회 스누즈, 설정에서 강제 표시)
3. ~~텔레메트리 오프라인 큐~~ (F-PWA-001, 2026-09-21 완료 — 200개 캡, online/시작 시 flush, 4xx 는 폐기)
4. 카드 공유 웹 구현 (SVG → PNG → Web Share) (1 d)
5. ~~데스크톱 레이아웃 max-width 셸~~ (2026-09-21 완료 — 가로 전용 시안은 별도)
6. ~~랜딩 CTA~~ (2026-09-21 완료) · `index.html` OG 메타 (0.25 d)
