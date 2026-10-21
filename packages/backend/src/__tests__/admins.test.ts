import { ADMIN_INVITE_TTL_MS, SCHOOL_ADMIN_CAP, parseAdminInvite } from '@hangul-route/content-schema';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { setIdentityPortForTests, type IdentityPort } from '../lib/identity';
import { ADMIN_INVITE_LIMIT, adminInviteLimiter, newInviteToken } from '../routes/admins';
import { store } from '../store';
import { clerkTestKeys, type ClerkTestKeys } from './helpers/clerk-token';
import { testDb as db } from './helpers/db';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS sections 6.1 to 6.4 and 6.8: school administrators through single-use invite links,
 * the owner-only invite, revoke, remove and history, the admin's own leave, the members route rules at a school and
 * at a class of a school, `canRemove`, the verified-email accept and codes-only telemetry.
 */

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env?: Record<string, string>) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) as Envelope, headers: res.headers };
}
async function createSpace(user: string, kind: string, name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name, ...extra });
  expect(r.status).toBe(201);
  return (r.body.data as { space: { id: string } }).space.id;
}
const person = (id: string, displayName: string | null, email: string | null = null) => db.putAccount({ id, email, displayName, consent: null, createdAt: new Date().toISOString() });
const member = (spaceId: string, accountId: string, role: 'teacher' | 'admin' | 'owner') => db.addMembership({ spaceId, memberKind: 'account', memberId: accountId, role, joinedAt: '2026-09-01T00:00:00.000Z' });
const roleOf = async (spaceId: string, accountId: string) => (await db.membership(spaceId, 'account', accountId))?.role ?? null;
const adminEvents = () => store.events.filter((e) => e.name.startsWith('space.admin.')).map((e) => (e.payload ? { name: e.name, payload: e.payload } : { name: e.name }));

/** Makes an invite through the route and returns its token, read back from the link's fragment. */
async function invite(spaceId: string, user = 'principal'): Promise<{ token: string; id: string; url: string }> {
  const r = await call('POST', `/api/spaces/${spaceId}/admin-invites`, bearer(user));
  expect(r.status).toBe(201);
  const data = r.body.data as { invite: { id: string }; url: string };
  return { token: parseAdminInvite(new URL(data.url).hash) ?? '', id: data.invite.id, url: data.url };
}
/** An invite row written straight to the store, for the states a route cannot reach quickly (an ended one). */
async function seededInvite(spaceId: string, over: { createdAt?: string; expiresAt?: string } = {}): Promise<{ token: string; id: string }> {
  const token = newInviteToken();
  const id = `invite:${crypto.randomUUID()}`;
  const createdAt = over.createdAt ?? new Date().toISOString();
  const expiresAt = over.expiresAt ?? new Date(Date.parse(createdAt) + ADMIN_INVITE_TTL_MS).toISOString();
  expect(await db.createAdminInvite({ invite: { id, spaceId, tokenHash: await hashSecret(token), createdBy: 'principal', createdAt, expiresAt }, cap: 9, eventId: `sev:${id}` })).toBe(true);
  return { token, id };
}
const preview = (user: string, token: unknown, env?: Record<string, string>) => call('POST', '/api/admin-invites/preview', bearer(user), { token }, env);
const accept = (user: string, token: unknown, env?: Record<string, string>) => call('POST', '/api/admin-invites/accept', bearer(user), { token }, env);

let school: string;
beforeEach(async () => {
  await db.reset();
  store.events.length = 0;
  adminInviteLimiter.reset();
  setIdentityPortForTests(null);
  school = await createSpace('principal', 'school', 'Maple School', { displayName: 'Ms Park', email: 'park@example.org' });
  await person('dean', 'Dr Cho', 'cho@example.org');
  await person('vice', 'Mr Lee', 'lee@example.org');
  await person('kim', 'Ms Kim', 'kim@example.org');
  await person('nomail', 'No Mail', null);
});
afterEach(() => setIdentityPortForTests(null));

