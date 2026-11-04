import { describe, expect, it } from 'vitest';
import { findBannedWord, findWord } from '../banned';
import { getMessages } from '../resolve';
import { isPlainObject } from '../tree';
import { SAMPLES } from './samples';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 7, 8, 13 and 19 (row BL-7): the learner's class days and practice days words,
 * `learner.route.blend.*` and `a11y.route.blend.*`, in en, es and ko. Neutral facts only: every value passes the
 * caregiver list (`isCaregiverSafe`, which holds the learner list too) and the section 13 anti-shame words, has no
 * emoji and no number above 3. es and ko use the glossary of section 19 (clase / práctica; 수업 / 반 / 연습).
 */

const LOCALES = ['en', 'es', 'ko'] as const;

/** Section 13 and the BL-D `words` check: words a learner screen never shows here, per locale. */
const ANTI_SHAME: Record<(typeof LOCALES)[number], readonly string[]> = {
  en: ['late', 'behind', 'lecture', 'missed', 'overdue', 'attend', 'attendance', 'stopped', 'cancelled', 'paused by', 'homework', 'to do', 'catch up'],
  es: ['tarde', 'atrasado', 'atrasada', 'conferencia', 'perdiste', 'faltaste', 'asistencia', 'cancelado', 'detenido', 'tarea', 'pendiente'],
  ko: ['늦', '밀린', '강의', '놓친', '빠진', '출석', '취소', '중단', '숙제', '못 했'],
};

type Rendered = { path: string; text: string };

function render(node: unknown, path: string, out: Rendered[] = []): Rendered[] {
  if (typeof node === 'string') out.push({ path, text: node });
  else if (typeof node === 'function') {
    const samples = SAMPLES[path];
    expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
    for (const args of samples ?? []) out.push({ path, text: (node as (...a: unknown[]) => string)(...args) });
  } else if (isPlainObject(node)) for (const [key, value] of Object.entries(node)) render(value, `${path}.${key}`, out);
  return out;
}

const outputsOf = (locale: (typeof LOCALES)[number]): Rendered[] => {
  const m = getMessages(locale);
  return [...render(m.learner.route.blend, 'learner.route.blend'), ...render(m.a11y.route.blend, 'a11y.route.blend')];
};

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe('learner.route.blend and a11y.route.blend (BL-7)', () => {
  it('English is the section 19 text (American spelling, as packages/i18n en)', () => {
    const b = getMessages('en').learner.route.blend;
    expect(b.planLine('Tuesday', b.practiceOn('Wednesday, Friday, and Sunday'))).toBe("Your class's weekly plan: class on Tuesday, practice on Wednesday, Friday, and Sunday.");
    expect(b.practiceMost).toBe('practice on most days');
    expect(b.practiceAllBut('Monday')).toBe('practice every day except Monday');
    expect(b.practiceEvery).toBe('practice every day');
    expect(b.refresh).toBe('Refresh');
    expect(b.refreshLine).toBe('Look back at what class taught.');
    expect(b.classToday).toBe('Class today.');
    expect(b.ownResting).toBe("Your own weekly plan is resting while your class's plan has practice days.");
    expect(b.ownBack).toBe('Your own weekly plan is back.');
    expect(b.proposalInstead).toBe("Your class's weekly plan has practice days for you.");
    const a = getMessages('en').a11y.route.blend;
    expect(a.fromClassMet).toBe('From class. You met this in class.');
    expect(a.practiceDay('Tuesday')).toBe('Practice day, Tuesday');
    expect(a.refresh).toBe('Refresh: look back at what class taught');
  });

  it('the visible pill keeps the existing from.teacher words; the a11y name starts with them', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale);
      expect(m.a11y.route.blend.fromClassMet.startsWith(m.learner.homework.from.teacher), locale).toBe(true);
    }
  });

  it("each locale's day list matches Intl.ListFormat in en and es, and joins with a middle dot in ko", () => {
    const names = { en: ['Wednesday', 'Friday', 'Sunday'], es: ['miércoles', 'viernes', 'domingo'], ko: ['수요일', '금요일', '일요일'] };
    for (const locale of ['en', 'es'] as const) {
      const list = getMessages(locale).learner.route.blend.dayList;
      const intl = new Intl.ListFormat(locale === 'en' ? 'en-US' : 'es-ES', { type: 'conjunction' });
      for (const n of [1, 2, 3]) expect(list(names[locale].slice(0, n)), `${locale} ${n}`).toBe(intl.format(names[locale].slice(0, n)));
    }
    expect(getMessages('ko').learner.route.blend.dayList(names.ko)).toBe('수요일·금요일·일요일');
  });

  it('es: a weekly habit takes the plural article and plural names', () => {
    const b = getMessages('es').learner.route.blend;
    expect(b.planLine('martes', b.practiceOn('miércoles, viernes y domingo'))).toBe('Plan semanal de tu clase: clase los martes, práctica los miércoles, viernes y domingos.');
    expect(b.planLine('sábado', b.practiceAllBut('lunes'))).toBe('Plan semanal de tu clase: clase los sábados, práctica todos los días menos los lunes.');
    expect(b.practiceAllBut('domingo')).toBe('práctica todos los días menos los domingos');
  });

  it('ko: the glossary words (반 for the group, 수업 for class, 연습 for practice)', () => {
    const b = getMessages('ko').learner.route.blend;
    expect(b.planLine('화요일', b.practiceOn('수요일·금요일·일요일'))).toBe('반의 주간 계획: 화요일 수업, 수요일·금요일·일요일 연습.');
    expect(b.practiceEvery).toBe('매일 연습');
  });

  it('es and ko have their own value for every key', () => {
    const en = outputsOf('en');
    for (const locale of ['es', 'ko'] as const) {
      const out = outputsOf(locale);
      expect(out.length).toBe(en.length);
      // A one-name day list is the name itself in every locale; its two- and three-name rows still differ.
      out.forEach((o, i) => (o.path.endsWith('.dayList') && !/[,·]| y | and /.test(en[i]?.text ?? '') ? undefined : expect(o.text, `${locale} ${o.path}`).not.toBe(en[i]?.text)));
    }
  });

  it.each(LOCALES)('%s: caregiver-safe, anti-shame, no emoji, no number above 3', (locale) => {
    for (const { path, text } of outputsOf(locale)) {
      expect(findBannedWord(text, locale, 'caregiver'), `${path}: ${text}`).toBeNull();
      expect(findWord(text, ANTI_SHAME[locale], locale), `${path}: ${text}`).toBeNull();
      expect(EMOJI.test(text), `${path}: ${text}`).toBe(false);
      for (const n of text.match(/\d+/g) ?? []) expect(Number(n), `${path}: ${text}`).toBeLessThanOrEqual(3);
    }
  });
});
