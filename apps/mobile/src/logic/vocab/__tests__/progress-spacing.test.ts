import type { VocabItemState, VocabProgress } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays, applyVocabEvents, fellToday, localDay, type VocabEvent } from '../progress';

/**
 * F-VOC-005 P3 as amended by F-CURR-002 section 4.3 (row CM-0b), applied by row CM-12 while
 * `memoryRecord` is on: the spacing rule on topic words, boxes 0-5, the schema unchanged.
 */

// Local wall-clock times, so the local day is the same wherever the suite runs.
const at = (day: number, hour = 15): Date => new Date(2026, 9, day, hour);
const D22 = at(22);
const today = '2026-10-22';
const APPLE = 'vocab:sagwa-apple';
const ON = { spacing: true };

const state = (over: Partial<VocabItemState> = {}): VocabItemState => ({
  id: APPLE,
  first: '2026-10-01',
  seen: 4,
  right: 3,
  bestBox: 3,
  last: '2026-10-15',
  box: 3,
  due: today,
  at: '2026-10-15T10:00:00.000Z',
  ...over,
});
const slice = (...items: VocabItemState[]): VocabProgress => ({ v: 1, items, topics: [] });
const item = (v: VocabProgress) => v.items.find((s) => s.id === APPLE) as VocabItemState;
const answer = (correct: boolean, hinted?: boolean): VocabEvent => ({ type: 'answer', id: APPLE, correct, source: 'speed', ...(hinted ? { hinted } : {}) });

