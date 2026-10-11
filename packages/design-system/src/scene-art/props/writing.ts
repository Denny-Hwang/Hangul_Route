/**
 * Writing props (F-STORY-002 §3.9.4, PR 2.3b). No text in the image (§3.9.5
 * rule 7): writing is drawn as rows of plain strokes, never as letters.
 */
import type { ItemDef, Shape } from '../types';

export const DESK_LOW: ItemDef = {
  id: 'prop:desk-low',
  kind: 'furniture',
  box: { w: 110, h: 60 },
  z: 'mid',
  alt: 'A low wooden writing desk',
  accuracyNote:
    'A generic low writing desk (a board on two end supports) drawn for scale. It is not copied from one museum piece and carries no carving, inlay or inscription; the sources behind the stories do not describe a particular desk.',
  nodes: [
    { t: 'rect', x: 0, y: 14, w: 110, h: 8, r: 2, fill: 'text.secondary' },
    { t: 'line', x1: 4, y1: 17, x2: 106, y2: 17, stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'path', d: 'M10 22 L10 56 Q10 60 16 60 L24 60 Q30 60 30 56 L30 22 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M80 22 L80 56 Q80 60 86 60 L94 60 Q100 60 100 56 L100 22 Z', fill: 'text.secondary' },
    { t: 'rect', x: 30, y: 22, w: 50, h: 5, fill: 'text.primary' },
    { t: 'ellipse', cx: 55, cy: 58, rx: 52, ry: 2, fill: 'text.primary', o: 0.08, det: true },
  ],
};

