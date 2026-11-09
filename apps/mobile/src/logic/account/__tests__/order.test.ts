import { describe, expect, it } from 'vitest';
import { orderLearners, orderSpaces } from '../order';

/**
 * F-AUTH-004 section 8.1 (row NS-2; anti-shame): every list in a stable order the server cannot change; never by
 * activity, minutes or progress.
 */

describe('orderLearners: joinedAt ascending, then id', () => {
  it('ignores the roster route’s activity order', () => {
    const byActivity = [
      { id: 'c', joinedAt: '2026-10-03T00:00:00.000Z', lastActiveAt: '2026-11-08T00:00:00.000Z', minutes7d: 90 },
      { id: 'a', joinedAt: '2026-10-01T00:00:00.000Z', lastActiveAt: '2026-11-07T00:00:00.000Z', minutes7d: 60 },
      { id: 'b2', joinedAt: '2026-10-02T00:00:00.000Z', lastActiveAt: '2026-11-01T00:00:00.000Z', minutes7d: 5 },
      { id: 'b1', joinedAt: '2026-10-02T00:00:00.000Z', lastActiveAt: '2026-10-02T00:00:00.000Z', minutes7d: 0 },
    ];
    expect(orderLearners(byActivity).map((l) => l.id)).toEqual(['a', 'b1', 'b2', 'c']);
  });

  it('does not change its input, and the same input gives the same order', () => {
    const list = [
      { id: 'b', joinedAt: '2026-10-02T00:00:00.000Z' },
      { id: 'a', joinedAt: '2026-10-02T00:00:00.000Z' },
      { id: 'a', joinedAt: '2026-10-02T00:00:00.000Z' },
    ];
    const copy = JSON.parse(JSON.stringify(list));
    expect(orderLearners(list).map((l) => l.id)).toEqual(['a', 'a', 'b']);
    expect(list).toEqual(copy);
    expect(orderLearners([...list].reverse()).map((l) => l.id)).toEqual(['a', 'a', 'b']);
  });
});

describe('orderSpaces: live first, then archived; each group oldest first, then id', () => {
  it('ignores GET /api/spaces’ newest-first order', () => {
    const item = (id: string, createdAt: string, archivedAt: string | null = null) => ({ space: { id, createdAt, archivedAt }, role: 'owner' });
    const newestFirst = [
      item('s:new', '2026-11-01T00:00:00.000Z'),
      item('s:old-archived', '2026-01-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
      item('s:mid', '2026-06-01T00:00:00.000Z'),
      item('s:mid-b', '2026-06-01T00:00:00.000Z'),
      item('s:new-archived', '2026-10-01T00:00:00.000Z', '2026-10-05T00:00:00.000Z'),
      item('s:old', '2026-02-01T00:00:00.000Z'),
    ];
    expect(orderSpaces(newestFirst).map((s) => s.space.id)).toEqual(['s:old', 's:mid', 's:mid-b', 's:new', 's:old-archived', 's:new-archived']);
  });
});
