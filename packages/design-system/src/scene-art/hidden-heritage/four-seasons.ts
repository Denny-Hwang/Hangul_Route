import type { ItemDef } from '../types';
import type { HiddenHeritageScene } from './types';

/**
 * The Nature & Animals Hidden Heritage scene (F-CURR-002 §5.5 S2, §7.1 F7 and OD-10, row CM-37 part 3 of 4): the four
 * seasons side by side in four plain panels, for the Nature & Animals Volume 2 Stage 2 cell. Spring wind blows petals,
 * a summer cloud rains, a magpie sits on an autumn branch, a mountain stands in winter; a flower, a summer tree, a moon
 * bear and the falling snow are the other things. Composed fresh from the scene-art kit in theme tokens: it copies, traces
 * or follows no painting (style guide rule 1), and no person, Hoya, tiger or writing is drawn. The magpie and the
 * tiger of folk painting are a fact of the card back, never a picture here.
 *
 * Its chunk (this module: the setting, the eight props, the layers, the reference round and the note) is held to
 * 25,000 B (§10 ceilings table; `hidden-heritage-four-seasons.test.ts`). Eight colours, none of the ring or focus
 * tokens. The es and ko of every English string a learner reads here (alt text, spot meanings, subject, card-back facts)
 * are in `content/i18n/<locale>/hidden-heritage.json` (entity `scene:four-seasons`).
 */

/** The four panels: a sky tint per season over a ground band, divided by posts. */
const SETTING: ItemDef = {
  id: 'scene:hh-four-seasons',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 236,
  alt: 'Four panels side by side, one for each season of the year',
  accuracyNote: 'Four plain panels, spring to winter from left to right: a sky tint and a ground band each. No place, sign or writing is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'surface.paper' },
    { t: 'rect', x: 0, y: 0, w: 100, h: 236, fill: 'theme.nature', o: 0.08 },
    { t: 'rect', x: 100, y: 0, w: 100, h: 236, fill: 'theme.crafts', o: 0.15 },
    { t: 'rect', x: 200, y: 0, w: 100, h: 236, fill: 'theme.life', o: 0.2 },
    { t: 'rect', x: 300, y: 0, w: 100, h: 236, fill: 'theme.crafts', o: 0.35 },
    { t: 'rect', x: 0, y: 236, w: 200, h: 64, fill: 'theme.nature' },
    { t: 'rect', x: 200, y: 236, w: 100, h: 64, fill: 'theme.life' },
    { t: 'rect', x: 300, y: 236, w: 100, h: 64, fill: 'surface.paper' },
    { t: 'path', d: 'M300 236H400', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M10 262H90 M110 274H190 M210 266H290', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 98, y: 0, w: 4, h: 300, fill: 'text.secondary' },
    { t: 'rect', x: 198, y: 0, w: 4, h: 300, fill: 'text.secondary' },
    { t: 'rect', x: 298, y: 0, w: 4, h: 300, fill: 'text.secondary' },
    { t: 'rect', x: 1, y: 1, w: 398, h: 298, fill: 'none', stroke: 'text.secondary', sw: 'thick' },
  ],
};

/** Spring wind (바람): three gusts carrying azalea-coloured petals. */
const WIND: ItemDef = {
  id: 'prop:hh-spring-wind',
  kind: 'nature',
  box: { w: 80, h: 96 },
  z: 'mid',
  alt: 'Swirling gusts of wind carrying petals',
  accuracyNote: 'Wind drawn as three curling lines, the usual picture-book sign; the petals stand for any spring blossom.',
  nodes: [
    { t: 'path', d: 'M4 30C18 14 42 14 50 28C56 40 42 48 36 38', fill: 'none', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M2 56H50C66 56 70 40 60 34', fill: 'none', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M12 80H44C58 80 60 92 50 94', fill: 'none', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 66, cy: 18, rx: 8, ry: 5, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 72, cy: 52, rx: 7, ry: 5, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 26, cy: 68, rx: 7, ry: 4.5, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 64, cy: 84, rx: 6, ry: 4, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 66, cy: 18, r: 1.5, fill: 'surface.paper', det: true },
    { t: 'circle', cx: 72, cy: 52, r: 1.5, fill: 'surface.paper', det: true },
  ],
};

