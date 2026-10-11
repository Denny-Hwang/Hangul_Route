/**
 * Science instruments (F-STORY-002 §3.9.4, PR 2.10c, science-art-life
 * cluster): the rain gauge, the sundial and the water clock. Each heritage
 * instrument cites the page it was drawn from and says what is simplified.
 * No inscription, number or letter is drawn on any of them.
 */
import type { ItemDef } from '../types';

const ACCESSED = '2026-10-11';
const ENCYKOREA = '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)';
const JAGYEONGNU_REF = { title: '자격루', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0047854', accessed: ACCESSED } as const;

export const RAIN_GAUGE: ItemDef = {
  id: 'prop:rain-gauge',
  kind: 'object',
  box: { w: 60, h: 110 },
  z: 'mid',
  tintable: 'text.secondary',
  tags: { heritage: true },
  alt: 'A Joseon rain gauge: a plain metal cylinder on a square stone stand',
  sourceRef: { title: '공주 충청감영 측우기', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0007902', accessed: ACCESSED },
  accuracyNote:
    'After the one survivor, the 1837 Gongju gauge: a bronze cylinder about 32 cm tall on a square stone. Its three joined sections and inscription are left out so it can stand for earlier gauges. Body tintable (pottery).',
  nodes: [
    { t: 'path', d: 'M4 66 H56 V108 H4 Z M1 60 H59 V67 H1 Z', fill: 'border.strong', stroke: 'text.primary', sw: 'base' },
    { t: 'rect', x: 15, y: 8, w: 30, h: 52, fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'ellipse', cx: 30, cy: 8, rx: 15, ry: 4, fill: 'text.primary' },
    { t: 'line', x1: 21, y1: 16, x2: 21, y2: 54, stroke: 'surface.paper', sw: 'base', o: 0.35, det: true },
  ],
};

export const RULER: ItemDef = {
  id: 'prop:ruler',
  kind: 'object',
  box: { w: 8, h: 72 },
  z: 'mid',
  alt: 'A slim measuring stick with tick marks',
  accuracyNote: 'The 1442 record names a standard ruler for measuring rain; drawn as a plain stick with even ticks, no units.',
  nodes: [
    { t: 'rect', x: 2, y: 0, w: 4, h: 72, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M2 50 H5 M2 58 H5 M2 66 H5', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

export const SUNDIAL: ItemDef = {
  id: 'prop:sundial',
  kind: 'object',
  box: { w: 100, h: 80 },
  z: 'mid',
  tags: { heritage: true },
  alt: 'A Joseon bowl-shaped sundial on four legs and a cross-shaped base, with a pointer inside',
  sourceRef: { title: '앙부일구', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0035191', accessed: ACCESSED },
  accuracyNote:
    'After the entry: a hollow bronze hemisphere on four legs over a cross-shaped water base, a pointer inside, season and hour lines (counts cut down) and the pointer shadow. No characters or pictures.',
  nodes: [
    { t: 'path', d: 'M6 72 H94 V77 H6 Z M43 64 H57 L61 80 H39 Z', fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M26 54 L18 74 M74 54 L82 74 M40 60 L37 70 M60 60 L63 70', stroke: 'text.primary', sw: 'thick' },
    { t: 'path', d: 'M6 30 Q8 62 50 62 Q92 62 94 30 Z', fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'ellipse', cx: 50, cy: 30, rx: 46, ry: 13, fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'ellipse', cx: 50, cy: 31, rx: 38, ry: 9.5, fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M18 31 Q50 40 82 31', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M24 27 Q50 34 76 27 M36 23 Q35 31 38 39.5 M64 23 Q65 31 62 39.5', stroke: 'text.secondary', sw: 'thin', det: true },
    { t: 'line', x1: 50, y1: 33, x2: 66, y2: 37, stroke: 'text.primary', sw: 'thick', o: 0.6 },
    { t: 'line', x1: 50, y1: 18, x2: 50, y2: 33, stroke: 'text.primary', sw: 'base' },
  ],
};

export const ZODIAC_RING: ItemDef = {
  id: 'prop:zodiac-ring',
  kind: 'symbol',
  box: { w: 200, h: 126 },
  z: 'mid',
  alt: 'The twelve zodiac animals in a ring, from the rat at the top round to the pig',
  accuracyNote: "Sejong's sundial showed the hours as the twelve zodiac animals (encykorea, angbuilgu entry). Each is a round head with one sign (ears, horns, comb, snout, mane, tail) in clock order; faces blank, the tiger gold.",
  nodes: [
    { t: 'path', d: 'M90 32 A10 10 0 1 0 110 32 A10 10 0 1 0 90 32 Z M131 37.5 A10 10 0 1 0 151 37.5 A10 10 0 1 0 131 37.5 Z M172 72 A10 10 0 1 0 192 72 A10 10 0 1 0 172 72 Z M161 92 A10 10 0 1 0 181 92 A10 10 0 1 0 161 92 Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M131 106.5 A10 10 0 1 0 151 106.5 A10 10 0 1 0 131 106.5 Z M90 112 A10 10 0 1 0 110 112 A10 10 0 1 0 90 112 Z M49 106.5 A10 10 0 1 0 69 106.5 A10 10 0 1 0 49 106.5 Z M19 92 A10 10 0 1 0 39 92 A10 10 0 1 0 19 92 Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M8 72 A10 10 0 1 0 28 72 A10 10 0 1 0 8 72 Z M19 52 A10 10 0 1 0 39 52 A10 10 0 1 0 19 52 Z M49 37.5 A10 10 0 1 0 69 37.5 A10 10 0 1 0 49 37.5 Z', fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M91 27 Q88 20 96 22 M109 27 Q112 20 104 22 M133 30.5 Q127 28.5 129 22.5 M149 30.5 Q155 28.5 153 22.5 M178 63 L176 51 M186 63 L188 51 M166 83 L163 74 L160 76 M176 83 L179 74 L182 76 M150 111.5 Q158 114.5 154 120.5 Q147 122.5 144 116.5', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M94 104 L93 98 M99 102 Q106 96 111 106 M51 100.5 Q43 99.5 47 108.5 M67 100.5 Q75 99.5 71 108.5 M19 89 Q13 92 19 96 M39 89 Q45 92 39 96 M14 63 Q15 57 18 61 Q20 56 22 62 M28 72 L32 74 L28 76 M22 44 Q16 46 18 54 M36 44 Q42 46 40 54', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M56 39.5 H62 V43.5 H56 Z M51 30.5 L49 24.5 L55 28.5 M67 30.5 L69 24.5 L63 28.5', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M162 46 Q159 39 167 42 Z M180 46 Q183 39 175 42 Z M161 52 A10 10 0 1 0 181 52 A10 10 0 1 0 161 52 Z', fill: 'feedback.nudge', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M167 42 L169 47 M175 42 L173 47 M161 52 L165 53 M181 52 L177 53', stroke: 'text.primary', sw: 'base' },
  ],
};

export const BRONZE_JAR: ItemDef = {
  id: 'prop:bronze-jar',
  kind: 'object',
  box: { w: 90, h: 96 },
  z: 'mid',
  tags: { heritage: true },
  alt: 'A large Joseon bronze water-clock jar on a low wooden stand',
  sourceRef: JAGYEONGNU_REF,
  accuracyNote:
    'After the bronze supply jar of the 1536 water clock (jar-shaped, about 94 cm wide). Surface detail is left out and the stand is generic; the lost pipes are not drawn (prop:water-stream adds water).',
  nodes: [
    { t: 'path', d: 'M14 82 L10 96 M76 82 L80 96', stroke: 'text.primary', sw: 'thick' },
    { t: 'rect', x: 8, y: 76, w: 74, h: 7, fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M28 10 H62 V18 H66 Q86 28 84 50 Q80 76 45 76 Q10 76 6 50 Q4 28 24 18 H28 Z', fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'ellipse', cx: 45, cy: 10, rx: 17, ry: 3.5, fill: 'text.primary' },
    { t: 'path', d: 'M10 40 Q45 48 80 40', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'path', d: 'M22 30 Q16 44 22 60', stroke: 'surface.paper', sw: 'base', o: 0.35, det: true },
  ],
};

export const FLOAT_VESSEL: ItemDef = {
  id: 'prop:float-vessel',
  kind: 'object',
  box: { w: 40, h: 150 },
  z: 'mid',
  tags: { heritage: true },
  alt: 'A tall Joseon bronze water-clock cylinder with a marked rod rising out of its top',
  sourceRef: JAGYEONGNU_REF,
  accuracyNote: 'After the bronze receiving cylinders of the 1536 clock (about 196 cm tall); inflowing water lifts a float rod. The undescribed dragon pattern is left out; the rod has plain ticks.',
  nodes: [
    { t: 'rect', x: 17, y: 2, w: 6, h: 32, fill: 'surface.paper', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M17 9 H23 M17 16 H23 M17 23 H23', stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'rect', x: 8, y: 30, w: 24, h: 116, fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'ellipse', cx: 20, cy: 30, rx: 12, ry: 3, fill: 'text.primary' },
    { t: 'path', d: 'M8 60 H32 M8 120 H32', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 4, y: 144, w: 32, h: 6, fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
  ],
};

export const WATER_STREAM: ItemDef = {
  id: 'prop:water-stream',
  kind: 'symbol',
  box: { w: 40, h: 56 },
  z: 'mid',
  alt: 'A pipe pouring a thin stream of water drop by drop',
  accuracyNote: 'A sign for water flowing between vessels: a short pipe, a thin stream and drops. Not from any surviving part.',
  nodes: [
    { t: 'path', d: 'M2 6 H24 Q32 6 32 14 V20', stroke: 'text.secondary', sw: 'thick' },
    { t: 'line', x1: 32, y1: 22, x2: 32, y2: 36, stroke: 'brand.secondary', sw: 'base' },
    { t: 'path', d: 'M32 40 Q35 44 32 46 Q29 44 32 40 Z M32 48 Q34.5 51.5 32 53 Q29.5 51.5 32 48 Z', fill: 'brand.secondary' },
  ],
};

export const STRIKING_FIGURES: ItemDef = {
  id: 'prop:striking-figures',
  kind: 'object',
  box: { w: 150, h: 110 },
  z: 'mid',
  tags: { heritage: true },
  alt: 'Three small wooden figures of a Joseon water clock striking a bell, a drum and a gong, metal balls on a chute behind',
  sourceRef: JAGYEONGNU_REF,
  accuracyNote:
    "From the entry's account of Sejong's lost clock: rising floats set iron balls rolling and three wooden figures strike a bell (hours), a drum and a gong (night watches). A simple diagram; the twelve zodiac figures are left out.",
  nodes: [
    { t: 'line', x1: 6, y1: 22, x2: 144, y2: 40, stroke: 'border.strong', sw: 'thick' },
    { t: 'path', d: 'M40 23.5 A4 4 0 1 0 48 24.5 A4 4 0 1 0 40 23.5 Z M80 29 A4 4 0 1 0 88 30 A4 4 0 1 0 80 29 Z M118 34 A4 4 0 1 0 126 35 A4 4 0 1 0 118 34 Z M8 72 Q8 58 14 58 Q20 58 20 72 Z M94 66 A10 10 0 1 0 114 66 A10 10 0 1 0 94 66 Z', fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M4 92 V48 H146 V92 M14 48 V58 M104 48 V56 M50 68 H66 M50 82 H66 M33 72 L20 66 M79 72 L67 74 M127 72 L114 68', stroke: 'text.primary', sw: 'base' },
    { t: 'rect', x: 50, y: 64, w: 16, h: 22, r: 4, fill: 'border.strong', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M30 92 H44 L41 66 H33 Z M76 92 H90 L87 66 H79 Z M124 92 H138 L135 66 H127 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M32 60 A5 5 0 1 0 42 60 A5 5 0 1 0 32 60 Z M78 60 A5 5 0 1 0 88 60 A5 5 0 1 0 78 60 Z M126 60 A5 5 0 1 0 136 60 A5 5 0 1 0 126 60 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'circle', cx: 104, cy: 66, r: 4, stroke: 'text.primary', sw: 'thin', det: true },
    { t: 'path', d: 'M2 92 H148 V102 H2 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M10 102 V110 M140 102 V110', stroke: 'text.secondary', sw: 'thick', det: true },
  ],
};

export const BRONZE_MIRROR: ItemDef = {
  id: 'prop:bronze-mirror',
  kind: 'object',
  box: { w: 50, h: 64 },
  z: 'mid',
  alt: 'A round bronze mirror on a small stand, softly reflecting light',
  accuracyNote: "A generic round bronze mirror on a stand, for the 'treasured mirror' (bogam) of the title; not a museum piece.",
  nodes: [
    { t: 'path', d: 'M14 64 L25 46 L36 64 Z', fill: 'text.primary' },
    { t: 'circle', cx: 25, cy: 25, r: 23, fill: 'text.secondary', stroke: 'text.primary', sw: 'base' },
    { t: 'circle', cx: 25, cy: 25, r: 17, fill: 'feedback.nudgeLight' },
    { t: 'path', d: 'M15 22 Q18 14 26 12', stroke: 'surface.paper', sw: 'thick' },
    { t: 'path', d: 'M44 8 L48 4 M46 14 H50 M40 4 L42 0', stroke: 'text.secondary', sw: 'base', det: true },
  ],
};
