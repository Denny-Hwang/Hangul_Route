import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

/**
 * F-ENT-003 section 3.11 and Appendix A (PR E3-4): the plan words a learner reads on Home and
 * Results, and the Next / In your plan tags E3-5 and E3-6 draw. Any age reads them; "plan" is the
 * learner's curriculum, never an access word, and nothing is ever late, skipped or wrong.
 */
const BANNED: readonly RegExp[] = [
  /premium/i,
  /\bprice\b/i,
  /\bbuy\b/i,
  /\bpay\b/i,
  /\btrial\b/i,
  /\bexpired\b/i,
  /\bended\b/i,
  /\blocked\b/i,
  /\bunlock/i,
  /\bleft\b/i,
  /\bonly\b/i,
  /\bremaining\b/i,
  /\blate\b/i,
  /\bskipped\b/i,
  /\bwrong\b/i,
  /not in your plan/i,
  /family plan/i,
  /group license/i,
  /\bdays?\b/i,
  /%/,
  /\d/,
];

describe('learner.routeNext (F-ENT-003 E3-4)', () => {
  it('holds the Appendix A English values', () => {
    expect(getMessages('en').learner.routeNext).toEqual({
      tag: { next: 'Next', inPlan: 'In your plan' },
      home: { subtitle: 'Next in your plan' },
      results: { caption: 'Next in your plan', backToPlan: 'Back to your plan' },
    });
  });

  for (const locale of LOCALES) {
    it(`${locale}: every value is a short line with no banned word, digit or emoji`, () => {
      const tree = getMessages(locale).learner.routeNext;
      const paths = leafPaths(tree);
      expect(paths.length).toBe(5);
      for (const path of paths) {
        const value = lookup(tree, path);
        expect(typeof value, path).toBe('string');
        const text = value as string;
        expect(text.trim(), path).not.toBe('');
        for (const rule of BANNED) expect(text, `${path}: ${rule}`).not.toMatch(rule);
        expect(text, path).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(text.length, path).toBeLessThanOrEqual(28);
      }
    });
  }
});