/** A summer rain cloud (비): a grey cloud with falling drops. */
const RAIN: ItemDef = {
  id: 'prop:hh-summer-rain',
  kind: 'nature',
  box: { w: 80, h: 100 },
  z: 'mid',
  alt: 'A grey cloud with raindrops falling from it',
  accuracyNote: 'A plain rain cloud with teardrop raindrops, the common sign for rain; summer is when most of the year’s rain falls.',
  nodes: [
    { t: 'path', d: 'M16 46C4 46 4 26 18 26C18 10 38 6 44 18C50 6 70 10 68 26C80 26 80 46 66 46Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M22 34C30 30 40 30 46 34', fill: 'none', stroke: 'surface.paper', sw: 'base', det: true },
    { t: 'path', d: 'M20 56C16 64 16 70 20 70C24 70 24 64 20 56Z', fill: 'theme.crafts', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M40 60C36 68 36 74 40 74C44 74 44 68 40 60Z', fill: 'theme.crafts', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M60 56C56 64 56 70 60 70C64 70 64 64 60 56Z', fill: 'theme.crafts', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M28 80C24 88 24 94 28 94C32 94 32 88 28 80Z', fill: 'theme.crafts', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M52 82C48 90 48 96 52 96C56 96 56 90 52 82Z', fill: 'theme.crafts', stroke: 'text.secondary', sw: 'thin' },
  ],
};

