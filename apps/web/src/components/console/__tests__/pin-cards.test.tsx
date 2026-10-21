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
import { PinCards, type PinCardsEnvironment } from '../PinCards';

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
}

function fake(over: { device?: DeviceGateRead; unlock?: GrownUpUnlock | null; stored?: PinOwner | null; seen?: boolean | null; write?: boolean } = {}): Fake {
  const log: string[] = [];
  const device = { value: over.device ?? PIN };
  const timers: Fake['timers'] = [];
  return {
    log,
    device,
    timers,
    now: () => NOW,
    readDevice: async () => device.value,
    readUnlock: () => (over.unlock === undefined ? FRESH : over.unlock),
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
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

async function render(env: Fake, reverify: () => Promise<SecretReverify> = async () => 'done', accountId: string | null = 'user_1'): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(<PinCards accountId={accountId} reverifySecret={reverify} env={env} />);
    await flush();
  });
  return mounted as unknown as ReactTestRenderer;
}

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const textOf = (n: ReactTestInstance): string => n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const en = getMessages('en').console;

describe('the set-a-PIN card (section 7.6, D14)', () => {
  it('shows on a nopin browser not yet marked seen, and marks it seen as it renders', async () => {
    const env = fake({ device: NOPIN });
    const r = await render(env);
    const card = byTestId(r, 'pin-prompt-card');
    expect(card).toHaveLength(1);
    expect(textOf(card[0] as ReactTestInstance)).toContain(en.pinPrompt.body);
    expect(env.log).toEqual(['markPromptSeen']);
  });

  it('Open the app goes to the learner app gate, which runs setup', async () => {
    const env = fake({ device: NOPIN });
    const r = await render(env);
    act(() => byTestId(r, 'pin-prompt-open')[0]?.props.onClick());
    expect(env.log).toContain('assign:/?gate=grown-up');
    expect(textOf(byTestId(r, 'pin-prompt-open')[0] as ReactTestInstance)).toBe(en.pinPrompt.cta);
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
    expect(done[0]?.props.role).toBe('status');
    expect(textOf(done[0] as ReactTestInstance)).toContain(en.pinOwner.done);
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

  it('never shows a name, an email or an id, in every locale', async () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      ui.locale = locale;
      const r = await render(fake());
      const text = textOf(r.root);
      expect(text).toContain(getMessages(locale).console.pinOwner.hint);
      expect(text).not.toMatch(/user_1|a1b2c3d4e5f60718|@/);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });
});
