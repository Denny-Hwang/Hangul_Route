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
| 데스크톱 폭 | 600px 이상에서 폰 폭(480px) 컬럼 중앙 정렬 — 토큰(canvas/border) 을 빌드 시 읽어 셸 CSS 생성 | `scripts/pwa-postbuild.mjs` |
| 랜딩 CTA | `apps/web` 헤더·히어로·#get 섹션이 `NEXT_PUBLIC_APP_URL` (기본 app.hangulroute.com) 로 연결 | T-048 |
| 부수 수정 | 콜드 런치 시 저장소 hydrate 전에 온보딩으로 보내던 버그 (네이티브 공통) — `RootNavigator` 가 hydrate 까지 대기 | E2E 의 오프라인 새로고침 단계가 이 버그를 잡아냄 |
| S5 콘솔 설정·승인 (2026-09-21, PR 2) | `/teach/space/:id/settings` (코드 · 동의 모드 · 익명 roster · 어른/학습자 제거 · 보관/해제 · 학습자 데이터 삭제는 이름 입력 확인) · `/teach/space/:id/relink` (대기 요청 카드 승인/거절, 10초 갱신, rescue code 재발급 1회 표시) · roster 에 요청 수 배지 (F-TCH-001 §10). `GET /spaces/:id/members` 추가 | 단위 backend 116 · web 41 (lane 99.6 %); `next build` 라우트 7개 |
| S5 재연결·설정 (2026-09-21, PR 1) | 학급 학생의 새 기기: `sync/join-space` → "I was already in this class" → 이름 선택 → 교사 승인 (10분) → 자격 1회 수령 → 프로필·진도 복원 (F-TCH-001 §10.1). 교사·부모의 rescue code 재발급 (§10.2). space 설정 API: 익명 roster · 동의 모드 · 보관/해제 · 학습자 데이터 삭제 (§10.3). 콘솔 화면은 PR 2 | 단위 backend 115 · mobile 384 · content-schema 34; e2e 3/3 |
| S4 계획 빌더 (2026-09-21, PR 2) | 콘솔 `/teach/space/:id/plan` (F-PLAN-001 §3.5): Stage 1 카탈로그(에피소드/퀘스트) → 순서·날짜·메모 → Spread dates (하루 1개) → 대상 (전원/일부) → 발행·초안·보관 → 발행 후 학습자별 readout (`done / total`, not ready, 최근 활동; 순위 없음). roster 카드에 최신 계획 진행 표시 | 단위 web 38 (lane 99.6 %); `next build` 라우트 5개 |
| S4 계획 (2026-09-21, PR 1) | `plans` (space 당 1행, `PUT/GET /spaces/:id/plans` + archive) → 학습자 inbox → 기기에서 `HomeworkAssignment` 파생 (잠긴 항목은 조용히 건너뛰고 `summary.planProgress.notReady` 로 보고) → Home 카드 ② 가 그날의 배정을 받음 → 퀘스트 완료 시 배정 완료 처리 (F-PLAN-001 §3.1–3.4). 콘솔 빌더 화면은 PR 2 | 단위 backend 107 · mobile 380 · content-schema 32; e2e 3/3 |
| S3 콘솔 셸 (2026-09-21) | `apps/web` `/teach` (F-CONSOLE-001): dev 로그인 (Clerk 전까지, 비프로덕션 또는 `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`) → 역할 선택·첫 space·학급 코드 → 홈 허브 → roster (코드 복사·재발급, 이번 주 롤업, 학생 summary 카드). Worker 에 **CORS allow-list** (`ALLOWED_ORIGINS`, 기본 hangulroute.com 3종 + localhost + workers.dev) — 브라우저(PWA·콘솔)에서 API 호출의 전제 | 단위 web 30 (lane 99.5 %) · backend 104; `next build` 라우트 4개 |
| S3 스페이스 (2026-09-21) | `accounts` / `spaces` / `memberships` + join code (base32 6자, 30일) + 권한 함수 `can()` (교사는 payload 를 받을 경로가 없음) + `/api/spaces` 8 라우트 (F-SPACE-001). 학습자 앱: 설정 "Classes & family" 카드 → `sync/join-space` (코드 → 이름 확인 → 완료, PIN 없음) · Leave. 콘솔 화면은 다음 PR (F-CONSOLE-001) | 단위 backend 99 · mobile 369 · content-schema 30; 게이트 7/7 |
| S1–S2 동기화·복원 (2026-09-21) | 서버 스냅샷 + 결정적 병합 + 30 s 디바운스 클라이언트 (F-SYNC-001/002) · 파일 백업/복원 · **Rescue Code** 자동 발급·복사·공유·재발급·새 기기 claim (F-RESTORE-001). `EXPO_PUBLIC_API_BASE_URL` 이 없으면 전부 조용히 꺼짐 (파일 백업만 동작) | 단위 (mobile 359 · backend 77) + `e2e/web/backup.spec.ts` 파일 왕복. 코드 경로 실기기 확인은 API 연결 후 T-046 에 포함 |

