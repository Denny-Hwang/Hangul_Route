---
name: component-skill
description: React 컴포넌트 구현·리뷰 시 자동 적용. 함수형·hooks·토큰 전용·접근성 64dp+ 규약 유지.
  apps/mobile / apps/web / packages/design-system 의 .tsx 생성·수정 시 트리거.
---

# Component Skill

React (Native / Web) 컴포넌트 구현·리뷰의 표준 절차. 파일 구조, TDD,
디자인 시안 근거, 토큰 사용, 접근성, 테스트 동반 커밋을 강제한다.

근거: `docs/blueprints/03-engineering-blueprint-v2.md`, `CLAUDE.md` §4, §5.

---

## 1. Trigger

자동 트리거 조건:

- 경로: `apps/mobile/src/**/*.tsx`
- 경로: `apps/web/src/**/*.tsx`
- 경로: `packages/design-system/src/components/**/*.tsx`
- 사용자 요청 키워드: "컴포넌트 추가", "새 화면", "Button 리팩터", "Storybook 스토리"
- PR 레이블: `component`

동반 Skills (자동):
- `test-skill` — 한 컴포넌트 = 한 테스트 파일 (동일 커밋)
- `design-handoff-skill` — 시안 → 컴포넌트 변환 시
- `design-system-skill` — 토큰 사용처 변경 시
- `minigame-skill` — 미니게임 컴포넌트는 본 Skill + minigame-skill 모두 준수

---

## 2. Precondition (작업 전 필수 확인)

- [ ] `docs/specs/F-XXX-*.md` 가 `status: ready`
- [ ] `design/components/<Name>/` 또는 `design/screens/<Name>/` 에 시안 존재 — 없으면 구현 금지
- [ ] (선행) `design/wireframes/` 에 대응 와이어프레임 존재
- [ ] `packages/design-system` 에 필요한 토큰·하위 컴포넌트 (Button, Text, Surface 등) 준비됨
- [ ] `apps/mobile` 이면 `src/logic/` vs `src/platform/` 위치 판단
- [ ] 컴포넌트 타입 (presentational / container / screen / hook) 명확

누락 시:

> "F-XXX 사양·시안 중 [...] 이 준비되지 않아 구현 시작 불가.
> 먼저 [wireframe / frontend-design / design-system] 을 완료해 주세요."

---

## 3. Standard Procedure

### 3.1 파일 구조 (강제)

컴포넌트당 폴더 1개:

```
ComponentName/
├── ComponentName.tsx          # 구현
├── ComponentName.test.tsx     # 테스트 (동시 커밋)
├── ComponentName.stories.tsx  # Storybook (동시 커밋)
├── types.ts                   # Props·도메인 타입
├── styles.ts                  # 토큰 기반 스타일 선언
└── index.ts                   # named re-export only
```

- 폴더명·파일명 = `PascalCase.tsx` (컴포넌트 파일), 그 외 `kebab-case.ts` 는 사용 안 함
- **`index.ts` 는 re-export 전용** — 로직 삽입 금지 (측정 제외 대상)

### 3.2 TDD 순서 (test-skill §3.1 준수)

1. **레드** — `ComponentName.test.tsx` 에 실패 테스트 작성·실행
2. **그린** — `ComponentName.tsx` 최소 구현
3. **리팩터** — 테스트 통과 유지하며 구조 개선
4. **Storybook** — `ComponentName.stories.tsx` 추가 (variant 별 스토리)

세 단계를 **커밋 분리**:

```
test(mobile): add failing spec for Button component (F-023)
feat(mobile): implement Button to satisfy spec
refactor(mobile): extract pressed-state hook (optional)
```

### 3.3 컴포넌트 작성 규칙

- **함수형 + hooks 만.** 클래스 컴포넌트 금지.
- **Named export 만.** `default export` 금지 (tree-shaking·grep 편의).
- **Props 타입은 `types.ts`** 에 분리. `ComponentNameProps` 네이밍.
- **스타일은 `styles.ts`** 에 토큰 참조로 선언. 인라인 스타일·리터럴 값 금지.
- **상태 관리**: 지역은 `useState` / `useReducer`, 전역은 `zustand`.
- **서버 상태**: `@tanstack/react-query`.
- **사이드 이펙트**: `useEffect` 최소화. 가능하면 이벤트 핸들러로.

### 3.4 접근성 (child-focused + WCAG AA)

