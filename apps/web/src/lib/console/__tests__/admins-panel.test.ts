import { describe, expect, it } from 'vitest';
import type { AdminRow, AdminsView } from '../api';
import {
  ADMIN_NOTICE_SEEN_KEY,
  NEW_ADMIN_NOTICE_MS,
  actionOutcome,
  adminDate,
  adminDay,
  adminName,
  afterLeaving,
  fullShown,
  historyLine,
  historyLines,
  inviteShown,
  newAdminNotices,
  noticeId,
  panelViewer,
  placesTaken,
  readSeenNotices,
  rememberNotice,
} from '../admins-panel';
import type { KeyValueStorage } from '../../i18n/safe-storage';

/** [SA] AMENDMENTS-SEATS-ADMINS section 6.6: the rules of the Administrators panel, without a page. */
const NOW = new Date('2026-10-20T15:00:00.000Z');
const lee: AdminRow = { accountId: 'mr-lee', name: 'Mr Lee', email: 'lee@example.org', joinedAt: '2026-10-03T10:00:00.000Z', staysTeacher: true };
const cho: AdminRow = { accountId: 'dr-cho', name: 'Dr Cho', email: 'cho@example.org', joinedAt: '2026-10-18T10:00:00.000Z', staysTeacher: false };
const view = (admins: AdminRow[], invites: number): AdminsView => ({
  owner: { accountId: 'ms-park', name: 'Ms Park' },
  admins,
  limit: 2,
  invites: Array.from({ length: invites }, (_, i) => ({ id: `invite:${i}`, createdAt: '2026-10-18T00:00:00.000Z', expiresAt: '2026-10-25T00:00:00.000Z' })),
  events: [],
});

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('who sees what', () => {
  it('the owner, an administrator, or neither', () => {
    expect(panelViewer(view([lee], 0), 'ms-park')).toBe('owner');
    expect(panelViewer(view([lee], 0), 'mr-lee')).toBe('admin');
    expect(panelViewer(view([lee], 0), 'ms-han')).toBe('none');
  });

  it('an open invite holds a place; Invite shows while places are free, the full line once they are not (D12)', () => {
    expect(placesTaken(view([lee], 1))).toBe(2);
    expect(inviteShown(view([], 0), 'owner', false)).toBe(true);
    expect(inviteShown(view([lee], 0), 'owner', false)).toBe(true);
    expect(inviteShown(view([lee], 1), 'owner', false)).toBe(false);
    expect(fullShown(view([lee], 1), 'owner', false)).toBe(true);
    expect(fullShown(view([lee, cho], 0), 'owner', false)).toBe(true);
    expect(inviteShown(view([], 0), 'admin', false)).toBe(false);
    expect(fullShown(view([lee, cho], 0), 'admin', false)).toBe(false);
  });

  it('an archived school hides Invite and the full line (422 archived); nothing else changes here', () => {
    expect(inviteShown(view([], 0), 'owner', true)).toBe(false);
    expect(fullShown(view([lee, cho], 0), 'owner', true)).toBe(false);
  });
});

describe('the new-admin notice (section 6.3 item 3)', () => {
  it('shows for 7 days after an administrator joined, to the owner only, until Got it', () => {
    expect(newAdminNotices([lee, cho], 'owner', NOW, new Set()).map((a) => a.accountId)).toEqual(['dr-cho']);
    expect(newAdminNotices([lee, cho], 'admin', NOW, new Set())).toEqual([]);
    expect(newAdminNotices([cho], 'owner', NOW, new Set([noticeId(cho)]))).toEqual([]);
    expect(newAdminNotices([cho], 'owner', new Date(Date.parse(cho.joinedAt) + NEW_ADMIN_NOTICE_MS), new Set())).toEqual([]);
    expect(newAdminNotices([cho], 'owner', new Date(Date.parse(cho.joinedAt) - 1), new Set())).toEqual([]);
    // No verified email to check: no notice (the owner reads the email on the notice).
    expect(newAdminNotices([{ ...cho, email: null }], 'owner', NOW, new Set())).toEqual([]);
  });

  it('Got it is remembered per browser by an id (account and joining time), never a name or an email', () => {
    const storage = memory();
    expect(readSeenNotices(storage).size).toBe(0);
    const seen = rememberNotice(noticeId(cho), storage);
    expect(seen.has('dr-cho@2026-10-18T10:00:00.000Z')).toBe(true);
    const raw = storage.data.get(ADMIN_NOTICE_SEEN_KEY) ?? '';
    expect(raw).not.toContain('Cho');
    expect(raw).not.toContain('@example');
    for (let i = 0; i < 25; i += 1) rememberNotice(`a${i}@t`, storage);
    expect(readSeenNotices(storage).size).toBe(20);
    storage.setItem(ADMIN_NOTICE_SEEN_KEY, '{');
    expect(readSeenNotices(storage).size).toBe(0);
    storage.setItem(ADMIN_NOTICE_SEEN_KEY, JSON.stringify([1, 'x']));
    expect([...readSeenNotices(storage)]).toEqual(['x']);
  });
});

