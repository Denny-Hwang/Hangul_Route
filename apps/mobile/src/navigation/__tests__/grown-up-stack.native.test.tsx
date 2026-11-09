import { Children, createElement, isValidElement, useEffect, type ComponentType, type ReactElement, type ReactNode } from 'react';
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
}));
vi.mock('../../platform/clerk-token-cache.native', () => ({
  clerkTokens: { cache: tokens.cache },
  ensureInstallSweep: tokens.sweep,
  applyGateToTokens: tokens.apply,
}));

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
const clerk = vi.hoisted(() => ({ mounted: 0, props: [] as Record<string, unknown>[] }));
vi.mock('@clerk/clerk-expo', () => ({
  ClerkProvider: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>): ReactElement => {
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
    expect(clerk.props.at(-1)).toEqual({ publishableKey: 'pk_live_key', tokenCache: tokens.cache, telemetry: false });
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
    expect(tokens.apply).toHaveBeenLastCalledWith({ state: 'open' }, 'change');
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
    await act(async () => {
      finish(true);
      await Promise.resolve();
    });
    expect(clerk.mounted).toBe(0);
    await unmount(renderer);
  });
});

describe('prepareClerkMount', () => {
  const deps = (over: Record<string, unknown> = {}) => ({
    config: { flag: true, publishableKey: 'pk_live_key', enabled: true },
    sweep: async () => true,
    gate: async () => ({ state: 'pin', epoch: 1 }),
    applyGate: async () => true,
    load: async () => ({ clerkHost: { Provider: () => null } }),
    ...over,
  });

  it('off without a key, without the switch, or where the host has no provider (the web stub)', async () => {
    const { prepareClerkMount } = await load();
    expect(await prepareClerkMount(deps({ config: { flag: true, publishableKey: null, enabled: true } }) as never)).toEqual({ state: 'off' });
    expect(await prepareClerkMount(deps({ config: { flag: false, publishableKey: 'k', enabled: false } }) as never)).toEqual({ state: 'off' });
    expect(await prepareClerkMount(deps({ load: async () => ({ clerkHost: { Provider: null } }) }) as never)).toEqual({ state: 'off' });
    expect(await prepareClerkMount(deps({ load: async () => Promise.reject(new Error('module')) }) as never)).toEqual({ state: 'off' });
  });

  it('loads Clerk only after the sweep and a known gate', async () => {
    const { prepareClerkMount } = await load();
    const loadClerk = vi.fn(async () => ({ clerkHost: { Provider: () => null } }));
    await prepareClerkMount(deps({ sweep: async () => false, load: loadClerk }) as never);
    await prepareClerkMount(deps({ gate: async () => ({ state: 'unknown' }), load: loadClerk }) as never);
    await prepareClerkMount(deps({ gate: async () => ({ state: 'nopin' }), load: loadClerk }) as never);
    expect(loadClerk).not.toHaveBeenCalled();
    expect(await prepareClerkMount(deps({ load: loadClerk }) as never)).toMatchObject({ state: 'ready', publishableKey: 'pk_live_key' });
    expect(loadClerk).toHaveBeenCalledTimes(1);
  });

  it('the default loader is the native Clerk host', async () => {
    const { clerkHost } = await import('../../platform/clerk');
    expect(clerkHost.Provider).not.toBeNull();
  });
});
