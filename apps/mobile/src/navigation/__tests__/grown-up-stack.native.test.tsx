import { Children, createElement, isValidElement, useContext, useEffect, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, unmount } from '../../test-support/render';

/**
 * F-AUTH-004 sections 6.1, 6.2 and 7.4 (row NS-2; ND-11, CS-N1, CS-N13), in the `native` project (`.native` files
 * resolved first, as Metro does on iOS and Android): Clerk's provider wraps the nested Grown-up area navigator, never
 * the root one; it mounts only while that stack is mounted and only after the install sweep, on a `pin` or `open`
 * device; it unmounts with the stack. With the native account off the route is the dashboard itself (no Clerk).
 */

const env = vi.hoisted(() => ({
  config: { flag: true, publishableKey: 'pk_live_key' as string | null, enabled: true },
}));
vi.mock('../../config/native-signin', () => ({ nativeSignInConfig: () => env.config }));

const tokens = vi.hoisted(() => ({
  cache: { getToken: async () => null, saveToken: async () => undefined },
  sweep: vi.fn(async (): Promise<boolean> => true),
  apply: vi.fn(async (_gate: unknown, _phase: 'mount' | 'change') => true),
  change: vi.fn(async (_gate: unknown, _end: () => Promise<boolean>) => true),
  dropMemory: vi.fn(),
  storage: 'secure' as 'memory' | 'secure',
}));
vi.mock('../../platform/clerk-token-cache.native', () => ({
  clerkTokens: { cache: tokens.cache, endMemorySession: tokens.dropMemory, storage: () => tokens.storage },
  ensureInstallSweep: tokens.sweep,
  applyGateToTokens: tokens.apply,
  applyGateChange: tokens.change,
}));

/** The query client the area clears (CS-N4), and the session-close listeners. */
const queries = vi.hoisted(() => ({
  client: { cancelQueries: vi.fn(async () => undefined), removeQueries: vi.fn() },
  closed: [] as (() => void)[],
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => queries.client }));
vi.mock('../../store/grown-up-session', () => ({
  onGrownUpSessionClosed: (listener: () => void) => {
    queries.closed.push(listener);
    return () => undefined;
  },
}));
const crash = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock('../../platform/crash-report', () => ({ reportCrash: crash.report }));

const gate = vi.hoisted(() => ({
  state: { state: 'pin', epoch: 5 } as { state: string; epoch?: number },
  listener: null as null | ((state: unknown) => void),
  read: vi.fn(async () => gate.state),
  stop: vi.fn(),
}));
vi.mock('../../store/native-gate-state', () => ({
  nativeGateState: gate.read,
  watchNativeGateState: (listener: (state: unknown) => void) => {
    gate.listener = listener;
    return gate.stop;
  },
}));

/** Clerk's provider, counted: CS-N1 asks when it is mounted. */
const clerk = vi.hoisted(() => ({
  mounted: 0,
  props: [] as Record<string, unknown>[],
  throwOnRender: false,
  log: [] as string[],
  signOut: vi.fn(async (_callback?: () => void) => undefined),
  /** How many times Clerk's Expo SDK module was loaded (its factory runs once per load, after `vi.resetModules`). */
  loads: 0,
}));
vi.mock('@clerk/clerk-expo', () => (clerk.loads += 1, {
  getClerkInstance: () => ({ signOut: clerk.signOut }),
  ClerkProvider: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>): ReactElement => {
    if (clerk.throwOnRender) throw new TypeError('Clerk: something with user@example.com');
    clerk.props.push(props);
    useEffect(() => {
      clerk.mounted += 1;
      return () => {
        clerk.mounted -= 1;
      };
    }, []);
    return createElement('clerk-provider', null, children);
  },
}));

// Row NS-3: the 24-hour wait's record, and its copy for the account (section 7.3).
const wait = vi.hoisted(() => ({ record: null as unknown, copied: [] as number[] }));
vi.mock('../../store/account-store', () => ({ useAccountStore: { getState: () => ({ pinResetByWait: wait.record }) } }));
vi.mock('../../platform/account-records', () => ({ writeRetrustRequired: async (at: number) => void wait.copied.push(at) }));

vi.mock('../../screens/parent/ParentDashboardScreen', () => ({
  ParentDashboardScreen: ({ route }: { route?: { params?: unknown } }) => createElement('dashboard', { params: route?.params }),
}));

