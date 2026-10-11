import { describe, expect, it } from 'vitest';
import { completeEvent, itemAnsweredEvent, skippedEvent, startEvent } from '../events';
import { gate, placementResult } from './fixtures';

describe('placement telemetry payloads (F-PLC-001 section 3.13, AM-34)', () => {
  it('placement.start carries the legacy length and the mode', () => {
    expect(startEvent('p1', { source: 'home', testLocale: 'es', mode: 'short', revealMode: 'tap', level: '5-7' })).toEqual({
      name: 'placement.start',
      profileId: 'p1',
      payload: { source: 'home', testLocale: 'es', length: 'quick', mode: 'short', revealMode: 'tap', level: '5-7' },
    });
    expect(startEvent('p1', { source: 'profile', testLocale: 'en', mode: 'deep', revealMode: 'always', level: null }).payload).toMatchObject({
      length: 'full',
      mode: 'deep',
      level: null,
    });
  });

  it('placement.item_answered carries ids, codes and counts only (no option text)', () => {
    const event = itemAnsweredEvent('p1', { questionId: 'pitem:a', outcome: 'skipped', chosenOptionId: null, assisted: false, ms: 900 }, 'vocab');
    expect(event).toEqual({
      name: 'placement.item_answered',
      profileId: 'p1',
      payload: { itemId: 'pitem:a', gate: 'vocab', outcome: 'skipped', assisted: false, ms: 900, noSound: false },
    });
  });

  it('placement.item_answered tells a prompt that could not play from the learner\'s "not sure"', () => {
    const silent = itemAnsweredEvent('p1', { questionId: 'pitem:b', outcome: 'skipped', chosenOptionId: null, assisted: false, ms: 300, noSound: true }, 'sound-basic');
    expect(silent.payload).toEqual({ itemId: 'pitem:b', gate: 'sound-basic', outcome: 'skipped', assisted: false, ms: 300, noSound: true });
  });

  it('placement.complete carries the stop reason, level, secure count and the mode (modeOf for old results)', () => {
    const result = placementResult({
      mode: 'deep',
      stopReason: 'cap',
      level: { stage: 'stage2', band: 0 },
      oralStage: 'stage3',
      beyondContent: false,
      gates: [gate('recog', 'decode', 'pass', 3)],
    });
    expect(completeEvent('p1', result)).toEqual({
      name: 'placement.complete',
      profileId: 'p1',
      payload: {
        stopReason: 'cap',
        asked: 1,
        stage: 'stage2',
        band: 0,
        oralStage: 'stage3',
        beyondContent: false,
        strandsSecure: 1,
        mode: 'deep',
      },
    });
    const { mode: _m, ...legacy } = placementResult({ length: 'quick' });
    expect(completeEvent('p1', legacy).payload.mode).toBe('short');
  });

  it('placement.skipped names where it was skipped', () => {
    expect(skippedEvent('p1', 'onboarding')).toEqual({ name: 'placement.skipped', profileId: 'p1', payload: { source: 'onboarding' } });
  });
});
