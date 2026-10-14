import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { msUntilNextUtcDay, utcDayKey, watchDay } from './day-clock';

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
