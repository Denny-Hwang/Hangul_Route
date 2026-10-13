import { colors } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '@/lib/console/api';

/**
 * F-APP-001 A-5a, section 3.8 (design/screens/app-shell/teacher-home.md): the teacher home. No
 * Family group once the family home is live; each class row's Class report and Notes by flag; an
 * archived class keeps Class report; + New class; Lessons; the no-class state and the cross-links.
 */
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

const shellWrites = vi.hoisted(() => ({ personas: [] as string[] }));
vi.mock('@/lib/console/shell-store', () => ({
  writeLastPersona: async (persona: string) => {
    shellWrites.personas.push(persona);
    return true;
  },
}));

// The frame has its own tests (adult-frame.test.tsx); here it records the spaces the page hands it.
const frame = vi.hoisted(() => ({ spaces: [] as unknown[] }));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, spaces }: { children: ReactNode; spaces?: unknown }) => {
    frame.spaces.push(spaces);
    return <main>{children}</main>;
  },
}));

const result = vi.hoisted(() => ({ list: null as unknown }));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  // One api object for the whole test, as the real hook keeps it (the page's load depends on it).
  const api = { listSpaces: async () => result.list };
  const session = { accountId: 'acc_1', displayName: 'Ms Kim' };
  const signOut = (): undefined => undefined;
  return {
    useConsole: () => ({ ready: true, session, api, signOut, m: messages('en'), locale: 'en' }),
  };
});

import HomePage from '@/app/(console)/teach/home/page';

const en = getMessages('en').console;

