import type { DeviceSettings } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceSettingsRead } from '../device-settings';
import { LocaleProvider, RECORD_WAIT_MS, useConsoleLocale, useLocale, useMessages, withoutLang, type ConsoleLocale, type LocaleProviderDeps } from '../locale-context';

/**
 * The console's locale and text size provider (F-I18N-001 §3.2; owner items 6 and 7): the static
 * HTML is English; after mount the device's one display record decides (the learner app's
 * `hr:device:settings`), `?lang=` only seeds a device that never chose, the mirrors keep the
 * first paint, a choice here writes the record, and a record another tab wrote applies live.
 */
function Probe(): JSX.Element {
  const locale = useLocale();
  const messages = useMessages();
  const { available } = useConsoleLocale();
  return (
    <p>
      {locale}|{messages.common.display.title}|{available.join(',')}|{String(messages === getMessages(locale))}
    </p>
  );
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('console LocaleProvider: the static HTML (F-I18N-001 §3.2)', () => {
  it('outside a provider the hooks give English, the English dictionary, and a ready state', () => {
    expect(renderToStaticMarkup(<Probe />)).toBe('<p>en|Display|en|true</p>');
  });

  it('static HTML is always English: the record applies after mount', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider available={['en', 'es', 'ko']}>
        <Probe />
      </LocaleProvider>,
    );
    expect(html).toBe('<p>en|Display|en,es,ko|true</p>');
  });

  it('lists the shipped locales by default: all three since F-I18N-001 rows 15b / 16b', () => {
    expect(renderToStaticMarkup(<LocaleProvider><Probe /></LocaleProvider>)).toBe('<p>en|Display|en,es,ko|true</p>');
  });

  it('lists every locale on a QA build (NEXT_PUBLIC_SHOW_ALL_LOCALES=1)', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(renderToStaticMarkup(<LocaleProvider><Probe /></LocaleProvider>)).toContain('|en,es,ko|');
  });

  it('renders children only: no wrapper element', () => {
    expect(renderToStaticMarkup(<LocaleProvider>x</LocaleProvider>)).toBe('x');
  });
});

/** A browser with a learner store, a mirror and a channel, all in memory. */
function browser(opts: { record?: DeviceSettings | 'unreadable'; mirror?: Record<string, string>; search?: string; languages?: string[] } = {}) {
  let record: DeviceSettings | 'unreadable' = opts.record ?? {};
  const writes: DeviceSettings[] = [];
  const local = new Map<string, string>(Object.entries(opts.mirror ?? {}));
  const style = new Map<string, string>();
  const doc = {
    documentElement: {
      lang: 'en',
      style: { setProperty: (k: string, v: string) => style.set(k, v), removeProperty: (k: string) => style.delete(k) },
    },
  };
  vi.stubGlobal('window', {
    location: { search: opts.search ?? '' },
    localStorage: {
      getItem: (k: string) => local.get(k) ?? null,
      setItem: (k: string, v: string) => local.set(k, v),
      removeItem: (k: string) => local.delete(k),
    },
  });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', { languages: opts.languages ?? ['en-US'] });
  let onRecord: ((v: DeviceSettings) => void) | null = null;
  let dropped = 0;
  let onReturn: (() => void) | null = null;
  const deps: Required<LocaleProviderDeps> = {
    readDevice: async (): Promise<DeviceSettingsRead> => (record === 'unreadable' ? { readable: false } : { readable: true, value: record }),
    writeDevice: async (patch) => {
      if (record === 'unreadable') return null;
      record = patch(record);
      writes.push(record);
      return record;
    },
    follow: (r, ret) => {
      onRecord = r;
      onReturn = ret;
      return () => {
        onRecord = null;
        onReturn = null;
      };
    },
    now: () => '2026-10-16T12:00:00.000Z',
    dropLang: () => {
      dropped += 1;
    },
  };
  return {
    deps,
    writes,
    local,
    style,
    doc,
    record: () => record,
    setRecord: (next: DeviceSettings) => {
      record = next;
    },
    post: (v: DeviceSettings) => onRecord?.(v),
    comeBack: () => onReturn?.(),
    dropped: () => dropped,
  };
}

