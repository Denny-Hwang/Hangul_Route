import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY, NOW, STEADY, response } from '@/lib/console/__tests__/fixtures/report';

/**
 * F-REPORT-001 RP-7a2: the learner report page `/teach/space/learner?id=&learner=&period=`. It loads the learner route
 * (one call per period or step: the Worker records one `report.viewed` each) and the account's spaces once (the role
 * decides the archived sentence and the plan actions), and draws the three layers, the tabs and stepper, and every
 * state of section 3.14. Rendered with react-test-renderer (the repo's web tests have no DOM); `document` is a stub.
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

const START = 'id=space%3Asunflower&learner=profile%3Amina&period=week&from=roster';
const nav = { query: START, replaced: [] as string[], pushed: [] as string[] };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (to: string) => nav.replaced.push(to), push: (to: string) => nav.pushed.push(to) }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const ok = (data: unknown): Result => ({ ok: true, data });
const calls: { name: string; args: unknown[] }[] = [];
const responses: { report: () => Result; spaces: () => Result; roster: () => Result; plans: () => Result } = {
  report: () => ok(response(STEADY, { kind: 'class' })),
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
        if (name === 'getLearnerReport') return responses.report();
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
  responses.report = () => ok(response(STEADY, { kind: 'class' }));
  responses.spaces = () => ok([{ space: { id: 'space:sunflower', kind: 'class' }, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }]);
  responses.roster = () => ({ ok: false, error: 'network', status: 0 });
  // Each test is a new account, so the page's in-tab report cache never carries over.
  account += 1;
  session.accountId = `teacher-${account}`;
  fakeDocument.title = 'Console — Hangul Route';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

async function page(): Promise<ReactTestInstance> {
  const { default: Page } = await import('@/app/(console)/teach/space/learner/page');
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

/** Follow the last `router.push` like the browser does: the address changes and the page renders again. */
async function follow(): Promise<void> {
  const to = nav.pushed[nav.pushed.length - 1] ?? '';
  nav.query = to.slice(to.indexOf('?') + 1);
  const { default: Page } = await import('@/app/(console)/teach/space/learner/page');
  await act(async () => {
    mounted?.update(<Page />);
  });
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const h1s = (root: ReactTestInstance): string[] => root.findAll((n) => n.type === 'h1').map(textOf);
const reportCalls = (): unknown[][] => calls.filter((c) => c.name === 'getLearnerReport').map((c) => c.args);

describe('the reports switch (reportsEnabled, default off)', () => {
  it('off: "Reports are not available yet." as the h1 with the back link, and no request', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', '');
    const root = await page();
    expect(reportCalls()).toEqual([]);
    expect(h1s(root)).toEqual([en.report.state.flagOff]);
    expect(byTestId(root, 'report-back')[0]?.props.href).toBe('/teach/home');
  });
});

