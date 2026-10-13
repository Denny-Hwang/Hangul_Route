import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeAppActive, type VisibilitySource } from '../app-state.web';

class FakeDocument implements VisibilitySource {
  visibilityState: string = 'visible';
  readonly listeners = new Set<() => void>();
  addEventListener = (_type: 'visibilitychange', fn: () => void): void => {
    this.listeners.add(fn);
  };
  removeEventListener = (_type: 'visibilitychange', fn: () => void): void => {
    this.listeners.delete(fn);
  };
  set(state: string): void {
    this.visibilityState = state;
    this.listeners.forEach((fn) => fn());
  }
}

afterEach(() => vi.unstubAllGlobals());

/**
 * F-VOC-004 §3.8 (S-5): on the web a hidden page (`visibilitychange`, the
 * PWA going to the background or another tab in front) pauses a Challenge
 * round; the page coming back says so.
 */
describe('platform/app-state.web', () => {
  it('reports a hidden document as not active and a visible one as active', () => {
    const doc = new FakeDocument();
    const seen: boolean[] = [];
    const off = subscribeAppActive((active) => seen.push(active), doc);
    doc.set('hidden');
    doc.set('visible');
    expect(seen).toEqual([false, true]);
    off();
    expect(doc.listeners.size).toBe(0);
    doc.set('hidden');
    expect(seen).toEqual([false, true]);
  });

  it('reads the global document by default', () => {
    const doc = new FakeDocument();
    vi.stubGlobal('document', doc);
    const seen: boolean[] = [];
    const off = subscribeAppActive((active) => seen.push(active));
    doc.set('hidden');
    expect(seen).toEqual([false]);
    off();
    expect(doc.listeners.size).toBe(0);
  });

  it('is a no-op with no document (a server render)', () => {
    vi.stubGlobal('document', undefined);
    const fn = vi.fn();
    const off = subscribeAppActive(fn);
    expect(() => off()).not.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });
});
