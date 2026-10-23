import { describe, expect, it, vi } from 'vitest';
import { createSyncApi } from '../sync-api';

/**
 * Owner report 2026-10-23 (a learner moved from class A to class B showed in both): the `/join` refusals for a move
 * that stands out of the class (`moved_out`) or waits to bring the learner into it (`move_waiting`), the lookup's
 * optional `moved` / `moveWaiting`, and the join answer's authoritative `memberships` list.
 */

const creds = { deviceId: 'device-x', secret: 's3cret' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refusal = (code: string, details?: unknown) => json(409, { error: { code, message: 'm', ...(details === undefined ? {} : { details }) } });
const body = { code: 'K7M2X9', learnerId: 'profile:a' };
const B = { spaceId: 'space:b', name: 'Class B' };
const A = { spaceId: 'space:a', name: 'Class A' };

describe('platform/sync-api — join refusals for a learner move (owner report 2026-10-23)', () => {
  it('maps 409 moved_out with details.to and 409 move_waiting with details.from', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(refusal('moved_out', { to: B })).mockResolvedValueOnce(refusal('move_waiting', { from: A }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.joinSpace('space:a', body, creds)).toEqual({ status: 'error', code: 'moved_out', to: B });
    expect(await api.joinSpace('space:b', body, creds)).toEqual({ status: 'error', code: 'move_waiting', from: A });
  });

  it('keeps the code but drops a class it cannot read (no details, a bad shape)', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(refusal('moved_out'))
      .mockResolvedValueOnce(refusal('moved_out', { to: { spaceId: '', name: 'B' } }))
      .mockResolvedValueOnce(refusal('move_waiting', { from: 'space:a' }))
      .mockResolvedValueOnce(refusal('move_waiting', { to: B }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.joinSpace('space:a', body, creds)).toEqual({ status: 'error', code: 'moved_out' });
    expect(await api.joinSpace('space:a', body, creds)).toEqual({ status: 'error', code: 'moved_out' });
    expect(await api.joinSpace('space:b', body, creds)).toEqual({ status: 'error', code: 'move_waiting' });
    expect(await api.joinSpace('space:b', body, creds)).toEqual({ status: 'error', code: 'move_waiting' });
  });

  it('every other 409 keeps today\'s mapping: an unknown code is still the three-classes code', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(refusal('something_new', { to: B })).mockResolvedValueOnce(refusal('cap_learner')).mockResolvedValueOnce(json(409, {}));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    for (let i = 0; i < 3; i++) expect(await api.joinSpace('space:a', body, creds)).toEqual({ status: 'error', code: 'cap_learner' });
  });

  it('a join answer with memberships passes the list on; an older Worker (or a list it cannot read) leaves it out', async () => {
    const data = { alreadyMember: false, membership: { role: 'student', joinedAt: 't' }, space: { id: 'space:b', kind: 'class', name: 'Class B' } };
    const rowB = { spaceId: 'space:b', kind: 'class', name: 'Class B', role: 'student', joinedAt: 't' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(201, { data: { ...data, memberships: [rowB] } }))
      .mockResolvedValueOnce(json(201, { data }))
      .mockResolvedValueOnce(json(201, { data: { ...data, memberships: [{ spaceId: 'space:b' }] } }))
      .mockResolvedValueOnce(json(201, { data: { ...data, memberships: [] } }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.joinSpace('space:b', body, creds)).toEqual({ status: 'ok', alreadyMember: false, membership: rowB, memberships: [rowB] });
    const old = await api.joinSpace('space:b', body, creds);
    expect(old).toEqual({ status: 'ok', alreadyMember: false, membership: rowB });
    expect(old).not.toHaveProperty('memberships');
    expect(await api.joinSpace('space:b', body, creds)).not.toHaveProperty('memberships');
    // An empty list is a real answer (a class device that sees no class yet), not a missing one.
    expect(await api.joinSpace('space:b', body, creds)).toEqual({ status: 'ok', alreadyMember: false, membership: rowB, memberships: [] });
  });
});

describe('platform/sync-api — lookup moved / moveWaiting (owner report 2026-10-23)', () => {
  it('reads the optional top-level moved and moveWaiting, and drops a shape it cannot read', async () => {
    const space = { id: 'space:a', kind: 'class', name: 'Class A' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { space, full: false, roster: [], moved: { to: B } } }))
      .mockResolvedValueOnce(json(200, { data: { space, full: false, roster: [], moveWaiting: { from: A } } }))
      .mockResolvedValueOnce(json(200, { data: { space, full: false, roster: [], moved: { to: 'space:b' }, moveWaiting: {} } }))
      .mockResolvedValueOnce(json(200, { data: { space, full: false, roster: [] } }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.lookupSpace('K7M2X9', { learnerId: 'profile:a', creds })).toEqual({ status: 'ok', space, full: false, seat: null, roster: [], moved: { to: B } });
    expect(await api.lookupSpace('K7M2X9', { learnerId: 'profile:a', creds })).toEqual({ status: 'ok', space, full: false, seat: null, roster: [], moveWaiting: { from: A } });
    const bad = await api.lookupSpace('K7M2X9', { learnerId: 'profile:a', creds });
    expect(bad).not.toHaveProperty('moved');
    expect(bad).not.toHaveProperty('moveWaiting');
    const old = await api.lookupSpace('K7M2X9');
    expect(old).not.toHaveProperty('moved');
    expect(old).not.toHaveProperty('moveWaiting');
  });
});
