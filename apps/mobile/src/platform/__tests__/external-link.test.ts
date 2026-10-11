import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A plain function, not vi.fn: vitest's mock bookkeeping reports a returned rejected promise as
// unhandled even when the caller catches it.
let refuse = false;
const opened: string[] = [];
vi.mock('react-native', () => ({
  Linking: {
    openURL: (url: string): Promise<void> => {
      opened.push(url);
      return refuse ? Promise.reject(new Error('no handler')) : Promise.resolve();
    },
  },
}));

type NetworkState = { isConnected?: boolean | null; isInternetReachable?: boolean | null };
let network: NetworkState | Error = { isConnected: true, isInternetReachable: true };
vi.mock('expo-network', () => ({
  getNetworkStateAsync: (): Promise<NetworkState> => (network instanceof Error ? Promise.reject(network) : Promise.resolve(network)),
}));

describe('platform/external-link (native)', () => {
  beforeEach(() => {
    refuse = false;
    opened.length = 0;
    network = { isConnected: true, isInternetReachable: true };
  });

  it('hands an https link to the system browser, and opens by itself after the gate (no pop-up rules)', async () => {
    const { openExternalUrl, HAND_OFF_NEEDS_TAP } = await import('../external-link');
    await expect(openExternalUrl('https://example.org/a')).resolves.toBe('opened');
    expect(opened).toEqual(['https://example.org/a']);
    expect(HAND_OFF_NEEDS_TAP).toBe(false);
  });

  it('reports a refused hand-off as failed, never throws', async () => {
    refuse = true;
    const { openExternalUrl } = await import('../external-link');
    await expect(openExternalUrl('https://example.org/a')).resolves.toBe('failed');
  });

  it('refuses anything but a plain https link without calling the system', async () => {
    const { openExternalUrl } = await import('../external-link');
    await expect(openExternalUrl('javascript:alert(1)')).resolves.toBe('failed');
    await expect(openExternalUrl('http://example.org')).resolves.toBe('failed');
    expect(opened).toEqual([]);
  });

  it.each<NetworkState>([
    { isConnected: false, isInternetReachable: false },
    { isConnected: false },
    { isConnected: true, isInternetReachable: false },
  ])('offline (%j): says so without handing the link to the browser', async (state) => {
    network = state;
    const { openExternalUrl } = await import('../external-link');
    await expect(openExternalUrl('https://example.org/a')).resolves.toBe('offline');
    expect(opened).toEqual([]);
  });

  it.each<NetworkState | Error>([{ isConnected: true, isInternetReachable: null }, {}, new Error('no module')])(
    'an unknown network state (%s) does not block the hand-off',
    async (state) => {
      network = state;
      const { openExternalUrl } = await import('../external-link');
      await expect(openExternalUrl('https://example.org/a')).resolves.toBe('opened');
      expect(opened).toEqual(['https://example.org/a']);
    },
  );
});

describe('platform/external-link.web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens a new tab inside the tap and cuts its handle back to the app', async () => {
    const tab = { opener: {} as unknown };
    const open = vi.fn(() => tab);
    vi.stubGlobal('open', open);
    vi.stubGlobal('navigator', { onLine: true });
    const web = await import('../external-link.web');
    await expect(web.openExternalUrl('https://example.org/a')).resolves.toBe('opened');
    expect(open).toHaveBeenCalledWith('https://example.org/a', '_blank');
    expect(tab.opener).toBeNull();
    expect(web.HAND_OFF_NEEDS_TAP).toBe(true);
  });

  it('a blocked pop-up (window.open returns null) is a failure, so the fallback line shows', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    vi.stubGlobal('navigator', { onLine: true });
    const web = await import('../external-link.web');
    await expect(web.openExternalUrl('https://example.org/a')).resolves.toBe('failed');
  });

  it('a tab whose opener cannot be cleared still counts as opened', async () => {
    const tab = {};
    Object.defineProperty(tab, 'opener', {
      set() {
        throw new Error('read-only');
      },
    });
    vi.stubGlobal('open', vi.fn(() => tab));
    vi.stubGlobal('navigator', { onLine: true });
    const web = await import('../external-link.web');
    await expect(web.openExternalUrl('https://example.org/a')).resolves.toBe('opened');
  });

  it('offline: says so without opening a tab', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    vi.stubGlobal('navigator', { onLine: false });
    const web = await import('../external-link.web');
    await expect(web.openExternalUrl('https://example.org/a')).resolves.toBe('offline');
    expect(open).not.toHaveBeenCalled();
  });

  it('a throwing or missing window.open is a failure, never an exception', async () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('open', () => {
      throw new Error('blocked');
    });
    const web = await import('../external-link.web');
    await expect(web.openExternalUrl('https://example.org/a')).resolves.toBe('failed');
    vi.stubGlobal('open', undefined);
    await expect(web.openExternalUrl('https://example.org/a')).resolves.toBe('failed');
  });

  it('refuses anything but a plain https link', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    const web = await import('../external-link.web');
    await expect(web.openExternalUrl('data:text/html,hi')).resolves.toBe('failed');
    expect(open).not.toHaveBeenCalled();
  });
});
