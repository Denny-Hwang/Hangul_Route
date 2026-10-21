import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { RENAME_LIMIT, renameLimiter } from '../routes/spaces';
import { store } from '../store';
import { testDb as db } from './helpers/db';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS sections 5.1, 5.2, 5.5 and 6.2: `PATCH /api/spaces/:id/name`, who may rename, the
 * name rule, the column-only write, the school audit rows and the codes-only server event.
 */

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}
async function createSpace(user: string, kind: string, name: string, parentSpaceId?: string): Promise<string> {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name, ...(parentSpaceId ? { parentSpaceId } : {}) });
  expect(r.status).toBe(201);
  return (r.body.data as { space: { id: string } }).space.id;
}
async function addAdult(spaceId: string, accountId: string, role: 'caregiver' | 'teacher' | 'admin') {
  await db.addMembership({ spaceId, memberKind: 'account', memberId: accountId, role, joinedAt: new Date().toISOString() });
}
const rename = (user: string, spaceId: string, name: unknown) => call('PATCH', `/api/spaces/${spaceId}/name`, bearer(user), { name });
const nameOf = async (spaceId: string) => (await db.getSpace(spaceId))?.name;
const renamedEvents = () => store.events.filter((e) => e.name === 'space.renamed').map((e) => e.payload);

beforeEach(async () => {
  await db.reset();
  renameLimiter.reset();
  store.events.length = 0;
});

describe('[SA] PATCH /api/spaces/:id/name: who may rename (section 5.1)', () => {
  it('a family: the owner only; caregivers, strangers and signed-out callers are refused', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await addAdult(fam, 'dad', 'caregiver');
    expect((await rename('dad', fam, 'Dad family')).status).toBe(403);
    expect((await rename('stranger', fam, 'Mine')).status).toBe(403);
    expect((await call('PATCH', `/api/spaces/${fam}/name`, json, { name: 'X' })).status).toBe(401);
    const r = await rename('mom', fam, '  Kim   and Park  family ');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ changed: true, space: { id: fam, kind: 'family', name: 'Kim and Park family' } });
    expect(await nameOf(fam)).toBe('Kim and Park family');
    expect(renamedEvents()).toEqual([{ kind: 'family', role: 'owner' }]);
  });

  it('a stand-alone class: the owner and a teacher member', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await addAdult(cls, 'co', 'teacher');
    expect((await rename('co', cls, 'Room 4B')).status).toBe(200);
    expect((await rename('teacher', cls, 'Room 4C')).status).toBe(200);
    expect(await nameOf(cls)).toBe('Room 4C');
    expect(renamedEvents()).toEqual([
      { kind: 'class', role: 'teacher' },
      { kind: 'class', role: 'owner' },
    ]);
  });

  it('a school and its classes: the owner and admins; a teacher only its own or taught class', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'dean', 'admin');
    await addAdult(sch, 'kim', 'teacher');
    await addAdult(sch, 'lee', 'teacher');
    const kims = await createSpace('kim', 'class', 'Room 5', sch);
    expect((await rename('kim', sch, 'Kim School')).status).toBe(403);
    expect((await rename('lee', kims, 'Lee room')).status).toBe(403);
    expect((await rename('dean', sch, 'Maple Hangul School')).status).toBe(200);
    expect((await rename('principal', kims, 'Room 5A')).status).toBe(200);
    expect((await rename('dean', kims, 'Room 5B')).status).toBe(200);
    expect((await rename('kim', kims, 'Room 5C')).status).toBe(200);
    expect([await nameOf(sch), await nameOf(kims)]).toEqual(['Maple Hangul School', 'Room 5C']);
    expect(renamedEvents()).toEqual([
      { kind: 'school', role: 'admin' },
      { kind: 'class', role: 'owner' },
      { kind: 'class', role: 'admin' },
      { kind: 'class', role: 'owner' },
    ]);
  });

  it('a learner device cannot rename', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const r = await call('PATCH', `/api/spaces/${fam}/name`, { ...json, authorization: 'Device device-x0000001:secret' }, { name: 'X' });
    expect(r.status).toBe(401);
  });
});

