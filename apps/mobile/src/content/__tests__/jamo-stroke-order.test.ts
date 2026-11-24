import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../../logic/stroke-scoring';
import {
  altStrokesForJamo,
  jamoStrokes,
  reviewedStrokeIds,
  strokeFormsForJamo,
  strokesForJamo,
  type JamoStrokePoint,
} from '../jamo-strokes';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-14 (audit EDU-6): the stroke data follows the standard
 * school stroke order and stroke counts. This file pins, for every jamo in the data, how many
 * strokes it has and which way each stroke runs, against the table below, so an edit to
 * `jamo-strokes.ts` cannot change a count, an order or a direction without changing this table.
 *
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD SO-2: the table below is tied to the sourced, approved
 * rows of `docs/specs/assets/stroke-order-table.md` (parsed here, OD-SO11), and so is every
 * accepted other form the data holds (`altStrokes`), so the data, this test and the table
 * cannot drift. The table file also holds the review records `reviewedStrokeIds` needs (§6 test 10).
 *
 * A stroke is written as its legs: `right`, `down`, `downLeft`, `downRight`, joined with `>` at a
 * corner (`right>down` is the ㄱ shape). `loop` is the closed ring of ㅇ and ㅎ, from the top,
 * counter-clockwise.
 */

type Leg = 'right' | 'downRight' | 'down' | 'downLeft' | 'left' | 'upLeft' | 'up' | 'upRight';
const OCTANTS: readonly Leg[] = ['right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'up', 'upRight'];

/** Screen y grows downward, so atan2(dy, dx) = 0 is right and +90 degrees is down. */
function legOf(a: JamoStrokePoint, b: JamoStrokePoint): Leg {
  const octant = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4));
  return OCTANTS[((octant % 8) + 8) % 8]!;
}

const isLoop = (stroke: readonly JamoStrokePoint[]): boolean =>
  stroke.length > 3 && stroke[0]!.x === stroke[stroke.length - 1]!.x && stroke[0]!.y === stroke[stroke.length - 1]!.y;

/** Shoelace area on screen (y down): > 0 clockwise, < 0 counter-clockwise. */
const signedArea = (stroke: readonly JamoStrokePoint[]): number =>
  stroke.reduce((sum, a, i) => {
    const b = stroke[(i + 1) % stroke.length]!;
    return sum + (a.x * b.y - b.x * a.y) / 2;
  }, 0);

function signature(stroke: readonly JamoStrokePoint[]): string {
  if (isLoop(stroke)) return 'loop';
  const legs: Leg[] = [];
  for (let i = 1; i < stroke.length; i++) {
    const leg = legOf(stroke[i - 1]!, stroke[i]!);
    if (legs[legs.length - 1] !== leg) legs.push(leg);
  }
  return legs.join('>');
}

/** ㄱ shape, ㄴ shape. */
const G = 'right>down';
const N = 'down>right';

/** The standard order: one entry per stroke, in writing order. */
const STANDARD: Readonly<Record<string, readonly string[]>> = {
  // Consonants (AU-14 lists each one).
  'jamo:giyeok': [G],
  'jamo:nieun': [N],
  'jamo:digeut': ['right', N],
  'jamo:rieul': [G, 'right', N],
  'jamo:mieum': ['down', G, 'right'],
  'jamo:bieup': ['down', 'down', 'right', 'right'],
  'jamo:siot': ['downLeft', 'downRight'],
  'jamo:ieung': ['loop'],
  'jamo:jieut': ['right>downLeft', 'downRight'],
  'jamo:chieut': ['down', 'right>downLeft', 'downRight'],
  'jamo:kieuk': [G, 'right'],
  'jamo:tieut': ['right', 'right', N],
  'jamo:pieup': ['right', 'down', 'down', 'right'],
  'jamo:hieut': ['down', 'right', 'loop'],
  // Vowels (AU-14 lists the eight with ticks; ㅡ and ㅣ are one stroke).
  'jamo:a': ['down', 'right'],
  'jamo:ya': ['down', 'right', 'right'],
  'jamo:eo': ['right', 'down'],
  'jamo:yeo': ['right', 'right', 'down'],
  'jamo:o': ['down', 'right'],
  'jamo:yo': ['down', 'down', 'right'],
  'jamo:u': ['right', 'down'],
  'jamo:yu': ['right', 'down', 'down'],
  'jamo:eu': ['right'],
  'jamo:i': ['down'],
  // Finals: written exactly like the same consonant.
  'jamo:giyeok-batchim': [G],
  'jamo:nieun-batchim': [N],
  'jamo:rieul-batchim': [G, 'right', N],
  'jamo:mieum-batchim': ['down', G, 'right'],
  'jamo:bieup-batchim': ['down', 'down', 'right', 'right'],
  'jamo:ieung-batchim': ['loop'],
};

