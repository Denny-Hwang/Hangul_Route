import type { Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { D1Db, noteRateKey, type Db, type StoredNote } from '../db';
import type { D1Like, D1PreparedLike } from '../db/d1';
import app from '../index';
import { NOTE_LIMIT_ACCOUNT_PER_DAY } from '../lib/note-limits';
import { notesSendLimiter } from '../routes/notes';
import { testDb as db } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';

/**
 * Sending notes — F-FEEDBACK-001 sections 6.1-6.4, 7.2, 7.3, 7.8 and 8.4 (PR
 * FB-3a): the composer's recipient list and the send, behind the Worker switch
 * `NOTES_SEND`. Runs on memory and, with `test:sqlite`, on the real migrations.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
const ON = { NOTES_SEND: 'enabled' };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env: Record<string, unknown> = ON) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }, env);
  return { status: res.status, body: (await res.json()) as Envelope };
}

const T = '2026-01-01T00:00:00.000Z';
const CLASS = 'space:cls';
const FAMILY = 'space:fam';
const SCHOOL = 'space:sch';
const SUNI = 'profile:suni';
const MIN = 'profile:min';
const QUEST = 'quest:stage1-letters-q1';

const space = (id: string, kind: Space['kind'], owner: string, over: Partial<Space> = {}): Space => ({
  id,
  kind,
  name: id,
  parentSpaceId: null,
  ownerAccountId: owner,
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: T,
  ...over,
});

async function seed(target: Db): Promise<void> {
  for (const accountId of ['teacher', 'coteacher', 'mom', 'dad', 'principal', 'stranger']) await target.putAccount({ id: accountId, email: null, displayName: null, consent: null, createdAt: T });
  await target.putSpace(space(SCHOOL, 'school', 'principal'));
  await target.putSpace(space(CLASS, 'class', 'teacher', { parentSpaceId: SCHOOL }));
  await target.putSpace(space(FAMILY, 'family', 'mom'));
  for (const [learnerId, name] of [[SUNI, 'Suni Kim'], [MIN, 'Min Park']] as const) await target.putLearner({ id: learnerId, displayName: name, ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
  const rows: Array<[string, 'account' | 'learner', string, 'owner' | 'teacher' | 'caregiver' | 'admin' | 'student']> = [
    [SCHOOL, 'account', 'principal', 'owner'],
    [CLASS, 'account', 'teacher', 'owner'],
    [CLASS, 'account', 'coteacher', 'teacher'],
    [CLASS, 'learner', SUNI, 'student'],
    [CLASS, 'learner', MIN, 'student'],
    [FAMILY, 'account', 'mom', 'owner'],
    [FAMILY, 'account', 'dad', 'caregiver'],
    [FAMILY, 'learner', SUNI, 'student'],
  ];
  for (const [spaceId, memberKind, memberId, role] of rows) await target.addMembership({ spaceId, memberKind, memberId, role, joinedAt: T });
}

beforeEach(async () => {
  await db.reset();
  notesSendLimiter.reset();
  await seed(db);
});

const send = (spaceId: string, user: string, body: unknown, env: Record<string, unknown> = ON) => call('POST', `/api/spaces/${spaceId}/notes`, bearer(user), body, env);
const recipients = (spaceId: string, user: string, env: Record<string, unknown> = ON) => call('GET', `/api/spaces/${spaceId}/notes/recipients`, bearer(user), undefined, env);
const toLearners = (...ids: string[]) => ({ kind: 'learners', ids });
const basic = (over: Record<string, unknown> = {}) => ({ to: toLearners(SUNI), presetId: 'progress_reading', ...over });
const notesOf = async (learnerId: string): Promise<StoredNote[]> => db.notesForOversight(learnerId, { before: null, limit: 500, now: new Date() });

describe('the NOTES_SEND switch (section 7.8)', () => {
  it('answers 404 on both send routes while unset or not exactly `enabled`, before auth or body checks', async () => {
    for (const env of [{}, { NOTES_SEND: 'true' }, { NOTES_SEND: 'Enabled' }]) {
      for (const [method, path, body] of [
        ['POST', `/api/spaces/${CLASS}/notes`, 'not json'],
        ['GET', `/api/spaces/${CLASS}/notes/recipients`, undefined],
      ] as const) {
        const res = await call(method, path, json, body, env);
        expect(res.status, `${method} ${JSON.stringify(env)}`).toBe(404);
        expect(res.body.error?.code).toBe('not_found');
      }
    }
    expect(await notesOf(SUNI)).toEqual([]);
  });

  it('switches nothing else: the other space routes keep working while it is off', async () => {
    expect((await call('GET', `/api/spaces/${CLASS}/plans`, bearer('teacher'), undefined, {})).status).toBe(200);
  });
});

describe('who can send (section 6.1)', () => {
  it('401 without a session; 404 for a missing space; 403 not_allowed for an outsider', async () => {
    expect((await call('POST', `/api/spaces/${CLASS}/notes`, json, basic())).status).toBe(401);
    expect((await send('space:nope', 'teacher', basic())).status).toBe(404);
    const stranger = await send(CLASS, 'stranger', basic());
    expect(stranger.status).toBe(403);
    expect(stranger.body.error?.code).toBe('not_allowed');
    expect((await recipients(CLASS, 'stranger')).status).toBe(403);
  });

  it('a class owner and a co-teacher send; a school admin does not reach the class (OD-6)', async () => {
    expect((await send(CLASS, 'teacher', basic())).status).toBe(201);
    expect((await send(CLASS, 'coteacher', basic({ to: toLearners(MIN) }))).status).toBe(201);
    expect((await send(CLASS, 'principal', basic())).status).toBe(403);
    expect((await recipients(CLASS, 'principal')).status).toBe(403);
  });

  it('the family owner sends; a caregiver only after the owner grants it (OD-17)', async () => {
    const preset = { presetId: 'warm_learning_together' };
    expect((await send(FAMILY, 'mom', basic(preset))).status).toBe(201);
    const dad = await send(FAMILY, 'dad', basic(preset));
    expect(dad.status).toBe(403);
    expect(dad.body.error?.code).toBe('not_allowed');
    expect((await recipients(FAMILY, 'dad')).status).toBe(403);
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: T });
    expect((await send(FAMILY, 'dad', basic(preset))).status).toBe(201);
    expect((await recipients(FAMILY, 'dad')).status).toBe(200);
  });

  it('an archived space cannot send (409 space_archived)', async () => {
    await db.putSpace(space(CLASS, 'class', 'teacher', { parentSpaceId: SCHOOL, archivedAt: T }));
    const res = await send(CLASS, 'teacher', basic());
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('space_archived');
  });

  it('a learner who is not a student of the space is not_in_space, with no hint whether it exists elsewhere', async () => {
    await db.putLearner({ id: 'profile:other', displayName: 'Other', ageGroup: '5-7', avatar: 'x', recoveryHash: null, createdAt: T, lastActiveAt: T });
    for (const id of ['profile:other', 'profile:nobody']) {
      const res = await send(FAMILY, 'mom', basic({ to: toLearners(SUNI, id) }));
      expect(res.status, id).toBe(422);
      expect(res.body.error?.code).toBe('not_in_space');
    }
    expect(await notesOf(SUNI)).toEqual([]);
  });
});

describe('POST /api/spaces/:id/notes', () => {
  it('sends to chosen learners: one live note each, one batch, the counters written', async () => {
    const res = await send(CLASS, 'teacher', { to: toLearners(SUNI, MIN), presetId: 'progress_reading', text: '  Loved   your work today ', textLocale: 'en', suggest: { kind: 'quest', id: QUEST } });
    expect(res.status).toBe(201);
    const data = res.body.data as { batchId: string; sent: number; skipped: unknown[]; presetsOnly: unknown[] };
    expect(data).toEqual({ batchId: expect.stringMatching(/^notebatch:/), sent: 2, skipped: [], presetsOnly: [] });
    const [note] = await notesOf(SUNI);
    expect(note).toMatchObject({
      spaceId: CLASS,
      senderAccountId: 'teacher',
      senderRole: 'teacher',
      senderLabel: null,
      batchId: data.batchId,
      batchKind: 'learners',
      presetId: 'progress_reading',
      body: 'Loved your work today',
      bodyLocale: 'en',
      suggest: { kind: 'quest', id: QUEST },
      status: 'live',
    });
    expect(note?.id).toMatch(/^note:[a-z0-9-]{8,64}$/);
    expect((await notesOf(MIN))[0]?.batchId).toBe(data.batchId);
    const counts = await db.countRateHitsByKeys([noteRateKey.account('teacher'), noteRateKey.pair(SUNI, 'teacher'), noteRateKey.learner(MIN)], new Date(Date.now() - 60_000));
    expect(Object.fromEntries(counts)).toEqual({ [noteRateKey.account('teacher')]: 2, [noteRateKey.pair(SUNI, 'teacher')]: 1, [noteRateKey.learner(MIN)]: 1 });
  });

  it('sends to everyone: the current students at send time, as one batch of kind `everyone`', async () => {
    await db.removeMembership(CLASS, 'learner', MIN);
    const res = await send(CLASS, 'teacher', { to: { kind: 'everyone' }, presetId: 'effort_proud' });
    expect(res.body.data).toMatchObject({ sent: 1, skipped: [] });
    expect((await notesOf(SUNI))[0]).toMatchObject({ batchKind: 'everyone', body: null, bodyLocale: null, suggest: null });
    expect(await notesOf(MIN)).toEqual([]);
  });

  it('a family note carries the chosen label, `family` by default; a class note refuses one', async () => {
    await send(FAMILY, 'mom', basic({ presetId: 'warm_learning_together' }));
    await send(FAMILY, 'mom', basic({ presetId: 'warm_cheering', label: 'grandma' }));
    expect((await notesOf(SUNI)).map((n) => [n.senderRole, n.senderLabel]).sort()).toEqual([
      ['family', 'family'],
      ['family', 'grandma'],
    ]);
    const res = await send(CLASS, 'teacher', basic({ label: 'mom' }));
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe('label_not_allowed');
  });

  it('checks the preset audience and the suggestion (bad_preset, bad_suggest)', async () => {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      [CLASS, { presetId: 'warm_learning_together' }, 'bad_preset'],
      [FAMILY, { presetId: 'warm_see_you_in_class' }, 'bad_preset'],
      [CLASS, { presetId: 'next_try_this' }, 'bad_preset'],
      [CLASS, { presetId: 'next_try_this', suggest: { kind: 'quest', id: 'quest:nope' } }, 'bad_suggest'],
      [CLASS, { presetId: 'progress_reading', suggest: { kind: 'quest', id: 'quest:nope' } }, 'bad_suggest'],
    ];
    for (const [spaceId, over, code] of cases) {
      const res = await send(spaceId, spaceId === CLASS ? 'teacher' : 'mom', basic(over));
      expect(res.status, JSON.stringify(over)).toBe(422);
      expect(res.body.error?.code).toBe(code);
    }
    expect((await send(CLASS, 'teacher', basic({ presetId: 'next_try_this', suggest: { kind: 'quest', id: QUEST } }))).status).toBe(201);
    expect((await send(CLASS, 'teacher', basic({ presetId: 'warm_see_you_in_class' }))).status).toBe(201);
    expect(await notesOf(SUNI)).toHaveLength(2);
  });

  it('answers a text problem with 422 note_text and its problem, quoting the token for a link and a tone word, never the text', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['Visit kim.com/x for more', { problem: 'link', word: 'kim.com' }],
      ['write to me at a@b', { problem: 'contact' }],
      ['Great work \u{1F600}', { problem: 'emoji' }],
      ['line one\nline two', { problem: 'line_break' }],
      ['   ', { problem: 'empty' }],
      ['x'.repeat(121), { problem: 'too_long' }],
    ];
    for (const [text, details] of cases) {
      const res = await send(CLASS, 'teacher', basic({ text, textLocale: 'en' }));
      expect(res.status, text).toBe(422);
      expect(res.body.error).toMatchObject({ code: 'note_text', details });
      expect(JSON.stringify(res.body)).not.toContain(text.trim() || 'never');
    }
    expect((await send(CLASS, 'teacher', basic({ text: 'Good job.See you, Mr.Kim', textLocale: 'en' }))).status).toBe(201);
    expect((await send(CLASS, 'teacher', basic({ text: 'no locale' }))).status).toBe(422);
    expect((await send(CLASS, 'teacher', { ...basic(), extra: true })).status).toBe(422);
  });

  it('skips a learner whose class notes are off or whose family stopped this sender, both as notes_off; reports presets-only learners', async () => {
    await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    const off = await send(CLASS, 'teacher', basic({ to: toLearners(SUNI, MIN) }));
    expect(off.body.data).toMatchObject({ sent: 1, skipped: [{ learnerId: SUNI, reason: 'notes_off' }], presetsOnly: [] });
    await db.putNotePrefs({ learnerId: SUNI, classes: 'presets', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    await db.putBlock({ learnerId: MIN, senderAccountId: 'teacher', familySpaceId: FAMILY, createdByAccount: 'mom', createdAt: T });
    const mixed = await send(CLASS, 'teacher', basic({ to: toLearners(SUNI, MIN), text: 'Nice reading', textLocale: 'en' }));
    expect(mixed.body.data).toMatchObject({ sent: 1, skipped: [{ learnerId: MIN, reason: 'notes_off' }], presetsOnly: [SUNI] });
    // the stored note keeps its text for the sender and the family; delivery drops it
    expect((await notesOf(SUNI)).map((n) => n.body)).toContain('Nice reading');
    // the class mode never touches family notes; a block of mom would
    await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    expect((await send(FAMILY, 'mom', basic({ presetId: 'warm_cheering' }))).body.data).toMatchObject({ sent: 1, skipped: [], presetsOnly: [] });
    await db.putBlock({ learnerId: SUNI, senderAccountId: 'mom', familySpaceId: FAMILY, createdByAccount: 'dad', createdAt: T });
    expect((await send(FAMILY, 'mom', basic({ presetId: 'warm_cheering' }))).body.data).toMatchObject({ sent: 0, skipped: [{ learnerId: SUNI, reason: 'notes_off' }] });
  });

  it('skips a learner after 3 notes a day from this account, and after 10 from everyone (limit)', async () => {
    for (let i = 0; i < 3; i += 1) expect((await send(CLASS, 'teacher', basic())).body.data).toMatchObject({ sent: 1 });
    expect((await send(CLASS, 'teacher', basic({ to: toLearners(SUNI, MIN) }))).body.data).toMatchObject({ sent: 1, skipped: [{ learnerId: SUNI, reason: 'limit' }] });
    // the co-teacher still reaches Suni until her daily total reaches 10
    await db.addRateHits(Array.from({ length: 6 }, () => ({ key: noteRateKey.learner(SUNI), at: new Date().toISOString() })));
    expect((await send(CLASS, 'coteacher', basic())).body.data).toMatchObject({ sent: 1 });
    expect((await send(CLASS, 'coteacher', basic())).body.data).toMatchObject({ sent: 0, skipped: [{ learnerId: SUNI, reason: 'limit' }] });
  });

  it('refuses the whole send past 400 notes a day from one account (429 too_many, scope account)', async () => {
    await db.addRateHits(Array.from({ length: NOTE_LIMIT_ACCOUNT_PER_DAY - 1 }, () => ({ key: noteRateKey.account('teacher'), at: new Date().toISOString() })));
    const res = await send(CLASS, 'teacher', basic({ to: toLearners(SUNI, MIN) }));
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'too_many', details: { scope: 'account' } });
    expect(await notesOf(SUNI)).toEqual([]);
    expect((await send(CLASS, 'teacher', basic())).status).toBe(201);
  });

  it('brakes more than 10 sends a minute from one account (429)', async () => {
    for (let i = 0; i < 10; i += 1) expect((await send(FAMILY, 'mom', basic({ presetId: 'warm_cheering' }))).status).toBe(201);
    const res = await send(FAMILY, 'mom', basic({ presetId: 'warm_cheering' }));
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'too_many', details: { scope: 'account' } });
  });

  it('a held account cannot send (403 sending_paused); a lifted hold can; other accounts are unaffected', async () => {
    await db.putSenderHold({ accountId: 'teacher', reason: 'reports', createdAt: T, liftedAt: null });
    const res = await send(CLASS, 'teacher', basic());
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('sending_paused');
    expect((await send(CLASS, 'coteacher', basic())).status).toBe(201);
    expect((await recipients(CLASS, 'teacher')).status).toBe(200);
    await db.reset();
    await seed(db);
    await db.putSenderHold({ accountId: 'teacher', reason: 'reports', createdAt: T, liftedAt: T });
    expect((await send(CLASS, 'teacher', basic())).status).toBe(201);
  });
});

describe('GET /api/spaces/:id/notes/recipients', () => {
  it('lists the students with their mode (a block reads as off) and today’s notes from this account', async () => {
    await db.putNotePrefs({ learnerId: MIN, classes: 'presets', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    await send(CLASS, 'teacher', basic());
    await send(CLASS, 'teacher', basic());
    await send(CLASS, 'coteacher', basic());
    const res = await recipients(CLASS, 'teacher');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      learners: [
        { id: MIN, displayName: 'Min Park', notes: 'presets', today: 0 },
        { id: SUNI, displayName: 'Suni Kim', notes: 'all', today: 2 },
      ],
    });
    await db.putBlock({ learnerId: SUNI, senderAccountId: 'teacher', familySpaceId: FAMILY, createdByAccount: 'mom', createdAt: T });
    await db.putNotePrefs({ learnerId: MIN, classes: 'off', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    const after = (await recipients(CLASS, 'teacher')).body.data as { learners: Array<{ id: string; notes: string }> };
    expect(after.learners.map((l) => [l.id, l.notes])).toEqual([
      [MIN, 'off'],
      [SUNI, 'off'],
    ]);
    expect(((await recipients(CLASS, 'coteacher')).body.data as { learners: Array<{ notes: string; today: number }> }).learners.map((l) => [l.notes, l.today])).toEqual([
      ['off', 0],
      ['all', 1],
    ]);
  });

  it('follows the roster setting: anonymized names when the class anonymizes its roster', async () => {
    await db.putSpace(space(CLASS, 'class', 'teacher', { parentSpaceId: SCHOOL, settings: { consentMode: 'parent', anonymizeRoster: true } }));
    const names = ((await recipients(CLASS, 'teacher')).body.data as { learners: Array<{ displayName: string }> }).learners.map((l) => l.displayName);
    expect(names).not.toContain('Suni Kim');
    expect(names).not.toContain('Min Park');
  });

  it('a family page: every learner is `all` unless the family stopped this sender (the class mode is not about family notes)', async () => {
    await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    expect((await recipients(FAMILY, 'mom')).body.data).toEqual({ learners: [{ id: SUNI, displayName: 'Suni Kim', notes: 'all', today: 0 }] });
  });
});

/** A D1 binding that counts the statements it prepares (section 7.4 statement budget). */
function counting(d1: D1Like): { binding: D1Like; prepared: () => number; reset: () => void } {
  let n = 0;
  return {
    binding: {
      prepare(sql: string): D1PreparedLike {
        n += 1;
        return d1.prepare(sql);
      },
      batch: (statements) => d1.batch(statements),
    },
    prepared: () => n,
    reset: () => {
      n = 0;
    },
  };
}

describe('statement budget (section 7.4, D11)', () => {
  it('a send to 1 learner and to 300 prepares the same number of statements, at most 16; recipients at most 6', async () => {
    const raw = openSqliteD1();
    const own = new D1Db(raw);
    await seed(own);
    const many = Array.from({ length: 300 }, (_, i) => `profile:l${i}`);
    for (const learnerId of many) {
      await own.putLearner({ id: learnerId, displayName: learnerId, ageGroup: '5-7', avatar: 'x', recoveryHash: null, createdAt: T, lastActiveAt: T });
      await own.addMembership({ spaceId: CLASS, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: T });
    }
    const counter = counting(raw);
    const env = { ...ON, DB: counter.binding };
    const measure = async (body: unknown, user = 'teacher'): Promise<number> => {
      counter.reset();
      const res = await send(CLASS, user, body, env);
      expect(res.status).toBe(201);
      return counter.prepared();
    };
    const one = await measure(basic({ to: toLearners(many[0]!), text: 'Well done', textLocale: 'en' }));
    const all = await measure(basic({ to: toLearners(...many), text: 'Well done', textLocale: 'en' }));
    expect(all).toBe(one);
    expect(one).toBeLessThanOrEqual(16);
    // another account: the teacher has 301 of today's 400 already
    const everyone = await measure({ to: { kind: 'everyone' }, presetId: 'effort_proud' }, 'coteacher');
    expect(everyone).toBeLessThanOrEqual(16);
    expect((await own.notesForOversight(many[299]!, { before: null, limit: 10, now: new Date() })).length).toBe(2);

    counter.reset();
    const list = await recipients(CLASS, 'teacher', env);
    expect(list.status).toBe(200);
    expect((list.body.data as { learners: unknown[] }).learners).toHaveLength(302);
    expect(counter.prepared()).toBeLessThanOrEqual(6);
    raw.close();
  });
});
