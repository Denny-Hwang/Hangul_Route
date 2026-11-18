import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { withStaticSplashRemoved as nativeWrap } from '../static-splash';
import { STATIC_SPLASH_ID, removeStaticSplash, withStaticSplashRemoved } from '../static-splash.web';

/** AMENDMENTS-FINISH-2026-11 FN-2: the app removes the HTML shell's splash on its first frame. */
describe('platform/static-splash.web', () => {
  it('removes the element with the splash id, once', () => {
    const remove = vi.fn();
    const ids: string[] = [];
    const doc = { getElementById: (id: string) => (ids.push(id), ids.length === 1 ? { remove } : null) };
    removeStaticSplash(doc);
    removeStaticSplash(doc);
    expect(ids).toEqual([STATIC_SPLASH_ID, STATIC_SPLASH_ID]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('never throws: no document, a document that throws', () => {
    expect(() => removeStaticSplash(undefined)).not.toThrow();
    expect(() => removeStaticSplash({ getElementById: () => { throw new Error('detached'); } })).not.toThrow();
  });

  it('wraps a root without changing what it draws, and names it after the root', () => {
    function Learner(props: { who: string }) {
      return createElement('span', null, props.who);
    }
    const Wrapped = withStaticSplashRemoved(Learner);
    expect(Wrapped.displayName).toBe('StaticSplashRemoved(Learner)');
    expect(nativeWrap(Learner)).toBe(Learner);
  });
});
