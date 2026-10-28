import type { ItemDef } from '../types';
import type { HiddenHeritageScene } from './types';

/**
 * The Letters Hidden Heritage scene (F-CURR-002 §5.2 and §7.1 F7, row CM-37 part 1): a school room of earlier times, a
 * seodang, the first subject of the National Museum of Korea's album of genre paintings. Composed fresh from the
 * scene-art kit in theme tokens (OD-10): a paper lattice window and a low writing desk on the left, with bound books and
 * a writing brush on a sheet of paper; on the right a door open to the yard, with a mountain, a bird, a tree and a clump
 * of flowers. It copies, traces or follows no painting: genre painting is its subject only (style guide rule 1). No
 * person, Hoya or writing is drawn; the books' title slips are blank.
 *
 * The targets are taught Letters words with a bundled picture each, for the Pic-Word Match fallback (책 `card:book`,
 * 붓 `card:brush`, 나무 `word:nature-tree`), among 산, 새 and 꽃, also taught in the Letters cells. The es and ko text of
 * every English string here is in `content/i18n/<locale>/hidden-heritage.json` (entity `scene:letters-school`).
 *
 * Its chunk (this module) is held to 25,000 B (§10 ceilings table; `hidden-heritage.test.ts`). Eight colours, none of the
 * ring, feedback or focus tokens.
 */

const SETTING: ItemDef = {
  id: 'scene:hh-school-room',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 230,
  alt: 'A school room with a paper lattice window, a low writing desk and a door open to a yard',
  accuracyNote:
    'A generic room of a private school of earlier times: plaster wall, a paper lattice window, an oiled-paper floor and a low writing desk; the door opens on a yard with plain land rising to a far ridge. No sign, writing or named school is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'surface.sunken' },
    { t: 'rect', x: 204, y: 16, w: 188, h: 206, fill: 'surface.canvas' },
    { t: 'rect', x: 204, y: 182, w: 188, h: 40, fill: 'border.strong' },
    // The far land beyond the yard, rising to a ridge the mountain stands on (its base at y 100).
    { t: 'path', d: 'M204 182V102C230 100 270 99 300 100C330 103 362 110 392 120V182Z', fill: 'border.strong' },
    { t: 'path', d: 'M204 102C230 100 270 99 300 100C330 103 362 110 392 120', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'rect', x: 196, y: 8, w: 204, h: 10, fill: 'text.secondary' },
    { t: 'rect', x: 196, y: 8, w: 8, h: 222, fill: 'text.secondary' },
    { t: 'rect', x: 392, y: 8, w: 8, h: 222, fill: 'text.secondary' },
    { t: 'rect', x: 196, y: 222, w: 204, h: 8, fill: 'text.secondary' },
    { t: 'rect', x: 0, y: 230, w: 400, h: 70, fill: 'theme.life' },
    { t: 'path', d: 'M0 264H400', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'rect', x: 20, y: 28, w: 156, h: 104, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M59 28V132M98 28V132M137 28V132M20 63H176M20 97H176', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'rect', x: 6, y: 240, w: 200, h: 10, r: 2, fill: 'text.secondary' },
    { t: 'rect', x: 14, y: 250, w: 10, h: 34, fill: 'text.secondary' },
    { t: 'rect', x: 188, y: 250, w: 10, h: 34, fill: 'text.secondary' },
    { t: 'rect', x: 24, y: 250, w: 164, h: 6, fill: 'border.strong', det: true },
  ],
};

