import { describe, expect, it } from 'vitest';
import {
  TIMER_ADD_MS,
  TIMER_MAX_MS,
  TIMER_PRESETS_MS,
  formatRemaining,
  initialTimer,
  justFinished,
  reduceTimer,
  ringFraction,
  type TimerEvent,
  type TimerState,
} from '../timer';

/** A fake clock: the reducer never reads time itself, every event carries `now`. */
const play = (events: TimerEvent[], from: TimerState = initialTimer()): TimerState =>
  events.reduce((s, e) => reduceTimer(s, e), from);

describe('class timer presets (F-TCH-004 §3.5, TD5)', () => {
  it('offers 30 s, 1, 3 and 5 minutes and a +30 s step', () => {
    expect(TIMER_PRESETS_MS).toEqual([30_000, 60_000, 180_000, 300_000]);
    expect(TIMER_ADD_MS).toBe(30_000);
  });

  it('starts idle and empty', () => {
    expect(initialTimer()).toMatchObject({ status: 'idle', totalMs: 0, remainingMs: 0 });
    expect(ringFraction(initialTimer())).toBe(0);
  });
});

describe('reduceTimer', () => {
  it('start runs a preset and ticks down with the injected clock', () => {
    let s = play([{ type: 'start', ms: 60_000, now: 1_000 }]);
    expect(s).toMatchObject({ status: 'running', totalMs: 60_000, remainingMs: 60_000 });
    s = reduceTimer(s, { type: 'tick', now: 16_000 });
    expect(s.remainingMs).toBe(45_000);
    expect(ringFraction(s)).toBeCloseTo(0.25, 10);
  });

  it('reaches done at zero: remaining 0, ring complete, and justFinished fires once', () => {
    const running = play([{ type: 'start', ms: 30_000, now: 0 }, { type: 'tick', now: 29_000 }]);
    const done = reduceTimer(running, { type: 'tick', now: 31_500 });
    expect(done).toMatchObject({ status: 'done', remainingMs: 0 });
    expect(ringFraction(done)).toBe(1);
    expect(justFinished(running, done)).toBe(true);
    const later = reduceTimer(done, { type: 'tick', now: 40_000 });
    expect(later).toEqual(done);
    expect(justFinished(done, later)).toBe(false);
  });

  it('pause freezes the time left and resume carries on from it', () => {
    const paused = play([
      { type: 'start', ms: 60_000, now: 0 },
      { type: 'tick', now: 10_000 },
      { type: 'pause', now: 20_000 },
    ]);
    expect(paused).toMatchObject({ status: 'paused', remainingMs: 40_000 });
    // Time passing while paused changes nothing.
    expect(reduceTimer(paused, { type: 'tick', now: 500_000 })).toEqual(paused);
    const resumed = play([{ type: 'resume', now: 500_000 }, { type: 'tick', now: 510_000 }], paused);
    expect(resumed).toMatchObject({ status: 'running', remainingMs: 30_000 });
  });

  it('pause and resume are ignored in the wrong state', () => {
    const idle = initialTimer();
    expect(reduceTimer(idle, { type: 'pause', now: 5 })).toEqual(idle);
    const running = play([{ type: 'start', ms: 60_000, now: 0 }]);
    expect(reduceTimer(running, { type: 'resume', now: 10 })).toEqual(running);
    const done = play([{ type: 'start', ms: 30_000, now: 0 }, { type: 'tick', now: 30_000 }]);
    expect(reduceTimer(done, { type: 'pause', now: 31_000 })).toEqual(done);
  });

  it('+30 s adds time in every state', () => {
    const idle = play([{ type: 'add', now: 0 }]);
    expect(idle).toMatchObject({ status: 'idle', totalMs: 30_000, remainingMs: 30_000 });
    const running = play([{ type: 'start', ms: 60_000, now: 0 }, { type: 'add', now: 10_000 }]);
    expect(running).toMatchObject({ status: 'running', totalMs: 90_000, remainingMs: 80_000 });
    const paused = play([{ type: 'start', ms: 60_000, now: 0 }, { type: 'pause', now: 10_000 }, { type: 'add', now: 99_000 }]);
    expect(paused).toMatchObject({ status: 'paused', remainingMs: 80_000 });
  });

  it('+30 s after done starts a fresh 30 s run', () => {
    const done = play([{ type: 'start', ms: 30_000, now: 0 }, { type: 'tick', now: 30_000 }]);
    const again = reduceTimer(done, { type: 'add', now: 40_000 });
    expect(again).toMatchObject({ status: 'running', totalMs: 30_000, remainingMs: 30_000 });
    expect(ringFraction(again)).toBe(0);
  });

  it('an idle timer with time set resumes into a run; an empty idle timer does not', () => {
    const set = play([{ type: 'add', now: 0 }, { type: 'resume', now: 1_000 }, { type: 'tick', now: 11_000 }]);
    expect(set).toMatchObject({ status: 'running', remainingMs: 20_000 });
    expect(reduceTimer(initialTimer(), { type: 'resume', now: 0 })).toEqual(initialTimer());
  });

  it('reset goes back to idle with the full time and an empty ring', () => {
    const reset = play([{ type: 'start', ms: 180_000, now: 0 }, { type: 'tick', now: 60_000 }, { type: 'reset' }]);
    expect(reset).toMatchObject({ status: 'idle', totalMs: 180_000, remainingMs: 180_000 });
    expect(ringFraction(reset)).toBe(0);
  });

  it('caps the time at an hour and ignores a start of zero, negative or not-a-number', () => {
    expect(play([{ type: 'start', ms: 10 * TIMER_MAX_MS, now: 0 }]).totalMs).toBe(TIMER_MAX_MS);
    const full = play([{ type: 'start', ms: TIMER_MAX_MS, now: 0 }, { type: 'add', now: 0 }]);
    expect(full).toMatchObject({ totalMs: TIMER_MAX_MS, remainingMs: TIMER_MAX_MS });
    for (const ms of [0, -5, Number.NaN]) expect(play([{ type: 'start', ms, now: 0 }])).toEqual(initialTimer());
  });

  it('a clock that jumps backwards never adds time', () => {
    const s = play([{ type: 'start', ms: 60_000, now: 10_000 }, { type: 'tick', now: 20_000 }, { type: 'tick', now: 5_000 }]);
    expect(s.remainingMs).toBe(50_000);
    expect(play([{ type: 'tick', now: 25_000 }], s).remainingMs).toBe(30_000);
  });

  it('+30 s that arrives after the time ran out (no tick in between) starts a fresh 30 s run', () => {
    const s = play([{ type: 'start', ms: 30_000, now: 0 }, { type: 'add', now: 40_000 }]);
    expect(s).toMatchObject({ status: 'running', totalMs: 30_000, remainingMs: 30_000 });
  });

  it('a run with no base time (a state built by hand) reads as a full ring, never NaN', () => {
    expect(ringFraction({ status: 'paused', totalMs: 0, remainingMs: 0, lastAt: null, ringBase: 0, ringBaseMs: 0 })).toBe(1);
  });

  it('a pause that lands past zero finishes the timer', () => {
    const s = play([{ type: 'start', ms: 30_000, now: 0 }, { type: 'pause', now: 45_000 }]);
    expect(s).toMatchObject({ status: 'done', remainingMs: 0 });
  });
});

