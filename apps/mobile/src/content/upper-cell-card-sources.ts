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
};

/**
 * The multi-agent review of the eight card backs and their es and ko overlays (F-CURR-002 §9.2). Content stays draft
 * until every pass is recorded; `passes >= 3` and `reviewedBy: 'MAR'` as for a lesson cell. No pass claims native-
 * speaker or expert review. The independent MAR of the es and ko strings runs in the PR's fix stage.
 */
export const UPPER_CARD_REVIEW = {
  status: 'ready' as 'draft' | 'ready',
  reviewedBy: 'MAR' as const,
  reviewedAt: '2026-10-23',
  passes: 4,
  notes: [
    'Pass 1 author (2026-10-23): one card per upper cell of Stages 2-3, its Korean taught in the cell (노래 S2 letters q1, 복주머니 S2 rites q3, 그네 S2 crafts q1, 한글 S3 letters q3, 떡 S3 life, 보름달 S3 rites, 곰 S3 nature, 윷 S3 crafts); facts drawn from §6.6 sources; romanization through the F-CNT-002 converter.',
    "Pass 2a language: 'tied to a child\\'s clothes' is age wording (7.7, card-age-words) and was reworded to 'tied to clothes' in en, es and ko; the full-moon fact repeated 'full moon', now 'That moon stands for plenty'; ko norae 'ol-lasseoyo' for an inscription replaced by the inscription verb 'deungjae-doeeosseoyo'; ko hangeul fact tightened. The title Hangeul keeps the Revised Romanization spelling of the stories; the shipped Hangul Day card is unchanged.",
    "Pass 2b culture and facts: every claim matched to its source words (UPPER_CARD_SOURCES quoteOrLocator); 'wooden' yut sticks is not in the Korea Heritage Service text and was removed from the yut fact and blurb in en, es and ko; the 1443 naming as Hunminjeongeum rests on UNESCO Memory of the World, the 28 letters on NIKL; the UNESCO claim names the exact element, 'inscribed 2012'; the rice cake and Dano facts claim Korea's designation and custom only, never an origin. The heritage.go.kr descriptions load by script, so their words are the ones recorded by the shipped reviews (access dates kept); the new 떡 만들기 page was re-opened for its name and designation date only, which is all the fact claims.",
    'Pass 2c learning design: each Korean word is taught in its cell; no Hangul in an English field; facts at most 180 characters; culture-source, review-copy and the 7.7 list pass; cards come only from finishing a cell (never random, never sold).',
    'Pass 3 reviser and third pass: the fixes above applied and re-read in en, es and ko; the e2e fixture story card that took 한글 now takes its 한글날 축하해요 keyword, so no two cards share a Korean word.',
  ],
} as const;
