import { CATALOG, mergeCellBest, type CellLevel, type MemoryItemState, type ProgressSnapshot, type VocabItemState } from '@hangul-route/content-schema';
import { lintReviewMessages } from '@hangul-route/content-schema/lint';
import { getMessages } from '@hangul-route/i18n';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MASTERY_SEGMENTS,
  WORDS_MILESTONES,
  deriveMastery,
  heldAt,
  latchCellBest,
  selectDueCellIds,
  wordHeldAt,
  wordsMilestoneCrossed,
  type MasteryInput,
} from '../mastery';
import { ITEMS, RETIRED, finished } from './fixtures';

/**
 * F-CURR-002 section 4.4, row CM-20: the mastery level of a cell from monotonic fields only, the started-volume
 * denominator and the New volume marker, the `cellBest` latch, the Ready to refresh cells and the Words known
 * milestones.
 */

const TODAY = '2026-10-22';
const CELL = 'episode:stage2-life';
const at = '2026-10-01T10:00:00.000Z';
const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 3, d: '2026-11-01', c: 1, r: 3, n: 3, f: '2026-10-01', s: 3, at, ...over });

type Snap = MasteryInput['snapshot'];
const snap = (over: Partial<Snap> = {}): Snap => ({ quests: [], questDoneAt: {}, ...over });
const done = (...ids: string[]): Record<string, string> => Object.fromEntries(ids.map((id) => [id, at]));
const word = (id: string, over: Partial<VocabItemState> = {}): VocabItemState =>
  ({ id, first: '2026-10-01', seen: 3, right: 3, bestBox: 4, last: '2026-10-20', box: 4, due: '2026-11-01', at, ...over }) as VocabItemState;

/** Ten items taught by the cell's first volume, two by its second, one retired, one only asked again here. */
const ITEMS10 = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `lex:w${i}`, cells: [CELL] })),
  { id: 'lex:v2a', cells: [`${CELL}-v2`] },
  { id: 'lex:v2b', cells: [`${CELL}-v2`] },
  { id: 'lex:gone', cells: [CELL] },
  { id: 'lex:other', cells: ['episode:stage2-letters'] },
];
const CELLS = [
  { episodeId: CELL, questIds: ['q1', 'q2'] },
  { episodeId: 'episode:stage2-letters', questIds: ['q3'] },
];
const QUESTS = [
  { id: 'q1', episodeId: CELL },
  { id: 'q2', episodeId: CELL },
  { id: 'q3', episodeId: 'episode:stage2-letters' },
];
const QUESTS_V2 = [...QUESTS, { id: 'q1v2', episodeId: `${CELL}-v2` }];

function input(over: Partial<MasteryInput> = {}): MasteryInput {
  return { cells: CELLS, quests: QUESTS, items: ITEMS10, retired: new Set(['lex:gone']), rows: {}, snapshot: snap(), ...over };
}
/** `held` of the ten first-volume items at best box `s`. */
const rowsAt = (held: number, s: number, over: Partial<MemoryItemState> = {}): MasteryInput['rows'] =>
  Object.fromEntries(Array.from({ length: held }, (_, i) => [`lex:w${i}`, { st: st({ s, ...over }) }]));
const levelOf = (i: MasteryInput, cell = CELL): CellLevel => deriveMastery(i).get(cell)?.level ?? 0;

