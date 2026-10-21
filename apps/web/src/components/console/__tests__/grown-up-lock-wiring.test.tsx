import type { UiLocale } from '@hangul-route/i18n';
import { useEffect, type ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en' };
});

import { GrownUpLock } from '../GrownUpLock';
import { EXPIRED, SIGNED_IN, flush, harness, inputEvent, type Harness } from './lock-harness';

/**
 * F-APP-001 A-4a, the wiring of `GrownUpLock` (A-4a review 2026-10-12): the two effects (the
 * controller for the life of the exemption; a decision per pathname, a background re-check per
 * query), the cover during a re-check and the three buttons, rendered with react-test-renderer
 * (the repo's web tests have no DOM). The controller and the decision have their own tests.
 */
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

/** A grown-up page that records its mounts, so a test can tell "kept" from "remounted". */
function Page({ log }: { log: string[] }): JSX.Element {
  useEffect(() => {
    log.push('mount');
    return () => {
      log.push('unmount');
    };
  }, [log]);
  return <p>roster</p>;
}

interface View {
  pathname: string;
  search?: string;
  exempt?: boolean;
}

function lockTree(h: Harness, log: string[], view: View, onSignInAgain: (url: string) => void = () => undefined): ReactElement {
  return (
    <GrownUpLock pathname={view.pathname} search={view.search} exempt={view.exempt} onSignInAgain={onSignInAgain} environment={h.env}>
      <Page log={log} />
    </GrownUpLock>
  );
}

async function render(h: Harness, log: string[], view: View, onSignInAgain?: (url: string) => void): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(lockTree(h, log, view, onSignInAgain), {
      createNodeMock: (element) => (element.type === 'h1' ? { focus: h.env.touchUnlock.bind(null, -1) } : null),
    });
  });
  return mounted as unknown as ReactTestRenderer;
}

async function settle(): Promise<void> {
  await act(async () => {
    await flush();
  });
}

function byTestId(r: ReactTestRenderer, id: string): ReactTestInstance[] {
  return r.root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);
}

function state(r: ReactTestRenderer): 'pending' | 'open' | 'covered' | 'locked' | 'bare' {
  if (byTestId(r, 'grown-up-lock-pending').length > 0) return 'pending';
  if (byTestId(r, 'grown-up-lock').length > 0) return 'locked';
  if (byTestId(r, 'grown-up-cover').length > 0) return 'covered';
  if (byTestId(r, 'grown-up-content').length > 0) return 'open';
  return 'bare';
}

/** A device read the test releases by hand (a slow IndexedDB). */
function heldDevice(h: Harness): () => void {
  let release: () => void = () => undefined;
  const value = h.device.value;
  h.env.readDevice = () =>
    new Promise<DeviceGateRead>((resolve) => {
      release = () => resolve(value);
    });
  return () => release();
}

describe('GrownUpLock: a decision per pathname', () => {
  it('renders nothing of the page until the decision, then the page (an active sign-in unlock)', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const release = heldDevice(h);
    const r = await render(h, log, { pathname: '/parent' });
    expect(state(r)).toBe('pending');
    expect(log).toEqual([]);
    await act(async () => {
      release();
      await flush();
    });
    expect(state(r)).toBe('open');
    expect(log).toEqual(['mount']);
  });

  it('a new pathname is pending until its own decision: the old page unmounts first', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/parent' });
    await settle();
    const release = heldDevice(h);
    act(() => r.update(lockTree(h, log, { pathname: '/teach/home' })));
    expect(state(r)).toBe('pending');
    expect(log).toEqual(['mount', 'unmount']);
    await act(async () => {
      release();
      await flush();
    });
    expect(state(r)).toBe('open');
  });

  it('X, then Y, then X again before Y decided: the first decision for X is never reused', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/parent' });
    await settle();
    expect(state(r)).toBe('open');
    const release = heldDevice(h);
    act(() => r.update(lockTree(h, log, { pathname: '/teach/home' })));
    act(() => r.update(lockTree(h, log, { pathname: '/parent' })));
    expect(state(r)).toBe('pending');
    await act(async () => {
      release();
      await flush();
    });
    expect(state(r)).toBe('open');
  });

  it('a query-only change keeps the page mounted and re-checks in the background (an unsaved draft survives)', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/teach/space/plan', search: '?id=sp_1&suggest=ln_1' });
    await settle();
    const reads = h.calls.filter((call) => call === 'readDevice').length;
    act(() => r.update(lockTree(h, log, { pathname: '/teach/space/plan', search: '?id=sp_1' })));
    expect(state(r)).toBe('open');
    await settle();
    expect(state(r)).toBe('open');
    expect(log).toEqual(['mount']);
    expect(h.calls.filter((call) => call === 'readDevice').length).toBe(reads + 1);
  });

  it('a query-only change whose background re-check finds the unlock expired shows the lock', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/parent', search: '' });
    await settle();
    h.unlock.value = EXPIRED;
    act(() => r.update(lockTree(h, log, { pathname: '/parent', search: '?lang=ko' })));
    await settle();
    expect(state(r)).toBe('locked');
    expect(log).toEqual(['mount', 'unmount']);
  });
});