describe('[SA] PATCH /api/spaces/:id/name: answers (section 5.2)', () => {
  it('404 for an unknown space, 422 archived for an archived one', async () => {
    expect((await rename('mom', 'space:nope', 'X')).status).toBe(404);
    const cls = await createSpace('teacher', 'class', 'Room 4');
    expect((await call('POST', `/api/spaces/${cls}/archive`, bearer('teacher'))).status).toBe(200);
    const r = await rename('teacher', cls, 'Room 9');
    expect([r.status, r.body.error?.code]).toEqual([422, 'archived']);
    expect(await nameOf(cls)).toBe('Room 4');
  });

  it('422 bad_name with the reason; 422 bad_request without a string name', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    for (const [name, reason] of [
      ['   ', 'empty'],
      ['a'.repeat(41), 'too_long'],
      ['Kim‮family', 'invalid'],
      ['?!', 'invalid'],
    ] as const) {
      const r = await rename('mom', fam, name);
      expect([r.status, r.body.error?.code, r.body.error?.details], name).toEqual([422, 'bad_name', { reason }]);
    }
    expect((await rename('mom', fam, 42)).body.error?.code).toBe('bad_request');
    expect((await call('PATCH', `/api/spaces/${fam}/name`, bearer('mom'))).body.error?.code).toBe('bad_request');
    expect(await nameOf(fam)).toBe('Kim family');
  });

  it('the same name after normalizing: 200 changed false, nothing written, no event', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    const r = await rename('principal', sch, ' Maple \t School ');
    expect(r.body.data).toMatchObject({ changed: false, space: { name: 'Maple School' } });
    expect(await db.spaceEventsOf(sch, 10)).toEqual([]);
    expect(renamedEvents()).toEqual([]);
  });

  it('30 renames per account per hour, then 429', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    for (let i = 0; i < RENAME_LIMIT; i += 1) expect((await rename('mom', fam, `Kim family ${i}`)).status).toBe(200);
    const r = await rename('mom', fam, 'One more');
    expect([r.status, r.body.error?.code]).toEqual([429, 'too_many_attempts']);
    expect(await nameOf(fam)).toBe(`Kim family ${RENAME_LIMIT - 1}`);
  });

  it('a settings change, an archive round trip and a new code keep the new name (putSpace never writes it)', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    const stale = await db.getSpace(cls);
    expect((await rename('teacher', cls, 'Room 4B')).status).toBe(200);
    expect((await call('PATCH', `/api/spaces/${cls}/settings`, bearer('teacher'), { anonymizeRoster: true })).status).toBe(200);
    expect((await call('POST', `/api/spaces/${cls}/code`, bearer('teacher'))).status).toBe(200);
    expect((await call('POST', `/api/spaces/${cls}/archive`, bearer('teacher'))).status).toBe(200);
    expect((await call('POST', `/api/spaces/${cls}/unarchive`, bearer('teacher'))).status).toBe(200);
    // a writer holding the copy read before the rename
    if (stale) await db.putSpace({ ...stale, settings: { ...stale.settings, consentMode: 'parent' } });
    expect(await db.getSpace(cls)).toMatchObject({ name: 'Room 4B', archivedAt: null });
  });
});

describe('[SA] a rename and a settings change at once', () => {
  it('keep both changes', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    const [renamed, settings] = await Promise.all([rename('teacher', cls, 'Room 4B'), call('PATCH', `/api/spaces/${cls}/settings`, bearer('teacher'), { anonymizeRoster: true })]);
    expect([renamed.status, settings.status]).toEqual([200, 200]);
    expect(await db.getSpace(cls)).toMatchObject({ name: 'Room 4B', settings: { anonymizeRoster: true } });
  });
});

describe('[SA] the school audit rows (section 6.2)', () => {
  it('a school rename writes `renamed` on the school; a class of the school `class_renamed` there, with the class', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'dean', 'admin');
    const cls = await createSpace('principal', 'class', 'Room 5', sch);
    expect((await rename('dean', sch, 'Maple Hangul School')).status).toBe(200);
    expect((await rename('principal', cls, 'Room 5A')).status).toBe(200);
    const events = await db.spaceEventsOf(sch, 10);
    const rows = events.map((e) => ({ kind: e.kind, actor: e.actorAccountId, subject: e.subjectSpaceId, space: e.spaceId }));
    expect(rows.sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([
      { kind: 'class_renamed', actor: 'principal', subject: cls, space: sch },
      { kind: 'renamed', actor: 'dean', subject: null, space: sch },
    ]);
    expect(await db.spaceEventsOf(cls, 10)).toEqual([]);
    // never a name in the row
    expect(JSON.stringify(events)).not.toMatch(/Maple|Room/);
  });

  it('a family or a stand-alone class rename writes no row', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const cls = await createSpace('teacher', 'class', 'Room 4');
    expect((await rename('mom', fam, 'Kim home')).status).toBe(200);
    expect((await rename('teacher', cls, 'Room 4B')).status).toBe(200);
    expect([...(await db.spaceEventsOf(fam, 10)), ...(await db.spaceEventsOf(cls, 10))]).toEqual([]);
  });

  it('a failed audit write never fails the committed rename', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    const original = db.addSpaceEvent.bind(db);
    db.addSpaceEvent = async () => {
      throw new Error('no such table: space_events');
    };
    try {
      const r = await rename('principal', sch, 'Maple Hangul School');
      expect([r.status, r.body.data?.changed]).toEqual([200, true]);
      expect(await nameOf(sch)).toBe('Maple Hangul School');
    } finally {
      db.addSpaceEvent = original;
    }
  });
});

describe('[SA] canRename on the roster and the school page (section 5.3)', () => {
  it('true for those who may rename, false for the others', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await addAdult(fam, 'dad', 'caregiver');
    expect((await call('GET', `/api/spaces/${fam}/roster`, bearer('mom'))).body.data).toMatchObject({ canRename: true, openMoves: false });
    expect((await call('GET', `/api/spaces/${fam}/roster`, bearer('dad'))).body.data).toMatchObject({ canRename: false, openMoves: false });
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'dean', 'admin');
    await addAdult(sch, 'kim', 'teacher');
    const cls = await createSpace('kim', 'class', 'Room 5', sch);
    const view = (await call('GET', `/api/spaces/${sch}/school`, bearer('dean'))).body.data as { canRename: boolean; classes: Array<{ space: { id: string }; canRename: boolean; openMoves: boolean }> };
    expect(view.canRename).toBe(true);
    expect(view.classes.find((k) => k.space.id === cls)).toMatchObject({ canRename: true, openMoves: false });
  });
});
