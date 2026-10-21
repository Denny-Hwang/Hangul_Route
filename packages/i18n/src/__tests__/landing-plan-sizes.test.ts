import { FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS, SCHOOL_LICENSE_TEACHERS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { getMessages } from '../resolve';
import { lookup } from '../tree';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS sections 4 and 9.5 (row SA-6): the site says how many learners each plan holds, with
 * no price and no term (F-SITE-002 OD-7), and the Terms say it as English-authoritative legal text (F-I18N-001 L10).
 * Every number comes from content-schema: `landing.plans.sizes` takes them as arguments and the Terms paragraph is
 * built from the constants, so no locale types a limit into its copy.
 */
describe('landing.plans.sizes(family, group)', () => {
  it('reads the limits from content-schema in every locale', () => {
    expect(en.landing.plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS)).toBe(
      'The Family Plan is for up to 4 learners. The Group License is for up to 50 students in a class or a school.',
    );
    expect(getMessages('es').landing.plans.sizes(4, 50)).toBe(
      'El Plan Familiar es para hasta 4 estudiantes. La Licencia de Grupo es para hasta 50 estudiantes en una clase o una escuela.',
    );
    expect(getMessages('ko').landing.plans.sizes(4, 50)).toBe(
      '가족 플랜은 학습자 최대 4명이 함께 써요. 그룹 라이선스는 반이나 학교 하나에서 학생 최대 50명이 함께 써요.',
    );
  });

  it('says one learner or one student in the singular', () => {
    expect(en.landing.plans.sizes(1, 1)).toBe('The Family Plan is for up to 1 learner. The Group License is for up to 1 student in a class or a school.');
    expect(getMessages('es').landing.plans.sizes(1, 1)).toBe(
      'El Plan Familiar es para hasta 1 estudiante. La Licencia de Grupo es para hasta 1 estudiante en una clase o una escuela.',
    );
  });

  it('types no number of its own, and names no price, no term and no store word, in every locale', () => {
    for (const locale of LOCALES) {
      const out = getMessages(locale).landing.plans.sizes(73, 19);
      expect(out, locale).toContain('73');
      expect(out, locale).toContain('19');
      expect(out.split('73').join('').split('19').join(''), `${locale}: ${out}`).not.toMatch(/\d/);
      expect(out, locale).not.toMatch(
        /[$€£₩]|\b(USD|dollars?|d[oó]lares)\b|\b(per|a|each|every)\s+(year|month)\b|yearly|monthly|annual|lifetime|subscription|al año|anual|mensual|suscripci[oó]n|연간|매년|매달|월간|구독|평생/i,
      );
    }
  });

  it('es and ko overlays define their own sizes line', () => {
    expect(lookup(es, 'landing.plans.sizes')).toBeTypeOf('function');
    expect(lookup(ko, 'landing.plans.sizes')).toBeTypeOf('function');
  });
});

describe('Terms: what each plan holds (landing.legal.terms.sections.billing.paragraphs.sizes)', () => {
  const sizes = en.landing.legal.terms.sections.billing.paragraphs.sizes;

  it('is the section 4 paragraph, word for word, with the numbers from the constants', () => {
    expect(sizes).toBe(
      'The Family Plan covers one family with up to 4 learners. The Group License covers one class or one school with up to 50 students; a school also holds up to 10 teachers. A School Contract can cover more. When a family, class or school already has the most learners its plan holds, new learners cannot join until a place opens; nobody already in it is removed because of the limit.',
    );
    expect(sizes).toContain(`up to ${FAMILY_LIFETIME_LEARNERS} learners`);
    expect(sizes).toContain(`up to ${GROUP_LICENSE_LEARNERS} students`);
    expect(sizes).toContain(`up to ${SCHOOL_LICENSE_TEACHERS} teachers`);
  });

  it('names the plans as the billing page does', () => {
    const planTitle = en.console.billing.planTitle;
    expect(sizes).toContain(`The ${planTitle.family_lifetime} covers`);
    expect(sizes).toContain(`The ${planTitle.group_license} covers`);
  });

  it('is English-authoritative: es and ko show the English (L10), and no overlay translates it', () => {
    for (const locale of ['es', 'ko'] as const) expect(getMessages(locale).landing.legal.terms.sections.billing.paragraphs.sizes, locale).toBe(sizes);
    expect(lookup(es, 'landing.legal.terms.sections.billing.paragraphs.sizes')).toBeUndefined();
    expect(lookup(ko, 'landing.legal.terms.sections.billing.paragraphs.sizes')).toBeUndefined();
  });
});
