import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW } from '@/lib/console/__tests__/fixtures/report';
import { CLASS_REPORT } from '@/lib/console/__tests__/fixtures/class-report';
import Page from '@/app/(console)/teach/space/report/page';

/**
 * F-REPORT-001 RP-8: the class report page `/teach/space/report?id=&period=&at=` and the class chooser without an id.
 * It loads the class route (one call per period or step) and the account's spaces once, and draws the class layers
 * with aggregates only. Rendered with react-test-renderer (the repo's web tests have no DOM); `document` is a stub.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const START = 'id=space%3Asunflower&period=week';
const nav = { query: START, replaced: [] as string[], pushed: [] as string[] };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (to: string) => nav.replaced.push(to), push: (to: string) => nav.pushed.push(to) }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const ok = (data: unknown): Result => ({ ok: true, data });
const calls: { name: string; args: unknown[] }[] = [];
const SPACE = { id: 'space:sunflower', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null as string | null, createdAt: '2026-09-01T00:00:00.000Z' };
const classBody = (over: Record<string, unknown> = {}) => ({ space: SPACE, period: 'week', at: null, serverTime: NOW.toISOString(), report: CLASS_REPORT, ...over });
const responses: { report: () => Result; spaces: () => Result; roster: () => Result; plans: () => Result } = {
  report: () => ok(classBody()),
  spaces: () => ok([{ space: { id: 'space:sunflower', kind: 'class' }, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }]),
  roster: () => ({ ok: false, error: 'network', status: 0 }),
  plans: () => ok([]),
};
const api = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      async (...args: unknown[]) => {
        calls.push({ name, args });
        if (name === 'getClassReport') return responses.report();
        if (name === 'listSpaces') return responses.spaces();
        if (name === 'roster') return responses.roster();
        if (name === 'listPlans') return responses.plans();
        return ok([]);
      },
  },
);

const session = { accountId: 'teacher-kim', displayName: 'Ms Kim' };
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }) };
});

const en = getMessages('en');
const fakeDocument = { title: 'Console — Hangul Route', activeElement: null as unknown, body: {} };
const spaceItem = (id: string, kind: string, role = 'teacher', createdAt = '2026-09-01T00:00:00.000Z') => ({ space: { ...SPACE, id, kind, name: `Name ${id}`, createdAt }, role, counts: { learners: 1, accounts: 1, classes: 0 } });

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', fakeDocument);
  vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
});

let mounted: ReactTestRenderer | null = null;
let account = 0;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  nav.query = START;
  nav.replaced.length = 0;
  nav.pushed.length = 0;
  responses.report = () => ok(classBody());
  responses.spaces = () => ok([{ space: { id: 'space:sunflower', kind: 'class' }, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }]);
  account += 1;
  session.accountId = `teacher-${account}`;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function page(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

async function follow(): Promise<void> {
  const to = nav.pushed[nav.pushed.length - 1] ?? '';
  nav.query = to.slice(to.indexOf('?') + 1);
  await act(async () => {
    mounted?.update(<Page />);
  });
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const h1s = (root: ReactTestInstance): string[] => root.findAll((n) => n.type === 'h1').map(textOf);
const classCalls = (): unknown[][] => calls.filter((c) => c.name === 'getClassReport').map((c) => c.args);
const tabs = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'button' && n.props.role === 'tab');

describe('the class report page (RP-8)', () => {
  it('reports off: not available yet, no request', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', '');
    const root = await page();
    expect(classCalls()).toEqual([]);
    expect(h1s(root)).toEqual([en.report.state.flagOff]);
  });

  it('loads the class once per view and draws the class title, lines, headline and layers, with no learner anywhere', async () => {
    const root = await page();
    expect(classCalls()).toEqual([['space:sunflower', 'week', null]]);
    expect(h1s(root)).toEqual([en.report.title.class('Sunflower')]);
    expect(fakeDocument.title).toBe('Report - Hangul Route');
    expect(textOf(byTestId(root, 'report-headline')[0] as ReactTestInstance)).toBe('2 of 12 learners practiced this week.');
    expect(byTestId(root, 'class-bands')[0]?.findAll((n) => n.type === 'li').map(textOf)).toEqual(['Not yet: 9', '1 to 2 days: 2', '3 to 4 days: 0', '5 to 7 days: 0']);
    expect(byTestId(root, 'class-letters-new')[0]?.findAll((n) => n.props.lang === 'ko').map(textOf)).toEqual(['ㅂ']);
    expect(textOf(root)).not.toMatch(/profile:|Mina/);
    expect(byTestId(root, 'report-print')[0]?.props.disabled).toBe(false);
    expect(textOf(byTestId(root, 'report-print-footer')[0] as ReactTestInstance)).toBe('Private: shared from Hangul Route on Oct 15.');
    // Plan a lesson waits for lecture mode.
    expect(byTestId(root, 'class-plan-lesson')).toHaveLength(0);
  });

  it('Plan a lesson with lecture mode on, for a viewer with plan.write', async () => {
    vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'enabled');
    const root = await page();
    expect(byTestId(root, 'class-plan-lesson')[0]?.props.href).toBe('/teach/space/lecture?id=space%3Asunflower&from=revisit');
  });

  it('a period change and a step each load again, with the window in the request', async () => {
    const root = await page();
    await act(async () => tabs(root)[2]?.props.onClick());
    expect(nav.pushed).toEqual(['/teach/space/report?id=space%3Asunflower&period=month']);
    responses.report = () => ok(classBody({ period: 'month', report: { ...CLASS_REPORT, period: 'month', practice: { dayBands: [{ band: '0', learners: 9 }, { band: '1-4', learners: 2 }], notSaved: 0 } } }));
    await follow();
    await act(async () => byTestId(root, 'report-step-prev')[0]?.props.onClick());
    expect(nav.pushed[1]).toBe('/teach/space/report?id=space%3Asunflower&period=month&at=2026-09-01');
    await follow();
    expect(classCalls()).toEqual([
      ['space:sunflower', 'week', null],
      ['space:sunflower', 'month', null],
      ['space:sunflower', 'month', '2026-09-01'],
    ]);
  });

  it('a family space: not available (the Worker answers 409)', async () => {
    responses.report = () => ({ ok: false, error: 'unknown', status: 409 });
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.unavailable]);
  });

  it('a network error on the window the cached report was loaded for keeps it, the error a state line, Print disabled', async () => {
    await page();
    responses.report = () => ({ ok: false, error: 'network', status: -1 });
    act(() => mounted?.unmount());
    const root = await page();
    expect(h1s(root)).toEqual([en.report.title.class('Sunflower')]);
    expect(textOf(byTestId(root, 'report-error-line')[0] as ReactTestInstance)).toBe(en.report.state.error);
    expect(byTestId(root, 'report-print')[0]?.props.disabled).toBe(true);
    expect(String(byTestId(root, 'report-retry')[0]?.props.className)).toContain('hr-report-actions');
  });

  it('a network error on another period never draws the cached figures under it: the error and Try again', async () => {
    const root = await page();
    expect(textOf(byTestId(root, 'report-headline')[0] as ReactTestInstance)).toContain('this week');
    responses.report = () => ({ ok: false, error: 'network', status: -1 });
    await act(async () => tabs(root)[0]?.props.onClick());
    await follow();
    expect(h1s(root)).toEqual([en.report.state.error]);
    expect(byTestId(root, 'report-headline')).toHaveLength(0);
    expect(byTestId(root, 'report-print')).toHaveLength(0);
    responses.report = () => ok(classBody({ period: 'day' }));
    await act(async () => byTestId(root, 'report-retry')[0]?.props.onClick());
    expect(textOf(byTestId(root, 'report-headline')[0] as ReactTestInstance)).toContain('today');
  });

  it('an empty class: the empty line and the back link, no tabs, no Print', async () => {
    responses.report = () => ok(classBody({ report: { ...CLASS_REPORT, headline: { code: 'class_practiced', practiced: 0, learners: 0 }, class: { learners: 0, withActivity: 0, olderApp: 0, notSaved7d: 0 }, revisit: [] } }));
    const root = await page();
    expect(textOf(byTestId(root, 'report-state')[0] as ReactTestInstance)).toContain(en.report.class.empty);
    expect(root.findAll((n) => n.props.role === 'tablist')).toHaveLength(0);
    expect(byTestId(root, 'report-print')).toHaveLength(0);
    expect(byTestId(root, 'report-print-footer')).toHaveLength(0);
  });

  it('the first load: tabs and Print disabled, the status line outside the busy panel', async () => {
    let release: (r: Result) => void = () => undefined;
    responses.report = () => new Promise<Result>((resolve) => (release = resolve)) as unknown as Result;
    const root = await page();
    expect(tabs(root).every((t) => t.props.disabled === true)).toBe(true);
    expect(byTestId(root, 'report-panel')[0]?.props['aria-busy']).toBe('true');
    expect(byTestId(root, 'report-panel')[0]?.findAll((n) => n.props.role === 'status')).toHaveLength(0);
    await act(async () => release(ok(classBody())));
    expect(h1s(root)).toEqual([en.report.title.class('Sunflower')]);
  });

  it('a lost session goes to sign-in', async () => {
    vi.stubGlobal('window', { location: { pathname: '/teach/space/report', search: `?${START}` }, print: () => undefined });
    responses.report = () => ({ ok: false, error: 'unauthorized', status: 401 });
    await page();
    expect(nav.replaced[0]).toMatch(/^\/signin\?next=/);
  });
});

describe('the class chooser (no id)', () => {
  it("lists the account's classes in teacher-home order, no request for a report", async () => {
    nav.query = '';
    responses.spaces = () => ok([spaceItem('space:a', 'class'), spaceItem('space:f', 'family'), spaceItem('space:b', 'class', 'owner', '2026-09-05T00:00:00.000Z')]);
    const root = await page();
    expect(classCalls()).toEqual([]);
    expect(h1s(root)).toEqual([en.report.chooser.class]);
    expect(byTestId(root, 'class-chooser')[0]?.findAll((n) => n.type === 'a').map((a) => a.props.href)).toEqual([
      '/teach/space/report?id=space%3Ab&period=week',
      '/teach/space/report?id=space%3Aa&period=week',
    ]);
  });

  it('exactly one class opens its report directly', async () => {
    nav.query = '';
    responses.spaces = () => ok([spaceItem('space:a', 'class'), spaceItem('space:f', 'family')]);
    await page();
    expect(nav.replaced).toEqual(['/teach/space/report?id=space%3Aa&period=week']);
  });

  it('no class: not available', async () => {
    nav.query = '';
    responses.spaces = () => ok([spaceItem('space:f', 'family')]);
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.unavailable]);
  });

  it('a failed spaces read is an error with Try again (never "not available"), and Try again reads the spaces again', async () => {
    nav.query = '';
    responses.spaces = () => ({ ok: false, error: 'network', status: 0 });
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.error]);
    expect(textOf(byTestId(root, 'report-retry')[0] as ReactTestInstance)).toBe(en.common.buttons.tryAgain);
    responses.spaces = () => ok([spaceItem('space:a', 'class'), spaceItem('space:b', 'class')]);
    await act(async () => byTestId(root, 'report-retry')[0]?.props.onClick());
    expect(h1s(root)).toEqual([en.report.chooser.class]);
    expect(calls.filter((c) => c.name === 'listSpaces')).toHaveLength(2);
  });
});

describe('an archived class (section 3.14)', () => {
  const archived = (): Result => ok(classBody({ space: { ...SPACE, archivedAt: '2026-10-01T00:00:00.000Z' } }));
  const stateText = (root: ReactTestInstance): string => byTestId(root, 'report-state').map(textOf).join(' ');

  it('the settings sentence for its owner, the neutral line for a co-teacher', async () => {
    responses.report = archived;
    const owner = await page();
    expect(stateText(owner)).toContain(en.console.settings.archived.class);
    act(() => mounted?.unmount());
    responses.spaces = () => ok([{ space: { id: 'space:sunflower', kind: 'class' }, role: 'teacher', counts: { learners: 1, accounts: 2, classes: 0 } }]);
    const teacher = await page();
    expect(stateText(teacher)).toContain(en.report.state.archived.class);
  });

  it('while the spaces load, no archived sentence and no Plan a lesson; a failed read keeps the neutral one', async () => {
    vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'enabled');
    responses.report = archived;
    let release: (r: Result) => void = () => undefined;
    responses.spaces = () => new Promise<Result>((resolve) => (release = resolve)) as unknown as Result;
    const pending = await page();
    expect(stateText(pending)).not.toContain(en.report.state.archived.class);
    expect(stateText(pending)).not.toContain(en.console.settings.archived.class);
    expect(byTestId(pending, 'class-plan-lesson')).toHaveLength(0);
    await act(async () => release({ ok: false, error: 'network', status: 0 }));
    expect(stateText(pending)).toContain(en.report.state.archived.class);
    expect(byTestId(pending, 'class-plan-lesson')).toHaveLength(0);
  });
});
