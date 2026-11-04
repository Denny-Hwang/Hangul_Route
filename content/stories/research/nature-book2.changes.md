# nature-book2 (F-CURR-002 row CM-46, Stage 5 Nature book 2): checker findings and outcomes

Three tales: `jeju-volcanic-island`, `jirisan-national-park`, `suncheon-bay-wetland`. Sources were opened on 2026-11-04;
`nature-book2.sources.json` holds each fact's quoted words, and every quote was matched by script against the fetched page
text (whitespace ignored) before the stories were written. The multi-agent review (MAR, §9.2 of F-CURR-002) ran as an
author pass, three checker passes on separate lenses, a reviser pass and a third pass. No pass is a native-speaker or
expert review, and no copy claims one.

## Language (Korean lines, glosses, F-CNT-002 romanization)

| story | item | outcome |
|---|---|---|
| all | every `ko` line, keyword, caption and Story Order panel romanized by the repository's RR converter, then checked by the romanization suites | pass; names capitalized (Jeju, Hallasan, Jirisan, Cheonwangbong, Suncheonman, Ramsareu) |
| jeju | Story Order p4 `마지막에 세계유산이 되었어요.` had no subject | changed to `마지막에 이곳이 세계유산이 되었어요.` |
| jirisan | read s3 `가장 큰 봉우리는 천왕봉이에요` (biggest) | changed to `가장 높은 봉우리` (highest), which f3 supports and which matches the Jeju tale's `가장 높은 산` |
| jirisan | `히어리` gloss opened with its romanization (lint `gloss-repeats-romanization`) | gloss is now "a plant found only in Korea" in en and es |
| all | ko overlay glosses of the Story Order captions repeated the Korean (lint `overlay-circular-gloss`) | rewritten as meanings in the shipped style (`…다는 말`); ko titles reworded the same way |
| all | `{kw:}` tokens of every es and ko narration equal the English ones (script check) | pass |

## Culture and facts (§5.1 conventions)

| story | item | outcome |
|---|---|---|
| jeju | UNESCO status only under the inscribed name | f2 names "Jeju Volcanic Island and Lava Tubes" (2007) as the Korea Heritage Service portal gives it; no geopark or biosphere status is claimed |
| jeju | listen s7 said the limestone shapes are "white" | removed (no source gives a colour); s7 now names the three inscribed areas |
| jeju | ages in years (1.8 million, 100,000 to 300,000) | kept out of narration and facts' English claims; quoted in the sources only |
| jirisan | f4 to f6 cited only knps.or.kr, not an authoritative host (lint `fact-no-authoritative-source`) | the Korea Heritage Service article on the bear project (khs.go.kr) added to each, with its own quoted words |
| jirisan | causes of the bears' decline (poaching, colonial-era hunts) | not narrated: the tale says the bears became very rare (non-graphic, any age) |
| jirisan | institution names as of the access date | Korea National Park Service (국립공원공단, the name since 2019); its parent ministry on 2026-11-04 is the Ministry of Climate, Energy and Environment (authorNotes) |
| suncheon | National Wetlands Center and its parent ministry as of the access date | the National Institute of Ecology names it 습지센터 (publisher field); the institute is under the Ministry of Climate, Energy and Environment on 2026-11-04 (authorNotes) |
| suncheon | Ramsar status | from the institute's Ramsar list (순천만·보성갯벌, 2006.01.20) and encykorea; the Secretariat's site did not render, so nothing is quoted from it |
| suncheon | encykorea's older 흑두루미 entry says Korea has no regular wintering site | the wintering claim cites Suncheon City's current page; encykorea gives the breeding range only |
| all | "two rivers", "two caves", "two symbols" in narration (lint `narration-number-word-unmatched`) | reworded; no number word without a fact |
| all | `story-topic-unique` | topic tags and source URLs shared with no shipped story |

## Learning design

| story | item | outcome |
|---|---|---|
| all | Story Order (F5): one round per tale, captions only, ordered by 먼저 / 그다음에 / 마지막에 (`captionsOnly`, `captionsSettleOrder`) | pass (`story-order-text`) |
| all | check answer positions | listen a, b, c / b, c, a / c, a, b; read c, a, d / b, d, a / d, b, c |
| all | each read line restates a cited fact; four new keywords at most per tier | pass |
| all | art reuses the scene library; one new prop (`prop:hooded-crane`) inside the 200 KB registry line | pass |

## Fix round 1 (PR #974 review, 2026-11-04)

| story | finding | outcome |
|---|---|---|
| suncheon | f1-f6 cited no institution on the §6.6 allowlist (encykorea, Suncheon City only) | the Korea Heritage Service entries 명승 순천만 and 천연기념물 흑두루미 (heritage.go.kr; their text read through the service's open API, SearchKindOpenapiDt.do) are now the first source of f1-f6; quotes matched by script against the fetched text; encykorea and Suncheon City stay secondary |
| suncheon | "the only place in Korea where hooded cranes regularly spend the winter" (f4, listen s4, check c1, a learning goal) | cut back: the KHS crane entry says they winter at Suncheon Bay and at Cheonsu Bay, so the story says Suncheon Bay is one of the places where they spend the winter |
| suncheon | seasonal bird list (f6, listen s5, check c2) stated by Suncheon City only | replaced by the KHS list: more than 200 kinds of birds, the hooded crane, black stork, Eurasian spoonbill and reed warbler among them; the listen line is 순천만에 새가 아주 많아요 (the keyword 계절마다 is gone); c2 asks how many kinds |
| suncheon | river-sediment origin (f1) and grain of the reclaimed fields (f3) stated by encykorea only | left out of the narration; the food is the mudflat's worms, crabs and shellfish (KHS); c3's answer follows |
| suncheon | Story Order: p2 and p3 could swap | three panels: 먼저 ... 날아와요 / 그다음에 겨울 동안 갯벌에서 먹이를 먹어요 / 마지막에 다시 북쪽으로 날아가요, each settled by its marker |
| suncheon | grammarFocusEn "nara-wayo", "gaetbeoreneun" | "-eseo narawayo (fly in from ...); -e (at, in): gyeoure, gaetbeore" |
| jirisan | f7 (flagship species, behind cn-hieori) cited encykorea only | the Korea National Park Service's 국립공원깃대종 page (지리산국립공원 깃대종: 반달가슴곰, 히어리, "우리나라에만 자생하는 고유종") is its first source |
| jirisan | Story Order p4 stated the project's aim as reached | 마지막에 곰이 다시 지리산에 살아요 (f4, f5, listen s5) |
| jirisan | grammarFocusEn "-e salayo" | "-e sarayo" |
| jirisan | ko gloss of 풀어, 묶인 것을 놓아 | 가두지 않고 자유롭게 놓아 |
| jeju | s7 and the summary claimed UNESCO status without the inscribed name (§5.1) | both name Jeju Volcanic Island and Lava Tubes (es «Isla volcánica y tubos de lava de Jeju», ko 제주 화산섬과 용암동굴) |
| jeju | ko s7 석회 모양이 자라요 | 석회질 생성물이 자라요 |
| jeju | es c1 ¿Qué hizo la isla de Jeju? (reads as "what did Jeju do") | ¿Qué formó la isla de Jeju? |
