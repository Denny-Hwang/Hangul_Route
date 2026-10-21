import { GROWN_UP_FRESH_PIN_MS, type GrownUpUnlock, type PinOwner } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';

const ui = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: ui.locale as UiLocale, messages: i18n.getMessages(ui.locale as UiLocale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => ui.locale };
});

import type { SecretReverify } from '../auth-context';
import { PinCards, observeSeenInView, type PinCardsEnvironment } from '../PinCards';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-3 (sections 7.2 moment 3 and 7.6; design console-pin.md boards 9 to
 * 12, D13, D14): the persona-home cards. The set-a-PIN card shows once on a `nopin` browser; the PIN-owner card shows
 * only inside the 2-minute window after a fresh PIN for an account that does not own the PIN, and writes `pinOwner`
 * only after a password or code reverification.
 */
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;
const OWNER = 'a1b2c3d4e5f60718';
const PIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true };
const NOPIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
const NONE: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: true };
const FRESH: GrownUpUnlock = { v: 1, at: NOW - 30_000, seen: NOW - 30_000, src: 'pin', pinEpoch: EPOCH };

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  ui.locale = 'en';
});

interface Fake extends PinCardsEnvironment {
  log: string[];
  device: { value: DeviceGateRead };
  timers: Array<{ run: () => void; ms: number; cleared: boolean }>;
  clock: { now: number };
  unlock: { value: GrownUpUnlock | null };
  /** The `observeSeen` callbacks the cards registered (the card in view in a visible tab). */
  seenBy: Array<() => void>;
}

function fake(over: { device?: DeviceGateRead; unlock?: GrownUpUnlock | null; stored?: PinOwner | null; seen?: boolean | null; write?: boolean; origin?: string } = {}): Fake {
  const log: string[] = [];
  const device = { value: over.device ?? PIN };
  const timers: Fake['timers'] = [];
  const clock = { now: NOW };
  const unlock = { value: over.unlock === undefined ? FRESH : over.unlock };
  const seenBy: Array<() => void> = [];
  return {
    log,
    device,
    timers,
    clock,
    unlock,
    seenBy,
    now: () => clock.now,
    readDevice: async () => device.value,
    readUnlock: () => unlock.value,
    readPinOwner: async () => over.stored ?? null,
    fingerprint: async (id) => (id === 'user_1' ? OWNER : null),
    readPromptSeen: async () => (over.seen === undefined ? false : over.seen),
    markPromptSeen: () => log.push('markPromptSeen'),
    writePinOwner: async (record) => {
      log.push(`writePinOwner:${JSON.stringify(record)}`);
      return over.write ?? true;
    },
    assign: (url) => log.push(`assign:${url}`),
    setTimer: (run, ms) => {
      const timer = { run, ms, cleared: false };
      timers.push(timer);
      return () => {
        timer.cleared = true;
      };
    },
    clearGrownUpTab: () => log.push('clearGrownUpTab'),
    origin: () => over.origin ?? 'https://app.hangulroute.com',
    observeSeen: (_element, onSeen) => {
      seenBy.push(onSeen);
      return () => undefined;
    },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

async function render(env: Fake, reverify: () => Promise<SecretReverify> = async () => 'done', accountId: string | null = 'user_1', label: string | null = null): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(<PinCards accountId={accountId} accountLabel={label} home="/parent" reverifySecret={reverify} env={env} />, {
      createNodeMock: () => ({}),
    });
    await flush();
  });
  return mounted as unknown as ReactTestRenderer;
}

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const textOf = (n: ReactTestInstance): string => n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const en = getMessages('en').console;

