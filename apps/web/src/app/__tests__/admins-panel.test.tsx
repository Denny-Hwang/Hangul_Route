import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminRow, AdminsView, ApiResult } from '@/lib/console/api';
import type { ConfirmAsk } from '@/components/console/ConfirmSheet';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 (row SA-4; wireframe console/admins-panel, mock admins-panel.html): the
 * Administrators panel of the school page for its owner and for an administrator. The owner sees each admin's verified
 * email, the new-admin notice, Invite (step-up, then the one-time link box), open invites with Revoke, Remove and the
 * history; an administrator sees the list and Stop being an administrator. A 404, 403 or 409 reloads the panel; only a
 * network failure or a 5xx says actionFailed. The link lives in the panel's state only. react-test-renderer, no DOM.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

// Step-up: the reverification runs the request once more (Clerk's own UI is not part of this test).
const auth = vi.hoisted(() => ({ reverified: 0, cancel: false }));
vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({
    reverify: async <T,>(fetcher: () => Promise<T>) => {
      auth.reverified += 1;
      if (auth.cancel) return { kind: 'cancelled' };
      return { kind: 'result', result: await fetcher() };
    },
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

import { AdminsPanel } from '@/components/console/AdminsPanel';

const m = getMessages('en');
const a = m.console.admins;
const TOKEN = 'A'.repeat(20) + 'b_-9' + 'z'.repeat(19);
const URL_ = `https://app.hangulroute.com/account/invite#t=${TOKEN}`;
const NOW = new Date('2026-10-20T15:00:00.000Z');
const SCHOOL = { id: 'space:maple', name: 'Maple School', archivedAt: null as string | null };
const LEE: AdminRow = { accountId: 'mr-lee', name: 'Mr Lee', email: 'lee@example.org', joinedAt: '2026-10-03T10:00:00.000Z', staysTeacher: true };
const CHO: AdminRow = { accountId: 'dr-cho', name: 'Dr Cho', email: 'cho@example.org', joinedAt: '2026-10-18T10:00:00.000Z', staysTeacher: false };

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const fail = (status: number, code?: string): ApiResult<never> => ({ ok: false, error: 'unknown', status, ...(code ? { code } : {}) });
const HINT = { ok: false as const, error: 'forbidden' as const, status: 403, code: 'reverify_required', clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: {} } };

function ownerView(admins: AdminRow[], invites = 0, events: AdminsView['events'] = []): AdminsView {
  return {
    owner: { accountId: 'ms-park', name: 'Ms Park' },
    admins,
    limit: 2,
    invites: Array.from({ length: invites }, (_, i) => ({ id: `invite:${i}`, createdAt: '2026-10-18T09:00:00.000Z', expiresAt: '2026-10-25T09:00:00.000Z' })),
    events,
  };
}
const adminView = (admins: AdminRow[]): AdminsView => ({ owner: { accountId: 'ms-park', name: 'Ms Park' }, admins: admins.map(({ email: _email, ...rest }) => rest), limit: 2 });

const calls = vi.hoisted(() => ({ list: [] as string[] }));
const answers = vi.hoisted(() => ({
  admins: [] as Array<ApiResult<AdminsView>>,
  create: [] as Array<ApiResult<unknown>>,
  revoke: null as ApiResult<unknown> | null,
  remove: null as ApiResult<unknown> | null,
  leave: null as ApiResult<unknown> | null,
}));
let lastView: ApiResult<AdminsView> = ok(ownerView([]));
const api = {
  admins: async () => {
    calls.list.push('admins');
    lastView = answers.admins.shift() ?? lastView;
    return lastView;
  },
  createAdminInvite: async () => {
    calls.list.push('create');
    return answers.create.shift() ?? fail(500);
  },
  revokeAdminInvite: async (_s: string, id: string) => {
    calls.list.push(`revoke:${id}`);
    return answers.revoke ?? ok({ revoked: true });
  },
  removeAdmin: async (_s: string, id: string) => {
    calls.list.push(`remove:${id}`);
    return answers.remove ?? ok({ removed: true, stays: 'teacher' });
  },
  leaveAdmin: async () => {
    calls.list.push('leave');
    return answers.leave ?? ok({ left: true, stays: 'teacher' });
  },
};

const asks: ConfirmAsk[] = [];
let answerYes = true;
const confirm = async (ask: ConfirmAsk): Promise<boolean> => {
  asks.push(ask);
  return answerYes;
};
const left: string[] = [];

function memory(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    length: 0,
    clear: () => data.clear(),
    key: () => null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } as Storage & { data: Map<string, string> };
}
let session = memory();
let local = memory();
const clipboard: string[] = [];
let clipboardFails = false;

