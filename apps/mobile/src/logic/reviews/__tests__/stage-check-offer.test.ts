import { describe, expect, it } from 'vitest';
import { CURR_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import { bestStageStars, ceremonyMotion, headerActionsBelow, shownStageCards, stageCardOpenedEvent, stageOffer, testedOutHint, type StageOfferInput } from '../stage-check-offer';

/**
 * F-CURR-002 sections 4.5, 7.3, 12.2 and OD-1 (row CM-22): what a Stage 2-7 header and ceremony offer. The Stage Check
 * is offered, never required: a finished stage, the switches on, enough rounds and the stage open to the learner.
 */

const base: StageOfferInput = { stage: 'stage2', complete: true, ceremonyOn: true, checkOn: true, playable: true, open: true, bestStars: 0 };

describe('stageOffer', () => {
  it('a finished Stage 2-7 offers its prize and the Stage Check', () => {
    expect(stageOffer(base)).toEqual({ prize: true, check: { bestStars: 0 } });
    expect(stageOffer({ ...base, stage: 'stage7', bestStars: 2 })).toEqual({ prize: true, check: { bestStars: 2 } });
  });

  it('Stage 1 keeps its own header buttons (the Hangul ceremony and the Hangul Check)', () => {
    expect(stageOffer({ ...base, stage: 'stage1' })).toEqual({ prize: false, check: null });
  });

  it('a stage not finished offers nothing: the check never stands in the way of a stage', () => {
    expect(stageOffer({ ...base, complete: false })).toEqual({ prize: false, check: null });
  });

  it('stageChecks off: no prize and no check (latched results stay elsewhere)', () => {
    expect(stageOffer({ ...base, ceremonyOn: false, checkOn: false })).toEqual({ prize: false, check: null });
  });

  it('memoryRecord off with stageChecks on: the ceremony stays, the check hides', () => {
    expect(stageOffer({ ...base, checkOn: false })).toEqual({ prize: true, check: null });
  });

  it('too few playable rounds (Stage 5 books) or a stage the learner cannot open (F-ENT-003): no check', () => {
    expect(stageOffer({ ...base, playable: false }).check).toBeNull();
    expect(stageOffer({ ...base, open: false })).toEqual({ prize: true, check: null });
  });
});

describe('bestStageStars: the best result is kept', () => {
  it('reads the highest stars of the stage entries only; a later lower one never lowers it', () => {
    const reviews = [
      { kind: 'stage-certificate' as const, scope: 'stage2', resultStars: 3 as const },
      { kind: 'stage-certificate' as const, scope: 'stage2', resultStars: 1 as const },
      { kind: 'stage-certificate' as const, scope: 'stage3', resultStars: 2 as const },
      { kind: 'cell-check' as const, scope: 'stage2', resultStars: 3 as const },
      { kind: 'stage-certificate' as const, scope: 'stage1', resultStars: 3 as const },
    ];
    expect(bestStageStars(reviews, 'stage2')).toBe(3);
    expect(bestStageStars(reviews, 'stage3')).toBe(2);
    expect(bestStageStars(reviews, 'stage4')).toBe(0);
    expect(bestStageStars([{ kind: 'stage-certificate', scope: 'stage4' }], 'stage4')).toBe(0);
  });
});

describe('testedOutHint (cell-check.md States, owned by this row)', () => {
  const cells = (spec: string) => [...spec].map((c) => ({ done: c === 'd', testedOut: c === 't' }));

  it('shows while every cell is done or tested out and one is tested out, until the stage latches', () => {
    expect(testedOutHint({ complete: false, cellCheckOn: true, cells: cells('ddtdd') })).toBe(true);
    expect(testedOutHint({ complete: true, cellCheckOn: true, cells: cells('ddtdd') })).toBe(false);
  });

  it('not while a cell is unstarted, when nothing was tested out, or with cellCheck off', () => {
    expect(testedOutHint({ complete: false, cellCheckOn: true, cells: cells('ddt-d') })).toBe(false);
    expect(testedOutHint({ complete: false, cellCheckOn: true, cells: cells('ddddd') })).toBe(false);
    expect(testedOutHint({ complete: false, cellCheckOn: false, cells: cells('ddtdd') })).toBe(false);
    expect(testedOutHint({ complete: false, cellCheckOn: true, cells: [] })).toBe(false);
  });
});

describe('shownStageCards: the stage card slot (CM-23 ships the cards)', () => {
  const prize = [{ id: 'card:a' }, { id: 'card:b' }];
  it('shows the prize cards the learner holds, only while upperCards is on', () => {
    expect(shownStageCards(prize, [{ cardId: 'card:b' }], true)).toEqual([{ id: 'card:b' }]);
    expect(shownStageCards(prize, [{ cardId: 'card:b' }], false)).toEqual([]);
    expect(shownStageCards([], [{ cardId: 'card:b' }], true)).toEqual([]);
  });
});

describe('ceremonyMotion (F-MOTION-003): the reduced-motion ceremony', () => {
  it('drops in with sparkles after 400 ms; with reduced motion, everything at once', () => {
    expect(ceremonyMotion(false)).toEqual({ drop: true, sparkles: true, delayMs: 400 });
    expect(ceremonyMotion(true)).toEqual({ drop: false, sparkles: false, delayMs: 0 });
  });
});

describe('stage.card_opened (goal G5, section 11.3)', () => {
  it('carries the stage only, and parses against the Worker list', () => {
    const event = stageCardOpenedEvent('p1', 'stage2');
    expect(event).toEqual({ name: 'stage.card_opened', profileId: 'p1', payload: { stage: 'stage2' } });
    expect(CURR_TELEMETRY_PAYLOADS['stage.card_opened'].safeParse(event?.payload).success).toBe(true);
    expect(stageCardOpenedEvent('p1', 'stage9' as never)).toBeNull();
  });
});

describe('headerActionsBelow: a Stage 2-7 header at large text (C at 320 px)', () => {
  it('keeps the buttons beside the pill at the Standard and Large settings, under the header from Larger up', () => {
    expect(headerActionsBelow(1)).toBe(false);
    expect(headerActionsBelow(1.15)).toBe(false);
    expect(headerActionsBelow(1.3)).toBe(true);
    expect(headerActionsBelow(1.5)).toBe(true);
  });
});
