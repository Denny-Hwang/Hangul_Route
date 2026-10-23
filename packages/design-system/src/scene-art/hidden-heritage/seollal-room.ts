import type { ItemDef } from '../types';
import type { HiddenHeritageScene, SceneSource } from './types';

/**
 * The Holidays & Traditions Hidden Heritage scene (F-CURR-002 §7.1 F7, §5.4 and OD-10, row CM-37 part 2): a hanok room
 * on Seollal morning, for the Holidays Volume 2 Stage 2 cell. Composed fresh from the scene-art kit in theme tokens: a
 * hanbok hanging on a clothes pole, a lucky pouch on the wall, a window open to the sky with a kite in it, and on the
 * floor a bowl of tteokguk on a small table, a floor cushion and four yut sticks. It copies, traces or follows no
 * painting (style guide rule 1), and no person, Hoya or writing is drawn. No ancestral-rite table, screen or offering is
 * drawn: 차례 is only a reading word in that cell (OD-9).
 *
 * Its chunk (this module) is held to 25,000 B (§10 ceilings table; `hidden-heritage-seollal.test.ts`). Eight colours,
 * none of the ring or focus tokens.
 */

const ACCESSED = '2026-10-23';
const NFM = '국립민속박물관 (National Folk Museum of Korea) — 한국민속대백과사전';
const KHS = '국가유산청 국가유산포털 (Korea Heritage Service, National Heritage Portal)';
const folk = (seq: number): string => `https://folkency.nfm.go.kr/kr/topic/detail/${seq}`;
const portal = (cpno: string): string => `https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=${cpno}`;

const SRC = {
  seol: { institution: 'National Folk Museum of Korea', title: '설 (한국세시풍속사전, Encyclopedia of Korean Seasonal Customs)', url: folk(4243), accessed: ACCESSED, quote: '음력 정월 초하룻날.' },
  kasi2026: {
    institution: 'Korea Astronomy and Space Science Institute',
    title: '2026년 달력자료 (Calendar data 2026)',
    url: 'https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026',
    accessed: ACCESSED,
    quote: '음력(2026, 병오년) 음력의 월일 … 1 1 대 경인 임술 2026 2 17',
  },
  kasi2027: {
    institution: 'Korea Astronomy and Space Science Institute',
    title: '2027년 달력자료 (Calendar data 2027)',
    url: 'https://astro.kasi.re.kr/kor/life/post/calendarData?year=2027',
    accessed: ACCESSED,
    quote: '음력(2027, 정미년) 음력의 월일 … 1 1 소 임인 정사 2027 2 7',
  },
  tteokguk: {
    institution: 'National Folk Museum of Korea',
    title: '떡국 (한국세시풍속사전, Encyclopedia of Korean Seasonal Customs)',
    url: folk(3690),
    accessed: ACCESSED,
    quote: '역사문헌으로는 『동국세시기』와 『열양세시기(洌陽歲時記)』가 있다. 이들 책에서 떡국은 … 설날 아침에 반드시 먹었으며, 손님이 오면 이것을 대접했다고 한다.',
  },
  hanbok: {
    institution: 'Korea Heritage Service',
    title: '국가무형유산 한복생활 (Hanbok, Hanbok Lifestyle)',
    url: portal('127ZZ01480000'),
    accessed: ACCESSED,
    quote: '국가무형유산 한복생활 Hanbok (Hanbok Lifestyle) … 지정(등록)일 2022.07.20',
  },
  seolbim: {
    institution: 'Korea Heritage Service',
    title: '국가무형유산 한복생활 — 국가유산 상세 (open data)',
    url: 'https://www.khs.go.kr/cha/SearchKindOpenapiDt.do?ccbaKdcd=17&ccbaAsno=0001480000000&ccbaCtcd=ZZ',
    accessed: ACCESSED,
    quote: '특히, 설이나 추석 등의 명절이면 새로이 원단을 장만하여 옷을 지어 입었는데, 이를 각각 ‘설빔’·‘추석빔’·‘단오빔’이라 하였고',
  },
  yut: {
    institution: 'Korea Heritage Service',
    title: '국가무형유산 윷놀이 (Yut nori, Playing Yut)',
    url: portal('127ZZ01490000'),
    accessed: ACCESSED,
    quote: '국가무형유산 윷놀이 Yut nori (Playing Yut) … 지정(등록)일 2022.11.11',
  },
  yutSeason: {
    institution: 'Korea Heritage Service',
    title: '국가무형유산 윷놀이 — 국가유산 상세 (open data)',
    url: 'https://www.khs.go.kr/cha/SearchKindOpenapiDt.do?ccbaKdcd=17&ccbaAsno=0001490000000&ccbaCtcd=ZZ',
    accessed: ACCESSED,
    quote: '양편으로 나뉘어 윷가락 4개를 던져, … 정초(正初)부터 정월대보름까지 가족 및 마을공동체를 중심으로 지속적으로 전승·유지되어 왔다.',
  },
  kite: {
    institution: 'National Folk Museum of Korea',
    title: '연날리기 (한국세시풍속사전, Encyclopedia of Korean Seasonal Customs)',
    url: folk(4522),
    accessed: ACCESSED,
    quote: '조선 후기의 세시기(歲時記)에는 음력 12월부터 연을 날리기 시작하는데, 특히 정초부터 정월 대보름 사이에 연날리기가 성행했던 것으로 기록되어 있다.',
  },
} as const satisfies Record<string, SceneSource>;

