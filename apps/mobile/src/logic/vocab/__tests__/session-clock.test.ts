import { describe, expect, it } from 'vitest';
import {
  CLOCK_BASE_MS,
  FEW_SECONDS_LEFT_MS,
  MAX_TICK_MS,
  TICK_INTERVAL_MS,
  clockBar,
  clockFor,
  fewSecondsLeft,
  formatClock,
  tickDelta,
} from '../session-clock';

describe('clockFor (F-VOC-004 §3.4, S1)', () => {
  it('Relaxed has no clock at all, whatever the scale', () => {
    expect(clockFor('relaxed', 1)).toBeNull();
    expect(clockFor('relaxed', 2)).toBeNull();
  });

  it('Challenge is one 60 s session clock times the scale', () => {
    expect(CLOCK_BASE_MS).toBe(60_000);
    expect(clockFor('challenge', 1)).toBe(60_000);
    expect(clockFor('challenge', 1.5)).toBe(90_000);
    expect(clockFor('challenge', 2)).toBe(120_000);
  });
});

describe('formatClock', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatClock(42_000)).toBe('0:42');
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(90_000)).toBe('1:30');
    expect(formatClock(120_000)).toBe('2:00');
    expect(formatClock(5_000)).toBe('0:05');
  });

  it('rounds seconds up, so 0:00 shows only when the time is really over', () => {
    expect(formatClock(41_001)).toBe('0:42');
    expect(formatClock(59_999)).toBe('1:00');
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });

  it('reads negative or non-finite input as no time left', () => {
    expect(formatClock(-500)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(Number.NEGATIVE_INFINITY)).toBe('0:00');
  });
});

describe('clockBar', () => {
  it('is full at the start and empty at zero', () => {
    expect(clockBar(60_000, 60_000)).toBe(1);
    expect(clockBar(0, 60_000)).toBe(0);
  });

  it('steps in 1/60, so a 60 s bar moves at most once a second', () => {
    expect(clockBar(30_000, 60_000)).toBeCloseTo(30 / 60, 10);
    // Anything inside one second shows the same step (rounded up, like the digits).
    expect(clockBar(29_001, 60_000)).toBeCloseTo(30 / 60, 10);
    expect(clockBar(29_999, 60_000)).toBeCloseTo(30 / 60, 10);
    expect(clockBar(1, 60_000)).toBeCloseTo(1 / 60, 10);
  });

  it('a longer clock still has 60 steps (one every 2 s at 2x)', () => {
    expect(clockBar(118_001, 120_000)).toBe(1);
    expect(clockBar(117_999, 120_000)).toBeCloseTo(59 / 60, 10);
  });

  it('every value over a whole round is one of the 61 steps and never grows as time runs down', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let ms = 60_000; ms >= 0; ms -= 250) {
      const fill = clockBar(ms, 60_000);
      expect(Math.round(fill * 60)).toBeCloseTo(fill * 60, 9);
      expect(fill).toBeLessThanOrEqual(previous);
      previous = fill;
    }
  });

  it('clamps to 0..1 and treats a missing total as empty', () => {
    expect(clockBar(90_000, 60_000)).toBe(1);
    expect(clockBar(-10, 60_000)).toBe(0);
    expect(clockBar(10_000, 0)).toBe(0);
    expect(clockBar(10_000, -5)).toBe(0);
    expect(clockBar(Number.NaN, 60_000)).toBe(0);
  });
});

describe('fewSecondsLeft (§3.8: static words, no blink or colour change)', () => {
  it('is true only inside the last 10 seconds and before the end', () => {
    expect(FEW_SECONDS_LEFT_MS).toBe(10_000);
    expect(fewSecondsLeft(10_000)).toBe(true);
    expect(fewSecondsLeft(1)).toBe(true);
    expect(fewSecondsLeft(10_001)).toBe(false);
    expect(fewSecondsLeft(0)).toBe(false);
    expect(fewSecondsLeft(Number.NaN)).toBe(false);
  });
});

describe('tickDelta (the useSpeedClock delta rule)', () => {
  it('drives at 250 ms and caps a delta at 2 s so a long freeze does not end a round', () => {
    expect(TICK_INTERVAL_MS).toBe(250);
    expect(MAX_TICK_MS).toBe(2_000);
    expect(tickDelta(1_000, 1_250)).toBe(250);
    // A tab throttled to 1 Hz still counts the real elapsed second.
    expect(tickDelta(1_000, 2_000)).toBe(1_000);
    expect(tickDelta(1_000, 31_000)).toBe(2_000);
  });

  it('never goes backwards and ignores garbage', () => {
    expect(tickDelta(2_000, 1_000)).toBe(0);
    expect(tickDelta(Number.NaN, 1_000)).toBe(0);
    expect(tickDelta(0, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
