# Web App (PWA) + Offline — 구상안

**Status**: `proposal` (roadmap → 승인 시 F-WEB-001 / F-PWA-001 / F-INFRA-005 로 분해)
**작성일**: 2026-09-19
**질문**: "iPhone 앱으로 만든 것을 동일 기능의 웹앱으로 배포할 수 있나? 한 번 받으면 인터넷 없이도 학습되게."

---

## 0. 결론 (TL;DR)

**가능하다. 그것도 거의 그대로.** 별도 앱을 새로 짜는 것이 아니라, 지금의 `apps/mobile` (Expo React Native) 코드베이스를 **Expo Web (react-native-web)** 으로 그대로 빌드해 정적 사이트로 내보내고, 그 위에 **PWA 껍데기 (manifest + service worker)** 를 씌우는 방식이다.

| 항목 | 현재 (iOS/Android 네이티브) | 제안 (Web PWA) |
|---|---|---|
| 코드베이스 | `apps/mobile` | **동일** — 화면 25개 / 미니게임 10개 재사용 |
| 진입 | App Store / TestFlight | URL 1개 (`app.hangulroute.com`) + "홈 화면에 추가" |
| 대상 기기 | iPhone/iPad (+ Android) | 폰 · 태블릿 · Chromebook · PC — 브라우저만 있으면 |
| 오프라인 | 기본 오프라인 | 첫 방문 후 오프라인 (service worker 프리캐시) |
| 결제 | App Store IAP (F-IAP-001) | Stage 1 무료라 MVP 에 결제 불필요. 후에 Stripe |
| 배포 | EAS build + 스토어 심사 | `git push` → Cloudflare Pages, 심사 없음 |
| 비용 | Apple 개발자 $99/yr + 30% 수수료 | Cloudflare Pages 무료 티어 |

**왜 지금 코드가 웹으로 잘 옮겨지는가** — 조사 결과 앱이 이미 *local-first* 로 설계되어 있다.

- 콘텐츠(자모·에피소드·퀘스트·카드 30장)가 전부 **번들된 TS 상수** (`apps/mobile/src/content/`, 64 KB). 네트워크에서 받아오는 것이 없다.
- 진도/프로필은 `platform/storage.ts` 래퍼를 거쳐 AsyncStorage 에만 저장. `@tanstack/react-query` 는 설치만 되어 있고 **실제 사용처 0건**.
- 서버 호출은 `platform/telemetry.ts` 의 fire-and-forget POST 뿐 (실패해도 게임은 진행).
- 에셋은 PNG 3장 (512 KB). 발음은 `expo-speech` TTS (MP3 는 T-017 대기).
- `app.json` 에 이미 `"web": { "bundler": "metro", "output": "static" }` 과 `pnpm web` 스크립트가 있다 — 단, `react-native-web` / `react-dom` 이 아직 의존성에 없다.
- 네이티브 전용 API 는 전부 `apps/mobile/src/platform/` 7개 파일 뒤에 격리되어 있다 (CLAUDE.md §8 규칙 덕분). 웹 대응은 이 폴더 안의 `.web.ts` 변형으로 끝난다.

---

## 1. 아키텍처

```
                     ┌──────────────────────────────┐
  git push main ───▶ │ GitHub Actions               │
                     │  expo export --platform web  │
                     │  + workbox generateSW        │
                     └──────────────┬───────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │ Cloudflare Pages (static)    │
                     │  app.hangulroute.com         │
                     │  ├─ index.html + JS bundle   │
                     │  ├─ manifest.webmanifest     │
                     │  ├─ sw.js (precache list)    │
                     │  └─ assets/ (icons, audio)   │
                     └──────────────┬───────────────┘
              첫 방문 (온라인)       │
                                    ▼
                     ┌──────────────────────────────┐
                     │ 브라우저 (아이 기기)            │
                     │  Cache Storage ← 앱 전체 복사  │
                     │  IndexedDB     ← 프로필/진도   │
                     │  홈 화면 아이콘 (standalone)   │
                     └──────────────┬───────────────┘
              이후 (오프라인 OK)     │
                                    ▼
                  학습 · 미니게임 · 카드 수집 전부 로컬
                  텔레메트리는 큐에 쌓였다가 온라인 복귀 시 flush
```

### 1.1 기존 `apps/web` (Next.js) 과의 관계