const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const one = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const found = byTestId(root, id);
  expect(found, id).toHaveLength(1);
  return found[0] as ReactTestInstance;
};
const focused: string[] = [];
const nodeMock = (el: { type: unknown; props: Record<string, unknown> }) => ({ focus: () => focused.push(String(el.props['data-testid'] ?? el.type)) });

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  session = memory();
  local = memory();
  vi.stubGlobal('window', { sessionStorage: session, localStorage: local });
  vi.stubGlobal('navigator', {
    clipboard: {
      writeText: async (text: string) => {
        if (clipboardFails) throw new Error('no clipboard');
        clipboard.push(text);
      },
    },
  });
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllGlobals();
  calls.list.length = 0;
  Object.assign(answers, { admins: [], create: [], revoke: null, remove: null, leave: null });
  lastView = ok(ownerView([]));
  asks.length = 0;
  answerYes = true;
  left.length = 0;
  clipboard.length = 0;
  clipboardFails = false;
  focused.length = 0;
  auth.reverified = 0;
  auth.cancel = false;
  SCHOOL.archivedAt = null;
});

async function render(accountId: string, first: ApiResult<AdminsView>): Promise<ReactTestInstance> {
  answers.admins.unshift(first);
  await act(async () => {
    mounted = create(<AdminsPanel api={api as never} school={SCHOOL} accountId={accountId} confirm={confirm} onLeave={(href) => left.push(href)} now={() => NOW} />, { createNodeMock: nodeMock });
  });
  return (mounted as unknown as ReactTestRenderer).root;
}
const press = async (root: ReactTestInstance, id: string, index = 0): Promise<void> => {
  await act(async () => (byTestId(root, id)[index] as ReactTestInstance).props.onClick());
};
const allText = (root: ReactTestInstance): string => textOf(root);

