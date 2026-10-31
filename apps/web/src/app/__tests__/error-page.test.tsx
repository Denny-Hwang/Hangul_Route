import { UNLOCK_SESSION_KEY, type DeviceSettings, type UiLocale } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleErrorPage, leaveToLearnerApp, reloadPage } from '@/components/console/ConsoleErrorPage';
import type { LocaleProviderDeps } from '@/lib/i18n/locale-context';
import ConsoleError from '../(console)/error';

/**
 * AMENDMENTS-GROWNUP-UX GX-14 (section 9 P5): a grown-up page that fails to draw shows the console's own error page in
 * the device's language (the one display record, as every console page reads it), with the shipped Try again, instead
 * of the framework's white English "Application error". It blames nobody, shows no error detail and sends nothing.
 */
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllGlobals();
});

/** A browser whose display record says `record` (no mirror, English browser languages). */
function browser(record: DeviceSettings): LocaleProviderDeps {
  const local = new Map<string, string>();
  vi.stubGlobal('window', {
    location: { search: '' },
    localStorage: { getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => local.set(k, v), removeItem: (k: string) => local.delete(k) },
  });
  vi.stubGlobal('document', { documentElement: { lang: 'en', style: { setProperty: () => undefined, removeProperty: () => undefined } } });
  vi.stubGlobal('navigator', { languages: ['en-US'] });
  return {
    readDevice: async () => ({ readable: true, value: record, hasProfiles: true }),
    writeDevice: async () => null,
    follow: () => () => undefined,
    now: () => '2026-10-31T12:00:00.000Z',
    dropLang: () => undefined,
  };
}

const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);

async function render(locale: UiLocale, retry: () => void, focused: string[] = [], leave: (locale: UiLocale) => void = () => undefined): Promise<ReactTestRenderer> {
  const deps = browser({ uiLocale: locale, uiLocaleAt: '2026-10-30T12:00:00.000Z' });
  await act(async () => {
    mounted = create(<ConsoleErrorPage retry={retry} leave={leave} deps={deps} />, {
      createNodeMock: (element) => (element.type === 'h1' ? { focus: () => focused.push('h1') } : null),
    });
  });
  for (let i = 0; i < 4; i += 1) await act(async () => Promise.resolve());
  return mounted as unknown as ReactTestRenderer;
}

describe('the console error page (GX-14, P5)', () => {
  it('paints nothing before the language is known: no English flash on a Korean or Spanish device', () => {
    const html = renderToStaticMarkup(<ConsoleErrorPage retry={() => undefined} />);
    expect(html).toBe('<div aria-busy="true" data-testid="console-error-pending"></div>');
  });

  it.each(['en', 'es', 'ko'] as const)('%s: the title in the device language, then the shipped Try again that retries', async (locale) => {
    const m = getMessages(locale).console;
    let retries = 0;
    const r = await render(locale, () => {
      retries += 1;
    });
    const page = byTestId(r, 'console-error')[0] as ReactTestInstance;
    expect(page.props.role).toBeUndefined();
    const h1 = page.findAll((n) => n.type === 'h1');
    expect(h1.map(textOf)).toEqual([m.errorPage.title]);
    const button = byTestId(r, 'console-error-retry')[0] as ReactTestInstance;
    expect(button.type).toBe('button');
    expect(textOf(button)).toBe(m.tryAgain);
    await act(async () => button.props.onClick());
    expect(retries).toBe(1);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: the shipped Learner app under Try again is a way out, in the page language (GX-14 review)', async (locale) => {
    const m = getMessages(locale).console;
    const left: UiLocale[] = [];
    const r = await render(locale, () => undefined, [], (l) => left.push(l));
    const buttons = byTestId(r, 'console-error')[0]?.findAll((n) => n.type === 'button') ?? [];
    expect(buttons.map(textOf)).toEqual([m.tryAgain, m.shell.backToLearning]);
    const exit = byTestId(r, 'console-error-learner-app')[0] as ReactTestInstance;
    await act(async () => exit.props.onClick());
    expect(left).toEqual([locale]);
  });

  it('Learner app ends this tab\'s grown-up unlock and opens the learner app, with no id, name or error in the address', () => {
    const session = new Map<string, string>([[UNLOCK_SESSION_KEY, '{"v":1}']]);
    const assigned: string[] = [];
    vi.stubGlobal('window', {
      location: { origin: 'https://app.example.test', assign: (url: string) => assigned.push(url) },
      sessionStorage: { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) },
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    });
    leaveToLearnerApp('ko');
    expect(session.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toMatch(/^\/[^?]*\?lang=ko&who=1$/);
  });

  it('takes focus on its heading once, so a screen reader hears what happened', async () => {
    const focused: string[] = [];
    await render('ko', () => undefined, focused);
    expect(focused).toEqual(['h1']);
  });

  it('error.tsx is the route group\'s boundary: Try again loads the page again, and the error is never passed on', () => {
    const element = ConsoleError({ error: Object.assign(new Error('learner Mina at space:abc failed'), { digest: 'd1' }), reset: () => undefined }) as { type: unknown; props: Record<string, unknown> };
    expect(element.type).toBe(ConsoleErrorPage);
    expect(element.props).toEqual({ retry: reloadPage });
    let reloads = 0;
    vi.stubGlobal('window', { location: { reload: () => (reloads += 1) } });
    reloadPage();
    expect(reloads).toBe(1);
  });
});
