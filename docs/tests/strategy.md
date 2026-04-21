# Testing Strategy

## 원칙

1. **TDD 강제.** 테스트 없는 구현 커밋 금지. 한 커밋 = 테스트 + 구현.
2. **비즈니스 로직 vs 플랫폼 의존 분리.**
   - 비즈니스 로직 (순수 함수, reducer, validator, 스코어링) → 90–100%
   - 플랫폼 의존 (RN Animated, 카메라·마이크, Cloudflare D1/R2 어댑터) → 70–80%
3. **테스트는 한 가지를 검증.** 여러 시나리오가 섞이면 분리.
4. **Fixture 는 `@hangul-route/test-utils` 통해서만.** 테스트에 거대한 리터럴 금지.

## 레이어별 접근

### 순수 비즈니스 로직 (`packages/content-schema`, `packages/shared-types`, `packages/backend` 핵심)
- `vitest` 로 100% 지향.
- I/O 없는 순수 함수로 최대한 추출.
- `content-schema` 는 zod 스키마 자체를 테스트 대상 (valid/invalid fixture 둘 다).

### UI 컴포넌트 (`packages/design-system`, `apps/mobile`, `apps/web`)
- 비즈니스 로직 — `vitest` + `@testing-library` (90% target)
- 시각적/인터랙션 — Storybook + 스냅샷 또는 Playwright component test
- 플랫폼 애니메이션 — smoke test 수준 (70%)

### 플랫폼 어댑터 (`apps/api`, Cloudflare Workers)
- `vitest` + miniflare (D1/R2 로컬 에뮬레이션)
- 실제 Cloudflare 런타임 경계는 Workers 통합 테스트 (별도 워크플로우)

### E2E
- Mobile: Detox (Stage 1 핵심 플로우만)
- Web: Playwright (랜딩 + 웹 체험)
- CI 비용 감안하여 PR 마다 아님, nightly 만.

## TDD 흐름

1. 실패하는 테스트부터 작성 (`xtest` 로 skip 가능하나 레드 상태 유지).
2. 최소 구현으로 테스트 통과.
3. 리팩터 — 테스트가 계속 통과하는지 확인.
4. 커버리지 델타가 rolling target 에 기여하는지 확인.

## 금지 패턴

- ❌ 네트워크/파일시스템 실제 접근. `packages/test-utils` 의 mock 사용.
- ❌ `Math.random` / `Date.now` 직접 사용 without 주입. 테스트 가능하게 인자화.
- ❌ 대형 snapshot 에 의존한 UI 테스트 (인터랙션 기반 테스트 선호).
