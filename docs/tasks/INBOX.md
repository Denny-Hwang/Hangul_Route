# INBOX

대기 중인 태스크. 상단이 우선순위 높음. R1 Daily Task Runner 가 매일 최상단 1건을 DOING 으로 이동한다.

## 포맷
```
- [ ] T-XXX <F-링크> <요약> — <예상 시간>
```

## Pending

### Week 2 (foundations) — remaining
- [ ] T-002 F-INFRA-001 wrangler dev 로컬 기동 + Cloudflare 계정 바인딩 — 0.5d

### Week 4 (Stage 1 game shells)
- [ ] T-013 STT 벤치마크 보고서: Whisper / Clova / Google STT × 어린이 한국어 50샘플 — 2d
- [ ] T-015 i18n / a11y / telemetry 3종 스펙 초안 (F-I18N-001, F-A11Y-001, F-TEL-001) — 1d

### 웹앱 런치 (주 채널 — 오너 작업, `docs/launch/web-app-launch.md` §2)
- [ ] T-045 GitHub main 브랜치 보호(필수 체크 3개) + Cloudflare **Connect GitHub** (Workers Builds, 설정값은 `web-app-launch.md` §2-B) + `app.hangulroute.com` 연결 — 1h
- [ ] T-046 설치 테스트 3종 (iOS Safari / Android Chrome / 데스크톱) + 실기기 오프라인 완주 — 0.5h
- [ ] T-047 Lighthouse PWA 항목 통과 확인 — 0.25h
- [ ] T-050 API 연결 (`web-app-launch.md` §2-D): `hangul-route-api` 배포 + `ALLOWED_ORIGINS` + PWA `EXPO_PUBLIC_API_BASE_URL` + 웹 `NEXT_PUBLIC_API_BASE_URL` — 0.5h
- [ ] T-051 Stripe 설정 (`web-app-launch.md` §2-D, 가격 결정 후): 가격 6개 + `STRIPE_PRICE_*`/`CONSOLE_URL` vars + `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` 시크릿 + 웹훅 등록 — 1h
- [ ] T-049 Clerk 앱 생성 → `CLERK_SECRET_KEY` 시크릿 + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (F-AUTH-002 전제; 그 전까지 콘솔은 dev 로그인) — 0.5h

### App Store 제출 (선택 — 나중, `docs/launch/app-store-submission.md`)
- [ ] T-040 Apple Developer + App Store Connect 앱 레코드 + `eas init` → `app.json` projectId / `eas.json` submit 값 교체 — 1h
- [ ] T-041 hangulroute.com Pages 라이브 + `/privacy` `/about` 200 확인, EFFECTIVE_DATE 갱신 — 0.5h
- [ ] T-042 `eas build --profile production` → TestFlight 3기기 D-1 QA (submission §4 목록) — 2h
- [ ] T-043 스크린샷 15장 (6.9" · 6.5" · iPad 13") — `app-store-metadata.md` §5 · `design/brief/launch-assets.md` §4 — 2h
- [ ] T-044 App Store Connect 메타데이터·Privacy Label·Review Notes 입력 → Submit — 1h

### Follow-ups
- [ ] T-017 F-001 외부 의존: 30 개 jamo 음성 MP3 녹음 (24 자모 + 6 받침, 단일 native speaker) — 1d **← 웹 오프라인 발음 보장의 전제 (web-app-launch §3), 우선순위 상향**

### Week 5–6 (Homework · Reviews · Profiles — addendum 09)

> 부록 `docs/blueprints/09-homework-review-profiles-addendum.md` 의 5개 F-XXX 를 큐잉.
> 의존성 순서: F-PROF-001 → F-HW-001 → F-RVW-001 → F-PAR-001 → (Phase 2) F-TCH-001.

- [ ] T-026 F-PROF-001 onboarding flow + 마이그레이션 ("Default" 학습자 래핑) E2E — 1d
- [ ] T-030 F-RVW-001 draft → ready: ReviewAttempt / ReviewItem zod + Stage 1 item seed (`content/reviews/stage-1.json`) — 1d
- [ ] T-031 F-RVW-001 engine: star-calc / daily-pool / stage-balance + 단위 테스트 100% — 1.5d
- [ ] T-032 F-RVW-001 Daily Test player + Feedback Review tail (Quest 통합) — 1d
- [ ] T-033 F-RVW-001 Stage Review + Stage Certificate + collection wall — 1.5d
- [ ] T-034 F-PAR-001 draft → ready: WeekSummary / Suggestion / ParentMessage 스키마 — 0.5d
- [ ] T-035 F-PAR-001 Dashboard 카드 + suggestion 룰 테이블 (max 3) — 1d
- [ ] T-036 F-PAR-001 N5 voice message recorder (≤ 10 s, queue depth 1) — 0.5d
- [ ] T-037 F-CNT-001 확장: caregiver-surface 금칙어 (`behind`, `falling behind`, `should have`, `missed too many`, `compared to`) — 0.5d
- [ ] T-038 F-TCH-001 placeholder: Profile role enum 에 `teacher` / `co-parent` 예약 (Phase 2 UI 미구현, 데이터 모델만) — 0.25d

### Phase 2 (post-MVP — schedule placeholder)
- [ ] T-P2-01 F-PAR-001 explicit homework assignment 와이어업 (suggestion 탭 → F-HW-001 assignment 생성) — 1d
- [ ] T-P2-02 F-TCH-001 Class create + 6-digit join code (web + mobile) — 3d
- [ ] T-P2-03 F-INFRA-004 D1 sync — 프로필 / 진도 / homework / review aggregate — 3d
- [ ] T-P2-04 Clerk 통합 (teacher onboarding) — 2d
