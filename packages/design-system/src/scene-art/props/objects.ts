/**
 * Everyday objects, tools and devices (F-STORY-002 §3.9.4, PR 2.10a). Screens
 * and boards show marks or simple symbols, never text.
 */
import type { ItemDef } from '../types';

export const OIL_LAMP: ItemDef = {
  id: 'prop:oil-lamp',
  kind: 'object',
  box: { w: 28, h: 64 },
  z: 'mid',
  alt: 'A small oil lamp burning on a wooden stand',
  accuracyNote:
    'A generic lamp stand of the kind used in Joseon rooms: a round base, a slim post and a small dish of oil with a flame, with a soft glow around it. Not copied from a museum piece; no carving or inscription is drawn.',
  nodes: [
    { t: 'circle', cx: 14, cy: 12, r: 12, fill: 'feedback.nudgeLight', o: 0.6 },
    { t: 'path', d: 'M14 4 Q19 11 14 16 Q9 11 14 4 Z', fill: 'feedback.nudge' },
    { t: 'rect', x: 6, y: 16, w: 16, h: 4, r: 2, fill: 'text.secondary' },
    { t: 'rect', x: 12, y: 20, w: 4, h: 38, fill: 'text.secondary' },
    { t: 'ellipse', cx: 14, cy: 60, rx: 12, ry: 4, fill: 'text.secondary' },
  ],
};

export const TABLET: ItemDef = {
  id: 'prop:tablet',
  kind: 'object',
  box: { w: 60, h: 44 },
  z: 'front',
  alt: 'A tablet computer showing two columns of marks, one in old vertical columns and one in modern lines (no readable text)',
  accuracyNote:
    'A present-day tablet whose screen shows two panels of marks: vertical columns standing for the classical original and horizontal lines standing for a modern translation, as on the online Annals. They are strokes, not characters. Not any real app.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 60, h: 44, r: 4, fill: 'text.primary' },
    { t: 'rect', x: 4, y: 4, w: 52, h: 36, fill: 'surface.paper' },
    { t: 'line', x1: 30, y1: 6, x2: 30, y2: 38, stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M10 9 V34 M15 9 V30 M20 9 V35 M25 9 V28', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M35 11 H51 M35 17 H49 M35 23 H51 M35 29 H46', stroke: 'brand.secondary', sw: 'base' },
  ],
};

export const WEATHER_SIGNS: ItemDef = {
  id: 'prop:weather-signs',
  kind: 'symbol',
  box: { w: 110, h: 54 },
  z: 'front',
  alt: 'A sun symbol and a rain-cloud symbol',
  accuracyNote: 'Two simple weather symbols, a sun and a cloud with rain, standing for the weather notes the diaries kept. Symbols only; no reading is claimed.',
  nodes: [
    { t: 'circle', cx: 22, cy: 26, r: 11, fill: 'feedback.nudge' },
    { t: 'path', d: 'M22 4 V10 M22 42 V48 M0 26 H6 M38 26 H44 M7 11 L11 15 M33 37 L37 41 M37 11 L33 15 M11 37 L7 41', stroke: 'feedback.nudge', sw: 'thick' },
    { t: 'path', d: 'M64 34 Q56 34 56 26 Q56 18 66 18 Q70 8 82 10 Q94 10 96 20 Q106 20 106 28 Q106 34 98 34 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M68 40 L64 50 M80 40 L76 50 M92 40 L88 50', stroke: 'brand.secondary', sw: 'thick' },
  ],
};

