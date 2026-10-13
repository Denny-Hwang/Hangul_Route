import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NoteSender, NotesFailure } from '@/lib/console/notes';

/**
 * F-FEEDBACK-001 FB-12, panel D on the family settings page (`console/family-notes.md` D, OD-17, rule 8.2-b): the
 * family's adults with a **Can send notes** switch per caregiver, named by the person; the owner turns them, other
 * caregivers read the same list with the switches disabled. Behind the notes flag, on a family only.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Af1'),
}));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

const state = vi.hoisted(() => ({ kind: 'family' as string, viewer: 'acct:owner' }));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    roster: async () => ({
      ok: true,
      data: {
        space: { id: 'space:f1', kind: state.kind, name: 'Kim family', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
        learners: [],
        joinCode: 'K7PM4Q',
        joinCodeExpiresAt: '2026-11-01T00:00:00.000Z',
      },
    }),
    members: async () => ({
      ok: true,
      data: [{ memberKind: 'account', memberId: 'acct:owner', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Ji-woo Kim', isOwner: true }],
    }),
    transferRequests: async () => ({ ok: true, data: { requests: [], options: [] } }),
    // The archive confirm's plan read (F-BILL-002 B-12): not part of panel D.
    billingSummary: async () => ({ ok: false, error: 'network', status: -1 }),
  };
  return { useConsole: () => ({ ready: true, session: { accountId: state.viewer, displayName: 'x' }, api, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});

type Answer<T> = { ok: true; data: T } | { ok: false; failure: NotesFailure };
const SENDERS: NoteSender[] = [
  { accountId: 'acct:owner', name: 'Ji-woo Kim', isOwner: true, canSend: true },
  { accountId: 'acct:grandma', name: 'grandma.park@example.com', isOwner: false, canSend: true },
  { accountId: 'acct:minho', name: 'Min-ho Kim', isOwner: false, canSend: false },
];
let read: Answer<NoteSender[]>[] = [];
let put: Answer<Record<string, unknown>> = { ok: true, data: {} };
const calls: Array<{ name: string; args: unknown[] }> = [];
const notesApi = {
  noteSenders: async (...args: unknown[]) => {
    calls.push({ name: 'noteSenders', args });
    return read.shift() ?? { ok: true as const, data: SENDERS };
  },
  setNoteSender: async (...args: unknown[]) => {
    calls.push({ name: 'setNoteSender', args });
    return put;
  },
};
vi.mock('@/components/console/use-notes-api', () => ({ useNotesApi: () => notesApi }));

import SettingsPage from '@/app/(console)/teach/space/settings/page';

const en = getMessages('en');
const s = en.console.notes.family.senders;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllEnvs();
  state.kind = 'family';
  state.viewer = 'acct:owner';
  read = [];
  put = { ok: true, data: {} };
  calls.length = 0;
});

async function renderPage(): Promise<ReactTestInstance> {
  await act(async () => {
    renderer = create(<SettingsPage />);
  });
  await act(async () => undefined);
  return (renderer as ReactTestRenderer).root;
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}
const panel = (root: ReactTestInstance) => root.findAll((n) => n.props['data-testid'] === 'note-senders' && n.type === 'section')[0];
const switches = (root: ReactTestInstance) => root.findAll((n) => n.type === 'button' && n.props.role === 'switch');
const nameOfSwitch = (root: ReactTestInstance, sw: ReactTestInstance): string =>
  String(sw.props['aria-labelledby'])
    .split(' ')
    .map((id) => textOf(root.findAll((n) => typeof n.type === 'string' && n.props.id === id)[0] as ReactTestInstance))
    .join(' ');

describe('panel D: Can send notes (FB-12)', () => {
  it('not shown while the notes flag is off, and never on a class', async () => {
    let root = await renderPage();
    expect(panel(root)).toBeUndefined();
    expect(calls).toHaveLength(0);
    act(() => renderer?.unmount());
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    state.kind = 'class';
    root = await renderPage();
    expect(panel(root)).toBeUndefined();
  });

  it('the owner: their own row always sends; one switch per caregiver named by the person; the line under the list; before the Danger zone', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    const root = await renderPage();
    const section = panel(root) as ReactTestInstance;
    const all = textOf(section);
    expect(all).toContain(s.title);
    expect(all).toContain(s.you('Ji-woo Kim'));
    expect(all).toContain(s.always);
    expect(all).toContain(s.line);
    const sw = switches(root);
    expect(sw.map((x) => [nameOfSwitch(root, x), x.props['aria-checked'], !!x.props.disabled])).toEqual([
      [`grandma.park@example.com ${s.canSend}`, true, false],
      [`Min-ho Kim ${s.canSend}`, false, false],
    ]);
    // Panel D sits between the learners and the Danger zone.
    const sections = root.findAll((n) => n.type === 'section').map((n) => n.props['aria-label'] ?? n.props['data-testid']);
    expect(sections.indexOf('note-senders')).toBe(sections.indexOf(en.console.settings.danger.title) - 1);
  });

  it('a switch turns at once and saves; a refusal snaps it back with the line', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    const root = await renderPage();
    await act(async () => switches(root)[1]?.props.onClick());
    expect(calls.filter((c) => c.name === 'setNoteSender')[0]?.args).toEqual(['space:f1', 'acct:minho', true]);
    expect(switches(root)[1]?.props['aria-checked']).toBe(true);
    put = { ok: false, failure: { status: 500, code: null, details: null } };
    await act(async () => switches(root)[0]?.props.onClick());
    expect(switches(root)[0]?.props['aria-checked']).toBe(true);
    expect(root.findAll((n) => n.props.role === 'alert').map((n) => textOf(n))).toEqual([en.console.notes.family.saveFailed]);
  });

  it('another caregiver: the same list read-only, their own row marked', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    state.viewer = 'acct:minho';
    const root = await renderPage();
    expect(switches(root).map((x) => !!x.props.disabled)).toEqual([true, true]);
    expect(textOf(panel(root) as ReactTestInstance)).toContain(s.you('Min-ho Kim'));
    expect(textOf(panel(root) as ReactTestInstance)).not.toContain(s.you('Ji-woo Kim'));
  });

  it('a list that could not load says so, and Try again reads it again', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'true');
    read = [{ ok: false, failure: { status: 500, code: null, details: null } }];
    const root = await renderPage();
    expect(textOf(panel(root) as ReactTestInstance)).toContain(en.console.notes.family.error);
    await act(async () => root.findAll((n) => n.type === 'button' && textOf(n) === en.console.notes.family.retry.cta)[0]?.props.onClick());
    expect(switches(root)).toHaveLength(2);
  });
});
