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
- [ ] Lighthouse (Chrome DevTools) PWA/Installable 항목 전부 통과 확인, Performance ≥ 80 (번들 2 MB, 첫 로드 3G 에서 ~6초 예상)

## 3. 웹에서 다른 점 (사용자 안내용)

| 항목 | 네이티브 | 웹 | 조치 |
|---|---|---|---|
| 발음 | expo-speech TTS | 브라우저 speechSynthesis — 한국어 보이스는 iOS Safari·Android Chrome 은 보통 있음, PC 는 기기마다 다름. 오프라인 보장 없음 | **T-017 자모 MP3** 가 근본 해법 (INBOX 최상단으로) |
| 카드 공유 | 공유시트 | 버튼 숨김 (view-shot 미지원) | 후속: SVG → canvas → Web Share (roadmap §2) |
| 햅틱 | 있음 | Android 만 진동, iOS 없음 | 없음 (선택적 피드백) |
| 퀘스트 나가기 확인 | 네이티브 Alert | 브라우저 confirm() | 후속: 토큰 스타일 시트로 교체 |
| 저장소 | AsyncStorage | IndexedDB + persist() 요청. iOS 는 홈 화면에 추가하지 않으면 7일 미사용 시 삭제 가능 | 설치 안내 시트 (F-PWA-001, 구현됨) + 향후 Rescue Code |
| 데스크톱 | — | 폰 폭 컬럼 중앙 정렬 (600px+) | 가로 레이아웃 시안은 별도 |
| 업데이트 | 스토어 | "New lessons are ready — Refresh" 배너, 사용자가 누를 때만 적용 (퀘스트 중 강제 새로고침 없음) | — |

## 4. 아직 안 한 것 (다음 PR 후보, 우선순위순)

1. **T-017 자모 MP3 30개** → 프리캐시에 포함하면 오프라인 발음 보장 (0.5 d 코드 + 녹음)
2. ~~`pwa/install-guide` 화면~~ (F-PWA-001, 2026-09-21 완료 — 3회째 열 때 시트, 5회 스누즈, 설정에서 강제 표시)
3. ~~텔레메트리 오프라인 큐~~ (F-PWA-001, 2026-09-21 완료 — 200개 캡, online/시작 시 flush, 4xx 는 폐기)
4. 카드 공유 웹 구현 (SVG → PNG → Web Share) (1 d)
5. ~~데스크톱 레이아웃 max-width 셸~~ (2026-09-21 완료 — 가로 전용 시안은 별도)
6. ~~랜딩 CTA~~ (2026-09-21 완료) · `index.html` OG 메타 (0.25 d)
