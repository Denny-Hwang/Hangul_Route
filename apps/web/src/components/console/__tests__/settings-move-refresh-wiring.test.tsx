import { LEARNER_CLASS_CAP } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';

/**
 * Owner report 2026-10-23: a learner moved from class A to class B still showed in both. The server held one
 * membership; class A's settings page kept the old list. This file pins the settings page's side of the fix: every
 * way out of the teacher move sheet reads the members again, a not-found move answer reads them before it says
 * anything, the page reads again when the tab comes back into view, an older read never puts a moved learner back,
 * a learner already in the destination can be removed here, and an unarchive the server refuses for the class cap
 * says why. Rendered with react-test-renderer (no DOM); `document` is a stub that holds the listeners.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Aa'),
}));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number; code?: string; details?: Record<string, unknown> };
const OWNER = { memberKind: 'account', memberId: 'acc_1', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Mr Han', isOwner: true };
const MINA = { memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Mina', isOwner: false };

const state = vi.hoisted(() => ({
  learners: [] as unknown[],
  archivedAt: null as string | null,
  rosterOk: true,
  /** Each members read takes the next gate when one is queued (a slow network), so reads can end out of order. */
  gates: [] as { wait: Promise<void>; list: unknown[] }[],
  create: null as unknown,
  archive: null as unknown,
  calls: [] as string[],
  removeCalls: [] as unknown[],
}));

vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    roster: async () => {
      state.calls.push('roster');
      if (!state.rosterOk) return { ok: false, error: 'forbidden', status: 403 };
      return {
        ok: true,
        data: {
          space: { id: 'space:a', kind: 'class', name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: state.archivedAt, createdAt: '2026-09-01T00:00:00.000Z' },
          learners: [],
          joinCode: 'K7PM4Q',
          joinCodeExpiresAt: '2026-11-01T00:00:00.000Z',
        },
      };
    },
    members: async () => {
      state.calls.push('members');
      const gate = state.gates.shift();
      if (gate) {
        await gate.wait;
        return { ok: true, data: [OWNER, ...gate.list] };
      }
      return { ok: true, data: [OWNER, ...state.learners] };
    },
    classMoveDestinations: async () => ({ ok: true, data: [{ id: 'space:b', name: 'Saturday Class B' }] }),
    previewClassMove: async () => ({ ok: false, error: 'unknown', status: 409, code: 'mocked' }),
    createClassMove: async () => state.create,
    removeMember: async (...args: unknown[]) => {
      state.removeCalls.push(args);
      state.learners = [];
      return { ok: true, data: { removed: true } };
    },
    archiveSpace: async () => state.archive,
    transferRequests: async () => ({ ok: true, data: { requests: [], options: [] } }),
    billingSummary: async () => ({ ok: false, error: 'network', status: -1 }),
  };
  const session = { accountId: 'acc_1', displayName: 'Mr Han' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});

import SettingsPage from '@/app/(console)/teach/space/settings/page';

const en = getMessages('en').console;
const tm = en.teacherMove;

const listeners = new Set<() => void>();
const fakeDocument = {
  title: 'Console',
  activeElement: null as unknown,
  body: {},
  visibilityState: 'visible',
  addEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.add(l);
  },
  removeEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.delete(l);
  },
};
const NOW = new Date('2026-10-23T09:00:00.000Z');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', fakeDocument);
  vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
  state.learners = [MINA];
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  listeners.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetTransferLockForTests();
  state.archivedAt = null;
  state.rosterOk = true;
  state.gates = [];
  state.create = null;
  state.archive = null;
  state.calls = [];
  state.removeCalls = [];
});

async function renderPage(): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = create(<SettingsPage />);
  });
  await act(async () => undefined);
  return (renderer as ReactTestRenderer).root;
}

const root = (): ReactTestInstance => (renderer as ReactTestRenderer).root;
const textOf = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');
const moveRows = (): ReactTestInstance[] => root().findAll((n) => n.type === 'button' && n.props['data-testid'] === 'move-row');
const button = (testId: string): ReactTestInstance => root().find((n) => n.type === 'button' && n.props['data-testid'] === testId);
const sheets = (): ReactTestInstance[] => root().findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === 'teacher-move-sheet');
const membersReads = (): number => state.calls.filter((c) => c === 'members').length;
const press = async (node: ReactTestInstance): Promise<void> => {
  await act(async () => node.props.onClick());
};

async function openMoveToB(): Promise<void> {
  await press(moveRows()[0] as ReactTestInstance);
  await act(async () => root().find((n) => n.type === 'input' && n.props.value === 'space:b').props.onChange());
  await press(button('teacher-move-continue'));
}

