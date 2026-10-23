/**
 * The sources and the review record of the upper-cell card backs (F-CURR-002 §5.1, §6.6, §7.2 and §9.2, row CM-23).
 * Build and test data only: no app module imports this file (content/__tests__/upper-cell-cards.test.ts checks it), so
 * the start bundle carries none of it. Each card's `citation` (content/upper-card-backs.ts) is the first allowlisted source here.
 *
 * A source is the §6.6 institution as named on its access date, the page title as printed, the page URL on a host the
 * institution runs, the access date, and the words of the page the claim rests on. The `culture-source` card check
 * (`lintCardSources`) holds every entry to the allowlist.
 */
// A type alias (not an interface), so a source is assignable to the lint's passthrough source shape.
export type UpperCardSource = {
  title: string;
  publisher: string;
  url: string;
  accessed: string;
  quoteOrLocator: string;
};

export const UPPER_CARD_SOURCES: Readonly<Record<string, readonly UpperCardSource[]>> = {
  'card:norae': [
    {
      title: 'Arirang, lyrical folk song in the Republic of Korea',
      publisher: 'UNESCO Intangible Cultural Heritage',
      url: 'https://ich.unesco.org/en/RL/00445',
      accessed: '2026-10-23',
      quoteOrLocator: "'Inscribed in 2012 (7.COM) on the Representative List of the Intangible Cultural Heritage of Humanity' / 'Arirang is a popular form of Korean folk song'",
    },
    {
      title: '한국의 인류무형유산 (23건) 목록',
      publisher: '국가유산청 (Korea Heritage Service)',
      url: 'https://www.heritage.go.kr/heri/html/HtmlPage.do?pg=%2Funesco%2FkorInCulHeritage.jsp&pageNo=5_3_2_0',
      accessed: '2026-10-09',
      quoteOrLocator: "'아리랑 (2012)' (the list as recorded by story:gimjang-arirang f9)",
    },
  ],
  'card:bokjumeoni': [
    {
      title: '복주머니 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EB%B3%B5%EC%A3%BC%EB%A8%B8%EB%8B%88',
      accessed: '2026-10-23',
      quoteOrLocator: "'복을 비는 뜻으로, 주로 정초에 어린이에게 매어 주는 두루주머니. 그 속에 쌀·깨·조·팥 따위 곡식을 넣어 아이들의 옷고름에 매어 준다.'",
    },
  ],
  'card:swing': [
    {
      title: '국가무형유산 단오',
      publisher: '국가유산청 (Korea Heritage Service)',
      url: 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?pageNo=1_1_1_0&ccbaKdcd=17&ccbaAsno=0001520000000&ccbaCtcd=ZZ&ccbaCpno=127ZZ01520000',
      accessed: '2026-10-09',
      quoteOrLocator:
        "'단오는 음력 5월 5일로 … 여름의 대표 명절이다.' / English: 'Records from the Goryeo and Joseon eras offer accounts of Dano customs such as holding community festivals, swinging, and making hand-held fans.' (the description as recorded by story:dano-ssireum f1 and f3)",
    },
  ],
  'card:hangeul': [
    {
      title: '알고 싶은 한글',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://www.korean.go.kr/hangeul/origin/001.html',
      accessed: '2026-10-23',
      quoteOrLocator: "1443년(세종 25) 12월 조: '이번 달에 왕이 언문 28자를 만들었다'",
    },
    {
      title: 'Hunminjeongum Manuscript',
      publisher: 'UNESCO Memory of the World',
      url: 'https://www.unesco.org/en/memory-world/hunminjeongum-manuscript',
      accessed: '2026-10-23',
      quoteOrLocator: "'the Korean alphabet of the same name, now called han-gul, the development of which he completed in 1443'",
    },
  ],
  'card:tteok': [
    {
      title: '국가무형유산 떡 만들기',
      publisher: '국가유산청 (Korea Heritage Service)',
      url: 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?pageNo=1_1_1_0&ccbaKdcd=17&ccbaAsno=0001450000000&ccbaCtcd=ZZ&ccbaCpno=127ZZ01450000',
      accessed: '2026-10-23',
      quoteOrLocator: "국가무형유산 '떡 만들기', English 'Tteok Mandeulgi (Tteok making and sharing)'; 지정(등록)일 2021.11.01",
    },
  ],
  'card:full-moon': [
    {
      title: '국가무형유산 추석',
      publisher: '국가유산청 (Korea Heritage Service)',
      url: 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?pageNo=1_1_1_0&ccbaKdcd=17&ccbaAsno=0001530000000&ccbaCtcd=ZZ&ccbaCpno=127ZZ01530000',
      accessed: '2026-10-14',
      quoteOrLocator:
        "'Chuseok is observed on the fifteenth day of the eighth lunar month at the beginning of the harvest season.' / 'The full moon on Chuseok is understood as a symbol of prosperity, fecundity, and a bountiful crop.' (the description as recorded by Holiday Words, note n3)",
    },
  ],
  'card:gom': [
    {
      title: '반달가슴곰 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?pageSize=10&searchKeyword=%EB%B0%98%EB%8B%AC%EA%B0%80%EC%8A%B4%EA%B3%B0',
      accessed: '2026-10-23',
      quoteOrLocator:
        "'곰과의 하나. 몸빛은 광택이 있는 검은색이며, 앞가슴에 반달 모양의 흰무늬가 있다. … 겨울잠을 잔다.' / '우리나라에서는 천연기념물로 지정되어 있다.'",
    },
  ],
  'card:yut': [
    {
      title: '국가무형유산 윷놀이',
      publisher: '국가유산청 (Korea Heritage Service)',
      url: 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?pageNo=1_1_1_0&ccbaKdcd=17&ccbaAsno=0001490000000&ccbaCtcd=ZZ&ccbaCpno=127ZZ01490000',
      accessed: '2026-10-09',
      quoteOrLocator:
        "''윷놀이'는 양편으로 나뉘어 윷가락 4개를 던져, 윷가락이 엎어지고 젖혀진 상태에 따라 윷판의 모든 말을 목적지에 먼저 도달시키는 편이 이기는 놀이로' (the description as recorded by story:seollal-new-year f7)",
    },
  ],
  // ---- Stage 4 (row CM-23 part 2) ----
  'card:mwoyeyo': [
    {
      title: '이게 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EC%9D%B4%EA%B2%8C',
      accessed: '2026-10-23',
      quoteOrLocator: "이게: ''이것이'가 줄어든 말.'",
    },
    {
      title: '뭐 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EB%AD%90',
      accessed: '2026-10-23',
      quoteOrLocator: "뭐 「대명사」 「1」 ''무어'의 준말.' / 무어 「대명사」 「1」 '모르는 사실이나 사물을 가리키는 지시 대명사. =무엇.'",
    },
  ],
  'card:masisseoyo': [
    {
      title: '표준어 규정 제2부 표준 발음법 제15항',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0002&regltn_no=325',
      accessed: '2026-10-23',
      quoteOrLocator:
        "제15항: '받침 뒤에 모음 'ㅏ, ㅓ, ㅗ, ㅜ, ㅟ' 들로 시작되는 실질 형태소가 연결되는 경우에는, 대표음으로 바꾸어서 뒤 음절 첫소리로 옮겨 발음한다.' 다만: ''맛있다, 멋있다'는 [마싣따], [머싣따]로도 발음할 수 있다.'",
    },
  ],
  'card:biga-wayo': [
    {
      title: '장마 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EC%9E%A5%EB%A7%88',
      accessed: '2026-10-23',
      quoteOrLocator: "장마1 「명사」: '여름철에 여러 날을 계속해서 비가 내리는 현상이나 날씨. 또는 그 비.'",
    },
  ],
  'card:gachi': [
    {
      title: '반말 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EB%B0%98%EB%A7%90',
      accessed: '2026-10-23',
      quoteOrLocator:
        "반말 「명사」 「1」: '대화하는 사람의 관계가 분명치 아니하거나 매우 친밀할 때 쓰는, 높이지도 낮추지도 아니하는 말.' / ''이 책 재미있어?', '아주 재미있는걸'에서와 같이 종결 어미 '-아(어)', '-지', '-군', '-ㄴ걸' 따위가 쓰인다.'",
    },
  ],
  // ---- Stages 6-7 and the album legendary cards (row CM-23 part 3) ----
  // A source re-used from a shipped cell's culture note keeps that note's access date and quoted words (the cell's own
  // MAR checked them); the pages opened again for this row carry 2026-10-23.
  'card:won': [
    {
      title: '원 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?pageSize=10&searchKeyword=%EC%9B%90',
      accessed: '2026-10-14',
      quoteOrLocator: "원1 「의존 명사」: '우리나라의 화폐 단위. 1원은 1전의 100배이다. 1962년 6월 10일부터 시행되었다. 기호는 ￦.' (as recorded by Read the Menu, note n1)",
    },
  ],
  'card:yeogiyo': [
    {
      title: '호칭을 정해주세요. (온라인가나다)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=&qna_seq=325443&pageIndex=1',
      accessed: '2026-10-14',
      quoteOrLocator:
        "Answer of 2025-12-22, quoting 「우리, 뭐라고 부를까요?」: '식당, 미용실, 상점과 같은 서비스 기관의 직원을 부르는 말로 '여기요', '저기요' 등이 이미 보편적으로 사용되고 있습니다. 이 말은 직원과 손님 사이라는 사회적 관계를 직접 드러내지 않는다는 점에서 손님과 직원 모두에게 편안하게 사용되고 있습니다.' (as recorded by Order Food, note n1)",
    },
  ],
  'card:gichapyo': [
    {
      title: '역귀성 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EC%97%AD%EA%B7%80%EC%84%B1',
      accessed: '2026-10-14',
      quoteOrLocator: "역귀성 (逆歸省) 「명사」: '명절 때에 자식이 고향의 부모를 찾아가는 것에 대하여 거꾸로 부모가 객지에 있는 자식들을 찾아감.' (as recorded by Travel for Chuseok, note n1)",
    },
  ],
  'card:jeongsang': [
    {
      title: '입산시간지정제',
      publisher: '국립공원공단 (Korea National Park Service)',
      url: 'https://www.knps.or.kr/portal/main/contents.do?menuNo=8000198',
      accessed: '2026-10-14',
      quoteOrLocator: "입산시간지정제는 무엇인가요?: '산행목적지, 거리와 산행시간 등을 고려하여 탐방로별로 입산ㆍ통제시간을 지정ㆍ운영하는 제도입니다.' (as recorded by Hike & Ask, note n3)",
    },
  ],
  'card:deom': [
    {
      title: '덤 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EB%8D%A4',
      accessed: '2026-10-14',
      quoteOrLocator: "덤 「명사」 「1」: '제 값어치 외에 거저로 조금 더 얹어 주는 일. 또는 그런 물건.' (as recorded by Buy at Market, note n3)",
    },
  ],
  'card:ireum': [
    {
      title: '외래어 표기법, 제1장 표기의 원칙',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://www.korean.go.kr/front/page/pageView.do?page_id=P000104&mn_id=97',
      accessed: '2026-10-14',
      quoteOrLocator: 'Chapter 1, articles 1-5: article 1, loanwords are written with the current 24 letters only (as recorded by Write Your Name, note n1)',
    },
    {
      title: '외래어 표기법의 이해 (새국어소식, 2002년 3월)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://www.korean.go.kr/nkview/nknews/200203/44_4.html',
      accessed: '2026-10-14',
      quoteOrLocator: 'Opening paragraphs: the rules spell [p] and [f] both with ㅍ, and [l] and [r] both with ㄹ (as recorded by Write Your Name, note n1)',
    },
  ],
  'card:achim': [
    {
      title: '에 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchView.do?word_no=460139&searchKeywordTo=3',
      accessed: '2026-10-14',
      quoteOrLocator: "에4 「조사」 1 「2」: '앞말이 시간의 부사어임을 나타내는 격 조사.' 예: '나는 아침에 운동을 한다.' (as recorded by My Holiday Memory, note n2)",
    },
  ],
  'card:saengil': [
    {
      title: '돌 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EB%8F%8C',
      accessed: '2026-10-23',
      quoteOrLocator: "돌1 「명사」 「1」: '어린아이가 태어난 날로부터 한 해가 되는 날.'",
    },
  ],
  'card:tokki': [
    {
      title: '토끼 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%ED%86%A0%EB%81%BC',
      accessed: '2026-10-23',
      quoteOrLocator: "토끼1 「명사」: '토낏과의 포유류를 통틀어 이르는 말. 귀가 길고 뒷다리가 앞다리보다 발달하였으며 꼬리는 짧다. 초식성으로 번식력이 강하다.'",
    },
  ],
  'card:bihaenggi': [
    {
      title: '종이접기 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchView.do?word_no=516424&searchKeywordTo=3',
      accessed: '2026-10-14',
      quoteOrLocator: "종이-접기 「명사」: '종이를 접어서 학, 배, 비행기 따위의 모양을 만드는 일.' (as recorded by Make & Share, note n1)",
    },
  ],
  'card:hunminjeongeum': [
    {
      title: 'Hunminjeongum Manuscript',
      publisher: 'UNESCO Memory of the World',
      url: 'https://www.unesco.org/en/memory-world/hunminjeongum-manuscript',
      accessed: '2026-10-23',
      quoteOrLocator: "'The manuscript published in the ninth lunar month of 1446, contains the promulgation by Sejong the Great' / Registration year: 1997",
    },
  ],
  'card:jang': [
    {
      title: 'Knowledge, beliefs and practices related to jang making in the Republic of Korea',
      publisher: 'UNESCO Intangible Cultural Heritage',
      url: 'https://ich.unesco.org/en/RL/knowledge-beliefs-and-practices-related-to-jang-making-in-the-republic-of-korea-01975',
      accessed: '2026-10-23',
      quoteOrLocator:
        "'Inscribed in 2024 (19.COM) on the Representative List of the Intangible Cultural Heritage of Humanity' / 'Jang are fermented sauces – such as soybean paste, soy sauce and red chili paste – that form the basis of the Korean diet.'",
    },
  ],
  'card:hangawi': [
    {
      title: '한가위 (표준국어대사전)',
      publisher: '국립국어원 (National Institute of Korean Language)',
      url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%ED%95%9C%EA%B0%80%EC%9C%84',
      accessed: '2026-10-23',
      quoteOrLocator: "한가위 「명사」: '우리나라 명절의 하나. 음력 팔월 보름날이다. … 햅쌀로 송편을 빚고 햇과일 따위의 음식을 장만하여 차례를 지낸다. =추석.'",
    },
  ],
  'card:jirisan': [
    {
      title: '우리나라 국립공원',
      publisher: '국립공원공단 (Korea National Park Service)',
      url: 'https://www.knps.or.kr/portal/main/contents.do?menuNo=8000665',
      accessed: '2026-10-23',
      quoteOrLocator:
        "'1967년 국립공원위원회의 공원지정 결의와 국토종합계획심의회 통과 후 지리산을 제 1호 국립공원으로 지정' / '전국 24개 국립공원은 유형에 따라 산악형 19개, 해상·해안형 4개, 사적형 1개 공원으로 관리·운영되고 있습니다.'",
    },
  ],
  'card:ssireum': [
    {
      title: 'Traditional Korean wrestling (Ssirum/Ssireum)',
      publisher: 'UNESCO Intangible Cultural Heritage',
      url: 'https://ich.unesco.org/en/RL/traditional-korean-wrestling-ssirum-ssireum-01533',
      accessed: '2026-10-23',
      quoteOrLocator:
        "'Inscribed in 2018 (13.COM) on the Representative List of the Intangible Cultural Heritage of Humanity' / the Republic of Korea's description: players 'wearing long fabric belts around their waists and one thigh'",
    },
    {
      title: 'Traditional Korean wrestling listed as intangible cultural heritage following unprecedented merged application from both Koreas',
      publisher: 'UNESCO Intangible Cultural Heritage',
      url: 'https://ich.unesco.org/en/news/traditional-korean-wrestling-listed-as-intangible-cultural-heritage-following-unprecedented-merged-application-from-both-koreas-00325',
      accessed: '2026-10-23',
      quoteOrLocator: "'on the basis of a joint application by the Democratic People's Republic of Korea and the Republic of Korea'",
    },
  ],
};

