import { CATALOG, type PlanItem, type PracticeDaysEntry, type Weekday } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it } from 'vitest';
import { blendedMeta } from '../../homework/__tests__/curriculum-fixture';
import type { DeriveSource } from '../../homework/plan-derivation';
import { placeSourceForLearner } from '../place-learner-days';
import {
  CHIP_DAYS,
  daysForCount,
  learnerDaysOf,
  needsPlacer,
  practiceDaysChangedEvent,
  practiceDaysWrite,
  placementFrom,
  practicePlacerReady,
  setPracticePlacer,
  toggleDay,
  withLearnerDays,
} from '../practice-days';

/** AMENDMENTS-ROUTE-CLASS-BLEND section 9.4 (row BL-8; wireframe B7): the learner's own practice days on the device. */

afterEach(() => setPracticePlacer(null));

const entry = (planId: string, days: Weekday[], updatedAt: string): PracticeDaysEntry => ({ planId, days, updatedAt });

describe('the chips (B7)', () => {
  it('start on Sunday, as the app\'s weekday control', () => {
    expect(CHIP_DAYS).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  });

  it('a count keeps the chosen days and adds from the class default, then non-class days, then class days', () => {
    const defaults: Weekday[] = ['wed', 'fri', 'sun'];
    expect(daysForCount(['wed', 'fri', 'sun'], 1, defaults, ['tue'])).toEqual(['wed']);
    expect(daysForCount(['wed', 'fri', 'sun'], 2, defaults, ['tue'])).toEqual(['wed', 'fri']);
    expect(daysForCount(['sat'], 3, defaults, ['tue'])).toEqual(['wed', 'fri', 'sat']);
    expect(daysForCount(['wed', 'fri', 'sun'], 6, defaults, ['tue'])).toEqual(['mon', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(daysForCount(['wed'], 7, defaults, ['tue'])).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    // A learner who picked the class day keeps it while the count allows.
    expect(daysForCount(['tue'], 2, defaults, ['tue'])).toEqual(['tue', 'wed']);
  });

  it('a count outside 1 to 7 is refused', () => {
    for (const n of [0, 8, 2.5]) expect(() => daysForCount([], n, [], ['tue'])).toThrow(RangeError);
  });

  it('a weekday chip turns a day on or off, never the last one off', () => {
    expect(toggleDay(['wed', 'fri'], 'tue')).toEqual(['tue', 'wed', 'fri']);
    expect(toggleDay(['wed', 'fri'], 'fri')).toEqual(['wed']);
    expect(toggleDay(['wed'], 'wed')).toEqual(['wed']);
    expect(toggleDay(['sun', 'mon'], 'sun')).toEqual(['mon']);
  });
});

describe('snapshot.practiceDays write (section 9.4)', () => {
  const a1 = entry('plan:a', ['wed'], '2026-11-01T00:00:00.000Z');
  const b = entry('plan:b', ['sat'], '2026-11-01T00:00:00.000Z');
  const gone = entry('plan:gone', ['mon'], '2026-11-01T00:00:00.000Z');

  it('replaces this plan\'s entry and stores the days in week order', () => {
    expect(practiceDaysWrite([a1, b], entry('plan:a', ['sun', 'tue'], '2026-11-02T00:00:00.000Z'), ['plan:a', 'plan:b'])).toEqual([
      entry('plan:a', ['tue', 'sun'], '2026-11-02T00:00:00.000Z'),
      b,
    ]);
    expect(practiceDaysWrite(undefined, a1, ['plan:a'])).toEqual([a1]);
  });

  it('drops the days of a plan the learner no longer has (discarded with its plan)', () => {
    expect(practiceDaysWrite([gone, b], a1, ['plan:a', 'plan:b'])).toEqual([a1, b]);
  });

  it('keeps at most three, the newest', () => {
    const many = ['plan:c', 'plan:d', 'plan:e'].map((id, i) => entry(id, ['mon'], `2026-10-0${i + 1}T00:00:00.000Z`));
    const out = practiceDaysWrite(many, a1, ['plan:a', 'plan:c', 'plan:d', 'plan:e']);
    expect(out.map((e) => e.planId)).toEqual(['plan:a', 'plan:d', 'plan:e']);
  });

  it('reads the learner\'s days of a plan, or undefined', () => {
    expect(learnerDaysOf([a1], 'plan:a')).toEqual(['wed']);
    expect(learnerDaysOf([a1], 'plan:b')).toBeUndefined();
    expect(learnerDaysOf(undefined, 'plan:a')).toBeUndefined();
    expect(learnerDaysOf([{ ...a1, days: [] }], 'plan:a')).toBeUndefined();
  });
});

describe('route.practice_days_changed (section 18)', () => {
  it('sends the count and who changed them, never a weekday or an id', () => {
    expect(practiceDaysChangedEvent(['tue', 'thu'], 'self')).toEqual({ name: 'route.practice_days_changed', payload: { days: 2, by: 'self' } });
    expect(practiceDaysChangedEvent(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 'grownup')).toEqual({ name: 'route.practice_days_changed', payload: { days: 7, by: 'grownup' } });
    expect(JSON.stringify(practiceDaysChangedEvent(['tue'], 'self'))).not.toMatch(/tue|plan:/);
  });
});

/** A Thursday class with practice on Fri, Sun, Tue, two lessons a class (real catalogue quests). */
const quests = CATALOG.quests.filter((q) => q.kind === 'lesson').slice(0, 4);
const blended = (): DeriveSource => ({
  id: 'plan:thu',
  kind: 'class',
  assignedAt: '2026-11-01T00:00:00.000Z',
  items: [
    { kind: 'quest', id: (quests[0] as { id: string }).id, lectureDate: '2026-11-05', targetDate: '2026-11-06' },
    { kind: 'quest', id: (quests[1] as { id: string }).id, lectureDate: '2026-11-05', targetDate: '2026-11-08' },
    { kind: 'quest', id: (quests[2] as { id: string }).id, lectureDate: '2026-11-12', targetDate: '2026-11-13' },
    { kind: 'episode', id: (quests[3] as { episodeId: string }).episodeId, lectureDate: '2026-11-12', targetDate: '2026-11-15' },
  ] satisfies PlanItem[],
  meta: blendedMeta({ startDate: '2026-11-02', weeks: 2, lectureDays: ['thu'], practiceDays: ['fri', 'sun', 'tue'], refresh: [{ date: '2026-11-10', cellIds: ['episode:x'] }] }),
});

describe('placeSourceForLearner (the chunk\'s placer)', () => {
  it('moves the practice items to the learner\'s days, after each class, keeping every other field', () => {
    const out = placeSourceForLearner(blended(), ['tue'], '2026-11-02');
    // The episode (a whole cell's minutes) does not fit beside the lesson on the last Tuesday (1.5 x 10 minutes) and
    // there is no later cycle: it keeps its plan date.
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-10', '2026-11-10', '2026-11-17', '2026-11-15']);
    expect(out.items.map((item) => item.id)).toEqual(blended().items.map((item) => item.id));
    expect(out.items[0]).toEqual({ ...blended().items[0], targetDate: '2026-11-10' });
    // No learner Tuesday holds a lesson of the Thursday after it.
    for (const item of out.items) expect((item.targetDate as string) > (item.lectureDate as string)).toBe(true);
  });

  it('keeps an item already on a learner day as the same object, and a plan without blend as it is', () => {
    const out = placeSourceForLearner(blended(), ['fri', 'sun', 'tue'], '2026-11-02');
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-06', '2026-11-08', '2026-11-13', '2026-11-15']);
    const plain: DeriveSource = { ...blended(), meta: null };
    expect(placeSourceForLearner(plain, ['tue'], '2026-11-02')).toBe(plain);
    const { blend: _b, ...params } = blended().meta!.params;
    const unblended: DeriveSource = { ...blended(), meta: { ...blended().meta!, params } };
    expect(placeSourceForLearner(unblended, ['tue'], '2026-11-02')).toBe(unblended);
  });

  it('moves Refresh with the days, and leaves what is before `from` alone', () => {
    const out = placeSourceForLearner(blended(), ['sat', 'mon'], '2026-11-09');
    // 6 and 8 November are before `from` (the day the days took effect): they keep their dates.
    expect(out.items.slice(0, 2).map((item) => item.targetDate)).toEqual(['2026-11-06', '2026-11-08']);
    expect(out.meta?.refresh?.every((e) => ['sat', 'mon'].includes(new Date(`${e.date}T00:00:00Z`).toUTCString().slice(0, 3).toLowerCase()))).toBe(true);
  });

  it('writes no refresh key on a plan that had none and gets none', () => {
    const { refresh: _r, ...meta } = blended().meta!;
    const out = placeSourceForLearner({ ...blended(), items: [], meta }, ['tue'], '2026-11-02');
    expect(out.meta && 'refresh' in out.meta).toBe(false);
  });

  it('reads a plan day off, and an unknown quest or episode as 0 minutes', () => {
    const source = blended();
    const meta = { ...source.meta!, params: { ...source.meta!.params, daysOff: [{ from: '2026-11-10', to: '2026-11-10' }] } };
    const items: PlanItem[] = [...source.items, { kind: 'quest', id: 'quest:unknown', lectureDate: '2026-11-05', targetDate: '2026-11-06' }, { kind: 'episode', id: 'episode:unknown', lectureDate: '2026-11-05', targetDate: '2026-11-06' }, { kind: 'quest', id: 'quest:late', targetDate: '2026-11-24' }];
    const out = placeSourceForLearner({ ...source, items, meta }, ['tue', 'wed'], '2026-11-02');
    expect(out.items.some((item) => item.targetDate === '2026-11-10')).toBe(false);
    expect(out.items[4]?.targetDate).toBe('2026-11-11');
    // An item past the route's end (a plan the teacher extended) still reaches a learner day near it.
    expect(out.items[6]?.targetDate).toBe('2026-11-24');
  });
});

describe('withLearnerDays', () => {
  const days = [entry('plan:thu', ['tue'], '2026-11-01T00:00:00.000Z')];

  it('keeps the plan dates until the placer is in', () => {
    expect(practicePlacerReady()).toBe(false);
    const sources = [blended()];
    expect(withLearnerDays(sources, days, '2026-11-02')).toEqual(sources);
    expect(needsPlacer(sources, days)).toBe(true);
    expect(needsPlacer(sources, [])).toBe(false);
    expect(needsPlacer(sources, undefined)).toBe(false);
  });

  it('re-dates only blended class plans the learner moved days for', () => {
    setPracticePlacer(placeSourceForLearner);
    expect(practicePlacerReady()).toBe(true);
    const own: DeriveSource = { ...blended(), id: 'route:mine', kind: 'self' };
    const other: DeriveSource = { ...blended(), id: 'plan:other' };
    const plain: DeriveSource = { ...blended(), id: 'plan:plain', meta: null };
    const out = withLearnerDays([blended(), own, other, plain], days, '2026-11-02');
    expect(out[0]?.items[0]?.targetDate).toBe('2026-11-10');
    expect(out[1]).toEqual(own);
    expect(out[2]).toEqual(other);
    expect(out[3]).toEqual(plain);
    expect(withLearnerDays([blended()], [], '2026-11-02')[0]).toEqual(blended());
    expect(needsPlacer([own], [entry('route:mine', ['tue'], '2026-11-01T00:00:00.000Z')])).toBe(false);
  });

  it('keeps the learner\'s dates as the days pass: placement counts from the day the days were saved, not today', () => {
    setPracticePlacer(placeSourceForLearner);
    const saved = [entry('plan:thu', ['tue'], '2026-11-05T09:00:00.000Z')];
    const on = (today: string): Array<string | undefined> => (withLearnerDays([blended()], saved, today)[0] as DeriveSource).items.map((item) => item.targetDate);
    const first = on('2026-11-05');
    // The Thursday class's lessons sit on the learner's Tuesday, never on the class default Friday or Sunday.
    expect(first.slice(0, 2)).toEqual(['2026-11-10', '2026-11-10']);
    // Friday, Saturday, Monday, Tuesday and after: the same dates, nothing drifts back to a plan date already past.
    for (const today of ['2026-11-06', '2026-11-07', '2026-11-09', '2026-11-10', '2026-11-14']) expect(on(today)).toEqual(first);
  });
});

describe('placementFrom', () => {
  it('is the day the days were saved, or today when the stamp is later than today or unreadable', () => {
    expect(placementFrom({ updatedAt: '2026-11-05T09:00:00.000Z' }, '2026-11-09')).toBe('2026-11-05');
    expect(placementFrom({ updatedAt: '2026-11-05T09:00:00+09:00' }, '2026-11-09')).toBe('2026-11-05');
    expect(placementFrom({ updatedAt: '2026-11-12T00:00:00.000Z' }, '2026-11-09')).toBe('2026-11-09');
    expect(placementFrom({ updatedAt: 'not a time' }, '2026-11-09')).toBe('2026-11-09');
  });
});
