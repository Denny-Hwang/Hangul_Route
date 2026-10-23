import type { ItemDef } from '../types';
import type { HiddenHeritageScene } from './types';

/**
 * The Play & Crafts Hidden Heritage scene (F-CURR-002 §5.6 S2 and §7.1 F7, row CM-37 part 4): a courtyard set out for
 * the traditional games of the New Year days, for the Play & Crafts Volume 2 Stage 2 cell. Composed fresh from the
 * scene-art kit in theme tokens (OD-10): a low stone wall under a blue sky with a shield kite flying, a wooden platform
 * with a kite reel, two folded ttakji and a jegi, and the yard with five gonggi stones, a spinning top, and four yut
 * sticks beside a yut board on a straw mat. It copies, traces or follows no painting: genre painting is its subject
 * only (style guide rule 1), and no person, Hoya or writing is drawn.
 *
 * Its chunk (this module: the setting, the eight props, the layers, the reference round, its es and ko meanings and the
 * note) is held to 25,000 B (§10 ceilings table; `hidden-heritage.test.ts`). Eight colours, none of the ring or focus
 * tokens.
 */

const SETTING: ItemDef = {
  id: 'scene:hh-play-courtyard',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 120,
  alt: 'A courtyard with a low stone wall, a wooden platform and a straw mat under a blue sky',
  accuracyNote: 'A generic house courtyard: a low wall of stones, an outdoor wooden platform on two legs and a woven straw mat on the ground. No sign, writing or named place is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'theme.crafts' },
    { t: 'rect', x: 0, y: 98, w: 400, h: 22, fill: 'surface.paper' },
    { t: 'rect', x: 0, y: 92, w: 400, h: 8, fill: 'text.secondary' },
    { t: 'path', d: 'M0 109H400M30 100V109M90 100V109M150 100V109M210 100V109M270 100V109M330 100V109M60 109V120M120 109V120M180 109V120M240 109V120M300 109V120M360 109V120', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 0, y: 120, w: 400, h: 180, fill: 'surface.sunken' },
    { t: 'rect', x: 196, y: 214, w: 198, h: 84, r: 4, fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M196 235H394M196 256H394M196 277H394', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 6, y: 122, w: 388, h: 74, fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M6 147H394M6 171H394', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 6, y: 196, w: 388, h: 8, fill: 'text.secondary' },
    { t: 'rect', x: 16, y: 204, w: 10, h: 10, fill: 'text.secondary' },
    { t: 'rect', x: 374, y: 204, w: 10, h: 10, fill: 'text.secondary' },
    { t: 'path', d: 'M65 94C70 110 60 120 55 130', stroke: 'text.secondary', sw: 'thin' },
  ],
};

