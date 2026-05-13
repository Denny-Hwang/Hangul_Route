# Week 03 — Components v1

## 이번 주 목표
W2 와이어프레임이 가리키는 자리를 채울 **4개 기초 컴포넌트** 시안(visual spec)을 확정하고, 금요일에 `packages/design-system/src/components/` 로 1세대 승격한다. 이번 주가 끝나면 F-001 Hangul Tile Game 구현이 실제로 착수 가능한 상태.

이 주가 끝나면:
- `Button` / `Card` / `HoyaBubble` / `Progress` 4 종 컴포넌트가 시안 + spec.md + props 표 + variant matrix 까지 결정.
- `design/components/<Name>/` 4 폴더가 component-skill §3.1 의 5-파일 규약을 만족.
- 금요일 promotion PR (`design: promote W3 components to design-system`) 으로 design-system 패키지의 `src/components/` 에 첫 컴포넌트들이 안착.
- F-002 (HoyaBubble component spec) 가 `ready` 상태.

## 일일 목록

| Day | 주제 | Deliverable | Unblocks |
|---|---|---|---|
| Mon | Button v1 | `design/components/Button/{spec.md,v1.png,variants.png}` | 모든 화면의 primary / secondary / tertiary CTA |
| Tue | Card v1 | `design/components/Card/{spec.md,v1.png}` | episode-select rows, library/gallery cells, card-detail wrapper |
| Wed | HoyaBubble v1 (F-002) | `design/components/HoyaBubble/{spec.md,v1.png,tones.png}` + `docs/specs/F-002-*` 가 `ready` | onboarding/welcome 인사, quest/player prompt, results celebration |
| Thu | Progress v1 | `design/components/Progress/{spec.md,v1.png}` (Stage 막대 + 5-round 점) | journey/home Stage bar, quest/player round dots |
| Fri | Promotion PR + review | `packages/design-system/src/components/<Name>/` 4 폴더 + 회고 | apps/mobile · apps/web 의 첫 컴포넌트 사용 가능 |

## 의존성
- **Week 1 토큰 4종 (colors / typography / spacing / radii·shadows)** 가 `packages/design-system/src/tokens.ts` 로 승격되어 있어야 한다. 아직 못 됐으면 W3 시작을 늦추고 W1 promotion PR 부터 닫는다 (롤오버 트리거).
- **Hoya v1 4-pose** 가 `design/characters/hoya/v1/` 에 존재해야 Wed (HoyaBubble) 가 동작.
- W2 와이어프레임 11 파일이 머지되어 있어야 각 컴포넌트가 어느 자리에 들어가는지 spec 에 인용 가능.

## 컴포넌트 ↔ 와이어프레임 매핑 (W2 day-05-friday.md handoff)

| 컴포넌트 | 사용 화면 (W2 wireframe) |
|---|---|
| Button | onboarding/welcome, language-pick, first-quest-preview, journey/home, quest/results, library/card-detail |
| Card | journey/episode-select, library/gallery, library/card-detail |
| HoyaBubble | onboarding/welcome, onboarding/first-quest-preview, quest/player, quest/results |
| Progress | journey/home (Stage bar), quest/player (5-round dots) |

## 금요일 회고 (주 말에 채움)

- [ ] 4 개 컴포넌트 모두 `design/components/<Name>/spec.md` + variant matrix 완료
- [ ] component-skill §3.1 의 5-파일 구조 준수 (`tsx / test.tsx / stories.tsx / types.ts / styles.ts / index.ts`)
- [ ] 모든 variant·state 가 Storybook story 로 산출
- [ ] 64dp 터치 영역, WCAG AA, `prefers-reduced-motion` 대응 검증
- [ ] F-001 의 §8 dependencies 가 만족됨을 확인
- [ ] 다음 주(Week 04 Stage 1 game shells) 준비 상태
- [ ] 롤오버 항목 (있으면 INBOX 로)