describe('the learner report page, switched on', () => {
  it('loads this learner once and the spaces once, and titles the browser without the name', async () => {
    const root = await page();
    expect(reportCalls()).toEqual([['space:sunflower', 'profile:mina', 'week']]);
    expect(calls.filter((c) => c.name === 'listSpaces')).toHaveLength(1);
    // No Learning Route reads while that page is off.
    expect(calls.some((c) => c.name === 'roster' || c.name === 'listPlans')).toBe(false);
    expect(h1s(root)).toEqual([en.report.title.learner('Mina')]);
    expect(fakeDocument.title).toBe('Report - Hangul Route');
    expect(fakeDocument.title).not.toContain('Mina');
  });

  it('draws the header: the back link to the roster and Print described by its hint, enabled once loaded', async () => {
    const root = await page();
    expect(byTestId(root, 'report-back')[0]?.props.href).toBe('/teach/space?id=space%3Asunflower');
    expect(textOf(byTestId(root, 'report-back')[0] as ReactTestInstance)).toBe('Back to Sunflower');
    const print = byTestId(root, 'report-print')[0] as ReactTestInstance;
    expect(print.props.disabled).toBe(false);
    const hint = root.find((n) => n.type === 'p' && n.props.id === print.props['aria-describedby']);
    expect(textOf(hint)).toBe(en.report.print.hint);
    // Send a note waits for RP-12 (after F-FEEDBACK-001 FB-11).
    expect(textOf(root)).not.toContain(en.report.action.sendNote);
  });

  it('draws four tabs controlling one panel, the selected one in the tab order, and the stepper', async () => {
    const root = await page();
    const tabs = root.findAll((n) => n.type === 'button' && n.props.role === 'tab');
    expect(tabs.map(textOf)).toEqual(['Today', 'This week', 'This month', 'All time']);
    expect(tabs.map((t) => t.props['aria-selected'])).toEqual([false, true, false, false]);
    expect(tabs.map((t) => t.props.tabIndex)).toEqual([-1, 0, -1, -1]);
    const panel = root.find((n) => n.props.role === 'tabpanel');
    expect(tabs.every((t) => t.props['aria-controls'] === panel.props.id)).toBe(true);
    expect(panel.props['aria-labelledby']).toBe(tabs[1]?.props.id);
    expect(panel.props['aria-busy']).toBeUndefined();
    expect(byTestId(root, 'report-step-prev')[0]?.props['aria-label']).toBe('Show last week');
    expect(byTestId(root, 'report-step-next')).toHaveLength(0);
    expect(textOf(byTestId(root, 'report-headline')[0] as ReactTestInstance)).toBe('Mina practiced on 3 days this week.');
  });

  it('arrow keys move focus along the tabs without loading; Enter or a click selects and loads the period', async () => {
    const root = await page();
    const tabs = root.findAll((n) => n.type === 'button' && n.props.role === 'tab');
    const prevented = vi.fn();
    act(() => tabs[1]?.props.onKeyDown({ key: 'ArrowRight', preventDefault: prevented }));
    expect(prevented).toHaveBeenCalled();
    expect(nav.pushed).toEqual([]);
    await act(async () => tabs[2]?.props.onClick());
    expect(nav.pushed).toEqual(['/teach/space/learner?id=space%3Asunflower&learner=profile%3Amina&period=month&from=roster']);
    await follow();
    expect(reportCalls()).toEqual([
      ['space:sunflower', 'profile:mina', 'week'],
      ['space:sunflower', 'profile:mina', 'month'],
    ]);
    // The tabs stay enabled on a later load, and the live region names the new window.
    expect(root.findAll((n) => n.type === 'button' && n.props.role === 'tab').every((t) => !t.props.disabled)).toBe(true);
    expect(textOf(byTestId(root, 'report-announce')[0] as ReactTestInstance)).toBe('Showing this month');
  });

  it('a step loads the window before, with Next back to this week', async () => {
    const root = await page();
    await act(async () => byTestId(root, 'report-step-prev')[0]?.props.onClick());
    expect(nav.pushed[0]).toBe('/teach/space/learner?id=space%3Asunflower&learner=profile%3Amina&period=week&at=2026-10-08&from=roster');
    await follow();
    expect(reportCalls()).toHaveLength(2);
    expect(byTestId(root, 'report-step-next')[0]?.props['aria-label']).toBe('Next: show this week');
  });

  it('P1 has its action group, each action described by the line sentence; a viewer without plan.write gets none', async () => {
    const root = await page();
    const line = byTestId(root, 'report-line-letters_revisit')[0] as ReactTestInstance;
    const sentence = line.find((n) => n.type === 'p' && typeof n.props.id === 'string');
    const actions = line.findAll((n) => n.type === 'a');
    expect(actions.map(textOf)).toEqual(['Add to a plan']);
    expect(actions[0]?.props.href).toBe('/teach/space/plan?id=space%3Asunflower&add=quest%3Astage1-life-q2');
    expect(actions[0]?.props['aria-describedby']).toBe(sentence.props.id);
    // The taught letters are marked Korean.
    expect(line.findAll((n) => n.props.lang === 'ko').map(textOf)).toEqual(['ㅂ', 'ㅅ']);
    act(() => mounted?.unmount());
    responses.spaces = () => ok([]);
    const admin = await page();
    expect(byTestId(admin, 'report-line-actions')).toHaveLength(0);
  });

  it('More detail is one collapsed disclosure that opens its panel', async () => {
    const root = await page();
    const button = byTestId(root, 'report-more-button')[0] as ReactTestInstance;
    expect(button.props['aria-expanded']).toBe(false);
    expect(byTestId(root, 'report-detail')[0]?.props.hidden).toBe(true);
    act(() => button.props.onClick());
    expect(byTestId(root, 'report-more-button')[0]?.props['aria-expanded']).toBe(true);
    expect(byTestId(root, 'report-detail')[0]?.props.hidden).toBe(false);
    expect(byTestId(root, 'report-detail')[0]?.props.id).toBe(button.props['aria-controls']);
  });

  it('"And N more letters" follows the strong tiles only when more are known than they show', async () => {
    const few = await page();
    expect(byTestId(few, 'report-letters-more')).toHaveLength(0);
    act(() => mounted?.unmount());
    const ALL = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ', 'ㄲ', 'ㄸ'];
    responses.report = () => ok(response({ ...STEADY, jamoRecognized: ALL }, { kind: 'class' }));
    const many = await page();
    const lines = byTestId(many, 'report-letters-more');
    expect(lines.map((line) => textOf(line))).toEqual([en.report.detail.lettersMore(2)]);
    expect(textOf(lines[0]?.parent as ReactTestInstance)).toContain(en.report.detail.lettersStrong('Mina'));
  });
});

