import { describe, expect, it } from 'vitest';
import { ADDITIVE_FIELDS, preserveAdditiveFields, type AdditiveField } from '../additive-fields';

const result = { id: 'placement:a' };
const placement = { takenAt: 't', overridden: false };
const stored = (payload: unknown, summary: unknown) => ({ payload, summary });
const incoming = (payload: Record<string, unknown>, summary: Record<string, unknown>) => ({ payload, summary });

describe('preserveAdditiveFields (the Worker preserve rule, placement entry)', () => {
  it('lists the placement fields', () => {
    expect(ADDITIVE_FIELDS.map((f) => [f.payloadKey, f.summaryKey])).toContainEqual(['placements', 'placement']);
  });

  it('keeps stored placements and summary.placement when an old client sends neither', () => {
    const out = preserveAdditiveFields(
      incoming({ quests: ['new'], placements: [] }, { streakDays: 3 }),
      stored({ quests: ['old'], placements: [result] }, { streakDays: 1, placement }),
    );
    expect(out.payload).toEqual({ quests: ['new'], placements: [result] });
    expect(out.summary).toEqual({ streakDays: 3, placement });
  });

  it('also covers an incoming snapshot with the key missing altogether', () => {
    const out = preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ placements: [result] }, { placement }));
    expect(out.payload).toEqual({ quests: [], placements: [result] });
    expect(out.summary).toEqual({ placement });
  });

  it('lets a client that sends placements replace the stored list (it is append-only on the client)', () => {
    const next = { id: 'placement:b' };
    const out = preserveAdditiveFields(
      incoming({ placements: [result, next] }, { placement: { ...placement, takenAt: 'later' } }),
      stored({ placements: [result] }, { placement }),
    );
    expect(out.payload).toEqual({ placements: [result, next] });
    expect(out.summary).toEqual({ placement: { ...placement, takenAt: 'later' } });
  });

  it('does not invent the fields when nothing is stored', () => {
    const inc = incoming({ quests: [], placements: [] }, { streakDays: 0 });
    for (const prior of [null, stored(null, null), stored('text', 7), stored({ placements: [] }, {}), stored({}, undefined)]) {
      const out = preserveAdditiveFields(inc, prior);
      expect(out.payload).toEqual({ quests: [], placements: [] });
      expect(out.summary).toEqual({ streakDays: 0 });
    }
  });

  it('keeps an incoming summary.placement and fills the summary only when the payload was preserved', () => {
    const own = { takenAt: 'mine', overridden: true };
    const withOwn = preserveAdditiveFields(incoming({ placements: [] }, { placement: own }), stored({ placements: [result] }, { placement }));
    expect(withOwn.payload).toEqual({ placements: [result] });
    expect(withOwn.summary).toEqual({ placement: own });

    // payload kept, but the stored summary never had a block: nothing to invent
    const noBlock = preserveAdditiveFields(incoming({ placements: [] }, {}), stored({ placements: [result] }, {}));
    expect(noBlock.summary).toEqual({});
  });

  it('does not touch other keys and does not mutate its inputs', () => {
    const inc = incoming({ quests: ['q'], placements: [] }, { streakDays: 2 });
    const prior = stored({ quests: ['x'], other: 1, placements: [result] }, { streakDays: 9, placement });
    const incCopy = JSON.parse(JSON.stringify(inc));
    const priorCopy = JSON.parse(JSON.stringify(prior));
    const out = preserveAdditiveFields(inc, prior);
    expect(out.payload).not.toHaveProperty('other');
    expect(inc).toEqual(incCopy);
    expect(prior).toEqual(priorCopy);
  });

  it('returns the incoming objects themselves when nothing is preserved', () => {
    const inc = incoming({ placements: [result] }, {});
    const out = preserveAdditiveFields(inc, stored({ placements: [result] }, {}));
    expect(out.payload).toBe(inc.payload);
    expect(out.summary).toBe(inc.summary);
  });

  it('is generic: another additive key (absent = unset, an empty value counts as a value) follows the same rule', () => {
    const vocab: AdditiveField = { payloadKey: 'vocab', summaryKey: 'vocab', isUnset: (v) => v === undefined };
    const slice = { v: 1, items: [], topics: [] };
    const kept = preserveAdditiveFields(incoming({}, {}), stored({ vocab: slice }, { vocab: { n: 1 } }), [vocab]);
    expect(kept).toEqual({ payload: { vocab: slice }, summary: { vocab: { n: 1 } } });
    // an explicit empty slice is a value and replaces
    const replaced = preserveAdditiveFields(incoming({ vocab: slice }, {}), stored({ vocab: { v: 1, items: ['x'], topics: [] } }, { vocab: { n: 1 } }), [vocab]);
    expect(replaced.payload).toEqual({ vocab: slice });
    expect(replaced.summary).toEqual({});
    // a field without a summary key
    const noSummary: AdditiveField = { payloadKey: 'selfRoute', isUnset: (v) => v === undefined || v === null };
    const route = preserveAdditiveFields(incoming({ selfRoute: null }, { a: 1 }), stored({ selfRoute: { id: 'route:a' } }, { a: 0 }), [noSummary]);
    expect(route).toEqual({ payload: { selfRoute: { id: 'route:a' } }, summary: { a: 1 } });
  });
});

