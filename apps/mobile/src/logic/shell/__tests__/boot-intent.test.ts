import { describe, expect, it, vi } from 'vitest';
import { openBootIntentWhenReady, parseBootIntent } from '../boot-intent';

/**
 * F-APP-001 section 3.9 (PIN path in the learner app) and section 3.11 (boot intents): the
 * learner root reads `gate=grown-up&next=` once, keeps every other query key (the `?lang=`
 * hand-off among them) and takes `next` only when `safeNextPath` accepts it.
 */
describe('parseBootIntent', () => {
  it('gate=grown-up with a grown-up next is the PIN path to that page', () => {
    expect(parseBootIntent('?gate=grown-up&next=%2Fparent')).toEqual({
      intent: { kind: 'grown-up', next: '/parent' },
      search: '',
      changed: true,
    });
    expect(parseBootIntent('?gate=grown-up&next=/teach/space?id=sp_1').intent).toEqual({ kind: 'grown-up', next: '/teach/space?id=sp_1' });
  });

  it('keeps the query of next, escapes included (the console encodes it once)', () => {
    const next = '/teach/space/learner?id=sp_1&learner=lr_2&period=week';
    expect(parseBootIntent(`?gate=grown-up&next=${encodeURIComponent(next)}`).intent).toEqual({ kind: 'grown-up', next });
    const escaped = '/account/billing?checkout=a%3Ab%26c';
    expect(parseBootIntent(`?gate=grown-up&next=${encodeURIComponent(escaped)}`).intent).toEqual({ kind: 'grown-up', next: escaped });
  });

  it('drops a fragment from next', () => {
    expect(parseBootIntent(`?gate=grown-up&next=${encodeURIComponent('/parent#x')}`).intent).toEqual({ kind: 'grown-up', next: '/parent' });
  });

  it('a next that safeNextPath refuses gives no intent, and both keys still leave the address', () => {
    for (const next of ['https://evil.example', '//evil.example', '/', '/browse', '/teacher', '/\\evil', 'javascript:alert(1)', '/teach/../x', '%2F%2Fevil.example', 'x'.repeat(600)]) {
      const parsed = parseBootIntent(`?gate=grown-up&next=${encodeURIComponent(next)}`);
      expect(parsed.intent, next).toBeNull();
      expect(parsed.search, next).toBe('');
      expect(parsed.changed, next).toBe(true);
    }
  });

  it('gate=grown-up without next gives no intent and is removed', () => {
    expect(parseBootIntent('?gate=grown-up')).toEqual({ intent: null, search: '', changed: true });
    expect(parseBootIntent('?gate=grown-up&next=')).toEqual({ intent: null, search: '', changed: true });
  });

  it('leaves lang untouched for the locale hand-off, and keeps other keys in order', () => {
    const parsed = parseBootIntent('?lang=es&gate=grown-up&next=%2Fparent&from=site');
    expect(parsed.intent).toEqual({ kind: 'grown-up', next: '/parent' });
    expect(parsed.search).toBe('?lang=es&from=site');
    expect(new URLSearchParams(parsed.search).get('lang')).toBe('es');
  });

  it('removes every copy of gate and next, and takes the first next', () => {
    const parsed = parseBootIntent('?gate=grown-up&next=%2Fparent&next=%2Fteach&gate=grown-up');
    expect(parsed.intent).toEqual({ kind: 'grown-up', next: '/parent' });
    expect(parsed.search).toBe('');
  });

  it('ignores unknown keys and unknown gate values: nothing read, nothing removed', () => {
    for (const search of ['', '?', '?lang=ko', '?next=%2Fparent', '?gate=other&next=%2Fparent', '?gate=Grown-up&next=%2Fparent', '?x=1&y=2']) {
      const parsed = parseBootIntent(search);
      expect(parsed.intent, search).toBeNull();
      expect(parsed.changed, search).toBe(false);
      expect(parsed.search, search).toBe(search);
    }
  });

  it('accepts a search without the leading question mark', () => {
    expect(parseBootIntent('gate=grown-up&next=%2Fsignin').intent).toEqual({ kind: 'grown-up', next: '/signin' });
  });
});

/**
 * A-6 review: the hook behind `navigation/boot-intent.tsx` opens the PIN screen exactly once,
 * whether the navigator is ready at once or later, and never when the intent is gone.
 */
