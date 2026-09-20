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
| P3 배포 파이프라인 | `.github/workflows/web-app-deploy.yml`: PR/main 에서 빌드 + 오프라인 E2E + Cloudflare Pages `hangul-route-app` 업로드 (시크릿 있을 때) | 워크플로우 파일 — 첫 실행은 이 PR 의 CI |
| 부수 수정 | 콜드 런치 시 저장소 hydrate 전에 온보딩으로 보내던 버그 (네이티브 공통) — `RootNavigator` 가 hydrate 까지 대기 | E2E 의 오프라인 새로고침 단계가 이 버그를 잡아냄 |

## 2. 오너 작업 — 약 1.5시간

- [ ] **Cloudflare Pages 프로젝트** `hangul-route-app` 생성 (Framework preset: None, build output `apps/mobile/dist` — 빌드는 GitHub Actions 가 함, Pages 는 업로드만)
- [ ] 리포 시크릿 `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` 등록 → `web-app-deploy.yml` 이 자동 업로드 시작 (기존 `preview-deploy.yml` 과 같은 시크릿)
- [ ] 커스텀 도메인 **`app.hangulroute.com`** → Pages 프로젝트에 연결 (서브도메인 권장: SW scope 가 `/` 전체라 랜딩 Next.js 와 분리)
- [ ] 랜딩 (`apps/web`) 히어로 CTA 를 "Play in your browser → https://app.hangulroute.com" 으로 (별도 PR)
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
| 저장소 | AsyncStorage | IndexedDB + persist() 요청. iOS 는 홈 화면에 추가하지 않으면 7일 미사용 시 삭제 가능 | 설치 안내 (`pwa/install-guide` 와이어프레임, 미구현) + 향후 Rescue Code |
| 업데이트 | 스토어 | "New lessons are ready — Refresh" 배너, 사용자가 누를 때만 적용 (퀘스트 중 강제 새로고침 없음) | — |

## 4. 아직 안 한 것 (다음 PR 후보, 우선순위순)

1. **T-017 자모 MP3 30개** → 프리캐시에 포함하면 오프라인 발음 보장 (0.5 d 코드 + 녹음)
2. `pwa/install-guide` 화면 (iOS 공유시트 안내 오버레이) — 와이어프레임 있음 (1 d)
3. 텔레메트리 오프라인 큐 (`platform/telemetry` 에 storage 기반 큐 + `online` flush) (0.5 d)
4. 카드 공유 웹 구현 (SVG → PNG → Web Share) (1 d)
5. 데스크톱 레이아웃: 현재는 폰 폭 그대로 늘어남 → max-width 셸 + 배경 (0.5 d, 시안 필요)
6. 랜딩 CTA + `web/index.html` OG 메타 (0.5 d)