describe('[SA] POST /api/spaces/:id/admin-invites (section 6.3)', () => {
  it('the owner makes a link with the token in the fragment only; only its hash is stored, and it is shown once', async () => {
    const r = await call('POST', `/api/spaces/${school}/admin-invites`, bearer('principal'));
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const data = r.body.data as { invite: { id: string; createdAt: string; expiresAt: string }; url: string };
    expect(Object.keys(data.invite).sort()).toEqual(['createdAt', 'expiresAt', 'id']);
    expect(Date.parse(data.invite.expiresAt) - Date.parse(data.invite.createdAt)).toBe(ADMIN_INVITE_TTL_MS);
    const url = new URL(data.url);
    expect(url.origin + url.pathname + url.search).toBe('https://app.hangulroute.com/account/invite');
    const token = parseAdminInvite(url.hash) ?? '';
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await db.adminInviteByHash(await hashSecret(token));
    expect(stored).toMatchObject({ id: data.invite.id, spaceId: school, createdBy: 'principal', acceptedAt: null, revokedAt: null });
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(await db.adminInviteByHash(token)).toBeNull();
    expect(JSON.stringify(store.events)).not.toContain(token);
    expect(adminEvents()).toEqual([{ name: 'space.admin.invite_created' }]);
    // the list never carries the token again
    expect((await call('GET', `/api/spaces/${school}/admins`, bearer('principal'))).text).not.toContain(token);
    // two links never share a token
    expect((await invite(school)).token).not.toBe(token);
  });

  it('owner only: an admin, a teacher, a stranger and a signed-out caller are refused', async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'kim', 'teacher');
    for (const user of ['dean', 'kim', 'stranger']) expect((await call('POST', `/api/spaces/${school}/admin-invites`, bearer(user))).status, user).toBe(403);
    expect((await call('POST', `/api/spaces/${school}/admin-invites`, json)).status).toBe(401);
    expect((await call('POST', '/api/spaces/space:nope/admin-invites', bearer('principal'))).status).toBe(404);
  });

  it('not a school (422 not_a_school), archived (422 archived)', async () => {
    const fam = await createSpace('principal', 'family', 'Park family');
    const cls = await createSpace('principal', 'class', 'Room 4');
    for (const id of [fam, cls]) {
      const r = await call('POST', `/api/spaces/${id}/admin-invites`, bearer('principal'));
      expect([r.status, r.body.error?.code]).toEqual([422, 'not_a_school']);
    }
    await call('POST', `/api/spaces/${school}/archive`, bearer('principal'));
    const r = await call('POST', `/api/spaces/${school}/admin-invites`, bearer('principal'));
    expect([r.status, r.body.error?.code]).toEqual([422, 'archived']);
  });

  it('admins_full counts open invites: two open invites, or one admin and one open invite, fill the 2 places', async () => {
    expect(SCHOOL_ADMIN_CAP).toBe(2);
    const first = await invite(school);
    await invite(school);
    const full = await call('POST', `/api/spaces/${school}/admin-invites`, bearer('principal'));
    expect([full.status, full.body.error?.code, full.body.error?.details]).toEqual([409, 'admins_full', { max: 2 }]);
    expect((await call('DELETE', `/api/spaces/${school}/admin-invites/${first.id}`, bearer('principal'))).status).toBe(200);
    await member(school, 'dean', 'admin');
    expect((await call('POST', `/api/spaces/${school}/admin-invites`, bearer('principal'))).body.error?.code).toBe('admins_full');
  });

  describe('step-up with real Clerk session tokens', () => {
    let keys: ClerkTestKeys;
    beforeAll(async () => {
      keys = await clerkTestKeys();
    });
    const env = () => ({ ENVIRONMENT: 'test', CLERK_JWT_KEY: keys.jwtKey });
    const signedIn = async (sub: string, claims: Record<string, unknown>) => ({ ...json, authorization: `Bearer ${await keys.token(sub, claims)}` });

    it("a sign-in older than 10 minutes gets 403 reverify_required with Clerk's body; a fresh one makes the link", async () => {
      for (const claims of [{ fva: [11, -1] }, {}]) {
        const res = await app.request(`/api/spaces/${school}/admin-invites`, { method: 'POST', headers: await signedIn('principal', claims) }, env());
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
          ok: false,
          error: { code: 'reverify_required', message: 'Confirm it is you to continue' },
          meta: { serverTime: expect.any(String), version: expect.any(String) },
        });
      }
      expect(await db.openAdminInvites(school, new Date())).toEqual([]);
      const fresh = await call('POST', `/api/spaces/${school}/admin-invites`, await signedIn('principal', { fva: [2, -1] }), undefined, env());
      expect(fresh.status).toBe(201);
    });

    it('accept on a deployment with only CLERK_JWT_KEY fails closed: 503 identity_not_configured, the invite stays open', async () => {
      const { token, id } = await invite(school);
      const signed = await call('POST', '/api/admin-invites/accept', await signedIn('dean', { fva: [0, -1] }), { token }, env());
      expect([signed.status, signed.body.error?.code]).toEqual([503, 'identity_not_configured']);
      expect((await db.getAdminInvite(id))?.acceptedAt).toBeNull();
    });
  });
});

describe('[SA] DELETE /api/spaces/:id/admin-invites/:inviteId (section 6.4)', () => {
  it('revokes once, answers the same again, refuses an accepted invite with 409 invite_used, and another school with 404', async () => {
    const open = await invite(school);
    expect((await call('DELETE', `/api/spaces/${school}/admin-invites/${open.id}`, bearer('principal'))).body.data).toEqual({ revoked: true });
    expect((await call('DELETE', `/api/spaces/${school}/admin-invites/${open.id}`, bearer('principal'))).body.data).toEqual({ revoked: true });
    expect(adminEvents().filter((e) => e.name === 'space.admin.invite_revoked')).toHaveLength(1);
    expect((await preview('dean', open.token)).body.error?.code).toBe('invite_revoked');
    const used = await invite(school);
    expect((await accept('dean', used.token)).status).toBe(200);
    const late = await call('DELETE', `/api/spaces/${school}/admin-invites/${used.id}`, bearer('principal'));
    expect([late.status, late.body.error?.code]).toEqual([409, 'invite_used']);
    expect((await db.getAdminInvite(used.id))?.revokedAt).toBeNull();
    const other = await createSpace('other', 'school', 'Oak School');
    expect((await call('DELETE', `/api/spaces/${other}/admin-invites/${used.id}`, bearer('other'))).status).toBe(404);
    expect((await call('DELETE', `/api/spaces/${school}/admin-invites/invite:nope`, bearer('principal'))).status).toBe(404);
  });

  it('owner only', async () => {
    const open = await invite(school);
    await member(school, 'vice', 'admin');
    expect((await call('DELETE', `/api/spaces/${school}/admin-invites/${open.id}`, bearer('vice'))).status).toBe(403);
    expect((await db.getAdminInvite(open.id))?.revokedAt).toBeNull();
  });
});