function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], archivedAt: string | null = null): SpaceListItem {
  return {
    space: { id, kind, name: `${id} name`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt, createdAt: '2026-10-01T00:00:00Z' },
    role,
    counts: { learners: 12, accounts: 1, classes: 4 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

const family = item('sp_f', 'family', 'owner');
const klass = item('sp_c', 'class', 'owner');
const old = item('sp_old', 'class', 'owner', '2026-09-01T00:00:00Z');
const school = item('sp_s', 'school', 'admin');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  nav.pushed = [];
  live.value = true;
  shellWrites.personas = [];
  frame.spaces = [];
  vi.unstubAllEnvs();
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllEnvs();
});

async function render(list: SpaceListItem[] | 'fail'): Promise<ReactTestRenderer> {
  result.list = list === 'fail' ? { ok: false, error: 'network' } : { ok: true, data: list };
  await act(async () => {
    mounted = create(<HomePage />);
  });
  return mounted as unknown as ReactTestRenderer;
}

const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const allText = (r: ReactTestRenderer): string => textOf(r.root);
const headings = (r: ReactTestRenderer, type: 'h1' | 'h2'): string[] => r.root.findAll((n) => n.type === type).map(textOf);

describe('the teacher home (F-APP-001 A-5a)', () => {
  it('lists Classes and the School group, with no Family group and no "Hi, {name}"', async () => {
    const r = await render([family, klass, school]);
    expect(headings(r, 'h1')).toEqual(['Classes']);
    expect(headings(r, 'h2')).toEqual(['School']);
    expect(byTestId(r, 'space-row-sp_f')).toHaveLength(0);
    expect(byTestId(r, 'space-row-sp_c')).toHaveLength(1);
    expect(allText(r)).not.toContain('Hi, ');
    expect(allText(r)).toContain('12 students');
  });

  it('+ New class goes to /start with the teacher hint', async () => {
    const r = await render([klass]);
    const cta = byTestId(r, 'new-class')[0] as ReactTestInstance;
    expect(textOf(cta)).toBe('+ New class');
    expect(cta.props.style.backgroundColor).toBe(colors.surface.paper);
    expect(cta.props.href).toBe('/start?persona=teacher');
  });

  it('with the sibling flags off, rows have Open only', async () => {
    const r = await render([klass, old]);
    expect(byTestId(r, 'class-report-sp_c')).toHaveLength(0);
    expect(byTestId(r, 'class-notes-sp_c')).toHaveLength(0);
    expect(byTestId(r, 'home-lessons')).toHaveLength(0);
  });

  it('with reports and notes on, a class row links to its Class report and Notes; an archived class keeps Class report only', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    const r = await render([klass, old, school]);
    expect(byTestId(r, 'class-report-sp_c')[0]?.props.href).toBe('/teach/space/report?id=sp_c&period=week');
    expect(byTestId(r, 'class-notes-sp_c')[0]?.props.href).toBe('/teach/space/notes?id=sp_c');
    expect(byTestId(r, 'class-report-sp_old')).toHaveLength(1);
    expect(byTestId(r, 'class-notes-sp_old')).toHaveLength(0);
    expect(byTestId(r, 'class-report-sp_s')).toHaveLength(0);
  });

  it('with the lesson browser on, Lessons sits under the list as a link to All lessons, on the app origin only', async () => {
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    vi.stubGlobal('window', { location: { origin: 'https://app.hangulroute.com' } });
    let r = await render([klass]);
    expect(byTestId(r, 'home-lessons')[0]?.type).toBe('a');
    expect(byTestId(r, 'home-lessons')[0]?.props.href).toBe('/browse');
    act(() => mounted?.unmount());
    vi.stubGlobal('window', { location: { origin: 'https://hangulroute.com' } });
    r = await render([klass]);
    expect(byTestId(r, 'home-lessons')).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it('cross-link without a family: Learning at home too? Set up a family space', async () => {
    const r = await render([klass]);
    const link = byTestId(r, 'cross-add-family')[0] as ReactTestInstance;
    expect(textOf(link)).toBe(en.home.cross.addFamily);
    expect(link.props.href).toBe('/start?persona=parent');
  });

  it('cross-link with a family: Your family is under Family switches persona (writes the last persona, opens /parent)', async () => {
    const r = await render([klass, family]);
    const button = byTestId(r, 'cross-to-family')[0] as ReactTestInstance;
    expect(textOf(button)).toBe(en.home.cross.toFamily);
    await act(async () => button.props.onClick());
    expect(shellWrites.personas).toEqual(['parent']);
    expect(nav.pushed).toEqual(['/parent']);
  });

  it('no class yet: a family-only account sees the no-class state with Set up a class and Go to Family', async () => {
    const r = await render([family]);
    expect(headings(r, 'h1')).toEqual([en.home.noClass.title]);
    expect(byTestId(r, 'no-class-set-up')[0]?.props.href).toBe('/start?persona=teacher');
    expect(byTestId(r, 'no-class-go-family')[0]?.props.href).toBe('/parent');
    expect(byTestId(r, 'new-class')).toHaveLength(0);
  });

  it('no space at all: Set up a class, no Go to Family, the cross-link to a family space', async () => {
    const r = await render([]);
    expect(byTestId(r, 'no-class-go-family')).toHaveLength(0);
    expect(byTestId(r, 'cross-add-family')).toHaveLength(1);
  });

  it('archived classes only: + New class is the primary action', async () => {
    const r = await render([old]);
    const cta = byTestId(r, 'new-class')[0] as ReactTestInstance;
    expect(cta.props.style.backgroundColor).toBe(colors.brand.primary);
    expect(byTestId(r, 'space-row-sp_old')).toHaveLength(1);
  });

  it('hands its spaces list to the frame, and "failed" when the first read fails (the frame then draws no nav)', async () => {
    await render([klass]);
    expect(frame.spaces.at(-1)).toEqual([klass]);
    act(() => mounted?.unmount());
    mounted = null;
    const r = await render('fail');
    expect(frame.spaces.at(-1)).toBe('failed');
    expect(allText(r)).toContain(en.cantReach);
  });

  it('while /parent is still the demo, keeps the Family group so a family account reaches its spaces', async () => {
    live.value = false;
    const r = await render([family, klass]);
    expect(headings(r, 'h2')).toEqual(['Family']);
    expect(byTestId(r, 'space-row-sp_f')).toHaveLength(1);
    expect(byTestId(r, 'cross-to-family')).toHaveLength(0);
  });
});
