# science-art-life: revision log (draft -> revised)

Inputs: science-art-life.draft.json, checkA.json (8 issues), checkB.json (18 issues, of which 6 are the same "answer_index 0" finding, one per episode). Output: science-art-life.revised.json. Newly opened sources are dated accessed 2026-10-10 (actual access date); earlier sources keep 2026-10-09.

## Issues from check A

| # | Where | Issue | Resolution |
|---|---|---|---|
| A1 | cheugugi scene 7, f6; Kim Hong-do check 3 | Museum English name | FIXED. Re-verified: the museum's own site (science.kma.go.kr/museum/) footer reads "Copyright (c) National Meteorological Museum of Korea". Narration and f6 now say "National Meteorological Museum of Korea". The 2020 Asia Economy English article and the KHS portal (Korean only) say or imply "National Meteorological Museum"; the "of Korea" form is the museum's own. The Kim Hong-do distractor was replaced by other national museums (National Palace / National Folk Museum of Korea), because the old distractor was a near-copy of the right museum family. Added the KMA site as a source on f6. |
| A2 | cheugugi f3 | "Seoungwan" should be "Seounwan" | REJECTED, with reason. 서운관 = seo-un-gwan. RR of 관 is "gwan", so "Seounwan" would be a transcription of 서운완. Rule check with scratchpad/rr/rr.py gives "seoungwan". Because "seoungwan" can be misread as seo-ung-wan, the RR-conformant fix is a hyphen: "Seoun-gwan" (RR art. 8 allows a hyphen where reading is ambiguous). f3 now uses "Seoun-gwan". The caller's instruction (3) said "Seounwan"; please confirm. Narration itself has no romanized 서운관 (it says "royal observatory office"). |
| A3 | jagyeongnu scene 2, f2 | 관노 understated by "government servant" | FIXED. Scene 2: "was first a gwanno, a servant owned by the government in Dongnae. He was so skillful that he took charge of craft work in the palace, and King Sejong valued his talent." f2 claim: 관노 (官奴) = government-owned servant; adds encykorea E0048697 that he was later freed (면천, appointed 상의원별좌 in 1423). "first" is supported by that. Sillok 1433-09-16 re-read: no word 천인/미천 in the text, so "humble background" and "low-status" were not used. |
| A4 | jagyeongnu scene 7 illustration | "decorated with dragons" unsupported | FIXED (removed). Note: encykorea 자격루 (E0047854) has an image caption "창경궁 자격루 수수통의 용문양", so check A's statement that dragons belong only to the sundial legs is not fully right; KHS text has no decoration. Decoration is therefore omitted altogether (illustration: plain bronze jar and cylinders). |
| A5 | nanjung scene 3, LG2 | "even in very hard times"; keep "almost every day" | FIXED. Scene 3: "During the Imjin War, from 1592 to 1598, Admiral Yi kept a diary, writing in it almost every day." "almost" retained (UNESCO; also KHS says the 1595 volume is lost). |
| A6 | donguibogam f1 source 2 | folk-tale entry 허준 설화 is weak | FIXED. Replaced by encykorea 허준 E0063152 (opened: title 허준(許浚); "조선시대 『동의보감』·『언해태산집요』·『언해구급방』 등을 저술한 의관, 의학자"; infobox 1539-1615). Caveat found: the same page's photo caption gives 1546 as the birth year and its summary says 중종 34 (see still-unverifiable). |
| A7 | Kim Hong-do summary_en | "kicked-off shoes" invents an action | FIXED. Summary now "shoes that someone has taken off" (NMK: 벗어 놓은 신발). |
| A8 | Kim Hong-do scene 5 | "while everyone else watches" too strong | FIXED. Scene 5: seller "stands at the left, away from the crowd's attention" (NMK: 구경꾼들의 관심 밖). Note: NMK's curator page says the seller looks outward and the NIKH page says he looks at the distant sky; narration still follows the catalog wording. |

Check A "unverifiable" list: dealt with below (donguibogam f7 now has a second source; Heo Jun dates and UNESCO page reads remain flagged; angbuilgu f7/f8 and jagyeongnu f4 accepted as written).

## Issues from check B

