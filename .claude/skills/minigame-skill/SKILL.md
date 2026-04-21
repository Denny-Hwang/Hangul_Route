---
name: minigame-skill
description: 미니게임(Stage 1 타일 등) 구현 시 자동 적용. 4 family / 12종 카탈로그 기반.
---

# Minigame Skill (placeholder — 본문은 별도 PR)

`docs/blueprints/06-mini-game-catalog.md` 의 4 family / 12 종 스펙을 기준으로 구현한다. 각 게임은 **순수 비즈니스 로직** (scoring, rule, progression) 과 **플랫폼 의존 레이어** (RN Animated, 사운드) 를 분리하여 테스트 가능하게 만든다. 실패·재시도는 호야 피드백으로 연결 (`docs/design/interaction-patterns.md`).