/** Two thread-bound books lying on the desk (책). */
const BOOKS: ItemDef = {
  id: 'prop:hh-bound-books',
  kind: 'object',
  box: { w: 74, h: 44 },
  z: 'mid',
  alt: 'Two thread-bound books with gold covers lying flat',
  accuracyNote:
    'Two closed thread-bound books, bound on the right edge as books written in vertical lines were, with the stitching simplified to short marks; the title slips at the left are blank.',
  nodes: [
    { t: 'rect', x: 2, y: 24, w: 70, h: 18, r: 1, fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 6, y: 6, w: 64, h: 18, r: 1, fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 10, y: 9, w: 9, h: 12, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 8, y: 27, w: 9, h: 12, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M60 9H66M60 15H66M60 21H66M60 28H68M60 34H68M60 40H68', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

/** A writing brush lying on a sheet of paper (붓). */
const BRUSH: ItemDef = {
  id: 'prop:hh-brush-paper',
  kind: 'object',
  box: { w: 78, h: 40 },
  z: 'mid',
  alt: 'A writing brush with a bamboo handle lying across a blank sheet of paper',
  accuracyNote: 'A plain writing brush: a bamboo handle with a dark tip of hair, laid on a blank sheet. No ink stone, writing or maker is drawn.',
  nodes: [
    { t: 'rect', x: 2, y: 16, w: 74, h: 22, r: 1, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'poly', pts: [[14, 30], [58, 8], [62, 14], [18, 36]], fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M58 8C64 4 72 2 76 2C74 6 70 12 62 14Z', fill: 'text.secondary', stroke: 'text.secondary', sw: 'thin' },
    { t: 'circle', cx: 16, cy: 33, r: 3, fill: 'text.secondary', det: true },
    { t: 'path', d: 'M30 22L34 30M44 15L48 23', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

/** A broad-leaved tree in the yard (나무). */
const TREE: ItemDef = {
  id: 'prop:hh-yard-tree',
  kind: 'nature',
  box: { w: 80, h: 100 },
  z: 'mid',
  alt: 'A tree with a round green crown standing in the yard',
  accuracyNote: 'A generic broad-leaved tree; no species is drawn.',
  nodes: [
    { t: 'path', d: 'M34 100L36 58H44L46 100Z', fill: 'text.secondary', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 40, cy: 40, rx: 37, ry: 31, fill: 'theme.nature', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 58, cy: 60, rx: 16, ry: 11, fill: 'theme.nature', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M40 62L28 50M42 64L54 52', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M20 32C24 28 28 28 30 32M48 22C52 18 56 18 58 22', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

/** A mountain beyond the yard (산), an other thing. */
const MOUNTAIN: ItemDef = {
  id: 'prop:hh-far-mountain',
  kind: 'nature',
  box: { w: 90, h: 56 },
  z: 'back',
  alt: 'A blue mountain with two peaks beyond the yard',
  accuracyNote: 'A generic two-peaked mountain seen far off; no named mountain.',
  nodes: [
    { t: 'poly', pts: [[1, 55], [30, 10], [46, 28], [62, 3], [89, 55]], fill: 'theme.crafts', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M30 10L36 30M62 3L58 26', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

/** A bird flying over the yard (새), an other thing. */
const BIRD: ItemDef = {
  id: 'prop:hh-flying-bird',
  kind: 'nature',
  box: { w: 56, h: 36 },
  z: 'front',
  alt: 'A white bird with dark wings flying',
  accuracyNote: 'A generic small bird with a white body and dark wings, head and tail; no species is meant.',
  nodes: [
    { t: 'ellipse', cx: 26, cy: 22, rx: 18, ry: 10, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M16 18C22 4 38 4 44 16Z', fill: 'text.secondary' },
    { t: 'poly', pts: [[9, 20], [1, 12], [3, 26]], fill: 'text.secondary' },
    { t: 'circle', cx: 46, cy: 16, r: 7, fill: 'text.secondary' },
    { t: 'poly', pts: [[52, 14], [55, 16], [52, 18]], fill: 'text.secondary', det: true },
  ],
};

/** A clump of yellow flowers in the yard (꽃), an other thing. */
const FLOWERS: ItemDef = {
  id: 'prop:hh-yard-flowers',
  kind: 'nature',
  box: { w: 64, h: 72 },
  z: 'mid',
  alt: 'A clump of yellow flowers on green stems',
  accuracyNote: 'Generic four-petalled yellow flowers on green stems; no species is meant.',
  nodes: [
    { t: 'path', d: 'M20 72L18 30M32 72V20M44 72L48 34', stroke: 'theme.nature', sw: 'thick' },
    { t: 'poly', pts: [[18, 17], [21, 25], [29, 28], [21, 31], [18, 39], [15, 31], [7, 28], [15, 25]], fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'poly', pts: [[32, 4], [35, 12], [43, 15], [35, 18], [32, 26], [29, 18], [21, 15], [29, 12]], fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'poly', pts: [[48, 21], [51, 29], [59, 32], [51, 35], [48, 43], [45, 35], [37, 32], [45, 29]], fill: 'theme.life', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M18 28V29M32 15V16M48 32V33', stroke: 'text.secondary', sw: 'thick', det: true },
  ],
};

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const NIKL_DICT = 'National Institute of Korean Language';
const STDICT = 'https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=';

export const LETTERS_SCHOOL_SCENE: HiddenHeritageScene = {
  id: 'scene:letters-school',
  art: {
    setting: SETTING.id,
    altEn: 'A school room of earlier times, with a door open to the yard.',
    layers: [
      { ref: MOUNTAIN.id, x: 253, y: 100 },
      { ref: BIRD.id, x: 349, y: 80 },
      { ref: TREE.id, x: 250, y: 220 },
      { ref: FLOWERS.id, x: 347, y: 220 },
      { ref: BOOKS.id, x: 57, y: 240 },
      { ref: BRUSH.id, x: 154, y: 240 },
    ],
  },
  items: [SETTING, BOOKS, BRUSH, TREE, MOUNTAIN, BIRD, FLOWERS],
  things: { san: 0, sae: 1, namu: 2, kkot: 3, chaek: 4, but: 5 },
  round: {
    id: 'hh1',
    sceneId: 'scene:letters-school',
    altEn: 'A school room of earlier times, with a door open to the yard.',
    // Stage 2 Letters words with a bundled picture each, for the Pic-Word Match fallback.
    targets: [
      { id: 'chaek', word: word('책', 'chaek', 'book'), spot: { x: 14, y: 160, w: 86, h: 84 }, picture: 'card:book' },
      { id: 'but', word: word('붓', 'but', 'brush'), spot: { x: 112, y: 160, w: 84, h: 84 }, picture: 'card:brush' },
      { id: 'namu', word: word('나무', 'namu', 'tree'), spot: { x: 208, y: 118, w: 86, h: 104 }, picture: 'word:nature-tree' },
    ],
    others: [
      { id: 'san', word: word('산', 'san', 'mountain'), spot: { x: 206, y: 24, w: 96, h: 82 } },
      { id: 'sae', word: word('새', 'sae', 'bird'), spot: { x: 314, y: 24, w: 76, h: 82 } },
      { id: 'kkot', word: word('꽃', 'kkot', 'flower'), spot: { x: 306, y: 128, w: 84, h: 94 } },
    ],
  },
  note: {
    subjectEn: 'A seodang, a private school of earlier times, a subject of Joseon genre painting: a low desk, bound books and a writing brush.',
    facts: [
      {
        id: 'f1',
        claimEn: 'Danwon pungsokdocheop, a Joseon album of genre paintings at the National Museum of Korea, shows the work and play of everyday life; its first painting is Seodang (the school room).',
        sources: [
          {
            institution: 'National Museum of Korea',
            title: '《단원 풍속도첩》 (Danwon pungsokdocheop, album of genre paintings)',
            url: 'https://www.museum.go.kr/site/main/relic/treasure/view?relicId=3799',
            accessed: '2026-10-23',
            quote: '국적/시대 한국 - 조선 … 이 화첩의 게제순은 1）서당, 2) 논갈이, … 25) 장터길이다. 이들 작품명을 통해서 알 수 있듯이, 각계층의 생업장면과 놀이 등 생활의 이모저모가 잘 나타나 있다.',
          },
        ],
      },
      {
        id: 'f2',
        claimEn: 'A seodang was a place where Classical Chinese was taught privately, in earlier times.',
        sources: [
          {
            institution: NIKL_DICT,
            title: '표준국어대사전 「서당」 (Standard Korean Language Dictionary)',
            url: `${STDICT}%EC%84%9C%EB%8B%B9`,
            accessed: '2026-10-23',
            quote: '예전에, 한문을 사사로이 가르치던 곳.',
          },
        ],
      },
      {
        id: 'f3',
        claimEn: 'A writing brush usually has animal hair set in the end of a thin bamboo or wooden handle; it is dipped in ink or paint.',
        sources: [
          {
            institution: NIKL_DICT,
            title: '표준국어대사전 「붓」 (Standard Korean Language Dictionary)',
            url: `${STDICT}%EB%B6%93`,
            accessed: '2026-10-23',
            quote: '주로 가는 대나무나 나무로 된 자루 끝에 짐승의 털을 꽂아서 먹이나 물감을 찍어 쓴다.',
          },
        ],
      },
    ],
    accuracyNote:
      'Composed from the kit, not from a painting: no figure, viewpoint or group of the album is used, and no teacher or pupil is drawn at all. The room, the desk, the books and the brush are generic; the yard is a plain one. Brush and Classical Chinese are shared East Asian heritage; nothing here says they began in Korea.',
  },
  review: {
    reviewedBy: 'MAR',
    reviewedAt: '2026-10-23',
    passes: 5,
    notes: [
      'Pass 1 (author, 2026-10-23): the subject is the seodang, the first painting of the National Museum of Korea album (its page opened on 2026-10-23; the quotes are copied from it), drawn as an empty room with no figure; the National Institute of Korean Language dictionary pages for 서당 and 붓 opened the same day. Targets 책, 붓 and 나무 and other things 산, 새 and 꽃 are Stage 2 Letters words with the same romanization and gloss as the cell; each target has a bundled picture. The es and ko glosses reuse the reviewed glosses of the Letters cells and the vocabulary topics.',
      "Pass 2 (three checker lists, language, culture and facts, learning design, each read on its own against the author's text). Language: the ko subject first said children learned letters at a seodang, which is age wording (7.7) and more than the dictionary says, so it now reads 옛날의 사설 학교인 서당, as the en and es do; the ko album fact said 모습 twice and now reads 일과 놀이 등 생활의 여러 모습; the album title is written with the converter's romanization, Danwon pungsokdocheop. Culture and facts: every claim was matched to its quoted words; 'Joseon' now rests on the page's 국적/시대 line, added to the quote; the album is named by its title only, as its page leaves the hand open; Classical Chinese and the brush are shared East Asian heritage and no claim gives them a Korean origin; no UNESCO claim; the books are bound on the right with a blank title slip, and no composition of the album is used (its seodang painting is a group of figures with no room drawn). Learning design: every thing is a taught Letters word, the alt texts name the room and never a thing, the spots read in order mountain, bird, book, brush, tree, flower, and the 7.7 list passes (no red, no score, no age words).",
      'Pass 3 (reviser and third pass): the fixes above applied in en, es and ko and the whole scene re-read against its sources; the profile, the culture-source lint, the rr.ts romanization check and the es and ko overlay check pass.',
      "Pass 4 (es and ko pass of the fix stage, 2026-10-27): every spot meaning checked against the reviewed Letters and vocabulary glosses (now a test); the ko 책 gloss read 글이나 where the Letters cell reads 글과, so it now matches the cell; the es and ko subject said the seodang was the subject of Joseon genre painting where the en says a subject, so they now read uno de los temas and 소재 가운데 하나.",
      "Pass 5 (independent es and ko review, 2026-10-27, PASS with nits): all 12 es and ko strings matched to their quoted sources and to the reviewed Letters and vocabulary glosses, with the rr.ts romanization and the 7.7 list rechecked. Applied: the ko subject's second sentence now says where the things are (방에는 낮은 책상, 실로 묶은 책, 붓이 있어요), and the album source is named by its title only, Danwon pungsokdocheop, never as by Danwon. Kept: 사사로이 in the ko seodang fact, the dictionary's own word. The yard view now has plain land rising to a far ridge, so the mountain stands on land.",
    ],
  },
};
