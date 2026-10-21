import { FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, GROUP_LICENSE_LEARNERS, SCHOOL_LEARNER_CAP, SPACE_NAME_MAX } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS row SA-3, strings of sections 9.2 (less `contactLineCaps`, row SA-1) and 9.3: the seat
 * lines, the plan copy and the inline rename, in en, es and ko. A limit is never typed into a string (the caps come
 * from content-schema), and a limit never reads as a failure (section 3.4: no "error", "failed", "limit exceeded",
 * "over capacity" or "you must").
 */
const SA3_PATHS = [
  'console.seats.family.at',
  'console.seats.family.over',
  'console.seats.class.at',
  'console.seats.class.over',
  'console.seats.school.at',
  'console.seats.school.over',
  'console.schoolNoLicenceCaps',
  'console.billing.includesLines.license.classLearners',
  'console.billing.readOnly.schoolAdmin',
  'console.rename.cta',
  'console.rename.a11y',
  'console.rename.label',
  'console.rename.save.cta',
  'console.rename.cancel.cta',
  'console.rename.hint.family',
  'console.rename.hint.class',
  'console.rename.hint.school',
  'console.rename.empty',
  'console.rename.tooLong',
  'console.rename.invalid',
  'console.rename.saved',
  'console.rename.failed',
  'console.rename.openMoves',
  'console.rename.archived',
  'console.start.nameLater',
] as const;

type Fn = (...args: unknown[]) => string;
const call = (locale: (typeof LOCALES)[number], path: string, ...args: unknown[]): string => {
  const value = lookup(getMessages(locale), path);
  return typeof value === 'function' ? (value as Fn)(...args) : (value as string);
};

describe('seat lines (section 9.2)', () => {
  it('en reads the section 3.7 examples with the caps from content-schema', () => {
    const s = en.console.seats;
    expect(s.family.at(FAMILY_LIFETIME_LEARNERS)).toBe('This family has 4 learners, the most it can hold. To add someone new, remove a learner in Settings first. Their progress stays on their device.');
    expect(s.family.over(5, FAMILY_LIFETIME_LEARNERS)).toBe('This family has 5 learners. Everyone keeps their place. New learners can join when there are fewer than 4.');
    expect(s.class.at(GROUP_LICENSE_LEARNERS)).toBe('This class has 50 students, the most the Group License holds. New students can join when a place opens.');
    expect(s.class.over(70, GROUP_LICENSE_LEARNERS)).toBe('This class has 70 students. Everyone keeps their place. New students can join when there are fewer than 50.');
    expect(s.school.at(SCHOOL_LEARNER_CAP)).toBe('This school has 50 students, the most it holds without a contract. New students can join when a place opens.');
    expect(s.school.over(62, SCHOOL_LEARNER_CAP)).toBe(
      'This school has 62 students. Everyone keeps their place and everything they learned. New students can join when there are fewer than 50, or write to us for a contract.',
    );
    expect(s.family.at(1)).toBe('This family has 1 learner, the most it can hold. To add someone new, remove a learner in Settings first. Their progress stays on their device.');
    expect(en.console.schoolNoLicenceCaps(FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP)).toBe('No licence yet. Each class holds up to 20 students, and the school up to 50.');
  });

  it('es and ko read the section 9.2 rows', () => {
    const e = getMessages('es').console;
    expect(e.seats.family.at(4)).toBe('Esta familia tiene 4 estudiantes, el máximo posible. Para sumar a alguien, primero quita a un estudiante en Ajustes. Su progreso se queda en su dispositivo.');
    expect(e.seats.family.over(5, 4)).toBe('Esta familia tiene 5 estudiantes. Nadie pierde su lugar. Pueden unirse estudiantes nuevos cuando haya menos de 4.');
    expect(e.seats.class.at(50)).toBe('Esta clase tiene 50 estudiantes, el máximo de la Licencia de Grupo. Pueden unirse estudiantes nuevos cuando se libere un lugar.');
    expect(e.seats.class.over(62, 50)).toBe('Esta clase tiene 62 estudiantes. Nadie pierde su lugar. Pueden unirse estudiantes nuevos cuando haya menos de 50.');
    expect(e.seats.school.at(50)).toBe('Esta escuela tiene 50 estudiantes, el máximo sin contrato. Pueden unirse estudiantes nuevos cuando se libere un lugar.');
    expect(e.seats.school.over(62, 50)).toBe('Esta escuela tiene 62 estudiantes. Nadie pierde su lugar ni lo que aprendió. Pueden unirse estudiantes nuevos cuando haya menos de 50, o escríbenos para un contrato.');
    expect(e.billing.includesLines.license.classLearners(50)).toBe('Hasta 50 estudiantes en la clase');
    expect(e.billing.readOnly.schoolAdmin).toBe('Quien creó la escuela gestiona este plan.');
    const k = getMessages('ko').console;
    expect(k.seats.family.at(4)).toBe('이 가족에는 학습자가 4명 있어서 더 들어올 수 없어요. 새로 추가하려면 먼저 설정에서 학습자 한 명을 빼 주세요. 그 학습자의 진도는 기기에 그대로 남아요.');
    expect(k.seats.family.over(5, 4)).toBe('이 가족에는 학습자가 5명 있어요. 모두 그대로 함께해요. 학습자가 4명보다 적어지면 새 학습자가 들어올 수 있어요.');
    expect(k.seats.class.at(50)).toBe('이 반에는 학생이 50명 있어요. 그룹 라이선스로 함께할 수 있는 최대 인원이에요. 자리가 나면 새 학생이 들어올 수 있어요.');
    expect(k.seats.school.over(62, 50)).toBe('이 학교에는 학생이 62명 있어요. 모두 자리와 배운 내용을 그대로 지켜요. 학생이 50명보다 적어지면 새 학생이 들어올 수 있어요. 더 필요하면 계약을 문의해 주세요.');
    expect(k.billing.includesLines.license.classLearners(50)).toBe('반 하나에 학생 최대 50명');
    expect(k.billing.readOnly.schoolAdmin).toBe('학교를 만든 분이 이 플랜을 관리해요.');
  });

  it('no locale types a limit of its own', () => {
    const numbered = ['console.seats.family.at', 'console.seats.class.at', 'console.seats.school.at', 'console.billing.includesLines.license.classLearners'];
    for (const locale of LOCALES) {
      for (const path of numbered) expect(call(locale, path, 73).split('73').join(''), `${locale}:${path}`).not.toMatch(/\d/);
      for (const path of ['console.seats.family.over', 'console.seats.class.over', 'console.seats.school.over', 'console.schoolNoLicenceCaps']) {
        expect(call(locale, path, 91, 73).split('91').join('').split('73').join(''), `${locale}:${path}`).not.toMatch(/\d/);
      }
    }
  });

  it('a limit never reads as a failure (section 3.4)', () => {
    const banned = /\berror\b|\bfail(ed|ure)?\b|limit exceeded|over capacity|\byou must\b/i;
    for (const path of SA3_PATHS.filter((p) => p.startsWith('console.seats') || p === 'console.schoolNoLicenceCaps')) {
      expect(call('en', path, 62, 50), path).not.toMatch(banned);
    }
  });
});