/** A stand-in stack navigator: renders its first screen, inside a host element that names the navigator. */
vi.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: ReactNode }) => {
      const first = Children.toArray(children).find(isValidElement) as ReactElement<{ name: string; component: ComponentType<unknown>; initialParams?: unknown }>;
      const route = { key: `${first.props.name}-inner`, name: first.props.name, params: first.props.initialParams };
      return createElement('inner-navigator', { name: first.props.name }, createElement(first.props.component, { navigation: {}, route } as never));
    },
    Screen: () => null,
  }),
}));

/** The module as this project resolves `../grown-up-stack` (the `.native` file); typed from that file. */
type NativeStackModule = typeof import('../grown-up-stack.native');
async function load(): Promise<NativeStackModule> {
  vi.resetModules();
  return (await import('../grown-up-stack')) as unknown as NativeStackModule;
}

/** The stack as a plain component (the navigation props are stand-ins here). */
const asComponent = (component: unknown): ComponentType<{ route: unknown; navigation: unknown }> => component as ComponentType<{ route: unknown; navigation: unknown }>;

/** Lets the mount decision (the sweep, the gate read, the `import()` of the Clerk host) finish inside act. */
async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !done(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const ROUTE = { key: 'ParentDashboard-root', name: 'ParentDashboard', params: { browseBlocked: true } };

beforeEach(() => {
  env.config = { flag: true, publishableKey: 'pk_live_key', enabled: true };
  gate.state = { state: 'pin', epoch: 5 };
  gate.listener = null;
  clerk.mounted = 0;
  clerk.props = [];
  clerk.throwOnRender = false;
  vi.clearAllMocks();
  tokens.sweep.mockImplementation(async () => true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the native resolution', () => {
  it('this project resolves grown-up-stack to the .native file', async () => {
    const mod = await load();
    expect(typeof mod.prepareClerkMount).toBe('function');
  });
});

describe('CS-N13: the native account off is the basis', () => {
  it('the route is the dashboard itself, and Clerk is never loaded', async () => {
    env.config = { flag: false, publishableKey: null, enabled: false };
    const { GrownUpArea } = await load();
    const { ParentDashboardScreen } = await import('../../screens/parent/ParentDashboardScreen');
    expect(GrownUpArea).toBe(ParentDashboardScreen);
  });
});

describe('ND-11, CS-N13 (row NS-3): Clerk’s Expo SDK loads only with its provider', () => {
  it('loading the area (the switch off or on) loads nothing of Clerk’s; the sign-in screen is registered lazily', async () => {
    clerk.loads = 0;
    env.config = { flag: false, publishableKey: null, enabled: false };
    await load();
    expect(clerk.loads).toBe(0);
    env.config = { flag: true, publishableKey: 'pk_live_key', enabled: true };
    await load();
    expect(clerk.loads).toBe(0);
  });

  it('a visit that decides on no provider (gate unknown) loads nothing of Clerk’s either', async () => {
    gate.state = { state: 'unknown' };
    const { GrownUpStack } = await load();
    clerk.loads = 0;
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => renderer.root.findAllByType('inner-navigator' as never).length === 1);
    expect(clerk.loads).toBe(0);
    await unmount(renderer);
  });
});

describe('section 7.3 (row NS-3): the 24-hour wait’s record is copied for the account when the area opens', () => {
  it('copied before the dashboard (and its notice, which deletes the original) mounts', async () => {
    wait.record = { v: 1, at: 1 };
    wait.copied = [];
    const { GrownUpStack } = await load();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    expect(wait.copied).toHaveLength(1);
    await unmount(renderer);
    wait.record = null;
    wait.copied = [];
    const again = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    expect(wait.copied).toEqual([]);
    await unmount(again);
  });
});

describe('CS-N1: Clerk only inside the Grown-up area stack', () => {
  it('wraps the nested navigator (never the root), with the key, the token cache and telemetry off', async () => {
    const { GrownUpArea, GrownUpStack } = await load();
    expect(GrownUpArea).toBe(GrownUpStack);
    const renderer = await render(createElement(asComponent(GrownUpArea), { route: ROUTE, navigation: {} }));
    await settle(() => clerk.mounted === 1);
    const provider = renderer.root.findByType('clerk-provider' as never);
    const navigator = provider.findByType('inner-navigator' as never);
    expect(navigator.props.name).toBe('ParentDashboard');
    // The dashboard keeps its route params under the same route name.
    expect(navigator.findByType('dashboard' as never).props.params).toEqual({ browseBlocked: true });
    expect(clerk.mounted).toBe(1);
    expect(clerk.props.at(-1)).toEqual({ publishableKey: 'pk_live_key', tokenCache: tokens.cache, telemetry: false, experimental: { rethrowOfflineNetworkErrors: true } });
    expect(tokens.apply).toHaveBeenCalledWith({ state: 'pin', epoch: 5 }, 'mount');
    await unmount(renderer);
    expect(clerk.mounted).toBe(0);
    expect(gate.stop).toHaveBeenCalledTimes(1);
  });

  it('an `open` device mounts it too (this run’s memory session)', async () => {
    gate.state = { state: 'open' };
    const { GrownUpStack } = await load();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => clerk.mounted === 1);
    expect(clerk.mounted).toBe(1);
    await unmount(renderer);
  });

  it('a gate change while open goes to the token storage', async () => {
    const { GrownUpStack } = await load();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => gate.listener !== null);
    await act(async () => {
      gate.listener?.({ state: 'open' });
    });
    // The change goes through applyGateChange with Clerk's own sign-out (the instance outlives the provider).
    expect(tokens.change).toHaveBeenCalledWith({ state: 'open' }, expect.any(Function));
    const end = tokens.change.mock.calls[0]![1];
    await end();
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
    await unmount(renderer);
  });

  for (const [why, setUp] of [
    ['the install sweep is not complete', () => tokens.sweep.mockImplementation(async () => false)],
    ['the gate state is unknown', () => (gate.state = { state: 'unknown' })],
    ['the device has children and no PIN (nopin)', () => (gate.state = { state: 'nopin' })],
    ['the sweep throws', () => tokens.sweep.mockImplementation(async () => Promise.reject(new Error('x')))],
  ] as const) {
    it(`no provider when ${why}; the dashboard still opens`, async () => {
      setUp();
      const { GrownUpStack } = await load();
      const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
      await settle(() => renderer.root.findAllByType('dashboard' as never).length > 0);
      expect(renderer.root.findAllByType('clerk-provider' as never)).toHaveLength(0);
      expect(renderer.root.findAllByType('dashboard' as never)).toHaveLength(1);
      expect(clerk.mounted).toBe(0);
      await unmount(renderer);
    });
  }

  it('nopin still deletes any kept item before it decides (ND-9)', async () => {
    gate.state = { state: 'nopin' };
    const { GrownUpStack } = await load();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => renderer.root.findAllByType('dashboard' as never).length > 0);
    expect(tokens.apply).toHaveBeenCalledWith({ state: 'nopin' }, 'mount');
    await unmount(renderer);
  });

  it('a decision that never comes shows the dashboard without Clerk, and a late one is ignored', async () => {
    vi.useFakeTimers();
    let finish: (ok: boolean) => void = () => undefined;
    tokens.sweep.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)));
    const { GrownUpStack, CLERK_MOUNT_WAIT_MS } = await load();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    expect(renderer.root.findAllByType('dashboard' as never)).toHaveLength(0);
    await act(async () => {
      vi.advanceTimersByTime(CLERK_MOUNT_WAIT_MS);
    });
    expect(renderer.root.findAllByType('dashboard' as never)).toHaveLength(1);
    vi.useRealTimers();
    finish(true);
    // The late answer goes no further: the visit no longer waits, so no gate read, no token change, no provider.
    await settle(() => false);
    expect(gate.read).not.toHaveBeenCalled();
    expect(tokens.apply).not.toHaveBeenCalled();
    expect(clerk.mounted).toBe(0);
    expect(renderer.root.findAllByType('clerk-provider' as never)).toHaveLength(0);
    await unmount(renderer);
  });

  it('says whether Clerk is mounted (ClerkMountContext) to the screens below', async () => {
    const mod = await load();
    const seen: string[] = [];
    const Probe = (): null => {
      seen.push(useContext(mod.ClerkMountContext));
      return null;
    };
    const renderer = await render(createElement(mod.ClerkMountContext.Provider, { value: 'ready' }, createElement(Probe)));
    expect(seen.at(-1)).toBe('ready');
    await unmount(renderer);
    const stack = await render(createElement(asComponent(mod.GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => clerk.mounted === 1);
    expect(stack.root.findAllByType('clerk-provider' as never)).toHaveLength(1);
    await unmount(stack);
  });

  it('a Clerk render error falls back to the dashboard without Clerk, and reports the class only (CS-N15)', async () => {
    clerk.throwOnRender = true;
    const { GrownUpStack } = await load();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => crash.report.mock.calls.length > 0);
    spy.mockRestore();
    expect(renderer.root.findAllByType('clerk-provider' as never)).toHaveLength(0);
    expect(renderer.root.findAllByType('dashboard' as never)).toHaveLength(1);
    const [error, surface, route] = crash.report.mock.calls[0]!;
    expect((error as Error).message).toBe('');
    expect((error as Error).name).toBe('TypeError');
    expect([surface, route]).toEqual(['learner', 'ParentDashboard']);
    await unmount(renderer);
  });

  it('clears the account queries when the area unmounts and at every session close (CS-N4)', async () => {
    const { GrownUpStack, bindAccountQueryClearing } = await load();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => clerk.mounted === 1);
    await unmount(renderer);
    expect(queries.client.removeQueries).toHaveBeenCalledWith({ queryKey: ['account'] });
    queries.client.removeQueries.mockClear();
    // A close that comes after the unmount (the chooser: the navigation event runs after the commit) still clears.
    bindAccountQueryClearing();
    queries.closed.at(-1)?.();
    await Promise.resolve();
    expect(queries.client.removeQueries).toHaveBeenCalledWith({ queryKey: ['account'] });
  });
});