describe('the Learning Route seam', () => {
  it('with the Learning Route on: Open Learning Route and the goal line from the roster and the plans', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    const roster = { space: { ...response(STEADY, { kind: 'class' }).space }, learners: [{ id: 'profile:mina', displayName: 'Mina', avatar: 'tiger', ageGroup: 'starter', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: STEADY.lastActiveAt, lastSyncedAt: '2026-10-15T09:31:00.000Z', summary: STEADY }], joinCode: null, joinCodeExpiresAt: null };
    responses.roster = () => ok(roster);
    const root = await page();
    expect(calls.filter((c) => c.name === 'roster' || c.name === 'listPlans').map((c) => c.name).sort()).toEqual(['listPlans', 'roster']);
    expect(byTestId(root, 'report-open-route')[0]?.props.href).toBe('/teach/space/route?id=space%3Asunflower&learner=profile%3Amina');
    expect(textOf(byTestId(root, 'report-goal')[0] as ReactTestInstance)).toBe('Next open stage: Stage 1 · Hangul');
    // Case 3 names no goal, so it has no flag.
    expect(byTestId(root, 'report-goal')[0]?.findAll((n) => n.type === 'svg')).toHaveLength(0);
  });

  it('a failed roster read draws no goal line', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEARNING_ROUTE_ENABLED', 'true');
    const root = await page();
    expect(byTestId(root, 'report-open-route')).toHaveLength(1);
    expect(byTestId(root, 'report-goal')).toHaveLength(0);
  });

  it('with the Learning Route off: neither the link nor the goal line', async () => {
    const root = await page();
    expect(byTestId(root, 'report-open-route')).toHaveLength(0);
    expect(byTestId(root, 'report-goal')).toHaveLength(0);
  });
});