describe('[SA] POST /api/admin-invites/preview (section 6.4)', () => {
  it("open: the school's name, the owner's display name, the end; nothing else, and never an @", async () => {
    const { token, id } = await invite(school);
    const r = await preview('dean', token);
    const row = await db.getAdminInvite(id);
    expect(r.body.data).toEqual({ school: { name: 'Maple School' }, invitedBy: 'Ms Park', expiresAt: row?.expiresAt, state: 'open' });
    expect(r.text).not.toContain('@');
    expect(r.text).not.toContain(school);
  });

  it('an owner with no display name: invitedBy null, never the email; a display name that is an email is not shown', async () => {
    const sch = await createSpace('anon-owner', 'school', 'Elm School', { email: 'anon@example.org' });
    const { token } = await invite(sch, 'anon-owner');
    const r = await preview('dean', token);
    expect(r.body.data).toMatchObject({ invitedBy: null, state: 'open' });
    expect(r.text).not.toContain('@');
    await person('anon-owner', 'anon@example.org', 'anon@example.org');
    expect((await preview('dean', token)).body.data).toMatchObject({ invitedBy: null });
  });

  it('every state: already_admin, not_found, used, expired, revoked, already_owner, admins_full', async () => {
    const { token } = await invite(school);
    await member(school, 'vice', 'admin');
    expect((await preview('vice', token)).body.data).toEqual({ state: 'already_admin', school: { name: 'Maple School' } });
    for (const bad of [newInviteToken(), 'short', 42, null]) {
      const r = await preview('dean', bad);
      expect([r.status, r.body.error?.code], String(bad)).toEqual([404, 'invite_not_found']);
    }
    const owner = await preview('principal', token);
    expect([owner.status, owner.body.error?.code]).toEqual([409, 'already_owner']);
    const ended = await seededInvite(school, { createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-08T00:00:00.000Z' });
    const expired = await preview('dean', ended.token);
    expect([expired.status, expired.body.error?.code]).toEqual([410, 'invite_expired']);
    await member(school, 'kim', 'admin'); // now 2 admins
    const full = await preview('dean', token);
    expect([full.status, full.body.error?.code]).toEqual([409, 'admins_full']);
    await db.removeMembership(school, 'account', 'kim');
    expect((await accept('dean', token)).status).toBe(200);
    const used = await preview('lee-someone', token);
    expect([used.status, used.body.error?.code]).toEqual([410, 'invite_used']);
    // an archived school opens nothing
    const next = await seededInvite(school);
    await call('POST', `/api/spaces/${school}/archive`, bearer('principal'));
    expect((await preview('lee-someone', next.token)).body.error?.code).toBe('invite_not_found');
  });

  it('needs sign-in; 20 per client key per hour, shared with accept', async () => {
    const { token } = await invite(school);
    expect((await call('POST', '/api/admin-invites/preview', json, { token })).status).toBe(401);
    const ip = { ...bearer('dean'), 'cf-connecting-ip': '203.0.113.9' };
    for (let i = 0; i < ADMIN_INVITE_LIMIT - 1; i += 1) expect((await call('POST', '/api/admin-invites/preview', ip, { token })).status).toBe(200);
    expect((await call('POST', '/api/admin-invites/accept', { ...ip, authorization: 'Bearer nomail' }, { token })).status).toBe(403); // the 20th
    const limited = await call('POST', '/api/admin-invites/preview', ip, { token });
    expect([limited.status, limited.body.error?.code]).toEqual([429, 'too_many_attempts']);
    expect((await call('POST', '/api/admin-invites/preview', { ...ip, 'cf-connecting-ip': '203.0.113.10' }, { token })).status).toBe(200);
  });
});

describe('[SA] POST /api/admin-invites/accept (sections 6.3, 6.4)', () => {
  it('a signed-in account with a verified email becomes an admin; the invite is used up', async () => {
    const { token, id } = await invite(school);
    const r = await accept('dean', token);
    expect([r.status, r.body.data]).toEqual([200, { space: { id: school, kind: 'school', name: 'Maple School' }, role: 'admin' }]);
    expect(await roleOf(school, 'dean')).toBe('admin');
    expect(await db.getAdminInvite(id)).toMatchObject({ acceptedBy: 'dean', revokedAt: null });
    expect(adminEvents()).toEqual([{ name: 'space.admin.invite_created' }, { name: 'space.admin.joined' }]);
    // again: already an admin, with the school to open
    expect((await accept('dean', token)).body.data).toMatchObject({ state: 'already_admin', space: { id: school }, role: 'admin' });
    // someone else with the same link
    const used = await accept('vice', token);
    expect([used.status, used.body.error?.code]).toEqual([410, 'invite_used']);
  });

  it('a teacher member of the school becomes an admin; its classes stay its own', async () => {
    await member(school, 'kim', 'teacher');
    const cls = await createSpace('kim', 'class', 'Room 5', { parentSpaceId: school });
    expect((await accept('kim', (await invite(school)).token)).status).toBe(200);
    expect(await roleOf(school, 'kim')).toBe('admin');
    expect(await roleOf(cls, 'kim')).toBe('owner');
  });

  it('an unverified or missing primary email: 403 email_unverified, the invite stays open', async () => {
    const { token, id } = await invite(school);
    const r = await accept('nomail', token); // dev port: no stored email
    expect([r.status, r.body.error?.code]).toEqual([403, 'email_unverified']);
    const port: IdentityPort = { primaryEmail: async (accountId) => ({ email: `${accountId}@example.org`, verified: false }) };
    setIdentityPortForTests(port);
    expect((await accept('dean', token)).body.error?.code).toBe('email_unverified');
    expect((await db.getAdminInvite(id))?.acceptedAt).toBeNull();
    expect(await roleOf(school, 'dean')).toBeNull();
    setIdentityPortForTests({ primaryEmail: async () => null });
    expect((await accept('dean', token)).body.error?.code).toBe('email_unverified');
    setIdentityPortForTests({
      primaryEmail: async () => {
        throw new Error('clerk down');
      },
    });
    const down = await accept('dean', token);
    expect([down.status, down.body.error?.code]).toEqual([503, 'identity_unavailable']);
    expect((await db.getAdminInvite(id))?.acceptedAt).toBeNull(); // a calm retry: the invite stays open
    expect(down.text).not.toContain(token);
    expect(JSON.stringify(adminEvents())).not.toMatch(/@|invite:|sev:/);
    setIdentityPortForTests({ primaryEmail: async (accountId) => ({ email: `${accountId}@example.org`, verified: true }) });
    expect((await accept('dean', token)).status).toBe(200);
    expect(adminEvents().filter((e) => e.name === 'space.admin.accept_refused')).toEqual([
      { name: 'space.admin.accept_refused', payload: { reason: 'email_unverified' } },
      { name: 'space.admin.accept_refused', payload: { reason: 'email_unverified' } },
      { name: 'space.admin.accept_refused', payload: { reason: 'email_unverified' } },
    ]);
  });

  it('every refusal of preview, with codes-only telemetry that never carries an @, a token or an id', async () => {
    const { token } = await invite(school);
    const owner = await accept('principal', token);
    expect([owner.status, owner.body.error?.code]).toEqual([409, 'already_owner']);
    expect((await accept('dean', newInviteToken())).body.error?.code).toBe('invite_not_found');
    const ended = await seededInvite(school, { createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-08T00:00:00.000Z' });
    expect((await accept('dean', ended.token)).body.error?.code).toBe('invite_expired');
    const revoked = await seededInvite(school);
    await call('DELETE', `/api/spaces/${school}/admin-invites/${revoked.id}`, bearer('principal'));
    expect((await accept('dean', revoked.token)).body.error?.code).toBe('invite_revoked');
    await member(school, 'vice', 'admin');
    await member(school, 'kim', 'admin');
    const full = await accept('dean', token);
    expect([full.status, full.body.error?.code]).toEqual([409, 'admins_full']);
    expect(await roleOf(school, 'dean')).toBeNull();
    await db.removeMembership(school, 'account', 'kim');
    await accept('dean', token);
    expect((await accept('kim', token)).body.error?.code).toBe('invite_used');
    expect(store.events.filter((e) => e.name === 'space.admin.accept_refused').map((e) => e.payload?.reason)).toEqual(['owner', 'not_found', 'expired', 'revoked', 'full', 'used']);
    const telemetry = JSON.stringify(store.events);
    expect(telemetry).not.toContain('@');
    expect(telemetry).not.toContain(token);
    expect(telemetry).not.toContain(school);
    expect(telemetry).not.toMatch(/dean|principal|invite:/);
  });

  it('signed-out: 401', async () => {
    const { token } = await invite(school);
    expect((await call('POST', '/api/admin-invites/accept', json, { token })).status).toBe(401);
  });
});

describe('[SA] GET /api/spaces/:id/admins (section 6.4)', () => {
  // Each step a second apart, so "newest first" and "joined at" have one order.
  let clock = Date.parse('2026-10-20T09:00:00.000Z');
  const tick = () => {
    clock += 1000;
    vi.setSystemTime(clock);
  };
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    tick();
  });
  afterEach(() => vi.useRealTimers());

  it("the owner's view: owner, admins with the verified email, joinedAt from admin_joined, staysTeacher, the open invites and the history", async () => {
    await member(school, 'kim', 'teacher'); // joined 2026-09-01, then promoted
    const first = await invite(school);
    tick();
    expect((await accept('kim', first.token)).status).toBe(200);
    tick();
    const pending = await invite(school);
    tick();
    await call('DELETE', `/api/spaces/${school}/admin-invites/${pending.id}`, bearer('principal'));
    tick();
    const second = await invite(school);
    tick();
    expect((await accept('dean', second.token)).status).toBe(200);
    const r = await call('GET', `/api/spaces/${school}/admins`, bearer('principal'));
    expect(r.status).toBe(200);
    const data = r.body.data as { owner: unknown; admins: Array<{ accountId: string; joinedAt: string }>; limit: number; invites: unknown[]; events: Array<{ kind: string; actorName: string | null; subjectName: string | null }> };
    expect(data.owner).toEqual({ accountId: 'principal', name: 'Ms Park' });
    expect(data.limit).toBe(2);
    expect(data.admins.map((a) => ({ ...a, joinedAt: a.joinedAt.slice(0, 4) }))).toEqual([
      { accountId: 'kim', name: 'Ms Kim', email: 'kim@example.org', joinedAt: '2026', staysTeacher: true },
      { accountId: 'dean', name: 'Dr Cho', email: 'cho@example.org', joinedAt: '2026', staysTeacher: false },
    ]);
    expect(data.admins[0]?.joinedAt).not.toBe('2026-09-01T00:00:00.000Z');
    expect(data.invites).toEqual([]);
    expect(data.events.map((e) => [e.kind, e.actorName, e.subjectName])).toEqual([
      ['admin_joined', 'Dr Cho', 'Dr Cho'],
      ['admin_invite_created', 'Ms Park', null],
      ['admin_invite_revoked', 'Ms Park', null],
      ['admin_invite_created', 'Ms Park', null],
      ['admin_joined', 'Ms Kim', 'Ms Kim'],
      ['admin_invite_created', 'Ms Park', null],
    ]);
  });

  it("an admin's view: the list without emails, invites or history; a teacher, a stranger and a family get refused", async () => {
    await invite(school);
    await member(school, 'dean', 'admin');
    await member(school, 'kim', 'teacher');
    const r = await call('GET', `/api/spaces/${school}/admins`, bearer('dean'));
    expect(r.body.data).toEqual({ owner: { accountId: 'principal', name: 'Ms Park' }, admins: [{ accountId: 'dean', name: 'Dr Cho', joinedAt: '2026-09-01T00:00:00.000Z', staysTeacher: false }], limit: 2 });
    expect(r.text).not.toContain('@');
    for (const user of ['kim', 'stranger']) expect((await call('GET', `/api/spaces/${school}/admins`, bearer(user))).status).toBe(403);
    const fam = await createSpace('principal', 'family', 'Park family');
    expect((await call('GET', `/api/spaces/${fam}/admins`, bearer('principal'))).body.error?.code).toBe('not_a_school');
  });

  it('open invites for the owner; the email only when verified; a missing account reads null, never an id', async () => {
    const open = await invite(school);
    await member(school, 'ghost', 'admin');
    setIdentityPortForTests({ primaryEmail: async (accountId) => (accountId === 'ghost' ? null : { email: 'x@example.org', verified: false }) });
    await member(school, 'dean', 'admin');
    const data = (await call('GET', `/api/spaces/${school}/admins`, bearer('principal'))).body.data as { invites: Array<{ id: string }>; admins: Array<{ accountId: string; name: string | null; email: string | null }> };
    expect(data.invites.map((i) => i.id)).toEqual([open.id]);
    expect(data.admins.map((a) => [a.accountId, a.name, a.email]).sort()).toEqual([
      ['dean', 'Dr Cho', null],
      ['ghost', null, null],
    ]);
  });

  it('the history: the last 20, newest first, names at read time; a class rename shows as class_renamed', async () => {
    const cls = await createSpace('principal', 'class', 'Room 4', { parentSpaceId: school });
    for (let i = 0; i < 11; i += 1) {
      tick();
      await call('PATCH', `/api/spaces/${cls}/name`, bearer('principal'), { name: `Room ${i}` });
    }
    for (let i = 0; i < 6; i += 1) {
      tick();
      const { id } = await invite(school);
      tick();
      await call('DELETE', `/api/spaces/${school}/admin-invites/${id}`, bearer('principal'));
    }
    await person('principal', 'Principal Park', 'park@example.org');
    const events = ((await call('GET', `/api/spaces/${school}/admins`, bearer('principal'))).body.data as { events: Array<{ kind: string; at: string; actorName: string }> }).events;
    expect(events).toHaveLength(20);
    expect(events[0]?.kind).toBe('admin_invite_revoked');
    expect(events.at(-1)?.kind).toBe('class_renamed');
    expect(new Set(events.map((e) => e.actorName))).toEqual(new Set(['Principal Park']));
    expect([...events].sort((a, b) => b.at.localeCompare(a.at)).map((e) => e.at)).toEqual(events.map((e) => e.at));
  });

  it("keeps the owner's view to a flat number of Db calls however long the history grows (Workers Free: 50 per invocation)", async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'vice', 'admin');
    const { setFallbackDb, fallbackDb } = await import('../db');
    const original = fallbackDb();
    const left = async (n: number) => {
      for (let i = 0; i < n; i += 1) {
        tick();
        await person(`former-${n}-${i}`, `Former ${i}`);
        await db.addSpaceEvent({ id: `sev:left-${n}-${i}`, spaceId: school, kind: 'admin_left', actorAccountId: `former-${n}-${i}`, subjectAccountId: `former-${n}-${i}`, subjectSpaceId: null, inviteId: null, createdAt: new Date().toISOString() });
      }
    };
    const count = async () => {
      await call('GET', `/api/spaces/${school}/admins`, bearer('principal')); // the first-sign-in upsert is not part of the budget
      const calls: string[] = [];
      setFallbackDb(
        new Proxy(original, {
          get(obj, prop, receiver) {
            const value: unknown = Reflect.get(obj, prop, receiver);
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
              calls.push(String(prop));
              return (value as (...a: unknown[]) => unknown).apply(obj, args);
            };
          },
        }),
      );
      try {
        const r = await call('GET', `/api/spaces/${school}/admins`, bearer('principal'));
        expect(r.status).toBe(200);
        return { events: (r.body.data as { events: Array<{ subjectName: string | null }> }).events, calls };
      } finally {
        setFallbackDb(original);
      }
    };
    await left(2);
    const small = await count();
    await left(20);
    const large = await count();
    expect(large.events).toHaveLength(20);
    expect(large.events.every((e) => e.subjectName?.startsWith('Former '))).toBe(true);
    expect(large.calls.length).toBe(small.calls.length);
    expect(large.calls.length).toBeLessThanOrEqual(20);
    // every name from one set-wise read (a getAccount left here is the dev identity port, Clerk on a deployment)
    expect(large.calls.filter((n) => n === 'getAccounts')).toHaveLength(1);
  });
});

