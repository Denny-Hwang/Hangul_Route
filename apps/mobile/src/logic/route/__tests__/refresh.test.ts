import { describe, expect, it } from 'vitest';
import type { DeriveSource } from '../../homework/plan-derivation';
import { blendedMeta, curriculumMeta } from '../../homework/__tests__/curriculum-fixture';
import { refreshFor } from '../refresh';

// AMENDMENTS-ROUTE-CLASS-BLEND sections 6.4 and 7 (row BL-6). A Tuesday class from 2026-09-22 to 2026-10-19.
const refresh = [
  { date: '2026-09-27', cellIds: ['cell:a', 'cell:b'] },
  { date: '2026-10-02', cellIds: ['cell:c'] },
];
const src = (id: string, assignedAt: string, meta: DeriveSource['meta']): DeriveSource => ({ id, kind: 'class', assignedAt, items: [], meta });
const plan = src('plan:b', '2026-09-20T00:00:00.000Z', blendedMeta({ refresh }));
const open = (...cells: string[]) => ({ isCellCheckOpen: (id: string) => cells.includes(id) });

describe('refreshFor', () => {
  it("opens the Cell Check of the first listed cell whose Check is open", () => {
    expect(refreshFor([plan], '2026-09-27', open('cell:a', 'cell:b'))).toEqual({ kind: 'cell-check', cellId: 'cell:a' });
  });

  it('skips a cell the learner cannot open (locked by F-ENT-003, or its Check not open yet)', () => {
    expect(refreshFor([plan], '2026-09-27', open('cell:b'))).toEqual({ kind: 'cell-check', cellId: 'cell:b' });
  });

  it('falls back to Daily Review with Keep going when no listed Check is open', () => {
    expect(refreshFor([plan], '2026-09-27', open())).toEqual({ kind: 'daily-review' });
    expect(refreshFor([plan], '2026-10-02', open('cell:a'))).toEqual({ kind: 'daily-review' });
  });

  it('is null on a date with no entry, outside the route, or without a class plan with practice days', () => {
    expect(refreshFor([plan], '2026-09-28', open('cell:a'))).toBeNull();
    expect(refreshFor([plan], '2026-10-30', open('cell:a'))).toBeNull();
    expect(refreshFor([], '2026-09-27', open('cell:a'))).toBeNull();
    expect(refreshFor([src('plan:c', 't', { ...curriculumMeta(), refresh })], '2026-09-27', open('cell:a'))).toBeNull();
    expect(refreshFor([{ ...plan, kind: 'family' }], '2026-09-27', open('cell:a'))).toBeNull();
    expect(refreshFor([src('plan:none', 't', blendedMeta())], '2026-09-27', open('cell:a'))).toBeNull();
  });

  it('reads the leading (newest) blended plan only', () => {
    const newer = src('plan:new', '2026-09-21T00:00:00.000Z', blendedMeta({ refresh: [{ date: '2026-09-27', cellIds: ['cell:z'] }] }));
    expect(refreshFor([plan, newer], '2026-09-27', open('cell:a', 'cell:z'))).toEqual({ kind: 'cell-check', cellId: 'cell:z' });
    const newerNoEntry = src('plan:new', '2026-09-21T00:00:00.000Z', blendedMeta());
    expect(refreshFor([plan, newerNoEntry], '2026-09-27', open('cell:a'))).toBeNull();
  });
});