describe('preserveAdditiveFields (stage latch entry, F-ROUTE-001 section 3.15)', () => {
  const latch = { stage1: '2026-10-11T09:30:00.000Z' };
  const field = ADDITIVE_FIELDS.find((f) => f.payloadKey === 'stageDoneAt');

  it('lists stageDoneAt with no summary counterpart, appended after placements', () => {
    expect(field).toBeDefined();
    expect(field?.summaryKey).toBeUndefined();
    expect(ADDITIVE_FIELDS.map((f) => f.payloadKey).indexOf('stageDoneAt')).toBeGreaterThan(ADDITIVE_FIELDS.map((f) => f.payloadKey).indexOf('placements'));
  });

  it('treats a missing key and an empty record as unset, anything else as a value', () => {
    expect(field?.isUnset(undefined)).toBe(true);
    expect(field?.isUnset({})).toBe(true);
    expect(field?.isUnset(latch)).toBe(false);
    // values the schema rejects never reach the rule; they still are not "unset"
    expect(field?.isUnset(null)).toBe(false);
    expect(field?.isUnset([])).toBe(false);
  });

  it('keeps the stored latch when an old client leaves the key out, and leaves the summary alone', () => {
    const out = preserveAdditiveFields(incoming({ quests: ['new'] }, { streakDays: 3 }), stored({ quests: ['old'], stageDoneAt: latch }, { streakDays: 1 }));
    expect(out.payload).toEqual({ quests: ['new'], stageDoneAt: latch });
    expect(out.summary).toEqual({ streakDays: 3 });
  });

  it('keeps the stored latch against an empty record', () => {
    const out = preserveAdditiveFields(incoming({ stageDoneAt: {} }, {}), stored({ stageDoneAt: latch }, {}));
    expect(out.payload).toEqual({ stageDoneAt: latch });
  });

  it('lets a sent latch replace the stored one and invents nothing when none is stored', () => {
    const next = { ...latch, stage2: '2026-11-01T08:00:00.000Z' };
    expect(preserveAdditiveFields(incoming({ stageDoneAt: next }, {}), stored({ stageDoneAt: latch }, {})).payload).toEqual({ stageDoneAt: next });
    expect(preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ quests: [], stageDoneAt: {} }, {})).payload).toEqual({ quests: [] });
    expect(preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ quests: [] }, {})).payload).toEqual({ quests: [] });
  });

  it('preserves the latch and placements together for a client that predates both', () => {
    const out = preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ placements: [result], stageDoneAt: latch }, { placement }));
    expect(out.payload).toEqual({ quests: [], placements: [result], stageDoneAt: latch });
    expect(out.summary).toEqual({ placement });
  });
});
