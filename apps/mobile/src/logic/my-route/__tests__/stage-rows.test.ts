import { describe, expect, it } from 'vitest';
import type { PipState } from '../types';
import type { StageAvailability } from '../../journey';
import { STAGE_BUILDS, hereStageOf, stageStateOf, type StageFacts } from '../stage-rows';

const AVAILABILITY: StageAvailability[] = ['open', 'taste', 'soon'];
const bools = [false, true];

/** Quest pip sets that cover nothing done / some done / all done, with and without known. */
const PIP_SETS: Record<string, PipState[]> = {
  none: [],
  open: ['open', 'open'],
  someDone: ['done', 'open'],
  allDone: ['done', 'done'],
  allKnown: ['known', 'known'],
  knownAndDone: ['known', 'done'],
  knownAndOpen: ['known', 'open'],
  later: ['later', 'later'],
};

describe('stageStateOf (F-ROUTE-001 section 3.3)', () => {
  it('follows the table, first match wins, for every combination', () => {
    for (const availability of AVAILABILITY)
      for (const entitled of bools)
        for (const latched of bools)
          for (const cardComplete of bools)
              for (const allPlayableDone of bools)
                for (const pips of Object.values(PIP_SETS)) {
                  const facts: StageFacts = { availability, entitled, latched, cardComplete, allPlayableDone, questPips: pips };
                  const anyDone = pips.includes('done');
                  const allKnownOrDone = pips.length > 0 && pips.every((p) => p === 'known' || p === 'done') && pips.includes('known');
                  const expected = latched || (availability === 'open' && allPlayableDone) || cardComplete
                    ? 'complete'
                    : allKnownOrDone
                      ? 'known'
                      : availability === 'taste' && allPlayableDone
                        ? 'explored'
                        : availability === 'soon' || (!entitled && !anyDone)
                          ? 'later'
                          : 'open';
                  expect(stageStateOf(facts), JSON.stringify(facts)).toBe(expected);
                }
  });

  it('never calls a taste stage complete by the derived rule', () => {
    const facts: StageFacts = { availability: 'taste', entitled: true, latched: false, cardComplete: false, allPlayableDone: true, questPips: ['done', 'done'] };
    expect(stageStateOf(facts)).toBe('explored');
  });

  it('never calls a known stage complete', () => {
    const facts: StageFacts = { availability: 'open', entitled: true, latched: false, cardComplete: false, allPlayableDone: false, questPips: ['known', 'known', 'done'] };
    expect(stageStateOf(facts)).toBe('known');
  });
});

describe('hereStageOf', () => {
  it('is the cursor stage first', () => {
    expect(hereStageOf({ cursorStage: 'stage2', highestDoneStage: 'stage4', startStage: 'stage3' })).toBe('stage2');
  });
  it('is the highest stage with a done pip at rest', () => {
    expect(hereStageOf({ cursorStage: null, highestDoneStage: 'stage4', startStage: 'stage3' })).toBe('stage4');
  });
  it('is the start stage with nothing done, else Stage 1', () => {
    expect(hereStageOf({ cursorStage: null, highestDoneStage: null, startStage: 'stage3' })).toBe('stage3');
    expect(hereStageOf({ cursorStage: null, highestDoneStage: null, startStage: null })).toBe('stage1');
  });
});

describe('STAGE_BUILDS (Appendix A)', () => {
  it('names reading, listening and writing only', () => {
    expect(STAGE_BUILDS).toEqual({
      stage1: ['read', 'listen', 'write'],
      stage2: ['read', 'listen', 'write'],
      stage3: ['read', 'write'],
      stage4: ['listen', 'read'],
      stage5: ['read', 'listen'],
      stage6: ['read', 'write'],
      stage7: ['write'],
    });
  });
});
