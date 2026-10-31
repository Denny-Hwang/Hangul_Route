import { describe, expect, it } from 'vitest';
import {
  PendingMoveStepSchema,
  RosterPendingSchema,
  SpaceAttentionSchema,
  readRosterIncoming,
  readRosterPending,
  readSchoolAttention,
  readSpaceAttention,
} from '../index';

/*
 * [GX-W] The approvals fields of the roster and the spaces list (AMENDMENTS-GROWNUP-UX section 12). The Worker
 * writes them; a console reads them leniently, so a broken or unknown part reads as absent and the console falls
 * back to its own reads (section 3.3), never to a guess.
 */

const relink = { id: 'relink:abc', expiresAt: '2026-10-31T10:10:00.000Z' };
const move = { source: 'transfer', id: 'transfer:1', step: 'yours', to: 'Saturday Class B', on: null, expiresAt: '2026-11-14T10:00:00.000Z' } as const;

describe('RosterPendingSchema', () => {
  it('takes a re-link, a move, both, or neither', () => {
    expect(RosterPendingSchema.parse({ relink })).toEqual({ relink });
    expect(RosterPendingSchema.parse({ move })).toEqual({ move });
    expect(RosterPendingSchema.parse({ relink, move })).toEqual({ relink, move });
    expect(RosterPendingSchema.parse({})).toEqual({});
  });

  it('knows the four move steps and the two sources', () => {
    expect(PendingMoveStepSchema.options).toEqual(['yours', 'others', 'room', 'scheduled']);
    expect(RosterPendingSchema.parse({ move: { ...move, source: 'teacher', step: 'scheduled', on: '2026-11-20T00:00:00.000Z', to: null, expiresAt: null } }).move).toMatchObject({ source: 'teacher', step: 'scheduled', to: null, expiresAt: null });
  });

  it('drops a broken part and keeps the other (lenient on the client)', () => {
    expect(RosterPendingSchema.parse({ relink: { id: '' }, move })).toEqual({ move });
    expect(RosterPendingSchema.parse({ relink, move: { ...move, step: 'later' } })).toEqual({ relink });
    expect(RosterPendingSchema.parse({ relink, move: { ...move, source: 'school' } })).toEqual({ relink });
  });
});

describe('readRosterPending', () => {
  it('reads a learner row field, or null when absent or not an object', () => {
    expect(readRosterPending({ relink })).toEqual({ relink });
    expect(readRosterPending(undefined)).toBeNull();
    expect(readRosterPending(null)).toBeNull();
    expect(readRosterPending('pending')).toBeNull();
    expect(readRosterPending([relink])).toBeNull();
  });

  it('reads an object whose parts are all broken as nothing pending', () => {
    expect(readRosterPending({ relink: 3, move: 'x' })).toEqual({});
  });
});

describe('readRosterIncoming', () => {
  it('reads a whole count of zero or more, else null', () => {
    expect(readRosterIncoming(0)).toBe(0);
    expect(readRosterIncoming(2)).toBe(2);
    for (const bad of [undefined, null, -1, 1.5, '2', Number.NaN]) expect(readRosterIncoming(bad)).toBeNull();
  });
});

describe('SpaceAttentionSchema and readSpaceAttention', () => {
  const attention = { relinks: 1, moves: 2, relinkExpiresAt: '2026-10-31T10:10:00.000Z' };

  it('reads the counts and the soonest re-link expiry', () => {
    expect(SpaceAttentionSchema.parse(attention)).toEqual(attention);
    expect(readSpaceAttention(attention)).toEqual(attention);
    expect(readSpaceAttention({ relinks: 0, moves: 0, relinkExpiresAt: null })).toEqual({ relinks: 0, moves: 0, relinkExpiresAt: null });
  });

  it('reads an older Worker (no field) or a broken shape as null, never as zero', () => {
    expect(readSpaceAttention(undefined)).toBeNull();
    expect(readSpaceAttention({ relinks: -1, moves: 0, relinkExpiresAt: null })).toBeNull();
    expect(readSpaceAttention({ relinks: 1, moves: 0.5, relinkExpiresAt: null })).toBeNull();
    expect(readSpaceAttention({ relinks: 1, moves: 0 })).toBeNull();
  });
});

describe('readSchoolAttention', () => {
  const row = { spaceId: 'space:a', relinks: 1, moves: 0, relinkExpiresAt: '2026-10-31T10:10:00.000Z' };

  it("reads a school's classes and drops a broken row", () => {
    expect(readSchoolAttention({ classes: [row, { ...row, spaceId: '' }, { ...row, spaceId: 'space:b', moves: -2 }, 'x'] })).toEqual([row]);
    expect(readSchoolAttention({ classes: [] })).toEqual([]);
  });

  it('reads anything but a list of classes as null', () => {
    for (const bad of [undefined, null, [], { classes: 'none' }, { rows: [row] }]) expect(readSchoolAttention(bad)).toBeNull();
  });
});
