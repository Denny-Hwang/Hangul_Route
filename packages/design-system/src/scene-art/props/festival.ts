/**
 * Ceremony and festival props (F-STORY-002 §3.9.4, PR 2.10a): the 1795 royal
 * procession and feast, and the goods a uigwe lists.
 */
import type { ItemDef, Shape } from '../types';
import { horseShapes } from './nature';

const ACCESSED = '2026-10-11';
const ENCYKOREA = '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)';

/** One faceless marcher: a head (blank face) and a robe, `x` the centre. */
const marchers = (xs: readonly number[]): { heads: [string, string]; robes: string } => ({
  heads: [xs.slice(0, 3), xs.slice(3)].map((half) => half.map((x) => `M${x - 4} 12 A4 4 0 1 0 ${x + 4} 12 A4 4 0 1 0 ${x - 4} 12 Z`).join(' ')) as [string, string],
  robes: xs.map((x) => `M${x - 5} 18 H${x + 5} L${x + 6} 34 H${x - 6} Z`).join(' '),
});

export const PALANQUIN: ItemDef = {
  id: 'prop:palanquin',
  kind: 'object',
  box: { w: 210, h: 80 },
  z: 'mid',
  alt: 'A royal palanquin with a red body and dark roof, its long poles carried between two horses, one in front and one behind',
  tags: { heritage: true },
  sourceRef: { title: '가교(駕轎)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0000056', accessed: ACCESSED },
  accuracyNote:
    "Simplified from the gagyo, the long-distance royal palanquin the entry describes: a roofed carriage on two long poles hung from the harness of one horse in front and one behind, the king's version red with gold fittings and a dark blue-black roof (drawn near black) with dragon-head ends; one was made under King Jeongjo for Lady Hyegyeong's 1795 journey to Hwaseong. The eight attendants in yellow who steadied the poles, the dragon heads and the lotus finial are left out; gold shows as a few yellow bands.",
  nodes: [
    { t: 'ellipse', cx: 105, cy: 78, rx: 100, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'group', s: 0.62, ty: 30, flip: true, tx: 68, kids: horseShapes(true).filter((sh) => !sh.det) },
    { t: 'group', s: 0.62, ty: 30, tx: 142, kids: horseShapes(true).filter((sh) => !sh.det) },
    { t: 'path', d: 'M30 46 H180', stroke: 'text.secondary', sw: 'thick' },
    { t: 'rect', x: 84, y: 22, w: 42, h: 34, r: 2, fill: 'brand.primary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M84 30 H126 M84 50 H126', stroke: 'feedback.nudge', sw: 'base' },
    { t: 'rect', x: 96, y: 32, w: 18, h: 14, fill: 'feedback.nudge', o: 0.6 },
    { t: 'path', d: 'M80 22 Q90 8 105 6 Q120 8 130 22 Z', fill: 'text.primary' },
  ],
};