describe('inline rename (section 9.3)', () => {
  it('en reads the section 9.3 rows', () => {
    const r = en.console.rename;
    expect([r.cta, r.a11y('Sunday Class A'), r.label, r.save.cta, r.cancel.cta]).toEqual(['Rename', 'Rename Sunday Class A', 'Name', 'Save', 'Cancel']);
    expect(r.hint).toEqual({ family: 'Everyone in the family sees this name.', class: 'Students see this name in the app.', school: 'Teachers and administrators see this name.' });
    expect(r.empty).toBe('Type a name.');
    expect(r.tooLong(SPACE_NAME_MAX)).toBe('Names can be up to 40 characters.');
    expect(r.invalid).toBe('Use letters or numbers in the name.');
    expect(r.saved).toBe('Name saved.');
    expect(r.failed).toBe("Couldn't save the name. Try again.");
    expect(r.openMoves).toBe('Some moves into or out of this space are waiting. A new name asks their grown-ups to look at the move again.');
    expect(r.archived).toBe('Unarchive it first to change the name.');
    expect(en.console.start.nameLater).toBe('You can change this name later.');
  });

  it('the accessible name starts with the visible word (WCAG 2.5.3) in every locale', () => {
    for (const locale of LOCALES) {
      const r = getMessages(locale).console.rename;
      expect(r.a11y('Kim').startsWith(r.cta), locale).toBe(true);
      expect(r.a11y('Kim'), locale).toContain('Kim');
    }
  });

  it('es and ko read the section 9.3 rows', () => {
    const e = getMessages('es').console;
    expect([e.rename.cta, e.rename.a11y('Clase A'), e.rename.label, e.rename.save.cta, e.rename.cancel.cta]).toEqual(['Renombrar', 'Renombrar Clase A', 'Nombre', 'Guardar', 'Cancelar']);
    expect(e.rename.tooLong(40)).toBe('Los nombres pueden tener hasta 40 caracteres.');
    expect(e.start.nameLater).toBe('Puedes cambiar este nombre después.');
    const k = getMessages('ko').console;
    expect([k.rename.cta, k.rename.a11y('일요일 반'), k.rename.label, k.rename.save.cta, k.rename.cancel.cta]).toEqual(['이름 바꾸기', '이름 바꾸기: 일요일 반', '이름', '저장', '취소']);
    expect(k.rename.tooLong(40)).toBe('이름은 40자까지 쓸 수 있어요.');
    expect(k.rename.failed).toBe('이름을 저장하지 못했어요. 다시 해 볼까요?');
    expect(k.start.nameLater).toBe('이 이름은 나중에 바꿀 수 있어요.');
  });
});

describe('es and ko overlays carry every SA-3 key', () => {
  for (const [locale, overlay] of Object.entries({ es, ko })) {
    it(`${locale}: every key, with the English kind and arity`, () => {
      for (const path of SA3_PATHS) {
        const own = lookup(overlay, path);
        const source = lookup(en, path);
        expect(own, `${locale}:${path}`).toBeDefined();
        expect(typeof own, `${locale}:${path}`).toBe(typeof source);
        if (typeof own === 'function' && typeof source === 'function') expect(own.length, `${locale}:${path}`).toBe(source.length);
      }
    });
  }

  it('the replaced keys are gone from every locale', () => {
    for (const locale of LOCALES) {
      const paths = new Set(leafPaths(getMessages(locale)));
      expect(paths.has('console.schoolNoLicence'), locale).toBe(false);
      expect(paths.has('console.billing.includesLines.license.noCap'), locale).toBe(false);
    }
  });
});