/** Each glyph's box [minX, minY, maxX, maxY] before AU-14: the fix changes order, not layout. */
const BOX: Readonly<Record<string, readonly [number, number, number, number]>> = {
  'jamo:giyeok': [40, 50, 160, 150],
  'jamo:nieun': [50, 40, 160, 150],
  'jamo:digeut': [40, 50, 160, 150],
  'jamo:rieul': [40, 40, 160, 150],
  'jamo:mieum': [50, 40, 150, 150],
  'jamo:bieup': [50, 30, 150, 150],
  'jamo:siot': [50, 40, 160, 150],
  'jamo:ieung': [42.5, 37.5, 157.5, 152.5],
  'jamo:jieut': [40, 50, 160, 150],
  'jamo:chieut': [40, 30, 160, 150],
  'jamo:kieuk': [40, 40, 160, 150],
  'jamo:tieut': [40, 40, 160, 150],
  'jamo:pieup': [40, 50, 160, 150],
  'jamo:hieut': [40, 30, 160, 155],
  'jamo:a': [80, 30, 140, 170],
  'jamo:ya': [80, 30, 140, 170],
  'jamo:eo': [60, 30, 120, 170],
  'jamo:yeo': [60, 30, 120, 170],
  'jamo:o': [30, 60, 170, 100],
  'jamo:yo': [30, 70, 170, 110],
  'jamo:u': [30, 100, 170, 140],
  'jamo:yu': [30, 90, 170, 130],
  'jamo:eu': [30, 100, 170, 100],
  'jamo:i': [100, 30, 100, 170],
  'jamo:giyeok-batchim': [40, 50, 160, 150],
  'jamo:nieun-batchim': [50, 40, 160, 150],
  'jamo:rieul-batchim': [40, 40, 160, 150],
  'jamo:mieum-batchim': [50, 40, 150, 150],
  'jamo:bieup-batchim': [50, 30, 150, 150],
  'jamo:ieung-batchim': [42.5, 37.5, 157.5, 152.5],
};

const strokes = (jamoId: string): JamoStrokePoint[][] => {
  const found = strokesForJamo(jamoId);
  expect(found, jamoId).toBeDefined();
  return found!;
};

const IDS = Object.keys(STANDARD);

// ---- The sourced table (SO-0b), as approved for SO-2 (OD-SO11) --------------------------------

const TABLE_MD = readFileSync(join(__dirname, '../../../../../docs/specs/assets/stroke-order-table.md'), 'utf8');

/** The lines from the heading `from` up to the heading `to`. */
function section(from: string, to: string): string[] {
  const start = TABLE_MD.indexOf(from);
  const end = TABLE_MD.indexOf(to, start + from.length);
  if (start < 0 || end < 0) throw new Error(`stroke-order-table.md: no section ${from} … ${to}`);
  return TABLE_MD.slice(start, end).split('\n');
}

/** The body rows of the markdown tables in `lines` (a row starts with its number), as trimmed cells. */
const rowsOf = (lines: readonly string[]): string[][] =>
  lines.filter((l) => /^\| \d+ \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));

function idIn(cell: string): string {
  const id = /^`(jamo:[a-z-]+)`$/.exec(cell)?.[1];
  if (!id) throw new Error(`stroke-order-table.md: not an id cell: ${cell}`);
  return id;
}

/** Every form of a row's Codes cell: the one the data shows, the other accepted ones in order, and the not accepted. */
interface RowForms {
  strokes: string[];
  altStrokes: string[][];
  notAccepted: string[][];
}

