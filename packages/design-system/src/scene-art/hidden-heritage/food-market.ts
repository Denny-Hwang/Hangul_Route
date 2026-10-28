import type { ItemDef } from '../types';
import type { HiddenHeritageScene } from './types';

/**
 * The first Hidden Heritage scene (F-CURR-002 §5.3 S2 and §13, row CM-36): a food stall on a market day, for the
 * Food & Daily Life Volume 2 Stage 2 cell. Composed fresh from the scene-art kit in theme tokens (OD-10): a striped
 * awning, a shelf with a jar and a basket of greens, and a counter with a bowl of rice, a bowl of soup, a dish of
 * kimchi and chopsticks on a mat. It copies, traces or follows no painting: genre painting is its subject only
 * (style guide rule 1), and no person, Hoya or writing is drawn.
 *
 * Its chunk (this module: the setting, the six props, the layers, the reference round and the note) is held to
 * 25,000 B (§10 ceilings table; `hidden-heritage.test.ts`). Eight colours, none of the ring or focus tokens.
 */

const SETTING: ItemDef = {
  id: 'scene:hh-market-stall',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 230,
  alt: 'A market food stall with a striped awning, a back shelf and a wooden counter',
  accuracyNote: 'A generic open-air stall: an awning on two posts, a plank shelf and a plank counter. No sign, writing or named market is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'surface.canvas' },
    { t: 'rect', x: 0, y: 45, w: 400, h: 185, fill: 'surface.sunken' },
    { t: 'poly', pts: [[0, 12], [400, 12], [392, 46], [8, 46]], fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M60 13H100V45H60Z M180 13H220V45H180Z M300 13H340V45H300Z', fill: 'surface.paper' },
    { t: 'rect', x: 8, y: 46, w: 8, h: 254, fill: 'text.secondary' },
    { t: 'rect', x: 384, y: 46, w: 8, h: 254, fill: 'text.secondary' },
    { t: 'rect', x: 16, y: 150, w: 368, h: 8, fill: 'text.secondary' },
    { t: 'rect', x: 16, y: 230, w: 368, h: 20, fill: 'border.strong' },
    { t: 'rect', x: 16, y: 250, w: 368, h: 50, fill: 'text.secondary' },
    { t: 'path', d: 'M16 268H384 M16 286H384', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
  ],
};

/** A rice bowl heaped with cooked rice (밥). */
const RICE_BOWL: ItemDef = {
  id: 'prop:hh-rice-bowl',
  kind: 'object',
  box: { w: 72, h: 64 },
  z: 'mid',
  alt: 'A white bowl heaped with cooked rice',
  accuracyNote: 'A plain white rice bowl with a rounded heap of rice; no pattern or maker is shown.',
  nodes: [
    { t: 'path', d: 'M2 26H70C68 50 54 62 36 62C18 62 4 50 2 26Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M6 26C10 4 62 4 66 26Z', fill: 'surface.canvas', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 26, y: 58, w: 20, h: 4, fill: 'text.secondary' },
    { t: 'path', d: 'M10 34H62', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

/** A bowl of soup with greens (국). */
const SOUP_BOWL: ItemDef = {
  id: 'prop:hh-soup-bowl',
  kind: 'object',
  box: { w: 80, h: 54 },
  z: 'mid',
  alt: 'A white bowl of soup with green leaves floating on it',
  accuracyNote: 'A plain soup bowl; the broth and leaves stand for any everyday soup.',
  nodes: [
    { t: 'path', d: 'M2 14H78C76 40 60 52 40 52C20 52 4 40 2 14Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 40, cy: 14, rx: 38, ry: 7, fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 30, y: 48, w: 20, h: 4, fill: 'text.secondary' },
    { t: 'ellipse', cx: 30, cy: 13, rx: 6, ry: 2, fill: 'theme.nature', det: true },
    { t: 'ellipse', cx: 50, cy: 14, rx: 5, ry: 2, fill: 'theme.nature', det: true },
  ],
};

/** A dish of kimchi (김치). */
const KIMCHI_DISH: ItemDef = {
  id: 'prop:hh-kimchi-dish',
  kind: 'object',
  box: { w: 82, h: 46 },
  z: 'mid',
  alt: 'A small white dish of cabbage kimchi',
  accuracyNote: 'A small side dish of cabbage kimchi drawn as red leaves with a green rib; no recipe or region is implied.',
  nodes: [
    { t: 'ellipse', cx: 41, cy: 36, rx: 36, ry: 8, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M14 34C16 18 34 12 44 20C54 12 70 18 68 34Z', fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 41, cy: 26, rx: 9, ry: 5, fill: 'theme.nature' },
    { t: 'path', d: 'M24 28C30 22 36 22 40 26', stroke: 'surface.paper', sw: 'thin', det: true },
  ],
};

/** A pair of chopsticks on a table mat (젓가락). */
const CHOPSTICKS: ItemDef = {
  id: 'prop:hh-chopsticks',
  kind: 'object',
  box: { w: 82, h: 54 },
  z: 'mid',
  alt: 'A pair of metal chopsticks lying on a yellow table mat',
  accuracyNote: 'Flat metal chopsticks of the everyday kind, drawn as two dark lines; the mat is plain.',
  nodes: [
    { t: 'rect', x: 4, y: 36, w: 74, h: 16, r: 3, fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'line', x1: 10, y1: 44, x2: 72, y2: 12, stroke: 'text.secondary', sw: 'thick' },
    { t: 'line', x1: 16, y1: 48, x2: 78, y2: 18, stroke: 'text.secondary', sw: 'thick' },
  ],
};

/** An earthenware jar with a lid (항아리), an other thing. */
const JAR: ItemDef = {
  id: 'prop:hh-jar',
  kind: 'object',
  box: { w: 80, h: 88 },
  z: 'mid',
  alt: 'A round earthenware jar with a dark lid',
  accuracyNote: 'A plain storage jar (hangari) with a lid, drawn light so the rings read on it; no glaze pattern is drawn.',
  nodes: [
    { t: 'path', d: 'M22 18H58C74 30 74 70 58 86H22C6 70 6 30 22 18Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 26, y: 10, w: 28, h: 9, r: 2, fill: 'text.secondary' },
    { t: 'ellipse', cx: 40, cy: 9, rx: 18, ry: 4, fill: 'text.secondary', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M18 36C16 48 18 60 23 68', stroke: 'surface.paper', sw: 'base', det: true },
  ],
};

/** A basket heaped with greens (바구니), an other thing. */
const BASKET: ItemDef = {
  id: 'prop:hh-basket',
  kind: 'object',
  box: { w: 82, h: 66 },
  z: 'mid',
  alt: 'A woven basket heaped with fresh greens',
  accuracyNote: 'A generic woven basket of greens, as sold at a market stall.',
  nodes: [
    { t: 'ellipse', cx: 28, cy: 14, rx: 14, ry: 10, fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 54, cy: 13, rx: 14, ry: 11, fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M4 20H78L70 64H12Z', fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M8 34H75M10 48H72', stroke: 'text.secondary', sw: 'base', det: true },
  ],
};

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });

export const FOOD_MARKET_SCENE: HiddenHeritageScene = {
  id: 'scene:food-market',
  art: {
    setting: SETTING.id,
    altEn: 'A food stall on a market day.',
    layers: [
      { ref: JAR.id, x: 80, y: 150 },
      { ref: BASKET.id, x: 323, y: 150 },
      { ref: RICE_BOWL.id, x: 56, y: 250 },
      { ref: SOUP_BOWL.id, x: 150, y: 250 },
      { ref: KIMCHI_DISH.id, x: 245, y: 246 },
      { ref: CHOPSTICKS.id, x: 341, y: 244 },
    ],
  },
  items: [SETTING, RICE_BOWL, SOUP_BOWL, KIMCHI_DISH, CHOPSTICKS, JAR, BASKET],
  things: { hangari: 0, baguni: 1, bap: 2, guk: 3, gimchi: 4, jeotgarak: 5 },
  round: {
    id: 'hh1',
    sceneId: 'scene:food-market',
    altEn: 'A food stall on a market day.',
    // Stage 2 Food words with a bundled picture each, for the Pic-Word Match fallback.
    targets: [
      { id: 'bap', word: word('밥', 'bap', 'rice'), spot: { x: 12, y: 168, w: 86, h: 90 }, picture: 'card:rice' },
      { id: 'gimchi', word: word('김치', 'gimchi', 'kimchi'), spot: { x: 204, y: 180, w: 82, h: 78 }, picture: 'card:kimchi' },
      { id: 'jeotgarak', word: word('젓가락', 'jeotgarak', 'chopsticks'), spot: { x: 298, y: 180, w: 84, h: 78 }, picture: 'card:chopsticks' },
    ],
    others: [
      { id: 'guk', word: word('국', 'guk', 'soup'), spot: { x: 110, y: 168, w: 82, h: 90 } },
      { id: 'hangari', word: word('항아리', 'hangari', 'jar'), spot: { x: 40, y: 58, w: 80, h: 92 } },
      { id: 'baguni', word: word('바구니', 'baguni', 'basket'), spot: { x: 282, y: 58, w: 82, h: 92 } },
    ],
  },
  note: {
    subjectEn: 'A market day, a subject of Joseon genre painting: food for sale and the everyday table of rice, soup and side dishes.',
    facts: [
      {
        id: 'f1',
        claimEn: "Kim Hongdo's album of genre paintings at the National Museum of Korea shows the work and play of everyday life; its 25th painting is Jangteogil, the road to the market.",
        sources: [
          {
            institution: 'National Museum of Korea',
            title: '《단원 풍속도첩》 (Album of Genre Paintings by Danwon)',
            url: 'https://www.museum.go.kr/site/main/relic/treasure/view?relicId=3799',
            accessed: '2026-10-23',
            quote: '각계층의 생업장면과 놀이 등 생활의 이모저모가 잘 나타나 있다. … 24) 점심, 25) 장터길이다.',
          },
        ],
      },
      {
        id: 'f2',
        claimEn: 'Banchan is the word for all the dishes eaten along with rice.',
        sources: [
          {
            institution: 'National Institute of Korean Language',
            title: '표준국어대사전 「반찬」 (Standard Korean Language Dictionary)',
            url: 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=%EB%B0%98%EC%B0%AC',
            accessed: '2026-10-23',
            quote: '밥에 곁들여 먹는 음식을 통틀어 이르는 말.',
          },
        ],
      },
    ],
    accuracyNote:
      'Composed from the kit, not from a painting: no figure, viewpoint or group of the album is used. The stall, the bowls, the jar and the basket are generic; the food is drawn without any brand, sign or writing.',
  },
  review: {
    reviewedBy: 'MAR',
    reviewedAt: '2026-10-23',
    passes: 4,
    notes: [
      'Pass 1 (author): both pages opened on 2026-10-23; the quotes are copied from them. The National Museum of Korea page lists the album order ending "25) 장터길"; the dictionary gives 반찬 one sense.',
      'Pass 2 (culture and facts): the scene shows a market subject only and copies no composition of the album (no figures are drawn at all); every target is a Stage 2 Food word; nothing is framed as Korean in origin.',
      'Pass 3 (language, learning design and anti-shame): the alt text names the setting, never a target; the targets carry romanization and a gloss; no English label or writing is in the picture.',
      'Pass 4 (reviser): each claim says no more than its quote. f2 backs the subject line ("rice, soup and side dishes"), the table the scene draws around 밥, 국 and 김치; 반찬 itself is not a spot, so the content row that ships the cell either adds it as a thing or keeps f2 on the card back as the subject fact. Institution names are as of the access date; no brand appears.',
    ],
  },
};
