import type { ItemDef } from '../types';

/** Inside a Joseon room: paper-covered lattice doors, wooden posts and a board floor (F-STORY-002 PR 2.10a). */
export const HANOK_ROOM: ItemDef = {
  id: 'scene:hanok-room',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 196,
  alt: 'Inside a Joseon room with paper-covered lattice doors, wooden posts and a polished board floor',
  accuracyNote:
    'A generic room of a Joseon timber house: unpainted wooden posts and a beam, plain plastered walls, two pairs of doors with a simple square lattice covered in pale paper, and a floor of wooden boards. It serves as a study, an office or a library room and copies no named building; the lattice pattern is the plainest kind, and no screen, painting, signboard or writing is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 196, fill: 'surface.sunken' },
    { t: 'rect', x: 0, y: 0, w: 400, h: 24, fill: 'text.secondary' },
    // two pairs of lattice doors covered with paper
    { t: 'rect', x: 36, y: 46, w: 124, h: 142, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thick' },
    { t: 'rect', x: 240, y: 46, w: 124, h: 142, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thick' },
    { t: 'path', d: 'M98 46 V188 M302 46 V188', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M67 46 V188 M129 46 V188 M271 46 V188 M333 46 V188 M36 74 H160 M36 102 H160 M36 130 H160 M36 158 H160 M240 74 H364 M240 102 H364 M240 130 H364 M240 158 H364', stroke: 'border.strong', sw: 'thin', det: true },
    // posts
    { t: 'path', d: 'M0 24 H14 V200 H0 Z M193 24 H207 V200 H193 Z M386 24 H400 V200 H386 Z', fill: 'text.secondary' },
    // board floor
    { t: 'rect', x: 0, y: 196, w: 400, h: 104, fill: 'feedback.nudgeLight' },
    { t: 'path', d: 'M0 218 H400 M0 244 H400 M0 274 H400', stroke: 'text.secondary', sw: 'thin', o: 0.2, det: true },
    { t: 'path', d: 'M100 196 L76 300 M300 196 L324 300', stroke: 'text.secondary', sw: 'thin', o: 0.2, det: true },
  ],
};
