# seasons-tales: revision log (2026-10-10)

Input: seasons-tales.draft.json + checkA + checkB. Output: seasons-tales.revised.json (same shape; 6 episodes, 48 scenes, 18 checks).
How verified: encykorea full texts (curl), 국가유산포털 text via the khs.go.kr open API, KHS UNESCO list page, 표준국어대사전 search pages, and the National Folk Museum's 한국민속대백과사전 through its own site API (folkency.nfm.go.kr/api, JSON; this is how the second sources below were obtained). ich.unesco.org still refuses connections (ECONNRESET), so UNESCO facts were confirmed through search-engine page summaries only.

Legend: FIXED / SOFTENED / REMOVED / REJECTED (with reason) / EXTENDED (my own finding).

## Checker A (18 issues)

| # | Issue | Resolution |
|---|---|---|
| A1 | Sun-Moon f2: tiger "demands food at every pass" but source says rice cake, clothes, arms, legs, torso | FIXED. f2 now says: basic version has demands in turn, rice cakes first; retelling keeps only the first. Scene 2 says so ("The old tale has it ask for more at each hill. We keep it short."). Check 1 now asks what the tiger asked for at the FIRST pass. |
| A2 | f3 drops the nursing-the-baby step | FIXED. Scene 3 + f3: children refuse, then open the door when the tiger says it must feed the crying baby; then realize and flee. A's suggested wording (omits the nursing step) not used because it was less accurate than the source. |
| A3 | f7 needles vs "too bright" | FIXED/EXTENDED. f7 states both: encykorea = needles; NFM 한국민속문학사전 = "강력한 빛을 뿜어낸다" (strong light). Narration follows the NFM wording, so it is source-backed, not invented. Retelling labelled "simplified" in scene 1, f7 and reference_display. |
| A4 | Sun-Moon single-source | FIXED. Second authoritative source found: 한국민속문학사전 「해와 달이 된 오누이」 (국립민속박물관, 조현설), https://folkency.nfm.go.kr/kr/topic/detail/6006 (cites 한국구비문학대계 1-4,811 etc.). Added to f1, f2, f3, f5, f6, f7. f4 (sesame oil) remains encykorea-only; claim kept minimal and noted. |
| A5 | Dano f1: portal sentence lists only three holidays | FIXED. f1 sources now: KHS 설과 대보름 (1518 = three; late-Joseon Dongguk sesigi = four, verified in the API text), encykorea 설 (원단·한식·단오·추석 = 4대 명절), encykorea 단오 (1518 three). Scene 1: "A late-Joseon book, Dongguk sesigi, counted it among Korea's four great holidays". Same fix in Seollal f1. |
| A6 | Knee rule | FIXED. "In a modern match, ... from the knee up"; f5 says "under modern competition rules" and cites the 경기판정 passage. |
| A7 | "bride mask" | FIXED. Illustration: nobleman (yangban) mask + white-faced young-lady (somae-gaksi) mask. (NFM 강릉관노가면극 describes 소매각시 as a white-faced woman with a chignon.) |
| A8 | Ganggangsullae "comes from" | FIXED. Scene 7: "has long been done along Korea's southwestern coast"; f9 says traditionally performed mainly there and that the origin is uncertain (KHS and 한국세시풍속사전 both say so). |
| A9 | f12 Yeoryang sesigi saying | FIXED (verified rather than dropped). 한국세시풍속사전 「더도 말고 덜도 말고 늘 가윗날만 같아라」 quotes Gim Mae-sun's 열양세시기, 8th-month entry, containing the saying; 한국민속예술사전 「열양세시기」 gives the book's identity (preface dated 1819). Narration: "records an old saying like this"; f12 states the book records the saying in Chinese characters and that the modern Korean wording is the familiar form. Note: the dictionary prints 減夜勿 (looks like a typo for 減也勿); Hanja not reproduced in claims. |
| A10 | f5 songpyeon single image-caption source | FIXED. Added 국립민속박물관 어린이민속사전 「송편」 (nfm.go.kr/kids, topic 84) and 한국세시풍속사전 「송편」. Now also supports half-moon shape and pine scent (older note saying these were unverified is superseded). |
| A11 | Arirang 2012 = ROK only | FIXED. Scene 8: "UNESCO inscribed South Korea's Arirang in 2012. North Korea's Arirang has its own separate listing." summary_en, learning goal, f9, reference_display relabelled. New f10: DPRK Arirang, separate entry, 2014 (UNESCO page + 9.COM 10.14). |
| A12 | Kimjang claim_ko name | FIXED. Korean name per 국가유산청 list verified on the fetched page: 김치와 김장문화 (2013). f6 claim_ko and scene 6 (korean/romanization/gloss) use it; UNESCO English title kept. |
| A13 | Refrain gloss "no exact translation" | FIXED. Replaced by "the Arirang refrain (sung syllables)". f7 now cites encykorea E0034277 (several origin theories = folk etymology; the refrain is "의미 없는 사설" that lifts the mood and fills the melody) plus 한국민속문학사전 「아리랑」 (입타령 refrain). |
| A14 | Scene 5 "sweet" | REMOVED. "sweet" gone. Scene 5 now "boiled pork wrapped in the cabbage's yellow inner leaves". |
| A15 | Byeoljubu is a title; healer vs 도사 | FIXED. Scene 6: "a sage"; "a soft-shelled turtle titled Byeoljubu". f8 explains 鼈主簿 as a title, not a name (sources: 토끼전, 수궁가, 표준국어대사전 별주부전 "별주부 곧 자라", 주부(主簿), 도사(道士)). |
| A16 | Nolbu repentance attribution | FIXED, with a new finding. Encykorea 흥보가 itself says only that Nolbo is ruined; 흥부전 (novel basic plot) has the repentance. BUT 한국민속문학사전 「놀보박타령」 shows that the Park Bong-sul and Jeong Gwang-su sung texts also end with Nolbo reforming and reconciling (5th gourd, Jangbi). So the premise "repentance belongs to the novel only" is too strict. Scene 5: "In well-known versions, ..."; f7 attributes to novel basic plot AND those sung texts, and says endings differ. |
| A17 | Aesop not stated | FIXED. summary_en, scene 6, reference_display, learning goal 3, notes; new fact f11 (with Aesop's text, Project Gutenberg, as comparison). |
| A18 | UNESCO URLs | SOFTENED. Short canonical URLs used where search results confirmed them: /en/RL/00070, 00114, 00445, 00881. Kept slug form for Ganggangsullae (…ganggangsullae-00188) and Ssirum (…-01533) because the short form was not confirmed; DPRK Arirang slug used; the 2018 news item now uses its long, search-confirmed URL (the old /en/news/00325 was unconfirmed). |

## Checker B (21 issues)

| # | Issue | Resolution |
|---|---|---|
| B1 | 17 of 18 answers at index 0 | FIXED. Answer positions now 0:5, 1:5, 2:5, 3:3 across 18 checks; distractors of similar length, no jokes (removed "Ice cream/Popcorn", "flew away", "ice", "puppets", etc.). |
| B2 | Sun-Moon check 1 / scene 3 / f2 | FIXED (see A1). B's suggested "What was the mother carrying in her basket?" REJECTED: no basket in either source; used "At the first hill pass..." instead. |
| B3 | f3 merged steps | FIXED (see A2). |
| B4 | Number of children | FIXED. Scene text says "the children"; f3 and notes state encykorea = three siblings (삼 남매, incl. baby), NFM = 오누이 (two). |
| B5 | "Mr. Sun, Ms. Moon" gloss | FIXED. "the Sun and the Moon (with the respectful ending -nim)"; 님 is gender-neutral; sun = sister. |
| B6 | Mother's fate / "Mother could not come home" | SOFTENED. B's optional line REJECTED (it would imply a fate the sources contradict or that we avoid asserting). Added a reassurance beat instead (scene 4 "Don't worry, it's only a story...", scene 7 "end of its tricks", scene 8 "safe and sound"). |
| B7 | Seollal check 3 ambiguous | FIXED. "In the story, which soup does the family eat for Seollal breakfast?" with soup distractors (Miyeokguk, Samgyetang, Seolleongtang). Songpyeon not used. |
| B8 | Dano four holidays | FIXED (see A5). |
| B9 | Bride mask | FIXED (see A7). |
| B10 | Ox vs 황소 | SOFTENED. Narration/UNESCO "ox"; f6 claim_ko says 황소 (UNESCO: ox). |
| B11 | Dano check 3 giveaway | FIXED. Now "Which Dano festival is on UNESCO's Representative List?" with real rivals from the KHS Dano text (Gyeongsan Jain, Beopseongpo). B's suggested distractors (Gyeongju Hwabaek, Jinju Gaecheon, Boryeong Mud) REJECTED: not Dano festivals, so trivially wrong. This check has 3 options. |
| B12 | Ganggangsullae "comes from" | FIXED (see A8). |
| B13 | f12 | FIXED (see A9). |
| B14 | "takes all year" | FIXED. "takes months of preparation"; f2: 반년 이상 (encykorea) + yearly cycle (UNESCO). |
| B15 | "sweet", "everyone" | FIXED. "helpers often share", "Many families give kimchi to neighbors"; f5 rewritten (속대쌈 is an older custom still kept as 미풍). |
| B16 | Refrain gloss | FIXED (see A13). |
| B17 | Byeoljubu | FIXED (see A15). |
| B18 | Aesop | FIXED (see A17). B's optional line "This is a Korean story, not the race you may know!" adapted into scene 6. |
| B19 | "the king demands his liver" | FIXED. "Don't worry: clever Rabbit has a plan." |
| B20 | 추임새 taught? | FIXED. Scene 2 now teaches chuimsae; vocab 추임새 added (형제 dropped from vocab; still the scene-5 Korean word). |
| B21 | Ending attribution | FIXED (see A16). |

## Items from the brief

1. Sun and Moon: done (first-pass question; nursing; sun = sister; children count; needles vs light; "simplified" stated in scene 1, f3, f7, reference_display; second source added; reassurance beats; still clearly a traditional tale, not history).
2. Arirang / Kimjang: done (2012 = South Korea's entry; "no translation" removed; Kimjang names verified; months; "sweet" removed; "everyone" -> helpers/many families).
3. Dano: done (four vs three holidays with period; knee; somae-gaksi; Danoje proclaimed 2005 / inscribed 2008 in narration and f9; "only silent mask drama" kept hedged and now two sources).
4. Chuseok: done (southwestern coast wording; Yeoryang sesigi verified; songpyeon facts backed by NFM).
5. Pansori: done (title not name; sage; repentance attributed to novel basic plot and named sung versions; Aesop distinction in summary, narration, reference_display; reassurance; 구토지설 wording verified in 한국민속문학사전 「수궁가」 + encykorea 「토끼전」 and used as "an early form of this tale is even recorded in the Samguk sagi" (new f12)).
6. Seollal check 3, shuffled answers, chuimsae, canonical UNESCO URLs: done.

## EXTENDED (own findings, not in either report)

- Seollal f1 "one of the four great holidays of the Joseon era" -> late-Joseon Dongguk sesigi wording (the 1518 list had three).
- Seollal scene 2 "Everyone dresses" -> "People dress"; "Girls" -> "Young girls" (source: 여자 어린이).
- Chuseok scene 4 "warm and chewy" removed (unsourced); "half-moons" added (sourced).
- Sun-Moon: "basket" and "at dusk" removed (not in sources); "ask for a rope too" -> "tried a rope too".
- Sun-Moon sesame-oil episode kept but f4 labelled "Encyclopedia's basic version" (single source).
- Dano f9 states that, of Korea's Dano festivals named by KHS, only Gangneung is on UNESCO's list (KHS list of 23 fetched).
- Pansori scene 2 / f2 and f1 got second sources (한국민속문학사전 「추임새」, 「판소리」).

## Still unverifiable

1. 한국구비문학대계 recordings (gubi.aks.ac.kr returned nothing to curl); the second Sun-Moon source is the 국립민속박물관 한국민속문학사전 entry, which itself cites 한국구비문학대계 1-4, 811; 1-5, 308; 2-6, 473; 2-7, 513. The sesame-oil step (f4) has only the encykorea source.
2. ich.unesco.org pages (all UNESCO quotes in quote_or_locator, session numbers, and the DPRK Arirang 2014 date): not reachable from this environment; supported by search-engine page summaries, the KHS list of Korea's 23 UNESCO elements (Arirang 2012; 김치와 김장문화 2013; 강릉단오제 2005/2008; 판소리 2003/2008; 강강술래 2009; 씨름 2018) and UNESCO press-release mirrors. DPRK Arirang 2014 rests on two UNESCO pages only (element page, decision 9.COM 10.14), seen via search snippets.
3. English text on heritage.go.kr portal pages (loaded dynamically): the Korean text was verified through the KHS API, but a few English quote_or_locator strings (e.g. Seollal f3, Chuseok f1/f3, Dano f3) were not re-read.
4. 표준국어대사전 entries for 설빔, 덕담, 창포, 장사, 동아줄, 추임새, 자라, 도/개/걸/모 were not re-fetched (only 별주부전, 주부, 도사 were); consistent with the encyclopedia texts.
5. Original text of 열양세시기: verified only as quoted by the 한국세시풍속사전 (the Hanja there reads 減夜勿, apparently a misprint); not reproduced in the claims.
6. "Korea's only silent mask drama": KHS and the NFM dictionary say it; no independent scholarly source; narration keeps "It is known as".
7. Aesop comparison source is Project Gutenberg's Townsend translation (not a Korean heritage authority); used only to describe the Western fable.
8. Folk Encyclopedia citations were read through the site's JSON API, not the rendered pages (the site is JavaScript-only); the URL pattern https://folkency.nfm.go.kr/kr/topic/detail/<id> comes from the site's router.
