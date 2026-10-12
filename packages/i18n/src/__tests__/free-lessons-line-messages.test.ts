import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-ENT-003 section 3.9.2 (E3-12; wireframe console/free-lessons-line): the words of the
 * grown-up free-lessons line. `console.access` words it on console cards and the report;
 * `caregiver.access` on the device's grown-up screens. Third person, the product named by
 * space kind ([BY]: the Family Plan renews yearly), no price, no "Premium", no "trial", no
 * "day", no comparison, no "behind", "stuck" or "only".
 */
const en = getMessages('en');

const PHRASES = ['behind', 'falling behind', 'should have', 'missed too many', 'compared to', 'late', 'overdue', 'missed', 'failed', 'incomplete', 'lazy', 'kids', 'ages', 'stuck'];
const FORBIDDEN = /\bdays?\b|premium|trial|expires?|limited time|lifetime|\$|€|£|₩|price|\bbuy\b|\bonly\b|%/i;

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

describe('console.access: the three lines (English)', () => {
  const a = en.console.access;

  it('words free-end, plan-waiting and free-plan with the product', () => {
    expect(a.freeEnd('Mina', a.product.family)).toBe('Mina finished the free lessons. Stage 2 and later open with the Family Plan.');
    expect(a.planWaiting('Mina', 3, a.product.class)).toBe('Mina finished everything open in this plan. 3 more lessons open with a Group License.');
    expect(a.planWaiting('Sam', 1, a.product.family)).toBe('Sam finished everything open in this plan. 1 more lesson opens with the Family Plan.');
    expect(a.freePlan(11, a.product.family)).toBe('On the free plan, all of Stage 1 is open (11 lessons). Stage 2 and later open with the Family Plan.');
    expect(a.freePlan(1, a.product.class)).toBe('On the free plan, all of Stage 1 is open (1 lesson). Stage 2 and later open with a Group License.');
  });
});

describe('caregiver.access: the device words (English)', () => {
  const a = en.caregiver.access;

  it('words free-end and names the products as the console does', () => {
    expect(a.freeEnd('Mina', a.product.family)).toBe('Mina finished the free lessons. Stage 2 and later open with the Family Plan.');
    expect(a.product).toEqual({ family: 'the Family Plan', class: 'a Group License', either: 'the Family Plan or a Group License' });
  });

  it('agrees with the console on the shared glossary words (section 3.11)', () => {
    expect(a.product.family).toBe(en.console.access.product.family);
    expect(a.product.class).toBe(en.console.access.product.class);
    expect(a.freeEnd('Mina', a.product.class)).toBe(en.console.access.freeEnd('Mina', en.console.access.product.class));
  });
});

describe('the free-lessons line stays calm in every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no banned word, no F-PAR-001 phrase, no price, no "day", no Premium`, () => {
      const m = getMessages(locale);
      const outputs = [...outputsOf(m.console.access, 'console.access'), ...outputsOf(m.caregiver.access, 'caregiver.access')];
      expect(outputs.length).toBeGreaterThanOrEqual(13);
      for (const out of outputs) {
        expect(findBannedWord(out, locale, 'learner'), out).toBeNull();
        expect(findBannedWord(out, locale, 'caregiver'), out).toBeNull();
        for (const phrase of PHRASES) expect(out.toLowerCase(), out).not.toMatch(new RegExp(`\\b${phrase}\\b`));
        expect(out, out).not.toMatch(FORBIDDEN);
      }
    });
  }
});