`apps/web` 은 랜딩 · 부모 대시보드 · 디자인 프리뷰용이고, 디자인 시스템에서 **토큰만** 가져다 쓴다 (F-PREV-001 §"No React Native component imports"). 학습 앱을 Next.js 로 다시 짜면 25개 화면을 두 벌 유지하게 되므로 **하지 않는다**.

| 도메인 | 앱 | 역할 |
|---|---|---|
| `hangulroute.com` | `apps/web` (Next.js) | 랜딩, FAQ, 부모 대시보드, "Play now" CTA |
| `app.hangulroute.com` | `apps/mobile` → Expo Web export | **학습 앱 본체 (PWA)** |
| `api.hangulroute.com` | `apps/api` (Workers) | 텔레메트리, 구독, 동기화 (후속) |

> 디렉토리 이름 `apps/mobile` 이 어색해지지만 (웹도 여기서 나옴) 구조 변경은 CLAUDE.md §2 승인 사항이라 **이번 제안에서는 이름을 유지**한다. 별도 세션에서 `apps/learner` 등으로 rename 하는 안을 제안할 수 있다.

---

## 2. 플랫폼 래퍼 — 웹 대응표

`apps/mobile/src/platform/` 의 파일별로 웹에서 어떻게 되는지. Metro 는 `foo.web.ts` 가 있으면 웹 빌드에서 자동으로 그것을 고른다.

| 래퍼 | 네이티브 구현 | 웹에서 | 할 일 |
|---|---|---|---|
| `storage.ts` | AsyncStorage | AsyncStorage 의 웹 백엔드 = `localStorage` (5 MB, 동기, iOS 7일 evict 위험) | **`storage.web.ts` → IndexedDB** (`idb-keyval`). 동일 `readJson/writeJson/removeKey/listKeys` 시그니처 유지. 진도 스냅샷은 프로필당 수 KB 라 여유 충분 |
| `audio.ts` | expo-speech (TTS) | `speechSynthesis` — 한국어 보이스는 iOS Safari(유나) · Android Chrome(Google 한국어) 에 있으나 **오프라인 보장 없음**, Chromebook/PC 는 기기마다 다름 | `audio.web.ts`: `ko-KR` 보이스 선택 → 없으면 MP3. **T-017 (자모 MP3 30개) 가 오프라인 발음의 진짜 해법**이므로 우선순위 상향. MP3 는 프리캐시 대상 |
| `haptics.ts` | expo-haptics | iOS Safari 진동 불가, Android `navigator.vibrate` | `haptics.web.ts`: `vibrate` 있으면 10 ms, 없으면 no-op. 앱이 이미 햅틱을 선택적으로 취급하므로 UX 영향 없음 |
| `crypto.ts` | expo-crypto | expo-crypto 웹은 WebCrypto 로 동작 | 변경 없음. PIN 해시 테스트로 확인만 |
| `sharing.ts` | expo-sharing + react-native-view-shot | **view-shot 은 웹 미지원** | `sharing.web.ts`: 카드는 이미 SVG(F-CARD-001) 이므로 SVG → `<canvas>` → PNG blob → Web Share API (`navigator.share({files})`, iOS 15+/Android) → 미지원 시 다운로드 링크 |
| `motion.ts` | AccessibilityInfo | react-native-web 이 `prefers-reduced-motion` 으로 매핑 | 변경 없음 |
| `telemetry.ts` | fetch | 동일 | **오프라인 큐** 추가: 실패/오프라인 시 storage 에 append, `online` 이벤트에 flush. (Background Sync 는 Chrome 계열만이라 옵션) |

### 2.1 라이브러리 웹 호환

