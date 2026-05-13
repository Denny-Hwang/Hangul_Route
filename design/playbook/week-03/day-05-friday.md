---
date: week-03 / Friday
duration: 30 min (08:00 – 08:30 KST — promotion + review)
deliverables:
  - packages/design-system/src/components/{Button,Card,HoyaBubble,Progress}/
    × 5-파일 세트 (component-skill §3.1)
  - design/components/_review-week-03.md
  - design/playbook/week-03/README.md (회고 섹션 채움)
depends_on:
  - 이번 주 4 컴포넌트 시안 (Mon–Thu)
unblocks:
  - apps/mobile · apps/web 의 첫 컴포넌트 임포트
  - F-001 Hangul Tile Game 구현 (Continue / Round dots / wrong-answer bubble)
  - Week 04 Stage 1 game shells
---

# Day 05 — Friday · Components promotion PR + Week 03 review

## 오늘의 목표
이번 주 4 컴포넌트 시안 (`design/components/{Button,Card,HoyaBubble,Progress}/`) 을 `packages/design-system/src/components/<Name>/` 로 **5-파일 세트** 와 함께 일괄 승격하고, Week 04 (Stage 1 game shells) 로 인계한다.

5-파일 세트 (component-skill §3.1) 당 폴더:
```
<Name>/
├── <Name>.tsx          # 함수형 + hooks + named export
├── <Name>.test.tsx     # TDD red-green-refactor 의 결과
├── <Name>.stories.tsx  # variant × state 별 스토리
├── types.ts            # <Name>Props
├── styles.ts           # tokens 참조만
└── index.ts            # named re-export only
```

## 왜 오늘
- 시안만 있고 코드가 없으면 W4 가 시작될 수 없다 — promotion 이 필수 unblock.
- 4 컴포넌트가 한 PR 에서 함께 승격되어야 시각·토큰 일관성을 일괄 리뷰 가능.
- TDD 순서를 명시적으로 분리 커밋해서 component-skill §3.2 의 red-green-refactor 룰이 깨지지 않게.

## 사전 준비 (2분)
- `packages/design-system/src/tokens.ts` 가 W1 promotion 됐는지 재확인 (안 됐으면 오늘 promotion 불가, 롤오버).
- 이번 주 4 컴포넌트의 `spec.md` 가 모두 존재하는지 빠르게 ls.
- W2 의 day-05 review (`_review-week-02.md`) 가 anti-pattern 0 / 그래프 닫힘 으로 통과했는지 확인.
- F-002 spec 이 `ready` 상태인지 확인.

## Claude Design / Code 프롬프트 (복붙)

이 날은 design 세션이 아니라 **promotion 코드 세션** 이다. 각 컴포넌트에 대해 component-skill §3.2 의 3-커밋 패턴을 따른다:

```
test(design-system): add failing spec for Button v1 (F-XXX-button)
feat(design-system): implement Button v1 to satisfy spec
refactor(design-system): extract pressed-state hook  # optional
```

(반복 × 4: Button, Card, HoyaBubble, Progress)

각 컴포넌트의 5-파일 세트를 생성할 때 다음을 보장:

1. **tsx**: 함수형 + named export. `default export` 금지.
2. **test.tsx**: red 단계 — 1개 이상의 실패 테스트 (variant 별, a11y label, prefers-reduced-motion).
3. **stories.tsx**: 모든 variant × state 의 스토리 (Button 12-cell, Card 9-cell, HoyaBubble 3-tone, Progress 6-cell).
4. **types.ts**: `<Name>Props` 명시적 export. `any` 금지.
5. **styles.ts**: `tokens.*` 참조만. 인라인 색·간격 금지.
6. **index.ts**: `export { Button } from './Button';` 같은 re-export 한 줄.

각 컴포넌트의 spec.md 토큰 표를 styles.ts 와 1:1 대조 (drift 없음).

## 작업 흐름 (25분)
1. Button promotion (6 분): test → impl → story → 4-파일 검토.
2. Card promotion (6 분): 동일 패턴.
3. HoyaBubble promotion (7 분): tone 3 종 + dismiss 동작 테스트 포함.
4. Progress promotion (5 분): bar + dots 두 variant.
5. 마지막 1 분: `pnpm -r run typecheck` + `pnpm -r run test` 가 모두 green 인지 확인.

## 결과 저장 + PR (커밋 ~ 12개)
1. 각 컴포넌트당 2–3 커밋 (test → feat → optional refactor) = 8–12 커밋.
2. 별도 PR: `design: promote W3 components to design-system (Button / Card / HoyaBubble / Progress)`.
3. PR 본문:
   - 시안 vs 구현 스크린샷 4세트 (각 컴포넌트).
   - `pnpm -r run test` 출력.
   - `coverage-gate.mjs` (F-COV-001) 가 목표 충족하는지 확인 (`packages/design-system` 85%).
   - `check-token-drift.mjs` (F-DES-001) 가 drift 0 인지 확인.
   - F-001 §8 dependencies 항목 (`Hoya v1` / `tokens v1`) 충족 표시.
4. `design/components/_review-week-03.md` 에 회고 (4 컴포넌트별 시안↔코드 drift 0 확인).
5. `design/playbook/week-03/README.md` 의 금요일 회고 체크박스 채움.

## Code 다음 단계 안내
- W4 시작 시점에는 다음이 가능:
  - apps/mobile 에서 `import { Button, Card, HoyaBubble, Progress } from '@hangul-route/design-system'`.
  - F-001 Hangul Tile Game 구현 PR 가 이 컴포넌트들을 소비.
- F-002 의 status 는 promotion PR merge 와 동시에 `shipped` 로 이동.

## 막힐 때 대응
- 4 컴포넌트 동시 promotion 이 30 분 초과 → HoyaBubble + Progress 만 오늘, Button + Card 는 월요일 추가 PR (둘은 다른 컴포넌트에 적게 의존).
- 토큰 drift 발견 → F-DES-001 가 PR CI 를 막음 — 디자인 spec 표 vs styles.ts 의 토큰 키를 1:1 맞추고 재 push.
- Storybook 빌드 실패 → component-skill §6.5 의 provider 누락 점검.
- 테스트 환경에서 RN 모듈 import 오류 → vitest config 의 `environment: "node"` 가 jsdom 으로 안 바뀌었는지 (UI 컴포넌트 테스트는 jsdom 필요) 확인.

## 검토 체크리스트 (PR merge 전 필수)
- [ ] 4 컴포넌트 모두 5-파일 세트 완비
- [ ] Storybook story 가 모든 variant × state 커버
- [ ] component-skill §4 ✅ Do list 전부 통과 (named export / tokens-only / 64dp / a11y / TDD 분리 커밋)
- [ ] `pnpm -r run typecheck` green
- [ ] `pnpm -r run test` green, 새 테스트 ≥ 1 per component
- [ ] `node scripts/coverage-gate.mjs` — design-system 85% 충족
- [ ] `node scripts/check-token-drift.mjs` — drift 0
- [ ] F-002 spec status: `shipped`
- [ ] 시안 vs 구현 스크린샷 4 세트 PR 본문에 첨부
- [ ] PR 의 squash commit 제목: `design: promote W3 components to design-system`

## 다음 시안 연결
- Week 04 Monday: F-003 "Match Sound" minigame spec — 이 4 컴포넌트 모두 소비.
- Week 04 Tuesday–Friday: Stage 1 game shells (Match Sound / Build a Letter / Trace Stroke) 의 UI 가 이 4 컴포넌트로 조립.
- F-001 의 status 가 `ready` → `in-progress` 로 이동 (W4 첫 PR 에서).