describe('states (section 3.14)', () => {
  it('the first load: the heading, the tab row disabled, Print disabled, and the status line outside the busy panel', async () => {
    let release: (r: Result) => void = () => undefined;
    responses.report = () => new Promise<Result>((resolve) => (release = resolve)) as unknown as Result;
    const root = await page();
    expect(root.findAll((n) => n.type === 'h1')).toHaveLength(1);
    expect(root.findAll((n) => n.type === 'button' && n.props.role === 'tab').every((t) => t.props.disabled === true)).toBe(true);
    expect(byTestId(root, 'report-print')[0]?.props.disabled).toBe(true);
    const panel = byTestId(root, 'report-panel')[0] as ReactTestInstance;
    expect(panel.props['aria-busy']).toBe('true');
    const status = byTestId(root, 'report-status')[0] as ReactTestInstance;
    expect(status.props.role).toBe('status');
    expect(textOf(status)).toBe(en.a11y.report.loading);
    expect(panel.findAll((n) => n.props.role === 'status')).toHaveLength(0);
    await act(async () => release(ok(response(STEADY, { kind: 'class' }))));
    expect(h1s(root)).toEqual([en.report.title.learner('Mina')]);
  });

  it('a network error with nothing cached: the error sentence is the h1, Print is not drawn, Try again loads again', async () => {
    responses.report = () => ({ ok: false, error: 'network', status: 0 });
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.error]);
    expect(byTestId(root, 'report-print')).toHaveLength(0);
    responses.report = () => ok(response(STEADY, { kind: 'class' }));
    await act(async () => byTestId(root, 'report-retry')[0]?.props.onClick());
    expect(reportCalls()).toHaveLength(2);
    expect(h1s(root)).toEqual([en.report.title.learner('Mina')]);
  });

  it('a network error with a cached report: the report keeps its h1, the error is a state line, Print stays enabled', async () => {
    const root = await page();
    responses.report = () => ({ ok: false, error: 'network', status: 0 });
    await act(async () => root.findAll((n) => n.type === 'button' && n.props.role === 'tab')[2]?.props.onClick());
    await follow();
    expect(h1s(root)).toEqual([en.report.title.learner('Mina')]);
    expect(textOf(byTestId(root, 'report-error-line')[0] as ReactTestInstance)).toBe(en.report.state.error);
    expect(byTestId(root, 'report-print')[0]?.props.disabled).toBe(false);
    // The viewer who pressed the tab hears why nothing changed: the error is read out by the status line.
    expect(textOf(byTestId(root, 'report-status')[0] as ReactTestInstance)).toBe(en.report.state.error);
  });

  it('not a member or a wrong kind: "This report is not available." as the h1', async () => {
    responses.report = () => ({ ok: false, error: 'forbidden', status: 403 });
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.unavailable]);
    expect(byTestId(root, 'report-retry')).toHaveLength(0);
  });

  it('an address without a learner: not available, and no request', async () => {
    nav.query = 'id=space%3Asunflower';
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.unavailable]);
    expect(reportCalls()).toEqual([]);
  });

  it('a lost session goes to sign-in with this page as next', async () => {
    vi.stubGlobal('window', { location: { pathname: '/teach/space/learner', search: `?${START}` }, print: () => undefined });
    responses.report = () => ({ ok: false, error: 'unauthorized', status: 401 });
    await page();
    expect(nav.replaced[0]).toMatch(/^\/signin\?next=/);
  });

  it('legacy: the glance, the neutral lines, no tabs, More detail', async () => {
    responses.report = () => ok(response(LEGACY, { kind: 'class' }));
    const root = await page();
    expect(root.findAll((n) => n.props.role === 'tablist')).toHaveLength(0);
    expect(textOf(byTestId(root, 'report-state')[0] as ReactTestInstance)).toContain(en.report.state.legacy);
    expect(byTestId(root, 'report-more-button')).toHaveLength(1);
  });

  it('no_data: one neutral block, never "has not practiced", no glance', async () => {
    responses.report = () => ok(response(null, { kind: 'class' }));
    const root = await page();
    expect(textOf(byTestId(root, 'report-state')[0] as ReactTestInstance)).toContain(en.report.state.noData('Mina'));
    expect(byTestId(root, 'report-glance')).toHaveLength(0);
    expect(textOf(root)).not.toMatch(/not practiced/);
  });

  it('an archived class: the settings sentence for its owner, the neutral line for a co-teacher, no plan actions', async () => {
    responses.report = () => ok(response(STEADY, { kind: 'class', archivedAt: '2026-10-01T00:00:00.000Z' }));
    const owner = await page();
    expect(textOf(byTestId(owner, 'report-state')[0] as ReactTestInstance)).toContain(en.console.settings.archived.class);
    expect(byTestId(owner, 'report-line-actions')).toHaveLength(0);
    act(() => mounted?.unmount());
    responses.spaces = () => ok([{ space: { id: 'space:sunflower', kind: 'class' }, role: 'teacher', counts: { learners: 1, accounts: 2, classes: 0 } }]);
    const teacher = await page();
    expect(textOf(byTestId(teacher, 'report-state')[0] as ReactTestInstance)).toContain(en.report.state.archived.class);
  });

  it('while the spaces load, an archived report draws no archived sentence and no plan action; a failed read keeps the neutral one', async () => {
    responses.report = () => ok(response(STEADY, { kind: 'class', archivedAt: '2026-10-01T00:00:00.000Z' }));
    let release: (r: Result) => void = () => undefined;
    responses.spaces = () => new Promise<Result>((resolve) => (release = resolve)) as unknown as Result;
    const pending = await page();
    const stateText = (root: ReactTestInstance): string => byTestId(root, 'report-state').map(textOf).join(' ');
    expect(stateText(pending)).not.toContain(en.report.state.archived.class);
    expect(stateText(pending)).not.toContain(en.console.settings.archived.class);
    expect(byTestId(pending, 'report-line-actions')).toHaveLength(0);
    await act(async () => release({ ok: false, error: 'network', status: 0 }));
    expect(stateText(pending)).toContain(en.report.state.archived.class);
    expect(byTestId(pending, 'report-line-actions')).toHaveLength(0);
  });

  it('the /parent/space/learner twin goes back to the parent console home when no space is known', async () => {
    vi.stubGlobal('window', { location: { pathname: '/parent/space/learner', search: `?${START}` }, print: () => undefined });
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', '');
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.flagOff]);
    expect(byTestId(root, 'report-back')[0]?.props.href).toBe('/parent');
  });

  it('a school space has no learner report', async () => {
    responses.report = () => ok(response(STEADY, { kind: 'school' }));
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.unavailable]);
  });
});