describe('[SA] ending an admin role (sections 6.1, 6.4)', () => {
  it('the owner removes: back to teacher when they teach a class of the school, else out of the school', async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'vice', 'admin');
    const cls = await createSpace('principal', 'class', 'Room 4', { parentSpaceId: school });
    await member(cls, 'vice', 'teacher');
    const out = await call('DELETE', `/api/spaces/${school}/admins/dean`, bearer('principal'));
    expect(out.body.data).toEqual({ removed: true, stays: 'none' });
    const stays = await call('DELETE', `/api/spaces/${school}/admins/vice`, bearer('principal'));
    expect(stays.body.data).toEqual({ removed: true, stays: 'teacher' });
    expect([await roleOf(school, 'dean'), await roleOf(school, 'vice'), await roleOf(cls, 'vice')]).toEqual([null, 'teacher', 'teacher']);
    expect((await call('DELETE', `/api/spaces/${school}/admins/vice`, bearer('principal'))).status).toBe(404); // a teacher now
    const owner = await call('DELETE', `/api/spaces/${school}/admins/principal`, bearer('principal'));
    expect([owner.status, owner.body.error?.code]).toEqual([409, 'owner']);
    expect(adminEvents()).toEqual([{ name: 'space.admin.removed' }, { name: 'space.admin.removed' }]);
  });

  it('only the owner removes an admin; an admin cannot remove another admin', async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'vice', 'admin');
    expect((await call('DELETE', `/api/spaces/${school}/admins/vice`, bearer('dean'))).status).toBe(403);
    expect(await roleOf(school, 'vice')).toBe('admin');
  });

  it('a promoted teacher with no class goes back to teacher (promoted_from), with stays teacher', async () => {
    await member(school, 'kim', 'teacher');
    expect((await accept('kim', (await invite(school)).token)).status).toBe(200);
    expect((await call('DELETE', `/api/spaces/${school}/admins/kim`, bearer('principal'))).body.data).toEqual({ removed: true, stays: 'teacher' });
    expect(await roleOf(school, 'kim')).toBe('teacher');
  });

  it('an admin leaves: stays a teacher with a class, else leaves the school; the owner cannot leave; a teacher has nothing to leave', async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'vice', 'admin');
    await createSpace('vice', 'class', 'Room 9', { parentSpaceId: school });
    expect((await call('POST', `/api/spaces/${school}/admins/leave`, bearer('dean'))).body.data).toEqual({ left: true, stays: 'none' });
    expect((await call('POST', `/api/spaces/${school}/admins/leave`, bearer('vice'))).body.data).toEqual({ left: true, stays: 'teacher' });
    expect([await roleOf(school, 'dean'), await roleOf(school, 'vice')]).toEqual([null, 'teacher']);
    const owner = await call('POST', `/api/spaces/${school}/admins/leave`, bearer('principal'));
    expect([owner.status, owner.body.error?.code]).toEqual([409, 'owner']);
    expect((await call('POST', `/api/spaces/${school}/admins/leave`, bearer('vice'))).status).toBe(404);
    expect(adminEvents()).toEqual([{ name: 'space.admin.left' }, { name: 'space.admin.left' }]);
    const kinds = (await db.spaceEventsOf(school, 10)).filter((e) => e.kind === 'admin_left').map((e) => [e.actorAccountId, e.subjectAccountId]);
    expect(kinds.sort()).toEqual([
      ['dean', 'dean'],
      ['vice', 'vice'],
    ]);
  });
});

