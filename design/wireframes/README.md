# design/wireframes/

저충실도 와이어프레임. 시안 전 단계.

- 한 화면당 한 파일: `<flow>/<screen>.md`. 화면 ID = 이 경로. ID 의 원천은 `docs/blueprints/10-app-map.md` §3.
- 시안(`design/screens/`) 으로 진행하기 전에 반드시 거친다. "와이어프레임 없는 시안 금지" (CLAUDE.md §5).
- 규약: `.claude/skills/wireframe-skill/SKILL.md` (필수 8 섹션 · ASCII 박스 · 색/폰트/px 금지 · success/empty/error 상태).
- 각 파일의 **Open questions** 에 코드 ↔ 스펙 불일치가 기록되어 있다. 스펙을 `ready` 로 올리기 전에 거기서부터 본다.

## 인덱스 (2026-10-11 갱신 · 화면 수 = `design/wireframes/**/*.md` 파일 수, README 제외)

상태: **S** shipped(코드 존재, back-fill) · **D** spec draft · **R** spec ready · **P** proposal

### A. Learner app (mobile / PWA) — 아이
| 파일 | 상태 | 스펙 |
|---|---|---|
| `onboarding/welcome.md` · `onboarding/first-quest-preview.md` | S | F-PROF-001 |
| `profiles/picker.md` · `pin-entry.md` · `switch-button.md` · `create-parent.md` · `create-learner.md` | S | F-PROF-001 |
| `home/todays-mission.md` · `homework/list.md` | S | F-HW-001 |
| `home/story-time-card.md` | S | F-STORY-004 §3.7 (PR 4.0; built in PR 4.4a) |
| `episode/detail-story.md` | R | F-STORY-004 §3.6 (PR 4.0; brief `screens/25-story-episode-detail`; screen in PR 4.6) |
| `journey/grid.md` · `episode/detail.md` | S | 02 §1 · 04 · 05 |
| `journey/grid-with-stories.md` · `story/cell-stories.md` · `episode/detail-cell-stories-row.md` | R | F-STORY-005 §3.6 (PR 5.0; brief `screens/27-cell-stories`, story sections in `05-journey-grid` and `06-episode-detail`) |
| `quest/player.md` · `minigame/shell.md` · `minigame/families.md` | S | content-skill · 06 |
| `story/reader.md` · `story/term-gloss.md` · `story/sources.md` | S (reader G2 checkpoint: R, PR 2.9) | F-STORY-002 §3.3-3.8 (PR 2.0; briefs `screens/21-story-reader`, `screens/26-story-sources`, `components/story-scene`, `illustrations/scene-art-style`) |
| `minigame/build-letter.md` | R | F-QUEST-002 §3.7 (Q-7a) |
| `minigame/listen-pick.md` | R | F-QUEST-002 §3.10 (Q-3b) |
| `minigame/pic-word-match.md` | R | F-QUEST-002 §3.11 (Q-4) |
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
| `placement/placement.md` | D | F-PLC-001 |
| `console/curriculum-planner.md` | D | F-PLAN-002 |
| `classroom/lecture-presenter.md` | R | F-TCH-004 |
| `layout/wide.md` | S | F-LAYOUT-001 §3.1-3.8 (PR 0; built in PRs 1-7: classes, Home columns, Journey / Library panes, portrait guard also in `pwa/system-banners.md` panel 4; adoption checklist in `.github/pull_request_template.md`) |
| `console/class-transfer.md` | D | F-SPACE-002 |
| `journey/my-route-overview.md` | R | F-ROUTE-001 (screens A to I; J amends `placement/placement.md` G for F-PLC-001 AM-1 / AM-14, K is F-PLAN-002's weekly plan proposal, FP-B6) |

### B/C. Caregiver · Teacher · School console (web, 일부 mobile) — 어른
| 파일 | 상태 | 스펙 |
|---|---|---|
| `parent/dashboard.md` · `learner-detail.md` · `voice-recorder.md` | S / R | F-PAR-001 |
| `console/sign-in.md` · `onboarding-role.md` · `home.md` | P | F-AUTH-001 · roadmap §1–2 |
| `console/roster.md` · `space-settings.md` · `relink-approval.md` | D / P | F-TCH-001 · roadmap §5 |
| `console/plan-builder.md` | P | roadmap §6 · F-HW-001 §3.4 |
| `console/school-admin.md` | P | roadmap S7 |
| `console/account.md` · `console/billing.md` | P | roadmap §5.3 · §7 |

## 다음 단계
1. Open questions 의 코드-스펙 불일치를 스펙에 반영 (특히 `parent/gate` ↔ `profiles/pin-entry` 통합, 계획 gating 규칙 F-HW-001 §3.4 vs F-TCH-001 §3.3).
2. `frontend-design-skill` 로 시안 (`design/screens/`) — 순서는 `10-app-map.md` §6.
