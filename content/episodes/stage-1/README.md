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
and an English gloss (`en`). UI strings come from the learner's selected
locale (en, es or ko): English is the source, written at CEFR Pre-A1, in
`packages/i18n/src/messages/`, and the es and ko text is an overlay on it
(F-I18N-001). Translations of content text live in `content/i18n/`.
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
- In `jamo.json` a consonant's `romanization` is its sound value plus its
  letter name from a fixed table, `"g/k (giyeok)"`, `"silent/ng (ieung)"`;
  a vowel's is its sound value alone, `"a"`, `"eo"`. The example word is
  an ordinary RR word.

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

## Review log

**2026-10-13, age-free card copy (#589).** Card copy has no age wording (CLAUDE.md
section 1, owner decision D1); `apps/mobile/src/content/__tests__/card-age-words.test.ts`
now fails on "kid", "kids", "child" or "children" in a hand-written card or in this file,
and on the matching words in an es or ko card overlay (none ship yet). Reworded with a
two-lens review (language lens: CEFR Pre-A1 English, plain, no age or audience words;
culture lens: the heritage claim stays true). These are AI review passes, not a native
or expert review.

| Card | Field | Now reads | Review notes |
|---|---|---|---|
| `card:book` (app) | fact | Most Korean books today are printed left-to-right, top-to-bottom — the same as English. | "today": older books were printed in vertical lines read right to left. |
| `card:seollal` (app) | fact | People bow to their elders, and the elders often give sebaetdon (lucky money). | Sebae is a bow to elders; "often" because not every bow is answered with money. |
| `card:gangaji` | blurb | A friendly little dog. One of the first words heard in many Korean homes. | Same wording as the reviewed site blurb (F-SITE-002 S-6). |
| `card:nabi` | blurb | A tiny flying flower that flutters through many Korean songs. | Site blurb (S-6); "many" replaces the claim "every". |
| `card:jamjari` | fact | Catching dragonflies with a long-handled net is an old pastime in Korea. | "Paper nets" dropped: the culture lens found no support for it. |
| `card:chaek` | fact | Hangul was made so that anyone could learn to read and write. | Matches the stated aim of the Hunminjeongeum preface. |
| `card:paengi` | blurb | Wooden tops spun on the ice in winter. | Site blurb (S-6). |
| `card:usan` | blurb | Korea's rainy season lasts about a month. Keep an umbrella by the door. | Site blurb (S-6), "one" named; "about a month" (the yellow-umbrella line dropped). |
| `card:ibul` | blurb | In many Korean homes, people sleep on a warm floor under bright, padded blankets called ibul. | The ibul is the cover; the floor is warmed by ondol. |
