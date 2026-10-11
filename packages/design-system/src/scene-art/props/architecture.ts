/**
 * Architecture props (F-STORY-002 §3.9.4, PR 2.10a). Heritage buildings carry
 * a sourceRef and say what is simplified; no signboard or inscription is drawn.
 */
import type { ItemDef } from '../types';

const ACCESSED = '2026-10-11';
const ENCYKOREA = '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)';

export const SAGO_ARCHIVE: ItemDef = {
  id: 'prop:sago-archive',
  kind: 'architecture',
  box: { w: 200, h: 120 },
  z: 'mid',
  tintable: 'surface.sunken',
  alt: 'A Joseon mountain archive: two tiled-roof storehouses on stone bases inside one low wall',
  tags: { heritage: true },
  sourceRef: { title: '실록을 보관하는 곳, 사고 (조선왕조실록의 어제와 오늘)', publisher: '국가기록원 (National Archives of Korea)', url: 'https://theme.archives.go.kr/next/sillok/sub2_3.do', accessed: ACCESSED },
  accuracyNote:
    'The National Archives page describes a sago as two buildings standing side by side inside one wall: the sillokgak for the Annals and the seonwongak for the royal genealogy, on low stone bases with natural stone plinths, the books kept in chests rather than on shelves. Drawn here simply: two storehouses with tiled roofs, plain wooden walls and closed doors behind a low wall. The page does not give the number of storeys, so each is one storey; door colour is tintable (a warm glow for a lit doorway). No signboard is drawn.',
  nodes: [
    // left storehouse (the larger)
    { t: 'rect', x: 18, y: 78, w: 92, h: 10, fill: 'border.strong' },
    { t: 'rect', x: 26, y: 42, w: 76, h: 36, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M26 42 H32 V78 H26 Z M61 42 H67 V78 H61 Z M96 42 H102 V78 H96 Z', fill: 'text.secondary' },
    { t: 'rect', x: 38, y: 50, w: 18, h: 28, fill: 'surface.sunken', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M30 10 H98 Q108 30 124 34 Q112 42 100 42 H28 Q16 42 4 34 Q20 30 30 10 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M40 16 L36 38 M52 14 L50 40 M64 14 V40 M76 14 L78 40 M88 16 L92 38', stroke: 'surface.paper', sw: 'thin', o: 0.2, det: true },
    // right storehouse
    { t: 'rect', x: 124, y: 80, w: 66, h: 8, fill: 'border.strong' },
    { t: 'rect', x: 130, y: 54, w: 54, h: 26, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M130 54 H135 V80 H130 Z M179 54 H184 V80 H179 Z', fill: 'text.secondary' },
    { t: 'rect', x: 150, y: 60, w: 14, h: 20, fill: 'surface.sunken', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M136 30 H178 Q186 46 198 50 Q188 55 178 55 H136 Q126 55 116 50 Q128 46 136 30 Z', fill: 'text.secondary' },
    // the low wall with its tile cap
    { t: 'rect', x: 0, y: 96, w: 200, h: 22, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 0, y: 90, w: 200, h: 7, r: 2, fill: 'text.secondary' },
    { t: 'path', d: 'M0 106 H200 M20 96 V106 M60 96 V106 M100 96 V106 M140 96 V106 M180 96 V106 M40 106 V118 M80 106 V118 M120 106 V118 M160 106 V118', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const FORTRESS_GATE: ItemDef = {
  id: 'prop:fortress-gate',
  kind: 'architecture',
  box: { w: 240, h: 150 },
  z: 'mid',
  alt: 'A gate of Suwon Hwaseong Fortress: a two-storey wooden gate tower over an arched gateway, stone walls with a crenellated parapet on both sides',
  tags: { heritage: true },
  sourceRef: { title: '수원 장안문 (水原 長安門)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0048647', accessed: ACCESSED },
  accuracyNote:
    "Simplified from Janganmun, the north gate of Hwaseong, which the entry describes as a two-storey gate tower five bays wide over a single arched gateway, with a round brick outer wall (ongseong) in front; Hwaseong's walls are of stone with a parapet about 1 m high pierced with gun holes (encykorea, Suwon Hwaseong). Seen straight on, the ongseong would hide the gate, so it is left out; the bays are reduced to three, the parapet loopholes to plain notches and the roof figurines, dancheong and signboard are left out.",
  nodes: [
    // walls either side with a notched parapet
    { t: 'rect', x: 0, y: 88, w: 240, h: 62, fill: 'border.strong' },
    { t: 'path', d: 'M0 80 H16 V88 H0 Z M24 80 H40 V88 H24 Z M48 80 H64 V88 H48 Z M176 80 H192 V88 H176 Z M200 80 H216 V88 H200 Z M224 80 H240 V88 H224 Z', fill: 'border.strong' },
    { t: 'path', d: 'M0 106 H64 M0 124 H64 M176 106 H240 M176 124 H240 M16 88 V106 M40 106 V124 M200 88 V106 M224 106 V124', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    // the gate base and its arch
    { t: 'rect', x: 64, y: 82, w: 112, h: 68, fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M98 150 V116 A22 22 0 0 1 142 116 V150 Z', fill: 'text.primary' },
    { t: 'path', d: 'M64 104 H98 M142 104 H176 M64 126 H98 M142 126 H176', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    // lower storey of the tower
    { t: 'rect', x: 80, y: 52, w: 80, h: 30, fill: 'surface.paper' },
    { t: 'path', d: 'M80 52 H86 V82 H80 Z M107 52 H113 V82 H107 Z M127 52 H133 V82 H127 Z M154 52 H160 V82 H154 Z', fill: 'brand.primary' },
    { t: 'path', d: 'M70 54 H170 Q188 52 200 46 Q186 40 172 38 H68 Q54 40 40 46 Q52 52 70 54 Z', fill: 'text.secondary' },
    // upper storey and top roof
    { t: 'rect', x: 92, y: 24, w: 56, h: 16, fill: 'surface.paper' },
    { t: 'path', d: 'M98 24 V40 M120 24 V40 M142 24 V40', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M100 4 H140 Q150 20 176 24 Q160 28 146 28 H94 Q80 28 64 24 Q90 20 100 4 Z', fill: 'text.secondary' },
  ],
};

export const FORTRESS_WALL: ItemDef = {
  id: 'prop:fortress-wall',
  kind: 'architecture',
  box: { w: 220, h: 96 },
  z: 'mid',
  alt: 'A section of stone fortress wall with a notched parapet, one stone block missing from its face',
  tags: { heritage: true },
  sourceRef: { title: '수원 화성 (水原 華城)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0064671', accessed: ACCESSED },
  accuracyNote:
    "A stretch of Hwaseong's stone wall, which the entry describes as 4 to 6 m of stone with a parapet about 1 m high pierced with gun holes. Here the courses are regular blocks, the loopholes are plain notches and one block is left out of the face for a restoration scene. The slight inward slope of the real wall is not drawn.",
  nodes: [
    { t: 'rect', x: 0, y: 26, w: 220, h: 70, fill: 'border.strong' },
    { t: 'path', d: 'M0 16 H30 V26 H0 Z M40 16 H70 V26 H40 Z M80 16 H110 V26 H80 Z M120 16 H150 V26 H120 Z M160 16 H190 V26 H160 Z M200 16 H220 V26 H200 Z', fill: 'border.strong' },
    { t: 'path', d: 'M0 44 H220 M0 62 H220 M0 80 H220 M30 26 V44 M80 26 V44 M130 26 V44 M180 26 V44 M55 44 V62 M105 44 V62 M155 44 V62 M205 44 V62 M30 62 V80 M80 62 V80 M180 62 V80 M55 80 V96 M105 80 V96 M155 80 V96', stroke: 'text.secondary', sw: 'base', o: 0.6 },
    { t: 'rect', x: 104, y: 62, w: 52, h: 18, fill: 'text.secondary', o: 0.6 },
    { t: 'rect', x: 0, y: 94, w: 220, h: 2, fill: 'text.secondary' },
  ],
};

export const NIGHT_WINDOW: ItemDef = {
  id: 'prop:night-window',
  kind: 'architecture',
  box: { w: 110, h: 100 },
  z: 'back',
  alt: 'An open lattice window onto a dark night sky with a crescent moon',
  accuracyNote:
    'A wooden lattice window standing open onto the night: a dark blue sky, a crescent moon and two small stars. Generic; it marks the time of day and copies no particular building.',
  nodes: [
    { t: 'rect', x: 4, y: 4, w: 102, h: 92, fill: 'brand.secondaryDark', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M76 22 A16 16 0 1 0 90 48 A13 13 0 1 1 76 22 Z', fill: 'feedback.nudgeLight' },
    { t: 'circle', cx: 30, cy: 26, r: 1.5, fill: 'surface.paper', det: true },
    { t: 'circle', cx: 46, cy: 58, r: 1.5, fill: 'surface.paper', det: true },
    { t: 'path', d: 'M4 70 H106 M38 70 V96 M72 70 V96', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 0, y: 92, w: 110, h: 8, fill: 'text.secondary' },
  ],
};
