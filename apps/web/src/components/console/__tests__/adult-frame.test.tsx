import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '@/lib/console/api';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';

/**
 * F-APP-001 A-5a, sections 3.8 and 3.16 (design/screens/app-shell/adult-frame.md): the adult frame
 * that replaces `ConsoleShell`. The persona switch shows only with both personas (once the family
 * home is live, mocked on here); the active persona of a space page is the kind of its space; the
 * way back clears the tab; Language and Sign out sit in the footer at phone width.
 */
// next/link needs the app router's context; a plain anchor keeps its href, its text and its attributes.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const nav = vi.hoisted(() => ({ pushed: [] as string[] }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => nav.pushed.push(url), replace: () => undefined }),
}));

const live = vi.hoisted(() => ({ value: true }));
vi.mock('@/lib/console/personas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/console/personas')>();
  return {
    ...actual,
    get FAMILY_HOME_LIVE() {
      return live.value;
    },
  };
});

const consoleView = vi.hoisted(() => ({
  api: null as null | { listSpaces: () => Promise<unknown>; roster: (id: string) => Promise<unknown> },
  signOuts: 0,
}));
vi.mock('../use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({
      ready: true,
      session: { accountId: 'acc_1', displayName: 'Kim' },
      api: consoleView.api,
      signOut: () => {
        consoleView.signOuts += 1;
      },
      m: messages('en'),
      locale: 'en',
    }),
  };
});

const locales = vi.hoisted(() => ({ available: ['en'] as string[] }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return {
    useConsoleLocale: () => ({ locale: 'en', messages: messages('en'), available: locales.available, setLocale: () => undefined }),
    useMessages: () => messages('en'),
  };
});

import { AdultFrame, opensLearnerApp, resetFrameMemory, type AdultFrameEnvironment, type FrameSpaces } from '../AdultFrame';
import { GrownUpLocationContext } from '../grown-up-location';

const en = getMessages('en');

function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], learners = 2): SpaceListItem {
  return {
    space: { id, kind, name: id, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    role,
    counts: { learners, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

const family = item('sp_f', 'family', 'owner');
const klass = item('sp_c', 'class', 'teacher');

interface FakeEnv extends AdultFrameEnvironment {
  written: string[];
  assigned: string[];
  cleared: number;
}

function fakeEnv(over: { pathname?: string; search?: string; origin?: string; device?: DeviceGateRead; last?: 'parent' | 'teacher' | null } = {}): FakeEnv {
  const env: FakeEnv = {
    written: [],
    assigned: [],
    cleared: 0,
    location: () => ({ origin: over.origin ?? 'https://app.hangulroute.com', pathname: over.pathname ?? '/teach/home', search: over.search ?? '' }),
    readDevice: async () => over.device ?? { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: 5 }, hasProfiles: true },
    readLastPersona: async () => over.last ?? null,
    writeLastPersona: (persona) => {
      env.written.push(persona);
    },
    clearGrownUpTab: () => {
      env.cleared += 1;
    },
    assign: (url) => {
      env.assigned.push(url);
    },
  };
  return env;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  nav.pushed = [];
  live.value = true;
  consoleView.api = null;
  consoleView.signOuts = 0;
  locales.available = ['en'];
  resetFrameMemory();
  vi.unstubAllEnvs();
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllEnvs();
});

async function render(env: FakeEnv, spaces?: FrameSpaces, children: ReactNode = <p>page</p>): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(
      <AdultFrame env={env} spaces={spaces} title={undefined}>
        {children}
      </AdultFrame>,
    );
  });
  return mounted as unknown as ReactTestRenderer;
}

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const navIds = (r: ReactTestRenderer): string[] =>
  r.root.findAll((n) => typeof n.type === 'string' && typeof n.props['data-testid'] === 'string' && n.props['data-testid'].startsWith('nav-')).map((n) => n.props['data-testid'].slice(4));
