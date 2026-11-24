import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '@/lib/console/api';
import { qrModules, qrPath } from '@/lib/console/join-link';
import { codeExpiry } from '@/lib/console/rollup';
import { CLASS_RELINK_REFRESH_MS } from '@/lib/console/visible-refresh';

/**
 * AMENDMENTS-CLASS-CODE-OVERLAY CO-1b (OD-CO7 (a); tests section 6, CO-1b row): Show the code on a teacher home class row
 * opens the class page's overlay over the home, from the spaces list the home already reads. No roster is read, nothing
 * a learner owns reaches the screen (the overlay's allow-list is test 4's), the page content is one inert container while
 * it is open, the list is read again while it is open, and focus goes back to the row's button. Rendered with
 * react-test-renderer (no DOM); the harness is the teacher home suite's and the class page overlay wiring test's.
 */
const lang = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined }) }));
vi.mock('@/lib/console/shell-store', () => ({ writeLastPersona: async () => true }));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

const NOW = new Date('2026-11-24T12:00:00.000Z');
const calls = vi.hoisted(() => ({ names: [] as string[], list: [] as unknown[], fail: false }));
const api = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      async () => {
        calls.names.push(name);
        if (name === 'listSpaces') return calls.fail ? { ok: false, error: 'network' } : { ok: true, data: calls.list };
        return { ok: false, error: 'network' };
      },
  },
);
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  const session = { accountId: 'acct-co', displayName: 'Ms Kim' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: i18n.getMessages(lang.locale), locale: lang.locale }) };
});

import HomePage from '@/app/(console)/teach/home/page';

function item(id: string, kind: SpaceListItem['space']['kind'], name: string, over: { code?: string | null; expires?: string | null; archivedAt?: string | null } = {}): SpaceListItem {
  return {
    space: { id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: over.archivedAt ?? null, createdAt: '2026-10-01T00:00:00Z' },
    role: 'owner',
    counts: { learners: 12, accounts: 1, classes: 0 },
    joinCode: over.code === undefined ? 'SUN234' : over.code,
    joinCodeExpiresAt: over.expires === undefined ? '2026-12-12T12:00:00.000Z' : over.expires,
  };
}
const sunday = (): SpaceListItem => item('sp_sun', 'class', 'Sunday Class A');
const tuesday = (): SpaceListItem => item('sp_tue', 'class', 'Tuesday Class B', { code: 'TUE567', expires: '2026-11-25T08:00:00.000Z' });
const noCode = (): SpaceListItem => item('sp_none', 'class', 'No Code Class', { code: null, expires: null });
const expired = (): SpaceListItem => item('sp_old', 'class', 'Expired Class', { expires: '2026-11-01T00:00:00.000Z' });
const archived = (): SpaceListItem => item('sp_arch', 'class', 'Archived Class', { archivedAt: '2026-09-01T00:00:00Z' });
const school = (): SpaceListItem => item('sp_school', 'school', 'Pine School');
const family = (): SpaceListItem => item('sp_fam', 'family', 'Kim family');

