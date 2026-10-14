/**
 * Realia dressings (F-CURR-001 row G-2; design/screens/minigame-realia-read/, README "Drawn parts").
 * The drawn half of a realia: the board's awning and counter, the ticket's train band and stub,
 * the trail sign's mountains and post foot, the goods above a price card. Flat shapes in token
 * colours, no text, no logo, no shop, brand or company: every word of a realia is live text laid
 * out by `RealiaSheet` inside these drawings (scene-art style guide section 3.7).
 *
 * The strips (awning, counter, mountains, post foot) are 400 units wide and stretch to the sheet;
 * the train band, the stub and the goods keep their aspect ratio.
 */
import type { ItemDef } from '../types';

export const REALIA_AWNING: ItemDef = {
  id: 'prop:realia-awning',
  kind: 'object',
  box: { w: 400, h: 40 },
  z: 'mid',
  alt: 'A striped awning over a snack-bar menu board',
  accuracyNote:
    'A generic striped shop awning in two plain stripes, the kind over a street snack stall. No shop name, sign, brand or logo is drawn; the menu words are live text below it.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 8, r: 3, fill: 'text.secondary' },
    { t: 'path', d: 'M0 8 H50 V30 Q25 40 0 30 Z', fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M50 8 H100 V30 Q75 40 50 30 Z', fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M100 8 H150 V30 Q125 40 100 30 Z', fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M150 8 H200 V30 Q175 40 150 30 Z', fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M200 8 H250 V30 Q225 40 200 30 Z', fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M250 8 H300 V30 Q275 40 250 30 Z', fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M300 8 H350 V30 Q325 40 300 30 Z', fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M350 8 H400 V30 Q375 40 350 30 Z', fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
  ],
};

export const REALIA_COUNTER: ItemDef = {
  id: 'prop:realia-counter',
  kind: 'furniture',
  box: { w: 400, h: 32 },
  z: 'mid',
  alt: 'The front of a snack-bar counter under the menu board',
  accuracyNote: 'A plain counter front with two posts, standing for a street snack stall. Generic; no shop, brand or price is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 8, r: 3, fill: 'text.secondary' },
    { t: 'rect', x: 12, y: 8, w: 376, h: 24, fill: 'theme.life', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 40, y: 8, w: 6, h: 24, fill: 'text.secondary' },
    { t: 'rect', x: 354, y: 8, w: 6, h: 24, fill: 'text.secondary' },
  ],
};

export const REALIA_TRAIN_BAND: ItemDef = {
  id: 'prop:realia-train-band',
  kind: 'symbol',
  box: { w: 136, h: 40 },
  z: 'mid',
  alt: 'A small drawn train on a rail along the top of a ticket',
  accuracyNote:
    'A generic passenger train symbol: one carriage with four windows on a rail. Not any rail company’s train, livery, logo or ticket design; no train number, fare or company name is drawn.',
  nodes: [
    { t: 'line', x1: 12, y1: 33, x2: 132, y2: 33, stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 20, y: 10, w: 96, h: 18, r: 6, fill: 'brand.secondary', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 28, y: 14, w: 12, h: 7, r: 2, fill: 'surface.paper' },
    { t: 'rect', x: 46, y: 14, w: 12, h: 7, r: 2, fill: 'surface.paper' },
    { t: 'rect', x: 64, y: 14, w: 12, h: 7, r: 2, fill: 'surface.paper' },
    { t: 'rect', x: 82, y: 14, w: 12, h: 7, r: 2, fill: 'surface.paper' },
    { t: 'path', d: 'M100 14 H110 Q114 14 114 18 V21 H100 Z', fill: 'surface.paper' },
    { t: 'circle', cx: 36, cy: 30, r: 3, fill: 'text.secondary' },
    { t: 'circle', cx: 60, cy: 30, r: 3, fill: 'text.secondary' },
    { t: 'circle', cx: 84, cy: 30, r: 3, fill: 'text.secondary' },
    { t: 'circle', cx: 104, cy: 30, r: 3, fill: 'text.secondary' },
  ],
};

