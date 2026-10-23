import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { cellOffer, jumpCells, stageJumpOffer, type CellOfferInput, type JumpCell, type StageJumpOfferInput } from '../cell-check-offer';

/**
 * F-CURR-002 row CM-21 (cell-check.md A, A2, B and States; mastery-ring.md E): what a cell's page offers. The Check
 * after the first volume or a test-out; Test out on an unstarted, open, non-Stage-1 cell; the entitlement rule (a
 * locked cell offers no test-out); E3's hidden arm; `cellCheck` off; the mastery hint.
 */

const base: CellOfferInput = { stage: 'stage2', stars: [0, 0, 0], open: [true, true, true], testedOut: false, checkPassed: false, level: 0, checkOn: true, masteryOn: true, arm: 'offered', playable: true };
const offer = (over: Partial<CellOfferInput>) => cellOffer({ ...base, ...over });

describe('the Cell Check (block A)', () => {
  it('after every quest is done: the page primary; after a 3-star Check: Cell Check done and Take it again, secondary', () => {
    expect(offer({ stars: [3, 2, 1], level: 1 })).toMatchObject({ check: { tone: 'primary', again: false }, done: false, testOut: false, block: true });
    expect(offer({ stars: [3, 2, 1], level: 2, checkPassed: true })).toMatchObject({ check: { tone: 'secondary', again: true }, done: true });
  });

  it('not before the first volume is done; secondary on a tested-out cell', () => {
    expect(offer({ stars: [3, 0, 0] }).check).toBeNull();
    expect(offer({ testedOut: true, level: 1 }).check).toEqual({ tone: 'secondary', again: false });
  });

  it('none with fewer than 5 playable rounds, or with cellCheck off; latched results stay for when it is back', () => {
    expect(offer({ stars: [3, 3, 3], playable: false }).check).toBeNull();
    const off = offer({ stars: [3, 3, 3], level: 3, checkPassed: true, checkOn: false });
    expect(off).toMatchObject({ check: null, done: false, testOut: false, level: 3 });
  });
});

describe('Test out (line B)', () => {
  it('on an unstarted Stage 2+ cell whose every quest is open', () => {
    expect(offer({}).testOut).toBe(true);
    expect(offer({ stage: 'stage4' }).testOut).toBe(true);
  });

  it('entitlement (F-ENT-003): a locked cell offers no test-out, nor one with any quest not open', () => {
    expect(offer({ open: [false, false, false] }).testOut).toBe(false);
    expect(offer({ open: [true, true, false] }).testOut).toBe(false);
    expect(offer({ open: [] }).testOut).toBe(false);
  });

  it('never on Stage 1, a started or tested-out cell, in E3 hidden arm, with too few rounds or the flag off', () => {
    expect(offer({ stage: 'stage1' }).testOut).toBe(false);
    expect(offer({ stars: [1, 0, 0] }).testOut).toBe(false);
    expect(offer({ testedOut: true }).testOut).toBe(false);
    expect(offer({ arm: 'hidden' }).testOut).toBe(false);
    expect(offer({ playable: false }).testOut).toBe(false);
    expect(offer({ checkOn: false }).testOut).toBe(false);
  });

  it('an unstarted cell draws no block A (nothing to review yet)', () => {
    expect(offer({}).block).toBe(false);
  });
});

describe('the mastery block (E)', () => {
  it('the level from Done up, with one hint for the next level; none at Mastered; none with mastery off', () => {
    expect(offer({ stars: [1, 1, 1], level: 1 })).toMatchObject({ level: 1, hint: 'practiced' });
    expect(offer({ stars: [1, 1, 1], level: 2 })).toMatchObject({ level: 2, hint: 'check' });
    expect(offer({ stars: [1, 1, 1], level: 2, checkPassed: true })).toMatchObject({ level: 2, hint: 'mastered' });
    expect(offer({ stars: [1, 1, 1], level: 3, checkPassed: true })).toMatchObject({ level: 3, hint: null });
    expect(offer({ stars: [1, 1, 1], level: 2, masteryOn: false })).toMatchObject({ level: null, hint: null, block: true });
    // "Take the Cell Check" only while the Check is on.
    expect(offer({ stars: [1, 1, 1], level: 2, checkOn: false })).toMatchObject({ hint: 'mastered', check: null, block: true });
  });
});

