# Template — Color Palette Prompt

새 day 가이드 에서 색 팔레트 시안을 요청할 때 복사해서 시작하는 베이스.

```prompt
Design a color palette [VERSION e.g. v2] for Hangul Route.

Context:
- Audience: English-speaking kids ages 5-11 learning Korean from zero.
- Target revision: [WHAT'S CHANGING — e.g. "warmer primary", "darker neutrals
  for better body contrast", "add a tertiary accent for Stage 2"]
- Visual reference: Duolingo Kids, Khan Academy Kids, DragonBox.
- Anti-reference: Korean workbook red circles, oversaturated primaries,
  hanji/dancheong used as UI chrome.

Constraints:
- Primary / Secondary / Accent / 4 Semantic / 9-step Neutral.
- WCAG AA body contrast (4.5:1) on every surface intended for body text.
- Semantic names only (`brand.primary`, `surface.muted`) — no raw "blue500".
- Every color needs: name, hex, on-color that passes AA, 1-line use note.

Deliverables:
1. Markdown table of all colors.
2. Contrast check table: body text on each surface + primary button label.
3. PNG swatch sheet.

[PASTE previous palette if iterating, e.g. design/tokens/colors.v1.md]
[PASTE any additional constraint — e.g. "must not collide with partner
school's red logo"]
```

## 사용 팁
- 한 번에 완성 시도 X. 1차 제안 → "tone down saturation 20%" 같은 짧은 수정.
- 색 한 개가 불만이면 "keep everything, change only brand.primary to more coral" 로 격리.
