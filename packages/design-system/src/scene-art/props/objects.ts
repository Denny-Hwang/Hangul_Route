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

// --- PR 2.10b: hangul-printing cluster --------------------------------------

export const GLOW_BURST: ItemDef = {
  id: 'prop:glow-burst',
  kind: 'symbol',
  box: { w: 160, h: 160 },
  z: 'back',
  alt: 'A warm burst of light: a bright round glow with rays, for a sunrise or for something precious shining',
  accuracyNote: 'A sign of light (halo, rays, disc) for a sunrise or for an honoured object shining. No emblem or logo.',
  nodes: [
    { t: 'circle', cx: 80, cy: 80, r: 76, fill: 'feedback.nudge', o: 0.2 },
    { t: 'path', d: 'M122.5 91.5 L147.5 98 M111 111 L129.5 129.5 M91.5 122.5 L98 147.5 M68.5 122.5 L62 147.5 M49 111 L30.5 129.5 M37.5 91.5 L12.5 98', stroke: 'feedback.nudge', sw: 'thick' },
    { t: 'path', d: 'M37.5 68.5 L12.5 62 M49 49 L30.5 30.5 M68.5 37.5 L62 12.5 M91.5 37.5 L98 12.5 M111 49 L129.5 30.5 M122.5 68.5 L147.5 62', stroke: 'feedback.nudge', sw: 'thick' },
    { t: 'circle', cx: 80, cy: 80, r: 34, fill: 'feedback.nudge', o: 0.85 },
  ],
};

export const BREEZE: ItemDef = {
  id: 'prop:breeze',
  kind: 'symbol',
  box: { w: 120, h: 60 },
  z: 'mid',
  alt: 'Curved arrows of a gentle breeze',
  accuracyNote: 'Three curved arrows for moving air; the idea of airflow, not a measured current.',
  nodes: [
    { t: 'path', d: 'M4 14 Q30 4 56 14 Q82 24 104 14 M96 8 L106 13 L98 21', stroke: 'brand.secondary', sw: 'thick' },
    { t: 'path', d: 'M14 32 Q40 22 66 32 Q88 40 108 32 M100 26 L110 31 L102 39', stroke: 'brand.secondary', sw: 'thick' },
    { t: 'path', d: 'M4 50 Q28 42 52 50 Q70 56 88 50 M80 44 L90 49 L82 57', stroke: 'brand.secondary', sw: 'thick', o: 0.6 },
  ],
};

export const MUSEUM_CASE: ItemDef = {
  id: 'prop:museum-case',
  kind: 'furniture',
  box: { w: 90, h: 110 },
  z: 'mid',
  alt: 'A glass museum case on a plinth, holding an old open book under soft light',
  accuracyNote: 'A generic glass display case of today with an open old book under soft light; no real display and no label.',
  nodes: [
    { t: 'poly', pts: [[30, 4], [60, 4], [80, 66], [10, 66]], fill: 'feedback.nudgeLight', o: 0.35 },
    { t: 'rect', x: 14, y: 70, w: 62, h: 40, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 10, y: 66, w: 70, h: 6, fill: 'text.secondary' },
    { t: 'path', d: 'M24 52 Q34 49 45 52 Q56 49 66 52 L66 62 Q56 59 45 62 Q34 59 24 62 Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M45 52 V62 M30 54 V59 M35 54 V60 M55 54 V60 M60 54 V59', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 12, y: 24, w: 66, h: 42, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'base', o: 0.35 },
    { t: 'line', x1: 20, y1: 30, x2: 30, y2: 40, stroke: 'surface.paper', sw: 'thick', det: true },
  ],
};

