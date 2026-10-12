import { describe, expect, it } from 'vitest';
import { MATCH_MIN_COLLECTED, SPEED_MIN_COLLECTED, activityAvailability, suggestActivity } from '../suggest';
import { progress, state, topicRow } from './fixtures';

/** Local noon, so the local day is 2026-10-11 in every time zone the suite runs in. */
const NOW = new Date(2026, 9, 11, 12, 0, 0);
const TODAY = '2026-10-11';
const WORDS = Array.from({ length: 8 }, (_, i) => `vocab:w${i + 1}`);
const caps = { wordIds: WORDS };
const collected = (n: number, extra: Partial<Parameters<typeof state>[1]> = {}) =>
  Array.from({ length: n }, (_, i) => state(`w${i + 1}`, { due: '2026-10-20', ...extra }));

describe('suggestActivity (F-VOC-003 section 3.4, golden table)', () => {
  const rows: { name: string; items: ReturnType<typeof state>[]; last?: string; want: 'learn' | 'speed' }[] = [
    { name: 'nothing collected', items: [], want: 'learn' },
    { name: '3 collected, a session today', items: collected(3), last: TODAY, want: 'learn' },
    { name: '3 collected, all due', items: collected(3, { due: '2026-10-01' }), want: 'learn' },
    { name: '4 collected, more to meet, no session today', items: collected(4), want: 'learn' },
    { name: '4 collected, more to meet, a word due, no session today', items: collected(4, { due: TODAY }), want: 'learn' },
    { name: '4 collected, more to meet, a session earlier', items: collected(4), last: '2026-10-10', want: 'learn' },
    { name: '4 collected, more to meet, Learn done today', items: collected(4), last: TODAY, want: 'speed' },
    { name: 'all collected, nothing due, no session today', items: collected(8), want: 'speed' },
    { name: 'all collected, a session today', items: collected(8), last: TODAY, want: 'speed' },
  ];

  for (const row of rows) {
    it(`${row.name} -> ${row.want}`, () => {
      const p = progress(row.items, row.last ? [topicRow('food', { last: row.last })] : []);
      expect(suggestActivity('food', p, NOW, caps)).toBe(row.want);
    });
  }

  it('only counts words of this topic and sessions of this topic', () => {
    const others = Array.from({ length: 6 }, (_, i) => state(`x${i}`));
    expect(suggestActivity('food', progress(others, [topicRow('animals', { last: TODAY })]), NOW, caps)).toBe('learn');
    const p = progress(collected(5), [topicRow('animals', { last: TODAY })]);
    expect(suggestActivity('food', p, NOW, caps)).toBe('learn');
  });

  it('a topic of fewer than 4 words stays on Learn', () => {
    const small = { wordIds: WORDS.slice(0, 3) };
    expect(suggestActivity('food', progress(collected(3)), NOW, small)).toBe('learn');
  });

  it('never suggests Match', () => {
    const p = progress(collected(8), [topicRow('food', { last: TODAY })]);
    expect(suggestActivity('food', p, NOW, caps)).not.toBe('match');
  });
});

describe('activityAvailability (section 3.4)', () => {
  it('Speed needs as many collected words as the level has options', () => {
    expect(SPEED_MIN_COLLECTED).toBe(4);
    expect(activityAvailability(3, { optionCount: 4, picWordMatch: false }).speed).toBe(false);
    expect(activityAvailability(4, { optionCount: 4, picWordMatch: false }).speed).toBe(true);
    expect(activityAvailability(3, { optionCount: 3, picWordMatch: false }).speed).toBe(true);
    expect(activityAvailability(2, { optionCount: 3, picWordMatch: false }).speed).toBe(false);
  });

  it('Match is hidden without the game, then needs 3 collected words', () => {
    expect(MATCH_MIN_COLLECTED).toBe(3);
    expect(activityAvailability(8, { optionCount: 4, picWordMatch: false }).match).toBe('hidden');
    expect(activityAvailability(2, { optionCount: 4, picWordMatch: true }).match).toBe('not-yet');
    expect(activityAvailability(3, { optionCount: 4, picWordMatch: true }).match).toBe('available');
  });
});
