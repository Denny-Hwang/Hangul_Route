import type { PlacementResult, RouteSeed } from '@hangul-route/content-schema';

/** A route seed with the given quests placed out; tests override what they exercise. */
export const seed = (placedOutQuestIds: string[], over: Partial<RouteSeed> = {}): RouteSeed => ({
  level: { stage: 'stage1', band: 0 },
  oralStage: null,
  startQuestId: null,
  startEpisodeId: null,
  placedOutQuestIds,
  priorityTokens: [],
  themeOrder: ['letters', 'life', 'rites', 'nature', 'crafts'],
  beyondContent: false,
  needsStage: null,
  ...over,
});

let counter = 0;

/** A valid stored placement result (mirror of the content-schema test fixture `makeResult`). */
export const result = (over: Partial<PlacementResult> = {}): PlacementResult => {
  counter += 1;
  const at = `2026-10-10T10:${String(counter % 60).padStart(2, '0')}:00.000Z`;
  return {
    id: `placement:r${counter}`,
    startedAt: at,
    completedAt: at,
    source: 'onboarding',
    testLocale: 'en',
    length: 'full',
    revealMode: 'tap',
    bankVersion: 1,
    contentVer: 'test',
    responses: [],
    gates: [],
    strands: {
      'hangul-recognition': 'not-tested',
      'sound-letter': 'not-tested',
      'syllable-reading': 'not-tested',
      vocabulary: 'not-tested',
      sentences: 'not-tested',
    },
    level: { stage: 'stage1', band: 0 },
    oralStage: null,
    beyondContent: false,
    startQuestId: null,
    placedOutQuestIds: [],
    priorityTokens: [],
    needsStage: null,
    stopReason: 'complete',
    ...over,
  };
};