/**
 * The album cards that shipped before row CM-23: the taste cells' q1 cards (Lunch Box Words, Outdoor Words, Greeting
 * Dialogues), never gated by `upperCards` (heritage-cards.ts `UPPER_CARD_GATED_IDS`). Test data, like the rest of this
 * file: no app code reads it (row CM-23 part 2 moved it here from content/upper-cell-cards.ts, out of the start bundle).
 */
export const UPPER_CARD_SHIPPED: ReadonlySet<string> = new Set(['card:dosirak', 'card:byeol', 'card:insa']);

/**
 * The multi-agent review of part 1's eight card backs and their es and ko overlays (F-CURR-002 §9.2). Content stays
 * draft until every pass is recorded; `passes >= 3` and `reviewedBy: 'MAR'` as for a lesson cell. No pass claims
 * native-speaker or expert review. Part 2's four Stage 4 cards have their own record, `UPPER_CARD_REVIEW_S4`.
 */
export const UPPER_CARD_REVIEW = {
  status: 'ready' as 'draft' | 'ready',
  reviewedBy: 'MAR' as const,
  reviewedAt: '2026-10-23',
  passes: 5,
  notes: [
    'Pass 1 author (2026-10-23): one card per upper cell of Stages 2-3, its Korean taught in the cell (노래 S2 letters q1, 복주머니 S2 rites q3, 그네 S2 crafts q1, 한글 S3 letters q3, 떡 S3 life, 보름달 S3 rites, 곰 S3 nature, 윷 S3 crafts); facts drawn from §6.6 sources; romanization through the F-CNT-002 converter.',
    "Pass 2a language: 'tied to a child\\'s clothes' is age wording (7.7, card-age-words) and was reworded to 'tied to clothes' in en, es and ko; the full-moon fact repeated 'full moon', now 'That moon stands for plenty'; ko norae 'ol-lasseoyo' for an inscription replaced by the inscription verb 'deungjae-doeeosseoyo'; ko hangeul fact tightened. The title Hangeul keeps the Revised Romanization spelling of the stories; the shipped Hangul Day card is unchanged.",
    "Pass 2b culture and facts: every claim matched to its source words (UPPER_CARD_SOURCES quoteOrLocator); 'wooden' yut sticks is not in the Korea Heritage Service text and was removed from the yut fact and blurb in en, es and ko; the 1443 naming as Hunminjeongeum rests on UNESCO Memory of the World, the 28 letters on NIKL; the UNESCO claim names the exact element, 'inscribed 2012'; the rice cake and Dano facts claim Korea's designation and custom only, never an origin. The heritage.go.kr descriptions load by script, so their words are the ones recorded by the shipped reviews (access dates kept); the new 떡 만들기 page was re-opened for its name and designation date only, which is all the fact claims.",
    'Pass 2c learning design: each Korean word is taught in its cell; no Hangul in an English field; facts at most 180 characters; culture-source, review-copy and the 7.7 list pass; cards come only from finishing a cell (never random, never sold).',
    'Pass 3 reviser and third pass: the fixes above applied and re-read in en, es and ko; the e2e fixture story card that took 한글 now takes its 한글날 축하해요 keyword, so no two cards share a Korean word.',
    "Pass 4 independent MAR (2026-10-23, a separate reviewer of the PR's own commits): es PASS and ko PASS on the 6 album UI messages and the 8 card title, blurb and fact overlays (natural, true to the en text and the sources; 'inscribed 2012' read as 등재되었어요 / se inscribió; 국가무형유산 as named on the access date; no age words, percentages, emoji, origin claims or expert claims). Its nits, applied: ko album 'fresh' is 새로 시작, so the row label no longer says 앨범 twice; the ko gom fact drops the repeated 겨울 (겨울잠을 자고); es 'a partir de la Etapa 2'; the es length allow-list reason names the themeNames form (the Journey cell word is Campo). Kept: the title Hangeul (Revised Romanization, as the stories spell it) beside the shipped Hangul Day card and the Hangul Check UI, whose names are shipped strings this row does not change. The heritage.go.kr words for 단오, 추석 and 윷놀이 are the ones the shipped story reviews recorded (access dates kept); the reviewer found they support the claims.",
  ],
} as const;