describe('openBootIntentWhenReady', () => {
  function fakeNavigator(ready: boolean) {
    const listeners = new Set<() => void>();
    const nav = {
      ready,
      isReady: vi.fn(() => nav.ready),
      navigate: vi.fn(),
      addListener: vi.fn((_event: 'state', listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      emit: () => [...listeners].forEach((listener) => listener()),
      listeners,
    };
    return nav;
  }

  function source(next: string | null) {
    let intent = next === null ? null : { kind: 'grown-up' as const, next };
    return {
      peek: vi.fn(() => intent),
      consume: vi.fn(() => {
        intent = null;
      }),
    };
  }

  const PIN_PARAMS = { next: 'GrownUpArea', url: '/parent?id=sp_1', grownUpVia: 'lock' };

  it('a ready navigator: opens the PIN screen once, at once, and listens to nothing', () => {
    const nav = fakeNavigator(true);
    const src = source('/parent?id=sp_1');
    const cleanup = openBootIntentWhenReady(nav, src);
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', PIN_PARAMS);
    expect(src.consume).toHaveBeenCalledTimes(1);
    expect(nav.addListener).not.toHaveBeenCalled();
    cleanup();
  });

  it('a navigator not ready yet: waits for a state change once ready, opens once, then stops listening', () => {
    const nav = fakeNavigator(false);
    const src = source('/parent?id=sp_1');
    openBootIntentWhenReady(nav, src);
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(nav.listeners.size).toBe(1);
    nav.emit();
    expect(nav.navigate).not.toHaveBeenCalled();
    nav.ready = true;
    nav.emit();
    nav.emit();
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', PIN_PARAMS);
    expect(nav.listeners.size).toBe(0);
  });

  it('no intent (or one already taken, as on a remount): nothing happens', () => {
    const nav = fakeNavigator(true);
    openBootIntentWhenReady(nav, source(null));
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(nav.addListener).not.toHaveBeenCalled();

    const src = source('/parent');
    openBootIntentWhenReady(nav, src);
    openBootIntentWhenReady(nav, src);
    expect(nav.navigate).toHaveBeenCalledTimes(1);
  });

  it('the cleanup of an effect that never opened removes its listener', () => {
    const nav = fakeNavigator(false);
    const cleanup = openBootIntentWhenReady(nav, source('/parent'));
    cleanup();
    expect(nav.listeners.size).toBe(0);
    nav.ready = true;
    nav.emit();
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

/**
 * F-BROWSE-001 BR-12b (section 4.3 gate hand-off step 3): `/?gate=browse` opens the PIN screen for All lessons
 * (`PinEntry { next: 'BrowseLessons' }`) over the start screen, or, when the grown-up gate opens directly, the
 * gate hand-off at once. The key leaves the address; every other key stays.
 */
describe('the gate=browse boot intent', () => {
  it('gate=browse is the All lessons intent and leaves the address', () => {
    expect(parseBootIntent('?gate=browse')).toEqual({ intent: { kind: 'browse' }, search: '', changed: true });
    expect(parseBootIntent('gate=browse').intent).toEqual({ kind: 'browse' });
  });

  it('keeps lang for the locale hand-off and other keys in order; every copy of gate leaves', () => {
    const parsed = parseBootIntent('?lang=ko&gate=browse&from=site&gate=browse');
    expect(parsed).toEqual({ intent: { kind: 'browse' }, search: '?lang=ko&from=site', changed: true });
  });

  it('takes no next: a next beside gate=browse is not read and stays where it was', () => {
    expect(parseBootIntent('?gate=browse&next=%2Fparent')).toEqual({ intent: { kind: 'browse' }, search: '?next=%2Fparent', changed: true });
  });

  it('only the exact value: Browse, browse2 and an empty gate are no intent', () => {
    for (const search of ['?gate=Browse', '?gate=browse2', '?gate=', '?gate']) {
      expect(parseBootIntent(search), search).toEqual({ intent: null, search, changed: false });
    }
  });

  function readyNavigator() {
    return { isReady: vi.fn(() => true), navigate: vi.fn(), addListener: vi.fn(() => () => undefined) };
  }
  function browseSource() {
    let intent: { kind: 'browse' } | null = { kind: 'browse' };
    return {
      peek: vi.fn(() => intent),
      consume: vi.fn(() => {
        intent = null;
      }),
    };
  }

  it('a device whose gate asks for the PIN: the PIN screen for All lessons, once', () => {
    const nav = readyNavigator();
    const src = browseSource();
    const open = vi.fn(() => true);
    openBootIntentWhenReady(nav, src, { opensDirectly: () => false, open });
    openBootIntentWhenReady(nav, src, { opensDirectly: () => false, open });
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', { next: 'BrowseLessons' });
    expect(open).not.toHaveBeenCalled();
    expect(src.consume).toHaveBeenCalledTimes(1);
  });

  it('a gate that opens directly (no PIN needed, or the session is open): the hand-off at once, no PIN screen', () => {
    const nav = readyNavigator();
    const src = browseSource();
    const open = vi.fn(() => true);
    openBootIntentWhenReady(nav, src, { opensDirectly: () => true, open });
    expect(open).toHaveBeenCalledTimes(1);
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(src.consume).toHaveBeenCalledTimes(1);
  });

  it('a gate that opens directly but a browser that refuses the pass: the dashboard, with the storage line', () => {
    const nav = readyNavigator();
    const src = browseSource();
    const open = vi.fn(() => false);
    openBootIntentWhenReady(nav, src, { opensDirectly: () => true, open });
    expect(open).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith('ParentDashboard', { browseBlocked: true });
    expect(src.consume).toHaveBeenCalledTimes(1);
  });

  it('with no browse hand-off given (a build that cannot open All lessons), the intent is taken and nothing opens', () => {
    const nav = readyNavigator();
    const src = browseSource();
    openBootIntentWhenReady(nav, src);
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(src.consume).toHaveBeenCalledTimes(1);
  });
});
