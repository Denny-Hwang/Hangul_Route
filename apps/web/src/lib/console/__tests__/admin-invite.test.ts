import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_INVITE_STASH_KEY,
  ADMIN_INVITE_STASH_MS,
  acceptAnswer,
  adminInviteLive,
  captureAdminInvite,
  captureAdminInviteHere,
  clearAdminInvite,
  isAdminInvitePath,
  previewAnswer,
  readAdminInvite,
  signUpLanding,
  strippedInviteAddress,
  stripAdminInviteFragmentHere,
} from '../admin-invite';
import { clearGrownUpTab } from '../unlock';
import type { KeyValueStorage } from '../../i18n/safe-storage';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 steps 1 to 8 (row SA-4): the invite token is stashed from the fragment
 * before the gate's redirect, lives 30 minutes in this tab's sessionStorage only, is dropped by every sign-out but
 * Use another account and the lock's re-auth, and the preview and accept answers map to one calm line each.
 */
const TOKEN = 'A'.repeat(20) + 'b_-9' + 'z'.repeat(19);
const NOW = Date.parse('2026-10-20T15:00:00.000Z');

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const at = (pathname: string, hash = '', search = '') => ({ pathname, search, hash });

describe('the stash (step 1)', () => {
  it('stashes a token from the invite page fragment, on every form of the path', () => {
    for (const path of ['/account/invite', '/account/invite/', '/account/invite.html']) {
      const storage = memory();
      expect(isAdminInvitePath(path)).toBe(true);
      expect(captureAdminInvite(at(path, `#t=${TOKEN}`), storage, NOW)).toBe(true);
      expect(JSON.parse(storage.data.get(ADMIN_INVITE_STASH_KEY) ?? '')).toEqual({ token: TOKEN, savedAt: NOW });
      expect(readAdminInvite(storage, NOW)).toBe(TOKEN);
    }
  });

  it('never runs on another path, and a broken token stashes nothing', () => {
    const storage = memory();
    expect(captureAdminInvite(at('/join', `#t=${TOKEN}`), storage, NOW)).toBe(false);
    expect(captureAdminInvite(at('/account/billing', `#t=${TOKEN}`), storage, NOW)).toBe(false);
    expect(captureAdminInvite(at('/account/invitex', `#t=${TOKEN}`), storage, NOW)).toBe(false);
    expect(captureAdminInvite(at('/account/invite', `#t=${TOKEN.slice(1)}`), storage, NOW)).toBe(false);
    expect(captureAdminInvite(at('/account/invite', ''), storage, NOW)).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it('is idempotent and keeps the newest link', () => {
    const storage = memory();
    captureAdminInvite(at('/account/invite', `#t=${TOKEN}`), storage, NOW);
    captureAdminInvite(at('/account/invite', `#t=${TOKEN}`), storage, NOW + 1);
    expect(readAdminInvite(storage, NOW + 1)).toBe(TOKEN);
    expect(storage.data.size).toBe(1);
  });

  it('the address loses its fragment (path and query kept); another page is left alone', () => {
    expect(strippedInviteAddress(at('/account/invite', `#t=${TOKEN}`, '?lang=es'))).toBe('/account/invite?lang=es');
    expect(strippedInviteAddress(at('/account/invite', '#junk'))).toBe('/account/invite');
    expect(strippedInviteAddress(at('/account/invite', ''))).toBeNull();
    expect(strippedInviteAddress(at('/signin', `#t=${TOKEN}`))).toBeNull();
  });
});

describe('the stash in a browser tab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubWindow(pathname: string, hash: string): { storage: ReturnType<typeof memory>; replaced: Array<{ state: unknown; url: string }>; location: { pathname: string; search: string; hash: string } } {
    const storage = memory();
    const replaced: Array<{ state: unknown; url: string }> = [];
    const location = { pathname, search: '', hash };
    vi.stubGlobal('window', {
      location,
      sessionStorage: storage,
      localStorage: memory(),
      history: {
        state: { __NA: true },
        replaceState: (state: unknown, _title: string, url: string) => {
          replaced.push({ state, url });
          const [path] = url.split('#');
          location.pathname = path ?? url;
          location.hash = '';
        },
      },
      setTimeout: (run: () => void) => {
        run();
        return 1;
      },
      clearTimeout: () => undefined,
    });
    return { storage, replaced, location };
  }

  it('captureAdminInviteHere stashes from the live address; the strip then removes the fragment, through the router patch', () => {
    const { storage, replaced } = stubWindow('/account/invite', `#t=${TOKEN}`);
    expect(captureAdminInviteHere()).toBe(true);
    expect(readAdminInvite(storage)).toBe(TOKEN);
    expect(replaced).toEqual([]);
    expect(stripAdminInviteFragmentHere()).toBe(true);
    // A state without `__NA`, so the App Router's patch hears of the new address (its own copy keeps no token).
    expect(replaced).toEqual([{ state: null, url: '/account/invite' }]);
    // Idempotent: nothing left to strip.
    expect(stripAdminInviteFragmentHere()).toBe(false);
    expect(replaced).toHaveLength(1);
  });

  it('the strip leaves another page alone', () => {
    const { replaced } = stubWindow('/signin', `#t=${TOKEN}`);
    expect(stripAdminInviteFragmentHere()).toBe(false);
    expect(replaced).toEqual([]);
  });

  it('with no window, nothing is stashed and nothing is stripped', () => {
    expect(captureAdminInviteHere()).toBe(false);
    expect(stripAdminInviteFragmentHere()).toBe(false);
  });
});

