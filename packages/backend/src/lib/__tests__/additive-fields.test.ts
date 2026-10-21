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

  it('keeps a stored result\'s catalogVersion when an older build re-uploads it without one (F-CURR-001 §3.13)', () => {
    const v9 = { id: 'placement:a', level: 'x', catalogVersion: 9 };
    const other = { id: 'placement:b', catalogVersion: 10 };
    const out = preserveAdditiveFields(
      incoming({ placements: [{ id: 'placement:a', level: 'x' }, { id: 'placement:c' }, 'junk'] }, { placement }),
      stored({ placements: [v9, other, 7] }, { placement }),
    );
    expect(out.payload).toEqual({ placements: [v9, { id: 'placement:c' }, 'junk'] });
    // A sent value is never overwritten, and a stored list that is not a list changes nothing.
    const sent = preserveAdditiveFields(incoming({ placements: [{ id: 'placement:a', catalogVersion: 11 }] }, {}), stored({ placements: [v9] }, {}));
    expect(sent.payload).toEqual({ placements: [{ id: 'placement:a', catalogVersion: 11 }] });
    const odd = preserveAdditiveFields(incoming({ placements: [result] }, {}), stored({ placements: { id: 'placement:a' } }, {}));
    expect(odd.payload).toEqual({ placements: [result] });
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

  it('unions a sent latch with the stored one, earliest time wins, and invents nothing when none is stored', () => {
    const next = { ...latch, stage2: '2026-11-01T08:00:00.000Z' };
    expect(preserveAdditiveFields(incoming({ stageDoneAt: next }, {}), stored({ stageDoneAt: latch }, {})).payload).toEqual({ stageDoneAt: next });
    // a client that never saw stage2 (old build, then upgraded) cannot erase it
    const lagging = preserveAdditiveFields(incoming({ stageDoneAt: { stage1: '2026-10-12T00:00:00.000Z' } }, {}), stored({ stageDoneAt: next }, {}));
    expect(lagging.payload).toEqual({ stageDoneAt: next });
    expect(preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ quests: [], stageDoneAt: {} }, {})).payload).toEqual({ quests: [] });
    expect(preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ quests: [] }, {})).payload).toEqual({ quests: [] });
  });

  it('preserves the latch and placements together for a client that predates both', () => {
    const out = preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ placements: [result], stageDoneAt: latch }, { placement }));
    expect(out.payload).toEqual({ quests: [], placements: [result], stageDoneAt: latch });
    expect(out.summary).toEqual({ placement });
  });
});

describe('the stage latch merge (server-side key union, F-ROUTE-001 section 3.15)', () => {
  const merge = ADDITIVE_FIELDS.find((f) => f.payloadKey === 'stageDoneAt')?.merge;

  it('placements still replace: their merge only keeps the nested fields an older build drops', () => {
    expect(merge).toBeDefined();
    expect(ADDITIVE_FIELDS.find((f) => f.payloadKey === 'placements')?.merge).toBeDefined();
    const out = preserveAdditiveFields(incoming({ placements: [{ id: 'placement:b' }] }, {}), stored({ placements: [result] }, {}));
    expect(out.payload).toEqual({ placements: [{ id: 'placement:b' }] });
  });

  it('unions keys, keeps the earliest time, and does not depend on argument order', () => {
    const a = { stage1: '2026-10-11T10:00:00.000Z', stage2: '2026-10-20T10:00:00.000Z' };
    const b = { stage1: '2026-10-10T10:00:00.000Z', stage4: '2026-10-15T10:00:00.000Z' };
    const expected = { stage1: '2026-10-10T10:00:00.000Z', stage2: '2026-10-20T10:00:00.000Z', stage4: '2026-10-15T10:00:00.000Z' };
    expect(merge?.(a, b)).toEqual(expected);
    expect(merge?.(b, a)).toEqual(expected);
  });

  it('compares instants, not strings: an offset time and a junk value never win wrongly', () => {
    // 08:00+09:00 is 23:00Z the day before, so it is the earlier instant
    expect(merge?.({ stage1: '2026-10-11T08:00:00+09:00' }, { stage1: '2026-10-11T00:00:00Z' })).toEqual({ stage1: '2026-10-11T08:00:00+09:00' });
    expect(merge?.({ stage1: '' }, { stage1: '2026-10-11T00:00:00.000Z' })).toEqual({ stage1: '2026-10-11T00:00:00.000Z' });
    expect(merge?.({ stage1: '2026-10-11T00:00:00.000Z' }, { stage1: 'soon' })).toEqual({ stage1: '2026-10-11T00:00:00.000Z' });
    expect(merge?.({ stage1: 'b' }, { stage1: 'a' })).toEqual({ stage1: 'a' });
  });

  it('ignores a stored value that is not a record', () => {
    expect(merge?.({ stage1: '2026-10-11T00:00:00.000Z' }, ['stage2'])).toEqual({ stage1: '2026-10-11T00:00:00.000Z' });
  });
});

