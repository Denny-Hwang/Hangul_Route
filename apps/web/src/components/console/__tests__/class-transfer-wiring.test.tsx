import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TransferSourceView, TransferView } from '@/lib/console/api';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';

/**
 * F-SPACE-002 T-6b wiring (spec 4.8 "Requests page", "Roster chip", "Home badge"; requests-page.md "Entry points"
 * and "States"): the class variant of `/teach/space/transfers`, the roster button with its count, the teacher home's
 * class-row badge and school-row links, and the family home's count, all only with `NEXT_PUBLIC_CLASS_TRANSFER`.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Aa'),
  usePathname: () => '/teach/space/transfers',
}));
vi.mock('@/lib/console/shell-store', () => ({ writeLastPersona: async () => true }));
// The frame draws its PageBack (AMENDMENTS-DISPLAY-NAV section 7.3) as a link first in the page; the stand-in does too.
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) => (
    <main>
      {back ? <a href={back.href}>{back.label}</a> : null}
      {children}
    </main>
  ),
}));

const state = vi.hoisted(() => ({
  kind: 'class' as string,
  archived: false,
  rosterError: null as null | { error: string; status: number },
  listError: null as null | { error: string; status: number; code?: string },
  requests: {} as Record<string, unknown[]>,
  counts: [] as Array<{ spaceId: string; waiting: number }>,
  spaces: [] as unknown[],
  spacesFail: false,
  signedOutTo: null as string | null,
  locale: 'en' as 'en' | 'es' | 'ko',
  calls: [] as string[],
}));
vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({
    signOut: async (url?: string) => {
      state.signedOutTo = url ?? null;
    },
  }),
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const space = (id: string, kind: string, name: string) => ({
    id,
    kind,
    name,
    parentSpaceId: null,
    settings: { consentMode: 'parent', anonymizeRoster: false },
    archivedAt: state.archived ? '2026-10-01T00:00:00.000Z' : null,
    createdAt: '2026-09-01T00:00:00.000Z',
  });
  const api = new Proxy(
    {
      roster: async (id: string) => {
        state.calls.push(`roster:${id}`);
        if (state.rosterError) return { ok: false, ...state.rosterError };
        return { ok: true, data: { space: space(id, state.kind, id === 'space:a' ? 'Sunday Class A' : 'Kim family'), learners: [], joinCode: null, joinCodeExpiresAt: null } };
      },
      listSpaces: async () => (state.spacesFail ? { ok: false, error: 'network', status: -1 } : { ok: true, data: state.spaces }),
      transferRequests: async (id: string) => {
        state.calls.push(`transfers:${id}`);
        if (state.listError) return { ok: false, ...state.listError };
        return { ok: true, data: { requests: state.requests[id] ?? [], counts: state.counts } };
      },
      school: async (id: string) => ({
        ok: true,
        data: {
          school: space(id, 'school', 'Riverside school'),
          classes: [
            { space: space('space:b', 'class', 'Saturday Class B'), teacher: null, students: 3, practiced: 0, lastActiveAt: null, hasPublishedPlan: false },
            { space: space('space:c', 'class', 'Weekday Class C'), teacher: null, students: 3, practiced: 0, lastActiveAt: null, hasPublishedPlan: false },
          ],
        },
      }),
      relinkRequests: async () => ({ ok: true, data: [] }),
      listPlans: async () => ({ ok: true, data: [] }),
      // [TV] teacher moves and the family's class-scope cards: nothing waiting
      classMoves: async () => ({ ok: true, data: { outgoing: [], incoming: [] } }),
      classScope: async () => ({ ok: true, data: { current: 'class-scope-2026-10', learners: [] } }),
      moveNotices: async () => ({ ok: true, data: [] }),
    } as Record<string, unknown>,
    { get: (target, key: string) => target[key] ?? (async () => ({ ok: true, data: [] })) },
  );
  const session = { accountId: 'acc_1', displayName: 'Ms Kim' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages('en'), locale: state.locale }) };
});

import TransfersPage from '@/app/(console)/teach/space/transfers/page';
import SpacePage from '@/app/(console)/teach/space/page';
import HomePage from '@/app/(console)/teach/home/page';
import ParentHomePage from '@/app/(console)/parent/page';

const m = getMessages('en').console;
const t = m.transfer;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllEnvs();
  resetTransferLockForTests();
  Object.assign(state, { kind: 'class', archived: false, rosterError: null, listError: null, requests: {}, counts: [], spaces: [], spacesFail: false, signedOutTo: null, calls: [] });
});

async function render(node: JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = create(node, { createNodeMock: () => ({}) });
  });
  await act(async () => undefined);
  await act(async () => undefined);
  return (renderer as ReactTestRenderer).root;
}
const textOf = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');

const waitingView = (over: Partial<TransferSourceView> = {}): TransferView => ({
  id: 'transfer:1',
  role: 'source',
  status: 'requested',
  steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: '2026-10-10T12:00:00.000Z',
  expiresAt: '2026-10-24T12:00:00.000Z',
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
  initiator: 'learner_side',
  learnerId: null,
  learner: { name: 'Jun', avatar: 'tiger' },
  destination: null,
  ...over,
});

const item = (id: string, kind: string, role: string, name: string) => ({
  space: { id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
  role,
  counts: { learners: 3, accounts: 1, classes: 2 },
  joinCode: null,
  joinCodeExpiresAt: null,
});

describe('the requests page, class variant (spec section 5: locked, 401, 403, and the class body)', () => {
  it('without the flag: "Class moves aren\'t available yet." and no call to the Worker', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'disabled');
    const root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(t.states.locked);
    expect(state.calls).toEqual([]);
  });

  it('a class: the heading, the class name, Leaving and Joining, the back link to the roster', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.requests['space:a'] = [waitingView()];
    const root = await render(<TransfersPage />);
    const body = textOf(root);
    expect(root.find((n) => n.type === 'h1').children).toEqual([t.title]);
    expect(body).toContain('Sunday Class A');
    expect(body).toContain(t.groups.leaving);
    expect(body).toContain(t.groups.joining);
    expect(body).toContain(t.lines.familyAsked('Jun'));
    expect(root.findAll((n) => n.type === 'a')[0]?.props.href).toBe('/teach/space?id=space%3Aa');
    expect(state.calls).toContain('transfers:space:a');
  });

  it('this account owns both classes (its space list): Agree for both classes', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.spaces = [item('space:a', 'class', 'owner', 'Sunday Class A'), item('space:b', 'class', 'teacher', 'Saturday Class B')];
    state.requests['space:a'] = [waitingView({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } })];
    const root = await render(<TransfersPage />);
    expect(textOf(byTestId(root, 'move-agree')[0] as ReactTestInstance)).toBe(t.actions.agreeBoth.cta);
  });

  it('the space list cannot be read: plain Agree', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.spacesFail = true;
    state.requests['space:a'] = [waitingView({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } })];
    const root = await render(<TransfersPage />);
    expect(textOf(byTestId(root, 'move-agree')[0] as ReactTestInstance)).toBe(t.actions.agree.cta);
  });

  it('a school admin reaching this class through the school, owning only the new class: plain Agree', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.spaces = [item('space:s', 'school', 'admin', 'Riverside school'), item('space:b', 'class', 'owner', 'Saturday Class B')];
    state.requests['space:a'] = [waitingView({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } })];
    const root = await render(<TransfersPage />);
    expect(textOf(byTestId(root, 'move-agree')[0] as ReactTestInstance)).toBe(t.actions.agree.cta);
  });

  it('an archived class is read-only: no Agree', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.archived = true;
    state.requests['space:a'] = [waitingView()];
    const root = await render(<TransfersPage />);
    expect(byTestId(root, 'move-agree')).toEqual([]);
  });

  it('a school id has no page of its own: the locked line, no list read', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.kind = 'school';
    const root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(t.states.locked);
    expect(state.calls.some((c) => c.startsWith('transfers:'))).toBe(false);
  });

  // AMENDMENTS-DISPLAY-NAV section 6: Sign in again carries the console's language, English included.
  it.each(['en', 'es', 'ko'] as const)('401 on the list: "Please sign in again." and Sign in again back to this page with lang=%s', async (locale) => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.listError = { error: 'unauthorized', status: 401 };
    state.locale = locale;
    try {
      const root = await render(<TransfersPage />);
      expect(textOf(root)).toContain(m.start.signInAgain);
      const button = root.find((n) => n.type === 'button' && n.props['data-testid'] === 'transfers-sign-in');
      await act(async () => button.props.onClick());
      expect(state.signedOutTo).toBe(`/signin?next=${encodeURIComponent('/teach/space/transfers?id=space%3Aa')}&lang=${locale}`);
    } finally {
      state.locale = 'en';
    }
  });

  it('403 on the list: "You can no longer answer this class\'s moves." with no names', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.listError = { error: 'forbidden', status: 403, code: 'forbidden' };
    const root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(t.states.forbidden);
    expect(byTestId(root, 'move-card')).toEqual([]);
  });

  it('422 transfers_locked on the list: the locked line', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.listError = { error: 'unknown', status: 422, code: 'transfers_locked' };
    const root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(t.states.locked);
  });
});

describe('the roster chip (beside Re-link requests)', () => {
  it('without the flag: no button and no list read', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'disabled');
    const root = await render(<SpacePage />);
    expect(byTestId(root, 'class-moves')).toEqual([]);
    expect(state.calls.some((c) => c.startsWith('transfers:'))).toBe(false);
  });

  it('a class with nothing waiting: the permanent Class moves button, to this page', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    const root = await render(<SpacePage />);
    const [button] = byTestId(root, 'class-moves');
    expect(textOf(button as ReactTestInstance)).toBe(t.entry.cta);
    const link = root.find((n) => n.type === 'a' && n.props.href === '/teach/space/transfers?id=space%3Aa');
    expect(link).toBeTruthy();
  });

  it('two waiting for this class: "2 class moves waiting"; a request waiting on others does not count', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.requests['space:a'] = [waitingView({ id: 'a' }), waitingView({ id: 'b' }), waitingView({ id: 'c', steps: { learner: 'yes', source: 'yes', destination: 'waiting' } })];
    const root = await render(<SpacePage />);
    expect(textOf(byTestId(root, 'class-moves')[0] as ReactTestInstance)).toBe(t.waiting(2));
  });

  it('a family roster button carries the count too (singular)', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.kind = 'family';
    state.requests['space:a'] = [{ id: 'f', role: 'learner_side', status: 'requested', learnerState: 'pending' } as unknown as TransferView];
    const root = await render(<SpacePage />);
    expect(byTestId(root, 'class-moves')).toEqual([]);
    expect(textOf(byTestId(root, 'family-moves')[0] as ReactTestInstance)).toBe(t.waiting(1));
  });
});

describe('the home badges', () => {
  it('teacher home: a class row gains "N class moves waiting"; a school row one link per child class with waiting moves', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.spaces = [item('space:a', 'class', 'owner', 'Sunday Class A'), item('space:s', 'school', 'admin', 'Riverside school')];
    state.requests['space:a'] = [waitingView({ id: 'a' }), waitingView({ id: 'b' })];
    state.counts = [
      { spaceId: 'space:b', waiting: 2 },
      { spaceId: 'space:c', waiting: 0 },
    ];
    const root = await render(<HomePage />);
    const badge = byTestId(root, 'class-moves-space:a')[0] as ReactTestInstance;
    expect(textOf(badge)).toBe(t.waiting(2));
    expect(badge.props.href).toBe('/teach/space/transfers?id=space%3Aa');
    const school = byTestId(root, 'school-moves-space:b')[0] as ReactTestInstance;
    expect(textOf(school)).toBe(t.schoolRow('Saturday Class B', 2));
    expect(school.props.href).toBe('/teach/space/transfers?id=space%3Ab');
    expect(byTestId(root, 'school-moves-space:c')).toEqual([]);
  });

  it('teacher home: nothing waiting or the flag off draws no badge', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'disabled');
    state.spaces = [item('space:a', 'class', 'owner', 'Sunday Class A')];
    state.requests['space:a'] = [waitingView()];
    let root = await render(<HomePage />);
    expect(byTestId(root, 'class-moves-space:a')).toEqual([]);
    expect(state.calls.some((c) => c.startsWith('transfers:'))).toBe(false);
    act(() => renderer?.unmount());
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.requests['space:a'] = [];
    root = await render(<HomePage />);
    expect(byTestId(root, 'class-moves-space:a')).toEqual([]);
  });

  it('family home: the family actions gain "1 class move waiting" to the family page', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.kind = 'family';
    state.spaces = [item('space:f', 'family', 'owner', 'Kim family')];
    state.requests['space:f'] = [{ id: 'f', role: 'learner_side', status: 'requested', learnerState: 'pending' } as unknown as TransferView];
    const root = await render(<ParentHomePage />);
    const link = byTestId(root, 'family-moves-waiting')[0] as ReactTestInstance;
    expect(textOf(link)).toBe(t.waiting(1));
    expect(link.props.href).toBe('/parent/space/transfers?id=space%3Af');
  });
});
