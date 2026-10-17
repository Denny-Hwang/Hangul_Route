import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-TCH-004 PR 9 (sections 3.5, 3.7, 3.8, 3.10; design/screens/presenter/overlays.md,
 * slide-quiz.md and the README "Strings" table): the class tools, the quiz and the voice
 * fallbacks. Every locale has its own value (the SI unit strings aside), nothing trips the
 * learner or caregiver ban lists or frames the page for one age, no projected line judges an
 * answer ("wrong", "fail", "miss", "incorrect"), and no Hangul sits in an English or Spanish
 * message (F-I18N-001 section 3.4 rule 5).
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const JUDGING = /\b(wrong|fail\w*|miss\w*|incorrect|score\w*|rank\w*|points?)\b/i;
/** "+30 s", "{n} min", "{n} s": unit symbols, the same in Spanish. */
const SHARED_ES = new Set(['timer.add.cta', 'timer.minutes', 'timer.seconds']);

function rendered(locale: UiLocale, root: 'learner.presenter' | 'a11y.presenter', path: string): string[] {
  const m = getMessages(locale);
  const tree = root === 'learner.presenter' ? m.learner.presenter : m.a11y.presenter;
  const value = lookup(tree, path);
  if (typeof value === 'string') return [value];
  const rows = SAMPLES[`${root}.${path}`];
  expect(rows, `function message ${root}.${path} needs a row in SAMPLES`).toBeDefined();
  return (rows ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
}

const en = getMessages('en');
const OWN = ['blank.', 'pause.', 'timer.', 'help.', 'grid.title', 'grid.hint', 'grid.now', 'grid.hidden', 'grid.hide.', 'grid.show.'];
const OWN_EXACT = ['bar.noVoice', 'bar.offline', 'bar.update', 'quiz.answer', 'quiz.sound', 'quiz.oddOneOut', 'slide.sayIt'];
const learnerPaths = leafPaths(en.learner.presenter).filter((p) => OWN_EXACT.includes(p) || OWN.some((prefix) => p.startsWith(prefix)));
const a11yPaths = ['answerMark', 'timerLeft'];

describe('learner.presenter class tools (F-TCH-004 PR 9)', () => {
  it('has the README keys with their English values', () => {
    const p = en.learner.presenter;
    expect(learnerPaths).toHaveLength(52);
    expect(p.quiz.sound).toBe('Which letter makes this sound?');
    expect(p.quiz.answer).toBe("Hoya's answer");
    expect(p.timer.done).toBe('All done!');
    expect(p.timer.minutes(3)).toBe('3 min');
    expect(p.timer.seconds(30)).toBe('30 s');
    expect(p.blank.line).toBe('Eyes on me');
    expect(p.blank.pause.cta).toBe('Pause');
    expect(p.pause.gloss).toBe('wait a moment');
    expect(p.bar.noVoice).toBe('No Korean voice here. You say it!');
    expect(p.slide.sayIt).toBe('Say it:');
    expect(p.help.row.close).toBe('Close or exit');
    expect(en.a11y.presenter.answerMark).toBe("Hoya's answer");
    expect(en.a11y.presenter.timerLeft('2:45')).toBe('Time left: 2:45');
  });

  it('has the Spanish values of the README table', () => {
    const es = getMessages('es');
    expect(es.learner.presenter.quiz.sound).toBe('¿Qué letra hace este sonido?');
    expect(es.learner.presenter.blank.line).toBe('¡Miren aquí!');
    expect(es.learner.presenter.timer.reset.cta).toBe('Reiniciar');
    expect(es.a11y.presenter.timerLeft('2:45')).toBe('Tiempo que queda: 2:45');
  });

  it('has no helper picker keys in any locale (LV-H)', () => {
    for (const locale of LOCALES) {
      const p = getMessages(locale).learner.presenter as Record<string, unknown>;
      expect(p.picker, locale).toBeUndefined();
      expect((p.bar as Record<string, unknown>).picker, locale).toBeUndefined();
      expect((p.start as Record<string, unknown>).picker, locale).toBeUndefined();
      expect(((p.help as Record<string, unknown>).row as Record<string, unknown>).picker, locale).toBeUndefined();
      const lecture = getMessages(locale).console.lecture as Record<string, unknown>;
      expect(lecture.picker, locale).toBeUndefined();
      expect(lecture.copyNoNames, locale).toBeUndefined();
    }
  });

  it('gives every key its own es and ko value, never the English', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const path of learnerPaths) {
        if (locale === 'es' && SHARED_ES.has(path)) continue;
        expect(rendered(locale, 'learner.presenter', path), `${locale} learner.presenter.${path}`).not.toEqual(rendered('en', 'learner.presenter', path));
      }
      for (const path of a11yPaths) {
        expect(rendered(locale, 'a11y.presenter', path), `${locale} a11y.presenter.${path}`).not.toEqual(rendered('en', 'a11y.presenter', path));
      }
    }
  });

  it('passes the ban lists, the audience rule and the no-judging rule in every locale, with no Hangul in en or es', () => {
    for (const locale of LOCALES) {
      const texts = [...learnerPaths.flatMap((p) => rendered(locale, 'learner.presenter', p)), ...a11yPaths.flatMap((p) => rendered(locale, 'a11y.presenter', p))];
      for (const text of texts) {
        expect(findBannedWord(text, locale, 'learner'), `${locale}: ${text}`).toBeNull();
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(text), `${locale}: ${pattern.name}: ${text}`).toBe(false);
        if (locale === 'en') expect(text, text).not.toMatch(JUDGING);
        if (locale !== 'ko') expect(HANGUL.test(text), `${locale}: ${text}`).toBe(false);
        expect(text, text).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });
});
