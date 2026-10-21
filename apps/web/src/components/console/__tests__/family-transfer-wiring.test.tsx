import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';

/**
 * F-SPACE-002 T-6d wiring (spec 4.8 "Family page", "Settings learner row"; family-page.md): the class-moves page's
 * family variant, the family roster's permanent Class moves button and the settings family row's Move to a class,
 * all only with `NEXT_PUBLIC_CLASS_TRANSFER=enabled`.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Af'),
  usePathname: () => '/parent/space/transfers',
}));
// The frame draws its PageBack (AMENDMENTS-DISPLAY-NAV section 7.3) as a link first in the page; the stand-in does too.
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) => (
    <main>
      {back ? <a href={back.href}>{back.label}</a> : null}
      {children}
    </main>
  ),
}));

const state = vi.hoisted(() => ({ kind: 'family' as string, rosterError: null as string | null, previewError: null as string | null, signedOutTo: null as string | null, calls: [] as string[] }));
vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({
    signOut: async (url?: string) => {
      state.signedOutTo = url ?? null;
    },
  }),
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const space = () => ({ id: 'space:f', kind: state.kind, name: 'Kim family', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' });
  const api = new Proxy(
    {
      roster: async () => {
        state.calls.push('roster');
        return state.rosterError ? { ok: false, error: state.rosterError, status: 403 } : { ok: true, data: { space: space(), learners: [], joinCode: null, joinCodeExpiresAt: null } };
      },
      members: async () => ({
        ok: true,
        data: [
          { memberKind: 'account', memberId: 'acc_1', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Ji', isOwner: true },
          { memberKind: 'learner', memberId: 'profile:mina', role: 'learner', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Mina', isOwner: false },
          { memberKind: 'learner', memberId: 'profile:jun', role: 'learner', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Jun', isOwner: false },
        ],
      }),
      previewTransfer: async () => (state.previewError ? { ok: false, error: state.previewError, status: 403 } : { ok: false, error: 'network', status: -1 }),
      transferRequests: async () => {
        state.calls.push('transferRequests');
        return { ok: true, data: { requests: [], options: [{ learnerId: 'profile:mina', name: 'Mina', classes: [{ spaceId: 'space:a', name: 'Sunday Class A' }], selfManaged: false, blockTeacherRequests: false }] } };
      },
    } as Record<string, unknown>,
    { get: (target, key: string) => target[key] ?? (async () => ({ ok: true, data: [] })) },
  );
  const session = { accountId: 'acc_1', displayName: 'Ji' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});

import TransfersPage from '@/app/(console)/teach/space/transfers/page';
import SettingsPage from '@/app/(console)/teach/space/settings/page';
import SpacePage from '@/app/(console)/teach/space/page';

const t = getMessages('en').console.transfer;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllEnvs();
  resetTransferLockForTests();
  state.kind = 'family';
  state.rosterError = null;
  state.previewError = null;
  state.signedOutTo = null;
  state.calls = [];
});

async function render(node: JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = create(node, { createNodeMock: () => ({}) });
  });
  await act(async () => undefined);
  return (renderer as ReactTestRenderer).root;
}
const textOf = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');

describe('the class-moves page (T-6d family variant)', () => {
  it('without the flag: "Class moves aren\'t available yet." and no call to the Worker', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'disabled');
    const root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(t.states.locked);
    expect(state.calls).toEqual([]);
  });

  it('a family: the heading, the family name from the roster, its requests and Start a move', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    const root = await render(<TransfersPage />);
    const body = textOf(root);
    expect(root.find((n) => n.type === 'h1').children).toEqual([t.title]);
    expect(body).toContain('Kim family');
    expect(body).not.toContain('Our family');
    expect(body).toContain(t.empty);
    expect(body).toContain(t.groups.start);
    expect(root.find((n) => n.type === 'a').props.href).toBe('/parent/space?id=space%3Af');
  });

  it('a school id has no page of its own (T-6b: its home row links to each class); a lost role reads the forbidden line', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.kind = 'school';
    let root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(t.states.locked);
    expect(state.calls).not.toContain('transferRequests');
    act(() => renderer?.unmount());
    state.kind = 'family';
    state.rosterError = 'forbidden';
    root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(t.states.forbidden);
  });
});

describe('the class-moves page: a 401 (review of #504)', () => {
  it('reads "Please sign in again." with a Sign in again button that comes back to this page', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.rosterError = 'unauthorized';
    const root = await render(<TransfersPage />);
    expect(textOf(root)).toContain(getMessages('en').console.start.signInAgain);
    const button = root.find((n) => n.type === 'button' && n.props['data-testid'] === 'transfers-sign-in');
    expect(textOf(button)).toBe(getMessages('en').console.lock.signInAgain.cta);
    await act(async () => button.props.onClick());
    expect(state.signedOutTo).toBe(`/signin?next=${encodeURIComponent('/parent/space/transfers?id=space%3Af')}&lang=en`);
  });
});

describe('the settings family row (T-6d)', () => {
  it('a lost role in the start flow reads the forbidden line, not the lock (review of #504)', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    state.previewError = 'forbidden';
    const root = await render(<SettingsPage />);
    act(() => root.find((n) => n.type === 'button' && n.props['data-testid'] === 'move-row').props.onClick());
    act(() => root.find((n) => n.type === 'input' && n.props.name === 'classCode').props.onChange({ target: { value: 'K7PM4Q' } }));
    await act(async () => root.find((n) => n.type === 'button' && n.props['data-testid'] === 'family-find').props.onClick());
    expect(textOf(root)).toContain(t.states.forbidden);
    expect(textOf(root)).not.toContain(t.states.locked);
  });

  it('Move to a class only for a learner in a live class; it opens the family start flow for that learner', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    const root = await render(<SettingsPage />);
    const moves = root.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'move-row');
    expect(moves).toHaveLength(1);
    expect(moves[0]?.props['aria-label']).toBe(t.a11y.moveRowFamily('Mina'));
    expect(textOf(moves[0] as ReactTestInstance)).toBe(t.start.move.family.cta);
    act(() => moves[0]?.props.onClick());
    const sheet = root.find((n) => n.props['data-testid'] === 'family-start-sheet' && typeof n.type === 'string');
    expect(textOf(sheet)).toContain(t.start.title('Mina'));
    expect(sheet.findAll((n) => n.type === 'select' && n.props.name === 'moveLearner')).toHaveLength(0);
  });

  it('no Move on a family without the flag, and no class-moves call', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'disabled');
    const root = await render(<SettingsPage />);
    expect(root.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'move-row')).toHaveLength(0);
    expect(state.calls).not.toContain('transferRequests');
  });
});

describe('the family roster page (T-6d)', () => {
  it('a permanent Class moves button next to Settings, only with the flag', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'disabled');
    let root = await render(<SpacePage />);
    expect(root.findAll((n) => n.type === 'button' && n.props['data-testid'] === 'family-moves')).toHaveLength(0);
    act(() => renderer?.unmount());
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
    root = await render(<SpacePage />);
    const button = root.find((n) => n.type === 'button' && n.props['data-testid'] === 'family-moves');
    expect(textOf(button)).toBe(t.entry.cta);
    expect(root.findAll((n) => n.type === 'a' && n.props.href === '/parent/space/transfers?id=space%3Af')).toHaveLength(1);
  });
});
