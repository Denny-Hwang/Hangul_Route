import { GROWN_UP_FRESH_PIN_MS, type GrownUpUnlock, type PinOwner, type PinResetTicket } from '@hangul-route/content-schema';
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
import { PinResetView, type PinResetEnvironment } from '../PinResetPage';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-6 (sections 7.5 and 8.5 steps 3 and 4; CS-9, CS-10, CS-17; design
 * `console-pin.md` boards 4 to 8): `/account/pin-reset` writes the ticket and leaves only after every check passed;
 * every refusal shows its line and Back to learning and writes nothing; a sign-in older than 2 minutes asks Clerk first.
 */
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;
const OWNER = 'a1b2c3d4e5f60718';
const OTHER = '0000111122223333';
const PIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true };
const NOPIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
const OWNED: PinOwner = { v: 1, owner: OWNER, epoch: EPOCH };
const fresh = (age = 20_000): GrownUpUnlock => ({ v: 1, at: NOW - age, seen: NOW - age, src: 'signin' });
const c = getMessages('en').console;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  ui.locale = 'en';
});

interface Fake extends PinResetEnvironment {
  log: string[];
  tickets: PinResetTicket[];
}

function fake(over: { device?: DeviceGateRead; unlock?: GrownUpUnlock | null; resetLeg?: number | null; stored?: PinOwner | null; owner?: string | null; write?: boolean } = {}): Fake {
  const log: string[] = [];
  const tickets: PinResetTicket[] = [];
  return {
    log,
    tickets,
    now: () => NOW,
    readDevice: async () => over.device ?? PIN,
    readUnlock: () => (over.unlock === undefined ? fresh() : over.unlock),
    // The reset leg stamps its own unlock (signin-flow `grantSignInUnlock`); by default the fake unlock is stamped.
    readResetLeg: () => (over.resetLeg === undefined ? (over.unlock === undefined ? fresh().at : (over.unlock?.at ?? null)) : over.resetLeg),
    readPinOwner: async () => (over.stored === undefined ? OWNED : over.stored),
    fingerprint: async () => (over.owner === undefined ? OWNER : over.owner),
    writeTicket: (ticket) => {
      if (over.write === false) return false;
      tickets.push(ticket);
      log.push('ticket');
      return true;
    },
    clearGrownUpTab: () => log.push('clear'),
    origin: () => 'https://app.hangulroute.com',
    assign: (url) => log.push(`assign ${url}`),
  };
}