describe('GrownUpLock: the exemption', () => {
  it('/signin renders at once; coming back decides again before the page renders', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/parent' });
    await settle();
    expect(state(r)).toBe('open');
    act(() => r.update(lockTree(h, log, { pathname: '/signin', exempt: true })));
    expect(state(r)).toBe('bare');
    const release = heldDevice(h);
    h.unlock.value = EXPIRED; // the unlock ran out while the sign-in page was open
    act(() => r.update(lockTree(h, log, { pathname: '/parent' })));
    expect(state(r)).toBe('pending');
    await act(async () => {
      release();
      await flush();
    });
    expect(state(r)).toBe('locked');
  });

  it('a controller started again (the exemption toggled on the same page) decides again, never reusing the old decision', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/parent' });
    await settle();
    act(() => r.update(lockTree(h, log, { pathname: '/parent', exempt: true })));
    const release = heldDevice(h);
    act(() => r.update(lockTree(h, log, { pathname: '/parent' })));
    expect(state(r)).toBe('pending');
    await act(async () => {
      release();
      await flush();
    });
    expect(state(r)).toBe('open');
  });

  it('starts no controller while exempt: tab switches and clicks do nothing', async () => {
    const h = harness();
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/signin', exempt: true });
    await settle();
    act(() => {
      h.doc.dispatchEvent(new Event('visibilitychange'));
      h.win.dispatchEvent(inputEvent('pointerdown'));
    });
    await settle();
    expect(state(r)).toBe('bare');
    expect(h.calls).toEqual([]);
  });
});

describe('GrownUpLock: covering during a re-check', () => {
  it('leaving the tab covers a page that only an unlock keeps open, without unmounting it; the return opens it again', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/parent' });
    await settle();
    act(() => {
      h.doc.visibilityState = 'hidden';
      h.doc.dispatchEvent(new Event('visibilitychange'));
    });
    expect(state(r)).toBe('covered');
    expect(byTestId(r, 'grown-up-content')[0]?.props['aria-hidden']).toBe(true);
    await act(async () => {
      h.doc.visibilityState = 'visible';
      h.doc.dispatchEvent(new Event('visibilitychange'));
      await flush();
    });
    expect(state(r)).toBe('open');
    expect(byTestId(r, 'grown-up-content')[0]?.props['aria-hidden']).toBeUndefined();
    expect(log).toEqual(['mount']);
  });

  it('a pointer after 15 idle minutes is stopped, covers the page, and the lock replaces it', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/parent' });
    await settle();
    h.unlock.value = EXPIRED;
    const down = inputEvent('pointerdown');
    act(() => {
      h.win.dispatchEvent(down);
    });
    expect(down.defaultPrevented).toBe(true);
    expect(state(r)).toBe('covered');
    await settle();
    expect(state(r)).toBe('locked');
    expect(log).toEqual(['mount', 'unmount']);
    expect(h.calls).toContain('clearConsoleSession');
  });

  it('on a device that cannot lock, a tab switch never covers the page', async () => {
    const h = harness();
    h.device.value = { readable: true, marker: null, hasProfiles: false };
    const log: string[] = [];
    const r = await render(h, log, { pathname: '/teach/home' });
    await settle();
    act(() => {
      h.doc.visibilityState = 'hidden';
      h.doc.dispatchEvent(new Event('visibilitychange'));
      h.doc.visibilityState = 'visible';
      h.doc.dispatchEvent(new Event('visibilitychange'));
    });
    expect(state(r)).toBe('open');
    await settle();
    expect(state(r)).toBe('open');
  });
});

describe('GrownUpLock: the lock screen', () => {
  async function lockedAt(view: View, onSignInAgain?: (url: string) => void): Promise<{ h: Harness; r: ReactTestRenderer }> {
    const h = harness(); // marker pin, trusted epoch, no unlock: Panel A
    const r = await render(h, [], view, onSignInAgain);
    await settle();
    expect(state(r)).toBe('locked');
    return { h, r };
  }

  const press = (r: ReactTestRenderer, id: string): void => {
    const [button] = byTestId(r, id);
    act(() => (button?.props.onClick as () => void)());
  };

  it('moves focus to its heading', async () => {
    const { h } = await lockedAt({ pathname: '/parent' });
    expect(h.calls).toContain('touchUnlock'); // the heading's focus() of the node mock
  });

  it('Use the grown-up PIN opens the learner gate with this page and its query as next', async () => {
    const { h, r } = await lockedAt({ pathname: '/teach/space', search: '?id=sp_1' });
    press(r, 'grown-up-lock-pin');
    expect(h.assigned).toEqual(['/?gate=grown-up&next=%2Fteach%2Fspace%3Fid%3Dsp_1']);
  });

  it('Sign in again hands /signin with this page as next and the language to the sign-out', async () => {
    const urls: string[] = [];
    const { h, r } = await lockedAt({ pathname: '/parent/space', search: 'id=sp_1' }, (url) => urls.push(url));
    press(r, 'grown-up-lock-signin');
    expect(urls).toEqual(['/signin?next=%2Fparent%2Fspace%3Fid%3Dsp_1&lang=en']);
    expect(h.assigned).toEqual([]);
  });

  it('Back to learning clears this tab, then opens the learner home', async () => {
    const { h, r } = await lockedAt({ pathname: '/parent' });
    h.calls.length = 0;
    press(r, 'grown-up-lock-back');
    expect(h.calls).toEqual(['clearGrownUpTab']);
    expect(h.assigned).toEqual(['/?lang=en']);
  });

  it('unmounting stops the controller: later tab switches read nothing', async () => {
    const { h, r } = await lockedAt({ pathname: '/parent' });
    act(() => r.unmount());
    mounted = null;
    h.calls.length = 0;
    act(() => {
      h.doc.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();
    expect(h.calls).toEqual([]);
  });
});
