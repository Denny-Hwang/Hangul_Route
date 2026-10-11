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

describe('platform/external-link (native)', () => {
  beforeEach(() => {
    refuse = false;
    opened.length = 0;
  });

  it('hands an https link to the system browser', async () => {
    const { openExternalUrl } = await import('../external-link');
    await expect(openExternalUrl('https://example.org/a')).resolves.toBe('opened');
    expect(opened).toEqual(['https://example.org/a']);
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
});

describe('platform/external-link.web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens a new tab with noopener and noreferrer (the page cannot reach back)', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    vi.stubGlobal('navigator', { onLine: true });
    const web = await import('../external-link.web');
    await expect(web.openExternalUrl('https://example.org/a')).resolves.toBe('opened');
    expect(open).toHaveBeenCalledWith('https://example.org/a', '_blank', 'noopener,noreferrer');
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
