# App Store 제출 체크리스트 — v1.0.0 (build 1)

> 이 문서가 끝나면 "Submit for Review" 버튼만 남는다.
> 저장소에서 할 수 있는 것은 전부 끝냈고 (아래 §1), 나머지는 **Apple 계정·기기·스크린샷**이 필요한 오너 작업이다 (§2–§6).
> 메타데이터 원문은 `app-store-metadata.md`, 스크린샷 프레임 프롬프트는 `design/brief/launch-assets.md` §4.

---

## 1. 저장소에서 끝낸 것 (2026-09-19)

| 항목 | 위치 | 상태 |
|---|---|---|
| 앱 버전 `1.0.0` · iOS `buildNumber 1` · Android `versionCode 1` | `apps/mobile/app.json` | ✅ |
| 번들 ID `com.hangulroute.app` (iOS/Android 동일) | `app.json` | ✅ |
| 아이콘 1024², 어댑티브 아이콘, 스플래시 1284×2778 | `apps/mobile/assets/` (#54) | ✅ |
| 암호화 수출 규정: `ITSAppUsesNonExemptEncryption = false` | `app.json` → `ios.config.usesNonExemptEncryption` | ✅ (제출 시 질문 생략됨) |
| iOS Privacy Manifest (`PrivacyInfo.xcprivacy`): tracking 없음, 수집 데이터 = Product Interaction (미연결·비추적·분석 목적), Required-Reason API 4종 | `app.json` → `ios.privacyManifests` | ✅ |
| Android: 권한 최소화, `RECORD_AUDIO` 명시 차단 (VoiceEcho 플래그 OFF) | `app.json` → `android.blockedPermissions` | ✅ |
| 깨진 config plugin 제거 (`expo-status-bar` 는 플러그인이 아님 → `expo config`/EAS 빌드 실패 원인) | `app.json` | ✅ `npx expo config` 통과 |
| EAS 빌드/제출 프로필 (`development` · `preview` · `production` autoIncrement) | `apps/mobile/eas.json` | ✅ placeholder 3개는 §2 |
| 프로덕션 크래시 가드 (`OopsScreen` + `react-error-boundary`) | `apps/mobile/App.tsx` | ✅ |
| Kids Category 요건: 부모 게이트 (PIN, F-PROF-001 §10), 외부 링크 0건, 서드파티 광고/분석 SDK 0건, 앱 내 구매 UI 없음 | 코드 grep + #61 | ✅ |
| 구매 언급 제거 ("Subscribe…" → "More stages are on the way") — 존재하지 않는 IAP 언급은 Guideline 2.3.1/3.1.1 리젝 사유 | `ProfileScreen` | ✅ |
| 개인정보처리방침 / 이용약관 페이지 | `apps/web` `/privacy` · `/terms` | ✅ 코드 존재 — **URL 라이브는 §3** |
| 텔레메트리: 엔드포인트 미설정 시 네트워크 0 (`EXPO_PUBLIC_API_BASE_URL`) | `platform/telemetry.ts` | ✅ |
| 테스트·타입·린트·빌드·커버리지 게이트 | CI (#61 green) | ✅ |

---

## 2. 오너 사전 준비 (계정) — 약 1시간

- [ ] **Apple Developer Program** 가입 ($99/yr) → Team ID 확보
- [ ] **App Store Connect** 에서 앱 레코드 생성: Bundle ID `com.hangulroute.app`, SKU `hangul-route-ios`, 이름 `Hangul Route`
- [ ] **EAS**: `npm i -g eas-cli && eas login && cd apps/mobile && eas init` → 출력된 projectId 로 `app.json` 의 `extra.eas.projectId` 교체
- [ ] `eas.json` `submit.production.ios` 의 `appleId` / `ascAppId` / `appleTeamId` 교체 (커밋 금지: `eas secret` 또는 로컬 전용)
- [ ] (Android, 선택) Google Play Console 앱 생성 + 서비스 계정 JSON → `apps/mobile/google-play-service-account.json` (gitignore 됨)

## 3. 웹 URL 라이브 — 약 30분

- [ ] `hangulroute.com` DNS → Cloudflare Pages (`preview-deploy.yml` 이 이미 빌드; `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` 시크릿 등록)
- [ ] 다음 3개 URL 이 200 을 반환하는지 확인 — App Store Connect 필수 입력:
  - Privacy Policy: `https://hangulroute.com/privacy`
  - Support: `https://hangulroute.com/about` (또는 mailto)
  - Marketing (선택): `https://hangulroute.com`
- [ ] `docs/launch/product-review-2026-06-09.md` P0 "COPPA 문서 draft" 항목: `/privacy` 의 EFFECTIVE_DATE 를 제출일로 갱신하고 실 도메인 이메일로 교체

## 4. 빌드 → TestFlight — 약 1시간 (대기 포함)

```bash
cd apps/mobile
eas build --platform ios --profile production      # 클라우드 빌드, ~15–25분
eas submit --platform ios --profile production     # TestFlight 업로드
```

- [ ] TestFlight 내부 테스터 3기기 (iPhone 소형 · iPhone 대형 · iPad) 설치
- [ ] **D-1 QA 패스** (launch-checklist D-1): 온보딩 3회 + 미니게임 8종 각 1회 + 아래 신규 경로
  - [ ] Grown-up zone 첫 진입 → PIN 설정 → 2회째 진입 → PIN 검증 → 5회 오답 → 30초 쿨다운 표시
  - [ ] 퀘스트 좌상단 ✕ → "Leave this quest?" → Leave → 에피소드 페이지
  - [ ] 게임 전부 Skip → 결과 "All done!" + 별 0 + 카드 없음 + 에피소드에서 퀘스트 다시 Start 가능
  - [ ] Homework: 배정 없을 때 "All clear!" 카드, 있을 때 행 탭 → 퀘스트
  - [ ] 설정 Sound Off → 자모 TTS 무음, On → 복귀
  - [ ] 카드 Share → 공유시트 / 취소 → 무반응
  - [ ] 비행기 모드에서 위 전부 동작 (오프라인)
  - [ ] 강제 크래시 확인이 필요하면 dev 빌드에서 `throw` 후 OopsScreen → Try again
- [ ] iPad: 세로 고정 + 레이아웃 깨짐 없음 (supportsTablet = true 이므로 iPad 스크린샷 필수)

## 5. 스토어 메타데이터 입력 — 약 1시간

`app-store-metadata.md` 의 텍스트를 그대로 붙여넣는다.

- [ ] 이름 / 부제 / 프로모션 텍스트 / 설명 / 키워드 / What's New
- [ ] 카테고리: **Primary = Education**, Secondary = Kids
- [ ] **Kids Category 연령대 = Ages 6–8** (한 구간만 선택 가능. 5세와 9–11세는 설명·스크린샷에서 "ages 5–11" 로 커버. 근거: Stage 1 = 자모 = 프리리더 핵심 층)
- [ ] 연령 등급 설문: 전부 "None" → **4+**
- [ ] App Privacy (Nutrition Label):
  - Data Not Linked to You → **Product Interaction** (Analytics) — 텔레메트리 이벤트 (프로필 id 는 기기 로컬 난수, 계정 없음)
  - 그 외 수집 없음. 부모 이메일은 **기기에만 저장·전송 안 함** → "수집" 아님 (Apple 정의: 기기 밖으로 나가야 수집). v1 에서 Clerk/동기화가 켜지면 이 라벨을 다시 제출한다.
  - Tracking: **No**
- [ ] 스크린샷 (필수 세트 2 + iPad):
  - iPhone 6.9" (1320×2868) 5장 · iPhone 6.5" (1284×2778) 5장 · iPad 13" (2064×2752) 5장
  - 구성은 `app-store-metadata.md` §5, 프레임 프롬프트는 `design/brief/launch-assets.md` §4
- [ ] App Review Information:
  - Sign-in required: **No** (계정 없음)
  - Notes: `app-store-metadata.md` §6 붙여넣기 (PIN 은 사전 설정값 없음 — 리뷰어가 처음 만든다는 점 명시)
  - 연락처: 실명 · 전화 · 이메일
- [ ] Content Rights: 서드파티 콘텐츠 없음 (일러스트 자체 제작, 공공누리 이미지 미사용)
- [ ] Export Compliance: 자동 (usesNonExemptEncryption = false)

## 6. 제출 직전 게이트 (Guideline 대조)

| Guideline | 확인 |
|---|---|
| 1.3 Kids Category | 부모 게이트 ✅ · 외부 링크 없음 ✅ · 서드파티 분석/광고 없음 ✅ · 자체 텔레메트리는 개인정보 미포함 ✅ |
| 2.1 완성도 | 크래시 가드 ✅ · 데드엔드 화면 0 (#61) ✅ · placeholder 텍스트 0 ✅ |
| 2.3 정확한 메타데이터 | 스크린샷 = 실제 화면 · "9 mini-games" 가 아니라 **8 active** 로 표기 (product-review §"카피 수치 정합성") |
| 3.1.1 IAP | 구매 없음, 구매 언급 없음 ✅ |
| 5.1.1 데이터 수집 | 온보딩 동의 체크박스 + 부모 이메일 선택 ✅ · Privacy Policy URL 라이브 (§3) |
| 5.1.4 Kids 데이터 | 이메일·이름은 기기 저장, 전송 없음 ✅ |
| Privacy Manifest | `ios.privacyManifests` ✅ (Expo SDK 52 가 라이브러리 manifest 를 병합) |

전부 체크되면 **Submit for Review**. 첫 심사는 통상 24–48 h.

---

## 7. 이번 v1.0 에서 의도적으로 뺀 것 (심사 리스크 0 유지)

- 구독/IAP (F-SUB-002, F-ENT-001) — 1.1 에서 StoreKit 과 함께
- 클라우드 동기화 · Rescue Code (roadmap S1–S2) — 켜는 순간 Privacy Label 재제출
- VoiceEcho STT — 플래그 OFF, 마이크 권한 차단
- 웹 PWA (roadmap P0–P3) — 스토어와 독립, 별도 트랙
- 교사 콘솔 (S3–S7)