let ctx: ConsoleLocale | null = null;
function Capture(): null {
  ctx = useConsoleLocale();
  return null;
}

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  ctx = null;
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

async function mount(deps: LocaleProviderDeps): Promise<void> {
  await act(async () => {
    mounted = create(
      <LocaleProvider available={['en', 'es', 'ko']} deps={deps}>
        <Capture />
      </LocaleProvider>,
    );
  });
}

describe('console LocaleProvider: the device record (owner items 6 and 7)', () => {
  it('waits (ready false) until the record is read, then speaks its language at its size', async () => {
    const b = browser({ record: { uiLocale: 'ko', textSize: 'larger' }, languages: ['en-US'] });
    await mount(b.deps);
    expect(ctx?.ready).toBe(true);
    expect(ctx?.locale).toBe('ko');
    expect(ctx?.textSize).toBe('larger');
    expect(b.doc.documentElement.lang).toBe('ko');
    expect(b.style.get('--hr-text-scale')).toBe('1.3');
    // Headings grow half as much: (1 + 0.15) / 1.3.
    expect(Number(b.style.get('--hr-head-ratio'))).toBeCloseTo(1.15 / 1.3);
    expect(b.style.get('font-size')).toBe('calc(100% * var(--hr-text-scale, 1))');
    // The mirrors follow the record, for the next first paint.
    expect(b.local.get('hr:console:uiLocale')).toBe('ko');
    expect(b.local.get('hr:console:textSize')).toBe('larger');
    expect(b.writes).toEqual([]);
  });

  it('an English learner app beats a console that stored ko', async () => {
    const b = browser({ record: { uiLocale: 'en' }, mirror: { 'hr:console:uiLocale': 'ko' }, languages: ['ko-KR'] });
    await mount(b.deps);
    expect(ctx?.locale).toBe('en');
    expect(b.local.get('hr:console:uiLocale')).toBe('en');
  });

  it('?lang= seeds a device that never chose (stamped now), never one that chose, and leaves the address either way', async () => {
    const b = browser({ record: { textSize: 'large' }, search: '?lang=es' });
    await mount(b.deps);
    expect(ctx?.locale).toBe('es');
    expect(b.writes).toEqual([{ textSize: 'large', uiLocale: 'es', uiLocaleAt: '2026-10-16T12:00:00.000Z' }]);
    expect(b.dropped()).toBe(1);
    act(() => mounted?.unmount());
    const c = browser({ record: { uiLocale: 'en', uiLocaleAt: '2026-10-01T00:00:00.000Z' }, search: '?lang=ko' });
    await mount(c.deps);
    expect(ctx?.locale).toBe('en');
    expect(c.writes).toEqual([]);
    expect(c.dropped()).toBe(1);
    // A junk lang leaves the address too; no lang at all touches nothing.
    act(() => mounted?.unmount());
    const d = browser({ record: {}, search: '?x=1&lang=fr' });
    await mount(d.deps);
    expect(d.dropped()).toBe(1);
    act(() => mounted?.unmount());
    const e = browser({ record: {}, search: '?x=1' });
    await mount(e.deps);
    expect(e.dropped()).toBe(0);
  });

  it('withoutLang keeps the rest of the query and the hash as written', () => {
    expect(withoutLang({ pathname: '/parent', search: '?lang=en', hash: '' })).toBe('/parent');
    expect(withoutLang({ pathname: '/signin', search: '?persona=teacher&lang=en', hash: '#x' })).toBe('/signin?persona=teacher#x');
    expect(withoutLang({ pathname: '/teach/space', search: '?lang=ko&id=sp_1&next=%2Fa', hash: '' })).toBe('/teach/space?id=sp_1&next=%2Fa');
  });

  it('a choice here writes the record with its time, the mirror, and offers it to the account sync', async () => {
    const b = browser({ record: { textSize: 'largest' } });
    await mount(b.deps);
    await act(async () => ctx?.setLocale('ko'));
    expect(ctx?.locale).toBe('ko');
    expect(b.record()).toEqual({ textSize: 'largest', uiLocale: 'ko', uiLocaleAt: '2026-10-16T12:00:00.000Z' });
    expect(ctx?.lastChoice).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T12:00:00.000Z' });
    expect(b.local.get('hr:console:uiLocale')).toBe('ko');
    // A locale this build does not offer is refused.
    await act(async () => ctx?.setLocale('fr' as never));
    expect(ctx?.locale).toBe('ko');
  });

  it('a text size choice writes the record and the --hr-text-scale of the page', async () => {
    const b = browser({ record: { uiLocale: 'en' } });
    await mount(b.deps);
    await act(async () => ctx?.setTextSize('largest'));
    expect(ctx?.textSize).toBe('largest');
    expect(b.record()).toEqual({ uiLocale: 'en', textSize: 'largest' });
    expect(b.style.get('--hr-text-scale')).toBe('1.5');
    expect(b.local.get('hr:console:textSize')).toBe('largest');
  });

  it('a record another tab posted applies live; a page back in front re-reads the record', async () => {
    const b = browser({ record: { uiLocale: 'en' } });
    await mount(b.deps);
    act(() => b.post({ uiLocale: 'es', textSize: 'large' }));
    expect(ctx?.locale).toBe('es');
    expect(ctx?.textSize).toBe('large');
    b.setRecord({ uiLocale: 'ko' });
    await act(async () => b.comeBack());
    expect(ctx?.locale).toBe('ko');
    expect(ctx?.textSize).toBe('standard');
    // A record with a hidden language keeps the language shown and still takes the size.
    act(() => b.post({ uiLocale: 'fr' as never, textSize: 'larger' }));
    expect(ctx?.locale).toBe('ko');
  });

  it('the account merge applies a record: written, mirrored and shown', async () => {
    const b = browser({ record: { textSize: 'large' } });
    await mount(b.deps);
    await act(async () => ctx?.applyRecord({ uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' }));
    expect(ctx?.locale).toBe('ko');
    expect(b.record()).toEqual({ textSize: 'large', uiLocale: 'ko', uiLocaleAt: '2026-10-15T00:00:00.000Z' });
  });

  it('a record that cannot be read: the mirror decides and nothing is written', async () => {
    const b = browser({ record: 'unreadable', mirror: { 'hr:console:uiLocale': 'ko', 'hr:console:textSize': 'larger' }, search: '?lang=' });
    await mount(b.deps);
    expect(ctx?.ready).toBe(true);
    expect(ctx?.locale).toBe('ko');
    expect(ctx?.textSize).toBe('larger');
    expect(ctx?.record).toBeNull();
  });

  it('a record read that never settles still lets the page paint after the wait', async () => {
    vi.useFakeTimers();
    try {
      const b = browser({ mirror: { 'hr:console:uiLocale': 'es' } });
      await mount({ ...b.deps, readDevice: () => new Promise<DeviceSettingsRead>(() => undefined) });
      expect(ctx?.ready).toBe(false);
      expect(ctx?.locale).toBe('es');
      act(() => {
        vi.advanceTimersByTime(RECORD_WAIT_MS);
      });
      expect(ctx?.ready).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a read that throws counts as unreadable', async () => {
    const b = browser({ mirror: { 'hr:console:uiLocale': 'ko' } });
    await mount({ ...b.deps, readDevice: () => Promise.reject(new Error('closed')) });
    expect(ctx?.locale).toBe('ko');
    expect(ctx?.ready).toBe(true);
  });
});
