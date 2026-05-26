# Stage 1 — Hangul

Korea's alphabet, one letter at a time. 24 jamo (14 consonants + 10 vowels)
and 24 matching Heritage Cards earned through play.

## Files

| File | What's inside |
|---|---|
| `jamo.json` | 24 jamo with romanization + a kid-friendly Korean example word |
| `cards.json` | 24 Heritage Cards, one per jamo, mapped across 5 culture themes |

## Language policy

Every Korean string lives in a `ko` field and is paired with `romanization`
(Revised Romanization) and an English gloss (`en`). UI strings stay English
(CEFR Pre-A1). Enforced by `scripts/validate-content.mjs` (F-CNT-001).

## Theme distribution (cards)

- **Letters** (4): 호랑이 ⋅ K-pop ⋅ 책 ⋅ 한글
- **Life** (7): 강아지 ⋅ 사과 ⋅ 우유 ⋅ 라면 ⋅ 어묵 ⋅ 우산 ⋅ 한복
- **Rites** (4): 보름달 ⋅ 태극기 ⋅ 아리랑 ⋅ 이불
- **Nature** (5): 나비 ⋅ 무궁화 ⋅ 여우 ⋅ 오리 ⋅ 잠자리
- **Crafts** (4): 팽이 ⋅ 인형 ⋅ 그네 ⋅ 윷놀이 ⋅ 야구

> Note: counts add to 24. The earliest letters lean Life/Nature (closer
> to a 5-year-old's world) and later letters introduce Rites/Crafts.
