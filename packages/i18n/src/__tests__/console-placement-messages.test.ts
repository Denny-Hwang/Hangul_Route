import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-PLC-001 section 3.9 (P-9, wireframe placement K): the roster's starting-spot line and the
// advisory "Suggest a different start" hand-off. English values are pinned; every locale must
// pass the caregiver banned-word list and carry no ranking or comparison words, because the
// line sits on a student card next to other students.
const p = getMessages('en').console.placement;

const PHRASES = ['behind', 'ahead', 'average', 'rank', 'score', 'compared', 'best', 'worst', 'kids', 'ages', 'failed', 'test'];

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

describe('console.placement (English)', () => {
  it('words the starting-spot line as in the spec example', () => {
    expect(p.startingSpot(1, 'Letters and sounds', 'Oct 9')).toBe('Starting spot: Stage 1 · Letters and sounds · Oct 9');
    expect(p.overridden).toBe('Changed by a grown-up');
  });

  it('words the advisory hand-off as an ordinary plan', () => {
    expect(p.suggest.cta).toBe('Suggest a different start');
    expect(p.suggest.label('Sam')).toBe('Suggest a different start for Sam');
    expect(p.suggest.label('Sam').startsWith(p.suggest.cta)).toBe(true);
    expect(p.suggestTitle).toBe('A suggested next step');
    expect(p.suggestNote).toBe('Try this next');
    expect(p.suggestFor('Sam')).toBe("A suggestion for Sam. It arrives as a plan and never changes Sam's level check or progress.");
  });

  it('keeps the plan note and title within the plan limits', () => {
    for (const locale of LOCALES) {
      expect(getMessages(locale).console.placement.suggestNote.length).toBeLessThanOrEqual(80);
      expect(getMessages(locale).console.placement.suggestTitle.length).toBeLessThanOrEqual(60);
    }
  });
});

describe('console.placement (every locale)', () => {
  it('passes the caregiver banned words and has no ranking words', () => {
    for (const locale of LOCALES) {
      for (const text of outputsOf(getMessages(locale).console.placement, 'console.placement')) {
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        for (const phrase of PHRASES) expect(text.toLowerCase(), `${locale}: ${text}`).not.toMatch(new RegExp(`\\b${phrase}\\b`));
      }
    }
  });
});
