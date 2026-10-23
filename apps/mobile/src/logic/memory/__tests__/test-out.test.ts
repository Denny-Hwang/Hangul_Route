import { CATALOG, MemoryItemStateSchema, mergeLatchRecord } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../vocab/srs';
import { deriveSeed, seedInputKey, SEED_PER_DAY } from '../seed';
import { applyAnswer } from '../spacing';
import { cellStoreItems, deriveTestedOut, testOutPlacement, TEST_OUT_SPREAD_DAYS } from '../test-out';
import { ITEMS, RETIRED, finished, utcDay } from './fixtures';

/**
 * F-CURR-002 section 4.5 "Test-out details" (row CM-21): asked items placed by their result, unasked items derived
 * from `testedOut` at box 1 over the next 3 days within the cap, the same on two devices, and the merges of the
 * latches. The local day is injected, so the fixed-clock cases pin each time zone.
 */

const CELL = 'episode:stage2-letters';
const AT = '2026-10-22T08:00:00.000Z';
const DAY = '2026-10-22';
const zoned = (timeZone: string) => (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const derive = (testedOut: Record<string, string>, dayOf = utcDay, seeded = new Map()) => deriveTestedOut({ testedOut, items: ITEMS, retired: RETIRED, seeded, dayOf });
const perDay = (states: Iterable<{ state: { d: string | null } }>): Map<string, number> => {
  const out = new Map<string, number>();
  for (const { state } of states) out.set(state.d as string, (out.get(state.d as string) ?? 0) + 1);
  return out;
};

describe('asked items: placed by their result (testOutPlacement)', () => {
  it('a right first try goes to box 2, due in 3 days, with its rung passed', () => {
    const st = testOutPlacement({ correct: true, rung: 'read' }, true, DAY, AT);
    expect(st).toEqual({ b: 2, d: '2026-10-25', c: 2, r: 0b011, n: 1, f: DAY, s: 2, at: AT });
    expect(MemoryItemStateSchema.safeParse(st).success).toBe(true);
    // At the produce rung every rung is passed and the ladder is done.
    expect(testOutPlacement({ correct: true, rung: 'produce' }, false, DAY, AT)).toMatchObject({ b: 2, c: 3, r: 0b111 });
  });

  it('on a passed test-out a miss goes to box 1, due tomorrow; a produce miss asks at read next; a hinted answer is not right', () => {
    expect(testOutPlacement({ correct: false, rung: 'read' }, true, DAY, AT)).toEqual({ b: 1, d: '2026-10-23', c: 0, r: 0, n: 1, f: DAY, s: 1, at: AT });
    expect(testOutPlacement({ correct: false, rung: 'produce' }, true, DAY, AT)).toMatchObject({ b: 1, c: 1 });
    expect(testOutPlacement({ correct: true, hinted: true, rung: 'produce' }, true, DAY, AT)).toMatchObject({ b: 1, d: '2026-10-23', r: 0 });
  });

  it('on a test-out that did not pass a missed item stays unmet (its first quest teaches it); a right one still goes to box 2', () => {
    expect(testOutPlacement({ correct: false, rung: 'read' }, false, DAY, AT)).toBeNull();
    expect(testOutPlacement({ correct: true, hinted: true, rung: 'produce' }, false, DAY, AT)).toBeNull();
    expect(testOutPlacement({ correct: true, rung: 'recognize' }, false, DAY, AT)).toMatchObject({ b: 2, d: '2026-10-25' });
  });

  it('is not the spacing rule: the rule would meet the item at box 1, due tomorrow', () => {
    expect(applyAnswer(undefined, {}, { correct: true, rung: 'read' }, DAY, AT).state).toMatchObject({ b: 1, d: '2026-10-23' });
  });
});

describe('unasked items: derived from testedOut (deriveTestedOut)', () => {
  const states = derive({ [CELL]: AT });
  const taught = cellStoreItems(ITEMS, RETIRED, CELL);

  it('every item the cell teaches (no topic word, none retired) is at box 1, unanswered, over the 3 days after the test-out', () => {
    expect(taught.length).toBeGreaterThan(30);
    expect([...states.keys()].sort()).toEqual([...taught].sort());
    for (const [id, { shard, state }] of states) {
      expect(MemoryItemStateSchema.safeParse(state).success, id).toBe(true);
      expect(state).toMatchObject({ b: 1, s: 1, n: 0, r: 0, c: 0, f: DAY, at: AT });
      expect(shard).toBe('stage2');
      expect(id.startsWith('vocab:')).toBe(false);
    }
    expect([...perDay(states.values()).keys()].sort()).toEqual([addDays(DAY, 1), addDays(DAY, 2), addDays(DAY, 3)]);
    for (const n of perDay(states.values()).values()) expect(n).toBeLessThanOrEqual(SEED_PER_DAY);
    // Spread evenly: no day holds more than one item over another.
    const counts = [...perDay(states.values()).values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('within the cap: with the quest seeding already due 15 on a day, that day takes none and the spread moves on', () => {
    const fake = new Map(Array.from({ length: SEED_PER_DAY }, (_, i) => [`syl:fake-${i}`, { shard: 'stage1', state: { b: 1, d: addDays(DAY, 1), c: 0, r: 0, n: 0, f: DAY, s: 1, at: AT } }]));
    const capped = derive({ [CELL]: AT }, utcDay, fake);
    const days = perDay(capped.values());
    expect(days.get(addDays(DAY, 1))).toBeUndefined();
    for (const [, n] of days) expect(n).toBeLessThanOrEqual(SEED_PER_DAY);
    expect([...capped.keys()].sort()).toEqual([...taught].sort());
  });

  it('more than 3 x 15 unasked items: the cap wins, the rest fall due on the next days at 15 a day', () => {
    const many = derive({ [CELL]: AT, 'episode:stage1-rites': AT, 'episode:stage3-life': AT, 'episode:stage1-crafts': AT });
    const days = perDay(many.values());
    for (const [, n] of days) expect(n).toBeLessThanOrEqual(SEED_PER_DAY);
    expect(many.size).toBeGreaterThan(SEED_PER_DAY * TEST_OUT_SPREAD_DAYS);
    expect([...days.keys()].sort()[0]).toBe(addDays(DAY, 1));
  });

  it('an item the quest seeding holds keeps its seeded state; an item two tested-out cells share is placed once, by the earlier', () => {
    const seed = deriveSeed({ snapshot: finished(8), items: ITEMS, retired: RETIRED, quests: CATALOG.quests, cells: CATALOG.cells, seededAt: AT, dayOf: utcDay });
    const both = derive({ [CELL]: AT }, utcDay, seed.states);
    for (const id of both.keys()) expect(seed.states.has(id), id).toBe(false);
    const earlier = derive({ 'episode:stage1-letters': '2026-10-20T08:00:00.000Z', [CELL]: AT });
    const shared = cellStoreItems(ITEMS, RETIRED, 'episode:stage1-letters').filter((id) => taught.includes(id));
    for (const id of shared) expect(earlier.get(id)?.state.f).toBe('2026-10-20');
  });

  it('derives the same on two devices: the same snapshot gives the same states whatever the order of testedOut and of a merge', () => {
    const a = { [CELL]: AT, 'episode:stage3-life': '2026-10-23T09:00:00.000Z' };
    const b = { 'episode:stage3-life': '2026-10-23T09:00:00.000Z', [CELL]: AT };
    expect(derive(a)).toEqual(derive(b));
    // Device B tested out of the same cell later, offline; after the merge both hold the earliest time and derive alike.
    const merged1 = mergeLatchRecord({ [CELL]: AT }, { [CELL]: '2026-10-24T10:00:00.000Z' });
    const merged2 = mergeLatchRecord({ [CELL]: '2026-10-24T10:00:00.000Z' }, { [CELL]: AT });
    expect(merged1).toEqual(merged2);
    expect(merged1).toEqual({ [CELL]: AT });
    expect(derive(merged1 ?? {})).toEqual(derive(merged2 ?? {}));
    // The seeding's input key moves with testedOut, so a device derives again when a sync brings it.
    const snap = finished(3);
    const key = (testedOut?: Record<string, string>) => seedInputKey({ snapshot: { ...snap, ...(testedOut ? { testedOut } : {}) }, items: ITEMS, retired: RETIRED, quests: CATALOG.quests, seededAt: AT, dayOf: utcDay });
    expect(key({ [CELL]: AT })).not.toBe(key());
    expect(key(a)).toBe(key(b));
  });

  it('no testedOut, or an unreadable time, derives nothing', () => {
    expect(derive({}).size).toBe(0);
    expect(deriveTestedOut({ testedOut: undefined, items: ITEMS, retired: RETIRED, seeded: new Map(), dayOf: utcDay }).size).toBe(0);
    expect(derive({ [CELL]: 'not a time' }).size).toBe(0);
  });
});

describe('fixed clocks in four time zones: the spread starts the day after the local day of the test-out', () => {
  // 2026-10-22T10:30Z is the 23rd at UTC+14 and in Seoul, the 22nd at UTC-12 and in Los Angeles.
  const at = '2026-10-22T10:30:00.000Z';
  const cases: [string, string][] = [
    ['Pacific/Kiritimati', '2026-10-23'],
    ['Etc/GMT+12', '2026-10-21'],
    ['Asia/Seoul', '2026-10-22'],
    ['America/Los_Angeles', '2026-10-22'],
  ];
  for (const [zone, localDay] of cases) {
    it(`${zone}: the local day is ${localDay}`, () => {
      const dayOf = zoned(zone);
      expect(dayOf(new Date(at))).toBe(localDay);
      const states = derive({ [CELL]: at }, dayOf);
      expect([...perDay(states.values()).keys()].sort()).toEqual([1, 2, 3].map((k) => addDays(localDay, k)));
      for (const { state } of states.values()) expect(state.f).toBe(localDay);
      // A right answer on that local day is due 3 days later, a passed miss the next day.
      expect(testOutPlacement({ correct: true, rung: 'read' }, true, localDay, at)?.d).toBe(addDays(localDay, 3));
      expect(testOutPlacement({ correct: false, rung: 'read' }, true, localDay, at)?.d).toBe(addDays(localDay, 1));
      // Two devices in the zone derive alike.
      expect(derive({ [CELL]: at }, zoned(zone))).toEqual(states);
    });
  }
});

describe('a Stage Jump (row CM-25): every cell of the stage and the stage key, one instant', () => {
  const STAGE2 = CATALOG.cells.filter((c) => /^episode:stage2-[a-z]+$/.test(c.episodeId)).map((c) => c.episodeId);
  const jump = (at: string, order: readonly string[] = STAGE2): Record<string, string> => Object.fromEntries([...order.map((c) => [c, at]), ['stage2', at]]);
  const taught = [...new Set(STAGE2.flatMap((c) => cellStoreItems(ITEMS, RETIRED, c)))];

  it('lays every unasked item of the stage at box 1, unanswered, from the day after, never over 15 seeded due a day', () => {
    expect(STAGE2.length).toBeGreaterThanOrEqual(4);
    const states = derive(jump(AT));
    expect([...states.keys()].sort()).toEqual([...taught].sort());
    for (const { state } of states.values()) expect(state).toMatchObject({ b: 1, s: 1, n: 0, r: 0, c: 0, f: DAY, at: AT });
    const days = perDay(states.values());
    for (const n of days.values()) expect(n).toBeLessThanOrEqual(SEED_PER_DAY);
    expect([...days.keys()].sort()[0]).toBe(addDays(DAY, 1));
    // A whole stage holds more than 3 x 15 items: the cap wins and the rest go to the next days, without a gap.
    expect(states.size).toBeGreaterThan(SEED_PER_DAY * TEST_OUT_SPREAD_DAYS);
    const sorted = [...days.keys()].sort();
    sorted.forEach((d, i) => expect(d).toBe(addDays(DAY, i + 1)));
  });

  it('the stage key places nothing of its own: the same states as the cells alone', () => {
    const cellsOnly = Object.fromEntries(STAGE2.map((c) => [c, AT]));
    expect(derive(jump(AT))).toEqual(derive(cellsOnly));
    expect(derive({ stage2: AT }).size).toBe(0);
  });

  it('derives the same on two devices, whatever the key order or the side that merges first', () => {
    const a = jump(AT);
    const b = jump(AT, [...STAGE2].reverse());
    expect(derive(a)).toEqual(derive(b));
    // Device B jumped the same stage later, offline: after the merge both hold the earliest instant and derive alike.
    const later = jump('2026-10-24T10:00:00.000Z');
    const m1 = mergeLatchRecord(a, later) ?? {};
    const m2 = mergeLatchRecord(later, b) ?? {};
    expect(m1).toEqual(m2);
    expect(derive(m1)).toEqual(derive(m2));
    expect(derive(m1)).toEqual(derive(a));
  });

  const cases: [string, string, string][] = [
    ['Pacific/Kiritimati', '2026-10-22T10:30:00.000Z', '2026-10-23'],
    ['Etc/GMT+12', '2026-10-22T10:30:00.000Z', '2026-10-21'],
    ['Asia/Seoul', '2026-10-22T10:30:00.000Z', '2026-10-22'],
    // Across the end of daylight time in Los Angeles (2026-11-01): the spread keeps one local day per step.
    ['America/Los_Angeles', '2026-10-31T08:30:00.000Z', '2026-10-31'],
  ];
  for (const [zone, at, localDay] of cases) {
    it(`fixed clock, ${zone}: the spread starts the day after the local day ${localDay}`, () => {
      const dayOf = zoned(zone);
      expect(dayOf(new Date(at))).toBe(localDay);
      const states = derive(jump(at), dayOf);
      const sorted = [...perDay(states.values()).keys()].sort();
      expect(sorted[0]).toBe(addDays(localDay, 1));
      sorted.forEach((d, i) => expect(d).toBe(addDays(localDay, i + 1)));
      for (const { state } of states.values()) expect(state.f).toBe(localDay);
      expect(derive(jump(at, [...STAGE2].reverse()), zoned(zone))).toEqual(states);
    });
  }
});
