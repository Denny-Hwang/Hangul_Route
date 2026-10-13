import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, STEADY, response } from '@/lib/console/__tests__/fixtures/report';

/**
 * F-REPORT-001 RP-7c: `/parent/learner`. With a learner it is the learner report (the same component as
 * `/teach/space/learner`); without one it is the parent chooser: the learners of the account's family spaces in the
 * family home's order, never by a figure, and exactly one learner opens that report directly. Rendered with
 * react-test-renderer (the repo's web tests have no DOM); `document` and `window` are stubs.
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

const nav = { query: '', replaced: [] as string[], pushed: [] as string[] };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (to: string) => nav.replaced.push(to), push: (to: string) => nav.pushed.push(to) }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const ok = (data: unknown): Result => ({ ok: true, data });
const calls: { name: string; args: unknown[] }[] = [];

function family(id: string, role = 'owner', createdAt = '2026-09-01T00:00:00.000Z', learners = 2) {
  return {
    space: { id, kind: 'family', name: `Family ${id}`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt },
    role,
    counts: { learners, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}
function cls(id: string) {
  return { ...family(id, 'teacher'), space: { ...family(id).space, kind: 'class' } };
}
function learner(id: string, joinedAt: string, minutes: number) {
  return { id, displayName: `Name ${id}`, ageGroup: '5-7', avatar: 'cub', joinedAt, lastActiveAt: joinedAt, lastSyncedAt: null, summary: { minutesLast7d: minutes } };
}
const roster = (spaceId: string, learners: unknown[]) => ok({ space: family(spaceId).space, learners, joinCode: null, joinCodeExpiresAt: null });

const DEFAULT_ROSTERS: Record<string, () => Result> = {
  'space:a': () => roster('space:a', [learner('profile:2', '2026-09-03T00:00:00.000Z', 90), learner('profile:1', '2026-09-02T00:00:00.000Z', 0)]),
  'space:b': () => roster('space:b', [learner('profile:3', '2026-09-04T00:00:00.000Z', 10)]),
};
const responses: { spaces: () => Result; rosters: Record<string, () => Result>; report: () => Result } = {
  spaces: () => ok([family('space:b', 'caregiver', '2026-09-05T00:00:00.000Z', 1), cls('space:c'), family('space:a')]),
  rosters: { ...DEFAULT_ROSTERS },
  report: () => ok(response(STEADY, { kind: 'family' })),
};
const api = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      async (...args: unknown[]) => {
        calls.push({ name, args });
        if (name === 'listSpaces') return responses.spaces();
        if (name === 'roster') return (responses.rosters[String(args[0])] ?? (() => ({ ok: false, error: 'network', status: 0 })))();
        if (name === 'getLearnerReport') return responses.report();
        return ok([]);
      },
  },
);

const session = { accountId: 'parent-kim', displayName: 'Ms Kim' };
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
  vi.stubGlobal('window', { location: { pathname: '/parent/learner', search: `?${nav.query}` }, print: () => undefined });
  vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'true');
});

let mounted: ReactTestRenderer | null = null;
let account = 0;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  nav.query = '';
  nav.replaced.length = 0;
  nav.pushed.length = 0;
  responses.spaces = () => ok([family('space:b', 'caregiver', '2026-09-05T00:00:00.000Z', 1), cls('space:c'), family('space:a')]);
  responses.rosters = { ...DEFAULT_ROSTERS };
  responses.report = () => ok(response(STEADY, { kind: 'family' }));
  account += 1;
  session.accountId = `parent-${account}`;
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
  const { default: Page } = await import('@/app/(console)/parent/learner/page');
  await act(async () => {
    mounted = create(<Page />);
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const h1s = (root: ReactTestInstance): string[] => root.findAll((n) => n.type === 'h1').map(textOf);
const named = (name: string): unknown[][] => calls.filter((c) => c.name === name).map((c) => c.args);
const rows = (root: ReactTestInstance): ReactTestInstance[] => (byTestId(root, 'report-chooser')[0]?.findAll((n) => n.type === 'a') ?? []);

describe('/parent/learner with a learner: the learner report (RP-7c)', () => {
  it('is the same learner report, back to the parent home from the parent home card', async () => {
    nav.query = 'id=space%3Akim-family&learner=profile%3Amina&period=week&from=home';
    const root = await page();
    expect(named('getLearnerReport')).toEqual([['space:kim-family', 'profile:mina', 'week']]);
    expect(h1s(root)).toEqual([en.report.title.learner('Mina')]);
    expect(byTestId(root, 'report-back')[0]?.props.href).toBe('/parent');
    expect(byTestId(root, 'report-chooser')).toHaveLength(0);
  });

  it('from the navigation, back to the parent home too', async () => {
    nav.query = 'id=space%3Akim-family&learner=profile%3Amina&period=week&from=nav';
    const root = await page();
    expect(byTestId(root, 'report-back')[0]?.props.href).toBe('/parent');
  });
});

describe('/parent/learner without a learner: the parent chooser (RP-7c)', () => {
  it('lists the family learners in the family home order (never by minutes), with no report request', async () => {
    const root = await page();
    expect(named('getLearnerReport')).toEqual([]);
    expect(named('roster').map((args) => args[0])).toEqual(['space:a', 'space:b']);
    expect(h1s(root)).toEqual([en.report.chooser.learner]);
    expect(rows(root).map((a) => [a.props.href, textOf(a)])).toEqual([
      ['/parent/learner?id=space%3Aa&learner=profile%3A1&period=week&from=nav', 'Name profile:1'],
      ['/parent/learner?id=space%3Aa&learner=profile%3A2&period=week&from=nav', 'Name profile:2'],
      ['/parent/learner?id=space%3Ab&learner=profile%3A3&period=week&from=nav', 'Name profile:3'],
    ]);
    expect(textOf(byTestId(root, 'report-chooser')[0] as ReactTestInstance)).not.toMatch(/90|minutes/i);
    expect(nav.replaced).toEqual([]);
    expect(fakeDocument.title).toBe('Report - Hangul Route');
    expect(byTestId(root, 'report-back')[0]?.props.href).toBe('/parent');
  });

  it('exactly one learner opens that report directly', async () => {
    responses.spaces = () => ok([family('space:b', 'owner', '2026-09-05T00:00:00.000Z', 1)]);
    await page();
    expect(nav.replaced).toEqual(['/parent/learner?id=space%3Ab&learner=profile%3A3&period=week&from=nav']);
  });

  it('no family learner: not available', async () => {
    responses.spaces = () => ok([cls('space:c')]);
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.unavailable]);
    expect(named('roster')).toEqual([]);
  });

  it('a failed spaces read: the error with Try again, which reads again', async () => {
    let fail = true;
    responses.spaces = () => (fail ? { ok: false, error: 'network', status: 0 } : ok([family('space:a')]));
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.error]);
    fail = false;
    await act(async () => byTestId(root, 'report-retry')[0]?.props.onClick());
    expect(rows(root)).toHaveLength(2);
  });

  it('a family whose roster failed: the others stay, with the error and Try again under them, which reads again', async () => {
    responses.rosters = { 'space:a': DEFAULT_ROSTERS['space:a'] as () => Result };
    const root = await page();
    expect(rows(root).map((a) => textOf(a))).toEqual(['Name profile:1', 'Name profile:2']);
    expect(textOf(byTestId(root, 'report-error-line')[0] as ReactTestInstance)).toBe(en.report.state.error);
    expect(nav.replaced).toEqual([]);
    responses.rosters = { ...DEFAULT_ROSTERS };
    await act(async () => byTestId(root, 'report-retry')[0]?.props.onClick());
    expect(rows(root)).toHaveLength(3);
    expect(byTestId(root, 'report-error-line')).toHaveLength(0);
  });

  it('one learner left after a failed roster: no direct open, so the failure and the other family stay reachable', async () => {
    responses.rosters = { 'space:b': DEFAULT_ROSTERS['space:b'] as () => Result };
    const root = await page();
    expect(nav.replaced).toEqual([]);
    expect(rows(root).map((a) => textOf(a))).toEqual(['Name profile:3']);
    expect(byTestId(root, 'report-retry')).toHaveLength(1);
  });

  it('every roster failed: the error with Try again, never "not available"', async () => {
    responses.rosters = {};
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.error]);
    expect(byTestId(root, 'report-retry')).toHaveLength(1);
  });

  it('signed out (401) on the spaces or a roster read: to sign-in', async () => {
    responses.spaces = () => ({ ok: false, error: 'unauthorized', status: 401 });
    await page();
    expect(nav.replaced).toHaveLength(1);
    expect(nav.replaced[0]).toMatch(/sign-?in/i);
    act(() => mounted?.unmount());
    nav.replaced.length = 0;
    responses.spaces = () => ok([family('space:a')]);
    responses.rosters = { 'space:a': () => ({ ok: false, error: 'unauthorized', status: 401 }) };
    await page();
    expect(nav.replaced).toHaveLength(1);
    expect(nav.replaced[0]).toMatch(/sign-?in/i);
  });

  it('reports off: not available yet, no request', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'false');
    const root = await page();
    expect(h1s(root)).toEqual([en.report.state.flagOff]);
    expect(named('listSpaces')).toEqual([]);
  });
});