describe('deriveMastery: the levels of section 4.4', () => {
  it('level 0 while nothing is started; Done when every quest of the first volume is done or the cell was tested out', () => {
    expect(deriveMastery(input()).size).toBe(0);
    // One quest of two: started (so it has a denominator) but not Done.
    expect(levelOf(input({ snapshot: snap({ questDoneAt: done('q1') }) }))).toBe(0);
    expect(levelOf(input({ snapshot: snap({ questDoneAt: done('q1', 'q2') }) }))).toBe(1);
    expect(levelOf(input({ snapshot: snap({ testedOut: { [CELL]: at } }) }))).toBe(1);
    // A quest kept only in `quests` (an older snapshot before `questDoneAt`) is latched the same way.
    const old = { quests: ['q1', 'q2'].map((questId) => ({ questId, episodeId: CELL, startedAt: at, completedAt: at, stars: 2, attempts: 1, accuracy: 1 })) } as unknown as Snap;
    expect(levelOf(input({ snapshot: old }))).toBe(1);
  });

  it('Practiced at 80% of the denominator at best box 3 (8 of 10), not at 7 of 10', () => {
    const base = { snapshot: snap({ questDoneAt: done('q1', 'q2') }) };
    expect(levelOf(input({ ...base, rows: rowsAt(7, 3) }))).toBe(1);
    expect(levelOf(input({ ...base, rows: rowsAt(8, 3) }))).toBe(2);
    expect(levelOf(input({ ...base, rows: rowsAt(10, 7) }))).toBe(2); // no Cell Check: never Mastered
  });

  it('Mastered: Practiced, a passed Cell Check, and 60% at best box 4', () => {
    const checked = snap({ questDoneAt: done('q1', 'q2'), cellCheckAt: { [CELL]: at } });
    expect(levelOf(input({ snapshot: checked, rows: { ...rowsAt(8, 3), ...rowsAt(5, 4) } }))).toBe(2);
    expect(levelOf(input({ snapshot: checked, rows: { ...rowsAt(8, 3), ...rowsAt(6, 4) } }))).toBe(3);
    // A Cell Check without Practiced stays where the boxes put it.
    expect(levelOf(input({ snapshot: checked, rows: rowsAt(6, 4) }))).toBe(1);
  });

  it('levels are cumulative: boxes held from other cells never lift a cell nobody finished', () => {
    expect(levelOf(input({ snapshot: snap({ questDoneAt: done('q1'), cellCheckAt: { [CELL]: at } }), rows: rowsAt(10, 7) }))).toBe(0);
  });

  it('a seeded box (n 0) or a box with no right answer (r 0) never holds an item', () => {
    const base = { snapshot: snap({ questDoneAt: done('q1', 'q2') }) };
    expect(levelOf(input({ ...base, rows: rowsAt(10, 3, { n: 0, r: 0 }) }))).toBe(1);
    expect(levelOf(input({ ...base, rows: rowsAt(10, 3, { r: 0 }) }))).toBe(1);
    expect(heldAt(st({ s: 3, n: 1, r: 1 }), 3)).toBe(true);
    expect(heldAt(undefined, 1)).toBe(false);
  });

  it('topic words in the denominator are read from the vocab slice (best box and a recorded answer)', () => {
    const items = [...Array.from({ length: 4 }, (_, i) => ({ id: `lex:w${i}`, cells: [CELL] })), { id: 'vocab:bap', cells: [CELL] }];
    const base = { items, retired: new Set<string>(), rows: rowsAt(4, 3) };
    const vocab = (w: VocabItemState) => ({ v: 1 as const, items: [w], topics: [] }) as unknown as ProgressSnapshot['vocab'];
    expect(levelOf(input({ ...base, snapshot: snap({ questDoneAt: done('q1', 'q2'), vocab: vocab(word('vocab:bap', { seen: 0, right: 0 })) }) }))).toBe(2); // 4 of 5
    expect(levelOf(input({ ...base, rows: rowsAt(3, 3), snapshot: snap({ questDoneAt: done('q1', 'q2'), vocab: vocab(word('vocab:bap', { seen: 0, right: 0 })) }) }))).toBe(1); // 3 of 5
    expect(levelOf(input({ ...base, rows: rowsAt(3, 3), snapshot: snap({ questDoneAt: done('q1', 'q2'), vocab: vocab(word('vocab:bap', { bestBox: 3, box: 3 })) }) }))).toBe(2); // 4 of 5
    expect(wordHeldAt(word('vocab:bap', { bestBox: 2 }), 3)).toBe(false);
  });

  it('a topic word the learner has not collected stays in the denominator and is not held (section 4.4 as written)', () => {
    const items = [...Array.from({ length: 4 }, (_, i) => ({ id: `lex:w${i}`, cells: [CELL] })), { id: 'vocab:bap', cells: [CELL] }];
    const m = deriveMastery(input({ items, retired: new Set(), rows: rowsAt(4, 3), snapshot: snap({ questDoneAt: done('q1', 'q2') }) })).get(CELL);
    expect(m).toMatchObject({ level: 2, denominator: ['lex:w0', 'lex:w1', 'lex:w2', 'lex:w3', 'vocab:bap'] }); // 4 of 5
    expect(levelOf(input({ items, retired: new Set(), rows: rowsAt(3, 3), snapshot: snap({ questDoneAt: done('q1', 'q2') }) }))).toBe(1); // 3 of 5
  });

  it('a cell made mostly of topic words (Stage 2 Nature: 2 lesson items, 12 words) is not Practiced on its lesson items and one word', () => {
    const items = [
      ...Array.from({ length: 2 }, (_, i) => ({ id: `lex:w${i}`, cells: [CELL] })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: `vocab:t${i}`, cells: [CELL] })),
    ];
    const vocab = (ws: VocabItemState[]) => ({ v: 1 as const, items: ws, topics: [] }) as unknown as ProgressSnapshot['vocab'];
    const one = input({ items, retired: new Set(), rows: rowsAt(2, 3), snapshot: snap({ questDoneAt: done('q1', 'q2'), vocab: vocab([word('vocab:t0', { bestBox: 3, box: 3 })]) }) });
    expect(deriveMastery(one).get(CELL)).toMatchObject({ level: 1 });
    expect(deriveMastery(one).get(CELL)?.denominator).toHaveLength(14); // 3 of 14 held
    // 12 of 14 held (2 lesson items and 10 words): Practiced.
    const ten = Array.from({ length: 10 }, (_, i) => word(`vocab:t${i}`, { bestBox: 3, box: 3 }));
    expect(levelOf(input({ ...one, snapshot: snap({ questDoneAt: done('q1', 'q2'), vocab: vocab(ten) }) }))).toBe(2);
  });

  it('an empty denominator never reaches Practiced', () => {
    expect(levelOf(input({ items: [], snapshot: snap({ questDoneAt: done('q1', 'q2') }) }))).toBe(1);
  });
});

