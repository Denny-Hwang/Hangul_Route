# INBOX

대기 중인 태스크. 상단이 우선순위 높음. R1 Daily Task Runner 가 매일 최상단 1건을 DOING 으로 이동한다.

## 포맷
```
- [ ] T-XXX <F-링크> <요약> — <예상 시간>
```

## Pending

### Week 2 (foundations) — remaining
- [ ] T-002 F-INFRA-001 wrangler dev 로컬 기동 + Cloudflare 계정 바인딩 — 0.5d

### Week 3 (remaining tooling)
- [ ] T-021 F-COV-002 `docs/tests/coverage-targets.md` ↔ `coverage-targets.json` drift 검출 — 0.5d
- [ ] T-022 F-COV-003 apps/mobile business / platform 2-lane 분리 (`src/logic/` vs `src/platform/`) — 1d

### Week 4 (Stage 1 game shells)
- [ ] T-011 F-003 "Build a Letter" minigame spec (Stage 1 family Construction) — 0.5d
- [ ] T-012 F-004 "Trace Stroke" minigame spec (Stage 1 family Construction, 약식) — 0.5d
- [ ] T-013 STT 벤치마크 보고서: Whisper / Clova / Google STT × 어린이 한국어 50샘플 — 2d
- [ ] T-014 Parent dashboard wireframe v0 (4 screens) — 1d
- [ ] T-015 i18n / a11y / telemetry 3종 스펙 초안 (F-I18N-001, F-A11Y-001, F-TEL-001) — 1d

### Follow-ups
- [ ] T-016 packages/content-schema 의 Quest / Card / Episode zod schema 첫 구현 (sanity.test.ts 를 실제 스키마 테스트로 확장) — 1d
- [ ] T-017 F-001 외부 의존: 30 개 jamo 음성 MP3 녹음 (24 자모 + 6 받침, 단일 native speaker) — 1d
- [ ] T-018 apps/api ↔ @hangul-route/backend 통합 (현재 apps/api 의 라우트가 직접 정의됨; backend 패키지로 핸들러 이전) — 0.5d

### Week 5–6 (Homework · Reviews · Profiles — addendum 09)

> 부록 `docs/blueprints/09-homework-review-profiles-addendum.md` 의 5개 F-XXX 를 큐잉.
> 의존성 순서: F-PROF-001 → F-HW-001 → F-RVW-001 → F-PAR-001 → (Phase 2) F-TCH-001.

- [ ] T-023 F-PROF-001 draft → ready 승격: packages/hooks AsyncStorage 래퍼 의존성 확정 + bcrypt-js Hermes 호환 검증 — 0.5d
- [ ] T-024 F-PROF-001 구현 1차: profile-store / pin-hash / session 로직 + 단위 테스트 (logic/profiles/) — 1.5d
- [ ] T-025 F-PROF-001 Profile Picker + PIN modal 와이어프레임 (`design/wireframes/profiles/*` 5종) — 1d
- [ ] T-026 F-PROF-001 onboarding flow + 마이그레이션 ("Default" 학습자 래핑) E2E — 1d
- [ ] T-027 F-HW-001 draft → ready: HomeworkAssignment zod 스키마 + F-CNT-001 banned-on-learner-surface 확장 합의 — 0.5d
- [ ] T-028 F-HW-001 mission-builder 로직 (3 카드 룰) + 단위 테스트 100% — 1d
- [ ] T-029 F-HW-001 Today's mission 홈 화면 (3 카드, anti-shame 카피) — 1d
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
