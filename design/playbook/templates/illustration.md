# Template — Illustration Prompt

배경·카드·문화유산 일러스트 시안 베이스.

```prompt
Design an illustration — [SUBJECT, e.g. "heritage card: 단청 (Korean temple
eaves painting)"].

Context:
- Where it appears: [e.g. "cultural heritage card collection"]
- Audience: English-speaking kids 5-11.
- This is CONTENT (not UI chrome), so Korean cultural motif is WELCOME
  and encouraged.

Constraints:
- Pixar-influenced cartoon treatment.
- Palette from design/tokens/colors.v1.md — expand tastefully with 1–2
  content-specific accent colors (document them).
- Stylized, NOT photorealistic.
- Silhouette readable at card thumbnail size (roughly 160×220).
- Safe area: center 80% must carry the subject; outer 10% is bleed.

Deliverables:
- Hero illustration at 1024×1024 (SVG preferred, else PNG).
- Simplified thumbnail version (400×560 card aspect).
- A short "what it is" caption in English (2 sentences, CEFR Pre-A1).
- Optional Korean term to feature (with romanization + English gloss).

Anti-patterns:
- Didactic textbook look.
- Historical accuracy taken so seriously it stops being playful.
- Korean writing as decoration (OK as learning content, not as wallpaper).

[ATTACH previous cards in the set for stylistic consistency.]
```

## 사용 팁
- 카드 시리즈는 한 번에 연속 생성 요청 ("keep palette & stroke identical across the batch").
- 결과가 너무 학습지 느낌이면 "more playful, less pedagogical" 한 줄.