const current = (r: ReactTestRenderer): string[] => r.root.findAll((n) => typeof n.type === 'string' && n.props['aria-current'] === 'page').map((n) => textOf(n));
const allText = (r: ReactTestRenderer): string => textOf(r.root);

describe('the persona switch (sections 3.8, 3.16)', () => {
  it('shows a radiogroup labelled for both personas only when the account holds both, options Family and Teacher', async () => {
    const r = await render(fakeEnv(), [family, klass]);
    const group = byTestId(r, 'persona-switch')[0];
    expect(group?.props.role).toBe('radiogroup');
    expect(group?.props['aria-label']).toBe('Switch between Family and Teacher');
    const radios = group?.findAll((n) => n.props.role === 'radio' && typeof n.type === 'string') ?? [];
    expect(radios.map(textOf)).toEqual(['Family', 'Teacher']);
    expect(radios.map((n) => n.props['aria-checked'])).toEqual([false, true]);
    expect(radios.map((n) => n.props.tabIndex)).toEqual([-1, 0]);
  });

  it('shows the persona name as text with one persona', async () => {
    const r = await render(fakeEnv(), [klass]);
    expect(byTestId(r, 'persona-switch')).toHaveLength(0);
    expect(textOf(byTestId(r, 'frame-persona')[0] as ReactTestInstance)).toBe('Teacher');
  });

  it('manual activation: an arrow key moves focus only; a click commits, writes the last persona and opens that home', async () => {
    const env = fakeEnv();
    const r = await render(env, [family, klass]);
    const teacher = byTestId(r, 'persona-teacher')[0] as ReactTestInstance;
    let prevented = false;
    await act(async () => {
      teacher.props.onKeyDown({ key: 'ArrowRight', preventDefault: () => (prevented = true) });
    });
    expect(prevented).toBe(true);
    expect(nav.pushed).toEqual([]);
    expect(env.written).toEqual(['teacher']);
    expect(byTestId(r, 'persona-parent')[0]?.props.tabIndex).toBe(0);
    expect(byTestId(r, 'persona-teacher')[0]?.props['aria-checked']).toBe(true);
    await act(async () => {
      byTestId(r, 'persona-parent')[0]?.props.onClick();
    });
    expect(env.written).toEqual(['teacher', 'parent']);
    expect(nav.pushed).toEqual(['/parent']);
  });

  it('choosing the persona already shown does nothing; other keys are ignored', async () => {
    const env = fakeEnv();
    const r = await render(env, [family, klass]);
    await act(async () => {
      byTestId(r, 'persona-teacher')[0]?.props.onKeyDown({ key: 'a', preventDefault: () => undefined });
      byTestId(r, 'persona-teacher')[0]?.props.onClick();
    });
    expect(nav.pushed).toEqual([]);
  });

  it('stays hidden while /parent is still the demo (both homes are the console home)', async () => {
    live.value = false;
    const r = await render(fakeEnv(), [family, klass]);
    expect(byTestId(r, 'persona-switch')).toHaveLength(0);
    expect(textOf(byTestId(r, 'frame-persona')[0] as ReactTestInstance)).toBe('Teacher');
  });
});