export const REALIA_TICKET_STUB: ItemDef = {
  id: 'prop:realia-ticket-stub',
  kind: 'object',
  box: { w: 64, h: 120 },
  z: 'mid',
  alt: 'The tear-off stub of a ticket with a punched hole and plain marks',
  accuracyNote: 'A generic ticket stub after a dotted cut: a punched hole and three plain bars that stand for print. No words, numbers, barcode or company layout.',
  nodes: [
    { t: 'circle', cx: 32, cy: 24, r: 8, fill: 'surface.canvas', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M18 52 H46 M18 64 H46 M18 76 H38', stroke: 'border.strong', sw: 'thick' },
  ],
};

export const REALIA_MOUNTAINS: ItemDef = {
  id: 'prop:realia-mountains',
  kind: 'nature',
  box: { w: 400, h: 40 },
  z: 'back',
  alt: 'A green mountain ridge with a pale peak above a trail sign',
  accuracyNote: 'A generic mountain ridge with one pale peak, standing for a hiking trail. Not a particular mountain or national park.',
  nodes: [
    { t: 'poly', pts: [[0, 40], [70, 8], [130, 30], [200, 2], [270, 28], [330, 10], [400, 40]], fill: 'theme.nature', stroke: 'border.shape', sw: 'thin' },
    { t: 'poly', pts: [[186, 9], [200, 2], [214, 9], [207, 12], [200, 8], [193, 12]], fill: 'surface.paper' },
  ],
};

export const REALIA_POST_FOOT: ItemDef = {
  id: 'prop:realia-post-foot',
  kind: 'nature',
  box: { w: 400, h: 32 },
  z: 'front',
  alt: 'The foot of a wooden sign post in grass with two stones',
  accuracyNote: 'The bottom of a plain wooden trail-sign post standing in a patch of grass between two stones. Generic.',
  nodes: [
    { t: 'rect', x: 194, y: 0, w: 12, h: 24, r: 2, fill: 'text.secondary' },
    { t: 'ellipse', cx: 200, cy: 26, rx: 120, ry: 5, fill: 'theme.nature', o: 0.6 },
    { t: 'ellipse', cx: 150, cy: 24, rx: 14, ry: 6, fill: 'surface.sunken', stroke: 'border.shape', sw: 'thin' },
    { t: 'ellipse', cx: 256, cy: 25, rx: 10, ry: 5, fill: 'surface.sunken', stroke: 'border.shape', sw: 'thin' },
  ],
};

export const REALIA_GOODS_APPLES: ItemDef = {
  id: 'prop:realia-goods-apples',
  kind: 'object',
  box: { w: 120, h: 56 },
  z: 'mid',
  alt: 'Three apples in a woven basket on a market stall',
  accuracyNote: 'Generic goods for a market price card: three red-orange apples with a leaf in a plain basket. No brand, label or price is drawn.',
  nodes: [
    { t: 'path', d: 'M22 30 H98 L90 54 H30 Z', fill: 'text.secondary', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M34 38 H86 M38 46 H82', stroke: 'surface.sunken', sw: 'thin' },
    { t: 'circle', cx: 44, cy: 24, r: 10, fill: 'theme.letters', stroke: 'border.shape', sw: 'thin' },
    { t: 'circle', cx: 62, cy: 20, r: 10, fill: 'theme.letters', stroke: 'border.shape', sw: 'thin' },
    { t: 'circle', cx: 80, cy: 24, r: 10, fill: 'theme.letters', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M62 10 Q66 4 72 6 Q68 11 62 10 Z', fill: 'theme.nature' },
  ],
};

export const REALIA_GOODS_FAN: ItemDef = {
  id: 'prop:realia-goods-fan',
  kind: 'object',
  box: { w: 120, h: 56 },
  z: 'mid',
  alt: 'An open folding fan on a market stall',
  accuracyNote:
    'A generic open folding fan in one plain colour with paper ribs, sold at a market craft stall. No painted motif, maker’s mark or inscription is drawn, so it copies no museum piece.',
  nodes: [
    { t: 'path', d: 'M60 52 L22 22 A48 48 0 0 1 98 22 Z', fill: 'theme.crafts', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M60 52 L32 14 M60 52 L46 8 M60 52 L60 6 M60 52 L74 8 M60 52 L88 14', stroke: 'surface.paper', sw: 'thin' },
    { t: 'path', d: 'M60 52 L36 33 A30 30 0 0 1 84 33 Z', fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 56, y: 48, w: 8, h: 8, r: 2, fill: 'text.secondary' },
  ],
};

export const REALIA_GOODS_HANJI: ItemDef = {
  id: 'prop:realia-goods-hanji',
  kind: 'object',
  box: { w: 120, h: 56 },
  z: 'mid',
  alt: 'A small stack of sheets of paper in three soft colours',
  accuracyNote: 'A generic stack of three sheets of handmade paper in soft colours, with a faint fibre line on the top sheet. No maker, brand or label is drawn.',
  nodes: [
    { t: 'rect', x: 26, y: 34, w: 68, h: 18, r: 2, fill: 'brand.primaryLight', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 22, y: 24, w: 68, h: 14, r: 2, fill: 'feedback.nudgeLight', stroke: 'border.shape', sw: 'thin' },
    { t: 'rect', x: 30, y: 12, w: 68, h: 16, r: 2, fill: 'surface.paper', stroke: 'border.shape', sw: 'thin' },
    { t: 'path', d: 'M40 20 Q48 16 56 20 M62 22 Q70 18 78 22', stroke: 'border.strong', sw: 'thin' },
  ],
};

/** The realia batch, in the order of the D-2 README table. */
export const REALIA_PROPS: readonly ItemDef[] = [
  REALIA_AWNING,
  REALIA_COUNTER,
  REALIA_TRAIN_BAND,
  REALIA_TICKET_STUB,
  REALIA_MOUNTAINS,
  REALIA_POST_FOOT,
  REALIA_GOODS_APPLES,
  REALIA_GOODS_FAN,
  REALIA_GOODS_HANJI,
];
