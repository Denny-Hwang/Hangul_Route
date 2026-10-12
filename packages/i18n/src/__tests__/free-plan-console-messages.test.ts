import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-ENT-003 section 3.11 (glossary) and section 3.9.3 (E3-9): the console's free-plan words.
 * `console.access` holds the products a grown-up reads, named by space kind ([BY]: the Family
 * Plan renews yearly; "Family Lifetime" is gone), and the Open billing label (F-BILL-002's,
 * never "See plans"); `console.curriculum.freeDays` words the wizard's warning and short-plan
 * line. Grown-up copy: no price, no "Premium", no "trial", no countdown, no "day", no
 * comparison, no F-PAR-001 phrase.
 */
const en = getMessages('en').console;

const PHRASES = ['behind', 'falling behind', 'should have', 'missed too many', 'compared to', 'late', 'overdue', 'missed', 'failed', 'incomplete', 'lazy', 'kids', 'ages'];
const FORBIDDEN = /\bdays?\b|premium|trial|expires?|limited time|lifetime|\$|€|£|₩|price|\bbuy\b|\bonly\b/i;

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

describe('console.access and console.curriculum.freeDays (English)', () => {
  it('names the products by space kind and labels the billing link Open billing', () => {
    expect(en.access.product).toEqual({ family: 'the Family Plan', class: 'a Group License' });
    expect(en.access.openBilling.cta).toBe('Open billing');
  });

  it('words the wizard warning with the weeks that hold lessons and the left-out count', () => {
    const f = en.curriculum.freeDays;
    expect(f.warning(1, 7, 3, 'a Group License')).toBe('The free plan covers Stage 1 (lessons in weeks 1 to 7). 3 more lessons open with a Group License. They are left out of this plan.');
    expect(f.warning(4, 10, 3, 'the Family Plan')).toBe('The free plan covers Stage 1 (lessons in weeks 4 to 10). 3 more lessons open with the Family Plan. They are left out of this plan.');
    expect(f.warning(1, 1, 1, 'the Family Plan')).toBe('The free plan covers Stage 1 (lessons in week 1). 1 more lesson opens with the Family Plan. It is left out of this plan.');
    expect(f.warningNoLessons(14, 'a Group License')).toBe('The free plan covers Stage 1. 14 more lessons open with a Group License. They are left out of this plan.');
    expect(f.warningNoLessons(1, 'the Family Plan')).toBe('The free plan covers Stage 1. 1 more lesson opens with the Family Plan. It is left out of this plan.');
    expect(f.shortPlan(7)).toBe('This plan has lessons until week 7. After that it has stories and practice.');
    expect(f.shortPlanPractice(7)).toBe('This plan has lessons until week 7. After that it has practice.');
    expect(f.useWeeks.cta(4)).toBe('Use 4 weeks');
    expect(f.useWeeks.cta(12)).toBe('Use 12 weeks');
  });
});

describe('the free-plan console words stay calm in every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no banned word, no F-PAR-001 phrase, no price, no "day", no Premium`, () => {
      const c = getMessages(locale).console;
      const outputs = [...outputsOf(c.access, 'console.access'), ...outputsOf(c.curriculum.freeDays, 'console.curriculum.freeDays')];
      expect(outputs.length).toBeGreaterThanOrEqual(10);
      for (const out of outputs) {
        expect(findBannedWord(out, locale, 'learner'), out).toBeNull();
        expect(findBannedWord(out, locale, 'caregiver'), out).toBeNull();
        for (const phrase of PHRASES) expect(out.toLowerCase(), out).not.toMatch(new RegExp(`\\b${phrase}\\b`));
        expect(out, out).not.toMatch(FORBIDDEN);
      }
    });
  }
});
