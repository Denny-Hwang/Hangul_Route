import type { MemoryItemState } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../vocab/srs';
import { LADDER_DONE, MEMORY_BOX_DAYS, applyAnswer, isItemDue, lagBucket, meetState, type Answer, type DayFacts } from '../spacing';

/**
 * F-CURR-002 section 4.3 (row CM-12): the spacing rule over boxes 0-7, the idle-hint exception and
 * the rungs. Scenario S-d is the fast-check property at the end: any number of answers to one item
 * on one local day moves its box by at most 1 up or 1 down.
 */

const AT = '2026-10-22T09:00:00.000Z';
const LATER = '2026-10-22T10:00:00.000Z';
const today = '2026-10-22';

const right: Answer = { correct: true, rung: 'read' };
const wrong: Answer = { correct: false, rung: 'read' };
const hinted: Answer = { correct: true, hinted: true, rung: 'read' };

const state = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 3, d: today, c: 1, r: 1, n: 4, f: '2026-10-01', s: 3, at: '2026-10-15T09:00:00.000Z', ...over });

describe('the box rules with the spacing rule', () => {
  it('box 0 is not met: the first answer meets the item at box 1, due tomorrow, first day today, and is not spaced', () => {
    for (const answer of [right, wrong, hinted]) {
      const out = applyAnswer(undefined, {}, answer, today, AT);
      expect(out.met).toBe(true);
      expect(out.spaced).toBe(false);
      expect(out.state).toMatchObject({ b: 1, d: '2026-10-23', f: today, s: 1, n: 1, at: AT });
      expect(out.fell).toBe(false);
    }
    expect(applyAnswer(state({ b: 0, d: null, s: 0 }), {}, right, today, AT).met).toBe(true);
  });

  it('every in-quest answer on the day of meeting leaves the box at 1, due tomorrow', () => {
    let s = applyAnswer(undefined, {}, right, today, AT);
    for (let i = 0; i < 5; i += 1) s = applyAnswer(s.state, s.facts, right, today, LATER);
    expect(s.state).toMatchObject({ b: 1, d: '2026-10-23', n: 6 });
  });

  it('a spaced, first-try, unhinted right answer moves the box up one and schedules it by the new box', () => {
    const out = applyAnswer(state({ b: 3, d: today }), {}, right, today, AT);
    expect(out.spaced).toBe(true);
    expect(out.state).toMatchObject({ b: 4, d: addDays(today, 14), s: 4, n: 5, at: AT });
  });

  it('an overdue item counts as due', () => {
    expect(applyAnswer(state({ d: '2026-09-01' }), {}, right, today, AT).spaced).toBe(true);
    expect(isItemDue(state({ d: '2026-09-01' }), today)).toBe(true);
    expect(isItemDue(state({ d: '2026-10-23' }), today)).toBe(false);
    expect(isItemDue(state({ b: 0, d: today }), today)).toBe(false);
    expect(isItemDue(state({ d: null }), today)).toBe(false);
  });

  it('boxes 6 and 7 come back after 60 and 120 days, and the box never passes 7', () => {
    expect(MEMORY_BOX_DAYS).toEqual([0, 1, 3, 7, 14, 30, 60, 120]);
    expect(applyAnswer(state({ b: 5, s: 5 }), {}, right, today, AT).state).toMatchObject({ b: 6, d: addDays(today, 60) });
    expect(applyAnswer(state({ b: 6, s: 6 }), {}, right, today, AT).state).toMatchObject({ b: 7, d: addDays(today, 120) });
    expect(applyAnswer(state({ b: 7, s: 7 }), {}, right, today, AT).state).toMatchObject({ b: 7, d: addDays(today, 120) });
  });

  it('a right answer to an item that is not due changes neither the box nor the due day nor the clock', () => {
    const before = state({ d: '2026-10-25' });
    const out = applyAnswer(before, {}, { correct: true, rung: 'recognize' }, today, AT);
    expect(out.spaced).toBe(false);
    expect(out.state).toEqual({ ...before, n: 5 });
  });

  it('only the first answer of the local day is spaced', () => {
    const first = applyAnswer(state({ d: today }), { l: '2026-10-21' }, hinted, today, AT);
    expect(first.spaced).toBe(true);
    // A second device-local answer on the same day is not spaced, even if the item were still due.
    const again = applyAnswer(state({ d: today }), first.facts, right, today, LATER);
    expect(again.spaced).toBe(false);
    expect(again.state.b).toBe(3);
  });

  it('a wrong first try lowers the box by one, never below 1, and makes it due tomorrow, spaced or not', () => {
    const spaced = applyAnswer(state({ b: 4, s: 4 }), {}, wrong, today, AT);
    expect(spaced.state).toMatchObject({ b: 3, d: '2026-10-23', s: 4, at: AT });
    expect(spaced.fell).toBe(true);
    expect(spaced.lapse).toBe(true);
    const notDue = applyAnswer(state({ b: 4, s: 4, d: '2026-11-01' }), {}, wrong, today, AT);
    expect(notDue.state).toMatchObject({ b: 3, d: '2026-10-23' });
    expect(notDue.lapse).toBe(false);
    const floor = applyAnswer(state({ b: 1, s: 2, d: '2026-11-01' }), {}, wrong, today, AT);
    expect(floor.state).toMatchObject({ b: 1, d: '2026-10-23' });
    expect(floor.fell).toBe(false);
  });

  it('falls at most once a local day: one hard quest cannot take a box from 5 to 1', () => {
    let s = applyAnswer(state({ b: 5, s: 5 }), {}, wrong, today, AT);
    for (let i = 0; i < 6; i += 1) s = applyAnswer(s.state, s.facts, wrong, today, LATER);
    expect(s.state.b).toBe(4);
    // The next local day it can fall again.
    const next = applyAnswer(s.state, s.facts, wrong, '2026-10-23', '2026-10-23T09:00:00.000Z');
    expect(next.state.b).toBe(3);
  });

  it('a hinted answer is neither promoted nor demoted; a spaced one is rescheduled from its box', () => {
    const spaced = applyAnswer(state({ b: 3 }), {}, hinted, today, AT);
    expect(spaced.state).toMatchObject({ b: 3, d: addDays(today, 7) });
    expect(spaced.lapse).toBe(false);
    const notDue = state({ b: 3, d: '2026-11-01' });
    expect(applyAnswer(notDue, {}, hinted, today, AT).state).toEqual({ ...notDue, n: 5 });
  });

  it('the best box only grows', () => {
    const out = applyAnswer(state({ b: 2, s: 5 }), {}, wrong, today, AT);
    expect(out.state.s).toBe(5);
  });

  it('records lag, durable and newly held for the day counts', () => {
    const lag = applyAnswer(state({ b: 3, d: today }), { p: '2026-10-14' }, right, today, AT);
    expect(lag.lagDays).toBe(8);
    expect(lag.durable).toBe(true);
    expect(lag.facts).toMatchObject({ l: today, p: today, w: today });
    const short = applyAnswer(state({ b: 2, s: 2, d: today }), { p: '2026-10-19' }, right, today, AT);
    expect(short.lagDays).toBe(3);
    expect(short.durable).toBe(false);
    expect(short.newHeld).toBe(true);
    // With no spaced answer before, the lag runs from the first day.
    expect(applyAnswer(state({ f: '2026-10-21', d: today }), {}, right, today, AT).lagDays).toBe(1);
    expect(applyAnswer(state({ d: '2026-10-25' }), {}, right, today, AT).lagDays).toBeNull();
    expect(applyAnswer(state({ b: 3, s: 3 }), {}, right, today, AT).newHeld).toBe(false);
  });

  it('a seeded item’s first check moves its schedule but is not measured: no lag, not durable, not a lapse, not newly held', () => {
    // Seeded at box 2 from a quest of 1 September, due today: n = 0, no facts on this device.
    const seededState = state({ b: 2, s: 2, d: today, c: 0, r: 0, n: 0, f: '2026-09-01' });
    const first = applyAnswer(seededState, {}, right, today, AT);
    expect(first).toMatchObject({ seeded: true, spaced: true, lagDays: null, durable: false, newHeld: false, lapse: false });
    expect(first.state).toMatchObject({ b: 3, d: addDays(today, 7), n: 1, s: 3 });
    expect(first.facts).toMatchObject({ l: today, p: today });
    expect(first.facts.w).toBeUndefined();
    const miss = applyAnswer(seededState, {}, wrong, today, AT);
    expect(miss).toMatchObject({ seeded: true, spaced: true, lagDays: null, lapse: false, fell: true });
    // Its next spaced answer is measured from that first check.
    const next = applyAnswer(first.state, first.facts, right, addDays(today, 7), AT);
    expect(next).toMatchObject({ seeded: false, lagDays: 7, durable: true });
  });

  it('an item answered on another device (no previous spaced day here) is measured from the day its schedule last moved', () => {
    // Raised to box 3 on another device on 15 October (due 7 days later): lag 7, not 21 from its first day.
    const elsewhere = state({ b: 3, s: 3, d: today, f: '2026-10-01' });
    expect(applyAnswer(elsewhere, {}, right, today, AT)).toMatchObject({ lagDays: 7, durable: true });
    // Never before the first day.
    expect(applyAnswer(state({ b: 4, s: 4, d: today, f: '2026-10-20' }), {}, right, today, AT).lagDays).toBe(2);
  });

  it('lag buckets follow section 11.3', () => {
    expect([0, 1, 2, 3, 4, 7, 8, 14, 15, 30, 31, 400].map(lagBucket)).toEqual(['0-1', '0-1', '2-3', '2-3', '4-7', '4-7', '8-14', '8-14', '15-30', '15-30', '31+', '31+']);
  });
});

