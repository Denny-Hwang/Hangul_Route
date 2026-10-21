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
 * ratchet: a new string may not join it, a listed string may not break a further rule, and a
 * string that is fixed must leave it. The open item that clears it is the "After OD-12" note under
 * the owner decisions table of F-CURR-002 section 16.
 */

const PERCENT_OR_FRACTION = /%|\b\d+\s*(of|\/)\s*\d+\b/i;
const AGE_WORDING =
  /\b(ages?\s+\d+|\d+\s*(-|–|to)\s*\d+\s*(years?|yrs?)|\d+\s*(years?|yrs?)\s*(old|\+)|kids?|child(ren)?|toddlers?|little ones?)\b/i;
const SPEAKING_WORDS =
  /\b(record(s|ed|ing)?|speak(s|ing)?|spoke|say(s|ing)?|said|call(s|ed|ing)?|pronounc(e|es|ed|ing))\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

const RULES: Array<[string, RegExp]> = [
  ['percent or fraction', PERCENT_OR_FRACTION],
  ['age wording', AGE_WORDING],
  ['speaking word', SPEAKING_WORDS],
];

/** `<stage key>.<field>` -> every rule it still breaks. Shrinks only. */
const KNOWN_EXCEPTIONS: Record<string, string[]> = {
  'stage1.anchorSkillEn': ['percent or fraction'],
  'stage2.anchorSkillEn': ['speaking word'],
  'stage5.anchorSkillEn': ['percent or fraction'],
  'stage7.oneLinerEn': ['speaking word'],
};

/**
 * The same ratchet for the es and ko overlays, for the rules that do not depend on language:
 * `%`, "n/m" and emoji. `<locale>.stage:<key>.<field>` -> every rule it still breaks.
 */
const KNOWN_OVERLAY_EXCEPTIONS: Record<string, string[]> = {
  'es.stage:stage1.anchorSkill': ['percent or fraction'],
  'es.stage:stage5.anchorSkill': ['percent or fraction'],
  'ko.stage:stage1.anchorSkill': ['percent or fraction'],
  'ko.stage:stage5.anchorSkill': ['percent or fraction'],
};

const fields = stages.flatMap((s) => [
  [`${s.key}.oneLinerEn`, s.oneLinerEn] as const,
  [`${s.key}.anchorSkillEn`, s.anchorSkillEn] as const,
]);

const violations = (
  entries: ReadonlyArray<readonly [string, string]>,
  rules: ReadonlyArray<[string, RegExp]>,
): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [where, text] of entries) {
    for (const [rule, re] of rules) {
      if (re.test(text)) out[where] = [...(out[where] ?? []), rule];
    }
  }
  return out;
};

const overlayFields = (['es', 'ko'] as const).flatMap((locale) =>
  stages.flatMap((s) => {
    const entry = OVERLAYS[locale][`stage:${s.key}`];
    return [
      [`${locale}.stage:${s.key}.oneLiner`, entry?.oneLiner ?? ''] as const,
      [`${locale}.stage:${s.key}.anchorSkill`, entry?.anchorSkill ?? ''] as const,
    ];
  }),
);

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
    expect(SPEAKING_WORDS.test('Read and pronounce 60 core words')).toBe(true);
    expect(SPEAKING_WORDS.test('Recognize every letter')).toBe(false);
    expect(SPEAKING_WORDS.test('Read and answer short everyday exchanges.')).toBe(false);
  });

  it('no stage one-liner or anchor skill breaks the review-copy patterns, beyond the known exceptions', () => {
    expect(violations(fields, RULES)).toEqual(KNOWN_EXCEPTIONS);
  });

  it('the ratchet records every rule a field breaks, not only the last one', () => {
    expect(violations([['x', 'Say it at 90%']], RULES)).toEqual({ x: ['percent or fraction', 'speaking word'] });
  });

  it('no stage copy carries emoji', () => {
    for (const [where, text] of fields) {
      expect(EMOJI.test(text), where).toBe(false);
    }
  });

  it('no es or ko stage overlay carries a percent, a fraction or emoji, beyond the known exceptions', () => {
    expect(
      violations(overlayFields, [
        ['percent or fraction', PERCENT_OR_FRACTION],
        ['emoji', EMOJI],
      ]),
    ).toEqual(KNOWN_OVERLAY_EXCEPTIONS);
  });

  it('carries the reviewed es and ko values of the OD-12 strings', () => {
    const es = OVERLAYS.es;
    const ko = OVERLAYS.ko;
    expect(es['stage:stage4']?.oneLiner).toBe('Lee y responde diálogos cortos de todos los días.');
    expect(es['stage:stage5']?.oneLiner).toBe('Lee historias del patrimonio y cuentos con Hoya.');
    expect(es['stage:stage6']?.oneLiner).toBe('Lleva el coreano al mundo: menús, letreros y mensajes cortos.');
    expect(es['stage:stage7']?.anchorSkill).toBe('Escribe una presentación personal corta');
    expect(ko['stage:stage4']?.oneLiner).toBe('짧은 일상 대화를 읽고 답해요.');
    expect(ko['stage:stage5']?.oneLiner).toBe('호야와 함께 문화 이야기와 짧은 이야기를 읽어요.');
    expect(ko['stage:stage6']?.oneLiner).toBe('메뉴, 표지판, 짧은 메시지까지, 한국어를 밖에서 써 봐요.');
    expect(ko['stage:stage7']?.anchorSkill).toBe('짧은 자기소개 쓰기');
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
    // Korean: noeum ("recording"), jeonhwa ("phone call"), yetiyagi ("folk tale"), and the
    // 1-minute (1bun) length of the old Stage 7 skill.
    expect(ko['stage:stage7']?.anchorSkill).not.toMatch(/녹음|1분/u);
    expect(ko['stage:stage6']?.oneLiner).not.toMatch(/전화/u);
    expect(ko['stage:stage5']?.oneLiner).not.toMatch(/옛이야기/u);
  });
});