describe('the active persona and the navigation (section 3.8)', () => {
  it('a family space page under /teach/space is a Family page: Family checked, Family nav, Home highlighted', async () => {
    const r = await render(fakeEnv({ pathname: '/teach/space/plan', search: '?id=sp_f', last: 'teacher' }), [family, klass]);
    expect(byTestId(r, 'persona-parent')[0]?.props['aria-checked']).toBe(true);
    expect(navIds(r)).toEqual(['home', 'billing']);
    expect(current(r)).toEqual(['Home']);
  });

  it('a class page is a Teacher page: Classes and Billing, Classes highlighted', async () => {
    const r = await render(fakeEnv({ pathname: '/teach/space', search: '?id=sp_c' }), [family, klass]);
    expect(navIds(r)).toEqual(['classes', 'billing']);
    expect(current(r)).toEqual(['Classes']);
    expect(r.root.findByProps({ 'data-testid': 'frame-nav' }).props['aria-label']).toBe('Teacher');
  });

  it('while the spaces load: no option, the last persona items, none highlighted', async () => {
    const r = await render(fakeEnv({ pathname: '/teach/space', search: '?id=sp_c', last: 'teacher' }), null);
    expect(byTestId(r, 'persona-switch')).toHaveLength(0);
    expect(navIds(r)).toEqual(['classes', 'billing']);
    expect(current(r)).toEqual([]);
  });

  it('on /account/billing (A-5c) the Billing item opens and highlights the billing page in the active persona row', async () => {
    const r = await render(fakeEnv({ pathname: '/account/billing', search: '?checkout=success', last: 'teacher' }), [family, klass]);
    expect(navIds(r)).toEqual(['classes', 'billing']);
    expect(current(r)).toEqual(['Billing']);
    expect(byTestId(r, 'nav-billing')[0]?.props.href).toBe('/account/billing');
  });

  it('while the spaces load with no last persona: the Family items', async () => {
    const r = await render(fakeEnv({ pathname: '/teach/space', search: '?id=sp_c' }), null);
    expect(navIds(r)).toEqual(['home', 'billing']);
  });

  it('spaces fetch failed: the brand, the way back and Sign out only; no persona, no nav', async () => {
    const r = await render(fakeEnv(), 'failed');
    expect(byTestId(r, 'frame-nav')).toHaveLength(0);
    expect(byTestId(r, 'frame-persona')).toHaveLength(0);
    expect(byTestId(r, 'frame-way-back')).toHaveLength(1);
    expect(byTestId(r, 'frame-brand')[0]?.props.href).toBe('/signin');
  });

  it('draws every sibling item when its flag is on: Reports, Notes and Lessons (a link to All lessons, same tab)', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    const env = fakeEnv({ pathname: '/parent' });
    const r = await render(env, [family, klass]);
    expect(navIds(r)).toEqual(['home', 'reports', 'notes', 'lessons', 'billing']);
    const lessons = byTestId(r, 'nav-lessons')[0] as ReactTestInstance;
    expect(lessons.type).toBe('a');
    expect(lessons.props.href).toBe('/browse');
    expect(lessons.props.target).toBeUndefined();
    expect(byTestId(r, 'nav-notes')[0]?.props.href).toBe('/parent/space/notes?id=sp_f');
  });

  it('keeps Lessons out on any origin but the app host (the site still serving the console)', async () => {
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    const r = await render(fakeEnv({ pathname: '/parent', origin: 'https://hangulroute.com' }), [family, klass]);
    expect(navIds(r)).not.toContain('lessons');
  });

  it('Reports opens the one learner report of a one-learner family, read from its roster once per tab', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    const rosterCalls: string[] = [];
    consoleView.api = {
      listSpaces: async () => ({ ok: true, data: [item('sp_f', 'family', 'owner', 1)] }),
      roster: async (id: string) => {
        rosterCalls.push(id);
        return { ok: true, data: { learners: [{ id: 'lrn_1' }] } };
      },
    };
    const r = await render(fakeEnv({ pathname: '/parent' }));
    expect(byTestId(r, 'nav-reports')[0]?.props.href).toBe('/teach/space/learner?id=sp_f&learner=lrn_1&period=week&from=nav');
    act(() => mounted?.unmount());
    mounted = null;
    await render(fakeEnv({ pathname: '/parent' }));
    expect(rosterCalls).toEqual(['sp_f']);
  });

  it('Sign out forgets the per-tab roster read, so the next account in this tab reads its own', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    const rosterCalls: string[] = [];
    consoleView.api = {
      listSpaces: async () => ({ ok: true, data: [item('sp_f', 'family', 'owner', 1)] }),
      roster: async (id: string) => {
        rosterCalls.push(id);
        return { ok: true, data: { learners: [{ id: 'lrn_1' }] } };
      },
    };
    const r = await render(fakeEnv({ pathname: '/parent' }));
    await act(async () => {
      byTestId(r, 'frame-foot-sign-out')[0]?.props.onClick();
    });
    expect(consoleView.signOuts).toBe(1);
    act(() => mounted?.unmount());
    mounted = null;
    await render(fakeEnv({ pathname: '/parent' }));
    expect(rosterCalls).toEqual(['sp_f', 'sp_f']);
  });

  it("reads the page from the router's committed location inside GrownUpGate, not from window.location", async () => {
    // A client navigation from a family page to a class page on a page that stays mounted: the browser
    // still reports the old query while the router has committed the new one.
    const env = fakeEnv({ pathname: '/teach/space', search: '?id=sp_f' });
    await act(async () => {
      mounted = create(
        <GrownUpLocationContext.Provider value={{ pathname: '/teach/space', search: 'id=sp_c' }}>
          <AdultFrame env={env} spaces={[family, klass]}>
            <p>page</p>
          </AdultFrame>
        </GrownUpLocationContext.Provider>,
      );
    });
    const r = mounted as unknown as ReactTestRenderer;
    expect(byTestId(r, 'persona-teacher')[0]?.props['aria-checked']).toBe(true);
    expect(current(r)).toEqual(['Classes']);
  });

  it('on a home the account does not hold, no item is current (the other persona home item links elsewhere)', async () => {
    const r = await render(fakeEnv({ pathname: '/parent' }), [klass]);
    expect(navIds(r)).toEqual(['classes', 'billing']);
    expect(current(r)).toEqual([]);
  });

  it('reads the spaces list itself when the page does not hand it over; a failed read draws no nav', async () => {
    consoleView.api = { listSpaces: async () => ({ ok: false, error: 'network' }), roster: async () => ({ ok: false }) };
    const r = await render(fakeEnv());
    expect(byTestId(r, 'frame-nav')).toHaveLength(0);
    consoleView.api = { listSpaces: async () => ({ ok: true, data: [klass] }), roster: async () => ({ ok: false }) };
    act(() => mounted?.unmount());
    mounted = null;
    const r2 = await render(fakeEnv());
    expect(navIds(r2)).toEqual(['classes', 'billing']);
  });

  it('without an API address the frame draws no nav', async () => {
    const r = await render(fakeEnv());
    expect(byTestId(r, 'frame-nav')).toHaveLength(0);
  });

  it('writes the last persona when a persona home renders with that persona held, and not on other pages', async () => {
    const env = fakeEnv({ pathname: '/teach/home' });
    await render(env, [klass]);
    expect(env.written).toEqual(['teacher']);
    act(() => mounted?.unmount());
    mounted = null;
    const space = fakeEnv({ pathname: '/teach/space', search: '?id=sp_c' });
    await render(space, [klass]);
    expect(space.written).toEqual([]);
  });

  it('draws no disabled item and no "Back to site"', async () => {
    const r = await render(fakeEnv(), [family, klass]);
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props.disabled === true)).toHaveLength(0);
    expect(allText(r)).not.toContain('←');
    expect(allText(r)).not.toContain('Account');
  });
});