describe('deriveMastery: the started-volume denominator and the New volume marker', () => {
  const base = { snapshot: snap({ questDoneAt: done('q1', 'q2') }) };

  it('holds the items of the started volumes only, without the retired ones or the items another cell teaches', () => {
    const m = deriveMastery(input(base)).get(CELL);
    expect(m?.started).toEqual([1]);
    expect(m?.denominator).toEqual(Array.from({ length: 10 }, (_, i) => `lex:w${i}`));
  });

  it('a later volume that is not started never holds a level back: it shows New volume instead', () => {
    const m = deriveMastery(input({ ...base, quests: QUESTS_V2, rows: rowsAt(8, 3) })).get(CELL);
    expect(m).toMatchObject({ level: 2, started: [1], newVolume: true });
  });

  it('once the later volume is started (a quest done or a test-out) its items join the denominator and the marker goes', () => {
    const started = deriveMastery(input({ quests: QUESTS_V2, snapshot: snap({ questDoneAt: done('q1', 'q2', 'q1v2') }), rows: rowsAt(8, 3) })).get(CELL);
    expect(started).toMatchObject({ level: 1, started: [1, 2], newVolume: false }); // 8 of 12 now
    expect(started?.denominator).toContain('lex:v2a');
    const tested = deriveMastery(input({ quests: QUESTS_V2, snapshot: snap({ questDoneAt: done('q1', 'q2'), testedOut: { [`${CELL}-v2`]: at } }), rows: rowsAt(10, 3) })).get(CELL);
    expect(tested).toMatchObject({ level: 2, started: [1, 2], newVolume: false }); // 10 of 12
  });

  it('a volume the catalogue does not ship (items only, no quest) is never New volume and never started', () => {
    expect(deriveMastery(input({ ...base })).get(CELL)?.newVolume).toBe(false);
  });

  it('a quest of an unknown cell, or a volume suffix of 1, is no volume', () => {
    const m = deriveMastery(input({ ...base, quests: [...QUESTS, { id: 'x', episodeId: 'episode:stage9-none-v2' }, { id: 'y', episodeId: `${CELL}-v1` }] }));
    expect(m.get(CELL)?.newVolume).toBe(false);
    expect(m.has('episode:stage9-none')).toBe(false);
  });

  it('on this build every done cell is Done, and no level comes from seeding alone', () => {
    const s = finished(30);
    const m = deriveMastery({ cells: CATALOG.cells, quests: CATALOG.quests, items: ITEMS, retired: RETIRED, rows: {}, snapshot: s });
    const doneCells = CATALOG.cells.filter((c) => c.questIds.length > 0 && c.questIds.every((q) => s.quests.some((p) => p.questId === q))).map((c) => c.episodeId);
    expect(doneCells.length).toBeGreaterThan(0);
    for (const cell of doneCells) expect(m.get(cell)?.level, cell).toBe(1);
    for (const [cell, v] of m) if (!doneCells.includes(cell)) expect(v.level, cell).toBe(0);
  });
});

