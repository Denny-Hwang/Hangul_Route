# Stage 1 — Hangul

Korea's alphabet, one letter at a time. 24 jamo (14 consonants + 10 vowels)
and 24 matching Heritage Cards earned through play.

## Files

| File | What's inside |
|---|---|
| `jamo.json` | 24 jamo with romanization + an everyday Korean example word |
| `cards.json` | 24 Heritage Cards, one per jamo, mapped across 5 culture themes |

## Language policy

Every Korean string lives in a `ko` field and is paired with `romanization`
and an English gloss (`en`). UI strings stay English (CEFR Pre-A1).
The structure is enforced by `scripts/validate-content.mjs` (F-CNT-001).

`romanization` follows F-CNT-002 (`docs/specs/F-CNT-002-romanization-policy.md`):

- Revised Romanization of the **pronunciation**, not the spelling:
  `윷놀이` is `yunnori`, `한글날` is `hangeullal`, `같이` is `gachi`.
- **No hyphens**, no apostrophes, lower case except for names:
  `gangaji`, never `gang-a-ji`. A screen that shows syllable splits computes
  them with `syllableSplit()`; they are never stored.
- One romanized word per Korean word, with standard Korean spacing.
- Titles and `en` keep the usual English name (`K-pop`); `romanization`
  is the RR of the Hangul (`keipap`).
- In `jamo.json` a letter's `romanization` is its sound value and letter
  name from a fixed table, `"g/k (giyeok)"`, `"silent/ng (ieung)"`; the
  example word is an ordinary RR word.

The romanization suites check every value against the converter:
`corepack pnpm --filter @hangul-route/content-schema test romanization`.

## Theme distribution (cards)

- **Letters** (3): 책 ⋅ 케이팝 ⋅ 호랑이
- **Life** (6): 강아지 ⋅ 라면 ⋅ 밥 ⋅ 사과 ⋅ 어묵 ⋅ 우산
- **Rites** (4): 보름달 ⋅ 태극기 ⋅ 아리랑 ⋅ 이불
- **Nature** (6): 나비 ⋅ 무궁화 ⋅ 잠자리 ⋅ 여우 ⋅ 오리 ⋅ 용
- **Crafts** (5): 인형 ⋅ 팽이 ⋅ 야구 ⋅ 윷놀이 ⋅ 그네

> Note: counts add to 24. The earliest letters lean Life/Nature (everyday
> words) and later letters introduce Rites/Crafts.