describe('the way back (sections 3.8, 3.9)', () => {
  it('Back to learning clears the unlock and the console session, then opens the learner app on this origin', async () => {
    const env = fakeEnv();
    const r = await render(env, [klass]);
    const back = byTestId(r, 'frame-way-back')[0] as ReactTestInstance;
    expect(textOf(back)).toBe(en.console.shell.backToLearning);
    await act(async () => back.props.onClick());
    expect(env.cleared).toBe(1);
    expect(env.assigned).toEqual(['/']);
  });

  it('from the site origin (before F-SITE-002 S-10) the way back goes to the app host', async () => {
    const env = fakeEnv({ origin: 'https://hangulroute.com' });
    const r = await render(env, [klass]);
    await act(async () => byTestId(r, 'frame-way-back')[0]?.props.onClick());
    expect(env.assigned).toEqual(['https://app.hangulroute.com/']);
  });

  it('reads Open the learner app on a device with no learner profile (a teacher laptop)', async () => {
    const r = await render(fakeEnv({ device: { readable: true, marker: null, hasProfiles: false } }), [klass]);
    expect(textOf(byTestId(r, 'frame-way-back')[0] as ReactTestInstance)).toBe('Open the learner app');
  });

  it('opensLearnerApp: absent or none marker without profiles, or no IndexedDB; never on a failed read or with profiles', () => {
    expect(opensLearnerApp(null)).toBe(false);
    expect(opensLearnerApp({ readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: false })).toBe(true);
    expect(opensLearnerApp({ readable: true, marker: null, hasProfiles: false })).toBe(true);
    expect(opensLearnerApp({ readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: true })).toBe(false);
    expect(opensLearnerApp({ readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: false })).toBe(false);
    expect(opensLearnerApp({ readable: false, reason: 'unavailable' })).toBe(true);
    expect(opensLearnerApp({ readable: false, reason: 'failed' })).toBe(false);
  });
});

