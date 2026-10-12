import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) } }));
import * as native from '../app-visibility';
import * as web from '../app-visibility.web';

class FakeTarget {
  readonly listeners = new Map<string, Set<() => void>>();
  addEventListener = vi.fn((type: string, fn: () => void) => {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  });
  removeEventListener = vi.fn((type: string, fn: () => void) => {
    this.listeners.get(type)?.delete(fn);
  });
  fire(type: string): void {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
  count(): number {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0);
  }
}

afterEach(() => vi.unstubAllGlobals());

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): on the web, `pagehide` and
 * `visibilitychange` to hidden end the open session; `visibilitychange` to
 * visible and `pageshow` (a page restored from the back/forward cache) let a
 * mounted screen begin a new one.
 */
describe('platform/app-visibility.web', () => {
  it('reads pagehide and a hidden document as hidden, a visible document and pageshow as visible', () => {
    const win = new FakeTarget();
    const doc = Object.assign(new FakeTarget(), { visibilityState: 'visible' as string });
    vi.stubGlobal('addEventListener', win.addEventListener);
    vi.stubGlobal('removeEventListener', win.removeEventListener);
    vi.stubGlobal('document', doc);
    const seen: boolean[] = [];
    const off = web.subscribeAppVisibility((visible) => seen.push(visible));
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    win.fire('pagehide');
    doc.visibilityState = 'visible';
    doc.fire('visibilitychange');
    win.fire('pageshow');
    expect(seen).toEqual([false, false, true, true]);
    off();
    expect(win.count()).toBe(0);
    expect(doc.count()).toBe(0);
  });

  it('does nothing where there is no window or document', () => {
    vi.stubGlobal('addEventListener', undefined);
    vi.stubGlobal('document', undefined);
    const listener = vi.fn();
    const off = web.subscribeAppVisibility(listener);
    expect(() => off()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reads the current page: hidden only when the document says so, visible where there is no document', () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    expect(web.isAppVisible()).toBe(false);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    expect(web.isAppVisible()).toBe(true);
    vi.stubGlobal('document', undefined);
    expect(web.isAppVisible()).toBe(true);
  });

  it('has the same surface as the native file', () => {
    expect(Object.keys(web).sort()).toEqual(Object.keys(native).sort());
  });
});
