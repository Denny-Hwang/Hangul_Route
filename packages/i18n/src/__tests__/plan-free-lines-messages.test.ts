import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-ENT-003 section 3.9.1 (E3-8; wireframe billing/plan-status-free-lessons): the free-plan lines
 * F-ENT-003 adds to F-BILL-002's learner Plan screen, under `caregiver.plan.freePlan`. English is
 * the source (Appendix A); es and ko follow the F-I18N-001 native-review flow. Grown-up words, no
 * price, no offer, no "Premium", no "trial", never "day" (OD-8), no comparison, no deny-list word
 * of F-BILL-002 section 4.8 in the lines a native build could show.
 */
const en = getMessages('en');
const f = en.caregiver.plan.freePlan;

const PHRASES = ['behind', 'falling behind', 'should have', 'missed too many', 'compared to', 'late', 'overdue', 'missed', 'failed', 'incomplete', 'lazy', 'kids', 'ages', 'stuck'];
const FORBIDDEN = /\bdays?\b|premium|trial|expires?|limited time|lifetime|unlock|\$|€|£|₩|price|\bbuy\b|\bonly\b|%/i;
/** F-BILL-002 section 4.8 rule 1: words a native build never shows. `setPlanWeb` is web only. */
const NATIVE_DENY = /\bweb\b|website|browser|hangulroute\.com|billing page|console/i;

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

describe('caregiver.plan.freePlan: the free-plan line (English, Appendix A)', () => {
  it('words the line from the figures, with and without letters', () => {
    expect(f.line(15, 24, 65)).toBe('Stage 1 is free: 15 lessons, 24 letters, about 65 minutes. Everything finished stays.');
    expect(f.lineNoLetters(15, 65)).toBe('Stage 1 is free: 15 lessons, about 65 minutes. Everything finished stays.');
  });

  it('counts in the singular for one', () => {
    expect(f.line(1, 1, 1)).toBe('Stage 1 is free: 1 lesson, 1 letter, about 1 minute. Everything finished stays.');
    expect(f.lineNoLetters(1, 1)).toBe('Stage 1 is free: 1 lesson, about 1 minute. Everything finished stays.');
  });

  it('lists what else is free', () => {
    expect(f.stories(6)).toBe('6 short stories');
    expect(f.stories(1)).toBe('1 short story');
    expect(f.topics(4)).toBe('4 word topics');
    expect(f.topics(1)).toBe('1 word topic');
  });

  it('words the class and free-end lines for a family device and a self learner', () => {
    expect(f.classLine.family('Mina')).toBe("Mina's teacher can open every lesson for the class.");
    expect(f.classLine.self).toBe('Your teacher can open every lesson for the class.');
    expect(f.freeEnd.family('Mina')).toBe('Mina finished the free lessons.');
    expect(f.freeEnd.self).toBe('You finished the free lessons.');
  });

  it('words the no-plan guidance, and the web line names the grown-up page with no link', () => {
    expect(f.setPlan).toBe('Set a plan to guide what comes next.');
    expect(f.setPlanWeb).toBe('Plans are made in the grown-up area: Plan the term.');
  });

  it('types no figure: every number comes in as an argument', () => {
    for (const path of leafPaths(f as unknown as Record<string, unknown>)) {
      const value = lookup(f as unknown as Record<string, unknown>, path);
      if (typeof value === 'string' && path !== 'line' && path !== 'lineNoLetters') {
        // "Stage 1" is a name, not a count; nothing else carries a digit.
        expect(value.replace('Stage 1', ''), path).not.toMatch(/\d/);
      }
    }
  });

  it('agrees with the device free-end words of section 3.9.2 on how the free part is named', () => {
    expect(en.caregiver.access.freeEnd('Mina', 'the Family Plan').startsWith(f.freeEnd.family('Mina'))).toBe(true);
  });
});

describe('the free-plan lines stay calm in every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no banned word, no F-PAR-001 phrase, no price, no "day", no Premium`, () => {
      const m = getMessages(locale);
      const outputs = outputsOf(m.caregiver.plan.freePlan, 'caregiver.plan.freePlan');
      expect(outputs.length).toBeGreaterThanOrEqual(10);
      for (const out of outputs) {
        expect(findBannedWord(out, locale, 'caregiver'), out).toBeNull();
        for (const phrase of PHRASES) expect(out.toLowerCase(), out).not.toMatch(new RegExp(`\\b${phrase}\\b`));
        expect(out, out).not.toMatch(FORBIDDEN);
      }
    });
  }

  it('the lines a native build can show hold no web word (F-BILL-002 section 4.8 rule 1)', () => {
    const { setPlanWeb: _web, ...native } = f;
    void _web;
    for (const out of outputsOf(native, 'caregiver.plan.freePlan')) expect(out, out).not.toMatch(NATIVE_DENY);
  });
});
