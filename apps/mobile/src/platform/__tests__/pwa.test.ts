import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, isStandalone, subscribePwa } from '../pwa';
import * as web from '../pwa.web';

// Native clipboard (expo-clipboard): a plain function, so a rejected promise is not reported as unhandled.
let clipboard: 'ok' | 'refused' | 'throws' = 'ok';
const clipped: string[] = [];
vi.mock('expo-clipboard', () => ({
  setStringAsync: (text: string): Promise<boolean> => {
    clipped.push(text);
    if (clipboard === 'throws') return Promise.reject(new Error('no clipboard'));
    return Promise.resolve(clipboard === 'ok');
  },
}));

describe('platform/pwa (native no-op)', () => {
  it('never fires and reports standalone', () => {
    const l = vi.fn();
    const off = subscribePwa(l);
    off();
    applyUpdate();
    expect(l).not.toHaveBeenCalled();
    expect(isStandalone()).toBe(true);
  });
});

describe('platform/pwa.web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards shell and connectivity events to one listener and unsubscribes', () => {
    const handlers = new Map<string, () => void>();
    const win = {
      addEventListener: vi.fn((name: string, h: () => void) => handlers.set(name, h)),
      removeEventListener: vi.fn((name: string) => handlers.delete(name)),
      matchMedia: vi.fn(() => ({ matches: true })),
      navigator: {},
      __hrApplyUpdate: vi.fn(),
    };
    vi.stubGlobal('addEventListener', win.addEventListener);
    vi.stubGlobal('removeEventListener', win.removeEventListener);
    vi.stubGlobal('matchMedia', win.matchMedia);
    vi.stubGlobal('navigator', win.navigator);
    vi.stubGlobal('__hrApplyUpdate', win.__hrApplyUpdate);

    const l = vi.fn();
    const off = web.subscribePwa(l);
    handlers.get('hr:offline-ready')?.();
    handlers.get('hr:update-ready')?.();
    handlers.get('offline')?.();
    handlers.get('online')?.();
    expect(l.mock.calls.map((c) => c[0])).toEqual(['offline-ready', 'update-ready', 'went-offline', 'back-online']);
    expect(web.isStandalone()).toBe(true);
    web.applyUpdate();
    expect(win.__hrApplyUpdate).toHaveBeenCalled();
    off();
    expect(handlers.size).toBe(0);
  });

  it('is inert without a window', () => {
    vi.stubGlobal('addEventListener', undefined);
    vi.stubGlobal('matchMedia', undefined);
    expect(() => web.subscribePwa(vi.fn())()).not.toThrow();
    expect(web.isStandalone()).toBe(false);
    expect(() => web.applyUpdate()).not.toThrow();
  });
});

describe('platform/pwa install API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('native: no env, no prompt, always offline-ready', async () => {
    const { appUrl, installEnv, isOfflineReady, promptInstall } = await import('../pwa');
    expect(installEnv()).toEqual({ userAgent: '', standalone: true, hasPromptEvent: false, isWeb: false, maxTouchPoints: 0 });
    expect(await promptInstall()).toBe(false);
    expect(isOfflineReady()).toBe(true);
    expect(appUrl()).toBe('');
  });

  it('native: copies through the system clipboard; a refusal or an error is false, never a throw', async () => {
    const { copyText } = await import('../pwa');
    clipped.length = 0;
    clipboard = 'ok';
    expect(await copyText('https://example.org/a')).toBe(true);
    clipboard = 'refused';
    expect(await copyText('x')).toBe(false);
    clipboard = 'throws';
    expect(await copyText('y')).toBe(false);
    expect(clipped).toEqual(['https://example.org/a', 'x', 'y']);
  });

  it('web: reads the shell prompt, service-worker controller, origin and clipboard', async () => {
    const prompt = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('addEventListener', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile',
      serviceWorker: { controller: {} },
      clipboard: { writeText },
    });
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    vi.stubGlobal('__hrInstallPrompt', { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });

    expect(web.installEnv()).toEqual({
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile',
      standalone: false,
      hasPromptEvent: true,
      isWeb: true,
      maxTouchPoints: 0,
    });
    expect(web.isOfflineReady()).toBe(true);
    expect(web.appUrl()).toBe('https://app.example.com');
    expect(await web.copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(await web.promptInstall()).toBe(true);
    expect(prompt).toHaveBeenCalled();
    // consumed: a second call has no prompt to fire
    expect(await web.promptInstall()).toBe(false);
  });

  it('web: passes the touch-point count, so an iPad that reads as a Mac gets the iOS steps', async () => {
    vi.stubGlobal('addEventListener', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.4 Safari/605.1.15', maxTouchPoints: 5 });
    expect(web.installEnv().maxTouchPoints).toBe(5);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh)' });
    expect(web.installEnv().maxTouchPoints).toBe(0);
  });

  it('web: a rejected or missing prompt resolves false and clipboard errors are swallowed', async () => {
    vi.stubGlobal('addEventListener', vi.fn());
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) } });
    vi.stubGlobal('__hrInstallPrompt', { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    expect(await web.promptInstall()).toBe(false);
    expect(await web.copyText('x')).toBe(false);
    vi.stubGlobal('__hrInstallPrompt', undefined);
    expect(await web.promptInstall()).toBe(false);
    expect(web.isOfflineReady()).toBe(false);
  });
});