describe('the derivation reads only monotonic fields (section 4.4, F-VOC-005 P2)', () => {
  it('property: any change of the current box b, the next rung c or the due day d leaves every level unchanged', () => {
    const arbState = fc.record({ s: fc.integer({ min: 0, max: 7 }), n: fc.integer({ min: 0, max: 5 }), r: fc.integer({ min: 0, max: 7 }) });
    const arbSchedule = fc.record({ b: fc.integer({ min: 0, max: 7 }), c: fc.integer({ min: 0, max: 3 }), d: fc.option(fc.constantFrom('2026-10-01', TODAY, '2026-12-31'), { nil: null }) });
    fc.assert(
      fc.property(
        fc.array(arbState, { minLength: 10, maxLength: 10 }),
        fc.array(arbSchedule, { minLength: 10, maxLength: 10 }),
        fc.array(arbSchedule, { minLength: 10, maxLength: 10 }),
        fc.boolean(),
        (best, one, two, checked) => {
          const s = snap({ questDoneAt: done('q1', 'q2'), ...(checked ? { cellCheckAt: { [CELL]: at } } : {}) });
          const rowsWith = (sched: typeof one): MasteryInput['rows'] =>
            Object.fromEntries(best.map((b, i) => [`lex:w${i}`, { st: st({ ...b, ...sched[i], s: b.s }) }]));
          expect(levelOf(input({ snapshot: s, rows: rowsWith(one) }))).toBe(levelOf(input({ snapshot: s, rows: rowsWith(two) })));
        },
      ),
    );
  });

  it('property: raising a best box, a rep count or a rung bit never lowers a level', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 10, maxLength: 10 }), fc.integer({ min: 0, max: 9 }), fc.integer({ min: 1, max: 4 }), (boxes, which, up) => {
        const s = snap({ questDoneAt: done('q1', 'q2'), cellCheckAt: { [CELL]: at } });
        const rows = (bs: number[]): MasteryInput['rows'] => Object.fromEntries(bs.map((b, i) => [`lex:w${i}`, { st: st({ s: b }) }]));
        const raised = boxes.map((b, i) => (i === which ? Math.min(7, b + up) : b));
        expect(levelOf(input({ snapshot: s, rows: rows(raised) }))).toBeGreaterThanOrEqual(levelOf(input({ snapshot: s, rows: rows(boxes) })));
      }),
    );
  });
});

describe('latchCellBest: the level never drops (section 4.4)', () => {
  const derived = (entries: Array<[string, CellLevel]>) => new Map(entries.map(([cell, level]) => [cell, { level }]));

  it('raises cellBest to a higher derived level and reports one rise per cell at its new level', () => {
    const { cellBest, rises } = latchCellBest({ [CELL]: 1 }, derived([[CELL, 3], ['episode:stage1-letters', 1]]));
    expect(cellBest).toEqual({ [CELL]: 3, 'episode:stage1-letters': 1 });
    // In cell id order.
    expect(rises).toEqual([
      { cellId: 'episode:stage1-letters', level: 1 },
      { cellId: CELL, level: 3 },
    ]);
  });

  it('never lowers a level, and returns the same object when nothing rises', () => {
    const held = { [CELL]: 3 } as const;
    const out = latchCellBest(held, derived([[CELL, 1]]));
    expect(out.cellBest).toBe(held);
    expect(out.rises).toEqual([]);
    expect(latchCellBest(undefined, derived([[CELL, 0]])).cellBest).toEqual({});
  });

  it('property: the latch never lowers any level, and with the max merge it is commutative and idempotent', () => {
    const arbLevels = fc.dictionary(fc.constantFrom(CELL, 'episode:stage1-letters', 'episode:stage3-rites'), fc.constantFrom<CellLevel>(0, 1, 2, 3));
    fc.assert(
      fc.property(arbLevels, arbLevels, arbLevels, (held, a, b) => {
        const once = latchCellBest(held, derived(Object.entries(a) as Array<[string, CellLevel]>)).cellBest;
        for (const [cell, level] of Object.entries(held)) expect(once[cell]).toBeGreaterThanOrEqual(level);
        const twice = latchCellBest(once, derived(Object.entries(a) as Array<[string, CellLevel]>)).cellBest;
        expect(twice).toEqual(once);
        // Two devices latch their own derivations; the snapshot merge (by max) gives the same result either way round.
        const other = latchCellBest(held, derived(Object.entries(b) as Array<[string, CellLevel]>)).cellBest;
        expect(mergeCellBest(once, other)).toEqual(mergeCellBest(other, once));
        expect(mergeCellBest(once, once)).toEqual({ ...once });
      }),
    );
  });
});