type DocListener = (event: { key: string; shiftKey: boolean; defaultPrevented?: boolean; preventDefault: () => void }) => void;
const keydown = new Set<DocListener>();
const fakeDocument = {
  title: 'Hangul Route for teachers',
  body: {},
  visibilityState: 'visible',
  documentElement: { setAttribute: () => undefined, removeAttribute: () => undefined, style: { overflow: '' } },
  addEventListener: (type: string, l: DocListener | (() => void)) => {
    if (type === 'keydown') keydown.add(l as DocListener);
  },
  removeEventListener: (type: string, l: DocListener | (() => void)) => {
    if (type === 'keydown') keydown.delete(l as DocListener);
  },
};
const fakeWindow = {
  location: { pathname: '/teach/home', search: '', hash: '', origin: 'https://app.hangulroute.com' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', fakeWindow);
  vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'false');
  vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'false');
  vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'off');
  calls.names = [];
  calls.fail = false;
  calls.list = [sunday(), tuesday(), noCode(), expired(), archived(), school(), family()];
  lang.locale = 'en';
  focused.length = 0;
});
let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  keydown.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const textOf = (node: ReactTestInstance | string): string => (typeof node === 'string' ? node : node.children.map((child) => textOf(child)).join(''));
const root = (): ReactTestInstance => (mounted as ReactTestRenderer).root;
const byTestId = (id: string): ReactTestInstance[] => root().findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const one = (id: string): ReactTestInstance => {
  const [found] = byTestId(id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const overlay = (): ReactTestInstance | undefined => byTestId('class-code-overlay')[0];

/** What the page asked to focus, by test id: react-test-renderer has no DOM, so each ref gets a node that records it. */
const focused: string[] = [];
const nodeMock = (el: { props: Record<string, unknown>; type: unknown }) => ({
  focus: () => focused.push(String(el.props['data-testid'] ?? el.type)),
  querySelector: (selector: string) => ({ focus: () => focused.push(selector) }),
  querySelectorAll: () => [],
});

async function render(): Promise<void> {
  await act(async () => {
    mounted = create(<HomePage />, { createNodeMock: nodeMock });
  });
  await act(async () => undefined);
}
async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    (node.props.onClick as () => void)();
  });
  await act(async () => undefined);
}
async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => undefined);
}
async function escape(): Promise<void> {
  await act(async () => {
    for (const l of [...keydown]) l({ key: 'Escape', shiftKey: false, preventDefault: () => undefined });
  });
}
/** Every text node and every attribute value that names something inside `node`. */
function shown(node: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string): void => {
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    if (typeof n.type === 'string') for (const key of ['aria-label', 'title', 'alt'] as const) if (typeof n.props[key] === 'string') out.push(n.props[key] as string);
    n.children.forEach(walk);
  };
  walk(node);
  return out.map((s) => s.trim()).filter(Boolean);
}
const opens = (): string[] => root().findAll((n) => typeof n.type === 'string' && String(n.props['data-testid'] ?? '').startsWith('class-code-open-')).map((n) => n.props['data-testid'] as string);

describe('Show the code on a teacher home class row (3.1, OD-CO7 (a))', () => {
  it('only a class with a live code has the button: not no code, an expired code, an archived class, a school', async () => {
    await render();
    expect(opens()).toEqual(['class-code-open-sp_sun', 'class-code-open-sp_tue']);
    const button = one('class-code-open-sp_sun');
    expect(button.type).toBe('button');
    expect(button.props['aria-haspopup']).toBe('dialog');
    expect(button.props['aria-describedby']).toBe('space-name-sp_sun');
    expect(overlay()).toBeUndefined();
  });

  it('it comes after Class report and Notes in the row of links', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    await render();
    const row = one('space-row-sp_sun');
    const ids = row.findAll((n) => (n.type === 'button' || n.type === 'a') && typeof n.props['data-testid'] === 'string').map((n) => n.props['data-testid']);
    expect(ids).toEqual(['space-open-sp_sun', 'class-report-sp_sun', 'class-notes-sp_sun', 'class-code-open-sp_sun']);
  });

  it.each(['en', 'es', 'ko'] as UiLocale[])('%s: the button says Show the code in the console language', async (locale) => {
    lang.locale = locale;
    await render();
    expect(textOf(one('class-code-open-sp_sun'))).toBe(getMessages(locale).console.space.codeOverlay.open.cta);
  });

  it('a home with only a family, or no class, has no button', async () => {
    calls.list = [family()];
    await render();
    expect(opens()).toEqual([]);
  });
});

describe('the overlay over the home (3.2, 3.3)', () => {
  it('shows the opened class name, code, expiry and the QR of the join link, and nothing else; no roster is read', async () => {
    await render();
    const beforeOpen = calls.names.length;
    await press(one('class-code-open-sp_tue'));
    const afterOpen = calls.names.slice(beforeOpen);
    const dialog = overlay() as ReactTestInstance;
    expect(dialog).toBeDefined();
    const m = getMessages('en');
    const allowed = [
      'Tuesday Class B',
      m.console.space.codeLabel.class,
      'TUE567',
      'T U E 5 6 7',
      codeExpiry('2026-11-25T08:00:00.000Z', NOW, 'en'),
      m.console.space.codeOverlay.howToJoin(m.caregiver.spaces.join.cta),
      m.console.space.joinLink.qr.label,
      m.console.space.joinLink.qr.caption,
      m.common.buttons.close,
    ];
    const strings = shown(dialog);
    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) expect(allowed, `"${s}" is not on the allow-list`).toContain(s);
    expect(textOf(one('class-code'))).toBe('TUE567');
    expect(one('class-code-qr').findByType('path').props.d).toBe(qrPath(qrModules('https://app.hangulroute.com/join#c=TUE567')));
    // Another class's name, the learner counts and the rest of the home are not in it.
    const text = strings.join(' | ');
    for (const other of ['Sunday Class A', 'SUN234', 'No Code Class', 'Pine School', '12']) expect(text).not.toContain(other);
    // The overlay is drawn from the list alone: opening it adds no call but the spaces list, and the page's own reads (the
    // class rows' waiting counts) are exactly this set, never a roster. (The real AdultFrame, mocked here, may read
    // `api.roster` for a one-learner family whatever the overlay does; that read is not drawn.)
    expect(new Set(calls.names)).toEqual(new Set(['listSpaces', 'relinkRequests', 'classMoves', 'transferRequests', 'school']));
    expect(new Set(afterOpen)).toEqual(new Set(['listSpaces']));
  });

  it('the page content is one inert container while it is open and not after Close', async () => {
    await render();
    expect(one('teacher-home-content').props.inert).toBeUndefined();
    await press(one('class-code-open-sp_sun'));
    expect(one('teacher-home-content').props.inert).toBe('');
    await press(one('class-code-close'));
    expect(one('teacher-home-content').props.inert).toBeUndefined();
    expect(overlay()).toBeUndefined();
  });

  it('opening moves focus to the heading; Close and Escape put it back on the row\'s button', async () => {
    await render();
    await press(one('class-code-open-sp_tue'));
    expect(focused).toContain('h2');
    focused.length = 0;
    await press(one('class-code-close'));
    expect(overlay()).toBeUndefined();
    expect(focused).toEqual(['class-code-open-sp_tue']);
    await press(one('class-code-open-sp_sun'));
    focused.length = 0;
    await escape();
    expect(overlay()).toBeUndefined();
    expect(focused).toEqual(['class-code-open-sp_sun']);
  });
});