describe('the rungs r and c', () => {
  it('a first-try right answer at rung c sets its bit and moves c up one rung', () => {
    const out = applyAnswer(state({ c: 0, r: 0, d: '2026-11-01' }), {}, { correct: true, rung: 'recognize' }, today, AT);
    expect(out.state).toMatchObject({ c: 1, r: 1, at: AT });
  });

  it('a right answer at a higher rung also sets the lower bits', () => {
    const out = applyAnswer(state({ c: 0, r: 0, d: '2026-11-01' }), {}, { correct: true, rung: 'produce' }, today, AT);
    expect(out.state).toMatchObject({ c: LADDER_DONE, r: 7 });
  });

  it('a right answer below c leaves c and keeps r', () => {
    const before = state({ c: 2, r: 3, d: '2026-11-01' });
    expect(applyAnswer(before, {}, { correct: true, rung: 'recognize' }, today, AT).state).toMatchObject({ c: 2, r: 3, at: before.at });
  });

  it('a miss at produce sets c back to read and keeps the produce bit', () => {
    const out = applyAnswer(state({ c: LADDER_DONE, r: 7, d: '2026-11-01' }), {}, { correct: false, rung: 'produce' }, today, AT);
    expect(out.state).toMatchObject({ c: 1, r: 7 });
  });

  it('a hinted answer passes no rung', () => {
    const out = applyAnswer(state({ c: 0, r: 0, d: '2026-11-01' }), {}, { correct: true, hinted: true, rung: 'produce' }, today, AT);
    expect(out.state).toMatchObject({ c: 0, r: 0 });
  });

  it('a miss below produce leaves the rungs', () => {
    expect(applyAnswer(state({ c: 1, r: 1, d: '2026-11-01' }), {}, { correct: false, rung: 'read' }, today, AT).state).toMatchObject({ c: 1, r: 1 });
  });
});