/** A shield kite (연, bangpaeyeon): paper on bamboo spars, a round hole in the middle and a round disc at the top. */
const KITE: ItemDef = {
  id: 'prop:hh-shield-kite',
  kind: 'object',
  box: { w: 64, h: 84 },
  z: 'mid',
  alt: 'A white rectangular paper kite with a round hole in the middle and an orange disc at the top',
  accuracyNote:
    'A shield kite (bangpaeyeon) as the National Folk Museum of Korea describes the common Korean kite: an upright paper rectangle with a round hole in its centre; the disc at the top and the spars are drawn plain.',
  nodes: [
    { t: 'rect', x: 4, y: 4, w: 56, h: 72, r: 2, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M4 4L60 76M60 4L4 76M32 4V76M4 30H60', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'circle', cx: 32, cy: 40, r: 10, fill: 'theme.crafts', stroke: 'text.secondary', sw: 'thin' },
    { t: 'circle', cx: 32, cy: 16, r: 7, fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'line', x1: 32, y1: 76, x2: 32, y2: 84, stroke: 'text.secondary', sw: 'thin' },
  ],
};

/** A kite reel (얼레) wound with string, an other thing. */
const REEL: ItemDef = {
  id: 'prop:hh-kite-reel',
  kind: 'object',
  box: { w: 70, h: 62 },
  z: 'mid',
  alt: 'A wooden reel wound with string, with a handle below',
  accuracyNote: 'A plain four-sided reel (eolle) of the kind a kite string is wound on; its wood is drawn dark and the wound string gold.',
  nodes: [
    { t: 'rect', x: 10, y: 8, w: 50, h: 42, fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M12 19H58M12 29H58M12 39H58', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 4, y: 2, w: 8, h: 52, r: 2, fill: 'text.secondary' },
    { t: 'rect', x: 58, y: 2, w: 8, h: 52, r: 2, fill: 'text.secondary' },
    { t: 'rect', x: 31, y: 50, w: 8, h: 12, r: 2, fill: 'text.secondary' },
  ],
};

/** Two folded paper ttakji (딱지), an other thing. */
const TTAKJI: ItemDef = {
  id: 'prop:hh-ttakji',
  kind: 'object',
  box: { w: 72, h: 50 },
  z: 'mid',
  alt: 'Two square tiles of folded paper, one blue and one orange',
  accuracyNote: 'Two square ttakji folded from paper, their folds drawn as crossed lines; no print or pattern is shown.',
  nodes: [
    { t: 'rect', x: 4, y: 14, w: 38, h: 34, r: 2, fill: 'theme.crafts', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M4 14L42 48M42 14L4 48', stroke: 'surface.paper', sw: 'thin', det: true },
    { t: 'rect', x: 30, y: 4, w: 38, h: 34, r: 2, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M30 4L68 38M68 4L30 38', stroke: 'surface.paper', sw: 'thin', det: true },
  ],
};

/** A jegi (제기): a wrapped coin with a fringe of paper, kicked with the foot. */
const JEGI: ItemDef = {
  id: 'prop:hh-jegi',
  kind: 'object',
  box: { w: 60, h: 76 },
  z: 'mid',
  alt: 'A small orange weight with a tall white paper fringe',
  accuracyNote: 'A jegi as the National Folk Museum of Korea describes it: a coin wrapped in thin paper or cloth whose ends are cut into a fringe; the coin is drawn as a plain disc with a hole.',
  nodes: [
    { t: 'path', d: 'M30 58C8 52 2 24 10 6C18 22 22 30 30 34C38 30 42 22 50 6C58 24 52 52 30 58Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M30 56L18 16M30 56L30 12M30 56L42 16', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'ellipse', cx: 30, cy: 64, rx: 16, ry: 9, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 26, y: 61, w: 8, h: 5, fill: 'text.secondary' },
  ],
};

/** A spinning top (팽이): wood carved into a cone, with a metal tip. */
const TOP: ItemDef = {
  id: 'prop:hh-top',
  kind: 'object',
  box: { w: 56, h: 70 },
  z: 'mid',
  alt: 'An orange cone-shaped wooden top with a flat white face and a dark tip',
  accuracyNote: 'A paengi carved into a cone with a flat face, as the National Folk Museum of Korea describes it; the stripes are plain bands and the whip is not drawn.',
  nodes: [
    { t: 'path', d: 'M4 18H52L30 62H26Z', fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M10 30H46M16 42H40', stroke: 'theme.crafts', sw: 'base', det: true },
    { t: 'ellipse', cx: 28, cy: 18, rx: 24, ry: 7, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 26, y: 61, w: 4, h: 7, fill: 'text.secondary' },
    { t: 'path', d: 'M4 66C16 70 40 70 52 66', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
  ],
};

/** One yut stick: a round-ended bar, its flat face up (paper) or its round back up (wood). */
const stick = (x: number, y: number, rot: number, flat: boolean): ItemDef['nodes'][number] => ({
  t: 'group',
  tx: x,
  ty: y,
  rot,
  kids: [{ t: 'rect', x: -28, y: -5, w: 56, h: 10, r: 5, fill: flat ? 'surface.paper' : 'border.strong', stroke: 'text.secondary', sw: 'base' }],
});

/** Four yut sticks (윷) as they land after a throw: three flat faces up, one round back. */
const YUT: ItemDef = {
  id: 'prop:hh-yut-sticks',
  kind: 'object',
  box: { w: 76, h: 52 },
  z: 'mid',
  alt: 'Four short wooden sticks lying where they landed, three with their flat white face up',
  accuracyNote:
    'Four yut sticks, each flat on one face and rounded on the other, as Korea Heritage Service and the National Folk Museum of Korea describe them; the marks some sets carry on the back are left out.',
  nodes: [
    stick(36, 9, -6, true),
    stick(40, 21, 4, false),
    stick(34, 33, -3, true),
    stick(40, 44, 6, true),
    { t: 'path', d: 'M14 21H18M60 21H64', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
  ],
};

/** The 29 stations of a yut board on a 50-unit square from (11, 7): 20 round the edge, 9 on the two diagonals. */
const YUTPAN_STATIONS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: Array<readonly [number, number]> = [];
  const [x0, y0, side] = [11, 7, 50];
  for (let i = 0; i < 5; i += 1) {
    const d = (side * i) / 5;
    out.push([x0 + d, y0], [x0 + side, y0 + d], [x0 + side - d, y0 + side], [x0, y0 + side - d]);
  }
  const [cx, cy] = [x0 + side / 2, y0 + side / 2];
  out.push([cx, cy]);
  for (const [ex, ey] of [[x0, y0], [x0 + side, y0], [x0 + side, y0 + side], [x0, y0 + side]] as const) {
    for (const t of [1 / 3, 2 / 3]) out.push([ex + (cx - ex) * t, ey + (cy - ey) * t]);
  }
  return out;
})();

/** A yut board (윷판), an other thing: a paper square with the stations of the course. */
const YUTPAN: ItemDef = {
  id: 'prop:hh-yutpan',
  kind: 'object',
  box: { w: 72, h: 64 },
  z: 'mid',
  alt: 'A square paper board marked with dots round its edge and along two crossing lines',
  accuracyNote: 'A yut board drawn as its 29 stations, 20 round a square and 9 on its two diagonals, on plain paper; no pieces are drawn.',
  nodes: [
    { t: 'rect', x: 6, y: 2, w: 60, h: 60, r: 2, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M11 7L61 57M61 7L11 57', stroke: 'text.secondary', sw: 'thin' },
    ...YUTPAN_STATIONS.map(([cx, cy]) => ({ t: 'circle' as const, cx: Math.round(cx * 2) / 2, cy: Math.round(cy * 2) / 2, r: 2.5, fill: 'text.secondary' as const })),
  ],
};

/** Five gonggi stones (공기), an other thing. */
const GONGGI: ItemDef = {
  id: 'prop:hh-gonggi',
  kind: 'object',
  box: { w: 70, h: 40 },
  z: 'mid',
  alt: 'Five small round stones in different colours',
  accuracyNote: 'Five small play stones of the kind gonggi is played with; the colours stand for any set.',
  nodes: [
    { t: 'ellipse', cx: 12, cy: 30, rx: 8, ry: 6, fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 28, cy: 32, rx: 8, ry: 6, fill: 'theme.crafts', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 44, cy: 30, rx: 8, ry: 6, fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 60, cy: 32, rx: 8, ry: 6, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 36, cy: 12, rx: 8, ry: 6, fill: 'theme.life', stroke: 'text.secondary', sw: 'thin' },
  ],
};

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });

const ALT = 'A courtyard set out for games on a winter day.';
const ACCESSED = '2026-10-23';
const NFM = 'National Folk Museum of Korea';
const folk = (topic: number, title: string, quote: string) => ({
  institution: NFM,
  title,
  url: `https://folkency.nfm.go.kr/kr/topic/detail/${topic}`,
  accessed: ACCESSED,
  quote,
});

export const PLAY_COURTYARD_SCENE: HiddenHeritageScene = {
  id: 'scene:play-courtyard',
  art: {
    setting: SETTING.id,
    altEn: ALT,
    layers: [
      { ref: KITE.id, x: 65, y: 94 },
      { ref: REEL.id, x: 55, y: 190 },
      { ref: TTAKJI.id, x: 152, y: 190 },
      { ref: JEGI.id, x: 344, y: 190 },
      { ref: GONGGI.id, x: 54, y: 282 },
      { ref: TOP.id, x: 148, y: 290 },
      { ref: YUT.id, x: 247, y: 288 },
      { ref: YUTPAN.id, x: 344, y: 290 },
    ],
  },
  items: [SETTING, KITE, REEL, TTAKJI, JEGI, TOP, YUT, YUTPAN, GONGGI],
  things: { yeon: 0, eolle: 1, ttakji: 2, jegi: 3, gonggi: 4, paengi: 5, yut: 6, yutpan: 7 },
  round: {
    id: 'hh1',
    sceneId: 'scene:play-courtyard',
    altEn: ALT,
    // The Stage 2 Play words of quest:stage2-crafts-q2, with their taught meanings and bundled card pictures, so the
    // Pic-Word Match fallback is all pictures and an answer reads the item the cell already teaches.
    targets: [
      { id: 'yeon', word: word('연', 'yeon', 'kite'), spot: { x: 22, y: 4, w: 86, h: 94 }, picture: 'card:kite' },
      { id: 'paengi', word: word('팽이', 'paengi', 'spinning top'), spot: { x: 108, y: 210, w: 80, h: 86 }, picture: 'card:top' },
      { id: 'yut', word: word('윷', 'yut', 'yut sticks'), spot: { x: 204, y: 216, w: 86, h: 78 }, picture: 'card:yutnori' },
      { id: 'jegi', word: word('제기', 'jegi', 'a shuttlecock toy you kick'), spot: { x: 302, y: 104, w: 84, h: 93 }, picture: 'card:jegi' },
    ],
    others: [
      { id: 'eolle', word: word('얼레', 'eolle', 'string reel'), spot: { x: 12, y: 110, w: 86, h: 87 } },
      { id: 'ttakji', word: word('딱지', 'ttakji', 'folded paper tile'), spot: { x: 110, y: 110, w: 84, h: 87 } },
      { id: 'gonggi', word: word('공기', 'gonggi', 'jackstones'), spot: { x: 12, y: 212, w: 84, h: 80 } },
      { id: 'yutpan', word: word('윷판', 'yutpan', 'yut board'), spot: { x: 301, y: 216, w: 86, h: 78 } },
    ],
  },
  note: {
    subjectEn: 'The New Year days in a courtyard, a subject of everyday-life painting: the traditional games of yunnori, kite flying, jegichagi, spinning tops, ttakji and gonggi.',
    facts: [
      {
        id: 'f1',
        claimEn: 'Yunnori is played with four yut sticks. Two sides throw them, and how the sticks land, face down or face up, decides how far the pieces move on the yut board.',
        sources: [
          {
            institution: 'Korea Heritage Service',
            title: '국가무형유산 윷놀이 (National Intangible Heritage Yunnori)',
            url: 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?pageNo=1_1_1_0&ccbaKdcd=17&ccbaAsno=0001490000000&ccbaCtcd=ZZ&ccbaCpno=127ZZ01490000',
            accessed: ACCESSED,
            quote: '‘윷놀이’는 양편으로 나뉘어 윷가락 4개를 던져, 윷가락이 엎어지고 젖혀진 상태에 따라 윷판의 모든 말을 목적지에 먼저 도달시키는 편이 이기는 놀이로',
          },
          folk(4702, '윷놀이, 한국세시풍속사전 (Encyclopedia of Korean Seasonal Customs)', '윷패는 4개의 윷을 던져서 엎어지고 젖혀진 상황에 따라 도·개·걸·윷·모로 결정된다.'),
        ],
      },
      {
        id: 'f2',
        claimEn: 'Yunnori is played from New Year’s Day to the first full moon of the year, and people of every age play it together.',
        sources: [folk(4702, '윷놀이, 한국세시풍속사전 (Encyclopedia of Korean Seasonal Customs)', '정월 초하루에서 보름까지 윷이라는 놀이도구를 사용하여 남녀노소 누구나 어울려 즐기면서 노는 놀이.')],
      },
      {
        id: 'f3',
        claimEn: 'A kite is made of paper on thin bamboo sticks and flown on a string wound on a reel. The most common Korean kite is the shield kite, a rectangle with a round hole in the middle.',
        sources: [
          folk(4522, '연날리기, 한국세시풍속사전 (Encyclopedia of Korean Seasonal Customs)', '종이에 가는 대나무가지를 붙여 연을 만들고, 얼레에 감은 실을 연결한 다음 날리며 논다.'),
          folk(4522, '연날리기, 한국세시풍속사전 (Encyclopedia of Korean Seasonal Customs)', '한국 연의 대표격이라 할 수 있는 사각 장방형의 중앙에 방구멍이 뚫려 있는 방패연이 대부분을 이룬다.'),
        ],
      },
      {
        id: 'f4',
        claimEn: 'A jegi is a coin or a piece of metal wrapped in thin, strong paper or cloth, its ends cut into a fringe. Players kick it with the foot.',
        sources: [folk(4833, '제기차기, 한국세시풍속사전 (Encyclopedia of Korean Seasonal Customs)', '제기는 엽전이나 쇠붙이에 얇고 질긴 종이나 천을 접어서 싼 다음, 끝을 여러 갈래로 찢어 너풀거리게 한 놀이기구이다.')],
      },
      {
        id: 'f5',
        claimEn: 'A paengi is wood carved into a cone. It is kept spinning on flat ground or on ice by striking it with a whip.',
        sources: [folk(1634, '팽이치기, 한국민속예술사전 (Encyclopedia of Korean Folk Arts)', '평평한 땅바닥이나 얼음판 위에서 나무를 원뿔모양으로 깎아 만든 팽이를 채찍으로 때려 돌리며 즐기는')],
      },
      {
        id: 'f6',
        claimEn: 'In ttakji, players strike a paper ttakji down on another to flip it over and win it. In gonggi, players toss small pieces called gonggi and catch and grab them by hand.',
        sources: [
          folk(1510, '딱지치기, 한국민속예술사전 (Encyclopedia of Korean Folk Arts)', '종이로 만든 딱지를 서로 내려 쳐서 뒤집어 상대의 딱지를 따먹는 놀이.'),
          folk(1467, '공기놀이, 한국민속예술사전 (Encyclopedia of Korean Folk Arts)', '공기라고 불리는 놀잇감을 손으로 던져서 받고 쥐면서 노는 놀이.'),
        ],
      },
    ],
    accuracyNote:
      'Composed from the kit, not from a painting: no figure, viewpoint or group of any painting is used, and no player is drawn. The kite, reel, ttakji, jegi, stones, top, yut sticks and yut board are generic; no brand, sign or writing is drawn. Kite flying and spinning tops are shared East Asian pastimes; nothing here says they began in Korea, and no UNESCO status is claimed for any of these games.',
  },
  review: {
    reviewedBy: 'MAR',
    reviewedAt: '2026-10-23',
    passes: 3,
    notes: [
      'Pass 1 (author): the Korea Heritage Service page and the five Encyclopedia of Korean Folk Culture entries (topics 4702, 4522, 4833, 1634, 1510, 1467) opened on 2026-10-23; each quote is copied from its page. f1 agrees with the shipped card:yut back.',
      'Pass 2 (culture and facts): the scene shows a games subject only and copies no composition (no figures are drawn); the kite is the shield kite the museum names as the common Korean form; no game is called Korean in origin and no UNESCO claim is made; every institution name is as of the access date.',
      'Pass 3 (language, learning design and anti-shame): the four targets are the Stage 2 Play words of quest:stage2-crafts-q2 with their taught meanings and romanization (rr.ts); the alt text names the setting, never a target; the other meanings do not contain a target meaning; no English label or writing is in the picture; nothing in the scene times, scores or compares.',
    ],
  },
};

/**
 * The es and ko meanings of the reference round, under the overlay paths of `scripts/overlay-fields.mjs` (the round's
 * alt text and the meaning that names each spot). The Play & Crafts Volume 2 Stage 2 cell copies them into its
 * `content/i18n/<locale>` overlay with the round; the targets' meanings are the ones the cell's quest already ships.
 */
export const PLAY_COURTYARD_OVERLAYS = {
  es: {
    'hiddenHeritage.rounds.hh1.alt': 'Un patio preparado para jugar en un día de invierno.',
    'hiddenHeritage.rounds.hh1.targets.yeon.word.gloss': 'cometa',
    'hiddenHeritage.rounds.hh1.targets.paengi.word.gloss': 'peonza, trompo',
    'hiddenHeritage.rounds.hh1.targets.yut.word.gloss': 'palitos de yut',
    'hiddenHeritage.rounds.hh1.targets.jegi.word.gloss': 'un volante que se patea',
    'hiddenHeritage.rounds.hh1.others.eolle.word.gloss': 'carrete de hilo',
    'hiddenHeritage.rounds.hh1.others.ttakji.word.gloss': 'ficha de papel doblado',
    'hiddenHeritage.rounds.hh1.others.gonggi.word.gloss': 'piedritas para lanzar y atrapar',
    'hiddenHeritage.rounds.hh1.others.yutpan.word.gloss': 'tablero de yut',
  },
  ko: {
    'hiddenHeritage.rounds.hh1.alt': '겨울날 놀이 준비를 해 둔 마당.',
    'hiddenHeritage.rounds.hh1.targets.yeon.word.gloss': '바람에 날리는 종이 장난감',
    'hiddenHeritage.rounds.hh1.targets.paengi.word.gloss': '빙글빙글 돌려서 노는 장난감',
    'hiddenHeritage.rounds.hh1.targets.yut.word.gloss': '놀이할 때 던지는 나무 막대 네 개',
    'hiddenHeritage.rounds.hh1.targets.jegi.word.gloss': '발로 차올리며 노는 전통 놀잇감',
    'hiddenHeritage.rounds.hh1.others.eolle.word.gloss': '실을 감고 푸는 나무 틀',
    'hiddenHeritage.rounds.hh1.others.ttakji.word.gloss': '종이를 접어 만든 네모난 놀잇감',
    'hiddenHeritage.rounds.hh1.others.gonggi.word.gloss': '손으로 던지고 받는 작은 돌 다섯 개',
    'hiddenHeritage.rounds.hh1.others.yutpan.word.gloss': '말을 옮기는 길이 그려진 판',
  },
} as const;
