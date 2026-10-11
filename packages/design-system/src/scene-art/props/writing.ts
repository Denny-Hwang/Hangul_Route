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