describe('the owner', () => {
  it('sees the owner, each admin with the join day and the verified email, the count, about and Invite', async () => {
    const root = await render('ms-park', ok(ownerView([LEE])));
    expect(textOf(one(root, 'admins-owner-row'))).toBe('Ms Park · owner');
    expect(byTestId(root, 'admins-admin-row').map(textOf)).toEqual(['Mr Lee · admin · joined Oct 3lee@example.orgRemove']);
    expect(textOf(one(root, 'admins-count'))).toBe('1 of 2 added');
    expect(allText(root)).toContain('A school can have 2 administrators besides its owner.');
    expect(one(root, 'admins-remove').props['aria-label']).toBe('Remove Mr Lee');
    expect(textOf(one(root, 'admins-invite'))).toBe(a.invite.cta);
    expect(byTestId(root, 'admins-full')).toHaveLength(0);
    expect(byTestId(root, 'admins-leave')).toHaveLength(0);
    // History is hidden while it has no line.
    expect(byTestId(root, 'admins-history')).toHaveLength(0);
  });

  it('an open invite holds a place: the invite row with Revoke and the full line, no Invite (D12)', async () => {
    const root = await render('ms-park', ok(ownerView([LEE], 1)));
    expect(textOf(one(root, 'admins-open-invite'))).toBe('Invite made Oct 18 · ends Oct 25, 2026Revoke');
    expect(textOf(one(root, 'admins-full'))).toBe(a.full(2));
    expect(byTestId(root, 'admins-invite')).toHaveLength(0);
    expect(textOf(one(root, 'admins-count'))).toBe('1 of 2 added');
  });

  it('the history: newest first, a missing account as "A former member", never an id', async () => {
    const events = [
      { kind: 'admin_joined', at: '2026-10-03T10:00:00.000Z', actorName: 'Mr Lee', subjectName: 'Mr Lee' },
      { kind: 'class_renamed', at: '2026-10-19T10:00:00.000Z', actorName: 'Ms Park', subjectName: null },
      { kind: 'admin_left', at: '2026-09-28T10:00:00.000Z', actorName: null, subjectName: null },
    ];
    const root = await render('ms-park', ok(ownerView([LEE], 0, events)));
    const history = one(root, 'admins-history');
    expect(history.type).toBe('details');
    expect(history.props.open).toBeUndefined();
    expect(history.findAll((n) => n.type === 'li').map(textOf)).toEqual([
      'Ms Park renamed a class · Oct 19',
      'Mr Lee joined as an administrator · Oct 3',
      'A former member stopped being an administrator · Sep 28',
    ]);
  });

  it('the new-admin notice for 7 days: Remove opens the remove sheet, Got it hides it in this browser', async () => {
    const root = await render('ms-park', ok(ownerView([LEE, CHO])));
    const notice = one(root, 'admins-new-notice');
    expect(textOf(notice)).toContain('New administrator: Dr Cho (cho@example.org). If this is not the person you invited, remove them.');
    expect(one(root, 'admins-new-notice-remove').props['aria-label']).toBe('Remove Dr Cho');
    answerYes = false;
    await press(root, 'admins-new-notice-remove');
    expect(asks[0]).toEqual({ title: 'Remove Dr Cho as an administrator of Maple School?', message: a.removeNote.leaves, confirmLabel: a.remove.cta });
    await press(root, 'admins-new-notice-dismiss');
    expect(byTestId(root, 'admins-new-notice')).toHaveLength(0);
    const stored = local.data.get('hr:admin-notice-seen') ?? '';
    expect(stored).toContain('dr-cho@');
    expect(stored).not.toContain('Cho');
    // Remembered: a fresh panel shows no notice.
    act(() => mounted?.unmount());
    const again = await render('ms-park', ok(ownerView([LEE, CHO])));
    expect(byTestId(again, 'admins-new-notice')).toHaveLength(0);
  });

  it('Invite: step-up first with the admin lines, then the one-time box; Copy, then Close hides the link for good', async () => {
    answers.create.push(HINT, ok({ invite: { id: 'invite:new', createdAt: '2026-10-20T15:00:00.000Z', expiresAt: '2026-10-27T15:00:00.000Z' }, url: URL_ }));
    answers.admins.push(ok(ownerView([LEE], 1)));
    const root = await render('ms-park', ok(ownerView([LEE])));
    await press(root, 'admins-invite');
    const dialog = one(root, 'step-up');
    expect(textOf(dialog)).toContain(a.invite.stepUp.body);
    expect(textOf(dialog)).toContain(a.invite.stepUp.reason);
    expect(textOf(dialog)).not.toContain(m.console.billing.stepUp.body);
    await act(async () => dialog.findAll((n) => n.type === 'button')[0]?.props.onClick());
    expect(auth.reverified).toBe(1);
    expect(byTestId(root, 'step-up')).toHaveLength(0);
    const box = one(root, 'admins-invite-box');
    expect(textOf(one(root, 'admins-invite-url'))).toBe(URL_);
    expect(textOf(box)).toContain(a.invite.warning);
    expect(textOf(box)).toContain('It works once and ends on Oct 27, 2026. It is shown only now: copy it before you close this.');
    expect(box.props.role).toBe('group');
    expect(focused).toContain('admins-invite-box');
    // The link is in the box only: the rest of the panel and every label are free of the token.
    const outside = root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] !== 'admins-invite-url' && typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
    expect(outside.some((label) => label.includes(TOKEN))).toBe(false);
    expect(byTestId(root, 'admins-full')).toHaveLength(1);
    await press(root, 'admins-invite-copy');
    expect(clipboard).toEqual([URL_]);
    expect(textOf(one(root, 'admins-invite-status'))).toBe(a.invite.copied);
    focused.length = 0;
    await press(root, 'admins-invite-close');
    expect(byTestId(root, 'admins-invite-box')).toHaveLength(0);
    expect(allText(root)).not.toContain(TOKEN);
    expect(session.data.size + local.data.size).toBe(0);
  });

  it('a failed copy says to select the link; a cancelled step-up says nothing was changed; any other failure says so', async () => {
    answers.create.push(ok({ invite: { id: 'invite:new', createdAt: '2026-10-20T15:00:00.000Z', expiresAt: '2026-10-27T15:00:00.000Z' }, url: URL_ }));
    let root = await render('ms-park', ok(ownerView([])));
    await press(root, 'admins-invite');
    clipboardFails = true;
    await press(root, 'admins-invite-copy');
    expect(textOf(one(root, 'admins-invite-status'))).toBe(a.invite.copyFailed);
    act(() => mounted?.unmount());

    auth.cancel = true;
    answers.create.push(HINT);
    root = await render('ms-park', ok(ownerView([])));
    await press(root, 'admins-invite');
    await act(async () => one(root, 'step-up').findAll((n) => n.type === 'button')[0]?.props.onClick());
    expect(textOf(one(root, 'admins-status'))).toBe(m.console.billing.stepUp.cancelled);
    act(() => mounted?.unmount());

    answers.create.push(fail(500));
    root = await render('ms-park', ok(ownerView([])));
    await press(root, 'admins-invite');
    expect(textOf(one(root, 'admins-status'))).toBe(a.invite.failed);
  });

  it('admins_full from another tab reloads the panel, which then shows the full line', async () => {
    answers.create.push(fail(409, 'admins_full'));
    answers.admins.push(ok(ownerView([LEE, CHO])));
    const root = await render('ms-park', ok(ownerView([LEE])));
    await press(root, 'admins-invite');
    expect(calls.list.filter((c) => c === 'admins')).toHaveLength(2);
    expect(byTestId(root, 'admins-full')).toHaveLength(1);
    expect(textOf(one(root, 'admins-status'))).toBe('');
  });

  it('Revoke asks with Revoke and Keep it, then says the link no longer works', async () => {
    answers.admins.push(ok(ownerView([LEE])));
    const root = await render('ms-park', ok(ownerView([LEE], 1)));
    await press(root, 'admins-revoke');
    expect(asks[0]).toEqual({ title: a.revokeAsk, confirmLabel: 'Revoke', cancelLabel: 'Keep it' });
    expect(calls.list).toContain('revoke:invite:0');
    expect(textOf(one(root, 'admins-status'))).toBe(a.revoked);
    expect(byTestId(root, 'admins-open-invite')).toHaveLength(0);
  });

  it('Remove says whether they stay a teacher, then names who is no longer an administrator', async () => {
    answers.admins.push(ok(ownerView([CHO])));
    const root = await render('ms-park', ok(ownerView([LEE, CHO])));
    await press(root, 'admins-remove', 0);
    expect(asks[0]).toEqual({ title: 'Remove Mr Lee as an administrator of Maple School?', message: a.removeNote.staysTeacher, confirmLabel: 'Remove' });
    expect(calls.list).toContain('remove:mr-lee');
    expect(textOf(one(root, 'admins-status'))).toBe('Mr Lee is no longer an administrator.');
    expect(focused).toContain('admins-invite');
  });

  it('a 404, 403 or 409 reloads the panel (focus on its heading); a network failure or a 5xx says actionFailed', async () => {
    for (const status of [404, 403, 409]) {
      answers.remove = fail(status);
      answers.admins.push(ok(ownerView([LEE])));
      const root = await render('ms-park', ok(ownerView([LEE])));
      await press(root, 'admins-remove');
      expect(textOf(one(root, 'admins-status'))).toBe('');
      expect(calls.list.filter((c) => c === 'admins')).toHaveLength(2);
      expect(focused).toContain('h2');
      act(() => mounted?.unmount());
      calls.list.length = 0;
      focused.length = 0;
    }
    for (const status of [-1, 503]) {
      answers.revoke = fail(status);
      const root = await render('ms-park', ok(ownerView([LEE], 1)));
      await press(root, 'admins-revoke');
      expect(textOf(one(root, 'admins-status'))).toBe(a.actionFailed);
      expect(byTestId(root, 'admins-open-invite')).toHaveLength(1);
      act(() => mounted?.unmount());
    }
  });

  it('a dismissed sheet changes nothing', async () => {
    answerYes = false;
    const root = await render('ms-park', ok(ownerView([LEE], 1)));
    await press(root, 'admins-revoke');
    await press(root, 'admins-remove');
    expect(calls.list).toEqual(['admins']);
  });

  it('on an archived school Invite is hidden, Remove and Revoke stay', async () => {
    SCHOOL.archivedAt = '2026-10-19T00:00:00.000Z';
    const root = await render('ms-park', ok(ownerView([LEE], 1)));
    expect(byTestId(root, 'admins-invite')).toHaveLength(0);
    expect(byTestId(root, 'admins-full')).toHaveLength(0);
    expect(byTestId(root, 'admins-remove')).toHaveLength(1);
    expect(byTestId(root, 'admins-revoke')).toHaveLength(1);
  });

  it('a failed load says it cannot reach the console, with Try again; loading draws two grey lines', async () => {
    answers.admins.push(ok(ownerView([LEE])));
    const root = await render('ms-park', fail(-1));
    expect(allText(root)).toContain(m.console.cantReach);
    await press(root, 'admins-retry');
    expect(byTestId(root, 'admins-admin-row')).toHaveLength(1);
  });
});

