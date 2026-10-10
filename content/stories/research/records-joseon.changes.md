# records-joseon: changes from draft to revised (2026-10-10)

Files: records-joseon.draft.json -> records-joseon.revised.json (build script: rev/build.py; verifier: rev/verify.py).
Method notes: heritage.go.kr "국가유산 설명" text does not render in plain fetches (that is why both checkers could not load it), but it IS present in the page HTML; every heritage.go.kr, 국사편찬위원회, 국가기록원, 한국민족문화대백과사전 and UNESCO-nomination-PDF quote kept in the revised file was re-matched against saved copies of those pages (rev/verify.py; matching ignores whitespace and parenthetical hanja glosses, so some quotes omit "(漢字)" glosses that appear in the page). unesco.org web pages were unreachable (connection reset) on 2026-10-10.

## A. Checker A issues

| # | Where | Resolution |
|---|---|---|
| A1 | ep3 scene 2 / f2 "one special job" | FIXED. Narration now "Six royal secretaries worked here, along with two scribes called 주서. The scribes wrote the office diary." 'junior' removed. f2 notes the juseo had other duties and a temporary extra 가주서 could be added (NIKH, Encyclopedia). |
| A2 | ep3 scene 6 / f6 "each time rebuilt" + "noted sources" | SOFTENED + REMOVED. Narration: "Officials worked to rebuild them, partly using other records such as the court gazette." f6 now states 1744: Ilgicheong restored 548 volumes (< 1/3 of the loss; NIKH + Encyclopedia), 조보 and other records used; 1888: 361 volumes lost, rebuilt by 1890. "Sources were noted" removed (only in UNESCO nomination §3.4, single source); UNESCO PDF dropped from f6. |
| A3 | ep3 f8 / scene 7 "only one original set" | REMOVED. Only the UNESCO nomination form (§5.1 rarity statement; confirmed in saved PDF) says it; no 2nd authoritative source found (NIKH, Encyclopedia, heritage portal, searches). Replaced by sourced fact: originals are kept at Seoul National University's Gyujanggak (NIKH intro "원본은 서울대학교 규장각에 소장", heritage portal 관리자, Encyclopedia 소재지). Comparison with the Annals' multiple copies removed; check question replaced (3,243 books). |
| A4 | ep4 scene 5 / f5 "Jeongjo named it" | REMOVED. Encyclopedia (E0047238): proposals 일성록/월계록/일월통편 in 1781, Jeongjo only objected to 일월통편, "그 뒤 결론이 어떠하였는가는 확인할 수 없다". Narration now "Its title, 일성록, is often translated 'Records of Daily Reflections.'" f5 says who chose the final title is unconfirmed. |
| A5 | ep4 scene 2 / f2 "three standards" | FIXED by dropping the number (translations differ: Legge "three points", Korean sources "세 가지 기준", Encyclopedia gloss also "세 번"). Narration: "...the words of Zengzi in the Analects about looking back on yourself every day." Korean source quotes kept as printed. |
| A6 | ep4 f6, f7 second sources (Chinese/Japanese machine text) | FIXED. Removed. f6 now: Encyclopedia + portal Korean sentence "일목요연한 체재를 갖춘 일기를 편찬하도록 명하였고". f7 now: Encyclopedia + portal Korean sentence "공식적인 국정 일기로 전환되었다". |
| A7 | ep5 scene 7 / f7 "long paintings" | FIXED -> "long pictures" (see B6/B7). f7 claim says pictures; 63 banchado pages among 112 print pages (Encyclopedia). |
| A8 | ep5 title/scene 4/5 birthday vs Hwaseong banquet | FIXED. Scene 4 "a grand celebration of her 60th birthday"; narration never says the banquet was on her birthday; note records that the formal 회갑연 date in the Encyclopedia is 6/18 in Seoul. |
| A9 | ep6 f3 festival name | FIXED -> 수원화성문화제 / "Suwon's Hwaseong Cultural Festival". Sources: KHS English page, Suwon City official page (procession based on 원행을묘정리의궤), Encyclopedia festival entry (E0064678, links festival to the 능행차 reenactment). Narration says the festival "includes a recreation" (no frequency/dates). |
| A10 | ep1 scene 4 / f5 "rule was strict: no one could" | FIXED -> "no one was supposed to read the 사초" in narration, goals and f5 ("By rule ... was allowed"). NIKH caveats are in notes. |
| A11 | ep1 f9 NIKH quote | FIXED -> "...25대 임금들의 실록 28종을 일컫는다." |

