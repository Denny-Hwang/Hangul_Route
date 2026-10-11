/**
 * Book and box props (F-STORY-002 §3.9.4, PR 2.3b). Books are drawn closed:
 * covers are blank, stored books lie flat, and pages show only as edges,
 * never as text.
 */
import type { ItemDef, Shape } from '../types';

export const BOOK_THREAD_BOUND: ItemDef = {
  id: 'prop:book-thread-bound',
  kind: 'object',
  box: { w: 44, h: 60 },
  z: 'mid',
  alt: 'A closed Joseon thread-bound book with a blank cover, stitched with red thread',
  tags: { heritage: true },
  sourceRef: { title: '사침안정법 (四針眼訂法)', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0080104', accessed: '2026-10-11' },
  accuracyNote:
    'A closed book bound on its right edge with red thread through five holes, the Korean way the entry describes (four holes were the norm in China and Japan). The cover is pale yellow for the gardenia-dyed thick paper the entry names; its stamped pattern is left out. The title slip sits at the upper left and is blank, and the page block is one pale bar. No title, seal or inscription is drawn.',
  nodes: [
    { t: 'ellipse', cx: 22, cy: 58, rx: 21, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 2, y: 2, w: 40, h: 54, r: 1, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 5, y: 5, w: 28, h: 48, stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'rect', x: 8, y: 8, w: 9, h: 24, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M34 9 V51 M34 9 H42 M34 20 H42 M34 31 H42 M34 42 H42 M34 51 H42', stroke: 'brand.primary', sw: 'base' },
    { t: 'rect', x: 4, y: 56, w: 36, h: 2, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'line', x1: 8, y1: 57, x2: 36, y2: 57, stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const BOOKS_CASE: ItemDef = {
  id: 'prop:books-case',
  kind: 'object',
  box: { w: 120, h: 70 },
  z: 'mid',
  alt: 'An open wooden case holding stacks of old thread-bound books laid flat, red binding thread showing on their spines',
  tags: { heritage: true },
  sourceRef: { title: '포쇄(曝曬)', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0060156', accessed: '2026-10-11' },
  accuracyNote:
    'Thread-bound books have soft paper covers and were normally kept lying flat in stacks rather than stood on end like modern books; the entry has two sheets of paper laid between the books before each set was wrapped in oiled paper and red cloth and sealed in a wooden chest with herbs. Here the case is drawn open, with two shelves, and the wrapping is left off so the viewer can see the stored books. The bound edges face out, showing the red thread of the Korean five-hole binding. Volume counts and sizes are generic.',
  nodes: [
    { t: 'ellipse', cx: 60, cy: 68, rx: 58, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 0, y: 4, w: 120, h: 60, r: 3, fill: 'text.secondary' },
    { t: 'rect', x: 5, y: 9, w: 110, h: 24, fill: 'surface.sunken' },
    { t: 'rect', x: 5, y: 37, w: 110, h: 22, fill: 'surface.sunken' },
    // top shelf: three stacks of 4, 3 and 5 volumes
    { t: 'rect', x: 9, y: 17, w: 30, h: 16, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 45, y: 21, w: 30, h: 12, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 81, y: 13, w: 30, h: 20, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M9 21 H39 M9 25 H39 M9 29 H39 M45 25 H75 M45 29 H75 M81 17 H111 M81 21 H111 M81 25 H111 M81 29 H111', stroke: 'text.secondary', sw: 'base', o: 0.6 },
    { t: 'path', d: 'M14 17 V33 M19 17 V33 M24 17 V33 M29 17 V33 M34 17 V33 M50 21 V33 M55 21 V33 M60 21 V33 M65 21 V33 M70 21 V33 M86 13 V33 M91 13 V33 M96 13 V33 M101 13 V33 M106 13 V33', stroke: 'brand.primary', sw: 'thin' },
    // bottom shelf: three stacks of 5, 3 and 4 volumes
    { t: 'rect', x: 9, y: 39, w: 30, h: 20, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 45, y: 47, w: 30, h: 12, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 81, y: 43, w: 30, h: 16, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M9 43 H39 M9 47 H39 M9 51 H39 M9 55 H39 M45 51 H75 M45 55 H75 M81 47 H111 M81 51 H111 M81 55 H111', stroke: 'text.secondary', sw: 'base', o: 0.6 },
    { t: 'path', d: 'M14 39 V59 M19 39 V59 M24 39 V59 M29 39 V59 M34 39 V59 M50 47 V59 M55 47 V59 M60 47 V59 M65 47 V59 M70 47 V59 M86 43 V59 M91 43 V59 M96 43 V59 M101 43 V59 M106 43 V59', stroke: 'brand.primary', sw: 'thin' },
    { t: 'rect', x: 6, y: 64, w: 12, h: 4, r: 1, fill: 'text.secondary' },
    { t: 'rect', x: 102, y: 64, w: 12, h: 4, r: 1, fill: 'text.secondary' },
  ],
};

export const DOCUMENT_BOX: ItemDef = {
  id: 'prop:document-box',
  kind: 'object',
  box: { w: 64, h: 44 },
  z: 'mid',
  alt: 'A closed wooden document box tied with a red cord',
  accuracyNote:
    'A generic closed wooden box tied with a red cord, as the story brief describes. It is not a copy of any surviving chest or of the historians\' own draft boxes, whose exact look the sources do not show, so no inscription, seal or hardware beyond one plain plate is drawn.',
  nodes: [
    { t: 'ellipse', cx: 32, cy: 42, rx: 31, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 0, y: 12, w: 64, h: 30, r: 3, fill: 'text.primary' },
    { t: 'rect', x: 0, y: 4, w: 64, h: 12, r: 3, fill: 'text.secondary' },
    { t: 'line', x1: 4, y1: 24, x2: 60, y2: 24, stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'line', x1: 4, y1: 33, x2: 60, y2: 33, stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'path', d: 'M26 4 V42 M38 4 V42 M32 10 Q22 0 24 8 Q26 12 32 10 Q42 0 40 8 Q38 12 32 10', stroke: 'brand.primary', sw: 'base' },
    { t: 'rect', x: 28, y: 22, w: 8, h: 8, r: 1, fill: 'feedback.nudge' },
  ],
};

// --- PR 2.10a: records-joseon cluster -------------------------------------

const ENCYKOREA = '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)';
const BINDING_REF = { title: '사침안정법 (四針眼訂法)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0080104', accessed: '2026-10-11' } as const;
const POSWAE_REF = { title: '포쇄(曝曬)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0060156', accessed: '2026-10-11' } as const;

export const BOOKS_STACK: ItemDef = {
  id: 'prop:books-stack',
  kind: 'object',
  box: { w: 92, h: 60 },
  z: 'mid',
  alt: 'A stack of four old thread-bound books lying flat, red binding thread at their edges',
  tags: { heritage: true },
  sourceRef: BINDING_REF,
  accuracyNote:
    'Four closed thread-bound books lying flat, the way such soft-covered books were kept, seen from the side so their bound edges and red five-hole stitching show at the right. Covers are the pale yellow of the gardenia-dyed paper the entry names, and blank. Sizes and the number of volumes are generic; no title slip, seal or writing is drawn.',
  nodes: [
    { t: 'ellipse', cx: 46, cy: 58, rx: 44, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 4, y: 45, w: 82, h: 12, r: 1, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 8, y: 33, w: 80, h: 12, r: 1, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 2, y: 21, w: 82, h: 12, r: 1, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 7, y: 9, w: 78, h: 12, r: 1, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M8 51 H76 M12 39 H78 M6 27 H74 M11 15 H75', stroke: 'surface.paper', sw: 'base', det: true },
    { t: 'path', d: 'M80 46 V56 M84 46 V56 M82 34 V44 M86 34 V44 M78 22 V32 M82 22 V32 M79 10 V20 M83 10 V20', stroke: 'brand.primary', sw: 'base' },
  ],
};

export const BOOK_CHEST_OPEN: ItemDef = {
  id: 'prop:book-chest-open',
  kind: 'object',
  box: { w: 96, h: 74 },
  z: 'mid',
  alt: 'An open wooden chest holding books wrapped in red cloth, with small pouches of dried herbs tucked beside them',
  tags: { heritage: true },
  sourceRef: POSWAE_REF,
  accuracyNote:
    'The entry describes the Annals wrapped in oiled paper and then a red cloth wrapper (hongbo) and laid in a chest with the herbs cheongung and changpo against insects and rot; the National Archives adds that the chests were of linden wood. Here the lid stands open, two wrapped bundles show the red cloth (the oiled paper beneath is not visible) and the herbs are three small pale pouches. Chest size, hardware and the number of bundles are generic; the seal and any label are left out.',
  nodes: [
    { t: 'ellipse', cx: 48, cy: 72, rx: 46, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    // lid standing open behind
    { t: 'poly', pts: [[10, 30], [86, 30], [80, 4], [16, 4]], fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 6, y: 30, w: 84, h: 40, r: 2, fill: 'text.secondary', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 11, y: 30, w: 74, h: 10, fill: 'text.primary', o: 0.6 },
    // two bundles wrapped in red cloth, drawn as one shape
    { t: 'path', d: 'M14 26 Q14 22 18 22 L44 22 Q48 22 48 26 L48 38 L14 38 Z M50 24 Q50 20 54 20 L78 20 Q82 20 82 24 L82 38 L50 38 Z', fill: 'brand.primary', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M31 22 V38 M66 20 V38', stroke: 'text.primary', sw: 'thin', o: 0.35, det: true },
    // herb pouches
    { t: 'ellipse', cx: 20, cy: 40, rx: 6, ry: 4, fill: 'feedback.nudgeLight', stroke: 'text.primary', sw: 'thin' },
    { t: 'ellipse', cx: 49, cy: 41, rx: 5, ry: 3.5, fill: 'feedback.nudgeLight', stroke: 'text.primary', sw: 'thin' },
    { t: 'ellipse', cx: 76, cy: 40, rx: 6, ry: 4, fill: 'feedback.nudgeLight', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M10 54 H86', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 43, y: 46, w: 10, h: 8, r: 1, fill: 'border.strong' },
  ],
};

export const BOOKS_AIRING: ItemDef = {
  id: 'prop:books-airing',
  kind: 'object',
  box: { w: 150, h: 44 },
  z: 'mid',
  alt: 'Old books spread open on a straw mat to air',
  tags: { heritage: true },
  sourceRef: POSWAE_REF,
  accuracyNote:
    "Poswae, the airing of the stored Annals: the entry says the historian took the books out of the chest and aired them on a clear spring or autumn day, at the archive's airing hall, before dusting them and laying paper between the volumes. Here three volumes lie open on a straw mat, their pages shown only as faint rows of strokes (no text). Mat, number of books and their size are generic.",
  nodes: [
    { t: 'poly', pts: [[14, 16], [136, 16], [150, 42], [0, 42]], fill: 'feedback.nudgeLight', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M10 24 H140 M5 33 H145', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'poly', pts: [[16, 22], [58, 22], [56, 36], [12, 36]], fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'poly', pts: [[56, 20], [96, 20], [96, 34], [54, 34]], fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'poly', pts: [[96, 24], [136, 24], [140, 38], [96, 38]], fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M35 22 L34 36 M75 20 V34 M117 24 L118 38', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M20 26 V32 M25 26 V33 M29 26 V31 M41 26 V32 M46 26 V31 M61 24 V31 M66 24 V30 M83 24 V31 M88 24 V30 M101 28 V34 M106 28 V35 M124 28 V34 M129 28 V33', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

/** An open book: two pale pages over a dark cover edge, a gutter between. */
const openBook = (w: number, h: number): Shape[] => [
  { t: 'ellipse', cx: w / 2, cy: h - 2, rx: w / 2 - 2, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
  { t: 'path', d: `M2 6 Q${w / 4} 2 ${w / 2} 6 Q${(3 * w) / 4} 2 ${w - 2} 6 L${w - 2} ${h - 4} Q${(3 * w) / 4} ${h - 8} ${w / 2} ${h - 4} Q${w / 4} ${h - 8} 2 ${h - 4} Z`, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
  { t: 'line', x1: w / 2, y1: 6, x2: w / 2, y2: h - 4, stroke: 'text.secondary', sw: 'base' },
];

export const BOOK_OPEN_ENTRY: ItemDef = {
  id: 'prop:book-open-entry',
  kind: 'object',
  box: { w: 96, h: 60 },
  z: 'mid',
  alt: 'An open diary book whose entry begins with one bold headline stroke and smaller lines of detail below (no readable text)',
  tags: { heritage: true },
  sourceRef: { title: '일성록(日省錄)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0047238', accessed: '2026-10-11' },
  accuracyNote:
    "The entry says each Ilseongnok entry has a headline (gang) taken from its main point, with detail items (mok) under it. Here the right-hand page shows that layout as marks only: a short bold column at the top right for the headline and thinner, lower-starting columns for the details, read right to left as in the original. No character is drawn; ruling, margins and page count are simplified.",
  nodes: [
    ...openBook(96, 60),
    { t: 'line', x1: 86, y1: 12, x2: 86, y2: 26, stroke: 'text.primary', sw: 'thick' },
    { t: 'path', d: 'M79 18 V48 M73 18 V44 M67 18 V50 M61 18 V40 M55 18 V46', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M40 12 V44 M34 12 V48 M28 12 V40 M22 12 V46 M16 12 V42 M10 12 V36', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};

export const UIGWE_OPEN: ItemDef = {
  id: 'prop:uigwe-open',
  kind: 'object',
  box: { w: 108, h: 66 },
  z: 'mid',
  alt: 'An open uigwe: a painted page of a royal ceremony beside a page of brush-written columns (no readable text)',
  tags: { heritage: true },
  sourceRef: { title: '의궤란 무엇인가 (국가유산이야기 > 의궤정보)', publisher: '국가유산청 국가유산포털 (Korea Heritage Service, National Heritage Portal)', url: 'https://www.heritage.go.kr/heri/html/HtmlPage.do?pg=/mem/uigweInfo.jsp&pageNo=3_4_1_0', accessed: '2026-10-11' },
  accuracyNote:
    "A uigwe holds written records and pictures (diagrams and procession pictures), as the portal page explains. Here the left page is a simplified painted ceremony seen from above (a hall roof, rows of small figures in colour, flags) and the right page has columns of brush marks between ruled lines; the page says distribution copies had black printed ruling, the king's copy red lines drawn by painters. No character, label or particular event is drawn.",
  nodes: [
    ...openBook(108, 66),
    { t: 'poly', pts: [[14, 12], [42, 12], [46, 20], [10, 20]], fill: 'text.secondary' },
    { t: 'path', d: 'M12 28 H18 V32 H12 Z M22 28 H28 V32 H22 Z M32 28 H38 V32 H32 Z M42 28 H48 V32 H42 Z M12 40 H18 V44 H12 Z M22 40 H28 V44 H22 Z M32 40 H38 V44 H32 Z M42 40 H48 V44 H42 Z', fill: 'brand.primary' },
    { t: 'path', d: 'M14 50 V58 L20 54 Z M44 50 V58 L50 54 Z', fill: 'feedback.nudge' },
    { t: 'path', d: 'M8 36 H50', stroke: 'border.strong', sw: 'base', det: true },
    { t: 'path', d: 'M96 10 V58 M88 10 V58 M80 10 V58 M72 10 V58 M64 10 V58', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'path', d: 'M92 14 V44 M84 14 V50 M76 14 V38 M68 14 V48 M60 14 V42', stroke: 'text.secondary', sw: 'base' },
  ],
};

export const BOOK_GEOJUNGGI: ItemDef = {
  id: 'prop:book-geojunggi',
  kind: 'object',
  box: { w: 108, h: 66 },
  z: 'mid',
  alt: 'An open book with a drawing of a wooden lifting machine with pulleys and ropes, beside columns of brush writing (no readable text)',
  tags: { heritage: true },
  sourceRef: { title: '화성성역의궤(華城城役儀軌)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0064682', accessed: '2026-10-11' },
  accuracyNote:
    "The entry says the Hwaseong Seongyeok Uigwe carries drawings with explanations of the fortress, its buildings and the machines and tools used to build it; the geojunggi, a lifting machine that works by pulleys, is pictured in Jeong Yak-yong's Gijung doseol (encykorea, geojunggi). The drawing here is a schematic of such a machine (a frame, a top beam, a pulley block, ropes and a stone block), not a copy of the printed plate, so the number of pulleys and the winding gear are not shown. No caption or character is drawn.",
  nodes: [
    ...openBook(108, 66),
    { t: 'path', d: 'M10 56 L20 14 H38 L48 56 M20 14 L16 56 M38 14 L42 56', stroke: 'text.primary', sw: 'base' },
    { t: 'circle', cx: 29, cy: 20, r: 3, fill: 'surface.paper', stroke: 'text.primary', sw: 'base' },
    { t: 'circle', cx: 29, cy: 34, r: 3, fill: 'surface.paper', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M27 20 V34 M31 20 V34 M29 37 V44 M32 20 Q44 24 46 50', stroke: 'text.primary', sw: 'thin' },
    { t: 'rect', x: 23, y: 44, w: 12, h: 8, fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M96 10 V58 M88 10 V58 M80 10 V58 M72 10 V58 M64 10 V58', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'path', d: 'M92 14 V44 M84 14 V50 M76 14 V38 M68 14 V48 M60 14 V42', stroke: 'text.secondary', sw: 'base' },
  ],
};

export const BANCHADO_STRIP: ItemDef = {
  id: 'prop:banchado-strip',
  kind: 'object',
  box: { w: 200, h: 56 },
  z: 'mid',
  alt: 'Printed procession pages laid out in a long strip: rows of tiny figures, horses, flags and a palanquin seen from above, in black ink',
  tags: { heritage: true },
  sourceRef: { title: '원행을묘정리의궤(園幸乙卯整理儀軌)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0040890', accessed: '2026-10-11' },
  accuracyNote:
    "The entry says this uigwe's pictures include 63 pages of banchado (procession pictures), all made as prints; the National Heritage Portal adds that banchado are usually drawn from a high viewpoint looking down. Here four facing pages are laid side by side as a strip of black-ink marks: a road, rows of tiny figures and horses, flags and one covered palanquin in the middle. The order of the real procession is not copied and no caption is drawn.",
  nodes: [
    { t: 'ellipse', cx: 100, cy: 54, rx: 98, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 2, y: 4, w: 196, h: 48, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M51 4 V52 M100 4 V52 M149 4 V52', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 6, y: 22, w: 188, h: 12, fill: 'border.strong', o: 0.35 },
    { t: 'path', d: 'M10 18 H46 M56 18 H92 M108 18 H144 M154 18 H190 M10 38 H46 M56 38 H92 M108 38 H144 M154 38 H190', stroke: 'text.primary', sw: 'thick', o: 0.6 },
    { t: 'path', d: 'M14 28 H20 M28 28 H34 M62 28 H68 M76 28 H82 M114 28 H120 M128 28 H134 M160 28 H166 M174 28 H180', stroke: 'text.secondary', sw: 'thick' },
    { t: 'rect', x: 92, y: 24, w: 16, h: 8, fill: 'text.primary' },
    { t: 'path', d: 'M40 10 V16 L46 13 Z M140 10 V16 L146 13 Z M66 42 V48 L72 45 Z M168 42 V48 L174 45 Z', fill: 'text.primary' },
  ],
};

export const BOOK_BUNDLE: ItemDef = {
  id: 'prop:book-bundle',
  kind: 'object',
  box: { w: 70, h: 46 },
  z: 'mid',
  alt: 'A bundle of books wrapped in dark red cloth and tied with a knot on top',
  tags: { heritage: true },
  sourceRef: POSWAE_REF,
  accuracyNote:
    'The Annals were wrapped in oiled paper and then in a red cloth wrapper (hongbo) before they went into their chests, as the entry describes. Here one such bundle is drawn on its own, as it would be carried: a block wrapped in dark red cloth with the corners knotted on top. The red is the darker brand tone so the bundle reads as cloth in shade; size and the number of books inside are not shown.',
  nodes: [
    { t: 'ellipse', cx: 35, cy: 44, rx: 33, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'rect', x: 4, y: 16, w: 62, h: 28, r: 5, fill: 'brand.primaryDark', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M35 16 L22 6 Q30 2 35 10 Q40 2 48 6 Z', fill: 'brand.primaryDark', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M35 16 V44 M8 24 Q35 30 62 24', stroke: 'text.primary', sw: 'thin', o: 0.35, det: true },
  ],
};

// --- PR 2.10b: hangul-printing cluster --------------------------------------

export const BOOK_OPEN: ItemDef = {
  id: 'prop:book-open',
  kind: 'object',
  box: { w: 96, h: 60 },
  z: 'mid',
  alt: 'An old thread-bound book lying open, its pages ruled in a frame with columns of marks (no readable text)',
  tags: { heritage: true },
  sourceRef: { title: '국보 훈민정음 (訓民正音)', publisher: '국가유산청 국가유산포털 (Korea Heritage Service, National Heritage Portal)', url: 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=1111100700000', accessed: '2026-10-11' },
  accuracyNote: 'A generic old Korean thread-bound book, not one particular volume: ruled frames and columns of marks, no character, page count or seal. Scenes use it for the Hunminjeongeum Haerye (woodblock printed, 1446; Heritage Portal) and for other old books such as Jikji; the scene alt names the book.',
  nodes: [
    ...openBook(96, 60),
    { t: 'path', d: 'M8 10 H44 V48 H8 Z M52 10 H88 V48 H52 Z', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M82 14 V44 M76 14 V40 M70 14 V44 M64 14 V38 M58 14 V42', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M38 14 V42 M32 14 V44 M26 14 V36 M20 14 V44 M14 14 V40', stroke: 'text.secondary', sw: 'base', det: true },
  ],
};

// --- PR 2.10c: science-art-life cluster -------------------------------------

export const ALBUM_OPEN: ItemDef = {
  id: 'prop:album-open',
  kind: 'object',
  box: { w: 110, h: 70 },
  z: 'mid',
  tags: { heritage: true },
  alt: 'An open album of small ink paintings of people at work and play',
  sourceRef: { title: '《단원 풍속도첩》 (본관6504)', publisher: '국립중앙박물관 (National Museum of Korea, museum.go.kr)', url: 'https://www.museum.go.kr/site/main/relic/treasure/view?relicId=3799', accessed: '2026-10-11' },
  accuracyNote: "After Kim Hongdo's album of 25 genre paintings (rebound in 1957). The open leaves show tiny generic figures in ink and light colour, not copies of a leaf; no seal or writing.",
  nodes: [
    { t: 'rect', x: 2, y: 6, w: 106, h: 62, r: 2, fill: 'text.secondary' },
    { t: 'path', d: 'M6 10 H53 V64 H6 Z M57 10 H104 V64 H57 Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M12.5 40 A17 12 0 1 0 46.5 40 A17 12 0 1 0 12.5 40 Z M62.5 44 A18 10 0 1 0 98.5 44 A18 10 0 1 0 62.5 44 Z', fill: 'feedback.nudgeLight' },
    { t: 'path', d: 'M22 34 A3 3 0 1 0 28 34 A3 3 0 1 0 22 34 Z M31 34 A3 3 0 1 0 37 34 A3 3 0 1 0 31 34 Z M75 36 A3 3 0 1 0 81 36 A3 3 0 1 0 75 36 Z', fill: 'surface.paper', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M25 37 L22 48 M34 37 L37 48 M26 42 L33 42 M78 39 V48 M70 50 H92', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M14 22 H18 M20 20 H24 M40 22 H44 M66 26 H70 M88 24 H92 M94 30 H98 M12 56 H16 M42 56 H46', stroke: 'text.primary', sw: 'thick', det: true },
  ],
};