describe('names, days and history lines', () => {
  it('a missing name reads "A former member", never an id', () => {
    expect(adminName(null)).toBe('A former member');
    expect(adminName('')).toBe('A former member');
    expect(adminName(undefined, 'ko')).toBe('이전 구성원');
    expect(adminName('Mr Lee')).toBe('Mr Lee');
  });

  it('days and dates in the console language', () => {
    expect(adminDay('2026-10-03T10:00:00.000Z')).toBe('Oct 3');
    expect(adminDate('2026-10-25T10:00:00.000Z')).toBe('Oct 25, 2026');
  });

  it('one line per kind, the administrator named for joined, removed and left; unknown kinds left out', () => {
    const e = (kind: string, actorName: string | null, subjectName: string | null = null) => ({ kind, at: '2026-10-19T10:00:00.000Z', actorName, subjectName });
    expect(historyLine(e('class_renamed', 'Ms Park'))).toBe('Ms Park renamed a class · Oct 19');
    expect(historyLine(e('renamed', 'Mr Lee'))).toBe('Mr Lee renamed the school · Oct 19');
    expect(historyLine(e('admin_joined', 'Dr Cho', 'Dr Cho'))).toBe('Dr Cho joined as an administrator · Oct 19');
    expect(historyLine(e('admin_invite_created', 'Ms Park'))).toBe('Ms Park made an invite · Oct 19');
    expect(historyLine(e('admin_invite_revoked', 'Ms Park'))).toBe('Ms Park revoked an invite · Oct 19');
    expect(historyLine(e('admin_removed', 'Ms Park', 'Mr Lee'))).toBe('Mr Lee was removed as an administrator · Oct 19');
    expect(historyLine(e('admin_removed', 'Ms Park', null))).toBe('A former member was removed as an administrator · Oct 19');
    expect(historyLine(e('admin_left', null, null))).toBe('A former member stopped being an administrator · Oct 19');
    expect(historyLine(e('something_new', 'Ms Park'))).toBeNull();
    expect(historyLine({ ...e('renamed', 'Ms Park'), at: 'not a date' })).toBeNull();
  });

  it('newest first, at most 20', () => {
    const events = Array.from({ length: 25 }, (_, i) => ({ kind: 'renamed', at: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, actorName: `P${i + 1}`, subjectName: null }));
    const lines = historyLines(events);
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('P25 renamed the school · Sep 25');
    expect(historyLines(undefined)).toEqual([]);
  });
});

describe('what a refused action does', () => {
  it('404, 403 and 409 reload the panel; a network failure or a 5xx says actionFailed', () => {
    expect(actionOutcome({ ok: true, data: {} })).toBe('done');
    for (const status of [404, 403, 409]) expect(actionOutcome({ ok: false, error: 'unknown', status })).toBe('reload');
    for (const status of [-1, 500, 503]) expect(actionOutcome({ ok: false, error: 'unknown', status })).toBe('failed');
  });

  it('Stop lands on the teacher home while they stay a teacher, else on the router', () => {
    expect(afterLeaving('teacher')).toBe('/teach/home');
    expect(afterLeaving('none')).toBe('/teach');
  });
});

describe('reading GET /:id/admins leniently', () => {
  it('keeps the rows this build can show and refuses an answer it cannot read', async () => {
    const { readAdminsView } = await import('../api');
    expect(readAdminsView({ plans: [] })).toBeNull();
    expect(readAdminsView({ owner: { accountId: 1 }, admins: [], limit: 2 })).toBeNull();
    expect(readAdminsView({ owner: { accountId: 'ms-park', name: 'Ms Park' }, admins: 'x', limit: 2 })).toBeNull();
    expect(
      readAdminsView({
        owner: { accountId: 'ms-park', name: null },
        admins: [{ accountId: 'mr-lee', name: 'Mr Lee', email: 'lee@example.org', joinedAt: '2026-10-03T10:00:00.000Z', staysTeacher: true }, { accountId: 2 }, { accountId: 'dr-cho', joinedAt: '2026-10-18T10:00:00.000Z' }],
        limit: 2,
        invites: [{ id: 'invite:1', createdAt: 'a', expiresAt: 'b' }, { id: 3 }],
        events: [{ kind: 'renamed', at: '2026-10-12T00:00:00.000Z', actorName: 'Ms Park', subjectName: null }, { kind: 1 }],
      }),
    ).toEqual({
      ok: true,
      data: {
        owner: { accountId: 'ms-park', name: null },
        admins: [
          { accountId: 'mr-lee', name: 'Mr Lee', email: 'lee@example.org', joinedAt: '2026-10-03T10:00:00.000Z', staysTeacher: true },
          { accountId: 'dr-cho', name: null, joinedAt: '2026-10-18T10:00:00.000Z', staysTeacher: false },
        ],
        limit: 2,
        invites: [{ id: 'invite:1', createdAt: 'a', expiresAt: 'b' }],
        events: [{ kind: 'renamed', at: '2026-10-12T00:00:00.000Z', actorName: 'Ms Park', subjectName: null }],
      },
    });
    // An administrator's answer carries no invites, no events and no email.
    expect(readAdminsView({ owner: { accountId: 'ms-park', name: 'Ms Park' }, admins: [{ accountId: 'mr-lee', name: 'Mr Lee', joinedAt: 'x', staysTeacher: false }], limit: 2 })).toEqual({
      ok: true,
      data: { owner: { accountId: 'ms-park', name: 'Ms Park' }, admins: [{ accountId: 'mr-lee', name: 'Mr Lee', joinedAt: 'x', staysTeacher: false }], limit: 2 },
    });
  });
});