## B. Checker B issues

| # | Where | Resolution |
|---|---|---|
| B1 | ep3 scene 6 / f6 | FIXED (same as A2). |
| B2 | ep3 scene 2 "one special job" | FIXED (same as A1). |
| B3 | ep3 scene 2 illustration robe colours | FIXED. All robe-colour claims dropped from every illustration brief (ep1 s2, s5; ep2 s5, s7 'red silk'; ep3 s2; ep4 s1, s3; ep5 s6). |
| B4 | ep4 scene 2 / f2 | FIXED. Number dropped, "Why? One reason was ..." (Encyclopedia also records other readings, e.g. 어제자성편; recorded in notes). |
| B5 | ep4 title_ko | FIXED -> "하루를 돌아본 정조의 일기, 일성록". |
| B6 | ep5 f8 woodblock unsupported; suggested Cambridge UP source | REJECTED the suggested source (re-fetched: the Amsterdam/Cambridge UP page does not mention woodcuts and is about the colour banchado painting); "woodblock" REMOVED. Encyclopedia says only 판화 (prints); narration says "Its pictures are prints, too." No Korean institutional source found saying woodblock. |
| B7 | ep5 scene 7 unnamed uigwe | FIXED. "The record of this trip, the 원행을묘정리의궤 (Wonhaeng Eulmyo Jeongni Uigwe)..."; summary_en and goals name it; "paintings" -> "long pictures". |
| B8 | ep5 scene 5 "leap second month" | FIXED. "By the old lunar calendar, 1795 had an extra 'leap' month after the second month. On its 13th day, the king gave a grand feast ..." (leap-month explanation is general calendar knowledge; f5 claim glosses yun-2-wol). |
| B9 | ep5 f4 birthday nuance | Handled with A8 (no change to fact needed). |
| B10 | ep2 scene 7 / f9 'red silk' | FIXED -> 'red cloth' (poswae entry E0060156: 홍보). Added the poswae entry as a 2nd source. Also found there: herbs were added "충해와 부식을 방지하기 위해" -> narration "helped protect them from bugs and rot" (two sources). The National Archives' split (cheongung = insects, changpo = germs/fragrance) is no longer used. |
| B11 | all checks answer_index = 0 | FIXED. Positions now ep1 1,0,2; ep2 2,0,1; ep3 1,2,0; ep4 0,2,1; ep5 1,2,0; ep6 2,0,1. Distractors rewritten to be plausible but clearly wrong and similar in length; ep2 Q2 distractors changed (King Taejong was implausible); ep3 Q3 and ep4 Q2/Q3 reworded to match changed facts. |
| B12 | ep1 scene 4 Korean subject missing | FIXED -> "사초는 왕도 볼 수 없어요." / Sachoneun wangdo bol su eopseoyo. / "Even the king cannot see the sacho." |
| B13 | goals vs scenes | FIXED. ep3 goal now "일기를 다시 써요"; ep5 scene 4 Korean now "어머니의 환갑" (eomeoniui hwangap) so 어머니 and 환갑 are both in scenes; ep1/ep3/ep4/ep5 goals rewritten to match scenes. |
| B14 | ep1 scene 7 Taejo..Cheoljong | FIXED. Narration and goal say "from Taejo to Cheoljong" (38 words). |

## C. Other items from the revision brief