export const PROCESSION_ROW: ItemDef = {
  id: 'prop:procession-row',
  kind: 'figure',
  box: { w: 150, h: 42 },
  z: 'mid',
  alt: 'A line of marchers in yellow robes and black hats carrying tall red flags',
  accuracyNote:
    "A short file of marchers in a procession, the way a royal procession appears in the banchado: yellow robes (the colour the gagyo entry gives the palanquin attendants), black hats and tall flags. The real procession had thousands of people in a fixed order with ranks and banners that are not copied here; the flags are plain. Faces are blank on purpose.",
  nodes: (() => {
    const m = marchers([12, 38, 64, 90, 116, 140]);
    const shapes: Shape[] = [
      { t: 'ellipse', cx: 76, cy: 40, rx: 74, ry: 2, fill: 'text.primary', o: 0.08, det: true },
      { t: 'path', d: 'M26 34 V2 M104 34 V2', stroke: 'text.primary', sw: 'base' },
      { t: 'path', d: 'M26 2 L42 6 L26 12 Z M104 2 L120 6 L104 12 Z', fill: 'brand.primary' },
      { t: 'path', d: m.robes, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
      { t: 'path', d: m.heads[0], fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
      { t: 'path', d: m.heads[1], fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
      { t: 'path', d: 'M7 8 H17 M33 8 H43 M59 8 H69 M85 8 H95 M111 8 H121 M135 8 H145', stroke: 'text.primary', sw: 'thick' },
      { t: 'path', d: 'M8 34 V40 M16 34 V40 M34 34 V40 M42 34 V40 M60 34 V40 M68 34 V40 M86 34 V40 M94 34 V40 M112 34 V40 M120 34 V40 M136 34 V40 M144 34 V40', stroke: 'text.primary', sw: 'base' },
    ];
    return shapes;
  })(),
};

export const FEAST_TABLE: ItemDef = {
  id: 'prop:feast-table',
  kind: 'furniture',
  box: { w: 96, h: 56 },
  z: 'mid',
  alt: 'A low feast table set with tall stacked dishes of food in bowls',
  sourceRef: { title: '봉수당진찬도(奉壽堂進饌圖)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Contents/Item/E0075663', accessed: ACCESSED },
  accuracyNote:
    'The entry on the 1795 feast picture describes a table of food set before the king\'s seat. Drawn here as one low table with high-piled dishes on footed bowls, the stacked style of Joseon court feasts (general knowledge, not the entry); the number of dishes, their foods and colours are generic, not taken from the uigwe menu.',
  nodes: [
    { t: 'ellipse', cx: 48, cy: 54, rx: 46, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'path', d: 'M14 24 L24 4 L34 24 Z M40 24 L48 0 L56 24 Z M62 24 L72 6 L82 24 Z', fill: 'feedback.nudge' },
    { t: 'path', d: 'M20 14 H28 M44 10 H52 M68 16 H76', stroke: 'surface.paper', sw: 'base', det: true },
    { t: 'path', d: 'M12 24 H36 L32 30 H16 Z M38 24 H58 L55 30 H41 Z M60 24 H84 L80 30 H64 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 4, y: 30, w: 88, h: 8, r: 2, fill: 'text.secondary' },
    { t: 'path', d: 'M10 38 H16 V52 H10 Z M80 38 H86 V52 H80 Z', fill: 'text.secondary' },
  ],
};

export const BEAD_CURTAIN: ItemDef = {
  id: 'prop:bead-curtain',
  kind: 'furniture',
  box: { w: 120, h: 90 },
  z: 'mid',
  alt: 'A fine hanging curtain of thin strands with a yellow tassel, hiding the seat behind it',
  sourceRef: { title: '봉수당진찬도(奉壽堂進饌圖)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Contents/Item/E0075663', accessed: ACCESSED },
  accuracyNote:
    "The entry says that in the 1795 feast picture a bead curtain hangs from the hall's front pillars, so Lady Hyegyeong's seat and those of the court ladies cannot be seen. The curtain is drawn the same way: thin vertical strands on a rod with a tassel, and no figure behind it. Strand count and the tassel colour are generic.",
  nodes: [
    { t: 'rect', x: 4, y: 6, w: 112, h: 80, fill: 'surface.sunken', o: 0.6 },
    { t: 'path', d: 'M10 8 V86 M18 8 V86 M26 8 V86 M34 8 V86 M42 8 V86 M50 8 V86 M58 8 V86 M66 8 V86 M74 8 V86 M82 8 V86 M90 8 V86 M98 8 V86 M106 8 V86 M112 8 V86', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 0, y: 2, w: 120, h: 7, r: 3, fill: 'text.secondary' },
    { t: 'path', d: 'M60 9 V30 M56 30 H64 L62 44 H58 Z', stroke: 'feedback.nudge', fill: 'feedback.nudge', sw: 'base' },
  ],
};

export const SILK_BOLTS: ItemDef = {
  id: 'prop:silk-bolts',
  kind: 'object',
  box: { w: 64, h: 38 },
  z: 'mid',
  alt: 'Folded bolts of silk stacked on top of each other',
  sourceRef: { title: '정조실록 42권, 정조 19년 윤2월 13일 을미 3번째기사', publisher: '국사편찬위원회 조선왕조실록 DB (National Institute of Korean History)', url: 'https://sillok.history.go.kr/id/kva_11902113_003', accessed: ACCESSED },
  accuracyNote:
    'The Annals record that elderly people who took part in the 1795 feast were each given one bolt (pil) of silk. Drawn as three folded bolts in pale colours; the colours and folding are generic, the record does not give them.',
  nodes: [
    { t: 'ellipse', cx: 32, cy: 36, rx: 30, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 4, y: 24, w: 56, h: 12, r: 3, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 8, y: 13, w: 50, h: 11, r: 3, fill: 'feedback.nudgeLight', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 6, y: 3, w: 52, h: 10, r: 3, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M14 24 V36 M16 13 V24 M14 3 V13', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const CEREMONY_GOODS: ItemDef = {
  id: 'prop:ceremony-goods',
  kind: 'object',
  box: { w: 130, h: 70 },
  z: 'mid',
  alt: 'Goods laid out for a royal event: folded bolts of cloth, stacked bowls, a furled flag and a paper lantern',
  sourceRef: { title: '의궤란 무엇인가 (국가유산이야기 > 의궤정보)', publisher: '국가유산청 국가유산포털 (Korea Heritage Service, National Heritage Portal)', url: 'https://www.heritage.go.kr/heri/html/HtmlPage.do?pg=/mem/uigweInfo.jsp&pageNo=3_4_1_0', accessed: ACCESSED },
  accuracyNote:
    'A uigwe lists the goods used and their cost (the portal page). Here a few such goods, as the story brief names them, are laid out for checking: cloth, bowls, a furled flag on its pole and a lantern. They are generic, not items of one recorded event.',
  nodes: [
    { t: 'ellipse', cx: 65, cy: 68, rx: 62, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 2, y: 54, w: 36, h: 12, r: 3, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 6, y: 44, w: 32, h: 10, r: 3, fill: 'feedback.nudgeLight', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M46 56 H70 L66 66 H50 Z M48 50 H68 L65 56 H51 Z M50 45 H66 L63 50 H53 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M82 66 V4', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M84 8 Q92 10 90 34 Q86 36 84 34 Z', fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M112 26 V20 M104 30 Q104 26 112 26 Q120 26 120 30 L122 50 Q122 56 112 56 Q102 56 102 50 Z', fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M102 40 H122', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};
