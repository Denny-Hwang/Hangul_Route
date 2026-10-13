import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '@/app/(console)/teach/space/learner/page';
import { LEGACY, NOW, STEADY, response } from '@/lib/console/__tests__/fixtures/report';

/**
 * F-FEEDBACK-001 FB-11b (section 6.13 entry 4) with F-REPORT-001 section 3.6: **Send a note** on the learner report
 * opens the composer with the learner preselected, ids only, never a preset. Its place is the report header beside
 * Print, never an insight line (F-REPORT-001 section 3.6; design/screens/reports/learner-report.md). Shown only with
 * the notes flag, a space that is not archived and a role that may send (a family owner or caregiver, a class owner
 * or teacher; never a school admin). Rendered with react-test-renderer; `document` is a stub.
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
  await act(async () => {
    mounted?.update(<Page />);
  });
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const h1s = (root: ReactTestInstance): string[] => root.findAll((n) => n.type === 'h1').map(textOf);
const reportCalls = (): unknown[][] => calls.filter((c) => c.name === 'getLearnerReport').map((c) => c.args);

const sendNote = (root: ReactTestInstance): ReactTestInstance[] => byTestId(root, 'report-send-note');

describe('Send a note on the learner report (FB-11b)', () => {
  it('notes off (the default): not drawn', async () => {
    const root = await page();
    expect(sendNote(root)).toHaveLength(0);
    expect(textOf(root)).not.toContain(en.report.action.sendNote);
  });

  it('notes on, a class owner: in the header before Print, the composer with this learner, ids only', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    const root = await page();
    const links = sendNote(root);
    expect(links.map((a) => a.props.href)).toEqual(['/teach/space/notes?id=space%3Asunflower&compose=1&learner=profile%3Amina']);
    expect(textOf(links[0] as ReactTestInstance)).toBe(en.report.action.sendNote);
    expect(links[0]?.props.href).not.toContain('Mina');
    // Never inside an insight line: the fixture draws line actions, so this loop checks something.
    const lineActions = byTestId(root, 'report-line-actions');
    expect(lineActions.length).toBeGreaterThan(0);
    for (const line of lineActions) expect(textOf(line)).not.toContain(en.report.action.sendNote);
  });

  it('a family caregiver: the family notes page', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    nav.query = 'id=space%3Akim-family&learner=profile%3Amina&period=week&from=home';
    responses.report = () => ok(response(STEADY, { kind: 'family' }));
    responses.spaces = () => ok([{ space: { id: 'space:kim-family', kind: 'family' }, role: 'caregiver', counts: { learners: 1, accounts: 2, classes: 0 } }]);
    const root = await page();
    expect(sendNote(root)[0]?.props.href).toBe('/parent/space/notes?id=space%3Akim-family&compose=1&learner=profile%3Amina');
  });

  it('a school admin, an unknown role or an archived class: not drawn', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    responses.spaces = () => ok([{ space: { id: 'space:sunflower', kind: 'class' }, role: 'admin', counts: { learners: 1, accounts: 1, classes: 0 } }]);
    expect(sendNote(await page())).toHaveLength(0);
    act(() => mounted?.unmount());
    responses.spaces = () => ok([]);
    expect(sendNote(await page())).toHaveLength(0);
    act(() => mounted?.unmount());
    responses.spaces = () => ok([{ space: { id: 'space:sunflower', kind: 'class' }, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }]);
    responses.report = () => ok(response(STEADY, { kind: 'class', archivedAt: '2026-10-01T00:00:00.000Z' }));
    expect(sendNote(await page())).toHaveLength(0);
  });
});