describe('Stage Jump Ahead (row CM-25): the stage the route has reached, before it is started, every quest open', () => {
  const cell = (stage: string, theme: string, n = 2): JumpCell => ({ id: `episode:${stage}-${theme}`, stage, questIds: Array.from({ length: n }, (_, k) => `quest:${stage}-${theme}-q${k + 1}`) });
  const CELLS: JumpCell[] = ['stage1', 'stage2', 'stage3'].flatMap((s) => [cell(s, 'letters'), cell(s, 'life', 3)]);
  const questsOf = (stage: string): string[] => CELLS.filter((c) => c.stage === stage).flatMap((c) => c.questIds);
  const jumpBase: StageJumpOfferInput = {
    stage: 'stage2',
    cells: CELLS,
    done: new Set(questsOf('stage1')),
    placedOut: undefined,
    testedOut: undefined,
    open: () => true,
    checkOn: true,
    arm: 'offered',
    playable: true,
  };
  const jump = (over: Partial<StageJumpOfferInput>) => stageJumpOffer({ ...jumpBase, ...over });

  it('offered on the next stage once every earlier quest is done, placed out or tested out', () => {
    expect(jump({})).toBe(true);
    expect(jump({ done: new Set(), placedOut: new Set(questsOf('stage1')) })).toBe(true);
    expect(jump({ stage: 'stage3', done: new Set(questsOf('stage1')), testedOut: { 'episode:stage2-letters': 't', 'episode:stage2-life': 't', stage2: 't' } })).toBe(true);
    // A cell tested out on its own covers it too.
    expect(jump({ stage: 'stage3', done: new Set([...questsOf('stage1'), ...CELLS[3]!.questIds]), testedOut: { 'episode:stage2-letters': 't' } })).toBe(true);
  });

  it('not ahead of the route: an earlier stage with a quest left is not covered', () => {
    expect(jump({ done: new Set(questsOf('stage1').slice(1)) })).toBe(false);
    expect(jump({ stage: 'stage3' })).toBe(false);
  });

  it('never on Stage 1, a jumped stage, a started stage or a stage with a tested-out cell', () => {
    expect(jump({ stage: 'stage1', done: new Set() })).toBe(false);
    expect(jump({ testedOut: { stage2: 't' } })).toBe(false);
    expect(jump({ done: new Set([...questsOf('stage1'), 'quest:stage2-life-q2']) })).toBe(false);
    expect(jump({ testedOut: { 'episode:stage2-life': 't' } })).toBe(false);
    expect(jump({ stage: 'stage4' })).toBe(false);
  });

  it('entitlement (F-ENT-003): a stage with one locked quest offers no jump', () => {
    expect(jump({ open: (q) => q !== 'quest:stage2-life-q3' })).toBe(false);
    expect(jump({ open: () => false })).toBe(false);
  });

  it('cellCheck off, the hidden arm, or fewer than 10 playable rounds: no jump', () => {
    expect(jump({ checkOn: false })).toBe(false);
    expect(jump({ arm: 'hidden' })).toBe(false);
    expect(jump({ playable: false })).toBe(false);
  });
});

describe('jumpCells: the playable grid cells with quests', () => {
  it('leaves out preview placeholders, shelf stories and empty cells', () => {
    const cells = jumpCells(episodesAll);
    expect(cells.length).toBeGreaterThan(10);
    for (const c of cells) expect(c.questIds.length, c.id).toBeGreaterThan(0);
    const ids = new Set(cells.map((c) => c.id));
    for (const e of episodesAll) if (e.status === 'preview' || e.placement === 'shelf') expect(ids.has(e.id), e.id).toBe(false);
    expect(cells.some((c) => c.stage === 'stage2')).toBe(true);
  });
});