describe('the life of the stash', () => {
  it('lives 30 minutes; an old, corrupt or foreign record is removed', () => {
    const storage = memory();
    captureAdminInvite(at('/account/invite', `#t=${TOKEN}`), storage, NOW);
    expect(adminInviteLive(storage, NOW + ADMIN_INVITE_STASH_MS - 1)).toBe(true);
    expect(readAdminInvite(storage, NOW + ADMIN_INVITE_STASH_MS)).toBeNull();
    expect(storage.data.has(ADMIN_INVITE_STASH_KEY)).toBe(false);
    for (const raw of ['{', 'null', JSON.stringify({ token: 'short', savedAt: NOW }), JSON.stringify({ token: TOKEN }), JSON.stringify({ token: TOKEN, savedAt: NOW + 5 })]) {
      storage.setItem(ADMIN_INVITE_STASH_KEY, raw);
      expect(readAdminInvite(storage, NOW)).toBeNull();
      expect(storage.data.has(ADMIN_INVITE_STASH_KEY)).toBe(false);
    }
    expect(readAdminInvite(null, NOW)).toBeNull();
  });

  it('every sign-out drops it (clearGrownUpTab); Use another account and the lock keep it (keepInvite)', () => {
    const storage = memory();
    captureAdminInvite(at('/account/invite', `#t=${TOKEN}`), storage, Date.now());
    clearGrownUpTab(storage, { keepInvite: true });
    expect(adminInviteLive(storage)).toBe(true);
    clearGrownUpTab(storage);
    expect(adminInviteLive(storage)).toBe(false);
    captureAdminInvite(at('/account/invite', `#t=${TOKEN}`), storage, Date.now());
    clearAdminInvite(storage);
    expect(storage.data.size).toBe(0);
  });

  it('a sign-up lands on the invite page while a stash lives, else where it always did', () => {
    expect(signUpLanding('/start?persona=teacher', true)).toBe('/account/invite');
    expect(signUpLanding('/start?persona=teacher', false)).toBe('/start?persona=teacher');
  });
});

describe('preview and accept answers (steps 6 to 8)', () => {
  const refused = (status: number, code?: string) => ({ ok: false as const, error: 'unknown' as const, status, ...(code ? { code } : {}) });

  it('an open invite shows the school and who invited, or the owner when the name is missing', () => {
    expect(previewAnswer({ ok: true, data: { state: 'open', school: { name: 'Maple School' }, invitedBy: 'Ms Park', expiresAt: '2026-10-27T00:00:00.000Z' } })).toEqual({
      at: 'preview',
      school: 'Maple School',
      invitedBy: 'Ms Park',
      expiresAt: '2026-10-27T00:00:00.000Z',
    });
    expect(previewAnswer({ ok: true, data: { state: 'open', school: { name: 'Maple School' }, invitedBy: null, expiresAt: '2026-10-27T00:00:00.000Z' } })).toMatchObject({ invitedBy: null });
    expect(previewAnswer({ ok: true, data: { state: 'open', school: { name: 'Maple School' }, invitedBy: '', expiresAt: '2026-10-27T00:00:00.000Z' } })).toMatchObject({ invitedBy: null });
    expect(previewAnswer({ ok: true, data: { state: 'already_admin', school: { name: 'Maple School' } } })).toEqual({ at: 'refused', reason: 'alreadyAdmin', school: 'Maple School' });
    // An open answer without its date is not one this build can show.
    expect(previewAnswer({ ok: true, data: { state: 'open', school: { name: 'Maple School' } } })).toEqual({ at: 'retry', reason: 'cantReach' });
  });

  it('every refusal of section 6.4 is one calm line; 429, 503 and the network can be retried', () => {
    const cases: Array<[number, string | undefined, unknown]> = [
      [404, 'invite_not_found', { at: 'refused', reason: 'notFound' }],
      [410, 'invite_used', { at: 'refused', reason: 'used' }],
      [410, 'invite_expired', { at: 'refused', reason: 'expired' }],
      [410, 'invite_revoked', { at: 'refused', reason: 'revoked' }],
      [409, 'already_owner', { at: 'refused', reason: 'owner' }],
      [409, 'admins_full', { at: 'refused', reason: 'full' }],
      [403, 'email_unverified', { at: 'refused', reason: 'emailUnverified' }],
      [429, 'too_many_attempts', { at: 'retry', reason: 'tooMany' }],
      [503, 'identity_not_configured', { at: 'retry', reason: 'cantReach' }],
      [503, 'identity_unavailable', { at: 'retry', reason: 'cantReach' }],
      [-1, undefined, { at: 'retry', reason: 'cantReach' }],
    ];
    for (const [status, code, answer] of cases) {
      expect(previewAnswer(refused(status, code))).toEqual(answer);
      expect(acceptAnswer(refused(status, code))).toEqual(answer);
    }
  });

  it('an accept names the school page to open; already an admin is its own line', () => {
    expect(acceptAnswer({ ok: true, data: { space: { id: 'space:maple', kind: 'school', name: 'Maple School' }, role: 'admin' } })).toEqual({ at: 'accepted', spaceId: 'space:maple', school: 'Maple School' });
    expect(acceptAnswer({ ok: true, data: { state: 'already_admin', school: { name: 'Maple School' }, space: { id: 'space:maple', kind: 'school', name: 'Maple School' }, role: 'admin' } })).toEqual({
      at: 'refused',
      reason: 'alreadyAdmin',
      school: 'Maple School',
    });
    expect(acceptAnswer({ ok: true, data: { state: 'already_admin', space: { id: 'space:maple', kind: 'school', name: 'Maple' }, role: 'admin' } })).toMatchObject({ school: 'Maple' });
  });
});
