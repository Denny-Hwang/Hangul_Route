import { GROWN_UP_BACKGROUND_MS, type GrownUpUnlock } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en' };
});

import { GrownUpLock, GrownUpLockScreen, createGrownUpLockController, lockView, type LockState } from '../GrownUpLock';
import { EPOCH, NOW, SIGNED_IN, flush, harness, type Harness } from './lock-harness';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-3 (sections 7.2, 7.4 and 7.6; CS-2, CS-14, CS-17): the lock drops a
 * tab's unlock after 5 minutes hidden and on the `hr-grownup` lock message, refreshes the PIN owner only through the
 * PIN path, and shows Use a passkey only off `pin` browsers.
 */
const lock = getMessages('en').console.lock;
const PIN_UNLOCK: GrownUpUnlock = { v: 1, at: NOW - 1000, seen: NOW - 1000, src: 'pin', pinEpoch: EPOCH };
const NOPIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/**
 * A harness whose clock moves, whose `clearUnlock` really drops the unlock (and the stored hidden time, as the browser's
 * does), with a fake `hr-grownup` channel and a fake `hr:grownup:hiddenAt`.
 */
function oaHarness(): Harness & { clock: { now: number }; post: (data: unknown) => void; listening: () => boolean; hiddenAt: { value: number | null } } {
  const h = harness();
  const clock = { now: NOW };
  const hiddenAt = { value: null as number | null };
  let listener: ((data: unknown) => void) | null = null;
  h.env.now = () => clock.now;
  h.env.clearUnlock = () => {
    h.calls.push('clearUnlock');
    h.unlock.value = null;
    hiddenAt.value = null;
  };
  h.env.readHiddenAt = () => hiddenAt.value;
  h.env.writeHiddenAt = (at) => {
    hiddenAt.value = at;
  };
  h.env.listenLock = (onMessage) => {
    listener = onMessage;
    return () => {
      listener = null;
    };
  };
  return { ...h, clock, hiddenAt, post: (data) => listener?.(data), listening: () => listener !== null };
}

function recorder(): { states: LockState[]; devices: Array<DeviceGateRead | undefined>; latest: () => LockState | undefined } {
  const states: LockState[] = [];
  const devices: Array<DeviceGateRead | undefined> = [];
  return { states, devices, latest: () => states[states.length - 1] };
}

function start(h: Harness, onPinOpen?: (epoch: number) => void) {
  const r = recorder();
  const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s, d) => (r.states.push(s), r.devices.push(d)), onHide: () => undefined, onPinOpen });
  c.start();
  c.check();
  return { r, c };
}

