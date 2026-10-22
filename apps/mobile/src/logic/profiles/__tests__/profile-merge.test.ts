import { describe, expect, it } from 'vitest';
import {
  EMPTY_TOMBSTONES,
  TOMBSTONE_KEEP_MS,
  addTombstone,
  mergeProfileLists,
  parseTombstones,
  pruneTombstones,
  removeTombstone,
  sameProfileList,
  storedProfileItems,
} from '../profile-merge';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, CS-16 (row OA-4a): one profile list across tabs.

const T0 = 1_800_000_000_000;
const p = (id: string, displayName = id) => ({ id: `profile:${id}`, displayName });

describe('mergeProfileLists', () => {
  it('a learner added in another tab survives a change here', () => {
    const merged = mergeProfileLists({ stored: [p('a'), p('b')], local: [p('a')], seen: new Set(['profile:a']), removed: [] });
    expect(merged.map((x) => x.id)).toEqual(['profile:a', 'profile:b']);
  });

  it('a learner added here, not yet stored, is kept after the stored list', () => {
    const merged = mergeProfileLists({ stored: [p('a')], local: [p('a'), p('c')], seen: new Set(['profile:a', 'profile:c']), removed: [] });
    expect(merged.map((x) => x.id)).toEqual(['profile:a', 'profile:c']);
  });

  it('the stored copy wins for an id both hold (the other tab wrote last)', () => {
    const merged = mergeProfileLists({ stored: [p('a', 'Mimi')], local: [p('a', 'Mina')], seen: new Set(['profile:a']), removed: [] });
    expect(merged).toEqual([p('a', 'Mimi')]);
  });

  it('a removal recorded in a tombstone wins on both sides: a removed learner does not come back', () => {
    const fromStale = mergeProfileLists({ stored: [p('a')], local: [p('a'), p('b')], seen: new Set(['profile:a', 'profile:b']), removed: ['profile:b'] });
    expect(fromStale.map((x) => x.id)).toEqual(['profile:a']);
    const stillStored = mergeProfileLists({ stored: [p('a'), p('b')], local: [p('a')], seen: new Set(), removed: ['profile:b'] });
    expect(stillStored.map((x) => x.id)).toEqual(['profile:a']);
  });

  it('an id this tab saw and no longer holds was removed here, and is not taken back', () => {
    const merged = mergeProfileLists({ stored: [p('a'), p('b')], local: [p('a')], seen: new Set(['profile:a', 'profile:b']), removed: [] });
    expect(merged.map((x) => x.id)).toEqual(['profile:a']);
  });

  it('a repeated id is kept once, and the inputs are not changed', () => {
    const stored = [p('a'), p('a')];
    const local = [p('a')];
    expect(mergeProfileLists({ stored, local, seen: new Set(), removed: [] })).toHaveLength(1);
    expect(stored).toHaveLength(2);
  });
});

describe('tombstones', () => {
  it('parses leniently: junk reads as none, malformed ids drop, a missing time reads as 0', () => {
    expect(parseTombstones(null)).toEqual(EMPTY_TOMBSTONES);
    expect(parseTombstones('x')).toEqual(EMPTY_TOMBSTONES);
    expect(parseTombstones({ v: 2, ids: [] })).toEqual(EMPTY_TOMBSTONES);
    expect(parseTombstones({ v: 1, ids: 'profile:a' })).toEqual(EMPTY_TOMBSTONES);
    expect(parseTombstones({ v: 1, ids: ['profile:a', 'profile:a', 'Mina', 7], at: { 'profile:a': T0 } })).toEqual({ v: 1, ids: ['profile:a'], at: { 'profile:a': T0 } });
    expect(parseTombstones({ v: 1, ids: ['profile:b'], at: null })).toEqual({ v: 1, ids: ['profile:b'], at: { 'profile:b': 0 } });
    expect(parseTombstones({ v: 1, ids: ['profile:b'], at: { 'profile:b': 'soon' } }).at['profile:b']).toBe(0);
  });

  it('adds an id once, keeping the first time', () => {
    const one = addTombstone(EMPTY_TOMBSTONES, 'profile:a', T0);
    expect(one).toEqual({ v: 1, ids: ['profile:a'], at: { 'profile:a': T0 } });
    expect(addTombstone(one, 'profile:a', T0 + 5)).toBe(one);
  });

  it('prunes ids removed 30 days ago or more; a future time stays', () => {
    let record = addTombstone(EMPTY_TOMBSTONES, 'profile:old', T0);
    record = addTombstone(record, 'profile:new', T0 + TOMBSTONE_KEEP_MS - 1);
    record = addTombstone(record, 'profile:future', T0 + 2 * TOMBSTONE_KEEP_MS);
    const pruned = pruneTombstones(record, T0 + TOMBSTONE_KEEP_MS);
    expect(pruned.ids).toEqual(['profile:new', 'profile:future']);
    expect(pruned.at).toEqual({ 'profile:new': T0 + TOMBSTONE_KEEP_MS - 1, 'profile:future': T0 + 2 * TOMBSTONE_KEEP_MS });
    expect(pruneTombstones(pruned, T0 + TOMBSTONE_KEEP_MS)).toBe(pruned);
  });
});