describe('meetState', () => {
  it('is box 1, due tomorrow, best box 1, no rungs and no reps', () => {
    expect(meetState(today, AT)).toEqual({ b: 1, d: '2026-10-23', c: 0, r: 0, n: 0, f: today, s: 1, at: AT });
  });
});

describe('S-d (property): any number of answers to one item in one local day moves the box by at most one', () => {
  const answerArb: fc.Arbitrary<Answer> = fc.record({
    correct: fc.boolean(),
    hinted: fc.boolean(),
    rung: fc.constantFrom('recognize' as const, 'read' as const, 'produce' as const),
  });
  const stateArb: fc.Arbitrary<MemoryItemState> = fc
    .record({
      b: fc.integer({ min: 1, max: 7 }),
      dueOffset: fc.integer({ min: -40, max: 40 }),
      c: fc.integer({ min: 0, max: 3 }),
      r: fc.integer({ min: 0, max: 7 }),
      n: fc.integer({ min: 0, max: 50 }),
      extra: fc.integer({ min: 0, max: 3 }),
    })
    .map(({ b, dueOffset, c, r, n, extra }) => ({ b, d: addDays(today, dueOffset), c, r, n, f: '2026-01-01', s: Math.min(7, b + extra), at: '2026-10-01T00:00:00.000Z' }));
  const factsArb: fc.Arbitrary<DayFacts> = fc.record({ l: fc.option(fc.constantFrom('2026-10-20', '2026-10-21'), { nil: undefined }) }, { requiredKeys: [] });

  it('rises by 1 or less and falls by 1 or less, whatever the answers', () => {
    fc.assert(
      fc.property(stateArb, factsArb, fc.array(answerArb, { minLength: 1, maxLength: 40 }), (start, facts, answers) => {
        let s = start;
        let f = facts;
        for (const [i, a] of answers.entries()) {
          const out = applyAnswer(s, f, a, today, `2026-10-22T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`);
          s = out.state;
          f = out.facts;
          expect(s.b).toBeGreaterThanOrEqual(1);
          expect(s.b).toBeLessThanOrEqual(7);
          expect(s.b - start.b).toBeLessThanOrEqual(1);
          expect(start.b - s.b).toBeLessThanOrEqual(1);
          expect(s.s).toBeGreaterThanOrEqual(start.s);
          expect(s.r & start.r).toBe(start.r);
          expect(s.n).toBe(start.n + i + 1);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('an item met that day stays in box 1 all day', () => {
    fc.assert(
      fc.property(fc.array(answerArb, { minLength: 1, maxLength: 30 }), (answers) => {
        let out = applyAnswer(undefined, {}, answers[0] as Answer, today, AT);
        for (const a of answers.slice(1)) out = applyAnswer(out.state, out.facts, a, today, LATER);
        expect(out.state.b).toBe(1);
        expect(out.state.d).toBe('2026-10-23');
      }),
    );
  });
});