export const WRITING_SET: ItemDef = {
  id: 'prop:writing-set',
  kind: 'object',
  box: { w: 80, h: 40 },
  z: 'mid',
  alt: "A brush, an inkstone and an ink stick, the scholar's writing tools",
  tags: { heritage: true },
  sourceRef: { title: '문방사우 (文房四友)', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0019481', accessed: '2026-10-11' },
  accuracyNote:
    'Three of the four study tools the entry names (brush, inkstone, ink stick); the fourth, paper, is the separate writing-lines prop. Shapes are simplified: a plain rectangular inkstone with one well, a plain ink stick, a bamboo-handled brush with a full tuft of pale hair and an ink-dark point, resting across the inkstone and the ink stick. No carved lids, seals or inscriptions are drawn.',
  nodes: [
    { t: 'ellipse', cx: 40, cy: 38, rx: 38, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 4, y: 20, w: 34, h: 17, r: 3, fill: 'text.primary' },
    { t: 'ellipse', cx: 21, cy: 27, rx: 11, ry: 4, fill: 'text.secondary' },
    { t: 'line', x1: 8, y1: 34, x2: 34, y2: 34, stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'rect', x: 46, y: 27, w: 24, h: 9, r: 1, fill: 'text.primary' },
    { t: 'line', x1: 49, y1: 30, x2: 67, y2: 30, stroke: 'border.strong', sw: 'thin', det: true },
    // the brush rests across the inkstone and the ink stick: a full tuft of pale
    // hair tapering to an ink-dark point, a dark ferrule band, a bamboo handle
    {
      t: 'group',
      tx: 5,
      ty: 8.5,
      rot: 12,
      kids: [
        { t: 'line', x1: 26, y1: 5, x2: 72, y2: 5, stroke: 'text.secondary', sw: 'thick' },
        { t: 'rect', x: 22, y: 1, w: 4, h: 8, r: 1, fill: 'text.primary' },
        { t: 'path', d: 'M22 1 C14 0.5 7 2.5 0 5 C7 7.5 14 9.5 22 9 Z', fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
        { t: 'path', d: 'M0 5 C3 4 6 3.5 8 3.5 L8 6.5 C5.5 6.5 3 6 0 5 Z', fill: 'text.primary' },
      ],
    },
  ],
};

export const WRITING_LINES: ItemDef = {
  id: 'prop:writing-lines',
  kind: 'object',
  box: { w: 70, h: 56 },
  z: 'mid',
  alt: 'A sheet of paper with rows of brush strokes (no letters)',
  accuracyNote:
    'A sheet of plain paper with rows of short brush dashes standing for writing. They are strokes, not glyphs: no letter, character or word can be read, as the art rules forbid text in the image. Column rules are faint and the paper is plain, not any particular hanji.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 70, h: 56, r: 2, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M14 4 V52 M28 4 V52 M42 4 V52 M56 4 V52', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'path', d: 'M56 8 V14 M56 18 V30 M56 34 V40 M56 44 V48 M42 8 V20 M42 24 V28 M42 32 V44', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M28 8 V12 M28 16 V28 M28 32 V38 M28 42 V48 M14 8 V18 M14 22 V34 M14 38 V44', stroke: 'text.secondary', sw: 'base' },
  ],
};

// --- PR 2.10a: records-joseon cluster -------------------------------------

export const PAPER_STACK: ItemDef = {
  id: 'prop:paper-stack',
  kind: 'object',
  box: { w: 64, h: 34 },
  z: 'mid',
  alt: 'A neat stack of written sheets of paper',
  accuracyNote:
    'A squared-up pile of plain sheets, the top one showing rows of short brush strokes (no letters). Generic paper, not any particular record; the sources behind the stories do not describe the drafts as objects.',
  nodes: [
    { t: 'ellipse', cx: 32, cy: 32, rx: 30, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 4, y: 18, w: 56, h: 14, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M6 23 H58 M6 27 H58', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'poly', pts: [[4, 18], [60, 18], [56, 6], [8, 6]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M18 9 V15 M26 9 V14 M34 9 V16 M42 9 V13', stroke: 'text.secondary', sw: 'base' },
  ],
};

export const PAPERS_LOOSE: ItemDef = {
  id: 'prop:papers-loose',
  kind: 'object',
  box: { w: 70, h: 40 },
  z: 'mid',
  alt: 'An untidy pile of written sheets of paper, some askew',
  accuracyNote:
    'Loose sheets lying at different angles, each with a few brush strokes (no letters), standing for rough drafts. Generic paper; no particular record is copied.',
  nodes: [
    { t: 'ellipse', cx: 35, cy: 38, rx: 33, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'poly', pts: [[4, 30], [50, 24], [54, 36], [8, 38]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'poly', pts: [[16, 22], [60, 18], [66, 32], [20, 34]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'poly', pts: [[10, 12], [50, 6], [56, 22], [14, 26]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M22 13 L23 21 M30 12 L31 19 M38 11 L39 20 M46 26 L47 31', stroke: 'text.secondary', sw: 'base' },
  ],
};

export const SHEET_CURSIVE: ItemDef = {
  id: 'prop:sheet-cursive',
  kind: 'object',
  box: { w: 70, h: 56 },
  z: 'mid',
  alt: 'A sheet of paper covered in loose, flowing brush strokes (no readable characters)',
  accuracyNote:
    'Stands for the fast cursive script (choseo) of the original diaries: flowing, joined brush swirls in vertical columns. They are abstract curves, not any real character, so nothing can be read; compare the tidy upright strokes of the writing-lines prop.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 70, h: 56, r: 2, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M56 6 Q62 12 54 18 Q48 24 58 28 Q64 34 54 40 Q50 44 56 50', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M42 6 Q36 12 44 16 Q50 22 40 26 M44 32 Q36 38 44 44 Q48 48 40 50', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M28 6 Q34 14 26 20 Q20 26 30 30 Q34 36 26 42', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M14 8 Q8 14 16 20 Q20 26 12 30 M14 36 Q20 42 12 48', stroke: 'text.secondary', sw: 'base' },
  ],
};

export const PRINT_SHEET: ItemDef = {
  id: 'prop:print-sheet',
  kind: 'object',
  box: { w: 64, h: 54 },
  z: 'mid',
  alt: 'A freshly printed page with a picture of a hall in black ink inside a ruled frame',
  accuracyNote:
    "A printed picture page as in a printed uigwe, whose pictures were woodblock prints: a ruled frame and a simple ink outline of a hall roof, columns and steps. It copies no plate of a real book, and the column of caption text such pages carry is left out.",
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 64, h: 54, r: 1, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 5, y: 5, w: 54, h: 44, stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M12 24 Q20 22 24 14 H40 Q44 22 52 24 Z', fill: 'text.primary' },
    { t: 'path', d: 'M18 24 V40 M28 24 V40 M36 24 V40 M46 24 V40 M14 40 H50', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M10 44 H54', stroke: 'text.primary', sw: 'thin', det: true },
  ],
};

export const TYPE_TRAY: ItemDef = {
  id: 'prop:type-tray',
  kind: 'object',
  box: { w: 84, h: 40 },
  z: 'mid',
  alt: 'A metal printing frame packed with rows of small movable type pieces, a few loose pieces beside it',
  tags: { heritage: true },
  sourceRef: { title: '활자(活字)', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0065040', accessed: '2026-10-11' },
  accuracyNote:
    'The entry describes Joseon printing with movable type: an iron frame (inpan) filled with type pieces, the gaps later packed with bamboo, the face pressed level before printing. Here the frame is seen from slightly above, the type as a grid of small blocks with blank faces (no character is drawn) and three loose pieces beside it. Frame size and the number of pieces are generic.',
  nodes: [
    { t: 'ellipse', cx: 40, cy: 38, rx: 38, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'poly', pts: [[6, 30], [66, 30], [62, 6], [10, 6]], fill: 'text.primary' },
    { t: 'poly', pts: [[11, 27], [61, 27], [58, 9], [14, 9]], fill: 'border.strong' },
    { t: 'path', d: 'M13.5 15 H59 M12.5 21 H60 M22 9 L21 27 M30 9 V27 M38 9 V27 M46 9 V27 M54 9 L55 27', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 6, y: 30, w: 60, h: 6, fill: 'text.secondary' },
    { t: 'path', d: 'M70 30 H76 V36 H70 Z M78 28 H84 V34 H78 Z M73 22 H79 V28 H73 Z', fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
  ],
};

// --- PR 2.10b: hangul-printing cluster --------------------------------------

const ACCESSED = '2026-10-11';
const ENCYKOREA = '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)';
const BLOCKS_REF = { title: '합천 해인사 대장경판 (陜川 海印寺 大藏經板)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0062711', accessed: ACCESSED } as const;
const JAMO_REF = { title: '훈민정음 28자모', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0074518', accessed: ACCESSED } as const;

export const WOODBLOCK: ItemDef = {
  id: 'prop:woodblock',
  kind: 'object',
  box: { w: 130, h: 60 },
  z: 'mid',
  alt: 'One Goryeo Tripitaka woodblock, tilted: a dark lacquered board covered in carved marks, with end pieces and small metal plates at the four corners',
  tags: { heritage: true },
  sourceRef: BLOCKS_REF,
  accuracyNote: 'About 24 by 68-78 cm, mostly wild cherry, carved on both faces, lacquered, with end pieces and metal plates at the four corners (encykorea). One face shows; its columns are marks, never characters.',
  nodes: [
    { t: 'ellipse', cx: 65, cy: 57, rx: 60, ry: 3, fill: 'text.primary', o: 0.08, det: true },
    { t: 'poly', pts: [[8, 47], [122, 47], [122, 53], [8, 53]], fill: 'text.primary' },
    { t: 'poly', pts: [[14, 8], [116, 8], [122, 47], [8, 47]], fill: 'text.secondary' },
    { t: 'path', d: 'M32 14 V40 M38 14 V36 M44 14 V40 M50 14 V38 M56 14 V40 M62 14 V35 M68 14 V40 M74 14 V39 M80 14 V40 M86 14 V36 M92 14 V40 M98 14 V38', stroke: 'border.strong', sw: 'thin' },
    { t: 'poly', pts: [[8, 53], [8, 47], [14, 8], [24, 8], [19, 53]], fill: 'text.primary' },
    { t: 'poly', pts: [[122, 53], [122, 47], [116, 8], [106, 8], [111, 53]], fill: 'text.primary' },
    { t: 'path', d: 'M13 8 H25 V13 H13 Z M105 8 H117 V13 H105 Z M8 43 H20 V49 H8 Z M110 43 H122 V49 H110 Z', fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
    { t: 'line', x1: 30, y1: 11, x2: 100, y2: 11, stroke: 'surface.paper', sw: 'base', o: 0.2, det: true },
  ],
};

export const WOODBLOCK_SHELVES: ItemDef = {
  id: 'prop:woodblock-shelves',
  kind: 'object',
  box: { w: 150, h: 130 },
  z: 'mid',
  alt: 'Plain wooden shelves packed with rows of dark Tripitaka woodblocks',
  tags: { heritage: true },
  sourceRef: BLOCKS_REF,
  accuracyNote: 'The blocks were kept in order on racks (encykorea); how each one stands is not given. Four plain shelves of dark block ends; counts are generic and no label is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 150, h: 6, fill: 'text.secondary' },
    { t: 'path', d: 'M6 6 H144 V30 H6 Z M6 38 H144 V62 H6 Z M6 70 H144 V94 H6 Z M6 102 H144 V126 H6 Z', fill: 'text.primary' },
    { t: 'path', d: 'M20 6V30 M35 6V30 M50 6V30 M65 6V30 M80 6V30 M95 6V30 M110 6V30 M125 6V30 M140 6V30', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M20 38V62 M35 38V62 M50 38V62 M65 38V62 M80 38V62 M95 38V62 M110 38V62 M125 38V62 M140 38V62', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'path', d: 'M20 70V94 M35 70V94 M50 70V94 M65 70V94 M80 70V94 M95 70V94 M110 70V94 M125 70V94 M140 70V94', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M20 102V126 M35 102V126 M50 102V126 M65 102V126 M80 102V126 M95 102V126 M110 102V126 M125 102V126 M140 102V126', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'path', d: 'M0 30 H150 V38 H0 Z M0 62 H150 V70 H0 Z M0 94 H150 V102 H0 Z M0 126 H150 V130 H0 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M0 0 H6 V130 H0 Z M144 0 H150 V130 H144 Z', fill: 'text.secondary' },
  ],
};

/**
 * A side view of a head facing left, as in a speech diagram: outline, the
 * mouth and throat in pale pink, a tongue in the letters colour and a ring on
 * the place it touches. No eye or other face feature is drawn.
 */
const speechHead = (tongue: string, ring: [number, number]): Shape[] => [
  { t: 'path', d: 'M74 4 Q36 4 26 34 L14 56 Q12 60 18 62 L22 64 Q18 68 22 72 Q18 76 22 80 Q20 92 30 98 Q42 104 54 102 L56 130 H100 L102 92 Q120 70 116 38 Q110 4 74 4 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
  { t: 'path', d: 'M24 72 Q40 62 60 64 Q76 66 82 78 Q88 100 86 130 H70 L68 98 L30 88 Q22 82 24 72 Z', fill: 'brand.primaryLight' },
  { t: 'path', d: 'M24 71 Q40 61 60 63 Q76 65 82 77 Q88 100 86 130', stroke: 'border.strong', sw: 'thick' },
  { t: 'path', d: tongue, fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
  { t: 'circle', cx: ring[0], cy: ring[1], r: 8, stroke: 'text.primary', sw: 'base' },
];
const TONGUE_ROOT_UP = 'M28 84 Q40 78 54 78 Q70 74 81 78 Q80 92 68 98 L44 94 Q30 92 28 84 Z';
const TONGUE_TIP_UP = 'M25 72 Q29 66 34 71 Q44 80 60 81 Q74 81 80 88 Q78 96 68 98 L40 94 Q28 88 25 72 Z';

export const SPEECH_G: ItemDef = {
  id: 'prop:speech-g',
  kind: 'symbol',
  box: { w: 130, h: 130 },
  z: 'mid',
  alt: 'A side-view diagram of a head: the root of the tongue rises to close the throat, circled',
  accuracyNote: 'The entry says g copies the root of the tongue closing the throat. A teaching diagram: a faceless head outline with the tongue raised at the back. The app shows the letter.',
  sourceRef: JAMO_REF,
  nodes: speechHead(TONGUE_ROOT_UP, [81, 80]),
};

export const SPEECH_NM: ItemDef = {
  id: 'prop:speech-nm',
  kind: 'symbol',
  box: { w: 232, h: 110 },
  z: 'mid',
  alt: 'Two small diagrams: a side view of the tongue tip touching the upper gum, and an open mouth seen from the front, square in shape',
  accuracyNote: 'The entry says n copies the tongue touching the upper gum and m the shape of the mouth: the tongue tip raised behind the teeth, and a square mouth seen from the front. The app shows the letters.',
  sourceRef: JAMO_REF,
  nodes: [
    { t: 'group', s: 0.8, ty: 6, kids: speechHead(TONGUE_TIP_UP, [29, 69]) },
    { t: 'rect', x: 140, y: 26, w: 88, h: 66, r: 20, fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 154, y: 38, w: 60, h: 42, r: 8, fill: 'text.primary' },
    { t: 'path', d: 'M160 72 Q184 62 208 72 V78 H160 Z', fill: 'brand.primaryLight', det: true },
  ],
};

export const ORGAN_STONES: ItemDef = {
  id: 'prop:organ-stones',
  kind: 'symbol',
  box: { w: 300, h: 76 },
  z: 'mid',
  alt: 'Five round stepping stones, each with a simple picture: the back of the tongue raised, the tongue tip raised, a mouth, a tooth and a round throat',
  accuracyNote: 'Icons for the organs the entry names for g, n, m, s and ng, in that order: tongue root, tongue tip at the gum, mouth, tooth, throat. No letter is drawn.',
  sourceRef: JAMO_REF,
  nodes: [
    { t: 'path', d: 'M4 64 A26 10 0 1 0 56 64 A26 10 0 1 0 4 64 Z M64 64 A26 10 0 1 0 116 64 A26 10 0 1 0 64 64 Z M124 64 A26 10 0 1 0 176 64 A26 10 0 1 0 124 64 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M184 64 A26 10 0 1 0 236 64 A26 10 0 1 0 184 64 Z M244 64 A26 10 0 1 0 296 64 A26 10 0 1 0 244 64 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M12 34 Q30 18 50 30 M72 30 Q90 18 110 34', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M12 52 Q26 46 36 46 Q46 38 50 34 Q50 50 40 54 Z M72 38 Q78 32 82 40 Q92 48 110 48 Q108 56 98 56 L80 54 Q72 48 72 38 Z', fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 132, y: 22, w: 36, h: 30, r: 9, fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 140, y: 29, w: 20, h: 16, r: 3, fill: 'text.primary' },
    { t: 'path', d: 'M198 24 Q210 18 222 24 Q226 34 220 42 L216 56 Q213 50 210 42 Q207 50 204 56 L200 42 Q194 34 198 24 Z', fill: 'surface.paper', stroke: 'text.primary', sw: 'base' },
    { t: 'circle', cx: 270, cy: 38, r: 14, fill: 'surface.paper', stroke: 'theme.letters', sw: 'thick' },
  ],
};

export const RIBBON_TRAILS: ItemDef = {
  id: 'prop:ribbon-trails',
  kind: 'symbol',
  box: { w: 110, h: 46 },
  z: 'mid',
  alt: 'Three glowing ribbon trails drawn in the air: one with a single bend, then the same with one more line, then with two more lines',
  accuracyNote: 'The added-stroke rule (one or two strokes added to a basic letter, as n, d, t; encykorea): three loose trails, each with one more line. The app shows the letters.',
  sourceRef: JAMO_REF,
  nodes: [
    { t: 'path', d: 'M8 8 Q7 24 9 36 Q20 38 30 37', stroke: 'theme.letters', sw: 'thick' },
    { t: 'path', d: 'M40 9 Q52 7 64 9 M41 9 Q40 24 42 36 Q53 38 64 37', stroke: 'theme.letters', sw: 'thick' },
    { t: 'path', d: 'M76 8 Q88 6 100 8 M77 22 Q88 21 99 22 M77 8 Q76 24 78 36 Q89 38 100 37', stroke: 'theme.letters', sw: 'thick' },
    { t: 'path', d: 'M30 41 L32 43 M64 41 L66 43 M100 41 L102 43 M34 4 L36 6 M68 4 L70 6 M104 4 L106 6', stroke: 'feedback.nudge', sw: 'base' },
  ],
};

export const STICK_DOT: ItemDef = {
  id: 'prop:stick-dot',
  kind: 'symbol',
  box: { w: 104, h: 110 },
  z: 'mid',
  alt: 'A tall standing stick and a small round pebble sliding up beside its middle, fitting together like puzzle pieces, with sparkles',
  accuracyNote: 'The entry says a joins the standing line (a person) and the dot (heaven): the dot slides in on the right at the middle. Sparkles are decoration; the app shows the letter.',
  sourceRef: JAMO_REF,
  nodes: [
    { t: 'rect', x: 30, y: 8, w: 16, h: 98, r: 8, fill: 'theme.crafts', stroke: 'text.primary', sw: 'thin' },
    { t: 'circle', cx: 66, cy: 56, r: 10, fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M82 50 H94 M84 57 H98 M82 64 H92', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M54 30 L56 36 L62 38 L56 40 L54 46 L52 40 L46 38 L52 36 Z M58 70 L59.5 74 L64 75.5 L59.5 77 L58 81 L56.5 77 L52 75.5 L56.5 74 Z', fill: 'feedback.nudge' },
  ],
};

export const STROKE_SPARKS: ItemDef = {
  id: 'prop:stroke-sparks',
  kind: 'symbol',
  box: { w: 150, h: 80 },
  z: 'mid',
  alt: 'Simple shapes floating up like sparks: dots, short straight strokes and small circles, with tiny sparkles (no letters)',
  accuracyNote: 'Abstract dots, strokes and circles rising like sparks; they suggest new letters being made without drawing any real letter.',
  nodes: [
    { t: 'circle', cx: 20, cy: 50, r: 5, fill: 'feedback.nudge' },
    { t: 'path', d: 'M40 24 H62 M84 12 V34 M110 40 H132 M60 60 V72', stroke: 'text.primary', sw: 'thick' },
    { t: 'path', d: 'M28 72 H40 V80', stroke: 'feedback.nudge', sw: 'thick' },
    { t: 'circle', cx: 120, cy: 66, r: 7, stroke: 'feedback.nudge', sw: 'thick' },
    { t: 'circle', cx: 30, cy: 14, r: 5, stroke: 'text.primary', sw: 'base' },
    { t: 'circle', cx: 140, cy: 14, r: 3.5, fill: 'feedback.nudge' },
    { t: 'path', d: 'M98 54 L99.5 58 L104 59.5 L99.5 61 L98 65 L96.5 61 L92 59.5 L96.5 58 Z M66 38 L67 41 L70 42 L67 43 L66 46 L65 43 L62 42 L65 41 Z M10 28 L11 31 L14 32 L11 33 L10 36 L9 33 L6 32 L9 31 Z', fill: 'feedback.nudge' },
  ],
};
