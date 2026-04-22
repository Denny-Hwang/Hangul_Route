---
name: design-system-skill
description: packages/design-system/** 변경 시 자동 적용. 토큰·컴포넌트·아이콘의 export 규약 유지.
  design/tokens/ ↔ packages/design-system/ 동기화, 토큰 네이밍·컴포넌트 props 패턴 강제.
---

# Design System Skill

`packages/design-system` 의 export 구조·토큰 네이밍·컴포넌트 props 패턴을
일관되게 유지한다. 모든 visual 값은 토큰 경유. `design/tokens/` 는 sources
of truth, `packages/design-system/` 는 implementation. 둘의 동기화는
`design-token-sync.yml` CI 가 차단 검증한다.

근거: `docs/blueprints/02-core-feature-spec.md`, `docs/blueprints/03-engineering-blueprint-v2.md`,
`CLAUDE.md` §4 (스타일), §5 (동기화 CI).

---

## 1. Trigger

자동 트리거 조건:

- 경로: `packages/design-system/**`
- 경로: `design/tokens/**`
- 경로: `design/icons/**`, `design/characters/hoya/**` (승격 대상)
- 사용자 요청 키워드: "토큰 추가", "새 색상", "컴포넌트 export", "아이콘 추가"
- PR 레이블: `design-system`

동반 Skills:
- `design-handoff-skill` — 시안 → 토큰·컴포넌트 승격 단계
- `component-skill` — design-system 안의 컴포넌트도 component-skill 준수
- `test-skill` — 토큰 스냅샷·컴포넌트 테스트 동반

---

## 2. Precondition (작업 전 필수 확인)

- [ ] `design/tokens/<category>.v<n>.md` 에 원본 값·rationale 기록되어 있나
- [ ] `design/tokens/` 와 `packages/design-system/src/tokens/` 의 version 이 일치하나
- [ ] `frontend-design-skill` 단계에서 시각적 결정이 확정되었나 (신규 색·간격 등)
- [ ] WCAG AA contrast 검증 결과 확보 (신규 색 추가 시 필수)
- [ ] TypeScript 타입이 자동 생성 (generator) 되는 구조인지 확인

누락 시:

> "design/tokens/color.v2.md 가 없거나 이전 버전과 diff 가 문서화되지 않았습니다.
> 토큰 원본부터 작성하고 rationale 을 추가한 뒤 승격해 주세요."

---

## 3. Standard Procedure

### 3.1 Package export 구조

`packages/design-system/` 의 공개 엔트리:

```
packages/design-system/
├── src/
│   ├── tokens/
│   │   ├── color.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── radius.ts
│   │   ├── motion.ts
│   │   ├── sound.ts
│   │   ├── size.ts         # touchTarget.min 등
│   │   ├── opacity.ts
│   │   └── index.ts         # export const tokens = { color, typography, ... }
│   ├── components/
│   │   ├── Button/
│   │   ├── Text/
│   │   ├── Surface/
│   │   └── index.ts
│   ├── icons/
│   │   ├── <IconName>.tsx
│   │   └── index.ts
│   ├── characters/
│   │   └── Hoya/
│   └── index.ts
```

- 소비자는 `import { tokens, Button, Hoya } from '@hangul-route/design-system'` 로만 접근
- `*/index.ts` 는 re-export 전용 (커버리지 측정 제외)

### 3.2 토큰 네이밍 (semantic > literal)

- ✅ `color.brand.primary`, `color.surface.muted`, `color.text.onBrand`
- ✅ `color.feedback.success`, `color.feedback.danger`
- ✅ `spacing.sm / md / lg / xl`, `radius.sm / md / lg / pill`
- ✅ `typography.label / body / title / display`
- ✅ `size.touchTarget.min` (64), `size.touchTarget.comfortable` (72)
- ✅ `motion.duration.fast / normal / slow`, `motion.easing.standard / entrance / exit`
- ❌ `color-1`, `color-2`, `primary-blue` (semantic 아님)
- ❌ `spacing.16`, `spacing.px24` (literal)

### 3.3 토큰 승격 절차 (design/ → packages/)

1. `design/tokens/color.v<n>.md` 에 원본 스펙·rationale 확인
2. `packages/design-system/src/tokens/color.ts` 에 동일 값으로 추가·수정
3. WCAG AA 이상 contrast 검증 (`scripts/validate-contrast.ts`)
4. TypeScript 타입 재생성 (`pnpm gen:tokens`)
5. Storybook 토큰 페이지 업데이트 확인
6. `design-token-sync.yml` 로컬 dry-run (`pnpm design:validate`)
7. 변경된 토큰 사용처 테스트 전부 재실행
8. Visual regression (Storybook snapshot) 이 변경 토큰 반영하는지 확인

### 3.4 Week-01 playbook 과의 연결

`design/playbook/week-01/` 의 일일 가이드 ↔ 이 Skill:

| Day | 주제 | 산출물 경로 | 금요일 승격 대상 |
|---|---|---|---|
| Mon | color | `design/tokens/color.v1.md` | `tokens/color.ts` |
| Tue | typography | `design/tokens/typography.v1.md` | `tokens/typography.ts` |
| Wed | spacing / radius | `design/tokens/space.v1.md` | `tokens/spacing.ts`, `radius.ts` |
| Thu | motion / sound | `design/tokens/motion.v1.md` | `tokens/motion.ts`, `sound.ts` |
| Fri | 일괄 승격 PR | — | `design-system` 패키지 전체 |

월-목 산출은 `design/` 에만 머물고, 금요일에 하나의 PR 로 `packages/` 에 승격.

### 3.5 컴포넌트 props 패턴

- `ComponentNameProps` 인터페이스는 `types.ts` 에 분리
- Variant 는 union string (`'primary' | 'secondary'`) — enum 금지
- 이벤트 핸들러는 `on<Event>` (`onPress`, `onChange`)
- 제어/비제어 props 는 `<name>` / `default<Name>` 페어
- children 은 받지만 layout 만. 복잡 children 은 slots 으로 대체
- 접근성 props 는 외부 override 가능 (`accessibilityLabel?: string`)

### 3.6 아이콘 export

- 모든 아이콘은 `design/icons/<name>.svg` (단색, `currentColor` 대체 가능)
- `pnpm gen:icons` 스크립트가 `src/icons/<IconName>.tsx` 로 React 컴포넌트 생성
- 직접 `.tsx` 수정 금지 — 다음 generate 시 덮어쓰임

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ 모든 visual 값은 토큰 경유
- ✅ Semantic 네이밍 (brand / surface / text / feedback)
- ✅ 신규 색은 contrast AA 이상 검증 통과
- ✅ 승격 전 `design/tokens/` 의 version + rationale 선행 작성
- ✅ `*/index.ts` 는 re-export only
- ✅ 토큰 변경 시 모든 사용처 테스트 실행
- ✅ Storybook 토큰 페이지 자동 반영

### ❌ 하지 말아야 하는 것

- ❌ 리터럴 색상·수치 하드코딩 (`#FFD93D`, `marginTop: 16`)
- ❌ literal / numeric 토큰 네이밍 (`color-1`, `spacing.16`)
- ❌ `packages/design-system/` 값 변경을 `design/tokens/` 업데이트 없이 하기
- ❌ default export
- ❌ component API 에서 enum 사용 (union string 권장)
- ❌ `any` 타입·`unknown` 우회
- ❌ 사용처 영향 분석 없이 토큰 이름 rename