export const CALENDAR_PAGE: ItemDef = {
  id: 'prop:calendar-page',
  kind: 'object',
  box: { w: 110, h: 130 },
  z: 'mid',
  alt: 'A wall calendar page of blank squares, one square stamped with a big orange paw print (no numbers or words)',
  accuracyNote: 'A wall calendar of today with a plain header and blank squares; the paw print is Hoya marking a day. No number or word.',
  nodes: [
    { t: 'path', d: 'M55 4 L30 20 M55 4 L80 20', stroke: 'text.secondary', sw: 'thin' },
    { t: 'circle', cx: 55, cy: 4, r: 3, fill: 'text.secondary' },
    { t: 'rect', x: 4, y: 18, w: 102, h: 110, r: 2, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 4, y: 18, w: 102, h: 18, r: 2, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M10 44 H100 V124 H10 Z M10 60 H100 M10 76 H100 M10 92 H100 M10 108 H100', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M23 44 V124 M36 44 V124 M49 44 V124 M62 44 V124 M75 44 V124 M88 44 V124', stroke: 'border.strong', sw: 'thin' },
    { t: 'ellipse', cx: 69, cy: 87, rx: 9, ry: 7.5, fill: 'theme.letters' },
    { t: 'path', d: 'M57 77 A3.5 4.5 0 1 0 64 77 A3.5 4.5 0 1 0 57 77 Z M64 72 A3.5 4.5 0 1 0 71 72 A3.5 4.5 0 1 0 64 72 Z M71 72 A3.5 4.5 0 1 0 78 72 A3.5 4.5 0 1 0 71 72 Z M77 78 A3.5 4.5 0 1 0 84 78 A3.5 4.5 0 1 0 77 78 Z', fill: 'theme.letters' },
  ],
};

export const BLANK_SHEET: ItemDef = {
  id: 'prop:blank-sheet',
  kind: 'object',
  box: { w: 36, h: 46 },
  z: 'mid',
  alt: 'A small blank sheet of paper',
  accuracyNote: 'A plain sheet with a folded corner, blank on purpose.',
  nodes: [
    { t: 'poly', pts: [[2, 2], [26, 2], [34, 10], [34, 44], [2, 44]], fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'poly', pts: [[26, 2], [26, 10], [34, 10]], fill: 'surface.sunken', stroke: 'border.strong', sw: 'thin' },
  ],
};

