---
name: design-handoff-skill
description: 디자인 시안을 코드(토큰·컴포넌트·아이콘)로 승격할 때 자동 적용. design/ → packages/design-system 이행.
---

# Design Handoff Skill (placeholder — 본문은 별도 PR)

`design/tokens/*.v*.md`, `design/components/<Name>/spec.md`, `design/characters/hoya/v1/`, `design/icons/*.svg` 를 `packages/design-system/src/` 로 옮기는 절차. 승격은 값 변경 없이 일대일 이전이 원칙이며, 차이가 있으면 `design-token-sync.yml` 이 PR 을 차단한다. 자세한 흐름은 `docs/workflows/design-to-code.md`.
