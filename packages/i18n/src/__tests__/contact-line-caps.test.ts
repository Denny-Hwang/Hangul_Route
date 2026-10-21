import { SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { getMessages } from '../resolve';
import { lookup } from '../tree';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 9.2 (row SA-1): `console.contactLineCaps(students, teachers)` replaces
 * `console.contactLine`, which typed "300" and "10" into its English, so the billing page never shows the old 300
 * next to the new 50. Every digit comes from an argument, in every locale.
 */
describe('console.contactLineCaps', () => {
  it('reads the limits from content-schema in every locale', () => {
    expect(en.console.contactLineCaps(SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS)).toBe('More than 50 students or 10 teachers? Write to us for a contract.');
    expect(getMessages('es').console.contactLineCaps(50, 10)).toBe('¿Más de 50 estudiantes o 10 docentes? Escríbenos para un contrato.');
    expect(getMessages('ko').console.contactLineCaps(50, 10)).toBe('학생 50명 또는 선생님 10명이 넘으면 계약 문의를 보내 주십시오.');
    expect(en.console.contactLineCaps(1, 1)).toBe('More than 1 student or 1 teacher? Write to us for a contract.');
    expect(getMessages('es').console.contactLineCaps(1, 1)).toBe('¿Más de 1 estudiante o 1 docente? Escríbenos para un contrato.');
  });

  it('types no number of its own', () => {
    for (const locale of LOCALES) {
      const out = getMessages(locale).console.contactLineCaps(73, 19);
      expect(out.split('73').join('').split('19').join(''), `${locale}: ${out}`).not.toMatch(/\d/);
    }
  });

  it('the old key is gone from every locale and overlay', () => {
    for (const locale of LOCALES) expect(lookup(getMessages(locale), 'console.contactLine'), locale).toBeUndefined();
    for (const [name, overlay] of Object.entries({ es, ko })) expect(lookup(overlay, 'console.contactLine'), name).toBeUndefined();
    expect(lookup(es, 'console.contactLineCaps')).toBeTypeOf('function');
    expect(lookup(ko, 'console.contactLineCaps')).toBeTypeOf('function');
  });
});
