import type { ItemDef } from '../types';

/** The inside of a Joseon palace hall with a raised seat (F-STORY-002 PR 2.3b). */
export const PALACE_HALL: ItemDef = {
  id: 'scene:palace-hall',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 176,
  alt: 'The inside of a Joseon palace hall: red columns, latticed doors and a raised seat before a sun, moon and five peaks screen',
  sourceRef: { title: '경기전 일월오봉도 (慶基殿 日月五峰圖)', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0076318', accessed: '2026-10-11' },
  accuracyNote:
    'A generic Joseon palace hall interior: red wooden columns under a dark beam, latticed doors, a raised platform for the throne and a wooden floor. Behind the seat stands a much simplified Irworobongdo (Sun, Moon and Five Peaks) screen, which the source says stood behind the throne: five peaks, a red sun on the viewer\'s right and a white moon on the left (the sun on the seated king\'s left). The peaks are a muted grey instead of their mineral blue-green, so a scene with the king and his officials stays inside the eight-colour scene palette. Its pines, waterfalls and waves, the canopy, dancheong painting and any inscribed board are left out. Not a copy of one named hall.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 176, fill: 'surface.sunken' },
    { t: 'rect', x: 0, y: 0, w: 400, h: 28, fill: 'text.secondary' },
    // latticed doors at both sides
    { t: 'rect', x: 28, y: 66, w: 84, h: 110, fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 288, y: 66, w: 84, h: 110, fill: 'surface.sunken', stroke: 'border.strong', sw: 'base' },
    { t: 'path', d: 'M56 66 V176 M84 66 V176 M316 66 V176 M344 66 V176 M28 96 H112 M28 126 H112 M28 152 H112 M288 96 H372 M288 126 H372 M288 152 H372', stroke: 'border.strong', sw: 'thin', det: true },
    // the sun, moon and five peaks screen behind the raised seat
    { t: 'rect', x: 132, y: 56, w: 136, h: 116, fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M134 170 L134 150 Q144 112 156 136 Q168 96 184 126 Q200 70 216 126 Q232 96 244 136 Q256 112 266 150 L266 170 Z', fill: 'text.secondary', o: 0.6 },
    { t: 'circle', cx: 154, cy: 80, r: 9, fill: 'surface.paper' },
    { t: 'circle', cx: 246, cy: 80, r: 9, fill: 'brand.primary' },
    { t: 'path', d: 'M166 56 V172 M200 56 V82 M234 56 V172', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    // beam band and columns as one red shape
    { t: 'path', d: 'M0 28 H400 V36 H0 Z M4 36 H22 V190 H4 Z M110 36 H122 V180 H110 Z M278 36 H290 V180 H278 Z M378 36 H396 V190 H378 Z', fill: 'brand.primary' },
    // floor and raised seat
    { t: 'rect', x: 0, y: 176, w: 400, h: 124, fill: 'surface.paper' },
    { t: 'path', d: 'M0 206 H400 M0 238 H400 M0 272 H400 M100 176 L50 300 M200 176 V300 M300 176 L350 300', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 116, y: 164, w: 168, h: 28, fill: 'border.strong' },
    { t: 'rect', x: 116, y: 164, w: 168, h: 8, fill: 'surface.sunken' },
    { t: 'path', d: 'M116 192 H284', stroke: 'text.secondary', sw: 'thin', det: true },
  ],
};
