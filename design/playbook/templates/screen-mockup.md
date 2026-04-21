# Template — Screen Mockup Prompt

화면 전체 시안 (mid-fi 이상) 요청 베이스.

```prompt
Design a [SCREEN NAME] mockup for Hangul Route.

Context:
- Audience: English-speaking kids 5-11 learning Korean.
- Where this screen sits: [e.g. "first launch, before any learning"]
- What the child should do here: [1–2 concrete actions]
- Success = [observable outcome]

Design system inputs (authoritative — do not invent new values):
- Colors: design/tokens/colors.v1.md
- Typography: design/tokens/typography.v1.md
- Spacing / radii / shadows: design/tokens/spacing.v1.md
- Icons: design/icons/spec.md + design/icons/core.v1/
- Hoya poses: design/characters/hoya/v1/

Content rules:
- UI strings in English, CEFR Pre-A1. Use kid-friendly vocabulary.
- Korean appears only for learning targets. Always with romanization and
  English gloss.
- Hoya dialogue in English.

Deliverables:
- Annotated mockup (mobile portrait, 390×844 default).
- Token-annotated spec: every padding / color / text size points to the
  token name, not a raw value.
- Interaction notes: tap targets ≥ 64dp; transitions stay subtle.

Anti-patterns:
- Korean UI chrome (menu labels in Korean).
- Over-decorated backgrounds.
- More than 2 CTAs per screen.

[ATTACH wireframe from design/wireframes/ and any prior screen version.]
```

## 사용 팁
- 와이어프레임 없는 상태로 mockup 요청 금지 (CLAUDE.md §5).
- "annotate every value with token name" 를 꼭 넣어 — 하드코드 예방.
