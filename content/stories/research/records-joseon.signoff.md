# records-joseon — FINAL (3rd) sign-off, 2026-10-10

Output: records-joseon.final.json (valid JSON; same shape; top-level "verification": {"passes":3,...}).
Evidence/scripts: heritage/v3/ (qcheck.py quote matcher; dl/ = fresh downloads; dl/desc_*.html = heritage.go.kr 국가유산 설명 loaded from the portal's own ajax file https://www.heritage.go.kr/DATA1/heritage/hub_img/html/cul_<kdcd><ctcd><asno>.html; dl/un_*.txt = Internet-Archive copies of unesco.org register pages; dl/uigwe_pdf.txt = my own PDF extraction; dl/panhwa.txt = 정병모 paper).

## Facts verified: 53 of 53 (6 episodes, 45 scenes)
- Original Annals entries opened and compared with the Chinese + Korean text on sillok.history.go.kr: 태종실록 7권 태종 4년 2월 8일 기묘 4/4 (kca_10402008_004: 親御弓矢…因馬仆而墜, 不傷。顧左右曰: "勿令史官知之。"), 정조실록 42권 정조 19년 윤2월 13일 을미 1/4 (御奉壽堂, 進饌于惠慶宮) and 3/4 (命進饌時參班老人, 七十以上及六十一歲人, 各賜帛一匹). All match the claims.
- Every non-UNESCO cited URL re-fetched fresh; every quote segment machine-matched (only locator/table items needed hand-checks, all confirmed: portal 기본 정보 table 지정일 1999.04.09 / 1973.12.31, 3,243책, 2,329책, 관리자; NIKH 한국의 세계기록유산 목록 1997/2001/2007/2011).
- UNESCO: all four register pages read via Internet Archive: Annals "Registration Year: 1997", Seungjeongwon Ilgi 2001, Uigwe 2007 (submitted 2006), Ilseongnok 2011 (submitted 2010); descriptions quoted exactly. Uigwe nomination PDF re-extracted myself: §1, §3.2, §4.2, §4.3(c) quotes and section numbers verified. Seungjeongwon nomination PDF: could not re-fetch (captcha on archive copy); author's saved text checked (§1.1, §3.1, §5.1, §5.3 found) and each fact it supports also has 2+ other sources.
- Independent sources I chose myself: KHS English portal text for ep1 f5 ("Nobody was allowed to read the sacho… not even the king"), the Sillok DB originals, UNESCO pages via Internet Archive, 정병모 판화사적 연구, shfestival.com, portal 의궤정보 pages.

## Corrections this pass (before -> after, evidence)
1. ep2 f10 + notes (ERROR left by revision): "the poswae entry says every other year by schedule" -> "the poswae entry sets the schedule in the jin-sul-chuk-mi (辰戌丑未) years, the same cycle as the civil-service examination years, which recurs every three years". Evidence: Encyclopedia E0060156 "포쇄식년은 과거식년과 같이 격 2년으로 진술축미년"; 辰, 未, 戌, 丑 are 3 branches apart (격 2년 = 2 years skipped), so it agrees with NIKH/Enc (3 years) and National Archives (2-3). Narration "every few years" unchanged. claim_ko, notes and the source locator updated.
2. ep2 scene 7 narration: "with dried herbs called cheongung and changpo" -> "with herbs called cheongung and changpo". 'dried' appears in no source (사고 page: 약재; E0060156: 천궁·창포). 'wooden chest' is supported (National Archives sub2_3: 실록함 made of 피나무).
3. ep5 f4 Encyclopedia quote was not verbatim ("1795년(정조 19) 윤2월 9일에 정조가…"); replaced with the exact page sentences ("1795년 윤2월 9일 정조가 회갑을 맞은 혜경궁 홍씨를 모시고 현륭원과 화성 행궁에 행차하여 …").
4. Vocab entries that appear in no scene removed: ep1 붓, ep3 비, ep4 왕 (lists now 6/8/7/6/7/7 words, all in scenes).
5. ep5 f8 (판화): second source ADDED — 정병모, 「원행을묘정리의궤」의 판화사적 연구 (한국정신문화연구원 편찬부, KoreaScience JAKO198971663777327): "「정리의궤」는 판화로 찍었고 활자로 간행하였다. 그림은 목판화로 새겼고, 글씨는 … 금속활자인 정리자(整理字)를 사용하였다." and "필사가 아니고 판화로 대량제작하였다". Narration keeps general "prints" (woodblock is now supportable but not claimed).
6. ep6 f3: festival link strengthened — added the festival's own official site (shfestival.com, 63rd festival 2026: program category '능행차' and '정조대왕 능행차' section). Note the Suwon City tourism site lists 수원화성문화제 and 정조대왕능행차 as separate menu items, and says the procession is based on 「원행을묘정리의궤」; narration ("includes … based on the uigwe") is kept neutral and stays valid.
7. UNESCO locators: "Description section (summary, not a verbatim quote)" replaced by the exact wording/registration fields read on the archived pages (all 13 UNESCO source entries).
8. ep3 f7: clarifying parenthetical added (portal 국가유산 설명: 3,243책 = 3,045 titled 승정원일기 + 198 under later office names 승선원일기 etc.). Narration unchanged.

## Resolution of the "still unverifiable" list
1. UNESCO page wording/years — CONFIRMED (Internet Archive), see above.
2. §-locators — CONFIRMED for Uigwe (§1, §3.2, §4.2, §4.3(c)) and Seungjeongwon (§1.1, §3.1, §5.1, §5.3, via author's text).
3. Portal 국가유산 설명 quotes — CONFIRMED against live portal ajax file (not only saved HTML).
4. ep5 f8 prints — CONFIRMED with second source (above).
5. ep5 f6 silk gifts — CONFIRMED in the Annals text itself (a primary source); narration has no numbers; single source retained.
6. Poswae interval / 1603–1606 print counts — poswae: corrected (above); counts: sources differ (4 new copies per KHS/National Archives vs 3 + proof per Enc.), narration says only "five sets" which all agree on — kept.
7. ep2 red cloth vs silk — kept as 'cloth' (홍보 in E0060156; National Archives says 붉은 비단).
8. Leap month — supported by the Annals date lines themselves (정조 19년 윤2월); explanation is definitional.
9. Festival link — see 6.
10. Framing lines (ep6 s1 and s8; ep1 s1 Hoya question; ep2 s8 "Hoya loves sunny days"; ep4 s3, s7 Hoya's notebook) are Hoya's own words / scene-setting, no factual content.

## Remaining uncertainty (low)
- Seungjeongwon nomination-form quotes depend on the author's saved copy (not re-fetchable by me).
- 1603–1606 reprint count and the exact poswae interval differ among sources; narration deliberately generic.
- Silk gift: only the Annals entry (primary); no secondary source found (searches returned none).
- Text of 일성록 國寶 No. (153) appears only in the NIKH table, not used in narration.
- Festival frequency/dates deliberately not stated (schedule may change).
- Illustration briefs not source-checked beyond colour/violence review (they are art direction, not facts).

## Other checks
- Narration <= 45 words (max 41), all scenes map to fact_ids or are clear framing; no numbered national-treasure names in narration (only "National Treasure"); Revised Romanization of every scene/vocab string re-run through rr.py: no mismatches; comprehension questions each have exactly one correct option, answer positions vary (1,0,2 / 2,0,1 / 1,2,0 / 0,2,1 / 1,2,0 / 2,0,1); learning goals match scenes; child-suitability OK (war/fire mentions are brief and gentle; Prince Sado and colonial/war-era losses omitted).

## Sign-off per episode
- story-sillok-royal-historians: YES
- story-sillok-mountain-archives: YES (after corrections 1, 2)
- story-seungjeongwon-ilgi-every-day: YES
- story-ilseongnok-daily-reflection: YES
- story-uigwe-royal-birthday: YES
- story-joseon-records-today: YES