describe('a clock reading that is not a number', () => {
  it('is ignored by every event, so the ring and m:ss never turn into NaN', () => {
    const running = play([{ type: 'start', ms: 60_000, now: 0 }, { type: 'tick', now: 10_000 }]);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (const type of ['tick', 'pause', 'resume', 'add'] as const) {
        expect(reduceTimer(running, { type, now: bad })).toBe(running);
      }
      expect(reduceTimer(initialTimer(), { type: 'start', ms: 60_000, now: bad })).toEqual(initialTimer());
      const paused = reduceTimer(running, { type: 'pause', now: 20_000 });
      expect(reduceTimer(paused, { type: 'resume', now: bad })).toBe(paused);
    }
    const after = reduceTimer(reduceTimer(running, { type: 'tick', now: Number.NaN }), { type: 'tick', now: 20_000 });
    expect(after.remainingMs).toBe(40_000);
    expect(formatRemaining(after.remainingMs)).toBe('0:40');
    expect(Number.isNaN(ringFraction(after))).toBe(false);
  });
});

describe('the ring only fills (meters never drop)', () => {
  it('increases monotonically through ticks, pauses and +30 s, and completes exactly at zero', () => {
    const events: TimerEvent[] = [
      { type: 'start', ms: 60_000, now: 0 },
      { type: 'tick', now: 15_000 },
      { type: 'add', now: 20_000 },
      { type: 'tick', now: 30_000 },
      { type: 'pause', now: 35_000 },
      { type: 'add', now: 36_000 },
      { type: 'tick', now: 90_000 },
      { type: 'resume', now: 90_000 },
      { type: 'tick', now: 100_000 },
      { type: 'add', now: 101_000 },
      { type: 'tick', now: 140_000 },
      { type: 'tick', now: 400_000 },
    ];
    let s = initialTimer();
    let last = ringFraction(s);
    for (const e of events) {
      s = reduceTimer(s, e);
      const f = ringFraction(s);
      expect(f).toBeGreaterThanOrEqual(last);
      expect(f).toBeLessThanOrEqual(1);
      last = f;
    }
    expect(s.status).toBe('done');
    expect(last).toBe(1);
  });

  it('+30 s holds the ring where it is and spreads the rest over the new time left', () => {
    const before = play([{ type: 'start', ms: 60_000, now: 0 }, { type: 'tick', now: 30_000 }]);
    expect(ringFraction(before)).toBeCloseTo(0.5, 10);
    const added = reduceTimer(before, { type: 'add', now: 30_000 });
    expect(ringFraction(added)).toBeCloseTo(0.5, 10);
    // 60 s left now; after 30 s the ring is half way from 0.5 to 1.
    expect(ringFraction(reduceTimer(added, { type: 'tick', now: 60_000 }))).toBeCloseTo(0.75, 10);
  });
});

describe('formatRemaining (m:ss, rounded up so 0:00 means done)', () => {
  it.each([
    [135_000, '2:15'],
    [134_001, '2:15'],
    [59_999, '1:00'],
    [9_000, '0:09'],
    [1, '0:01'],
    [0, '0:00'],
    [-500, '0:00'],
    [TIMER_MAX_MS, '60:00'],
  ])('%d ms -> %s', (ms, text) => {
    expect(formatRemaining(ms)).toBe(text);
  });
});
