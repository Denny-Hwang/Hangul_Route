import { describe, expect, it, vi } from 'vitest';
import { createConsoleApi } from '../api';
import { moveError, moveOrder, readClassScope, readDestinations, readIncoming, readMoveLists, readNotices, readOutgoing, readPreview, readReportScope } from '../class-moves';

/**
 * [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3: the console's readers of teacher moves and the class-scope
 * update, the error lines, and the API client's calls (ids only in paths, the learner in bodies and the query).
 */

const out = { id: 'move:1', kind: 'accept', status: 'waiting', to: { spaceId: 'space:b', name: 'B' }, learner: { name: 'Mina', avatar: 'tiger' }, createdAt: '2026-10-14T00:00:00.000Z', at: null };
const inc = { id: 'move:2', kind: 'accept', status: 'waiting', from: { name: 'A' }, learner: { alias: 'M. K.', avatar: 'tiger', level: 'starter' }, createdAt: '2026-10-14T00:00:00.000Z', at: null };

describe('readers (lenient: a row this bundle cannot read is dropped)', () => {
  it('reads outgoing and incoming rows and drops malformed ones', () => {
    expect(readOutgoing(out)).toEqual(out);
    expect(readOutgoing({ ...out, learner: null, at: '2026-10-15T00:00:00.000Z' })).toMatchObject({ learner: null, at: '2026-10-15T00:00:00.000Z' });
    expect(readOutgoing({ ...out, status: 'weird' })).toBeNull();
    expect(readOutgoing({ ...out, to: null })).toBeNull();
    expect(readIncoming(inc)).toEqual(inc);
    expect(readIncoming({ ...inc, learner: { name: 'Mina', avatar: 'tiger' } })?.learner).toEqual({ name: 'Mina', avatar: 'tiger' });
    expect(readIncoming({ ...inc, learner: 'x' })?.learner).toBeNull();
    expect(readIncoming({ ...inc, kind: 'teleport' })).toBeNull();
    expect(readMoveLists({ outgoing: [out, { id: 3 }], incoming: [inc, 'x'] })).toEqual({ outgoing: [out], incoming: [inc] });
    expect(readMoveLists(null)).toEqual({ outgoing: [], incoming: [] });
  });

  it('reads notices, the class-scope state, destinations and a preview', () => {
    const notice = { id: 'move:1', learnerId: 'profile:mina', learnerName: 'Mina', to: { spaceId: 'space:b', name: 'B' }, executedAt: 't' };
    expect(readNotices({ notices: [notice, { id: 'x' }] })).toEqual([notice]);
    expect(readNotices('x')).toEqual([]);
    expect(readClassScope({ current: 'class-scope-2026-10', learners: [{ learnerId: 'profile:mina', name: 'Mina', needed: true }, { learnerId: 1 }] })).toEqual({ current: 'class-scope-2026-10', learners: [{ learnerId: 'profile:mina', name: 'Mina', needed: true }] });
    expect(readClassScope({ learners: [] })).toBeNull();
    expect(readDestinations({ destinations: [{ id: 'space:d', name: 'D' }, { id: 3 }] })).toEqual([{ id: 'space:d', name: 'D' }]);
    expect(readDestinations(undefined)).toEqual([]);
    expect(readPreview({ destination: { id: 'space:b', name: 'B' }, direct: false })).toEqual({ destination: { id: 'space:b', name: 'B' }, direct: false });
    expect(readPreview({ destination: { id: 'space:b' }, direct: false })).toBeNull();
  });

  it('reads the report scope and settings only when sent', () => {
    expect(readReportScope({})).toEqual({});
    expect(readReportScope({ scope: 'full', settings: { classNotes: 'presets' } })).toEqual({ scope: 'full', settings: { classNotes: 'presets' } });
    expect(readReportScope({ scope: 'all', settings: { classNotes: 'loud' } })).toEqual({ settings: { classNotes: null } });
    expect(readReportScope({ scope: 'base', settings: null })).toEqual({ scope: 'base' });
  });

  it('orders open moves first, then newest', () => {
    const rows = [
      { id: 'a', status: 'ended' as const, createdAt: '3' },
      { id: 'b', status: 'waiting' as const, createdAt: '1' },
      { id: 'c', status: 'waiting' as const, createdAt: '2' },
    ];
    expect([...rows].sort(moveOrder).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('moveError', () => {
  const fail = (code: string, status = 409, details?: Record<string, unknown>) => ({ ok: false as const, error: 'unknown' as const, status, code, ...(details ? { details } : {}) });
  it('maps each code to a line or a page state', () => {
    expect(moveError({ ok: true, data: 1 })).toBeNull();
    expect(moveError({ ok: false, error: 'network', status: -1 })).toEqual({ kind: 'line', key: 'offline' });
    expect(moveError({ ok: false, error: 'unauthorized', status: 401 })).toEqual({ kind: 'signIn' });
    expect(moveError(fail('transfers_locked', 422))).toEqual({ kind: 'locked' });
    expect(moveError(fail('destination_changed'))).toEqual({ kind: 'refind' });
    expect(moveError(fail('not_found', 404))).toEqual({ kind: 'forbidden' });
    expect(moveError(fail('cap_class'))).toEqual({ kind: 'line', key: 'full' });
    expect(moveError(fail('move_blocked', 409, { reason: 'cap_learner' }))).toEqual({ kind: 'line', key: 'capLearner' });
    expect(moveError(fail('move_blocked', 409, { reason: 'cap_class' }))).toEqual({ kind: 'line', key: 'full' });
    expect(moveError(fail('code_required', 422))).toEqual({ kind: 'line', key: 'codeRequired' });
    expect(moveError(fail('something_new'))).toEqual({ kind: 'line', key: 'failed' });
  });
});

describe('the console client (ids in paths, the learner in bodies and the query)', () => {
  function client(data: unknown, status = 200) {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: status < 300, data }), { status }));
    return { api: createConsoleApi({ endpoint: 'https://api.test', token: 't', fetchImpl: fetchImpl as unknown as typeof fetch }), fetchImpl };
  }
  const urlOf = (f: ReturnType<typeof vi.fn>, i = 0) => String(f.mock.calls[i]?.[0]);
  const initOf = (f: ReturnType<typeof vi.fn>, i = 0) => f.mock.calls[i]?.[1] as RequestInit;

  it('destinations, preview, create, list, accept, decline, cancel', async () => {
    let c = client({ destinations: [{ id: 'space:d', name: 'D' }] });
    expect(await c.api.classMoveDestinations('space:a', 'profile:mina')).toEqual({ ok: true, data: [{ id: 'space:d', name: 'D' }] });
    expect(urlOf(c.fetchImpl)).toBe('https://api.test/api/spaces/space%3Aa/class-moves/destinations?learnerId=profile%3Amina');

    c = client({ destination: { id: 'space:b', name: 'B' }, direct: true });
    expect(await c.api.previewClassMove('space:a', { learnerId: 'profile:mina', code: 'K7PM4Q' })).toEqual({ ok: true, data: { destination: { id: 'space:b', name: 'B' }, direct: true } });
    expect(JSON.parse(String(initOf(c.fetchImpl).body))).toEqual({ learnerId: 'profile:mina', code: 'K7PM4Q' });
    c = client({ nope: 1 });
    expect((await c.api.previewClassMove('space:a', { learnerId: 'profile:mina', code: 'K7PM4Q' })).ok).toBe(false);

    c = client({ move: out }, 201);
    expect(await c.api.createClassMove('space:a', { learnerId: 'profile:mina', destinationSpaceId: 'space:b', code: 'K7PM4Q' })).toEqual({ ok: true, data: out });
    expect(urlOf(c.fetchImpl)).toBe('https://api.test/api/spaces/space%3Aa/class-moves');
    c = client({ move: { broken: true } });
    expect((await c.api.createClassMove('space:a', { learnerId: 'profile:mina', destinationSpaceId: 'space:d' })).ok).toBe(false);

    c = client({ outgoing: [out], incoming: [inc] });
    expect(await c.api.classMoves('space:a')).toEqual({ ok: true, data: { outgoing: [out], incoming: [inc] } });

    for (const [method, verb] of [
      ['acceptClassMove', 'accept'],
      ['declineClassMove', 'decline'],
    ] as const) {
      c = client({ move: inc });
      expect(await c.api[method]('space:b', 'move:2')).toEqual({ ok: true, data: inc });
      expect(urlOf(c.fetchImpl)).toBe(`https://api.test/api/spaces/space%3Ab/class-moves/move%3A2/${verb}`);
    }
    c = client({ move: out });
    expect(await c.api.cancelClassMove('space:a', 'move:1')).toEqual({ ok: true, data: out });
  });

  it('family notices, seen, the class-scope state and the acknowledgement', async () => {
    let c = client({ notices: [] });
    expect(await c.api.moveNotices('space:f')).toEqual({ ok: true, data: [] });
    c = client({ seen: true });
    expect(await c.api.markMoveSeen('space:f', 'move:1')).toEqual({ ok: true, data: { seen: true } });
    expect(urlOf(c.fetchImpl)).toBe('https://api.test/api/spaces/space%3Af/class-moves/move%3A1/seen');
    c = client({ current: 'class-scope-2026-10', learners: [] });
    expect(await c.api.classScope('space:f')).toEqual({ ok: true, data: { current: 'class-scope-2026-10', learners: [] } });
    c = client({ learners: [] });
    expect((await c.api.classScope('space:f')).ok).toBe(false);
    c = client({ version: 'class-scope-2026-10', ackedAt: 't' });
    expect(await c.api.acknowledgeClassScope('space:f', 'profile:mina', 'class-scope-2026-10')).toEqual({ ok: true, data: { version: 'class-scope-2026-10', ackedAt: 't' } });
    expect(urlOf(c.fetchImpl)).toBe('https://api.test/api/spaces/space%3Af/learners/profile%3Amina/class-scope');
    expect(JSON.parse(String(initOf(c.fetchImpl).body))).toEqual({ version: 'class-scope-2026-10' });
  });
});