describe('the 5-minute hidden rule (OA-D16, CS-14)', () => {
  it('a tab hidden for 5 minutes drops its unlock when shown again, then the lock decides', async () => {
    const h = oaHarness();
    h.unlock.value = SIGNED_IN;
    const { r, c } = start(h);
    await flush();
    expect(r.latest()?.decision.state).toBe('open');
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    h.clock.now = NOW + GROWN_UP_BACKGROUND_MS;
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(h.calls).toContain('clearUnlock');
    expect(r.latest()?.decision).toEqual({ state: 'locked', pinPath: true, line: 'default' });
    c.stop();
  });

  it('hidden for less keeps the unlock (wall clock, no timer)', async () => {
    const h = oaHarness();
    h.unlock.value = { ...SIGNED_IN, seen: NOW };
    const { r, c } = start(h);
    await flush();
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    h.clock.now = NOW + GROWN_UP_BACKGROUND_MS - 1;
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(h.calls).not.toContain('clearUnlock');
    expect(r.latest()?.decision.state).toBe('open');
    c.stop();
  });

  it('the hidden time is kept in the tab and cleared when it is shown again', async () => {
    const h = oaHarness();
    h.unlock.value = SIGNED_IN;
    const { c } = start(h);
    await flush();
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(h.hiddenAt.value).toBe(NOW);
    h.clock.now = NOW + 1_000;
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(h.hiddenAt.value).toBeNull();
    c.stop();
  });

  it('a tab the browser discarded while hidden for 5 minutes reloads locked: the stored time decides before the first check', async () => {
    const h = oaHarness();
    h.unlock.value = { ...SIGNED_IN, at: NOW, seen: NOW };
    h.hiddenAt.value = NOW;
    h.clock.now = NOW + 6 * 60_000;
    const { r, c } = start(h);
    await flush();
    expect(h.calls).toContain('clearUnlock');
    expect(h.hiddenAt.value).toBeNull();
    expect(r.latest()?.decision.state).toBe('locked');
    c.stop();
  });

  it('a reload after less than 5 minutes hidden keeps the unlock and forgets the stored time', async () => {
    const h = oaHarness();
    h.unlock.value = { ...SIGNED_IN, at: NOW, seen: NOW };
    h.hiddenAt.value = NOW;
    h.clock.now = NOW + GROWN_UP_BACKGROUND_MS - 1;
    const { r, c } = start(h);
    await flush();
    expect(h.calls).not.toContain('clearUnlock');
    expect(h.hiddenAt.value).toBeNull();
    expect(r.latest()?.decision.state).toBe('open');
    c.stop();
  });

  it('a stored time from a clock that ran backwards drops the unlock (fail closed)', async () => {
    const h = oaHarness();
    h.unlock.value = { ...SIGNED_IN, at: NOW, seen: NOW };
    h.hiddenAt.value = NOW + 60_000;
    const { r, c } = start(h);
    await flush();
    expect(r.latest()?.decision.state).toBe('locked');
    c.stop();
  });

  it('a page loaded while hidden starts its clock, so 5 minutes later it is shown locked', async () => {
    const h = oaHarness();
    h.unlock.value = { ...SIGNED_IN, at: NOW, seen: NOW };
    h.doc.visibilityState = 'hidden';
    const { r, c } = start(h);
    await flush();
    expect(h.hiddenAt.value).toBe(NOW);
    h.clock.now = NOW + GROWN_UP_BACKGROUND_MS;
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(h.calls).toContain('clearUnlock');
    expect(r.latest()?.decision.state).toBe('locked');
    c.stop();
  });

  it('a page left by a navigation keeps no hidden time for the next page of the tab (a Stripe round trip stays open)', async () => {
    for (const order of ['pagehide-first', 'visibility-first'] as const) {
      const h = oaHarness();
      h.unlock.value = { ...SIGNED_IN, at: NOW, seen: NOW };
      const { c } = start(h);
      await flush();
      const hide = (): void => {
        h.doc.visibilityState = 'hidden';
        h.doc.dispatchEvent(new Event('visibilitychange'));
      };
      const pagehide = (): void => {
        const event = new Event('pagehide') as Event & { persisted: boolean };
        event.persisted = false;
        h.win.dispatchEvent(event);
      };
      if (order === 'pagehide-first') {
        pagehide();
        hide();
      } else {
        hide();
        pagehide();
      }
      expect(h.hiddenAt.value).toBeNull();
      c.stop();
    }
  });

  it('storage that throws never breaks the lock', async () => {
    const h = oaHarness();
    h.unlock.value = SIGNED_IN;
    h.env.readHiddenAt = () => {
      throw new Error('blocked');
    };
    h.env.writeHiddenAt = () => {
      throw new Error('blocked');
    };
    const { r, c } = start(h);
    await flush();
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    h.clock.now = NOW + GROWN_UP_BACKGROUND_MS;
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(r.latest()?.decision.state).toBe('locked');
    c.stop();
  });

  it('without its own clearUnlock the environment clears the whole grown-up tab', async () => {
    const h = harness();
    h.unlock.value = SIGNED_IN;
    let now = NOW;
    h.env.now = () => now;
    const { c } = start(h);
    await flush();
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    now = NOW + GROWN_UP_BACKGROUND_MS;
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(h.calls).toContain('clearGrownUpTab');
    c.stop();
  });
});

describe('the hr-grownup lock message (section 7.6, CS-2)', () => {
  it('{ v: 1, kind: "lock" } drops the unlock and shows the lock', async () => {
    const h = oaHarness();
    h.unlock.value = SIGNED_IN;
    const { r, c } = start(h);
    await flush();
    expect(r.latest()?.decision.state).toBe('open');
    h.post({ v: 1, kind: 'lock' });
    await flush();
    expect(h.unlock.value).toBeNull();
    expect(r.latest()?.decision.state).toBe('locked');
    c.stop();
  });

  it('anything else on the channel is ignored, and stop closes it', async () => {
    const h = oaHarness();
    h.unlock.value = SIGNED_IN;
    const { r, c } = start(h);
    await flush();
    for (const data of [{ v: 1, kind: 'open' }, { v: 1, kind: 'lock', extra: 1 }, 'lock', null]) h.post(data);
    await flush();
    expect(h.calls).not.toContain('clearUnlock');
    expect(r.latest()?.decision.state).toBe('open');
    expect(h.listening()).toBe(true);
    c.stop();
    expect(h.listening()).toBe(false);
  });

  it('without a channel (no BroadcastChannel) the lock still runs', async () => {
    const h = harness();
    h.env.listenLock = () => null;
    h.unlock.value = SIGNED_IN;
    const { r, c } = start(h);
    await flush();
    expect(r.latest()?.decision.state).toBe('open');
    c.stop();
  });
});

