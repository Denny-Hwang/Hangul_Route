import { describe, expect, it, vi } from 'vitest';
import { VISIBLE_POLL_MS, VISIBLE_REFRESH_GAP_MS, watchVisibleRefresh, type RefreshEvents, type VisibilitySource } from '../visible-refresh';

/** A fake window: the test fires `focus` or `pageshow`. */
function fakeWindow(): RefreshEvents & { fire: (type: string) => void; count: () => number } {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener: (type: string, l: () => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(l),
    removeEventListener: (type: string, l: () => void) => void listeners.get(type)?.delete(l),
    fire: (type: string) => {
      for (const l of [...(listeners.get(type) ?? [])]) l();
    },
    count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  };
}

/** A fake document: the test sets the state and fires the event. */
function fakeDocument(): VisibilitySource & { state: string; fire: () => void; listeners: number } {
  const listeners = new Set<() => void>();
  const doc = {
    state: 'visible',
    get visibilityState() {
      return doc.state;
    },
    addEventListener: (_type: 'visibilitychange', l: () => void) => void listeners.add(l),
    removeEventListener: (_type: 'visibilitychange', l: () => void) => void listeners.delete(l),
    fire: () => {
      for (const l of [...listeners]) l();
    },
    get listeners() {
      return listeners.size;
    },
  };
  return doc;
}

describe('watchVisibleRefresh (F-LEARN-001 section 3.11: an open console tab reads the roster again)', () => {
  it('reads again when the tab comes back into view, once 30 seconds passed since the last read', () => {
    let t = 1_000;
    const doc = fakeDocument();
    const refresh = vi.fn();
    watchVisibleRefresh(doc, refresh, { now: () => t });
    // Back into view right after the page loaded: no second read yet.
    t += 5_000;
    doc.fire();
    expect(refresh).not.toHaveBeenCalled();
    t += VISIBLE_REFRESH_GAP_MS;
    doc.fire();
    expect(refresh).toHaveBeenCalledTimes(1);
    // The gap counts from that read.
    t += VISIBLE_REFRESH_GAP_MS - 1;
    doc.fire();
    expect(refresh).toHaveBeenCalledTimes(1);
    t += 1;
    doc.fire();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('never reads while the tab is hidden', () => {
    let t = 0;
    const doc = fakeDocument();
    const refresh = vi.fn();
    watchVisibleRefresh(doc, refresh, { now: () => t });
    t += VISIBLE_REFRESH_GAP_MS * 2;
    doc.state = 'hidden';
    doc.fire();
    expect(refresh).not.toHaveBeenCalled();
    doc.state = 'visible';
    doc.fire();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops watching when the page leaves', () => {
    let t = 0;
    const doc = fakeDocument();
    const refresh = vi.fn();
    const stop = watchVisibleRefresh(doc, refresh, { now: () => t });
    expect(doc.listeners).toBe(1);
    stop();
    expect(doc.listeners).toBe(0);
    t += VISIBLE_REFRESH_GAP_MS;
    doc.fire();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('uses the real clock and the 30 second gap by default', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const doc = fakeDocument();
      const refresh = vi.fn();
      watchVisibleRefresh(doc, refresh);
      vi.setSystemTime(VISIBLE_REFRESH_GAP_MS);
      doc.fire();
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(VISIBLE_REFRESH_GAP_MS).toBe(30_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads again when the window gets focus or is shown again (two desktop windows side by side never hide the tab)', () => {
    let t = 0;
    const doc = fakeDocument();
    const win = fakeWindow();
    const refresh = vi.fn();
    watchVisibleRefresh(doc, refresh, { now: () => t, win });
    win.fire('focus');
    expect(refresh).not.toHaveBeenCalled();
    t += VISIBLE_REFRESH_GAP_MS;
    win.fire('focus');
    expect(refresh).toHaveBeenCalledTimes(1);
    // One gap for every trigger: the tab event right after the focus read waits.
    doc.fire();
    expect(refresh).toHaveBeenCalledTimes(1);
    t += VISIBLE_REFRESH_GAP_MS;
    win.fire('pageshow');
    expect(refresh).toHaveBeenCalledTimes(2);
    // A focus on a hidden tab (a window behind another) reads nothing.
    t += VISIBLE_REFRESH_GAP_MS;
    doc.state = 'hidden';
    win.fire('focus');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('a roster page reads slowly while the tab stays in view, never while hidden, and stops with the page', () => {
    let t = 0;
    const doc = fakeDocument();
    const win = fakeWindow();
    let tick: (() => void) | null = null;
    const cleared: unknown[] = [];
    const refresh = vi.fn();
    const stop = watchVisibleRefresh(doc, refresh, {
      now: () => t,
      win,
      pollMs: VISIBLE_POLL_MS,
      setInterval: (fn, ms) => {
        expect(ms).toBe(VISIBLE_POLL_MS);
        tick = fn;
        return 'timer-1';
      },
      clearInterval: (handle) => void cleared.push(handle),
    });
    expect(VISIBLE_POLL_MS).toBeGreaterThan(VISIBLE_REFRESH_GAP_MS);
    t += VISIBLE_POLL_MS;
    tick!();
    expect(refresh).toHaveBeenCalledTimes(1);
    t += VISIBLE_POLL_MS;
    doc.state = 'hidden';
    tick!();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(win.count()).toBe(2);
    stop();
    expect(cleared).toEqual(['timer-1']);
    expect(win.count()).toBe(0);
    expect(doc.listeners).toBe(0);
  });

  it('starts no timer without pollMs, and uses the real timers when none are given', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const doc = fakeDocument();
      const refresh = vi.fn();
      const stopQuiet = watchVisibleRefresh(doc, refresh);
      vi.advanceTimersByTime(VISIBLE_POLL_MS * 2);
      expect(refresh).not.toHaveBeenCalled();
      stopQuiet();
      const stop = watchVisibleRefresh(doc, refresh, { pollMs: VISIBLE_POLL_MS });
      vi.advanceTimersByTime(VISIBLE_POLL_MS);
      expect(refresh).toHaveBeenCalledTimes(1);
      stop();
      vi.advanceTimersByTime(VISIBLE_POLL_MS * 2);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
