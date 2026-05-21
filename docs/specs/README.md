# docs/specs/

**기능 명세 (Feature Spec) 디렉토리.** 모든 구현 작업은 `F-XXX` 스펙 링크 없이 시작할 수 없다 (CLAUDE.md §5).

## 파일 네이밍
```
F-XXX-<slug>.md
```
- `F-001-hangul-tile-game.md`
- `F-002-hoya-feedback-bubble.md`

## 템플릿 섹션
1. **Context** — 왜 이 기능이 필요한가, 어느 Stage/테마에 속하는가
2. **User story** — P4/P5 의 눈으로 (영어)
3. **Acceptance criteria** — Given/When/Then
4. **Out of scope** — 명시적으로 제외
5. **UI sketch 링크** — `design/wireframes/` 또는 `design/screens/`
6. **Tests** — 어떤 레벨(unit/integration/e2e) 에서 검증
7. **Rollout** — MVP/v1/v2 중 어디
8. **Dependencies** — 다른 F-XXX, 토큰, 에셋

## 상태
- `draft` — 작성 중
- `ready` — 구현 가능
- `in-progress` — 어느 PR 에서 작업 중
- `shipped` — main 반영됨

## 인덱스 (2026-05-21)

### 기능 (MVP)
- `F-001-hangul-tile-game.md` — Match Sound minigame · **shipped** (PR #8 spec, PR #13 code)
- `F-002-hoya-feedback-bubble.md` — HoyaBubble component · **shipped** (PR #10 spec, PR #13 code)
- `F-003-build-a-letter.md` — Build a Letter minigame · **shipped** (back-fill — PR #13 code)
- `F-HOYA-001-hoya-character-system.md` — Hoya 5-pose SVG · **shipped** (PR #13 + PR #16)
- `F-CARD-001-heritage-card-art.md` — Heritage Card Art system · **shipped** (PR #17 + PR #18)
- `F-PREV-001-design-preview-surface.md` — /design-preview route · **shipped** (PR #15)

### 인프라
- `F-INFRA-001-cloudflare-workers-bootstrap.md` — **shipped** (PR #7)
- `F-COV-001-coverage-gate-enforcement.md` — **shipped** (PR #9)
- `F-CNT-001-content-language-policy-validator.md` — **shipped** (PR #9)
- `F-DES-001-design-token-drift-detector.md` — **shipped** (PR #9, activated PR #15)

### 카드 & 모션 (W5)
- `F-CARD-002-heritage-card-back-face.md` — **shipped** (PR #20)
- `F-MOTION-002-card-flip-animation.md` — **shipped** (PR #21)
- `F-MOTION-001-hoya-pose-transition.md` — **shipped** (PR #22)
- `F-MOTION-003-card-unlock-celebration.md` — **shipped** (PR #22)
- `F-CARD-003-card-share-export.md` — **shipped** (PR #23)
- `F-VR-001-visual-regression-surface.md` — **shipped** (PR #24)
- `F-004-trace-stroke.md` — **shipped** (PR #25)
- `F-005-stroke-order-validation.md` — **shipped** (PR #26)
- `F-006-stroke-direction-validation.md` — **shipped** (PR #26)
- `F-007-animated-stroke-hint.md` — **shipped** (PR #26)
- `F-MOTION-004-star-pop-in.md` — **shipped** (PR #27)

### Phase 2 / planned
- `F-PROF-001-device-profiles.md` — multi-learner · **draft** (code shipped PR #13, full spec covers cloud sync)
- `F-HW-001-homework-page.md` — Homework tab · **draft**
- `F-RVW-001-review-tests.md` — Reviews · **draft**
- `F-PAR-001-parent-dashboard.md` — Parent dashboard · **draft**
- `F-TCH-001-teacher-classroom.md` — Teacher classroom · **draft** (Phase 2 stub)

### Deferred (spec exists, ship-when triggers defined)
- `F-VR-002-full-storybook.md` — Storybook setup · **draft** (ship when team-size or regression frequency triggers — see spec §7)
- `F-VR-003-automated-screenshot-diff.md` — Argos/Chromatic CI diffing · **draft** (ships paired with F-VR-002)
- `F-CARD-S2-001-stage2-card-illustrations.md` — Stage 2 cards · **draft** (blocked on Stage 2 word content authoring)

### 미작성 (Phase 2 후보)
- F-005 Batchim Build — 3-component CVC syllables
- F-008 Stroke order as hard pass criterion
- F-009 Narrated stroke demonstration ("first stroke", "second stroke" voice)
- F-MOTION-005 Star count change animation
- F-CARD-S3-001 onward — Stage 3-7 card sets
