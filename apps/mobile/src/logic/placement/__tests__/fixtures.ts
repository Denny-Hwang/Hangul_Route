import type { GateResult, PlacementResult } from '@hangul-route/content-schema';

/** A stored level-check result for tests: a Standard run that placed at stage1 band 0. */
export function placementResult(over: Partial<PlacementResult> = {}): PlacementResult {
  return {
    id: 'placement:a1',
    startedAt: '2026-10-01T10:00:00.000Z',
    completedAt: '2026-10-01T10:08:00.000Z',
    source: 'onboarding',
    testLocale: 'en',
    length: 'full',
    mode: 'standard',
    revealMode: 'tap',
    bankVersion: 1,
    contentVer: 'test',
    responses: [{ questionId: 'pitem:x', outcome: 'correct', chosenOptionId: 'a', assisted: false, ms: 1200 }],
    gates: [],
    strands: {
      'hangul-recognition': 'secure',
      'sound-letter': 'not-yet',
      'syllable-reading': 'not-tested',
      vocabulary: 'getting-there',
      sentences: 'not-yet',
    },
    level: { stage: 'stage1', band: 0 },
    oralStage: 'stage1',
    beyondContent: false,
    startQuestId: 'quest:q1',
    placedOutQuestIds: [],
    priorityTokens: [],
    needsStage: null,
    stopReason: 'complete',
    ...over,
  };
}

/** One gate row. */
export function gate(
  g: GateResult['gate'],
  form: GateResult['form'],
  result: GateResult['result'],
  correct: number,
  extra: Partial<GateResult> = {},
): GateResult {
  return { gate: g, form, asked: 3, correct, assisted: 0, result, ...extra };
}
