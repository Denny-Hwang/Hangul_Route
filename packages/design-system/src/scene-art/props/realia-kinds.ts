/**
 * The dressings of the eight realia kinds of F-CURR-002 row CM-47 (design/screens/minigame-realia-read/README.md,
 * "Drawn parts" and D9-D12): a recipe card's bowl and utensils, a receipt's torn edge, a food label's box and jar, a
 * forecast card's sky, a calendar page's rings, a timetable's clock, a park map and a poster's bunting. Flat shapes
 * in token colours, no text, no logo, no shop, brand, company, product or real place: every word of a realia is
 * live text laid out by `RealiaKindSheet` around these drawings (scene-art style guide section 3.7).
 *
 * They are kept out of `REALIA_PROPS` (and so out of `REALIA_REGISTRY` and the start bundle): only the lazy realia
 * kinds chunk and the presenter draw them, through `REALIA_KIND_REGISTRY`.
 *
 * The strips that stretch to the sheet (the receipt edge, the map, the bunting) are 400 units wide and drawn so a
 * stretch keeps them reading right; the others keep their aspect ratio.
 */
import type { ItemDef } from '../types';

export const REALIA_RECIPE_BOWL: ItemDef = {
  id: 'prop:realia-recipe-bowl',
  kind: 'object',
  box: { w: 136, h: 40 },
  z: 'mid',
  alt: 'A rice bowl with a spoon and chopsticks above a recipe card',
  accuracyNote:
    'A generic bowl of rice beside a spoon and a pair of chopsticks, the table set of an everyday meal. No dish, brand, maker or recipe source is drawn; the recipe words are live text below it.',
  nodes: [
    { t: 'path', d: 'M28 18 H88 Q86 38 58 38 Q30 38 28 18 Z', fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M32 18 Q58 4 84 18 Z', fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'ellipse', cx: 104, cy: 12, rx: 6, ry: 8, fill: 'text.secondary' },
    { t: 'rect', x: 102.5, y: 18, w: 3, h: 20, r: 1.5, fill: 'text.secondary' },
    { t: 'line', x1: 116, y1: 4, x2: 120, y2: 38, stroke: 'text.secondary', sw: 'base' },
    { t: 'line', x1: 124, y1: 4, x2: 126, y2: 38, stroke: 'text.secondary', sw: 'base' },
  ],
};

export const REALIA_RECEIPT_EDGE: ItemDef = {
  id: 'prop:realia-receipt-edge',
  kind: 'object',
  box: { w: 400, h: 16 },
  z: 'front',
  alt: 'The torn zigzag edge at the bottom of a paper receipt',
  accuracyNote: 'The torn bottom edge of a plain paper slip, drawn as a zigzag. No shop, total, barcode, logo or company layout is drawn.',
  nodes: [{ t: 'path', d: 'M0 0 V4 L40 16 L80 4 L120 16 L160 4 L200 16 L240 4 L280 16 L320 4 L360 16 L400 4 V0', fill: 'surface.paper', stroke: 'border.strong', sw: 'base' }],
};

export const REALIA_LABEL_PACK: ItemDef = {
  id: 'prop:realia-label-pack',
  kind: 'object',
  box: { w: 136, h: 40 },
  z: 'mid',
  alt: 'A small food box and a jar, each with a blank label',
  accuracyNote:
    'Generic packaged food: a plain box and a jar with a lid, each with a blank label patch. No brand, product name, logo, barcode or nutrition panel is drawn; the label words are live text below it.',
  nodes: [
    { t: 'rect', x: 24, y: 10, w: 44, h: 28, r: 2, fill: 'theme.crafts', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 30, y: 18, w: 32, h: 12, r: 1, fill: 'surface.paper' },
    { t: 'rect', x: 80, y: 12, w: 32, h: 26, r: 6, fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 82, y: 4, w: 28, h: 8, r: 2, fill: 'theme.nature', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 86, y: 20, w: 20, h: 10, r: 1, fill: 'theme.life' },
  ],
};

export const REALIA_FORECAST_SKY: ItemDef = {
  id: 'prop:realia-forecast-sky',
  kind: 'nature',
  box: { w: 136, h: 40 },
  z: 'back',
  alt: 'A sun beside a rain cloud along the top of a weather card',
  accuracyNote:
    'A generic sun and a cloud with three rain lines, the plain symbols of a weather card. Not any weather service’s icons, map or layout; every forecast word is live text below it.',
  nodes: [
    { t: 'circle', cx: 24, cy: 20, r: 10, fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M24 4 V7 M24 33 V36 M8 20 H11 M37 20 H40 M13 9 L15 11 M33 29 L35 31 M13 31 L15 29 M33 11 L35 9', stroke: 'theme.life', sw: 'base' },
    { t: 'path', d: 'M62 30 Q54 30 54 23 Q54 16 62 16 Q65 8 74 8 Q83 8 86 16 Q94 16 94 23 Q94 30 86 30 Z', fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M66 33 L64 38 M76 33 L74 38 M86 33 L84 38', stroke: 'brand.secondary', sw: 'base' },
  ],
};

export const REALIA_CALENDAR_RINGS: ItemDef = {
  id: 'prop:realia-calendar-rings',
  kind: 'object',
  box: { w: 400, h: 40 },
  z: 'mid',
  alt: 'The bound top of a wall calendar with two rings',
  accuracyNote: 'The top bar of a plain wall calendar with two binder rings through it. No month, date, holiday mark, brand or picture is drawn; the dates are live text below it.',
  nodes: [
    { t: 'rect', x: 0, y: 16, w: 400, h: 24, r: 4, fill: 'theme.rites', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 96, y: 2, w: 10, h: 26, r: 5, fill: 'surface.sunken', stroke: 'border.shape', sw: 'base' },
    { t: 'rect', x: 294, y: 2, w: 10, h: 26, r: 5, fill: 'surface.sunken', stroke: 'border.shape', sw: 'base' },
    { t: 'circle', cx: 101, cy: 33, r: 3, fill: 'text.secondary' },
    { t: 'circle', cx: 299, cy: 33, r: 3, fill: 'text.secondary' },
  ],
};

export const REALIA_TIMETABLE_CLOCK: ItemDef = {
  id: 'prop:realia-timetable-clock',
  kind: 'symbol',
  box: { w: 136, h: 40 },
  z: 'mid',
  alt: 'A plain clock face at the top of a timetable',
  accuracyNote:
    'A generic round clock face with four hour marks and two hands, standing for a timetable or a station board. No station, line, company, train number or real time is drawn; the times are live text below it.',
  nodes: [
    { t: 'circle', cx: 22, cy: 20, r: 15, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M22 7 V10 M22 30 V33 M9 20 H12 M32 20 H35', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M22 20 V12 M22 20 H29', stroke: 'text.primary', sw: 'base' },
    { t: 'circle', cx: 22, cy: 20, r: 2, fill: 'text.primary' },
  ],
};

export const REALIA_MAP_PARK: ItemDef = {
  id: 'prop:realia-map-park',
  kind: 'nature',
  box: { w: 400, h: 96 },
  z: 'back',
  alt: 'A drawn park map with trails, trees, a lake and a small peak',
  accuracyNote:
    'A generic park map: green ground, two pale trails, three round trees, a lake and one pale peak. Not a particular park, national park or city map; no place name, route number or logo is drawn, and the places are live text below it.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 96, fill: 'theme.nature', o: 0.35 },
    { t: 'ellipse', cx: 290, cy: 60, rx: 50, ry: 20, fill: 'brand.secondaryLight', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M0 80 Q100 70 160 48 Q220 26 400 30', stroke: 'surface.paper', sw: 'thick' },
    { t: 'path', d: 'M160 48 Q170 70 200 96', stroke: 'surface.paper', sw: 'thick' },
    { t: 'ellipse', cx: 60, cy: 36, rx: 16, ry: 14, fill: 'theme.nature', stroke: 'border.shape', sw: 'thin' },
    { t: 'ellipse', cx: 96, cy: 24, rx: 12, ry: 11, fill: 'theme.nature', stroke: 'border.shape', sw: 'thin' },
    { t: 'ellipse', cx: 364, cy: 78, rx: 14, ry: 12, fill: 'theme.nature', stroke: 'border.shape', sw: 'thin' },
    { t: 'poly', pts: [[300, 26], [338, 4], [376, 26]], fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
  ],
};

export const REALIA_POSTER_BUNTING: ItemDef = {
  id: 'prop:realia-poster-bunting',
  kind: 'symbol',
  box: { w: 400, h: 40 },
  z: 'front',
  alt: 'A string of five small flags along the top of a poster',
  accuracyNote:
    'Generic festive bunting: five plain triangle flags on a string, in three soft colours. No event name, organiser, logo, national flag or slogan is drawn; the poster words are live text below it.',
  nodes: [
    { t: 'path', d: 'M0 6 Q200 18 400 6', stroke: 'text.secondary', sw: 'thin' },
    { t: 'poly', pts: [[24, 8], [56, 8], [40, 34]], fill: 'theme.rites', stroke: 'border.shape', sw: 'thin' },
    { t: 'poly', pts: [[104, 11], [136, 11], [120, 37]], fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'poly', pts: [[184, 12], [216, 12], [200, 38]], fill: 'theme.nature', stroke: 'border.shape', sw: 'thin' },
    { t: 'poly', pts: [[264, 11], [296, 11], [280, 37]], fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'poly', pts: [[344, 8], [376, 8], [360, 34]], fill: 'theme.rites', stroke: 'border.shape', sw: 'thin' },
  ],
};

/** The CM-47 batch, in the order of `REALIA_KINDS` (content-schema) and of the README table. */
export const REALIA_KIND_PROPS: readonly ItemDef[] = [
  REALIA_RECIPE_BOWL,
  REALIA_RECEIPT_EDGE,
  REALIA_LABEL_PACK,
  REALIA_FORECAST_SKY,
  REALIA_CALENDAR_RINGS,
  REALIA_TIMETABLE_CLOCK,
  REALIA_MAP_PARK,
  REALIA_POSTER_BUNTING,
];
