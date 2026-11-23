import { describe, expect, it } from 'vitest';
import { LIST_COPY_KEEP_MS, listCopySettledAt, listCopyStep, settledMark } from '../list-copy';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.6 (row DP-1d): the kept copy of a damaged profile list
 * (`profiles-corrupt`) goes 30 days after the list reads again or a grown-up recovery replaced it. The mark says
 * when that was; these rules read it and say what a launch does with the copy.
 */
const DAY = 24 * 60 * 60_000;
const NOW = Date.parse('2026-11-23T12:00:00.000Z');

describe('the settled mark', () => {
  it('is written as { v: 1, at }', () => {
    expect(settledMark(NOW)).toEqual({ v: 1, at: NOW });
  });

  it('reads its time; anything else has no time it can trust', () => {
    expect(listCopySettledAt({ v: 1, at: NOW })).toBe(NOW);
    expect(listCopySettledAt(null)).toBeNull();
    expect(listCopySettledAt({ v: 2, at: NOW })).toBeNull();
    expect(listCopySettledAt({ v: 1, at: 'yesterday' })).toBeNull();
    expect(listCopySettledAt({ v: 1, at: Number.NaN })).toBeNull();
    expect(listCopySettledAt({ v: 1, at: -1 })).toBeNull();
    expect(listCopySettledAt('{damaged')).toBeNull();
  });
});

describe('what a launch whose list reads does with a kept copy', () => {
  it('30 days', () => {
    expect(LIST_COPY_KEEP_MS).toBe(30 * DAY);
  });

  it('no mark (or a mark without a time): mark it now, so the 30 days start (the safe side)', () => {
    expect(listCopyStep(null, NOW)).toBe('mark');
  });

  it('marked less than 30 days ago: keep it', () => {
    expect(listCopyStep(NOW - 29 * DAY, NOW)).toBe('wait');
    expect(listCopyStep(NOW - (30 * DAY - 1), NOW)).toBe('wait');
  });

  it('marked 30 days ago or more: drop it', () => {
    expect(listCopyStep(NOW - 30 * DAY, NOW)).toBe('drop');
    expect(listCopyStep(NOW - 400 * DAY, NOW)).toBe('drop');
  });

  it('a mark in the future (a clock that was ahead, or ran back) is marked again now, so the 30 days always end', () => {
    expect(listCopyStep(NOW + 5 * DAY, NOW)).toBe('mark');
    expect(listCopyStep(NOW + 1, NOW)).toBe('mark');
    expect(listCopyStep(NOW, NOW)).toBe('wait');
  });
});
