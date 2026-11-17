import type { ItemDef } from '../types';

/** The Dragon King's palace under the sea, for Sugung-ga (F-STORY-002 PR 2.10d). */
export const SEA_PALACE: ItemDef = {
  id: 'scene:sea-palace',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 210,
  alt: 'Under the sea: bubbles, seaweed, fish, a palace with a curved tiled roof and a painted band, and a sandy floor',
  accuracyNote:
    'A storybook undersea palace (sugung) for the folk tale: a curved tiled roof with a plain blue-green dancheong band under the eaves, on wooden pillars, with two fish and seaweed ([PX] PX-4). No real building is copied.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'brand.secondaryLight' },
    // [PX] PX-4: a palace with a curved tiled roof, a dancheong band under the eaves, and fish, so it reads as a Korean palace under the sea
    { t: 'path', d: 'M128 200H272V212H128Z', fill: 'surface.paper', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M138 112H150V200H138ZM194 112H206V200H194ZM250 112H262V200H250Z', fill: 'border.strong', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M130 112H270V124H130Z', fill: 'theme.nature', stroke: 'text.primary', sw: 'thin' },
    { t: 'path', d: 'M140 118H150M166 118H176M192 118H208M224 118H234M250 118H260', stroke: 'surface.paper', sw: 'base' },
    { t: 'path', d: 'M96 92Q118 100 136 96Q200 84 264 96Q282 100 304 92Q296 110 270 114H130Q104 110 96 92Z', fill: 'text.primary' },
    { t: 'path', d: 'M150 84Q200 64 250 84L264 96H136Z', fill: 'text.primary' },
    { t: 'path', d: 'M144 102H256M152 90H248', stroke: 'brand.secondaryLight', sw: 'thin', o: 0.6 },
    { t: 'path', d: 'M282 150Q296 140 310 150Q296 160 282 150ZM282 150L274 144V156ZM96 170Q110 160 124 170Q110 180 96 170ZM124 170L132 164V176Z', fill: 'feedback.nudgeLight', stroke: 'text.primary', sw: 'base' },
    { t: 'path', d: 'M0 214Q100 204 200 212Q300 220 400 208V300H0Z', fill: 'feedback.nudgeLight' },
    { t: 'path', d: 'M24 300Q10 250 30 210Q46 170 30 130Q48 170 40 214Q30 254 40 300ZM60 300Q50 260 64 226Q76 196 66 170Q84 198 74 230Q64 262 72 300Z', fill: 'theme.nature' },
    { t: 'path', d: 'M360 300Q346 246 366 206Q382 168 368 120Q388 166 378 210Q366 250 376 300ZM330 300Q322 262 336 232Q346 210 340 186Q356 212 346 236Q336 264 342 300Z', fill: 'theme.nature' },
    { t: 'path', d: 'M96 60A6 6 0 1 0 108 60A6 6 0 1 0 96 60ZM316 50A6 6 0 1 0 328 50A6 6 0 1 0 316 50ZM196 30A5 5 0 1 0 206 30A5 5 0 1 0 196 30Z', fill: 'surface.paper', stroke: 'text.primary', sw: 'thin' },
  ],
};
