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
};

/**
 * The album cards that shipped before row CM-23: the taste cells' q1 cards (Lunch Box Words, Outdoor Words, Greeting
 * Dialogues), never gated by `upperCards` (heritage-cards.ts `UPPER_CARD_GATED_IDS`). Test data, like the rest of this
 * file: no app code reads it (row CM-23 part 2 moved it here from content/upper-cell-cards.ts, out of the start bundle).
 */
export const UPPER_CARD_SHIPPED: ReadonlySet<string> = new Set(['card:dosirak', 'card:byeol', 'card:insa']);

/**
 * The multi-agent review of the twelve card backs (part 1's eight, part 2's four) and their es and ko overlays
 * (F-CURR-002 §9.2). Content stays draft until every pass is recorded; `passes >= 3` and `reviewedBy: 'MAR'` as for a
 * lesson cell. No pass claims native-speaker or expert review. The independent MAR of the es and ko strings runs in the PR's fix stage.
 */
export const UPPER_CARD_REVIEW = {
  status: 'ready' as 'draft' | 'ready',
  reviewedBy: 'MAR' as const,
  reviewedAt: '2026-10-23',
  // Part 1's four passes, then part 2's own four on the Stage 4 cards (author, three checkers, reviser and third pass).
  passes: 4,
  notes: [
    'Pass 1 author (2026-10-23): one card per upper cell of Stages 2-3, its Korean taught in the cell (노래 S2 letters q1, 복주머니 S2 rites q3, 그네 S2 crafts q1, 한글 S3 letters q3, 떡 S3 life, 보름달 S3 rites, 곰 S3 nature, 윷 S3 crafts); facts drawn from §6.6 sources; romanization through the F-CNT-002 converter.',
    "Pass 2a language: 'tied to a child\\'s clothes' is age wording (7.7, card-age-words) and was reworded to 'tied to clothes' in en, es and ko; the full-moon fact repeated 'full moon', now 'That moon stands for plenty'; ko norae 'ol-lasseoyo' for an inscription replaced by the inscription verb 'deungjae-doeeosseoyo'; ko hangeul fact tightened. The title Hangeul keeps the Revised Romanization spelling of the stories; the shipped Hangul Day card is unchanged.",
    "Pass 2b culture and facts: every claim matched to its source words (UPPER_CARD_SOURCES quoteOrLocator); 'wooden' yut sticks is not in the Korea Heritage Service text and was removed from the yut fact and blurb in en, es and ko; the 1443 naming as Hunminjeongeum rests on UNESCO Memory of the World, the 28 letters on NIKL; the UNESCO claim names the exact element, 'inscribed 2012'; the rice cake and Dano facts claim Korea's designation and custom only, never an origin. The heritage.go.kr descriptions load by script, so their words are the ones recorded by the shipped reviews (access dates kept); the new 떡 만들기 page was re-opened for its name and designation date only, which is all the fact claims.",
    'Pass 2c learning design: each Korean word is taught in its cell; no Hangul in an English field; facts at most 180 characters; culture-source, review-copy and the 7.7 list pass; cards come only from finishing a cell (never random, never sold).',
    'Pass 3 reviser and third pass: the fixes above applied and re-read in en, es and ko; the e2e fixture story card that took 한글 now takes its 한글날 축하해요 keyword, so no two cards share a Korean word.',

    // Row CM-23 part 2 (Stage 4), the same passes on its four new cards and their es and ko overlays.
    'Part 2 pass 1 author (2026-10-23): one card per upper cell of Stage 4, each a polite (haeyo) line of its cell taught in its Discover (이게 뭐예요? S4 letters q1, 맛있어요 S4 life q2, 비가 와요 S4 nature q1, 같이 할까요? S4 crafts q3); Greeting Dialogues keeps its four shipped cards and its album card is its q1 card:insa, as part 1 chose for the two taste cells; every fact rests on a National Institute of Korean Language page re-opened on 2026-10-23 (이게, 뭐 and 무어, 장마 and 반말 in the Standard Korean Language Dictionary; Standard Pronunciation article 15 and its proviso); romanization through the F-CNT-002 converter.',
    "Part 2 pass 2a language: the es blurb of 비가 와요 repeated its title ('Está lloviendo'), now 'Llueve, así que…'; titles in title case; es avoids a gendered 'juntos' in '¿Jugamos?'; the ko pronunciation fact names both standard forms and ends 'both are correct'; no age wording; every card line ends in the polite yo, as the row asks.",
    "Part 2 pass 2b culture and facts: each claim matched to its quoted words; the banmal fact first read 'the plain talk of people who are very close', which narrows the dictionary's 'unclear or very close', and now reads 'a way of talking used between people who are very close' in en and es (ko already said 쓰는 말); the pronunciation fact says the rules allow two ways, as the article 15 proviso does; the rainy-season fact defines the Korean word only and claims no origin for a season Korea shares with its neighbours; no UNESCO claim in this part.",
    'Part 2 pass 2c learning design: each line is taught in its own cell (test: the card Korean appears in the cell file); facts 89-139 characters, under the 180 cap; no Hangul in an English field; the facts teach about the line (short forms, two right pronunciations, a weather word, the polite ending) and never test the learner; review-copy, culture-source and the 7.7 list pass; cards come only from finishing a cell.',
    'Part 2 pass 3 reviser and third pass: both fixes applied and the four cards re-read in en, es and ko against their sources; no two of the 82 cards share a Korean word (T-AWARD-5).',
  ],
} as const;
