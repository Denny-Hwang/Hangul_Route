# Components 규약

## 위치
- 범용 UI: `packages/design-system/src/components/`
- 앱 특화: `apps/*/src/components/`
- 게임 전용 (Stage 1 타일 등): `apps/mobile/src/games/` 또는 `apps/web/src/games/`

## 네이밍
- 파일: `PascalCase.tsx`
- Export default 금지. Named export (`export const HoyaBubble`) 만.
- Props 인터페이스: `HoyaBubbleProps` 명시적 export.

## 구조
1. 모든 컴포넌트는 함수형 + hooks. 클래스 컴포넌트 금지.
2. `any` 금지. Props 타입 명시적.
3. 기본값은 매개변수 기본값 또는 `defaultProps` 아닌 prop 자체에서.
4. Storybook story 필수 (`*.stories.tsx`).
5. 테스트 필수 (`*.test.tsx`).

## 디자인 토큰
- 모든 visual prop 은 토큰 경유.
- "임시로 한 번만" 하드코딩도 금지.

## 접근성
- Touch target ≥ 64dp (어린이 손가락 기준, `docs/design/tokens.md` 의 spacing 토큰 참조).
- 색 대비 WCAG AA 이상 (body 4.5:1, large 3:1).
- 음성/사운드 피드백이 있는 경우 시각 대응 필수 (sound-off 사용자 대응).