describe('the spacing rule on topic words', () => {
  it('off: the section 3.2 table applies as before (a second right answer the same day rises again)', () => {
    const v = applyVocabEvents(slice(state()), [answer(true), answer(true)], D22);
    expect(item(v).box).toBe(5);
  });

  it('a spaced first-try right answer rises one box; a second right answer the same day changes nothing but the counts', () => {
    const once = applyVocabEvents(slice(state()), [answer(true)], D22, ON);
    expect(item(once)).toMatchObject({ box: 4, due: addDays(today, 14), seen: 5, right: 4, last: today });
    const twice = applyVocabEvents(once, [answer(true)], D22, ON);
    expect(item(twice)).toMatchObject({ box: 4, due: addDays(today, 14), seen: 6, right: 5, at: item(once).at });
  });

  it('a right answer on a word that is not due leaves box, due and the stamp alone', () => {
    const before = state({ due: '2026-10-25' });
    const v = applyVocabEvents(slice(before), [answer(true)], D22, ON);
    expect(item(v)).toEqual({ ...before, seen: 5, right: 4, last: today });
  });

  it('only the first answer of the local day can be spaced: a word answered earlier today is not', () => {
    const v = applyVocabEvents(slice(state({ last: today })), [answer(true)], D22, ON);
    expect(item(v).box).toBe(3);
  });

  it('a new word introduced today stays in box 1 whatever it is answered', () => {
    const v = applyVocabEvents(slice(), [{ type: 'introduced', id: APPLE }, answer(true), answer(true), answer(false), answer(true)], D22, ON);
    expect(item(v)).toMatchObject({ box: 1, due: '2026-10-23', seen: 4 });
  });

  it('a wrong answer falls one box, due tomorrow, at most once a local day', () => {
    const v = applyVocabEvents(slice(state({ box: 5, bestBox: 5 })), [answer(false), answer(false), answer(false)], D22, ON);
    expect(item(v)).toMatchObject({ box: 4, due: '2026-10-23', bestBox: 5, seen: 7 });
    expect(fellToday(item(v), today)).toBe(true);
    const next = applyVocabEvents(v, [answer(false)], at(23), ON);
    expect(item(next).box).toBe(3);
  });

  it('a hinted answer is neither promoted nor demoted; a spaced one is rescheduled from its box', () => {
    const v = applyVocabEvents(slice(state()), [answer(true, true)], D22, ON);
    expect(item(v)).toMatchObject({ box: 3, due: addDays(today, 7), right: 3 });
    const notDue = applyVocabEvents(slice(state({ due: '2026-11-01' })), [answer(true, true)], D22, ON);
    expect(item(notDue)).toMatchObject({ box: 3, due: '2026-11-01', seen: 5, right: 3 });
  });

  it('"Got it" never raises a word that fell today, and still seeds box 2 on a brand-new word', () => {
    const fell = applyVocabEvents(slice(state({ box: 2, bestBox: 2 })), [answer(false), { type: 'self', id: APPLE, known: true }], D22, ON);
    expect(item(fell)).toMatchObject({ box: 1 });
    const fresh = applyVocabEvents(slice(), [{ type: 'introduced', id: APPLE }, { type: 'self', id: APPLE, known: true }], D22, ON);
    expect(item(fresh)).toMatchObject({ box: 2, due: addDays(today, 3), bestBox: 2 });
    const showAgain = applyVocabEvents(slice(state()), [{ type: 'self', id: APPLE, known: false }], D22, ON);
    expect(item(showAgain)).toMatchObject({ box: 1, due: '2026-10-23' });
  });

  it('fellToday reads only the stamp, the due day and the best box', () => {
    const stamp = D22.toISOString();
    expect(fellToday(state({ bestBox: 1, box: 1, due: '2026-10-23', at: stamp }), today)).toBe(false);
    expect(fellToday(state({ box: 2, due: '2026-10-23', at: stamp }), today)).toBe(true);
    expect(fellToday(state({ box: 2, due: '2026-10-25', at: stamp }), today)).toBe(false);
    expect(fellToday(state({ box: 2, due: '2026-10-23', at: 'not a time' }), today)).toBe(false);
  });

  it('S-d (property): any mix of answers and self-marks on one word in one day moves the box by at most one step', () => {
    const eventArb: fc.Arbitrary<VocabEvent> = fc.oneof(
      fc.record({ type: fc.constant('answer' as const), id: fc.constant(APPLE), correct: fc.boolean(), hinted: fc.boolean(), source: fc.constant('speed' as const) }),
      fc.record({ type: fc.constant('self' as const), id: fc.constant(APPLE), known: fc.boolean() }),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: -10, max: 10 }),
        fc.array(eventArb, { minLength: 1, maxLength: 30 }),
        (box, dueOffset, events) => {
          const start = state({ box, bestBox: box, due: addDays(today, dueOffset), last: '2026-10-15' });
          let v = slice(start);
          let sawShowAgain = false;
          for (const [i, e] of events.entries()) {
            v = applyVocabEvents(v, [e], at(22, 8 + Math.floor(i / 4)), ON);
            if (e.type === 'self' && !e.known) sawShowAgain = true;
            const now = item(v);
            expect(now.box - start.box).toBeLessThanOrEqual(1);
            if (!sawShowAgain) expect(start.box - now.box).toBeLessThanOrEqual(1);
            expect(now.box).toBeGreaterThanOrEqual(1);
            expect(now.bestBox).toBeGreaterThanOrEqual(start.bestBox);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('fixed clocks in four time zones (the suite runs under TZ=UTC)', () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  /** Two right answers at two instants: the second rises again only when it is a new local day there. */
  function twoAnswers(zone: string, first: string, second: string): { days: string[]; box: number } {
    process.env.TZ = zone;
    const start = state({ box: 2, bestBox: 2, due: '2026-01-01', last: '2025-12-31' });
    const a = applyVocabEvents(slice(start), [answer(true)], new Date(first), ON);
    // Make the word due again at once, so only the local day decides whether the second answer is spaced.
    const due = { ...a, items: a.items.map((s) => ({ ...s, due: '2026-01-01' })) };
    const b = applyVocabEvents(due, [answer(true)], new Date(second), ON);
    return { days: [localDay(new Date(first)), localDay(new Date(second))], box: item(b).box };
  }

  it('UTC+14 (Pacific/Kiritimati): two answers on one UTC day are two local days', () => {
    const r = twoAnswers('Pacific/Kiritimati', '2026-10-20T09:00:00.000Z', '2026-10-20T11:00:00.000Z');
    expect(r.days).toEqual(['2026-10-20', '2026-10-21']);
    expect(r.box).toBe(4);
  });

  it('UTC-12 (Etc/GMT+12): late evening and just after midnight are two local days', () => {
    const r = twoAnswers('Etc/GMT+12', '2026-10-21T11:00:00.000Z', '2026-10-21T13:00:00.000Z');
    expect(r.days).toEqual(['2026-10-20', '2026-10-21']);
    expect(r.box).toBe(4);
  });

  it('Asia/Seoul: morning and evening of one local day are one day', () => {
    const r = twoAnswers('Asia/Seoul', '2026-10-20T23:30:00.000Z', '2026-10-21T12:00:00.000Z');
    expect(r.days).toEqual(['2026-10-21', '2026-10-21']);
    expect(r.box).toBe(3);
  });

  it('America/Los_Angeles across the end of daylight time (1 November 2026, a 25-hour day) is one local day', () => {
    const r = twoAnswers('America/Los_Angeles', '2026-11-01T07:30:00.000Z', '2026-11-02T07:30:00.000Z');
    expect(r.days).toEqual(['2026-11-01', '2026-11-01']);
    expect(r.box).toBe(3);
  });
});
