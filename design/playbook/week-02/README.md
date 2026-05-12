# Week 02 — Wireframes core

## 이번 주 목표
4 개 핵심 화면 + 1 회고를 저충실도(low-fidelity) **와이어프레임**으로 확정한다. 시안(`design/screens/`)·구현(`apps/`)으로 가기 전 정보 구조·플로우·인터랙션 포인트만 잡는다 (`design/wireframes/README.md`, `.claude/skills/wireframe-skill/SKILL.md`).

이 주가 끝나면:
- Week 3 컴포넌트(Button / Card / Bubble / Progress)가 어디 들어갈지 확정.
- F-001 Hangul Tile Game (`docs/specs/F-001-hangul-tile-game.md`) 의 UI sketch 링크 두 개가 실재.
- apps/mobile · apps/web 의 화면 골격을 착수할 수 있는 상태.

## 일일 목록

| Day | 주제 | Deliverable | Unblocks |
|---|---|---|---|
| Mon | Intro / Onboarding | `design/wireframes/onboarding/welcome.md`, `language-pick.md`, `first-quest-preview.md` | apps/mobile 첫 진입 플로우 |
| Tue | Home (Route) | `design/wireframes/journey/home.md` | F-001 (홈 → Quest 진입), Stage 1 진도 표시 |
| Wed | Episode select / Quest player | `design/wireframes/journey/episode-select.md`, `quest/player.md`, `quest/results.md` | F-001 매치 사운드 라운드 화면 |
| Thu | Card collection (Library) | `design/wireframes/library/gallery.md`, `card-detail.md` | F-007 Heritage Card 수집 (deferred) UI 사전 정의 |
| Fri | Review + handoff | `design/wireframes/_review-week-02.md` + 본 README 회고 | Week 03 컴포넌트 작업 |

## 의존성
- 이번 주는 **색·폰트·아이콘 결정 금지** (wireframe-skill §4). 그 결정은 Week 1 토큰이 들어와도 시안 단계에서 함.
- Week 1 Hoya v1 포즈(idle / cheering / thinking)가 있으면 인트로 와이어프레임에서 자리만 잡는다. 없으면 `[hoya placeholder]` 박스로 둔다.

## 금요일 회고 (주 말에 채움)

- [ ] 5 개 화면 모두 7-section 구조(Scenario / Goal / Box / Interaction / Navigation / Data / Open questions) 충족
- [ ] 각 화면의 success / empty / error 3 상태 검토 완료
- [ ] 진입·이탈 화면 ID 가 실제로 다른 wireframe 에서 참조됨 (그래프 무결성)
- [ ] 다음 주(Week 03 Components v1) 준비 상태
- [ ] 롤오버 항목 (있으면 INBOX 로)