/**
 * The multi-agent review of row CM-23 part 2: the four Stage 4 card backs and their es and ko overlays (F-CURR-002
 * §9.2), kept apart from part 1's record so each part's passes and dates read on their own. No pass claims
 * native-speaker or expert review.
 */
export const UPPER_CARD_REVIEW_S4 = {
  status: 'ready' as 'draft' | 'ready',
  reviewedBy: 'MAR' as const,
  reviewedAt: '2026-10-23',
  passes: 5,
  notes: [
    'Part 2 pass 1 author (2026-10-23): one card per upper cell of Stage 4, each a polite (haeyo) line of its cell taught in its Discover (이게 뭐예요? S4 letters q1, 맛있어요 S4 life q2, 비가 와요 S4 nature q1, 같이 할까요? S4 crafts q3); Greeting Dialogues keeps its four shipped cards and its album card is its q1 card:insa, as part 1 chose for the two taste cells; every fact rests on a National Institute of Korean Language page re-opened on 2026-10-23 (이게, 뭐 and 무어, 장마 and 반말 in the Standard Korean Language Dictionary; Standard Pronunciation article 15 and its proviso); romanization through the F-CNT-002 converter.',
    "Part 2 pass 2a language: the es blurb of 비가 와요 repeated its title ('Está lloviendo'), now 'Llueve, así que…'; titles in title case; es avoids a gendered 'juntos' in '¿Jugamos?'; the ko pronunciation fact names both standard forms and ends 'both are correct'; no age wording; every card line ends in the polite yo, as the row asks.",
    "Part 2 pass 2b culture and facts: each claim matched to its quoted words; the banmal fact first read 'the plain talk of people who are very close', which narrows the dictionary's 'unclear or very close', and now reads 'a way of talking used between people who are very close' in en and es (ko already said 쓰는 말); the pronunciation fact says the rules allow two ways, as the article 15 proviso does; the rainy-season fact defines the Korean word only and claims no origin for a season Korea shares with its neighbours; no UNESCO claim in this part.",
    'Part 2 pass 2c learning design: each line is taught in its own cell (test: the card Korean appears in the cell file); facts 89-139 characters, under the 180 cap; no Hangul in an English field; the facts teach about the line (short forms, two right pronunciations, a weather word, the polite ending) and never test the learner; review-copy, culture-source and the 7.7 list pass; cards come only from finishing a cell.',
    'Part 2 pass 3 reviser and third pass: both fixes applied and the four cards re-read in en, es and ko against their sources; no two of the 82 cards share a Korean word (T-AWARD-5).',
    "Part 2 pass 4 independent MAR (2026-10-23, a separate reviewer of part 2's own commits): ko PASS; es NOT PASS on one string. Language: '¿Jugamos?', and the English 'Play Together?' with it, read 같이 할까요? as 'play'; the cell glosses it 'shall we do it together? (polite)' and 할 is 'do', so the card would teach the wrong verb. Fixed in the fix stage with the reviewer's wording: en 'Do It Together?', es '¿Lo hacemos en equipo?' (keeps 'together' with no gendered plural). The en and es masisseoyo facts said the rules give 'this word' two ways; Standard Pronunciation article 15 and its proviso cover the headword 맛있다, so en and es now name masitda (converter romanization), as ko already did. The ko gachi fact's conditional now reads '요'를 빼고 '같이 할까?'라고 하면 반말이에요 (the reviewer's wording). The other es strings and every ko string passed as written: natural, polite, true to the en text and the NIKL sources, no age words, no origin, UNESCO or expert claims.",
  ],
} as const;