describe('the set-a-PIN card (section 7.6, D14)', () => {
  it('shows on a nopin browser not yet marked seen; a render nobody saw marks nothing, being in view marks it once', async () => {
    const env = fake({ device: NOPIN });
    const r = await render(env);
    const card = byTestId(r, 'pin-prompt-card');
    expect(card).toHaveLength(1);
    expect(textOf(card[0] as ReactTestInstance)).toContain(en.pinPrompt.body);
    expect(env.log).toEqual([]);
    expect(env.seenBy.length).toBeGreaterThan(0);
    act(() => env.seenBy.at(-1)?.());
    act(() => env.seenBy.at(-1)?.());
    expect(env.log).toEqual(['markPromptSeen']);
  });

  it('Open the app marks it seen, clears the tab like the Learner app exit, and opens the PIN gate with this home as next', async () => {
    const env = fake({ device: NOPIN });
    const r = await render(env);
    expect(textOf(byTestId(r, 'pin-prompt-open')[0] as ReactTestInstance)).toBe(en.pinPrompt.cta);
    act(() => byTestId(r, 'pin-prompt-open')[0]?.props.onClick());
    expect(env.log).toEqual(['markPromptSeen', 'clearGrownUpTab', 'assign:/?gate=grown-up&next=%2Fparent']);
  });

  it('on a site origin Open the app goes to the app host', async () => {
    const env = fake({ device: NOPIN, origin: 'https://hangulroute.com' });
    const r = await render(env);
    act(() => byTestId(r, 'pin-prompt-open')[0]?.props.onClick());
    expect(env.log.at(-1)).toBe('assign:https://app.hangulroute.com/?gate=grown-up&next=%2Fparent');
  });

  it('shows once: never again once seen, never when the store cannot be read, never on pin or none', async () => {
    for (const over of [{ device: NOPIN, seen: true }, { device: NOPIN, seen: null }, { device: PIN, unlock: null }, { device: NONE }] as const) {
      const r = await render(fake(over));
      expect(byTestId(r, 'pin-prompt-card')).toHaveLength(0);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });
});

describe('the PIN-owner card (section 7.2 moment 3, D13)', () => {
  it('shows inside the 2-minute window after a fresh PIN and goes by itself when it ends', async () => {
    const env = fake();
    const r = await render(env);
    expect(byTestId(r, 'pin-owner-card')).toHaveLength(1);
    expect(textOf(byTestId(r, 'pin-owner-cta')[0] as ReactTestInstance)).toBe(en.pinOwner.cta);
    expect(env.timers[0]?.ms).toBe(FRESH.at + GROWN_UP_FRESH_PIN_MS - NOW);
    act(() => env.timers[0]?.run());
    expect(byTestId(r, 'pin-owner-card')).toHaveLength(0);
  });

  it('names the signed-in account on screen (so a hand-off to the wrong account shows), and nothing without a label', async () => {
    let r = await render(fake(), undefined, 'user_1', 'sam@example.com');
    expect(textOf(byTestId(r, 'pin-owner-account')[0] as ReactTestInstance)).toBe(en.adminInvite.signedInAs('sam@example.com'));
    act(() => mounted?.unmount());
    r = await render(fake());
    expect(byTestId(r, 'pin-owner-account')).toHaveLength(0);
  });

  it('a press after the window lapsed asks nothing, writes nothing and removes the card', async () => {
    const env = fake();
    let asked = 0;
    const r = await render(env, async () => {
      asked += 1;
      return 'done';
    });
    env.clock.now = FRESH.at + GROWN_UP_FRESH_PIN_MS;
    await act(async () => {
      byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
      await flush();
    });
    expect(asked).toBe(0);
    expect(env.log).toEqual([]);
    expect(byTestId(r, 'pin-owner-card')).toHaveLength(0);
  });

  it('a press after the unlock was dropped or replaced asks nothing', async () => {
    for (const next of [null, { ...FRESH, at: FRESH.at + 1, seen: FRESH.at + 1 }]) {
      const env = fake();
      let asked = 0;
      const r = await render(env, async () => {
        asked += 1;
        return 'done';
      });
      env.unlock.value = next;
      await act(async () => {
        byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
        await flush();
      });
      expect(asked).toBe(0);
      expect(env.log).toEqual([]);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('a reverification that completes after the window lapsed writes nothing and removes the card', async () => {
    const env = fake();
    let release: (value: SecretReverify) => void = () => undefined;
    const r = await render(env, () => new Promise<SecretReverify>((resolve) => (release = resolve)));
    act(() => byTestId(r, 'pin-owner-cta')[0]?.props.onClick());
    env.clock.now = FRESH.at + GROWN_UP_FRESH_PIN_MS + 1;
    await act(async () => {
      release('done');
      await flush();
    });
    expect(env.log).toEqual([]);
    expect(byTestId(r, 'pin-owner-card')).toHaveLength(0);
  });

  it('a cancel after the window lapsed while Clerk asked removes the card; a cancel inside it re-arms the expiry', async () => {
    const env = fake();
    let release: (value: SecretReverify) => void = () => undefined;
    const r = await render(env, () => new Promise<SecretReverify>((resolve) => (release = resolve)));
    act(() => byTestId(r, 'pin-owner-cta')[0]?.props.onClick());
    await act(async () => {
      release('cancelled');
      await flush();
    });
    // Inside the window: back to the offer, with a new expiry timer for the same hand-off.
    expect(byTestId(r, 'pin-owner-cta')).toHaveLength(1);
    expect(env.timers.at(-1)?.ms).toBe(FRESH.at + GROWN_UP_FRESH_PIN_MS - NOW);
    act(() => byTestId(r, 'pin-owner-cta')[0]?.props.onClick());
    // The window ends while Clerk asks; the card stays until Clerk answers, then goes.
    env.clock.now = FRESH.at + GROWN_UP_FRESH_PIN_MS;
    act(() => env.timers.at(-1)?.run());
    expect(byTestId(r, 'pin-owner-card')).toHaveLength(1);
    await act(async () => {
      release('cancelled');
      await flush();
    });
    expect(byTestId(r, 'pin-owner-card')).toHaveLength(0);
    expect(env.log).toEqual([]);
  });

  it('is not shown to the owner, without a fresh PIN, without an account, or off a pin browser', async () => {
    for (const [over, account] of [
      [{ stored: { v: 1, owner: OWNER, epoch: EPOCH } }, 'user_1'],
      [{ unlock: { ...FRESH, at: NOW - GROWN_UP_FRESH_PIN_MS } }, 'user_1'],
      [{ unlock: { v: 1, at: NOW, seen: NOW, src: 'signin' } }, 'user_1'],
      [{}, null],
      [{ device: NONE }, 'user_1'],
    ] as const) {
      const r = await render(fake(over as Parameters<typeof fake>[0]), undefined, account);
      expect(byTestId(r, 'pin-owner-card')).toHaveLength(0);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('a password or code reverification writes pinOwner (the fingerprint, never the id) and shows the done status', async () => {
    const env = fake();
    let asked = 0;
    const r = await render(env, async () => {
      asked += 1;
      return 'done';
    });
    await act(async () => {
      byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
      await flush();
    });
    expect(asked).toBe(1);
    expect(env.log).toEqual([`writePinOwner:${JSON.stringify({ v: 1, owner: OWNER, epoch: EPOCH })}`]);
    expect(env.log.join()).not.toContain('user_1');
    const done = byTestId(r, 'pin-owner-done');
    expect(done).toHaveLength(1);
    expect(textOf(done[0] as ReactTestInstance)).toContain(en.pinOwner.done);
    expect(byTestId(r, 'pin-owner-status')[0]?.props.role).toBe('status');
  });

  it('keeps one status region mounted from the offer to the done line, so the change is announced', async () => {
    const env = fake();
    const r = await render(env);
    const region = byTestId(r, 'pin-owner-status')[0] as ReactTestInstance;
    expect(region.props.role).toBe('status');
    expect(region.children).toHaveLength(0);
    await act(async () => {
      byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
      await flush();
    });
    expect(byTestId(r, 'pin-owner-status')[0]).toBe(region);
    expect(textOf(region)).toContain(en.pinOwner.done);
  });

  it('is busy while Clerk asks, and a second press does nothing', async () => {
    const env = fake();
    let release: (value: SecretReverify) => void = () => undefined;
    let asked = 0;
    const r = await render(env, () => {
      asked += 1;
      return new Promise<SecretReverify>((resolve) => {
        release = resolve;
      });
    });
    act(() => byTestId(r, 'pin-owner-cta')[0]?.props.onClick());
    const cta = byTestId(r, 'pin-owner-cta')[0] as ReactTestInstance;
    expect(cta.props['aria-busy']).toBe(true);
    expect(cta.props['aria-disabled']).toBe(true);
    act(() => cta.props.onClick());
    expect(asked).toBe(1);
    // The window ending while Clerk asks does not take the card away.
    act(() => env.timers[0]?.run());
    expect(byTestId(r, 'pin-owner-card')).toHaveLength(1);
    await act(async () => {
      release('cancelled');
      await flush();
    });
    expect(byTestId(r, 'pin-owner-cta')[0]?.props['aria-busy']).toBeUndefined();
    expect(env.log).toEqual([]);
  });

  it('a refused (passkey) or unavailable reverification writes nothing and says it cannot confirm', async () => {
    for (const outcome of ['refused', 'unavailable'] as const) {
      const env = fake();
      const r = await render(env, async () => outcome);
      await act(async () => {
        byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
        await flush();
      });
      expect(env.log).toEqual([]);
      expect(textOf(byTestId(r, 'pin-owner-line')[0] as ReactTestInstance)).toBe(en.billing.stepUp.unavailable);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('a reverification that throws, a PIN changed meanwhile, or a refused write writes no done line', async () => {
    const thrown = fake();
    let r = await render(thrown, async () => Promise.reject(new Error('x')));
    await act(async () => {
      byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
      await flush();
    });
    expect(byTestId(r, 'pin-owner-line')).toHaveLength(1);
    act(() => mounted?.unmount());

    const changed = fake();
    r = await render(changed);
    changed.device.value = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH + 1 }, hasProfiles: true };
    await act(async () => {
      byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
      await flush();
    });
    expect(changed.log).toEqual([]);
    expect(byTestId(r, 'pin-owner-done')).toHaveLength(0);
    act(() => mounted?.unmount());

    const refused = fake({ write: false });
    r = await render(refused);
    await act(async () => {
      byTestId(r, 'pin-owner-cta')[0]?.props.onClick();
      await flush();
    });
    expect(byTestId(r, 'pin-owner-done')).toHaveLength(0);
    expect(byTestId(r, 'pin-owner-line')).toHaveLength(1);
  });

  it('never shows the account id or the fingerprint, in every locale; the account is named only by its label', async () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      ui.locale = locale;
      const r = await render(fake(), undefined, 'user_1', 'sam@example.com');
      const text = textOf(r.root);
      expect(text).toContain(getMessages(locale).console.pinOwner.hint);
      expect(text).toContain(getMessages(locale).console.adminInvite.signedInAs('sam@example.com'));
      expect(text).not.toMatch(/user_1|a1b2c3d4e5f60718/);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });
});

describe('observeSeenInView: in view in a visible tab, never a render nobody saw (section 7.6)', () => {
  const realDocument = (globalThis as { document?: unknown }).document;
  const realObserver = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  afterEach(() => {
    (globalThis as { document?: unknown }).document = realDocument;
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = realObserver;
  });

  function stage(visibility: DocumentVisibilityState, withObserver = true) {
    const doc = Object.assign(new EventTarget(), { visibilityState: visibility });
    (globalThis as { document?: unknown }).document = doc;
    const observers: Array<{ fire: (inView: boolean) => void; disconnected: boolean }> = [];
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = withObserver
      ? class {
          private entry: { fire: (inView: boolean) => void; disconnected: boolean };
          constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
            this.entry = { fire: (inView) => callback([{ isIntersecting: inView }]), disconnected: false };
            observers.push(this.entry);
          }
          observe(): void {}
          disconnect(): void {
            this.entry.disconnected = true;
          }
        }
      : undefined;
    return { doc, observers };
  }

  it('fires once the card is in view while the tab is visible, then stops', () => {
    const { observers } = stage('visible');
    let seen = 0;
    observeSeenInView({} as Element, () => (seen += 1));
    expect(seen).toBe(0);
    observers[0]?.fire(false);
    expect(seen).toBe(0);
    observers[0]?.fire(true);
    observers[0]?.fire(true);
    expect(seen).toBe(1);
    expect(observers[0]?.disconnected).toBe(true);
  });

  it('in view in a hidden tab waits until the tab is shown', () => {
    const { doc, observers } = stage('hidden');
    let seen = 0;
    observeSeenInView({} as Element, () => (seen += 1));
    observers[0]?.fire(true);
    expect(seen).toBe(0);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(seen).toBe(1);
  });

  it('stop before it is seen marks nothing', () => {
    const { observers } = stage('visible');
    let seen = 0;
    const stop = observeSeenInView({} as Element, () => (seen += 1));
    stop();
    observers[0]?.fire(true);
    expect(seen).toBe(0);
    expect(observers[0]?.disconnected).toBe(true);
  });

  it('without an IntersectionObserver a visible tab counts as seen', () => {
    stage('visible', false);
    let seen = 0;
    observeSeenInView({} as Element, () => (seen += 1));
    expect(seen).toBe(1);
  });
});
