# design/wireframes/

저충실도 와이어프레임. 시안 전 단계.

- 한 화면당 한 파일: `<flow>/<screen>.md`. 화면 ID = 이 경로. ID 의 원천은 `docs/blueprints/10-app-map.md` §3.
- 시안(`design/screens/`) 으로 진행하기 전에 반드시 거친다. "와이어프레임 없는 시안 금지" (CLAUDE.md §5).
- 규약: `.claude/skills/wireframe-skill/SKILL.md` (필수 8 섹션 · ASCII 박스 · 색/폰트/px 금지 · success/empty/error 상태).
- 각 파일의 **Open questions** 에 코드 ↔ 스펙 불일치가 기록되어 있다. 스펙을 `ready` 로 올리기 전에 거기서부터 본다.

## 인덱스 (2026-09-19 · 43 화면)

상태: **S** shipped(코드 존재, back-fill) · **D** spec draft · **R** spec ready · **P** proposal

### A. Learner app (mobile / PWA) — 아이
| 파일 | 상태 | 스펙 |
|---|---|---|
| `onboarding/welcome.md` · `onboarding/first-quest-preview.md` | S | F-PROF-001 |
| `profiles/picker.md` · `pin-entry.md` · `switch-button.md` · `create-parent.md` · `create-learner.md` | S | F-PROF-001 |
| `home/todays-mission.md` · `homework/list.md` | S | F-HW-001 |
| `journey/grid.md` · `episode/detail.md` | S | 02 §1 · 04 · 05 |
| `quest/player.md` · `minigame/shell.md` · `minigame/families.md` | S | content-skill · 06 |
| `results/celebrate.md` | S | F-MOTION-003 |
| `library/gallery.md` · `library/card-detail.md` | S | F-CARD-001/002/003 |
| `profile/settings.md` · `parent/gate.md` | S | F-SUB-001 · (gate 통합 대상) |
| `reviews/daily-test.md` · `feedback-review.md` · `stage-review.md` | D | F-RVW-001 |
| `sync/save-progress.md` · `restore.md` · `join-space.md` · `merge-notice.md` | P | roadmap multi-persona §4–6 |
| `paywall/upgrade.md` | R | F-SUB-001 · F-IAP-001 |
| `pwa/install-guide.md` · `pwa/system-banners.md` | P | roadmap web-pwa-offline §3 |
| `classroom/projection-mode.md` | D | F-TCH-001 §3.4 |

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
