# life-book2 (F-CURR-002 row CM-46, Food book 2): third pass sign-off, 2026-11-04

The third pass re-read every narration sentence, read line, check and culture note of `jang-fermented-sauces` and `tteok-through-the-seasons` against the facts each one cites, after the reviser's changes (`life-book2.changes.md`). It is an AI pass run by the authoring session; the independent MAR reviewer of the PR's fix stage re-reads both stories and their es and ko overlays before merge.

## Facts verified (quotes read on the cited page on 2026-11-04)

| story | fact | source checked | result |
|---|---|---|---|
| jang | f1 jang are fermented sauces, the basis of the Korean diet | UNESCO RL 01975; decision 19.COM 7.B.3 | verified |
| jang | f2 soybean-sauce culture area; Korea's own process | KHS portal (open API text); encykorea E0076963 | verified; shared heritage framed as shared |
| jang | f3 doenjang and ganjang after meju ferments | KHS; encykorea E0076963 | verified |
| jang | f4 meju made from boiled, pounded soybeans; liquid becomes ganjang, the rest doenjang | encykorea E0076963, E0048233 | verified (process only from E0048233) |
| jang | f5 royal janggo and Janggo Mama | KHS | verified, one source (no digit) |
| jang | f6 varies by household; old seed soy sauce; aged for decades | UNESCO RL 01975; KHS | verified |
| jang | f7 lucky day, charcoal or red peppers, straw rope | encykorea E0076963 | verified, one source (no digit) |
| jang | f8 passed down in families, schools and community groups; no holder | UNESCO RL 01975; KHS | verified |
| jang | f9 National Intangible Heritage, 27 December 2018 | KHS (ccbaAsdt 20181227); encykorea E0076963 | verified |
| jang | f10 inscribed 2024 under its UNESCO name | UNESCO RL 01975; decision 19.COM 7.B.3 | verified |
| tteok | f1 seasonal holiday foods, tteok first, by season | encykorea E0049806 | verified, one source (no digit) |
| tteok | f2 siru steaming the earliest kind; bronze and earthen siru | encykorea E0032347 | verified |
| tteok | f3 azalea hwajeon on Samjitnal, 3rd day of the 3rd lunar month | encykorea E0064862, E0049806; NFM topic 65 | verified |
| tteok | f4 chrysanthemum hwajeon, 9th day of the 9th lunar month | encykorea E0064862, E0049806 | verified |
| tteok | f5 surichwitteok of Dano, cartwheel tteoksal | NFM topics 69, 65; encykorea E0049806 | verified |
| tteok | f6 why surichwi and mugwort at Dano | NFM topic 69; encykorea E0031353 | verified |
| tteok | f7 Dongji, longest night; patjuk with saealsim; families eat together | NFM topics 103, 104 | verified |

## Corrections made in this pass

None beyond the reviser's (listed in the changes file).

## Remaining uncertainty

- The UNESCO element page could be read only in part through the fetch tool (its description paragraph was summarised, the opening sentence and the inscription line quoted). The decision page quotes the same opening sentence. Spot-check the element page in a browser before merge.
- The KHS portal page renders its description with JavaScript; the description was read through the KHS open API for the same record (ccbaCpno 127ZZ01370000).
- Surichwitteok is made with surichwi or mugwort leaves (NFM); encykorea's 절식 entry says surichwi. The narration says green leaves.

## Sign-off

- `story:jang-fermented-sauces`: every sentence maps to a cited fact; no origin claim; UNESCO status for the exact element only. Signed off for the PR's fix-stage review.
- `story:tteok-through-the-seasons`: every sentence maps to a cited fact; no repeat of a shipped story's topic. Signed off for the PR's fix-stage review.