### 토큰 예시

```ts
// ✅ packages/design-system/src/tokens/color.ts
export const color = {
  brand: {
    primary: '#5B3FFF',     // L0 indigo — tokens/color.v1.md §2.1
    primaryPressed: '#4A32E0',
  },
  surface: {
    base: '#FFFFFF',
    muted: '#F4F1FA',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#1A1229',
    onBrand: '#FFFFFF',
    muted: '#5C5470',
  },
  feedback: {
    success: '#1FB66E',
    danger: '#E6476A',
    warning: '#F2A024',
  },
} as const;
```

```ts
// ❌ 나쁜 예
export const color = {
  primaryBlue: '#5B3FFF',           // ❌ literal naming
  c1: '#F4F1FA',                    // ❌ 번호만
  textDark: 'rgb(26, 18, 41)',      // ❌ rgb 혼용
};
```

---

## 5. Output Validation

### 자동 검증 (CI)

- `design-token-sync.yml`:
  - `design/tokens/` version 의 값 ↔ `packages/design-system/src/tokens/` 값 비교
  - 불일치 시 PR 차단 + diff 리포트
- `ci.yml`:
  - ESLint rule: 리터럴 색상·간격 탐지 (프로젝트 커스텀 rule)
  - TypeScript typecheck
  - `validate-contrast.ts` 스크립트
- `coverage-gate.yml`:
  - `packages/design-system` target 85%

