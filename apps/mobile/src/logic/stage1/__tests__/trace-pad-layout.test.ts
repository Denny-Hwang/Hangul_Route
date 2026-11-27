import { typeScale } from '@hangul-route/design-system/text-size';
import { layout } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { TRACE_CANVAS_MIN } from '../../trace-layout';
import {
  LANDSCAPE_LADDER,
  PORTRAIT_LADDER,
  ladderPlans,
  planOf,
  traceArrangement,
  type TracePadArrangement,
  type TracePadPage,
} from '../trace-pad-layout';

/**
 * [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE §3.4 "TC-0b result" (design/screens/discover-trace/trace-new-letters.md, table 1):
 * the arrangement the trace page takes at every window of `e2e/web/layout.spec.ts` and at Largest text, for the three
 * pages the mock measured (quest 1: four letters; quest 7: two finals; quest 8: three letters and a final).
 */

const QUEST_1: TracePadPage = {
  headings: ['Trace the letter a', 'Trace the letter eo', 'Trace the letter g/k', 'Trace the letter n'],
  hasFinal: false,
};
const QUEST_7: TracePadPage = { headings: ['Trace the final n', 'Trace the final l'], hasFinal: true };
const QUEST_8: TracePadPage = {
  headings: ['Trace the letter ya', 'Trace the letter yeo', 'Trace the letter p', 'Trace the final ng'],
  hasFinal: true,
};
const LETTERS = new Map<TracePadPage, number>([
  [QUEST_1, 4],
  [QUEST_7, 2],
  [QUEST_8, 4],
]);

/** The Screen content box of a window: the gutter of its width class on every side (no safe-area inset on the web). */
function boxOf(width: number, height: number): { width: number; height: number } {
  const gutter = width >= layout.breakpoint.wide ? layout.gutter.wide : width >= layout.breakpoint.regular ? layout.gutter.regular : layout.gutter.compact;
  return { width: width - 2 * gutter, height: height - 2 * gutter };
}
function pick(width: number, height: number, page: TracePadPage, f = 1): TracePadArrangement {
  return traceArrangement({ box: boxOf(width, height), scale: typeScale(f), page, letters: LETTERS.get(page) ?? 4 }).arrangement;
}