describe('preserveAdditiveFields (self-route entry, F-PLAN-002 section 3.5)', () => {
  const route = { id: 'route:a', updatedAt: '2026-10-12T08:00:00.000Z', archivedAt: null };
  const counts = { done: 1, total: 3, notReady: 0, weeks: 12, endsOn: '2027-01-09' };
  const field = ADDITIVE_FIELDS.find((f) => f.payloadKey === 'selfRoute');

  it('lists selfRoute with its summary counterpart, appended after the earlier fields, and with no merge', () => {
    expect(field).toBeDefined();
    expect(field?.summaryKey).toBe('selfRoute');
    expect(field?.merge).toBeUndefined();
    expect(ADDITIVE_FIELDS.map((f) => f.payloadKey).slice(0, 3)).toEqual(['placements', 'stageDoneAt', 'selfRoute']);
  });

  it('treats a missing key and null (the schema default) as unset, a route as a value', () => {
    expect(field?.isUnset(undefined)).toBe(true);
    expect(field?.isUnset(null)).toBe(true);
    expect(field?.isUnset(route)).toBe(false);
    expect(field?.isUnset({ ...route, archivedAt: '2026-11-01T00:00:00.000Z' })).toBe(false);
  });

  it('never lets an incoming null replace a stored route, and keeps summary.selfRoute with it', () => {
    const out = preserveAdditiveFields(incoming({ quests: ['new'], selfRoute: null }, { streakDays: 3 }), stored({ quests: ['old'], selfRoute: route }, { selfRoute: counts }));
    expect(out.payload).toEqual({ quests: ['new'], selfRoute: route });
    expect(out.summary).toEqual({ streakDays: 3, selfRoute: counts });
  });

  it('lets a sent route (an archived one included) replace the stored one', () => {
    const archived = { ...route, archivedAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
    const out = preserveAdditiveFields(incoming({ selfRoute: archived }, { selfRoute: { ...counts, done: 2 } }), stored({ selfRoute: route }, { selfRoute: counts }));
    expect(out.payload).toEqual({ selfRoute: archived });
    expect(out.summary).toEqual({ selfRoute: { ...counts, done: 2 } });
  });

  it('invents nothing when no route is stored', () => {
    const inc = incoming({ selfRoute: null }, {});
    const out = preserveAdditiveFields(inc, stored({ selfRoute: null }, {}));
    expect(out.payload).toBe(inc.payload);
    expect(out.summary).toBe(inc.summary);
  });
});

describe('preserveAdditiveFields (vocab entry, F-VOC-005 section 3.3 P6)', () => {
  const slice = { v: 1, items: [{ id: 'vocab:sagwa-apple', box: 3 }], topics: [] };
  const empty = { v: 1, items: [], topics: [] };
  const counts = { collected: 1, strong: 1, topicsStarted: 1, topicsPracticed7d: 1, firstTryRate: 1, needsPractice: [] };
  const field = ADDITIVE_FIELDS.find((f) => f.payloadKey === 'vocab');

  it('lists vocab with its summary counterpart, appended after the earlier fields, and with no merge', () => {
    expect(field).toBeDefined();
    expect(field?.summaryKey).toBe('vocab');
    expect(field?.merge).toBeUndefined();
    expect(ADDITIVE_FIELDS.map((f) => f.payloadKey).slice(0, 4)).toEqual(['placements', 'stageDoneAt', 'selfRoute', 'vocab']);
  });

  it('treats only an absent key as unset: the empty slice is a value', () => {
    expect(field?.isUnset(undefined)).toBe(true);
    expect(field?.isUnset(empty)).toBe(false);
    expect(field?.isUnset(slice)).toBe(false);
  });

  it('keeps the stored slice and summary.vocab when an old build re-uploads without the key', () => {
    const out = preserveAdditiveFields(incoming({ quests: ['new'] }, { streakDays: 3 }), stored({ quests: ['old'], vocab: slice }, { vocab: counts }));
    expect(out.payload).toEqual({ quests: ['new'], vocab: slice });
    expect(out.summary).toEqual({ streakDays: 3, vocab: counts });
  });

  it('lets a sent slice replace the stored one, the empty slice of a reset included, with its own summary', () => {
    const reset = preserveAdditiveFields(incoming({ vocab: empty }, { streakDays: 0 }), stored({ vocab: slice }, { vocab: counts }));
    expect(reset.payload).toEqual({ vocab: empty });
    expect(reset.summary).toEqual({ streakDays: 0 });
    const next = { ...slice, items: [{ id: 'vocab:sagwa-apple', box: 4 }] };
    const sent = preserveAdditiveFields(incoming({ vocab: next }, { vocab: { ...counts, strong: 2 } }), stored({ vocab: slice }, { vocab: counts }));
    expect(sent.payload).toEqual({ vocab: next });
    expect(sent.summary).toEqual({ vocab: { ...counts, strong: 2 } });
  });

  it('invents nothing when no slice is stored', () => {
    const out = preserveAdditiveFields(incoming({ quests: [] }, {}), stored({ quests: [] }, { vocab: counts }));
    expect(out.payload).toEqual({ quests: [] });
    expect(out.summary).toEqual({});
  });
});

describe('preserveAdditiveFields (quest latch entry, F-REPORT-001 section 3.3.1, RP-W1)', () => {
  const latch = { 'letters-q1': '2026-10-01T09:00:00.000Z', 'letters-q2': '2026-10-05T10:00:00.000Z' };
  const activity = { v: 1, tz: 540, asOf: '2026-10-11', days: [], months: [], total: { since: null, min: 12, q: 0, c: 0, w: 0, days: 1 }, milestones: [] };
  const field = ADDITIVE_FIELDS.find((f) => f.payloadKey === 'questDoneAt');

  it('lists questDoneAt with summary.activity as its counterpart, appended after every earlier field, with a merge', () => {
    expect(field).toBeDefined();
    expect(field?.summaryKey).toBe('activity');
    expect(field?.merge).toBeDefined();
    expect(ADDITIVE_FIELDS.map((f) => f.payloadKey).slice(0, 5)).toEqual(['placements', 'stageDoneAt', 'selfRoute', 'vocab', 'questDoneAt']);
  });

  it('treats only an absent key as unset: an empty record is a value (the VOCAB rule, not the stage-latch rule)', () => {
    expect(field?.isUnset(undefined)).toBe(true);
    expect(field?.isUnset({})).toBe(false);
    expect(field?.isUnset(latch)).toBe(false);
    expect(field?.isUnset(null)).toBe(false);
  });

  it('keeps the stored latch and summary.activity when an old build re-uploads without the key', () => {
    const out = preserveAdditiveFields(incoming({ quests: ['new'] }, { streakDays: 3 }), stored({ quests: ['old'], questDoneAt: latch }, { streakDays: 1, activity }));
    expect(out.payload).toEqual({ quests: ['new'], questDoneAt: latch });
    expect(out.summary).toEqual({ streakDays: 3, activity });
  });

  it('keeps a stored empty latch and summary.activity too: a learner with sessions but no finished quest', () => {
    const out = preserveAdditiveFields(incoming({ quests: [] }, { streakDays: 0 }), stored({ quests: [], questDoneAt: {} }, { activity }));
    expect(out.payload).toEqual({ quests: [], questDoneAt: {} });
    expect(out.summary).toEqual({ streakDays: 0, activity });
  });

  it('unions a sent record with the stored one, earliest time wins, so a lagging device erases nothing', () => {
    const sent = { 'letters-q1': '2026-10-09T00:00:00.000Z', 'letters-q3': '2026-10-10T08:00:00.000Z' };
    const fresh = { ...activity, total: { ...activity.total, q: 3 } };
    const out = preserveAdditiveFields(incoming({ questDoneAt: sent }, { activity: fresh }), stored({ questDoneAt: latch }, { activity }));
    expect(out.payload).toEqual({ questDoneAt: { ...latch, 'letters-q3': sent['letters-q3'] } });
    // a build that sends the latch computes its own activity: the sent summary is kept as sent
    expect(out.summary).toEqual({ activity: fresh });
  });

  it('an explicit empty record (a profile reset) is unioned, never a delete; its own summary is kept as sent', () => {
    const reset = { ...activity, total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 } };
    const out = preserveAdditiveFields(incoming({ questDoneAt: {} }, { activity: reset }), stored({ questDoneAt: latch }, { activity }));
    expect(out.payload).toEqual({ questDoneAt: latch });
    expect(out.summary).toEqual({ activity: reset });
  });

  it('a sent record without a summary.activity keeps the stored one (a build with the latch writer but not the activity builder)', () => {
    const sent = { 'letters-q3': '2026-10-10T08:00:00.000Z' };
    const out = preserveAdditiveFields(incoming({ questDoneAt: sent }, { streakDays: 2 }), stored({ questDoneAt: latch }, { activity }));
    // the latch is still unioned, and the stored activity (dated by its own asOf) is never erased
    expect(out.payload).toEqual({ questDoneAt: { ...latch, ...sent } });
    expect(out.summary).toEqual({ streakDays: 2, activity });
  });

  it('a sent record keeps the stored summary.activity for an explicit empty record too, and invents none when none is stored', () => {
    const kept = preserveAdditiveFields(incoming({ questDoneAt: {} }, {}), stored({ questDoneAt: latch }, { activity }));
    expect(kept.summary).toEqual({ activity });
    for (const prior of [stored({ questDoneAt: latch }, {}), stored({ questDoneAt: latch }, null), stored({ questDoneAt: latch }, { activity: undefined })]) {
      expect(preserveAdditiveFields(incoming({ questDoneAt: latch }, { streakDays: 2 }), prior).summary).toEqual({ streakDays: 2 });
    }
  });

  it('only the quest latch and the seeding marker keep a stored summary when the field itself is sent: a sent placement list travels with exactly the summary sent', () => {
    expect(ADDITIVE_FIELDS.filter((f) => f.keepStoredSummaryWhenSent).map((f) => f.payloadKey)).toEqual(['questDoneAt', 'memSeededAt']);
    const out = preserveAdditiveFields(incoming({ placements: [{ id: 'placement:b' }] }, {}), stored({ placements: [result] }, { placement }));
    expect(out.summary).toEqual({});
  });

  it('invents nothing when no latch is stored, even when the stored summary has an activity', () => {
    const inc = incoming({ quests: [] }, {});
    const out = preserveAdditiveFields(inc, stored({ quests: [] }, { activity }));
    expect(out.payload).toBe(inc.payload);
    expect(out.summary).toBe(inc.summary);
  });

  it('merges with the stage-latch comparator: instants, not strings, and junk never wins', () => {
    const merge = field?.merge;
    expect(merge?.({ q: '2026-10-11T08:00:00+09:00' }, { q: '2026-10-11T00:00:00Z' })).toEqual({ q: '2026-10-11T08:00:00+09:00' });
    expect(merge?.({ q: 'soon' }, { q: '2026-10-11T00:00:00.000Z' })).toEqual({ q: '2026-10-11T00:00:00.000Z' });
    // two unparseable values fall back to the string order, whichever side holds the smaller one
    expect(merge?.({ q: 'a' }, { q: 'b' })).toEqual({ q: 'a' });
    expect(merge?.({ q: 'b' }, { q: 'a' })).toEqual({ q: 'a' });
    expect(merge?.({ q: 7, r: '2026-10-12T00:00:00.000Z' }, ['x'])).toEqual({ r: '2026-10-12T00:00:00.000Z' });
    expect(merge?.({ b: '2026-10-12T00:00:00.000Z', a: '2026-10-11T00:00:00.000Z' }, {})).toEqual({ a: '2026-10-11T00:00:00.000Z', b: '2026-10-12T00:00:00.000Z' });
    expect(Object.keys(merge?.({ b: '2026-10-12T00:00:00.000Z', a: '2026-10-11T00:00:00.000Z' }, {}) as object)).toEqual(['a', 'b']);
  });

  it('preserves the quest latch, the stage latch and vocab together for a client that predates all three', () => {
    const slice = { v: 1, items: [], topics: [] };
    const out = preserveAdditiveFields(
      incoming({ quests: [] }, {}),
      stored({ quests: [], stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' }, vocab: slice, questDoneAt: latch }, { vocab: { n: 0 }, activity }),
    );
    expect(out.payload).toEqual({ quests: [], stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' }, vocab: slice, questDoneAt: latch });
    expect(out.summary).toEqual({ vocab: { n: 0 }, activity });
  });
});