| # | Where | Issue | Resolution |
|---|---|---|---|
| B1-B6 | all six episodes, all 18 checks | All answer_index 0 and correct option longest | FIXED. New positions: ep1 [1,2,0], ep2 [2,1,0], ep3 [0,2,1], ep4 [2,0,1], ep5 [1,0,2], ep6 [0,1,2] (6 each of 0/1/2). Options rewritten to similar length (within about 10 characters in most cases; the correct option is the longest in few of them) and plausible but wrong; no joke distractors (removed: "Airplanes", "Television shows", "Sleeping all day", "Eating only sweets", "Clapping, singing and whistling", "To scare birds away", "Only numbers", "king did not like holes"). Check B's suggested replacements like "Space travel" and "Only numbers" were not used because they are still joke-like. |
| B7 | cheugugi scene 6, LG4, summary, f5 | "only one is known to survive" ambiguous | FIXED. Now "only one gauge itself is known to survive" / "rain-gauge vessel". f5 claim adds that stone stands (대석) survive (encykorea E0007902: "측우기를 설치했던 대석(臺石)은 몇 기가 남아 있지만"; 통영 측우대 E0068941 is a Treasure since 2010). |
| B8 | cheugugi f6, Kim Hong-do check 3 | Museum name | Merged with A1: FIXED to "National Meteorological Museum of Korea". |
| B9 | angbuilgu scene 3, f3 | "seasons" -> time of year | FIXED. Scene 3 says "time of day" and "time of year"; LG2 and f3 updated (claim keeps "season lines (solar-term lines)", KHS 계절선 / encykorea 절기선). |
| B10 | jagyeongnu scene 2, f2, LG | 관노 wording | Merged with A3: FIXED. "Not born a nobleman" removed. |
| B11 | jagyeongnu f6 claim_ko | 이어 받아 spacing | FIXED: 이어받아. |
| B12 | nanjung scene 3 | "even in very hard times" | Merged with A5: FIXED. |
| B13 | Kim Hong-do scene 5, illustration, f5 | Shoes near seller; museum puts shoes at right | FIXED. Re-fetched NMK relicId=551: seller "왼쪽에 서 있는"; "벗어 놓은 신발은 오른쪽으로 터진 여백을 좁히는 구실". Narration: seller at the left; "Over on the right, some shoes have been taken off and left." Illustration puts seller at left edge, shoes at right edge. The museum text does not literally say "on the ground"; the illustration shows the shoes resting on the ground but narration does not claim it. 우리역사넷 (NIKH) says the shoes are the two wrestlers'; not used in narration (museum text does not say whose). |
| B14 | Kim Hong-do scene 6, f6 | Layout differs between sources | FIXED. NMK (relicId=552): pupils arranged "둥글게" around the sniffling boy and the teacher; encykorea body says they sit in a circle, but its photo caption says pupils sit side by side on both sides of the teacher. Narration: "gathered around one boy". Also fixed the ssireum crowd (scene 4, f4, check 1): NMK says two groups of spectators arranged roundly above and below, so narration says "two curved groups" instead of "a circle". |
| B15 | donguibogam scene 7 + vocab | 책 repeated | FIXED. Scene 7 keyword is 세계기록유산 (segyegirogyusan, checked with rr.py), narration names the Korean term; added to vocab (8 words). |
| B16 | all, optional | Joke distractors | FIXED as part of B1-B6. |
| B17 | angbuilgu scene 5 (optional hedge) | Zodiac-animal reading is KHS/encykorea interpretation | PARTLY ADOPTED. Narration now explicitly says "On King Sejong's sundials" (encykorea notes later versions used written characters). Interpretation remains stated plainly (two authoritative sources) and is recorded in notes. |

Check B "unverifiable": Kim Hong-do f1 -> RESOLVED/REJECTED as a problem: the quote 궁궐이 아닌 민간의 생활상을 그린 그림. 속화. is present on E0013639, in its 관련 항목 list; locator reworded to say so (the separate 풍속화 entry URL found in search, E0081547, is a different article, 조선풍속사진, so was not used). Donguibogam f7 -> second source added. f9 and the KHS-text items remain flagged.

## Extra changes by the reviser
- Second sources added: cheugugi f2 (신편한국사 via 우리역사넷), jagyeongnu f1 (encykorea 물시계 E0019863), donguibogam f7 (신편한국사 via 우리역사넷), nanjung f3/f4/f5/f6 (우리역사넷 영상 책 이야기; KHS MoW page), Kim Hong-do f5 (우리역사넷), cheugugi f5/f6 (stands; museum site).
- nanjung f4/scene 5: "visits" softened to "wrote about his family and relatives", claim reworded to match both sources.
- Narration lengths all <= 41 words; all scene fact_ids exist; every Korean scene string and vocab entry matches rr.py except 풍속화 (pungsokhwa is correct RR for a noun with ㅎ kept, e.g. Mukho; the rule script marks it only because it aspirates).
- reference_display lines updated where 우리역사넷 / the museum site were added.

## Still unverifiable (for the final checker)
1. Heo Jun birth year: KHS and the E0063152 infobox say 1539; a caption on E0063152 says 1546 and its summary text says 중종 34. Narration says 1539-1615 (scene 2).
2. UNESCO page wording (Donguibogam, Nanjung Ilgi, Ssirum): direct fetches failed in both checks and in this pass was not retried; years (2009, 2013, 2018) were confirmed through KHS lists and ich.unesco.org search summaries. The exact quotes in those source entries came from the first draft and the search summaries.
3. Donguibogam f4 (meaning of the title) and f9 (three 2015 Treasure sets): f4 rests on encykorea alone; f9 KHS 2015-2/2015-3 pages not independently re-read.
4. Nanjung f6 (title given by later editors): encykorea E0011715 plus 우리역사넷 ("name acquired 200 years later"); who chose the name is not claimed.
5. Angbuilgu f7/f8 and jagyeongnu f1/f7: KHS pages loaded without full description text in the checks; corroborated by encykorea/Sillok. Exact count of designated sundials not stated in narration ("several").
6. Jagyeongnu f4 mechanism simplified (floating rod and metal balls) from KHS 1536 description plus Sillok 부전; original 1434 clock details may differ.
7. Museum English name: confirmed only from the museum's own site footer and a 2020 news article, not from KHS; KHS portal shows Korean only.
8. Kim Hong-do album attribution: NMK/encykorea mention scholarly debate over some leaves; narration says "known as Danwon's album".
9. Statement that jagyeongnu 1536 vessels have no decoration is not claimed; decoration is simply omitted (encykorea caption mentions a dragon motif on the 수수통).
