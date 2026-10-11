import type { ItemDef } from '../types';

/** The Dragon King's palace under the sea, for Sugung-ga (F-STORY-002 PR 2.10d). */
export const SEA_PALACE: ItemDef = {
  id: 'scene:sea-palace',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 210,
  alt: 'Under the sea: bubbles, seaweed, a distant palace roof and a sandy floor',
  accuracyNote:
    'A storybook undersea palace (sugung) for the folk tale: a plain roof on posts behind seaweed. No real building is copied.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M110 96Q200 70 290 96L272 104H128ZM136 104H148V210H136ZM194 104H206V210H194ZM252 104H264V210H252ZM128 200H272V212H128Z', fill: 'border.strong', o: 0.6 },
    { t: 'path', d: 'M0 214Q100 204 200 212Q300 220 400 208V300H0Z', fill: 'feedback.nudgeLight' },
    { t: 'path', d: 'M24 300Q10 250 30 210Q46 170 30 130Q48 170 40 214Q30 254 40 300ZM60 300Q50 260 64 226Q76 196 66 170Q84 198 74 230Q64 262 72 300Z', fill: 'theme.nature' },
    { t: 'path', d: 'M360 300Q346 246 366 206Q382 168 368 120Q388 166 378 210Q366 250 376 300ZM330 300Q322 262 336 232Q346 210 340 186Q356 212 346 236Q336 264 342 300Z', fill: 'theme.nature' },
    { t: 'path', d: 'M96 70A6 6 0 1 0 108 70A6 6 0 1 0 96 70ZM300 60A6 6 0 1 0 312 60A6 6 0 1 0 300 60ZM196 30A5 5 0 1 0 206 30A5 5 0 1 0 196 30Z', fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
  ],
};