describe('the trace page ladder (table 1 of the TC-0b note)', () => {
  it('320 x 568: short (quests 1 and 7), short-b with a final and a long page (quest 8)', () => {
    expect(pick(320, 568, QUEST_1)).toBe('short');
    expect(pick(320, 568, QUEST_7)).toBe('short');
    expect(pick(320, 568, QUEST_8)).toBe('short-b');
  });

  it('375 x 553: short-b on every page', () => {
    for (const page of [QUEST_1, QUEST_7, QUEST_8]) expect(pick(375, 553, page)).toBe('short-b');
  });

  it('375 x 667: compact (quests 1 and 7), short (quest 8)', () => {
    expect(pick(375, 667, QUEST_1)).toBe('compact');
    expect(pick(375, 667, QUEST_7)).toBe('compact');
    expect(pick(375, 667, QUEST_8)).toBe('short');
  });

  it('844 x 390 (landscape): side-short with four letters and no final (quest 1), without chips when a final adds a line (quests 7 and 8)', () => {
    expect(pick(844, 390, QUEST_1)).toBe('side-short');
    expect(pick(844, 390, QUEST_7)).toBe('side-short-b');
    expect(pick(844, 390, QUEST_8)).toBe('side-short-b');
  });

  it('390 x 844, 768 x 1024: full; 1180 x 820: side', () => {
    for (const page of [QUEST_1, QUEST_7, QUEST_8]) {
      expect(pick(390, 844, page)).toBe('full');
      expect(pick(768, 1024, page)).toBe('full');
      expect(pick(1180, 820, page)).toBe('side');
    }
  });

  it('Largest text on 390 x 844: beside on every page', () => {
    for (const page of [QUEST_1, QUEST_7, QUEST_8]) expect(pick(390, 844, page, 1.5)).toBe('beside');
  });

  it('200 % text on 390 x 844 (a stress case, not an acceptance size): a step with a canvas of at least 160', () => {
    for (const page of [QUEST_1, QUEST_7, QUEST_8]) {
      const plan = traceArrangement({ box: boxOf(390, 844), scale: typeScale(2), page, letters: LETTERS.get(page) ?? 4 });
      expect(plan.fits).toBe(true);
      expect(plan.canvasSlot).toBeGreaterThanOrEqual(TRACE_CANVAS_MIN);
    }
  });

  it('takes the first step of the ladder that fits, and every step before it does not', () => {
    for (const [w, h] of [[320, 568], [375, 667], [390, 844], [844, 390]] as const) {
      const steps = ladderPlans({ box: boxOf(w, h), scale: typeScale(1), page: QUEST_1, letters: 4 });
      const plan = traceArrangement({ box: boxOf(w, h), scale: typeScale(1), page: QUEST_1, letters: 4 });
      const ladder = plan.side ? LANDSCAPE_LADDER : PORTRAIT_LADDER;
      expect(steps.map((s) => s.arrangement)).toEqual([...ladder]);
      expect(plan.fits).toBe(true);
      expect(plan.canvasSlot).toBeGreaterThanOrEqual(TRACE_CANVAS_MIN);
      // every step before the chosen one is under the floor, and the chosen one is the first that is not
      const at = ladder.indexOf(plan.arrangement);
      for (const earlier of steps.slice(0, at)) expect(earlier.canvasSlot).toBeLessThan(TRACE_CANVAS_MIN);
    }
  });

  it('is a pure function of the box, the scale and the page: the same input gives the same plan', () => {
    const input = { box: boxOf(375, 667), scale: typeScale(1), page: QUEST_1, letters: 4 };
    expect(traceArrangement(input)).toEqual(traceArrangement({ ...input }));
  });

  it('a window no step fits (smaller than the acceptance set) gets the last step, flagged as not fitting', () => {
    const plan = traceArrangement({ box: boxOf(320, 568), scale: typeScale(1.5), page: QUEST_8, letters: 4 });
    expect(plan.arrangement).toBe('short-b');
    expect(plan.fits).toBe(false);
    const landscape = traceArrangement({ box: boxOf(640, 360), scale: typeScale(1.5), page: QUEST_8, letters: 4 });
    expect(landscape.arrangement).toBe('side-short-b');
    expect(landscape.fits).toBe(false);
  });

  it('a window an acceptance size is not yet known (the first web frame reports 0): the full step, nothing thrown', () => {
    const plan = traceArrangement({ box: { width: 0, height: 0 }, scale: typeScale(1), page: QUEST_1, letters: 4 });
    expect(PORTRAIT_LADDER).toContain(plan.arrangement);
  });
});

describe('what each arrangement draws (the mock\'s ladder)', () => {
  it('full is the spec\'s rules 1-4: title, step dots row, page row, own chips row, controls in one row, 80 high pinned row', () => {
    expect(planOf('full')).toMatchObject({ side: false, title: true, dotsInHeader: false, pageRow: true, chips: true, chipsOwnRow: true, helpersBeside: false, rowSize: 'lg' });
  });
  it('beside moves Hear it and Show me beside the canvas and the chips to the heading; the title stays', () => {
    expect(planOf('beside')).toMatchObject({ title: true, chipsOwnRow: false, helpersBeside: true, rowSize: 'lg' });
  });
  it('compact draws no step title (owner decision 2026-11-26)', () => {
    expect(planOf('compact')).toMatchObject({ title: false, pageRow: true, dotsInHeader: false, rowSize: 'lg' });
  });
  it('short puts the step dots in the header, no page row, no pill, and Previous / Continue 64 high (owner decision)', () => {
    expect(planOf('short')).toMatchObject({ title: false, dotsInHeader: true, pageRow: false, pill: false, chips: true, rowSize: 'md' });
  });
  it('short-b is short without the chips (the spec\'s fallback b)', () => {
    expect(planOf('short-b')).toMatchObject({ chips: false, dotsInHeader: true, rowSize: 'md' });
  });
  it('the side steps: side keeps the title and the 80 high row; side-short keeps the pill in the header, 64 high; side-short-b drops the chips', () => {
    expect(planOf('side')).toMatchObject({ side: true, title: true, rowSize: 'lg' });
    expect(planOf('side-short')).toMatchObject({ side: true, title: false, dotsInHeader: true, pill: true, chips: true, rowSize: 'md' });
    expect(planOf('side-short-b')).toMatchObject({ side: true, chips: false, rowSize: 'md' });
  });
  it('every arrangement but the short ones keeps Previous and Continue at the child size (80)', () => {
    for (const a of ['full', 'beside', 'compact', 'side'] as const) expect(planOf(a).rowSize).toBe('lg');
    for (const a of ['short', 'short-b', 'side-short', 'side-short-b'] as const) expect(planOf(a).rowSize).toBe('md');
  });
});
