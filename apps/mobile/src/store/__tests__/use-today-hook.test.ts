import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `useToday` itself (F-ROUTE-001 R-7e), not only `watchDay`: the hook's focus effect turns the
 * day over at the boundary timer, on foreground and on a new focus, and stops on blur. The mobile
 * vitest lane has no renderer, so React's `useState`/`useCallback`, React Navigation's
 * `useFocusEffect` and the app's foreground signal are stood in for by a one-component harness.
 */
const harness = vi.hoisted(() => ({
  state: undefined as unknown,
  focusEffect: null as null | (() => void | (() => void)),
  visibility: new Set<(visible: boolean) => void>(),
}));

vi.mock('react', () => ({
  useState: <T,>(init: () => T): [T, (next: T) => void] => {
    if (harness.state === undefined) harness.state = init();
    return [harness.state as T, (next: T) => (harness.state = next)];
  },
  useCallback: <F,>(fn: F): F => fn,
}));
vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    harness.focusEffect = effect;
  },
}));
vi.mock('../../platform/app-visibility', () => ({
  subscribeAppVisibility: (listener: (visible: boolean) => void) => {
    harness.visibility.add(listener);
    return () => harness.visibility.delete(listener);
  },
}));

const { useToday } = await import('../../screens/route/use-today');

/** Focuses the screen: runs the focus effect and returns its cleanup (the blur). */
function focus(): () => void {
  const cleanup = harness.focusEffect?.();
  return typeof cleanup === 'function' ? cleanup : () => undefined;
}

describe.each(['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles'])('useToday under TZ=%s', (zone) => {
  let savedTz: string | undefined;
  beforeEach(() => {
    savedTz = process.env.TZ;
    process.env.TZ = zone;
    vi.useFakeTimers();
    harness.state = undefined;
    harness.focusEffect = null;
    harness.visibility.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('turns over at the next UTC midnight while the screen is in focus', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    expect(useToday()).toBe('2026-10-13');
    const blur = focus();
    vi.advanceTimersByTime(2 * 60_000);
    expect(useToday()).toBe('2026-10-14');
    blur();
  });

  it('reads the day again on foreground and on a new focus, and stops on blur', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    useToday();
    const blur = focus();
    blur();
    expect(harness.visibility.size).toBe(0);
    // Blurred across midnight: nothing moves the day until the screen is focused again.
    vi.setSystemTime(new Date('2026-10-14T00:05:00.000Z'));
    vi.advanceTimersByTime(60 * 60_000);
    expect(useToday()).toBe('2026-10-13');
    const blurAgain = focus();
    expect(useToday()).toBe('2026-10-14');
    // A suspended app: its timer did not run, the foreground signal reads the day.
    vi.setSystemTime(new Date('2026-10-15T08:00:00.000Z'));
    harness.visibility.forEach((listener) => listener(true));
    expect(useToday()).toBe('2026-10-15');
    blurAgain();
  });
});

describe('useToday on the local basis (F-VOC-005 P-3b)', () => {
  let savedTz: string | undefined;
  beforeEach(() => {
    savedTz = process.env.TZ;
    process.env.TZ = 'Pacific/Kiritimati';
    vi.useFakeTimers();
    harness.state = undefined;
    harness.focusEffect = null;
    harness.visibility.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('turns over at local midnight (UTC+14), not at UTC midnight', () => {
    // 09:59 UTC is local 23:59 on 2026-10-13.
    vi.setSystemTime(new Date('2026-10-13T09:59:00.000Z'));
    expect(useToday('local')).toBe('2026-10-13');
    const blur = focus();
    vi.advanceTimersByTime(2 * 60_000);
    expect(useToday('local')).toBe('2026-10-14');
    // UTC midnight (local 14:00) leaves it on the same local day.
    vi.advanceTimersByTime(14 * 3_600_000);
    expect(useToday('local')).toBe('2026-10-14');
    blur();
  });
});
