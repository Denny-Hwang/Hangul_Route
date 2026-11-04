# rites-book2 (F-CURR-002 row CM-46, Holidays): author pass, 2026-11-04

Two new tales for the Holidays cell's book 2 (`episode:stage5-rites-v2`): `gyeonu-jingnyeo` (the tale of Gyeonu and Jingnyeo, told on Chilseok) and `daeboreum-full-moon` (the customs of the first full moon). Both are `ready` with `review.language` and `review.culture` at `draft` and `verification.passes: 1`, so the shelf and the book leave them out (`buildBook`, the catalogue's `draft` story status) until the multi-agent review of F-CURR-002 §9.2 (three parallel checkers, a reviser, a third pass) signs them. That review appends its findings below and writes `rites-book2.signoff.md`. No copy says a native speaker or a human expert reviewed anything.

## Sources (all fetched 2026-11-04 with a plain request; each quoteOrLocator compared with the page text)

| story | fact | source | host |
|---|---|---|---|
| gyeonu-jingnyeo | f1 | 표준국어대사전 "칠석"; 한국민족문화대백과사전 「견우직녀 설화」 (E0002170) | stdict.korean.go.kr (National Institute of Korean Language); encykorea.aks.ac.kr (Academy of Korean Studies) |
| gyeonu-jingnyeo | f2, f4, f6, f7 | 「견우직녀 설화」 (E0002170) | encykorea.aks.ac.kr |
| gyeonu-jingnyeo | f3 | 「견우직녀 설화」; 표준국어대사전 "견우" | encykorea.aks.ac.kr; stdict.korean.go.kr |
| gyeonu-jingnyeo | f5 | 「견우직녀 설화」; 표준국어대사전 "오작교" | encykorea.aks.ac.kr; stdict.korean.go.kr |
| gyeonu-jingnyeo | f8 | 한국민족문화대백과사전 「칠석」 (E0058486) | encykorea.aks.ac.kr |
| daeboreum-full-moon | f1-f5 | 표준국어대사전 "대보름", "부럼", "오곡밥", "더위팔기", "달맞이" | stdict.korean.go.kr |
| daeboreum-full-moon | f6, f7 | 표준국어대사전 "달집태우기"; 국가유산포털 "송천달집태우기" (ccbaCpno 2223600240000, text read through the khs.go.kr open API) | stdict.korean.go.kr; www.heritage.go.kr (Korea Heritage Service) |

`story-topic-unique`: neither tale shares a topic tag or a source URL with another story. The Korea Heritage Service element 설과 대보름 is the `seollal-new-year` and `dano-ssireum` stories' source and is not reused.

## Gap for the review: the National Folk Museum of Korea

The spec names the National Folk Museum of Korea (its Encyclopedia of Korean Seasonal Customs and Encyclopedia of Korean Folk Literature) as the source of both tales. Its site (folkency.nfm.go.kr) serves its text only through a script interface; an earlier attempt to read it that way was refused by the permission system on 2026-10-31, so this pass did not use it. Instead:

- The tale follows the Encyclopedia of Korean Culture's version (E0002170), whose references list the Folk Museum's 『한국민속문학사전: 설화편』 (2012). The Encyclopedia of Korean Culture is not on the §6.6 allowlist; the shipped tale `sun-and-moon` cites it the same way. Every fact a learner reads in the tale that the NIKL dictionary also states (Chilseok, Ojakgyo, Gyeonu) cites NIKL too.
- The customs cite NIKL (allowlisted) and the Korea Heritage Service (allowlisted) only.

The review should compare both stories with the Folk Museum entries (견우직녀 설화; 대보름, 부럼, 달집태우기), or the owner can name another source policy.

## Author decisions

| story | decision | why |
|---|---|---|
| gyeonu-jingnyeo | Told as shared across East Asia (s1, f2), never as Korean in origin | §5.4 S5; the source puts the oldest written record in a Chinese book. |
| gyeonu-jingnyeo | Spelled Jingnyeo, not Jiknyeo | The repo's Revised Romanization check (`romanization-content.test.ts`) gives jingnyeo for 직녀, and the English names match the romanization learners see. The slug follows. |
| gyeonu-jingnyeo | No directions (east, west) for the two figures | NIKL and the Encyclopedia's 칠석 entry disagree; the story says "on either side". |
| gyeonu-jingnyeo | No year for the Goguryeo tomb | A digit needs a second source; the mural is named without its date. |
| gyeonu-jingnyeo | The birds' bald heads kept, as a light detail | Faithful to the source and not an injury on screen (§5.1). |
| gyeonu-jingnyeo | 목동 (herder) as the learner word, not 소 (ox) | 소 is a held-out probe block of Syllable Build (`decode-pool.json`), which must never be a review item. |
| gyeonu-jingnyeo | prop:swallow stands for the crows and magpies | Registry art only; the alt text says "birds". |
| daeboreum-full-moon | No gwibalgisul in narration, no jwibulnori | An alcoholic drink, and spinning fire; f1 names the drink in the reference zone only. |
| daeboreum-full-moon | The daljip is lit by "people"; Hoya watches from a safe distance | Fire is never handled by Hoya or the learner. |
| daeboreum-full-moon | The 송천달집태우기 designation and dates left out | The story names one village's daljip only; no designation number. |
| both | Every read line is built from the story's keywords (and particles) | `story-coverage` 100% on all four tiers (listen 12 of 12 and 8 of 8, read 19 of 19 and 12 of 12). |
| both | Scene art reuses registry settings, props and Hoya only; no new SVG | Composition rules: no error, no warning. |

## Story Order

§5.4 S5 lists Story Order for this cell. A story has no Story Order round in its schema yet (StoryTierSchema is strict; the quest skeleton has no order step), the same gap the Letters book 2 records; `story-order-text` therefore has nothing new here. A shared row should add the field once for every book 2.