| 라이브러리 | 웹 | 비고 |
|---|---|---|
| react-native-reanimated 3 | ✅ | 카드 뒤집기 · 별 팝인 (F-MOTION-*) 그대로 |
| react-native-gesture-handler | ✅ | TraceStroke 의 `Gesture.Pan()` 은 pointer events 로 동작. 캔버스에 `touch-action: none` 필요 (스크롤/pull-to-refresh 가로채기 방지) |
| react-native-svg | ✅ | Hoya · 카드 아트 · 자모 획 전부 SVG |
| @react-navigation/* | ✅ | URL 연동 (linking) 은 선택 — 오프라인 딥링크에도 유용 |
| react-native-safe-area-context | ✅ | `viewport-fit=cover` 메타 필요 |
| react-native-view-shot | ❌ | 위 `sharing.web.ts` 로 대체 |
| expo-av | — | VoiceEcho 는 placeholder 이고 플래그 OFF (`voiceEchoEnabled: false`). 웹에선 Web Speech API 로 STT 시도 가능하나 이 제안 범위 밖 |

---

## 3. "한 번 받으면 오프라인" — 실제 동작 설계

### 3.1 무엇을 캐시하나

| 자산 | 크기 (추정) | 캐시 전략 |
|---|---|---|
| JS 번들 (RN web + 앱) | ~1.5 MB (gzip ~450 KB) | 프리캐시 (설치 시) |
| 콘텐츠 (번들 내 TS 상수) | 64 KB | 번들에 포함 — 별도 없음 |
| 아이콘 · 스플래시 | 512 KB | 프리캐시 |
| 자모 MP3 30개 (T-017 이후) | ~600 KB | 프리캐시 (Stage 1 이 전부이므로) |
| 향후 에피소드 오디오/일러스트 | 에피소드당 1–3 MB | 런타임 캐시 + "Download for offline" 버튼 (Phase 4) |

Stage 1 전체가 **5 MB 미만** 이므로 "다운로드 버튼" 없이 **첫 로딩 = 전체 설치** 로 충분하다. 사용자 관점 흐름:

1. 부모가 `app.hangulroute.com` 을 연다 (온라인).
2. 서비스 워커가 백그라운드에서 전체를 캐시. 완료 시 Hoya 말풍선: **"All set! You can play without Wi-Fi now."**
3. 브라우저가 "홈 화면에 추가" 를 제안 (Android/Chrome 은 자동 프롬프트, iOS 는 Safari 공유 → Add to Home Screen 안내 오버레이).
4. 이후 아이콘으로 실행 → 주소창 없는 standalone 창, 비행기 모드에서도 전 기능.

### 3.2 업데이트

- SW 는 `stale-while-revalidate`: 캐시로 즉시 뜨고, 뒤에서 새 버전 체크.
- 새 버전 감지 시 학습 도중 강제 새로고침 금지. 홈 화면 상단에 조용한 배너 **"New lessons ready — tap to refresh"** (Hoya 톤). 퀘스트 진행 중엔 결과 화면까지 대기.
- 콘텐츠 버전은 `content/index.ts` 에 `CONTENT_VERSION` 상수로 노출 → 진도 스냅샷에 기록 (이후 마이그레이션 근거).

### 3.3 저장소 신뢰성 (아이 진도가 날아가면 안 됨)

| 위험 | 대응 |
|---|---|
| iOS Safari: **홈 화면에 추가하지 않은** 사이트는 7일 미사용 시 스크립트 저장소 삭제 | (a) 설치 유도 UI (설치된 PWA 는 면제) (b) `navigator.storage.persist()` 요청 (c) 부모 대시보드 "Back up progress" — 진도 JSON 내보내기/가져오기 (오프라인에서도 되는 최소 백업) |
| 브라우저 데이터 삭제 | 위 (c) + Phase 4 계정 동기화 (T-P2-03 D1 sync) |
| localStorage 5 MB 한도 | IndexedDB 로 전환 (§2) |

### 3.4 아이용 브라우저 UX 손질

- `overscroll-behavior: none` (pull-to-refresh 로 퀘스트 날아감 방지), `user-select: none` (타일 길게 누를 때 텍스트 선택 방지), 게임 캔버스 `touch-action: none`.
- 핀치 줌은 **막지 않는다** (접근성). 대신 레이아웃을 폰 세로 기준 최대폭(≈ 430 dp) 으로 고정하고 태블릿/PC 에선 중앙 정렬 + 배경 일러스트로 여백 처리.
- 터치 타깃 64 dp 규약(component-skill) 은 마우스/트랙패드에서도 그대로 유리.
- 세로 고정: manifest `orientation: portrait` (설치 후에만 적용됨. 브라우저 탭에선 가로일 때 "Turn your device" Hoya 화면).

---

## 4. 단계별 실행안

| Phase | 내용 | 산출물 | 예상 |
|---|---|---|---|
| **P0 스파이크** | `react-native-web`, `react-dom`, `@expo/metro-runtime` 추가 → `expo export --platform web` → 부팅. 깨지는 목록 작성 | 스파이크 리포트 (`docs/roadmap/` 갱신) | 0.5–1 d |
| **P1 웹 패리티** (F-WEB-001) | §2 의 `.web.ts` 5개 + IndexedDB storage + 반응형 셸 + viewport/safe-area 메타. 각 래퍼는 platform 레인 테스트 (70%) | 10개 미니게임 전부 브라우저에서 플레이 가능 | 3–4 d |
| **P2 PWA 오프라인** (F-PWA-001) | `manifest.webmanifest` (아이콘은 `assets/icon.png` 재활용, theme color 는 토큰), Workbox `generateSW` 후처리 스크립트 (`scripts/`), 오프라인 준비 토스트, 업데이트 배너, 설치 안내 오버레이, 텔레메트리 큐, `storage.persist()` | 비행기 모드에서 Stage 1 완주 (Playwright offline 테스트로 증명) | 2–3 d |
| **P3 배포** (F-INFRA-005) | `.github/workflows/app-deploy.yml`: `apps/mobile/**` 변경 시 PR 프리뷰 + main 머지 시 프로덕션 → Cloudflare Pages `hangul-route-app`. Lighthouse PWA 점검을 CI 에 추가. `apps/web` 랜딩 CTA "Play in your browser" | `app.hangulroute.com` 라이브 | 1 d |
| **P4 후속** | Stripe Checkout (웹용 F-IAP-002), Clerk 웹 세션, D1 진도 동기화 (T-P2-03) 를 오프라인 큐 위에 얹기, 에피소드별 "Download" 팩, 네이티브 빌드는 같은 코드로 유지 (스토어 병행) | — | 별도 산정 |

P0–P3 합계 **약 7–9 일**. 이 안이 채택되면 F-WEB-001 / F-PWA-001 / F-INFRA-005 를 `docs/specs/` 에 `draft` 로 만들고 T-XXX 로 INBOX 에 큐잉한다.

---

## 5. 트레이드오프 / 솔직한 한계

- **발견성**: App Store 검색이 없다. 대신 한글학교·부모 커뮤니티 (docs/launch/reddit-seeding.md) 에 URL 하나로 배포되므로 이 프로젝트의 채널과는 오히려 맞는다.
- **iOS 설치 마찰**: Safari 의 "Add to Home Screen" 은 자동 프롬프트가 없다. 부모가 1회 해줘야 한다. 5–11세 아이가 직접 하긴 어렵다 → 온보딩 "부모 손" 단계에 넣는다.
- **오프라인 TTS 는 보장 불가**: 브라우저 `speechSynthesis` 는 기기 보이스에 의존. **MP3 자산(T-017) 없이는 "오프라인에서 발음 재생" 을 약속하면 안 된다.** 이 제안의 선결 조건.
- **햅틱 없음 (iOS 웹)**: 성공 진동 등 촉각 피드백이 빠진다. 시각/청각 피드백으로 이미 대체되어 있어 치명적이지 않다.
- **카드 공유**: 네이티브 공유시트만큼 매끄럽지 않다 (일부 데스크톱 브라우저는 다운로드로 대체).
- **Chromebook/PC 에서 세로 레이아웃**: 화면의 절반이 빈다. P1 에서 배경 처리로 흡수하지만, 가로 레이아웃 최적화는 별도 디자인 작업 (wireframe-skill).
- **네이티브를 버리는 것이 아님**: Expo 라서 같은 코드로 iOS/Android 빌드는 계속 나온다. "웹 우선, 스토어는 뒤에" 로 순서만 바꾸는 제안이다.

---

## 6. 열린 질문 (승인 시 결정)

1. 도메인: `app.hangulroute.com` 서브도메인 vs `hangulroute.com/app` 경로 (후자는 Next.js 와 SW scope 충돌 주의 → 서브도메인 권장).
2. `apps/mobile` 디렉토리 rename 여부 (`apps/learner`?) — 구조 변경이라 별도 승인.
3. 웹 텔레메트리 동의: COPPA 카피 (docs/launch/product-review-2026-06-09.md) 를 웹 첫 화면에도 노출할지.
4. T-017 (자모 MP3 녹음) 을 P1 앞으로 당길지 — 오프라인 발음 약속의 전제.
