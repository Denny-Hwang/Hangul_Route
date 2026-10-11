import type { ItemDef } from '../types';

/** A plain room of today with a wide window (F-STORY-002 PR 2.10a). */
export const MODERN_ROOM: ItemDef = {
  id: 'scene:modern-room',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 196,
  alt: 'A plain room of today with a wide window and a pale floor',
  accuracyNote:
    'A present-day room: a plain wall, one wide window with a light sky and a pale floor. It serves as a research office, a reading room or a home and is not a copy of any real institution; no logo, sign or screen text is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 196, fill: 'surface.paper' },
    { t: 'rect', x: 214, y: 34, w: 156, h: 104, fill: 'brand.secondaryLight', stroke: 'border.strong', sw: 'thick' },
    { t: 'path', d: 'M292 34 V138 M214 86 H370', stroke: 'border.strong', sw: 'base' },
    { t: 'rect', x: 206, y: 138, w: 172, h: 6, fill: 'border.strong' },
    { t: 'rect', x: 0, y: 188, w: 400, h: 8, fill: 'text.secondary', o: 0.6 },
    { t: 'rect', x: 0, y: 196, w: 400, h: 104, fill: 'surface.sunken' },
    { t: 'path', d: 'M0 230 H400 M0 270 H400', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
  ],
};
