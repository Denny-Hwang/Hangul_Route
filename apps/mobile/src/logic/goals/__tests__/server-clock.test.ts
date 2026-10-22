import { describe, expect, it } from 'vitest';
import { cappedNow, readServerTime } from '../server-clock';

/* F-CURR-002 section 13 ("A wrong device clock wins every merge", row CM-17): every goals write is capped at the last server time seen. */

describe('cappedNow', () => {
  const seenAt = readServerTime('2026-10-22T12:00:00.000Z', new Date('2026-10-22T12:00:00.000Z'));

  it('uses the device clock before any server time has been seen', () => {
    const now = new Date('2099-01-01T00:00:00.000Z');
    expect(cappedNow(now, null)).toBe(now);
  });

  it('a right or slow clock is used as it is', () => {
    const right = new Date('2026-10-22T13:00:00.000Z');
    expect(cappedNow(right, seenAt)).toBe(right);
    const slow = readServerTime('2026-10-22T12:00:00.000Z', new Date('2026-10-22T11:00:00.000Z'));
    const device = new Date('2026-10-22T11:30:00.000Z');
    expect(cappedNow(device, slow)).toBe(device);
  });

  it('a clock years ahead writes the server time carried forward by the device time that passed', () => {
    const ahead = readServerTime('2026-10-22T12:00:00.000Z', new Date('2099-01-01T00:00:00.000Z'));
    expect(cappedNow(new Date('2099-01-01T02:00:00.000Z'), ahead).toISOString()).toBe('2026-10-22T14:00:00.000Z');
  });

  it('a device clock that moved back since the reading carries nothing forward', () => {
    const ahead = readServerTime('2026-10-22T12:00:00.000Z', new Date('2099-01-01T00:00:00.000Z'));
    const back = new Date('2098-12-31T00:00:00.000Z');
    expect(cappedNow(back, ahead).toISOString()).toBe('2026-10-22T12:00:00.000Z');
  });

  it('reads only a parseable server time, and an unreadable device clock is kept', () => {
    expect(readServerTime(undefined, new Date())).toBeNull();
    expect(readServerTime('soon', new Date())).toBeNull();
    expect(readServerTime('2026-10-22T12:00:00.000Z', new Date(Number.NaN))).toBeNull();
    const broken = new Date(Number.NaN);
    expect(cappedNow(broken, seenAt)).toBe(broken);
  });
});