describe('pruneTombstones on a hand-made record', () => {
  it('an id with no time reads as removed long ago', () => {
    const record = { v: 1 as const, ids: ['profile:a', 'profile:b'], at: { 'profile:b': T0 } };
    expect(pruneTombstones(record, T0 + 1)).toEqual({ v: 1, ids: ['profile:b'], at: { 'profile:b': T0 } });
    const keepBoth = { v: 1 as const, ids: ['profile:a', 'profile:b'], at: { 'profile:b': T0 } };
    expect(pruneTombstones(keepBoth, 5)).toBe(keepBoth);
    // A second id goes while one with no time stays: the kept one is written with 0.
    const mixed = { v: 1 as const, ids: ['profile:a', 'profile:c'], at: { 'profile:c': -TOMBSTONE_KEEP_MS } };
    expect(pruneTombstones(mixed, 5)).toEqual({ v: 1, ids: ['profile:a'], at: { 'profile:a': 0 } });
  });
});

describe('removeTombstone (OA-D13: a restore under the same id)', () => {
  it('drops the id and its time, and returns the same record when the id is not in it', () => {
    const record = addTombstone(addTombstone(EMPTY_TOMBSTONES, 'profile:a1', 10), 'profile:b1', 20);
    expect(removeTombstone(record, 'profile:a1')).toEqual({ v: 1, ids: ['profile:b1'], at: { 'profile:b1': 20 } });
    expect(removeTombstone(record, 'profile:c1')).toBe(record);
    expect(record.ids).toEqual(['profile:a1', 'profile:b1']);
  });

  it('a revived id is kept by the merge again', () => {
    const record = removeTombstone(addTombstone(EMPTY_TOMBSTONES, 'profile:a1', 10), 'profile:a1');
    const a = { id: 'profile:a1' };
    expect(mergeProfileLists({ stored: [a], local: [], seen: new Set(), removed: record.ids })).toEqual([a]);
  });
});

describe('storedProfileItems (a damaged hr:profiles never stops a write)', () => {
  it('keeps the objects with a string id, in order; anything else is none', () => {
    const a = { id: 'profile:a1' };
    const b = { id: 'profile:b1', displayName: 'Bo' };
    expect(storedProfileItems([a, null, 3, 'x', { id: 4 }, { id: '' }, {}, b])).toEqual([a, b]);
    expect(storedProfileItems(null)).toEqual([]);
    expect(storedProfileItems({ id: 'profile:a1' })).toEqual([]);
  });
});

describe('sameProfileList', () => {
  it('compares order and content', () => {
    expect(sameProfileList([p('a')], [p('a')])).toBe(true);
    expect(sameProfileList([p('a'), p('b')], [p('b'), p('a')])).toBe(false);
    expect(sameProfileList([p('a')], [])).toBe(false);
    expect(sameProfileList([p('a', 'Mina')], [p('a', 'Mimi')])).toBe(false);
  });
});