### 수동 체크리스트

- [ ] `design/tokens/` 파일과 `packages/design-system/src/tokens/` 값 일치
- [ ] 신규 색 WCAG AA 통과 로그 첨부
- [ ] Storybook 의 토큰 페이지 렌더 확인
- [ ] 변경 토큰 사용처 수 확인 (`grep -r 'tokens.color.brand.primary' apps packages`)
- [ ] 사용처 visual snapshot 검토 (Storybook 또는 스크린샷)
- [ ] TypeScript 타입 재생성 완료

---

## 6. Failure Handling

### 6.1 `design-token-sync.yml` 차단

1. diff 리포트에서 mismatch 식별
2. source of truth 는 `design/tokens/` — `packages/` 를 맞추는 방향이 기본
3. 만약 `packages/` 에 먼저 값을 넣었다면, `design/tokens/` 버전을 올려 rationale 추가 (별도 커밋)
4. 해결 전까지 머지 금지

### 6.2 Contrast AA 미달

- 색을 조정하거나 (더 어둡게/밝게) 배경 쌍을 변경
- 시안 전체의 색 조합이 문제면 frontend-design-skill 로 돌아가 재시안
- AA 미달인데 "알려진 예외" 처리 하려면 `docs/design/a11y-debt.md` 기록 + 승인 이슈

### 6.3 토큰 rename 이 필요할 때

- `deprecated` 주석으로 기존 토큰 한 시즌 유지
- codemod 또는 grep 으로 사용처 전수 변경 (별도 PR)
- 최소 1 주기 후 삭제

### 6.4 아이콘 generator 실패

- `design/icons/` 의 SVG 형식 오류 (viewBox 누락, multi-fill) 가능
- SVG 원본 수정 후 재생성
- 임시로 수동 `.tsx` 작성 금지 (CI 가 generated 와 비교 실패)

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `design-handoff-skill` | 시안 → 토큰 승격의 구체 절차 | design-handoff 가 이 Skill 을 consume |
| `frontend-design-skill` | 시각적 결정 원본 | frontend-design → design-system |
| `component-skill` | design-system 컴포넌트 구현 시 동일 적용 | 병행 |
| `test-skill` | 토큰 및 컴포넌트 테스트 | 병행 |

---

## 8. Examples

### 8.1 좋은 예 — 토큰 추가 PR 흐름

```
1. design/tokens/color.v2.md 에 추가 (rationale + WCAG 증거)
2. packages/design-system/src/tokens/color.ts 에 동일 추가
3. scripts/validate-contrast.ts 실행 → 통과 로그 첨부
4. Storybook 토큰 페이지 스크린샷 확인
5. 사용처 추가 (별도 PR 권장)

Commit: design-system: add color.feedback.success-muted (v2 tokens)
```

### 8.2 좋은 예 — 컴포넌트 export 일관성

```ts
// packages/design-system/src/components/index.ts
export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button/types';
export { Text } from './Text';
export type { TextProps, TextKind } from './Text/types';
export { Surface } from './Surface';
export type { SurfaceProps } from './Surface/types';
```

```ts
// packages/design-system/src/index.ts
export * from './tokens';
export * from './components';
export * from './icons';
export { Hoya } from './characters/Hoya';
```

소비자:
```ts
import { tokens, Button, Hoya, type ButtonVariant } from '@hangul-route/design-system';
```

### 8.3 나쁜 예 — 회피 패턴

```ts
// ❌ design/tokens 업데이트 없이 packages 에만 추가
// packages/design-system/src/tokens/color.ts
primary: '#6B4FFF',  // ← source 없이 임의 변경. CI 차단.
```

```ts
// ❌ default export 섞임
export default Button;  // CI lint 차단
```

```ts
// ❌ 리터럴 네이밍
export const color = {
  blue1: '#5B3FFF',    // ← semantic 아님
  blue2: '#4A32E0',
};
```

---

## 9. Quick Reference

```bash
# 토큰 생성·검증
pnpm --filter @hangul-route/design-system gen:tokens
pnpm --filter @hangul-route/design-system gen:icons
pnpm design:validate          # design/ ↔ packages/ diff

# Storybook
pnpm --filter @hangul-route/design-system storybook

# Contrast
pnpm --filter @hangul-route/design-system validate:contrast
```

커밋 메시지:
```
design-system: promote color tokens v2 (Mon-Thu playbook)
design-system: add Hoya excited expression icon
design-system(typo): rename text.secondary → text.muted + codemod
```