describe('[SA] the members route at a school and at a class of a school (section 6.4)', () => {
  it("at the school: an admin removes teachers only (403 owner_only for an admin); the owner's removal of an admin ends the role", async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'vice', 'admin');
    await member(school, 'kim', 'teacher');
    const refused = await call('DELETE', `/api/spaces/${school}/members/account/vice`, bearer('dean'));
    expect([refused.status, refused.body.error?.code]).toEqual([403, 'owner_only']);
    expect((await call('DELETE', `/api/spaces/${school}/members/account/principal`, bearer('dean'))).status).toBe(409);
    expect((await call('DELETE', `/api/spaces/${school}/members/account/kim`, bearer('dean'))).body.data).toEqual({ removed: true });
    const cls = await createSpace('principal', 'class', 'Room 4', { parentSpaceId: school });
    await member(cls, 'vice', 'teacher');
    expect((await call('DELETE', `/api/spaces/${school}/members/account/vice`, bearer('principal'))).body.data).toEqual({ removed: true, stays: 'teacher' });
    expect((await call('DELETE', `/api/spaces/${school}/members/account/dean`, bearer('principal'))).body.data).toEqual({ removed: true, stays: 'none' });
    expect([await roleOf(school, 'vice'), await roleOf(school, 'dean')]).toEqual(['teacher', null]);
  });

  it("through a class of the school, an admin removing another admin or the owner gets 403 owner_only; the owner may", async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'vice', 'admin');
    await member(school, 'kim', 'teacher');
    const cls = await createSpace('kim', 'class', 'Room 5', { parentSpaceId: school });
    await member(cls, 'vice', 'teacher');
    await member(cls, 'principal', 'teacher');
    for (const target of ['vice', 'principal']) {
      const r = await call('DELETE', `/api/spaces/${cls}/members/account/${target}`, bearer('dean'));
      expect([r.status, r.body.error?.code], target).toEqual([403, 'owner_only']);
    }
    // the class's own teacher cannot either
    expect((await call('DELETE', `/api/spaces/${cls}/members/account/vice`, bearer('kim'))).body.error?.code).toBe('owner_only');
    expect((await call('DELETE', `/api/spaces/${cls}/members/account/vice`, bearer('principal'))).body.data).toEqual({ removed: true });
    expect(await roleOf(cls, 'vice')).toBeNull();
    expect(await roleOf(school, 'vice')).toBe('admin'); // the class only
  });

  it('GET /:id/members: canRemove per member for the caller', async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'vice', 'admin');
    await member(school, 'kim', 'teacher');
    const view = async (user: string, spaceId = school) =>
      Object.fromEntries(((await call('GET', `/api/spaces/${spaceId}/members`, bearer(user))).body.data as { members: Array<{ memberId: string; canRemove: boolean }> }).members.map((m) => [m.memberId, m.canRemove]));
    expect(await view('dean')).toEqual({ principal: false, dean: false, vice: false, kim: true });
    expect(await view('principal')).toEqual({ principal: false, dean: true, vice: true, kim: true });
    const cls = await createSpace('kim', 'class', 'Room 5', { parentSpaceId: school });
    await member(cls, 'vice', 'teacher');
    expect(await view('dean', cls)).toEqual({ kim: false, vice: false });
    expect(await view('principal', cls)).toEqual({ kim: false, vice: true });
  });
});

