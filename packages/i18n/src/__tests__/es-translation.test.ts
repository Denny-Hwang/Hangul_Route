import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { fallbackPaths, getMessages, isEnglishAuthoritative } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { LOCALE_STATUS } from '../locales';
import { esCoverageRequired, esReviewedNamespaces, esUnexpectedFallbacks } from './es-coverage';
import { SAMPLES } from './samples';

/**
 * F-I18N-001 PR 15 (Spanish): every UI key has a Spanish value, the review ledger records the review
 * of each namespace, and the literal rows the spec names read as written (§3.4, §3.10, §10). Coverage is a
 * ratchet (`./es-coverage`): a key English adds after the review may fall back until the next R8 draft while es
 * is hidden (§3.10 step 4); a namespace whose English is still the reviewed text may not.
 */
describe('Spanish dictionary (F-I18N-001 PR 15)', () => {
  const es = getMessages('es');

  it('has no English fallback in a namespace the review signed (every namespace, until English changes)', () => {
    expect(esUnexpectedFallbacks()).toEqual([]);
  });

  it('lets a key English adds after the review wait for the next draft while es is hidden, and never once shipped', () => {
    expect(esCoverageRequired('learner.home.newKey', ['learner'])).toBe(true);
    expect(esCoverageRequired('learner.home.newKey', ['console'])).toBe(LOCALE_STATUS.es === 'shipped');
    // Every reviewed namespace is a real one; a namespace drops out only when its English file changes.
    for (const namespace of esReviewedNamespaces()) expect(Object.keys(en)).toContain(namespace);
  });

  it('keeps the Privacy Policy and Terms English (decision L10)', () => {
    const legal = leafPaths(en).filter(isEnglishAuthoritative);
    expect(legal.length).toBeGreaterThan(10);
    for (const path of legal) expect(lookup(es, path)).toBe(lookup(en, path));
  });

  it('translates the legal notice around the English text', () => {
    expect(es.landing.legal.draft).not.toBe(en.landing.legal.draft);
  });

  it('differs from English wherever English is not a shared word (brand names, codes, symbols)', () => {
    // Values that read the same in both languages; each is a name, a symbol or a word Spanish borrows.
    const SAME_IN_BOTH = new Set(
      leafPaths(en).filter((path) => {
        const value = lookup(en, path);
        return typeof value === 'string' && /^(?:[A-Z0-9 .:·,+/&()–-]*|Hangul Route|Hoya|PIN|OK|Stripe|Email|Plan|Hangul)$/.test(value);
      }),
    );
    // A key that falls back (English added after the review, es hidden) is the ratchet's business, not this list's.
    const fallback = new Set(fallbackPaths('es'));
    const untouched = leafPaths(en).filter((path) => {
      if (isEnglishAuthoritative(path) || SAME_IN_BOTH.has(path) || fallback.has(path)) return false;
      const own = lookup(es, path);
      const source = lookup(en, path);
      if (typeof own === 'string') return own === source;
      if (typeof own === 'function' && typeof source === 'function') {
        const rows = SAMPLES[path] ?? [];
        return rows.length > 0 && rows.every((args) => (own as (...a: unknown[]) => string)(...args) === (source as (...a: unknown[]) => string)(...args));
      }
      return false;
    });
    const current = new Set(leafPaths(en));
    expect([...untouched].sort()).toEqual(LITERALLY_SHARED.filter((path) => current.has(path)).sort());
  });

  it('reads the spec examples (§3.1, §3.4)', () => {
    expect(es.learner.home.streak.pill(1)).toBe('Racha de 1 día');
    expect(es.learner.home.streak.pill(5)).toBe('Racha de 5 días');
  });

  it('agrees with a count of 1 and of 2 in the sentences the language review fixed', () => {
    expect(es.learner.firstQuest.summary(1, 1, 1)).toBe('1 misión · cerca de 1 minuto · 1 tarjeta te espera');
    expect(es.learner.firstQuest.summary(2, 2, 2)).toBe('2 misiones · cerca de 2 minutos · 2 tarjetas te esperan');
    expect(es.learner.storyShelf.minutes.pill(1)).toBe('cerca de 1 min');
    expect(es.caregiver.restore.notice.added('Suni', 1, 0)).toBe('¡Encontramos el progreso de Suni! Añadimos 1 tarjeta.');
    expect(es.caregiver.restore.notice.added('Suni', 2, 1)).toBe('¡Encontramos el progreso de Suni! Añadimos 2 tarjetas y 1 misión.');
    expect(es.console.plan.readout.withNotReady(0, 2, 1)).toBe('0 / 2 · 1 aún no está listo');
    expect(es.console.plan.readout.withNotReady(0, 3, 2)).toBe('0 / 3 · 2 aún no están listos');
    expect(es.console.curriculum.readout.lineNotReady(4, 6, 36, 1)).toBe('4 / 6 hasta ahora · 36 planeados · 1 aún no está listo');
    expect(es.console.curriculum.rhythm.sessionsNote(1, 1)).toBe('En total: 1 sesión en 1 semana.');
    expect(es.console.curriculum.rhythm.sessionsNote(2, 3)).toBe('En total: 2 sesiones en 3 semanas.');
    expect(es.console.lecture.outline.about(1)).toBe('cerca de 1 min');
    expect(es.caregiver.plan.freePlan.line(1, 1, 1)).toBe('La Etapa 1 es gratis: 1 lección, 1 letra, cerca de 1 minuto. Todo lo terminado se queda.');
    expect(es.caregiver.plan.freePlan.line(15, 24, 65)).toBe('La Etapa 1 es gratis: 15 lecciones, 24 letras, cerca de 65 minutos. Todo lo terminado se queda.');
  });

  it('agrees with a count of 1 and of 2 in the counts the PR 15 review found (plural, never "1 conseguidas")', () => {
    for (const collected of [es.learner.vocab.library.collected, es.learner.vocab.topics.collected, es.learner.vocab.topic.collected]) {
      expect(collected(1)).toBe('1 conseguida');
      expect(collected(2)).toBe('2 conseguidas');
    }
    const cell = (finished: number) =>
      es.a11y.journeyCell({ stage: 1, stageTitle: 'Hangul', themeTitle: 'Letras y libros', kind: 'stories-only', complete: false, stories: 2, finished, start: false, placedOut: false });
    expect(es.caregiver.dashboard.words.counts(1, 1)).toBe('1 conseguida, 1 firme');
    expect(es.caregiver.dashboard.words.counts(2, 2)).toBe('2 conseguidas, 2 firmes');
    expect(es.caregiver.dashboard.words.together).toBe('Para ver en familia');
    expect(es.caregiver.browse.facts.level.readAlong).toBe('Leer escuchando');
    expect(cell(1)).toBe('Etapa 1 Hangul, Letras y libros: 2 historias del patrimonio, 1 terminada');
    expect(cell(2)).toBe('Etapa 1 Hangul, Letras y libros: 2 historias del patrimonio, 2 terminadas');
    expect(es.landing.cards.body(1, 1, 1, 1, 1)).toContain('La Etapa 1 trae 1 tarjeta: 1 común, 1 poco común, 1 rara y 1 legendaria.');
    expect(es.landing.cards.body(24, 12, 6, 4, 2)).toContain('La Etapa 1 trae 24 tarjetas: 12 comunes, 6 poco comunes, 4 raras y 2 legendarias.');
    expect(es.report.class.headline(1, 1, 'esta semana')).toBe('1 de 1 estudiante practicó esta semana.');
    expect(es.report.class.headline(2, 5, 'esta semana')).toBe('2 de 5 estudiantes practicaron esta semana.');
  });

  it('has a review-ledger entry for every namespace (§3.10 step 3)', () => {
    const entries = (ledger as Record<string, Record<string, { enSha: string; reviewedBy: string; reviewedAt: string }>>).es ?? {};
    expect(Object.keys(entries).sort()).toEqual(Object.keys(en).sort());
    for (const entry of Object.values(entries)) {
      expect(entry.enSha).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.reviewedBy).toMatch(/^[A-Z]{2,4}$/);
      expect(entry.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

/**
 * Paths whose Spanish text is, on purpose, identical to the English: a proper name, a code word or a word
 * Spanish uses as is. Listed so a new untranslated key cannot hide among them.
 */
const LITERALLY_SHARED: readonly string[] = [
  // Format-only templates: arguments joined by punctuation, a colon, a middle dot or a slash.
  'a11y.homeworkRow',
  'a11y.access.row', // title, lines and tags joined by ". " (MAR re-review 2026-10-13)
  'a11y.planStatus',
  'a11y.myRoute.later',
  'a11y.myRoute.cell',
  'a11y.myRoute.skill',
  'a11y.myRoute.gain',
  'a11y.myRoute.homeStrip',
  'a11y.myRoute.letter',
  'a11y.myRoute.cellInPlan',
  'a11y.myRoute.labelled',
  'a11y.myRoute.routeCard',
  'a11y.minigame.keyboard.key', // "{letter}, {sound}" on a keyboard key (F-CURR-001 G-3)
  'a11y.minigame.writeFrame.tile', // "{block}, {sound}" on a name-round tile (F-CURR-001 G-5)
  'learner.journey.countMark',
  'learner.journey.cellStories.title',
  'learner.quest.progress',
  'learner.minigame.progress.pill',
  'learner.story.check.position.pill',
  'learner.story.reader.position.pill',
  'learner.storyShelf.episode.rowLabel',
  'learner.home.next.a11y',
  'learner.storyShelf.cultureNotes.source',
  'learner.storyShelf.heroLabel',
  'console.space.learner.planReadout',
  'console.space.wordGloss',
  'console.plan.titleFor',
  'console.plan.readout.progress',
  'console.curriculum.goals.themeChosen',
  'console.curriculum.preview.dateRange',
  'console.curriculum.preview.taggedItem',
  'console.curriculum.preview.itemLine',
  'console.curriculum.builder.planChip',
  'console.school.licence.line',
  'console.learningRoute.stageRow',
  'report.detail.strand',
  'report.class.count',
  'report.letter',
  'learner.weeklyPlan.proposal.pickDayLabel',
  'learner.weeklyPlan.proposal.weekRowLabel',
  'learner.weeklyPlan.setup.likes.themeChosen',
  // Words Spanish uses as they are: the minute abbreviation "min", "final", "Plan", "Extras", "Quiz", "admin", "App", "Android".
  'a11y.minigame.finalTile',
  'learner.storyShelf.episode.minutes.pill',
  'learner.weeklyPlan.proposal.minutes',
  'console.space.openPlan.label',
  'console.plan.catalog.questLine',
  'console.curriculum.rhythm.minutesOption',
  'console.curriculum.preview.table.extras',
  'console.lecture.catalogue.line',
  'console.lecture.outline.minutes',
  'console.lecture.outline.addQuiz.cta',
  'console.settings.grownUps.role.admin',
  'landing.footer.app',
  'landing.licenses.softwareTitle', // "Software", a word Spanish borrows (open-source notices, 2026-10-14)
  'landing.licenses.where.app', // "App", as landing.footer.app
  'learner.audio.voiceHelp.sections.android.title',
  'learner.vocab.speed.challenge.scale.normal', // "Normal", the Speed Round clock length (F-VOC-004 S-6)
  // Names, sample values and glyphs: the brand, sample ids and addresses, arrows and the close cross.
  'console.shell.backToSite',
  'console.signIn.accountId.placeholder',
  'console.signIn.email.placeholder',
  'console.plan.yours.moveUp.cta',
  'console.plan.yours.moveDown.cta',
  'console.plan.yours.remove.cta',
  'console.lecture.outline.upGlyph',
  'console.lecture.outline.downGlyph',
  'landing.footer.copyright',
  'landing.localeBanner.close.cta',
  // F-TCH-004 PR 6: the presenter's slide counter, two numbers and a slash.
  'learner.presenter.bar.counter',
  // F-TCH-004 PR 9: the class timer's "+30 s", "{n} min" and "{n} s": SI unit symbols, the same in Spanish (README Strings).
  'learner.presenter.timer.add.cta',
  'learner.presenter.timer.minutes',
  'learner.presenter.timer.seconds',
  // Owner items 6 and 7: the Aa sign of the Display sheet, a glyph hidden from assistive tech.
  'common.display.button',
];
