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

// --- PR 2.10a: records-joseon cluster -------------------------------------

export const FIG_OFFICIALS_KNEELING: ItemDef = {
  id: 'prop:fig-officials-kneeling',
  kind: 'figure',
  box: { w: 150, h: 70 },
  z: 'mid',
  tintable: 'text.primary',
  alt: 'A row of three Joseon officials kneeling, seen from behind, in dark robes and winged gauze caps',
  sourceRef: { title: '흑단령 (黑團領)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0079876', accessed: ACCESSED },
  accuracyNote:
    "Three officials kneeling in a row, seen from behind, in the dark round-collared court robe (heukdallyeong) and the samo cap with its two side wings, as in the standing official figure. Only the white inner collar shows at the neck; seen from behind there is no face to draw. Rank badges and belts are out of view, so no rank is claimed. The robe colour is tintable for the later green robes the source mentions.",
  nodes: [0, 52, 104].map(
    (tx): Shape => ({
      t: 'group',
      tx,
      kids: [
        { t: 'path', d: 'M2 68 Q2 40 22 33 Q42 40 42 68 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
        { t: 'rect', x: 17, y: 27, w: 10, h: 6, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
        { t: 'path', d: 'M14 29 Q14 9 22 9 Q30 9 30 29 Z', fill: 'text.primary' },
        { t: 'ellipse', cx: 9, cy: 15, rx: 6, ry: 2, fill: 'text.primary' },
        { t: 'ellipse', cx: 35, cy: 15, rx: 6, ry: 2, fill: 'text.primary' },
      ],
    }),
  ),
};

/** The seated pose shared by the king, the young writer and the historian: legs folded, paper on the lap. */
const seatedBase = (robe: 'brand.primary' | 'brand.secondaryLight', ink: 'text.primary' | 'text.secondary'): Shape[] => [
  { t: 'rect', x: 46, y: 28, w: 8, h: 9, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
  // folded legs, body and both sleeves as one robe shape
  { t: 'path', d: 'M8 88 Q8 64 30 58 L34 58 L28 36 Q50 30 72 36 L66 58 L70 58 Q92 64 92 88 Z M32 38 Q18 52 26 66 L40 66 Q36 52 38 44 Z M68 38 Q82 52 74 64 L60 64 Q64 52 62 44 Z', fill: robe, stroke: 'text.primary', sw: 'thin' },
  face(50, 20, 10, 12),
  { t: 'poly', pts: [[28, 80], [72, 80], [67, 66], [33, 66]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
  { t: 'path', d: 'M40 69 V76 M46 69 V74 M52 69 V77', stroke: ink, sw: 'thin', det: true },
  { t: 'line', x1: 62, y1: 50, x2: 62, y2: 70, stroke: ink, sw: 'base' },
  { t: 'circle', cx: 62, cy: 62, r: 3.5, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
];

export const FIG_KING_SEATED: ItemDef = {
  id: 'prop:fig-king-seated',
  kind: 'figure',
  box: { w: 100, h: 90 },
  z: 'mid',
  alt: "Joseon king seated on the floor in a crimson robe with dragon patches and the king's winged cap, writing on a sheet of paper",
  sourceRef: { title: '곤룡포 부 용문보 (袞龍袍 付 龍紋補)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0004151', accessed: ACCESSED },
  accuracyNote:
    "The king of the standing figure, seated: the crimson everyday robe (gonryongpo) with round dragon patches on chest and shoulders, and the ikseongwan cap with its two upright wings behind. He writes or reads on a sheet held on his lap, a storytelling pose for King Jeongjo's diary; the source describes the robe, not a posture. Dragon detail and the belt are reduced to plain shapes. The face is blank on purpose: no likeness of any king is invented.",
  nodes: [
    ...seatedBase('brand.primary', 'text.primary'),
    { t: 'ellipse', cx: 45, cy: 3.5, rx: 2.5, ry: 3.5, fill: 'text.primary' },
    { t: 'ellipse', cx: 55, cy: 3.5, rx: 2.5, ry: 3.5, fill: 'text.primary' },
    { t: 'path', d: 'M40 17 Q40 3 50 3 Q60 3 60 17 Q50 12 40 17 Z', fill: 'text.primary' },
    { t: 'circle', cx: 50, cy: 46, r: 6, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    { t: 'circle', cx: 34, cy: 40, r: 3.5, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    { t: 'circle', cx: 66, cy: 40, r: 3.5, fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 35, y: 56, w: 30, h: 3, fill: 'text.primary' },
  ],
};

export const FIG_WRITER_SEATED: ItemDef = {
  id: 'prop:fig-writer-seated',
  kind: 'figure',
  box: { w: 100, h: 90 },
  z: 'mid',
  tintable: 'brand.secondaryLight',
  alt: 'A young Joseon man in a plain pale coat, hair in a topknot, seated on the floor writing on a sheet of paper',
  sourceRef: CLOTHING_REF,
  accuracyNote:
    "A seated writer in plain everyday clothes: a pale long coat over the basic jacket and trousers the source names, hair gathered in a topknot with no hat. It stands for young Jeongjo writing his diary as the royal grandson, as the brief asks for plain clothes; what he actually wore at his studies is not shown by the sources, so no royal sign is drawn. Coat colour is tintable. The face is blank on purpose.",
  nodes: [
    ...seatedBase('brand.secondaryLight', 'text.secondary'),
    { t: 'path', d: 'M40 18 Q40 6 50 6 Q60 6 60 18 Q50 12 40 18 Z', fill: 'text.primary' },
    { t: 'circle', cx: 50, cy: 4, r: 4, fill: 'text.primary' },
    { t: 'path', d: 'M44 38 L50 46 L56 38', stroke: 'border.strong', sw: 'base', det: true },
    { t: 'rect', x: 35, y: 56, w: 30, h: 3, fill: 'text.secondary' },
  ],
};

export const FIG_ARTISAN: ItemDef = {
  id: 'prop:fig-artisan',
  kind: 'figure',
  box: { w: 80, h: 84 },
  z: 'mid',
  tintable: 'surface.sunken',
  alt: 'A Joseon craftsperson kneeling at work in a plain jacket and trousers, a cloth tied round the head',
  sourceRef: CLOTHING_REF,
  accuracyNote:
    "A kneeling craftsperson in the basic jacket (jeogori) and trousers (baji) the source names, sleeves pushed forward to work, with a plain cloth band tied round the head over a topknot (drawn from general knowledge, not the source). Garment colour is tintable so carpenter, painter and embroiderer can differ. Tools are separate props. No rank, guild sign or name is drawn. The face is blank on purpose.",
  nodes: [
    { t: 'ellipse', cx: 40, cy: 82, rx: 34, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 36, y: 30, w: 8, h: 8, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    // kneeling legs, body and the arms reaching forward as one garment shape
    { t: 'path', d: 'M10 82 Q8 62 24 58 L26 38 Q40 32 54 38 L56 50 L74 60 L70 68 L54 62 L56 58 Q72 62 70 82 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    face(40, 21, 10, 12),
    { t: 'path', d: 'M30 18 Q30 6 40 6 Q50 6 50 18 Q40 13 30 18 Z', fill: 'text.primary' },
    { t: 'circle', cx: 40, cy: 5, r: 4, fill: 'text.primary' },
    { t: 'rect', x: 30, y: 13, w: 20, h: 3, r: 1, fill: 'text.secondary' },
    { t: 'path', d: 'M33 40 L40 50 L47 40', stroke: 'border.strong', sw: 'base', det: true },
    { t: 'rect', x: 26, y: 56, w: 30, h: 3, fill: 'text.secondary' },
  ],
};

export const FIG_DANCER: ItemDef = {
  id: 'prop:fig-dancer',
  kind: 'figure',
  box: { w: 80, h: 124 },
  z: 'mid',
  alt: 'A Joseon court dancer with a flower crown, a yellow jacket, a dark blue skirt and long striped sleeves raised',
  sourceRef: { title: '무복(舞服)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0019054', accessed: ACCESSED },
  accuracyNote:
    "Simplified from the court dance (jeongjae) costume of female performers the source lists for King Sunjo's feast record: a flower crown, a yellow silk jacket over a green one, an indigo skirt and five-coloured sleeve extensions (hansam). Here the jacket is one yellow, the skirt one dark blue and the long white sleeves carry yellow and blue bands; shoes, sash and crown detail are reduced. The 1795 dancers' exact costume is not given by the source, so this is the general type. The face is blank on purpose.",
  nodes: [
    { t: 'rect', x: 36, y: 34, w: 8, h: 8, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M26 64 L54 64 L72 120 L8 120 Z', fill: 'brand.secondary', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M28 40 L52 40 L58 48 L58 66 L22 66 L22 48 Z', fill: 'feedback.nudge', stroke: 'border.strong', sw: 'thin' },
    // one arm raised high, one held out low; the long hansam sleeves hang from them
    { t: 'path', d: 'M54 44 L70 22 L78 26 L60 52 Z', fill: 'feedback.nudge', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M26 46 L10 66 L16 72 L28 56 Z', fill: 'feedback.nudge', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M70 22 Q78 6 76 2 L80 4 Q80 14 78 26 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M10 66 Q2 84 4 100 L10 100 Q10 84 16 72 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M5 80 H12.5 M4 90 H11', stroke: 'feedback.nudge', sw: 'base' },
    { t: 'path', d: 'M5 85 H12 M74 10 L79 11', stroke: 'brand.secondary', sw: 'base', det: true },
    face(40, 24, 10, 12),
    { t: 'path', d: 'M28 18 Q30 6 40 6 Q50 6 52 18 Q40 12 28 18 Z', fill: 'text.secondary' },
    // flower crown
    { t: 'path', d: 'M30 10 L32 2 L36 7 L40 1 L44 7 L48 2 L50 10 Z', fill: 'feedback.nudge', stroke: 'border.strong', sw: 'thin' },
  ],
};

export const FIG_MODERN: ItemDef = {
  id: 'prop:fig-modern',
  kind: 'figure',
  box: { w: 60, h: 124 },
  z: 'mid',
  tintable: 'brand.secondary',
  alt: 'A person of today in a shirt and trousers',
  accuracyNote:
    "A present-day adult in a plain shirt and trousers with short hair, for researchers, visitors and families. Shirt colour is tintable; scaled down it stands for a child. Not a portrait of anyone. The face is blank on purpose.",
  nodes: [
    { t: 'ellipse', cx: 30, cy: 122, rx: 22, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 26, y: 30, w: 8, h: 8, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M17 74 L43 74 L45 120 L33 120 L30 88 L27 120 L15 120 Z', fill: 'text.secondary', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M18 36 L42 36 L50 44 L54 76 L46 78 L43 56 L43 78 L17 78 L17 56 L14 78 L6 76 L10 44 Z', fill: 'brand.secondary', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M25 37 L30 44 L35 37', stroke: 'border.strong', sw: 'base', det: true },
    face(30, 20, 10, 12),
    { t: 'path', d: 'M20 18 Q20 6 30 6 Q40 6 40 18 Q36 12 30 12 Q24 12 20 18 Z', fill: 'text.primary' },
    { t: 'path', d: 'M14 120 H28 V124 H14 Z M32 120 H46 V124 H32 Z', fill: 'text.primary' },
  ],
};

export const FIG_WORKER: ItemDef = {
  id: 'prop:fig-worker',
  kind: 'figure',
  box: { w: 64, h: 124 },
  z: 'mid',
  alt: 'A restoration worker of today in a yellow hard hat and a work vest',
  accuracyNote:
    "A present-day stone mason or restoration worker: a yellow safety helmet, a high-visibility work vest over a long-sleeved shirt, work trousers and boots. Generic safety wear, not any company's uniform. The face is blank on purpose.",
  nodes: [
    { t: 'ellipse', cx: 32, cy: 122, rx: 24, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 28, y: 32, w: 8, h: 8, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M18 76 L46 76 L48 118 L35 118 L32 90 L29 118 L16 118 Z', fill: 'text.secondary', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M20 38 L44 38 L52 46 L58 74 L50 78 L46 58 L46 80 L18 80 L18 58 L14 78 L6 74 L12 46 Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M22 40 L28 40 L32 50 L36 40 L42 40 L44 80 L20 80 Z', fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M20 64 H44', stroke: 'surface.paper', sw: 'thick', det: true },
    face(32, 22, 10, 12),
    { t: 'path', d: 'M19 17 Q19 3 32 3 Q45 3 45 17 Z', fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 16, y: 15, w: 32, h: 4, r: 2, fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M14 118 H30 V124 H14 Z M34 118 H50 V124 H34 Z', fill: 'text.primary' },
  ],
};

export const FIG_RESEARCHER: ItemDef = {
  id: 'prop:fig-researcher',
  kind: 'figure',
  box: { w: 130, h: 100 },
  z: 'mid',
  alt: 'A researcher of today seated at a desk beside a computer screen showing a simple line chart',
  accuracyNote:
    "A present-day researcher at a desk with a monitor that shows a plain rising-and-falling line, standing for weather data read from old diaries. The chart has no axes, labels or numbers, so it claims no particular result. Not a portrait of anyone. The face is blank on purpose.",
  nodes: [
    { t: 'ellipse', cx: 65, cy: 98, rx: 60, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    // the researcher behind the desk
    { t: 'rect', x: 89, y: 28, w: 8, h: 8, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M78 64 L80 40 Q93 34 106 40 L108 64 Z', fill: 'brand.secondary', stroke: 'border.strong', sw: 'thin' },
    face(93, 19, 9, 11),
    { t: 'path', d: 'M84 17 Q84 6 93 6 Q102 6 102 17 Q98 11 93 11 Q88 11 84 17 Z', fill: 'text.primary' },
    // monitor on the desk, facing the viewer
    { t: 'rect', x: 6, y: 12, w: 64, h: 44, r: 3, fill: 'text.primary' },
    { t: 'rect', x: 10, y: 16, w: 56, h: 36, fill: 'surface.paper' },
    { t: 'path', d: 'M14 44 L24 36 L32 40 L42 26 L50 32 L62 22', stroke: 'brand.secondary', sw: 'base' },
    { t: 'path', d: 'M14 48 H62', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'path', d: 'M34 56 H42 L44 64 H32 Z', fill: 'text.primary' },
    // desk
    { t: 'rect', x: 0, y: 64, w: 130, h: 6, r: 1, fill: 'text.secondary' },
    { t: 'path', d: 'M6 70 H12 V98 H6 Z M118 70 H124 V98 H118 Z', fill: 'text.secondary' },
  ],
};

// --- PR 2.10b: hangul-printing cluster --------------------------------------

const MONK_REF = { title: '승복 (僧服)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0032200', accessed: ACCESSED } as const;
const MONK_NOTE =
  'Goryeo monks wore mainly the gasa and pyeonsam, taking up the black jangsam and red gasa from China; grey robes came later (encykorea). So the robe is dark (tintable) with a deep red gasa. The shaved head is general knowledge, not the entry. Nuns dressed alike. The face is blank on purpose.';

export const FIG_MONK: ItemDef = {
  id: 'prop:fig-monk',
  kind: 'figure',
  box: { w: 70, h: 124 },
  z: 'mid',
  tintable: 'text.primary',
  alt: 'A Goryeo Buddhist monk or nun with a shaved head, in a long dark robe with a deep red gasa over one shoulder',
  sourceRef: MONK_REF,
  accuracyNote: MONK_NOTE,
  nodes: [
    { t: 'rect', x: 31, y: 34, w: 8, h: 8, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M24 40 L46 40 L54 50 L64 96 L54 100 L52 76 L58 118 L12 118 L18 76 L16 100 L6 96 L16 50 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'poly', pts: [[17, 47], [27, 41], [57, 104], [49, 112], [42, 100]], fill: 'brand.primaryDark' },
    { t: 'path', d: 'M27 42 Q35 50 43 42', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'circle', cx: 35, cy: 64, r: 4.5, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    face(35, 22, 12, 14),
    { t: 'path', d: 'M18 118 H32 V124 H18 Z M38 118 H52 V124 H38 Z', fill: 'text.primary' },
  ],
};

export const FIG_MONK_SEATED: ItemDef = {
  id: 'prop:fig-monk-seated',
  kind: 'figure',
  box: { w: 100, h: 90 },
  z: 'mid',
  tintable: 'text.primary',
  alt: 'An elderly Goryeo Buddhist monk with a shaved head, seated in a dark robe and red gasa, writing with a brush on a sheet of paper',
  sourceRef: MONK_REF,
  accuracyNote: `${MONK_NOTE} Seated with the sheet on the lap; the writing is plain strokes, never letters.`,
  nodes: [
    { t: 'rect', x: 46, y: 28, w: 8, h: 9, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M8 88 Q8 64 30 58 L70 58 Q92 64 92 88 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M34 60 L28 36 Q50 30 72 36 L66 60 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'poly', pts: [[30, 38], [40, 33], [70, 60], [58, 62]], fill: 'brand.primaryDark' },
    face(50, 20, 11, 13),
    { t: 'poly', pts: [[28, 80], [72, 80], [67, 66], [33, 66]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M40 69 V76 M46 69 V74 M52 69 V77', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'path', d: 'M32 38 Q18 52 26 66 L40 66 Q36 52 38 44 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M68 38 Q82 52 74 64 L60 64 Q64 52 62 44 Z', fill: 'text.primary', stroke: 'border.strong', sw: 'thin' },
    { t: 'line', x1: 62, y1: 50, x2: 62, y2: 70, stroke: 'border.strong', sw: 'base' },
    { t: 'circle', cx: 62, cy: 62, r: 3.5, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
  ],
};

export const FIG_CARVER: ItemDef = {
  id: 'prop:fig-carver',
  kind: 'figure',
  box: { w: 110, h: 86 },
  z: 'mid',
  tintable: 'surface.sunken',
  alt: 'A Goryeo woodblock carver in a white ramie robe and black head cloth, an early form of hanbok, kneeling over a board with a small knife',
  sourceRef: { title: '포 (袍)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0060121', accessed: ACCESSED },
  accuracyNote: 'In Goryeo even the king at leisure wore a black head cloth and a white ramie robe like commoners (encykorea, from the Goryeo dogyeong). Who the carvers were is not described, so no monk dress is given. Robe tintable; the face is blank on purpose.',
  nodes: [
    { t: 'path', d: 'M14 82 Q14 58 34 52 L76 52 Q96 58 96 82 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M38 54 L34 30 Q55 24 76 30 L72 54 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'thin' },
    face(55, 18, 10, 12),
    { t: 'path', d: 'M44 15 Q44 2 55 2 Q66 2 66 15 Q55 10 44 15 Z', fill: 'text.primary' },
    { t: 'path', d: 'M64 12 Q70 18 72 26 M66 10 Q74 14 78 20', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'poly', pts: [[22, 86], [88, 86], [82, 68], [28, 68]], fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M36 74 H40 M44 74 H48 M52 74 H56 M60 74 H64 M68 74 H72 M34 80 H38 M42 80 H46 M50 80 H54 M58 80 H62 M66 80 H70 M74 80 H78', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'path', d: 'M36 32 Q24 48 40 66 L50 64 Q42 50 44 40 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M74 32 Q86 48 70 66 L60 64 Q68 50 66 40 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'thin' },
    { t: 'circle', cx: 46, cy: 66, r: 4, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'circle', cx: 64, cy: 66, r: 4, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'line', x1: 64, y1: 66, x2: 70, y2: 74, stroke: 'text.primary', sw: 'base' },
  ],
};

// --- PR 2.10c: science-art-life cluster -------------------------------------

const SSIREUM_REF = { title: '씨름, 《단원 풍속도첩》 (본관6504-22)', publisher: '국립중앙박물관 (National Museum of Korea, museum.go.kr)', url: 'https://www.museum.go.kr/site/main/relic/treasure/view?relicId=551', accessed: ACCESSED } as const;

export const FIG_COMMANDER: ItemDef = {
  id: 'prop:fig-commander',
  kind: 'figure',
  box: { w: 80, h: 130 },
  z: 'mid',
  tintable: 'text.secondary',
  alt: 'Joseon military commander in a dark cheollik robe, a red sash belt and a black felt jeollip hat',
  sourceRef: { title: '융복 (戎服)', publisher: PUBLISHER, url: 'https://encykorea.aks.ac.kr/Article/E0042783', accessed: ACCESSED },
  accuracyNote:
    'Military dress per the entry: a pleated cheollik robe (worn widely in early Joseon, and by all ranks for military duty from the Imjin War on), a red silk belt and a jeollip hat. Rank colours came later, so the robe is a plain dark tone, tintable. No sword or armour; faceless.',
  nodes: [
    { t: 'rect', x: 36, y: 40, w: 8, h: 10, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M30 48 L50 48 L58 56 L68 100 L60 104 L57 82 L68 122 L12 122 L23 82 L20 104 L12 100 L22 56 Z', fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    face(40, 30, 11, 13),
    { t: 'path', d: 'M18 18 Q18 14 30 14 Q30 3 40 3 Q50 3 50 14 Q62 14 62 18 Q62 22 40 22 Q18 22 18 18 Z M22 122 H38 V130 H22 Z M42 122 H58 V130 H42 Z', fill: 'text.primary' },
    { t: 'path', d: 'M32 48 Q40 56 48 48 M30 92 L27 120 M37 92 L36 120 M43 92 L44 120 M50 92 L53 120', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'rect', x: 22, y: 84, w: 36, h: 4, fill: 'brand.primary' },
    { t: 'line', x1: 30, y1: 18, x2: 50, y2: 18, stroke: 'text.secondary', sw: 'thin' },
  ],
};

export const FIG_WRESTLERS: ItemDef = {
  id: 'prop:fig-wrestlers',
  kind: 'figure',
  box: { w: 130, h: 90 },
  z: 'mid',
  tintable: 'surface.sunken',
  alt: 'Two Joseon wrestlers in plain cotton hanbok crouched shoulder to shoulder, cloth belts at waist and thigh',
  sourceRef: SSIREUM_REF,
  accuracyNote: "After the centre of Kim Hongdo's Ssireum: two men in plain cotton grappling. The waist and thigh belts (satba) follow ssireum today; grips simplified. Clothes tintable, faces blank.",
  nodes: [
    { t: 'path', d: 'M10 88 L20 62 L42 56 L50 74 L42 88 L33 88 L37 74 L28 70 L19 88 Z M120 88 L110 62 L88 56 L80 74 L88 88 L97 88 L93 74 L102 70 L111 88 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M20 63 L43 57 L67 38 L58 27 L38 33 Z M110 63 L87 57 L63 38 L72 27 L92 33 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M21 63 L43 57 M37 74 L46 70 M109 63 L87 57 M93 74 L84 70', stroke: 'feedback.nudge', sw: 'thick' },
    { t: 'path', d: 'M64 35 Q80 42 88 56 M66 35 Q50 42 42 56', stroke: 'border.strong', sw: 'thick' },
    face(56, 20, 8, 9),
    face(74, 20, 8, 9),
    { t: 'path', d: 'M48 19 Q48 10 56 10 Q64 10 64 19 Q56 15 48 19 Z M82 19 Q82 10 74 10 Q66 10 66 19 Q74 15 82 19 Z M53 8 A3 3 0 1 0 59 8 A3 3 0 1 0 53 8 Z M71 8 A3 3 0 1 0 77 8 A3 3 0 1 0 71 8 Z', fill: 'text.primary' },
  ],
};

export const CROWD_SEATED: ItemDef = {
  id: 'prop:crowd-seated',
  kind: 'figure',
  box: { w: 160, h: 66 },
  z: 'mid',
  tintable: 'surface.sunken',
  alt: 'Four Joseon onlookers in plain cotton hanbok seated in a curved row, three in black gat hats',
  sourceRef: SSIREUM_REF,
  accuracyNote: "After the curved groups of onlookers in plain cotton in Kim Hongdo's Ssireum. Their hats are not described, so three wear the everyday gat and one a bare topknot. Clothes tintable, faces blank.",
  nodes: [
    { t: 'path', d: 'M5 66 Q5 46 22 44 Q39 46 39 66 Z M45 66 Q45 40 62 38 Q79 40 79 66 Z M83 66 Q83 40 100 38 Q117 40 117 66 Z M121 66 Q121 46 138 44 Q155 46 155 66 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    face(22, 34, 7, 8),
    { t: 'path', d: 'M55 28 A7 8 0 1 0 69 28 A7 8 0 1 0 55 28 Z M93 28 A7 8 0 1 0 107 28 A7 8 0 1 0 93 28 Z M131 34 A7 8 0 1 0 145 34 A7 8 0 1 0 131 34 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M16 27 L28 27 L27 17 L17 17 Z M56 21 L68 21 L67 11 L57 11 Z M132 27 L144 27 L143 17 L133 17 Z M8 28 Q22 23 36 28 Q22 31 8 28 Z M48 22 Q62 17 76 22 Q62 25 48 22 Z M124 28 Q138 23 152 28 Q138 31 124 28 Z', fill: 'text.primary' },
    { t: 'path', d: 'M93 26 Q93 19 100 19 Q107 19 107 26 Q100 23 93 26 Z M97 17 A3 3 0 1 0 103 17 A3 3 0 1 0 97 17 Z', fill: 'text.primary' },
    { t: 'path', d: 'M16 50 L22 56 L28 50 M56 44 L62 50 L68 44 M94 44 L100 50 L106 44 M132 50 L138 56 L144 50', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const FIG_CHILD_BACK: ItemDef = {
  id: 'prop:fig-child-back',
  kind: 'figure',
  box: { w: 52, h: 60 },
  z: 'mid',
  tintable: 'feedback.nudge',
  alt: 'A Joseon schoolboy in hanbok crouched and turned away, a long braid down his back',
  sourceRef: { title: '서당, 《단원 풍속도첩》 (본관6504-23)', publisher: '국립중앙박물관 (National Museum of Korea, museum.go.kr)', url: 'https://www.museum.go.kr/site/main/relic/treasure/view?relicId=552', accessed: ACCESSED },
  accuracyNote: "After the boy at the centre of Kim Hongdo's Seodang, crouched and turned away, so only an edge of his blank face shows. The long braid with a ribbon follows unmarried boys' hair. Jacket tintable.",
  nodes: [
    { t: 'path', d: 'M4 60 Q4 50 26 50 Q48 50 48 60 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M8 56 Q4 32 26 26 Q46 28 46 56 Z M36 32 Q46 30 42 20 L38 22 Q40 28 33 28 Z', fill: 'feedback.nudge', stroke: 'text.primary', sw: 'thin' },
    face(34, 16, 9, 10),
    { t: 'path', d: 'M17 17 Q17 4 30 5 Q40 6 41 12 Q34 13 33 25 Q21 28 17 17 Z', fill: 'text.primary' },
    { t: 'path', d: 'M24 24 Q21 34 25 44', stroke: 'text.primary', sw: 'thick' },
    { t: 'path', d: 'M22 44 L28 44 L27 49 L23 49 Z', fill: 'brand.primary', det: true },
    { t: 'line', x1: 8, y1: 56, x2: 46, y2: 56, stroke: 'text.primary', sw: 'thin', o: 0.35 },
  ],
};
