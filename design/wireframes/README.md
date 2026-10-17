# design/wireframes/

저충실도 와이어프레임. 시안 전 단계.

- 한 화면당 한 파일: `<flow>/<screen>.md`. 화면 ID = 이 경로. ID 의 원천은 `docs/blueprints/10-app-map.md` §3.
- 시안(`design/screens/`) 으로 진행하기 전에 반드시 거친다. "와이어프레임 없는 시안 금지" (CLAUDE.md §5).
- 규약: `.claude/skills/wireframe-skill/SKILL.md` (필수 8 섹션 · ASCII 박스 · 색/폰트/px 금지 · success/empty/error 상태).
- 각 파일의 **Open questions** 에 코드 ↔ 스펙 불일치가 기록되어 있다. 스펙을 `ready` 로 올리기 전에 거기서부터 본다.

## 인덱스 (2026-10-16 갱신 · 화면 수 = `design/wireframes/**/*.md` 파일 수, README 제외)

상태: **S** shipped(코드 존재, back-fill) · **D** spec draft · **R** spec ready · **P** proposal

### A. Learner app (mobile / PWA) — 아이
| 파일 | 상태 | 스펙 |
|---|---|---|
| `onboarding/welcome.md` · `onboarding/first-quest-preview.md` | S | F-PROF-001 |
| `onboarding/setup-steps.md` | R | F-LEARN-001 §3.15 (Who is learning, Profile, Privacy as three steps; amends the layout of `onboarding/all-ages-onboarding.md` A to C, E) |
| `profiles/picker.md` · `pin-entry.md` · `switch-button.md` · `create-parent.md` · `create-learner.md` | S | F-PROF-001 |
| `home/todays-mission.md` · `homework/list.md` | S | F-HW-001 |
| `home/story-time-card.md` | S | F-STORY-004 §3.7 (PR 4.0; built in PR 4.4a) |
| `episode/detail-story.md` | R | F-STORY-004 §3.6 (PR 4.0; brief `screens/25-story-episode-detail`; screen in PR 4.6) |
| `journey/grid.md` · `episode/detail.md` | S | 02 §1 · 04 · 05 |
| `journey/grid-with-stories.md` · `story/cell-stories.md` · `episode/detail-cell-stories-row.md` | R | F-STORY-005 §3.6 (PR 5.0; brief `screens/27-cell-stories`, story sections in `05-journey-grid` and `06-episode-detail`) |
| `quest/player.md` · `minigame/shell.md` · `minigame/families.md` | S | content-skill · 06 |
| `story/reader.md` · `story/term-gloss.md` · `story/sources.md` | S | F-STORY-002 §3.3-3.8 (PR 2.0; briefs `screens/21-story-reader`, `screens/26-story-sources`, `components/story-scene`, `illustrations/scene-art-style`) |
| `quest/discover.md` · `quest/check.md` | S | F-QUEST-002 §3.2-3.3 (built in Q-5a; split out of the drafted file in Q-11) |
| `results/next-quest-teaser.md` | S | F-QUEST-002 §3.5 (Q-5b) |
| `results/stage1-complete.md` | R | F-QUEST-002 §3.8 (Q-9: ceremony, Results prize button, Journey Complete pill and its See your prize entry) |
| `reviews/hangul-check.md` | R | F-QUEST-002 §3.9 (Q-10b: the Stage 1 configuration of `reviews/stage-review.md`, 35 items) |
| `minigame/build-letter.md` | R | F-QUEST-002 §3.7 (Q-7a) |
| `minigame/listen-pick.md` | R | F-QUEST-002 §3.10 (Q-3b) |
| `minigame/pic-word-match.md` | R | F-QUEST-002 §3.11 (Q-4) |
| `minigame/type-hangul.md` · `minigame/trace-word.md` · `minigame/write-frame.md` | R | F-CURR-001 §3.7 (D-3; mocks `design/screens/minigame-writing/`; built in G-3, G-4, G-5) |
| `story/check.md` · `story/word-recap.md` · `results/celebrate-story.md` | R | F-STORY-003 §3.4 · §3.6 · §3.7 (PR 3.0; brief `screens/22-story-check`, `components/choice-card`) |
| `story/sequence.md` | S | F-STORY-003 §3.5 (Story Order v2 built in PR 3.5a; art in 3.5b; brief `screens/12-minigame-story-sequence` revised) |
| `results/celebrate.md` | S | F-MOTION-003 |
| `results/extra-cards.md` · `home/cards-catch-up.md` · `library/earn-hints.md` · `library/card-back-citation.md` | R | F-STORY-006 §3.3-3.8 (PR 6.0; engine and live path shipped in 6.2-6.4b, surfaces in 6.5a-6.7) |
| `library/gallery.md` · `library/card-detail.md` | S | F-CARD-001/002/003 |
| `library/stories.md` · `library/culture.md` · `story/culture-notes.md` | R | F-STORY-004 §3.3-3.5 (PR 4.0; briefs `screens/23-library-stories`, `screens/24-culture-notes`) |
| `profile/settings.md` · `parent/gate.md` | S | F-SUB-001 · (gate 통합 대상) |
| `reviews/daily-test.md` · `feedback-review.md` · `stage-review.md` | D | F-RVW-001 |
| `sync/save-progress.md` · `restore.md` · `join-space.md` · `merge-notice.md` | P | roadmap multi-persona §4–6 |
| `paywall/upgrade.md` | R | F-SUB-001 · F-IAP-001 |
| `pwa/install-guide.md` · `pwa/system-banners.md` | P | roadmap web-pwa-offline §3 |
| `classroom/projection-mode.md` | D | F-TCH-001 §3.4 (연기: 자원봉사 학생용 옵션; 교사 수업은 `classroom/lecture-presenter.md`, F-TCH-004) |
| `vocab/topics.md` · `vocab/flashcards.md` · `vocab/speed-round.md` | D | F-VOC-003 · F-VOC-004 |
| `placement/placement.md` (flow overview) · `placement/invite.md` · `language.md` · `options.md` · `handoff.md` · `warmup.md` · `item.md` · `item-short.md` · `pause.md` · `sound-needed.md` · `result.md` · `report.md` · `home-entry.md` | R | F-PLC-001 (promoted in P-0) |
| `console/curriculum-planner.md` | S | F-PLAN-002 (design record; promoted in P2-8 to the files below) |
| `route/proposal.md` · `route/setup.md` · `route/overview.md` | S | F-PLAN-002 §3.9 (P2-7a, P2-7b; promoted in P2-8; behind `flags.routeEnabled`) |
| `classroom/lecture-presenter.md` | R | F-TCH-004 |
| `classroom/lecture-presets.md` · `classroom/lecture-big-screen-v2.md` · `classroom/lecture-entry-points.md` | R | AMENDMENTS-LECTURE-V2 (LV-0: presets on the presenter home and the setup page, the Stage 2-7 slide families, entry points for teachers and parents; mocks in LV-0b) |
| `classroom/lecture-phone.md` | R | AMENDMENTS-LECTURE-V2 §18, F-TCH-004 §3.5 / §3.6 (2026-10-16, DN-0: the stage on a phone sideways with a floating bar, the rotate page upright, the phone start screen; row LV-M1; `classroom/lecture-presets.md` Panels C, E, F revised in the same pass: grouped chooser, sticky footer, no picker, no language chips) |
| `home/next-lesson-hero.md` · `profile/profile-split.md` · `library/cards-collected-first.md` · `journey/route-tab-collapsed.md` | R | AMENDMENTS-DISPLAY-NAV §9 (2026-10-16, DN-0: the learner UX pass; mocks `design/screens/learner-shell/` and, for the Route tab, `design/screens/learning-route/route-tab-collapsed.md`; rows DN-8, DN-9) |
| `layout/wide.md` | S | F-LAYOUT-001 §3.1-3.8 (PR 0; built in PRs 1-7: classes, Home columns, Journey / Library panes, portrait guard also in `pwa/system-banners.md` panel 4; adoption checklist in `.github/pull_request_template.md`) |
| `console/class-transfer.md` | D | F-SPACE-002 |
| `journey/grid-plan-and-access.md` · `episode/detail-access-preview.md` · `home/next-and-free-end-card.md` · `results/back-to-plan-and-free-end.md` · `library/access-and-plan-tags.md` | R | F-ENT-003 §3.7-3.8 (E3-0; mock E3-D) |
| `billing/plan-status-free-lessons.md` | R | F-ENT-003 §3.9.1 (lines inside F-BILL-002's Plan screen, `billing/plan-status.md`) |
| `journey/my-route-overview.md` | R | F-ROUTE-001 (screens A to I; J amends `placement/result.md` (was `placement.md` G) for F-PLC-001 AM-1 / AM-14, K is F-PLAN-002's weekly plan proposal, FP-B6) |
| `home/notes-card.md` · `notes/list.md` · `notes/detail.md` | R | F-FEEDBACK-001 §6.5-6.7 (FB-0; built in FB-8) |
| `minigame/sentence-builder.md` · `quest/discover-sentences.md` | R | F-CURR-001 §3.4-3.7, §3.10 (D-1: Sentence Builder `order-it` and the sentence, pattern, exchange with Read along, and realia Discover pages; mock `design/screens/minigame-sentence-builder/v1/`; built in G-1, S3-1, S4-1, G-2) |
| `minigame/realia-read.md` | R | F-CURR-001 §3.6, §3.14 (row D-2; mock `design/screens/minigame-realia-read/`; built in G-2) |

### B/C. Caregiver · Teacher · School console (web, 일부 mobile) — 어른
| 파일 | 상태 | 스펙 |
|---|---|---|
| `parent/dashboard.md` · `learner-detail.md` · `voice-recorder.md` | S / R | F-PAR-001 |
| `console/sign-in.md` · `onboarding-role.md` · `home.md` | P | F-AUTH-001 · roadmap §1–2 |
| `console/roster.md` · `space-settings.md` · `relink-approval.md` | D / P | F-TCH-001 · roadmap §5 |
| `console/plan-builder.md` | S | roadmap §6 · F-HW-001 §3.4 · F-PLAN-002 §3.7-3.8 (week groups, readout, re-pace; P2-8) |
| `console/curriculum-wizard.md` | S | F-PLAN-002 §3.8 (P2-6, P2-6b; promoted in P2-8) |
| `console/curriculum-free-days.md` · `console/free-lessons-line.md` | R | F-ENT-003 §3.9.2-3.9.3 (E3-0) |
| `console/school-admin.md` | P | roadmap S7 |
| `browse/home.md` · `browse/episode.md` · `browse/item.md` · `browse/preview-player.md` · `browse/preview-end.md` · `browse/show-as.md` · `browse/access.md` · `browse/entry-points.md` | R | F-BROWSE-001 (All lessons: paying parents and teachers preview every lesson as a learner sees it, at `app.hangulroute.com/browse`, same-tab entry from the adult navigation and the grown-up area; BR-0) |
| `console/account.md` · `console/billing.md` | P | roadmap §5.3 · §7 |
| `parent/notes.md` · `parent/note-report.md` | R | F-FEEDBACK-001 §6.10 (FB-0; built in FB-9) |
| `console/note-composer.md` · `console/notes-sent.md` · `console/family-notes.md` · `console/notes-hub.md` | R | F-FEEDBACK-001 §6.13, §7.2, §9 (FB-0; built in FB-11a, FB-11b, FB-12; console pages on app.hangulroute.com per F-APP-001) |
| `billing/billing-home.md` · `checkout-return.md` · `receipts.md` · `step-up.md` · `plan-status.md` | R | F-BILL-002 (supersedes `console/billing.md`; `plan-status` supersedes the body of `paywall/upgrade.md`; page at `/account/billing` inside F-APP-001's frame) |
| `reports/learner-report.md` · `reports/class-report.md` · `reports/print.md` (console, app.hangulroute.com) · `reports/in-app-report.md` (learner app, behind the grown-up gate); supersede `parent/learner-detail.md` and the web part of `parent/dashboard.md` | R | F-REPORT-001 (RP-0) |

### D. App shell — persona sign-in on app.hangulroute.com (F-APP-001)
| 파일 | 상태 | 스펙 |
|---|---|---|
| `onboarding/welcome-personas.md` | R | F-APP-001 §3.6 (amends `onboarding/welcome.md`; web only, flag) |
| `parent/grown-up-home-card.md` | R | F-APP-001 §3.6, §3.9 (Profile "Grown-up home" row and dashboard card; amends `parent/dashboard.md`) |
| `shell/signin.md` | R | F-APP-001 §3.7 (supersedes `console/sign-in.md` on the app host; adult step for account creation) |
| `shell/adult-frame.md` · `shell/parent-home.md` · `shell/teacher-home.md` | R | F-APP-001 §3.8 (teacher home amends `console/home.md`; parent home replaces the `/parent` demo) |
| `shell/grown-up-lock.md` | R | F-APP-001 §3.9 |
| `shell/offline.md` | R | F-APP-001 §3.12 |
| `shell/display-sheet.md` · `shell/screen-header.md` | R | AMENDMENTS-DISPLAY-NAV §3.6, §4, §7 (2026-10-16, DN-0: one language and text size per device from an Aa button; a top-left Back on every non-root screen, the console PageBack and the Learner app exit on the right; mocks `design/screens/app-shell/display-sheet.md`, `adult-frame.md`, `design/components/ScreenHeader/`; rows DN-3 to DN-7) |

## 다음 단계
1. Open questions 의 코드-스펙 불일치를 스펙에 반영 (특히 `parent/gate` ↔ `profiles/pin-entry` 통합, 계획 gating 규칙 F-HW-001 §3.4 vs F-TCH-001 §3.3).
2. `frontend-design-skill` 로 시안 (`design/screens/`) — 순서는 `10-app-map.md` §6.