describe('[SA] memberships are inserted only when absent (section 6.1)', () => {
  it('an admin who uses the teacher code stays an admin; POST /:id/members never rewrites a role', async () => {
    const code = ((await call('POST', `/api/spaces/${school}/code`, bearer('principal'))).body.data as { joinCode: string }).joinCode;
    expect((await accept('dean', (await invite(school)).token)).status).toBe(200);
    const again = await call('POST', `/api/spaces/${school}/join`, bearer('dean'), { code });
    expect([again.status, (again.body.data as { alreadyMember: boolean }).alreadyMember]).toEqual([200, true]);
    expect(await roleOf(school, 'dean')).toBe('admin');
    const cls = await createSpace('principal', 'class', 'Room 4', { parentSpaceId: school });
    const assigned = await call('POST', `/api/spaces/${cls}/members`, bearer('principal'), { accountId: 'principal', role: 'teacher' });
    expect([assigned.status, (assigned.body.data as { alreadyMember: boolean }).alreadyMember]).toEqual([200, true]);
    expect(await roleOf(cls, 'principal')).toBe('owner');
    expect((await call('POST', `/api/spaces/${cls}/members`, bearer('principal'), { accountId: 'dean', role: 'teacher' })).status).toBe(201);
    expect(await roleOf(cls, 'dean')).toBe('teacher');
  });
});