describe('an administrator', () => {
  it('sees the list without emails or buttons, about, and Stop being an administrator; no invites, no history', async () => {
    const root = await render('mr-lee', ok(adminView([LEE, CHO])));
    expect(byTestId(root, 'admins-admin-row').map(textOf)).toEqual(['Mr Lee · admin · joined Oct 3', 'Dr Cho · admin · joined Oct 18']);
    expect(byTestId(root, 'admins-email')).toHaveLength(0);
    expect(byTestId(root, 'admins-remove')).toHaveLength(0);
    expect(byTestId(root, 'admins-invite')).toHaveLength(0);
    expect(byTestId(root, 'admins-full')).toHaveLength(0);
    expect(byTestId(root, 'admins-new-notice')).toHaveLength(0);
    expect(byTestId(root, 'admins-history')).toHaveLength(0);
    expect(allText(root)).not.toContain('@example.org');
    expect(textOf(one(root, 'admins-leave'))).toBe(a.leave.cta);
    // Their own row is marked by its fill, with the same words.
    expect(byTestId(root, 'admins-admin-row')[0]?.props.className).toContain('hr-adm-you');
  });

  it('Stop, staying a teacher: the teacher home, the notice from the flash, no name in the address', async () => {
    const root = await render('mr-lee', ok(adminView([LEE])));
    await press(root, 'admins-leave');
    expect(asks[0]).toEqual({ title: 'Stop being an administrator of Maple School?', message: a.leaveNote.staysTeacher, confirmLabel: a.leave.cta });
    expect(left).toEqual(['/teach/home']);
    expect(JSON.parse(session.data.get('hr:console-flash') ?? '')).toEqual({ kind: 'adminLeft', school: 'Maple School' });
    expect(left.join()).not.toContain('Maple');
  });

  it('Stop, leaving the school: the router home', async () => {
    answers.leave = ok({ left: true, stays: 'none' });
    const root = await render('dr-cho', ok(adminView([CHO])));
    await press(root, 'admins-leave');
    expect(asks[0]?.message).toBe(a.leaveNote.leaves);
    expect(left).toEqual(['/teach']);
  });

  it('a reload that shows the role gone sends the viewer to their grown-up home', async () => {
    answers.leave = fail(403);
    answers.admins.push(ok(adminView([LEE])));
    const root = await render('dr-cho', ok(adminView([LEE, CHO])));
    await press(root, 'admins-leave');
    expect(left).toEqual(['/teach']);
    expect(session.data.has('hr:console-flash')).toBe(false);
  });

  it('a network failure on Stop says actionFailed and stays', async () => {
    answers.leave = fail(-1);
    const root = await render('mr-lee', ok(adminView([LEE])));
    await press(root, 'admins-leave');
    expect(textOf(one(root, 'admins-status'))).toBe(a.actionFailed);
    expect(left).toEqual([]);
  });
});
