/**
 * Writing props (F-STORY-002 §3.9.4, PR 2.3b). No text in the image (§3.9.5
 * rule 7): writing is drawn as rows of plain strokes, never as letters.
 */
import type { ItemDef } from '../types';

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
