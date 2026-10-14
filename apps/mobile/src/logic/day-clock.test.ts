import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_BASES, MAX_WAIT_MS, msUntilNextLocalDay, msUntilNextUtcDay, utcDayKey, watchDay } from './day-clock';
import { localDay } from './vocab/progress';

/**
 * The day boundary for screens that stay mounted across midnight (F-ROUTE-001 R-7e). Plan day
 * keys are UTC days (F-PLAN-002 section 3.6), so the boundary is UTC midnight whatever the
 * device's time zone; each case runs under TZ=UTC and under a zone far from UTC.
 */
const ZONES = ['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles'] as const;

function visibilityHub(): { subscribe: (listener: (visible: boolean) => void) => () => void; emit: (visible: boolean) => void; count: () => number } {
  const listeners = new Set<(visible: boolean) => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (visible) => listeners.forEach((l) => l(visible)),
    count: () => listeners.size,
  };
}

describe.each(ZONES)('day clock under TZ=%s', (zone) => {
  let savedTz: string | undefined;
  beforeEach(() => {
    savedTz = process.env.TZ;
    process.env.TZ = zone;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('keys the day by UTC, not by the device zone', () => {
    expect(utcDayKey(new Date('2026-10-13T23:59:00.000Z'))).toBe('2026-10-13');
    expect(utcDayKey(new Date('2026-10-14T00:01:00.000Z'))).toBe('2026-10-14');
  });

  it('measures the time left to the next UTC midnight', () => {
    expect(msUntilNextUtcDay(new Date('2026-10-13T23:59:00.000Z'))).toBe(60_000);
    expect(msUntilNextUtcDay(new Date('2026-10-14T00:00:00.000Z'))).toBe(86_400_000);
    expect(msUntilNextUtcDay(new Date('2026-10-14T12:00:00.000Z'))).toBe(43_200_000);
  });

  it('emits the day at start and turns over on the boundary timer (23:59 to 00:01 UTC)', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    const days: string[] = [];
    const hub = visibilityHub();
    const stop = watchDay({ onDay: (d) => days.push(d), subscribeVisibility: hub.subscribe });
    expect(days).toEqual(['2026-10-13']);
    vi.advanceTimersByTime(59_999);
    expect(days).toEqual(['2026-10-13']);
    vi.advanceTimersByTime(2 * 60_000);
    expect(days).toEqual(['2026-10-13', '2026-10-14']);
    // The next timer is set for the following midnight, a day later.
    vi.advanceTimersByTime(86_400_000);
    expect(days).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    stop();
  });

  it('re-reads the day when the app comes back to the front', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    const days: string[] = [];
    const hub = visibilityHub();
    const stop = watchDay({ onDay: (d) => days.push(d), subscribeVisibility: hub.subscribe });
    // In the background the timer may never run (a suspended app): the clock jumps without it.
    vi.setSystemTime(new Date('2026-10-14T00:01:00.000Z'));
    hub.emit(false);
    expect(days).toEqual(['2026-10-13']);
    hub.emit(true);
    expect(days).toEqual(['2026-10-13', '2026-10-14']);
    stop();
  });

  it('re-reads the day on a new start (the screen coming back into focus)', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    const days: string[] = [];
    const hub = visibilityHub();
    watchDay({ onDay: (d) => days.push(d), subscribeVisibility: hub.subscribe })();
    vi.setSystemTime(new Date('2026-10-14T00:01:00.000Z'));
    watchDay({ onDay: (d) => days.push(d), subscribeVisibility: hub.subscribe })();
    expect(days).toEqual(['2026-10-13', '2026-10-14']);
  });

  it('a timer that fires early waits for the boundary instead of emitting the same day', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    const days: string[] = [];
    let fire: (() => void) | null = null;
    const delays: number[] = [];
    const stop = watchDay({
      onDay: (d) => days.push(d),
      subscribeVisibility: () => () => undefined,
      setTimer: (fn, ms) => {
        fire = fn;
        delays.push(ms);
        return 1;
      },
      clearTimer: () => undefined,
    });
    vi.setSystemTime(new Date('2026-10-13T23:59:59.990Z'));
    (fire as unknown as () => void)();
    expect(days).toEqual(['2026-10-13']);
    expect(delays).toEqual([60_000, 10]);
    stop();
  });

  it('wakes at least hourly and emits only at the boundary (a long timer is unreliable on Android)', () => {
    vi.setSystemTime(new Date('2026-10-13T12:00:00.000Z'));
    const days: string[] = [];
    const delays: number[] = [];
    const stop = watchDay({
      onDay: (d) => days.push(d),
      subscribeVisibility: () => () => undefined,
      setTimer: (fn, ms) => {
        delays.push(ms);
        return setTimeout(fn, ms);
      },
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
    vi.advanceTimersByTime(12 * 3_600_000 - 1);
    expect(days).toEqual(['2026-10-13']);
    vi.advanceTimersByTime(1);
    expect(days).toEqual(['2026-10-13', '2026-10-14']);
    expect(delays.length).toBeGreaterThanOrEqual(12);
    expect(Math.max(...delays)).toBe(MAX_WAIT_MS);
    stop();
  });

  it('stop clears the timer and the visibility listener', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    const days: string[] = [];
    const hub = visibilityHub();
    const stop = watchDay({ onDay: (d) => days.push(d), subscribeVisibility: hub.subscribe });
    expect(hub.count()).toBe(1);
    stop();
    expect(hub.count()).toBe(0);
    vi.advanceTimersByTime(86_400_000);
    hub.emit(true);
    expect(days).toEqual(['2026-10-13']);
  });

  it('a different boundary basis can be passed in (keys and the time left)', () => {
    vi.setSystemTime(new Date('2026-10-13T10:00:00.000Z'));
    const days: string[] = [];
    const stop = watchDay({
      onDay: (d) => days.push(d),
      subscribeVisibility: () => () => undefined,
      keyOf: (now) => (now.getTime() < Date.parse('2026-10-13T10:30:00.000Z') ? 'a' : 'b'),
      msUntilNext: (now) => Math.max(1, Date.parse('2026-10-13T10:30:00.000Z') - now.getTime()),
    });
    vi.advanceTimersByTime(30 * 60_000);
    expect(days).toEqual(['a', 'b']);
    stop();
  });
});

