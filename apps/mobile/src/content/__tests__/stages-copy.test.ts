import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { describe, expect, it } from 'vitest';
import { stages } from '../stages';

/**
 * Stage one-liners and anchor skills follow the standing rules (F-CURR-002 row CM-1, OD-12).
 *
 * The one-liners are shown on the Journey, the Learning Route trail and the stage list, so
 * they are read by learners of any age (CLAUDE.md section 1). The `review-copy` patterns of
 * F-CURR-002 section 9.3 apply: no `%` and no "n of m" or "n/m", no age wording, and no
 * speaking-UI words (the app teaches reading, listening and writing; it measures no speaking).
 *
 * KNOWN_EXCEPTIONS lists the strings that predate OD-12 and that OD-12 did not reword. It is a
 * ratchet: a new string may not join it, and a string that is fixed must leave it.
 */

const PERCENT_OR_FRACTION = /%|\b\d+\s*(of|\/)\s*\d+\b/i;
const AGE_WORDING =
  /\b(ages?\s+\d+|\d+\s*(-|–|to)\s*\d+\s*(years?|yrs?)|\d+\s*(years?|yrs?)\s*(old|\+)|kids?|child(ren)?|toddlers?|little ones?)\b/i;
const SPEAKING_WORDS = /\b(record(s|ed|ing)?|speak(s|ing)?|spoke|say(s|ing)?|said|call(s|ed|ing)?)\b/i;

const RULES: Array<[string, RegExp]> = [
  ['percent or fraction', PERCENT_OR_FRACTION],
  ['age wording', AGE_WORDING],
  ['speaking word', SPEAKING_WORDS],
];

/** `<stage key>.<field>` -> the rule it still breaks. Shrinks only. */
const KNOWN_EXCEPTIONS: Record<string, string> = {
  'stage1.anchorSkillEn': 'percent or fraction',
  'stage5.anchorSkillEn': 'percent or fraction',
  'stage7.oneLinerEn': 'speaking word',
};

const fields = stages.flatMap((s) => [
  [`${s.key}.oneLinerEn`, s.oneLinerEn] as const,
  [`${s.key}.anchorSkillEn`, s.anchorSkillEn] as const,
]);

const violations = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [where, text] of fields) {
    for (const [rule, re] of RULES) {
      if (re.test(text)) out[where] = rule;
    }
  }
  return out;
};

describe('stage copy (F-CURR-002 OD-12)', () => {
  it('carries the OD-12 wording', () => {
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
    expect(byKey.stage4?.oneLinerEn).toBe('Read and answer short everyday exchanges.');
    expect(byKey.stage5?.oneLinerEn).toBe('Read heritage stories and tales with Hoya.');
    expect(byKey.stage6?.oneLinerEn).toBe('Take Korean out into the world: menus, signs and short messages.');
    expect(byKey.stage7?.anchorSkillEn).toBe('Write a short personal introduction');
  });

  it('the review-copy patterns catch what they are meant to catch', () => {
    expect(PERCENT_OR_FRACTION.test('at 90% accuracy')).toBe(true);
    expect(PERCENT_OR_FRACTION.test('3 of 5 right')).toBe(true);
    expect(PERCENT_OR_FRACTION.test('3/5')).toBe(true);
    expect(PERCENT_OR_FRACTION.test('Read a 5-sentence story')).toBe(false);
    expect(AGE_WORDING.test('For ages 6-10')).toBe(true);
    expect(AGE_WORDING.test('for 8 to 12 years')).toBe(true);
    expect(AGE_WORDING.test('7 years old')).toBe(true);
    expect(AGE_WORDING.test('Korean for kids')).toBe(true);
    expect(AGE_WORDING.test('Read 60 core words')).toBe(false);
    expect(SPEAKING_WORDS.test('Record a 1-minute introduction')).toBe(true);
    expect(SPEAKING_WORDS.test('Speak with Hoya')).toBe(true);
    expect(SPEAKING_WORDS.test('Say what you think')).toBe(true);
    expect(SPEAKING_WORDS.test('menus, signs, calls')).toBe(true);
    expect(SPEAKING_WORDS.test('Recognize every letter')).toBe(false);
    expect(SPEAKING_WORDS.test('Read and answer short everyday exchanges.')).toBe(false);
  });

  it('no stage one-liner or anchor skill breaks the review-copy patterns, beyond the known exceptions', () => {
    expect(violations()).toEqual(KNOWN_EXCEPTIONS);
  });

  it('no stage copy carries emoji', () => {
    for (const [where, text] of fields) {
      expect(/\p{Extended_Pictographic}/u.test(text), where).toBe(false);
    }
  });

  it('every stage has es and ko one-liner and anchor skill overlays', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const s of stages) {
        const entry = OVERLAYS[locale][`stage:${s.key}`];
        expect(entry?.oneLiner?.trim(), `${locale} stage:${s.key} oneLiner`).toBeTruthy();
        expect(entry?.anchorSkill?.trim(), `${locale} stage:${s.key} anchorSkill`).toBeTruthy();
      }
    }
  });

  it('the es and ko overlays of the OD-12 strings drop the old speaking and folk-story wording', () => {
    const es = OVERLAYS.es;
    const ko = OVERLAYS.ko;
    // Spanish: grabar ("record"), llamadas ("calls"), cuentos populares ("folk tales").
    expect(es['stage:stage7']?.anchorSkill).not.toMatch(/\bgrab/i);
    expect(es['stage:stage6']?.oneLiner).not.toMatch(/\bllamad/i);
    expect(es['stage:stage5']?.oneLiner).not.toMatch(/populares/i);
    // Korean, as escapes so this file holds no Hangul: noeum ("recording"), jeonhwa ("phone call"),
    // yetiyagi ("folk tale"), and the 1-minute (1bun) length of the old Stage 7 skill.
    expect(ko['stage:stage7']?.anchorSkill).not.toMatch(/녹음|1분/u);
    expect(ko['stage:stage6']?.oneLiner).not.toMatch(/전화/u);
    expect(ko['stage:stage5']?.oneLiner).not.toMatch(/옛이야기/u);
  });
});
