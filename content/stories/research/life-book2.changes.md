# life-book2 (F-CURR-002 row CM-46, Food book 2): checker findings and how each was resolved, 2026-11-04

Two new tales for the Stage 5 Food cell's book 2 (`episode:stage5-life-v2`): `jang-fermented-sauces` (jang-making) and `tteok-through-the-seasons` (the rice cakes of the seasons). They went through the MAR pipeline of F-CURR-002 §9.2 as separate passes run by the authoring session: an author, three checkers (language, culture and facts, learning design), a reviser and a third pass. All passes are AI review passes; no copy says a native speaker or a human expert reviewed anything. The independent MAR reviewer of the PR's fix stage re-reads both stories and their es and ko text.

Every quote in `facts[].sources[].quoteOrLocator` was read on 2026-11-04 on the page it cites: ich.unesco.org (the element page RL 01975 and decision 19.COM 7.B.3), the Korea Heritage Service portal page of 장 담그기 (its description read through the khs.go.kr open API, because the portal page renders with JavaScript), encykorea (E0076963, E0048233, E0049806, E0032347, E0064862, E0031353) and the National Folk Museum of Korea children's folk encyclopedia on nfm.go.kr (topics 65, 69, 103, 104). The folkency.nfm.go.kr pages render with JavaScript and were not used.

## Topic check (`story-topic-unique`, §5.3)

| story | finding | outcome |
|---|---|---|
| both | Kimjang and Kim Hongdo's market paintings already ship (`gimjang-arirang`, `kim-hongdo-genre-paintings`) | Neither tale tells them; no source URL is shared with a shipped story (lint passes) |
| tteok-through-the-seasons | Tteokguk (Seollal) and songpyeon (Chuseok) are told in shipped stories | Not told again; autumn is chrysanthemum hwajeon on outings |

## Language checker

| story | scene/check | finding | outcome |
|---|---|---|---|
| jang | read s1 장은 콩으로 만들어요 | Generic active "(people) make jang from soybeans", glossed as a passive. Natural in Korean | Keep |
| jang | read s7 장맛은 집마다 달라요 | 집마다 is read [짐마다]; the converter gives jimmada | Keep, machine-checked |
| jang | keyword 장고 | 장고 is also a name of the hourglass drum (장구) | Keep; glossed as the storehouse in context (KHS text); noted in authorNotes |
| jang | 장, 간장 | Homographs for a device voice (장 market or chapter; 간장 liver) | Keep; every line carries them in context |
| tteok | read lines 봄에/여름에/가을에/겨울에 ... 먹어요 | Present tense for a seasonal custom | Keep: the lines describe the custom, the narration says which holiday |
| both | ko overlay titles | A ko title equal to the story's Korean title is a circular gloss (overlay lint) | ko titles reworded: 콩이 장이 되기까지; 봄 여름 가을 겨울, 계절의 떡 |
| tteok | ko overlay 꽃잎 | 꽃잎 is the fixture word of the romanization self-cleaning test | Reworded to 꽃 / 국화꽃 (meaning unchanged) |

## Culture and facts checker

| story | scene/check | finding | outcome |
|---|---|---|---|
| jang | listen s2 | Soybean sauces are shared East Asian heritage | The narration says sauces from soybeans belong to many kitchens across East Asia, and Korea has its own way (f2, KHS: 두장문화권, distinct from China and Japan); no origin claim |
| jang | E0048233 | The encykorea 장 entry argues soybean jang spread from Goguryeo lands | Not used; the entry is cited only for how meju and the two sauces are made (f4) |
| jang | listen s4 "ferments in big jars" | Jars are not in f4 | Removed |
| jang | listen s8, read s8 "UNESCO inscribed it" | A UNESCO status only for the exact element | Reworded: UNESCO inscribed Korea's knowledge, beliefs and practices of jang making; f10 names the element as UNESCO writes it (no hyphen in "jang making"), inscribed 2024 |
| jang | f1, f10 claims | `narration-copies-source`: 8 words in a row from the UNESCO quote | Claims restated; the decision's quote locator no longer repeats the element name |
| jang | f8 | UNESCO and the KHS say the practice centres on the women of the household | Narration says families; the gendered detail is left out, not contradicted |
| tteok | listen s2 "steam rice flour" | f2 says grain flour; "earthenware" needs a source | Narration says grain flour; f2 now cites the bronze and earthen siru of the encykorea entry |
| tteok | listen s3 "went out to the hills" | The sources say outings in the fields (들놀이) | Reworded: went on spring outings |
| tteok | listen s6 "grow everywhere" | f6 says plentifully | Reworded |
| tteok | listen s8 | NFM: saealsim eaten one for each year of one's life | Left out (no age words) |

## Learning design checker

| story | scene/check | finding | outcome |
|---|---|---|---|
| tteok | read tier | `newKeywordIds` bom, yeoreum, gaeul, gyeoul were not used as tokens of the tier | Each read narration now names its season with its token |
| jang | read r1 target 콩 | 콩 is a held-out probe block of the Syllable Build pool (`decode-pool.json`), so it must not become a review item | r1 asks 메주 instead |
| both | art | S-palette-cap errors (tteok s5, s8; jang s2) and focal warnings | Layers trimmed and the focal item centred and enlarged; no finding left |
| both | story-coverage | listen 8 of 8, read 18 of 18 tokens taught by stage 2 for each story | 100% |
| both | checks | Answer positions b, c, a / c, a, d (jang) and a, b, c / b, d, a (tteok) | Varied |
| both | Story Order (§5.3 format) | A story quest's Apply step is Story Sequence (`sequenceSceneIds`); the story schema has no Story Order rounds | Recorded as a follow-up in the PR; the four sequence scenes of each tier carry Korean captions that settle the order |

## Third pass

See `life-book2.signoff.md`.
