import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-BROWSE-001 BR-6 (sections 4.1, 4.3, 4.5, 4.7 and 6; OD-8; mocks
 * design/screens/browse/access.md and preview-frame.md): the All lessons root's
 * first strings. One name everywhere, "Browse" in no UI string, no price, no
 * "Premium", no age, and no Hangul in English (rule 5). BR-7 adds home, the
 * episode outline, the item page, Lesson display and the keep switch; BR-8 and
 * BR-9 add the rest of `caregiver.browse`.
 */
const browse = getMessages('en').caregiver.browse;

/** What a leaf renders: the string, or one output per SAMPLES row. */
function rendered(path: string): string[] {
  const value = lookup(browse, path);
  if (typeof value === 'string') return [value];
  const rows = SAMPLES[`caregiver.browse.${path}`];
  expect(rows, `function message ${path} needs a row in SAMPLES`).toBeDefined();
  return (rows ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
}

/** BR-7: home, the episode outline, the item page, Lesson display and the keep switch. */
const BR7_KEYS = [
  'home.lessonDisplay.cta',
  'home.offline',
  'home.scope.sampler',
  'home.scope.fallback',
  'home.pointer',
  'home.note.letterAcrossStage1',
  'home.note.notInVersion',
  'home.note.dismiss',
  'home.section.label',
  'home.section.route',
  'home.section.journey',
  'home.section.library',
  'home.stages.line',
  'home.stages.item',
  'home.routeRowA11y',
  'home.themes',
  'home.cardSlotA11y',
  'home.wordCount',
  'home.wordsRowA11y',
  'home.storyTileA11y',
  'keep.label',
  'keep.failed',
  'display.title',
  'display.romanization',
  'display.always',
  'display.tap',
  'display.language',
  'display.note',
  'display.done.cta',
  'episode.back',
  'episode.stagePill',
  'episode.lessons',
  'episode.stories',
  'episode.cards',
  'episode.comingLater',
  'episode.open.cta',
  'episode.openA11y',
  'episode.storyMeta',
  'cardRowA11y',
  'minutes',
  'item.back',
  'item.kind.quest',
  'item.kind.story',
  'item.kind.vocabTopic',
  'item.teaches',
  'item.where.title',
  'item.where.stage',
  'item.where.lesson',
  'item.where.see.cta',
  'item.card',
  'item.focus',
  'item.focusChipA11y',
  'item.preview.cta',
  'item.previewStory.cta',
  'item.previewQuestions.cta',
  'item.closed',
  'item.openBilling.cta',
  'item.wordCount',
  'facts.letters',
  'facts.words',
  'facts.syllables',
  'facts.skills',
  'facts.steps',
  'facts.levels',
  'facts.levelGroup',
  'facts.level.listen',
  'facts.level.readAlong',
  'facts.level.read',
  'facts.scenes',
  'facts.keywords',
  'facts.sources',
  'facts.seeSources.cta',
];

describe('caregiver.browse (BR-6)', () => {
  it('names the tab, the page and the preview strip as OD-8 says', () => {
    expect(browse.documentTitle).toBe('Hangul Route lessons');
    expect(browse.home.title).toBe('All lessons');
    expect(browse.home.close.cta).toBe('Close');
    expect(browse.home.howTo).toBe('Tap a lesson to see what it teaches, then play it. Nothing is saved.');
    expect(browse.preview.strip).toBe('Preview. Nothing is saved.');
    expect(browse.preview.leave.cta).toBe('Leave preview');
  });

  it('has the Access screen of section 4.3: title, a line per source, the pre-BR-12b gate line and every action', () => {
    expect(browse.access.title).toBe('This page is for parents and teachers.');
    expect(browse.access.line).toEqual({
      gate: 'Your time in the grown-up area ended.',
      gateUntilIntent: 'Your time in the grown-up area ended. Go back to the app, then open the grown-up area again.',
      account: 'Open lessons again from your account.',
      unknown: 'On a family device, open them from the grown-up area. Parents and teachers can also open them from their account.',
    });
    expect(browse.access.backToGrownUp.cta).toBe('Back to the grown-up area');
    expect(browse.access.backToApp.cta).toBe('Back to the app');
    expect(browse.access.openFromAccount.cta).toBe('Open lessons from my account');
    expect(browse.access.signIn.cta).toBe('Sign in');
    expect(browse.access.offline).toBe('Grown-up pages need the internet.');
  });

  it('holds exactly these keys', () => {
    expect(leafPaths(browse).sort()).toEqual(
      [
        'access.backToApp.cta',
        'access.backToGrownUp.cta',
        'access.line.account',
        'access.line.gate',
        'access.line.gateUntilIntent',
        'access.line.unknown',
        'access.offline',
        'access.openFromAccount.cta',
        'access.signIn.cta',
        'access.title',
        'documentTitle',
        'home.close.cta',
        'home.howTo',
        'home.title',
        'preview.leave.cta',
        'preview.strip',
        ...BR7_KEYS,
      ].sort(),
    );
  });

  it('passes the caregiver ban list and the spec list; no "Browse", no age, no price, no Hangul', () => {
    for (const path of leafPaths(browse)) for (const s of rendered(path)) {
      expect(findBannedWord(s, 'en', 'caregiver'), `${path}: ${s}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
      expect(s, path).not.toMatch(/browse|\bkids?\b|premium|upgrade|unlock|\bfail|wrong|behind|\$|\d+\s*[-–]\s*\d+/i);
      expect(s, path).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
    }
  });
});

describe('caregiver.browse (BR-7)', () => {
  it('uses the section 6 drafts and the mock words for home', () => {
    expect(browse.home.scope).toEqual({
      sampler: "Your learner's free lessons are open. The others show what they teach.",
      fallback: 'Showing free lessons. We could not check your plan.',
    });
    expect(browse.home.pointer).toBe('To see how your learner is doing, open your home page.');
    expect(browse.home.section).toEqual({ label: 'Show lessons by', route: 'Route', journey: 'Journey', library: 'Library' });
    expect(browse.home.stages.line(7)).toBe('7 stages, from letters to your own words');
    expect(browse.home.note.letterAcrossStage1).toBe('This letter is practiced across Stage 1.');
    expect(browse.home.note.notInVersion).toBe('This lesson is not in this version of the app yet.');
    expect(browse.keep.label).toBe('Keep lessons on this device for 7 days, also offline');
    expect(browse.home.wordCount(12)).toBe('· 12 words');
    expect(browse.home.wordsRowA11y('Food', 12)).toBe('Food, 12 words. Opens the topic.');
    expect(browse.home.storyTileA11y('The Moon Rabbit', 4)).toBe('The Moon Rabbit. About 4 minutes.');
    expect(browse.home.storyTileA11y('The Moon Rabbit', 1)).toBe('The Moon Rabbit. About 1 minute.');
    expect(browse.keep.failed).toBe('Lessons could not be kept on this device.');
    expect(browse.item.wordCount(12)).toBe('12 words');
    expect(browse.item.wordCount(1)).toBe('1 word');
  });

  it('names the item page parts, the grown-up closed line and the billing button (F-ENT-003 section 3.11, F-BILL-002)', () => {
    expect(browse.item.closed).toBe('Opens with the Family Plan or a Group License');
    expect(browse.item.openBilling.cta).toBe('Open billing');
    expect(browse.item.preview.cta).toBe('Preview this lesson');
    expect(browse.item.where.title).toBe('Where it sits');
    expect(`${browse.item.where.stage(1)} · Letters · ${browse.item.where.lesson(1, 3)}`).toBe('Stage 1 · Letters · lesson 1 of 3');
    expect(browse.minutes(5)).toBe('About 5 minutes');
    expect(browse.minutes(1)).toBe('About 1 minute');
    expect(browse.display.note).toBe("These choices change only this preview. No learner's settings change.");
  });
});

/**
 * F-BROWSE-001 BR-10 (sections 4.3, 4.11, 6): the console strings beside an entry and the deep-link buttons, in
 * English, Spanish and Korean; the navigation label is `console.shell.nav.lessons`.
 */
describe('console.browse (BR-10)', () => {
  const consoleBrowse = getMessages('en').console.browse;

  it('says what section 4.3 says: the failed check, its two actions and the blocked storage line', () => {
    expect(consoleBrowse.checkFailed).toBe('Could not check your plan.');
    expect(consoleBrowse.tryAgain.cta).toBe('Try again');
    expect(consoleBrowse.openFree.cta).toBe('Open free lessons');
    expect(consoleBrowse.storageBlocked).toBe("Your browser blocked this page's storage, so lessons cannot open here.");
    expect(consoleBrowse.preview.cta).toBe('Preview');
    expect(consoleBrowse.previewLessons.cta).toBe('Preview lessons');
    expect(getMessages('en').console.shell.nav.lessons).toBe('Lessons');
  });

  it('holds exactly these keys, each with its Spanish and Korean value', () => {
    const paths = leafPaths(consoleBrowse).sort();
    expect(paths).toEqual(['checkFailed', 'openFree.cta', 'preview.cta', 'previewLessons.cta', 'storageBlocked', 'tryAgain.cta']);
    for (const locale of ['es', 'ko'] as const) {
      const local = getMessages(locale).console.browse;
      for (const path of paths) expect(String(lookup(local, path)), `${locale} ${path}`).not.toBe(String(lookup(consoleBrowse, path)));
      expect(getMessages(locale).console.shell.nav.lessons, locale).not.toBe('Lessons');
    }
  });

  it('passes the caregiver ban list in every locale; no "Browse", no age, no price, no lock word, no Hangul in English', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const local = getMessages(locale).console.browse;
      for (const path of leafPaths(local)) {
        const s = String(lookup(local, path));
        expect(findBannedWord(s, locale, 'caregiver'), `${locale} ${path}: ${s}`).toBeNull();
        expect(s, `${locale} ${path}`).not.toMatch(/\bbrowse\b|\bkids?\b|premium|upgrade|unlock|\$|\d/i);
        if (locale === 'en') {
          for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
          expect(s, path).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
        }
      }
    }
  });
});
