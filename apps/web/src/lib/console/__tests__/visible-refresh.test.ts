import { describe, expect, it, vi } from 'vitest';
import { VISIBLE_REFRESH_GAP_MS, watchVisibleRefresh, type VisibilitySource } from '../visible-refresh';

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
    watchVisibleRefresh(doc, refresh, () => t);
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
    watchVisibleRefresh(doc, refresh, () => t);
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
    const stop = watchVisibleRefresh(doc, refresh, () => t);
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
});
