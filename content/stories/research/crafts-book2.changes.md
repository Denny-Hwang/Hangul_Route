# crafts-book2 (F-CURR-002 row CM-46, Play): checker findings and how each was resolved, 2026-11-04

The two new tales of the Play cell's book 2, `hahoe-mask-dance` (the Hahoe mask dance under the UNESCO element "Talchum, mask dance drama in the Republic of Korea", inscribed 2022) and `hanji-korean-paper` (hanji, Korean paper; no UNESCO status claimed), went through the MAR pipeline of F-CURR-002 §9.2: an author pass, three checker passes (language, culture and facts, learning design), a reviser and a third pass. The passes were run by the authoring session as separate passes, each reading the story files and the cited sources afresh; the independent MAR reviewer of the PR's fix stage re-reads the stories and the es and ko text. All passes are AI review passes; no copy says a native speaker or a human expert reviewed anything.

The stories were authored directly as story files (not imported from a research `.final.json`): every fact was written from a source opened on 2026-11-04, with its quoted words in `quoteOrLocator`.

## Sources read (2026-11-04)

| source | host | how it was read |
|---|---|---|
| 국보 안동 하회탈 및 병산탈 | heritage.go.kr (Korea Heritage Service) | the portal page (designation date 1964-03-30, category); its description through the khs.go.kr open API `SearchKindOpenapiDt.do` for the same heritage number, as the page renders it with JavaScript |
| 국가무형유산 하회별신굿탈놀이 | heritage.go.kr | the same: page (designated 1980-11-17) and open API description |
| 하회별신굿탈놀이 | encykorea.aks.ac.kr | the article page |
| 「한국의 탈춤」, 유네스코 인류무형문화유산 등재 (2022-11-30 press release) | khs.go.kr | the article page, Korean and English text |
| 인류무형문화유산: 한국의 탈춤 | heritage.go.kr | the portal page (its list names 하회별신굿탈놀이; "2022년 18개 종목") |
| Talchum, mask dance drama in the Republic of Korea | ich.unesco.org | the live page answered with a bot check; the year (2022, 17.COM) and the file number (01742) come from search excerpts of the page and match the press release |
| 국가무형유산 한지장 | heritage.go.kr | page (designated 2005-09-23) and open API description |
| 자연이 만들어낸 우리 한지 (국가유산사랑, 2010-06-10) | khs.go.kr | the article page |
| 한지 | encykorea.aks.ac.kr | the article page |

Institution names are given as of the access date: the 2022 press release was issued by the Cultural Heritage Administration (문화재청) and is cited as the Korea Heritage Service (국가유산청), its name since May 2024.

## Language checker

| story | where | finding | proposed fix | severity |
|---|---|---|---|---|
| hahoe-mask-dance | read s3 line 나무로 만들었어요 | The gloss "They were made of wood." is passive; the Korean is an active past with no subject ("(they) made (them) with wood"). | Gloss "They made them from wood." | should-fix |
| hahoe-mask-dance | read s2 line 탈을 써요 | 탈을 쓰다 is the natural verb for putting on a mask; keyword gloss "put on; wear (a mask or hat)" fits. | — | note |
| hahoe-mask-dance | romanization | Tarieyo, Tareul sseoyo, Namuro mandeureosseoyo, Yangban tarieyo, Saramdeuri useoyo, Hahoetareun gukboyeyo: all equal the F-CNT-002 converter's output. | — | note |
| hanji-korean-paper | read s2 line 닥나무로 만들어요 | The gloss "It is made from the paper mulberry." is passive; the Korean is active with no subject. | Gloss "They make it from the paper mulberry." | should-fix |
| hanji-korean-paper | read s7 line 고려 종이가 유명했어요 | 고려 종이 (rather than 고려의 종이 or 고려지) is plain and correct for a learner line. | Keep. | note |
| hanji-korean-paper | read s5 line 종이를 떠요 | 뜨다 has several senses (float, open the eyes, scoop); the keyword gloss names this one: "scoop (paper from water)". | Keep the narrowed gloss. | note |
| both | ko overlay, keyword glosses | First draft glossed several keywords with the word itself (마을 → 마을), which `overlay-circular-gloss` refuses, and one gloss used 소리 내어 (a speaking word, `review-copy`). | Descriptive Korean glosses in the style of the shipped stories (마을 → 여러 집이 모여 사는 곳). | must-fix |
| hahoe-mask-dance | ko overlay s1 | Hoya's 가서 보자! is 반말; Hoya speaks 해요체 everywhere else. The first onomatopoeia 깨갱깨갱 is a dog's yelp. | 가 봐요!; 꽹꽹! for the small gong. | must-fix |

## Culture and facts checker

