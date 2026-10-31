import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';

/**
 * AMENDMENTS-GROWNUP-UX row GX-10, the settings page's wiring (T11, P7): the page reads the space's re-links (always)
 * and, while class moves are shown, its transfers (and a class's teacher moves), and draws the same `attentionModel` as
 * the class roster: the chip next to each learner's name, Move off while that learner's move is open, an action chip that
 * opens the shipped re-link page, and a family learner's class line from the transfer list's options. A read that fails
 * or a method an older bundle lacks adds nothing and never breaks the page.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
const nav = vi.hoisted(() => ({ pushed: [] as string[] }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: (href: string) => nav.pushed.push(href) }),
  useSearchParams: () => new URLSearchParams('id=space%3Aa'),
}));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

const NOW = Date.now();
const at = (minutes: number): string => new Date(NOW + minutes * 60_000).toISOString();

const state = vi.hoisted(() => ({
  kind: 'class' as string,
  relinks: null as unknown,
  transfers: null as unknown,
  moves: null as unknown,
  calls: [] as string[],
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const row = (id: string, name: string) => ({ id, displayName: name, ageGroup: '5-7', avatar: 'tiger', joinedAt: '2026-09-20T00:00:00.000Z', lastActiveAt: '2026-10-30T00:00:00.000Z', summary: { lastActiveAt: '2026-10-30T00:00:00.000Z' }, lastSyncedAt: null });
  const api = {
    roster: async () => ({
      ok: true,
      data: {
        space: { id: 'space:a', kind: state.kind, name: state.kind === 'family' ? 'The Kims' : 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
        learners: [row('profile:mina', 'Mina'), row('profile:jaehan', 'Jaehan')],
        joinCode: 'K7PM4Q',
        joinCodeExpiresAt: '2026-12-01T00:00:00.000Z',
      },
    }),
    members: async () => ({
      ok: true,
      data: [
        { memberKind: 'account', memberId: 'acc_1', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Mr Han', isOwner: true },
        { memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Mina', isOwner: false },
        { memberKind: 'learner', memberId: 'profile:jaehan', role: 'student', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Jaehan', isOwner: false },
      ],
    }),
    relinkRequests: async () => {
      state.calls.push('relinks');
      return state.relinks ?? { ok: true, data: [] };
    },
    transferRequests: async () => {
      state.calls.push('transfers');
      return state.transfers ?? { ok: true, data: { requests: [], options: [] } };
    },
    classMoves: async () => {
      state.calls.push('classMoves');
      return state.moves ?? { ok: true, data: { outgoing: [], incoming: [] } };
    },
    billingSummary: async () => ({ ok: false, error: 'network', status: -1 }),
  };
  const session = { accountId: 'acc_1', displayName: 'Mr Han' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});

import SettingsPage from '@/app/(console)/teach/space/settings/page';

const c = getMessages('en').console;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllEnvs();
  resetTransferLockForTests();
  state.kind = 'class';
  state.relinks = null;
  state.transfers = null;
  state.moves = null;
  state.calls = [];
  nav.pushed = [];
});

async function renderPage(): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = create(<SettingsPage />);
  });
  await act(async () => undefined);
  await act(async () => undefined);
  return (renderer as ReactTestRenderer).root;
}

const textOf = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((x) => typeof x === 'string').join('')).join(' ');
const rowOf = (root: ReactTestInstance, name: string): ReactTestInstance => {
  const row = root.findAll((n) => n.type === 'div' && n.props['data-testid'] === 'settings-learner-row').find((r) => r.findAll((n) => n.type === 'strong').some((s) => textOf(s) === name));
  expect(row, name).toBeDefined();
  return row as ReactTestInstance;
};
const relink = { id: 'relink:j', learnerId: 'profile:jaehan', learnerName: 'Jaehan', deviceId: 'device:new', platform: 'ios', requestedAt: at(-2), expiresAt: at(7.5), status: 'pending' };
const classStartedMoveOut = {
  id: 'transfer:out',
  role: 'source',
  status: 'requested',
  initiator: 'source',
  learnerId: 'profile:mina',
  steps: { learner: 'waiting', source: 'yes', destination: 'waiting' },
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: at(-60),
  expiresAt: at(60 * 24 * 13),
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
  learner: { name: 'Mina', avatar: 'tiger' },
  destination: { name: 'Evening Class D' },
};

describe('class settings rows (T11)', () => {
  it('a new device: Needs your OK next to the name, its tap opens the re-link page; the others read In class', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.relinks = { ok: true, data: [relink] };
    const root = await renderPage();
    const jaehan = rowOf(root, 'Jaehan');
    const chip = jaehan.find((n) => n.type === 'button' && n.props['data-testid'] === 'learner-status');
    expect(chip.props['aria-label']).toBe(c.status.chipName(c.status.needsOk, c.status.newDevice(8)));
    act(() => chip.props.onClick());
    expect(nav.pushed).toEqual(['/teach/space/relink?id=space%3Aa']);
    expect(textOf(rowOf(root, 'Mina'))).toContain(c.status.inClass);
    // Ids only in the address, never a name.
    for (const href of nav.pushed) expect(href).not.toMatch(/Jaehan|Mina/);
  });

  it("a learner's open move: Move is off with the reason; the other learner's Move works", async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.transfers = { ok: true, data: { requests: [classStartedMoveOut] } };
    const root = await renderPage();
    const mina = rowOf(root, 'Mina');
    expect(textOf(mina)).toContain(c.status.moveWaiting);
    const move = mina.find((n) => n.type === 'button' && n.props['data-testid'] === 'move-row');
    expect(move.props['aria-disabled']).toBe(true);
    expect(textOf(mina)).toContain(c.settings.moveOpen);
    const other = rowOf(root, 'Jaehan').find((n) => n.type === 'button' && n.props['data-testid'] === 'move-row');
    expect(other.props['aria-disabled']).toBeUndefined();
    expect(state.calls).toEqual(expect.arrayContaining(['relinks', 'transfers', 'classMoves']));
  });

  it('with class moves switched off: re-links still read and shown; no move reads', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'disabled');
    state.relinks = { ok: true, data: [relink] };
    const root = await renderPage();
    expect(rowOf(root, 'Jaehan').findAll((n) => n.type === 'button' && n.props['data-testid'] === 'learner-status')).toHaveLength(1);
    expect(state.calls).toEqual(['relinks']);
  });

  it('failed reads add nothing and the page still draws every row', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.relinks = { ok: false, error: 'network', status: -1 };
    state.transfers = { ok: false, error: 'network', status: -1 };
    state.moves = { ok: false, error: 'network', status: -1 };
    const root = await renderPage();
    for (const name of ['Mina', 'Jaehan']) {
      const row = rowOf(root, name);
      expect(textOf(row)).toContain(c.status.inClass);
      expect(row.find((n) => n.type === 'button' && n.props['data-testid'] === 'move-row').props['aria-disabled']).toBeUndefined();
    }
  });
});

describe('family settings rows (P7)', () => {
  it("each learner's class line from the options; no default chip; Invite another grown-up", async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.kind = 'family';
    state.transfers = {
      ok: true,
      data: {
        requests: [],
        options: [
          { learnerId: 'profile:mina', name: 'Mina', classes: [{ spaceId: 'space:c1', name: 'Sunday Class A' }], selfManaged: false, blockTeacherRequests: false },
          { learnerId: 'profile:jaehan', name: 'Jaehan', classes: [], selfManaged: false, blockTeacherRequests: false },
        ],
      },
    };
    const root = await renderPage();
    expect(textOf(rowOf(root, 'Mina'))).toContain(c.parentHome.classLine.one('Sunday Class A'));
    expect(textOf(rowOf(root, 'Jaehan'))).toContain(c.parentHome.classLine.none);
    expect(root.findAll((n) => n.props['data-testid'] === 'learner-status')).toHaveLength(0);
    expect(root.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'invite-grown-up')).toHaveLength(1);
    // A family reads no class-move list of its own here.
    expect(state.calls).not.toContain('classMoves');
  });

  it('the class line is left out when the classes read fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.kind = 'family';
    state.transfers = { ok: false, error: 'network', status: -1 };
    const root = await renderPage();
    expect(textOf(rowOf(root, 'Jaehan'))).not.toContain(c.parentHome.classLine.none);
  });
});
