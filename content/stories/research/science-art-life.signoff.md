# science-art-life: final (pass 3) sign-off, 2026-10-10

Output: science-art-life.final.json (parses; top-level "verification" added).

## Method
- All 44 cited URLs downloaded; every quoted excerpt in every source entry matched programmatically against page text. Residual non-matches were only footnote markers inside Sillok text ("본관(本觀) 021)"), angle brackets stripped from <풍속도 화첩>, and nested quote marks. No fabricated quote found.
- KHS portal descriptions are loaded by script, so they were read through the khs.go.kr open API (SearchKindOpenapiDt.do?ccbaCpno=...): measuring gauge (1111103290000), sundials (1121108450000, 1121121590000), jagyeongnu (1111102290000), Donguibogam 2015-1/2/3, Nanjung ilgi (1113400760000), Kim Hong-do album (1121105270000), ssireum (127ZZ01310000). All matched.
- unesco.org and ich.unesco.org refused direct fetches (connection reset). UNESCO wording and years were confirmed from search excerpts of the UNESCO pages (Donguibogam 2009, "compiled in 1613 ... edited by Heo Jun", preventive medicine / public health care by the state; Nanjung Ilgi 2013, "seven volumes ... almost daily from January 1592 through November 1598", content list; Ssirum joint inscription 2018, 13.COM 10.B.41) and from the KHS Memory of the World / ICH lists.
- Each narration sentence maps to a fact; all narration <= 45 words (max 41); fact_ids and check fact_ids exist; answer positions vary per episode; every vocab word appears in a scene; no numbered treasure names in narration (numbers appear only in source titles such as "(2015-1)", as KHS prints them); no folk tales in this cluster; tragic content (Yi Sun-sin's death, battles, Jang Yeong-sil's later dismissal) omitted.

## Facts verified: 45 (6 + 8 + 7 + 9 + 8 + 7) across 6 episodes

## Corrections in this pass
1. Heo Jun birth year (donguibogam scene 2, f1)
   - Before: "His name was Heo Jun, 허준, who lived from 1539 to 1615 ..."; f1 "Heo Jun (1539-1615)".
   - After: "His name was Heo Jun, 허준, and he served as a doctor at the royal court ..."; f1 gives no birth year (note added).
   - Evidence: KHS designation text says 1539, but encykorea 허준 (E0063152) is self-contradictory: infobox "1539년(중종 32)" (중종 32 = 1537), summary "1539년(중종 34)", photo captions and the captions of related media "1546(명종 1)~1615"; search also shows both 1539 and 1546 in circulation. Not settled, so dropped. Locator on E0063152 rewritten to state this.
2. Jang Yeong-sil rank (jagyeongnu scene 3, f3)
   - Before: "The king gave him a higher official rank." / "the king then granted him the rank of hogun".
   - After: "The king decided to give him a higher official rank." / "decided (his ministers agreeing) to add the rank of hogun".
   - Evidence: Sejong Sillok 1433-09-16 (kda_11509016_003): "호군(護軍)의 관직을 더해 주고자 한다" ... Hwang Hui and others agreed ... "임금이 그대로 따랐다". The record shows a decision, not the grant itself.
3. Donguibogam f4 and f5 second source added (previously f4 single-source)
   - Added 국사편찬위원회 우리역사넷, 신편 한국사 27권 "(3) 특징과 의학사적 의의": "≪동의보감≫의 集例에서 허준은 중국의 의학을 北醫·南醫라 부르면서 우리의 의학을 東醫라 부를 것을 주장하였다" (f4, the 'Dongui' half) and "치료보다도 예방, 더 나아가 건강 그 자체를 더욱 중요하게 추구하고 있다는 점이다" (f5). Verified against the fetched page.
4. Ssireum UNESCO locator (kim-hongdo f7): removed a quotation ("take place on sand ... all ages") I could not verify verbatim; locator now cites only the 2018 inscription (13.COM, joint with DPR Korea) as confirmed. Narration unchanged (it never used the removed text).

## Resolution of the "still unverifiable" list
1. Heo Jun birth year: removed (see above).
2. UNESCO wording: confirmed via search excerpts of the UNESCO/nomination pages; direct fetch impossible from this environment (remaining uncertainty, low).
3. Donguibogam f4: now two sources for the 'Dongui' half; the 'bogam = treasured mirror' half remains encykorea only (literal sense of 寶鑑; low risk). f9: KHS 2015-1 (National Library), 2015-2 (Academy of Korean Studies), 2015-3 (Kyujanggak) all read via API: National Treasure, designated 2015-06-22, 1613 first edition. Confirmed.
4. Nanjung f6: encykorea and 우리역사넷 both say the name came with the 이충무공전서 (Jeongjo era; 우리역사넷 names editors Yun Haeng-im and Yu Deuk-gong). Narration says only "editors". Confirmed.
5. Angbuilgu f7/f8, jagyeongnu f1/f7: KHS texts now read in full (API). Angbuilgu: no early-Joseon example known, surviving ones 17th-18th century; jagyeongnu: only water-vessel parts of the 1536 clock remain, kept at the National Palace Museum of Korea. Confirmed.
6. Jagyeongnu f4 mechanism: KHS text describes exactly the vessel / floating rod / lever / balls / bell-drum-gong chain, Sillok describes the wooden figures; simplified narration is faithful.
7. Museum English name "National Meteorological Museum of Korea": KMA's own site footer (re-read today). Fine.
8. Kim Hong-do attribution: handled by "known as" wording and "attributed to" in the fact; NMK page itself notes critical views of the album.
9. 1536 vessels' decoration: not claimed.

## Remaining uncertainty (all low)
- UNESCO pages not directly fetched (see above).
- Person-name romanization "Yi Sun-sin" follows KHS/UNESCO usage; strict Revised Romanization would be "I Sun-sin" (already flagged in notes; product decision).
- Kim Hong-do born 1745 (KHS "1745~?", encykorea 1745); widely accepted, not independently disputed in the sources checked.
- Narration says "copper" for the crown prince's 1441 vessel (Sillok 銅) and "metal" for the 1442 standard (鐵); Sillok dates are lunar-calendar dates, and narration gives years only.
- 관노 rendered as "servant owned by the government" (gentle but accurate); some may prefer "government slave".
- Zodiac-animal reading of "神의 몸" on the 1434 sundial is the interpretation of KHS and encykorea, not literal Sillok wording (noted in the episode).
- 서운관 appears only in a fact as "Seoun-gwan" (hyphenated RR); not in narration.

## Sign-off
- story-cheugugi-rain-gauge: YES
- story-angbuilgu-sundial: YES
- story-jagyeongnu-water-clock: YES
- story-donguibogam: YES (birth year deliberately omitted)
- story-nanjung-ilgi: YES
- story-kim-hongdo-genre-paintings: YES
