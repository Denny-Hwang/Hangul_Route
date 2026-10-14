import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { noteTransferResult, resetTransferLockForTests } from '@/lib/console/transfer-lock';

/**
 * F-SPACE-002 T-6c, the settings page's wiring (spec 4.8 "Settings learner row"; start-sheet.md): Move to another
 * class sits before Remove on a live class's learner rows, only with `NEXT_PUBLIC_CLASS_TRANSFER=enabled` and until
 * the first `transfers_locked`; never on a family or school row, never on an archived class, never in the Danger zone.
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

const state = vi.hoisted(() => ({ kind: 'class' as string, archivedAt: null as string | null, preview: null as unknown, create: null as unknown, destinations: null as unknown, previewCalls: [] as unknown[], createCalls: [] as unknown[] }));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    roster: async () => ({
      ok: true,
      data: {
        space: { id: 'space:a', kind: state.kind, name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: state.archivedAt, createdAt: '2026-09-01T00:00:00.000Z' },
        learners: [],
        joinCode: 'K7PM4Q',
        joinCodeExpiresAt: '2026-11-01T00:00:00.000Z',
      },
    }),
    members: async () => ({
      ok: true,
      data: [
        { memberKind: 'account', memberId: 'acc_1', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Mr Han', isOwner: true },
        { memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Mina', isOwner: false },
      ],
    }),
    // [TV] the teacher move sheet (TV-D7, TV-D8) replaces the source-started request sheet on a class
    classMoveDestinations: async () => state.destinations ?? { ok: true, data: [] },
    previewClassMove: async (...args: unknown[]) => {
      state.previewCalls.push(args);
      return state.preview;
    },
    createClassMove: async (...args: unknown[]) => {
      state.createCalls.push(args);
      return state.create;
    },
    transferRequests: async () => ({ ok: true, data: { requests: [], options: [] } }),
    billingSummary: async () => ({ ok: false, error: 'network', status: -1 }),
  };
  const session = { accountId: 'acc_1', displayName: 'Mr Han' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});

import SettingsPage from '@/app/(console)/teach/space/settings/page';

const t = getMessages('en').console.transfer;
const tm = getMessages('en').console.teacherMove;

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
  state.archivedAt = null;
  state.previewCalls = [];
  state.createCalls = [];
  state.destinations = null;
});

async function renderPage(): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = create(<SettingsPage />);
  });
  await act(async () => undefined);
  return (renderer as ReactTestRenderer).root;
}

const moveButtons = (root: ReactTestInstance) => root.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'move-row');
const codeInput = (root: ReactTestInstance) => root.find((n) => n.type === 'input' && n.props.name === 'classCode');
const textOf = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');

describe('settings Move action (T-6c)', () => {
  it('renders nothing while NEXT_PUBLIC_CLASS_TRANSFER is unset', async () => {
    const root = await renderPage();
    expect(textOf(root)).toContain('Remove from class');
    expect(moveButtons(root)).toHaveLength(0);
  });

  it('with the flag: Move to another class before Remove on a class row, outside the Danger zone', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    const root = await renderPage();
    const [move] = moveButtons(root);
    expect(move).toBeDefined();
    const learners = root.find((n) => n.type === 'section' && n.props['aria-label'] === getMessages('en').console.settings.learners.label);
    const labels = learners.findAll((n) => n.type === 'button').map((b) => textOf(b));
    expect(labels).toEqual(['Move to another class', 'Remove from class']);
    const danger = root.find((n) => n.type === 'section' && n.props['aria-label'] === getMessages('en').console.settings.danger.title);
    expect(danger.findAll((n) => n.props['data-testid'] === 'move-row')).toHaveLength(0);
  });

  it('never on a family or school row, never on an archived class', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    for (const [kind, archivedAt] of [
      ['family', null],
      ['school', null],
      ['class', '2026-10-01T00:00:00.000Z'],
    ] as const) {
      state.kind = kind;
      state.archivedAt = archivedAt;
      const root = await renderPage();
      expect(moveButtons(root), `${kind} ${archivedAt}`).toHaveLength(0);
      act(() => renderer?.unmount());
      renderer = null;
    }
  });

  it('[TV] Move opens the teacher move sheet; a move into another teacher\'s class is sent and the page says so', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.preview = { ok: true, data: { destination: { id: 'space:b', name: 'Saturday Class B' }, direct: false } };
    state.create = { ok: true, data: { id: 'move:1', kind: 'accept', status: 'waiting', to: { spaceId: 'space:b', name: 'Saturday Class B' }, learner: { name: 'Mina', avatar: 'tiger' }, createdAt: 't', at: null } };
    const root = await renderPage();
    await act(async () => moveButtons(root)[0]?.props.onClick());
    const sheet = root.find((n) => n.props['data-testid'] === 'teacher-move-sheet' && typeof n.type === 'string');
    expect(textOf(sheet)).toContain(tm.sheetTitle('Mina'));
    act(() => codeInput(root).props.onChange({ target: { value: 'K7PM4Q' } }));
    await act(async () => root.find((n) => n.type === 'button' && n.props['data-testid'] === 'teacher-move-find').props.onClick());
    expect(state.previewCalls).toEqual([['space:a', { learnerId: 'profile:mina', code: 'K7PM4Q' }]]);
    await act(async () => root.find((n) => n.type === 'button' && n.props['data-testid'] === 'teacher-move-continue').props.onClick());
    await act(async () => root.find((n) => n.type === 'button' && n.props['data-testid'] === 'teacher-move-go').props.onClick());
    expect(state.createCalls).toEqual([['space:a', { learnerId: 'profile:mina', destinationSpaceId: 'space:b', code: 'K7PM4Q' }]]);
    await act(async () => root.find((n) => n.type === 'button' && n.props['data-testid'] === 'teacher-move-finish').props.onClick());
    expect(root.findAll((n) => n.props['data-testid'] === 'teacher-move-sheet')).toHaveLength(0);
    expect(textOf(root)).toContain(tm.sent('Saturday Class B'));
  });

  it('a transfers_locked answer closes the sheet, hides every Move and says moves are not available yet', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.preview = { ok: false, error: 'invalid', status: 422, code: 'transfers_locked' };
    const root = await renderPage();
    await act(async () => moveButtons(root)[0]?.props.onClick());
    act(() => codeInput(root).props.onChange({ target: { value: 'K7PM4Q' } }));
    await act(async () => {
      // The real client notes the lock before the sheet sees the answer.
      noteTransferResult(state.preview as never);
      root.find((n) => n.type === 'button' && n.props['data-testid'] === 'teacher-move-find').props.onClick();
    });
    expect(root.findAll((n) => n.props['data-testid'] === 'teacher-move-sheet')).toHaveLength(0);
    expect(moveButtons(root)).toHaveLength(0);
    expect(textOf(root)).toContain(t.states.locked);
  });
});
