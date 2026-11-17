import type { ItemDef } from '../types';

/** A room of today with a bookshelf and a wide window (F-STORY-002 PR 2.10a; the bookshelf [PX] PX-4). */
export const MODERN_ROOM: ItemDef = {
  id: 'scene:modern-room',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 196,
  alt: 'A room of today with a bookshelf, a wide window and a pale floor',
  accuracyNote:
    'A present-day room: a plain wall with a bookshelf of blank-spined books ([PX] PX-4), one wide window with a light sky and a pale floor. It serves as a research office, a reading room or a home and is not a copy of any real institution; no logo, sign or screen text is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 196, fill: 'surface.paper' },
    { t: 'rect', x: 214, y: 34, w: 156, h: 104, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'thick' },
    { t: 'path', d: 'M292 34 V138 M214 86 H370', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 206, y: 138, w: 172, h: 6, fill: 'border.strong' },
    // [PX] PX-4: a bookshelf against the left wall, the furniture cue of a room of today
    { t: 'rect', x: 26, y: 56, w: 104, h: 136, fill: 'surface.sunken', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M26 100H130M26 146H130', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M34 64H42V100H34ZM44 70H52V100H44ZM54 66H62V100H54ZM78 74L86 72L92 100H84ZM36 110H44V146H36ZM46 114H54V146H46ZM86 108H94V146H86ZM96 112H104V146H96ZM108 116H116V146H108Z', fill: 'brand.secondaryLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M64 64H72V100H64ZM104 66H112V100H104ZM56 112H64V146H56ZM40 156H48V192H40ZM50 160H58V192H50Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 0, y: 188, w: 400, h: 8, fill: 'text.secondary', o: 0.6 },
    { t: 'rect', x: 0, y: 196, w: 400, h: 104, fill: 'surface.sunken' },
    { t: 'path', d: 'M0 230 H400 M0 270 H400', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
  ],
};