const ref = (s: SceneSource, publisher: string) => ({ title: s.title, publisher, url: s.url, accessed: s.accessed });

const SETTING: ItemDef = {
  id: 'scene:hh-seollal-room',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 190,
  alt: 'Inside a hanok room: a plastered wall, a lattice window open to the sky and a board floor with a small table',
  accuracyNote:
    'A generic room of a timber house: a beam, two posts, a plain wall, a window whose two paper-covered lattice doors stand open, a floor of oiled paper over boards and a small round table (soban). It copies no named house; no screen, painting, writing or ritual table is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 190, fill: 'surface.sunken' },
    { t: 'rect', x: 0, y: 0, w: 400, h: 22, fill: 'text.secondary' },
    { t: 'path', d: 'M0 22H12V192H0Z M388 22H400V192H388Z', fill: 'text.secondary' },
    // the clothes pole the hanbok hangs on, tied to the beam
    { t: 'path', d: 'M32 22V44 M112 22V44', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 22, y: 42, w: 100, h: 5, r: 2, fill: 'text.secondary' },
    // the window: sky, two open paper doors, the sill
    { t: 'rect', x: 236, y: 34, w: 120, h: 112, fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thick' },
    { t: 'rect', x: 216, y: 34, w: 20, h: 112, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 356, y: 34, w: 20, h: 112, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M216 62H236M216 90H236M216 118H236M356 62H376M356 90H376M356 118H376M226 34V146M366 34V146', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'rect', x: 230, y: 146, w: 132, h: 6, fill: 'text.secondary' },
    { t: 'ellipse', cx: 336, cy: 128, rx: 16, ry: 6, fill: 'surface.paper', det: true },
    // the floor
    { t: 'rect', x: 0, y: 190, w: 400, h: 110, fill: 'border.strong' },
    { t: 'rect', x: 0, y: 188, w: 400, h: 4, fill: 'text.secondary' },
    { t: 'path', d: 'M0 222H400 M0 262H400 M130 192L116 300 M270 192L284 300', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    // the small round table under the bowl
    { t: 'path', d: 'M78 250L70 284H77L85 252Z M152 250L160 284H153L145 252Z M111 254H119V286H111Z', fill: 'text.secondary' },
    { t: 'ellipse', cx: 115, cy: 246, rx: 54, ry: 9, fill: 'text.secondary', stroke: 'text.secondary', sw: 'thin' },
  ],
};

/** A hanbok, jeogori over chima, hanging on the clothes pole (한복), a target. */
const HANBOK: ItemDef = {
  id: 'prop:hh-hanbok',
  kind: 'object',
  box: { w: 96, h: 116 },
  z: 'mid',
  alt: 'A hanbok, a short jacket over a long skirt, hanging on a pole',
  tags: { heritage: true },
  sourceRef: ref(SRC.hanbok, KHS),
  accuracyNote:
    'The two-piece form the entry names (a jeogori jacket with its tie, otgoreum, over a chima skirt), hung flat. Colours are theme tokens, not a period or a region; the sleeve ends are plain bands.',
  nodes: [
    { t: 'path', d: 'M22 40H74L92 114H4Z', fill: 'theme.rites', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M36 48L28 110M48 48V112M60 48L68 110', stroke: 'surface.paper', sw: 'thin', o: 0.6, det: true },
    { t: 'path', d: 'M12 4H84L94 34H76V44H20V34H2Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M2 26H16V34H2Z M80 26H94V34H80Z', fill: 'theme.letters' },
    { t: 'path', d: 'M38 4L48 26L58 4', fill: 'none', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M48 26L40 52M48 26L56 48', stroke: 'theme.letters', sw: 'thick' },
  ],
};

/** A round lucky pouch on a cord, hanging from a nail (복주머니), an other thing. */
const POUCH: ItemDef = {
  id: 'prop:hh-bokjumeoni',
  kind: 'object',
  box: { w: 56, h: 84 },
  z: 'mid',
  alt: 'A round silk pouch with a drawstring, hanging from a nail',
  tags: { heritage: true },
  sourceRef: { title: '복주머니 (한국세시풍속사전, Encyclopedia of Korean Seasonal Customs)', publisher: NFM, url: folk(4023), accessed: ACCESSED },
  accuracyNote: 'A round pouch (durujumeoni) gathered at the neck by a cord; the embroidered lucky signs of the entry are left out (a plain ring), so no letters are drawn.',
  nodes: [
    { t: 'circle', cx: 28, cy: 4, r: 3, fill: 'text.secondary' },
    { t: 'path', d: 'M28 6L20 32M28 6L36 32', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M14 40C2 52 4 80 28 82C52 80 54 52 42 40Z', fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 16, y: 31, w: 24, h: 10, r: 3, fill: 'theme.rites', stroke: 'text.secondary', sw: 'thin' },
    { t: 'circle', cx: 28, cy: 62, r: 9, fill: 'none', stroke: 'surface.paper', sw: 'thin', det: true },
  ],
};

/** A shield kite seen through the window (연), a target. */
const KITE: ItemDef = {
  id: 'prop:hh-kite',
  kind: 'object',
  box: { w: 72, h: 96 },
  z: 'mid',
  alt: 'A rectangular paper kite, white above and green below, with a disc near the top and a round hole in the middle',
  tags: { heritage: true },
  sourceRef: ref(SRC.kite, NFM),
  accuracyNote:
    'The shield kite (bangpaeyeon) the entry calls the most common Korean kite: a paper rectangle with a round hole at its centre and bamboo sticks. It is drawn as a red-disc, green-skirt kite (hongkkokji nokchimayeon), a kind the entry lists: a coloured disc on the white top half and a coloured lower half, so it stands out from the paper doors. The string runs down out of the window; no writing is drawn.',
  nodes: [
    { t: 'rect', x: 4, y: 4, w: 64, h: 36, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 4, y: 40, w: 64, h: 40, fill: 'theme.nature', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M4 4L68 80M68 4L4 80M36 4V80M4 46H68', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'circle', cx: 36, cy: 18, r: 9, fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'circle', cx: 36, cy: 46, r: 11, fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M36 80Q30 88 34 96', stroke: 'text.secondary', sw: 'thin' },
  ],
};

/** A bowl of rice-cake soup on the small table (떡국), a target. */
const TTEOKGUK: ItemDef = {
  id: 'prop:hh-tteokguk',
  kind: 'object',
  box: { w: 84, h: 58 },
  z: 'mid',
  alt: 'A white bowl of clear soup with oval slices of rice cake',
  tags: { heritage: true },
  sourceRef: ref(SRC.tteokguk, NFM),
  accuracyNote: 'Clear broth with slanted oval slices of white rice cake, as the entry describes; the garnish is two thin dark strips. The bowl is plain.',
  nodes: [
    { t: 'path', d: 'M2 18H82C80 44 64 56 42 56C20 56 4 44 2 18Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 42, cy: 18, rx: 40, ry: 8, fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 28, cy: 17, rx: 9, ry: 4, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 46, cy: 15, rx: 9, ry: 4, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 60, cy: 20, rx: 8, ry: 3.5, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M34 22L42 20M52 23L58 22', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'rect', x: 32, y: 52, w: 20, h: 5, fill: 'text.secondary' },
  ],
};

/** A square floor cushion (방석), an other thing. */
const CUSHION: ItemDef = {
  id: 'prop:hh-bangseok',
  kind: 'object',
  box: { w: 100, h: 40 },
  z: 'mid',
  alt: 'A square purple floor cushion',
  accuracyNote: 'A plain square floor cushion seen from the front, with a button at its centre.',
  nodes: [
    { t: 'rect', x: 2, y: 32, w: 96, h: 6, r: 2, fill: 'text.secondary' },
    { t: 'path', d: 'M10 4H90L98 34H2Z', fill: 'theme.rites', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M18 9H82L88 29H12Z', fill: 'none', stroke: 'surface.paper', sw: 'thin', det: true },
    { t: 'circle', cx: 50, cy: 19, r: 4, fill: 'theme.letters' },
  ],
};

/** Four yut sticks on the floor, three flat side up (윷), an other thing. */
const YUT: ItemDef = {
  id: 'prop:hh-yut',
  kind: 'object',
  box: { w: 88, h: 56 },
  z: 'mid',
  alt: 'Four wooden yut sticks lying on the floor, three flat side up',
  tags: { heritage: true },
  sourceRef: ref(SRC.yutSeason, KHS),
  accuracyNote: 'Four long sticks (garakyut), round on one side and flat on the other; the flat side is drawn light. Three up and one down is the throw called geol.',
  nodes: [
    { t: 'path', d: 'M4 6L64 2L65 11L5 15Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M20 20L82 18L82 27L20 29Z', fill: 'text.secondary', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M6 31L66 35L65 43L5 39Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M24 46L84 44L84 53L24 55Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
  ],
};

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });

export const SEOLLAL_ROOM_SCENE: HiddenHeritageScene = {
  id: 'scene:seollal-room',
  art: {
    setting: SETTING.id,
    altEn: 'A hanok room on Seollal morning, with a window open to the sky.',
    layers: [
      { ref: HANBOK.id, x: 71, y: 162 },
      { ref: POUCH.id, x: 172, y: 142 },
      { ref: KITE.id, x: 296, y: 140 },
      { ref: TTEOKGUK.id, x: 115, y: 244 },
      { ref: CUSHION.id, x: 228, y: 290 },
      { ref: YUT.id, x: 338, y: 284 },
    ],
  },
  items: [SETTING, HANBOK, POUCH, KITE, TTEOKGUK, CUSHION, YUT],
  things: { hanbok: 0, bokjumeoni: 1, yeon: 2, tteokguk: 3, bangseok: 4, yut: 5 },
  round: {
    id: 'hh1',
    sceneId: 'scene:seollal-room',
    altEn: 'A hanok room on Seollal morning, with a window open to the sky.',
    // Stage 2 Holidays words, each with a bundled card picture for the Pic-Word Match fallback.
    targets: [
      { id: 'hanbok', word: word('한복', 'hanbok', 'traditional Korean clothes'), spot: { x: 18, y: 38, w: 106, h: 128 }, picture: 'card:hanbok' },
      { id: 'tteokguk', word: word('떡국', 'tteokguk', 'rice-cake soup'), spot: { x: 66, y: 178, w: 94, h: 76 }, picture: 'card:tteokguk' },
      { id: 'yeon', word: word('연', 'yeon', 'kite'), spot: { x: 254, y: 40, w: 84, h: 104 }, picture: 'card:kite' },
    ],
    others: [
      { id: 'bokjumeoni', word: word('복주머니', 'bokjumeoni', 'lucky pouch'), spot: { x: 136, y: 54, w: 76, h: 92 } },
      { id: 'bangseok', word: word('방석', 'bangseok', 'floor cushion'), spot: { x: 172, y: 220, w: 108, h: 76 } },
      { id: 'yut', word: word('윷', 'yut', 'yut sticks'), spot: { x: 292, y: 216, w: 94, h: 76 } },
    ],
  },
  note: {
    subjectEn:
      'Seollal, the Lunar New Year, at home: New Year clothes, a bowl of tteokguk and the games of the first lunar month (yut and kites), as the records of seasonal customs describe them.',
    facts: [
      {
        id: 'f1',
        claimEn: 'Seollal is the first day of the first lunar month, so its date moves each year: it was 17 February in 2026 and is 7 February in 2027.',
        sources: [SRC.seol, SRC.kasi2026, SRC.kasi2027],
      },
      {
        id: 'f2',
        claimEn: 'Old books of seasonal customs record that tteokguk was always eaten on the morning of Seollal and served to visitors.',
        sources: [SRC.tteokguk],
      },
      {
        id: 'f3',
        claimEn: 'Hanbok (Hanbok Lifestyle) has been a National Intangible Heritage of Korea since 20 July 2022. New clothes made for Seollal were called seolbim.',
        sources: [SRC.hanbok, SRC.seolbim],
      },
      {
        id: 'f4',
        claimEn: 'Yut nori (Playing Yut), a game of four thrown sticks, has been a National Intangible Heritage of Korea since 11 November 2022. It is traditionally played from the New Year to the first full moon.',
        sources: [SRC.yut, SRC.yutSeason],
      },
      {
        id: 'f5',
        claimEn: 'Records of the late Joseon period say kites were flown most from the New Year to Daeboreum, the first full moon of the year.',
        sources: [SRC.kite],
      },
    ],
    accuracyNote:
      'Composed from the kit, not from a painting: no figure, viewpoint or group of a known painting is used, and no person is drawn. The room, the table and the cushion are generic. Foods and games of one holiday only (Seollal); songpyeon, ogokbap and the ancestral rite (charye) are not drawn. Nothing is framed as a UNESCO element.',
  },
  review: {
    reviewedBy: 'MAR',
    reviewedAt: '2026-10-23',
    passes: 4,
    notes: [
      'Author: all ten sources opened on 2026-10-23 (the encyclopedia through its search and content API, the heritage records through the portal and its open-data detail); every quote is copied from them, "…" marks an elision.',
      'Pass 1, three checkers in parallel. Language: words, romanization and glosses pass; fixed es f2 ("en la mañana"), ko f2 (세시풍속 as one word), the ko alt word order and "durujumeoni" in a note. Culture and facts: f1-f5 supported by their quoted words; Hanbok Lifestyle and Yut nori are national heritage, never UNESCO; one holiday, no charye table, no person, no painting copied. Learning design: taught Stage 2 Holidays targets with card pictures, spots H-1 to H-4; the kite shared the paper doors\' colour.',
      'Pass 2, reviser: the language fixes above; the kite redrawn as a red-disc, green-skirt kite (hongkkokji nokchimayeon, listed in the kite entry), its alt and note updated. Kept: 연 as a target (a taught word; its device voice is a single syllable), no genre-painting citation (the subject is seasonal customs, a kite day in the style guide).',
      'Pass 3, final read of the revised file across all three lanes: every fix confirmed with no new problem; eight colours, none of the ring or focus tokens.',
      'Pass 4, a fresh checker before the PR: every quote re-read against the live pages on 2026-10-23 (the encyclopedia content API for 설, 떡국, 연날리기 and 복주머니, all of 한국세시풍속사전; the open-data records, designation dates 20220720 and 20221111; the KASI tables for 2026 and 2027). Two claims tightened to their sources: f4 says yut is traditionally played from the New Year to the first full moon (the record speaks of how it was handed down, not of when it may be played), and f5 names the late Joseon records the kite entry cites; es and ko follow. The es and ko meanings match the ones the Stage 2 Holidays cell already ships.',
    ],
  },
  overlays: {
    es: {
      alt: 'Una habitación de un hanok en la mañana de Seollal, con una ventana abierta al cielo.',
      things: {
        hanbok: 'ropa tradicional coreana',
        tteokguk: 'sopa de masa de arroz',
        yeon: 'cometa',
        bokjumeoni: 'bolsita de la suerte',
        bangseok: 'cojín para el suelo',
        yut: 'palitos de yut',
      },
      facts: {
        f1: 'Seollal es el primer día del primer mes lunar, así que su fecha cambia cada año: fue el 17 de febrero en 2026 y es el 7 de febrero en 2027.',
        f2: 'Antiguos libros de costumbres de cada estación cuentan que el tteokguk siempre se comía en la mañana de Seollal y se ofrecía a las visitas.',
        f3: 'El hanbok (Hanbok Lifestyle) es Patrimonio Inmaterial Nacional de Corea desde el 20 de julio de 2022. La ropa nueva hecha para Seollal se llamaba seolbim.',
        f4: 'El yut nori (Playing Yut), un juego de cuatro palitos que se lanzan, es Patrimonio Inmaterial Nacional de Corea desde el 11 de noviembre de 2022. Tradicionalmente se juega desde Año Nuevo hasta la primera luna llena.',
        f5: 'Según registros de finales de Joseon, las cometas se volaban sobre todo desde Año Nuevo hasta Daeboreum, la primera luna llena del año.',
      },
    },
    ko: {
      alt: '창문이 하늘로 열린, 설날 아침의 한옥 방.',
      things: {
        hanbok: '한국의 전통 옷',
        tteokguk: '설날에 먹는, 떡을 넣은 국',
        yeon: '바람에 날리는 종이 장난감',
        bokjumeoni: '새해에 행운을 바라며 지니는 작은 주머니',
        bangseok: '앉을 때 밑에 까는 작은 깔개',
        yut: '놀이할 때 던지는 나무 막대 네 개',
      },
      facts: {
        f1: '설날은 음력 1월 1일이라서 양력 날짜가 해마다 달라요. 2026년에는 2월 17일이었고, 2027년에는 2월 7일이에요.',
        f2: '옛 세시풍속 책에는 설날 아침에 떡국을 꼭 먹고, 손님이 오면 떡국을 대접했다고 적혀 있어요.',
        f3: '한복생활은 2022년 7월 20일에 국가무형유산으로 지정되었어요. 설날에 새로 지어 입는 옷을 설빔이라고 했어요.',
        f4: '윷가락 네 개를 던져 노는 윷놀이는 2022년 11월 11일에 국가무형유산으로 지정되었어요. 정초부터 정월 대보름까지 가족과 마을에서 즐겨 온 놀이예요.',
        f5: '조선 후기 기록에 따르면 연날리기는 정초부터 정월 대보름 사이에 가장 많이 했어요.',
      },
    },
  },
};
