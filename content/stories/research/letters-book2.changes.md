# letters-book2 (F-CURR-002 row CM-46, Letters): author pass, 2026-11-04

Two new tales for the Letters cell's book 2 (`episode:stage5-letters-v2`): `eongan-letters` (Hangul letters written in Joseon families) and `hangul-name` (how the name Hangul came into use). Both are `ready` with `review.language` and `review.culture` at `draft` and `verification.passes: 1`, so the shelf and the book leave them out (`buildBook`, the catalogue's `draft` story status) until the multi-agent review of F-CURR-002 §9.2 (three parallel checkers, a reviser, a third pass) signs them. That review appends its findings below and writes `letters-book2.signoff.md`. No copy says a native speaker or a human expert reviewed anything.

## Sources (all fetched 2026-11-04; each quoteOrLocator compared with the page text)

| story | fact | source | host (§6.6 institution) |
|---|---|---|---|
| eongan-letters | f1 | 표준국어대사전 "언간" | stdict.korean.go.kr (National Institute of Korean Language) |
| eongan-letters | f2-f5 | 국가유산포털 "나신걸 한글편지" (ccbaCpno 1122522090000) | www.heritage.go.kr (Korea Heritage Service) |
| eongan-letters | f6, f8 | 국립한글박물관 주요 문화유산 "정조어필한글편지첩" (relic/designated/8); 국가유산포털 "정조 한글어찰첩" (ccbaCpno 1121121690000) | www.hangeul.go.kr (National Hangeul Museum); www.heritage.go.kr |
| eongan-letters | f6 | 문화체육관광부 보도자료, 2014 (National Hangeul Museum's release of the full album) | www.mcst.go.kr |
| eongan-letters | f7 | 국가유산포털 "정조 한글어찰첩" | www.heritage.go.kr |
| eongan-letters | f9 | 국립한글박물관 기획 전시 "<한글, 마음을 적다>" (exhibition/643) | www.hangeul.go.kr |
| hangul-name | f1-f5, f8 | 국립국어원 알고 싶은 한글 "한글의 다른 이름" (hangeul/another/001) | www.korean.go.kr (National Institute of Korean Language) |
| hangul-name | f6, f7 | 국가유산포털 "말모이 원고" (ccbaCpno 1121120850000); 국립한글박물관 주요 문화유산 "말모이원고" (relic/designated/5) | www.heritage.go.kr; www.hangeul.go.kr |

`story-topic-unique`: neither tale shares a topic tag or a source URL with another story (the `hangeul-day` page bbs_no=777, `korean.go.kr/hangeul/origin/001.html` and the stdict "한글" search stay with the shipped stories). The renaming of Hangul Day in 1928 is the `hangeul-day` story's and is not repeated.

## Author decisions

| story | decision | why |
|---|---|---|
| both | No year, age or count in any claim or narration | Every digit would need a second source (C3) and an approximation; the stories teach who wrote and what the names were, not dates. The heritage portal's dates (1461-1524, 1490s, 2011, 1752-1800, 1911-1914) stay in the quotes only. |
| eongan-letters | The tomb is named only in f2 (reference zone); the narration says the letter "was found long afterwards, folded many times" | No scene names a burial, so the story needs no advisory. |
| eongan-letters | Left out: "the only surviving original Hangul letters of Jeongjo" (MCST release) | It is about surviving originals among his letters and is easy to misread as "the only letters he wrote in Hangul". |
| eongan-letters | 큰외숙모 is told as "his aunt" (the wife of his mother's eldest brother in f6) | The relationship term is the learner word 외숙모 (oesungmo); the album's two names (정조어필한글편지첩 at the museum, 정조 한글어찰첩 on the heritage portal) are both cited, and the story says "an album". |
| eongan-letters | f5 keeps the source's contrast ("Hangul has often been thought of as mainly a script of women") in the claim; the narration says only "men wrote Hangul easily too" | The narration states what the letter shows, not a claim about women's writing. |
| hangul-name | Ju Sigyeong is "seems to be the first" | The NIKL page hedges (인 듯하다); other attributions (Choe Namseon, Yi Jongil) are not on an allowlisted source and are left out. |
| hangul-name | The meaning of 한 (great, one, right) is left out | No allowlisted source states it. |
| hangul-name | 암클, 아햇글 left out | The source says they may never have been used. |
| hangul-name | Malmoi is "the first Korean dictionary project" | It was never published; the sources call it a manuscript (원고) for a dictionary. |
| hangul-name | s6 says "the magazine Aideulboi", not "a magazine for children" | `review-copy`: no copy says who something is for by age. |
| both | Every read line is built from the story's keywords (and particles), at most one new word a line | `story-coverage` 100% on both tiers of both stories (18 of 18 and 16 of 16 read tokens). |
| eongan-letters | "missed" replaced by "longed to see" | `banned-on-learner-surface`. |
| both | Scene art reuses registry settings and figures only; no new SVG | Composition rules: no error, no warning (palette cap reached by tinting the scholar and the villager). |

## Book 2 size

F-STORY-005 D9 caps a book at 2-3 quests (`BOOK_MAX_QUESTS`). The Letters book 2 of F-CURR-002 §5.2 S5 holds the eight read-tier stories of row CM-46a and the two new tales, so a book 2 (volume 2, off the route days) may hold up to ten (`BOOK2_MAX_QUESTS`); book 1 keeps 2-3. Decision record: F-CURR-002 §10, row CM-46 (Letters).
