# docs/tests/

테스트 전략과 커버리지 정책.

- `strategy.md` — TDD 원칙, 비즈니스 로직 vs 플랫폼 의존 분리
- `coverage-targets.md` — 패키지별 rolling target (W4 → 6 months)

## 요약
- 테스트 **없는** 코드 / 컴포넌트 머지 금지 (CLAUDE.md §5)
- 비즈니스 로직 계층은 90–100% 를 지향, 플랫폼 의존 계층(RN 네이티브, Cloudflare 런타임)은 70–80%
- 커버리지 측정은 `vitest --coverage`, E2E 는 별도(Detox / Playwright)
