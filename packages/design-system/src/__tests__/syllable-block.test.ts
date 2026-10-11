import { describe, expect, it } from 'vitest';
import {
  SYLLABLE_PARTS,
  SYLLABLE_CELL_SIZES,
  syllableBlockView,
  syllableCellLook,
} from '../components/SyllableBlock/layout';
import { borderWidth, colors, radii, spacing, touchTarget } from '../tokens';

const parts = (rows: ReturnType<typeof syllableBlockView>['rows']): string[][] =>
  rows.map((row) => row.map((cell) => cell.part));

describe('syllableBlockView (F-QUEST-002 §3.2 / §3.7)', () => {
  it('lists the three parts in reading order', () => {
    expect(SYLLABLE_PARTS).toEqual(['initial', 'vowel', 'final']);
  });

  it('vowel beside, no final: initial and vowel on one row', () => {
    const view = syllableBlockView({ vowel: 'beside', hasFinal: false });
    expect(parts(view.rows)).toEqual([['initial', 'vowel']]);
    expect(view.rows[0]?.map((c) => c.index)).toEqual([0, 1]);
  });

  it('vowel beside + final: the final fills a lower row', () => {
    const view = syllableBlockView({ vowel: 'beside', hasFinal: true });
    expect(parts(view.rows)).toEqual([['initial', 'vowel'], ['final']]);
  });

  it('vowel under: the vowel sits below the initial', () => {
    expect(parts(syllableBlockView({ vowel: 'under', hasFinal: false }).rows)).toEqual([['initial'], ['vowel']]);
    expect(parts(syllableBlockView({ vowel: 'under', hasFinal: true }).rows)).toEqual([
      ['initial'],
      ['vowel'],
      ['final'],
    ]);
  });

  it('marks only the highlighted part', () => {
    const view = syllableBlockView({ vowel: 'beside', hasFinal: true, highlight: 'final' });
    const flat = view.rows.flat();
    expect(flat.filter((c) => c.highlighted).map((c) => c.part)).toEqual(['final']);
  });

  it('highlights nothing by default', () => {
    const view = syllableBlockView({ vowel: 'beside', hasFinal: true });
    expect(view.rows.flat().some((c) => c.highlighted)).toBe(false);
  });

  it('ignores a highlight on a part the block does not have', () => {
    const view = syllableBlockView({ vowel: 'beside', hasFinal: false, highlight: 'final' });
    expect(view.rows.flat().some((c) => c.highlighted)).toBe(false);
  });

  it('carries the text of each part and leaves a missing one undefined', () => {
    const view = syllableBlockView({ vowel: 'beside', hasFinal: true, parts: ['ㅁ', 'ㅜ', undefined] });
    expect(view.rows.flat().map((c) => c.text)).toEqual(['ㅁ', 'ㅜ', undefined]);
    const bare = syllableBlockView({ vowel: 'beside', hasFinal: false });
    expect(bare.rows.flat().map((c) => c.text)).toEqual([undefined, undefined]);
  });

  it('sizes the boxes from touch-target tokens', () => {
    expect(SYLLABLE_CELL_SIZES).toEqual({ sm: touchTarget.min, md: touchTarget.child });
    expect(syllableBlockView({ vowel: 'beside', hasFinal: false }).cellSize).toBe(touchTarget.child);
    expect(syllableBlockView({ vowel: 'beside', hasFinal: false, size: 'sm' }).cellSize).toBe(touchTarget.min);
  });

  it('spaces boxes and rows with the small spacing token', () => {
    expect(syllableBlockView({ vowel: 'beside', hasFinal: false }).gap).toBe(spacing.sm);
  });
});

describe('syllableCellLook', () => {
  it('normal box: paper fill, subtle base border', () => {
    const look = syllableCellLook(false);
    expect(look.backgroundColor).toBe(colors.surface.paper);
    expect(look.borderColor).toBe(colors.border.subtle);
    expect(look.borderWidth).toBe(borderWidth.base);
    expect(look.borderRadius).toBe(radii.lg);
  });

  it('highlighted box: brand tint with a thicker brand border (never colour alone)', () => {
    const look = syllableCellLook(true);
    expect(look.backgroundColor).toBe(colors.brand.primaryLight);
    expect(look.borderColor).toBe(colors.brand.primary);
    expect(look.borderWidth).toBe(borderWidth.thick);
    expect(look.borderWidth).toBeGreaterThan(syllableCellLook(false).borderWidth);
    expect(look.borderRadius).toBe(radii.lg);
  });
});