async function show(env: Fake, options: { reverify?: () => Promise<SecretReverify>; flag?: boolean } = {}): Promise<{ root: ReactTestInstance; reverify: ReturnType<typeof vi.fn> }> {
  const reverify = vi.fn(options.reverify ?? (async (): Promise<SecretReverify> => 'done'));
  await act(async () => {
    mounted = create(<PinResetView accountId="user_1" reverifySecret={reverify} flag={options.flag ?? true} env={env} />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { root: (mounted as unknown as ReactTestRenderer).root, reverify };
}

const textOf = (node: ReactTestInstance): string => node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const byTestId = (root: ReactTestInstance, id: string) => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);
const line = (root: ReactTestInstance) => byTestId(root, 'pin-reset-line')[0];

describe('/account/pin-reset: success', () => {
  it('a fresh sign-in by the owner of this PIN: the going line, the ticket, the console session cleared, then gate=pin-reset', async () => {
    const env = fake();
    const { root, reverify } = await show(env);
    expect(textOf(root.findByType('h1'))).toBe(c.pinReset.title);
    expect(line(root)?.props['data-line']).toBe('going');
    expect(textOf(line(root) as ReactTestInstance)).toBe(c.pinReset.going);
    expect(line(root)?.props.role).toBe('status');
    expect(byTestId(root, 'pin-reset-back')).toHaveLength(0);
    expect(env.tickets).toEqual([{ v: 1, at: NOW, epoch: EPOCH }]);
    // The ticket first, then the session goes, then the tab leaves: never a hand-off without its ticket.
    expect(env.log).toEqual(['ticket', 'clear', 'assign /?gate=pin-reset&lang=en']);
    expect(reverify).not.toHaveBeenCalled();
  });

  it('the hand-off carries the console’s language', async () => {
    ui.locale = 'ko';
    const env = fake();
    await show(env);
    expect(env.log.at(-1)).toBe('assign /?gate=pin-reset&lang=ko');
  });

  it('a sign-in older than 2 minutes runs Clerk reverification first, then hands off', async () => {
    const env = fake({ unlock: fresh(GROWN_UP_FRESH_PIN_MS) });
    const { reverify } = await show(env);
    expect(reverify).toHaveBeenCalledTimes(1);
    expect(env.tickets).toHaveLength(1);
  });
});

describe('/account/pin-reset: refusals write nothing', () => {
  const cases: Array<[string, Parameters<typeof fake>[0], keyof typeof c.pinReset]> = [
    ['another account (notOwner)', { owner: OTHER }, 'notOwner'],
    ['no record for this PIN (firstSignIn)', { stored: null }, 'firstSignIn'],
    ['a record for an earlier PIN (firstSignIn)', { stored: { v: 1, owner: OWNER, epoch: EPOCH - 1 } }, 'firstSignIn'],
    ['a marker that is not pin (noPin)', { device: NOPIN }, 'noPin'],
    ['a device read that failed (unavailable)', { device: { readable: false, reason: 'failed' } }, 'unavailable'],
    ['a storage that refuses the ticket (unavailable)', { write: false }, 'unavailable'],
  ];
  for (const [name, over, key] of cases) {
    it(name, async () => {
      const env = fake(over);
      const { root } = await show(env);
      expect(line(root)?.props['data-line']).toBe(key);
      expect(textOf(line(root) as ReactTestInstance)).toBe(c.pinReset[key]);
      expect(env.tickets).toEqual([]);
      expect(env.log.filter((entry) => entry.startsWith('assign'))).toEqual([]);
      const [back] = byTestId(root, 'pin-reset-back');
      expect(textOf(back as ReactTestInstance)).toBe(c.lock.backToLearning.cta);
      act(() => back?.props.onClick());
      expect(env.log).toEqual(['clear', 'assign /?lang=en']);
    });
  }

  it('the switch off answers unavailable and reads nothing', async () => {
    const env = fake();
    const spy = vi.spyOn(env, 'readDevice');
    const { root, reverify } = await show(env, { flag: false });
    expect(line(root)?.props['data-line']).toBe('unavailable');
    expect(spy).not.toHaveBeenCalled();
    expect(reverify).not.toHaveBeenCalled();
    expect(env.tickets).toEqual([]);
  });

  for (const outcome of ['cancelled', 'refused', 'unavailable'] as const) {
    it(`a reverification that ends ${outcome} answers unavailable`, async () => {
      const env = fake({ unlock: null });
      const { root, reverify } = await show(env, { reverify: async () => outcome });
      expect(reverify).toHaveBeenCalledTimes(1);
      expect(line(root)?.props['data-line']).toBe('unavailable');
      expect(env.tickets).toEqual([]);
    });
  }

  it('a reverification that throws answers unavailable', async () => {
    const env = fake({ unlock: null });
    const { root } = await show(env, {
      reverify: async () => {
        throw new Error('clerk');
      },
    });
    expect(line(root)?.props['data-line']).toBe('unavailable');
  });

  it('an ordinary-leg signin unlock (no reset-leg stamp) never counts: Clerk is asked, and a passkey there refuses (CS-17)', async () => {
    const env = fake({ resetLeg: null });
    const { root, reverify } = await show(env, { reverify: async () => 'refused' });
    expect(reverify).toHaveBeenCalledTimes(1);
    expect(line(root)?.props['data-line']).toBe('unavailable');
    expect(env.tickets).toEqual([]);
  });

  it('the stamp of an earlier unlock does not stand for this one', async () => {
    const env = fake({ resetLeg: fresh().at - 1 });
    const { reverify } = await show(env);
    expect(reverify).toHaveBeenCalledTimes(1);
  });

  it('the reset leg\'s own stamped sign-in goes without a reverification', async () => {
    const env = fake();
    const { reverify } = await show(env);
    expect(reverify).not.toHaveBeenCalled();
    expect(env.tickets).toHaveLength(1);
  });

  it('a check that throws answers unavailable', async () => {
    const env = fake();
    env.readPinOwner = async () => {
      throw new Error('idb');
    };
    const { root } = await show(env);
    expect(line(root)?.props['data-line']).toBe('unavailable');
  });
});

describe('/account/pin-reset: what it shows', () => {
  it('no name, no email, no id, no number but the 24 hours in any state', async () => {
    for (const over of [{}, { owner: OTHER }, { stored: null }, { device: NOPIN }] as const) {
      const env = fake(over);
      const { root } = await show(env);
      const text = textOf(root);
      expect(text.replace(/24/g, '')).not.toMatch(/user_1|@|\d/);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('Spanish and Korean draw their own lines', async () => {
    for (const locale of ['es', 'ko'] as const) {
      ui.locale = locale;
      const env = fake({ owner: OTHER });
      const { root } = await show(env);
      expect(textOf(root.findByType('h1'))).toBe(getMessages(locale).console.pinReset.title);
      expect(textOf(line(root) as ReactTestInstance)).toBe(getMessages(locale).console.pinReset.notOwner);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });
});
