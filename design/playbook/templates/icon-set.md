# Template — Icon Set Prompt

아이콘 묶음 시안 요청 베이스.

```prompt
Design an icon set [VERSION e.g. v1] for Hangul Route.

Shared spec (do not break):
- 24×24 viewBox
- 2px stroke, rounded line caps and joins
- Corner radius 2px on rectangles (matches tokens.radii.sm)
- Single-color line icons — color injected by consumer, stroke is neutral[700]
- Legible at 16×16 to 48×48
- Visual language matches Hoya (design/characters/hoya/spec.md)

Icons in this batch:
1. [name — 1-line intent]
2. ...

Deliver:
- Single-sheet preview (grid view of all icons at 24×24).
- Individual SVG source for each.
- Updated design/icons/spec.md if shared rules change.

Anti-patterns:
- Aggressive shapes for "x" / "error" (use soft rounded).
- Korean workbook markings (red circle, red X).
- Two-tone / gradient fills.

[ATTACH palette, spacing/radii, previous icon set if iterating.]
```

## 사용 팁
- 일관성이 깨지면 "regenerate ALL [N] icons in one unified pass" 요청.
- SVG 가 안 나오면 PNG 받고 주말 수기 변환 — 월요일 보강 커밋 예약.
