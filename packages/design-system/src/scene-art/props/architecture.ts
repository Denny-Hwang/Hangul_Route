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

// --- PR 2.10b: hangul-printing cluster --------------------------------------

const PANJEON_REF = { title: '유네스코 등재유산 소개 — 세계유산 「해인사 장경판전」', publisher: '국가유산청 국가유산포털 (Korea Heritage Service, National Heritage Portal)', url: 'https://www.heritage.go.kr/heri/html/HtmlPage.do?pg=%2Funesco%2FHeritage%2FHeritage_02.jsp&pageNo=5_1_1_0', accessed: ACCESSED } as const;
const HEUNGDEOKSA_REF = { title: '청주 흥덕사지 (淸州 興德寺址)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0056767', accessed: ACCESSED } as const;

export const JANGGYEONG_HALL: ItemDef = {
  id: 'prop:janggyeong-hall',
  kind: 'architecture',
  box: { w: 220, h: 100 },
  z: 'mid',
  alt: 'A long, plain Joseon wooden hall of Janggyeong Panjeon at Haeinsa: fifteen bays of unpainted posts, rows of slatted windows high and low, a hipped tiled roof',
  tags: { heritage: true },
  sourceRef: { title: '합천 해인사 장경판전 (陜川 海印寺 藏經板殿)', publisher: ENCYKOREA, url: 'https://encykorea.aks.ac.kr/Article/E0062725', accessed: ACCESSED },
  accuracyNote: 'One of the two long halls: 15 bays under a hipped roof, no decoration (encykorea); upper and lower windows differ in size (Heritage Portal). Which row is larger on which wall is not given, so here the lower row is taller. One slat per bay.',
  nodes: [
    { t: 'rect', x: 0, y: 88, w: 220, h: 12, fill: 'border.strong', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 5, y: 40, w: 210, h: 48, fill: 'surface.paper' },
    { t: 'rect', x: 5, y: 47, w: 210, h: 9, fill: 'text.secondary', o: 0.6 },
    { t: 'rect', x: 5, y: 63, w: 210, h: 18, fill: 'text.secondary', o: 0.6 },
    { t: 'path', d: 'M12 48V55 M26 48V55 M40 48V55 M54 48V55 M68 48V55 M82 48V55 M96 48V55 M110 48V55 M124 48V55 M138 48V55 M152 48V55 M166 48V55 M180 48V55 M194 48V55 M208 48V55', stroke: 'border.strong', sw: 'base', det: true },
    { t: 'path', d: 'M12 64V80 M26 64V80 M40 64V80 M54 64V80 M68 64V80 M82 64V80 M96 64V80 M110 64V80 M124 64V80 M138 64V80 M152 64V80 M166 64V80 M180 64V80 M194 64V80 M208 64V80', stroke: 'border.strong', sw: 'base', det: true },
    { t: 'path', d: 'M5 40V88 M19 40V88 M33 40V88 M47 40V88 M61 40V88 M75 40V88 M89 40V88 M103 40V88 M117 40V88 M131 40V88 M145 40V88 M159 40V88 M173 40V88 M187 40V88 M201 40V88 M215 40V88', stroke: 'text.secondary', sw: 'thick' },
    { t: 'rect', x: 3, y: 36, w: 214, h: 5, fill: 'text.secondary' },
    { t: 'path', d: 'M40 6 H180 L204 26 Q212 32 220 37 H0 Q8 32 16 26 Z', fill: 'text.primary' },
    { t: 'rect', x: 38, y: 3, w: 144, h: 5, r: 2, fill: 'text.primary' },
  ],
};