- 터치 영역 **≥ 64dp** (Fitts's law; 어린이 엄지)
- 색상만으로 정보 전달 금지 (아이콘·모양·텍스트 중복)
- 텍스트 대비 WCAG AA 이상 (7:1 권장 for 5-7세)
- `accessibilityLabel` / `accessibilityRole` (RN) 또는 `aria-*` (Web) 필수
- 키보드 포커스 (웹) / TalkBack·VoiceOver (모바일) 동선 검증
- 애니메이션 `prefers-reduced-motion` 대응

### 3.5 apps/mobile 의 logic / platform 분리

- `src/logic/` — 순수 TS. RN 모듈 import 금지. 컴포넌트도 가능하면 props 로만 동작하는 presentational 은 여기.
- `src/platform/` — `react-native` 의 `Animated`, `Camera`, `AsyncStorage` wrapper, `Audio` 등.
- 한 컴포넌트가 두 영역을 섞지 말 것. 섞이면 logic 훅 + platform 래퍼로 분해.

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ 함수형 + hooks
- ✅ Named export (`export const Button = ...`)
- ✅ Props 타입 `types.ts` 분리
- ✅ 스타일은 `packages/design-system` 토큰만 (`tokens.color.brand.primary` 등)
- ✅ 터치 영역 ≥ 64dp
- ✅ `accessibilityLabel` / `aria-*` 필수
- ✅ 테스트·Storybook 동일 커밋 (TDD 패턴)
- ✅ Props interface 에 `/** */` JSDoc 없이 자명한 네이밍 (Storybook args-table 가 설명 대체)

### ❌ 하지 말아야 하는 것

- ❌ 클래스 컴포넌트
- ❌ `default export`
- ❌ `any` 타입
- ❌ 인라인 색상·수치 (`{ color: '#fff' }`, `{ marginTop: 16 }`)
- ❌ `console.log` production 커밋
- ❌ 테스트 없이 커밋
- ❌ Storybook 없이 머지
- ❌ `AsyncStorage` / `localStorage` 직접 호출 (차후 `packages/hooks` 래퍼 경유)

### 코드 예시

```tsx
// ✅ 좋은 예 — packages/design-system/src/components/Button/Button.tsx
import { Pressable, Text } from 'react-native';
import { tokens } from '../../tokens';
import { styles } from './styles';
import type { ButtonProps } from './types';

export const Button = ({ label, onPress, variant = 'primary', disabled }: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.base,
      styles[variant],
      pressed && styles.pressed,
      disabled && styles.disabled,
    ]}
    hitSlop={tokens.hitSlop.comfortable}
  >
    <Text style={styles.label}>{label}</Text>
  </Pressable>
);
```

```ts
// ✅ types.ts
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}
```

```ts
// ✅ styles.ts — 토큰 참조만
import { StyleSheet } from 'react-native';
import { tokens } from '../../tokens';

export const styles = StyleSheet.create({
  base: {
    minWidth: tokens.size.touchTarget.min,     // 64dp
    minHeight: tokens.size.touchTarget.min,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: tokens.color.brand.primary },
  secondary: { backgroundColor: tokens.color.surface.muted },
  danger: { backgroundColor: tokens.color.feedback.danger },
  pressed: { opacity: tokens.opacity.pressed },
  disabled: { opacity: tokens.opacity.disabled },
  label: { ...tokens.typography.label, color: tokens.color.text.onBrand },
});
```

```tsx
// ❌ 나쁜 예 — 위반 다수
export default class Button extends React.Component {   // ❌ class, default
  render() {
    return (
      <Pressable
        onPress={this.props.onPress as any}              // ❌ any
        style={{ backgroundColor: '#FFD93D', padding: 12 }}  // ❌ 리터럴
      >
        <Text>{this.props.label}</Text>                   // ❌ 접근성 누락
      </Pressable>
    );
  }
}
```

---

## 5. Output Validation

### 자동 검증 (CI)

- `ci.yml` — typecheck + lint + test
- `coverage-gate.yml` — 컴포넌트 파일은 테스트 동반 + rolling target 유지
- `design-token-sync.yml` — 스타일이 토큰만 사용하는지 (하드코딩 탐지 lint rule)

### 수동 체크리스트 (PR 제출 전)

- [ ] 5개 파일 (tsx / test / stories / types / styles / index) 모두 추가
- [ ] TDD 커밋 순서 (test → feat → refactor) 준수
- [ ] Storybook 에서 variant·상태 (pressed / disabled / loading) 각각 스토리
- [ ] 64dp 터치 영역 확인 (디바이스 시뮬레이터)
- [ ] 스크린리더 동선 확인 (TalkBack·VoiceOver·web aria)
- [ ] `prefers-reduced-motion` 테스트 (애니메이션 있으면)
- [ ] 시안 vs 구현 스크린샷 나란히 PR 본문에 첨부

---

## 6. Failure Handling

### 6.1 시안에 없는 상태가 필요할 때

- 예: 시안에 loading 상태 없는데 구현상 필요
- 추가 상태를 임의로 구현하지 말고, `design/components/<Name>/spec.md` 에 질문 기록
- frontend-design-skill 로 되돌아가 시안 보강 (별도 PR)

### 6.2 토큰이 없을 때 (새로운 색·간격이 필요)

- 구현 파일에 하드코딩 절대 금지
- `design-system-skill` 절차로 토큰 먼저 추가 (별도 PR)
- 그 PR 머지 후 컴포넌트 PR 진행

### 6.3 접근성 요구를 만족 못 할 때

- 예: 시안이 3:1 대비라서 AA 미달
- 시안 수정 요청이 우선 (별도 PR)
- 임시로 "알려진 위반" 을 `docs/design/a11y-debt.md` 에 기록하되 머지 차단

### 6.4 테스트가 어려운 플랫폼 의존 코드

- logic 훅으로 비즈니스 로직 추출 → vitest 로 테스트
- platform wrapper 는 smoke 수준 테스트 + Detox (nightly)

### 6.5 Storybook 에서 렌더링 실패

- 원인 분류: (a) context provider 누락 (b) 토큰 참조 경로 오타
- `packages/design-system/.storybook/preview.tsx` 에 공통 provider 등록
- 해결 전까지 머지 차단

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `test-skill` | 컴포넌트 = 테스트 동시 커밋 (TDD 강제) | test-skill 이 기준 |
| `design-handoff-skill` | 시안 → 컴포넌트 변환 | design-handoff → component |
| `design-system-skill` | 토큰·기본 컴포넌트 제공 | design-system → component |
| `wireframe-skill` · `frontend-design-skill` | 선행 단계 | wireframe → frontend-design → component |
| `minigame-skill` | 미니게임 컴포넌트는 본 Skill 준수 + 게임 인터페이스 추가 | 병행 적용 |

---

## 8. Examples

### 8.1 좋은 예 — 테스트 먼저 커밋 (레드)

```tsx
// Button.test.tsx
import { render, screen } from '@testing-library/react-native';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('label 이 accessibilityLabel 로 노출된다', () => {
    render(<Button label="Continue" onPress={() => {}} />);
    expect(screen.getByRole('button')).toHaveAccessibleName('Continue');
  });

  it('press 하면 onPress 가 1회 호출된다', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Button label="Continue" onPress={onPress} />);
    await user.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled 이면 press 해도 onPress 호출되지 않는다', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Button label="Continue" onPress={onPress} disabled />);
    await user.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

### 8.2 좋은 예 — Storybook 스토리

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = { component: Button };
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { label: 'Continue', onPress: () => {} } };
export const Secondary: Story = { args: { label: 'Later', variant: 'secondary', onPress: () => {} } };
export const Danger: Story = { args: { label: 'Delete', variant: 'danger', onPress: () => {} } };
export const Disabled: Story = { args: { label: 'Continue', disabled: true, onPress: () => {} } };
```

### 8.3 나쁜 예 — 커밋 구조 위반

```
commit: feat(mobile): add Button + tests + stories + types + styles
   ^ 모두 한 커밋에 섞임 — TDD 레드-그린 경계 상실
```

```
commit: feat(mobile): add Button         # 본체만
(다음 PR 에서) test(mobile): add Button tests
   ^ 테스트가 동반되지 않음 — 머지 차단
```

---

## 9. Quick Reference

```
# 새 컴포넌트 스캐폴드 (권장)
pnpm gen:component --name Button --package design-system

# 단일 컴포넌트 테스트 watch
pnpm vitest src/components/Button

# Storybook 로컬
pnpm --filter @hangul-route/design-system storybook
```

커밋 메시지 템플릿:
```
test(<scope>): add failing spec for <Component> (F-XXX)
feat(<scope>): implement <Component> per spec (F-XXX)
refactor(<scope>): ...   # optional
```
