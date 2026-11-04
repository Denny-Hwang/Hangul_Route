# life-book2 (F-CURR-002 row CM-46, Food book 2): third pass sign-off, 2026-11-04

The third pass re-read every narration sentence, read line, check and culture note of `jang-fermented-sauces` and `tteok-through-the-seasons` against the facts each one cites, after the reviser's changes (`life-book2.changes.md`). It is an AI pass run by the authoring session; the independent MAR reviewer of the PR's fix stage re-reads both stories and their es and ko overlays before merge.

## Facts verified (quotes read on the cited page on 2026-11-04)

| story | fact | source checked | result |
|---|---|---|---|
| jang | f1 jang are fermented sauces, the basis of the Korean diet | UNESCO RL 01975; decision 19.COM 7.B.3 | verified |
| jang | f2 soybean-sauce culture area; Korea's own process | KHS portal (open API text); encykorea E0076963 | verified; shared heritage framed as shared |
| jang | f3 doenjang and ganjang after meju ferments | KHS; encykorea E0076963 | verified |
| jang | f4 meju made from boiled, pounded soybeans; liquid becomes ganjang, the rest doenjang | NFM topic 268; NIKL 메주, 간장, 된장; encykorea E0076963, E0048233 | verified (fix round 1: allowlisted sources first) |
| jang | f5 royal janggo and Janggo Mama | KHS | verified, one source (no digit) |
| jang | f6 varies by household; old seed soy sauce; aged for decades | UNESCO RL 01975; KHS | verified |
| jang | f7 straw rope (geumjul) hung when jang is made; amulets and rites for fermentation | NIKL 금줄; UNESCO RL 01975; encykorea E0076963 | verified (fix round 1: charcoal, red peppers and the lucky day removed) |
| jang | f8 passed down in families, schools and community groups; no holder | UNESCO RL 01975; KHS | verified |
| jang | f9 National Intangible Heritage, 27 December 2018 | KHS (ccbaAsdt 20181227); encykorea E0076963 | verified |
| jang | f10 inscribed 2024 under its UNESCO name | UNESCO RL 01975; decision 19.COM 7.B.3 | verified |
| tteok | f1 tteok of steamed grain flour, for feasts, rites and the seasons; a tteok for each holiday | NIKL 떡; NFM topics 265, 69, 182; encykorea E0049806 | verified (fix round 1) |
| tteok | f2 siru a round earthenware steamer; sirutteok of rice flour in layers | NIKL 시루; NFM topic 265; encykorea E0032347 | verified (fix round 1: 'earliest kind' removed) |
| tteok | f3 azalea hwajeon on Samjitnal, 3rd day of the 3rd lunar month | encykorea E0064862, E0049806; NFM topic 65 | verified |
| tteok | f4 chrysanthemum hwajeon, 9th day of the 9th lunar month | NFM topics 254, 251, 182; encykorea E0064862, E0049806 | verified (fix round 1) |
| tteok | f5 surichwitteok of Dano, cartwheel tteoksal | NFM topics 69, 65; encykorea E0049806 | verified |
| tteok | f6 why surichwi and mugwort at Dano | NFM topic 69; encykorea E0031353 | verified |
| tteok | f7 Dongji, longest night; patjuk with saealsim; families eat together | NFM topics 103, 104; NIKL 경단 | verified |

## Corrections made in this pass

None beyond the reviser's (listed in the changes file).

## Remaining uncertainty

- The UNESCO element page could be read only in part through the fetch tool (its description paragraph was summarised, the opening sentence and the inscription line quoted). The decision page quotes the same opening sentence. Spot-check the element page in a browser before merge.
- The KHS portal page renders its description with JavaScript; the description was read through the KHS open API for the same record (ccbaCpno 127ZZ01370000).
- Surichwitteok is made with surichwi or mugwort leaves (NFM); encykorea's 절식 entry says surichwi. The narration says green leaves.

## Sign-off

- `story:jang-fermented-sauces`: every sentence maps to a cited fact; no origin claim; UNESCO status for the exact element only. Signed off for the PR's fix-stage review.
- `story:tteok-through-the-seasons`: every sentence maps to a cited fact; no repeat of a shipped story's topic. Signed off for the PR's fix-stage review.

## Independent review (PR #971, fix round 1, 2026-11-04)

Two independent reviewers re-read both stories (listen and read tiers, checks, culture notes, facts) and the es and ko overlays of `stories-life-book2.json`: ko PASS, es PASS with nits, heritage PASS. Their source finding (five facts resting on encykorea only, which the §6.6 allowlist does not name) and their nits are fixed as listed in `life-book2.changes.md` (fix round 1). Every fact now cites an allowlisted institution first (UNESCO, the Korea Heritage Service, the National Folk Museum of Korea, the National Institute of Korean Language). The lines this round changed (jang listen s7, read s8, cn-geumjul, f7; tteok listen s2, read s2, listen s8, hoyaOutro, f1, f2; their es and ko) wait for the PR's next independent review; no copy claims review by a native speaker or an expert.