export const BLANK_TILES: ItemDef = {
  id: 'prop:blank-tiles',
  kind: 'symbol',
  box: { w: 160, h: 100 },
  z: 'mid',
  alt: 'Twenty-four blank tiles tossed in an arc, fourteen in one colour and ten in another',
  accuracyNote: 'Fourteen orange and ten blue blank tiles, for the 14 consonants and 10 vowels of the 24 basic letters in the story. No letter is drawn.',
  nodes: [
    { t: 'path', d: 'M7.5 82 H16.5 V91 H7.5 Z M11 60.5 H20 V69.5 H11 Z M14.5 50.5 H23.5 V59.5 H14.5 Z M24.5 32 H33.5 V41 H24.5 Z M37.5 17.5 H46.5 V26.5 H37.5 Z M45.5 12 H54.5 V21 H45.5 Z M62 5 H71 V14 H62 Z', fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M80 3.5 H89 V12.5 H80 Z M97.5 8 H106.5 V17 H97.5 Z M105.5 12 H114.5 V21 H105.5 Z M120.5 24.5 H129.5 V33.5 H120.5 Z M132 41 H141 V50 H132 Z M136.5 50.5 H145.5 V59.5 H136.5 Z M142 71 H151 V80 H142 Z', fill: 'theme.letters', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M9 71 H18 V80 H9 Z M19 41 H28 V50 H19 Z M30.5 24.5 H39.5 V33.5 H30.5 Z M53.5 8 H62.5 V17 H53.5 Z M71 3.5 H80 V12.5 H71 Z', fill: 'theme.crafts', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M89 5 H98 V14 H89 Z M113.5 17.5 H122.5 V26.5 H113.5 Z M126.5 32 H135.5 V41 H126.5 Z M140 60.5 H149 V69.5 H140 Z M143.5 82 H152.5 V91 H143.5 Z', fill: 'theme.crafts', stroke: 'text.primary', sw: 'thin' },
  ],
};

// --- PR 2.10c: science-art-life cluster -------------------------------------

export const DISPLAY_CASE: ItemDef = {
  id: 'prop:display-case',
  kind: 'furniture',
  box: { w: 110, h: 150 },
  z: 'back',
  alt: 'An empty glass museum case on a white plinth under soft light',
  accuracyNote: 'A generic display case drawn behind the object a scene stands on its plinth (50 units above the anchor at scale 1). No label.',
  nodes: [
    { t: 'poly', pts: [[38, 10], [72, 10], [98, 100], [12, 100]], fill: 'feedback.nudgeLight', o: 0.35 },
    { t: 'rect', x: 10, y: 14, w: 90, h: 86, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'base', o: 0.2 },
    { t: 'path', d: 'M8 10 H102 V15 H8 Z M6 100 H104 V107 H6 Z', fill: 'text.secondary' },
    { t: 'line', x1: 18, y1: 24, x2: 28, y2: 36, stroke: 'surface.paper', sw: 'thick', det: true },
    { t: 'rect', x: 12, y: 107, w: 86, h: 43, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
  ],
};

export const DRUM: ItemDef = {
  id: 'prop:drum',
  kind: 'object',
  box: { w: 70, h: 56 },
  z: 'mid',
  alt: 'A round barrel drum (buk) resting on its side',
  accuracyNote: 'A generic Korean barrel drum (buk): wooden body, skin head and a row of tacks; no particular paint or pattern.',
  nodes: [
    { t: 'path', d: 'M10 8 Q35 2 60 8 V48 Q35 54 10 48 Z', fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'ellipse', cx: 10, cy: 28, rx: 6, ry: 20, fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'ellipse', cx: 60, cy: 28, rx: 8, ry: 20, fill: 'surface.sunken', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M18 7 V9 M26 5.5 V7.5 M34 5 V7 M42 5 V7 M50 6 V8 M18 48 V50 M26 49.5 V51.5 M34 50 V52 M42 50 V52 M50 49 V51', stroke: 'surface.paper', sw: 'base', det: true },
  ],
};

export const BASKET: ItemDef = {
  id: 'prop:basket',
  kind: 'object',
  box: { w: 70, h: 50 },
  z: 'mid',
  tintable: 'theme.nature',
  alt: 'A woven basket heaped with fresh greens',
  accuracyNote: 'A generic woven basket; the heap on top is tintable (herbs, greens, vegetables).',
  nodes: [
    { t: 'path', d: 'M10 18 Q16 4 28 11 Q36 0 46 9 Q56 3 62 18 Z', fill: 'theme.nature', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M6 20 L64 20 L56 48 L14 48 Z', fill: 'feedback.nudge', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 4, y: 17, w: 62, h: 5, fill: 'text.secondary' },
    { t: 'path', d: 'M8 29 H62 M10.5 38 H59.5', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

export const TAFFY_TRAY: ItemDef = {
  id: 'prop:taffy-tray',
  kind: 'object',
  box: { w: 56, h: 22 },
  z: 'mid',
  alt: 'A wooden tray of taffy (yeot) sticks',
  accuracyNote: "A plain tray of pale taffy sticks for the seller in Kim Hongdo's Ssireum; his tray is not described, so it is generic.",
  nodes: [
    { t: 'path', d: 'M6 6 H50 M6 10 H50 M6 14 H50', stroke: 'feedback.nudgeLight', sw: 'thick' },
    { t: 'path', d: 'M2 4 V18 H54 V4 M2 20 H54', stroke: 'text.secondary', sw: 'thick' },
  ],
};

export const SHOES: ItemDef = {
  id: 'prop:shoes',
  kind: 'object',
  box: { w: 40, h: 14 },
  z: 'mid',
  alt: 'A pair of shoes taken off and left on the ground',
  accuracyNote: "Plain low shoes, after those left at the right edge of Kim Hongdo's Ssireum; material not described.",
  nodes: [
    { t: 'path', d: 'M2 12 Q2 6 8 6 L18 7 Q21 12 17 13 L4 13 Z M20 10 Q20 4 26 4 L36 5 Q39 10 35 11 L22 11 Z', fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
  ],
};

export const PANOKSEON: ItemDef = {
  id: 'prop:panokseon',
  kind: 'object',
  box: { w: 170, h: 90 },
  z: 'mid',
  tags: { heritage: true },
  alt: 'A Joseon panokseon warship: a flat-bottomed hull, a two-storey plank deckhouse, oars and a command pavilion',
  sourceRef: { title: '판옥선', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0059680', accessed: '2026-10-11' },
  accuracyNote:
    'After the entry: a thick flat-bottomed hull under a plank-roofed deckhouse with shield parapets, oars below it and a two-storey command pavilion. The entry names no masts, so none are drawn; no guns, flags or crew.',
  nodes: [
    { t: 'path', d: 'M4 54 L166 54 L152 80 L18 80 Z', fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M30 56 L22 88 M48 56 L40 88 M66 56 L58 88 M104 56 L96 88 M122 56 L114 88 M140 56 L132 88', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M16 36 H154 V54 H16 Z M70 16 H100 V28 H70 Z M78 6 H92 V14 H78 Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 20, y: 28, w: 130, h: 8, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M36 28 V36 M52 28 V36 M68 28 V36 M102 28 V36 M118 28 V36 M134 28 V36 M16 45 H154', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'path', d: 'M62 18 Q85 10 108 18 L104 20 L66 20 Z M72 8 Q85 1 98 8 Z', fill: 'text.primary' },
  ],
};