/** A magpie (까치) on an autumn branch: black with a blue sheen, a white belly and shoulder patch, a long tail. */
const MAGPIE: ItemDef = {
  id: 'prop:hh-autumn-magpie',
  kind: 'nature',
  box: { w: 84, h: 96 },
  z: 'mid',
  alt: 'A black and white magpie sitting on a branch with autumn leaves',
  accuracyNote:
    'Drawn after the National Institute of Biological Resources description: black above with a blue sheen, a white belly and a white shoulder patch, a long tail. A resident bird, so any season is right.',
  nodes: [
    { t: 'path', d: 'M0 76C22 70 52 76 84 66', fill: 'none', stroke: 'text.secondary', sw: 'thick' },
    { t: 'ellipse', cx: 72, cy: 62, rx: 7, ry: 4, fill: 'theme.life', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 10, cy: 70, rx: 7, ry: 4, fill: 'theme.life', stroke: 'text.secondary', sw: 'thin' },
    { t: 'poly', pts: [[30, 54], [4, 40], [2, 46], [26, 62]], fill: 'text.primary', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M6 43L28 56', stroke: 'theme.crafts', sw: 'thin', det: true },
    { t: 'ellipse', cx: 44, cy: 54, rx: 18, ry: 12, fill: 'text.primary', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 48, cy: 60, rx: 11, ry: 6, fill: 'surface.paper' },
    { t: 'ellipse', cx: 38, cy: 49, rx: 8, ry: 4, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'circle', cx: 62, cy: 40, r: 9, fill: 'text.primary', stroke: 'text.secondary', sw: 'base' },
    { t: 'poly', pts: [[70, 37], [79, 40], [70, 43]], fill: 'text.secondary' },
    { t: 'circle', cx: 64, cy: 38, r: 1.5, fill: 'surface.paper', det: true },
    { t: 'path', d: 'M42 66V73 M50 66V73', stroke: 'text.secondary', sw: 'base' },
  ],
};

/** A mountain (산) in winter: evergreen slopes under a bare rock peak, the winter target. No snow lies on it, so it reads
 * as a mountain alone and the falling snow beneath, an other thing, stays a thing of its own. */
const MOUNTAIN: ItemDef = {
  id: 'prop:hh-winter-mountain',
  kind: 'nature',
  box: { w: 84, h: 86 },
  z: 'mid',
  alt: 'A green mountain with a grey rocky peak',
  accuracyNote: 'A generic mountain with evergreen slopes, two fir marks that keep it a mountain at thumb size, and a bare grey rock peak; no snow is drawn on it and no named peak is meant.',
  nodes: [
    { t: 'poly', pts: [[2, 86], [42, 4], [82, 86]], fill: 'theme.nature', stroke: 'text.secondary', sw: 'base' },
    { t: 'poly', pts: [[42, 4], [57, 35], [49, 30], [42, 37], [35, 30], [27, 35]], fill: 'border.strong', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M24 64L30 54L36 64 M50 72L56 62L62 72', fill: 'none', stroke: 'text.secondary', sw: 'base' },
  ],
};

/** Spring flowers (꽃): three azalea-coloured flowers on stems, an other thing. */
const FLOWERS: ItemDef = {
  id: 'prop:hh-spring-flowers',
  kind: 'nature',
  box: { w: 80, h: 110 },
  z: 'mid',
  alt: 'Three bright flowers on green stems',
  accuracyNote: 'Generic five-petalled spring flowers; no species is meant.',
  nodes: [
    { t: 'path', d: 'M18 110V44 M40 110V22 M62 110V52', fill: 'none', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 30, cy: 80, rx: 10, ry: 5, fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 52, cy: 90, rx: 10, ry: 5, fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'circle', cx: 18, cy: 40, r: 12, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 40, cy: 18, r: 14, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 62, cy: 48, r: 12, fill: 'theme.letters', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 18, cy: 40, r: 4, fill: 'theme.life' },
    { t: 'circle', cx: 40, cy: 18, r: 5, fill: 'theme.life' },
    { t: 'circle', cx: 62, cy: 48, r: 4, fill: 'theme.life' },
  ],
};

/** A summer tree (나무) in full leaf, an other thing. */
const TREE: ItemDef = {
  id: 'prop:hh-summer-tree',
  kind: 'nature',
  box: { w: 84, h: 140 },
  z: 'mid',
  alt: 'A tall tree with a round green crown',
  accuracyNote: 'A generic broadleaf tree in full summer leaf.',
  nodes: [
    { t: 'rect', x: 36, y: 80, w: 12, h: 60, fill: 'text.secondary' },
    { t: 'circle', cx: 42, cy: 44, r: 40, fill: 'theme.nature', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M24 36C30 30 36 30 40 34 M46 58C52 52 58 52 62 56', fill: 'none', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

/** A moon bear (반달가슴곰) sitting calmly in autumn, with acorns: black with a white half-moon on its chest. */
const MOON_BEAR: ItemDef = {
  id: 'prop:hh-moon-bear',
  kind: 'nature',
  box: { w: 84, h: 100 },
  z: 'mid',
  alt: 'A black bear with a white half-moon mark on its chest, sitting beside acorns',
  accuracyNote:
    'Drawn after the National Institute of Biological Resources description: black fur and a white half-moon mark on the chest, low on the front of the body. It sits calmly, mouth closed and claws hidden; two acorns lie beside it in autumn, the season its source says it feeds most.',
  nodes: [
    { t: 'ellipse', cx: 42, cy: 68, rx: 28, ry: 30, fill: 'text.primary', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 27, cy: 12, r: 7, fill: 'text.primary', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 57, cy: 12, r: 7, fill: 'text.primary', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 42, cy: 26, r: 18, fill: 'text.primary', stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 42, cy: 33, rx: 8, ry: 6, fill: 'text.secondary' },
    { t: 'ellipse', cx: 42, cy: 30, rx: 3, ry: 2, fill: 'text.primary' },
    { t: 'circle', cx: 34, cy: 22, r: 1.5, fill: 'surface.paper', det: true },
    { t: 'circle', cx: 50, cy: 22, r: 1.5, fill: 'surface.paper', det: true },
    { t: 'path', d: 'M28 58C34 69 50 69 56 58C50 64 34 64 28 58Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 28, cy: 96, rx: 10, ry: 4, fill: 'text.primary' },
    { t: 'ellipse', cx: 56, cy: 96, rx: 10, ry: 4, fill: 'text.primary' },
    { t: 'ellipse', cx: 6, cy: 94, rx: 5, ry: 6, fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 6, cy: 88, rx: 5.5, ry: 2.5, fill: 'text.secondary' },
    { t: 'ellipse', cx: 78, cy: 94, rx: 5, ry: 6, fill: 'theme.letters', stroke: 'text.secondary', sw: 'thin' },
    { t: 'ellipse', cx: 78, cy: 88, rx: 5.5, ry: 2.5, fill: 'text.secondary' },
  ],
};

/** Winter snow (눈): large snowflakes falling over the white winter ground, an other thing. */
const SNOW: ItemDef = {
  id: 'prop:hh-winter-snow',
  kind: 'nature',
  box: { w: 84, h: 96 },
  z: 'mid',
  alt: 'Large white snowflakes falling',
  accuracyNote: 'Snowflakes drawn large and round with a six-armed star, so they read at thumb size.',
  nodes: [
    { t: 'circle', cx: 16, cy: 14, r: 10, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 58, cy: 12, r: 10, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 36, cy: 46, r: 11, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 72, cy: 52, r: 9, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 14, cy: 80, r: 9, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 54, cy: 84, r: 10, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M16 7V21 M10 10.5L22 17.5 M10 17.5L22 10.5', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M36 38V54 M29 42L43 50 M29 50L43 42', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M54 77V91 M48 80.5L60 87.5 M48 87.5L60 80.5', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M58 5V19 M52 8.5L64 15.5 M52 15.5L64 8.5', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M72 46V58 M67 49L77 55 M67 55L77 49', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M14 74V86 M9 77L19 83 M9 83L19 77', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });

export const FOUR_SEASONS_SCENE: HiddenHeritageScene = {
  id: 'scene:four-seasons',
  art: {
    setting: SETTING.id,
    altEn: 'Four panels side by side, one for each season of the year.',
    layers: [
      { ref: WIND.id, x: 50, y: 118 },
      { ref: RAIN.id, x: 150, y: 118 },
      { ref: MAGPIE.id, x: 250, y: 118 },
      { ref: MOUNTAIN.id, x: 350, y: 118 },
      { ref: FLOWERS.id, x: 50, y: 286 },
      { ref: TREE.id, x: 150, y: 286 },
      { ref: MOON_BEAR.id, x: 250, y: 286 },
      { ref: SNOW.id, x: 350, y: 236 },
    ],
  },
  items: [SETTING, WIND, RAIN, MAGPIE, MOUNTAIN, FLOWERS, TREE, MOON_BEAR, SNOW],
  things: { baram: 0, bi: 1, kkachi: 2, san: 3, kkot: 4, namu: 5, bandalgaseumgom: 6, nun: 7 },
  round: {
    id: 'hh1',
    sceneId: 'scene:four-seasons',
    altEn: 'Four panels side by side, one for each season of the year.',
    // Stage 2 Nature words with a bundled picture each, for the Pic-Word Match fallback: one target in each season. 눈 is
    // an other thing, never asked: it is a homograph (눈 'eye', taught by Body, and 눈 'snow'), and a prompt heard and
    // read with no gloss would not say which one is meant (§4.2), so the winter target is 산.
    targets: [
      { id: 'baram', word: word('바람', 'baram', 'wind'), spot: { x: 7, y: 12, w: 86, h: 110 }, picture: 'word:science-wind' },
      { id: 'bi', word: word('비', 'bi', 'rain'), spot: { x: 107, y: 12, w: 86, h: 110 }, picture: 'word:nature-rain' },
      { id: 'kkachi', word: word('까치', 'kkachi', 'magpie'), spot: { x: 207, y: 12, w: 86, h: 110 }, picture: 'card:magpie' },
      { id: 'san', word: word('산', 'san', 'mountain'), spot: { x: 307, y: 12, w: 86, h: 110 }, picture: 'card:mountain' },
    ],
    others: [
      { id: 'kkot', word: word('꽃', 'kkot', 'flower'), spot: { x: 7, y: 136, w: 86, h: 154 } },
      { id: 'namu', word: word('나무', 'namu', 'tree'), spot: { x: 107, y: 136, w: 86, h: 154 } },
      { id: 'bandalgaseumgom', word: word('반달가슴곰', 'bandalgaseumgom', 'moon bear'), spot: { x: 207, y: 136, w: 86, h: 154 } },
      { id: 'nun', word: word('눈', 'nun', 'snow'), spot: { x: 307, y: 136, w: 86, h: 154 } },
    ],
  },
  note: {
    subjectEn: 'The four seasons and their weather, with two native animals: the magpie, a favourite of folk painting, and the moon bear.',
    facts: [
      {
        id: 'f1',
        claimEn: 'Korea lies in the mid-latitude temperate zone, so its four seasons, spring, summer, autumn and winter, are clearly marked.',
        sources: [
          {
            institution: 'Korea Meteorological Administration',
            title: '기상청 날씨누리 「한국 기후특성」 (Climate of Korea)',
            url: 'https://www.weather.go.kr/w/climate/statistics/korea.do',
            accessed: '2026-10-23',
            quote: '우리나라는 지리적으로 중위도 온대성 기후대에 위치하여 봄, 여름, 가을, 겨울의 사계절이 뚜렷하게 나타난다.',
          },
        ],
      },
      {
        id: 'f2',
        claimEn: "More than half of the year's rain falls in summer, and the wind blows fairly strongly in spring, in March and April.",
        sources: [
          {
            institution: 'Korea Meteorological Administration',
            title: '기상청 날씨누리 「한국 기후특성」 (Climate of Korea)',
            url: 'https://www.weather.go.kr/w/climate/statistics/korea.do',
            accessed: '2026-10-27',
            quote:
              '전국의 연강수량은 1306.3mm이며, … 제주도(4개 지점)의 연강수량은 1182.9 ~ 2030.0mm로 나타나며, 계절별로는 여름철 강수량이 710.9mm로 연 강수량의 54%를 차지한다. … 봄인 3~4월에 풍속이 비교적 높게 나타나고',
          },
        ],
      },
      {
        id: 'f3',
        claimEn: 'The magpie is one of the best-known birds that live in Korea all year round. It is black above with a blue sheen, and its belly is white.',
        sources: [
          {
            institution: 'National Institute of Biological Resources',
            title: '한반도의 생물다양성 「까치」 (Biodiversity of the Korean Peninsula: magpie)',
            url: 'https://species.nibr.go.kr/species/speciesDetail.do?ktsn=120000532854',
            accessed: '2026-10-23',
            quote: '윗면은 푸른 광택이 있는 검은색이고 배는 흰색이다. … 도시와 농촌 등 평지에 살며 우리나라 대표적인 텃새이다.',
          },
        ],
      },
      {
        id: 'f4',
        claimEn: 'The moon bear has a white half-moon mark on its chest. It eats a lot in autumn, then sleeps through the winter in a den or a hollow tree.',
        sources: [
          {
            institution: 'National Institute of Biological Resources',
            title: '한반도의 생물다양성 「반달가슴곰」 (Biodiversity of the Korean Peninsula: moon bear)',
            url: 'https://species.nibr.go.kr/species/speciesDetail.do?ktsn=120000212858',
            accessed: '2026-10-23',
            quote: '앞가슴에 반달 모양의 흰색 무늬가 있다. … 가을에 먹이를 많이 먹어 지방이 축적되면 겨울에 굴속 또는 나무 구멍을 찾아 동면에 들어간다.',
          },
        ],
      },
      {
        id: 'f5',
        claimEn: 'Moon bears once lived all over the Korean Peninsula and are now endangered. In 2004 a project to bring them back began in Jirisan National Park.',
        sources: [
          {
            institution: 'Korea National Park Service',
            title: '국립공원공단 「반달가슴곰」 (생태계복원, Ecosystem restoration)',
            url: 'https://www.knps.or.kr/portal/main/contents.do?menuNo=7020048',
            accessed: '2026-10-23',
            quote: '한반도 전역에 서식하던 반달가슴곰은 서식지 파괴, 보신문화, 밀렵 등으로 멸종위기에 처해 있으며 2004년 지리산국립공원에서 복원사업이 시작되었습니다.',
          },
        ],
      },
      {
        id: 'f6',
        claimEn:
          'Kkachihorangi, pictures of a magpie and a tiger, grew from Chinese tiger paintings of the Yuan and Ming dynasties. They became hugely popular in 19th-century folk painting (minhwa), and over time the tiger turned into a friendlier character.',
        sources: [
          {
            institution: 'National Folk Museum of Korea',
            title: '한국민속대백과사전 한국민속상징사전 「까치호랑이」 (Encyclopedia of Korean Folk Culture)',
            url: 'https://folkency.nfm.go.kr/kr/topic/detail/10300',
            accessed: '2026-10-23',
            quote:
              '가장 한국적인 그림으로 알려진 까치호랑이는 그 도상이 원나라 및 명나라 호랑이 그림에서 시작되었다. … 그 덕분에 호랑이는 우리와 더욱더 친근한 캐릭터로 바뀌게 되었다. … 17세기 단순한 배경이었던 까치가 등장하는 호랑이 그림이 19세기 민화에 와서는 ‘까치호랑이’라고 따로 구분할 수 있을 정도로 대거 유행하게 되었다.',
          },
        ],
      },
    ],
    accuracyNote:
      'Composed from the kit, not from a painting: four plain panels, one season each, with no figure, viewpoint or composition of any screen or folk painting. The magpie and the moon bear follow the National Institute of Biological Resources descriptions; the bear sits calmly in autumn, before its winter sleep. No tiger, person, Hoya, sign or writing is drawn.',
  },
  review: {
    reviewedBy: 'MAR',
    reviewedAt: '2026-10-29',
    passes: 7,
    notes: [
      'Pass 1 (author sourcing): the five pages were opened on 2026-10-23 and every quote copied from them. The two National Institute of Biological Resources species pages of 한반도의 생물다양성 (까치 Pica serica, ktsn 120000532854; 반달가슴곰 Ursus thibetanus ussuricus, ktsn 120000212858) and the Encyclopedia of Korean Folk Culture entry draw their text by script, so it was read from the text each page loads. Every institution is on the §6.6 allowlist under its name on that date. The minhwa quote keeps the entry order (history, content, features), and its first draft, which cut a sentence in half, was replaced by whole sentences.',
      'Pass 2 (culture and facts): each claim says no more than its quote. The spring wind is "fairly strong" (비교적 높게), not the strongest; the bear "is" endangered (처해 있으며). Kkachihorangi is credited to Yuan and Ming tiger paintings, as the entry says, so shared East Asian heritage is not framed as Korean in origin, and only "a friendlier character" is claimed of the tiger. The tiger is a fact about old pictures and is never drawn. The bear sits calm (mouth closed, no claws) in autumn, when its source says it feeds, with acorns beside it. The magpie is a resident bird, right in any season. No figure or composition of a painting is used.',
      'Pass 3 (language, learning design and the 7.7 list): the targets are taught words with bundled pictures, one in each season: 바람, 비 and 눈 of quest:stage2-nature-q2 and 까치 of quest:stage2-letters-q2 (the Stage 1 Nature card word), each in Korean with rr.ts romanization and never as an English label, with the es and ko meanings the shipped Stage 2 overlays give them (a test compares them). The mountain was described as "with snow on its top", which named a target; it is now "a white top" (superseded by pass 4: the peak is bare grey rock). The alt text names the setting, never a thing; no other meaning holds a target word; no percentage, timer, age word, speaking UI or emoji in any string.',
      'Pass 4 (reviser): two independent reviews of the PR were adjudicated. The winter mountain wore a white snowcap right above the 눈 spot, so a learner who found snow on it would have been marked as missing; the peak is now bare grey rock (border.strong) and the falling snow is the only snow drawn (a test holds it). The f2 rain quote is now given whole from 전국의 연강수량: on the page the seasonal clause follows the Jeju clause in one sentence, but 710.9 mm is 54% of the 1,306.3 mm national mean the paragraph opens with (710.9 / 1,306.3 = 0.544), while the Jeju clause gives only a range of station totals, so the claim reads it as the national summer share; the page was opened again on 2026-10-27 and the words match. The ko alt said 칸 three times and now reads 네 계절을 한 칸에 하나씩 나란히 그린 그림. The season words 봄 여름 가을 겨울 and 반달가슴곰 stay untaught, so they are not targets here; the Nature Volume 2 S2 content row (CM-41) teaches them and makes 반달가슴곰 a target when it copies the round.',
      'Pass 5 (third pass): the revised scene was checked again against the profile, §5.1, §7.7 and the taught-items rule. Every other thing in a target column (산 over 눈, 꽃 under 바람, 나무 under 비, 반달가슴곰 under 까치) shows nothing of its target; the bear is drawn from ellipses and one chest mark only, mouth closed with no claws or pointed shapes; the es and ko meanings are unchanged except the ko alt; no claim says more than its quote, and the record names no review but this multi-agent one.',
      'Pass 6 (reviser, 2026-10-29): two more independent reviews were adjudicated. 눈 is a homograph (content/vocab/_senses.json group nun: 눈 eye of the Body topic, 눈 snow of Nature, both at launch; 비 broom is reserved, so 비 has no taught homophone), and the prompt is heard and read with no gloss, so §4.2 keeps it from being asked; it is now an other thing and 산 (taught by quest:stage1-nature-q2, the Stage 1 Nature card word, and played again on the Stage 2 Nature boards, picture card:mountain, the shipped es and ko meanings) is the winter target, so the targets are still one per season and no other meaning holds a target word. The acorns were called "a favourite food" with no quoted words behind it; the claim is gone and the bear note says only what the f4 quote says (it feeds in autumn). The f2 access date is the day its quote was re-taken (2026-10-27). The winter ground band is white paper, snowy ground: with the falling snow it is the only snow drawn, and it lies almost wholly inside the 눈 spot. The alt text, the eight meanings, the subject and the six card-back facts moved to content/i18n/{es,ko}/hidden-heritage.json under scene:four-seasons, with es and ko for the subject and f1 to f6 written here, so check-i18n, validate-content and overlays.test.ts read them. Drawing: the autumn leaves are gold (theme.life) apart from the orange spring petals, the acorns are filled with a dark cap, and the chest mark is narrower and lower on the body.',
      'Pass 7 (third pass, 2026-10-29): the revised round and the new es and ko were checked against §4.2, §5.1, §7.7 and the taught-items rule. Each es and ko fact claims no more than its English and its quote (the f2 summer share is "más de la mitad" and 절반 이상, the f5 project is a 복원 사업 to bring the bears back, f6 credits the Yuan and Ming tiger paintings); 반달가슴곰 and kkachihorangi are given as the facts give them; no string carries a percentage, timer, age word, speaking UI or emoji, and the record names no review but this multi-agent one.',
    ],
  },
};