describe('moment 2: the PIN path refreshes the PIN owner (section 7.2)', () => {
  it('a page opened by a pin unlock with all three epochs equal reports the epoch', async () => {
    const h = oaHarness();
    h.unlock.value = PIN_UNLOCK;
    const seen: number[] = [];
    const { r, c } = start(h, (epoch) => seen.push(epoch));
    await flush();
    expect(r.latest()?.decision.state).toBe('open');
    expect(seen).toEqual([EPOCH]);
    c.stop();
  });

  it('a sign-in unlock, a locked page or an untrusted epoch reports nothing', async () => {
    for (const setup of [
      (h: Harness) => (h.unlock.value = SIGNED_IN),
      (h: Harness) => (h.unlock.value = null),
      (h: Harness) => {
        h.unlock.value = PIN_UNLOCK;
        h.trusted.value = EPOCH - 1;
      },
    ]) {
      const h = oaHarness();
      setup(h);
      const seen: number[] = [];
      const { c } = start(h, (epoch) => seen.push(epoch));
      await flush();
      expect(seen).toEqual([]);
      c.stop();
    }
  });

  it('the decision reports the device read it used', async () => {
    const h = oaHarness();
    const { r, c } = start(h);
    await flush();
    expect(r.devices[r.devices.length - 1]).toEqual(h.device.value);
    c.stop();
  });
});

describe('Use a passkey on the lock screen (section 7.4, design D15)', () => {
  const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const handlers = { onUsePin: () => undefined, onSignInAgain: () => undefined, onBackToLearning: () => undefined };

  it('is drawn under the last button only when a handler is given', () => {
    const html = renderToStaticMarkup(<GrownUpLockScreen decision={{ state: 'locked', pinPath: false, line: 'noPin' }} {...handlers} onUsePasskey={() => undefined} />);
    expect(text(html)).toContain(lock.passkey.cta);
    expect(html.indexOf('grown-up-lock-signin')).toBeLessThan(html.indexOf('grown-up-lock-passkey'));
    expect(renderToStaticMarkup(<GrownUpLockScreen decision={{ state: 'locked', pinPath: false, line: 'noPin' }} {...handlers} />)).not.toContain('grown-up-lock-passkey');
  });

  it('is busy while the passkey runs', () => {
    const html = renderToStaticMarkup(<GrownUpLockScreen decision={{ state: 'locked', pinPath: false, line: 'noPin' }} {...handlers} onUsePasskey={() => undefined} passkeyBusy />);
    expect(html).toMatch(/data-testid="grown-up-lock-passkey"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-testid="grown-up-lock-passkey"/);
    expect(html).toContain('aria-busy="true"');
  });

  it('lockView carries the device of a locked decision only', () => {
    const state: LockState = { path: '/parent', decision: { state: 'locked', pinPath: false, line: 'noPin' }, hidden: false };
    expect(lockView(state, '/parent', NOPIN)).toEqual({ kind: 'locked', decision: state.decision, device: NOPIN });
    expect(lockView(state, '/parent')).toEqual({ kind: 'locked', decision: state.decision });
    expect(lockView({ ...state, decision: { state: 'open' } }, '/parent', NOPIN)).toEqual({ kind: 'open', hidden: false });
  });
});