| story | where | finding | proposed fix | severity |
|---|---|---|---|---|
| hahoe-mask-dance | s1 narration | "handed down a mask dance drama for a long time": f1 says handed down; "for a long time" rests on the KHS line "약 500년 전부터", which no fact of the story carries. | Drop "for a long time". | should-fix |
| hahoe-mask-dance | s5 narration, read s5 | "the people watching laugh" went beyond f3 (satire and humour) and f4. The KHS press release says talchum is played trading cheers and jeers with the audience. | Add that sentence to f8 (with its quote); s5 and read s5 cite f8 and say the audience cheers and laughs. | should-fix |
| hahoe-mask-dance | s4 | The jaw: the KHS description says the jaw is carved separately; it does not say which masks. The narration says "a mask's jaw" and names the yangban mask only as one of the finest (f6: 양반과 백정은 … 우수함이 돋보인다). | — | note |
| hahoe-mask-dance | wood | KHS (National Treasure) says willow, KHS (Byeolsingut) and encykorea say alder. | Say only "wood"; recorded in authorNotes. | note |
| hahoe-mask-dance | s8, f8 | UNESCO status is claimed only for Talchum, mask dance drama in the Republic of Korea, under its UNESCO name, "inscribed 2022" (§5.1). Hahoe village's World Heritage status is not mentioned. | — | note |
| hahoe-mask-dance | content | The Bune and monk scene and the wedding-night scenes are not for every audience; left out. The rite is told neutrally (a village prays for peace and a good harvest). | — | note |
| hahoe-mask-dance | topic | dano-ssireum shows the Gangneung Gwanno mask play; this story's topic tags and source URLs differ (`story-topic-unique` passes). | — | note |
| hanji-korean-paper | s2 | "A sticky liquid … helps the paper form" interprets f3 (dakpul controls how fast water drains). | "… is mixed in too", citing f1 and f3. | should-fix |
| hanji-korean-paper | s3 | Origin told neutrally from encykorea (no evidence of when; the common view is that the technique came from China); no first, oldest or best claim. | — | note |
| hanji-korean-paper | s6 | The baekji explanation follows KHS (99 handlings and the user's hundredth touch); the newsletter's "a hundred steps" version is in f5 too. | — | note |
| hanji-korean-paper | s7 | "A writer of China's Song dynasty" (Sun Mu, Gyerim yusa) as KHS says; the story does not call him a visitor. | — | note |
| both | sources | Every fact has an allowlisted source (§6.6) named as of 2026-11-04; facts with a digit or number word have two sources. | — | note |

## Learning design checker

| story | where | finding | proposed fix | severity |
|---|---|---|---|---|
| both | story-coverage | Every token of both tiers is taught by Stage 2 or is a story keyword: hahoe listen 8 of 8, read 11 of 11; hanji listen 8 of 8, read 13 of 13 (target 95%). | — | note |
| hahoe-mask-dance | read s5 | 사람들이 웃어요 brings two words new to the read tier (사람들, 웃어요); both are keywords, glossed and romanized. | Keep (as CM-46a kept a second glossed noun). | note |
| hanji-korean-paper | read s2, s4, s5, s7 | Each line brings two keywords new to the read tier (e.g. 껍질 + 두드려요). All are glossed keywords; the lines stay two or three words. | Keep. | note |
| both | Story Order | The read tier's ordering round (F-STORY-003 Story Order, `sequenceSceneIds`) shows each scene's Korean line with its caption. The captions settle the order by text: hahoe "The players put on their masks" → "Next, the yangban comes out" → "Choraengi teases, and people laugh" → "Today, a National Treasure"; hanji "First, the paper mulberry tree" → "Then, beating the soft bark" → "Next, scooping a thin sheet" → "Last, hanji is still made today". | — | note |
| both | checks | Three checks a tier, one right answer each, the right answer's position varies (hahoe a, b, c / c, a, d; hanji a, b, c / b, d, a); every check cites a fact. | — | note |
| hanji-korean-paper | c3 option | The first draft option passed the 80-character limit. | "People said it was touched a hundred times in all". | must-fix |
| both | device voice | 백 (hundred) is also 백 (white) for a device voice; it is a listen keyword, read only inside its scene and glossed. | Keep. | note |
| both | art | Scene art uses library props only; three first layouts broke the palette cap (S-palette-cap) and one used a realia prop. | Settings and layers changed until `story-art.test.ts` passes. | must-fix |

## Reviser outcomes

Every should-fix and must-fix above was applied as proposed. No fact was dropped; f8 of hahoe-mask-dance gained the press release's sentence on the audience and its quote.

## Book 2 membership

`episode:stage5-crafts-v2` (Masks and Paper) holds the two tales. janggyeong-panjeon (a crafts story with a CM-46a read tier) stays a shelf story: it reads with the printing and records stories of its research cluster, and a book quest needs both read-tier review passes on record (`books.test.ts`), which CM-46a recorded as one line. The choice is recorded in `apps/mobile/src/content/books.ts`.
