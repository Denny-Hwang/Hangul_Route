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

## Glossary (product terms shared by every spec; UI copy uses these words)
- **Learning Route** — the learner's whole-road page (F-ROUTE-001, amended by `AMENDMENTS-ROUTE-LEARNING-ROUTE.md`). Always title case in UI strings, the marketing site included; the tab label is **Route**. Code names stay `my-route` / `myRoute`.
- **Weekly plan** — any dated curriculum plan: a class's, a school's, a family's or the learner's own (F-PLAN-002 OD-7). UI copy says "your class's weekly plan", "your family's weekly plan", "your own weekly plan"; never "family plan" or "class plan" for a curriculum.
- **Family plan** — the paid family product (F-ENT-001, F-BILL-002), named **Family Plan** in UI strings: $15.30 a year, renews yearly, cancel any time (`AMENDMENTS-BILLING-FAMILY-YEARLY.md`, 2026-10-11; it was the one-time "Family Lifetime" until then, and its stored key is still `family_lifetime`). Grown-up surfaces only.
- **Not open yet** — a lesson a free learner cannot start yet, drawn as a dotted ring; F-ENT-003 section 3.11 owns this and every other access word (learner screens never name a product).

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

### 스트로크 v3 + 모션 (W6)
- `F-008-stroke-order-hard-pass.md` — **shipped** (PR #29)
- `F-009-narrated-stroke-demo.md` — **shipped** (PR #29)
- `F-MOTION-005-star-count-change.md` — **shipped** (PR #30)

### Spec wave 2026-10 (ready — implementation follows the PR order in `docs/roadmap/spec-wave-2026-10.md`)
- `F-I18N-001-ui-locales.md` — UI in English (default), Korean and Spanish · **ready**
- `F-LEARN-001-all-ages-onboarding.md` — who is learning, reading level, consent, grown-up PIN, avatar variants · **ready**
- `F-CNT-002-romanization-policy.md` — Revised Romanization policy and validator over shipped content · **ready**
- `F-QUEST-002-discover-check-stage1-complete.md` — Discover/Check steps, full Stage 1 (15 quests, 30 symbols), Listen & Pick, Pic-Word Match · **ready**

### Spec wave 2026-10, part 2 (ready — PR order in `docs/roadmap/spec-wave-2026-10-review-2.md`)
- `F-AUDIO-004-korean-voice-quality.md` — sound-first Korean voice, capability check, visible text fallback, MP3 path · **ready**
- `F-STORY-001-story-schema-pipeline.md` — story schema, `content/stories/` pipeline, sourced facts, verification gate · **ready** (authoring and correction process: `content/stories/README.md`)
- `F-STORY-002-story-reader.md` — story reader, Sources screen, SVG scene art · **ready**
  - wireframes `design/wireframes/story/{reader,term-gloss,sources}.md` · briefs `design/brief/screens/21-story-reader.md`, `26-story-sources.md`, `components/story-scene.md`, `illustrations/scene-art-style.md` (PR 2.0)
- `F-STORY-003-story-checks-sequence-v2.md` — comprehension checks and sequence v2 · **ready**
- `F-STORY-004-story-shelf-home-library.md` — story shelf, Home card, Library categories · **ready**
  - wireframes `design/wireframes/library/{stories,culture}.md`, `story/culture-notes.md`, `home/story-time-card.md`, `episode/detail-story.md` · briefs `design/brief/screens/23-library-stories.md`, `24-culture-notes.md`, `25-story-episode-detail.md` (PR 4.0)
- `F-STORY-005-episode-catalogue-grid.md` — 24 heritage stories placed on the 7x5 grid · **ready**
  - wireframes `design/wireframes/journey/grid-with-stories.md`, `story/cell-stories.md`, `episode/detail-cell-stories-row.md` · briefs `design/brief/screens/27-cell-stories.md`, §8 of `05-journey-grid.md` and `06-episode-detail.md` (PR 5.0)
- `F-STORY-006-card-award-model.md` — card award model (31 unearnable cards), story and set cards · **ready**
- `F-VOC-001-vocab-schema-pipeline.md` — vocabulary schema, `content/vocab/` pipeline, sense registry · **ready**
- `F-VOC-002-wordart-svg-system.md` — hand-drawn WordArt SVG glyph system and vocabulary colour tokens · **ready**
- `F-VOC-003-topic-picker-flashcards.md` — Words entry, topic picker, flashcards · **ready**
- `F-VOC-004-speed-round.md` — speed round, spark meter, opt-in Challenge mode · **ready**
- `F-VOC-005-word-progress-srs-sync.md` — per-word progress, Leitner boxes, sync merge, caregiver summary · **ready**
- `F-PLC-001-placement-test.md` — level check with selectable test language, three check lengths (Short, Standard, Deep; companion `AMENDMENTS-PLC-THREE-MODES.md`, applied), adaptive ladder, route seed · **ready**
- `F-PLAN-002-curriculum-planner.md` — curriculum generator by level and duration, console wizard, self-route · **ready**
- `F-TCH-004-lecture-mode.md` — teacher lecture mode for tablets and projectors · **ready**
- `F-LAYOUT-001-responsive-tablet-landscape.md` — tablet, landscape and split-pane layout · **ready**
- `F-SPACE-002-class-transfer.md` — move a learner between classes with learner-side, releasing and receiving consent (flag-locked) · **ready**
  - amended 2026-10-11 by `AMENDMENTS-BILLING-FAMILY-YEARLY.md` ([BY] premium note: learners keep everything they earned, access follows the active plan; follow-up docs PR #385)
- `F-ROUTE-001-my-route-overview.md` — My route: the whole journey at a glance (stage trail, pips that only fill, read / listen / write inventory, grown-up and console views) and the weekly plan proposed after the level check (companion `AMENDMENTS-PLC-PLAN-HANDOFF.md`, applied to F-PLC-001 and F-PLAN-002) · **ready**
  - amended 2026-10-11 by `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` (applied): named **Learning Route**, a Route tab for learners, a route card with Now / Goal / goal-stage pips / Next (goal from the class, school, family or own weekly plan; next from F-ENT-003's `routeNext`), a goal line in the per-learner report (F-REPORT-001) and a read-only stage list with the grown-up route card for parents (`/parent/space/route`) and teachers (`/teach/space/route`) · **ready** · wireframes `design/wireframes/journey/learning-route.md`, `parent/learning-route.md`, `console/learning-route.md`
- `F-BILL-002-billing-in-app-all-personas.md` — billing at app.hangulroute.com/account/billing for every persona (payer and read-only plan cards, receipts and history, test-mode and live guard, step-up), status-only learner Plan screen for every tier, no billing on hangulroute.com, store rules for native builds · **ready**
  - amended 2026-10-11 by `AMENDMENTS-BILLING-FAMILY-YEARLY.md` (applied, also to F-ENT-001, F-ENT-002, F-SUB-001, F-SITE-002, F-BROWSE-001, F-ENT-003, and F-SPACE-002 in the follow-up docs PR #385): the Family Plan renews yearly ($15.30 / year, Stripe subscription, cancel any time), the stored key stays `family_lifetime`, `STRIPE_PRICE_FAMILY_YEARLY`, the owner's Stripe checklist · **ready**
- `F-BROWSE-001-adult-content-browser.md` — All lessons: paying parents and teachers preview every lesson exactly as a learner sees it (a third root of the learner web build at `/browse`, same-tab pass from the adult navigation or the grown-up area, free adults see exactly what a free learner can open, nothing is ever saved) · **ready**
  - wireframes `design/wireframes/browse/{home,episode,item,preview-player,preview-end,show-as,access,entry-points}.md` (BR-0)
- `F-QUEST-002` amended: initial ㅇ is spoken by its name (see F-AUDIO-004)
- `F-ENT-003-free-day2-unlocked-curriculum.md` — free plan: all of Stage 1 (owner decision OD-1, 2026-10-11; Stage 2 onward visible as "Not open yet" and opened by paid plans, kept quests stay open, one switch off until Stripe Live and web only until F-IAP-002), everything open for subscribers, one "next" and one "In your plan" that follow the learner's plan (owner of `questAccess`, `routeNext` and the access glossary for the 2026-10-11 specs) · **ready**
  - wireframes `design/wireframes/journey/grid-plan-and-access.md`, `episode/detail-access-preview.md`, `home/next-and-free-end-card.md`, `results/back-to-plan-and-free-end.md`, `library/access-and-plan-tags.md`, `billing/plan-status-free-lessons.md`, `console/curriculum-free-days.md`, `console/free-lessons-line.md`

### Spec wave 2026-10-11 (owner UX request: two hosts, personas)
- `F-FEEDBACK-001-adult-feedback-channel.md` — notes from grown-ups: a one-way, child-safe channel from a learner's teacher or family (preset encouragement plus a short text, preset reactions only, family oversight incl. taken-back notes, hide, report and stop a sender, owner-granted family senders, Worker switch `NOTES_SEND`, offline, deleted with the learner; console pages on app.hangulroute.com) · **ready**
  - wireframes `design/wireframes/home/notes-card.md`, `notes/{list,detail}.md`, `parent/{notes,note-report}.md`, `console/{note-composer,notes-sent,family-notes,notes-hub}.md` (FB-0)
- `F-APP-001-persona-app-shell.md` — app.hangulroute.com is the one product app: persona sign-in (learner, family, teacher), a home per persona with the entries to reports, notes, Learning Route and lessons, grown-up lock on shared devices, console served on the app host (B2), the route contract for the sibling specs of the wave · **ready**
  - wireframes `design/wireframes/shell/{signin,adult-frame,parent-home,teacher-home,grown-up-lock,offline}.md`, `onboarding/welcome-personas.md`, `parent/grown-up-home-card.md`
- `F-SITE-002-marketing-site-layered.md` — hangulroute.com becomes a short, layered intro site: one-screen hero, persona chooser, `/learners`, `/parents`, `/teachers`, no billing or console links, feature lines tied to a claims table; old grown-up URLs are F-APP-001's · **ready**
  - wireframes `design/wireframes/site/{home,learners,parents,teachers,header-footer}.md`

### Spec wave 2026-10-13 (owner decision: the 22 "Coming later" cells)
- `F-CURR-001-upper-stage-content.md` — content of the 22 placeholder cells of Stages 2, 3, 4, 6 and 7: per-stage goals and can-do lines, scope, six-step quests per cell, five new games (Sentence Builder, Realia Read, Type Hangul, Trace a Word, Write Frame), writing without speaking, sourced culture notes, the MAR language and culture passes, a per-cell JSON pipeline with its own bundle budget, Stage 2+ paid · **ready**

### Phase 2 / planned
- `F-PROF-001-device-profiles.md` — multi-learner · **draft** (code shipped PR #13, full spec covers cloud sync)
- `F-HW-001-homework-page.md` — Homework tab · **draft**
- `F-RVW-001-review-tests.md` — Reviews · **draft**
- `F-PAR-001-parent-dashboard.md` — Parent dashboard · **draft**
- `F-REPORT-001-progress-reports.md` — progress reports for parents and teachers on app.hangulroute.com: a per-learner dashboard with day / week / month / all-time reports in three layers (headline, what went well, what to practice next first), class statistics without ranking, the in-app report behind the grown-up gate, print; supersedes F-PAR-001 sections 3.2 and 3.3 · **ready**
  - wireframes `design/wireframes/reports/{learner-report,class-report,in-app-report,print}.md` (RP-0)
- `F-TCH-001-teacher-classroom.md` — Teacher classroom · **draft** (Phase 2 stub)

### Deferred (spec exists, ship-when triggers defined)
- `F-VR-002-full-storybook.md` — Storybook setup · **draft** (ship when team-size or regression frequency triggers — see spec §7)
- `F-VR-003-automated-screenshot-diff.md` — Argos/Chromatic CI diffing · **draft** (ships paired with F-VR-002)
- `F-CARD-S2-001-stage2-card-illustrations.md` — Stage 2 cards · **draft** (blocked on Stage 2 word content authoring)
- `F-CARD-S3-001-stage3-card-illustrations.md` — Stage 3 sentence-scene cards · **draft** (blocked on Stage 3 sentence content)
- `F-CARD-S4-001-stage4-card-illustrations.md` — Stage 4 dialogue-exchange cards · **draft** (blocked on Stage 4 dialogue content)
- `F-CARD-S5-001-stage5-card-illustrations.md` — Stage 5 story-scene cards · **draft** (blocked on Stage 5 folk-tale content)
- `F-CARD-S6-001-stage6-card-illustrations.md` — Stage 6 real-world-artifact cards · **draft** (blocked on Stage 6 real-use content)
- `F-CARD-S7-001-stage7-card-illustrations.md` — Stage 7 self-expression cards · **draft** (blocked on Stage 7 + privacy review)

### 미작성 (Phase 2 후보)
- F-005 Batchim Build — 3-component CVC syllables (note: number conflicts with shipped F-005 stroke order; will renumber when authored)
- F-010 Narrated full-quest playback
- F-MOTION-006 Cross-row star count notification
- F-PROF-002 Per-profile difficulty (activates F-008 strictMode)
- F-AUDIO-001 Audio recording playback for Stage 7