/** A Codes cell: codes only (one form), or one `<label> (<where>): <codes>` line per form (`<br>`). */
function formsIn(cell: string): RowForms {
  const forms: RowForms = { strokes: [], altStrokes: [], notAccepted: [] };
  let shown = 0;
  for (const line of cell.split('<br>')) {
    const labelled = /^[A-Z] \((`strokes`|`altStrokes`|not accepted)\): (.+)$/.exec(line.trim());
    const codes = [...(labelled ? labelled[2]! : line).matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
    const where = labelled ? labelled[1] : '`strokes`';
    if (where === '`strokes`') {
      forms.strokes = codes;
      shown++;
    } else if (where === '`altStrokes`') forms.altStrokes.push(codes);
    else forms.notAccepted.push(codes);
  }
  if (shown !== 1) throw new Error(`stroke-order-table.md: a Codes cell needs one \`strokes\` form: ${cell}`);
  return forms;
}

interface TableRow extends RowForms {
  count: number;
}

/** §3.1 and §3.2 (24 jamo; # | Jamo | Id | Strokes | Stroke order | Codes | …), then §3.3 (6 finals, inheriting a row). */
const TABLE: ReadonlyMap<string, TableRow> = (() => {
  const byNumber = new Map<string, TableRow>();
  const out = new Map<string, TableRow>();
  for (const cells of rowsOf(section('### 3.1 Consonants', '### 3.3 Finals'))) {
    const row = { count: Number.parseInt(cells[3]!, 10), ...formsIn(cells[5]!) };
    byNumber.set(cells[0]!, row);
    out.set(idIn(cells[2]!), row);
  }
  // # | Jamo | Id | Inherits | Strokes | …: a final is written exactly like its consonant's row.
  for (const cells of rowsOf(section('### 3.3 Finals', '### 3.4 Focus rows'))) {
    const inherited = byNumber.get(/^row (\d+)$/.exec(cells[3]!)?.[1] ?? '');
    if (!inherited) throw new Error(`stroke-order-table.md: final ${cells[2]} inherits no row`);
    out.set(idIn(cells[2]!), { ...inherited, count: Number.parseInt(cells[4]!, 10) });
  }
  return out;
})();

/** §4: # | Id | Status | Reviewer | Role | Sources checked | Seen | Date | PR. */
interface ReviewRecord {
  status: string;
  /** Reviewer, role, sources checked, seen, date, PR: the reviewer's SO-3 record. */
  so3: string[];
}
const RECORDS: ReadonlyMap<string, ReviewRecord> = new Map(
  rowsOf(section('## 4. Review records', '## 5. Sources')).map((cells) => [idIn(cells[1]!), { status: cells[2]!, so3: cells.slice(3) }]),
);

/** OD-SO11: the owner approved every row for SO-2 (the data may follow it); the reviewer's check is SO-3. */
const SO2_APPROVED = 'approved by the owner for SO-2, 2026-11-23 (OD-SO11)';

const forms = (jamoId: string): JamoStrokePoint[][][] => {
  const found = strokeFormsForJamo(jamoId);
  expect(found, jamoId).toBeDefined();
  return found!;
};
const alternates = (jamoId: string): JamoStrokePoint[][][] => forms(jamoId).slice(1);

describe('the data follows the approved rows of stroke-order-table.md (SO-2)', () => {
  it('the table has one row and one review record per jamo in the data, and nothing else', () => {
    expect([...TABLE.keys()].sort()).toEqual([...IDS].sort());
    expect([...RECORDS.keys()].sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s: its row is approved for SO-2 by the owner (OD-SO11)', (jamoId) => {
    expect(RECORDS.get(jamoId)!.status.startsWith(SO2_APPROVED)).toBe(true);
  });

  it.each(IDS)('%s: STANDARD is the row the data shows (`strokes`), with its stroke count', (jamoId) => {
    expect(STANDARD[jamoId]).toEqual(TABLE.get(jamoId)!.strokes);
    expect(STANDARD[jamoId]).toHaveLength(TABLE.get(jamoId)!.count);
  });

  it.each(IDS)('%s: its other forms (`altStrokes`) are the row\'s other accepted forms, in order', (jamoId) => {
    expect(alternates(jamoId).map((form) => form.map(signature))).toEqual(TABLE.get(jamoId)!.altStrokes);
  });

  it.each(IDS)('%s: no form in the data is one the table does not accept', (jamoId) => {
    for (const rejected of TABLE.get(jamoId)!.notAccepted) {
      for (const form of forms(jamoId)) expect(form.map(signature)).not.toEqual(rejected);
    }
  });

  it('ㅌ Variant C (ㄷ first, then the middle bar) is the one form the table does not accept', () => {
    expect([...TABLE].filter(([, row]) => row.notAccepted.length > 0).map(([id, row]) => [id, row.notAccepted])).toEqual([
      ['jamo:tieut', [['right', N, 'right']]],
    ]);
  });

  it('the letters with another accepted form are ㅈ, ㅊ, ㅌ and ㅎ (OD-SO11), one other form each', () => {
    expect(IDS.filter((id) => alternates(id).length > 0)).toEqual(['jamo:jieut', 'jamo:chieut', 'jamo:tieut', 'jamo:hieut']);
    for (const id of IDS) expect(alternates(id).length).toBeLessThanOrEqual(1);
  });

  it('every id in reviewedStrokeIds has a filled review record (§6 test 10)', () => {
    for (const id of reviewedStrokeIds) {
      const record = RECORDS.get(id);
      expect(record, id).toBeDefined();
      expect(record!.so3, id).toHaveLength(6);
      for (const field of record!.so3) expect(field, id).not.toBe('');
    }
  });

  it('an SO-3 record is all empty (not checked yet) or all filled, never half filled', () => {
    for (const [id, record] of RECORDS) {
      expect(record.so3, id).toHaveLength(6);
      const filled = record.so3.filter((field) => field !== '').length;
      expect([0, record.so3.length], id).toContain(filled);
    }
  });
});

describe('the other accepted forms (altStrokes, OD-SO11)', () => {
  it('a jamo the data does not hold has no forms; strokesForJamo stays the form shown', () => {
    expect(strokeFormsForJamo('jamo:none')).toBeUndefined();
    expect(altStrokesForJamo('jamo:none')).toBeUndefined();
    expect(altStrokesForJamo('jamo:giyeok')).toEqual([]);
    for (const id of IDS) {
      expect(forms(id)[0]).toBe(strokesForJamo(id));
      expect(altStrokesForJamo(id)).toEqual(alternates(id));
    }
  });

  it.each(IDS)('%s: no stroke of another form runs right to left or bottom to top', (jamoId) => {
    for (const stroke of alternates(jamoId).flat()) {
      if (isLoop(stroke)) continue;
      for (let i = 1; i < stroke.length; i++) {
        const [a, b] = [stroke[i - 1]!, stroke[i]!];
        expect(b.y, 'top to bottom').toBeGreaterThanOrEqual(a.y);
        if (b.y === a.y) expect(b.x, 'left to right').toBeGreaterThan(a.x);
      }
    }
  });

  it.each(IDS)('%s: another form lies inside the box of the form shown (Trace a Word places it the same way)', (jamoId) => {
    const [minX, minY, maxX, maxY] = BOX[jamoId]!;
    for (const q of alternates(jamoId).flat(2)) {
      expect(q.x).toBeGreaterThanOrEqual(minX);
      expect(q.x).toBeLessThanOrEqual(maxX);
      expect(q.y).toBeGreaterThanOrEqual(minY);
      expect(q.y).toBeLessThanOrEqual(maxY);
    }
  });

  it.each([
    ['jamo:giyeok-batchim', 'jamo:giyeok'],
    ['jamo:nieun-batchim', 'jamo:nieun'],
    ['jamo:rieul-batchim', 'jamo:rieul'],
    ['jamo:mieum-batchim', 'jamo:mieum'],
    ['jamo:bieup-batchim', 'jamo:bieup'],
    ['jamo:ieung-batchim', 'jamo:ieung'],
  ] as const)('%s has every form of %s, and none of its arrays', (batchim, base) => {
    expect(forms(batchim)).toEqual(forms(base));
    forms(batchim).forEach((form, i) => expect(form).not.toBe(forms(base)[i]));
  });

  it('ㅈ in 3 strokes: the bar, then ㅅ from the middle of the bar; its right leg leaves from the left leg', () => {
    const [bar, left, right] = alternates('jamo:jieut')[0]!;
    expect(bar).toEqual(strokes('jamo:jieut')[0]!.slice(0, 2));
    expect(left![0]).toEqual({ x: (bar![0]!.x + bar![1]!.x) / 2, y: bar![0]!.y });
    expect(left![1]).toEqual(strokes('jamo:jieut')[0]![2]);
    expect(right![1]).toEqual(strokes('jamo:jieut')[1]![1]);
    const t = (right![0]!.y - left![0]!.y) / (left![1]!.y - left![0]!.y);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
    expect(Math.abs(left![0]!.x + (left![1]!.x - left![0]!.x) * t - right![0]!.x)).toBeLessThan(1);
  });

  it.each(['jamo:chieut', 'jamo:hieut'])('%s with the top stroke left to right: a short stroke over the tick; the rest as shown', (jamoId) => {
    const [top, ...rest] = alternates(jamoId)[0]!;
    const [tick, ...shownRest] = strokes(jamoId);
    expect(rest).toEqual(shownRest);
    expect(top![1]!.x - top![0]!.x).toBeLessThanOrEqual(30);
    // It crosses the tick, above the stroke under it.
    expect(top![0]!.x).toBeLessThan(tick![0]!.x);
    expect(top![1]!.x).toBeGreaterThan(tick![0]!.x);
    expect(Math.max(top![0]!.y, top![1]!.y)).toBeLessThan(tick![1]!.y);
  });

  it('ㅌ Variant B: the two bars as shown, then the ㄴ shape from the middle bar, not from the top', () => {
    const [top, middle, nieun] = alternates('jamo:tieut')[0]!;
    const shown = strokes('jamo:tieut');
    expect([top, middle]).toEqual(shown.slice(0, 2));
    expect(nieun![0]).toEqual({ x: shown[2]![0]!.x, y: middle![0]!.y });
    expect(nieun!.slice(1)).toEqual(shown[2]!.slice(1));
  });
});

describe('stroke data follows the standard stroke order (AU-14)', () => {
  it('the table covers every jamo in the data, and nothing else', () => {
    expect(jamoStrokes.map((j) => j.jamoId).sort()).toEqual([...IDS].sort());
    expect(new Set(jamoStrokes.map((j) => j.jamoId)).size).toBe(jamoStrokes.length);
    expect(Object.keys(BOX).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s: stroke count', (jamoId) => {
    expect(strokes(jamoId)).toHaveLength(STANDARD[jamoId]!.length);
  });

  it.each(IDS)('%s: the first stroke runs the standard way', (jamoId) => {
    expect(signature(strokes(jamoId)[0]!)).toBe(STANDARD[jamoId]![0]);
  });

  it.each(IDS)('%s: every stroke, in order, runs the standard way', (jamoId) => {
    expect(strokes(jamoId).map(signature)).toEqual(STANDARD[jamoId]);
  });

  it.each(IDS)('%s: no stroke runs right to left or bottom to top', (jamoId) => {
    for (const stroke of strokes(jamoId)) {
      if (isLoop(stroke)) continue;
      for (let i = 1; i < stroke.length; i++) {
        const [a, b] = [stroke[i - 1]!, stroke[i]!];
        expect(b.y, 'top to bottom').toBeGreaterThanOrEqual(a.y);
        if (b.y === a.y) expect(b.x, 'left to right').toBeGreaterThan(a.x);
      }
    }
  });

  it.each(IDS)('%s: a loop starts at the top and runs counter-clockwise', (jamoId) => {
    for (const stroke of strokes(jamoId).filter(isLoop)) {
      expect(stroke[0]!.y).toBe(Math.min(...stroke.map((q) => q.y)));
      expect(signedArea(stroke)).toBeLessThan(0);
    }
  });

  it.each(IDS)('%s: the glyph keeps its box', (jamoId) => {
    const pts = strokes(jamoId).flat();
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]).toEqual(BOX[jamoId]);
  });

  it.each([
    ['jamo:giyeok-batchim', 'jamo:giyeok'],
    ['jamo:nieun-batchim', 'jamo:nieun'],
    ['jamo:rieul-batchim', 'jamo:rieul'],
    ['jamo:mieum-batchim', 'jamo:mieum'],
    ['jamo:bieup-batchim', 'jamo:bieup'],
    ['jamo:ieung-batchim', 'jamo:ieung'],
  ] as const)('%s is written exactly like %s', (batchim, base) => {
    expect(strokes(batchim)).toEqual(strokes(base));
  });
});

describe('the audit regressions (EDU-6)', () => {
  it('ㅁ is three strokes: left bar; top and right as one; bottom bar', () => {
    const [left, topRight, bottom] = strokes('jamo:mieum');
    expect(strokes('jamo:mieum')).toHaveLength(3);
    expect(left).toEqual([{ x: 50, y: 40 }, { x: 50, y: 150 }]);
    expect(topRight).toEqual([{ x: 50, y: 40 }, { x: 150, y: 40 }, { x: 150, y: 150 }]);
    expect(bottom).toEqual([{ x: 50, y: 150 }, { x: 150, y: 150 }]);
    // No stroke is a closed loop any more.
    expect(strokes('jamo:mieum').some(isLoop)).toBe(false);
  });

  it('ㅌ is three strokes: top bar, middle bar, then the ㄴ shape', () => {
    const [top, middle, nieun] = strokes('jamo:tieut');
    expect(strokes('jamo:tieut')).toHaveLength(3);
    expect(top![0]!.y).toBe(top![1]!.y);
    expect(middle![0]!.y).toBe(middle![1]!.y);
    expect(top![0]!.y).toBeLessThan(middle![0]!.y);
    expect(signature(nieun!)).toBe(N);
    // The ㄴ shape starts at the top bar and ends at the bottom right.
    expect(nieun![0]!.y).toBe(top![0]!.y);
    expect(nieun![nieun!.length - 1]!.y).toBeGreaterThan(middle![0]!.y);
  });

  it('ㅗ draws the short tick first, then the long bar', () => {
    const [tick, bar] = strokes('jamo:o');
    expect(signature(tick!)).toBe('down');
    expect(signature(bar!)).toBe('right');
    expect(bar![1]!.x - bar![0]!.x).toBeGreaterThan(tick![1]!.y - tick![0]!.y);
    // The tick comes down onto the bar.
    expect(tick![1]!.y).toBe(bar![0]!.y);
  });

  it('ㅛ draws both ticks first, left one first, then the long bar', () => {
    const [first, second, bar] = strokes('jamo:yo');
    expect(strokes('jamo:yo')).toHaveLength(3);
    expect(signature(first!)).toBe('down');
    expect(signature(second!)).toBe('down');
    expect(first![0]!.x).toBeLessThan(second![0]!.x);
    expect(signature(bar!)).toBe('right');
  });

  it('ㅂ: both upright bars start at the same height, then middle bar, then bottom bar', () => {
    for (const jamoId of ['jamo:bieup', 'jamo:bieup-batchim']) {
      const [left, right, middle, bottom] = strokes(jamoId);
      expect(left![0]!.y).toBe(right![0]!.y);
      expect(left![1]!.y).toBe(right![1]!.y);
      expect(left![0]!.x).toBeLessThan(right![0]!.x);
      expect(middle![0]!.y).toBeLessThan(bottom![0]!.y);
    }
  });

  it('ㅈ is two strokes and ㅊ three: the bar runs into the left leg without a lift', () => {
    expect(strokes('jamo:jieut').map(signature)).toEqual(['right>downLeft', 'downRight']);
    expect(strokes('jamo:chieut').map(signature)).toEqual(['down', 'right>downLeft', 'downRight']);
  });

  it('ㅈ and ㅊ: the right leg leaves from the left leg, not from the air', () => {
    for (const [jamoId, legIdx] of [['jamo:jieut', 0], ['jamo:chieut', 1]] as const) {
      const all = strokes(jamoId);
      const [corner, foot] = [all[legIdx]![1]!, all[legIdx]![2]!];
      const start = all[legIdx + 1]![0]!;
      const t = (start.y - corner.y) / (foot.y - corner.y);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
      expect(Math.abs(corner.x + (foot.x - corner.x) * t - start.x)).toBeLessThan(1);
    }
  });

  it('ㅓ and ㅕ draw the ticks before the long bar; ㅏ ㅑ ㅜ ㅠ draw the long bar first', () => {
    const longest = (jamoId: string): number => {
      const lengths = strokes(jamoId).map((s) => Math.hypot(s[1]!.x - s[0]!.x, s[1]!.y - s[0]!.y));
      return lengths.indexOf(Math.max(...lengths));
    };
    expect(longest('jamo:eo')).toBe(1);
    expect(longest('jamo:yeo')).toBe(2);
    expect(longest('jamo:o')).toBe(1);
    expect(longest('jamo:yo')).toBe(2);
    for (const jamoId of ['jamo:a', 'jamo:ya', 'jamo:u', 'jamo:yu']) expect(longest(jamoId)).toBe(0);
  });
});

/**
 * Coverage is the pass gate (F-004); order and direction only choose a coaching line. So a learner
 * who writes a letter the way the data showed it before AU-14 still passes: the fix must not turn
 * a pass into a retry.
 */
describe('a letter written the way the old data showed it still passes (AU-14)', () => {
  const q = (x: number, y: number): JamoStrokePoint => ({ x, y });
  /** A finger sample every 4 units along the polyline. */
  const walk = (points: JamoStrokePoint[]): JamoStrokePoint[] => {
    const out: JamoStrokePoint[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i]!, points[i + 1]!];
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let s = 0; s < steps; s++) out.push(q(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps));
    }
    out.push(points[points.length - 1]!);
    return out;
  };

  const OLD: ReadonlyArray<[string, string, JamoStrokePoint[][]]> = [
    ['ㅁ as one closed stroke', 'jamo:mieum', [[q(50, 40), q(150, 40), q(150, 150), q(50, 150), q(50, 40)]]],
    ['ㅂ with the short right bar', 'jamo:bieup', [[q(50, 30), q(50, 150)], [q(150, 60), q(150, 150)], [q(50, 100), q(150, 100)], [q(50, 150), q(150, 150)]]],
    ['ㅈ with the left leg from the middle of the bar', 'jamo:jieut', [[q(40, 50), q(160, 50)], [q(110, 50), q(50, 150)], [q(110, 80), q(160, 150)]]],
    ['ㅊ with the left leg from the middle of the bar', 'jamo:chieut', [[q(100, 30), q(100, 55)], [q(40, 70), q(160, 70)], [q(110, 70), q(50, 150)], [q(110, 100), q(160, 150)]]],
    ['ㅌ in four strokes', 'jamo:tieut', [[q(40, 40), q(160, 40)], [q(50, 40), q(50, 95)], [q(40, 95), q(160, 95)], [q(50, 95), q(50, 150), q(160, 150)]]],
    ['ㅗ with the bar first', 'jamo:o', [[q(30, 100), q(170, 100)], [q(100, 60), q(100, 100)]]],
    ['ㅛ with the bar first', 'jamo:yo', [[q(30, 110), q(170, 110)], [q(75, 70), q(75, 110)], [q(125, 70), q(125, 110)]]],
  ];

  it.each(OLD)('%s', (_name, jamoId, old) => {
    const r = scoreTrace({ target: strokes(jamoId), drawn: old.map(walk), checkOrder: true, checkDirection: true });
    expect(r.coverage).toBeGreaterThanOrEqual(DEFAULT_PASS_THRESHOLD);
  });

  it.each(IDS)('%s traced along the data passes, in order, every stroke the right way', (jamoId) => {
    const r = scoreTrace({ target: strokes(jamoId), drawn: strokes(jamoId).map(walk), checkOrder: true, checkDirection: true });
    expect(r.coverage).toBe(1);
    expect(r.orderCorrect).toBe(true);
    expect(r.directionsCorrect).toBe(true);
    expect(r.passWithOrder).toBe(true);
  });

  it('the bar of ㅗ before its tick is now the order miss, and the tick first is clean', () => {
    const [tick, bar] = strokes('jamo:o').map(walk);
    expect(scoreTrace({ target: strokes('jamo:o'), drawn: [bar!, tick!], checkOrder: true }).orderCorrect).toBe(false);
    expect(scoreTrace({ target: strokes('jamo:o'), drawn: [tick!, bar!], checkOrder: true }).orderCorrect).toBe(true);
  });
});
