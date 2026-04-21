# Design Tokens 규약

## 원칙
- 모든 하드코딩 금지 (색·간격·타이포·반경·그림자).
- Single source of truth = `packages/design-system/src/tokens.ts`.
- `design/tokens/*.md` 는 **디자인 초안**이며, 확정 후 tokens.ts 로 승격.
- 승격 경로는 `.github/workflows/design-token-sync.yml` 이 검증.

## 카테고리
- `colors` — primary / secondary / accent / semantic / neutral
- `typography` — scale, fontFamily, weight, lineHeight, letterSpacing
- `spacing` — 4pt base, 0/1/2/3/4/5/6/8/10/12/16 스케일
- `radii` — sm / md / lg / full
- `shadows` — elev-1/2/3

## 네이밍
- Semantic 토큰 우선: `colors.surface.primary` (✅) vs `colors.blue500` (❌).
- 크기 단위는 dp/pt 문맥 중립 숫자로 (플랫폼에서 매핑).

## 사용
```ts
import { tokens } from "@hangul-route/design-system/tokens";

const styles = StyleSheet.create({
  button: {
    backgroundColor: tokens.colors.brand.primary,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radii.md,
  },
});
```

색상 리터럴(`#fff`, `rgb(...)`) 직접 사용은 ESLint 룰로 차단한다 (룰 구현은 별도 PR).