export const SIGNPOST: ItemDef = {
  id: 'prop:signpost',
  kind: 'object',
  box: { w: 80, h: 110 },
  z: 'mid',
  alt: 'A wooden signpost with three arrow boards marked with a book, a fortress and a cloud (no words)',
  accuracyNote: 'A wooden signpost whose three boards carry picture symbols instead of words: a closed book, a crenellated fortress wall and a cloud. Generic and invented for the story.',
  nodes: [
    { t: 'ellipse', cx: 40, cy: 108, rx: 18, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 36, y: 10, w: 8, h: 98, fill: 'text.secondary' },
    { t: 'poly', pts: [[44, 12], [72, 12], [80, 22], [72, 32], [44, 32]], fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'poly', pts: [[36, 40], [8, 40], [0, 50], [8, 60], [36, 60]], fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'poly', pts: [[44, 68], [72, 68], [80, 78], [72, 88], [44, 88]], fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M52 16 H64 V28 H52 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M10 56 V46 H14 V49 H18 V46 H22 V49 H26 V46 H30 V56 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M54 82 Q50 82 50 78 Q50 74 55 74 Q57 70 62 71 Q67 71 68 75 Q72 75 72 79 Q72 82 68 82 Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
  ],
};

export const ARCHIVE_SHELF: ItemDef = {
  id: 'prop:archive-shelf',
  kind: 'furniture',
  box: { w: 120, h: 150 },
  z: 'mid',
  alt: 'A tall archive shelf filled with old books kept in pale protective boxes',
  accuracyNote:
    'A present-day archive shelf of four levels holding old books in pale archival boxes, as the originals are kept today (Gyujanggak keeps them in a modern store). Box sizes and count are generic, and no label, catalogue number or logo is drawn.',
  nodes: [
    { t: 'ellipse', cx: 60, cy: 148, rx: 58, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 0, y: 0, w: 120, h: 146, fill: 'text.secondary' },
    { t: 'rect', x: 6, y: 6, w: 108, h: 136, fill: 'surface.sunken' },
    { t: 'path', d: 'M6 38 H114 M6 72 H114 M6 106 H114', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M10 12 H26 V37 H10 Z M28 14 H44 V37 H28 Z M46 12 H62 V37 H46 Z M64 14 H80 V37 H64 Z M82 12 H98 V37 H82 Z M10 46 H26 V71 H10 Z M28 44 H44 V71 H28 Z M46 46 H62 V71 H46 Z M64 44 H80 V71 H64 Z', fill: 'feedback.nudgeLight', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M10 80 H26 V105 H10 Z M28 78 H44 V105 H28 Z M46 80 H62 V105 H46 Z M64 78 H80 V105 H64 Z M82 80 H98 V105 H82 Z M100 82 H112 V105 H100 Z M10 112 H26 V141 H10 Z M28 114 H44 V141 H28 Z M46 112 H62 V141 H46 Z', fill: 'feedback.nudgeLight', stroke: 'border.strong', sw: 'thin' },
  ],
};

export const CRAFT_WOOD: ItemDef = {
  id: 'prop:craft-wood',
  kind: 'object',
  box: { w: 80, h: 34 },
  z: 'front',
  alt: 'A carpenter’s wooden beam on trestles with a hand plane and shavings',
  accuracyNote: 'A carpenter’s work: a squared wooden beam resting on two low trestles, a hand plane on top and a few curled shavings. Generic tools, not copied from a particular museum set.',
  nodes: [
    { t: 'path', d: 'M10 34 L14 18 H22 L26 34 Z M54 34 L58 18 H66 L70 34 Z', fill: 'text.secondary' },
    { t: 'rect', x: 2, y: 12, w: 76, h: 8, r: 1, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M34 6 H52 L54 12 H32 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M58 10 Q62 4 66 8 M64 30 Q68 26 72 30', stroke: 'border.strong', sw: 'base', det: true },
  ],
};

export const CRAFT_EMBROIDERY: ItemDef = {
  id: 'prop:craft-embroidery',
  kind: 'object',
  box: { w: 60, h: 44 },
  z: 'front',
  alt: 'An embroidery frame holding cloth with a half-stitched flower',
  accuracyNote: 'A square wooden embroidery frame with stretched cloth and a simple flower half stitched in coloured thread. Generic; no particular pattern or workshop is copied.',
  nodes: [
    { t: 'rect', x: 2, y: 2, w: 56, h: 36, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thick' },
    { t: 'circle', cx: 24, cy: 20, r: 6, fill: 'feedback.nudge' },
    { t: 'path', d: 'M30 20 Q38 14 44 20 Q38 26 30 20 Z M24 26 Q22 32 26 36', fill: 'theme.nature', stroke: 'theme.nature', sw: 'base' },
    { t: 'path', d: 'M14 38 V44 M46 38 V44', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M10 8 Q16 12 12 16', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const CRAFT_PAINTING: ItemDef = {
  id: 'prop:craft-painting',
  kind: 'object',
  box: { w: 56, h: 54 },
  z: 'front',
  alt: 'A painted wooden panel with simple bands of colour on a stand, a brush and a dish of paint beside it',
  accuracyNote: 'A painter’s panel on a low stand with simple bands and a round motif in colour, a brush and a paint dish beside it. It stands for the court painters a uigwe names; the motif is invented and is not a copy of any dancheong pattern.',
  nodes: [
    { t: 'rect', x: 6, y: 2, w: 40, h: 40, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M6 12 H46 V16 H6 Z M6 30 H46 V34 H6 Z', fill: 'theme.nature' },
    { t: 'circle', cx: 26, cy: 23, r: 5, fill: 'feedback.nudge' },
    { t: 'path', d: 'M10 42 L6 54 M42 42 L46 54', stroke: 'text.secondary', sw: 'thick' },
    { t: 'ellipse', cx: 50, cy: 50, rx: 6, ry: 2.5, fill: 'theme.nature' },
  ],
};
