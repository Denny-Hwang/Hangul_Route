# seasons-tales: final (3rd) independent check, 2026-10-10

Input: seasons-tales.revised.json. Output: seasons-tales.final.json (parses; has top-level "verification").

## Method
- Re-fetched all 70 unique cited URLs myself (work dir: heritage/sign/). UNESCO pages came from Wayback copies (Jan-Mar 2025 snapshots, because the live site refuses direct fetch). heritage.go.kr descriptions came from the portal ajax html (cul_<ccbaCpno>.html) plus the khs.go.kr open API. folkency pages came from its JSON API. encykorea, stdict, korea.kr, khs.go.kr press releases, the nfm kids page and Gutenberg were fetched directly.
- Machine-matched all 161 source entries' quote_or_locator strings to the fetched text (sign/qc3.py). The 8 non-matches were checked by hand. All 8 are benign: portal metadata fields (designation date), hanja or footnote punctuation, a quote spanning a Gutenberg line break, or a gloss label. The designation dates were confirmed against the KHS open API field ccbaAsdt: 설과 대보름, 단오 and 추석 = 20231218; 윷놀이 = 20221111.
- Chose my own extra sources: encykorea 선도해 (E0028663) for the Samguk sagi tale; Gutenberg pg21.txt for the Aesop text; 표준국어대사전 타다 for gourd sawing; the UNESCO news release for the DG quote; the KHS 23-element list for "only Gangneung Danoje".
- Checked narration word counts (max 45, scene 8 of Sun and Moon = 45), fact-id mapping (every fact is used, no dangling ids), 2-3 checks per episode with one correct answer and varied positions, RR and 맞춤법, and that no numbered designations appear in narration.

## Facts verified: 61 (Seollal 10, Dano 10, Chuseok 12, Gimjang 10, Sun-and-Moon 7, Pansori 12)

Every fact was re-read against its cited sources. Result: all supported, with the corrections below.

High-risk items confirmed against primary pages:
- Arirang ROK: inscribed 2012 (7.COM), titled "Arirang, lyrical folk song in the Republic of Korea". DPRK: inscribed 2014 (9.COM), a separate entry (00914). The narration says only "separate listing".
- Kimjang: inscribed 2013 (8.COM), titled "Kimjang, making and sharing kimchi in the Republic of Korea". The KHS name 김치와 김장문화 is confirmed on the KHS list.
- Ganggangsullae: 2009 (4.COM). UNESCO says the meaning of the word is unknown. The refrain is the origin of the name.
- Gangneung Danoje: "Inscribed in 2008 (3.COM) ... (originally proclaimed in 2005)". The KHS list shows 강릉단오제 (2005/2008). It is the only Dano item among Korea's 23 UNESCO elements.
- Pansori: 2008 (3.COM), originally proclaimed 2003. The UNESCO text says "a single barrel drum", which supports "barrel drum (buk)".
- Ssireum: inscribed 2018 (13.COM 10.B.41) as a joint DPRK/ROK inscription. The UNESCO news release (26 Nov 2018) quotes Audrey Azoulay, Director-General: "The fact that both Koreas accepted to join their respective applications is unprecedented". The narration says "which UNESCO called unprecedented", which is fair.
- National designation dates (f9 and f10 of Seollal) are in facts only. The narration states years only (2023, 2022) and prints no numbered designations.
- Customs: the sebae order, deokdam, saekdong, changpo and tteokguk sayings are all in the cited Encyclopedia entries. The "age one year older" claim is framed as a saying. Only a hedged "known as" is used for the Gwanno claim. The Ganggangsullae Yi Sun-sin origin story is deliberately not used (KHS says origin is uncertain).
- Pansori madang: twelve once, five now (Chunhyangga, Simcheongga, Sugungga, Heungboga, Jeokbyeokga), per the KHS portal and the Encyclopedia.
- 구토지설 in the Samguk sagi: confirmed by the Encyclopedia 토끼전 (Kim Yu-sin biography), the NFM 수궁가 entry (Seon Do-hae to Kim Chun-chu) and the Encyclopedia 선도해 entry. The narration only says "an early form of this tale is even recorded in the Samguk sagi", which is accurate. In that early form the animal is a 거북 (turtle) and the sick one is the sea king's daughter. The narration does not claim these details.
- Aesop: the Gutenberg text (Townsend) has "The Hare and the Tortoise", a race. The Korean tale is a liver-fetching tale with a 자라 (soft-shelled turtle). The distinction wording is correct.
- Sun and Moon version choice: follows the Encyclopedia basic version (rice cake, sesame oil, new rope vs rotten rope, sorghum, swap because the sister fears the dark). It takes the gentler NFM option for the sun (too bright to look at, not needles). It softens the mother's and baby's fates, the axe and the tiger's death ("the end of its tricks"). "Simplified" and "gentler" are said in scene 1, and the reassurance beats are in scenes 4, 7 and 8. This is clearly a traditional tale, not history.