describe('the phone layout and the footer (section 3.8)', () => {
  it('puts Language and Sign out in the footer tools, shown only below 45em; the header copies only from 45em', async () => {
    locales.available = ['en', 'es', 'ko'];
    const r = await render(fakeEnv(), [klass]);
    const tools = byTestId(r, 'frame-foot-tools')[0] as ReactTestInstance;
    expect(tools.props.className).toBe('hr-frame-tools');
    expect(tools.findAll((n) => n.type === 'select')).toHaveLength(1);
    expect(textOf(byTestId(r, 'frame-foot-sign-out')[0] as ReactTestInstance)).toBe('Sign out');
    expect(byTestId(r, 'frame-sign-out')[0]?.props.className).toBe('hr-frame-wide');
    const css = String(r.root.findByType('style').children[0]);
    expect(css).toMatch(/\.hr-frame-wide\{display:none\}/);
    expect(css).toMatch(/@media \(min-width:45em\)\{[\s\S]*\.hr-frame-wide\{display:inline-flex\}[\s\S]*\.hr-frame-tools\{display:none\}/);
    expect(css).toMatch(/@media \(min-width:70em\)\{[\s\S]*\.hr-frame-name\{position:static/);
  });

  it('the phone nav wraps to a second row instead of scrolling sideways (mock: no sideways scroll at 320 and 375)', async () => {
    const r = await render(fakeEnv(), [klass]);
    const css = String(r.root.findByType('style').children[0]);
    expect(css).toMatch(/\.hr-frame-list\{[^}]*flex-wrap:wrap/);
    expect(css).not.toMatch(/overflow-x:auto/);
    expect(css).not.toMatch(/scrollbar-width:none/);
  });

  it('Sign out from either place runs the console sign-out', async () => {
    const r = await render(fakeEnv(), [klass]);
    await act(async () => {
      byTestId(r, 'frame-sign-out')[0]?.props.onClick();
      byTestId(r, 'frame-foot-sign-out')[0]?.props.onClick();
    });
    expect(consoleView.signOuts).toBe(2);
  });

  it('links the footer to the site: About Hangul Route, Privacy and Terms', async () => {
    const r = await render(fakeEnv(), [klass]);
    const links = r.root.findAll((n) => n.type === 'a' && typeof n.props.href === 'string' && n.props.href.startsWith('https://hangulroute.com'));
    expect(links.map((n) => [textOf(n), n.props.href])).toEqual([
      ['About Hangul Route', 'https://hangulroute.com'],
      ['Privacy', 'https://hangulroute.com/privacy'],
      ['Terms', 'https://hangulroute.com/terms'],
    ]);
  });

  it('shows the page context line and the content', async () => {
    await act(async () => {
      mounted = create(
        <AdultFrame env={fakeEnv()} spaces={[klass]} title="Saturday class">
          <p>page</p>
        </AdultFrame>,
      );
    });
    const r = mounted as unknown as ReactTestRenderer;
    expect(textOf(byTestId(r, 'frame-title')[0] as ReactTestInstance)).toBe('Saturday class');
    expect(allText(r)).toContain('page');
  });
});