describe('ND-9, CS-N4 (row NS-4): a no-PIN device’s memory session ends at the session close and the area’s unmount', () => {
  it('open: the session close signs Clerk out, then drops this run’s memory items; so does the unmount', async () => {
    gate.state = { state: 'open' };
    tokens.storage = 'memory';
    const { GrownUpStack, bindAccountQueryClearing } = await load();
    bindAccountQueryClearing();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => clerk.mounted === 1);
    clerk.signOut.mockClear();
    tokens.dropMemory.mockClear();
    await act(async () => {
      queries.closed.at(-1)?.();
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
    expect(tokens.dropMemory).toHaveBeenCalledTimes(1);
    await unmount(renderer);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(clerk.signOut).toHaveBeenCalledTimes(2);
    expect(tokens.dropMemory).toHaveBeenCalledTimes(2);
  });

  it('pin: the kept session stays behind the PIN (nothing ends at the close)', async () => {
    tokens.storage = 'secure';
    const { GrownUpStack, bindAccountQueryClearing } = await load();
    bindAccountQueryClearing();
    const renderer = await render(createElement(asComponent(GrownUpStack), { route: ROUTE, navigation: {} }));
    await settle(() => clerk.mounted === 1);
    clerk.signOut.mockClear();
    await act(async () => {
      queries.closed.at(-1)?.();
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(clerk.signOut).not.toHaveBeenCalled();
    expect(tokens.dropMemory).not.toHaveBeenCalled();
    await unmount(renderer);
  });

  it('endMemorySession: only a memory session ends (whatever the gate reads then); a failed sign-out still drops the items; nothing throws', async () => {
    const { endMemorySession } = await load();
    const run = async (storage: 'memory' | 'secure', endSession: (() => Promise<boolean>) | null = vi.fn(async () => true)) => {
      const drop = vi.fn();
      await endMemorySession({ storage: () => storage, endSession, dropMemoryItems: drop });
      return { drop, endSession };
    };
    const memory = await run('memory');
    expect(memory.endSession).toHaveBeenCalledTimes(1);
    expect(memory.drop).toHaveBeenCalledTimes(1);
    const kept = await run('secure');
    expect(kept.endSession).not.toHaveBeenCalled();
    expect(kept.drop).not.toHaveBeenCalled();
    expect((await run('memory', null)).drop).not.toHaveBeenCalled();
    expect((await run('memory', vi.fn(async () => Promise.reject(new Error('offline'))))).drop).toHaveBeenCalledTimes(1);
    await expect(endMemorySession({ storage: () => { throw new Error('x'); }, endSession: async () => true, dropMemoryItems: () => undefined })).resolves.toBeUndefined();
  });

  it('an account entry’s nested route is not the dashboard’s param (dashboardParams)', async () => {
    const { dashboardParams } = await load();
    expect(dashboardParams({ browseBlocked: true })).toEqual({ browseBlocked: true });
    expect(dashboardParams({ screen: 'AccountHome', params: { use: 'family' } } as never)).toBeUndefined();
    expect(dashboardParams(undefined)).toBeUndefined();
  });
});

describe('prepareClerkMount', () => {
  const deps = (over: Record<string, unknown> = {}) => ({
    config: { flag: true, publishableKey: 'pk_live_key', enabled: true },
    sweep: async () => true,
    gate: async () => ({ state: 'pin', epoch: 1 }),
    applyGate: async () => true,
    load: async () => ({ clerkHost: { Provider: () => null, endSession: async () => true } }),
    ...over,
  });

  it('off without a key, without the switch, or where the host has no provider (the web stub)', async () => {
    const { prepareClerkMount } = await load();
    expect(await prepareClerkMount(deps({ config: { flag: true, publishableKey: null, enabled: true } }) as never)).toEqual({ state: 'off' });
    expect(await prepareClerkMount(deps({ config: { flag: false, publishableKey: 'k', enabled: false } }) as never)).toEqual({ state: 'off' });
    expect(await prepareClerkMount(deps({ load: async () => ({ clerkHost: { Provider: null, endSession: async () => true } }) }) as never)).toEqual({ state: 'off' });
    expect(await prepareClerkMount(deps({ load: async () => Promise.reject(new Error('module')) }) as never)).toEqual({ state: 'off' });
  });

  it('loads Clerk only after the sweep and a known gate', async () => {
    const { prepareClerkMount } = await load();
    const loadClerk = vi.fn(async () => ({ clerkHost: { Provider: () => null, endSession: async () => true } }));
    await prepareClerkMount(deps({ sweep: async () => false, load: loadClerk }) as never);
    await prepareClerkMount(deps({ gate: async () => ({ state: 'unknown' }), load: loadClerk }) as never);
    expect(loadClerk).not.toHaveBeenCalled();
    // `nopin` loads the host only to sign out an earlier session; it never mounts the provider.
    expect(await prepareClerkMount(deps({ gate: async () => ({ state: 'nopin' }), load: loadClerk }) as never)).toEqual({ state: 'off' });
    loadClerk.mockClear();
    expect(await prepareClerkMount(deps({ load: loadClerk }) as never)).toMatchObject({ state: 'ready', publishableKey: 'pk_live_key' });
    expect(loadClerk).toHaveBeenCalledTimes(1);
  });

  it('on `open`: Clerk’s session from an earlier visit is signed out before the storage is reset (ND-9)', async () => {
    const { prepareClerkMount } = await load();
    const order: string[] = [];
    const host = { Provider: () => null, endSession: async () => (order.push('end session'), true) };
    const result = await prepareClerkMount(
      deps({ gate: async () => ({ state: 'open' }), applyGate: async () => (order.push('apply mount'), true), load: async () => ({ clerkHost: host }) }) as never,
    );
    expect(order).toEqual(['end session', 'apply mount']);
    expect(result).toMatchObject({ state: 'ready' });
    order.length = 0;
    expect(await prepareClerkMount(deps({ gate: async () => ({ state: 'nopin' }), applyGate: async () => (order.push('apply mount'), true), load: async () => ({ clerkHost: host }) }) as never)).toEqual({ state: 'off' });
    expect(order).toEqual(['end session', 'apply mount']);
    order.length = 0;
    await prepareClerkMount(deps({ applyGate: async () => (order.push('apply mount'), true), load: async () => ({ clerkHost: host }) }) as never);
    // A kept session on `pin` is not signed out.
    expect(order).toEqual(['apply mount']);
  });

  it('a visit that stopped waiting changes nothing more', async () => {
    const { prepareClerkMount } = await load();
    const applyGate = vi.fn(async () => true);
    const loadClerk = vi.fn(async () => ({ clerkHost: { Provider: () => null, endSession: async () => true } }));
    let waiting = true;
    const result = prepareClerkMount(
      deps({
        sweep: async () => {
          waiting = false;
          return true;
        },
        applyGate,
        load: loadClerk,
      }) as never,
      () => waiting,
    );
    expect(await result).toEqual({ state: 'off' });
    expect(applyGate).not.toHaveBeenCalled();
    expect(loadClerk).not.toHaveBeenCalled();
    for (const stopAt of ['gate', 'load'] as const) {
      let live = true;
      const r = await prepareClerkMount(
        deps({
          gate: async () => {
            if (stopAt === 'gate') live = false;
            return { state: 'open' };
          },
          load: async () => {
            if (stopAt === 'load') live = false;
            return { clerkHost: { Provider: () => null, endSession: async () => true } };
          },
        }) as never,
        () => live,
      );
      expect(r, stopAt).toEqual({ state: 'off' });
    }
  });

  it('the default loader is the native Clerk host, whose endSession signs out only after a provider mounted', async () => {
    const { clerkHost } = await import('../../platform/clerk');
    expect(await clerkHost.endSession()).toBe(true);
    expect(clerk.signOut).not.toHaveBeenCalled();
    expect(clerkHost.Provider).not.toBeNull();
    const Provider = clerkHost.Provider as ComponentType<{ publishableKey: string; children: ReactNode }>;
    const renderer = await render(createElement(Provider, { publishableKey: 'pk_live_key', children: null }));
    expect(await clerkHost.endSession()).toBe(true);
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
    // The callback form, so Clerk never tries to navigate a browser window.
    expect(typeof clerk.signOut.mock.calls[0]![0]).toBe('function');
    clerk.signOut.mockRejectedValueOnce(new Error('offline'));
    expect(await clerkHost.endSession()).toBe(false);
    await unmount(renderer);
  });
});