describe('[SA] races the guarded writes settle', () => {
  it('an accept whose gate fails after the checks names the reason from one read: revoked meanwhile, or made an admin meanwhile', async () => {
    const { token, id } = await invite(school);
    setIdentityPortForTests({
      primaryEmail: async (accountId) => {
        await db.revokeAdminInvite({ inviteId: id, spaceId: school, actorAccountId: 'principal', now: new Date(), eventId: 'sev:race' });
        return { email: `${accountId}@example.org`, verified: true };
      },
    });
    const revoked = await accept('dean', token);
    expect([revoked.status, revoked.body.error?.code]).toEqual([410, 'invite_revoked']);
    expect(await roleOf(school, 'dean')).toBeNull();
    const other = await invite(school);
    setIdentityPortForTests({
      primaryEmail: async (accountId) => {
        await member(school, accountId, 'admin');
        return { email: `${accountId}@example.org`, verified: true };
      },
    });
    expect((await accept('vice', other.token)).body.data).toMatchObject({ state: 'already_admin', space: { id: school } });
    expect((await db.getAdminInvite(other.id))?.acceptedAt).toBeNull();
  });

  it("the owner's list shows no email when Clerk fails", async () => {
    await member(school, 'dean', 'admin');
    setIdentityPortForTests({
      primaryEmail: async () => {
        throw new Error('clerk down');
      },
    });
    const data = (await call('GET', `/api/spaces/${school}/admins`, bearer('principal'))).body.data as { admins: Array<{ email: string | null }> };
    expect(data.admins.map((a) => a.email)).toEqual([null]);
  });

  it("the members route never deletes on a stale role: an accept between an admin's read and delete gets 403 owner_only", async () => {
    await member(school, 'dean', 'admin');
    await member(school, 'kim', 'teacher');
    const { id } = await seededInvite(school);
    const real = db.removeMembershipIfRole.bind(db);
    // kim accepts an invite just after the route read kim as a teacher
    const spy = vi.spyOn(db, 'removeMembershipIfRole').mockImplementationOnce(async (...args) => {
      expect(await db.acceptAdminInvite({ inviteId: id, spaceId: school, accountId: 'kim', now: new Date(), cap: SCHOOL_ADMIN_CAP, eventId: 'sev:race-accept' })).toBe(true);
      return real(...args);
    });
    const r = await call('DELETE', `/api/spaces/${school}/members/account/kim`, bearer('dean'));
    spy.mockRestore();
    expect([r.status, r.body.error?.code]).toEqual([403, 'owner_only']);
    expect(await roleOf(school, 'kim')).toBe('admin');
  });

  it("the members route answers from the row a concurrent leave left: the owner's removal then applies the teacher rules", async () => {
    await member(school, 'vice', 'admin');
    const cls = await createSpace('principal', 'class', 'Room 4', { parentSpaceId: school });
    await member(cls, 'vice', 'teacher');
    const real = db.endAdminRole.bind(db);
    // vice leaves (back to teacher) just after the route read vice as an admin
    const spy = vi.spyOn(db, 'endAdminRole').mockImplementationOnce(async (input) => {
      expect(await real({ spaceId: school, accountId: 'vice', actorAccountId: 'vice', kind: 'admin_left', now: new Date(), eventId: 'sev:race-leave' })).toBe('teacher');
      return real(input);
    });
    const r = await call('DELETE', `/api/spaces/${school}/members/account/vice`, bearer('principal'));
    spy.mockRestore();
    expect(r.body.data).toEqual({ removed: true });
    expect(await roleOf(school, 'vice')).toBeNull();
    // one admin_left, no admin_removed written for a role that had already ended
    expect((await db.spaceEventsOf(school, 10)).map((e) => e.kind).filter((k) => k.startsWith('admin_'))).toEqual(['admin_left']);
  });

  it('a teacher-code join or a class assignment that loses the insert to another request answers alreadyMember with the stored row', async () => {
    const code = ((await call('POST', `/api/spaces/${school}/code`, bearer('principal'))).body.data as { joinCode: string }).joinCode;
    await member(school, 'dean', 'admin');
    const real = db.membership.bind(db);
    // The route's read happens just before another request's row lands: the first read of `target` answers null.
    const missOnce = (target: string) => {
      let missed = false;
      return vi.spyOn(db, 'membership').mockImplementation(async (spaceId, kind, memberId) => {
        if (!missed && spaceId === target) {
          missed = true;
          return null;
        }
        return real(spaceId, kind, memberId);
      });
    };
    let spy = missOnce(school);
    const joined = await call('POST', `/api/spaces/${school}/join`, bearer('dean'), { code });
    spy.mockRestore();
    expect([joined.status, joined.body.data]).toMatchObject([200, { alreadyMember: true, membership: { role: 'admin' } }]);
    const cls = await createSpace('principal', 'class', 'Room 4', { parentSpaceId: school });
    await member(cls, 'dean', 'owner');
    spy = missOnce(cls);
    const assigned = await call('POST', `/api/spaces/${cls}/members`, bearer('principal'), { accountId: 'dean', role: 'teacher' });
    spy.mockRestore();
    expect([assigned.status, assigned.body.data]).toMatchObject([200, { alreadyMember: true, membership: { role: 'owner' } }]);
    expect(await roleOf(cls, 'dean')).toBe('owner');
  });
});
