---
name: design-system-skill
description: packages/design-system/** 변경 시 자동 적용. 토큰·컴포넌트·아이콘의 export 규약 유지.
---

# Design System Skill (placeholder — 본문은 별도 PR)

`packages/design-system` 의 export 구조 · 토큰 네이밍 · 컴포넌트 props 패턴을 일관되게 유지한다. 모든 visual 값은 토큰 경유, 하드코딩 금지. `design/tokens/*.v*.md` 와 값이 일치해야 하며, 불일치 시 `design-token-sync.yml` 이 PR 을 차단한다.