describe('selectDueCellIds: Ready to refresh only on a mastered cell with items due', () => {
  const m = new Map([
    [CELL, { denominator: ['lex:w0', 'vocab:bap'] }],
    ['episode:stage1-letters', { denominator: ['sym:giyeok'] }],
  ]);
  it('a level 3 cell with a due item glows; a level 2 cell with due items does not; nothing due, no glow', () => {
    const rows = { 'lex:w0': { st: st({ b: 2, d: TODAY }) }, 'sym:giyeok': { st: st({ b: 1, d: '2026-10-01' }) } };
    expect([...selectDueCellIds({ [CELL]: 3, 'episode:stage1-letters': 2 }, m, rows, [], TODAY)]).toEqual([CELL]);
    expect([...selectDueCellIds({ [CELL]: 3 }, m, { 'lex:w0': { st: st({ b: 2, d: '2026-10-23' }) } }, [], TODAY)]).toEqual([]);
    expect([...selectDueCellIds(undefined, m, rows, [], TODAY)]).toEqual([]);
  });
  it('a due topic word counts', () => {
    expect([...selectDueCellIds({ [CELL]: 3 }, m, {}, [word('vocab:bap', { due: TODAY })], TODAY)]).toEqual([CELL]);
    expect([...selectDueCellIds({ [CELL]: 3 }, m, {}, [word('vocab:bap', { due: null })], TODAY)]).toEqual([]);
  });
});

describe('Words known milestones (section 4.4)', () => {
  it('are 100, 250, 500, 1,000 and 2,000, and the ring has three segments', () => {
    expect(WORDS_MILESTONES).toEqual([100, 250, 500, 1000, 2000]);
    expect(MASTERY_SEGMENTS).toBe(3);
  });

  it('a milestone fires when the count crosses it, and once: never again for the same or a lower count', () => {
    expect(wordsMilestoneCrossed(99, 100)).toBe(100);
    expect(wordsMilestoneCrossed(100, 100)).toBeNull();
    expect(wordsMilestoneCrossed(100, 249)).toBeNull();
    expect(wordsMilestoneCrossed(240, 520)).toBe(500); // two at once: the highest, one banner
    expect(wordsMilestoneCrossed(2000, 5000)).toBeNull();
    expect(wordsMilestoneCrossed(120, 90)).toBeNull();
  });

  it('property: walking any rising path of counts fires each milestone at most once', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 60 }), { maxLength: 80 }), (steps) => {
        const fired: number[] = [];
        let seen = 0;
        for (const step of steps) {
          const next = seen + step;
          const hit = wordsMilestoneCrossed(seen, next);
          if (hit !== null) fired.push(hit);
          seen = Math.max(seen, next);
        }
        expect(new Set(fired).size).toBe(fired.length);
      }),
    );
  });
});

describe('the mastery and Words known strings (section 7.7, section 9.3 review-copy)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: pass review-copy (no %%, no "n of m", no age words, no speaking UI, no emoji)', (locale) => {
    const m = getMessages(locale);
    expect(lintReviewMessages(m.learner, ['mastery', 'wordsKnown'], locale)).toEqual([]);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: no visible decay and no percentage on a learner screen (anti-shame checklist)', (locale) => {
    const m = getMessages(locale);
    const texts = [
      m.learner.mastery.level.done,
      m.learner.mastery.level.practiced,
      m.learner.mastery.level.mastered,
      m.learner.mastery.readyToRefresh,
      m.learner.mastery.newVolume,
      m.learner.mastery.levelUp('Letters', m.learner.mastery.level.mastered),
      ...[1, 120, 2000].map((n) => m.learner.wordsKnown.pill(n)),
      m.learner.wordsKnown.route('120'),
      m.learner.wordsKnown.pill(1200, '1,200'),
      m.learner.wordsKnown.milestone('1,000'),
    ];
    for (const text of texts) {
      expect(text, text).not.toMatch(/%|\bof\b \d|lost|lose|fad|wilt|crack|decay|forgot|perdi|olvid|잃|잊|시들/i);
      expect(text.trim().length, text).toBeGreaterThan(0);
    }
    expect(m.learner.wordsKnown.pill(120)).toContain('120');
    // The screen passes the count formatted for the locale; the plain count only picks the plural form.
    expect(m.learner.wordsKnown.pill(1200, '1.200')).toContain('1.200');
    expect(m.learner.wordsKnown.route('1.200')).toContain('1.200');
  });
});
