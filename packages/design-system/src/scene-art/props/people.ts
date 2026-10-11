/**
 * People props (F-STORY-002 §3.9.4, PR 2.3b). Every figure is faceless by
 * design (§3.9.5): a blank `surface.paper` oval outlined with `border.strong`,
 * with hair, hat and clothing carrying who they are. No skin token is used, so
 * no historical figure has an invented likeness and no ethnicity is encoded.
 * Figures stand on their anchor (bottom-centre) facing the viewer.
 */
import type { ItemDef, Shape } from '../types';

const ACCESSED = '2026-10-11';
const PUBLISHER = '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)';

const CLOTHING_REF = { title: '민족의 정신이 깃든, 한국의 의복', publisher: '한국문화원연합회 (지역N문화, ncms.nculture.org)', url: 'https://ncms.nculture.org/traditional-clothes', accessed: ACCESSED } as const;

/** The blank face: no eyes, no mouth. */
const face = (cx: number, cy: number, rx: number, ry: number): Shape => ({ t: 'ellipse', cx, cy, rx, ry, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' });

export const FIG_KING: ItemDef = {
  id: 'prop:fig-king',
  kind: 'figure',
  box: { w: 80, h: 130 },
  z: 'mid',
  alt: "Joseon king in a crimson everyday robe with dragon patches and the king's winged cap",
  sourceRef: { title: '곤룡포 부 용문보 (袞龍袍 付 龍紋補)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0004151', accessed: ACCESSED },
  accuracyNote:
    'Simplified from the Joseon king\'s everyday robe (gonryongpo, crimson; yellow came only with the Korean Empire in 1897) with round dragon patches on chest and shoulders and the ikseongwan cap. The face is blank on purpose: no likeness of any king is invented. Dragon detail, the jade belt, the black boots and the cap decoration are reduced to plain shapes, and the fourth patch (on the back) is out of view; nothing beyond the patches is drawn.',
  nodes: [
    { t: 'rect', x: 36, y: 38, w: 8, h: 10, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    // robe and wide sleeves as one shape
    { t: 'path', d: 'M30 46 L50 46 L56 54 L74 100 L62 104 L58 80 L66 122 L14 122 L22 80 L18 104 L6 100 L24 54 Z', fill: 'brand.primary', stroke: 'text.primary', sw: 'thin' },
    face(40, 28, 11, 13),
    // ikseongwan: a dome cap with the two upright "wings" behind
    { t: 'ellipse', cx: 35, cy: 6, rx: 2.5, ry: 6, fill: 'text.primary' },
    { t: 'ellipse', cx: 45, cy: 6, rx: 2.5, ry: 6, fill: 'text.primary' },
    { t: 'path', d: 'M27 22 Q27 8 40 8 Q53 8 53 22 Q40 17 27 22 Z', fill: 'text.primary' },
    { t: 'path', d: 'M32 46 Q40 54 48 46', stroke: 'text.primary', sw: 'thin', det: true },
    // dragon patches: chest and both shoulders
    { t: 'circle', cx: 40, cy: 68, r: 7, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    { t: 'circle', cx: 28, cy: 60, r: 4, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    { t: 'circle', cx: 52, cy: 60, r: 4, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    { t: 'circle', cx: 40, cy: 68, r: 3, stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'rect', x: 24, y: 84, w: 32, h: 4, fill: 'text.primary' },
    { t: 'rect', x: 22, y: 122, w: 16, h: 8, r: 2, fill: 'text.primary' },
    { t: 'rect', x: 42, y: 122, w: 16, h: 8, r: 2, fill: 'text.primary' },
  ],
};

export const FIG_OFFICIAL: ItemDef = {
  id: 'prop:fig-official',
  kind: 'figure',
  box: { w: 80, h: 130 },
  z: 'mid',
  tintable: 'text.primary',
  alt: 'Joseon official in a black round-collared robe and the black winged gauze cap',
  sourceRef: { title: '흑단령 (黑團領)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0079876', accessed: ACCESSED },
  accuracyNote:
    "Simplified from the heukdallyeong, the official's round-collared robe in deep blue-black (acheong) used as court dress from King Sejong's reign on, worn with the samo gauze cap and a rank belt. The entry says later Joseon turned it yellowish green, so the robe is tintable. The chest rank badge is left out on purpose: which officials wore one changed with period and rank, and no rank is invented. The face is blank on purpose.",
  nodes: [
    { t: 'rect', x: 36, y: 40, w: 8, h: 10, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M30 48 L50 48 L58 56 L70 102 L60 106 L58 84 L64 122 L16 122 L22 84 L20 106 L10 102 L22 56 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    face(40, 30, 11, 13),
    // samo: a rounded cap with a flat wing out to each side
    { t: 'ellipse', cx: 24, cy: 12, rx: 8, ry: 2.5, fill: 'text.primary' },
    { t: 'ellipse', cx: 56, cy: 12, rx: 8, ry: 2.5, fill: 'text.primary' },
    { t: 'path', d: 'M28 24 Q28 4 40 4 Q52 4 52 24 Q40 19 28 24 Z', fill: 'text.primary' },
    { t: 'path', d: 'M32 48 Q40 56 48 48', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'rect', x: 22, y: 86, w: 36, h: 4, fill: 'text.secondary' },
    { t: 'rect', x: 22, y: 122, w: 16, h: 8, r: 2, fill: 'text.primary' },
    { t: 'rect', x: 42, y: 122, w: 16, h: 8, r: 2, fill: 'text.primary' },
  ],
};

export const FIG_SCHOLAR: ItemDef = {
  id: 'prop:fig-scholar',
  kind: 'figure',
  box: { w: 80, h: 130 },
  z: 'mid',
  tintable: 'brand.secondaryLight',
  alt: 'Joseon scholar in a long pale coat and a black wide-brimmed gat hat',
  sourceRef: { title: '갓', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0000945', accessed: ACCESSED },
  accuracyNote:
    "Simplified from the black gat worn by adult men in Joseon, scholar-officials and commoners alike: a crown slightly narrower at the top than at the bottom over a wide brim that curves slightly down, as the entry describes, with a long outer coat tied at the chest. The coat colour is tintable. Hat strings and the coat's seams are reduced to a few lines. The face is blank on purpose.",
  nodes: [
    { t: 'rect', x: 36, y: 40, w: 8, h: 8, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M30 46 L50 46 L58 54 L64 104 L58 106 L58 80 L62 122 L18 122 L22 80 L22 106 L16 104 L22 54 Z', fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'base' },
    face(40, 30, 11, 13),
    // gat: a tall crown, slightly narrower at the top, over a wide brim that curves down at the ends
    { t: 'path', d: 'M30 19 L50 19 L48 6 Q48 4 46 4 L34 4 Q32 4 32 6 Z', fill: 'text.primary' },
    { t: 'path', d: 'M12 20 Q40 12 68 20 Q40 24 12 20 Z', fill: 'text.primary' },
    { t: 'path', d: 'M32 22 Q29 36 40 45 M48 22 Q51 36 40 45', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'path', d: 'M34 52 L46 58 M46 52 L34 58', stroke: 'text.primary', sw: 'base', det: true },
    { t: 'path', d: 'M36 56 Q34 68 36 76 M44 56 Q46 68 44 76', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'rect', x: 22, y: 122, w: 16, h: 8, r: 2, fill: 'text.primary' },
    { t: 'rect', x: 42, y: 122, w: 16, h: 8, r: 2, fill: 'text.primary' },
  ],
};

export const FIG_HISTORIAN: ItemDef = {
  id: 'prop:fig-historian',
  kind: 'figure',
  box: { w: 100, h: 90 },
  z: 'mid',
  tintable: 'text.primary',
  alt: 'Joseon royal historian in official dress and a black winged cap, seated and writing with a brush on paper',
  sourceRef: { title: "조선시대의 기록 수호자 '사관'이란? (어린이 조선왕조실록)", publisher: '국가기록원 (National Archives of Korea)', url: 'https://theme.archives.go.kr/next/silloc/archiveGuard.do?submenu=2', accessed: ACCESSED },
  accuracyNote:
    "Simplified: a royal historian (sagwan) seated cross-legged in an official's dark robe and samo cap, writing with a brush held upright over a sheet of paper on the lap. The source describes the role (following the king and writing down what was said and done, every day), not a dress code or a posture, so the dress follows the official figure and the seated pose is a storytelling choice. The writing is plain strokes, never letters. The face is blank on purpose.",
  nodes: [
    { t: 'rect', x: 46, y: 28, w: 8, h: 9, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    // folded legs and robe spread on the floor
    { t: 'path', d: 'M8 88 Q8 64 30 58 L70 58 Q92 64 92 88 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    // upper body
    { t: 'path', d: 'M34 60 L28 36 Q50 30 72 36 L66 60 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'rect', x: 35, y: 56, w: 30, h: 3, fill: 'text.secondary' },
    face(50, 20, 10, 12),
    // samo: a rounded cap with a flat wing out to each side
    { t: 'ellipse', cx: 36, cy: 8, rx: 7, ry: 2.5, fill: 'text.primary' },
    { t: 'ellipse', cx: 64, cy: 8, rx: 7, ry: 2.5, fill: 'text.primary' },
    { t: 'path', d: 'M40 18 Q40 1 50 1 Q60 1 60 18 Q50 13 40 18 Z', fill: 'text.primary' },
    // a sheet of paper on the lap, with rows of plain strokes (no letters)
    { t: 'poly', pts: [[28, 80], [72, 80], [67, 66], [33, 66]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M40 69 V76 M46 69 V74 M52 69 V77', stroke: 'text.secondary', sw: 'thin', det: true },
    // the left sleeve rests by the paper; the right hand holds the brush upright over it
    { t: 'path', d: 'M32 38 Q18 52 26 66 L40 66 Q36 52 38 44 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M68 38 Q82 52 74 64 L60 64 Q64 52 62 44 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'line', x1: 62, y1: 50, x2: 62, y2: 70, stroke: 'text.secondary', sw: 'base' },
    { t: 'circle', cx: 62, cy: 62, r: 3.5, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
  ],
};

export const FIG_VILLAGER: ItemDef = {
  id: 'prop:fig-villager',
  kind: 'figure',
  box: { w: 70, h: 120 },
  z: 'mid',
  tintable: 'surface.sunken',
  alt: 'Joseon villager in a plain short jacket and loose trousers, hair in a topknot',
  sourceRef: CLOTHING_REF,
  accuracyNote:
    "Simplified from the basic Joseon outfit for men named in the source, a short jacket (jeogori) and trousers (baji), in plain undyed cloth with the hair in a topknot and no hat. The source gives the outfit, not the topknot, which is drawn from general knowledge and kept plain. Garment colour is tintable. No ornament or rank sign is drawn. The face is blank on purpose.",
  nodes: [
    { t: 'rect', x: 31.5, y: 33, w: 7, h: 9, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    // loose trousers, legs apart
    { t: 'path', d: 'M20 66 L50 66 L56 116 L38 116 L35 84 L32 116 L14 116 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    // jacket with wide sleeves
    { t: 'path', d: 'M26 40 L44 40 L52 48 L62 80 L52 84 L50 62 L50 74 L20 74 L20 62 L18 84 L8 80 L18 48 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    face(35, 24, 10, 12),
    { t: 'circle', cx: 35, cy: 8, r: 5, fill: 'text.primary' },
    { t: 'path', d: 'M25 20 Q35 4 45 20 Q35 12 25 20 Z', fill: 'text.primary' },
    { t: 'path', d: 'M28 42 L35 56 L42 42', stroke: 'border.strong', sw: 'base', det: true },
    { t: 'rect', x: 20, y: 70, w: 30, h: 4, fill: 'text.secondary' },
    { t: 'rect', x: 14, y: 116, w: 18, h: 4, r: 2, fill: 'text.primary' },
    { t: 'rect', x: 38, y: 116, w: 18, h: 4, r: 2, fill: 'text.primary' },
  ],
};

export const FIG_GRANDMOTHER: ItemDef = {
  id: 'prop:fig-grandmother',
  kind: 'figure',
  box: { w: 80, h: 120 },
  z: 'mid',
  tintable: 'surface.paper',
  alt: 'Elderly Joseon woman in a short jacket and a full skirt, grey hair in a low bun with a long hairpin',
  sourceRef: { title: '치마', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0058353', accessed: ACCESSED },
  accuracyNote:
    "Simplified from a woman's everyday hanbok: a short jacket (jeogori) over a full wrap skirt (chima). The source says long skirts were worn by the yangban and short skirts by commoners, so this skirt stops above the ankle, as a village woman's would; the fullness of layered petticoats is reduced to a flared shape. Grey hair parted and pulled back into a chignon at the nape, held by a binyeo hairpin whose ends show either side of the head (the married woman's hairstyle of the period, drawn from general knowledge, not the source), is the age cue; the jacket ribbon (goreum) is plain. Jacket colour is tintable. The face is blank on purpose.",
  nodes: [
    { t: 'rect', x: 36, y: 31, w: 8, h: 9, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    // full skirt
    { t: 'path', d: 'M26 62 L54 62 L70 108 L10 108 Z', fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'thin' },
    { t: 'rect', x: 22, y: 108, w: 14, h: 8, r: 3, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'rect', x: 44, y: 108, w: 14, h: 8, r: 3, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    // short jacket with sleeves
    { t: 'path', d: 'M28 38 L52 38 L60 46 L66 78 L56 80 L52 62 L28 62 L24 80 L14 78 L20 46 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    // a chignon low at the nape held by a long binyeo pin, its ends showing either side
    { t: 'line', x1: 24, y1: 31, x2: 56, y2: 31, stroke: 'text.secondary', sw: 'base' },
    { t: 'ellipse', cx: 40, cy: 31, rx: 12, ry: 5, fill: 'border.strong' },
    face(40, 22, 10, 12),
    // grey hair parted in the middle and pulled back
    { t: 'path', d: 'M29 20 Q30 6 40 6 Q50 6 51 20 Q40 12 29 20 Z', fill: 'border.strong' },
    { t: 'line', x1: 40, y1: 6.5, x2: 40, y2: 12, stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M32 40 L40 52 L48 40', stroke: 'border.strong', sw: 'base', det: true },
    // the jacket's ribbon tie (goreum)
    { t: 'path', d: 'M42 50 L38 66 M42 50 L46 64', stroke: 'text.secondary', sw: 'base' },
  ],
};

export const FIG_CHILD: ItemDef = {
  id: 'prop:fig-child',
  kind: 'figure',
  box: { w: 56, h: 84 },
  z: 'mid',
  tintable: 'feedback.nudge',
  alt: "Child in a short jacket and white trousers, a hanbok in a bright colour",
  sourceRef: CLOTHING_REF,
  accuracyNote:
    "Simplified child in a short jacket (jeogori) and trousers (baji) with a ribbon tie (goreum), the basic outfit the source names. Its colour is tintable. Boy or girl is not shown, and the source does not describe children's dress, so no child-specific detail (stripes, hat) is claimed. The face is blank on purpose.",
  nodes: [
    { t: 'path', d: 'M16 46 L40 46 L44 80 L30 80 L28 58 L26 80 L12 80 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M19 24 L37 24 L44 30 L50 52 L42 54 L40 44 L16 44 L14 54 L6 52 L12 30 Z', fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    face(28, 14, 9, 10),
    { t: 'path', d: 'M19 12 Q20 1 28 1 Q36 1 37 12 Q28 7 19 12 Z', fill: 'text.primary' },
    { t: 'path', d: 'M24 26 L28 34 L32 26', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'rect', x: 14, y: 80, w: 14, h: 4, r: 2, fill: 'text.primary' },
    { t: 'rect', x: 30, y: 80, w: 14, h: 4, r: 2, fill: 'text.primary' },
    { t: 'path', d: 'M28 34 L24 42 M28 34 L33 42', stroke: 'text.secondary', sw: 'base' },
  ],
};