- Machine-translated heritage.go.kr Chinese/Japanese pages as sources: removed (ep4 f6, f7). The English-language portal sentence "Nobody was allowed to read the sacho..." (ep1 f4) was also dropped; f4 now rests on NIKH, National Archives and the Encyclopedia.
- Portal description quotes: confirmed by matching against saved page HTML (see header); UNESCO nomination quotes confirmed against saved PDF text, except the draft's banchado caption ("Banchado in color ... excellent clarity", ep5 f7) which is NOT in the PDF text and was replaced by the §1 Summary sentence on "Banchado" and "Doseol". UNESCO web-page "quotes" (registration years, descriptions) are now paraphrase locators, not quotes, because unesco.org could not be fetched.
- 'only one original set' -> removed (A3). "noted which sources they used" -> removed (A2). 'Jeongjo named it' -> removed (A4).
- ep4 scene 4 now explains why Gyujanggak officials took over using the portal's Korean description ("직접 처결할 국정 업무가 점차 늘어나") and the Encyclopedia (quoting Jeongjo's 군서표기), and "the king reviewed" -> "approved" (재가).
- ep4 f3 (diary continued after accession) is now supported by the Encyclopedia as well as the portal ("정조의 일기는 즉위 후에도 계속되었는데").
- ep2 scene 8: "on a sunny day" -> "on a clear day" (two sources: National Archives; poswae entry "청명한 길일"), closing sentence 'Thanks to such care, the Annals survive today' removed (no fact entry). f10 now also records the poswae entry's every-other-year schedule.
- ep1 scene 2: "with brush and paper" removed from narration (not in sources).
- ep3 scene 1: Seungjeongwon described as passing royal orders down and officials' opinions up (Encyclopedia wording); scene 5: "scribes wrote fast" removed, NIKH named as the group that rewrote the text; f5 UNESCO nomination source dropped (its "141 photocopies" wording conflicts with NIKH's "해서로 고쳐").
- ep5 scene 3: "Their work was written down" -> "Their names and roles were written down" (UNESCO nomination §4.3(c)).
- ep5 scene 8: no 'woodblock'; says metal movable type (Encyclopedia, KHS portal 의궤정보, UNESCO nomination §4.2).
- Korean title fixes: ep4 (B5) and ep5 title_ko -> "왕실 잔치를 그림으로 남긴 의궤". Revised Romanization of every scene/vocab Korean string re-checked with rr.py; word counts all <= 45 (max 41).
- Counts: 6 episodes, 45 scenes, 53 facts (0 unused, 0 dangling references), 18 comprehension questions.

## D. Still unverifiable (for the final checker)

1. unesco.org Memory of the World pages (Annals 1997, Seungjeongwon Ilgi 2001, Uigwe 2007, Ilseongnok 2011): not reachable on 2026-10-10; registration years are cross-checked by NIKH's 한국의 세계기록유산 목록 table (sjw intro), the heritage portal and the Encyclopedia, and the Seungjeongwon page appeared in a search result with "Registration Year: 2001". Description wording (e.g. "official journal of state affairs", "covers more than 470 years") is paraphrased from the draft and not re-verified verbatim.
2. Section numbers (§1, §3.2, §4.2, §4.3(c), §5.1 ...) in UNESCO nomination-form locators come from the draft; the sentence texts were confirmed in the saved PDFs but the section labels were not independently re-checked (only §1 Summary for the Banchado/Doseol sentence was located).
3. heritage.go.kr 국가유산 설명 quotes: confirmed only against saved HTML (portal pages do not render the description in the checkers' fetch tool). A browser check is advisable. Some quotes omit parenthetical hanja glosses.
4. ep5 f8 "pictures are prints (판화)": only the Encyclopedia (E0040890) states it; "woodblock" deliberately not claimed.
5. ep5 f6 (silk gifts to elders): single source, the Annals entry itself (정조실록 42권, 윤2월 13일 3번째기사); no number/date in narration.
6. ep2 f10 poswae interval and ep2 f7 number of newly printed sets: sources disagree; narration is deliberately vague ("every few years", "five sets").
7. ep2 f9 "red cloth" (홍보) vs National Archives "붉은 비단" (red silk): narration follows the more general 'cloth'.
8. Leap-month description in ep5 scene 5 is general calendar knowledge, not cited to a heritage source (the date itself is cited to the Annals).
9. ep6 f3: the festival's yearly schedule/frequency is deliberately not stated; the Suwon City page names the procession event; the link "festival includes the reenactment" rests on the KHS English page and the Encyclopedia entry (whose text is dated).
10. Framing lines with no fact entry: ep6 scenes 1 and 8, Hoya's own words in ep1 scene 1, ep2 scene 8 ("Hoya loves sunny days"), ep4 scenes 3 and 7.