## Corrections this pass (all in seasons-tales.final.json)
1. Pansori scene 2 narration (precision on a high-risk UNESCO item).
   - Before: "UNESCO recognized pansori in 2003."
   - After: "UNESCO named pansori a masterpiece in 2003 and added it to its Representative List in 2008." (41 words)
   - Evidence: ich.unesco.org/en/RL/00070, "Inscribed in 2008 (3.COM) ... (originally proclaimed in 2003)". Also the KHS list "판소리 (2003/2008)" and fact f4. The old wording could make a reader think 2003 was the Representative List inscription.
2. Pansori f11, Aesop title wording.
   - Before: "Aesop's fable 'The Tortoise and the Hare'".
   - After: Aesop's fable of the hare and the tortoise ("titled 'The Hare and the Tortoise' in the Townsend translation cited here, and also known as 'The Tortoise and the Hare'").
   - Evidence: Project Gutenberg #21 prints "The Hare and the Tortoise", while the claim used the other common title against a source with a different heading.
3. Source additions (no claim changes):
   - Pansori f5: NFM 놀보박타령 added for "greedy" ("자신의 욕심", "끝없는 물욕"). The Encyclopedia entry only says 악하고 사나운.
   - Pansori f6: 표준국어대사전 타다 「5」 added for "sawed/sawn open" ("박 따위를 톱 같은 기구를 써서 ... 갈라지게 하다").
   - Pansori f12: Encyclopedia 선도해 (E0028663) added as a second route to the Samguk sagi tale. It is a source I chose myself.
4. Seollal f9 and f10 locators now also cite the KHS open API date field (ccbaAsdt). The portal's "지정(등록)일" field is metadata and is not in the page text.
5. Added the top-level "verification" block, plus a FINAL PASS note on the pansori episode.

## Remaining uncertainty (none blocking)
1. Ox vs bull. UNESCO's ROK text says "ox"; the DPRK text and the Encyclopedia say bull/황소. The narration follows the UNESCO ROK wording ("an ox").
2. "Only mask drama with no spoken lines" (Gwanno). Two Korean official sources (KHS and NFM) support it, but it is one national claim. The narration hedges it with "known as".
3. 소담하고 윤기 is rendered "thick and shiny". 소담하다 means plump or abundant, so "full and shiny" would be slightly closer. It is harmless and was not changed.
4. Single-source facts that are not dates or numbers: Chuseok f6 (moon symbol, KHS), Chuseok f10 (word meaning unknown, UNESCO), Sun-and-Moon f4 (sesame oil, Encyclopedia) and Pansori f9 (post promise, Encyclopedia). Tale content varies by version, so the narration labels these "in the tale".
5. The NFM dictionary prints 減夜勿 where the book has 減也勿 (a typo in the dictionary). It is noted in the Chuseok facts and does not affect the narration.
6. The Heungbu ending differs between versions. The narration says "In well-known versions", which is supported.
7. UNESCO pages were read from 2025 Wayback copies. The facts used (years, wording) are stable, but the live site could not be fetched here.
8. The existing heritage-cards.ts claims (tteokguk "like coins"; songpyeon) are not used here. This was already flagged in the notes, so keep them out until sourced.
9. Spelling choice 'yunnori' (RR) vs the app card 'yutnori'. Choose one app-wide (already in the notes).

## Sign-off per episode
- story-seollal-new-year: YES
- story-dano-ssireum: YES
- story-chuseok-ganggangsullae: YES
- story-gimjang-arirang: YES
- story-sun-and-moon: YES (traditional tale; version choice and "simplified" disclosure present; gentle)
- story-pansori-tales: YES (after correction 1 and 2)