describe('RP-7b: the growth line and the printed footer', () => {
  it('All time draws the growth chart named by its table, the months under it, and a table behind Show as table', async () => {
    nav.query = 'id=space%3Asunflower&learner=profile%3Amina&period=all&from=roster';
    responses.report = () => ok(response(STEADY, { kind: 'family' }));
    const root = await page();
    const chart = byTestId(root, 'report-growth-chart')[0] as ReactTestInstance;
    expect(chart.props.role).toBe('img');
    expect(chart.props['aria-label']).toBe(en.a11y.report.growthTable);
    expect(chart.findAll((n) => n.type === 'polyline')).toHaveLength(2);
    const table = byTestId(root, 'report-growth-table')[0] as ReactTestInstance;
    expect(table.props.hidden).toBe(true);
    expect(table.findAll((n) => n.type === 'tr').map(textOf)).toEqual(['MonthQuestsCards', 'September 202633', 'October 202675']);
    const toggle = byTestId(root, 'report-growth-toggle')[0] as ReactTestInstance;
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(toggle.props['aria-controls']).toBe(table.props.id);
    expect(textOf(toggle)).toBe(en.report.growth.showTable);
    act(() => toggle.props.onClick());
    expect(byTestId(root, 'report-growth-table')[0]?.props.hidden).toBe(false);
    expect(textOf(byTestId(root, 'report-growth-toggle')[0] as ReactTestInstance)).toBe(en.report.growth.hideTable);
    // The week has no growth block.
    expect(byTestId(root, 'report-calendar')).toHaveLength(0);
  });

  it('carries the printed footer with the print day and no name; the screen-only controls are marked for the print rules', async () => {
    const root = await page();
    expect(textOf(byTestId(root, 'report-print-footer')[0] as ReactTestInstance)).toBe('Private: shared from Hangul Route on Oct 15.');
    const marked = root.findAll((n) => typeof n.props.className === 'string' && n.props.className.split(' ').includes('hr-report-actions'));
    expect(marked.length).toBeGreaterThanOrEqual(3);
    expect(byTestId(root, 'report-print')[0] && marked.some((n) => n.findAll((c) => c.props['data-testid'] === 'report-print').length > 0)).toBe(true);
  });
});

