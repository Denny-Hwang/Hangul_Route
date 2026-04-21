---
name: component-skill
description: React 컴포넌트 구현·리뷰 시 자동 적용. 함수형·hooks·토큰 전용·접근성 64dp+ 규약 유지.
---

# Component Skill (placeholder — 본문은 별도 PR)

모든 컴포넌트는 함수형 + hooks, named export, `any` 금지, 토큰 전용 스타일. 64dp 이상의 터치 영역과 WCAG AA 대비를 확보한다. 컴포넌트 당 Storybook story 와 테스트 파일이 **동시에** 커밋되며, 빠져 있으면 PR 이 머지 불가능하다. 상세 규약은 `docs/design/components.md`.
