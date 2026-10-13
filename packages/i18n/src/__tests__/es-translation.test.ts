import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { fallbackPaths, getMessages, isEnglishAuthoritative } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-I18N-001 PR 15 (Spanish): every UI key has a Spanish value, the review ledger records the review
 * of each namespace, and the literal rows the spec names read as written (§3.4, §3.10, §10).
 */
describe('Spanish dictionary (F-I18N-001 PR 15)', () => {
  const es = getMessages('es');

  it('has no English fallback: every key outside the English-authoritative legal text is translated', () => {
    expect(fallbackPaths('es')).toEqual([]);
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
    const untouched = leafPaths(en).filter((path) => {
      if (isEnglishAuthoritative(path) || SAME_IN_BOTH.has(path)) return false;
      const own = lookup(es, path);
      const source = lookup(en, path);
      if (typeof own === 'string') return own === source;
      if (typeof own === 'function' && typeof source === 'function') {
        const rows = SAMPLES[path] ?? [];
        return rows.length > 0 && rows.every((args) => (own as (...a: unknown[]) => string)(...args) === (source as (...a: unknown[]) => string)(...args));
      }
      return false;
    });
    expect([...untouched].sort()).toEqual([...LITERALLY_SHARED].sort());
  });

  it('reads the spec examples (§3.1, §3.4)', () => {
    expect(es.learner.home.streak.pill(1)).toBe('Racha de 1 día');
    expect(es.learner.home.streak.pill(5)).toBe('Racha de 5 días');
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
  'a11y.planStatus',
  'a11y.myRoute.later',
  'a11y.myRoute.cell',
  'a11y.myRoute.skill',
  'a11y.myRoute.gain',
  'a11y.myRoute.homeStrip',
  'learner.journey.countMark',
  'learner.journey.cellStories.title',
  'learner.quest.progress',
  'learner.minigame.progress.pill',
  'learner.story.check.position.pill',
  'learner.story.reader.position.pill',
  'learner.storyShelf.episode.rowLabel',
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
  'console.parent.child.stars',
  'console.learningRoute.stageRow',
  'report.detail.strand',
  'report.class.count',
  'report.letter',
  // Words Spanish uses as they are: the minute abbreviation "min", "final", "Plan", "Extras", "Quiz", "admin", "App", "Android".
  'a11y.minigame.finalTile',
  'learner.storyShelf.episode.minutes.pill',
  'console.space.openPlan.label',
  'console.plan.catalog.questLine',
  'console.curriculum.rhythm.minutesOption',
  'console.curriculum.preview.table.extras',
  'console.lecture.catalogue.line',
  'console.lecture.outline.minutes',
  'console.lecture.outline.addQuiz.cta',
  'console.settings.grownUps.role.admin',
  'landing.footer.app',
  'learner.audio.voiceHelp.sections.android.title',
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
];