/**
 * The multi-agent review of row CM-23 part 3: the ten Stage 6-7 card backs, the five album legendary card backs and
 * their es and ko overlays (F-CURR-002 §9.2), kept apart like part 2's record. No pass claims native-speaker or expert
 * review. The independent MAR of the es and ko strings runs in the PR's fix stage.
 */
export const UPPER_CARD_REVIEW_S67 = {
  status: 'ready' as 'draft' | 'ready',
  reviewedBy: 'MAR' as const,
  reviewedAt: '2026-10-23',
  passes: 4,
  notes: [
    "Part 3 pass 1 author (2026-10-23): one card per Stage 6-7 cell, its word taught in the cell (원 S6 letters, 여기요 S6 life, 기차표 S6 rites, 정상 S6 nature, 덤 S6 crafts; 이름, 아침, 생일, 토끼 and 비행기 from the Stage 7 word banks), Stage 6 pictures drawing the cell's own Korean with round practice amounts in won, Stage 7 pages a word-bank sentence with the neutral cast (Hoya); one legendary card per album; facts from sources the cells' MAR already recorded (access dates kept) or pages opened again on 2026-10-23 (UNESCO Memory of the World and Intangible Cultural Heritage, the Korea National Park Service, the Standard Korean Language Dictionary entries 돌, 토끼 and 한가위).",
    "Part 3 pass 2a language: the travel fact first read 'families often travel home to the parents', now 'many people travel home to their parents' in en, es and ko; the trail fact's 'set times to start up it' now 'set hours to begin the climb'; the letters legendary title 'Hunminjeongeum' overflowed the card page at 320 and is now 'Hangeul Book' (es 'Libro del hangeul'; its Korean stays 훈민정음); the travel fact says 'sons and daughters', since 'children' is age wording in the card check; the es jang fact was cut under the 180-character line; no age wording, no Hangul in an English field.",
    "Part 3 pass 2b culture and facts: each claim matched to its quoted words; UNESCO is claimed only for the exact elements under their UNESCO names with the inscription year on the page (Hunminjeongum Manuscript 1997, jang making 2024, Ssirum/Ssireum 2018 on the joint application of the DPR Korea and the Republic of Korea); the jang fact claims the inscription only and no origin for fermented sauces Korea shares with its neighbours; the Hangawi fact leaves out the dictionary's origin note; the World Heritage page for Getbol could not be opened (HTTP 403), so the Nature legendary card rests on the Korea National Park Service instead; no native-speaker or expert-review claim.",
    'Part 3 pass 2c learning design: every card word appears in its cell file (test), the Stage 7 words in its word bank; facts 76-179 characters; no lyrics, artists or brands; the Library albums only fill, a finished album says Album complete, the legendary earn hint says what to do and never how many are left (7.7); cards come only from finishing cells and albums (never random, never sold).',
    'Part 3 pass 3 reviser and third pass: the fixes applied and the fifteen cards re-read in en, es and ko against their sources; no two of the 97 cards share a Korean word (T-AWARD-5).',
  ],
} as const;
