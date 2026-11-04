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