describe('while the overlay is open (3.6)', () => {
  it('opening reads the list once more and then every 20 s; nothing reads it when closed', async () => {
    await render();
    const reads = (): number => calls.names.filter((n) => n === 'listSpaces').length;
    const before = reads();
    await advance(CLASS_RELINK_REFRESH_MS * 3);
    expect(reads()).toBe(before);
    await press(one('class-code-open-sp_sun'));
    expect(reads()).toBe(before + 1);
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(reads()).toBe(before + 2);
    await press(one('class-code-close'));
    const closed = reads();
    await advance(CLASS_RELINK_REFRESH_MS * 3);
    expect(reads()).toBe(closed);
  });

  it('a re-read with a new code redraws the code and the QR in place', async () => {
    await render();
    await press(one('class-code-open-sp_sun'));
    calls.list = [{ ...sunday(), joinCode: 'NEW567' }, tuesday()];
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(textOf(one('class-code'))).toBe('NEW567');
    expect(one('class-code-qr').findByType('path').props.d).toBe(qrPath(qrModules('https://app.hangulroute.com/join#c=NEW567')));
    expect(shown(overlay() as ReactTestInstance)).toContain('N E W 5 6 7');
  });

  it('a re-read that finds no live code closes it, with focus on the page title', async () => {
    await render();
    await press(one('class-code-open-sp_sun'));
    calls.list = [{ ...sunday(), joinCode: null, joinCodeExpiresAt: null }, tuesday()];
    focused.length = 0;
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(overlay()).toBeUndefined();
    expect(opens()).toEqual(['class-code-open-sp_tue']);
    expect(focused).toEqual(['teacher-home-title']);
  });

  it('after the self-close, a re-read that brings a new code does not open it again', async () => {
    await render();
    await press(one('class-code-open-sp_sun'));
    calls.list = [{ ...sunday(), joinCode: null, joinCodeExpiresAt: null }, tuesday()];
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(overlay()).toBeUndefined();
    // Nothing reads the list while it is closed; opening another class does, and brings the new code of the first.
    calls.list = [{ ...sunday(), joinCode: 'NEW567' }, tuesday()];
    await press(one('class-code-open-sp_tue'));
    expect(textOf(one('class-code'))).toBe('TUE567');
    expect(byTestId('class-code-overlay')).toHaveLength(1);
    await press(one('class-code-close'));
    expect(overlay()).toBeUndefined();
    await advance(CLASS_RELINK_REFRESH_MS * 5);
    expect(overlay()).toBeUndefined();
    expect(opens()).toEqual(['class-code-open-sp_sun', 'class-code-open-sp_tue']);
  });

  it('a re-read that fails keeps the overlay and draws no error panel behind it', async () => {
    await render();
    await press(one('class-code-open-sp_sun'));
    calls.fail = true;
    await advance(CLASS_RELINK_REFRESH_MS);
    expect(overlay()).toBeDefined();
    expect(textOf(one('class-code'))).toBe('SUN234');
    expect(textOf(root())).not.toContain(getMessages('en').console.cantReach);
  });
});