/**
 * The local-day basis (F-VOC-005 P-3b, P5): the Home vocabulary card follows the device's local
 * calendar day, so its boundary is local midnight. Kiritimati is UTC+14, Pago Pago UTC-11.
 */
describe('local day basis', () => {
  let savedTz: string | undefined;
  const inZone = (zone: string): void => {
    process.env.TZ = zone;
  };
  beforeEach(() => {
    savedTz = process.env.TZ;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('under TZ=UTC the local boundary is UTC midnight', () => {
    inZone('UTC');
    expect(msUntilNextLocalDay(new Date('2026-10-13T23:59:00.000Z'))).toBe(60_000);
    expect(DAY_BASES.local.keyOf(new Date('2026-10-13T23:59:00.000Z'))).toBe('2026-10-13');
  });

  it('under TZ=Pacific/Kiritimati (UTC+14) local midnight is 10:00 UTC', () => {
    inZone('Pacific/Kiritimati');
    expect(msUntilNextLocalDay(new Date('2026-10-13T09:59:00.000Z'))).toBe(60_000);
    expect(DAY_BASES.local.keyOf(new Date('2026-10-13T09:59:00.000Z'))).toBe('2026-10-13');
    expect(DAY_BASES.local.keyOf(new Date('2026-10-13T10:01:00.000Z'))).toBe('2026-10-14');
  });

  it('under TZ=Pacific/Pago_Pago (UTC-11) local midnight is 11:00 UTC', () => {
    inZone('Pacific/Pago_Pago');
    expect(msUntilNextLocalDay(new Date('2026-10-13T10:59:00.000Z'))).toBe(60_000);
  });

  it('counts a short day across a daylight-saving change (America/Los_Angeles, 2026-03-08 is 23 hours)', () => {
    inZone('America/Los_Angeles');
    // Local 2026-03-08 00:00 PST is 08:00 UTC; the next local midnight is 2026-03-09 07:00 UTC (PDT).
    expect(msUntilNextLocalDay(new Date('2026-03-08T08:00:00.000Z'))).toBe(23 * 3_600_000);
  });

  it('watchDay on the local basis turns over at local midnight, not at UTC midnight', () => {
    inZone('Pacific/Kiritimati');
    vi.setSystemTime(new Date('2026-10-13T09:59:00.000Z'));
    const days: string[] = [];
    const stop = watchDay({ onDay: (d) => days.push(d), subscribeVisibility: () => () => undefined, ...DAY_BASES.local });
    vi.advanceTimersByTime(2 * 60_000);
    expect(days).toEqual(['2026-10-13', '2026-10-14']);
    // 00:00 UTC (local 14:00) is no boundary on this basis.
    vi.advanceTimersByTime(13 * 3_600_000);
    expect(days).toEqual(['2026-10-13', '2026-10-14']);
    stop();
  });

  it('a zone change while the screen stays in front is caught within an hour, not at the old midnight', () => {
    inZone('UTC');
    vi.setSystemTime(new Date('2026-10-13T20:00:00.000Z'));
    const days: string[] = [];
    const stop = watchDay({ onDay: (d) => days.push(d), subscribeVisibility: () => () => undefined, ...DAY_BASES.local });
    expect(days).toEqual(['2026-10-13']);
    // The device moves to UTC+14: it is now local 2026-10-14 10:00, but the timer was aimed at UTC midnight.
    inZone('Pacific/Kiritimati');
    vi.advanceTimersByTime(MAX_WAIT_MS);
    expect(days).toEqual(['2026-10-13', '2026-10-14']);
    stop();
  });

  it('the local key is the vocabulary schedule key (localDay), the utc key is dayKey', () => {
    inZone('Pacific/Pago_Pago');
    const now = new Date('2026-10-14T05:00:00.000Z');
    expect(DAY_BASES.local.keyOf(now)).toBe(localDay(now));
    expect(DAY_BASES.local.keyOf(now)).toBe('2026-10-13');
    expect(DAY_BASES.utc.keyOf(now)).toBe(utcDayKey(now));
    expect(DAY_BASES.utc.msUntilNext).toBe(msUntilNextUtcDay);
  });
});
