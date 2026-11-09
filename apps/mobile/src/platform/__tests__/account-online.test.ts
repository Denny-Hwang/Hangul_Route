import { beforeEach, describe, expect, it, vi } from 'vitest';

/** F-AUTH-004 sections 6.3 and 12 (row NS-3): the native account's network state, from expo-network. */

const net = vi.hoisted(() => ({
  state: { isConnected: true as boolean | null, isInternetReachable: true as boolean | null },
  listener: null as null | ((s: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void),
  remove: vi.fn(),
  readFails: false,
  listenFails: false,
}));
vi.mock('expo-network', () => ({
  getNetworkStateAsync: async () => {
    if (net.readFails) throw new Error('no module');
    return net.state;
  },
  addNetworkStateListener: (listener: (s: unknown) => void) => {
    if (net.listenFails) throw new Error('no module');
    net.listener = listener;
    return { remove: net.remove };
  },
}));

import { readAccountOnline, subscribeAccountOnline } from '../account-online';

beforeEach(() => {
  net.state = { isConnected: true, isInternetReachable: true };
  net.readFails = false;
  net.listenFails = false;
  net.listener = null;
  net.remove.mockClear();
});

describe('the account’s network state', () => {
  it('online when connected and reachable, or when reachability is unknown; offline otherwise', async () => {
    expect(await readAccountOnline()).toBe(true);
    net.state = { isConnected: true, isInternetReachable: null };
    expect(await readAccountOnline()).toBe(true);
    net.state = { isConnected: true, isInternetReachable: false };
    expect(await readAccountOnline()).toBe(false);
    net.state = { isConnected: false, isInternetReachable: null };
    expect(await readAccountOnline()).toBe(false);
  });

  it('a state that cannot be read counts as online (nobody is locked out by a platform that cannot tell)', async () => {
    net.readFails = true;
    expect(await readAccountOnline()).toBe(true);
  });

  it('follows every change, and stops when asked', () => {
    const seen: boolean[] = [];
    const stop = subscribeAccountOnline((online) => seen.push(online));
    net.listener?.({ isConnected: false });
    net.listener?.({ isConnected: true, isInternetReachable: true });
    expect(seen).toEqual([false, true]);
    stop();
    expect(net.remove).toHaveBeenCalledTimes(1);
  });

  it('a listener that cannot be added is a no-op', () => {
    net.listenFails = true;
    const stop = subscribeAccountOnline(() => undefined);
    expect(() => stop()).not.toThrow();
  });
});