describe('GrownUpLock wiring: Use a passkey only off pin browsers (CS-17)', () => {
  let mounted: ReactTestRenderer | null = null;
  afterEach(() => {
    act(() => mounted?.unmount());
    mounted = null;
  });

  const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);

  async function render(h: Harness, props: { verifyPasskey?: () => Promise<boolean>; passkeyFlag?: boolean; accountId?: string | null }): Promise<ReactTestRenderer> {
    await act(async () => {
      mounted = create(
        <GrownUpLock pathname="/parent" onSignInAgain={() => undefined} environment={h.env} {...props}>
          <p>page</p>
        </GrownUpLock>,
        { createNodeMock: () => ({ focus: () => undefined }) },
      );
      await flush();
    });
    return mounted as unknown as ReactTestRenderer;
  }

  function passkeyHarness(device: DeviceGateRead, available = true): Harness & { written: number[] } {
    const h = oaHarness();
    const written: number[] = [];
    h.device.value = device;
    h.env.passkeyAvailable = async () => available;
    h.env.writeSignInUnlock = (now) => {
      written.push(now);
      h.unlock.value = { v: 1, at: now, seen: now, src: 'signin' };
    };
    return Object.assign(h, { written });
  }

  it('a nopin browser with a platform authenticator shows the button; success writes the sign-in unlock and opens', async () => {
    const h = passkeyHarness(NOPIN);
    const r = await render(h, { verifyPasskey: async () => true, passkeyFlag: true });
    const button = byTestId(r, 'grown-up-lock-passkey');
    expect(button).toHaveLength(1);
    await act(async () => {
      button[0]?.props.onClick();
      await flush();
      await flush();
    });
    expect(h.written).toEqual([NOW]);
    expect(byTestId(r, 'grown-up-lock')).toHaveLength(0);
  });

  it('a refused passkey returns to the lock with its line and writes nothing', async () => {
    const h = passkeyHarness(NOPIN);
    const r = await render(h, { verifyPasskey: async () => Promise.reject(new Error('NotAllowedError')), passkeyFlag: true });
    await act(async () => {
      byTestId(r, 'grown-up-lock-passkey')[0]?.props.onClick();
      await flush();
    });
    expect(h.written).toEqual([]);
    expect(byTestId(r, 'grown-up-lock')).toHaveLength(1);
  });

  it('a pin browser never shows it, nor one that may be (a failed read, a missing marker with profiles)', async () => {
    for (const device of [
      { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true },
      { readable: false, reason: 'failed' },
      { readable: true, marker: null, hasProfiles: true },
    ] as DeviceGateRead[]) {
      const h = passkeyHarness(device);
      const r = await render(h, { verifyPasskey: async () => true, passkeyFlag: true });
      expect(byTestId(r, 'grown-up-lock')).toHaveLength(1);
      expect(byTestId(r, 'grown-up-lock-passkey')).toHaveLength(0);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('a PIN set in another tab while the passkey ran (the marker is now pin): no unlock, the lock decides again', async () => {
    const h = passkeyHarness(NOPIN);
    let release: (verified: boolean) => void = () => undefined;
    const r = await render(h, { verifyPasskey: () => new Promise<boolean>((resolve) => (release = resolve)), passkeyFlag: true });
    act(() => byTestId(r, 'grown-up-lock-passkey')[0]?.props.onClick());
    h.device.value = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true };
    await act(async () => {
      release(true);
      await flush();
      await flush();
    });
    expect(h.written).toEqual([]);
    expect(byTestId(r, 'grown-up-lock')).toHaveLength(1);
    expect(byTestId(r, 'grown-up-lock-passkey')).toHaveLength(0);
  });

  it('no platform authenticator, the flag off, or no Clerk verifier: no button', async () => {
    for (const [h, props] of [
      [passkeyHarness(NOPIN, false), { verifyPasskey: async () => true, passkeyFlag: true }],
      [passkeyHarness(NOPIN), { verifyPasskey: async () => true, passkeyFlag: false }],
      [passkeyHarness(NOPIN), { passkeyFlag: true }],
    ] as const) {
      const r = await render(h, props);
      expect(byTestId(r, 'grown-up-lock')).toHaveLength(1);
      expect(byTestId(r, 'grown-up-lock-passkey')).toHaveLength(0);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('a page opened through the PIN path asks the environment to refresh the owner for this account', async () => {
    const h = oaHarness();
    h.unlock.value = PIN_UNLOCK;
    const refreshed: string[] = [];
    h.env.refreshPinOwner = async (accountId, epoch) => {
      refreshed.push(`${accountId}:${epoch}`);
    };
    await render(h, { accountId: 'user_1' });
    expect(refreshed).toEqual([`user_1:${EPOCH}`]);
  });

  it('without an account nothing is refreshed', async () => {
    const h = oaHarness();
    h.unlock.value = PIN_UNLOCK;
    const refreshed: string[] = [];
    h.env.refreshPinOwner = async (accountId) => {
      refreshed.push(accountId);
    };
    await render(h, { accountId: null });
    expect(refreshed).toEqual([]);
  });
});
