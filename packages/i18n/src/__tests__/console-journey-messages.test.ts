import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-ROUTE-001 R-9a (section 3.12, Appendix B `console.journey`): the journey strip on a roster
// card. English values are pinned; every locale passes the caregiver banned words and carries no
// ranking, comparison, ratio or percent, because the strip sits on a student card next to others.
const j = getMessages('en').console.journey;

const PHRASES = ['behind', 'ahead', 'average', 'rank', 'score', 'compared', 'best', 'worst', 'kids', 'ages', 'failed', 'left', 'remaining', 'only'];

function outputsOf(tree: unknown, prefix: string): string[] {
  const out: string[] = [];
  for (const path of leafPaths(tree as Record<string, unknown>)) {
    const value = lookup(tree as Record<string, unknown>, path);
    if (typeof value === 'function') {
      const samples = SAMPLES[`${prefix}.${path}`];
      expect(samples, `${prefix}.${path} needs a row in SAMPLES`).toBeDefined();
      for (const args of samples ?? []) out.push((value as (...a: unknown[]) => string)(...args));
    } else out.push(String(value));
  }
  return out;
}

describe('console.journey (English)', () => {
  it('words "On Stage N" and the stage line as in Appendix B, the known part only when greater than zero', () => {
    expect(j.title).toBe('Journey');
    expect(j.onStage(2)).toBe('On Stage 2');
    expect(j.stageLine(4, 2)).toBe('4 known from the level check, 2 quests done');
    expect(j.stageLine(8, 0)).toBe('8 known from the level check, 0 quests done');
    expect(j.stageLine(0, 1)).toBe('1 quest done');
    expect(j.stageLine(0, 4)).toBe('4 quests done');
    expect(j.details).toBe('Stage by stage');
  });

  it('puts the stage number with a line, and merges a run of stages', () => {
    expect(j.stage(1, j.stageLine(0, 4))).toBe('Stage 1: 4 quests done');
    expect(j.stage(3, j.state.later)).toBe('Stage 3: Coming later');
    expect(j.stages(5, 7, j.state.later)).toBe('Stages 5 to 7: Coming later');
  });

  it('names the five stage states', () => {
    expect(j.state).toEqual({ complete: 'Complete', known: 'Known from the level check', explored: 'Explored', open: 'Open', later: 'Coming later' });
  });
});

describe('console.journey (every locale)', () => {
  it('passes the caregiver banned words, with no ranking, ratio or percent', () => {
    for (const locale of LOCALES) {
      for (const text of outputsOf(getMessages(locale).console.journey, 'console.journey')) {
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        for (const phrase of PHRASES) expect(text.toLowerCase(), `${locale}: ${text}`).not.toMatch(new RegExp(`\\b${phrase}\\b`));
        expect(text, `${locale}: ${text}`).not.toMatch(/\d+ ?\/ ?\d+|%/);
      }
    }
  });
});