export const PANJEON_PLAN: ItemDef = {
  id: 'prop:panjeon-plan',
  kind: 'architecture',
  box: { w: 200, h: 150 },
  z: 'mid',
  alt: 'Janggyeong Panjeon seen from above: two long halls and two small ones forming a rectangle around a sandy courtyard',
  tags: { heritage: true },
  sourceRef: PANJEON_REF,
  accuracyNote: 'The Heritage Portal puts the two 15-bay halls side by side, Sudarajang south (bottom) and Beopbojeon north, with the small east and west halls at the ends. Roofs are flat shapes; walls, gaps and steps are left out.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 200, h: 150, r: 4, fill: 'theme.nature', o: 0.35 },
    { t: 'rect', x: 32, y: 42, w: 136, h: 66, fill: 'surface.sunken' },
    { t: 'rect', x: 10, y: 12, w: 180, h: 28, r: 1, fill: 'text.primary' },
    { t: 'rect', x: 10, y: 110, w: 180, h: 28, r: 1, fill: 'text.primary' },
    { t: 'rect', x: 12, y: 50, w: 18, h: 50, r: 1, fill: 'text.primary' },
    { t: 'rect', x: 170, y: 50, w: 18, h: 50, r: 1, fill: 'text.primary' },
    { t: 'path', d: 'M10 12 L24 26 L10 40 M24 26 H176 M190 12 L176 26 L190 40 M10 110 L24 124 L10 138 M24 124 H176 M190 110 L176 124 L190 138', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M21 50 V100 M179 50 V100', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M50 60 Q60 56 70 60 M120 86 Q130 82 140 86', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const HALL_SECTION: ItemDef = {
  id: 'prop:hall-section',
  kind: 'architecture',
  box: { w: 220, h: 170 },
  z: 'mid',
  alt: 'A cutaway of a Janggyeong Panjeon hall: windows of different sizes high and low in the two walls, shelves of woodblocks inside, and layers of charcoal, lime, salt and sand under the earth floor',
  tags: { heritage: true },
  sourceRef: PANJEON_REF,
  accuracyNote: 'A diagram, not a measured section: windows of different sizes high and low, front and back, and a foundation packed with charcoal, salt and lime (Heritage Portal; the story adds sand). Layer order and depth are not given; one rack stands for the shelves.',
  nodes: [
    { t: 'rect', x: 0, y: 128, w: 220, h: 42, fill: 'feedback.nudgeLight' },
    { t: 'rect', x: 0, y: 130, w: 220, h: 9, fill: 'text.primary' },
    { t: 'rect', x: 0, y: 139, w: 220, h: 9, fill: 'surface.paper' },
    { t: 'rect', x: 0, y: 148, w: 220, h: 9, fill: 'border.strong', o: 0.35 },
    { t: 'rect', x: 0, y: 120, w: 220, h: 10, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M30 52 H38 V60 H30 Z M30 68 H38 V92 H30 Z M30 116 H38 V120 H30 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M182 52 H190 V56 H182 Z M182 80 H190 V106 H182 Z M182 114 H190 V120 H182 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M30 52 H38 V120 H30 Z M182 52 H190 V120 H182 Z', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M10 56 L110 10 L210 56 L200 60 L110 20 L20 60 Z', fill: 'text.primary' },
    { t: 'rect', x: 72, y: 64, w: 76, h: 56, fill: 'none', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M72 82 H148 M72 100 H148', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M76 67 H144 V81 H76 Z M76 85 H144 V99 H76 Z M76 103 H144 V119 H76 Z', fill: 'text.primary', o: 0.6 },
    { t: 'path', d: 'M92 67 V119 M110 67 V119 M128 67 V119', stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const TEMPLE_SITE: ItemDef = {
  id: 'prop:temple-site',
  kind: 'architecture',
  box: { w: 200, h: 44 },
  z: 'mid',
  alt: 'The excavated site of Heungdeoksa, a Goryeo temple: a low earth platform with rows of stone bases where its halls once stood',
  tags: { heritage: true },
  sourceRef: HEUNGDEOKSA_REF,
  accuracyNote: 'Excavation found only the main hall, lecture hall and west corridor remains (encykorea). A low earth platform with two rows of stone bases, not measured; no rebuilt hall or sign is drawn.',
  nodes: [
    { t: 'path', d: 'M0 44 Q6 24 24 22 H176 Q194 24 200 44 Z', fill: 'surface.sunken', stroke: 'border.strong', sw: 'thin' },
    { t: 'rect', x: 30, y: 26, w: 140, h: 14, fill: 'none', stroke: 'border.strong', sw: 'base', o: 0.6, det: true },
    { t: 'path', d: 'M30 24 H40 V30 H30 Z M65 24 H75 V30 H65 Z M100 24 H110 V30 H100 Z M135 24 H145 V30 H135 Z M160 24 H170 V30 H160 Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M26 36 H38 V43 H26 Z M63 36 H75 V43 H63 Z M100 36 H112 V43 H100 Z M137 36 H149 V43 H137 Z M162 36 H174 V43 H162 Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'thin' },
  ],
};

export const MUSEUM_BUILDING: ItemDef = {
  id: 'prop:museum-building',
  kind: 'architecture',
  box: { w: 170, h: 90 },
  z: 'mid',
  alt: 'A low modern museum building of today with a flat roof, a long glass front and a blue door',
  accuracyNote: 'A generic museum of today standing for the Cheongju Early Printing Museum, not its real design. No name, sign or logo.',
  nodes: [
    { t: 'rect', x: 4, y: 30, w: 162, h: 56, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 0, y: 24, w: 170, h: 8, fill: 'text.secondary' },
    { t: 'rect', x: 14, y: 40, w: 142, h: 20, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'thin' },
    { t: 'path', d: 'M42 40 V60 M70 40 V60 M100 40 V60 M128 40 V60', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'rect', x: 74, y: 66, w: 22, h: 20, fill: 'brand.secondary' },
    { t: 'rect', x: 60, y: 86, w: 50, h: 4, fill: 'border.strong' },
  ],
};
