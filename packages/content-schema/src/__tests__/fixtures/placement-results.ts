import type { PlacementResult } from '../../schemas/placement';

/** A valid stored result with nothing placed out; tests override what they exercise. */
export const makeResult = (over: Partial<PlacementResult> = {}): PlacementResult => ({
  id: 'placement:abc123',
  startedAt: '2026-10-10T10:00:00.000Z',
  completedAt: '2026-10-10T10:05:00.000Z',
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
});
