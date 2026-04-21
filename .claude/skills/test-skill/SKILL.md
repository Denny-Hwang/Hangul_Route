---
name: test-skill
description: 테스트 작성·리뷰 시 자동 적용. TDD 강제, business vs platform 분리, rolling 커버리지 목표.
---

# Test Skill (placeholder — 본문은 별도 PR)

TDD 를 강제한다 — 한 커밋 = 테스트 + 구현. 비즈니스 로직은 `vitest` 로 순수 테스트 (`apps/mobile/src/logic/`), 플랫폼 의존은 스모크 수준 (`apps/mobile/src/platform/`). Rolling 목표는 `docs/tests/coverage-targets.md`, 전체 전략은 `docs/tests/strategy.md`. Fixture 는 `@hangul-route/test-utils` 경유.