describe('class settings after a teacher move (owner report 2026-10-23)', () => {
  it('a move that answers not_found reads the members again; the learner is gone, so a neutral line and no forbidden notice', async () => {
    await renderPage();
    expect(moveRows()).toHaveLength(1);
    await openMoveToB();
    // Someone else moved Mina meanwhile: the server says not_found and no longer lists her here.
    state.create = { ok: false, error: 'not_found', status: 404, code: 'not_found' };
    state.learners = [];
    const before = membersReads();
    await press(button('teacher-move-go'));
    expect(membersReads()).toBe(before + 1);
    expect(sheets()).toHaveLength(0);
    expect(moveRows()).toHaveLength(0);
    expect(textOf(root())).toContain(en.settings.learnerGone('Mina'));
    expect(textOf(root())).not.toContain(en.transfer.states.forbidden);
  });

  it('a not_found move when the class itself can no longer be read keeps the forbidden notice', async () => {
    await renderPage();
    await openMoveToB();
    state.create = { ok: false, error: 'not_found', status: 404, code: 'not_found' };
    state.rosterOk = false;
    await press(button('teacher-move-go'));
    expect(textOf(root())).toContain(en.transfer.states.forbidden);
    expect(textOf(root())).not.toContain(en.settings.learnerGone('Mina'));
  });

  it('closing the sheet reads the members again', async () => {
    await renderPage();
    await press(moveRows()[0] as ReactTestInstance);
    const before = membersReads();
    state.learners = [];
    await press(root().find((n) => n.type === 'button' && n.props['aria-label'] === en.transfer.a11y.close));
    expect(sheets()).toHaveLength(0);
    expect(membersReads()).toBe(before + 1);
    expect(moveRows()).toHaveLength(0);
  });

  it('a move sent to another class (not yet moved) still reads the members again on Done', async () => {
    await renderPage();
    await openMoveToB();
    state.create = { ok: true, data: { id: 'move:1', kind: 'accept', status: 'waiting', to: { spaceId: 'space:b', name: 'Saturday Class B' }, learner: null, createdAt: 't', at: null } };
    await press(button('teacher-move-go'));
    const before = membersReads();
    await press(button('teacher-move-finish'));
    expect(membersReads()).toBe(before + 1);
    expect(textOf(root())).toContain(tm.sent('Saturday Class B'));
  });

  it('reads again when the tab comes back into view, and an older read that ends later never puts a moved learner back', async () => {
    await renderPage();
    expect(moveRows()).toHaveLength(1);
    // Two reads in flight: the older still lists Mina, the newer (after the move) does not; the newer ends first.
    let releaseOld: () => void = () => undefined;
    let releaseNew: () => void = () => undefined;
    state.gates.push({ wait: new Promise<void>((r) => (releaseOld = r)), list: [MINA] }, { wait: new Promise<void>((r) => (releaseNew = r)), list: [] });
    vi.setSystemTime(NOW.getTime() + 31_000);
    await act(async () => {
      for (const l of [...listeners]) l();
    });
    vi.setSystemTime(NOW.getTime() + 62_000);
    await act(async () => {
      for (const l of [...listeners]) l();
    });
    expect(membersReads()).toBe(3);
    await act(async () => releaseNew());
    expect(moveRows()).toHaveLength(0);
    await act(async () => releaseOld());
    expect(moveRows()).toHaveLength(0);
  });

  it('already in the destination: the sheet offers Remove here, which runs the page remove flow and its confirm', async () => {
    await renderPage();
    await openMoveToB();
    state.create = { ok: false, error: 'unknown', status: 409, code: 'already_member' };
    await press(button('teacher-move-go'));
    expect(textOf(root())).toContain(tm.errors.alreadyMemberKeepOne('Mina', 'Saturday Class B'));
    await press(button('teacher-move-remove-here'));
    expect(sheets()).toHaveLength(0);
    const confirmSheet = root().find((n) => typeof n.type === 'string' && n.props['data-testid'] === 'confirm-sheet');
    expect(textOf(confirmSheet)).toContain(en.settings.learners.removeAsk('Mina', 'Sunday Class A'));
    await press(button('confirm-sheet-confirm'));
    expect(state.removeCalls).toEqual([['space:a', 'learner', 'profile:mina']]);
    expect(moveRows()).toHaveLength(0);
  });

  it('an unarchive refused for the class cap says how many learners and what to do', async () => {
    state.archivedAt = '2026-10-01T00:00:00.000Z';
    state.archive = { ok: false, error: 'unknown', status: 409, code: 'unarchive_over_cap', details: { learners: 2 } };
    await renderPage();
    await press(root().find((n) => n.type === 'button' && textOf(n) === en.settings.danger.unarchive.cta));
    expect(textOf(root())).toContain(en.settings.unarchiveOverCap(2, LEARNER_CLASS_CAP));
    expect(en.settings.unarchiveOverCap(null, LEARNER_CLASS_CAP)).not.toMatch(/null|undefined/);
    expect(textOf(root())).not.toContain(en.settings.notes.saveFailed);
  });

  it('a removed learner tells other console tabs to read their rosters again', async () => {
    const posted: unknown[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor(readonly name: string) {}
        postMessage(message: unknown): void {
          posted.push([this.name, message]);
        }
        close(): void {}
      },
    );
    await renderPage();
    await press(root().find((n) => n.type === 'button' && textOf(n) === en.settings.learners.remove.class.cta));
    await press(button('confirm-sheet-confirm'));
    expect(posted).toEqual([['hr-roster', { type: 'roster-changed' }]]);
  });
});