## 2. 오너 작업 — 약 1시간 (Connect GitHub 방식, 2026-09-21 결정)

**A. GitHub 브랜치 보호 (먼저)** — https://github.com/Denny-Hwang/Hangul_Route/settings/branches
- [ ] `main` 규칙: *Require a pull request before merging* + *Require status checks to pass* → `lint · typecheck · test · build`, `Build PWA · offline e2e`, `Measure coverage vs rolling targets` 필수. 이렇게 해야 Cloudflare 가 main 을 배포할 때 항상 테스트 통과본만 나간다.

**B. Cloudflare Workers Builds** — https://dash.cloudflare.com/?to=/:account/workers-and-pages → Create → **Connect GitHub** → `Denny-Hwang/Hangul_Route`
- [ ] Project name: `hangul-route-app` (wrangler.toml 의 `name` 과 동일)
- [ ] Production branch: `main`
- [ ] Root directory: `/` (리포 루트 — pnpm 워크스페이스)
- [ ] Build command: `pnpm install --frozen-lockfile && pnpm --filter @hangul-route/mobile build:web`
- [ ] Deploy command: `pnpm --filter @hangul-route/mobile exec wrangler deploy`
- [ ] Build variables: 없음 (Node 22 는 `.nvmrc`, pnpm 은 `packageManager` 로 자동 감지 — wrangler 4 는 Node ≥ 22 필요)
- [ ] 첫 빌드 성공 → `https://hangul-route-app.<account>.workers.dev` 에서 열어보기
- [ ] PR 프리뷰: 비-프로덕션 브랜치 빌드가 켜져 있으면 PR 마다 프리뷰 URL 댓글이 달린다 (선택)

**C. 도메인** `app.hangulroute.com`
- [ ] `hangulroute.com` 을 Cloudflare DNS 로 (아직이면): https://developers.cloudflare.com/dns/zone-setups/full-setup/
- [ ] Worker → Settings → Domains & Routes → Add → Custom domain `app.hangulroute.com` (DNS 레코드 자동 생성). 또는 `wrangler.toml` 의 `[[routes]]` 주석 해제 후 다음 배포
- [ ] 랜딩의 `NEXT_PUBLIC_APP_URL` 은 기본값이 이 도메인이라 별도 설정 불필요
- [ ] 첫 배포 후 **설치 테스트 3종**: iOS Safari 공유 → 홈 화면에 추가 / Android Chrome 설치 프롬프트 / 데스크톱 Chrome 주소창 설치 아이콘. 각각 아이콘 표시 · standalone 창 · 세로 고정(설치 후) 확인
- [ ] **오프라인 실기기 테스트**: 설치 → 비행기 모드 → 실행 → 퀘스트 1개 완주 → 카드 획득 → 비행기 모드 해제 (텔레메트리 큐는 아직 없음 — §4)

**D. API 연결 (동기화 · Rescue Code · 학급 · 콘솔)** — 지금까지의 서버 기능은 API 주소가 설정될 때만 켜진다 (없으면 앱은 로컬 전용으로 동작)
- [ ] API Worker `hangul-route-api` 배포 (`apps/api`, T-002 — `wrangler deploy`; D1 은 아직 인메모리라 재배포 시 데이터가 사라짐 → F-INFRA-003 전까지 테스트 용도)
- [ ] Worker 변수 `ALLOWED_ORIGINS` = `https://hangulroute.com,https://www.hangulroute.com,https://app.hangulroute.com` (미설정이면 같은 기본값 + localhost + `*.workers.dev`)
- [ ] PWA 빌드 변수 (Workers Builds → Settings → Variables): `EXPO_PUBLIC_API_BASE_URL` = API Worker 주소
- [ ] 랜딩/콘솔 (`apps/web`) 빌드 변수: `NEXT_PUBLIC_API_BASE_URL` = 같은 주소. `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true` 는 **테스트 배포에서만** (Clerk 연결 전 임시 로그인)
- [ ] Clerk 앱 생성 → `wrangler secret put CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (F-AUTH-002 착수 전제, T-049)
- [ ] Lighthouse (Chrome DevTools) PWA/Installable 항목 전부 통과 확인, Performance ≥ 80 (번들 2 MB, 첫 로드 3G 에서 ~6초 예상)

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
