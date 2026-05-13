---
date: week-03 / Monday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/components/Button/spec.md
  - design/components/Button/v1.png
  - design/components/Button/variants.png
depends_on:
  - packages/design-system/src/tokens.ts (W1 promotion 완료 가정)
  - design/wireframes/* (W2 산출물 — Button 자리)
unblocks:
  - Wed HoyaBubble (Button 을 bubble 내 CTA 로 재사용)
  - Fri promotion PR (Button → packages/design-system/src/components/Button/)
  - F-001 Hangul Tile Game (Continue / Next CTA 자리)
---

# Day 01 — Monday · Button component v1

## 오늘의 목표
**Button v1** 시각 스펙 확정. 3 variant (primary / secondary / tertiary) × 4 state (default / pressed / disabled / loading) = 12 셀의 variant matrix 와 props 표를 `design/components/Button/spec.md` 에 박는다. 이 결정이 이번 주 나머지 3 컴포넌트의 톤·간격·radius 룰을 좌우.

## 왜 오늘
- W2 와이어프레임 11 화면 중 **거의 모든 CTA 가 Button**. 이게 흔들리면 화면 시안화가 흔들린다.
- component-skill §3.3 의 "named export · 토큰 전용 · 64dp" 규약은 코드 단계 규약이지만, 디자인이 이를 가정한 모양으로 나와야 코드 승격 시 마찰 0.
- Button 의 hit-slop / 외곽 radius 가 Card 와 HoyaBubble 의 외곽 radius 룰을 정함 — 시각 일관성의 출발점.

## 사전 준비 (1분)
- 어제까지 `packages/design-system/src/tokens.ts` 가 W1 promotion 됐는지 확인. 안 됐으면 W1 promotion PR 먼저 닫고 오늘은 롤오버.
- 레퍼런스 1 탭: Duolingo Kids 의 Continue 버튼 (foreground / pressed 단계 비교).
- 금지 상기: 인라인 색·간격, default export, class 컴포넌트, `any`.

## Claude Design 프롬프트 (복붙)

```prompt
Design Button v1 for Hangul Route — the primary tappable affordance
used across onboarding, journey, quest, library, and results screens.

Audience: English-speaking children 5–11. UI text English.

Strict constraints (from .claude/skills/component-skill/SKILL.md §3 & §4):
- Touch target ≥ 64 × 64 dp (Fitts's law, child thumb).
- Visual props consume design tokens only — colors.brand.primary,
  spacing.md, radius.md, etc. NO hex literals, NO pixel literals.
- Pressed and disabled states must be distinguishable from default in
  BOTH color AND shape/opacity (color-blind safe).
- WCAG AA contrast for body text on button surface (4.5:1 large, 7:1
  preferred for 5-7yo).
- prefers-reduced-motion: pressed-state scale/opacity transition
  collapses to instant color change.

Variants (3) × States (4) = 12-cell matrix:

Variants:
1. primary   — bg = colors.brand.primary, label = colors.text.onBrand
2. secondary — bg = colors.surface.muted, label = colors.text.default,
               outlined 1-token border in colors.border.muted
3. tertiary  — bg = transparent, label = colors.text.brand, no border,
               used as in-bubble inline link

States:
- default  — full opacity
- pressed  — opacity.pressed (~0.85), brief 1.0→0.97→1.0 scale (120ms)
- disabled — opacity.disabled (~0.4), no press feedback, hit-slop OFF
- loading  — opacity.default, label hidden, spinner placeholder centered;
             onPress ignored

Output:
- design/components/Button/v1.png  (single button at rest, primary)
- design/components/Button/variants.png  (12-cell grid)
- design/components/Button/spec.md with sections:
  1. Purpose (1 paragraph)
  2. Variants & states (12-cell matrix + token references per cell)
  3. Props table (label, onPress, variant, disabled, loading, leadingIcon)
  4. Accessibility (role, label, focus, reduced-motion behavior)
  5. Token usage (table of every token referenced)
  6. Anti-patterns (5 bullets)
  7. Open questions (≤ 3)

Mark hit-slop = tokens.hitSlop.comfortable (covers 64dp even when
visual size is smaller).
```

## 작업 흐름 (10분)
1. 프롬프트 실행 → variants.png 12-cell matrix 먼저 확인.
2. **primary pressed 가 default 와 색만 다르고 형상 변화 없으면** "add 1px inset / subtle scale-down so color-blind users see motion".
3. **disabled 가 너무 죽어 보이면** (opacity.disabled 4 미만) "raise opacity from 0.3 to 0.4 — still readable".
4. spec.md 의 Token usage 표가 빠진 토큰 없는지 (특히 hit-slop) 확인.
5. Open questions 가 ≤ 3 인지 — 더 많으면 W4 INBOX 로.

## 결과 저장 (3분)
1. 3 파일 (`v1.png`, `variants.png`, `spec.md`) 을 `design/components/Button/` 아래 저장.
2. `design/prompts.md` 오늘자 엔트리 추가.
3. 커밋: `design(component): add Button v1 spec + variants`.

## Code 다음 단계 안내
- 금요일 promotion PR 에서 `packages/design-system/src/components/Button/` 5-파일 세트 (`Button.tsx` / `Button.test.tsx` / `Button.stories.tsx` / `types.ts` / `styles.ts` / `index.ts`) 로 옮긴다 (component-skill §3.1).
- F-001 의 §3.1 "[[ Next ]]" CTA, F-001 의 §3.2 의 tile 자체는 Button 이 아니라 Tile 컴포넌트 — 혼동 금지 (Tile 은 W4 작업).

## 막힐 때 대응
- 12-cell matrix 가 비대칭 (variant 별 state 가 다름) → "all 4 states for every variant; if not applicable, mark as N/A explicitly".
- pressed 가 color 만 다름 (color-blind 위험) → 위 §3 처럼 형상 변화 추가.
- 15 분 초과 → tertiary 는 화요일 앞 5 분으로 분리하고 오늘은 primary + secondary 만.

## 검토 체크리스트
- [ ] 12-cell matrix 가 시각·spec.md 양쪽 모두 명시
- [ ] 토큰 표가 모든 셀의 색·간격·radius 를 커버 (하드코딩 0)
- [ ] pressed / disabled 가 color + shape 둘 다 변경 (color-blind 안전)
- [ ] hit-slop 가 명시되어 64dp 보장
- [ ] loading 상태가 onPress 를 무시한다는 점이 props 표에 명시
- [ ] Anti-patterns 5 개에 default export / 클래스 / `any` / 하드코딩 포함

## 다음 시안 연결
- 화(Tue) Card 는 Button 의 radius.md / shadow.sm 룰을 상속.
- 수(Wed) HoyaBubble 의 in-bubble CTA 는 Button tertiary 변형을 재사용.
- F-001 의 Continue / Next CTA 자리에 Button primary 가 들어감.
